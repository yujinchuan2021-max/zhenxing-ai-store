"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,127}$/;
const PACKAGE_EXTENSION = /\.(exe|msi|msix|zip)$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const REVIEWED_LOCAL_PACKAGE_SIGNERS = Object.freeze({
  "canva-windows": /^CN=Canva(?:,|$)/i,
  "nous-hermes-desktop": /^CN=Nous Research Inc\.(?:,|$)/i
});

function reviewedManagedPackagePlan(productId, plan) {
  if (!plan || typeof plan !== "object" || plan.productId && plan.productId !== productId) {
    return null;
  }
  const expectedSigner = plan.expectedSigner instanceof RegExp
    ? plan.expectedSigner
    : REVIEWED_LOCAL_PACKAGE_SIGNERS[productId];
  return expectedSigner
    ? { ...plan, productId, expectedSigner }
    : null;
}

function numberedPackageSuffix(actualName, expectedName) {
  const expected = path.parse(expectedName);
  const actual = path.parse(actualName);
  if (actual.ext.toLowerCase() !== expected.ext.toLowerCase()) return null;
  if (actual.name.toLowerCase() === expected.name.toLowerCase()) return 0;
  const match = actual.name.match(new RegExp(
    `^${expected.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\((\\d+)\\)$`,
    "i"
  ));
  return match ? Number(match[1]) : null;
}

function validPlan(plan) {
  return Boolean(
    plan &&
      typeof plan === "object" &&
      !Array.isArray(plan) &&
      PRODUCT_ID.test(plan.productId || "") &&
      typeof plan.fileName === "string" &&
      plan.fileName === path.basename(plan.fileName) &&
      PACKAGE_EXTENSION.test(plan.fileName) &&
      typeof plan.url === "string" &&
      /^https:\/\//i.test(plan.url) &&
      plan.expectedSigner instanceof RegExp &&
      (!plan.expectedSha256 || SHA256.test(plan.expectedSha256))
  );
}

async function discoverManagedPackages(options) {
  const {
    downloadRoot,
    plans,
    inspectSignature,
    hashFile,
    now = () => new Date().toISOString()
  } = options || {};
  if (
    typeof downloadRoot !== "string" ||
    !path.isAbsolute(downloadRoot) ||
    !Array.isArray(plans) ||
    plans.length > 128 ||
    typeof inspectSignature !== "function" ||
    typeof hashFile !== "function"
  ) {
    throw new TypeError("Managed package discovery input is invalid");
  }
  const productIds = new Set();
  for (const plan of plans) {
    if (!validPlan(plan) || productIds.has(plan.productId)) {
      throw new TypeError("Managed package discovery plan is invalid");
    }
    productIds.add(plan.productId);
  }

  const rootStat = fs.lstatSync(downloadRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Managed package download directory is not trusted");
  }
  const canonicalRoot = path.resolve(fs.realpathSync.native(downloadRoot));
  const entries = fs.readdirSync(canonicalRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
    .map((entry) => entry.name);
  const records = [];

  for (const plan of plans) {
    const match = entries
      .map((name) => ({ name, suffix: numberedPackageSuffix(name, plan.fileName) }))
      .filter((entry) => entry.suffix !== null)
      .sort((left, right) => left.suffix - right.suffix || left.name.localeCompare(right.name))[0];
    if (!match) continue;

    const candidatePath = path.join(canonicalRoot, match.name);
    const stat = fs.lstatSync(candidatePath);
    const canonicalPath = fs.realpathSync.native(candidatePath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      !Number.isSafeInteger(stat.size) ||
      stat.size <= 0 ||
      path.dirname(canonicalPath).toLowerCase() !== canonicalRoot.toLowerCase()
    ) {
      continue;
    }
    const signature = await inspectSignature(canonicalPath);
    plan.expectedSigner.lastIndex = 0;
    if (
      signature?.status !== "Valid" ||
      !plan.expectedSigner.test(String(signature.signer || ""))
    ) {
      continue;
    }
    const sha256 = String(await hashFile(canonicalPath)).toLowerCase();
    if (!SHA256.test(sha256) || (plan.expectedSha256 && sha256 !== plan.expectedSha256.toLowerCase())) {
      continue;
    }
    const timestamp = now();
    records.push({
      productId: plan.productId,
      filePath: canonicalPath,
      downloadRoot: canonicalRoot,
      sha256,
      fileSize: stat.size,
      resumedFrom: 0,
      downloadedAt: timestamp,
      discoveredAt: timestamp,
      url: plan.url,
      fileName: plan.fileName,
      artifactKind: plan.artifactKind || path.extname(plan.fileName).slice(1).toLowerCase(),
      downloadPolicy: plan.downloadPolicy || "",
      signedCatalogDownload: plan.signedCatalogDownload === true,
      mirrors: plan.signedCatalogDownload
        ? (Array.isArray(plan.sources) ? plan.sources.slice(1).map((source) => source.url) : [])
        : undefined,
      source: "本地已验证安装包"
    });
  }
  return records;
}

module.exports = {
  discoverManagedPackages,
  reviewedManagedPackagePlan
};
