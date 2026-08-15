# Plugin platformSupport evidence - draft89 / v2 active6

Status: candidate-only=true; publishable=false. Read-only evidence and intersection preview for the eight active Plugin resources and eight targets. This is not an active catalog change and does not grant managed installation.

## Baseline and result

- Source of truth: draft revision 89 and v2 active catalog version 6, release catalog-v00000006-567e671621f1-3dcee587.
- Scope: 8 resources, 8 targets; 1 plugin-managed target and 7 resource-link targets.
- Requested preview: 8 resources x 3 requested platforms = 24 triples.
- Resource-level platform claims: Windows 0 supported / 8 unknown; macOS 0 / 8 unknown; Linux 0 / 8 unknown.
- Host claims are separate evidence. A cross-platform host does not prove its plugin is cross-platform.
- Intersection preview: 0 available, 24 blocked. The only managed profile has no profile platformSupport claims, so managedEligible=false with blocked-profile-platform-unreviewed.

## Resource and target review

| resourceId | hostProductId | target tuple | Windows | macOS | Linux | classification |
|---|---|---|---|---|---|---|
| anthropic-official-plugin-marketplace | claude-code | resource-link / no profile | unknown | unknown | unknown | official-link-only |
| comfy-custom-nodes | comfy-desktop | resource-link / no profile | unknown | unknown | unknown | official-link-only |
| google-gemini-cli-extensions | gemini-cli | resource-link / no profile | unknown | unknown | unknown | official-link-only |
| moonshot-kimi-plugins | moonshot-kimi-code-cli | resource-link / no profile | unknown | unknown | unknown | official-link-only |
| amazon-kiro-powers | amazon-kiro-ide | resource-link / no profile | unknown | unknown | unknown | official-link-only |
| openclaw-clawhub-plugins | openclaw-agent | resource-link / no profile | unknown | unknown | unknown | official-link-only |
| cline-official-skills-plugins | cline-agent | resource-link / no profile | unknown | unknown | unknown | official-link-only |
| anthropic-commit-commands-plugin | claude-code | plugin-managed / plugin.claude.commit-commands | unknown | unknown | unknown | blocked-profile-platform-unreviewed |

The Windows claim for Claude Code host is WSL, while macOS and Linux host claims are native. Comfy Desktop has a first-party Windows native x64 claim and macOS native arm64 claim; Linux is not established. Gemini CLI and the remaining hosts are conservative unknown. These host claims are not copied to resource claims.

## First-party evidence

| resource/host | canonical first-party HTTPS evidence |
|---|---|
| Claude Code marketplace and commit commands | https://code.claude.com/docs/en/discover-plugins ; https://github.com/anthropics/claude-code/tree/main/plugins/commit-commands |
| Comfy custom nodes and desktop | https://docs.comfy.org/development/core-concepts/custom-nodes ; https://docs.comfy.org/installation/desktop/windows ; https://docs.comfy.org/installation/system_requirements |
| Gemini CLI extensions | https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md |
| Kimi plugins | https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html |
| Kiro Powers | https://kiro.dev/docs/powers/ |
| OpenClaw plugins | https://docs.openclaw.ai/cli/plugins |
| Cline host | https://docs.cline.bot/cline-overview |

Observed date for this review: 2026-08-07. Marketplace, repository, package, version, host compatibility, and lifecycle contracts remain independent review dimensions; platform support alone never qualifies a managed profile.

## Safety, dedupe, and ownership

Canonical identity is the original publisher plus canonical repository/package, resourceId, and the (resourceId, hostProductId, moduleId, profileId) target tuple. No target platform field is proposed. No registry write is proposed. No arbitrary execution or secret-bearing field is proposed.

All eight resources remain resource-link/official-link-only for this round. The managed Claude profile remains blocked until profile platformSupport is reviewed against the shared adapter. Backend owns schema/CRUD validation; frontend owns projection and clear blocked-state presentation; desktop owns real-host lifecycle verification; Agent Broker owns compatibility visibility only; Plugin Store owns first-party evidence and follow-up.

## Acceptance boundary

This document is an evidence candidate, not real device, marketplace, installation, or production acceptance. No catalog/state/schema/profile was changed; no draft save, publish, package, upload, download, or install was performed.

