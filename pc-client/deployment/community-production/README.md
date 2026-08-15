# Identity + Community production candidate

Candidate only. Do not deploy from this directory until every blocker below is
closed and the CTO separately authorizes a server change. Production images
must be built and verified locally, transferred by digest, and started with
`docker compose ... up --no-build`.

## Pinned Flarum candidate

Both runtime and explicit migration services are pinned to
`zhenxing-ai/flarum:community-candidate-8b13962a36bf`. Its source snapshot is
`output/community-production-source-snapshots-v3/flarum/8b13962a36bf031652bd5863163948ed245314f0025852a9529fdbacbbcab3f6/`
and its content SHA-256 is
`8b13962a36bf031652bd5863163948ed245314f0025852a9529fdbacbbcab3f6`.
The immutable image ID is recorded in the candidate handoff; rebuilds or image
substitution require a new snapshot, local verification and explicit Compose
update. This image contains no signing private key, deployment secret, user
data or PC package.

## Topology and exposure

- `zhenxingai.com`: existing catalog endpoints plus public `/v1/*` Identity
  endpoints. `/v1/internal/*` and
  `/v1/community/workflow-store/reviewer/*` are always `404`; the Workflow
  reviewer bridge is S2S-only and is never exposed by Caddy.
- `community.zhenxingai.com`: public Flarum, except `/admin`, the personal-center
  bridge, and the community-management bridge, which are always `404` publicly.
- `127.0.0.1:4174`: CMS through an SSH tunnel. Caddy injects the CMS gateway
  secret server-side only for the two community-management API paths; the
  browser never receives it. The host-owned `0600` source is never bind-mounted
  into Caddy. A separately authorized root operator streams it over stdin into
  `seed-caddy-secret-volume.sh`, which atomically writes a root-owned mode-`0400`
  derivative in one dedicated Docker managed volume. Caddy mounts only that
  volume read-only. `caddy-entrypoint.sh` starts as root long enough to read and
  validate the derivative and set fixed UID/GID `65534:65534` only on the
  managed volume roots `/data`, `/config`, and their existing direct `caddy`
  directories. It never recursively traverses runtime-created state or any
  nested mount. This matters because Caddy creates private `caddy/locks` state;
  bootstrap intentionally has no `DAC_OVERRIDE`, so a later recursive `chown`
  cannot traverse that directory after the first non-root run. It then passes
  the value in the current process environment and immediately replaces itself with Caddy
  under that non-root identity. It never changes the source or derivative
  secret mode, writes another temporary copy, or prints the value. The
  long-running Caddy process must have zero effective capabilities.
- `127.0.0.1:4173`: raw read-only Admin recovery endpoint. Community management
  still rejects requests without the private Caddy-injected secret.
- PostgreSQL, MariaDB, Identity, and Flarum expose no host ports.

## Single Caddy replacement boundary

This Compose file is the replacement for the currently running Admin-only
gateway. Its one Caddy service owns both `zhenxingai.com` and
`community.zhenxingai.com`; it must never run concurrently with the current
Admin-only Caddy on ports 80/443. Set `AIHUB_CADDY_DATA_VOLUME` and
`AIHUB_CADDY_CONFIG_VOLUME` to the two inspected existing Admin-only named
volumes so certificates and ACME state are reused, never copied into the
release tree.

After every blocker in this document is closed, a separately reviewed switch
must use this order (the project/compose paths are explicit operator inputs):

1. Record old/new Compose configs, image digests, container health and the two
   Caddy volume names; validate a backup and isolated restore drill.
2. Start only the new database services. After the verified backup exists, run
   `run-migrations.sh COMPOSE_FILE ABSOLUTE_BACKUP_DIRECTORY` as a separately
   authorized step. Do not start Identity, Flarum, Caddy or Admin yet.
3. Preserve timestamped old Caddy/Admin logs and inspect output, then run
   `docker compose -p OLD -f OLD_COMPOSE stop caddy admin`.
4. Start the new stack once with `docker compose -p NEW -f compose.server.yaml
   up -d --no-build`. Accept only when exactly one container owns 80/443,
   exactly one Admin owns loopback 4173, both public hosts pass TLS/health, the
   CMS is reachable only through loopback 4174, and all signed catalog hashes
   remain unchanged.
5. On any failed gate, capture new Admin/Caddy/Identity/Flarum/database logs
   before teardown; run `docker compose -p NEW -f compose.server.yaml down`
   without `--volumes`, then restore the previous gateway with `docker compose
   -p OLD -f OLD_COMPOSE up -d --no-build admin caddy`. Database/file restore is
   used only when an authorized migration changed durable state.

The old project, images, volumes and verified backup remain intact through the
observation window. This is a runbook contract, not authorization to execute a
server switch.

The CMS browser sends only same-origin JSON. Community writes additionally
require the exact `Origin`, `X-AIHub-CSRF: 1`, and `Content-Type:
application/json`. Admin calls only the fixed
`http://community/aihub-community-management.php` path. No request field can
select a URL, path, header, credential, command, or Flarum actor.

## CMS API contract

`GET /api/community-management` returns this fixed shape:

```json
{
  "status": "ready",
  "health": "ready",
  "users": { "status": "ready", "total": 0 },
  "posts": { "status": "ready", "total": 0 },
  "pending": { "status": "unavailable", "total": null, "reason": "moderation-extension-not-configured" },
  "reports": { "status": "unavailable", "total": null, "reason": "moderation-extension-not-configured" },
  "targets": { "discussions": [], "posts": [] },
  "capabilities": { "setDiscussionHidden": true, "setPostHidden": true, "nativeAdmin": false }
}
```

An unavailable upstream returns the same top-level shape with `status` and
`health` set to `unavailable`, null metric totals, empty targets, and every
capability false. `POST /api/community-management/actions` accepts exactly one
of these JSON bodies and no extra fields:

```json
{ "action": "set-discussion-hidden", "discussionId": "42", "hidden": true }
{ "action": "set-post-hidden", "postId": "42", "hidden": false }
```

Success is `{ "ok": true, "action": "...", "target": { "type":
"discussion|post", "id": "42" }, "hidden": true|false }`. Authentication or
CSRF failures are `403`; an absent feature is `404`; an unavailable private
upstream is `502` or `503`; unknown targets are `404`. There is no native Admin
redirect, iframe, arbitrary proxy, or browser-visible bridge secret.

Flarum's session cookie remains host-only for `community.zhenxingai.com`, with
`Secure`, `HttpOnly`, and `SameSite=Lax` expected from its HTTPS base URL. It is
never shared with `zhenxingai.com` or the loopback CMS. Identity continues to
use bearer tokens rather than browser cookies. The existing 60-second,
single-use handoff is redeemed over the Docker network and redirects to a URL
without the ticket.

## Resource envelope

The normal runtime caps containers at 1,344 MiB and 2.55 CPU in total:

| Service | Memory | CPU |
| --- | ---: | ---: |
| Admin | 192 MiB | 0.75 |
| Identity | 192 MiB | 0.35 |
| PostgreSQL | 256 MiB | 0.40 |
| Flarum | 320 MiB | 0.45 |
| MariaDB | 320 MiB | 0.45 |
| Caddy | 64 MiB | 0.15 |

This targets the current 2-core, 4-GiB host. Swap is an
outage cushion, not build capacity. No image may be built on that host.
Migration jobs reuse the corresponding Identity/Flarum limits and run one at a
time while application containers are stopped; their limits are not additive
to the runtime envelope.

The Admin and Identity Docker liveness probes call their lightweight `/health`
endpoints through a bounded, non-keepalive Node HTTP request. Publication
validation stays on `/ready`: it can exceed the fixed three-second liveness
budget while verifying the signed catalog. Do not use `/ready` as a Docker
healthcheck or replace the probe with a keep-alive `fetch` promise.

Identity does not trust Docker DNS names generally. Its production catalog
source is an explicit `signed-internal-admin` seam that accepts only
`http://admin:4173/catalog-release.json`. Similar hosts, ports, paths, query
strings, credentials, and the v2 route are rejected. The image carries only the
public catalog verification key from `catalog/channel.json`; every response is
signature-, payload-, full-catalog-, and process high-water-validated before
product IDs are used. The Compose baseline pins v1 catalog 72 and its catalog
SHA-256 so a restarted service cannot fall below the release deployed with this
contract. The signing private key is never copied into Identity or the server.

Identity starts one shared signed-catalog projection warmup during startup, but
does not block `/health` or `/ready` on that remote dependency. Workflow owner
capability is false until `readiness().ready` is true. A cold, expired, failed,
or retrying projection therefore returns safe HTTP 503 from owner ingress; only
a completed verified projection that lacks the exact tuple returns HTTP 400.
Concurrent warmup and ingress calls share one in-flight fetch, and failures
clear that promise in `finally` so a later attempt can retry. This readiness
seam does not weaken TLS/source, Ed25519, catalog SHA, rollout, validation, or
high-water gates.

## Secrets and durable data

Create an external root-readable secret directory outside the release tree.
Every file must be generated independently and permissioned for the deploying
operator only. Required filenames are listed under `secrets:` in
`compose.server.yaml`; there are no defaults. The catalog signing private key
is deliberately absent.

Persistent bind directories are required for both databases, Flarum config,
storage and assets, and the existing read-only Admin state. Caddy reuses the
two existing external named volumes identified above. All durable state stays
outside the release/build context and must not be replaced by an application
upgrade.

Caddy consumes exactly one secret, `community_cms_gateway`. The separate
`community_management` credential is mounted only into Admin and Flarum and is
never visible to Caddy. The Caddy service no longer uses the Compose file-secret
bind for `community_cms_gateway`; it mounts only the external
`AIHUB_CADDY_CMS_SECRET_VOLUME` at `/run/aihub-caddy-secret:ro`. Caddy's
bootstrap is explicitly `user: "0:0"` with only `CHOWN`, `SETUID`, `SETGID`,
and `NET_BIND_SERVICE` available before the UID/GID drop. Runtime proof must
show PID 1 as `65534:65534` with `CapEff=0` and show that this identity cannot
read the mode-`0400` derivative. The authoritative host source remains owned by
the one approved deployment operator at mode `0600` and is never in Caddy's
mount list. The currently deployed Admin-only contract does not enable
community management and does not mount or read this source, so seeding its
derivative cannot affect the old stack.

If the authority is absent or fails the source content gate, do not trim,
rewrite, or reuse it. First obtain separate CTO authorization to issue a new
gateway-only value. Confirm from both the active Compose contract and
`docker inspect` that no running container mounts the absolute target, then run:

```sh
sudo -n bash deployment/community-production/issue-caddy-gateway-secret.sh \
  /ABSOLUTE/DEPLOYMENT-OPERATOR-SECRET-DIR/community_cms_gateway
```

The issue script accepts only that one absolute, canonical target path. It has
the same EUID-0 and exact sudo-caller owner seam as the host seed script and
requires the existing authority to remain a regular, non-symlink, single-link
file at mode `0600`. It checks running Docker mounts before generation and
again immediately before commit. It never reads or transforms the old value.
Within the same directory it creates an unpredictable temporary file under
`umask 077`, uses OpenSSL's system CSPRNG to produce exactly 64 lowercase hex
characters without a newline, validates owner/mode/content, syncs the file,
and atomically renames it over the authority. Any pre-commit failure removes
only the temporary file and leaves the old authority untouched. The committed
file remains owned by the approved sudo caller at mode `0600`. No value or
content hash is accepted through arguments/environment or written to output,
logs, images, Compose, or audit records; an audit may contain only timestamp,
path, owner/mode/link/byte metadata, and outcome.

The old Admin-only Compose contract does not mount or enable this gateway
secret, so it is not a rotation consumer and rollback to that stack does not
depend on the old value. Do not keep a copy of the old secret. The fixed order
is: issue the authority once, seed a newly named managed volume from that same
file, run the isolated probe, and only then request a separate formal-cutover
authorization.

After a valid authority exists, create a new dedicated volume while Caddy is
stopped. Run the seeder as root so the source never crosses a command argument,
environment variable, Compose interpolation, image layer, or log:

```sh
sudo -n bash deployment/community-production/seed-caddy-secret-volume.sh \
  zhenxing-ai-community-cms-secret-v1 \
  /ABSOLUTE/DEPLOYMENT-OPERATOR-SECRET-DIR/community_cms_gateway
```

The host script itself requires EUID 0. Under `sudo`, it accepts only a regular,
non-symlink, single-link source whose numeric owner is the exact
`SUDO_UID:SUDO_GID` supplied by sudo; when invoked directly by root with no
sudo caller identity, it accepts only `0:0`. There is no owner parameter or
AI Hub environment override. It always requires mode `0600`, 32-512 printable
bytes, and no newline or control character. It rejects an attached target
volume, streams bytes only over stdin, writes a same-volume temporary file
under `umask 077`, and atomically renames it to `community_cms_gateway` as
`root:root 0400`. Invalid or interrupted input removes the temporary file and
preserves a previous valid target. Repeating the same seed is idempotent. Set
`AIHUB_CADDY_CMS_SECRET_VOLUME` to that exact volume name before Compose config
validation.

The managed volume is a disposable runtime derivative, not a new source of
truth. Do not export it into application backups or copy it between hosts; on
loss, reseed from the approved host source. `docker compose down` must not use
`--volumes`, and the external volume remains available for application
rollback. For rotation, stop Caddy, seed a new uniquely named volume, validate
it with the isolated probe, switch the environment pointer once, and retain
the prior volume through the observation window. Rolling back a secret
rotation also requires the secret owner to restore the matching authoritative
host value used by Admin; never make two gateway values active at once.

