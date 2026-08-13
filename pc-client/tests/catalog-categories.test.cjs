"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  DEFAULT_PRODUCT_CATEGORIES,
  resolveCatalogCategories,
  validateCatalog
} = require("../shared/catalog.cjs");

function catalogWithCategory(category, categories) {
  return {
    schemaVersion: 1,
    ...(categories ? { categories } : {}),
    vendors: [
      {
        id: "example",
        name: "Example",
        initial: "E",
        mark: "E",
        color: "#112233",
        description: "示例厂商。",
        website: "https://example.com",
        tutorial: "https://example.com/docs",
        products: [
          {
            id: "example-web",
            name: "Example Web",
            kind: "其他产品",
            category,
            description: "示例网页产品。",
            website: "https://example.com/app",
            tutorial: "https://example.com/docs",
            productType: "web",
            requirements: [],
            installPolicy: "open-product-website",
            downloadPolicy: "none",
            signaturePolicy: "not-applicable",
            uninstallPolicy: "not-managed"
          }
        ]
      }
    ]
  };
}

test("catalog categories are backend-defined while legacy catalogs stay valid", () => {
  const custom = catalogWithCategory("办公效率", ["办公效率", "AI 对话"]);
  assert.doesNotThrow(() => validateCatalog(custom));
  assert.deepEqual(resolveCatalogCategories(custom), ["办公效率", "AI 对话"]);

  const legacy = catalogWithCategory("AI 对话");
  assert.doesNotThrow(() => validateCatalog(legacy));
  assert.deepEqual(resolveCatalogCategories(legacy), DEFAULT_PRODUCT_CATEGORIES);
});

test("catalog rejects undeclared, duplicate, blank and malformed categories", () => {
  assert.throws(
    () => validateCatalog(catalogWithCategory("办公效率", ["AI 对话"])),
    /产品数据无效/
  );
  assert.throws(
    () => validateCatalog(catalogWithCategory("AI 对话", ["AI 对话", "AI 对话"])),
    /产品类别配置无效/
  );
  assert.throws(
    () => validateCatalog(catalogWithCategory("AI 对话", [" AI 对话"])),
    /产品类别配置无效/
  );
  assert.throws(
    () => validateCatalog(catalogWithCategory("AI 对话", { invalid: true })),
    /产品类别配置无效/
  );
});

test("production catalog declares every category used by its products", () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "..", "admin", "data", "catalog-v1.json"),
      "utf8"
    )
  );
  assert.doesNotThrow(() => validateCatalog(catalog));
  const declared = new Set(catalog.categories);
  const used = new Set(
    catalog.vendors.flatMap((vendor) =>
      vendor.products.map((product) => product.category)
    )
  );
  assert.deepEqual([...used].filter((category) => !declared.has(category)), []);
});

test("client keeps full catalog metadata apart from visible storefront records", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "src", "App.tsx"),
    "utf8"
  );
  assert.match(source, /const \[catalogAllVendors, setCatalogAllVendors\]/);
  assert.match(source, /vendors: catalogAllVendors/);
  assert.match(
    source,
    /const products = catalogAllVendors\.flatMap\(\(vendor\) => vendor\.products\)/
  );
  assert.match(source, /window\.addEventListener\("focus", refreshOnFocus\)/);
  assert.match(source, /window\.setInterval\(\(\) =>/);
  assert.match(source, /CATALOG_REFRESH_TTL_MS/);

  const recoveryStart = source.indexOf(
    "for (const environmentId of Object.keys(ENVIRONMENT_NAMES))"
  );
  const recoveryEnd = source.indexOf("useEffect(() =>", recoveryStart + 1);
  assert.ok(recoveryStart > 0 && recoveryEnd > recoveryStart);
  assert.doesNotMatch(
    source.slice(recoveryStart, recoveryEnd),
    /refreshEnvironmentReport/
  );
  assert.match(
    source.slice(recoveryStart, recoveryEnd),
    /applyEnvironmentOperationTask\(operationTask, false\)/
  );
  assert.match(
    source,
    /if \(allowGeneralProbe\) void refreshEnvironmentReport\(false\)/
  );
});
