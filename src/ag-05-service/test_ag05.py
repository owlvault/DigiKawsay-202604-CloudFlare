import os
import json
from google.cloud import pubsub_v1

# Configure emulator if running locally
os.environ["PUBSUB_EMULATOR_HOST"] = "localhost:8085"

PROJECT_ID = "digikawsay"
TOPIC_NAME = "iap.swarm.ag05"

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_NAME)

packet = {
    "message_id": "test_msg_123",
    "participant_id": "P_TEST_FALS_BORDA",
    "clean_text": "Siento que acá todo es muy vertical, el jefe dice A y hacemos A, no hay espacio para proponer nada y todo se llena en excel a mano fuera del sistema oficial.",
    "emotion": "Frustración",
    "topics": ["Act: Queja"]
}

print(f"Publishing mock packet to {topic_path}...")
try:
    future = publisher.publish(topic_path, json.dumps(packet).encode("utf-8"))
    msg_id = future.result()
    print(f"✅ Published message ID: {msg_id}")
    print("Revisa los logs del contenedor o terminal de AG-05 para verificar el output del formato Fals Borda.")
except Exception as e:
    print(f"❌ Failed to publish: {e}")
