"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  desktopDownloadOnlyProductIds,
  buildDesktopDownloadOnlyPlan,
  buildSignedDesktopDownloadPlan,
  getDesktopDownloadOnlyProfile,
  publicDesktopDownloadOnlyProfiles,
  SIGNED_CATALOG_MODULE_ID,
  SIGNED_CATALOG_PROFILE_ID,
  validateSignedDesktopDownloadArtifact,
  validateDesktopDownloadOnlyArtifact,
  desktopDownloadOnlyArtifactFromReceipt,
  signedDesktopDownloadArtifactFromReceipt
} = require("../shared/desktop-download-only.cjs");
const { isAllowedManagedDownloadUrl } = require("../shared/managed-downloads.cjs");
const { applyProductModule } = require("../shared/product-modules.cjs");
const {
  evaluateFreshDesktopDownloadOnlyAuthorization
} = require("../shared/managed-catalog-install-authorization.cjs");
const { resolveProductBehavior, validateProductPolicy } = require("../shared/product-policy.cjs");
const main = fs.readFileSync(path.resolve(__dirname, "../electron/main.cjs"), "utf8");
const adminApp = fs.readFileSync(path.resolve(__dirname, "../admin/public/app.js"), "utf8");
const active5Catalog = require("../admin/published/catalog-store/releases/catalog-v00000005-9654219dbedb-3f44cffa.json").payload.catalog;

