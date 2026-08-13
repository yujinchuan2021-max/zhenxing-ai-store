"use strict";

const crypto = require("node:crypto");

const { createAgentCapabilityBroker } = require("./agent-capability-broker.cjs");
const { resourceReviewStatus, resourceRiskLevel } = require("./resource-store.cjs");

const MAX_INPUT_BYTES = 128 * 1024;
const PLAN_TTL_MS = 10 * 60 * 1000;
const REVIEWED = new Set(["automated-reviewed", "manually-reviewed"]);
const SEARCH_KINDS = new Set(["product", "resource", "workflow", "local-state"]);
const VISIBILITIES = new Set(["public", "private"]);
const ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_FIELDS = new Set([
  "__proto__", "prototype", "constructor", "command", "commands", "args",
  "arguments", "env", "environment", "headers", "credentials", "credential",
  "token", "tokens", "secret", "secrets", "script", "scripts", "shell",
  "endpoint", "url", "urls", "path", "paths", "cwd", "executable"
]);
const ERROR_MESSAGES = Object.freeze({
  BRIDGE_DISABLED: "agent.bridge.disabled",
  INPUT_INVALID: "agent.bridge.invalidInput",
  INPUT_TOO_LARGE: "agent.bridge.inputTooLarge",
  SOURCE_UNAVAILABLE: "agent.bridge.unavailable",
  ACTIVE_SIGNED_CATALOG_UNAVAILABLE: "agent.bridge.catalogUnavailable",
  SESSION_REQUIRED: "agent.bridge.sessionRequired",
  SESSION_REVOKED: "agent.bridge.sessionRevoked",
  SCOPE_REQUIRED: "agent.bridge.scopeRequired",
  NOT_FOUND: "agent.bridge.notFound",
  REQUEST_NOT_ALLOWED: "agent.bridge.requestNotAllowed"
});

function plain(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exact(value, allowed, required = allowed) {
  return plain(value) &&
    Object.keys(value).every((field) => allowed.includes(field)) &&
    required.every((field) => Object.hasOwn(value, field));
}

function timestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function safeTree(value, seen = new Set(), depth = 0) {
  if (value === null || typeof value !== "object") return true;
  if (depth > 32 || seen.has(value) || (!Array.isArray(value) && !plain(value))) return false;
  seen.add(value);
  for (const [field, child] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(field) || !safeTree(child, seen, depth + 1)) return false;
  }
  seen.delete(value);
  return true;
}

