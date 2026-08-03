# Incident feedback — next catalog expansion

## Trigger

The catalog needed more current Agent/developer products and more vendors whose products can be connected to AI clients. Earlier snapshots also made it easy to confuse a Web/IDE entry with a Windows desktop product or to duplicate a vendor record.

## Prevention rules added

1. Research candidates are deduplicated against the live catalog before implementation.
2. CLI is a separate `cli-official` product; IDE plugins and Web control planes are not labeled as Windows desktop apps.
3. Connectable cards use `ai-connectable` and remain link-only until their OAuth, MCP, credential, permission, and destructive-action contracts are reviewed.
4. The expansion script only writes vendor metadata when creating a new vendor. Existing backend-managed vendor order, enablement, copy, color, icon, and product order/enablement are preserved.
5. Every new item must have a first-party product or documentation URL and a current product boundary description.
6. Graphical Windows products enter only the fixed `desktop-official` module until a separate lifecycle audit approves managed execution.
7. The six new official MCP records are `resource-link` only. Their OAuth, permissions, destructive actions, local servers, and credentials are documented but not executed by the client.
8. Documentation MCPs (AssemblyAI and LiveKit), a product-operation MCP (Docling), and an Alpha proxy (Tailscale Aperture) use separate names and descriptions so the UI never overstates what an integration can control.

## Evidence

- Research: `docs/research/2026-08-03-next-agent-developer-tools.md`
- Research: `docs/research/2026-08-03-connectable-media-remote-office-gaps.md`
- Current snapshot: `docs/catalog-expansion-status-2026-08-03.md`
- Focused regression suites cover exact identity search, directory isolation, fixed modules, and installer launch behavior.
