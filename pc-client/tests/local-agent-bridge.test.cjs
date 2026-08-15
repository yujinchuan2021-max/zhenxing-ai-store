"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createAgentCapabilityBroker } = require("../shared/agent-capability-broker.cjs");
const { MAX_INPUT_BYTES, createLocalAgentBridge } = require("../shared/local-agent-bridge.cjs");
const { createLocalAgentBridgeSnapshotAdapter } = require("../shared/local-agent-bridge-snapshot.cjs");

const NOW = "2026-08-08T00:05:00.000Z";
const WORKFLOW_ID = "11111111-1111-4111-8111-111111111111";
const PLATFORM_SUPPORT = [{
  platform: "windows",
  runtime: "native",
  status: "supported",
  architectures: ["x64"],
  evidence: [{ kind: "first-party", url: "https://example.com/support", observedAt: "2026-08-08T00:00:00.000Z" }]
}];
const PLATFORM_REQUEST = { platform: "windows", runtime: "native", architecture: "x64", runtimeDependencies: [] };

function catalog() {
  return {
    source: "remote",
    catalogVersion: 9,
    catalog: {
      resourceStores: [{ id: "skill", kind: "skill", enabled: true }],
      resources: [{
        id: "reviewed-capability",
        name: "Reviewed capability",
        description: "A reviewed context package.",
        enabled: true,
        resourceTypes: ["skill"],
        sourceKind: "official",
        reviewStatus: "manually-reviewed",
        riskLevel: "low",
        website: "https://must-not-leak.example",
        targets: [{
          productId: "example-agent",
          compatibility: "native",
          moduleId: "skill-managed",
          installProfileId: "capability.reviewed",
          capabilities: ["install"],
          enabled: true
        }],
        platformSupport: PLATFORM_SUPPORT
      }],
      vendors: [{
        id: "example",
        name: "Example",
        enabled: true,
        products: [{
          id: "example-agent",
          name: "Example Agent",
          enabled: true,
          productType: "agent",
          category: "Agent",
          directoryKind: "ai-tool",
          experience: "cli",
          website: "https://must-not-leak.example/product",
          platformSupport: PLATFORM_SUPPORT
        }]
      }]
    }
  };
}

function planningRelease({ riskLevel = "low", secretPlaceholders = [] } = {}) {
  return {
    workflowId: WORKFLOW_ID,
    version: 1,
    reviewStatus: "manually-reviewed",
    riskLevel,
    content: {
      title: "Reviewed workflow",
      summary: "Reference-only composition.",
      inputs: [],
      outputs: [],
      instructions: ["Use the reviewed capability."],
      dependencies: [{
        kind: "resource",
        canonicalId: "reviewed-capability",
        hostProductId: "example-agent",
        bindingKind: "skill-context",
        permissions: ["none"]
      }],
      secretPlaceholders
    }
  };
}

function agentBridgePlanInput() {
  const release = planningRelease();
  return {
    contractVersion: 1,
    workflow: { workflowId: WORKFLOW_ID, version: 1 },
    primaryAgentProductId: "example-agent",
    requiredAgentHostProductId: "example-agent",
    requirements: release.content.dependencies,
    steps: [{
      stepId: "step-1",
      dependency: { kind: "resource", canonicalId: "reviewed-capability", hostProductId: "example-agent", bindingKind: "skill-context" },
      inputs: [],
      outputs: [{ name: "done", type: "text" }]
    }]
  };
}

function publicWorkflow() {
  const release = planningRelease();
  return {
    workflowId: release.workflowId,
    version: release.version,
    author: { displayName: "Reviewer" },
    sourceCommunityPostId: "42",
    provenance: { canonicalSource: { kind: "community-post", canonicalId: "42" }, licenseId: "MIT", derivedFrom: [] },
    content: {
      title: release.content.title,
      summary: release.content.summary,
      inputs: [],
      outputs: [],
      instructions: release.content.instructions,
      dependencies: release.content.dependencies
    },
    reviewStatus: release.reviewStatus,
    riskLevel: release.riskLevel,
    requiresPerUseConfirmation: false,
    releasedAt: "2026-08-08T00:00:00.000Z"
  };
}

