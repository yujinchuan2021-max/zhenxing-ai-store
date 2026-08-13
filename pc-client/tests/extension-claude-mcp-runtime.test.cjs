"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  addArgs,
  createClaudeCodeMcpRuntime,
  listHasServer,
  removeArgs
} = require("../shared/extension-claude-mcp-runtime.cjs");

const PROFILE_ID = "mcp.claude-code.openai-developer-docs";

function profile(overrides = {}) {
  return {
    adapterId: "claude-code-mcp-cli",
    extensionId: "openai-codex-mcp-config",
    hostProductId: "claude-code",
    moduleId: "mcp-managed",
    capabilities: ["website", "install", "update", "repair", "uninstall"],
    serverId: "openaiDeveloperDocs",
    scope: "user",
    versionRef: "2026-08-04",
    entry: { url: "https://developers.openai.com/mcp" },
    ...overrides
  };
}

function fixture(t, { initialServer = null, profileOverrides = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-claude-mcp-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const receiptsRoot = path.join(root, "receipts");
  const executable = path.join(root, "claude.exe");
  let current = profile(profileOverrides);
  let server = initialServer;
  const calls = [];
  const runner = async (request) => {
    const { executable: actual, args } = request;
    assert.equal(actual, executable);
    assert.equal(Object.hasOwn(request, "shell"), false);
    calls.push([...args]);
    if (args[0] !== "mcp") return { ok: false, stdout: "" };
    if (args[1] === "list") {
      return {
        ok: true,
        stdout: server
          ? `openaiDeveloperDocs: ${server.url} - ✔ Connected\n`
          : "No MCP servers configured\n"
      };
    }
    if (args[1] === "get") {
      return server
        ? {
            ok: true,
            stdout: `openaiDeveloperDocs:\n  Scope: ${server.scope}\n  URL: ${server.url}\n`
          }
        : { ok: false, stdout: "" };
    }
    if (args[1] === "add") {
      server = { url: args.at(-1), scope: "User" };
      return { ok: true, stdout: "Added HTTP MCP server\n" };
    }
    if (args[1] === "remove") {
      server = null;
      return { ok: true, stdout: "Removed MCP server\n" };
    }
    return { ok: false, stdout: "" };
  };
  const create = (fsApi = fs, runHostCommand = runner) =>
    createClaudeCodeMcpRuntime({
      receiptsRoot,
      fsApi,
      profileLookup: (id) => id === PROFILE_ID ? current : null,
      resolveHostExecutable: async () => executable,
      runHostCommand,
      now: () => "2026-08-04T00:00:00.000Z"
    });
  return {
    calls,
    create,
    receiptsRoot,
    runtime: create(),
    server: () => server,
    setProfile(next) { current = profile(next); },
    setServer(next) { server = next; }
  };
}

test("uses only fixed shell-free Claude user-scope commands", async (t) => {
  const { calls, runtime } = fixture(t);
  assert.equal((await runtime.install(PROFILE_ID)).state, "installed");
  assert.equal((await runtime.uninstall(PROFILE_ID)).state, "not-installed");
  assert.ok(calls.some((args) => JSON.stringify(args) === JSON.stringify([
    "mcp", "add", "--transport", "http", "--scope", "user",
    "openaiDeveloperDocs", "https://developers.openai.com/mcp"
  ])));
  assert.ok(calls.some((args) => JSON.stringify(args) === JSON.stringify([
    "mcp", "remove", "openaiDeveloperDocs", "--scope", "user"
  ])));
  assert.deepEqual(addArgs(profile()), [
    "mcp", "add", "--transport", "http", "--scope", "user",
    "openaiDeveloperDocs", "https://developers.openai.com/mcp"
  ]);
  assert.deepEqual(removeArgs(profile()), [
    "mcp", "remove", "openaiDeveloperDocs", "--scope", "user"
  ]);
});

test("never adopts or overwrites an external same-name Claude server", async (t) => {
  const { runtime, server } = fixture(t, {
    initialServer: { url: "https://user.example/mcp", scope: "User" }
  });
  assert.equal((await runtime.inspect(PROFILE_ID)).state, "external");
  await assert.rejects(
    runtime.install(PROFILE_ID),
    (error) => error.code === "EXTENSION_TARGET_EXISTS"
  );
  assert.equal(server().url, "https://user.example/mcp");
});

test("refuses to remove a receipted name whose user-scope value changed", async (t) => {
  const { runtime, setServer, server } = fixture(t);
  await runtime.install(PROFILE_ID);
  setServer({ url: "https://user.example/mcp", scope: "User" });
  assert.equal((await runtime.inspect(PROFILE_ID)).state, "modified");
  await assert.rejects(
    runtime.uninstall(PROFILE_ID),
    (error) => error.code === "EXTENSION_CONTENT_MODIFIED"
  );
  assert.equal(server().url, "https://user.example/mcp");
});

test("updates the fixed endpoint and retains receipt ownership", async (t) => {
  const { create, runtime, server, setProfile } = fixture(t);
  await runtime.install(PROFILE_ID);
  setProfile({
    versionRef: "2026-08-05",
    entry: { url: "https://developers.openai.com/mcp/v2" }
  });
  const next = create();
  assert.equal((await next.inspect(PROFILE_ID)).state, "outdated");
  assert.equal((await next.update(PROFILE_ID)).state, "installed");
  assert.equal(server().url, "https://developers.openai.com/mcp/v2");
});

test("rolls back the Claude entry if receipt persistence fails", async (t) => {
  const { create, receiptsRoot, server } = fixture(t);
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
  await assert.rejects(create(failingFs).install(PROFILE_ID), /receipt unavailable/);
  assert.equal(server(), null);
});

test("accepts decorated list output and never mistakes a failed get for absence", async (t) => {
  const { create } = fixture(t);
  let added = false;
  const runner = async ({ args }) => {
    if (args[1] === "add") {
      added = true;
      return { ok: true, stdout: "Added\n" };
    }
    if (args[1] === "get") return { ok: false, stdout: "" };
    if (args[1] === "list") {
      return {
        ok: true,
        stdout: added ? "✘ Failed  openaiDeveloperDocs  https://developers.openai.com/mcp\n" : ""
      };
    }
    if (args[1] === "remove") {
      added = false;
      return { ok: true, stdout: "Removed\n" };
    }
    return { ok: false, stdout: "" };
  };
  assert.equal(
    listHasServer("✘ Failed  openaiDeveloperDocs  (offline)\n", "openaiDeveloperDocs"),
    true
  );
  await assert.rejects(
    create(fs, runner).install(PROFILE_ID),
    (error) => error.code === "EXTENSION_HOST_RESPONSE_INVALID"
  );
  assert.equal(added, false);
});

test("manual removal becomes stale and cleanup only drops the receipt", async (t) => {
  const { runtime, setServer } = fixture(t);
  await runtime.install(PROFILE_ID);
  setServer(null);
  assert.equal((await runtime.inspect(PROFILE_ID)).state, "stale");
  assert.equal((await runtime.uninstall(PROFILE_ID)).state, "not-installed");
});

test("does not expose enable or accept command fields from a profile", async (t) => {
  const { runtime } = fixture(t);
  await assert.rejects(
    runtime.execute(PROFILE_ID, "enable"),
    (error) => error.code === "EXTENSION_ACTION_NOT_APPROVED"
  );
  const unsafe = fixture(t, { profileOverrides: { command: "cmd.exe" } }).runtime;
  await assert.rejects(
    unsafe.inspect(PROFILE_ID),
    (error) => error.code === "EXTENSION_PROFILE_INVALID"
  );
});
