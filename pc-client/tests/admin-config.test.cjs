"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  defaultReleaseSettings,
  validatePublication,
  validateReleaseSettings
} = require("../admin/config-validation.cjs");
const {
  getEnvironmentDownloadPlan,
  getEnvironmentManagedDownloadPlan,
  normalizeSourcePreferences
} = require("../shared/environment-download.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");

function catalogFixture() {
  return JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "admin", "data", "catalog-v1.json"),
      "utf8"
    )
  );
}

test("validates the complete phase-four catalog before publication", () => {
  const report = validatePublication(catalogFixture(), defaultReleaseSettings());
  assert.equal(report.ok, true);
  assert.equal(report.summary.vendors, 49);
  assert.equal(report.summary.products, 148);
  assert.equal(report.summary.extensions, 24);
  assert.equal(report.summary.enabledChinaMirrors, 2);
});

test("download source preferences accept only local approved source identities", () => {
  const preferences = normalizeSourcePreferences();
  preferences[0].sourceId = "operator-controlled-url";
  assert.throws(
    () => normalizeSourcePreferences(preferences),
    /未审核来源/
  );
  const withCommand = normalizeSourcePreferences();
  withCommand[0].command = "powershell.exe";
  assert.throws(
    () => normalizeSourcePreferences(withCommand),
    /无效参数/
  );
});

test("official sources cannot be disabled and always precede mirrors", () => {
  const preferences = normalizeSourcePreferences();
  const official = preferences.find(
    (item) =>
      item.environmentId === "python" &&
      item.sourceId === "python-official"
  );
  official.enabled = false;
  assert.throws(
    () => normalizeSourcePreferences(preferences),
    /必须保留至少一个官方源/
  );

  const ordered = normalizeSourcePreferences();
  ordered.find((item) => item.sourceId === "python-huaweicloud").order = 0;
  ordered.find((item) => item.sourceId === "python-official").order = 100;
  const plan = getEnvironmentDownloadPlan("python", ordered);
  assert.equal(plan.sources[0].id, "python-official");
  assert.equal(plan.sources[1].id, "python-huaweicloud");
});

test("a disabled mirror is removed from fresh and resumed environment plans", () => {
  const preferences = normalizeSourcePreferences();
  preferences.find(
    (item) => item.sourceId === "python-huaweicloud"
  ).enabled = false;
  const plan = getEnvironmentDownloadPlan("python", preferences);
  assert.deepEqual(plan.sources.map((source) => source.id), [
    "python-official"
  ]);
  assert.equal(
    getEnvironmentManagedDownloadPlan("environment:python", {
      persistedSourceUrl:
        "https://mirrors.huaweicloud.com/repository/toolkit/python/3.13.14/python-3.13.14-amd64.exe",
      sourcePreferences: preferences
    }),
    null
  );
});

test("catalog rejects command fields and a disabled featured vendor", () => {
  const commandCatalog = catalogFixture();
  commandCatalog.vendors[0].products[0].command = "cmd.exe /c whoami";
  assert.throws(() => validateCatalog(commandCatalog), /不支持的策略字段/);

  const disabledFeatured = catalogFixture();
  const featuredId = disabledFeatured.home.featuredVendorIds[0];
  disabledFeatured.vendors.find((vendor) => vendor.id === featuredId).enabled =
    false;
  assert.throws(
    () =>
      validatePublication(disabledFeatured, defaultReleaseSettings()),
    /精选厂商已停用/
  );
});

test("publication requires an exact module and reviewed install profile", () => {
  const wrongModule = catalogFixture();
  wrongModule.vendors[0].products[0].moduleId = "web-link";
  assert.throws(
    () => validatePublication(wrongModule, defaultReleaseSettings()),
    /模块/
  );

  const wrongProfile = catalogFixture();
  const managedProduct = wrongProfile.vendors
    .flatMap((vendor) => vendor.products)
    .find((product) => product.id === "codex-cli");
  managedProduct.installProfileId = "cli.claude-code";
  assert.throws(
    () => validatePublication(wrongProfile, defaultReleaseSettings()),
    /安装配置|白名单/
  );
});

test("enabled client updates require a complete verified release identity", () => {
  const settings = defaultReleaseSettings();
  settings.update.enabled = true;
  assert.doesNotThrow(() => validateReleaseSettings(settings));
  assert.throws(
    () => validatePublication(catalogFixture(), settings),
    /URL|origin|version|SHA|fileSize|下载/i
  );
});