function ownerWorkflow() {
  return {
    workflowId: WORKFLOW_ID,
    expectedRevision: 2,
    status: "draft",
    sourceCommunityPostId: "42",
    provenance: { licenseId: "MIT", derivedFrom: [], discoveredVia: [] },
    content: { ...planningRelease().content, secretPlaceholders: [{ name: "TOKEN", description: "Local only" }] },
    latestReleaseVersion: 1,
    rejectionReason: null,
    postReferences: [],
    allowedActions: ["update"]
  };
}

function localState() {
  return { profileId: "capability.reviewed", state: "installed", managed: true, enabled: true, hostInstalled: true };
}

function grant() {
  return {
    schemaVersion: 1,
    kind: "agent-capability-grant",
    receiptId: "grant-1",
    agentProductId: "example-agent",
    profileId: "capability.reviewed",
    resourceId: "reviewed-capability",
    hostProductId: "example-agent",
    bindingKind: "skill-context",
    agentContractVersion: "v1",
    grantedAt: "2026-08-08T00:00:00.000Z",
    revokedAt: null
  };
}

function session(agentId = "agent-a", overrides = {}) {
  return {
    schemaVersion: 1,
    kind: "agent-bridge-session",
    sessionId: `session-${agentId}`,
    agentId,
    grantId: `bridge-grant-${agentId}`,
    scopes: ["workflow:private", "local-state:read", "capability:plan", "capability:request"],
    grantedAt: "2026-08-08T00:00:00.000Z",
    revokedAt: null,
    localStates: [localState()],
    authorizationReceipts: [grant()],
    confirmations: [],
    vaultReferences: { TOKEN: "vault:22222222-2222-4222-8222-222222222222" },
    ...overrides
  };
}

function snapshot(activeSession = null, overrides = {}) {
  return {
    catalogResult: catalog(),
    publicWorkflows: [publicWorkflow()],
    ownerWorkflows: [ownerWorkflow()],
    planning: { workflowRelease: planningRelease(), agentBridgePlanInput: agentBridgePlanInput() },
    session: activeSession,
    ...overrides
  };
}

function broker(effects = ["read"]) {
  return createAgentCapabilityBroker({
    registry: {
      "capability.reviewed": {
        label: "Reviewed capability",
        moduleId: "skill-managed",
        extensionId: "reviewed-capability",
        hostProductId: "example-agent",
        capabilities: ["install"],
        adapterId: "fixed-adapter",
        agentBindingKinds: ["skill-context"],
        agentEffects: effects,
        agentContractVersion: "v1",
        platformSupport: PLATFORM_SUPPORT
      }
    },
    now: () => NOW,
    platformRequest: PLATFORM_REQUEST
  });
}

function bridge({ enabled = true, activeSession = session(), effects = ["read"], snapshotOverrides = {}, makeId } = {}) {
  return createLocalAgentBridge({
    enabled,
    readSnapshot: async ({ agentId, sessionId }) => snapshot(
      agentId === activeSession?.agentId && sessionId === activeSession?.sessionId ? activeSession : null,
      snapshotOverrides
    ),
    broker: broker(effects),
    now: () => NOW,
    makeId: makeId || (() => "plan-1")
  });
}

test("bridge is disabled by default and exposes only four non-executing operations", async () => {
  const disabled = createLocalAgentBridge();
  assert.deepEqual(Object.keys(disabled), ["search", "get", "plan", "request"]);
  assert.equal(typeof disabled.execute, "undefined");
  assert.equal((await disabled.search({ kind: "product", query: "", limit: 1 })).error.code, "BRIDGE_DISABLED");
  assert.equal((await createLocalAgentBridge({ enabled: "yes" }).search({
    kind: "product", query: "", limit: 1
  })).error.code, "BRIDGE_DISABLED");
});

test("anonymous search/get return reviewed public allowlists with exact source versions", async () => {
  const client = bridge();
  const products = await client.search({ kind: "product", query: "example", limit: 10 });
  assert.equal(products.ok, true);
  assert.equal(products.value.items[0].catalogVersion, 9);
  assert.equal(JSON.stringify(products).includes("https://"), false);

  const resource = await client.get({ kind: "resource", id: "reviewed-capability" });
  assert.equal(resource.value.reviewStatus, "manually-reviewed");
  assert.equal(resource.value.targets[0].installProfileId, "capability.reviewed");
  assert.equal(JSON.stringify(resource).includes("must-not-leak"), false);

  const workflow = await client.get({ kind: "workflow", id: WORKFLOW_ID, version: 1 });
  assert.equal(workflow.value.version, 1);
  assert.equal(workflow.value.visibility, "public");
  assert.equal("secretPlaceholders" in workflow.value.composition, false);
});

