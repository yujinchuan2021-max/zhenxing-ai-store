# Hermes official Skill seeds — next-batch review

Date: 2026-08-15 (Asia/Shanghai)

Status: research-only; not a candidate, not publishable, and not installation or execution authority

## Decision

- Fixed upstream: `NousResearch/hermes-agent@642b735dbdbae4f01f5df0b9288d5f67a7e530f4` (`main` observed through the public Git remote; commit timestamp `2026-08-14T10:58:57-07:00`).
- Reviewed: 10 deterministic, previously unsampled official-catalog entries: 5 bundled and 5 optional.
- Outcomes: `ready-link-only=1`, `blocked=9`, `deferred=0`, `duplicate=0`.
- The sole preliminary `ready-link-only` row is `one-three-one-rule`. It is still only a research finding: no resource, target, install profile, catalog entry, or release state was created.
- “Official” below means that Nous Research lists the path in its own pinned catalog. It does not mean AI Hub has endorsed the content, verified every external dependency, or granted execution, credential, filesystem, network, financial, or external-write authority.

## Frozen inputs and source boundary

| Input | SHA-256 / Git object | Use |
|---|---|---|
| `docs/research/comprehensive-skill-hubs-census-2026-08-14.md` | `6eec3f0bcb4cfcce04701b69e7dfda5fed8ee47ca677878d97c0af64fef9ea7c` | Canonical-identity, trust, license, and API boundary |
| `docs/research/official-skill-seeds-sample-2026-08-14.md` | `d6ec0cb0652701dc7a1ca75eea343a72025fce89c247bbacefdedd09bdf219a1` | Previous 20-row sample and exclusion set |
| `docs/research/official-skill-seeds-candidate-active7-2026-08-14.json` | `89b3ecb0f7b6ce35a30af807153fecbe9c72dcf6393f07c18a651fbe4d39637a` | Previous exact review-ledger boundary |
| `docs/research/official-skill-seeds-frozen-handoff-2026-08-14.md` | `daca060fe261ea5c8c72ba1e9c4c31a804cf860b6476312df2b0bf47d8edc998` | Prior freeze and protected-scope boundary |
| Active7 signed envelope | `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4` | 250-resource active identity set |
| `docs/research/adeu-mcp-catalog-v3-candidate-2026-08-14.json` | `1cc5da97e4a371a71c0e0118109156858c183e16f52159224768e20e8c6dea03` | Latest 267-resource candidate identity set |
| Hermes root `LICENSE` | Git blob `75410e73319c72cd3e991a501c5455eb78f38375` | Repository MIT boundary |
| Hermes `CONTRIBUTING.md` | Git blob `bb157cc8f83e1721e4f1917777afd8f95296e9cb` | Bundled/optional layout and `SKILL.md` host format |
| Bundled catalog | Git blob `419788352df6402d6326b6042f0b11320cbc0bda` | First-party bundled listing |
| Optional catalog | Git blob `44fd6c13797447d4560c800d732bec1a364ee30a` | First-party optional listing |

The pinned catalogs contain 80 bundled rows and 113 optional rows. The same commit tree contains 82 and 115 `SKILL.md` files respectively; the tree-only entries are bundled `merge-reconciler`, bundled `sdlc-review`, optional `ast-grep`, and optional `har-derived-api-client`. All 10 rows below are present in the published pinned catalogs, so this catalog lag does not affect the selection.

## Deterministic selection

The previous Hermes sample covered bundled `apple-notes`, `codex`, `excalidraw` and optional `solana`, `page-agent`; none is reused here. Selection was frozen before safety review:

1. Take the first five paths, in catalog order, from the bundled `research` category that were not in the previous sample.
2. From the optional catalog, take the first uncovered `communication` row, the first uncovered `data-science` row, and the first three uncovered `finance` rows, all in catalog order.
3. Do not replace a risky row with a safer-looking name. Safety affects the outcome, not sample membership.

This yields exactly: `arxiv`, `blogwatcher`, `competitor-news-monitor`, `grounded-citations`, `llm-wiki`, `one-three-one-rule`, `jupyter-notebook`, `3-statement-model`, `comps-analysis`, and `dcf-model`.

## Host, license, and deduplication rules

