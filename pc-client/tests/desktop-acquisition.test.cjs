"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  OFFICIAL_DOWNLOAD_KINDS,
  officialDownloadPresentation,
  validateOfficialDownloadAction
} = require("../shared/official-download-page.cjs");
const { applyProductModule } = require("../shared/product-modules.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");

const adminServer = fs.readFileSync(
  path.join(__dirname, "..", "admin", "server.cjs"),
  "utf8"
);

test("desktop acquisition kinds have fixed presentation rather than catalog-provided labels", () => {
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
  assert.deepEqual(
    officialDownloadPresentation({ kind: "login-required", url: "https://vendor.example/download" }),
    {
      buttonLabel: "登录后前往下载",
      steps: ["在厂商官网登录", "按厂商页面流程下载 Windows 版本"],
      opensExternal: true
    }
  );
  assert.equal(
    officialDownloadPresentation({ kind: "no-windows", url: "https://vendor.example/" }).buttonLabel,
    ""
  );
});

test("admin receives the same fixed acquisition-kind metadata as the validator", () => {
  assert.match(adminServer, /officialDownloadKinds: publicOfficialDownloadKinds\(\)/);
});

test("draft86 acquisition candidate contains only display metadata and preserves blocked/no-op decisions", () => {
  const candidate = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "docs",
      "research",
      "desktop-acquisition-conversion-candidate-draft86-active3-2026-08-05.json"
    ),
    "utf8"
  ));
  assert.deepEqual(candidate.validation, {
    validateCatalog: true,
    validatePublication: true
  });
  assert.equal(candidate.expected.proposedChangeCount, 117);
  assert.equal(candidate.noops.retainedManagedOrDirect.length, 87);
  assert.deepEqual(candidate.rejectedArtifacts, [{
    productId: "navicat-premium",
    url: "https://www.navicat.com/download/support-download?product=navicat17_premium_en_x64.exe",
    fileName: "support-download",
    artifactKind: "exe",
    reason: "rejected evidence only: fileName does not match artifactKind; not written to catalog"
  }]);
  for (const change of candidate.proposedChanges) {
    assert.ok(OFFICIAL_DOWNLOAD_KINDS.includes(change.officialDownload.kind));
    assert.equal(new URL(change.officialDownload.url).protocol, "https:");
    for (const forbidden of ["command", "args", "env", "headers", "credentials", "script", "label"]) {
      assert.equal(Object.hasOwn(change.officialDownload, forbidden), false);
    }
  }
});

test("display-only acquisition accepts only reviewed HTTPS metadata and bounded plain annotations", () => {
  const valid = {
    kind: "vendor-bootstrap",
    url: "https://vendor.example/download",
    coveredProductIds: ["vendor-suite", "vendor-editor"],
    note: "在厂商安装器中选择产品"
  };
  assert.equal(
    validateOfficialDownloadAction(valid, "https://vendor.example/product"),
    ""
  );
  assert.equal(
    validateOfficialDownloadAction(
      { kind: "store", url: "https://vendor.example/store" },
      "https://vendor.example/product"
    ),
    ""
  );
  for (const invalid of [
    { ...valid, label: "任意按钮" },
    { ...valid, command: "cmd.exe" },
    { ...valid, coveredProductIds: ["bad id"] },
    { ...valid, note: "<b>HTML</b>" },
    { ...valid, url: "https://other.example/download" }
  ]) {
    assert.notEqual(
      validateOfficialDownloadAction(invalid, "https://vendor.example/product"),
      "",
      JSON.stringify(invalid)
    );
  }
});

test("vendor bootstrap must name a non-empty coverage set that includes the selected product", () => {
  const bootstrap = {
    kind: "vendor-bootstrap",
    url: "https://vendor.example/download",
    coveredProductIds: ["vendor-suite", "vendor-editor"]
  };
  assert.equal(
    validateOfficialDownloadAction(bootstrap, "https://vendor.example/product", [], {
      productType: "desktop-official", productId: "vendor-editor"
    }),
    ""
  );
  for (const invalid of [
    { kind: "vendor-bootstrap", url: bootstrap.url },
    { ...bootstrap, coveredProductIds: ["vendor-suite"] }
  ]) {
    assert.notEqual(
      validateOfficialDownloadAction(invalid, "https://vendor.example/product", [], {
        productType: "desktop-official", productId: "vendor-editor"
      }),
      ""
    );
  }
});

test("no-windows is informational and cannot remain on a Windows desktop product", () => {
  assert.notEqual(
    validateOfficialDownloadAction(
      { kind: "no-windows", url: "https://vendor.example/platforms" },
      "https://vendor.example/product",
      [],
      { productType: "desktop-official" }
    ),
    ""
  );
  assert.equal(
    validateOfficialDownloadAction(
      { kind: "no-windows", url: "https://vendor.example/platforms" },
      "https://vendor.example/product",
      [],
      { productType: "web" }
    ),
    ""
  );
});

test("no-windows corrects the product to a non-desktop module before catalog validation", () => {
  const catalog = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "admin", "data", "catalog-v1.json"),
    "utf8"
  ));
  const vendor = catalog.vendors.find((candidate) =>
    candidate.products.some((product) => product.productType === "desktop-official")
  );
  const index = vendor.products.findIndex((product) => product.productType === "desktop-official");
  const product = vendor.products[index];
  vendor.products[index] = {
    ...applyProductModule(product, "web-link"),
    entryPoints: (product.entryPoints || []).filter((entry) => entry.type !== "desktop"),
    officialDownload: {
      kind: "no-windows",
      url: new URL("/platforms", product.website).toString()
    }
  };
  assert.doesNotThrow(() => validateCatalog(catalog));
});