Before any cutover authorization, run the production-equivalent probe on the
same server. It uses an isolated network, disposable volumes, the pinned Caddy
and Node images, and one loopback high port; it never binds 80, 443, 4173, or
4174 and always removes its containers/network/volumes after capturing logs and
inspect evidence:

```sh
sudo -n bash deployment/community-production/probe-caddy-secret-volume.sh \
  /ABSOLUTE/DEPLOYMENT-OPERATOR-SECRET-DIR/community_cms_gateway \
  /ABSOLUTE/EVIDENCE-DIR/caddy-secret-probe \
  14174
```

All three host commands deliberately use explicit `bash`; correctness does not
depend on executable mode surviving a Windows-created tar archive. The probe
also invokes the host seed helper through `bash`. Container entrypoints already
use explicit `/bin/sh` in Compose/Docker arguments and likewise do not depend
on a transferred executable bit. File SHA-256 verification remains mandatory.

Acceptance requires at least three passing Docker health records, CMS GET and
action `200`, near-path `404`, unrelated write `503`, PID 1 UID/GID
`65534:65534`, `CapEff=0`, non-root denial on the derivative, no temporary
file, and no source value in logs or inspect. A passing probe is only a
pre-cutover gate; it does not authorize a switch.

### Windows local acceptance only

The Linux production contract remains an ext4 bind directory selected by
`AIHUB_COMMUNITY_DB_DIR`. Do not map an NTFS `C:\` directory to MariaDB's
`/var/lib/mysql` for a Docker Desktop acceptance run: MariaDB then enables
case-insensitive table handling, which makes Flarum's bundled tags migration
fail during its table rename.

Use the base file together with `compose.windows-acceptance.yaml` for a fresh,
disposable Windows acceptance database. The override replaces only the
community database mount with the Docker-managed Linux volume
`community_acceptance_database`; it does not alter production storage or the
other durable mounts. Preserve that named volume until the acceptance evidence
has been retained, then remove it only under a separate cleanup authorization.

## Backup, migration, and restore

1. Run `backup.sh` against a healthy stack. It atomically produces PostgreSQL,
   MariaDB, Flarum config/storage/assets, image metadata, and `SHA256SUMS`
   outside the release tree. `COMMUNITY-FILES.json` records the exact file
   contract. The live archive excludes only
   `var/www/html/storage/formatter`, which is Flarum's generated s9e renderer
   cache; config, all other storage, uploads, avatars and extension assets
   remain included. Tar warnings are fatal, and source roots containing
   symlinks are rejected rather than followed.
2. Run `restore-drill.sh` against that backup. It restores both databases into
   isolated disposable containers and extracts the Flarum files into a
   temporary directory; it never connects to production services. The drill
   requires the exact `COMMUNITY-FILES.json`, rejects unsafe archive paths or
   entry types, and requires the generated formatter cache to be absent.
3. Keep application containers stopped and database containers available.
   `identity-migrate` and `community-migrate` are isolated behind the Compose
   `migration` profile. `run-migrations.sh` first verifies the backup
   `SHA256SUMS`, then runs the two jobs sequentially. Identity executes its
   existing idempotent `schema.sql`; Flarum performs its install-if-needed and
   idempotent migrations, clears generated cache, and recreates/chowns the
   formatter directory before runtime regenerates its renderer. Both exit
   without listening, and any failure stops
   the script before applications start. Normal Identity and Flarum services
   use `external`/`runtime` modes that do not write schema. Do not treat normal
   application startup as migration approval.
   The candidate Workflow schema is deliberately excluded from both normal
   startup and `run-migrations.sh`. After the backup hash has been verified,
   a separately authorized operator may run exactly one explicit action with:

   ```sh
   bash deployment/community-production/run-workflow-migration.sh \
     /ABSOLUTE/PATH/compose.server.yaml \
     /ABSOLUTE/PATH/VERIFIED-BACKUP \
     apply|verify|rollback
   ```

   This generic runner is for isolated candidate checks. A production rollback
   must instead use `run-workflow-production-migration.sh`, which treats an
   absent `community_workflow.events` table as no-op, permits rollback only at
   zero events, and rejects any state-check error or written event.

   The `workflow-migration` profile starts a one-shot Identity-image job with
   no host port. `apply` refuses an existing schema and verifies its tables and
   append-only trigger; `verify` performs no write; `rollback` requires a
   separate authorization, drops only `community_workflow`, and verifies its
   absence. A failed job prevents application startup. Normal Identity and
   Community entrypoints never dispatch this runner.
4. Start the new prebuilt images with `--no-build`, check every service health,
   exercise SSO and CMS reads/writes, then keep the prior images and backup for
   the full observation window.
5. Roll back application images first. Restore database/file backups only if a
   migration changed durable data, using the already rehearsed procedure.

Legacy `discussions`, `discussion_replies`, and `community_interactions` remain
compatible production interfaces. This candidate does not stop their writes,
migrate their rows, remove routes, or drop tables. `community_profiles` and all
current Flarum fact tables are permanent. COMMUNITY-002 must proceed in its
documented P0-P5 order.

## Workflow Store production-enable candidate

The production base pins all Workflow/resource-submission/schema flags to
`"0"` and mounts no Workflow reviewer secret. It cannot enable the candidate.
The two overlays are deliberately non-interchangeable:

- `compose.workflow-acceptance.yaml` is isolated-test-only and uses only an
  acceptance reviewer identity.
- `compose.workflow-production.yaml` is the candidate-only formal production
  enable contract. It changes only Identity's required flags, its fixed
  reviewer identity, one Identity-only provision job, and one reviewer-secret
  mount. It has no fixture, test user, loopback high port, or
  Admin/Caddy/Flarum override.

The r12 in-place candidate has one exact Workflow-only profile: resource
submissions, its schema version, and Workflow-submission lookup are all `"0"`;
the Workflow owner store, public store, and Workflow schema version are all
`"1"`. Resource-submission migration `0001` remains candidate-only and is not
part of this production path: its five tables must be absent. The legacy
all-`"1"` profile is historical evidence only, never an r12 success state.
Any missing, duplicate, or other mixed profile is invalid. The profile
additionally needs a fixed `/run/secrets/workflow_review_secret`
and the governed reviewer identity
`5f16d5ac-6663-5905-b920-c2140ac6769c`. This ID is the UUIDv5 of the DNS
namespace and `zhenxing-ai/service-identity/workflow-reviewer/v1`; it is not an
operator variable and is never the acceptance reviewer. A missing flag,
repository, resolver, schema, exact identity, or secret leaves the relevant
capability false; partial enablement is not valid. The browser, renderer,
Admin, Caddy, Flarum, and Community process never mount this secret, and no
client request may supply `reviewerId`.

The reviewer authority is a host file with fixed basename
`workflow_review_secret`: a regular single-link `0600` file owned by the exact
sudo caller (or `root:root` for a direct root call), 32-512 printable bytes and
no control character. It is mounted only into Identity. The existing Caddy and
Workflow issuers share `host-secret-authority.sh`; there is no duplicate
caller-owner, active-consumer, CSPRNG, atomic-rename, or audit implementation.
Use explicit `bash` only, with no secret value in an environment variable,
argument, image, repository, Compose file, or log:

```sh
sudo -n bash deployment/community-production/workflow-review-secret.sh issue \
  /ABSOLUTE/DEPLOYMENT-OPERATOR-SECRET-DIR/workflow_review_secret
