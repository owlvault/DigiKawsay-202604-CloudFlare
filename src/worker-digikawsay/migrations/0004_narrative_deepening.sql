-- Migration 0004: Narrative Memory & Deepening Infrastructure
-- Adds narrative memory table for condensed participant summaries,
-- depth scoring and dialectic strategy tracking per turn.

-- 1. Narrative Memory — condensed semantic memory per participant
CREATE TABLE IF NOT EXISTS narrative_memory (
  participant_id    TEXT NOT NULL,
  project_id        TEXT REFERENCES projects(project_id),
  summary           TEXT NOT NULL DEFAULT '',
  themes_explored   TEXT DEFAULT '[]',
  themes_pending    TEXT DEFAULT '[]',
  depth_trend       TEXT DEFAULT 'FLAT' CHECK (depth_trend IN ('RISING','FLAT','DECLINING')),
  strategy_history  TEXT DEFAULT '[]',
  turn_at_summary   INTEGER DEFAULT 0,
  updated_at        TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (participant_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_narrative_memory_project ON narrative_memory(project_id);

-- 2. Add depth tracking columns to dialogue_turns
ALTER TABLE dialogue_turns ADD COLUMN depth_score REAL DEFAULT 0;
ALTER TABLE dialogue_turns ADD COLUMN dialectic_strategy TEXT DEFAULT 'FREE_FLOW';
