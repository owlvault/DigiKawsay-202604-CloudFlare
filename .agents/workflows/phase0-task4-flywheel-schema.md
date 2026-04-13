---
name: phase0-task4-flywheel-schema
description: Schema de datos para el flywheel de entrenamiento — anotaciones de facilitador, efectividad de directivas, tipo de proyecto
tags: [phase0, database, flywheel, training-data, migrations]
---

# Tarea: Schema del Data Flywheel

## Contexto
Cada piloto ejecutado debe generar datos de entrenamiento de alta calidad para la maduración
del sistema. Esta tarea extiende el schema existente para capturar:
1. Anotaciones del facilitador sobre fragmentos clave
2. Efectividad real de las directivas WoZ (para aprender qué funciona)
3. Tipo de investigación del proyecto (para futuros modelos especializados)
4. Campo `espejo_delivered` en dialogue_turns (para correlación de El Espejo)

Sin estos campos, los pilotos generan conversaciones pero no datos estructurados
de retroalimentación que permitan mejorar el sistema.

## Archivos a crear o modificar
- `infra/migrations/002_flywheel_schema.sql` — CREAR
- `src/agente00-service/main.py` — MODIFICAR (endpoints de anotación + directiva efectiva)
- `src/val-service/main.py` — MODIFICAR (marcar espejo_delivered)

## Implementación

### Paso 1: Migración SQL

Crear `infra/migrations/002_flywheel_schema.sql`:

```sql
-- Migración 002: Schema del Data Flywheel para entrenamiento del sistema
-- Permite capturar supervisión humana y retroalimentación estructurada

-- 1. Tipo de proyecto para segmentación de datos de entrenamiento
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_type_enum') THEN
        CREATE TYPE project_type_enum AS ENUM (
            'CULTURA_ORGANIZACIONAL',
            'TRANSFORMACION_DIGITAL',
            'INVESTIGACION_CUALITATIVA',
            'PILOTO_INTERNO'
        );
    END IF;
END $$;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS project_type project_type_enum DEFAULT 'CULTURA_ORGANIZACIONAL',
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 2. Campo para rastrear cuándo se entregó El Espejo (para correlación de impacto)
ALTER TABLE dialogue_turns
    ADD COLUMN IF NOT EXISTS espejo_delivered BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS espejo_payload JSONB;

-- 3. Efectividad de directivas WoZ (retroalimentación del facilitador)
ALTER TABLE wizard_directives
    ADD COLUMN IF NOT EXISTS effectiveness_score SMALLINT CHECK (effectiveness_score BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS facilitator_note TEXT,
    ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

-- 4. Tabla de anotaciones del facilitador sobre fragmentos
CREATE TABLE IF NOT EXISTS facilitator_annotations (
    annotation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID REFERENCES projects(project_id),
    turn_id             UUID REFERENCES dialogue_turns(turn_id) ON DELETE CASCADE,
    participant_id      TEXT NOT NULL,
    -- Tipo de anotación
    annotation_type     TEXT NOT NULL,  -- 'KEY_INSIGHT' | 'THEME_TAG' | 'CORRECTION' | 'EXEMPLAR'
    -- Contenido
    label               TEXT NOT NULL,  -- etiqueta breve (< 80 chars)
    note                TEXT,           -- contexto adicional del facilitador
    -- Para entrenamiento: indica si el análisis automático fue correcto
    ag05_was_correct    BOOLEAN,        -- ¿El análisis de AG-05 fue correcto para este turno?
    corrected_praxis    TEXT,           -- Si AG-05 se equivocó, ¿cuál era el praxis correcto?
    corrected_emotion   TEXT,           -- Si el emotion detection fue incorrecto
    -- Trazabilidad
    created_by          TEXT DEFAULT 'facilitator',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_annotations_project ON facilitator_annotations(project_id);
CREATE INDEX IF NOT EXISTS idx_annotations_turn ON facilitator_annotations(turn_id);
CREATE INDEX IF NOT EXISTS idx_annotations_type ON facilitator_annotations(annotation_type);

-- 5. Vista de calidad del flywheel (para monitoreo de maduración)
CREATE OR REPLACE VIEW v_flywheel_quality AS
SELECT
    p.project_id,
    p.name AS project_name,
    p.project_type,
    COUNT(DISTINCT dt.turn_id) AS total_turns,
    COUNT(DISTINCT dt.turn_id) FILTER (WHERE dt.espejo_delivered) AS espejo_turns,
    COUNT(DISTINCT fa.annotation_id) AS facilitator_annotations,
    COUNT(DISTINCT fa.annotation_id) FILTER (WHERE fa.ag05_was_correct = FALSE) AS ag05_corrections,
    AVG(wd.effectiveness_score) FILTER (WHERE wd.effectiveness_score IS NOT NULL) AS avg_directive_effectiveness,
    p.created_at,
    p.closed_at
FROM projects p
LEFT JOIN dialogue_turns dt ON p.project_id = dt.project_id
LEFT JOIN facilitator_annotations fa ON p.project_id = fa.project_id
LEFT JOIN wizard_directives wd ON p.project_id = wd.project_id
GROUP BY p.project_id, p.name, p.project_type, p.created_at, p.closed_at;
```

### Paso 2: Endpoints de anotación en AGENTE-00

En `src/agente00-service/main.py`, añadir:

