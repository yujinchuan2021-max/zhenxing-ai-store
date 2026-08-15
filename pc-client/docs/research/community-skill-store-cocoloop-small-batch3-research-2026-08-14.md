# CocoLoop public Skill small-batch 3 research (active7)

## Decision

Five previously unreviewed public CocoLoop Skill pages were inspected. Only `weather` closes the required first-party source, exact pinned Skill body, same-revision license, and official OpenClaw CompatibleHost relation. It is proposed only as a guarded website link. Two entries are blocked and two deferred; no count was padded.

This is candidate-only research, not publication or execution authority.

## Public discovery boundary

- [`robots.txt`](https://hub.cocoloop.cn/robots.txt) allows the public site, disallows `/_next/` and `/api/`, and names the [`sitemap index`](https://hub.cocoloop.cn/sitemap-index.xml). Research used only those public files and `/skills/<id>` pages.
- CocoLoop supplied discovery identity only. Its descriptions, publisher labels, grades, downloads, and provenance claims were not promoted.
- No API, Next.js data path, login, ZIP, package, script, command, credential, install, save, sign, release, or publish operation was used.

## Reviewed pages

| Public page | Outcome | Primary-source closure |
| --- | --- | --- |
| [`weather`](https://hub.cocoloop.cn/skills/169) | candidate | OpenClaw's repository contains the exact [`SKILL.md`](https://github.com/openclaw/openclaw/blob/6f99d3405cec1221c4fd9fa30f89795acc5f427d/skills/weather/SKILL.md) and [MIT license](https://github.com/openclaw/openclaw/blob/6f99d3405cec1221c4fd9fa30f89795acc5f427d/LICENSE) at one fixed commit. The Skill is hosted inside OpenClaw's own `skills` tree, which closes the `openclaw-agent` CompatibleHost relation. It requires no credential, prefers web fetch, gives a bounded curl fallback, and warns that external weather output is untrusted content. |
| [`github`](https://hub.cocoloop.cn/skills/161) | blocked | The pinned first-party [`SKILL.md`](https://github.com/openclaw/openclaw/blob/6f99d3405cec1221c4fd9fa30f89795acc5f427d/skills/github/SKILL.md) requires `gh` authentication and includes repository, issue, pull-request, release, and CI write operations. Credential and mutation authority are outside this intake. |
| [`video-frames`](https://hub.cocoloop.cn/skills/193) | blocked | The pinned first-party [`SKILL.md`](https://github.com/openclaw/openclaw/blob/6f99d3405cec1221c4fd9fa30f89795acc5f427d/skills/video-frames/SKILL.md) requires ffmpeg and bundled scripts over local files. Executable acquisition, file permissions, and runtime behavior remain unreviewed. |
| [`multi-search-engine`](https://hub.cocoloop.cn/skills/173) | deferred | The public page does not identify an original-author repository with a fixed revision, exact Skill body, same-revision license, and official CompatibleHost evidence. |
| [`skill-vetter`](https://hub.cocoloop.cn/skills/182) | deferred | The aggregator's official claim is not enough: the claimed `skills/skill-vetter` path is absent at the checked OpenClaw revision, and no alternative first-party pinned source was closed. |

## Dedupe and catalog semantics

The test discovers applicable ledgers only from `docs/research` using the fixed basename rule `^community-skill-store-.*(?:candidate|review|index).*\.json$`, excludes this batch's candidate, and compares the discovered basenames with a seven-file manifest. This closes the previously omitted `community-skill-store-listing-batch1-canonical-merge-candidate-draft89-active6-2026-08-08.json` ledger without scanning unrelated JSON.

Active identity means only `resources[].id/name` and the resource canonical `metadataSnapshot.externalId`. Prior/history identity means explicit `cocoloopId`, `candidateId`, or `resourceId`; `canonicalKey`, `externalId`, or `canonicalSource`; adjacent names; and explicit `resource`/`proposedResource` IDs and names. IDs and canonicals are string-normalized; names use NFKC, trimmed/collapsed whitespace, and lowercase. The proposed resource ID, name, and canonical key are all rejected against both active7 and history. URL text, order values, and arbitrary numbers are excluded, with a negative control.

The proposal remains resource-first: `publisher` records the factual publisher only, `targets` records `openclaw-agent` as CompatibleHost, and no vendor parent is created. The target is exactly `resource-link` + empty install profile + `website` capability. No executable or managed-install field exists.

## Execution record limits

Historical raw RED execution evidence for the original candidate-creation cycle is unavailable. The earlier missing-candidate RED and GREEN counts are operator-reported only and are not independently reconstructed or promoted as persisted evidence.

The P1-repair RED timing, exit code, counts, and failure details are also operator-reported. No raw stdout/stderr artifact was persisted, so that earlier execution is unavailable for independent replay. The claimed TDD sequence is not publication-gate evidence.

The current frozen state runs `node --test --test-reporter=spec tests/community-skill-store-cocoloop-small-batch3-candidate.test.cjs` with exit `0` and 3 passed / 0 failed. That current result covers ledger discovery/manifest closure, proposed identity collision gates, and recursive forbidden-key rejection; it does not establish the earlier TDD sequence, runtime safety, installation, user acceptance, publication, or production state.
