"use strict";

const {
  getInstallRegistration,
  getProductIntakeDossier,
  INSTALL_MODES
} = require("./install-registry.cjs");
const { getManagedDownload } = require("./managed-downloads.cjs");
const { getProductModule } = require("./product-modules.cjs");

const INSTALLED_INSTANCE_RECOVERY_CAPABILITIES = Object.freeze([
  "open",
  "uninstall"
]);

function sameStringSet(left, right) {
  if (
    !Array.isArray(left) ||
    !Array.isArray(right) ||
    left.some((item) => typeof item !== "string") ||
    right.some((item) => typeof item !== "string") ||
    new Set(left).size !== left.length ||
    new Set(right).size !== right.length
  ) {
    return false;
  }
  if (left.length !== right.length) return false;
  const normalizedRight = [...right].sort();
  return [...left]
    .sort()
    .every((item, index) => item === normalizedRight[index]);
}

function matchingLocalProfile(localInventory, productId, registration) {
  const profile = (Array.isArray(localInventory) ? localInventory : []).find(
    (candidate) => candidate?.productId === productId
  );
  if (
    !profile ||
    profile.id !== registration.profileId ||
    profile.label !== registration.label ||
    profile.moduleId !== registration.moduleId ||
    profile.vendorId !== registration.vendorId ||
    profile.productType !== registration.productType ||
    profile.kind !== registration.kind ||
    profile.mode !== registration.mode ||
    !sameStringSet(profile.requirements, registration.requirements) ||
    !sameStringSet(profile.capabilities, registration.capabilities)
  ) {
    return null;
  }
  const download = getManagedDownload(productId);
  if (registration.mode === INSTALL_MODES.MANAGED_INSTALLER) {
    if (
      !download ||
      profile.download?.url !== download.url ||
      profile.download?.fileName !== download.fileName
    ) {
      return null;
    }
  }
  return profile;
}

function matchingCatalogProduct(
  vendors,
  productId,
  registration,
  requireEnabled = false
) {
  for (const vendor of Array.isArray(vendors) ? vendors : []) {
    if (vendor?.id !== registration.vendorId) continue;
    if (requireEnabled && vendor.enabled === false) return null;
    const product = (Array.isArray(vendor.products) ? vendor.products : []).find(
      (candidate) => candidate?.id === productId
    );
    if (!product) continue;
    if (requireEnabled && product.enabled === false) return null;
    if (
      product.productType !== registration.productType ||
      product.kind !== registration.kind ||
      (product.moduleId !== undefined &&
        product.moduleId !== registration.moduleId) ||
      (product.installProfileId !== undefined &&
        product.installProfileId !== registration.profileId) ||
      !sameStringSet(product.requirements, registration.requirements)
    ) {
      return null;
    }
    return product;
  }
  return null;
}

function safeDisplayString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function resolveManagedProductActionContext({
  productId,
  vendors = [],
  localInventory = [],
  requireCatalogEnabled = false
}) {
  const registration = getInstallRegistration(productId);
  const dossier = getProductIntakeDossier(productId);
  if (!registration || !dossier) return null;

  const module = getProductModule(registration.moduleId);
  if (!module || module.requiresProfile !== true) return null;

  const catalogProduct = matchingCatalogProduct(
    vendors,
    productId,
    registration,
    false
  );
  const enabledCatalogProduct = matchingCatalogProduct(
    vendors,
    productId,
    registration,
    true
  );
  const localProfile = matchingLocalProfile(
    localInventory,
    productId,
    registration
  );
  if (requireCatalogEnabled && !enabledCatalogProduct) return null;
  if (!catalogProduct && !localProfile) return null;

  const requestedCapabilities = enabledCatalogProduct
    ? Array.isArray(enabledCatalogProduct.capabilities)
      ? enabledCatalogProduct.capabilities
      : registration.capabilities
    : INSTALLED_INSTANCE_RECOVERY_CAPABILITIES;
  const capabilities = requestedCapabilities.filter((capability) =>
    registration.capabilities.includes(capability)
  );
  const download = getManagedDownload(productId);
  if (registration.mode === INSTALL_MODES.MANAGED_INSTALLER && !download) {
    return null;
  }

  return Object.freeze({
    id: productId,
    name: safeDisplayString(
      catalogProduct?.name,
      safeDisplayString(localProfile?.label, registration.label)
    ),
    kind: registration.kind,
    category: safeDisplayString(catalogProduct?.category),
    description: safeDisplayString(catalogProduct?.description),
    website: safeDisplayString(catalogProduct?.website),
    tutorial: safeDisplayString(catalogProduct?.tutorial),
    productType: registration.productType,
    moduleId: registration.moduleId,
    installProfileId: registration.profileId,
    requirements: Object.freeze([...registration.requirements]),
    installPolicy: module.installPolicy,
    downloadPolicy: module.downloadPolicy,
    signaturePolicy: module.signaturePolicy,
    uninstallPolicy: module.uninstallPolicy,
    capabilities: Object.freeze(capabilities),
    ...(download
      ? {
          download: Object.freeze({
            url: download.url,
            fileName: download.fileName
          })
        }
      : {})
  });
}

function resolveManagedProductActionContexts({
  vendors = [],
  localInventory = []
} = {}) {
  const productIds = new Set();
  for (const vendor of Array.isArray(vendors) ? vendors : []) {
    for (const product of Array.isArray(vendor?.products)
      ? vendor.products
      : []) {
      if (typeof product?.id === "string") productIds.add(product.id);
    }
  }
  for (const profile of Array.isArray(localInventory) ? localInventory : []) {
    if (typeof profile?.productId === "string") {
      productIds.add(profile.productId);
    }
  }
  return Object.freeze(
    [...productIds]
      .map((productId) =>
        resolveManagedProductActionContext({
          productId,
          vendors,
          localInventory
        })
      )
      .filter(Boolean)
  );
}

module.exports = {
  resolveManagedProductActionContext,
  resolveManagedProductActionContexts
};
