# Auralogs MCP catalog v3 candidate — frozen handoff

## Outcome

This candidate-only slice appends exactly one official, manually reviewed, unsafe, link-only Resource, `auralogs-mcp`, to the frozen run3-ready4 catalog v3 candidate. The result remains `candidateOnly=true`, `freezeOnly=true`, and `publishable=false`.

The candidate contains 375 vendors, 616 products, 280 Resources, 866 targets, and the same 10 Resource connection rows as its base. Removing the final Auralogs Resource yields a catalog deeply equal to the frozen 279-Resource base.

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `docs/research/official-mcp-registry-run3-ready4-catalog-v3-candidate-2026-08-15.json` | `16116ca707a3dd344a252229758e359e3e4ba123fb6f4fbb8958166b689984e8` |
| `docs/research/official-mcp-registry-run3-next10-primary-review-2026-08-15.md` | `c9cea0f78dc2c9d98c8487e4c91cd11743bbaaff507d58abd06b1a148676838a` |

## Resource boundary

- Identity: `auralogs-mcp`; Registry observation `ai.auralogs/auralogs@0.1.0`; publisher `Auralogs`; risk `unsafe`.
- Exact CompatibleHost targets: `claude-desktop`, `claude-code`, `cursor-desktop`, `cline-agent`, and `codex-cli`.
- Every target is `official + resource-link + website + empty installProfileId + enabled`.
- The public MIT repository supplies Registry metadata and installation documentation, but is not represented as the hosted server implementation.
- The publisher documents seven read-only tools. The link-only card still treats production logs and analyses as high risk because they can expose secrets, PII, incident details, stack traces, and payment context.
- The card records the publisher claim that a project-scoped read key is SHA-256 hashed and that revocation causes the next request to return 401. It also records the 7/30/90-day retention tiers.
- Privacy and Terms currently resolve to the product homepage; legal operator identity, account deletion, backups, and processor lifecycle remain pre-publication gaps.
- AI Hub does not request, collect, store, proxy, validate, or forward keys, logs, authorization material, model secrets, account credentials, or other authentication/business data. It does not download, install, configure, connect, or query Auralogs.
- No `publisherVendorId`, `sourceProductIds`, managed profile, runtime field, endpoint, command, arguments, environment, headers, credential value, token, secret, package execution, OAuth initiation, or Resource connection edge was added.

## TDD and validation evidence

1. Initial RED: the existence test produced 0 pass / 1 fail with `candidate artifact is missing`.
2. Successor-lineage RED: the first history test produced 1 pass / 1 fail because a valid path-and-SHA-verified direct successor was rejected as a historical semantic duplicate.
3. Minimal successor GREEN: the focused slice then produced 2/2 PASS after object-level, exactly-once inheritance was implemented.
4. The first complete focused run produced 4 pass / 1 fail because the install boundary grouped several verbs under one negation. The candidate was tightened to say explicitly `不下载、不安装、不配置、不连接、不查询`.
5. Final focused result: 5/5 PASS in 11.64 seconds. It covers the exact Resource and target projection, `validateCatalog`, deep reversal, all four current/history identity lanes, prose non-collision, valid direct/transitive ancestry, renamed and second-exact copies, forged path/hash, unknown ancestor, cycle fail-closed behavior, frozen input drift, and deterministic candidate bytes.
6. A prior test shape that spawned the full generator twice exceeded the 30-second command limit at 32.3 seconds without producing an assertion failure. It was not repeated. Byte idempotence is instead locked by two pure `buildCandidate` serializations and exact equality with the frozen candidate bytes.
7. One final generator invocation completed in 12.4 seconds, reported 280 Resources / 866 targets / 10 connections, and preserved the candidate SHA before and after.
8. Generator and focused test pass `node --check`; the candidate parses as JSON and `validateCatalog` returns the same catalog object.

The public seam is `buildCandidate(base, history)`. A future candidate may skip exactly one deep-equal inherited Auralogs Resource only through a path-and-SHA-verified direct or transitive ancestry chain. All other objects in that successor remain subject to semantic scanning.

## Frozen implementation bytes

| File | SHA-256 |
| --- | --- |
| `docs/research/auralogs-mcp-catalog-v3-candidate-2026-08-15.json` | `dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8` |
| `scripts/generate-auralogs-mcp-catalog-v3-candidate.cjs` | `341203ed4b197ca33a62253fe94e13e876d785d308d962d29f87547b27495af9` |
| `tests/auralogs-mcp-catalog-v3-candidate.test.cjs` | `1ec18749028506f87b1634afa43be7005fa45ef82fc7c3cae3f9f63d3f271511` |

The four-file aggregate manifest is computed after this handoff freezes. Serialization is relative paths sorted ascending, each line exactly `<sha256><two spaces><path>\n`, UTF-8 without BOM.

## Protected boundary

Only the candidate JSON, generator, focused test, and this handoff belong to this slice. No prior candidate, active catalog, state, channel, release, App, shared schema, package, server, signing, publishing, packaging, host configuration, OAuth state, credential store, or real MCP server was changed or invoked. The shared worktree remains dirty and is not claimed clean.
