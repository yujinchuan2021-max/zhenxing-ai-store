# Official MCP Registry run3 completion and triage handoff

Date: 2026-08-15 (Asia/Shanghai)

Status: `ENUMERATION_PASS / TRIAGE_PASS / CANDIDATE_ONLY`

This handoff freezes one successful public metadata enumeration and a separate local disposition ledger. It does not authorize catalog mutation, installation, connection, signing, release, packaging, or publication.

## Public run outcome

The single authorized command `node scripts/official-mcp-registry-intake.mjs` completed without retry in 636.6 seconds.

- pages: 217
- records: 21,698
- unique Registry identities: 21,698
- unique canonical server names: 21,698
- active: 21,451
- deprecated: 247
- deleted: 0
- first 216 pages: exactly 100 records each
- final page: 98 records and null cursor
- non-final partial pages: 0
- raw response files: 0
- remaining process, owner lock, stop marker, temporary file, partial file, or reparse point: 0
- `fullEnumeration=true`; `snapshotIsolation=false`

The public preview API exposes cursor pagination but no snapshot token. This is therefore a complete rolling enumeration, not a transactional snapshot.

## Run3 frozen outputs

| Path | SHA-256 | Bytes |
|---|---|---:|
| `output/research/official-mcp-registry-intake-2026-08-15-run3/checkpoint.json` | `955910bb1b580e9cbe6b60487d2219b3ad08e7c962a09d1b17208b716255d634` | 60,760 |
| `output/research/official-mcp-registry-intake-2026-08-15-run3/registry-index.ndjson` | `a0ac7fe2e126b7c65eb4b6ff700ea71a5fb95c17b2db57518d9fd1fb5606ba7a` | 20,711,984 |
| `output/research/official-mcp-registry-intake-2026-08-15-run3/summary.json` | `f1891db11db3e4ef1afd139b776a9120bae6a359df751766c2f49e393b6eada0` | 498 |

The 217 path-ordered page entries have aggregate manifest SHA-256 `2560befb79b611319a05da58e1e8b80aa49266e677f51417397f087e4f4d19af`; their combined bytes are 27,734,877.

Normalization outcomes remained data-minimal:

- 5 records omitted unsafe or non-immutable package metadata
- 4 records omitted invalid descriptions
- 2 records omitted invalid schema URLs
- 323 records omitted non-HTTPS or invalid website URLs
- rejected values, remote URLs, headers, runtime arguments, environment values, credentials, tokens, endpoints, and publisher-provided metadata were not persisted

## Local full-ledger triage

The triage public seam is `buildOfficialRegistryTriage({ records, catalogResources, priorEvidence })`. It binds the run3 index to the latest 275-resource candidate and emits exactly one minimal disposition row per Registry identity.

Disposition arithmetic:

| Disposition | Count | Meaning |
|---|---:|---|
| `catalog-exact-identity` | 4 | Exact Registry `name@version` already represented by a catalog Resource |
| `catalog-same-server-lineage` | 0 | Same canonical Registry server, different observed version |
| `catalog-source-signal` | 12 | Shared repository/source signal only; not automatically a duplicate |
| `prior-research-observed` | 40 | Exact server lineage already appears in frozen local research evidence |
| `unreviewed` | 21,642 | Discovery-only; no review or publication claim |

Evidence lanes total exactly 21,698: catalog 4, source-collision 12, prior-research 40, repository 17,201, website 2,790, package-only 371, insufficient-evidence 1,280.

The 4 exact catalog identities are:

- `ai.adadvisor/mcp-server@1.0.1` -> `adadvisor-mcp-server`
- `ai.adramp/google-ads@1.0.3` -> `adramp-google-ads-mcp`
- `ai.agentic-news/mcp@1.0.0` -> `agentic-news-mcp`
- `ai.agenticaffiliate/affiliate-networks-mcp@0.19.0` -> `affiliate-networks-mcp`

The 12 source signals requiring identity reconciliation are:

- `ai.adeu/adeu@1.7.1` -> `adeu-mcp-server`
- `ai.smithery/brave@2.0.58` -> `brave-search-mcp-server`
- `io.github.ChromeDevTools/chrome-devtools-mcp@1.7.0` -> `google-chrome-devtools-mcp`
- `io.github.PagerDuty/pagerduty-mcp@0.2.1` -> `pagerduty-official-mcp`
- `io.github.PremierInc/azure-devops@v0.0.1` -> `microsoft-azure-devops-mcp`
- `io.github.brave/brave-search-mcp-server@2.1.0` -> `brave-search-mcp-server`
- `io.github.docling-project/docling-mcp@3.1.0` -> `docling-mcp`
- `io.github.getsentry/sentry-mcp@0.25.0` -> `sentry-mcp`
- `io.github.github/github-mcp-server@1.9.0` -> `github-copilot-mcp`
- `io.github.microsoft/playwright-mcp@0.0.79` -> `microsoft-playwright-mcp`
- `io.github.tomyud1/godot-mcp@0.5.0` -> `godot-mcp`
- `io.snyk/mcp@1.1304.2` -> `snyk-studio-mcp`

Shared source is deliberately only a signal because one repository may publish multiple independent servers.

## Cluster boundary

There are 13,911 distinct namespaces. Large namespaces are held for cluster-level review rather than treated as trusted bulk publishers. The largest observed clusters are:

- `io.github.pipeworx-io`: 1,312 records
- `io.github.CSOAI-ORG`: 306 records
- `ai.smithery`: 213 records
- `io.github.codespar`: 127 records
- `app.wishpool`: 125 records
- `io.github.cyanheads`: 125 records

Registry presence and namespace authentication do not establish safety, authorship of linked code, license, host compatibility, or AI Hub review status.

## Triage frozen bytes

| Path | SHA-256 | Bytes |
|---|---|---:|
| `scripts/official-mcp-registry-run3-triage.cjs` | `693a424345bfa52013be8debe278776d3220e65b1f0dfd5ac137f5a0c3c9e717` | 11,956 |
| `tests/official-mcp-registry-run3-triage.test.cjs` | `906f391998dbf1622612eccfa72a4a2b51f6f8e809be641ace6530539ae52e8a` | 3,373 |
| `output/research/official-mcp-registry-triage-2026-08-15-run3/ledger.ndjson` | `e9c1ac9931bb97ca87826e726eaeaaa09a9705c1804982450c5cac125516757d` | 5,445,085 |
| `output/research/official-mcp-registry-triage-2026-08-15-run3/namespace-clusters.json` | `ecd9cdc40858b429b2b90f7f8189b1f454549012fcbc51262b96d8f31f938466` | 2,225,485 |
| `output/research/official-mcp-registry-triage-2026-08-15-run3/prior-evidence.json` | `8f3bd80be42280f0110f194e2abc474a2f52c28d534ade8b6e9efe5a42b01a1b` | 6,360 |
| `output/research/official-mcp-registry-triage-2026-08-15-run3/summary.json` | `7f3360d0008137161fae4f0abce50c01dae96737fbc6f56c14b29060bcc188e3` | 1,729 |

The synthetic seam test first failed because the module did not exist, then passed 1/1. The real ledger passed an independent read-only validation of all 21,698 rows, 13,911 namespace clusters, input/output hashes, evidence manifests, exact key sets, uniqueness, and disposition arithmetic.

## Next gate

First-party review must be bounded and cluster-aware. Start with exact/source reconciliation and small, independently sourced namespaces; do not exhaustively visit 21,642 websites in one uncontrolled crawl. Only rows with publisher, source, license, authentication, revocation, side-effect, and exact host evidence may become link-only catalog candidates. Everything else remains discovery-only or deferred.
