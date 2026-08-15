"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function deliveryProbeFixture({ appThrows = false, existingTasks = [] } = {}) {
  const listeners = [];
  let appEvents = 0;
  const bridge = Object.freeze({
    onDownloadTask(callback) {
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    async listManagedDownloadTasks() {
      return existingTasks;
    }
  });
  const window = {
    aihubPC: bridge,
    __acceptanceErrors: { console: 0, page: 0, rejection: 0 }
  };
  const context = vm.createContext({ window, Object, Array, Set, Map, JSON, Boolean, Number, String });
  bridge.onDownloadTask(() => {
    appEvents += 1;
    if (appThrows) throw new Error("renderer listener fixture failure");
  });
  return {
    bridge,
    window,
    appEvents: () => appEvents,
    listenerCount: () => listeners.length,
    emit(task) {
      try {
        for (const listener of [...listeners]) {
          listener(task);
        }
      } catch {
        window.__acceptanceErrors.page += 1;
      }
    },
    evaluate: async (expression) => vm.runInContext(expression, context)
  };
}

function managedTask({ attempt = "attempt-1", phase = "downloading", receivedBytes = 1, errorCode } = {}) {
  return {
    productId: "managed-product",
    taskId: attempt,
    phase,
    progress: { receivedBytes },
    ...(errorCode ? { errorCode } : {})
  };
}

function cancellationEvaluator({ before, status, dom, after }) {
  const calls = [];
  let listCalls = 0;
  return {
    calls,
    evaluate: async (expression) => {
      if (expression === "window.aihubPC.listManagedDownloadTasks()") {
        calls.push("list");
        return listCalls++ === 0 ? before : after;
      }
      if (expression.includes("getManagedDownloadTaskStatus")) {
        calls.push("status");
        return status;
      }
      if (expression.includes(".managedQueueTask")) {
        calls.push("dom");
        return dom;
      }
      throw new Error("unexpected cancellation sampling expression");
    }
  };
}

test("classifies Windows process snapshots and binds a fast Portable extraction root", async (t) => {
  const {
    bindPackagedExtractionRoots,
    cleanupPackagedExtractionRoots,
    decodePackagedProcessSnapshot
  } = await import(`../scripts/lib/packaged-client-cdp.mjs?process-snapshot=${Date.now()}`);
  const expectedBytes = Buffer.from("fast packaged app.asar fixture");
  const expectedPackageAsarSha256 = crypto.createHash("sha256").update(expectedBytes).digest("hex");
  const roots = [];
  const makeRoot = (prefix) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    roots.push(root);
    const executable = path.join(root, "client.exe");
    const appAsar = path.join(root, "resources", "app.asar");
    fs.mkdirSync(path.dirname(appAsar), { recursive: true });
    fs.writeFileSync(executable, "fixture executable");
    fs.writeFileSync(appAsar, expectedBytes);
    return { root, executable };
  };
  t.after(() => {
    for (const root of [...roots].reverse()) fs.rmSync(root, { recursive: true, force: true });
  });

  const owned = makeRoot("aihub-fast-extraction-owned-");
  const unowned = makeRoot("aihub-fast-extraction-unowned-");
  const snapshot = decodePackagedProcessSnapshot({
    status: 0,
    stdout: JSON.stringify([
      { processId: 0, parentProcessId: 0, creationDate: "idle", executablePath: "" },
      { processId: 700, parentProcessId: 0, creationDate: "launcher", executablePath: __filename },
      { processId: 701, parentProcessId: 700, creationDate: "portable", executablePath: owned.executable },
      { processId: 702, parentProcessId: 1, creationDate: "unowned", executablePath: unowned.executable }
    ])
  });
  assert.equal(snapshot.length, 4);
  const ownership = bindPackagedExtractionRoots({
    rootProcessId: 700,
    processEntries: snapshot,
    expectedPackageAsarSha256,
    temporaryRoot: os.tmpdir()
  });
  assert.equal(ownership.rootCount, 1);
  const cleaned = cleanupPackagedExtractionRoots({ ownership, processEntries: [] });
  assert.deepEqual(cleaned, {
    treeAbsent: true,
    extractionRootCount: 0,
    extractionCleanupSucceeded: true
  });
  assert.equal(fs.existsSync(owned.root), false);
  assert.equal(fs.existsSync(unowned.root), true);

  assert.deepEqual(decodePackagedProcessSnapshot({ status: 0, stdout: "" }), []);
  assert.throws(
    () => decodePackagedProcessSnapshot({ status: 0, stdout: "{https://fixture.invalid/private.pem" }),
    (error) => error.message === "PACKAGED_EXTRACTION_PROCESS_SNAPSHOT_INVALID"
  );
  assert.throws(
    () => decodePackagedProcessSnapshot({ status: 5, stdout: "PRIVATE_SENTINEL_MUST_NOT_ESCAPE" }),
    (error) => error.message === "PACKAGED_EXTRACTION_PROCESS_SNAPSHOT_UNAVAILABLE"
  );
});

test("binds and cleans only exact process-owned packaged extraction roots", async (t) => {
  const {
    bindPackagedExtractionRoots,
    cleanupPackagedExtractionRoots
  } = await import(`../scripts/lib/packaged-client-cdp.mjs?extraction=${Date.now()}`);
  const expectedBytes = Buffer.from("exact packaged app.asar fixture");
  const expectedPackageAsarSha256 = crypto.createHash("sha256").update(expectedBytes).digest("hex");
  const roots = [];
  const makeRoot = (prefix, nested = false) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    roots.push(root);
    const executable = path.join(root, "client.exe");
    const appAsar = path.join(root, ...(nested ? ["7z-out", "resources", "app.asar"] : ["resources", "app.asar"]));
    fs.mkdirSync(path.dirname(appAsar), { recursive: true });
    fs.writeFileSync(executable, "fixture executable");
    fs.writeFileSync(appAsar, expectedBytes);
    return { root, executable, appAsar };
  };
  t.after(() => {
    for (const root of [...roots].reverse()) fs.rmSync(root, { recursive: true, force: true });
  });

  const owned = makeRoot("aihub-owned-extraction-");
  const nestedOwned = makeRoot("aihub-owned-extraction-", true);
  const unowned = makeRoot("aihub-unowned-extraction-");
  const processEntries = [
    { processId: 100, parentProcessId: 0, creationDate: "root", executablePath: path.join(path.dirname(__filename), "portable.exe") },
    { processId: 101, parentProcessId: 100, creationDate: "owned", executablePath: owned.executable },
    { processId: 102, parentProcessId: 101, creationDate: "nested", executablePath: nestedOwned.executable }
  ];
  const ownership = bindPackagedExtractionRoots({
    rootProcessId: 100,
    processEntries,
    expectedPackageAsarSha256,
    temporaryRoot: os.tmpdir()
  });
  assert.equal(ownership.rootCount, 2);

  const stillRunning = cleanupPackagedExtractionRoots({ ownership, processEntries });
  assert.deepEqual(stillRunning, {
    treeAbsent: false,
    extractionRootCount: 2,
    extractionCleanupSucceeded: false
  });
  assert.equal(fs.existsSync(owned.root), true);
  assert.equal(fs.existsSync(nestedOwned.root), true);

  const cleaned = cleanupPackagedExtractionRoots({ ownership, processEntries: [] });
  assert.deepEqual(cleaned, {
    treeAbsent: true,
    extractionRootCount: 0,
    extractionCleanupSucceeded: true
  });
  assert.equal(fs.existsSync(owned.root), false);
  assert.equal(fs.existsSync(nestedOwned.root), false);
  assert.equal(fs.existsSync(unowned.root), true);
});

