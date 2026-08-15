"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  OFFICIAL_DOWNLOAD_KINDS,
  resolveOfficialDownloadUrl,
  validateOfficialDownloadAction
} = require("../shared/official-download-page.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const { validateProductPolicy } = require("../shared/product-policy.cjs");
const { applyProductModule } = require("../shared/product-modules.cjs");
const {
  getApprovedOfficialDownloadSources
} = require("../shared/official-download-approvals.cjs");

const adminApp = fs.readFileSync(
  path.join(__dirname, "..", "admin", "public", "app.js"),
  "utf8"
);

function catalogFixture() {
  return JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "admin", "data", "catalog-v1.json"),
      "utf8"
    )
  );
}

test("official download actions accept reviewed HTTPS page, redirect, and store entries", () => {
  assert.deepEqual([...OFFICIAL_DOWNLOAD_KINDS], [
    "vendor-bootstrap",
    "download-page",
    "fixed-redirect",
    "stable-redirect",
    "store",
    "login-required",
    "manual-selector",
    "no-windows"
  ]);
  assert.equal(
    validateOfficialDownloadAction(
      { url: "https://vendor.example/download/windows", kind: "download-page" },
      "https://vendor.example/product"
    ),
    ""
  );
  assert.equal(
    validateOfficialDownloadAction(
      { url: "https://vendor.example/download/latest", kind: "fixed-redirect" },
      "https://vendor.example/product"
    ),
    ""
  );
  assert.equal(
    validateOfficialDownloadAction(
      { url: "https://downloads.vendor.example/windows", kind: "fixed-redirect" },
      "https://vendor.example/product",
      ["https://downloads.vendor.example/evidence"]
    ),
    ""
  );
  assert.equal(
    validateOfficialDownloadAction(
      { url: "https://vendor.example/store", kind: "store" },
      "https://vendor.example/product"
    ),
    ""
  );
});

test("official download actions reject unsafe fields and unreviewed origins", () => {
  for (const action of [
    { url: "http://vendor.example/download", kind: "download-page" },
    { url: "https://user:secret@vendor.example/download", kind: "download-page" },
    { url: "https://other.example/download", kind: "download-page" },
    { url: "https://other.example/download", kind: "fixed-redirect" },
    { url: "https://vendor.example/download", kind: "unknown" },
    { url: "https://example.com/", kind: "store", extra: true },
    { url: "https://example.com/", kind: "store" }
  ]) {
    assert.notEqual(
      validateOfficialDownloadAction(action, "https://vendor.example/product"),
      "",
      JSON.stringify(action)
    );
  }
});

test("Store entries allow only the audited Microsoft installer redirect shape", () => {
  assert.equal(
    validateOfficialDownloadAction(
      { kind: "store", url: "https://get.microsoft.com/installer/download/9PFXXSHC64H3" },
      "https://vendor.example/product"
    ),
    ""
  );
  for (const url of [
    "https://get.microsoft.com/installer/download/9PFXXSHC64H3?source=vendor",
    "https://get.microsoft.com/installer/download/9PFXXSHC64H3#store",
    "https://get.microsoft.com/installer/download/too-short",
    "https://get.microsoft.com/other/download/9PFXXSHC64H3"
  ]) {
    assert.notEqual(
      validateOfficialDownloadAction({ kind: "store", url }, "https://vendor.example/product"),
      "",
      url
    );
  }
});

test("missing official download action falls back to the product website", () => {
  assert.equal(
    resolveOfficialDownloadUrl(
      undefined,
      "https://vendor.example/product"
    ),
    "https://vendor.example/product"
  );
  assert.equal(
    resolveOfficialDownloadUrl(
      { url: "https://vendor.example/download", kind: "download-page" },
      "https://vendor.example/product"
    ),
    "https://vendor.example/download"
  );
});

