-- Production Management System
CREATE TABLE IF NOT EXISTS insurers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_entries (
  id SERIAL PRIMARY KEY,
  production_date DATE NOT NULL,
  insurer_id INTEGER NOT NULL REFERENCES insurers(id),
  registration_number TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  amount_without_vat NUMERIC(14, 2) NOT NULL,
  done_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  seen_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  instructed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_date ON production_entries (production_date);
CREATE INDEX IF NOT EXISTS idx_production_insurer ON production_entries (insurer_id);
CREATE INDEX IF NOT EXISTS idx_production_reg ON production_entries (registration_number);
CREATE INDEX IF NOT EXISTS idx_production_status ON production_entries (status);
CREATE INDEX IF NOT EXISTS idx_production_done_by ON production_entries (done_by_user_id);

CREATE TABLE IF NOT EXISTS production_targets (
  id SERIAL PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_key TEXT NOT NULL,
  target_jobs INTEGER NOT NULL DEFAULT 0,
  target_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_type, period_key)
);

CREATE TABLE IF NOT EXISTS production_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO production_settings (key, value)
VALUES ('vat_rate', '0.16')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON app_notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
