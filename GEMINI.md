# DigiKawsay — Contexto del Proyecto para Antigravity

## ¿Qué es este proyecto?
DigiKawsay es una plataforma de investigación cualitativa organizacional aumentada por IA.
Utiliza un bot de Telegram (VAL) para mantener conversaciones profundas asíncronas 1:1 con
participantes de organizaciones, facilita el análisis cualitativo mediante un enjambre de
agentes especializados, y permite al investigador intervenir en tiempo real vía Wizard of Oz (WoZ).

**Canal de usuario:** Telegram. **Panel del facilitador:** `http://localhost:8002/admin`.

## Stack Tecnológico
- Python 3.11 — microservicios backend
- FastAPI — API REST en AGENTE-00 (puerto 8002)
- LangGraph + LangChain Google GenAI — agente conversacional VAL
- Gemini 2.5 Flash — LLM principal (`GEMINI_MODEL` env var)
- PostgreSQL 15 — estado conversacional, proyectos, participantes
- Weaviate — vector store para El Espejo y embeddings
- Google Cloud Pub/Sub — mensajería async entre microservicios
- HTML/CSS/JS vanilla — panel de control frontend (sin frameworks)
- Docker Compose — orquestación local completa
- TypeScript + Hono.js — alternativa Cloudflare Workers (MVP edge, `src/worker-digikawsay/`)

## Mapa de Microservicios
```
src/
├── channel-layer/      # Telegram webhook → Pub/Sub (puerto 8080)
│   └── main.py         # FastAPI, consent flow, routing
├── preprocessor/       # PII anonymization + embeddings + Weaviate storage
│   └── main.py         # anonymize_text(), embed_text(), store_in_weaviate()
├── val-service/        # Agente conversacional LangGraph
│   ├── main.py         # Pub/Sub subscriber, orquestador principal
│   ├── graph.py        # LangGraph: val_node, custom_tool_node, VAL_BASE_PROMPT
│   ├── state.py        # TypedDicts: DigiKawsayState, DialogueState, ConversationDirective
│   └── espejo.py       # Algoritmo El Espejo — convergencias/divergencias Weaviate
├── ag-05-service/      # Agente metodólogo (análisis IAP Fals Borda)
│   └── main.py         # analyze_with_gemini(), _heuristic_fallback(), insight_reducer()
├── agente00-service/   # Supervisor API + panel admin
│   ├── main.py         # FastAPI endpoints /admin/*
│   ├── static/panel.html       # Panel de control SPA
│   ├── static/dashboard.html   # Monitor de infraestructura
│   └── templates/setup_wizard.html
└── worker-digikawsay/  # Cloudflare Workers edge MVP
    └── src/
        ├── agent.ts    # runAgentCycle() — VAL simplificado
        └── index.ts    # Hono.js router, Telegram webhook, admin endpoints
```

## Mapa de Pub/Sub
```
Telegram → channel-layer → iap.channel.inbound
                                    ↓
                             preprocessor (sub: preprocessor-inbound-sub)
                                    ↓
                         iap.val.packet (sub: val-packet-sub)
                                    ↓
                              val-service
                             ↙          ↘
               iap.channel.outbound    iap.val.to.ag00
                       ↓                      ↓
               channel-layer            agente00-service
                       ↓
                   Telegram

iap.swarm.ag05 → ag05-swarm-sub → ag-05-service → iap.swarm.output
                                                         ↓
                                    [PENDIENTE] agente00-service subscriber
```

## Tablas PostgreSQL (infra/db_init.sql)
```
projects          — project_id UUID, name, seed_prompt, status, project_type*
participants      — participant_id TEXT (= Telegram user_id), project_id, consent_given, status
dialogue_turns    — turn_id, participant_id, project_id, user_text, val_response,
                    emotional_register, speech_act, latency_ms, espejo_delivered*
dialogue_states   — participant_id, project_id, turn_count, momentum_score, emotional_register
wizard_directives — id, participant_id, content, urgency, status (PENDING/APPLIED/DEFERRED),
                    directive_effectiveness_score*
swarm_insights*   — insight_id, project_id, participant_id, turn_id, agent_id,
                    sentipensar_score, praxis_indicator, relational_parity,
                    saberes_detectados[], oppressive_structures[], methodological_insight,
                    recommended_woz_directive, raw_payload JSONB
facilitator_annotations* — annotation_id, project_id, participant_id, turn_id,
                            annotation_type, annotation_text
cycles            — project_id, cycle_id, phase (INVESTIGACION/ACCION/PARTICIPACION/CLOSED)
wizard_directives — directivas WoZ por participante

* = campos/tablas a crear en Fase 0
```

