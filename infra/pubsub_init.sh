#!/bin/bash
# Script para inicializar Google Cloud Pub/Sub topics y subscriptions del MVP
# Ejecutar con: bash pubsub_init.sh [PROJECT_ID]

PROJECT_ID=${1:-$GOOGLE_CLOUD_PROJECT}

if [ -z "$PROJECT_ID" ]; then
    echo "Debe especificar el PROJECT_ID de Google Cloud"
    exit 1
fi

echo "Inicializando Pub/Sub para el proyecto: $PROJECT_ID"

# 1. Crear el topic de Dead Letter (Fundamental para V3.1)
gcloud pubsub topics create iap.dead.letter --project="$PROJECT_ID" || true

# 2. Crear Topics Core (MVP)
TOPICS=(
    "iap.seed.input"
    "iap.channel.inbound"
    "iap.channel.outbound"
    "iap.val.packet"
    "iap.val.to.ag00"
    "iap.orchestrator.directive"
    "iap.alerts.safe_harbor"
)

for topic in "${TOPICS[@]}"; do
    echo "Creando topic: $topic"
    gcloud pubsub topics create "$topic" --project="$PROJECT_ID" || true
done

# 3. Crear Subscriptions (con retry y dead letter configuration)
echo "Configurando suscripción preprocessor-inbound-sub..."
gcloud pubsub subscriptions create preprocessor-inbound-sub \
    --topic=iap.channel.inbound \
    --ack-deadline=120 \
    --min-retry-delay=10s \
    --max-retry-delay=600s \
    --dead-letter-topic=iap.dead.letter \
    --max-delivery-attempts=5 \
    --project="$PROJECT_ID" || true

echo "Configurando suscripción val-packet-sub..."
gcloud pubsub subscriptions create val-packet-sub \
    --topic=iap.val.packet \
    --ack-deadline=130 \
    --min-retry-delay=5s \
    --max-retry-delay=300s \
    --dead-letter-topic=iap.dead.letter \
    --max-delivery-attempts=3 \
    --project="$PROJECT_ID" || true

echo "Configurando suscripción val-directive-sub (sin dead letter, con expiration corta)..."
gcloud pubsub subscriptions create val-directive-sub \
    --topic=iap.orchestrator.directive \
    --ack-deadline=30 \
    --message-retention-duration=1h \
    --project="$PROJECT_ID" || true

echo "Configurando suscripción ag00-val-packet-sub..."
gcloud pubsub subscriptions create ag00-val-packet-sub \
    --topic=iap.val.to.ag00 \
    --ack-deadline=300 \
    --min-retry-delay=15s \
    --max-retry-delay=900s \
    --dead-letter-topic=iap.dead.letter \
    --max-delivery-attempts=5 \
    --project="$PROJECT_ID" || true

echo "Configurando suscripción channel-outbound-sub..."
gcloud pubsub subscriptions create channel-outbound-sub \
    --topic=iap.channel.outbound \
    --ack-deadline=30 \
    --min-retry-delay=2s \
    --max-retry-delay=30s \
    --project="$PROJECT_ID" || true

echo "Configurando suscripción ag05-inbound-sub..."
gcloud pubsub subscriptions create ag05-inbound-sub \
    --topic=iap.val.packet \
    --ack-deadline=60 \
    --project="$PROJECT_ID" || true

echo "¡Pub/Sub inicializado correctamente! (Se ha omitido el enjambre de AG-01 a AG-09 para el MVP)"
