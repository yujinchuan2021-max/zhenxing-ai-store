"use strict";

async function scanManagedDesktopInventory({
  productIds,
  createSnapshot,
  detectProduct
}) {
  if (
    !Array.isArray(productIds) ||
    typeof createSnapshot !== "function" ||
    typeof detectProduct !== "function"
  ) {
    throw new TypeError("managed desktop inventory configuration is invalid");
  }
  const uniqueProductIds = [
    ...new Set(productIds.filter((productId) => typeof productId === "string"))
  ];
  if (!uniqueProductIds.length) return {};
  const snapshot = await createSnapshot();
  return Object.fromEntries(
    await Promise.all(
      uniqueProductIds.map(async (productId) => [
        productId,
        await detectProduct(productId, snapshot)
      ])
    )
  );
}

module.exports = { scanManagedDesktopInventory };
