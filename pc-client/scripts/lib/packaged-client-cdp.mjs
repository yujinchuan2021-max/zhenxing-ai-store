import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const PACKAGED_SCREENSHOT_NAME = /^[a-z0-9][a-z0-9-]*\.png$/;
const MANAGED_DOWNLOAD_PHASES = new Set(["queued", "starting", "downloading", "downloaded", "failed", "cancelled"]);
const MANAGED_DOWNLOAD_TERMINAL_PHASES = new Set(["downloaded", "failed", "cancelled"]);
const MANAGED_DOWNLOAD_CANCELLABLE_PHASES = new Set(["queued", "downloading"]);
const MANAGED_DOWNLOAD_SUPPORT_ACTIVE_PHASES = new Set(["starting", "downloading"]);

function assertSafeEvidenceValue(value) {
  if (typeof value === "string") {
    if (/https?:\/\//iu.test(value)) throw new Error("EVIDENCE_URL");
    if (/^(?:[A-Za-z]:[\\/]|\\\\|\/)/u.test(value)) throw new Error("EVIDENCE_ABSOLUTE_PATH");
    if (/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,})/u.test(value)) {
      throw new Error("EVIDENCE_SENSITIVE_STRING");
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertSafeEvidenceValue(item);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) assertSafeEvidenceValue(item);
  }
}

export function encodePackagedAcceptanceEvidence(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("EVIDENCE_INVALID_RECORD");
  }
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("EVIDENCE_UNKNOWN_KEY");
  assertSafeEvidenceValue(value);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (JSON.stringify(JSON.parse(bytes.toString("utf8"))) !== JSON.stringify(value)) {
    throw new Error("EVIDENCE_UTF8_ROUNDTRIP_FAILED");
  }
  return bytes;
}

export function resolvePackagedAcceptanceEvidence({ outcome, retained }) {
  return {
    catalog: outcome?.catalogObserved || retained?.catalog || null,
    provenance: outcome?.provenance || retained?.provenance || null,
    scenarioMatrix: outcome?.scenarioMatrix || null,
    screenshots: outcome?.screenshots || []
  };
}

const DELIVERY_PROBE_KEY = "__aihubPackagedAcceptanceTaskDeliveryProbe";

function deliveryProbeUnavailable() {
  return {
    rawEventDeliveryClass: "observer-unavailable",
    rawEventCountClass: "zero",
    rawObserverArmedBeforeEnqueue: false,
    rendererErrorClass: "none"
  };
}

function normalizeDeliveryProbeProjection(value) {
  const projection = {
    rawEventDeliveryClass: value?.rawEventDeliveryClass,
    rawEventCountClass: value?.rawEventCountClass,
    rawObserverArmedBeforeEnqueue: value?.rawObserverArmedBeforeEnqueue,
    rendererErrorClass: value?.rendererErrorClass
  };
  if (
    !["same-attempt-observed", "other-attempt-only", "not-observed", "observer-unavailable"].includes(projection.rawEventDeliveryClass) ||
    !["zero", "one", "multiple"].includes(projection.rawEventCountClass) ||
    typeof projection.rawObserverArmedBeforeEnqueue !== "boolean" ||
    !["none", "console", "page", "rejection", "mixed"].includes(projection.rendererErrorClass)
  ) {
    return deliveryProbeUnavailable();
  }
  return projection;
}

export async function installPackagedDownloadTaskDeliveryProbe({ evaluate, productIds }) {
  if (
    typeof evaluate !== "function" ||
    !Array.isArray(productIds) ||
    productIds.length < 1 ||
    productIds.some((value) => typeof value !== "string" || !value)
  ) {
    throw new Error("Packaged task delivery probe input is invalid");
  }
  const expression = `(async()=>{
    const bridge=window.aihubPC;
    const key=${JSON.stringify(DELIVERY_PROBE_KEY)};
    if(!bridge||typeof bridge.onDownloadTask!=="function"||typeof bridge.listManagedDownloadTasks!=="function"||Object.prototype.hasOwnProperty.call(window,key))return null;
    const targets=new Set(${JSON.stringify(productIds)});
    const records=Object.create(null);
    const errors=window.__acceptanceErrors||{};
    const baseline={console:Number(errors.console||0),page:Number(errors.page||0),rejection:Number(errors.rejection||0)};
    const dispose=bridge.onDownloadTask((task)=>{
      const productId=typeof task?.productId==="string"?task.productId:"";
      const attemptId=typeof task?.attemptId==="string"?task.attemptId:"";
      if(!targets.has(productId)||!attemptId)return;
      const record=records[productId]||(records[productId]={attempts:[],eventCount:0});
      record.eventCount=Math.min(9,record.eventCount+1);
      if(!record.attempts.includes(attemptId)&&record.attempts.length<8)record.attempts.push(attemptId);
    });
    if(typeof dispose!=="function")return null;
    let existing=[];
    try{const value=await bridge.listManagedDownloadTasks();existing=Array.isArray(value)?value:[];}catch{dispose();return null;}
    const armed=!existing.some((task)=>targets.has(task?.productId));
    window[key]={targets,records,baseline,armed,dispose};
    return{rawEventDeliveryClass:armed?"not-observed":"observer-unavailable",rawEventCountClass:"zero",rawObserverArmedBeforeEnqueue:armed,rendererErrorClass:"none"};
  })()`;
  const value = await evaluate(expression);
  return normalizeDeliveryProbeProjection(value);
}

export async function inspectPackagedDownloadTaskDeliveryProbe({ evaluate, productId, expectedTaskId }) {
  if (typeof evaluate !== "function" || typeof productId !== "string" || !productId || typeof expectedTaskId !== "string" || !expectedTaskId) {
    throw new Error("Packaged task delivery probe input is invalid");
  }
  const expression = `(()=>{
    const state=window[${JSON.stringify(DELIVERY_PROBE_KEY)}];
    if(!state||state.armed!==true)return null;
    const record=state.records[${JSON.stringify(productId)}]||{attempts:[],eventCount:0};
    const count=Number(record.eventCount||0);
    const current=window.__acceptanceErrors||{};
    const changed=["console","page","rejection"].filter((key)=>Number(current[key]||0)>Number(state.baseline[key]||0));
    const rendererErrorClass=changed.length===0?"none":changed.length>1?"mixed":changed[0];
    return{
      rawEventDeliveryClass:record.attempts.includes(${JSON.stringify(expectedTaskId)})?"same-attempt-observed":count>0?"other-attempt-only":"not-observed",
      rawEventCountClass:count===0?"zero":count===1?"one":"multiple",
      rawObserverArmedBeforeEnqueue:true,
      rendererErrorClass
    };
  })()`;
  const value = await evaluate(expression);
  return normalizeDeliveryProbeProjection(value);
}

export async function disposePackagedDownloadTaskDeliveryProbe({ evaluate }) {
  if (typeof evaluate !== "function") throw new Error("Packaged task delivery probe input is invalid");
  const expression = `(()=>{const key=${JSON.stringify(DELIVERY_PROBE_KEY)};const state=window[key];if(!state)return{disposed:false};try{state.dispose();}finally{delete window[key];}return{disposed:true};})()`;
  const value = await evaluate(expression);
  return { disposed: value?.disposed === true };
}

function exactActiveProof(proof, action) {
  return Boolean(
    proof?.[action] === true &&
    proof?.sameAttempt === true &&
    [proof?.listBeforePhase, proof?.statusPhase, proof?.listAfterPhase, proof?.domPhase]
      .every((phase) => phase === "downloading") &&
    proof?.receivedBytesClass === "positive" &&
    proof?.buttonPresent === true &&
    proof?.buttonDisabled === false &&
    proof?.formalCount === 0
  );
}

function assertViewport(viewport) {
  if (
    !viewport ||
    typeof viewport !== "object" ||
    !Number.isSafeInteger(viewport.width) || viewport.width < 1 ||
    !Number.isSafeInteger(viewport.height) || viewport.height < 1
  ) {
    throw new Error("Packaged active visual attempt input is invalid");
  }
}

