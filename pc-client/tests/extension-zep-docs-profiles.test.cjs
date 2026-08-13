"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EXTENSION_INSTALL_REGISTRY,
  getExtensionInstallProfile
} = require("../shared/extension-install-registry.cjs");

test("Zep Docs exposes three fixed read-only HTTP profiles", () => {
  const expected = {
    "mcp.codex.zep-docs": ["codex-cli", "codex-mcp-toml", true],
    "mcp.claude-code.zep-docs": ["claude-code", "claude-code-mcp-cli", false],
    "mcp.cursor.zep-docs": ["cursor-desktop", "cursor-mcp-json", false]
  };
  for (const [id, [host, adapter, toggles]] of Object.entries(expected)) {
    const profile = getExtensionInstallProfile(id);
    assert.ok(profile);
    assert.equal(profile.extensionId, "zep-docs-mcp");
    assert.equal(profile.hostProductId, host);
    assert.equal(profile.adapterId, adapter);
    assert.equal(profile.serverId, "zepDocs");
    assert.equal(profile.transport, "streamable-http");
    assert.deepEqual(profile.entry, { url: "https://docs-mcp.getzep.com/mcp" });
    assert.deepEqual(profile.remoteCapabilities, ["documentation-search", "page-read"]);
    assert.deepEqual(profile.permissions, ["read"]);
    assert.equal(profile.capabilities.includes("enable"), toggles);
    assert.equal(profile.capabilities.includes("disable"), toggles);
    for (const field of ["command", "args", "env", "headers", "credentials", "script"]) {
      assert.equal(Object.hasOwn(profile, field), false, `${id}:${field}`);
    }
  }
  assert.equal(Object.keys(EXTENSION_INSTALL_REGISTRY).filter((id) => id.endsWith("zep-docs")).length, 3);
});
