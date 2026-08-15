# Official MCP Registry run3 final disposition — frozen handoff

## Outcome

The isolated run3 completion output is finished. Exactly 21,622 previously unreviewed publication identities now have one terminal audit disposition and one evidence-manifest record. The result is 0 `ready-link-only`, 21,622 `deferred`, 0 `blocked`, and 0 `duplicate`; `pending=0` and `candidateEligible=0`. No catalog successor is warranted by this ledger.

This is deliberately an evidence-closure result, not a claim that 21,622 publisher sites were visited. The only source row persisted for each identity is the already frozen Official MCP Registry index observation. No publisher URL, MCP endpoint, package, login, OAuth flow, or external service was called in this implementation slice. Manual-primary rows without new first-party evidence close honestly as deferred with the applicable publisher/repository/version/license/auth/revoke/retention/host/permissions/tools/risk gaps.

## Frozen contract and inputs

- Completion contract: `docs/research/official-mcp-registry-run3-full-review-completion-contract-2026-08-15.md`, SHA-256 `51ed5a17b048a280c7da80002a46998d235367f1890d8c9e8a3af258960a6085`, 39,770 bytes.
- `input-manifest.json` binds all 12 frozen inputs by exact repository-relative path, SHA-256, and byte length.
- The two primary-review tables yield exactly 20 distinct publication keys. Their raw UTF-8 `<publicationKey>\n` manifest is 523 bytes with SHA-256 `39341c46fa4fc1064f726dbcbe322f478976c382e9bf743e101f858309da7d20`.
- The full index and triage ledger each contain 21,698 unique joined identities; triage has 21,642 unreviewed rows; removing the 20 reviewed keys yields exactly 21,622 rows.
- Namespace-cluster facts are rejoined and reconciled against all 13,911 frozen clusters. The 15-file prior-evidence manifest, intake checkpoint/summary, triage summary, candidate, and handoffs are hash-bound before construction.
- Latest baseline remains the frozen 280-Resource Auralogs candidate, SHA-256 `dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8`.

## Terminal arithmetic and evidence boundary

| Measure | Exact result |
| --- | ---: |
| terminal rows / unique publication keys | 21,622 / 21,622 |
| lifecycle route | 246 |
| metadata-drift route | 332 |
| metadata-only-light route | 1,623 |
| manual-primary route | 19,421 |
| ready-link-only / deferred / blocked / duplicate | 0 / 21,622 / 0 / 0 |
| candidate eligible / pending | 0 / 0 |
| batches / maximum batch size | 20,147 / 10 |
| network requests / network stops | 0 / 0 |

The structured duplicate lane accepts only an exact Registry publication identity or the same stable server lineage already represented by one canonical Resource. Shared repository, subdomain, namespace, display name, transport, or purpose does not merge independent servers. No remaining row matched the current frozen canonical identity map, so all duplicate counters are zero.

Each evidence record cites only the frozen Registry list source, fixed observation time `2026-08-14T23:19:47.334Z`, index SHA, and the three bounded claims `registry-identity`, `registry-status`, and `registry-version`. Publisher-controlled primary facts that were not actually reviewed remain gaps. Ledger `publicEvidenceUrls` are empty, CompatibleHost IDs are empty, approved revisions are null, and no row claims execution, connection, installation, authentication, safety, or production acceptance.

## Deterministic build and checkpoint

The deep pure seam is `buildFinalDisposition(frozenInputs)`. It validates all frozen bytes, performs the one-to-one joins and exact arithmetic, constructs fixed-order objects in memory, and returns the seven canonical file buffers without I/O or a clock read. Two pure builds produce identical bytes.

Selection is ordered by frozen route priority, namespace, repository-stable-key signal, stable server key, and publication key using raw UTF-8 byte order. Work is grouped only by route + namespace + repository signal and split at ten identities. Every batch ID binds the input-manifest SHA, batch index, group facts, exact publication keys, and previous batch SHA. The virtual checkpoint chain is replayable from the batch plan plus canonical ledger/evidence records: intermediate checkpoint hashes use the deterministic batch-completion stream, while the final checkpoint binds the exact globally publication-sorted ledger and evidence file hashes. `lastPublicationKey`, final counts, batch index, and terminal row count all reconcile.

The thin generator uses a fixed exclusive writer lock and a random sibling staging directory. Each file is opened exclusively, written, and file-synced before a same-parent rename. Windows directory `fsync` may return `EPERM`; only that directory-level platform result is ignored after all file-level syncs. A failure removes only the allowlisted staging files. A completed rerun recomputes and verifies every byte and performs no rewrite; the focused test proves all seven mtimes remain unchanged.

The CTO P1 repair required one authorized full-directory refreeze because the writer promotes the seven-file set atomically. The six data outputs retained exactly the same bytes and hashes; their mtimes advanced once during that refreeze. Only `MANIFEST.sha256` changed content. The subsequent completed rerun was again byte- and mtime-zero-write.

## Pure reconciliation seam

`reconcile(previousSnapshot, currentSnapshot, approvedCatalog) -> reviewQueue` is pure and fail-closed. It accepts exact schemas only, rejects unknown fields and duplicate identities, validates every fact fingerprint and approved revision binding, never reads a clock or performs I/O, and proves its inputs were not mutated.

