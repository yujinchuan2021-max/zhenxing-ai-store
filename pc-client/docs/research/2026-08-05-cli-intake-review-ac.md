# CLI intake review AC (read-only)

Review scope: remaining partial, blocked, and no-profile CLI/Agent entries after the 32 ready managed profiles. This review used the existing first-party research and client contracts; no installation, login, service, or WSL operation was performed.

## Result

Accepted: none. No backend binding candidate was generated.

Blocked: `cursor-cli`, `tabnine-cli`, `openmanus-cli`, `mini-swe-agent-cli`, `metagpt-framework`, `browser-use-cli`, `simular-agent-s-cli`, `nvidia-nemoclaw-cli`, `nous-hermes-agent`, `anytype-cli`, and `plandex-cli`.

## Driver decisions

- Node/npm: the remaining entries are not fixed public npm/package contracts. Cursor is WSL-only with a dynamic installer and no fixed digest or uninstall contract; Tabnine resolves a tenant-host installer dynamically.
- Python/venv: OpenManus is a source checkout with configuration and optional Playwright; mini-SWE-agent requires Bash/container semantics; MetaGPT needs an incompatible Python range plus Node/pnpm; Browser Use owns Chromium/daemon/profile assets; Simular adds GUI control, OCR, model endpoints, and arbitrary local execution.
- WSL/Docker/service: NemoClaw, Hermes, Anytype, Plandex and related service entries require compound runtime/service/data ownership. Existing drivers cannot receipt and safely remove all components without adopting user installations.

## Evidence and boundary

Primary evidence is in `docs/research/cli-agent-official-install-research.md`, `docs/research/2026-08-04-remaining-cli-blockers-classification.md`, `docs/research/2026-08-04-anytype-cli-windows-lifecycle.md`, and `shared/windows-cli-review-decisions.cjs`. Existing catalog entries remain official/tutorial-only or blocked. Backend must continue binding only fixed client module/profile identities; it must not supply commands, arguments, environment, headers, URLs, or scripts.
