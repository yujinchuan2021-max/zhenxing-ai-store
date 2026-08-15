# Catalog v3 resource connection contract

## Symptom

The Resource Marketplace could display reviewed connection facts from a candidate-only sibling `resourceConnections` array, but catalog schema v2 could not legally carry those facts. Moving the array into a catalog without a new schema boundary either made the exact-field validator reject it or risked weakening v2 compatibility.

One existing renderer fixture had already drifted into the impossible combination `schemaVersion: 2` plus `resourceConnections`, bypassing the central catalog validator.

## Evidence

- Schema v2 exact fields rejected `resourceConnections` as an unknown top-level field.
- Before this change, every schema v3 input stopped at the generic `目录结构无效` gate, so required connection fields and invalid edge semantics were not distinguishable.
- The resource, resource-store, product `directoryKind`, product-extension prohibition, and per-resource validation branches were all written as v2-only conditions. Merely allowing version 3 would therefore have skipped core validation.
- `shared/active-catalog-products.cjs`, `shared/development-catalog.cjs`, and the renderer DTO accepted only catalog versions 1 and 2.
- The existing App imported `resource-marketplace.cjs` and `catalog-taxonomy.cjs`, but both CommonJS modules were absent from Vite's paired prebundle lists. The related development-preview regression exposed the two omissions sequentially.
- A later exact-set audit found 23 unique direct shared CommonJS imports in `App.tsx`, but 24 unique entries in each Vite prebundle array. The sole extra in both arrays was the stale `@aihub-shared/product-entry-points.cjs` entry.
- The previous development-preview test still passed 3/3 because it only checked that every App import appeared twice somewhere in the whole Vite source. It did not parse the two arrays independently or reject extra entries.

## Root cause

Connection relationships matured through a separate candidate/UI seam after catalog schema v2 was frozen. Runtime validation, consumers, types, fixture versioning, and Vite CommonJS compatibility had not yet been advanced together behind one versioned catalog contract. The Vite regression test enforced only subset coverage, so a stale extra entry could survive while the handoff incorrectly described the sets as exact.

## Disproven assumptions

- Adding `resourceConnections` as an optional v2 field is not backward compatible. Exact v2 validators and older clients must continue to reject it.
- Adding `3` only to the top-level version allowlist is unsafe because it bypasses every old `schemaVersion === 2` resource rule.
- A valid-looking connection array cannot be trusted by shape alone. Mode/binding pairing, canonical Resource, enabled AI host, matching target, resource type, and full four-field edge uniqueness must all reuse the existing marketplace validator.
- A direct CommonJS import working in one bundled path does not prove development prebundling is complete; the include and interop sets must exactly cover the App imports.
- Two occurrences anywhere in `vite.config.ts` do not prove that a module appears exactly once in each prebundle array, and subset coverage does not prove exact-set equality.

## Fix

- Catalog versions now have separate exact field sets: v2 still forbids `resourceConnections`; v3 requires it to be an array.
- Catalog v2 and v3 share all resource-store, Resource, product directory, extension, localization, policy, and catalog UI rules.
- After normal catalog validation, v3 calls `createResourceMarketplace({ ...catalog, connections: catalog.resourceConnections })`, preserving the existing fail-closed four-field relationship contract instead of adding a second validator.
- Schema v1 normalization remains exact v1 to v2; existing v1/v2 behavior is unchanged.
- Active-catalog product projection and development catalog loading accept versions 1, 2, and 3 and reject version 4. Development loading additionally requires v3 `resources` and `resourceConnections` arrays. Relationship edges do not create Workflow dependency authorization.
- The renderer DTO expresses v3 as the only version that requires `resourceConnections`; the existing relationship fixture is now schema v3.
- With explicit owner authorization, Vite's `optimizeDeps.include` and `needsInterop` each gained the two already-imported CommonJS modules `resource-marketplace.cjs` and `catalog-taxonomy.cjs`.
- The stale `product-entry-points.cjs` entry was removed from both Vite arrays. The development-preview test now parses `include` and `needsInterop` separately and deep-compares each sorted array with the unique sorted direct imports from `App.tsx`.
- A new candidate-only generator moves the exact 10 frozen sibling edges into catalog v3. It does not sign, publish, activate, package, or write state/channel data.

