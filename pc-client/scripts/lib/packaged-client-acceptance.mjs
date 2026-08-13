import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  assertNoExistingAIHubProcesses,
  capturePackagedScreenshot,
  classifyPackagedManagedDownloadCancelAction,
  createIsolatedAcceptanceProfile,
  inspectPackagedIndependentTarget,
  inspectPackagedAcceptancePhysicalCleanup,
  inspectPackagedDownloadTaskDeliveryProbe,
  installPackagedDownloadTaskDeliveryProbe,
  disposePackagedDownloadTaskDeliveryProbe,
  launchPackagedClientCdp,
  openPackagedCatalogProduct,
  removeIsolatedAcceptanceProfile,
  encodePackagedAcceptanceEvidence,
  resolvePackagedAcceptanceEvidence,
  runPackagedActiveVisualAttempt,
  runPackagedSafeDismissAttempt,
  samplePackagedManagedDownloadCancellation,
  setPackagedViewport
} from "./packaged-client-cdp.mjs";
import {
  claimServerConnectedReviewInvocation,
  readServerConnectedReviewPackageInvocation
} from "./server-connected-review-receipt.mjs";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const { deterministicFixtureContractSha256, runPackagedManagedDownloadFixtureGate } = require("./packaged-managed-download-fixture-gate.cjs");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputRoot = path.join(root, "output");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const sha256Bytes = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const sha256File = (file) => sha256Bytes(fs.readFileSync(file));
const SEMVER = /^(?:0|[1-9]\d*)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[a-f0-9]{64}$/;
const TERMINAL = new Set(["completed", "downloaded", "failed", "cancelled", "canceled"]);
const PHASES = new Set(["queued", "starting", "downloading", "completed", "downloaded", "failed", "cancelled", "canceled", "other"]);
const FAILURE_CODES = new Set([
  "ACCEPTANCE_INTERNAL_FAILURE",
  "ASAR_PROVENANCE_MISMATCH",
  "CANCEL_BUTTON_DISABLED",
  "CANCEL_DIALOG_NOT_OPENED",
  "CANCEL_PRECONDITION_DRIFT",
  "CANCEL_PRECONDITION_NOT_CANCELLABLE",
  "ACTIVE_FIXTURE_EXHAUSTED",
  "CANCEL_TERMINAL_TIMEOUT",
  "CATALOG_REMOTE_VERSION_MISMATCH",
  "CLEANUP_RESIDUE",
  "DOWNLOAD_TASK_OBSERVER_UNAVAILABLE",
  "DOWNLOAD_TASK_EVENT_NOT_OBSERVED",
  "DOWNLOAD_TASK_OBSERVER_DISPOSE_FAILED",
  "DOWNLOAD_TASK_RENDERER_ERROR",
  "DETERMINISTIC_RENDERER_FIXTURE_FAILED",
  "INDEPENDENT_TASK_CHANGED",
  "INVALID_CANCEL_ENVELOPE_ACCEPTED",
  "PACKAGED_CLIENT_LAUNCH_FAILED",
  "RENDERER_PROJECTION_NOT_READY",
  "RETRY_TASK_REUSED",
  "SAFE_DISMISS_FIXTURE_NOT_READY",
  "TARGET_ATTEMPT_DRIFT",
  "TARGET_COMPLETED_DURING_CANCEL",
  "TARGET_PRECONDITION_DRIFT",
  "TARGET_TERMINAL_BEFORE_CANCEL",
  "VISUAL_CONTRACT_FAILED"
]);

const DIAGNOSTIC_KEYS = [
  "substageClass",
  "phaseClass", "sameAttempt", "actionClass", "statusEnvelopeClass", "dialogVisible", "viewportExact",
  "screenshotCount", "durationBucket"
];
const ACTUAL_KEYS = Object.freeze({
  launch: ["clientStarted"],
  catalog: ["source", "catalogVersion", "errorPresent", "statusClass", "fallbackClass", "vendors", "products"],
  asar: ["mainExact", "preloadExact", "rendererExact", "packageAsarExact", "downloadTaskExact", "taskContractExact", "outerRealmRejected", "cancelRequestExact", "secretFilesScanned", "secretFindings"],
  "deterministic-renderer": ["passed", "fixtureFailureClass"],
  "task-dom": ["scenarioClass", "listBeforePhase", "listAfterPhase", "statusEnvelopeClass", "statusPhase", "domPhase", "sameAttempt", "receivedBytesClass", "failureClass", "partPresent", "sampleGapBucket", "rawEventDeliveryClass", "rawEventCountClass", "rawObserverArmedBeforeEnqueue", "rendererErrorClass", ...DIAGNOSTIC_KEYS],
  "observer-dispose": ["disposed"],
  visual: ["theme", "viewport", "viewportExact", "dialogVisible", "roleExact", "ariaExact", "focusExact", "withinViewport", "noHorizontalOverflow", "bodyVisible", "dangerVisible", ...DIAGNOSTIC_KEYS],
  "safe-dismiss": ["defaultSafeFocus", "tabDangerFocus", "shiftTabSafeFocus", "escapeKeptTask", "safeButtonKeptTask", ...DIAGNOSTIC_KEYS],
  cancel: ["scenario", "requestExact", "expectedCurrentAttempt", "listBeforePhase", "listAfterPhase", "statusEnvelopeClass", "statusPhase", "domPhase", "canCancel", "buttonPresent", "buttonDisabled", "receivedBytesClass", "responseOk", "terminalPhaseClass", "partCount", "formalCount", ...DIAGNOSTIC_KEYS],
  retry: ["freshAttempt", "staleRejected", "invalidRejected", "independentTaskUnchanged", "independentPhaseClass", "independentProgressNondecreasing", "independentFormalAbsent"],
  cleanup: ["productProcesses", "profileCount", "tempCount", "downloadFileCount", "partCount", "formalCount", "treeAbsent", "extractionRootCount", "extractionCleanupSucceeded", "installerLaunched"],
  terminal: ["scenarioCount", "screenshotCount", "secretFindings", "targetResidueCount"]
});

const STATUS_KEYS = ["schemaVersion", "stage", "status", "code", "actual"];
const FINAL_KEYS = [
  "schemaVersion", "status", "version", "packageInvocationCount", "packagedAcceptanceInvocationCount",
  "reuseExistingPackage", "artifactSha256", "catalog", "provenance", "scenarioMatrix", "screenshots",
  "cleanup", "installerLaunched", "isolatedPackagedAcceptanceNotUserInstallAcceptance", "stage", "code",
  "runnerContractSha256", "helperContractSha256", "deterministicFixtureContractSha256", "observerDisposed", "observerCleanupCode"
];
const CONTROL_KEYS = ["schemaVersion", "kind", "version", "artifactSha256", "invocationCount", "runnerContractSha256", "helperContractSha256", "deterministicFixtureContractSha256"];
const SCENARIO_KEYS = ["deterministicRenderer", "packagedLiveConvergence"];
const SUBSTAGE_CLASSES = new Set([
  "visual-bootstrap", "safe-dismiss-open", "safe-dismiss-keyboard", "active-prepare", "active-dialog", "viewport-apply", "visual-inspect",
  "screenshot-capture", "cancel-confirm"
]);
const DURATION_BUCKETS = new Set(["under-1s", "under-10s", "under-30s", "30s-or-more"]);
const FIXTURE_FAILURE_CLASSES = new Set(["pre-residue", "spawn-error", "timeout", "nonzero", "signal", "stdout", "stderr", "post-residue"]);

const EMPTY_TASK_DOM = Object.freeze({
  scenarioClass: "other",
  listBeforePhase: "other",
  listAfterPhase: "other",
  statusEnvelopeClass: "invalid",
  statusPhase: "other",
  domPhase: "other",
  sameAttempt: false,
  receivedBytesClass: "other",
  failureClass: "other",
  partPresent: false,
  sampleGapBucket: "other",
  rawEventDeliveryClass: "observer-unavailable",
  rawEventCountClass: "zero",
  rawObserverArmedBeforeEnqueue: false,
  rendererErrorClass: "none"
});
const EMPTY_VISUAL = Object.freeze({
  theme: "other",
  viewport: "other",
  viewportExact: false,
  dialogVisible: false,
  roleExact: false,
  ariaExact: false,
  focusExact: false,
  withinViewport: false,
  noHorizontalOverflow: false,
  bodyVisible: false,
  dangerVisible: false
});
const EMPTY_SAFE_DISMISS = Object.freeze({
  defaultSafeFocus: false,
  tabDangerFocus: false,
  shiftTabSafeFocus: false,
  escapeKeptTask: false,
  safeButtonKeptTask: false
});

