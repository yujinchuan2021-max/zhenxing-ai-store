# Official Skill seeds — bounded first-party sample (2026-08-14)

## Result

This candidate-only note closes a bounded, reproducible seed census for four
first-party surfaces: Hermes' two committed catalogs, Anthropic's Skills repo,
Microsoft's Skills site/repositories, and OpenAI's Plugins manifest. It records
**20 samples total (5 per source group)**. It is discovery evidence, not an
install, security review, compatibility claim, license opinion, or catalog
change.

The counts below are pinned to 40-character Git commits. No Skill, plugin, or
repository script was installed or executed. Public Git trees and committed
Markdown/JSON manifests were read only. ClawHub, Skills.sh, LobeHub, arbitrary
GitHub taps, and other federated results are not counted as Hermes official
content.

## Count summary

| Source group | Pinned authority | Reproducible count | Count unit and boundary |
|---|---|---:|---|
| Hermes bundled catalog | [`NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39`](https://github.com/NousResearch/hermes-agent/tree/423f92e607dd51908d23b04758bc0fcd6ec5ff39) | **79 catalog rows**; **81 source-tree Skills** | The committed [bundled catalog](https://github.com/NousResearch/hermes-agent/blob/423f92e607dd51908d23b04758bc0fcd6ec5ff39/website/docs/reference/skills-catalog.md) has 79 Skill rows. The same revision has 81 `skills/**/SKILL.md` files; the two not yet in the generated catalog are deferred below. |
| Hermes official optional catalog | same revision | **113 catalog rows**; **115 source-tree Skills** | The committed [optional catalog](https://github.com/NousResearch/hermes-agent/blob/423f92e607dd51908d23b04758bc0fcd6ec5ff39/website/docs/reference/optional-skills-catalog.md) has 113 Skill rows. The same revision has 115 `optional-skills/**/SKILL.md` files; the two not yet in the generated catalog are deferred below. |
| Anthropic Skills | [`anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c`](https://github.com/anthropics/skills/tree/f6656c1256d5a8adfa37db9110046ef20bac644c) | **17 Skills; 3 plugin bundles** | Exactly 17 `skills/<identity>/SKILL.md` files. `template/SKILL.md` is excluded. The [marketplace manifest](https://github.com/anthropics/skills/blob/f6656c1256d5a8adfa37db9110046ef20bac644c/.claude-plugin/marketplace.json) contains 3 bundles; bundles are not added to the Skill count. |
| Microsoft Skills site | [`microsoft/skills@f9c19ba07bf9bdfca6e3edf72319878d6111f59d`](https://github.com/microsoft/skills/tree/f9c19ba07bf9bdfca6e3edf72319878d6111f59d) | **174 site records / 174 unique names** | Exact length and unique-name count of the site's committed [`docs-site/src/data/skills.json`](https://github.com/microsoft/skills/blob/f9c19ba07bf9bdfca6e3edf72319878d6111f59d/docs-site/src/data/skills.json). This is the closed count for [microsoft.github.io/skills](https://microsoft.github.io/skills/). |
| MicrosoftDocs Azure Agent Skills | [`MicrosoftDocs/Agent-Skills@00be373fec26109c3087728188f6a45554c47617`](https://github.com/MicrosoftDocs/Agent-Skills/tree/00be373fec26109c3087728188f6a45554c47617) | **202 source-tree Skills** | Exactly 202 `skills/**/SKILL.md` files. This is a separate official collection from the site-backed `microsoft/skills` repository and must not be added to 174 as if both were one registry. |
| OpenAI Plugins default manifest | [`openai/plugins@11c74d6ba24d3a6d48f54a194cd00ef3beea18f9`](https://github.com/openai/plugins/tree/11c74d6ba24d3a6d48f54a194cd00ef3beea18f9) | **180 plugins; 72 Skill-bearing plugins; 607 `SKILL.md` files** | The default [`.agents/plugins/marketplace.json`](https://github.com/openai/plugins/blob/11c74d6ba24d3a6d48f54a194cd00ef3beea18f9/.agents/plugins/marketplace.json) has 180 unique plugin entries. At the same revision, 72 referenced plugin roots contain one or more Skills, totaling 607 `plugins/**/SKILL.md` files. These three units are not interchangeable. |

OpenAI's separate [API-key marketplace manifest](https://github.com/openai/plugins/blob/11c74d6ba24d3a6d48f54a194cd00ef3beea18f9/.agents/plugins/api_marketplace.json)
has 29 entries, all a subset of the default manifest's 180, so it is not added
to the default count. Official OpenAI documentation describes a plugin as a
package that can combine reusable Skills and external-service connections;
therefore a plugin count is not a Skill count ([Plugins overview](https://developers.openai.com/plugins)).

## Reproduction contract

From a read-only clone of each named repository, with `$ref` set to the full
commit above:

```powershell
$files = @(git ls-tree -r --name-only $ref)

# Hermes source trees
@($files | Where-Object { $_ -match '^skills/.+/SKILL\.md$' }).Count          # 81
@($files | Where-Object { $_ -match '^optional-skills/.+/SKILL\.md$' }).Count # 115

# Anthropic repo
@($files | Where-Object { $_ -match '^skills/[^/]+/SKILL\.md$' }).Count       # 17

# MicrosoftDocs repo
@($files | Where-Object { $_ -match '^skills/.+/SKILL\.md$' }).Count          # 202

# OpenAI repo
$skillFiles = @($files | Where-Object { $_ -match '^plugins/.+/SKILL\.md$' }) # 607
@($skillFiles | ForEach-Object { ($_ -split '/')[1] } | Sort-Object -Unique).Count # 72
```

For the committed JSON manifests, parse JSON and count arrays rather than
searching formatted text:

```powershell
# Microsoft site data at its pinned revision
$site = git show "${ref}:docs-site/src/data/skills.json" | ConvertFrom-Json
$site.Count                                                            # 174
@($site.name | Sort-Object -Unique).Count                               # 174

# OpenAI default marketplace at its pinned revision
$market = git show "${ref}:.agents/plugins/marketplace.json" | ConvertFrom-Json
$market.plugins.Count                                                  # 180
@($market.plugins.name | Sort-Object -Unique).Count                     # 180
```

Hermes catalog-row counts use only data rows: bundled rows begin with
``| [``` and contain the path column; optional rows begin with ``| [**``.
This yields 79 and 113 without counting table headers.

## Canonical identity and license boundary

The canonical seed key used here is:

```text
github.com/<owner>/<repository>@<40-character commit>:<Skill path>
```

For an OpenAI plugin sample, the plugin namespace and plugin-manifest version
are also recorded. A display name, marketplace slug, catalog rank, or copied
folder is not a canonical identity. A later commit at the same repo/path is
version drift on an existing logical resource, not a new resource.

- **Hermes:** repository/package version is `0.20.1` at the pinned revision;
  root license is MIT. Per-folder notices or embedded third-party attribution
  still take precedence. The official [Skills System](https://github.com/NousResearch/hermes-agent/blob/423f92e607dd51908d23b04758bc0fcd6ec5ff39/website/docs/user-guide/features/skills.md)
  describes ClawHub and other taps as external/community sources; their
  entries are excluded from both official counts.
- **Anthropic:** there is no root license that safely applies to every Skill.
  The pinned [README](https://github.com/anthropics/skills/blob/f6656c1256d5a8adfa37db9110046ef20bac644c/README.md)
  distinguishes open-source examples from source-available document Skills.
  At this revision 12 Skill folders carry Apache-2.0, `docx`, `pdf`, `pptx`,
  and `xlsx` carry proprietary/source-available terms, and
  `doc-coauthoring` has no same-folder license closure. License must be stored
  per Skill.
- **Microsoft:** `microsoft/skills` is MIT at its pinned site revision.
  `MicrosoftDocs/Agent-Skills` is dual-boundary: documentation/content is
  CC BY 4.0 (`LICENSE`) and code is MIT (`LICENSE-CODE`). The two repositories
  are separate canonical namespaces.
- **OpenAI:** `openai/plugins` has no observed root license and the marketplace
  manifest has no global license. Use each plugin manifest and each Skill's
  same-revision license file. OpenAI curation establishes catalog provenance,
  not blanket authorship, redistribution rights, runtime safety, or permission
  to call the plugin's external service.

## Samples (20 total)

### Hermes (5)

| Catalog | Canonical identity | Declared version | License boundary |
|---|---|---:|---|
| bundled | `github.com/NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39:skills/apple/apple-notes/SKILL.md` | 1.0.1 | MIT repo boundary; check folder notices |
| bundled | `github.com/NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39:skills/autonomous-ai-agents/codex/SKILL.md` | 1.0.1 | MIT repo boundary; external Codex use is a separate trust boundary |
| bundled | `github.com/NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39:skills/creative/excalidraw/SKILL.md` | 1.0.1 | MIT repo boundary; check folder notices |
| official optional | `github.com/NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39:optional-skills/blockchain/solana/SKILL.md` | 0.2.0 | MIT repo boundary; optional means inactive by default, not safer |
| official optional | `github.com/NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39:optional-skills/web-development/page-agent/SKILL.md` | 1.0.0 | MIT repo boundary; optional means inactive by default, not safer |

### Anthropic (5)

| Canonical identity | Plugin bundle | Per-Skill license |
|---|---|---|
| `github.com/anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c:skills/algorithmic-art/SKILL.md` | `example-skills@anthropic-agent-skills` | Apache-2.0 |
| `github.com/anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c:skills/claude-api/SKILL.md` | `claude-api@anthropic-agent-skills` | Apache-2.0 |
| `github.com/anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c:skills/skill-creator/SKILL.md` | `example-skills@anthropic-agent-skills` | Apache-2.0 |
| `github.com/anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c:skills/docx/SKILL.md` | `document-skills@anthropic-agent-skills` | Anthropic source-available/proprietary terms; not Apache-2.0 |
| `github.com/anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c:skills/xlsx/SKILL.md` | `document-skills@anthropic-agent-skills` | Anthropic source-available/proprietary terms; not Apache-2.0 |

The marketplace metadata is version `1.0.0`; no per-Skill release version is
declared for these samples, so commit plus path is the version authority.

### Microsoft site (5)

| Site identity | Canonical path at `microsoft/skills@f9c19ba07bf9bdfca6e3edf72319878d6111f59d` | License |
|---|---|---|
| `agent-framework-azure-ai-py` | `.github/plugins/azure-sdk-python/skills/agent-framework-azure-ai-py` | MIT root boundary |
| `airunway-aks-setup` | `.github/plugins/azure-skills/skills/airunway-aks-setup` | MIT root boundary |
| `appinsights-instrumentation` | `.github/plugins/azure-skills/skills/appinsights-instrumentation` | MIT root boundary |
| `applicationinsights-web-ts` | `.github/plugins/azure-sdk-typescript/skills/applicationinsights-web-ts` | MIT root boundary |
| `azure-ai` | `.github/plugins/azure-skills/skills/azure-ai` | MIT root boundary |

The site records have no per-Skill version or license fields; the pinned commit
and same-revision repository license are the closed boundary.

### OpenAI Plugins (5 Skill-bearing manifest samples)

| Plugin / Skill identity | Canonical Skill path at `openai/plugins@11c74d6ba24d3a6d48f54a194cd00ef3beea18f9` | Plugin version | License boundary |
|---|---|---:|---|
| `linear@openai-curated#linear` | `plugins/linear/skills/linear/SKILL.md` | 0.0.3 | Skill-local `LICENSE.txt` is Apache-2.0; do not replace it with plugin metadata |
| `atlassian-rovo@openai-curated#capture-tasks-from-meeting-notes` | `plugins/atlassian-rovo/skills/capture-tasks-from-meeting-notes/SKILL.md` | 1.0.3 | plugin manifest declares MIT; no repo-wide license |
| `atlassian-rovo@openai-curated#generate-status-report` | `plugins/atlassian-rovo/skills/generate-status-report/SKILL.md` | 1.0.3 | plugin manifest declares MIT; no repo-wide license |
| `atlassian-rovo@openai-curated#search-company-knowledge` | `plugins/atlassian-rovo/skills/search-company-knowledge/SKILL.md` | 1.0.3 | plugin manifest declares MIT; no repo-wide license |
| `atlassian-rovo@openai-curated#spec-to-backlog` | `plugins/atlassian-rovo/skills/spec-to-backlog/SKILL.md` | 1.0.3 | plugin manifest declares MIT; no repo-wide license |

## Read-only dedupe against the local active7 freeze

The comparison input was the locally frozen signed release
`admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json`,
SHA-256 `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4`.
It contains 120 Skill resources: 16 `official` and 104
`reviewed-community`. This is local active7 evidence, **not proof that active7
is the production-active catalog**.

Comparison used three independent lanes: exact `resource.id`, case-folded exact
display `name`, and normalized GitHub `owner/repo/path`. The last lane removes
`tree|blob/<commit>` and a terminal `SKILL.md`, but retains owner/repo/path.
The full pinned identity additionally retains the commit.

| Source group | Exact active ID | Exact active name | Same logical repo/path | Conclusion |
|---|---:|---:|---:|---|
| Hermes two catalogs | 0 item IDs | 0 of 196 source-tree item names | 0 item paths; **1 collection-level resource** (`hermes-agent-skills`) already points at `NousResearch/hermes-agent` | Do not add a second Hermes collection. Individual seeds remain unrepresented by canonical item path in active7. |
| Anthropic 17 | 0 raw IDs | **11** | **11** at active revision `f17010c9bb483898c1d9c9f42dde2b3a98889434` | These 11 are existing logical resources with version drift, not new resources. Six repo paths are absent, but still require license/security/host review. |
| Microsoft site 174 | 0 | 0 sampled; 0 source-repo matches | 0 | No duplicate established. This is not intake approval. |
| MicrosoftDocs 202 | 0 | 0 | 0 | No duplicate established. Keep separate from the site-backed `microsoft/skills` namespace. |
| OpenAI Plugins | 0 | 0 among the 5 samples; **1** across all 607 paths (`brainstorming`) | 0 under `openai/plugins` | The one name collision maps active7 to `obra/superpowers`, not `openai/plugins`; it is not counted as a canonical duplicate. Provenance comparison is deferred. |

The 11 Anthropic repo/path duplicates are:
`algorithmic-art`, `brand-guidelines`, `canvas-design`, `doc-coauthoring`,
`frontend-design`, `internal-comms`, `skill-creator`, `slack-gif-creator`,
`theme-factory`, `web-artifacts-builder`, and `webapp-testing`.

## Deferred gaps (fail closed)

1. **Hermes generated-catalog lag:** source tree adds
   `skills/autonomous-ai-agents/merge-reconciler`, `skills/devops/sdlc-review`,
   `optional-skills/software-development/ast-grep`, and
   `optional-skills/software-development/har-derived-api-client` beyond the
   two committed catalog pages. They are official-repo files but remain
   deferred from the catalog-row seed until the official generated catalogs
   catch up or the owner explicitly adopts tree enumeration.
2. **Microsoft count drift:** the live site-backed `microsoft/skills` payload
   closes 174, while the separately maintained `MicrosoftDocs/Agent-Skills`
   tree closes 202 and its manifest prose still says `193+`. Do not choose a
   single blended "Microsoft total" and do not silently treat the two repos as
   mirrors.
3. **Anthropic `doc-coauthoring`:** source is first-party but no same-folder
   license closure was found at the pinned revision. It remains link-only for
   any future intake.
4. **OpenAI third-party content lineage:** manifest inclusion is first-party
   curation, not proof OpenAI authored every Skill. The `brainstorming` name
   collision requires file/history comparison to the active
   `obra/superpowers` resource before any canonical merge.
5. No sample was inspected for scripts, binaries, network/filesystem writes,
   credentials, external APIs, platform behavior, or compatible host runtime.
   None is eligible for managed installation on this evidence alone.

## STOP boundary

This file is the sole intended workspace change. It did not modify active
catalog, state, channel, release, App, schema, package, server, or production
data; it did not install or execute any Skill; and it did not use private APIs,
login-gated content, or robots bypasses. Any intake, security review, license
adjudication, download, installation, publication, or production action
requires a separate authorization.
