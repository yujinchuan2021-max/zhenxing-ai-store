"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createAgentCapabilityBroker
} = require("../shared/agent-capability-broker.cjs");

const NOW = "2026-08-07T00:05:00.000Z";
const WORKFLOW_ID = "11111111-1111-4111-8111-111111111111";
const BINDING_SEMANTICS = {
  "skill-context": "controlled-context-package",
  "mcp-tool": "mcp-tool",
  "mcp-resource": "mcp-resource",
  "mcp-prompt": "mcp-prompt",
  "plugin-host-extension": "fixed-host-extension",
  "connector-authorized-connection": "authorized-remote-connection"
};
const PLATFORM_SUPPORT = [{
  platform: "windows",
  runtime: "native",
  status: "supported",
  architectures: ["x64"],
  evidence: [{
    kind: "first-party",
    url: "https://example.com/platform-support",
    observedAt: "2026-08-07T00:00:00.000Z"
  }]
}];
const PLATFORM_REQUEST = {
  platform: "windows",
  runtime: "native",
  architecture: "x64",
  runtimeDependencies: []
};

function profile(bindingKind = "skill-context", effects = ["read"]) {
  const moduleId = bindingKind === "skill-context" ? "skill-managed"
    : bindingKind.startsWith("mcp-") ? "mcp-managed"
      : bindingKind === "plugin-host-extension" ? "plugin-managed"
        : "connector-managed";
  return {
    label: "Reviewed capability",
    moduleId,
    extensionId: "reviewed-capability",
    hostProductId: "example-agent",
    capabilities: ["install"],
    adapterId: "fixed-adapter",
    agentBindingKinds: [bindingKind],
    agentEffects: effects,
    agentContractVersion: "v1",
    platformSupport: PLATFORM_SUPPORT
  };
}

function catalog(bindingKind = "skill-context", overrides = {}) {
  const resourceType = bindingKind === "skill-context" ? "skill"
    : bindingKind.startsWith("mcp-") ? "mcp"
      : bindingKind === "plugin-host-extension" ? "plugin"
        : "connector";
  return {
    source: "remote",
    catalogVersion: 9,
    catalog: {
      resourceStores: [
        { id: "skill", enabled: true },
        { id: "mcp", enabled: true },
        { id: "plugin", enabled: true },
        { id: "connector", enabled: true }
      ],
      resources: [{
        id: "reviewed-capability",
        enabled: true,
        resourceTypes: [resourceType],
        sourceKind: "official",
        reviewStatus: "manually-reviewed",
        riskLevel: "low",
        website: "https://example.com/capability",
        targets: [{
          productId: "example-agent",
          moduleId: profile(bindingKind).moduleId,
          installProfileId: "capability.reviewed",
          capabilities: ["install"],
          enabled: true
        }],
        platformSupport: PLATFORM_SUPPORT,
        ...overrides
      }],
      vendors: [{
        id: "example",
        enabled: true,
        products: [{
          id: "example-agent",
          enabled: true,
          directoryKind: "ai-tool",
          platformSupport: PLATFORM_SUPPORT
        }]
      }]
    }
  };
}

function workflow(bindingKind = "skill-context", overrides = {}) {
  return {
    workflowId: WORKFLOW_ID,
    version: 1,
    reviewStatus: "manually-reviewed",
    riskLevel: "low",
    content: {
      title: "Reviewed workflow",
      summary: "Data-only orchestration references.",
      inputs: [],
      outputs: [],
      instructions: ["Use the reviewed capability."],
      dependencies: [{
        kind: "resource",
        canonicalId: "reviewed-capability",
        hostProductId: "example-agent",
        bindingKind,
        permissions: ["none"]
      }],
      secretPlaceholders: []
    },
    ...overrides
  };
}

function localState(bindingKind = "skill-context") {
  return {
    profileId: "capability.reviewed",
    state: bindingKind === "connector-authorized-connection" ? "connected" : "installed",
    managed: bindingKind !== "connector-authorized-connection",
    enabled: true,
    hostInstalled: true
  };
}

function grant(bindingKind = "skill-context") {
  return {
    schemaVersion: 1,
    kind: "agent-capability-grant",
    receiptId: "grant-1",
    agentProductId: "example-agent",
    profileId: "capability.reviewed",
    resourceId: "reviewed-capability",
    hostProductId: "example-agent",
    bindingKind,
    agentContractVersion: "v1",
    grantedAt: "2026-08-07T00:00:00.000Z",
    revokedAt: null
  };
}

function input(bindingKind = "skill-context", overrides = {}) {
  return {
    useId: "use-1",
    agentProductId: "example-agent",
    catalogResult: catalog(bindingKind),
    workflowRelease: workflow(bindingKind),
    localStates: [localState(bindingKind)],
    authorizationReceipts: [grant(bindingKind)],
    confirmations: [],
    vaultReferences: {},
    ...overrides
  };
}

