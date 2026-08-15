# Workflow Store production-shape deployment candidate

Status: `candidateOnly=true`, `deployable=false`.

## Current HEAD local Identity rebuild (2026-08-16)

The repaired current source closure is `d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8` (78 manifest inputs / 76 actual Docker COPY inputs). Its local-only image is `zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8`, image ID `sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01`, size 58,884,827 bytes, source/revision labels equal the closure digest, release label `candidate-only-d9fa8de84dc8`, and `User=node`.

The two exact image-closure/secret probes passed, as did all seven isolated catalog-readiness scenarios and the disposable PostgreSQL Workflow migration rollback matrix. The readiness report is `output/identity-catalog-readiness-docker-20260815190812166-f03153ee/report.json`, SHA-256 `bf1cd6c8a8178d409719ba9466885878e6d3df9cbdffd5d8fa641679f1107476`. Fresh local A–E also passed against the same exact image through the production-shaped isolated runner: `output/workflow-current-identity-ae-20260816035843590-ea48d8c84d97/workflow-temporary-acceptance-report.json`, SHA-256 `0efd9b5c8f21be30c72c0dc628c306c8ce04d39453e02a707317e6f2def9a78c`. The report is finalized, candidate-only and non-deployable; it records the exact current image/source, all owner/reviewer/public/database gates, four ordered events and idempotency rows, and complete project/private cleanup. This evidence does not replace the frozen deployment candidate below: production Compose, cutover, and release artifacts still bind the reviewed `2a114…` image. No server image was loaded or changed, and any cutover decision remains a separate explicitly authorized operation.

## Current Identity PostgreSQL target-contract freeze (2026-08-10)

The current candidate supersedes the prior f18 Identity image for deployment
purposes. Its immutable Identity source closure is
`2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7`
(74 manifest inputs; 72 actual Docker COPY inputs), its image is
`zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e`, and its
image ID is
`sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748`.

`identity-database` is healthy only after an authenticated TCP `psql` query
proves `current_database()='aihub'` and `current_user='aihub'`. This replaces
the weaker `pg_isready` existence assumption: a reused or partially initialized
PGDATA lacking the `aihub` database remains unhealthy, so migrations cannot
start schema SQL. The command neither creates a database nor exposes secret or
server error text. The same `service_healthy` contract is consumed by the
outer migration and isolated temporary-acceptance runner. The candidate remains
local-only until a fresh independent A-E run validates it.

The release bundle also owns its exact rollback image rather than relying on a
Docker daemon cache. `artifacts/identity-19a-rollback-image.tar` is fixed at
58,887,168 bytes and SHA-256
`9205edae43228dd7afb66bf179ff321c032f2d8e47e71f61d65fc4165b56e904`.
Its recursive OCI descriptor/config/layer closure, single tag, labels and
`User=node` are verified during bundle creation, prepared verification and
cutover. This does not relax the exact prior-image production preflight.
Old Admin and the self-built Flarum image are also release-owned single-image
artifacts. They were exported from the preserved 300,546,048-byte production
image archive (SHA-256
`1572dd9d1eebefd73333e7311d608e8e1084d9c74243b8b287113a25ed91048a`),
not rebuilt, pulled or retagged. The old Admin archive is 60,279,808 bytes with
SHA-256 `2604d520d1c0a428725c73f507598785cdbdb4c78ac80fba937eec4f953f0ad0`;
the Flarum archive is 239,078,912 bytes with SHA-256
`2ed8a402b6020f8c7197c53ca2b3ded956b2ea57a616dd12ba8ef044844c779f`.
Cutover loads only old Admin. The fresh harness verifies and loads Flarum before
creating its project/network. Digest-pinned official database and Caddy images
remain aggregate local preflight dependencies rather than bundle payloads.

This candidate connects the existing Workflow domain/persistence module to the
Identity production image without creating another state machine or catalog.
The production Compose baseline remains explicitly disabled. There are now two
non-interchangeable overlays: `compose.workflow-acceptance.yaml` for isolated
acceptance only, and `compose.workflow-production.yaml` as the candidate-only
formal production enable contract. The latter enables only required Identity
capabilities/schema flags and mounts one reviewer secret exclusively into
Identity; it does not reuse the acceptance reviewer, add a test user/port, or
change Admin, Caddy, Flarum, catalog, or signed state.

## Fixed facts

- Canonical product/resource dependencies come from the active signed Admin
  release. Resource references require the exact resource ID, host product ID,
  and reviewed binding kind already present in the signed target.
