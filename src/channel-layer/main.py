from fastapi import FastAPI, Request, HTTPException
from google.cloud import pubsub_v1
import os
import json
import logging
from datetime import datetime
import requests

import psycopg2
from psycopg2.extras import RealDictCursor

# Configuración
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "digikawsay")
PUBSUB_TOPIC = os.getenv("PUBSUB_INBOUND_TOPIC", "iap.channel.inbound")
PUBSUB_OUTBOUND_SUB = os.getenv("PUBSUB_OUTBOUND_SUB", "channel-outbound-sub")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/digikawsay")

app = FastAPI(title="DigiKawsay Channel Layer")
publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, PUBSUB_TOPIC)

subscriber = pubsub_v1.SubscriberClient()
outbound_sub_path = subscriber.subscription_path(PROJECT_ID, PUBSUB_OUTBOUND_SUB)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================
# Consent & Onboarding Messages
# ============================================================
CONSENT_MESSAGE = (
    "👋 ¡Hola! Bienvenido/a al *Foro Organizacional DigiKawsay*.\n\n"
    "Antes de comenzar, es importante que sepas:\n"
    "• Tus aportes se procesan de manera *confidencial*.\n"
    "• Utilizamos inteligencia artificial para analizar patrones, nunca para evaluarte.\n"
    "• Puedes retirarte en cualquier momento escribiendo /salir.\n\n"
    "¿Deseas participar? Responde *sí* para continuar."
)

WELCOME_MESSAGE = (
    "✅ ¡Gracias por aceptar! Tu participación es valiosa.\n\n"
    "📋 *Tema del foro:*\n{seed_prompt}\n\n"
    "Cuéntame: ¿qué piensas al respecto? No hay respuestas correctas ni incorrectas — "
    "lo que importa es tu perspectiva."
)

ALREADY_CLOSED_MESSAGE = (
    "Este foro ya ha sido cerrado. ¡Gracias por tu interés!"
)


def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def send_telegram(chat_id: str, text: str, parse_mode: str = "Markdown"):
    """Send a message to Telegram."""
    if TELEGRAM_BOT_TOKEN:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")


def resolve_participant(user_id: str, invite_token: str = None):
    """
    Resolve a Telegram user to a participant + project.
    Returns (participant_row, project_row) or (None, None).
    """
    try:
        conn = get_db()
        cur = conn.cursor()

        # Check if user is already an active participant
        cur.execute("""
            SELECT p.*, pr.seed_prompt, pr.status as project_status
            FROM participants p
            JOIN projects pr ON p.project_id = pr.project_id
            WHERE p.participant_id = %s AND p.status IN ('active', 'invited')
            ORDER BY p.registered_at DESC LIMIT 1
        """, (user_id,))
        existing = cur.fetchone()

        if existing:
            cur.close()
            conn.close()
            return dict(existing), None

        # If they used a /start deep link with invite_token
        if invite_token:
            # First check if invite_token is actually a project_id (direct project join)
            cur.execute("SELECT * FROM projects WHERE project_id::text = %s AND status = 'active'", (invite_token,))
            direct_project = cur.fetchone()

            if direct_project:
                # Direct join by project_id — register them
                cur.execute("""
                    INSERT INTO participants (participant_id, project_id, status, consent_given)
                    VALUES (%s, %s, 'invited', false)
                    ON CONFLICT (participant_id) DO UPDATE SET project_id = %s
                    RETURNING *
                """, (user_id, invite_token, invite_token))
                participant = dict(cur.fetchone())
                conn.commit()
                cur.close()
                conn.close()
                participant['seed_prompt'] = direct_project['seed_prompt']
                participant['project_status'] = direct_project['status']
                return participant, None

            # Invite token lookup
            cur.execute("""
                SELECT p.*, pr.seed_prompt, pr.status as project_status
                FROM participants p
                JOIN projects pr ON p.project_id = pr.project_id
                WHERE p.invite_token = %s
            """, (invite_token,))
            invited = cur.fetchone()

            if invited:
                project_id = invited['project_id']
                # Update the placeholder with the real Telegram user ID
                cur.execute("""
                    UPDATE participants
                    SET participant_id = %s, status = 'invited'
                    WHERE invite_token = %s
                """, (user_id, invite_token))
                conn.commit()
                result = dict(invited)
                result['participant_id'] = user_id
                cur.close()
                conn.close()
                return result, None

        cur.close()
        conn.close()
        return None, None
    except Exception as e:
        logger.error(f"Error resolving participant: {e}")
        return None, None