test("private and local views require an agent-bound session scope and revoke immediately", async () => {
  const ownSession = session("agent-a");
  const client = bridge({ activeSession: ownSession });
  assert.equal((await client.search({ kind: "workflow", query: "", limit: 10, visibility: "private" })).error.code, "SESSION_REQUIRED");
  const privateView = await client.get({
    kind: "workflow", id: WORKFLOW_ID, visibility: "private",
    agentId: "agent-a", sessionId: "session-agent-a"
  });
  assert.equal(privateView.ok, true);
  assert.equal(privateView.value.visibility, "private");
  assert.equal(JSON.stringify(privateView).includes("TOKEN"), false);
  assert.equal((await client.get({
    kind: "local-state", id: "capability.reviewed",
    agentId: "agent-b", sessionId: "session-agent-a"
  })).error.code, "SESSION_REQUIRED");

  const revoked = bridge({ activeSession: session("agent-a", { revokedAt: NOW }) });
  assert.equal((await revoked.get({
    kind: "local-state", id: "capability.reviewed",
    agentId: "agent-a", sessionId: "session-agent-a"
  })).error.code, "SESSION_REVOKED");
});

test("input gate rejects unknown fields, hostile prototypes, locations and 128 KiB payloads", async () => {
  const client = bridge();
  assert.equal((await client.search({ kind: "product", query: "", limit: 1, command: "whoami" })).error.code, "INPUT_INVALID");
  assert.equal((await client.search({ kind: "product", query: "https://example.com", limit: 1 })).error.code, "INPUT_INVALID");
  assert.equal((await client.search({ kind: "product", query: "x".repeat(MAX_INPUT_BYTES), limit: 1 })).error.code, "INPUT_TOO_LARGE");
  const hostile = Object.assign(Object.create({ inherited: true }), { kind: "product", query: "", limit: 1 });
  assert.equal((await client.search(hostile)).error.code, "INPUT_INVALID");
});

test("plan delegates to the Broker and fails closed without an exact planning release", async () => {
  const input = {
    agentId: "agent-a",
    sessionId: "session-agent-a",
    agentProductId: "example-agent",
    workflowId: WORKFLOW_ID,
    version: 1,
    useId: "use-1"
  };
  const ready = await bridge().plan(input);
  assert.equal(ready.value.status, "ready");
  assert.equal(ready.value.source.catalogVersion, 9);
  assert.equal(JSON.stringify(ready).includes("vault:"), false);
  assert.equal(JSON.stringify(ready).includes("grant-1"), false);

  const blocked = await bridge({ snapshotOverrides: { planning: null } }).plan(input);
  assert.equal(blocked.value.status, "blocked");
  assert.equal(blocked.value.reason, "WORKFLOW_COMPOSITION_UNAVAILABLE");

  const widened = agentBridgePlanInput();
  widened.requirements.push({ kind: "product", canonicalId: "unlisted-product", permissions: [] });
  const rejected = await bridge({
    snapshotOverrides: { planning: { workflowRelease: planningRelease(), agentBridgePlanInput: widened } }
  }).plan(input);
  assert.equal(rejected.value.status, "blocked");
  assert.equal(rejected.value.reason, "WORKFLOW_COMPOSITION_UNAVAILABLE");
});

