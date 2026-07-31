"use strict";

const {
  resolvedProductCapabilities
} = require("./product-policy.cjs");

function buildInstalledProductManagement({
  vendors = [],
  desktopStatuses = {},
  cliStatuses = {},
  environmentChecks = [],
  downloadTasks = {}
}) {
  const products = [];
  const reinstallableEnvironments = [];
  const catalogProducts = new Map();

  for (const vendor of vendors) {
    for (const product of Array.isArray(vendor?.products)
      ? vendor.products
      : []) {
      catalogProducts.set(product.id, {
        product,
        vendorName: String(vendor.name || "")
      });
      const allowed = new Set(resolvedProductCapabilities(product));
      if (product.productType === "cli") {
        const status = cliStatuses[product.id];
        if (!status?.installed) continue;
        products.push({
          id: product.id,
          name: product.name,
          vendorName: String(vendor.name || ""),
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
        vendorName: String(vendor.name || ""),
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
    products.push({
      id: `environment:${check.id}`,
      name: String(check.name || check.id),
      vendorName: "运行环境",
      type: "environment",
      version: String(check.version || ""),
      location: String(check.location || ""),
      canOpen: isDesktopEnvironment && check.canOpen !== false,
      canClose: isDesktopEnvironment,
      canManageFiles: Boolean(check.location),
      canReinstall:
        downloadTasks[`environment:${check.id}`]?.phase === "completed",
      canUninstall: check.canUninstall === true
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
