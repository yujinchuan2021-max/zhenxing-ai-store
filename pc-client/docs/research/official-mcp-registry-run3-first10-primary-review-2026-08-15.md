# Official MCP Registry run3 first-10 primary-source review

Date: 2026-08-15 (Asia/Shanghai)

Status: `PRIMARY_REVIEW_COMPLETE / CANDIDATE_ONLY`

This is a bounded, first-party evidence review of exactly ten deterministic `unreviewed` identities from the run3 shortlist. It is not a catalog candidate, install profile, connection authorization, safety certification, signature, release, or publication authority.

## Conclusion

- Exact scope: **10 distinct Registry identities**.
- Verdict arithmetic: **4 `ready-link-only` + 5 `deferred` + 1 `blocked` + 0 `duplicate` = 10**.
- `ready-link-only`: `ai.anomalyarmor/armor-mcp@0.6.1`, `ai.borealhost/mcp@0.3.0`, `ai.chronary/mcp@1.5.2`, `ai.foura/mcp@0.6.0`.
- `deferred`: Autonomad, Bowmark, MarketIntell, Matih, and Naumu.
- `blocked`: DeinAI Creator Skill v2.
- Registry publication, namespace verification, package ownership, an official repository, or an official publisher claim does not elevate a row to AI Hub trust or establish that its tools are safe.
- Every item remains link-only research. No endpoint, package, OAuth flow, API, tool, billing action, booking, trade, browser action, hosting action, database query, or external write was invoked.

## Frozen local inputs and dedupe baseline

| Input | SHA-256 | Role |
| --- | --- | --- |
| `output/research/official-mcp-registry-intake-2026-08-15-run3/registry-index.ndjson` | `a0ac7fe2e126b7c65eb4b6ff700ea71a5fb95c17b2db57518d9fd1fb5606ba7a` | Discovery-only run3 metadata; the ten exact rows were stream-selected by `name@version` |
| `docs/research/official-unbound-mcp-d12-d16-catalog-v3-candidate-2026-08-15.json` | `3efc8e7e8f1e417d38982e630247c845da3d9f1876afa3cc5a997b5138929cba` | Latest local catalog baseline: 275 Resources, 845 targets, 10 resource connections |

The ten run3 rows are all `active`, `latest`, `candidateOnly=true`, `publishable=false`, `classification="discovery-only"`, and `reviewStatus="discovered-unreviewed"`. Those fields describe Registry observation only; this document supplies the separate first-party review verdict.

Structured local dedupe used Registry identity, package slug, normalized resource ID/name, publisher, external identity, canonical repository, and canonical service domain. The latest 275-resource v3 catalog produced zero hits. A read-only scan of 52 historical candidate JSON files and 184 research Markdown files also produced zero identity/repository/domain hits for these ten families. Manual cross-check found no renamed semantic equivalent. Therefore `duplicate=0`; a shared MCP protocol, shared host, or generic product category is not a duplicate signal.

## Summary ledger

