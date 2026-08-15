# CLI fixed installer and package-manager intake gate

Date: 2026-08-05

## User-visible gap

The catalog can describe an official Windows script or package-manager command without the client having a safe one-click CLI deployment contract. In particular, `nous-hermes-agent` is still an official/manual CLI entry: there is no local managed profile, driver binding, exact AI Hub receipt, or deploy-to-terminal path.

## Evidence

- Authoritative input: revision 87, 615 products, from `docs/research/windows-desktop-acquisition-deep-rescan-draft87-active4-2026-08-05.json`.
- The input contains four script/package-manager candidates: Hermes Agent, Raycast Windows, GitKraken Desktop and Sunlogin Windows.
- The tag-pinned Hermes PowerShell installer still invokes a mutable remote uv installer through `irm | iex`. It also coordinates Python, Node, PortableGit, a repository/venv, PATH and optional browser/runtime work.
- The Hermes Windows guide documents a gateway scheduled task, Startup shortcut, PID/service operations, update, and uninstall behavior that preserves user configuration and session data unless the user explicitly requests full removal.
- A red assertion against `getInstallRegistration("nous-hermes-agent")` fails because no client-approved managed profile exists. This is intentional until the complete lifecycle is safe.

## Cause and decision

An official installer is evidence of a vendor-supported route, not authorization for a generic remote-script executor. Hash-pinning only the outer Hermes script would not pin or receipt its nested downloads and side effects, and none of the existing npm, Python venv, portable binary, MSI or WSL drivers can express its atomic rollback and ownership boundary.

The other three records do not authorize new CLI bindings either. Raycast is a desktop product owned by the desktop acquisition flow. The GitKraken and Awesun package identities are CLI-shaped, but the source records attach them to desktop product IDs; they first need independent first-class CLI catalog identities and fixed lifecycle evidence.

Therefore `docs/cli-fixed-installer-intake-candidate.json` is a candidate-only no-op: all four records have an explicit decision, `acceptedProfiles` and `proposedBindings` are empty, and no new driver or runtime execution primitive was added.

## Required safe contract

An accepted script profile must pin an immutable official source and content hash, use client-fixed interpretation, forbid nested mutable bootstraps, expose dependencies for confirmation, support cancellation/timeout/staging cleanup, and own detection, recheck, receipt, terminal, update, repair, rollback, uninstall and preserved data. A package-manager profile additionally requires an independent CLI identity and a client-fixed manager, package, version, entry point and lifecycle.

Backend data may select only an already-approved local module/profile plus a structured source version summary. It may never provide command, arguments, environment, headers, credentials, URL or script text.

## Verification and remaining acceptance

`tests/cli-fixed-installer-intake.test.cjs` verifies complete source-candidate coverage, unique decisions, empty executable bindings, Hermes' red-capable registry gate, absence of a generic official-script driver, and preservation of desktop product identities.

No real download, installation, terminal launch, service operation, packaging, publication or catalog/state/history write was performed. Automated checks do not substitute for later real Windows acceptance after a safe profile exists.
