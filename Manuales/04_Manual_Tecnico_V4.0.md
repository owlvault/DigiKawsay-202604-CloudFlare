# DigiKawsay: Manual Técnico y de Arquitectura (v4.1 — Cloudflare Worker)

Este manual documenta la arquitectura real del sistema en producción: un **Cloudflare Worker** serverless construido con TypeScript, Hono.js y Cloudflare D1.

---

## 1. Arquitectura del sistema

```
Telegram Bot API
      │
      │ webhook POST /webhook
      ▼
┌─────────────────────────────────────────────────┐
│           Cloudflare Worker (Hono.js)           │
│                                                 │
│  index.tsx ──── router + middleware auth        │
│      │                                          │
│      ├── handleMessage() ─── agent.ts           │
│      │         │                                │
│      │    Promise.all()                         │
│      │    ├── VAL LLM (Gemini 2.5-flash)        │
│      │    └── classifyFragment() (Gemini 0.1)   │
│      │         │                                │
│      │    Persist ──── Cloudflare D1            │
│      │                                          │
│      └── Admin SSR ──── ui.tsx (Hono JSX)       │
└─────────────────────────────────────────────────┘
         │                      │
    Telegram API             Cloudflare D1
    (sendMessage)         (SQLite, 12 tablas)
```

### Componentes

| Archivo | Responsabilidad |
|---|---|
| `src/index.tsx` | Router Hono, middleware de autenticación, todos los endpoints, SSR de vistas admin |
| `src/agent.ts` | Ciclo VAL: historial, system prompt, directivas, llamadas paralelas a Gemini, clasificación |
| `src/auth.ts` | SHA-256 hash de contraseñas, generación de session tokens |
| `src/ui.tsx` | Componentes JSX: LoginView, SetupAdminView, LobbyView, DashboardView, WozView, AnalyticsView, TuningView |
| `schema.sql` | Schema completo de Cloudflare D1 (SQLite) |
| `wrangler.jsonc` | Configuración del worker: bindings D1, variables de entorno |

---

## 2. Middleware de autenticación

Todas las rutas `/admin/*` están protegidas por un middleware Hono que verifica la cookie firmada `dk_session`:

```typescript
app.use('/admin/*', async (c, next) => {
  // Rutas públicas de auth: /admin/login, /admin/setup, /admin/login_web, /admin/setup_web
  const identity = await getSignedCookie(c, secret, 'dk_session');
  if (!identity) return c.redirect('/admin/login');
  await next();
});
```

La cookie es firmada con `COOKIE_SECRET` (Cloudflare secret) y tiene atributos `HttpOnly`, `SameSite=Lax`, `Path=/`. La firma previene manipulación del lado del cliente.

---

## 3. Flujo del webhook de Telegram

**POST `/webhook`:**
```
Payload JSON de Telegram
  → Extrae text + chatId
  → c.executionCtx.waitUntil(handleMessage(...))
  → Retorna {"status":"ok"} inmediatamente a Telegram
```

`waitUntil()` permite que el worker responda a Telegram en < 100ms mientras el procesamiento (Gemini + D1) continúa en background.

**`handleMessage(text, chatId, env)`:**

1. Si `text.startsWith("/start")`:
   - Extrae el token
   - Actualiza `participants SET participant_id = chatId WHERE invite_token = token`
   - Envía mensaje de consentimiento y bienvenida

2. Si mensaje normal:
   - Busca el participante y su proyecto en D1
   - Si no tiene `consent_given`, lo registra (consentimiento implícito en primer mensaje)
   - Llama `runAgentCycle()` → respuesta VAL + clasificación
   - Inserta fila en `dialogue_turns`
   - Hace upsert en `dialogue_states`
   - Actualiza `participants.last_message_at`
   - Si `directive_applied`, marca la directiva como APPLIED
   - Envía la respuesta de VAL al participante por Telegram

---

## 4. Ciclo VAL (`agent.ts`)

```typescript
async function runAgentCycle(params: AgentParams): Promise<AgentResult>
```

**Pasos:**

1. **Carga historial:** últimos 12 turnos de `dialogue_turns` (= 6 intercambios) ordenados por timestamp DESC, luego invertidos para orden cronológico.

