# Workflow Store production enablement must not reuse acceptance configuration

## Symptom

The production base kept every Workflow/resource-submission/schema switch at
`0`, while the only `1` values lived in an isolated acceptance overlay. A
formal server switch could not safely enable Workflow Store without reusing an
acceptance reviewer identity or introducing undocumented partial configuration.

## Root cause and fix

Normal Identity and Community startup correctly avoided candidate schema writes,
but no production-only enable/migration/rollback/disable contract existed.
`compose.workflow-production.yaml` now changes only the necessary Identity
flags, reviewer identity, and Identity-only secret mount; the base and
acceptance overlay remain separate.

The shared host-secret authority seam now owns both the existing Caddy issuer
and the Workflow reviewer issuer. It rejects symlinks, multi-links, non-`0600`
modes, control characters and active consumers; it uses system CSPRNG plus
atomic rename and writes metadata-only audit records. The production migration
wrapper requires a SHA-verified absolute backup and checks the single canonical
append-only `community_workflow.events` table. An absent table is a safe
pre-apply rollback no-op, zero events permits rollback, and any written event
blocks rollback in favour of emergency-disable plus verified database recovery.
The cutover contract restores the disabled base on failure.

The first emergency-disable helper had bypassed that contract by composing only
the base file. In an isolated Windows acceptance it silently discarded the
random loopback-port and named-volume overrides, so a written-event rollback
refusal could not be followed by a trustworthy disable/re-enable rehearsal. It
now sources the same `workflow-cutover-compose-files.sh` helper as cutover,
backup, and migration. The helper validates production defaults or the exact
canonical five-file isolated list before Docker actions. Emergency disable
replaces only its production-overlay argv entry with a generated disabled
Identity overlay; it never calls migration, `down`, `--volumes`, `prune`, or
schema/data deletion.

## Isolated cutover probe seam

The production cutover script had correctly fixed its own Admin catalog checks
to `127.0.0.1:4173` and reviewer checks to `127.0.0.1:4174`, but that made a
full cutover/rollback rehearsal unsafe on a fresh local project with randomly
allocated loopback ports. The deployment contract now keeps those exact
production defaults while allowing isolated acceptance overrides only when an
explicit boolean mode, two strict root loopback origins, and a constrained
Compose-file list are supplied. The accepted origin form is exactly
`http://127.0.0.1:1024..65535`; all other URL shapes fail before any Docker
action.

The isolated Compose list is a regular, canonical, approved-owner file. Its
first two entries must be the exact base compose file and production overlay;
the only extra entries are the three acceptance files under the approved
acceptance root: `compose.windows-acceptance.yaml`, `ports.override.yaml`, and
`caddy.override.yaml`. The cutover, backup, migration, and rollback paths all
use the same parsed argv array, never a shell-expanded string. Rollback replaces
only the production overlay slot with the generated disabled-Identity overlay,
so random local ports and Windows acceptance volumes are preserved during
failure rehearsal. These seams remain local to the cutover harness and do not
become Compose business env, Caddy, Identity, or catalog settings.

## Verification and remaining acceptance

`tests/community-production-deployment.test.cjs` covers base-off/production-on
separation, reviewer isolation, rollback restriction, reviewer `404`, no-prune
rollback rules, and the normalized five-file cutover argv contract.
`tests/workflow-production-cutover-origin.test.cjs` covers production override
rejection, Admin/reviewer SSRF-shaped origin rejection, constrained list
parsing, duplicate/mode/path guards, and fixture rollback. The Docker smoke
validates a `0:0:0600` authority with non-root denial and parses the production
overlay. `test-workflow-cutover-compose-five-file-smoke.cjs` starts only a
disposable Identity mock to prove the five-file set preserves random loopback
ports across restart, force-recreate, rollback overlay, emergency disable, and
re-enable. It retains a `workflow-event` sentinel in a disposable Windows-style
`community_acceptance_database` named volume. `test-workflow-production-
migration-rollback.cjs` uses fresh PostgreSQL to prove pre-apply
no-op, zero-event rollback, and written-event refusal with retained data. These
are local candidate gates only. Test/release must still run a fresh full
production-overlay stack and recovery drill before deployment.

## Identity source-closure replacement

The earlier Identity image label `f76e4383...` no longer matched the frozen
source closure because its embedded migration runner still accepted the legacy
`workflow_events` table name. The canonical source, SQL, repository, wrapper,
README, and rollback contract all use only `community_workflow.events`, so the
source was not reverted for image compatibility.

The replacement 60-input closure is
`5ea9d2f2dd15852db3631c979624227a1e83833a3b9df1b6073e7a534153096b`.
It includes the reviewed Workflow planning-resolver persistence closure and
produced local candidate image
`zhenxing-ai/identity:workflow-readiness-candidate-5ea9d2f2dd15` with image ID
`sha256:0d407be9c34f75b9c729266ff80fa03e4e9a82c0eb72720bfdbe791af5e56883`.
All 58 actual COPY inputs matched source bytes and SHA-256; the embedded
canonical migration runner is 2,261 bytes with SHA-256
`7424559e45062e261603e5f700c443d9eec9ee7d26eafc7954902b942b7f8932`.
The updated deployment set digest is
`a48fdd5129030d9482b4fafe099aa7a81e0bae9baba350e1241b9105d6b53dd7`.

This closes only the local source/image/deployment supply chain. The candidate
remains `deployable=false` until test/release completes a different fresh A-E
production-overlay acceptance project.

## Caddy PID 1 identity observation correction

The fresh 19a/63ecc A-E cutover reached healthy Identity and Caddy containers
but then rejected the healthy Caddy as root. The cutover used a new
`docker exec ... id -u` process; because Compose intentionally configures
`user: 0:0` for the short bootstrap, that exec inherited root even though the
entrypoint had already replaced PID 1 with Caddy at UID/GID 65534. The check
was observing Docker `Config.User`, not the post-bootstrap runtime process.

Cutover now reads PID 1 `Uid`, `Gid`, and `CapEff` from one
`/proc/1/status` snapshot. It requires all four UID and GID columns to be
65534 and effective capabilities to be zero. The check is not removed or
relaxed. The real isolated success harness then ran the manifest-controlled
cutover through root bootstrap, fixed temporary acceptance, service-identity
commit, PID 1/secret verification, and exact cleanup. Its report is
`output/workflow-reviewer-cutover-success-20260808060619055-de61411f78/report.json`
with SHA-256
`e61d43f03de2de9e633f21fb4be0bbaccc3694f2affdfaec29a26ef40665f8dc`.
This local regression does not replace a fresh independent A-E review or grant
server cutover authorization.
