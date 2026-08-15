"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

const lifecyclePath = path.resolve(__dirname, "..", "scripts", "lib", "managed-download-production-order-lifecycle.cjs");
const runnerPath = path.resolve(__dirname, "..", "scripts", "fixtures", "managed-download-production-order-runner.cjs");
const cancelEvidencePath = path.resolve(__dirname, "..", "scripts", "fixtures", "managed-download-production-order-cancel.cjs");
const previewPreloadPath = path.resolve(__dirname, "..", "scripts", "fixtures", "installed-management-preview-preload.cjs");
const outerPath = path.resolve(__dirname, "managed-download-production-order.test.cjs");

function createProductionOrderBridgeHarness(cancelOutcome) {
  let context;
  const ipcRenderer = {
    invoke(channel) {
      if (channel !== "download:cancel") return Promise.resolve({ ok: true });
      if (cancelOutcome === "reject") return Promise.reject(new Error("fixture raw rejection"));
      if (cancelOutcome === "malformed") return Promise.resolve({ ok: true, extra: "fixture raw field" });
      return Promise.resolve({ ok: true });
    },
    on() {},
    removeListener() {}
  };
  context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    process: { env: { AIHUB_MANAGED_DOWNLOAD_PRODUCTION_ORDER: "status-before-reply" } },
    require(specifier) {
      if (specifier === "electron") {
        return {
          contextBridge: {
            exposeInMainWorld(_name, api) { context.aihubPC = api; }
          },
          ipcRenderer
        };
      }
      return require(specifier);
    },
    __dirname: path.dirname(previewPreloadPath),
    structuredClone,
    TextEncoder,
    URL,
    setTimeout,
    clearTimeout
  });
  vm.runInContext(fs.readFileSync(previewPreloadPath, "utf8"), context, { filename: previewPreloadPath });
  return context;
}

async function invokeProductionOrderCancelBridge(cancelOutcome) {
  const context = createProductionOrderBridgeHarness(cancelOutcome);
  const invocation = vm.runInContext(`(() => {
    const promise = aihubPC.cancelManagedDownload({ productId: "fixture-product", taskId: "fixture-attempt", confirmed: true });
    return { outerRealmPromise: promise instanceof Promise, promise };
  })()`, context);
  const result = await Promise.race([
    invocation.promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("PRODUCTION_ORDER_CANCEL_BRIDGE_TIMEOUT")), 250))
  ]);
  return { outerRealmPromise: invocation.outerRealmPromise, result: JSON.parse(JSON.stringify(result)) };
}

test("production-order cancel bridge settles in the host realm with the current nested preload contract", async () => {
  assert.deepEqual(await invokeProductionOrderCancelBridge("ok"), {
    outerRealmPromise: true,
    result: { ok: true }
  });
  assert.deepEqual(await invokeProductionOrderCancelBridge("reject"), {
    outerRealmPromise: true,
    result: { ok: false, errorCode: "DOWNLOAD_QUEUE_REJECTED" }
  });
  assert.deepEqual(await invokeProductionOrderCancelBridge("malformed"), {
    outerRealmPromise: true,
    result: { ok: false, errorCode: "DOWNLOAD_QUEUE_REJECTED" }
  });
});

function cancelCheckpointRecorder() {
  const writes = [];
  return {
    writes,
    checkpoint: { write(stage, boundary) { writes.push([stage, boundary]); } }
  };
}

function successfulCancelSequence(overrides = {}) {
  return {
    readStatus: async () => ({ envelopeClass: "ok", requestReady: true }),
    requestCancel: async () => ({ ok: true }),
    inspectMainCancel: async () => ({ settled: true, resultClass: "ok" }),
    inspectClearance: async () => ({
      taskAbsent: true,
      partCountClass: "zero",
      formalCountClass: "zero"
    }),
    timeoutMs: 20,
    ...overrides
  };
}

test("production-order cancel evidence keeps status, main settle, renderer return, and clearance distinct", async () => {
  const { runProductionOrderCancelEvidence } = require(cancelEvidencePath);
  const success = cancelCheckpointRecorder();
  assert.deepEqual(
    await runProductionOrderCancelEvidence({ checkpoint: success.checkpoint, ...successfulCancelSequence() }),
    {
      statusEnvelopeClass: "ok",
      cancelEnvelopeClass: "ok",
      taskAbsent: true,
      partCountClass: "zero",
      formalCountClass: "zero",
      responseOk: true
    }
  );
  assert.deepEqual(success.writes, [
    ["cancel-status", "entered"], ["cancel-status", "completed"],
    ["cancel-request", "entered"], ["cancel-request", "completed"],
    ["cancel-settle", "entered"], ["cancel-settle", "completed"],
    ["cancel-list-cleared", "entered"], ["cancel-list-cleared", "completed"]
  ]);

  const status = cancelCheckpointRecorder();
  await assert.rejects(
    runProductionOrderCancelEvidence({
      checkpoint: status.checkpoint,
      ...successfulCancelSequence({ readStatus: async () => ({ envelopeClass: "rejected", requestReady: false }) })
    }),
    /PRODUCTION_ORDER_CANCEL_STATUS_REJECTED/
  );
  assert.deepEqual(status.writes, [["cancel-status", "entered"]]);

  const renderer = cancelCheckpointRecorder();
  await assert.rejects(
    runProductionOrderCancelEvidence({
      checkpoint: renderer.checkpoint,
      ...successfulCancelSequence({ requestCancel: () => new Promise(() => {}) })
    }),
    /PRODUCTION_ORDER_CANCEL_RENDERER_TIMEOUT/
  );
  assert.deepEqual(renderer.writes.at(-1), ["cancel-settle", "entered"]);

  const rejected = cancelCheckpointRecorder();
  await assert.rejects(
    runProductionOrderCancelEvidence({
      checkpoint: rejected.checkpoint,
      ...successfulCancelSequence({
        requestCancel: async () => ({ ok: false, errorCode: "DOWNLOAD_QUEUE_REJECTED" }),
        inspectMainCancel: async () => ({ settled: true, resultClass: "rejected" })
      })
    }),
    /PRODUCTION_ORDER_CANCEL_RESPONSE_REJECTED/
  );
  assert.deepEqual(rejected.writes.at(-1), ["cancel-settle", "entered"]);

  const uncleared = cancelCheckpointRecorder();
  await assert.rejects(
    runProductionOrderCancelEvidence({
      checkpoint: uncleared.checkpoint,
      ...successfulCancelSequence({
        inspectClearance: async () => ({ taskAbsent: false, partCountClass: "nonzero", formalCountClass: "zero" })
      })
    }),
    /PRODUCTION_ORDER_CANCEL_LIST_NOT_CLEARED/
  );
  assert.deepEqual(uncleared.writes.at(-1), ["cancel-list-cleared", "entered"]);
});

