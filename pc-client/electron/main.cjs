const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  Notification,
  safeStorage,
  session,
  shell,
  Tray
} = require("electron");
const { execFile, spawn } = require("node:child_process");
const crypto = require("node:crypto");
const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { promisify } = require("node:util");
const {
  isAllowedUrl
} = require("../shared/catalog.cjs");
const {
  verifyCatalogRelease,
  verifyCatalogReleaseCache
} = require("../shared/catalog-release.cjs");
const {
  clientIdToDeviceId,
  readOrCreateClientId
} = require("../shared/client-identity.cjs");
const {
  cliInstallPlans
} = require("../shared/install-registry.cjs");
const {
  getManagedDownload: getStaticManagedDownload,
  isAllowedManagedDownloadUrl
} = require("../shared/managed-downloads.cjs");
const {
  applyDownloadTaskEvent,
  restoreDownloadTask
} = require("../shared/download-task.cjs");
const {
  planManagedDownloadTaskRecovery
} = require("../shared/download-task-recovery.cjs");
const {
  assertDownloadCanFinalize,
  classifyPartialForStart,
  isCurrentDownloadAttempt,
  isReusablePartialEvidence,
  parsePlainObjectJson,
  raiseDownloadIntent,
  removeRecordMetadata,
  selectCleanupFailurePartial
} = require("../shared/managed-download-reliability.cjs");
const {
  launchProcessWithGrace
} = require("../shared/installer-launch.cjs");
const {
  createDesktopOperationController
} = require("../shared/desktop-operation.cjs");
const {
  createEnvironmentOperationController
} = require("../shared/environment-operation.cjs");
const {
  createResumeHeaders,
  resolveResumeResponse
} = require("../shared/download-resume.cjs");
const { assessDownloadSpace } = require("../shared/download-space.cjs");
const {
  verifyAndEvaluateUpdateRelease
} = require("../shared/update-release.cjs");
const {
  planUpdateInstallerDownload,
  verifyUpdateInstallerDownload
} = require("../shared/update-installer.cjs");
const {
  readReleaseChannel
} = require("../shared/release-channel.cjs");
const {
  readResponseTextWithLimit
} = require("../shared/limited-response.cjs");
const {
  resolveReleaseResponseUrl
} = require("../shared/release-response.cjs");
const {
  environmentIdFromManagedDownload,
  getEnvironmentDownloadPlan,
  getEnvironmentManagedDownloadPlan,
  selectReachableSource
} = require("../shared/environment-download.cjs");
const {
  resolveEnvironmentEvidence,
  resolveEnvironmentOperationStatus,
  resolveRegisteredEnvironmentExecutable,
  resolveTrustedEnvironmentExecutableProbe
} = require("../shared/environment-detection.cjs");
const { trustedLocalProxy } = require("../shared/local-proxy.cjs");
const {
  findTrustedProductExecutable,
  findTrustedUninstallRecord,
  pathIsInside,
  registryInstallLocation
} = require("../shared/windows-uninstall.cjs");
const {
  createAppxUninstallAction,
  trustedAppxPackage
} = require("../shared/windows-appx.cjs");
const {
  computeNpmTreeSha256,
  createManagedCliInstallAction,
  createManagedCliPostInstallAction,
  createManagedCliReceipt,
  createManagedCliUninstallAction,
  inspectManagedCli
} = require("../shared/managed-cli.cjs");
const {
  normalizeCliTrayTask,
  normalizeCliTaskNotification,
  rememberNotificationKey
} = require("../shared/task-notification.cjs");
const {
  shouldHideWindowOnClose,
  shouldKeepAppAlive
} = require("../shared/tray-lifecycle.cjs");
const {
  createIdentityClient
} = require("./identity-client.cjs");
const {
  readLocalReleaseTrust,
  shouldTrustLocalReleaseCertificate
} = require("../shared/local-release-trust.cjs");

const LOCAL_RELEASE_ACCEPTANCE =
  require("../package.json").localReleaseAcceptance === true;

const execFileAsync = promisify(execFile);
const activeCliProducts = new Set();
const activeCliPrefixes = new Set();
const activeDownloads = new Map();
const activeDesktopOperationEntries = new Set();
let desktopOperationController = null;
let environmentOperationController = null;
const managedDownloadTasks = new Map();
const downloadTaskLastPersistedAt = new Map();
const downloadTaskLastEmittedAt = new Map();
let managedDownloadTasksLoaded = false;
const activeEnvironmentDownloads = new Set();
const trustedSignatureCache = new Map();
const shownTaskNotifications = new Map();
const activeTaskNotifications = new Set();
const trayTaskStates = new Map();
let tray = null;
let isQuitting = false;
let lastVerifiedUpdateOffer = null;
let identityClientInstance = null;
let updateCheckGeneration = 0;
let activeEnvironmentSourcePreferences;
const DOWNLOAD_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-Hub/0.1";
const ENVIRONMENT_PLANS = Object.freeze({
  node: {
    name: "Node.js",
    command: "node.exe",
    officialUrl: "https://nodejs.org/en/download",
    displayName: /^Node\.js$/i,
    registryPublisher: /^(?:OpenJS Foundation|Node\.js Foundation)$/i,
    installedSigner:
      /^CN=(?:OpenJS Foundation|Node\.js Foundation)(?:,|$)/i
  },
  git: {
    name: "Git",
    command: "git.exe",
    officialUrl: "https://git-scm.com/download/win",
    displayName: /^Git(?: version .+)?$/i,
    registryPublisher: /^The Git Development Community$/i,
    installedSigner: /^CN=Johannes Schindelin(?:,|$)/i
  },
  python: {
    name: "Python",
    command: "python.exe",
    officialUrl: "https://www.python.org/downloads/windows/",
    displayName: /^Python 3\.\d+(?:\.\d+)? \((?:32|64)-bit\)$/i,
    registryPublisher: /^Python Software Foundation$/i,
    installedSigner: /^CN=Python Software Foundation(?:,|$)/i
  },
  docker: {
    name: "Docker",
    command: "docker.exe",
    officialUrl: "https://www.docker.com/products/docker-desktop/",
    displayName: /^Docker Desktop$/i,
    registryPublisher: /^Docker Inc\.?$/i,
    installedSigner: /^CN=Docker Inc(?:,|$)/i
  }
});
const ENVIRONMENT_UNINSTALL_POLICIES = Object.freeze({
  node: {
    displayName: ENVIRONMENT_PLANS.node.displayName,
    publisher: ENVIRONMENT_PLANS.node.registryPublisher,
    allowMsi: true,
    machineMsiOnly: true
  },
  git: {
    displayName: ENVIRONMENT_PLANS.git.displayName,
    publisher: ENVIRONMENT_PLANS.git.registryPublisher,
    executableName: /^unins\d+\.exe$/i,
    allowedArguments: [[]],
    launchWithoutArguments: true,
    allowMsi: false,
    signer: ENVIRONMENT_PLANS.git.installedSigner
  },
  python: {
    displayName: ENVIRONMENT_PLANS.python.displayName,
    publisher: ENVIRONMENT_PLANS.python.registryPublisher,
    executableName:
      /^python-\d+(?:\.\d+){1,2}-(?:amd64|arm64|win32)\.exe$/i,
    allowedArguments: [["/uninstall"]],
    allowMsi: false,
    signer: ENVIRONMENT_PLANS.python.installedSigner
  },
  docker: {
    displayName: ENVIRONMENT_PLANS.docker.displayName,
    publisher: ENVIRONMENT_PLANS.docker.registryPublisher,
    executableName: /^Docker Desktop Installer\.exe$/i,
    allowedArguments: [["uninstall"]],
    allowMsi: false,
    signer: ENVIRONMENT_PLANS.docker.installedSigner
  }
});

function getEnvironmentPlan(environmentId) {
  return typeof environmentId === "string" &&
    environmentId.length > 0 &&
    environmentId.length <= 32 &&
    Object.hasOwn(ENVIRONMENT_PLANS, environmentId)
    ? ENVIRONMENT_PLANS[environmentId]
    : null;
}

function resolveManagedDownloadPlan(productId, preferredSourceUrl = "") {
  const staticPlan = getStaticManagedDownload(productId);
  if (staticPlan) {
    return {
      ...staticPlan,
      productId,
      environmentId: "",
      sourceLabel: "",
      managedProductId: productId
    };
  }
  if (!environmentIdFromManagedDownload(productId)) return null;
  const partialRecord = readPartialDownloadRecords()[productId];
  const completedRecord = readDownloadRecords()[productId];
  const persistedSourceUrl =
    typeof partialRecord?.url === "string" && partialRecord.url
      ? partialRecord.url
      : typeof completedRecord?.url === "string"
        ? completedRecord.url
        : "";
  return getEnvironmentManagedDownloadPlan(productId, {
    preferredSourceUrl,
    persistedSourceUrl,
    sourcePreferences: activeEnvironmentSourcePreferences
  });
}

function nextEnvironmentDownloadPlan(plan) {
  if (!plan?.environmentId) return null;
  const downloadPlan = getEnvironmentDownloadPlan(
    plan.environmentId,
    activeEnvironmentSourcePreferences
  );
  const currentIndex = downloadPlan.sources.findIndex(
    (source) => source.url === plan.url
  );
  const nextSource = downloadPlan.sources[currentIndex + 1];
  return nextSource
    ? getEnvironmentManagedDownloadPlan(plan.productId, {
        preferredSourceUrl: nextSource.url,
        sourcePreferences: activeEnvironmentSourcePreferences
      })
    : null;
}

const CLI_INSTALL_PLANS = cliInstallPlans();
const DESKTOP_PROBES = Object.freeze({
  "chatgpt-desktop": {
    names: ["ChatGPT", "OpenAI ChatGPT", "OpenAI.Codex"],
    signer: /^CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B$/i,
    appx: {
      identityName: "OpenAI.Codex",
      publisher: /^CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B$/i
    }
  },
  "claude-desktop": {
    names: ["Claude", "Claude Desktop"],
    signer: /^CN="?Anthropic, PBC"?(?:,|$)/i,
    appx: {
      identityName: "Claude",
      publisher: /^CN="?Anthropic, PBC"?(?:,|$)/i
    }
  },
  jianying: {
    names: ["剪映专业版", "CapCut"]
  },
  "comfy-desktop": {
    names: ["Comfy Desktop", "ComfyUI Desktop"],
    signer: /^CN=Drip Artificial Inc(?:,|$)/i,
    executableNames: ["ComfyUI.exe", "ComfyUI Desktop.exe", "Comfy Desktop.exe"],
    uninstall: {
      displayName:
        /^(?:ComfyUI|ComfyUI Desktop|Comfy Desktop)(?:\s+\d+(?:\.\d+){1,3}(?:[-+][0-9a-z.-]+)?)?$/i,
      publisher: /^(?:Comfy Org|Drip Artificial(?: Intelligence, Inc\.)?)$/i,
      executableName:
        /^Uninstall (?:ComfyUI|ComfyUI Desktop|Comfy Desktop)\.exe$/i,
      allowedArguments: [[], ["/currentuser"], ["/allusers"]],
      allowMsi: false
    }
  },
  "ollama-cli": {
    names: ["Ollama"],
    signer: /^CN=Ollama Inc\.(?:,|$)/i,
    executableNames: ["ollama app.exe"],
    uninstall: {
      displayName:
        /^Ollama(?:\s+(?:version\s+)?\d+(?:\.\d+){1,3}(?:[-+][0-9a-z.-]+)?)?$/i,
      publisher: /^Ollama(?:,? Inc\.?)?$/i,
      executableName: /^unins\d{3}\.exe$/i,
      allowedArguments: [[], ["/SILENT"]],
      launchWithoutArguments: true,
      allowMsi: false
    }
  }
});

function configPath() {
  return path.join(app.getPath("userData"), "pc-settings.json");
}

function downloadRecordsPath() {
  return path.join(app.getPath("userData"), "download-records.json");
}

function partialDownloadRecordsPath() {
  return path.join(app.getPath("userData"), "partial-download-records.json");
}

function managedDownloadTasksPath() {
  return path.join(app.getPath("userData"), "managed-download-tasks.json");
}

function desktopOperationRecordsPath() {
  return path.join(
    app.getPath("userData"),
    "desktop-operations.json"
  );
}

function legacyInstallVerificationRecordsPath() {
  return path.join(
    app.getPath("userData"),
    "desktop-install-verifications.json"
  );
}

function environmentDownloadRecordsPath() {
  return path.join(
    app.getPath("userData"),
    "environment-download-records.json"
  );
}

function environmentOperationRecordsPath() {
  return path.join(
    app.getPath("userData"),
    "environment-operations.json"
  );
}

function managedCliRecordsPath() {
  return path.join(app.getPath("userData"), "cli-install-records.json");
}

function readManagedCliRecords() {
  try {
    const records = JSON.parse(fs.readFileSync(managedCliRecordsPath(), "utf8"));
    return records && typeof records === "object" && !Array.isArray(records)
      ? records
      : {};
  } catch {
    return {};
  }
}

function writeManagedCliRecords(records) {
  const recordPath = managedCliRecordsPath();
  const temporaryPath = `${recordPath}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(records, null, 2),
    { encoding: "utf8", flag: "w" }
  );
  fs.renameSync(temporaryPath, recordPath);
}

function setManagedCliRecord(productId, receipt) {
  const records = readManagedCliRecords();
  records[productId] = receipt;
  writeManagedCliRecords(records);
}

function removeManagedCliRecord(productId) {
  const records = readManagedCliRecords();
  if (!records[productId]) return;
  delete records[productId];
  writeManagedCliRecords(records);
}

function readDownloadRecords() {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(downloadRecordsPath(), "utf8")
    );
  } catch {
    return {};
  }
}

function writeJsonAtomically(filePath, value) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto
    .randomBytes(6)
    .toString("hex")}`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), {
      encoding: "utf8",
      flag: "wx"
    });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Never broaden cleanup beyond the exact temporary file.
    }
  }
}

function migrateLegacyInstallVerificationRecords(records) {
  const products = {};
  for (const [productId, value] of Object.entries(records || {})) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      typeof value.verificationId !== "string" ||
      !value.verificationId.trim() ||
      !["monitoring", "timed-out"].includes(value.phase)
    ) {
      continue;
    }
    const attempts = Number.isSafeInteger(value.attempts)
      ? Math.max(0, Math.min(120, value.attempts))
      : 0;
    const revision = Number.isSafeInteger(value.revision)
      ? Math.max(1, value.revision)
      : 1;
    products[productId] = {
      generation: 1,
      operation: {
        schemaVersion: 1,
        productId,
        generation: 1,
        operationId: value.verificationId,
        operation: "install",
        phase: value.phase,
        launchState: "confirmed",
        revision,
        attempts,
        startedAt: value.startedAt,
        updatedAt: value.updatedAt,
        deadlineAt: value.deadlineAt,
        lastCheckedAt: value.lastCheckedAt ?? null,
        lastDetection: value.lastDetection ?? null,
        lastError: value.lastError ?? null,
        desktopStatus: value.desktopStatus ?? null
      }
    };
  }
  return { schemaVersion: 1, products };
}

function readDesktopOperationRecords() {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(desktopOperationRecordsPath(), "utf8")
    );
  } catch (error) {
    if (error?.code !== "ENOENT") {
      return { schemaVersion: 1, products: {} };
    }
  }
  try {
    const legacyRecords = parsePlainObjectJson(
      fs.readFileSync(legacyInstallVerificationRecordsPath(), "utf8")
    );
    const migrated = migrateLegacyInstallVerificationRecords(legacyRecords);
    writeDesktopOperationRecords(migrated);
    return migrated;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("Unable to migrate desktop operation records", error);
    }
    return { schemaVersion: 1, products: {} };
  }
}

function writeDesktopOperationRecords(records) {
  writeJsonAtomically(desktopOperationRecordsPath(), records);
}

function taskNotificationProductName(productId) {
  if (CLI_INSTALL_PLANS[productId]) {
    return CLI_INSTALL_PLANS[productId].name;
  }
  const environmentId = environmentIdFromManagedDownload(productId);
  if (environmentId && ENVIRONMENT_PLANS[environmentId]) {
    return ENVIRONMENT_PLANS[environmentId].name;
  }
  if (DESKTOP_PROBES[productId]?.names?.[0]) {
    return DESKTOP_PROBES[productId].names[0];
  }
  return "AI Hub 任务";
}

function taskNotificationTarget(productId) {
  return environmentIdFromManagedDownload(productId)
    ? { target: "task-center", productId }
    : { target: "product", productId };
}

function focusTaskNotificationTarget(target) {
  const window = showMainWindow();
  if (!window || window.webContents.isDestroyed()) return;
  const sendTarget = () => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send("task-notification:open", target);
    }
  };
  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once("did-finish-load", sendTarget);
  } else {
    sendTarget();
  }
}

function openTaskCenterFromTray() {
  focusTaskNotificationTarget({
    target: "task-center",
    productId: "tray"
  });
}

function updateTrayPresentation() {
  if (!tray || tray.isDestroyed()) return;
  const states = [...trayTaskStates.values()];
  const count = states.length;
  tray.setToolTip(
    count === 0
      ? "AI Hub · 后台运行"
      : count === 1
        ? `AI Hub · ${states[0]}`
        : `AI Hub · ${count} 个任务进行中`
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: count > 0 ? `${count} 个任务进行中` : "当前没有进行中的任务",
        enabled: count > 0,
        click: () => openTaskCenterFromTray()
      },
      {
        label: "打开任务中心",
        click: () => openTaskCenterFromTray()
      },
      {
        label: "打开 AI Hub",
        click: () => showMainWindow()
      },
      { type: "separator" },
      {
        label: "完全退出",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

function setTrayTaskState(key, label, active) {
  if (active) trayTaskStates.set(key, label);
  else trayTaskStates.delete(key);
  updateTrayPresentation();
}

function updateDownloadTrayTask(task) {
  const active = [
    "starting",
    "downloading",
    "pausing",
    "canceling"
  ].includes(task?.phase);
  const name = taskNotificationProductName(task?.productId);
  const action =
    task?.phase === "pausing"
      ? "正在暂停"
      : task?.phase === "canceling"
        ? "正在取消"
        : "正在下载";
  setTrayTaskState(
    `download:${task?.productId || ""}`,
    `${action} ${name}`,
    active
  );
}

function showTaskNotification({ key, productId, title, body }) {
  if (
    typeof key !== "string" ||
    !key ||
    typeof productId !== "string" ||
    !productId ||
    typeof title !== "string" ||
    !title ||
    typeof body !== "string" ||
    !body ||
    !app.isReady() ||
    !Notification.isSupported()
  ) {
    return false;
  }
  if (
    !rememberNotificationKey(
      shownTaskNotifications,
      key,
      Date.now(),
      500
    )
  ) {
    return false;
  }
  try {
    const notification = new Notification({
      title,
      body,
      silent: false,
      timeoutType: "default"
    });
    activeTaskNotifications.add(notification);
    notification.on("click", () =>
      focusTaskNotificationTarget(taskNotificationTarget(productId))
    );
    notification.on("close", () =>
      activeTaskNotifications.delete(notification)
    );
    notification.on("failed", (_event, message) => {
      activeTaskNotifications.delete(notification);
      console.error("Task notification failed", message);
    });
    notification.show();
    return true;
  } catch (error) {
    console.error("Unable to show task notification", error);
    return false;
  }
}

function notifyDesktopOperationTask(task) {
  if (!["installed", "uninstalled", "timed-out"].includes(task?.phase)) return;
  const name = taskNotificationProductName(task.productId);
  const title =
    task.phase === "installed"
      ? `${name} 安装完成`
      : task.phase === "uninstalled"
        ? `${name} 卸载完成`
        : `${name} 操作等待超时`;
  const body =
    task.phase === "timed-out"
      ? "点击返回产品页重新检测实际安装状态。"
      : "点击返回对应厂商产品页。";
  showTaskNotification({
    key: `desktop:${task.productId}:${task.generation}:${task.phase}`,
    productId: task.productId,
    title,
    body
  });
}

function emitDesktopOperationTask(task) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      try {
        window.webContents.send("desktop:operation", task);
      } catch (error) {
        console.error("Unable to emit desktop operation snapshot", error);
      }
    }
  }
  setTrayTaskState(
    `desktop:${task?.productId || ""}`,
    `${taskNotificationProductName(task?.productId)} ${
      task?.operation === "uninstall" ? "卸载检测中" : "安装检测中"
    }`,
    ["launching", "monitoring"].includes(task?.phase)
  );
  notifyDesktopOperationTask(task);
}

function getDesktopOperationController() {
  if (desktopOperationController) return desktopOperationController;
  desktopOperationController = createDesktopOperationController({
    loadRecords: readDesktopOperationRecords,
    saveRecords: writeDesktopOperationRecords,
    checkProduct: detectDesktopProduct,
    isSupported: (productId) =>
      Boolean(DESKTOP_PROBES[productId]) &&
      (Boolean(resolveManagedDownloadPlan(productId)) ||
        Boolean(DESKTOP_PROBES[productId]?.uninstall)),
    createId: () => crypto.randomUUID(),
    onChange: emitDesktopOperationTask,
    intervalMs: 5_000,
    timeoutMs: 10 * 60 * 1_000
  });
  return desktopOperationController;
}

