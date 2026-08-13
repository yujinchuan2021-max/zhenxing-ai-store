"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { validateCatalog } = require("../shared/catalog.cjs");

test("the unified Windows desktop pipeline is transactional and replay-stable", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-windows-catalog-"));
  const catalogPath = path.join(directory, "catalog-v1.json");
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const sourcePath = path.resolve(__dirname, "../admin/data/catalog-v1.json");
  const catalog = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  catalog.vendors
    .flatMap((vendor) => vendor.products)
    .find((product) => product.id === "canva-windows").name = "stale name";
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  const run = () =>
    spawnSync(
      process.execPath,
      [path.resolve(__dirname, "../scripts/apply-all-windows-desktop-catalog.cjs")],
      {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env, AIHUB_CATALOG_PATH: catalogPath },
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 1024 * 1024
      }
    );

  const first = run();
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /"changed":true/);
  const firstText = fs.readFileSync(catalogPath, "utf8");
  const firstCatalog = JSON.parse(firstText);
  assert.doesNotThrow(() => validateCatalog(firstCatalog));
  assert.equal(
    firstCatalog.vendors
      .flatMap((vendor) => vendor.products)
      .find((product) => product.id === "canva-windows").name,
    "Canva for Windows"
  );

  const second = run();
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /"changed":false/);
  assert.equal(fs.readFileSync(catalogPath, "utf8"), firstText);
});
