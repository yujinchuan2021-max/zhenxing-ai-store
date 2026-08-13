"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

test("catalog imports preserve backend-managed state and logo assets", () => {
  const logo = { path: "vendor-icons/logo.png", sha256: "a".repeat(64), mimeType: "image/png" };
  const vendor = {
    id: "vendor",
    enabled: false,
    order: 23,
    iconAsset: logo,
    iconUrl: "",
    description: "old"
  };

  applyDefinition(
    vendor,
    { id: "vendor", enabled: true, order: 0, iconUrl: "", description: "new" },
    ["enabled", "order", "iconAsset", "iconUrl"]
  );

  assert.equal(vendor.enabled, false);
  assert.equal(vendor.order, 23);
  assert.equal(vendor.iconAsset, logo);
  assert.equal(vendor.description, "new");
});