export async function runPackagedActiveVisualAttempt({ captureVisual, confirmOpenDialog, inspectVisual, onSubstage = async () => {}, openCancelDialog, setViewport, startActiveTask, viewport }) {
  if (
    typeof captureVisual !== "function" ||
    typeof confirmOpenDialog !== "function" ||
    typeof inspectVisual !== "function" ||
    typeof openCancelDialog !== "function" ||
    typeof setViewport !== "function" ||
    typeof startActiveTask !== "function" ||
    typeof onSubstage !== "function"
  ) {
    throw new Error("Packaged active visual attempt input is invalid");
  }
  assertViewport(viewport);
  await onSubstage({ substageClass: "active-prepare" });
  const prepared = await startActiveTask();
  if (typeof prepared?.targetTaskId !== "string" || !prepared.targetTaskId) throw new Error("ACTIVE_FIXTURE_EXHAUSTED");
  await onSubstage({ substageClass: "active-dialog" });
  const opened = await openCancelDialog(prepared.targetTaskId);
  if (opened?.terminal === true) throw new Error("ACTIVE_FIXTURE_EXHAUSTED");
  if (!exactActiveProof(opened, "opened")) throw new Error("TARGET_PRECONDITION_DRIFT");
  await onSubstage({ substageClass: "viewport-apply" });
  await setViewport(viewport);
  await onSubstage({ substageClass: "visual-inspect" });
  const visual = await inspectVisual(viewport);
  if (visual?.viewportExact !== true) throw new Error("VISUAL_CONTRACT_FAILED");
  await onSubstage({ substageClass: "screenshot-capture" });
  await captureVisual(prepared.targetTaskId, viewport);
  await onSubstage({ substageClass: "cancel-confirm" });
  const confirmed = await confirmOpenDialog(prepared.targetTaskId);
  if (confirmed?.terminal === true) throw new Error("ACTIVE_FIXTURE_EXHAUSTED");
  if (!exactActiveProof(confirmed, "clicked")) throw new Error("TARGET_PRECONDITION_DRIFT");
  return prepared;
}

export async function runPackagedSafeDismissAttempt({ clickSafe, expectedTaskId, inspectDialog, inspectTask, onSubstage = async () => {}, openDialog, pressKey }) {
  if (
    typeof expectedTaskId !== "string" || !expectedTaskId ||
    typeof clickSafe !== "function" ||
    typeof inspectDialog !== "function" ||
    typeof inspectTask !== "function" ||
    typeof openDialog !== "function" ||
    typeof pressKey !== "function" ||
    typeof onSubstage !== "function"
  ) {
    throw new Error("Packaged safe-dismiss input is invalid");
  }
  const actual = {
    defaultSafeFocus: false,
    tabDangerFocus: false,
    shiftTabSafeFocus: false,
    escapeKeptTask: false,
    safeButtonKeptTask: false
  };
  const fail = () => {
    const error = new Error("SAFE_DISMISS_FIXTURE_NOT_READY");
    error.safeDismissActual = { ...actual };
    throw error;
  };
  const requireOpened = async () => {
    const opened = await openDialog(expectedTaskId);
    if (opened?.opened !== true || opened?.sameAttempt !== true || opened?.active !== true) {
      fail();
    }
  };
  const requireDialog = async (focus) => {
    const dialog = await inspectDialog();
    if (dialog?.dialogVisible !== true || dialog?.[focus] !== true) {
      fail();
    }
  };
  const requireKept = async () => {
    const task = await inspectTask(expectedTaskId);
    if (task?.dialogClosed !== true || task?.sameAttempt !== true || task?.active !== true) {
      fail();
    }
  };

  await onSubstage({ substageClass: "safe-dismiss-open" });
  await requireOpened();
  await requireDialog("safeFocus");
  actual.defaultSafeFocus = true;
  await onSubstage({ substageClass: "safe-dismiss-keyboard" });
  await pressKey("Tab");
  await requireDialog("dangerFocus");
  actual.tabDangerFocus = true;
  await pressKey("Shift+Tab");
  await requireDialog("safeFocus");
  actual.shiftTabSafeFocus = true;
  await pressKey("Escape");
  await requireKept();
  actual.escapeKeptTask = true;
  await onSubstage({ substageClass: "safe-dismiss-open" });
  await requireOpened();
  if (await clickSafe(expectedTaskId) !== true) fail();
  await requireKept();
  actual.safeButtonKeptTask = true;
  return actual;
}

export async function setPackagedViewport({ client, width, height }) {
  if (!client || typeof client.send !== "function") throw new Error("Packaged viewport input is invalid");
  assertViewport({ width, height });
  await client.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
}

export async function capturePackagedScreenshot({ client, evidenceDirectory, name, width, height, viewportAlreadySet = false }) {
  if (
    !client ||
    typeof client.send !== "function" ||
    !path.isAbsolute(evidenceDirectory) ||
    !PACKAGED_SCREENSHOT_NAME.test(name) ||
    !Number.isSafeInteger(width) || width < 1 ||
    !Number.isSafeInteger(height) || height < 1 ||
    typeof viewportAlreadySet !== "boolean"
  ) {
    throw new Error("Packaged screenshot evidence input is invalid");
  }
  const directory = path.join(evidenceDirectory, "screenshots");
  const file = path.join(directory, name);
  if (path.relative(directory, file) !== name) throw new Error("Packaged screenshot evidence input is invalid");
  if (!viewportAlreadySet) await setPackagedViewport({ client, width, height });
  const image = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  if (typeof image?.data !== "string") throw new Error("Packaged screenshot capture failed");
  const bytes = Buffer.from(image.data, "base64");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  let handle;
  try {
    handle = fs.openSync(file, "wx", 0o600);
    fs.writeFileSync(handle, bytes);
    fs.fsyncSync(handle);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("Packaged screenshot evidence already exists");
    throw error;
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
  return {
    relativePath: `screenshots/${name}`,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
}

function managedDownloadPhase(value) {
  const phase = String(value || "other").toLowerCase();
  return MANAGED_DOWNLOAD_PHASES.has(phase) ? phase : "other";
}

function managedDownloadTask(tasks, productId) {
  if (!Array.isArray(tasks)) return null;
  return tasks.find((task) => task?.productId === productId && typeof task?.taskId === "string") || null;
}

export function inspectPackagedIndependentTarget({ before, after, formalPath }) {
  if (!before || !after || typeof formalPath !== "string" || !formalPath) {
    throw new Error("Packaged independent target input is invalid");
  }
  const afterPhase = managedDownloadPhase(after.phase);
  const phaseClass = MANAGED_DOWNLOAD_SUPPORT_ACTIVE_PHASES.has(afterPhase)
    ? "active"
    : afterPhase === "downloaded"
      ? "downloaded"
    : MANAGED_DOWNLOAD_TERMINAL_PHASES.has(afterPhase)
      ? "terminal"
      : "other";
  const sameAttempt = before.productId === after.productId && before.taskId === after.taskId;
  const receivedBytesNondecreasing = Number(after?.progress?.receivedBytes || 0) >= Number(before?.progress?.receivedBytes || 0);
  const formalAbsent = !fs.existsSync(formalPath);
  const completed = afterPhase === "downloaded" && !formalAbsent;
  return {
    unchanged: managedDownloadPhase(before.phase) === "downloading" &&
      Number(before?.progress?.receivedBytes || 0) > 0 &&
      sameAttempt &&
      (phaseClass === "active" || completed) &&
      receivedBytesNondecreasing &&
      (phaseClass === "active" ? formalAbsent : completed),
    sameAttempt,
    phaseClass,
    receivedBytesNondecreasing,
    formalAbsent
  };
}

function managedDownloadFailureClass(value) {
  const code = typeof value === "string" ? value : "";
  if (!code) return "other";
  if (code === "DOWNLOAD_START_FAILED") return "start";
  if (code === "DOWNLOAD_QUEUE_REJECTED") return "queue";
  if (code === "DOWNLOAD_TASK_INTERNAL_ERROR") return "task-internal";
  if (code === "DOWNLOAD_FAILED") return "generic-download-failed";
  if (code === "DOWNLOAD_SOURCE_NO_DATA") return "source-no-data";
  if (/HTTP|STATUS_/.test(code)) return "http";
  if (/CONNECTION|NETWORK|FETCH|TIMEOUT|ABORT/.test(code)) return "transport";
  if (/POLICY|PLAN_NOT_FOUND|ONLY_NOT_APPROVED/.test(code)) return "policy";
  if (/ENOSPC|DISK.*(?:SPACE|FULL)|SPACE/.test(code)) return "disk-space";
  if (/EACCES|EPERM|WRITE|ROLLBACK/.test(code)) return "disk-write";
  if (/INCOMPLETE|SIZE_INVALID/.test(code)) return "incomplete";
  if (/ATTEMPT|TASK_NOT_FOUND|ALREADY_COMPLETED|NOT_CANCELLABLE/.test(code)) return "attempt";
  return "other";
}

function cancellationSampleGapBucket(startedAt) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < 100) return "under-100ms";
  if (elapsed < 250) return "100-249ms";
  if (elapsed < 1_000) return "250-999ms";
  return "1s-plus";
}