function activeTimeoutCount() {
  return process.getActiveResourcesInfo().filter((type) => type === "Timeout").length;
}

test("production-order cancel evidence spends one shared deadline and leaves no timer behind", async () => {
  const { runProductionOrderCancelEvidence } = require(cancelEvidencePath);

  let fakeNow = 0;
  const renderer = cancelCheckpointRecorder();
  const rendererStarted = performance.now();
  await assert.rejects(
    runProductionOrderCancelEvidence({
      checkpoint: renderer.checkpoint,
      ...successfulCancelSequence({
        timeoutMs: 80,
        now: () => fakeNow,
        readStatus: async () => {
          fakeNow = 70;
          return { envelopeClass: "ok", requestReady: true };
        },
        inspectMainCancel: async () => {
          fakeNow = 79;
          return { settled: true, resultClass: "ok" };
        },
        requestCancel: () => new Promise(() => {})
      })
    }),
    /PRODUCTION_ORDER_CANCEL_RENDERER_TIMEOUT/
  );
  assert.ok(performance.now() - rendererStarted < 40, "renderer must receive only the shared remaining budget");
  assert.deepEqual(renderer.writes.at(-1), ["cancel-settle", "entered"]);

  fakeNow = 0;
  let clearanceSamples = 0;
  const clearance = cancelCheckpointRecorder();
  const clearanceStarted = performance.now();
  await assert.rejects(
    runProductionOrderCancelEvidence({
      checkpoint: clearance.checkpoint,
      ...successfulCancelSequence({
        timeoutMs: 80,
        now: () => fakeNow,
        readStatus: async () => {
          fakeNow = 20;
          return { envelopeClass: "ok", requestReady: true };
        },
        inspectMainCancel: async () => {
          fakeNow = 40;
          return { settled: true, resultClass: "ok" };
        },
        inspectClearance: async () => {
          clearanceSamples += 1;
          fakeNow = clearanceSamples === 1 ? 79 : 80;
          return { taskAbsent: false, partCountClass: "nonzero", formalCountClass: "zero" };
        }
      })
    }),
    /PRODUCTION_ORDER_CANCEL_LIST_NOT_CLEARED/
  );
  assert.ok(performance.now() - clearanceStarted < 40, "clearance poll must be clipped to the shared remainder");
  assert.deepEqual(clearance.writes.at(-1), ["cancel-list-cleared", "entered"]);

  const wall = cancelCheckpointRecorder();
  const wallHandlesBefore = activeTimeoutCount();
  const wallStarted = performance.now();
  await assert.rejects(
    runProductionOrderCancelEvidence({
      checkpoint: wall.checkpoint,
      ...successfulCancelSequence({
        timeoutMs: 40,
        readStatus: async () => {
          await new Promise((resolve) => setTimeout(resolve, 25));
          return { envelopeClass: "ok", requestReady: true };
        },
        requestCancel: () => new Promise(() => {})
      })
    }),
    /PRODUCTION_ORDER_CANCEL_RENDERER_TIMEOUT/
  );
  assert.ok(performance.now() - wallStarted < 55, "total wall clock must not stack stage timeouts");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(activeTimeoutCount(), wallHandlesBefore, "timeout must not retain a timer or poll loop");

  const clearanceWall = cancelCheckpointRecorder();
  const clearanceWallStarted = performance.now();
  await assert.rejects(
    runProductionOrderCancelEvidence({
      checkpoint: clearanceWall.checkpoint,
      ...successfulCancelSequence({
        timeoutMs: 40,
        readStatus: async () => {
          await new Promise((resolve) => setTimeout(resolve, 25));
          return { envelopeClass: "ok", requestReady: true };
        },
        inspectClearance: async () => ({ taskAbsent: false, partCountClass: "nonzero", formalCountClass: "zero" })
      })
    }),
    /PRODUCTION_ORDER_CANCEL_LIST_NOT_CLEARED/
  );
  assert.ok(performance.now() - clearanceWallStarted < 55, "clearance must share the same wall-clock deadline");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(activeTimeoutCount(), wallHandlesBefore, "clearance timeout must not retain a timer or poll loop");

  const cases = [
    successfulCancelSequence(),
    successfulCancelSequence({
      requestCancel: async () => ({ ok: false, errorCode: "DOWNLOAD_QUEUE_REJECTED" }),
      inspectMainCancel: async () => ({ settled: true, resultClass: "rejected" })
    }),
    successfulCancelSequence({
      requestCancel: async () => ({ ok: true, extra: "rejected" }),
      inspectMainCancel: async () => ({ settled: true, resultClass: "malformed" })
    })
  ];
  for (const fixture of cases) {
    const before = activeTimeoutCount();
    const recorded = cancelCheckpointRecorder();
    try { await runProductionOrderCancelEvidence({ checkpoint: recorded.checkpoint, ...fixture }); } catch {}
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(activeTimeoutCount(), before, "settled helper must not retain a timer");
  }
});

