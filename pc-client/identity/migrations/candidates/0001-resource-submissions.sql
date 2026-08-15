-- Candidate only. Do not add this file to schema.sql or the runtime migration
-- entrypoint until isolated backup, apply, authorization, rollback and restore
-- acceptance has been recorded.
BEGIN;

CREATE TABLE resource_submissions (
  submission_id UUID PRIMARY KEY,
  owner_identity_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  status TEXT NOT NULL CHECK (
    status IN (
      'draft',
      'submitted',
      'triaged',
      'needs-evidence',
      'accepted',
      'rejected',
      'withdrawn',
      'merged'
    )
  ),
  dedupe_fingerprint TEXT NOT NULL,
  record JSONB NOT NULL CHECK (jsonb_typeof(record) = 'object'),
  public_eligible BOOLEAN NOT NULL DEFAULT false,
  retention_until TIMESTAMPTZ,
  redacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX resource_submissions_owner_updated_idx
  ON resource_submissions (owner_identity_id, updated_at DESC, submission_id DESC);
CREATE INDEX resource_submissions_dedupe_idx
  ON resource_submissions (dedupe_fingerprint)
  WHERE status <> 'merged';
CREATE INDEX resource_submissions_retention_idx
  ON resource_submissions (retention_until)
  WHERE retention_until IS NOT NULL AND redacted_at IS NULL;

CREATE TABLE resource_submission_idempotency (
  owner_identity_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key_hash CHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  submission_id UUID NOT NULL REFERENCES resource_submissions(submission_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_identity_id, idempotency_key_hash)
);

CREATE TABLE resource_submission_audit (
  event_id BIGSERIAL PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES resource_submissions(submission_id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  actor_identity_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('owner', 'reviewer', 'retention-service')),
  action TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (submission_id, revision, action)
);

CREATE INDEX resource_submission_audit_submission_idx
  ON resource_submission_audit (submission_id, event_id);

CREATE TABLE resource_submission_source_revisions (
  submission_id UUID NOT NULL REFERENCES resource_submissions(submission_id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  actor_identity_id TEXT NOT NULL,
  source JSONB NOT NULL CHECK (jsonb_typeof(source) = 'object'),
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (submission_id, revision)
);

CREATE TABLE resource_submission_abuse_reports (
  report_id UUID PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES resource_submissions(submission_id) ON DELETE RESTRICT,
  reporter_identity_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_identity_id TEXT
);

CREATE INDEX resource_submission_abuse_reports_status_idx
  ON resource_submission_abuse_reports (status, created_at);

COMMIT;
