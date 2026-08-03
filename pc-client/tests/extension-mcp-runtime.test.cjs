"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createCodexMcpRuntime,
  managedBlock
} = require("../shared/extension-mcp-runtime.cjs");

const PROFILE_ID = "mcp.codex.openai-developer-docs";

function profile(overrides = {}) {
  return {
    adapterId: "codex-mcp-toml",
    extensionId: "openai-developer-docs-mcp",
    hostProductId: "codex-cli",
    moduleId: "mcp-managed",
    capabilities: ["website", "install", "update", "repair", "enable", "disable", "uninstall"],
    versionRef: "2026-08-03",
    serverId: "openaiDeveloperDocs",
    entry: { url: "https://developers.openai.com/mcp" },
    ...overrides
  };
}

function fixture(t, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-mcp-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, ".codex", "config.toml");
  const receiptsRoot = path.join(root, "receipts");
  const current = profile(overrides);
  const runtime = createCodexMcpRuntime({
    configPath,
    receiptsRoot,
    profileLookup: (id) => id === PROFILE_ID ? current : null,
    now: () => "2026-08-03T00:00:00.000Z"
  });
  return { root, configPath, receiptsRoot, profile: current, runtime };
}

test("installs, disables, enables and conservatively uninstalls one fixed MCP table", (t) => {
  const { configPath, runtime } = fixture(t);
  assert.deepEqual(runtime.inspect(PROFILE_ID), {
    state: "not-installed",
    managed: false
  });
  assert.equal(runtime.execute(PROFILE_ID, "install").state, "installed");
  const first = fs.readFileSync(configPath, "utf8");
  assert.match(first, /\[mcp_servers\.openaiDeveloperDocs\]/);
  assert.match(first, /https:\/\/developers\.openai\.com\/mcp/);
  assert.equal(runtime.execute(PROFILE_ID, "disable").state, "disabled");
  assert.match(fs.readFileSync(configPath, "utf8"), /enabled = false/);
  assert.equal(runtime.execute(PROFILE_ID, "enable").state, "installed");
  assert.match(fs.readFileSync(configPath, "utf8"), /enabled = true/);
  assert.equal(runtime.execute(PROFILE_ID, "uninstall").state, "not-installed");
  assert.doesNotMatch(fs.readFileSync(configPath, "utf8"), /openaiDeveloperDocs/);
});

test("preserves unrelated TOML exactly", (t) => {
  const { configPath, runtime } = fixture(t);
  const existing = "model = \"gpt-test\"\n\n[mcp_servers.other]\nurl = \"https://example.com/mcp\"\n";
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, existing);
  runtime.install(PROFILE_ID);
  assert.ok(fs.readFileSync(configPath, "utf8").startsWith(existing));
  runtime.uninstall(PROFILE_ID);
  assert.equal(fs.readFileSync(configPath, "utf8"), existing);
});

test("never overwrites an externally configured server", (t) => {
  const { configPath, runtime } = fixture(t);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    "[mcp_servers.openaiDeveloperDocs]\nurl = \"https://manual.example/mcp\"\n"
  );
  assert.equal(runtime.inspect(PROFILE_ID).state, "external");
  assert.throws(
    () => runtime.install(PROFILE_ID),
    (error) => error.code === "EXTENSION_TARGET_EXISTS"
  );
  assert.match(fs.readFileSync(configPath, "utf8"), /manual\.example/);
});

test("user changes are reported and never removed", (t) => {
  const { configPath, runtime } = fixture(t);
  runtime.install(PROFILE_ID);
  const changed = fs.readFileSync(configPath, "utf8").replace(
    "https://developers.openai.com/mcp",
    "https://user.example/mcp"
  );
  fs.writeFileSync(configPath, changed);
  assert.equal(runtime.inspect(PROFILE_ID).state, "modified");
  assert.throws(
    () => runtime.uninstall(PROFILE_ID),
    (error) => error.code === "EXTENSION_CONTENT_MODIFIED"
  );
  assert.match(fs.readFileSync(configPath, "utf8"), /user\.example/);
});

test("a missing managed block can be repaired without touching other config", (t) => {
  const { configPath, runtime } = fixture(t);
  runtime.install(PROFILE_ID);
  fs.writeFileSync(configPath, "model = \"kept\"\n");
  assert.equal(runtime.inspect(PROFILE_ID).state, "stale");
  assert.equal(runtime.execute(PROFILE_ID, "repair").state, "installed");
  assert.match(fs.readFileSync(configPath, "utf8"), /^model = "kept"/);
});

test("a version change becomes updateable and refreshes the receipt", (t) => {
  const { root, configPath, receiptsRoot, runtime } = fixture(t);
  runtime.install(PROFILE_ID);
  const nextProfile = profile({ versionRef: "2026-08-04" });
  const updated = createCodexMcpRuntime({
    configPath,
    receiptsRoot,
    profileLookup: (id) => id === PROFILE_ID ? nextProfile : null,
    now: () => "2026-08-04T00:00:00.000Z"
  });
  assert.equal(updated.inspect(PROFILE_ID).state, "outdated");
  assert.equal(updated.execute(PROFILE_ID, "update").state, "installed");
  const receipt = JSON.parse(
    fs.readFileSync(path.join(receiptsRoot, `${PROFILE_ID}.json`), "utf8")
  );
  assert.equal(receipt.versionRef, "2026-08-04");
  assert.ok(root);
});

test("rolls back the host config when a lifecycle receipt cannot be updated", (t) => {
  const { configPath, receiptsRoot, runtime } = fixture(t);
  runtime.install(PROFILE_ID);
  const before = fs.readFileSync(configPath, "utf8");
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
  const failing = createCodexMcpRuntime({
    configPath,
    receiptsRoot,
    fsApi: failingFs,
    profileLookup: (id) => id === PROFILE_ID ? profile() : null
  });
  assert.throws(() => failing.execute(PROFILE_ID, "disable"), /receipt unavailable/);
  assert.equal(fs.readFileSync(configPath, "utf8"), before);
  assert.equal(runtime.inspect(PROFILE_ID).state, "installed");
});

test("unknown profiles and arbitrary actions cannot select an adapter", (t) => {
  const { runtime, profile: approved } = fixture(t);
  assert.throws(
    () => runtime.install("mcp.backend-invented"),
    (error) => error.code === "EXTENSION_PROFILE_NOT_APPROVED"
  );
  assert.throws(
    () => runtime.execute(PROFILE_ID, "command"),
    (error) => error.code === "EXTENSION_ACTION_NOT_APPROVED"
  );
  assert.equal(managedBlock(PROFILE_ID, approved, true).includes("command"), false);
});
