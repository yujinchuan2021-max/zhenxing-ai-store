# Workflow production read-only preflight phase boundary

Status: local candidate only; remote connections and writes remain zero.

## Symptom

The first single-SSH preflight candidate assumed Node existed in the host,
Flarum and Caddy environments, trusted caller-supplied candidate hashes, and
reported secret authority/consumer checks that it had not actually performed.
It also discarded the owner-capability HTTP status and could resolve a killed
child before the child closed.

## Root cause

The collector was designed before the release-scoped Node runtime and prepared
release became an explicit authorization boundary. That collapsed
pre-transfer host checks and post-prepare retained-state verification into one
operation and encouraged environment and image assumptions that production
does not satisfy.

## Candidate correction

The local coordinator now has two fixed commands. `pre-transfer` uses one
strict SSH connection and a static Bash reader only. `post-prepare` uses the
canonical r11 release's exact Node v24.18.1 binary, verifies the complete
prepared release and runtime, requires the existing-state verifier and pure
source-post GET seam from that same release, and emits only allowlisted counts
and booleans. Candidate hashes are recomputed from the fixed local bundle.
Neither phase transfers, prepares, loads an image, mutates a service, writes
production data, or launches cutover. Transfer/prepare and launch remain two
separate later authorizations.

## Prevention gates

- Host PATH Node and Node inside Flarum/Caddy are forbidden.
- Phase 2 rejects any runtime, module, payload, marker, owner, mode, link or
  digest drift before retained-state reads.
- Flarum readback delegates to `readExistingOfficialSourcePosts`; only marker
  and exact-post GETs are accepted.
- Owner capability is exact HTTP 200 with the four-field disabled DTO; public
  list is exact HTTP 503 with the fixed disabled error.
- SSH timeout/output/stdin failures kill and then await child close; a child
  that does not close has its own fixed failure code.
- Reports contain fixed ASCII enums, counts and booleans only.

Full independent A-E and any server execution remain pending CTO audit.

## r11 audit correction

The first r11 coordinator still treated Windows OpenSSH, the deployment key,
and `known_hosts` as POSIX files; sampled only six bundle files; and counted a
spawned SSH process as a connection. It also left transfer-authorizing host
facts and the fixed secret authority root implicit. Those are evidence defects,
not production findings.

The corrected candidate fixes all three authority paths internally. Windows
OpenSSH is the canonical System32 executable and is checked with its real
TrustedInstaller/read-execute ACL semantics; the two user authority files are
checked as distinct single-link files with no group/everyone write grant. The
CLI cannot replace any of them. Before SSH, the bundle verifier recomputes the
entire control/table/Identity/payload path set and every file byte/digest. The
Phase 1 receipt is emitted only after exact UID/GID, disk, the launcher's real
`/opt/zhenxing-ai/shared/workflow-production-r11` control namespace, exact
`not-found/inactive/dead` systemd properties, zero concurrent cutovers, and six
healthy prior-image services pass. Old Admin and Identity bind both configured
tag and immutable container image ID.

Phase 2 repeats the service health/tag/ID baseline after prepare. It then uses
the same prepared release's signed release store to verify production v2
active6 release/version/catalog SHA and unchanged signed v1 active72; disabled
capability is not treated as catalog evidence. Phase 2 derives one canonical
secret authority parent from the exact mount set rather than guessing a host
path. Parent and nine files are checked for owner/mode/link/regular-file facts
and thirteen exact consumers. The forum API key remains exactly 65 bytes with
one terminal LF. Other roles permit at most one terminal LF only where all
current consumers trim or command-substitute it; CR, internal/double LF, C0,
DEL and the command delimiter remain rejected. No secret path, bytes or value
is reported.

The true-Linux bundle gate uses a fresh containerd store and actually loads all
five bundled custom-image archives: candidate and rollback Identity, active
and rollback Admin, and Flarum. Exact IDs, labels and users are checked, and a
wrong-ID expectation must fail; offline structure alone is insufficient.
`sshProcessStarts` and receipt-confirmed `remoteConnections` are now separate
report facts. The spawn executable, complete argv and stdin collector are
accepted only when they exactly match the internally generated read-only
program bytes.

## r11 final coordinator audit correction

The post-prepare collector originally reused the secret-mount rule for the
Admin signed-catalog bind. Production Compose intentionally mounts
`/app/admin/published` read-write for Admin, so requiring `RW=false` would have
rejected every real Phase 2 before the signed release-store reads. The
coordinator now keeps two explicit seams: secret sources must be unique,
canonical read-only binds, while the sole Admin published source must be the
canonical deployment-owned `0755` directory behind the exact read-write bind.
The existing release store performs only `readChannel` and `readRelease`; a
tree digest regression test proves those reads do not mutate the published
tree.

