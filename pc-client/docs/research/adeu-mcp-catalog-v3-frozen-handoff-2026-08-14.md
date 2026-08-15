# Adeu MCP catalog v3 candidate — frozen handoff

- Date: 2026-08-14
- Status: `candidateOnly=true`, `freezeOnly=true`, `publishable=false`
- Scope: one fixed-commit, first-party Adeu MCP Resource represented only by official links
- Excluded: active catalog/state/channel/release writes, signing, packaging, publishing, installation, runtime configuration, login, credential handling, MCP calls, Adeu execution, and network access

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `docs/research/adadvisor-adramp-mcp-catalog-v3-candidate-2026-08-14.json` | `68d0a4e7d68f5a2bac778116fa0e6bc56df298f4c39c9d929896c3cd9120032f` |
| `docs/research/adeu-mcp-first-party-current-review-2026-08-14.md` | `b39571459d01c06a26670b5e7db0e107930d10c3eac6b4119834ba9f03cccf20` |

The generator requires both exact hashes, validates the base through `validateCatalog`, and performs structured semantic dedupe. It appends one Resource. Removing that final Resource deep-equals the frozen advertising base catalog.

## Exact composition

- Catalog schema: `3`
- Resources: `267`
- Targets: `813`
- Resource connections: `10`, deep-equal to the base
- Appended Resource: `adeu-mcp-server`
- Appended connection edges: `0`

## Resource facts and safety boundary

| Fact | Frozen value |
| --- | --- |
| Canonical identity | `ai.adeu/adeu@2.4.0` |
| Node package fact | `@adeu/mcp-server@2.4.0` |
| Publisher | Dealfluence Oy / Adeu |
| Source revision | `55f271eb7024d428e5a8f62819ff1376a138166c` |
| License | root MIT at the fixed revision |
| Risk | `unsafe` |
| Compatible hosts | Claude Desktop, Gemini CLI, Cursor, Windsurf |
| Explicitly absent host | VS Code; first-party evidence closed a Skill surface there, not an Adeu MCP host binding |

The displayed permissions cover reading local DOCX or an active Word document, sending agent-read text to the user's selected LLM provider, and writing batch edits, tables, comments, Track Changes, accepted or rejected revisions, metadata cleanup, and a read-only lock. A wrong target or destructive document action can lose data. The documented DOCX scope filters listings only and is not access control.

Cloud and email functions remain outside the verified local OSS boundary because their public source, authorization scope, credential lifecycle, and revoke behavior are not closed. The local-core no-account/no-API-key statement remains attributed to the publisher. AI Hub does not request, collect, store, proxy, validate, or forward Adeu, LLM, Cloud, or email credentials.

Every target is exactly `official + resource-link + website + empty installProfileId`. AI Hub only opens fixed first-party evidence. It does not download, install, configure, start, or run Node 22, Python 3.12, Word COM, an MCP server, or an extension. No command, args, env, headers, endpoint, token, secret, value, script, path, package, runtime, managed-install, or credential field is stored.

## Verified-successor ancestry repair

A later frozen candidate legitimately inherits the exact Adeu Resource. The old history scan rejected that successor as a historical duplicate. The repaired local seam now treats a JSON file as a successor only when its `inputs` path-and-SHA chain resolves through real files to this exact Adeu candidate and every hop has the claimed SHA. Cycles, unknown ancestors, forged paths, forged hashes, and unverified same-identity objects fail closed.

The exemption is narrow: within a verified successor's `catalog.resources`, only the single object that is `deepStrictEqual` to this frozen Adeu Resource is skipped. The remainder of the successor is scanned normally. A renamed or separately added object with the same canonical identity is still rejected, as is a second exact Adeu copy.

The real direct successor used by the retained test is:

| Successor | SHA-256 |
| --- | --- |
| `docs/research/agentic-news-affiliate-hermes-catalog-v3-candidate-2026-08-15.json` | `265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20` |

The Adeu candidate bytes did not change during this repair.

## TDD evidence

Initial candidate RED:

```text
node --test tests/adeu-mcp-catalog-v3-candidate.test.cjs
tests 1; pass 0; fail 1
AssertionError: Adeu MCP candidate must exist
```

The earlier explicit OAuth-boundary RED was also retained in the focused contract:

```text
tests 4; pass 3; fail 1
actual omitted: oauthInitiated: false
```

Verified-successor RED before the repair:

```text
node --test --test-name-pattern="history dedupe skips only a hash-verified exact inherited Adeu resource" tests/adeu-mcp-catalog-v3-candidate.test.cjs
tests 1; pass 0; fail 1
Error: historical semantic identity already exists: docs/research/adeu-mcp-catalog-v3-candidate-2026-08-14.json
```

Focused GREEN after the repair:

```text
node --test tests/adeu-mcp-catalog-v3-candidate.test.cjs
tests 5; pass 5; fail 0
```

Serialized limited joint GREEN, including the real successor, advertising ancestry, AWS, Brave, and the catalog-v3 public seam:

```text
node --test --test-concurrency=1 tests/adeu-mcp-catalog-v3-candidate.test.cjs tests/agentic-news-affiliate-hermes-catalog-v3-candidate.test.cjs tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs tests/aws-agents-build-skill-catalog-v3-candidate.test.cjs tests/brave-search-mcp-catalog-v3-candidate.test.cjs tests/catalog-v3-resource-connections.test.cjs
tests 32; pass 32; fail 0; duration_ms 56784.0505
```

The Adeu generator/test and the successor generator/test passed `node --check`.

## Frozen implementation bytes

| Path | SHA-256 before this handoff was finalized |
| --- | --- |
| `docs/research/adeu-mcp-catalog-v3-candidate-2026-08-14.json` | `1cc5da97e4a371a71c0e0118109156858c183e16f52159224768e20e8c6dea03` |
| `scripts/generate-adeu-mcp-catalog-v3-candidate.cjs` | `eed036ba255646261b5784c17b6ea7993ecb76cc3f205c4e6122f9697988a832` |
| `tests/adeu-mcp-catalog-v3-candidate.test.cjs` | `850b9f60fa576e318c270dbe610c6d4f9de51f3b1e3ebc4c402b54a966efd92f` |

The handoff SHA and the path-sorted four-file manifest SHA are computed only after all four files are frozen and are reported outside this self-referential document.

## Authority boundary

This is review evidence only. It has not entered an Admin draft, signed release, active catalog, state, release channel, package, or installed client. Shared worktree dirt outside the listed files is neither claimed nor modified.

