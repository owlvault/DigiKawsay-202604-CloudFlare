import os
import json
import logging
import time
from concurrent.futures import TimeoutError
from google.cloud import pubsub_v1

# Configuración
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "my-gcp-project")
SUBSCRIPTION_NAME = os.getenv("PUBSUB_INBOUND_SUBSCRIPTION", "preprocessor-inbound-sub")
OUTBOUND_TOPIC = os.getenv("PUBSUB_PACKET_TOPIC", "iap.val.packet")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

subscriber = pubsub_v1.SubscriberClient()
subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_NAME)

publisher = pubsub_v1.PublisherClient()
outbound_topic_path = publisher.topic_path(PROJECT_ID, OUTBOUND_TOPIC)

def anonymize_text(text: str) -> str:
    """
    Rutina de anonimización mock para el MVP.
    En un entorno real usaríamos Modelos NER / Regex.
    """
    # TODO: Implementar reemplazo de PII por tokens
    return text

def embed_text(text: str) -> list[float]:
    """
    Rutin de embeddings mock para el MVP.
    En entorno real: usar Vertex AI text-embedding-004.
    """
    # Mapear a llamada a Vertex AI (simulado aquí)
    return [0.0] * 768

def process_message(message: pubsub_v1.subscriber.message.Message):
    """
    Callback para cuando se recibe un mensaje desde Telegram (via channel-layer)
    """
    try:
        payload = json.loads(message.data.decode("utf-8"))
        logger.info(f"Procesando mensaje de: {payload.get('participant_id')}")
        
        # 1. Anonimización
        texto_limpio = anonymize_text(payload.get("text", ""))
        
        # 2. Vectorización (simulada)
        vector = embed_text(texto_limpio)
        
        # 3. Guardado en Weaviate (simulado / stub)
        chunk_id = f"chunk_{payload.get('message_id')}"
        logger.info(f"Guardado en Weaviate con ID: {chunk_id}")
        
        # 4. Construir DIALOGUE_PACKET final
        dialogue_packet = {
            "participant_id": payload.get("participant_id"),
            "session_id": "session_mvp_1",
            "message_id": payload.get("message_id"),
            "original_text": payload.get("text"), # VAL necesita el texto original para responder inteligentemente
            "clean_text": texto_limpio,
            "chunk_id": chunk_id,
            "timestamp": payload.get("timestamp")
        }
        
        # 5. Publicar a iap.val.packet
        out_payload_bytes = json.dumps(dialogue_packet).encode("utf-8")
        future = publisher.publish(outbound_topic_path, out_payload_bytes)
        future.result()
        
        # Acknowledge the message so it's not delivered again
        message.ack()
        logger.info(f"Mensaje procesado y ACKed: {message.message_id}")

    except Exception as e:
        logger.error(f"Error processing message {message.message_id}: {e}")
        # NACK the message to trigger retry policy 
        message.nack()

def main():
    logger.info(f"Escuchando en suscripción: {subscription_path}")
    streaming_pull_future = subscriber.subscribe(subscription_path, callback=process_message)
    
    with subscriber:
        try:
            # Block the main thread
            streaming_pull_future.result()
        except TimeoutError:
            streaming_pull_future.cancel()
            streaming_pull_future.result()
        except Exception as e:
            logger.error(f"Subscriber failed: {e}")
            streaming_pull_future.cancel()

if __name__ == "__main__":
    main()