test("binds only process-owned app resources with exact catalog and update channels", async (t) => {
  const { bindPackagedExtractionRoots } = await import(`../scripts/lib/packaged-client-cdp.mjs?owned-resources=${Date.now()}`);
  const asarBytes = Buffer.from("owned app.asar fixture");
  const catalogBytes = Buffer.from('{"kind":"catalog","fixture":"owned"}\n');
  const updateBytes = Buffer.from('{"kind":"update","fixture":"owned"}\n');
  const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
  const roots = [];
  const makeRoot = (name, { catalog = catalogBytes, update = updateBytes, layout = ["app", "resources"] } = {}) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), name));
    roots.push(root);
    const executable = path.join(root, ...layout.slice(0, -1), "client.exe");
    const resources = path.join(root, ...layout);
    fs.mkdirSync(path.join(resources, "catalog"), { recursive: true });
    fs.mkdirSync(path.join(resources, "updates"), { recursive: true });
    fs.writeFileSync(executable, "fixture executable");
    fs.writeFileSync(path.join(resources, "app.asar"), asarBytes);
    fs.writeFileSync(path.join(resources, "catalog", "channel.json"), catalog);
    fs.writeFileSync(path.join(resources, "updates", "channel.json"), update);
    return { root, executable };
  };
  t.after(() => {
    for (const root of [...roots].reverse()) fs.rmSync(root, { recursive: true, force: true });
  });

  const owned = makeRoot("aihub-owned-resources-");
  makeRoot("aihub-unowned-resources-");
  const expected = {
    expectedPackageAsarSha256: digest(asarBytes),
    expectedCatalogChannelSha256: digest(catalogBytes),
    expectedUpdateChannelSha256: digest(updateBytes)
  };
  const ownership = bindPackagedExtractionRoots({
    rootProcessId: 800,
    processEntries: [
      { processId: 800, parentProcessId: 0, creationDate: "launcher", executablePath: __filename },
      { processId: 801, parentProcessId: 800, creationDate: "owned", executablePath: owned.executable }
    ],
    ...expected,
    temporaryRoot: os.tmpdir()
  });
  assert.equal(ownership.rootCount, 1);
  assert.equal(ownership.roots[0].root, owned.root);

  const direct = makeRoot("aihub-owned-direct-resources-", { layout: ["resources"] });
  const directOwnership = bindPackagedExtractionRoots({
    rootProcessId: 805,
    processEntries: [
      { processId: 805, parentProcessId: 0, creationDate: "launcher", executablePath: __filename },
      { processId: 806, parentProcessId: 805, creationDate: "owned", executablePath: direct.executable }
    ],
    ...expected,
    temporaryRoot: os.tmpdir()
  });
  assert.equal(directOwnership.rootCount, 1);
  assert.equal(directOwnership.roots[0].root, direct.root);

  const reparse = makeRoot("aihub-reparse-resources-");
  const reparseTarget = makeRoot("aihub-reparse-target-");
  const reparseCatalog = path.join(reparse.root, "app", "resources", "catalog");
  fs.rmSync(reparseCatalog, { recursive: true });
  fs.symlinkSync(path.join(reparseTarget.root, "app", "resources", "catalog"), reparseCatalog, "junction");
  assert.throws(() => bindPackagedExtractionRoots({
    rootProcessId: 810,
    processEntries: [
      { processId: 810, parentProcessId: 0, creationDate: "launcher", executablePath: __filename },
      { processId: 811, parentProcessId: 810, creationDate: "reparse", executablePath: reparse.executable }
    ],
    ...expected,
    temporaryRoot: os.tmpdir()
  }), /PACKAGED_EXTRACTION_CHANNEL_INVALID/);

  fs.rmSync(path.join(owned.root, "app", "resources", "catalog", "channel.json"));
  assert.throws(() => bindPackagedExtractionRoots({
    rootProcessId: 800,
    processEntries: [
      { processId: 800, parentProcessId: 0, creationDate: "launcher", executablePath: __filename },
      { processId: 801, parentProcessId: 800, creationDate: "owned", executablePath: owned.executable }
    ],
    ...expected,
    temporaryRoot: os.tmpdir()
  }), /PACKAGED_EXTRACTION_CHANNEL_INVALID/);

  fs.writeFileSync(path.join(owned.root, "app", "resources", "catalog", "channel.json"), "drifted");
  assert.throws(() => bindPackagedExtractionRoots({
    rootProcessId: 800,
    processEntries: [
      { processId: 800, parentProcessId: 0, creationDate: "launcher", executablePath: __filename },
      { processId: 801, parentProcessId: 800, creationDate: "owned", executablePath: owned.executable }
    ],
    ...expected,
    temporaryRoot: os.tmpdir()
  }), /PACKAGED_EXTRACTION_CHANNEL_MISMATCH/);
});

