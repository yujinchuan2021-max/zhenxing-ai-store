# AdAdvisor + AdRamp MCP Catalog v3 Candidate — Frozen Handoff

- Date: 2026-08-14
- Status: `candidateOnly=true`, `freezeOnly=true`, `publishable=false`
- Scope: two first-party hosted MCP resources as link-only catalog entries
- Explicitly out of scope: active catalog/state/channel/release writes, signing, packaging, publishing, OAuth, MCP calls, login, installation, runtime configuration, and network access

## Frozen inputs

| Input | SHA-256 |
|---|---|
| `docs/research/aws-agents-build-skill-catalog-v3-candidate-2026-08-14.json` | `c7cd67c2b4b34fd19cfbe217d728f7d572c22db1df479e663372b257c067e74d` |
| `docs/research/official-mcp-registry-next10-first-party-review-2026-08-14.md` | `da43d7555f1e657a30dc4d233f445778760fcbee7fc49de892f21b6a25ed2a24` |

The generator rejects either input when its bytes no longer match the frozen SHA.

## Deterministic transformation

The generator validates the frozen AWS catalog-v3 candidate, performs semantic identity checks against the full base catalog and the existing research JSON candidate/review/index history, then appends exactly these two resources in this order:

1. `adadvisor-mcp-server`
2. `adramp-google-ads-mcp`

History dedupe recognizes a later candidate only when its structured `inputs` path-and-SHA chain, verified against the actual intermediate artifact bytes, reaches this exact advertising candidate SHA and every artifact on that chain preserves both advertising Resources by deep equality. Even then, only those two individually deep-equal objects in that entry's `catalog.resources` array, including their subtrees, are exempt from duplicate scanning. Every other object and field in the successor remains scanned. Forged paths or hashes, cycles, and identity copies without that ancestry remain rejected.

The resulting catalog has exactly:

- 266 unique resources
- 809 targets
- 10 resource connections
- 2 appended resources

Removing the final two resources returns a catalog that is byte-content equivalent under `deepEqual` to the frozen AWS base catalog. The 10 existing `resourceConnections` are unchanged; neither new link-only resource receives a fabricated relationship edge. Running the generator twice produces the same candidate bytes.

## Resource facts and safety boundary

| Fact | AdAdvisor | AdRamp |
|---|---|---|
| Resource ID | `adadvisor-mcp-server` | `adramp-google-ads-mcp` |
| Registry identity | `ai.adadvisor/mcp-server@1.0.1` | `ai.adramp/google-ads@1.0.3` |
| Publisher | AdAdvisor, Inc. | Product Stream Technologies SRL |
| License boundary | first-party hosted service terms; rolling service | first-party hosted service terms; rolling service |
| Risk | `unsafe` (maps the reviewed high-risk write capability into the existing schema) | `guarded` |
| Compatible hosts | Claude Desktop, Claude Code, Cursor, Windsurf | Claude Code, Cursor, VS Code, Windsurf |
| Auth fact | user independently logs in to AdAdvisor and grants Meta OAuth | publisher claims no AdRamp account or API key is required; user independently grants publisher-claimed read-only Google OAuth and may revoke it in Google |
| Side effects | can read data and, after publisher-claimed draft/approval, create campaigns, upload creative, build audiences, pause or adjust ads; real budget effects remain possible | publisher claims read-only ad-data access and no campaign/budget modification |

Publisher approval, audit-log, read-only, and data-retention statements remain attributed publisher claims; they are not AI Hub security certification.

Both entries are intentionally plain `resource-link` targets with `capabilities:["website"]` and `installProfileId:""`. The entries omit `publisherVendorId` and `sourceProductIds` because the public schema does not require them and the frozen evidence does not establish a truthful existing product relation.

AI Hub only opens the first-party information page. It does not:

- initiate OAuth or provider login;
- request, collect, store, proxy, validate, or forward credentials;
- save a connection or write host configuration;
- call either MCP service or any advertised tool;
- store command, args, env, headers, endpoint, token, secret, package, path, script, value, managed-install, or other runtime fields.

