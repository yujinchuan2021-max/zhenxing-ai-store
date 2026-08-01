"use strict";

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,127}$/;

function authorizationFailure(error, errorCode) {
  return Object.freeze({ ok: false, error, errorCode });
}

function evaluateFreshCatalogProductAuthorization({ catalogResult, productId }) {
  if (typeof productId !== "string" || !PRODUCT_ID.test(productId)) {
    return authorizationFailure(
      "安装产品 ID 无效",
      "CATALOG_PRODUCT_ID_INVALID"
    );
  }
  if (
    !catalogResult ||
    catalogResult.source !== "remote" ||
    !catalogResult.catalog ||
    !Array.isArray(catalogResult.catalog.vendors)
  ) {
    return authorizationFailure(
      "当前无法从后台确认产品启用状态，已停止新的安装操作",
      "ACTIVE_CATALOG_UNAVAILABLE"
    );
  }

  const matches = [];
  for (const vendor of catalogResult.catalog.vendors) {
    if (!vendor || typeof vendor !== "object" || vendor.enabled === false) {
      continue;
    }
    for (const product of Array.isArray(vendor.products) ? vendor.products : []) {
      if (product?.id === productId) matches.push({ vendor, product });
    }
  }
  if (matches.length !== 1 || matches[0].product.enabled === false) {
    return authorizationFailure(
      "该产品已从后台停用或移除，不能继续下载或安装",
      "CATALOG_PRODUCT_DISABLED"
    );
  }
  return Object.freeze({
    ok: true,
    productId,
    catalogVersion: catalogResult.catalogVersion || null
  });
}

async function authorizeFreshCatalogProduct({ loadCatalog, productId }) {
  if (typeof loadCatalog !== "function") {
    throw new TypeError("Active catalog loader is required");
  }
  try {
    return evaluateFreshCatalogProductAuthorization({
      catalogResult: await loadCatalog(),
      productId
    });
  } catch {
    return authorizationFailure(
      "当前无法从后台确认产品启用状态，已停止新的安装操作",
      "ACTIVE_CATALOG_UNAVAILABLE"
    );
  }
}

async function runFreshCatalogAuthorizedOperation({
  productId,
  authorize,
  operation
}) {
  if (typeof authorize !== "function" || typeof operation !== "function") {
    throw new TypeError("Fresh catalog authorization boundary is invalid");
  }
  let authorization;
  try {
    authorization = await authorize(productId);
  } catch {
    authorization = authorizationFailure(
      "当前无法从后台确认产品启用状态，已停止新的安装操作",
      "ACTIVE_CATALOG_UNAVAILABLE"
    );
  }
  if (!authorization || authorization.ok !== true) {
    return Object.freeze({
      authorized: false,
      authorization:
        authorization && typeof authorization === "object"
          ? authorization
          : authorizationFailure(
              "当前无法从后台确认产品启用状态，已停止新的安装操作",
              "ACTIVE_CATALOG_UNAVAILABLE"
            )
    });
  }
  return Object.freeze({
    authorized: true,
    authorization,
    value: await operation(authorization)
  });
}

module.exports = {
  authorizeFreshCatalogProduct,
  evaluateFreshCatalogProductAuthorization,
  runFreshCatalogAuthorizedOperation
};
