# Installed client runtime version display

## Symptom

After the machine-wide client was upgraded from 0.1.91 to the unsigned 0.1.94 server-connected review package, Windows and the executable both reported 0.1.94, but Settings initially displayed 0.1.40. Clicking **Check for updates** changed the same field to 0.1.94.

## Evidence

- The uninstall registry entry reported `DisplayVersion=0.1.94`.
- `C:\Program Files\aihub-pc-client\枕星 AI.exe` reported file version 0.1.94 and product version 0.1.94.0.
- The installed application started successfully, restored the existing account, loaded remote catalog version 7, and rendered all four Resource Store channels.
- The main-process update check obtains `currentVersion` from Electron `app.getVersion()`.
- Before this fix, renderer update state started as `null`, while the Settings fallback read the repository `package.json` version 0.1.40. The runtime value was populated only after the user explicitly invoked the update check.

## Root cause

Review packaging supplies its release version through package metadata without changing the repository development version. The renderer treated that development version as the initial installed-client truth even though the existing IPC boundary already exposed the packaged runtime version.

## Fix

The renderer now invokes the existing `checkForUpdate` boundary once when the application starts. Its result populates the Settings version from `app.getVersion()` before the user opens Settings. If the bridge is unavailable or the check fails, the browser/development fallback remains unchanged. No IPC, update-channel, server, installer, or catalog contract was added or changed.

## Verification

- The focused test first failed 0/1 because no startup update check existed.
- After the three-line startup effect was added, the focused test passed 1/1.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with 110 transformed modules and only the existing browser-externalization and large-chunk warnings.

## Remaining acceptance

- The already installed 0.1.94 review package predates this source fix. It remains usable and shows 0.1.94 after an explicit update check, but it is not evidence that the startup display fix is packaged.
- A future review package must be built and installed under a new version, then Settings must be inspected before clicking **Check for updates**.
- The production update channel remains intentionally unconfigured in this review package. This change does not authorize a server update, signing, publication, or automatic client update.
- The repository is a shared dirty worktree; these focused results do not establish a clean release source.

## Prevention gate

Every installed-client acceptance must compare the registry version, executable version, Electron runtime version, and the Settings value before any manual update check. A source `package.json` version is never sufficient evidence for an installed package version.
