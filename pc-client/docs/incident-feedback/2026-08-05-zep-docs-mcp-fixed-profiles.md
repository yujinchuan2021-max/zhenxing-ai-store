# Zep Documentation MCP fixed-profile approval

The client registry now contains three candidate-only fixed profiles for the expected resource `zep-docs-mcp`: Codex (`codex-mcp-toml`), Claude Code (`claude-code-mcp-cli`), and Cursor (`cursor-mcp-json`). All pin the official Streamable HTTP endpoint, read-only documentation capabilities, and no credentials or custom headers.

No catalog, state, history, installation, packaging, or publication changed. Until an authoritative resource record and targets exist, backend catalog authorization must reject these profiles; external/manual host entries remain unmanaged.