## Convenciones de Código

### Python (microservicios)
```python
# Patrón de conexión DB — siempre abrir y cerrar en cada función
def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def mi_funcion(param: str):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT ... FROM ... WHERE x = %s", (param,))  # NUNCA f-string
        result = cur.fetchone()
        cur.close()
        conn.close()
        return dict(result) if result else None
    except Exception as e:
        logger.error(f"Error en mi_funcion: {e}")
        return None

# Patrón Pub/Sub subscriber
def process_message(message: pubsub_v1.subscriber.message.Message):
    try:
        packet = json.loads(message.data.decode("utf-8"))
        # ... procesar ...
        message.ack()
    except Exception as e:
        logger.error(f"Error: {e}")
        message.nack()
```

### JavaScript (panel frontend)
```javascript
// Patrón fetch API
async function api(path, opts = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts
    });
    return res.json();
}

// Patrón toast notification
function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}

// Patrón nueva sección en el panel
// 1. Nav item en sidebar
// 2. <div id="sec-nombre" class="section"> en main
// 3. case en showSection()
// 4. función async loadNombre()
```

### Migraciones SQL
- Nuevas migraciones van en `infra/migrations/NNN_descripcion.sql` (crear directorio si no existe)
- NUNCA modificar `infra/db_init.sql` para cambios post-creación
- Siempre usar `ADD COLUMN ... DEFAULT valor` para añadir columnas a tablas existentes
- Siempre usar `CREATE TABLE IF NOT EXISTS`
- Siempre usar `CREATE INDEX IF NOT EXISTS`

## Restricciones Críticas — NUNCA violar
1. NUNCA compartir datos entre participantes de distintos proyectos
2. NUNCA exponer participant_id real en respuestas visibles por otros participantes
3. NUNCA procesar un mensaje sin verificar `consent_given = true`
4. NUNCA insertar texto de usuario sin pasar por `anonymize_text()` antes de Weaviate
5. NUNCA commitear API keys, tokens o credenciales
6. NUNCA modificar `VAL_BASE_PROMPT` en `graph.py` sin comentario con fecha y razón
7. NUNCA usar SQL con concatenación de strings (solo parámetros `%s`)
8. NUNCA crear archivos README.md salvo que se pida explícitamente

## Variables de Entorno Requeridas
```
GEMINI_API_KEY          — Google Gemini API key
TELEGRAM_BOT_TOKEN      — Token del bot de Telegram
DATABASE_URL            — postgresql://postgres:postgres@localhost:5432/digikawsay
WEAVIATE_URL            — http://localhost:8080
GCP_PROJECT_ID          — digikawsay (default)
GEMINI_MODEL            — gemini-2.5-flash (default)
```

## Cómo Levantar el Stack Completo
```bash
docker-compose up -d          # levanta postgres, weaviate, pubsub-emulator
# Luego cada servicio en su terminal o via docker-compose
```

## Referencia de Archivos Clave
| Propósito | Archivo |
|-----------|---------|
| System prompt de VAL | `src/val-service/graph.py:86` — VAL_BASE_PROMPT |
| LangGraph graph | `src/val-service/graph.py:234` — construct_graph() |
| Estado LangGraph | `src/val-service/state.py` — DigiKawsayState |
| El Espejo | `src/val-service/espejo.py` — get_espejo(), format_espejo_for_val() |
| Orquestador turno | `src/val-service/main.py:184` — process_dialogue_packet() |
| Análisis AG-05 | `src/ag-05-service/main.py:32` — ANALYSIS_PROMPT |
| Panel admin | `src/agente00-service/static/panel.html` |
| Schema DB | `infra/db_init.sql` |
| Weaviate schema | `infra/weaviate_schema.py` |
