"use strict";

const {
  MICROSOFT_STORE_WEB_URL
} = require("./microsoft-store-repair.cjs");

const OFFICIAL_DOWNLOAD_KINDS = Object.freeze([
  "vendor-bootstrap",
  "download-page",
  "fixed-redirect",
  "stable-redirect",
  "store",
  "login-required",
  "manual-selector",
  "no-windows"
]);
const OFFICIAL_DOWNLOAD_FIELDS = new Set([
  "url",
  "kind",
  "coveredProductIds",
  "note"
]);
const MAX_OFFICIAL_DOWNLOAD_URL_LENGTH = 2048;
const MAX_OFFICIAL_DOWNLOAD_NOTE_LENGTH = 120;
const MAX_COVERED_PRODUCT_IDS = 20;
const MICROSOFT_STORE_ORIGIN = new URL(MICROSOFT_STORE_WEB_URL).origin;
const MICROSOFT_STORE_INSTALLER_ORIGIN = "https://get.microsoft.com";
const MICROSOFT_STORE_INSTALLER_PATH = /^\/installer\/download\/[A-Z0-9]{12}$/;
const OFFICIAL_DOWNLOAD_PRESENTATIONS = Object.freeze({
  "vendor-bootstrap": Object.freeze({
    buttonLabel: "打开厂商安装流程",
    steps: Object.freeze(["在厂商流程中选择产品和 Windows 版本"]),
    opensExternal: true
  }),
  "download-page": Object.freeze({
    buttonLabel: "前往官网下载",
    steps: Object.freeze(["在官网选择 Windows 版本"]),
    opensExternal: true
  }),
  "fixed-redirect": Object.freeze({
    buttonLabel: "前往官网下载",
    steps: Object.freeze(["在官网继续到 Windows 下载入口"]),
    opensExternal: true
  }),
  "stable-redirect": Object.freeze({
    buttonLabel: "前往官方下载入口",
    steps: Object.freeze(["在官网继续到 Windows 下载入口"]),
    opensExternal: true
  }),
  store: Object.freeze({
    buttonLabel: "打开官方商店入口",
    steps: Object.freeze(["在官方商店流程中获取 Windows 版本"]),
    opensExternal: true
  }),
  "login-required": Object.freeze({
    buttonLabel: "登录后前往下载",
    steps: Object.freeze(["在厂商官网登录", "按厂商页面流程下载 Windows 版本"]),
    opensExternal: true
  }),
  "manual-selector": Object.freeze({
    buttonLabel: "打开版本选择页",
    steps: Object.freeze(["在官网手动选择 Windows 版本和安装包"]),
    opensExternal: true
  }),
  "no-windows": Object.freeze({
    buttonLabel: "",
    steps: Object.freeze(["当前未发现 Windows 版本"]),
    opensExternal: true
  })
});

function parseHttpsUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_OFFICIAL_DOWNLOAD_URL_LENGTH) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function validateOfficialDownloadAction(
  action,
  productWebsite,
  officialEvidenceUrls = [],
  context = {}
) {
  if (
    !action ||
    typeof action !== "object" ||
    Array.isArray(action) ||
    Object.keys(action).some((field) => !OFFICIAL_DOWNLOAD_FIELDS.has(field)) ||
    !OFFICIAL_DOWNLOAD_KINDS.includes(action.kind)
  ) {
    return "officialDownload metadata rejected";
  }
  const target = parseHttpsUrl(action.url);
  const website = parseHttpsUrl(productWebsite);
  if (!target || !website) return "officialDownload HTTPS URL rejected";
  const reviewedOrigins = new Set([website.origin]);
  const reviewedUrls = new Set([website.href]);
  for (const evidenceUrl of officialEvidenceUrls) {
    const evidence = parseHttpsUrl(evidenceUrl);
    if (evidence) {
      reviewedOrigins.add(evidence.origin);
      reviewedUrls.add(evidence.href);
    }
  }
  const microsoftStoreTarget = target.origin === MICROSOFT_STORE_ORIGIN || (
    action.kind === "store" &&
    target.origin === MICROSOFT_STORE_INSTALLER_ORIGIN &&
    MICROSOFT_STORE_INSTALLER_PATH.test(target.pathname) &&
    !target.search &&
    !target.hash
  );
  if (!reviewedOrigins.has(target.origin) && !microsoftStoreTarget) {
    return "officialDownload origin rejected";
  }
  if (
    action.kind === "stable-redirect" &&
    target.origin !== website.origin &&
    !reviewedUrls.has(target.href)
  ) {
    return "officialDownload origin rejected";
  }
  if (action.kind === "vendor-bootstrap" && (
    !Array.isArray(action.coveredProductIds) ||
    action.coveredProductIds.length === 0 ||
    action.coveredProductIds.length > MAX_COVERED_PRODUCT_IDS ||
    new Set(action.coveredProductIds).size !== action.coveredProductIds.length ||
    action.coveredProductIds.some((id) =>
      typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(id)
    ) ||
    (typeof context.productId === "string" && !action.coveredProductIds.includes(context.productId))
  )) {
    return "officialDownload covered product ids rejected";
  }
  if (action.kind !== "vendor-bootstrap" && action.coveredProductIds !== undefined) {
    return "officialDownload covered product ids rejected";
  }
  if (action.note !== undefined && (
    typeof action.note !== "string" ||
    action.note.length === 0 ||
    action.note.length > MAX_OFFICIAL_DOWNLOAD_NOTE_LENGTH ||
    action.note.trim() !== action.note ||
    /[<>]/.test(action.note)
  )) {
    return "officialDownload note rejected";
  }
  if (action.kind === "no-windows" && context.productType && context.productType !== "web") {
    return "officialDownload no-windows must not remain a desktop product";
  }
  return "";
}

function resolveOfficialDownloadUrl(action, website) {
  return action?.url || website;
}

function officialDownloadPresentation(action) {
  const presentation = OFFICIAL_DOWNLOAD_PRESENTATIONS[action?.kind];
  return presentation ? {
    buttonLabel: presentation.buttonLabel,
    steps: [...presentation.steps],
    opensExternal: presentation.opensExternal
  } : null;
}

function publicOfficialDownloadKinds() {
  return OFFICIAL_DOWNLOAD_KINDS.map((kind) => ({
    kind,
    ...officialDownloadPresentation({ kind })
  }));
}

module.exports = {
  OFFICIAL_DOWNLOAD_FIELDS,
  OFFICIAL_DOWNLOAD_KINDS,
  MAX_COVERED_PRODUCT_IDS,
  MAX_OFFICIAL_DOWNLOAD_NOTE_LENGTH,
  MAX_OFFICIAL_DOWNLOAD_URL_LENGTH,
  MICROSOFT_STORE_ORIGIN,
  officialDownloadPresentation,
  publicOfficialDownloadKinds,
  resolveOfficialDownloadUrl,
  validateOfficialDownloadAction
};
