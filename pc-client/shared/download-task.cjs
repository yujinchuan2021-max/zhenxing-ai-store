"use strict";

const SCHEMA_VERSION = 1;
const MAX_LOGS = 40;
const PHASES = new Set([
  "queued",
  "starting",
  "downloading",
  "pausing",
  "paused",
  "failed",
  "canceling",
  "canceled",
  "completed"
]);
const PUBLIC_MANAGED_DOWNLOAD_PHASES = new Set([
  "queued",
  "downloading",
  "downloaded",
  "failed",
  "cancelled"
]);
const CANCELLABLE_PHASES = new Set([
  "queued",
  "starting",
  "downloading",
  "pausing",
  "paused",
  "failed",
  "canceling"
]);
const PROGRESS_FIELDS = [
  "receivedBytes",
  "totalBytes",
  "bytesPerSecond",
  "etaSeconds",
  "percent",
  "availableBytes",
  "requiredBytes",
  "remainingBytes",
  "reserveBytes",
  "installDiskBytes",
  "installAvailableBytes"
];
const NULLABLE_PROGRESS_FIELDS = new Set([
  "etaSeconds",
  "percent",
  "availableBytes",
  "requiredBytes",
  "remainingBytes",
  "reserveBytes",
  "installDiskBytes",
  "installAvailableBytes"
]);

const EMPTY_PROGRESS = Object.freeze({
  receivedBytes: 0,
  totalBytes: 0,
  bytesPerSecond: 0,
  etaSeconds: null,
  percent: null,
  availableBytes: null,
  requiredBytes: null,
  remainingBytes: null,
  reserveBytes: null,
  installDiskBytes: null,
  installAvailableBytes: null,
  downloadDirectory: null,
  installSpaceOk: null,
  spaceOk: null
});

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value) {
  return value === null || typeof value === "string";
}

function isFiniteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeTime(value) {
  let candidate = value;
  try {
    if (typeof candidate === "function") candidate = candidate();
    if (candidate instanceof Date) candidate = candidate.getTime();
    if (
      typeof candidate !== "string" &&
      typeof candidate !== "number"
    ) {
      return null;
    }
    const timestamp = new Date(candidate);
    return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : null;
  } catch {
    return null;
  }
}

function eventTime(options) {
  return isRecord(options) && hasOwn(options, "now")
    ? normalizeTime(options.now)
    : null;
}

function normalizeProgress(value, fallback = EMPTY_PROGRESS) {
  if (value !== undefined && !isRecord(value)) return null;
  const patch = value || {};
  const normalized = {};

  for (const field of PROGRESS_FIELDS) {
    const candidate = hasOwn(patch, field) ? patch[field] : fallback[field];
    if (candidate === null && NULLABLE_PROGRESS_FIELDS.has(field)) {
      normalized[field] = null;
      continue;
    }
    if (!isFiniteNonNegative(candidate)) return null;
    normalized[field] = candidate;
  }

  for (const field of ["installSpaceOk", "spaceOk"]) {
    const candidate = hasOwn(patch, field) ? patch[field] : fallback[field];
    if (candidate !== null && typeof candidate !== "boolean") return null;
    normalized[field] = candidate;
  }
  const downloadDirectory = hasOwn(patch, "downloadDirectory")
    ? patch.downloadDirectory
    : fallback.downloadDirectory;
  if (downloadDirectory !== null && typeof downloadDirectory !== "string") {
    return null;
  }
  normalized.downloadDirectory = downloadDirectory;

  if (normalized.percent !== null && normalized.percent > 100) return null;
  return normalized;
}

function artifactFieldsAreEmpty(value) {
  return (
    value.filePath === null &&
    value.sha256 === null &&
    value.fileSize === null
  );
}

