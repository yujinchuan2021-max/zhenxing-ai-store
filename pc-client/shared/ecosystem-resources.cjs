"use strict";

const {
  getExtensionInstallProfile
} = require("./extension-install-registry.cjs");

const RESOURCE_TYPES = Object.freeze(["skill", "mcp", "plugin", "connector"]);
const RESOURCE_COMPATIBILITY = Object.freeze([
  "official",
  "protocol-compatible",
  "verified"
]);
const RESOURCE_SOURCE_KINDS = Object.freeze([
  "official",
  "reviewed-community",
  "community"
]);

const RESOURCE_MODULES = Object.freeze({
  "resource-link": Object.freeze({
    id: "resource-link",
    label: "资源官方入口",
    description: "打开资源的官方页面或文档。",
    resourceType: "",
    capabilities: Object.freeze(["website"]),
    requiresProfile: false
  }),
  "skill-managed": Object.freeze({
    id: "skill-managed",
    label: "Skill 一键安装",
    description: "把客户端本地审核的 Skill 安装到对应 AI 工具。",
    resourceType: "skill",
    capabilities: Object.freeze([
      "website",
      "install",
      "update",
      "repair",
      "uninstall"
    ]),
    requiresProfile: true
  }),
  "mcp-managed": Object.freeze({
    id: "mcp-managed",
    label: "MCP 一键安装",
    description: "把客户端本地审核的 MCP 服务接入对应 AI 工具。",
    resourceType: "mcp",
    capabilities: Object.freeze([
      "website",
      "install",
      "update",
      "repair",
      "enable",
      "disable",
      "uninstall"
    ]),
    requiresProfile: true
  }),
  "plugin-managed": Object.freeze({
    id: "plugin-managed",
    label: "插件一键安装",
    description: "把客户端本地审核的插件安装到对应 AI 工具。",
    resourceType: "plugin",
    capabilities: Object.freeze([
      "website",
      "install",
      "update",
      "repair",
      "enable",
      "disable",
      "uninstall"
    ]),
    requiresProfile: true
  })
});

const RESOURCE_STORE_FIELDS = new Set([
  "id",
  "label",
  "enabled",
  "order"
]);
const RESOURCE_FIELDS = new Set([
  "id",
  "enabled",
  "order",
  "name",
  "resourceTypes",
  "description",
  "website",
  "tutorial",
  "publisherVendorId",
  "publisher",
  "sourceKind",
  "sourceProductIds",
  "targets",
  "versionRef",
  "requestedPermissions",
  "credentialRequirements",
  "installScope",
  "uninstallPlan",
  "provenanceEvidence",
  "lastVerifiedAt"
]);
const RESOURCE_TARGET_FIELDS = new Set([
  "productId",
  "compatibility",
  "moduleId",
  "installProfileId",
  "capabilities",
  "enabled"
]);

function hasOnlyFields(value, allowed) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((field) => allowed.has(field))
  );
}

function isShortText(value, max = 300) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isOptionalShortText(value, max) {
  return value === undefined || isShortText(value, max);
}

function isUniqueTextList(value, maxItems = 50, maxItemLength = 200) {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    new Set(value).size === value.length &&
    value.every((item) => isShortText(item, maxItemLength))
  );
}

function isOptionalTextList(value, maxItems = 50, maxItemLength = 200) {
  return (
    value === undefined || isUniqueTextList(value, maxItems, maxItemLength)
  );
}

function isHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isOptionalIsoDateTime(value) {
  return (
    value === undefined ||
    (typeof value === "string" &&
      value.length <= 40 &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
      ) &&
      !Number.isNaN(Date.parse(value)))
  );
}

function getResourceModule(moduleId) {
  return RESOURCE_MODULES[moduleId] || null;
}

function publicResourceModules() {
  return Object.freeze(
    Object.values(RESOURCE_MODULES).map((module) =>
      Object.freeze({ ...module })
    )
  );
}

function applyResourceTargetModule(target, moduleId) {
  const module = getResourceModule(moduleId);
  if (!module) throw new Error(`未知资源模块：${moduleId}`);
  return {
    ...target,
    moduleId: module.id,
    capabilities: [...module.capabilities],
    installProfileId: module.requiresProfile
      ? target.installProfileId || ""
      : ""
  };
}

function validateResourceStore(store) {
  if (
    !hasOnlyFields(store, RESOURCE_STORE_FIELDS) ||
    typeof store.id !== "string" ||
    !/^[a-z][a-z0-9-]{0,39}$/.test(store.id) ||
    !isShortText(store.label, 40) ||
    typeof store.enabled !== "boolean" ||
    !Number.isInteger(store.order) ||
    store.order < 0 ||
    store.order > 100000
  ) {
    return "资源商店配置无效";
  }
  return "";
}