- Canonical licenses come from one fixed allowlist; arbitrary license text is
  not accepted.
- Flarum posts are checked by numeric ID at the fixed internal Community
  service. There is no caller-selected URL, path, header, credential, redirect,
  or write method.
- Public identity output is limited to immutable Identity ID and current public
  nickname.
- Reviewer authentication is an external S2S secret file. The production source
  is a caller-owned `0600`, regular, single-link `workflow_review_secret` host
  authority, generated/validated/rotated/revoked only through the shared
  `host-secret-authority.sh` seam and mounted only into Identity. Caddy returns
  `404` for every public reviewer route and does not mount this authority.
- Normal Identity and Community startup do not apply the Workflow candidate
  migration. Apply, verify, and rollback are explicit one-shot operations and
  require a pre-existing backup whose SHA manifest passes.

No catalog, release state, signature, package, server, or production database
is modified by this candidate. It must remain disabled until test/release runs
a fresh isolated stack, database backup/restore drill, migration
apply/verify/rollback, reviewer/owner/public boundary tests, and cleanup checks.

## Local candidate evidence

- Identity source manifest:
  `output/workflow-identity-reviewer-service-candidate-19a223-2026-08-08/identity-source-manifest.json`
- source content digest:
  `19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c`
- source-manifest file SHA-256:
  `7d2aacacaeccae09ca6908d1dce6c5d387d68c43832a58d667f40d662f47853a`
- local image tag:
  `zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392`
- local image ID:
  `sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567`
- image size: `58,860,636` bytes
- source/image closure gate:
  `tests/identity-source-image-closure.test.cjs` (62 actual image COPY files,
  image label/ID, and image filesystem secret-path scan)
- focused Docker readiness evidence:
  `output/identity-catalog-readiness-docker-20260807155447655-b00cc302/report.json`
- focused Docker readiness report SHA-256:
  `f7314245a6cd860a5096b9aa89f1cbe31342008f5b5dabc75ab3817d29841f9f`
- unchanged catalog-store state SHA-256:
  `abffc088a113160ee85fb0efaead8ddff0230021992c9252df82453e396490a9`
  (`draft=89`, `v1=72`, `v2=6`,
  `catalog-v00000006-567e671621f1-3dcee587`)

The image label matches the source content digest. All 62 actual Docker COPY
inputs (the 64 manifest inputs excluding `.dockerignore` and the Dockerfile)
match their source byte length and SHA-256. The image's
`/app/identity/workflow-migrate.cjs` is the canonical 2,261-byte
`7424559e45062e261603e5f700c443d9eec9ee7d26eafc7954902b942b7f8932`
file and recognizes only `community_workflow.events`. Its filesystem contains
no `.env`, PEM/private-key, or key-shaped file. A fresh no-host-port PostgreSQL
17 production-wrapper
regression proved a pre-apply no-op, zero-event `apply -> verify -> rollback`,
and written-event rollback refusal with schema/data retained; its temporary
container, volume, and network were removed. Base and acceptance Compose files
parse, and the merged Caddyfile passes `caddy validate`. These are local
candidate gates, not production or real-user acceptance.

The subsequent full isolated acceptance run found one deployment-only restart
fault after all preceding gates passed: recursive bootstrap ownership could not
traverse Caddy's private `/data/caddy/locks` directory on the reused named
volume. The entrypoint now owns only the managed volume roots and existing
direct `caddy` directories. A focused real-Docker regression reuses the exact
data/config/secret named volumes across three container creations and records
at least three successful native health checks per cycle, PID 1 UID/GID 65534
and `CapEff=0` read from the same `/proc/1/status` snapshot, derivative
`0:0:0400` with non-root read denial, and writable Caddy
state. The pinned Caddy image and Identity image are unchanged. This focused
PASS does not change `deployable=false`; test/release must rerun the complete
Workflow acceptance flow from a new isolated project.

The formal cutover gate also reads PID 1 from `/proc/1/status`; it must not use
`docker exec ... id -u`, because a new exec inherits the deliberate root
bootstrap `Config.User` rather than the already-demoted Caddy PID 1 identity.

That fresh full-stack rerun closed the Caddy restart fault and passed migration,
backup/restore, owner/reviewer/public HTTP, Caddy route isolation, and real
source Electron gates. It then found a separate Identity readiness defect: a
valid cold signed projection took about 4-5 seconds while the Workflow wrapper
converted its 2-second timeout into a false dependency-missing 400.

