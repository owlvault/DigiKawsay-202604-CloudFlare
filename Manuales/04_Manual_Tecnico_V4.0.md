# DigiKawsay: Manual Técnico y de Arquitectura (v4.2 — Cloudflare Worker)

Este manual documenta la arquitectura real del sistema en producción: un **Cloudflare Worker** serverless construido con TypeScript, Hono.js y Cloudflare D1.

---

## 1. Arquitectura del sistema

```
Telegram Bot API
      │
      │ webhook POST /webhook  (validado con X-Telegram-Bot-Api-Secret-Token)
      ▼
┌───────────────────────────────────────────────────────────────┐
│                 Cloudflare Worker (Hono.js)                   │
│                                                               │
│  index.tsx ──── router + middleware auth + multi-tenant       │
│      │                                                        │
│      ├── handleMessage()                                      │
│      │    ├── security.ts  ─── sanitize + rate limit          │
│      │    ├── agent.ts                                        │
│      │    │    ├── narrative.ts  ─── memoria narrativa        │
│      │    │    └── Promise.all:                               │
│      │    │         ├── VAL LLM (Gemini 2.5-flash)            │
│      │    │         └── classifyFragment() (Gemini 0.1)       │
│      │    ├── deepening.ts ─── AG-05 Co-piloto (async)        │
│      │    └── Persist ──── Cloudflare D1                      │
│      │                                                        │
│      └── Admin SSR ──── ui.tsx (Hono JSX)                     │
│           ├── LobbyView / DashboardView / WozView             │
│           ├── AnalyticsView / TuningView                      │
│           ├── BillingView / SecurityView                      │
│           └── LoginView / SetupAdminView                      │
└───────────────────────────────────────────────────────────────┘
         │                      │
    Telegram API             Cloudflare D1
    (sendMessage)         (SQLite, 20+ tablas)
```

### Módulos del worker

| Archivo | Responsabilidad |
|---|---|
| `src/index.tsx` | Router Hono, middleware de autenticación multi-tenant, todos los endpoints, SSR de vistas admin |
| `src/agent.ts` | Ciclo VAL: historial, system prompt por capas, directivas, estrategias, memoria narrativa, llamadas paralelas a Gemini, clasificación semántica |
| `src/narrative.ts` | Memoria narrativa: generación de resúmenes, estrategias dialécticas, depth trend, Espejo Ligero |
| `src/deepening.ts` | AG-05 Co-piloto: lógica de activación, generación de directivas automáticas de profundización |
| `src/security.ts` | Detección de prompt injection, rate limiting, brute force, output leak detection, logging de eventos |
| `src/auth.ts` | PBKDF2 hash de contraseñas (100k iteraciones, salt aleatorio), comparación timing-safe, soporte legacy SHA-256 |
| `src/ui.tsx` | Componentes JSX: todas las vistas del panel admin |
| `schema.sql` | Schema completo de Cloudflare D1 (SQLite) |
| `wrangler.jsonc` | Configuración del worker: bindings D1, variables de entorno |

---

## 2. Multi-tenant y roles de administrador

### 2.1 Modelo de tenants

Cada organización que usa DigiKawsay es un **tenant** con aislamiento completo. La tabla `tenants` centraliza los tenants; cada proyecto y cada administrador pertenece a un tenant.

```sql
tenants (tenant_id PK, name, created_at)
```

El primer administrador (SUPERADMIN) se crea con el tenant `digikawsay_global` por defecto.

### 2.2 Roles de administrador

| Rol | Acceso a proyectos | Acceso a billing | Acceso a seguridad |
|---|---|---|---|
| **SUPERADMIN** | Todos los proyectos de todos los tenants | Sí | Sí |
| **TENANT_ADMIN** | Todos los proyectos del tenant propio | No | No |
| **PILOT_ADMIN** | Solo proyectos asignados en `admin_projects` | No | No |

La función `getAdminProjectFilter(adminUser)` devuelve dinámicamente el `WHERE` apropiado para cada rol en todas las consultas de proyectos.

### 2.3 Middleware de autenticación

