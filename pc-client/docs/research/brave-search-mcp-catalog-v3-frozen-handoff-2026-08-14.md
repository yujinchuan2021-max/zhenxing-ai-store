# Brave Search MCP catalog v3 frozen handoff

Date: 2026-08-14

Status: **candidate-only / freeze-only / not publishable**

This handoff freezes one incremental MCP Resource over the existing catalog v3 candidate. It does not authorize an Admin draft, active catalog or channel write, signing, publishing, packaging, installation, configuration, credential collection, server startup, or GUI acceptance.

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `docs/research/catalog-v3-resource-connections-candidate-2026-08-14.json` | `43bc18592106542d778ba47fc693fa42826b1febbdc166c7c9e2d9d617c95fd8` |
| `docs/research/cocoloop-stop4069-review-queue-upstream-sample-2026-08-14.md` | `747beaccd86d7e4eb46cbbd5470ba178dfcd5f1c7ccb0b41b408fcc9f9afedbc` |

The CocoLoop research row was blocked only from being treated as a Skill: the fixed upstream contains no `SKILL.md`. This separately authorized slice classifies the same first-party bytes in their evidenced lane as an MCP Resource.

Fixed upstream facts:

- repository: `brave/brave-search-mcp-server`
- commit: `937e85a61f69e36f5a88e44308d47836a8d5d523`
- package: `@brave/brave-search-mcp-server` version `2.1.0`
- publisher/author: `Brave Software, Inc.`
- same-commit license: `MIT`
- README-named hosts: Claude Desktop and Visual Studio Code
- runtime boundary documented upstream: NPX or Docker, stdio or HTTP, network search, and user-supplied `BRAVE_API_KEY`

No network request was made in this slice. The fixed research and local base were sufficient.

## Exact candidate transformation

The generator verifies both input hashes, validates the unchanged v3 base through `validateCatalog`, rejects exact ID/name/external identity or canonical GitHub repository duplicates, structured-clones the base, and appends one Resource:

- `id=brave-search-mcp-server`
- `resourceTypes=["mcp"]`
- `publisherVendorId=brave`
- `sourceKind=official`
- `reviewStatus=manually-reviewed`
- `riskLevel=guarded` — the current catalog contract has `low`, `guarded`, and `unsafe`; it has no `high` enum. Network access, API key, quota/cost, and host-launched server behavior rule out `low`, while link-only discovery does not grant execution.
- `versionRef=package.json@2.1.0+937e85a61f69e36f5a88e44308d47836a8d5d523`
- exact first-party repository, README, `package.json`, and MIT license evidence at the same commit

The only targets are `claude-desktop` and `microsoft-vscode`. Each target is exactly `resource-link`, `installProfileId=""`, `capabilities=["website"]`, and `enabled=true`. The credential statement tells users to save `BRAVE_API_KEY` themselves in the host and states that 枕星 AI never collects, stores, or forwards it. `installScope` only opens the fixed official instructions and explicitly does not write host configuration, run NPX/Docker, or start stdio/HTTP servers.

No `command`, `args`, `env`, `headers`, `credentials`, `token`, `endpoint`, `secret`, install-runtime, or executable configuration field is present. No `resourceConnections` edge was added or inferred.

Exact totals:

| Measure | Base | Candidate |
| --- | ---: | ---: |
| Resources | 262 | 263 |
| Targets | 796 | 798 |
| Resource connections | 10 | 10 |

Removing the final Brave Resource deep-equals the frozen v3 base catalog. The ten relationship rows deep-equal the base rows before and after the transformation. The base file remained at its frozen SHA.

Candidate SHA-256: `990721f3f8e55923d7014eb603ed9c3059e7e06f66415991b08e7e3164aca219`

## TDD evidence

Required initial RED:

```text
node --test tests/brave-search-mcp-catalog-v3-candidate.test.cjs
tests 1; pass 0; fail 1
Brave Search MCP candidate must exist
```

After the minimal generator and candidate were added, the existence slice passed 1/1. The retained focused suite then checks frozen hashes, exact outer/resource/target field sets, exact provenance/version/license facts, never-collect wording, recursive runtime-field exclusion, unchanged relationships, public `validateCatalog`, reverse equivalence, active/history identity absence, and generator rejection of input drift/name/source collisions.

Final focused plus base-v3 regression:

```text
node --test tests/brave-search-mcp-catalog-v3-candidate.test.cjs tests/catalog-v3-resource-connections.test.cjs tests/resource-store-next-major-catalog-candidate.test.cjs
tests 15; pass 15; fail 0
```

The generator was run a second time after the tests; the candidate SHA remained byte-identical. Generator and test passed `node --check`.

## Protected scope

Only the generator, focused test, candidate JSON, and this handoff were added. The v3 base candidate, ClawHub BLOCKED files, active/history catalogs, state, channel, release, `src/App.tsx`, server, package files, schemas, and shared runtime modules were not edited. Existing dirty worktree bytes were preserved and are not represented as clean.