The focused fixture covers `added`, `changed`, `deprecated`, `deleted`, and `unchanged`; controlled changed-field ordering; table-driven P0 repository/publisher/endpoint conflicts and explicit deletion; P1 approved version/material/status drift; P2 unapproved additions and metadata drift; stop-recommending intent; stable Resource IDs; and approved-revision hashes. Absence from a rolling current snapshot throws and is never interpreted as deletion. Every approved stable server must exist in at least one of the previous/current snapshots; an approved orphan fails closed. Missing or mismatched approved revisions, incompatible schemas, unknown keys, and identity drift also fail closed. No reviewQueue result mutates catalog data or recommendation state.

## TDD and verification

1. Real RED: before implementation, `node --test tests/official-mcp-registry-run3-final-disposition.test.cjs` produced 0 pass / 1 fail with `final disposition module is missing`.
2. The first isolated write reached Windows directory `fsync` and failed with `EPERM`; no terminal directory was promoted. The exact seven-file staging directory was removed, directory sync handling was narrowed to Windows `EPERM`, and the next atomic run completed.
3. Independent CTO audit identified two P1s: MANIFEST lines were sorted after their SHA prefixes rather than by path, and an approved Resource absent from both snapshots could fall outside the diff union. The repair test first produced a real 5-pass / 2-fail RED: the exact path-array assertion showed the wrong order, and the approved-orphan assertion reported a missing exception.
4. Minimal GREEN sorts the six repository-relative paths before serializing hash lines and rejects every approved key absent from both snapshots. The corrected MANIFEST SHA is `d024f8056bbc2692041e0272be078e51233c1f1afe1fe0a5db5592b35e5a6fdd`, matching the independent audit's recomputation.
5. Final focused command: `node --test tests/official-mcp-registry-run3-final-disposition.test.cjs` — 7/7 PASS in 14.53 seconds.
6. Syntax checks: `node --check` for the shared module, generator, and focused test — PASS.
7. Focused coverage includes two pure byte-identical builds; exact frozen inputs and reviewed-key manifest; 21,622 ledger/evidence rows and fixed key order; route/terminal arithmetic; reason ordering; batch size and hash chain; exact path-ordered output MANIFEST; prohibited data scan; frozen-input drift; exact/lineage/shared-repository duplicate counterexamples; reconcile lifecycle/priority/mutation/absence/orphan/unknown-field negatives; independent approved repository/publisher/endpoint P0 cases; and completed-rerun mtime preservation.
8. Every frozen output is UTF-8 without BOM, LF-only with one final LF, and has zero trailing whitespace.

## Frozen output bytes

| Path | SHA-256 | Bytes | LF lines |
| --- | --- | ---: | ---: |
| `output/research/official-mcp-registry-run3-final-disposition/input-manifest.json` | `2041799168527b4f9dd8f95729e3561de7932e2b7f74c3436632c8b7edc80f4c` | 3,922 | 106 |
| `output/research/official-mcp-registry-run3-final-disposition/batch-plan.json` | `9428886e74e9886900324beaa6de0abef629ce707ddda9e8bdff6b5376cd880d` | 11,582,547 | 243,254 |
| `output/research/official-mcp-registry-run3-final-disposition/completion-ledger.ndjson` | `091b63dac17ad8b05b7658f2b7500655add3ad31745cc0dd303a40ae20c084a2` | 41,228,725 | 21,622 |
| `output/research/official-mcp-registry-run3-final-disposition/evidence-manifest.ndjson` | `6a9186865a22b35fd87b53f8d2a881d2eae78d3872a554392bcdd232b0471a67` | 32,654,494 | 21,622 |
| `output/research/official-mcp-registry-run3-final-disposition/checkpoint.json` | `c74ced22440bf2b7a41cac6e62a35ab8d306e3f1f0d362173c048f36fd0dc864` | 769 | 18 |
| `output/research/official-mcp-registry-run3-final-disposition/summary.json` | `4be11457e00e4f049bed719e1ff9c2d7075408663c25f1933290f12c2761ef14` | 1,654 | 66 |
| `output/research/official-mcp-registry-run3-final-disposition/MANIFEST.sha256` | `d024f8056bbc2692041e0272be078e51233c1f1afe1fe0a5db5592b35e5a6fdd` | 877 | 6 |

`MANIFEST.sha256` contains exactly the other six output paths, path-sorted as raw UTF-8 `<sha256><two spaces><repo-relative-path><LF>` records, and excludes itself.

## Implementation bytes before this handoff

| Path | SHA-256 | Bytes | LF lines |
| --- | --- | ---: | ---: |
| `shared/official-mcp-registry-final-disposition.cjs` | `9fc955ce1377dddf04e4156ad95d9862f359fdf57d3e31b9cecfe5f42d28d540` | 36,090 | 717 |
| `scripts/generate-official-mcp-registry-run3-final-disposition.cjs` | `1b7af684c5990e0a334f652ad88ebd9c18ac362945de32848d368f87608a81bf` | 4,125 | 112 |
| `tests/official-mcp-registry-run3-final-disposition.test.cjs` | `b6127a3a83089caf3ad8ed733d9a5de872aff7bb723fc8bd30f4ec24499af366` | 16,466 | 259 |

The handoff SHA is intentionally calculated and reported externally after this file freezes, avoiding self-reference.

## Protected boundary

This slice adds only the shared deep module, thin generator, focused test, this handoff, and the seven isolated research outputs. It does not modify any existing catalog/candidate, active state, channel, release, App, runtime schema, package, server, signing, publishing, installer, OAuth state, credential store, or MCP server. The active7 release remains at its frozen SHA, and the 280-Resource Auralogs baseline remains byte-identical. The shared worktree is dirty from concurrent work and is not claimed clean.
