import os
import json
import logging
import uuid
from concurrent.futures import TimeoutError
from google.cloud import pubsub_v1
from datetime import datetime

# Configuración
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "my-gcp-project")
SUBSCRIPTION_NAME = os.getenv("PUBSUB_AG05_INBOUND_SUB", "ag05-swarm-sub")
INBOUND_TOPIC = os.getenv("PUBSUB_SWARM_INBOUND_TOPIC", "iap.swarm.ag05") 
OUTBOUND_TOPIC = os.getenv("PUBSUB_SWARM_OUTPUT_TOPIC", "iap.swarm.output")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AG-05-Methodologist")

subscriber = pubsub_v1.SubscriberClient()
subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_NAME)
publisher = pubsub_v1.PublisherClient()

def insight_reducer(agent_output: dict):
    """
    Simula la reducción de insights y publica a la salida del enjambre.
    """
    logger.info(f"Insight Reducer: Procesando output '{agent_output.get('agent_id')}'")
    logger.info(f"REPORTE CUALITATIVO: {agent_output.get('payload')}")
    
    # Publicar a 'iap.swarm.output'
    try:
        publisher.publish(
            publisher.topic_path(PROJECT_ID, OUTBOUND_TOPIC),
            json.dumps(agent_output).encode("utf-8")
        )
        logger.info(f"Insight publicado en {OUTBOUND_TOPIC}")
    except Exception as e:
        logger.error(f"Fallo publicando insight: {e}")

def process_task_envelope(message: pubsub_v1.subscriber.message.Message):
    """
    Simula el procesamiento de un Task Envelope del Participant.
    """
    try:
        packet = json.loads(message.data.decode("utf-8"))
        participant_id = packet.get("participant_id")
        text = packet.get("clean_text", packet.get("original_text", ""))
        
        logger.info(f"AG-05 evaluando mensaje de {participant_id}")
        
        # Lógica heurística mock: buscamos palabras clave metodológicas
        keywords = ["nosotros", "juntos", "comunidad", "acuerdo"]
        if any(kw in text.lower() for kw in keywords):
            observation = "Patrón colectivo detectado. Fuerte sentido de 'nosotros'."
        else:
            observation = "Declaración individual. Requiere explorar conexión comunitaria."
            
        # Agent Output en formato estándar
        agent_output = {
            "output_id": str(uuid.uuid4()),
            "task_id": packet.get("message_id", "unknown_task"),
            "agent_id": "AG-05",
            "type": "OBSERVATION",
            "payload": {"insight": observation, "confidence": 0.85},
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        # Enviar al Insight Reducer
        insight_reducer(agent_output)
        
        message.ack()
        
    except Exception as e:
        logger.error(f"AG-05 fallo en procesamiento de envelope: {e}")
        message.nack()

def main():
    logger.info(f"AG-05 activo en sub: {subscription_path}")
    streaming_pull_future = subscriber.subscribe(subscription_path, callback=process_task_envelope)
    
    with subscriber:
        try:
            streaming_pull_future.result()
        except TimeoutError:
            streaming_pull_future.cancel()
            streaming_pull_future.result()
        except Exception as e:
            logger.error(f"AG-05 Subscriber failed: {e}")
            streaming_pull_future.cancel()

if __name__ == "__main__":
    main()