function cancellationDomSnapshotExpression(productId) {
  return `(() => {const row=[...document.querySelectorAll('.managedQueueTask')].find(node=>node.getAttribute('data-product-id')===${JSON.stringify(productId)});const button=row?.querySelector('[data-aihub-action="cancel-managed-download"]');return{rendererPhaseClass:row?.getAttribute('data-aihub-managed-download-phase')||'other',rowPresent:Boolean(row),buttonPresent:button instanceof HTMLButtonElement,buttonDisabled:button instanceof HTMLButtonElement?button.disabled:false};})()`;
}

export function classifyPackagedManagedDownloadCancelAction({ expectedTaskId, listBefore, status, listAfter, dom }) {
  if (typeof expectedTaskId !== "string" || !Array.isArray(listBefore) || !Array.isArray(listAfter) || !dom || typeof dom !== "object") {
    throw new Error("Packaged managed-download cancellation action input is invalid");
  }
  const productId = typeof status?.task?.productId === "string" ? status.task.productId : "";
  const before = managedDownloadTask(listBefore, productId);
  const after = managedDownloadTask(listAfter, productId);
  const statusTask = managedDownloadTask([status?.task], productId);
  const listBeforePhase = managedDownloadPhase(before?.phase);
  const listAfterPhase = managedDownloadPhase(after?.phase);
  const statusPhase = managedDownloadPhase(statusTask?.phase);
  const domPhase = managedDownloadPhase(dom?.rendererPhaseClass);
  const statusEnvelopeClass = status?.ok === true && statusTask ? "ok" : status?.ok === false ? "rejected" : "invalid";
  const expectedCurrentAttempt = Boolean(
    expectedTaskId &&
    before?.taskId === expectedTaskId &&
    statusTask?.taskId === expectedTaskId &&
    after?.taskId === expectedTaskId
  );
  const canCancel = MANAGED_DOWNLOAD_CANCELLABLE_PHASES.has(statusPhase);
  const actual = {
    expectedCurrentAttempt,
    listBeforePhase,
    listAfterPhase,
    statusEnvelopeClass,
    statusPhase,
    domPhase,
    canCancel,
    buttonPresent: dom?.buttonPresent === true,
    buttonDisabled: dom?.buttonDisabled === true,
    receivedBytesClass: Number(after?.progress?.receivedBytes || 0) > 0 ? "positive" : after ? "zero" : "other"
  };
  const stablePhase = [listBeforePhase, statusPhase, listAfterPhase].every((phase) => phase === listBeforePhase);
  const terminal = [listBeforePhase, statusPhase, listAfterPhase, domPhase].some((phase) => MANAGED_DOWNLOAD_TERMINAL_PHASES.has(phase));
  const state = statusEnvelopeClass !== "ok"
    ? "status-rejected"
    : !expectedCurrentAttempt
      ? "attempt-drift"
      : terminal
        ? "terminal"
        : !stablePhase
          ? "sampling-drift"
          : !canCancel
            ? "not-cancellable"
            : domPhase !== listBeforePhase || dom?.rowPresent !== true || dom?.buttonPresent !== true
              ? "renderer-not-ready"
              : dom?.buttonDisabled === true
                ? "button-disabled"
                : "ready";
  return { state, actual };
}

export async function samplePackagedManagedDownloadCancellation({ evaluate, productId, partPath }) {
  if (typeof evaluate !== "function" || typeof productId !== "string" || !productId || !path.isAbsolute(partPath)) {
    throw new Error("Packaged managed-download cancellation sample input is invalid");
  }
  const startedAt = Date.now();
  const listBefore = await evaluate("window.aihubPC.listManagedDownloadTasks()");
  const before = managedDownloadTask(listBefore, productId);
  const status = await evaluate(`window.aihubPC.getManagedDownloadTaskStatus(${JSON.stringify({ productId })})`);
  const dom = await evaluate(cancellationDomSnapshotExpression(productId));
  const listAfter = await evaluate("window.aihubPC.listManagedDownloadTasks()");
  const after = managedDownloadTask(listAfter, productId);
  const classified = classifyPackagedManagedDownloadCancelAction({
    expectedTaskId: before?.taskId || "",
    listBefore,
    status,
    listAfter,
    dom
  });
  const { expectedCurrentAttempt, canCancel, buttonPresent, buttonDisabled, ...safeAction } = classified.actual;
  return {
    state: classified.state === "attempt-drift" ? "sampling-drift" : classified.state,
    taskId: before?.taskId || null,
    proof: {
      sameAttempt: expectedCurrentAttempt,
      canCancel,
      buttonPresent,
      buttonDisabled
    },
    actual: {
      ...safeAction,
      sameAttempt: expectedCurrentAttempt,
      failureClass: managedDownloadFailureClass(status?.errorCode || status?.task?.errorCode || before?.errorCode || after?.errorCode),
      partPresent: fs.existsSync(partPath),
      sampleGapBucket: cancellationSampleGapBucket(startedAt)
    }
  };
}

export function inspectPackagedAcceptancePhysicalCleanup(input) {
  const fields = ["productProcesses", "profileCount", "tempCount", "downloadFileCount", "partCount", "formalCount", "extractionRootCount"];
  if (!input || typeof input !== "object" || Array.isArray(input) || typeof input.installerLaunched !== "boolean" || typeof input.treeAbsent !== "boolean" || typeof input.extractionCleanupSucceeded !== "boolean" || fields.some((key) => !Number.isSafeInteger(input[key]) || input[key] < 0)) {
    throw new Error("Packaged acceptance physical-cleanup input is invalid");
  }
  const cleanup = {
    productProcesses: input.productProcesses,
    profileCount: input.profileCount,
    tempCount: input.tempCount,
    downloadFileCount: input.downloadFileCount,
    partCount: input.partCount,
    formalCount: input.formalCount,
    treeAbsent: input.treeAbsent,
    extractionRootCount: input.extractionRootCount,
    extractionCleanupSucceeded: input.extractionCleanupSucceeded,
    installerLaunched: input.installerLaunched
  };
  return {
    cleanup,
    hasPhysicalResidue: fields.some((key) => cleanup[key] !== 0) || !cleanup.treeAbsent || !cleanup.extractionCleanupSucceeded
  };
}

const PACKAGED_DOM_ACTIONS = new Set([
  "install-product",
  "refresh-product",
  "pause-download",
  "inspect-extension",
  "install-extension",
  "uninstall-extension"
]);

export function assertPackagedRemoteCatalog({
  catalog,
  minimumCatalogVersion
}) {
  if (
    !Number.isSafeInteger(minimumCatalogVersion) ||
    minimumCatalogVersion < 0 ||
    catalog?.source !== "remote" ||
    !Number.isSafeInteger(catalog.catalogVersion) ||
    catalog.catalogVersion < minimumCatalogVersion ||
    !Array.isArray(catalog.catalog?.vendors)
  ) {
    throw new Error(
      `Packaged client did not accept the minimum remote signed catalog: ${JSON.stringify(
        catalog
      )}`
    );
  }
  return catalog;
}

function assertPackagedDomActionInput({
  evaluate,
  productId,
  resourceId = "",
  action,
  extensionProfileId = "",
  timeoutMs
}) {
  const resourceAction =
    action === "inspect-extension" ||
    action === "install-extension" ||
    action === "uninstall-extension";
  if (
    typeof evaluate !== "function" ||
    typeof productId !== "string" ||
    typeof resourceId !== "string" ||
    !PACKAGED_DOM_ACTIONS.has(action) ||
    typeof extensionProfileId !== "string" ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    (resourceAction && (!resourceId || !extensionProfileId)) ||
    (!resourceAction && !productId)
  ) {
    throw new Error("Packaged DOM action input is invalid");
  }
}

