# CocoLoop Community Skill next-batch frozen handoff

Status: **candidate-only, frozen, not publishable**. This handoff does not authorize a draft save, signature, release, publication, package, upload, download, installation, Agent binding, Workflow dependency, or execution.

## Read-only discovery result

- Current public origin: `https://hub.cocoloop.cn/`; robots allows public pages, forbids `/_next/` and `/api/`, and declares `https://hub.cocoloop.cn/sitemap-index.xml`.
- The public home page reported 172,378 Skills and rendered ranks 1–10 of its selected Top 50. No public pagination URL was exposed; this review did not call `/api/` or `/_next/`, so it records **10 observed**, not 50 completed: 2 candidate, 6 deferred, 1 blocked, 1 existing-blocked duplicate, and therefore 8 non-candidates.
- Observed ranks: tavily-search-pro, capability-evolver, agent-overflow, summarize, docker-sandbox, agent-browser, self-improvement, humanize-ai-text, postgres-job-queue, and wacli.
- Exact input catalog: signed local v2 active7 `catalog-v00000007-8c49e1972186-0cec5335`, 250 resources, 777 targets, 104 reviewed-community Skills. Historical de-duplication also includes `community-skill-store-index-re-review-2026-08-09.json`.

## Frozen ready set: 2

| resourceId | CocoLoop discovery | canonical identity | pinned first-party evidence | license | target |
| --- | --- | --- | --- | --- | --- |
| `openclaw-summarize-skill` | `https://hub.cocoloop.cn/skills/165` | `github:openclaw/openclaw#skills/summarize` | OpenClaw `skills/summarize/SKILL.md` at `6f99d3405cec1221c4fd9fa30f89795acc5f427d` | MIT at the same revision | `openclaw-agent`, link-only |
| `openclaw-wacli-skill` | `https://hub.cocoloop.cn/skills/7299` | `github:openclaw/openclaw#extensions/whatsapp/skills/wacli` | OpenClaw `extensions/whatsapp/skills/wacli/SKILL.md` at `6f99d3405cec1221c4fd9fa30f89795acc5f427d` | MIT at the same revision | `openclaw-agent`, link-only |

Both records preserve CocoLoop only as `metadataSnapshot.discoveredVia`; `sourcePlatform`, `canonicalSource`, author, revision, license, and provenance evidence come from the original OpenClaw repository. Both targets are `resource-link`, have empty `installProfileId`, and expose only `website`.

## De-duplication and exclusions

- Neither ready `resource.id` nor canonical key exists in active7 or the historical 100-item review ledger.
- `agent-browser` is not new: canonical key `github:vercel-labs/agent-browser#agent-browser` already exists in the older complete candidate and is explicitly `blocked` for dynamic browsing/runtime dependency. This review preserves that decision as `existing-blocked-duplicate`.
- capability-evolver resolved to an original repository, but autonomous self-modification and command/runtime behavior require separate content/lifecycle review, so it is blocked rather than promoted.
- The remaining six observed entries lack an exact first-party repository + Skill subpath + pinned revision + license closure or have ambiguous/runtime-sensitive identity. They remain deferred; no aggregator page was used as canonical evidence.

## TDD and focused evidence

1. Host migration RED: old helper returned `skill.cocoloop.com`; focused test was 4 pass / 1 fail.
2. Host migration GREEN: default origin changed to `hub.cocoloop.cn`, and CocoLoop `.com`/`.cn` links remain excluded as canonical candidates; 5/5 passed.
3. Sitemap boundary RED: helper admitted `skills-0.xml`, non-Skill shards, and `/about`; focused test was 3 pass / 2 fail.
4. Sitemap boundary GREEN: only exact `/sitemaps/skills-<positive>.xml` shards and exact `/skills/<nonempty-id>` pages are admitted; 5/5 passed.
5. Frozen candidate RED: focused test failed 0/1 because the candidate artifact did not exist.
6. Frozen candidate GREEN: 1/1 passed; it derives the exact discovery breakdown from the 10-entry ledger, verifies frozen flags, active7 plus historical-key de-duplication, pinned provenance/license fields, link-only targets, and an in-memory validated projection of 252 resources / 779 targets.
7. Independent-audit P1 RED: the combined focused run was 4/6 because the direct public URL gate still admitted `/about` and the frozen discovery summary did not expose ledger-derived exact categories.
8. Independent-audit P1 GREEN: the direct gate now admits only `/robots.txt`, `/sitemap-index.xml`, exact positive-number Skill shards, and exact Skill pages; `/about`, `/_next`, non-Skill shards, and `skills-0` fail closed. The combined focused run is 6/6.

## Boundary and next owner

No ZIP or source archive was downloaded; no third-party content was executed; `/api/` was not called; catalog/state/profile/release files were not changed; no saveDraft, sign, publish, package, upload, or server action occurred. A CTO read-only audit must review this frozen handoff before any backend consumption. If more entries are wanted, the next bounded review should start with additional public SSR pages or a separately authorized public-page discovery method and keep the same first-party closure and historical-ledger de-duplication gates.
