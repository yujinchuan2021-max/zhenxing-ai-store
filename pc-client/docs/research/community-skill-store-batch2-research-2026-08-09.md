# Community Skill Store ? Batch 2 research and coverage

- Status: candidate-only; not published, signed, installed, or saved to draft.
- Baseline: releaseStore.readRelease() v2 active release `catalog-v00000006-567e671621f1-3dcee587` (615 products, 146 resources, 513 targets); draft revision 89 was used only to identify the current drafting lineage.
- Scope: 100 existing index entries were re-evaluated against original repositories, pinned revisions, and license evidence; their item-level outcomes are in [the re-review ledger](community-skill-store-index-re-review-2026-08-09.json). This batch adds 50 exact canonical Skill resources; combined with the already-staged 14-resource Batch 1, the staged community set is 64, not 100.

## Batch 2 result

| Source | Resources | License | Host evidence used | Status |
| --- | ---: | --- | --- | --- |
| [Anthropic skills](https://github.com/anthropics/skills) | 11 | Apache-2.0 | Claude Code | guarded link-only |
| [Sentry skills](https://github.com/getsentry/skills) | 8 | Apache-2.0 | Claude Code, Cursor | guarded link-only |
| [Supabase Agent Skills](https://github.com/supabase/agent-skills) | 1 | MIT | Claude Code, Cursor | guarded link-only |
| [DKeken alternative skills](https://github.com/DKeken/codex-skills-alternative) | 19 | MIT | Codex CLI, Claude Code, Cursor | guarded link-only |
| [Alem Tuzlak skills](https://github.com/AlemTuzlak/skills) | 11 | MIT | Codex CLI, Claude Code, Cursor | guarded link-only |

Every item has a direct original-author repository URL, a fixed commit, a license link, a canonical subdirectory, raw tags and normalized taxonomy evidence in the JSON review ledger. All 119 targets are `resource-link` with an empty `installProfileId` and website-only capability. No item grants managed installation, Agent binding, Workflow action, update, repair, enable, disable, or uninstall.

## Exact de-duplication and exclusions

- Compared the 50 B2 canonical keys against active v2 resources, draft lineage, Batch 1, and existing Skill/MCP/plugin resource URLs. There are no exact canonical repo+subpath+revision collisions.
- Existing Batch 1 remains separate: 14 pinned `obra/superpowers` resources and 42 link-only targets. B2 begins at order 161 only after B1 is applied.
- Preserved but not staged: 26 Google Workspace CLI entries (credentials/runtime), the Vercel agent-browser entry (dynamic browsing/runtime), four Anthropic source-available document entries, 11 Cloudflare entries without resolved license evidence, and 25 entries needing tighter execution/lifecycle or canonical-relocation review.
- Newly discovered CopilotKit source is recorded for later review, but its moved monorepo and framework-specific lifecycle remain outside this 50-resource batch.

## Mechanical backend consumption

1. Re-read the signed v2 release through `releaseStore.readRelease()` and verify it before any authorized mutation.
2. Re-run the Batch 1 and B2 candidate tests; apply B1 then B2 only if canonical hashes, current release ID, catalog validation, metadata whitelist, and target tuple checks still match.
3. Backend alone may make any future save/sign/publish decision. Keep metadata as data-only and preserve review/risk separation.

## Research boundary

This is provenance and presentation review, not a code or behavior safety audit of third-party content. The guarded status is intentional: users receive original-source links only, and every installation or execution path remains fail-closed. The current signed catalog has no qualifying resource binding, so this batch also carries zero Workflow dependency and zero Agent binding changes.