```typescript
app.use('/admin/*', async (c, next) => {
  // Rutas de auth: /admin/login, /admin/login_web, /admin/setup, /admin/setup_web → skip
  const secret = c.env.GEMINI_API_KEY || 'digi_secret';
  const identity = await getSignedCookie(c, secret, 'dk_session');
  if (!identity) return c.redirect('/admin/login');
  const adminObj = await db.prepare(
    `SELECT admin_id, username, role, tenant_id FROM administrators WHERE username = ?`
  ).bind(identity).first();
  if (!adminObj) return c.redirect('/admin/logout');
  c.set('adminUser', adminObj);
  await next();
});
```

La cookie `dk_session` contiene el nombre de usuario firmado con `GEMINI_API_KEY` como secret (fallback a `'digi_secret'` si no está configurado). Atributos: `HttpOnly: true`, `SameSite: Strict`, `Secure: true`, duración 7 días.

---

## 3. Módulo de seguridad (`security.ts`)

### 3.1 Detección de prompt injection

`detectPromptInjection(text)` evalúa el texto contra 3 capas:

1. **Patrones regex** (30+ patrones en ES/EN): override de instrucciones, cambio de rol, extracción de system prompt, delimitadores LLM, SQL/code injection, DAN mode
2. **Análisis estructural**: ratio de caracteres especiales > 30% en textos > 50 chars
3. **Longitud excesiva**: textos > 2000 chars (payload stuffing)

Retorna un `ThreatAssessment` con `score` (0-100), `threat_type`, `severity` (LOW/MEDIUM/HIGH/CRITICAL) y `details`.

**Umbrales de acción:**
- `score >= 70`: BLOCKED — el mensaje nunca llega al LLM. Se envía `SAFE_FALLBACK_RESPONSE` al participante.
- `score 40-69`: FLAGGED — el mensaje pasa al LLM pero queda registrado en `security_events`.
- `score < 40`: ALLOWED — procesamiento normal.

### 3.2 Rate limiting por participante

Límites configurados en `security.ts`:
- **20 mensajes por minuto** por participante
- **100 mensajes por hora** por participante

Se persisten en `security_events` (event_type = 'MESSAGE'). Si se supera el límite, VAL responde con un mensaje empático de pausa.

### 3.3 Protección contra fuerza bruta en login

`checkLoginRateLimit(username, db)` cuenta intentos fallidos (event_type = 'AUTH_FAILURE') en los últimos 15 minutos para ese username. Máximo 5 intentos antes de bloquear.

### 3.4 Detección de leaks de output

`detectOutputLeak(response)` verifica que la respuesta de VAL no contenga fragmentos del system prompt, nombres de variables internas, nombres de tablas D1, ni referencias a la arquitectura del sistema. Si se detecta un leak, la respuesta se reemplaza con `SAFE_FALLBACK_RESPONSE`.

### 3.5 Validación del webhook de Telegram

`validateWebhookSecret(header, expectedSecret)` verifica el header `X-Telegram-Bot-Api-Secret-Token` con comparación timing-safe. Si `WEBHOOK_SECRET` no está configurado, la validación se omite (backwards compatible).

### 3.6 Sanitización de inputs

`sanitizeUserInput(text)`:
1. Truncado a 1500 caracteres
2. Remoción de caracteres de control (U+0000–U+001F, etc.)
3. Normalización de homoglifos cirílicos (ataques de evasión de filtros)
4. Evaluación de inyección

---

## 4. Flujo del webhook de Telegram

**POST `/webhook`:**
```
Payload JSON de Telegram
  → Validar X-Telegram-Bot-Api-Secret-Token
  → Extraer text + chatId
  → checkRateLimit(chatId)           ← si falla: enviar mensaje de pausa
  → sanitizeUserInput(text)
  → Si score >= 70: bloquear + log
  → c.executionCtx.waitUntil(handleMessage(...))
  → Retorna {"status":"ok"} inmediatamente a Telegram (<100ms)
```

`waitUntil()` permite que el worker responda a Telegram en < 100ms mientras el procesamiento (Gemini + D1) continúa en background.

---

## 5. Ciclo VAL con capas de contexto (`agent.ts`)

`runAgentCycle(params: AgentParams): Promise<AgentResult>`

### Pasos del ciclo:

1. **Sanitización** del input (`sanitizeUserInput`)

2. **Carga paralela:**
   - Memoria narrativa (`loadNarrativeMemory`)
   - Clasificaciones recientes para estrategia (`loadRecentClassifications`)

3. **Historial:** últimos 12 turnos (o 6 si existe memoria narrativa) para reducir tokens