The replacement candidate does not preserve the temporary 7-second workaround.
Identity now starts one shared verified projection warmup, exposes its readiness
to the Workflow gateway, reports owner capability false while cold, returns 503
for loading/network/signature failure, and permits 400 only after a verified
exact tuple miss. Failed loads clear in `finally` and retry. License and Flarum
post contracts are unchanged. Focused real-Docker evidence for the rebuilt
image is at `output/identity-catalog-readiness-docker-20260807155447655-b00cc302`
and proves
cold/restart, three concurrent requests with one fetch, ready 201, exact-missing
400, network/signature 503, recovery, and native Docker health. The candidate
still remains `deployable=false` until test/release repeats the entire flow from
another fresh isolated project using `compose.workflow-production.yaml`. The
future cutover requires a verified absolute backup, serial apply/verify
migration, a `community_workflow.events`-absent rollback no-op or zero-event-only
schema rollback, 90-second Identity/Caddy health,
Caddy UID/capability/secret proof, cold `503` then legal `201` then exact-missing
`400`, reviewer/internal `404`, root catalog SHA stability, and exact
temporary-fixture cleanup. Emergency close restores disabled base flags without
dropping `community_workflow`; recovery after a written Workflow event uses the
verified database backup, never schema rollback.

The production reviewer is no longer an operator-supplied UUID. It is the one
governed disabled service identity
`5f16d5ac-6663-5905-b920-c2140ac6769c`, with no login/profile/session surface.
After the verified backup, cutover starts a held Identity-image provision
process that applies/verifies the Identity candidate migration, provisions the
exact row, and applies/verifies Workflow schema. The process keeps its opaque
creation receipt in memory until all health and fixed-runner gates finish.
`commit` discards it; a failure sends `rollback`. Zero-event rollback removes
only current-run additions, while any Workflow event or idempotency row forces
identity/schema retention and emergency-disable. The reviewer secret remains
file-only and is never in the row, browser, environment, report, or log.

Emergency close uses the same guarded Compose argv as cutover, backup, and
migration. In isolated acceptance it preserves the canonical Windows named
database volume and random loopback override by replacing only the production
overlay slot with a disabled-Identity overlay. It never calls `down`,
`--volumes`, `prune`, migration, or schema/data deletion. The focused Docker
smoke records disable then re-enable with the same binding and a retained
`workflow-event` volume sentinel; it is candidate evidence only, not a full
deployment acceptance.

## Public response layering terminology

The **Community inner public projection** is the allowlisted, fail-closed
projection produced by `community/workflow-persistence.cjs` before it crosses
the Identity boundary. The **Identity outer wire DTO** is the separate HTTP
allowlist produced by `identity/workflow-store.cjs`; it resolves current public
display names and removes Identity IDs and internal review fields. These names
describe the existing two-layer boundary only. They do not add a second state
machine, change either runtime DTO, or grant execution, install, invoke, or
binding capability.

## Formal temporary acceptance runner

The deployment set contains one fixed production-callable runner,
`deployment/community-production/workflow-production-temporary-acceptance.cjs`.
Cutover invokes it with the one manifest-controlled release-scoped Node
absolute path and no longer accepts a caller-selected executable or host
`PATH` fallback. It creates a separate disposable Compose project and never writes
fixture users, sessions, posts or Workflow events to production databases.

Its only Flarum fixture post ID is `2147483647`. The fresh Flarum API must return
that exact post; no mock, mapping or fallback is allowed. The report exposes
only fixed step statuses/codes, redaction and four-event/idempotency booleans,
immutable digests, a Workflow reference hash, and exact cleanup status. The
local real-Docker PASS is evidence for an independent test/release rerun, not
deployment authorization.

The retired a03 server attempt reached the fixed runner and rolled back at its
previously opaque `ready` stage. Retained evidence proves the signed catalog was
already ready and that no owner/reviewer/public step had begun, but cannot
safely name Community or Caddy. The replacement report adds one strict
`readyAttribution` object: fixed component/reason/status enums, elapsed-time
bucket, attempt count, and HTTP status class only. Community and Caddy are
started and waited sequentially with bounded 240-second and 150-second budgets
aligned to their existing Compose health windows; the HTTP/catalog contracts
and health checks themselves are unchanged. No raw log, exception, URL, body,
environment, Compose row, or inspect data enters the report.

