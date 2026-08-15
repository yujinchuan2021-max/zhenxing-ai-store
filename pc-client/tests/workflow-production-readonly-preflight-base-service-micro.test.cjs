"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const micro = require("../scripts/test-workflow-production-readonly-preflight-base-service-micro.cjs");

test("base-service micro contract freezes the DinD image and starts a strict A-to-F sequence", () => {
  assert.equal(micro.TEST_IMAGE, "aihub-workflow-release-prepare-test:ubuntu24-dind");
  assert.equal(micro.TEST_IMAGE_ID, "sha256:2f5e683c88da8f770a788cb9ab72e213d70cc7a2ae2c007e2b41ae8a99f4ed40");
  assert.deepEqual(micro.MICRO_STAGES.map((stage) => stage.id), ["A", "B", "C", "D", "E", "F"]);
  assert.equal(micro.MICRO_STAGES[0].service, "identity-database");
  assert.equal(micro.MICRO_STAGES[5].service, "identity-database");
});

test("base-service micro failure attribution is fixed, ordered, and never projects raw daemon text", () => {
  const cases = [
    ["error mounting /run/secrets/identity: OCI runtime create failed", "mount-secret"],
    ["operation not permitted while creating cgroup", "cgroup-security"],
    ["OCI runtime create failed", "oci-runtime"],
    ["opaque failure", "unknown"]
  ];
  for (const [stderr, expected] of cases) assert.equal(micro.classifyMicroFailure(stderr), expected);
  const report = micro.createMicroReport({
    status: "blocked",
    lastCompletedStage: "C",
    failureReason: "cgroup-security",
    service: null,
    cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0 }
  });
  assert.equal(micro.validateMicroReport(report), true);
  assert.doesNotMatch(JSON.stringify(report), /operation|opaque|secret|tmp/i);
});

test("base-service micro plan stops after the first failed stage", () => {
  const calls = [];
  const result = micro.runMicroPlan({
    runStage(stage) {
      calls.push(stage.id);
      return stage.id === "C" ? { ok: false, stderr: "operation not permitted" } : { ok: true, stderr: "" };
    }
  });
  assert.deepEqual(calls, ["A", "B", "C"]);
  assert.deepEqual(result, { status: "blocked", lastCompletedStage: "B", failureReason: "cgroup-security", service: null });
});

test("Windows-style writable bundle inputs are rejected until the exact staging child is normalized", () => {
  assert.equal(micro.isSafeLinuxTransferMode(0o664), false);
  assert.equal(micro.isSafeLinuxTransferMode(0o755), true);
  assert.equal(micro.normalizedLinuxTransferMode(true), 0o700);
  assert.equal(micro.normalizedLinuxTransferMode(false), 0o600);
  const source = fs.readFileSync(require.resolve("../scripts/test-workflow-production-readonly-preflight-base-service-micro.cjs"), "utf8");
  assert.match(source, /chown -R 1000:1000 \/opt\/zhenxing-ai\/staging\/\$\{releaseName\}\.bundle; find -P \/opt\/zhenxing-ai\/staging\/\$\{releaseName\}\.bundle -type d -exec chmod 700 \{\} \+; find -P \/opt\/zhenxing-ai\/staging\/\$\{releaseName\}\.bundle -type f -exec chmod 600 \{\} \+/);
});

test("setup failures retain fixed setup-stage evidence instead of null unknown", () => {
  const report = micro.createMicroReport({
    status: "blocked",
    lastCompletedStage: "transfer-normalized",
    failureReason: "setup-prepared-runtime",
    service: null,
    cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0 }
  });
  assert.equal(micro.validateMicroReport(report), true);
  assert.throws(() => micro.createMicroReport({
    ...report,
    lastCompletedStage: null,
    failureReason: "unknown"
  }), /setup/);
});