sudo -n bash deployment/community-production/workflow-review-secret.sh validate \
  /ABSOLUTE/DEPLOYMENT-OPERATOR-SECRET-DIR/workflow_review_secret
```

`issue` uses a system-CSPRNG 64-character value, validates metadata/content
class, syncs, and atomically renames. `validate` does not print a value.
`revoke` first rejects an active consumer, then removes the active authority
name by moving it to a timestamped retained record with metadata-only audit.
Before rotation/revocation, emergency-disable Workflow/submission capability;
after observation, issue/validate the new authority and restart only Identity.
The existing Caddy gateway authority is unrelated, and Caddy keeps public
reviewer/internal paths at `404`.

The reviewer is a disabled, non-login `workflow-reviewer-service` row with no
email, phone, password, profile, avatar, device, session, browser handoff, or
email-change relation. Candidate constraints reject those relations. The
one-shot `workflow-reviewer-provision` service is an Identity image role, so it
may read the same reviewer secret solely to validate its file contract; it
never prints the value and exits before normal long-running Identity starts.

Identity contains exactly one copy of `community/workflow-store.cjs` and its
PostgreSQL persistence adapter. Product/resource dependencies are checked
against the same active signed Admin release and an exact resource/host/binding
tuple; the fixed internal HTTP seam does not weaken signature or high-water
validation. Licenses use the fixed canonical allowlist in
`identity/workflow-resolvers.cjs`. Flarum post existence uses one GET to the
fixed `http://community/api/posts/<numeric-id>` path with no redirect,
credential, caller header, or configurable URL, a two-second timeout, and a
64-KiB response cap. Public identity projection reads only active Identity IDs
and public nicknames from PostgreSQL.

If the schema flag, reviewer secret, repository, or any resolver is missing,
the owner/reviewer/submission lookup chain remains false. `unknown`, a resolver
error, timeout, malformed response, or any result other than literal `true`
fails closed. Signed-catalog dependency unavailability is specifically 503 and
must not be reported as canonical absence; license and Flarum-post validation
retain their fixed not-approved/not-found semantics. The acceptance override is
not a production enablement contract.

The fixed official-bootstrap public readback reaches Identity directly over
loopback HTTP, but reaches Caddy only over internal TLS at `caddy:443`.
Connection authority is not configurable: TLS SNI and the HTTP `Host` header
are both the validated `AIHUB_PUBLIC_HOST`, the request uses no agent, follows
no redirect, and retains Node's normal certificate verification. A redirect,
untrusted certificate, hostname mismatch, non-200 response, or list other than
exactly three safe public items fails the bootstrap stage. Reports retain only
status classes and item counts, never URLs, headers, certificates, or bodies.

### Release-scoped host Node runtime

The production host does not need and must not install a system Node package.
The frozen deployment bundle carries exactly Node.js `v24.18.1` Linux x64 as
`runtime/node-v24.18.1-linux-x64.tar.gz`, together with the official
`SHASUMS256.txt` and an allowlisted metadata record. The source URL and checksum
URL are fixed in that record; neither cutover nor an operator can select a URL,
version, platform, or archive through arguments or environment variables.

Transfer the whole manifest-controlled deployment directory, including the
57,254,099-byte archive. Before backup or migration, cutover sources
`workflow-node-runtime.sh`. Its read-only preflight requires a canonical
Linux/x86-64 host, kernel 4.18+, glibc 2.28+, at least 512 MiB free, and exact
regular/non-symlink, approved-owner, mode-0644, single-link, byte-size and SHA
matches for both source files. `bash workflow-node-runtime.sh preflight` is the
fixed transfer gate; it does not prepare the runtime or modify the host.

The one production owner projector is fixed to deployment UID/GID
`1000:1000`. A direct deployment-user call is accepted only when its real
UID/GID are exactly that pair and no sudo identity is present. A root bootstrap
is accepted only when `SUDO_UID=1000` and `SUDO_GID=1000`; missing, partial,
zero, malformed, out-of-range or different sudo identities fail closed. These
values are constants in the manifest-controlled helper, not operator inputs.

Preparation extracts only the verified `bin/node` and atomically installs it
under the release root's `.workflow-runtime/node-v24.18.1-linux-x64`. The
runtime parent, home and `bin` directories are exactly `1000:1000 0755`; the
single regular binary is `1000:1000 0555`, link count one, and retains the
frozen bytes/SHA/version/platform/architecture identity. The helper validates
that same projection when root prepares and when the deployment user later
runs cutover. It is retained with release/rollback evidence and never
overwrites a system path or changes host `PATH`. Missing/corrupt assets,
symlinks, hard links, wrong owner/mode, an existing invalid destination, wrong
host architecture/ABI/version, rename failure or execution failure stop before
backup and clean only the exact new runtime temp.

Production rejects every runtime override. A full Docker Desktop cutover test
may use a separately pinned official Windows x64 binary only when both
`AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE=1` and
`AIHUB_WORKFLOW_NODE_RUNTIME_ISOLATED_ACCEPTANCE=1` are set and
`AIHUB_WORKFLOW_NODE_RUNTIME_ACCEPTANCE_PATH` is a canonical absolute file with
the frozen owner/mode/size/SHA/runtime identity. This test-only path never
enters Compose, Identity, Caddy, the production bundle, or application state.

### Future single-cutover sequence

This is candidate-only; do not run it on a server yet. First verify the manifest
and the prebuilt Identity label/source digest. The exact candidate is
`zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e`, image
`sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748`,
source `2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7`.

The prepared release is self-contained for rollback. It carries the exact
protected 19a Docker/OCI archive at
`artifacts/identity-19a-rollback-image.tar` (58,887,168 bytes; SHA-256
`9205edae43228dd7afb66bf179ff321c032f2d8e47e71f61d65fc4165b56e904`).
One manifest-controlled verifier recursively closes its OCI index, runnable
manifest, attestation, config, and layers. Cutover and the disposable production
harness load it before relying on the old image, then require the exact 19a
tag, image ID, source/release labels, and `User=node`; they never rebuild,
retag, pull, or accept a daemon-cache substitute.
The same bundle carries two single-image recovery artifacts derived from the
preserved `community-production-images.tar` without rebuilding or retagging:
`artifacts/admin-old-b6ea4c5bd0e9.tar` (60,279,808 bytes; SHA-256
`2604d520d1c0a428725c73f507598785cdbdb4c78ac80fba937eec4f953f0ad0`)
and `artifacts/flarum-8b13962a36bf.tar` (239,078,912 bytes; SHA-256
`2ed8a402b6020f8c7197c53ca2b3ded956b2ea57a616dd12ba8ef044844c779f`).
The same recursive validator rejects extra images or descriptor drift. Cutover
loads and inspects only the old Admin artifact before production preflight; the
fresh disposable harness loads and inspects Flarum before it creates a project
or Docker network. Official digest-pinned PostgreSQL, MariaDB and Caddy remain
an aggregate local-image preflight and are not duplicated into the bundle.
The three Identity roles in `compose.server.yaml` pin this tag; rebuilding is
prohibited unless the 74-input source closure changes. The production overlay
pins the same image for its one-shot provision role.

