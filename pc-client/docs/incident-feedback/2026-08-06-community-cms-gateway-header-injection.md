# Community CMS gateway header injection

## Impact

The isolated production candidate reached healthy Admin, Identity, databases,
Flarum and Caddy, but the SSH-private CMS route returned `403` for
`GET /api/community-management`. Direct Admin access with the same mounted
secret succeeded.

## Root cause

The Compose Caddy command used `$$` before `cat`. Compose preserved it into
the container command, where the shell expanded it as its PID instead of
loading the secret file. The proxy also combined a header deletion with the
same header assignment; Caddy's request-header operations left the injected
header absent.

## Resolution

`deployment/community-production/caddy-entrypoint.sh` now reads only
`/run/secrets/community_cms_gateway`, rejects unavailable, empty or
control-character content without printing it, exports it only to the Caddy
process and starts Caddy. The private listener injects that header only for
`/api/community-management` and `/api/community-management/actions`; its
default handler does not inject it.

## Regression gate

The deployment test rejects the old Compose substitution and header deletion.
An isolated Admin+Caddy run with a local fixed community upstream verified:
anonymous CMS GET `200`, valid JSON/Origin/CSRF action `200`, a near path
`404`, and unrelated write API `503`. This is not a real account or server
acceptance.

## Production `0600` secret ownership follow-up

The first production community switch reached healthy Admin, Identity,
PostgreSQL, MariaDB, and Flarum, then rolled back because Caddy's non-root
entrypoint could not read `/run/secrets/community_cms_gateway`. The production
file correctly remained root-owned mode `0600`; changing it to group- or
world-readable is not an acceptable fix. The previously passing local gate had
not reproduced this ownership boundary.

The Caddy service now starts its mounted entrypoint explicitly as root with a
four-capability bootstrap set (`CHOWN`, `SETUID`, `SETGID`, and
`NET_BIND_SERVICE`). The entrypoint reads and validates only the CMS gateway
secret, adjusts only the existing Caddy data/config volume ownership, and then
uses the official image's BusyBox `su` to replace itself with Caddy as fixed
UID/GID `65534:65534`. No temporary secret file is created, the source file is
not chmod/chown'd, and the official pinned Caddy image is unchanged.

`tests/community-caddy-root-secret.test.cjs` creates a Linux Docker volume with
a root-owned mode-`0600` secret and runs the real Admin and Caddy images. It
requires three successful Docker health records, PID 1 UID/GID `65534:65534`,
zero effective runtime capabilities, and denial when that runtime identity
tries to read the source secret. It also verifies anonymous CMS GET `200`, a
valid Origin/JSON/CSRF action `200`, near-path `404`, unrelated write `503`, and
absence of the fixture value from Docker inspect/logs or residual temp paths.
This closes the local reproduction gap but is not authorization for another
server switch.

## Server user-mapping follow-up

The next authorized production attempt still failed before Caddy started.
Compose and inspect confirmed `user=0:0` plus the intended bootstrap
capabilities, yet container UID 0 received `Permission denied` reading the
host-owned mode-`0600` Compose file-secret bind. All other services were
healthy and the switch was rolled back without deleting volumes, images, or
the verified backup. This disproved the assumption that container UID 0 could
reliably read that host bind under the server's Docker user-mapping semantics.

Caddy no longer consumes the host bind. The host source remains owned by the
single approved deployment operator at mode `0600`;
`seed-caddy-secret-volume.sh` runs only as EUID 0 and, under sudo, accepts only
the exact `SUDO_UID:SUDO_GID` owner that sudo supplies. A direct-root call with
no sudo identity accepts only `0:0`. Symlinks, non-regular or multiply linked
files, other modes, empty values, and control characters are rejected before
Docker is invoked; no argument or ordinary environment variable can select an
owner. The script streams the value over stdin to the pinned official Caddy
image and `caddy-secret-seed.sh` atomically creates a
root-owned mode-`0400` derivative inside a dedicated Docker managed volume.
The secret is absent from arguments, environment configuration, Compose
interpolation, image layers, repository data, and logs. Caddy mounts only that
volume read-only, reads it during the existing root bootstrap, and then drops
to UID/GID `65534:65534` with zero effective capabilities.

The seed path is idempotent. Invalid or interrupted input removes its
same-volume temporary file without replacing an existing valid target; the
host wrapper refuses to update a volume attached to a running container. The
derivative volume is excluded from backups and is reseeded from the host
source after loss. Rotation uses a new named volume and a single pointer
switch while the old volume remains as a rollback asset.

