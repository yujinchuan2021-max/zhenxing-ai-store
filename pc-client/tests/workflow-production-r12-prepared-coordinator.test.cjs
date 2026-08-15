"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  R12,
  createR12PreparedCoordinator,
  validatePreparedExecutionContext,
  CONTAINERS,
  OLD_IMAGES,
  TARGET_IMAGES,
  validateImageInspect,
  validateRunningServiceImages,
  terminalReport
} = require("../deployment/community-production/workflow-production-r12-prepared-coordinator.cjs");
const { SERVICES, contractFor, validateProductionServices } = require("../deployment/community-production/workflow-production-service-contract.cjs");

const RELEASE = "/opt/zhenxing-ai/releases/community-production-r12-2a114734";
const RUNTIME = `${RELEASE}/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`;

function workflowReceipt(baseline) {
  return {
    schema: "present",
    appendOnly: true,
    events: 9,
    idempotency: 9,
    eventHead: 9,
    reviewerExact: 1,
    reviewerForbiddenRelations: 0,
    publisherExact: 1,
    publisherForbiddenRelations: 0,
    sourcePostsExact: 3,
    officialWorkflows: 3,
    idempotentReplay: true,
    baseline
  };
}

function baselineSnapshot() {
  return {
    projectName: R12.projectName,
    concurrentRuns: 0,
    services: R12.services.map((name) => ({ name, health: "healthy" })),
    flags: { profile: "disabled" },
    activeCatalog: {
      stateSha256: R12.active6.stateSha256,
      releaseId: R12.active6.releaseId,
      releaseSha256: R12.active6.releaseSha256,
      v1ReleaseId: R12.v1.releaseId,
      v1CatalogVersion: R12.v1.catalogVersion,
      v1ReleaseSha256: R12.v1.releaseSha256,
      v1CatalogSha256: R12.v1.catalogSha256
    },
    resourceSubmissionTables: [],
    preservedDataRoles: [...R12.preservedDataRoles],
    workflowStateInput: { database: {}, identityInspect: [], sourcePosts: {} }
  };
}

function targetSnapshot() {
  const common = baselineSnapshot();
  return {
    ...common,
    flags: { profile: "workflow-only" },
    activeCatalog: {
      stateSha256: R12.active7.stateSha256,
      releaseId: R12.active7.releaseId,
      releaseSha256: R12.active7.releaseSha256,
      v1ReleaseId: R12.v1.releaseId,
      v1CatalogVersion: R12.v1.catalogVersion,
      v1ReleaseSha256: R12.v1.releaseSha256,
      v1CatalogSha256: R12.v1.catalogSha256
    },
    workflowStateInput: { database: {}, identityInspect: [], sourcePosts: {} },
    publicWorkflowCount: 3
  };
}

function dependencies(overrides = {}) {
  const modes = [];
  const calls = [];
  const rollback = [];
  const sameRelease = {
    bundle: {
      verifyPreparedRelease(root) {
        assert.equal(root, RELEASE);
        return { verified: true, deploymentSetDigest: "a".repeat(64) };
      }
    },
    existing: {
      async verifyExistingWorkflowState({ mode }) {
        modes.push(mode);
        return workflowReceipt(mode === "baseline"
          ? "disabled-retained-official-bootstrap"
          : "workflow-only-retained-official-bootstrap");
      }
    },
  };
  return {
    modes,
    calls,
    rollback,
    values: {
      releaseRoot: RELEASE,
      execPath: RUNTIME,
      env: {},
      platform: "linux",
      realpath(value) { return value; },
      lstat(value) { return { isSymbolicLink: () => false, isDirectory: () => value === RELEASE }; },
      loadSameRelease(root) { assert.equal(root, RELEASE); return sameRelease; },
      collector: {
        async baseline() { return baselineSnapshot(); },
        async target() { return targetSnapshot(); }
      },
      runner: {
        async run(operation) { calls.push(operation); },
        async rollback() { rollback.push(true); }
      },
      ...overrides
    }
  };
}

