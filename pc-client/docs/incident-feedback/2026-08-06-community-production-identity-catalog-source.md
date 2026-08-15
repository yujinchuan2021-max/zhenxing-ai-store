# Community production Identity catalog source mismatch

## Impact

The production-shaped stack configured Identity with
`http://admin:4173/catalog-release.json`, while the existing Identity consumer
accepted only the raw `/catalog-v1.json` shape. Identity rejected the URL during
startup and restarted continuously, so downstream Community and Caddy services
could not start.

## Root cause

The local raw-catalog compatibility rule treated the Docker service name
`admin` as a generally trusted HTTP host, but constrained it to a different
path. The production Compose contract changed the path without adding a signed
release consumer. Merely permitting the new path would have passed a signed
envelope to a raw-catalog parser and would not have established signature or
rollback protection.

## Resolution and regression gate

- Ordinary HTTP catalog consumers now accept loopback only; `admin` is not a
  general local-host exception.
- An explicit `signed-internal-admin` mode accepts exactly
  `http://admin:4173/catalog-release.json` and no near-match.
- The mode verifies the Ed25519 envelope using the existing public channel key,
  validates release integrity and the full catalog, and maintains version/hash
  high water initialized from the deployed v1 release.
- Unit coverage rejects alternate hosts, ports, paths, query strings and
  credentials, rejects rollback after a newer accepted release, and proves the
  local raw fallback remains loopback-only.
- The production Identity image copies the public channel configuration and the
  shared validation modules; it never includes the signing private key.

No catalog state, signed release, server, account, or production data was
changed by this fix.

## Isolated Docker evidence

The exact Identity dependency closure contained 46 source inputs with content
digest `e5a9b797c20f948b10d4d585afcb3a2f01a2f4817b7b172f5fe060e905d3d7bf`.
The resulting local-only candidate image is
`zhenxing-ai/identity:community-candidate-e5a9b797c20f` with image ID
`sha256:cabc1c5f49e670d221dc07d8947a1cf793356715f475f2a92bf4afd9d3b23a69`.

On an isolated Docker network, the current Admin candidate served the mounted
immutable v1 release and the new Identity container reached Docker
`health=healthy` with three consecutive real health-log entries at exit code
zero. A separate process in the same exact Identity image fetched
`http://admin:4173/catalog-release.json`, verified the deployed public key,
v1 catalog version 72 and catalog SHA high-water, validated the catalog, and
returned exactly 615 enabled product IDs. Both proof containers and their
network were then removed; no complete Community stack or server was started.

## Follow-up: platform-support dependency closure (2026-08-07)

Adding the shared platform-support validator made `product-policy.cjs` require
`resource-platform-availability.cjs`, while the Identity Dockerfile's explicit
shared-file allowlist omitted that new transitive dependency. The deployment
closure test failed before image build rather than allowing a future runtime
`MODULE_NOT_FOUND`.

The Dockerfile now copies only that missing module. The dependency-closure
test derives the allowlist from Identity's real shared entry modules, so a
future missing or surplus shared copy fails deterministically. The deployment
manifest was recomputed, the local candidate image loaded the full shared
closure without starting Identity or a migration, and its `/app` secret-shaped
path scan was clean. No catalog, state, server, or production image changed.
