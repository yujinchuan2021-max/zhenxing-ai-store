"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const launcher = require("./workflow-production-readonly-preflight.cjs");
const { verifyWorkflowProductionReleaseBundle } = require("../deployment/community-production/workflow-production-release-bundle.cjs");

const FIXTURE = path.join(root, "output", "workflow-reviewer-service-independent-cutover-harness.cjs");
const FIXTURE_SHA256 = "735323909315316dc8d0ec913d641cbad509bf48099d4b4e411cea3a2f18c1e1";
const PRIOR_DEPLOYMENT = path.join(root, "output", "community-production-124e-ready-20260809.bundle", "payload", "deployment", "community-production");
const EXPECTED_SET = "36e2fe4f945a3d2728b21a663053fba834269a163b7e23d807fd9ddf5a28de0e";
const EXPECTED_MANIFEST = "d5ad7b9b455dd0d169e58ed6a8fefe0d87c0d2e6cd0a7a47c3087151b2a307fe";
const EXPECTED_PAYLOAD = "546886ab4617f4d12875abc6785e7ec68f470a7868e64bdc83d625bc2895cbd2";
const INNER_REPORT_ROOT = "/workspace/output/workflow-production-readonly-phase2-inner";
const INNER_REPORT_PATH = `${INNER_REPORT_ROOT}/report.json`;
const TEST_IMAGE = "aihub-workflow-release-prepare-test:ubuntu24-dind";
const IMAGE_CONTRACTS = Object.freeze([
  { name: "candidate-identity", artifact: "identity-r11-image.tar", ref: "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e", id: "sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748" },
  { name: "rollback-identity", artifact: "identity-19a-rollback-image.tar", ref: "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392", id: "sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567" },
  { name: "active-admin", artifact: "admin-active7-image.tar", ref: "zhenxing-ai/admin:0.1.40-src-186ff057efd3", id: "sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd" },
  { name: "rollback-admin", artifact: "admin-old-b6ea4c5bd0e9.tar", ref: "zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9", id: "sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2" },
  { name: "flarum", artifact: "flarum-8b13962a36bf.tar", ref: "zhenxing-ai/flarum:community-candidate-8b13962a36bf", id: "sha256:6c32c21c9961e0dd35757c46be35ec2c8725f5b3537d4d0e7634c3a1cd11ba12" }
]);
const OFFICIAL_IMAGES = Object.freeze([
  { name: "postgres", ref: "postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193", archiveRef: "postgres:17-alpine", composeRef: "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193", id: "sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193" },
  { name: "mariadb", ref: "mariadb@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4", archiveRef: "mariadb:11.8", composeRef: "mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4", id: "sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4" },
  { name: "caddy", ref: "caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d", archiveRef: "caddy:2.10-alpine", composeRef: "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d", id: "sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d" }
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function readFrozenBaselineFixture() {
  assert.equal(sha256File(FIXTURE), FIXTURE_SHA256, "retained baseline fixture drifted");
  return fs.readFileSync(FIXTURE, "utf8");
}

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `${label} seam is missing`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `${label} seam is ambiguous`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function collectInnerTerminal({ execution, readReport }) {
  assert.ok(execution && Number.isInteger(execution.status) && typeof execution.stdout === "string");
  assert.equal(typeof readReport, "function");
  const report = readReport(INNER_REPORT_PATH);
  const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  const cleanupKeys = ["completed", "containers", "networks", "volumes", "privateRemoved", "backupRemoved"];
  if (!report || !["pass", "blocked", "partial"].includes(report.status) || !exact(report.cleanup, cleanupKeys) ||
      typeof report.cleanup.completed !== "boolean" || ["containers", "networks", "volumes"].some((key) => !Number.isInteger(report.cleanup[key]) || report.cleanup[key] < 0) ||
      typeof report.cleanup.privateRemoved !== "boolean" || typeof report.cleanup.backupRemoved !== "boolean" ||
      !exact(report.terminal, ["finalized", "exitCode"]) || report.terminal.finalized !== true || ![0, 1].includes(report.terminal.exitCode) ||
      (report.status === "pass") !== (report.terminal.exitCode === 0) || (execution.status === 0) !== (report.status === "pass")) {
    throw new Error("inner terminal report is invalid");
  }
  let failure;
  if (report.status === "pass") {
    if (report.checks?.phase2Failure !== undefined) throw new Error("inner terminal report is invalid");
  } else {
    failure = report.checks?.phase2Failure;
    launcher.validatePhase2FailureOutput(JSON.stringify({
      schema: launcher.PHASE2_FAILURE_SCHEMA,
      receipt: launcher.PHASE2_RECEIPT,
      status: "blocked",
      failure
    }));
  }
  let outer = null;
  const lines = execution.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (execution.status === 0) {
    assert.equal(lines.length, 1, "successful inner execution must emit one terminal envelope");
    outer = JSON.parse(lines[0]);
    assert.deepEqual(Object.keys(outer).sort(), ["ok", "result"]);
    assert.equal(outer.ok, true);
    assert.equal(outer.result?.reportPath, INNER_REPORT_PATH);
  }
  return {
    outer,
    projection: {
      stage: "retained-phase2",
      substage: failure ? failure.stage : "inner-terminal-pass",
      status: report.status,
      finalized: true,
      exitCode: report.terminal.exitCode,
      ...(failure ? { failure } : {}),
      cleanup: Object.fromEntries(cleanupKeys.map((key) => [key, report.cleanup[key]]))
    }
  };
}

const PROVISIONAL_REPORT_SCHEMA = "aihub-workflow-production-readonly-phase2-fixture-provisional-v1";
const FINAL_REPORT_SCHEMA = "aihub-workflow-production-readonly-phase2-fixture-v1";
const INNER_REPORT_FAILURES = Object.freeze({
  missing: "INNER_REPORT_MISSING",
  unreadable: "INNER_REPORT_UNREADABLE"
});
const INNER_REPORT_CLASS_FAILURES = Object.freeze({
  "json-invalid": "INNER_REPORT_JSON_INVALID",
  "harness-contract-invalid": "INNER_REPORT_HARNESS_CONTRACT_INVALID",
  "blocked-before-phase2": "PHASE2_FIXTURE_BLOCKED_BEFORE_PHASE2",
  "valid-phase2-blocked": "PHASE2_FIXTURE_BLOCKED",
  "execution-mismatch": "INNER_REPORT_EXECUTION_MISMATCH"
});
const PHASE2_FIXTURE_MILESTONES = Object.freeze([
  "harness-entered",
  "supply-chain-ready",
  "fixture-inputs-ready",
  "compose-contract-ready",
  "base-services-started",
  "identity-migration-ready",
  "flarum-migration-ready",
  "workflow-migration-applied",
  "workflow-migration-verified",
  "reviewer-provision-returned",
  "base-provision-ready",
  "ca-trust-ready",
  "old-disabled-baseline-ready",
  "retained-seed-ready",
  "active6-restored",
  "old-images-restored",
  "retained-state-verified",
  "retained-catalog-verified",
  "retained-baseline-ready",
  "pre-phase2-snapshot-ready",
  "phase2-process-returned",
  "phase2-failure-envelope-valid",
  "phase2-success-envelope-valid",
  "post-phase2-snapshot-unchanged",
  "drift-rejection-complete"
]);
const BASE_START_REASONS = Object.freeze([
  "port-conflict",
  "mount-secret",
  "image-platform",
  "name-network",
  "oci-runtime",
  "resource-storage",
  "daemon",
  "unknown"
]);
const BASE_SERVICE_STATES = Object.freeze(["absent", "created", "running", "exited", "dead"]);
const BASE_SERVICE_HEALTH = Object.freeze(["none", "starting", "healthy", "unhealthy"]);

function classifyBaseStartFailure(stderr) {
  const value = String(stderr || "").toLowerCase();
  if (/port is already allocated|address already in use|bind for .* failed/.test(value)) return "port-conflict";
  if (/mount|secret|bind source path|permission denied/.test(value)) return "mount-secret";
  if (/no matching manifest|platform|image .* not found|pull access denied/.test(value)) return "image-platform";
  if (/network .* not found|name .* conflict|container name .* already in use/.test(value)) return "name-network";
  if (/oci runtime|runc|containerd-shim|exec format/.test(value)) return "oci-runtime";
  if (/no space left|disk quota|out of memory|resource temporarily unavailable|storage/.test(value)) return "resource-storage";
  if (/docker daemon|cannot connect|connection refused|daemon/.test(value)) return "daemon";
  return "unknown";
}

function exactObject(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function validateExecutionTerminal(value) {
  if (!exactObject(value, ["state", "exitCode"]) ||
      !["completed", "timeout", "spawn-failed"].includes(value.state) ||
      (value.state === "completed" ? ![0, 1].includes(value.exitCode) : value.exitCode !== null)) {
    throw new Error("Phase2 execution terminal is invalid");
  }
  return true;
}

function validateBaseServiceStart(value) {
  if (!exactObject(value, ["reason", "services"]) || !BASE_START_REASONS.includes(value.reason) ||
      (value.services !== null && (!exactObject(value.services, ["identityDatabase", "communityDatabase", "admin"]) ||
        Object.values(value.services).some((service) => !exactObject(service, ["state", "health"]) ||
          !BASE_SERVICE_STATES.includes(service.state) || !BASE_SERVICE_HEALTH.includes(service.health))))) {
    throw new Error("base service start diagnostics are invalid");
  }
  return true;
}

function normalizeExecutionTerminal(execution) {
  if (execution && Number.isInteger(execution.status)) {
    return Object.freeze({ state: "completed", exitCode: execution.status === 0 ? 0 : 1 });
  }
  if (execution?.error?.code === "ETIMEDOUT" || (execution?.status === null && execution?.signal)) {
    return Object.freeze({ state: "timeout", exitCode: null });
  }
  return Object.freeze({ state: "spawn-failed", exitCode: null });
}

function validateHarnessReport(report) {
  const cleanupKeys = ["completed", "containers", "networks", "volumes", "privateRemoved", "backupRemoved"];
  if (!report || !["pass", "blocked", "partial"].includes(report.status) || !exactObject(report.checks, Object.keys(report.checks || {})) ||
      !exactObject(report.cleanup, cleanupKeys) || typeof report.cleanup.completed !== "boolean" ||
      ["containers", "networks", "volumes"].some((key) => !Number.isInteger(report.cleanup[key]) || report.cleanup[key] < 0) ||
      typeof report.cleanup.privateRemoved !== "boolean" || typeof report.cleanup.backupRemoved !== "boolean" ||
      report.cleanup.completed !== (["containers", "networks", "volumes"].every((key) => report.cleanup[key] === 0) && report.cleanup.privateRemoved && report.cleanup.backupRemoved) ||
      !exactObject(report.terminal, ["finalized", "exitCode"]) || report.terminal.finalized !== true || ![0, 1].includes(report.terminal.exitCode) ||
      (report.status === "pass") !== (report.terminal.exitCode === 0)) {
    throw new Error("inner harness report is invalid");
  }
  if (report.status === "blocked" && (!exactObject(report.failure, ["name", "message"]) || typeof report.failure.name !== "string" || typeof report.failure.message !== "string")) {
    throw new Error("inner harness report is invalid");
  }
  if (report.status === "pass" && Object.hasOwn(report, "failure")) throw new Error("inner harness report is invalid");
  if (report.status === "partial" && Object.hasOwn(report, "failure") &&
      (!exactObject(report.failure, ["name", "message"]) || typeof report.failure.name !== "string" || typeof report.failure.message !== "string")) {
    throw new Error("inner harness report is invalid");
  }
  const milestone = report.checks.phase2FixtureMilestone;
  if (!PHASE2_FIXTURE_MILESTONES.includes(milestone)) throw new Error("inner harness report is invalid");
  const baseServiceStart = report.checks.baseServiceStart;
  if (baseServiceStart !== undefined) {
    if (milestone !== "compose-contract-ready") throw new Error("inner harness report is invalid");
    validateBaseServiceStart(baseServiceStart);
  }
  return { milestone, baseServiceStart };
}

function classifiedEvidence(executionTerminal, innerReportClass, milestone, extra = {}) {
  return {
    executionTerminal,
    innerReportState: "valid",
    innerReportClass,
    ...(milestone ? { lastCompletedMilestone: milestone } : {}),
    ...extra
  };
}

function collectInnerEvidence({ execution, readReport }) {
  assert.equal(typeof readReport, "function");
  const executionTerminal = normalizeExecutionTerminal(execution);
  let raw;
  try {
    raw = readReport(INNER_REPORT_PATH);
  } catch (error) {
    return {
      executionTerminal,
      innerReportState: error?.code === "ENOENT" ? "missing" : "unreadable"
    };
  }
  if (typeof raw !== "string") return classifiedEvidence(executionTerminal, "json-invalid");
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    return classifiedEvidence(executionTerminal, "json-invalid");
  }
  let harness;
  try {
    harness = validateHarnessReport(report);
  } catch {
    const knownMilestone = PHASE2_FIXTURE_MILESTONES.includes(report?.checks?.phase2FixtureMilestone) ? report.checks.phase2FixtureMilestone : undefined;
    return classifiedEvidence(executionTerminal, "harness-contract-invalid", knownMilestone);
  }
  const { milestone, baseServiceStart } = harness;
  if (executionTerminal.state !== "completed" || executionTerminal.exitCode !== report.terminal.exitCode) {
    return classifiedEvidence(executionTerminal, "execution-mismatch", milestone);
  }
  const normalizedExecution = { ...execution, status: executionTerminal.exitCode, stdout: typeof execution?.stdout === "string" ? execution.stdout : "" };
  if (report.status === "pass") {
    if (milestone !== "drift-rejection-complete" || report.checks.phase2Failure !== undefined) {
      return classifiedEvidence(executionTerminal, "harness-contract-invalid", milestone);
    }
    try {
      const collected = collectInnerTerminal({ execution: normalizedExecution, readReport: () => report });
      return {
        executionTerminal,
        innerReportState: "valid",
        lastCompletedMilestone: milestone,
        outer: collected.outer,
        innerTerminal: collected.projection
      };
    } catch {
      return classifiedEvidence(executionTerminal, "harness-contract-invalid", milestone);
    }
  }
  if (report.checks.phase2Failure === undefined) {
    const processReturned = PHASE2_FIXTURE_MILESTONES.indexOf("phase2-process-returned");
    const milestoneIndex = milestone === undefined ? -1 : PHASE2_FIXTURE_MILESTONES.indexOf(milestone);
    return classifiedEvidence(executionTerminal, milestoneIndex < processReturned ? "blocked-before-phase2" : "harness-contract-invalid", milestone,
      baseServiceStart === undefined ? {} : { baseServiceStart });
  }
  if (milestone !== "phase2-failure-envelope-valid") {
    return classifiedEvidence(executionTerminal, "harness-contract-invalid", milestone);
  }
  try {
    const collected = collectInnerTerminal({ execution: normalizedExecution, readReport: () => report });
    return classifiedEvidence(executionTerminal, "valid-phase2-blocked", milestone, {
      outer: collected.outer,
      innerTerminal: collected.projection
    });
  } catch {
    return classifiedEvidence(executionTerminal, "harness-contract-invalid", milestone);
  }
}

function createProvisionalReport(executionTerminal) {
  validateExecutionTerminal(executionTerminal);
  return {
    schema: PROVISIONAL_REPORT_SCHEMA,
    candidateOnly: true,
    deployable: false,
    status: "blocked",
    failure: { stage: "retained-phase2", code: "INNER_REPORT_PENDING" },
    executionTerminal,
    terminal: { finalized: false }
  };
}

function validateProvisionalReport(report) {
  if (!exactObject(report, ["schema", "candidateOnly", "deployable", "status", "failure", "executionTerminal", "terminal"]) ||
      report.schema !== PROVISIONAL_REPORT_SCHEMA || report.candidateOnly !== true || report.deployable !== false || report.status !== "blocked" ||
      !exactObject(report.failure, ["stage", "code"]) || report.failure.stage !== "retained-phase2" || report.failure.code !== "INNER_REPORT_PENDING" ||
      !exactObject(report.terminal, ["finalized"]) || report.terminal.finalized !== false) {
    throw new Error("Phase2 provisional report is invalid");
  }
  validateExecutionTerminal(report.executionTerminal);
  return true;
}

function validateCleanup(value) {
  if (!exactObject(value, ["completed", "containers", "networks", "volumes", "privateRoots"]) ||
      typeof value.completed !== "boolean" || ["containers", "networks", "volumes", "privateRoots"].some((key) => !Number.isInteger(value[key]) || value[key] < 0) ||
      value.completed !== (["containers", "networks", "volumes", "privateRoots"].every((key) => value[key] === 0))) {
    throw new Error("Phase2 cleanup report is invalid");
  }
  return true;
}

function expectedEvidenceFailure(evidence) {
  if (evidence.innerReportClass) return INNER_REPORT_CLASS_FAILURES[evidence.innerReportClass];
  return INNER_REPORT_FAILURES[evidence.innerReportState] || "PHASE2_FIXTURE_BLOCKED";
}

function evidenceKeys(evidence) {
  return [
    "executionTerminal",
    "innerReportState",
    ...(evidence?.innerReportClass ? ["innerReportClass"] : []),
    ...(evidence?.lastCompletedMilestone ? ["lastCompletedMilestone"] : []),
    ...(evidence?.baseServiceStart !== undefined ? ["baseServiceStart"] : []),
    ...(evidence?.innerTerminal ? ["outer", "innerTerminal"] : [])
  ];
}

function createEvidenceFinalReport({ evidence, failureCode, cleanup }) {
  const cleanupFailure = failureCode === "CLEANUP_FAILED" && cleanup?.completed === false;
  if (!exactObject(evidence, evidenceKeys(evidence)) || !["valid", "missing", "unreadable"].includes(evidence.innerReportState) ||
      (evidence.innerReportClass && !Object.hasOwn(INNER_REPORT_CLASS_FAILURES, evidence.innerReportClass)) ||
      (!cleanupFailure && expectedEvidenceFailure(evidence) !== failureCode)) {
    throw new Error("Phase2 evidence report is invalid");
  }
  validateExecutionTerminal(evidence.executionTerminal);
  validateCleanup(cleanup);
  if (evidence.baseServiceStart !== undefined) {
    validateBaseServiceStart(evidence.baseServiceStart);
    if (evidence.innerReportClass !== "blocked-before-phase2" || evidence.lastCompletedMilestone !== "compose-contract-ready") {
      throw new Error("Phase2 evidence report is invalid");
    }
  }
  if (evidence.innerReportState === "valid" && !evidence.innerReportClass && !evidence.innerTerminal) throw new Error("Phase2 evidence report is invalid");
  if ((evidence.innerReportClass === "valid-phase2-blocked") !== Boolean(evidence.innerTerminal && evidence.innerReportClass)) throw new Error("Phase2 evidence report is invalid");
  const report = {
    schema: FINAL_REPORT_SCHEMA,
    candidateOnly: true,
    deployable: false,
    status: cleanup.completed ? "blocked" : "partial",
    failure: { stage: "retained-phase2", code: failureCode },
    executionTerminal: evidence.executionTerminal,
    innerReportState: evidence.innerReportState,
    ...(evidence.innerReportClass ? { innerReportClass: evidence.innerReportClass } : {}),
    ...(evidence.lastCompletedMilestone ? { lastCompletedMilestone: evidence.lastCompletedMilestone } : {}),
    ...(evidence.baseServiceStart !== undefined ? { baseServiceStart: evidence.baseServiceStart } : {}),
    ...(evidence.innerTerminal ? { innerTerminal: evidence.innerTerminal } : {}),
    cleanup,
    residue: {
      docker: cleanup.containers || cleanup.networks || cleanup.volumes ? 1 : 0,
      files: cleanup.privateRoots ? 1 : 0
    },
    terminal: { finalized: true }
  };
  validateEvidenceFinalReport(report);
  return report;
}

function validateEvidenceFinalReport(report) {
  const hasInner = Object.hasOwn(report || {}, "innerTerminal");
  const hasClass = Object.hasOwn(report || {}, "innerReportClass");
  const hasMilestone = Object.hasOwn(report || {}, "lastCompletedMilestone");
  const hasBaseServiceStart = Object.hasOwn(report || {}, "baseServiceStart");
  const keys = ["schema", "candidateOnly", "deployable", "status", "failure", "executionTerminal", "innerReportState", ...(hasClass ? ["innerReportClass"] : []), ...(hasMilestone ? ["lastCompletedMilestone"] : []), ...(hasBaseServiceStart ? ["baseServiceStart"] : []), ...(hasInner ? ["innerTerminal"] : []), "cleanup", "residue", "terminal"];
  if (!exactObject(report, keys) || report.schema !== FINAL_REPORT_SCHEMA || report.candidateOnly !== true || report.deployable !== false ||
      !["blocked", "partial"].includes(report.status) || !exactObject(report.failure, ["stage", "code"]) || report.failure.stage !== "retained-phase2" ||
      !["valid", "missing", "unreadable"].includes(report.innerReportState) ||
      (hasClass && !Object.hasOwn(INNER_REPORT_CLASS_FAILURES, report.innerReportClass)) ||
      (hasMilestone && !PHASE2_FIXTURE_MILESTONES.includes(report.lastCompletedMilestone)) ||
      (report.innerReportState !== "valid" && (hasClass || hasMilestone || hasInner)) ||
      (report.innerReportState === "valid" && !hasClass && !hasInner) ||
      (report.innerReportClass === "valid-phase2-blocked") !== (hasInner && hasClass) ||
      (hasInner && ((report.innerReportClass === "valid-phase2-blocked") !== (report.innerTerminal?.status !== "pass"))) ||
      (report.failure.code !== expectedEvidenceFailure(report) && !(report.failure.code === "CLEANUP_FAILED" && report.cleanup?.completed === false)) ||
      !exactObject(report.residue, ["docker", "files"]) || ![0, 1].includes(report.residue.docker) || ![0, 1].includes(report.residue.files) ||
      !exactObject(report.terminal, ["finalized"]) || report.terminal.finalized !== true) {
    throw new Error("Phase2 evidence report is invalid");
  }
  validateExecutionTerminal(report.executionTerminal);
  validateCleanup(report.cleanup);
  if (hasBaseServiceStart) {
    validateBaseServiceStart(report.baseServiceStart);
    if (report.innerReportClass !== "blocked-before-phase2" || report.lastCompletedMilestone !== "compose-contract-ready") {
      throw new Error("Phase2 evidence report is invalid");
    }
  }
  if ((report.status === "blocked") !== report.cleanup.completed ||
      report.residue.docker !== (report.cleanup.containers || report.cleanup.networks || report.cleanup.volumes ? 1 : 0) ||
      report.residue.files !== (report.cleanup.privateRoots ? 1 : 0)) {
    throw new Error("Phase2 evidence report is invalid");
  }
  if (hasInner) {
    const innerHasFailure = Object.hasOwn(report.innerTerminal, "failure");
    const innerKeys = ["stage", "substage", "status", "finalized", "exitCode", ...(innerHasFailure ? ["failure"] : []), "cleanup"];
    if (!exactObject(report.innerTerminal, innerKeys) || report.innerTerminal.stage !== "retained-phase2" || report.innerTerminal.finalized !== true ||
        !["pass", "blocked", "partial"].includes(report.innerTerminal.status) || ![0, 1].includes(report.innerTerminal.exitCode) ||
        (report.innerTerminal.status === "pass") !== (report.innerTerminal.exitCode === 0) ||
        (report.innerTerminal.status === "pass" ? innerHasFailure || report.innerTerminal.substage !== "inner-terminal-pass" : !innerHasFailure || report.innerTerminal.substage !== report.innerTerminal.failure.stage)) {
      throw new Error("Phase2 evidence report is invalid");
    }
    collectInnerTerminal({
      execution: { status: report.executionTerminal.exitCode, stdout: "", stderr: "" },
      readReport: () => ({
        status: report.innerTerminal.status,
        checks: report.innerTerminal.failure ? { phase2Failure: report.innerTerminal.failure } : {},
        cleanup: report.innerTerminal.cleanup,
        terminal: { finalized: report.innerTerminal.finalized, exitCode: report.innerTerminal.exitCode }
      })
    });
  }
  return true;
}

function validatePreExecutionFinalReport(report) {
  if (!exactObject(report, ["schema", "candidateOnly", "deployable", "status", "failure", "cleanup", "residue", "terminal"]) ||
      report.schema !== FINAL_REPORT_SCHEMA || report.candidateOnly !== true || report.deployable !== false || !["blocked", "partial"].includes(report.status) ||
      !exactObject(report.failure, ["stage", "code"]) || !["preflight", "generate", "official-archives", "dind-start", "prepare", "images", "retained-phase2"].includes(report.failure.stage) || report.failure.code !== "PHASE2_FIXTURE_BLOCKED" ||
      !exactObject(report.residue, ["docker", "files"]) || ![0, 1].includes(report.residue.docker) || ![0, 1].includes(report.residue.files) ||
      !exactObject(report.terminal, ["finalized"]) || report.terminal.finalized !== true) {
    throw new Error("Phase2 pre-execution report is invalid");
  }
  validateCleanup(report.cleanup);
  if ((report.status === "blocked") !== report.cleanup.completed ||
      report.residue.docker !== (report.cleanup.containers || report.cleanup.networks || report.cleanup.volumes ? 1 : 0) ||
      report.residue.files !== (report.cleanup.privateRoots ? 1 : 0)) {
    throw new Error("Phase2 pre-execution report is invalid");
  }
  return true;
}

function atomicWriteReport(reportPath, report) {
  if (report.schema === PROVISIONAL_REPORT_SCHEMA) validateProvisionalReport(report);
  else if (report.status === "pass") validateFinalReport(report);
  else if (Object.hasOwn(report, "executionTerminal")) validateEvidenceFinalReport(report);
  else validatePreExecutionFinalReport(report);
  const temporary = `${reportPath}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, reportPath);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function captureInnerEvidence({ execution, reportPath, readReport }) {
  const executionTerminal = normalizeExecutionTerminal(execution);
  atomicWriteReport(reportPath, createProvisionalReport(executionTerminal));
  return collectInnerEvidence({ execution, readReport });
}

function createInnerFixtureSource({ fixtureSource, phase2Program, preparedReleaseRoot, workspaceRoot }) {
  assert.equal(typeof fixtureSource, "string");
  assert.equal(phase2Program, launcher.createPhase2Program(), "Phase2 program must be the coordinator export");
  assert.match(preparedReleaseRoot, /^\/opt\/zhenxing-ai\/releases\/community-production-r11-[A-Za-z0-9][A-Za-z0-9-]{5,64}$/);
  assert.equal(path.posix.isAbsolute(workspaceRoot), true);
  const phase2Sha256 = sha256(phase2Program);
  const preparedDeployment = path.posix.join(preparedReleaseRoot, "deployment", "community-production");
  const priorDeployment = path.posix.join(workspaceRoot, "prior-deployment");
  let source = fixtureSource;

  source = replaceOnce(source,
    '} = require(path.join(__dirname, "..", "deployment", "community-production", "workflow-production-release-bundle.cjs"));',
    `} = require(${JSON.stringify(path.posix.join(preparedDeployment, "workflow-production-release-bundle.cjs"))});`, "prepared bundle module");
  source = replaceOnce(source, 'const root = path.resolve(__dirname, "..");', `const root = ${JSON.stringify(workspaceRoot)};`, "workspace root");
  source = replaceOnce(source, '  const runRoot = path.join(root, "output", `workflow-reviewer-cutover-${scenario}-${stamp}-${suffix}`);', `  const runRoot = ${JSON.stringify(INNER_REPORT_ROOT)};`, "fixed inner report root");
  source = replaceOnce(source, 'const { atomicWrite, createReleaseStore } = require(path.join(root, "admin", "release-store.cjs"));', `const { atomicWrite, createReleaseStore } = require(${JSON.stringify(path.posix.join(preparedReleaseRoot, "admin", "release-store.cjs"))});`, "prepared release store");
  source = replaceOnce(source, 'const sourceDeployment = path.join(root, "deployment", "community-production");', `const preparedReleaseRoot = ${JSON.stringify(preparedReleaseRoot)};\nconst sourceDeployment = ${JSON.stringify(preparedDeployment)};`, "prepared deployment");
  source = replaceOnce(source, 'const priorReleaseDeployment = path.join(root, "output", "community-production-124e-ready-20260809.bundle", "payload", "deployment", "community-production");', `const priorReleaseDeployment = ${JSON.stringify(priorDeployment)};`, "prior deployment");
  source = replaceOnce(source, 'const identityImage = "zhenxing-ai/identity:workflow-readiness-candidate-4b8b12d20fcb";', 'const identityImage = "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e";', "candidate Identity tag");
  source = replaceOnce(source, 'const identityImageId = "sha256:95510c1d911b4d48efeab2e7463570ec2078ade6fca481b8632a6f94ee9dfb40";', 'const identityImageId = "sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748";', "candidate Identity ID");
  source = replaceOnce(source, 'const identitySource = "4b8b12d20fcb37037011ea019f9b75546119de8ba9dd7c8772021eaccceaa0b5";', 'const identitySource = "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7";', "candidate Identity source");
  source = replaceOnce(source,
    'const bash = process.env.AIHUB_BASH || "C:\\\\Program Files\\\\Git\\\\bin\\\\bash.exe";\nconst hostDocker = String(spawnSync("where.exe", ["docker"], { encoding: "utf8" }).stdout || "")\n  .split(/\\r?\\n/).find(Boolean)?.replaceAll("\\\\", "/");\nif (!hostDocker) throw new Error("Docker CLI is unavailable");',
    'const bash = "/bin/bash";\nconst hostDocker = "/usr/bin/docker";', "Linux tools");
  source = replaceOnce(source, 'function windowsPath(value) { return value.replaceAll("\\\\", "/"); }', 'function windowsPath(value) { return value; }', "Linux path");
  source = replaceOnce(source, 'function bashPath(value) {\n  const escaped = value.replaceAll("\'", "\'\\\\\'\'");\n  return must(run(bash, ["-lc", `cygpath -u \'${escaped}\'`]), "cygpath").stdout.trim();\n}', 'function bashPath(value) { return value; }', "Linux bash path");
  source = replaceOnce(source, 'const project = `wf19acutover${scenario}${suffix}`.toLowerCase().slice(0, 48);', 'const project = "zhenxing-community-production";', "production project");
  source = replaceOnce(source, '    prepareCutoverRelease(runRoot);', '    assert.equal(fs.realpathSync(path.resolve(deployment, "..", "..")), preparedReleaseRoot, "fixture must use the verified prepared release");', "prepared release reuse");
  source = replaceOnce(source, '    fs.copyFileSync(path.join(deployment, "compose.windows-acceptance.yaml"), windowsOverride);', '    writePrivate(windowsOverride, "services: {}\\n");', "Linux Compose override");
  source = source.replace(/    writePrivate\(portsOverride, `services:[\s\S]*?\n`\);/, '    writePrivate(portsOverride, `services:\n  identity-database:\n    healthcheck:\n      test: ${JSON.stringify(BASELINE_DATABASE_FINAL_TCP_HEALTHCHECK)}\n  admin:\n    ports: !override\n      - "127.0.0.1:${adminPort}:4173"\n  caddy:\n    ports: !override\n      - "127.0.0.1:80:80"\n      - "127.0.0.1:443:443"\n      - "127.0.0.1:4174:4174"\n`);');
  source = replaceOnce(source, '    writePrivate(caddyfile, fs.readFileSync(path.join(deployment, "Caddyfile"), "utf8"));', '    writePrivate(caddyfile, fs.readFileSync(path.join(deployment, "Caddyfile"), "utf8"));\n    fs.chmodSync(caddyfile, 0o644);', "Caddyfile mode");
  const wrapperStart = source.indexOf('    const wrapperDir = path.join(runRoot, "bin");');
  const wrapperEnd = source.indexOf('    const bashEnv = {', wrapperStart);
  assert.ok(wrapperStart > 0 && wrapperEnd > wrapperStart, "Docker wrapper seam is missing");
  source = `${source.slice(0, wrapperStart)}    const wrapperDir = path.join(runRoot, "bin");\n    fs.mkdirSync(wrapperDir, { mode: 0o755 });\n${source.slice(wrapperEnd)}`;
  source = replaceOnce(source, '      PATH: `${bashPath(wrapperDir)}:${process.env.PATH}`,\n      AIHUB_HOST_DOCKER_EXE: hostDocker,', '      PATH: process.env.PATH,', "Linux Docker path");
  source = replaceOnce(source, '    await prepareActive6CatalogFixture(path.join(root, "admin", "published"), adminPublished);', '    await prepareActive6CatalogFixture(path.join(root, "admin", "published"), adminPublished);\n    must(run("/usr/bin/chown", ["-R", "1000:1000", adminData, adminPublished]), "own Admin fixture roots");\n    fs.chmodSync(adminData, 0o755); fs.chmodSync(adminPublished, 0o755);', "Admin authority ownership");
  source = replaceOnce(source, '    const adminData = path.join(privateRoot, "admin-data");', '    fs.chmodSync(secrets, 0o700);\n    must(run("/usr/bin/chown", ["-R", "1000:1000", secrets]), "own secret authority");\n    const adminData = path.join(privateRoot, "admin-data");', "secret authority ownership");
  source = replaceOnce(source, '  try {\n    fs.mkdirSync(runRoot, { recursive: false, mode: 0o700 });', '  try {\n    report.checks.phase2FixtureMilestone="harness-entered";\n    fs.mkdirSync(runRoot, { recursive: false, mode: 0o700 });', "harness entry milestone");
  source = replaceOnce(source, '    report.checks.supplyChain = true;', '    report.checks.supplyChain = true;\n    report.checks.phase2FixtureMilestone="supply-chain-ready";', "supply-chain milestone");
  source = replaceOnce(source, '    ], { input: `${secretValues[8]}\\n` }), "seed Caddy derivative");', '    ], { input: `${secretValues[8]}\\n` }), "seed Caddy derivative");\n    report.checks.phase2FixtureMilestone="fixture-inputs-ready";', "fixture input milestone");
  source = replaceOnce(source, '    report.checks.baselineDatabaseFinalTcpReady = {\n      ...assertBaselineDatabaseFinalTcpReady(effectiveCompose),\n      composeFileCount: files.length\n    };', '    report.checks.baselineDatabaseFinalTcpReady = {\n      ...assertBaselineDatabaseFinalTcpReady(effectiveCompose),\n      composeFileCount: files.length\n    };\n    report.checks.phase2FixtureMilestone="compose-contract-ready";', "Compose contract milestone");
  source = replaceOnce(source, '    must(compose(["up", "-d", "identity-database", "community-database", "admin"]), "start base databases/Admin");', `    const classifyBaseStartFailure = ${classifyBaseStartFailure.toString()};
    const summarizeBaseServices = () => {
      try {
        const probe = compose(["ps", "--all", "--format", "json", "identity-database", "community-database", "admin"]);
        if (probe.status !== 0) return null;
        const rows = probe.stdout.trim() ? probe.stdout.trim().split(/\\r?\\n/).flatMap((line) => { const value = JSON.parse(line); return Array.isArray(value) ? value : [value]; }) : [];
        const services = { identityDatabase: { state: "absent", health: "none" }, communityDatabase: { state: "absent", health: "none" }, admin: { state: "absent", health: "none" } };
        const names = { "identity-database": "identityDatabase", "community-database": "communityDatabase", admin: "admin" };
        const seen = new Set();
        for (const row of rows) {
          const key = names[row.Service];
          if (!key || seen.has(key)) throw new Error("base service probe is invalid");
          const state = String(row.State || "").toLowerCase();
          const health = String(row.Health || "none").toLowerCase();
          if (!${JSON.stringify(BASE_SERVICE_STATES)}.includes(state) || !${JSON.stringify(BASE_SERVICE_HEALTH)}.includes(health)) throw new Error("base service probe is invalid");
          services[key] = { state, health };
          seen.add(key);
        }
        return services;
      } catch { return null; }
    };
    const baseStart=compose(["up", "-d", "identity-database", "community-database", "admin"]);
    if (baseStart.status !== 0) {
      report.checks.baseServiceStart = { reason: classifyBaseStartFailure(baseStart.stderr), services: summarizeBaseServices() };
      throw new Error("base services failed");
    }
    must(baseStart, "start base databases/Admin");
    report.checks.phase2FixtureMilestone="base-services-started";`, "base service diagnostic milestone");
  source = replaceOnce(source, '    must(compose(["--profile", "migration", "run", "--rm", "identity-migrate"]), "Identity migration");', '    must(compose(["--profile", "migration", "run", "--rm", "identity-migrate"]), "Identity migration");\n    report.checks.phase2FixtureMilestone="identity-migration-ready";', "Identity migration milestone");
  source = replaceOnce(source, '    must(compose(["--profile", "migration", "run", "--rm", "community-migrate"]), "Flarum migration");', '    must(compose(["--profile", "migration", "run", "--rm", "community-migrate"]), "Flarum migration");\n    report.checks.phase2FixtureMilestone="flarum-migration-ready";', "Flarum migration milestone");
  source = replaceOnce(source, '    must(compose(["--profile", "workflow-migration", "run", "--rm", "-e", "AIHUB_WORKFLOW_MIGRATION_MODE=apply", "workflow-migrate"]), "Workflow migration apply");', '    must(compose(["--profile", "workflow-migration", "run", "--rm", "-e", "AIHUB_WORKFLOW_MIGRATION_MODE=apply", "workflow-migrate"]), "Workflow migration apply");\n    report.checks.phase2FixtureMilestone="workflow-migration-applied";', "Workflow migration apply milestone");
  source = replaceOnce(source, '    must(compose(["--profile", "workflow-migration", "run", "--rm", "-e", "AIHUB_WORKFLOW_MIGRATION_MODE=verify", "workflow-migrate"]), "Workflow migration verify");', '    must(compose(["--profile", "workflow-migration", "run", "--rm", "-e", "AIHUB_WORKFLOW_MIGRATION_MODE=verify", "workflow-migrate"]), "Workflow migration verify");\n    report.checks.phase2FixtureMilestone="workflow-migration-verified";', "Workflow migration verify milestone");
  source = replaceOnce(source, '    assert.deepEqual(provisionMessages[0], {\n      phase: "ready",\n      identityCreated: true,\n      identityMigrationCreated: true,\n      workflowMigrationCreated: false\n    });', '    assert.deepEqual(provisionMessages[0], {\n      phase: "ready",\n      identityCreated: true,\n      identityMigrationCreated: true,\n      workflowMigrationCreated: false\n    });\n    report.checks.phase2FixtureMilestone="reviewer-provision-returned";', "reviewer provision milestone");
  source = replaceOnce(source, '    report.checks.baselineProvision = { identityMigrationCreated: true, reviewerCreated: true, workflowMigrationViaProfile: true };', '    report.checks.baselineProvision = { identityMigrationCreated: true, reviewerCreated: true, workflowMigrationViaProfile: true };\n    report.checks.phase2FixtureMilestone="base-provision-ready";', "base provision milestone");
  source = replaceOnce(source, '    report.checks.caddyLocalCaTrustReady = await prepareCaddyLocalCaTrust();', '    report.checks.caddyLocalCaTrustReady = await prepareCaddyLocalCaTrust();\n    const ca = must(docker(["run", "--rm", "--read-only", "--network", "none", "-v", `${caddyVolumes[0]}:/source:ro`, "--entrypoint", "cat", caddyImage, "/source/caddy/pki/authorities/local/root.crt"]), "read isolated Caddy CA").stdout;\n    fs.writeFileSync("/usr/local/share/ca-certificates/aihub-phase2-caddy.crt", ca, { mode: 0o644 });\n    must(run("/usr/sbin/update-ca-certificates", []), "trust isolated Caddy CA");\n    report.checks.phase2FixtureMilestone="ca-trust-ready";', "system CA trust");
  source = replaceOnce(source, '    report.checks.existingOnlineImages = { adminPrior: true, identityPrior: true };', '    report.checks.existingOnlineImages = { adminPrior: true, identityPrior: true };\n    report.checks.phase2FixtureMilestone="old-disabled-baseline-ready";', "old disabled baseline milestone");
  source = replaceOnce(source, '      ], { env: retainedSeedEnvironment, timeout: 300000 }), "seed retained baseline through fixed production one-shot");', '      ], { env: retainedSeedEnvironment, timeout: 300000 }), "seed retained baseline through fixed production one-shot");\n      report.checks.phase2FixtureMilestone="retained-seed-ready";', "retained seed milestone");
  source = replaceOnce(source, '      ]), "restore exact active6 after retained baseline seed");', '      ]), "restore exact active6 after retained baseline seed");\n      report.checks.phase2FixtureMilestone="active6-restored";', "active6 restore milestone");
  source = replaceOnce(source, '      assert.equal(retainedAdmin.Image, oldAdminImageId);', '      assert.equal(retainedAdmin.Image, oldAdminImageId);\n      report.checks.phase2FixtureMilestone="old-images-restored";', "old image milestone");
  source = replaceOnce(source, '      report.checks.disabledRetainedOfficialBootstrapBaseline = readDisabledRetainedOfficialBootstrapBaseline(\n        query,\n        retainedIdentity,\n        sourcePostReadback()\n      );', '      report.checks.disabledRetainedOfficialBootstrapBaseline = readDisabledRetainedOfficialBootstrapBaseline(\n        query,\n        retainedIdentity,\n        sourcePostReadback()\n      );\n      report.checks.phase2FixtureMilestone="retained-state-verified";', "retained state milestone");
  source = replaceOnce(source, '      report.checks.phase2FixtureMilestone="retained-state-verified";\n      await verifyFixtureCatalogState(adminPublished, ACTIVE6_FIXTURE);', '      report.checks.phase2FixtureMilestone="retained-state-verified";\n      await verifyFixtureCatalogState(adminPublished, ACTIVE6_FIXTURE);\n      report.checks.phase2FixtureMilestone="retained-catalog-verified";', "retained catalog milestone");

  const injectionStart = source.indexOf('    const relayCode = "const net=require(\'net\')');
  const catchStart = source.indexOf('  } catch (error) {', injectionStart);
  assert.ok(injectionStart > 0 && catchStart > injectionStart, "pre-cutover Phase2 insertion seam is missing");
  const phase2Block = `    assert.equal(baselineKind, "retained", "Phase2 production-shape fixture is retained-only");
    report.checks.phase2FixtureMilestone="retained-baseline-ready";
    const phase2Program = ${JSON.stringify(phase2Program)};
    const phase2ProgramSha256 = ${JSON.stringify(phase2Sha256)};
    const phase2FailureSchema = ${JSON.stringify(launcher.PHASE2_FAILURE_SCHEMA)};
    const phase2FailureReceipt = ${JSON.stringify(launcher.PHASE2_RECEIPT)};
    const phase2FailureContracts = ${JSON.stringify(launcher.PHASE2_FAILURES)};
    const readPhase2Failure = (result) => { const value=JSON.parse(result.stdout); const exact=(entry,keys)=>entry&&typeof entry==="object"&&!Array.isArray(entry)&&Object.keys(entry).length===keys.length&&keys.every((key)=>Object.hasOwn(entry,key)); if(!exact(value,["schema","receipt","status","failure"])||value.schema!==phase2FailureSchema||value.receipt!==phase2FailureReceipt||value.status!=="blocked"||!exact(value.failure,["stage","code"])||phase2FailureContracts[value.failure.stage]!==value.failure.code) throw new Error("Phase2 failure envelope is invalid"); return value.failure; };
    assert.equal(crypto.createHash("sha256").update(phase2Program).digest("hex"), phase2ProgramSha256);
    const treeDigest = (directories) => { const rows=[]; const visit=(entry,base)=>{ for(const child of fs.readdirSync(entry,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){ const file=path.join(entry,child.name); const relative=path.relative(base,file).replaceAll("\\\\","/"); const stat=fs.lstatSync(file); if(stat.isSymbolicLink()) throw new Error("fixture tree contains a symlink"); if(child.isDirectory()){ rows.push("D|"+relative+"|"+(stat.mode&0o777)); visit(file,base); } else if(child.isFile()){ rows.push("F|"+relative+"|"+stat.size+"|"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")); } else throw new Error("fixture tree contains an unsupported entry"); } }; for(const directory of directories) visit(directory,directory); return crypto.createHash("sha256").update(rows.sort().join("\\n")).digest("hex"); };
    const pgDigest = () => crypto.createHash("sha256").update(must(compose(["exec","-T","identity-database","pg_dump","-U","aihub","-d","aihub","--schema-only","--no-owner","--no-privileges"]),"read PostgreSQL schema").stdout + must(compose(["exec","-T","identity-database","pg_dump","-U","aihub","-d","aihub","--data-only","--inserts","--column-inserts","--no-owner","--no-privileges"]),"read PostgreSQL rows").stdout).digest("hex");
    const mariaDigest = () => crypto.createHash("sha256").update(must(compose(["exec","-T","community-database","sh","-ec",'exec mariadb-dump --skip-comments --compact --single-transaction --quick --order-by-primary -uroot -p"$(cat /run/secrets/forum_db_root_password)" aihub_forum']),"read MariaDB rows").stdout.replace(/^-- Dump completed.*$/gm,"")).digest("hex");
    const snapshot = () => ({ pg:pgDigest(), maria:mariaDigest(), trees:treeDigest([adminPublished,path.join(privateRoot,"community-config"),path.join(privateRoot,"community-storage"),path.join(privateRoot,"community-assets")]), events:Number(query("select count(*) from community_workflow.events")), idempotency:Number(query("select count(*) from community_workflow.idempotency")), head:Number(query("select last_sequence from community_workflow.event_head where singleton=true")) });
    const executePhase2 = () => run(process.execPath,["-",preparedReleaseRoot],{ input:phase2Program, env:{LC_ALL:"C",NODE_USE_SYSTEM_CA:"1"}, timeout:300000, maxBuffer:4*1024*1024 });
    const before = snapshot();
    report.checks.phase2FixtureMilestone="pre-phase2-snapshot-ready";
    const phase2 = executePhase2();
    report.checks.phase2FixtureMilestone="phase2-process-returned";
    if(phase2.status!==0){ const failure=readPhase2Failure(phase2); report.checks.phase2Failure=failure; report.checks.phase2FixtureMilestone="phase2-failure-envelope-valid"; throw new Error("exported Phase2 program blocked"); }
    must(phase2,"execute exported Phase2 program");
    const phase2Output = JSON.parse(phase2.stdout);
    report.checks.phase2FixtureMilestone="phase2-success-envelope-valid";
    const after = snapshot();
    assert.deepEqual(after,before,"Phase2 changed the retained baseline");
    report.checks.phase2FixtureMilestone="post-phase2-snapshot-unchanged";
    assert.deepEqual({events:before.events,idempotency:before.idempotency,head:before.head},{events:9,idempotency:9,head:9});
    assert.equal(query("update community_workflow.event_head set last_sequence=8 where singleton=true returning last_sequence"),"8");
    const driftBefore=snapshot();
    const drift=executePhase2();
    assert.notEqual(drift.status,0,"preexisting head drift must fail closed");
    const driftAfter=snapshot();
    assert.deepEqual(driftAfter,driftBefore,"failed Phase2 changed the drifted baseline");
    report.checks.phase2FixtureMilestone="drift-rejection-complete";
    report.checks.phase2Output=phase2Output;
    report.checks.phase2ProgramSha256=phase2ProgramSha256;
    report.checks.beforeAfterUnchanged=true;
    report.checks.preexistingDriftRejected=true;
    report.checks.phase2Writes=0;
    report.status="pass";
`;
  source = `${source.slice(0, injectionStart)}${phase2Block}${source.slice(catchStart)}`;
  const milestones = [...source.matchAll(/phase2FixtureMilestone\s*=\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(milestones, PHASE2_FIXTURE_MILESTONES, "generated Phase2 fixture milestones drifted");
  source = replaceOnce(source, '  return { kind, runRoot, reportPath };', '  return { kind, runRoot, reportPath, phase2Output: report.checks.phase2Output, phase2ProgramSha256: report.checks.phase2ProgramSha256, beforeAfterUnchanged: report.checks.beforeAfterUnchanged, preexistingDriftRejected: report.checks.preexistingDriftRejected };', "fixture result");
  source = replaceOnce(source, '  const requested = process.argv[2] || "both";', '  const requested = process.argv[2] || "retained-success";', "retained default");
  assert.equal(source.includes(phase2Sha256), true);
  assert.equal(source.split("function phase2RemoteMain(").length - 1, 1, "fixture must contain only the exported Phase2 program");
  assert.equal(source.includes("ensureOfficialSourcePosts"), false, "fixture must not call the mutating source-post seam");
  return source;
}

function validateFinalReport(report) {
  const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  const checkKeys = ["preparedRuntimeExact", "sourcePureGet", "retainedExact", "catalogExact", "capabilityDisabledExact", "publicFeatureDisabledExact", "serviceImagesExact", "mountsAndSecretsExact", "beforeAfterUnchanged", "preexistingDriftRejected"];
  if (!exact(report, ["schema", "candidateOnly", "deployable", "baseline", "phase2ProgramSha256", "checks", "mutations", "cleanup", "residue", "status"]) ||
      report.schema !== "aihub-workflow-production-readonly-phase2-fixture-v1" || report.candidateOnly !== true || report.deployable !== false ||
      report.baseline !== "disabled-retained-official-bootstrap" || !/^[0-9a-f]{64}$/.test(report.phase2ProgramSha256 || "") ||
      !exact(report.checks, checkKeys) || checkKeys.some((key) => report.checks[key] !== true) ||
      !exact(report.mutations, ["phase2Writes", "httpWrites", "eventDelta", "idempotencyDelta", "eventHeadDelta"]) || Object.values(report.mutations).some((value) => value !== 0) ||
      !exact(report.cleanup, ["completed", "containers", "networks", "volumes", "privateRoots"]) || report.cleanup.completed !== true || Object.entries(report.cleanup).some(([key, value]) => key !== "completed" && value !== 0) ||
      !exact(report.residue, ["docker", "files"]) || Object.values(report.residue).some((value) => value !== 0) || report.status !== "pass") {
    throw new Error("Phase2 fixture report is invalid");
  }
  return true;
}

function runRaw(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...options });
}

