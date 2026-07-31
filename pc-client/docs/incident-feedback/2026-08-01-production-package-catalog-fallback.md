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
