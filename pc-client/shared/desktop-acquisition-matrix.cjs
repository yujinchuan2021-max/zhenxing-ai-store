"use strict";

const { OFFICIAL_DOWNLOAD_KINDS } = require("./official-download-page.cjs");
const { validateSignedDesktopDownloadArtifact } = require("./desktop-download-only.cjs");

const DESKTOP_PRODUCT_TYPES = new Set([
  "desktop-reviewed",
  "desktop-official",
  "desktop-download-only"
]);
const MATRIX_KINDS = new Set(["direct-artifact", ...OFFICIAL_DOWNLOAD_KINDS]);
const EXECUTION_FIELDS = new Set([
  "command", "args", "env", "script", "headers", "credentials",
  "officialInstallCommand", "scriptUrl"
]);

function catalogAcquisitionKind(product) {
  if (product?.download) return "direct-artifact";
  return product?.officialDownload?.kind || "";
}

function catalogAcquisitionUrl(product) {
  return product?.download?.url || product?.officialDownload?.url || "";
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function sameIds(left, right) {
  return Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((id) => right.includes(id));
}

function candidateUrl(row, kind) {
  if (kind === "direct-artifact") return row?.downloadUrl || row?.acquisitionUrl || row?.url || "";
  if (kind === "store") return row?.storeUrl || row?.acquisitionUrl || row?.url || row?.pageUrl || row?.evidenceUrl || "";
  if (kind === "stable-redirect") return row?.downloadUrl || row?.acquisitionUrl || row?.url || row?.pageUrl || row?.evidenceUrl || "";
  return row?.acquisitionUrl || row?.url || row?.pageUrl || row?.evidenceUrl || "";
}

function normalizeEvidenceRows(input) {
  const rows = Array.isArray(input) ? input : input?.rows || input?.records || [];
  return rows.map((row) => {
    const kind = row?.kind || row?.recommendedStrategy;
    return row?.kind ? row : {
      ...row,
      kind,
      url: candidateUrl(row, kind),
      preserveExistingArtifact: kind === "direct-artifact" &&
        row?.researchStatus === "identity-no-change" &&
        typeof row?.moduleCompatibility === "string" &&
        row.moduleCompatibility.includes("existing direct/")
    };
  });
}

function auditDesktopAcquisitionMatrix(products, evidenceRows, options = {}) {
  const productsById = new Map(
    (Array.isArray(products) ? products : [])
      .filter((product) => DESKTOP_PRODUCT_TYPES.has(product?.productType) ||
        (product?.productType === "web" && product?.officialDownload?.kind === "no-windows"))
      .map((product) => [product.id, product])
  );
  const seen = new Set();
  const findings = [];
  for (const row of normalizeEvidenceRows(evidenceRows)) {
    if (seen.has(row?.productId)) {
      findings.push({ productId: row?.productId || "", reason: "duplicate evidence" });
      continue;
    }
    seen.add(row?.productId);
    const product = productsById.get(row?.productId);
    if (!product) {
      findings.push({ productId: row?.productId || "", reason: "product is not a desktop acquisition" });
      continue;
    }
    if (Object.keys(row || {}).some((key) => EXECUTION_FIELDS.has(key))) {
      findings.push({ productId: row.productId, reason: "candidate contains execution fields" });
      continue;
    }
    if (!MATRIX_KINDS.has(row?.kind)) {
      findings.push({ productId: row.productId, reason: "acquisition kind is invalid" });
      continue;
    }
    if (!isHttpsUrl(row.url)) {
      findings.push({ productId: row.productId, reason: "acquisition URL is invalid" });
      continue;
    }
    if (row.kind === "direct-artifact" && !row.preserveExistingArtifact && !validateSignedDesktopDownloadArtifact({
      url: row.url,
      fileName: row.fileName,
      artifactKind: row.artifactKind,
      ...(row.mirrors === undefined ? {} : { mirrors: row.mirrors })
    }).ok) {
      findings.push({ productId: row.productId, reason: "direct artifact is incomplete or unsafe" });
      continue;
    }
    if (row.kind === "vendor-bootstrap" && Array.isArray(row.coveredProductIds) &&
      !row.coveredProductIds.includes(row.productId)) {
      findings.push({ productId: row.productId, reason: "vendor bootstrap coverage is invalid" });
      continue;
    }
    const actual = catalogAcquisitionKind(product);
    if (actual !== row.kind) {
      findings.push({ productId: row.productId, actual, expected: row.kind });
    } else if (!row.preserveExistingArtifact && catalogAcquisitionUrl(product) !== row.url) {
      findings.push({ productId: row.productId, actualUrl: catalogAcquisitionUrl(product), expectedUrl: row.url });
    } else if (row.kind === "vendor-bootstrap" &&
      (Array.isArray(row.coveredProductIds)
        ? !sameIds(product.officialDownload?.coveredProductIds, row.coveredProductIds)
        : !product.officialDownload?.coveredProductIds?.includes(row.productId))) {
      findings.push({ productId: row.productId, reason: "vendor bootstrap coverage differs" });
    }
  }
  if (options.requireComplete === true) {
    for (const productId of productsById.keys()) {
      if (!seen.has(productId)) findings.push({ productId, reason: "missing evidence" });
    }
  }
  return findings;
}

module.exports = {
  auditDesktopAcquisitionMatrix,
  catalogAcquisitionKind,
  catalogAcquisitionUrl,
  normalizeEvidenceRows,
  sameIds
};
