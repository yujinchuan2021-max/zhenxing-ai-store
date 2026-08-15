"use strict";

const {
  DEPENDENCY_PERMISSIONS,
  RESOURCE_BINDING_KINDS
} = require("../community/workflow-store.cjs");
const {
  resourceReviewStatus,
  resourceRiskLevel
} = require("./resource-store.cjs");
const {
  EXTENSION_INSTALL_REGISTRY
} = require("./extension-install-registry.cjs");
const {
  projectResourcePlatformAvailability
} = require("./resource-platform-availability.cjs");

const REVIEWED = new Set(["automated-reviewed", "manually-reviewed"]);
const BINDING_KINDS = new Set(RESOURCE_BINDING_KINDS);
const PERMISSIONS = new Set(DEPENDENCY_PERMISSIONS);
const EFFECTS = new Set([
  "read",
  "write",
  "external-side-effect",
  "paid",
  "destructive"
]);
const CONFIRMATION_EFFECTS = new Set([
  "write",
  "external-side-effect",
  "paid",
  "destructive"
]);
const CONFIRMATION_PERMISSIONS = new Set([
  "write-selected-output",
  "approved-network",
  "secret-placeholder"
]);
const BINDING_MODULES = Object.freeze({
  "skill-context": "skill-managed",
  "mcp-tool": "mcp-managed",
  "mcp-resource": "mcp-managed",
  "mcp-prompt": "mcp-managed",
  "plugin-host-extension": "plugin-managed",
  "connector-authorized-connection": "connector-managed"
});
const BINDING_SEMANTICS = Object.freeze({
  "skill-context": "controlled-context-package",
  "mcp-tool": "mcp-tool",
  "mcp-resource": "mcp-resource",
  "mcp-prompt": "mcp-prompt",
  "plugin-host-extension": "fixed-host-extension",
  "connector-authorized-connection": "authorized-remote-connection"
});
const FORBIDDEN_FIELDS = new Set([
  "args",
  "arguments",
  "command",
  "commands",
  "credentials",
  "cwd",
  "endpoint",
  "env",
  "environment",
  "executable",
  "headers",
  "path",
  "paths",
  "script",
  "scripts",
  "shell",
  "url",
  "urls"
]);
const ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const PROFILE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const VAULT_REFERENCE = /^vault:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRMATION_MAX_AGE_MS = 10 * 60 * 1000;

function isObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactObject(value, fields) {
  return isObject(value) &&
    Object.keys(value).length === fields.length &&
    Object.keys(value).every((field) => fields.includes(field));
}

function timestamp(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function hasForbiddenField(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasForbiddenField(item, seen));
  return Object.entries(value).some(([field, nested]) =>
    FORBIDDEN_FIELDS.has(field) || hasForbiddenField(nested, seen)
  );
}

function hasForbiddenCatalogField(value) {
  if (!isObject(value)) return true;
  const { platformSupport: _platformSupport, ...rest } = value;
  return hasForbiddenField(rest);
}