The later authorized `124e` attempt made that attribution actionable:
Community passed, while Caddy was reported as `service-not-running`/`exited`
after 129 attempts in the `120-180s` bucket. The allowlisted runner report
SHA-256 is
`c0fdcbdb4ac67dacd1aba069256de2b3e5442c71f0ffe3d191660d9d0444c70c`.
Cleanup and automatic production rollback completed, and that candidate must
not be retried.

The cause is a Linux-only bind-permission mismatch in the runner, not a Caddy
timeout: the dynamically generated, non-secret Caddyfile reused the `0600`
private-file writer and was owned by deployment UID/GID `1000:1000`. The
manifest-controlled Caddy entrypoint deliberately starts as root only to read
the derivative secret and prepare managed volumes, then drops PID 1 to
`65534:65534` before Caddy opens `/etc/caddy/Caddyfile`. A fixed-image Linux
volume probe reproduces exit 1 at `1000:1000 0600` and exit 0 after the sole
change to `0644`. The replacement gives only this generated Caddyfile a named
`0644` writer; secrets and the generated Compose override stay `0600`, the
private fixture root stays `0700`, and the entrypoint, health windows, Compose,
Identity image, and secret contract are unchanged.

The first authorized server cutover of the prior frozen candidate reached the
complete fixed Workflow chain but rolled back at final cleanup: Linux
Flarum/MariaDB bind contents were root/container-UID owned, the deployment user
could not recursively remove them, and the uncaught exception prevented the
final runner report. The production rollback itself was green and that
candidate and authorization are retired.

The replacement cleanup seam is release-controlled and project-scoped. It
validates the exact canonical private directory, fixed runner project name and
top-level allowlist, rejects symlinks, nested mounts, outside paths and any
container reference, and uses the pinned Caddy image only to return ownership
with `CHOWN` and `DAC_READ_SEARCH`; the helper contains no delete operation.
Node then removes the exact directory. An allowlisted report is fsynced before
that step and rewritten afterward, so any cleanup fault remains an explicit
PARTIAL/BLOCKED result instead of suppressing evidence. This is a new
candidate-only contract and does not authorize another server attempt.

## Manifest-controlled release transfer

The prior e64 production attempt is retired. It rolled back before the fixed
runner because a release unpacked under `umask 077` left the bind-mounted Caddy
entrypoint at `0600`. The deployment manifest had authenticated bytes but had
not owned the transfer union or target modes, so the prior manual 95/96-file
union and selected `chmod` repairs were not a deployment contract.

The replacement bundle is exact and self-contained: the deployment manifest,
the deployment `manifest.json`, the canonical Identity source closure, and
generated bundle/source controls are one payload. Every path has an explicit
mode; only the enumerated shell helpers are `0755`, while data, CJS, SQL, YAML,
Caddy, runtime and manifest inputs are `0644`. Secrets are not bundle members.
The root-only preparer accepts only deployment owner `1000:1000`, regular
single-link inputs and canonical direct staging/release children. It installs
into a new `.tmp.PID`, revalidates bytes, owner, mode, runtime, Compose, Caddy
and both manifests, fsyncs, then atomically renames without replacing an
existing release. Cutover verifies the prepared marker before evidence,
backup, migration or service mutation.

The first server preflight of that prepared release exposed one remaining
runtime-owner inconsistency before evidence or backup: root preparation had
created `.workflow-runtime` as `root:root`, while deployment-user cutover
correctly required `1000:1000`. The replacement helper now has one fixed
production owner projector. Root is accepted only with the exact sudo caller
`1000:1000`; a direct caller must itself be `1000:1000`; every other or
malformed identity fails closed. The runtime directories are `1000:1000 0755`
and the single verified binary is `1000:1000 0555`. Cutover consumes the same
helper and carries no root exception or second metadata check.

Independent A-E then exposed a fresh-PostgreSQL readiness race in both the
outer Identity migration and the nested fixed runner. `compose.server.yaml`
used `pg_isready` without a host, so the official image's initialization-only
Unix-socket postmaster could satisfy Compose health while a sibling migration's
TCP connection still received `ECONNREFUSED`. The combined independent report
SHA-256 is
`8e9bbd6cb30b871019303deb4aa22447e62cad27c0567054ed4a51ecbbf32fd2`.

