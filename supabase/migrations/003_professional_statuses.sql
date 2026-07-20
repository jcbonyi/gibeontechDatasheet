-- Professional motor assessment firm task statuses
-- Migrate legacy: draft→instructed, submitted→pending_review, approved→report_issued

ALTER TABLE datasheets DROP CONSTRAINT IF EXISTS datasheets_status_check;

UPDATE datasheets SET status = 'instructed' WHERE status = 'draft';
UPDATE datasheets SET status = 'pending_review' WHERE status = 'submitted';
UPDATE datasheets SET status = 'report_issued' WHERE status = 'approved';

ALTER TABLE datasheets ADD CONSTRAINT datasheets_status_check
  CHECK (status IN (
    'instructed',
    'allocated',
    'in_progress',
    'awaiting_documents',
    'pending_review',
    'under_review',
    'queried',
    'report_issued',
    'on_hold',
    'closed',
    'cancelled',
    -- keep legacy values briefly for any race during deploy
    'draft',
    'submitted',
    'approved'
  ));

-- Tighten after data migration (run once confirmed):
-- ALTER TABLE datasheets DROP CONSTRAINT datasheets_status_check;
-- ALTER TABLE datasheets ADD CONSTRAINT datasheets_status_check
--   CHECK (status IN (
--     'instructed','allocated','in_progress','awaiting_documents',
--     'pending_review','under_review','queried','report_issued',
--     'on_hold','closed','cancelled'
--   ));
