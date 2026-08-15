"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { EXTENSION_INSTALL_REGISTRY } = require("../shared/extension-install-registry.cjs");
const { createExtensionRuntime } = require("../shared/extension-runtime.cjs");
const { createCodexMcpRuntime } = require("../shared/extension-mcp-runtime.cjs");
const { createClaudeCodeMcpRuntime } = require("../shared/extension-claude-mcp-runtime.cjs");
const { createCursorMcpRuntime } = require("../shared/extension-cursor-mcp-runtime.cjs");
const { createClaudePluginRuntime } = require("../shared/extension-plugin-runtime.cjs");
const { createExtensionResourceManager } = require("../shared/extension-resource-manager.cjs");

const PROFILE_IDS = Object.freeze([
  "skill.codex.chatgpt-apps",
  "mcp.codex.openai-developer-docs",
  "mcp.claude-code.openai-developer-docs",
  "mcp.cursor.openai-developer-docs",
  "plugin.claude.commit-commands"
]);

function isolatedFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-managed-resource-acceptance-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const userDataRoot = path.join(root, "user-data");
  const receiptsRoot = path.join(userDataRoot, "extension-receipts");
  const codexConfigPath = path.join(root, "hosts", "codex", "config.toml");
  const codexSkillsRoot = path.join(root, "hosts", "codex", "skills");
  const cursorConfigPath = path.join(root, "hosts", "cursor", "mcp.json");
  const pluginRoot = path.join(root, "hosts", "claude", "plugins");
  const pluginRegistryPath = path.join(pluginRoot, "installed_plugins.json");
  const pluginOwnershipRoot = path.join(pluginRoot, "data");
  fs.mkdirSync(userDataRoot);
  const profiles = Object.fromEntries(PROFILE_IDS.map((id) => [id, EXTENSION_INSTALL_REGISTRY[id]]));
  const claude = { server: null, plugin: null, marketplace: false, sequence: 0, installedAt: "" };

  function profileLookup(id) {
    return profiles[id] || null;
  }

  function syncPluginRegistry(fresh = false) {
    const profile = profiles["plugin.claude.commit-commands"];
    if (!claude.plugin) {
      if (fs.existsSync(pluginRegistryPath)) fs.unlinkSync(pluginRegistryPath);
      claude.installedAt = "";
      return;
    }
    claude.sequence += 1;
    const timestamp = `2026-08-06T00:00:00.${String(claude.sequence).padStart(3, "0")}Z`;
    if (fresh || !claude.installedAt) claude.installedAt = timestamp;
    fs.mkdirSync(path.dirname(pluginRegistryPath), { recursive: true });
    fs.writeFileSync(pluginRegistryPath, JSON.stringify({
      version: 2,
      plugins: {
        [profile.pluginId]: [{
          scope: "user",
          installPath: path.join(root, "host-cache", profile.versionRef),
          version: profile.versionRef,
          installedAt: claude.installedAt,
          lastUpdated: timestamp
        }]
      }
    }));
  }

  async function runHostCommand({ executable, args }) {
    assert.equal(executable, path.join(root, "hosts", "claude", "claude.exe"));
    if (args[0] === "mcp") {
      const profile = profiles["mcp.claude-code.openai-developer-docs"];
      if (args[1] === "get") {
        return claude.server
          ? { ok: true, stdout: `${profile.serverId}:\n  Scope: ${claude.server.scope}\n  URL: ${claude.server.url}\n` }
          : { ok: false, stdout: "" };
      }
      if (args[1] === "list") {
        return { ok: true, stdout: claude.server ? `${profile.serverId}: ${claude.server.url}\n` : "No MCP servers configured\n" };
      }
      if (args[1] === "add") {
        claude.server = { url: args.at(-1), scope: "User" };
        return { ok: true, stdout: "Added\n" };
      }
      if (args[1] === "remove") {
        claude.server = null;
        return { ok: true, stdout: "Removed\n" };
      }
    }
    if (args.join(" ") === "plugin list --json") {
      return { ok: true, stdout: JSON.stringify({ plugins: claude.plugin ? [claude.plugin] : [] }) };
    }
    if (args.join(" ") === "plugin marketplace list --json") {
      const source = profiles["plugin.claude.commit-commands"].marketplace.source;
      return { ok: true, stdout: JSON.stringify({ marketplaces: claude.marketplace ? [{ source }] : [] }) };
    }
    if (args[0] === "plugin" && args[1] === "marketplace" && args[2] === "add") {
      claude.marketplace = true;
      return { ok: true, stdout: "" };
    }
    if (args[0] === "plugin" && ["install", "update"].includes(args[1])) {
      const profile = profiles["plugin.claude.commit-commands"];
      claude.plugin = { id: profile.pluginId, version: profile.versionRef, enabled: true };
      syncPluginRegistry(args[1] === "install");
      return { ok: true, stdout: "" };
    }
    if (args[0] === "plugin" && ["enable", "disable"].includes(args[1])) {
      claude.plugin.enabled = args[1] === "enable";
      return { ok: true, stdout: "" };
    }
    if (args[0] === "plugin" && args[1] === "uninstall") {
      claude.plugin = null;
      syncPluginRegistry();
      return { ok: true, stdout: "" };
    }
    throw new Error(`unexpected isolated host command: ${args.join(" ")}`);
  }

  const adapters = {
    "directory-snapshot": createExtensionRuntime({
      resourcesRoot: path.join(__dirname, "..", "extension-resources"),
      userDataRoot,
      receiptsRoot,
      targetRoots: { "agent-skills": codexSkillsRoot },
      profileLookup
    }),
    "codex-mcp-toml": createCodexMcpRuntime({ configPath: codexConfigPath, receiptsRoot, profileLookup }),
    "claude-code-mcp-cli": createClaudeCodeMcpRuntime({
      receiptsRoot,
      profileLookup,
      resolveHostExecutable: async () => path.join(root, "hosts", "claude", "claude.exe"),
      runHostCommand
    }),
    "cursor-mcp-json": createCursorMcpRuntime({ configPath: cursorConfigPath, receiptsRoot, profileLookup }),
    "claude-plugin-cli": createClaudePluginRuntime({
      receiptsRoot,
      ownershipRoot: pluginOwnershipRoot,
      registryPath: pluginRegistryPath,
      profileLookup,
      resolveHostExecutable: async () => path.join(root, "hosts", "claude", "claude.exe"),
      runHostCommand,
      randomBytes: () => Buffer.alloc(24, 6)
    })
  };
  const manager = createExtensionResourceManager({
    profileLookup,
    adapters,
    inspectHost: async () => ({ installed: true, detection: "installed" }),
    authorizeAction: async () => ({ ok: true })
  });

  function advanceProfile(id) {
    const profile = profiles[id];
    profiles[id] = profile.sourceManifest
      ? { ...profile, sourceManifest: { ...profile.sourceManifest, versionRef: `${profile.sourceManifest.versionRef}-acceptance` } }
      : { ...profile, versionRef: `${profile.versionRef}-acceptance` };
  }

  function removeManagedTarget(id) {
    const profile = profiles[id];
    switch (profile.adapterId) {
      case "directory-snapshot":
        fs.rmSync(path.join(codexSkillsRoot, profile.targetRelativePath), { recursive: true, force: true });
        break;
      case "codex-mcp-toml":
        fs.writeFileSync(codexConfigPath, "");
        break;
      case "claude-code-mcp-cli":
        claude.server = null;
        break;
      case "cursor-mcp-json": {
        const config = JSON.parse(fs.readFileSync(cursorConfigPath, "utf8"));
        delete config.mcpServers[profile.serverId];
        fs.writeFileSync(cursorConfigPath, JSON.stringify(config));
        break;
      }
      case "claude-plugin-cli":
        claude.plugin = null;
        syncPluginRegistry();
        break;
      default:
        assert.fail(`Unhandled adapter ${profile.adapterId}`);
    }
  }

  function addManualTarget(id) {
    const profile = profiles[id];
    switch (profile.adapterId) {
      case "directory-snapshot":
        fs.mkdirSync(path.join(codexSkillsRoot, profile.targetRelativePath), { recursive: true });
        fs.writeFileSync(path.join(codexSkillsRoot, profile.targetRelativePath, "manual.txt"), "manual");
        break;
      case "codex-mcp-toml":
        fs.mkdirSync(path.dirname(codexConfigPath), { recursive: true });
        fs.writeFileSync(codexConfigPath, `[mcp_servers.${profile.serverId}]\nurl = "${profile.entry.url}"\n`);
        break;
      case "claude-code-mcp-cli":
        claude.server = { url: profile.entry.url, scope: "User" };
        break;
      case "cursor-mcp-json":
        fs.mkdirSync(path.dirname(cursorConfigPath), { recursive: true });
        fs.writeFileSync(cursorConfigPath, JSON.stringify({ mcpServers: { [profile.serverId]: { url: profile.entry.url } } }));
        break;
      case "claude-plugin-cli":
        claude.plugin = { id: profile.pluginId, version: profile.versionRef, enabled: true };
        syncPluginRegistry(true);
        break;
      default:
        assert.fail(`Unhandled adapter ${profile.adapterId}`);
    }
  }

  function receiptPath(id) {
    return path.join(receiptsRoot, `${id}.json`);
  }

  return { root, profiles, adapters, manager, advanceProfile, removeManagedTarget, addManualTarget, receiptPath };
}

