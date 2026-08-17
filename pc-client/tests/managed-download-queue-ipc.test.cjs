"use strict";

const assert = require("node:assert/strict");
const Module = require("node:module");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");
const vm = require("node:vm");

function preloadHarness(result) {
  const calls = [];
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: { exposeInMainWorld(_name, api) { context.bridge = api; } },
        ipcRenderer: {
          invoke: async (...args) => {
            calls.push(args);
            return typeof result === "function" ? result(...args) : result;
          },
          on() {},
          removeListener() {}
        }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8"),
    context,
    { filename: "electron/preload.cjs" }
  );
  return { bridge: context.bridge, calls };
}

function loadMainIpcHandlers(
  userData,
  providedSession = null,
  browserWindows = [],
  options = {}
) {
  const mainPath = path.join(__dirname, "../electron/main.cjs");
  const handlers = new Map();
  const stalledSession = {
    setProxy: async () => {},
    forceReloadProxyConfig: async () => {},
    closeAllConnections: async () => {},
    fetch(_url, options) {
      return new Promise((_resolve, reject) => {
        const error = Object.assign(new Error("fixture download aborted"), {
          name: "AbortError",
          code: "ABORT_ERR"
        });
        if (options?.signal?.aborted) return reject(error);
        options?.signal?.addEventListener("abort", () => reject(error), { once: true });
      });
    }
  };
  const networkSession = providedSession || stalledSession;
  const app = {
    commandLine: { hasSwitch: () => true },
    getPath: () => userData,
    isReady: () => false,
    on() {},
    quit() {},
    requestSingleInstanceLock: () => true,
    whenReady: () => new Promise(() => {})
  };
  const electron = {
    app,
    BrowserWindow: { getAllWindows: () => browserWindows },
    dialog: {
      showMessageBox: async () => ({
        response: options.confirmationResponse ?? 0
      })
    },
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    Menu: {},
    net: {},
    Notification: class {},
    safeStorage: {},
    session: { defaultSession: networkSession, fromPartition: () => networkSession },
    shell: {},
    Tray: class {}
  };
  const source = `${fs.readFileSync(mainPath, "utf8")}\nmodule.exports = { registerIpc, startManagedDownload, getManagedDownloadQueue, advanceManagedDownloadTask, recordManagedDownloadProgress };`;
  const originalLoad = Module._load;
  const childProcess = options.execFile
    ? { ...originalLoad("node:child_process", module, false), execFile: options.execFile }
    : null;
  Module._load = (specifier, parent, isMain) =>
    specifier === "electron"
      ? electron
      : specifier === "node:child_process" && childProcess
        ? childProcess
        : originalLoad(specifier, parent, isMain);
  try {
    const loaded = new Module(mainPath, module);
    loaded.filename = mainPath;
    loaded.paths = Module._nodeModulePaths(path.dirname(mainPath));
    loaded._compile(source, mainPath);
    loaded.exports.registerIpc();
    return { handlers, main: loaded.exports };
  } finally {
    Module._load = originalLoad;
  }
}

function validEnvironmentSignatureExecFile() {
  const execFile = () => {};
  execFile[promisify.custom] = async () => ({
    stdout: JSON.stringify({
      Status: "Valid",
      Signer: "CN=Python Software Foundation"
    })
  });
  return execFile;
}

function validManagedPackageSignatureExecFile() {
  const execFile = () => {};
  execFile[promisify.custom] = async (_file, _args, options) => {
    const fileName = path.basename(options?.env?.AIHUB_SIGNATURE_PATH || "");
    return {
      stdout: JSON.stringify({
        Status: "Valid",
        Signer: fileName.startsWith("ChatGPT")
          ? "CN=Microsoft Corporation, O=Microsoft Corporation"
          : "CN=Anthropic, PBC, O=Anthropic, PBC"
      })
    };
  };
  return execFile;
}

