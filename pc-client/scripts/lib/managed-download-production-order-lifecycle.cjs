"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CHECKPOINT_NAME = "production-order-checkpoint.json";
const DEFAULT_CONTRACT = "production-order";
const CONTRACTS = Object.freeze({
  [DEFAULT_CONTRACT]: Object.freeze({
    stages: Object.freeze([
      "main-compile",
      "ipc-bridge-register",
      "window-create",
      "renderer-load",
      "catalog",
      "enqueue",
      "order-gates",
      "convergence",
      "stale",
      "evidence-gates",
      "cancel-status",
      "cancel-request",
      "cancel-settle",
      "cancel-list-cleared",
      "residue",
      "window-destroy",
      "exit-request-ready"
    ]),
    finalStage: "exit-request-ready",
    fixedStderr: Buffer.from("PRODUCTION_ORDER_FIXTURE_FAILED\n", "utf8")
  }),
  "electron-lifecycle-probe": Object.freeze({
    stages: Object.freeze(["window-prerequisites", "window-constructor", "window-destroy", "keepalive-ready"]),
    finalStage: "keepalive-ready",
    fixedStderr: Buffer.from("ELECTRON_LIFECYCLE_PROBE_FAILED\n", "utf8")
  })
});
const BOUNDARIES = new Set(["entered", "completed"]);
const CHECKPOINT_KEYS = ["schemaVersion", "sequence", "stage", "boundary"];

function contractDefinition(contractName = DEFAULT_CONTRACT) {
  const contract = CONTRACTS[contractName];
  if (!contract) throw new Error("PRODUCTION_ORDER_CONTRACT_INVALID");
  return contract;
}

function assertOwnedProfile(profileDirectory) {
  const resolved = path.resolve(profileDirectory);
  const temporaryRoot = fs.realpathSync.native(os.tmpdir());
  const parent = fs.realpathSync.native(path.dirname(resolved));
  const name = path.basename(resolved);
  const stat = fs.lstatSync(resolved);
  if (
    parent !== temporaryRoot ||
    !name.startsWith("aihub-download-order-") ||
    !stat.isDirectory() ||
    stat.isSymbolicLink()
  ) throw new Error("PRODUCTION_ORDER_PROFILE_INVALID");
  return resolved;
}

function assertCheckpoint(value, contractName = DEFAULT_CONTRACT) {
  const stages = contractDefinition(contractName).stages;
  const stageIndex = stages.indexOf(value?.stage);
  const expectedSequence = stageIndex < 0 ? -1 : (stageIndex * 2) + (value?.boundary === "entered" ? 1 : 2);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== CHECKPOINT_KEYS.length ||
    CHECKPOINT_KEYS.some((key) => !Object.hasOwn(value, key)) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence !== expectedSequence ||
    !stages.includes(value.stage) ||
    !BOUNDARIES.has(value.boundary)
  ) throw new Error("PRODUCTION_ORDER_CHECKPOINT_INVALID");
  return value;
}

function checkpointPath(profileDirectory) {
  return path.join(profileDirectory, CHECKPOINT_NAME);
}

function readProductionOrderCheckpoint(profileDirectory, contractName = DEFAULT_CONTRACT) {
  try {
    return assertCheckpoint(JSON.parse(fs.readFileSync(checkpointPath(assertOwnedProfile(profileDirectory)), "utf8")), contractName);
  } catch (error) {
    if (error?.message === "PRODUCTION_ORDER_PROFILE_INVALID") throw error;
    throw new Error("PRODUCTION_ORDER_CHECKPOINT_INVALID");
  }
}

