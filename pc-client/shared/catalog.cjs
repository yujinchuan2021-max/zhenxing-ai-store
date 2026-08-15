const crypto = require("node:crypto");
const path = require("node:path");
const {
  matchesManagedDownload
} = require("./managed-downloads.cjs");
const {
  getDesktopDownloadOnlyProfile,
  validateDesktopDownloadOnlyArtifact,
  validateSignedDesktopDownloadArtifact
} = require("./desktop-download-only.cjs");
const {
  validateProductPolicy
} = require("./product-policy.cjs");
const {
  normalizeSourcePreferences
} = require("./environment-download.cjs");
const {
  validateProductExtension
} = require("./product-extensions.cjs");
const {
  validateEcosystemResource,
  validateResourceStore
} = require("./ecosystem-resources.cjs");
const {
  RESOURCE_STORE_KINDS
} = require("./resource-store.cjs");
const {
  validateProductComponentLinks
} = require("./product-components.cjs");
const {
  isAllowedPublishedVendorIconUrl
} = require("./catalog-published-icon-url.cjs");
const {
  validateVendorIconAsset
} = require("./vendor-icon.cjs");
const {
  createResourceMarketplace
} = require("./resource-marketplace.cjs");
const {
  isAgentClassification,
  isCanonicalScenarioTags
} = require("./catalog-taxonomy.cjs");
const {
  validateEnglishLocalization
} = require("./catalog-localization.cjs");

const PRODUCT_KINDS = new Set(["桌面端", "CLI", "其他产品"]);
const DEFAULT_PRODUCT_CATEGORIES = Object.freeze([
  "AI 对话",
  "编程开发",
  "图像创作",
  "视频创作",
  "音频创作",
  "智能体",
  "本地模型"
]);
const PRODUCT_CATEGORIES = new Set(DEFAULT_PRODUCT_CATEGORIES);
const ENVIRONMENT_REQUIREMENTS = new Set([
  "node",
  "git",
  "python",
  "python312",
  "docker",
  "wsl"
]);
const LEGACY_CATALOG_FIELDS = new Set([
  "schemaVersion",
  "updatedAt",
  "categories",
  "brand",
  "extraSections",
  "community",
  "home",
  "environmentDownloads",
  "vendors"
]);
const CATALOG_FIELDS = new Set([
  ...LEGACY_CATALOG_FIELDS,
  "homeCarousel",
  "resourceStores",
  "resources"
]);
const CATALOG_V3_FIELDS = new Set([
  ...CATALOG_FIELDS,
  "resourceConnections"
]);
const HOME_CAROUSEL_FIELDS = new Set(["autoplayMs", "slides"]);
const HOME_SLIDE_FIELDS = new Set([
  "id",
  "imageUrl",
  "imageAlt",
  "title",
  "description",
  "primaryAction",
  "secondaryAction",
  "sort",
  "enabled",
  "localized"
]);
const HOME_ACTION_FIELDS = new Set(["label", "href", "localized"]);
const LEGACY_HOME_BANNER_FIELDS = new Set([
  "eyebrow",
  "title",
  "description",
  "action"
]);
const HOME_BANNER_FIELDS = new Set([
  ...LEGACY_HOME_BANNER_FIELDS,
  "localized"
]);
const HOME_CAROUSEL_ROUTES = new Set([
  "/vendors",
  "/resources/skill",
  "/resources/mcp",
  "/resources/plugin",
  "/resources/connector"
]);
const VENDOR_FIELDS = new Set([
  "id",
  "enabled",
  "order",
  "name",
  "initial",
  "requiresCrossBorderNetwork",
  "mark",
  "iconUrl",
  "iconAsset",
  "color",
  "description",
  "website",
  "tutorial",
  "products",
  "localized"
]);
const PRODUCT_DIRECTORY_KINDS = new Set(["ai-tool", "ai-connectable"]);
const DEFAULT_RESOURCE_STORES = Object.freeze([
  Object.freeze({ id: "skill", label: "Skill 商店", enabled: true, order: 0 }),
  Object.freeze({ id: "mcp", label: "MCP 商店", enabled: true, order: 1 }),
  Object.freeze({ id: "plugin", label: "插件商店", enabled: true, order: 2 }),
  Object.freeze({ id: "connector", label: "连接器商店", enabled: true, order: 3 })
]);

function hasOnlyFields(value, allowed) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((field) => allowed.has(field))
  );
}

