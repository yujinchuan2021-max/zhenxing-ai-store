# Admin-only isolated switch diagnosis

Date: 2026-08-06. Scope: an isolated Docker network and loopback port only; the
existing production Admin `zhenxing-ai/admin:0.1.36` remained running.

The verified read-only image is `zhenxing-ai/admin:0.1.40-src-54f084a49b74`
(`sha256:452dadd2868e610edc49d0a0854a4618b98bb80e7ca594475afd6defb1e941a7`),
with source digest `54f084a49b745882146ced2def8f70c3eb44dd47e03d6a308e9ab5daef879616`.

## Isolated evidence

Server report: `/opt/zhenxing-ai/shared/backups/admin-only-isolated-diagnosis-20260806T092947Z/`.

- `GET /ready`: 200, `mode=read-only`; the real response has
  `signingKeyId: null` and no legacy `keyId` property.
- A non-GET `/api/catalog` request returned 503.
- v1 active72 and v2 active6 both returned 200, verified with the stored public
  key, and matched the local HTTP transport hashes respectively
  `6eb104a4e2834ecf9f943756e4d362563aeaa04713b64008db81b8d190594456` and
  `1832bdc815c1084f8da3cb9adcf1b23e97f19f6c58dc65c72a587a008ef60878`.
- The private Caddy health listener returned 200 and a known vendor icon returned
  200 with a non-empty body.
- An isolated, explicit HTTP-only Caddy listener matched `Host: zhenxingai.com`
  and returned 200. It used no public port and did not request a certificate.

## Root cause of earlier rollbacks

The first Caddy health check used an unsupported BusyBox flag and a host that
did not match the site. The second switch reached healthy Admin and Caddy, but
the release check incorrectly expected legacy `keyId: null`, compared immutable
release-file hashes rather than HTTP transport hashes, and tested Caddy's
container-local listener from the Admin container. Its diagnostic logger also
used an unsupported Docker `--no-color` option.

`deployment/admin-only/final-switch-v2.sh` is the replacement: every failure is
named, Caddy logs use the supported `docker logs --timestamps`, and rollback
captures state before stopping the new project. It does not build images,
publish catalogs, or modify persistent published state.

## Preconditions for a future authorized switch

Use the already verified image, the prepared read-only persistent directories,
and the verified `predeploy-admin-20260806T085344Z` backup. Confirm the release
contract hash and that the old Admin image and named volumes still exist. Run
the script only with the approved non-secret environment variables and a valid
`zhenxingai.com` DNS record. A failure stops only the new project and restarts
the old Admin; no volume removal or prune is allowed.
