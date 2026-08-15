# Workflow production fresh-host bootstrap boundary

## Symptom

The retained-state r12 candidate had a closed release bundle and upgrade
coordinator, but a reset Ubuntu host had no manifest-controlled way to install
the fixed operating-system prerequisites, establish the production UID and
directory authority, create a fresh secret authority, or initialize the empty
signed catalog and application databases. Reusing the upgrade launcher would
have assumed Docker, systemd controls, Admin published state, and retained
Workflow rows that do not exist on a fresh host.

## Confirmed authority facts

- Host: `47.236.62.189`
- Login identity: `admin`
- OS: Ubuntu 24.04 x86_64 with systemd
- Key-pair authority name: `zhenxingai-deploy`
- ED25519 fingerprint:
  `SHA256:q4aNRJbw9Pday5Wfq9W1bVErTe1b4Yz6nn7aM+gLDrI`

Only the fingerprint and non-secret host metadata enter the source contract.
The host public-key body and deployment private key never enter the bundle.
The local coordinator fixes the dedicated authority file
`C:\Users\yujin\.ssh\known_hosts_aihub_production` and its SHA-256
`a6a35075c8ea44425ef8b3db35f09c17670672cad83a64dc2e4bd110d58a5697`;
it does not read or modify the global known-hosts file.

## Root cause

The previous candidate deliberately modeled an in-place replacement and
therefore treated production directories, Docker, signed active6 state, and
retained 3/9/9 Workflow data as preconditions. Those are correct upgrade
preconditions but the wrong abstraction for an empty operating system.

## Minimum correction

The fresh-host candidate adds two narrow phases:

1. Stage0 verifies the frozen Ubuntu host and installs only fixed official
   Ubuntu packages, UID/GID 1000, fixed directories, and rootful Docker plus
   Compose. It does not touch application data.
2. After separately authorized release transfer and prepare, the fresh runner
   consumes only prepared bytes and the release-scoped Node runtime. It creates
   fresh secret files, installs frozen signed catalog artifacts into an empty
   store, and calls the existing migration, reviewer, and official bootstrap
   seams. It does not duplicate schema or state-machine logic.

Resource Submission remains disabled and its five candidate tables remain
absent. Workflow Store uses the exact workflow-only profile. The Flarum API
key authority file is generated with OS CSPRNG bytes and is provisioned into
Flarum only by the existing migration seam.

## Prevention gate

- Exact host/login/OS/fingerprint contract; no caller URL, repo, command,
  user, or path override.
- Exact non-secret environment allowlist and fresh-only directory/volume
  preflight.
- Exact secret file metadata and byte-shape checks with no value in stdout,
  argv, environment templates, reports, or the bundle.
- Empty-store-only signed catalog installation; no private signing key and no
  manual state synthesis.
- Prepared-release and release-scoped runtime verification before any
  application initialization.
- Local true-Linux fresh-host acceptance and independent release audit remain
  required before any SSH, transfer, prepare, or production launch.

## Current evidence boundary

The implementation and tests are local candidate evidence only. No SSH,
server write, transfer, prepare, launch, upload, or client package is part of
this change.