function createProductionOrderCheckpoint(profileDirectory, contractName = DEFAULT_CONTRACT) {
  const profile = assertOwnedProfile(profileDirectory);
  const stages = contractDefinition(contractName).stages;
  if (fs.existsSync(checkpointPath(profile))) throw new Error("PRODUCTION_ORDER_CHECKPOINT_INVALID");
  let sequence = 0;
  let stageIndex = 0;
  let expectedBoundary = "entered";
  return {
    path: checkpointPath(profile),
    write(stage, boundary) {
      if (stages[stageIndex] !== stage || expectedBoundary !== boundary) {
        throw new Error("PRODUCTION_ORDER_CHECKPOINT_TRANSITION_INVALID");
      }
      const value = assertCheckpoint({ schemaVersion: 1, sequence: ++sequence, stage, boundary }, contractName);
      const temporary = `${checkpointPath(profile)}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(temporary, checkpointPath(profile));
      if (boundary === "entered") expectedBoundary = "completed";
      else {
        stageIndex += 1;
        expectedBoundary = "entered";
      }
      return value;
    },
    read() {
      return readProductionOrderCheckpoint(profile, contractName);
    }
  };
}

async function withProductionOrderHardTimeout(action, timeoutMs, code) {
  if (typeof action !== "function" || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || typeof code !== "string" || !code) {
    throw new Error("PRODUCTION_ORDER_BOUNDARY_INVALID");
  }
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(code)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function productionOrderProcessState(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("PRODUCTION_ORDER_PID_INVALID");
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (error) {
    return error?.code === "ESRCH" ? "absent" : "unknown";
  }
}

function assertChildIdentity(child) {
  if (
    !child || typeof child !== "object" ||
    !Number.isSafeInteger(child.pid) || child.pid < 1 || child.pid === process.pid ||
    typeof child.spawnfile !== "string" || !path.isAbsolute(child.spawnfile) ||
    typeof child.once !== "function" || typeof child.kill !== "function" ||
    child.killed !== false || child.signalCode !== null ||
    !Object.hasOwn(child, "exitCode") ||
    (child.exitCode !== null && !Number.isSafeInteger(child.exitCode))
  ) throw new Error("PRODUCTION_ORDER_PID_INVALID");
  return child;
}

function resolveTaskkill() {
  const systemRoot = process.env.SystemRoot;
  if (typeof systemRoot !== "string" || !path.isAbsolute(systemRoot)) throw new Error("PRODUCTION_ORDER_TASKKILL_INVALID");
  const candidate = path.join(systemRoot, "System32", "taskkill.exe");
  const stat = fs.lstatSync(candidate);
  const canonical = fs.realpathSync.native(candidate);
  if (!stat.isFile() || stat.isSymbolicLink() || canonical.toLowerCase() !== candidate.toLowerCase()) {
    throw new Error("PRODUCTION_ORDER_TASKKILL_INVALID");
  }
  return candidate;
}

function terminateProductionOrderChildTree(childProcessHandle) {
  const child = assertChildIdentity(childProcessHandle);
  if (child.exitCode !== null) {
    const state = productionOrderProcessState(child.pid);
    return {
      terminated: false,
      processAbsent: state === "absent",
      treeAbsent: false,
      failureClass: state === "unknown" ? "process-state-unknown" : "child-already-exited"
    };
  }
  const initialState = productionOrderProcessState(child.pid);
  if (initialState === "unknown") {
    return { terminated: false, processAbsent: false, treeAbsent: false, failureClass: "process-state-unknown" };
  }
  if (initialState === "absent") {
    return { terminated: false, processAbsent: true, treeAbsent: false, failureClass: "root-already-absent" };
  }
  let taskkill;
  try {
    taskkill = resolveTaskkill();
  } catch {
    return { terminated: false, processAbsent: false, treeAbsent: false, failureClass: "taskkill-invalid" };
  }
  let result;
  try {
    result = childProcess.spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
      shell: false,
      timeout: 10_000
    });
  } catch {
    const state = productionOrderProcessState(child.pid);
    return { terminated: false, processAbsent: state === "absent", treeAbsent: false, failureClass: state === "unknown" ? "process-state-unknown" : "taskkill-error" };
  }
  const finalState = productionOrderProcessState(child.pid);
  const processAbsent = finalState === "absent";
  const failureClass = result?.error?.code === "ETIMEDOUT"
    ? "taskkill-timeout"
    : result?.error
      ? "taskkill-error"
      : result?.signal
        ? "taskkill-signal"
          : finalState === "unknown"
            ? "process-state-unknown"
            : result?.status !== 0
          ? "taskkill-exit"
          : !processAbsent
            ? "root-still-alive"
            : "none";
  const terminated = failureClass === "none";
  return { terminated, processAbsent, treeAbsent: terminated, failureClass };
}

function unexpectedClosedProductionOrderTree(childProcessHandle) {
  const child = assertChildIdentity(childProcessHandle);
  const rootState = productionOrderProcessState(child.pid);
  return {
    terminated: false,
    processAbsent: rootState === "absent",
    treeAbsent: false,
    failureClass: rootState === "unknown" ? "process-state-unknown" : rootState === "alive" ? "root-still-alive" : "unexpected-close"
  };
}

function createProductionOrderStderrClassifier(contractName = DEFAULT_CONTRACT) {
  const fixedStderr = contractDefinition(contractName).fixedStderr;
  let length = 0;
  let exact = true;
  return {
    push(chunk) {
      const bytes = Buffer.from(chunk);
      for (let index = 0; index < bytes.length; index += 1) {
        if (length + index >= fixedStderr.length || bytes[index] !== fixedStderr[length + index]) exact = false;
      }
      length += bytes.length;
    },
    classify() {
      if (length === 0) return "empty";
      return exact && length === fixedStderr.length ? "fixed-runner-code" : "other-safe-class";
    }
  };
}

function assertNoReparseChildren(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    const stat = fs.lstatSync(child);
    if (stat.isSymbolicLink()) throw new Error("PRODUCTION_ORDER_PROFILE_REPARSE");
    if (stat.isDirectory()) assertNoReparseChildren(child);
  }
}

function removeProductionOrderProfile(profileDirectory, treeAbsent) {
  const profile = assertOwnedProfile(profileDirectory);
  if (treeAbsent !== true) return { cleanupBlocked: true, cleanupCode: "CLEANUP_BLOCKED", profileAbsent: false };
  try {
    assertNoReparseChildren(profile);
    fs.rmSync(profile, { recursive: true, force: false, maxRetries: 5, retryDelay: 50 });
  } catch {
    return { cleanupBlocked: true, cleanupCode: "CLEANUP_BLOCKED", profileAbsent: !fs.existsSync(profile) };
  }
  return { cleanupBlocked: false, cleanupCode: null, profileAbsent: !fs.existsSync(profile) };
}

function checkpointProjection(profileDirectory, contractName = DEFAULT_CONTRACT) {
  try {
    const value = readProductionOrderCheckpoint(profileDirectory, contractName);
    return { stage: value.stage, boundary: value.boundary, checkpointValid: true };
  } catch {
    return { stage: "unavailable", boundary: "unavailable", checkpointValid: false };
  }
}

function fixedExitClass(code, signal) {
  if (signal) return "signal";
  if (code === 0 || code === 1 || code === 2) return `exit-${code}`;
  return "exit-other";
}

function runProductionOrderChild({ executable, args, cwd, env, profileDirectory, timeoutMs, contractName = DEFAULT_CONTRACT }) {
  const profile = assertOwnedProfile(profileDirectory);
  const contract = contractDefinition(contractName);
  if (
    typeof executable !== "string" || !path.isAbsolute(executable) ||
    !Array.isArray(args) || args.some((value) => typeof value !== "string") ||
    typeof cwd !== "string" || !path.isAbsolute(cwd) ||
    !env || typeof env !== "object" ||
    !Number.isSafeInteger(timeoutMs) || timeoutMs < 1
  ) throw new Error("PRODUCTION_ORDER_CHILD_INPUT_INVALID");
  return new Promise((resolve) => {
    const stderr = createProductionOrderStderrClassifier(contractName);
    let child;
    let timer;
    let watcher;
    let settling = false;
    const finish = (exitClass, termination) => {
      if (settling) return;
      settling = true;
      clearTimeout(timer);
      clearInterval(watcher);
      let checkpoint = { stage: "unavailable", boundary: "unavailable", checkpointValid: false };
      let cleanup = { profileAbsent: false, cleanupBlocked: true, cleanupCode: "CLEANUP_BLOCKED" };
      try { checkpoint = checkpointProjection(profile, contractName); } catch {}
      try { cleanup = removeProductionOrderProfile(profile, termination?.treeAbsent === true); } catch {
        try { cleanup.profileAbsent = !fs.existsSync(profile); } catch {}
      }
      resolve({
        exitClass,
        stderrClass: stderr.classify(),
        ...checkpoint,
        childAbsent: termination?.processAbsent === true,
        treeAbsent: termination?.treeAbsent === true,
        terminationClass: typeof termination?.failureClass === "string" ? termination.failureClass : "tree-state-unavailable",
        profileAbsent: cleanup.profileAbsent,
        cleanupBlocked: cleanup.cleanupBlocked,
        cleanupCode: cleanup.cleanupCode
      });
    };
    try {
      child = childProcess.spawn(executable, args, {
        cwd,
        env,
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
        shell: false,
        detached: false
      });
    } catch {
      finish("spawn-error", { processAbsent: true, treeAbsent: true, failureClass: "spawn-not-started" });
      return;
    }
    child.stderr?.on("data", (chunk) => stderr.push(chunk));
    child.once("error", () => {
      let termination = { processAbsent: !child.pid, treeAbsent: !child.pid, failureClass: child.pid ? "taskkill-error" : "spawn-not-started" };
      if (child.pid) {
        try { termination = child.exitCode === null ? terminateProductionOrderChildTree(child) : unexpectedClosedProductionOrderTree(child); } catch {}
      }
      finish("spawn-error", termination);
    });
    child.once("close", (code, signal) => {
      let termination = { processAbsent: false, treeAbsent: false, failureClass: "tree-state-unavailable" };
      try { termination = unexpectedClosedProductionOrderTree(child); } catch {}
      finish(fixedExitClass(code, signal), termination);
    });
    watcher = setInterval(() => {
      if (settling || !child.pid || child.exitCode !== null) return;
      const checkpoint = checkpointProjection(profile, contractName);
      const finalReady = checkpoint.checkpointValid && checkpoint.stage === contract.finalStage && checkpoint.boundary === "completed";
      const fixedFailure = stderr.classify() === "fixed-runner-code";
      if (!finalReady && !fixedFailure) return;
      let termination = { processAbsent: false, treeAbsent: false, failureClass: "taskkill-error" };
      try { termination = terminateProductionOrderChildTree(child); } catch {}
      if (termination.treeAbsent) termination = { ...termination, failureClass: finalReady ? "controlled-success" : "controlled-failure" };
      finish(finalReady ? (termination.treeAbsent ? "exit-0" : "controlled-teardown-failed") : "exit-1", termination);
    }, 10);
    timer = setTimeout(() => {
      let termination = { processAbsent: !child.pid, treeAbsent: !child.pid, failureClass: child.pid ? "taskkill-error" : "spawn-not-started" };
      try {
        if (child.pid) termination = terminateProductionOrderChildTree(child);
      } catch {}
      finally { finish("timeout", termination); }
    }, timeoutMs);
  });
}

module.exports = {
  createProductionOrderCheckpoint,
  createProductionOrderStderrClassifier,
  readProductionOrderCheckpoint,
  removeProductionOrderProfile,
  runProductionOrderChild,
  terminateProductionOrderChildTree,
  withProductionOrderHardTimeout
};
