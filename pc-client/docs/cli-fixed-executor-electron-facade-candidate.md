# Fixed CLI executor Electron facade (candidate)

Status: candidate-only. This document does not change the signed catalog, publish a release, or authorize packaging.

## Eligibility

The Electron main process exposes the fixed portable-binary lifecycle only when the current remote verified catalog entry exactly matches the fixed local registration. The complete review-package allowlist is:

- `google-antigravity-cli` / `cli.antigravity`
- `moonshot-kimi-code-cli` / `cli.kimi-code`
- `amp-cli` / `cli.amp`
- `daytona-cli` / `cli.daytona`

The registration and catalog must agree on vendor, `productType=cli`, `kind=CLI`, `moduleId=cli-managed`, profile ID, requirements, and requested capability. Planning, confirmation, and apply recheck that intersection. No other portable-binary profile, including Auggie, enters this facade.

## Renderer API

`window.aihubPC` exposes only structured calls:

- `planFixedCliLifecycle({ productId, operation, useId })`
- `confirmFixedCliLifecycle({ planId, useId, confirmationId })`
- `applyFixedCliLifecycle({ planId, useId, confirmationId, dryRun })`
- `getFixedCliLifecycleStatus({ productId })`
- `recheckFixedCliLifecycle({ productId })`

The main IPC channels are `cli-lifecycle:plan`, `cli-lifecycle:confirm`, `cli-lifecycle:apply`, `cli-lifecycle:status`, and `cli-lifecycle:recheck`. Inputs are exact objects and reject command, arguments, environment, URL, path, script, shell, credentials, receipt, vault, and identity fields. Results expose only plan state, public installed/managed/detection/version status, and the receipt summary `{ ownership, action, persisted, version }`.

## Execution boundary

Apply reuses the existing approved managed-binary artifact path and the CLI employee's `portable-binary` executor. The artifact must be the local profile's exact architecture artifact; the renderer never supplies a download URL, executable, or destination. A user confirmation ID bound to the plan's `useId` is required. A Local Agent Bridge ticket is not an apply authorization.

The isolated test covers apply, recheck, a bad update that rolls back, and uninstall in a temporary root. It does not download a third-party artifact, use user configuration, or prove a real packaged Electron/UI acceptance. A renderer may now wire these APIs, but a review package still needs a user-confirmed, real Windows acceptance run before release.

## Fixture isolation check

The fixed lifecycle fixture creates a fresh `mkdtemp` root and an independent receipt file before every plan. The focused six-file group passed twenty default-parallel repetitions and ten `--test-concurrency=1` repetitions after the reported one-off first-plan failure could not be reproduced. This is a regression guard for test isolation only; it does not relax catalog/profile checks or make execution serial.
