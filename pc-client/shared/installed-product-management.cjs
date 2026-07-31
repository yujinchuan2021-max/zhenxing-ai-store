"use strict";

const {
  resolvedProductCapabilities
} = require("./product-policy.cjs");

function buildInstalledProductManagement({
  vendors = [],
  localInventory = [],
  desktopStatuses = {},
  cliStatuses = {},
  environmentChecks = [],
  wslDistributions = [],
  downloadTasks = {}
}) {
  const products = [];
  const reinstallableEnvironments = [];
  const catalogProducts = new Map();
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
    }
  }

  // The execution inventory is owned by the signed client whitelist, not by
  // the backend display catalog. Keep locally approved products manageable
  // even when an operator disables or removes their catalog card.
  for (const entry of Array.isArray(localInventory) ? localInventory : []) {
    const productId = String(entry?.productId || entry?.id || "");
    if (!productId || catalogProducts.has(productId)) continue;
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
        "AI Hub"
    });
  }

  for (const { product, vendorName } of catalogProducts.values()) {
    const allowed = new Set(resolvedProductCapabilities(product));
    if (product.productType === "cli") {
      const status = cliStatuses[product.id];
      if (!status?.installed) continue;
      products.push({
        id: product.id,
        name: product.name,
        vendorName,
        type: "cli",
        version: String(status.version || ""),
        location: String(status.directory || ""),
        canOpen: allowed.has("open") && status.managed === true,
        canClose: false,
        canManageFiles: Boolean(status.directory),
        canReinstall: false,
        canUninstall:
          allowed.has("uninstall") && status.canUninstall === true
      });
      continue;
    }
    const status = desktopStatuses[product.id];
    if (!status?.installed) continue;
    products.push({
      id: product.id,
      name: product.name,
      vendorName,
      type: "desktop",
      version: String(status.version || ""),
      location: String(status.location || ""),
      canOpen: allowed.has("open") && status.canOpen === true,
      canClose: allowed.has("open") && status.canOpen === true,
      canManageFiles: Boolean(status.location),
      canReinstall:
        allowed.has("install") &&
        downloadTasks[product.id]?.phase === "completed",
      canUninstall:
        allowed.has("uninstall") && status.canUninstall === true
    });
  }

  for (const check of environmentChecks) {
    if (!check?.installed) {
      if (check?.detection === "absent") {
        reinstallableEnvironments.push({
          id: `environment:${check.id}`,
          environmentId: String(check.id),
          name: String(check.name || check.id),
          vendorName: "运行环境",
          type: "environment",
          packageReady:
            downloadTasks[`environment:${check.id}`]?.phase === "completed"
        });
      }
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
  const packages = Object.values(downloadTasks)
    .filter(
      (task) =>
        task?.phase === "completed" &&
        typeof task.filePath === "string" &&
        task.filePath
    )
    .map((task) => ({
      id: task.productId,
      name:
        catalogProducts.get(task.productId)?.product?.name ||
        environmentNames.get(task.productId) ||
        task.productId,
      filePath: task.filePath,
      canInstall: true
    }));

  return { products, reinstallableEnvironments, packages };
}

module.exports = {
  buildInstalledProductManagement
};
