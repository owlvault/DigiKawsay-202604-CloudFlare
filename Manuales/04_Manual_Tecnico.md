# DigiKawsay: Manual Técnico y de Arquitectura

## 1. Arquitectura del Sistema

DigiKawsay está construido sobre una arquitectura orientada a eventos (Event-Driven Architecture) basada en **microservicios Dockerizados** y comunicados de manera asíncrona mediante un bus de mensajes (Pub/Sub).

### Componentes de Infraestructura
- **PostgreSQL 15:** Persistencia primaria. Almacena las configuraciones de proyectos, registros de participantes, estados del diálogo de LangGraph (`dialogue_states`), turnos absolutos para análisis posterior (`dialogue_turns`) y directivas del facilitador (estado del WoZ).
- **Weaviate v4:** Base de datos vectorial. Implementa almacenamiento de todo fragmento de interacción procesado, convertido a un vector de dimensión 768d, usado por el Módulo "Espejo" usando búsquedas `nearVector` de similitud por coseño.
- **Google Cloud Pub/Sub Emulator:** Bus de mensajes. Desacopla los servicios permitiendo que si el "Cerebro" (VAL) colapsa por límites de cuota, el mensaje en Telegram no se pierda.

### Microservicios del Enjambre
1. **Channel-Layer (`:8001`):** Servidor FastAPI que recibe el Webhook de Telegram. Gestiona el "Gate de Acceso" (validación de tokens de invitación profunda `/start`), los flujos de consentimiento, previene la saturación reenviando solo mensajes habilitados al PubSub, e imprime las respuestas que emanan al usuario en UI.
2. **Preprocessor:** Lee de PubSub, realiza anonimización sintáctica básica de PII (RegEx para Correos, Cédulas, Celulares), usa el SDK de Google Gemini para obtener embeddings reales `text-embedding-004` del mensaje limpio, y empuja a Weaviate. Al tener éxito, inserta el `DIALOGUE_PACKET` formal en el bus.
3. **VAL-Service:** El corazón sentipensante. Implementado con LangGraph. Utiliza `PostgresSaver` para memoria conversacional. Invoca siempre por prompt herramientas nativas para documentar emoción y acto de habla. En el `main.py`, ejecuta la función iterativa central de "El Espejo" (importada de `espejo.py`) para enviar reflexiones convergentes/divergentes cada N turnos.
4. **Agente-00 (Supervisor):** Operando en (`:8002`), es el amo de calabozo. Sirve la UI estática del control panel WoZ. Expone >15 endpoints REST para crear proyectos, invitar participantes en batch, visualizar el chat cruzado, emitir reportes automatísticos, exportar CSVs y configurar los Webhooks automáticamente hacia el exterior (Ngrok).
5. **Agente-05 (Metodólogo):** Analiza subrepticiamente cada turno. Usa `gemini-2.5-flash` para leer un turno, la emoción y entregar un JSON estructurado detectando Shadow IT, dinámicas de poder horizontales/verticales, etc.

## 2. Dependencias y Medio Ambiente

El entorno requiere inyección en el `.env` raíz de:
```env
TELEGRAM_BOT_TOKEN="1234:AA..."
GEMINI_API_KEY="AIza..."
```
Todas las dependencias de Python están fijadas en un archivo `requirements.txt` por cada subdirectorio de microservicio, y construidas atómicamente por su propio `Dockerfile`.

## 3. Despliegue en Producción o Piloto

Para ejecutar el despliegue automático del Swarm:
```powershell
.\scripts\launch_pilot.ps1
```
Este script (en PowerShell):
1. Chequea que Docker exista y esté ejecutándose.
2. Carga variables de `.env`.
3. Ejecuta un `docker-compose up -d --build`.
4. Utiliza `Invoke-RestMethod` iterativos como "Spin-lock" hasta que el Healthcheck general HTTP devuelva estabilización.
5. Invoca un subproceso de Ngrok, secuestra su dirección HTTPS pública, y hace una petición final la api de Telegram para atar el Endpoint automáticamente.
