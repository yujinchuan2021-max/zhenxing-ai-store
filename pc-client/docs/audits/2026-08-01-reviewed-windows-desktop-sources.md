# Reviewed Windows desktop source audit

Date: 2026-08-01

## Scope

All 26 products published as `desktop-reviewed` in the local catalog were checked through their client-owned managed-download plans. The audit requested only bytes 0-15 and did not download complete installers.

## Result

- 26/26 official sources returned an accepted HTTP 200 or 206 response.
- 26/26 final URLs used HTTPS and ended on a locally reviewed exact host.
- Perplexity Comet's R2 object was mislabeled as HTML but contained Windows MZ executable magic; its exact official redirect host is now reviewed locally.
- AnythingLLM did not declare a content type; its HTTPS host, response status, and payload sample passed. This remains a non-blocking warning.

The machine-readable local result is generated at `output/audits/latest-desktop-source-audit.json` by `npm run audit:desktop-sources`.

## Security boundary

The audit reports source drift but never edits the whitelist. Backend catalog data can select an existing reviewed product profile; it cannot approve a new executable host, signer, hash, command, or uninstall policy.