function functionSource(name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(main);
  assert.ok(match, `missing ${name}`);
  const params = main.indexOf("(", match.index);
  let parameterDepth = 0;
  let open = -1;
  for (let index = params; index < main.length; index += 1) {
    if (main[index] === "(") parameterDepth += 1;
    if (main[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      open = main.indexOf("{", index);
      break;
    }
  }
  assert.ok(open >= 0, `missing body for ${name}`);
  let depth = 0;
  for (let index = open; index < main.length; index += 1) {
    if (main[index] === "{") depth += 1;
    if (main[index] === "}") depth -= 1;
    if (depth === 0) return main.slice(match.index, index + 1);
  }
  assert.fail(`unterminated ${name}`);
}

test("desktop-download-only profiles constrain dynamic official artifacts", () => {
  assert.equal(desktopDownloadOnlyProductIds.length, 14);
  assert.equal(new Set(desktopDownloadOnlyProductIds).size, 14);
  const profile = getDesktopDownloadOnlyProfile("docker-desktop");
  assert.deepEqual(profile.allowedDomains, ["desktop.docker.com"]);
  assert.equal(validateDesktopDownloadOnlyArtifact("docker-desktop", {
    url: "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe",
    fileName: "Docker Desktop Installer.exe", artifactKind: "exe"
  }).ok, true);
  for (const artifact of [
    { url: "http://desktop.docker.com/a.exe", fileName: "a.exe", artifactKind: "exe" },
    { url: "https://user:secret@desktop.docker.com/a.exe", fileName: "a.exe", artifactKind: "exe" },
    { url: "https://evil.example/a.exe", fileName: "a.exe", artifactKind: "exe" },
    { url: "https://desktop.docker.com/a.exe", fileName: "a.zip", artifactKind: "exe" },
    { url: "https://desktop.docker.com/a.exe", fileName: "a.exe", artifactKind: "exe", command: "x" }
  ]) assert.equal(validateDesktopDownloadOnlyArtifact("docker-desktop", artifact).ok, false);
  assert.equal(getDesktopDownloadOnlyProfile("coreldraw-graphics-suite"), null);
  assert.equal(getDesktopDownloadOnlyProfile("tana-outliner"), null);
  assert.deepEqual(getDesktopDownloadOnlyProfile("audacity-desktop").allowedDomains, ["github.com", "release-assets.githubusercontent.com"]);
  assert.deepEqual(getDesktopDownloadOnlyProfile("craft-desktop").allowedDomains, ["www.craft.do", "luki-prod-us-east-1-web.s3.us-east-1.amazonaws.com"]);
  const product = applyProductModule({
    id: "docker-desktop", name: "Docker Desktop", category: "x", description: "x",
    website: "https://www.docker.com/", tutorial: "https://docs.docker.com/",
    installProfileId: profile.profileId,
    download: { url: "https://desktop.docker.com/a.exe", fileName: "a.exe", artifactKind: "exe" }
  }, "desktop-download-only");
  assert.equal(validateProductPolicy(product, "docker"), "");
  const behavior = resolveProductBehavior(product);
  assert.equal(behavior.primaryLabel, "一键下载");
  assert.equal(behavior.canOpenInstalled, false);
  assert.equal(behavior.canUninstall, false);
});

for (const productId of [
  "wondershare-filmora",
  "wondershare-edrawmax",
  "wondershare-edrawmind",
  "wondershare-pdfelement"
]) {
  test(`active5 ${productId} normalizes receipt sources for first download and reinstall`, () => {
    const product = active5Catalog.vendors
      .flatMap((vendor) => vendor.products || [])
      .find((candidate) => candidate.id === productId);
    assert.ok(product, `${productId} must exist in active5`);

    const authorization = evaluateFreshDesktopDownloadOnlyAuthorization({
      catalogResult: {
        source: "remote",
        catalogVersion: 5,
        catalog: active5Catalog
      },
      productId,
      artifact: product.download
    });
    assert.equal(authorization.ok, true, productId);
    assert.deepEqual(
      authorization.plan.sources.map((source) => source.url),
      [product.download.url],
      `${productId} must serialize the same approved source on first download and reinstall`
    );
    assert.deepEqual(
      authorization.plan.sources.slice(1).map((source) => source.url),
      [],
      `${productId} has no approved mirrors`
    );
  });
}

test("signed catalog desktop downloads accept only pure HTTPS artifacts", () => {
  const artifact = {
    url: "https://assets.tana.inc/desktop/Tana-Setup-windows.exe",
    fileName: "Tana-Setup-2026.29.20+c0082d7-windows.exe",
    artifactKind: "exe",
    mirrors: ["https://mirror.example/Tana-Setup-windows.exe"]
  };
  const accepted = validateSignedDesktopDownloadArtifact(artifact);
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.artifact, artifact);
  const plan = buildSignedDesktopDownloadPlan("tana-outliner", artifact);
  assert.deepEqual(plan.sources.map((source) => source.url), [artifact.url, ...artifact.mirrors]);
  assert.equal(plan.signedCatalogDownload, true, "canonical plans must persist as signed receipts for lifecycle recovery");
  assert.equal(SIGNED_CATALOG_PROFILE_ID, "desktop-download-only.signed-catalog");
  for (const invalid of [
    { ...artifact, url: "http://assets.tana.inc/Tana-Setup-windows.exe" },
    { ...artifact, url: "https://user:secret@assets.tana.inc/Tana-Setup-windows.exe" },
    { ...artifact, fileName: "folder/Tana-Setup-windows.exe" },
    { ...artifact, artifactKind: "zip" },
    { ...artifact, mirrors: ["http://mirror.example/Tana-Setup-windows.exe"] },
    { ...artifact, mirrors: Array.from({ length: 5 }, (_, index) => `https://mirror${index}.example/Tana-Setup-windows.exe`) },
    { ...artifact, mirrors: [artifact.url] },
    { ...artifact, command: "run" }
  ]) {
    assert.equal(validateSignedDesktopDownloadArtifact(invalid).ok, false);
  }
  const product = applyProductModule({
    id: "tana-outliner", name: "Tana", category: "x", description: "x",
    website: "https://tana.inc/", tutorial: "https://help.tana.inc/",
    installProfileId: SIGNED_CATALOG_PROFILE_ID,
    download: artifact
  }, SIGNED_CATALOG_MODULE_ID);
  assert.equal(validateProductPolicy(product, "tana"), "");
  assert.equal(resolveProductBehavior(product).primaryLabel, "一键下载");
  assert.match(functionSource("nextManagedDownloadPlan"), /plan\.downloadPolicy === "desktop-download-only"/);
});