function durationBucket(startedAt) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < 1_000) return "under-1s";
  if (elapsed < 10_000) return "under-10s";
  if (elapsed < 30_000) return "under-30s";
  return "30s-or-more";
}

function assertPlainRecord(value, code = "EVIDENCE_VALUE_INVALID") {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(code);
  }
}

function encodeAllowlistedJson(value, allowedKeys) {
  return encodePackagedAcceptanceEvidence(value, allowedKeys);
}

function writeAtomic(file, bytes) {
  const temporary = `${file}.tmp`;
  const handle = fs.openSync(temporary, "w", 0o600);
  try {
    fs.writeFileSync(handle, bytes);
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  fs.renameSync(temporary, file);
}

function createCheckpointWriter(statusPath) {
  return (stage, status, code, actual = {}) => {
    if (!Object.hasOwn(ACTUAL_KEYS, stage) || !["running", "blocked", "passed"].includes(status)) {
      throw new Error("CHECKPOINT_INVALID");
    }
    assertPlainRecord(actual);
    const unknown = Object.keys(actual).filter((key) => !ACTUAL_KEYS[stage].includes(key));
    if (unknown.length > 0) throw new Error("CHECKPOINT_UNKNOWN_KEY");
    if (
      (actual.substageClass !== undefined && !SUBSTAGE_CLASSES.has(actual.substageClass)) ||
      (actual.screenshotCount !== undefined && (!Number.isSafeInteger(actual.screenshotCount) || actual.screenshotCount < 0)) ||
      (actual.phaseClass !== undefined && !PHASES.has(actual.phaseClass)) ||
      (actual.sameAttempt !== undefined && typeof actual.sameAttempt !== "boolean") ||
      (actual.actionClass !== undefined && !["enabled", "disabled", "missing", "other"].includes(actual.actionClass)) ||
      (actual.statusEnvelopeClass !== undefined && !["ok", "rejected", "invalid", "other"].includes(actual.statusEnvelopeClass)) ||
      (actual.dialogVisible !== undefined && typeof actual.dialogVisible !== "boolean") ||
      (actual.viewportExact !== undefined && typeof actual.viewportExact !== "boolean") ||
      (actual.durationBucket !== undefined && !DURATION_BUCKETS.has(actual.durationBucket))
      || (actual.rawEventDeliveryClass !== undefined && !["same-attempt-observed", "other-attempt-only", "not-observed", "observer-unavailable"].includes(actual.rawEventDeliveryClass))
      || (actual.rawEventCountClass !== undefined && !["zero", "one", "multiple"].includes(actual.rawEventCountClass))
      || (actual.rawObserverArmedBeforeEnqueue !== undefined && typeof actual.rawObserverArmedBeforeEnqueue !== "boolean")
      || (actual.rendererErrorClass !== undefined && !["none", "console", "page", "rejection", "mixed"].includes(actual.rendererErrorClass))
      || (actual.disposed !== undefined && typeof actual.disposed !== "boolean")
      || (actual.passed !== undefined && typeof actual.passed !== "boolean")
      || (actual.fixtureFailureClass !== undefined && !FIXTURE_FAILURE_CLASSES.has(actual.fixtureFailureClass))
    ) {
      throw new Error("CHECKPOINT_VALUE_INVALID");
    }
    const value = { schemaVersion: 1, stage, status, code, actual };
    writeAtomic(statusPath, encodeAllowlistedJson(value, STATUS_KEYS));
    return value;
  };
}

function failAfterCheckpoint(checkpoint, stage, code, actual = {}) {
  if (!FAILURE_CODES.has(code)) throw new Error("FAILURE_CODE_INVALID");
  checkpoint(stage, "blocked", code, actual);
  throw new Error(code);
}

function evaluateDownloadTaskContract(source) {
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require });
  vm.runInContext(source, context, { filename: "download-task.cjs" });
  const projected = (phase) => vm.runInContext(
    `module.exports.projectManagedDownloadTask({
      productId:"package-contract",attemptId:"attempt-1",phase:${JSON.stringify(phase)},progress:{receivedBytes:1,totalBytes:2,bytesPerSecond:1,percent:50}
    },{profileId:"fixed-profile"})`,
    context
  );
  const sameRealm = (phase) => vm.runInContext(
    `module.exports.authorizeManagedDownloadCancellation({
      request:{productId:"package-contract",taskId:"attempt-1",confirmed:true},
      task:{productId:"package-contract",attemptId:"attempt-1",phase:${JSON.stringify(phase)}},
      plan:{downloadPolicy:"desktop-download-only"}
    })`,
    context
  );
  const completed = sameRealm("completed");
  const canceled = sameRealm("canceled");
  const startingProjection = projected("starting");
  const cancelingProjection = projected("canceling");
  const canceledProjection = projected("canceled");
  const outer = module.exports.authorizeManagedDownloadCancellation({
    request: { productId: "package-contract", taskId: "attempt-1", confirmed: true },
    task: { productId: "package-contract", attemptId: "attempt-1", phase: "completed" },
    plan: { downloadPolicy: "desktop-download-only" }
  });
  return {
    startingProjectedQueued: startingProjection?.phase === "queued" && startingProjection?.presentation?.canCancel === true,
    cancelingProjectedDownloading: cancelingProjection?.phase === "downloading" && cancelingProjection?.presentation?.canCancel === true,
    canceledProjectedCancelled: canceledProjection?.phase === "cancelled" && canceledProjection?.presentation?.canCancel === false && canceledProjection?.presentation?.canRetry === true,
    completedFailClosed: completed?.ok === false && completed?.errorCode === "DOWNLOAD_ALREADY_COMPLETED",
    sameRealmErrorCode: completed?.errorCode || null,
    canceledFailClosed: canceled?.ok === false && canceled?.errorCode === "DOWNLOAD_NOT_CANCELLABLE",
    canceledErrorCode: canceled?.errorCode || null,
    outerRealmRejected: outer?.ok === false,
    outerRealmErrorCode: outer?.errorCode || null
  };
}

function resolvePackagedRendererEntry(indexHtml, entries) {
  const matches = [...String(indexHtml).matchAll(/src=["']\.\/(assets\/index-[^"'/?]+\.js)["']/g)];
  if (matches.length !== 1) throw new Error("PACKAGED_RENDERER_ENTRY_INVALID");
  const entry = `dist/${matches[0][1]}`;
  if (!entries.includes(entry)) throw new Error("PACKAGED_RENDERER_ENTRY_INVALID");
  return entry;
}

function resolveCurrentRendererAsset(packagedEntry, currentAssets) {
  const name = String(packagedEntry || "").split("/").at(-1);
  if (!name || !currentAssets.includes(name)) throw new Error("CURRENT_RENDERER_MISSING");
  return name;
}

function phaseClass(value) {
  const phase = String(value || "other").toLowerCase();
  return PHASES.has(phase) ? phase : "other";
}

function classifyCatalogError(error) {
  const value = typeof error === "string" ? error.toLowerCase() : "";
  if (!value) return "none";
  if (/abort|timeout|timed out/.test(value)) return "timeout-or-abort";
  if (/(?:^|\D)4\d\d(?:\D|$)/.test(value)) return "http-4xx";
  if (/(?:^|\D)5\d\d(?:\D|$)/.test(value)) return "http-5xx";
  if (/tls|ssl|certificate|cert/.test(value)) return "tls";
  if (/origin|redirect/.test(value)) return "origin-policy";
  if (/signature|integrity|sha-?256/.test(value)) return "signature-or-integrity";
  if (/eligible|eligibility/.test(value)) return "eligibility";
  return "other";
}

function observeCatalog(catalog) {
  const source = ["remote", "cache", "unavailable"].includes(catalog?.source) ? catalog.source : "invalid";
  const vendors = Array.isArray(catalog?.catalog?.vendors) ? catalog.catalog.vendors : [];
  return {
    source,
    catalogVersion: Number.isSafeInteger(catalog?.catalogVersion) ? catalog.catalogVersion : null,
    errorPresent: typeof catalog?.error === "string" && catalog.error.length > 0,
    statusClass: classifyCatalogError(catalog?.error),
    fallbackClass: source === "cache" ? "verified-cache" : source === "unavailable" ? "no-verified-cache" : "none",
    vendors: vendors.length,
    products: vendors.reduce((sum, vendor) => sum + (Array.isArray(vendor.products) ? vendor.products.length : 0), 0)
  };
}