4. **Directiva PENDING** del facilitador (humana o AG-05)

5. **Estado IAP actual:** `current_phase`, `phase_progress`, `turn_count`

6. **Lógica de avance de fase:** si `phase_progress >= 100`, avanza automáticamente y añade instrucción de celebración del hito

7. **Metaparámetros de tuning** (`active_temperature`, `max_output_tokens`, `system_base_prompt`)

8. **Construcción del system prompt en 4 capas:**
   ```
   Capa 0: VAL_BASE_PROMPT (o prompt custom de tuning) + {SEED_PROMPT}
   Capa 1: DIRECTIVE_SECTION (directiva WoZ activa) + phase change notification
   Capa 2: PROTOCOL_SECTION (técnica de fase por turno: laddering, incidente crítico, etc.)
   Capa 3: STRATEGY_SECTION (estrategia dialéctica: GENTLE_PROVOCATION, BRIDGE_TO_AGENCY, etc.)
   Capa 4: NARRATIVE_SECTION (memoria narrativa condensada + temas pendientes)
   ```

9. **Llamadas paralelas (Promise.all):**
   - `valLlm.invoke(messages)` → respuesta conversacional (temperatura configurable, default 0.7)
   - `classifyFragment(input, geminiKey)` → JSON con clasificación (temperatura 0.1)

10. **Detección de output leak** en la respuesta de VAL

11. **Actualización de memoria narrativa** (asíncrona, cada 4 turnos)

12. **Retorna** `AgentResult` con: response, emotional_register, praxis_indicator, phase_progress, current_phase, directive_applied, saberes_detectados, oppressive_structures, depth_score, dialectic_strategy, security flags, metadata (latency, tokens, etc.)

### floor de maxOutputTokens

Gemini 2.5 Flash usa tokens de "thinking" interno que cuentan contra `maxOutputTokens`. El sistema aplica un floor de **2048 tokens** para asegurar que haya espacio suficiente para la respuesta conversacional independientemente de lo que el facilitador configure en tuning.

---

## 6. Protocolos de fase (`getPhaseProtocol`)

La función `getPhaseProtocol(phase, turnInPhase)` devuelve la técnica cualitativa apropiada para inyectar en el system prompt como Capa 2:

| Fase | Turnos | Técnica |
|---|---|---|
| INVESTIGACION | 1-3 | Sin técnica (rapport libre) |
| INVESTIGACION | 4 | Laddering: "¿Y eso por qué importa?" |
| INVESTIGACION | 5-6 | Incidente Crítico: anclar en la última vez específica |
| INVESTIGACION | 7 | Espejo Ligero: mencionar tema del grupo |
| INVESTIGACION | 8+ | Checkpoint: validar comprensión acumulada |
| ACCION | 1-2 | Shadow Mapping: brecha proceso oficial vs. real |
| ACCION | 3 | Provocación: "Si mañana desapareciera X..." |
| ACCION | 4-5 | Co-diseño: "Carta blanca para cambiar UNA cosa" |
| ACCION | 6+ | Checkpoint |
| PARTICIPACION | 1 | Priorización: lo más urgente de todo lo hablado |
| PARTICIPACION | 2 | Activación de agencia: "¿Qué podrías hacer TÚ?" |
| PARTICIPACION | 3 | Espejo Completo: convergencias + divergencia del grupo |
| PARTICIPACION | 4+ | Cierre IAP: agradecimiento, anonimato, próximos pasos |

---

## 7. Memoria narrativa (`narrative.ts`)

### Cuándo se actualiza
Cada vez que `turnCount >= 4 && turnCount % 4 === 0` (múltiplos de 4).

### Qué genera
Llama a `generateNarrativeSummary()` con los últimos 4 turnos y el resumen anterior. Gemini (temperatura 0.2) genera:
```json
{
  "summary": "3-4 oraciones de lo revelado hasta ahora",
  "themes_explored": ["temas ya discutidos con profundidad"],
  "themes_pending": ["temas mencionados de pasada que merecen profundización"]
}
```

### Efecto en el historial
Cuando existe memoria narrativa, el historial crudo se reduce de 12 a 6 turnos. La memoria narrativa ocupa la Capa 4 del system prompt. Esto reduce el consumo de tokens ~40% en conversaciones largas.

### Estrategias dialécticas (7)
`selectDialecticStrategy(recentClassifications, turnCount, narrativeMemory)` devuelve la estrategia adecuada:

| Prioridad | Estrategia | Condición |
|---|---|---|
| 1 | SAFE_HARBOR | DISTRESSED en cualquiera de los últimos 3 |
| 2 | GENTLE_PROVOCATION | 3 últimos REFLEXION_PASIVA con depth < 40 |
| 3 | DEEPENING_LADDERING | 2 últimos depth_score < 30 |
| 4 | BRIDGE_TO_AGENCY | 3+ CATARSIS en últimos 5 sin PROPUESTA_ACCION |
| 5 | NORMALIZE_PATTERN | 3+ GUARDED en últimos 5 |
| 6 | ESPEJO_LIGERO | Cada ~5 turnos si no se usó recientemente |
| 7 | FREE_FLOW | Default — ninguna condición especial |

---

## 8. AG-05 Co-piloto (`deepening.ts`)

### Lógica de activación (`shouldActivateCopilot`)

Se activa cuando:
- `turnCount % 4 === 0` (revisión periódica cada 4 turnos), O
- 2 turnos consecutivos con `depth_score < 30`

No se activa cuando:
- Existe directiva humana PENDING (`issued_by = 'human_investigator'`)
- `currentPhase === 'CLOSED'`
- `turnCount < 4`

### Generación de directiva (`generateDeepeningDirective`)

Llama a Gemini (temperatura 0.3, max 150 tokens) con el COPILOT_PROMPT que incluye: resumen narrativo, último mensaje, emoción, praxis, depth score, fase actual y temas no explorados.

Retorna `{directive: string, reason: string}`.

### Inserción en `wizard_directives`

Las directivas automáticas se insertan con:
```sql
issued_by = 'ag05_copilot'
urgency = 'AUTO'
status = 'PENDING'
```

Son visibles en el panel WoZ con badge 🤖 y pueden ser ignoradas por el facilitador o aplicadas normalmente por VAL.

---

## 9. Schema de Cloudflare D1

### Tablas principales

```sql
-- Multi-tenant
tenants (tenant_id PK, name, created_at)
admin_projects (admin_id FK, project_id FK -- tabla de proyectos asignados a PILOT_ADMIN)

-- Proyectos y ciclos IAP
projects (project_id PK, tenant_id FK, name, seed_prompt, description,
          max_participants, pilot_duration_days, status, created_at, closed_at, created_by)
cycles (project_id + cycle_id PK, phase: INVESTIGACION/ACCION/PARTICIPACION/CLOSED,
        saturation_index, consensus_reached, ...)

-- Participantes
participants (
  participant_id PK,   -- 'pending_TOKEN' hasta /start, luego chatId de Telegram
  project_id FK,
  display_name,
  consent_given INTEGER,
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
  emotional_register TEXT,
  speech_act TEXT,          -- praxis: PROPUESTA_ACCION/CATARSIS/REFLEXION_PASIVA
  topics TEXT,              -- JSON: {saberes_detectados:[], oppressive_structures:[], metadata:{}}
  directive_applied TEXT,   -- FK a wizard_directives.id si aplica
  depth_score REAL,         -- 0-100: profundidad cualitativa del mensaje
  dialectic_strategy TEXT,  -- estrategia que VAL usó en este turno
  timestamp TEXT
)

-- Estado por participante (upsert en cada turno)
dialogue_states (
  participant_id + project_id + cycle_id PK,
  turn_count INTEGER,
  emotional_register TEXT,
  current_phase TEXT,       -- INVESTIGACION/ACCION/PARTICIPACION/CLOSED
  phase_progress REAL,      -- 0-100: avance en la fase actual
  safe_harbor_active INTEGER,
  last_turn_at TEXT
)

-- Directivas Wizard of Oz (humanas y automáticas)
wizard_directives (
  id PK (UUID),
  participant_id, project_id,
  content TEXT,
  urgency: MEDIUM/HIGH/AUTO,
  status: PENDING/APPLIED/DEFERRED/EXPIRED/FAILED,
  issued_by: 'human_investigator'/'ag05_copilot',
  effect_summary TEXT,      -- razón de la directiva (para AG-05)
  applied_at, created_at
)

-- Memoria narrativa por participante
narrative_memory (
  participant_id + project_id PK,
  summary TEXT,
  themes_explored TEXT,     -- JSON array
  themes_pending TEXT,      -- JSON array
  depth_trend TEXT,         -- RISING/FLAT/DECLINING
  strategy_history TEXT,    -- JSON array últimas 10 estrategias usadas
  turn_at_summary INTEGER,
  updated_at TEXT
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
  tenant_id FK,
  username TEXT UNIQUE,
  password_hash TEXT,   -- PBKDF2: "saltHex:hashHex" (legacy: plain SHA-256 hex)
  role TEXT,            -- SUPERADMIN/TENANT_ADMIN/PILOT_ADMIN
  created_at TEXT
)
```