test("production-order checkpoint is atomic, ordered, and exact-schema", () => {
  const {
    createProductionOrderCheckpoint,
    readProductionOrderCheckpoint
  } = require(lifecyclePath);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-checkpoint-"));
  try {
    const checkpoint = createProductionOrderCheckpoint(profile);
    checkpoint.write("main-compile", "entered");
    checkpoint.write("main-compile", "completed");
    assert.deepEqual(checkpoint.read(), { schemaVersion: 1, sequence: 2, stage: "main-compile", boundary: "completed" });
    assert.deepEqual(readProductionOrderCheckpoint(profile), checkpoint.read());
    const file = path.join(profile, "production-order-checkpoint.json");
    fs.writeFileSync(file, `${JSON.stringify({ schemaVersion: 2, sequence: 3, stage: "main-compile", boundary: "entered" })}\n`);
    assert.throws(() => readProductionOrderCheckpoint(profile), /PRODUCTION_ORDER_CHECKPOINT_INVALID/);
    fs.writeFileSync(file, `${JSON.stringify({ schemaVersion: 1, sequence: 9, stage: "main-compile", boundary: "completed" })}\n`);
    assert.throws(() => readProductionOrderCheckpoint(profile), /PRODUCTION_ORDER_CHECKPOINT_INVALID/);
    fs.writeFileSync(file, `${JSON.stringify({ schemaVersion: 1, sequence: 3, stage: "main-compile", boundary: "entered", raw: "secret" })}\n`);
    assert.throws(() => readProductionOrderCheckpoint(profile), /PRODUCTION_ORDER_CHECKPOINT_INVALID/);
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
});

test("production-order checkpoint rejects skipped, repeated, and incomplete transitions", () => {
  const { createProductionOrderCheckpoint } = require(lifecyclePath);
  const profiles = [];
  try {
    const skippedProfile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-transition-"));
    profiles.push(skippedProfile);
    const skipped = createProductionOrderCheckpoint(skippedProfile);
    assert.throws(() => skipped.write("renderer-load", "entered"), /PRODUCTION_ORDER_CHECKPOINT_TRANSITION_INVALID/);

    const repeatedProfile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-transition-"));
    profiles.push(repeatedProfile);
    const repeated = createProductionOrderCheckpoint(repeatedProfile);
    repeated.write("main-compile", "entered");
    assert.throws(() => repeated.write("main-compile", "entered"), /PRODUCTION_ORDER_CHECKPOINT_TRANSITION_INVALID/);
    assert.throws(() => repeated.write("ipc-bridge-register", "entered"), /PRODUCTION_ORDER_CHECKPOINT_TRANSITION_INVALID/);
  } finally {
    for (const profile of profiles) fs.rmSync(profile, { recursive: true, force: true });
  }
});

test("production-order hard boundary rejects a promise that never settles", async () => {
  const { withProductionOrderHardTimeout } = require(lifecyclePath);
  const started = Date.now();
  await assert.rejects(
    withProductionOrderHardTimeout(() => new Promise(() => {}), 20, "PRODUCTION_ORDER_RENDERER_TIMEOUT"),
    /PRODUCTION_ORDER_RENDERER_TIMEOUT/
  );
  assert.ok(Date.now() - started < 1_000);
});

test("production-order child cleanup rejects invalid or self process identities", () => {
  const { terminateProductionOrderChildTree } = require(lifecyclePath);
  assert.throws(() => terminateProductionOrderChildTree(0), /PRODUCTION_ORDER_PID_INVALID/);
  assert.throws(() => terminateProductionOrderChildTree(process.pid), /PRODUCTION_ORDER_PID_INVALID/);
});

function withTerminationMocks({ alive, spawnResult }, assertion) {
  const childProcess = require("node:child_process");
  const originalSpawnSync = childProcess.spawnSync;
  const originalKill = process.kill;
  const original = require.cache[require.resolve(lifecyclePath)];
  const calls = [];
  let aliveIndex = 0;
  childProcess.spawnSync = (...args) => {
    calls.push(args);
    return spawnResult;
  };
  process.kill = () => {
    const current = alive[Math.min(aliveIndex++, alive.length - 1)];
    if (current) return true;
    const error = new Error("absent");
    error.code = "ESRCH";
    throw error;
  };
  delete require.cache[require.resolve(lifecyclePath)];
  try {
    const lifecycle = require(lifecyclePath);
    const child = new EventEmitter();
    Object.assign(child, { pid: 424242, exitCode: null, signalCode: null, killed: false, spawnfile: process.execPath, kill() {} });
    assertion(lifecycle.terminateProductionOrderChildTree(child), calls, lifecycle);
  } finally {
    childProcess.spawnSync = originalSpawnSync;
    process.kill = originalKill;
    delete require.cache[require.resolve(lifecyclePath)];
    if (original) require.cache[require.resolve(lifecyclePath)] = original;
  }
}

test("production-order taskkill success proves only an exact /T termination with root absent", () => {
  withTerminationMocks({ alive: [true, false], spawnResult: { status: 0, signal: null } }, (result, calls) => {
    assert.deepEqual(result, { terminated: true, processAbsent: true, treeAbsent: true, failureClass: "none" });
    assert.equal(calls.length, 1);
    assert.equal(path.normalize(calls[0][0]), path.join(process.env.SystemRoot, "System32", "taskkill.exe"));
    assert.deepEqual(calls[0][1], ["/PID", "424242", "/T", "/F"]);
    assert.equal(calls[0][2].shell, false);
  });
});

test("production-order process permission errors never prove absence", () => {
  const childProcess = require("node:child_process");
  const originalSpawnSync = childProcess.spawnSync;
  const originalKill = process.kill;
  const original = require.cache[require.resolve(lifecyclePath)];
  let spawnCalls = 0;
  childProcess.spawnSync = () => { spawnCalls += 1; return { status: 0, signal: null }; };
  process.kill = () => { throw Object.assign(new Error("denied raw"), { code: "EPERM" }); };
  delete require.cache[require.resolve(lifecyclePath)];
  try {
    const lifecycle = require(lifecyclePath);
    assert.deepEqual(
      lifecycle.terminateProductionOrderChildTree(Object.assign(new EventEmitter(), { pid: 424242, exitCode: null, signalCode: null, killed: false, spawnfile: process.execPath, kill() {} })),
      { terminated: false, processAbsent: false, treeAbsent: false, failureClass: "process-state-unknown" }
    );
    assert.equal(spawnCalls, 0);
  } finally {
    childProcess.spawnSync = originalSpawnSync;
    process.kill = originalKill;
    delete require.cache[require.resolve(lifecyclePath)];
    if (original) require.cache[require.resolve(lifecyclePath)] = original;
  }
});

test("production-order taskkill fail, timeout, and live root never claim termination", () => {
  const cases = [
    { alive: [true, false], spawnResult: { status: null, signal: null, error: new Error("spawn raw") }, failureClass: "taskkill-error" },
    { alive: [true, false], spawnResult: { status: 1, signal: null }, failureClass: "taskkill-exit" },
    { alive: [true, false], spawnResult: { status: null, signal: "SIGTERM" }, failureClass: "taskkill-signal" },
    { alive: [true, false], spawnResult: { status: null, signal: "SIGTERM", error: Object.assign(new Error("timeout raw"), { code: "ETIMEDOUT" }) }, failureClass: "taskkill-timeout" },
    { alive: [true, true], spawnResult: { status: 0, signal: null }, failureClass: "root-still-alive" }
  ];
  for (const fixture of cases) {
    withTerminationMocks(fixture, (result) => {
      assert.equal(result.terminated, false);
      assert.equal(result.treeAbsent, false);
      assert.equal(result.failureClass, fixture.failureClass);
    });
  }
});

test("production-order taskkill resolver rejects directories, symlinks, and canonical drift", () => {
  const childProcess = require("node:child_process");
  const originalSpawnSync = childProcess.spawnSync;
  const originalKill = process.kill;
  const originalLstatSync = fs.lstatSync;
  const originalRealpathSync = fs.realpathSync.native;
  const original = require.cache[require.resolve(lifecyclePath)];
  const cases = [
    { isFile: false, isSymbolicLink: false, drift: false },
    { isFile: true, isSymbolicLink: true, drift: false },
    { isFile: true, isSymbolicLink: false, drift: true }
  ];
  try {
    for (const fixture of cases) {
      let spawnCalls = 0;
      childProcess.spawnSync = () => { spawnCalls += 1; return { status: 0, signal: null }; };
      process.kill = () => true;
      fs.lstatSync = () => ({ isFile: () => fixture.isFile, isSymbolicLink: () => fixture.isSymbolicLink });
      fs.realpathSync.native = (candidate) => fixture.drift ? `${candidate}.other` : candidate;
      delete require.cache[require.resolve(lifecyclePath)];
      const lifecycle = require(lifecyclePath);
      assert.deepEqual(
        lifecycle.terminateProductionOrderChildTree(Object.assign(new EventEmitter(), { pid: 424242, exitCode: null, signalCode: null, killed: false, spawnfile: process.execPath, kill() {} })),
        { terminated: false, processAbsent: false, treeAbsent: false, failureClass: "taskkill-invalid" }
      );
      assert.equal(spawnCalls, 0);
    }
  } finally {
    childProcess.spawnSync = originalSpawnSync;
    process.kill = originalKill;
    fs.lstatSync = originalLstatSync;
    fs.realpathSync.native = originalRealpathSync;
    delete require.cache[require.resolve(lifecyclePath)];
    if (original) require.cache[require.resolve(lifecyclePath)] = original;
  }
});

test("production-order missing tree proof blocks cleanup even after the root is absent", () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-live-child-"));
  try {
    withTerminationMocks({ alive: [true, false], spawnResult: { status: 1, signal: null } }, (termination, _calls, lifecycle) => {
      assert.equal(termination.processAbsent, true);
      assert.equal(termination.treeAbsent, false);
      const cleanup = lifecycle.removeProductionOrderProfile(profile, termination.treeAbsent);
      assert.deepEqual(cleanup, { cleanupBlocked: true, cleanupCode: "CLEANUP_BLOCKED", profileAbsent: false });
      assert.equal(fs.existsSync(profile), true);
    });
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
});

test("production-order stderr classifier discards content and returns only a fixed class", () => {
  const { createProductionOrderStderrClassifier } = require(lifecyclePath);
  const empty = createProductionOrderStderrClassifier();
  assert.equal(empty.classify(), "empty");
  const fixed = createProductionOrderStderrClassifier();
  fixed.push(Buffer.from("PRODUCTION_ORDER_"));
  fixed.push(Buffer.from("FIXTURE_FAILED\n"));
  assert.equal(fixed.classify(), "fixed-runner-code");
  const other = createProductionOrderStderrClassifier();
  other.push(Buffer.from("C:\\secret https://invalid.example sk-abcdefghijklmnopqrstuvwxyz1234567890"));
  assert.equal(other.classify(), "other-safe-class");
  assert.doesNotMatch(JSON.stringify(other), /secret|https|sk-/i);
});

test("production-order profile cleanup is limited to its exact temp child and requires child absence", () => {
  const { removeProductionOrderProfile } = require(lifecyclePath);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-cleanup-"));
  fs.writeFileSync(path.join(profile, "owned.tmp"), "fixture");
  assert.deepEqual(removeProductionOrderProfile(profile, false), { cleanupBlocked: true, cleanupCode: "CLEANUP_BLOCKED", profileAbsent: false });
  assert.equal(fs.existsSync(profile), true);
  assert.deepEqual(removeProductionOrderProfile(profile, true), { cleanupBlocked: false, cleanupCode: null, profileAbsent: true });
  assert.throws(() => removeProductionOrderProfile(path.resolve(__dirname, ".."), true), /PRODUCTION_ORDER_PROFILE_INVALID/);
});

test("production-order profile cleanup refuses an internal junction and preserves the owned root", () => {
  const { removeProductionOrderProfile } = require(lifecyclePath);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-reparse-"));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-target-"));
  const junction = path.join(profile, "unexpected-junction");
  try {
    fs.symlinkSync(target, junction, "junction");
    assert.deepEqual(removeProductionOrderProfile(profile, true), { cleanupBlocked: true, cleanupCode: "CLEANUP_BLOCKED", profileAbsent: false });
    assert.equal(fs.existsSync(profile), true);
  } finally {
    try { fs.unlinkSync(junction); } catch {}
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});