test("fails closed for unknown, stale, reparse, and wrong-SHA extraction roots", async (t) => {
  const {
    bindPackagedExtractionRoots,
    cleanupPackagedExtractionRoots
  } = await import(`../scripts/lib/packaged-client-cdp.mjs?extraction-reject=${Date.now()}`);
  const expectedBytes = Buffer.from("expected app.asar");
  const expectedPackageAsarSha256 = crypto.createHash("sha256").update(expectedBytes).digest("hex");
  const roots = [];
  const makeRoot = (bytes) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-extraction-reject-"));
    roots.push(root);
    const executable = path.join(root, "client.exe");
    const appAsar = path.join(root, "resources", "app.asar");
    fs.mkdirSync(path.dirname(appAsar), { recursive: true });
    fs.writeFileSync(executable, "fixture executable");
    fs.writeFileSync(appAsar, bytes);
    return { root, executable };
  };
  t.after(() => {
    for (const root of [...roots].reverse()) fs.rmSync(root, { recursive: true, force: true });
  });

  const wrong = makeRoot(Buffer.from("wrong app.asar"));
  assert.throws(() => bindPackagedExtractionRoots({
    rootProcessId: 200,
    processEntries: [
      { processId: 200, parentProcessId: 0, creationDate: "root", executablePath: __filename },
      { processId: 201, parentProcessId: 200, creationDate: "wrong", executablePath: wrong.executable }
    ],
    expectedPackageAsarSha256,
    temporaryRoot: os.tmpdir()
  }), /PACKAGED_EXTRACTION_ASAR_MISMATCH/);
  assert.equal(fs.existsSync(wrong.root), true);

  assert.throws(() => bindPackagedExtractionRoots({
    rootProcessId: 300,
    processEntries: [{ processId: 300, parentProcessId: 0, creationDate: "root", executablePath: __filename }],
    expectedPackageAsarSha256,
    temporaryRoot: os.tmpdir()
  }), /PACKAGED_EXTRACTION_ROOT_UNAVAILABLE/);

  const actual = makeRoot(expectedBytes);
  const junction = path.join(os.tmpdir(), `aihub-extraction-junction-${process.pid}-${Date.now()}`);
  roots.push(junction);
  fs.symlinkSync(actual.root, junction, "junction");
  assert.throws(() => bindPackagedExtractionRoots({
    rootProcessId: 400,
    processEntries: [
      { processId: 400, parentProcessId: 0, creationDate: "root", executablePath: __filename },
      { processId: 401, parentProcessId: 400, creationDate: "junction", executablePath: path.join(junction, "client.exe") }
    ],
    expectedPackageAsarSha256,
    temporaryRoot: os.tmpdir()
  }), /PACKAGED_EXTRACTION_ROOT_INVALID/);

  const ownership = bindPackagedExtractionRoots({
    rootProcessId: 500,
    processEntries: [
      { processId: 500, parentProcessId: 0, creationDate: "root", executablePath: __filename },
      { processId: 501, parentProcessId: 500, creationDate: "actual", executablePath: actual.executable }
    ],
    expectedPackageAsarSha256,
    temporaryRoot: os.tmpdir()
  });
  fs.writeFileSync(path.join(actual.root, "resources", "app.asar"), "drifted");
  const drifted = cleanupPackagedExtractionRoots({ ownership, processEntries: [] });
  assert.deepEqual(drifted, {
    treeAbsent: true,
    extractionRootCount: 1,
    extractionCleanupSucceeded: false
  });
  assert.equal(fs.existsSync(actual.root), true);
});

test("retains passed gates and encodes only allowlisted safe evidence", async () => {
  const {
    encodePackagedAcceptanceEvidence,
    resolvePackagedAcceptanceEvidence
  } = await import(`../scripts/lib/packaged-client-cdp.mjs?evidence=${Date.now()}`);
  const catalog = { source: "remote", catalogVersion: 7, errorPresent: false, statusClass: "none", fallbackClass: "none", vendors: 375, products: 615 };
  const provenance = { mainExact: true, preloadExact: true, rendererExact: true, downloadTaskExact: true, taskContractExact: true, outerRealmRejected: true, cancelRequestExact: true, secretFilesScanned: 10, secretFindings: 0 };
  assert.deepEqual(resolvePackagedAcceptanceEvidence({ outcome: null, retained: { catalog, provenance } }), {
    catalog,
    provenance,
    scenarioMatrix: null,
    screenshots: []
  });
  const bytes = encodePackagedAcceptanceEvidence({ substageClass: "active-dialog", screenshotCount: 3 }, ["substageClass", "screenshotCount"]);
  assert.deepEqual(JSON.parse(bytes.toString("utf8")), { substageClass: "active-dialog", screenshotCount: 3 });
  assert.throws(() => encodePackagedAcceptanceEvidence({ substageClass: "active-dialog", extra: true }, ["substageClass"]), /EVIDENCE_UNKNOWN_KEY/);
  assert.throws(() => encodePackagedAcceptanceEvidence({ substageClass: "https:\/\/invalid.example" }, ["substageClass"]), /EVIDENCE_URL/);
  assert.throws(() => encodePackagedAcceptanceEvidence({ substageClass: "sk-abcdefghijklmnopqrstuvwxyz1234567890" }, ["substageClass"]), /EVIDENCE_SENSITIVE_STRING/);
});

test("observes packaged task delivery without replacing the frozen bridge or the App listener", async () => {
  const {
    disposePackagedDownloadTaskDeliveryProbe,
    inspectPackagedDownloadTaskDeliveryProbe,
    installPackagedDownloadTaskDeliveryProbe
  } = await import(`../scripts/lib/packaged-client-cdp.mjs?delivery-probe=${Date.now()}`);
  const fixture = deliveryProbeFixture();
  const bridgeIdentity = fixture.window.aihubPC;
  const installed = await installPackagedDownloadTaskDeliveryProbe({
    evaluate: fixture.evaluate,
    productIds: ["managed-product"]
  });
  assert.deepEqual(installed, {
    rawEventDeliveryClass: "not-observed",
    rawEventCountClass: "zero",
    rawObserverArmedBeforeEnqueue: true,
    rendererErrorClass: "none"
  });
  assert.equal(fixture.window.aihubPC, bridgeIdentity);
  assert.equal(Object.isFrozen(fixture.window.aihubPC), true);
  assert.equal(fixture.listenerCount(), 2);

  fixture.emit({ productId: "managed-product", attemptId: "other-attempt", phase: "queued", url: "https://must-not-leave-renderer.invalid", error: "raw" });
  assert.equal(fixture.appEvents(), 1);
  assert.deepEqual(await inspectPackagedDownloadTaskDeliveryProbe({
    evaluate: fixture.evaluate,
    productId: "managed-product",
    expectedTaskId: "expected-attempt"
  }), {
    rawEventDeliveryClass: "other-attempt-only",
    rawEventCountClass: "one",
    rawObserverArmedBeforeEnqueue: true,
    rendererErrorClass: "none"
  });

  fixture.emit({ productId: "managed-product", attemptId: "expected-attempt", phase: "downloading", path: "C:\\secret\\target.part", token: "sk-abcdefghijklmnopqrstuvwxyz1234567890" });
  assert.equal(fixture.appEvents(), 2);
  assert.deepEqual(await inspectPackagedDownloadTaskDeliveryProbe({
    evaluate: fixture.evaluate,
    productId: "managed-product",
    expectedTaskId: "expected-attempt"
  }), {
    rawEventDeliveryClass: "same-attempt-observed",
    rawEventCountClass: "multiple",
    rawObserverArmedBeforeEnqueue: true,
    rendererErrorClass: "none"
  });

  assert.deepEqual(await disposePackagedDownloadTaskDeliveryProbe({ evaluate: fixture.evaluate }), { disposed: true });
  assert.equal(fixture.listenerCount(), 1);
  fixture.emit({ productId: "managed-product", attemptId: "post-dispose" });
  assert.equal(fixture.appEvents(), 3);
});

test("fails closed when the task observer is armed after a target already exists", async () => {
  const {
    inspectPackagedDownloadTaskDeliveryProbe,
    installPackagedDownloadTaskDeliveryProbe
  } = await import(`../scripts/lib/packaged-client-cdp.mjs?delivery-late=${Date.now()}`);
  const fixture = deliveryProbeFixture({ existingTasks: [{ productId: "managed-product", taskId: "already-present", phase: "queued" }] });
  assert.deepEqual(await installPackagedDownloadTaskDeliveryProbe({ evaluate: fixture.evaluate, productIds: ["managed-product"] }), {
    rawEventDeliveryClass: "observer-unavailable",
    rawEventCountClass: "zero",
    rawObserverArmedBeforeEnqueue: false,
    rendererErrorClass: "none"
  });
  assert.deepEqual(await inspectPackagedDownloadTaskDeliveryProbe({
    evaluate: fixture.evaluate,
    productId: "managed-product",
    expectedTaskId: "already-present"
  }), {
    rawEventDeliveryClass: "observer-unavailable",
    rawEventCountClass: "zero",
    rawObserverArmedBeforeEnqueue: false,
    rendererErrorClass: "none"
  });
});

