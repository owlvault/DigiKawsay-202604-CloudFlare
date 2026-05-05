-- Schema: digikawsay para Cloudflare D1 (Dialecto SQLite)
-- Transformado desde PostgreSQL

-- Core: Projects & Cycles
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id     TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_projects (
  admin_id      TEXT REFERENCES administrators(admin_id),
  project_id    TEXT REFERENCES projects(project_id),
  PRIMARY KEY (admin_id, project_id)
);

CREATE TABLE IF NOT EXISTS users (
  user_id       TEXT PRIMARY KEY, -- Telegram ID
  tenant_id     TEXT REFERENCES tenants(tenant_id),
  display_name  TEXT,
  phone_number  TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  project_id        TEXT PRIMARY KEY,
  tenant_id         TEXT REFERENCES tenants(tenant_id),
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
  participant_id    TEXT,
  project_id        TEXT REFERENCES projects(project_id),
  display_name      TEXT,
  consent_given     INTEGER DEFAULT 0,
  consent_timestamp TEXT,
  invite_token      TEXT UNIQUE,
  status            TEXT DEFAULT 'invited' CHECK (status IN ('invited','active','completed','withdrawn')),
  registered_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  first_message_at  TEXT,
  last_message_at   TEXT,
  PRIMARY KEY (participant_id, project_id)
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
  praxis_indicator  TEXT,
  topics            TEXT, -- JSON string
  directive_applied TEXT,
  analytics_metadata TEXT, -- JSON string
  depth_score       REAL DEFAULT 0,
  dialectic_strategy TEXT DEFAULT 'FREE_FLOW',
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
  current_phase     TEXT DEFAULT 'INVESTIGACION' CHECK (current_phase IN ('INVESTIGACION', 'ACCION', 'PARTICIPACION', 'CLOSED')),
  phase_progress    REAL DEFAULT 0,
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

-- Narrative Memory: Condensed semantic summaries per participant (Opción A)
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

-- Tuning & Metaparameters
CREATE TABLE IF NOT EXISTS agent_metaparams (
  project_id        TEXT PRIMARY KEY REFERENCES projects(project_id),
  active_temperature REAL DEFAULT 0.7,
  max_output_tokens INTEGER DEFAULT 800,
  system_base_prompt TEXT,
  updated_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Identity & Authentication
CREATE TABLE IF NOT EXISTS administrators (
  admin_id      TEXT PRIMARY KEY,
  tenant_id     TEXT REFERENCES tenants(tenant_id),
  username      TEXT UNIQUE,
  password_hash TEXT,
  role          TEXT DEFAULT 'SUPERADMIN' CHECK (role IN ('SUPERADMIN', 'TENANT_ADMIN', 'PILOT_ADMIN')),
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Swarm Insights
CREATE TABLE IF NOT EXISTS swarm_insights (
    insight_id              TEXT PRIMARY KEY,
    project_id              TEXT REFERENCES projects(project_id),
    participant_id          TEXT NOT NULL,
    turn_id                 TEXT REFERENCES dialogue_turns(turn_id) ON DELETE SET NULL,
    agent_id                TEXT NOT NULL,
    task_id                 TEXT,
    sentipensar_score       REAL,
    praxis_indicator        TEXT,
    relational_parity       TEXT,
    saberes_detectados      TEXT, -- JSON string
    oppressive_structures   TEXT, -- JSON string
    methodological_insight  TEXT,
    recommended_woz_directive TEXT,
    raw_payload             TEXT DEFAULT '{}', -- JSON string
    created_at              TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swarm_insights_project ON swarm_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_swarm_insights_participant ON swarm_insights(participant_id);
CREATE INDEX IF NOT EXISTS idx_swarm_insights_agent ON swarm_insights(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_insights_turn ON swarm_insights(turn_id);

-- Security: Audit trail for prompt injection, rate limiting, auth failures
CREATE TABLE IF NOT EXISTS security_events (
  event_id        TEXT PRIMARY KEY,
  event_type      TEXT NOT NULL,
  participant_id  TEXT,
  severity        TEXT DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  details         TEXT,
  user_input_hash TEXT,
  action_taken    TEXT DEFAULT 'ALLOWED' CHECK (action_taken IN ('ALLOWED', 'FLAGGED', 'BLOCKED', 'RATE_LIMITED')),
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_participant ON security_events(participant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_time ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);

-- Billing & Quotas
CREATE TABLE IF NOT EXISTS tenant_quotas (
  tenant_id          TEXT PRIMARY KEY REFERENCES tenants(tenant_id),
  max_tokens_monthly INTEGER DEFAULT 1000000,
  used_tokens_monthly INTEGER DEFAULT 0,
  cutoff_active      INTEGER DEFAULT 0,
  reset_date         TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_quotas (
  project_id         TEXT PRIMARY KEY REFERENCES projects(project_id),
  max_tokens         INTEGER DEFAULT 500000,
  used_tokens        INTEGER DEFAULT 0,
  cutoff_active      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS usage_logs (
  log_id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id          TEXT REFERENCES tenants(tenant_id),
  project_id         TEXT REFERENCES projects(project_id),
  operation_type     TEXT NOT NULL,
  tokens_prompt      INTEGER DEFAULT 0,
  tokens_completion  INTEGER DEFAULT 0,
  tokens_total       INTEGER DEFAULT 0,
  cost_estimate      REAL DEFAULT 0.0,
  timestamp          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant ON usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_project ON usage_logs(project_id);
