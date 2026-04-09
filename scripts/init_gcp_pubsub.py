import os
import time
from google.cloud import pubsub_v1

# Script para inicializar de forma idempotente los tópicos y suscripciones de Pub/Sub
# en un entorno real de Google Cloud Platform. 
# Verifica que GOOGLE_APPLICATION_CREDENTIALS y GCP_PROJECT_ID estén declarados.

if os.getenv("PUBSUB_EMULATOR_HOST"):
    print("WARNING: Variable PUBSUB_EMULATOR_HOST detectada. Este script operará contra el emulador local.")
    print("Si deseas utilizar la nube real de HCP, ejecuta: unset PUBSUB_EMULATOR_HOST")
    time.sleep(3)

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "digikawsay")

topics = [
    "iap.dead.letter",
    "iap.seed.input",
    "iap.channel.inbound",
    "iap.channel.outbound",
    "iap.val.packet",
    "iap.val.to.ag00",
    "iap.orchestrator.directive",
    "iap.alerts.safe_harbor",
    "iap.swarm.ag05",
    "iap.swarm.output"
]
subs = {
    "iap.channel.inbound": "preprocessor-inbound-sub",
    "iap.val.packet": "val-packet-sub",
    "iap.orchestrator.directive": "val-directive-sub",
    "iap.val.to.ag00": "ag00-val-packet-sub",
    "iap.channel.outbound": "channel-outbound-sub",
    "iap.swarm.ag05": "ag05-swarm-sub",
    "iap.swarm.output": "ag00-swarm-output-sub"
}

print(f"Inicializando infraestructura en proyecto GCP: {PROJECT_ID}...")

# Initialize clients using automatic credentials discovery (or explicitly mapped ones)
try:
    publisher = pubsub_v1.PublisherClient()
    subscriber = pubsub_v1.SubscriberClient()
except Exception as e:
    print(f"ERROR Fatal al obtener credenciales de GCP: {e}")
    print("Asegúrate de haber configurado GOOGLE_APPLICATION_CREDENTIALS o has hecho 'gcloud auth application-default login'")
    exit(1)

for t in topics:
    path = publisher.topic_path(PROJECT_ID, t)
    try:
        publisher.create_topic(request={"name": path})
        print(f" - Topic creado: {t}")
    except Exception as e:
        if "AlreadyExists" in str(e):
            print(f" - Topic ya existía: {t}")
        else:
            print(f" ! Error creando topic {t}: {e}")

for t, s in subs.items():
    t_path = publisher.topic_path(PROJECT_ID, t)
    s_path = subscriber.subscription_path(PROJECT_ID, s)
    try:
        subscriber.create_subscription(request={"name": s_path, "topic": t_path})
        print(f" - Subscription creada: {s}")
    except Exception as e:
        if "AlreadyExists" in str(e):
            print(f" - Subscription ya existía: {s}")
        else:
            print(f" ! Error creando subscription {s}: {e}")

print("=============================")
print("Inicialización Completada.")
