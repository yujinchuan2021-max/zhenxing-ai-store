"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("../admin/data/catalog-v1.json");
const {
  getExtensionInstallProfile
} = require("../shared/extension-install-registry.cjs");

test("OpenAI Developer Docs MCP has three fixed independent local targets", () => {
  const resource = catalog.resources.find(
    (entry) => entry.id === "openai-codex-mcp-config"
  );
  const targets = new Map(
    resource.targets.map((target) => [target.installProfileId, target])
  );
  assert.deepEqual([...targets.keys()], [
    "mcp.codex.openai-developer-docs",
    "mcp.claude-code.openai-developer-docs",
    "mcp.cursor.openai-developer-docs"
  ]);

  for (const profileId of targets.keys()) {
    const profile = getExtensionInstallProfile(profileId);
    const target = targets.get(profileId);
    assert.equal(profile.extensionId, resource.id);
    assert.equal(profile.hostProductId, target.productId);
    assert.deepEqual(target.capabilities, [...profile.capabilities]);
    assert.deepEqual(profile.entry, {
      url: "https://developers.openai.com/mcp"
    });
    for (const field of ["command", "args", "env", "headers"]) {
      assert.equal(Object.hasOwn(profile, field), false, `${profileId}:${field}`);
    }
  }

  for (const profileId of [
    "mcp.claude-code.openai-developer-docs",
    "mcp.cursor.openai-developer-docs"
  ]) {
    assert.equal(targets.get(profileId).capabilities.includes("enable"), false);
    assert.equal(targets.get(profileId).capabilities.includes("disable"), false);
  }
});
