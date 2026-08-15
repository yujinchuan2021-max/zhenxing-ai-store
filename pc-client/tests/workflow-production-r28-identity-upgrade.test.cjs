"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "workflow-production-r28-identity-upgrade.sh"), "utf8");

test("r28 upgrades only Identity after verified backup and keeps an automatic rollback", () => {
  assert.match(source, /OLD_RELEASE='\/opt\/zhenxing-ai\/releases\/community-production-r25-0967aaaf'/);
  assert.match(source, /NEW_RELEASE='\/opt\/zhenxing-ai\/releases\/community-production-r28-d9fa8de8'/);
  assert.match(source, /OLD_IMAGE_ID='sha256:92e2cfb/);
  assert.match(source, /NEW_IMAGE_ID='sha256:981fcf8/);
  assert.ok(source.indexOf("stage='backup'") < source.indexOf("stage='restore-drill'"));
  assert.ok(source.indexOf("stage='restore-drill'") < source.indexOf("stage='migration-verify'"));
  assert.ok(source.indexOf("stage='migration-verify'") < source.indexOf("stage='switch'"));
  assert.match(source, /compose_new up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180 identity/);
  assert.match(source, /if \[\[ "\$switched" == 1 \]\] && rollback_identity/);
  assert.match(source, /same_other_services/);
  assert.match(source, /software-update-release\.json/);
  assert.match(source, /https:\/\/community\.zhenxingai\.com\//);
  assert.doesNotMatch(source, /community\.zhenxingai\.com\/health/);
  assert.match(source, /run-workflow-production-migration\.sh[^\n]* verify/);
  assert.match(source, /\[\[ "\$\(workflow_counts\)" == '9\|9\|9\|0' \]\]/);
  assert.doesNotMatch(source, /down\b|--volumes|system prune|docker prune|rm -rf|compose_new up[^\n]*(admin|caddy|community)/);
});
