"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { auditDesktopAcquisitionMatrix } = require("../shared/desktop-acquisition-matrix.cjs");

const [catalogPath, matrixPath] = process.argv.slice(2);
if (!catalogPath || !matrixPath) {
  console.error("usage: node scripts/check-desktop-acquisition-matrix.cjs <catalog.json> <matrix.json>");
  process.exitCode = 2;
} else {
  const catalogFile = JSON.parse(fs.readFileSync(path.resolve(catalogPath), "utf8"));
  const matrixFile = JSON.parse(fs.readFileSync(path.resolve(matrixPath), "utf8"));
  const catalog = catalogFile.payload?.catalog || catalogFile.catalog || catalogFile;
  const products = (catalog.vendors || []).flatMap((vendor) => vendor.products || []);
  const findings = auditDesktopAcquisitionMatrix(products, matrixFile, {
    requireComplete: matrixFile.complete === true ||
      (Number.isInteger(matrixFile.assertions?.expectedProductCount) &&
        matrixFile.assertions.expectedProductCount === matrixFile.assertions.coveredProductCount &&
        matrixFile.assertions.coveredProductCount === matrixFile.assertions.uniqueProductIds)
  });
  process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
  if (findings.length) process.exitCode = 1;
}
