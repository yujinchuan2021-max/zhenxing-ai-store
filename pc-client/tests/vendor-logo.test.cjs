"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const catalog = require("../admin/data/catalog-v1.json");
const sources = require("../admin/data/vendor-icon-sources.json");
const fallbacks = require("../admin/data/vendor-icon-fallbacks.json");
const {
  vendorIconAssetFromPath,
  verifyVendorIconAssetFile
} = require("../shared/vendor-icon.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");

test("vendor logos fail back to the catalog mark without leaking referrers", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "App.tsx"),
    "utf8"
  );

  assert.match(app, /vendor\.iconUrl && !iconFailed/);
  assert.match(app, /onError=\{\(\) => setIconFailed\(true\)\}/);
  assert.match(app, /referrerPolicy="no-referrer"/);
  assert.match(app, /loading=\{hero \? "eager" : "lazy"\}/);
  assert.match(
    app,
    /background: "#fff"/,
    "logos and text fallbacks need one readable neutral background"
  );
  const styles = fs.readFileSync(
    path.join(__dirname, "..", "src", "styles.css"),
    "utf8"
  );
  assert.match(styles, /\.vendorMark img \{[^}]*width: 100%;[^}]*height: 100%;/s);
  assert.match(styles, /\.vendorMark\.large \{[^}]*color: var\(--accent-ink\);/s);
  assert.match(styles, /\.vendorMark\.heroMark \{[^}]*color: var\(--accent-ink\);/s);

  const admin = fs.readFileSync(
    path.join(__dirname, "..", "admin", "public", "app.js"),
    "utf8"
  );
  assert.match(admin, /data-action="upload-vendor-icon"/);
  assert.match(admin, /data-action="remove-vendor-icon"/);
  assert.match(admin, /\/api\/vendor-icon/);
  assert.doesNotMatch(admin, /图片图标（HTTPS/);
});

