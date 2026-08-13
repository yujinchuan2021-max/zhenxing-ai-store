"use strict";

function normalizeIds(values) {
  return [...new Set((values || []).filter((value) => typeof value === "string" && value))];
}

function createEnvironmentInstallOrchestrator() {
  const pendingProducts = new Map();
  const queue = [];
  let activeEnvironmentId = "";

  return Object.freeze({
    enqueue(productId, requirements) {
      const normalized = normalizeIds(requirements);
      pendingProducts.set(productId, normalized);
      for (const environmentId of normalized) {
        if (environmentId !== activeEnvironmentId && !queue.includes(environmentId)) {
          queue.push(environmentId);
        }
      }
      return this.snapshot();
    },
    next(installedIds) {
      const installed = new Set(normalizeIds(installedIds));
      if (activeEnvironmentId && installed.has(activeEnvironmentId)) {
        activeEnvironmentId = "";
      }
      while (queue.length && installed.has(queue[0])) queue.shift();
      if (!activeEnvironmentId) activeEnvironmentId = queue.shift() || "";
      return activeEnvironmentId;
    },
    complete(environmentId) {
      if (environmentId === activeEnvironmentId) activeEnvironmentId = "";
      const index = queue.indexOf(environmentId);
      if (index >= 0) queue.splice(index, 1);
      return this.snapshot();
    },
    readyProducts(installedIds) {
      const installed = new Set(normalizeIds(installedIds));
      const ready = [];
      for (const [productId, requirements] of pendingProducts) {
        if (requirements.every((environmentId) => installed.has(environmentId))) {
          ready.push(productId);
          pendingProducts.delete(productId);
        }
      }
      return ready;
    },
    fail(environmentId) {
      if (environmentId === activeEnvironmentId) activeEnvironmentId = "";
      queue.length = 0;
      const productIds = [...pendingProducts.keys()];
      pendingProducts.clear();
      return productIds;
    },
    snapshot() {
      return Object.freeze({
        activeEnvironmentId,
        queuedEnvironmentIds: Object.freeze([...queue]),
        pendingProductIds: Object.freeze([...pendingProducts.keys()])
      });
    }
  });
}

module.exports = {
  createEnvironmentInstallOrchestrator
};