function isAllowedUrl(value, allowLocalhost = false) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return (
      allowLocalhost &&
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

function isShortText(value, max = 300) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isAllowedCarouselImageUrl(value) {
  if (!isShortText(value, 500)) return false;
  if (/^\/assets\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(svg|png|jpe?g|webp|avif)$/i.test(value)) {
    return !value.includes("..") && !value.includes("//");
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isAllowedCarouselAction(action) {
  if (
    !hasOnlyFields(action, HOME_ACTION_FIELDS) ||
    !isShortText(action.label, 40) ||
    !isShortText(action.href, 2048) ||
    !validateEnglishLocalization(action.localized, { label: 40 })
  ) return false;
  if (HOME_CAROUSEL_ROUTES.has(action.href)) return true;
  try {
    const url = new URL(action.href);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validateHomeCarousel(homeCarousel) {
  if (
    !hasOnlyFields(homeCarousel, HOME_CAROUSEL_FIELDS) ||
    !Number.isInteger(homeCarousel.autoplayMs) ||
    homeCarousel.autoplayMs < 3000 ||
    homeCarousel.autoplayMs > 12000 ||
    !Array.isArray(homeCarousel.slides) ||
    homeCarousel.slides.length > 10
  ) return false;
  const ids = new Set();
  const sorts = new Set();
  return homeCarousel.slides.every((slide) => {
    if (
      !hasOnlyFields(slide, HOME_SLIDE_FIELDS) ||
      !isShortText(slide.id, 80) ||
      ids.has(slide.id) ||
      !isAllowedCarouselImageUrl(slide.imageUrl) ||
      !isShortText(slide.imageAlt, 200) ||
      !isShortText(slide.title, 120) ||
      !isShortText(slide.description, 400) ||
      !validateEnglishLocalization(slide.localized, {
        imageAlt: 200,
        title: 120,
        description: 400
      }) ||
      !isAllowedCarouselAction(slide.primaryAction) ||
      (slide.secondaryAction !== undefined && !isAllowedCarouselAction(slide.secondaryAction)) ||
      !Number.isInteger(slide.sort) ||
      slide.sort < 0 ||
      sorts.has(slide.sort) ||
      typeof slide.enabled !== "boolean"
    ) return false;
    ids.add(slide.id);
    sorts.add(slide.sort);
    return true;
  });
}

function resolveCatalogCategories(catalog) {
  if (catalog?.categories === undefined) return [...DEFAULT_PRODUCT_CATEGORIES];
  return Array.isArray(catalog.categories) ? [...catalog.categories] : [];
}

function normalizeCatalog(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    return catalog;
  }
  if (catalog.schemaVersion === 2) return catalog;
  if (catalog.schemaVersion !== 1) return catalog;

  const normalized = structuredClone(catalog);
  const resources = [];
  for (const vendor of normalized.vendors || []) {
    for (const product of vendor.products || []) {
      product.directoryKind = "ai-tool";
      for (const extension of product.extensions || []) {
        const {
          extensionType,
          moduleId,
          installProfileId,
          capabilities,
          ...resource
        } = extension;
        resources.push({
          ...resource,
          sourceKind: extension.sourceKind || "community",
          resourceTypes: [extensionType],
          sourceProductIds: [],
          targets: [
            {
              productId: product.id,
              compatibility:
                extension.sourceKind === "official" ? "official" : "verified",
              moduleId:
                moduleId === "skill-link" || moduleId === "mcp-link"
                  ? "resource-link"
                  : moduleId,
              installProfileId,
              capabilities,
              enabled: true
            }
          ]
        });
      }
      delete product.extensions;
    }
  }
  normalized.schemaVersion = 2;
  normalized.resourceStores = DEFAULT_RESOURCE_STORES.map((store) => ({
    ...store
  }));
  normalized.resources = resources;
  return normalized;
}

function validateCatalog(catalog) {
  const inputSchemaVersion = catalog?.schemaVersion;
  if (
    !catalog ||
    ![1, 2, 3].includes(inputSchemaVersion) ||
    !hasOnlyFields(
      catalog,
      inputSchemaVersion === 1
        ? LEGACY_CATALOG_FIELDS
        : inputSchemaVersion === 2
          ? CATALOG_FIELDS
          : CATALOG_V3_FIELDS
    ) ||
    !Array.isArray(catalog.vendors) ||
    catalog.vendors.length < 1 ||
    catalog.vendors.length > 1000
  ) {
    throw new Error("目录结构无效");
  }

  const productCategories = resolveCatalogCategories(catalog);
  if (
    productCategories.length < 1 ||
    productCategories.length > 50 ||
    productCategories.some(
      (category) =>
        !isShortText(category, 40) || category.trim() !== category
    ) ||
    new Set(productCategories).size !== productCategories.length
  ) {
    throw new Error("产品类别配置无效");
  }
  const allowedProductCategories = new Set(productCategories);

  const resourceStoreIds = new Set();
  if (inputSchemaVersion !== 1) {
    if (
      !Array.isArray(catalog.resourceStores) ||
      catalog.resourceStores.length < 1 ||
      catalog.resourceStores.length > 20 ||
      !Array.isArray(catalog.resources) ||
      catalog.resources.length > 10000
    ) {
      throw new Error("生态资源目录结构无效");
    }
    for (const store of catalog.resourceStores) {
      const storeError = validateResourceStore(store);
      if (storeError || resourceStoreIds.has(store.id)) {
        throw new Error(`${storeError || "资源商店 ID 重复"}：${store?.id || "unknown"}`);
      }
      resourceStoreIds.add(store.id);
    }
    if (
      resourceStoreIds.size !== RESOURCE_STORE_KINDS.length ||
      RESOURCE_STORE_KINDS.some((kind) => !resourceStoreIds.has(kind))
    ) {
      throw new Error("生态资源商店必须包含固定的四类频道");
    }
    if (
      inputSchemaVersion === 3 &&
      !Array.isArray(catalog.resourceConnections)
    ) {
      throw new Error("生态资源连接结构无效");
    }
  }

  const vendorIds = new Set();
  const productIds = new Set();
  const productById = new Map();
  const extensionIds = new Set();
  for (const vendor of catalog.vendors) {
    if (
      !hasOnlyFields(vendor, VENDOR_FIELDS) ||
      !isShortText(vendor.id, 80) ||
      vendorIds.has(vendor.id) ||
      !isShortText(vendor.name, 100) ||
      (inputSchemaVersion === 1 && vendor.localized !== undefined) ||
      !validateEnglishLocalization(vendor.localized, {
        name: 100,
        description: 500
      }) ||
      (vendor.enabled !== undefined && typeof vendor.enabled !== "boolean") ||
      (vendor.requiresCrossBorderNetwork !== undefined &&
        typeof vendor.requiresCrossBorderNetwork !== "boolean") ||
      (vendor.order !== undefined &&
        (!Number.isInteger(vendor.order) ||
          vendor.order < 0 ||
          vendor.order > 100000)) ||
      !/^[A-Z]$/.test(vendor.initial) ||
      !isShortText(vendor.mark, 4) ||
      !/^#[0-9a-f]{6}$/i.test(vendor.color) ||
      !isShortText(vendor.description, 500) ||
      !isAllowedUrl(vendor.website) ||
      !isAllowedUrl(vendor.tutorial) ||
      (vendor.iconUrl !== undefined &&
        vendor.iconUrl !== "" &&
        !isAllowedPublishedVendorIconUrl(vendor.iconUrl)) ||
      (vendor.iconAsset !== undefined && Boolean(vendor.iconUrl)) ||
      (vendor.iconAsset !== undefined &&
        (() => {
          try {
            validateVendorIconAsset(vendor.iconAsset);
            return false;
          } catch {
            return true;
          }
        })()) ||
      !Array.isArray(vendor.products) ||
      vendor.products.length > 100
    ) {
      throw new Error(`厂商数据无效：${vendor?.id || "unknown"}`);
    }
    vendorIds.add(vendor.id);

    for (const product of vendor.products) {
      if (
        !isShortText(product.id, 100) ||
        productIds.has(product.id) ||
        !isShortText(product.name, 150) ||
        (inputSchemaVersion === 1 && product.localized !== undefined) ||
        !validateEnglishLocalization(product.localized, {
          name: 150,
          description: 500
        }) ||
        (product.enabled !== undefined &&
          typeof product.enabled !== "boolean") ||
        (product.order !== undefined &&
          (!Number.isInteger(product.order) ||
            product.order < 0 ||
            product.order > 100000)) ||
        (inputSchemaVersion === 1 && product.directoryKind !== undefined) ||
        (inputSchemaVersion !== 1 &&
          !PRODUCT_DIRECTORY_KINDS.has(product.directoryKind)) ||
        !PRODUCT_KINDS.has(product.kind) ||
        !allowedProductCategories.has(product.category) ||
        !isCanonicalScenarioTags(product.scenarioTags) ||
        !isAgentClassification(product) ||
        !isShortText(product.description, 500) ||
        !isAllowedUrl(product.website) ||
        !Array.isArray(product.requirements) ||
        product.requirements.some(
          (item) => !ENVIRONMENT_REQUIREMENTS.has(item)
        )
      ) {
        throw new Error(`产品数据无效：${product?.id || "unknown"}`);
      }
      if (!isAllowedUrl(product.tutorial)) {
        throw new Error(`产品教程地址无效：${product.id}`);
      }
      if (
        inputSchemaVersion !== 1 &&
        product.extensions !== undefined
      ) {
        throw new Error(`产品不能再包含扩展子目录：${product.id}`);
      }
      if (
        inputSchemaVersion === 1 &&
        product.extensions !== undefined &&
        (!Array.isArray(product.extensions) || product.extensions.length > 200)
      ) {
        throw new Error(`产品扩展目录无效：${product.id}`);
      }
      for (const extension of
        inputSchemaVersion === 1 ? product.extensions || [] : []) {
        if (
          !isShortText(extension.id, 120) ||
          extensionIds.has(extension.id) ||
          !isShortText(extension.name, 150) ||
          !isShortText(extension.description, 500) ||
          !isAllowedUrl(extension.website) ||
          !isAllowedUrl(extension.tutorial) ||
          (extension.enabled !== undefined &&
            typeof extension.enabled !== "boolean") ||
          (extension.order !== undefined &&
            (!Number.isInteger(extension.order) ||
              extension.order < 0 ||
              extension.order > 100000)) ||
          typeof extension.installProfileId !== "string" ||
          extension.installProfileId.length > 120
        ) {
          throw new Error(`扩展资源数据无效：${extension?.id || "unknown"}`);
        }
        const extensionPolicyError = validateProductExtension(
          extension,
          product.id
        );
        if (extensionPolicyError) {
          throw new Error(`${extensionPolicyError}：${extension.id}`);
        }
        extensionIds.add(extension.id);
      }
      if (
        product.download &&
        (!isAllowedUrl(product.download.url) ||
          !isShortText(product.download.fileName, 180) ||
          path.basename(product.download.fileName) !==
            product.download.fileName ||
          !/\.(exe|msi|msix|zip)$/i.test(product.download.fileName) ||
          (product.download.artifactKind !== undefined && !/^(exe|msi|msix|zip)$/.test(product.download.artifactKind)))
      ) {
        throw new Error(`下载配置无效：${product.id}`);
      }
      if (product.download && product.downloadPolicy === "client-managed" && !matchesManagedDownload(product.id, product.download)) {
        throw new Error(
          `托管安装包未通过客户端策略审核：${product.id}`
        );
      }
      if (product.downloadPolicy === "desktop-download-only" && !(getDesktopDownloadOnlyProfile(product.id)
        ? validateDesktopDownloadOnlyArtifact(product.id, product.download)
        : validateSignedDesktopDownloadArtifact(product.download)).ok) {
        throw new Error(`desktop-download-only artifact rejected: ${product.id}`);
      }
      const policyError = validateProductPolicy(product, vendor.id);
      if (policyError) {
        throw new Error(`${policyError}：${product.id}`);
      }
      productIds.add(product.id);
      productById.set(product.id, product);
    }
  }

  if (inputSchemaVersion !== 1) {
    const resourceIds = new Set();
    for (const resource of catalog.resources) {
      if (resourceIds.has(resource?.id)) {
        throw new Error(`生态资源 ID 重复：${resource?.id || "unknown"}`);
      }
      const resourceError = validateEcosystemResource(resource, {
        productById,
        vendorIds,
        resourceStoreIds
      });
      if (resourceError) {
        throw new Error(`${resourceError}：${resource?.id || "unknown"}`);
      }
      resourceIds.add(resource.id);
    }
  }

  const componentLinkError = validateProductComponentLinks(catalog.vendors);
  if (componentLinkError) {
    throw new Error(`产品组件目录无效：${componentLinkError}`);
  }

  if (catalog.environmentDownloads) {
    if (
      catalog.environmentDownloads.strategy !== "official-first" ||
      !Number.isInteger(catalog.environmentDownloads.probeTimeoutMs) ||
      catalog.environmentDownloads.probeTimeoutMs < 1000 ||
      catalog.environmentDownloads.probeTimeoutMs > 15000 ||
      !hasOnlyFields(
        catalog.environmentDownloads,
        new Set(["strategy", "probeTimeoutMs", "sources"])
      )
    ) {
      throw new Error("环境下载策略无效");
    }
    catalog.environmentDownloads.sources = normalizeSourcePreferences(
      catalog.environmentDownloads.sources
    );
  }

  if (
    catalog.brand &&
    (!isShortText(catalog.brand.name, 60) ||
      !isShortText(catalog.brand.mark, 4) ||
      !isShortText(catalog.brand.slogan, 160) ||
      (inputSchemaVersion === 1 && catalog.brand.localized !== undefined) ||
      !validateEnglishLocalization(catalog.brand.localized, { slogan: 160 }))
  ) {
    throw new Error("品牌配置无效");
  }

  if (
    catalog.extraSections &&
    (!Array.isArray(catalog.extraSections) ||
      catalog.extraSections.length > 20 ||
      catalog.extraSections.some(
        (section) =>
          !isShortText(section.id, 80) ||
          !isShortText(section.title, 80) ||
          !isShortText(section.description, 300) ||
          (inputSchemaVersion === 1 && section.localized !== undefined) ||
          !validateEnglishLocalization(section.localized, { title: 80 }) ||
          typeof section.enabled !== "boolean" ||
          !isAllowedUrl(section.url)
      ) ||
      new Set(catalog.extraSections.map((section) => section.id)).size !==
        catalog.extraSections.length)
  ) {
    throw new Error("其他板块配置无效");
  }

  if (
    catalog.community &&
    (!isShortText(catalog.community.title, 80) ||
      !isShortText(catalog.community.description, 300) ||
      (inputSchemaVersion === 1 && catalog.community.localized !== undefined) ||
      !validateEnglishLocalization(catalog.community.localized, {
        title: 80,
        description: 300
      }) ||
      !isShortText(catalog.community.provider, 40) ||
      typeof catalog.community.enabled !== "boolean" ||
      (catalog.community.url !== "" &&
        !isAllowedUrl(catalog.community.url)) ||
      (catalog.community.enabled &&
        !isAllowedUrl(catalog.community.url)))
  ) {
    throw new Error("社区配置无效");
  }

  if (catalog.home) {
    if (
      !Array.isArray(catalog.home.banners) ||
      catalog.home.banners.length < 1 ||
      catalog.home.banners.length > 10 ||
      catalog.home.banners.some(
        (banner) =>
          !hasOnlyFields(
            banner,
            inputSchemaVersion === 1
              ? LEGACY_HOME_BANNER_FIELDS
              : HOME_BANNER_FIELDS
          ) ||
          !isShortText(banner.eyebrow, 80) ||
          !isShortText(banner.title, 120) ||
          !isShortText(banner.description, 400) ||
          !isShortText(banner.action, 40) ||
          !validateEnglishLocalization(banner.localized, {
            eyebrow: 80,
            title: 120,
            description: 400,
            action: 40
          })
      ) ||
      !Array.isArray(catalog.home.featuredVendorIds) ||
      catalog.home.featuredVendorIds.length > 12 ||
      catalog.home.featuredVendorIds.some((id) => !vendorIds.has(id))
    ) {
      throw new Error("首页配置无效");
    }
  }

  if (catalog.homeCarousel !== undefined && !validateHomeCarousel(catalog.homeCarousel)) {
    throw new Error("首页视觉轮播配置无效");
  }
  if (inputSchemaVersion === 3) {
    createResourceMarketplace({
      ...catalog,
      connections: catalog.resourceConnections
    });
  }
  return inputSchemaVersion === 1
    ? validateCatalog(normalizeCatalog(catalog))
    : catalog;
}

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

module.exports = {
  DEFAULT_PRODUCT_CATEGORIES,
  ENVIRONMENT_REQUIREMENTS,
  DEFAULT_RESOURCE_STORES,
  PRODUCT_DIRECTORY_KINDS,
  PRODUCT_CATEGORIES,
  PRODUCT_KINDS,
  HOME_CAROUSEL_ROUTES,
  isAllowedUrl,
  isAllowedCarouselImageUrl,
  validateHomeCarousel,
  normalizeCatalog,
  resolveCatalogCategories,
  sha256,
  validateCatalog
};