## TDD evidence

### RED

Before the candidate existed:

```text
node --test tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs
tests 1; pass 0; fail 1
AssertionError: AdAdvisor and AdRamp MCP candidate must exist
```

P1 semantic-history regression before the repair:

```text
node --test tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs
tests 5; pass 4; fail 1
history dedupe normalizes canonical URLs and names without matching prose
AssertionError: Missing expected exception
```

The failing counterexample stored a renamed resource with a new external ID and canonical source `https://adramp.ai/mcp` (without the candidate's trailing slash). The old raw-substring scan missed it.

P1 credential-fact regression before the repair:

```text
node --test tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs
tests 5; pass 4; fail 1
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal
actual omitted: 发布方称使用 AdRamp 服务无需 AdRamp 账户或 API key
```

The missing fact was the publisher claim that an AdRamp account or API key is not required. It is now recorded separately from AI Hub's independent `never-collect` policy.

Structured successor regression after the Adeu descendant candidate existed:

```text
node --test tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs
tests 6; pass 4; fail 2
Got unwanted exception: historical semantic identity already exists
```

The old scan treated the full downstream Adeu catalog as an independent duplicate and also broke this generator's existing idempotence test. The new negative table keeps forged hash/path, cyclic ancestry, and same-identity/no-ancestry artifacts fail-closed.

Selective-inheritance regression found by independent audit:

```text
node --test tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs
tests 6; pass 5; fail 1
AssertionError: Missing expected exception
```

The counterexample used the real Adeu direct successor path and SHA with the two exact inherited advertising Resources, then appended an independent `{ id: renamed-independent-adadvisor-copy, name: AdAdvisor MCP Server, publisher: AdAdvisor, Inc. }` object. The previous whole-entry exemption accepted it. The repaired traversal exempts only the two exact inherited Resource objects and rejects that additional identity.

### GREEN

Focused behavior suite:

```text
node --test tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs
tests 6; pass 6; fail 0; duration_ms 5174.1821
```

Limited joint regression:

```text
node --test --test-concurrency=1 tests/adeu-mcp-catalog-v3-candidate.test.cjs tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs tests/aws-agents-build-skill-catalog-v3-candidate.test.cjs tests/brave-search-mcp-catalog-v3-candidate.test.cjs tests/catalog-v3-resource-connections.test.cjs
tests 27; pass 27; fail 0; duration_ms 13921.0044
```

The focused suite verifies frozen input hashes, exact outer flags and counts, exact resource identities/order/hosts/targets, publisher-attributed auth and side-effect facts, the separate AI Hub never-collect boundary, absence of publisher/product inference, unchanged relations, recursive runtime-field exclusion, `validateCatalog` identity, exact reversal, current/history semantic duplicate rejection, canonical URL and name normalization, prose-only non-collision, verified direct/transitive successor ancestry, object-scoped inherited-resource exemption, additional successor identity rejection, forged and cyclic ancestry rejection, base-contract failure, and byte-idempotence.

## Frozen implementation files

| Path | SHA-256 before this handoff was finalized |
|---|---|
| `docs/research/adadvisor-adramp-mcp-catalog-v3-candidate-2026-08-14.json` | `68d0a4e7d68f5a2bac778116fa0e6bc56df298f4c39c9d929896c3cd9120032f` |
| `scripts/generate-adadvisor-adramp-mcp-catalog-v3-candidate.cjs` | `fba5ad6db7eeff668f0b602270983053615a7034431df3ef62c7e927bffa560a` |
| `tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs` | `f67ec6e2c5a8c5d9629f39da5dc24ea2e8e2baa57bf43a85c0932cf39dc94ad3` |

The handoff SHA and the path-sorted four-file manifest SHA are computed only after all four files are frozen and are reported outside this self-referential document.

## Remaining authority boundary

This candidate is review evidence only. It was not written into the active catalog, saved as release state, signed, packaged, or published. Shared worktree dirt outside these four files is neither claimed nor modified.
