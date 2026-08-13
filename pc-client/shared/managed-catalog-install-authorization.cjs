"use strict";

const {
  resolveManagedProductActionContext
} = require("./managed-product-action-context.cjs");
const {
  getDesktopDownloadOnlyProfile,
  LEGACY_DESKTOP_DOWNLOAD_MODULE_ID,
  SIGNED_CATALOG_MODULE_ID,
  SIGNED_CATALOG_PROFILE_ID,
  validateDesktopDownloadOnlyArtifact,
  validateSignedDesktopDownloadArtifact,
  buildDesktopDownloadOnlyPlan,
  buildSignedDesktopDownloadPlan
} = require("./desktop-download-only.cjs");

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,127}$/;

function authorizationFailure(error, errorCode) {
  return Object.freeze({ ok: false, error, errorCode });
}

function evaluateFreshCatalogProductAuthorization({
  catalogResult,
  productId,
  requiredCapability = "install"
}) {
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
  if (
    typeof requiredCapability !== "string" ||
    !Array.isArray(matches[0].product.capabilities) ||
    !matches[0].product.capabilities.includes(requiredCapability)
  ) {
    return authorizationFailure(
      "该产品的安装能力已由后台关闭",
      "CATALOG_PRODUCT_CAPABILITY_DISABLED"
    );
  }
  return Object.freeze({
    ok: true,
    productId,
    catalogVersion: catalogResult.catalogVersion || null
  });
}

function evaluateFreshDesktopDownloadOnlyAuthorization({
  catalogResult,
  productId,
  artifact
}) {
  const authorization = evaluateFreshCatalogProductAuthorization({
    catalogResult,
    productId
  });
  if (!authorization.ok) return authorization;
  const profile = getDesktopDownloadOnlyProfile(productId);
  const requestedArtifact = profile
    ? validateDesktopDownloadOnlyArtifact(productId, artifact)
    : validateSignedDesktopDownloadArtifact(artifact);
  const context = resolveManagedProductActionContext({
    productId,
    vendors: catalogResult.catalog.vendors,
    requireCatalogEnabled: true
  });
  if (
    !requestedArtifact.ok ||
    !context ||
    (profile
      ? ![LEGACY_DESKTOP_DOWNLOAD_MODULE_ID, SIGNED_CATALOG_MODULE_ID].includes(context.moduleId)
      : context.moduleId !== SIGNED_CATALOG_MODULE_ID) ||
    context.installProfileId !== (profile ? profile.profileId : SIGNED_CATALOG_PROFILE_ID) ||
    context.downloadPolicy !== "desktop-download-only" ||
    JSON.stringify(context.download) !== JSON.stringify(requestedArtifact.artifact)
  ) {
    return authorizationFailure(
      "desktop-download-only 产品或下载工件未通过客户端固定配置校验",
      "DESKTOP_DOWNLOAD_ONLY_NOT_APPROVED"
    );
  }
  const plan = profile
    ? buildDesktopDownloadOnlyPlan(productId, requestedArtifact.artifact)
    : buildSignedDesktopDownloadPlan(productId, requestedArtifact.artifact);
  return plan ? Object.freeze({ ...authorization, plan }) : authorizationFailure(
    "desktop-download-only download plan rejected",
    "DESKTOP_DOWNLOAD_ONLY_NOT_APPROVED"
  );
}

async function authorizeFreshCatalogProduct({
  loadCatalog,
  productId,
  requiredCapability = "install"
}) {
  if (typeof loadCatalog !== "function") {
    throw new TypeError("Active catalog loader is required");
  }
  try {
    return evaluateFreshCatalogProductAuthorization({
      catalogResult: await loadCatalog(),
      productId,
      requiredCapability
    });
  } catch {
    return authorizationFailure(
      "当前无法从后台确认产品启用状态，已停止新的安装操作",
      "ACTIVE_CATALOG_UNAVAILABLE"
    );
  }
}

async function authorizeFreshDesktopDownloadOnlyProduct({
  loadCatalog,
  productId,
  artifact
}) {
  if (typeof loadCatalog !== "function") {
    throw new TypeError("Active catalog loader is required");
  }
  try {
    return evaluateFreshDesktopDownloadOnlyAuthorization({
      catalogResult: await loadCatalog(),
      productId,
      artifact
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
  authorizeFreshDesktopDownloadOnlyProduct,
  evaluateFreshDesktopDownloadOnlyAuthorization,
  evaluateFreshCatalogProductAuthorization,
  runFreshCatalogAuthorizedOperation
};