function packagedDomActionSnapshotExpression({
  productId,
  resourceId = "",
  action,
  extensionProfileId = ""
}) {
  return `(() => {
    const productId = ${JSON.stringify(productId)};
    const resourceId = ${JSON.stringify(resourceId)};
    const action = ${JSON.stringify(action)};
    const extensionProfileId = ${JSON.stringify(extensionProfileId)};
    const byAttribute = (root, attribute, value) =>
      Array.from(root.querySelectorAll(\`[\${attribute}]\`)).find(
        (element) => element.getAttribute(attribute) === value
      );
    const product = byAttribute(document, "data-aihub-product-id", productId);
    const resource = byAttribute(document, "data-aihub-resource-id", resourceId);
    const actionRoot = extensionProfileId
      ? resource &&
        resource.getAttribute("data-aihub-extension-profile-id") ===
          extensionProfileId
        ? resource
        : null
      : product;
    const button = actionRoot && byAttribute(
      actionRoot,
      "data-aihub-action",
      action
    );
    return {
      found: button instanceof HTMLButtonElement,
      disabled: button instanceof HTMLButtonElement ? button.disabled : null,
      label: button instanceof HTMLButtonElement ? button.innerText.trim() : ""
    };
  })()`;
}

export async function waitForPackagedDomAction({
  evaluate,
  productId,
  resourceId = "",
  action,
  extensionProfileId = "",
  requireEnabled = true,
  timeoutMs = 10_000
}) {
  assertPackagedDomActionInput({
    evaluate,
    productId,
    resourceId,
    action,
    extensionProfileId,
    timeoutMs
  });
  if (typeof requireEnabled !== "boolean") {
    throw new Error("Packaged DOM action readiness input is invalid");
  }
  const deadline = Date.now() + timeoutMs;
  let snapshot = null;
  while (Date.now() < deadline) {
    snapshot = await evaluate(
      packagedDomActionSnapshotExpression({
        productId,
        resourceId,
        action,
        extensionProfileId
      })
    );
    if (
      snapshot?.found === true &&
      (!requireEnabled || snapshot.disabled === false)
    ) {
      return snapshot;
    }
    await delay(100);
  }
  throw new Error(
    `Packaged DOM action was not ready: ${JSON.stringify({
      productId,
      resourceId,
      action,
      extensionProfileId,
      snapshot
    })}`
  );
}

export async function clickPackagedDomAction({
  evaluate,
  productId,
  resourceId = "",
  action,
  extensionProfileId = "",
  timeoutMs = 8_000
}) {
  assertPackagedDomActionInput({
    evaluate,
    productId,
    resourceId,
    action,
    extensionProfileId,
    timeoutMs
  });
  const result = await evaluate(`(() => {
    const productId = ${JSON.stringify(productId)};
    const resourceId = ${JSON.stringify(resourceId)};
    const action = ${JSON.stringify(action)};
    const extensionProfileId = ${JSON.stringify(extensionProfileId)};
    const timeoutMs = ${timeoutMs};
    const byAttribute = (root, attribute, value) =>
      Array.from(root.querySelectorAll(\`[\${attribute}]\`)).find(
        (element) => element.getAttribute(attribute) === value
      );
    const product = byAttribute(document, "data-aihub-product-id", productId);
    const resource = byAttribute(document, "data-aihub-resource-id", resourceId);
    const actionRoot = extensionProfileId
      ? resource &&
        resource.getAttribute("data-aihub-extension-profile-id") ===
          extensionProfileId
        ? resource
        : null
      : product;
    const actionButton = actionRoot && byAttribute(
      actionRoot,
      "data-aihub-action",
      action
    );
    if (!(actionButton instanceof HTMLButtonElement) || actionButton.disabled) {
      return {
        clicked: false,
        busyObserved: false,
        label: actionButton instanceof HTMLButtonElement
          ? actionButton.innerText.trim()
          : ""
      };
    }
    return new Promise((resolve) => {
      let clicked = false;
      let settled = false;
      const finish = (busyObserved, label) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        observer.disconnect();
        resolve({ clicked, busyObserved, label });
      };
      const inspect = () => {
        const currentProduct = byAttribute(document, "data-aihub-product-id", productId);
        const currentResource = byAttribute(
          document,
          "data-aihub-resource-id",
          resourceId
        );
        const currentRoot = extensionProfileId
          ? currentResource &&
            currentResource.getAttribute("data-aihub-extension-profile-id") ===
              extensionProfileId
            ? currentResource
            : null
          : currentProduct;
        const busyAction = ["install-product", "refresh-product"].includes(action)
          ? "product-busy"
          : action;
        const busyButton = currentRoot && byAttribute(
          currentRoot,
          "data-aihub-action",
          busyAction
        );
        if (busyButton instanceof HTMLButtonElement && busyButton.disabled) {
          finish(true, busyButton.innerText.trim());
        }
      };
      const observer = new MutationObserver(inspect);
      observer.observe(actionRoot, {
        attributes: true,
        attributeFilter: ["disabled", "data-aihub-action"],
        childList: true,
        subtree: true
      });
      const timeout = setTimeout(() => finish(false, ""), timeoutMs);
      actionButton.click();
      clicked = true;
      inspect();
    });
  })()`);
  if (result?.clicked !== true || result?.busyObserved !== true) {
    throw new Error(
      `Packaged DOM action did not expose disabled busy feedback: ${JSON.stringify({
        productId,
        resourceId,
        action,
        extensionProfileId,
        result
      })}`
    );
  }
  return result;
}

export function packagedManagedDownloadAction(status) {
  return status?.installed === true ? "refresh-product" : "install-product";
}

export function packagedManagedDownloadActionFromButtons(buttons) {
  if (!Array.isArray(buttons)) return "";
  const ready = buttons.find(
    (button) =>
      button?.disabled !== true &&
      (button?.action === "install-product" ||
        button?.action === "refresh-product")
  );
  return ready?.action || "";
}

export async function waitForPackagedManagedDownloadAction({
  evaluate,
  productId,
  timeoutMs = 10_000
}) {
  if (
    typeof evaluate !== "function" ||
    typeof productId !== "string" ||
    !productId ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1
  ) {
    throw new Error("Packaged managed download action input is invalid");
  }
  const deadline = Date.now() + timeoutMs;
  let buttons = [];
  while (Date.now() < deadline) {
    const snapshot = await evaluate(`(() => {
      const productId = ${JSON.stringify(productId)};
      const root = Array.from(document.querySelectorAll("[data-aihub-product-id]"))
        .find((element) => element.getAttribute("data-aihub-product-id") === productId);
      return {
        buttons: Array.from(root?.querySelectorAll(".productActions [data-aihub-action]") || [])
          .map((button) => ({
            label: button.innerText.trim(),
            action: button.getAttribute("data-aihub-action") || "",
            disabled: button.disabled
          }))
      };
    })()`);
    buttons = Array.isArray(snapshot?.buttons) ? snapshot.buttons : [];
    const action = packagedManagedDownloadActionFromButtons(buttons);
    if (action) {
      return {
        action,
        label: buttons.find((button) => button?.action === action)?.label || ""
      };
    }
    await delay(100);
  }
  throw new Error(
    `Packaged managed download action did not settle: ${JSON.stringify({
      productId,
      buttons
    })}`
  );
}