test("the five current managed resource profiles complete a lifecycle only in isolated hosts", async (t) => {
  assert.deepEqual(PROFILE_IDS.map((id) => EXTENSION_INSTALL_REGISTRY[id]?.adapterId), [
    "directory-snapshot",
    "codex-mcp-toml",
    "claude-code-mcp-cli",
    "cursor-mcp-json",
    "claude-plugin-cli"
  ]);

  for (const profileId of PROFILE_IDS) {
    await t.test(`${profileId}: install, recheck, idempotence, update, repair and uninstall`, async (t) => {
      const fixture = isolatedFixture(t);
      const adapter = fixture.adapters[fixture.profiles[profileId].adapterId];
      assert.equal((await fixture.manager.inspect(profileId)).state, "not-installed");
      assert.equal((await fixture.manager.execute(profileId, "install")).state, "installed");
      assert.equal((await fixture.manager.inspect(profileId)).state, "installed");
      assert.equal((await adapter.execute(profileId, "install")).state, "installed");

      if (fixture.profiles[profileId].capabilities.includes("disable")) {
        assert.equal((await fixture.manager.execute(profileId, "disable")).state, "disabled");
        assert.equal((await fixture.manager.execute(profileId, "enable")).state, "installed");
      }

      fixture.advanceProfile(profileId);
      assert.equal((await fixture.manager.inspect(profileId)).state, "outdated");
      assert.equal((await fixture.manager.execute(profileId, "update")).state, "installed");
      fixture.removeManagedTarget(profileId);
      assert.equal((await fixture.manager.inspect(profileId)).state, "stale");
      assert.equal((await fixture.manager.execute(profileId, "repair")).state, "installed");
      assert.equal((await fixture.manager.execute(profileId, "uninstall")).state, "not-installed");
      assert.equal(fs.existsSync(fixture.receiptPath(profileId)), false);
      assert.ok(path.resolve(fixture.root).startsWith(path.resolve(os.tmpdir())));
    });

    await t.test(`${profileId}: protects a manual same-name resource`, async (t) => {
      const fixture = isolatedFixture(t);
      fixture.addManualTarget(profileId);
      assert.equal((await fixture.manager.inspect(profileId)).state, "external");
      await assert.rejects(
        fixture.manager.execute(profileId, "install"),
        (error) => error.code === "EXTENSION_ACTION_UNAVAILABLE"
      );
    });

    await t.test(`${profileId}: receipt loss never authorizes removal`, async (t) => {
      const fixture = isolatedFixture(t);
      assert.equal((await fixture.manager.execute(profileId, "install")).state, "installed");
      fs.unlinkSync(fixture.receiptPath(profileId));
      if (fixture.profiles[profileId].adapterId === "claude-plugin-cli") {
        assert.equal((await fixture.manager.inspect(profileId)).state, "installed");
        assert.equal((await fixture.manager.execute(profileId, "uninstall")).state, "not-installed");
      } else {
        assert.equal((await fixture.manager.inspect(profileId)).state, "external");
        await assert.rejects(
          fixture.manager.execute(profileId, "uninstall"),
          (error) => error.code === "EXTENSION_ACTION_UNAVAILABLE"
        );
      }
    });
  }
});
