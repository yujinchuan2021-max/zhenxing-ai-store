"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  CHANNELS,
  registerWorkflowStoreIpc
} = require("../electron/workflow-store-ipc.cjs");

const WORKFLOW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function draft() {
  return {
    sourceCommunityPostId: "42",
    provenance: { licenseId: "CC-BY-4.0", derivedFrom: [], discoveredVia: [] },
    content: {
      title: "Data-only workflow",
      summary: "Human-readable workflow candidate.",
      inputs: [], outputs: [], instructions: ["Follow the documented steps."],
      dependencies: [{ kind: "product", canonicalId: "comfyui", permissions: ["none"] }],
      secretPlaceholders: []
    }
  };
}

function owner(overrides = {}) {
  return {
    workflowId: WORKFLOW_ID,
    expectedRevision: 1,
    status: "draft",
    sourceCommunityPostId: "42",
    provenance: draft().provenance,
    content: draft().content,
    latestReleaseVersion: 0,
    rejectionReason: null,
    postReferences: [],
    allowedActions: ["update", "submit"],
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

test("main registers only owner workflow methods and returns safe fulfilled envelopes", async () => {
  const ipc = harness();
  const calls = [];
  const errors = [];
  const client = {
    current: async () => ({ status: "authenticated", user: { id: "not-forwarded" } }),
    getWorkflowStoreCapability: async () => ({ enabled: true, schemaVersion: 1, execution: false, workflowSubmissionLookup: false }),
    createMyWorkflowDraft: async (key, value) => { calls.push({ key, value }); return owner(); },
    listMyWorkflowDrafts: async () => ({ items: [owner()], next: null }),
    getMyWorkflowDraft: async () => owner(),
    updateMyWorkflowDraft: async (key, value) => { calls.push({ key, value }); return owner({ expectedRevision: 2 }); },
    submitMyWorkflowDraft: async () => owner({ expectedRevision: 2, status: "submitted" }),
    withdrawMyWorkflowDraft: async () => owner({ expectedRevision: 3, status: "withdrawn" }),
    attachMyWorkflowPost: async () => ({ draft: owner({ expectedRevision: 2 }), postReference: { communityPostId: "43", card: { workflowId: WORKFLOW_ID, version: 1 }, attachedAt: "2026-08-07T00:00:00.000Z" } }),
    detachMyWorkflowPost: async () => ({ draft: owner({ expectedRevision: 3 }), postReference: null }),
    reportWorkflowRelease: async () => ({ reportId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", workflowId: WORKFLOW_ID, version: 1, status: "pending", createdAt: "2026-08-07T00:00:00.000Z" })
  };
  registerWorkflowStoreIpc(ipc.ipcMain, { getIdentityClient: () => client, logError: (...args) => errors.push(args) });
  assert.deepEqual([...ipc.handlers.keys()].filter((channel) => !channel.includes("workflow-public")).sort(), Object.values(CHANNELS).sort());
  assert.equal(Object.values(CHANNELS).some((channel) => /reviewer|public/.test(channel)), false);

  assert.deepEqual(await ipc.invoke(CHANNELS.create, { idempotencyKey: "create-key", draft: draft() }), { ok: true, value: owner() });
  assert.equal("identityId" in calls[0].value, false);
  assert.equal("reviewerId" in calls[0].value, false);

  await ipc.invoke(CHANNELS.update, {
    idempotencyKey: "update-key",
    workflowId: WORKFLOW_ID,
    expectedRevision: 1,
    content: draft().content
  });
  assert.equal(calls[1].key, "update-key");
  assert.equal("idempotencyKey" in calls[1].value, false);

  assert.deepEqual(await ipc.invoke(CHANNELS.capability), { ok: true, value: { enabled: true, schemaVersion: 1, execution: false, workflowSubmissionLookup: false } });
  const listResult = await ipc.invoke(CHANNELS.list, { limit: 20 });
  assert.equal(listResult.ok, true, `${JSON.stringify(listResult)} ${errors.at(-1)?.[1]?.stack || ""}`);
  assert.equal((await ipc.invoke(CHANNELS.get, { workflowId: WORKFLOW_ID })).ok, true);
  assert.equal((await ipc.invoke(CHANNELS.submit, { idempotencyKey: "submit-key", workflowId: WORKFLOW_ID, expectedRevision: 1 })).ok, true);
  assert.equal((await ipc.invoke(CHANNELS.withdraw, { idempotencyKey: "withdraw-key", workflowId: WORKFLOW_ID, expectedRevision: 2 })).ok, true);
  assert.equal((await ipc.invoke(CHANNELS.attach, { idempotencyKey: "attach-key", workflowId: WORKFLOW_ID, expectedRevision: 1, version: 1, communityPostId: "43" })).ok, true);
  assert.equal((await ipc.invoke(CHANNELS.detach, { idempotencyKey: "detach-key", workflowId: WORKFLOW_ID, expectedRevision: 2, version: 1, communityPostId: "43" })).ok, true);
  assert.equal((await ipc.invoke(CHANNELS.report, { idempotencyKey: "report-key", workflowId: WORKFLOW_ID, version: 1, reason: "Incorrect provenance" })).ok, true);

  const invalid = await ipc.invoke(CHANNELS.create, {
    idempotencyKey: "bad-key",
    draft: { ...draft(), identityId: "renderer-owner", command: "run" }
  });
  assert.deepEqual(invalid, { ok: false, error: { code: "INVALID_INPUT", status: 400, messageKey: "workflow.store.invalid" } });
  const inherited = Object.assign(Object.create({ identityId: "renderer-owner" }), draft());
  assert.equal((await ipc.invoke(CHANNELS.create, { idempotencyKey: "prototype-key", draft: inherited })).ok, false);
  assert.equal(calls.length, 2);
});

test("main maps anonymous, conflict and malformed Identity responses without technical leakage", async () => {
  const anonymous = harness();
  registerWorkflowStoreIpc(anonymous.ipcMain, {
    getIdentityClient: () => ({ current: async () => ({ status: "anonymous" }), getMyWorkflowDraft: async () => owner() }),
    logError: () => {}
  });
  assert.deepEqual(await anonymous.invoke(CHANNELS.get, { workflowId: WORKFLOW_ID }), {
    ok: false,
    error: { code: "AUTHENTICATION_REQUIRED", status: 401, messageKey: "workflow.store.loginRequired" }
  });

  for (const [source, expected] of [
    [{ code: "REVISION_CONFLICT", status: 409 }, { code: "REVISION_CONFLICT", status: 409, messageKey: "workflow.store.conflict" }],
    [{ code: "RATE_LIMITED", status: 429 }, { code: "RATE_LIMITED", status: 429, messageKey: "workflow.store.rateLimited" }],
    [{ code: "DB_URL_SECRET", status: 500 }, { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "workflow.store.serviceUnavailable" }]
  ]) {
    const ipc = harness();
    registerWorkflowStoreIpc(ipc.ipcMain, {
      getIdentityClient: () => ({
        current: async () => ({ status: "authenticated" }),
        getMyWorkflowDraft: async () => { const error = new Error("postgres://user:secret@db"); Object.assign(error, source); throw error; }
      }),
      logError: () => {}
    });
    assert.deepEqual(await ipc.invoke(CHANNELS.get, { workflowId: WORKFLOW_ID }), { ok: false, error: expected });
  }

  const leak = harness();
  registerWorkflowStoreIpc(leak.ipcMain, {
    getIdentityClient: () => ({ current: async () => ({ status: "authenticated" }), getMyWorkflowDraft: async () => owner({ reviewerIdentityId: "leak" }) }),
    logError: () => {}
  });
  assert.deepEqual(await leak.invoke(CHANNELS.get, { workflowId: WORKFLOW_ID }), {
    ok: false,
    error: { code: "INVALID_IDENTITY_RESPONSE", status: 502, messageKey: "workflow.store.failed" }
  });
});

test("sandbox preload validates workflow payloads and never exposes reviewer or Electron rejection text", async () => {
  const calls = [];
  const preload = fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8");
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: { exposeInMainWorld(_name, api) { context.bridge = api; } },
        ipcRenderer: {
          async invoke(channel, input) {
            calls.push([channel, input]);
            if (channel === CHANNELS.get) throw new Error(`Error invoking remote method '${channel}': WorkflowCandidateError: postgres://secret`);
            return { ok: true, value: owner() };
          },
          on() {}, removeListener() {}
        }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(preload, context, { filename: "electron/preload.cjs" });
  const methods = Object.keys(context.bridge).filter((name) => /Workflow/.test(name) && !/Public/.test(name)).sort();
  assert.deepEqual(methods, [
    "attachWorkflowPost", "createWorkflowDraft", "detachWorkflowPost",
    "getOwnWorkflowDraft", "getWorkflowStoreCapability", "listOwnWorkflowDrafts",
    "reportWorkflowRelease", "submitWorkflowDraft", "updateWorkflowDraft",
    "withdrawWorkflowDraft"
  ]);
  assert.equal(methods.some((name) => /review|public/i.test(name)), false);

  await context.bridge.createWorkflowDraft({ idempotencyKey: "create-key", draft: draft() });
  const invalid = await context.bridge.createWorkflowDraft({ idempotencyKey: "bad-key", draft: { ...draft(), reviewerId: "forbidden" } });
  assert.deepEqual(JSON.parse(JSON.stringify(invalid)), { ok: false, error: { code: "INVALID_INPUT", status: 400, messageKey: "workflow.store.invalid" } });
  const oversized = await context.bridge.createWorkflowDraft({
    idempotencyKey: "oversize-key",
    draft: { ...draft(), content: { ...draft().content, summary: "x".repeat(129 * 1024) } }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(oversized)), { ok: false, error: { code: "INVALID_INPUT", status: 400, messageKey: "workflow.store.invalid" } });
  const rejected = await context.bridge.getOwnWorkflowDraft({ workflowId: WORKFLOW_ID });
  assert.deepEqual(JSON.parse(JSON.stringify(rejected)), { ok: false, error: { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "workflow.store.serviceUnavailable" } });
  assert.doesNotMatch(JSON.stringify(rejected), /identity:|WorkflowCandidateError|postgres|secret|stack/i);
  assert.equal(calls.filter(([channel]) => channel === CHANNELS.create).length, 1);
});
