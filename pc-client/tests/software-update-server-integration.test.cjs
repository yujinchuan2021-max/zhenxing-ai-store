"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");

test("admin exposes a unified scan-review-publish software update center", () => {
  const server = read("admin/server.cjs");
  const html = read("admin/public/index.html");
  const app = read("admin/public/app.js");
  assert.match(server, /GET[\s\S]*\/api\/software-updates/);
  assert.match(server, /POST[\s\S]*\/api\/software-updates\/scan/);
  assert.match(server, /PUT[\s\S]*\/api\/software-updates/);
  assert.match(server, /POST[\s\S]*\/api\/software-updates\/publish/);
  assert.match(server, /\/software-update-release\.json/);
  assert.match(html, /data-view="software-updates"/);
  assert.match(app, /scan-software-updates/);
  assert.match(app, /save-software-update-review/);
  assert.match(app, /publish-software-updates/);
  assert.match(app, /发布空清单（撤回全部更新）/);
});

test("future catalog products join the shared update inventory instead of a page-only list", () => {
  const center = read("admin/software-update-center.cjs");
  assert.match(center, /catalog\?\.vendors/);
  assert.match(center, /product:\$\{String\(product\?\.id/);
  assert.match(center, /status: "manual-review"/);
});
