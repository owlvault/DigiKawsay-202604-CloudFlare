import os
import json
import logging
from concurrent.futures import TimeoutError
from google.cloud import pubsub_v1
from langchain_core.messages import HumanMessage, AIMessage

from graph import get_compiled_graph, initialize_llm
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "my-gcp-project")
SUBSCRIPTION_NAME = os.getenv("PUBSUB_PACKET_INBOUND_SUB", "val-packet-sub")
OUTBOUND_TOPIC = os.getenv("PUBSUB_OUTBOUND_TOPIC", "iap.channel.outbound")
SUPERVISOR_TOPIC = os.getenv("PUBSUB_VAL_TO_AG00_TOPIC", "iap.val.to.ag00")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/digikawsay",
)

# Mensaje de contingencia cuando el modelo de IA no está disponible
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


def _publish_contingency(participant_id: str, message_id: str):
    """Publica un mensaje de contingencia elegante al canal de salida."""
    outbound_msg = {
        "participant_id": participant_id,
        "text": CONTINGENCY_MESSAGE,
        "in_reply_to": message_id,
    }
    publisher.publish(
        publisher.topic_path(PROJECT_ID, OUTBOUND_TOPIC),
        json.dumps(outbound_msg).encode("utf-8"),
    )
    logger.info(
        f"Mensaje de contingencia enviado a participante {participant_id}"
    )


def _notify_ag00_quota_exceeded(participant_id: str):
    """Notifica al supervisor AG-00 de un problema de cuota/recursos."""
    ag00_report = {
        "event": "QUOTA_EXCEEDED",
        "participant_id": participant_id,
        "detail": (
            "VAL no pudo generar respuesta por límite de cuota o error "
            "de autenticación con el proveedor de IA."
        ),
    }
    publisher.publish(
        publisher.topic_path(PROJECT_ID, SUPERVISOR_TOPIC),
        json.dumps(ag00_report).encode("utf-8"),
    )
    logger.info(
        f"AG-00 notificado: QUOTA_EXCEEDED para participante {participant_id}"
    )


def process_dialogue_packet(message: pubsub_v1.subscriber.message.Message):
    packet = None
    participant_id = "unknown"
    message_id = "unknown"

    try:
        packet = json.loads(message.data.decode("utf-8"))
        participant_id = packet.get("participant_id", "unknown")
        user_text = packet.get("original_text")
        message_id = packet.get("message_id", "unknown")

        logger.info(
            f"VAL - Procesando request de participante {participant_id}"
        )

        # 1. Configurar hilo persistente (thread_id) para LangGraph Checkpointer
        config = {"configurable": {"thread_id": participant_id}}

        # 2. Input para LangGraph
        input_data = {"messages": [HumanMessage(content=user_text)]}

        # 3. Ejecutar el grafo — con manejo específico de errores de cuota
        try:
            output = app.invoke(input_data, config)
        except Exception as invoke_err:
            # Detectar errores de cuota / autenticación de Google Cloud
            err_type = type(invoke_err).__name__
            err_str = str(invoke_err).lower()

            is_quota_error = any(
                marker in err_str
                for marker in [
                    "429",
                    "resource exhausted",
                    "resourceexhausted",
                    "quota",
                    "rate limit",
                    "too many requests",
                ]
            )
            is_auth_error = any(
                marker in err_str
                for marker in [
                    "permission denied",
                    "permissiondenied",
                    "403",
                    "authentication",
                    "credentials",
                    "billing",
                ]
            )

            if is_quota_error or is_auth_error:
                error_kind = "cuota" if is_quota_error else "autenticación"
                logger.error(
                    f"Error de {error_kind} al invocar Gemini para "
                    f"participante {participant_id}: {invoke_err}"
                )
                _publish_contingency(participant_id, message_id)
                _notify_ag00_quota_exceeded(participant_id)
                message.ack()
                return

            # Si no es de cuota/auth, re-lanzar para el catch genérico
            raise

        # 4. Extraer respuesta de VAL
        ai_message = output["messages"][-1]
        val_response_text = ai_message.content

        logger.info(f"VAL - Respuesta generada: {val_response_text[:50]}...")

        # 5. Publicar a Channel Outbound (para Telegram)
        outbound_msg = {
            "participant_id": participant_id,
            "text": val_response_text,
            "in_reply_to": message_id,
        }
        publisher.publish(
            publisher.topic_path(PROJECT_ID, OUTBOUND_TOPIC),
            json.dumps(outbound_msg).encode("utf-8"),
        )

        dstates = output.get("dialogue_states", {})
        current_state = dstates.get(participant_id, {})
        emotion = current_state.get("emotional_register", "Neutral")

        # 6. Notificar al supervisor (AG-00) del ciclo completado
        ag00_report = {
            "event": "TURN_COMPLETED",
            "participant_id": participant_id,
            "turn_count": len(output["messages"]) // 2,
            "emotional_register": emotion,
            "topics": current_state.get("topics_covered", []),
        }
        publisher.publish(
            publisher.topic_path(PROJECT_ID, SUPERVISOR_TOPIC),
            json.dumps(ag00_report).encode("utf-8"),
        )

        message.ack()

    except Exception as e:
        logger.error(f"Error procesando packet en VAL: {e}")
        message.nack()


def main():
    global pool, app

    # 1. Inicializar LLM (recupera API key de Secret Manager o env var)
    logger.info("Inicializando LLM de VAL...")
    initialize_llm()

    # 2. Conectar al Checkpointer en Postgres
    logger.info("Conectando al Checkpointer en Postgres...")
    pool = ConnectionPool(
        conninfo=DATABASE_URL,
        max_size=10,
        kwargs={"autocommit": True},
    )

    # Initialize checkpointer and auto-run setup (creates langgraph schemas)
    checkpointer = PostgresSaver(pool)
    checkpointer.setup()
    app = get_compiled_graph(checkpointer=checkpointer)

    logger.info(f"VAL Agent escuchando en sub: {subscription_path}")
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
