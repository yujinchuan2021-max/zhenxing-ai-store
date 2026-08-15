# Resource Submission Backend Candidate Contract

## Facts and ownership

`admin/resource-submissions.cjs` is the only resource-submission domain model. It
owns the submission kinds, strict proposal whitelist, status transitions,
revision conflicts, audit events, de-duplication, contributor attribution and
candidate-only catalog merge projection. Identity must call those exported
normalization and transition functions; it must not define a second status
machine.

Identity owns the authenticated user, owner-scoped persistence, rate-limit seam
and the private “我的投稿” API. Admin owns review, de-duplication decisions,
accept/reject/merge and candidate generation. Neither side receives catalog
publish authority from a submission. Community continues to own workflow drafts
and releases; a workflow submission contains only an exact verified
`{workflowId, version}` release reference.

## Candidate implementation

`identity/resource-submissions.cjs` supplies two adapters:

- `createResourceSubmissionOwnerAdapter`: derives the immutable owner ID and
  current display-name snapshot from the Identity access session. Every detail,
  list and mutation query is owner-scoped. A changed display name never changes
  `submittedByIdentityId` or contributor attribution. It rebuilds every response
  as the explicit `OwnerSubmission` allowlist: submission ID, expected revision,
  canonical status, editable proposal, evidence-needed state and server-derived
  allowed owner actions. It never returns reviewer identity, review status, risk,
  merge target/contributors, audit, internal de-duplication fingerprint or other
  users' possible-duplicate IDs.
- `createResourceSubmissionReviewAdapter`: accepts reviewer identity only from
  a server-to-server authenticator. The fixed-secret candidate uses constant-time
  comparison and requires at least 32 bytes. Request bodies are exact-whitelisted;
  `reviewerId` in a client body is rejected.

No reviewer route is mounted on the Identity user HTTP server. The Admin service
must own the future internal route and inject an authenticated reviewer identity
into the review adapter. Production should replace the fixed shared secret with
managed service credentials and rotation without changing the adapter contract.

`OwnerSubmission` and Community's `PublicContributionCard` are different DTOs
on different seams. The private owner adapter cannot return the public review/
risk/contribution projection; the public read model cannot be reused as an owner
edit form or mutation result.

