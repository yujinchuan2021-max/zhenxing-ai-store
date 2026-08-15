# Official MCP Registry run3 next-10 primary-source review

Date: 2026-08-15 (Asia/Shanghai)

Status: `PRIMARY_REVIEW_COMPLETE / CANDIDATE_ONLY`

This is a bounded first-party evidence review of exactly ten deterministic, previously unreviewed Registry identities. It is not a catalog candidate, install profile, authorization, safety certification, signature, release, or publication authority.

## Conclusion

- Exact scope: **10 distinct Registry identities**.
- Verdict arithmetic: **1 `ready-link-only` + 8 `deferred` + 1 `blocked` + 0 `duplicate` = 10**.
- `ready-link-only`: `ai.auralogs/auralogs@0.1.0`.
- `deferred`: Aient, SpotDB, Ambix, Analytics Legends, Argus HQ, ARPI, Atlaso, and AutoRFP.
- `blocked`: SuperShopping.
- Registry publication, namespace ownership, repository ownership, or a publisher's “official” wording does not elevate an item to AI Hub trust or establish safety.
- No MCP endpoint/tool, package, OAuth flow, account, API, query, upload, AI diagnosis, checkout, external write, or destructive action was invoked.

## Deterministic selection and frozen inputs

The parent triage locked the selection rule before source review: `status=active` + `reviewStatus=discovered-unreviewed` + repository present + zero normalization warnings + one record in the namespace; exclude the already reviewed first 10, prior 40, source-signals 12, and the four exact catalog consumers; then sort by `registryId` and take the next 10. No unavailable or weak item was replaced.

| Input | SHA-256 | Role |
| --- | --- | --- |
| `output/research/official-mcp-registry-intake-2026-08-15-run3/registry-index.ndjson` | `a0ac7fe2e126b7c65eb4b6ff700ea71a5fb95c17b2db57518d9fd1fb5606ba7a` | Frozen run3 discovery identities and public pointers |
| `output/research/official-mcp-registry-triage-2026-08-15-run3/ledger.ndjson` | `e9c1ac9931bb97ca87826e726eaeaaa09a9705c1804982450c5cac125516757d` | Frozen reviewed/unreviewed state and deterministic cursor |
| `output/research/official-mcp-registry-triage-2026-08-15-run3/summary.json` | `7f3360d0008137161fae4f0abce50c01dae96737fbc6f56c14b29060bcc188e3` | Frozen run3 triage totals |
| `docs/research/official-mcp-registry-run3-ready4-catalog-v3-candidate-2026-08-15.json` | `16116ca707a3dd344a252229758e359e3e4ba123fb6f4fbb8958166b689984e8` | Latest local catalog baseline: 279 Resources, 861 targets, 10 resource connections |

Exact ordered identities:

1. `ai.aient/mcp@0.1.0`
2. `ai.aliengiraffe/spotdb@0.1.0`
3. `ai.ambix/ambix@0.1.0`
4. `ai.analyticslegends/sap-analytics@1.0.4`
5. `ai.argushq/enforcement-database@1.0.0`
6. `ai.arpi/arpi-mcp@1.0.0`
7. `ai.atdev/supershopping@1.0.0`
8. `ai.atlaso/mcp@1.0.1`
9. `ai.auralogs/auralogs@0.1.0`
10. `ai.autorfp/mcp@1.0.0`

## Structured dedupe

A read-only structured scan compared exact Registry identity, normalized ID/name, external identity, canonical repository, publisher/service domain, and semantic purpose against the latest 279-resource candidate plus 52 other `*candidate*.json` files (53 total). All ten produced zero catalog/history identity matches.

The compared-file set is independently reproducible from this workspace snapshot: recursively enumerate regular files under `docs/research/` whose basename matches case-insensitive `*candidate*.json`; convert each path to a repository-relative forward-slash path; sort ascending by raw UTF-8 path bytes; then serialize exactly `<relative-path>\n` per entry as UTF-8 without BOM, including the final LF. The resulting path-only manifest contains 53 unique paths (the latest candidate once plus 52 others), is 4,267 bytes, and has SHA-256 `b958037871332d82cf1114d3d56ff91adbcc8d032b51474a84954870caf66659`. File contents are not part of this path-manifest hash; the latest candidate's content SHA remains locked separately in the input table above.

