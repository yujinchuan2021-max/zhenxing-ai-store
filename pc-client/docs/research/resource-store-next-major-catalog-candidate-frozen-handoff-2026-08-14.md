# Resource Store next-major catalog candidate frozen handoff

Date: 2026-08-14

Status: **candidate-only / freeze-only / not publishable**

Scope: exactly one generator, one focused test, one generated candidate, and this handoff. This is not catalog publication, signing, release, installation, authorization, or state-write authority.

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json` | `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4` |
| `docs/research/resource-store-next-major-consolidation-active7-2026-08-14.json` | `131182b35aaf510230c574f343c7174a860e8a1a1a0df5e3cd0e03558840373c` |
| `docs/research/community-skill-scenario-tags-overlay-candidate-active7-2026-08-13.json` | `4cd3a7fe2444103181d517eaf63ea344529cabf947e959779bdc5c3957d1582c` |
| `docs/research/resource-connection-relations-next-major-candidate-active7-2026-08-14.json` | `7cd8e1c27a685b6f1e88e6680d7b73efde8404419a807bf2d848b10e634f7017` |

The generator rejects any byte drift before parsing or composing these inputs.

## Exact composition

- Structured-clone active7 `payload.catalog`; preserve catalog schema version 2 and `updatedAt` (`2026-08-08T18:27:54.775Z`). The signed release envelope and signature are not copied or changed.
- Build the active7 Skill source partition from catalog facts: exactly 104 `sourceKind: "reviewed-community"` Skill IDs and 16 `sourceKind: "official"` Skill IDs. The 104 `scenarioTags` overlay IDs must exactly equal the community set and contain no official ID; the 16 overlay-ledger `unclassified` rows do not write empty tags.
- Append the exact seven `consolidation.proposedResources[].resource` values, followed by the exact five truthy `relations.resourceFamilies[].proposedResource` values. Wrapper/ledger fields do not enter the catalog.
- Project only dependencies of `status: "bound"` bindings into the sibling `resourceConnections` array. Each edge has exactly `resourceId`, `hostProductId`, `connectionMode`, and `bindingKind`. Five unbound D12-D16 families contribute zero edges and zero resources.
- No edge is inferred for Lovable MCP, Lucid for Claude, or Microsoft Learn MCP Server. Dropbox retains four hosts and six distinct four-field edges, including its two mode variants on both ChatGPT and Claude hosts.

Exact generated totals:

| Measure | Count |
| --- | ---: |
| Resources | 262 |
| Targets | 796 |
| Skill memberships | 124 |
| MCP memberships | 126 |
| Plugin memberships | 8 |
| Connector memberships | 9 |
| Tagged Skills | 104 |
| Unclassified Skills | 20 |
| Appended Resources | 12 |
| Resource connection edges | 10 |

All 12 appended Resources are resource-link-only: every target has `moduleId: "resource-link"`, `capabilities: ["website"]`, and an empty `installProfileId`. The candidate introduces no managed-install, command, argument, environment, endpoint, token, or credential-collection surface.

## Public seams and reversibility

The focused test passes the generated catalog through `validateCatalog(candidate.catalog)` and then projects it through:

```js
createResourceMarketplace({
  ...candidate.catalog,
  connections: candidate.resourceConnections
})
```

It independently reconstructs the 104 overlays, 12 appended Resources, and 10 bound dependency tuples from the frozen sources. It then removes only the exact 12 appended IDs and deletes tags only from the exact 104 overlay IDs; the result deep-equals active7. `resourceConnections` remains outside `candidate.catalog`.

## TDD and verification evidence

Initial RED, before generator/candidate creation:

```text
node --test tests/resource-store-next-major-catalog-candidate.test.cjs
tests 1; pass 0; fail 1
AssertionError: next-major catalog candidate must exist
```

The expanded contract also remained RED with the candidate absent (`tests 2; pass 0; fail 2`). The P1 repair added a collection-level counterexample that replaced one community overlay ID with the active official Skill `openai-codex-skills-catalog` while preserving 104 unique, nonempty rows. The old builder incorrectly accepted it, producing the required RED:

```text
tests 3; pass 2; fail 1
AssertionError: Missing expected exception
```

Final focused GREEN:

```text
tests 3; pass 3; fail 0
```

The third test exercises fail-closed rejection for frozen-input SHA drift, a missing overlay row, duplicate overlay identity, community-to-official overlay substitution, conflicting pre-existing tags, duplicate appended Resource ID, and an unbound dependency tuple. It also asserts the exact Dropbox four-host/six-edge projection and four-field edge uniqueness.

Combined focused and companion command:

```text
node --test tests/community-skill-scenario-tags-overlay-candidate.test.cjs tests/resource-connection-relations-next-major-candidate.test.cjs tests/resource-store-next-major-consolidation-active7.test.cjs tests/resource-store-next-major-catalog-candidate.test.cjs
tests 12; pass 12; fail 0
```

Re-running the generator produced the same candidate SHA before and after: `8822496b0b768605f2a0ecd7c6ebf70759107cb215cfb2cce1a6a2ae5caaf302`.

## Frozen output bytes

| Output | SHA-256 |
| --- | --- |
| `scripts/generate-resource-store-next-major-catalog-candidate.cjs` | `13e28c79e16a175566e4d2de25ef6938b243ef3e8be5250109a204749f2cd738` |
| `tests/resource-store-next-major-catalog-candidate.test.cjs` | `3d9a2d218776a8aba57fa33eb9139fd90fed58f06041325772dd7084d35090ee` |
| `docs/research/resource-store-next-major-catalog-candidate-active7-2026-08-14.json` | `8822496b0b768605f2a0ecd7c6ebf70759107cb215cfb2cce1a6a2ae5caaf302` |

The handoff SHA is intentionally recorded externally after this file is frozen to avoid self-reference.

## Protected-scope boundary

The generator has one write target: the candidate JSON above. This slice did not edit active catalog/release/state, schema, `src/App.tsx`, server, preload/main, or `package.json`. The shared worktree already contains unrelated modified/untracked files in some of those areas; this handoff does not claim the repository is clean and does not adopt those bytes as this slice's work.

Rollback before any separately authorized consumption is deletion of these four candidate-only files. No active or production rollback is needed because this slice performs no active/state/release write.
