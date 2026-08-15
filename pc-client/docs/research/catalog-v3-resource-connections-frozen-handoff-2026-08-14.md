# Catalog v3 resourceConnections frozen handoff

Date: 2026-08-14

Status: **candidate-only / freeze-only / not publishable**

This handoff covers catalog v3 runtime validation and one independent data candidate. It is not authority to save an Admin draft, sign a catalog, change an active catalog or channel, publish, package, start a service, or perform GUI acceptance.

## Frozen source

| Input | SHA-256 |
| --- | --- |
| `docs/research/resource-store-next-major-catalog-candidate-active7-2026-08-14.json` | `8822496b0b768605f2a0ecd7c6ebf70759107cb215cfb2cce1a6a2ae5caaf302` |

The source contains a schema v2 `catalog` and 10 reviewed sibling `resourceConnections`. The generator rejects any byte drift before parsing it. Active7 remained `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4` throughout this slice.

## Runtime contract

- Catalog v1 keeps its exact legacy fields and normalization result: valid v1 normalizes to v2.
- Catalog v2 keeps its exact fields and rejects `resourceConnections`.
- Catalog v3 uses the v2 fields plus required `resourceConnections`; missing or non-array values fail closed.
- Every v2 resource-store, Resource, product `directoryKind`, product-extension prohibition, localization, policy, and presentation rule also runs for v3.
- After normal catalog validation, v3 reuses `createResourceMarketplace({ ...catalog, connections: catalog.resourceConnections })`. Wrong mode/binding pairs, unknown Resources, unknown hosts, target mismatches, invalid resource types, unexpected edge fields, and duplicate four-field edges therefore fail at the existing public seam.
- Active product and development catalog consumers accept catalog versions 1, 2, and 3 and reject 4. Development loading requires the v3 resource and connection arrays. Relationship edges are not Workflow execution or dependency authorization.
- `RemoteCatalog` makes v3 the only version with required connection edges. The relationship UI fixture now identifies itself as v3.

No release-envelope, trust-channel, active-state, server, signing, or package schema was changed.

## Candidate transformation

The candidate generator structured-clones the frozen composition catalog, changes only `catalog.schemaVersion` from 2 to 3, and moves the exact sibling edge array to `catalog.resourceConnections`. The candidate outer object has no sibling `resourceConnections`.

Exact totals:

| Measure | Count |
| --- | ---: |
| Resources | 262 |
| Targets | 796 |
| Resource connection edges | 10 |

Deleting `catalog.resourceConnections` and changing `catalog.schemaVersion` back to 2 deep-equals the frozen source `catalog`; the removed edges deep-equal the frozen sibling array.

## TDD evidence

Slice A RED:

```text
node --test tests/catalog-v3-resource-connections.test.cjs
tests 5; pass 2; fail 3
```

The failures proved that valid v3 and invalid connection cases stopped at the generic version rejection, while the active catalog consumer rejected v3. The two passing controls proved that v2 still rejected the new field and v1/v2 behavior had not drifted.

Slice B RED, after the runtime became green:

```text
tests 6; pass 5; fail 1
AssertionError: catalog v3 candidate artifact must exist
```

Parity mutation RED, without a production-file write:

```text
tests 9; pass 8; fail 1
expected: fixed four resource stores
actual: 生态资源数据无效
```

The test process compiled a private copy of `shared/catalog.cjs` with one `inputSchemaVersion !== 1` guard changed to `=== 2`. Exact error matching made the wrong downstream rejection observable. The final harness independently mutates all four shared-rule guards and requires every mutant to break the parity seam; no mutated source was written to disk.

Final focused GREEN:

```text
tests 9; pass 9; fail 0
```

The focused suite behaviorally checks v2/v3 field boundaries, v3 missing/non-array values, legal edges, invalid mode/binding, unknown host, unknown Resource, duplicate edge, exact v1 normalization, unchanged v2, consumer versions 1/2/3 versus 4, Workflow non-authorization, DTO/fixture versioning, exact candidate transformation, public validation, and reverse equivalence. Its parity table additionally applies five identical invalid catalogs to both v2 and v3—fixed-store drift, unsupported Resource field, invalid `directoryKind`, forbidden `extensions`, and unknown target host—while keeping v3 connection edges legal and matching the intended failure class.

Related regression command covered catalog categories/policy/localization/projections/channel, ecosystem resources, identity catalog source, development preview, marketplace, and the frozen next-major composition:

```text
tests 62; pass 62; fail 0
```

