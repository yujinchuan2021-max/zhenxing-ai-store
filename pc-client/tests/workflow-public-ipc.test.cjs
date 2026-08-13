"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  PUBLIC_CHANNELS,
  registerWorkflowStoreIpc
} = require("../electron/workflow-store-ipc.cjs");

const WORKFLOW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function publicRelease(overrides = {}) {
  return {
    workflowId: WORKFLOW_ID,
    version: 1,
    author: { displayName: "Public submitter" },
    originalAuthorDisplayName: "Public original author",
    sourceCommunityPostId: "42",
    provenance: {
      canonicalSource: { kind: "community-post", canonicalId: "42" },
      licenseId: "CC-BY-4.0",
      derivedFrom: []
    },
    content: {
      title: "Public workflow",
      summary: "Data-only public workflow.",
      inputs: [], outputs: [], instructions: ["Follow the documented steps."],
      dependencies: [{ kind: "product", canonicalId: "comfyui", permissions: ["none"] }]
    },
    reviewStatus: "manually-reviewed",
    riskLevel: "low",
    requiresPerUseConfirmation: false,
    releasedAt: "2026-08-07T00:00:00.000Z",
    ...overrides
  };
}

function harness() {
  const handlers = new Map();
  return {
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    invoke: (channel, input) => handlers.get(channel)({}, input),
    handlers
  };
}

test("main exposes four public read channels without session, reviewer, or executable methods", async () => {
  const ipc = harness();
  const calls = [];
  const client = {
    current: async () => { throw new Error("public read must not require a session"); },
    getWorkflowPublicCapability: async () => ({ enabled: true, schemaVersion: 1, execution: false }),
    listPublicWorkflows: async (input) => { calls.push(input); return { items: [publicRelease()], next: null }; },
    getPublicWorkflow: async (input) => { calls.push(input); return publicRelease(); },
    resolvePublicWorkflow: async (input) => { calls.push(input); return publicRelease(); }
  };
  registerWorkflowStoreIpc(ipc.ipcMain, { getIdentityClient: () => client, logError: () => {} });
  assert.deepEqual(Object.values(PUBLIC_CHANNELS).sort(), [...ipc.handlers.keys()].filter((channel) => channel.includes("workflow-public")).sort());
  assert.equal(Object.values(PUBLIC_CHANNELS).some((channel) => /review|create|update|import|execute|invoke|bind/.test(channel)), false);
  assert.equal((await ipc.invoke(PUBLIC_CHANNELS.capability)).ok, true);
  assert.equal((await ipc.invoke(PUBLIC_CHANNELS.list, { limit: 10, riskLevel: "low" })).ok, true);
  assert.equal((await ipc.invoke(PUBLIC_CHANNELS.get, { workflowId: WORKFLOW_ID, version: 1 })).ok, true);
  assert.equal((await ipc.invoke(PUBLIC_CHANNELS.resolve, { workflowId: WORKFLOW_ID, version: 1 })).ok, true);
  assert.equal(calls.length, 3);
  const result = await ipc.invoke(PUBLIC_CHANNELS.get, { workflowId: WORKFLOW_ID, version: 1 });
  assert.deepEqual(result.value.author, { displayName: "Public submitter" });
  assert.equal(result.value.originalAuthorDisplayName, "Public original author");
  assert.doesNotMatch(JSON.stringify(result.value), /identityId/);

  for (const invalid of [
    { workflowId: WORKFLOW_ID, version: 1, url: "https://forbidden.test" },
    { workflowId: WORKFLOW_ID, version: 1, path: "/etc/passwd" },
    { workflowId: WORKFLOW_ID, version: 1, padding: "x".repeat(129 * 1024) },
    Object.assign(Object.create({ reviewerId: "hidden" }), { workflowId: WORKFLOW_ID, version: 1 })
  ]) {
    assert.deepEqual(await ipc.invoke(PUBLIC_CHANNELS.resolve, invalid), {
      ok: false,
      error: { code: "INVALID_INPUT", status: 400, messageKey: "workflow.store.invalid" }
    });
  }
  assert.equal(calls.length, 4);
});

