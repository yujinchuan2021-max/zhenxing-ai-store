# Canonical desktop package management projection

## Symptom

An already completed `desktop-download-only.signed-catalog` artifact appeared
in the local package list but did not expose the user-triggered install/open
action. The generic canonical module deliberately has no legacy fixed client
profile, so it was incorrectly treated as an unapproved package there.

## Cause

The installed-product projection allowed a completed desktop package only
when its product ID was present in `localInventory`. That is correct for old
fixed profiles but excludes the canonical signed-catalog contract.

## Fix and boundary

The common package projection now also accepts a completed package when the
currently active catalog product is exactly
`desktop-download-only.signed-catalog`, has the matching profile ID, and has
the `install` capability. It does not infer this from product ID or a task
alone. The actual installer-open IPC continues to reauthorize the current
catalog artifact before launching it.

The management matrix also verifies that external desktop/Store/AppX entries
remain vendor or Windows user-confirmed lifecycle flows (no re-manage or
silent uninstall), CLI/WSL ownership remains receipt-gated, OpenClaw stays
vendor-managed without file management, resources use their fixed profile
manager, and environments remain `environment` entries rather than products.

## Verification and remaining acceptance

The new pure fixture failed before the shared change and passed after it;
focused installed-management, desktop lifecycle, uninstall, CLI/WSL,
extension, OpenClaw, and download-recovery tests plus the production build
pass. No real inventory, package download, installation, uninstall, catalog,
or release operation was performed. A future packaged candidate still needs
to confirm a completed canonical artifact can be opened by the user and that
external Store/AppX uninstall remains a user-confirmed Windows/vendor flow.