- Host evidence is only `nous-hermes-agent`. The pinned contribution guide says bundled Skills live under `skills/`, optional official Skills use the same `SKILL.md` structure under `optional-skills/`, and the two pinned catalogs list every selected path. A `platforms` declaration is OS compatibility metadata, not evidence for Claude, Codex, Cursor, or another host.
- Canonical version identity is `github.com/nousresearch/hermes-agent@642b735dbdbae4f01f5df0b9288d5f67a7e530f4:<directory>`. Deduplication also compared the revision-independent key `github.com/nousresearch/hermes-agent:<directory>`, normalized name, and prospective leaf identity.
- Active7 (250 resources) and the latest v3 candidate (267 resources) contain no matching leaf ID, name, or normalized Hermes path for any of the 10. A scan of all 91 JSON files directly under `docs/research/` found zero exact occurrences of the 10 names.
- Active7 and the 267-resource candidate do contain the family-level resource `hermes-agent-skills`. Consistent with the previous frozen 20-row review, a catalog-family landing page is not treated as a duplicate of a fixed leaf path. Any future leaf proposal would nevertheless have to preserve that relationship and avoid claiming the family resource as a separate publisher or safety endorsement.
- Plausible near matches were reviewed rather than collapsed by keywords: blog-writing Skills are not RSS monitoring; `Gemini Notebook` and Wolfram Notebook MCP resources are not a local interlinked-markdown wiki or a Jupyter live-kernel Skill; `Marketing Brief` is not the 1-3-1 decision protocol; no existing resource implements the three selected financial-model workflows. No semantic duplicate was found.
- The root MIT license covers the repository’s MIT material but does not automatically relicense third-party binaries, APIs, fetched papers/pages, market data, a cited gist, or external repositories. The three finance Skills declare `Apache-2.0` in their own pinned frontmatter and attribute Anthropic, which is recorded as a directory-scoped declaration; their selected directories contain no separate `LICENSE` or `NOTICE`, so this report does not claim a complete redistribution review of the upstream material.

## Result ledger

| # | Catalog | Name / version | Declared license | Outcome | Essential boundary |
|---:|---|---|---|---|---|
| 1 | bundled | `arxiv` `1.0.0` | MIT | `blocked` | Executes Python/curl and sends queries to arXiv and Semantic Scholar, including a documented POST workflow |
| 2 | bundled | `blogwatcher` `2.0.0` | MIT | `blocked` | Installs and executes an unpinned external CLI, writes a persistent SQLite database, and mutates feed state |
| 3 | bundled | `competitor-news-monitor` `0.1.0` | MIT | `blocked` | Writes watch state, creates a recurring cron job, performs network retrieval, and can deliver externally |
| 4 | bundled | `grounded-citations` `1.1.0` | MIT | `blocked` | Executes helper code and creates, replaces, resets, locks, and deletes local ledger/draft artifacts |
| 5 | bundled | `llm-wiki` `2.1.0` | MIT | `blocked` | Broad persistent filesystem mutation plus optional authenticated Obsidian sync and service setup |
| 6 | optional | `one-three-one-rule` `1.0.0` | MIT | `ready-link-only` | Pure decision-format guidance; no packaged script, reference, credential, network, or required state write |
| 7 | optional | `jupyter-notebook` `1.0.0` | MIT | `blocked` | Clones/installs external tools, starts a tokenless/XSRF-disabled server, and executes arbitrary code in a stateful kernel |
| 8 | optional | `3-statement-model` `1.0.0` | Apache-2.0 declaration | `blocked` | Writes financial workbooks, invokes Python/LibreOffice recalculation, and retrieves sensitive/high-stakes financial data |
| 9 | optional | `comps-analysis` `1.0.0` | Apache-2.0 declaration | `blocked` | Writes valuation workbooks, consumes external financial data, and references an absent packaged example |
| 10 | optional | `dcf-model` `1.0.0` | Apache-2.0 declaration | `blocked` | Installs/runs Python dependencies, reads/writes financial files, recalculates workbooks, and may write validation JSON |

## Per-entry evidence

### 1. `arxiv` — blocked

