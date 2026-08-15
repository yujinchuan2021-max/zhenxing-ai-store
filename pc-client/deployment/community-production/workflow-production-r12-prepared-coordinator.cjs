"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { SERVICES, validateProductionServices } = require("./workflow-production-service-contract.cjs");
const {
  adminImageArtifact,
  identityImageArtifact,
  oldAdminImageArtifact,
  rollbackIdentityImageArtifact
} = require("./workflow-production-release-bundle.cjs");
const {
  R12,
  createR12InPlacePlan,
  verifyTarget
} = require("./workflow-production-r12-in-place.cjs");

const RELEASE_PREFIX = "/opt/zhenxing-ai/releases/";
const RELEASE_NAME = /^community-production-r12-[A-Za-z0-9][A-Za-z0-9-]{5,64}$/;
const RUNTIME_RELATIVE = ".workflow-runtime/node-v24.18.1-linux-x64/bin/node";
const FIXED_OPERATIONS = Object.freeze([
  "backup:verified",
  "recreate:admin",
  "recreate:identity",
  "activate:active7",
  "verify:workflow-migrate",
  "verify:workflow-reviewer-provision",
  "verify:workflow-official-bootstrap"
]);
const FAILURE_CODES = Object.freeze({
  step: "R12_STEP_FAILED",
  rollback: "R12_ROLLBACK_FAILED",
  context: "R12_PREPARED_CONTEXT_INVALID"
});
const TERMINAL_SCHEMA = "aihub-r12-terminal-v1";
const TERMINAL_STAGES = Object.freeze(["prepared-context", "backup", "recreate-admin", "recreate-identity", "activation", "workflow-migration", "reviewer-provision", "official-bootstrap", "target-verification"]);
const TERMINAL_CODES = Object.freeze([FAILURE_CODES.step, FAILURE_CODES.rollback, FAILURE_CODES.context]);
const OLD_IMAGES = Object.freeze({
  admin: Object.freeze({ tag: oldAdminImageArtifact.image, id: oldAdminImageArtifact.imageId, source: oldAdminImageArtifact.sourceDigest, revision: oldAdminImageArtifact.sourceRevision, user: oldAdminImageArtifact.user }),
  identity: Object.freeze({ tag: rollbackIdentityImageArtifact.image, id: rollbackIdentityImageArtifact.imageId, source: rollbackIdentityImageArtifact.sourceDigest, revision: rollbackIdentityImageArtifact.sourceRevision, user: rollbackIdentityImageArtifact.user })
});
const TARGET_IMAGES = Object.freeze({
  admin: Object.freeze({ tag: adminImageArtifact.image, id: adminImageArtifact.imageId, source: adminImageArtifact.sourceDigest, revision: adminImageArtifact.sourceRevision, user: adminImageArtifact.user }),
  identity: Object.freeze({ tag: identityImageArtifact.image, id: identityImageArtifact.imageId, source: identityImageArtifact.sourceDigest, revision: identityImageArtifact.sourceRevision, user: identityImageArtifact.user })
});

function invalid(reason = "is invalid") {
  throw new Error(`r12 prepared coordinator ${reason}`);
}

function exactObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) invalid();
  return value;
}

function stageFor(operation) {
  return Object.freeze({
    "backup:verified": "backup",
    "recreate:admin": "recreate-admin",
    "recreate:identity": "recreate-identity",
    "activate:active7": "activation",
    "verify:workflow-migrate": "workflow-migration",
    "verify:workflow-reviewer-provision": "reviewer-provision",
    "verify:workflow-official-bootstrap": "official-bootstrap",
    "target-verification": "target-verification"
  })[operation] || invalid();
}

function fixedFailure(stage, code, rollbackCode) {
  const failure = { stage, code };
  if (rollbackCode !== undefined) failure.rollbackCode = rollbackCode;
  const error = new Error("r12 prepared coordinator blocked");
  error.failure = Object.freeze(failure);
  return error;
}