@app.post("/webhook")
async def telegram_webhook(request: Request):
    """Receive Telegram updates, handle onboarding flow, and route to PubSub."""
    try:
        data = await request.json()

        if "message" not in data or "text" not in data["message"]:
            return {"status": "ignored", "reason": "not a text message"}

        user_id = str(data["message"]["from"]["id"])
        text = data["message"]["text"]
        message_id = str(data["message"]["message_id"])

        # --- Handle /start (Deep Link with invite token) ---
        if text.startswith("/start"):
            parts = text.split(" ", 1)
            invite_token = parts[1] if len(parts) > 1 else None
            participant, _ = resolve_participant(user_id, invite_token)

            if participant:
                if participant.get('project_status') == 'closed':
                    send_telegram(user_id, ALREADY_CLOSED_MESSAGE)
                    return {"status": "ok", "action": "project_closed"}

                if not participant.get('consent_given'):
                    send_telegram(user_id, CONSENT_MESSAGE)
                    return {"status": "ok", "action": "consent_requested"}
                else:
                    send_telegram(user_id, "¡Ya estás participando! Continúa compartiendo tus perspectivas.")
                    return {"status": "ok", "action": "already_active"}
            else:
                send_telegram(user_id, "No se encontró una invitación válida. Contacta al organizador del foro.")
                return {"status": "ok", "action": "no_invitation"}

        # --- Handle /salir (Withdrawal) ---
        if text.strip().lower() == "/salir":
            try:
                conn = get_db()
                cur = conn.cursor()
                cur.execute("""
                    UPDATE participants SET status = 'withdrawn'
                    WHERE participant_id = %s AND status IN ('active', 'invited')
                """, (user_id,))
                conn.commit()
                cur.close()
                conn.close()
            except Exception:
                pass
            send_telegram(user_id, "Has decidido retirarte del foro. Tu participación ha sido valorada. 🙏")
            return {"status": "ok", "action": "withdrawn"}

        # --- Handle consent response ---
        participant, _ = resolve_participant(user_id)
        if participant and not participant.get('consent_given'):
            if text.strip().lower() in ('sí', 'si', 'yes', 'acepto', 'ok'):
                try:
                    conn = get_db()
                    cur = conn.cursor()
                    cur.execute("""
                        UPDATE participants SET consent_given = true, consent_timestamp = NOW(),
                               status = 'active', first_message_at = NOW()
                        WHERE participant_id = %s
                    """, (user_id,))
                    conn.commit()

                    seed_prompt = participant.get('seed_prompt', 'Comparte tu perspectiva sobre el tema del foro.')
                    cur.close()
                    conn.close()
                    send_telegram(user_id, WELCOME_MESSAGE.format(seed_prompt=seed_prompt))
                except Exception as e:
                    logger.error(f"Error updating consent: {e}")
            else:
                send_telegram(user_id, "Si deseas participar, responde *sí*. Si no, no te preocupes. 😊")
            return {"status": "ok", "action": "consent_flow"}

        # --- Check participant is active before routing to VAL ---
        if not participant or participant.get('status') != 'active':
            send_telegram(user_id, "Para participar, necesitas una invitación. Contacta al organizador del foro.")
            return {"status": "ok", "action": "not_registered"}

        if participant.get('project_status') == 'closed':
            send_telegram(user_id, ALREADY_CLOSED_MESSAGE)
            return {"status": "ok", "action": "project_closed"}

        # --- Route to PubSub for VAL processing ---
        # Update last_message_at
        try:
            conn = get_db()
            cur = conn.cursor()
            cur.execute("UPDATE participants SET last_message_at = NOW() WHERE participant_id = %s", (user_id,))
            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            pass

        inbound_message = {
            "message_id": message_id,
            "participant_id": user_id,
            "project_id": str(participant.get('project_id', '')),
            "channel": "telegram",
            "text": text,
            "modality": "text",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        payload_bytes = json.dumps(inbound_message).encode("utf-8")
        future = publisher.publish(topic_path, payload_bytes)
        future.result()

        logger.info(f"Published msg from {user_id} to Pub/Sub: {message_id}")
        return {"status": "ok"}

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "channel-layer"}


def process_outbound_msg(message):
    """Send VAL responses back to Telegram."""
    try:
        packet = json.loads(message.data.decode("utf-8"))
        participant_id = packet.get("participant_id")
        text = packet.get("text")

        if TELEGRAM_BOT_TOKEN and participant_id:
            send_telegram(participant_id, text, parse_mode=None)
            logger.info(f"Sent reply to Telegram chat {participant_id}")
        else:
            logger.warning(f"No token or participant_id. Mock sent: {text}")

        message.ack()
    except Exception as e:
        logger.error(f"Error processing outbound message: {e}")
        message.nack()


@app.on_event("startup")
def startup_event():
    logger.info(f"Starting Pub/Sub subscriber on {outbound_sub_path}")
    subscriber.subscribe(outbound_sub_path, callback=process_outbound_msg)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