The cutover must not be called as a foreground child of an operator session.
Its `EXIT HUP INT TERM` rollback trap is retained: a signal delivered to the
cutover still disables Workflow and restores the exact prior images/state. The
only supported production entrypoint is the manifest-controlled
`workflow-production-cutover-launcher.sh`. From the fixed UID/GID `1000:1000`
deployment shell, with the existing allowlisted production path/config
environment already exported, run:

```sh
bash /opt/zhenxing-ai/releases/community-production-VERSION/deployment/community-production/workflow-production-cutover-launcher.sh launch
```

The launcher verifies the prepared marker and pins the deployment set,
deployment manifest, prepared marker, bundle manifest and payload hashes in a
fixed `0600` request. It atomically claims the one run ID
`workflow-production-r11`, starts the fixed system transient unit
`zhenxing-ai-workflow-production-r11.service`, and returns a receipt without
waiting for cutover completion. `systemd-run` receives only the fixed worker
path plus a clean `PATH`/locale; secret values are never present in its argv,
unit environment, journal or receipt. The worker reads only allowlisted
non-secret paths/config from the fixed `0600` control file, then the unchanged
cutover reads secret files at those paths. Missing noninteractive system-manager
authorization fails before a receipt; do not substitute `nohup`, `setsid`, an
HUP-ignore wrapper, a user transient unit or a custom daemon.

After receipt, every new operator connection polls only the fixed status file:

```sh
bash /opt/zhenxing-ai/releases/community-production-VERSION/deployment/community-production/workflow-production-cutover-launcher.sh status
```

Only `succeeded` or `failed` is terminal. The worker records a terminal status
even when its own pre-cutover verification fails. Existing control/evidence or
the fixed unit makes a repeated/concurrent launch fail closed; a failed r8 run
is never relaunched from the same release. Review its fixed evidence and freeze
a new run/release instead.

The manifest-controlled cutover sequence is: read-only conflict preflight,
verified absolute backup, reviewer identity migration/provision/exact verify,
Workflow migration/exact verify, production overlay, health and fixed isolated
runner. The provision and both migrations run inside one held Node process.
Its opaque current-run rollback receipt is never serialized, placed in an
environment variable, argument, report, or log. Cutover sends `commit` only
after all later gates pass; any earlier failure or a closed control pipe asks
that same process to roll back.

The historical r11 preflight admits only fully enumerated old-image/active6
states. r12 does not reuse r11 for launch. Its in-place preflight begins from
the exact disabled profile and retained state, then may end only at the exact
Workflow-only profile above. The retained state requires all flags disabled, exact 9/9/9 append-only history for
the three manifest workflows, exact operation/actor/reference/idempotency
hashes, one disabled official publisher with no relations, and exactly the
three manifest source discussions/posts with successful GET readback. A fixed
read-only MariaDB count rejects any fourth marker-shaped official source
discussion. Partial, extra or unknown state fails before activation. Retained
data is preexisting: success must replay idempotently without reaching 18, and
failure rollback keeps its 9/9/9 history, publisher and three source posts.

The local-only `scripts/workflow-production-readonly-preflight.cjs` coordinator
is deliberately outside this deployment manifest and has two authorization
stages. The CLI owns the fixed System32 OpenSSH executable and the fixed
deployment key/`known_hosts` authority; callers cannot substitute those paths.
`pre-transfer` starts exactly one strict-known-hosts SSH process and counts a
remote connection only after the fixed remote receipt. It checks exact
deployment UID/GID, free space, absence of the r11 release/control/evidence/
unit/process namespace, zero concurrent cutovers, and the six healthy prior
images using static Linux/Docker/systemd reads; a pass means only
`transfer-prepare` may be considered separately. `post-prepare` is callable
only after that separate action has produced a canonical r11 prepared release.
It invokes the release-scoped Node v24.18.1 binary directly with a clean
environment, verifies the full prepared payload and runtime, requires every
module from that same release, and performs the retained-state, source-post,
disabled-capability, public-disabled and secret-consumer reads in memory. It
does not use host PATH Node, a Flarum/Caddy Node binary, remote evidence files,
Compose mutation, image loading or a launch call. A Phase 2 pass means only a
later, separately authorized launch may be considered; failure preserves the
prepared assets and reports fixed enums without raw rows, identifiers, paths,
URLs, credentials or response bodies. Its local preflight deep-verifies the
complete bundle control/table/Identity manifest and every payload path,
byte/digest/link before starting SSH. Its secret evidence binds nine fixed
files and thirteen exact consumers to the canonical production authority root;
the root path and secret values never enter the report.

The standalone migration wrapper remains available for explicit recovery and
zero-event migration drills:

```sh
bash deployment/community-production/run-workflow-production-migration.sh \
  /ABSOLUTE/RELEASE/deployment/community-production/compose.server.yaml \
  /ABSOLUTE/RELEASE/deployment/community-production/compose.workflow-production.yaml \
  /ABSOLUTE/VERIFIED-BACKUP apply
```

The wrapper SHA-verifies the backup and checks only the canonical append-only
`community_workflow.events` table. If that table is absent, rollback is a safe
no-op; if it exists with zero rows, rollback is allowed; if it contains any
event, the wrapper refuses rollback. A failed state query is never treated as
zero. After a written event, retain the schema/data, emergency-disable
capability, restore the prior Identity contract if needed, and recover only
from the verified database backup. Schema rollback is only permitted
immediately after a zero-event migration.

The held provision process applies the Identity candidate migration only after
the backup verifies. A conflicting row, partial schema, forbidden browser
relation, invalid secret, or failed Workflow migration stops before service
replacement. On failure with zero Workflow events/idempotency rows it drops
only schema created by this run and removes the reviewer row only when it holds
the same-process creation receipt. Once either Workflow table contains a row,
it refuses identity/schema deletion; cutover restores disabled base flags and
retains the service identity plus Workflow audit data. No path calls
`down --volumes` or prune.

`workflow-production-cutover.sh` is the future one-shot gate. It verifies the
deployment/Identity source manifests, optionally loads a verified prebuilt
image, records the old Identity image, performs backup and the held
identity-plus-Workflow provision, starts only Identity/Caddy without builds,
waits 90 seconds, captures allowlisted provision status, checks PID 1's
`/proc/1/status` for UID/GID `65534:65534` and empty effective capabilities,
keeps reviewer route `404`, and
proves root catalog bytes do not drift. A failure restores the disabled base
Identity contract without `--volumes` or Docker prune.