function inspectAsar(appAsar, expectedPackageAsarSha256) {
  const entries = asar.listPackage(appAsar).map((entry) => entry.replace(/^[/\\]+/, "").replace(/\\/g, "/"));
  const required = ["dist/index.html", "electron/main.cjs", "electron/preload.cjs", "shared/download-task.cjs"];
  if (required.some((entry) => !entries.includes(entry))) throw new Error("PACKAGED_ASAR_REQUIRED_FILES_MISSING");
  const native = (entry) => entry.split("/").join(path.sep);
  const indexHtml = asar.extractFile(appAsar, native("dist/index.html")).toString("utf8");
  const rendererEntry = resolvePackagedRendererEntry(indexHtml, entries);
  const currentRenderer = resolveCurrentRendererAsset(rendererEntry, fs.readdirSync(path.join(root, "dist", "assets")));
  const main = asar.extractFile(appAsar, native("electron/main.cjs"));
  const preload = asar.extractFile(appAsar, native("electron/preload.cjs"));
  const renderer = asar.extractFile(appAsar, native(rendererEntry));
  const downloadTaskSource = asar.extractFile(appAsar, native("shared/download-task.cjs"));
  const patterns = [/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/, /AKIA[0-9A-Z]{16}/, /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/, /sk-[A-Za-z0-9]{32,}/];
  let secretFilesScanned = 0;
  let secretFindings = 0;
  for (const entry of entries) {
    if (!/\.(?:c?js|mjs|json|html|css|txt|md|yml|yaml|pem|crt)$/i.test(entry)) continue;
    let bytes;
    try { bytes = asar.extractFile(appAsar, native(entry)); } catch { continue; }
    secretFilesScanned += 1;
    if (bytes.length <= 8 * 1024 * 1024) secretFindings += patterns.filter((pattern) => pattern.test(bytes.toString("utf8"))).length;
  }
  const taskContract = evaluateDownloadTaskContract(downloadTaskSource.toString("utf8"));
  const appSource = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
  return {
    mainExact: sha256Bytes(main) === sha256File(path.join(root, "electron", "main.cjs")),
    preloadExact: sha256Bytes(preload) === sha256File(path.join(root, "electron", "preload.cjs")),
    rendererExact: sha256Bytes(renderer) === sha256File(path.join(root, "dist", "assets", currentRenderer)),
    packageAsarExact: sha256File(appAsar) === expectedPackageAsarSha256,
    downloadTaskExact: sha256Bytes(downloadTaskSource) === sha256File(path.join(root, "shared", "download-task.cjs")),
    taskContractExact: taskContract.startingProjectedQueued && taskContract.cancelingProjectedDownloading && taskContract.canceledProjectedCancelled && taskContract.completedFailClosed && taskContract.canceledFailClosed,
    outerRealmRejected: taskContract.outerRealmRejected && taskContract.outerRealmErrorCode === "DOWNLOAD_CANCEL_REQUEST_INVALID",
    cancelRequestExact: /cancelManagedDownload\(\{\s*productId:\s*pending\.productId,\s*taskId:\s*pending\.taskId,\s*confirmed:\s*true\s*\}\)/.test(appSource),
    secretFilesScanned,
    secretFindings
  };
}

function assertChildPath(parent, child, code) {
  const relative = path.relative(parent, child);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(code);
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(target) : entry.isFile() ? [target] : [];
  });
}

async function poll(read, accept, timeoutMs, intervalMs = 75) {
  const deadline = Date.now() + timeoutMs;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (accept(value)) return value;
    await delay(intervalMs);
  }
  return value;
}

async function openSettings(evaluate) {
  const opened = await evaluate(`(() => { if(document.querySelector('.settingsPanel'))return true;const buttons=[...document.querySelectorAll('.topActions .quietButton')];const button=buttons.at(-1);if(!(button instanceof HTMLButtonElement)||button.disabled)return false;button.click();return true;})()`);
  if (!opened) throw new Error("SETTINGS_NOT_OPENED");
  const ready = await poll(() => evaluate("Boolean(document.querySelector('.settingsPanel'))"), Boolean, 15_000);
  if (!ready) throw new Error("SETTINGS_NOT_OPENED");
}

async function closeSettings(evaluate) {
  await evaluate("document.querySelector('.settingsPanel > header > button')?.click(); true");
  const closed = await poll(() => evaluate("!document.querySelector('.settingsPanel')"), Boolean, 15_000);
  if (!closed) throw new Error("SETTINGS_NOT_CLOSED");
}

async function setTheme(evaluate, theme) {
  await openSettings(evaluate);
  const index = theme === "light" ? 0 : 1;
  const changed = await evaluate(`(() => {const button=document.querySelectorAll('.settingsPanel .segmented button')[${index}];if(!(button instanceof HTMLButtonElement))return false;button.click();return true;})()`);
  if (!changed) throw new Error("THEME_CONTROL_MISSING");
  const ready = await poll(() => evaluate(`document.querySelector('.pcApp')?.getAttribute('data-theme')===${JSON.stringify(theme)}`), Boolean, 15_000);
  if (!ready) throw new Error("THEME_CONTROL_MISSING");
  await closeSettings(evaluate);
}

async function openProduct(evaluate, entry) {
  await openPackagedCatalogProduct({
    evaluate,
    vendorId: entry.vendorId,
    productId: entry.product.id,
    searchText: entry.product.name,
    directoryKind: entry.product.directoryKind || "",
    timeoutMs: 30_000
  });
  const ready = await poll(
    () => evaluate(`(() => {const row=[...document.querySelectorAll('[data-aihub-product-id]')].find(node=>node.getAttribute('data-aihub-product-id')===${JSON.stringify(entry.product.id)});const button=row?.querySelector('[data-aihub-action="enqueue-managed-download"]');return button instanceof HTMLButtonElement&&!button.disabled;})()`),
    Boolean,
    15_000
  );
  if (!ready) throw new Error("ENQUEUE_DOM_NOT_READY");
}

async function enqueue(evaluate, entry) {
  await openProduct(evaluate, entry);
  const clicked = await evaluate(`(() => {const row=[...document.querySelectorAll('[data-aihub-product-id]')].find(node=>node.getAttribute('data-aihub-product-id')===${JSON.stringify(entry.product.id)});const button=row?.querySelector('[data-aihub-action="enqueue-managed-download"]');if(!(button instanceof HTMLButtonElement)||button.disabled)return false;button.focus();button.click();return true;})()`);
  if (!clicked) throw new Error("ENQUEUE_DOM_NOT_READY");
}

async function startActiveAttempt(evaluate, entry) {
  const previousTaskId = (await listTasks(evaluate)).find((task) => task.productId === entry.product.id)?.taskId || null;
  await enqueue(evaluate, entry);
  const task = await waitForTask(
    evaluate,
    entry.product.id,
    (value) => value?.taskId !== previousTaskId && value?.phase === "downloading" && Number(value?.progress?.receivedBytes || 0) > 0
  );
  if (
    !task
    || task.taskId === previousTaskId
    || task.phase !== "downloading"
    || Number(task.progress?.receivedBytes || 0) <= 0
  ) {
    throw new Error("ACTIVE_FIXTURE_EXHAUSTED");
  }
  return task;
}

async function listTasks(evaluate) {
  const value = await evaluate("window.aihubPC.listManagedDownloadTasks()");
  return Array.isArray(value) ? value : [];
}

async function waitForTask(evaluate, productId, accept, timeoutMs = 90_000) {
  return poll(async () => (await listTasks(evaluate)).find((entry) => entry.productId === productId) || null, accept, timeoutMs);
}

async function cancellationActual({ evaluate, productId, partPath, scenarioClass, expectedTaskId = null }) {
  const sampled = await samplePackagedManagedDownloadCancellation({ evaluate, productId, partPath });
  const deliveryTaskId = expectedTaskId || sampled.taskId;
  const delivery = deliveryTaskId
    ? await inspectPackagedDownloadTaskDeliveryProbe({ evaluate, productId, expectedTaskId: deliveryTaskId })
    : deliveryProbeUnavailableActual();
  return { state: sampled.state, taskId: sampled.taskId, proof: sampled.proof, actual: { scenarioClass, ...sampled.actual, ...delivery } };
}

function deliveryProbeUnavailableActual() {
  return {
    rawEventDeliveryClass: "observer-unavailable",
    rawEventCountClass: "zero",
    rawObserverArmedBeforeEnqueue: false,
    rendererErrorClass: "none"
  };
}

function taskDeliveryFailureCode(actual, { requireSame = false } = {}) {
  if (actual?.rawEventDeliveryClass === "observer-unavailable" || actual?.rawObserverArmedBeforeEnqueue !== true) {
    return "DOWNLOAD_TASK_OBSERVER_UNAVAILABLE";
  }
  if (actual?.rendererErrorClass !== "none") return "DOWNLOAD_TASK_RENDERER_ERROR";
  if (requireSame && actual?.rawEventDeliveryClass !== "same-attempt-observed") {
    return "DOWNLOAD_TASK_EVENT_NOT_OBSERVED";
  }
  return null;
}