const LIFECYCLE_STAGES = [
  "main-compile", "ipc-bridge-register", "window-create", "renderer-load", "catalog", "enqueue", "order-gates",
  "convergence", "stale", "evidence-gates", "cancel-status", "cancel-request", "cancel-settle",
  "cancel-list-cleared", "residue", "window-destroy", "exit-request-ready"
];

function fakeChildSource({ stage, boundary, exitCode = null, stderr = "", neverSettle = false }) {
  return `
    const {createProductionOrderCheckpoint}=require(${JSON.stringify(lifecyclePath)});
    const checkpoint=createProductionOrderCheckpoint(process.env.AIHUB_TEST_PROFILE);
    const stages=${JSON.stringify(LIFECYCLE_STAGES)};
    for(const current of stages){
      checkpoint.write(current,"entered");
      if(current===${JSON.stringify(stage)}&&${JSON.stringify(boundary)}==="entered")break;
      checkpoint.write(current,"completed");
      if(current===${JSON.stringify(stage)})break;
    }
    if(${JSON.stringify(stderr)})process.stderr.write(${JSON.stringify(stderr)});
    ${neverSettle ? "setInterval(()=>{},1000);" : `process.exit(${exitCode});`}
  `;
}

async function runFakeChild(options) {
  const { runProductionOrderChild } = require(lifecyclePath);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-child-"));
  const result = await runProductionOrderChild({
    executable: process.execPath,
    args: ["-e", fakeChildSource(options)],
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, AIHUB_TEST_PROFILE: profile },
    profileDirectory: profile,
    timeoutMs: options.timeoutMs || 2_000
  });
  if (!result.profileAbsent && fs.existsSync(profile)) fs.rmSync(profile, { recursive: true, force: true });
  return result;
}