test("separates renderer errors from a missing raw event without exposing the error", async () => {
  const {
    inspectPackagedDownloadTaskDeliveryProbe,
    installPackagedDownloadTaskDeliveryProbe
  } = await import(`../scripts/lib/packaged-client-cdp.mjs?delivery-errors=${Date.now()}`);
  const fixture = deliveryProbeFixture();
  await installPackagedDownloadTaskDeliveryProbe({ evaluate: fixture.evaluate, productIds: ["managed-product"] });
  fixture.window.__acceptanceErrors.console = 1;
  fixture.window.__acceptanceErrors.rejection = 2;
  assert.deepEqual(await inspectPackagedDownloadTaskDeliveryProbe({
    evaluate: fixture.evaluate,
    productId: "managed-product",
    expectedTaskId: "not-observed"
  }), {
    rawEventDeliveryClass: "not-observed",
    rawEventCountClass: "zero",
    rawObserverArmedBeforeEnqueue: true,
    rendererErrorClass: "mixed"
  });
});

test("records a prior renderer listener failure without claiming the probe received the interrupted event", async () => {
  const {
    inspectPackagedDownloadTaskDeliveryProbe,
    installPackagedDownloadTaskDeliveryProbe
  } = await import(`../scripts/lib/packaged-client-cdp.mjs?delivery-listener-error=${Date.now()}`);
  const fixture = deliveryProbeFixture({ appThrows: true });
  await installPackagedDownloadTaskDeliveryProbe({ evaluate: fixture.evaluate, productIds: ["managed-product"] });
  fixture.emit({ productId: "managed-product", attemptId: "expected-attempt", phase: "downloading", error: "must-not-leak" });
  assert.equal(fixture.appEvents(), 1);
  assert.deepEqual(await inspectPackagedDownloadTaskDeliveryProbe({
    evaluate: fixture.evaluate,
    productId: "managed-product",
    expectedTaskId: "expected-attempt"
  }), {
    rawEventDeliveryClass: "not-observed",
    rawEventCountClass: "zero",
    rawObserverArmedBeforeEnqueue: true,
    rendererErrorClass: "page"
  });
});

test("ignores a taskId-only raw event instead of treating it as an attempt", async () => {
  const {
    inspectPackagedDownloadTaskDeliveryProbe,
    installPackagedDownloadTaskDeliveryProbe
  } = await import(`../scripts/lib/packaged-client-cdp.mjs?delivery-task-id-only=${Date.now()}`);
  const fixture = deliveryProbeFixture();
  await installPackagedDownloadTaskDeliveryProbe({ evaluate: fixture.evaluate, productIds: ["managed-product"] });
  fixture.emit({ productId: "managed-product", taskId: "expected-attempt", phase: "downloading" });
  assert.deepEqual(await inspectPackagedDownloadTaskDeliveryProbe({
    evaluate: fixture.evaluate,
    productId: "managed-product",
    expectedTaskId: "expected-attempt"
  }), {
    rawEventDeliveryClass: "not-observed",
    rawEventCountClass: "zero",
    rawObserverArmedBeforeEnqueue: true,
    rendererErrorClass: "none"
  });
});

test("runs visual evidence and danger confirmation on one exact active attempt", async () => {
  const { runPackagedActiveVisualAttempt } = await import(`../scripts/lib/packaged-client-cdp.mjs?active-visual=${Date.now()}`);
  const calls = [];
  const proof = (action) => ({
    [action]: true,
    sameAttempt: true,
    listBeforePhase: "downloading",
    statusPhase: "downloading",
    listAfterPhase: "downloading",
    domPhase: "downloading",
    receivedBytesClass: "positive",
    buttonPresent: true,
    buttonDisabled: false,
    partCount: 1,
    formalCount: 0
  });
  const result = await runPackagedActiveVisualAttempt({
    startActiveTask: async () => ({ targetTaskId: "active-attempt" }),
    openCancelDialog: async (taskId) => {
      calls.push(`open:${taskId}`);
      return proof("opened");
    },
    viewport: { width: 740, height: 740 },
    setViewport: async () => calls.push("viewport"),
    inspectVisual: async () => ({ viewportExact: true }),
    captureVisual: async (taskId) => calls.push(`capture:${taskId}`),
    confirmOpenDialog: async (taskId) => {
      calls.push(`confirm:${taskId}`);
      return proof("clicked");
    }
  });
  assert.deepEqual(result, { targetTaskId: "active-attempt" });
  assert.deepEqual(calls, ["open:active-attempt", "viewport", "capture:active-attempt", "confirm:active-attempt"]);
});

test("classifies a terminal active task before action as fixture exhaustion", async () => {
  const { runPackagedActiveVisualAttempt } = await import(`../scripts/lib/packaged-client-cdp.mjs?active-terminal=${Date.now()}`);
  await assert.rejects(
    runPackagedActiveVisualAttempt({
      startActiveTask: async () => ({ targetTaskId: "expired-attempt" }),
      openCancelDialog: async () => ({ terminal: true }),
      viewport: { width: 740, height: 740 },
      setViewport: async () => {},
      inspectVisual: async () => ({ viewportExact: true }),
      captureVisual: async () => {},
      confirmOpenDialog: async () => ({ clicked: true })
    }),
    /ACTIVE_FIXTURE_EXHAUSTED/
  );
});

