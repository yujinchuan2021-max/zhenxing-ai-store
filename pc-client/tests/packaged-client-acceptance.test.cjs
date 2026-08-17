"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const acceptancePath = path.join(root, "scripts", "lib", "packaged-client-acceptance.mjs");
const receiptPath = path.join(root, "scripts", "lib", "server-connected-review-receipt.mjs");

async function importFresh(file) {
  return import(`${pathToFileURL(file).href}?test=${Date.now()}-${Math.random()}`);
}

async function importFormalAcceptanceProbe() {
  const cdpUrl = pathToFileURL(path.join(root, "scripts", "lib", "packaged-client-cdp.mjs")).href;
  const receiptUrl = pathToFileURL(receiptPath).href;
  const source = fs.readFileSync(acceptancePath, "utf8")
    .replace('from "./packaged-client-cdp.mjs"', `from ${JSON.stringify(cdpUrl)}`)
    .replace('from "./server-connected-review-receipt.mjs"', `from ${JSON.stringify(receiptUrl)}`)
    .replace("const require = createRequire(import.meta.url);", `const require = createRequire(${JSON.stringify(acceptancePath)});`)
    .replace(/const root = path\.resolve\([^\n]+\);/, `const root = ${JSON.stringify(root)};`);
  const instrumented = `${source}\nexport { cancelByDom as probeCancelByDom, createCheckpointWriter as probeCreateCheckpointWriter, finalizeTaskDeliveryProbe as probeFinalizeTaskDeliveryProbe, taskDeliveryFailureCode as probeTaskDeliveryFailureCode, waitForCancellationReady as probeWaitForCancellationReady };\n`;
  return import(`data:text/javascript;base64,${Buffer.from(instrumented).toString("base64")}#${Date.now()}-${Math.random()}`);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("the formal acceptance module exposes only its runner", async () => {
  const module = await importFresh(acceptancePath);
  assert.equal(typeof module.runServerConnectedReviewAcceptance, "function");
  assert.deepEqual(Object.keys(module), ["runServerConnectedReviewAcceptance"]);
});

test("task-dom checkpoints accept only the raw delivery projection", async (t) => {
  const { probeCreateCheckpointWriter } = await importFormalAcceptanceProbe();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-task-delivery-checkpoint-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const statusPath = path.join(directory, "STATUS.json");
  const checkpoint = probeCreateCheckpointWriter(statusPath);
  const actual = {
    scenarioClass: "active",
    listBeforePhase: "downloading",
    listAfterPhase: "downloading",
    statusEnvelopeClass: "ok",
    statusPhase: "downloading",
    domPhase: "queued",
    sameAttempt: true,
    receivedBytesClass: "positive",
    failureClass: "other",
    partPresent: true,
    sampleGapBucket: "under-100ms",
    rawEventDeliveryClass: "same-attempt-observed",
    rawEventCountClass: "multiple",
    rawObserverArmedBeforeEnqueue: true,
    rendererErrorClass: "none"
  };
  checkpoint("task-dom", "running", null, actual);
  assert.deepEqual(JSON.parse(fs.readFileSync(statusPath, "utf8")).actual, actual);
  checkpoint("deterministic-renderer", "passed", null, { passed: true });
  assert.deepEqual(JSON.parse(fs.readFileSync(statusPath, "utf8")).actual, { passed: true });
  assert.throws(() => checkpoint("deterministic-renderer", "passed", null, { passed: "yes" }), /CHECKPOINT_VALUE_INVALID/);
  assert.throws(() => checkpoint("task-dom", "running", null, { ...actual, rawEventDeliveryClass: "attempt-raw-identity" }), /CHECKPOINT_VALUE_INVALID/);
  assert.throws(() => checkpoint("task-dom", "running", null, { ...actual, rendererErrorClass: "https:\/\/raw.invalid" }), /CHECKPOINT_VALUE_INVALID/);
  assert.throws(() => checkpoint("task-dom", "running", null, { ...actual, taskId: "must-not-be-written" }), /CHECKPOINT_UNKNOWN_KEY/);
});

test("the formal runner arms and disposes one additive raw-event observer", () => {
  const source = fs.readFileSync(acceptancePath, "utf8");
  const errorCollector = source.indexOf("window.__acceptanceErrors=");
  const attempted = source.indexOf("deliveryProbeAttempted = true");
  const install = source.indexOf("installPackagedDownloadTaskDeliveryProbe({ evaluate, productIds: requiredIds })");
  const firstTarget = source.indexOf("const live = await startActiveAttempt(");
  const dispose = source.indexOf("await finalizeTaskDeliveryProbe({ attempted: deliveryProbeAttempted");
  assert.ok(errorCollector >= 0 && attempted > errorCollector && install > attempted && firstTarget > install);
  assert.ok(dispose > firstTarget);
  assert.match(source, /DOWNLOAD_TASK_OBSERVER_UNAVAILABLE/);
  assert.doesNotMatch(source, /window\.aihubPC\.onDownloadTask\s*=/);
  assert.doesNotMatch(source, /defineProperty\s*\(\s*window\.aihubPC/);
});

test("the formal gate blocks a downloading target without its same-attempt raw event", async () => {
  const { probeTaskDeliveryFailureCode } = await importFormalAcceptanceProbe();
  const actual = {
    listBeforePhase: "downloading",
    statusPhase: "downloading",
    listAfterPhase: "downloading",
    sameAttempt: true,
    rawEventDeliveryClass: "not-observed",
    rawObserverArmedBeforeEnqueue: true,
    rendererErrorClass: "none"
  };
  assert.equal(probeTaskDeliveryFailureCode(actual, { requireSame: true }), "DOWNLOAD_TASK_EVENT_NOT_OBSERVED");
  assert.equal(probeTaskDeliveryFailureCode({ ...actual, rendererErrorClass: "page" }, { requireSame: true }), "DOWNLOAD_TASK_RENDERER_ERROR");
  assert.equal(probeTaskDeliveryFailureCode({ ...actual, rawEventDeliveryClass: "same-attempt-observed" }, { requireSame: true }), null);
});

test("packaged live convergence rejects a queued four-phase sample before a later terminal", async (t) => {
  const { probeWaitForCancellationReady } = await importFormalAcceptanceProbe();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-live-phase-probe-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const partPath = path.join(directory, "fixture.exe.part");
  fs.writeFileSync(partPath, "positive-byte-fixture");
  const queued = {
    productId: "fixture-product",
    taskId: "fixture-attempt",
    phase: "queued",
    progress: { receivedBytes: 512 },
    presentation: { state: "queued", canCancel: true, canRetry: false }
  };
  const terminal = { ...queued, phase: "failed", presentation: { state: "failed", canCancel: false, canRetry: true } };
  let listCalls = 0;
  const currentTask = () => listCalls < 3 ? queued : terminal;
  const evaluate = async (expression) => {
    if (expression.includes("if(document.querySelector('.settingsPanel'))") || expression === "Boolean(document.querySelector('.settingsPanel'))") return true;
    if (expression === "window.aihubPC.listManagedDownloadTasks()") {
      listCalls += 1;
      return [currentTask()];
    }
    if (expression.startsWith("window.aihubPC.getManagedDownloadTaskStatus")) return { ok: true, task: currentTask() };
    if (expression.includes("const row=[...document.querySelectorAll('.managedQueueTask')")) {
      return { rendererPhaseClass: currentTask().phase, rowPresent: true, buttonPresent: true, buttonDisabled: false };
    }
    if (expression.includes("__aihubPackagedAcceptanceTaskDeliveryProbe")) {
      return { rawEventDeliveryClass: "same-attempt-observed", rawEventCountClass: "multiple", rawObserverArmedBeforeEnqueue: true, rendererErrorClass: "none" };
    }
    throw new Error(`unexpected live phase evaluation: ${expression.slice(0, 80)}`);
  };
  const checkpoints = [];
  const scenarioMatrix = { deterministicRenderer: true, packagedLiveConvergence: false };
  await assert.rejects((async () => {
    await probeWaitForCancellationReady({
      evaluate,
      productId: queued.productId,
      partPath,
      scenarioClass: "packaged-live-convergence",
      checkpoint: (stage, status, code, actual) => checkpoints.push({ stage, status, code, actual }),
      allowTerminal: true,
      expectedPhase: "downloading",
      timeoutMs: 50
    });
    scenarioMatrix.packagedLiveConvergence = true;
  })(), /TARGET_PRECONDITION_DRIFT/);
  assert.equal(scenarioMatrix.packagedLiveConvergence, false);
  assert.equal(checkpoints.at(-1)?.stage, "task-dom");
  assert.equal(checkpoints.at(-1)?.status, "blocked");
  assert.equal(checkpoints.at(-1)?.code, "TARGET_PRECONDITION_DRIFT");
  assert.deepEqual([
    checkpoints.at(-1)?.actual?.listBeforePhase,
    checkpoints.at(-1)?.actual?.statusPhase,
    checkpoints.at(-1)?.actual?.listAfterPhase,
    checkpoints.at(-1)?.actual?.domPhase
  ], ["queued", "queued", "queued", "queued"]);
  assert.equal(checkpoints.at(-1)?.actual?.receivedBytesClass, "positive");
  assert.equal(checkpoints.at(-1)?.actual?.rawEventDeliveryClass, "same-attempt-observed");
});

test("the formal finally proves observer disposal and fails closed when disposal is unavailable", async () => {
  const { probeFinalizeTaskDeliveryProbe } = await importFormalAcceptanceProbe();
  const { installPackagedDownloadTaskDeliveryProbe } = await importFresh(path.join(root, "scripts", "lib", "packaged-client-cdp.mjs"));
  const listeners = [];
  const window = {
    __acceptanceErrors: { console: 0, page: 0, rejection: 0 },
    aihubPC: Object.freeze({
      onDownloadTask(callback) {
        listeners.push(callback);
        return () => listeners.splice(listeners.indexOf(callback), 1);
      },
      async listManagedDownloadTasks() { return []; }
    })
  };
  const context = vm.createContext({ window, Object, Array, Set, Map, JSON, Boolean, Number, String });
  const evaluate = async (expression) => vm.runInContext(expression, context);
  const installed = await installPackagedDownloadTaskDeliveryProbe({ evaluate, productIds: ["fixture-product"] });
  assert.equal(installed.rawObserverArmedBeforeEnqueue, true);
  assert.equal(listeners.length, 1);
  const retained = { observerDisposed: false };
  const checkpoints = [];
  await probeFinalizeTaskDeliveryProbe({
    attempted: true,
    evaluate,
    checkpoint: (stage, status, code, actual) => checkpoints.push({ stage, status, code, actual }),
    retained,
    acceptanceFailed: false
  });
  assert.equal(retained.observerDisposed, true);
  assert.equal(listeners.length, 0);
  assert.deepEqual(checkpoints, [{ stage: "observer-dispose", status: "passed", code: null, actual: { disposed: true } }]);

  const failedRetained = { observerDisposed: true };
  const failedCheckpoints = [];
  await probeFinalizeTaskDeliveryProbe({
    attempted: true,
    evaluate: async () => { throw new Error("fixture dispose failure with raw detail"); },
    checkpoint: (stage, status, code, actual) => failedCheckpoints.push({ stage, status, code, actual }),
    retained: failedRetained,
    acceptanceFailed: true
  });
  assert.equal(failedRetained.observerDisposed, false);
  assert.equal(failedRetained.observerCleanupCode, "DOWNLOAD_TASK_OBSERVER_DISPOSE_FAILED");
  assert.deepEqual(failedCheckpoints, []);
  assert.doesNotMatch(JSON.stringify(failedRetained), /raw detail/);

  const noPrimaryRetained = { observerDisposed: true, observerCleanupCode: null };
  const noPrimaryCheckpoints = [];
  await assert.rejects(probeFinalizeTaskDeliveryProbe({
    attempted: true,
    evaluate: async () => { throw new Error("second raw dispose detail"); },
    checkpoint: (stage, status, code, actual) => noPrimaryCheckpoints.push({ stage, status, code, actual }),
    retained: noPrimaryRetained,
    acceptanceFailed: false
  }), /DOWNLOAD_TASK_OBSERVER_DISPOSE_FAILED/);
  assert.deepEqual(noPrimaryCheckpoints, [{
    stage: "observer-dispose",
    status: "blocked",
    code: "DOWNLOAD_TASK_OBSERVER_DISPOSE_FAILED",
    actual: { disposed: false }
  }]);
  assert.doesNotMatch(JSON.stringify(noPrimaryCheckpoints), /raw dispose detail/);
});

test("the formal runner uses one active packaged task and has no live queued-support constructor", () => {
  const source = fs.readFileSync(acceptancePath, "utf8");
  const body = source.match(/async function runAcceptance\([\s\S]*?\n}\n\nexport async function runServerConnectedReviewAcceptance/)?.[0] || "";
  assert.equal((body.match(/startActiveAttempt\(/g) || []).length, 1);
  assert.match(body, /allowTerminal:\s*true/);
  assert.doesNotMatch(source, /supportProductIds|requiredIds\.slice\(2\)/);
});

test("the formal runner separates one packaged convergence from the deterministic renderer contract", () => {
  const source = fs.readFileSync(acceptancePath, "utf8");
  const body = source.match(/async function runAcceptance\([\s\S]*?\n}\n\nexport async function runServerConnectedReviewAcceptance/)?.[0] || "";
  assert.match(body, /runPackagedManagedDownloadFixtureGate\(\)/);
  assert.match(body, /const fixtureFailureClass = FIXTURE_FAILURE_CLASSES\.has\(error\?\.failureClass\) \? error\.failureClass : "spawn-error"/);
  assert.match(body, /failAfterCheckpoint\(checkpoint, "deterministic-renderer", "DETERMINISTIC_RENDERER_FIXTURE_FAILED", \{ passed: false, fixtureFailureClass \}\)/);
  assert.match(body, /scenarioMatrix\.deterministicRenderer\s*=\s*true/);
  assert.match(body, /scenarioMatrix\.packagedLiveConvergence\s*=\s*true/);
  assert.equal((body.match(/startActiveAttempt\(/g) || []).length, 1);
  assert.doesNotMatch(body, /visualActiveScenario\(|dismissActiveFixture\(|independentBefore|invalidCancelMatrix\(/);
  assert.match(body, /allowTerminal:\s*true/);
  assert.doesNotMatch(body, /capturePackagedScreenshot\(/);
});

test("the deterministic renderer checkpoint accepts only the fixed fixture failure classes", async () => {
  const { probeCreateCheckpointWriter } = await importFormalAcceptanceProbe();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deterministic-renderer-checkpoint-"));
  const statusPath = path.join(directory, "STATUS.json");
  try {
    const checkpoint = probeCreateCheckpointWriter(statusPath);
    checkpoint("deterministic-renderer", "blocked", "DETERMINISTIC_RENDERER_FIXTURE_FAILED", { passed: false, fixtureFailureClass: "stdout" });
    assert.deepEqual(JSON.parse(fs.readFileSync(statusPath, "utf8")).actual, { passed: false, fixtureFailureClass: "stdout" });
    assert.throws(() => checkpoint("deterministic-renderer", "blocked", "DETERMINISTIC_RENDERER_FIXTURE_FAILED", { passed: false, fixtureFailureClass: "RAW_OUTPUT_TOKEN" }), /CHECKPOINT_VALUE_INVALID/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("a terminal live task after convergence is cleanup, not fixture exhaustion", async () => {
  const { probeCancelByDom } = await importFormalAcceptanceProbe();
  const task = {
    productId: "fixture-product",
    taskId: "fixture-attempt",
    phase: "failed",
    progress: { receivedBytes: 8, totalBytes: 16, bytesPerSecond: 0, percent: 50 },
    presentation: { state: "failed", canCancel: false, canRetry: true }
  };
  const evaluate = async (expression) => {
    if (expression.includes("document.querySelector('.settingsPanel')") || expression === "Boolean(document.querySelector('.settingsPanel'))") return true;
    if (expression.includes("__aihubPackagedAcceptanceTaskDeliveryProbe")) return {
      rawEventDeliveryClass: "same-attempt-observed",
      rawEventCountClass: "multiple",
      rawObserverArmedBeforeEnqueue: true,
      rendererErrorClass: "none"
    };
    if (expression === "window.aihubPC.listManagedDownloadTasks()") return [task];
    if (expression.startsWith("window.aihubPC.getManagedDownloadTaskStatus")) return { ok: true, task };
    if (expression.includes("document.querySelectorAll('.managedQueueTask')")) {
      return { rendererPhaseClass: "failed", rowPresent: true, buttonPresent: false, buttonDisabled: false };
    }
    throw new Error("unexpected live cleanup evaluation");
  };
  const checkpoints = [];
  const result = await probeCancelByDom({
    evaluate,
    entry: { product: { id: task.productId, download: { fileName: "fixture.bin" } } },
    checkpoint: (...entry) => checkpoints.push(entry),
    scenario: "live-cleanup",
    profile: { downloadDirectory: os.tmpdir() },
    allowTerminal: true,
    expectedTaskId: task.taskId,
    expectedPhase: "downloading"
  });
  assert.equal(result.state, "terminal");
  assert.deepEqual(checkpoints, []);

  const postDialogCheckpoints = [];
  const postDialog = await probeCancelByDom({
    evaluate: async (expression) => {
      if (expression === "window.aihubPC.listManagedDownloadTasks()") return [task];
      if (expression.startsWith("(async()=>")) return {
        listBefore: task,
        status: { ok: true, task },
        listAfter: task,
        dom: { rendererPhaseClass: "failed", rowPresent: true, buttonPresent: false, buttonDisabled: false },
        clicked: false
      };
      throw new Error("unexpected post-dialog cleanup evaluation");
    },
    entry: { product: { id: task.productId, download: { fileName: "fixture.bin" } } },
    checkpoint: (...entry) => postDialogCheckpoints.push(entry),
    scenario: "live-cleanup",
    profile: { downloadDirectory: os.tmpdir() },
    allowTerminal: true,
    expectedTaskId: task.taskId,
    expectedPhase: "downloading",
    dialogAlreadyOpen: true
  });
  assert.equal(postDialog.state, "terminal");
  assert.deepEqual(postDialogCheckpoints, []);

  const absentCheckpoints = [];
  const absent = await probeCancelByDom({
    evaluate: async (expression) => {
      if (expression === "window.aihubPC.listManagedDownloadTasks()") return [];
      throw new Error("cleanup must stop after the owned task is absent");
    },
    entry: { product: { id: task.productId, download: { fileName: "fixture.bin" } } },
    checkpoint: (...entry) => absentCheckpoints.push(entry),
    scenario: "live-cleanup",
    profile: { downloadDirectory: os.tmpdir() },
    allowTerminal: true,
    expectedTaskId: task.taskId,
    expectedPhase: "downloading"
  });
  assert.equal(absent.state, "absent");
  assert.deepEqual(absentCheckpoints, []);
});

test("the formal open-dialog destructive recheck checkpoints terminal exhaustion with the caller code", async (t) => {
  const source = fs.readFileSync(acceptancePath, "utf8");
  assert.match(source, /terminalFailureCode = "TARGET_TERMINAL_BEFORE_CANCEL"/);
  const retiredTerminalCode = ["DOWNLOAD", "TERMINAL", "BEFORE", "CANCEL"].join("_");
  assert.doesNotMatch(source, new RegExp(retiredTerminalCode));
  assert.match(
    source,
    /if \(allowTerminal\) return \{ state: "terminal", taskId: expected, actual: actionActual \};[\s\S]*failAfterCheckpoint\(checkpoint, "cancel", terminalFailureCode, actionActual\);/
  );
  assert.doesNotMatch(
    source,
    /if \(confirmed\.state === "terminal"\) failAfterCheckpoint\(checkpoint, "cancel", "TARGET_TERMINAL_BEFORE_CANCEL", actionActual\);/
  );
  const { probeCancelByDom } = await importFormalAcceptanceProbe();
  const downloadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-formal-terminal-probe-"));
  t.after(() => fs.rmSync(downloadDirectory, { recursive: true, force: true }));
  const finalPath = path.join(downloadDirectory, "fixture.bin");
  const finalBytes = Buffer.from("completed-fixture", "utf8");
  fs.writeFileSync(finalPath, finalBytes);
  const task = {
    productId: "fixture-product",
    taskId: "fixture-attempt",
    phase: "downloaded",
    progress: { receivedBytes: 8, totalBytes: 8, bytesPerSecond: 0, percent: 100 },
    presentation: { state: "terminal", canCancel: false, canRetry: false }
  };
  let listCalls = 0;
  let dangerClickCount = 0;
  const evaluate = async (expression) => {
    if (expression === "window.aihubPC.listManagedDownloadTasks()") {
      listCalls += 1;
      return [{ ...task, phase: "downloading", presentation: { state: "active", canCancel: true, canRetry: false } }];
    }
    if (expression.startsWith("(async()=>")) {
      const clicked = false;
      if (clicked) dangerClickCount += 1;
      return {
        listBefore: task,
        status: { ok: true, task },
        listAfter: task,
        dom: { rendererPhaseClass: "downloaded", rowPresent: true, buttonPresent: false, buttonDisabled: false },
        clicked
      };
    }
    throw new Error("unexpected formal probe evaluation");
  };
  const checkpoints = [];
  await assert.rejects(
    probeCancelByDom({
      evaluate,
      entry: { product: { id: "fixture-product", download: { fileName: "fixture.bin" } } },
      checkpoint: (stage, status, code, actual) => checkpoints.push({ stage, status, code, actual }),
      scenario: "active-visual",
      profile: { downloadDirectory },
      expectedTaskId: "fixture-attempt",
      dialogAlreadyOpen: true,
      terminalFailureCode: "ACTIVE_FIXTURE_EXHAUSTED"
    }),
    /ACTIVE_FIXTURE_EXHAUSTED/
  );
  assert.equal(listCalls, 1);
  assert.equal(dangerClickCount, 0);
  assert.equal(fs.existsSync(finalPath), true);
  assert.deepEqual(fs.readFileSync(finalPath), finalBytes);
  assert.deepEqual(checkpoints, [{
    stage: "cancel",
    status: "blocked",
    code: "ACTIVE_FIXTURE_EXHAUSTED",
    actual: {
      scenario: "active-visual",
      requestExact: false,
      expectedCurrentAttempt: true,
      listBeforePhase: "downloaded",
      statusEnvelopeClass: "ok",
      statusPhase: "downloaded",
      listAfterPhase: "downloaded",
      domPhase: "downloaded",
      canCancel: false,
      buttonPresent: false,
      buttonDisabled: false,
      receivedBytesClass: "positive",
      responseOk: false,
      terminalPhaseClass: "other",
      partCount: 0,
      formalCount: 1
    }
  }]);
});

test("the formal result contains active-target and physical cleanup facts without retired support evidence", () => {
  const source = fs.readFileSync(acceptancePath, "utf8");
  assert.doesNotMatch(source, /EMPTY_SUPPORT|SUPPORT_TERMINAL_CLASSES|acceptanceSupport/);
  assert.doesNotMatch(source, /supportTerminalCount|supportResidueCount|supportActiveCount|supportTerminalClass|nonSupportTaskCount|unknownFileCount/);
  assert.doesNotMatch(source, /"support"|\bsupport\s*[:,=]/);
  assert.match(source, /targetResidueCount/);
  assert.match(source, /inspectPackagedAcceptancePhysicalCleanup/);
});

test("the formal fixed target is the signed-catalog FineVoice artifact", () => {
  const source = fs.readFileSync(acceptancePath, "utf8");
  assert.match(source, /const requiredIds = \["finevoice-desktop"\]/);
  assert.match(source, /const fineVoice = entries\.get\(requiredIds\[0\]\)/);
  assert.match(source, /fineVoice\.product\.installProfileId !== "desktop-download-only\.finevoice-desktop"/);
  assert.match(source, /entry:\s*fineVoice/);
  assert.doesNotMatch(source, /wondershare-filmora|const filmora|entry: filmora|blender|cursor-desktop|alibaba-qoderwork-cn/);
});

test("the public runner fails closed before creating evidence for a mismatched artifact", async () => {
  const { runServerConnectedReviewAcceptance } = await importFresh(acceptancePath);
  const evidenceDirectory = path.join(root, "output", `acceptance-interface-fixture-${process.pid}`);
  assert.equal(fs.existsSync(evidenceDirectory), false);
  await assert.rejects(
    runServerConnectedReviewAcceptance({
      version: "0.1.64",
      portablePath: __filename,
      artifactSha256: "a".repeat(64),
      expectedPackageAsarSha256: "b".repeat(64),
      expectedCatalogChannelSha256: "c".repeat(64),
      expectedUpdateChannelSha256: "d".repeat(64),
      evidenceDirectory
    }),
    /ACCEPTANCE_ARTIFACT_MISMATCH/
  );
  assert.equal(fs.existsSync(evidenceDirectory), false);
});

test("the formal CLI only derives fixed paths and calls the runner", () => {
  const source = fs.readFileSync(path.join(root, "scripts", "accept-server-connected-review.mjs"), "utf8");
  assert.match(source, /runServerConnectedReviewAcceptance\(\{/);
  assert.match(source, /release-review-server-connected-\$\{version\}-candidate/);
  assert.match(source, /windows-client-\$\{version\}-package-acceptance/);
  assert.doesNotMatch(source, /managedQueueTask|cancelManagedDownload|Page\.captureScreenshot|electron-builder/);
  const invalid = spawnSync(process.execPath, [path.join(root, "scripts", "accept-server-connected-review.mjs")], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stderr, "");
  assert.deepEqual(JSON.parse(invalid.stdout), {
    status: "BLOCKED",
    stage: "preflight",
    code: "ACCEPTANCE_ARGUMENT_INVALID",
    finalReport: null,
    finalSha256: null
  });
});

test("formal runtime closure requires matching complete BUILD and FREEZE records", async (t) => {
  const { readServerConnectedReviewRuntimeClosure } = await importFresh(receiptPath);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-runtime-closure-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const version = "0.1.87";
  const buildPath = path.join(directory, `ZhenXing-AI-Server-Connected-Review-${version}-BUILD.json`);
  const freezePath = path.join(directory, `ZhenXing-AI-Server-Connected-Review-${version}-PACKAGE-FREEZE.json`);
  const hashes = { asarSha256: "a".repeat(64), catalogChannelSha256: "b".repeat(64), updateChannelSha256: "c".repeat(64) };
  const names = {
    portable: `ZhenXing-AI-Server-Connected-Review-${version}-Windows-x64-Portable.exe`,
    setup: `ZhenXing-AI-Server-Connected-Review-${version}-Windows-x64-Setup.exe`,
    blockmap: `ZhenXing-AI-Server-Connected-Review-${version}-Windows-x64-Setup.exe.blockmap`
  };
  const buildArtifacts = Object.values(names).map((name, index) => ({ name, sha256: String(index + 4).repeat(64), fileSize: index + 1 }));
  const freezeArtifacts = Object.entries(names).map(([kind, name], index) => ({ kind, name, bytes: index + 1, sha256: String(index + 4).repeat(64) }));
  const build = {
    schemaVersion: 1,
    version,
    builtAt: "2026-08-13T00:00:00.000Z",
    source: { revision: "d".repeat(40), dirty: true, versionTag: null },
    artifacts: buildArtifacts,
    packageInvocationCount: 1,
    packageAsarSha256: hashes.asarSha256,
    packageCatalogChannelSha256: hashes.catalogChannelSha256,
    packageUpdateChannelSha256: hashes.updateChannelSha256
  };
  const freeze = {
    schemaVersion: 1,
    version,
    status: "package-complete",
    packageInvocationCount: 1,
    formalAcceptanceInvocationCount: 0,
    artifacts: freezeArtifacts,
    closure: {
      packageVersionExact: true,
      mainExact: true,
      preloadExact: true,
      rendererExact: true,
      identityLoginExact: true,
      downloadedPackageActionExact: true,
      downloadTaskExact: true,
      managedDownloadNetworkExact: true,
      managedDownloadQueueExact: true,
      secretFilesScanned: 1,
      secretFindings: 0,
      prohibitedTopLevelCount: 0,
      ...hashes,
      catalogSource: "remote",
      catalogVersion: 7,
      catalogKeyId: "catalog-fixture"
    },
    remainingGate: {
      code: "FORMAL_PACKAGED_ACCEPTANCE_NOT_RUN",
      status: "pending",
      blockingPackage: false,
      localizedCatalogEnglishAcceptance: "not-closed",
      communityRedirectAcceptance: "not-closed"
    },
    installerLaunched: false,
    installed: false,
    uploaded: false,
    published: false,
    userMachineAcceptance: false
  };
  const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value)}\n`);
  write(buildPath, build);
  write(freezePath, freeze);
  assert.deepEqual(readServerConnectedReviewRuntimeClosure({ packageDirectory: directory, version }), hashes);

  const innoBuild = { ...build, artifacts: buildArtifacts.slice(0, 2) };
  const innoFreeze = { ...freeze, artifacts: freezeArtifacts.slice(0, 2) };
  write(buildPath, innoBuild);
  write(freezePath, innoFreeze);
  assert.deepEqual(
    readServerConnectedReviewRuntimeClosure({ packageDirectory: directory, version }),
    hashes,
    "an Inno package has Setup and Portable without an NSIS blockmap"
  );
  write(buildPath, build);
  write(freezePath, freeze);

  const cases = [
    ["BUILD missing", null, freeze],
    ["FREEZE missing", build, null],
    ["BUILD bad SHA", { ...build, packageCatalogChannelSha256: "bad" }, freeze],
    ["FREEZE bad SHA", build, { ...freeze, closure: { ...freeze.closure, updateChannelSha256: "bad" } }],
    ["ASAR drift", build, { ...freeze, closure: { ...freeze.closure, asarSha256: "f".repeat(64) } }],
    ["catalog drift", build, { ...freeze, closure: { ...freeze.closure, catalogChannelSha256: "f".repeat(64) } }],
    ["update drift", build, { ...freeze, closure: { ...freeze.closure, updateChannelSha256: "f".repeat(64) } }],
    ["BUILD invocation drift", { ...build, packageInvocationCount: 0 }, freeze],
    ["FREEZE invocation drift", build, { ...freeze, packageInvocationCount: 0 }],
    ["BUILD schema drift", { ...build, extra: true }, freeze],
    ["FREEZE schema drift", build, { ...freeze, extra: true }],
    ["closure unknown", build, { ...freeze, closure: { ...freeze.closure, extra: true } }],
    ["closure missing", build, { ...freeze, closure: Object.fromEntries(Object.entries(freeze.closure).filter(([key]) => key !== "mainExact")) }],
    ["remaining unknown", build, { ...freeze, remainingGate: { ...freeze.remainingGate, extra: true } }],
    ["remaining missing", build, { ...freeze, remainingGate: Object.fromEntries(Object.entries(freeze.remainingGate).filter(([key]) => key !== "code")) }],
    ["artifact unknown", { ...build, artifacts: [{ ...build.artifacts[0], extra: true }, ...build.artifacts.slice(1)] }, freeze],
    ["artifact bad type", build, { ...freeze, artifacts: [{ ...freeze.artifacts[0], bytes: "1" }, ...freeze.artifacts.slice(1)] }],
    ["artifact drift", build, { ...freeze, artifacts: [{ ...freeze.artifacts[0], sha256: "f".repeat(64) }, ...freeze.artifacts.slice(1)] }],
    ["source bad", { ...build, source: { ...build.source, revision: "bad" } }, freeze],
    ["builtAt bad", { ...build, builtAt: "yesterday" }, freeze]
  ];
  for (const [name, nextBuild, nextFreeze] of cases) {
    fs.rmSync(buildPath, { force: true });
    fs.rmSync(freezePath, { force: true });
    if (nextBuild) write(buildPath, nextBuild);
    if (nextFreeze) write(freezePath, nextFreeze);
    assert.throws(
      () => readServerConnectedReviewRuntimeClosure({ packageDirectory: directory, version }),
      (error) => error.message === "PACKAGE_RUNTIME_CLOSURE_INVALID",
      name
    );
  }
});

test("formal ASAR provenance uses only the already-bound runtime closure", () => {
  const source = fs.readFileSync(acceptancePath, "utf8");
  assert.doesNotMatch(source, /function locateAsar|AIHUB_ACCEPTANCE_USER_DATA|Get-CimInstance Win32_Process/);
  assert.match(source, /inspectAsar\(client\.runtimeClosure\.appAsar, expectedPackageAsarSha256\)/);
});

test("download-task owns projection and cancellation behavior", () => {
  const taskModule = require(path.join(root, "shared", "download-task.cjs"));
  const task = (phase) => ({
    productId: "package-contract",
    attemptId: "attempt-1",
    phase,
    progress: { receivedBytes: 1, totalBytes: 2, bytesPerSecond: 1, percent: 50 }
  });
  assert.equal(taskModule.projectManagedDownloadTask(task("starting"), { profileId: "fixed-profile" }).phase, "queued");
  assert.equal(taskModule.projectManagedDownloadTask(task("canceling"), { profileId: "fixed-profile" }).phase, "downloading");
  assert.equal(taskModule.projectManagedDownloadTask(task("canceled"), { profileId: "fixed-profile" }).phase, "cancelled");
  assert.equal(taskModule.authorizeManagedDownloadCancellation({
    request: { productId: "package-contract", taskId: "attempt-1", confirmed: true },
    task: task("completed"),
    plan: { downloadPolicy: "desktop-download-only" }
  }).errorCode, "DOWNLOAD_ALREADY_COMPLETED");

  const context = vm.createContext({ module: { exports: taskModule } });
  const crossRealm = vm.runInContext("({productId:'package-contract',taskId:'attempt-1',confirmed:true})", context);
  assert.equal(taskModule.authorizeManagedDownloadCancellation({
    request: crossRealm,
    task: task("downloading"),
    plan: { downloadPolicy: "desktop-download-only" }
  }).errorCode, "DOWNLOAD_CANCEL_REQUEST_INVALID");
});

test("package and acceptance invocations use one exclusive receipt module", async () => {
  const receipts = await importFresh(receiptPath);
  assert.deepEqual(Object.keys(receipts).sort(), [
    "claimServerConnectedReviewInvocation",
    "readServerConnectedReviewPackageInvocation",
    "readServerConnectedReviewRuntimeClosure"
  ]);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-review-receipt-"));
  try {
    for (const kind of ["package", "acceptance"]) {
      const receipt = receipts.claimServerConnectedReviewInvocation({
        directory,
        kind,
        version: "0.1.64",
        artifactSha256: "a".repeat(64)
      });
      assert.equal(receipt.invocationCount, 1);
      assert.throws(() => receipts.claimServerConnectedReviewInvocation({
        directory,
        kind,
        version: "0.1.64",
        artifactSha256: "a".repeat(64)
      }), new RegExp(`${kind.toUpperCase()}_ALREADY_INVOKED`));
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("acceptance trusts only the exact package invocation receipt", async () => {
  const receipts = await importFresh(receiptPath);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-package-receipt-"));
  try {
    const portable = path.join(directory, "review.exe");
    fs.writeFileSync(portable, "fixture");
    receipts.claimServerConnectedReviewInvocation({
      directory,
      kind: "package",
      version: "0.1.64",
      artifactSha256: null
    });
    assert.equal(receipts.readServerConnectedReviewPackageInvocation({
      portablePath: portable,
      version: "0.1.64"
    }).invocationCount, 1);
    assert.throws(() => receipts.readServerConnectedReviewPackageInvocation({
      portablePath: portable,
      version: "0.1.65"
    }), /PACKAGE_RECEIPT_INVALID/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the package receipt reader rejects unknown fields", async () => {
  const receipts = await importFresh(receiptPath);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-package-receipt-tamper-"));
  try {
    const portable = path.join(directory, "review.exe");
    fs.writeFileSync(portable, "fixture");
    const control = path.join(directory, "PACKAGE-CONTROL.json");
    receipts.claimServerConnectedReviewInvocation({ directory, kind: "package", version: "0.1.64", artifactSha256: null });
    const value = JSON.parse(fs.readFileSync(control, "utf8"));
    fs.writeFileSync(control, `${JSON.stringify({ ...value, extra: true })}\n`, "utf8");
    assert.throws(() => receipts.readServerConnectedReviewPackageInvocation({ portablePath: portable, version: "0.1.64" }), /PACKAGE_RECEIPT_INVALID/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the public runner rejects evidence outside output before launch", async () => {
  const { runServerConnectedReviewAcceptance } = await importFresh(acceptancePath);
  const receipts = await importFresh(receiptPath);
  const directory = fs.mkdtempSync(path.join(root, "output", "acceptance-outside-fixture-"));
  const outside = path.join(os.tmpdir(), `acceptance-outside-${process.pid}-${Date.now()}`);
  try {
    const portable = path.join(directory, "review.exe");
    fs.writeFileSync(portable, "fixture");
    receipts.claimServerConnectedReviewInvocation({ directory, kind: "package", version: "0.1.64", artifactSha256: null });
    await assert.rejects(runServerConnectedReviewAcceptance({
      version: "0.1.64",
      portablePath: portable,
      artifactSha256: sha256(portable),
      expectedPackageAsarSha256: "b".repeat(64),
      expectedCatalogChannelSha256: "c".repeat(64),
      expectedUpdateChannelSha256: "d".repeat(64),
      evidenceDirectory: outside
    }), /ACCEPTANCE_EVIDENCE_OUTSIDE_OUTPUT/);
    assert.equal(fs.existsSync(outside), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the public runner rejects an existing evidence directory before launch", async () => {
  const { runServerConnectedReviewAcceptance } = await importFresh(acceptancePath);
  const receipts = await importFresh(receiptPath);
  const directory = fs.mkdtempSync(path.join(root, "output", "acceptance-existing-fixture-"));
  const evidenceDirectory = path.join(directory, "evidence");
  try {
    const portable = path.join(directory, "review.exe");
    fs.writeFileSync(portable, "fixture");
    fs.mkdirSync(evidenceDirectory);
    receipts.claimServerConnectedReviewInvocation({ directory, kind: "package", version: "0.1.64", artifactSha256: null });
    await assert.rejects(runServerConnectedReviewAcceptance({
      version: "0.1.64",
      portablePath: portable,
      artifactSha256: sha256(portable),
      expectedPackageAsarSha256: "b".repeat(64),
      expectedCatalogChannelSha256: "c".repeat(64),
      expectedUpdateChannelSha256: "d".repeat(64),
      evidenceDirectory
    }), /ACCEPTANCE_EVIDENCE_EXISTS/);
    assert.deepEqual(fs.readdirSync(evidenceDirectory), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the public runner binds CONTROL and FINAL to current runner and helper bytes", async () => {
  const { runServerConnectedReviewAcceptance } = await importFresh(acceptancePath);
  const receipts = await importFresh(receiptPath);
  const directory = fs.mkdtempSync(path.join(root, "output", "acceptance-contract-fixture-"));
  const evidenceDirectory = path.join(directory, "evidence");
  try {
    const portable = path.join(directory, "review.exe");
    fs.writeFileSync(portable, "not-an-executable");
    receipts.claimServerConnectedReviewInvocation({ directory, kind: "package", version: "0.1.72", artifactSha256: null });
    const result = await runServerConnectedReviewAcceptance({
      version: "0.1.72",
      portablePath: portable,
      artifactSha256: sha256(portable),
      expectedPackageAsarSha256: "b".repeat(64),
      expectedCatalogChannelSha256: "c".repeat(64),
      expectedUpdateChannelSha256: "d".repeat(64),
      evidenceDirectory
    });
    assert.equal(result.status, "BLOCKED");
    const control = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, "CONTROL.json"), "utf8"));
    const final = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, "FINAL.json"), "utf8"));
    const runnerContractSha256 = sha256(acceptancePath);
    const helperContractSha256 = sha256(path.join(root, "scripts", "lib", "packaged-client-cdp.mjs"));
    const { deterministicFixtureContractSha256 } = require(path.join(root, "scripts", "lib", "packaged-managed-download-fixture-gate.cjs"));
    const fixtureContractSha256 = deterministicFixtureContractSha256();
    assert.equal(control.runnerContractSha256, runnerContractSha256);
    assert.equal(control.helperContractSha256, helperContractSha256);
    assert.equal(final.runnerContractSha256, runnerContractSha256);
    assert.equal(final.helperContractSha256, helperContractSha256);
    assert.equal(control.deterministicFixtureContractSha256, fixtureContractSha256);
    assert.equal(final.deterministicFixtureContractSha256, fixtureContractSha256);
    assert.equal(Object.hasOwn(final, "support"), false);
    assert.deepEqual({
      treeAbsent: final.cleanup.treeAbsent,
      extractionRootCount: final.cleanup.extractionRootCount,
      extractionCleanupSucceeded: final.cleanup.extractionCleanupSucceeded
    }, {
      treeAbsent: false,
      extractionRootCount: 0,
      extractionCleanupSucceeded: false
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the public runner counts deterministic renderer residue in formal physical cleanup", async () => {
  const { runServerConnectedReviewAcceptance } = await importFresh(acceptancePath);
  const receipts = await importFresh(receiptPath);
  const directory = fs.mkdtempSync(path.join(root, "output", "acceptance-renderer-residue-fixture-"));
  const residue = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-managed-download-queue-formal-residue-"));
  const evidenceDirectory = path.join(directory, "evidence");
  try {
    const portable = path.join(directory, "review.exe");
    fs.writeFileSync(portable, "not-an-executable");
    receipts.claimServerConnectedReviewInvocation({ directory, kind: "package", version: "0.1.72", artifactSha256: null });
    const result = await runServerConnectedReviewAcceptance({
      version: "0.1.72",
      portablePath: portable,
      artifactSha256: sha256(portable),
      expectedPackageAsarSha256: "b".repeat(64),
      expectedCatalogChannelSha256: "c".repeat(64),
      expectedUpdateChannelSha256: "d".repeat(64),
      evidenceDirectory
    });
    const final = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, "FINAL.json"), "utf8"));
    assert.deepEqual({ status: result.status, stage: result.stage, code: result.code }, { status: "BLOCKED", stage: "cleanup", code: "CLEANUP_RESIDUE" });
    assert.equal(Number.isSafeInteger(final.cleanup.tempCount) && final.cleanup.tempCount >= 1, true);
  } finally {
    fs.rmSync(residue, { recursive: true, force: true });
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
