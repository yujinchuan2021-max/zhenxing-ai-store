"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  nodeVersionSatisfiesPlan,
  selectCompatibleNodeRuntime
} = require("../shared/node-runtime-policy.cjs");

const openClawPlan = {
  minimumNodeMajor: 22,
  supportedNodeRanges: [
    { minimum: "22.22.3", maximumExclusive: "23.0.0" },
    { minimum: "24.15.0", maximumExclusive: "25.0.0" },
    { minimum: "25.9.0", maximumExclusive: "26.0.0" }
  ]
};

test("OpenClaw rejects Node 25.2.1 and accepts the reviewed Node 24 runtime", () => {
  assert.equal(nodeVersionSatisfiesPlan("25.2.1", openClawPlan), false);
  assert.equal(nodeVersionSatisfiesPlan("24.18.0", openClawPlan), true);
  assert.equal(nodeVersionSatisfiesPlan("22.22.2", openClawPlan), false);
  assert.equal(nodeVersionSatisfiesPlan("25.9.0", openClawPlan), true);

  assert.deepEqual(
    selectCompatibleNodeRuntime(
      [
        { nodeVersion: "25.2.1", nodeExecutable: "C:\\Program Files\\nodejs\\node.exe" },
        { nodeVersion: "24.18.0", nodeExecutable: "D:\\DevTools\\Node24\\node.exe" }
      ],
      openClawPlan
    ),
    {
      nodeVersion: "24.18.0",
      nodeExecutable: "D:\\DevTools\\Node24\\node.exe"
    }
  );
});

test("generic CLI plans keep their minimum-major compatibility rule", () => {
  assert.equal(nodeVersionSatisfiesPlan("20.0.0", { minimumNodeMajor: 20 }), true);
  assert.equal(nodeVersionSatisfiesPlan("18.20.8", { minimumNodeMajor: 20 }), false);
  assert.equal(nodeVersionSatisfiesPlan("not-a-version", { minimumNodeMajor: 20 }), false);
});
