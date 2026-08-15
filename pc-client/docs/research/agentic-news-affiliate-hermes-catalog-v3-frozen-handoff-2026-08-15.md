# Agentic News, Affiliate Networks, and Hermes catalog v3 candidate — frozen handoff

- Date: 2026-08-15
- Status: `candidateOnly=true`, `freezeOnly=true`, `publishable=false`
- Scope: three evidence-backed, link-only Resources over the frozen Adeu catalog-v3 candidate
- Excluded: ClawHub intake, Admin draft, active catalog/state/channel/release writes, signing, packaging, publishing, installation, runtime configuration, account login, OAuth initiation, credential handling, MCP or external API calls, and network access

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `docs/research/adeu-mcp-catalog-v3-candidate-2026-08-14.json` | `1cc5da97e4a371a71c0e0118109156858c183e16f52159224768e20e8c6dea03` |
| `docs/research/official-mcp-registry-next10b-first-party-review-2026-08-15.md` | `8b9db20e3085798950b00a5c44c1451b4e2a0581c69b6fd5cb36f91281ad09ff` |
| `docs/research/hermes-official-skill-seeds-next-batch-review-2026-08-15.md` | `f727bfe946a333ebe604abc24ba9862e2ccd4640ca2e83a562061ec85f5d2270` |

The generator requires all three exact hashes, validates the unchanged base with `validateCatalog`, performs structural semantic dedupe against the base and current JSON history, and appends exactly three Resources in the order below. Removing the last three Resources deep-equals the complete Adeu base catalog. Existing relationship rows are unchanged.

## Exact composition

| Measure | Base | Candidate |
| --- | ---: | ---: |
| Resources | 267 | 270 |
| Targets | 813 | 821 |
| Resource connections | 10 | 10 |

The appended Resources are:

1. `agentic-news-mcp` — Agentic News MCP, registry identity `ai.agentic-news/mcp@1.0.0`, publisher `Agentic News`, `service-terms`, risk `guarded`, hosts Claude Desktop, Cursor, VS Code, and Windsurf.
2. `affiliate-networks-mcp` — Affiliate Networks MCP `0.19.0`, publisher `Robert Berrisford`, signed release `v0.19.0` at revision `9248d42`, MIT, risk `unsafe`, hosts Claude Desktop, Claude Code, and Codex CLI. It is a community implementation and is not reclassified as an official integration of downstream affiliate networks.
3. `hermes-one-three-one-rule` — One-Three-One Rule Skill `1.0.0`, author `Willard Moore`, fixed Nous Research repository revision `642b735dbdbae4f01f5df0b9288d5f67a7e530f4`, MIT, risk `low`, and the sole host `nous-hermes-agent`.

No appended Resource has `publisherVendorId` or `sourceProductIds`; no publisher, product, or connection relationship is inferred. The ten pre-existing `resourceConnections` rows remain deep-equal to the Adeu base, and none references the three new IDs.

## Link-only and credential boundary

Every appended target is exactly `official + resource-link + website + empty installProfileId`. AI Hub opens only the reviewed first-party pages. It does not clone, download, install, configure, start, or execute a Skill, MCP server, setup flow, adapter, cache, command, or tool. It does not initiate OAuth, store a connection, or call an MCP or affiliate-network endpoint.

Agentic News account/API access and OAuth remain user-controlled at the publisher. Affiliate-network credentials remain user-controlled locally or in the publisher's optional hosted OAuth/vault flow. The Hermes Skill declares no account, API key, OAuth, token, command, network, or required state-write capability. AI Hub never requests, collects, stores, proxies, validates, or forwards any of these credentials.

The candidate recursively excludes command, args, env, headers, endpoint, token, secret, credential value, script, path, package, runtime, or managed-install fields. ClawHub data and the unrelated AWS resource are absent.

## Verified-successor ancestry gate

A future frozen candidate may legitimately inherit all three exact Resources. The original history scan treated such a successor as a duplicate. The repaired local seam accepts an ancestry edge only when the successor's exact `{path, sha256}` input resolves through the supplied history to this frozen candidate, whose bytes match `265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20`. Every transitive hop must resolve to real supplied bytes with its claimed hash; cycles, unknown ancestors, forged paths, and forged hashes fail closed.

The exemption applies only inside a verified successor's `catalog.resources` array. It skips each of the three frozen Resource objects exactly once by `deepStrictEqual` and still scans every other object and field. A renamed object with the same canonical identity and a second exact inherited object remain duplicates. The candidate JSON itself did not change during this repair.

## TDD evidence

Required missing-candidate RED:

```text
node --test tests/agentic-news-affiliate-hermes-catalog-v3-candidate.test.cjs
tests 1; pass 0; fail 1
AssertionError: candidate must exist
```

Verified-successor RED before the final history-gate repair:

```text
node --test --test-name-pattern="history dedupe skips only three hash-verified inherited resources" tests/agentic-news-affiliate-hermes-catalog-v3-candidate.test.cjs
tests 1; pass 0; fail 1
Error: historical semantic identity already exists: docs/research/agentic-news-affiliate-hermes-catalog-v3-candidate-2026-08-15.json
```

Focused GREEN:

```text
node --test tests/agentic-news-affiliate-hermes-catalog-v3-candidate.test.cjs
tests 5; pass 5; fail 0; duration_ms 60577.3931
```

The focused suite proves exact input hashes and objects, exact 270/821/10 totals, exact target sets, no new connection edges, public `validateCatalog` acceptance, recursive forbidden-field absence, reverse equivalence to the Adeu base, structured current/history semantic collision rejection, the narrow verified-successor exemption and all listed negative ancestry cases, and byte-idempotence.

Serialized limited joint GREEN, including the repaired Adeu successor-ancestry gate:

```text
node --test --test-concurrency=1 tests/adeu-mcp-catalog-v3-candidate.test.cjs tests/agentic-news-affiliate-hermes-catalog-v3-candidate.test.cjs tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs tests/aws-agents-build-skill-catalog-v3-candidate.test.cjs tests/brave-search-mcp-catalog-v3-candidate.test.cjs tests/catalog-v3-resource-connections.test.cjs
tests 32; pass 32; fail 0; duration_ms 56784.0505
```

That joint run preceded the final local ancestry change in this generator. Per the bounded final-repair instruction it was not repeated; the only post-repair execution was the complete five-test focused suite. The final generator and focused test both passed `node --check`.

## Frozen implementation bytes

| Path | SHA-256 before this handoff was finalized |
| --- | --- |
| `docs/research/agentic-news-affiliate-hermes-catalog-v3-candidate-2026-08-15.json` | `265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20` |
| `scripts/generate-agentic-news-affiliate-hermes-catalog-v3-candidate.cjs` | `7f8687d1bdab307bcb693f45c6107e7330099cbb60a1a79e7300207886f8ef31` |
| `tests/agentic-news-affiliate-hermes-catalog-v3-candidate.test.cjs` | `f90c8388eaacbbc33d68ab4e43987c4bcb1739c74b63cee87d9cb4479cff4cba` |

The handoff SHA and path-sorted four-file manifest SHA are computed after all four files are frozen and are reported outside this self-referential document.

## Authority boundary

This artifact is review evidence only. It has not entered an Admin draft, signed release, active catalog, state, release channel, package, or installed client. Shared worktree dirt outside the listed files is neither claimed nor modified.