Two Registry-side relationships were reviewed rather than hidden:

- `ai.argushq/enforcement-database` shares the multi-server repository `andrewjgaber-commits/empire-distribution` with `com.citationsafe/verifier`; their services and tool purposes differ, so repository reuse alone is not a duplicate.
- Deprecated `io.github.imashishkh21/atlaso@0.1.0a6` says it was superseded by `ai.atlaso/mcp` as the same remote service under the company namespace. The selected row is the canonical successor, not a second resource. Its stale source manifest is nevertheless a review gap discussed below.

Therefore `duplicate=0`. Similar MCP transport, compatible host, generic business category, or shared repository is not sufficient semantic identity.

## Summary ledger

| # | Exact Registry identity | Canonical source / exact-version boundary | License or service boundary | Explicit existing CompatibleHost IDs | Principal risk | Verdict |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `ai.aient/mcp@0.1.0` | Official hosted manifest is exact `0.1.0`; declared `haf/glimt` repository is unavailable | Hosted proprietary boundary; public source license and exact MCP grant-revocation contract unclosed | `claude-desktop`, `claude-code`, `cursor-desktop` | Production telemetry/code access, GitHub PR and remediation actions, key/environment writes, paid wallet route | `deferred` |
| 2 | `ai.aliengiraffe/spotdb@0.1.0` | Registry/OCI says `0.1.0`; current official manifest says `v1.3.0` | Current repository MIT; no fixed same-revision mapping to Registry `0.1.0` | `claude-code`, `claude-desktop` | Local/ephemeral database creation, file import, arbitrary queries, snapshot/export and deletion | `deferred` |
| 3 | `ai.ambix/ambix@0.1.0` | Registry exact row; declared repository unavailable | Hosted service; source/license and exact-version binding unclosed | `claude-code`, `cursor-desktop`, `codex-cli`, `microsoft-vscode` | Persistent shared product memory, cross-tool reads/writes and possible sensitive strategy content | `deferred` |
| 4 | `ai.analyticslegends/sap-analytics@1.0.4` | Registry `1.0.4`; current official manifests disagree (`1.0.2` and `1.80.0`) | MIT applies to repository material; served SAP data has separate rights/attribution limits | `claude-desktop`, `claude-code` | Subscriber key plus company/rate/news/study retrieval; tools represented as read-only | `deferred` |
| 5 | `ai.argushq/enforcement-database@1.0.0` | Registry exact row; declared repository unavailable | Hosted FDA-data service; MCP source/license and operator identity drift unclosed | `claude-desktop`, `cursor-desktop`, `windsurf-editor` | High-stakes regulatory search/summaries, paid watchlists and reliance on enforcement interpretations | `deferred` |
| 6 | `ai.arpi/arpi-mcp@1.0.0` | Official manifest is exact `1.0.0` | Repository has no closed same-revision license; hosted medical-service terms apply separately | `claude-desktop`, `claude-code` | ECG image upload, external AI diagnosis/report retrieval, health data and medical-decision risk | `deferred` |
| 7 | `ai.atdev/supershopping@1.0.0` | Registry exact row; declared repository unavailable | No public source/license, operator legal page, auth/revoke, or retention evidence closed | none proven | Product recommendation and potential shopping/referral actions with unknown data handling | `blocked` |
| 8 | `ai.atlaso/mcp@1.0.1` | Current source says `1.0.1` but still names deprecated `io.github.imashishkh21/atlaso` | Hosted proprietary service; current repository/source boundary does not bind the selected identity cleanly | `claude-desktop`, `claude-code`, `cursor-desktop`, `microsoft-vscode`, `codex-cli` | Persistent cross-tool memory, sensitive content egress, memory writes and destructive forget | `deferred` |
| 9 | `ai.auralogs/auralogs@0.1.0` | Official manifest is exact `0.1.0` | MIT repository metadata/client boundary; hosted log service remains governed separately | `claude-desktop`, `claude-code`, `cursor-desktop`, `cline-agent`, `codex-cli` | Read-only production logs and AI analyses can expose secrets, identifiers and incident/payment context | `ready-link-only` |
| 10 | `ai.autorfp/mcp@1.0.0` | Official manifest is exact `1.0.0` | MIT repository metadata; hosted service terms/privacy govern customer content | none proven to an exact local product ID | Read-only projects, requirements and content-library access; long-lived commercial/confidential content | `deferred` |

