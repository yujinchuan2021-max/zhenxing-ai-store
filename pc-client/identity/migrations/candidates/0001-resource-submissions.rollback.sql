-- Candidate rollback. Run only against the same isolated database immediately
-- after validating that no retained submission data must be preserved.
BEGIN;

DROP TABLE resource_submission_abuse_reports;
DROP TABLE resource_submission_source_revisions;
DROP TABLE resource_submission_audit;
DROP TABLE resource_submission_idempotency;
DROP TABLE resource_submissions;

COMMIT;