- Canonical entry: [`skills/research/arxiv/SKILL.md`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/skills/research/arxiv/SKILL.md), Git blob `e3e6ac738f7b56344241a7ebff7dfc500d77b4c5`; helper [`scripts/search_arxiv.py`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/skills/research/arxiv/scripts/search_arxiv.py), blob `0bd6b2370f447acfba22979212e4800aa18795a7`.
- Metadata: `author: Hermes Agent`, `version: 1.0.0`, `license: MIT`, platforms Linux/macOS/Windows. Root MIT and the pinned file agree for the Skill package.
- Risk evidence: the essential workflow invokes `curl`, Python one-liners, and the helper script; it sends user queries and identifiers to arXiv and Semantic Scholar, fetches abstracts/PDFs, and documents a POST recommendation request. No API key is required for the documented basic path; the optional higher-rate API-key statement is not credential collection authority.
- Boundary: fetched papers, PDFs, API responses, and their terms are external data and are not covered by the Hermes MIT license. Because the previous intake’s passive-link gate grants no code or outbound-network authority, the row remains blocked despite its read-oriented purpose.

### 2. `blogwatcher` — blocked

- Canonical entry: [`skills/research/blogwatcher/SKILL.md`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/skills/research/blogwatcher/SKILL.md), blob `a1d52441e1943dc0684ca5e10483e7041528b06c`. No same-directory script or reference is packaged.
- Metadata: `author: JulienTant (fork of Hyaxia/blogwatcher)`, `version: 2.0.0`, `license: MIT`, and an external homepage. This proves the pinned Hermes declaration, not the license, integrity, or version of a downloaded `blogwatcher-cli` binary.
- Risk evidence: Go/Docker/binary installation instructions use moving `@latest` and `/releases/latest` targets; one path pipes a downloaded archive into `tar` under `/usr/local/bin`. Runtime behavior reads feeds/pages and OPML, writes a persistent SQLite database, imports subscriptions, and adds/removes/marks feed state.
- Boundary: the executable dependency is not fixed to a revision or artifact digest in this Skill. Independent executable, dependency-license, network, and state-mutation review would still be required; the known execution boundary makes this blocked rather than merely deferred.

### 3. `competitor-news-monitor` — blocked

- Canonical entry: [`skills/research/competitor-news-monitor/SKILL.md`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/skills/research/competitor-news-monitor/SKILL.md), blob `c480f2b18b33dea9ecfadd7734814fd3c0dd0c08`. No helper file is packaged.
- Metadata: `author: Ben Barclay (benbarclay), Hermes Agent`, `version: 0.1.0`, `license: MIT`.
- Risk evidence: the procedure calls `blogwatcher`, `web_search`, and `web_extract`; writes durable watch contracts and collected evidence under `~/.hermes/competitor-watches/`; creates a recurring `cronjob`; advances a cutoff; and may deliver a digest to a user-selected external destination.
- Boundary: it explicitly changes local state and scheduler state and performs repeated external retrieval/delivery. Those are essential, not optional examples, so a passive website link does not close them.

### 4. `grounded-citations` — blocked

- Canonical entry: [`skills/research/grounded-citations/SKILL.md`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/skills/research/grounded-citations/SKILL.md), blob `4c767369f4d97960925c7c2e73ffa192f95fe583`.
- Same-commit package review covered references `citation-formats.md` (`d83e270bf04cea88fe573615c4f1b9d264b6abf0`) and `grounding-rationale.md` (`7c25d6b29a4a2ebbe468db4cbc927cb204e1e930`), plus scripts `_hermes_home.py` (`45ed49d377353383d9b8aef110eea46c958e70da`) and `sources.py` (`9584b8d106ac0cf19ad65a63895fc6444717d9f8`).
- Metadata: `author: Hermes Agent + Teknium`, `version: 1.1.0`, `license: MIT`. The packaged code is stdlib-only and contains no network client; retrieval is delegated to configured tools.
- Risk evidence: the script creates citation directories, ledger JSON, temporary files, and lock files; `reset` replaces a ledger; stale-lock handling may unlink a lock; `render --replace-in` rewrites a user draft; evidence mode reads arbitrary user-selected files. The surrounding workflow also performs external retrieval.
- Boundary: all packaged files were readable at the fixed commit, but the essential local mutation and helper execution remain outside this passive-link intake.

### 5. `llm-wiki` — blocked

