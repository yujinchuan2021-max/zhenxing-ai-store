"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  CHANNELS,
  createLocalAgentBridgeIpcFacade,
  registerLocalAgentBridgeIpc
} = require("../electron/local-agent-bridge-ipc.cjs");

function ipcHarness() {
  const handlers = new Map();
  return {
    ipcMain: { handle(channel, handler) { assert.equal(handlers.has(channel), false); handlers.set(channel, handler); } },
    invoke(channel, input) { return handlers.get(channel)({}, input); },
    handlers
  };
}

test("Local Agent Bridge remains a structured disabled facade without all fixed dependencies", async () => {
  const facade = createLocalAgentBridgeIpcFacade();
  assert.deepEqual(await facade.capability(), {
    ok: true,
    value: { schemaVersion: 1, enabled: false, execution: false, operations: [] }
  });
  assert.deepEqual(await facade.plan({ workflowId: "ignored" }), {
    ok: false,
    error: { code: "BRIDGE_DISABLED", status: 503, messageKey: "agent.bridge.disabled" }
  });
});

test("Local Agent Bridge routes only after every trusted dependency is ready and strips sensitive bridge fields", async () => {
  const calls = [];
  const bridge = {
    async search(input) { calls.push(input); return { ok: true, value: { items: [{ id: "public-plan" }], count: 1 }, audit: [{ agentId: "private-agent" }] }; },
    async get() { return { ok: true, value: { receipt: "private" } }; },
    async plan() { return { ok: true, value: { workflow: { title: "safe" }, capabilities: [] } }; },
    async request() { return { ok: true, value: { schemaVersion: 1, kind: "agent-capability-confirmation-request", requestId: "request-1", planId: "plan-1", agentId: "private-agent", useId: "use-1", capabilityKey: "safe", status: "pending-user-confirmation", expiresAt: "2026-08-08T01:00:00.000Z" } }; }
  };
  const facade = createLocalAgentBridgeIpcFacade({
    bridge,
    getReadiness: async () => ({
      verifiedCatalog: true,
      immutableWorkflowReleaseResolver: true,
      agentSessionReceiptSnapshot: true,
      bridgeReady: true
    })
  });
  assert.deepEqual((await facade.capability()).value, {
    schemaVersion: 1,
    enabled: true,
    execution: false,
    operations: ["search", "get", "plan", "request"]
  });
  assert.deepEqual(await facade.search({ query: "safe" }), {
    ok: true,
    value: { items: [{ id: "public-plan" }], count: 1 }
  });
  assert.equal(calls.length, 1);
  const rejected = await facade.get({});
  assert.deepEqual(rejected, { ok: false, error: { code: "SOURCE_UNAVAILABLE", status: 503, messageKey: "agent.bridge.unavailable" } });
  assert.doesNotMatch(JSON.stringify(rejected), /receipt|session|private/i);
  const ticket = await facade.request({});
  assert.deepEqual(ticket, { ok: true, value: { schemaVersion: 1, kind: "agent-capability-confirmation-request", requestId: "request-1", planId: "plan-1", useId: "use-1", capabilityKey: "safe", status: "pending-user-confirmation", expiresAt: "2026-08-08T01:00:00.000Z" } });
  assert.doesNotMatch(JSON.stringify(ticket), /agentId|session|receipt|private/i);
});

test("Local Agent Bridge IPC registers exactly the four non-executing operations and capability", async () => {
  const harness = ipcHarness();
  registerLocalAgentBridgeIpc(harness.ipcMain);
  assert.deepEqual([...harness.handlers.keys()].sort(), Object.values(CHANNELS).sort());
  assert.deepEqual(await harness.invoke(CHANNELS.request, {}), {
    ok: false,
    error: { code: "BRIDGE_DISABLED", status: 503, messageKey: "agent.bridge.disabled" }
  });
});

test("main wires the candidate facade without creating a transport or execution entry point", () => {
  const main = fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8");
  assert.match(main, /registerLocalAgentBridgeIpc\(ipcMain, \{ logError: console\.error \}\)/);
  assert.doesNotMatch(main, /agent-bridge:(?:execute|install|apply)/);
});

test("preload exposes only fixed Local Agent Bridge methods and turns rejected IPC into a safe envelope", async () => {
  const preload = fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8");
  const calls = [];
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: { exposeInMainWorld(_name, api) { context.bridge = api; } },
        ipcRenderer: { invoke: async (...args) => { calls.push(args); throw new Error("vault secret"); }, on() {}, removeListener() {} }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(preload, context, { filename: "electron/preload.cjs" });
  assert.deepEqual(Object.keys(context.bridge).filter((name) => /LocalAgentBridge/.test(name)).sort(), [
    "getLocalAgentBridge", "getLocalAgentBridgeCapability", "planLocalAgentBridge", "requestLocalAgentBridge", "searchLocalAgentBridge"
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(await context.bridge.requestLocalAgentBridge({
    agentId: "agent-1", sessionId: "session-1", planId: "plan-1", capabilityKey: "capability-1", useId: "use-1"
  }))), {
    ok: false,
    error: { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "agent.bridge.unavailable" }
  });
  assert.equal(calls[0][0], CHANNELS.request);
});

test("preload drops nominal Bridge successes that contain receipt or identity internals", async () => {
  const preload = fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8");
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: { exposeInMainWorld(_name, api) { context.bridge = api; } },
        ipcRenderer: { invoke: async () => ({ ok: true, value: { agentId: "private-agent", receipt: "private" } }), on() {}, removeListener() {} }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(preload, context, { filename: "electron/preload.cjs" });
  assert.deepEqual(JSON.parse(JSON.stringify(await context.bridge.getLocalAgentBridgeCapability())), {
    ok: false,
    error: { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "agent.bridge.unavailable" }
  });
});
