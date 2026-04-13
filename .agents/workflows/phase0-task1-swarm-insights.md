---
name: phase0-task1-swarm-insights
description: Crear tabla swarm_insights y conectar el output de AG-05 a AGENTE-00 via Pub/Sub
tags: [phase0, database, pubsub, ag05, agente00]
---

# Tarea: Conectar AG-05 → AGENTE-00 via swarm_insights

## Contexto
AG-05 (`src/ag-05-service/main.py`) actualmente analiza fragmentos de conversación y publica
los resultados al topic Pub/Sub `iap.swarm.output`. Sin embargo, AGENTE-00
(`src/agente00-service/main.py`) no tiene un subscriber para ese topic, por lo que los
análisis se pierden.

Esta tarea cierra ese loop: crea la tabla de destino y añade el subscriber en AGENTE-00.

## Archivos a crear o modificar
- `infra/migrations/001_swarm_insights.sql` — CREAR (nueva tabla)
- `src/agente00-service/main.py` — MODIFICAR (añadir subscriber Pub/Sub + función de inserción)

## Implementación

### Paso 1: Crear la migración SQL
Crear el archivo `infra/migrations/001_swarm_insights.sql` con el siguiente contenido:

```sql
-- Migración 001: Tabla para outputs del enjambre de agentes analíticos
-- Almacena los análisis de AG-05 (y futuros AG-01, AG-02) por turno de conversación

CREATE TABLE IF NOT EXISTS swarm_insights (
    insight_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID REFERENCES projects(project_id),
    participant_id          TEXT NOT NULL,
    turn_id                 UUID REFERENCES dialogue_turns(turn_id) ON DELETE SET NULL,
    agent_id                TEXT NOT NULL,              -- 'AG-05', 'AG-01', 'AG-02', etc.
    task_id                 TEXT,                       -- message_id del paquete origen
    -- Métricas Fals Borda (AG-05)
    sentipensar_score       FLOAT,
    praxis_indicator        TEXT,                       -- CATARSIS | REFLEXION_PASIVA | PROPUESTA_ACCION
    relational_parity       TEXT,                       -- SUBMISION_JERARQUICA | PARIDAD | AISLAMIENTO
    -- Hallazgos cualitativos
    saberes_detectados      TEXT[],
    oppressive_structures   TEXT[],
    methodological_insight  TEXT,
    recommended_woz_directive TEXT,
    -- Payload completo para extensibilidad futura (AG-01, AG-02 tendrán distintos campos)
    raw_payload             JSONB NOT NULL DEFAULT '{}',
    -- Trazabilidad
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swarm_insights_project ON swarm_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_swarm_insights_participant ON swarm_insights(participant_id);
CREATE INDEX IF NOT EXISTS idx_swarm_insights_agent ON swarm_insights(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_insights_turn ON swarm_insights(turn_id);
```

### Paso 2: Añadir subscriber en AGENTE-00

En `src/agente00-service/main.py`, realizar los siguientes cambios:

**2a. Añadir variables de configuración** (cerca de las otras variables de env, al inicio del archivo):
```python
SWARM_OUTPUT_SUB = os.getenv("PUBSUB_SWARM_OUTPUT_SUB", "agente00-swarm-output-sub")
```

**2b. Añadir función de persistencia** (después de las funciones de DB existentes):
```python
def _persist_swarm_insight(agent_output: dict):
    """Persiste un output del enjambre de agentes en la tabla swarm_insights."""
    try:
        payload = agent_output.get("payload", {})
        fals_borda = payload.get("fals_borda_metrics", {})
        cultural_shadows = payload.get("cultural_shadows", {})

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO swarm_insights (
                project_id, participant_id, agent_id, task_id,
                sentipensar_score, praxis_indicator, relational_parity,
                saberes_detectados, oppressive_structures,
                methodological_insight, recommended_woz_directive,
                raw_payload
            ) VALUES (
                (SELECT project_id FROM participants WHERE participant_id = %s LIMIT 1),
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """, (
            agent_output.get("participant_id"),
            agent_output.get("participant_id"),
            agent_output.get("agent_id", "unknown"),
            agent_output.get("task_id"),
            fals_borda.get("sentipensar_score"),
            fals_borda.get("praxis_indicator"),
            fals_borda.get("relational_parity"),
            cultural_shadows.get("saberes_detectados", []),
            cultural_shadows.get("oppressive_structures", []),
            payload.get("methodological_insight"),
            payload.get("recommended_woz_directive"),
            json.dumps(payload)
        ))
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Swarm insight guardado para {agent_output.get('participant_id')}")
    except Exception as e:
        logger.warning(f"Error persistiendo swarm insight: {e}")
```