- Canonical entry: [`skills/research/llm-wiki/SKILL.md`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/skills/research/llm-wiki/SKILL.md), blob `a7a03d422b1308de6ffe596501ee4d03bdee42a7`. No same-directory helper or reference file is packaged.
- Metadata: `author: Hermes Agent`, `version: 2.1.0`, `license: MIT`.
- Risk evidence: initialization and ingestion create and update many Markdown files and raw assets; maintenance moves pages into an archive, removes index entries, updates backlinks, rotates logs, and can touch more than ten existing pages. The optional Obsidian path installs an external package, collects account email/password in a login command, connects a remote vault, enables continuous sync, writes a systemd unit, and invokes `sudo loginctl`.
- Boundary: the Skill cites Karpathy’s gist and an external wiki compiler; neither external source’s license or behavior inherits Hermes’ MIT license. The broad local mutation, optional credentials, and remote synchronization are sufficient to block this slice.

### 6. `one-three-one-rule` — ready-link-only

- Canonical entry: [`optional-skills/communication/one-three-one-rule/SKILL.md`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/optional-skills/communication/one-three-one-rule/SKILL.md), blob `032b2140a7340051668794198dd65dbe1c35c6d6`. It is listed in the pinned optional catalog and has no same-directory support files.
- Metadata: `author: Willard Moore`, `version: 1.0.0`, `license: MIT`, platforms Linux/macOS/Windows. The pinned file declaration and root license align.
- Risk evidence: the package is a prose-only response format: one problem, exactly three options, one recommendation, definition of done, and an implementation plan. It declares no command prerequisite, environment variable, account, network endpoint, helper, file path, or mandatory state mutation. A future implementation plan could propose actions, but those actions come from the user’s task and are not pre-authorized by this Skill.
- Dedupe/host: no leaf match in active7, the 267-resource candidate, or historical research JSON. The active `Marketing Brief` near match has a different canonical source and output contract. Compatibility is evidenced only for `nous-hermes-agent`.
- Readiness limit: “ready” means a future reviewer may construct a passive `resource-link`/`website` proposal with an empty install profile and no execution fields. This document does not create or approve that proposal.

### 7. `jupyter-notebook` — blocked

- Canonical entry: [`optional-skills/data-science/jupyter-notebook/SKILL.md`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/optional-skills/data-science/jupyter-notebook/SKILL.md), blob `de1d71493aa3cd9850252802861fb2aeab26173f`. No same-directory script is packaged.
- Metadata: `author: Hermes Agent`, `version: 1.0.0`, `license: MIT`.
- Risk evidence: setup clones `hamelsmu/hamelnb`, installs JupyterLab, creates notebooks, starts a background Jupyter server with token and password disabled, and recommends disabling XSRF checks. It then creates sessions through a local REST endpoint and executes arbitrary Python in a persistent kernel, including file and package operations.
- Boundary: neither the external hamelnb revision nor its license is pinned in the Skill, and Jupyter dependencies retain their own licenses. The intentionally unauthenticated execution service and arbitrary-code capability are a direct blocker.

### 8. `3-statement-model` — blocked

- Canonical entry: [`optional-skills/finance/3-statement-model/SKILL.md`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/optional-skills/finance/3-statement-model/SKILL.md), blob `525049b47fce4a19ee4f9cc269aec37f1636f7c8`.
- Same-commit references are present: `formatting.md` (`1fbe938c1623ea73c9707b15775f0f92e21c948f`), `formulas.md` (`db2645727e258a4543c13925dab3c0ced7d40d90`), and `sec-filings.md` (`e0fa48453a151a8d6770dda9c8b2ecede0fe363b`). The cross-skill `optional-skills/finance/excel-author` and its `scripts/recalc.py` also exist at this commit.
- Metadata: `author: Anthropic (adapted by Nous Research)`, `version: 1.0.0`, directory declaration `license: Apache-2.0`, with an upstream attribution link. No separate license/notice file appears in this selected directory.
- Risk evidence: the essential procedure reads and writes spreadsheet cells, formulas, named ranges, and model files; runs Python/openpyxl and LibreOffice recalculation; may retrieve SEC filings, company IR data, web results, or authenticated financial MCP data; and handles high-stakes financial inputs. It instructs staged human confirmation, but that does not remove execution, file-write, private-data, or financial-accuracy boundaries.
- Boundary: external filings/data and the attributed upstream material keep their own terms. The row is blocked under the passive-link gate.

### 9. `comps-analysis` — blocked

