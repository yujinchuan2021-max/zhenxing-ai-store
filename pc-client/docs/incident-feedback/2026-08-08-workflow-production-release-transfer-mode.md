# Workflow production release transfer lost required file modes

## Symptom and production evidence

The authorized e64 Workflow cutover passed the read-only server preflight and
the uploaded source/image checks, then rolled back before the fixed temporary
acceptance runner. The release had been unpacked under `umask 077` and repaired
manually for only the Node archive and checksum file. The bind-mounted
`caddy-entrypoint.sh` remained deployment-user owned mode `0600`; under the
server Docker DAC/user-mapping boundary the Caddy bootstrap could not read it,
so the 90-second health gate failed.

The cutover was invoked once and was not retried. Held Identity and Workflow
schema work rolled back, all six old services returned healthy, Workflow flags,
schema, events and reviewer identities returned to zero, and signed catalog
transport hashes did not drift. The retained remote evidence canonical SHA-256
is `b796072b84e974a6fb17111cd067fc33479f0931bde535d940118347c73a3b84`;
the local report SHA-256 is
`04637ea153739d8a892385b443ec5f3196a9e285522eba8919d6ce0c6f8def13`.
The verified backup remains
`/opt/zhenxing-ai/shared/backups/community-production-20260808T130127Z`
with `SHA256SUMS` SHA-256
`60ebefa6b2ef980e109e57883a2cec718b975b4b6e909be39c45a61d08544dd4`.
The fixed runner did not run, so this incident supplied no production evidence
for the earlier cleanup repair.

## Root cause

The deployment manifest authenticated bytes but did not own the transfer set
or target file modes. Operators derived a 95-file union from the deployment
and Identity manifests, discovered after transfer that `manifest.json` was the
96th required file, then relied on a Windows tar/remote-umask workflow and
selected `chmod` repairs. That left executable/readable bind assets outside an
auditable contract. The Caddy failure was the first consumer to expose the
drift; the same process could have affected migration, cutover, helper or
runner files later.

## Candidate fix

`workflow-production-release-bundle.cjs` now generates one exact self-contained
directory bundle from the frozen deployment manifest, `manifest.json`, and the
canonical Identity source closure. It records every payload byte/SHA and an
explicit per-path mode. Only the enumerated deployment shell assets are
`0755`; all data, CJS, SQL, YAML, Caddy, runtime and manifest inputs are
`0644`. Secrets are rejected and absent.

`prepare-workflow-production-release.sh` is invoked through fixed `sudo -n
bash`, so its incoming executable bit is irrelevant. It accepts only
deployment UID/GID `1000:1000`, canonical direct staging/release children,
regular single-link exact-manifest inputs and safe metadata. It installs each
record into a new unpublished `.tmp.PID`, prepares the frozen Node runtime,
recomputes deployment/source manifests, validates Compose and Caddy, writes a
release marker, fsyncs and atomically renames. It never overwrites an existing
release. Any failure deletes only its exact unpublished temp; old b56/e64
releases, evidence and backups are outside the accepted target.

`workflow-production-cutover.sh` now re-verifies that marker with the absolute
release-scoped Node runtime before evidence creation, backup, migration or
service changes. Production exposes no arbitrary transfer root, mode mapping,
runtime path or skip flag. The existing Windows isolated-acceptance mode may
omit POSIX mode re-observation only after a true-Linux preparation has produced
the release; it still validates all bytes, manifests, source closure and the
prepared marker.

## Verification and remaining boundary

The first TDD run failed because neither a bundle module nor a preparer existed.
A true Ubuntu 24.04 DinD run then forced every incoming file to `0600` and
directory to `0700`, observed the old Caddy entrypoint mode, and prepared a
release with exact `0755`/`0644`, owner `1000:1000`, link count `1`, frozen
runtime, Compose config and Caddy validation. Eleven missing/corrupt/mode/path/
link/owner/existing-target/rename cases failed before publication and left no
temporary target.

The exported prepared release subsequently passed the complete local cutover
success fixture, including the fixed real Flarum `2147483647` runner, four
events/four idempotency rows and zero private/project residue. A separate
reviewer-probe failure restored disabled base flags and current-run
Identity/schema state without deleting volumes. Backup/restore, zero/written
event migration rollback, Identity readiness, Caddy PID1/secret boundaries and
the unchanged Identity source/image closure also remained green.

The final frozen true-Linux report is
`output/workflow-production-release-bundle-linux-13f463f840/report.json`
(SHA-256 `b40091e545b2dcbc2339d38955d80f9df6424cd5d16d06ec3257175b56d66b00`).
The final prepared-release cutover wrapper report is
`output/workflow-production-release-bundle-cutover-6b396c8c42/report.json`
(SHA-256 `e1748993a53503f43a05a8836cb01b6b33e94d7aa195039caacddf7d25a34287`).
Its success, fixed-runner and injected-failure reports hash to
`e5c2105d9445558f477a7ee794f2bd116f3df588f533435e8df70e5a8b570fbe`,
`028bd9d0fe1928ba41738ae7947449d682c8e87fd87bba3fb4e5cc47e41c8b71`
and `b932960746e45b95f8327f1611007c399cd75fba972e6ba101df717b6bd48d64`
respectively. These hashes describe local candidate evidence only.

