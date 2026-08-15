# OpenAI Docs MCP Claude/Cursor target restoration candidate

## Evidence

- authoritative draft revision81/active v71 is the authority; the disk draft has two additional targets for `openai-codex-mcp-config`.
- Both targets cross-check exactly against the resource record and fixed client registry profiles: Claude Code uses `claude-code-mcp-cli`; Cursor uses `cursor-mcp-json`; both are user-scope URL-only MCP targets.

## Decision

The two targets are recorded as candidate-only in `docs/resource-profile-restoration-candidate.json`. No catalog, state, history, install, or publication was changed. They remain blocked until the authority synchronization issue is explicitly released by the CTO.

## Regression gate

`tests/resource-profile-restoration.test.cjs` checks the two candidate profiles against the resource and registry, rejects executable/header fields, and preserves the separate three-host coverage test.