test("the first public downloading transition bypasses progress throttling", (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-notification-"));
  const messages = [];
  const browserWindow = {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      send: (channel, task) => messages.push({ channel, task })
    }
  };
  const realNow = Date.now;
  let now = 1_000;
  Date.now = () => now;
  t.after(() => {
    Date.now = realNow;
    fs.rmSync(userData, { recursive: true, force: true });
  });
  const { main } = loadMainIpcHandlers(userData, null, [browserWindow]);
  const productId = "wondershare-filmora";
  const attemptId = "notification-attempt";
  const progress = failedTask(productId).progress;

  assert.equal(main.advanceManagedDownloadTask(productId, {
    type: "queue",
    attemptId,
    progress
  }).accepted, true);
  assert.equal(main.advanceManagedDownloadTask(productId, {
    type: "begin",
    attemptId
  }).accepted, true);
  assert.deepEqual(
    messages.map(({ task }) => task.phase),
    ["queued", "starting"]
  );

  messages.length = 0;
  assert.equal(main.recordManagedDownloadProgress(productId, attemptId, progress).accepted, true);
  assert.deepEqual(
    messages.map(({ task }) => task.phase),
    ["downloading"],
    "the only progress event must invalidate the queued public presentation"
  );

  messages.length = 0;
  now += 99;
  main.recordManagedDownloadProgress(productId, attemptId, {
    ...progress,
    receivedBytes: progress.receivedBytes + 1
  });
  assert.deepEqual(messages, [], "same-phase progress stays throttled inside 100ms");
  now += 1;
  main.recordManagedDownloadProgress(productId, attemptId, {
    ...progress,
    receivedBytes: progress.receivedBytes + 2
  });
  assert.deepEqual(
    messages.map(({ task }) => task.phase),
    ["downloading"],
    "same-phase progress still broadcasts at the existing 100ms boundary"
  );

  messages.length = 0;
  assert.equal(main.advanceManagedDownloadTask(productId, {
    type: "failed",
    attemptId,
    resumable: true,
    errorCode: "DOWNLOAD_FAILED",
    errorMessage: "fixture failure",
    progress
  }).accepted, true);
  assert.deepEqual(messages.map(({ task }) => task.phase), ["failed"]);

  const cancelProductId = "wondershare-edrawmax";
  const cancelAttemptId = "cancel-notification-attempt";
  main.advanceManagedDownloadTask(cancelProductId, {
    type: "queue",
    attemptId: cancelAttemptId,
    progress
  });
  main.advanceManagedDownloadTask(cancelProductId, {
    type: "begin",
    attemptId: cancelAttemptId
  });
  main.recordManagedDownloadProgress(cancelProductId, cancelAttemptId, progress);
  messages.length = 0;
  assert.equal(main.advanceManagedDownloadTask(cancelProductId, {
    type: "cancel-requested",
    attemptId: cancelAttemptId
  }).accepted, true);
  assert.equal(main.advanceManagedDownloadTask(cancelProductId, {
    type: "cancel",
    attemptId: cancelAttemptId
  }).accepted, true);
  assert.deepEqual(
    messages.map(({ task }) => task.phase),
    ["canceling", "canceled"]
  );
});

function destructiveStalledSession() {
  const requests = new Set();
  let fetchCount = 0;
  return {
    get fetchCount() {
      return fetchCount;
    },
    async setProxy() {},
    async forceReloadProxyConfig() {},
    async closeAllConnections() {
      for (const request of [...requests]) {
        request.reject(new TypeError("Failed to fetch"));
      }
    },
    fetch(_url, options) {
      fetchCount += 1;
      return new Promise((_resolve, reject) => {
        const request = { reject };
        requests.add(request);
        const fail = (error) => {
          requests.delete(request);
          reject(error);
        };
        request.reject = fail;
        if (options?.signal?.aborted) {
          fail(Object.assign(new Error("fixture download aborted"), {
            name: "AbortError",
            code: "ABORT_ERR"
          }));
          return;
        }
        options?.signal?.addEventListener("abort", () => fail(
          Object.assign(new Error("fixture download aborted"), {
            name: "AbortError",
            code: "ABORT_ERR"
          })
        ), { once: true });
      });
    }
  };
}

function fixedDesktopPlan(productId) {
  const { buildDesktopDownloadOnlyPlan, getDesktopDownloadOnlyProfile } = require("../shared/desktop-download-only.cjs");
  const profile = getDesktopDownloadOnlyProfile(productId);
  return buildDesktopDownloadOnlyPlan(productId, {
    url: `https://${profile.allowedDomains[0]}/${productId}-fixture.exe`,
    fileName: `${productId}-fixture.exe`,
    artifactKind: "exe"
  });
}

