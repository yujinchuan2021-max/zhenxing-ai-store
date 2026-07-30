"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  getInstallRegistration
} = require("../shared/install-registry.cjs");
const {
  applyProductModule,
  moduleIdForProductType
} = require("../shared/product-modules.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");

const catalogPath = path.resolve(
  __dirname,
  "..",
  "admin",
  "data",
  "catalog-v1.json"
);
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

for (const vendor of catalog.vendors) {
  vendor.products = vendor.products.map((product) => {
    const registration = getInstallRegistration(product.id);
    return applyProductModule(
      {
        ...product,
        installProfileId: registration?.profileId || ""
      },
      moduleIdForProductType(product.productType)
    );
  });
}

validateCatalog(catalog);
fs.writeFileSync(
  catalogPath,
  `${JSON.stringify(catalog, null, 2)}\n`,
  "utf8"
);
