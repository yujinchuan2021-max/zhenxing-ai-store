const {
  matchesManagedDownload
} = require("./managed-downloads.cjs");
const {
  getDesktopDownloadOnlyProfile,
  LEGACY_DESKTOP_DOWNLOAD_MODULE_ID,
  SIGNED_CATALOG_MODULE_ID,
  SIGNED_CATALOG_PROFILE_ID,
  validateDesktopDownloadOnlyArtifact,
  validateSignedDesktopDownloadArtifact
} = require("./desktop-download-only.cjs");
const { getCliDeployOnlyProfile } = require("./cli-deploy-only.cjs");
const {
  INSTALL_MODES,
  getProductIntakeDossier,
  INSTALL_REGISTRY,
  getInstallRegistration
} = require("./install-registry.cjs");
const {
  getApprovedOfficialDownloadSources
} = require("./official-download-approvals.cjs");
const {
  getProductModule,
  moduleIdForProductType
} = require("./product-modules.cjs");
const {
  resolveProductEntryPoints,
  validateProductEntryPoints
} = require("./product-entry-points.cjs");
const {
  validateOfficialDownloadAction
} = require("./official-download-page.cjs");
const {
  validatePlatformSupportClaims
} = require("./resource-platform-availability.cjs");
const {
  validateEnglishLocalization
} = require("./catalog-localization.cjs");

