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

test("public surfaces use the ZhenXing AI brand without breaking the legacy app identity", () => {
  const catalog = JSON.parse(read("admin/data/catalog-v1.json"));
  const communityEntrypoint = read("community/flarum/docker-entrypoint.sh");
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
  assert.match(communityEntrypoint, /"forum_title", "枕星 AI 社区"/);
  assert.match(main, /BRAND\.legacyUserDataDirectory/);
  assert.match(main, /title: `\$\{BRAND\.name\} PC`/);
});