## 1. Aient — `deferred`

**Identity and publisher.** Aient's [publisher-controlled MCP manifest](https://aient.ai/.well-known/mcp/server.json) binds `ai.aient/mcp`, version `0.1.0`, remote transport, and the declared `haf/glimt` repository. The [official MCP page](https://aient.ai/integrations/mcp-server) describes Aient's hosted MCP service and explicitly names Claude Desktop, Claude Code, and Cursor. The service footer/security material identifies Triple Alpha AB as operator. The declared GitHub repository was unavailable during this review, so no same-revision source or license could be inspected.

**Auth, revoke and retention.** The official MCP page describes OAuth protected-resource discovery and separate read/write scopes. Aient's [security page](https://aient.ai/security) describes revocable GitHub-app access, EU-oriented storage with specified US remediation processing, per-run sandbox fetching/deletion, source-code deletion within 30 days after account termination, and longer operational telemetry handling. It does not close an exact user-facing MCP OAuth-grant revocation workflow or a redistributable source license.

**Side effects.** The write surface can acknowledge/mute/resolve production problems, request remediation, open reviewed GitHub pull requests, and manage keys/environments; the service also advertises a wallet-paid route. These are high-risk production, code, credential-adjacent, external-write and payment effects even when a human review gate exists.

**Verdict.** Exact hosted identity, publisher, hosts and substantial security/retention evidence are present, but unavailable source/license lineage and incomplete MCP grant-revocation/service-terms closure keep the row `deferred`. A future link-only review must describe a hosted proprietary service, not an open-source install, and AI Hub must never collect OAuth grants, repository credentials, environment secrets, keys, telemetry credentials or wallet/payment material.

## 2. SpotDB — `deferred`

**Identity and drift.** The Registry row and OCI pointer are `0.1.0`, while the official repository's current [`server.json`](https://raw.githubusercontent.com/aliengiraffe/spotdb/main/server.json) declares `v1.3.0`. The [official repository](https://github.com/aliengiraffe/spotdb) is MIT and documents an ephemeral data sandbox, but current `main` cannot establish the exact source bytes or license state of the Registry's `0.1.0` container.

**Auth, retention and host.** Current first-party material describes local/stdio use, an optional user-managed API key, Claude Code and Claude Desktop. It does not provide an exact `0.1.0` source tag/commit, a same-revision OCI-to-source attestation, or a sufficiently precise key-revocation and retained-snapshot deletion contract. Only `claude-code` and `claude-desktop` are mapped; generic MCP compatibility is not used to infer additional hosts.

**Risk and verdict.** SpotDB can create local sandboxes, import files, execute queries, snapshot/export data, and delete state. Local data processing is not automatically safe. The material `0.1.0` → `v1.3.0` lineage gap keeps this `deferred`; a later review must bind the exact artifact without downloading or executing it.

## 3. Ambix — `deferred`

**Identity and service.** Registry metadata points to `ambix-ai/mcp`, but that repository was unavailable during review. Ambix's [developer page](https://ambix.ai/developers) and [first-party product explanation](https://ambix.ai/how-it-works) describe a shared product-strategy memory used by MCP-connected AI tools, explicitly name Claude Code, Cursor, Codex and VS Code, and say Ambix itself does not write Jira, Linear, or GitHub. This maps only to `claude-code`, `cursor-desktop`, `codex-cli` and `microsoft-vscode`. It does not prove the exact `0.1.0` source, publisher revision or license.

