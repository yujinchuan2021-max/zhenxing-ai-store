# Auggie WSL repair must rebuild only an exact owned prefix

## Finding

`augment-auggie-cli` previously exposed a fixed update but no independent repair
path. Reusing deploy would incorrectly claim ownership of an existing prefix;
reusing update would permit a version or script change and would not model a
broken `bin/auggie` as a repair case.

## Fixed contract

- The local profile pins Auggie `0.34.0`, Node `22.23.2`, the packaged installer
  digest, and `repairStrategy: rebuild-owned-prefix`. Node 22 satisfies the
  current official Auggie CLI Node 20+ requirement.
- Repair needs an exact AI Hub receipt (product, version, distribution, prefix,
  script digest, management id) and a non-symlink `$HOME/.aihub-auggie/.aihub-owner`
  marker matching that receipt. A missing or changed marker is rejected.
- The marker probe intentionally does not require the CLI executable, so an
  owned damaged prefix can be repaired. The later action remains the fixed,
  packaged script only; it accepts the local `--repair` flag and no backend
  command, URL, arguments, environment or script text.
- The script stages fixed, hash-checked Node and npm artifacts, moves the old
  owned prefix to a private backup, and restores it on any replacement or
  post-install verification failure. A healthy prefix is a no-op. Repair never
  changes the receipt, WSL distribution, or user `~/.augment` data.

## Evidence and remaining acceptance

Focused contract tests cover exact-receipt rejection, marker-only repair
preflight, fixed repair action, immutable script digest, rollback branch, and
post-repair status/terminal wiring. They do not prove a real WSL install,
network/proxy behavior, login, cancellation timing, or user-device data
preservation; those remain required acceptance work.
