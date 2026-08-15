"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  auditDesktopAcquisitionMatrix
} = require("../shared/desktop-acquisition-matrix.cjs");

const products = [
  {
    id: "portraitpro",
    productType: "desktop-official",
    officialDownload: {
      kind: "download-page",
      url: "https://www.anthropics.com/portraitpro/download/"
    }
  },
  {
    id: "raycast-windows",
    productType: "desktop-official",
    officialDownload: {
      kind: "download-page",
      url: "https://www.raycast.com/windows"
    }
  }
];

const precisionEvidence = [
  {
    productId: "portraitpro",
    kind: "vendor-bootstrap",
    url: "https://www.anthropics.com/portraitpro/download/",
    coveredProductIds: ["portraitpro"]
  },
  {
    productId: "raycast-windows",
    kind: "store",
    url: "https://apps.microsoft.com/detail/9PFXXSHC64H3"
  }
];

test("desktop acquisition matrix exposes a page fallback that loses vendor or Store semantics", () => {
  assert.deepEqual(
    auditDesktopAcquisitionMatrix(products, precisionEvidence),
    [
      { productId: "portraitpro", actual: "download-page", expected: "vendor-bootstrap" },
      { productId: "raycast-windows", actual: "download-page", expected: "store" }
    ]
  );
});

test("desktop acquisition matrix is green only when every precise external route is retained", () => {
  const corrected = products.map((product) => ({ ...product, officialDownload: precisionEvidence.find((row) => row.productId === product.id) }));
  assert.deepEqual(auditDesktopAcquisitionMatrix(corrected, precisionEvidence), []);
});

test("desktop acquisition matrix rejects a generic URL behind an otherwise correct kind", () => {
  const catalog = [{
    id: "raycast-windows",
    productType: "desktop-official",
    officialDownload: { kind: "store", url: "https://www.raycast.com/windows" }
  }];
  assert.deepEqual(auditDesktopAcquisitionMatrix(catalog, [precisionEvidence[1]]), [{
    productId: "raycast-windows",
    actualUrl: "https://www.raycast.com/windows",
    expectedUrl: "https://apps.microsoft.com/detail/9PFXXSHC64H3"
  }]);
});

test("desktop acquisition matrix rejects duplicate and non-desktop evidence rows", () => {
  const corrected = products.map((product) => ({ ...product, officialDownload: precisionEvidence.find((row) => row.productId === product.id) }));
  assert.deepEqual(
    auditDesktopAcquisitionMatrix(corrected, [precisionEvidence[0], precisionEvidence[0], {
      productId: "missing",
      kind: "store",
      url: "https://apps.microsoft.com/detail/9PFXXSHC64H3"
    }]),
    [
      { productId: "portraitpro", reason: "duplicate evidence" },
      { productId: "missing", reason: "product is not a desktop acquisition" }
    ]
  );
});

test("desktop acquisition matrix requires vendor bootstrap coverage", () => {
  assert.deepEqual(auditDesktopAcquisitionMatrix(products, [{
    ...precisionEvidence[0], coveredProductIds: []
  }]), [{ productId: "portraitpro", reason: "vendor bootstrap coverage is invalid" }]);
});

test("a complete matrix includes reclassified no-Windows records exactly once", () => {
  const rows = [...precisionEvidence, {
    productId: "vendor-web-only",
    kind: "no-windows",
    url: "https://vendor.example/platforms"
  }];
  const catalog = [
    ...products.map((product) => ({ ...product, officialDownload: precisionEvidence.find((row) => row.productId === product.id) })),
    { id: "vendor-web-only", productType: "web", officialDownload: rows[2] }
  ];
  assert.deepEqual(auditDesktopAcquisitionMatrix(catalog, rows, { requireComplete: true }), []);
  assert.deepEqual(auditDesktopAcquisitionMatrix(catalog, rows.slice(0, 2), { requireComplete: true }), [
    { productId: "vendor-web-only", reason: "missing evidence" }
  ]);
});

test("deep-rescan executable evidence makes Hermes and known precise routes red until catalog data catches up", () => {
  const candidate = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    "fixtures",
    "desktop-acquisition-executable-evidence-matrix.json"
  ), "utf8"));
  const current = [
    { id: "nous-hermes-desktop", productType: "desktop-official", officialDownload: { kind: "download-page", url: "https://github.com/nousresearch/hermes-agent/releases/latest" } },
    { id: "blender", productType: "desktop-official", officialDownload: { kind: "store", url: "https://www.blender.org/download/" } },
    { id: "meitu-ultra", productType: "web", officialDownload: { kind: "no-windows", url: "https://ultra.meitu.com/download" } },
    { id: "portraitpro", productType: "desktop-official", officialDownload: { kind: "download-page", url: "https://www.anthropics.com/portraitpro/download/" } },
    { id: "raycast-windows", productType: "desktop-official", officialDownload: { kind: "download-page", url: "https://www.raycast.com/windows" } },
    { id: "alibaba-dingtalk-ai", productType: "desktop-official", officialDownload: { kind: "store", url: "https://www.dingtalk.com/download?isLite=0" } },
    { id: "spark-mail-windows", productType: "desktop-official", officialDownload: { kind: "store", url: "https://sparkmailapp.com/download" } }
  ];
  assert.deepEqual(
    auditDesktopAcquisitionMatrix(current, candidate),
    [
      { productId: "nous-hermes-desktop", actual: "download-page", expected: "direct-artifact" },
      { productId: "blender", actual: "store", expected: "direct-artifact" },
      { productId: "meitu-ultra", actual: "no-windows", expected: "manual-selector" },
      { productId: "portraitpro", actual: "download-page", expected: "manual-selector" },
      { productId: "raycast-windows", actual: "download-page", expected: "store" },
      { productId: "alibaba-dingtalk-ai", actualUrl: "https://www.dingtalk.com/download?isLite=0", expectedUrl: "https://apps.microsoft.com/store/detail/XPDDXZKH816B14" },
      { productId: "spark-mail-windows", actualUrl: "https://sparkmailapp.com/download", expectedUrl: "https://apps.microsoft.com/store/detail/XPFCS9QJBKTHVZ" }
    ]
  );
});