function signedDesktopPlan(productId) {
  const { buildSignedDesktopDownloadPlan } = require("../shared/desktop-download-only.cjs");
  return buildSignedDesktopDownloadPlan(productId, {
    url: "https://assets.tana.inc/desktop/Tana-Setup-windows.exe",
    fileName: "Tana-Setup-windows.exe",
    artifactKind: "exe"
  });
}

function failedTask(productId = "claude-desktop") {
  return {
    schemaVersion: 1,
    productId,
    attemptId: "attempt-failed-status",
    attempt: 1,
    revision: 2,
    phase: "failed",
    resumable: true,
    progress: {
      receivedBytes: 128,
      totalBytes: 1024,
      bytesPerSecond: 0,
      etaSeconds: null,
      percent: 13,
      availableBytes: null,
      requiredBytes: null,
      remainingBytes: null,
      reserveBytes: null,
      installDiskBytes: null,
      installAvailableBytes: null,
      downloadDirectory: null,
      installSpaceOk: null,
      spaceOk: null
    },
    errorCode: "DOWNLOAD_INCOMPLETE",
    errorMessage: "fixture failure",
    filePath: null,
    sha256: null,
    fileSize: null,
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:01.000Z",
    logs: ["fixture failure"]
  };
}

function completedTask(productId, filePath, sha256, fileSize) {
  return {
    ...failedTask(productId),
    attemptId: "attempt-completed-package",
    revision: 3,
    phase: "completed",
    resumable: false,
    progress: {
      ...failedTask(productId).progress,
      receivedBytes: fileSize,
      totalBytes: fileSize,
      percent: 100
    },
    errorCode: null,
    errorMessage: null,
    filePath,
    sha256,
    fileSize,
    logs: ["fixture completed"]
  };
}

test("managed download queue preload exposes only fixed task operations and rejects executable input", async () => {
  const { bridge, calls } = preloadHarness({ ok: true });
  assert.deepEqual(Object.keys(bridge).filter((key) => /ManagedDownload/.test(key)).sort(), [
    "cancelManagedDownload", "enqueueManagedDownload", "getManagedDownloadTaskStatus",
    "listManagedDownloadTasks", "retryManagedDownload"
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.enqueueManagedDownload({
      productId: "safe-product",
      artifact: { url: "https://official.example/download.exe", fileName: "download.exe", artifactKind: "exe", command: "cmd.exe" }
    }))),
    { ok: false, errorCode: "INPUT_INVALID" }
  );
  assert.equal(calls.length, 0);
});

test("package management exposes one bounded first-entry discovery operation", async () => {
  const { bridge, calls } = preloadHarness([]);
  assert.equal(typeof bridge.discoverDownloadedPackages, "function");

  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.discoverDownloadedPackages([
      { productId: "chatgpt-desktop" },
      {
        productId: "canva-windows",
        artifact: {
          url: "https://download.canva.com/windows/Canva%20Setup%201.123.1.exe",
          fileName: "Canva Setup 1.123.1.exe",
          artifactKind: "exe"
        }
      }
    ]))),
    []
  );
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[
    "download:discover-packages",
    [
      { productId: "chatgpt-desktop" },
      {
        productId: "canva-windows",
        artifact: {
          url: "https://download.canva.com/windows/Canva%20Setup%201.123.1.exe",
          fileName: "Canva Setup 1.123.1.exe",
          artifactKind: "exe"
        }
      }
    ]
  ]]);

  const before = calls.length;
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.discoverDownloadedPackages([
      { productId: "safe-product", command: "cmd.exe" }
    ]))),
    { ok: false, errorCode: "INPUT_INVALID" }
  );
  assert.equal(calls.length, before);
});