Six changed CommonJS files passed `node --check`; tracked changes passed `git diff --check`; both candidate JSON files parsed and reported the expected schema/resource/connection totals. Re-running the v3 generator left the candidate SHA unchanged at `43bc18592106542d778ba47fc693fa42826b1febbdc166c7c9e2d9d617c95fd8`.

The final Vite exact-set test first preserved the old false-green evidence: the old development-preview suite passed 3/3 while an independent comparison found 23 App direct imports but 24 entries in each Vite array. After the test separately parsed `include` and `needsInterop` and deep-compared each with the unique sorted App imports, it produced the intended 2/3 RED and identified `product-entry-points.cjs` as the sole extra. Removing only that entry from both arrays made the suite GREEN 3/3, with independently recomputed 23/23 exact equality.

After the final source change, the focused catalog v3 suite passed 9/9 and the same joint suite passed 62/62. `npm.cmd run build` passed (`tsc -b` plus Vite, 110 modules) with only the existing Node-externalization and large-chunk warnings; `npm.cmd run lint` also passed. The build wrote `dist` only and did not package the app. No long process, service, GUI, network, activation, publication, or v3 artifact-signing command ran.

## Confirmed existing Phase2 compatibility gap

The first related regression run passed 59/60 and exposed that the already-modified App directly imported `resource-marketplace.cjs` without Vite prebundle coverage. After explicit owner authorization added it to both prebundle arrays, the same test exposed the missing `catalog-taxonomy.cjs`, which was also explicitly authorized and added.

A later audit found that the resulting arrays still were not exact: each contained the stale `product-entry-points.cjs` entry even though `App.tsx` did not directly import it. The old test was only a subset/whole-file-occurrence check and therefore passed. The repaired test independently parses both arrays, rejects missing, extra, or duplicate entries through exact deep equality, and now proves `include` 23/23 and `needsInterop` 23/23 against the App's unique direct-import set. Only the two stale Vite lines and the test/evidence were changed; `App.tsx` was not edited.

## Frozen output bytes before handoff self-hash

| Path | SHA-256 |
| --- | --- |
| `docs/incident-feedback/2026-08-14-catalog-v3-resource-connections.md` | `49dd12f4ca75619959e936cae5a81b495313bfd46bc54cc1056e111bb003e5d8` |
| `docs/research/catalog-v3-resource-connections-candidate-2026-08-14.json` | `43bc18592106542d778ba47fc693fa42826b1febbdc166c7c9e2d9d617c95fd8` |
| `scripts/fixtures/installed-management-preview-preload.cjs` | `2dcbee23a3e5956a8c76dcb4036b3882333a4c3ce371878b563c5968a18ed514` |
| `scripts/generate-catalog-v3-resource-connections-candidate.cjs` | `f19f89a1269015e198dbc24bd55ca1047aeed677fa8d1ba93b3655f754fdd3c5` |
| `shared/active-catalog-products.cjs` | `808aefc863009af3cd00d4b5fdc4c246bc8f34bc53def35aa701ebb1dbc23235` |
| `shared/catalog.cjs` | `e9d50d3f9eb41835b58d9035dd661133993ecbdb18b66d95a6f03425477e49a8` |
| `shared/development-catalog.cjs` | `00df2857003af714136e9138c86a4e499608442f5a549be839b64ccffd4143b7` |
| `src/vite-env.d.ts` | `15cadf8fb3fe65398eb1f48ac83a034444ae1810eceae51216a0cf87f0f6b17c` |
| `tests/catalog-v3-resource-connections.test.cjs` | `de18ec4038b73279df783ae620dd796e10d32105f07af7a5378fd2978fad6e02` |
| `tests/development-catalog-preview.test.cjs` | `041b2cd465f72de578f0ffce68789d6118c953b9a22facd9fbeab01162bcef33` |
| `vite.config.ts` | `51d97583fa66f4a14e767b64edb164725f3bcc7fddd20a4dbb8d74048a37fa14` |

The handoff SHA is recorded externally after freezing to avoid self-reference.

## Protected scope and remaining acceptance

This slice did not edit the active7 release, active state, release channels, signing/trust code, server, `src/App.tsx`, package files, or packaged artifacts. Existing dirty bytes were preserved; the fixture and Vite file were changed only at the explicitly authorized version/prebundle seams. This handoff does not claim that the shared worktree is clean.

Catalog v3 cannot be published through the current v2 channel merely because central validation now recognizes it. Existing clients and channels have no v3 negotiation. A future separately authorized release must first provide a reviewed v3 channel/client compatibility rule or a lossless v2 projection, then pass Admin round-trip, signing/verification, remote projection, packaged-client, and real Windows UI acceptance. Until then, this candidate remains data-only and not publishable.
