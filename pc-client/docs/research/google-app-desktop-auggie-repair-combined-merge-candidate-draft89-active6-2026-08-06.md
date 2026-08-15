# Google app desktop + Auggie repair combined merge candidate

Status: `candidateOnly=true`, `publishable=false`; no state was saved or
published.

The single candidate consumes only the two reviewed canonical candidates.  It
adds `google-app-desktop` to the existing Google vendor using the fixed signed
catalog desktop-download contract, and adds only `repair` to the existing
`augment-auggie-cli` capabilities.  Auggie's already-bound `update`, module,
and profile remain unchanged.

Verified preconditions are draft89 with 615 products, v2 active6
`catalog-v00000006-567e671621f1-3dcee587`, and v1 active72.  In memory,
`validateCatalog` and `validatePublication` pass; the result is 616 products,
146 resources, and 4 resource stores.  CLI coverage becomes 33 ready, 1
partial, 1 deploy-only, and 13 official-blocked.

All existing products except Auggie and all resources are deep-equal.  The
candidate binding fields contain none of the forbidden execution fields.  A
separate authorization must recheck the listed preconditions before any save
or publication.
