"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { BRAND } = require("../shared/brand.cjs");
const packageJson = require("../package.json");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const readBinary = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath));

test("public surfaces use the ZhenXing AI brand without breaking the legacy app identity", () => {
  const catalog = JSON.parse(read("admin/data/catalog-v1.json"));
  const communityMigrationEntrypoint = read("community/flarum/migration-entrypoint.sh");
  const language = read("src/language/index.ts");
  const index = read("index.html");
  const main = read("electron/main.cjs");

  assert.deepEqual(
    { name: BRAND.name, englishName: BRAND.englishName, domain: BRAND.domain },
    { name: "枕星 AI", englishName: "ZhenXing AI", domain: "zhenxingai.com" }
  );
  assert.equal(packageJson.build.productName, BRAND.name);
  assert.match(packageJson.build.nsis.artifactName, /^ZhenXing-AI-/);
  assert.match(packageJson.build.portable.artifactName, /^ZhenXing-AI-/);
  assert.equal(packageJson.build.appId, BRAND.legacyAppId);
  assert.equal(catalog.brand.name, BRAND.name);
  assert.equal(catalog.brand.mark, BRAND.mark);
  assert.equal(catalog.community.title, `${BRAND.name} 社区`);
  assert.match(communityMigrationEntrypoint, /forum_title[^\n]+枕星 AI 社区/);
  assert.match(main, /BRAND\.legacyUserDataDirectory/);
  assert.match(main, /title: `\$\{BRAND\.name\} Windows`/);
  assert.match(index, /<title>枕星 AI Windows<\/title>/);
  assert.equal([...language.matchAll(/"chrome\.pc": "Windows"/g)].length, 2);
  assert.doesNotMatch(language, /"chrome\.pc": "PC"/);
});

test("the supplied star asset is the only client and Windows package brand icon", () => {
  const app = read("src/App.tsx");
  const styles = read("src/styles.css");
  const index = read("index.html");
  const main = read("electron/main.cjs");
  const browserIcon = readBinary("public/brand-icon.png");
  const packageIcon = readBinary("build/icon.png");
  const windowsIcon = readBinary("build/icon.ico");

  assert.equal(fs.existsSync(path.join(root, "assets/brand/zhenxing-star.png")), true);
  assert.deepEqual(browserIcon, packageIcon);
  assert.deepEqual([...packageIcon.subarray(1, 4)], [0x50, 0x4e, 0x47]);
  assert.equal(packageIcon.readUInt32BE(16), 512);
  assert.equal(packageIcon.readUInt32BE(20), 512);

  assert.equal(windowsIcon.readUInt16LE(0), 0);
  assert.equal(windowsIcon.readUInt16LE(2), 1);
  const iconSizes = new Set();
  for (let index = 0; index < windowsIcon.readUInt16LE(4); index += 1) {
    const offset = 6 + index * 16;
    iconSizes.add(windowsIcon[offset] || 256);
  }
  assert.deepEqual(
    [16, 24, 32, 48, 64, 128, 256].filter((size) => !iconSizes.has(size)),
    []
  );

  assert.equal(packageJson.build.win.icon, "build/icon.ico");
  assert.equal(packageJson.build.nsis.installerIcon, "build/icon.ico");
  assert.equal(packageJson.build.nsis.uninstallerIcon, "build/icon.ico");
  assert.equal(packageJson.build.files.includes("build/icon.ico"), true);
  assert.match(main, /icon:\s*path\.join\(__dirname, "\.\.", "build", "icon\.png"\)/);
  assert.match(main, /new Tray\(trayIconPath\)/);
  assert.match(index, /<link rel="icon" type="image\/png" href="\/brand-icon\.png" \/>/);
  assert.match(app, /const BRAND_ICON_SRC = "\/brand-icon\.png";/);
  assert.equal([...app.matchAll(/<BrandMark \/>/g)].length, 2);
  assert.doesNotMatch(app, /className="brandMark">\{(?:BRAND|brand)\.mark\}/);
  assert.match(styles, /\.brandMark img\s*\{/);
  assert.equal(fs.existsSync(path.join(root, "build/icon.svg")), false);
});
