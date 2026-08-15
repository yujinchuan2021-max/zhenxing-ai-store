# D12-D16 official MCP catalog v3 candidate — frozen handoff

## Outcome

This candidate-only slice converts the five previously explicit `unbound` MCP families D12-D16 into five canonical, link-only Resources after publisher-controlled documentation named exact catalog hosts.

- Candidate: `candidateOnly=true`, `freezeOnly=true`, `publishable=false`
- Result: 375 vendors / 616 products / 275 Resources / 845 targets / 10 resource connections
- Delta: 5 Resources / 24 targets / 0 products / 0 vendors / 0 resource connections
- No endpoint, command, args, env, headers, credentials, runtime configuration, install package, managed install, OAuth flow, connection state, signature, release, or publication was created.

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `docs/research/deepseek-harness-product-catalog-v3-candidate-2026-08-15.json` | `ff4bf6d15ae575d843c66d9b692c3343b981df47b8f94b8adc026c4b7a9580c7` |
| `docs/research/official-unbound-mcp-host-evidence-d12-d16-2026-08-15.md` | `df5225c2ffba72597c703073ccb5372d776ca7e01376871917ddbaa04200ecdf` |

## Exact Resources

1. `pagerduty-official-mcp` — unsafe; exact hosts `claude-desktop`, `cursor-desktop`, `microsoft-vscode`.
2. `launchdarkly-official-mcp` — unsafe; exact hosts `claude-desktop`, `claude-code`, `cursor-desktop`, `microsoft-vscode`, `github-copilot`, `windsurf-editor`.
3. `snyk-studio-mcp` — unsafe; exact hosts `claude-code`, `codex-cli`, `cursor-desktop`, `gemini-cli`, `microsoft-vscode`, `github-copilot`, `windsurf-editor`.
4. `twilio-docs-mcp` — guarded; exact hosts `claude-desktop`, `claude-code`, `cursor-desktop`, `codex-cli`.
5. `square-official-mcp` — unsafe; exact hosts `claude-desktop`, `goose-desktop`, `cursor-desktop`, `windsurf-editor`.

Every target is exact-key `official + resource-link + website + empty installProfileId + enabled`. No `publisherVendorId` or `sourceProductIds` was invented for organizations without a closed current catalog fact. Publisher remains a flat Resource fact, not a parent navigation layer.

PagerDuty is explicitly rolling/link-only because its upstream manifests disagree. LaunchDarkly preserves hosted rolling plus local `v0.6.2`. Snyk preserves rolling CLI plus the reviewed `studio-mcp v1.15.3` snapshot and local execution/source-upload risk. Twilio preserves the current Public Beta, no-account/no-key, docs-only, no-API-execution boundary. Square preserves remote Beta plus local `0.1.2` and high-risk production merchant writes.

## TDD evidence

The public seams are the new generator's `buildCandidate(base, history)`, the existing `validateCatalog`, and reversal by removing the final five Resources.

1. RED: with only the focused existence test present, `node --test tests/official-unbound-mcp-d12-d16-catalog-v3-candidate.test.cjs` produced 0 pass / 1 fail with `candidate artifact is missing`.
2. The first generator run completed the artifact but exceeded the 30-second outer command gate because the initial semantic visitor recomputed URL identities for every expected Resource at every historical object. No process remained and the complete candidate parsed as 275/845/10.
3. The minimal GREEN caches each structured object's semantic identity once. It does not reduce the history file set or weaken fail-closed behavior. A real generator run then completed in 5.56 seconds and reproduced the candidate byte-for-byte.
4. The first full focused run was 3/4 because its current-duplicate fixture added a 271st base Resource and correctly hit the base-count guard before the semantic seam. The fixture was corrected to replace an unrelated equal-target-count Resource, preserving the frozen 270/821 base contract.
5. Final focused result: 4/4 PASS in 6.40 seconds.
6. Limited catalog/resource regression: 26/26 PASS in 6.96 seconds.

The history contract rejects current ID/name+publisher/canonical-source collisions, structured historical collisions, a second exact inherited object, renamed same-identity objects, forged path/hash, unknown ancestry, and cycles. It accepts prose-only mentions and direct or transitive successors only when every ancestry `{path, sha256}` resolves and exactly one deep-equal copy of each of the five frozen Resources is inherited.

## Verification

```text
node --check scripts/generate-official-unbound-mcp-d12-d16-catalog-v3-candidate.cjs
node --check tests/official-unbound-mcp-d12-d16-catalog-v3-candidate.test.cjs
node --test tests/official-unbound-mcp-d12-d16-catalog-v3-candidate.test.cjs
node --test tests/official-unbound-mcp-d12-d16-catalog-v3-candidate.test.cjs tests/catalog-v3-resource-connections.test.cjs tests/resource-marketplace-projection.test.cjs tests/resource-store.test.cjs tests/catalog-projections.test.cjs
```

`validateCatalog` passes. Removing the final five Resources yields a catalog deeply equal to the frozen DeepSeek base. Vendors, products, the previous 270 Resources, all previous 821 targets, and all 10 resource connections are unchanged.

## Frozen implementation bytes

| File | SHA-256 |
| --- | --- |
| `docs/research/official-unbound-mcp-d12-d16-catalog-v3-candidate-2026-08-15.json` | `3efc8e7e8f1e417d38982e630247c845da3d9f1876afa3cc5a997b5138929cba` |
| `scripts/generate-official-unbound-mcp-d12-d16-catalog-v3-candidate.cjs` | `7871b46d993bdc41b2abb51c098037f64abded5913f24c6bae64f30dda73a475` |
| `tests/official-unbound-mcp-d12-d16-catalog-v3-candidate.test.cjs` | `6292190e780b8bf36b27bab9e4549b5b54e8b7847b34855da19daf42ec8d22fa` |

The aggregate manifest is computed after this handoff freezes. Its serialization is relative paths sorted ascending, each line exactly `<sha256><two spaces><path>\n`, UTF-8 without BOM.

## Protected boundary

Only the candidate JSON, generator, focused test, and this handoff belong to the implementation slice. The research input and next10c research were already independently frozen. No active catalog, state, channel, release, App, shared schema, package, server, signing, publishing, packaging, host configuration, or real MCP service was changed or invoked. The shared worktree remains dirty and is not claimed clean.
