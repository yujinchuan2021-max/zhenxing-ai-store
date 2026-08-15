# Community production Admin healthcheck timeout

## Symptom

The Windows production-shaped Compose run reached `GET /ready = 200`, but its
Admin container remained `starting` because Docker healthchecks exceeded the
three-second timeout. Identity and Caddy therefore remained blocked by
`depends_on: service_healthy`.

## Evidence and root cause

The real Docker healthcheck command was already the updated explicit-exit Node
probe. In the same candidate container, `/health` returned 200 in about 99 ms,
while `/ready` returned 200 only after about 4.4 seconds. `/ready` performs the
signed catalog and publication validation, so it is a readiness/release gate,
not a three-second liveness probe. BusyBox `wget` was also rejected: this
server's streamed response did not complete within its download timeout.

## Fix and verification

Admin and Identity healthchecks now use Node's built-in `http.get` with
`agent:false`, a 2-second socket timeout, response drain, and explicit success,
non-2xx, and error exits against `/health`. The official Windows Compose
configuration was run with only the isolated Admin service: Docker recorded
four consecutive exit-0 healthchecks and `healthy` under the unchanged
three-second timeout. The probe exits were 0 for `/health`, 1 for a 404, and 1
for a refused loopback port. The temporary Compose project was removed without
`--volumes`.

## Remaining acceptance

Run the full production-shaped stack and independently call `/ready` as the
post-start catalog validation gate. This local Docker evidence is not a server
deployment or real user/SSO acceptance.
