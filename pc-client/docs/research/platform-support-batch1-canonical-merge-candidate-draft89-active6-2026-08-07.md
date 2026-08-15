# platformSupport Batch 1 canonical merge candidate

Status: `candidateOnly=true`, `publishable=false`. This is a deterministic
merge manifest, not a catalog patch or a release authorization.

## Verified source

- Raw draft: revision 89, 615 products, 146 resources, 513 targets.
- V2 active: 6, `catalog-v00000006-567e671621f1-3dcee587`.
- Evidence snapshot SHA-256:
  `bcf4d684a3f481b11475d54fb5c16d1367801177fb83ae89544102a6853fae32`.
- In-memory merged catalog SHA-256 (`JSON.stringify` serialization):
  `70b1260150082db22f47fc4069ddb329bab3f30a8c8a16ce34d2e8535b9d9d41`.

The JSON manifest records every product/vendor pair and a SHA-256 of its exact
source `claims` array. A consumer must verify both the evidence-file digest and
each per-product digest, then copy only that exact array to the product's
`platformSupport` field. This avoids a second, divergent copy of 60 claims.

## Result

20 products / 60 claims: 53 `supported`, 7 `unknown`. The remaining 595
products, all 146 resources, 513 targets, and four stores deep-compare
unchanged. `validateCatalog`, `validatePublication`, and the candidate adapter
all pass only in memory.

No product gains an artifact, fixed profile, lifecycle, receipt, download
action, install permission, or Agent binding. No claim is copied to a resource,
target, or host profile; Agent Broker remains fail-closed for absent resource
and profile declarations.

## Consumption and rollback

Before any separately authorized save, re-read revision/active pointer/counts,
source digests, record identities, and all non-platform fields. Reject any
drift. The current active state has no platform claims, so rollback is simply
discarding this candidate; a future consumed draft may remove only these 20
product fields after the same digest checks.