async function runDeterministicClosedChild({ exitCode, stage, boundary, profileMutation = "none" }) {
  const originalSpawn = childProcess.spawn;
  const originalKill = process.kill;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-deterministic-"));
  const renamedProfile = `${profile}-renamed`;
  const child = Object.assign(new EventEmitter(), {
    pid: 424242,
    exitCode: null,
    signalCode: null,
    killed: false,
    spawnfile: process.execPath,
    kill() {},
    stderr: new EventEmitter()
  });
  const timers = new Set();
  const createTimer = (kind) => {
    const handle = { kind };
    timers.add(handle);
    return handle;
  };
  childProcess.spawn = () => child;
  process.kill = () => { throw Object.assign(new Error("absent"), { code: "ESRCH" }); };
  global.setTimeout = () => createTimer("timeout");
  global.clearTimeout = (handle) => timers.delete(handle);
  global.setInterval = () => createTimer("interval");
  global.clearInterval = (handle) => timers.delete(handle);
  let result;
  try {
    const { createProductionOrderCheckpoint, runProductionOrderChild } = require(lifecyclePath);
    const checkpoint = createProductionOrderCheckpoint(profile);
    for (const current of LIFECYCLE_STAGES) {
      checkpoint.write(current, "entered");
      if (current === stage && boundary === "entered") break;
      checkpoint.write(current, "completed");
      if (current === stage) break;
    }
    const pending = runProductionOrderChild({
      executable: process.execPath,
      args: [],
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env },
      profileDirectory: profile,
      timeoutMs: 1_000
    });
    if (profileMutation === "remove") fs.rmSync(profile, { recursive: true, force: false });
    if (profileMutation === "rename") fs.renameSync(profile, renamedProfile);
    child.exitCode = exitCode;
    child.emit("close", exitCode, null);
    result = await pending;
    assert.equal(timers.size, 0);
    assert.equal(child.listenerCount("close"), 0);
  } finally {
    child.removeAllListeners();
    child.stderr.removeAllListeners();
    const childListenerCount = child.eventNames().length;
    const stderrListenerCount = child.stderr.eventNames().length;
    childProcess.spawn = originalSpawn;
    process.kill = originalKill;
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    if (fs.existsSync(profile)) fs.rmSync(profile, { recursive: true, force: true });
    if (fs.existsSync(renamedProfile)) fs.rmSync(renamedProfile, { recursive: true, force: true });
    assert.equal(childListenerCount, 0);
    assert.equal(stderrListenerCount, 0);
    assert.equal(timers.size, 0);
    assert.equal(fs.existsSync(profile), false);
    assert.equal(fs.existsSync(renamedProfile), false);
  }
  return result;
}

