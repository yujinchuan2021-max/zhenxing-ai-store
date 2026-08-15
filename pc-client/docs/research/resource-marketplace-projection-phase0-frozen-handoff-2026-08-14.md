# Resource Marketplace projection Phase 0 frozen handoff

## Outcome

Phase 0 adds one pure, resource-first projection module. A catalog snapshot is supplied once and the returned interface contains exactly two operations:

- `browse(query)`
- `detail(resourceId)`

`browse` emits each enabled canonical Resource once, aggregates its enabled targets into stable compatible-host facts, and supports the minimum scalar filters: `store`, `category`, `hostId`, and `source`. Publisher is projected as a fact only; it does not create a vendor or publisher hierarchy. `detail` resolves the same canonical projection by resource ID.

## TDD evidence

- RED: `node --test --test-reporter=spec tests/resource-marketplace-projection.test.cjs` failed with `MODULE_NOT_FOUND` for `shared/resource-marketplace.cjs`.
- GREEN: the same focused command passed 2/2 tests.
- Active7 projection: 250 unique resources; store counts Skill 120, MCP 123, Plugin 8, Connector 3; the source catalog remained 250 resources and 777 targets.

## P1 duplicate-ID remediation

- RED: two input records with the same `resource.id` were accepted; `browse()` exposed both while `detail(resourceId)` resolved the last record. The focused regression test failed with `Missing expected exception`.
- GREEN: `createResourceMarketplace` now fails closed during construction with the fixed safe error `resource marketplace duplicate resource id`; the focused suite passed 3/3 tests.
- Existing active7 uniqueness, multi-host aggregation, store counts, filters, and catalog-identity assertions remain unchanged.

## Frozen scope

Changed only:

- `shared/resource-marketplace.cjs`
- `tests/resource-marketplace-projection.test.cjs`
- this handoff

No App, catalog data, schema, state, channel, release, signing, save, publish, package, or server path was changed. Phase 0 deliberately excludes Collection data, search ranking, pagination protocols, GraphQL, graph databases, UI migration, installation, and execution behavior.

## Consumption boundary

This module is a pure candidate seam, not an active UI integration. A later separately authorized phase may replace `ResourceStorePage` product-first projection with this interface. Product and Vendor directories remain independently owned and unchanged.
