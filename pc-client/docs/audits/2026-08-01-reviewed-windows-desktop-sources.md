# Reviewed Windows desktop source audit

Date: 2026-08-01

## Scope

All 26 products published as `desktop-reviewed` in the local catalog were checked through their client-owned managed-download plans. The audit requested only bytes 0-15 and did not download complete installers.

The client has 27 managed Windows installer entries in total. Ollama is the additional entry and is classified through the local-model module rather than `desktop-reviewed`, so it is outside this catalog-source count.

## Result

- 26/26 official sources returned an accepted HTTP 200 or 206 response.
- 26/26 final URLs used HTTPS and ended on a locally reviewed exact host.
- Perplexity Comet's R2 object was mislabeled as HTML but contained Windows MZ executable magic; its exact official redirect host is now reviewed locally.
- AnythingLLM did not declare a content type; its HTTPS host, response status, and payload sample passed. This remains a non-blocking warning.

Four drifted rolling packages were also downloaded completely and re-audited before the local whitelist was changed:

| Product | Version | SHA-256 | Authenticode |
| --- | --- | --- | --- |
| Cursor | 3.14.7 | `93b3ad1b9971c8ff9be18fc9c46d592749e47ea6d2e3711efe6d5a9d4091877f` | Valid, Anysphere, Inc. |
| Kimi Work | 3.1.6 | `14edbc1bae32880bebef4937e918695b4ccb36077c084edf0eacc66cc811aec5` | Valid, 北京月之暗面科技有限公司 |
| 千问 | 3.7.5.145 | `5e6c92f79eb0ddc735df6365dc5646b6401fb2f7017c3552d27740a36f8f2921` | Valid, ALIBABA (CHINA) NETWORK TECHNOLOGY CO.,LTD. |
| WorkBuddy | 5.3.8 | `c111bc3f54a0e53fa04924313ae660125eebffafcd5ac7722da7c3c03402cb7a` | Valid, Tencent Technology (Shenzhen) Company Limited |

Those temporary audit installers were deleted after their evidence was recorded.

The machine-readable local result is generated at `output/audits/latest-desktop-source-audit.json` by `npm run audit:desktop-sources`.

## Security boundary

The audit reports source drift but never edits the whitelist. Backend catalog data can select an existing reviewed product profile; it cannot approve a new executable host, signer, hash, command, or uninstall policy.