test("production-order unexpected close preserves its fixed checkpoint evidence", async () => {
  for (const [exitCode, stage, boundary] of [[1, "enqueue", "entered"], [2, "exit-request-ready", "entered"]]) {
    const result = await runDeterministicClosedChild({ exitCode, stage, boundary });
    assert.deepEqual(result, {
      exitClass: `exit-${exitCode}`,
      stderrClass: "empty",
      stage,
      boundary,
      checkpointValid: true,
      childAbsent: true,
      treeAbsent: false,
      terminationClass: "unexpected-close",
      profileAbsent: false,
      cleanupBlocked: true,
      cleanupCode: "CLEANUP_BLOCKED"
    });
  }
});

test("production-order collector always settles when its owned profile disappears before child exit", async () => {
  assert.deepEqual(
    await runDeterministicClosedChild({ exitCode: 1, stage: "enqueue", boundary: "entered", profileMutation: "remove" }),
    {
      exitClass: "exit-1",
      stderrClass: "empty",
      stage: "unavailable",
      boundary: "unavailable",
      checkpointValid: false,
      childAbsent: true,
      treeAbsent: false,
      terminationClass: "unexpected-close",
      profileAbsent: true,
      cleanupBlocked: true,
      cleanupCode: "CLEANUP_BLOCKED"
    }
  );
});

test("production-order collector always settles when its owned profile is renamed before child exit", async () => {
  assert.deepEqual(
    await runDeterministicClosedChild({ exitCode: 2, stage: "enqueue", boundary: "entered", profileMutation: "rename" }),
    {
      exitClass: "exit-2",
      stderrClass: "empty",
      stage: "unavailable",
      boundary: "unavailable",
      checkpointValid: false,
      childAbsent: true,
      treeAbsent: false,
      terminationClass: "unexpected-close",
      profileAbsent: true,
      cleanupBlocked: true,
      cleanupCode: "CLEANUP_BLOCKED"
    }
  );
});

test("production-order final checkpoint triggers exact controlled tree teardown", async () => {
  const result = await runFakeChild({
    neverSettle: true,
    stage: "exit-request-ready",
    boundary: "completed",
    timeoutMs: 2_000
  });
  assert.deepEqual(result, {
    exitClass: "exit-0",
    stderrClass: "empty",
    stage: "exit-request-ready",
    boundary: "completed",
    checkpointValid: true,
    childAbsent: true,
    treeAbsent: true,
    terminationClass: "controlled-success",
    profileAbsent: true,
    cleanupBlocked: false,
    cleanupCode: null
  });
});

test("production-order controlled failure preserves one complete safe stage projection", async () => {
  const result = await runFakeChild({
    neverSettle: true,
    stage: "evidence-gates",
    boundary: "entered",
    stderr: "PRODUCTION_ORDER_FIXTURE_FAILED\n",
    timeoutMs: 2_000
  });
  assert.deepEqual(result, {
    exitClass: "exit-1",
    stderrClass: "fixed-runner-code",
    stage: "evidence-gates",
    boundary: "entered",
    checkpointValid: true,
    childAbsent: true,
    treeAbsent: true,
    terminationClass: "controlled-failure",
    profileAbsent: true,
    cleanupBlocked: false,
    cleanupCode: null
  });
});

