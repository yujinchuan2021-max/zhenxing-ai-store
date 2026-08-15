"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const productionOverlay = fs.readFileSync(
  path.join(root, "deployment", "community-production", "compose.workflow-production.yaml"),
  "utf8"
);
const {
  productionFlagState
} = require("../deployment/community-production/workflow-production-existing-state.cjs");

const FLAGS = Object.freeze([
  "AIHUB_RESOURCE_SUBMISSIONS_ENABLED",
  "AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION",
  "AIHUB_WORKFLOW_STORE_ENABLED",
  "AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED",
  "AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED",
  "AIHUB_WORKFLOW_STORE_SCHEMA_VERSION"
]);
const WORKFLOW_ONLY = Object.freeze(["0", "0", "1", "1", "0", "1"]);

function identityInspect(values) {
  return [{
    Config: {
      Env: FLAGS.map((key, index) => `${key}=${values[index]}`)
    }
  }];
}

test("r12 production overlay is the exact workflow-only profile", () => {
  for (const [index, key] of FLAGS.entries()) {
    assert.match(productionOverlay, new RegExp(`${key}: "${WORKFLOW_ONLY[index]}"`));
  }
  assert.doesNotMatch(productionOverlay, /AIHUB_RESOURCE_SUBMISSIONS_ENABLED: "1"/);
  assert.doesNotMatch(productionOverlay, /AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION: "1"/);
  assert.doesNotMatch(productionOverlay, /AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED: "1"/);
});

test("r12 accepts only exact disabled and workflow-only profiles; legacy all-one is explicit", () => {
  assert.equal(productionFlagState(identityInspect(["0", "0", "0", "0", "0", "0"])), "disabled");
  assert.equal(productionFlagState(identityInspect(WORKFLOW_ONLY)), "workflow-only");
  assert.equal(productionFlagState(identityInspect(["1", "1", "1", "1", "1", "1"])), "legacy-enabled");

  for (let index = 0; index < FLAGS.length; index += 1) {
    const halfOpen = [...WORKFLOW_ONLY];
    halfOpen[index] = halfOpen[index] === "0" ? "1" : "0";
    assert.throws(() => productionFlagState(identityInspect(halfOpen)), /existing Workflow state/i);
  }

  const missing = identityInspect(WORKFLOW_ONLY);
  missing[0].Config.Env.pop();
  assert.throws(() => productionFlagState(missing), /existing Workflow state/i);

  const duplicate = identityInspect(WORKFLOW_ONLY);
  duplicate[0].Config.Env.push(`${FLAGS[0]}=0`);
  assert.throws(() => productionFlagState(duplicate), /existing Workflow state/i);
});