function mainDownloadingExact(actual) {
  return Boolean(
    actual?.sameAttempt === true &&
    [actual?.listBeforePhase, actual?.statusPhase, actual?.listAfterPhase].every((phase) => phase === "downloading")
  );
}

function failForTaskDelivery(checkpoint, actual, { requireSame = false } = {}) {
  const code = taskDeliveryFailureCode(actual, { requireSame });
  if (code) failAfterCheckpoint(checkpoint, "task-dom", code, actual);
}

async function finalizeTaskDeliveryProbe({ attempted, evaluate, checkpoint, retained, acceptanceFailed }) {
  if (!attempted || typeof evaluate !== "function") return;
  let disposed = false;
  try {
    disposed = (await disposePackagedDownloadTaskDeliveryProbe({ evaluate }))?.disposed === true;
  } catch {}
  retained.observerDisposed = disposed;
  retained.observerCleanupCode = disposed ? null : "DOWNLOAD_TASK_OBSERVER_DISPOSE_FAILED";
  if (!disposed && acceptanceFailed) return;
  if (!disposed) failAfterCheckpoint(checkpoint, "observer-dispose", "DOWNLOAD_TASK_OBSERVER_DISPOSE_FAILED", { disposed: false });
  if (!acceptanceFailed) checkpoint("observer-dispose", "passed", null, { disposed: true });
}

function expectedPhaseActualExact(sampled, expectedPhase) {
  return Boolean(
    sampled?.actual?.sameAttempt === true &&
    [sampled?.actual?.listBeforePhase, sampled?.actual?.statusPhase, sampled?.actual?.listAfterPhase, sampled?.actual?.domPhase]
      .every((phase) => phase === expectedPhase) &&
    (expectedPhase !== "queued" || (
      sampled?.actual?.receivedBytesClass === "zero" &&
      sampled?.actual?.partPresent === false &&
      sampled?.proof?.buttonPresent === true &&
      sampled?.proof?.buttonDisabled === false
    ))
  );
}

async function waitForCancellationReady({ evaluate, productId, partPath, scenarioClass, checkpoint, allowTerminal = false, expectedPhase = null, terminalFailureCode = "TARGET_TERMINAL_BEFORE_CANCEL", timeoutMs = 30_000 }) {
  await openSettings(evaluate);
  const deadline = Date.now() + timeoutMs;
  const driftDeadline = Math.min(deadline, Date.now() + 1_000);
  let actual;
  while (Date.now() < deadline) {
    const sampled = await cancellationActual({ evaluate, productId, partPath, scenarioClass });
    actual = sampled.actual;
    failForTaskDelivery(checkpoint, actual);
    if (sampled.state === "ready") {
      failForTaskDelivery(checkpoint, actual, { requireSame: true });
      if (expectedPhase && !expectedPhaseActualExact(sampled, expectedPhase)) {
        failAfterCheckpoint(checkpoint, "task-dom", "TARGET_PRECONDITION_DRIFT", actual);
      }
      checkpoint("task-dom", "running", null, actual);
      return { terminal: false, preconditionDrift: false, actual, proof: sampled.proof, taskId: sampled.taskId };
    }
    if (sampled.state === "terminal") {
      if (allowTerminal) return { terminal: true, actual };
      failAfterCheckpoint(checkpoint, "task-dom", terminalFailureCode, actual);
    }
    if (sampled.state === "button-disabled") {
      failAfterCheckpoint(checkpoint, "task-dom", "CANCEL_BUTTON_DISABLED", actual);
    }
    if (sampled.state === "status-rejected") {
      failAfterCheckpoint(checkpoint, "task-dom", "CANCEL_PRECONDITION_DRIFT", actual);
    }
    if (sampled.state === "not-cancellable") {
      failAfterCheckpoint(checkpoint, "task-dom", "CANCEL_PRECONDITION_NOT_CANCELLABLE", actual);
    }
    if (sampled.state === "sampling-drift" && Date.now() >= driftDeadline) {
      failAfterCheckpoint(checkpoint, "task-dom", "CANCEL_PRECONDITION_DRIFT", actual);
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  const finalActual = actual || EMPTY_TASK_DOM;
  failForTaskDelivery(checkpoint, finalActual, { requireSame: mainDownloadingExact(finalActual) });
  failAfterCheckpoint(checkpoint, "task-dom", "RENDERER_PROJECTION_NOT_READY", finalActual);
}

async function openCancelDialog({ evaluate, productId, partPath, formalPath = null, scenarioClass, checkpoint, allowTerminal = false, expectedPhase = null, terminalFailureCode = "TARGET_TERMINAL_BEFORE_CANCEL" }) {
  const ready = await waitForCancellationReady({ evaluate, productId, partPath, scenarioClass, checkpoint, allowTerminal, expectedPhase, terminalFailureCode });
  if (ready.terminal) return ready;
  const partCount = fs.existsSync(partPath) ? 1 : 0;
  const formalCount = formalPath && fs.existsSync(formalPath) ? 1 : 0;
  const proof = {
    opened: false,
    sameAttempt: ready.actual.sameAttempt === true,
    listBeforePhase: ready.actual.listBeforePhase,
    statusPhase: ready.actual.statusPhase,
    listAfterPhase: ready.actual.listAfterPhase,
    domPhase: ready.actual.domPhase,
    receivedBytesClass: ready.actual.receivedBytesClass,
    canCancel: ready.proof?.canCancel === true,
    buttonPresent: ready.proof?.buttonPresent === true,
    buttonDisabled: ready.proof?.buttonDisabled === true,
    partCount,
    formalCount
  };
  if (ready.preconditionDrift || (expectedPhase === "queued" && (partCount || formalCount))) {
    return { ...ready, preconditionDrift: true, proof };
  }
  const clicked = await evaluate(`(() => {const row=[...document.querySelectorAll('.managedQueueTask')].find(node=>node.getAttribute('data-product-id')===${JSON.stringify(productId)});const button=row?.querySelector('[data-aihub-action="cancel-managed-download"]');if(!(button instanceof HTMLButtonElement)||button.disabled)return false;button.focus();button.click();return true;})()`);
  if (!clicked) {
    const sampled = await cancellationActual({ evaluate, productId, partPath, scenarioClass, expectedTaskId: ready.taskId });
    failForTaskDelivery(checkpoint, sampled.actual, { requireSame: mainDownloadingExact(sampled.actual) });
    failAfterCheckpoint(checkpoint, "task-dom", "RENDERER_PROJECTION_NOT_READY", sampled.actual);
  }
  const visible = await poll(() => evaluate("Boolean(document.querySelector('.managedDownloadCancelModal[role=alertdialog]'))"), Boolean, 15_000);
  if (!visible) failAfterCheckpoint(checkpoint, "visual", "CANCEL_DIALOG_NOT_OPENED", {
    theme: "other", viewport: "other", viewportExact: false, dialogVisible: false, roleExact: false, ariaExact: false,
    focusExact: false, withinViewport: false, noHorizontalOverflow: false, bodyVisible: false, dangerVisible: false
  });
  return { ...ready, proof: { ...proof, opened: true } };
}

async function dialogSnapshot(evaluate, theme, viewport) {
  const [expectedWidth, expectedHeight] = viewport.split("x").map(Number);
  const value = await evaluate(`(() => {const dialog=document.querySelector('.managedDownloadCancelModal');const rect=dialog?.getBoundingClientRect();const danger=dialog?.querySelector('.dangerButton');const body=dialog?.querySelector('#managed-download-cancel-description');return{viewportExact:innerWidth===${expectedWidth}&&innerHeight===${expectedHeight},dialogVisible:Boolean(dialog),roleExact:dialog?.getAttribute('role')==='alertdialog',ariaExact:dialog?.getAttribute('aria-modal')==='true'&&Boolean(dialog?.querySelector('#'+dialog.getAttribute('aria-labelledby')))&&Boolean(dialog?.querySelector('#'+dialog.getAttribute('aria-describedby'))),focusExact:document.activeElement===dialog?.querySelector('.managedDownloadCancelActions button:not(.dangerButton)'),withinViewport:Boolean(rect&&rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight),noHorizontalOverflow:Boolean(dialog&&dialog.scrollWidth<=dialog.clientWidth&&document.documentElement.scrollWidth<=innerWidth),bodyVisible:Boolean(body&&body.getBoundingClientRect().width>0&&body.getBoundingClientRect().height>0),dangerVisible:Boolean(danger&&danger.getBoundingClientRect().width>0&&danger.getBoundingClientRect().height>0)};})()`);
  return { theme, viewport, ...value };
}

async function dismissDialog(evaluate) {
  const clicked = await evaluate(`(() => {const button=document.querySelector('.managedDownloadCancelActions button:not(.dangerButton)');if(!(button instanceof HTMLButtonElement)||button.disabled)return false;button.click();return true;})()`);
  if (!clicked) throw new Error("DIALOG_KEEP_NOT_READY");
  const closed = await poll(() => evaluate("!document.querySelector('.managedDownloadCancelModal')"), Boolean, 15_000);
  if (!closed) throw new Error("DIALOG_KEEP_NOT_READY");
}

async function pressDialogKey(client, key) {
  const shifted = key === "Shift+Tab";
  const value = shifted ? "Tab" : key;
  const modifiers = shifted ? 8 : 0;
  await client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: value, code: value === "Tab" ? "Tab" : "Escape", modifiers });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: value, code: value === "Tab" ? "Tab" : "Escape", modifiers });
}