- Canonical entry: [`optional-skills/finance/comps-analysis/SKILL.md`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/optional-skills/finance/comps-analysis/SKILL.md), blob `66934034ab78d6d063eeb9ce3483e0f12792aaff`. It is the only file in the selected directory.
- Metadata: `author: Anthropic (adapted by Nous Research)`, `version: 1.0.0`, directory declaration `license: Apache-2.0`, with an upstream attribution link; no directory license/notice file is present.
- Package-integrity finding: the pinned Skill tells the reader to use `examples/comps_example.xlsx`, but that path does not exist in the fixed directory. This is a same-commit broken support-file reference, not a network observation.
- Risk evidence: the workflow creates and mutates valuation workbooks, formula cells, comments, and hyperlinks; uses openpyxl/recalculation; and consumes market, filings, Bloomberg, or financial-MCP data. It may process confidential company or user-provided figures and produces high-stakes investment analysis.
- Boundary: even if the missing example were repaired, execution, file-write, financial-data, and upstream-license review would remain; therefore this is blocked, not deferred on the example alone.

### 10. `dcf-model` — blocked

- Canonical entry: [`optional-skills/finance/dcf-model/SKILL.md`](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/optional-skills/finance/dcf-model/SKILL.md), blob `106b2dd1a7314bd578c536fac2175cbc0f11b49e`.
- Same-commit package: `TROUBLESHOOTING.md` (`eb46365ca1a4264a73cc5796b216faad4307a323`), `requirements.txt` (`0040dc4ada7b9ed59c3f588a75828417bce68332`), and executable `scripts/validate_dcf.py` (`876edde9f1f33e003b027678d563dc8590d6f024`).
- Metadata: `author: Anthropic (adapted by Nous Research)`, `version: 1.0.0`, directory declaration `license: Apache-2.0`, with an upstream attribution link; no directory license/notice file is present. `requirements.txt` names `openpyxl>=3.0.0` and `requests>=2.28.0`; their licenses are independent.
- Risk evidence: the workflow installs/runs Python dependencies, uses openpyxl, invokes LibreOffice recalculation, reads market/MCP/web/user data, writes DCF workbooks, and can run the validator on a user-selected file. The validator opens workbooks twice and optionally writes a JSON result. No credentials are declared in frontmatter, but configured financial MCPs or user-provided data may carry private/account scope that this Skill cannot authorize.
- Same-commit consistency finding: the Skill mandates exactly two sheets (`DCF`, `WACC`) with sensitivity grids on `DCF`, while `validate_dcf.py` treats `Sensitivity` as a recommended third sheet. That mismatch is currently a warning rather than a fail-closed validation rule, but it weakens the claimed verification path.
- Boundary: local execution/file mutation and high-stakes valuation behavior are essential, so the row is blocked regardless of the validator inconsistency.

## License and trust conclusions

1. The pinned repository, catalog row, and `SKILL.md` path are sufficient to call these ten entries Hermes official sources. They are not sufficient to call every named author, dependency, external service, retrieved dataset, or adapted upstream work Nous-authored or AI Hub-trusted.
2. For MIT rows, preserve both the repository license and the human author shown in frontmatter. Do not rewrite the publisher as “Hermes Agent” when the file credits JulienTant, Ben Barclay, Teknium, or Willard Moore.
3. For the three finance rows, preserve the pinned Apache-2.0 declaration and Anthropic/Nous adaptation attribution as a distinct directory boundary. Do not apply the root MIT label to those rows or to Anthropic’s upstream repository.
4. A future `one-three-one-rule` proposal, if separately authorized, must remain link-only: `moduleId=resource-link`, capability `website`, empty `installProfileId`, no command/args/env/headers/endpoint/token/secret/package/runtime fields, and no managed-install claim.
5. The nine blocked rows require a new, explicitly scoped runtime/security/license review; this document supplies no authority to install dependencies, execute scripts, collect credentials, start services, mutate files, schedule jobs, contact external APIs, or publish catalog changes.

## Primary sources

- [Pinned repository commit](https://github.com/NousResearch/hermes-agent/tree/642b735dbdbae4f01f5df0b9288d5f67a7e530f4)
- [Pinned bundled Skills catalog](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/website/docs/reference/skills-catalog.md)
- [Pinned optional Skills catalog](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/website/docs/reference/optional-skills-catalog.md)
- [Pinned `SKILL.md` format and bundled/optional policy](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/CONTRIBUTING.md#adding-a-skill)
- [Pinned repository MIT license](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/LICENSE)

## Explicit non-actions

No Skill was installed or executed. No private API, login, authenticated endpoint, or robots bypass was used. No candidate JSON, generator, test, active catalog, catalog state, channel, release, application, schema, package, or server file was changed.
