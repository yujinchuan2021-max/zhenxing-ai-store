# Workflow production cutover lacked an isolated acceptance runner

## Symptom

Cutover previously accepted an arbitrary executable path. The local Windows A-E
orchestrator was not a production-callable asset, while running its fixtures
against production Identity or Flarum would leave append-only Workflow events.
An early proposed Flarum ID also exceeded its physical unsigned-32-bit key.

## Root cause and fix

The contract specified outcomes without owning a disposable data plane. The
manifest-controlled `workflow-production-temporary-acceptance.cjs` now creates
a fresh Compose project with independent Identity/PostgreSQL,
Flarum/MariaDB, session, reviewer secret and Caddy volumes. Cutover invokes it
directly with Node and no longer accepts a caller-selected runner.

The sole real Flarum fixture is `2147483647`. IDs above `4294967295` are
rejected. The runner verifies the exact Flarum API object, drives only the fixed
owner/reviewer/public sequence, and checks four events plus four idempotency
rows. Its report is strictly allowlisted; teardown targets only its project and
three exact external volumes.

## Verification and remaining boundary

The red test failed for the missing runner and arbitrary executable seam. A
fresh local Docker run then passed the real Flarum post, cold `503` to ready,
owner/reviewer/public chain, redaction, Caddy `404` gates, four-event database
check and zero-residue cleanup.

Each replacement remains candidate-only. It does not replace test/release's
independent fresh production-overlay run, server preflight, verified backup or
explicit single-cutover authorization.

## Production Linux cleanup P0

The first authorized b56 cutover did run the fixed runner on Linux and then
rolled back. The Workflow publish/unlist data path completed, but MariaDB and
Flarum had created root/container-UID-owned files in the runner bind directory.
The deployment-user `fs.rmSync` threw `EACCES`; because report writing followed
that uncaught removal, no final runner report was produced and the outer call
timed out. The cutover rollback restored six healthy services, disabled all
Workflow flags, removed the empty candidate schema/service identity, retained
the verified backup, and left the signed catalogs unchanged. That candidate
and authorization cannot be reused.

The canonical remote evidence SHA-256 is
`91b5676ecb7801b7365d08e54d07208f6e2cc3efce776ddf944726e7d1950d57`;
the local rollback report SHA-256 is
`b09f2e73aafff84491db59ca49edc4d31ba3ef9a670ecd6b06137de0b6774c4b`.
The verified backup remains
`/opt/zhenxing-ai/shared/backups/community-production-20260808T103556Z`.
No value or hash of the retained reviewer secret is recorded.

The fix does not skip cleanup or weaken its PASS gate. Cleanup now accepts only
the canonical runner-owned direct child and fixed top-level entries, requires
zero container references, and rejects symlinks and nested mounts. A pinned,
networkless, read-only-root helper receives only that bind and the numeric
runner UID/GID, has only `CHOWN` and `DAC_READ_SEARCH`, and contains no delete
command. After it returns ownership, Node removes the exact directory. The
allowlisted BLOCKED/PARTIAL report is fsynced and closed before this operation
and rewritten with final cleanup booleans afterward; cleanup exceptions can no
longer erase the report.

Focused true-Linux-container tests cover container-UID-owned content, report
flush, symlink and nested-mount rejection, outside-volume preservation and an
active-container reference. The focused report SHA-256 is
`457e6cba42ea6e7115423ed3ada5fe87a7af7bac3da14c0df73459fc03b56169`.
Full isolated success/failure cutover gates remain required before any new
server preflight. No server retry is authorized by this repair.

The replacement frozen local candidate records deployment set digest
`e64d422d4bfe0735c9722fac00e32ec3a5d733850a781420222cec36b7a0d25a`,
manifest SHA-256 `e7977d3501a9fc32e7b0d273e3beeed71f724e1dfe33e475d89d41923305ae6d`,
and runner SHA-256
`734aa928fac072e4a4104b7b6342228435bbf3a6231a55caa3a926e651f1544e`.
The current full isolated success report SHA-256 is
`4bc163264b95140089a22e8021df76520cf7988cfba398902d8ffcf7a8de1796`;
the nested fixed-runner report is
`225b2159ad7ecaf15ab6a9256f915bb005687d6ea345e5aeb102a87301bf3a20`;
the deliberate failure/rollback report SHA-256 is
`ce05693d83bea4791898377f476241b5b956269d4ab9a1c9f9f2709672c8f678`.

## Production ready-stage attribution P0