This is a new `candidateOnly=true`, `deployable=false` freeze. The e64 release
and its authorization are retired. Test/release must independently rerun A-E
against the final manifest-controlled bundle before the user's continuing
authorization can proceed to a new server preflight; no local result in this
incident is a server retry.

## 2026-08-09 catalog activation dependency closure regression

A later fresh isolated cutover reached the prepared catalog activation stage
and failed while loading `catalog-active7-state-activation.cjs`. The prepared
release omitted `admin/release-store.cjs`, `shared/catalog-channel.cjs`, and
`shared/catalog-release-icon-compat.cjs`; the inner report SHA-256 is
`e26da6456e57dfcbe5f46aa6497fa7bccd88969bdbb573bbde96a8d48b935ada`
and the outer report SHA-256 is
`e0b8535c2a3ee258c25ca00396ce36639ef72d427e5624030053169cba0d6b43`.
The root cause was an authenticated exact file table that still lacked the
activation module's complete runtime `require` closure.

The candidate fix adds those three source files, with exact bytes, SHA-256 and
mode `0644`, to the manifest-controlled bundle. The true-Linux verifier now
uses the prepared release-scoped Node runtime to load the activation module
and checks its fixed exports, so a byte-complete table that cannot execute its
read-only module closure fails before cutover.

Focused bundle/activation tests pass 11/11. The true-Linux report is
`output/workflow-production-release-bundle-linux-e558054faf/report.json`
(SHA-256 `356f801a0e36bd3036ce17d5981357ccfa9b176e882e365f6fe3e7ce7a614038`);
it records the three activation exports, complete cleanup, and
`serverTouched=false` / `catalogStateTouched=false`. The replacement local
candidate remains `candidateOnly=true`, `deployable=false`; independent A-E
and any newly authorized server preflight remain outstanding.

## 2026-08-09 Identity d6 image archive closure regression

The next strict production preflight stopped before writes because the remote
host did not already contain the fixed d6 Identity image. The r3 bundle carried
the Admin image archive but no Identity archive, while the cutover fifth
argument could still name an external, unhashed path. The preflight made zero
remote writes and zero cutover calls.

The r4 candidate saves the already verified local image exactly once without a
rebuild. Source
`output/workflow-production-identity-d6-image.tar` is 58,903,040 bytes with
SHA-256
`81e799ab613e772c4942d1ff9d3294c9922d74ac7037bba81aac39669f68d18c`.
The bundle owns it as `artifacts/identity-d6-image.tar` mode `0644`, and records
the fixed tag, OCI image ID
`sha256:4e82fe3dc4060b7075ccdee6e6c5a579d0a9ade8a2dc93aee54d0d66e35486a0`,
source label
`d6d281492300a7386139957fa083ae5eaf97de896aac8e38a4905bf5bd1c4f80`,
and `Config.User=node`. Prepared verification reads only that release-local
artifact and checks its exact bytes and digest. Production cutover rejects an
external archive argument, loads only the prepared artifact, and verifies all
three image properties before backup or service changes. The disposable
isolated harness retains only its explicit `-` shorthand, which resolves to the
same prepared artifact.

The first true-Linux load correctly exposed Docker image-store semantics: a
legacy graphdriver reported the OCI config digest `5b1446...` instead of the
required OCI index ID `4e82fe...` and the gate stayed blocked. The final gate
uses Docker's containerd image store, where the unchanged tar loads with the
required exact ID, then verifies the label and user. Its report is
`output/workflow-production-release-bundle-linux-3698a3bdde/report.json`
(SHA-256
`e4211089d946cb8d6fa1dfd57b4317bbc0cead2276331d6ab82e1d46c5e086f0`);
all eleven preparation failure cases remained fail-closed and the dedicated
container/volume cleanup reached zero. This remains local candidate evidence;
fresh independent A and C are required before another production preflight.

The local prepared-release success/failure closure also passed. The outer
report is
`output/workflow-production-release-bundle-cutover-a36d954b9f/report.json`
(SHA-256
`07144ba456ea51ee8e75ceaf46a0d32d8a3fc96fcc2e209147abe757c58eaf6a`).
Success reached active7 with three official workflows and 9/9 append-only
event/idempotency rows; the deliberate failure restored exact active6 and the
existing empty Workflow baseline. Both disposable stacks cleaned containers,
networks, volumes, private roots and backups to zero. This does not replace the
required independent Test/Release A and C rerun.
