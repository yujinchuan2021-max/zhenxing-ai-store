"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createClaudePluginRuntime
} = require("../shared/extension-plugin-runtime.cjs");

const PROFILE_ID = "plugin.claude.commit-commands";
const EXECUTABLE = "C:\\private\\claude.exe";

function approvedProfile(overrides = {}) {
  return {
    adapterId: "claude-plugin-cli",
    extensionId: "anthropic-commit-commands-plugin",
    hostProductId: "claude-code",
    moduleId: "plugin-managed",
    capabilities: ["install", "update", "repair", "enable", "disable", "uninstall"],
    versionRef: "1.0.0",
    pluginId: "commit-commands@anthropics-claude-code",
    scope: "user",
    marketplace: { source: "anthropics/claude-code" },
    ...overrides
  };
}

function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-plugin-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const receiptsRoot = path.join(root, "receipts");
  const ownershipRoot = path.join(root, "plugin-data");
  const registryPath = path.join(root, "installed_plugins.json");
  let profile = approvedProfile();
  let hostAvailable = options.hostAvailable !== false;
  let plugin = options.plugin || null;
  let marketplace = options.marketplace === true;
  const calls = [];
  let failure = null;
  let installedAt = "";
  let instanceSequence = 0;

  function nextInstanceTimestamp() {
    instanceSequence += 1;
    return `2026-08-03T00:00:00.${String(instanceSequence).padStart(3, "0")}Z`;
  }

  function syncRegistry(freshInstance = false) {
    if (!plugin) {
      installedAt = "";
      if (fs.existsSync(registryPath)) fs.unlinkSync(registryPath);
      return;
    }
    const lastUpdated = nextInstanceTimestamp();
    if (freshInstance || !installedAt) installedAt = lastUpdated;
    fs.writeFileSync(
      registryPath,
      JSON.stringify({
        version: 2,
        plugins: {
          [profile.pluginId]: [{
            scope: "user",
            installPath: path.join(root, "cache", profile.versionRef),
            version: profile.versionRef,
            installedAt,
            lastUpdated
          }]
        }
      })
    );
  }

  if (plugin) syncRegistry(true);

  async function runner({ executable, args }) {
    calls.push({ executable, args: [...args] });
    if (failure) return { ok: false, stdout: failure.stdout, stderr: failure.stderr };
    assert.equal(executable, EXECUTABLE);
    assert.equal(typeof args, "object");
    if (args.join(" ") === "plugin list --json") {
      return { ok: true, stdout: JSON.stringify({ plugins: plugin ? [plugin] : [] }) };
    }
    if (args.join(" ") === "plugin marketplace list --json") {
      return {
        ok: true,
        stdout: JSON.stringify({ marketplaces: marketplace ? [{ source: profile.marketplace.source }] : [] })
      };
    }
    if (args[0] === "plugin" && args[1] === "marketplace" && args[2] === "add") {
      assert.deepEqual(args, ["plugin", "marketplace", "add", "anthropics/claude-code"]);
      marketplace = true;
      return { ok: true, stdout: "" };
    }
    if (args[0] === "plugin" && ["install", "update"].includes(args[1])) {
      assert.equal(args[2], profile.pluginId);
      assert.deepEqual(args.slice(3), ["--scope", "user"]);
      plugin = { id: profile.pluginId, version: profile.versionRef, enabled: true };
      syncRegistry(args[1] === "install");
      return { ok: true, stdout: "" };
    }
    if (args[0] === "plugin" && ["enable", "disable"].includes(args[1])) {
      assert.deepEqual(args.slice(2), [profile.pluginId, "--scope", "user"]);
      plugin.enabled = args[1] === "enable";
      return { ok: true, stdout: "" };
    }
    if (args[0] === "plugin" && args[1] === "uninstall") {
      assert.deepEqual(args.slice(2), [
        profile.pluginId,
        "--scope", "user", "--keep-data", "--yes"
      ]);
      plugin = null;
      syncRegistry();
      return { ok: true, stdout: "" };
    }
    throw new Error("unexpected test command");
  }

  const runtime = createClaudePluginRuntime({
    receiptsRoot,
    ownershipRoot,
    registryPath,
    profileLookup: (id) => id === PROFILE_ID ? profile : null,
    resolveHostExecutable: async (hostProductId) =>
      hostAvailable && hostProductId === "claude-code" ? EXECUTABLE : null,
    runHostCommand: runner,
    now: () => "2026-08-03T00:00:00.000Z",
    randomBytes: () => Buffer.alloc(24, 7)
  });

  return {
    calls,
    receiptsRoot,
    ownershipRoot,
    registryPath,
    runtime,
    getPlugin: () => plugin,
    setPlugin: (value) => {
      plugin = value;
      syncRegistry(Boolean(value));
    },
    setProfile: (value) => { profile = value; },
    setHostAvailable: (value) => { hostAvailable = value; },
    failCommands: (value) => { failure = value; }
  };
}