2. **Carga directiva:** primera fila de `wizard_directives WHERE participant_id = ? AND status = 'PENDING'` ordenada por `created_at DESC`.

3. **Carga metaparámetros:** `agent_metaparams WHERE project_id = ?` — temperatura, max_tokens y system_prompt override (si el facilitador configuró tuning).

4. **Construye system prompt:**
   ```
   VAL_BASE_PROMPT (con {SEED_PROMPT} reemplazado)
   + DIRECTIVE_SECTION (si hay directiva pendiente)
   ```

5. **Arma cadena de mensajes:**
   ```
   [SystemMessage]
   [HumanMessage(turno1.user_text)]
   [AIMessage(turno1.val_response)]
   ...
   [HumanMessage(input_actual)]
   ```

6. **Llamadas paralelas (Promise.all):**
   - `valLlm.invoke(messages)` → respuesta conversacional (temperatura 0.7)
   - `classifyFragment(input, geminiKey)` → JSON con clasificación (temperatura 0.1)

7. **Retorna:** `AgentResult` con response, emotional_register, praxis_indicator, directive_applied, saberes_detectados, oppressive_structures.

**Fallback de clasificación:** Si Gemini falla (error de red, quota 429, JSON inválido), `classifyFragment()` cae silenciosamente a `_heuristicClassification()` — clasificación por keywords en el texto.

---

## 5. Schema de Cloudflare D1

### Tablas principales

```sql
-- Proyectos y ciclos IAP
projects (project_id PK, name, seed_prompt, status, created_at, ...)
cycles (project_id + cycle_id PK, phase: INVESTIGACION/ACCION/PARTICIPACION/CLOSED, ...)

-- Participantes
participants (
  participant_id PK,   -- 'pending_TOKEN' hasta que usa /start, luego chatId de Telegram
  project_id FK,
  display_name,
  consent_given INTEGER,    -- 0/1
  consent_timestamp TEXT,
  invite_token TEXT UNIQUE,
  status: invited/active/completed/withdrawn,
  first_message_at, last_message_at
)

-- Turnos de diálogo
dialogue_turns (
  turn_id PK (UUID),
  participant_id, project_id, cycle_id,
  turn_number INTEGER,
  user_text TEXT,
  val_response TEXT,
  emotional_register TEXT,  -- OPEN/GUARDED/RESISTANT/DISTRESSED/NEUTRAL
  speech_act TEXT,          -- praxis: PROPUESTA_ACCION/CATARSIS/REFLEXION_PASIVA
  topics TEXT,              -- JSON: {saberes_detectados:[], oppressive_structures:[]}
  directive_applied TEXT,   -- FK a wizard_directives.id si aplica
  timestamp TEXT
)

-- Estado por participante (upsert en cada turno)
dialogue_states (
  participant_id + project_id + cycle_id PK,
  turn_count INTEGER,
  emotional_register TEXT,
  momentum_score REAL,
  safe_harbor_active INTEGER,
  last_turn_at TEXT
)

-- Directivas Wizard of Oz
wizard_directives (
  id PK (UUID),
  participant_id, project_id,
  content TEXT,
  urgency: MEDIUM/HIGH,
  status: PENDING/APPLIED/DEFERRED/EXPIRED,
  issued_by, applied_at
)

-- Tuning de parámetros VAL por proyecto
agent_metaparams (
  project_id PK FK,
  active_temperature REAL,
  max_output_tokens INTEGER,
  system_base_prompt TEXT,
  updated_at TEXT
)

-- Autenticación de administradores
administrators (
  admin_id PK (UUID),
  username TEXT UNIQUE,
  password_hash TEXT,   -- SHA-256(SALT + password)
  role TEXT,
  created_at TEXT
)
```

### Tablas auxiliares

```sql
outbox         -- Patrón outbox para compensación distribuida (futura integración Pub/Sub)
data_gaps      -- Huecos temáticos detectados por agentes analíticos (AG-05, roadmap)
pilot_feedback -- Encuesta post-piloto a participantes
```

---

## 6. Endpoints API

