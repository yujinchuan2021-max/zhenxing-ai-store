"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const files = [
  "deployment/local/Caddyfile",
  "deployment/admin-only/Caddyfile",
  "deployment/community-production/Caddyfile",
  "../deployment/server/Caddyfile"
];

test("every supported public topology proxies the signed software update feed", () => {
  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    assert.match(source, /\/software-update-release\.json/, relativePath);
    assert.match(source, /reverse_proxy\s+(?:host\.docker\.internal|admin):4173/, relativePath);
  }
});
