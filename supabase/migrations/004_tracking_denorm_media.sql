-- Denormalized tracking fields, workflow notes, review sign-off, search, media

ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS date_of_instruction DATE;
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS client_insurer TEXT;
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS form_types TEXT;
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS query_reason TEXT;
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS search_text TEXT;

CREATE INDEX IF NOT EXISTS idx_datasheets_date_of_instruction ON datasheets (date_of_instruction);
CREATE INDEX IF NOT EXISTS idx_datasheets_client_insurer ON datasheets (client_insurer);

UPDATE datasheets SET
  date_of_instruction = NULLIF(form_data->'basicInfo'->>'dateOfInstruction', '')::date,
  client_insurer = NULLIF(form_data->'basicInfo'->>'clientInsurer', ''),
  search_text = lower(trim(both ' ' from concat_ws(' ',
    serial_no,
    claim_no,
    reg_no,
    form_data->'basicInfo'->>'clientInsurer',
    form_data->'basicInfo'->>'ownerInsured',
    form_data->'basicInfo'->>'chassisNo',
    form_data->'basicInfo'->>'engineNo',
    form_data->'basicInfo'->>'policyNo'
  )))
WHERE form_data IS NOT NULL;

CREATE TABLE IF NOT EXISTS media_assets (
  id SERIAL PRIMARY KEY,
  datasheet_id INTEGER REFERENCES datasheets(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_datasheet ON media_assets (datasheet_id);
