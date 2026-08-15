# Community CMS and production deployment candidate

Status: `candidate-only`, `publishable=false`, `deployable=false`.

The unique management seam is `admin/community-management.cjs`. The browser
calls only the CMS same-origin routes. Private Caddy injects one gateway secret;
Admin uses a different secret for the fixed Flarum bridge. The bridge exposes
only summary, discussion hide/restore, and post hide/restore. Flarum API keys,
admin passwords, cookies, URLs, headers, and commands never cross the seam.
`AIHUB_ADMIN_READ_ONLY=1` remains mandatory: its only non-GET exception is the
exact `/api/community-management/actions` route after the injected-secret,
exact-origin, JSON and CSRF checks; every other Admin write remains `503`.

`GET /api/community-management` returns bounded metrics and moderation targets.
Unavailable upstreams fail closed with null metrics and empty targets. Missing
moderation/report extensions are represented as `unavailable` with a reason,
not as a made-up zero. `POST /api/community-management/actions` accepts only
the two fixed ID/boolean action shapes documented in the deployment README.

The public gateway blocks Flarum `/admin` and both internal PHP bridges. A
native Flarum admin entry is intentionally unavailable in this first candidate;
adding one requires a separately authenticated SSH-private origin and real
session/cookie acceptance, not a public redirect.

The candidate Caddyfile merges the root and community hosts into one gateway.
It replaces, and must never run beside, the current Admin-only Caddy that owns
80/443. The Compose contract reuses that gateway's inspected external Caddy
data/config volumes; the README fixes the stop/start, evidence and rollback
order without authorizing a server change.

The production candidate is under `deployment/community-production/`. It
contains a no-build Compose topology, Caddy contract, Identity secret-file
image contract, backup and isolated restore-drill scripts, and explicit
resource ceilings for the 2-core/1.6-GiB host. No server was contacted and no
catalog, database, signed release, or current production image was changed.

Identity and Flarum now have explicit migrate-only modes; their normal
production runtime modes do not perform schema writes. A fixed runner verifies
the backup manifest and runs only those two jobs sequentially, never starting
applications. Deployment remains blocked by local image provenance, two-pass
migration proof on disposable restored data, production-shaped backup/restore
evidence, community DNS/TLS, and end-to-end acceptance. Static contracts are
not runtime deployment proof.

The root Docker build context now admits exactly
`deployment/community-production/identity-entrypoint.sh` from `deployment/`.
It re-excludes all other Admin data before naming the required JSON/icon files,
and ends with `.pem`, `.key`, and `.env*` denylists. A real Identity build and
negative BuildKit probes for unrelated deployment files and the local catalog
signing private key pass. Because `.dockerignore` is outside the documented
deployment-directory manifest scope, its `f5807427...d3a3` set digest is
unchanged; any Identity source snapshot/image provenance digest must be
recomputed after this policy change.
