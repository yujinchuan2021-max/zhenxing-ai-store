# OpenClaw companion runtime ownership boundary

## Symptom

`openclaw-wsl-gateway` reported the Hub-created `OpenClawGateway` distribution as AI Hub-managed even though the client had no receipt for the WSL distribution, Node runtime, gateway service, pairing, configuration, sessions, credentials, or workspace.

## Evidence and root cause

The fixed `companion-runtime` adapter can only launch two reviewed OpenClaw Hub deep links and verify the installed Hub cleanup script hash. Its status probe reads the vendor-created distribution, CLI version, Gateway RPC readiness, and Hub journal; it does not record a fixed OpenClaw artifact/version, compatible Node runtime, service identity, managed prefix, backup, or rollback receipt.

OpenClaw's official updater is not a fixed-artifact operation: it supports mutable channels and package targets, plugin synchronization, configuration repair, and service handoff. Its repair command writes configuration and plugin/install metadata. The official Hub therefore remains the owner of this lifecycle and its state.

Sources: <https://docs.openclaw.ai/cli/update>, <https://docs.openclaw.ai/cli/uninstall>, <https://docs.openclaw.ai/cli/backup>.

## Fix

The companion status is now `vendor-managed`, never AI Hub-managed, and exposes an explicit reviewed Hub open action without granting AI Hub file management. The existing fixed, user-confirmed vendor cleanup launcher remains separate from AI Hub receipt ownership. `update` and `repair` remain absent from the profile.

## Verification and remaining acceptance

The ownership red check failed before the change (`managed` was `true` without an AI Hub receipt); the focused contract/presentation suite passed after it. No WSL, Hub, OpenClaw install, update, repair, cleanup, login, or user-machine acceptance was performed.

Promotion requires a versioned official Hub lifecycle contract that fixes source/version and compatible Node, writes a bounded ownership receipt, backs up only declared managed configuration before mutation, and restores runtime/configuration/service state on failure. It must exclude vendor sessions, credentials, workspace, and user data unless the user explicitly controls them.