const PRODUCT_TYPES = new Set([
  "web",
  "desktop-official",
  "desktop-reviewed",
  "desktop-download-only",
  "cli-official",
  "cli",
  "cli-deploy-only",
  "local-model",
  "tutorial"
]);
const INSTALL_POLICIES = new Set([
  "open-product-website",
  "open-official-download",
  "open-official-install",
  "client-managed-installer",
  "client-managed-download",
  "client-managed-cli",
  "client-managed-cli-deploy-only",
  "open-tutorial"
]);
const DOWNLOAD_POLICIES = new Set([
  "none",
  "official-page",
  "client-managed",
  "desktop-download-only",
  "package-manager"
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
const PRODUCT_CAPABILITIES = new Set([
  "website",
  "tutorial",
  "install",
  "update",
  "repair",
  "open",
  "uninstall"
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
      .filter(([, entry]) =>
        [
          INSTALL_MODES.MANAGED_INSTALLER,
          INSTALL_MODES.MANAGED_PACKAGE_MANAGER
        ].includes(entry.mode)
      )
      .map(([productId, entry]) => [productId, entry])
  )
);

const ALLOWED_PRODUCT_FIELDS = new Set([
  "id",
  "enabled",
  "order",
  "directoryKind",
  "name",
  "kind",
  "category",
  "scenarioTags",
  "agentTag",
  "agentChannel",
  "agentPromotion",
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
  "capabilities",
  "download",
  "officialDownload",
  "platformSupport",
  "componentProductIds",
  "entryPoints",
  "extensions",
  "localized"
]);
const ALLOWED_DOWNLOAD_FIELDS = new Set(["url", "fileName", "artifactKind"]);

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

function expectedPolicyFor(product) {
  const module = getProductModule(moduleIdForProductType(product.productType));
  const registration = getInstallRegistration(product.id);
  return module
    ? {
        kind: module.kind,
        installPolicy: module.installPolicy,
        downloadPolicy:
          registration?.mode === INSTALL_MODES.MANAGED_PACKAGE_MANAGER &&
          product.productType === registration.productType &&
          product.moduleId === registration.moduleId
            ? registration.downloadPolicy
            : module.downloadPolicy,
        signaturePolicy: module.signaturePolicy,
        uninstallPolicy: module.uninstallPolicy,
        requiresEmptyRequirements: !module.allowsRequirements
      }
    : null;
}

function currentInstallRegistration(product) {
  const registration = getInstallRegistration(product.id);
  if (!registration) return null;
  if (registration.productType !== product.productType) return null;
  if (
    Object.hasOwn(product, "moduleId") &&
    registration.moduleId !== product.moduleId
  ) {
    return null;
  }
  if (
    Object.hasOwn(product, "installProfileId") &&
    registration.profileId !== String(product.installProfileId || "")
  ) {
    return null;
  }
  return registration;
}

function resolvedProductCapabilities(product) {
  const module = getProductModule(
    product.moduleId || moduleIdForProductType(product.productType)
  );
  const registration = currentInstallRegistration(product);
  const approved = registration?.capabilities || module?.capabilities || [];
  const requested = Array.isArray(product.capabilities)
    ? product.capabilities
    : approved;
  return Object.freeze(requested.filter((item) => approved.includes(item)));
}

function validateProductPolicy(product, vendorId) {
  if (!hasOnlyAllowedFields(product, ALLOWED_PRODUCT_FIELDS)) {
    return "产品包含客户端不支持的策略字段";
  }
  if (!validateEnglishLocalization(product.localized, {
    name: 150,
    description: 500
  })) {
    return "产品本地化内容无效";
  }
  const entryPointError = validateProductEntryPoints(product);
  if (entryPointError) return entryPointError;
  if (
    product.platformSupport !== undefined &&
    !validatePlatformSupportClaims(product.platformSupport).valid
  ) {
    return "product platform support invalid";
  }
  if (
    product.componentProductIds !== undefined &&
    (!Array.isArray(product.componentProductIds) ||
      product.componentProductIds.length > 20 ||
      new Set(product.componentProductIds).size !==
        product.componentProductIds.length ||
      product.componentProductIds.some(
        (productId) =>
          typeof productId !== "string" ||
          !/^[a-z0-9][a-z0-9-]{0,99}$/.test(productId)
      ))
  ) {
    return "产品组件目录无效";
  }
  if (product.officialDownload !== undefined) {
    const isNoWindows = product.officialDownload?.kind === "no-windows";
    if (
      (!isNoWindows && (
        product.productType !== "desktop-official" ||
        product.downloadPolicy !== "official-page"
      )) ||
      (isNoWindows && product.productType !== "web")
    ) {
      return "officialDownload 仅适用于 official-page 桌面产品";
    }
    if (Object.hasOwn(product, "download")) {
      return "officialDownload conflicts with direct download";
    }
    const officialDownloadSources = [
      ...(getProductIntakeDossier(product.id)?.officialSources || []),
      ...getApprovedOfficialDownloadSources(product.id)
    ];
    const officialDownloadError = validateOfficialDownloadAction(
      product.officialDownload,
      product.website,
      officialDownloadSources,
      { productId: product.id, productType: product.productType }
    );
    if (officialDownloadError) return officialDownloadError;
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
  const expected = expectedPolicyFor(product);
  const expectedModuleId = moduleIdForProductType(product.productType);
  const module = getProductModule(expectedModuleId);
  const fixedDesktopDownloadProfile =
    product.productType === "desktop-download-only"
      ? getDesktopDownloadOnlyProfile(product.id)
      : null;
  const compatibleLegacyDesktopModule =
    Boolean(fixedDesktopDownloadProfile) &&
    product.moduleId === LEGACY_DESKTOP_DOWNLOAD_MODULE_ID &&
    expectedModuleId === SIGNED_CATALOG_MODULE_ID;
  if (
    product.capabilities !== undefined &&
    (!Array.isArray(product.capabilities) ||
      new Set(product.capabilities).size !== product.capabilities.length ||
      product.capabilities.some(
        (capability) =>
          !PRODUCT_CAPABILITIES.has(capability) ||
          !module?.capabilities.includes(capability)
      ))
  ) {
    return "产品能力未通过模块白名单";
  }
  if (
    product.moduleId !== undefined &&
    product.moduleId !== expectedModuleId &&
    !compatibleLegacyDesktopModule
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
      !getProductIntakeDossier(product.id) ||
      identity.mode !== INSTALL_MODES.MANAGED_INSTALLER ||
      identity.vendorId !== vendorId ||
      identity.productType !== product.productType ||
      identity.kind !== product.kind ||
      (product.installProfileId !== undefined &&
        product.installProfileId !== identity.profileId) ||
      !sameStringSet(product.requirements, identity.requirements) ||
      (product.capabilities !== undefined &&
        product.capabilities.some(
          (capability) => !identity.capabilities.includes(capability)
        )) ||
      !hasOnlyAllowedFields(product.download, ALLOWED_DOWNLOAD_FIELDS) ||
      typeof product.download.url !== "string" ||
      typeof product.download.fileName !== "string" ||
      /[\\/]/.test(product.download.fileName) ||
      !matchesManagedDownload(product.id, product.download)
    ) {
      return "托管安装策略未通过客户端本地白名单";
    }
  } else if (product.downloadPolicy === "desktop-download-only") {
    const profile = fixedDesktopDownloadProfile;
    const artifact = profile
      ? validateDesktopDownloadOnlyArtifact(product.id, product.download)
      : validateSignedDesktopDownloadArtifact(product.download);
    if (
      !artifact.ok ||
      product.productType !== "desktop-download-only" ||
      (profile
        ? ![LEGACY_DESKTOP_DOWNLOAD_MODULE_ID, SIGNED_CATALOG_MODULE_ID].includes(product.moduleId)
        : product.moduleId !== SIGNED_CATALOG_MODULE_ID) ||
      (profile
        ? product.installProfileId !== profile.profileId || profile.vendorId !== vendorId
        : product.installProfileId !== SIGNED_CATALOG_PROFILE_ID)
    ) {
      return "desktop-download-only policy is not an approved download contract";
    }
  } else if (product.downloadPolicy === "package-manager") {
    const identity = getInstallRegistration(product.id);
    if (
      !identity ||
      !getProductIntakeDossier(product.id) ||
      identity.mode !== INSTALL_MODES.MANAGED_PACKAGE_MANAGER ||
      identity.downloadPolicy !== "package-manager" ||
      identity.vendorId !== vendorId ||
      identity.productType !== product.productType ||
      identity.kind !== product.kind ||
      product.moduleId !== identity.moduleId ||
      product.installProfileId !== identity.profileId ||
      !sameStringSet(product.requirements, identity.requirements) ||
      (product.capabilities !== undefined &&
        product.capabilities.some(
          (capability) => !identity.capabilities.includes(capability)
        )) ||
      Object.hasOwn(product, "download")
    ) {
      return "Windows package manager policy is not in the client whitelist";
    }
  } else if (Object.hasOwn(product, "download")) {
    return "非托管产品不能声明客户端安装包";
  } else if (!["cli", "cli-deploy-only"].includes(product.productType) && product.installProfileId) {
    return "非托管产品不能绑定安装配置";
  }

  if (product.productType === "cli-deploy-only") {
    const profile = getCliDeployOnlyProfile(product.id);
    if (!profile || profile.vendorId !== vendorId || product.moduleId !== "cli-deploy-only" ||
        product.installProfileId !== profile.profileId ||
        !sameStringSet(product.requirements, profile.requirements) ||
        (product.capabilities !== undefined && product.capabilities.some((capability) => !profile.capabilities.includes(capability)))) {
      return "CLI \u90e8\u7f72\u7b56\u7565\u672a\u901a\u8fc7\u5ba2\u6237\u7aef\u672c\u5730\u767d\u540d\u5355";
    }
  }

  if (product.productType === "cli") {
    const identity = getInstallRegistration(product.id);
    if (
      !identity ||
      !getProductIntakeDossier(product.id) ||
      identity.mode !== INSTALL_MODES.MANAGED_CLI ||
      identity.vendorId !== vendorId ||
      (product.installProfileId !== undefined &&
        product.installProfileId !== identity.profileId) ||
      !sameStringSet(product.requirements, identity.requirements) ||
      (product.capabilities !== undefined &&
        product.capabilities.some(
          (capability) => !identity.capabilities.includes(capability)
        ))
    ) {
      return "CLI 部署策略未通过客户端本地白名单";
    }
  }
  return "";
}

function resolveProductBehavior(product) {
  const registration = currentInstallRegistration(product);
  const directUrl =
    product.productType === "tutorial" ? product.tutorial : product.website;
  const managedCli =
    (product.productType === "cli" && registration?.mode === INSTALL_MODES.MANAGED_CLI) ||
    product.productType === "cli-deploy-only";
  const managedDesktop =
    ["desktop-reviewed", "local-model"].includes(product.productType) &&
    [
      INSTALL_MODES.MANAGED_INSTALLER,
      INSTALL_MODES.MANAGED_PACKAGE_MANAGER
    ].includes(registration?.mode);
  const capabilities = resolvedProductCapabilities(product);
  return Object.freeze({
    productType: product.productType,
    directUrl,
    opensDirectly: [
      "web",
      "desktop-official",
      "cli-official",
      "tutorial"
    ].includes(product.productType),
    capabilities,
    canOpenWebsite: capabilities.includes("website"),
    canOpenTutorial: capabilities.includes("tutorial"),
    canInstall: capabilities.includes("install"),
    canOpenInstalled: capabilities.includes("open"),
    canUninstall: capabilities.includes("uninstall"),
    requiresEnvironmentCheck:
      capabilities.includes("install") &&
      ["desktop-reviewed", "desktop-download-only", "cli", "cli-deploy-only", "local-model"].includes(product.productType),
    managedDownload:
      (product.downloadPolicy === "client-managed" &&
        matchesManagedDownload(product.id, product.download)) ||
      (product.downloadPolicy === "desktop-download-only" &&
        (getDesktopDownloadOnlyProfile(product.id)
          ? validateDesktopDownloadOnlyArtifact(product.id, product.download)
          : validateSignedDesktopDownloadArtifact(product.download)
        ).ok),
    managedCli,
    managedDesktop: managedDesktop || product.productType === "desktop-download-only",
    clientManagedInstall:
      managedCli || managedDesktop || product.productType === "desktop-download-only",
    installMode:
      registration?.mode ||
      (product.productType === "cli-deploy-only" ? "cli-deploy-only" : product.productType === "desktop-download-only" ? "managed-download-only" :
      (product.productType === "desktop-official"
        ? "official-installer-page"
        : product.productType === "cli-official"
          ? "official-cli-install-page"
        : "direct-open")),
    entryPoints: resolveProductEntryPoints(product),
    primaryLabel:
      managedCli
        ? "一键安装"
        : (managedDesktop || product.productType === "desktop-download-only")
          ? product.download
            ? "一键下载"
            : "前往官网下载"
        : product.productType === "desktop-official"
          ? "获取官方安装包"
          : product.productType === "cli-official"
            ? "查看官方安装说明"
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
  PRODUCT_CAPABILITIES,
  resolvedProductCapabilities,
  resolveProductBehavior,
  validateProductPolicy
};
