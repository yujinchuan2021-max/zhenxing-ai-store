# Cloud Admin signing boundary

## Symptom

The server did not have a catalog signing private key. Requiring one for a
read-only release gateway would either block startup or tempt an unsafe copy
of the local signing key to the server.

## Root cause

`admin/server.cjs` loaded or generated a signing key during startup and
`ensureDraft()` could synchronize a disk draft before serving a GET request.
Both are write-capable behaviors even when the server is intended only to
serve already signed catalog envelopes.

## Fix

`AIHUB_ADMIN_READ_ONLY=1` skips signing-key loading, disables draft
synchronization and discovery scheduling, and returns `503` for every non-GET
Admin API request. The Admin-only Linux Compose contract sets that mode and
does not require an env file or private key.

## Verification and remaining acceptance

The focused regression test, a no-key read-only container smoke test, source
manifest rehash, image-label inspection, Compose parsing, and Caddy validation
passed. Real server rollout remains owned by release operations; local signed
catalog publication and separately authorized immutable-state synchronization
are still required before any cloud switch.

The first cloud switch rolled back safely because Caddy's healthcheck used
`https://localhost/health` against a site that only matched the public host.
The later reproduction also found that Caddy Alpine's BusyBox `wget` rejects
`--no-check-certificate`, so a loopback HTTPS probe cannot be its own health
contract. The deployment now uses an unexposed `127.0.0.1:2015` HTTP listener
that only proxies `/health`; public Host/SNI and certificate checks remain
external. Caddy logs and inspect output must be preserved before any future
rollback.
