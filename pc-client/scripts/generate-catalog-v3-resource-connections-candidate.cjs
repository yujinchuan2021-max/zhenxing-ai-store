"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const input = Object.freeze({
  path: "docs/research/resource-store-next-major-catalog-candidate-active7-2026-08-14.json",
  sha256: "8822496b0b768605f2a0ecd7c6ebf70759107cb215cfb2cce1a6a2ae5caaf302"
});
const outputPath =
  "docs/research/catalog-v3-resource-connections-candidate-2026-08-14.json";

const raw = fs.readFileSync(path.join(root, input.path));
if (crypto.createHash("sha256").update(raw).digest("hex") !== input.sha256) {
  throw new Error("catalog v3 candidate rejected: frozen composition drift");
}
const source = JSON.parse(raw.toString("utf8"));
if (
  source.candidateOnly !== true ||
  source.freezeOnly !== true ||
  source.publishable !== false ||
  source.catalog?.schemaVersion !== 2 ||
  !Array.isArray(source.resourceConnections) ||
  source.resourceConnections.length !== 10
) {
  throw new Error("catalog v3 candidate rejected: composition contract mismatch");
}

validateCatalog(structuredClone(source.catalog));
const catalog = structuredClone(source.catalog);
catalog.schemaVersion = 3;
catalog.resourceConnections = structuredClone(source.resourceConnections);
validateCatalog(catalog);

const summary = {
  resources: catalog.resources.length,
  targets: catalog.resources.reduce((count, resource) => count + resource.targets.length, 0),
  resourceConnections: catalog.resourceConnections.length
};
assert.deepEqual(summary, {
  resources: 262,
  targets: 796,
  resourceConnections: 10
});

const reversed = structuredClone(catalog);
const edges = reversed.resourceConnections;
delete reversed.resourceConnections;
reversed.schemaVersion = 2;
assert.deepEqual(reversed, source.catalog);
assert.deepEqual(edges, source.resourceConnections);

const candidate = {
  schemaVersion: 1,
  candidateOnly: true,
  publishable: false,
  freezeOnly: true,
  targetRelease: "next-major",
  generatedAt: "2026-08-14T00:00:00.000Z",
  title: "catalog v3 resourceConnections candidate",
  input,
  summary,
  catalog,
  safety: {
    candidateOnly: true,
    freezeOnly: true,
    publishable: false,
    signed: false,
    activeCatalogWritten: false,
    stateWritten: false,
    channelWritten: false,
    packaged: false
  }
};

fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ outputPath, summary })}\n`);