It refuses to report success without the manifest-controlled
`workflow-production-temporary-acceptance.cjs`. Cutover invokes that exact file
with Node; no environment variable or arbitrary executable can replace it. Its
only arguments are the exact repository base Compose file, exact production
overlay, and the cutover-created absolute evidence directory.

The runner creates a separately named disposable Compose project with its own
PostgreSQL, MariaDB, Flarum storage, Identity session, Caddy state and secrets.
It never mounts or calls the production Identity, Flarum or Workflow databases.
Its sole real Flarum source post ID is the string `2147483647`; the fresh API
must return HTTP `200`, type `posts`, and that exact ID. IDs above Flarum's
unsigned 32-bit primary-key limit fail closed. No mock, mapping, truncation or
fallback exists.

The fixed chain proves cold capability false plus owner `503`, ready capability
true, idempotent owner create `201`, owner-forgery `400`, submit, missing
reviewer secret `403`, body reviewer-ID `400`, publish, public redaction,
unlist/public `404`, and Caddy reviewer/internal `404`. The isolated database
must contain exactly four ordered append-only events and four idempotency rows.
The report contains only step status/code, booleans, immutable digests and a
hash of the generated Workflow reference; it contains no UUID, token, cookie,
DSN, secret, raw payload/event, URL, SQL or stack.

The `ready` stage starts and waits for Community first and Caddy second. A
failure records only fixed probe/component/reason/status enums, an elapsed-time
bucket, attempt count, and HTTP status class. It never records a Compose row,
container inspect, URL, environment, response body, log, or exception text.
Community has a bounded 240-second wait, just above its own 210-second Compose
health window; Caddy has a separate 150-second wait, just above its own
125-second window. Identity catalog readiness and the exact Flarum/public HTTP
contracts keep their independent limits. These are component-specific health
budgets, not a shared sleep or a relaxed health check.

The full-stack catalog probe uses one `docker exec` and one bounded Node process
for repeated real loopback HTTP requests. Its fixed budget is 30 seconds at a
250 ms interval with a 10-second request bound and a 35-second outer kill bound.
It succeeds only for HTTP `200` plus the exact owner capability values
`enabled=true`, `schemaVersion=1`, `execution=false`, and
`workflowSubmissionLookup=true`; only status, the resulting boolean and the
attempt count cross the child boundary. This capability is not a channel
attestation. Exact signed v2 active7 release ID/version/catalog SHA and parent
remain independently enforced by `catalog-active7-state-activation.cjs`, the
cutover metadata gate and the fixed official-bootstrap v2 one-shot.

The runner-generated Caddyfile is fixed, non-secret configuration and is
written `0644`; its parent private fixture directory remains `0700`. This is a
runtime-readability boundary, not a secret relaxation: the CMS value remains
only in the `root:root 0400` derivative volume and is expanded from Caddy's
process environment. Secrets and the generated Compose override remain `0600`.
Real Linux preserves the bind inode's owner and mode, so a deployment-user
`0600` Caddyfile would become unreadable after the entrypoint drops PID 1 to
`65534:65534`; Docker Desktop bind behavior must not be used as evidence for
this contract.

Success and failure both run `down --volumes --remove-orphans` only for the
runner-owned project, remove its three exact external Caddy volumes, and verify
zero project-labelled residue. It never deletes events, rolls back a written
Workflow schema, prunes Docker, or tears down production. Cleanup failure is
`partial` and makes cutover restore the disabled production Identity contract.
A local runner PASS is candidate evidence only, not deployment authorization.

Linux bind-backed MariaDB and Flarum directories may contain files owned by
container UIDs. Before deleting the private fixture directory, the runner
requires zero container references and validates the exact canonical direct
child `<evidence>/workflowacceptance...-private`, its fixed project prefix, and
its fixed top-level allowlist. On Linux only, a pinned-image one-shot helper is
confined to that one bind with no network, a read-only root filesystem,
`CAP_CHOWN` plus the narrower traversal-only `CAP_DAC_READ_SEARCH`, and no
delete command. It rejects symlinks and nested mounts, returns ownership to the
runner UID/GID, exits, and leaves Node to perform the exact recursive removal.
There is no `sudo`, caller-selected path, broad `rm -rf`, `--volumes` outside
the isolated Compose project, or prune seam.

The runner writes, flushes, and closes an allowlisted BLOCKED/PARTIAL report in
the evidence directory before private cleanup, then writes the final cleanup
booleans after the attempt. Consequently an ownership, mount, symlink,
container-reference, or Compose-teardown failure remains nonzero and cannot be
mistaken for PASS, but it also cannot suppress the minimal report. Only the
runner-owned project is eligible for cleanup; any unapproved entry or active
reference fails closed for operator evidence and a later exact cleanup.

By default the cutover's own read-only Admin catalog probes are pinned to
`http://127.0.0.1:4173`, the reviewer-route probe is pinned to
`http://127.0.0.1:4174`, and the Compose file set is exactly the base file plus
`compose.workflow-production.yaml`. Production mode refuses any isolated origin
or Compose-list override.

A fresh isolated acceptance must set
`AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE=1`,
`AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_ORIGIN=http://127.0.0.1:PORT`,
`AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_REVIEWER_ORIGIN=http://127.0.0.1:PORT`,
`AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES=/ABSOLUTE/list`, and
`AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT=/ABSOLUTE/root`. Both origin
helpers accept only a root `http://127.0.0.1:1024..65535` origin and reject
credentials, paths, query strings, fragments, TLS, non-loopback hosts, IPv6,
`localhost`, control characters, and empty values.

The Compose list is never shell-expanded. The list file and every entry must be
canonical absolute regular non-symlink files, link count `1`, approved owner,
and not group/other writable. The first two entries must be the exact base file
and production overlay. The final three entries must live under the approved
acceptance root and have the exact basenames `compose.windows-acceptance.yaml`,
`ports.override.yaml`, and `caddy.override.yaml`, each once. The same normalized
argv array is used for `config`, `up`, `stop`, `ps`, logs, backup, migration,
and failure rollback; rollback replaces only the production overlay slot with
the generated disabled-Identity overlay and keeps the isolated acceptance files.
These seams affect only cutover probes and Docker command argv; they are not
passed to Compose as business environment, Caddy, Identity, catalog, or
application settings.

Emergency close is independent and preserves catalog, Community root and
Workflow data/schema. It resolves the exact same guarded Compose argv as
cutover, backup, and migration, then replaces only the production-overlay slot
with an evidence-only disabled Identity overlay. Thus an isolated run keeps its
Windows named database volume and random loopback port rather than falling back
to the base file alone:

```sh
bash deployment/community-production/workflow-production-emergency-disable.sh \
  /ABSOLUTE/RELEASE/deployment/community-production/compose.server.yaml \
  /ABSOLUTE/RELEASE/deployment/community-production/compose.workflow-production.yaml \
  /ABSOLUTE/EVIDENCE/workflow-disable
```