function validateResourceTarget(target, resource, productById) {
  if (!hasOnlyFields(target, RESOURCE_TARGET_FIELDS)) {
    return "资源目标包含客户端不支持的字段";
  }
  const product = productById.get(target.productId);
  const module = getResourceModule(target.moduleId);
  if (
    !product ||
    product.directoryKind !== "ai-tool" ||
    !RESOURCE_COMPATIBILITY.includes(target.compatibility) ||
    typeof target.enabled !== "boolean" ||
    !module
  ) {
    return "资源目标配置无效";
  }
  if (
    module.resourceType &&
    !resource.resourceTypes.includes(module.resourceType)
  ) {
    return "资源目标模块与资源类型不一致";
  }
  if (
    !Array.isArray(target.capabilities) ||
    new Set(target.capabilities).size !== target.capabilities.length ||
    target.capabilities.some(
      (capability) => !module.capabilities.includes(capability)
    ) ||
    typeof target.installProfileId !== "string" ||
    target.installProfileId.length > 120
  ) {
    return "资源目标能力未通过模块白名单";
  }
  if (!module.requiresProfile) {
    return target.installProfileId ? "资源直达模块不能绑定安装配置" : "";
  }
  const profile = getExtensionInstallProfile(target.installProfileId);
  if (
    !profile ||
    profile.moduleId !== module.id ||
    profile.extensionId !== resource.id ||
    profile.hostProductId !== target.productId ||
    target.capabilities.some(
      (capability) => !profile.capabilities.includes(capability)
    )
  ) {
    return "资源安装配置未通过客户端本地白名单";
  }
  return "";
}

function validateEcosystemResource(
  resource,
  { productById, vendorIds, resourceStoreIds }
) {
  if (!hasOnlyFields(resource, RESOURCE_FIELDS)) {
    return "生态资源包含客户端不支持的字段";
  }
  if (
    !isShortText(resource.id, 120) ||
    !isShortText(resource.name, 150) ||
    !isShortText(resource.description, 500) ||
    !isHttpsUrl(resource.website) ||
    !isHttpsUrl(resource.tutorial) ||
    (resource.enabled !== undefined && typeof resource.enabled !== "boolean") ||
    (resource.order !== undefined &&
      (!Number.isInteger(resource.order) ||
        resource.order < 0 ||
        resource.order > 100000)) ||
    !Array.isArray(resource.resourceTypes) ||
    resource.resourceTypes.length < 1 ||
    resource.resourceTypes.length > 20 ||
    new Set(resource.resourceTypes).size !== resource.resourceTypes.length ||
    resource.resourceTypes.some(
      (type) =>
        typeof type !== "string" || !resourceStoreIds.has(type)
    ) ||
    !isUniqueTextList(resource.sourceProductIds || [], 50, 100) ||
    !Array.isArray(resource.targets) ||
    resource.targets.length < 1 ||
    resource.targets.length > 50 ||
    !isOptionalShortText(resource.publisherVendorId, 80) ||
    (resource.publisherVendorId !== undefined &&
      !vendorIds.has(resource.publisherVendorId)) ||
    !isOptionalShortText(resource.publisher, 150) ||
    (resource.sourceKind !== undefined &&
      !RESOURCE_SOURCE_KINDS.includes(resource.sourceKind)) ||
    !isOptionalShortText(resource.versionRef, 120) ||
    !isOptionalTextList(resource.requestedPermissions) ||
    !isOptionalTextList(resource.credentialRequirements) ||
    !isOptionalShortText(resource.installScope, 300) ||
    !isOptionalShortText(resource.uninstallPlan, 1000) ||
    (resource.provenanceEvidence !== undefined &&
      (!isUniqueTextList(resource.provenanceEvidence, 50, 2048) ||
        resource.provenanceEvidence.some((url) => !isHttpsUrl(url)))) ||
    !isOptionalIsoDateTime(resource.lastVerifiedAt)
  ) {
    return "生态资源数据无效";
  }
  for (const productId of resource.sourceProductIds || []) {
    if (productById.get(productId)?.directoryKind !== "ai-connectable") {
      return "生态资源来源产品必须属于 AI 可接入目录";
    }
  }
  const targetIds = new Set();
  for (const target of resource.targets) {
    if (targetIds.has(target.productId)) return "生态资源目标产品重复";
    const error = validateResourceTarget(target, resource, productById);
    if (error) return error;
    targetIds.add(target.productId);
  }
  return "";
}

module.exports = {
  RESOURCE_COMPATIBILITY,
  RESOURCE_MODULES,
  RESOURCE_SOURCE_KINDS,
  RESOURCE_TYPES,
  applyResourceTargetModule,
  getResourceModule,
  publicResourceModules,
  validateEcosystemResource,
  validateResourceStore,
  validateResourceTarget
};
