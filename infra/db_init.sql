-- Schema: digikawsay
-- Full pilot-ready schema for DigiKawsay MVP

CREATE SCHEMA IF NOT EXISTS digikawsay;
SET search_path TO digikawsay, public;

-- ============================================================
-- Core: Projects & Cycles
-- ============================================================
CREATE TABLE projects (
  project_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  seed_prompt       TEXT,
  description       TEXT,
  max_participants   INTEGER DEFAULT 15,
  pilot_duration_days INTEGER DEFAULT 7,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','closed','archived')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  closed_at         TIMESTAMPTZ,
  created_by        TEXT
);

CREATE TABLE cycles (
  cycle_id          SERIAL,
  project_id        UUID REFERENCES projects(project_id),
  phase             TEXT CHECK (phase IN ('INVESTIGACION','ACCION','PARTICIPACION','CLOSED')),
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  closed_at         TIMESTAMPTZ,
  n_participants_active INTEGER DEFAULT 0,
  n_dialogue_packets INTEGER DEFAULT 0,
  saturation_reached BOOLEAN DEFAULT false,
  saturation_index  FLOAT DEFAULT 0.0,
  consensus_reached BOOLEAN DEFAULT false,
  active_agents     TEXT[],
  PRIMARY KEY (project_id, cycle_id)
);

-- ============================================================
-- Participants: Registration & Consent
-- ============================================================
CREATE TABLE participants (
  participant_id    TEXT PRIMARY KEY,          -- Telegram user ID
  project_id        UUID REFERENCES projects(project_id),
  display_name      TEXT,                      -- pseudonym chosen by participant
  consent_given     BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  invite_token      TEXT UNIQUE,               -- for invitation links
  status            TEXT DEFAULT 'invited' CHECK (status IN ('invited','active','completed','withdrawn')),
  registered_at     TIMESTAMPTZ DEFAULT NOW(),
  first_message_at  TIMESTAMPTZ,
  last_message_at   TIMESTAMPTZ
);

-- ============================================================
-- Dialogue: Per-turn structured data
-- ============================================================
CREATE TABLE dialogue_turns (
  turn_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id    TEXT NOT NULL,
  project_id        UUID REFERENCES projects(project_id),
  cycle_id          INTEGER DEFAULT 1,
  turn_number       INTEGER NOT NULL,
  user_text         TEXT NOT NULL,
  val_response      TEXT NOT NULL,
  emotional_register TEXT,
  speech_act        TEXT,
  topics            TEXT[],
  directive_applied TEXT,                     -- WoZ directive content if applied
  latency_ms        INTEGER,                 -- VAL response time
  timestamp         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dialogue_states (
  participant_id    TEXT NOT NULL,
  project_id        UUID REFERENCES projects(project_id),
  cycle_id          INTEGER DEFAULT 1,
  turn_count        INTEGER DEFAULT 0,
  emotional_register TEXT DEFAULT 'Neutral',
  momentum_score    FLOAT DEFAULT 0.5,
  topics_covered    TEXT[],
  topics_pending    TEXT[],
  active_directive_id TEXT,
  safe_harbor_active BOOLEAN DEFAULT false,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','timed_out','closed','withdrawn')),
  last_turn_at      TIMESTAMPTZ,
  PRIMARY KEY (participant_id, project_id, cycle_id)
);

-- ============================================================
-- Wizard of Oz: Expert Directives
-- ============================================================
CREATE TABLE wizard_directives (
  id                TEXT PRIMARY KEY,
  participant_id    TEXT NOT NULL,
  project_id        UUID,
  content           TEXT NOT NULL,
  urgency           TEXT DEFAULT 'MEDIUM',
  status            TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPLIED','DEFERRED','EXPIRED')),
  issued_by         TEXT DEFAULT 'human_investigator',
  applied_at        TIMESTAMPTZ,
  effect_summary    TEXT,                    -- how VAL used it
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Outbox pattern for distributed compensation (V3.1)
-- ============================================================
CREATE TABLE outbox (
    id SERIAL PRIMARY KEY,
    envelope_id UUID NOT NULL,
    topic TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

-- ============================================================
-- Data Gaps: Knowledge holes detected by agents
-- ============================================================
CREATE TABLE data_gaps (
  gap_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES projects(project_id),
  cycle_id          INTEGER,
  constructo        TEXT NOT NULL,
  agent_id          TEXT NOT NULL,
  cycles_open       INTEGER DEFAULT 1,
  status            TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DEAD_END','OUT_OF_SCOPE')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Post-pilot feedback
-- ============================================================
CREATE TABLE pilot_feedback (
  feedback_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id    TEXT NOT NULL,
  project_id        UUID REFERENCES projects(project_id),
  question_key      TEXT NOT NULL,           -- e.g. 'nps', 'espejo_useful', 'would_recommend'
  response_text     TEXT,
  response_score    INTEGER,                 -- 1-10 scale
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indices
-- ============================================================
CREATE INDEX idx_dialogue_states_project ON dialogue_states(project_id, cycle_id);
CREATE INDEX idx_dialogue_states_status ON dialogue_states(status) WHERE status = 'active';
CREATE INDEX idx_dialogue_turns_participant ON dialogue_turns(participant_id, project_id);
CREATE INDEX idx_dialogue_turns_ts ON dialogue_turns(timestamp);
CREATE INDEX idx_data_gaps_open ON data_gaps(project_id) WHERE status = 'OPEN';
CREATE INDEX idx_participants_project ON participants(project_id);
CREATE INDEX idx_participants_invite ON participants(invite_token);
CREATE INDEX idx_wizard_directives_pending ON wizard_directives(participant_id, status) WHERE status = 'PENDING';
