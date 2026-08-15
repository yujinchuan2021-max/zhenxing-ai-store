# Official Skill seeds active7 candidate frozen handoff

## Frozen result

- Scope: exactly 20 pinned official samples from the prior research freeze; no additional source was searched.
- Proposed resources: **0**.
- Exact ledger: **20** decisions — 2 duplicates, 5 deferred, 13 blocked.
- Duplicates: Anthropic `algorithmic-art` and `skill-creator`; each collides in active7 by proposed ID, normalized name, and normalized repository path. Their newer pinned commits are version drift, not new resources.
- Deferred: all five `microsoft/skills` samples. The source, commit, and MIT repository boundary are closed, but an exact compatible active7 host and the cloud/package/runtime boundary were not closed in this bounded pass.
- Blocked: five Hermes samples, three remaining Anthropic samples, and five OpenAI Plugin samples. The exact ledger records the first-party host/license evidence and the explicit execution, local/external write, restricted-license, OAuth/private-data, or external-service boundary that prevents promotion.

This is a fail-closed result: absence of an active7 duplicate is not intake approval. The empty `proposedResources` array is intentional.

## Frozen inputs and outputs

| File | SHA-256 |
| --- | --- |
| `docs/research/official-skill-seeds-sample-2026-08-14.md` | `d6ec0cb0652701dc7a1ca75eea343a72025fce89c247bbacefdedd09bdf219a1` |
| `admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json` | `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4` |
| `docs/research/official-skill-seeds-candidate-active7-2026-08-14.json` | `89b3ecb0f7b6ce35a30af807153fecbe9c72dcf6393f07c18a651fbe4d39637a` |
| `tests/official-skill-seeds-active7-candidate.test.cjs` | `2a8cbc9082aac1222ebfb2e5ec272e6af132b352bab310cdf071d380f6024ffd` |

The candidate binds the research and active7 SHA values directly. Each of its 20 rows freezes a `github.com/owner/repo@40commit:path/SKILL.md` identity, same-revision license evidence, compatible-host evidence status, execution/access risk, and active7 ID/name/path match arrays.

## RED to GREEN

- RED: with the dedicated test present and the candidate JSON absent, `node --test --test-reporter=spec tests/official-skill-seeds-active7-candidate.test.cjs` exited 1 with 0 passed / 2 failed. Both failures were the expected missing-candidate boundary (`candidate must exist` and `ENOENT`).
- GREEN: after adding the candidate JSON, the same command exited 0 with 2 passed / 0 failed.
- Syntax: `node --check tests/official-skill-seeds-active7-candidate.test.cjs` passed.
- JSON parse: PowerShell `ConvertFrom-Json` passed.
- The focused test recomputes SHA binding, all 20 canonical identities, summary partition, active7 proposed-ID/name/logical-path dedupe, same-commit evidence pinning, empty proposal set, link-only target contract, and recursive forbidden-field absence.

## Safety and employee boundary

No Skill, plugin, repository helper, installer, or third-party content was installed or executed. No private API, login-gated surface, or robots bypass was used. The candidate contains no command/argument/environment/service-address/token/managed-install fields; any future target is constrained to `resource-link`, empty `installProfileId`, and `website` capability only.

This employee added only the candidate JSON, its dedicated test, and this handoff, while treating the prior research note as a frozen input. The repository was already dirty; unrelated files and changes remain user-owned.

Protected snapshots were not edited: active7 `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4`; `admin/server.cjs` `73f56f60f76c60f5d39abef1799b92fa912ad0d265283ba7069f6e0418dc6cd6`; `admin/release-store.cjs` `69a20a1defc95746a2bb75235e10f16a288438c4b8fe49a4c6cde8d329fe8ae1`; `shared/catalog.cjs` `15b64a2ae540f77cc6a0b39f1cba2c18de9f112d26c4959fc5b43fc722eb11e5`; `shared/release-channel.cjs` `f4d5eaa60154046d389cf6c75c0574189f3df79c971a8fa939518c052887216c`; `src/App.tsx` `8909e964e861b20c8153cf33b73fca475871305ef73799a58c3a37c44554bb03`; `identity/schema.sql` `581d34a01ba16686c8cdc1e2c55f89125f6d3a1e82c19b6de06d8ebfeaaf39a3`; `package.json` `a5d9402ae1e9be2d55e91b400329212ebb414e5a428ad5a88be947d6a41235c5`.

No active catalog, state, channel, release, App, schema, package, server, profile, signature, upload, publication, or production data was changed. This is frozen candidate evidence only, not publication, installation, runtime, user acceptance, or production evidence. STOP pending independent CTO read-only audit.
