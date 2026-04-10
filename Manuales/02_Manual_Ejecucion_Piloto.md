# Manual de Ejecución de Pilotos DigiKawsay (Cloudflare Version)

Este manual guía al encargado del proyecto o líder de innovación en el proceso paso a paso de ejecutar un piloto controlado utilizando DigiKawsay `v3` sobre la plataforma Cloudflare Serverless.

## Fase 1: Pre-requisitos y Configuración Inicial

Todo el despliegue es ahora nativo en la nube, por lo que **ya no necesitas instalar Docker ni túneles Ngrok**; sin embargo, requieres tener acceso a la Consola para compilar y empujar el worker, y generar herramientas secretas.

1. Abre tu terminal ubicándote en la carpeta `src/worker-digikawsay`.
2. Opcionalmente, inicia sesión en la infraestructura mundial:
   ```bash
   npx wrangler login
   ```
3. Asegura la correcta inyección de llaves seguras (Secretos) necesarias para la supervivencia del ambiente:
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   ```
   *(Importante: Pega el valor proporcionado generosamente por las plataformas BotFather/Google).*

## Fase 2: Lanzamiento del Servidor al Borde de la Red (Edge)

1. Sube tu aplicación nativa e inicia la máquina mundial escribiendo un simple comando:
   ```bash
   npm run deploy
   ```
2. Al terminar la compilación en milisegundos, notarás que te entrega una URL propia de la red global de Cloudflare terminada en `workers.dev`.
   - *Ejemplo: `https://worker-digikawsay.camilo-carvajalino.workers.dev`*
3. **El Asistente Webhook:** Abre ese enlace en tu navegador adhiriéndole el comando `/admin/setup_telegram`. Allí observarás un panel de interfaz HTML seguro; pulsa un botón para forzar que el Bot de Telegram envíe todo su influjo directamente a ese túnel encriptado permanentemente.

## Fase 3: Configuración del Proyecto y Adición de Participantes

Los endpoints REST de administración de la base de datos distribuida `D1` sustituyen al Control Panel interactivo en esta iteración MVP en las nubes. 

1. **Crear Nuevo Piloto:** Envía una solicitud por consola JSON hacia `/admin/create_project` estableciendo la *Pregunta Provocadora (Seed Prompt)*. 
   - *Ejemplo: "¿Cómo sienten que fluye la información cuando un requerimiento entra de urgencia?"*
2. **Distribución y Cierre:** Con el token generado que el endpoint te retorne, distribuye enlaces únicos (`https://t.me/TuBot?start=ABCD123`) a tus personas de interés a través de Slack, correo o WhatsApp. Esto permite un control hermético y anónimo de los diálogos cualitativos.

## Fase 4: Monitoreo Activo (Fase de Vida)

Mientras los participantes interactúan asíncronamente con el chatbot, el líder del piloto debe monitorear el flujo global. A diferencia de las iteraciones anteriores con emuladores locales paralelos, cualquier mensaje es captado casi intercontinentalmente antes de invocar la red geminiana `@langchain/google-genai`.

- **El Facilitador Activo:** Dile a tu investigador cualitativo que use el protocolo REST de "Wizard of Oz" disparándole peticiones con `urgency` al nuevo `/admin/inject_directive`. Esas directivas las leerá la Memoria Corta SQLite del Agente. Revisa el *[Manual del Facilitador](03_Manual_Facilitador.md)*.

## Fase 5: Cierre y Recolección de Frutos

Cuando pase el tiempo estipulado (o se note saturación teórica), puedes recurrir a exportar directamente de la tabla central de la base de datos D1 del sistema o conectarlo al PowerBI de administración central vía Queries asíncronos. 

---
*Fin del Manual de Ejecución Serverless.*
