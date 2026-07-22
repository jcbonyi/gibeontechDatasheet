-- Add Assignment field on production entries (between Reg No and Amount)
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS assignment TEXT;
