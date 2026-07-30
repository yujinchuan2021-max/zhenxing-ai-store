"use strict";

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
    requiresProfile: false,
    allowsRequirements: false
  }),
  "desktop-managed": Object.freeze({
    id: "desktop-managed",
    label: "桌面产品一键安装",
    description: "检测环境、下载、校验并打开已审核安装器。",
    productType: "desktop-reviewed",
    kind: "桌面端",
    installPolicy: "client-managed-installer",
    downloadPolicy: "client-managed",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
    requiresProfile: true,
    allowsRequirements: true
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
    requiresProfile: true,
    allowsRequirements: true
  }),
  "local-model-managed": Object.freeze({
    id: "local-model-managed",
    label: "本地模型工具安装",
    description: "按客户端本地批准的模型工具策略安装和检测。",
    productType: "local-model",
    kind: "桌面端",
    installPolicy: "client-managed-installer",
    downloadPolicy: "client-managed",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
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
  return PRODUCT_MODULES[moduleId] || null;
}

function moduleIdForProductType(productType) {
  return MODULE_BY_PRODUCT_TYPE[productType] || "";
}

function applyProductModule(product, moduleId) {
  const module = getProductModule(moduleId);
  if (!module) throw new Error(`未知产品模块：${moduleId}`);
  return {
    ...product,
    moduleId: module.id,
    productType: module.productType,
    kind: module.kind,
    installPolicy: module.installPolicy,
    downloadPolicy: module.downloadPolicy,
    signaturePolicy: module.signaturePolicy,
    uninstallPolicy: module.uninstallPolicy,
    requirements: module.allowsRequirements ? product.requirements || [] : [],
    installProfileId: module.requiresProfile
      ? product.installProfileId || ""
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