test("production-order normal root close preserves its profile while an owned descendant remains", async () => {
  const { runProductionOrderChild } = require(lifecyclePath);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-descendant-root-"));
  const marker = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-tree-marker-"));
  const pidFile = path.join(marker, "pid.txt");
  const source = `
    const fs=require('node:fs');
    const childProcess=require('node:child_process');
    const descendant=childProcess.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
    descendant.unref();
    fs.writeFileSync(process.env.AIHUB_DESCENDANT_PID,String(descendant.pid));
    process.exit(1);
  `;
  let descendantPid;
  try {
    const result = await runProductionOrderChild({
      executable: process.execPath,
      args: ["-e", source],
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, AIHUB_DESCENDANT_PID: pidFile },
      profileDirectory: profile,
      timeoutMs: 5_000
    });
    descendantPid = Number(fs.readFileSync(pidFile, "utf8"));
    assert.equal(result.childAbsent, true);
    assert.equal(result.treeAbsent, false);
    assert.equal(result.terminationClass, "unexpected-close");
    assert.equal(result.cleanupCode, "CLEANUP_BLOCKED");
    assert.equal(result.profileAbsent, false);
  } finally {
    if (Number.isSafeInteger(descendantPid)) {
      childProcess.spawnSync(path.join(process.env.SystemRoot, "System32", "taskkill.exe"), ["/PID", String(descendantPid), "/T", "/F"], { shell: false, stdio: "ignore" });
    }
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(marker, { recursive: true, force: true });
  }
});

test("production-order normal close cannot lose an orphan grandchild behind an exited intermediate", async () => {
  const { runProductionOrderChild } = require(lifecyclePath);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-orphan-root-"));
  const marker = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-tree-marker-"));
  const pidFile = path.join(marker, "pid.txt");
  const intermediateSource = `
    const fs=require('node:fs');
    const childProcess=require('node:child_process');
    const grandchild=childProcess.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
    grandchild.unref();
    fs.writeFileSync(process.env.AIHUB_GRANDCHILD_PID,String(grandchild.pid));
    process.exit(0);
  `;
  const rootSource = `
    const childProcess=require('node:child_process');
    const result=childProcess.spawnSync(process.execPath,['-e',${JSON.stringify(intermediateSource)}],{
      env:process.env,stdio:'ignore',shell:false
    });
    if(result.status!==0)process.exit(2);
    process.exit(1);
  `;
  let grandchildPid;
  try {
    const result = await runProductionOrderChild({
      executable: process.execPath,
      args: ["-e", rootSource],
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, AIHUB_GRANDCHILD_PID: pidFile },
      profileDirectory: profile,
      timeoutMs: 5_000
    });
    grandchildPid = Number(fs.readFileSync(pidFile, "utf8"));
    assert.equal(result.childAbsent, true);
    assert.equal(result.treeAbsent, false);
    assert.equal(result.terminationClass, "unexpected-close");
    assert.equal(result.cleanupCode, "CLEANUP_BLOCKED");
    assert.equal(result.profileAbsent, false);
    assert.equal(fs.existsSync(profile), true);
  } finally {
    if (Number.isSafeInteger(grandchildPid)) {
      childProcess.spawnSync(path.join(process.env.SystemRoot, "System32", "taskkill.exe"), ["/PID", String(grandchildPid), "/T", "/F"], { shell: false, stdio: "ignore" });
    }
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(marker, { recursive: true, force: true });
  }
});

test("production-order child error terminates the exact live handle before cleanup", async () => {
  const childProcess = require("node:child_process");
  const originalSpawn = childProcess.spawn;
  const originalSpawnSync = childProcess.spawnSync;
  const originalKill = process.kill;
  const original = require.cache[require.resolve(lifecyclePath)];
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-child-error-"));
  const child = new EventEmitter();
  child.pid = 424242;
  child.exitCode = null;
  child.signalCode = null;
  child.killed = false;
  child.spawnfile = process.execPath;
  child.kill = () => true;
  child.stderr = new EventEmitter();
  let aliveIndex = 0;
  childProcess.spawn = () => child;
  childProcess.spawnSync = () => ({ status: 1, signal: null });
  process.kill = () => {
    const alive = [true, true][Math.min(aliveIndex++, 1)];
    if (alive) return true;
    throw Object.assign(new Error("absent"), { code: "ESRCH" });
  };
  delete require.cache[require.resolve(lifecyclePath)];
  try {
    const lifecycle = require(lifecyclePath);
    const pending = lifecycle.runProductionOrderChild({
      executable: process.execPath,
      args: [],
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env },
      profileDirectory: profile,
      timeoutMs: 1_000
    });
    child.emit("error", new Error("raw child error"));
    const result = await pending;
    assert.equal(result.exitClass, "spawn-error");
    assert.equal(result.treeAbsent, false);
    assert.equal(result.terminationClass, "taskkill-exit");
    assert.equal(result.cleanupCode, "CLEANUP_BLOCKED");
    assert.equal(fs.existsSync(profile), true);
  } finally {
    childProcess.spawn = originalSpawn;
    childProcess.spawnSync = originalSpawnSync;
    process.kill = originalKill;
    delete require.cache[require.resolve(lifecyclePath)];
    if (original) require.cache[require.resolve(lifecyclePath)] = original;
    fs.rmSync(profile, { recursive: true, force: true });
  }
});

