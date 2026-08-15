# Community Skill v2 active7 production cutover — fail-closed report

Status: **blocked; no production switch**.

## Verified baseline

- Remote v2 remains `catalog-v00000006-567e671621f1-3dcee587` / version 6.
- Remote state SHA remains `abffc088a113160ee85fb0efaead8ddff0230021992c9252df82453e396490a9`.
- Public v2 release was independently read and Ed25519-verified as release6 (615 products, 146 resources, 513 targets, 4 stores).
- v1 remains `catalog-v00000072-e286516335da-a8b62a49` / version 72.

## Failure and safety result

The approved `admin@47.236.62.189` path could access Docker, but the running admin image (`zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9`) rejects the active7 signed catalog during `verifyCatalogRelease` because its older `shared/catalog.cjs` does not accept the B1 resource field on `obra-superpowers-brainstorming`. This is a server-contract/image mismatch, not a permission failure. The state-update script failed before creating or renaming its temporary state file.

No API publish, channel pointer update, state atomic switch, v1 change, service restart, DNS change, package, or client change occurred. The uploaded release and unreferenced volume copy were removed after the failed preflight; the remote state SHA was rechecked unchanged.

## Backups and transport evidence

- Admin-readable backup: `/opt/zhenxing-ai/shared/backups/catalog-v2-pre-active7-admin-20260808T184010Z/`
- Backup files: remote state SHA `abffc088…490a9`, active6 release SHA `c1ea9b76…e139`, channel SHA `195cb425…baba2`.
- Local active7 exact envelope SHA: `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4`.
- First remote write did occur before the username correction: an initial root SSH created a backup and staged the exact release. Subsequent checks and cleanup used only strict-known-hosts `admin` SSH; no root operation was repeated.
- Contract-action counts (read-only probes excluded): backup creations 2 (initial root backup plus admin-owned copy), exact release staging 2, cleanup 1, publish API calls 0, atomic switches 0.

Next action requires the server/admin image to be upgraded or otherwise independently approved to the catalog schema that validates active7; do not retry this cutover against the current image.
