"use strict";

const {
  normalizeCatalog,
  validateCatalog
} = require("../shared/catalog.cjs");
const {
  getApprovedEnvironmentDownloadSources
} = require("../shared/environment-download.cjs");
const { validateUpdatePayload } = require("../shared/update-release.cjs");
const {
  getInstallRegistration
} = require("../shared/install-registry.cjs");
const {
  getProductModule,
  moduleIdForProductType
} = require("../shared/product-modules.cjs");
const {
  getDesktopDownloadOnlyProfile,
  SIGNED_CATALOG_MODULE_ID,
  SIGNED_CATALOG_PROFILE_ID
} = require("../shared/desktop-download-only.cjs");
const {
  getCliDeployOnlyProfile
} = require("../shared/cli-deploy-only.cjs");

const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "catalog",
  "update"
]);
const CATALOG_FIELDS = new Set([
  "notes",
  "rolloutPercentage",
  "rolloutSalt"
]);
const UPDATE_FIELDS = new Set([
  "version",
  "downloadUrl",
  "sha256",
  "fileSize",
  "notes",
  "rolloutPercentage",
  "rolloutSalt",
  "enabled"
]);

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}

function hasOnlyFields(value, fields) {
  return (
    isPlainObject(value) &&
    Object.keys(value).every((field) => fields.has(field))
  );
}

function defaultReleaseSettings() {
  return {
    schemaVersion: 1,
    catalog: {
      notes: "",
      rolloutPercentage: 100,
      rolloutSalt: "catalog-stable-2026"
    },
    update: {
      version: "0.1.1",
      downloadUrl: "",
      sha256: "",
      fileSize: 0,
      notes: [],
      rolloutPercentage: 0,
      rolloutSalt: "update-stable-2026",
      enabled: false
    }
  };
}

function mergeReleaseSettings(value) {
  const defaults = defaultReleaseSettings();
  return {
    schemaVersion: 1,
    catalog: { ...defaults.catalog, ...(value?.catalog || {}) },
    update: { ...defaults.update, ...(value?.update || {}) }
  };
}

function validateReleaseSettings(value) {
  if (
    !hasOnlyFields(value, TOP_LEVEL_FIELDS) ||
    value.schemaVersion !== 1 ||
    !hasOnlyFields(value.catalog, CATALOG_FIELDS) ||
    !hasOnlyFields(value.update, UPDATE_FIELDS)
  ) {
    throw new Error("发布设置包含未批准字段");
  }
  const settings = mergeReleaseSettings(value);
  if (
    !Number.isInteger(settings.catalog.rolloutPercentage) ||
    settings.catalog.rolloutPercentage < 0 ||
    settings.catalog.rolloutPercentage > 100 ||
    typeof settings.catalog.rolloutSalt !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{7,63}$/i.test(settings.catalog.rolloutSalt) ||
    typeof settings.catalog.notes !== "string" ||
    settings.catalog.notes.length > 500 ||
    typeof settings.update.enabled !== "boolean" ||
    !Number.isInteger(settings.update.rolloutPercentage) ||
    settings.update.rolloutPercentage < 0 ||
    settings.update.rolloutPercentage > 100 ||
    typeof settings.update.rolloutSalt !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{7,63}$/i.test(settings.update.rolloutSalt) ||
    !Array.isArray(settings.update.notes) ||
    settings.update.notes.length > 20 ||
    settings.update.notes.some(
      (note) =>
        typeof note !== "string" || note.length < 1 || note.length > 300
    )
  ) {
    throw new Error("发布设置无效");
  }
  return settings;
}

function validateUpdateSettings(update) {
  if (!update.enabled) return;
  const origin = new URL(update.downloadUrl).origin;
  validateUpdatePayload(
    {
      version: update.version,
      publishedAt: new Date().toISOString(),
      downloadUrl: update.downloadUrl,
      sha256: update.sha256,
      fileSize: update.fileSize,
      platform: "win32",
      arch: "x64",
      channel: "stable",
      notes: update.notes,
      rollout: {
        percentage: update.rolloutPercentage,
        salt: update.rolloutSalt
      }
    },
    [origin]
  );
}

