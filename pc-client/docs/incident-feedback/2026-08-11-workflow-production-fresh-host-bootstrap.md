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

## 2026-08-16 current-Identity read-only recheck

After the current Identity candidate `d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8`
completed its fresh local A-E acceptance, one separately scoped read-only SSH
connection inspected the fixed production host. The connection used the same
dedicated known-host authority above, whose SHA-256 was still
`a6a35075c8ea44425ef8b3db35f09c17670672cad83a64dc2e4bd110d58a5697`,
and the deployment key fingerprint remained
`SHA256:30qQ4kGdaJxbDUXu31TJybjq5g5GAuptdKBgHcYxW50`. It used strict host-key
checking, one connection attempt, no forwarding, no `sudo`, and a stdin-only
shell program containing read operations. It created no remote file and made
no service, Docker, release, database, secret, or network configuration
change.

The host still reported Ubuntu 24.04 x86_64, but systemd reported `degraded`.
Docker metadata was not readable through the fixed `admin` login
(`docker info` did not succeed), while Compose 2.40.3 was present. Therefore
the zero image/container observations are not evidence that an image or
container is absent. Eight release directories and eight prepared markers were
visible. The r16 and r25 transient units were both `not-found` / `inactive` /
`dead`. Ports 80, 443, 4173, and 4174 all had listeners. The fixed r16 control
file locations did not reproduce the earlier receipt/status/terminal/target
hashes through this read-only view.

The newest inspected frozen production bundles, including r19 and r27, still
bind the deployed Identity closure `2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7`
and image ID
`sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748`.
They are not a release artifact for the new local-only `d9fa8de…` image. The
read-only connection consequently authorizes neither transfer nor prepare,
and it cannot be used as production acceptance for the current candidate.

Before any later production action, generate and independently freeze a new
release bundle that binds the exact current Identity source manifest and image
ID, then run a candidate-specific server preflight able to distinguish Docker
daemon unavailability from login authorization. Transfer, prepare, service
launch, migration, cutover, rollback, and public exposure remain separate
explicit decisions.