async function safeDialogSnapshot(evaluate) {
  return evaluate(`(() => {const dialog=document.querySelector('.managedDownloadCancelModal');const safe=dialog?.querySelector('.managedDownloadCancelActions button:not(.dangerButton)');const danger=dialog?.querySelector('.dangerButton');return{dialogVisible:Boolean(dialog),safeFocus:document.activeElement===safe,dangerFocus:document.activeElement===danger};})()`);
}

async function confirmOpenCancelDialog({ evaluate, productId, expectedTaskId, expectedPhase = null }) {
  const snapshot = await evaluate(`(async()=>{const productId=${JSON.stringify(productId)};const expectedTaskId=${JSON.stringify(expectedTaskId)};const expectedPhase=${JSON.stringify(expectedPhase)};const pick=(tasks)=>Array.isArray(tasks)?tasks.find(task=>task?.productId===productId)||null:null;const phase=(task)=>['queued','downloading','downloaded','failed','cancelled'].includes(task?.phase)?task.phase:'other';const bytes=(task)=>Number(task?.progress?.receivedBytes||0);const before=pick(await window.aihubPC.listManagedDownloadTasks());const status=await window.aihubPC.getManagedDownloadTaskStatus({productId});const row=[...document.querySelectorAll('.managedQueueTask')].find(node=>node.getAttribute('data-product-id')===productId);const button=row?.querySelector('[data-aihub-action="cancel-managed-download"]');const after=pick(await window.aihubPC.listManagedDownloadTasks());const statusTask=status?.task||null;const expected=Boolean(before?.taskId===expectedTaskId&&statusTask?.taskId===expectedTaskId&&after?.taskId===expectedTaskId);const phases=[phase(before),phase(statusTask),phase(after)];const terminal=phases.includes('downloaded')||phases.includes('failed')||phases.includes('cancelled')||phase({phase:row?.getAttribute('data-aihub-managed-download-phase')}).match(/^(downloaded|failed|cancelled)$/)!==null;const phaseExact=expectedPhase?phases.every(value=>value===expectedPhase)&&phase({phase:row?.getAttribute('data-aihub-managed-download-phase')})===expectedPhase:phases.every(value=>value===phases[0])&&['queued','downloading'].includes(phase(statusTask))&&phase({phase:row?.getAttribute('data-aihub-managed-download-phase')})===phases[0];const bytesExact=expectedPhase==='queued'?[bytes(before),bytes(statusTask),bytes(after)].every(value=>value===0):true;const ready=status?.ok===true&&expected&&!terminal&&phaseExact&&bytesExact&&button instanceof HTMLButtonElement&&!button.disabled;const danger=document.querySelector('.managedDownloadCancelModal .dangerButton');const clicked=Boolean(ready&&danger instanceof HTMLButtonElement&&!danger.disabled);if(clicked)danger.click();return{listBefore:before,status,listAfter:after,dom:{rendererPhaseClass:row?.getAttribute('data-aihub-managed-download-phase')||'other',rowPresent:Boolean(row),buttonPresent:button instanceof HTMLButtonElement,buttonDisabled:button instanceof HTMLButtonElement?button.disabled:false},clicked};})()`);
  const classified = classifyPackagedManagedDownloadCancelAction({
    expectedTaskId,
    listBefore: snapshot?.listBefore ? [snapshot.listBefore] : [],
    status: snapshot?.status,
    listAfter: snapshot?.listAfter ? [snapshot.listAfter] : [],
    dom: snapshot?.dom
  });
  return { ...classified, clicked: snapshot?.clicked === true };
}

async function cancelByDom({ evaluate, entry, checkpoint, scenario, profile, allowTerminal = false, expectedTaskId = null, expectedPhase = null, dialogAlreadyOpen = false, terminalFailureCode = "TARGET_TERMINAL_BEFORE_CANCEL" }) {
  const before = (await listTasks(evaluate)).find((task) => task.productId === entry.product.id) || null;
  const pendingPartPath = path.join(profile.downloadDirectory, `${entry.product.download.fileName}.part`);
  const finalPath = path.join(profile.downloadDirectory, entry.product.download.fileName);
  if (allowTerminal && expectedTaskId && before === null) {
    return { state: "absent", taskId: expectedTaskId, actual: null };
  }
  if (expectedTaskId && before?.taskId !== expectedTaskId) {
    const sampled = await cancellationActual({ evaluate, productId: entry.product.id, partPath: pendingPartPath, scenarioClass: scenario });
    failAfterCheckpoint(checkpoint, "cancel", "TARGET_ATTEMPT_DRIFT", {
      scenario,
      requestExact: false,
      expectedCurrentAttempt: false,
      listBeforePhase: sampled.actual.listBeforePhase,
      listAfterPhase: sampled.actual.listAfterPhase,
      statusEnvelopeClass: sampled.actual.statusEnvelopeClass,
      statusPhase: sampled.actual.statusPhase,
      domPhase: sampled.actual.domPhase,
      canCancel: false,
      buttonPresent: false,
      buttonDisabled: false,
      receivedBytesClass: sampled.actual.receivedBytesClass,
      responseOk: false,
      terminalPhaseClass: "other",
      partCount: fs.existsSync(pendingPartPath) ? 1 : 0,
      formalCount: fs.existsSync(path.join(profile.downloadDirectory, entry.product.download.fileName)) ? 1 : 0
    });
  }
  const opened = dialogAlreadyOpen
    ? { terminal: false, taskId: expectedTaskId }
    : await openCancelDialog({ evaluate, productId: entry.product.id, partPath: pendingPartPath, formalPath: finalPath, scenarioClass: scenario, checkpoint, allowTerminal, expectedPhase, terminalFailureCode });
  if (opened.terminal) return { state: "terminal", taskId: before?.taskId || null, actual: opened.actual };
  if (opened.preconditionDrift) {
    failAfterCheckpoint(checkpoint, "cancel", "TARGET_PRECONDITION_DRIFT", {
      scenario,
      requestExact: false,
      expectedCurrentAttempt: opened.actual.sameAttempt,
      listBeforePhase: opened.actual.listBeforePhase,
      listAfterPhase: opened.actual.listAfterPhase,
      statusEnvelopeClass: opened.actual.statusEnvelopeClass,
      statusPhase: opened.actual.statusPhase,
      domPhase: opened.actual.domPhase,
      canCancel: opened.proof?.canCancel === true,
      buttonPresent: opened.proof?.buttonPresent === true,
      buttonDisabled: opened.proof?.buttonDisabled === true,
      receivedBytesClass: opened.actual.receivedBytesClass,
      responseOk: false,
      terminalPhaseClass: "other",
      partCount: opened.proof?.partCount || 0,
      formalCount: opened.proof?.formalCount || 0
    });
  }
  const expected = expectedTaskId || opened.taskId;
  const partPath = `${finalPath}.part`;
  if (expectedPhase === "queued" && (fs.existsSync(partPath) || fs.existsSync(finalPath))) {
    const sampled = await cancellationActual({ evaluate, productId: entry.product.id, partPath, scenarioClass: scenario });
    failAfterCheckpoint(checkpoint, "cancel", "TARGET_PRECONDITION_DRIFT", {
      scenario,
      requestExact: false,
      expectedCurrentAttempt: sampled.actual.sameAttempt,
      listBeforePhase: sampled.actual.listBeforePhase,
      listAfterPhase: sampled.actual.listAfterPhase,
      statusEnvelopeClass: sampled.actual.statusEnvelopeClass,
      statusPhase: sampled.actual.statusPhase,
      domPhase: sampled.actual.domPhase,
      canCancel: sampled.proof?.canCancel === true,
      buttonPresent: sampled.proof?.buttonPresent === true,
      buttonDisabled: sampled.proof?.buttonDisabled === true,
      receivedBytesClass: sampled.actual.receivedBytesClass,
      responseOk: false,
      terminalPhaseClass: "other",
      partCount: fs.existsSync(partPath) ? 1 : 0,
      formalCount: fs.existsSync(finalPath) ? 1 : 0
    });
  }
  const confirmed = await confirmOpenCancelDialog({ evaluate, productId: entry.product.id, expectedTaskId: expected, expectedPhase });
  const actionActual = {
    scenario,
    requestExact: confirmed.actual.expectedCurrentAttempt && confirmed.clicked,
    ...confirmed.actual,
    responseOk: false,
    terminalPhaseClass: "other",
    partCount: fs.existsSync(partPath) ? 1 : 0,
    formalCount: fs.existsSync(finalPath) ? 1 : 0
  };
  if (confirmed.state === "attempt-drift") failAfterCheckpoint(checkpoint, "cancel", "TARGET_ATTEMPT_DRIFT", actionActual);
  if (confirmed.state === "terminal") {
    if (allowTerminal) return { state: "terminal", taskId: expected, actual: actionActual };
    failAfterCheckpoint(checkpoint, "cancel", terminalFailureCode, actionActual);
  }
  if (expectedPhase === "queued" && (!confirmed.clicked || [actionActual.listBeforePhase, actionActual.statusPhase, actionActual.listAfterPhase, actionActual.domPhase].some((phase) => phase !== "queued") || actionActual.receivedBytesClass !== "zero")) {
    failAfterCheckpoint(checkpoint, "cancel", "TARGET_PRECONDITION_DRIFT", actionActual);
  }
  if (confirmed.state !== "ready" || !confirmed.clicked) failAfterCheckpoint(checkpoint, "cancel", "CANCEL_PRECONDITION_DRIFT", actionActual);
  const terminal = await waitForTask(evaluate, entry.product.id, (task) => task === null, 30_000);
  const actual = {
    ...actionActual,
    responseOk: terminal === null,
    terminalPhaseClass: terminal === null ? "cancelled" : phaseClass(terminal?.phase),
    partCount: fs.existsSync(partPath) ? 1 : 0,
    formalCount: fs.existsSync(finalPath) ? 1 : 0
  };
  if (terminal?.taskId && terminal.taskId !== expected) failAfterCheckpoint(checkpoint, "cancel", "TARGET_ATTEMPT_DRIFT", actual);
  if (allowTerminal && terminal?.taskId === expected && TERMINAL.has(terminal.phase)) {
    return { state: "terminal", taskId: expected, actual };
  }
  if (terminal?.phase === "downloaded" && actual.formalCount === 1) failAfterCheckpoint(checkpoint, "cancel", "TARGET_COMPLETED_DURING_CANCEL", actual);
  if (terminal !== null || actual.partCount || actual.formalCount) failAfterCheckpoint(checkpoint, "cancel", "CANCEL_TERMINAL_TIMEOUT", actual);
  checkpoint("cancel", "running", null, actual);
  return {
    state: "cancelled",
    taskId: expected,
    actual,
    proof: {
      clicked: true,
      sameAttempt: actionActual.expectedCurrentAttempt,
      listBeforePhase: actionActual.listBeforePhase,
      statusPhase: actionActual.statusPhase,
      listAfterPhase: actionActual.listAfterPhase,
      domPhase: actionActual.domPhase,
      receivedBytesClass: actionActual.receivedBytesClass,
      buttonPresent: actionActual.buttonPresent,
      buttonDisabled: actionActual.buttonDisabled,
      partCount: 0,
      formalCount: 0
    }
  };
}

