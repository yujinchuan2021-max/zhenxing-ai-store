# Packaged client silently fell back to eight built-in vendors

## User-visible failure

After installing a new client build, the All Vendors page showed only eight vendors and searching for OpenClaw returned no result, even though the Docker backend still published the complete catalog.

## Reproduction evidence

- The Docker release server published catalog version 29 with 49 vendors.
- The verified client cache also contained catalog version 29 with 49 vendors.
- The installed client contained an empty `resources/catalog/channel.json`, so it disabled the backend catalog and rendered the small built-in development catalog.

## Root cause

The local Docker acceptance package and the production package used the same product identity and nearly identical artifact names. Production channels are intentionally disabled until a real server exists, but the production packaging command still allowed that package to be generated and installed. The renderer then treated a missing packaged catalog as permission to show development seed data.

## Fix

- Local Docker artifacts use the distinct `AI-Hub-Local-*` name.
- Local and production packaging now share one release-package policy module that verifies both catalog and update channels before packaging.
- Production packaging is blocked while the formal server channels are disabled.
- A packaged client uses only a remote signed catalog or its matching verified cache. If neither exists, it reports the directory as unavailable instead of showing built-in seed data.
- Local release preparation and verification now use the exact Local installer artifact.

## Verification

- Docker release server: catalog version 29, 49 vendors, update version 0.1.18.
- Packaged portable client: remote catalog version 29 with 49 vendors.
- Installed `C:\Program Files\AI Hub\AI Hub.exe`: remote catalog version 29 with 49 vendors.
- Real Windows UI: All Vendors displays `49 个厂商` and includes OpenClaw with three products.
- Production packaging fails closed while its server channel remains unconfigured.

## Recurrence on 2026-08-02

### User-visible failure

Both `ZhenXing-AI-0.1.27-Windows-x64-Portable.exe` and the matching Setup package opened with zero vendors and reported that the backend catalog channel was not configured.

### Evidence and root cause

- The Docker catalog endpoint was healthy and published catalog version 34 with 49 vendors.
- The broken artifacts contained the empty production `resources/catalog/channel.json` and `resources/updates/channel.json`.
- The review build called Electron Builder directly to work around a Windows output-directory lock. That bypassed `scripts/package-windows.cjs`, including its release-channel gate.
- The packaged runtime correctly failed closed. Re-enabling the renderer's built-in catalog would have hidden the packaging error and weakened backend revocation and installation authorization.

### Fix and prevention gate

- Electron Builder now runs `scripts/electron-builder-before-pack.cjs` for every package, including direct CLI calls.
- A production package is rejected while production catalog or update channels are disabled.
- A Local package is accepted only when its effective resources contain the signed Docker catalog and update channels.
- `scripts/check-packaged-catalog.mjs` launches a Portable artifact with an isolated profile and rejects the exact `source=unavailable/vendors=0` symptom.
- The replacement review artifacts use the unambiguous `ZhenXing-AI-Local-*` names.

### Verification

- The old Portable artifact deterministically failed with `source=unavailable`, `vendors=0`, and `后台目录通道尚未配置`.
- A direct production Electron Builder call now stops in `beforePack` instead of creating an artifact.
- The replacement Local Portable artifact loaded signed catalog version 34 with 49 vendors from `https://localhost:4443`.
- Setup and Portable were generated in the same guarded Electron Builder run from the same `win-unpacked` payload.

### Remaining acceptance boundary

The Local artifacts require this computer's Docker release service and are only for local review. External distribution remains blocked until the production domain, HTTPS certificate, trusted release keys, and Windows code-signing certificate are configured.
