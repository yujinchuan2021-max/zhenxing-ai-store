# Catalog expansion status — 2026-08-03

This addendum supersedes the older numeric snapshots in `development-status.md` for the current local catalog.

## Current backend snapshot

- 375 vendors
- 615 top-level products
- 145 ecosystem resources
- Product modules: 246 `web`, 239 `desktop-official`, 34 `cli-official`, 26 `desktop-reviewed`, 14 managed `cli`, 1 `local-model`, 55 `tutorial`
- Vendor logos: 204 reviewed graphic assets and 171 reviewed letter fallbacks

## Added in this pass

### Agent and developer tools

Amp CLI; Augment Code and Auggie CLI; Qodo; CodeRabbit; Greptile; GitHub Spark; LangSmith; Langfuse; Promptfoo CLI; Daytona Sandboxes and CLI; E2B Sandboxes.

### Existing-vendor AI products

Amazon Q Developer; Gemini Code Assist; JetBrains Junie; Vercel v0; Atlassian Rovo; Microsoft Security Copilot; SAP Joule.

### AI-connectable vendors

Cisco Webex with Cisco AI Assistant; PlayCanvas Editor; Vimeo Platform; Cloudinary Media Platform; ONLYOFFICE DocSpace; Airtable Platform; PandaDoc Workspace.

### Windows desktop products

Superwhisper; screenpipe; PDFgear; UPDF; Vrew; Voice.ai; FineVoice; GitButler; AFFiNE; AppFlowy; DuckDuckGo Browser; Spark Mail; Canary Mail; Movavi Video Editor; CorelDRAW Graphics Suite.

### Ecosystem resources

Added six link-only official MCP records for PlayCanvas, Vimeo, Cloudinary, ONLYOFFICE DocSpace, Airtable, and PandaDoc. Their target relationships expose only the fixed `resource-link` module; no connector is marked installed or physically accepted.

### Additional Agent and connectable coverage

Braintrust, AgentOps, and Helicone were added as Web developer platforms. mod.io, AssemblyAI, LiveKit, AnyDesk, Tripo OpenAPI, Docling, Tailscale Aperture, and Spline were added with their exact API/MCP/Alpha boundaries. Four additional link-only MCP records cover AssemblyAI documentation, LiveKit documentation, Docling MCP, and the Tailscale Aperture Alpha proxy.

### Final reviewed backlog closure

The final closure adds 22 vendors, 56 products, and 17 ecosystem resources relative to the 353 / 559 / 128 baseline. It covers the remaining reviewed agent, developer, desktop, data, enterprise, design, research, and connectable-product gaps documented in:

- `docs/research/2026-08-03-final-gap-scan.md`
- `docs/research/2026-08-03-catalog-backlog-closure.md`
- `docs/research/2026-08-03-official-logo-backlog.md`

Factory Droids, Airtable, and Lovable now keep Web and Windows entry points on one visual-product card. Their CLI products remain separate cards. Adobe Creative Cloud now exposes its official Windows download page. Coda's stable catalog identity now displays as Superhuman Docs AI while retaining exact search compatibility for both `Superhuman Docs` and `Coda AI`.

Superhuman Go remains excluded because its official marketing page still says the desktop app is coming soon while an official help page describes Windows installation. This conflict is locked by a release test instead of presenting an uncertain Windows product as available.

## Boundary decisions

- The backend adds catalog records and fixed module parameters only. It does not add commands, arbitrary scripts, installer URLs, hashes, environment probes, or local install profiles.
- CLI products remain separate cards from Web and desktop products. IDE plugins are described as plugins/online tools, not Windows desktop clients.
- Connectable products are link-only in this pass. MCP/OAuth scopes, credentials, destructive operations, and local server execution require a later resource-module review.
- Existing vendor ordering, enablement, copy, colors, logos, product ordering, and product enablement are preserved when the expansion script is rerun.
- Official sources were recorded in `docs/research/2026-08-03-next-agent-developer-tools.md`, `docs/research/2026-08-03-connectable-media-remote-office-gaps.md`, and `docs/research/2026-08-03-windows-desktop-product-expansion-next-batch.md`.

## Verification

- `npm run catalog:expand:closure` is idempotent for the catalog and fallback state.
- Re-running the official-logo importer produces no changes after the reviewed assets are present.
- All 55 newly imported icon files are referenced exactly once by the catalog, their content hashes match their filenames and catalog metadata, and all 204 catalog icon references resolve to real files.
- Two generated logo contact sheets were visually reviewed. Mastra and Zendesk rendering defects found in the first pass were replaced with official PNG assets and the sheets were reviewed again.
- 53 focused catalog, search, module, resource, and logo tests pass.
- The complete release test suite passes.
- The production Vite build passes; its only warning is the existing large JavaScript chunk warning.
- The published Ed25519 envelope verifies with the backend's trusted public key, and its signed payload is canonically identical to `/catalog-v1.json`.
- The actual client at `http://127.0.0.1:5174/` was reloaded and checked through rendered UI: Skales, Open Interpreter Desktop, Superhuman Docs, and Coda AI exact search work; Factory, Airtable, and Lovable expose the intended combined visual-product entry points; Mastra, Zendesk, OpenHands, and AnyDesk logos load with valid dimensions; the browser console has no errors.
- No Windows client package was rebuilt for this backend-only catalog change.

## Local publication

- Backend draft revision: 63
- Active catalog version: 60
- Release ID: `catalog-v00000060-511047eb0ca6-7ed548b9`
- Catalog payload SHA-256: `511047eb0ca6a86ead7e8ee87b52167287b41d803cdea248cef0791b785549ab`
- Signed release file SHA-256: `c02a84011865280a06b535fab1aa3e2c1dabb4a8f1c023c15da142cdecda9401`
- Signing key ID: `catalog-4aa4d9e6b67e0791`
- Local backend health: `http://127.0.0.1:4173/health` → `{"status":"ok"}`
- Publish warnings are expected: client auto-update is disabled, 171 vendors use reviewed letter fallbacks, and 27 managed desktop products still await physical acceptance.
