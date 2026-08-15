# Workflow production cutover assumed a host Node runtime

## Symptom and evidence

The c290 server read-only preflight found the live six-service stack, TLS,
backup, disabled Workflow flags, absent candidate schema and production ports
healthy, but the host had neither `node` nor `nodejs`. The frozen cutover needs
Node before backup to verify the deployment/source manifests and later to run
the fixed temporary acceptance asset, so it stopped with zero remote writes.
The authoritative local report is
`output/workflow-production-c290-preflight-blocked-20260808T074734Z/report.json`
(SHA-256 `68d5086891edd01c23a402b05aa707473cd54cbfdd33157304a29402ada87ca4`).

## Root cause

The deployment set pinned every application image and script but treated a
host JavaScript runtime as an undeclared prerequisite. Installing a system
package, changing `PATH`, selecting a caller URL/version, or uploading an
unmanifested wrapper would move the trust boundary outside the release.

## Candidate fix

The deployment bundle now carries the official Node.js v24.18.1 Linux x64
archive and official `SHASUMS256.txt`. `workflow-node-runtime.sh` accepts no
version or source URL, validates the fixed source owner/mode/link count/size and
SHA, checks Linux x86-64, kernel 4.18+, glibc 2.28+ and disk space, then atomically
places only the verified `bin/node` under the release-scoped
`.workflow-runtime` directory. It never installs or overwrites system Node.

Every host JavaScript call in `workflow-production-cutover.sh` uses the one
absolute returned path. Production rejects runtime overrides. The existing
isolated-acceptance mode has a second explicit runtime gate that accepts only a
canonical, approved-owner, mode-0755 file with the frozen Windows acceptance
binary size, SHA and `v24.18.1|win32|x64` identity; it exists only to exercise
the unchanged full cutover from Docker Desktop and is not part of production
Compose or application environment.

## Production owner-contract failure and replacement

The later `49255` release bundle and preparer passed independent A-E and were
atomically published on the server. The only cutover call then stopped before
evidence, backup, migration or service mutation with `Workflow Node installed
runtime metadata is invalid`. The preparer had run as root with the approved
sudo caller and the helper had installed the runtime as `root:root 0555`, while
cutover later ran as deployment UID/GID `1000:1000` and expected that owner.
The round-two read-only report SHA-256 is
`e9b53be05c64f768a8a2bc70db53c1da2752ce544b048cdac6d737a24699d57c`.
The old six services remained healthy; Workflow flags, schema, service identity
and secret consumers remained zero and catalog transports did not drift. No
rollback was needed and the failed candidate was not retried.

The mismatch came from one helper using two owner facts: source validation
already projected root plus exact `SUDO_UID:SUDO_GID`, but runtime installation
and installed-runtime validation used the process `EUID:id -g`. The candidate
fix keeps a single production projector fixed to `1000:1000`. Root must carry
that exact sudo caller; a non-root caller must itself be exactly `1000:1000`
with no sudo identity. All other identities fail closed. The runtime parent,
home, `bin` and binary are installed and revalidated against that projection;
the binary remains regular, non-symlink, single-link and mode `0555`. Temp
cleanup remains prefix-bounded and survives a failed atomic rename without
masking the original error.

## Verification and remaining gate

The true-Linux Docker regression uses a digest-pinned Ubuntu 24.04 image with
no host `node` in `PATH`. It proves root plus the exact sudo deployment caller
installs a `1000:1000 0555` binary. It also proves missing, corrupt, symlinked,
hard-linked, wrong source/installed owner or mode, invalid caller, existing
target, wrong-version, wrong-architecture, rename and execution-failure cases
stop before the backup marker. Static cutover tests prove manifest/source/
runner calls use the absolute runtime and do not duplicate an installed-owner
exception; existing rollback and Caddy PID1 checks remain present.

Final local evidence uses deployment set
`a03bec7d8d326aebd2d7d7861c1836fd329baa4c0be5b203a287e52aa193d156`.
The 26-case true-Linux runtime report
`output/workflow-node-runtime-linux-candidate.json` has SHA-256
`a1736ded937c41094782012d265307eee05acfaab9a9096a1d16caec97f8ebbc`.
The final bundle/preparer report
`output/workflow-production-release-bundle-linux-49051e50a1/report.json`
has SHA-256
`c0937356e7a18c0916d43d57b8a9e9b92c28f5acfbbcf7f08298a2990b657cc8`
and records the runtime directories as `1000:1000 0755` and binary as
`1000:1000 0555`, link count one. The complete prepared-release success and
injected-failure wrapper report
`output/workflow-production-release-bundle-cutover-38077f75eb/report.json`
has SHA-256
`6c5d734e5cf4bbb67d4f87ee417869eca5d84d47bf37b8625ab9390b45e1cb4d`;
both paths report zero container, network, volume and private fixture residue.

This remains `candidateOnly=true`, `deployable=false`. No server runtime was
uploaded or executed, and c290 authorization is not reusable. Test/release must
perform a new independent A-E run and obtain a new server preflight/cutover
authorization.
