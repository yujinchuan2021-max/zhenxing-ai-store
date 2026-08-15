# Auggie repair canonical merge candidate — draft89 / v2 active6

Status: candidate-only; not publishable and not saved.

The input candidate has stale `currentCapabilities`: authoritative draft89 already
binds `update`.  The sole catalog delta is therefore `repair` for
`augment-auggie-cli`; it preserves `cli-managed` and `cli.augment-auggie`.

Preconditions checked in memory:

- draft revision 89, 615 products;
- v2 active catalog version 6, `catalog-v00000006-567e671621f1-3dcee587`;
- v1 active catalog version 72.

`validateCatalog` and `validatePublication` pass on the in-memory result.  The
CLI matrix becomes 33 managed-ready, 1 managed-partial, 1 deploy-only, and 13
official-blocked.  The other 614 products and all 146 resources are identical.
The proposed binding contains no forbidden execution or download fields.

See the adjacent JSON for the exact, one-capability change.  A later write must
re-read all preconditions and receive explicit authorization; this file does not
authorize saving or publishing.
