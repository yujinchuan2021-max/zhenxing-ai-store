# Workflow reviewer service identity candidate

## Scope and fixed identity

This candidate adds one internal Identity subject only for the Workflow S2S
reviewer actor. It is not a person, login account, public profile, or browser
principal. The only production reviewer identity is RFC 4122 UUIDv5 using the
DNS namespace `6ba7b810-9dad-11d1-80b4-00c04fd430c8` and the fixed governance
name `zhenxing-ai/service-identity/workflow-reviewer/v1`:

```text
5f16d5ac-6663-5905-b920-c2140ac6769c
```

The acceptance-only `22222222-2222-4222-8222-222222222222` value is never
accepted, mapped, or retained by this contract.

## Candidate migration and record shape

Apply `identity/migrations/candidates/0002-workflow-reviewer-service-identity.sql`
explicitly after `identity/schema.sql`, before provisioning, and only from a
separately authorized migration/cutover job. It is not referenced by
`identity/schema.sql`, normal Identity startup, or Compose.

The migration adds a constrained `users.identity_kind`. Existing rows are
`person`; the one service row is exactly:

```text
id                  5f16d5ac-6663-5905-b920-c2140ac6769c
identity_kind       workflow-reviewer-service
status              disabled
email/phone         NULL
password_hash       NULL
username            __workflow_reviewer_service__
community_username  zx_5f16d5ac66635905b920c2140ac
```

The technical username is only a legacy non-null database value. The disabled
row has no `community_profiles` record, so it is absent from public profile,
search, follower, direct-message, and Flarum identity projections. Existing
Identity login and session views require `status='active'` and a profile.

The migration also rejects profile, avatar, device, session, community-handoff,
and email-change rows for this identity. It therefore cannot receive a password,
email, SMTP flow, session, cookie, bearer handoff, or browser-visible profile.
The S2S reviewer secret remains a file-only deployment authority; it is neither
stored in this row nor emitted by this module.

## Provision, verify, and retention contract

`identity/workflow-reviewer-service-identity.cjs` is the only Identity seam:

- `provisionWorkflowReviewerServiceIdentity(pool)` inserts the exact row in a
  transaction or returns an idempotent exact match. An absent/mismatched row or
  any forbidden browser relation fails closed.
- `verifyWorkflowReviewerServiceIdentity(pool)` checks the exact row and that
  no forbidden relation exists. It returns only the fixed internal ID.
- `rollbackProvisionedWorkflowReviewerServiceIdentity(pool, receipt)` accepts
  only the opaque receipt from an insertion in the same Node cutover process.
  The receipt is process-local, not serialised, logged, exposed through HTTP,
  or usable as a bearer credential. A pre-existing matching row has no receipt
  and cannot be deleted by a later run.

Rollback first verifies the exact service row and reads both
`community_workflow.events` and `community_workflow.idempotency` when present.
With zero references, it removes the row. With any reference it returns
`WORKFLOW_REVIEWER_SERVICE_IDENTITY_RETENTION_REQUIRED`; the row and Workflow
audit history remain. Emergency-disable only turns capabilities off and keeps
the identity. The schema rollback file also refuses while the service row
exists.

## Backend/deployment closure

The deployment candidate now pins image
`zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392`, image ID
`sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567`,
to the frozen 64-input source digest
`19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c`.
The candidate migration is still absent from runtime startup; only the
manifest-controlled one-shot provision role may apply it.

The cutover process retains the `receipt` object in the same held Node process:

1. apply and verify the Identity service-identity candidate migration;
2. call provision and exact verify;
3. run the separately owned Workflow schema migration and reviewer-secret
   contract check;
4. on a failure before any Workflow reference, call rollback with that same
   receipt; after a reference, emergency-disable and restore only from the
   verified database recovery path.

Preflight/report allowlist may include only booleans and fixed digests such as
`reviewerIdentityPresent`, `reviewerIdentityExact`, `reviewerIdentityCreated`,
`reviewerIdentityRetained`, migration manifest SHA, image digest, and error
code. It must not contain the reviewer UUID, username, SQL, DSN, secret,
receipt, session, or raw database rows.

The local real-Docker provision regression now proves read-only preflight,
conflict rejection, zero-event rollback, commit, and written-event retention.
The final runner-owned Flarum/Identity/PostgreSQL acceptance also passes with
the new image. These do not replace independent test/release A-E or authorize a
server cutover.

## Evidence boundary

`node scripts/test-workflow-reviewer-service-identity-pg.cjs` starts a fresh
private PostgreSQL container, applies the Identity schema and candidate
migration, and verifies provision/repeat/conflict/rollback/retention behavior.
It cleans the exact temporary container and network. This is isolated candidate
evidence only; it does not enable Compose/runtime, connect to production, or
authorize a server cutover.