function hasArbitraryLocation(value, seen = new Set()) {
  if (typeof value === "string") {
    return /(?:https?|file):\/\/|^[A-Za-z]:\\|^\\\\|^\//i.test(value.trim());
  }
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((child) => hasArbitraryLocation(child, seen));
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function inputError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function validateExternalInput(input, fields, required = fields) {
  if (!exact(input, fields, required) || !safeTree(input) || hasArbitraryLocation(input)) {
    throw inputError("INPUT_INVALID");
  }
  let encoded;
  try {
    encoded = JSON.stringify(input);
  } catch {
    throw inputError("INPUT_INVALID");
  }
  if (Buffer.byteLength(encoded, "utf8") > MAX_INPUT_BYTES) {
    throw inputError("INPUT_TOO_LARGE");
  }
  return input;
}

function validId(value) {
  return typeof value === "string" && ID.test(value);
}

function validSession(session, agentId, sessionId) {
  return exact(session, [
    "schemaVersion", "kind", "sessionId", "agentId", "grantId", "scopes",
    "grantedAt", "revokedAt", "localStates", "authorizationReceipts",
    "confirmations", "vaultReferences"
  ]) && session.schemaVersion === 1 && session.kind === "agent-bridge-session" &&
    session.sessionId === sessionId && session.agentId === agentId &&
    validId(session.sessionId) && validId(session.agentId) && validId(session.grantId) &&
    Array.isArray(session.scopes) && new Set(session.scopes).size === session.scopes.length &&
    session.scopes.every(validId) && timestamp(session.grantedAt) &&
    (session.revokedAt === null || timestamp(session.revokedAt)) &&
    Array.isArray(session.localStates) && Array.isArray(session.authorizationReceipts) &&
    Array.isArray(session.confirmations) && plain(session.vaultReferences);
}

function publicCatalog(catalogResult) {
  const catalog = catalogResult?.catalog;
  return catalogResult?.source === "remote" &&
    Number.isSafeInteger(catalogResult.catalogVersion) && catalogResult.catalogVersion > 0 &&
    plain(catalog) && Array.isArray(catalog.vendors) && Array.isArray(catalog.resources) &&
    Array.isArray(catalog.resourceStores)
    ? catalog
    : null;
}

function productViews(catalog, catalogVersion) {
  const result = [];
  for (const vendor of catalog.vendors) {
    if (vendor?.enabled !== true || !validId(vendor.id)) continue;
    for (const product of Array.isArray(vendor.products) ? vendor.products : []) {
      if (product?.enabled !== true || !validId(product.id) || typeof product.name !== "string") continue;
      const view = {
        kind: "product",
        id: product.id,
        vendorId: vendor.id,
        name: product.name,
        productType: typeof product.productType === "string" ? product.productType : null,
        category: typeof product.category === "string" ? product.category : null,
        directoryKind: typeof product.directoryKind === "string" ? product.directoryKind : null,
        experience: typeof product.experience === "string" ? product.experience : null,
        catalogVersion
      };
      if (safeTree(view) && !hasArbitraryLocation(view)) result.push(freeze(view));
    }
  }
  return result;
}

function resourceViews(catalog, catalogVersion) {
  const enabledStores = new Set(catalog.resourceStores
    .filter((store) => store?.enabled === true && typeof store.kind === "string")
    .map((store) => store.kind));
  return catalog.resources.flatMap((resource) => {
    const reviewStatus = resourceReviewStatus(resource);
    const riskLevel = resourceRiskLevel(resource);
    if (resource?.enabled !== true || !validId(resource.id) || typeof resource.name !== "string" ||
        !REVIEWED.has(reviewStatus) || riskLevel === "unsafe" ||
        !Array.isArray(resource.resourceTypes) ||
        !resource.resourceTypes.some((kind) => enabledStores.has(kind))) return [];
    const targets = (Array.isArray(resource.targets) ? resource.targets : [])
      .filter((target) => target?.enabled === true && validId(target.productId))
      .map((target) => freeze({
        productId: target.productId,
        compatibility: typeof target.compatibility === "string" ? target.compatibility : null,
        moduleId: typeof target.moduleId === "string" ? target.moduleId : null,
        installProfileId: typeof target.installProfileId === "string" ? target.installProfileId : null,
        capabilities: Array.isArray(target.capabilities)
          ? target.capabilities.filter((capability) => typeof capability === "string")
          : []
      }));
    const view = {
      kind: "resource",
      id: resource.id,
      name: resource.name,
      description: typeof resource.description === "string" ? resource.description : "",
      resourceTypes: resource.resourceTypes.filter((kind) => enabledStores.has(kind)),
      sourceKind: typeof resource.sourceKind === "string" ? resource.sourceKind : null,
      reviewStatus,
      riskLevel,
      targets,
      catalogVersion
    };
    return safeTree(view) && !hasArbitraryLocation(view) ? [freeze(view)] : [];
  });
}

function publicWorkflowView(workflow, detail = false) {
  if (!plain(workflow) || !UUID.test(String(workflow.workflowId || "")) ||
      !Number.isSafeInteger(workflow.version) || workflow.version < 1 ||
      !REVIEWED.has(workflow.reviewStatus) || !["low", "guarded"].includes(workflow.riskLevel) ||
      !plain(workflow.content) || typeof workflow.content.title !== "string" ||
      typeof workflow.content.summary !== "string") return null;
  const view = {
    kind: "workflow",
    id: workflow.workflowId,
    version: workflow.version,
    title: workflow.content.title,
    summary: workflow.content.summary,
    reviewStatus: workflow.reviewStatus,
    riskLevel: workflow.riskLevel,
    requiresPerUseConfirmation: workflow.requiresPerUseConfirmation === true,
    visibility: "public"
  };
  if (detail) {
    if (![workflow.content.inputs, workflow.content.outputs, workflow.content.instructions,
      workflow.content.dependencies].every(Array.isArray)) return null;
    view.composition = {
      inputs: copy(workflow.content.inputs),
      outputs: copy(workflow.content.outputs),
      instructions: copy(workflow.content.instructions),
      dependencies: copy(workflow.content.dependencies)
    };
  }
  return safeTree(view) && !hasArbitraryLocation(view) ? freeze(view) : null;
}

function ownerWorkflowView(workflow, detail = false) {
  if (!plain(workflow) || !UUID.test(String(workflow.workflowId || "")) ||
      !Number.isSafeInteger(workflow.expectedRevision) || workflow.expectedRevision < 1 ||
      typeof workflow.status !== "string" || !plain(workflow.content) ||
      typeof workflow.content.title !== "string" || typeof workflow.content.summary !== "string") return null;
  const view = {
    kind: "workflow",
    id: workflow.workflowId,
    version: workflow.latestReleaseVersion || null,
    expectedRevision: workflow.expectedRevision,
    status: workflow.status,
    title: workflow.content.title,
    summary: workflow.content.summary,
    visibility: "private"
  };
  if (detail) {
    if (![workflow.content.inputs, workflow.content.outputs, workflow.content.instructions,
      workflow.content.dependencies].every(Array.isArray)) return null;
    view.composition = {
      inputs: copy(workflow.content.inputs),
      outputs: copy(workflow.content.outputs),
      instructions: copy(workflow.content.instructions),
      dependencies: copy(workflow.content.dependencies)
    };
  }
  return safeTree(view) && !hasArbitraryLocation(view) ? freeze(view) : null;
}

function localStateViews(states) {
  return states.flatMap((state) => exact(state, [
    "profileId", "state", "managed", "enabled", "hostInstalled"
  ]) && typeof state.profileId === "string" && typeof state.state === "string" &&
    typeof state.managed === "boolean" && typeof state.enabled === "boolean" &&
    typeof state.hostInstalled === "boolean"
    ? [freeze({ kind: "local-state", ...state })]
    : []);
}

function exactDependency(dependency) {
  const fields = dependency?.kind === "resource"
    ? ["kind", "canonicalId", "hostProductId", "bindingKind", "permissions"]
    : ["kind", "canonicalId", "permissions"];
  return exact(dependency, fields) && ["product", "resource"].includes(dependency.kind) &&
    validId(dependency.canonicalId) && Array.isArray(dependency.permissions) &&
    dependency.permissions.every((permission) => typeof permission === "string") &&
    (dependency.kind !== "resource" ||
      (validId(dependency.hostProductId) && typeof dependency.bindingKind === "string"));
}

function dependencyKey(dependency) {
  return JSON.stringify({
    kind: dependency.kind,
    canonicalId: dependency.canonicalId,
    hostProductId: dependency.kind === "resource" ? dependency.hostProductId : null,
    bindingKind: dependency.kind === "resource" ? dependency.bindingKind : null,
    permissions: dependency.permissions
  });
}

function planningReleaseFor(snapshot, input) {
  const planning = snapshot?.planning;
  if (!exact(planning, ["workflowRelease", "agentBridgePlanInput"]) ||
      !plain(planning.workflowRelease) || !plain(planning.agentBridgePlanInput)) return null;
  const release = planning.workflowRelease;
  const composition = planning.agentBridgePlanInput;
  if (release.workflowId !== input.workflowId || release.version !== input.version ||
      composition.contractVersion !== 1 || !exact(composition.workflow, ["workflowId", "version"]) ||
      composition.workflow.workflowId !== release.workflowId || composition.workflow.version !== release.version ||
      (composition.primaryAgentProductId !== null && composition.primaryAgentProductId !== input.agentProductId) ||
      (composition.requiredAgentHostProductId !== null && composition.requiredAgentHostProductId !== input.agentProductId) ||
      !Array.isArray(composition.requirements) || !Array.isArray(composition.steps) ||
      !composition.requirements.every(exactDependency) || !safeTree(composition) ||
      hasArbitraryLocation(composition)) return null;
  const allowed = release?.content?.dependencies;
  if (!Array.isArray(allowed) || !allowed.every(exactDependency)) return null;
  const required = new Set(composition.requirements.map(dependencyKey));
  const releaseDependencies = new Set(allowed.map(dependencyKey));
  if (required.size !== composition.requirements.length ||
      ![...required].every((dependency) => releaseDependencies.has(dependency))) return null;
  return freeze({
    ...copy(release),
    content: { ...copy(release.content), dependencies: copy(composition.requirements) }
  });
}

function createLocalAgentBridge({
  enabled = false,
  readSnapshot = async () => ({}),
  broker = createAgentCapabilityBroker(),
  now = () => new Date().toISOString(),
  makeId = crypto.randomUUID
} = {}) {
  if (typeof readSnapshot !== "function" || typeof broker?.planWorkflow !== "function" ||
      typeof now !== "function" || typeof makeId !== "function") {
    throw new TypeError("Local Agent Bridge options are invalid");
  }
  const active = enabled === true;
  const plans = new Map();

  const audit = (operation, decision, agentId = null, useId = null) => freeze({
    event: "local-agent-bridge-request",
    operation,
    decision,
    agentId: validId(agentId) ? agentId : null,
    useId: validId(useId) ? useId : null,
    at: String(now())
  });
  const failure = (operation, code, agentId = null, useId = null) => freeze({
    ok: false,
    error: { code, messageKey: ERROR_MESSAGES[code] || ERROR_MESSAGES.INPUT_INVALID },
    audit: [audit(operation, code, agentId, useId)]
  });
  const success = (operation, value, agentId = null, useId = null) => freeze({
    ok: true,
    value,
    audit: [audit(operation, "allowed", agentId, useId)]
  });

  async function context(operation, input, scope = null) {
    if (!active) return { error: failure(operation, "BRIDGE_DISABLED", input?.agentId, input?.useId) };
    let snapshot;
    try {
      snapshot = await readSnapshot({
        agentId: input.agentId || null,
        sessionId: input.sessionId || null,
        workflow: operation === "plan"
          ? { workflowId: input.workflowId, version: input.version }
          : null
      });
    } catch {
      return { error: failure(operation, "SOURCE_UNAVAILABLE", input.agentId, input.useId) };
    }
    if (!plain(snapshot)) return { error: failure(operation, "SOURCE_UNAVAILABLE", input.agentId, input.useId) };
    if (!scope) return { snapshot, session: null };
    if (!validId(input.agentId) || !validId(input.sessionId)) {
      return { error: failure(operation, "SESSION_REQUIRED", input.agentId, input.useId) };
    }
    if (!validSession(snapshot.session, input.agentId, input.sessionId)) {
      return { error: failure(operation, "SESSION_REQUIRED", input.agentId, input.useId) };
    }
    if (snapshot.session.revokedAt !== null) {
      return { error: failure(operation, "SESSION_REVOKED", input.agentId, input.useId) };
    }
    if (!snapshot.session.scopes.includes(scope)) {
      return { error: failure(operation, "SCOPE_REQUIRED", input.agentId, input.useId) };
    }
    return { snapshot, session: snapshot.session };
  }

  function views(snapshot, session, kind, visibility, detail = false) {
    if (kind === "workflow") {
      const source = visibility === "private" ? snapshot.ownerWorkflows : snapshot.publicWorkflows;
      if (!Array.isArray(source)) return [];
      return source.map((workflow) => visibility === "private"
        ? ownerWorkflowView(workflow, detail)
        : publicWorkflowView(workflow, detail)).filter(Boolean);
    }
    const catalog = publicCatalog(snapshot.catalogResult);
    if (!catalog) return null;
    if (kind === "product") return productViews(catalog, snapshot.catalogResult.catalogVersion);
    if (kind === "resource") return resourceViews(catalog, snapshot.catalogResult.catalogVersion);
    return localStateViews(session?.localStates || []);
  }

  async function search(input) {
    const operation = "search";
    try {
      validateExternalInput(input, ["kind", "query", "limit", "visibility", "agentId", "sessionId"], ["kind", "query", "limit"]);
      if (!SEARCH_KINDS.has(input.kind) || typeof input.query !== "string" || input.query.length > 200 ||
          !Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 50 ||
          (input.visibility !== undefined && !VISIBILITIES.has(input.visibility))) throw inputError("INPUT_INVALID");
    } catch (error) {
      return failure(operation, error.code || "INPUT_INVALID", input?.agentId);
    }
    const visibility = input.visibility || "public";
    if (input.kind !== "workflow" && input.visibility !== undefined) return failure(operation, "INPUT_INVALID", input.agentId);
    const scope = input.kind === "local-state" ? "local-state:read"
      : visibility === "private" ? "workflow:private" : null;
    const state = await context(operation, input, scope);
    if (state.error) return state.error;
    const candidates = views(state.snapshot, state.session, input.kind, visibility);
    if (candidates === null) return failure(operation, "ACTIVE_SIGNED_CATALOG_UNAVAILABLE", input.agentId);
    const query = input.query.trim().toLowerCase();
    const items = candidates.filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query)).slice(0, input.limit);
    return success(operation, freeze({ items, count: items.length }), input.agentId);
  }

  async function get(input) {
    const operation = "get";
    try {
      validateExternalInput(input, ["kind", "id", "version", "visibility", "agentId", "sessionId"], ["kind", "id"]);
      if (!SEARCH_KINDS.has(input.kind) || !validId(input.id) ||
          (input.version !== undefined && (!Number.isSafeInteger(input.version) || input.version < 1)) ||
          (input.visibility !== undefined && !VISIBILITIES.has(input.visibility))) throw inputError("INPUT_INVALID");
    } catch (error) {
      return failure(operation, error.code || "INPUT_INVALID", input?.agentId);
    }
    const visibility = input.visibility || "public";
    if (input.kind !== "workflow" && (input.visibility !== undefined || input.version !== undefined)) {
      return failure(operation, "INPUT_INVALID", input.agentId);
    }
    const scope = input.kind === "local-state" ? "local-state:read"
      : visibility === "private" ? "workflow:private" : null;
    const state = await context(operation, input, scope);
    if (state.error) return state.error;
    const candidates = views(state.snapshot, state.session, input.kind, visibility, true);
    if (candidates === null) return failure(operation, "ACTIVE_SIGNED_CATALOG_UNAVAILABLE", input.agentId);
    const matches = candidates.filter((item) => item.id === input.id &&
      (input.version === undefined || item.version === input.version));
    return matches.length === 1
      ? success(operation, matches[0], input.agentId)
      : failure(operation, "NOT_FOUND", input.agentId);
  }

  async function plan(input) {
    const operation = "plan";
    try {
      validateExternalInput(input, [
        "agentId", "sessionId", "agentProductId", "workflowId", "version", "useId"
      ]);
      if (![input.agentId, input.sessionId, input.agentProductId, input.useId].every(validId) ||
          !UUID.test(input.workflowId) || !Number.isSafeInteger(input.version) || input.version < 1) {
        throw inputError("INPUT_INVALID");
      }
    } catch (error) {
      return failure(operation, error.code || "INPUT_INVALID", input?.agentId, input?.useId);
    }
    const state = await context(operation, input, "capability:plan");
    if (state.error) return state.error;
    const workflowRelease = planningReleaseFor(state.snapshot, input);
    let result;
    if (!workflowRelease) {
      result = freeze({ status: "blocked", reason: "WORKFLOW_COMPOSITION_UNAVAILABLE", source: null, workflow: null, capabilities: [], audit: [] });
    } else try {
      result = broker.planWorkflow({
        agentProductId: input.agentProductId,
        useId: input.useId,
        catalogResult: state.snapshot.catalogResult,
        workflowRelease,
        localStates: state.session.localStates,
        authorizationReceipts: state.session.authorizationReceipts,
        confirmations: state.session.confirmations,
        vaultReferences: state.session.vaultReferences
      });
    } catch {
      result = freeze({ status: "blocked", reason: "BROKER_FAILED", source: null, workflow: null, capabilities: [], audit: [] });
    }
    const publicResult = {
      status: result?.status,
      reason: result?.reason,
      source: result?.source,
      workflow: result?.workflow,
      capabilities: result?.capabilities
    };
    if (!["ready", "confirmation-required", "blocked"].includes(publicResult.status) ||
        !Array.isArray(publicResult.capabilities) || !safeTree(publicResult) ||
        hasArbitraryLocation(publicResult)) {
      result = freeze({ status: "blocked", reason: "BROKER_FAILED", source: null, workflow: null, capabilities: [], audit: [] });
    }
    const planId = String(makeId());
    if (!validId(planId)) return failure(operation, "SOURCE_UNAVAILABLE", input.agentId, input.useId);
    const createdAt = String(now());
    if (!timestamp(createdAt)) return failure(operation, "SOURCE_UNAVAILABLE", input.agentId, input.useId);
    if (plans.size >= 256) plans.delete(plans.keys().next().value);
    plans.set(planId, freeze({
      agentId: input.agentId,
      sessionId: input.sessionId,
      useId: input.useId,
      status: result.status,
      capabilityKeys: result.capabilities
        .filter((capability) => capability.status === "confirmation-required")
        .map((capability) => capability.capabilityKey),
      createdAt
    }));
    const value = freeze({
      planId,
      status: ["ready", "confirmation-required", "blocked"].includes(result.status) ? result.status : "blocked",
      reason: typeof result.reason === "string" || result.reason === null ? result.reason : "BROKER_FAILED",
      source: result.source ? copy(result.source) : null,
      workflow: result.workflow ? copy(result.workflow) : null,
      capabilities: copy(result.capabilities || [])
    });
    return success(operation, value, input.agentId, input.useId);
  }

  async function request(input) {
    const operation = "request";
    try {
      validateExternalInput(input, ["agentId", "sessionId", "planId", "capabilityKey", "useId"]);
      if (![input.agentId, input.sessionId, input.planId, input.capabilityKey, input.useId].every(validId)) {
        throw inputError("INPUT_INVALID");
      }
    } catch (error) {
      return failure(operation, error.code || "INPUT_INVALID", input?.agentId, input?.useId);
    }
    const state = await context(operation, input, "capability:request");
    if (state.error) return state.error;
    const currentTime = Date.parse(String(now()));
    const planned = plans.get(input.planId);
    if (!Number.isFinite(currentTime) || !planned || planned.agentId !== input.agentId ||
        planned.sessionId !== input.sessionId || planned.useId !== input.useId ||
        currentTime - Date.parse(planned.createdAt) > PLAN_TTL_MS ||
        planned.status !== "confirmation-required" ||
        !planned.capabilityKeys.includes(input.capabilityKey)) {
      return failure(operation, "REQUEST_NOT_ALLOWED", input.agentId, input.useId);
    }
    const requestId = String(makeId());
    if (!validId(requestId)) return failure(operation, "SOURCE_UNAVAILABLE", input.agentId, input.useId);
    return success(operation, freeze({
      schemaVersion: 1,
      kind: "agent-capability-confirmation-request",
      requestId,
      planId: input.planId,
      agentId: input.agentId,
      useId: input.useId,
      capabilityKey: input.capabilityKey,
      status: "pending-user-confirmation",
      expiresAt: new Date(currentTime + PLAN_TTL_MS).toISOString()
    }), input.agentId, input.useId);
  }

  return Object.freeze({ search, get, plan, request });
}

module.exports = {
  MAX_INPUT_BYTES,
  createLocalAgentBridge
};