test("deep-rescan cannot label an untyped URL as a direct desktop artifact", () => {
  assert.deepEqual(auditDesktopAcquisitionMatrix([{
    id: "nous-hermes-desktop",
    productType: "desktop-official",
    officialDownload: { kind: "download-page", url: "https://github.com/nousresearch/hermes-agent/releases/latest" }
  }], {
    records: [{
      productId: "nous-hermes-desktop",
      recommendedStrategy: "direct-artifact",
      downloadUrl: "https://hermes-assets.nousresearch.com/Hermes-Setup.exe"
    }]
  }), [{
    productId: "nous-hermes-desktop",
    reason: "direct artifact is incomplete or unsafe"
  }]);
});

test("deep-rescan rejects command-shaped fields before it can classify an acquisition route", () => {
  assert.deepEqual(auditDesktopAcquisitionMatrix([{
    id: "portraitpro",
    productType: "desktop-official",
    officialDownload: { kind: "download-page", url: "https://www.anthropics.com/portraitpro/download/" }
  }], {
    records: [{
      productId: "portraitpro",
      recommendedStrategy: "manual-selector",
      pageUrl: "https://www.anthropics.com/portraitpro/download/",
      command: "powershell.exe"
    }]
  }), [{
    productId: "portraitpro",
    reason: "candidate contains execution fields"
  }]);
});

test("deep-rescan rejects a CLI command alias inside a desktop record", () => {
  assert.deepEqual(auditDesktopAcquisitionMatrix([{
    id: "nous-hermes-desktop",
    productType: "desktop-official",
    officialDownload: { kind: "download-page", url: "https://hermes-agent.nousresearch.com/desktop" }
  }], {
    records: [{
      productId: "nous-hermes-desktop",
      recommendedStrategy: "direct-artifact",
      downloadUrl: "https://hermes-assets.nousresearch.com/Hermes-Setup.exe",
      fileName: "Hermes-Setup.exe",
      artifactKind: "exe",
      officialInstallCommand: "iex (irm https://hermes-agent.nousresearch.com/install.ps1)"
    }]
  }), [{
    productId: "nous-hermes-desktop",
    reason: "candidate contains execution fields"
  }]);
});

test("stable redirect evidence retains its approved download URL rather than the evidence page", () => {
  const catalog = [{
    id: "fireflies-desktop",
    productType: "desktop-official",
    officialDownload: {
      kind: "stable-redirect",
      url: "https://m.fireflies.ai/desktop/releases/download?platform=windows"
    }
  }];
  assert.deepEqual(auditDesktopAcquisitionMatrix(catalog, {
    records: [{
      productId: "fireflies-desktop",
      recommendedStrategy: "stable-redirect",
      evidenceUrl: "https://fireflies.ai/desktop",
      downloadUrl: "https://m.fireflies.ai/desktop/releases/download?platform=windows"
    }]
  }), []);
});

test("canonical rescans preserve existing direct and bootstrap contracts without inventing artifact fields", () => {
  const existing = [
    {
      id: "chatgpt-desktop",
      productType: "desktop-reviewed",
      download: {
        url: "https://get.microsoft.com/installer/download/9PLM9XGG6VKS",
        fileName: "ChatGPT Installer.exe",
        artifactKind: "exe"
      }
    },
    {
      id: "adobe-illustrator",
      productType: "desktop-official",
      officialDownload: {
        kind: "vendor-bootstrap",
        url: "https://www.adobe.com/products/illustrator/free-trial-download.html",
        coveredProductIds: ["adobe-creative-cloud", "adobe-illustrator"]
      }
    }
  ];
  assert.deepEqual(auditDesktopAcquisitionMatrix(existing, {
    records: [
      {
        productId: "chatgpt-desktop",
        recommendedStrategy: "direct-artifact",
        acquisitionUrl: "https://chatgpt.com/download",
        researchStatus: "identity-no-change",
        moduleCompatibility: "existing direct/client-managed identity retained"
      },
      {
        productId: "adobe-illustrator",
        recommendedStrategy: "vendor-bootstrap",
        acquisitionUrl: "https://www.adobe.com/products/illustrator/free-trial-download.html",
        researchStatus: "identity-no-change"
      }
    ]
  }), []);
});