function phaseInvariantsHold(value) {
  if (value.phase === "completed") {
    return (
      isNonEmptyString(value.filePath) &&
      isNonEmptyString(value.sha256) &&
      Number.isSafeInteger(value.fileSize) &&
      value.fileSize >= 0 &&
      value.resumable === false &&
      value.errorCode === null &&
      value.errorMessage === null
    );
  }

  if (!artifactFieldsAreEmpty(value)) return false;

  if (value.phase === "failed") {
    return isNonEmptyString(value.errorMessage);
  }

  if (value.errorCode !== null || value.errorMessage !== null) return false;

  if (
    (value.phase === "starting" ||
      value.phase === "canceling" ||
      value.phase === "canceled") &&
    value.resumable
  ) {
    return false;
  }

  return true;
}

function restoreDownloadTask(value) {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== SCHEMA_VERSION) return null;
  if (!isNonEmptyString(value.productId)) return null;
  if (!isNonEmptyString(value.attemptId)) return null;
  if (!Number.isSafeInteger(value.attempt) || value.attempt < 1) return null;
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) return null;
  if (!PHASES.has(value.phase)) return null;
  if (typeof value.resumable !== "boolean") return null;
  if (!isNullableString(value.errorCode)) return null;
  if (!isNullableString(value.errorMessage)) return null;
  if (!isNullableString(value.filePath)) return null;
  if (!isNullableString(value.sha256)) return null;
  if (
    value.fileSize !== null &&
    (!Number.isSafeInteger(value.fileSize) || value.fileSize < 0)
  ) {
    return null;
  }

  const progress = normalizeProgress(value.progress);
  if (!progress) return null;

  const createdAt = normalizeTime(value.createdAt);
  const updatedAt = normalizeTime(value.updatedAt);
  if (!createdAt || !updatedAt) return null;
  if (Date.parse(updatedAt) < Date.parse(createdAt)) return null;

  if (
    !Array.isArray(value.logs) ||
    value.logs.length > MAX_LOGS ||
    value.logs.some((entry) => !isNonEmptyString(entry))
  ) {
    return null;
  }

  const restored = {
    schemaVersion: SCHEMA_VERSION,
    productId: value.productId,
    attemptId: value.attemptId,
    attempt: value.attempt,
    revision: value.revision,
    phase: value.phase,
    resumable: value.resumable,
    progress,
    errorCode: value.errorCode,
    errorMessage: value.errorMessage,
    filePath: value.filePath,
    sha256: value.sha256,
    fileSize: value.fileSize,
    createdAt,
    updatedAt,
    logs: [...value.logs]
  };

  return phaseInvariantsHold(restored) ? restored : null;
}

function publicManagedDownloadPhase(phase) {
  if (phase === "completed") return "downloaded";
  if (phase === "canceled") return "cancelled";
  if (phase === "queued" || phase === "starting") return "queued";
  if (["downloading", "pausing", "paused", "canceling"].includes(phase)) {
    return "downloading";
  }
  return phase === "failed" ? "failed" : null;
}

function publicManagedDownloadProgress(value) {
  const receivedBytes = Number.isSafeInteger(value?.receivedBytes) && value.receivedBytes >= 0
    ? value.receivedBytes
    : 0;
  const totalBytes = Number.isSafeInteger(value?.totalBytes) && value.totalBytes >= 0
    ? value.totalBytes
    : 0;
  const bytesPerSecond = Number.isSafeInteger(value?.bytesPerSecond) && value.bytesPerSecond >= 0
    ? value.bytesPerSecond
    : 0;
  const percent = Number.isFinite(value?.percent) && value.percent >= 0 && value.percent <= 100
    ? value.percent
    : null;
  return Object.freeze({ receivedBytes, totalBytes, bytesPerSecond, percent });
}