test("samples one managed-download cancellation attempt without cross-time task mixing", async (t) => {
  const {
    classifyPackagedManagedDownloadCancelAction,
    inspectPackagedIndependentTarget,
    inspectPackagedAcceptancePhysicalCleanup,
    runPackagedSafeDismissAttempt,
    samplePackagedManagedDownloadCancellation
  } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-cdp-cancellation-"));
  const partPath = path.join(directory, "managed-product.exe.part");
  fs.writeFileSync(partPath, "partial");
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  await t.test("treats a main failed task and queued renderer row as terminal before cancel", async () => {
    const failed = managedTask({ phase: "failed", errorCode: "DOWNLOAD_CONNECTION_FAILED" });
    const fixture = cancellationEvaluator({
      before: [failed],
      status: { ok: true, task: failed },
      dom: { rendererPhaseClass: "queued", rowPresent: true, buttonPresent: true, buttonDisabled: false },
      after: [failed]
    });
    const sampled = await samplePackagedManagedDownloadCancellation({
      evaluate: fixture.evaluate,
      productId: "managed-product",
      partPath
    });
    assert.equal(sampled.state, "terminal");
    assert.deepEqual(sampled.actual, {
      listBeforePhase: "failed",
      listAfterPhase: "failed",
      statusEnvelopeClass: "ok",
      statusPhase: "failed",
      domPhase: "queued",
      sameAttempt: true,
      receivedBytesClass: "positive",
      failureClass: "transport",
      partPresent: true,
      sampleGapBucket: "under-100ms"
    });
    assert.deepEqual(fixture.calls, ["list", "status", "dom", "list"]);
  });

  await t.test("retries only a changed attempt or phase sample", async () => {
    const before = managedTask({ attempt: "attempt-1", phase: "downloading" });
    const after = managedTask({ attempt: "attempt-2", phase: "queued" });
    const fixture = cancellationEvaluator({
      before: [before],
      status: { ok: true, task: after },
      dom: { rendererPhaseClass: "downloading", rowPresent: true, buttonPresent: true, buttonDisabled: false },
      after: [after]
    });
    const sampled = await samplePackagedManagedDownloadCancellation({ evaluate: fixture.evaluate, productId: "managed-product", partPath });
    assert.equal(sampled.state, "sampling-drift");
    assert.equal(sampled.actual.sameAttempt, false);
    assert.equal(sampled.actual.listBeforePhase, "downloading");
    assert.equal(sampled.actual.listAfterPhase, "queued");
  });

  await t.test("treats a same-attempt list phase change as sampling drift", async () => {
    const before = managedTask({ phase: "downloading" });
    const after = managedTask({ phase: "queued" });
    const fixture = cancellationEvaluator({
      before: [before],
      status: { ok: true, task: before },
      dom: { rendererPhaseClass: "downloading", rowPresent: true, buttonPresent: true, buttonDisabled: false },
      after: [after]
    });
    const sampled = await samplePackagedManagedDownloadCancellation({ evaluate: fixture.evaluate, productId: "managed-product", partPath });
    assert.equal(sampled.state, "sampling-drift");
    assert.equal(sampled.actual.sameAttempt, true);
  });

  await t.test("classifies a rejected status envelope without retaining its error code", async () => {
    const queued = managedTask({ phase: "queued", receivedBytes: 0 });
    const fixture = cancellationEvaluator({
      before: [queued],
      status: { ok: false, errorCode: "DOWNLOAD_POLICY_REJECTED" },
      dom: { rendererPhaseClass: "queued", rowPresent: true, buttonPresent: true, buttonDisabled: false },
      after: [queued]
    });
    const sampled = await samplePackagedManagedDownloadCancellation({ evaluate: fixture.evaluate, productId: "managed-product", partPath });
    assert.equal(sampled.state, "status-rejected");
    assert.equal(sampled.actual.failureClass, "policy");
    assert.equal(Object.hasOwn(sampled.actual, "errorCode"), false);
  });

  await t.test("maps only fixed public failure categories", async () => {
    for (const [errorCode, failureClass] of [
      ["DOWNLOAD_SOURCE_NO_DATA", "source-no-data"],
      ["DOWNLOAD_CONNECTION_FAILED", "transport"],
      ["DOWNLOAD_HTTP_503", "http"],
      ["DOWNLOAD_POLICY_REJECTED", "policy"],
      ["DOWNLOAD_ENOSPC", "disk-space"],
      ["DOWNLOAD_EACCES_WRITE", "disk-write"],
      ["DOWNLOAD_INCOMPLETE", "incomplete"],
      ["DOWNLOAD_ATTEMPT_MISMATCH", "attempt"],
      ["DOWNLOAD_START_FAILED", "start"],
      ["DOWNLOAD_QUEUE_REJECTED", "queue"],
      ["DOWNLOAD_TASK_INTERNAL_ERROR", "task-internal"],
      ["DOWNLOAD_FAILED", "generic-download-failed"],
      ["DOWNLOAD_VENDOR_INTERNAL_ERROR", "other"],
      ["DOWNLOAD_CUSTOM_START_FAILED", "other"],
      ["DOWNLOAD_OTHER_QUEUE_REJECTED", "other"],
      ["DOWNLOAD_UNRECOGNIZED", "other"]
    ]) {
      const queued = managedTask({ phase: "queued", receivedBytes: 0 });
      const fixture = cancellationEvaluator({
        before: [queued],
        status: { ok: false, errorCode },
        dom: { rendererPhaseClass: "queued", rowPresent: true, buttonPresent: true, buttonDisabled: false },
        after: [queued]
      });
      const sampled = await samplePackagedManagedDownloadCancellation({ evaluate: fixture.evaluate, productId: "managed-product", partPath });
      assert.equal(sampled.actual.failureClass, failureClass);
    }
  });

  await t.test("separates stable main cancellation from an absent renderer projection", async () => {
    const active = managedTask({ phase: "downloading" });
    const fixture = cancellationEvaluator({
      before: [active],
      status: { ok: true, task: active },
      dom: { rendererPhaseClass: "other", rowPresent: false, buttonPresent: false, buttonDisabled: false },
      after: [active]
    });
    const sampled = await samplePackagedManagedDownloadCancellation({ evaluate: fixture.evaluate, productId: "managed-product", partPath });
    assert.equal(sampled.state, "renderer-not-ready");
  });

  await t.test("accepts only one exact stable and enabled current task", async () => {
    const active = managedTask({ phase: "downloading" });
    const fixture = cancellationEvaluator({
      before: [active],
      status: { ok: true, task: active },
      dom: { rendererPhaseClass: "downloading", rowPresent: true, buttonPresent: true, buttonDisabled: false },
      after: [active]
    });
    const sampled = await samplePackagedManagedDownloadCancellation({ evaluate: fixture.evaluate, productId: "managed-product", partPath });
    assert.equal(sampled.state, "ready");
    assert.equal(sampled.actual.sameAttempt, true);
    assert.deepEqual(Object.keys(sampled.actual).sort(), [
      "domPhase", "failureClass", "listAfterPhase", "listBeforePhase", "partPresent",
      "receivedBytesClass", "sameAttempt", "sampleGapBucket", "statusEnvelopeClass", "statusPhase"
    ]);
  });

  await t.test("keeps nonphysical history out of formal physical cleanup", () => {
    const physical = inspectPackagedAcceptancePhysicalCleanup({
      productProcesses: 0,
      profileCount: 0,
      tempCount: 0,
      downloadFileCount: 0,
      partCount: 0,
      formalCount: 0,
      treeAbsent: true,
      extractionRootCount: 0,
      extractionCleanupSucceeded: true,
      installerLaunched: false
    });
    assert.deepEqual(physical.cleanup, {
      productProcesses: 0,
      profileCount: 0,
      tempCount: 0,
      downloadFileCount: 0,
      partCount: 0,
      formalCount: 0,
      treeAbsent: true,
      extractionRootCount: 0,
      extractionCleanupSucceeded: true,
      installerLaunched: false
    });
    assert.equal(physical.hasPhysicalResidue, false);
    for (const key of ["productProcesses", "profileCount", "tempCount", "downloadFileCount", "partCount", "formalCount", "extractionRootCount"]) {
      const dirty = inspectPackagedAcceptancePhysicalCleanup({
        ...physical.cleanup,
        [key]: 1
      });
      assert.equal(dirty.hasPhysicalResidue, true, key);
    }
    assert.equal(inspectPackagedAcceptancePhysicalCleanup({ ...physical.cleanup, treeAbsent: false }).hasPhysicalResidue, true);
    assert.equal(inspectPackagedAcceptancePhysicalCleanup({ ...physical.cleanup, extractionCleanupSucceeded: false }).hasPhysicalResidue, true);
  });

  await t.test("rejects a stale target attempt before it can cancel a newer task", () => {
    const oldAttempt = managedTask({ attempt: "attempt-a", phase: "downloaded" });
    const currentAttempt = managedTask({ attempt: "attempt-b", phase: "queued", receivedBytes: 0 });
    const stale = classifyPackagedManagedDownloadCancelAction({
      expectedTaskId: "attempt-a",
      listBefore: [currentAttempt],
      status: { ok: true, task: currentAttempt },
      listAfter: [currentAttempt],
      dom: { rendererPhaseClass: "queued", rowPresent: true, buttonPresent: true, buttonDisabled: false }
    });
    assert.equal(stale.state, "attempt-drift");
    assert.equal(stale.actual.expectedCurrentAttempt, false);
    assert.equal(stale.actual.canCancel, true);

    const terminal = classifyPackagedManagedDownloadCancelAction({
      expectedTaskId: "attempt-a",
      listBefore: [oldAttempt],
      status: { ok: true, task: oldAttempt },
      listAfter: [oldAttempt],
      dom: { rendererPhaseClass: "downloaded", rowPresent: true, buttonPresent: false, buttonDisabled: false }
    });
    assert.equal(terminal.state, "terminal");
    assert.equal(terminal.actual.expectedCurrentAttempt, true);
  });

  await t.test("accepts an independent target that completes naturally without regressing", () => {
    const formalPath = path.join(directory, "independent.exe");
    const before = managedTask({ attempt: "independent-1", phase: "downloading", receivedBytes: 1024 });
    fs.writeFileSync(formalPath, "completed");
    const completed = inspectPackagedIndependentTarget({
      before,
      after: managedTask({ attempt: "independent-1", phase: "downloaded", receivedBytes: 2048 }),
      formalPath
    });
    assert.deepEqual(completed, {
      unchanged: true,
      sameAttempt: true,
      phaseClass: "downloaded",
      receivedBytesNondecreasing: true,
      formalAbsent: false
    });

    fs.rmSync(formalPath);
    const active = inspectPackagedIndependentTarget({
      before,
      after: managedTask({ attempt: "independent-1", phase: "downloading", receivedBytes: 2048 }),
      formalPath
    });
    assert.deepEqual(active, {
      unchanged: true,
      sameAttempt: true,
      phaseClass: "active",
      receivedBytesNondecreasing: true,
      formalAbsent: true
    });
  });

  await t.test("requires Tab, Shift+Tab, Escape and safe-button dismissal on one current active attempt", async () => {
    const calls = [];
    let dialogStep = 0;
    let taskChecks = 0;
    const result = await runPackagedSafeDismissAttempt({
      expectedTaskId: "active-fresh-1",
      openDialog: async (taskId) => {
        calls.push(`open:${taskId}`);
        return { opened: true, sameAttempt: true, active: true };
      },
      inspectDialog: async () => {
        dialogStep += 1;
        return dialogStep === 1 || dialogStep === 3
          ? { dialogVisible: true, safeFocus: true, dangerFocus: false }
          : { dialogVisible: true, safeFocus: false, dangerFocus: true };
      },
      pressKey: async (key) => calls.push(`key:${key}`),
      inspectTask: async () => {
        taskChecks += 1;
        return { dialogClosed: true, sameAttempt: true, active: true };
      },
      clickSafe: async () => {
        calls.push("safe");
        return true;
      }
    });
    assert.deepEqual(result, {
      defaultSafeFocus: true,
      tabDangerFocus: true,
      shiftTabSafeFocus: true,
      escapeKeptTask: true,
      safeButtonKeptTask: true
    });
    assert.equal(taskChecks, 2);
    assert.deepEqual(calls, [
      "open:active-fresh-1",
      "key:Tab",
      "key:Shift+Tab",
      "key:Escape",
      "open:active-fresh-1",
      "safe"
    ]);

    const terminalCalls = [];
    await assert.rejects(runPackagedSafeDismissAttempt({
      expectedTaskId: "active-fresh-2",
      openDialog: async () => ({ opened: false, sameAttempt: true, active: false }),
      inspectDialog: async () => terminalCalls.push("inspect"),
      pressKey: async () => terminalCalls.push("key"),
      inspectTask: async () => terminalCalls.push("task"),
      clickSafe: async () => terminalCalls.push("safe")
    }), (error) => {
      assert.equal(error.message, "SAFE_DISMISS_FIXTURE_NOT_READY");
      assert.deepEqual(error.safeDismissActual, {
        defaultSafeFocus: false,
        tabDangerFocus: false,
        shiftTabSafeFocus: false,
        escapeKeptTask: false,
        safeButtonKeptTask: false
      });
      return true;
    });
    assert.deepEqual(terminalCalls, []);
  });

});