### Públicos (sin autenticación)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Health check: `{status:"healthy", version:"3.1.0"}` |
| POST | `/webhook` | Webhook de Telegram |

### Autenticación admin
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/setup` | Pantalla de creación del primer admin (bloqueada si ya existe) |
| POST | `/admin/setup_web` | Crear primer administrador |
| GET | `/admin/login` | Pantalla de login |
| POST | `/admin/login_web` | Verificar credenciales, crear sesión |
| GET | `/admin/logout` | Borrar sesión |

### Vistas admin SSR (protegidas)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/lobby` | Panel de inicio: webhook + crear proyecto |
| GET | `/admin/dashboard` | Vista de participantes y proyecto |
| GET | `/admin/woz` | Consola Wizard of Oz en tiempo real |
| GET | `/admin/analytics` | Panel de analítica (SSR) |
| GET | `/admin/tuning` | Panel de tuning de VAL |

### API JSON admin (protegidas)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/admin/setup_telegram` | Registrar webhook con Telegram API |
| POST | `/admin/create_project` | Crear proyecto (JSON body) |
| POST | `/admin/create_project_web` | Crear proyecto (form) |
| GET | `/admin/projects` | Listar proyectos |
| POST | `/admin/register_participant` | Registrar participante (JSON) |
| POST | `/admin/register_participant_web` | Registrar participantes masivo (form) |
| GET | `/admin/participants/:project_id` | Listar participantes con stats |
| GET | `/admin/conversation/:participant_id` | Historial de turnos de un participante |
| POST | `/admin/inject_directive` | Inyectar directiva WoZ (JSON) |
| POST | `/admin/inject_directive_web` | Inyectar directiva WoZ (form) |
| GET | `/admin/directives/:project_id` | Listar directivas del proyecto |
| GET | `/admin/api/live_feed/:project_id` | Feed en tiempo real para polling WoZ |
| GET | `/admin/analytics/:project_id` | Analítica JSON completa del proyecto |
| POST | `/admin/tuning_web` | Guardar parámetros de tuning |

---

## 7. Variables de entorno y secretos

| Variable | Tipo | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | Secret | API key de Google AI Studio |
| `TELEGRAM_BOT_TOKEN` | Secret | Token del bot de Telegram |
| `COOKIE_SECRET` | Secret | Clave para firmar cookies de sesión (mín. 32 chars) |
| `GCP_PROJECT_ID` | Var (wrangler.jsonc) | ID de proyecto GCP (reservado para futura integración Pub/Sub) |
| `GCP_PUBSUB_TOPIC_INBOUND` | Var (wrangler.jsonc) | Topic Pub/Sub (reservado para futura integración) |

---

## 8. Guía de desarrollo y contribución

### Reglas de seguridad
1. **Nunca** exponer `participant_id` (chatId de Telegram) en respuestas públicas o logs legibles
2. **Nunca** usar string interpolation en queries D1 — siempre parámetros `.bind()`
3. **Nunca** modificar el `VAL_BASE_PROMPT` sin documentarlo en el commit y notificar al equipo investigador
4. Los secretos solo existen en Cloudflare (via `wrangler secret put`) — nunca en el repositorio

### Schema migrations
Las migraciones se ejecutan vía wrangler, no en código:
```bash
npx wrangler d1 execute digikawsay-d1 --remote --command "ALTER TABLE X ADD COLUMN Y TEXT"
```
Documentar cada migración en `outputs/` con timestamp.

### Ciclo de despliegue
```bash
git checkout Autenticacion-Implementada   # branch de producción
# ... hacer cambios ...
git add src/worker-digikawsay/src/
git commit -m "descripción del cambio"
git push origin Autenticacion-Implementada
cd src/worker-digikawsay && npm run deploy
```

### Arquitectura objetivo (hoja de ruta)
La especificación completa de la arquitectura Python/Swarm con Pub/Sub, LangGraph, Weaviate y múltiples agentes (AG-05, AG-00, Preprocessor) está documentada en `Requerimientos/DOC-03-agent-config-pack.json` y `Requerimientos/temp_doc01.txt`. El worker actual es el MVP que valida la propuesta de valor antes de escalar a esa arquitectura.
