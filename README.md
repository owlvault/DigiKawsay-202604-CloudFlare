# Ejecución Local de DigiKawsay MVP (Fase 1)

Esta guía explica cómo levantar el entorno completo de desarrollo de DigiKawsay de forma local utilizando `docker-compose`. 

## Requisitos Previos

- **Docker** y **Docker Compose** instalados en tu máquina.
- Una **API Key de Gemini** activa en Google AI Studio (`GEMINI_API_KEY`).
- Un **Bot Token de Telegram** creado mediante BotFather (`TELEGRAM_BOT_TOKEN`).

## Arquitectura del Entorno Local

El archivo `docker-compose.yaml` levanta 7 contenedores para simular un ambiente Google Cloud:
1. `postgres`: Base de datos transaccional con tu schema inicial ya montado (`infra/db_init.sql`).
2. `weaviate`: Base de datos vectorial para los embeddings.
3. `pubsub-emulator`: El emulador oficial de Google Cloud Pub/Sub.
4. `pubsub-init`: Script efímero que crea todos los topics y subscripciones en el emulador en el arranque.
5. `channel-layer`: API de entrada de webhooks de Telegram (Puerto 8001).
6. `preprocessor`: Worker de Pub/Sub que procesa textos.
7. `val-service`: El motor LangGraph conversacional con su checkpointer hacia Postgres.
8. `agente00-service`: Orquestador que expone el endpoint HTTP para inyectar directivas manuales (Puerto 8002).

## Pasos para Inicializar

### 1. Variables de Entorno

Debes exportar las llaves sensibles en tu terminal antes de lanzar el compose:

**En Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="AIzaSyTu_Llave_De_Google_GenAI"
$env:TELEGRAM_BOT_TOKEN="1234567:Tu_Llave_BotFather"
```

**En Linux / Mac (Bash):**
```bash
export GEMINI_API_KEY="AIzaSyTu_Llave_De_Google_GenAI"
export TELEGRAM_BOT_TOKEN="1234567:Tu_Llave_BotFather"
```

### 2. Iniciar el Clúster

Posiciónate en la raíz del proyecto (`c:\Users\ccarvajalino\OneDrive\Proyectos\DigiKawsay`) y ejecuta:

```bash
docker-compose up --build
```

Esto descargará las imágenes y compilará al vuelo los microservicios usando `python:3.11-slim`. Espera unos segundos a que `pubsub-init` indique que "Pub/Sub inicializado correctamente!".

### 3. Exponer el Canal al Mundo (Ngrok)

Tu `channel-layer` corre localmente en el puerto `8001`. Para que Telegram pueda enviarle mensajes, necesitas exponer ese puerto a Internet.

Abre una nueva terminal e inicia Ngrok:
```bash
ngrok http 8001
```

Copia la URL `https` que te genere ngrok (ej. `https://1a2b-3c.ngrok.app`).

**Registrar el Webhook en Telegram:**
Haz un POST o navega en tu navegador reemplazando el token corto en la URL:
```text
https://api.telegram.org/bot<TU_TELEGRAM_BOT_TOKEN>/setWebhook?url=<URL_DE_NGROK>/webhook
```
Si todo es exitoso, Telegram te devolverá un `"ok": true`.

## Probando el Flujo Wizard of Oz

1. Entra a Telegram y escribe un mensaje a tu Bot. Deberías ver logs en la consola de Docker donde el `channel-layer` recibe el mensaje y lo encola, luego `preprocessor` lo toma y finalmente `val-service` (el LLM a través de LangChain) responde.
2. Para probar la inyección de **Shadowing** (Directivas Experto):
   Haz una petición POST al `agente00` (puerto 8002):
   ```bash
   curl -X POST http://localhost:8002/admin/inject_directive \
   -H "Content-Type: application/json" \
   -d '{"participant_id": "TU_ID_DE_TELEGRAM", "project_id": "uuid-ficticio", "cycle_id": 1, "content": "Pregúntale qué le preocupa realmente sobre el liderazgo de la empresa", "urgency": "HIGH"}'
   ```
   *Nota: Necesitas mirar los logs de la consola para extraer el `participant_id` numérico que te asigna Telegram en el webhook.*