test("public missing and malicious DTOs collapse to safe unavailable envelopes", async () => {
  for (const [result, expected] of [
    [Object.assign(new Error("internal listing reason"), { code: "PUBLIC_WORKFLOW_UNAVAILABLE", status: 404 }), { code: "PUBLIC_WORKFLOW_UNAVAILABLE", status: 404, messageKey: "workflow.public.unavailable" }],
    [publicRelease({ reviewerIdentityId: "leak", evidenceUrl: "https://secret.test" }), { code: "INVALID_IDENTITY_RESPONSE", status: 502, messageKey: "workflow.store.failed" }]
  ]) {
    const ipc = harness();
    registerWorkflowStoreIpc(ipc.ipcMain, {
      getIdentityClient: () => ({
        getPublicWorkflow: async () => {
          if (result instanceof Error) throw result;
          return result;
        }
      }),
      logError: () => {}
    });
    assert.deepEqual(await ipc.invoke(PUBLIC_CHANNELS.get, { workflowId: WORKFLOW_ID, version: 1 }), { ok: false, error: expected });
  }
});

test("main rejects old identity-bearing or unsafe original-author public DTOs", async () => {
  for (const release of [
    publicRelease({ author: { identityId: "11111111-1111-4111-8111-111111111111", displayName: "Public submitter" } }),
    publicRelease({ provenance: { ...publicRelease().provenance, originalAuthorIdentityId: "11111111-1111-4111-8111-111111111111" } }),
    publicRelease({ originalAuthorDisplayName: "<b>Original</b>" }),
    publicRelease({ originalAuthorDisplayName: "https://identity.example/original" }),
    publicRelease({ originalAuthorDisplayName: "Original\u0000author" }),
    publicRelease({ originalAuthorDisplayName: "secret token owner" })
  ]) {
    const ipc = harness();
    registerWorkflowStoreIpc(ipc.ipcMain, {
      getIdentityClient: () => ({ getPublicWorkflow: async () => release }),
      logError: () => {}
    });
    const result = await ipc.invoke(PUBLIC_CHANNELS.get, { workflowId: WORKFLOW_ID, version: 1 });
    assert.deepEqual(result, {
      ok: false,
      error: { code: "INVALID_IDENTITY_RESPONSE", status: 502, messageKey: "workflow.store.failed" }
    });
  }
});

test("sandbox preload exposes fixed public reads and rejects arbitrary URLs before IPC", async () => {
  const calls = [];
  const source = fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8");
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: { exposeInMainWorld(_name, api) { context.bridge = api; } },
        ipcRenderer: { invoke: async (channel, input) => { calls.push([channel, input]); return { ok: true, value: channel === PUBLIC_CHANNELS.list ? { items: [], next: null } : publicRelease() }; }, on() {}, removeListener() {} }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(source, context, { filename: "electron/preload.cjs" });
  for (const method of ["getWorkflowPublicCapability", "listPublicWorkflows", "getPublicWorkflow", "resolvePublicWorkflow"]) {
    assert.equal(typeof context.bridge[method], "function");
  }
  assert.equal(Object.keys(context.bridge).some((name) => /reviewPublic|importWorkflow|executeWorkflow|invokeWorkflow|bindWorkflow/.test(name)), false);
  await context.bridge.resolvePublicWorkflow({ workflowId: WORKFLOW_ID, version: 1 });
  const invalid = await context.bridge.resolvePublicWorkflow({ workflowId: WORKFLOW_ID, version: 1, url: "https://forbidden.test" });
  assert.deepEqual(JSON.parse(JSON.stringify(invalid)), { ok: false, error: { code: "INVALID_INPUT", status: 400, messageKey: "workflow.store.invalid" } });
  assert.equal(calls.filter(([channel]) => channel === PUBLIC_CHANNELS.resolve).length, 1);
});

test("renderer public type exposes display attribution without immutable identity IDs", () => {
  const types = fs.readFileSync(path.join(__dirname, "../src/vite-env.d.ts"), "utf8");
  const start = types.indexOf("type PublicWorkflow =");
  const end = types.indexOf("type PublicWorkflowPage", start);
  const source = types.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(source, /author: \{ displayName: string \}/);
  assert.match(source, /originalAuthorDisplayName\?: string/);
  assert.doesNotMatch(source, /identityId|originalAuthorOrganization/);
});
