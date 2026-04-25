# Manual de Ejecución de Pilotos DigiKawsay (v4.1 — Cloudflare Serverless)

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
git checkout Autenticacion-Implementada
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

```bash
npx wrangler d1 execute digikawsay-d1 --remote --file=../../schema.sql
```

> Si el schema ya fue aplicado previamente, este comando puede arrojar errores de "table already exists" en algunas tablas. Es seguro ignorarlos.

### 1.4 Configurar secretos en Cloudflare

```bash
npx wrangler secret put GEMINI_API_KEY
# (pega tu API key cuando lo pida)

npx wrangler secret put TELEGRAM_BOT_TOKEN
# (pega el token del bot de Telegram)

npx wrangler secret put COOKIE_SECRET
# (genera una cadena aleatoria larga, ej: openssl rand -hex 32)
```

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

### 2.1 Crear el primer administrador

Abre en el navegador: `https://TU_WORKER.workers.dev/admin/setup`

> Esta pantalla solo está disponible cuando no existe ningún administrador en la base de datos. Después de crear el primero, la ruta queda deshabilitada.

Completa el formulario con tu nombre de usuario y contraseña. Al enviar, el sistema crea el registro en la tabla `administrators` con el hash SHA-256 de tu contraseña.

### 2.2 Iniciar sesión

Ve a `/admin/login` e ingresa tus credenciales. El sistema crea una sesión con cookie firmada válida por 7 días.

### 2.3 Configurar el webhook de Telegram

Desde el **Panel Lobby** (`/admin/lobby`), haz clic en **"Registrar Webhook"**. El sistema envía automáticamente la URL del worker a la API de Telegram:

```
POST https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://TU_WORKER/webhook
```

Debes ver confirmación: `{"ok": true, "result": true}`.

---

## Fase 3: Creación del proyecto piloto

### 3.1 Crear el proyecto

Desde el **Panel Lobby** o vía API:

**Opción A — Panel web:**
En el formulario del Lobby, completa:
- **Nombre del proyecto:** Ej. "Diagnóstico Q2 — Equipo de Logística"
- **Seed Prompt (semilla):** La pregunta inicial que enmarca la exploración de VAL. Ej.:
  > *"Explora cómo el equipo toma decisiones en el día a día, qué herramientas usa realmente (no las que debería usar) y dónde siente que el trabajo fluye bien o se atasca."*

**Opción B — API JSON:**
```powershell
Invoke-RestMethod -Uri "https://TU_WORKER/admin/create_project" -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Diagnóstico Q2","seed_prompt":"Explora cómo el equipo toma decisiones..."}'
```
El sistema retorna un `project_id` (UUID) que necesitarás en los pasos siguientes.

### 3.2 Registrar participantes

Desde el **Dashboard** (`/admin/dashboard`) o vía API:

**Opción A — Panel web (múltiples a la vez):**
Escribe un nombre por línea en el formulario de registro masivo.

**Opción B — API:**
```powershell
Invoke-RestMethod -Uri "https://TU_WORKER/admin/register_participant" -Method POST `
  -ContentType "application/json" `
  -Body '{"project_id":"TU_PROJECT_ID","display_name":"Ana López"}'
```
El sistema asigna un `invite_token` único de 8 caracteres a cada participante. El `participant_id` queda como `pending_<token>` hasta que el participante use el link.

---

## Fase 4: Distribución de invitaciones

Cada participante recibe un link personalizado con su token:

```
https://t.me/TU_BOT?start=TOKEN8CHARS
```

El token es visible en el Dashboard junto al nombre del participante. Distribuye los links por el canal interno que elijas (email, Slack, Teams). El link lleva directamente al bot de Telegram e inicia la sesión con el token correcto.

**Flujo del participante:**
1. Abre el link → abre Telegram con el bot
2. Telegram envía `/start TOKEN` automáticamente
3. VAL responde con el mensaje de bienvenida y consentimiento
4. El primer mensaje del participante activa el consentimiento implícito y comienza la conversación

---

## Fase 5: Monitoreo durante el piloto

### Panel Dashboard
`/admin/dashboard` — Vista de todos los participantes con:
- Estado (invited / active / completed)
- Número de turnos
- Último registro emocional
- Fecha de último mensaje

### Consola WoZ
`/admin/woz` — Vista en tiempo real de las conversaciones activas. Permite seleccionar un participante y ver el chat con burbujas (usuario / VAL) actualizadas cada 3 segundos.

### Panel de analítica
`/admin/analytics` — KPIs del proyecto: distribución emocional, distribución de praxis, saberes tácitos detectados, estructuras opresivas, profundidad por participante.

---

## Fase 6: Cierre del piloto

Cuando la conversación alcanza saturación temática (el equipo de investigación determina que no emergen nuevos temas), el cierre consiste en:

1. **Exportar el corpus:** Cada conversación disponible en `/admin/conversation/:participant_id`
2. **Exportar analítica final:** `/admin/analytics/:project_id` en JSON
3. **Marcar proyecto como cerrado:** Actualizar el estado del proyecto en D1 si aplica
4. **Presentación de hallazgos:** Los datos de analítica sirven como base empírica para el informe cualitativo

> En versiones futuras, el sistema generará automáticamente un Plan de Movilización JSON con OKRs y redes de compromiso. Actualmente este paso es manual por parte del equipo investigador.

---

## Comandos de referencia rápida

```bash
# Redesplegar worker tras cambios de código
npm run deploy

# Ver logs del worker en tiempo real
npx wrangler tail

# Ejecutar query en D1 (diagnóstico)
npx wrangler d1 execute digikawsay-d1 --remote --command "SELECT COUNT(*) FROM dialogue_turns"

# Ejecutar en modo desarrollo local (sin Telegram real)
npm run dev
```