test("runs the fixed Claude plugin lifecycle and keeps the marketplace", async (t) => {
  const state = fixture(t);
  assert.deepEqual(await state.runtime.inspect(PROFILE_ID), {
    state: "not-installed",
    managed: false
  });

  assert.equal((await state.runtime.execute(PROFILE_ID, "install")).state, "installed");
  assert.equal((await state.runtime.execute(PROFILE_ID, "disable")).state, "disabled");
  assert.equal((await state.runtime.execute(PROFILE_ID, "enable")).state, "installed");

  state.setProfile(approvedProfile({ versionRef: "1.1.0" }));
  assert.equal((await state.runtime.inspect(PROFILE_ID)).state, "outdated");
  assert.equal((await state.runtime.execute(PROFILE_ID, "update")).state, "installed");

  state.setPlugin(null);
  assert.equal((await state.runtime.inspect(PROFILE_ID)).state, "stale");
  assert.equal((await state.runtime.execute(PROFILE_ID, "repair")).state, "installed");
  assert.equal((await state.runtime.execute(PROFILE_ID, "uninstall")).state, "not-installed");
  assert.equal(fs.existsSync(path.join(state.receiptsRoot, `${PROFILE_ID}.json`)), false);

  const commands = state.calls.map(({ args }) => args.join(" "));
  assert.ok(commands.includes("plugin marketplace add anthropics/claude-code"));
  assert.ok(commands.includes(
    "plugin uninstall commit-commands@anthropics-claude-code --scope user --keep-data --yes"
  ));
  assert.equal(commands.some((value) => value.includes("marketplace remove")), false);
});

test("accepts array plugin-list output and matches only the qualified id", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-plugin-array-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtime = createClaudePluginRuntime({
    receiptsRoot: path.join(root, "receipts"),
    ownershipRoot: path.join(root, "plugin-data"),
    registryPath: path.join(root, "installed_plugins.json"),
    profileLookup: (id) => id === PROFILE_ID ? approvedProfile() : null,
    resolveHostExecutable: async () => EXECUTABLE,
    runHostCommand: async ({ args }) => ({
      ok: true,
      stdout: args.join(" ") === "plugin list --json"
        ? JSON.stringify([
            { name: "commit-commands", marketplace: "someone-else", enabled: true },
            { name: "other", marketplace: "anthropics-claude-code", enabled: true }
          ])
        : "[]"
    })
  });
  assert.deepEqual(await runtime.inspect(PROFILE_ID), {
    state: "not-installed",
    managed: false
  });
});

test("refuses to adopt or uninstall an externally installed plugin", async (t) => {
  const state = fixture(t, {
    plugin: {
      pluginId: "commit-commands@anthropics-claude-code",
      version: "1.0.0",
      enabled: true
    }
  });
  assert.equal((await state.runtime.inspect(PROFILE_ID)).state, "external");
  await assert.rejects(
    state.runtime.install(PROFILE_ID),
    (error) => error.code === "EXTENSION_TARGET_EXISTS"
  );
  await assert.rejects(
    state.runtime.uninstall(PROFILE_ID),
    (error) => error.code === "EXTENSION_NOT_MANAGED"
  );
  assert.ok(state.getPlugin());
});

test("reports a missing host and preserves an existing receipt", async (t) => {
  const state = fixture(t);
  await state.runtime.install(PROFILE_ID);
  state.setHostAvailable(false);
  assert.deepEqual(await state.runtime.inspect(PROFILE_ID), {
    state: "host-missing",
    managed: true
  });
  await assert.rejects(
    state.runtime.uninstall(PROFILE_ID),
    (error) => error.code === "EXTENSION_HOST_MISSING"
  );
  assert.equal(fs.existsSync(path.join(state.receiptsRoot, `${PROFILE_ID}.json`)), true);
});

test("does not reuse an old receipt after a manual uninstall and reinstall", async (t) => {
  const state = fixture(t);
  await state.runtime.install(PROFILE_ID);

  state.setPlugin(null);
  state.setPlugin({
    pluginId: "commit-commands@anthropics-claude-code",
    version: "1.0.0",
    enabled: true
  });

  assert.deepEqual(await state.runtime.inspect(PROFILE_ID), {
    state: "modified",
    managed: false
  });
  await assert.rejects(
    state.runtime.uninstall(PROFILE_ID),
    (error) => error.code === "EXTENSION_NOT_MANAGED"
  );
  assert.ok(state.getPlugin());
});

test("rejects unknown profiles, invalid profiles, and arbitrary actions", async (t) => {
  const state = fixture(t);
  await assert.rejects(
    state.runtime.inspect("plugin.backend-invented"),
    (error) => error.code === "EXTENSION_PROFILE_NOT_APPROVED"
  );
  await assert.rejects(
    state.runtime.execute(PROFILE_ID, "command"),
    (error) => error.code === "EXTENSION_ACTION_NOT_APPROVED"
  );

  state.setProfile(approvedProfile({ scope: "project" }));
  await assert.rejects(
    state.runtime.inspect(PROFILE_ID),
    (error) => error.code === "EXTENSION_PROFILE_INVALID"
  );
});

test("sanitizes command failures and never returns process details", async (t) => {
  const state = fixture(t);
  state.failCommands({
    stdout: "SECRET_STDOUT C:\\private\\claude.exe plugin list",
    stderr: "SECRET_STDERR --token=secret"
  });
  await assert.rejects(
    state.runtime.inspect(PROFILE_ID),
    (error) => {
      assert.equal(error.code, "EXTENSION_HOST_COMMAND_FAILED");
      assert.equal(error.message, "Plugin operation failed");
      assert.doesNotMatch(error.message, /private|token|stdout|stderr|plugin list/i);
      assert.deepEqual(Object.keys(error).sort(), ["code"]);
      return true;
    }
  );
});
