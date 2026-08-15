# v2 active5 / 0.1.52 — 265 desktop acquisition discovery

- Scope: exact 0.1.52 Portable, isolated profile, v2 remote catalog active5. This is a discovery run, **not a deliverable package or user-machine acceptance**.
- Catalog observed by packaged client: source `remote`, channel `v2`, catalogVersion `5`, 375 vendors, 615 products.
- Row integrity: 265 rows, 265 unique productIds, no duplicates. Final classification: **140 PASS / 103 BLOCKED / 22 FAIL**.
- Direct/download rows: 104 total. 86 received real Electron-authorized data and completed pause + refresh/retry, but remain BLOCKED because the native discard confirmation was deliberately not auto-accepted. 18 direct rows failed before that lifecycle point.
- Catalog/artifact failures (7): `alibaba-quark-ai-browser`, `fireflies-desktop`, `upscayl-desktop`, `blender` (47,755-byte completion versus reserved 536,918,667 bytes), `pieces-for-developers`, `zoom-workplace`, and `anytype-desktop` (last three returned HTTP 404 from configured official pages).
- Client/harness failures (15): missing one-click control for `deepl-desktop`, `canva-windows`, four Wondershare products, `xmind-ai`, `docker-desktop`, `craft-desktop`, `evernote-desktop`, `taskade-workspace`, `teamviewer-remote-ai`, and `audacity-desktop`; renderer row navigation failed for `asana-work-graph` and `clickup-workspace`.
- External blockers (17): 14 bounded-probe fetch failures plus `opera-one` HTTP 451, `vrew-desktop` HTTP 503, and `gitbutler-desktop` HTTP 500. Login-required pages returning expected unauthenticated 403 retain PASS for their external-entry UI action; no login was attempted.
- No third-party installer was completed or launched, no catalog/release state was modified, and no cloud upload occurred.

The adjacent `-final.csv` preserves one evidence row per product. The original CSV is retained unchanged as the raw harness output; this final classification corrects its treatment of configured HTTP 404 and temporary external HTTP failures.