test("production-order outer child terminates a never-settling exact child before profile cleanup", async () => {
  const result = await runFakeChild({ neverSettle: true, stage: "renderer-load", boundary: "entered", timeoutMs: 500 });
  assert.deepEqual(result, {
    exitClass: "timeout",
    stderrClass: "empty",
    stage: "renderer-load",
    boundary: "entered",
    checkpointValid: true,
    childAbsent: true,
    treeAbsent: true,
    terminationClass: "none",
    profileAbsent: true,
    cleanupBlocked: false,
    cleanupCode: null
  });
});

test("production-order outer child projects spawn error without deleting before absence verification", async () => {
  const { runProductionOrderChild } = require(lifecyclePath);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-spawn-error-"));
  const result = await runProductionOrderChild({
    executable: path.join(profile, "missing-node.exe"),
    args: [],
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env },
    profileDirectory: profile,
    timeoutMs: 1_000
  });
  assert.deepEqual(result, {
    exitClass: "spawn-error",
    stderrClass: "empty",
    stage: "unavailable",
    boundary: "unavailable",
      checkpointValid: false,
      childAbsent: true,
      treeAbsent: true,
      terminationClass: "spawn-not-started",
    profileAbsent: true,
    cleanupBlocked: false,
    cleanupCode: null
  });
});

test("production-order outer child never projects unexpected sensitive stderr", async () => {
  const result = await runFakeChild({
    exitCode: 1,
    stage: "cancel-request",
    boundary: "entered",
    stderr: "C:\\local\\secret https://invalid.example sk-abcdefghijklmnopqrstuvwxyz1234567890"
  });
  assert.equal(result.stderrClass, "other-safe-class");
  assert.equal(result.stage, "cancel-request");
  assert.equal(result.checkpointValid, true);
  assert.equal(result.childAbsent, true);
  assert.equal(result.treeAbsent, false);
  assert.equal(result.profileAbsent, false);
  assert.equal(result.cleanupCode, "CLEANUP_BLOCKED");
  assert.doesNotMatch(JSON.stringify(result), /local|secret|https|sk-/i);
});

test("production-order runner bounds renderer work and records the fixed lifecycle stages", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  const lifecycle = fs.readFileSync(lifecyclePath, "utf8");
  const cancelEvidence = fs.readFileSync(cancelEvidencePath, "utf8");
  assert.equal((source.match(/\.webContents\.executeJavaScript\(/g) || []).length, 1, "all renderer evaluations must use one hard-timeout seam");
  assert.equal((source.match(/\.loadFile\(/g) || []).length, 1, "renderer load must use one hard-timeout seam");
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*electron\.app\.exit\(2\);[\s\S]*\}, 60_000\)/);
  for (const stage of [
    "main-compile", "ipc-bridge-register", "window-create", "renderer-load", "catalog", "enqueue", "order-gates",
    "convergence", "stale", "evidence-gates", "cancel-status", "cancel-request", "cancel-settle",
    "cancel-list-cleared", "residue", "window-destroy", "exit-request-ready"
  ]) assert.match(`${source}\n${lifecycle}\n${cancelEvidence}`, new RegExp(JSON.stringify(stage)));
  assert.match(source, /runProductionOrderCancelEvidence\(\{/);
  assert.match(source, /fixture formal download must be absent/);
  assert.match(source, /fixture partial download must be removed/);
  assert.match(source, /current handler semantics under a Test facade; it is not the exact production process lifecycle/);
});

test("production-order runner keeps Electron root alive until controlled outer teardown", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  const seam = source.match(
    /function keepProductionOrderRootAlive\(\) \{\}\s*electron\.app\.on\("window-all-closed", keepProductionOrderRootAlive\);/
  );
  assert.ok(seam, "runner must register one named no-op window-all-closed keepalive");

  const registrations = [];
  vm.runInNewContext(seam[0], {
    electron: {
      app: {
        on(event, listener) { registrations.push({ event, listener }); }
      }
    }
  });
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].event, "window-all-closed");
  assert.equal(registrations[0].listener.name, "keepProductionOrderRootAlive");
  assert.doesNotThrow(() => registrations[0].listener());

  const registrationOffset = source.indexOf(seam[0]);
  const windowCreateOffset = source.indexOf("new electron.BrowserWindow");
  const finalCheckpointOffset = source.indexOf('checkpoint.write("exit-request-ready", "completed")');
  assert.ok(registrationOffset >= 0 && registrationOffset < windowCreateOffset);
  assert.ok(finalCheckpointOffset > windowCreateOffset);
  assert.equal((source.match(/electron\.app\.on\("window-all-closed", keepProductionOrderRootAlive\)/g) || []).length, 1);
  assert.doesNotMatch(source, /(?:removeListener|off)\("window-all-closed", keepProductionOrderRootAlive\)/);
});

test("production-order outer process is a 120-second last insurance with bounded output and exact cleanup", () => {
  const source = fs.readFileSync(outerPath, "utf8");
  const lifecycle = fs.readFileSync(lifecyclePath, "utf8");
  assert.match(lifecycle, /stdio:\s*\["ignore", "ignore", "pipe"\]/);
  assert.match(source, /runProductionOrderChild\(\{/);
  assert.match(source, /timeoutMs:\s*120_000/);
  assert.match(source, /assert\.deepEqual\(result,\s*expectedResult/);
  assert.doesNotMatch(source, /assert\.equal\(result\.(?:exitClass|stage|boundary)/);
  assert.doesNotMatch(source, /console\.error|stderr \+=|stderr\.bytes\(\)/);
});
