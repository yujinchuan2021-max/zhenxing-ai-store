# Skill scenario classification catalog v3 frozen handoff

Status: **candidate-only; frozen for catalog-owner review; not publishable**

## Outcome

- Reviewed the 22 Skill Resources that lacked `scenarioTags` in the frozen successor catalog.
- Added canonical, evidence-backed tags to exactly 19 existing Resource identities.
- Preserved all 104 previously classified Skill Resources byte-for-byte.
- Left exactly three broad rolling collections deliberately unclassified: `openai-codex-skills-catalog`, `minimax-official-skills`, and `openclaw-clawhub-skills`.
- Final coverage is 123/126 Skill Resources; no Resource identity, target, compatibility, source, risk, product, vendor, or resource connection changed.

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `docs/research/desktop-edition-gap-catalog-v3-candidate-2026-08-15.json` | `354003c55e69abded51e16858b75f654d3ee642c36b46ff42c03791660c485b8` |
| `docs/research/2026-08-15-official-skill-scenario-classification-review.md` | `ac27f5465c4dffe71885a73d4c1d9ad6810bb3ea83ce9da3761f2b4828349076` |

## TDD and verification

- Initial RED: the named scenario candidate did not exist.
- GREEN: `node --test tests/skill-scenario-classification-catalog-v3-candidate.test.cjs` passes 4/4.
- The test locks the exact 22-row ordered review surface, 19 exact tag arrays, three intentional gaps, canonical taxonomy order, source kinds, input hashes, reverse equivalence, and pure byte idempotence.
- Final catalog remains schema v3 with 375 vendors, 617 products, 280 resources, 866 targets, and 10 resource connections.

## Frozen outputs

| Output | SHA-256 |
| --- | --- |
| `docs/research/skill-scenario-classification-catalog-v3-candidate-2026-08-15.json` | `f769d97f7414d41bda5072761aac9d07d4fe00c2602f71b9a73f3a5a09694ad6` |
| `scripts/generate-skill-scenario-classification-catalog-v3-candidate.cjs` | `f67fdcd59dc5db2a08e7672fd95ced681febef6f19746701c2f7e7e5210c644b` |
| `tests/skill-scenario-classification-catalog-v3-candidate.test.cjs` | `68f6c2afb942033c6dfac2f2df9264b7c75b2db5dc50e598945728cb23b95ecf` |

## Boundary

Scenario tags are browse facets only. They do not imply Agent maturity, compatibility, safety, installation, execution, or publisher trust. This candidate does not write the active catalog, state, release channel, signature, package, or production service.
