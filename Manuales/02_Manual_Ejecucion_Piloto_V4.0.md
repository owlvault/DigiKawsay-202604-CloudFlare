# Manual de Ejecución de Pilotos DigiKawsay (v4.2 — Cloudflare Serverless)

Este manual cubre el proceso completo para lanzar un piloto diagnóstico: desde el despliegue del worker hasta la distribución de links a participantes y el cierre del ciclo.

> El sistema corre sobre **Cloudflare Workers + D1**. No requiere Docker, Docker Compose, servidores locales ni infraestructura propia.

---

## Pre-requisitos

| Requisito | Descripción |
|---|---|
| Cuenta Cloudflare | Con Workers y D1 habilitados (plan gratuito es suficiente para pilotos < 100k requests/día) |
| Node.js ≥ 18 | Para ejecutar Wrangler localmente |
| Wrangler CLI | `npm install -g wrangler` y `wrangler login` |
| Bot de Telegram | Crear un bot con [@BotFather](https://t.me/BotFather), obtener el token |
| API Key de Gemini | Desde [Google AI Studio](https://aistudio.google.com/), modelo `gemini-2.5-flash` |

---

## Fase 1: Despliegue inicial del worker

### 1.1 Clonar el repositorio y posicionarse en el branch de producción

```bash
git clone https://github.com/owlvault/DigiKawsay-202604-CloudFlare.git
cd DigiKawsay-202604-CloudFlare
git checkout main
cd src/worker-digikawsay
npm install
```

### 1.2 Crear la base de datos D1

```bash
npx wrangler d1 create digikawsay-d1
```

Copia el `database_id` que devuelve el comando y colócalo en `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "digikawsay-d1",
      "database_id": "TU_DATABASE_ID_AQUI"
    }
  ]
}
```

### 1.3 Inicializar el schema de la base de datos

El schema completo incluye todas las tablas necesarias: proyectos, participantes, turnos, directivas WoZ, memoria narrativa, seguridad, billing y multi-tenant.

```bash
npx wrangler d1 execute digikawsay-d1 --remote --file=../../schema.sql
```

> Si el schema ya fue aplicado previamente, este comando puede arrojar errores de "table already exists" en algunas tablas. Es seguro ignorarlos.

### 1.4 Configurar secretos en Cloudflare

Los tres secretos obligatorios:

```bash
npx wrangler secret put GEMINI_API_KEY
# (pega tu API key cuando lo pida)

npx wrangler secret put TELEGRAM_BOT_TOKEN
# (pega el token del bot de Telegram)

npx wrangler secret put COOKIE_SECRET
# (genera una cadena aleatoria larga, ej: openssl rand -hex 32)
```

**Secreto opcional de seguridad (recomendado para producción):**

```bash
npx wrangler secret put WEBHOOK_SECRET
# (genera una cadena aleatoria, ej: openssl rand -hex 16)
```

Cuando `WEBHOOK_SECRET` está configurado, el worker verifica el header `X-Telegram-Bot-Api-Secret-Token` en cada webhook. Si un request llega sin el token correcto, es bloqueado y registrado como evento de seguridad. Al registrar el webhook (Fase 2.3), el sistema incluye automáticamente el secret en la URL de registro.

### 1.5 Desplegar

```bash
npm run deploy
```

Al finalizar, wrangler muestra la URL del worker:
```
Deployed worker-digikawsay triggers
  https://worker-digikawsay.TU_SUBDOMINIO.workers.dev
```

---

## Fase 2: Configuración inicial del panel admin

### 2.1 Crear el primer administrador (SUPERADMIN)

Abre en el navegador: `https://TU_WORKER.workers.dev/admin/setup`

> Esta pantalla solo está disponible cuando no existe ningún administrador en la base de datos. Después de crear el primero, la ruta queda deshabilitada.

Completa el formulario con tu nombre de usuario (sin espacios) y contraseña (mínimo 8 caracteres). Al enviar:
1. El sistema crea un tenant por defecto `digikawsay_global`
2. Crea el administrador con rol **SUPERADMIN** vinculado a ese tenant
3. El hash de la contraseña se genera con **PBKDF2** (100,000 iteraciones, salt aleatorio por contraseña)
4. Redirige al login

### 2.2 Iniciar sesión

Ve a `/admin/login` e ingresa tus credenciales. El sistema crea una sesión con cookie firmada:
- `HttpOnly: true` — inaccesible desde JavaScript
- `SameSite: Strict` — protección CSRF fuerte
- `Secure: true` — solo HTTPS
- Válida por 7 días

El sistema registra automáticamente los intentos fallidos de login. Después de **5 intentos fallidos en 15 minutos**, el acceso queda bloqueado temporalmente para ese nombre de usuario.

### 2.3 Configurar el webhook de Telegram

Desde el **Panel Lobby** (`/admin/lobby`), haz clic en **"Registrar Webhook"**. El sistema envía automáticamente la URL del worker a la API de Telegram:

```
POST https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://TU_WORKER/webhook
# Si WEBHOOK_SECRET está configurado, también incluye &secret_token=...
```

Debes ver confirmación: `{"ok": true, "result": true}`.

---

## Fase 3: Diseño del piloto con asistencia IA

### 3.0 Usar el asistente de diseño de piloto (recomendado)

Antes de crear el proyecto manualmente, puedes usar el asistente IA para generar el seed prompt y el mensaje de contextualización. Desde el **Panel Lobby**, ingresa una descripción del equipo y contexto:

```
POST /admin/api/design_pilot
Body: {"context": "Equipo de logística de 12 personas. Están implementando un nuevo ERP desde hace 6 meses. Hay resistencia al cambio y los coordinadores sienten que los procesos oficiales no reflejan cómo trabajan en el día a día."}
```

El sistema devuelve:
- **contextualizationMessage**: mensaje listo para enviar al equipo por WhatsApp o email antes de iniciar
- **seedPrompt**: pregunta semilla poderosa anclada en la realidad del equipo

### 3.1 Crear el proyecto

**Opción A — Panel web (Lobby):**
Completa el formulario con el nombre del proyecto y el seed prompt (puede ser el generado por el asistente IA).

**Opción B — API JSON:**
```powershell
Invoke-RestMethod -Uri "https://TU_WORKER/admin/create_project" -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Diagnóstico Q2","seed_prompt":"Explora cómo el equipo toma decisiones..."}'
```
El sistema retorna un `project_id` (UUID) que necesitarás en los pasos siguientes.

### 3.2 Registrar participantes

**Opción A — Panel web (Dashboard):**
Escribe un nombre por línea en el formulario de registro masivo.

**Opción B — API:**
```powershell
Invoke-RestMethod -Uri "https://TU_WORKER/admin/register_participant" -Method POST `
  -ContentType "application/json" `
  -Body '{"project_id":"TU_PROJECT_ID","display_name":"Ana López"}'
```
El sistema asigna un `invite_token` único de 8 caracteres a cada participante.

---

## Fase 4: Distribución de invitaciones

Cada participante recibe un link personalizado con su token:

```
https://t.me/TU_BOT?start=TOKEN8CHARS
```

El token es visible en el Dashboard junto al nombre del participante. Distribuye los links por el canal interno que elijas (email, Slack, Teams). El link lleva directamente al bot de Telegram e inicia la sesión con el token correcto.

> **Tip:** Antes de enviar los links, envía el **mensaje de contextualización** generado por el asistente IA. Explica brevemente el propósito del proceso, el anonimato y el valor de la participación genuina.

**Flujo del participante:**
1. Abre el link → abre Telegram con el bot
2. Telegram envía `/start TOKEN` automáticamente
3. VAL responde con el mensaje de bienvenida y consentimiento
4. El primer mensaje del participante activa el consentimiento implícito y comienza la conversación

> **Importante:** Cada token es de uso único por persona. Si alguien pierde su link, ve al Dashboard y busca su `invite_token` para regenerar el link. No compartas links entre participantes.

---

## Fase 5: Monitoreo durante el piloto

### Panel Dashboard
`/admin/dashboard` — Vista de todos los participantes con estado, número de turnos, último registro emocional y fecha de último mensaje.

### Consola WoZ
`/admin/woz` — Vista en tiempo real de las conversaciones activas. Permite:
- Ver el historial de cada participante con depth score por turno
- Ver la fase actual (INVESTIGACION/ACCION/PARTICIPACION/CLOSED) y su progreso
- Inyectar directivas humanas (Tipo "Inject") o enviar un push proactivo (Tipo "Push")
- Ver las directivas automáticas generadas por el AG-05 Co-piloto (badge `🤖`)

### Panel de analítica
`/admin/analytics` — KPIs del proyecto: distribución emocional, distribución de praxis, saberes tácitos detectados, estructuras opresivas, alertas automáticas y resumen ejecutivo generado automáticamente.

### Dashboard de seguridad (SUPERADMIN)
`/admin/security` — Eventos de seguridad de las últimas 24h: amenazas bloqueadas, intentos de prompt injection, participantes marcados, tipos de amenaza más frecuentes.

### Panel de Billing (SUPERADMIN)
`/admin/billing` — Consumo de tokens por tenant y por proyecto, control de cuotas, cutoff automático.

---

## Fase 6: Cierre del piloto

Cuando la conversación alcanza saturación temática (el equipo de investigación determina que no emergen nuevos temas), el cierre consiste en:

### 6.1 Generar el Informe de Síntesis

Descarga el informe Markdown generado por AG-05:
```
GET /admin/report/:project_id
```
El informe se descarga como archivo `.md` y cubre:
- **Calidad del Sentipensar:** profundidad de las conversaciones, evolución del rapport
- **Detección Sistémica:** saberes detectados, estructuras opresivas, nudos sistémicos
- **Oportunidades de Intervención:** directivas WoZ recomendadas para la próxima ronda

### 6.2 Exportar el corpus CSV

```
GET /admin/export/:project_id
```
Descarga todos los turnos con sus clasificaciones completas (registro emocional, praxis, saberes, estructuras, depth score, directiva aplicada, timestamp).

### 6.3 Exportar analítica JSON

```
GET /admin/analytics/:project_id
```
Estructura completa del análisis: distribuciones, top participantes, Shadow IT agregado, estructuras opresivas, alertas.

### 6.4 Cierre administrativo

Marcar el proyecto como cerrado en D1 si aplica:
```bash
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "UPDATE projects SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE project_id = 'TU_PROJECT_ID'"
```

---

## Comandos de referencia rápida

```bash
# Redesplegar worker tras cambios de código
npm run deploy

# Ver logs del worker en tiempo real
npx wrangler tail

# Ejecutar query en D1 (diagnóstico)
npx wrangler d1 execute digikawsay-d1 --remote --command "SELECT COUNT(*) FROM dialogue_turns"

# Verificar participantes activos de un proyecto
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "SELECT display_name, status, invite_token FROM participants WHERE project_id = 'TU_PROJECT_ID'"

# Ver eventos de seguridad recientes
npx wrangler d1 execute digikawsay-d1 --remote \
  --command "SELECT event_type, severity, action_taken, created_at FROM security_events ORDER BY created_at DESC LIMIT 20"

# Ejecutar en modo desarrollo local (sin Telegram real)
npm run dev
```

---

## Checklist de lanzamiento

Antes de distribuir los links a participantes, verifica:

- [ ] Worker desplegado y `/health` responde `{"status":"healthy"}`
- [ ] Webhook de Telegram registrado (confirmación `ok: true` en Lobby)
- [ ] `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN` y `COOKIE_SECRET` configurados como secrets
- [ ] `WEBHOOK_SECRET` configurado (recomendado para producción)
- [ ] Schema SQL ejecutado sin errores críticos
- [ ] Primer administrador SUPERADMIN creado
- [ ] Proyecto creado con seed prompt probado
- [ ] Participantes registrados con tokens visibles en Dashboard
- [ ] Prueba de extremo a extremo: envía tu propio link de invitación, inicia conversación con VAL, verifica que el turno aparece en WoZ y analítica