test("the current signed catalog policy wins when a legacy package-manager id migrates", () => {
  const legacyMsty = {
    id: "msty-studio",
    enabled: true,
    order: 1,
    directoryKind: "ai-tool",
    name: "Msty Studio",
    kind: "桌面端",
    category: "x",
    description: "x",
    website: "https://msty.ai/products/studio/",
    tutorial: "https://docs.msty.ai/",
    productType: "desktop-official",
    moduleId: "desktop-official",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    capabilities: ["website", "tutorial"]
  };
  const official = resolveProductBehavior(legacyMsty);
  assert.equal(official.installMode, "official-installer-page");
  assert.equal(official.managedDesktop, false);
  assert.equal(official.canInstall, false);
  assert.equal(official.canOpenInstalled, false);
  assert.equal(official.canUninstall, false);

  const migrated = applyProductModule({
    ...legacyMsty,
    download: {
      url: "https://next-assets.msty.studio/app/latest/win/MstyStudio_x64.exe",
      fileName: "MstyStudio_x64.exe",
      artifactKind: "exe"
    }
  }, SIGNED_CATALOG_MODULE_ID);
  assert.equal(validateProductPolicy(migrated, "msty"), "");
  const behavior = resolveProductBehavior(migrated);
  assert.equal(behavior.installMode, "managed-download-only");
  assert.equal(behavior.managedDesktop, true);
  assert.equal(behavior.managedDownload, true);
  assert.equal(behavior.canOpenInstalled, false);
  assert.equal(behavior.canUninstall, false);
});

test("admin exposes only the signed download metadata contract", () => {
  assert.equal(publicDesktopDownloadOnlyProfiles().length, 14);
  for (const field of ["url", "fileName", "artifactKind", "mirrors"]) {
    assert.match(adminApp, new RegExp(`data-signed-download=\\"${field}\\"`));
  }
  assert.match(adminApp, /desktop-download-only\.signed-catalog|catalogProfileId/);
  for (const forbidden of ["command", "args", "env", "script", "headers", "credentials"]) {
    assert.doesNotMatch(adminApp, new RegExp(`data-signed-download=\\"${forbidden}\\"`));
  }
});

test("a validated artifact survives product-id-only task lifecycle lookups", () => {
  const artifact = {
    url: "https://appdownload.deepl.com/windows/0install/DeepLSetup.exe",
    fileName: "DeepLSetup.exe",
    artifactKind: "exe"
  };
  const receipt = {
    productId: "deepl-desktop",
    attemptId: "attempt-1",
    ...artifact,
    targetPath: "C:\\Downloads\\DeepLSetup.exe",
    command: "must-not-be-used"
  };

  for (const state of ["starting", "get", "cancel", "retry", "reconcile"]) {
    const recovered = desktopDownloadOnlyArtifactFromReceipt(
      "deepl-desktop",
      receipt
    );
    assert.deepEqual(recovered, artifact, `${state} must recover the same approved artifact`);
    assert.equal(validateDesktopDownloadOnlyArtifact("deepl-desktop", recovered).ok, true);
  }
  assert.equal(
    desktopDownloadOnlyArtifactFromReceipt("deepl-desktop", { ...receipt, artifactKind: "zip" }),
    null,
    "a mismatched persisted kind must not be reused"
  );
});

