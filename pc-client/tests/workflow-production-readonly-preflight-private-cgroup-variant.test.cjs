"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const variant = require("../scripts/test-workflow-production-readonly-preflight-private-cgroup-variant.cjs");

test("private cgroup variant has one private namespace and no host cgroup escape", () => {
  assert.deepEqual(variant.outerArgs("fixture"), ["run", "-d", "--privileged", "--cgroupns=private", "--name", "fixture"]);
  const source = fs.readFileSync(require.resolve("../scripts/test-workflow-production-readonly-preflight-private-cgroup-variant.cjs"), "utf8");
  assert.doesNotMatch(source, /--cgroupns=host|(?:--mount|-v)[^\n]*\/sys\/fs\/cgroup/);
  assert.match(source, /--pull=never/);
  assert.match(source, /require\.main === module/);
  assert.throws(() => variant.validateOuterCgroupInspect({ HostConfig: { CgroupnsMode: "host" } }), /namespace/);
  assert.equal(variant.validateOuterCgroupInspect({ HostConfig: { CgroupnsMode: "private" } }), true);
});

test("private cgroup variant fails before B for absent controller or unusable delegation", () => {
  const metadata = { effectiveNamespacePrivate: true, cgroupV2: true, controllers: { cpu: true, memory: true, pids: false }, subtreeControl: "enabled" };
  let calls = 0;
  const result = variant.runPrivatePlan({ metadata, runB() { calls += 1; return true; }, runC() { calls += 1; return true; } });
  assert.deepEqual(result, { status: "blocked", lastCompletedStage: null, failureReason: "cgroup-preflight" });
  assert.equal(calls, 0);
});

test("private cgroup variant stops at B and classifies C without running D through F", () => {
  const metadata = { effectiveNamespacePrivate: true, cgroupV2: true, controllers: { cpu: true, memory: true, pids: true }, subtreeControl: "enabled" };
  let b = 0;
  let c = 0;
  const bFailed = variant.runPrivatePlan({ metadata, runB() { b += 1; return false; }, runC() { c += 1; return true; } });
  assert.deepEqual(bFailed, { status: "blocked", lastCompletedStage: null, failureReason: "private-b" });
  assert.deepEqual([b, c], [1, 0]);
  const cFailed = variant.runPrivatePlan({ metadata, runB() { return true; }, runC() { return false; } });
  assert.deepEqual(cFailed, { status: "blocked", lastCompletedStage: "B", failureReason: "local-dind-incompatible" });
});

test("private B and C retain the exact production resource contract", () => {
  assert.deepEqual(variant.PRIVATE_B_ARGS, ["--network", "none", "--security-opt", "no-new-privileges:true"]);
  assert.deepEqual(variant.PRIVATE_C_ARGS, ["--network", "none", "--security-opt", "no-new-privileges:true", "--memory", "256m", "--cpus", "0.40", "--pids-limit", "192"]);
  assert.equal(variant.validateCandidateArgs(variant.PRIVATE_B_ARGS, variant.PRIVATE_C_ARGS), true);
  assert.throws(() => variant.validateCandidateArgs(variant.PRIVATE_B_ARGS, variant.PRIVATE_C_ARGS.slice(0, -2)), /resource/);
  assert.throws(() => variant.validateCandidateArgs(["--security-opt", "no-new-privileges:true"], variant.PRIVATE_C_ARGS), /network/);
  assert.throws(() => variant.validateCandidateArgs(["--network", "bridge", "--security-opt", "no-new-privileges:true"], variant.PRIVATE_C_ARGS), /network/);
  assert.throws(() => variant.validateCandidateArgs(["--network", "none", "--network", "none", "--security-opt", "no-new-privileges:true"], variant.PRIVATE_C_ARGS), /network/);
});

test("private cgroup report projects only fixed metadata and partial cleanup", () => {
  const report = variant.createVariantReport({
    status: "partial", lastCompletedStage: "B", failureReason: "local-dind-incompatible",
    metadata: { effectiveNamespacePrivate: true, cgroupV2: true, controllers: { cpu: true, memory: true, pids: true }, subtreeControl: "enabled" },
    cleanup: { completed: false, containers: 1, networks: 0, volumes: 0, privateRoots: 0 }
  });
  assert.equal(variant.validateVariantReport(report), true);
  assert.doesNotMatch(JSON.stringify(report), /raw|path|secret|sha256|container-id/i);
});