The authorized a03 cutover passed source/runtime verification, evidence,
backup, explicit migration and the isolated runner's cold catalog boundary,
then returned nonzero at the runner's generic `ready` stage. Automatic rollback
restored all six prior services, disabled Workflow, removed the empty candidate
schema/service identity, retained the verified backup and left both signed
catalog transports unchanged. The retained evidence tree SHA-256 is
`d03526640d83bebc8c5d3b841dfb37e0963f76e303e2193aa9e63a710ac93dda`;
the final local rollback report SHA-256 is
`3aa20701e396c218ec12449fa2adddf091b2e7e7f3dde624b003677019c86229`.
That candidate must not be retried.

The retained allowlisted report proves catalog warmup had completed and no
post-health step began. Its project/report timestamps fit the old 180-second
combined health wait, but the report cannot safely distinguish Community still
starting from Caddy not yet starting. No narrower production cause is asserted.
The code-level defect is exact: Community's health window can reach about 210
seconds and Caddy starts only after Community is healthy, while the runner gave
the combined pair 180 seconds.

The replacement starts and attributes Community and Caddy separately. Their
bounded waits are 240 and 150 seconds, aligned just above the existing Compose
health windows. A failed report contains only fixed component/reason/status
values, an elapsed bucket, attempt count, and HTTP status class; raw Compose
rows, inspect, logs, exception text, URLs, response bodies, and environment are
prohibited. Flarum-post, public-capability, and catalog-readiness failures use
the same fixed attribution boundary. Focused tests inject every component state
and require cleanup/redaction to remain fail closed. A new full isolated
success/failure run and independent A-E remain mandatory before server action.

The local replacement freeze records deployment set
`124e85db7e8e57b2157843277c12c8e9ae835efd9fb517e57c18d5f249a3bfdb`,
manifest SHA-256
`25bf007f14dfd7a51270784de8c56dfaeee2c9d1e87a8c2b64b2a223186fda2b`,
bundle payload
`a9aee387633ad11a4b2a7582ae817efa47bb30b496768358bf717f1eca8786a1`,
and runner SHA-256
`93eda2fbd9db24b5819e9e4bb59221d6bd7b2ada71706459ab0582f344a40b64`.
The true-Linux bundle/preparer report SHA-256 is
`2f1fddea7fd757324431f8f6e536e83580b8a4754e4f3eefc2e4778665d063ab`.
The complete local production-shape success/failure report SHA-256 is
`5bbda681f7c1713ae3826ce062b5d185a1fc7aa0b3bc85db6f4b42950d777b22`;
its successful fixed-runner report SHA-256 is
`af0ae0348077122a7a736f164d7fbe74f0af703db79604d4b3b02e8e734d951b`.
Identity source remains
`19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c`,
so the immutable `sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567`
image is reused rather than rebuilt. This evidence is candidate-only and does
not authorize a server retry.

## Production Linux generated-Caddyfile mode P0

The single authorized `124e` cutover passed independent A-E and strict
preflight, then the fixed runner blocked after Community was healthy. Its
allowlisted report named `readyProbe=caddy-health` and attributed Caddy as
`service-not-running`, `exited`, after 129 attempts in the `120-180s` bucket.
The report SHA-256 is
`c0fdcbdb4ac67dacd1aba069256de2b3e5442c71f0ffe3d191660d9d0444c70c`.
Runner cleanup completed with zero project resources, and automatic rollback
restored the prior six-service, Workflow-disabled production state. The
candidate and authorization are retired.

The exact defect was local to the runner's generated Caddyfile. It called the
same `writePrivate` helper used for secrets and the private Compose override,
making the bind source deployment-user-owned mode `0600`. The Caddy container
starts with `Config.User=0:0` only for the manifest-controlled bootstrap; its
entrypoint then drops PID 1 to `65534:65534`, and that runtime identity cannot
open a true-Linux `1000:1000 0600` bind inode. Docker Desktop did not preserve
the same host DAC behavior, which allowed prior local full-cutover runs to pass.

A fixed-digest Linux named-volume probe closes causality: the same valid
Caddyfile fails `caddy validate --adapter caddyfile` as UID/GID 65534 at
`1000:1000 0600`, then succeeds after only `chmod 0644`. The replacement adds
one named writer for this non-secret generated Caddyfile. It writes and verifies
mode `0644`; the enclosing fixture directory remains `0700`, the Caddyfile
contains only the manifest-controlled placeholder rather than the CMS value,
and the derivative secret remains `root:root 0400`. All generated secrets and
the Compose override remain `0600`. No timeout, healthcheck, entrypoint,
Compose, Identity, catalog, or signed-state contract changes.

Focused tests require the generated Caddyfile to use the readable writer and
prohibit falling back to `writePrivate`, while retaining the private writers
for secrets and the override. A new frozen deployment set and independent A-E
are required before any new server authorization; this repair itself does not
authorize a retry.