function readEnvironmentOperationRecords() {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(environmentOperationRecordsPath(), "utf8")
    );
  } catch {
    return { schemaVersion: 1, environments: {} };
  }
}

function writeEnvironmentOperationRecords(records) {
  writeJsonAtomically(environmentOperationRecordsPath(), records);
}

function emitEnvironmentOperationTask(task) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      try {
        window.webContents.send("environment:operation", task);
      } catch (error) {
        console.error("Unable to emit environment operation snapshot", error);
      }
    }
  }
  setTrayTaskState(
    `environment:${task?.environmentId || ""}`,
    `${ENVIRONMENT_PLANS[task?.environmentId]?.name || "运行环境"} ${
      task?.operation === "uninstall" ? "卸载检测中" : "安装检测中"
    }`,
    ["launching", "monitoring"].includes(task?.phase)
  );
  if (["installed", "uninstalled", "timed-out"].includes(task?.phase)) {
    const productId = `environment:${task.environmentId}`;
    const name = ENVIRONMENT_PLANS[task.environmentId]?.name || "运行环境";
    showTaskNotification({
      key: `environment:${task.environmentId}:${task.generation}:${task.phase}`,
      productId,
      title:
        task.phase === "installed"
          ? `${name} 安装完成`
          : task.phase === "uninstalled"
            ? `${name} 卸载完成`
            : `${name} 操作等待超时`,
      body:
        task.phase === "timed-out"
          ? "点击打开任务中心重新检测实际状态。"
          : "点击打开任务中心查看结果。"
    });
  }
}

function getEnvironmentOperationController() {
  if (environmentOperationController) return environmentOperationController;
  environmentOperationController = createEnvironmentOperationController({
    loadRecords: readEnvironmentOperationRecords,
    saveRecords: writeEnvironmentOperationRecords,
    checkProduct: detectEnvironmentOperationStatus,
    isSupported: (environmentId) => Boolean(getEnvironmentPlan(environmentId)),
    createId: () => crypto.randomUUID(),
    onChange: emitEnvironmentOperationTask,
    intervalMs: 5_000,
    timeoutMs: 10 * 60 * 1_000
  });
  return environmentOperationController;
}

function writeDownloadRecords(records) {
  writeJsonAtomically(downloadRecordsPath(), records);
}

function readPartialDownloadRecords() {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(partialDownloadRecordsPath(), "utf8")
    );
  } catch {
    return {};
  }
}

function writePartialDownloadRecords(records) {
  writeJsonAtomically(partialDownloadRecordsPath(), records);
}

function removePartialDownloadRecord(productId) {
  const records = readPartialDownloadRecords();
  if (!records[productId]) return;
  delete records[productId];
  writePartialDownloadRecords(records);
}

function loadManagedDownloadTasks() {
  if (managedDownloadTasksLoaded) return;
  managedDownloadTasksLoaded = true;
  let records = {};
  let needsRewrite = false;
  try {
    const value = JSON.parse(
      fs.readFileSync(managedDownloadTasksPath(), "utf8")
    );
    if (value && typeof value === "object" && !Array.isArray(value)) {
      records = value;
    } else {
      needsRewrite = true;
    }
  } catch {
    records = {};
    needsRewrite = true;
  }
  const recovery = planManagedDownloadTaskRecovery({
    records,
    isSupported: (productId) => Boolean(resolveManagedDownloadPlan(productId)),
    inspectPartial: (productId) => {
      const partialRecords = readPartialDownloadRecords();
      if (!Object.prototype.hasOwnProperty.call(partialRecords, productId)) {
        return null;
      }
      const plan = resolveManagedDownloadPlan(productId);
      const partial = plan ? managedPartialDownload(productId, plan) : null;
      return partial
        ? {
            kind: "validated",
            productId,
            updatedAt: partial.updatedAt
          }
        : { kind: "unsafe" };
    },
    now: Date.now,
    staleAfterMs: 30 * 24 * 60 * 60 * 1000
  });
  for (const productId of recovery.discardPartialProductIds) {
    const plan = resolveManagedDownloadPlan(productId);
    const cleanup = plan
      ? discardManagedPartialDownload(productId, plan)
      : { ok: false };
    if (!cleanup.ok) {
      recovery.records[productId] = records[productId];
    }
  }
  for (const [productId, task] of Object.entries(recovery.records)) {
    managedDownloadTasks.set(productId, task);
  }
  if (needsRewrite || recovery.changed) {
    writeManagedDownloadTasks();
  }
}

function writeManagedDownloadTasks() {
  const records = Object.fromEntries(managedDownloadTasks.entries());
  writeJsonAtomically(managedDownloadTasksPath(), records);
}

function emitManagedDownloadTask(task) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send("download:task", task);
    }
  }
  updateDownloadTrayTask(task);
  if (task?.phase === "completed" || task?.phase === "failed") {
    const name = taskNotificationProductName(task.productId);
    showTaskNotification({
      key: `download:${task.productId}:${task.attemptId}:${task.phase}`,
      productId: task.productId,
      title:
        task.phase === "completed"
          ? `${name} 下载完成`
          : `${name} 下载失败`,
      body:
        task.phase === "completed"
          ? environmentIdFromManagedDownload(task.productId)
            ? "点击打开任务中心，继续安装环境。"
            : "点击返回产品页，打开已验证的安装包。"
          : "点击查看失败原因并重试。"
    });
  }
}

function advanceManagedDownloadTask(
  productId,
  event,
  { persist = true, broadcast = true } = {}
) {
  loadManagedDownloadTasks();
  const current = managedDownloadTasks.get(productId) || null;
  const result = applyDownloadTaskEvent(
    current,
    { ...event, productId },
    { now: () => new Date().toISOString() }
  );
  if (!result.accepted || !result.task) return result;
  managedDownloadTasks.set(productId, result.task);
  if (persist) {
    writeManagedDownloadTasks();
    downloadTaskLastPersistedAt.set(productId, Date.now());
  }
  if (broadcast) {
    emitManagedDownloadTask(result.task);
    downloadTaskLastEmittedAt.set(productId, Date.now());
  }
  return result;
}

function recordManagedDownloadProgress(productId, attemptId, progress) {
  const now = Date.now();
  const persist =
    now - (downloadTaskLastPersistedAt.get(productId) || 0) >= 1000;
  const broadcast =
    now - (downloadTaskLastEmittedAt.get(productId) || 0) >= 100;
  return advanceManagedDownloadTask(
    productId,
    { type: "progress", attemptId, progress, resumable: true },
    { persist, broadcast }
  );
}

function currentManagedDownloadTask(productId) {
  loadManagedDownloadTasks();
  return managedDownloadTasks.get(productId) || null;
}

function readEnvironmentDownloadRecords() {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(environmentDownloadRecordsPath(), "utf8")
    );
  } catch {
    return {};
  }
}

function writeEnvironmentDownloadRecords(records) {
  writeJsonAtomically(environmentDownloadRecordsPath(), records);
}

function fileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function updateHashFromFile(hash, filePath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
}

async function inspectSignature(filePath) {
  const script = [
    "$s=Get-AuthenticodeSignature -LiteralPath $env:AIHUB_SIGNATURE_PATH",
    "$v=[pscustomobject]@{Status=[string]$s.Status;Signer=if($s.SignerCertificate){$s.SignerCertificate.Subject}else{''}}",
    "$v|ConvertTo-Json -Compress"
  ].join(";");
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        timeout: 15000,
        env: {
          ...isolatedThirdPartyEnvironment(),
          AIHUB_SIGNATURE_PATH: filePath
        }
      }
    );
    const value = JSON.parse(stdout.trim());
    return {
      status: String(value.Status || "Unknown"),
      signer: String(value.Signer || "")
    };
  } catch {
    return {
      status: "Unknown",
      signer: "",
      error: "Windows 验签命令执行失败"
    };
  }
}

async function verifyExpectedSignature(filePath, expectedSigner, force = false) {
  if (!(expectedSigner instanceof RegExp)) {
    return { ok: false, status: "Unknown", signer: "" };
  }
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return { ok: false, status: "NotFound", signer: "" };
  }
  const cacheKey = path.resolve(filePath).toLowerCase();
  const cached = trustedSignatureCache.get(cacheKey);
  if (
    !force &&
    cached &&
    cached.size === stat.size &&
    cached.mtimeMs === stat.mtimeMs
  ) {
    return cached.result;
  }
  const signature = await inspectSignature(filePath);
  expectedSigner.lastIndex = 0;
  const result = {
    ok:
      signature.status === "Valid" &&
      expectedSigner.test(String(signature.signer || "")),
    status: signature.status,
    signer: signature.signer
  };
  trustedSignatureCache.set(cacheKey, {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    result
  });
  return result;
}

function parseRegistryOutput(raw) {
  const entries = [];
  let current = null;
  for (const line of raw.split(/\r?\n/)) {
    if (/^HKEY_/i.test(line.trim())) {
      if (current) entries.push(current);
      current = { key: line.trim() };
      continue;
    }
    if (!current) continue;
    const match = line.match(
      /^\s+(DisplayName|DisplayVersion|InstallLocation|DisplayIcon|Publisher|UninstallString|QuietUninstallString)\s+REG_\w+\s+(.*)$/i
    );
    if (match) current[match[1].toLowerCase()] = match[2].trim();
  }
  if (current) entries.push(current);
  return entries.filter((entry) => entry.displayname);
}

function isMissingRegistryQuery(error) {
  const message = `${error?.stdout || ""}\n${error?.stderr || ""}\n${error?.message || ""}`;
  return (
    Number(error?.code) === 1 &&
    !error?.killed &&
    /unable to find|cannot find|not found|找不到|不存在/i.test(message)
  );
}

async function scanRegistryAppsWithStatus() {
  const roots = [
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
  ];
  const results = await Promise.all(
    roots.map(async (root) => {
      try {
        const { stdout } = await execFileAsync("reg.exe", ["query", root, "/s"], {
          windowsHide: true,
          timeout: 15000,
          maxBuffer: 8 * 1024 * 1024
        });
        return { ok: true, entries: parseRegistryOutput(stdout) };
      } catch (error) {
        return isMissingRegistryQuery(error)
          ? { ok: true, entries: [] }
          : { ok: false, entries: [] };
      }
    })
  );
  return {
    ok: results.every((result) => result.ok),
    entries: results.flatMap((result) => result.entries)
  };
}

async function scanRegistryApps() {
  return (await scanRegistryAppsWithStatus()).entries;
}

async function locateRegisteredPythonWithStatus() {
  const roots = [
    "HKCU\\SOFTWARE\\Python\\PythonCore",
    "HKLM\\SOFTWARE\\Python\\PythonCore",
    "HKLM\\SOFTWARE\\WOW6432Node\\Python\\PythonCore"
  ];
  const results = await Promise.all(
    roots.map(async (root) => {
      try {
        const { stdout } = await execFileAsync(
          "reg.exe",
          ["query", root, "/s", "/v", "ExecutablePath"],
          {
            windowsHide: true,
            timeout: 5000,
            maxBuffer: 1024 * 1024
          }
        );
        return {
          ok: true,
          candidates: [
            ...stdout.matchAll(
              /^\s+ExecutablePath\s+REG_\w+\s+(.+)$/gim
            )
          ].map((match) => match[1].trim())
        };
      } catch (error) {
        return isMissingRegistryQuery(error)
          ? { ok: true, candidates: [] }
          : { ok: false, candidates: [] };
      }
    })
  );
  const location =
    results
      .flatMap((result) => result.candidates)
      .find(
        (candidate) =>
          path.isAbsolute(candidate) &&
          /^python\.exe$/i.test(path.basename(candidate)) &&
          fs.existsSync(candidate)
      ) || "";
  return {
    ok: results.every((result) => result.ok),
    location
  };
}

function fixedEnvironmentExecutableCandidates(environmentId) {
  const programRoots = [
    process.env.ProgramW6432,
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"]
  ].filter(Boolean);
  const localPrograms = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Programs")
    : "";
  const candidates = [];
  for (const root of programRoots) {
    if (environmentId === "node") {
      candidates.push(path.join(root, "nodejs", "node.exe"));
    } else if (environmentId === "git") {
      candidates.push(path.join(root, "Git", "cmd", "git.exe"));
    } else if (environmentId === "docker") {
      candidates.push(
        path.join(root, "Docker", "Docker", "resources", "bin", "docker.exe")
      );
    }
  }
  if (localPrograms && environmentId === "git") {
    candidates.push(path.join(localPrograms, "Git", "cmd", "git.exe"));
  }
  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
}

async function trustedFixedEnvironmentExecutable(environmentId, plan) {
  let foundUntrustedCandidate = false;
  for (const candidate of fixedEnvironmentExecutableCandidates(environmentId)) {
    if (!fs.existsSync(candidate)) continue;
    foundUntrustedCandidate = true;
    let canonical = "";
    try {
      canonical = fs.realpathSync.native(candidate);
    } catch {
      continue;
    }
    const signature = await verifyExpectedSignature(
      canonical,
      plan.installedSigner,
      true
    );
    if (signature.ok) {
      return { ok: true, location: canonical };
    }
  }
  return { ok: !foundUntrustedCandidate, location: "" };
}

async function locateEnvironment(environmentId, plan) {
  const [rawPathProbe, rawRegisteredProbe, fixedProbe] = await Promise.all([
    locateWithStatus(plan.command),
    environmentId === "python"
      ? locateRegisteredPythonWithStatus()
      : Promise.resolve({ ok: true, location: "" }),
    trustedFixedEnvironmentExecutable(environmentId, plan)
  ]);
  let registeredProbe = rawRegisteredProbe;
  if (rawRegisteredProbe.location) {
    const canonical = canonicalExistingPath(rawRegisteredProbe.location);
    const signature = canonical
      ? await verifyExpectedSignature(canonical, plan.installedSigner, true)
      : { ok: false };
    registeredProbe = signature.ok
      ? { ok: rawRegisteredProbe.ok, location: canonical }
      : { ok: false, location: "" };
  }
  const pathProbe = await resolveTrustedEnvironmentExecutableProbe({
    probe: rawPathProbe,
    canonicalize: canonicalExistingPath,
    verify: async (candidate) =>
      (
        await verifyExpectedSignature(
          candidate,
          plan.installedSigner,
          true
        )
      ).ok
  });
  const resolved = resolveEnvironmentEvidence({
    pathLocation: pathProbe.location,
    registeredLocation: registeredProbe.location || fixedProbe.location,
    exists: fs.existsSync
  });
  return {
    ...resolved,
    probeOk: pathProbe.ok && registeredProbe.ok && fixedProbe.ok
  };
}

function environmentRegistryMatches(entry, plan) {
  plan.displayName.lastIndex = 0;
  plan.registryPublisher.lastIndex = 0;
  return (
    plan.displayName.test(String(entry.displayname || "")) &&
    plan.registryPublisher.test(String(entry.publisher || ""))
  );
}

function environmentRegistryCandidates(environmentId, registry) {
  const plan = getEnvironmentPlan(environmentId);
  if (!plan || !Array.isArray(registry)) return [];
  return registry.filter((entry) => environmentRegistryMatches(entry, plan));
}

function canonicalExistingPath(candidate) {
  if (
    typeof candidate !== "string" ||
    !path.isAbsolute(candidate) ||
    !fs.existsSync(candidate)
  ) {
    return "";
  }
  try {
    return fs.realpathSync.native(candidate);
  } catch {
    return "";
  }
}

function chooseEnvironmentRegistryEntry(environmentId, location, registry) {
  const candidates = environmentRegistryCandidates(environmentId, registry);
  if (!candidates.length) return null;
  const canonicalLocation = canonicalExistingPath(location);
  if (canonicalLocation) {
    const associated = candidates.filter((entry) => {
      const registeredRoot = canonicalExistingPath(
        registryInstallLocation(entry)
      );
      return registeredRoot && pathIsInside(canonicalLocation, registeredRoot);
    });
    if (associated.length === 1) return associated[0];
    if (associated.length > 1) return null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

async function trustedRegisteredEnvironmentExecutable(
  environmentId,
  plan,
  registryEntries
) {
  let foundUntrustedCandidate = false;
  for (const entry of registryEntries) {
    const candidate = resolveRegisteredEnvironmentExecutable({
      environmentId,
      installLocation: String(entry.installlocation || ""),
      exists: fs.existsSync
    });
    if (!candidate) continue;
    foundUntrustedCandidate = true;
    const canonical = canonicalExistingPath(candidate);
    if (!canonical) continue;
    const signature = await verifyExpectedSignature(
      canonical,
      plan.installedSigner,
      true
    );
    if (signature.ok) {
      return { ok: true, location: canonical };
    }
  }
  return { ok: !foundUntrustedCandidate, location: "" };
}

async function trustedEnvironmentUninstallRecord(
  environmentId,
  registry
) {
  const policy = Object.hasOwn(
    ENVIRONMENT_UNINSTALL_POLICIES,
    environmentId
  )
    ? ENVIRONMENT_UNINSTALL_POLICIES[environmentId]
    : null;
  if (!policy) return null;
  const record = findTrustedUninstallRecord({
    registry,
    policy,
    exists: fs.existsSync,
    realpath: fs.realpathSync.native,
    systemRoot: process.env.SystemRoot || "C:\\Windows"
  });
  if (!record) return null;
  if (record.action.kind === "msi") {
    const productCode = record.action.args[1] || "";
    const registryProductCode = path.win32.basename(
      String(record.entry.key || "")
    );
    if (
      (policy.machineMsiOnly &&
        !/^HKEY_LOCAL_MACHINE\\/i.test(String(record.entry.key || ""))) ||
      registryProductCode.toUpperCase() !== productCode.toUpperCase()
    ) {
      return null;
    }
    return record;
  }
  const signature = await verifyExpectedSignature(
    record.action.executable,
    policy.signer,
    true
  );
  return signature.ok ? record : null;
}

async function environmentStatusFromScan(
  environmentId,
  evidence,
  registryScan
) {
  const plan = getEnvironmentPlan(environmentId);
  if (!plan) {
    return resolveEnvironmentOperationStatus({
      evidence: { installed: false, location: "" },
      registryScanOk: false,
      evidenceProbeOk: false,
      registryEntry: null,
      registryEvidencePresent: false,
      uninstallAction: null
    });
  }
  const registryEntries = environmentRegistryCandidates(
    environmentId,
    registryScan.entries
  );
  const registeredProbe = await trustedRegisteredEnvironmentExecutable(
    environmentId,
    plan,
    registryEntries
  );
  const mergedEvidence = resolveEnvironmentEvidence({
    pathLocation: evidence.location,
    registeredLocation: registeredProbe.location,
    exists: fs.existsSync
  });
  const entry = chooseEnvironmentRegistryEntry(
    environmentId,
    mergedEvidence.location,
    registryEntries
  );
  const uninstallRecord = await trustedEnvironmentUninstallRecord(
    environmentId,
    registryEntries
  );
  return resolveEnvironmentOperationStatus({
    evidence: mergedEvidence,
    registryScanOk: registryScan.ok,
    evidenceProbeOk: evidence.probeOk === true && registeredProbe.ok,
    registryEntry: entry,
    registryEvidencePresent: registryEntries.length > 0,
    uninstallAction: uninstallRecord?.action || null
  });
}

async function detectEnvironmentOperationStatus(environmentId) {
  const plan = getEnvironmentPlan(environmentId);
  if (!plan) {
    return resolveEnvironmentOperationStatus({
      evidence: { installed: false, location: "" },
      registryScanOk: false,
      evidenceProbeOk: false,
      registryEntry: null,
      registryEvidencePresent: false,
      uninstallAction: null
    });
  }
  const [registryScan, evidence] = await Promise.all([
    scanRegistryAppsWithStatus(),
    locateEnvironment(environmentId, plan)
  ]);
  return await environmentStatusFromScan(
    environmentId,
    evidence,
    registryScan
  );
}

function isolatedThirdPartyEnvironment() {
  const blocked = /^(PORTABLE_EXECUTABLE_|ELECTRON_|NODE_OPTIONS$|NODE_PATH$|npm_config_node_options$|__COMPAT_LAYER$)/i;
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !blocked.test(name))
  );
}

async function scanEnvironment() {
  const [registryScan, locations] = await Promise.all([
    scanRegistryAppsWithStatus(),
    Promise.all(
      Object.entries(ENVIRONMENT_PLANS).map(async ([id, plan]) => ({
        id,
        evidence: await locateEnvironment(id, plan)
      }))
    )
  ]);
  const checks = await Promise.all(
    locations.map(async ({ id, evidence }) => {
      const plan = getEnvironmentPlan(id);
      const status = await environmentStatusFromScan(
        id,
        evidence,
        registryScan
      );
      return {
        id,
        name: plan.name,
        installed: status.installed,
        location: status.location,
        canUninstall: status.canUninstall,
        detection: status.detection
      };
    })
  );
  return {
    platform: process.platform,
    architecture: process.arch,
    checkedAt: new Date().toISOString(),
    checks
  };
}