function terminalReport(result, error) {
  if (result !== undefined) {
    exactObject(result, ["status", "runId", "projectName", "projectCount", "targetProfile", "publicWorkflowCount", "bootstrapReplayZero", "requiredDataMutation"]);
    if (result.status !== "pass" || result.runId !== R12.runId) invalid();
    return Object.freeze({ schema: TERMINAL_SCHEMA, status: "pass", runId: R12.runId, stage: null, code: null, rollbackCode: null });
  }
  const failure = error?.failure || Object.freeze({ stage: "prepared-context", code: FAILURE_CODES.context });
  if (!exactObject(failure, Object.hasOwn(failure || {}, "rollbackCode") ? ["stage", "code", "rollbackCode"] : ["stage", "code"]) ||
      !TERMINAL_STAGES.includes(failure.stage) || !TERMINAL_CODES.includes(failure.code) ||
      (failure.rollbackCode !== undefined && failure.rollbackCode !== FAILURE_CODES.rollback)) invalid();
  return Object.freeze({ schema: TERMINAL_SCHEMA, status: "blocked", runId: R12.runId, stage: failure.stage, code: failure.code, rollbackCode: failure.rollbackCode || null });
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function validateImageInspect(value, contract) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.Id !== contract.id ||
      JSON.stringify(value.RepoTags) !== JSON.stringify([contract.tag]) ||
      !value.Config || typeof value.Config !== "object" || value.Config.User !== contract.user ||
      value.Config.Labels?.["com.aihub.source-content-sha256"] !== contract.source ||
      value.Config.Labels?.["com.aihub.source-revision"] !== contract.revision) invalid();
  return true;
}

function validateRunningServiceImages(inspectAll, profile) {
  try { return validateProductionServices(inspectAll, profile === "disabled" ? "baseline" : "target"); } catch { invalid(); }
}

function validatePreparedExecutionContext(options = {}) {
  exactObject(options, [
    "releaseRoot", "execPath", "env", "platform", "realpath", "lstat",
    "loadSameRelease", "collector", "runner"
  ]);
  if (options.platform !== "linux" || typeof options.releaseRoot !== "string" ||
      !options.releaseRoot.startsWith(RELEASE_PREFIX) ||
      !RELEASE_NAME.test(path.posix.basename(options.releaseRoot)) ||
      path.posix.dirname(options.releaseRoot) !== RELEASE_PREFIX.slice(0, -1) ||
      options.realpath(options.releaseRoot) !== options.releaseRoot) invalid();
  const stat = options.lstat(options.releaseRoot);
  if (!stat?.isDirectory?.() || stat.isSymbolicLink?.()) invalid();
  const runtime = path.posix.join(options.releaseRoot, RUNTIME_RELATIVE);
  if (options.execPath !== runtime || Object.keys(options.env).some((key) => key.startsWith("NODE_")) ||
      typeof options.loadSameRelease !== "function" || !options.collector || !options.runner) invalid();
  return Object.freeze({ releaseRoot: options.releaseRoot, runtime });
}

function assertCollectorSnapshot(snapshot, profile) {
  exactObject(snapshot, [
    "projectName", "concurrentRuns", "services", "flags", "activeCatalog",
    "resourceSubmissionTables", "preservedDataRoles", "workflowStateInput",
    ...(profile === "workflow-only" ? ["publicWorkflowCount"] : [])
  ]);
  if (snapshot.projectName !== R12.projectName || snapshot.concurrentRuns !== 0 ||
      snapshot.flags?.profile !== profile) invalid();
  exactObject(snapshot.workflowStateInput, ["database", "identityInspect", "sourcePosts"]);
  return snapshot;
}

function completedBaseline(snapshot, receipt) {
  const { workflowStateInput, ...baseline } = snapshot;
  return Object.freeze({ ...baseline, workflowReceipt: receipt });
}

function completedTarget(snapshot, receipt) {
  const { workflowStateInput, ...target } = snapshot;
  return Object.freeze({ ...target, workflowReceipt: receipt });
}