test("first package entry discovers reviewed installers and exact deletion preserves its sibling", async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-package-entry-"));
  const downloadRoot = path.join(userData, "packages");
  fs.mkdirSync(downloadRoot);
  fs.writeFileSync(path.join(userData, "pc-settings.json"), JSON.stringify({
    downloadDirectory: downloadRoot,
    cliInstallDirectory: "",
    language: "zh"
  }));
  const chatgptPath = path.join(downloadRoot, "ChatGPT Installer.exe");
  const claudePath = path.join(downloadRoot, "Claude-Setup-x64.exe");
  const unrelatedPath = path.join(downloadRoot, "Unreviewed Tool.exe");
  fs.writeFileSync(chatgptPath, "chatgpt-installer");
  fs.writeFileSync(claudePath, "claude-installer");
  fs.writeFileSync(unrelatedPath, "unreviewed-installer");

  const { handlers, main } = loadMainIpcHandlers(userData, null, [], {
    confirmationResponse: 1,
    execFile: validManagedPackageSignatureExecFile()
  });
  t.after(() => {
    main.getManagedDownloadQueue().dispose();
    fs.rmSync(userData, { recursive: true, force: true });
  });
  const { bridge } = preloadHarness((channel, input) =>
    handlers.get(channel)(
      null,
      input === undefined ? undefined : JSON.parse(JSON.stringify(input))
    )
  );

  const discovered = JSON.parse(JSON.stringify(
    await bridge.discoverDownloadedPackages([
      { productId: "chatgpt-desktop" },
      { productId: "claude-desktop" }
    ])
  ));
  assert.deepEqual(
    discovered.map((task) => [task.productId, task.phase]),
    [["chatgpt-desktop", "downloaded"], ["claude-desktop", "downloaded"]]
  );
  assert.equal(fs.existsSync(unrelatedPath), true);

  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.deleteDownloadedPackage("chatgpt-desktop"))),
    { ok: true, filePath: chatgptPath }
  );
  assert.equal(fs.existsSync(chatgptPath), false);
  assert.equal(fs.existsSync(claudePath), true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.listManagedDownloadTasks()))
      .map((task) => task.productId),
    ["claude-desktop"]
  );
  const records = JSON.parse(fs.readFileSync(path.join(userData, "download-records.json"), "utf8"));
  assert.deepEqual(Object.keys(records), ["claude-desktop"]);
});

test("managed download queue preload returns only public task status", async () => {
  const { bridge, calls } = preloadHarness({
    ok: true,
    task: {
      taskId: "attempt-1", productId: "safe-product", profileId: "fixed-profile",
      phase: "queued", progress: { receivedBytes: 0, totalBytes: 0, bytesPerSecond: 0, percent: null },
      presentation: { state: "active", canCancel: true, canRetry: false },
      filePath: "C:\\private\\download.exe"
    }
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.enqueueManagedDownload({ productId: "safe-product" }))),
    { ok: false, errorCode: "DOWNLOAD_QUEUE_REJECTED" }
  );
  assert.equal(calls[0][0], "download:enqueue");
});

test("managed download queue preload accepts a pure signed-artifact envelope", async () => {
  const task = {
    taskId: "attempt-1", productId: "safe-product", profileId: "fixed-profile",
    phase: "queued", progress: { receivedBytes: 0, totalBytes: 0, bytesPerSecond: 0, percent: null },
    presentation: { state: "active", canCancel: true, canRetry: false }
  };
  const { bridge, calls } = preloadHarness({ ok: true, task });
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.enqueueManagedDownload({
      productId: "safe-product",
      artifact: { url: "https://official.example/download.exe", fileName: "download.exe", artifactKind: "exe", mirrors: [] }
    }))),
    { ok: true, task }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ["download:enqueue", {
    productId: "safe-product",
    artifact: { url: "https://official.example/download.exe", fileName: "download.exe", artifactKind: "exe", mirrors: [] }
  }]);
});

test("managed download status preserves a durable failed task through main and preload", async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-status-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(userData, "managed-download-tasks.json"),
    JSON.stringify({ "claude-desktop": failedTask() })
  );
  const { handlers } = loadMainIpcHandlers(userData);
  const { bridge } = preloadHarness((channel, input) =>
    handlers.get(channel)(null, JSON.parse(JSON.stringify(input)))
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.getManagedDownloadTaskStatus({
      productId: "claude-desktop"
    }))),
    {
      ok: true,
      task: {
        taskId: "attempt-failed-status",
        productId: "claude-desktop",
        profileId: "desktop.claude",
        phase: "failed",
        progress: {
          receivedBytes: 128,
          totalBytes: 1024,
          bytesPerSecond: 0,
          percent: 13
        },
        errorCode: "DOWNLOAD_INCOMPLETE",
        presentation: {
          state: "failed",
          canCancel: true,
          canRetry: true
        }
      }
    }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.getManagedDownloadTaskStatus({
      productId: "missing-product"
    }))),
    { ok: false, errorCode: "DOWNLOAD_QUEUE_REJECTED" }
  );
});