async function scanWindowsApps() {
  const script = [
    "$packages=Get-AppxPackage|Select-Object Name,PackageFullName,PackageFamilyName,Publisher,Architecture,InstallLocation,Version",
    "$starts=Get-StartApps|Select-Object Name,AppID",
    "[pscustomobject]@{packages=$packages;starts=$starts}|ConvertTo-Json -Depth 4 -Compress"
  ].join(";");
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        timeout: 20000,
        maxBuffer: 8 * 1024 * 1024
      }
    );
    const value = JSON.parse(stdout.trim());
    return {
      ok: true,
      packages: Array.isArray(value.packages)
        ? value.packages
        : value.packages
          ? [value.packages]
          : [],
      starts: Array.isArray(value.starts)
        ? value.starts
        : value.starts
          ? [value.starts]
          : []
    };
  } catch {
    return { ok: false, packages: [], starts: [] };
  }
}

function normalizedIconPath(value) {
  if (!value) return "";
  const candidate = value.replace(/^"/, "").replace(/".*$/, "").split(",")[0];
  return path.isAbsolute(candidate) && fs.existsSync(candidate) ? candidate : "";
}

function trustedDesktopUninstallRecord(productId, registry) {
  const policy = DESKTOP_PROBES[productId]?.uninstall;
  if (!policy) return null;
  return findTrustedUninstallRecord({
    registry,
    policy,
    exists: fs.existsSync,
    realpath: fs.realpathSync.native,
    systemRoot: process.env.SystemRoot || "C:\\Windows"
  });
}

function trustedDesktopAppxPackage(productId, packages) {
  const policy = DESKTOP_PROBES[productId]?.appx;
  return policy ? trustedAppxPackage(packages, policy) : null;
}

async function detectDesktopProduct(productId) {
  const probe = DESKTOP_PROBES[productId];
  if (!probe) {
    return {
      installed: false,
      version: "",
      location: "",
      executable: "",
      appId: "",
      canOpen: false,
      canUninstall: false,
      detection: "unknown"
    };
  }
  const matches = (value) =>
    probe.names.some((name) =>
      String(value || "").toLowerCase().includes(name.toLowerCase())
    );
  const [registryScan, windowsApps] = await Promise.all([
    scanRegistryAppsWithStatus(),
    scanWindowsApps()
  ]);
  const registry = registryScan.entries;
  const uninstallRecord = registryScan.ok
    ? trustedDesktopUninstallRecord(productId, registry)
    : null;
  const registryMatch = probe.uninstall
    ? uninstallRecord?.entry
    : registry.find((entry) => matches(entry.displayname));
  const packageMatch = probe.appx
    ? trustedDesktopAppxPackage(productId, windowsApps.packages)
    : windowsApps.packages.find(
        (entry) => matches(entry.Name) || matches(entry.PackageFullName)
      );
  const startMatch = windowsApps.starts.find((entry) => matches(entry.Name));
  const uninstallSignature = uninstallRecord
    ? await verifyExpectedSignature(
        uninstallRecord.action.executable,
        probe.signer
      )
    : null;
  const executableCandidate = probe.uninstall
    ? uninstallRecord
      ? findTrustedProductExecutable({
          entry: uninstallRecord.entry,
          executableNames: probe.executableNames,
          exists: fs.existsSync,
          realpath: fs.realpathSync.native
        })
      : ""
    : normalizedIconPath(registryMatch?.displayicon);
  const executableSignature =
    executableCandidate && probe.uninstall
      ? await verifyExpectedSignature(executableCandidate, probe.signer)
      : null;
  const executable = probe.uninstall
    ? executableSignature?.ok
      ? executableCandidate
      : ""
    : executableCandidate;
  const installLocation =
    registryMatch?.installlocation ||
    packageMatch?.InstallLocation ||
    (executable ? path.dirname(executable) : "");
  const installed = Boolean(registryMatch || packageMatch || startMatch);
  return {
    installed,
    version: String(
      registryMatch?.displayversion || packageMatch?.Version || ""
    ),
    location:
      installLocation && path.isAbsolute(installLocation)
        ? installLocation
        : "",
    executable,
    appId: String(startMatch?.AppID || ""),
    canOpen: probe.uninstall
      ? Boolean(executable)
      : Boolean(executable || startMatch?.AppID),
    canUninstall: Boolean(
      packageMatch && probe.appx
        ? true
        : uninstallRecord && uninstallSignature?.ok
    ),
    detection: installed
      ? "installed"
      : registryScan.ok && windowsApps.ok
        ? "absent"
        : "unknown"
  };
}

async function uninstallTrustedAppxProduct(
  productId,
  probe,
  operationController
) {
  let operationTask = null;
  let processSpawned = false;
  try {
    const firstScan = await scanWindowsApps();
    if (!firstScan.ok) {
      return {
        launched: false,
        error: "Windows 应用包扫描不完整，请稍后重新检测"
      };
    }
    const packageEntry = trustedDesktopAppxPackage(
      productId,
      firstScan.packages
    );
    const action = createAppxUninstallAction(packageEntry, probe.appx);
    if (!packageEntry || !action) {
      return {
        launched: false,
        error: "未找到名称、发布者和包身份均匹配的可信 Windows 应用"
      };
    }

    const productName = probe.names[0];
    const confirmation = await dialog.showMessageBox({
      type: "warning",
      title: `卸载 ${productName}`,
      message: `确认卸载 ${productName}？`,
      detail: [
        `产品：${productName}`,
        `版本：${packageEntry.Version || "Windows 未提供"}`,
        `发布者：${packageEntry.Publisher}`,
        `包身份：${packageEntry.PackageFullName}`,
        "AI Hub 只会移除这个已审核的当前用户应用包，并继续检测卸载结果。"
      ].join("\n"),
      buttons: ["取消", "继续卸载"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) {
      return { launched: false, canceled: true };
    }

    const finalScan = await scanWindowsApps();
    const finalPackage = finalScan.ok
      ? trustedDesktopAppxPackage(productId, finalScan.packages)
      : null;
    if (
      !finalPackage ||
      finalPackage.PackageFullName !== packageEntry.PackageFullName
    ) {
      return {
        launched: false,
        error: "应用包在确认期间发生变化，已拒绝执行卸载"
      };
    }

    operationTask = operationController.begin(productId, "uninstall");
    const identity = {
      generation: operationTask.generation,
      operationId: operationTask.operationId
    };
    const finishLaunch = (launched) => {
      operationTask = operationController.finishLaunch(
        productId,
        identity.generation,
        identity.operationId,
        launched
      );
      return operationTask;
    };
    const launchResult = await launchProcessWithGrace({
      command: action.executable,
      args: action.args,
      graceMs: 2_000,
      env: isolatedThirdPartyEnvironment(),
      processLabel: "Windows 应用卸载",
      onSpawn: () => {
        processSpawned = true;
        finishLaunch(true);
      }
    });
    if (!launchResult.launched) {
      if (operationTask?.phase === "launching") finishLaunch(false);
      return {
        ...launchResult,
        operationTask,
        error: launchResult.error || `无法卸载 ${productName}`
      };
    }
    if (operationTask?.phase === "launching") finishLaunch(true);
    return {
      ...launchResult,
      operationTask: operationController.get(productId) || operationTask,
      message: "卸载请求已提交，正在自动检测卸载结果"
    };
  } catch (error) {
    if (operationTask && !processSpawned) {
      try {
        operationTask = operationController.finishLaunch(
          productId,
          operationTask.generation,
          operationTask.operationId,
          false
        );
      } catch {
        operationTask = operationController.get(productId);
      }
    }
    return {
      launched: false,
      operationTask,
      error:
        error instanceof Error && error.message
          ? `无法卸载 Windows 应用：${error.message}`
          : "无法卸载 Windows 应用"
    };
  }
}

function catalogCachePath() {
  return path.join(app.getPath("userData"), "catalog-cache.json");
}

function releaseClientIdPath() {
  return path.join(app.getPath("userData"), "release-client-id.txt");
}

function releaseClientId() {
  return readOrCreateClientId(releaseClientIdPath());
}

function channelPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "catalog", "channel.json")
    : path.join(__dirname, "..", "catalog", "channel.json");
}

function readChannel() {
  try {
    return readReleaseChannel(
      JSON.parse(fs.readFileSync(channelPath(), "utf8")),
      { kind: "catalog", allowLocalhost: !app.isPackaged }
    );
  } catch (error) {
    return {
      schemaVersion: 2,
      kind: "catalog",
      releaseUrl: "",
      allowedReleaseOrigins: [],
      trustedKeys: [],
      error:
        error instanceof Error ? error.message : "目录发布通道配置无效"
    };
  }
}

async function fetchRemoteCatalogRelease(channel, clientId, highest = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await net.fetch(channel.releaseUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`远程目录返回 ${response.status}`);
    }
    const finalUrl = resolveReleaseResponseUrl(response, channel.releaseUrl);
    if (!channel.allowedReleaseOrigins.includes(finalUrl.origin)) {
      throw new Error("远程目录重定向到了未固定的来源");
    }
    const raw = await readResponseTextWithLimit(response, 1024 * 1024);
    return {
      envelope: JSON.parse(raw),
      release: verifyCatalogRelease(JSON.parse(raw), {
        trustedKeys: channel.trustedKeys,
        clientId,
        highestCatalogVersion: highest?.catalogVersion || 0,
        highestCatalogSha256: highest?.catalogSha256 || ""
      })
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readCachedCatalogRelease(channel, clientId) {
  return verifyCatalogReleaseCache(
    JSON.parse(fs.readFileSync(catalogCachePath(), "utf8")),
    {
      expectedSourceUrl: channel.releaseUrl,
      trustedKeys: channel.trustedKeys,
      clientId,
      allowLocalhost: !app.isPackaged
    }
  );
}

async function resolveCatalog() {
  const channel = readChannel();
  if (channel.error) {
    return {
      source: "built-in",
      catalog: null,
      error: channel.error
    };
  }
  if (!channel.releaseUrl) {
    return {
      source: "built-in",
      catalog: null,
      error: ""
    };
  }
  const clientId = releaseClientId();
  let remoteError = "";
  let cached = null;
  try {
    cached = readCachedCatalogRelease(channel, clientId);
  } catch {
    cached = null;
  }
  try {
    const result = await fetchRemoteCatalogRelease(channel, clientId, cached);
    if (!result.release.eligible) {
      return cached?.eligible
        ? {
            source: "cache",
            catalog: cached.catalog,
            catalogVersion: cached.catalogVersion,
            error: ""
          }
        : {
            source: "built-in",
            catalog: null,
            catalogVersion: result.release.catalogVersion,
            error: ""
          };
    }
    writeJsonAtomically(catalogCachePath(), {
      schemaVersion: 1,
      sourceUrl: channel.releaseUrl,
      cachedAt: new Date().toISOString(),
      envelope: result.envelope
    });
    return {
      source: "remote",
      catalog: result.release.catalog,
      catalogVersion: result.release.catalogVersion,
      error: ""
    };
  } catch (error) {
    remoteError =
      error instanceof Error ? error.message : "远程目录加载失败";
  }
  return cached?.eligible
    ? {
        source: "cache",
        catalog: cached.catalog,
        catalogVersion: cached.catalogVersion,
        error: remoteError
      }
    : { source: "built-in", catalog: null, error: remoteError };
}

function updateChannelPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "updates", "channel.json")
    : path.join(__dirname, "..", "updates", "channel.json");
}

function readUpdateChannel() {
  try {
    return readReleaseChannel(
      JSON.parse(fs.readFileSync(updateChannelPath(), "utf8")),
      { kind: "update", allowLocalhost: !app.isPackaged }
    );
  } catch (error) {
    return {
      schemaVersion: 2,
      kind: "update",
      releaseUrl: "",
      allowedReleaseOrigins: [],
      trustedKeys: [],
      error:
        error instanceof Error ? error.message : "更新通道配置无效"
    };
  }
}

async function fetchUpdateManifest(channel, currentVersion, clientId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await net.fetch(channel.releaseUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`更新服务器返回 ${response.status}`);
    }
    const finalUrl = resolveReleaseResponseUrl(response, channel.releaseUrl);
    if (!channel.allowedReleaseOrigins.includes(finalUrl.origin)) {
      throw new Error("更新清单重定向到了未固定的来源");
    }
    const raw = await readResponseTextWithLimit(response, 64 * 1024);
    return verifyAndEvaluateUpdateRelease(JSON.parse(raw), {
      trustedKeys: channel.trustedKeys,
      allowedDownloadOrigins: channel.allowedReleaseOrigins,
      currentVersion,
      clientId
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkForUpdate() {
  const generation = ++updateCheckGeneration;
  const currentVersion = app.getVersion();
  const channel = readUpdateChannel();
  lastVerifiedUpdateOffer = null;
  if (channel.error) {
    return {
      status: "error",
      currentVersion,
      message: channel.error
    };
  }
  if (!channel.releaseUrl) {
    return {
      status: "disabled",
      currentVersion,
      message: "尚未配置正式 HTTPS 更新通道"
    };
  }
  try {
    const result = await fetchUpdateManifest(
      channel,
      currentVersion,
      releaseClientId()
    );
    if (generation !== updateCheckGeneration) {
      return {
        status: "error",
        currentVersion,
        message: "更新检查已被更新的请求替代"
      };
    }
    if (result.status === "current") {
      return {
        status: "current",
        currentVersion,
        version: result.version,
        message: "当前已是最新版本"
      };
    }
    if (result.status === "not-eligible") {
      return {
        status: "current",
        currentVersion,
        version: result.version,
        message: "当前灰度批次暂无可用更新"
      };
    }
    const release = result.release;
    lastVerifiedUpdateOffer = {
      generation,
      expiresAt: Date.now() + 10 * 60 * 1000,
      version: release.version,
      downloadUrl: release.downloadUrl,
      sha256: release.sha256,
      fileSize: release.fileSize
    };
    return {
      status: "available",
      currentVersion,
      version: release.version,
      publishedAt: release.publishedAt,
      notes: release.notes,
      sha256: release.sha256,
      fileSize: release.fileSize,
      message: `发现新版本 ${release.version}`
    };
  } catch (error) {
    if (generation === updateCheckGeneration) {
      lastVerifiedUpdateOffer = null;
    }
    return {
      status: "error",
      currentVersion,
      message: error instanceof Error ? error.message : "检查更新失败"
    };
  }
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return { downloadDirectory: "", cliInstallDirectory: "" };
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(settings, null, 2), "utf8");
}

async function locateNpmRuntime() {
  const [nodeExecutable, npmCommand] = await Promise.all([
    locate("node.exe"),
    locate("npm.cmd")
  ]);
  if (!nodeExecutable || !npmCommand) {
    throw new Error("未检测到 Node.js 与 npm");
  }
  let canonicalNode;
  let canonicalNpmCommand;
  try {
    canonicalNode = fs.realpathSync.native(nodeExecutable);
    canonicalNpmCommand = fs.realpathSync.native(npmCommand);
  } catch {
    throw new Error("Node.js 或 npm 路径无法安全解析");
  }
  const nodeDirectory = path.dirname(canonicalNode);
  if (
    path.basename(canonicalNode).toLowerCase() !== "node.exe" ||
    path.dirname(canonicalNpmCommand).toLowerCase() !== nodeDirectory.toLowerCase()
  ) {
    throw new Error("Node.js 与 npm 不属于同一个可信安装目录");
  }
  const npmCliCandidate = path.join(
    nodeDirectory,
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js"
  );
  let npmCli;
  try {
    npmCli = fs.realpathSync.native(npmCliCandidate);
  } catch {
    throw new Error("无法定位 npm-cli.js");
  }
  if (npmCli.toLowerCase() !== npmCliCandidate.toLowerCase()) {
    throw new Error("npm-cli.js 路径发生跳转，已拒绝使用");
  }
  const npmManifestPath = path.join(
    nodeDirectory,
    "node_modules",
    "npm",
    "package.json"
  );
  let npmManifest;
  try {
    npmManifest = JSON.parse(fs.readFileSync(npmManifestPath, "utf8"));
  } catch {
    throw new Error("npm 安装信息无法读取");
  }
  if (
    npmManifest?.name !== "npm" ||
    typeof npmManifest?.version !== "string" ||
    !/^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/.test(npmManifest.version)
  ) {
    throw new Error("npm 安装信息无效");
  }
  const signature = await verifyExpectedSignature(
    canonicalNode,
    ENVIRONMENT_PLANS.node.installedSigner,
    true
  );
  if (!signature.ok) {
    throw new Error("Node.js 数字签名与预期发布者不匹配");
  }
  const [nodeSha256, npmCliSha256] = await Promise.all([
    fileSha256(canonicalNode),
    fileSha256(npmCli)
  ]);
  const npmTreeSha256 = computeNpmTreeSha256(
    path.join(nodeDirectory, "node_modules", "npm")
  );
  if (!npmTreeSha256) {
    throw new Error("npm 安装目录包含链接、跳转或无法读取的文件");
  }
  return {
    nodeExecutable: canonicalNode,
    npmCli,
    nodeSha256,
    npmCliSha256,
    npmTreeSha256,
    npmVersion: npmManifest.version
  };
}

const NPM_EXECUTION_DIRECTORY_PREFIX = "aihub-npm-exec-";
const OFFICIAL_NPM_REGISTRY = "https://registry.npmjs.org/";

function createNpmExecutionContext() {
  const temporaryRoot = fs.realpathSync.native(app.getPath("temp"));
  const directory = fs.mkdtempSync(
    path.join(temporaryRoot, NPM_EXECUTION_DIRECTORY_PREFIX)
  );
  const userConfigPath = path.join(directory, "user.npmrc");
  const globalConfigPath = path.join(directory, "global.npmrc");
  fs.writeFileSync(userConfigPath, "# Isolated AI Hub user npm configuration\n", {
    encoding: "utf8",
    flag: "wx"
  });
  fs.writeFileSync(
    globalConfigPath,
    "# Isolated AI Hub global npm configuration\n",
    { encoding: "utf8", flag: "wx" }
  );
  return { directory, userConfigPath, globalConfigPath, temporaryRoot };
}

function removeNpmExecutionContext(context) {
  if (!context?.directory || !context?.temporaryRoot) return;
  try {
    const resolvedRoot = fs.realpathSync.native(context.temporaryRoot);
    const resolvedDirectory = fs.realpathSync.native(context.directory);
    if (
      path.dirname(resolvedDirectory).toLowerCase() !== resolvedRoot.toLowerCase() ||
      !path.basename(resolvedDirectory).startsWith(NPM_EXECUTION_DIRECTORY_PREFIX) ||
      resolvedDirectory.toLowerCase() === resolvedRoot.toLowerCase() ||
      resolvedDirectory.toLowerCase() === path.parse(resolvedDirectory).root.toLowerCase()
    ) {
      return;
    }
    fs.rmSync(resolvedDirectory, { recursive: true, force: true });
  } catch {
    // The context may already be gone; never broaden the cleanup target.
  }
}

function safeNpmEnvironment(context) {
  const blocked = new Set([
    "node_options",
    "node_path",
    "npm_node_execpath",
    "npm_execpath"
  ]);
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => {
      const normalized = key.toLowerCase();
      return !blocked.has(normalized) && !normalized.startsWith("npm_config_");
    })
  );
  environment.npm_config_update_notifier = "false";
  environment.npm_config_userconfig = context.userConfigPath;
  environment.npm_config_globalconfig = context.globalConfigPath;
  environment.npm_config_registry = OFFICIAL_NPM_REGISTRY;
  environment.npm_config_ignore_scripts = "true";
  return environment;
}

function sameNpmRuntime(left, right) {
  return [
    "nodeExecutable",
    "npmCli",
    "nodeSha256",
    "npmCliSha256",
    "npmTreeSha256",
    "npmVersion"
  ].every((key) => String(left?.[key] || "") === String(right?.[key] || ""));
}

function readInstalledCliVersion(directory, packageName) {
  try {
    const manifest = path.join(
      directory,
      "node_modules",
      ...packageName.split("/"),
      "package.json"
    );
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    return value.name === packageName && typeof value.version === "string"
      ? value.version
      : "";
  } catch {
    return "";
  }
}