function validatePublication(
  catalog,
  rawSettings,
  { reviewedVendorLogoFallbackIds = [] } = {}
) {
  const validatedCatalog = validateCatalog(normalizeCatalog(catalog));
  const settings = validateReleaseSettings(rawSettings);
  validateUpdateSettings(settings.update);
  const warnings = [];
  const enabledVendors = validatedCatalog.vendors.filter(
    (vendor) => vendor.enabled !== false
  );
  const enabledProducts = enabledVendors.flatMap((vendor) =>
    vendor.products.filter((product) => product.enabled !== false)
  );
  const enabledProductIds = new Set(
    enabledProducts.map((product) => product.id)
  );
  const enabledStoreIds = new Set(
    validatedCatalog.resourceStores
      .filter((store) => store.enabled !== false)
      .map((store) => store.id)
  );
  const enabledResources = validatedCatalog.resources.filter(
    (resource) =>
      resource.enabled !== false &&
      resource.resourceTypes.some((type) => enabledStoreIds.has(type)) &&
      resource.targets.some(
        (target) =>
          target.enabled !== false && enabledProductIds.has(target.productId)
      )
  );
  for (const vendor of validatedCatalog.vendors) {
    for (const product of vendor.products) {
      const module = getProductModule(product.moduleId);
      if (
        !module ||
        module.id !== moduleIdForProductType(product.productType)
      ) {
        throw new Error(`产品尚未绑定有效模块：${product.id}`);
      }
      const registration = getInstallRegistration(product.id);
      const fixedProfile =
        module.id === SIGNED_CATALOG_MODULE_ID
          ? getDesktopDownloadOnlyProfile(product.id)
          : module.id === "cli-deploy-only"
            ? getCliDeployOnlyProfile(product.id)
            : null;
      const catalogProfile =
        module.id === SIGNED_CATALOG_MODULE_ID && !fixedProfile
          ? {
              profileId: SIGNED_CATALOG_PROFILE_ID,
              capabilities: module.capabilities
            }
          : null;
      const reviewedProfile = fixedProfile || catalogProfile || registration;
      if (
        module.requiresProfile &&
        (!reviewedProfile ||
          product.installProfileId !== reviewedProfile.profileId ||
          (!fixedProfile && !catalogProfile && registration && registration.moduleId !== module.id) ||
          (reviewedProfile.vendorId !== undefined && reviewedProfile.vendorId !== vendor.id))
      ) {
        throw new Error(`产品尚未绑定客户端已审核安装配置：${product.id}`);
      }
      if (!module.requiresProfile && product.installProfileId) {
        throw new Error(`直达模块不能绑定安装配置：${product.id}`);
      }
      const approvedCapabilities =
        reviewedProfile?.capabilities || module.capabilities;
      if (
        product.capabilities !== undefined &&
        (!Array.isArray(product.capabilities) ||
          product.capabilities.some(
            (capability) => !approvedCapabilities.includes(capability)
          ))
      ) {
        throw new Error(`产品能力未通过客户端本地白名单：${product.id}`);
      }
    }
  }
  const disabledFeatured = validatedCatalog.home.featuredVendorIds.filter(
    (id) => !enabledVendors.some((vendor) => vendor.id === id)
  );
  if (disabledFeatured.length) {
    throw new Error(`精选厂商已停用：${disabledFeatured.join("、")}`);
  }
  if (!settings.update.enabled) {
    warnings.push("客户端自动更新当前未启用");
  }
  const reviewedFallbacks = new Set(reviewedVendorLogoFallbackIds);
  const vendorsWithoutLogos = enabledVendors.filter(
    (vendor) => !vendor.iconAsset
  );
  const reviewedLetterFallbacks = vendorsWithoutLogos.filter((vendor) =>
    reviewedFallbacks.has(vendor.id)
  ).length;
  const unreviewedLogoCount = vendorsWithoutLogos.length - reviewedLetterFallbacks;
  if (reviewedLetterFallbacks) {
    warnings.push(`${reviewedLetterFallbacks} 个启用厂商使用已审核字母 Logo 兜底`);
  }
  if (unreviewedLogoCount) {
    warnings.push(`${unreviewedLogoCount} 个启用厂商尚未上传审核 Logo`);
  }
  const sourceRegistry = getApprovedEnvironmentDownloadSources();
  const enabledMirrors = validatedCatalog.environmentDownloads.sources.filter(
    (entry) =>
      entry.enabled &&
      sourceRegistry.some(
        (source) =>
          source.environmentId === entry.environmentId &&
          source.sourceId === entry.sourceId &&
          source.region === "china"
      )
  ).length;
  return {
    ok: true,
    summary: {
      vendors: enabledVendors.length,
      vendorLogos: enabledVendors.length - vendorsWithoutLogos.length,
      vendorLogoFallbacks: reviewedLetterFallbacks,
      products: enabledProducts.length,
      resources: enabledResources.length,
      resourceStores: enabledStoreIds.size,
      banners: validatedCatalog.home.banners.length,
      homeCarouselSlides: validatedCatalog.homeCarousel?.slides.length || 0,
      featuredVendors: validatedCatalog.home.featuredVendorIds.length,
      approvedDownloadSources: validatedCatalog.environmentDownloads.sources.filter(
        (entry) => entry.enabled
      ).length,
      enabledChinaMirrors: enabledMirrors
    },
    warnings
  };
}

module.exports = {
  defaultReleaseSettings,
  mergeReleaseSettings,
  validatePublication,
  validateReleaseSettings,
  validateUpdateSettings
};
