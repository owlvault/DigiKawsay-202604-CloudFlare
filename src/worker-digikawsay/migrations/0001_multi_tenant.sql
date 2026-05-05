-- 1. Create new tables
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

-- 2. Insert Default Tenant
INSERT INTO tenants (tenant_id, name) VALUES ('default-tenant-id', 'DigiKawsay Default') ON CONFLICT DO NOTHING;

-- 3. Update Projects to have tenant_id
ALTER TABLE projects ADD COLUMN tenant_id TEXT REFERENCES tenants(tenant_id);
UPDATE projects SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL;

-- 4. Update Administrators
ALTER TABLE administrators ADD COLUMN tenant_id TEXT REFERENCES tenants(tenant_id);
UPDATE administrators SET role = 'SUPERADMIN', tenant_id = 'default-tenant-id';

-- 5. Handle Participants table modification
-- SQLite requires table recreation to change Primary Key
CREATE TABLE participants_new (
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

-- Insert existing participants
INSERT INTO participants_new (participant_id, project_id, display_name, consent_given, consent_timestamp, invite_token, status, registered_at, first_message_at, last_message_at)
SELECT participant_id, project_id, display_name, consent_given, consent_timestamp, invite_token, status, registered_at, first_message_at, last_message_at FROM participants;

DROP TABLE participants;
ALTER TABLE participants_new RENAME TO participants;

CREATE INDEX IF NOT EXISTS idx_participants_project ON participants(project_id);
CREATE INDEX IF NOT EXISTS idx_participants_invite ON participants(invite_token);

-- Migrate existing participants to users table
INSERT INTO users (user_id, tenant_id, display_name)
SELECT DISTINCT participant_id, 'default-tenant-id', display_name 
FROM participants
WHERE participant_id NOT LIKE 'pending_%'
ON CONFLICT DO NOTHING;