function createR12PreparedCoordinator(options = {}) {
  const context = validatePreparedExecutionContext(options);
  const modules = options.loadSameRelease(context.releaseRoot);
  if (!modules?.bundle || !modules?.existing ||
      typeof modules.bundle.verifyPreparedRelease !== "function" ||
      typeof modules.existing.verifyExistingWorkflowState !== "function" ||
      typeof options.collector.baseline !== "function" || typeof options.collector.target !== "function" ||
      typeof options.runner.run !== "function" || typeof options.runner.rollback !== "function") invalid();

  async function collect(mode) {
    const snapshot = assertCollectorSnapshot(await options.collector[mode](), mode === "baseline" ? "disabled" : "workflow-only");
    const workflowReceipt = await modules.existing.verifyExistingWorkflowState({
      ...snapshot.workflowStateInput,
      mode
    });
    return mode === "baseline"
      ? completedBaseline(snapshot, workflowReceipt)
      : completedTarget(snapshot, workflowReceipt);
  }

  return Object.freeze({
    async run(...args) {
      if (args.length !== 0) invalid("does not accept arguments");
      modules.bundle.verifyPreparedRelease(context.releaseRoot);
      const baseline = await collect("baseline");
      const plan = createR12InPlacePlan(baseline);
      let mutationStarted = false;
      let failureStage = "backup";
      try {
        for (const operation of FIXED_OPERATIONS) {
          failureStage = stageFor(operation);
          if (operation !== "backup:verified") mutationStarted = true;
          await options.runner.run(operation);
        }
        failureStage = "target-verification";
        const target = await collect("target");
        const replayFields = ["events", "idempotency", "eventHead", "sourcePostsExact", "officialWorkflows"];
        const bootstrapReplayZero = replayFields.every((field) => baseline.workflowReceipt[field] === target.workflowReceipt[field]);
        verifyTarget(Object.freeze({ ...target, bootstrapReplayZero }));
        return Object.freeze({
          status: "pass",
          runId: plan.runId,
          projectName: plan.projectName,
          projectCount: plan.projectCount,
          targetProfile: plan.targetProfile,
          publicWorkflowCount: 3,
          bootstrapReplayZero: true,
          requiredDataMutation: false
        });
      } catch {
        if (!mutationStarted) throw fixedFailure(failureStage, FAILURE_CODES.step);
        try {
          await options.runner.rollback(Object.freeze({
            activeReleaseId: R12.active6.releaseId,
            profile: "disabled",
            retained: { ...R12.retained },
            requiredDataMutation: false
          }));
          createR12InPlacePlan(await collect("baseline"));
        } catch {
          throw fixedFailure(failureStage, FAILURE_CODES.step, FAILURE_CODES.rollback);
        }
        throw fixedFailure(failureStage, FAILURE_CODES.step);
      }
    }
  });
}

function runtimeOptions() {
  const releaseRoot = path.resolve(__dirname, "..", "..");
  return {
    releaseRoot,
    execPath: process.execPath,
    env: process.env,
    platform: process.platform,
    realpath: fs.realpathSync,
    lstat: fs.lstatSync,
    loadSameRelease(root) {
      const local = (relative) => {
        const candidate = path.join(root, relative);
        const resolved = require.resolve(candidate);
        if (!resolved.startsWith(`${root}${path.sep}`) || fs.realpathSync(resolved) !== resolved) invalid();
        return require(resolved);
      };
      return {
        bundle: local("deployment/community-production/workflow-production-release-bundle.cjs"),
        existing: local("deployment/community-production/workflow-production-existing-state.cjs"),
        collector: local("deployment/community-production/workflow-production-r12-fixed-collector.cjs"),
        runner: local("deployment/community-production/workflow-production-r12-fixed-runner.cjs")
      };
    },
    get collector() { return this.loadSameRelease(this.releaseRoot).collector.createR12FixedCollector({ releaseRoot: this.releaseRoot }); },
    get runner() { return this.loadSameRelease(this.releaseRoot).runner.createRuntimeR12FixedRunner(this.releaseRoot); }
  };
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 0) invalid();
  try {
    const result = await createR12PreparedCoordinator(runtimeOptions()).run();
    process.stdout.write(`${JSON.stringify(terminalReport(result))}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(terminalReport(undefined, error))}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main().catch(() => { process.exitCode = 1; });

module.exports = {
  R12,
  FAILURE_CODES,
  FIXED_OPERATIONS,
  CONTAINERS: Object.freeze(Object.fromEntries(SERVICES.map((service) => [service.key, service.containerName]))),
  OLD_IMAGES,
  TARGET_IMAGES,
  validateImageInspect,
  validateRunningServiceImages,
  validatePreparedExecutionContext,
  createR12PreparedCoordinator,
  terminalReport
};
