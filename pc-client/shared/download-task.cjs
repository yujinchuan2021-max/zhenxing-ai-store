"use strict";

const SCHEMA_VERSION = 1;
const MAX_LOGS = 40;
const PHASES = new Set([
  "starting",
  "downloading",
  "pausing",
  "paused",
  "failed",
  "canceling",
  "canceled",
  "completed"
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

  if (event.type === "start") {
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
        phase: "starting",
        resumable: false,
        progress: initialProgress,
        errorCode: null,
        errorMessage: null,
        filePath: null,
        sha256: null,
        fileSize: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        logs: ["开始下载"]
      }
    };
  }

  const task = restoreDownloadTask(current);
  if (!task) return { accepted: false, task: current ?? null };

  if (event.type === "retry") {
    if (
      !["failed", "paused", "canceled", "completed"].includes(task.phase) ||
      !isNonEmptyString(event.attemptId) ||
      event.attemptId === task.attemptId ||
      (event.productId !== undefined &&
        event.productId !== task.productId)
    ) {
      return rejected(current, task);
    }
    return {
      accepted: true,
      task: withState(
        task,
        timestamp,
        {
          attemptId: event.attemptId,
          attempt: task.attempt + 1,
          phase: "starting",
          resumable: false,
          progress: { ...EMPTY_PROGRESS },
          errorCode: null,
          errorMessage: null,
          filePath: null,
          sha256: null,
          fileSize: null
        },
        `开始第 ${task.attempt + 1} 次下载`
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
      !["starting", "downloading", "pausing", "paused", "failed"].includes(
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
  restoreDownloadTask
};
