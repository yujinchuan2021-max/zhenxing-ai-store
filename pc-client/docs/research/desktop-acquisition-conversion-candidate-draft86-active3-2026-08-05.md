# Desktop acquisition conversion candidate — draft 86 / v2 active 3

Status: candidate-only; not saved, signed, or published.

Source is `windows-desktop-official-download-coverage-draft86-active3-2026-08-05.json`, checked against the authoritative revision-store draft 86 (615 products) and v2 release `catalog-v00000003-e36977a17c2d-ba2c3b1b`.

## Stable catalog contract

`product.officialDownload` remains the display-only acquisition field. Its only fields are `url`, `kind`, optional `coveredProductIds`, and optional short plain-text `note`. Allowed kinds are `vendor-bootstrap`, `download-page`, `fixed-redirect`, `stable-redirect`, `store`, `login-required`, `manual-selector`, and `no-windows`. The backend derives button text and external steps solely from `kind`; catalog data cannot supply labels, HTML, commands, arguments, headers, credentials, scripts, or host allowlists.

Every URL is HTTPS, credential-free, at most 2048 characters, and must use the product website's or reviewed first-party evidence origin (Microsoft Store remains accepted when it is the actual URL). `vendor-bootstrap` may identify at most 20 covered product IDs. It only opens the vendor flow: it does not start a download task or create a product installation receipt. `no-windows` is informational only and requires conversion to `web-link`, with any desktop entry point removed.

## Candidate result

- 117 proposed changes: 88 `download-page`, 5 `vendor-bootstrap` (the five Adobe products), 18 `login-required`, 3 `store`, 1 `manual-selector`, and 2 `no-windows` corrections.
- 87 direct-artifact records retain an already legal canonical or client-managed download; no existing download binding is overwritten. `navicat-premium` uses its verified first-party download-selection page as a display-only `download-page`; its rejected `support-download` pseudo-filename remains evidence only and is not written to the catalog.
- 57 existing acquisitions are already exact; 4 client-managed products remain no-op: `chatgpt-desktop`, `claude-desktop`, `comfy-desktop`, and `letta-agent`.
- `meitu-ultra` and `notion-desktop` become `web-link` / `web` with informational `no-windows`; desktop-official changes 174 → 172 and web 246 → 248. All other product identities and resources remain unchanged.
- In-memory `validateCatalog` and `validatePublication` both pass. Full per-product mapping, no-ops, source release identity, and expected counts are in the adjacent JSON file.

No direct-artifact candidate is newly bound in this conversion; `stable-redirect` has zero source records.