function run(command, args, options = {}) {
  const value = runRaw(command, args, options);
  if (value.error) throw value.error;
  return value;
}

function must(value, label) {
  assert.equal(value.status, 0, `${label}: ${String(value.stderr || value.stdout).slice(-4000)}`);
  return value;
}

function docker(args, options) { return run("docker", args, options); }

function inspectLocalAssets(bundleRoot) {
  const verified = verifyWorkflowProductionReleaseBundle(bundleRoot);
  const manifest = JSON.parse(fs.readFileSync(path.join(bundleRoot, ".aihub-workflow-release-bundle.json"), "utf8"));
  assert.equal(verified.deploymentSetDigest, EXPECTED_SET);
  assert.equal(verified.deploymentManifestSha256, EXPECTED_MANIFEST);
  assert.equal(verified.payloadDigest, EXPECTED_PAYLOAD);
  assert.equal(manifest.deployment.setDigest, verified.deploymentSetDigest);
  assert.equal(manifest.deployment.manifestSha256, verified.deploymentManifestSha256);
  assert.equal(manifest.payload.digest, verified.payloadDigest);
  assert.equal(sha256File(FIXTURE), FIXTURE_SHA256);
  for (const filename of ["compose.server.yaml", "compose.workflow-production.yaml", "workflow-production-emergency-disable.sh"]) {
    assert.equal(fs.statSync(path.join(PRIOR_DEPLOYMENT, filename)).isFile(), true, `prior ${filename} is missing`);
  }
  assert.equal(docker(["image", "inspect", TEST_IMAGE]).status, 0, "fixed DinD test image is unavailable");
  for (const image of OFFICIAL_IMAGES) {
    const inspected = JSON.parse(must(docker(["image", "inspect", image.ref]), `inspect ${image.name}`).stdout)[0];
    assert.equal(inspected.Id, image.id, `${image.name} image ID drifted`);
  }
  return manifest;
}