test("captures multiple packaged screenshots without overwrite or path escape", async () => {
  const { capturePackagedScreenshot } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-cdp-screenshot-"));
  const bytes = Buffer.from("png-fixture");
  const calls = [];
  const client = {
    async send(method, input) {
      calls.push({ method, input });
      if (method === "Page.captureScreenshot") return { data: bytes.toString("base64") };
      return {};
    }
  };
  try {
    const first = await capturePackagedScreenshot({
      client,
      evidenceDirectory,
      name: "cancel-light-1365x740.png",
      width: 1365,
      height: 740
    });
    const second = await capturePackagedScreenshot({
      client,
      evidenceDirectory,
      name: "cancel-light-740x740.png",
      width: 740,
      height: 740
    });
    const expectedSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    assert.deepEqual(first, {
      relativePath: "screenshots/cancel-light-1365x740.png",
      bytes: bytes.length,
      sha256: expectedSha256
    });
    assert.deepEqual(second, {
      relativePath: "screenshots/cancel-light-740x740.png",
      bytes: bytes.length,
      sha256: expectedSha256
    });
    assert.equal(fs.existsSync(path.join(evidenceDirectory, first.relativePath)), true);
    assert.equal(fs.existsSync(path.join(evidenceDirectory, second.relativePath)), true);
    assert.equal(calls.filter((call) => call.method === "Page.captureScreenshot").length, 2);
    await assert.rejects(
      capturePackagedScreenshot({ client, evidenceDirectory, name: "cancel-light-1365x740.png", width: 1365, height: 740 }),
      /already exists/i
    );
    assert.equal(
      crypto.createHash("sha256").update(fs.readFileSync(path.join(evidenceDirectory, first.relativePath))).digest("hex"),
      expectedSha256
    );
    await assert.rejects(
      capturePackagedScreenshot({ client, evidenceDirectory, name: "../escape.png", width: 1, height: 1 }),
      /input is invalid/i
    );
  } finally {
    fs.rmSync(evidenceDirectory, { recursive: true, force: true });
  }
});