It accepts the same production/isolated-acceptance mode gate and canonical
five-file list described above. Invalid, missing, reordered, or external
isolated files are rejected before Docker is called. Emergency close only runs
`config`, `up` for Identity, and `ps`; it never runs migration, `down`,
`--volumes`, `prune`, or a schema/data deletion. Re-enable uses the same full
file set with the approved production overlay after separate authorization.

For the Caddy runtime-volume boundary, run
`node scripts/test-caddy-runtime-ownership.cjs`. The gate uses the pinned
official Caddy image and the same named data/config/secret volumes for three
complete create-start-stop-remove cycles. It requires every cycle to become
healthy, PID 1 to run as UID/GID `65534:65534` with `CapEff=0`, the derivative
secret to remain unreadable by that identity, and `/data/caddy` to remain
writable without leaking the fixture secret. This is a focused regression,
not a substitute for the full fresh isolated Workflow acceptance project.

For the cutover testability seam, run
`node scripts/test-workflow-cutover-compose-five-file-smoke.cjs`. It starts only
a disposable mock service, validates the strict five-file helper, proves the
random loopback port binding survives restart and force-recreate, and proves a
rollback overlay and emergency disable/re-enable use the same five-file set.
It also retains a `workflow-event` sentinel in the disposable
`community_acceptance_database` named volume across the disable/re-enable
cycle. This is not a business-stack or deployment acceptance gate.

## Manifest-controlled release transfer and preparation

Do not reconstruct a production release from a remembered file count, a
Windows-created tar archive, or post-transfer `chmod` commands. Build the one
self-contained directory bundle from the frozen workspace instead:

```sh
node deployment/community-production/workflow-production-release-bundle.cjs \
  create /ABSOLUTE/LOCAL/community-production-VERSION.bundle
```

The builder fails unless `manifest.json` exactly matches the current
deployment directory. Its payload is the set union of every deployment
manifest entry, `manifest.json` itself, and every canonical Identity source
closure entry. It also carries a generated Identity source manifest plus JSON
and tabular bundle manifests. Unknown, duplicate, secret-shaped, absolute or
parent-traversing paths are rejected. The tabular control is for the host Bash
preparer; the JSON control is independently recomputed by the release-scoped
Node runtime before publication.

For the active7 Workflow cutover this same bundle also carries the fixed Admin
OCI archive at `artifacts/admin-active7-image.tar` (image
`zhenxing-ai/admin:0.1.40-src-186ff057efd3`, pinned by bytes/SHA and image ID).
The cutover loads and inspects that archive before replacing the Admin service;
missing, mismatched, or untagged images fail closed. The archive is a release
asset, not part of the Identity source/COPY closure.

Transfer that directory as one unit to a direct child of
`/opt/zhenxing-ai/staging`. Transfer-time mode bits are not authoritative. On
the server the only supported preparation command is an explicit sudo-caller
invocation; it does not depend on the helper executable bit:

```sh
sudo -n bash /opt/zhenxing-ai/staging/community-production-VERSION.bundle/payload/deployment/community-production/prepare-workflow-production-release.sh \
  /opt/zhenxing-ai/staging/community-production-VERSION.bundle \
  /opt/zhenxing-ai/releases/community-production-VERSION
```

The fixed deployment identity is UID/GID `1000:1000`. The preparer accepts
only canonical direct children of the two fixed roots, EUID 0 with that exact
sudo caller, regular single-link files, safe owner metadata and the exact
manifest set. It copies into a new release-local `.tmp.PID` using per-record
`install`: the explicit shell allowlist is `0755`, all data, CJS, JSON, SQL,
YAML, `Caddyfile`, runtime archive/checksums, manifests and source inputs are
`0644`, and all directories are `0755`. Secrets are not bundle entries.

Before the atomic rename it verifies every byte/SHA/mode/owner/link, prepares
and checks the frozen Node runtime, recomputes the deployment and Identity
source manifests, validates production Compose, and runs `caddy validate`
against the exact `Caddyfile`. Missing/extra entries, symlinks, hard links,
unsafe ownership, corrupt bytes, a stale manifest, an existing target or a
rename fault fail closed and delete only the exact unpublished temporary
directory. It never overwrites a release, touches prior release/evidence or
backup directories, prunes Docker, or deletes volumes. Cutover re-verifies the
prepared marker with the same release-scoped Node before any evidence, backup,
migration or service action. Production has no mode or path override. Windows
Docker Desktop may skip POSIX owner/mode re-observation only under the existing
explicit isolated-acceptance flag after the true-Linux preparer gate has
already produced the release; byte, manifest, source and marker verification
remain mandatory.

An existing production Workflow schema is preserved during an upgrade. The
cutover requires the pre-change v2 envelope to identify signed active6 and the
post-change envelope to identify exactly signed active7 (including its parent
and payload catalog SHA); it does not compare raw HTTP bytes, because the
transport may canonicalize JSON. Ordinary no-catalog-change deployments retain
the existing catalog equality check.

Run the focused regressions with:

```sh
node --test tests/workflow-production-durable-cutover.test.cjs
node scripts/test-workflow-production-durable-cutover-linux.cjs
node --test tests/workflow-production-release-bundle.test.cjs
node scripts/test-workflow-production-release-bundle-linux.cjs
node scripts/test-workflow-production-release-bundle-cutover.cjs /ABSOLUTE/PREPARED_RELEASE
```

The Linux gate deliberately sets all transferred files to `0600` and
directories to `0700`, proves the old Caddy entrypoint failure shape, then
tests successful normalization plus missing controls, missing manifest,
wrong declared mode, extra entry, symlink, hard link, traversal, corruption,
wrong owner, existing target and rename failure. The final cutover gate uses
that prepared release for both the fixed-runner success path and the deliberate
reviewer-probe rollback path. These remain local candidate evidence, not a
server cutover authorization.

The durable-launcher Linux gate runs a fixed Ubuntu 24.04 systemd PID 1,
obtains the launch receipt, sends HUP to the caller session, and polls from a
new connection. It requires the fixed system unit to continue to one terminal
result, the cutover stub to receive no HUP, exactly one cutover call, repeated
launch rejection, zero secret hits in unit/journal/status evidence, and zero
container/temp residue. This proves process ownership only; the separate fresh
success/failure cutover gate remains the production-shaped business-state
proof.

## PostgreSQL final-TCP readiness

The production PostgreSQL healthcheck performs one authenticated TCP `psql`
query against `127.0.0.1`, and succeeds only when both
`current_database()='aihub'` and `current_user='aihub'`. `pg_isready` is not a
database-existence or principal check: the official image can accept it while
the requested database is absent, including a reused or partially initialized
PGDATA directory. The exact query also rejects the image's temporary
Unix-socket-only postmaster while initialization is incomplete. Both the outer
one-shot Identity migration and the fixed temporary-acceptance runner consume
this one `service_healthy` gate from `compose.server.yaml`; neither carries a
second readiness implementation, delay, automatic `CREATE DATABASE`, or
widened timeout. The health command reads the existing database secret only
inside the container and emits neither it nor SQL error details.