| # | Exact Registry identity | Canonical source / version / license | Explicit existing CompatibleHost IDs | Risk | Verdict |
| ---: | --- | --- | --- | --- | --- |
| 1 | `ai.anomalyarmor/armor-mcp@0.6.1` | `anomalyarmor/agents:armor-mcp`; exact PyPI `0.6.1`; MIT | `claude-code`, `cursor-desktop`, `claude-desktop` | Warehouse metadata plus alert/rule/asset/metric/destination writes, deletes, paid jobs | `ready-link-only` |
| 2 | `ai.autonomad/travel@1.4.0` | Registry/npm `autonomad-travel@1.4.0`; linked repo unavailable; package license unclosed | none proven to an exact local product ID | Passport/traveler data, supplier sharing, binding bookings and charges | `deferred` |
| 3 | `ai.borealhost/mcp@0.3.0` | `alainsvrd/borealhost-mcp`; source `0.3.0`; proprietary service software | `cursor-desktop`, `windsurf-editor` | Hosting purchase, deployment, DNS/files/SSH/backups/domains, scaling, deletion | `ready-link-only` |
| 4 | `ai.bowmark/bowmark@8.48.1` | Registry `8.48.1`; public MCP bridges `2.1.0`; MIT bridge/skill | `claude-code`, `codex-cli`, `cursor-desktop`, `github-copilot` | Executes submitted JavaScript against live third-party sites; proxy/challenge subprocessors and retained run traces | `deferred` |
| 5 | `ai.chronary/mcp@1.5.2` | `Chronary/chronary-mcp`; exact `1.5.2`; Apache-2.0 | `claude-desktop`, `claude-code`, `cursor-desktop`, `microsoft-vscode`, `github-copilot`, `windsurf-editor` | Calendar/event/agent/webhook/iCal writes, cancellation, deletion and credential lifecycle | `ready-link-only` |
| 6 | `ai.deinai/creator-skill-v2@0.2.1` | PyPI `creator-skill-v2@0.2.1`; linked source unavailable; no public license | `claude-desktop`, `cursor-desktop` observed only in package prose | Separate account/token, wallet/recharge/payment ledger and external influencer search | `blocked` |
| 7 | `ai.foura/mcp@0.6.0` | `fouradata/mcp`; exact source `0.6.0`; MIT | `claude-desktop`, `claude-code`, `cursor-desktop`, `windsurf-editor`, `microsoft-vscode` | Open-world HTTP/proxy/browser access, cookies/headers, anti-bot and replayable payloads | `ready-link-only` |
| 8 | `ai.marketintell/marketintell@0.3.1` | Registry `0.3.1`; package reference `0.2.1`; source/license unclosed | `claude-desktop`, `cursor-desktop`, `openclaw-agent` | Broker/on-chain custody paths, live trade execution, financial loss and irreversible settlement | `deferred` |
| 9 | `ai.matih/mcp@0.2.1` | `matih-labs/matih-mcp`; exact `0.2.1`; Apache-2.0 | `claude-desktop`, `cursor-desktop` | SQL/data analysis, exports, file upload, dashboard/chart publication and optional LLM egress | `deferred` |
| 10 | `ai.naumu/mcp@0.12.0` | Registry/npm `0.12.0`; public docs repo is rolling and private monorepo holds implementation; MIT docs repo | `claude-code`, `cursor-desktop` | Reads and mutates team graphs, schema, nodes, edges, threads, notes, attachments and admissions | `deferred` |

## 1. AnomalyArmor — `ready-link-only`