function workflowHasArbitraryLocation(value, seen = new Set()) {
  if (typeof value === "string") {
    return /(?:https?|file):\/\/|^[A-Za-z]:\\|^\\\\|^\//i.test(value.trim());
  }
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((nested) => workflowHasArbitraryLocation(nested, seen));
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function publicCatalog(catalogResult) {
  const catalog = catalogResult?.catalog;
  return catalogResult?.source === "remote" &&
    Number.isSafeInteger(catalogResult.catalogVersion) &&
    catalogResult.catalogVersion > 0 &&
    isObject(catalog) &&
    Array.isArray(catalog.resourceStores) &&
    Array.isArray(catalog.resources) &&
    Array.isArray(catalog.vendors)
    ? catalog
    : null;
}

function catalogHost(catalog, productId) {
  const matches = [];
  for (const vendor of catalog.vendors) {
    for (const product of Array.isArray(vendor?.products) ? vendor.products : []) {
      if (product?.id === productId) matches.push({ vendor, product });
    }
  }
  return matches.length === 1 &&
    matches[0].vendor.enabled === true &&
    matches[0].product.enabled === true &&
    matches[0].product.directoryKind === "ai-tool"
    ? matches[0].product
    : null;
}

function catalogBinding(catalog, dependency, profileId, profile) {
  const kind = dependency.bindingKind.split("-")[0];
  const storeKind = dependency.bindingKind.startsWith("mcp-") ? "mcp"
    : dependency.bindingKind === "plugin-host-extension" ? "plugin"
      : dependency.bindingKind === "connector-authorized-connection" ? "connector"
        : kind;
  const stores = catalog.resourceStores.filter((store) => store?.id === storeKind && store.enabled === true);
  const resources = catalog.resources.filter((resource) => resource?.id === dependency.canonicalId);
  if (stores.length !== 1 || resources.length !== 1) return null;
  const resource = resources[0];
  if (
    resource.enabled !== true ||
    !resource.resourceTypes?.includes(storeKind) ||
    !REVIEWED.has(resourceReviewStatus(resource)) ||
    resourceRiskLevel(resource) === "unsafe" ||
    hasForbiddenCatalogField(resource)
  ) return null;
  const targets = (resource.targets || []).filter((target) =>
    target?.productId === dependency.hostProductId &&
    target?.installProfileId === profileId
  );
  if (
    targets.length !== 1 ||
    targets[0].enabled !== true ||
    targets[0].moduleId !== profile.moduleId ||
    hasForbiddenField(targets[0])
  ) return null;
  const hostProduct = catalogHost(catalog, dependency.hostProductId);
  return hostProduct
    ? { resource, target: targets[0], hostProduct, riskLevel: resourceRiskLevel(resource) }
    : null;
}

function validProfile(profile, dependency) {
  return isObject(profile) &&
    profile.moduleId === BINDING_MODULES[dependency.bindingKind] &&
    profile.extensionId === dependency.canonicalId &&
    profile.hostProductId === dependency.hostProductId &&
    Array.isArray(profile.agentBindingKinds) &&
    profile.agentBindingKinds.length > 0 &&
    new Set(profile.agentBindingKinds).size === profile.agentBindingKinds.length &&
    profile.agentBindingKinds.every((bindingKind) => BINDING_KINDS.has(bindingKind)) &&
    profile.agentBindingKinds.includes(dependency.bindingKind) &&
    Array.isArray(profile.agentEffects) &&
    profile.agentEffects.length > 0 &&
    new Set(profile.agentEffects).size === profile.agentEffects.length &&
    profile.agentEffects.every((effect) => EFFECTS.has(effect)) &&
    typeof profile.agentContractVersion === "string" &&
    ID.test(profile.agentContractVersion) &&
    Array.isArray(profile.capabilities) &&
    profile.capabilities.length > 0;
}

function localStatus(localStates, profileId, bindingKind) {
  const matches = localStates.filter((entry) => entry?.profileId === profileId);
  if (matches.length !== 1 || !exactObject(matches[0], [
    "profileId", "state", "managed", "enabled", "hostInstalled"
  ])) return false;
  const state = matches[0];
  return state.enabled === true && state.hostInstalled === true &&
    (bindingKind === "connector-authorized-connection"
      ? state.state === "connected"
      : state.state === "installed" && state.managed === true);
}

function grantFor(receipts, identity) {
  const matches = receipts.filter((receipt) =>
    receipt?.profileId === identity.profileId &&
    receipt?.agentProductId === identity.agentProductId &&
    receipt?.resourceId === identity.resourceId &&
    receipt?.hostProductId === identity.hostProductId &&
    receipt?.bindingKind === identity.bindingKind &&
    receipt?.agentContractVersion === identity.agentContractVersion
  );
  if (matches.length !== 1) return null;
  const receipt = matches[0];
  return exactObject(receipt, [
    "schemaVersion", "kind", "receiptId", "agentProductId", "profileId",
    "resourceId", "hostProductId", "bindingKind", "agentContractVersion",
    "grantedAt", "revokedAt"
  ]) && receipt.schemaVersion === 1 &&
    receipt.kind === "agent-capability-grant" &&
    ID.test(receipt.receiptId) &&
    timestamp(receipt.grantedAt) &&
    receipt.revokedAt === null
    ? receipt
    : null;
}

function confirmationFor(confirmations, identity, useId, currentTime) {
  const matches = confirmations.filter((entry) =>
    entry?.capabilityKey === identity.capabilityKey && entry?.useId === useId
  );
  if (matches.length !== 1) return null;
  const confirmation = matches[0];
  if (!exactObject(confirmation, [
    "schemaVersion", "kind", "confirmationId", "useId", "capabilityKey",
    "confirmedAt", "expiresAt"
  ]) || confirmation.schemaVersion !== 1 ||
    confirmation.kind !== "agent-capability-confirmation" ||
    !ID.test(confirmation.confirmationId) ||
    !timestamp(confirmation.confirmedAt) ||
    !timestamp(confirmation.expiresAt)) return null;
  const confirmedAt = Date.parse(confirmation.confirmedAt);
  const expiresAt = Date.parse(confirmation.expiresAt);
  return confirmedAt <= currentTime && currentTime <= expiresAt &&
    expiresAt - confirmedAt <= CONFIRMATION_MAX_AGE_MS
    ? confirmation
    : null;
}

function validWorkflow(workflow) {
  return isObject(workflow) &&
    ID.test(String(workflow.workflowId || "")) &&
    Number.isSafeInteger(workflow.version) && workflow.version > 0 &&
    REVIEWED.has(workflow.reviewStatus) &&
    ["low", "guarded"].includes(workflow.riskLevel) &&
    isObject(workflow.content) &&
    exactObject(workflow.content, [
      "title", "summary", "inputs", "outputs", "instructions", "dependencies",
      "secretPlaceholders"
    ]) &&
    Array.isArray(workflow.content.inputs) &&
    Array.isArray(workflow.content.outputs) &&
    Array.isArray(workflow.content.instructions) &&
    Array.isArray(workflow.content.dependencies) &&
    Array.isArray(workflow.content.secretPlaceholders) &&
    workflow.content.secretPlaceholders.every((placeholder) =>
      exactObject(placeholder, ["name", "description"])
    ) &&
    !hasForbiddenField(workflow) &&
    !workflowHasArbitraryLocation(workflow.content);
}

function validDependency(dependency) {
  return exactObject(dependency, [
    "kind", "canonicalId", "hostProductId", "bindingKind", "permissions"
  ]) && dependency.kind === "resource" &&
    ID.test(String(dependency.canonicalId || "")) &&
    ID.test(String(dependency.hostProductId || "")) &&
    BINDING_KINDS.has(dependency.bindingKind) &&
    Array.isArray(dependency.permissions) && dependency.permissions.length > 0 &&
    new Set(dependency.permissions).size === dependency.permissions.length &&
    dependency.permissions.every((permission) => PERMISSIONS.has(permission));
}

function validProductReference(dependency) {
  return exactObject(dependency, ["kind", "canonicalId", "permissions"]) &&
    dependency.kind === "product" &&
    ID.test(String(dependency.canonicalId || "")) &&
    Array.isArray(dependency.permissions) &&
    dependency.permissions.length === 1 &&
    dependency.permissions[0] === "none";
}

function vaultReady(workflow, vaultReferences) {
  if (!isObject(vaultReferences)) return false;
  return workflow.content.secretPlaceholders.every((placeholder) =>
    typeof placeholder?.name === "string" &&
    VAULT_REFERENCE.test(vaultReferences[placeholder.name] || "")
  );
}

function createAgentCapabilityBroker({
  registry = EXTENSION_INSTALL_REGISTRY,
  now = () => new Date().toISOString(),
  platformRequest
} = {}) {
  if (!isObject(registry) || typeof now !== "function") {
    throw new TypeError("Agent Capability Broker options are invalid");
  }

  function planWorkflow(input) {
    const currentTimeText = String(now());
    const currentTime = Date.parse(currentTimeText);
    if (!timestamp(currentTimeText)) throw new TypeError("Broker clock is invalid");
    const useId = String(input?.useId || "");
    const agentProductId = String(input?.agentProductId || "");
    const catalog = publicCatalog(input?.catalogResult);
    const workflow = input?.workflowRelease;
    const localStates = Array.isArray(input?.localStates) ? input.localStates : [];
    const receipts = Array.isArray(input?.authorizationReceipts) ? input.authorizationReceipts : [];
    const confirmations = Array.isArray(input?.confirmations) ? input.confirmations : [];
    const audit = [];
    const capabilities = [];
    const reject = (reason) => {
      audit.push(freeze({
        event: "agent-workflow-binding-planned",
        at: currentTimeText,
        useId: ID.test(useId) ? useId : null,
        decision: "blocked",
        reason
      }));
      return freeze({
        status: "blocked",
        reason,
        source: catalog ? { catalogVersion: input.catalogResult.catalogVersion } : null,
        workflow: validWorkflow(workflow) ? { workflowId: workflow.workflowId, version: workflow.version } : null,
        capabilities,
        audit
      });
    };
    if (!ID.test(agentProductId) || !ID.test(useId)) return reject("BROKER_INPUT_INVALID");
    if (!catalog) return reject("ACTIVE_SIGNED_CATALOG_UNAVAILABLE");
    if (!validWorkflow(workflow)) return reject("WORKFLOW_NOT_BINDABLE");
    if (!vaultReady(workflow, input.vaultReferences || {})) return reject("LOCAL_VAULT_REFERENCE_MISSING");

    for (const dependency of workflow.content.dependencies) {
      if (dependency?.kind === "product") {
        if (!validProductReference(dependency) || !catalogHost(catalog, dependency.canonicalId)) {
          return reject("PRODUCT_REFERENCE_NOT_BINDABLE");
        }
        audit.push(freeze({
          event: "workflow-product-reference-planned",
          at: currentTimeText,
          useId,
          canonicalId: dependency.canonicalId,
          decision: "reference-only"
        }));
        continue;
      }
      if (!validDependency(dependency) || dependency.hostProductId !== agentProductId) {
        return reject("WORKFLOW_DEPENDENCY_INVALID");
      }
      const profileMatches = Object.entries(registry).filter(([profileId, profile]) =>
        PROFILE_ID.test(profileId) && validProfile(profile, dependency)
      );
      if (profileMatches.length !== 1) return reject("LOCAL_PROFILE_NOT_APPROVED");
      const [profileId, profile] = profileMatches[0];
      const catalogMatch = catalogBinding(catalog, dependency, profileId, profile);
      if (!catalogMatch) return reject("CATALOG_BINDING_NOT_APPROVED");
      const platformAvailability = projectResourcePlatformAvailability({
        resourceSupport: catalogMatch.resource.platformSupport,
        hostSupport: catalogMatch.hostProduct.platformSupport,
        profileSupport: profile.platformSupport,
        requested: platformRequest,
        now: currentTimeText
      });
      if (!platformAvailability.managedEligible) {
        return reject("PLATFORM_AVAILABILITY_NOT_APPROVED");
      }
      if (!localStatus(localStates, profileId, dependency.bindingKind)) {
        return reject("LOCAL_CAPABILITY_UNAVAILABLE");
      }
      const capabilityKey = [
        dependency.canonicalId,
        dependency.hostProductId,
        dependency.bindingKind,
        profileId
      ].join(":");
      const identity = {
        capabilityKey,
        agentProductId,
        profileId,
        resourceId: dependency.canonicalId,
        hostProductId: dependency.hostProductId,
        bindingKind: dependency.bindingKind,
        agentContractVersion: profile.agentContractVersion
      };
      const grant = grantFor(receipts, identity);
      if (!grant) return reject("LOCAL_AUTHORIZATION_REQUIRED");
      const requiresConfirmation = workflow.riskLevel === "guarded" ||
        catalogMatch.riskLevel === "guarded" ||
        dependency.permissions.some((permission) => CONFIRMATION_PERMISSIONS.has(permission)) ||
        profile.agentEffects.some((effect) => CONFIRMATION_EFFECTS.has(effect));
      const confirmation = requiresConfirmation
        ? confirmationFor(confirmations, identity, useId, currentTime)
        : null;
      const status = requiresConfirmation && !confirmation ? "confirmation-required" : "available";
      capabilities.push(freeze({
        capabilityKey,
        semantics: BINDING_SEMANTICS[dependency.bindingKind],
        resourceId: dependency.canonicalId,
        hostProductId: dependency.hostProductId,
        profileId,
        bindingKind: dependency.bindingKind,
        platform: platformAvailability.platform,
        runtime: platformAvailability.runtime,
        architecture: platformAvailability.architecture,
        permissions: [...dependency.permissions],
        effects: [...profile.agentEffects],
        status,
        requiresPerUseConfirmation: requiresConfirmation
      }));
      audit.push(freeze({
        event: "agent-capability-planned",
        at: currentTimeText,
        useId,
        capabilityKey,
        decision: status,
        grantReceiptId: grant.receiptId,
        confirmationId: confirmation?.confirmationId || null
      }));
    }
    const status = capabilities.some((capability) => capability.status === "confirmation-required")
      ? "confirmation-required"
      : "ready";
    return freeze({
      status,
      reason: status === "ready" ? null : "PER_USE_CONFIRMATION_REQUIRED",
      source: { catalogVersion: input.catalogResult.catalogVersion },
      workflow: { workflowId: workflow.workflowId, version: workflow.version },
      capabilities,
      audit
    });
  }

  return Object.freeze({ planWorkflow });
}

module.exports = {
  createAgentCapabilityBroker
};
