# Manual de Ejecución de Pilotos DigiKawsay (Híbrido / Dockerized v4.0)

Este manual te guiará exhaustivamente para estructurar operativamente el despliegue de una instancia del sistema DigiKawsay. Atrás quedó el modelo puramente Serverless; a partir de la v4.0 la base operativa fundamental recae en levantar un clúster contenedor local asíncrono con `docker-compose`.

## Fase 1: Pre-requisitos Organizacionales y Entorno

1. Descarga el clon íntegro del repositorio a la máquina base.
2. Debes tener obligatoriamente **Docker Desktop** (o Docker Engine con plugin compose) instalados en el sistema organizativo o nube.
3. Dentro de la raíz del directorio, asegura la supervivencia del ecosistema configurando el archivo maestro `.env` con las variables núcleo:

```env
GEMINI_API_KEY=AIzaSy...
TELEGRAM_BOT_TOKEN=12345:AA...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/digikawsay
WEAVIATE_URL=http://localhost:8080
GCP_PROJECT_ID=digikawsay
GEMINI_MODEL=gemini-2.5-flash
```

## Fase 2: Construcción y Orquestación Backend (Local/Nube Contenerizada)

1. **Levantar de la Inercia DB y Bus de Mensajes:** 
   El sistema está apoyado transversalmente en bases de datos pesadas (Weaviate/PostgreSQL) y el Emulador GCP de Pub/Sub. Despiértalos en fondo primero:
   ```bash
   docker-compose up -d
   ```
2. **Migración de Estructuras (Schema SQL):** 
   Recuerda que todas las migraciones subyacentes ya están automatizadas o se empujarán vía scripts al arrancar `agente00`. Todo cambio orgánico al *schema* vivirá transitoriamente en `infra/migrations/`.
3. Para monitorear visualmente que el stack resucitó adecuadamente, puedes verificar los logs del componente microservicio central que orquesta el control:
   ```bash
   docker-compose logs -f agente00-service
   ```

## Fase 3: Creación de la Entidad Piloto 

El control y panel general reside atado al servicio **Agente-00**, visible convencionalmente en el puerto RestAPI **8002**. 

1. Ve a tu navegador corporativo e ingresa a `http://localhost:8002/admin/setup_wizard.html` o la estructura análoga indexada en el backend `SPA`.
2. **Definir la Semilla (Seed Prompt):** Desde el Endpoint Administrativo, puedes hacer un HTTP POST para inicializar el proyecto UUID formal. Establece la pregunta rompehielos inaugural:
   *Ejemplo de Semilla:* "¿Cuál sienten que es el nudo administrativo invisible que más traba nuestras entregas?"
3. Obtendrás como contrapartida en sistema un `project_id` encriptado.

## Fase 4: Enrutamiento Mundial (El Efecto Webhook)

A diferencia del primitivo esquema Polling, el canal asume una carga escalable alta dictando a Telegram que retransmita forzosamente cada interacción del empleado corporativo de frente a nuestro clúster local/nube.
1. Utiliza **Ngrok** (o Cloudflare Tunnels alternativo) si tu entorno Docker reside detrás de NATs locales o firewalls. 
   ```bash
   ngrok http 8080
   ```
2. Captura la URL HTTPS expuesta por Ngrok, dirígete vía terminal u otro software HTTP Request (como Postman) al protocolo de Telegram:
   ```text
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://[URL_NGROK]/webhook
   ```
*Nota: Este comando redireccionará limpiamente la carga hasta el microservicio `channel-layer` de DigiKawsay.*

## Fase 5: Distribución de Links Gatekeeper

Utilizando el `project_id` recientemente acuñado, distribuye de forma hermética el eslabón de Telegram hacia los departamentos orgánicos pertinentes a través de un simple mensaje interno por canales corporativos.

*Formato de enlace:*
`https://t.me/DigiKawsayBot?start=[PROJECT_ID_AQUI]` 

## Fase 6: Cierre Estacional (Sunset del Piloto)

Las bases relacionales como PostgreSQL retendrán impecablemente la integridad histórica. Al considerar saturación teórica sobre tu Semilla, el panel de `Agente-00` facilitará la bajada de logs y tablas analíticas estructuradas, junto con la radiografía emergente producida por el subsistema Metodólogo `AG-05` (Insights de Opuestos, Matrices Swarm y Data Gaps).