test("catalog accepts official page metadata but rejects direct-download conflicts", () => {
  const catalog = catalogFixture();
  const product = catalog.vendors
    .flatMap((vendor) => vendor.products)
    .find((candidate) => candidate.productType === "desktop-official");
  assert.ok(product);
  product.officialDownload = {
    url: new URL("/download/windows", product.website).toString(),
    kind: "download-page"
  };
  assert.doesNotThrow(() => validateCatalog(catalog));

  product.download = {
    url: "https://downloads.example/installer.exe",
    fileName: "installer.exe",
    artifactKind: "exe"
  };
  assert.throws(() => validateCatalog(catalog), /officialDownload|下载入口|冲突/);
});

test("Quark stable redirect is accepted only through its fixed reviewed download source", () => {
  const catalog = require("../admin/published/catalog-store/releases/catalog-v00000005-9654219dbedb-3f44cffa.json").payload.catalog;
  const vendor = catalog.vendors.find((candidate) => candidate.id === "alibaba");
  const current = vendor.products.find(
    (product) => product.id === "alibaba-quark-ai-browser"
  );
  const { download, ...withoutDirectDownload } = current;
  const product = applyProductModule(
    withoutDirectDownload,
    "desktop-official"
  );
  product.officialDownload = {
    url: "https://download.quark.cn/download/quarkpc?ch=pcquark@default",
    kind: "stable-redirect"
  };
  assert.equal(validateProductPolicy(product, vendor.id), "");
  assert.equal(
    validateOfficialDownloadAction(
      { ...product.officialDownload, url: "https://evil.quark.cn/download/quarkpc" },
      product.website,
      ["https://download.quark.cn/download/quarkpc?ch=pcquark@default"],
      { productId: product.id, productType: product.productType }
    ),
    "officialDownload origin rejected"
  );
});

test("three reviewed stable redirects require their exact approved endpoint", () => {
  const catalog = require("../admin/published/catalog-store/releases/catalog-v00000005-9654219dbedb-3f44cffa.json").payload.catalog;
  const cases = [
    [
      "fireflies-desktop",
      "https://m.fireflies.ai/desktop/releases/download?platform=windows",
      "https://m.fireflies.ai/desktop/releases/download?platform=mac"
    ],
    [
      "pieces-for-developers",
      "https://builds.pieces.app/stages/production/pieces_for_x/windows-exe/download?download=true&product=DOCUMENTATION_WEBSITE",
      "https://builds.pieces.app/stages/production/pieces_for_x/windows-exe/download?download=true&product=OTHER"
    ],
    [
      "zoom-workplace",
      "https://zoom.us/client/latest/ZoomInstaller.exe?archType=x64",
      "https://zoom.us/client/latest/ZoomInstaller.exe?archType=arm64"
    ]
  ];
  for (const [productId, url, unapprovedUrl] of cases) {
    const vendor = catalog.vendors.find((candidate) =>
      candidate.products.some((product) => product.id === productId)
    );
    const current = vendor.products.find((product) => product.id === productId);
    const { download, officialDownload, ...withoutAcquisition } = current;
    const product = applyProductModule(withoutAcquisition, "desktop-official");
    product.officialDownload = { url, kind: "stable-redirect" };
    const sources = getApprovedOfficialDownloadSources(productId);
    assert.deepEqual(sources, [url]);
    assert.equal(validateProductPolicy(product, vendor.id), "", productId);
    assert.equal(
      validateOfficialDownloadAction(
        { ...product.officialDownload, url: unapprovedUrl },
        product.website,
        sources,
        { productId, productType: product.productType }
      ),
      "officialDownload origin rejected",
      productId
    );
  }
});

test("admin exposes only URL and kind with an open-only preview", () => {
  assert.match(adminApp, /data-official-download="url"/);
  assert.match(adminApp, /data-official-download="kind"/);
  assert.match(adminApp, /data-official-download="coveredProductIds"/);
  assert.match(adminApp, /data-official-download="note"/);
  assert.match(adminApp, /仅打开官方入口/);
  for (const forbidden of ["command", "args", "env", "headers", "credentials"]) {
    assert.doesNotMatch(adminApp, new RegExp(`data-official-download=\\"${forbidden}\\"`));
  }
});