test("creates and removes an isolated packaged-client profile", async () => {
  const module = await import("../scripts/lib/packaged-client-cdp.mjs");
  const profile = module.createIsolatedAcceptanceProfile("aihub-cdp-test-");
  assert.equal(
    path.relative(path.resolve(os.tmpdir()), profile.root).startsWith(".."),
    false
  );
  assert.equal(path.dirname(profile.userHome), profile.root);
  assert.equal(fs.statSync(profile.userHome).isDirectory(), true);
  assert.equal(fs.existsSync(path.join(profile.userData, "pc-settings.json")), true);
  const environment = module.createIsolatedAcceptanceEnvironment(profile, {
    USERPROFILE: "C:\\real-user",
    Home: "C:\\real-user",
    UserProfile: "C:\\mixed-user",
    AppData: "C:\\mixed-app-data",
    LocalAppData: "C:\\mixed-local-app-data",
    CodeX_Home: "C:\\mixed-codex",
    HomeDrive: "C:",
    HomePath: "\\real-user",
    CODEX_HOME: "C:\\real-codex",
    AIHUB_ACCEPTANCE_SENTINEL: "kept"
  });
  assert.equal(environment.USERPROFILE, profile.userHome);
  assert.equal(Object.hasOwn(environment, "HOME"), false);
  assert.equal(environment.CODEX_HOME, profile.codexHome);
  assert.equal(environment.AIHUB_ACCEPTANCE_SENTINEL, "kept");
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(environment).filter(([key]) =>
        [
          "APPDATA",
          "LOCALAPPDATA",
          "USERPROFILE",
          "CODEX_HOME",
          "HOME",
          "HOMEDRIVE",
          "HOMEPATH"
        ].includes(key.toUpperCase())
      )
    ),
    {
      APPDATA: profile.appData,
      LOCALAPPDATA: profile.localAppData,
      USERPROFILE: profile.userHome,
      CODEX_HOME: profile.codexHome
    }
  );
  await module.removeIsolatedAcceptanceProfile(profile);
  assert.equal(fs.existsSync(profile.root), false);
});

test("waits for the isolated client to exit and release its profile before reuse", async () => {
  const { waitForAcceptanceProfileExit } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const profile = { root: path.join(os.tmpdir(), "aihub-cdp-wait-test") };
  let polls = 0;
  let unlocked = 0;
  await waitForAcceptanceProfileExit({
    profile,
    processId: 123,
    timeoutMs: 100,
    pollIntervalMs: 1,
    processExists: () => ++polls < 3,
    assertProfileUnlocked: () => {
      unlocked += 1;
    }
  });
  assert.equal(polls, 3);
  assert.equal(unlocked, 1);
  await assert.rejects(
    waitForAcceptanceProfileExit({
      profile,
      processId: 123,
      timeoutMs: 1,
      pollIntervalMs: 1,
      processExists: () => true,
      assertProfileUnlocked: () => {
        throw new Error("must not unlock before exit");
      }
    }),
    /did not exit/i
  );
});

test("requires a real byte threshold and paused task from the download gate", async () => {
  const { verifyManagedDownloadPause } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const downloadDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "aihub-cdp-download-")
  );
  fs.writeFileSync(path.join(downloadDirectory, "installer.exe.part"), Buffer.alloc(2048));
  const calls = [];
  try {
    const result = await verifyManagedDownloadPause({
      productId: "openclaw-windows-hub",
      downloadDirectory,
      minimumBytes: 1024,
      timeoutMs: 1000,
      async evaluate(expression) {
        calls.push(expression);
        if (expression.startsWith("Boolean")) return true;
        if (expression.includes("startDownload")) return { ok: true, task: {} };
        if (expression.includes("getDownloadTask")) {
          return { phase: "downloading", progress: { receivedBytes: 2048 } };
        }
        if (expression.includes("pauseDownload")) {
          return {
            ok: true,
            task: {
              phase: "paused",
              resumable: true,
              progress: { receivedBytes: 2048, downloadDirectory }
            }
          };
        }
        throw new Error(`Unexpected expression: ${expression}`);
      }
    });
    assert.deepEqual(result, {
      productId: "openclaw-windows-hub",
      phase: "paused",
      receivedBytes: 2048,
      partialPath: path.join(downloadDirectory, "installer.exe.part")
    });
    assert.equal(calls.some((entry) => entry.includes("pauseDownload")), true);
  } finally {
    fs.rmSync(downloadDirectory, { recursive: true, force: true });
  }
});

test("rejects a paused task whose durable partial did not reach the gate", async () => {
  const { verifyManagedDownloadPause } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const downloadDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "aihub-cdp-download-")
  );
  try {
    await assert.rejects(
      verifyManagedDownloadPause({
        productId: "openclaw-windows-hub",
        downloadDirectory,
        minimumBytes: 1024,
        timeoutMs: 1000,
        async evaluate(expression) {
          if (expression.startsWith("Boolean")) return true;
          if (expression.includes("startDownload")) return { ok: true, task: {} };
          if (expression.includes("getDownloadTask")) {
            return { phase: "downloading", progress: { receivedBytes: 2048 } };
          }
          if (expression.includes("pauseDownload")) {
            return {
              ok: true,
              task: {
                phase: "paused",
                resumable: false,
                progress: { receivedBytes: 0, downloadDirectory }
              }
            };
          }
          throw new Error(`Unexpected expression: ${expression}`);
        }
      }),
      /durable partial/i
    );
  } finally {
    fs.rmSync(downloadDirectory, { recursive: true, force: true });
  }
});

test("bounds the CDP WebSocket handshake and runs failure cleanup", async () => {
  const { openCdpWebSocket } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  let closed = 0;
  let cleaned = 0;
  class NeverOpeningSocket extends EventTarget {
    close() {
      closed += 1;
    }
  }

  await assert.rejects(
    openCdpWebSocket({
      debuggerUrl: "ws://127.0.0.1:9222/devtools/page/test",
      timeoutMs: 20,
      createSocket: () => new NeverOpeningSocket(),
      onFailure: () => {
        cleaned += 1;
      }
    }),
    /timed out/i
  );
  assert.equal(closed, 1);
  assert.equal(cleaned, 1);
});

test("requires a real DOM action to expose disabled busy feedback", async () => {
  const { clickPackagedDomAction } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  await assert.rejects(
    clickPackagedDomAction({
      productId: "openclaw-windows-hub",
      action: "install-product",
      timeoutMs: 1000,
      async evaluate() {
        return { clicked: true, busyObserved: false, label: "" };
      }
    }),
    /busy feedback/i
  );

  let clickedExpression = "";
  const result = await clickPackagedDomAction({
    productId: "openclaw-windows-hub",
    action: "install-product",
    timeoutMs: 1000,
    async evaluate(expression) {
      clickedExpression = expression;
      return { clicked: true, busyObserved: true, label: "正在检测" };
    }
  });
  assert.deepEqual(result, {
    clicked: true,
    busyObserved: true,
    label: "正在检测"
  });
  assert.match(clickedExpression, /actionButton\.click\(\)/);
  assert.doesNotMatch(clickedExpression, /window\.aihubPC/);

  const refreshed = await clickPackagedDomAction({
    productId: "openclaw-windows-hub",
    action: "refresh-product",
    timeoutMs: 1000,
    async evaluate() {
      return { clicked: true, busyObserved: true, label: "正在检测" };
    }
  });
  assert.equal(refreshed.busyObserved, true);
});

