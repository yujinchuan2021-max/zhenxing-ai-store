"use strict";

const assert = require("node:assert/strict");

const KEYS = Object.freeze([
  "schema", "status", "runId", "stage", "code", "stopCode",
  "serverConnected", "serverWritten", "assetWrites", "secretWrites",
  "catalogWrites", "databaseWrites", "servicesStarted", "productionExposed",
  "servicesHealthy", "servicesStoppedOnFailure", "sourcePosts", "events",
  "idempotency", "eventHead", "publicWorkflowCount", "resourceTablesAbsent",
  "secretValuesEmitted"
]);
const STAGES = new Set([
  "prepared-context", "secret-authority", "image-supply-chain", "catalog-install",
  "database-start", "identity-migration", "community-migration", "reviewer-provision",
  "service-start", "official-bootstrap", "target-verification", "launcher"
]);
const CODES = new Set([
  "R16_INITIALIZE_LAUNCH_FAILED", "R16_PREPARED_CONTEXT_INVALID",
  "R16_LAUNCHER_FAILED", "R16_TERMINAL_INVALID"
]);

function validateFreshHostTerminal(value, commandCode) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.deepEqual(Object.keys(value), KEYS);
  assert.equal(value.schema, "aihub-workflow-production-fresh-host-terminal-v1");
  assert.equal(value.runId, "workflow-production-r25");
  assert.equal(value.serverConnected, true);
  assert.equal(value.serverWritten, true);
  assert.equal(value.secretValuesEmitted, false);
  for (const key of ["assetWrites", "secretWrites", "catalogWrites", "databaseWrites", "servicesStarted", "productionExposed", "servicesStoppedOnFailure"]) {
    assert.equal(typeof value[key], "boolean");
  }
  assert.equal(Number.isSafeInteger(commandCode), true);

  if (commandCode === 0) {
    assert.equal(value.status, "pass");
    assert.equal(value.stage, null);
    assert.equal(value.code, null);
    assert.equal(value.stopCode, null);
    for (const key of ["assetWrites", "secretWrites", "catalogWrites", "databaseWrites", "servicesStarted", "productionExposed", "resourceTablesAbsent"]) assert.equal(value[key], true);
    assert.equal(value.servicesStoppedOnFailure, false);
    assert.equal(value.servicesHealthy, 6);
    assert.equal(value.sourcePosts, 3);
    assert.equal(value.events, 9);
    assert.equal(value.idempotency, 9);
    assert.equal(value.eventHead, 9);
    assert.equal(value.publicWorkflowCount, 3);
  } else {
    assert.equal(value.status, "failed");
    assert.equal(STAGES.has(value.stage), true);
    assert.equal(CODES.has(value.code), true);
    assert.equal(value.stopCode === null || value.stopCode === "R16_STOP_FAILED", true);
    assert.equal(value.servicesHealthy, 0);
    for (const key of ["sourcePosts", "events", "idempotency", "eventHead", "publicWorkflowCount", "resourceTablesAbsent"]) assert.equal(value[key], null);
    if (value.servicesStarted) assert.equal(value.servicesStoppedOnFailure || value.stopCode === "R16_STOP_FAILED", true);
    assert.equal(value.productionExposed, false);
  }
  assert.equal(Buffer.byteLength(JSON.stringify(value)) <= 2048, true);
  return Object.freeze({ ...value });
}

module.exports = { validateFreshHostTerminal };
