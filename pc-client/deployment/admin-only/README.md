# Admin-only server delivery contract

This deployment contains only the Admin service and the public Caddy catalog
gateway. It does not contain Identity, Community, PostgreSQL, MariaDB, a web
site, or any PC installer artifact.

## Build locally

```powershell
node scripts/prepare-admin-only-snapshot.cjs
docker build -f <snapshot>\deployment\admin-only\Dockerfile --build-arg AIHUB_SOURCE_REVISION=<git-reference> --build-arg AIHUB_RELEASE_VERSION=<version> --build-arg AIHUB_SOURCE_CONTENT_DIGEST=<content-sha256> -t <image> <snapshot>
```

The script prints the exact snapshot directory, manifest, content digest, and
image tag. A Git revision is reference metadata only; the manifest is the
actual source identity.

## Server prerequisites

Before replacement, use the confirmed SSH channel to inventory the current
containers and create a verified backup of the persistent published state.
Set the following values outside this repository:

- `AIHUB_PUBLIC_HOST`: verified DNS name used for Caddy automatic TLS;
- `AIHUB_ADMIN_IMAGE`: the locally verified image reference;
- `AIHUB_ADMIN_DATA_DIR`, `AIHUB_ADMIN_PUBLISHED_DIR`, and
  `AIHUB_ADMIN_OUTPUT_DIR`: persistent server directories;
- `AIHUB_SOURCE_CONTENT_DIGEST`: the exact digest from `source-manifest.json`.

The server forces `AIHUB_ADMIN_READ_ONLY=1`: it does not load or generate a
catalog private key, does not sync disk drafts, and returns `503` for every
non-GET Admin API request. Keep `AIHUB_ADMIN_PUBLISHED_DIR` unchanged; signed
catalogs are published locally and then synchronized through a separately
authorized delivery path.

## Deploy and verify

1. Transfer the verified image through the approved server delivery channel;
   on the server use `docker load`, never `docker compose build`.
2. Export only the six non-secret variables above and run
   `docker compose -f deployment/admin-only/compose.server.yaml up -d --no-build`.
3. Verify the private admin tunnel at `http://127.0.0.1:4173/ready`; it must
   report `mode: "read-only"` and no signing key ID.
4. Verify public `https://<host>/health`, `/catalog-release.json`,
   `/channels/v2/catalog-release.json`, and `/vendor-icons/<approved-asset>`.
5. Compare both catalog envelopes to the persistent release-state SHA and
   signature. Admin remains loopback-only; Caddy never publishes the Admin UI.

The Caddy healthcheck calls its private `http://127.0.0.1:2015/health` listener
inside the container. Caddy explicitly binds that listener to `127.0.0.1`; it
is not published and only proxies `/health`
to Admin readiness. It intentionally uses no TLS because a loopback IP cannot
prove the public-host certificate; public HTTPS certificate and Host/SNI
verification remain separate external endpoint checks.

Before any rollback, preserve Caddy evidence:

```sh
docker compose -f deployment/admin-only/compose.server.yaml ps
docker logs --timestamps <caddy-container> > /opt/zhenxing-ai/shared/backups/caddy-failure-$(date -u +%Y%m%dT%H%M%SZ).log
docker inspect <caddy-container> > /opt/zhenxing-ai/shared/backups/caddy-failure-inspect.json
```

Run `node scripts/test-admin-only-caddy-health.cjs` locally before a retry. It
asserts the mismatched loopback Host fails and the configured Host succeeds.

## Rollback

Keep the prior image reference and verified backup. Stop only these two
services, restore the prior Admin image plus the unchanged published-state
directory, then start the same Compose file with `--no-build` and repeat the
four endpoint checks. No database migration or database rollback is part of
this contract.
