import os
import json
import time
import logging
from concurrent.futures import TimeoutError
from google.cloud import pubsub_v1
from langchain_core.messages import HumanMessage, AIMessage

from graph import get_compiled_graph, initialize_llm
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool

import psycopg2
from psycopg2.extras import RealDictCursor

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "digikawsay")
SUBSCRIPTION_NAME = os.getenv("PUBSUB_PACKET_INBOUND_SUB", "val-packet-sub")
OUTBOUND_TOPIC = os.getenv("PUBSUB_OUTBOUND_TOPIC", "iap.channel.outbound")
SUPERVISOR_TOPIC = os.getenv("PUBSUB_VAL_TO_AG00_TOPIC", "iap.val.to.ag00")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/digikawsay",
)

CONTINGENCY_MESSAGE = (
    "Necesito un momento para procesar todo lo que hemos hablado, "
    "vuelvo contigo pronto."
)

# Global pool and compiled graph app
pool = None
app = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

subscriber = pubsub_v1.SubscriberClient()
subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_NAME)
publisher = pubsub_v1.PublisherClient()


def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def _publish_contingency(participant_id: str, message_id: str):
    outbound_msg = {
        "participant_id": participant_id,
        "text": CONTINGENCY_MESSAGE,
        "in_reply_to": message_id,
    }
    publisher.publish(
        publisher.topic_path(PROJECT_ID, OUTBOUND_TOPIC),
        json.dumps(outbound_msg).encode("utf-8"),
    )


def _notify_ag00_quota_exceeded(participant_id: str):
    ag00_report = {
        "event": "QUOTA_EXCEEDED",
        "participant_id": participant_id,
        "detail": "VAL no pudo generar respuesta por límite de cuota o error de IA.",
    }
    publisher.publish(
        publisher.topic_path(PROJECT_ID, SUPERVISOR_TOPIC),
        json.dumps(ag00_report).encode("utf-8"),
    )


def _load_project_context(participant_id: str):
    """Load the project's seed_prompt for this participant."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT pr.project_id, pr.seed_prompt, pr.name as project_name
            FROM participants p
            JOIN projects pr ON p.project_id = pr.project_id
            WHERE p.participant_id = %s AND p.status = 'active'
            LIMIT 1
        """, (participant_id,))
        result = cur.fetchone()
        cur.close()
        conn.close()
        return dict(result) if result else None
    except Exception as e:
        logger.warning(f"Could not load project context: {e}")
        return None


def _load_pending_directives(participant_id: str):
    """Load pending WoZ directives from PostgreSQL."""
    directives = []
    directive_ids = []
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, content FROM wizard_directives
            WHERE participant_id = %s AND status = 'PENDING'
            ORDER BY created_at ASC
        """, (participant_id,))
        rows = cur.fetchall()
        for row in rows:
            directive_ids.append(row['id'])
            directives.append(row['content'])
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning(f"Could not load WoZ directives: {e}")
    return directives, directive_ids


def _persist_turn(participant_id: str, project_id: str, user_text: str,
                  val_response: str, emotional_register: str, speech_act: str,
                  topics: list, directive_applied: str, latency_ms: int):
    """Persist a complete dialogue turn to the database."""
    try:
        conn = get_db()
        cur = conn.cursor()

        # Get current turn count
        cur.execute("""
            SELECT COALESCE(MAX(turn_number), 0) as max_turn
            FROM dialogue_turns
            WHERE participant_id = %s AND project_id = %s
        """, (participant_id, project_id))
        max_turn = cur.fetchone()['max_turn']
        turn_number = max_turn + 1

        # Insert the turn
        cur.execute("""
            INSERT INTO dialogue_turns
                (participant_id, project_id, turn_number, user_text, val_response,
                 emotional_register, speech_act, topics, directive_applied, latency_ms)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (participant_id, project_id, turn_number, user_text, val_response,
              emotional_register, speech_act, topics, directive_applied, latency_ms))

        # Upsert dialogue_states
        cur.execute("""
            INSERT INTO dialogue_states
                (participant_id, project_id, cycle_id, turn_count, emotional_register,
                 topics_covered, last_turn_at, status)
            VALUES (%s, %s, 1, %s, %s, %s, NOW(), 'active')
            ON CONFLICT (participant_id, project_id, cycle_id)
            DO UPDATE SET
                turn_count = %s,
                emotional_register = %s,
                topics_covered = dialogue_states.topics_covered || %s,
                last_turn_at = NOW()
        """, (participant_id, project_id, turn_number, emotional_register, topics,
              turn_number, emotional_register, topics))

        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Turn {turn_number} persisted for {participant_id}")
    except Exception as e:
        logger.error(f"Error persisting turn: {e}")


