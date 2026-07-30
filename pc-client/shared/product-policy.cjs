const {
  matchesManagedDownload
} = require("./managed-downloads.cjs");
const {
  INSTALL_MODES,
  INSTALL_REGISTRY,
  getInstallRegistration
} = require("./install-registry.cjs");
const {
  getProductModule,
  moduleIdForProductType
} = require("./product-modules.cjs");

const PRODUCT_TYPES = new Set([
  "web",
  "desktop-official",
  "desktop-reviewed",
  "cli",
  "local-model",
  "tutorial"
]);
const INSTALL_POLICIES = new Set([
  "open-product-website",
  "open-official-download",
  "client-managed-installer",
  "client-managed-cli",
  "open-tutorial"
]);
const DOWNLOAD_POLICIES = new Set([
  "none",
  "official-page",
  "client-managed"
]);
const SIGNATURE_POLICIES = new Set([
  "not-applicable",
  "vendor-controlled",
  "client-reviewed"
]);
const UNINSTALL_POLICIES = new Set([
  "not-managed",
  "vendor-managed",
  "client-managed"
]);

const APPROVED_CLI_PRODUCTS = Object.freeze(
  Object.fromEntries(
    Object.entries(INSTALL_REGISTRY)
      .filter(([, entry]) => entry.mode === INSTALL_MODES.MANAGED_CLI)
      .map(([productId, entry]) => [productId, entry])
  )
);

const APPROVED_INSTALLER_PRODUCTS = Object.freeze(
  Object.fromEntries(
    Object.entries(INSTALL_REGISTRY)
      .filter(([, entry]) => entry.mode === INSTALL_MODES.MANAGED_INSTALLER)
      .map(([productId, entry]) => [productId, entry])
  )
);

const ALLOWED_PRODUCT_FIELDS = new Set([
  "id",
  "enabled",
  "order",
  "name",
  "kind",
  "category",
  "description",
  "website",
  "tutorial",
  "productType",
  "moduleId",
  "installProfileId",
  "requirements",
  "installPolicy",
  "downloadPolicy",
  "signaturePolicy",
  "uninstallPolicy",
  "download"
]);
const ALLOWED_DOWNLOAD_FIELDS = new Set(["url", "fileName"]);

function sameStringSet(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((item) => right.includes(item))
  );
}

function hasOnlyAllowedFields(value, allowed) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function expectedPolicyFor(productType) {
  const module = getProductModule(moduleIdForProductType(productType));
  return module
    ? {
        kind: module.kind,
        installPolicy: module.installPolicy,
        downloadPolicy: module.downloadPolicy,
        signaturePolicy: module.signaturePolicy,
        uninstallPolicy: module.uninstallPolicy,
        requiresEmptyRequirements: !module.allowsRequirements
      }
    : null;
}

function validateProductPolicy(product, vendorId) {
  if (!hasOnlyAllowedFields(product, ALLOWED_PRODUCT_FIELDS)) {
    return "产品包含客户端不支持的策略字段";
  }
  if (
    !PRODUCT_TYPES.has(product.productType) ||
    !INSTALL_POLICIES.has(product.installPolicy) ||
    !DOWNLOAD_POLICIES.has(product.downloadPolicy) ||
    !SIGNATURE_POLICIES.has(product.signaturePolicy) ||
    !UNINSTALL_POLICIES.has(product.uninstallPolicy)
  ) {
    return "产品类型或策略无效";
  }
  const expected = expectedPolicyFor(product.productType);
  const expectedModuleId = moduleIdForProductType(product.productType);
  if (
    product.moduleId !== undefined &&
    product.moduleId !== expectedModuleId
  ) {
    return "产品模块与产品类型不一致";
  }
  if (
    product.moduleId !== undefined &&
    !getProductModule(product.moduleId)
  ) {
    return "产品模块无效";
  }
  if (
    product.kind !== expected.kind ||
    product.installPolicy !== expected.installPolicy ||
    product.downloadPolicy !== expected.downloadPolicy ||
    product.signaturePolicy !== expected.signaturePolicy ||
    product.uninstallPolicy !== expected.uninstallPolicy
  ) {
    return "产品类型与策略不一致";
  }
  if (expected.requiresEmptyRequirements && product.requirements.length) {
    return "该产品类型不能声明环境依赖";
  }

  if (product.downloadPolicy === "client-managed") {
    const identity = getInstallRegistration(product.id);
    if (
      !identity ||
      identity.mode !== INSTALL_MODES.MANAGED_INSTALLER ||
      identity.vendorId !== vendorId ||
      identity.productType !== product.productType ||
      identity.kind !== product.kind ||
      (product.installProfileId !== undefined &&
        product.installProfileId !== identity.profileId) ||
      !sameStringSet(product.requirements, identity.requirements) ||
      !hasOnlyAllowedFields(product.download, ALLOWED_DOWNLOAD_FIELDS) ||
      typeof product.download.url !== "string" ||
      typeof product.download.fileName !== "string" ||
      /[\\/]/.test(product.download.fileName) ||
      !matchesManagedDownload(product.id, product.download)
    ) {
      return "托管安装策略未通过客户端本地白名单";
    }
  } else if (Object.hasOwn(product, "download")) {
    return "非托管产品不能声明客户端安装包";
  } else if (product.productType !== "cli" && product.installProfileId) {
    return "非托管产品不能绑定安装配置";
  }

  if (product.productType === "cli") {
    const identity = getInstallRegistration(product.id);
    if (
      !identity ||
      identity.mode !== INSTALL_MODES.MANAGED_CLI ||
      identity.vendorId !== vendorId ||
      (product.installProfileId !== undefined &&
        product.installProfileId !== identity.profileId) ||
      !sameStringSet(product.requirements, identity.requirements)
    ) {
      return "CLI 部署策略未通过客户端本地白名单";
    }
  }
  return "";
}

function resolveProductBehavior(product) {
  const registration = getInstallRegistration(product.id);
  const directUrl =
    product.productType === "tutorial" ? product.tutorial : product.website;
  const managedCli =
    product.productType === "cli" &&
    registration?.mode === INSTALL_MODES.MANAGED_CLI;
  const managedDesktop =
    ["desktop-reviewed", "local-model"].includes(product.productType) &&
    registration?.mode === INSTALL_MODES.MANAGED_INSTALLER;
  return Object.freeze({
    productType: product.productType,
    directUrl,
    opensDirectly: [
      "web",
      "desktop-official",
      "tutorial"
    ].includes(product.productType),
    requiresEnvironmentCheck: [
      "desktop-reviewed",
      "cli",
      "local-model"
    ].includes(product.productType),
    managedDownload:
      product.downloadPolicy === "client-managed" &&
      matchesManagedDownload(product.id, product.download),
    managedCli,
    managedDesktop,
    clientManagedInstall: managedCli || managedDesktop,
    installMode:
      registration?.mode ||
      (product.productType === "desktop-official"
        ? "official-installer-page"
        : "direct-open"),
    primaryLabel:
      managedCli || managedDesktop
        ? "一键安装"
        : product.productType === "desktop-official"
          ? "获取官方安装包"
          : product.productType === "tutorial"
            ? "打开教程"
            : "打开产品"
  });
}

module.exports = {
  APPROVED_CLI_PRODUCTS,
  APPROVED_INSTALLER_PRODUCTS,
  DOWNLOAD_POLICIES,
  INSTALL_POLICIES,
  PRODUCT_TYPES,
  SIGNATURE_POLICIES,
  UNINSTALL_POLICIES,
  resolveProductBehavior,
  validateProductPolicy
};
