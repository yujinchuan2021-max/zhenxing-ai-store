# Catalog expansion status — 2026-08-03

This addendum supersedes the older numeric snapshots in `development-status.md` for the current local catalog.

## Current backend snapshot

- 353 vendors
- 559 top-level products
- 128 ecosystem resources
- Product modules: 211 `web`, 225 `desktop-official`, 30 `cli-official`, 26 `desktop-reviewed`, 14 managed `cli`, 1 `local-model`, 52 `tutorial`

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

## Boundary decisions

- The backend adds catalog records and fixed module parameters only. It does not add commands, arbitrary scripts, installer URLs, hashes, environment probes, or local install profiles.
- CLI products remain separate cards from Web and desktop products. IDE plugins are described as plugins/online tools, not Windows desktop clients.
- Connectable products are link-only in this pass. MCP/OAuth scopes, credentials, destructive operations, and local server execution require a later resource-module review.
- Existing vendor ordering, enablement, copy, colors, logos, product ordering, and product enablement are preserved when the expansion script is rerun.
- Official sources were recorded in `docs/research/2026-08-03-next-agent-developer-tools.md`, `docs/research/2026-08-03-connectable-media-remote-office-gaps.md`, and `docs/research/2026-08-03-windows-desktop-product-expansion-next-batch.md`.

## Verification

- `npm run catalog:expand:industry` is idempotent for the catalog state.
- Catalog completeness, search, connectable-directory, and installer-launch focused tests pass.
- No Windows client package was rebuilt for this backend-only catalog change.

## Local publication

- Backend draft revision: 62
- Active catalog version: 59
- Release ID: `catalog-v00000059-6f204c9ee093-f82b7f1b`
- Local backend health: `http://127.0.0.1:4173/health` → `{"status":"ok"}`
- Publish warnings are expected: client auto-update is disabled, 204 vendors use reviewed letter fallbacks, and 27 managed desktop products still await physical acceptance.
