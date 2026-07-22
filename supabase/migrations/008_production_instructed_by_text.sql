-- Instructed By as free text (not a user dropdown)
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS instructed_by TEXT;