def _mark_directives_applied(directive_ids: list, effect_summary: str = ""):
    """Mark WoZ directives as applied."""
    if not directive_ids:
        return
    try:
        conn = get_db()
        cur = conn.cursor()
        for d_id in directive_ids:
            cur.execute("""
                UPDATE wizard_directives 
                SET status = 'APPLIED', applied_at = NOW(), effect_summary = %s
                WHERE id = %s
            """, (effect_summary, d_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning(f"Could not mark directives: {e}")


def process_dialogue_packet(message: pubsub_v1.subscriber.message.Message):
    participant_id = "unknown"
    message_id = "unknown"
    start_time = time.time()

    try:
        packet = json.loads(message.data.decode("utf-8"))
        participant_id = packet.get("participant_id", "unknown")
        user_text = packet.get("original_text", packet.get("text", ""))
        message_id = packet.get("message_id", "unknown")
        project_id_str = packet.get("project_id", "")

        logger.info(f"VAL - Processing request from {participant_id}")

        # 1. Load project context (seed_prompt)
        project_ctx = _load_project_context(participant_id)
        if not project_id_str and project_ctx:
            project_id_str = str(project_ctx.get('project_id', ''))

        # 2. Load pending WoZ directives
        active_directives, directive_ids = _load_pending_directives(participant_id)

        # 3. Configure LangGraph thread
        config = {"configurable": {"thread_id": participant_id}}

        # 4. Build input with project context
        input_data = {"messages": [HumanMessage(content=user_text)]}
        if active_directives:
            input_data["expert_directives"] = active_directives
        if project_ctx:
            input_data["project_config"] = {
                "seed_prompt": project_ctx.get("seed_prompt", ""),
                "project_name": project_ctx.get("project_name", ""),
            }

        # 5. Invoke the graph
        try:
            output = app.invoke(input_data, config)
        except Exception as invoke_err:
            err_str = str(invoke_err).lower()
            is_quota = any(m in err_str for m in ["429", "resource exhausted", "quota", "rate limit"])
            is_auth = any(m in err_str for m in ["permission denied", "403", "credentials"])
            if is_quota or is_auth:
                _publish_contingency(participant_id, message_id)
                _notify_ag00_quota_exceeded(participant_id)
                message.ack()
                return
            raise

        # 6. Extract response and metadata
        ai_message = output["messages"][-1]
        val_response_text = ai_message.content
        latency_ms = int((time.time() - start_time) * 1000)

        # Extract emotion and speech act from dialogue_states
        dstates = output.get("dialogue_states", {})
        current_state = dstates.get(participant_id, {})
        emotion = current_state.get("emotional_register", "Neutral")
        topics = current_state.get("topics_covered", [])
        # Get the last speech act from topics if available
        speech_act = ""
        for t in reversed(topics):
            if t.startswith("Act: "):
                speech_act = t[5:]
                break

        directive_content = "; ".join(active_directives) if active_directives else None

        # 7. Persist turn to database
        _persist_turn(
            participant_id=participant_id,
            project_id=project_id_str,
            user_text=user_text,
            val_response=val_response_text,
            emotional_register=emotion,
            speech_act=speech_act,
            topics=topics[-3:] if topics else [],  # last 3 topics
            directive_applied=directive_content,
            latency_ms=latency_ms
        )

        # 8. Publish to Channel Outbound
        outbound_msg = {
            "participant_id": participant_id,
            "text": val_response_text,
            "in_reply_to": message_id,
        }
        publisher.publish(
            publisher.topic_path(PROJECT_ID, OUTBOUND_TOPIC),
            json.dumps(outbound_msg).encode("utf-8"),
        )

        # 8.5 El Espejo — deliver semantic convergences/divergences every 3rd turn
        turn_count = len(output["messages"]) // 2
        if turn_count >= 3 and turn_count % 3 == 0 and project_id_str:
            try:
                from espejo import get_espejo, format_espejo_for_val
                espejo_result = get_espejo(
                    participant_id=participant_id,
                    project_id=project_id_str,
                    latest_text=user_text,
                )
                espejo_text = format_espejo_for_val(espejo_result)
                if espejo_text:
                    import time as _time
                    _time.sleep(2)  # Brief pause for natural pacing
                    espejo_msg = {
                        "participant_id": participant_id,
                        "text": espejo_text,
                        "in_reply_to": message_id,
                    }
                    publisher.publish(
                        publisher.topic_path(PROJECT_ID, OUTBOUND_TOPIC),
                        json.dumps(espejo_msg).encode("utf-8"),
                    )
                    logger.info(f"Espejo delivered for {participant_id}: "
                               f"{len(espejo_result.get('convergences', []))} convergences, "
                               f"{len(espejo_result.get('divergences', []))} divergences")
            except Exception as espejo_err:
                logger.warning(f"Espejo delivery failed: {espejo_err}")

        # 9. Notify AG-00
        turn_count = len(output["messages"]) // 2
        ag00_report = {
            "event": "TURN_COMPLETED",
            "participant_id": participant_id,
            "project_id": project_id_str,
            "turn_count": turn_count,
            "emotional_register": emotion,
            "topics": topics[-5:] if topics else [],
            "latency_ms": latency_ms,
        }
        publisher.publish(
            publisher.topic_path(PROJECT_ID, SUPERVISOR_TOPIC),
            json.dumps(ag00_report).encode("utf-8"),
        )

        # 10. Mark WoZ directives as applied
        _mark_directives_applied(directive_ids, f"Applied in turn response: {val_response_text[:100]}")

        message.ack()
        logger.info(f"VAL - Turn completed for {participant_id} ({latency_ms}ms)")

    except Exception as e:
        logger.error(f"Error processing packet in VAL: {e}")
        message.nack()


def main():
    global pool, app

    logger.info("Initializing VAL LLM...")
    initialize_llm()

    logger.info("Connecting to Postgres Checkpointer...")
    pool = ConnectionPool(
        conninfo=DATABASE_URL,
        max_size=10,
        kwargs={"autocommit": True},
    )

    checkpointer = PostgresSaver(pool)
    checkpointer.setup()
    app = get_compiled_graph(checkpointer=checkpointer)

    logger.info(f"VAL Agent listening on: {subscription_path}")
    streaming_pull_future = subscriber.subscribe(
        subscription_path, callback=process_dialogue_packet
    )

    with subscriber:
        try:
            streaming_pull_future.result()
        except TimeoutError:
            streaming_pull_future.cancel()
            streaming_pull_future.result()
        except Exception as e:
            logger.error(f"VAL Subscriber failed: {e}")
            streaming_pull_future.cancel()


if __name__ == "__main__":
    main()