The local real-Docker regression now covers initial seed, repeated seed,
failed-seed preservation, mode/owner, Caddy mount isolation, a loopback high
port, three health passes, CMS GET/action, near-path and unrelated-write
status, runtime UID/GID/capabilities, non-root denial, and inspect/log leak
scans. `probe-caddy-secret-volume.sh` packages the same boundary for an
isolated pre-cutover run on the production server. No further server attempt
is authorized until that same-server probe passes and the CTO issues a new
cutover authorization.

The old Admin-only Compose contract neither enables community management nor
mounts `community_cms_gateway`, so leaving the authoritative source at its
existing deployment-operator ownership does not affect the restored old
Admin/Caddy runtime. The host seed and probe commands now use `sudo -n bash`,
and the probe calls the host seed helper through `bash`; this removes reliance
on executable bits that Windows tar transport may discard while keeping
content SHA-256 verification unchanged.

## Same-server probe owner follow-up

The first managed-volume probe stopped before creating Caddy resources because
the authoritative source was `1000:1000 0600`, while the initial wrapper
required `root:root 0600`. That was a contract mismatch, not a reason to change
the source. The probe left no container, network, or volume behind, and the old
Admin-only stack stayed healthy.

The approved correction keeps source owner, mode, and content unchanged. A
`sudo -n bash` invocation may seed only from the exact `SUDO_UID:SUDO_GID`
owner set by sudo; direct root without those variables may seed only from
`0:0`. The wrapper accepts no owner parameter and ignores ordinary owner
override environment names. Its EUID must still be 0. The source must also be
an absolute regular non-symlink with one hard link, exact mode `0600`, and
32-512 printable bytes without newlines or control characters. Only after all
gates pass is Docker called. The managed-volume derivative remains
`root:root 0400`, so the Caddy bootstrap and non-root runtime contract are
unchanged.

## Gateway authority reissue follow-up

The next same-server probe passed the owner seam but rejected the existing
65-byte source for control characters. Only metadata was recorded; a trailing
newline was a plausible explanation, not an inspected fact. The old value was
therefore not trimmed or reused. The dedicated
`issue-caddy-gateway-secret.sh` contract now generates a completely new
gateway-only 64-character hex authority from the system CSPRNG, in an
unpredictable same-directory temporary file. It validates exact sudo-caller
ownership and mode `0600`, refuses any running container that mounts the
target, syncs before commit, and atomically renames. Pre-commit failure removes
the temporary file and leaves the old authority unchanged; no secret or
content hash enters output, arguments, environment, logs, images, or audit.

Under a separate server authorization, test/release operations subsequently
reported that the authority was atomically reissued as regular, single-link,
`1000:1000 0600`, 64 bytes, and that the isolated managed-volume probe passed:
four successful Docker health records, CMS GET/action `200`, near path `404`,
other write `503`, Caddy PID 1 at `65534:65534` with `CapEff=0`, derivative
`root:root 0400`, non-root read denial, and zero residual probe resources. The
old Admin-only stack stayed healthy. This closes only the secret-delivery
pre-cutover gate and is not a formal-cutover authorization.

## Caddy runtime-volume restart ownership follow-up

The first fresh Workflow acceptance project reached the acceptance override
only after every migration, backup, restore, and ordinary-service gate had
passed. Caddy then restarted with `chown: /data/caddy/locks: Permission denied`.
Inspect evidence showed ordinary Docker named volumes at `/data` and `/config`,
root bootstrap with only `CHOWN`, `SETUID`, `SETGID`, and `NET_BIND_SERVICE`,
and no nested read-only mount at the failing path.

The previous bootstrap recursively changed both volume trees. After the first
start, non-root Caddy created private `caddy/locks` state as UID/GID 65534.
On the next container creation, root still lacked `DAC_OVERRIDE`; `CHOWN` alone
does not permit traversal through that private directory, so recursive `chown`
failed before Caddy could drop privileges. A real Docker red gate reproduced
the exact second-cycle error while reusing the same named volumes.

The entrypoint now changes ownership only on the `/data` and `/config` mount
roots and their existing direct `caddy` directories. It rejects a symlink or
non-directory at either known subpath and never recursively traverses runtime
state or nested mounts. No mode, secret, capability, Workflow module, Identity
image, or official Caddy image changed. The same real-Docker gate now completes
three create/start/stop/remove cycles with persistent named volumes, healthy
Caddy each time, PID 1 at UID/GID 65534 with zero effective capabilities,
non-root secret read denial, and a writable `/data/caddy` directory without
fixture leakage. The production candidate remains non-deployable until test
release reruns every gate from a completely fresh isolated project.