export async function openPackagedCatalogProduct({
  evaluate,
  vendorId,
  productId,
  searchText,
  directoryKind = "",
  timeoutMs = 10_000
}) {
  if (
    typeof evaluate !== "function" ||
    typeof vendorId !== "string" ||
    !vendorId ||
    typeof productId !== "string" ||
    !productId ||
    typeof searchText !== "string" ||
    !["", "ai-tool", "ai-connectable"].includes(directoryKind) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1
  ) {
    throw new Error("Packaged catalog navigation input is invalid");
  }
  const submitted = await evaluate(`(() => {
    const form = Array.from(document.querySelectorAll("form")).find(
      (element) => element.getAttribute("data-aihub-action") === "catalog-search"
    );
    const input = form && form.querySelector("input");
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
      return false;
    }
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    if (!setter) return false;
    setter.call(input, ${JSON.stringify(searchText)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.requestSubmit();
    return true;
  })()`);
  if (submitted !== true) {
    throw new Error("Packaged catalog search form was not available");
  }

  const deadline = Date.now() + timeoutMs;
  let vendorClicked = false;
  while (Date.now() < deadline) {
    vendorClicked = await evaluate(`(() => {
      const vendorId = ${JSON.stringify(vendorId)};
      const directoryKind = ${JSON.stringify(directoryKind)};
      const button = Array.from(
        document.querySelectorAll("button[data-aihub-vendor-id]")
      ).find((element) =>
        element.getAttribute("data-aihub-vendor-id") === vendorId &&
        (!directoryKind ||
          element.getAttribute("data-aihub-search-directory-kind") === directoryKind)
      );
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (vendorClicked === true) break;
    await delay(100);
  }
  if (!vendorClicked) {
    throw new Error(`Packaged vendor card was not available: ${vendorId}`);
  }

  while (Date.now() < deadline) {
    const productReady = await evaluate(`(() => {
      const productId = ${JSON.stringify(productId)};
      return Array.from(document.querySelectorAll("[data-aihub-product-id]")).some(
        (element) => element.getAttribute("data-aihub-product-id") === productId
      );
    })()`);
    if (productReady === true) {
      return { vendorId, productId, searchText };
    }
    await delay(100);
  }
  throw new Error(`Packaged product row was not available: ${productId}`);
}

export async function openPackagedResource({
  evaluate,
  storeId,
  productId,
  resourceId,
  timeoutMs = 10_000
}) {
  if (
    typeof evaluate !== "function" ||
    typeof storeId !== "string" ||
    !storeId ||
    typeof productId !== "string" ||
    !productId ||
    typeof resourceId !== "string" ||
    !resourceId ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1
  ) {
    throw new Error("Packaged resource input is invalid");
  }
  const deadline = Date.now() + timeoutMs;
  let lastResult = "not-started";
  while (Date.now() < deadline) {
    const result = await evaluate(`(() => {
      const storeId = ${JSON.stringify(storeId)};
      const productId = ${JSON.stringify(productId)};
      const resourceId = ${JSON.stringify(resourceId)};
      const detail = document.querySelector("[data-aihub-resource-detail-id]");
      if (detail?.getAttribute("data-aihub-resource-detail-id") === resourceId) {
        return "ready";
      }
      const resource = Array.from(
        document.querySelectorAll('button[data-aihub-action="open-resource-detail"]')
      ).find((element) => element.getAttribute("data-aihub-resource-id") === resourceId);
      if (resource instanceof HTMLButtonElement && !resource.disabled) {
        resource.click();
        return "resource-opened";
      }
      const product = Array.from(
        document.querySelectorAll('button[data-aihub-action="open-resource-tool"]')
      ).find(
        (element) =>
          element.getAttribute("data-aihub-resource-product-id") === productId
      );
      if (product instanceof HTMLButtonElement && !product.disabled) {
        product.click();
        return "product-opened";
      }
      let store = Array.from(
        document.querySelectorAll("button[data-aihub-resource-store-id]")
      ).find(
        (element) =>
          element.getAttribute("data-aihub-resource-store-id") === storeId
      );
      if (!(store instanceof HTMLButtonElement)) {
        const labels = {
          skill: "Skill 商店",
          mcp: "MCP 商店",
          plugin: "插件商店",
          connector: "连接器商店"
        };
        store = Array.from(document.querySelectorAll("button.navItem")).find(
          (element) => element.innerText.trim().includes(labels[storeId] || "")
        );
      }
      if (!(store instanceof HTMLButtonElement) || store.disabled) return "missing";
      if (!store.classList.contains("active")) store.click();
      return "store-opened";
    })()`);
    lastResult = result;
    if (result === "ready") {
      return { storeId, productId, resourceId, opened: true };
    }
    await delay(100);
  }
  const snapshot = await evaluate(`(async () => {
    const catalogResult = await window.aihubPC?.getCatalog?.();
    return ({
    stores: Array.from(document.querySelectorAll("button[data-aihub-resource-store-id]"))
      .map((element) => element.getAttribute("data-aihub-resource-store-id")),
    products: Array.from(document.querySelectorAll('button[data-aihub-action="open-resource-tool"]'))
      .map((element) => element.getAttribute("data-aihub-resource-product-id")),
    resources: Array.from(document.querySelectorAll('button[data-aihub-action="open-resource-detail"]'))
      .map((element) => element.getAttribute("data-aihub-resource-id")),
    detail: document.querySelector("[data-aihub-resource-detail-id]")
      ?.getAttribute("data-aihub-resource-detail-id") || "",
    catalogSource: catalogResult?.source || "",
    catalogError: catalogResult?.error || "",
    catalogVendors: catalogResult?.catalog?.vendors?.length || 0,
    catalogResources: catalogResult?.catalog?.resources?.length || 0,
    body: document.body.innerText.slice(0, 800)
  });
  })()`);
  throw new Error(
    `Packaged resource was not available: ${JSON.stringify({
      storeId,
      productId,
      resourceId,
      lastResult,
      snapshot,
    })}`
  );
}

function assertWithinTemporaryRoot(target, label) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const resolved = path.resolve(target);
  const relative = path.relative(temporaryRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must be a child of the system temporary directory`);
  }
  return resolved;
}

export async function availableLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("No loopback CDP port was available");
  }
  return port;
}

export function assertNoExistingAIHubProcesses() {
  if (process.platform !== "win32") return;
  const result = spawnSync(
    "C:\\Windows\\System32\\tasklist.exe",
    ["/FO", "CSV", "/NH"],
    { encoding: "utf8", windowsHide: true, shell: false }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error("Unable to inspect existing ZhenXing AI Assistant processes safely");
  }
  const names = String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => /^"([^"]+)"/.exec(line)?.[1] || "");
  if (names.some((name) =>
    name === "枕星AI助手.exe" ||
    name === "枕星 AI.exe" ||
    name === "AI Hub.exe" ||
    /^ZhenXing-AI-Local-.*-Portable\.exe$/i.test(name) ||
    /^AI-Hub-Local-.*-Portable\.exe$/i.test(name)
  )) {
    throw new Error(
      "Close the running ZhenXing AI Assistant client before packaged acceptance; the gate refuses to reuse or terminate a live user session"
    );
  }
}

