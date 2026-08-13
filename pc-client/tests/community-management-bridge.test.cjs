"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("Flarum management bridge has one fixed secret-gated endpoint and exact bounded contract", () => {
  const bridge = read("community", "flarum", "aihub-community-management.php");
  const dockerfile = read("community", "flarum", "Dockerfile");
  const entrypoint = read("community", "flarum", "production-entrypoint.sh");
  const apache = read("community", "flarum", "apache.conf");
  const policy = read("shared", "local-service-release-policy.cjs");

  assert.match(bridge, /HTTP_X_AIHUB_COMMUNITY_MANAGEMENT_SECRET/);
  assert.match(bridge, /AIHUB_COMMUNITY_MANAGEMENT_SECRET/);
  assert.match(bridge, /frame-ancestors 'none'/);
  assert.match(bridge, /\$input\['action'\].*=== 'list'/);
  assert.match(bridge, /set-discussion-hidden/);
  assert.match(bridge, /set-post-hidden/);
  assert.match(bridge, /information_schema\.columns/);
  assert.match(bridge, /post_flags/);
  assert.match(bridge, /moderation-extension-not-configured/);
  assert.match(bridge, /'nativeAdmin' => false/);
  assert.match(bridge, /LIMIT 20/);
  assert.match(bridge, /CURLOPT_RETURNTRANSFER => false/);
  assert.match(bridge, /CURLOPT_WRITEFUNCTION/);
  assert.match(bridge, /1048576 - \$receivedBytes/);
  assert.match(bridge, /'preview' => plainText\(\$row\['content'\], 240\)/);
  assert.match(bridge, /'title' => plainText\(\$row\['title'\], 160\)/);
  assert.doesNotMatch(bridge, /community_interactions/);
  assert.doesNotMatch(bridge, /Location:/);
  assert.match(dockerfile, /aihub-community-management\.php/);
  assert.match(entrypoint, /AIHUB_COMMUNITY_MANAGEMENT_SECRET_FILE/);
  assert.match(apache, /community-management/);
  assert.match(policy, /aihub-community-management\.php/);
});

test("CMS renderer uses only the same-origin management contract and never handles bridge secrets", () => {
  const app = read("admin", "public", "app.js");
  const server = read("admin", "server.cjs");

  assert.match(app, /request\("\/api\/community-management"\)/);
  assert.match(app, /\/api\/community-management\/actions/);
  assert.match(app, /X-AIHub-CSRF/);
  assert.doesNotMatch(app, /\/api\/community\/summary/);
  assert.doesNotMatch(app, /\/api\/community\/admin/);
  assert.doesNotMatch(app, /x-aihub-cms-secret/i);
  assert.doesNotMatch(app, /<iframe/i);
  assert.match(server, /pathname === "\/api\/community-management"/);
  assert.doesNotMatch(server, /pathname === "\/api\/community\/summary"/);
  assert.doesNotMatch(server, /pathname === "\/api\/community\/admin"/);
});
