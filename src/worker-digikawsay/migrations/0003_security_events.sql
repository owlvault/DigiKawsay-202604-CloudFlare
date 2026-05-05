-- Migration: Security Events audit table
-- 2026-05-03: Anti-prompt injection defense layer

CREATE TABLE IF NOT EXISTS security_events (
  event_id        TEXT PRIMARY KEY,
  event_type      TEXT NOT NULL, -- 'PROMPT_INJECTION', 'RATE_LIMIT', 'JAILBREAK_ATTEMPT', 'AUTH_FAILURE', 'WEBHOOK_INVALID', 'MESSAGE', 'OUTPUT_LEAK'
  participant_id  TEXT,
  severity        TEXT DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  details         TEXT, -- JSON string con metadata sanitizada (nunca el payload raw)
  user_input_hash TEXT, -- SHA-256 del input para correlación sin almacenar el texto
  action_taken    TEXT DEFAULT 'ALLOWED' CHECK (action_taken IN ('ALLOWED', 'FLAGGED', 'BLOCKED', 'RATE_LIMITED')),
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_participant ON security_events(participant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_time ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
