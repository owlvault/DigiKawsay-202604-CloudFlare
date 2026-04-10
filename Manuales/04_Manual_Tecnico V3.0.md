# DigiKawsay: Manual Técnico y de Arquitectura (v3)

## 1. Arquitectura del Sistema (Edge Native)

DigiKawsay en su iteración v3 ha sido reconvertido de su sistema inicial de Clúster de Microservicios asíncronos distribuidos en Python (FastAPI/LangChain/Docker) a una arquitectura **unificada y sin fricción de la nube diseñada para Cloudflare Workers**. 

Al operar directamente en los nodos Edge a nivel mundial, se reduce la latencia inter-componente a cero, y el tiempo de facturación local se extingue. Funciona sin contenedores ni simuladores de bus de mensajes de terceros.

### Componentes de Infraestructura Actual
- **Cloudflare D1 (SQLite Serverless):** Persistencia primaria. Almacena las configuraciones de proyectos, registros de código único de participantes, estados de invitaciones transaccionales y directivas de los administradores. Está distribuida, lo cual destruye la necesidad de clústeres rígidos de bases de datos como PostgreSQL.
- **Hono.js:** El motor de enrutamiento rápido compatible universal. Sirve como la columna vertebral HTTP, interceptando el webhook de Telegram, gestionando endpoints de administración interna y proveyendo un asistente embebido (`/admin/setup_telegram`).
- **LangChain.js / Google GenAI SDK:** Base cognitiva oficial alojada ahora en Javascript/TypeScript en `src/agent.ts`.

### Lógica Transaccional (Worker-App)
1. **El Handler de Webhook (`index.ts` / `/webhook`);** La puerta fronteriza estricta. Reemplaza el rol de aquel extinto `Channel-Layer` escrito en Python. Recupera la ID de Telegram (`chat_id`) e intercala en un subproceso V8 la función asincrónica principal de cognición mediante la tecnología estelar `ctx.waitUntil(...)`.
2. **VAL-Router (LangGraph / `agent.ts`);** Reemplaza a las máquinas pseudo-autónomas y a RabbitMQ/PubSub. Lee inmediatamente el Prompt Sistémico que empuja la empatía social de la interacción ("Eres VAL, vanguardia del facilitador...") conectando bidireccionalmente el entorno Serverless hacia el cerebro remoto de `gemini-2.5-flash` pasándole la llave almacenada cifrada inmutablemente como secreto local. 
3. **Cierre de Ciclo en Webhook:** Retransmite instantánea y síncronamente el resultado del LLM usando la API oficial `/sendMessage` de Telegram logrando contestarle a la comunidad desde la otra esquina del globo en su red local sin servidores en el intermedio.
4. **Agente-00 (Management API):** Los scripts subyacentes REST a lo largo del `index.ts` (como `/admin/create_project` y `/admin/inject_directive`) emulan por API un eventual "Wizard of Oz". De momento son programables y directos a D1, quitando sobrecarga de frontend embebidos.

## 2. Medio Ambiente y Secretos de Wrangler

El proyecto moderno omite radicalmente los archivos paralelos `.env` para producción. La nube confía rigurosamente en inyección remota y encriptada por parte del desarrollador (`wrangler secret put`):
```text
TELEGRAM_BOT_TOKEN
GEMINI_API_KEY
```
Estas variables estarán disponibles siempre mágicamente dentro del Contexto universal de un worker de Cloudflare HTTP Request sobreescribiendo el sistema de tipado subyacente. La declaración superficial se alberga en `wrangler.jsonc` excluyendo estas confidenciales.

## 3. Despliegue en Producción

El modelo en Node.js hace obsoleto la virtualización por PowerShell (`launch_pilot.ps1`).  
Teniendo instalado NodeJS base:
1. Navega a `src/worker-digikawsay`
2. Solicita la transpilación total e inyección global de Cloudflare:
   ```bash
   npm run deploy
   ```
El ecosistema completo nace y muere interactuando orgánicamente cada que una solicitud golpea las URL públicas de `.workers.dev`.