MariaDB keeps its separate official `healthcheck.sh --connect
--innodb_initialized` contract. Do not infer PostgreSQL readiness from that
probe or replace either database gate with a sleep.

## Fresh Ubuntu 24.04 host bootstrap

The r16 fresh-host candidate replaces the one-shot r15 launch namespace. R14 and R15 are permanently obsolete for launch and must not be retried; their control and evidence remain preserved. R16 is separate from the retained-state r12 in-place
entry. `workflow-production-fresh-host-stage0.sh` accepts only the frozen
`admin` login identity and Ubuntu 24.04 x86_64 systemd host contract. It uses
only the fixed Ubuntu package allowlist, establishes UID/GID 1000 and the
fixed `/opt/zhenxing-ai` directory tree, and verifies a rootful Docker daemon
plus Compose v2. Stage0 does not transfer a release or initialize application
data. The authority record fixes host `47.236.62.189`, key-pair name
`zhenxingai-deploy`, and ED25519 fingerprint
`SHA256:q4aNRJbw9Pday5Wfq9W1bVErTe1b4Yz6nn7aM+gLDrI`; neither the host public-key
body nor the private key is a deployment payload.

The local Stage0 coordinator is deliberately outside the deployment payload.
It reads Stage0 bytes from the one frozen bundle and uses exactly one OpenSSH
process with strict host-key checking. Its only known-host authority is
`C:\Users\yujin\.ssh\known_hosts_aihub_production` (SHA-256
`a6a35075c8ea44425ef8b3db35f09c17670672cad83a64dc2e4bd110d58a5697`);
the global known-hosts file is neither read nor changed.

After separately authorized Stage0, transfer, prepared-release verification,
and a production initialize-and-launch decision,
`workflow-production-fresh-host-launcher.sh` starts one fixed root systemd
transient unit. The unit revalidates the prepared controls and release-scoped
runtime before `workflow-production-fresh-host-runner.sh` uses only those
prepared bytes. Caller HUP does not stop the unit; fixed receipt and status
files reject concurrent or repeated launches. This is the only production
write and launch phase; there is no intermediate application initialize phase.
The worker generates a new
secret authority with OS CSPRNG bytes, loads the fixed Admin, Identity, and
Flarum archives, installs the already signed active6/active7/v1 catalog
artifacts into an empty Admin store, then reuses the existing Identity,
Community, reviewer, and official-bootstrap migration seams. It never applies
the candidate Resource Submission migration; the final profile is exactly
resource `0/0/0` and Workflow Store `1/1/1`. Stage0 PASS authorizes neither
transfer nor prepare, and prepared verification does not authorize the fixed
production initialize-and-launch unit. Each transition requires a separate
release decision. A failed worker first writes an allowlisted terminal status,
stops the exact six project services without deleting data, and preserves
control and evidence for CTO read-only review. Recovery or reinstallation
requires a separate explicit decision.

## Blockers before deployment

- Workflow Store is `candidateOnly=true` and `deployable=false`. The new
  production overlay is a contract candidate, not an authorization. Test/release
  must use it in a fully fresh isolated stack and recovery drill before any
  server switch. Do not copy either overlay into the production base or enable
  any flag individually.

- Two production community attempts were rolled back at the Caddy secret
  boundary. The second proved that even container UID 0 could not read the
  host file-secret bind under that server's Docker user-mapping semantics. Do
  not loosen the source mode or retry the bind. A later switch requires fresh
  CTO authorization and a same-server PASS from
  `probe-caddy-secret-volume.sh`. On failure, capture timestamped Caddy logs and
  inspect output before teardown; never delete the failed container before
  evidence is retained.

- Build and inspect new Admin CMS, Identity, and Flarum images locally and
  record immutable image/source digests. The currently deployed Admin-only
  image does not contain this CMS module.
- The explicit Identity/Flarum migration modes and Compose jobs have only
  static and isolated syntax/contract evidence. Build the exact candidate
  images locally, then prove both jobs twice against disposable restored data
  before considering them idempotent production migration evidence.
- Run the backup and isolated restore drill using production-shaped data;
  static checks are not recovery evidence.
- Re-run the Flarum first-install and a second explicit migration with the
  Windows acceptance override when validating from Docker Desktop. The earlier
  NTFS bind failure is a local filesystem-semantics issue, not a MariaDB 11.8
  or Flarum migration-order exception.
- Verify DNS and certificates for `community.zhenxingai.com`; the last recorded
  server audit found the name unresolved.
- Configure and test real SMTP before enabling registration. This candidate
  intentionally keeps registration disabled.
- Repeat the already-passing bridge `php -l` and static cross-module tests in
  the exact locally built candidate image, then run the bridge against a
  disposable production-shaped Flarum database. No service was started in this
  task. Missing moderation/report extensions must remain `unavailable`, never
  fabricated as zero.

## Deterministic source manifest

`manifest.json` lists every file below `deployment/community-production/`
except itself, using workspace-relative `/` paths, byte lengths and lowercase
SHA-256 values. Records are sorted by path using JavaScript UTF-16 code-unit
order. The set digest is SHA-256 over UTF-8 records in this exact form,
including each final newline:

```text
<path>\t<bytes>\t<sha256>\n
```

Run `node deployment/community-production/verify-manifest.cjs` from
`pc-client` to recompute every record and the set digest. Filesystem times, Git
status and platform newline conversion do not participate.
# Official Workflow public-store bootstrap candidate (2026-08-09)

The explicit `workflow-official-bootstrap` profile is disabled by default and runs only the manifest-controlled Flarum source-post → publisher provision → owner/submit → reviewer/publish → outer-public verification one-shot. The cutover validates every dependency first, so the wrapper runs the one-shot with Compose `--no-deps` and cannot reconcile or recreate the already-healthy online services. The fixed forum API-key file parser removes only one terminal LF; it rejects CR/CRLF, internal or repeated newlines, boundary whitespace, controls and out-of-range values without logging the secret. The deployed reviewed Identity COPY closure remains `2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7` (74 manifest entries / 72 actual COPY inputs), candidate image tag `zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e`, and image ID `sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748`. Current HEAD has a separate local-only candidate closure `d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8` (78 manifest entries / 76 actual COPY inputs), image `zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8`, image ID `sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01`, and size 58,884,827 bytes. Its exact image closure, secret scan, seven catalog-readiness scenarios, and isolated Workflow migration rollback matrix passed locally; the readiness report is `output/identity-catalog-readiness-docker-20260815190812166-f03153ee/report.json` with SHA-256 `bf1cd6c8a8178d409719ba9466885878e6d3df9cbdffd5d8fa641679f1107476`. This local image is not deployed or authorized for production cutover. The migration database contract preserves the real Pool receiver and rejects missing, wrong, or inaccessible `aihub` targets before schema SQL. Fresh A–E is required for each frozen candidate.