test("published catalog uses reviewed local logo assets with reliable fallbacks", () => {
  assert.doesNotThrow(() => validateCatalog(catalog));
  const withLogo = catalog.vendors.filter((vendor) => vendor.iconAsset);
  const withoutLogo = catalog.vendors.filter((vendor) => !vendor.iconAsset);
  assert.deepEqual(
    new Set(Object.keys(fallbacks.vendors)),
    new Set(withoutLogo.map((vendor) => vendor.id)),
    "every letter fallback must be explicitly reviewed"
  );
  for (const vendor of withoutLogo) {
    const fallback = fallbacks.vendors[vendor.id];
    assert.match(fallback.evidenceUrl, /^https:\/\//);
    assert.ok(fallback.reason.length >= 12);
  }
  assert.equal(
    catalog.vendors.every((vendor) => !vendor.iconUrl),
    true,
    "remote hotlinked vendor icons are forbidden"
  );
  for (const vendor of withLogo) {
    assert.doesNotThrow(() =>
      verifyVendorIconAssetFile(
        path.join(__dirname, "..", "admin", "data"),
        vendor.iconAsset
      )
    );
    const source = sources.assets[vendor.iconAsset.sha256];
    assert.ok(source, `${vendor.id} logo source missing`);
    assert.match(source.sourceUrl, /^https:\/\//);
    assert.ok(source.vendorIds.includes(vendor.id));
  }
});

test("vendor logo assets cannot be shared across unrelated vendors", () => {
  for (const source of Object.values(sources.assets)) {
    assert.equal(
      source.vendorIds.length,
      1,
      `${source.sourceUrl} is reused by ${source.vendorIds.join(", ")}`
    );
    if (new URL(source.sourceUrl).hostname === "github.githubassets.com") {
      assert.deepEqual(
        source.vendorIds,
        ["github"],
        "the GitHub site favicon is not another vendor's brand logo"
      );
    }
  }
});

test("high-risk vendor logos use their reviewed official organization identity", () => {
  const expectedSources = {
    zoner: "https://www.zoner.com/en",
    on1: "https://www.on1.com/press/",
    "capture-one": "https://www.captureone.com/en/products/capture-one-pro",
    dxo: "https://www.dxo.com/en/dxo-photolab/",
    craft: "https://www.craft.do/download",
    capacities: "https://capacities.io/download-app",
    evernote: "https://evernote.com/blog/introducing-v11",
    dropbox: "https://dash.dropbox.com/",
    tana: "https://tana.inc/download",
    heptabase: "https://heptabase.com/download",
    opera: "https://www.opera.com/one",
    mozilla: "https://www.firefox.com/en-US/download/windows/",
    invokeai: "https://invoke.ai/download/",
    upscayl: "https://upscayl.org/download",
    fotor: "https://www.fotor.com/windows/index.html",
    cyberlink: "https://www.cyberlink.com/",
    ableton: "https://github.com/Ableton",
    amazon: "https://github.com/aws",
    nvidia: "https://github.com/NVIDIA",
    nousresearch: "https://github.com/NousResearch",
    "open-home-foundation": "https://github.com/OpenHomeFoundation",
    redis: "https://github.com/redis",
    stability: "https://github.com/Stability-AI",
    supabase: "https://github.com/supabase",
    uipath: "https://github.com/UiPath",
    krea: "https://github.com/krea-ai",
    meshy: "https://github.com/meshy-dev",
    shengshu: "https://github.com/shengshu-ai",
    pixverse: "https://github.com/PixVerseAI",
    discord: "https://github.com/discord"
  };
  for (const [vendorId, expectedSource] of Object.entries(expectedSources)) {
    const vendor = catalog.vendors.find((entry) => entry.id === vendorId);
    assert.ok(vendor?.iconAsset, `${vendorId} logo missing`);
    assert.equal(
      sources.assets[vendor.iconAsset.sha256]?.sourceUrl,
      expectedSource,
      `${vendorId} must use its reviewed organization identity`
    );
  }
});

test("vendors whose brand terms forbid unlicensed logo use stay on reviewed text fallbacks", () => {
  const restricted = catalog.vendors.find((vendor) => vendor.id === "01ai");
  assert.ok(restricted, "01.AI vendor missing");
  assert.equal(restricted.iconAsset, undefined);
  assert.equal(restricted.iconUrl, "");
  assert.equal(
    fallbacks.vendors[restricted.id]?.evidenceUrl,
    "https://platform.01.ai/useragreement"
  );
});

test("historical signed catalog logo URLs retain their content-addressed files", () => {
  const releaseDirectory = path.join(
    __dirname,
    "..",
    "admin",
    "published",
    "catalog-store",
    "releases"
  );
  const assetPaths = new Set();
  for (const fileName of fs.readdirSync(releaseDirectory)) {
    if (!fileName.endsWith(".json")) continue;
    const envelope = JSON.parse(
      fs.readFileSync(path.join(releaseDirectory, fileName), "utf8")
    );
    for (const vendor of envelope.payload?.catalog?.vendors || []) {
      const match = String(vendor.iconUrl || "").match(
        /\/vendor-icons\/([a-f0-9]{64}\.(?:png|jpg|webp|ico|svg))$/i
      );
      if (match) assetPaths.add(`vendor-icons/${match[1]}`);
    }
  }
  assert.ok(assetPaths.size > 0, "signed catalog history has no logo assets");
  for (const assetPath of assetPaths) {
    assert.doesNotThrow(() =>
      verifyVendorIconAssetFile(
        path.join(__dirname, "..", "admin", "data"),
        vendorIconAssetFromPath(assetPath)
      )
    );
  }
});

test("catalog validation rejects arbitrary remote vendor icon URLs", () => {
  const invalid = structuredClone(catalog);
  invalid.vendors[0].iconUrl = "https://tracker.example/logo.png";
  assert.throws(() => validateCatalog(invalid), /厂商数据无效/);
});