The owner HTTP candidate is:

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/v1/resource-submissions/capability` | Read-only capability; no login required. |
| `POST` | `/v1/me/resource-submissions` | Idempotent draft create; requires `Idempotency-Key`. |
| `GET` | `/v1/me/resource-submissions?offset=&limit=` | Only the current user's records, maximum page size 100. |
| `GET` | `/v1/me/resource-submissions/:submissionId` | Only the current user's record; cross-owner lookup is `404`. |
| `POST` | `/v1/me/resource-submissions/:submissionId/actions` | Exact owner actions `update`, `submit`, `evidence`, `withdraw` with `expectedRevision`. |

The Electron Identity client and main/preload candidate expose only the fixed
owner methods. Main re-checks the current Identity session on every owner call;
preload rejects unknown, unsafe, oversized and prototype-polluted payloads, and
the client stops before owner HTTP when capability is disabled. There is still
no renderer form or enabled client entry, so the existing entry remains unable
to submit.

## Persistence and migration boundary

The PostgreSQL candidate stores one canonical JSON record plus indexed immutable
owner, revision, status and de-duplication fields. Idempotency keys are stored only
as SHA-256 digests and are bound to a normalized request hash. Audit events are
append-only rows. Abuse reports are separate moderation input and do not add a
submission status.

Migration candidates are deliberately outside `identity/schema.sql`:

- `identity/migrations/candidates/0001-resource-submissions.sql`
- `identity/migrations/candidates/0001-resource-submissions.rollback.sql`

They are not referenced by the runtime or production migration entrypoint. Do
not apply them to production. Before enabling, an isolated PostgreSQL database
must prove backup, apply, owner/S2S authorization, concurrency conflict,
rollback, restore and row/hash reconciliation. The apply candidate uses
`ON DELETE RESTRICT` for retained submission/audit ownership; rollback is only
valid after confirming that candidate data may be discarded.

## Security and lifecycle seams

- Accepted fields remain the whitelist in `admin/resource-submissions.cjs`.
  `command`, `args`, `env`, `headers`, `credentials`, `script`, `secret`, arbitrary
  executable endpoint/path and generic URL fields are rejected. Canonical source,
  evidence and ownership proof are exact HTTPS URLs without credentials or
  fragments.
- Host relationships are exact data-only objects
  `{kind:'resource', canonicalId, hostProductId, bindingKind}`. Canonical IDs use
  the fixed ID pattern and `bindingKind` is limited to the six approved resource
  binding semantics; free-form host tuple strings, endpoints and paths are rejected.
- Creation and mutation call an injected rate limiter. The local candidate is a
  fixed-window limiter; production enablement requires a shared limiter and abuse
  monitoring across service replicas.
- Users may withdraw; they cannot hard-delete audit history through “我的投稿”.
  Privacy deletion/retention is a separate Identity retention-service seam using
  `retention_until`/`redacted_at`, legal policy, export coverage and append-only
  audit. No deletion worker or public deletion route exists in this candidate.
- Ownership claims preserve `originalAuthorIdentityId`, display author,
  organization and first-party HTTPS evidence as distinct facts. Claims never
  self-approve. Merge adds immutable submitter identity IDs to `contributors` and
  audits both source and target, so later display-name changes do not erase credit.
- Abuse reports have their own table and rate limit. Resolution is reviewer-side;
  a report does not grant reviewer rights or change submission state by itself.
- A workflow proposal is rejected until an exact release lookup is connected.
  `createAsyncWorkflowReleaseValidator` awaits the exact
  `{workflowId, version}` lookup and accepts only the literal result `true`.
  A false/undefined result, rejected lookup, timeout, or resolver misuse fails
  closed. The legacy synchronous validator also accepts only literal `true`, so
  returning a Promise cannot bypass validation. Owner updates, reviewer accept,
  setting public eligibility to true, and catalog merge candidate generation
  revalidate the current exact release. Other submission kinds never call this
  resolver.
- The current Identity server explicitly sets
  `workflowSubmissionLookupEnabled:false`. The capability therefore continues
  to list `workflow` as temporarily unavailable. Enabling the candidate requires
  an authorized Community DB resolver plus its deployment and audit approval;
  no production/local Compose, HTTP route, schema migration, or secret is wired.

## Default-disabled gate

Capability remains `enabled:false` unless both
`AIHUB_RESOURCE_SUBMISSIONS_ENABLED=1` and
`AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION=1` are set. No deployment file sets
either value. Enabling is forbidden until the isolated migration, rollback,
authorization and rate-limit gates above pass. Candidate records never call
`saveDraft`, publish, package, upload or modify catalog/state.

## Revision source and public-read boundary

Every creation, owner proposal update, and owner evidence addition appends an
immutable `sourceSnapshots` entry. Its allowlist is canonical source,
original-author identity/name/organization, license, evidence and discovery
references, workflow reference, catalog/host references, revision, time, and
actor identity. It excludes commands, credentials, headers, endpoints, paths,
and secret values. The candidate migration adds the append-only
`resource_submission_source_revisions` table; it remains outside runtime
migrations.

`publicEligibility` defaults to `false`. Only the fixed S2S review adapter may
issue `set-public-eligibility`; it can set `true` only for accepted,
automated/manual-reviewed, low/guarded records with a source snapshot and a
license. Accept, reject, merge, and non-public review transitions keep or reset
it to `false`. The candidate-only catalog merge object includes the exact
`sourceRevisionRef` instead of deriving provenance from the current proposal.

Owner and public DTOs are deliberately separate. The owner adapter exposes only
`submissionId`, `expectedRevision`, `status`, editable proposal,
`allowedActions`, and `evidenceRequired`; it omits reviewer/risk/merge/audit and
dedupe data. `createResourceSubmissionAdminReviewSeam` is an unmounted,
default-disabled Admin-only adapter to the Identity S2S review adapter. It has
no client reviewer field, route, or configured secret. Community must build its
own read-only public card from canonical records only when an independent
Admin eligibility adapter returns literal `true`.