test("a completed reviewed environment package deletes through preload and main", async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-environment-package-delete-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const {
    getEnvironmentManagedDownloadPlan
  } = require("../shared/environment-download.cjs");
  const productId = "environment:python312";
  const plan = getEnvironmentManagedDownloadPlan(productId);
  const filePath = path.join(userData, plan.fileName);
  const contents = Buffer.from("owned-python-installer");
  fs.writeFileSync(filePath, contents);
  fs.writeFileSync(
    path.join(userData, "download-records.json"),
    JSON.stringify({
      [productId]: {
        productId,
        url: plan.url,
        filePath,
        downloadRoot: userData,
        sha256: crypto.createHash("sha256").update(contents).digest("hex"),
        fileSize: contents.length
      }
    })
  );
  const { handlers } = loadMainIpcHandlers(userData, null, [], {
    confirmationResponse: 1,
    execFile: validEnvironmentSignatureExecFile()
  });
  const { bridge, calls } = preloadHarness((channel, input) =>
    handlers.get(channel)(null, JSON.parse(JSON.stringify(input)))
  );

  const status = JSON.parse(JSON.stringify(await bridge.getManagedDownloadTaskStatus({
    productId
  })));
  assert.equal(status.ok, true);
  assert.equal(status.task.phase, "downloaded");
  assert.equal(status.task.presentation.state, "completed");
  const task = JSON.parse(JSON.stringify(await bridge.getDownloadTask(productId)));
  assert.equal(task.phase, "completed");
  assert.equal(task.filePath, filePath);
  assert.equal(
    JSON.parse(JSON.stringify(await bridge.getDownloadRecord(productId))).filePath,
    filePath
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.deleteDownloadedPackage(productId))),
    { ok: true, filePath }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), [
    "download:delete-package",
    productId
  ]);
  assert.equal(fs.existsSync(filePath), false);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(userData, "download-records.json"), "utf8")),
    {}
  );
  const unownedPath = path.join(userData, "manual-package.exe");
  fs.writeFileSync(unownedPath, "manual");
  assert.equal(
    (await handlers.get("download:delete-package")(null, "environment:unreviewed")).ok,
    false
  );
  assert.equal(fs.existsSync(unownedPath), true);
});

test("completed package deletion requires the current fixed desktop task and receipt to match", async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-fixed-package-delete-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const productId = "wondershare-filmora";
  const independentProductId = "wondershare-edrawmax";
  const plan = fixedDesktopPlan(productId);
  const independentPlan = fixedDesktopPlan(independentProductId);
  const filePath = path.join(userData, plan.fileName);
  const independentPath = path.join(userData, independentPlan.fileName);
  const contents = Buffer.from("owned-filmora-installer");
  const independentContents = Buffer.from("owned-edrawmax-installer");
  const sha256 = crypto.createHash("sha256").update(contents).digest("hex");
  const independentSha256 = crypto
    .createHash("sha256")
    .update(independentContents)
    .digest("hex");
  fs.writeFileSync(filePath, contents);
  fs.writeFileSync(independentPath, independentContents);
  fs.writeFileSync(
    path.join(userData, "download-records.json"),
    JSON.stringify({
      [productId]: {
        productId,
        url: plan.url,
        fileName: plan.fileName,
        artifactKind: "exe",
        filePath,
        downloadRoot: userData,
        sha256,
        fileSize: contents.length
      },
      [independentProductId]: {
        productId: independentProductId,
        url: independentPlan.url,
        fileName: independentPlan.fileName,
        artifactKind: "exe",
        filePath: independentPath,
        downloadRoot: userData,
        sha256: independentSha256,
        fileSize: independentContents.length
      }
    })
  );
  fs.writeFileSync(
    path.join(userData, "managed-download-tasks.json"),
    JSON.stringify({
      [productId]: completedTask(
        productId,
        path.join(userData, "different-owned-package.exe"),
        "f".repeat(64),
        contents.length
      ),
      [independentProductId]: completedTask(
        independentProductId,
        independentPath,
        independentSha256,
        independentContents.length
      )
    })
  );
  const { handlers } = loadMainIpcHandlers(userData, null, [], {
    confirmationResponse: 1
  });
  const { bridge } = preloadHarness((channel, input) =>
    handlers.get(channel)(null, JSON.parse(JSON.stringify(input)))
  );

  assert.equal((await bridge.deleteDownloadedPackage(productId)).ok, false);
  assert.equal(fs.existsSync(filePath), true);
  assert.equal(fs.existsSync(independentPath), true);
  const remaining = JSON.parse(
    fs.readFileSync(path.join(userData, "download-records.json"), "utf8")
  );
  assert.equal(remaining[productId].sha256, sha256);
  assert.equal(remaining[independentProductId].sha256, independentSha256);
});

