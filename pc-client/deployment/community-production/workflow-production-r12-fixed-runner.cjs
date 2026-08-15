"use strict";

const childProcess = require("node:child_process");
const path = require("node:path");

const RELEASE_PREFIX = "/opt/zhenxing-ai/releases/";
const RELEASE_NAME = /^community-production-r12-[A-Za-z0-9][A-Za-z0-9-]{5,64}$/;
const FIXED_OPERATIONS = Object.freeze([
  "backup:verified",
  "recreate:admin",
  "recreate:identity",
  "activate:active7",
  "verify:workflow-migrate",
  "verify:workflow-reviewer-provision",
  "verify:workflow-official-bootstrap"
]);
const R12_CONTROL = Object.freeze({
  runId: "workflow-production-r12",
  project: "zhenxing-community-production",
  root: "/opt/zhenxing-ai/shared/workflow-production-r12",
  evidenceRoot: "/opt/zhenxing-ai/shared/backups/workflow-production-r12-evidence"
});
const SAFE_ENV = Object.freeze({ PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LC_ALL: "C" });

function blocked() { throw new Error("r12 fixed runner is invalid"); }

function validateReleaseRoot(releaseRoot) {
  if (typeof releaseRoot !== "string" || !releaseRoot.startsWith(RELEASE_PREFIX) ||
      path.posix.dirname(releaseRoot) !== RELEASE_PREFIX.slice(0, -1) ||
      !RELEASE_NAME.test(path.posix.basename(releaseRoot))) blocked();
  return releaseRoot;
}

function fixedOperationCommand(releaseRoot, operation) {
  validateReleaseRoot(releaseRoot);
  if (![...FIXED_OPERATIONS, "rollback"].includes(operation)) blocked();
  return Object.freeze({
    file: "/bin/bash",
    args: Object.freeze([`${releaseRoot}/deployment/community-production/workflow-production-r12-executor.sh`, operation])
  });
}

function defaultExecFile(file, args, options) {
  return childProcess.spawnSync(file, args, { ...options, encoding: "utf8" });
}

function createR12FixedRunner(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options) ||
      JSON.stringify(Object.keys(options).sort()) !== JSON.stringify(["execFile", "releaseRoot"].sort()) ||
      typeof options.execFile !== "function") blocked();
  const releaseRoot = validateReleaseRoot(options.releaseRoot);
  const execute = async (operation) => {
    const command = fixedOperationCommand(releaseRoot, operation);
    const result = await options.execFile(command.file, command.args, Object.freeze({ shell: false, env: SAFE_ENV, maxBuffer: 64 * 1024 }));
    if (!result || result.status !== 0 || result.error || result.signal) blocked();
    return true;
  };
  return Object.freeze({
    run(operation) {
      if (!FIXED_OPERATIONS.includes(operation)) return Promise.reject(new Error("r12 fixed runner is invalid"));
      return execute(operation);
    },
    rollback() { return execute("rollback"); }
  });
}

function createRuntimeR12FixedRunner(releaseRoot) {
  return createR12FixedRunner({ releaseRoot, execFile: defaultExecFile });
}

module.exports = { FIXED_OPERATIONS, R12_CONTROL, SAFE_ENV, createR12FixedRunner, createRuntimeR12FixedRunner, fixedOperationCommand };