The replacement changes only the shared production PostgreSQL health probe to
`pg_isready -h 127.0.0.1 -U aihub -d aihub`. Both migration paths already wait
on that one Compose `service_healthy` condition, so no duplicate readiness
helper, sleep, timeout widening, database-layout change, or Workflow/Identity
semantic change is introduced. A true-Linux fresh-volume probe must prove the
socket-only server leaves health `starting` while sibling TCP is refused, and
that final health becomes `healthy` only when the sibling TCP probe succeeds.
The previous `eb1` freeze remains blocked; the replacement hashes below are
valid only after the deployment manifest and bundle are regenerated.

Frozen candidate supply-chain facts:

- deployment set digest:
  `8e7d15dd4bae1581e985d2b4eda106094b6ec567ed8b9a10c9d9e10ad8b366e1`
- deployment manifest SHA-256:
  `656feb0b407840e3366afe194c65119a79016dffb9f7f2ca9ab646baf9181401`
- release bundle manifest SHA-256:
  `74ec4bc70c64bc771a6ec4bf4f6f08db7a407c5267832bffedf6c51516aa8bd6`;
  payload digest:
  `d0c0650f7db8784b059e45b62aa26cc4166d966aff32ddd7bd677ce10aba5c3d`
  for 98 files and 12 directories
- bundle module SHA-256:
  `b41d4dae93e9e992a4665923dda1976009e6d55e2e962460bcd709de33a1fb5b`
- release preparer SHA-256:
  `a64e10b8ee94a7c9003f97770b35be1ec8478b2c82bad6335d084cc7e3e2aede`
- runtime helper SHA-256:
  `e7c45eb59ea6bff36d42a976df77a144627592ec6d8f5a4751f06c816994100b`;
  true-Linux 26-case owner/tamper report SHA-256:
  `a1736ded937c41094782012d265307eee05acfaab9a9096a1d16caec97f8ebbc`
- production cutover SHA-256:
  `71b4f3064e6a05ef9163607ae364341748559e4e5f8e4635ce949375a3570a23`
- temporary acceptance runner SHA-256:
  `afc771766d58b12063264ef0f025e0e2701e96ec37405e7d7dd9a24fe077d40e`
- Identity source digest:
  `19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c`;
  source manifest SHA-256:
  `7d2aacacaeccae09ca6908d1dce6c5d387d68c43832a58d667f40d662f47853a`;
  existing immutable image:
  `sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567`.
  The 64-input source closure is unchanged, so the image was not rebuilt.
- true-Linux `umask 077` prepare/failure-matrix report:
  `output/workflow-production-release-bundle-linux-9b559e6707/report.json`,
  SHA-256
  `41c911c50a040dc5e255dad41c9f14d2700a82b82a6024be6b0fa7c933b5fd5e`
- true-Linux fresh-PostgreSQL TCP-readiness report:
  `output/workflow-postgres-tcp-readiness-probe-20260808/report.json`, SHA-256
  `b5aeac9e2ec213a374b05407c5ac63560c1d60670847fb29bf3d00a67748212f`
- full prepared-release cutover report:
  `output/workflow-production-release-bundle-cutover-1846cd8b1a/report.json`,
  SHA-256
  `7fb9c19aa176bf36a4572115cae86fb90e6c51de73c09745f027386ce6670045`;
  success report SHA-256:
  `ca71992b6e08e477e7109d10ec43b2e7f05e5f237ff48cc1f2ed4a2bd1c3ba3a`;
  nested fixed-runner report SHA-256:
  `fb5bc3637eb024c834d21e3047d1e999a37fc8e6d80274bfdbf45faa6ce43ed8`;
  deliberate reviewer-probe failure/rollback report SHA-256:
  `40bbcba260cece4f49eda9d7586cf4b40654d8de67b4790ac964d47dd5eaaeed`.

This remains `candidateOnly=true`, `deployable=false`. The local Linux and
full-cutover results are not a server retry or independent test/release A-E.
No server upload, deployment, production secret, catalog/state/signature write
or client package is authorized by this candidate freeze.
# Official public-store bootstrap integration note (2026-08-09)

The next candidate freeze uses Identity COPY closure `f18ec9d51b4e30bb01323e0d1c752d94a4b9e32556ef1e7dd845e3bfcdc358ee` and image tag `zhenxing-ai/identity:workflow-readiness-candidate-f18ec9d51b4e`, image ID `sha256:e76979a8c827eb4feb6e1f14026d8813f487535df654838299d139817b856731`. The base ONLINE overlay remains unchanged in behavior; the official one-shot is disabled unless the explicit `workflow-official-bootstrap` Compose profile is selected. Local build/label/non-root/71-COPY/secret scan verification passed, but the candidate remains `candidateOnly=true` and `deployable=false`.
