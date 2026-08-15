# DeepSeek Harness Product catalog v3 candidate — frozen handoff

- Date: 2026-08-15
- Status: `candidateOnly=true`, `freezeOnly=true`, `publishable=false`
- Scope: one first-party, tutorial-only Product appended to the frozen 270-resource catalog-v3 candidate
- Excluded: active catalog/state/channel/release writes, signing, packaging, publishing, installation, runtime configuration, credential handling, network access, and execution of DeepSeek Harness

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `docs/research/agentic-news-affiliate-hermes-catalog-v3-candidate-2026-08-15.json` | `265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20` |
| `docs/research/deepseek-harness-first-party-evidence-2026-08-15.md` | `19e8e294bf3abfb11fc37e4fd338d331818ceb03316510e6ea23e16a8d8b6b6b` |

The generator requires both exact hashes and validates the complete base through `validateCatalog`. It appends one Product to the existing `deepseek` vendor and leaves every Resource and relationship byte-equivalent at the object level. Removing the appended Product deep-equals the complete base catalog.

## Exact Product composition

| Measure | Base | Candidate |
| --- | ---: | ---: |
| Vendors | 375 | 375 |
| Products | 615 | 616 |
| Resources | 270 | 270 |
| Resource targets | 821 | 821 |
| Resource connections | 10 | 10 |

The only appended object is Product `deepseek-harness`, under vendor `deepseek`, with order `3`, directory kind `ai-tool`, category `智能体`, kind `其他产品`, product type `tutorial`, module `tutorial-link`, empty install profile and requirements, `open-tutorial`, `none`, `not-applicable`, `not-managed`, and the sole capability `tutorial`.

Its website is the canonical first-party repository. Its only action is the fixed-commit README at revision `47f943859bef60e4160492346772ded9b24f765a`. The description identifies DeepSeek Harness as an official Developer Preview agent harness and states that it can read and write the workspace, run commands, and load plugins, Skills, an MCP client, and subagents. AI Hub only opens the fixed documentation: it does not clone, download, install, configure, launch, execute, or collect credentials.

`resolveProductBehavior` confirms `clientManagedInstall=false`, `canInstall=false`, no managed download/CLI/desktop behavior, and exactly one tutorial entry point. The Product contains no `sourceKind`, `risk`, `versionRef`, `agentTag`, `agentChannel`, download, official-download, entry-point, extension, or component-product field. No Skill, Plugin, MCP server, subagent, Resource, target, connection edge, CompatibleHost relationship, or managed profile is inferred from Harness capabilities.

## Identity and ancestry gates

The base scan rejects collisions by global Product ID, normalized Product name within vendor `deepseek`, and canonical GitHub owner/repository identity. Prose references do not count as Product identities.

A future frozen candidate may legitimately inherit this exact Product. The ancestry exemption applies only when every `{path, sha256}` hop resolves to supplied bytes and leads to this candidate at SHA `ff4bf6d15ae575d843c66d9b692c3343b981df47b8f94b8adc026c4b7a9580c7`. Inside a verified successor, only one Product object that is `deepStrictEqual` to the frozen Product is skipped. All other objects remain under semantic scanning. A second exact object, renamed same identity, forged path or hash, unknown ancestor, and cycle all fail closed. Direct and transitive valid successors pass.

## TDD evidence

Required missing-candidate RED:

```text
node --test tests/deepseek-harness-product-catalog-v3-candidate.test.cjs
tests 1; pass 0; fail 1
AssertionError: candidate must exist
```

Verified-successor RED before the history gate:

```text
node --test --test-name-pattern="history dedupe skips only one hash-verified inherited DeepSeek Harness Product" tests/deepseek-harness-product-catalog-v3-candidate.test.cjs
tests 1; pass 0; fail 1
AssertionError: Missing expected exception
```

Focused GREEN before final freeze:

```text
node --test tests/deepseek-harness-product-catalog-v3-candidate.test.cjs
tests 6; pass 6; fail 0; duration_ms 7078.4009
```

The focused suite locks the two input hashes, exact Product schema and values, 375/616/270/821/10 counts, `validateCatalog`, `resolveProductBehavior`, complete reversal to the base catalog, zero Resource/target/edge drift, current and historical semantic dedupe, narrow verified-successor ancestry, fail-closed malformed history, and byte-idempotence.

Limited public-contract regression GREEN:

```text
node --test --test-concurrency=1 tests/catalog-policy.test.cjs tests/catalog-v3-resource-connections.test.cjs
tests 21; pass 21; fail 0; duration_ms 3764.5475
```

Both the generator and focused test passed `node --check`.

## Authority boundary

This four-file artifact is review evidence only. It has not entered an Admin draft, signed release, active catalog, state, channel, package, server, or installed client. Existing worktree dirt outside the four listed files is neither claimed nor modified.
