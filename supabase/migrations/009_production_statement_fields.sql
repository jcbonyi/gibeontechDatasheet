-- Statement / billing fields for production entries
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS fee_note_no TEXT;
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS insured TEXT;
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS claim_policy_number TEXT;
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS paid_status TEXT DEFAULT 'unpaid';

UPDATE production_entries SET paid_status = 'unpaid' WHERE paid_status IS NULL OR paid_status = '';