### Tablas de seguridad

```sql
-- Auditoría de eventos de seguridad
security_events (
  event_id PK,
  event_type TEXT,          -- PROMPT_INJECTION/JAILBREAK_ATTEMPT/ROLE_SWITCHING/SYSTEM_PROBE/
                             -- SUSPICIOUS_STRUCTURE/AUTH_FAILURE/AUTH_LOCKOUT/WEBHOOK_INVALID/
                             -- RATE_LIMITED/MESSAGE (normal message log)
  participant_id TEXT,
  severity TEXT,            -- LOW/MEDIUM/HIGH/CRITICAL
  details TEXT,             -- JSON con detalles del evento
  user_input_hash TEXT,     -- SHA-256 del input original (nunca el texto en claro)
  action_taken TEXT,        -- ALLOWED/FLAGGED/BLOCKED/RATE_LIMITED
  created_at TEXT
)
```

### Tablas de billing

```sql
tenant_quotas (tenant_id PK, max_tokens_monthly, used_tokens_monthly, cutoff_active)
project_quotas (project_id PK, max_tokens, used_tokens, cutoff_active)
usage_logs (log_id, tenant_id, project_id, operation_type, tokens_prompt, 
            tokens_completion, tokens_total, timestamp)
-- operation_type values: VAL_CYCLE, AG05_COPILOT, PROACTIVE_PUSH, NARRATIVE_SUMMARY, SYNTHESIS_REPORT
```

### Tablas auxiliares

```sql
swarm_insights         -- Análisis de AG-05 externo (hoja de ruta: AG-05 como microservicio)
data_gaps              -- Huecos temáticos detectados (roadmap)
pilot_feedback         -- Encuesta post-piloto
outbox                 -- Patrón outbox para integración Pub/Sub futura
```

---

## 10. Endpoints API

### Públicos (sin autenticación)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Health check: `{status:"healthy", service:"digikawsay-cf-worker", version:"3.1.0"}` |
| GET | `/` | Redirect a `/admin/lobby` |
| POST | `/webhook` | Webhook de Telegram (validado con secret token si está configurado) |

### Autenticación admin
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/setup` | Pantalla de creación del primer admin (bloqueada si ya existe) |
| POST | `/admin/setup_web` | Crear primer administrador SUPERADMIN |
| GET | `/admin/login` | Pantalla de login |
| POST | `/admin/login_web` | Verificar credenciales, crear sesión (con brute force check) |
| GET | `/admin/logout` | Borrar sesión |

### Vistas admin SSR (protegidas, filtradas por rol)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/lobby` | Panel de inicio: webhook + crear proyecto |
| GET | `/admin/dashboard` | Vista de participantes y proyecto |
| GET | `/admin/woz` | Consola Wizard of Oz en tiempo real |
| GET | `/admin/analytics` | Panel de analítica (SSR) |
| GET | `/admin/tuning` | Panel de tuning de VAL |
| GET | `/admin/billing` | Panel de billing y cuotas (SUPERADMIN only) |
| GET | `/admin/security` | Dashboard de seguridad (SUPERADMIN only) |

