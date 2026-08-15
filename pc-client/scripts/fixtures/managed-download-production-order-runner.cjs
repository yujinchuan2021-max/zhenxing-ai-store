"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const electron = require("electron");
const { createReleaseStore } = require("../../admin/release-store.cjs");
const { runProductionOrderCancelEvidence } = require("./managed-download-production-order-cancel.cjs");
const {
  createProductionOrderCheckpoint,
  withProductionOrderHardTimeout
} = require("../lib/managed-download-production-order-lifecycle.cjs");

// This fixture executes current handler semantics under a Test facade; it is not the exact production process lifecycle.

const root = path.resolve(__dirname, "..", "..");
const userData = process.env.AIHUB_MANAGED_DOWNLOAD_QUEUE_USER_DATA;
const order = process.env.AIHUB_MANAGED_DOWNLOAD_PRODUCTION_ORDER;
const productId = "wondershare-filmora";
if (!userData) throw new Error("fixture user data is required");
if (!["status-before-reply", "reply-before-status"].includes(order)) {
  throw new Error("fixture order is invalid");
}

function keepProductionOrderRootAlive() {}
electron.app.on("window-all-closed", keepProductionOrderRootAlive);

electron.app.setPath("userData", userData);
const checkpoint = createProductionOrderCheckpoint(userData);
const totalDeadline = performance.now() + 60_000;
let fixtureWindow = null;
let totalTimer = null;

function remainingTimeout(maximum = 10_000) {
  return Math.max(1, Math.min(maximum, Math.ceil(totalDeadline - performance.now())));
}

function hardTimeout(action, code, maximum = 10_000) {
  return withProductionOrderHardTimeout(action, remainingTimeout(maximum), code);
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function commandResultClass(value) {
  if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 && value.ok === true) {
    return "ok";
  }
  if (
    value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === 2 && value.ok === false &&
    typeof value.errorCode === "string" && value.errorCode.length > 0
  ) return "rejected";
  return "malformed";
}

function waitFor(check, message, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        if (await hardTimeout(check, "PRODUCTION_ORDER_CHECK_TIMEOUT", Math.min(timeoutMs, 5_000))) return resolve();
        if (performance.now() > deadline) return reject(new Error(message));
        setTimeout(poll, 20);
      } catch (error) {
        reject(error);
      }
    };
    void poll();
  });
}

async function executeJavaScript(expression) {
  return hardTimeout(
    () => fixtureWindow.webContents.executeJavaScript(expression),
    "PRODUCTION_ORDER_RENDERER_EVALUATE_TIMEOUT"
  );
}

async function activeEnvelope() {
  const store = createReleaseStore({
    rootDirectory: path.join(root, "admin", "published", "catalog-store"),
    signingKeyProvider: async () => { throw new Error("read-only fixture"); }
  });
  const channel = await store.readChannel("v2");
  return (await store.readRelease(channel.activeRelease.releaseId, { channel: "v2" })).envelope;
}

