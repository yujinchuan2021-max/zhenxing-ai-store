"use strict";

const PROFILE_ID = /^[a-z0-9][a-z0-9.-]{0,119}$/;
const MANAGED_RESOURCE_TYPES = Object.freeze({
  "skill-managed": "skill",
  "mcp-managed": "mcp",
  "plugin-managed": "plugin"
});
const FORBIDDEN_REMOTE_OPERATION_FIELDS = new Set([
  "args",
  "arguments",
  "command",
  "commands",
  "cwd",
  "executable",
  "executablePath",
  "package",
  "packageName",
  "path",
  "script",
  "shell",
  "sourcePath",
  "targetPath",
  "targetRelativePath",
  "workingDirectory"
]);

function authorizationFailure(error, errorCode) {
  return Object.freeze({ ok: false, error, errorCode });
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyText(value, maxLength = 120) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    value.trim() === value
  );
}

function isUniqueTextList(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    new Set(value).size === value.length &&
    value.every((item) => isNonEmptyText(item, 80))
  );
}

function isTextSubset(candidate, allowed) {
  return (
    isUniqueTextList(candidate) &&
    isUniqueTextList(allowed) &&
    candidate.every((item) => allowed.includes(item))
  );
}

function hasForbiddenRemoteOperationField(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) =>
      hasForbiddenRemoteOperationField(item, seen)
    );
  }
  return Object.entries(value).some(
    ([key, nested]) =>
      FORBIDDEN_REMOTE_OPERATION_FIELDS.has(key) ||
      hasForbiddenRemoteOperationField(nested, seen)
  );
}

