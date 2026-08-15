# Official MCP + Connector + Plugin small batch 2 research

## Decision

This candidate freezes one new official MCP resource: `microsoft-learn-mcp-server`. It is a Microsoft-operated rolling GA service for public documentation and code-sample retrieval. The batch stays resource-link-only and does not configure or connect any host.

The candidate was semantically deduplicated against active7 resource identity and every JSON file under `docs/` whose basename contains `candidate`, `review`, or `index`. The scan compares normalized IDs, names, and canonical identity fields rather than arbitrary prose or numeric order values. No collision was found for the resource ID, name, or canonical key.

## First-party evidence

- Microsoft describes Learn MCP as a remote Streamable HTTP service that searches documentation, fetches complete articles, and searches code samples. It contains public documentation rather than training or profile data, and requires no authentication. [Microsoft Learn MCP overview](https://learn.microsoft.com/en-us/training/support/mcp)
- Microsoft documents VS Code with GitHub Copilot as the concrete getting-started host. This candidate conservatively maps only the existing `microsoft-vscode` CompatibleHost. [Microsoft Learn MCP getting started](https://learn.microsoft.com/en-us/training/support/mcp-get-started)
- Microsoft records general availability on 2025-11-07. Because the hosted service and tool schemas can change, the candidate uses `rolling-ga-2025-11-07`, not a fabricated fixed binary version. [Microsoft Learn MCP release notes](https://learn.microsoft.com/en-us/training/support/mcp-release-notes)
- Use is governed by Microsoft Learn Terms of Use, recorded as `service-terms`; the hosted service is not mislabeled with the repository's code or documentation license. [Microsoft Learn Terms of Use](https://learn.microsoft.com/en-us/legal/termsofuse)
- VS Code's official MCP management documentation permits users to manage, disable, or uninstall servers. The candidate therefore describes only a user-side host removal path and does not claim a Microsoft-side OAuth revocation flow; authentication is not required. [VS Code MCP management](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

## Deferred and excluded

- ElevenLabs MCP: official repository and MIT license exist, but Python/uvx execution, API-key handling, audio generation, and lifecycle ownership need a separate runtime review.
- SonarQube MCP Server: official repository and releases exist, but Docker/Java execution, user tokens, writable storage, telemetry, and lifecycle ownership need a separate runtime review.
- Microsoft Release Communications MCP also has strong first-party, no-auth, read-only evidence. It was not added because one resource closes this batch and no count target justifies expanding it.
- Plugin count is zero. The Microsoft Learn plugin shares this MCP capability, while an independent fixed plugin release, license mapping, and dynamic-execution contract were not reviewed here.

## TDD and boundary

- RED: with the focused test present and the candidate absent, `node --test --test-reporter=spec tests/mcp-connector-official-small-batch2-active7-candidate.test.cjs` failed `0/1` with `ENOENT` for the exact candidate path.
- A subsequent fixture correction added the metadata fields already required by the existing catalog validator; this was not counted as product RED.
- GREEN: the same focused command passed `1/1`.
- Recursive key scanning rejects `endpoint`, `command`, `args`, `env`, `headers`, `credentials`, `token`, `apiKey`, `install`, `runtime`, `script`, `executable`, `shell`, `powershell`, and `cmd` at every candidate depth.
- No active catalog, state, channel, release, draft-save, signature, publication, package, App, schema, or server path was written.