function broker(bindingKind = "skill-context", effects = ["read"]) {
  return createAgentCapabilityBroker({
    registry: { "capability.reviewed": profile(bindingKind, effects) },
    now: () => NOW,
    platformRequest: PLATFORM_REQUEST
  });
}

test("available capabilities are the signed catalog, fixed registry, local state and grant intersection", () => {
  const plan = broker().planWorkflow(input());
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.source, { catalogVersion: 9 });
  assert.deepEqual(plan.capabilities.map((entry) => ({
    semantics: entry.semantics,
    bindingKind: entry.bindingKind,
    status: entry.status
  })), [{
    semantics: "controlled-context-package",
    bindingKind: "skill-context",
    status: "available"
  }]);
  assert.equal(typeof broker().invoke, "undefined");
  assert.deepEqual(Object.keys(broker()), ["planWorkflow"]);
  assert.equal(JSON.stringify(plan).includes("https://"), false);
  assert.deepEqual({
    platform: plan.capabilities[0].platform,
    runtime: plan.capabilities[0].runtime,
    architecture: plan.capabilities[0].architecture
  }, {
    platform: "windows",
    runtime: "native",
    architecture: "x64"
  });
});

test("Agent binding consumes the shared platform intersection and current fieldless catalog fails closed", () => {
  assert.equal(createAgentCapabilityBroker({
    registry: { "capability.reviewed": profile() },
    now: () => NOW
  }).planWorkflow(input("skill-context", {
    platformRequest: PLATFORM_REQUEST
  })).reason, "PLATFORM_AVAILABILITY_NOT_APPROVED");

  const withoutResourceClaim = catalog();
  delete withoutResourceClaim.catalog.resources[0].platformSupport;
  assert.equal(broker().planWorkflow(input("skill-context", {
    catalogResult: withoutResourceClaim
  })).reason, "PLATFORM_AVAILABILITY_NOT_APPROVED");

  const withoutHostClaim = catalog();
  delete withoutHostClaim.catalog.vendors[0].products[0].platformSupport;
  assert.equal(broker().planWorkflow(input("skill-context", {
    catalogResult: withoutHostClaim
  })).reason, "PLATFORM_AVAILABILITY_NOT_APPROVED");

  const registryProfile = profile();
  delete registryProfile.platformSupport;
  assert.equal(createAgentCapabilityBroker({
    registry: { "capability.reviewed": registryProfile },
    now: () => NOW,
    platformRequest: PLATFORM_REQUEST
  }).planWorkflow(input()).reason, "PLATFORM_AVAILABILITY_NOT_APPROVED");
});

test("every binding kind keeps its exact non-invoke semantics", () => {
  for (const bindingKind of Object.keys(BINDING_SEMANTICS)) {
    const plan = broker(bindingKind).planWorkflow(input(bindingKind));
    assert.equal(plan.status, "ready", bindingKind);
    assert.equal(plan.capabilities[0].semantics, BINDING_SEMANTICS[bindingKind]);
    assert.equal(plan.capabilities[0].bindingKind, bindingKind);
  }
});

test("guarded, write, external, paid and destructive bindings require a fresh per-use confirmation", () => {
  for (const effect of ["write", "external-side-effect", "paid", "destructive"]) {
    const planner = broker("skill-context", [effect]);
    assert.equal(planner.planWorkflow(input()).status, "confirmation-required", effect);
    const capabilityKey = "reviewed-capability:example-agent:skill-context:capability.reviewed";
    const confirmed = planner.planWorkflow(input("skill-context", {
      confirmations: [{
        schemaVersion: 1,
        kind: "agent-capability-confirmation",
        confirmationId: `confirmation-${effect}`,
        useId: "use-1",
        capabilityKey,
        confirmedAt: "2026-08-07T00:04:00.000Z",
        expiresAt: "2026-08-07T00:10:00.000Z"
      }]
    }));
    assert.equal(confirmed.status, "ready", effect);
    assert.equal(confirmed.audit[0].confirmationId, `confirmation-${effect}`);
  }
  assert.equal(broker().planWorkflow(input("skill-context", {
    workflowRelease: workflow("skill-context", { riskLevel: "guarded" })
  })).status, "confirmation-required");
  const writeWorkflow = workflow();
  writeWorkflow.content.dependencies[0].permissions = ["write-selected-output"];
  assert.equal(broker().planWorkflow(input("skill-context", {
    workflowRelease: writeWorkflow
  })).status, "confirmation-required");
  assert.equal(broker().planWorkflow(input("skill-context", {
    catalogResult: catalog("skill-context", { riskLevel: "guarded" })
  })).status, "confirmation-required");
  assert.equal(broker().planWorkflow(input("skill-context", {
    confirmations: [{
      schemaVersion: 1,
      kind: "agent-capability-confirmation",
      confirmationId: "expired-confirmation",
      useId: "use-1",
      capabilityKey: "reviewed-capability:example-agent:skill-context:capability.reviewed",
      confirmedAt: "2026-08-06T23:00:00.000Z",
      expiresAt: "2026-08-06T23:05:00.000Z"
    }],
    workflowRelease: workflow("skill-context", { riskLevel: "guarded" })
  })).status, "confirmation-required");
});