function targetResidueCount(profile, entries) {
  return entries.reduce((count, entry) => count + Number(fs.existsSync(path.join(profile.downloadDirectory, entry.product.download.fileName))) + Number(fs.existsSync(path.join(profile.downloadDirectory, `${entry.product.download.fileName}.part`))), 0);
}

async function invalidCancelMatrix(evaluate, productId, currentTaskId, staleTaskId) {
  const cases = [
    { productId, taskId: staleTaskId, confirmed: true },
    { productId: "missing-product", taskId: "missing-task", confirmed: true },
    { productId, taskId: currentTaskId, confirmed: true, extra: true },
    { productId, taskId: currentTaskId, confirmed: true, url: "https://invalid.example" },
    { productId, taskId: currentTaskId, confirmed: true, path: "C:\\invalid" },
    { productId, taskId: currentTaskId, confirmed: true, command: "cmd" },
    { productId, taskId: currentTaskId, confirmed: true, text: "cancel" }
  ];
  for (const input of cases) {
    const result = await evaluate(`window.aihubPC.cancelManagedDownload(${JSON.stringify(input)})`);
    if (result?.ok !== false) return false;
  }
  const current = (await listTasks(evaluate)).find((task) => task.productId === productId);
  return current?.taskId === currentTaskId;
}

async function dismissActiveFixture({ evaluate, client, entry, checkpoint, profile }) {
  const startedAt = Date.now();
  const active = await startActiveAttempt(evaluate, entry);
  const expectedTaskId = active.taskId;
  const safeDismissOpenActual = () => ({ ...EMPTY_SAFE_DISMISS, substageClass: "safe-dismiss-open", durationBucket: durationBucket(startedAt) });
  try {
    const result = await runPackagedSafeDismissAttempt({
      expectedTaskId,
      onSubstage: ({ substageClass }) => checkpoint("safe-dismiss", "running", null, { ...EMPTY_SAFE_DISMISS, substageClass, durationBucket: durationBucket(startedAt) }),
      openDialog: async (taskId) => {
        const opened = await openCancelDialog({
          evaluate,
          productId: entry.product.id,
          partPath: path.join(profile.downloadDirectory, `${entry.product.download.fileName}.part`),
          formalPath: path.join(profile.downloadDirectory, entry.product.download.fileName),
          scenarioClass: "active-safe-dismiss",
          checkpoint,
          terminalFailureCode: "SAFE_DISMISS_FIXTURE_NOT_READY"
        });
        return {
          opened: !opened.terminal && opened.taskId === taskId,
          sameAttempt: opened.actual?.sameAttempt === true && opened.taskId === taskId,
          active: [opened.actual?.listBeforePhase, opened.actual?.statusPhase, opened.actual?.listAfterPhase, opened.actual?.domPhase]
            .every((phase) => phase === "downloading")
        };
      },
      inspectDialog: () => safeDialogSnapshot(evaluate),
      pressKey: (key) => pressDialogKey(client, key),
      inspectTask: (taskId) => poll(async () => {
        const task = (await listTasks(evaluate)).find((value) => value.productId === entry.product.id) || null;
        return {
          dialogClosed: await evaluate("!document.querySelector('.managedDownloadCancelModal')"),
          sameAttempt: task?.taskId === taskId,
          active: task?.phase === "downloading"
        };
      }, (value) => value.dialogClosed && value.sameAttempt && value.active, 15_000),
      clickSafe: async () => {
        await dismissDialog(evaluate);
        return true;
      }
    });
    checkpoint("safe-dismiss", "running", null, result);
  } catch (error) {
    if (error?.message === "SAFE_DISMISS_FIXTURE_NOT_READY") {
      failAfterCheckpoint(checkpoint, "safe-dismiss", "SAFE_DISMISS_FIXTURE_NOT_READY", { ...(error.safeDismissActual || EMPTY_SAFE_DISMISS), substageClass: "safe-dismiss-keyboard", durationBucket: durationBucket(startedAt) });
    }
    throw error;
  }
  return cancelByDom({
    evaluate,
    entry,
    checkpoint,
    scenario: "safe-dismiss-cleanup",
    profile,
    expectedTaskId,
    terminalFailureCode: "ACTIVE_FIXTURE_EXHAUSTED"
  });
}