function projectManagedDownloadTask(task, { profileId = "" } = {}) {
  if (
    !isRecord(task) ||
    !isNonEmptyString(task.productId) ||
    !isNonEmptyString(task.attemptId) ||
    !PHASES.has(task.phase) ||
    typeof profileId !== "string" ||
    profileId.length > 160
  ) return null;
  const phase = publicManagedDownloadPhase(task.phase);
  if (!PUBLIC_MANAGED_DOWNLOAD_PHASES.has(phase)) return null;
  const canCancel = CANCELLABLE_PHASES.has(task.phase);
  const canRetry = task.phase === "failed" || task.phase === "canceled";
  return Object.freeze({
    taskId: task.attemptId,
    productId: task.productId,
    profileId,
    phase,
    progress: publicManagedDownloadProgress(task.progress),
    ...(isNonEmptyString(task.errorCode) ? { errorCode: task.errorCode } : {}),
    presentation: Object.freeze({
      state: phase === "downloaded" ? "completed" : phase === "failed" || phase === "cancelled" ? "failed" : "active",
      canCancel,
      canRetry
    })
  });
}

function plainObject(value) {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function safeCancelId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 160;
}

function validateManagedDownloadCancelRequest(value) {
  if (!plainObject(value)) return null;
  const fields = Object.keys(value);
  if (
    fields.length !== 3 ||
    !fields.every((field) => ["productId", "taskId", "confirmed"].includes(field)) ||
    !safeCancelId(value.productId) ||
    !safeCancelId(value.taskId) ||
    value.confirmed !== true
  ) return null;
  return Object.freeze({ productId: value.productId, taskId: value.taskId, confirmed: true });
}

function rejectManagedDownloadCancellation(errorCode) {
  return Object.freeze({ ok: false, errorCode });
}

function authorizeManagedDownloadCancellation({ request, task, plan } = {}) {
  const confirmed = validateManagedDownloadCancelRequest(request);
  if (!confirmed) return rejectManagedDownloadCancellation("DOWNLOAD_CANCEL_REQUEST_INVALID");
  if (!plan) return rejectManagedDownloadCancellation("DOWNLOAD_PLAN_NOT_FOUND");
  if (!isRecord(task)) return rejectManagedDownloadCancellation("DOWNLOAD_TASK_NOT_FOUND");
  if (task.productId !== confirmed.productId || task.attemptId !== confirmed.taskId) {
    return rejectManagedDownloadCancellation("DOWNLOAD_ATTEMPT_MISMATCH");
  }
  if (task.phase === "completed") return rejectManagedDownloadCancellation("DOWNLOAD_ALREADY_COMPLETED");
  if (!CANCELLABLE_PHASES.has(task.phase)) return rejectManagedDownloadCancellation("DOWNLOAD_NOT_CANCELLABLE");
  return Object.freeze({ ok: true, productId: confirmed.productId, attemptId: confirmed.taskId });
}

function appendLog(logs, message) {
  return [...logs, message].slice(-MAX_LOGS);
}

function rejected(current, restored) {
  return {
    accepted: false,
    task: restored && current === restored ? restored : current
  };
}

function validEventIdentity(task, event) {
  if (!isNonEmptyString(event.attemptId)) return false;
  if (event.attemptId !== task.attemptId) return false;
  return (
    event.productId === undefined ||
    (isNonEmptyString(event.productId) &&
      event.productId === task.productId)
  );
}

function withState(task, timestamp, changes, logMessage) {
  const updatedAt =
    Date.parse(timestamp) < Date.parse(task.updatedAt)
      ? task.updatedAt
      : timestamp;
  return {
    ...task,
    ...changes,
    revision: task.revision + 1,
    updatedAt,
    logs: logMessage ? appendLog(task.logs, logMessage) : [...task.logs]
  };
}