The generic trimmed-secret byte rule also did not cover the Caddy seed
consumer. More importantly, Admin trims this secret while Caddy reads the
seeded bytes raw and interpolates them into an unquoted Caddyfile argument.
Maintaining an expanding printable-character blacklist would therefore not
prove a shared authentication value or formal provenance. The coordinator now
binds `community_cms_gateway` to the sole issuer contract in
`host-secret-authority.sh`: exactly 64 lowercase hexadecimal bytes and no
terminal newline. The forum API key remains exactly 65 bytes with one terminal
LF, and the other consumer-intersection rules are unchanged. Finally, the
pre-transfer control matrix names the launcher's real `environment.sh` and
rejects both existing children and dangling child symlinks while retaining the
parent-root absence gate.

## Formal local Phase 2 fixture handoff

Independent release review found that the real systemd fixture exercised only
Phase 1. Phase 2 had leaf and structure tests but no fresh production-shaped
entry that executed the exported `createPhase2Program()` bytes with the
prepared Linux runtime against real Docker inspect/exec, retained Workflow
state, signed catalog files, Flarum GETs, and the production mount graph.

The new local-only fixture runner is intentionally outside the deployment
manifest and bundle. It generates its inner harness from the frozen retained
baseline constructor, embeds exactly the current exported Phase 2 program,
and invokes it with the prepared release's Node binary. It also records
before/after structural digests and injects one preexisting event-head drift
only after the clean read-only pass, requiring that drift to fail without a
second mutation.

Two runner defects were found by real RED executions before any Phase 2
result. First, exporting official images by `repo@digest` restored only an
unnamed image ID in a fresh containerd store. The fixed fixture exports the
already-inspected fixed tags, checks the loaded immutable image IDs, and proves
each `tag@digest` resolves with `--pull=never`. Second, precreating the prior
deployment destination made `docker cp` nest the directory one level below
the path consumed by the generated harness. A static regression now requires
that directory target not exist before the copy.

The latest real run still failed inside the retained fixture stage before a
final Phase 2 report was available. Cleanup was exact: matching outer/inner
containers, networks, volumes and private roots are all zero. The candidate is
therefore frozen BLOCKED; unit success does not replace the missing real
production-shaped Phase 2 PASS. No deployment payload, manifest, Identity
image, catalog, service, server or production data changed.

Follow-up review found the first deterministic inner blocker without relying
on the lost terminal output. The collector read only
`AIHUB_COMMUNITY_PUBLIC_HOST` from Caddy and reused it for both Flarum source
post GETs and the Identity public-list GET. The Community vhost routes to
Flarum, while only the distinct main `AIHUB_PUBLIC_HOST` routes `/v1/*` to
Identity. The coordinator now derives both exact values from the same Caddy
inspect, requires valid distinct hostnames, and binds each internal HTTPS GET
to its inspected vhost. It still connects only to `127.0.0.1:443`, uses the
system trust store, requires certificate verification, disables connection
reuse, and never follows a redirect.

The outer fixture also used to reject a nonzero inner process before reading
the inner terminal report. Its teardown then removed the disposable DinD
environment, permanently losing the already-finalized failure evidence. The
fixture now uses one fixed inner report location, reads and validates that
report before applying the process-exit gate, and projects only fixed
stage/substage/status, terminal, and cleanup facts. A nonzero process remains
blocked; the change preserves evidence and does not relax any business gate.

One discarded diagnostic command attempted a pinned `docker create` after its
local archive setup had already failed and consequently downloaded Postgres
inside a disposable DinD daemon. That daemon and its volume were removed, and
the host image store was unchanged. The corrected diagnostic used an existing
local archive and `--pull=never`. Future fixture diagnostics must check archive
existence before starting DinD and put `--pull=never` on every probe create.

An earlier PowerShell diagnostic also produced an invalid temporary-directory
invocation before candidate execution. It did not exercise the coordinator or
create valid acceptance evidence. That command and the disposable DinD pull
above remain diagnostic failures only and must never be cited as candidate
PASS evidence.

## Phase 2 failure attribution and local CA boundary

