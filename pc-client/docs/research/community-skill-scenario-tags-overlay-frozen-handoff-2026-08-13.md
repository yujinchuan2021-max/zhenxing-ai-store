# Skill scenarioTags overlay candidate — frozen handoff

Status: **LOCAL CANDIDATE PASS / NOT PUBLISHABLE / STOP**

## Result

- Baseline: signed v2 active7 `catalog-v00000007-8c49e1972186-0cec5335`.
- Skill identities: 120 total = 104 `reviewed-community` + 16 `official`.
- Tagged: 104 reviewed-community Skills.
- Unclassified: 16 official Skills. The frozen official review has no per-resource scenario classification fields, so no label/name/host inference was used.
- Evidence join: exact `resourceId + canonicalKey` from frozen B1/B2/B3 ledgers. Coverage is 14 + 50 + 40, with zero missing, duplicate, or non-active identities.
- Taxonomy: the existing 21 canonical IDs from `shared/catalog-taxonomy.cjs`; no legacy Chinese label or old ID was mechanically copied.

Category counts count tags, not unique resources across categories:

| canonical category | count |
| --- | ---: |
| programming-development | 63 |
| agent-multi-agent | 18 |
| automation-rpa | 20 |
| office-collaboration | 0 |
| data-analytics | 14 |
| research | 0 |
| knowledge-docs | 11 |
| writing-content | 41 |
| image-design | 19 |
| video-audio | 0 |
| 3d-cad-industrial | 0 |
| gaming | 0 |
| game-development | 0 |
| marketing | 11 |
| ecommerce | 0 |
| finance-investing | 0 |
| education | 0 |
| life-health | 0 |
| cybersecurity-operations | 8 |
| social-communication | 0 |
| browser-information-collection | 0 |

## Preservation proof

The candidate is an overlay only. Applying each entry adds only `resources[].scenarioTags` to the exact active7 resource ID. Deleting that field from the projected copy is deep-equal to the original active7 catalog. No active catalog file was edited, and current catalog validation intentionally remains a later schema-owner prerequisite.

## TDD and checks

- RED: focused test 0/1 because the overlay candidate did not exist.
- GREEN: `node --test --test-reporter=spec tests/community-skill-scenario-tags-overlay-candidate.test.cjs` → 1/1 PASS.
- `node --check` for generator and focused test → PASS.
- Candidate assertions cover source hashes, exact active7 identity/counts, exact ledger joins, canonical tags, per-tag B2/B3 mapping evidence, honest official unclassified set, category counts, strip equivalence, and no write/publish claims.

## Frozen artifacts

- `docs/research/community-skill-scenario-tags-overlay-candidate-active7-2026-08-13.json`
  SHA-256 `4CD3A7FE2444103181D517EAF63EA344529CABF947E959779BDC5C3957D1582C`
- `scripts/generate-community-skill-scenario-tags-overlay-candidate.cjs`
  SHA-256 `F8B2570CB205BF030D4169507CABF5BA5D2626ECB08905DA250D8EEFF5507C18`
- `tests/community-skill-scenario-tags-overlay-candidate.test.cjs`
  SHA-256 `F047985E4874F351B9FF1D7162C78DFA83998235A139E7D5ED7FD5BB8F3869D4`

## Boundary and next owner

This work changed only the three new files above plus this handoff. It did not modify `src/App.tsx`, `src/data.ts`, `shared/ecosystem-resources.cjs`, any catalog release, channel, state, profile, or package. Existing dirty files remain owned by their current employees.

Before consumption, the Catalog schema owner must independently add optional canonical `resources[].scenarioTags` validation and prove signed-catalog compatibility. The frontend must filter resource rows by these tags rather than target-product tags. Then rerun the hidden DOM source/category matrix before any save, sign, publish, or package action.

No state/save/sign/publish/package/network/service/GUI action occurred. Freeze and STOP.
