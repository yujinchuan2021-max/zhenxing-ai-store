# Workflow production bootstrap wrapper rejected the canonical two-file call

## Symptom and production evidence

The authorized r5 durable unit reached the fixed production bootstrap wrapper,
then failed closed and the unchanged cutover trap restored the exact prior
state. The production Compose resolver had correctly returned the canonical
base plus Workflow overlay. Cutover therefore passed three fixed positional
values followed by two Compose files, for five wrapper arguments in total.
The wrapper rejected this valid call before entering its structured-report
boundary because its top-level guard incorrectly required at least six.

The retained r5 receipt SHA-256 prefix is `e64e`, terminal-status SHA-256
prefix `02cb`, evidence-tree SHA-256 prefix `69b676`, and verified backup
control SHA-256 prefix `2db400`. Production remained on exact active6, the
prior Admin and Identity images, the preexisting Workflow schema and disabled
reviewer service identity, zero events/idempotency and event-head sequence
zero, with all six Workflow flags disabled. The r5 call is not retryable and
r5 is obsolete. No server was connected or written while implementing r6.

## Root cause and excluded hypotheses

The production resolver contract was not wrong: production owns exactly the
canonical `compose.server.yaml` then `compose.workflow-production.yaml` pair.
The five-file form belongs only to the independently double-gated Windows
acceptance harness. The defect was a stale numeric arity assumption in
`workflow-official-bootstrap-production-wrapper.cjs`; earlier isolated C runs
always supplied five Compose files and therefore did not exercise the valid
five-argument production branch.

Fresh C then exposed a second test-shape issue after the arity fix. A second
two-file wrapper invocation correctly passed arguments, preflight and active7
catalog verification, but Compose `run` tried to reconcile dependencies that
were already running under the Windows-only five-file fixture. Production
cutover verifies every dependency healthy before bootstrap. Recreating those
services is neither required nor desirable, so the fixed one-shot uses the
standard Compose `--no-deps` option. This does not skip any Workflow step or
weaken readiness, rollback, d6/v2, public-host or image verification.

## Fix

The wrapper now enters its report boundary with a valid evidence directory,
parses five or more arguments, and then accepts only one of two enumerated
forms:

- production: exactly the canonical base and Workflow overlay, in that order,
  with no acceptance control variables;
- isolated acceptance: exactly those two files followed by the canonical
  Windows, ports and Caddy overrides, in order, whose canonical paths must
  match the approved five-line list and direct-child acceptance root.

Zero/one Compose file, unknown files, duplicates, order drift, missing control,
symlinks and any other acceptance mode fail at the argument stage. Argument
and later preflight failures write only the fixed allowlisted report schema;
raw errors, URLs, paths, credentials and secret values are not recorded. The
production one-shot runs with `--no-deps` only after the existing cutover
health gates.

The runner-owned C fixture separately invokes the real wrapper with the exact
production five-argument shape and the same post-cutover active7 Admin
environment that the production shell exports. It does not enable the isolated
wrapper branch. The real idempotent one-shot must leave exactly three official
Workflows and 9/9 events/idempotency rows.

## Automated verification and remaining gate

TDD first reproduced the missing structured report and invalid arity rejection.
It then covered the exact production pair, the canonical controlled five-file
branch and rejection of zero/one/unknown/duplicate/order-drifted inputs. A
separate red/green gate prevents the one-shot from reconciling already-healthy
dependencies. The final related Node run passes 114/114, all changed CJS files
pass `node --check`, all deployment shell files pass `bash -n`, and the frozen
manifest verifies.

The r6 deployment set is
`7cb5dcc7ba394262e9b76f3decc114a8d674485473d16db9dde102c620c25ec7`;
`manifest.json` SHA-256 is
`de4f6693021c40aebd140f6d92e724efda80d1ae0980cc501ae71710cb8b11f7`.
The fresh true-Linux preparation report is
`output/workflow-production-release-bundle-linux-7b100a977f/report.json`;
it passes all eleven failure cases with zero container/volume residue and no
server/catalog mutation. The fresh true-systemd report is
`output/workflow-production-durable-cutover-linux-3751965900/report.json` and
proves the fixed r6 unit survives caller/HUP termination and rejects a repeat
launch.

The fresh production-shaped result is
`output/workflow-production-release-bundle-cutover-88f19879d5/report.json`
(SHA-256
`332863d73fe5375e3671b7ec5e75283daf49cc126e8297245be0653fa34ebdd7`).
Its success report SHA-256 is
`7f718c6b555cf27be51bc3f012f8e68e234a172faa61ca019eb6ca36ebb991b6`
and proves the real production two-file wrapper leaves three Workflows and
9/9 rows. Its deliberate-failure report SHA-256 is
`5b70d3f2eac7356cd361443c6a2103d45541eaa9b6608d8c61ad6d97145a0b80`
and proves exact active6/prior-image rollback while preserving the preexisting
schema/reviewer and zero-row state. Both report zero containers, networks,
volumes, private roots and backup residue.

These are local candidate-only results, not production acceptance or
deployment authorization. Test/Release must independently rerun the frozen r6
candidate before any new authorized server unit is launched.

## Prevention gate

Every production-only wrapper must have a test that invokes its exact resolver
output, including the minimum valid positional count. Acceptance-only extra
files may never stand in for that branch. One-shot Compose jobs that follow an
explicit online-service health gate must use `--no-deps`; any attempt to
reconcile dependencies is a test failure. Invalid argument paths must still
produce an allowlisted stage/code report whenever the evidence directory is
valid.
