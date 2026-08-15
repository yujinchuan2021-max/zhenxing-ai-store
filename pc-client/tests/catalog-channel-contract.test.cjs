"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { catalogReleasePath, normalizeCatalogChannel } = require("../shared/catalog-channel.cjs");

test("catalog channels have explicit paths and reject guessing", () => {
  assert.equal(catalogReleasePath("v1"), "/catalog-release.json");
  assert.equal(catalogReleasePath("v2"), "/channels/v2/catalog-release.json");
  assert.throws(() => normalizeCatalogChannel("0.1.40"), /channel/i);
});

test("admin, server, and local HTTPS proxy require an explicit channel", () => {
  const read = (file) => fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
  const server = read("admin/server.cjs");
  const admin = read("admin/public/app.js");
  const caddy = read("deployment/local/Caddyfile");
  assert.match(server, /catalogReleasePath\("v2"\)/);
  assert.match(server, /v2 目录尚未发布/);
  assert.match(server, /const channel = normalizeCatalogChannel\(body\.channel\)/);
  assert.match(server, /Object\.hasOwn\(body, "channel"\)/);
  assert.match(admin, /data-release-channel/);
  assert.match(admin, /channel: state\.releaseChannel/);
  assert.match(caddy, /\/channels\/v2\/catalog-release\.json/);
  assert.doesNotMatch(server, /user-agent/i);
});