export function createIsolatedAcceptanceProfile(prefix) {
  if (typeof prefix !== "string" || !/^aihub-[a-z0-9-]+-$/.test(prefix)) {
    throw new Error("Acceptance profile prefix is invalid");
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const appData = path.join(root, "Roaming");
  const localAppData = path.join(root, "Local");
  const userData = path.join(appData, "aihub-pc-client");
  const downloadDirectory = path.join(root, "downloads");
  const userHome = path.join(root, "user-home");
  const codexHome = path.join(root, "codex-home");
  for (const directory of [
    appData,
    localAppData,
    userData,
    downloadDirectory,
    userHome,
    codexHome
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(
    path.join(userData, "pc-settings.json"),
    `${JSON.stringify(
      { downloadDirectory, cliInstallDirectory: "", language: "zh" },
      null,
      2
    )}\n`,
    "utf8"
  );
  return {
    root,
    appData,
    localAppData,
    userData,
    downloadDirectory,
    userHome,
    codexHome
  };
}

export function createIsolatedAcceptanceEnvironment(
  profile,
  extraEnvironment = {}
) {
  const root = assertWithinTemporaryRoot(profile?.root || "", "Acceptance profile");
  const userHome = assertWithinTemporaryRoot(
    profile?.userHome || "",
    "Acceptance user home"
  );
  for (const [label, target] of [
    ["Acceptance user home", userHome],
    ["Acceptance app data", profile?.appData],
    ["Acceptance local app data", profile?.localAppData],
    ["Acceptance Codex home", profile?.codexHome]
  ]) {
    const resolved = assertWithinTemporaryRoot(target || "", label);
    const relative = path.relative(root, resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`${label} must stay inside the acceptance profile`);
    }
  }
  if (!extraEnvironment || typeof extraEnvironment !== "object") {
    throw new Error("Acceptance extra environment is invalid");
  }
  const environment = { ...process.env, ...extraEnvironment };
  const protectedKeys = new Set([
    "APPDATA",
    "LOCALAPPDATA",
    "USERPROFILE",
    "CODEX_HOME",
    "HOME",
    "HOMEDRIVE",
    "HOMEPATH"
  ]);
  for (const key of Object.keys(environment)) {
    if (protectedKeys.has(key.toUpperCase())) delete environment[key];
  }
  Object.assign(environment, {
    APPDATA: profile.appData,
    LOCALAPPDATA: profile.localAppData,
    USERPROFILE: userHome,
    CODEX_HOME: profile.codexHome
  });
  return environment;
}

function acceptanceProcessExists(processId) {
  const result = spawnSync(
    "C:\\Windows\\System32\\tasklist.exe",
    ["/FI", `PID eq ${processId}`, "/FO", "CSV", "/NH"],
    { encoding: "utf8", windowsHide: true, shell: false }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error("Unable to inspect packaged acceptance process safely");
  }
  return String(result.stdout || "").includes(`,\"${processId}\",`);
}

function assertAcceptanceProfileUnlocked(profile) {
  const root = assertWithinTemporaryRoot(profile?.root || "", "Acceptance profile");
  const probe = `${root}.release-probe-${process.pid}-${Date.now()}`;
  fs.renameSync(root, probe);
  fs.renameSync(probe, root);
}

export async function waitForAcceptanceProfileExit({
  profile,
  processId,
  timeoutMs = 10_000,
  pollIntervalMs = 100,
  processExists = acceptanceProcessExists,
  assertProfileUnlocked = assertAcceptanceProfileUnlocked
}) {
  assertWithinTemporaryRoot(profile?.root || "", "Acceptance profile");
  if (
    !Number.isSafeInteger(processId) ||
    processId < 1 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    !Number.isSafeInteger(pollIntervalMs) ||
    pollIntervalMs < 1 ||
    typeof processExists !== "function" ||
    typeof assertProfileUnlocked !== "function"
  ) {
    throw new Error("Acceptance process wait input is invalid");
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processExists(processId)) {
      try {
        assertProfileUnlocked(profile);
        return;
      } catch {
        // A child still holds the profile; keep polling until the deadline.
      }
    }
    await delay(pollIntervalMs);
  }
  throw new Error("Packaged acceptance process did not exit and release its isolated profile");
}

function stopAcceptanceProcess(processId) {
  if (process.platform !== "win32") return;
  const result = spawnSync(
    "C:\\Windows\\System32\\taskkill.exe",
    ["/PID", String(processId), "/T", "/F"],
    {
      stdio: "ignore",
      windowsHide: true,
      shell: false
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0 && acceptanceProcessExists(processId)) {
    throw new Error("Unable to stop packaged acceptance process safely");
  }
}

export async function removeIsolatedAcceptanceProfile(profile) {
  const root = assertWithinTemporaryRoot(profile?.root || "", "Acceptance profile");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 29) throw error;
      await delay(500);
    }
  }
}

const SHA256_HEX = /^[a-f0-9]{64}$/;
const EXTRACTION_ASAR_PATHS = [
  ["resources", "app.asar"],
  ["app", "resources", "app.asar"],
  ["7z-out", "resources", "app.asar"]
];

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function exactTemporaryChild(target, temporaryRoot) {
  const root = path.resolve(target);
  const temp = fs.realpathSync(path.resolve(temporaryRoot));
  if (path.dirname(root).toLowerCase() !== temp.toLowerCase()) throw new Error("PACKAGED_EXTRACTION_ROOT_INVALID");
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(root).toLowerCase() !== root.toLowerCase()) {
    throw new Error("PACKAGED_EXTRACTION_ROOT_INVALID");
  }
  return root;
}

function validateExactChannel(resources, relative, expectedSha256) {
  if (!expectedSha256) return null;
  const file = path.resolve(resources, ...relative);
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(file).toLowerCase() !== file.toLowerCase()) {
      throw new Error("PACKAGED_EXTRACTION_CHANNEL_INVALID");
    }
  } catch (error) {
    if (error?.message === "PACKAGED_EXTRACTION_CHANNEL_INVALID") throw error;
    throw new Error("PACKAGED_EXTRACTION_CHANNEL_INVALID");
  }
  if (sha256File(file) !== expectedSha256) throw new Error("PACKAGED_EXTRACTION_CHANNEL_MISMATCH");
  return file;
}

function validateExtractionRoot(root, appAsar, expectedPackageAsarSha256, temporaryRoot, expectedCatalogChannelSha256, expectedUpdateChannelSha256) {
  const exactRoot = exactTemporaryChild(root, temporaryRoot);
  const exactAsar = path.resolve(appAsar);
  const relative = path.relative(exactRoot, exactAsar);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("PACKAGED_EXTRACTION_ROOT_INVALID");
  const stat = fs.lstatSync(exactAsar);
  if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(exactAsar).toLowerCase() !== exactAsar.toLowerCase()) {
    throw new Error("PACKAGED_EXTRACTION_ROOT_INVALID");
  }
  if (sha256File(exactAsar) !== expectedPackageAsarSha256) throw new Error("PACKAGED_EXTRACTION_ASAR_MISMATCH");
  const resources = path.dirname(exactAsar);
  const catalogChannel = validateExactChannel(resources, ["catalog", "channel.json"], expectedCatalogChannelSha256);
  const updateChannel = validateExactChannel(resources, ["updates", "channel.json"], expectedUpdateChannelSha256);
  return { root: exactRoot, appAsar: exactAsar, catalogChannel, updateChannel };
}

function descendantsOf(processEntries, rootProcessId) {
  const descendants = new Set([rootProcessId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of processEntries) {
      if (descendants.has(entry.parentProcessId) && !descendants.has(entry.processId)) {
        descendants.add(entry.processId);
        changed = true;
      }
    }
  }
  return processEntries.filter((entry) => descendants.has(entry.processId));
}

function normalizeProcessEntries(processEntries) {
  if (!Array.isArray(processEntries)) throw new Error("PACKAGED_EXTRACTION_PROCESS_SNAPSHOT_INVALID");
  return processEntries.map((entry) => {
    if (!Number.isSafeInteger(entry?.processId) || entry.processId < 0 || !Number.isSafeInteger(entry?.parentProcessId) || entry.parentProcessId < 0) {
      throw new Error("PACKAGED_EXTRACTION_PROCESS_SNAPSHOT_INVALID");
    }
    return {
      processId: entry.processId,
      parentProcessId: entry.parentProcessId,
      creationDate: typeof entry.creationDate === "string" ? entry.creationDate : "",
      executablePath: typeof entry.executablePath === "string" ? entry.executablePath : ""
    };
  });
}

export function decodePackagedProcessSnapshot(result) {
  if (!result || typeof result !== "object" || result.error || result.status !== 0) {
    throw new Error("PACKAGED_EXTRACTION_PROCESS_SNAPSHOT_UNAVAILABLE");
  }
  let parsed;
  try {
    parsed = JSON.parse(typeof result.stdout === "string" && result.stdout.trim() ? result.stdout : "[]");
  } catch {
    throw new Error("PACKAGED_EXTRACTION_PROCESS_SNAPSHOT_INVALID");
  }
  return normalizeProcessEntries(Array.isArray(parsed) ? parsed : [parsed]);
}

