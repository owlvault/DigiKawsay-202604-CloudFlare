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