**Missing controls.** Ambix's [terms](https://ambix.ai/terms) and [privacy page](https://ambix.ai/privacy) describe OAuth 2.1, workspace-membership checks, EU-hosted persistent workspace data, deletion around 30 days and longer audit retention. They identify the controller only as “Ambix, Sweden” with an address still to be confirmed. Those rolling service controls do not bind an exact `0.1.0` source/license revision. The persistent shared-memory surface can still read and write confidential roadmaps, decisions and strategy even when it does not mutate external issue trackers.

**Verdict.** Repository, license, auth/revoke/retention and exact-host evidence remain material gaps, so the row is `deferred`. Product branding and generic Claude/Cursor-style compatibility are not host evidence.

## 4. Analytics Legends — `deferred`

**Identity/version conflict.** The [official repository](https://github.com/analyticslegends/analytics-legends-mcp) is publisher-controlled, but its current [`server.json`](https://raw.githubusercontent.com/analyticslegends/analytics-legends-mcp/main/server.json) says `1.0.2`, while its richer [`mcp.json`](https://raw.githubusercontent.com/analyticslegends/analytics-legends-mcp/main/mcp.json) says `1.80.0`; neither binds Registry `1.0.4`. The repository names Claude Desktop and Claude Code.

**License, auth and data boundary.** The official [NOTICE](https://raw.githubusercontent.com/analyticslegends/analytics-legends-mcp/main/NOTICE.md) limits MIT to repository manifest/documentation material and says served SAP-related data carries separate attribution/use limits. First-party metadata distinguishes public no-auth tools from subscriber-key tools and describes keys as hashed/revocable. The tool surface is represented as read-only, but public first-party retention/deletion details for account, key audit, query and served-content records were not closed.

**Verdict.** The exact-version contradiction alone is sufficient to keep the row `deferred`. A later review must resolve which publisher artifact or rolling service revision `1.0.4` denotes and must not apply the repository MIT license to third-party served data.

## 5. Argus HQ — `deferred`

**Identity and operator evidence.** The Registry-declared `andrewjgaber-commits/empire-distribution` repository was unavailable. The [publisher site](https://argushq.ai/) and [developer page](https://argushq.ai/developers) identify Argus HQ's public/no-auth FDA enforcement MCP, five read-only tools, source citations, AI-assisted summaries, watchlists and paid briefing features. The developer page explicitly names Claude Desktop, Cursor and Windsurf, mapping to `claude-desktop`, `cursor-desktop` and `windsurf-editor`. It does not bind an exact `1.0.0` source or software license.

**Auth, retention and risk.** The public MCP needs no auth, while paid account features are separate. Argus HQ's [terms](https://argushq.ai/legal/terms) and [privacy page](https://argushq.ai/legal/privacy) do not close an exact source/license mapping and use an operator name that drifts between Digital Empire Holdings LLC and Digital Empire LLC across publisher pages. Regulatory summaries, warning letters, recalls, approvals and inspection records are high-stakes informational inputs; official source citations and disclaimers do not eliminate interpretation risk.

**Verdict.** This remains `deferred`, not duplicate with CitationSafe merely because both Registry rows reuse a multi-server repository. Exact source/license, host, auth/revoke and retention evidence must be closed first.

## 6. ARPI — `deferred`

**Identity and publisher.** The official repository's [`server.json`](https://raw.githubusercontent.com/arpi-ai/arpi-mcp/main/server.json) binds `ai.arpi/arpi-mcp@1.0.0`; the [publisher repository](https://github.com/arpi-ai/arpi-mcp) identifies ARPI Inc., OAuth, Claude Desktop and Claude Code. No same-revision public license was closed, so the repository may not be treated as redistributable or managed-install software.

**Auth, revoke and retention.** The service uses OAuth and accepts ECG-image submission for AI analysis/report retrieval. ARPI's [official terms](https://www.arpi.ai/terms/terms-of-use/detail/223) describe a medical/health service, six-hour automatic report deletion, and limits on retention of patient/raw ECG data while allowing deidentified waveform and operational-log handling. The reviewed material did not provide a precise user-facing OAuth revocation/disconnect contract.

**Risk and verdict.** Uploading health images and receiving AI-generated diagnostic output creates sensitive-health-data and high-stakes medical-decision risk; a disclaimer does not make it safe. Exact version and two hosts are closed, but license and OAuth-revocation boundaries are not, so the row is `deferred`. AI Hub must never collect health data, OAuth tokens or account credentials.

## 7. SuperShopping — `blocked`

**Available evidence.** Registry metadata declares `ai.atdev/supershopping@1.0.0` and the `alex-hoyeol-choi/headless-commerce` repository, but that repository was unavailable during review. The Registry description alone says the service searches, compares and recommends shopping products; it is discovery metadata, not first-party operational evidence.

**Blocking gaps.** No live publisher-controlled repository/site, legal operator identity, source/version mapping, license, auth/revoke contract, retention/deletion policy, exact CompatibleHost, or bounded tool/side-effect description was closed. It was not possible to distinguish simple read-only product search from affiliate, cart, checkout, account or external-write behavior using first-party material.

**Verdict.** With no usable first-party control plane beyond a dead declared repository, this row is `blocked`, not merely assumed safe from its name. Reconsideration requires a publisher-controlled source or service site that closes identity, operator, license/service terms, host, auth/revoke, retention and side effects.

## 8. Atlaso — `deferred`

**Successor identity and manifest drift.** The [official repository](https://github.com/atlaso-labs/mcp) is publisher-controlled and its current [`server.json`](https://raw.githubusercontent.com/atlaso-labs/mcp/main/server.json) says version `1.0.1`, but it still names deprecated `io.github.imashishkh21/atlaso`, not selected `ai.atlaso/mcp`. The Registry explicitly marks the old row as superseded by the selected company-namespace row for the same remote server. That makes the selected row the successor rather than a duplicate, while the stale manifest prevents a clean source-to-identity binding.

**Auth, retention and hosts.** First-party setup names Claude Desktop, Claude Code, Cursor, VS Code, Codex and other tools, mapping only the five exact local IDs in the ledger. Atlaso uses OAuth 2.1. Its [privacy policy](https://www.atlaso.ai/privacy) identifies Atlaso Labs Inc., describes cloud memory plus a local mirror, device/token revocation, memory lasting for the account lifetime, and deletion within 30 days after account closure, with optional external-LLM processing.

**Side effects and verdict.** The service persists cross-tool memory and exposes both write (`remember`) and destructive delete (`forget`) behavior. Source identity drift is a fail-closed seam despite strong operator/auth/retention/host evidence, so the row is `deferred` until the publisher binds `ai.atlaso/mcp@1.0.1` in a fixed first-party manifest. AI Hub must never collect memory content, OAuth tokens or connected-account secrets.

## 9. Auralogs — `ready-link-only`

**Identity, publisher and license.** The official repository's [`server.json`](https://raw.githubusercontent.com/auralogs-ai/auralogs-mcp/main/server.json) binds `ai.auralogs/auralogs@0.1.0`. The [publisher repository](https://github.com/auralogs-ai/auralogs-mcp) declares MIT for the public MCP metadata/client material and links the Auralogs service. MIT does not extend to customer logs, hosted service code or third-party data.

**Auth, revoke, retention and hosts.** The first-party README/docs describe a project-scoped bearer read key that is hashed and can be revoked immediately and explicitly name Claude Desktop, Claude Code, Cursor, Cline and Codex. The [official service site](https://auralogs.ai/) publishes plan retention windows of 7, 30 or 90 days. These map only to `claude-desktop`, `claude-code`, `cursor-desktop`, `cline-agent`, and `codex-cli`; generic protocol compatibility is not used to add hosts.

**Side effects and risk.** The seven documented MCP tools are read-only search, inspection and analysis operations. Read-only is still `unsafe`/sensitive: production logs and AI analyses can contain user identifiers, stack traces, incident details, secrets, authorization fragments or payment-error context, and results leave the logging service for the connected assistant.

**Ready boundary.** Exact identity/version, publisher-controlled MIT repository, read-only tool boundary, immediate key revocation, plan retention and exact hosts close the minimum Resource-link evidence. This remains a narrow `ready-link-only` decision, not a trust or service-account approval: the reviewed [Privacy URL](https://auralogs.ai/privacy) and [Terms URL](https://auralogs.ai/terms) currently resolve to the product homepage rather than an effective contract, so legal-operator, account-deletion, backup, processor and hosted-model details remain an explicit pre-publication acceptance gap. Any later candidate must be only an official website/resource link with empty install profile and no connection edge. AI Hub must never collect log data, project read keys, authorization material, model keys or account credentials.

## 10. AutoRFP — `deferred`

**Identity, publisher and license.** The official repository's [`server.json`](https://raw.githubusercontent.com/AutoRFP/mcp/main/server.json) binds `ai.autorfp/mcp@1.0.0`; the [publisher repository](https://github.com/AutoRFP/mcp) declares MIT for the public metadata and describes a hosted, read-only MCP surface for projects, requirements, content-library material and tags.

**Auth, revoke and retention.** AutoRFP uses per-user OAuth read scopes. The [official connection guide](https://learn.autorfp.ai/en/articles/15029444-how-to-connect-to-ai-assistants-mcp-server) names Claude and ChatGPT organizational connection flows, but does not identify an exact existing local desktop/CLI product ID. The [privacy policy](https://autorfp.ai/legal/privacy) describes retention while an account is active and up to seven years after closure, deletion requests, and third-party AI request processing without training. The reviewed first-party material did not close a precise user-facing OAuth disconnect/revocation procedure.

**Risk and verdict.** The surface is represented as read-only, but it exposes potentially confidential proposals, customer requirements and reusable commercial content to a connected assistant and its processors. Exact version/license and retention are closed; exact host identity and OAuth revocation are not. The row therefore remains `deferred`, with no CompatibleHost inferred from generic Claude/ChatGPT organization branding.

## Cross-cutting candidate boundary

Only the one `ready-link-only` row may be considered by a later, separately tested candidate after source URLs, the stated pre-publication legal gaps, and catalog/history identities are rechecked. It is not automatically reviewed or publishable. Any target must remain `official` + `resource-link` + `website` + empty install profile. This report authorizes no managed install, executable command, arguments, environment, headers, endpoint field, token field, package/runtime field, credential storage, authorization grant or `resourceConnection`.

AI Hub must never request, collect, store, proxy, validate or forward OAuth tokens, API keys, bearer keys, repository credentials, production telemetry/log credentials, ECG/health data, memory content, database files, browser/session material, wallet keys, payment material, or customer commercial content. Publisher “official” means first-party provenance only; it does not mean safe, reviewed, endorsed, installable or publishable by AI Hub.

## Research quality and exclusions

- Exactly the locked ten identities were reviewed; no adjacent Registry row or namespace was added or substituted.
- Verdicts use publisher-controlled repositories, manifests, service/docs/security/legal pages and fixed Registry identity metadata. Search was used only to locate possible first-party pages; a verdict was not based on search snippets, third-party directories or copied Registry prose.
- Repositories/pages that were unavailable and version/identity drift were recorded as gaps. There was no login, access-control bypass, retry loop, package download, install, execution, endpoint invocation or private API call.
- The dedupe scan was structural; incidental prose substrings were not treated as catalog identity.
- No endpoint value, command/config snippet, token format, credential/header value, raw Registry response or private data was copied into this document.
- This report does not inherit an open-source license from a metadata repository to a hosted service, served dataset, external dependency or customer content.
- Only this Markdown was added. Candidate, catalog, active state, channel, release, App, schema, package, server, tests and scripts were not modified.
- File encoding/freeze quality and this document's SHA-256, byte count and LF line count are calculated after final write and reported externally, avoiding a self-referential hash.
