-- Candidate rollback. Requires separate approval and a verified backup/restore point.
BEGIN;
DROP SCHEMA IF EXISTS community_workflow CASCADE;
COMMIT;
