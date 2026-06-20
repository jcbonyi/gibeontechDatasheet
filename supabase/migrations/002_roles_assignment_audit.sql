-- Roles, assignment, extended status workflow, and audit trail

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Admin', 'PrincipalOfficer', 'OperationsManager', 'Assessor'));

ALTER TABLE datasheets DROP CONSTRAINT IF EXISTS datasheets_status_check;
ALTER TABLE datasheets ADD CONSTRAINT datasheets_status_check
  CHECK (status IN ('draft', 'submitted', 'under_review', 'approved'));

ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS reopen_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_datasheets_assigned_to ON datasheets (assigned_to);

CREATE TABLE IF NOT EXISTS datasheet_audit (
  id SERIAL PRIMARY KEY,
  datasheet_id INTEGER NOT NULL REFERENCES datasheets(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_datasheet ON datasheet_audit (datasheet_id);
