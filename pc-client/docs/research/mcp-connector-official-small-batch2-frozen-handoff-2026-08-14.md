# Official MCP + Connector + Plugin small batch 2 frozen handoff

Candidate-only and not publishable. Ready is exactly one MCP, Connector is zero, Plugin is zero, and two execution-heavy MCP leads are deferred. This handoff authorizes no catalog consumption or deployment.

## Evidence boundary

- Dedicated RED: `0/1`, exact missing-candidate `ENOENT`.
- Dedicated GREEN: `1/1`.
- Related resource contract tests are reported separately and are not added to the dedicated count.
- Microsoft Learn is a rolling GA, no-auth, public-document service. The candidate exposes only a link to official instructions and one existing CompatibleHost (`microsoft-vscode`).
- Publisher is factual (`Microsoft`), the Resource remains canonical, and no vendor-parent resource layer is created.
- User-side removal is limited to VS Code's documented server management; no OAuth revoke or completed-connection claim is made.

## Frozen SHA-256

SHA values below are computed after the candidate, research, and focused test are final. Any later byte change requires a new audit.

- `f2df99357f958ef3dd7fe512640cfc5a3eda9e66ceff788ea1cda7d08afe2962`  `docs/research/mcp-connector-official-small-batch2-candidate-active7-2026-08-14.json`
- `9c97b3073e803e13a57a08cd33f4357081af1e300592e7da5d3f20c65cdad161`  `docs/research/mcp-connector-official-small-batch2-research-2026-08-14.md`
- `64fe6246a85cae5264b7a16f23fd588533d5fc6485707177c6bcb24689d9fadc`  `tests/mcp-connector-official-small-batch2-active7-candidate.test.cjs`

STOP after independent read-only audit. No active catalog, state, channel, release, save, sign, publish, package, App, schema, or server path was changed.