## Verification

TDD Slice A first produced 5 tests with 2 passing and 3 failing: valid v3 stopped at the generic version gate, invalid edges never reached the marketplace seam, and active-catalog consumers rejected v3. After the versioned runtime change, the focused slice passed.

TDD Slice B then produced 6 tests with 5 passing and 1 failing because the independent v3 artifact did not exist. After the generator created it, the focused suite passed the artifact boundary.

The final audit found that merely asserting both versions throw could still be falsely green if a v3 shared-rule guard regressed and a later validator threw a different error. A table-driven parity seam now applies the same five invalid catalogs to v2 and v3 and requires the exact error class for: the fixed four resource stores, an unsupported Resource field, invalid product `directoryKind`, forbidden product `extensions`, and a Resource target using an unknown host. Every v3 case retains the legal frozen connection array, so marketplace rejection cannot mask the shared-rule check.

One real mutation was compiled only in the test process by replacing the first `inputSchemaVersion !== 1` guard with `=== 2`. With exact error matching, the focused run produced 8/9 PASS and one intentional RED: v3 returned downstream `生态资源数据无效` instead of the required fixed-store error. The final mutation harness applies the same one-line rollback independently to all four shared guards and proves each mutant is killed without changing production bytes. Focused tests pass 9/9.

Before the exact-set repair, the old development-preview suite passed 3/3 even though independent comparison reported App direct imports 23, `include` 24, and `needsInterop` 24, with `product-entry-points.cjs` as the only extra in each array. After the test was upgraded, the same suite produced the intended 2/3 RED and named that extra entry. Removing only the two stale Vite lines made it GREEN 3/3; both arrays then independently deep-equaled the 23 App imports.

The focused catalog v3 suite passed 9/9, and the related catalog, policy, localization, projection, channel, identity, development-preview, marketplace, and frozen-composition suite passed 62/62. Because the Vite source changed, `npm.cmd run build` was rerun and passed (`tsc -b`, Vite, 110 modules) with only the existing browser-externalization and large-chunk warnings; `npm.cmd run lint` also passed. No GUI, package, live service, network, publication, activation, or v3 signing command was run.

## Remaining acceptance

- The v3 artifact is candidate-only, freeze-only, and not publishable. It has not entered an Admin draft, signed release, active catalog, state, or release channel.
- Existing catalog channels and older clients have no schema negotiation for v3. A future release must first add an explicitly reviewed v3 channel/client compatibility policy or a lossless v2 projection; extracting this candidate catalog into the current v2 channel is prohibited.
- Admin round-trip, release signature verification, remote client projection, packaged-client behavior, and real Windows UI acceptance remain separate future gates.
- The shared worktree contains unrelated dirty files. Passing these focused tests is not evidence that the repository or a release is clean.

## Prevention gate

Any future catalog schema version must use its own exact field set while reusing all applicable prior validation rules. Version-only allowlisting is forbidden. Shared v2/v3 negative tests must assert the intended failure class, not merely that some later validation throws, and in-memory mutation checks must continue to kill every shared version guard rollback. Schema v2 must reject relationship fields; schema v3 must require and validate them through the marketplace seam. Vite's `include` and `needsInterop` arrays must each independently deep-equal the unique direct shared CommonJS imports in `App.tsx`; whole-file occurrence counts and subset checks are insufficient. Consumer allowlists, DTOs, fixtures, CommonJS prebundling, reverse migration, old-client/channel compatibility, and candidate-only publication boundaries must be checked together before any signing or release authorization.