function serviceInspect(profile) {
  const images = Object.fromEntries(contractFor(profile === "disabled" ? "baseline" : "target").map((service) => [service.key, service.image]));
  return Object.fromEntries(SERVICES.map(({ key: service, containerName: container, composeService }) => {
    const image = images[service];
    return [service, {
      Name: `/${container}`,
      Image: image.id || `sha256:${service.padEnd(64, "0").slice(0, 64)}`,
      Config: { Image: image.tag, User: image.user ?? "", Labels: { "com.docker.compose.project": R12.projectName, "com.docker.compose.service": composeService, ...(image.source ? { "com.aihub.source-content-sha256": image.source, "com.aihub.source-revision": image.revision } : {}), ...(image.release ? { "com.aihub.release-version": image.release } : {}) } },
      State: { Health: { Status: "healthy" } },
      Mounts: []
    }];
  }));
}

test("r12 prepared execution rejects caller paths, runtime fallback, and external baseline receipts before a command", () => {
  const { values, calls } = dependencies();
  assert.deepEqual(validatePreparedExecutionContext(values), { releaseRoot: RELEASE, runtime: RUNTIME });
  for (const mutated of [
    { ...values, releaseRoot: "/opt/zhenxing-ai/releases/community-production-r11-unsafe" },
    { ...values, execPath: "/usr/bin/node" },
    { ...values, env: { NODE_PATH: "/tmp" } },
    { ...values, env: { NODE_OPTIONS: "--require=x" } },
    { ...values, env: { NODE_EXTRA_CA_CERTS: "/tmp/unsafe" } },
    { ...values, lstat() { return { isSymbolicLink: () => true, isDirectory: () => true }; } }
  ]) {
    assert.throws(() => validatePreparedExecutionContext(mutated), /r12 prepared coordinator/i);
  }
  assert.deepEqual(calls, []);
});

test("r12 validates exact current container image/tag separately for baseline and target", () => {
  assert.equal(validateRunningServiceImages(serviceInspect("disabled"), "disabled"), true);
  assert.equal(validateRunningServiceImages(serviceInspect("workflow-only"), "workflow-only"), true);
  const baselineWithTargetIdentity = serviceInspect("disabled");
  baselineWithTargetIdentity.identity.Image = TARGET_IMAGES.identity.id;
  assert.throws(() => validateRunningServiceImages(baselineWithTargetIdentity, "disabled"), /r12 prepared coordinator/i);
  const targetWithOldAdmin = serviceInspect("workflow-only");
  targetWithOldAdmin.admin.Config.Image = OLD_IMAGES.admin.tag;
  assert.throws(() => validateRunningServiceImages(targetWithOldAdmin, "workflow-only"), /r12 prepared coordinator/i);
  for (const service of Object.keys(CONTAINERS)) {
    const drift = serviceInspect("disabled");
    drift[service].Config.Image = "malicious:image";
    assert.throws(() => validateRunningServiceImages(drift, "disabled"), /r12 prepared coordinator/i, service);
  }
  const camelCase = serviceInspect("disabled");
  camelCase.identityDatabase.Config.Labels["com.docker.compose.service"] = "identityDatabase";
  assert.throws(() => validateRunningServiceImages(camelCase, "disabled"), /r12 prepared coordinator/i);
  const flarumIdDrift = serviceInspect("disabled");
  flarumIdDrift.community.Image = `sha256:${"0".repeat(64)}`;
  assert.throws(() => validateRunningServiceImages(flarumIdDrift, "disabled"), /r12 prepared coordinator/i);
  const sourceDrift = serviceInspect("workflow-only");
  sourceDrift.identity.Config.Labels["com.aihub.source-revision"] = "0".repeat(64);
  assert.throws(() => validateRunningServiceImages(sourceDrift, "workflow-only"), /r12 prepared coordinator/i);
  const userDrift = serviceInspect("workflow-only");
  userDrift.admin.Config.User = "root";
  assert.throws(() => validateRunningServiceImages(userDrift, "workflow-only"), /r12 prepared coordinator/i);
  const releaseDrift = serviceInspect("disabled");
  releaseDrift.community.Config.Labels["com.aihub.release-version"] = "wrong";
  assert.throws(() => validateRunningServiceImages(releaseDrift, "disabled"), /r12 prepared coordinator/i);
  const image = { Id: TARGET_IMAGES.identity.id, RepoTags: [TARGET_IMAGES.identity.tag], Config: { User: "node", Labels: { "com.aihub.source-content-sha256": TARGET_IMAGES.identity.source, "com.aihub.source-revision": TARGET_IMAGES.identity.revision } } };
  assert.equal(validateImageInspect(image, TARGET_IMAGES.identity), true);
  image.Config.Labels["com.aihub.source-revision"] = "0".repeat(64);
  assert.throws(() => validateImageInspect(image, TARGET_IMAGES.identity), /r12 prepared coordinator/i);
});