test("a signed catalog artifact survives only as a marked pure receipt", () => {
  const receipt = {
    signedCatalogDownload: true,
    url: "https://assets.tana.inc/desktop/Tana-Setup-windows.exe",
    fileName: "Tana-Setup-2026.29.20+c0082d7-windows.exe",
    artifactKind: "exe",
    mirrors: ["https://mirror.tana.inc/Tana-Setup-windows.exe"],
    targetPath: "C:\\Downloads\\Tana-Setup-2026.29.20+c0082d7-windows.exe",
    command: "must-not-be-used"
  };
  assert.deepEqual(signedDesktopDownloadArtifactFromReceipt(receipt), {
    url: receipt.url,
    fileName: receipt.fileName,
    artifactKind: receipt.artifactKind,
    mirrors: receipt.mirrors
  });
  assert.equal(signedDesktopDownloadArtifactFromReceipt({ ...receipt, signedCatalogDownload: false }), null);
  assert.equal(signedDesktopDownloadArtifactFromReceipt({ ...receipt, artifactKind: "zip" }), null);
});

test("main persists the approved artifact before product-id-only lifecycle calls", () => {
  const resolve = functionSource("resolveManagedDownloadPlan");
  const begin = functionSource("beginManagedDownloadAttempt");
  const reconcile = functionSource("reconcileManagedDownloadTask");
  const discard = functionSource("discardManagedDownload");

  assert.match(resolve, /desktopDownloadOnlyArtifactFromReceipt\(\s*productId,\s*readPartialDownloadRecords\(\)\[productId\]/);
  assert.match(resolve, /desktopDownloadOnlyArtifactFromReceipt\(\s*productId,\s*readDownloadRecords\(\)\[productId\]/);
  assert.match(resolve, /signedDesktopDownloadPlans\.get\(productId\)/);
  assert.match(resolve, /signedDesktopDownloadArtifactFromReceipt\(readPartialDownloadRecords\(\)\[productId\]\)/);
  assert.match(begin, /artifactKind:\s*plan\.artifactKind/);
  assert.match(begin, /fileName:\s*plan\.fileName/);
  assert.match(begin, /signedCatalogDownload:\s*plan\.signedCatalogDownload === true/);
  assert.match(begin, /plan\.sources\.slice\(1\)\.map\(\(source\) => source\.url\)/);
  assert.match(reconcile, /resolveManagedDownloadPlan\(productId\)/);
  assert.match(discard, /resolveManagedDownloadPlan\(productId\)/);
  assert.match(main, /ipcMain\.handle\("download:get-task"[\s\S]*?reconcileManagedDownloadTask\(productId\)/);
  assert.match(main, /installer:launch[\s\S]*?authorizeCurrentDesktopDownloadOnlyProduct\(productId/);
});

test("download-only plans use their fixed profile gate instead of legacy managed downloads", () => {
  for (const productId of desktopDownloadOnlyProductIds) {
    const profile = getDesktopDownloadOnlyProfile(productId);
    const artifact = {
      url: `https://${profile.allowedDomains[0]}/approved.exe`,
      fileName: "approved.exe",
      artifactKind: "exe"
    };
    const plan = buildDesktopDownloadOnlyPlan(productId, artifact);
    assert.ok(plan, `${productId} accepts an approved profile host`);
    assert.deepEqual(plan.allowedHosts, profile.allowedDomains);
    assert.equal(isAllowedManagedDownloadUrl(productId, artifact.url), false);
    assert.equal(
      buildDesktopDownloadOnlyPlan(productId, {
        ...artifact,
        url: "https://unapproved.example/approved.exe"
      }),
      null,
      `${productId} rejects a non-approved host`
    );
    assert.equal(
      buildDesktopDownloadOnlyPlan(productId, { ...artifact, command: "run" }),
      null,
      `${productId} rejects frontend execution fields`
    );
  }

  const begin = functionSource("beginManagedDownloadAttempt");
  assert.match(begin, /const desktopDownloadOnly = plan\.downloadPolicy === "desktop-download-only"/);
  assert.match(begin, /managedProductId:\s*desktopDownloadOnly\s*\?\s*undefined\s*:\s*plan\.managedProductId/);
  assert.match(begin, /allowedFinalHosts:\s*desktopDownloadOnly\s*\|\|\s*plan\.environmentId\s*\?\s*plan\.allowedHosts\s*:\s*undefined/);
});
