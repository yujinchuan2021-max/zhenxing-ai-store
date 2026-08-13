"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(
  path.resolve(__dirname, "../src/App.tsx"),
  "utf8"
);
const main = fs.readFileSync(
  path.resolve(__dirname, "../electron/main.cjs"),
  "utf8"
);
const preload = fs.readFileSync(
  path.resolve(__dirname, "../electron/preload.cjs"),
  "utf8"
);
const language = fs.readFileSync(
  path.resolve(__dirname, "../src/language/index.ts"),
  "utf8"
);
const active5Catalog = require(
  "../admin/published/catalog-store/releases/catalog-v00000005-9654219dbedb-3f44cffa.json"
).payload.catalog;
const acquisitionCandidate = JSON.parse(fs.readFileSync(
  path.resolve(
    __dirname,
    "../docs/research/desktop-acquisition-conversion-candidate-draft86-active3-2026-08-05.json"
  ),
  "utf8"
));

test("the product card renders backend entry points without vendor branches", () => {
  const row = app.match(/function ProductRow\([\s\S]*?function AuthModal/)?.[0];
  assert.ok(row);
  assert.match(row, /const entryPoints = behavior\.entryPoints \|\| \[\]/);
  assert.match(row, /entryPoints\.find/);
  assert.match(row, /linkEntries\.map/);
  assert.match(row, /entry\.label/);
  assert.doesNotMatch(row, /chatgpt|claude|yuanbao|doubao/i);
});

test("desktop action copy follows the real client capability", () => {
  const row = app.match(/function ProductRow\([\s\S]*?function AuthModal/)?.[0];
  assert.ok(row);
  assert.match(
    row,
    /behavior\.managedDesktop[\s\S]*?uiText\("download\.oneClick"\)/
  );
  assert.match(
    row,
    /!managedActionsAvailable[\s\S]*?product\.kind === "桌面端"[\s\S]*?uiText\("desktop\.openOfficialDownload"\)/
  );
});

test("desktop-download-only buttons require a validated artifact, not a truthy download object", () => {
  const row = app.match(/function ProductRow\([\s\S]*?function AuthModal/)?.[0];
  assert.ok(row);
  assert.match(row, /behavior\.managedDownload[\s\S]*?uiText\("download\.oneClick"\)/);
  assert.match(row, /product\.productType === "desktop-download-only"[\s\S]*?behavior\.managedDownload/);
});

test("download failures never render a raw main-process TypeError", () => {
  const row = app.match(/function ProductRow\([\s\S]*?function AuthModal/)?.[0];
  assert.ok(row);
  assert.match(
    row,
    /downloadRecoveryPresentation\?\.messageKey[\s\S]*?: runtimeMessage\(error, undefined, "runtime\.downloadInternalError"\)/,
    "failed download cards must use the existing localized runtime-error boundary"
  );
  assert.match(
    row,
    /downloadRecoveryPresentation\.actions\.includes\("retry"\)[\s\S]*?uiText\("download\.retry"\)/,
    "a failed download remains retryable"
  );
  assert.match(
    language,
    /technicalRuntimeError[\s\S]*?Cannot read properties[\s\S]*?return uiText\(key\)/,
    "technical main-process diagnostics must fall back to localized copy"
  );
  assert.match(
    app,
    /function managedDownloadErrorLabel[\s\S]*?runtime\.downloadInternalError/,
    "task-center failures use the same download-specific fallback"
  );
});

test("the Wondershare renderer fixture covers every affected managed download", () => {
  const vendor = active5Catalog.vendors.find((item) => item.id === "wondershare");
  assert.ok(vendor);
  const products = vendor.products.filter((product) => [
    "wondershare-filmora",
    "wondershare-edrawmax",
    "wondershare-edrawmind",
    "wondershare-pdfelement"
  ].includes(product.id));
  assert.deepEqual(products.map((product) => product.id), [
    "wondershare-filmora",
    "wondershare-edrawmax",
    "wondershare-edrawmind",
    "wondershare-pdfelement"
  ]);
  assert.equal(
    products.every((product) =>
      product.productType === "desktop-download-only" && product.download?.artifactKind === "exe"
    ),
    true
  );
});

test("a desktop-download-only product without an artifact opens its official page", () => {
  const handler = app.match(
    /const requestUnifiedInstall =[\s\S]*?const requestLatestDesktopInstaller/
  )?.[0];
  assert.ok(handler);
  assert.match(
    handler,
    /product\.productType === "desktop-download-only" && !product\.download[\s\S]*?window\.open\(product\.website\)/
  );
});

test("officialDownload changes only the official-page button URL and store copy", () => {
  const row = app.match(/function ProductRow\([\s\S]*?function AuthModal/)?.[0];
  assert.ok(row);
  assert.match(row, /resolveOfficialDownloadUrl\(product\.officialDownload, product\.website\)/);
  assert.match(row, /officialDownloadCopy[\s\S]*?uiText\(officialDownloadCopy\.label\)/);
  assert.match(app, /"store":\s*\{\s*label:\s*"desktop\.acquisition\.store"/);
  assert.match(row, /onClick=\{officialPageAction \? openOfficialDownload : onInstallProduct\}/);
  assert.match(row, /managedActionsAvailable/);
});

test("acquisition candidates use fixed external-entry copy without changing managed downloads", () => {
  const row = app.match(/function ProductRow[\s\S]*?function AuthModal/)?.[0];
  assert.ok(row);
  const copyKeys = {
    "vendor-bootstrap": "desktop.acquisition.vendorBootstrap",
    "download-page": "desktop.acquisition.downloadPage",
    "fixed-redirect": "desktop.acquisition.fixedRedirect",
    "stable-redirect": "desktop.acquisition.stableRedirect",
    store: "desktop.acquisition.store",
    "login-required": "desktop.acquisition.loginRequired",
    "manual-selector": "desktop.acquisition.manualSelector",
    "no-windows": "desktop.acquisition.noWindows"
  };
  for (const [kind, key] of Object.entries(copyKeys)) {
    assert.match(app, new RegExp(`"${kind}":\\s*\\{\\s*label:\\s*"${key}"`));
    assert.match(language, new RegExp(`"${key}":`));
  }
  assert.match(row, /const officialDownloadCopy = product\.officialDownload/);
  assert.match(row, /uiText\(officialDownloadCopy\.hint\)/);
  assert.match(row, /const openOfficialDownload = \(\) => window\.open\(officialDownloadUrl\)/);
  assert.match(row, /onClick=\{officialPageAction \? openOfficialDownload : onInstallProduct\}/);
  const adobeBootstrap = acquisitionCandidate.proposedChanges.filter(
    (change) => change.vendorId === "adobe" && change.officialDownload.kind === "vendor-bootstrap"
  );
  assert.deepEqual(
    adobeBootstrap.map((change) => change.productId),
    ["adobe-creative-cloud", "adobe-illustrator", "adobe-lightroom", "adobe-photoshop", "adobe-premiere"]
  );
  assert.deepEqual(
    acquisitionCandidate.proposedChanges
      .filter((change) => change.officialDownload.kind === "no-windows")
      .map((change) => [change.productType, change.moduleId]),
    [["web", "web-link"], ["web", "web-link"]]
  );
  assert.deepEqual(
    acquisitionCandidate.noops.retainedClientManaged,
    ["chatgpt-desktop", "claude-desktop", "comfy-desktop", "letta-agent"]
  );
  assert.match(row, /product\.productType === "desktop-download-only"[\s\S]*?behavior\.managedDownload/);
});

test("CLI products are labeled separately and expose an installed terminal action", () => {
  assert.match(app, /product\.kind === "CLI"[\s\S]*?product\.kind\.cli/);
  assert.match(app, /cliStatus\?\.installed[\s\S]*?onOpenCli/);
  assert.match(app, /product\.openCli/);
});

test("CLI folder and Windows uninstall settings use argument-free IPC", () => {
  assert.match(
    preload,
    /openCliDirectory:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("settings:open-cli-directory"\)/
  );
  assert.match(
    preload,
    /openWindowsUninstallSettings:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("settings:open-windows-uninstall"\)/
  );
  assert.match(
    main,
    /ipcMain\.handle\("settings:open-cli-directory", async \(\) => \{[\s\S]*?readSettings\(\)\.cliInstallDirectory[\s\S]*?path\.isAbsolute[\s\S]*?fs\.realpathSync[\s\S]*?isDirectory\(\)[\s\S]*?shell\.openPath/
  );
  assert.match(
    main,
    /ipcMain\.handle\("settings:open-windows-uninstall", async \(\) => \{[\s\S]*?ms-settings:appsfeatures/
  );
});