test("fixed desktop deletion removes only the exact completed package", async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-exact-package-delete-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const productId = "wondershare-filmora";
  const independentProductId = "wondershare-edrawmax";
  const partialProductId = "wondershare-edrawmind";
  const plan = fixedDesktopPlan(productId);
  const independentPlan = fixedDesktopPlan(independentProductId);
  const partialPlan = fixedDesktopPlan(partialProductId);
  const filePath = path.join(userData, plan.fileName);
  const independentPath = path.join(userData, independentPlan.fileName);
  const partialPath = path.join(userData, `${partialPlan.fileName}.part`);
  const contents = Buffer.from("owned-filmora-installer");
  const independentContents = Buffer.from("owned-edrawmax-installer");
  const sha256 = crypto.createHash("sha256").update(contents).digest("hex");
  const independentSha256 = crypto
    .createHash("sha256")
    .update(independentContents)
    .digest("hex");
  fs.writeFileSync(filePath, contents);
  fs.writeFileSync(independentPath, independentContents);
  fs.writeFileSync(partialPath, "partial");
  const records = {
    [productId]: {
      productId,
      url: plan.url,
      fileName: plan.fileName,
      artifactKind: "exe",
      filePath,
      downloadRoot: userData,
      sha256,
      fileSize: contents.length
    },
    [independentProductId]: {
      productId: independentProductId,
      url: independentPlan.url,
      fileName: independentPlan.fileName,
      artifactKind: "exe",
      filePath: independentPath,
      downloadRoot: userData,
      sha256: independentSha256,
      fileSize: independentContents.length
    }
  };
  fs.writeFileSync(
    path.join(userData, "download-records.json"),
    JSON.stringify(records)
  );
  fs.writeFileSync(
    path.join(userData, "managed-download-tasks.json"),
    JSON.stringify({
      [productId]: completedTask(productId, filePath, sha256, contents.length),
      [independentProductId]: completedTask(
        independentProductId,
        independentPath,
        independentSha256,
        independentContents.length
      )
    })
  );
  fs.writeFileSync(
    path.join(userData, "partial-download-records.json"),
    JSON.stringify({
      [partialProductId]: {
        productId: partialProductId,
        url: partialPlan.url,
        partialPath,
        downloadRoot: userData,
        receivedBytes: 7,
        totalBytes: 100
      }
    })
  );
  const { handlers } = loadMainIpcHandlers(userData, null, [], {
    confirmationResponse: 1
  });
  const { bridge } = preloadHarness((channel, input) =>
    handlers.get(channel)(null, JSON.parse(JSON.stringify(input)))
  );

  assert.equal((await bridge.deleteDownloadedPackage("missing-product")).ok, false);
  assert.equal((await bridge.deleteDownloadedPackage(partialProductId)).ok, false);
  assert.equal(fs.existsSync(partialPath), true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.deleteDownloadedPackage(productId))),
    { ok: true, filePath }
  );
  assert.equal(fs.existsSync(filePath), false);
  assert.equal(fs.existsSync(independentPath), true);
  assert.equal(fs.existsSync(partialPath), true);
  const remaining = JSON.parse(
    fs.readFileSync(path.join(userData, "download-records.json"), "utf8")
  );
  assert.equal(Object.hasOwn(remaining, productId), false);
  assert.equal(remaining[independentProductId].sha256, independentSha256);
});

