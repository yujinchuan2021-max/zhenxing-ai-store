# Workflow production cutover lifetime depended on the caller session

## Symptom and production evidence

The authorized r4 cutover was invoked once through a foreground client SSH
session. Its business chain reached the fixed temporary acceptance PASS, but
the client connection ended after about 97 seconds. The still-running remote
cutover then received HUP. Its existing `EXIT HUP INT TERM` trap correctly
rolled back rather than reporting success.

The retained production evidence tree is
`/opt/zhenxing-ai/shared/backups/workflow-production-8e7-20260809-evidence/workflow-production-cutover-20260809T063626Z`
(reported tree SHA-256 prefix `4838858a`; the complete value remains in the
retained production receipt). The verified backup is
`/opt/zhenxing-ai/shared/backups/community-production-20260809T063635Z`
(reported control SHA-256 prefix `46b8e457`; the complete value remains in the
retained production receipt). The r4 prepared marker SHA-256 is
`a7b9bffe747d8d6cc9c54f34e334f708a50eaa7525df330af948ac46191f0f49`.
The one call is not retryable.

Post-rollback production remained six-of-six healthy on the exact prior Admin
and Identity images and exact active6 catalog state. The preexisting Workflow
schema and fixed disabled reviewer service identity remained, events and
idempotency were zero, the singleton event head remained zero, and all six
Workflow production flags were disabled. No local evidence in this incident
changes or retries that server state.

## Root cause and excluded hypothesis

The cutover process lifetime was still owned by the foreground session/process
group. When that owner disappeared, HUP was delivered to the long-running
cutover, and the deliberately conservative signal trap treated it as failure.
The retained ordering excludes a business-gate failure as the primary cause:
temporary acceptance had already passed before HUP initiated rollback. The fix
must therefore move process ownership, not ignore HUP or weaken rollback.

## Candidate fix

`workflow-production-cutover-launcher.sh` uses the system service manager's
standard transient-unit seam. It has one fixed r5 run ID, one fixed system unit
and fixed control/evidence roots. Launch atomically claims the run, verifies the
prepared release, records the prepared/deployment/bundle/payload hashes, writes
an allowlisted mode-`0600` environment file, and calls `systemd-run --no-block`
with a clean environment and null standard output/error. It then flushes a
small receipt and returns.

The system-owned worker re-verifies all pinned controls before sourcing the
allowlisted file. It proves its own exact fixed-unit membership through
`/proc/self/cgroup`, calls the unchanged cutover, and atomically writes
`succeeded` or `failed`. An EXIT fallback also writes `failed` for a worker
preflight error, so read-only polling cannot confuse a dead worker with a
queued one. Secret values never enter argv, the unit environment, journal,
request, receipt or status. Existing run/evidence makes repeat or concurrent
launch fail closed. There is no `nohup`, `setsid`, HUP-ignore trap, user unit or
custom daemon.

The cutover signal trap remains unchanged. Its recovery preflight now accepts
exactly two enumerated active6 empty-online states: all six Workflow flags
enabled, or all six disabled after the r4 rollback. Both require the exact old
Admin/Identity image IDs, exact active6 state hash, all six services healthy,
the complete preexisting schema/append-only trigger, zero events and
idempotency, one zero-valued event head, and exactly one disabled reviewer
service identity with zero forbidden relations. Partial flags or any other
state fail before backup/service replacement. Rollback preserves the
preexisting schema/reviewer.

## Automated verification and remaining gate

The true-Linux systemd PID 1 report is
`output/workflow-production-durable-cutover-linux-dfda55dee3/report.json`
(SHA-256
`6d6ef5060d4e3f33aaabba743f4c0bbdf7a75453b9e3d790fd02647aa6891261`).
It proves receipt-before-HUP, a still-active fixed unit, a successful cutover
stub terminal record, HUP not reaching the stub, `cutoverCalls=1`, repeated
launch refusal, zero secret hits and zero container/temp residue. Earlier
BLOCKED reports were retained unchanged and also report complete cleanup.

Focused structured tests cover the fixed unit/run/paths, prepared hashes,
clean environment, read-only status, all-path worker terminal status, exact
two-baseline enumeration, old image IDs, reviewer/schema invariants and the
unchanged cutover HUP trap. The final focused run passes 57/57.

The r5 manifest set is
`33c830dc1ec447472b8ec58523050f36fd3703b78fc31c4eca4c044a6eaced8f`
and `manifest.json` SHA-256 is
`5121171001b9a9b42e57f92444a27a50c725da98b6bcededbe7de9be1d6e63a9`.
The true-Linux release preparation report is
`output/workflow-production-release-bundle-linux-078454e924/report.json`
(SHA-256
`c5bade4aece43a2b473a35f899954e843e9384862611cb0c3adee5eec71d753e`)
and reports all eleven failure cases plus zero container/volume residue.

The fresh production-shaped success/failure report is
`output/workflow-production-release-bundle-cutover-a6c3dc1ea6/report.json`
(SHA-256
`b758bb9eeb022ebafa4cd345c24b1e6220d0dc753bc173eeb3a0b2d9939cbca4`).
Success starts from exact rolled-back-disabled empty state and reaches active7
with three official Workflows and 9/9 events/idempotency rows. Deliberate
failure starts from exact enabled-empty state and restores exact active6, old
Admin/Identity, disabled flags, and the unchanged schema/reviewer/zero-row
baseline. Both paths report zero container, network, volume, private-root and
backup residue.

This candidate is still not deployment authorization. No server was connected
or written while implementing or verifying r5; r4 remains obsolete and its one
cutover call is not retried.

## Prevention gate

Never invoke `workflow-production-cutover.sh` directly from an interactive or
tool-owned session. Accept only the fixed launcher receipt, then poll the fixed
status/evidence from separate read-only connections. A missing receipt, failed
terminal status, existing run or hash mismatch means stop and freeze a new
candidate; never improvise a detach command or retry the same one-shot release.
