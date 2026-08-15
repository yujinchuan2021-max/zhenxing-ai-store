# Workflow official bootstrap replay and durable namespace evidence

Date: 2026-08-10

## Symptom and evidence

The independent r10 D acceptance report proved the first official bootstrap
created nine events, but the runner only queried `community_workflow.events`.
It wrote a fixed idempotency count into its report, did not query the singleton
event head, and did not replay the same official bootstrap before unlisting.
That left idempotency drift, event-head drift, and replay writes unproven.

The durable launcher also still used the already-reserved r9 run, system-unit,
control-root, and evidence-root names even though the candidate was r10.

## Root cause

The runner treated a single event-table count as a proxy for all append-only
state. The launcher name was copied forward rather than treated as a fixed,
single-use production namespace.

## Fix and prevention gate

The manifest-controlled runner now independently reads only the allowlisted
counts: events, idempotency rows, singleton event-head rows, and last sequence.
It requires 9/9/9 after the first bootstrap, runs the same fixed one-shot a
second time and again requires 9/9/9 with the same three workflow references,
then requires 12/12/12 after the three unlists and an empty public list. The
report records only those fixed counts and booleans; it contains no SQL,
identifiers, credentials, paths, or raw responses.

The durable launcher is fixed to the previously unused r10 namespace:
`workflow-production-r10`,
`zhenxing-ai-workflow-production-r10.service`, and matching r10 control and
evidence roots. It remains single-use, system-managed, and clean-environment
only; names are not dynamically generated and r9 is not reused.

Focused red tests cover idempotency/event-head drift despite nine events, the
missing replay, and r9 namespace rejection. The replacement still requires a
fresh true-Linux, systemd/HUP, D, and four-quadrant local acceptance run before
independent Test/Release review. This is candidate-only and not production
authorization.

## Exact-volume cleanup and cutover-fixture P0/P1

The first r10 D report incorrectly claimed complete cleanup after a runner
project left its three manually-created Caddy volumes behind. Those volumes
have no Compose label, so label-only inspection was insufficient; an ignored
`docker volume rm` failure could also be mistaken for absence.

The runner now deletes only its three fixed, project-derived Caddy volume
names, then performs one read-only `docker volume ls --format {{.Name}}` and
requires each exact full name to be absent. A failed delete, a surviving exact
name, or a failed Docker control-plane enumeration makes cleanup incomplete and
prevents PASS. No glob, prune, or unrelated volume is inspected or removed.
The original three unreferenced runner volumes were independently checked and
then removed by exact name only.

The cutover-origin fixture now carries the same two verified rollback archive
slots required by the production cutover: the prior Identity archive and prior
Admin archive. Its mock also supplies the exact ID, source/release label, and
`node` user values required by the existing archive load gates. This repairs
fixture drift; it neither relaxes nor bypasses production archive verification.