async function compileMain({ envelope, networkSession }) {
  const mainPath = path.join(root, "electron", "main.cjs");
  const handlers = new Map();
  const appFacade = {
    commandLine: { hasSwitch: () => true },
    getPath: () => userData,
    getVersion: () => "0.1.80-fixture",
    isPackaged: true,
    isReady: () => false,
    on() {},
    quit() {},
    requestSingleInstanceLock: () => true,
    setAppUserModelId() {},
    setPath() {},
    whenReady: () => Promise.resolve()
  };
  const electronFacade = {
    ...electron,
    app: appFacade,
    BrowserWindow: electron.BrowserWindow,
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    net: {
      fetch: async () => new Response(JSON.stringify(envelope), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    },
    session: {
      defaultSession: networkSession,
      fromPartition: () => networkSession
    }
  };
  const sourceBytes = fs.readFileSync(mainPath, "utf8");
  const readyMarker = ".then(async () => {\n      if (process.platform === \"win32\")";
  assert.equal(sourceBytes.split(readyMarker).length - 1, 1, "current main ready bootstrap marker must be exact");
  const source = sourceBytes.replace(
    readyMarker,
    ".then(async () => {\n      registerIpc();\n      return;\n      if (process.platform === \"win32\")"
  );
  const originalLoad = Module._load;
  Module._load = (specifier, parent, isMain) =>
    specifier === "electron" ? electronFacade : originalLoad(specifier, parent, isMain);
  try {
    const loaded = new Module(mainPath, module);
    loaded.filename = mainPath;
    loaded.paths = Module._nodeModulePaths(path.dirname(mainPath));
    loaded._compile(source, mainPath);
  } finally {
    Module._load = originalLoad;
  }
  await waitFor(
    () => ["catalog:get", "download:enqueue", "download:list", "download:status", "download:cancel", "download:retry"]
      .every((channel) => typeof handlers.get(channel) === "function"),
    "current main handlers were not registered"
  );
  return handlers;
}

async function run() {
  let residueCompleted = false;
  const resources = path.join(userData, "fixture-resources");
  fs.mkdirSync(path.join(resources, "catalog"), { recursive: true });
  fs.copyFileSync(
    path.join(root, "catalog", "channel.server-connected-review.json"),
    path.join(resources, "catalog", "channel.json")
  );
  Object.defineProperty(process, "resourcesPath", {
    configurable: true,
    value: resources
  });

  const realNow = Date.now;
  let fixtureNow = 1_000;
  Date.now = () => fixtureNow;
  const headersGate = deferred();
  const replyGate = deferred();
  const observation = {
    emittedQueued: false,
    emittedStarting: false,
    emittedDownloading: false,
    deliveredDownloading: false,
    enqueueReplyReady: false,
    statusCalls: 0,
    currentRawTask: null,
    chunkSent: false,
    bodyController: null,
    cancelMainSettled: false,
    cancelMainResultClass: "none"
  };
  const networkSession = {
    async setProxy() {},
    async forceReloadProxyConfig() {},
    async closeAllConnections() {},
    async fetch(_url, options = {}) {
      await headersGate.promise;
      if (options.signal?.aborted) {
        throw Object.assign(new Error("fixture aborted"), { name: "AbortError" });
      }
      const body = new ReadableStream({
        start(controller) {
          observation.bodyController = controller;
          options.signal?.addEventListener("abort", () => {
            try { controller.error(Object.assign(new Error("fixture aborted"), { name: "AbortError" })); } catch {}
          }, { once: true });
        }
      });
      return new Response(body, {
        status: 200,
        headers: {
          "content-length": "1024",
          "content-type": "application/octet-stream"
        }
      });
    }
  };

  checkpoint.write("main-compile", "entered");
  const handlers = await hardTimeout(
    async () => compileMain({ envelope: await activeEnvelope(), networkSession }),
    "PRODUCTION_ORDER_MAIN_COMPILE_TIMEOUT"
  );
  checkpoint.write("main-compile", "completed");
  const requiredChannels = [
    "catalog:get",
    "download:enqueue",
    "download:list",
    "download:status",
    "download:cancel",
    "download:retry"
  ];
  for (const channel of requiredChannels) assert.equal(typeof handlers.get(channel), "function", `missing current main handler: ${channel}`);
  checkpoint.write("ipc-bridge-register", "entered");
  for (const channel of requiredChannels) {
    const handler = handlers.get(channel);
    electron.ipcMain.handle(channel, async (event, ...args) => {
      try {
        const result = await handler(event, ...args);
        if (channel === "download:enqueue") {
          observation.enqueueReplyReady = true;
          await replyGate.promise;
        }
        if (channel === "download:status") observation.statusCalls += 1;
        if (channel === "download:cancel") {
          observation.cancelMainSettled = true;
          observation.cancelMainResultClass = commandResultClass(result);
        }
        return result;
      } catch (error) {
        if (channel === "download:cancel") {
          observation.cancelMainSettled = true;
          observation.cancelMainResultClass = "rejected";
        }
        throw error;
      }
    });
  }
  checkpoint.write("ipc-bridge-register", "completed");

  checkpoint.write("window-create", "entered");
  const window = new electron.BrowserWindow({
    show: false,
    width: 1365,
    height: 768,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "installed-management-preview-preload.cjs")
    }
  });
  fixtureWindow = window;
  checkpoint.write("window-create", "completed");
  const originalSend = window.webContents.send.bind(window.webContents);
  window.webContents.send = (channel, task) => {
    if (channel === "download:task" && task?.productId === productId) {
      observation.currentRawTask = task;
      if (task.phase === "queued") observation.emittedQueued = true;
      if (task.phase === "starting") observation.emittedStarting = true;
      if (task.phase === "downloading") {
        observation.emittedDownloading = true;
        if (!observation.chunkSent && task.progress?.receivedBytes === 0 && observation.bodyController) {
          observation.chunkSent = true;
          fixtureNow += 99;
          queueMicrotask(() => observation.bodyController.enqueue(new Uint8Array(128)));
        }
      }
    }
    return originalSend(channel, task);
  };

  try {
    checkpoint.write("renderer-load", "entered");
    await hardTimeout(() => window.loadFile(path.join(root, "dist", "index.html")), "PRODUCTION_ORDER_RENDERER_LOAD_TIMEOUT");
    await waitFor(
      () => executeJavaScript(
        "[...document.querySelectorAll('.navItem')].some((node) => node.textContent.includes('全部 AI 厂商'))"
      ),
      "vendor navigation missing"
    );
    await executeJavaScript(
      "[...document.querySelectorAll('.navItem')].find((node) => node.textContent.includes('全部 AI 厂商')).click()"
    );
    checkpoint.write("renderer-load", "completed");
    checkpoint.write("catalog", "entered");
    const vendorId = (await hardTimeout(activeEnvelope, "PRODUCTION_ORDER_CATALOG_TIMEOUT")).payload.catalog.vendors.find((vendor) =>
      vendor.products.some((product) => product.id === productId)
    ).id;
    await waitFor(
      () => executeJavaScript(
        `Boolean(document.querySelector('[data-aihub-vendor-id=${JSON.stringify(vendorId)}]'))`
      ),
      "reviewed vendor missing"
    );
    await executeJavaScript(
      `document.querySelector('[data-aihub-vendor-id=${JSON.stringify(vendorId)}]').click()`
    );
    checkpoint.write("catalog", "completed");
    checkpoint.write("enqueue", "entered");
    const buttonSelector = `[data-aihub-product-id=${JSON.stringify(productId)}] [data-aihub-action=enqueue-managed-download]`;
    await waitFor(
      () => executeJavaScript(`Boolean(document.querySelector(${JSON.stringify(buttonSelector)}))`),
      "reviewed product download action missing"
    );
    await executeJavaScript("Promise.all([window.aihubPC.listManagedDownloadTasks(),window.aihubPC.listManagedDownloadTasks()])");
    const listCallsBefore = await executeJavaScript(
      "window.aihubPC.fixtureGetProductionOrderDiagnostics().listCallCount"
    );
    assert.ok(listCallsBefore >= 2, "list baseline must exercise the former many bucket");
    if (process.env.AIHUB_MANAGED_DOWNLOAD_PRODUCTION_ORDER_FORCE_EXTRA_LIST === "1") {
      await executeJavaScript("window.aihubPC.listManagedDownloadTasks()");
    }
    await executeJavaScript(`document.querySelector(${JSON.stringify(buttonSelector)}).click()`);
    await waitFor(
      () => observation.enqueueReplyReady && observation.emittedQueued && observation.emittedStarting,
      "enqueue did not reach queued and starting before reply"
    );
    checkpoint.write("enqueue", "completed");
    checkpoint.write("order-gates", "entered");

    const phaseExpression = `document.querySelector('[data-aihub-product-id=${JSON.stringify(productId)}] [data-aihub-managed-download-phase]')?.getAttribute('data-aihub-managed-download-phase')`;
    if (order === "status-before-reply") {
      headersGate.resolve();
      await waitFor(() => observation.emittedDownloading, "downloading event was not emitted before reply");
      await waitFor(
        () => executeJavaScript(`${phaseExpression} === 'downloading'`),
        "downloading status did not reach renderer before reply"
      );
      replyGate.resolve();
    } else {
      replyGate.resolve();
      await waitFor(
        () => executeJavaScript(
          `window.aihubPC.fixtureGetProductionOrderDiagnostics().enqueueSettled && ${phaseExpression} === 'queued'`
        ),
        "queued enqueue reply did not reach renderer first"
      );
      headersGate.resolve();
    }
    checkpoint.write("order-gates", "completed");

    checkpoint.write("convergence", "entered");
    await waitFor(
      () => executeJavaScript(`${phaseExpression} === 'downloading'`),
      "product card did not converge to downloading"
    );
    await executeJavaScript("document.querySelector('.topActions .quietButton:nth-child(2)').click()");
    const rowSelector = `.managedQueueTask[data-product-id=${JSON.stringify(productId)}]`;
    await waitFor(
      () => executeJavaScript(
        `document.querySelector(${JSON.stringify(rowSelector)})?.getAttribute('data-aihub-managed-download-phase') === 'downloading'`
      ),
      "task center did not converge to downloading"
    );
    const taskDom = await executeJavaScript(`(() => {
      const row = document.querySelector(${JSON.stringify(rowSelector)});
      const product = document.querySelector('[data-aihub-product-id=${productId}]');
      return {
        rowCount: document.querySelectorAll(${JSON.stringify(rowSelector)}).length,
        rowPhase: row?.getAttribute('data-aihub-managed-download-phase') || 'none',
        productPhase: product?.querySelector('[data-aihub-managed-download-phase]')?.getAttribute('data-aihub-managed-download-phase') || 'none',
        canCancel: Boolean(row?.querySelector('[data-aihub-action=cancel-managed-download]'))
      };
    })()`);
    assert.deepEqual(taskDom, {
      rowCount: 1,
      rowPhase: "downloading",
      productPhase: "downloading",
      canCancel: true
    });
    checkpoint.write("convergence", "completed");

    checkpoint.write("stale", "entered");
    const beforeStale = await executeJavaScript(
      "window.aihubPC.fixtureGetProductionOrderDiagnostics().statusCallCount"
    );
    const current = observation.currentRawTask;
    assert.ok(current?.attemptId);
    originalSend("download:task", {
      ...current,
      attemptId: "fixture-old-attempt",
      attempt: Math.max(1, current.attempt || 1),
      revision: Math.max(1, current.revision || 1),
      phase: "failed",
      errorMessage: "PRODUCTION_ORDER_RAW_SECRET",
      filePath: "C:\\PRODUCTION_ORDER_RAW_SECRET.exe"
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(await executeJavaScript(`${phaseExpression}`), "downloading");
    assert.equal(
      await executeJavaScript("document.body.textContent.includes('PRODUCTION_ORDER_RAW_SECRET')"),
      false
    );
    assert.equal(
      await executeJavaScript(
        "window.aihubPC.fixtureGetProductionOrderDiagnostics().statusCallCount"
      ),
      beforeStale,
      "a different old attempt must not trigger a public status read"
    );
    checkpoint.write("stale", "completed");

    checkpoint.write("evidence-gates", "entered");
    const diagnostics = await executeJavaScript(
      "window.aihubPC.fixtureGetProductionOrderDiagnostics()"
    );
    observation.deliveredDownloading = diagnostics.eventDelivered;
    assert.equal(observation.emittedDownloading, true);
    assert.equal(observation.deliveredDownloading, true);
    assert.equal(diagnostics.eventAccepted, true);
    assert.equal(diagnostics.attemptMatch, true);
    assert.equal(diagnostics.lastStatusPhase, "downloading");
    assert.notEqual(diagnostics.statusCallCountClass, "zero");
    assert.equal(diagnostics.listCallCount, listCallsBefore, "focus/list refresh is forbidden");
    const safeObservation = {
      eventEmitted: observation.emittedDownloading,
      eventDelivered: observation.deliveredDownloading,
      eventAccepted: diagnostics.eventAccepted,
      attemptMatch: diagnostics.attemptMatch,
      statusCallCountClass: diagnostics.statusCallCountClass,
      listCallDeltaZero: diagnostics.listCallCount === listCallsBefore,
      oldAttemptStatusDeltaZero: diagnostics.statusCallCount === beforeStale,
      domTaskMatch:
        taskDom.rowCount === 1 &&
        taskDom.rowPhase === taskDom.productPhase &&
        taskDom.canCancel
    };
    assert.deepEqual(safeObservation, {
      eventEmitted: true,
      eventDelivered: true,
      eventAccepted: true,
      attemptMatch: true,
      statusCallCountClass: safeObservation.statusCallCountClass,
      listCallDeltaZero: true,
      oldAttemptStatusDeltaZero: true,
      domTaskMatch: true
    });
    checkpoint.write("evidence-gates", "completed");

    const envelope = await hardTimeout(activeEnvelope, "PRODUCTION_ORDER_RESIDUE_TIMEOUT");
    const formalName = envelope.payload.catalog.vendors
      .flatMap((vendor) => vendor.products || [])
      .find((product) => product.id === productId)?.download?.fileName;
    assert.equal(typeof formalName, "string", "fixture formal file name must be catalog controlled");
    const fileCounts = () => {
      const entries = fs.readdirSync(userData, { recursive: true }).map(String);
      return {
        partCountClass: entries.some((entry) => entry.endsWith(".part")) ? "nonzero" : "zero",
        formalCountClass: entries.some((entry) => path.basename(entry) === formalName) ? "nonzero" : "zero"
      };
    };
    observation.cancelMainSettled = false;
    observation.cancelMainResultClass = "none";
    const cancelActual = await runProductionOrderCancelEvidence({
      checkpoint,
      timeoutMs: remainingTimeout(10_000),
      readStatus: () => executeJavaScript(`(async () => {
        const result = await window.aihubPC.getManagedDownloadTaskStatus({ productId: ${JSON.stringify(productId)} });
        if (!result || typeof result !== 'object' || Array.isArray(result)) return { envelopeClass: 'malformed', requestReady: false };
        if (result.ok !== true) return { envelopeClass: result.ok === false ? 'rejected' : 'malformed', requestReady: false };
        if (!result.task || result.task.productId !== ${JSON.stringify(productId)} || typeof result.task.taskId !== 'string' || !result.task.taskId) {
          return { envelopeClass: 'malformed', requestReady: false };
        }
        Object.defineProperty(window, '__aihubProductionOrderCancelInput', {
          configurable: true,
          value: { productId: ${JSON.stringify(productId)}, taskId: result.task.taskId, confirmed: true }
        });
        return { envelopeClass: 'ok', requestReady: true };
      })()`),
      requestCancel: () => executeJavaScript(`(() => {
        const input = window.__aihubProductionOrderCancelInput;
        delete window.__aihubProductionOrderCancelInput;
        return window.aihubPC.cancelManagedDownload(input);
      })()`),
      inspectMainCancel: async () => ({
        settled: observation.cancelMainSettled,
        resultClass: observation.cancelMainResultClass
      }),
      inspectClearance: async () => {
        const result = await handlers.get("download:list")();
        return {
          taskAbsent: !result.some((task) => task.productId === productId),
          ...fileCounts()
        };
      }
    });
    assert.deepEqual(cancelActual, {
      statusEnvelopeClass: "ok",
      cancelEnvelopeClass: "ok",
      taskAbsent: true,
      partCountClass: "zero",
      formalCountClass: "zero",
      responseOk: true
    });
    checkpoint.write("residue", "entered");
    assert.equal(
      fs.readdirSync(userData, { recursive: true }).filter((entry) => String(entry).endsWith(".part")).length,
      0,
      "fixture partial download must be removed"
    );
    assert.equal(
      fs.readdirSync(userData, { recursive: true }).filter((entry) => path.basename(String(entry)) === formalName).length,
      0,
      "fixture formal download must be absent"
    );
    checkpoint.write("residue", "completed");
    residueCompleted = true;
  } finally {
    Date.now = realNow;
    if (residueCompleted) checkpoint.write("window-destroy", "entered");
    window.destroy();
    fixtureWindow = null;
    if (residueCompleted) checkpoint.write("window-destroy", "completed");
  }
}

totalTimer = setTimeout(() => {
  try { fixtureWindow?.destroy(); } catch {}
  electron.app.exit(2);
}, 60_000);
electron.app.whenReady()
  .then(run)
  .then(() => {
    checkpoint.write("exit-request-ready", "entered");
    checkpoint.write("exit-request-ready", "completed");
  })
  .catch(() => {
    try { fixtureWindow?.destroy(); } catch {}
    process.stderr.write("PRODUCTION_ORDER_FIXTURE_FAILED\n");
  });