function evaluateFreshCatalogResourceAuthorization({
  catalogResult,
  profileId,
  profile,
  requiredCapability = "install"
}) {
  if (typeof profileId !== "string" || !PROFILE_ID.test(profileId)) {
    return authorizationFailure(
      "Resource install profile ID is invalid",
      "CATALOG_RESOURCE_PROFILE_ID_INVALID"
    );
  }
  if (!isNonEmptyText(requiredCapability, 80)) {
    return authorizationFailure(
      "Required resource capability is invalid",
      "CATALOG_RESOURCE_CAPABILITY_INVALID"
    );
  }

  const resourceType = MANAGED_RESOURCE_TYPES[profile?.moduleId];
  if (
    !isRecord(profile) ||
    !resourceType ||
    !isNonEmptyText(profile.extensionId) ||
    !isNonEmptyText(profile.hostProductId, 100) ||
    !isUniqueTextList(profile.capabilities) ||
    !profile.capabilities.includes(requiredCapability) ||
    (profile.resourceType !== undefined && profile.resourceType !== resourceType)
  ) {
    return authorizationFailure(
      "Local extension install profile is invalid",
      "LOCAL_EXTENSION_PROFILE_INVALID"
    );
  }

  const catalog = catalogResult?.catalog;
  if (
    catalogResult?.source !== "remote" ||
    !isRecord(catalog) ||
    !Array.isArray(catalog.resourceStores) ||
    !Array.isArray(catalog.resources) ||
    !Array.isArray(catalog.vendors)
  ) {
    return authorizationFailure(
      "A fresh remote resource catalog is unavailable",
      "ACTIVE_RESOURCE_CATALOG_UNAVAILABLE"
    );
  }

  const storeMatches = catalog.resourceStores.filter(
    (store) => store?.id === resourceType
  );
  if (storeMatches.length !== 1) {
    return authorizationFailure(
      "Resource directory is missing or ambiguous",
      "CATALOG_RESOURCE_DIRECTORY_NOT_UNIQUE"
    );
  }
  if (storeMatches[0].enabled !== true) {
    return authorizationFailure(
      "Resource directory is disabled",
      "CATALOG_RESOURCE_DIRECTORY_DISABLED"
    );
  }

  const resourceMatches = catalog.resources.filter(
    (resource) => resource?.id === profile.extensionId
  );
  if (resourceMatches.length !== 1) {
    return authorizationFailure(
      "Resource is missing or ambiguous",
      "CATALOG_RESOURCE_NOT_UNIQUE"
    );
  }
  const resource = resourceMatches[0];
  if (resource.enabled !== true) {
    return authorizationFailure(
      "Resource is disabled",
      "CATALOG_RESOURCE_DISABLED"
    );
  }
  if (
    !Array.isArray(resource.resourceTypes) ||
    !resource.resourceTypes.includes(resourceType)
  ) {
    return authorizationFailure(
      "Resource type does not match the local install module",
      "CATALOG_RESOURCE_TYPE_MISMATCH"
    );
  }

  const hostMatches = [];
  for (const vendor of catalog.vendors) {
    for (const product of Array.isArray(vendor?.products)
      ? vendor.products
      : []) {
      if (product?.id === profile.hostProductId) {
        hostMatches.push({ product, vendor });
      }
    }
  }
  if (hostMatches.length !== 1) {
    return authorizationFailure(
      "Resource host is missing or ambiguous",
      "CATALOG_RESOURCE_HOST_NOT_UNIQUE"
    );
  }
  const { product: host, vendor: hostVendor } = hostMatches[0];
  if (
    hostVendor.enabled !== true ||
    host.enabled !== true ||
    host.directoryKind !== "ai-tool"
  ) {
    return authorizationFailure(
      "Resource host is disabled",
      "CATALOG_RESOURCE_HOST_DISABLED"
    );
  }

  const targets = Array.isArray(resource.targets) ? resource.targets : [];
  const targetMatches = targets.filter(
    (target) =>
      target?.installProfileId === profileId ||
      target?.productId === profile.hostProductId
  );
  if (targetMatches.length !== 1) {
    return authorizationFailure(
      "Resource target is missing or ambiguous",
      "CATALOG_RESOURCE_TARGET_NOT_UNIQUE"
    );
  }
  const target = targetMatches[0];
  if (target.enabled !== true) {
    return authorizationFailure(
      "Resource target is disabled",
      "CATALOG_RESOURCE_TARGET_DISABLED"
    );
  }
  if (
    target.installProfileId !== profileId ||
    target.moduleId !== profile.moduleId ||
    target.productId !== profile.hostProductId
  ) {
    return authorizationFailure(
      "Resource target does not match the local install profile",
      "CATALOG_RESOURCE_PROFILE_MISMATCH"
    );
  }
  if (!isTextSubset(target.capabilities, profile.capabilities)) {
    return authorizationFailure(
      "Resource capabilities exceed the local install profile",
      "CATALOG_RESOURCE_CAPABILITY_MISMATCH"
    );
  }
  if (!target.capabilities.includes(requiredCapability)) {
    return authorizationFailure(
      "Required resource capability is disabled",
      "CATALOG_RESOURCE_CAPABILITY_DISABLED"
    );
  }
  if (
    hasForbiddenRemoteOperationField(resource) ||
    hasForbiddenRemoteOperationField(target)
  ) {
    return authorizationFailure(
      "Remote resource records cannot provide executable install details",
      "CATALOG_RESOURCE_OPERATION_FIELDS_FORBIDDEN"
    );
  }

  return Object.freeze({
    ok: true,
    profileId,
    extensionId: profile.extensionId,
    hostProductId: profile.hostProductId,
    resourceType,
    catalogVersion: catalogResult.catalogVersion || null
  });
}

async function authorizeFreshCatalogResource({
  loadCatalog,
  profileId,
  profile,
  requiredCapability = "install"
}) {
  if (typeof loadCatalog !== "function") {
    throw new TypeError("Active catalog loader is required");
  }
  try {
    return evaluateFreshCatalogResourceAuthorization({
      catalogResult: await loadCatalog(),
      profileId,
      profile,
      requiredCapability
    });
  } catch {
    return authorizationFailure(
      "A fresh remote resource catalog is unavailable",
      "ACTIVE_RESOURCE_CATALOG_UNAVAILABLE"
    );
  }
}

module.exports = {
  authorizeFreshCatalogResource,
  evaluateFreshCatalogResourceAuthorization
};
