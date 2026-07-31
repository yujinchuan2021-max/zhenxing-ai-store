# Packaged OpenClaw download stopped at net::ERR_FAILED

## User-visible failure

The packaged 0.1.19 client showed `下载连接失败` before receiving any bytes from the official OpenClaw Windows installer. Retrying produced the same result even though the URL was reachable on the same computer.

## Reproduction evidence

- The persisted packaged-client task failed with `DOWNLOAD_CONNECTION_FAILED`, zero bytes received, and five attempts.
- The exact packaged 0.1.19 client reproduced the failure through an isolated CDP acceptance harness.
- The development Electron client using the same URL and task code downloaded successfully.
- A minimal Electron probe reproduced the packaged failure only after installing the local-release certificate callback.
- Certificate diagnostics recorded the public `github.com` certificate with `verificationResult: "net::OK"` but `accepted: false`.

## Root cause

The local Docker acceptance build pins one short-lived `localhost` certificate. Its global Electron certificate callback accepted the pinned local certificate, but then tried to approve public certificates only when `verificationResult === "OK"`. Electron reported the normal Chromium result as `net::OK`, so the callback rejected every otherwise-valid public HTTPS certificate. This was a packaged-only TLS policy bug, not a GitHub outage or a Clash requirement.

The download retry path also contained an unnecessary product-specific network branch that read proxy environment variables and tried a fixed local proxy before returning to the Windows system configuration.

## Fix

- The callback returns `0` only for the exact pinned and unexpired `localhost` certificate.
- Every other certificate returns `-3`, delegating the decision to Chromium's normal verifier.
- Startup and retry use Electron session mode `system` exclusively, followed by a system proxy reload and connection refresh.
- The production path contains no Clash detection, fixed proxy port, proxy environment parsing, or branded fallback.
- The reusable network seam now covers direct access, Windows proxy, PAC, VPN-provided system routing, and enterprise proxy configuration through Chromium.

## Verification

- Regression tests prove that the pinned localhost certificate is the only override and that public or mismatched certificates are delegated to Chromium.
- Regression tests prove that every network refresh applies `{ mode: "system" }`.
- The full suite passed 400/400 tests and the TypeScript/Vite production build passed.
- The Electron full-request probe resolved the current Windows system route, received HTTP 200, and read 16,375 bytes with the certificate callback enabled.
- The packaged 0.1.20 Portable client started a real `openclaw-windows-hub` download, received 2,097,152 of 119,668,336 bytes, paused it successfully, and exited with code 0.
- A final isolated packaged 0.1.20 acceptance downloaded all 119,668,336 bytes on its first attempt, reached `completed`, and produced SHA-256 `B5E18B9210D606B921D94CEA4E695A56EBAE9862038E77E0483B552585D4D42B`.
- The local Docker release server published and verified 0.1.20. The packaged client loaded remote catalog version 29 with 49 vendors and reported itself current.

## Prevention

- A release is not accepted from source tests or the development client alone.
- Every local acceptance package must run the packaged managed-download harness against an official reviewed desktop artifact.
- Certificate callbacks must delegate non-local decisions to Chromium instead of comparing verification-result strings.

## Release-gate follow-up

- `release:local:test-client` now performs the real reviewed OpenClaw download itself and fails unless at least 1 MiB is received and the task enters `paused`.
- The standalone reproduction command and the release gate use the same isolated CDP launcher, so a passing development-only path can no longer substitute for packaged-client evidence.
