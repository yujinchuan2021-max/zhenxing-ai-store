"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const driverPath = path.join(__dirname, "..", "scripts", "test-workflow-production-r12-single-stack.cjs");
const innerPath = path.join(__dirname, "..", "scripts", "workflow-production-r12-single-stack-inner.cjs");
const {
  OFFICIAL_IMAGES,
  exportOfficialImages,
  isOfficialImageExportFailureStage,
  officialImageExportFailureStage
} = require("../scripts/workflow-production-r12-official-image-export.cjs");

function successfulDocker(calls, failure) {
  return (args) => {
    calls.push(args);
    const image = OFFICIAL_IMAGES.find((entry) => entry.ref === args.at(-1));
    const operation = args[0] === "image" ? args[1] : args[0];
    if (failure && image?.name === failure.name && operation === failure.operation) return { status: 1 };
    return { status: 0 };
  };
}

function regularFile() { return { isFile: () => true }; }

test("r12 official image export gives each fixed inspect, save, and archive failure its own safe stage", () => {
  for (const image of OFFICIAL_IMAGES) {
    for (const operation of ["inspect", "save"]) {
      const calls = [];
      assert.throws(
        () => exportOfficialImages({ docker: successfulDocker(calls, { name: image.name, operation }), archiveDirectory: "/runner-owned", statSync: regularFile }),
        (error) => error?.stage === `official-image-export-${image.name}-${operation}`
      );
      assert.equal(isOfficialImageExportFailureStage(`official-image-export-${image.name}-${operation}`), true);
    }
    assert.throws(
      () => exportOfficialImages({ docker: successfulDocker([], null), archiveDirectory: "/runner-owned", statSync: (filename) => { if (filename.endsWith(`${image.name}.tar`)) throw new Error("unavailable"); return regularFile(); } }),
      (error) => error?.stage === `official-image-export-${image.name}-archive`
    );
    assert.throws(
      () => exportOfficialImages({ docker: successfulDocker([], null), archiveDirectory: "/runner-owned", statSync: (filename) => filename.endsWith(`${image.name}.tar`) ? ({ isFile: () => false }) : regularFile() }),
      (error) => error?.stage === `official-image-export-${image.name}-archive`
    );
  }
});

test("r12 official image export keeps the production docker argv fixed and returns no raw values", () => {
  const calls = [];
  assert.equal(exportOfficialImages({ docker: successfulDocker(calls, null), archiveDirectory: "/runner-owned", statSync: regularFile }), undefined);
  assert.deepEqual(calls, OFFICIAL_IMAGES.flatMap((image) => [
    ["image", "inspect", image.ref],
    ["save", "--output", path.join("/runner-owned", `${image.name}.tar`), image.ref]
  ]));
});

test("r12 driver projects only a fixed official image export failure stage", () => {
  assert.equal(officialImageExportFailureStage("official-image-export-caddy-save", "official-image-export"), "official-image-export-caddy-save");
  assert.equal(officialImageExportFailureStage("official-image-export-caddy-unknown", "official-image-export"), "official-image-export");
});

test("r12 production-shaped runner has one fixed project and no destructive cleanup shortcut", () => {
  const driver = fs.readFileSync(driverPath, "utf8");
  const inner = fs.readFileSync(innerPath, "utf8");
  assert.match(driver, /workflow-production-r12-15620c86-20260810\.bundle/);
  assert.match(driver, /--cgroupns=private/);
  assert.match(driver, /aihub-workflow-release-prepare-test:ubuntu24-dind/);
  assert.match(inner, /PROJECT = "zhenxing-community-production"/);
  assert.equal((inner.match(/zhenxing-community-production/g) || []).length >= 1, true);
  assert.doesNotMatch(`${driver}\n${inner}`, /down --volumes|docker system prune|--cgroupns=host|\/sys\/fs\/cgroup.*:rw/);
  assert.doesNotMatch(inner, /resource_submission(?:s|_idempotency|_audit|_source_revisions|_abuse_reports).*CREATE/i);
});

test("r12 production-shaped runner uses same-release coordinator and all fixed failure boundaries", () => {
  const inner = fs.readFileSync(innerPath, "utf8");
  assert.match(inner, /workflow-production-r12-prepared-coordinator\.cjs/);
  assert.match(inner, /createR12PreparedCoordinator/);
  for (const operation of [
    "recreate:admin", "recreate:identity", "activate:active7", "verify:workflow-migrate",
    "verify:workflow-reviewer-provision", "verify:workflow-official-bootstrap", "target-verification"
  ]) assert.match(inner, new RegExp(operation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(inner, /--pull", "never/);
  assert.match(inner, /untouchedContainerIdsExact/);
  assert.match(inner, /resourceTablesAbsent/);
  assert.match(inner, /bootstrapReplayZero/);
  assert.match(inner, /secretValueHits/);
  assert.match(inner, /projectCount/);
});
