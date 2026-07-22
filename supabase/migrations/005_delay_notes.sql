-- Delay notes: reasons for SLA / ageing delay on a datasheet
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS delay_notes JSONB NOT NULL DEFAULT '[]'::jsonb;
