# CocoLoop public Skill small-batch 2 research (active7)

## Decision

This frozen research batch proposes **one guarded, link-only catalog addition**. Six previously unreviewed public CocoLoop Skill pages were inspected. `mcporter` closed the required chain of original repository, pinned 40-character revision, exact `SKILL.md` path, and license at that same revision; the other five remain non-candidates.

This is candidate-only research. It is not publishable, does not authorize installation or execution, and did not alter the active catalog or any catalog state.

## Boundaries

- Discovery stayed on the public `https://hub.cocoloop.cn/` surface described by its public `robots.txt`, sitemap index, and `/skills/<id>` pages.
- No `/api`, `/_next`, login, bypass, ZIP download, installer, third-party Skill script, service, package, save, sign, or publish path was used.
- CocoLoop is discovery evidence only. Its descriptions, publisher labels, security grades, license statements, and download artifacts are not treated as original-source provenance.
- Dedupe was performed against active7 (250 resources, 777 targets, 104 reviewed-community Skills), the preceding two-entry CocoLoop candidate, B1/B2/B3 frozen candidate ledgers, and the 100-entry historical re-review ledger.

## Reviewed pages

| Rank | Public page | Outcome | Closure decision |
| ---: | --- | --- | --- |
| 1 | [`mcporter`](https://hub.cocoloop.cn/skills/186) | candidate | OpenClaw's first-party repository contains [`skills/mcporter/SKILL.md`](https://github.com/openclaw/openclaw/blob/6f99d3405cec1221c4fd9fa30f89795acc5f427d/skills/mcporter/SKILL.md) and the [MIT license](https://github.com/openclaw/openclaw/blob/6f99d3405cec1221c4fd9fa30f89795acc5f427d/LICENSE) at the same pinned revision. The catalog proposal is a guarded website link only. |
| 2 | [`readwise-mcp`](https://hub.cocoloop.cn/skills/800) | deferred | The public page does not expose an original-author repository plus pinned Skill and license pair. Its OAuth/write-tool description is not sufficient provenance. |
| 3 | [`little-snitch`](https://hub.cocoloop.cn/skills/1734) | blocked | No original repository or same-revision license closure; the documented `sudo` and firewall mutations also require a separate macOS/platform safety review. |
| 4 | [`meeting-notes`](https://hub.cocoloop.cn/skills/4885) | deferred | The page claims MIT and Claude-contributor provenance but gives no pinned original repository evidence; those claims remain unpromoted. |
| 5 | [`qwen3-tts-instruct`](https://hub.cocoloop.cn/skills/4762) | blocked | No repository/license closure; setup scripts, Python, an API key, network service use, and generated files require an independent runtime review. |
| 6 | [`swissweather`](https://hub.cocoloop.cn/skills/1049) | deferred | Named public weather services do not establish ownership of the Skill. Original repo, fixed revision, exact Skill path, and license remain unresolved. |

## Candidate and test contract

`proposedChanges` contains exactly one resource. It is guarded and manually reviewed; its only target is `resource-link`, its install profile is empty, and its only capability is `website`. It carries no executable, managed-install, package, workflow, or agent-binding fields.

The focused test binds this artifact to active7 and verifies:

1. exact top-level/source/discovery schema and `candidateOnly=true`, `publishable=false`, `freezeOnly=true`;
2. exact discovery accounting: `6 = 1 candidate + 3 deferred + 2 blocked`, with five non-candidates;
3. no observed CocoLoop ID or normalized name appears in active resource identity fields or prior/history review identity fields;
4. projecting the single candidate through `validateCatalog` succeeds; and
5. stripping candidate IDs restores active7 byte-for-structure.

## Execution evidence integrity

Historical RED execution evidence is unavailable; it was not captured when this candidate was first prepared and is not reconstructed after the fact.

The first repair added the active-catalog collision gate. Its valid RED command was `node --test tests/community-skill-store-cocoloop-small-batch2-candidate.test.cjs`: 1 test failed and 1 passed because the missing `assertObservedNovelty` gate raised `ReferenceError` instead of the required `AssertionError`. After the minimal gate was added, the same command passed 2/2 tests. An earlier broad `assert.throws` attempt incorrectly accepted the `ReferenceError`; that false green is explicitly excluded from RED evidence.

The follow-up P1 repair replaced broad recursive string collection with semantic identity collection. Active7 contributes only `resources[].id/name`. Prior/history inputs contribute explicit review identity fields (`cocoloopId`, `candidateId`, `resourceId`, `canonicalKey`, `externalId`) plus the adjacent `name`, and explicit `resource` or `proposedResource` `id/name`. IDs are converted with `String`, trimmed, and lowercased; names are NFKC-normalized, trimmed, internal whitespace-collapsed, and lowercased. URLs, `order`, and unrelated numbers are not identities.

The first combined numeric RED run failed 1 of 3 tests at the prior numeric `cocoloopId`; because that assertion stopped the test, it is not evidence that the history branch executed. The test was therefore split and the exact old string-only numeric behavior was replayed before the final collector was restored. The valid split RED was 2 failed / 2 passed: both prior numeric `cocoloopId` and historical numeric `candidateId` reported `Missing expected exception (AssertionError)`. The final same focused command passed 4/4, including a negative control proving URL/order `999` does not collide with observed ID `999`.

The new evidence proves only that every observed CocoLoop ID and normalized name is rejected when found in those semantic active/prior/history identity fields. It does not retroactively prove the original preparation sequence, publication readiness, runtime safety, installation, user acceptance, or production state.

The candidate data remains unchanged and resource-first: `publisher` is descriptive provenance, while the single `targets` entry is the CompatibleHost relation. No vendor parent layer is proposed.

## Remaining work

Re-review only if a public Skill page or original author supplies a first-party repository URL. A future reviewer must then pin a concrete 40-character commit, verify the exact `SKILL.md` and repository license at that same commit, inspect the Skill contents for runtime/install behavior, and re-run active plus historical canonical-key dedupe. No such evidence exists in this frozen batch.
