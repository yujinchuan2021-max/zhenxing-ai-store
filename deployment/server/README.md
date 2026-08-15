# ZhenXing AI server deployment

This stack exposes only ports 80 and 443. The admin service binds to server
loopback on port 4173; databases remain Docker-internal.

## Current release scope

The first production deployment is the international edition on the Singapore
server. It uses official global sources first and does not depend on a mainland
China node or ICP filing. This is a hosting boundary, not an English-only UI:
the existing Chinese/English switch remains available.

A registrar hold or incomplete registrant verification can still make a domain
return `NXDOMAIN`; hosting outside mainland China does not bypass domain
registration status. The service can be checked by public IP while DNS is being
activated.

## Build and upload policy

Never build application images on the production server. Build and verify them
with the local Docker Linux engine. Upload only after the user explicitly says
to send the release to the cloud; the server then verifies checksums, runs
`docker load`, and starts the release with `--no-build`.

The server may pre-pull the pinned gateway and database base images. Incoming
release archives belong in `/opt/zhenxing-ai/incoming`; application data,
secrets and backups remain under `/opt/zhenxing-ai/shared`.

## DNS

Create A records for both names before expecting public TLS:

- `zhenxingai.com` -> the server public IPv4 address
- `community.zhenxingai.com` -> the same address

`www.zhenxingai.com` is optional. Caddy requests public certificates
automatically after both required names resolve.

## First start

1. Run `python3 generate-environment.py environment.example .env`. It creates
   the file once with independent random secrets and refuses to overwrite it.
2. Leave `AIHUB_REGISTRATION_ENABLED=false` until real SMTP credentials pass a
   delivery test.
3. Run `docker compose --env-file .env config`, then
   `docker compose --env-file .env up -d --build`.
4. Check `docker compose ps` and `curl http://127.0.0.1/health`.
5. Publish the first validated catalog through the admin UI. Identity readiness
   does not require a catalog, but account product operations remain fail-closed
   until a catalog release exists.

The admin UI is intentionally not public. Reach it through an SSH tunnel to
server loopback port 4173.

Run `sh ./backup.sh` after the first healthy start and before catalog or community
changes. Backups are written outside the release/build context under
`/opt/zhenxing-ai/shared/backups`. They contain user and community data and must
remain private.
