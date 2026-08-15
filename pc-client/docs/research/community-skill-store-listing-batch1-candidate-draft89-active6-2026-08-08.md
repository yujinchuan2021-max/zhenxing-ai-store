# Community Skill Store listing Batch 1 candidate

Candidate only; not publishable. This document does not change catalog/state, save a draft, sign, publish, package, upload, download, install, or create a managed binding.

## Outcome

The active v2 release remains at 16 official Skill resources, 34 Skill targets, and zero community Skill resources. From the existing 100-item reviewed index, this slice selects 14 canonical Skills from the original-author Superpowers repository. All 14 have an immutable observed revision, MIT license evidence, and upstream host statements for Claude Code, Codex CLI/App, and Cursor. They remain `resource-link`; no fixed profile, Agent binding, Workflow action, or managed lifecycle is proposed.

If a later authorized backend review applies this candidate unchanged, the preview is 160 total resources and 555 total targets: 30 Skill resources (16 official + 14 reviewed-community), 76 Skill targets, 8 existing managed targets, and 547 link-only targets. These are preview counts, not active facts.

## Selected resources

| resourceId | canonical source | verified host grouping | license | governance | binding |
| --- | --- | --- | --- | --- | --- |
| `obra-superpowers-brainstorming` | [Brainstorming](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/brainstorming) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-writing-plans` | [Writing Plans](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/writing-plans) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-executing-plans` | [Executing Plans](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/executing-plans) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-dispatching-parallel-agents` | [Dispatching Parallel Agents](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/dispatching-parallel-agents) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-requesting-code-review` | [Requesting Code Review](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/requesting-code-review) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-receiving-code-review` | [Receiving Code Review](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/receiving-code-review) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-using-git-worktrees` | [Using Git Worktrees](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/using-git-worktrees) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-finishing-development-branch` | [Finishing a Development Branch](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/finishing-a-development-branch) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-subagent-driven-development` | [Subagent Driven Development](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/subagent-driven-development) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-test-driven-development` | [Test Driven Development](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/test-driven-development) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-systematic-debugging` | [Systematic Debugging](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/systematic-debugging) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-verification-before-completion` | [Verification Before Completion](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/verification-before-completion) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-writing-skills` | [Writing Skills](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/writing-skills) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |
| `obra-superpowers-using-superpowers` | [Using Superpowers](https://github.com/obra/superpowers/tree/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/using-superpowers) | codex-cli, claude-code, cursor-desktop | MIT | manually-reviewed / guarded | link-only |

The source repository describes Superpowers as composable Skills, lists the six selected workflow/debugging Skills and the remaining suite, identifies Jesse Vincent / Prime Radiant, declares MIT licensing, and names Claude Code, Codex CLI/App, and Cursor among supported harnesses. Host evidence supports grouping and external links only; it does not supply an AI Hub fixed profile.

## Counts and blocks

- Ready for backend link-only review: **14**.
- Not in this listing batch: **86**.
- Hard blocked: **41** (15 unresolved licenses, 26 credential/runtime-dynamic entries).
- Guarded dynamic content: **1**.
- Deferred pending per-Skill source/content/host review: **44**.
- Selected risk: 14 guarded, 0 low, 0 unsafe. Selected review status: 14 manually-reviewed.
- External popularity collected: 0; stars or heat have no safety or authorization effect.
- CocoLoop items consumed: 0. Its current intake stopped before detail crawl, so it remains a discovery-only source and cannot stand in for an original author.

## Canonical dedupe

The 14 selected canonical keys are unique as `github:obra/superpowers#<skill-slug>`. A repository can contain several distinct Skills; the fragment identity prevents collapsing the suite into one resource while still preventing the same Skill from being counted twice.

One exact existing-catalog merge remains a no-create result: `github:openai/skills#chatgpt-apps` maps to `openai-chatgpt-apps-skill`. Similar names across `anthropics/skills` and `getsentry/skills` are only semantic alias candidates, not exact canonical duplicates, and are not auto-merged.

## Safety and schema boundary

Every proposed target is `resource-link`, uses an empty `installProfileId`, and exposes only `website`. Missing host lifecycle, binding, and profile evidence therefore fails closed. Unsafe or rejected records—none are selected here—must remain warning/source-link only and cannot gain managed install, Agent, or Workflow actions.

The full provenance snapshot is retained beside each proposed resource: original author, pinned canonical source, MIT license, source revision, discovery platform, and observation time. There is a shared contract gap: the intake planner and frontend type/renderer understand `metadataSnapshot`, while the current catalog resource validator does not whitelist it. The present catalog projection therefore preserves author in `publisher`, canonical source in `website`, immutable revision in `versionRef`, and license/source URLs in `provenanceEvidence`; backend must retain the full snapshot as review evidence and must not claim that active source-detail metadata is persisted until schema/CRUD alignment is separately approved.

## Backend consumption gate

1. Reload authoritative draft revision 89 and v2 active release 6; stop on drift.
2. Run `planCanonicalResourceIntake`; all 14 selected IDs must be `create-canonical`.
3. Re-run exact canonical dedupe and keep the OpenAI ChatGPT Apps result as no-create.
4. Append only each `proposedResource`; do not infer profiles, bindings, commands, or extra hosts.
5. Run `validateCatalog` and assert the preview counts above, 42 new link-only targets, and zero new managed targets.
6. Measure the exact post-transform signed envelope before requesting approval.
7. Only a separately authorized backend task may save a draft; signing/publishing and packaged-client acceptance remain separate responsibilities.
8. Frontend needs no resource-ID special case: after a signed release it should receive the 14 records through the shared ResourceStore community projection.

## Evidence

- [Superpowers README at observed revision](https://github.com/obra/superpowers/blob/44c9b2d6e889982ac18c27d05a19fefe335194e1/README.md)
- [MIT license at observed revision](https://github.com/obra/superpowers/blob/44c9b2d6e889982ac18c27d05a19fefe335194e1/LICENSE)
- [Original author profile](https://github.com/obra)
- [Machine-readable candidate](./community-skill-store-listing-batch1-candidate-draft89-active6-2026-08-08.json)

