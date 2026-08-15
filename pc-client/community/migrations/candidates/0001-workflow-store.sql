-- Candidate only. Apply only through a separately authorized, explicit job.
-- Do not add this file to identity/schema.sql, either runtime entrypoint, or Compose.
BEGIN;

CREATE SCHEMA community_workflow;

CREATE TABLE community_workflow.event_head (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  last_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_sequence >= 0)
);

INSERT INTO community_workflow.event_head (singleton, last_sequence) VALUES (true, 0);

CREATE TABLE community_workflow.events (
  sequence BIGINT PRIMARY KEY CHECK (sequence >= 1),
  operation TEXT NOT NULL CHECK (
    operation IN (
      'createDraft',
      'updateDraft',
      'submitDraft',
      'withdrawDraft',
      'attachPostReference',
      'detachPostReference',
      'reviewSubmission',
      'unlist',
      'reportRelease',
      'resolveReport'
    )
  ),
  actor_identity_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  event_data JSONB NOT NULL CHECK (jsonb_typeof(event_data) = 'object'),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE community_workflow.idempotency (
  actor_identity_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  key_hash CHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response JSONB NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  event_sequence BIGINT NOT NULL REFERENCES community_workflow.events(sequence) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_identity_id, key_hash)
);

CREATE FUNCTION community_workflow.reject_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'community workflow events are append-only';
END;
$$;

CREATE TRIGGER community_workflow_events_append_only
BEFORE UPDATE OR DELETE ON community_workflow.events
FOR EACH ROW EXECUTE FUNCTION community_workflow.reject_event_mutation();

COMMIT;
