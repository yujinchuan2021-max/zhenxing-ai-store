# Identity/community used a stale eight-vendor catalog file

## User-visible failure

The backend and PC client used the active revisioned catalog, while product-linked community discussions were still authorized against `admin/published/catalog-v1.json`. That legacy file contained only eight vendors, so newly published products could be rejected by the identity/community service.

## Evidence

- The active release in `admin/published/catalog-store/state.json` is resolved through the admin service and contains the current expanded catalog.
- `admin/published/catalog-v1.json` is an unversioned legacy file and was not updated by the release store.
- The local identity container mounted that directory and configured `AIHUB_CATALOG_FILE=/app/catalog/catalog-v1.json`.

## Root cause

Identity/community bypassed the catalog publication boundary. It read a second, mutable file path instead of asking the admin service for the active release selected by the revisioned release store.

## Fix

- Identity/community now obtains enabled product IDs from the admin service's active `/catalog-v1.json` endpoint.
- A bounded in-memory cache prevents a backend request for every discussion. Expired cache entries are never used after a refresh failure, so backend unavailability fails closed.
- Identity readiness includes the active catalog source; startup also warms the cache before listening.
- Docker uses `http://admin:4173/catalog-v1.json`, waits for a healthy admin service, and no longer mounts the legacy catalog directory.
- Catalog publication and self-built image rebuild both validate the resolved Docker topology before changing state.

## Verification

- Unit coverage verifies enabled/disabled product filtering, successful caching, stale-cache rejection, topology drift rejection, and both gate entry points.
- `docker compose config --format json` passes the local topology verifier.

## Remaining acceptance

The full Docker identity/community acceptance remains part of the release-level test sequence; passing unit and topology gates does not replace a real discussion creation check against the running services.
