# Draft 89 CLI / Agent coverage matrix

Source: `admin/published/catalog-store/state.json`, draft revision 89 (615 products), active release `catalog-v00000072-e286516335da-a8b62a49` / catalog version 72.

`v2 active6` records 265 Windows **desktop** validations only. It is not evidence of CLI installation, login, service, update, repair or uninstall acceptance.

Legend: `I` install, `U` update, `R` repair, `O` open terminal, `X` receipt-owned uninstall. Every managed-ready row has the fixed local chain `environment-check -> deploy -> recheck -> open-terminal -> receipt-owned-uninstall`.

## Managed-ready (32)

| Product | Local profile | Driver | Environment | Lifecycle |
| --- | --- | --- | --- | --- |
| `codex-cli` | `cli.codex` | npm | node | I/U/R/O/X |
| `claude-code` | `cli.claude-code` | npm | node, git | I/U/R/O/X |
| `bytedance-agent-tars-cli` | `cli.agent-tars` | npm | node | I/U/R/O/X |
| `gemini-cli` | `cli.gemini` | npm | node | I/U/R/O/X |
| `github-copilot-cli` | `cli.github-copilot` | npm | node | I/U/R/O/X |
| `alibaba-qwen-code` | `cli.qwen-code` | npm | node | I/U/R/O/X |
| `alibaba-qoder-cn-cli` | `cli.qoder-cn` | npm | node | I/U/R/O/X |
| `minimax-cli` | `cli.minimax` | npm | node | I/U/R/O/X |
| `openclaw-agent` | `cli.openclaw` | npm | node | I/U/R/O/X |
| `pixverse-cli` | `cli.pixverse` | npm | node | I/U/R/O/X |
| `factory-cli` | `cli.factory` | npm | node | I/U/R/O/X |
| `continue-cli` | `cli.continue` | npm | node | I/U/R/O/X |
| `kilo-code-cli` | `cli.kilo-code` | npm | node | I/U/R/O/X |
| `letta-code-cli` | `cli.letta-code` | npm | node | I/U/R/O/X |
| `ruflo-cli` | `cli.ruflo` | npm | node, git | I/U/R/O/X |
| `promptfoo-cli` | `cli.promptfoo` | npm | node | I/U/R/O/X |
| `comfy-cli` | `cli.comfy` | python-venv | python | I/U/R/O/X |
| `mistral-vibe-code-cli` | `cli.mistral-vibe` | python-venv | python | I/U/R/O/X |
| `hf-cli` | `cli.hugging-face` | python-venv | python | I/U/R/O/X |
| `deepgram-cli` | `cli.deepgram` | python-venv | python | I/U/R/O/X |
| `hkuds-nanobot-cli` | `cli.nanobot` | python-venv | python | I/U/R/O/X |
| `aider-cli` | `cli.aider` | python-venv | python312, git | I/U/R/O/X |
| `praisonai-cli` | `cli.praisonai` | python-venv | python | I/U/R/O/X |
| `google-antigravity-cli` | `cli.antigravity` | portable-binary | none | I/U/R/O/X |
| `moonshot-kimi-code-cli` | `cli.kimi-code` | portable-binary | git | I/U/R/O/X |
| `amp-cli` | `cli.amp` | portable-binary | none | I/U/R/O/X |
| `daytona-cli` | `cli.daytona` | portable-binary | none | I/U/R/O/X |
| `openfang-cli` | `cli.openfang` | portable-binary | none | I/U/R/O/X |
| `zeroclaw-cli` | `cli.zeroclaw` | portable-binary | none | I/U/R/O/X |
| `open-interpreter-cli` | `cli.open-interpreter` | portable-binary | none | I/U/R/O/X |
| `amazon-kiro-cli` | `cli.kiro` | managed-msi | none | I/U/R/O/X |
| `ironclaw-cli` | `cli.ironclaw` | managed-msi | none | I/U/R/O/X |

## Managed partial (2)

| Product | Local profile | Driver | Environment | Honest lifecycle gap |
| --- | --- | --- | --- | --- |
| `openclaw-wsl-gateway` | `cli.openclaw-wsl` | companion-runtime | wsl | I/O/X only; no fixed update/repair receipt, Node/service backup and rollback contract. |
| `augment-auggie-cli` | `cli.augment-auggie` | wsl-managed | wsl | I/U/O/X; repair remains unavailable because the fixed Node/repair contract is unresolved. |

## Deploy-only (1)

| Product | Local profile | Driver | Environment | Honest lifecycle gap |
| --- | --- | --- | --- | --- |
| `anytype-cli` | `cli-deploy-only.anytype` | portable-binary | none | environment-check, deploy, recheck, terminal and receipt only; no update, repair or uninstall claim. |

## Official-only blocked (13)

| Product | Fixed local profile / driver | Current classification |
| --- | --- | --- |
| `agenticseek-cli` | none | Source, Docker and service stack. |
| `browser-use-cli` | none | Browser/runtime and daemon lifecycle not owned. |
| `cursor-cli` | none | WSL dynamic vendor installer. |
| `kortix-cli` | none | No supported native Windows CLI delivery. |
| `metagpt-framework` | none | Multi-runtime Python/Node/pnpm contract. |
| `mini-swe-agent-cli` | none | Bash/container execution contract. |
| `nanoclaw-cli` | none | WSL/Docker/container/service stack. |
| `nous-hermes-agent` | none | Nested mutable bootstrap and compound runtime/service lifecycle. |
| `nvidia-nemoclaw-cli` | none | WSL/Docker/sandbox/gateway stack. |
| `openmanus-cli` | none | Source checkout and optional browser runtime. |
| `plandex-cli` | none | WSL/Docker-backed service lifecycle. |
| `simular-agent-s-cli` | none | GUI control, OCR and model-service permissions. |
| `tabnine-cli` | none | Tenant-host dynamic installer and self-updater. |

## Repeatable regression

Run `node scripts/validate-cli-agent-coverage.cjs` to regenerate the complete machine-readable matrix without network access or installation. It checks every draft CLI/Agent product against its fixed local registration, profile, driver, capabilities, requirements, lifecycle class and blocker decision; it fails on duplicate identities, unapproved drivers, missing terminal/receipt/uninstall links, accidental lifecycle overclaim, or a changed official-only set.

The focused test is `node --test tests/cli-agent-coverage.test.cjs`. It is automated contract evidence only; real Windows/WSL install, network/proxy, permissions, login, vendor service, cancellation and data-preservation acceptance remain required.