test("a queued fixed desktop task remains status-addressable before partial evidence exists", async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-fixed-queued-status-"));
  const { handlers, main } = loadMainIpcHandlers(userData);
  t.after(() => {
    main.getManagedDownloadQueue().dispose();
    fs.rmSync(userData, { recursive: true, force: true });
  });
  for (const productId of [
    "wondershare-edrawmax",
    "wondershare-edrawmind",
    "wondershare-pdfelement"
  ]) {
    assert.equal(main.startManagedDownload(productId, fixedDesktopPlan(productId)).ok, true);
  }
  const started = main.startManagedDownload(
    "wondershare-filmora",
    fixedDesktopPlan("wondershare-filmora")
  );
  assert.equal(started.ok, true);
  assert.equal(started.task.phase, "queued");
  assert.equal(fs.existsSync(path.join(userData, "partial-download-records.json")), true);
  const partials = JSON.parse(fs.readFileSync(path.join(userData, "partial-download-records.json"), "utf8"));
  assert.equal(Object.hasOwn(partials, "wondershare-filmora"), false);

  const list = handlers.get("download:list")(null);
  const listed = list.find((task) => task.productId === "wondershare-filmora");
  assert.equal(listed.phase, "queued");
  const { bridge } = preloadHarness((channel, input) =>
    handlers.get(channel)(null, JSON.parse(JSON.stringify(input)))
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.getManagedDownloadTaskStatus({
      productId: "wondershare-filmora"
    }))),
    {
      ok: true,
      task: {
        taskId: listed.taskId,
        productId: "wondershare-filmora",
        profileId: "desktop-download-only.wondershare-filmora",
        phase: "queued",
        progress: { receivedBytes: 0, totalBytes: 0, bytesPerSecond: 0, percent: null },
        presentation: { state: "active", canCancel: true, canRetry: false }
      }
    }
  );

  const independentBefore = main.getManagedDownloadQueue().list()
    .filter((task) => task.id !== "wondershare-filmora")
    .map((task) => ({ id: task.id, phase: task.phase }));
  assert.equal(independentBefore.length, 3);
  assert.ok(independentBefore.every((task) => task.phase === "downloading"));
  const cancelled = main.getManagedDownloadQueue().cancel("wondershare-filmora");
  assert.equal(cancelled.accepted, true);
  assert.equal(cancelled.task.phase, "cancelled");
  const independentAfter = main.getManagedDownloadQueue().list()
    .filter((task) => task.id !== "wondershare-filmora")
    .map((task) => ({ id: task.id, phase: task.phase }));
  assert.deepEqual(independentAfter, independentBefore);

});

test("three approved main downloads share one session setup without failing siblings", async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-shared-session-"));
  const networkSession = destructiveStalledSession();
  const { handlers, main } = loadMainIpcHandlers(userData, networkSession);
  t.after(async () => {
    main.getManagedDownloadQueue().dispose();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (main.getManagedDownloadQueue().list().every((task) =>
        !["queued", "downloading"].includes(task.phase)
      )) break;
      await new Promise((resolve) => setImmediate(resolve));
    }
    fs.rmSync(userData, { recursive: true, force: true });
  });
  const productIds = [
    "wondershare-edrawmax",
    "wondershare-edrawmind",
    "wondershare-pdfelement"
  ];
  for (const productId of productIds) {
    assert.equal(
      main.startManagedDownload(productId, fixedDesktopPlan(productId)).ok,
      true
    );
  }
  for (let attempt = 0; attempt < 100 && networkSession.fetchCount < 3; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  assert.equal(networkSession.fetchCount, 3);
  assert.equal(
    main.getManagedDownloadQueue().list().filter((task) => task.phase === "downloading").length,
    3
  );
  const tasks = handlers.get("download:list")(null)
    .filter((task) => productIds.includes(task.productId));
  assert.deepEqual(tasks.map((task) => task.productId).sort(), [...productIds].sort());
  assert.deepEqual(tasks.map((task) => task.phase), ["queued", "queued", "queued"]);
  assert.equal(tasks.some((task) => task.errorCode), false);
});

