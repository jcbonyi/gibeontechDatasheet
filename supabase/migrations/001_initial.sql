-- Run migrations in order in the Supabase SQL Editor:
-- 1. supabase/migrations/001_initial.sql
-- 2. supabase/migrations/002_roles_assignment_audit.sql

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Assessor')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS datasheets (
  id SERIAL PRIMARY KEY,
  serial_no TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  claim_no TEXT,
  reg_no TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datasheets_claim_no ON datasheets (claim_no);
CREATE INDEX IF NOT EXISTS idx_datasheets_reg_no ON datasheets (reg_no);
CREATE INDEX IF NOT EXISTS idx_datasheets_status ON datasheets (status);
CREATE INDEX IF NOT EXISTS idx_datasheets_created_by ON datasheets (created_by);
