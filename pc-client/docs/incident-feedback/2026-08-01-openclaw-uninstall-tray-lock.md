# OpenClaw uninstall was blocked by the running tray and AI Hub stayed locked

## User-visible failure

- OpenClaw remained installed after AI Hub opened its uninstaller.
- The OpenClaw tray was still present.
- AI Hub kept showing that it was confirming the uninstall, blocked a second attempt, and the manual check did not recover the action.

## Reproduction evidence

- The durable operation for `openclaw-windows-hub` remained in `monitoring` with `lastDetection: installed` after the uninstaller had exited.
- The official OpenClaw Inno Setup source declares `AppMutex=OpenClawTray` and explicitly blocks install/uninstall while the tray is running.
- The same official source asks an interactive WSL gateway cleanup question, while silent uninstall selects gateway cleanup automatically.
- The shared operation controller observed foreground process exit only for install operations, so an exited uninstaller could not release the operation lock.

## Root cause

The reviewed desktop uninstall path launched the trusted uninstaller without first applying the adapter's reviewed process-close policy. The generic process-exit recovery path also rejected uninstall operations. OpenClaw therefore hit its vendor mutex, exited without removing the registry identity, and left AI Hub polling until timeout.

A second live reproduction exposed a Windows-specific gap in the first repair: `taskkill /IM OpenClaw.Tray.WinUI.exe /T` returned success after sending a close signal, but the exact same tray PID was still alive 1.5 seconds later. AI Hub trusted the command exit code instead of verifying that the reviewed process had actually disappeared, so the Inno Setup mutex still blocked `unins000.exe`.

## Fix

- The desktop uninstall module now closes only the product executable names declared in the local reviewed adapter before launching an uninstaller.
- OpenClaw declares `OpenClaw.Tray.WinUI.exe`, foreground uninstall lifecycle, and fixed Inno arguments `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART` in its local whitelist.
- The shared operation controller now finalizes both install and uninstall process exits. An exited uninstaller with remaining install evidence becomes a retryable canceled operation; absent evidence becomes uninstalled.
- The renderer restores an unsuccessful uninstall to the installed state instead of incorrectly treating the product as a downloaded installer.
- Timed-out legacy foreground uninstall tasks are normalized when the renderer reconnects.
- Process closing is now a reusable reviewed module with `graceful` and `force-after-grace` strategies. It checks the real process table after the close signal; OpenClaw alone opts into a reviewed forced fallback before its uninstaller can start.

## Verification

- Added regression coverage for both uninstall-exit outcomes.
- Added catalog coverage for OpenClaw's close policy, automatic mode, and fixed arguments.
- Targeted operation, catalog, presentation, and installer-launch tests pass.
- Production frontend build passes.
- Live reproduction confirmed the normal close signal left PID `55632` running.
- Live acceptance then verified the reviewed `unins000.exe` SHA-256, force-closed the tray, ran the fixed silent arguments, and received exit code `0`.
- After live uninstall, the OpenClaw registry identity count, tray process count, and installation-directory presence were all zero/absent.

## Remaining acceptance

The fixed AI Hub build still needs a packaged-client click check after release packaging; the underlying vendor uninstall path itself has now passed on this Windows machine.
