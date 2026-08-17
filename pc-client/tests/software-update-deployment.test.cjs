"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const proxyFiles = [
  "deployment/local/Caddyfile",
  "deployment/admin-only/Caddyfile",
  "../deployment/server/Caddyfile"
];

test("non-production topologies proxy the signed software update feed", () => {
  for (const relativePath of proxyFiles) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    assert.match(source, /\/software-update-release\.json/, relativePath);
    assert.match(source, /reverse_proxy\s+(?:host\.docker\.internal|admin):4173/, relativePath);
  }
});

test("production serves the signed software update feed from the read-only published directory", () => {
  const caddy = fs.readFileSync(path.join(root, "deployment/community-production/Caddyfile"), "utf8");
  const compose = fs.readFileSync(path.join(root, "deployment/community-production/compose.server.yaml"), "utf8");
  const hotfix = fs.readFileSync(path.join(root, "deployment/community-production/compose.software-update-static.yaml"), "utf8");

  assert.match(caddy, /@softwareUpdate\s+path \/software-update-release\.json/);
  assert.match(caddy, /root \* \/srv\/aihub-admin-published/);
  assert.match(caddy, /file_server/);
  assert.match(compose, /AIHUB_ADMIN_PUBLISHED_DIR[^\n]*:\/srv\/aihub-admin-published:ro/);
  assert.match(hotfix, /AIHUB_SOFTWARE_UPDATE_CADDYFILE[^\n]*:\/etc\/caddy\/Caddyfile:ro/);
  assert.match(hotfix, /AIHUB_ADMIN_PUBLISHED_DIR[^\n]*:\/srv\/aihub-admin-published:ro/);
});

test("server topologies expose the signed client version manifest through the admin boundary", () => {
  for (const relativePath of [
    "deployment/admin-only/Caddyfile",
    "deployment/community-production/Caddyfile",
    "../deployment/server/Caddyfile"
  ]) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    assert.match(source, /path[^\n]*\/update-release\.json/, relativePath);
    assert.match(source, /reverse_proxy\s+admin:4173/, relativePath);
  }
});