async function visualActiveScenario({ evaluate, client, entry, theme, viewport, checkpoint, evidenceDirectory, profile }) {
  const startedAt = Date.now();
  checkpoint("visual", "running", null, { ...EMPTY_VISUAL, substageClass: "visual-bootstrap", durationBucket: durationBucket(startedAt) });
  await setTheme(evaluate, theme);
  let screenshot = null;
  let visualResult;
  try {
    visualResult = await runPackagedActiveVisualAttempt({
      startActiveTask: async () => ({ targetTaskId: (await startActiveAttempt(evaluate, entry)).taskId }),
      onSubstage: ({ substageClass }) => {
        const diagnostic = { substageClass, durationBucket: durationBucket(startedAt), screenshotCount: screenshot ? 1 : 0 };
        if (["active-prepare", "active-dialog"].includes(substageClass)) {
          checkpoint("task-dom", "running", null, { ...EMPTY_TASK_DOM, ...diagnostic });
        } else if (substageClass === "cancel-confirm") {
          checkpoint("cancel", "running", null, diagnostic);
        } else {
          checkpoint("visual", "running", null, { ...EMPTY_VISUAL, theme, viewport: viewport.name, ...diagnostic });
        }
      },
      openCancelDialog: async (taskId) => {
        const formalPath = path.join(profile.downloadDirectory, entry.product.download.fileName);
        const opened = await openCancelDialog({
          evaluate,
          productId: entry.product.id,
          partPath: `${formalPath}.part`,
          formalPath,
          scenarioClass: "active-visual",
          checkpoint,
          terminalFailureCode: "ACTIVE_FIXTURE_EXHAUSTED"
        });
        return { ...opened.proof, opened: opened.proof?.opened === true && opened.taskId === taskId };
      },
      viewport,
      setViewport: () => setPackagedViewport({ client, width: viewport.width, height: viewport.height }),
      inspectVisual: async () => {
        const actual = await dialogSnapshot(evaluate, theme, viewport.name);
        if (!actual.viewportExact || !actual.dialogVisible || !actual.roleExact || !actual.ariaExact || !actual.focusExact || !actual.withinViewport || !actual.noHorizontalOverflow || !actual.bodyVisible || !actual.dangerVisible) {
          failAfterCheckpoint(checkpoint, "visual", "VISUAL_CONTRACT_FAILED", actual);
        }
        checkpoint("visual", "running", null, actual);
        return actual;
      },
      captureVisual: async () => {
        screenshot = await capturePackagedScreenshot({ client, evidenceDirectory, name: `cancel-${theme}-${viewport.name}.png`, width: viewport.width, height: viewport.height, viewportAlreadySet: true });
      },
      confirmOpenDialog: async (taskId) => {
        const result = await cancelByDom({ evaluate, entry, checkpoint, scenario: "active-visual", profile, expectedTaskId: taskId, dialogAlreadyOpen: true, terminalFailureCode: "ACTIVE_FIXTURE_EXHAUSTED" });
        return result.proof;
      }
    });
  } catch (error) {
    if (error?.message === "TARGET_PRECONDITION_DRIFT") {
      const status = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, "STATUS.json"), "utf8"));
      if (status.status === "blocked") throw error;
      const sampled = await cancellationActual({
        evaluate,
        productId: entry.product.id,
        partPath: path.join(profile.downloadDirectory, `${entry.product.download.fileName}.part`),
        scenarioClass: "active-visual"
      });
      failAfterCheckpoint(checkpoint, "task-dom", "TARGET_PRECONDITION_DRIFT", sampled.actual);
    }
    throw error;
  }
  await closeSettings(evaluate);
  return { screenshot, targetTaskId: visualResult.targetTaskId };
}

async function runAcceptance({ version, portablePath, artifactSha256, expectedPackageAsarSha256, expectedCatalogChannelSha256, expectedUpdateChannelSha256, evidenceDirectory, checkpoint, profile, retained }) {
  let client;
  const screenshots = [];
  const scenarioMatrix = { deterministicRenderer: false, packagedLiveConvergence: false };
  retained.scenarioMatrix = scenarioMatrix;
  let catalogObserved = null;
  let provenance = null;
  let deliveryProbeAttempted = false;
  let deliveryProbeInstalled = false;
  let acceptanceFailed = false;
  let evaluate;
  try {
    try {
      client = await launchPackagedClientCdp({ executable: portablePath, profile, expectedPackageAsarSha256, expectedCatalogChannelSha256, expectedUpdateChannelSha256, appArguments: ["--window-size=1365,740"] });
      checkpoint("launch", "running", null, { clientStarted: true });
    } catch {
      failAfterCheckpoint(checkpoint, "launch", "PACKAGED_CLIENT_LAUNCH_FAILED", { clientStarted: false });
    }
    evaluate = (expression, timeoutMs = 60_000) => client.evaluate(expression, timeoutMs);
    const bridgeReady = await poll(
      () => evaluate("Boolean(window.aihubPC?.getCatalog&&window.aihubPC?.enqueueManagedDownload&&window.aihubPC?.getManagedDownloadTaskStatus&&window.aihubPC?.cancelManagedDownload&&window.aihubPC?.listManagedDownloadTasks)"),
      Boolean,
      20_000
    );
    if (!bridgeReady) failAfterCheckpoint(checkpoint, "catalog", "CATALOG_REMOTE_VERSION_MISMATCH", observeCatalog(null));
    const catalog = await evaluate("window.aihubPC.getCatalog()", 60_000);
    catalogObserved = observeCatalog(catalog);
    checkpoint("catalog", "running", null, catalogObserved);
    if (catalogObserved.source !== "remote" || catalogObserved.catalogVersion !== 7) {
      failAfterCheckpoint(checkpoint, "catalog", "CATALOG_REMOTE_VERSION_MISMATCH", catalogObserved);
    }
    retained.catalog = catalogObserved;

    try {
      provenance = inspectAsar(client.runtimeClosure.appAsar, expectedPackageAsarSha256);
    } catch {
      provenance = { mainExact: false, preloadExact: false, rendererExact: false, packageAsarExact: false, downloadTaskExact: false, taskContractExact: false, outerRealmRejected: false, cancelRequestExact: false, secretFilesScanned: 0, secretFindings: 0 };
    }
    checkpoint("asar", "running", null, provenance);
    if (Object.entries(provenance).some(([key, value]) => key.endsWith("Exact") && value !== true) || !provenance.outerRealmRejected || provenance.secretFindings !== 0) {
      failAfterCheckpoint(checkpoint, "asar", "ASAR_PROVENANCE_MISMATCH", provenance);
    }
    retained.provenance = provenance;

    try {
      runPackagedManagedDownloadFixtureGate();
    } catch (error) {
      const fixtureFailureClass = FIXTURE_FAILURE_CLASSES.has(error?.failureClass) ? error.failureClass : "spawn-error";
      failAfterCheckpoint(checkpoint, "deterministic-renderer", "DETERMINISTIC_RENDERER_FIXTURE_FAILED", { passed: false, fixtureFailureClass });
    }
    scenarioMatrix.deterministicRenderer = true;
    checkpoint("deterministic-renderer", "passed", null, { passed: true });

    const entries = new Map();
    for (const vendor of catalog.catalog.vendors) {
      for (const product of vendor.products || []) entries.set(product.id, { vendorId: vendor.id, product });
    }
    const requiredIds = ["finevoice-desktop"];
    if (requiredIds.some((id) => !entries.get(id)?.product?.download)) {
      failAfterCheckpoint(checkpoint, "catalog", "CATALOG_REMOTE_VERSION_MISMATCH", catalogObserved);
    }
    const fineVoice = entries.get(requiredIds[0]);
    if (fineVoice.product.installProfileId !== "desktop-download-only.finevoice-desktop" || fineVoice.product.downloadPolicy !== "desktop-download-only") {
      failAfterCheckpoint(checkpoint, "catalog", "CATALOG_REMOTE_VERSION_MISMATCH", catalogObserved);
    }
    await evaluate(`(() => {window.__acceptanceErrors={console:0,page:0,rejection:0};const original=console.error.bind(console);console.error=(...args)=>{window.__acceptanceErrors.console++;return original(...args)};addEventListener('error',()=>window.__acceptanceErrors.page++);addEventListener('unhandledrejection',()=>window.__acceptanceErrors.rejection++);return true;})()`);
    deliveryProbeAttempted = true;
    const installedDeliveryProbe = await installPackagedDownloadTaskDeliveryProbe({ evaluate, productIds: requiredIds });
    deliveryProbeInstalled = installedDeliveryProbe.rawObserverArmedBeforeEnqueue === true;
    if (!deliveryProbeInstalled) {
      failAfterCheckpoint(checkpoint, "task-dom", "DOWNLOAD_TASK_OBSERVER_UNAVAILABLE", { ...EMPTY_TASK_DOM, ...installedDeliveryProbe });
    }

    const live = await startActiveAttempt(evaluate, fineVoice);
    const liveReady = await waitForCancellationReady({
      evaluate,
      productId: fineVoice.product.id,
      partPath: path.join(profile.downloadDirectory, `${fineVoice.product.download.fileName}.part`),
      scenarioClass: "packaged-live-convergence",
      checkpoint,
      expectedPhase: "downloading"
    });
    if (liveReady.taskId !== live.taskId || liveReady.actual.receivedBytesClass !== "positive") {
      failAfterCheckpoint(checkpoint, "task-dom", "TARGET_PRECONDITION_DRIFT", liveReady.actual);
    }
    scenarioMatrix.packagedLiveConvergence = true;
    await cancelByDom({
      evaluate,
      entry: fineVoice,
      checkpoint,
      scenario: "packaged-live-cleanup",
      profile,
      allowTerminal: true,
      expectedTaskId: live.taskId,
      expectedPhase: "downloading"
    });
    await closeSettings(evaluate);

    checkpoint("cleanup", "running", null, { productProcesses: 1, profileCount: 1, tempCount: 0, downloadFileCount: 0, partCount: 0, formalCount: 0, treeAbsent: false, extractionRootCount: 1, extractionCleanupSucceeded: false, installerLaunched: false });
    const errors = await evaluate("window.__acceptanceErrors");
    if (Number(errors?.console || 0) || Number(errors?.page || 0) || Number(errors?.rejection || 0)) throw new Error("RENDERER_ERRORS_PRESENT");
    return { client, catalogObserved, provenance, scenarioMatrix, screenshots };
  } catch (error) {
    acceptanceFailed = true;
    try {
      const statusPath = path.join(evidenceDirectory, "STATUS.json");
      const status = JSON.parse(fs.readFileSync(statusPath, "utf8"));
      if (status.status !== "blocked") {
        const code = FAILURE_CODES.has(error?.message) ? error.message : "ACCEPTANCE_INTERNAL_FAILURE";
        checkpoint(status.stage, "blocked", code, status.actual || {});
        error = new Error(code);
      }
    } catch {
      checkpoint("launch", "blocked", "ACCEPTANCE_INTERNAL_FAILURE", { clientStarted: Boolean(client) });
      error = new Error("ACCEPTANCE_INTERNAL_FAILURE");
    }
    error.acceptanceClient = client;
    throw error;
  } finally {
    try {
      await finalizeTaskDeliveryProbe({ attempted: deliveryProbeAttempted, evaluate, checkpoint, retained, acceptanceFailed });
    } catch (error) {
      error.acceptanceClient = client;
      throw error;
    }
  }
}

