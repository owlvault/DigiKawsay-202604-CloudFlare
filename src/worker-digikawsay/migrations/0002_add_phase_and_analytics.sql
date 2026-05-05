-- Migración para añadir columnas faltantes en el esquema
-- (Detectadas como causantes del fallo silencioso en el bot)

-- 1. Añadir columnas a dialogue_turns
ALTER TABLE dialogue_turns ADD COLUMN praxis_indicator TEXT;
ALTER TABLE dialogue_turns ADD COLUMN analytics_metadata TEXT;

-- 2. Añadir columnas a dialogue_states
ALTER TABLE dialogue_states ADD COLUMN current_phase TEXT DEFAULT 'INVESTIGACION' CHECK (current_phase IN ('INVESTIGACION', 'ACCION', 'PARTICIPACION', 'CLOSED'));
ALTER TABLE dialogue_states ADD COLUMN phase_progress REAL DEFAULT 0;