```python
# ── Flywheel: Anotaciones del Facilitador ──────────────────────────────────

class AnnotationCreate(BaseModel):
    turn_id: str
    participant_id: str
    annotation_type: str  # KEY_INSIGHT | THEME_TAG | CORRECTION | EXEMPLAR
    label: str
    note: Optional[str] = None
    ag05_was_correct: Optional[bool] = None
    corrected_praxis: Optional[str] = None
    corrected_emotion: Optional[str] = None


@app.post("/admin/annotations/{project_id}", status_code=201)
def create_annotation(project_id: str, body: AnnotationCreate):
    """Guarda una anotación del facilitador sobre un turno específico."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO facilitator_annotations
                (project_id, turn_id, participant_id, annotation_type,
                 label, note, ag05_was_correct, corrected_praxis, corrected_emotion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING annotation_id
        """, (
            project_id, body.turn_id, body.participant_id, body.annotation_type,
            body.label, body.note, body.ag05_was_correct,
            body.corrected_praxis, body.corrected_emotion
        ))
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {"annotation_id": str(row["annotation_id"]), "status": "created"}
    except Exception as e:
        logger.error(f"Error creando anotación: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/directives/{directive_id}/score")
def score_directive(directive_id: str, score: int, note: Optional[str] = None):
    """Registra la efectividad de una directiva (1-5 estrellas)."""
    if not 1 <= score <= 5:
        raise HTTPException(status_code=400, detail="Score debe ser entre 1 y 5")
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            UPDATE wizard_directives
            SET effectiveness_score = %s,
                facilitator_note = %s,
                applied_at = NOW()
            WHERE directive_id = %s
        """, (score, note, directive_id))
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "scored", "directive_id": directive_id, "score": score}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/flywheel/{project_id}")
def get_flywheel_quality(project_id: str):
    """Retorna métricas de calidad del flywheel para el proyecto."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM v_flywheel_quality WHERE project_id = %s
        """, (project_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        return dict(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Paso 3: Marcar espejo_delivered en VAL

En `src/val-service/main.py`, localizar la sección donde se activa El Espejo
(aproximadamente donde `turn_count % 3 == 0` o similar). Después de enviar
el mensaje de El Espejo al participante, añadir:

```python
# Marcar el turno actual como espejo_delivered en dialogue_turns
try:
    conn = get_db()  # usar la misma conexión del _persist_turn o abrir nueva
    cur = conn.cursor()
    cur.execute("""
        UPDATE dialogue_turns
        SET espejo_delivered = TRUE,
            espejo_payload = %s
        WHERE turn_id = %s
    """, (json.dumps({"espejo_text": espejo_text}), current_turn_id))
    conn.commit()
    cur.close()
    conn.close()
except Exception as e:
    logger.warning(f"No se pudo marcar espejo_delivered: {e}")
```

Nota: `current_turn_id` debe ser el UUID del turno recién persistido por `_persist_turn()`.
Verificar que `_persist_turn()` retorna el `turn_id` generado, y si no, modificarlo
para que lo retorne.

### Paso 4: Campo project_type en creación de proyecto

En `src/agente00-service/main.py`, en el modelo `ProjectCreate` o equivalente:

```python
class ProjectCreate(BaseModel):
    name: str
    seed_prompt: str
    project_type: str = "CULTURA_ORGANIZACIONAL"  # default
```

En el endpoint `POST /admin/projects`, añadir `project_type` al INSERT:
```sql
INSERT INTO projects (name, seed_prompt, project_type)
VALUES (%s, %s, %s)
```

En el formulario HTML de `panel.html` (sección `sec-projects`), añadir selector:
```html
<div class="form-row">
    <label>Tipo de Investigación</label>
    <select id="project-type">
        <option value="CULTURA_ORGANIZACIONAL">Diagnóstico de Cultura</option>
        <option value="TRANSFORMACION_DIGITAL">Transformación Digital</option>
        <option value="INVESTIGACION_CUALITATIVA">Investigación Cualitativa</option>
        <option value="PILOTO_INTERNO">Piloto Interno</option>
    </select>
</div>
```

## Criterios de Éxito
1. `infra/migrations/002_flywheel_schema.sql` se ejecuta sin errores en PostgreSQL
2. `POST /admin/annotations/{project_id}` crea una anotación y retorna `annotation_id`
3. `POST /admin/directives/{id}/score` actualiza el score de efectividad
4. `GET /admin/flywheel/{project_id}` retorna objeto con `total_turns`, `facilitator_annotations`, `avg_directive_effectiveness`
5. Cada turno donde se activa El Espejo tiene `espejo_delivered = TRUE` en `dialogue_turns`
6. Los proyectos nuevos pueden crearse con `project_type` especificado

## Cómo verificar
```bash
# 1. Aplicar migración
psql $DATABASE_URL -f infra/migrations/002_flywheel_schema.sql

# 2. Verificar columnas añadidas
psql $DATABASE_URL -c "\d projects" | grep project_type
psql $DATABASE_URL -c "\d dialogue_turns" | grep espejo
psql $DATABASE_URL -c "\d wizard_directives" | grep effectiveness

# 3. Verificar tabla de anotaciones
psql $DATABASE_URL -c "\d facilitator_annotations"

# 4. Probar endpoint de anotación
curl -X POST http://localhost:8002/admin/annotations/{project_id} \
  -H "Content-Type: application/json" \
  -d '{
    "turn_id": "uuid-del-turno",
    "participant_id": "id-del-participante",
    "annotation_type": "KEY_INSIGHT",
    "label": "Menciona Shadow IT con Excel",
    "ag05_was_correct": true
  }'

# 5. Probar flywheel quality
curl http://localhost:8002/admin/flywheel/{project_id}
```
