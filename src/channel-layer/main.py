from fastapi import FastAPI, Request, HTTPException
from google.cloud import pubsub_v1
import os
import json
import logging
from datetime import datetime

# Configuración
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "my-gcp-project")
PUBSUB_TOPIC = os.getenv("PUBSUB_INBOUND_TOPIC", "iap.channel.inbound")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

app = FastAPI(title="DigiKawsay Channel Layer")
publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, PUBSUB_TOPIC)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