export function bindPackagedExtractionRoots({
  rootProcessId,
  processEntries,
  expectedPackageAsarSha256,
  expectedCatalogChannelSha256,
  expectedUpdateChannelSha256,
  temporaryRoot = os.tmpdir()
}) {
  if (!Number.isSafeInteger(rootProcessId) || rootProcessId < 1 || !SHA256_HEX.test(expectedPackageAsarSha256 || "") ||
      (expectedCatalogChannelSha256 !== undefined && !SHA256_HEX.test(expectedCatalogChannelSha256 || "")) ||
      (expectedUpdateChannelSha256 !== undefined && !SHA256_HEX.test(expectedUpdateChannelSha256 || ""))) {
    throw new Error("PACKAGED_EXTRACTION_BINDING_INVALID");
  }
  const entries = normalizeProcessEntries(processEntries);
  const tree = descendantsOf(entries, rootProcessId);
  const temp = fs.realpathSync(path.resolve(temporaryRoot));
  const roots = new Map();
  for (const entry of tree) {
    if (!path.isAbsolute(entry.executablePath)) continue;
    const relative = path.relative(temp, path.resolve(entry.executablePath));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) continue;
    const root = path.join(temp, relative.split(path.sep)[0]);
    for (const parts of EXTRACTION_ASAR_PATHS) {
      const appAsar = path.join(root, ...parts);
      if (!fs.existsSync(appAsar)) continue;
      const binding = validateExtractionRoot(root, appAsar, expectedPackageAsarSha256, temp, expectedCatalogChannelSha256, expectedUpdateChannelSha256);
      roots.set(binding.root.toLowerCase(), binding);
    }
  }
  if (!roots.size) throw new Error("PACKAGED_EXTRACTION_ROOT_UNAVAILABLE");
  return {
    rootProcessId,
    expectedPackageAsarSha256,
    expectedCatalogChannelSha256,
    expectedUpdateChannelSha256,
    temporaryRoot: temp,
    processIdentities: tree.map(({ processId, creationDate }) => ({ processId, creationDate })),
    roots: [...roots.values()],
    rootCount: roots.size
  };
}

function processTreeAbsent(ownership, processEntries) {
  const entries = normalizeProcessEntries(processEntries);
  const identities = new Set(ownership.processIdentities.map((entry) => `${entry.processId}:${entry.creationDate}`));
  return entries.every((entry) => {
    if (identities.has(`${entry.processId}:${entry.creationDate}`)) return false;
    if (!path.isAbsolute(entry.executablePath)) return true;
    const executable = path.resolve(entry.executablePath);
    return ownership.roots.every(({ root }) => {
      const relative = path.relative(root, executable);
      return relative.startsWith("..") || path.isAbsolute(relative);
    });
  });
}

function hasInternalReparse(root) {
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) return true;
      if (stat.isDirectory()) pending.push(target);
    }
  }
  return false;
}

export function cleanupPackagedExtractionRoots({ ownership, processEntries }) {
  const existingCount = () => ownership.roots.filter(({ root }) => fs.existsSync(root)).length;
  let treeAbsent = false;
  try {
    treeAbsent = processTreeAbsent(ownership, processEntries);
  } catch {
    return { treeAbsent: false, extractionRootCount: existingCount(), extractionCleanupSucceeded: false };
  }
  if (!treeAbsent) return { treeAbsent: false, extractionRootCount: existingCount(), extractionCleanupSucceeded: false };
  try {
    for (const binding of ownership.roots) {
      if (!fs.existsSync(binding.root)) continue;
      validateExtractionRoot(binding.root, binding.appAsar, ownership.expectedPackageAsarSha256, ownership.temporaryRoot, ownership.expectedCatalogChannelSha256, ownership.expectedUpdateChannelSha256);
      if (hasInternalReparse(binding.root)) throw new Error("PACKAGED_EXTRACTION_ROOT_INVALID");
    }
    for (const { root } of ownership.roots) {
      if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
    }
  } catch {
    return { treeAbsent: true, extractionRootCount: existingCount(), extractionCleanupSucceeded: false };
  }
  const extractionRootCount = existingCount();
  return { treeAbsent: true, extractionRootCount, extractionCleanupSucceeded: extractionRootCount === 0 };
}

function listPackagedProcessSnapshot() {
  if (process.platform !== "win32") throw new Error("PACKAGED_EXTRACTION_PROCESS_SNAPSHOT_UNAVAILABLE");
  const command = [
    "$ErrorActionPreference='Stop'",
    "@(Get-CimInstance Win32_Process|Select-Object @{n='processId';e={[int]$_.ProcessId}},@{n='parentProcessId';e={[int]$_.ParentProcessId}},@{n='creationDate';e={[string]$_.CreationDate}},@{n='executablePath';e={[string]$_.ExecutablePath}})|ConvertTo-Json -Compress"
  ].join(";");
  const result = spawnSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: 20_000
  });
  return decodePackagedProcessSnapshot(result);
}

function mergeProcessHistory(history, snapshot) {
  const merged = new Map(history.map((entry) => [`${entry.processId}:${entry.creationDate}`, entry]));
  for (const entry of snapshot) merged.set(`${entry.processId}:${entry.creationDate}`, entry);
  return [...merged.values()];
}

async function closePackagedLauncher({ launcher, socket, profile, ownership }) {
  try { socket?.close(); } catch {}
  let closeFailed = false;
  try { stopAcceptanceProcess(launcher.pid); } catch { closeFailed = true; }
  try { await waitForAcceptanceProfileExit({ profile, processId: launcher.pid }); } catch { closeFailed = true; }
  if (!ownership) {
    if (closeFailed) throw new Error("PACKAGED_CLIENT_CLOSE_FAILED");
    return { treeAbsent: true, extractionRootCount: 0, extractionCleanupSucceeded: true };
  }
  let cleanup;
  try {
    cleanup = cleanupPackagedExtractionRoots({ ownership, processEntries: listPackagedProcessSnapshot() });
  } catch {
    cleanup = {
      treeAbsent: false,
      extractionRootCount: ownership.roots.filter(({ root }) => fs.existsSync(root)).length,
      extractionCleanupSucceeded: false
    };
  }
  if (closeFailed || !cleanup.treeAbsent || !cleanup.extractionCleanupSucceeded || cleanup.extractionRootCount !== 0) {
    const error = new Error("PACKAGED_EXTRACTION_CLEANUP_FAILED");
    error.cleanup = cleanup;
    throw error;
  }
  return cleanup;
}

function createCdpConnection(socket) {
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error("CDP connection closed before the command completed"));
    }
    pending.clear();
  });
  function send(method, params = {}, timeoutMs = 15_000) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression, timeoutMs = 15_000) {
    const result = await send(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true
      },
      timeoutMs
    );
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description || "CDP evaluation failed"
      );
    }
    return result.result.value;
  }
  return { send, evaluate };
}

export async function openCdpWebSocket({
  debuggerUrl,
  timeoutMs,
  createSocket = (url) => new WebSocket(url),
  onFailure = () => {}
}) {
  if (
    typeof debuggerUrl !== "string" ||
    !debuggerUrl ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    typeof createSocket !== "function" ||
    typeof onFailure !== "function"
  ) {
    throw new Error("CDP WebSocket handshake input is invalid");
  }
  let socket;
  try {
    socket = createSocket(debuggerUrl);
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        callback(value);
      };
      const onOpen = () => finish(resolve);
      const onError = (event) =>
        finish(
          reject,
          event instanceof Error ? event : new Error("CDP WebSocket handshake failed")
        );
      const timeout = setTimeout(
        () => finish(reject, new Error("CDP WebSocket handshake timed out")),
        timeoutMs
      );
      socket.addEventListener("open", onOpen, { once: true });
      socket.addEventListener("error", onError, { once: true });
    });
    return socket;
  } catch (error) {
    try {
      socket?.close();
    } catch {
      // Preserve the handshake failure.
    }
    try {
      onFailure();
    } catch {
      // Preserve the handshake failure.
    }
    throw error;
  }
}

