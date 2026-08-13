"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createCursorMcpRuntime
} = require("../shared/extension-cursor-mcp-runtime.cjs");

const PROFILE_ID = "mcp.cursor.openai-developer-docs";

function profile(overrides = {}) {
  return {
    adapterId: "cursor-mcp-json",
    extensionId: "openai-codex-mcp-config",
    hostProductId: "cursor-desktop",
    moduleId: "mcp-managed",
    capabilities: ["website", "install", "update", "repair", "uninstall"],
    serverId: "openaiDeveloperDocs",
    scope: "user",
    versionRef: "2026-08-04",
    entry: { url: "https://developers.openai.com/mcp" },
    ...overrides
  };
}

function fixture(t, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-cursor-mcp-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, ".cursor", "mcp.json");
  const receiptsRoot = path.join(root, "receipts");
  let current = profile(overrides);
  const create = (fsApi = fs) => createCursorMcpRuntime({
    configPath,
    receiptsRoot,
    fsApi,
    profileLookup: (id) => id === PROFILE_ID ? current : null,
    now: () => "2026-08-04T00:00:00.000Z"
  });
  return {
    configPath,
    receiptsRoot,
    create,
    runtime: create(),
    setProfile(next) { current = profile(next); }
  };
}

test("merges one fixed Cursor MCP key and preserves every unrelated JSON key", (t) => {
  const { configPath, runtime } = fixture(t);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    unknownTopLevel: { keep: true },
    mcpServers: { existing: { command: "user-owned", args: ["--keep"] } }
  }, null, 2));

  assert.equal(runtime.install(PROFILE_ID).state, "installed");
  const installed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.deepEqual(installed.unknownTopLevel, { keep: true });
  assert.deepEqual(installed.mcpServers.existing, {
    command: "user-owned",
    args: ["--keep"]
  });
  assert.deepEqual(installed.mcpServers.openaiDeveloperDocs, {
    url: "https://developers.openai.com/mcp"
  });

  assert.equal(runtime.uninstall(PROFILE_ID).state, "not-installed");
  const removed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.deepEqual(removed.unknownTopLevel, { keep: true });
  assert.deepEqual(removed.mcpServers.existing, {
    command: "user-owned",
    args: ["--keep"]
  });
  assert.equal(Object.hasOwn(removed.mcpServers, "openaiDeveloperDocs"), false);
});

test("never adopts or overwrites an external same-name Cursor server", (t) => {
  const { configPath, runtime } = fixture(t);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    mcpServers: {
      openaiDeveloperDocs: { url: "https://user.example/mcp" }
    }
  }));
  assert.equal(runtime.inspect(PROFILE_ID).state, "external");
  assert.throws(
    () => runtime.install(PROFILE_ID),
    (error) => error.code === "EXTENSION_TARGET_EXISTS"
  );
  assert.match(fs.readFileSync(configPath, "utf8"), /user\.example/);
});

test("a user-edited managed key is reported and conservatively retained", (t) => {
  const { configPath, runtime } = fixture(t);
  runtime.install(PROFILE_ID);
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.mcpServers.openaiDeveloperDocs.url = "https://user.example/mcp";
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  assert.equal(runtime.inspect(PROFILE_ID).state, "modified");
  assert.throws(
    () => runtime.uninstall(PROFILE_ID),
    (error) => error.code === "EXTENSION_CONTENT_MODIFIED"
  );
  assert.match(fs.readFileSync(configPath, "utf8"), /user\.example/);
});

test("updates only the receipted key when the fixed client profile changes", (t) => {
  const { configPath, runtime, create, setProfile } = fixture(t);
  runtime.install(PROFILE_ID);
  setProfile({
    versionRef: "2026-08-05",
    entry: { url: "https://developers.openai.com/mcp/v2" }
  });
  const next = create();
  assert.equal(next.inspect(PROFILE_ID).state, "outdated");
  assert.equal(next.update(PROFILE_ID).state, "installed");
  assert.equal(
    JSON.parse(fs.readFileSync(configPath, "utf8")).mcpServers.openaiDeveloperDocs.url,
    "https://developers.openai.com/mcp/v2"
  );
});

test("rolls back a new config file if receipt persistence fails", (t) => {
  const { configPath, receiptsRoot, create } = fixture(t);
  const failingFs = {
    ...fs,
    renameSync(source, target) {
      if (path.dirname(target) === receiptsRoot) {
        const error = new Error("receipt unavailable");
        error.code = "EACCES";
        throw error;
      }
      return fs.renameSync(source, target);
    }
  };
  assert.throws(() => create(failingFs).install(PROFILE_ID), /receipt unavailable/);
  assert.equal(fs.existsSync(configPath), false);
});

test("rejects enable, disable and backend-invented profile fields", (t) => {
  const { runtime } = fixture(t);
  assert.throws(
    () => runtime.execute(PROFILE_ID, "enable"),
    (error) => error.code === "EXTENSION_ACTION_NOT_APPROVED"
  );
  const unsafe = fixture(t, { command: "powershell.exe" }).runtime;
  assert.throws(
    () => unsafe.inspect(PROFILE_ID),
    (error) => error.code === "EXTENSION_PROFILE_INVALID"
  );
});
