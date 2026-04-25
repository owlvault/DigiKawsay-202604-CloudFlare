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
