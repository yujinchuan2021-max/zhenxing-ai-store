"use strict";

function runWhenManagedDownloadSlotAvailable(
  { productId, activeProductIds },
  operation
) {
  if (typeof productId !== "string" || !productId) {
    throw new TypeError("productId must be a non-empty string");
  }
  if (!Array.isArray(activeProductIds)) {
    throw new TypeError("activeProductIds must be an array");
  }
  if (typeof operation !== "function") {
    throw new TypeError("operation must be a function");
  }

  const activeProductId = activeProductIds.find(
    (candidate) => typeof candidate === "string" && candidate
  );
  if (activeProductId) {
    return {
      executed: false,
      reason:
        activeProductId === productId
          ? "same-product-active"
          : "global-slot-busy",
      activeProductId
    };
  }

  return { executed: true, value: operation() };
}

module.exports = { runWhenManagedDownloadSlotAvailable };
