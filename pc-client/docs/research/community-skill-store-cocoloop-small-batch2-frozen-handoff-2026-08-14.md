# CocoLoop Skill small-batch 2 frozen handoff

Candidate-only handoff. No active catalog, state, channel, release, draft save, signature, publication, package, app, schema, or server path was changed.

Historical RED execution evidence is unavailable and was not recreated. The first active-catalog repair's valid RED was 1 fail / 1 pass and its GREEN was 2/2. The follow-up semantic-identity P1 repair first produced a combined 1 fail / 2 pass, but that failure stopped before the history assertion; it is not counted as history RED evidence. After splitting the cases and replaying the exact old string-only numeric behavior, the valid RED was 2 fail / 2 pass: prior numeric `cocoloopId` and historical numeric `candidateId` each missed the required `AssertionError`. The final same focused command passed 4/4.

The gate now collects only active `resources[].id/name` and explicit prior/history review identity fields (`cocoloopId`, `candidateId`, `resourceId`, `canonicalKey`, `externalId`, adjacent `name`, and explicit resource/proposedResource identity). IDs use `String` plus trim/lowercase; names use NFKC plus trim/whitespace-collapse/lowercase. A negative control proves URL and `order` digits are not treated as IDs.

The candidate JSON is unchanged and remains resource-first. `publisher` is descriptive provenance; `targets` carries the CompatibleHost relation; there is no vendor parent layer.

## Frozen SHA-256

- `f8f5d0669a1368cd9ab5995b11b815af314c5fd196aff4719b343c2fa24bbe75`  `docs/research/community-skill-store-cocoloop-small-batch2-candidate-active7-2026-08-14.json`
- `e4652674829b1d9500203c8b27092b573deab6e8a42ab16f8bc09306f27a1d51`  `docs/research/community-skill-store-cocoloop-small-batch2-research-2026-08-14.md`
- `93b998112fc284655ac145900a9711cd8760c69ae37b4e1ed43b757c9ddb2ade`  `tests/community-skill-store-cocoloop-small-batch2-candidate.test.cjs`

## Final checks

- Focused test: PASS, 4/4.
- `node --check` on the focused test: PASS.
- Candidate JSON parse: PASS.
- Diff whitespace checks for candidate/research/test: PASS.
- Official pinned source: OpenClaw `skills/mcporter/SKILL.md` and repository MIT `LICENSE` both resolve at commit `6f99d3405cec1221c4fd9fa30f89795acc5f427d`.

STOP at frozen handoff. Independent CTO read-only audit is required before any later phase.