### API JSON admin (protegidas)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/admin/setup_telegram` | Registrar webhook con Telegram API |
| POST | `/admin/api/design_pilot` | Diseñar piloto con IA (JSON body: `{context}`) |
| POST | `/admin/create_project` | Crear proyecto (JSON body) |
| POST | `/admin/create_project_web` | Crear proyecto (form) |
| GET | `/admin/projects` | Listar proyectos (filtrado por rol) |
| POST | `/admin/register_participant` | Registrar participante (JSON) |
| POST | `/admin/register_participant_web` | Registrar participantes masivo (form) |
| GET | `/admin/participants/:project_id` | Listar participantes con stats |
| GET | `/admin/conversation/:participant_id` | Historial de turnos de un participante |
| POST | `/admin/inject_directive` | Inyectar directiva WoZ (JSON) |
| POST | `/admin/inject_directive_web` | Inyectar directiva WoZ o Push proactivo (form) |
| GET | `/admin/directives/:project_id` | Listar directivas del proyecto |
| GET | `/admin/api/live_feed/:project_id` | Feed en tiempo real para polling WoZ (incluye auto_directives) |
| GET | `/admin/analytics/:project_id` | Analítica JSON completa del proyecto |
| GET | `/admin/export/:project_id` | Exportar corpus CSV del proyecto |
| GET | `/admin/report/:project_id` | Informe de síntesis Markdown streaming (AG-05) |
| POST | `/admin/tuning_web` | Guardar parámetros de tuning |
| POST | `/admin/billing/update_tenant_quota` | Actualizar cuota de tenant (SUPERADMIN) |
| POST | `/admin/billing/update_project_quota` | Actualizar cuota de proyecto (SUPERADMIN) |
| GET | `/admin/api/security_events` | Listar eventos de seguridad (SUPERADMIN, filtrable por tipo) |

---

## 11. Variables de entorno y secretos

| Variable | Tipo | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | Secret (obligatorio) | API key de Google AI Studio. También se usa como firma de cookies |
| `TELEGRAM_BOT_TOKEN` | Secret (obligatorio) | Token del bot de Telegram |
| `COOKIE_SECRET` | Secret (obligatorio) | Clave para firmar cookies de sesión (mín. 32 chars). Nota: si GEMINI_API_KEY está presente, el worker la usa para firmar en lugar de este secret |
| `WEBHOOK_SECRET` | Secret (opcional, recomendado) | Secret para validar que los webhooks vienen de Telegram |
| `AG05_SERVICE_URL` | Var (wrangler.jsonc, opcional) | URL del servicio AG-05 externo para swarm_insights. Default: `http://host.docker.internal:8005` |
| `GCP_PROJECT_ID` | Var (wrangler.jsonc, reservado) | ID de proyecto GCP (para futura integración Pub/Sub) |
| `GCP_PUBSUB_TOPIC_INBOUND` | Var (wrangler.jsonc, reservado) | Topic Pub/Sub (futura integración) |

---

## 12. Guía de desarrollo y contribución

### Reglas de seguridad
1. **Nunca** exponer `participant_id` (chatId de Telegram) en logs ni responses visibles al cliente
2. **Nunca** usar string interpolation en queries D1 — siempre parámetros `.bind()`
3. **Nunca** modificar el `VAL_BASE_PROMPT` sin documentarlo en el commit y notificar al equipo investigador
4. **Nunca** almacenar texto de mensajes de participantes en logs — solo hashes SHA-256 si es necesario para auditoría
5. Los secretos solo existen en Cloudflare (via `wrangler secret put`) — nunca en el repositorio

### Schema migrations
Las migraciones se ejecutan vía wrangler, no en código:
```bash
npx wrangler d1 execute digikawsay-d1 --remote --command "ALTER TABLE X ADD COLUMN Y TEXT"
```
Documentar cada migración con timestamp y descripción.

### Ciclo de despliegue
```bash
git checkout main   # branch de producción
# ... hacer cambios ...
git add src/worker-digikawsay/src/
git commit -m "descripción del cambio"
git push origin main
cd src/worker-digikawsay && npm run deploy
```

### Arquitectura objetivo (hoja de ruta)
La especificación completa de la arquitectura Python/Swarm con Pub/Sub, LangGraph, Weaviate y múltiples agentes (AG-05, AG-00, Preprocessor) está documentada en `Requerimientos/DOC-03-agent-config-pack.json`. El worker actual es el MVP que valida la propuesta de valor.

### Consideraciones de Gemini 2.5 Flash
- El modelo usa tokens de "thinking" interno. El floor de 2048 en `maxOutputTokens` es necesario para que el modelo tenga presupuesto suficiente para su razonamiento interno + la respuesta.
- Las llamadas en `Promise.all([valLlm, classifyFragment])` son paralelas para minimizar latencia (típicamente 1.5-3s para el par).
- Si la API de Gemini devuelve 429 (quota), el worker captura el error y responde al participante con un mensaje de pausa empático sin exponer detalles técnicos.