The first evidence-preservation correction still reduced every blocked inner
run to `inner-terminal-blocked`. That proved finalization and cleanup, but it
did not identify which fixed read-only gate rejected the run. The exported
Phase 2 program now owns one outer synchronous/asynchronous failure boundary
and emits only an exact blocked envelope. Its stage/code pair is selected from
the fixed prepared-runtime, service-baseline, source-post-https, catalog,
database, capability, public-list-https, secret-authority, and
retained-verifier map. The local fixture validates that exact envelope before
teardown and projects the business stage itself as the substage; unknown keys,
unknown pairs, and raw error detail are rejected. A nonzero child remains a
failure and the successful Phase 2 schema is unchanged.

The production coordinator continues to rely on the public Web PKI with its
clean fixed environment. The disposable local fixture instead installs its
own Caddy CA in the Linux system store. A single-container micro probe used the
same prepared Node v24.18.1 binary and exact Host/SNI, certificate validation,
and no-redirect request. With only the OS CA installed and `env -i LC_ALL=C`,
the client exited 2; adding only `NODE_USE_SYSTEM_CA=1` exited 0. The runner now
sets that variable only for its generated local Phase 2 child. Static tests
require zero occurrences in the production coordinator program and frozen
deployment bundle. The micro command's final shell assertion was malformed by
the PowerShell-to-Bash line ending, so its overall exit 1 is retained as
diagnostic evidence rather than represented as a candidate PASS; the emitted
single-variable client results are the bounded causal evidence and the
container was automatically removed.

Process note: the preceding development turn ran the full local Phase 2
fixture before the required CTO intermediate audit. Its result remains blocked
evidence and is not reused. This correction deliberately stops after leaf
RED/GREEN, focused tests, syntax, hashes, and residue checks. A fresh retained
fixture requires a later explicit CTO authorization.

The first attribution leaf still lost the envelope at the real SSH boundary:
`runSsh` converted every nonzero child to `SSH_EARLY_EXIT` before `runPhase`
could inspect stdout. The transport now has one narrow exception. Only a
post-prepare child with empty stderr and the exact fixed Phase 2 failure
schema/receipt/stage/code is converted to the existing blocked report with
that allowlisted stage and code. It remains non-PASS. Multiple envelopes,
malformed or extra fields, unknown pairs, stderr, an exit-zero failure
envelope, and every pre-transfer failure remain generic fail-closed and never
expose raw transport output.

The local CA micro gate was then repeated with a corrected LF stdin wrapper.
The wrapper used Node `spawn` with an argv array and `shell:false`; the same
prepared Node v24.18.1 binary produced clean-environment exit 2 and
`NODE_USE_SYSTEM_CA=1` exit 0, while exact Host/SNI, certificate validation,
disabled agent reuse, and no redirect were asserted. The whole Docker command
exited 0 with empty stderr and zero container residue. A preceding attempted
PowerShell wrapper failed before `Process.Start()` because the installed .NET
did not expose `ArgumentList`; it started no Docker resource and is not test
evidence. No full Phase 2 fixture was run in this correction.

## Local fixture execution evidence before teardown

The one CTO-authorized fresh retained fixture remained blocked. Its outer
report SHA-256 was
`8ac27006f78324e36fd73c96988560c3c62339c720721f642f26d1abe1b735b4`.
The old runner assigned `innerTerminal` only after reading, parsing, and
validating the fixed inner report. Any missing, unreadable, invalid, spawn, or
timeout outcome therefore jumped to the generic catch before that assignment;
the subsequent DinD teardown erased the evidence needed to distinguish those
states. `innerTerminal: null` did not prove that the physical inner report was
absent and is not product, Workflow, Identity, or Phase 2 failure evidence.

The runner now normalizes process completion to the fixed
`completed|timeout|spawn-failed` projection and atomically writes a provisional
local blocked report immediately after the child returns, before any inner
report read or cleanup. Inner report handling is independently classified as
`valid|missing|unreadable|invalid`. A valid blocked report preserves only its
fixed Phase 2 stage/code and cleanup projection. Cleanup then atomically
replaces the provisional report with a finalized blocked report, or a partial
report when exact runner-owned cleanup cannot be proven. Unknown keys and raw
process, filesystem, daemon, path, identity, or secret detail are not
projected. This is runner-only evidence preservation; the Phase 2 program,
coordinator, deployment bundle, manifests, Identity, Workflow, Caddy, and all
production behavior are unchanged. No Docker or full fixture rerun is part of
this correction.

## Layered inner report classification