export async function launchPackagedClientCdp({
  executable,
  profile,
  expectedPackageAsarSha256,
  expectedCatalogChannelSha256,
  expectedUpdateChannelSha256,
  appArguments = [],
  extraEnvironment = {},
  assertNoExistingClient = true,
  startupTimeoutMs = 30_000
}) {
  if (!path.isAbsolute(executable) || !fs.statSync(executable).isFile()) {
    throw new Error(`Packaged acceptance client is missing: ${executable}`);
  }
  if ((expectedPackageAsarSha256 !== undefined && !SHA256_HEX.test(expectedPackageAsarSha256 || "")) ||
      (expectedCatalogChannelSha256 !== undefined && !SHA256_HEX.test(expectedCatalogChannelSha256 || "")) ||
      (expectedUpdateChannelSha256 !== undefined && !SHA256_HEX.test(expectedUpdateChannelSha256 || ""))) {
    throw new Error("PACKAGED_EXTRACTION_BINDING_INVALID");
  }
  assertWithinTemporaryRoot(profile?.root || "", "Acceptance profile");
  assertWithinTemporaryRoot(profile?.userData || "", "Acceptance user data");
  assertWithinTemporaryRoot(profile?.userHome || "", "Acceptance user home");
  if (assertNoExistingClient) assertNoExistingAIHubProcesses();
  const port = await availableLoopbackPort();
  const launcher = spawn(
    executable,
    [
      ...appArguments,
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile.userData}`
    ],
    {
      detached: true,
      env: createIsolatedAcceptanceEnvironment(profile, extraEnvironment),
      stdio: "ignore",
      windowsHide: true,
      shell: false
    }
  );
  launcher.unref();

  let target;
  let processHistory = [];
  const captureProcessTree = () => {
    if (!expectedPackageAsarSha256) return;
    processHistory = mergeProcessHistory(processHistory, listPackagedProcessSnapshot());
  };
  const deadline = Date.now() + startupTimeoutMs;
  try {
    while (Date.now() < deadline) {
      captureProcessTree();
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json`);
        const targets = await response.json();
        target = targets.find((item) => item.type === "page");
        if (target) break;
      } catch {
        // The isolated packaged client is still starting.
      }
      await delay(250);
    }
    captureProcessTree();
  } catch (error) {
    try { stopAcceptanceProcess(launcher.pid); } catch {}
    try { await waitForAcceptanceProfileExit({ profile, processId: launcher.pid }); } catch {}
    throw error;
  }
  let ownership = null;
  try {
    ownership = expectedPackageAsarSha256 ? bindPackagedExtractionRoots({
      rootProcessId: launcher.pid,
      processEntries: processHistory,
      expectedPackageAsarSha256,
      expectedCatalogChannelSha256,
      expectedUpdateChannelSha256
    }) : null;
  } catch (error) {
    try { stopAcceptanceProcess(launcher.pid); } catch {}
    try { await waitForAcceptanceProfileExit({ profile, processId: launcher.pid }); } catch {}
    throw error;
  }
  if (!target) {
    await closePackagedLauncher({ launcher, profile, ownership });
    throw new Error("Packaged acceptance client did not expose a CDP page");
  }
  const debuggerUrl = new URL(target.webSocketDebuggerUrl);
  if (
    debuggerUrl.protocol !== "ws:" ||
    !["127.0.0.1", "localhost"].includes(debuggerUrl.hostname) ||
    Number(debuggerUrl.port) !== port
  ) {
    await closePackagedLauncher({ launcher, profile, ownership });
    throw new Error("Packaged acceptance exposed a non-loopback CDP target");
  }
  let socket;
  let connection;
  let connectionFailureHandled = false;
  const cleanupFailedConnection = () => {
    if (connectionFailureHandled) return;
    connectionFailureHandled = true;
    stopAcceptanceProcess(launcher.pid);
  };
  try {
    socket = await openCdpWebSocket({
      debuggerUrl: debuggerUrl.href,
      timeoutMs: Math.max(1, deadline - Date.now()),
      onFailure: cleanupFailedConnection
    });
    connection = createCdpConnection(socket);
    await connection.send("Runtime.enable");
  } catch (error) {
    socket?.close();
    cleanupFailedConnection();
    await closePackagedLauncher({ launcher, socket, profile, ownership });
    throw error;
  }
  return {
    processId: launcher.pid,
    target,
    runtimeClosure: ownership?.roots[0] || null,
    send: connection.send,
    evaluate: connection.evaluate,
    async close() {
      return closePackagedLauncher({ launcher, socket, profile, ownership });
    }
  };
}

export async function verifyManagedDownloadPause({
  evaluate,
  productId,
  downloadDirectory,
  startDownload = null,
  pauseDownload = null,
  minimumBytes = 1024 * 1024,
  timeoutMs = 120_000
}) {
  if (
    typeof evaluate !== "function" ||
    typeof productId !== "string" ||
    !productId ||
    typeof downloadDirectory !== "string" ||
    !path.isAbsolute(downloadDirectory) ||
    (startDownload !== null && typeof startDownload !== "function") ||
    (pauseDownload !== null && typeof pauseDownload !== "function") ||
    !Number.isSafeInteger(minimumBytes) ||
    minimumBytes < 1 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1
  ) {
    throw new Error("Managed download gate input is invalid");
  }
  const usesDomActions = startDownload !== null || pauseDownload !== null;
  const readinessExpression = usesDomActions
    ? "Boolean(window.aihubPC?.getDownloadTask)"
    : "Boolean(window.aihubPC?.startDownload && window.aihubPC?.getDownloadTask && window.aihubPC?.pauseDownload)";
  const readyDeadline = Date.now() + 20_000;
  while (Date.now() < readyDeadline) {
    if (await evaluate(readinessExpression)) break;
    await delay(250);
  }
  if (!(await evaluate(readinessExpression))) {
    throw new Error("Managed download API was not available in the packaged client");
  }
  const encodedProductId = JSON.stringify(productId);
  const started = startDownload
    ? await startDownload({ evaluate, productId, timeoutMs })
    : await evaluate(`window.aihubPC.startDownload(${encodedProductId})`);
  if (!started?.ok) {
    throw new Error(`Managed download did not start: ${JSON.stringify(started)}`);
  }
  const deadline = Date.now() + timeoutMs;
  let task = started.task;
  while (Date.now() < deadline) {
    task = await evaluate(`window.aihubPC.getDownloadTask(${encodedProductId})`);
    if (task?.phase === "failed") {
      throw new Error(
        `Managed download failed before pause: ${JSON.stringify({
          code: task.errorCode,
          message: task.errorMessage
        })}`
      );
    }
    if (task?.phase === "completed") {
      throw new Error("Managed download completed before the pause gate could run");
    }
    if ((task?.progress?.receivedBytes || 0) >= minimumBytes) {
      const paused = pauseDownload
        ? await pauseDownload({ evaluate, productId, task, timeoutMs })
        : await evaluate(`window.aihubPC.pauseDownload(${encodedProductId})`);
      const pausedBytes = paused?.task?.progress?.receivedBytes;
      const taskDirectory = paused?.task?.progress?.downloadDirectory;
      const expectedDirectory = path.resolve(downloadDirectory);
      const sameDirectory =
        typeof taskDirectory === "string" &&
        path.resolve(taskDirectory).toLowerCase() === expectedDirectory.toLowerCase();
      if (
        paused?.ok !== true ||
        paused?.task?.phase !== "paused"
      ) {
        throw new Error(`Managed download did not pause: ${JSON.stringify(paused)}`);
      }
      if (
        paused?.task?.resumable !== true ||
        !Number.isSafeInteger(pausedBytes) ||
        pausedBytes < minimumBytes ||
        !sameDirectory
      ) {
        throw new Error(
          `Managed download durable partial did not satisfy the pause gate: ${JSON.stringify(paused)}`
        );
      }
      const directoryStat = fs.lstatSync(expectedDirectory);
      const canonicalDirectory = fs.realpathSync.native(expectedDirectory);
      if (
        !directoryStat.isDirectory() ||
        directoryStat.isSymbolicLink() ||
        canonicalDirectory.toLowerCase() !== expectedDirectory.toLowerCase()
      ) {
        throw new Error("Managed download durable partial directory is invalid");
      }
      const partials = fs
        .readdirSync(canonicalDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".part"))
        .map((entry) => path.join(canonicalDirectory, entry.name));
      if (partials.length !== 1) {
        throw new Error("Managed download durable partial was not uniquely identified");
      }
      const partialPath = partials[0];
      const partialStat = fs.lstatSync(partialPath);
      const canonicalPartial = fs.realpathSync.native(partialPath);
      if (
        !partialStat.isFile() ||
        partialStat.isSymbolicLink() ||
        path.dirname(canonicalPartial).toLowerCase() !==
          canonicalDirectory.toLowerCase() ||
        partialStat.size !== pausedBytes ||
        partialStat.size < minimumBytes
      ) {
        throw new Error("Managed download durable partial did not reach the gate");
      }
      return {
        productId,
        phase: paused.task.phase,
        receivedBytes: pausedBytes,
        partialPath: canonicalPartial
      };
    }
    await delay(250);
  }
  throw new Error(`Managed download did not reach the pause threshold: ${JSON.stringify(task)}`);
}
