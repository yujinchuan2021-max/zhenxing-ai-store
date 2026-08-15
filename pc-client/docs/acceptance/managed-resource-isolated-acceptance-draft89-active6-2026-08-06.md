# Fixed managed resource isolated acceptance

Scope: draft 89 / signed v2 active catalog 6. The live signed envelope verified
with `catalog/channel.local-v2.json` contains exactly these five fixed local
profiles: three OpenAI Developer Docs MCP targets, one Codex ChatGPT Apps Skill,
and one Claude Commit Commands Plugin. No real Codex, Claude Code, Cursor,
credential store, or user receipt directory is used.

Run:

```powershell
node --test --test-reporter=spec tests/managed-resource-isolated-acceptance.test.cjs
```

| Profile | Adapter | Lifecycle | Manual same-name | Primary receipt loss |
| --- | --- | --- | --- | --- |
| `skill.codex.chatgpt-apps` | directory snapshot | PASS: detect/install/recheck/idempotence/update/repair/uninstall | PASS: external and no mutation | PASS: external and uninstall unavailable |
| `mcp.codex.openai-developer-docs` | Codex TOML MCP | PASS, including disable/enable | PASS: external and no mutation | PASS: external and uninstall unavailable |
| `mcp.claude-code.openai-developer-docs` | Claude user-scope MCP CLI | PASS | PASS: external and no mutation | PASS: external and uninstall unavailable |
| `mcp.cursor.openai-developer-docs` | Cursor JSON MCP | PASS | PASS: external and no mutation | PASS: external and uninstall unavailable |
| `plugin.claude.commit-commands` | Claude plugin CLI | PASS, including disable/enable | PASS: external and no mutation | PASS: owned instance marker preserves management and permits conservative uninstall |

The harness injects a fresh `%TEMP%\\aihub-managed-resource-acceptance-*`
root for every row, fake shell-free Claude host responses, explicit temporary
Codex/Cursor configuration paths, and temporary receipts. It never calls the
real host binaries or opens a real user directory. This is isolated lifecycle
acceptance, not user-machine acceptance: real host CLI compatibility,
marketplace/network behavior, and native-host user flows still require manual
device validation.
