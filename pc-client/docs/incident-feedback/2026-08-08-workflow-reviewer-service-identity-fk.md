# Workflow reviewer service identity FK preflight block

## Symptom and evidence

Server-side Workflow preflight stopped before any remote write because
`public.users` had no rows while `community_workflow.events.actor_identity_id`
and `community_workflow.idempotency.actor_identity_id` reference `public.users`.
The production overlay required a reviewer UUID but had no governed service
identity provision, verification, or retention contract.

## Root cause and candidate fix

An acceptance fixture reviewer UUID had been mistaken for an available
production actor. It cannot be reused: it is not a server identity and its row
shape includes acceptance credentials. The candidate now defines one disabled,
non-login, no-email, no-password `workflow-reviewer-service` Identity row with
a fixed governance-derived UUID. Candidate database constraints and triggers
keep it out of profiles, sessions, devices, browser handoffs, avatars, and
email-change flows. Provision is idempotent only for the exact record; any
collision fails closed.

Rollback is intentionally narrower than a database restore: the same cutover
process may delete only a service row it inserted and only while both Workflow
reference tables have zero rows. Once an event or idempotency reference exists,
the service identity remains as audit retention and emergency-disable leaves
both it and Workflow records intact.

## Deployment closure and verification

The fresh PostgreSQL candidate script proves apply, provision, exact verify,
repeat provision, mismatched-row rejection, forbidden browser-relation
rejection, zero-reference rollback, and reference-retention refusal. It does
not change the normal schema/runtime/Compose path.

Deployment now uses one held Identity-image provision process. It validates the
Identity-only reviewer secret, applies and verifies the candidate Identity
migration, provisions/verifies the exact row, applies/verifies Workflow schema,
and retains the opaque creation receipt until cutover sends `commit` or
`rollback`. A closed pipe, timeout, conflict, partial schema, or later cutover
failure is fail-closed. Zero-event rollback removes only this run's additions;
written Workflow data forces retention and emergency-disable.

The new local immutable image is
`zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392`, image ID
`sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567`,
with source digest
`19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c`.
A real PostgreSQL Docker regression proved zero-event rollback, commit, and
written-event retention. This is still candidate evidence: a new independent
full-stack review and new cutover authorization are required. No server upload,
migration, secret issuance, or cutover occurred.
