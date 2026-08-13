"use strict";

const {
  getExtensionInstallProfile
} = require("./extension-install-registry.cjs");

const EXTENSION_TYPES = Object.freeze(["skill", "mcp"]);
const EXTENSION_SOURCE_KINDS = Object.freeze([
  "official",
  "reviewed-community",
  "community"
]);

const EXTENSION_MODULES = Object.freeze({
  "skill-link": Object.freeze({
    id: "skill-link",
    label: "Skill 官方入口",
    description: "打开 Skill 的官方页面或文档。",
    extensionType: "skill",
    capabilities: Object.freeze(["website"]),
    requiresProfile: false
  }),
  "mcp-link": Object.freeze({
    id: "mcp-link",
    label: "MCP 官方入口",
    description: "打开 MCP 服务的官方页面或文档。",
    extensionType: "mcp",
    capabilities: Object.freeze(["website"]),
    requiresProfile: false
  }),
  "skill-managed": Object.freeze({
    id: "skill-managed",
    label: "Skill 一键安装",
    description: "把客户端本地审核的 Skill 安装到对应宿主产品。",
    extensionType: "skill",
    capabilities: Object.freeze(["website", "install", "uninstall"]),
    requiresProfile: true
  }),
  "mcp-managed": Object.freeze({
    id: "mcp-managed",
    label: "MCP 一键安装",
    description: "把客户端本地审核的 MCP 服务注册到对应宿主产品。",
    extensionType: "mcp",
    capabilities: Object.freeze(["website", "install", "uninstall"]),
    requiresProfile: true
  })
});

const ALLOWED_EXTENSION_FIELDS = new Set([
  "id",
  "enabled",
  "order",
  "name",
  "extensionType",
  "description",
  "website",
  "tutorial",
  "moduleId",
  "installProfileId",
  "capabilities",
  "publisher",
  "sourceKind",
  "versionRef",
  "requestedPermissions",
  "credentialRequirements",
  "installScope",
  "uninstallPlan",
  "provenanceEvidence",
  "lastVerifiedAt"
]);

function isOptionalShortText(value, max) {
  return (
    value === undefined ||
    (typeof value === "string" && value.length > 0 && value.length <= max)
  );
}

function isOptionalShortTextList(value, maxItems = 50, maxItemLength = 200) {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= maxItems &&
      new Set(value).size === value.length &&
      value.every(
        (item) =>
          typeof item === "string" &&
          item.length > 0 &&
          item.length <= maxItemLength
      ))
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

function getExtensionModule(moduleId) {
  return EXTENSION_MODULES[moduleId] || null;
}

function publicExtensionModules() {
  return Object.freeze(
    Object.values(EXTENSION_MODULES).map((module) =>
      Object.freeze({ ...module })
    )
  );
}

function applyExtensionModule(extension, moduleId) {
  const module = getExtensionModule(moduleId);
  if (!module) throw new Error(`未知扩展模块：${moduleId}`);
  return {
    ...extension,
    extensionType: module.extensionType,
    moduleId: module.id,
    capabilities: [...module.capabilities],
    installProfileId: module.requiresProfile
      ? extension.installProfileId || ""
      : ""
  };
}

function validateProductExtension(extension, hostProductId) {
  if (
    !extension ||
    typeof extension !== "object" ||
    Array.isArray(extension) ||
    Object.keys(extension).some(
      (field) => !ALLOWED_EXTENSION_FIELDS.has(field)
    )
  ) {
    return "扩展资源包含客户端不支持的字段";
  }
  const module = getExtensionModule(extension.moduleId);
  if (
    !module ||
    module.extensionType !== extension.extensionType ||
    !EXTENSION_TYPES.includes(extension.extensionType)
  ) {
    return "扩展资源类型与模块不一致";
  }
  if (
    !Array.isArray(extension.capabilities) ||
    new Set(extension.capabilities).size !== extension.capabilities.length ||
    extension.capabilities.some(
      (capability) => !module.capabilities.includes(capability)
    )
  ) {
    return "扩展资源能力未通过模块白名单";
  }
  if (
    !isOptionalShortText(extension.publisher, 150) ||
    (extension.sourceKind !== undefined &&
      !EXTENSION_SOURCE_KINDS.includes(extension.sourceKind)) ||
    !isOptionalShortText(extension.versionRef, 120) ||
    !isOptionalShortTextList(extension.requestedPermissions) ||
    !isOptionalShortTextList(extension.credentialRequirements) ||
    !isOptionalShortText(extension.installScope, 300) ||
    !isOptionalShortText(extension.uninstallPlan, 1000) ||
    (extension.provenanceEvidence !== undefined &&
      (!Array.isArray(extension.provenanceEvidence) ||
        extension.provenanceEvidence.length > 50 ||
        new Set(extension.provenanceEvidence).size !==
          extension.provenanceEvidence.length ||
        extension.provenanceEvidence.some((url) => !isHttpsUrl(url)))) ||
    !isOptionalIsoDateTime(extension.lastVerifiedAt)
  ) {
    return "扩展资源审计元数据无效";
  }
  if (!module.requiresProfile) {
    if (extension.installProfileId) {
      return "直达扩展资源不能绑定安装配置";
    }
    return "";
  }
  const profile = getExtensionInstallProfile(extension.installProfileId);
  if (
    !profile ||
    profile.moduleId !== module.id ||
    profile.extensionId !== extension.id ||
    profile.hostProductId !== hostProductId ||
    extension.capabilities.some(
      (capability) => !profile.capabilities.includes(capability)
    )
  ) {
    return "扩展资源安装配置未通过客户端本地白名单";
  }
  return "";
}

module.exports = {
  EXTENSION_MODULES,
  EXTENSION_SOURCE_KINDS,
  EXTENSION_TYPES,
  applyExtensionModule,
  getExtensionModule,
  publicExtensionModules,
  validateProductExtension
};
