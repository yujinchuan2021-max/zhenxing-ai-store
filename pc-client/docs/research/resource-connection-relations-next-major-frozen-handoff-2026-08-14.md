# Resource connection relations next-major frozen handoff

Date: 2026-08-14

Status: **candidate-only / frozen / not publishable**

Scope: phase-1 relationship snapshot only; no production catalog, schema, state, channel, release, application, server, or package mutation.

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json` | `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4` |
| `docs/research/resource-store-next-major-consolidation-active7-2026-08-14.json` | `131182b35aaf510230c574f343c7174a860e8a1a1a0df5e3cd0e03558840373c` |
| `docs/research/comprehensive-ai-connector-resources-census-2026-08-14.md` | `aa177c0d7a268f5305c7a295ff112180fd345cda8240d20ba0f726afa35a9dfc` |

## Frozen outputs

| Output | SHA-256 |
| --- | --- |
| `docs/research/resource-connection-relations-next-major-candidate-active7-2026-08-14.json` | `7cd8e1c27a685b6f1e88e6680d7b73efde8404419a807bf2d848b10e634f7017` |
| `tests/resource-connection-relations-next-major-candidate.test.cjs` | `b202546a75a9799028de69c78ca3f4b9d2e96e057646f7e08046398c22387737` |

The handoff file hash is calculated after this document is written and is reported with the final employee return; embedding a file's own digest would not be stable.

## Exact outcome

- All 106 census IDs occur in exactly one disposition.
- The 18 `ready-link-only` identities split exactly into 8 discovery collections and 10 canonical Resource families.
- Dropbox remains one Resource family with three connection modes: `remote-mcp`, `chatgpt-app`, and `claude-connector`.
- The relationship layer contains 12 ConnectionBindings: 10 evidence-backed dependency tuples and 5 explicit unbound bindings. A binding can contain more than one tuple, so these counts are intentionally different.
- Every dependency uses only `{ kind, canonicalId, hostProductId, bindingKind }`; `bindingKind` is restricted to the six values already defined in `CONTEXT.md`.
- PagerDuty, LaunchDarkly, Snyk Studio, Twilio Docs, and Square remain explicit unbound families because the census did not name one exact active7 host product. No host was inferred.
- All 46 duplicate census rows reuse existing cards: 43 rows resolve to active7 and 3 to the frozen next-major consolidation. The Google Workspace family expands to eight existing Resource IDs, so the 46 rows resolve to 53 Resource IDs in total.
- The 14 provider-only identities are not Resources. The 22 deferred and 6 blocked identities remain in the review ledger.
- Five evidence-bound families have a candidate Resource projection. Every target is `resource-link` + `website` + empty `installProfileId`; credentials are never collected. No managed configuration or execution field exists in the relationship snapshot.

## Public seam proof

The focused test combines:

1. exact active7 (250 Resources),
2. the frozen next-major consolidation (7 Resources), and
3. the five projectable relationship Resources.

`validateCatalog` accepts the resulting 262 Resources. `createResourceMarketplace` exposes 262 unique Resource IDs. Removing the 7 next-major and 5 relationship candidates yields a catalog that is deep-equal to the complete active7 catalog, not merely an equal prefix.

## TDD evidence

1. First RED, before the candidate existed:
   - `node --test tests/resource-connection-relations-next-major-candidate.test.cjs`
   - Result: 0 passed / 1 failed.
   - Exact failure boundary: `candidate relation snapshot must exist`.
2. Minimal GREEN:
   - The candidate was created as `{}`.
   - The existence slice passed 1/1.
3. Contract RED:
   - The five focused contract tests were added while the candidate was still `{}`.
   - Result: 0 passed / 5 failed on missing candidate fields.
4. Final GREEN:
   - `node --test tests/resource-connection-relations-next-major-candidate.test.cjs`
   - Result: 5 passed / 0 failed.

Additional checks:

- `node --check tests/resource-connection-relations-next-major-candidate.test.cjs` — PASS.
- `git diff --no-index --check -- NUL <each-new-file>` — PASS for all three untracked outputs.
- JSON parse and arithmetic readback — 8 collections, 10 families, 46 duplicate mappings, 14 provider-only, 22 deferred, 6 blocked.

## Safety boundary

This snapshot is data-only and does not install, launch, authorize, or connect anything. Discovery collections are not promoted into vendor-owned Resources. Publisher facts do not imply ownership of directory entries. Connection mode remains separate from Vendor and Product identity. This handoff grants no signing, draft-save, catalog mutation, packaging, or publication authority.

The next action is an independent CTO audit of the three frozen files. Until an explicit PASS, the candidate remains non-production.
