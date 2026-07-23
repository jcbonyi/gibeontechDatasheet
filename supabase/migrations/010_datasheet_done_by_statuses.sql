-- Done By on datasheets + first-class Submitted / Approved statuses
ALTER TABLE datasheets ADD COLUMN IF NOT EXISTS done_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_datasheets_done_by ON datasheets (done_by);

ALTER TABLE datasheets DROP CONSTRAINT IF EXISTS datasheets_status_check;
ALTER TABLE datasheets ADD CONSTRAINT datasheets_status_check
  CHECK (status IN (
    'instructed', 'allocated', 'in_progress', 'awaiting_documents',
    'submitted', 'pending_review', 'under_review', 'approved', 'queried', 'report_issued',
    'on_hold', 'closed', 'cancelled'
  ));