**2c. Añadir callback del subscriber** (después de la función anterior):
```python
def _process_swarm_output(message):
    """Procesa outputs del enjambre de agentes analíticos."""
    try:
        agent_output = json.loads(message.data.decode("utf-8"))
        logger.info(f"Swarm output recibido de {agent_output.get('agent_id')} "
                    f"para {agent_output.get('participant_id')}")
        _persist_swarm_insight(agent_output)
        message.ack()
    except Exception as e:
        logger.error(f"Error procesando swarm output: {e}")
        message.nack()
```

**2d. Iniciar el subscriber en el startup de la app** (en el evento `startup` existente o crearlo):
```python
@app.on_event("startup")
def startup_event():
    """Inicia subscribers de Pub/Sub al arrancar AGENTE-00."""
    try:
        swarm_sub_path = subscriber.subscription_path(PROJECT_ID, SWARM_OUTPUT_SUB)
        subscriber.subscribe(swarm_sub_path, callback=_process_swarm_output)
        logger.info(f"AGENTE-00 escuchando swarm output en: {swarm_sub_path}")
    except Exception as e:
        logger.warning(f"No se pudo iniciar subscriber de swarm: {e}")
```

Asegurarse de que `subscriber = pubsub_v1.SubscriberClient()` esté definido al inicio del archivo.
Si no existe, añadirlo junto a `publisher`.

**2e. Añadir imports necesarios** si no están ya presentes:
```python
from google.cloud import pubsub_v1
import json
```

**2f. Añadir endpoint para consultar insights** (para uso futuro del panel):
```python
@app.get("/admin/insights/{project_id}")
def get_swarm_insights(project_id: str, limit: int = 50):
    """Obtiene los últimos N insights del enjambre para un proyecto."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT si.*, p.display_name
            FROM swarm_insights si
            LEFT JOIN participants p ON si.participant_id = p.participant_id
            WHERE si.project_id = %s
            ORDER BY si.created_at DESC
            LIMIT %s
        """, (project_id, limit))
        insights = cur.fetchall()
        cur.close()
        conn.close()
        return {"insights": [dict(i) for i in insights]}
    except Exception as e:
        logger.error(f"Error obteniendo insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Paso 3: Verificar requirements
En `src/agente00-service/requirements.txt`, verificar que `google-cloud-pubsub` esté incluido.
Si no está, añadirlo.

## Criterios de Éxito
1. `infra/migrations/001_swarm_insights.sql` existe y es SQL válido ejecutable
2. `agente00-service/main.py` tiene la función `_persist_swarm_insight()` sin errores de sintaxis
3. `agente00-service/main.py` tiene el subscriber `_process_swarm_output()` iniciado en startup
4. `GET /admin/insights/{project_id}` retorna `{"insights": []}` (lista vacía) sin errores
5. El código existente de AGENTE-00 no se rompe (todos los endpoints existentes siguen funcionales)

## Cómo verificar
```bash
# 1. Aplicar la migración
psql $DATABASE_URL -f infra/migrations/001_swarm_insights.sql

# 2. Verificar que la tabla existe
psql $DATABASE_URL -c "\d swarm_insights"

# 3. Levantar AGENTE-00 y verificar que inicia sin errores
cd src/agente00-service && uvicorn main:app --port 8002

# 4. Probar el endpoint
curl http://localhost:8002/admin/insights/{project_id}
```
