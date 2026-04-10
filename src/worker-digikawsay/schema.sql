-- Schema: digikawsay para Cloudflare D1 (Dialecto SQLite)
-- Transformado desde PostgreSQL

-- Core: Projects & Cycles
CREATE TABLE IF NOT EXISTS projects (
  project_id        TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  seed_prompt       TEXT,
  description       TEXT,
  max_participants  INTEGER DEFAULT 15,
  pilot_duration_days INTEGER DEFAULT 7,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','closed','archived')),
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_at         TEXT,
  created_by        TEXT
);

CREATE TABLE IF NOT EXISTS cycles (
  cycle_id          INTEGER,
  project_id        TEXT REFERENCES projects(project_id),
  phase             TEXT CHECK (phase IN ('INVESTIGACION','ACCION','PARTICIPACION','CLOSED')),
  started_at        TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_at         TEXT,
  n_participants_active INTEGER DEFAULT 0,
  n_dialogue_packets INTEGER DEFAULT 0,
  saturation_reached INTEGER DEFAULT 0, -- BOOLEAN is INTEGER in SQLite (0 or 1)
  saturation_index  REAL DEFAULT 0.0,
  consensus_reached INTEGER DEFAULT 0,
  active_agents     TEXT, -- TEXT[] in postgres, use JSON in TS
  PRIMARY KEY (project_id, cycle_id)
);

-- Participants: Registration & Consent
CREATE TABLE IF NOT EXISTS participants (
  participant_id    TEXT PRIMARY KEY,
  project_id        TEXT REFERENCES projects(project_id),
  display_name      TEXT,
  consent_given     INTEGER DEFAULT 0,
  consent_timestamp TEXT,
  invite_token      TEXT UNIQUE,
  status            TEXT DEFAULT 'invited' CHECK (status IN ('invited','active','completed','withdrawn')),
  registered_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  first_message_at  TEXT,
  last_message_at   TEXT
);

-- Dialogue: Per-turn structured data
CREATE TABLE IF NOT EXISTS dialogue_turns (
  turn_id           TEXT PRIMARY KEY,
  participant_id    TEXT NOT NULL,
  project_id        TEXT REFERENCES projects(project_id),
  cycle_id          INTEGER DEFAULT 1,
  turn_number       INTEGER NOT NULL,
  user_text         TEXT NOT NULL,
  val_response      TEXT NOT NULL,
  emotional_register TEXT,
  speech_act        TEXT,
  topics            TEXT, -- JSON string
  directive_applied TEXT,
  latency_ms        INTEGER,
  timestamp         TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dialogue_states (
  participant_id    TEXT NOT NULL,
  project_id        TEXT REFERENCES projects(project_id),
  cycle_id          INTEGER DEFAULT 1,
  turn_count        INTEGER DEFAULT 0,
  emotional_register TEXT DEFAULT 'Neutral',
  momentum_score    REAL DEFAULT 0.5,
  topics_covered    TEXT, -- JSON string
  topics_pending    TEXT, -- JSON string
  active_directive_id TEXT,
  safe_harbor_active INTEGER DEFAULT 0,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','timed_out','closed','withdrawn')),
  last_turn_at      TEXT,
  PRIMARY KEY (participant_id, project_id, cycle_id)
);

-- Wizard of Oz: Expert Directives
CREATE TABLE IF NOT EXISTS wizard_directives (
  id                TEXT PRIMARY KEY,
  participant_id    TEXT NOT NULL,
  project_id        TEXT,
  content           TEXT NOT NULL,
  urgency           TEXT DEFAULT 'MEDIUM',
  status            TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPLIED','DEFERRED','EXPIRED')),
  issued_by         TEXT DEFAULT 'human_investigator',
  applied_at        TEXT,
  effect_summary    TEXT,
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Outbox pattern for distributed compensation (V3.1)
CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    envelope_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSONB to TEXT
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    delivered_at TEXT
);

-- Data Gaps: Knowledge holes detected by agents
CREATE TABLE IF NOT EXISTS data_gaps (
  gap_id            TEXT PRIMARY KEY,
  project_id        TEXT REFERENCES projects(project_id),
  cycle_id          INTEGER,
  constructo        TEXT NOT NULL,
  agent_id          TEXT NOT NULL,
  cycles_open       INTEGER DEFAULT 1,
  status            TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DEAD_END','OUT_OF_SCOPE')),
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Post-pilot feedback
CREATE TABLE IF NOT EXISTS pilot_feedback (
  feedback_id       TEXT PRIMARY KEY,
  participant_id    TEXT NOT NULL,
  project_id        TEXT REFERENCES projects(project_id),
  question_key      TEXT NOT NULL,
  response_text     TEXT,
  response_score    INTEGER,
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_dialogue_states_project ON dialogue_states(project_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_turns_participant ON dialogue_turns(participant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_turns_ts ON dialogue_turns(timestamp);
CREATE INDEX IF NOT EXISTS idx_participants_project ON participants(project_id);
CREATE INDEX IF NOT EXISTS idx_participants_invite ON participants(invite_token);