test("status does not revive a fixed terminal task without scheduler or approved artifact evidence", async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-fixed-stale-status-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(userData, "managed-download-tasks.json"),
    JSON.stringify({ "wondershare-filmora": failedTask("wondershare-filmora") })
  );
  const { handlers } = loadMainIpcHandlers(userData);
  const { bridge } = preloadHarness((channel, input) =>
    handlers.get(channel)(null, JSON.parse(JSON.stringify(input)))
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.getManagedDownloadTaskStatus({
      productId: "wondershare-filmora"
    }))),
    { ok: false, errorCode: "DOWNLOAD_QUEUE_REJECTED" }
  );
});

test("a fixed completed artifact still reconciles through its approved receipt evidence", async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-fixed-completed-status-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const plan = fixedDesktopPlan("wondershare-filmora");
  const filePath = path.join(userData, plan.fileName);
  fs.writeFileSync(filePath, "x");
  fs.writeFileSync(
    path.join(userData, "download-records.json"),
    JSON.stringify({
      "wondershare-filmora": {
        productId: "wondershare-filmora",
        url: plan.url,
        fileName: plan.fileName,
        artifactKind: "exe",
        filePath,
        downloadRoot: userData,
        sha256: "a".repeat(64),
        fileSize: 1
      }
    })
  );
  const { handlers } = loadMainIpcHandlers(userData);
  const { bridge } = preloadHarness((channel, input) =>
    handlers.get(channel)(null, JSON.parse(JSON.stringify(input)))
  );
  const status = JSON.parse(JSON.stringify(await bridge.getManagedDownloadTaskStatus({
    productId: "wondershare-filmora"
  })));
  assert.equal(status.ok, true, JSON.stringify(status));
  assert.equal(status.task.phase, "downloaded");
  assert.equal(status.task.presentation.canCancel, false);
  assert.equal(status.task.presentation.canRetry, false);
});

test("an active signed-catalog task keeps its existing status recovery path", async (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-signed-active-status-"));
  const { handlers, main } = loadMainIpcHandlers(userData);
  t.after(() => {
    main.getManagedDownloadQueue().dispose();
    fs.rmSync(userData, { recursive: true, force: true });
  });
  const started = main.startManagedDownload("tana-outliner", signedDesktopPlan("tana-outliner"));
  assert.equal(started.ok, true);
  const { bridge } = preloadHarness((channel, input) =>
    handlers.get(channel)(null, JSON.parse(JSON.stringify(input)))
  );
  const status = JSON.parse(JSON.stringify(await bridge.getManagedDownloadTaskStatus({
    productId: "tana-outliner"
  })));
  assert.equal(status.ok, true);
  assert.equal(status.task.taskId, started.task.attemptId);
  assert.equal(status.task.phase, "queued");
});

test("managed download cancellation sends only an exact confirmed attempt envelope", async () => {
  const { bridge, calls } = preloadHarness({ ok: true });
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.cancelManagedDownload({
      productId: "safe-product",
      taskId: "attempt-1",
      confirmed: true
    }))),
    { ok: true }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ["download:cancel", {
    productId: "safe-product",
    taskId: "attempt-1",
    confirmed: true
  }]);

  const before = calls.length;
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.cancelManagedDownload({
      productId: "safe-product",
      taskId: "attempt-1",
      confirmed: true,
      text: "cancel"
    }))),
    { ok: false, errorCode: "INPUT_INVALID" }
  );
  assert.equal(calls.length, before);
});

test("legacy managed download cancellation uses the same confirmed attempt envelope", async () => {
  const { bridge, calls } = preloadHarness({ ok: true });
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.cancelDownload({
      productId: "legacy-product",
      taskId: "legacy-attempt-4",
      confirmed: true
    }))),
    { ok: true }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ["download:discard", {
    productId: "legacy-product",
    taskId: "legacy-attempt-4",
    confirmed: true
  }]);
});

test("main keeps queue IPC bound to a fixed authorization path", () => {
  const main = fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8");
  assert.match(main, /createManagedDownloadQueue\(/);
  assert.match(main, /concurrency:\s*MANAGED_DOWNLOAD_CONCURRENCY/);
  assert.match(main, /ipcMain\.handle\("download:enqueue"/);
  assert.match(main, /startManagedDownloadFromRequest\(request\.productId, request\.artifact\)/);
  assert.doesNotMatch(main, /download:enqueue[\s\S]{0,1200}ipcMain\.handle\("download:enqueue"/);
});