export async function runServerConnectedReviewAcceptance({ version, portablePath, artifactSha256, expectedPackageAsarSha256, expectedCatalogChannelSha256, expectedUpdateChannelSha256, evidenceDirectory }) {
  if (!SEMVER.test(version) || !path.isAbsolute(portablePath) || !fs.statSync(portablePath).isFile() || !SHA256.test(artifactSha256) || !SHA256.test(expectedPackageAsarSha256) || !SHA256.test(expectedCatalogChannelSha256) || !SHA256.test(expectedUpdateChannelSha256)) {
    throw new Error("ACCEPTANCE_INPUT_INVALID");
  }
  if (sha256File(portablePath) !== artifactSha256) throw new Error("ACCEPTANCE_ARTIFACT_MISMATCH");
  const packageReceipt = readServerConnectedReviewPackageInvocation({ portablePath, version });
  if (!path.isAbsolute(evidenceDirectory) || fs.existsSync(evidenceDirectory)) throw new Error("ACCEPTANCE_EVIDENCE_EXISTS");
  assertChildPath(outputRoot, evidenceDirectory, "ACCEPTANCE_EVIDENCE_OUTSIDE_OUTPUT");
  assertNoExistingAIHubProcesses();
  fs.mkdirSync(evidenceDirectory, { mode: 0o700 });
  const runnerContractSha256 = sha256File(fileURLToPath(import.meta.url));
  const helperContractSha256 = sha256File(path.join(root, "scripts", "lib", "packaged-client-cdp.mjs"));
  const deterministicFixtureSha256 = deterministicFixtureContractSha256();
  const baseControl = claimServerConnectedReviewInvocation({ directory: evidenceDirectory, kind: "acceptance", version, artifactSha256 });
  const control = { ...baseControl, runnerContractSha256, helperContractSha256, deterministicFixtureContractSha256: deterministicFixtureSha256 };
  writeAtomic(path.join(evidenceDirectory, "CONTROL.json"), encodeAllowlistedJson(control, CONTROL_KEYS));
  const checkpoint = createCheckpointWriter(path.join(evidenceDirectory, "STATUS.json"));
  const profile = createIsolatedAcceptanceProfile(`aihub-${version.replace(/[^0-9A-Za-z]/g, "")}-acceptance-`);
  const retained = { catalog: null, provenance: null, scenarioMatrix: { deterministicRenderer: false, packagedLiveConvergence: false }, observerDisposed: false, observerCleanupCode: null };
  let outcome;
  let client;
  let failureStage = "launch";
  let failureCode = null;
  let extractionCleanup = { treeAbsent: false, extractionRootCount: 0, extractionCleanupSucceeded: false };
  try {
    outcome = await runAcceptance({ version, portablePath, artifactSha256, expectedPackageAsarSha256, expectedCatalogChannelSha256, expectedUpdateChannelSha256, evidenceDirectory, checkpoint, profile, retained });
    client = outcome.client;
  } catch (error) {
    client = error?.acceptanceClient;
    failureCode = FAILURE_CODES.has(error?.message) ? error.message : "ACCEPTANCE_INTERNAL_FAILURE";
    try {
      const status = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, "STATUS.json"), "utf8"));
      failureStage = status.stage;
      if (status.status !== "blocked") checkpoint(failureStage, "blocked", failureCode, status.actual || {});
    } catch {
      checkpoint("launch", "blocked", failureCode, { clientStarted: Boolean(client) });
      failureStage = "launch";
    }
  } finally {
    try {
      if (client) extractionCleanup = await client.close();
    } catch (error) {
      extractionCleanup = {
        treeAbsent: error?.cleanup?.treeAbsent === true,
        extractionRootCount: Number.isSafeInteger(error?.cleanup?.extractionRootCount) ? error.cleanup.extractionRootCount : 1,
        extractionCleanupSucceeded: false
      };
    }
    try { await removeIsolatedAcceptanceProfile(profile); } catch {}
  }

  let productProcesses = 0;
  try { assertNoExistingAIHubProcesses(); } catch { productProcesses = 1; }
  const physicalCleanup = inspectPackagedAcceptancePhysicalCleanup({
    productProcesses,
    profileCount: fs.existsSync(profile.root) ? 1 : 0,
    tempCount: fs.readdirSync(os.tmpdir()).filter((entry) => entry.startsWith(`aihub-${version.replace(/[^0-9A-Za-z]/g, "")}-acceptance-`) || entry.startsWith("aihub-managed-download-queue-")).length,
    downloadFileCount: fs.existsSync(profile.downloadDirectory) ? walkFiles(profile.downloadDirectory).length : 0,
    partCount: 0,
    formalCount: 0,
    ...extractionCleanup,
    installerLaunched: false
  });
  const cleanup = physicalCleanup.cleanup;
  if (physicalCleanup.hasPhysicalResidue) {
    failureStage = "cleanup";
    failureCode = "CLEANUP_RESIDUE";
    checkpoint("cleanup", "blocked", failureCode, cleanup);
  } else if (!failureCode) {
    checkpoint("cleanup", "passed", null, cleanup);
    checkpoint("terminal", "passed", null, { scenarioCount: 2, screenshotCount: 0, secretFindings: retained.provenance?.secretFindings || 0, targetResidueCount: 0 });
  }

  const resolvedEvidence = resolvePackagedAcceptanceEvidence({ outcome, retained });
  const scenarioMatrix = resolvedEvidence.scenarioMatrix || retained.scenarioMatrix;
  assertPlainRecord(scenarioMatrix);
  if (Object.keys(scenarioMatrix).length !== SCENARIO_KEYS.length || SCENARIO_KEYS.some((key) => typeof scenarioMatrix[key] !== "boolean")) {
    throw new Error("EVIDENCE_VALUE_INVALID");
  }
  const final = {
    schemaVersion: 1,
    status: failureCode ? "BLOCKED" : "PASS",
    version,
    packageInvocationCount: packageReceipt.invocationCount,
    packagedAcceptanceInvocationCount: control.invocationCount,
    reuseExistingPackage: true,
    artifactSha256,
    catalog: resolvedEvidence.catalog,
    provenance: resolvedEvidence.provenance,
    scenarioMatrix,
    screenshots: resolvedEvidence.screenshots,
    cleanup,
    installerLaunched: false,
    isolatedPackagedAcceptanceNotUserInstallAcceptance: true,
    stage: failureCode ? failureStage : "terminal",
    code: failureCode,
    runnerContractSha256,
    helperContractSha256,
    deterministicFixtureContractSha256: deterministicFixtureSha256,
    observerDisposed: retained.observerDisposed,
    observerCleanupCode: retained.observerCleanupCode
  };
  const finalPath = path.join(evidenceDirectory, "FINAL.json");
  writeAtomic(finalPath, encodeAllowlistedJson(final, FINAL_KEYS));
  return { status: final.status, stage: final.stage, code: final.code, finalReport: "FINAL.json", finalSha256: sha256File(finalPath) };
}