test("the shared service contract is deeply frozen and ignores caller contract overrides", () => {
  const original = SERVICES[0].baseline.tag;
  assert.equal(Reflect.set(SERVICES[0].baseline, "tag", "evil:image"), false);
  assert.equal(SERVICES[0].baseline.tag, original);
  const fixture = serviceInspect("disabled");
  const fake = [{ key: "admin", baseline: { tag: "evil:image" }, target: { tag: "evil:image" } }];
  assert.equal(validateProductionServices(fixture, "baseline", fake, "evil-project"), true);
});

test("the service contract distinguishes source content from the immutable source revision", () => {
  const legacyRevision = "f90543d936397fbdfa8a370a9a0b62e7b3a3f0ce";
  const target = serviceInspect("workflow-only");
  target.admin.Config.Labels["com.aihub.source-revision"] = legacyRevision;
  target.community.Config.Labels["com.aihub.source-revision"] = legacyRevision;
  assert.equal(validateProductionServices(target, "target"), true);

  const baseline = serviceInspect("disabled");
  baseline.admin.Config.Labels["com.aihub.source-revision"] = legacyRevision;
  baseline.identity.Config.Labels["com.aihub.source-revision"] = legacyRevision;
  baseline.community.Config.Labels["com.aihub.source-revision"] = legacyRevision;
  assert.equal(validateProductionServices(baseline, "baseline"), true);

  target.admin.Config.Labels["com.aihub.source-content-sha256"] = "0".repeat(64);
  assert.throws(() => validateProductionServices(target, "target"), /production service contract/i);
});

test("r12 prepared coordinator directly verifies same-release baseline and target state without accepting external JSON receipts", async () => {
  const { values, modes, calls } = dependencies();
  const coordinator = createR12PreparedCoordinator(values);
  await assert.rejects(() => coordinator.run({ baseline: baselineSnapshot() }), /does not accept arguments/i);
  const result = await coordinator.run();
  assert.deepEqual(modes, ["baseline", "target"]);
  assert.deepEqual(calls, [
    "backup:verified",
    "recreate:admin",
    "recreate:identity",
    "activate:active7",
    "verify:workflow-migrate",
    "verify:workflow-reviewer-provision",
    "verify:workflow-official-bootstrap"
  ]);
  assert.deepEqual(result, {
    status: "pass",
    runId: R12.runId,
    projectName: R12.projectName,
    projectCount: 1,
    targetProfile: "workflow-only",
    publicWorkflowCount: 3,
    bootstrapReplayZero: true,
    requiredDataMutation: false
  });
});

test("r12 uses only fixed operations and preserves the original stage if rollback itself fails", async () => {
  const { values, calls, rollback } = dependencies({
    runner: {
      async run(operation) {
        calls.push(operation);
        if (operation === "recreate:identity") throw new Error("untrusted raw error");
      },
      async rollback() {
        rollback.push(true);
        throw new Error("untrusted rollback raw error");
      }
    }
  });
  const coordinator = createR12PreparedCoordinator(values);
  await assert.rejects(
    () => coordinator.run(),
    (error) => error?.failure?.stage === "recreate-identity" &&
      error.failure.code === "R12_STEP_FAILED" &&
      error.failure.rollbackCode === "R12_ROLLBACK_FAILED" &&
      !String(error.message).includes("raw")
  );
  assert.deepEqual(calls, ["backup:verified", "recreate:admin", "recreate:identity"]);
  assert.deepEqual(rollback, [true]);
});

test("r12 rejects forged baseline receipt, catalog, resource-table, or concurrency claims before mutation", async () => {
  const variants = [
    { ...baselineSnapshot(), workflowReceipt: workflowReceipt("disabled-retained-official-bootstrap") },
    { ...baselineSnapshot(), activeCatalog: { ...baselineSnapshot().activeCatalog, v1ReleaseSha256: "0".repeat(64) } },
    { ...baselineSnapshot(), resourceSubmissionTables: ["resource_submissions"] },
    { ...baselineSnapshot(), concurrentRuns: 1 }
  ];
  for (const value of variants) {
    const { values, calls } = dependencies({
      collector: {
        async baseline() { return value; },
        async target() { return targetSnapshot(); }
      }
    });
    await assert.rejects(() => createR12PreparedCoordinator(values).run(), /r12 (?:prepared coordinator|in-place preflight)/i);
    assert.deepEqual(calls, []);
  }
});