**Identity and version.** The [exact PyPI 0.6.1 release](https://pypi.org/project/armor-mcp/0.6.1/) names AnomalyArmor as author, declares MIT, and carries trusted-publishing provenance from `anomalyarmor/agents` tag `v0.6.1` at commit `352e8dbc2c49aac1401edacd3d24758dc2b1f752`. This closes the Registry package, source path, fixed revision, publisher namespace, and license. The repository has since advanced, so this review does not substitute current `main` for the fixed 0.6.1 artifact.

**Auth, data and hosts.** First-party [MCP documentation](https://docs.anomalyarmor.ai/integrations/mcp-server) supports remote OAuth and local user-managed API-key access and explicitly names Claude Code and Cursor; the exact PyPI release also names Claude Desktop. First-party [FAQ](https://docs.anomalyarmor.ai/troubleshooting/faq) says the service reads system-catalog metadata and bounded aggregates rather than raw table rows and describes encrypted credentials. First-party [API authentication documentation](https://docs.anomalyarmor.ai/api/authentication) gives dashboard/CLI/API key revocation and says revocation is immediate and irreversible. The [data-retention policy](https://docs.anomalyarmor.ai/security/data-retention) keeps schema metadata for the account lifetime, schema-change and alert history for 90 days, audit logs for one year, and credentials until deletion; expired data is purged from primary systems within 30 days and account closure completes deletion within 30 days, subject to anonymized statistics and legally required billing records.

**Side effects.** The official tool list includes acknowledgement/resolution/dismissal of alerts; create/update/delete of rules, assets, schedules, metrics, validity checks, destinations and tags; schema discovery; and explicitly expensive intelligence jobs. This is `unsafe`/high-risk even though the package supplies MCP annotations.

**Ready boundary.** Fixed version, MIT license, publisher provenance, exact hosts, credential revocation and retention/deletion are closed for link-only review. Risk remains `unsafe`/high: a later candidate must not imply read-only behavior and must remain a Resource link with AI Hub `never-collect` for OAuth tokens, API keys, warehouse credentials and destination credentials. It does not authorize a connection edge, account access, tool invocation or managed install.

## 2. Autonomad — `deferred`

**Identity and operator.** Run3 binds `autonomad-travel@1.4.0` and points to `Autonomad1/autonomad1:packages/mcp-hotel-tools`; the linked repository was unavailable during review, so source, commit and package license could not be verified. Autonomad's [Terms](https://www.autonomad.ai/terms) and [Privacy Policy](https://www.autonomad.ai/privacy.html) identify the operator as Feel Good Hotels LLC, Texas.

**Auth, retention and side effects.** The service accepts signed agent mandates with spending limits. A principal can revoke future authority from account settings or support, but already executed bookings remain governed by supplier cancellation policy. The service handles traveler identity, passport, contact and booking data, shares what is needed with travel suppliers and processors, keeps chats 90 days and booking records seven years, and permits account/data deletion requests. It can research, book and manage flights, hotels, dining, ground transport and activities and can charge the principal within mandate limits. Those are high-risk, financially binding, sometimes irreversible actions.

**Hosts and verdict.** The first-party site markets Claude/ChatGPT use generically, but the reviewed materials do not bind this exact MCP publication to an exact existing AI Hub host product. Generic model branding is not an exact CompatibleHost proof. Missing source/license lineage and exact host evidence keep the row `deferred`.

## 3. BorealHost — `ready-link-only`

**Identity, publisher and license.** The official linked repository's [pyproject](https://raw.githubusercontent.com/alainsvrd/borealhost-mcp/main/pyproject.toml) is exact `borealhost-mcp` version `0.3.0`; its [README](https://github.com/alainsvrd/borealhost-mcp) links BorealHost.ai and states proprietary, all-rights-reserved licensing. The official [Terms](https://borealhost.ai/en/legal/conditions-utilisation/) identify BorealHost.ai as the Quebec service counterparty. This is a proprietary service/link boundary, not an open-source or managed-install license.

**Auth, revoke and retention.** The server uses scoped API keys; its tool surface includes key rotation and account deletion. The service offers self-service subscription cancellation. The [Privacy Policy](https://borealhost.ai/en/legal/confidentialite/) states account retention through the contract plus 30 days after deletion, billing records for seven years, logs and AI conversations for 90 days, a final backup for 30 days, in-memory-only inference content, and API billing metadata for 90 days. Payments are processed by Stripe.

**Hosts and side effects.** The official [BorealHost site](https://borealhost.ai/) explicitly names Cursor and Windsurf for its MCP server, mapping only to `cursor-desktop` and `windsurf-editor`. Its generic “Claude” wording is intentionally not mapped to a specific Claude product. The official surface can purchase and provision hosting, manage subscriptions and billing, deploy or decommission sites, write/delete DNS and files, handle SSH keys, restore snapshots/backups, register domains, scale resources and delete accounts. It is therefore `unsafe`/very high-risk.

**Ready boundary.** `ready-link-only` means only a resource card linking official repository, legal and tutorial pages. It does not authorize package execution, command/config storage, purchase, payment, credentials, managed install, or a connection edge. AI Hub must never collect API keys, login credentials, checkout material, SSH keys or payment data.

## 4. Bowmark — `deferred`

**Identity mismatch.** Registry identity is `ai.bowmark/bowmark@8.48.1`, while both public official bridge packages observed through the [PyPI 2.1.0 release](https://pypi.org/project/bowmark-mcp/2.1.0/) are `2.1.0`. That release names Bowmark AI, declares MIT, and describes the public MCP mirror/privately developed service. The Registry-linked [`bowmark-ai/skill`](https://github.com/bowmark-ai/skill) is an MIT Skill that calls the MCP service; it is not evidence that Registry version `8.48.1` equals bridge version `2.1.0`. A rolling hosted service may version independently, but no first-party mapping closed that relation.

**Auth, data and hosts.** Anonymous use is the default; an optional account/key raises limits. The [Privacy Policy](https://bowmark.ai/privacy) says linked assistant grants can be revoked immediately; account, request and run records persist while active and are deleted or de-identified within 90 days of a valid deletion/closure request; telemetry lasts up to 30 days and backups up to six months. It also discloses proxy, anti-bot challenge, storage, hosting, authentication and payment subprocessors. The official Skill explicitly names Claude Code, Codex, Cursor and GitHub Copilot.

**Side effects and verdict.** The service executes user-submitted JavaScript against live third-party websites, returns page data, and may traverse proxies or challenge-solving providers. Its official [Terms](https://bowmark.ai/terms) make the user responsible for target authorization and third-party rights. This is open-world, code-execution and external-data risk. Until Bowmark publishes an auditable `8.48.1` → rolling service/bridge/source mapping, the identity stays `deferred`, not merged with the Skill.

## 5. Chronary — `ready-link-only`

**Identity, publisher and license.** The official [`Chronary/chronary-mcp` package manifest](https://raw.githubusercontent.com/Chronary/chronary-mcp/main/package.json) binds `ai.chronary/mcp`, version `1.5.2`, author Chronary and Apache-2.0. Official [MCP tools documentation](https://docs.chronary.ai/mcp/tools-reference/) supplies the first-party service/tool boundary.

**Auth, revoke and retention.** Chronary uses organization and agent-scoped API keys. Its tool/reference surface supports scoped-key revocation; deleting an agent revokes its keys. The [audit-log policy](https://docs.chronary.ai/api-reference/audit-log/) retains entries for three days on Free, 90 days on Pro, or per contract on Custom. The [account endpoint](https://docs.chronary.ai/api-reference/account/) hard-deletes the organization and cascade-linked operational rows; terms-acceptance audit rows retain a null organization reference for six years, and deletion has no recovery path.

**Hosts and side effects.** Official setup names Claude Desktop, Claude Code, Cursor, VS Code Copilot, GitHub Copilot and Windsurf, mapping to the six exact local IDs in the ledger. Tools create/update/delete agents, calendars, events, webhooks and iCal objects; they also cancel/release events and expose scheduling/availability data. This is `unsafe`/high-risk.

**Ready boundary.** The closed package/license/auth/revoke/retention/host evidence supports a link-only Resource review. It does not authorize API-key collection, calendar access, account creation, event mutation, package execution, managed install, or a connection edge.

## 6. DeinAI Creator Skill v2 — `blocked`

**Observed package.** [PyPI 0.2.1](https://pypi.org/project/creator-skill-v2/0.2.1/) exists and names a standalone MCP/REST service with an independent account/session/API token, wallet/recharge/consumption ledger, payment checkout, audit administration and influencer-search tools. It names Cursor and Claude Desktop as stdio-bridge hosts. The release was uploaded by the PyPI maintainer account `Yin123` without trusted publishing.

**Blocking gaps.** The Registry-linked `deinai/skill-service` repository was unavailable, and PyPI exposes neither a source permalink/provenance attestation nor a license. The reviewed public DeinAI pages did not close a legal operator identity, publisher-to-service relationship, service terms, privacy/retention/deletion policy, or token revocation contract. A package title or brand domain cannot fill those gaps.

**Verdict.** Financial balance/recharge flows, user-managed credentials and external influencer data make the missing ownership/license/legal controls material. The row is `blocked`, even though the package prose names two hosts. Reconsideration requires a live first-party source revision, exact license, operator and publisher evidence, and auth/revoke/retention policies; AI Hub must never collect tokens or payment material.

## 7. FourA — `ready-link-only`

**Identity, publisher and license.** The official [`fouradata/mcp` package manifest](https://raw.githubusercontent.com/fouradata/mcp/main/package.json) binds `ai.foura/mcp`, `@fouradata/mcp`, version `0.6.0`, the FourA domain and MIT. The first-party [MCP guide](https://foura.ai/docs/mcp/server) still labels `0.5.0`; the source manifest is therefore the exact package-version authority for this review, while the guide is used only for rolling service, tools and host evidence.

**Auth, revoke and retention.** Users supply their own FourA API key. First-party [API-key documentation](https://foura.ai/docs/dashboard/api-keys) says disabling blocks requests within seconds, regeneration invalidates the prior secret immediately, and deletion stops authentication while preserving prior Activity/Metrics history. The [Activity Log](https://foura.ai/docs/dashboard/activity-log) retains request/response payload previews for 24 hours, capped at the last 200 per key; longer-lived metrics are aggregate. Account settings also permit immediate session revocation.

**Hosts and side effects.** The official MCP guide explicitly names Claude Desktop, Claude Code, Cursor, Windsurf and VS Code. Its four tools can issue open-world HTTP requests, route through rotating proxies, operate full browsers, carry cookies/headers/session material, bypass anti-bot challenges, replay stored requests and spend service credits. `readOnlyHint` describes intended API semantics, not a safety guarantee: non-GET requests and browser actions can create external side effects. Risk is `unsafe`/high.

**Ready boundary.** The exact source/package/license, credential revocation, 24-hour payload retention and exact host evidence support link-only review. It does not authorize invoking targets, bypassing controls, storing credentials/configuration, running packages, managed install, or creating a remote connection. AI Hub policy remains `never-collect` for keys, cookies, authorization headers, sessions and target credentials.

## 8. MarketIntell — `deferred`

**Identity gap.** Registry identity is `0.3.1`, but its normalized package reference is `marketintell@0.2.1`; the linked `ravidsrk/marketintell:apps/api` source was unavailable and no public source license was closed. The first-party [updates page](https://marketintell.ai/updates) describes a rolling `v0.3.0` service release, not an auditable mapping to Registry `0.3.1`.

**Auth, custody and side effects.** The official [service page](https://marketintell.ai/) describes revocable scoped broker/API access, hard position/loss/symbol limits, approval mode and a kill switch. It also says live-trading tools can place orders through OAuth brokers, an approved on-chain agent, or a dedicated Base wallet whose encrypted private key the service holds. Four `execute_*` tools can trade real money; advice can also affect financial decisions. This is `unsafe`/critical financial and custody risk.

**Hosts and verdict.** The official service explicitly names Claude Desktop, Cursor and OpenClaw. Public first-party material reviewed here did not close the exact `0.3.1` source/package lineage, license, legal operator, or service-wide retention/deletion policy. Those gaps keep it `deferred`; AI Hub must never collect broker credentials, API keys, wallet keys, payment data or trade approvals.

## 9. Matih — `deferred`

**Identity, publisher and license.** The official [`matih-labs/matih-mcp` manifest](https://raw.githubusercontent.com/matih-labs/matih-mcp/main/package.json) binds `ai.matih/mcp`, `@matihlabs/mcp`, version `0.2.1`, the Matih domain and Apache-2.0. The official [repository](https://github.com/matih-labs/matih-mcp) names Claude Desktop and Cursor and supports either a user-managed developer token or OAuth PKCE.

**Data and side effects.** The server can write SQL, inspect and profile data, run analyses, create charts, manage/publish dashboards and upload files. Its scopes are bounded by user-granted connections/capabilities; first-party documentation says third-party-LLM egress is gated by tenant data-processing consent. These are high data-access, write, publication and egress risks.

**Why deferred.** Source/version/license and two exact hosts are closed, but public first-party material reviewed here did not close developer-token revocation, OAuth grant revocation, service terms/legal operator, or query/content retention and deletion windows. Audit-log existence without a retention contract is insufficient. Those operational controls must be re-verified before a link-only Resource can be proposed.

## 10. Naumu — `deferred`

**Identity and source boundary.** The Registry/npm identity is `@naumu/mcp@0.12.0`. The official public [`naumu-ai/mcp` repository](https://github.com/naumu-ai/mcp) is an MIT docs/issues/releases home and explicitly says implementation development occurs in a separate Naumu monorepo. During review the public README still illustrated an older package version and exposed no fixed source/tag for `0.12.0`. The rolling remote service is first-party, but it does not prove the exact local package implementation.

**Operator, auth and retention.** Naumu's [Terms](https://naumu.ai/legal/terms-of-service) identify operator Harmonik Studio d.o.o., Croatia. Official [MCP documentation](https://naumu.ai/docs/local-mcp) supports browser OAuth for Claude Code and Cursor and immediate connected-tool revocation; separate user-managed API keys can also be revoked immediately in [Settings](https://naumu.ai/docs/settings). The [Privacy Policy](https://naumu.ai/legal/privacy-policy) states account deletion within 30 days, content retention while active, analytics up to 12 months, sessions to 365 days of inactivity, immediate connected-app data deletion on revoke and billing retention for 11 years.

**Side effects and verdict.** Connected tools act with the user's permissions and can read or mutate spaces, graphs, schema, nodes, edges, threads, notes, attachments and admissions; content may be processed by disclosed AI providers and connected applications. Risk is `unsafe`/high. Operator/auth/revoke/retention/host evidence is strong, but exact `0.12.0` implementation and license lineage is not independently fixed in the public repository. It therefore remains `deferred`, not silently converted to a rolling-service install claim.

## Cross-cutting candidate boundary

Any later candidate may consume only the four `ready-link-only` rows after rechecking source URLs and the latest catalog/history identities. Each target must remain `official` + `resource-link` + `website` + empty install profile. No row in this report authorizes a managed install, command, arguments, environment variables, headers, endpoint, token field, secret, runtime, package execution, authorization grant or `resourceConnection`.

AI Hub must never request, collect, store, proxy, validate or forward OAuth tokens, API keys, database credentials, browser cookies, session material, SSH keys, passports, broker credentials, wallet/private keys, payment details, mandates or checkout material. Publisher “official” means first-party provenance only; it does not mean safe, reviewed, endorsed or publishable by AI Hub.

## Research quality and exclusions

- Exactly the requested ten identities were reviewed; no adjacent Registry row or namespace was added.
- Verdicts use publisher-controlled repositories, package registries with publisher/provenance evidence, and publisher-controlled service/docs/legal pages. Registry metadata was used only to freeze identity and public pointers.
- No MCP endpoint/tool, private API, package download/install, OAuth/login, dashboard, payment, booking, trade, browser/proxy action or external write was invoked.
- No raw Registry response, remote endpoint, command/config snippet, token format, credential value, header value or private data was copied into this file.
- Unavailable repositories/pages and version drift were recorded as gaps; there was no login, bypass, retry loop or inference from a similarly named package.
- Only this Markdown was added. Candidate, catalog, active state, channel, release, App, schema, package and server files were not modified.
- File encoding/freeze quality and this document's SHA-256, bytes and line count are calculated after final write and reported externally to avoid a self-referential hash.
