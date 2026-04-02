from fastapi import FastAPI, Request, HTTPException
from google.cloud import pubsub_v1
import os
import json
import logging
from datetime import datetime
import requests

# Configuración
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "my-gcp-project")
PUBSUB_TOPIC = os.getenv("PUBSUB_INBOUND_TOPIC", "iap.channel.inbound")
PUBSUB_OUTBOUND_SUB = os.getenv("PUBSUB_OUTBOUND_SUB", "channel-outbound-sub")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

app = FastAPI(title="DigiKawsay Channel Layer")
publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, PUBSUB_TOPIC)

subscriber = pubsub_v1.SubscriberClient()
outbound_sub_path = subscriber.subscription_path(PROJECT_ID, PUBSUB_OUTBOUND_SUB)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.post("/webhook")
async def telegram_webhook(request: Request):
    """
    Recibe actualizaciones de Telegram y las normaliza a CHANNEL_INBOUND_MESSAGE.
    """
    try:
        data = await request.json()
        
        # Validar si es un mensaje de texto básico v3.1
        if "message" in data and "text" in data["message"]:
            user_id = str(data["message"]["from"]["id"])
            text = data["message"]["text"]
            message_id = str(data["message"]["message_id"])
            
            # Normalizar a CHANNEL_INBOUND_MESSAGE
            inbound_message = {
                "message_id": message_id,
                "participant_id": user_id, 
                "channel": "telegram",
                "text": text,
                "modality": "text",
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
            # Publicar en Pub/Sub
            payload_bytes = json.dumps(inbound_message).encode("utf-8")
            future = publisher.publish(topic_path, payload_bytes)
            future.result() # Wait for publish to succeed
            
            logger.info(f"Published msg from {user_id} to Pub/Sub: {message_id}")
            return {"status": "ok"}
            
        return {"status": "ignored", "reason": "not a text message"}

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "channel-layer"}

def process_outbound_msg(message):
    try:
        packet = json.loads(message.data.decode("utf-8"))
        participant_id = packet.get("participant_id")
        text = packet.get("text")
        
        if TELEGRAM_BOT_TOKEN and participant_id:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {"chat_id": participant_id, "text": text}
            response = requests.post(url, json=payload)
            response.raise_for_status()
            logger.info(f"Sent reply to Telegram chat {participant_id}")
        else:
            logger.warning(f"No TELEGRAM_BOT_TOKEN set, or no participant_id. Mock sent: {text}")
            
        message.ack()
    except Exception as e:
        logger.error(f"Error processing outbound message to Telegram: {e}")
        message.nack()

@app.on_event("startup")
def startup_event():
    # Start the subscriber. It runs on a background thread pool automatically.
    logger.info(f"Starting Pub/Sub subscriber on {outbound_sub_path}")
    subscriber.subscribe(outbound_sub_path, callback=process_outbound_msg)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