async function runReviewedCliPostInstall({
  emit,
  productId,
  directory,
  plan,
  runtime,
  executionContext
}) {
  if (!plan.postInstall) return { ok: true };
  try {
    const confirmedRuntime = await locateNpmRuntime();
    if (!sameNpmRuntime(runtime, confirmedRuntime)) {
      return {
        ok: false,
        error: "CLI 安装期间 Node.js 或 npm 运行环境发生变化，已拒绝执行后置步骤"
      };
    }
    const action = createManagedCliPostInstallAction({
      productId,
      plan,
      prefix: directory,
      runtime: confirmedRuntime
    });
    if (!action) {
      return {
        ok: false,
        error: "官方软件包的 postinstall 契约与客户端审核记录不一致"
      };
    }
    emit("stdout", `正在运行已审核的 ${plan.name} 官方后置安装步骤`);
    const postInstall = await execFileAsync(action.executable, action.args, {
      ...action.options,
      env: {
        ...safeNpmEnvironment(executionContext),
        npm_lifecycle_event: "postinstall",
        npm_package_name: action.packageName,
        npm_package_version: action.version
      },
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024
    });
    if (postInstall.stdout?.trim()) emit("stdout", postInstall.stdout.trim());
    if (postInstall.stderr?.trim()) emit("stderr", postInstall.stderr.trim());

    let executable;
    try {
      executable = fs.realpathSync.native(action.expectedExecutable);
      const stat = fs.lstatSync(action.expectedExecutable);
      if (
        executable.toLowerCase() !== action.expectedExecutable.toLowerCase() ||
        !stat.isFile() ||
        stat.isSymbolicLink()
      ) {
        throw new Error("invalid executable");
      }
    } catch {
      return {
        ok: false,
        error: `${plan.name} 后置安装结束，但未生成可信的原生可执行文件`
      };
    }
    const verification = await execFileAsync(
      executable,
      action.verificationArgs,
      {
        cwd: path.dirname(executable),
        windowsHide: true,
        shell: false,
        env: safeNpmEnvironment(executionContext),
        timeout: 30000,
        maxBuffer: 1024 * 1024
      }
    );
    const versionOutput = `${verification.stdout || ""}\n${verification.stderr || ""}`.trim();
    if (!versionOutput) {
      return { ok: false, error: `${plan.name} 可执行文件未返回版本信息` };
    }
    emit("stdout", `${plan.name} 验证通过：${versionOutput.slice(0, 500)}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `${plan.name} 后置安装或启动验证失败：${error.message}`
          : `${plan.name} 后置安装或启动验证失败`
    };
  }
}

function getCliStatus(productId) {
  const plan = CLI_INSTALL_PLANS[productId];
  if (!plan) {
    return {
      installed: false,
      version: "",
      directory: "",
      detection: "unknown",
      managed: false,
      canUninstall: false,
      ownership: "unknown"
    };
  }
  const records = readManagedCliRecords();
  return inspectManagedCli({
    productId,
    plan,
    receipt: records[productId] || null,
    configuredPrefix: readSettings().cliInstallDirectory || ""
  });
}

function runCliInstall(sender, productId, directory, plan) {
  return new Promise(async (resolve) => {
    let executionContext = null;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      removeNpmExecutionContext(executionContext);
      resolve(result);
    };
    const emit = (stream, line) => {
      sender.send("cli:log", {
        productId,
        stream,
        line: String(line).replace(/\x1b\[[0-9;]*m/g, "").slice(0, 2000)
      });
    };

    try {
      const runtime = await locateNpmRuntime();
      fs.mkdirSync(directory, { recursive: true });
      executionContext = createNpmExecutionContext();
      const action = createManagedCliInstallAction({
        productId,
        plan,
        prefix: directory,
        runtime,
        executionContext
      });
      if (!action) throw new Error("无法建立隔离的 CLI 安装动作");
      const child = spawn(
        action.executable,
        action.args,
        {
          ...action.options,
          env: safeNpmEnvironment(executionContext)
        }
      );

      let stdoutBuffer = "";
      let stderrBuffer = "";
      const flush = (stream, chunk) => {
        const combined =
          (stream === "stdout" ? stdoutBuffer : stderrBuffer) +
          chunk.toString("utf8");
        const lines = combined.split(/\r?\n/);
        const remainder = lines.pop() || "";
        if (stream === "stdout") stdoutBuffer = remainder;
        else stderrBuffer = remainder;
        lines.filter(Boolean).forEach((line) => emit(stream, line));
      };

      child.stdout.on("data", (chunk) => flush("stdout", chunk));
      child.stderr.on("data", (chunk) => flush("stderr", chunk));
      child.on("error", (error) => finish({ ok: false, error: error.message }));
      child.on("close", async (code) => {
        if (stdoutBuffer) emit("stdout", stdoutBuffer);
        if (stderrBuffer) emit("stderr", stderrBuffer);
        const version = readInstalledCliVersion(
          directory,
          plan.packageName
        );
        if (code === 0 && version) {
          const postInstall = await runReviewedCliPostInstall({
            emit,
            productId,
            directory,
            plan,
            runtime,
            executionContext
          });
          if (!postInstall.ok) {
            finish(postInstall);
            return;
          }
          finish({ ok: true, version, directory, runtime });
        } else {
          finish({
            ok: false,
            error:
              code === 0
                ? "安装结束，但未找到有效的软件包"
                : `安装进程退出，代码 ${code}`
          });
        }
      });
    } catch (error) {
      finish({
        ok: false,
        error: error instanceof Error ? error.message : "CLI 安装失败"
      });
    }
  });
}

function runCliUninstall(sender, action, executionContext) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const emit = (stream, line) => {
      sender.send("cli:log", {
        productId: action.productId,
        stream,
        line: String(line).replace(/\x1b\[[0-9;]*m/g, "").slice(0, 2000)
      });
    };
    try {
      const child = spawn(action.executable, action.args, {
        ...action.options,
        env: safeNpmEnvironment(executionContext)
      });
      let stdoutBuffer = "";
      let stderrBuffer = "";
      const flush = (stream, chunk) => {
        const combined =
          (stream === "stdout" ? stdoutBuffer : stderrBuffer) +
          chunk.toString("utf8");
        const lines = combined.split(/\r?\n/);
        const remainder = lines.pop() || "";
        if (stream === "stdout") stdoutBuffer = remainder;
        else stderrBuffer = remainder;
        lines.filter(Boolean).forEach((line) => emit(stream, line));
      };
      child.stdout.on("data", (chunk) => flush("stdout", chunk));
      child.stderr.on("data", (chunk) => flush("stderr", chunk));
      child.on("error", (error) =>
        finish({ ok: false, error: error.message })
      );
      child.on("close", (code) => {
        if (stdoutBuffer) emit("stdout", stdoutBuffer);
        if (stderrBuffer) emit("stderr", stderrBuffer);
        finish(
          code === 0
            ? { ok: true }
            : {
                ok: false,
                error: `CLI 卸载进程退出，代码 ${code}`
              }
        );
      });
    } catch (error) {
      finish({
        ok: false,
        error: error instanceof Error ? error.message : "CLI 卸载失败"
      });
    }
  });
}

function safeDownloadTarget(fileName) {
  const settings = readSettings();
  const directory = settings.downloadDirectory;
  if (!directory || !path.isAbsolute(directory)) {
    throw new Error("请先选择安装包下载位置");
  }

  const safeName = path.basename(fileName);
  if (
    safeName !== fileName ||
    !/\.(exe|msi|msix|zip)$/i.test(safeName)
  ) {
    throw new Error("安装包文件名无效");
  }

  fs.mkdirSync(directory, { recursive: true });
  const parsed = path.parse(safeName);
  let candidateName = safeName;
  let suffix = 1;
  while (
    fs.existsSync(path.resolve(directory, candidateName)) ||
    fs.existsSync(`${path.resolve(directory, candidateName)}.part`)
  ) {
    candidateName = `${parsed.name} (${suffix})${parsed.ext}`;
    suffix += 1;
  }
  const target = path.resolve(directory, candidateName);
  const relative = path.relative(path.resolve(directory), target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("安装包路径无效");
  }
  return target;
}

function availableDiskBytes(targetPath) {
  const stats = fs.statfsSync(path.dirname(targetPath), { bigint: true });
  const available = stats.bavail * stats.bsize;
  return Number(
    available > BigInt(Number.MAX_SAFE_INTEGER)
      ? BigInt(Number.MAX_SAFE_INTEGER)
      : available
  );
}

function gigabytesForMessage(bytes) {
  return `${Math.ceil((bytes / 1024 ** 3) * 10) / 10} GB`;
}

function canonicalDownloadRoot(targetPath) {
  const directory = path.dirname(path.resolve(targetPath));
  const canonical = fs.realpathSync.native(directory);
  if (!path.isAbsolute(canonical)) {
    throw new Error(
      "\u4e0b\u8f7d\u4f4d\u7f6e\u65e0\u6cd5\u5b89\u5168\u89e3\u6790"
    );
  }
  return path.resolve(canonical);
}

function hasExpectedManagedDownloadName(targetPath, fileName) {
  const expected = path.parse(fileName);
  const actual = path.parse(path.basename(targetPath));
  const suffix = actual.name.slice(expected.name.length);
  return (
    actual.ext.toLowerCase() === expected.ext.toLowerCase() &&
    (actual.name === expected.name || /^ \(\d+\)$/.test(suffix))
  );
}

function migrateLegacyManagedPartialRecord(
  productId,
  plan,
  record,
  records
) {
  if (
    !record ||
    (typeof record.downloadRoot === "string" &&
      typeof record.attemptId === "string" &&
      record.attemptId)
  ) {
    return record;
  }
  const settings = readSettings();
  if (
    record.productId !== productId ||
    record.url !== plan.url ||
    record.fileName !== plan.fileName ||
    typeof record.targetPath !== "string" ||
    !path.isAbsolute(record.targetPath) ||
    typeof settings.downloadDirectory !== "string" ||
    !path.isAbsolute(settings.downloadDirectory)
  ) {
    return null;
  }
  const configuredRoot = path.resolve(settings.downloadDirectory);
  const legacyTarget = path.resolve(record.targetPath);
  const relative = path.relative(configuredRoot, legacyTarget);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    path.dirname(legacyTarget).toLowerCase() !==
      configuredRoot.toLowerCase() ||
    !hasExpectedManagedDownloadName(legacyTarget, plan.fileName) ||
    fs.existsSync(legacyTarget)
  ) {
    return null;
  }
  try {
    const canonicalRoot = fs.realpathSync.native(configuredRoot);
    const canonicalTarget = path.join(
      canonicalRoot,
      path.basename(legacyTarget)
    );
    const legacyPartial = `${legacyTarget}.part`;
    if (fs.existsSync(legacyPartial)) {
      const stat = fs.lstatSync(legacyPartial);
      const canonicalPartial = fs.realpathSync.native(legacyPartial);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        path.dirname(canonicalPartial).toLowerCase() !==
          canonicalRoot.toLowerCase()
      ) {
        return null;
      }
    }
    const migrated = {
      ...record,
      attemptId:
        typeof record.attemptId === "string" && record.attemptId
          ? record.attemptId
          : `legacy-${crypto.randomUUID()}`,
      downloadRoot: path.resolve(canonicalRoot),
      targetPath: canonicalTarget,
      updatedAt: new Date().toISOString()
    };
    writePartialDownloadRecords({ ...records, [productId]: migrated });
    return migrated;
  } catch {
    return null;
  }
}

function managedPartialDownload(productId, plan) {
  const records = readPartialDownloadRecords();
  let record = records[productId];
  record = migrateLegacyManagedPartialRecord(
    productId,
    plan,
    record,
    records
  );
  if (
    !record ||
    record.productId !== productId ||
    record.url !== plan.url ||
    record.fileName !== plan.fileName ||
    typeof record.targetPath !== "string" ||
    !path.isAbsolute(record.targetPath) ||
    typeof record.downloadRoot !== "string" ||
    !path.isAbsolute(record.downloadRoot) ||
    typeof record.attemptId !== "string" ||
    !record.attemptId
  ) {
    return null;
  }
  const directory = path.resolve(record.downloadRoot);
  const target = path.resolve(record.targetPath);
  const relative = path.relative(directory, target);
  const partialPath = `${target}.part`;
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    path.dirname(target).toLowerCase() !== directory.toLowerCase() ||
    !hasExpectedManagedDownloadName(target, plan.fileName) ||
    fs.existsSync(target)
  ) {
    return null;
  }
  let receivedBytes = 0;
  let partialExists = false;
  try {
    const resolvedDirectory = fs.realpathSync.native(directory);
    if (resolvedDirectory.toLowerCase() !== directory.toLowerCase()) {
      return null;
    }
    if (fs.existsSync(partialPath)) {
      const stat = fs.lstatSync(partialPath);
      const resolvedPartial = fs.realpathSync.native(partialPath);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        path.dirname(resolvedPartial).toLowerCase() !==
          resolvedDirectory.toLowerCase()
      ) {
        return null;
      }
      receivedBytes = stat.size;
      partialExists = true;
    }
  } catch {
    return null;
  }
  if (!Number.isSafeInteger(receivedBytes) || receivedBytes < 0) return null;
  return {
    productId,
    attemptId: record.attemptId,
    fileName: plan.fileName,
    downloadRoot: directory,
    targetPath: target,
    partialPath,
    partialExists,
    receivedBytes,
    totalBytes:
      Number.isSafeInteger(record.totalBytes) && record.totalBytes > 0
        ? record.totalBytes
        : 0,
    updatedAt: String(record.updatedAt || "")
  };
}

function reusablePartialDownload(productId, plan) {
  const partial = managedPartialDownload(productId, plan);
  return isReusablePartialEvidence(partial) ? partial : null;
}

function discardManagedPartialDownload(productId, plan) {
  const records = readPartialDownloadRecords();
  if (!Object.prototype.hasOwnProperty.call(records, productId)) {
    return { ok: true, receivedBytes: 0, partial: null };
  }
  const partial = managedPartialDownload(productId, plan);
  if (!partial) {
    try {
      const { nextRecords } = removeRecordMetadata(records, productId);
      writePartialDownloadRecords(nextRecords);
      return {
        ok: true,
        receivedBytes: 0,
        partial: null,
        metadataOnly: true
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: "CANCEL_CLEANUP_FAILED",
        errorMessage:
          error instanceof Error
            ? `\u65e0\u6cd5\u6e05\u7406\u65e0\u6548\u65ad\u70b9\u8bb0\u5f55\uff1a${error.message}`
            : "\u65e0\u6cd5\u6e05\u7406\u65e0\u6548\u65ad\u70b9\u8bb0\u5f55\uff0c\u8bf7\u91cd\u8bd5",
        receivedBytes: 0,
        partial: null
      };
    }
  }
  try {
    if (partial.partialExists) {
      try {
        fs.rmSync(partial.partialPath);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    if (fs.existsSync(partial.partialPath)) {
      throw new Error(
        "\u65ad\u70b9\u6587\u4ef6\u5220\u9664\u540e\u4ecd\u5b58\u5728"
      );
    }
    const nextRecords = { ...records };
    delete nextRecords[productId];
    writePartialDownloadRecords(nextRecords);
    return {
      ok: true,
      receivedBytes: partial.receivedBytes,
      partial
    };
  } catch (error) {
    const remainingPartial = managedPartialDownload(productId, plan);
    return {
      ok: false,
      errorCode: "CANCEL_CLEANUP_FAILED",
      errorMessage:
        error instanceof Error
          ? `\u65e0\u6cd5\u6e05\u7406\u4e0b\u8f7d\u65ad\u70b9\uff1a${error.message}`
          : "\u65e0\u6cd5\u6e05\u7406\u4e0b\u8f7d\u65ad\u70b9\uff0c\u8bf7\u91cd\u8bd5\u53d6\u6d88",
      receivedBytes: partial.receivedBytes,
      partial: selectCleanupFailurePartial(remainingPartial, partial)
    };
  }
}

function rollbackUncommittedManagedArtifact(
  productId,
  plan,
  filePath,
  intent,
  attemptId
) {
  if (!filePath) return { ok: true };
  const record = readPartialDownloadRecords()[productId];
  if (
    !record ||
    record.productId !== productId ||
    record.attemptId !== attemptId ||
    record.url !== plan.url ||
    record.fileName !== plan.fileName ||
    typeof record.targetPath !== "string" ||
    typeof record.downloadRoot !== "string" ||
    !path.isAbsolute(record.targetPath) ||
    !path.isAbsolute(record.downloadRoot)
  ) {
    return {
      ok: false,
      errorCode: "CANCEL_CLEANUP_FAILED",
      errorMessage:
        "\u5b8c\u6210\u6587\u4ef6\u7684\u65ad\u70b9\u8bb0\u5f55\u65e0\u6cd5\u5b89\u5168\u9a8c\u8bc1"
    };
  }
  const target = path.resolve(record.targetPath);
  const root = path.resolve(record.downloadRoot);
  if (
    path.resolve(filePath).toLowerCase() !== target.toLowerCase() ||
    path.dirname(target).toLowerCase() !== root.toLowerCase() ||
    !hasExpectedManagedDownloadName(target, plan.fileName)
  ) {
    return {
      ok: false,
      errorCode: "CANCEL_CLEANUP_FAILED",
      errorMessage:
        "\u5b8c\u6210\u6587\u4ef6\u8def\u5f84\u4e0e\u53ef\u4fe1\u65ad\u70b9\u8bb0\u5f55\u4e0d\u4e00\u81f4"
    };
  }
  try {
    const stat = fs.lstatSync(target);
    const canonicalRoot = fs.realpathSync.native(root);
    const canonicalFile = fs.realpathSync.native(target);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      canonicalRoot.toLowerCase() !== root.toLowerCase() ||
      path.dirname(canonicalFile).toLowerCase() !==
        canonicalRoot.toLowerCase()
    ) {
      throw new Error(
        "\u5b8c\u6210\u6587\u4ef6\u672a\u901a\u8fc7\u5b89\u5168\u6821\u9a8c"
      );
    }
    if (intent === "pause") {
      const partialPath = `${target}.part`;
      if (fs.existsSync(partialPath)) {
        throw new Error(
          "\u65ad\u70b9\u6587\u4ef6\u5df2\u5b58\u5728"
        );
      }
      fs.renameSync(target, partialPath);
    } else {
      fs.rmSync(target);
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorCode: "CANCEL_CLEANUP_FAILED",
      errorMessage:
        error instanceof Error
          ? `\u65e0\u6cd5\u56de\u6eda\u672a\u63d0\u4ea4\u7684\u5b8c\u6210\u6587\u4ef6\uff1a${error.message}`
          : "\u65e0\u6cd5\u56de\u6eda\u672a\u63d0\u4ea4\u7684\u5b8c\u6210\u6587\u4ef6"
    };
  }
}

async function downloadPackage(sender, input, target, options = {}) {
  const partial = `${target}.part`;
  const controller = options.controller || new AbortController();
  const requestedBytes =
    options.resumeAllowed && fs.existsSync(partial)
      ? fs.statSync(partial).size
      : 0;
  let output = null;
  let outputError = null;
  let reader = null;
  try {
    if (Number.isSafeInteger(options.completePartialBytes)) {
      assertDownloadCanFinalize({
        receivedBytes: requestedBytes,
        totalBytes: options.completePartialBytes,
        isCurrentAttempt: options.isCurrentAttempt
      });
      const stat = fs.lstatSync(partial);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size !== options.completePartialBytes
      ) {
        const error = new Error("Completed partial changed before promotion");
        error.code = "PARTIAL_PROMOTION_INVALID";
        throw error;
      }
      const completedHash = crypto.createHash("sha256");
      await updateHashFromFile(completedHash, partial);
      const verifiedStat = fs.lstatSync(partial);
      if (
        !verifiedStat.isFile() ||
        verifiedStat.isSymbolicLink() ||
        verifiedStat.size !== options.completePartialBytes
      ) {
        const error = new Error("Completed partial changed while hashing");
        error.code = "PARTIAL_PROMOTION_INVALID";
        throw error;
      }
      assertDownloadCanFinalize({
        receivedBytes: verifiedStat.size,
        totalBytes: options.completePartialBytes,
        isCurrentAttempt: options.isCurrentAttempt
      });
      fs.renameSync(partial, target);
      return {
        filePath: target,
        sha256: completedHash.digest("hex"),
        fileSize: verifiedStat.size,
        resumedFrom: verifiedStat.size
      };
    }
    const response = await net.fetch(input.url, {
      method: "GET",
      headers: {
        "User-Agent": DOWNLOAD_USER_AGENT,
        ...createResumeHeaders(requestedBytes)
      },
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok || !response.body) {
      throw new Error(`下载服务器返回 ${response.status}`);
    }
    if (
      input.managedProductId &&
      !isAllowedManagedDownloadUrl(
        input.managedProductId,
        response.url || input.url
      )
    ) {
      throw new Error("安装包最终下载域名未通过客户端安全策略");
    }
    if (Array.isArray(input.allowedFinalHosts)) {
      let finalUrl = null;
      try {
        finalUrl = new URL(response.url || input.url);
      } catch {
        finalUrl = null;
      }
      if (
        !finalUrl ||
        finalUrl.protocol !== "https:" ||
        !input.allowedFinalHosts.includes(finalUrl.hostname)
      ) {
        response.body.cancel().catch(() => {});
        throw new Error("环境安装包最终下载域名未通过客户端安全策略");
      }
    }
    if (Array.isArray(input.allowedFinalOrigins)) {
      let finalUrl = null;
      try {
        finalUrl = new URL(response.url || input.url);
      } catch {
        finalUrl = null;
      }
      if (
        !finalUrl ||
        finalUrl.protocol !== "https:" ||
        !input.allowedFinalOrigins.includes(finalUrl.origin)
      ) {
        response.body.cancel().catch(() => {});
        throw new Error("更新安装包最终下载来源未通过客户端安全策略");
      }
    }

    const resume = resolveResumeResponse({
      requestedBytes,
      status: response.status,
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range")
    });
    const totalBytes = resume.totalBytes;
    let receivedBytes = resume.receivedBytes;
    options.onMetadata?.({ receivedBytes, totalBytes });
    if (Number.isSafeInteger(options.safetyReserveBytes)) {
      const space = assessDownloadSpace({
        availableBytes: availableDiskBytes(target),
        totalBytes,
        receivedBytes: requestedBytes,
        safetyReserveBytes: options.safetyReserveBytes
      });
      const installAvailableBytes = options.installDiskBytes
        ? availableDiskBytes(path.join(app.getPath("home"), "AI-Hub-Probe"))
        : 0;
      const downloadUsesInstallVolume =
        path.parse(path.resolve(target)).root.toLowerCase() ===
        path.parse(path.resolve(app.getPath("home"))).root.toLowerCase();
      sender.send("download:progress", {
        productId: input.productId,
        receivedBytes,
        totalBytes,
        bytesPerSecond: 0,
        etaSeconds: null,
        percent: totalBytes
          ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
          : null,
        availableBytes: space.availableBytes,
        requiredBytes: space.requiredBytes,
        remainingBytes: space.remainingBytes,
        reserveBytes: space.reserveBytes,
        downloadDirectory: path.dirname(target),
        installDiskBytes: options.installDiskBytes || 0,
        installAvailableBytes,
        installSpaceOk:
          !options.installDiskBytes ||
          installAvailableBytes -
              (downloadUsesInstallVolume ? space.remainingBytes : 0) >=
            options.installDiskBytes,
        spaceOk: space.ok
      });
      if (!space.ok) {
        const error = new Error(
          `下载位置空间不足：需要 ${gigabytesForMessage(space.requiredBytes)}，` +
            `当前可用 ${gigabytesForMessage(space.availableBytes)}，请更换下载位置`
        );
        error.code = "INSUFFICIENT_DISK_SPACE";
        error.availableBytes = space.availableBytes;
        error.requiredBytes = space.requiredBytes;
        error.remainingBytes = space.remainingBytes;
        error.reserveBytes = space.reserveBytes;
        error.shortfallBytes = space.shortfallBytes;
        error.downloadDirectory = path.dirname(target);
        throw error;
      }
    }
    const startedAt = Date.now();
    const sessionStartBytes = receivedBytes;
    const hash = crypto.createHash("sha256");
    if (resume.append) await updateHashFromFile(hash, partial);
    output = fs.createWriteStream(partial, {
      flags: resume.append ? "a" : "w"
    });
    output.on("error", (error) => {
      outputError = error;
      reader?.cancel().catch(() => {});
    });
    reader = response.body.getReader();

    while (true) {
      let timeout = null;
      const chunk = await Promise.race([
        reader.read().finally(() => clearTimeout(timeout)),
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("下载长时间没有进度")),
            12000
          );
        })
      ]);
      if (chunk.done) break;
      if (outputError) throw outputError;
      const buffer = Buffer.from(chunk.value);
      receivedBytes += buffer.length;
      hash.update(buffer);
      if (!output.write(buffer)) await once(output, "drain");
      if (
        Date.now() - startedAt >= 15000 &&
        receivedBytes < 1024 * 1024
      ) {
        throw new Error("下载速度过慢，正在尝试备用源");
      }
      sender.send("download:progress", {
        productId: input.productId,
        receivedBytes,
        totalBytes,
        bytesPerSecond:
          Date.now() > startedAt
            ? Math.round(
                (receivedBytes - sessionStartBytes) /
                  ((Date.now() - startedAt) / 1000)
              )
            : 0,
        etaSeconds:
          totalBytes &&
          receivedBytes > sessionStartBytes &&
          Date.now() > startedAt
            ? Math.max(
                0,
                Math.round(
                  (totalBytes - receivedBytes) /
                    ((receivedBytes - sessionStartBytes) /
                      ((Date.now() - startedAt) / 1000))
                )
              )
            : null,
        percent: totalBytes
          ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
          : null
      });
    }

    if (outputError) throw outputError;
    output.end();
    await once(output, "close");
    assertDownloadCanFinalize({
      receivedBytes,
      totalBytes,
      isCurrentAttempt: options.isCurrentAttempt
    });
    fs.renameSync(partial, target);
    return {
      filePath: target,
      sha256: hash.digest("hex"),
      fileSize: receivedBytes,
      resumedFrom: resume.append ? requestedBytes : 0
    };
  } catch (error) {
    const canceledByUser = controller.signal.aborted;
    if (error?.code === "ENOSPC") {
      error.message = "下载过程中磁盘空间已耗尽，已保留断点，请清理空间后继续";
    }
    controller.abort();
    reader?.cancel().catch(() => {});
    if (output && !output.closed) {
      output.destroy();
      await once(output, "close").catch(() => {});
    }
    if (!options.keepPartial) {
      try {
        fs.rmSync(partial, { force: true });
      } catch {
        // A later attempt truncates the same fixed partial path.
      }
    }
    if (error && typeof error === "object") {
      error.downloadCanceled = canceledByUser;
    }
    throw error;
  }
}

function trustedCompletedDownloadRecord(productId) {
  const plan = resolveManagedDownloadPlan(productId);
  const record = readDownloadRecords()[productId];
  if (
    !plan ||
    !record ||
    record.productId !== productId ||
    typeof record.filePath !== "string" ||
    !path.isAbsolute(record.filePath) ||
    typeof record.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(record.sha256) ||
    !Number.isSafeInteger(record.fileSize) ||
    record.fileSize < 0 ||
    (plan.environmentId && record.url !== plan.url)
  ) {
    return null;
  }
  try {
    const resolvedFile = path.resolve(record.filePath);
    const stat = fs.lstatSync(resolvedFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== record.fileSize) {
      return null;
    }
    const expected = path.parse(plan.fileName);
    const actual = path.parse(path.basename(resolvedFile));
    const suffix = actual.name.slice(expected.name.length);
    if (
      actual.ext.toLowerCase() !== expected.ext.toLowerCase() ||
      (actual.name !== expected.name && !/^ \(\d+\)$/.test(suffix))
    ) {
      return null;
    }
    if (typeof record.downloadRoot === "string") {
      const root = path.resolve(record.downloadRoot);
      if (
        !path.isAbsolute(record.downloadRoot) ||
        path.dirname(resolvedFile).toLowerCase() !== root.toLowerCase() ||
        path.dirname(fs.realpathSync.native(resolvedFile)).toLowerCase() !==
          fs.realpathSync.native(root).toLowerCase()
      ) {
        return null;
      }
    }
    return { ...record, filePath: resolvedFile };
  } catch {
    return null;
  }
}

function taskProgressForPartial(task, partial) {
  const totalBytes = partial?.totalBytes || task?.progress?.totalBytes || 0;
  const receivedBytes = partial?.receivedBytes || 0;
  return {
    receivedBytes,
    totalBytes,
    bytesPerSecond: 0,
    etaSeconds: null,
    percent: totalBytes
      ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
      : null,
    downloadDirectory: partial?.downloadRoot || null
  };
}

function advanceManagedDownloadCompleted(productId, attemptId, record) {
  const current = currentManagedDownloadTask(productId);
  if (current?.phase === "completed") return current;
  const completed = advanceManagedDownloadTask(productId, {
    type:
      current?.phase === "canceling"
        ? "recover-completed"
        : "completed",
    attemptId,
    progress: {
      receivedBytes: record.fileSize,
      totalBytes: record.fileSize,
      bytesPerSecond: 0,
      etaSeconds: 0,
      percent: 100,
      remainingBytes: 0,
      downloadDirectory: record.downloadRoot
    },
    filePath: record.filePath,
    sha256: record.sha256,
    fileSize: record.fileSize
  });
  return completed.accepted ? completed.task : current;
}

function failManagedDownloadCancellation(productId, task, cleanup) {
  const failed = advanceManagedDownloadTask(productId, {
    type: "cancel-cleanup-failed",
    attemptId: task.attemptId,
    resumable: isReusablePartialEvidence(cleanup.partial),
    errorCode: cleanup.errorCode || "CANCEL_CLEANUP_FAILED",
    errorMessage:
      cleanup.errorMessage ||
      "\u53d6\u6d88\u65ad\u70b9\u6e05\u7406\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u53d6\u6d88",
    progress: taskProgressForPartial(task, cleanup.partial)
  });
  return failed.accepted ? failed.task : task;
}

function createTaskFromEvidence(productId, evidence) {
  const resumablePartial = isReusablePartialEvidence(evidence.partial)
    ? evidence.partial
    : null;
  const attemptId = crypto.randomUUID();
  const started = advanceManagedDownloadTask(productId, {
    type: "start",
    attemptId,
    progress: evidence.partial
      ? taskProgressForPartial(null, evidence.partial)
      : undefined
  });
  if (!started.accepted) return null;
  if (evidence.record) {
    return advanceManagedDownloadTask(productId, {
      type: "completed",
      attemptId,
      progress: {
        receivedBytes: evidence.record.fileSize,
        totalBytes: evidence.record.fileSize,
        bytesPerSecond: 0,
        etaSeconds: 0,
        percent: 100
      },
      filePath: evidence.record.filePath,
      sha256: evidence.record.sha256,
      fileSize: evidence.record.fileSize
    }).task;
  }
  return advanceManagedDownloadTask(productId, {
    type: "pause",
    attemptId,
    resumable: Boolean(resumablePartial),
    progress: taskProgressForPartial(started.task, resumablePartial)
  }).task;
}

function reconcileManagedDownloadTask(productId) {
  const plan = resolveManagedDownloadPlan(productId);
  if (!plan) return null;
  loadManagedDownloadTasks();
  let task = managedDownloadTasks.get(productId) || null;
  const record = trustedCompletedDownloadRecord(productId);
  const partial = managedPartialDownload(productId, plan);

  if (!task) {
    return record || partial
      ? createTaskFromEvidence(productId, { record, partial })
      : null;
  }
  if (activeDownloads.has(productId)) return task;

  if (record) {
    if (task.phase === "completed") return task;
    if (task.phase === "canceling") {
      const recovered = advanceManagedDownloadTask(productId, {
        type: "recover-completed",
        attemptId: task.attemptId,
        progress: {
          receivedBytes: record.fileSize,
          totalBytes: record.fileSize,
          bytesPerSecond: 0,
          etaSeconds: 0,
          percent: 100
        },
        filePath: record.filePath,
        sha256: record.sha256,
        fileSize: record.fileSize
      });
      if (recovered.accepted) {
        try {
          removePartialDownloadRecord(productId);
        } catch {
          // The trusted completed record remains authoritative on next startup.
        }
        return recovered.task;
      }
      return task;
    }
    if (!["starting", "downloading", "pausing"].includes(task.phase)) {
      const retried = advanceManagedDownloadTask(productId, {
        type: "retry",
        attemptId: crypto.randomUUID()
      });
      if (!retried.accepted) return task;
      task = retried.task;
    }
    const completed = advanceManagedDownloadTask(productId, {
      type: "completed",
      attemptId: task.attemptId,
      progress: {
        receivedBytes: record.fileSize,
        totalBytes: record.fileSize,
        bytesPerSecond: 0,
        etaSeconds: 0,
        percent: 100
      },
      filePath: record.filePath,
      sha256: record.sha256,
      fileSize: record.fileSize
    });
    return completed.accepted ? completed.task : task;
  }

  if (task.phase === "completed") {
    const retried = advanceManagedDownloadTask(productId, {
      type: "retry",
      attemptId: crypto.randomUUID()
    });
    if (!retried.accepted) return task;
    const failed = advanceManagedDownloadTask(productId, {
      type: "failed",
      attemptId: retried.task.attemptId,
      resumable: isReusablePartialEvidence(partial),
      errorCode: "DOWNLOADED_FILE_MISSING",
      errorMessage: "已下载的安装包不存在或记录不可信，请重新下载",
      progress: taskProgressForPartial(retried.task, partial)
    });
    return failed.accepted ? failed.task : retried.task;
  }

  if (task.phase === "canceling") {
    const cleanup = discardManagedPartialDownload(productId, plan);
    if (!cleanup.ok) {
      return failManagedDownloadCancellation(productId, task, cleanup);
    }
    const canceled = advanceManagedDownloadTask(productId, {
      type: "cancel",
      attemptId: task.attemptId
    });
    return canceled.accepted ? canceled.task : task;
  }

  if (["starting", "downloading", "pausing"].includes(task.phase)) {
    const paused = advanceManagedDownloadTask(productId, {
      type: "pause",
      attemptId: task.attemptId,
      resumable: isReusablePartialEvidence(partial),
      progress: taskProgressForPartial(task, partial)
    });
    return paused.accepted ? paused.task : task;
  }
  return task;
}

function beginManagedDownloadAttempt(productId, plan, target, reusable) {
  let task = reconcileManagedDownloadTask(productId);
  const attemptId = crypto.randomUUID();
  const partialStartMode = classifyPartialForStart(reusable);
  const downloadRoot =
    reusable?.downloadRoot || canonicalDownloadRoot(target);
  const canonicalTarget = path.join(downloadRoot, path.basename(target));
  const transition = task
    ? advanceManagedDownloadTask(productId, {
        type: "retry",
        attemptId
      })
    : advanceManagedDownloadTask(productId, {
        type: "start",
        attemptId,
        progress: reusable
          ? taskProgressForPartial(null, reusable)
          : undefined
      });
  if (!transition.accepted || !transition.task) {
    return { ok: false, error: "当前下载任务状态不允许重新开始", task };
  }
  task = transition.task;

  const partialRecords = readPartialDownloadRecords();
  partialRecords[productId] = {
    productId,
    attemptId,
    url: plan.url,
    fileName: plan.fileName,
    downloadRoot,
    targetPath: canonicalTarget,
    totalBytes: reusable?.totalBytes || 0,
    updatedAt: new Date().toISOString()
  };
  writePartialDownloadRecords(partialRecords);

  const controller = new AbortController();
  const entry = {
    attemptId,
    controller,
    intent: "download",
    completion: null
  };
  activeDownloads.set(productId, entry);

  const taskSender = {
    send(channel, progress) {
      if (channel === "download:progress") {
        recordManagedDownloadProgress(productId, attemptId, progress);
      }
    }
  };

  const completionWork = (async () => {
    let completedResult = null;
    let committedRecord = null;
    try {
      const result = await downloadPackage(
        taskSender,
        {
          productId,
          url: plan.url,
          managedProductId: plan.managedProductId || undefined,
          allowedFinalHosts: plan.environmentId
            ? plan.allowedHosts
            : undefined
        },
        canonicalTarget,
        {
          controller,
          resumeAllowed: true,
          keepPartial: true,
          completePartialBytes:
            partialStartMode === "promote"
              ? reusable.totalBytes
              : undefined,
          isCurrentAttempt: () =>
            isCurrentDownloadAttempt(
              activeDownloads.get(productId),
              attemptId
            ),
          safetyReserveBytes: plan.safetyReserveBytes,
          installDiskBytes: plan.installDiskBytes,
          onMetadata: ({ receivedBytes, totalBytes }) => {
            const records = readPartialDownloadRecords();
            const receipt = records[productId];
            if (
              !receipt ||
              receipt.attemptId !== attemptId ||
              receipt.downloadRoot !== downloadRoot ||
              receipt.targetPath !== canonicalTarget
            ) {
              return;
            }
            records[productId] = {
              ...receipt,
              totalBytes,
              updatedAt: new Date().toISOString()
            };
            writePartialDownloadRecords(records);
            recordManagedDownloadProgress(productId, attemptId, {
              receivedBytes,
              totalBytes,
              bytesPerSecond: 0,
              etaSeconds: null,
              percent: totalBytes
                ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
                : null
            });
          }
        }
      );
      completedResult = result;
      if (plan.environmentId) {
        const environmentPlan = getEnvironmentPlan(plan.environmentId);
        const signature = await inspectSignature(result.filePath);
        environmentPlan.installedSigner.lastIndex = 0;
        if (
          signature.status !== "Valid" ||
          !environmentPlan.installedSigner.test(signature.signer)
        ) {
          const error = new Error(
            `${environmentPlan.name} 安装包数字签名校验未通过（状态：${signature.status}；发布者：${signature.signer || "未知"}）`
          );
          error.code = "ENVIRONMENT_SIGNATURE_INVALID";
          throw error;
        }
      }
      assertDownloadCanFinalize({
        receivedBytes: result.fileSize,
        totalBytes: result.fileSize,
        isCurrentAttempt: () =>
          isCurrentDownloadAttempt(
            activeDownloads.get(productId),
            attemptId
          )
      });
      const records = readDownloadRecords();
      const record = {
        productId,
        filePath: result.filePath,
        downloadRoot,
        sha256: result.sha256,
        fileSize: result.fileSize,
        resumedFrom: result.resumedFrom,
        downloadedAt: new Date().toISOString(),
        url: plan.url,
        source: plan.sourceLabel || ""
      };
      records[productId] = record;
      writeDownloadRecords(records);
      committedRecord = record;
      try {
        removePartialDownloadRecord(productId);
      } catch {
        // The completed record is the commit point; stale receipt cleanup is best effort.
      }
      return advanceManagedDownloadCompleted(
        productId,
        attemptId,
        record
      );
    } catch (error) {
      if (committedRecord) {
        try {
          return advanceManagedDownloadCompleted(
            productId,
            attemptId,
            committedRecord
          );
        } catch {
          return currentManagedDownloadTask(productId);
        }
      }
      const active = activeDownloads.get(productId);
      const intent =
        active?.attemptId === attemptId ? active.intent : entry.intent;
      const rollback = rollbackUncommittedManagedArtifact(
        productId,
        plan,
        completedResult?.filePath,
        intent,
        attemptId
      );
      if (intent === "cancel") {
        if (!rollback.ok) {
          return failManagedDownloadCancellation(
            productId,
            currentManagedDownloadTask(productId),
            rollback
          );
        }
        const cleanup = discardManagedPartialDownload(productId, plan);
        if (!cleanup.ok) {
          return failManagedDownloadCancellation(
            productId,
            currentManagedDownloadTask(productId),
            cleanup
          );
        }
        const canceled = advanceManagedDownloadTask(productId, {
          type: "cancel",
          attemptId
        });
        return canceled.task;
      }
      if (!rollback.ok) {
        const failed = advanceManagedDownloadTask(productId, {
          type: "failed",
          attemptId,
          resumable: false,
          errorCode: rollback.errorCode || "DOWNLOAD_ROLLBACK_FAILED",
          errorMessage: rollback.errorMessage,
          progress: taskProgressForPartial(
            currentManagedDownloadTask(productId),
            null
          )
        });
        return failed.task;
      }
      const partial = reusablePartialDownload(productId, plan);
      if (!partial) {
        discardManagedPartialDownload(productId, plan);
      }
      if (intent === "pause") {
        const paused = advanceManagedDownloadTask(productId, {
          type: "pause",
          attemptId,
          resumable: Boolean(partial),
          progress: taskProgressForPartial(
            currentManagedDownloadTask(productId),
            partial
          )
        });
        return paused.task;
      }
      const failed = advanceManagedDownloadTask(productId, {
        type: "failed",
        attemptId,
        resumable: Boolean(partial),
        errorCode: String(error?.code || "DOWNLOAD_FAILED"),
        errorMessage:
          error instanceof Error ? error.message : "安装包下载失败",
        progress: taskProgressForPartial(
          currentManagedDownloadTask(productId),
          partial
        )
      });
      const fallbackPlan =
        !partial &&
        ![
          "ENVIRONMENT_SIGNATURE_INVALID",
          "INSUFFICIENT_DISK_SPACE",
          "ENOSPC"
        ].includes(String(error?.code || ""))
          ? nextEnvironmentDownloadPlan(plan)
          : null;
      if (fallbackPlan && failed.accepted && failed.task) {
        const failedAttemptId = attemptId;
        setTimeout(() => {
          const current = currentManagedDownloadTask(productId);
          if (
            current?.phase === "failed" &&
            current.attemptId === failedAttemptId &&
            !activeDownloads.has(productId)
          ) {
            startManagedDownload(productId, fallbackPlan);
          }
        }, 0);
      }
      return failed.task;
    } finally {
      if (activeDownloads.get(productId)?.attemptId === attemptId) {
        activeDownloads.delete(productId);
      }
    }
  })();
  entry.completion = completionWork.catch((error) => {
    const current = currentManagedDownloadTask(productId);
    try {
      if (
        current?.attemptId === attemptId &&
        current.phase === "canceling"
      ) {
        return failManagedDownloadCancellation(productId, current, {
          ok: false,
          errorCode: "CANCEL_CLEANUP_FAILED",
          errorMessage:
            error instanceof Error
              ? `\u53d6\u6d88\u6e05\u7406\u5931\u8d25\uff1a${error.message}`
              : "\u53d6\u6d88\u6e05\u7406\u5931\u8d25",
          partial: reusablePartialDownload(productId, plan)
        });
      }
      if (
        current?.attemptId === attemptId &&
        ["starting", "downloading", "pausing"].includes(current.phase)
      ) {
        const partial = reusablePartialDownload(productId, plan);
        const failed = advanceManagedDownloadTask(productId, {
          type: "failed",
          attemptId,
          resumable: Boolean(partial),
          errorCode: "DOWNLOAD_TASK_INTERNAL_ERROR",
          errorMessage:
            error instanceof Error
              ? error.message
              : "\u4e0b\u8f7d\u4efb\u52a1\u5185\u90e8\u5931\u8d25",
          progress: taskProgressForPartial(current, partial)
        });
        return failed.accepted ? failed.task : current;
      }
    } catch {
      // Preserve the last known task instead of leaking an unhandled rejection.
    }
    return current;
  });

  return { ok: true, task };
}

function startManagedDownload(productId, overridePlan = null) {
  const plan = overridePlan || resolveManagedDownloadPlan(productId);
  if (!plan) {
    return { ok: false, error: "该产品不在客户端安装包白名单中" };
  }
  if (activeDownloads.has(productId)) {
    return {
      ok: false,
      error: "该产品正在下载中",
      task: currentManagedDownloadTask(productId)
    };
  }
  if (activeDownloads.size > 0) {
    return {
      ok: false,
      error: "已有安装包正在下载，请暂停或完成后再开始新的下载",
      task: reconcileManagedDownloadTask(productId)
    };
  }
  ensureEnvironmentDownloadDirectory();
  const partial = managedPartialDownload(productId, plan);
  const partialStartMode = classifyPartialForStart(partial);
  if (partialStartMode === "resume" || partialStartMode === "promote") {
    return beginManagedDownloadAttempt(
      productId,
      plan,
      partial.targetPath,
      partial
    );
  }
  const partialRecords = readPartialDownloadRecords();
  if (Object.prototype.hasOwnProperty.call(partialRecords, productId)) {
    const cleanup = discardManagedPartialDownload(productId, plan);
    if (!cleanup.ok) {
      return {
        ok: false,
        error: cleanup.errorMessage,
        task: reconcileManagedDownloadTask(productId)
      };
    }
  }
  const target = safeDownloadTarget(plan.fileName);
  return beginManagedDownloadAttempt(productId, plan, target, null);
}

async function pauseManagedDownload(productId) {
  const entry = activeDownloads.get(productId);
  if (!entry) {
    const task = reconcileManagedDownloadTask(productId);
    return task?.phase === "paused"
      ? { ok: true, task }
      : { ok: false, error: "当前没有可暂停的下载任务", task };
  }
  const requested = advanceManagedDownloadTask(productId, {
    type: "pause-requested",
    attemptId: entry.attemptId
  });
  if (!requested.accepted) {
    return {
      ok: false,
      error:
        "\u5f53\u524d\u4e0b\u8f7d\u72b6\u6001\u4e0d\u5141\u8bb8\u6682\u505c",
      task: requested.task
    };
  }
  entry.intent = raiseDownloadIntent(entry.intent, "pause");
  entry.controller.abort();
  const task = await entry.completion;
  return { ok: task?.phase === "paused", task };
}

async function discardManagedDownload(productId) {
  const plan = resolveManagedDownloadPlan(productId);
  if (!plan) {
    return { ok: false, error: "该产品不在客户端安装包白名单中" };
  }
  const task = reconcileManagedDownloadTask(productId);
  if (!task || task.phase === "completed") {
    return {
      ok: false,
      error: task ? "已完成的安装包不能通过取消任务删除" : "没有可取消的下载任务",
      task
    };
  }
  const partial = managedPartialDownload(productId, plan);
  const confirmation = await dialog.showMessageBox({
    type: "warning",
    title: "取消下载任务",
    message: "确认取消该下载任务并清除已保留的断点？",
    detail: partial?.receivedBytes
      ? `将删除已下载的 ${gigabytesForMessage(partial.receivedBytes)} 断点数据。`
      : "任务日志会保留，但下次下载将从头开始。",
    buttons: ["保留任务", "取消并清除断点"],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  if (confirmation.response !== 1) {
    return { ok: false, canceled: true, task };
  }

  const entry = activeDownloads.get(productId);
  const attemptId = entry?.attemptId || task.attemptId;
  const requested = advanceManagedDownloadTask(productId, {
    type: "cancel-requested",
    attemptId
  });
  if (!requested.accepted) {
    return {
      ok: false,
      error:
        "\u5f53\u524d\u4e0b\u8f7d\u72b6\u6001\u4e0d\u5141\u8bb8\u53d6\u6d88",
      task: requested.task
    };
  }
  if (entry) {
    entry.intent = raiseDownloadIntent(entry.intent, "cancel");
    entry.controller.abort();
    const canceled = await entry.completion;
    const ok = canceled?.phase === "canceled";
    return {
      ok,
      error: ok
        ? undefined
        : canceled?.phase === "completed"
          ? "\u4e0b\u8f7d\u5df2\u5b8c\u6210\uff0c\u53d6\u6d88\u672a\u751f\u6548"
          : canceled?.errorMessage ||
          "\u53d6\u6d88\u6e05\u7406\u5931\u8d25",
      task: canceled
    };
  }
  const cleanup = discardManagedPartialDownload(productId, plan);
  if (!cleanup.ok) {
    const failed = failManagedDownloadCancellation(
      productId,
      requested.task,
      cleanup
    );
    return { ok: false, error: failed.errorMessage, task: failed };
  }
  const canceled = advanceManagedDownloadTask(productId, {
    type: "cancel",
    attemptId
  });
  return { ok: canceled.accepted, task: canceled.task };
}

function ensureEnvironmentDownloadDirectory() {
  const settings = readSettings();
  if (
    typeof settings.downloadDirectory === "string" &&
    path.isAbsolute(settings.downloadDirectory)
  ) {
    return settings.downloadDirectory;
  }
  const downloadDirectory = path.join(app.getPath("downloads"), "AI Hub");
  fs.mkdirSync(downloadDirectory, { recursive: true });
  writeSettings({ ...settings, downloadDirectory });
  return downloadDirectory;
}

async function probeEnvironmentSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await net.fetch(source.url, {
      method: "GET",
      headers: {
        Range: "bytes=0-0",
        "User-Agent": DOWNLOAD_USER_AGENT
      },
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal
    });
    const finalUrl = new URL(response.url || source.url);
    const reachable =
      [200, 206].includes(response.status) &&
      finalUrl.protocol === "https:" &&
      source.allowedHosts.includes(finalUrl.hostname);
    response.body?.cancel().catch(() => {});
    return reachable;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifiedEnvironmentRecord(environmentId) {
  const plan = getEnvironmentPlan(environmentId);
  const managedRecord = trustedCompletedDownloadRecord(
    `environment:${environmentId}`
  );
  const legacyRecord = readEnvironmentDownloadRecords()[environmentId];
  const record = managedRecord
    ? {
        ...managedRecord,
        source: managedRecord.source || "可信下载源"
      }
    : legacyRecord;
  if (
    !plan ||
    !record ||
    typeof record.filePath !== "string" ||
    !path.isAbsolute(record.filePath) ||
    !fs.existsSync(record.filePath)
  ) {
    return null;
  }
  const digest = await fileSha256(record.filePath);
  if (digest !== record.sha256) return null;
  const signature = await inspectSignature(record.filePath);
  if (
    signature.status !== "Valid" ||
    !plan.installedSigner.test(signature.signer)
  ) {
    return null;
  }
  return { ...record, signature };
}

async function inspectCompletedDownloadRecord(productId) {
  const environmentId = environmentIdFromManagedDownload(productId);
  if (environmentId) {
    const record = await verifiedEnvironmentRecord(environmentId);
    return record
      ? {
          ok: true,
          record,
          sha256: record.sha256,
          signature: record.signature
        }
      : {
          ok: false,
          error: "安装包不存在、已被修改或数字签名无效，请重新下载"
        };
  }

  const record = trustedCompletedDownloadRecord(productId);
  if (!record) {
    return { ok: false, error: "未找到已下载的安装包" };
  }
  const digest = await fileSha256(record.filePath);
  if (digest !== record.sha256) {
    return { ok: false, error: "安装包已被修改，请重新下载" };
  }
  const signature = await inspectSignature(record.filePath);
  const expectedSigner = getStaticManagedDownload(productId)?.expectedSigner;
  if (!(expectedSigner instanceof RegExp)) {
    return {
      ok: false,
      record,
      sha256: digest,
      signature,
      error: "该安装包缺少客户端签发者安全契约"
    };
  }
  expectedSigner.lastIndex = 0;
  const signerAccepted =
    signature.status === "Valid" &&
    expectedSigner.test(signature.signer);
  return signerAccepted
    ? { ok: true, record, sha256: digest, signature }
    : {
        ok: false,
        record,
        sha256: digest,
        signature,
        error:
          signature.status === "Valid"
            ? "安装包签发者与产品安全契约不匹配"
            : "安装包数字签名无效或无法验证"
      };
}

async function clearCompletedDownloadHistory(productId, confirm = true) {
  if (!resolveManagedDownloadPlan(productId)) {
    return { ok: false, error: "该产品不在客户端安装包白名单中" };
  }
  if (activeDownloads.has(productId)) {
    return { ok: false, error: "下载仍在进行，不能清除完成记录" };
  }
  const task = reconcileManagedDownloadTask(productId);
  if (!task || task.phase !== "completed") {
    return { ok: false, error: "没有可清除的已完成下载记录", task };
  }

  const records = readDownloadRecords();
  const record = records[productId];
  if (confirm) {
    const confirmation = await dialog.showMessageBox({
      type: "question",
      title: "清除下载记录",
      message: "确认从 AI Hub 下载任务中清除这条完成记录？",
      detail:
        "只清除任务和验证记录，不会删除电脑上的安装包文件。之后如需再次安装，请从原文件位置打开或重新下载。",
      buttons: ["保留记录", "清除记录"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) {
      return { ok: false, canceled: true, task };
    }
  }

  loadManagedDownloadTasks();
  const previousTask = managedDownloadTasks.get(productId);
  const environmentId = environmentIdFromManagedDownload(productId);
  const legacyRecords = environmentId ? readEnvironmentDownloadRecords() : null;
  const previousLegacyRecord = legacyRecords?.[environmentId];
  try {
    managedDownloadTasks.delete(productId);
    writeManagedDownloadTasks();
    delete records[productId];
    writeDownloadRecords(records);
    if (legacyRecords && previousLegacyRecord) {
      delete legacyRecords[environmentId];
      writeEnvironmentDownloadRecords(legacyRecords);
    }
  } catch (error) {
    if (previousTask) managedDownloadTasks.set(productId, previousTask);
    if (record) records[productId] = record;
    if (legacyRecords && previousLegacyRecord) {
      legacyRecords[environmentId] = previousLegacyRecord;
    }
    try {
      writeManagedDownloadTasks();
      writeDownloadRecords(records);
      if (legacyRecords && previousLegacyRecord) {
        writeEnvironmentDownloadRecords(legacyRecords);
      }
    } catch {
      // Existing completion evidence remains recoverable on the next lookup.
    }
    return {
      ok: false,
      error:
        error instanceof Error
          ? `无法清除下载记录：${error.message}`
          : "无法清除下载记录",
      task: previousTask || task
    };
  }
  downloadTaskLastPersistedAt.delete(productId);
  downloadTaskLastEmittedAt.delete(productId);
  return {
    ok: true,
    filePath:
      record && typeof record.filePath === "string" ? record.filePath : "",
    task: null
  };
}

async function clearAllCompletedDownloadHistories() {
  loadManagedDownloadTasks();
  const productIds = [...managedDownloadTasks.values()]
    .filter((task) => task.phase === "completed")
    .map((task) => task.productId);
  if (!productIds.length) {
    return { ok: true, clearedProductIds: [], errors: [] };
  }
  const confirmation = await dialog.showMessageBox({
    type: "question",
    title: "清除全部已完成任务",
    message: `确认清除 ${productIds.length} 条已完成下载记录？`,
    detail:
      "只清除 AI Hub 的任务和验证记录，不会删除电脑上的安装包文件。",
    buttons: ["保留记录", "全部清除"],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  if (confirmation.response !== 1) {
    return {
      ok: false,
      canceled: true,
      clearedProductIds: [],
      errors: []
    };
  }
  const clearedProductIds = [];
  const errors = [];
  for (const productId of productIds) {
    const result = await clearCompletedDownloadHistory(productId, false);
    if (result.ok) clearedProductIds.push(productId);
    else errors.push({ productId, error: result.error || "无法清除下载记录" });
  }
  return {
    ok: errors.length === 0,
    clearedProductIds,
    errors
  };
}

async function locateWithStatus(command) {
  try {
    const { stdout } = await execFileAsync("where.exe", [command], {
      windowsHide: true,
      timeout: 5000
    });
    const candidates = stdout
      .split(/\r?\n/)
      .map((candidate) => candidate.trim())
      .filter(Boolean);
    const location =
      candidates.find(
        (candidate) => path.isAbsolute(candidate) && fs.existsSync(candidate)
      ) || "";
    return {
      ok: Boolean(location) || candidates.length === 0,
      location
    };
  } catch (error) {
    const message = `${error?.stdout || ""}\n${error?.stderr || ""}\n${error?.message || ""}`;
    const notFound =
      Number(error?.code) === 1 &&
      !error?.killed &&
      /could not find|cannot find|not found|找不到/i.test(message);
    return notFound
      ? { ok: true, location: "" }
      : { ok: false, location: "" };
  }
}

async function locate(command) {
  return (await locateWithStatus(command)).location;
}

function identitySessionPath() {
  return path.join(app.getPath("userData"), "identity-session.bin");
}

function identityVault() {
  return {
    read() {
      try {
        const encrypted = fs.readFileSync(identitySessionPath());
        if (!safeStorage.isEncryptionAvailable()) return null;
        return JSON.parse(safeStorage.decryptString(encrypted));
      } catch {
        return null;
      }
    },
    write(value) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("Windows 安全凭据存储暂时不可用");
      }
      const target = identitySessionPath();
      const temporary = `${target}.${process.pid}.tmp`;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(
        temporary,
        safeStorage.encryptString(JSON.stringify(value))
      );
      const previous = `${target}.previous`;
      fs.rmSync(previous, { force: true });
      if (fs.existsSync(target)) {
        fs.renameSync(target, previous);
      }
      try {
        fs.renameSync(temporary, target);
        fs.rmSync(previous, { force: true });
      } catch (error) {
        if (!fs.existsSync(target) && fs.existsSync(previous)) {
          fs.renameSync(previous, target);
        }
        throw error;
      }
    },
    clear() {
      fs.rmSync(identitySessionPath(), { force: true });
    }
  };
}

async function identityRequest(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await net.fetch(url, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal
    });
    const text = await readResponseTextWithLimit(response, 256 * 1024);
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error("身份服务返回了无效响应");
    }
    if (!response.ok) {
      const error = new Error(value.message || "身份服务请求失败");
      error.code = value.error || "TEMPORARILY_UNAVAILABLE";
      error.status = response.status;
      throw error;
    }
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

function getIdentityClient() {
  if (identityClientInstance) return identityClientInstance;
  identityClientInstance = createIdentityClient({
    origin:
      process.env.AIHUB_IDENTITY_ORIGIN || "http://127.0.0.1:4180",
    request: identityRequest,
    vault: identityVault(),
    deviceId: clientIdToDeviceId(releaseClientId()),
    deviceName: os.hostname() || "Windows PC"
  });
  return identityClientInstance;
}

function registerIpc() {
  ipcMain.handle("catalog:get", async () => {
    const result = await resolveCatalog();
    activeEnvironmentSourcePreferences =
      result.catalog?.environmentDownloads?.sources;
    return result;
  });
  ipcMain.handle("update:check", () => checkForUpdate());
  ipcMain.handle("identity:current", () => getIdentityClient().current());
  ipcMain.handle("identity:request-code", (_event, email) =>
    getIdentityClient().requestRegistrationCode(email)
  );
  ipcMain.handle("identity:register", (_event, input) =>
    getIdentityClient().register(input)
  );
  ipcMain.handle("identity:login", (_event, input) =>
    getIdentityClient().login(input)
  );
  ipcMain.handle("identity:logout", () => getIdentityClient().logout());
  ipcMain.handle("identity:list-sessions", () =>
    getIdentityClient().listSessions()
  );
  ipcMain.handle("identity:revoke-session", (_event, sessionId) =>
    getIdentityClient().revokeSession(sessionId)
  );
  ipcMain.handle("identity:update-profile", (_event, input) =>
    getIdentityClient().updateProfile(input)
  );
  ipcMain.handle("community:open", async () => {
    const handoff = await getIdentityClient().createCommunityHandoff();
    const launchUrl = new URL(handoff.launchUrl);
    const approvedOrigin =
      process.env.AIHUB_COMMUNITY_PUBLIC_ORIGIN ||
      "http://127.0.0.1:8088";
    if (
      launchUrl.origin !== new URL(approvedOrigin).origin ||
      launchUrl.pathname !== "/aihub-sso.php" ||
      !launchUrl.searchParams.get("ticket") ||
      launchUrl.username ||
      launchUrl.password ||
      launchUrl.hash
    ) {
      throw new Error("社区登录地址未通过客户端校验");
    }
    await shell.openExternal(launchUrl.href);
    return { ok: true, expiresAt: handoff.expiresAt };
  });
  ipcMain.handle("update:open-download", async (event) => {
    const offer = lastVerifiedUpdateOffer;
    if (!offer || offer.expiresAt < Date.now()) {
      lastVerifiedUpdateOffer = null;
      return {
        ok: false,
        stage: "offer",
        error: "更新信息已过期，请重新检查更新"
      };
    }

    let plan;
    try {
      const channel = readUpdateChannel();
      if (channel.error) throw new Error(channel.error);
      const updateRoot = path.join(app.getPath("userData"), "updates");
      plan = planUpdateInstallerDownload(offer, channel, updateRoot);
      fs.mkdirSync(updateRoot, { recursive: true });
      const rootStat = fs.lstatSync(updateRoot);
      if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
        throw new Error("客户端更新目录不安全");
      }
      if (fs.existsSync(plan.target)) {
        const existing = fs.lstatSync(plan.target);
        if (!existing.isFile() || existing.isSymbolicLink()) {
          throw new Error("现有更新安装包路径不安全");
        }
        fs.rmSync(plan.target);
      }

      const result = await downloadPackage(
        event.sender,
        {
          productId: plan.productId,
          url: plan.url,
          allowedFinalOrigins: plan.allowedFinalOrigins
        },
        plan.target,
        {
          resumeAllowed: true,
          keepPartial: true,
          safetyReserveBytes: 512 * 1024 * 1024,
          isCurrentAttempt: () =>
            lastVerifiedUpdateOffer === offer &&
            offer.expiresAt >= Date.now()
        }
      );
      const verified = verifyUpdateInstallerDownload(result, plan);
      const confirmation = await dialog.showMessageBox({
        type: "warning",
        title: "安装 AI Hub 更新",
        message: `AI Hub ${offer.version} 已下载并通过完整性校验`,
        detail: [
          `安装包：${path.basename(verified.filePath)}`,
          `SHA-256：${verified.sha256}`,
          "点击“安装更新”后将启动 Windows 安装器。"
        ].join("\n"),
        buttons: ["取消", "安装更新"],
        defaultId: 1,
        cancelId: 0,
        noLink: true
      });
      if (confirmation.response !== 1) {
        return {
          ok: false,
          stage: "confirmation",
          canceled: true,
          filePath: verified.filePath,
          error: "更新安装已取消，安装包仍保留在本机"
        };
      }

      const launch = await launchProcessWithGrace({
        command: verified.filePath,
        graceMs: 2_000,
        env: isolatedThirdPartyEnvironment(),
        processLabel: "AI Hub 更新安装器"
      });
      if (!launch.launched) {
        return {
          ok: false,
          stage: "launch",
          filePath: verified.filePath,
          error: launch.error || "Windows 未能启动更新安装器"
        };
      }
      lastVerifiedUpdateOffer = null;
      return {
        ok: true,
        stage: "launched",
        filePath: verified.filePath,
        warning: launch.warning || ""
      };
    } catch (error) {
      if (plan?.target) {
        try {
          if (fs.existsSync(plan.target)) fs.rmSync(plan.target);
        } catch {
          // The fixed update path remains quarantined until the next attempt.
        }
      }
      return {
        ok: false,
        stage: "download",
        error:
          error instanceof Error ? error.message : "更新安装包下载失败"
      };
    }
  });
  ipcMain.handle("settings:get", () => readSettings());

  ipcMain.handle("settings:choose-download-directory", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择安装包下载位置",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) {
      return { ...readSettings(), selectionCanceled: true };
    }
    const settings = {
      ...readSettings(),
      downloadDirectory: result.filePaths[0]
    };
    writeSettings(settings);
    return { ...settings, selectionCanceled: false };
  });

  ipcMain.handle("settings:choose-cli-directory", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择 CLI 工具安装位置",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) {
      return readSettings();
    }
    const settings = {
      ...readSettings(),
      cliInstallDirectory: result.filePaths[0]
    };
    writeSettings(settings);
    return settings;
  });

  ipcMain.handle("settings:open-download-directory", async () => {
    const target = readSettings().downloadDirectory;
    if (!target || !path.isAbsolute(target) || !fs.existsSync(target)) {
      return false;
    }
    return (await shell.openPath(target)) === "";
  });

  ipcMain.handle("settings:clear-download-directory", () => {
    const settings = { ...readSettings(), downloadDirectory: "" };
    writeSettings(settings);
    return settings;
  });

  ipcMain.handle("environment:scan", () => scanEnvironment());

  ipcMain.handle("environment:open-location", async (_event, environmentId) => {
    if (!getEnvironmentPlan(environmentId)) return false;
    const status = await detectEnvironmentOperationStatus(environmentId);
    if (!status.installed || !status.executable) {
      return false;
    }
    shell.showItemInFolder(status.executable);
    return true;
  });

  ipcMain.handle("environment:install", async (_event, environmentId) => {
    const environmentPlan = getEnvironmentPlan(environmentId);
    if (!environmentPlan) {
      return { downloaded: false, error: "该环境不在客户端白名单中" };
    }
    const entryKey = `environment:${environmentId}`;
    const operationTask =
      getEnvironmentOperationController().get(environmentId);
    if (operationTask) {
      return {
        downloaded: false,
        busy: true,
        operationTask,
        error:
          operationTask.operation === "uninstall"
            ? "该环境仍在确认卸载结果，不能同时下载安装包"
            : "该环境安装程序已打开，正在确认安装结果"
      };
    }
    if (
      activeEnvironmentDownloads.has(environmentId) ||
      activeDesktopOperationEntries.has(entryKey)
    ) {
      return { downloaded: false, busy: true, error: "该环境操作正在进行" };
    }
    activeEnvironmentDownloads.add(environmentId);
    activeDesktopOperationEntries.add(entryKey);
    try {
      const existing = await verifiedEnvironmentRecord(environmentId);
      if (existing) {
        return {
          downloaded: true,
          filePath: existing.filePath,
          source: existing.source,
          message: `${environmentPlan.name} 安装包已下载，可以点击“打开安装包”`
        };
      }

      const currentTask = reconcileManagedDownloadTask(entryKey);
      const persistedPlan = resolveManagedDownloadPlan(entryKey);
      const partial = persistedPlan
        ? managedPartialDownload(entryKey, persistedPlan)
        : null;
      let selectedPlan = persistedPlan;
      if (!partial && !activeDownloads.has(entryKey)) {
        const downloadPlan = getEnvironmentDownloadPlan(
          environmentId,
          activeEnvironmentSourcePreferences
        );
        const source = await selectReachableSource(
          downloadPlan,
          probeEnvironmentSource
        );
        selectedPlan = resolveManagedDownloadPlan(entryKey, source.url);
      }
      if (!selectedPlan) {
        throw new Error("环境安装包下载源记录无效，无法安全继续");
      }
      const started = startManagedDownload(entryKey, selectedPlan);
      if (!started.ok) {
        return {
          downloaded: false,
          busy: activeDownloads.has(entryKey),
          task: started.task || currentTask,
          error: started.error
        };
      }
      return {
        downloaded: false,
        task: started.task,
        source: selectedPlan.sourceLabel,
        message:
          partial?.receivedBytes > 0
            ? `正在从断点继续下载 ${environmentPlan.name}`
            : `已选择${selectedPlan.sourceLabel}，正在下载 ${environmentPlan.name}`
      };
    } catch (error) {
      return {
        downloaded: false,
        error:
          error instanceof Error
            ? error.message
            : `无法下载 ${environmentPlan.name} 安装包`
      };
    } finally {
      activeEnvironmentDownloads.delete(environmentId);
      activeDesktopOperationEntries.delete(entryKey);
    }
  });

  ipcMain.handle("environment:package-get", async (_event, environmentId) => {
    const plan = getEnvironmentPlan(environmentId);
    if (!plan) return null;
    const record = await verifiedEnvironmentRecord(environmentId);
    return record
      ? {
          ready: true,
          filePath: record.filePath,
          source: record.source,
          message: `${plan.name} 安装包已验证，可以点击“打开安装包”`
        }
      : { ready: false };
  });

  ipcMain.handle("environment:operation-get", (_event, environmentId) =>
    getEnvironmentPlan(environmentId)
      ? getEnvironmentOperationController().get(environmentId)
      : null
  );

  ipcMain.handle(
    "environment:operation-check",
    (_event, environmentId, generation, operationId) =>
      Boolean(getEnvironmentPlan(environmentId)) &&
      Number.isSafeInteger(generation) &&
      generation > 0 &&
      typeof operationId === "string" &&
      operationId.trim() === operationId &&
      operationId.length > 0
        ? getEnvironmentOperationController().checkNow(
            environmentId,
            generation,
            operationId
          )
        : null
  );

  ipcMain.handle(
    "environment:open-installer",
    async (_event, environmentId) => {
      const plan = getEnvironmentPlan(environmentId);
      if (!plan) {
        return { launched: false, error: "该环境不在客户端白名单中" };
      }
      const operationController = getEnvironmentOperationController();
      const existingOperation = operationController.get(environmentId);
      if (existingOperation) {
        return {
          launched: false,
          busy: true,
          operationTask: existingOperation,
          error:
            existingOperation.operation === "uninstall"
              ? "该环境仍在确认卸载结果，不能同时打开安装程序"
              : "该环境仍在自动确认安装结果，无需重复打开安装程序"
        };
      }
      const entryKey = `environment:${environmentId}`;
      if (activeDesktopOperationEntries.has(entryKey)) {
        return {
          launched: false,
          busy: true,
          error: "该环境操作正在准备，请勿重复点击"
        };
      }
      activeDesktopOperationEntries.add(entryKey);
      let operationTask = null;
      let processSpawned = false;
      try {
        const record = await verifiedEnvironmentRecord(environmentId);
        if (!record) {
          return {
            launched: false,
            error: "安装包不存在、已被修改或数字签名无效，请重新下载"
          };
        }
        const isMsi = /\.msi$/i.test(record.filePath);
        const command = isMsi
          ? path.join(
              process.env.SystemRoot || "C:\\Windows",
              "System32",
              "msiexec.exe"
            )
          : record.filePath;
        const args = isMsi ? ["/i", record.filePath] : [];
        if (!fs.existsSync(command)) {
          return {
            launched: false,
            error: `${plan.name} 安装程序启动路径不存在`
          };
        }
        const baselineStatus =
          await detectEnvironmentOperationStatus(environmentId);
        if (baselineStatus.detection === "installed") {
          return {
            launched: false,
            error: `${plan.name} 已安装；为避免把升级或取消误判为首次安装，客户端不会重复打开该安装包`
          };
        }
        if (baselineStatus.detection !== "absent") {
          return {
            launched: false,
            error: `暂时无法可靠确认 ${plan.name} 是否已安装，请稍后重新检测`
          };
        }

        operationTask = operationController.begin(environmentId, "install");
        const identity = {
          generation: operationTask.generation,
          operationId: operationTask.operationId
        };
        const finishLaunch = (launched) => {
          operationTask = operationController.finishLaunch(
            environmentId,
            identity.generation,
            identity.operationId,
            launched
          );
          return operationTask;
        };
        const launchResult = await launchProcessWithGrace({
          command,
          args,
          graceMs: 2_000,
          env: isolatedThirdPartyEnvironment(),
          processLabel: `${plan.name} 安装程序`,
          onSpawn: () => {
            processSpawned = true;
            finishLaunch(true);
          }
        });
        if (!launchResult.launched) {
          let cleanupWarning = "";
          try {
            finishLaunch(false);
          } catch (cleanupError) {
            operationTask = operationController.get(environmentId);
            cleanupWarning =
              cleanupError instanceof Error
                ? `；且无法清理操作记录：${cleanupError.message}`
                : "；且无法清理操作记录";
          }
          return {
            ...launchResult,
            operationTask,
            error: `${launchResult.error || `无法打开 ${plan.name} 安装程序`}${cleanupWarning}`
          };
        }
        let persistenceWarning = launchResult.warning || "";
        try {
          if (operationTask?.phase === "launching") finishLaunch(true);
        } catch (verificationError) {
          operationTask = operationController.get(environmentId);
          const message =
            verificationError instanceof Error
              ? `自动检测任务暂时无法更新：${verificationError.message}`
              : "自动检测任务暂时无法更新";
          persistenceWarning = persistenceWarning
            ? `${persistenceWarning}；${message}`
            : message;
        }
        return {
          ...launchResult,
          operationTask:
            operationController.get(environmentId) || operationTask,
          warning: persistenceWarning || undefined,
          message: `已打开 ${plan.name} 安装程序，正在自动确认安装结果`
        };
      } catch (error) {
        if (operationTask && !processSpawned) {
          try {
            operationTask = operationController.finishLaunch(
              environmentId,
              operationTask.generation,
              operationTask.operationId,
              false
            );
          } catch {
            operationTask = operationController.get(environmentId);
          }
        }
        return {
          launched: false,
          operationTask,
          error:
            error instanceof Error && error.message
              ? `无法打开 ${plan.name} 安装程序：${error.message}`
              : `无法打开 ${plan.name} 安装程序`
        };
      } finally {
        activeDesktopOperationEntries.delete(entryKey);
      }
    }
  );

  ipcMain.handle("environment:uninstall", async (_event, environmentId) => {
    const plan = getEnvironmentPlan(environmentId);
    if (!plan) {
      return { launched: false, error: "该环境不在客户端卸载白名单中" };
    }
    const operationController = getEnvironmentOperationController();
    const existingOperation = operationController.get(environmentId);
    if (existingOperation) {
      return {
        launched: false,
        busy: true,
        operationTask: existingOperation,
        error:
          existingOperation.operation === "install"
            ? "该环境仍在确认安装结果，不能同时启动卸载程序"
            : "该环境仍在确认卸载结果，无需重复启动卸载程序"
      };
    }
    const entryKey = `environment:${environmentId}`;
    if (activeDesktopOperationEntries.has(entryKey)) {
      return {
        launched: false,
        busy: true,
        error: "该环境操作正在准备，请勿重复点击"
      };
    }
    activeDesktopOperationEntries.add(entryKey);
    let operationTask = null;
    let processSpawned = false;
    try {
      const [registryScan, evidence] = await Promise.all([
        scanRegistryAppsWithStatus(),
        locateEnvironment(environmentId, plan)
      ]);
      if (!registryScan.ok) {
        return {
          launched: false,
          error: "Windows 卸载项扫描不完整，请稍后重新检测"
        };
      }
      const uninstallRecord = await trustedEnvironmentUninstallRecord(
        environmentId,
        registryScan.entries
      );
      const status = await environmentStatusFromScan(
        environmentId,
        evidence,
        registryScan
      );
      if (!status.installed || !uninstallRecord) {
        return {
          launched: false,
          error: "未找到可信的 Windows 卸载项，已拒绝执行"
        };
      }
      const { entry, action } = uninstallRecord;

      const confirmation = await dialog.showMessageBox({
        type: "warning",
        title: `卸载 ${plan.name}`,
        message: `确认打开 ${plan.name} 的官方卸载程序？`,
        detail: [
          `Windows 登记名称：${entry.displayname}`,
          `发布者：${entry.publisher}`,
          "卸载程序打开不代表卸载已经完成；AI Hub 会继续确认可信安装证据是否消失。"
        ].join("\n"),
        buttons: ["取消", "继续卸载"],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      if (confirmation.response !== 1) {
        return { launched: false, canceled: true };
      }

      const finalRegistryScan = await scanRegistryAppsWithStatus();
      if (!finalRegistryScan.ok) {
        return {
          launched: false,
          error: "卸载项在确认期间无法重新验证，已拒绝执行"
        };
      }
      const finalEvidence = await locateEnvironment(environmentId, plan);
      const finalStatus = await environmentStatusFromScan(
        environmentId,
        finalEvidence,
        finalRegistryScan
      );
      const finalRecord = await trustedEnvironmentUninstallRecord(
        environmentId,
        finalRegistryScan.entries
      );
      const finalEntry = finalRecord?.entry || null;
      const finalAction = finalRecord?.action || null;
      if (
        !finalStatus.installed ||
        !finalEntry ||
        !finalAction ||
        finalEntry.key !== entry.key ||
        finalAction.kind !== action.kind ||
        finalAction.executable.toLowerCase() !==
          action.executable.toLowerCase() ||
        JSON.stringify(finalAction.args) !== JSON.stringify(action.args)
      ) {
        return {
          launched: false,
          error: "卸载程序在确认期间发生变化，已拒绝执行"
        };
      }

      const command = finalAction.executable;
      if (!fs.existsSync(command)) {
        return {
          launched: false,
          error: `${plan.name} 卸载程序不存在`
        };
      }
      operationTask = operationController.begin(environmentId, "uninstall");
      const identity = {
        generation: operationTask.generation,
        operationId: operationTask.operationId
      };
      const finishLaunch = (launched) => {
        operationTask = operationController.finishLaunch(
          environmentId,
          identity.generation,
          identity.operationId,
          launched
        );
        return operationTask;
      };
      const launchResult = await launchProcessWithGrace({
        command,
        args: finalAction.args,
        graceMs: 2_000,
        env: isolatedThirdPartyEnvironment(),
        processLabel: `${plan.name} 卸载程序`,
        onSpawn: () => {
          processSpawned = true;
          finishLaunch(true);
        }
      });
      if (!launchResult.launched) {
        let cleanupWarning = "";
        try {
          finishLaunch(false);
        } catch (cleanupError) {
          operationTask = operationController.get(environmentId);
          cleanupWarning =
            cleanupError instanceof Error
              ? `；且无法清理操作记录：${cleanupError.message}`
              : "；且无法清理操作记录";
        }
        return {
          ...launchResult,
          operationTask,
          error: `${launchResult.error || `无法打开 ${plan.name} 卸载程序`}${cleanupWarning}`
        };
      }
      let persistenceWarning = launchResult.warning || "";
      try {
        if (operationTask?.phase === "launching") finishLaunch(true);
      } catch (verificationError) {
        operationTask = operationController.get(environmentId);
        const message =
          verificationError instanceof Error
            ? `自动卸载检测任务暂时无法更新：${verificationError.message}`
            : "自动卸载检测任务暂时无法更新";
        persistenceWarning = persistenceWarning
          ? `${persistenceWarning}；${message}`
          : message;
      }
      return {
        ...launchResult,
        operationTask:
          operationController.get(environmentId) || operationTask,
        warning: persistenceWarning || undefined,
        message: `已打开 ${plan.name} 卸载程序，正在自动确认卸载结果`
      };
    } catch (error) {
      if (operationTask && !processSpawned) {
        try {
          operationTask = operationController.finishLaunch(
            environmentId,
            operationTask.generation,
            operationTask.operationId,
            false
          );
        } catch {
          operationTask = operationController.get(environmentId);
        }
      }
      return {
        launched: false,
        operationTask,
        error:
          error instanceof Error && error.message
            ? `无法打开 ${plan.name} 卸载程序：${error.message}`
            : `无法打开 ${plan.name} 卸载程序`
      };
    } finally {
      activeDesktopOperationEntries.delete(entryKey);
    }
  });

  ipcMain.handle("download:start", (_event, productId) => {
    try {
      if (typeof productId !== "string") {
        return { ok: false, error: "下载产品 ID 无效" };
      }
      return startManagedDownload(productId);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "无法启动下载任务",
        task:
          typeof productId === "string"
            ? reconcileManagedDownloadTask(productId)
            : null
      };
    }
  });

  ipcMain.handle("download:pause", (_event, productId) =>
    typeof productId === "string"
      ? pauseManagedDownload(productId)
      : { ok: false, error: "下载产品 ID 无效" }
  );

  ipcMain.handle("download:discard", (_event, productId) =>
    typeof productId === "string"
      ? discardManagedDownload(productId)
      : { ok: false, error: "下载产品 ID 无效" }
  );

  ipcMain.handle("download:get-task", (_event, productId) =>
    typeof productId === "string"
      ? reconcileManagedDownloadTask(productId)
      : null
  );

  ipcMain.handle("download:get-partial", (_event, productId) => {
    if (typeof productId !== "string") return null;
    const plan = resolveManagedDownloadPlan(productId);
    return plan ? reusablePartialDownload(productId, plan) : null;
  });

  ipcMain.handle("download:get-record", (_event, productId) => {
    return typeof productId === "string"
      ? trustedCompletedDownloadRecord(productId)
      : null;
  });

  ipcMain.handle("download:show-in-folder", async (_event, productId) => {
    if (typeof productId !== "string") {
      return { ok: false, error: "下载产品 ID 无效" };
    }
    try {
      const inspected = await inspectCompletedDownloadRecord(productId);
      if (!inspected.ok || !inspected.record) return inspected;
      shell.showItemInFolder(inspected.record.filePath);
      return { ok: true, filePath: inspected.record.filePath };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `无法打开安装包所在文件夹：${error.message}`
            : "无法打开安装包所在文件夹"
      };
    }
  });

  ipcMain.handle("download:clear-history", (_event, productId) =>
    typeof productId === "string"
      ? clearCompletedDownloadHistory(productId)
      : { ok: false, error: "下载产品 ID 无效" }
  );
  ipcMain.handle("download:clear-completed", () =>
    clearAllCompletedDownloadHistories()
  );

  ipcMain.handle("installer:inspect", async (_event, productId) => {
    if (typeof productId !== "string") {
      return { ok: false, error: "安装产品 ID 无效" };
    }
    const inspected = await inspectCompletedDownloadRecord(productId);
    const signature = inspected.signature || { status: "", signer: "" };
    return {
      ok: inspected.ok,
      sha256: inspected.sha256,
      signatureStatus: signature.status,
      signer: signature.signer,
      filePath: inspected.record?.filePath,
      error: inspected.error || ""
    };
  });

  ipcMain.handle("installer:launch", async (_event, productId) => {
    if (typeof productId !== "string") {
      return { launched: false, error: "安装产品 ID 无效" };
    }
    const downloadTask = currentManagedDownloadTask(productId);
    if (downloadTask && downloadTask.phase !== "completed") {
      return {
        launched: false,
        busy: true,
        error: "该产品的安装包任务尚未完成，不能同时启动安装程序"
      };
    }
    const operationController = getDesktopOperationController();
    let existingOperation = null;
    try {
      existingOperation = operationController.get(productId);
    } catch (error) {
      console.error("Unable to restore desktop operation", error);
    }
    if (existingOperation) {
      return {
        launched: false,
        busy: true,
        error:
          existingOperation.operation === "uninstall"
            ? "该产品仍在自动确认卸载结果，不能同时启动安装程序"
            : "该产品仍在自动检测安装结果，无需重复启动安装程序",
        operationTask: existingOperation
      };
    }
    if (activeDesktopOperationEntries.has(productId)) {
      return {
        launched: false,
        busy: true,
        error: "该产品的桌面操作正在准备，请勿重复点击"
      };
    }
    activeDesktopOperationEntries.add(productId);
    let operationTask = null;
    let processSpawned = false;
    try {
      const record = trustedCompletedDownloadRecord(productId);
      if (!record) {
        return { launched: false, error: "未找到可信安装包记录" };
      }
      const filePath = record.filePath;
      const resolvedFile = path.resolve(filePath);
      if (
        !path.isAbsolute(filePath) ||
        !/\.(exe|msi|msix)$/i.test(resolvedFile) ||
        !fs.existsSync(resolvedFile)
      ) {
        return { launched: false, error: "安装包路径验证失败" };
      }

      const digest = await fileSha256(resolvedFile);
      if (digest !== record.sha256) {
        return { launched: false, error: "安装包已被修改，请重新下载" };
      }
      const signature = await inspectSignature(resolvedFile);
      const expectedSigner = getStaticManagedDownload(productId)?.expectedSigner;
      if (!(expectedSigner instanceof RegExp)) {
        return {
          launched: false,
          error: "该安装包缺少客户端签发者安全契约，已拒绝打开"
        };
      }
      expectedSigner.lastIndex = 0;
      if (
        signature.status !== "Valid" ||
        !expectedSigner.test(signature.signer)
      ) {
        return {
          launched: false,
          error: "数字签名验证未通过，已拒绝打开安装包"
        };
      }

      const confirmation = await dialog.showMessageBox({
        type: "warning",
        title: "运行安装程序",
        message: `即将运行 ${path.basename(resolvedFile)}`,
        detail: [
          `签发者：${signature.signer || "未知"}`,
          `SHA-256：${digest}`,
          "Windows 接收打开请求不代表软件已经安装成功。"
        ].join("\n"),
        buttons: ["取消", "运行安装程序"],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      if (confirmation.response !== 1) {
        return { launched: false, canceled: true };
      }

      operationTask = operationController.begin(productId, "install");
      const identity = {
        generation: operationTask.generation,
        operationId: operationTask.operationId
      };
      const finishLaunch = (launched) => {
        const nextTask = operationController.finishLaunch(
          productId,
          identity.generation,
          identity.operationId,
          launched
        );
        operationTask = nextTask;
        return nextTask;
      };

      let launchResult;
      if (/\.exe$/i.test(resolvedFile)) {
        launchResult = await launchProcessWithGrace({
          command: resolvedFile,
          graceMs: 2_000,
          env: isolatedThirdPartyEnvironment(),
          processLabel: "安装程序",
          onSpawn: () => {
            processSpawned = true;
            finishLaunch(true);
          }
        });
      } else {
        const openError = await shell.openPath(resolvedFile);
        processSpawned = !openError;
        launchResult = openError
          ? { launched: false, error: openError }
          : { launched: true, exitCode: null, error: "" };
      }

      if (!launchResult.launched) {
        let cleanupWarning = "";
        try {
          finishLaunch(false);
        } catch (cleanupError) {
          operationTask = operationController.get(productId);
          cleanupWarning =
            cleanupError instanceof Error
              ? `；且无法清理操作记录：${cleanupError.message}`
              : "；且无法清理操作记录";
        }
        return {
          ...launchResult,
          operationTask,
          error: `${launchResult.error || "安装程序未能保持运行"}${cleanupWarning}`
        };
      }

      let persistenceWarning = launchResult.warning || "";
      try {
        if (operationTask?.phase === "launching") {
          finishLaunch(true);
        }
      } catch (verificationError) {
        operationTask = operationController.get(productId);
        const message =
          verificationError instanceof Error
            ? `自动检测任务暂时无法更新：${verificationError.message}`
            : "自动检测任务暂时无法更新";
        persistenceWarning = persistenceWarning
          ? `${persistenceWarning}；${message}`
          : message;
      }
      return {
        ...launchResult,
        operationTask: operationController.get(productId) || operationTask,
        warning: persistenceWarning || undefined
      };
    } catch (error) {
      if (operationTask && !processSpawned) {
        try {
          operationTask = operationController.finishLaunch(
            productId,
            operationTask.generation,
            operationTask.operationId,
            false
          );
        } catch {
          operationTask = operationController.get(productId);
        }
      }
      return {
        launched: false,
        operationTask,
        error:
          error instanceof Error && error.message
            ? `无法打开安装程序：${error.message}`
            : "无法打开安装程序"
      };
    } finally {
      activeDesktopOperationEntries.delete(productId);
    }
  });

  ipcMain.handle("desktop:operation-get", (_event, productId) =>
    typeof productId === "string"
      ? getDesktopOperationController().get(productId)
      : null
  );

  ipcMain.handle(
    "desktop:operation-check",
    (_event, productId, generation, operationId) =>
      typeof productId === "string" &&
      Number.isSafeInteger(generation) &&
      generation > 0 &&
      typeof operationId === "string" &&
      operationId.trim() === operationId &&
      operationId.length > 0
        ? getDesktopOperationController().checkNow(
            productId,
            generation,
            operationId
          )
        : null
  );

  ipcMain.handle("desktop:status", (_event, productId) =>
    detectDesktopProduct(productId)
  );

  ipcMain.handle("desktop:uninstall", async (_event, productId) => {
    const probe = DESKTOP_PROBES[productId];
    if (!probe?.uninstall && !probe?.appx) {
      return {
        launched: false,
        error: "该产品尚未通过客户端卸载安全审核"
      };
    }
    const operationController = getDesktopOperationController();
    const existingOperation = operationController.get(productId);
    if (existingOperation) {
      return {
        launched: false,
        busy: true,
        error:
          existingOperation.operation === "install"
            ? "该产品仍在自动检测安装结果，不能同时启动卸载程序"
            : "该产品仍在自动确认卸载结果，无需重复启动卸载程序",
        operationTask: existingOperation
      };
    }
    if (activeDesktopOperationEntries.has(productId)) {
      return {
        launched: false,
        busy: true,
        error: "该产品的桌面操作正在准备，请勿重复点击"
      };
    }
    activeDesktopOperationEntries.add(productId);
    let operationTask = null;
    let processSpawned = false;
    try {
      if (probe.appx) {
        return await uninstallTrustedAppxProduct(
          productId,
          probe,
          operationController
        );
      }
      const registryScan = await scanRegistryAppsWithStatus();
      if (!registryScan.ok) {
        return {
          launched: false,
          error: "Windows 卸载项扫描不完整，请稍后重新检测"
        };
      }
      const record = trustedDesktopUninstallRecord(
        productId,
        registryScan.entries
      );
      if (!record) {
        return {
          launched: false,
          error: "未找到名称、发布者和安装位置均匹配的可信卸载项"
        };
      }

      const { action, entry, location } = record;
      const productName = String(entry.displayname || probe.names[0]);
      const signature = await verifyExpectedSignature(
        action.executable,
        probe.signer,
        true
      );
      if (!signature.ok) {
        return {
          launched: false,
          error: "卸载程序数字签名与预期厂商不匹配，已拒绝执行"
        };
      }
      const confirmation = await dialog.showMessageBox({
        type: "warning",
        title: `卸载 ${productName}`,
        message: `确认打开 ${productName} 的厂商卸载程序？`,
        detail: [
          `产品：${productName}`,
          `版本：${entry.displayversion || "Windows 未提供"}`,
          `发布者：${entry.publisher}`,
          `安装位置：${location || "Windows 未提供"}`,
          `卸载程序：${path.basename(action.executable)}`,
          `签发者：${signature.signer}`,
          "打开卸载程序不代表卸载已经完成；AI Hub 会继续检测安装记录是否真正消失。"
        ].join("\n"),
        buttons: ["取消", "继续卸载"],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      if (confirmation.response !== 1) {
        return { launched: false, canceled: true };
      }

      const finalSignature = await verifyExpectedSignature(
        action.executable,
        probe.signer,
        true
      );
      if (!finalSignature.ok) {
        return {
          launched: false,
          error: "卸载程序在确认期间发生变化，已拒绝执行"
        };
      }

      operationTask = operationController.begin(productId, "uninstall");
      const identity = {
        generation: operationTask.generation,
        operationId: operationTask.operationId
      };
      const finishLaunch = (launched) => {
        operationTask = operationController.finishLaunch(
          productId,
          identity.generation,
          identity.operationId,
          launched
        );
        return operationTask;
      };
      const launchResult = await launchProcessWithGrace({
        command: action.executable,
        args: action.args,
        graceMs: 2_000,
        env: isolatedThirdPartyEnvironment(),
        processLabel: "卸载程序",
        onSpawn: () => {
          processSpawned = true;
          finishLaunch(true);
        }
      });
      if (!launchResult.launched) {
        let cleanupWarning = "";
        try {
          finishLaunch(false);
        } catch (cleanupError) {
          operationTask = operationController.get(productId);
          cleanupWarning =
            cleanupError instanceof Error
              ? `；且无法清理操作记录：${cleanupError.message}`
              : "；且无法清理操作记录";
        }
        return {
          ...launchResult,
          operationTask,
          error: `${launchResult.error || `无法打开 ${productName} 卸载程序`}${cleanupWarning}`
        };
      }

      let persistenceWarning = launchResult.warning || "";
      try {
        if (operationTask?.phase === "launching") {
          finishLaunch(true);
        }
      } catch (verificationError) {
        operationTask = operationController.get(productId);
        const message =
          verificationError instanceof Error
            ? `自动卸载检测任务暂时无法更新：${verificationError.message}`
            : "自动卸载检测任务暂时无法更新";
        persistenceWarning = persistenceWarning
          ? `${persistenceWarning}；${message}`
          : message;
      }
      return {
        ...launchResult,
        operationTask: operationController.get(productId) || operationTask,
        warning: persistenceWarning || undefined,
        message: "卸载程序已打开，正在自动检测卸载结果"
      };
    } catch (error) {
      if (operationTask && !processSpawned) {
        try {
          operationTask = operationController.finishLaunch(
            productId,
            operationTask.generation,
            operationTask.operationId,
            false
          );
        } catch {
          operationTask = operationController.get(productId);
        }
      }
      return {
        launched: false,
        operationTask,
        error:
          error instanceof Error && error.message
            ? `无法打开卸载程序：${error.message}`
            : "无法打开卸载程序"
      };
    } finally {
      activeDesktopOperationEntries.delete(productId);
    }
  });

  ipcMain.handle("desktop:open-location", async (_event, productId) => {
    const status = await detectDesktopProduct(productId);
    if (
      !status.installed ||
      !status.location ||
      !path.isAbsolute(status.location) ||
      !fs.existsSync(status.location)
    ) {
      return false;
    }
    return (await shell.openPath(status.location)) === "";
  });

  ipcMain.handle("desktop:open", async (_event, productId) => {
    const probe = DESKTOP_PROBES[productId];
    const status = await detectDesktopProduct(productId);
    if (!status.installed) return false;
    if (status.executable) {
      if (probe?.uninstall) {
        const signature = await verifyExpectedSignature(
          status.executable,
          probe.signer,
          true
        );
        if (!signature.ok) return false;
      }
      return (await shell.openPath(status.executable)) === "";
    }
    if (probe?.uninstall) return false;
    if (status.appId) {
      try {
        const launcher = spawn(
          "explorer.exe",
          [`shell:AppsFolder\\${status.appId}`],
          {
            detached: true,
            stdio: "ignore",
            windowsHide: false
          }
        );
        launcher.unref();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  });

  ipcMain.handle("cli:status", (_event, productId) =>
    getCliStatus(productId)
  );

  ipcMain.handle("task-notification:cli", (_event, payload) => {
    const normalized = normalizeCliTaskNotification(
      payload,
      CLI_INSTALL_PLANS
    );
    if (!normalized) return false;
    const plan = CLI_INSTALL_PLANS[normalized.productId];
    const action = normalized.operation === "deploy" ? "部署" : "卸载";
    const succeeded = normalized.outcome === "completed";
    return showTaskNotification({
      key: `cli:${normalized.productId}:${normalized.generation}:${normalized.operation}:${normalized.outcome}`,
      productId: normalized.productId,
      title: `${plan.name} ${action}${succeeded ? "完成" : "失败"}`,
      body: succeeded
        ? "点击返回对应厂商产品页。"
        : "点击返回产品页或任务中心重试。"
    });
  });

  ipcMain.handle("tray:update-cli-task", (_event, payload) => {
    const normalized = normalizeCliTrayTask(payload, CLI_INSTALL_PLANS);
    if (!normalized) return false;
    const name = CLI_INSTALL_PLANS[normalized.productId].name;
    setTrayTaskState(
      `cli:${normalized.productId}`,
      `${name} ${
        normalized.operation === "uninstall" ? "卸载中" : "部署中"
      }`,
      normalized.phase === "running"
    );
    return true;
  });

  ipcMain.handle("cli:deploy", async (event, productId) => {
    const plan = CLI_INSTALL_PLANS[productId];
    if (!plan) {
      return { ok: false, error: "该产品不在客户端 CLI 安装白名单中" };
    }
    if (activeCliProducts.has(productId)) {
      return { ok: false, error: "该工具正在执行安装或卸载操作" };
    }
    activeCliProducts.add(productId);
    try {

    const settings = readSettings();
    const requestedDirectory = settings.cliInstallDirectory;
    if (!requestedDirectory || !path.isAbsolute(requestedDirectory)) {
      return { ok: false, error: "请先选择 CLI 工具安装位置" };
    }

    const checks = await Promise.all(
      plan.requirements.map(async (requirement) => ({
        requirement,
        location: await locate(
          requirement === "node"
            ? "node.exe"
            : requirement === "git"
              ? "git.exe"
              : `${requirement}.exe`
        )
      }))
    );
    const missing = checks
      .filter((check) => !check.location)
      .map((check) => check.requirement);
    if (missing.length) {
      return {
        ok: false,
        error: `缺少运行环境：${missing.join("、")}`
      };
    }

    let directory = "";
    try {
      fs.mkdirSync(requestedDirectory, { recursive: true });
      const prefixStatus = inspectManagedCli({
        productId,
        plan,
        receipt: null,
        configuredPrefix: requestedDirectory
      });
      if (!prefixStatus.directory || prefixStatus.detection === "unknown") {
        return { ok: false, error: "CLI 工具安装位置无法安全解析" };
      }
      directory = prefixStatus.directory;
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "CLI 工具安装位置不可用"
      };
    }

    const currentStatus = getCliStatus(productId);
    if (currentStatus.detection === "unknown") {
      return { ok: false, error: "暂时无法确认该 CLI 的当前安装状态" };
    }
    if (currentStatus.installed) {
      return {
        ok: false,
        error: currentStatus.managed
          ? "该 CLI 已由 AI Hub 部署"
          : "检测到非 AI Hub 管理的同名 CLI，客户端不会覆盖或接管"
      };
    }

    const prefixKey = directory.toLowerCase();
    if (activeCliPrefixes.has(prefixKey)) {
      return { ok: false, error: "该 CLI 安装位置正在执行其他操作" };
    }

    activeCliPrefixes.add(prefixKey);
    try {
      const confirmation = await dialog.showMessageBox({
        type: "question",
        title: `部署 ${plan.name}`,
        message: `确认安装 ${plan.name}？`,
        detail: [
          `官方软件包：${plan.packageName}`,
          `安装位置：${directory}`,
          "固定使用 npm 官方仓库，并隔离本机 npm 配置。",
          plan.postInstall
            ? "依赖包脚本全部禁用；仅运行客户端已审核的该软件包官方 postinstall，并验证原生程序版本。"
            : "软件包与依赖包的安装生命周期脚本全部禁用。"
        ].join("\n"),
        buttons: ["取消", "确认部署"],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      if (confirmation.response !== 1) {
        return { ok: false, canceled: true };
      }

      const installResult = await runCliInstall(
        event.sender,
        productId,
        directory,
        plan
      );
      if (!installResult.ok) return installResult;
      const { runtime, ...result } = installResult;
      const receipt = createManagedCliReceipt({
        productId,
        plan,
        prefix: directory,
        runtime
      });
      if (!receipt) {
        return {
          ...result,
          managed: false,
          warning: "CLI 已安装，但无法建立安全管理收据；客户端不会提供自动卸载"
        };
      }
      try {
        setManagedCliRecord(productId, receipt);
      } catch (error) {
        return {
          ...result,
          managed: false,
          warning:
            error instanceof Error
              ? `CLI 已安装，但管理收据写入失败：${error.message}`
              : "CLI 已安装，但管理收据写入失败"
        };
      }
      return {
        ok: true,
        version: receipt.version,
        directory: receipt.prefix,
        managed: true
      };
    } finally {
      activeCliProducts.delete(productId);
      activeCliPrefixes.delete(prefixKey);
    }
    } finally {
      activeCliProducts.delete(productId);
    }
  });

  ipcMain.handle("cli:uninstall", async (event, productId) => {
    const plan = CLI_INSTALL_PLANS[productId];
    if (!plan) {
      return { ok: false, error: "该产品不在客户端 CLI 管理白名单中" };
    }
    if (activeCliProducts.has(productId)) {
      return { ok: false, error: "该工具正在执行安装或卸载操作" };
    }
    activeCliProducts.add(productId);
    try {

    const records = readManagedCliRecords();
    const receipt = records[productId] || null;
    const status = getCliStatus(productId);
    if (!status.canUninstall || !receipt) {
      return {
        ok: false,
        error: status.installed
          ? "该 CLI 不是由 AI Hub 管理，客户端不会卸载"
          : "未找到可安全卸载的 AI Hub 受管 CLI"
      };
    }

    let runtime;
    try {
      runtime = await locateNpmRuntime();
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "无法定位 Node.js 和 npm"
      };
    }
    let executionContext;
    try {
      executionContext = createNpmExecutionContext();
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "无法建立隔离的 npm 执行环境"
      };
    }
    const action = createManagedCliUninstallAction({
      productId,
      plan,
      receipt,
      configuredPrefix: readSettings().cliInstallDirectory || "",
      runtime,
      executionContext
    });
    if (!action) {
      removeNpmExecutionContext(executionContext);
      return { ok: false, error: "CLI 管理收据或安装内容已变化，已拒绝卸载" };
    }

    const prefixKey = action.prefix.toLowerCase();
    if (activeCliPrefixes.has(prefixKey)) {
      removeNpmExecutionContext(executionContext);
      return { ok: false, error: "该 CLI 安装位置正在执行其他操作" };
    }
    activeCliPrefixes.add(prefixKey);
    try {
      const confirmation = await dialog.showMessageBox({
        type: "warning",
        title: `卸载 ${plan.name}`,
        message: `确认卸载 ${plan.name}？`,
        detail: [
          `受管软件包：${action.packageName}`,
          `当前版本：${action.version}`,
          `安装位置：${action.prefix}`,
          "只移除这个 npm CLI 包；不会删除模型、项目、npm 缓存或用户配置。",
          "卸载时会禁用软件包生命周期脚本。"
        ].join("\n"),
        buttons: ["取消", "确认卸载"],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      if (confirmation.response !== 1) {
        return { ok: false, canceled: true };
      }

      let confirmedRuntime;
      try {
        confirmedRuntime = await locateNpmRuntime();
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? `确认后运行环境校验失败：${error.message}`
              : "确认后运行环境校验失败"
        };
      }
      const currentRecords = readManagedCliRecords();
      const confirmedAction = createManagedCliUninstallAction({
        productId,
        plan,
        receipt: currentRecords[productId] || null,
        configuredPrefix: readSettings().cliInstallDirectory || "",
        runtime: confirmedRuntime,
        executionContext
      });
      if (
        !confirmedAction ||
        confirmedAction.prefix.toLowerCase() !== prefixKey ||
        confirmedAction.managementId !== action.managementId ||
        confirmedAction.version !== action.version ||
        confirmedAction.packageName !== action.packageName ||
        confirmedAction.executable.toLowerCase() !==
          action.executable.toLowerCase() ||
        JSON.stringify(confirmedAction.args) !== JSON.stringify(action.args)
      ) {
        return { ok: false, error: "确认期间 CLI 安装状态发生变化，已拒绝卸载" };
      }

      const result = await runCliUninstall(
        event.sender,
        confirmedAction,
        executionContext
      );
      if (!result.ok) return result;
      const after = getCliStatus(productId);
      if (after.detection !== "absent") {
        return {
          ok: false,
          error:
            after.detection === "unknown"
              ? "npm 已退出，但暂时无法可靠确认卸载结果；管理收据已保留"
              : "npm 已退出，但仍检测到该 CLI；管理收据已保留"
        };
      }
      removeManagedCliRecord(productId);
      return { ok: true, status: getCliStatus(productId) };
    } finally {
      removeNpmExecutionContext(executionContext);
      activeCliProducts.delete(productId);
      activeCliPrefixes.delete(prefixKey);
    }
    } finally {
      activeCliProducts.delete(productId);
    }
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: "#0e1714",
    title: "AI Hub PC",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  });

  window.removeMenu();
  const appPage = path.join(__dirname, "..", "dist", "index.html");
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url === pathToFileURL(appPage).href) return;
    event.preventDefault();
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
  });
  window.loadFile(appPage);
  window.once("ready-to-show", () => window.show());
  window.on("close", (event) => {
    if (
      !shouldHideWindowOnClose({
        isQuitting,
        trayAvailable: Boolean(tray && !tray.isDestroyed())
      })
    ) {
      return;
    }
    event.preventDefault();
    window.hide();
  });
  return window;
}

function showMainWindow() {
  let window = BrowserWindow.getAllWindows().find(
    (candidate) => !candidate.isDestroyed()
  );
  if (!window) window = createWindow();
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  return window;
}

function createTray() {
  if (tray && !tray.isDestroyed()) return tray;
  const trayIconPath = path.join(__dirname, "..", "build", "icon.png");
  try {
    tray = new Tray(trayIconPath);
    loadManagedDownloadTasks();
    for (const productId of managedDownloadTasks.keys()) {
      updateDownloadTrayTask(reconcileManagedDownloadTask(productId));
    }
    updateTrayPresentation();
    tray.on("click", () =>
      trayTaskStates.size > 0 ? openTaskCenterFromTray() : showMainWindow()
    );
  } catch (error) {
    tray = null;
    console.error("Unable to create system tray", error);
  }
  return tray;
}

async function configureTrustedLocalProxy() {
  const proxyRules = trustedLocalProxy(process.env);
  if (!proxyRules) return;
  await session.defaultSession.setProxy({
    mode: "fixed_servers",
    proxyRules,
    proxyBypassRules: "<local>;localhost;127.0.0.1;[::1]"
  });
}

function configureLocalReleaseCertificateTrust() {
  let trust;
  try {
    trust = readLocalReleaseTrust({
      resourcesPath: process.resourcesPath,
      acceptanceBuild: app.isPackaged && LOCAL_RELEASE_ACCEPTANCE
    });
  } catch (error) {
    if (LOCAL_RELEASE_ACCEPTANCE) {
      throw new Error(
        `本地发布证书配置不可用：${error instanceof Error ? error.message : "未知错误"}`
      );
    }
    return;
  }
  if (!trust) return;
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    const accepted = shouldTrustLocalReleaseCertificate(trust, request);
    try {
      fs.appendFileSync(
        path.join(app.getPath("userData"), "local-release-certificate.log"),
        `${JSON.stringify({
          at: new Date().toISOString(),
          hostname: request.hostname,
          fingerprint: request.certificate?.fingerprint || "",
          verificationResult: request.verificationResult,
          accepted
        })}\n`,
        "utf8"
      );
    } catch {
      // Acceptance diagnostics must not change certificate verification.
    }
    if (accepted) {
      callback(0);
      return;
    }
    callback(request.verificationResult === "OK" ? 0 : -2);
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });

  app
    .whenReady()
    .then(async () => {
      if (process.platform === "win32") {
        app.setAppUserModelId("com.aihub.desktop");
      }
      configureLocalReleaseCertificateTrust();
      await configureTrustedLocalProxy();
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(false)
      );
      registerIpc();
      createWindow();
      createTray();
      try {
        getDesktopOperationController().resume();
      } catch (error) {
        console.error("Unable to resume desktop operations", error);
      }
      try {
        getEnvironmentOperationController().resume();
      } catch (error) {
        console.error("Unable to resume environment operations", error);
      }
      app.on("activate", () => {
        showMainWindow();
      });
    })
    .catch((error) => {
      console.error("AI Hub failed to initialize", error);
      app.quit();
    });

  app.on("before-quit", () => {
    isQuitting = true;
    if (tray && !tray.isDestroyed()) tray.destroy();
    tray = null;
    desktopOperationController?.dispose();
    environmentOperationController?.dispose();
  });

  app.on("window-all-closed", () => {
    if (
      !shouldKeepAppAlive({
        platform: process.platform,
        isQuitting,
        trayAvailable: Boolean(tray && !tray.isDestroyed())
      })
    ) {
      app.quit();
    }
  });
}