The replacement local freeze records deployment set
`eb1eeb94f79d1471acd80d92f20935d52ee2a642cc315deb91a1875b35a19546`,
manifest SHA-256
`f66f63a796135854c2e279f086f4b44561a56d28806b6c974ba1b65cbba07d6c`,
bundle manifest SHA-256
`3a0940b6c3332bd5b35758dd958bec379ad8ddbc12031f2fa5b5bdbfb2a6bc29`,
bundle payload
`bc302756a98bd70e5a77790b864f41da50455f24de193e38082714b8cdd3c4b4`,
and runner SHA-256
`afc771766d58b12063264ef0f025e0e2701e96ec37405e7d7dd9a24fe077d40e`.
The true-Linux bundle/preparer report SHA-256 is
`398ba093a95dd8d076cd6ffd763b3dc2cecfe511f33c73f3c49d6d9335028069`.
The complete local production-shape success/failure report SHA-256 is
`e43224f91774ca01b3f4f361a451292cc74a205c8ca34b30c448dd2b65830ca6`;
its nested fixed-runner report SHA-256 is
`622fb79a995bf5294332472093dd30b79933776cb2880500252b69b377559f7b`.
Identity source remains
`19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c`,
so the existing immutable
`sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567`
image is reused. These local results keep `candidateOnly=true` and
`deployable=false`; test/release must run a new independent A-E before any new
server authorization.

## Fresh PostgreSQL socket-only health race

The independent `eb1` A-E did not reach the generated-Caddyfile gate. Two
separate fresh projects failed earlier: one outer `identity-migrate` and one
nested fixed-runner `identity-migrate` received TCP `ECONNREFUSED` after Compose
had already marked PostgreSQL healthy. Their report SHA-256 values are
`214f7c430587ee40a5844b4b60cbc7e83d4461b3720bd3e9428334bef0aa1340`
and
`afcff511075583c0304f9a012f82464db95bc263267af0245a843ad8f5ff8984`;
the test/release conclusion SHA-256 is
`8e9bbd6cb30b871019303deb4aa22447e62cad27c0567054ed4a51ecbbf32fd2`.
Cleanup reached zero for both projects.

The shared defect was the production PostgreSQL health command
`pg_isready -U aihub -d aihub`. On a fresh data directory the official image
starts an initialization postmaster with Unix sockets but no TCP listener; a
hostless probe can turn green there even though every sibling migration uses
TCP. The replacement uses the same single Compose gate with an explicit
container-loopback TCP host:
`pg_isready -h 127.0.0.1 -U aihub -d aihub`. Outer migration and fixed runner
already depend on that service health, so no sleep, broad timeout change,
duplicate readiness implementation, log parsing, or database/Workflow change
is needed. MariaDB's existing official TCP-aware health helper is unchanged.

Focused tests pin both consumers to the shared gate. A true-Linux named-volume
probe observes the old socket probe ready while sibling TCP is refused, the new
health still `starting`, and final `healthy` only after sibling TCP succeeds.
This is candidate-only; a newly frozen bundle and an independent fresh A-E are
still required before any server action.

The replacement local freeze records deployment set
`8e7d15dd4bae1581e985d2b4eda106094b6ec567ed8b9a10c9d9e10ad8b366e1`,
manifest SHA-256
`656feb0b407840e3366afe194c65119a79016dffb9f7f2ca9ab646baf9181401`,
bundle manifest SHA-256
`74ec4bc70c64bc771a6ec4bf4f6f08db7a407c5267832bffedf6c51516aa8bd6`,
bundle payload
`d0c0650f7db8784b059e45b62aa26cc4166d966aff32ddd7bd677ce10aba5c3d`,
and unchanged runner SHA-256
`afc771766d58b12063264ef0f025e0e2701e96ec37405e7d7dd9a24fe077d40e`.
The true-Linux bundle/preparer report SHA-256 is
`41c911c50a040dc5e255dad41c9f14d2700a82b82a6024be6b0fa7c933b5fd5e`.
The fresh-PostgreSQL TCP-readiness report SHA-256 is
`b5aeac9e2ec213a374b05407c5ac63560c1d60670847fb29bf3d00a67748212f`.
The complete local production-shape success/failure report SHA-256 is
`7fb9c19aa176bf36a4572115cae86fb90e6c51de73c09745f027386ce6670045`;
its nested fixed-runner report SHA-256 is
`fb5bc3637eb024c834d21e3047d1e999a37fc8e6d80274bfdbf45faa6ce43ed8`.
Identity source remains
`19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c`,
so the existing immutable
`sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567`
image is reused. All matching local Docker resources reached zero. These
results remain `candidateOnly=true`, `deployable=false` and require a new
independent A-E.
