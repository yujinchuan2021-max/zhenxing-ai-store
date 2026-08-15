"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  assertRendererDistClosure,
  clearRendererDistBundles
} = require("../scripts/lib/renderer-dist-closure.cjs");

test("renderer package rejects every unreferenced hashed JS or CSS bundle", () => {
  const indexHtml =
    '<script type="module" src="./assets/index-Ab12cd34.js"></script>' +
    '<link rel="stylesheet" href="./assets/index-Ef56gh78.css">';
  for (const staleBundle of [
    "assets/index-Ij90kl12.js",
    "assets/vendor-Mn34op56.js",
    "assets/theme-Qr78st90.css"
  ]) {
    assert.throws(
      () =>
        assertRendererDistClosure({
          files: [
            "index.html",
            "assets/index-Ab12cd34.js",
            "assets/index-Ef56gh78.css",
            staleBundle,
            "assets/home-carousel/constellation.svg"
          ],
          indexHtml
        }),
      /unreferenced hashed bundle/
    );
  }
});

test("renderer build cleanup removes only generated hashed bundles", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-renderer-dist-"));
  const assets = path.join(root, "assets");
  fs.mkdirSync(path.join(assets, "home-carousel"), { recursive: true });
  for (const file of [
    "index-Ab12cd34.js",
    "index-Ef56gh78.css",
    "vendor-Mn34op56.js"
  ]) {
    fs.writeFileSync(path.join(assets, file), "generated");
  }
  fs.writeFileSync(path.join(assets, "home-carousel", "constellation.svg"), "svg");
  fs.writeFileSync(path.join(root, "index.html"), "html");
  try {
    assert.deepEqual(clearRendererDistBundles(root), { removedBundleCount: 3 });
    assert.deepEqual(fs.readdirSync(assets).sort(), ["home-carousel"]);
    assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8"), "html");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
