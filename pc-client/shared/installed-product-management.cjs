"use strict";

const {
  resolvedProductCapabilities
} = require("./product-policy.cjs");
const {
  SIGNED_CATALOG_MODULE_ID,
  validateSignedDesktopDownloadArtifact
} = require("./desktop-download-only.cjs");

function isSignedCatalogDesktopDownload(product) {
  return (
    product?.productType === "desktop-download-only" &&
    product.moduleId === SIGNED_CATALOG_MODULE_ID &&
    product.installProfileId === SIGNED_CATALOG_MODULE_ID &&
    resolvedProductCapabilities(product).includes("install") &&
    validateSignedDesktopDownloadArtifact(product.download).ok
  );
}

function localProfileMatchesCatalogProduct(product, entry) {
  if (!entry) return false;
  if (
    product.productType &&
    entry.productType &&
    product.productType !== entry.productType
  ) {
    return false;
  }
  if (product.moduleId && entry.moduleId && product.moduleId !== entry.moduleId) {
    return false;
  }
  if (Object.hasOwn(product, "installProfileId")) {
    const entryProfileId = String(entry.profileId || entry.installProfileId || "");
    if (String(product.installProfileId || "") !== entryProfileId) return false;
  }
  return true;
}

function buildInstalledProductManagement({
  vendors = [],
  localInventory = [],
  desktopStatuses = {},
  cliStatuses = {},
  environmentChecks = [],
  wslDistributions = [],
  downloadTasks = {},
  managedDownloadQueueTasks = {},
  verifiedDownloadTasks = {}
}) {
  const products = [];
  const reinstallableEnvironments = [];
  const catalogProducts = new Map();
  const activeCatalogProductIds = new Set();
  const localProfilesByProductId = new Map();
  const vendorNames = new Map();

  for (const vendor of vendors) {
    if (typeof vendor?.id === "string") {
      vendorNames.set(vendor.id, String(vendor.name || vendor.id));
    }
    for (const product of Array.isArray(vendor?.products)
      ? vendor.products
      : []) {
      catalogProducts.set(product.id, {
        product,
        vendorName: String(vendor.name || "")
      });
      if (vendor.enabled !== false && product.enabled !== false) {
        activeCatalogProductIds.add(product.id);
      }
    }
  }

  // The execution inventory is owned by the signed client whitelist, not by
  // the backend display catalog. Keep locally approved products manageable
  // even when an operator disables or removes their catalog card.
  for (const entry of Array.isArray(localInventory) ? localInventory : []) {
    const productId = String(entry?.productId || entry?.id || "");
    if (!productId) continue;
    localProfilesByProductId.set(productId, entry);
    if (catalogProducts.has(productId)) continue;
    const vendorId = String(entry?.vendorId || "");
    catalogProducts.set(productId, {
      product: {
        id: productId,
        name: String(entry?.label || entry?.name || productId),
        productType:
          entry?.productType === "cli" || entry?.mode === "managed-cli"
            ? "cli"
            : "desktop-reviewed",
        capabilities: Array.isArray(entry?.capabilities)
          ? entry.capabilities
          : []
      },
      vendorName:
        String(entry?.vendorName || "") ||
        vendorNames.get(vendorId) ||
        vendorId ||
        "枕星 AI"
    });
  }

  for (const { product, vendorName } of catalogProducts.values()) {
    const allowed = new Set(resolvedProductCapabilities(product));
    const catalogAllowsFullManagement = activeCatalogProductIds.has(product.id);
    if (product.productType === "cli") {
      const status = cliStatuses[product.id];
      if (!status?.installed) continue;
      const availableVersion = String(status.availableVersion || "").trim();
      const canUpdate =
        catalogAllowsFullManagement &&
        localProfilesByProductId.get(product.id)?.mode === "managed-cli" &&
        allowed.has("update") &&
        status.canUpdate === true &&
        Boolean(availableVersion) &&
        availableVersion !== String(status.version || "");
      products.push({
        id: product.id,
        name: product.name,
        vendorName,
        type: "cli",
        version: String(status.version || ""),
        location: String(status.directory || ""),
        canOpen:
          allowed.has("open") &&
          (status.managed === true || status.canOpen === true),
        canClose: false,
        canManageFiles:
          catalogAllowsFullManagement &&
          status.managed === true &&
          Boolean(status.directory),
        canReinstall: false,
        canGetLatest: false,
        canUpdate,
        availableVersion,
        managedByPackageManager: false,
        updateOwner: "",
        updateStrategy: "",
        canUninstall:
          allowed.has("uninstall") && status.canUninstall === true
      });
      continue;
    }
    const status = desktopStatuses[product.id];
    if (!status?.installed) continue;
    const candidateLocalProfile = localProfilesByProductId.get(product.id);
    const localProfile = localProfileMatchesCatalogProduct(
      product,
      candidateLocalProfile
    )
      ? candidateLocalProfile
      : null;
    const availableVersion = String(status.availableVersion || "").trim();
    const canUpdate =
      catalogAllowsFullManagement &&
      localProfile?.mode === "managed-package-manager" &&
      allowed.has("install") &&
      Boolean(availableVersion) &&
      availableVersion !== String(status.version || "");
    products.push({
      id: product.id,
      name: product.name,
      vendorName,
      type: "desktop",
      version: String(status.version || ""),
      location: String(status.location || ""),
      canOpen: allowed.has("open") && status.canOpen === true,
      canClose:
        catalogAllowsFullManagement &&
        allowed.has("open") &&
        localProfile?.mode !== "managed-package-manager" &&
        status.canOpen === true,
      canManageFiles:
        catalogAllowsFullManagement && Boolean(status.location),
      canReinstall:
        catalogAllowsFullManagement &&
        allowed.has("install") &&
        (localProfile?.mode === "managed-package-manager" ||
          (localProfile?.mode === "managed-installer" &&
            downloadTasks[product.id]?.phase === "completed")),
      canGetLatest:
        catalogAllowsFullManagement &&
        ["managed-installer", "managed-package-manager"].includes(
          localProfile?.mode
        ) &&
        allowed.has("install"),
      managedByPackageManager:
        localProfile?.mode === "managed-package-manager",
      updateOwner: String(localProfile?.lifecycle?.updateOwner || ""),
      updateStrategy: String(localProfile?.lifecycle?.updateStrategy || ""),
      ...(canUpdate ? { availableVersion, canUpdate: true } : {}),
      canUninstall:
        allowed.has("uninstall") && status.canUninstall === true
    });
  }

  for (const check of environmentChecks) {
    if (!check?.installed) {
      continue;
    }
    const isDesktopEnvironment = check.id === "docker";
    const children =
      check.id === "wsl"
        ? wslDistributions.map((distribution) => ({
            id: `wsl:${distribution.name}`,
            name: String(distribution.name || ""),
            environments: (Array.isArray(distribution?.environments)
              ? distribution.environments
              : []
            ).map((environment) => ({
              ...environment,
              id: `wsl:${distribution.name}:${environment.id}:${environment.ownerProductId}`,
              distribution: String(distribution.name || "")
            }))
          }))
        : [];
    products.push({
      id: `environment:${check.id}`,
      name: String(check.name || check.id),
      vendorName: "运行环境",
      type: "environment",
      version: String(check.version || ""),
      location: String(check.location || ""),
      canOpen: check.canOpen === true,
      canClose: isDesktopEnvironment,
      canManageFiles: Boolean(check.location),
      canReinstall:
        downloadTasks[`environment:${check.id}`]?.phase === "completed",
      canGetLatest: false,
      managedByPackageManager: false,
      updateOwner: "",
      updateStrategy: "",
      canUninstall: check.canUninstall === true,
      ...(children.length ? { children } : {})
    });
  }

  const environmentNames = new Map(
    environmentChecks.map((check) => [
      `environment:${check.id}`,
      String(check.name || check.id)
    ])
  );
  const completedPackageTasks = new Map(
    Object.entries(downloadTasks).filter(
      ([productId, task]) =>
        task?.productId === productId &&
        task.phase === "completed" &&
        typeof task.filePath === "string" &&
        task.filePath.trim()
    )
  );
  for (const [productId, queueTask] of Object.entries(
    managedDownloadQueueTasks
  )) {
    const verifiedTask = verifiedDownloadTasks[productId];
    if (
      queueTask?.productId === productId &&
      queueTask.phase === "downloaded" &&
      verifiedTask?.productId === productId &&
      verifiedTask.phase === "completed" &&
      typeof verifiedTask.filePath === "string" &&
      verifiedTask.filePath.trim()
    ) {
      completedPackageTasks.set(productId, verifiedTask);
    }
  }
  const packages = [...completedPackageTasks.values()]
    .map((task) => {
      const catalogProduct = catalogProducts.get(task.productId)?.product;
      return {
        id: task.productId,
        name:
          catalogProduct?.name ||
          environmentNames.get(task.productId) ||
          task.productId,
        filePath: task.filePath,
        canInstall:
          task.productId.startsWith("environment:") ||
          (activeCatalogProductIds.has(task.productId) &&
            (localProfilesByProductId.has(task.productId) ||
              isSignedCatalogDesktopDownload(catalogProduct)))
      };
    });

  return { products, reinstallableEnvironments, packages };
}

module.exports = {
  buildInstalledProductManagement
};