The single authorized rerun produced finalized outer report SHA-256
`b99985597413373c396a0c009d54a1ea129cd2632a359eb9f080c5576b6876c9`.
It proved only that the child completed nonzero, a report string was read, and
the exact Phase 2 terminal collector rejected it. The previous
`INNER_REPORT_INVALID` result merged JSON parsing, public harness validation,
process/report agreement, and Phase 2 envelope validation. It therefore did
not prove a product, Workflow, Identity, or Phase 2 regression.

The runner now keeps the exact Phase 2 terminal collector unchanged and
classifies the layers separately. Parsed reports use only the fixed
`json-invalid`, `harness-contract-invalid`, `blocked-before-phase2`,
`valid-phase2-blocked`, and `execution-mismatch` classes. The generated local
fixture writes one of seven fixed milestones around the existing retained
snapshot and Phase 2 process boundaries; it does not copy or change the
business loop. A generic blocked harness report is accepted structurally only
with exact status, cleanup, terminal, and `{name,message}` failure keys, while
the failure text is never read into or projected by the outer report. A report
blocked before the Phase 2 process boundary is distinguished from an invalid
post-return envelope. Unknown milestones, extra failure keys, invalid cleanup
or terminal facts, and execution/report disagreement remain fail-closed.

Any integer child status is now normalized as a completed process: zero maps
to exit code zero and every nonzero value maps to the allowlisted exit code
one. Only timeout/signal outcomes and actual spawn errors use the separate
timeout or spawn-failed states. Provisional-before-read and finalized-after-
cleanup ordering remains unchanged. This correction is runner-only; no Docker
fixture, remote connection, deployment rebuild, or production action was run.

## Early local-fixture milestone preservation

The next authorized retained local Phase 2 fixture wrote a structurally valid
blocked inner report, but no existing milestone. Its finalized outer report
therefore proved only fixture generation, prepared-node startup, top-level
require, and runner cleanup; it did not establish a Workflow, Identity,
catalog, TLS, or retained-state regression. The original seven milestones
began after retained-baseline construction, so no earlier fixed boundary was
available to project before disposable cleanup.

The runner-only generator now writes one fixed, ordered milestone at harness
entry and after its existing supply-chain, base-provision, CA-trust,
old-disabled-baseline, retained-seed, active6-restore, old-image-restore,
retained-state, and retained-catalog boundaries, before retaining the existing
seven Phase 2 milestones. The collector requires a known milestone in every
new generated report, projects only that enum for a structurally valid generic
blocked report before the Phase 2 process returns, and rejects missing,
unknown, or generated out-of-order milestones. It never reads or projects the
generic failure message. This change is local fixture evidence preservation
only: the frozen harness, coordinator, Phase 2 program, deployment payload,
Identity, Workflow, Caddy, server, and production data remain unchanged.

## Base-provision milestone refinement

The first run with early milestones stopped after `supply-chain-ready` and
before `base-provision-ready`. That interval includes local fixture inputs,
Compose contract construction, base services, database and Workflow migrations,
and reviewer provisioning. Its duration and generic blocked report cannot
identify which of those fixed runner boundaries rejected the fixture, and do
not establish a product regression.

The generated local harness now adds ordered labels after each existing
successful boundary in that interval: `fixture-inputs-ready`,
`compose-contract-ready`, `base-services-started`,
`identity-migration-ready`, `flarum-migration-ready`,
`workflow-migration-applied`, `workflow-migration-verified`, and
`reviewer-provision-returned`. The existing `base-provision-ready` remains the
next marker. Generic blocked reports project only the label; missing, unknown,
or generated out-of-order labels fail closed. This is runner-only diagnostic
granularity; it changes no fixture business step, timeout, retry, deployment
candidate, or production behavior.

## Base-service start control-plane attribution

The refined fixture then stopped after `compose-contract-ready` and before
`base-services-started`. The failing operation is the existing un-waited
Compose start of the independent PostgreSQL, MariaDB, and old Admin services;
the candidate Identity image, target-database health check, and all migrations
are later boundaries. Cleanup removed the disposable daemon state, so the
previous generic harness report could not distinguish a port, bind/secret,
image/platform, name/network, OCI runtime, resource/storage, or daemon
control-plane failure.

Only the generated runner's failure branch now retains a fixed diagnostic. It
maps the in-memory Compose stderr to one fixed reason enum and performs one
read-only `compose ps --all --format json` for the three fixed services. When
that probe can be parsed, it projects only each fixed service's
absent/created/running/exited/dead state and none/starting/healthy/unhealthy
health enum. An unavailable or malformed probe is represented without raw
content, and all unknown values fail closed. Successful starts make no extra
Compose call. No retry, wait, product logic, deployment candidate, or
production behavior changed.