test("unsafe, rejected, unreviewed and incomplete local intersections fail closed", () => {
  assert.equal(broker().planWorkflow(input("skill-context", {
    catalogResult: { ...catalog(), source: "packaged" }
  })).reason, "ACTIVE_SIGNED_CATALOG_UNAVAILABLE");
  assert.equal(broker().planWorkflow(input("skill-context", {
    workflowRelease: workflow("skill-context", { riskLevel: "unsafe" })
  })).reason, "WORKFLOW_NOT_BINDABLE");
  assert.equal(broker().planWorkflow(input("skill-context", {
    catalogResult: catalog("skill-context", { reviewStatus: "rejected", riskLevel: "unsafe" })
  })).reason, "CATALOG_BINDING_NOT_APPROVED");
  assert.equal(broker().planWorkflow(input("skill-context", {
    localStates: [{ ...localState(), enabled: false }]
  })).reason, "LOCAL_CAPABILITY_UNAVAILABLE");
  assert.equal(broker().planWorkflow(input("skill-context", {
    authorizationReceipts: []
  })).reason, "LOCAL_AUTHORIZATION_REQUIRED");
  assert.equal(broker().planWorkflow(input("skill-context", {
    authorizationReceipts: [{ ...grant(), secret: "must-not-fit-receipt-schema" }]
  })).reason, "LOCAL_AUTHORIZATION_REQUIRED");
  assert.equal(broker().planWorkflow(input("skill-context", {
    authorizationReceipts: [{ ...grant(), agentContractVersion: "v0" }]
  })).reason, "LOCAL_AUTHORIZATION_REQUIRED");
  assert.equal(createAgentCapabilityBroker({ registry: {}, now: () => NOW })
    .planWorkflow(input()).reason, "LOCAL_PROFILE_NOT_APPROVED");
});

test("workflow and catalog execution fields, arbitrary locations and secret values never cross the seam", () => {
  for (const field of ["command", "args", "env", "headers", "credentials", "script", "url", "path", "nodes"]) {
    const release = workflow();
    release.content[field] = field === "url" ? "https://example.com/run" : "secret";
    assert.equal(broker().planWorkflow(input("skill-context", {
      workflowRelease: release
    })).reason, "WORKFLOW_NOT_BINDABLE", field);
  }
  const withUrlText = workflow();
  withUrlText.content.instructions = ["Open https://example.com/run"];
  assert.equal(broker().planWorkflow(input("skill-context", {
    workflowRelease: withUrlText
  })).reason, "WORKFLOW_NOT_BINDABLE");
  assert.equal(broker().planWorkflow(input("skill-context", {
    catalogResult: catalog("skill-context", { command: "whoami" })
  })).reason, "CATALOG_BINDING_NOT_APPROVED");

  const withSecret = workflow();
  withSecret.content.secretPlaceholders = [{ name: "TOKEN", description: "Local only" }];
  withSecret.content.dependencies[0].permissions = ["secret-placeholder"];
  assert.equal(broker().planWorkflow(input("skill-context", {
    workflowRelease: withSecret,
    vaultReferences: { TOKEN: "actual-secret-value" }
  })).reason, "LOCAL_VAULT_REFERENCE_MISSING");
  const result = broker().planWorkflow(input("skill-context", {
    workflowRelease: withSecret,
    vaultReferences: { TOKEN: "vault:22222222-2222-4222-8222-222222222222" }
  }));
  assert.equal(result.status, "confirmation-required");
  assert.equal(JSON.stringify(result).includes("vault:"), false);
  assert.equal(JSON.stringify(result).includes("actual-secret"), false);
});

test("product dependencies remain non-executable canonical references", () => {
  const release = workflow();
  release.content.dependencies.unshift({
    kind: "product",
    canonicalId: "example-agent",
    permissions: ["none"]
  });
  const plan = broker().planWorkflow(input("skill-context", { workflowRelease: release }));
  assert.equal(plan.status, "ready");
  assert.equal(plan.audit[0].event, "workflow-product-reference-planned");
  assert.equal(plan.audit[0].decision, "reference-only");
  release.content.dependencies[0].permissions = ["write-selected-output"];
  assert.equal(broker().planWorkflow(input("skill-context", {
    workflowRelease: release
  })).reason, "PRODUCT_REFERENCE_NOT_BINDABLE");
});