function applyDownloadTaskEvent(current, event, options) {
  const timestamp = eventTime(options);
  if (!timestamp || !isRecord(event) || !isNonEmptyString(event.type)) {
    return rejected(current, null);
  }

  if (event.type === "start" || event.type === "queue") {
    if (current !== null && current !== undefined) return rejected(current, null);
    if (
      !isNonEmptyString(event.productId) ||
      !isNonEmptyString(event.attemptId)
    ) {
      return { accepted: false, task: null };
    }
    const initialProgress = normalizeProgress(event.progress);
    if (!initialProgress) return { accepted: false, task: null };
    return {
      accepted: true,
      task: {
        schemaVersion: SCHEMA_VERSION,
        productId: event.productId,
        attemptId: event.attemptId,
        attempt: 1,
        revision: 1,
        phase: event.type === "queue" ? "queued" : "starting",
        resumable: false,
        progress: initialProgress,
        errorCode: null,
        errorMessage: null,
        filePath: null,
        sha256: null,
        fileSize: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        logs: [event.type === "queue" ? "已加入下载队列" : "开始下载"]
      }
    };
  }

  const task = restoreDownloadTask(current);
  if (!task) return { accepted: false, task: current ?? null };

  if (event.type === "begin") {
    if (!validEventIdentity(task, event) || task.phase !== "queued") {
      return rejected(current, task);
    }
    return {
      accepted: true,
      task: withState(task, timestamp, {
        phase: "starting",
        resumable: false
      }, "开始下载")
    };
  }

  if (event.type === "retry" || event.type === "queue") {
    if (
      !["failed", "paused", "canceled", "completed"].includes(task.phase) ||
      !isNonEmptyString(event.attemptId) ||
      event.attemptId === task.attemptId ||
      (event.productId !== undefined &&
        event.productId !== task.productId)
    ) {
      return rejected(current, task);
    }
    const queuedProgress = event.type === "queue" && event.progress !== undefined
      ? normalizeProgress(event.progress)
      : { ...EMPTY_PROGRESS };
    if (!queuedProgress) return rejected(current, task);
    return {
      accepted: true,
      task: withState(
        task,
        timestamp,
        {
          attemptId: event.attemptId,
          attempt: task.attempt + 1,
          phase: event.type === "queue" ? "queued" : "starting",
          resumable: event.type === "queue" && event.resumable === true,
          progress: queuedProgress,
          errorCode: null,
          errorMessage: null,
          filePath: null,
          sha256: null,
          fileSize: null
        },
        event.type === "queue"
          ? `已加入第 ${task.attempt + 1} 次下载队列`
          : `开始第 ${task.attempt + 1} 次下载`
      )
    };
  }

  if (!validEventIdentity(task, event)) return rejected(current, task);

  if (event.type === "progress") {
    if (!["starting", "downloading"].includes(task.phase)) {
      return rejected(current, task);
    }
    const nextProgress = normalizeProgress(event.progress, task.progress);
    if (
      !nextProgress ||
      (event.resumable !== undefined &&
        typeof event.resumable !== "boolean")
    ) {
      return rejected(current, task);
    }
    return {
      accepted: true,
      task: withState(task, timestamp, {
        phase: "downloading",
        progress: nextProgress,
        resumable:
          event.resumable === undefined
            ? task.resumable
            : event.resumable
      })
    };
  }

  if (event.type === "pause-requested") {
    if (!["starting", "downloading"].includes(task.phase)) {
      return rejected(current, task);
    }
    return {
      accepted: true,
      task: withState(
        task,
        timestamp,
        { phase: "pausing" },
        "正在暂停下载"
      )
    };
  }

  if (event.type === "pause") {
    if (
      !["starting", "downloading", "pausing"].includes(task.phase) ||
      typeof event.resumable !== "boolean"
    ) {
      return rejected(current, task);
    }
    const nextProgress = normalizeProgress(event.progress, task.progress);
    if (!nextProgress) return rejected(current, task);
    return {
      accepted: true,
      task: withState(
        task,
        timestamp,
        {
          phase: "paused",
          resumable: event.resumable,
          progress: nextProgress,
          errorCode: null,
          errorMessage: null
        },
        "下载已暂停"
      )
    };
  }

  if (event.type === "failed") {
    if (
      !["starting", "downloading", "pausing"].includes(task.phase) ||
      typeof event.resumable !== "boolean" ||
      !isNonEmptyString(event.errorMessage) ||
      (event.errorCode !== undefined &&
        typeof event.errorCode !== "string")
    ) {
      return rejected(current, task);
    }
    const nextProgress = normalizeProgress(event.progress, task.progress);
    if (!nextProgress) return rejected(current, task);
    return {
      accepted: true,
      task: withState(
        task,
        timestamp,
        {
          phase: "failed",
          resumable: event.resumable,
          progress: nextProgress,
          errorCode: event.errorCode || null,
          errorMessage: event.errorMessage,
          filePath: null,
          sha256: null,
          fileSize: null
        },
        event.resumable ? "下载失败，可继续" : "下载失败，需重新下载"
      )
    };
  }

  if (event.type === "cancel-cleanup-failed") {
    if (
      task.phase !== "canceling" ||
      typeof event.resumable !== "boolean" ||
      !["CANCEL_CLEANUP_FAILED", "PARTIAL_RECEIPT_INVALID"].includes(
        event.errorCode
      ) ||
      !isNonEmptyString(event.errorMessage)
    ) {
      return rejected(current, task);
    }
    const nextProgress = normalizeProgress(event.progress, task.progress);
    if (!nextProgress) return rejected(current, task);
    return {
      accepted: true,
      task: withState(
        task,
        timestamp,
        {
          phase: "failed",
          resumable: event.resumable,
          progress: nextProgress,
          errorCode: event.errorCode,
          errorMessage: event.errorMessage,
          filePath: null,
          sha256: null,
          fileSize: null
        },
        "取消断点清理失败，可重试"
      )
    };
  }

  if (event.type === "cancel-requested") {
    if (
      !["queued", "starting", "downloading", "pausing", "paused", "failed"].includes(
        task.phase
      )
    ) {
      return rejected(current, task);
    }
    return {
      accepted: true,
      task: withState(
        task,
        timestamp,
        {
          phase: "canceling",
          resumable: false,
          errorCode: null,
          errorMessage: null
        },
        "正在取消下载"
      )
    };
  }

  if (event.type === "cancel") {
    if (
      ![
        "queued",
        "starting",
        "downloading",
        "pausing",
        "paused",
        "failed",
        "canceling"
      ].includes(task.phase)
    ) {
      return rejected(current, task);
    }
    return {
      accepted: true,
      task: withState(
        task,
        timestamp,
        {
          phase: "canceled",
          resumable: false,
          errorCode: null,
          errorMessage: null,
          filePath: null,
          sha256: null,
          fileSize: null
        },
        "下载已取消"
      )
    };
  }

  if (
    event.type === "completed" ||
    event.type === "recover-completed"
  ) {
    const allowedPhase =
      event.type === "recover-completed"
        ? task.phase === "canceling"
        : ["starting", "downloading", "pausing"].includes(task.phase);
    if (
      !allowedPhase ||
      !isNonEmptyString(event.filePath) ||
      !isNonEmptyString(event.sha256) ||
      !Number.isSafeInteger(event.fileSize) ||
      event.fileSize < 0
    ) {
      return rejected(current, task);
    }
    const nextProgress = normalizeProgress(event.progress, task.progress);
    if (!nextProgress) return rejected(current, task);
    return {
      accepted: true,
      task: withState(
        task,
        timestamp,
        {
          phase: "completed",
          resumable: false,
          progress: nextProgress,
          errorCode: null,
          errorMessage: null,
          filePath: event.filePath,
          sha256: event.sha256,
          fileSize: event.fileSize
        },
        "下载完成"
      )
    };
  }

  return rejected(current, task);
}

module.exports = {
  applyDownloadTaskEvent,
  restoreDownloadTask,
  projectManagedDownloadTask,
  authorizeManagedDownloadCancellation,
  validateManagedDownloadCancelRequest
};