test("uses the refresh action when the managed desktop is already installed", async () => {
  const { packagedManagedDownloadAction } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  assert.equal(
    packagedManagedDownloadAction({ installed: true }),
    "refresh-product"
  );
  assert.equal(
    packagedManagedDownloadAction({ installed: false }),
    "install-product"
  );
});

test("accepts either settled managed-download action instead of assuming first install", async () => {
  const { packagedManagedDownloadActionFromButtons } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  assert.equal(
    packagedManagedDownloadActionFromButtons([
      { action: "refresh-product", disabled: false }
    ]),
    "refresh-product"
  );
  assert.equal(
    packagedManagedDownloadActionFromButtons([
      { action: "install-product", disabled: false }
    ]),
    "install-product"
  );
  assert.equal(
    packagedManagedDownloadActionFromButtons([
      { action: "product-busy", disabled: true }
    ]),
    ""
  );
});

test("waits for desktop detection to settle on either managed-download action", async () => {
  const { waitForPackagedManagedDownloadAction } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  let polls = 0;
  const result = await waitForPackagedManagedDownloadAction({
    productId: "docker-desktop",
    timeoutMs: 1_000,
    async evaluate() {
      polls += 1;
      return {
        buttons: polls === 1
          ? [{ action: "product-busy", disabled: true, label: "检测中" }]
          : [{ action: "refresh-product", disabled: false, label: "重新安装" }]
      };
    }
  });
  assert.equal(result.action, "refresh-product");
  assert.equal(result.label, "重新安装");
  assert.equal(polls, 2);
});

test("finds a managed action nested inside the ProductRow install flow", async () => {
  const { waitForPackagedManagedDownloadAction } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  let expression = "";
  const result = await waitForPackagedManagedDownloadAction({
    productId: "canonical-desktop",
    timeoutMs: 1_000,
    async evaluate(nextExpression) {
      expression = nextExpression;
      return {
        buttons: [{ action: "install-product", disabled: false, label: "一键下载" }]
      };
    }
  });
  assert.equal(result.action, "install-product");
  assert.match(
    expression,
    /\.productActions \[data-aihub-action\]/,
    "the packaged helper must inspect nested installFlow buttons, not only direct children"
  );
});

test("opens a searched vendor in the requested directory when it has two channel projections", async () => {
  const { openPackagedCatalogProduct } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const expressions = [];
  await openPackagedCatalogProduct({
    evaluate: async (expression) => {
      expressions.push(expression);
      if (expression.includes('data-aihub-action') && expression.includes('catalog-search')) {
        return true;
      }
      if (expression.includes('button[data-aihub-vendor-id]')) {
        return true;
      }
      if (expression.includes('[data-aihub-product-id]')) return true;
      throw new Error(`Unexpected expression: ${expression}`);
    },
    vendorId: "asana",
    productId: "asana-work-graph",
    searchText: "Asana",
    directoryKind: "ai-connectable",
    timeoutMs: 100
  });
  const vendorClick = expressions.find((expression) =>
    expression.includes('button[data-aihub-vendor-id]')
  );
  assert.match(vendorClick, /data-aihub-search-directory-kind/);
  assert.match(vendorClick, /ai-connectable/);
});

test("drives managed download start and pause through supplied DOM actions", async () => {
  const { verifyManagedDownloadPause } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const downloadDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "aihub-cdp-download-")
  );
  fs.writeFileSync(
    path.join(downloadDirectory, "installer.exe.part"),
    Buffer.alloc(2048)
  );
  const expressions = [];
  let starts = 0;
  let pauses = 0;
  try {
    const result = await verifyManagedDownloadPause({
      productId: "openclaw-windows-hub",
      downloadDirectory,
      minimumBytes: 1024,
      timeoutMs: 1000,
      async startDownload() {
        starts += 1;
        return { ok: true, task: { phase: "starting" } };
      },
      async pauseDownload() {
        pauses += 1;
        return {
          ok: true,
          task: {
            phase: "paused",
            resumable: true,
            progress: { receivedBytes: 2048, downloadDirectory }
          }
        };
      },
      async evaluate(expression) {
        expressions.push(expression);
        if (expression.startsWith("Boolean")) return true;
        if (expression.includes("getDownloadTask")) {
          return { phase: "downloading", progress: { receivedBytes: 2048 } };
        }
        throw new Error(`Unexpected expression: ${expression}`);
      }
    });
    assert.equal(starts, 1);
    assert.equal(pauses, 1);
    assert.equal(
      expressions.some(
        (expression) =>
          expression.includes("startDownload") || expression.includes("pauseDownload")
      ),
      false
    );
    assert.equal(result.receivedBytes, 2048);
  } finally {
    fs.rmSync(downloadDirectory, { recursive: true, force: true });
  }
});

test("accepts a newer remote catalog while rejecting stale or local data", async () => {
  const { assertPackagedRemoteCatalog } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const newer = {
    source: "remote",
    catalogVersion: 12,
    catalog: { vendors: [{ id: "openai", products: [] }] }
  };
  assert.equal(
    assertPackagedRemoteCatalog({ catalog: newer, minimumCatalogVersion: 10 }),
    newer
  );
  assert.throws(
    () =>
      assertPackagedRemoteCatalog({
        catalog: { ...newer, catalogVersion: 9 },
        minimumCatalogVersion: 10
      }),
    /remote signed catalog/i
  );
  assert.throws(
    () =>
      assertPackagedRemoteCatalog({
        catalog: { ...newer, source: "built-in" },
        minimumCatalogVersion: 10
      }),
    /remote signed catalog/i
  );
});

test("the packaged release gate does not bypass renderer actions", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "verify-local-release-client.mjs"),
    "utf8"
  );
  const helperSource = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "lib", "packaged-client-cdp.mjs"),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /window\.aihubPC\.(?:installExtension|uninstallExtension|startDownload|pauseDownload)\(/
  );
  assert.doesNotMatch(
    source,
    /expectedSlogan|renderer readiness marker/,
    "renderer readiness must come from a remote catalog resource in the real DOM, not shared brand copy"
  );
  for (const action of [
    "inspect-extension",
    "install-extension",
    "uninstall-extension",
    "pause-download"
  ]) {
    assert.match(source, new RegExp(`action: ["']${action}["']`));
  }
  assert.match(source, /packagedManagedDownloadAction\(/);
  assert.match(source, /action: downloadAction/);
  assert.match(source, /profile\.userHome[\s\S]*?"\.agents"[\s\S]*?"skills"/);
  assert.doesNotMatch(source, /profile\.codexHome[\s\S]{0,80}?"skills"/);
  assert.doesNotMatch(
    helperSource,
    /legacyResource/,
    "a resource summary must not be accepted as an opened detail page"
  );
});
