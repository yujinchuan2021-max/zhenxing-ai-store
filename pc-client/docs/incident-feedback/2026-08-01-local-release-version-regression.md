# Local acceptance packaging regressed the client version

## User-visible failure

After an earlier `0.1.6` release, a newly generated local acceptance package was named and branded `0.1.5`, even though it contained newer code.

## Reproduction

`node --test tests/local-release-version.test.cjs` compared the local Electron build metadata with `package.json` and failed deterministically:

```text
'0.1.5'
-'0.1.15'
```

## Evidence

- Historical release backups contain the monotonic sequence from `0.1.6` through `0.1.15`.
- The source package version before this fix was `0.1.15`.
- The active update release also advertised `0.1.15`.
- `electron-builder.local-release.cjs` and the acceptance verifier independently defaulted to the stale bootstrap value `0.1.5`.
- The output directory retained historical `0.1.5`, `0.1.6`, and `0.1.14` artifacts, so file presence alone did not identify the current build.

## Root cause

The project had two default version authorities. Normal packaging used `package.json`, while local acceptance packaging silently replaced it with an old hard-coded version. Release preparation and client packaging could therefore disagree while both commands succeeded.

## Fix

- `package.json` is the only default client version authority.
- Local acceptance packaging and its verifier now inherit `package.json.version`.
- An environment override remains available only for explicit upgrade-fixture testing.
- The OpenClaw uninstall fix advances the client to `0.1.16`.
- A regression test rejects any future default-version mismatch.

## Acceptance boundary

The corrected `0.1.16` normal installer, release manifest, local acceptance installer, and portable client must all report the same version before handoff.

## Final verification

- Source package, local build metadata, signed update envelope, and release manifest all report `0.1.16`.
- Both normal and local-acceptance Setup/Portable PE metadata report `0.1.16`.
- The packaged-client acceptance test loaded signed remote catalog version 29 with 49 vendors and reported `currentVersion: 0.1.16`.
- The installed `C:\Program Files\AI Hub\AI Hub.exe` and its uninstall registry entry both report `0.1.16`.
- Superseded top-level artifacts were moved into `_archive/before-0.1.16`; only `0.1.16` remains at the release roots.

## Release-gate follow-up

- Packaging now creates a same-version `BUILD.json` containing the exact artifact sizes, SHA-256 values, Git revision, tag and dirty state.
- Release preparation rejects a filename version or artifact hash that differs from that build record.
- The release bundle publishes a separate `build-provenance.json` signed by the update key, without changing the update payload understood by already-installed clients.
- Production preparation additionally requires a clean checkout at the exact `v<version>` tag and the same Git revision recorded when the installer was built.