test("r12 keeps backup failure non-mutating and never accepts a caller-selected operation", async () => {
  const { values, calls, rollback } = dependencies({
    runner: {
      async run(operation) {
        calls.push(operation);
        if (operation === "backup:verified") throw new Error("untrusted backup error");
      },
      async rollback() { rollback.push(true); }
    }
  });
  await assert.rejects(
    () => createR12PreparedCoordinator(values).run(),
    (error) => error?.failure?.stage === "backup" && error.failure.code === "R12_STEP_FAILED" &&
      error.failure.rollbackCode === undefined
  );
  assert.deepEqual(calls, ["backup:verified"]);
  assert.deepEqual(rollback, []);
});

test("r12 rejects incomplete target evidence before reporting success", async () => {
  const { values, calls } = dependencies({
    collector: {
      async baseline() { return baselineSnapshot(); },
      async target() { return { ...targetSnapshot(), publicWorkflowCount: 2 }; }
    }
  });
  const coordinator = createR12PreparedCoordinator(values);
  await assert.rejects(
    () => coordinator.run(),
    (error) => error?.failure?.stage === "target-verification" && error.failure.code === "R12_STEP_FAILED"
  );
  assert.equal(calls.includes("verify:workflow-official-bootstrap"), true);
});

test("r12 rolls back every mutation boundary and keeps the original fixed stage when rollback also fails", async () => {
  for (const operation of [...R12.recreateServices.map((service) => `recreate:${service}`), "activate:active7", "verify:workflow-migrate", "verify:workflow-reviewer-provision", "verify:workflow-official-bootstrap"]) {
    const { values, rollback } = dependencies({
      runner: {
        async run(current) { if (current === operation) throw new Error("untrusted operation error"); },
        async rollback() { rollback.push(operation); }
      }
    });
    await assert.rejects(() => createR12PreparedCoordinator(values).run(), (error) =>
      error?.failure?.stage === ({ "recreate:admin": "recreate-admin", "recreate:identity": "recreate-identity", "activate:active7": "activation", "verify:workflow-migrate": "workflow-migration", "verify:workflow-reviewer-provision": "reviewer-provision", "verify:workflow-official-bootstrap": "official-bootstrap" })[operation] &&
      error.failure.code === "R12_STEP_FAILED" && error.failure.rollbackCode === undefined);
    assert.deepEqual(rollback, [operation]);
  }
  const { values } = dependencies({
    collector: { async baseline() { return baselineSnapshot(); }, async target() { throw new Error("untrusted target error"); } },
    runner: { async run() {}, async rollback() { throw new Error("untrusted rollback error"); } }
  });
  await assert.rejects(() => createR12PreparedCoordinator(values).run(), (error) =>
    error?.failure?.stage === "target-verification" && error.failure.code === "R12_STEP_FAILED" && error.failure.rollbackCode === "R12_ROLLBACK_FAILED");
});

test("r12 treats rollback command success without an exact disabled retained post-state as rollback failure", async () => {
  let baselines = 0;
  const { values } = dependencies({
    collector: {
      async baseline() {
        baselines += 1;
        return baselines === 1 ? baselineSnapshot() : { ...baselineSnapshot(), flags: { profile: "workflow-only" } };
      },
      async target() { return targetSnapshot(); }
    },
    runner: {
      async run(operation) { if (operation === "recreate:admin") throw new Error("raw"); },
      async rollback() {}
    }
  });
  await assert.rejects(() => createR12PreparedCoordinator(values).run(), (error) =>
    error?.failure?.stage === "recreate-admin" && error.failure.rollbackCode === "R12_ROLLBACK_FAILED");
  assert.equal(baselines, 2);
});

test("r12 coordinator emits an exact terminal record without raw exception text", () => {
  const error = new Error("secret=/untrusted/path");
  error.failure = Object.freeze({ stage: "activation", code: "R12_STEP_FAILED", rollbackCode: "R12_ROLLBACK_FAILED" });
  assert.deepEqual(terminalReport(undefined, error), {
    schema: "aihub-r12-terminal-v1",
    status: "blocked",
    runId: R12.runId,
    stage: "activation",
    code: "R12_STEP_FAILED",
    rollbackCode: "R12_ROLLBACK_FAILED"
  });
  assert.equal(JSON.stringify(terminalReport(undefined, error)).includes("secret="), false);
});