module.exports = {
  INNER_REPORT_PATH,
  atomicWriteReport,
  captureInnerEvidence,
  classifyBaseStartFailure,
  collectInnerEvidence,
  collectInnerTerminal,
  createEvidenceFinalReport,
  createInnerFixtureSource,
  inspectLocalAssets,
  normalizeExecutionTerminal,
  readFrozenBaselineFixture,
  sha256,
  validateEvidenceFinalReport,
  validateFinalReport,
  validateProvisionalReport
};

if (require.main === module) {
  (async () => {
    assert.equal(process.argv.length, 3, "exactly one bundle path is required");
    const bundleRoot = fs.realpathSync(path.resolve(process.argv[2]));
    const candidate = inspectLocalAssets(bundleRoot);
    const suffix = crypto.randomBytes(5).toString("hex");
    const releaseName = `community-production-r11-phase2-${suffix}`;
    const preparedReleaseRoot = `/opt/zhenxing-ai/releases/${releaseName}`;
    const container = `aihub-phase2-fixture-${suffix}`;
    const dockerVolume = `${container}-docker`;
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-phase2-fixture-"));
    const output = path.join(root, "output", `workflow-production-readonly-phase2-${suffix}`);
    const reportPath = path.join(output, "report.json");
    const generated = path.join(temporary, "phase2-fixture.cjs");
    const officialArchive = path.join(temporary, "official-images.tar");
    let stage = "preflight";
    let createdOutput = false;
    let started = false;
    let volumeCreated = false;
    let finalReport;
    let innerEvidence;
    let failureCode = "PHASE2_FIXTURE_BLOCKED";

    const inner = (script, options = {}) => docker(["exec", container, "/bin/bash", "-lc", script], options);
    const innerRaw = (script, options = {}) => runRaw("docker", ["exec", container, "/bin/bash", "-lc", script], options);
    const removeExact = (target) => {
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    };

    try {
      stage = "generate";
      const phase2Program = launcher.createPhase2Program();
      const generatedSource = createInnerFixtureSource({
        fixtureSource: readFrozenBaselineFixture(),
        phase2Program,
        preparedReleaseRoot,
        workspaceRoot: "/workspace"
      });
      fs.writeFileSync(generated, generatedSource, { encoding: "utf8", mode: 0o600 });
      must(run(process.execPath, ["--check", generated]), "check generated Phase2 fixture");
      fs.mkdirSync(output, { recursive: false, mode: 0o700 });
      createdOutput = true;

      stage = "official-archives";
      must(docker(["save", "-o", officialArchive, ...OFFICIAL_IMAGES.map((entry) => entry.archiveRef)]), "save fixed official images");
      assert.equal(fs.statSync(officialArchive).isFile(), true);

      stage = "dind-start";
      must(docker(["volume", "create", dockerVolume]), "create fixture Docker volume");
      volumeCreated = true;
      must(docker(["run", "-d", "--privileged", "--name", container, "--mount", `type=volume,src=${dockerVolume},dst=/var/lib/docker`, TEST_IMAGE, "dockerd", "--host=unix:///var/run/docker.sock", "--feature", "containerd-snapshotter=true"]), "start fixture DinD");
      started = true;
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline && docker(["exec", container, "docker", "info"]).status !== 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      must(docker(["exec", container, "docker", "info"]), "wait fixture DinD");

      stage = "prepare";
      must(inner("install -d -m 0755 -o 1000 -g 1000 /opt/zhenxing-ai/staging /opt/zhenxing-ai/releases /workspace /workspace/admin /workspace/output/community-production-finalwin-20260806134532173/admin-published/catalog-store"), "create fixture roots");
      must(docker(["cp", bundleRoot, `${container}:/opt/zhenxing-ai/staging/${releaseName}.bundle`]), "copy candidate bundle");
      must(inner(`chown -R 1000:1000 /opt/zhenxing-ai/staging/${releaseName}.bundle; find /opt/zhenxing-ai/staging/${releaseName}.bundle -type d -exec chmod 700 {} +; find /opt/zhenxing-ai/staging/${releaseName}.bundle -type f -exec chmod 600 {} +`), "apply transfer ownership");
      must(inner(`SUDO_UID=1000 SUDO_GID=1000 /bin/bash /opt/zhenxing-ai/staging/${releaseName}.bundle/payload/deployment/community-production/prepare-workflow-production-release.sh /opt/zhenxing-ai/staging/${releaseName}.bundle ${preparedReleaseRoot}`), "prepare fixed release");
      must(docker(["cp", PRIOR_DEPLOYMENT, `${container}:/workspace/prior-deployment`]), "copy prior deployment fixture");
      must(docker(["cp", path.join(root, "admin", "data"), `${container}:/workspace/admin/data`]), "copy Admin data fixture");
      must(docker(["cp", path.join(root, "admin", "published"), `${container}:/workspace/admin/published`]), "copy signed catalog fixture");
      must(docker(["cp", path.join(root, "output", "community-production-finalwin-20260806134532173", "admin-published", "catalog-store", "state.json"), `${container}:/workspace/output/community-production-finalwin-20260806134532173/admin-published/catalog-store/state.json`]), "copy active6 state fixture");
      must(docker(["cp", generated, `${container}:/workspace/phase2-fixture.cjs`]), "copy generated Phase2 fixture");
      must(docker(["cp", officialArchive, `${container}:/workspace/official-images.tar`]), "copy fixed official images");
      must(inner("chown -R 1000:1000 /workspace/admin /workspace/output /workspace/prior-deployment /workspace/phase2-fixture.cjs; chmod 0644 /workspace/phase2-fixture.cjs"), "own fixture inputs");

      stage = "images";
      must(inner("docker load -i /workspace/official-images.tar"), "load fixed official images");
      for (const contract of IMAGE_CONTRACTS) {
        must(inner(`docker load -i ${preparedReleaseRoot}/artifacts/${contract.artifact}`), `load ${contract.name}`);
        const inspect = JSON.parse(must(inner(`docker image inspect --format '{{json .}}' '${contract.ref}'`), `inspect ${contract.name}`).stdout);
        assert.equal(inspect.Id, contract.id, `${contract.name} image ID drifted`);
      }
      for (const contract of OFFICIAL_IMAGES) {
        const inspect = JSON.parse(must(inner(`docker image inspect --format '{{json .}}' '${contract.archiveRef}'`), `inspect ${contract.name} in DinD`).stdout);
        assert.equal(inspect.Id, contract.id, `${contract.name} DinD image ID drifted`);
        const probe = `aihub-phase2-${contract.name}-probe`;
        must(inner(`docker create --pull=never --name '${probe}' '${contract.composeRef}' >/dev/null && docker rm '${probe}' >/dev/null`), `resolve ${contract.name} pinned reference without pull`);
      }

      stage = "retained-phase2";
      const runtime = `${preparedReleaseRoot}/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`;
      const execution = innerRaw(`env -i LC_ALL=C PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin ${runtime} /workspace/phase2-fixture.cjs retained-success`, { timeout: 1_800_000 });
      innerEvidence = captureInnerEvidence({
        execution,
        reportPath,
        readReport: (fixedReportPath) => {
          const result = innerRaw(`if [ ! -e '${fixedReportPath}' ]; then exit 44; fi; if [ ! -f '${fixedReportPath}' ] || [ -L '${fixedReportPath}' ]; then exit 45; fi; cat '${fixedReportPath}'`);
          if (result.status === 44) { const error = new Error("inner report is missing"); error.code = "ENOENT"; throw error; }
          if (result.status !== 0) { const error = new Error("inner report is unreadable"); error.code = "EACCES"; throw error; }
          return result.stdout;
        }
      });
      failureCode = expectedEvidenceFailure(innerEvidence);
      assert.equal(innerEvidence.innerReportState, "valid", "inner terminal report is not valid");
      must(execution, "run retained production-shape Phase2 fixture");
      const outer = innerEvidence.outer;
      const innerResult = outer.result;
      assert.equal(innerResult.kind, "success");
      assert.equal(innerResult.beforeAfterUnchanged, true);
      assert.equal(innerResult.preexistingDriftRejected, true);
      assert.equal(innerResult.phase2ProgramSha256, sha256(launcher.createPhase2Program()));
      launcher.validatePhase2Output(JSON.stringify(innerResult.phase2Output), {
        deploymentSetDigest: candidate.deployment.setDigest,
        deploymentManifestSha256: candidate.deployment.manifestSha256,
        payloadDigest: candidate.payload.digest,
        identitySourceDigest: candidate.identity.sourceDigest
      });
      assert.equal(innerEvidence.innerTerminal.status, "pass");
      assert.equal(innerEvidence.innerTerminal.cleanup.completed, true);
      assert.equal(innerEvidence.innerTerminal.cleanup.containers, 0);
      assert.equal(innerEvidence.innerTerminal.cleanup.networks, 0);
      assert.equal(innerEvidence.innerTerminal.cleanup.volumes, 0);
      assert.equal(must(inner("docker ps -aq --filter label=com.docker.compose.project=zhenxing-community-production"), "inspect inner containers").stdout.trim(), "");
      assert.equal(must(inner("docker network ls -q --filter label=com.docker.compose.project=zhenxing-community-production"), "inspect inner networks").stdout.trim(), "");
      assert.equal(must(inner("docker volume ls -q"), "inspect inner volumes").stdout.trim(), "", "fixture left a DinD volume");

      finalReport = {
        schema: "aihub-workflow-production-readonly-phase2-fixture-v1",
        candidateOnly: true,
        deployable: false,
        baseline: "disabled-retained-official-bootstrap",
        phase2ProgramSha256: sha256(launcher.createPhase2Program()),
        checks: {
          preparedRuntimeExact: innerResult.phase2Output.prepared.runtimeExact,
          sourcePureGet: true,
          retainedExact: innerResult.phase2Output.retained.events === 9 && innerResult.phase2Output.retained.idempotency === 9 && innerResult.phase2Output.retained.eventHead === 9,
          catalogExact: innerResult.phase2Output.catalogV2SignedExact && innerResult.phase2Output.catalogV1SignedExact,
          capabilityDisabledExact: innerResult.phase2Output.capabilityDisabledExact,
          publicFeatureDisabledExact: innerResult.phase2Output.publicFeatureDisabledExact,
          serviceImagesExact: innerResult.phase2Output.launchBaselineExact,
          mountsAndSecretsExact: innerResult.phase2Output.secretConsumersExact && innerResult.phase2Output.caddyDerivedSecretExact,
          beforeAfterUnchanged: innerResult.beforeAfterUnchanged,
          preexistingDriftRejected: innerResult.preexistingDriftRejected
        },
        mutations: { phase2Writes: 0, httpWrites: 0, eventDelta: 0, idempotencyDelta: 0, eventHeadDelta: 0 },
        cleanup: { completed: false, containers: 0, networks: 0, volumes: 0, privateRoots: 0 },
        residue: { docker: 0, files: 0 },
        status: "pass"
      };
    } catch {
      process.exitCode = 1;
    } finally {
      let cleanupControlFailed = false;
      if (started && runRaw("docker", ["rm", "-f", container]).status !== 0) cleanupControlFailed = true;
      if (volumeCreated && runRaw("docker", ["volume", "rm", dockerVolume]).status !== 0) cleanupControlFailed = true;
      try { removeExact(temporary); } catch { cleanupControlFailed = true; }
      const containerResult = runRaw("docker", ["ps", "-aq", "--filter", `name=^/${container}$`]);
      const volumeResult = runRaw("docker", ["volume", "ls", "-q", "--filter", `name=^${dockerVolume}$`]);
      const containers = containerResult.status === 0 && !containerResult.error ? (containerResult.stdout.trim() ? 1 : 0) : 1;
      const volumes = volumeResult.status === 0 && !volumeResult.error ? (volumeResult.stdout.trim() ? 1 : 0) : 1;
      const privateRoots = fs.existsSync(temporary) ? 1 : 0;
      const clean = !cleanupControlFailed && containers === 0 && volumes === 0 && privateRoots === 0;
      const cleanup = { completed: clean, containers, networks: 0, volumes, privateRoots };
      if (finalReport?.status === "pass" && clean) {
        finalReport.cleanup = cleanup;
        finalReport.residue = { docker: 0, files: 0 };
      } else if (innerEvidence) {
        finalReport = createEvidenceFinalReport({
          evidence: innerEvidence,
          failureCode: clean ? failureCode : "CLEANUP_FAILED",
          cleanup
        });
      } else {
        finalReport = {
          schema: FINAL_REPORT_SCHEMA,
          candidateOnly: true,
          deployable: false,
          status: clean ? "blocked" : "partial",
          failure: { stage, code: "PHASE2_FIXTURE_BLOCKED" },
          cleanup,
          residue: { docker: containers || volumes ? 1 : 0, files: privateRoots ? 1 : 0 },
          terminal: { finalized: true }
        };
      }
      if (createdOutput) {
        atomicWriteReport(reportPath, finalReport);
      }
    }

    if (finalReport.status === "pass") validateFinalReport(finalReport);
    process.stdout.write(`${JSON.stringify({ status: finalReport.status, reportPath })}\n`);
  })().catch(() => {
    process.stderr.write("Phase2 fixture orchestration failed\n");
    process.exitCode = 1;
  });
}