test("snapshot adapter consumes only the exact planning resolver and normalized composition", async () => {
  const calls = [];
  const adapter = createLocalAgentBridgeSnapshotAdapter({
    readCatalogResult: async () => catalog(),
    readSession: async () => session("agent-a"),
    listPublicWorkflows: async () => [{ workflowId: WORKFLOW_ID, version: 1, content: { title: "public card" } }],
    resolvePlanningRelease: async (reference) => {
      calls.push(reference);
      return planningRelease({ secretPlaceholders: [{ name: "TOKEN", description: "Local only" }] });
    },
    resolveAgentBridgePlanInput: async ({ workflowRelease }) => {
      assert.equal(workflowRelease.workflowId, WORKFLOW_ID);
      return { agentBridgePlanInput: agentBridgePlanInput() };
    }
  });
  const client = createLocalAgentBridge({
    enabled: true,
    readSnapshot: adapter,
    broker: broker(),
    now: () => NOW,
    makeId: () => "resolver-plan"
  });
  const result = await client.plan({
    agentId: "agent-a", sessionId: "session-agent-a", agentProductId: "example-agent",
    workflowId: WORKFLOW_ID, version: 1, useId: "use-1"
  });
  assert.equal(result.value.status, "ready");
  assert.deepEqual(calls, [{ workflowId: WORKFLOW_ID, version: 1 }]);
  assert.equal(JSON.stringify(result).includes("TOKEN"), false);

  const blocked = createLocalAgentBridge({
    enabled: true,
    readSnapshot: createLocalAgentBridgeSnapshotAdapter({
      readCatalogResult: async () => catalog(),
      readSession: async () => session("agent-a"),
      resolvePlanningRelease: async () => null,
      resolveAgentBridgePlanInput: async () => agentBridgePlanInput()
    }),
    broker: broker(), now: () => NOW, makeId: () => "missing-plan"
  });
  assert.equal((await blocked.plan({
    agentId: "agent-a", sessionId: "session-agent-a", agentProductId: "example-agent",
    workflowId: WORKFLOW_ID, version: 1, useId: "use-1"
  })).value.reason, "WORKFLOW_COMPOSITION_UNAVAILABLE");
});

test("request only creates a per-use ticket bound to the originating agent and never executes", async () => {
  let sequence = 0;
  let snapshotReads = 0;
  const activeSession = session("agent-a");
  const client = createLocalAgentBridge({
    enabled: true,
    readSnapshot: async ({ agentId, sessionId }) => {
      snapshotReads += 1;
      return snapshot(agentId === "agent-a" && sessionId === "session-agent-a" ? activeSession : null);
    },
    broker: broker(["destructive"]),
    now: () => NOW,
    makeId: () => `bridge-id-${++sequence}`
  });
  const planned = await client.plan({
    agentId: "agent-a", sessionId: "session-agent-a", agentProductId: "example-agent",
    workflowId: WORKFLOW_ID, version: 1, useId: "use-1"
  });
  assert.equal(planned.value.status, "confirmation-required");
  const capabilityKey = planned.value.capabilities[0].capabilityKey;
  const ticket = await client.request({
    agentId: "agent-a", sessionId: "session-agent-a", planId: planned.value.planId,
    capabilityKey, useId: "use-1"
  });
  assert.equal(ticket.value.status, "pending-user-confirmation");
  assert.equal(ticket.value.useId, "use-1");
  assert.equal(snapshotReads, 2);
  assert.equal(typeof client.execute, "undefined");
  assert.equal((await client.request({
    agentId: "agent-b", sessionId: "session-agent-a", planId: planned.value.planId,
    capabilityKey, useId: "use-1"
  })).error.code, "SESSION_REQUIRED");
  assert.equal((await client.request({
    agentId: "agent-a", sessionId: "session-agent-a", planId: planned.value.planId,
    capabilityKey, useId: "use-2"
  })).error.code, "REQUEST_NOT_ALLOWED");
});

test("source errors and secret-shaped local values collapse to redacted structured errors", async () => {
  const client = createLocalAgentBridge({
    enabled: true,
    readSnapshot: async () => { throw new Error("token=super-secret https://internal.example"); },
    broker: broker(),
    now: () => NOW
  });
  const result = await client.search({ kind: "product", query: "", limit: 1 });
  assert.deepEqual(result.error, { code: "SOURCE_UNAVAILABLE", messageKey: "agent.bridge.unavailable" });
  assert.equal(JSON.stringify(result).includes("super-secret"), false);
  assert.equal(JSON.stringify(result).includes("internal.example"), false);

  const hostileBroker = createLocalAgentBridge({
    enabled: true,
    readSnapshot: async () => snapshot(session()),
    broker: { planWorkflow: () => ({
      status: "ready", reason: null, source: { catalogVersion: 9 },
      workflow: { workflowId: WORKFLOW_ID, version: 1 },
      capabilities: [{ token: "must-not-leak" }]
    }) },
    now: () => NOW,
    makeId: () => "plan-hostile"
  });
  const planned = await hostileBroker.plan({
    agentId: "agent-a", sessionId: "session-agent-a", agentProductId: "example-agent",
    workflowId: WORKFLOW_ID, version: 1, useId: "use-1"
  });
  assert.equal(planned.value.status, "blocked");
  assert.equal(JSON.stringify(planned).includes("must-not-leak"), false);
});
