const crypto = require("node:crypto");
const path = require("node:path");
const {
  matchesManagedDownload
} = require("./managed-downloads.cjs");
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
  validateProductComponentLinks
} = require("./product-components.cjs");

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
  "docker",
  "wsl"
]);
const CATALOG_FIELDS = new Set([
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
const VENDOR_FIELDS = new Set([
  "id",
  "enabled",
  "order",
  "name",
  "initial",
  "mark",
  "iconUrl",
  "color",
  "description",
  "website",
  "tutorial",
  "products"
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

function resolveCatalogCategories(catalog) {
  if (catalog?.categories === undefined) return [...DEFAULT_PRODUCT_CATEGORIES];
  return Array.isArray(catalog.categories) ? [...catalog.categories] : [];
}

function validateCatalog(catalog) {
  if (
    !catalog ||
    catalog.schemaVersion !== 1 ||
    !hasOnlyFields(catalog, CATALOG_FIELDS) ||
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

  const vendorIds = new Set();
  const productIds = new Set();
  const extensionIds = new Set();
  for (const vendor of catalog.vendors) {
    if (
      !hasOnlyFields(vendor, VENDOR_FIELDS) ||
      !isShortText(vendor.id, 80) ||
      vendorIds.has(vendor.id) ||
      !isShortText(vendor.name, 100) ||
      (vendor.enabled !== undefined && typeof vendor.enabled !== "boolean") ||
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
        !isAllowedUrl(vendor.iconUrl)) ||
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
        (product.enabled !== undefined &&
          typeof product.enabled !== "boolean") ||
        (product.order !== undefined &&
          (!Number.isInteger(product.order) ||
            product.order < 0 ||
            product.order > 100000)) ||
        !PRODUCT_KINDS.has(product.kind) ||
        !allowedProductCategories.has(product.category) ||
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
        product.extensions !== undefined &&
        (!Array.isArray(product.extensions) || product.extensions.length > 200)
      ) {
        throw new Error(`产品扩展目录无效：${product.id}`);
      }
      for (const extension of product.extensions || []) {
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
          !/\.(exe|msi|msix|zip)$/i.test(product.download.fileName))
      ) {
        throw new Error(`下载配置无效：${product.id}`);
      }
      if (
        product.download &&
        !matchesManagedDownload(product.id, product.download)
      ) {
        throw new Error(
          `托管安装包未通过客户端策略审核：${product.id}`
        );
      }
      const policyError = validateProductPolicy(product, vendor.id);
      if (policyError) {
        throw new Error(`${policyError}：${product.id}`);
      }
      productIds.add(product.id);
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
      !isShortText(catalog.brand.slogan, 160))
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
          !isShortText(banner.eyebrow, 80) ||
          !isShortText(banner.title, 120) ||
          !isShortText(banner.description, 400) ||
          !isShortText(banner.action, 40)
      ) ||
      !Array.isArray(catalog.home.featuredVendorIds) ||
      catalog.home.featuredVendorIds.length > 12 ||
      catalog.home.featuredVendorIds.some((id) => !vendorIds.has(id))
    ) {
      throw new Error("首页配置无效");
    }
  }
  return catalog;
}

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

module.exports = {
  DEFAULT_PRODUCT_CATEGORIES,
  ENVIRONMENT_REQUIREMENTS,
  PRODUCT_CATEGORIES,
  PRODUCT_KINDS,
  isAllowedUrl,
  resolveCatalogCategories,
  sha256,
  validateCatalog
};
