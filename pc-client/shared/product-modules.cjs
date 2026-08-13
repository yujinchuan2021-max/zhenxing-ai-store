"use strict";

const {
  LEGACY_DESKTOP_DOWNLOAD_MODULE_ID,
  SIGNED_CATALOG_MODULE_ID,
  SIGNED_CATALOG_PROFILE_ID,
  getDesktopDownloadOnlyProfile
} = require("./desktop-download-only.cjs");

const PRODUCT_MODULES = Object.freeze({
  "web-link": Object.freeze({
    id: "web-link",
    label: "Web 产品直达",
    description: "直接打开产品官网。",
    productType: "web",
    kind: "其他产品",
    installPolicy: "open-product-website",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: Object.freeze(["website", "tutorial"]),
    requiresProfile: false,
    allowsRequirements: false
  }),
  "desktop-official": Object.freeze({
    id: "desktop-official",
    label: "桌面产品官方下载",
    description: "打开厂商官方下载页，不由客户端执行安装。",
    productType: "desktop-official",
    kind: "桌面端",
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    capabilities: Object.freeze(["website", "tutorial"]),
    requiresProfile: false,
    allowsRequirements: false
  }),
  "desktop-managed": Object.freeze({
    id: "desktop-managed",
    label: "桌面产品下载",
    description: "下载官方桌面安装包；完成后由用户点击打开并继续厂商安装流程。",
    productType: "desktop-reviewed",
    kind: "桌面端",
    installPolicy: "client-managed-installer",
    downloadPolicy: "client-managed",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
    capabilities: Object.freeze([
      "website",
      "tutorial",
      "install",
      "open",
      "uninstall"
    ]),
    requiresProfile: true,
    allowsRequirements: true
  }),
  [SIGNED_CATALOG_MODULE_ID]: Object.freeze({
    id: SIGNED_CATALOG_MODULE_ID,
    label: "桌面产品官方包下载",
    description: "仅下载并打开官方安装包；不检测、不管理已安装产品。",
    productType: "desktop-download-only",
    kind: "桌面端",
    installPolicy: "client-managed-download",
    downloadPolicy: "desktop-download-only",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "not-managed",
    capabilities: Object.freeze(["website", "tutorial", "install"]),
    requiresProfile: true,
    catalogProfileId: SIGNED_CATALOG_PROFILE_ID,
    legacyModuleIds: Object.freeze([LEGACY_DESKTOP_DOWNLOAD_MODULE_ID]),
    allowsRequirements: false
  }),
  "cli-official": Object.freeze({
    id: "cli-official",
    label: "CLI 官方安装入口",
    description: "打开厂商官方安装说明，不由客户端执行命令或环境探测。",
    productType: "cli-official",
    kind: "CLI",
    installPolicy: "open-official-install",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: Object.freeze(["website", "tutorial"]),
    requiresProfile: false,
    allowsRequirements: false
  }),
  "cli-managed": Object.freeze({
    id: "cli-managed",
    label: "CLI 一键部署",
    description: "检测环境并部署客户端本地批准的 CLI 包。",
    productType: "cli",
    kind: "CLI",
    installPolicy: "client-managed-cli",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "client-managed",
    capabilities: Object.freeze([
      "website",
      "tutorial",
      "install",
      "update",
      "repair",
      "open",
      "uninstall"
    ]),
    requiresProfile: true,
    allowsRequirements: true
  }),
  "cli-deploy-only": Object.freeze({
    id: "cli-deploy-only",
    label: "CLI \u90e8\u7f72",
    description: "\u4ec5\u68c0\u67e5\u73af\u5883\u3001\u90e8\u7f72\u56fa\u5b9a\u5ba2\u6237\u7aef CLI \u5236\u54c1\u3001\u590d\u6838\u5e76\u6253\u5f00\u72ec\u7acb\u7ec8\u7aef\u3002",
    productType: "cli-deploy-only",
    kind: "CLI",
    installPolicy: "client-managed-cli-deploy-only",
    downloadPolicy: "none",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "not-managed",
    capabilities: Object.freeze(["website", "tutorial", "install", "open"]),
    requiresProfile: true,
    allowsRequirements: true
  }),
  "local-model-managed": Object.freeze({
    id: "local-model-managed",
    label: "本地模型工具下载",
    description: "下载官方桌面包；完成后由用户点击打开并继续厂商安装流程。",
    productType: "local-model",
    kind: "桌面端",
    installPolicy: "client-managed-installer",
    downloadPolicy: "client-managed",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
    capabilities: Object.freeze([
      "website",
      "tutorial",
      "install",
      "open",
      "uninstall"
    ]),
    requiresProfile: true,
    allowsRequirements: true
  }),
  "tutorial-link": Object.freeze({
    id: "tutorial-link",
    label: "教程直达",
    description: "直接打开厂商教程页面。",
    productType: "tutorial",
    kind: "其他产品",
    installPolicy: "open-tutorial",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: Object.freeze(["tutorial"]),
    requiresProfile: false,
    allowsRequirements: false
  })
});

const MODULE_BY_PRODUCT_TYPE = Object.freeze(
  Object.fromEntries(
    Object.values(PRODUCT_MODULES).map((module) => [
      module.productType,
      module.id
    ])
  )
);

function getProductModule(moduleId) {
  if (moduleId === LEGACY_DESKTOP_DOWNLOAD_MODULE_ID) {
    return PRODUCT_MODULES[SIGNED_CATALOG_MODULE_ID];
  }
  return PRODUCT_MODULES[moduleId] || null;
}

function moduleIdForProductType(productType) {
  return MODULE_BY_PRODUCT_TYPE[productType] || "";
}

function applyProductModule(product, moduleId) {
  const module = getProductModule(moduleId);
  if (!module) throw new Error(`未知产品模块：${moduleId}`);
  const fixedDesktopDownloadProfile =
    module.id === SIGNED_CATALOG_MODULE_ID
      ? getDesktopDownloadOnlyProfile(product.id)
      : null;
  return {
    ...product,
    moduleId: module.id,
    productType: module.productType,
    kind: module.kind,
    installPolicy: module.installPolicy,
    downloadPolicy: module.downloadPolicy,
    signaturePolicy: module.signaturePolicy,
    uninstallPolicy: module.uninstallPolicy,
    capabilities: [...module.capabilities],
    requirements: module.allowsRequirements ? product.requirements || [] : [],
    installProfileId: module.requiresProfile
      ? fixedDesktopDownloadProfile?.profileId || module.catalogProfileId || product.installProfileId || ""
      : ""
  };
}

function publicProductModules() {
  return Object.freeze(
    Object.values(PRODUCT_MODULES).map((module) => Object.freeze({ ...module }))
  );
}

module.exports = {
  PRODUCT_MODULES,
  applyProductModule,
  getProductModule,
  moduleIdForProductType,
  publicProductModules
};
