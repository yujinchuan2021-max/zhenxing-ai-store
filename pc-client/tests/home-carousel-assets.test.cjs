"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const assetNames = ["constellation.svg", "aurora-grid.svg", "orbit-network.svg"];

test("the production build ships each controlled home-carousel asset", () => {
  for (const name of assetNames) {
    assert.equal(
      fs.existsSync(path.join(root, "dist", "assets", "home-carousel", name)),
      true,
      `missing built carousel asset: ${name}`
    );
  }
});

test("the carousel localizes accessible image text and still removes failed media", () => {
  const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
  const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
  assert.match(app, /const \[imageFailed, setImageFailed\] = useState\(false\)/);
  assert.match(app, /onError=\{\(\) => setImageFailed\(true\)\}/);
  assert.match(app, /alt=\{catalogDisplayField\(slide, "imageAlt", language\)\}/);
  assert.match(styles, /\.carouselHero\.imageFailed/);
});
