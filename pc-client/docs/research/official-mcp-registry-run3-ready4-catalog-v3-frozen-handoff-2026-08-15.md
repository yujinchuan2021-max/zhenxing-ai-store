# Official MCP Registry run3 ready4 catalog v3 candidate — frozen handoff

## Outcome

Run3 completed a rolling public metadata enumeration of 21,698 unique latest Registry identities. The local triage then separated 4 exact catalog identities, 12 source signals, 40 previously researched lineages, and 21,642 still-unreviewed rows.

This slice consumes only two frozen first-party reviews:

- The 12 source signals resolve to 11 `duplicate-lineage`, 0 `distinct-server`, and 1 `deferred`; they add no Resource.
- The deterministic first 10 unreviewed identities resolve to 4 `ready-link-only`, 5 `deferred`, 1 `blocked`, and 0 `duplicate`.

The candidate remains `candidateOnly=true`, `freezeOnly=true`, and `publishable=false`. It contains 375 vendors, 616 products, 279 Resources, 861 targets, and the same 10 resource connections as its base.

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `docs/research/official-unbound-mcp-d12-d16-catalog-v3-candidate-2026-08-15.json` | `3efc8e7e8f1e417d38982e630247c845da3d9f1876afa3cc5a997b5138929cba` |
| `docs/research/official-mcp-registry-run3-first10-primary-review-2026-08-15.md` | `b46d323dcecd3e3814da3fa4726bc6c32e5ed4db201aa156c14f8caeeb4c7125` |
| `docs/research/official-mcp-registry-run3-source-signals-review-2026-08-15.md` | `8f9d03ccb558a2b36740168e6807eb9c05bf64f50fb8057fc3408b15a243d419` |

## Four appended Resources

All 16 new targets are exact `official + resource-link + website + empty installProfileId + enabled`. None has `publisherVendorId` or `sourceProductIds`; no parent Product/Vendor fact was invented.

1. `anomalyarmor-mcp` — Registry `ai.anomalyarmor/armor-mcp@0.6.1`; MIT; `unsafe`; exact hosts `claude-code`, `cursor-desktop`, `claude-desktop`.
2. `borealhost-mcp` — Registry `ai.borealhost/mcp@0.3.0`; proprietary service/link boundary; `unsafe`; exact hosts `cursor-desktop`, `windsurf-editor`.
3. `chronary-mcp` — Registry `ai.chronary/mcp@1.5.2`; Apache-2.0; `unsafe`; exact hosts `claude-desktop`, `claude-code`, `cursor-desktop`, `microsoft-vscode`, `github-copilot`, `windsurf-editor`.
4. `foura-mcp` — Registry `ai.foura/mcp@0.6.0`; MIT; `unsafe`; exact hosts `claude-desktop`, `claude-code`, `cursor-desktop`, `windsurf-editor`, `microsoft-vscode`.

Each Resource is link-only and explicitly records high-risk side effects, publisher-side credential/revocation boundaries, and AI Hub `never-collect` behavior. The candidate contains no endpoint, command, arguments, environment variables, headers, credentials, token, secret, package execution, runtime configuration, managed install, OAuth initiation, or connection edge for these rows.

## Two provenance corrections

The source-signal review found two existing catalog facts that required correction without adding cards or widening execution:

- `godot-mcp`: publisher changed from `Godot Engine` to community author `tomyud1`; the unsupported `publisherVendorId=godot` and `sourceProductIds=[godot-engine]` relations were removed. Version/provenance now bind the fixed community `0.5.0` commit and MIT license. Existing targets and link-only modules are unchanged.
- `sentry-mcp`: the ambiguous “开源” description was removed. The candidate now says the source is publicly viewable and records the fixed package license as `FSL-1.1-ALv2`; existing publisher, products, targets and link-only modules are unchanged.

Removing the final four Resources and restoring those two Resource objects from the frozen base yields a catalog deeply equal to the 275-resource input. Vendors, products, the other 273 Resources, all prior targets, and all 10 resource connections do not drift.

## TDD and validation evidence

1. RED: the focused existence slice produced 0 pass / 1 fail with `candidate artifact is missing`.
2. The first generator attempt failed closed before writing a candidate because a metadata source revision used characters outside the existing snapshot schema. The revision was represented with the existing safe grammar; no schema change was made.
3. The first complete focused run produced 4 pass / 1 fail because the corrected Sentry description still contained the literal word “开源” inside a negation. The wording was reduced to “源码可公开查看；许可口径以 FSL-1.1-ALv2 为准”.
4. P1 mutation RED: a mutant that accepted only direct ancestry rejected a valid path-and-SHA-verified transitive successor as a historical semantic duplicate. The real generator then passed the focused 6/6 slice.
5. P1 mutation RED: removing only the `externalId` identity lane produced `Missing expected exception` for an isolated collision whose ID, normalized name+publisher, and canonical sources were all different.
6. Final focused result after both test-strengthening slices: 7/7 PASS in 4.37 seconds.
7. Limited joint result from the candidate freeze remains 30/30 PASS across this candidate, D12-D16, DeepSeek Harness, catalog-v3 resource connections, and the resource marketplace projection; it was not rerun for this test-only repair.
8. `validateCatalog` accepts the candidate; generator and test pass `node --check`.
9. The focused test runs the generator twice and reproduces the candidate with the same SHA-256.

The public seam is `buildCandidate(base, history)`. Current ID, normalized name+publisher, external identity, and canonical source collisions fail closed. A future candidate may inherit exactly one deep-equal copy of each new Resource only through a path-and-SHA-verified ancestry chain; renamed copies, additional copies, and forged SHA references remain rejected.

## Frozen implementation bytes

| File | SHA-256 |
| --- | --- |
| `docs/research/official-mcp-registry-run3-ready4-catalog-v3-candidate-2026-08-15.json` | `16116ca707a3dd344a252229758e359e3e4ba123fb6f4fbb8958166b689984e8` |
| `scripts/generate-official-mcp-registry-run3-ready4-catalog-v3-candidate.cjs` | `e36dbee8667bdae3ed73b8c4c0d2148886cfd2ebf382c718b3bd2a4092eec754` |
| `tests/official-mcp-registry-run3-ready4-catalog-v3-candidate.test.cjs` | `6d04a4547a5ba13f887c8974b42779c2daae0496003475d4f88ddd590cd49088` |

The four-file aggregate manifest is computed after this handoff freezes. Serialization is relative paths sorted ascending, each line exactly `<sha256><two spaces><path>\n`, UTF-8 without BOM.

## Protected boundary

Only the candidate JSON, generator, focused test, and this handoff belong to the implementation slice. No active catalog, state, channel, release, App, shared schema, package, server, signing, publishing, packaging, host configuration, OAuth state, credential store, or real MCP server was changed or invoked. The shared worktree remains dirty and is not claimed clean.
