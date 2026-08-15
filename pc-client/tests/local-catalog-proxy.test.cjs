"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("the local HTTPS catalog endpoint follows the backend active signed release", () => {
  const caddy = fs.readFileSync(
    path.resolve(__dirname, "../deployment/local/Caddyfile"),
    "utf8"
  );
  const compose = fs.readFileSync(
    path.resolve(__dirname, "../deployment/local/compose.yaml"),
    "utf8"
  );
  const catalogHandle = /@catalog path \/catalog-release\.json \/channels\/v2\/catalog-release\.json[\s\S]*?handle @catalog \{[\s\S]*?reverse_proxy host\.docker\.internal:4173[\s\S]*?\}/;
  assert.match(caddy, catalogHandle);
  const allowedFiles = caddy.match(/@allowedFiles path ([^\r\n]+)/)?.[1] || "";
  assert.doesNotMatch(allowedFiles, /catalog-release\.json/);
  assert.match(
    compose,
    /release-server:[\s\S]*?depends_on:[\s\S]*?admin:[\s\S]*?condition: service_healthy/
  );
  assert.match(
    compose,
    /release-server:[\s\S]*?healthcheck:[\s\S]*?catalog-release\.json/
  );
});
