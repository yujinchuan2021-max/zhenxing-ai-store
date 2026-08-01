"use strict";

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function validTimestamp(value) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === value
  );
}

function normalizeDesktopStatus(value, strict = false) {
  if (!isPlainObject(value) || typeof value.installed !== "boolean") return null;
  const stringFields = ["version", "location", "executable", "appId"];
  const booleanFields = ["canOpen", "canUninstall"];
  const hasUninstallMode = value.uninstallMode !== undefined;
  const hasLegacyInstall = value.legacyInstall !== undefined;
  const validDetection = ["installed", "absent", "unknown"].includes(
    value.detection
  );
  if (
    strict &&
    (Object.keys(value).length !==
      8 + Number(hasUninstallMode) + Number(hasLegacyInstall) ||
      stringFields.some((field) => typeof value[field] !== "string") ||
      booleanFields.some((field) => typeof value[field] !== "boolean") ||
      (hasUninstallMode &&
        !["automatic", "interactive"].includes(value.uninstallMode)) ||
      (hasLegacyInstall && value.legacyInstall !== "comfy-desktop-v1") ||
      !validDetection)
  ) {
    return null;
  }
  const detection = validDetection
    ? value.detection
    : value.installed
      ? "installed"
      : "unknown";
  if (value.installed !== (detection === "installed")) return null;
  const normalized = {
    installed: value.installed,
    version: typeof value.version === "string" ? value.version : "",
    location: typeof value.location === "string" ? value.location : "",
    executable: typeof value.executable === "string" ? value.executable : "",
    appId: typeof value.appId === "string" ? value.appId : "",
    canOpen: value.canOpen === true,
    canUninstall: value.canUninstall === true,
    detection
  };
  if (hasUninstallMode) normalized.uninstallMode = value.uninstallMode;
  if (hasLegacyInstall) normalized.legacyInstall = value.legacyInstall;
  return normalized;
}

function normalizePersistedTask(
  value,
  productId,
  isSupported,
  timeoutMs,
  maxAttempts
) {
  const taskFields = new Set([
    "schemaVersion",
    "productId",
    "verificationId",
    "revision",
    "phase",
    "attempts",
    "startedAt",
    "updatedAt",
    "deadlineAt",
    "lastCheckedAt",
    "lastDetection",
    "lastError",
    "desktopStatus"
  ]);
  const startedAtMs = Date.parse(value?.startedAt);
  const updatedAtMs = Date.parse(value?.updatedAt);
  const deadlineAtMs = Date.parse(value?.deadlineAt);
  if (
    !isPlainObject(value) ||
    Object.keys(value).length !== taskFields.size ||
    Object.keys(value).some((field) => !taskFields.has(field)) ||
    value.schemaVersion !== 1 ||
    value.productId !== productId ||
    !isSupported(productId) ||
    typeof value.verificationId !== "string" ||
    !value.verificationId.trim() ||
    value.verificationId !== value.verificationId.trim() ||
    !["monitoring", "timed-out"].includes(value.phase) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    !Number.isSafeInteger(value.attempts) ||
    value.attempts < 0 ||
    value.attempts > maxAttempts ||
    (value.phase === "monitoring" && value.attempts >= maxAttempts) ||
    !validTimestamp(value.startedAt) ||
    !validTimestamp(value.updatedAt) ||
    !validTimestamp(value.deadlineAt) ||
    deadlineAtMs <= startedAtMs ||
    deadlineAtMs - startedAtMs > timeoutMs ||
    updatedAtMs < startedAtMs ||
    (value.phase === "monitoring"
      ? value.revision !== value.attempts + 1
      : value.revision < value.attempts + 1)
  ) {
    return null;
  }
  if (
    value.lastCheckedAt !== null &&
    !validTimestamp(value.lastCheckedAt)
  ) {
    return null;
  }
  if (
    value.lastDetection !== null &&
    !["installed", "absent", "unknown"].includes(value.lastDetection)
  ) {
    return null;
  }
  if (value.lastError !== null && typeof value.lastError !== "string") {
    return null;
  }
  if (typeof value.lastError === "string" && !value.lastError.trim()) {
    return null;
  }
  const desktopStatus =
    value.desktopStatus === null
      ? null
      : normalizeDesktopStatus(value.desktopStatus, true);
  if (value.desktopStatus !== null && !desktopStatus) return null;
  const lastCheckedAtMs =
    value.lastCheckedAt === null ? null : Date.parse(value.lastCheckedAt);
  if (value.attempts === 0) {
    if (
      value.phase !== "monitoring" ||
      updatedAtMs !== startedAtMs ||
      value.lastCheckedAt !== null ||
      value.lastDetection !== null ||
      value.lastError !== null ||
      desktopStatus !== null
    ) {
      return null;
    }
  } else if (
    lastCheckedAtMs === null ||
    lastCheckedAtMs < startedAtMs ||
    lastCheckedAtMs !== updatedAtMs ||
    value.lastDetection === null ||
    (value.phase === "monitoring" && updatedAtMs >= deadlineAtMs) ||
    (value.phase === "timed-out" &&
      updatedAtMs < deadlineAtMs &&
      value.attempts < maxAttempts) ||
    (desktopStatus &&
      (desktopStatus.installed ||
        desktopStatus.detection !== value.lastDetection ||
        value.lastError !== null)) ||
    (!desktopStatus &&
      (value.lastDetection !== "unknown" || value.lastError === null))
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    productId,
    verificationId: value.verificationId,
    revision: value.revision,
    phase: value.phase,
    attempts: value.attempts,
    startedAt: value.startedAt,
    updatedAt: value.updatedAt,
    deadlineAt: value.deadlineAt,
    lastCheckedAt: value.lastCheckedAt,
    lastDetection: value.lastDetection,
    lastError: value.lastError,
    desktopStatus
  };
}

function createInstallVerificationController({
  loadRecords,
  saveRecords,
  checkProduct,
  isSupported,
  now = Date.now,
  createId,
  schedule = setTimeout,
  cancelSchedule = clearTimeout,
  onChange = () => {},
  intervalMs = 5_000,
  timeoutMs = 10 * 60 * 1_000
}) {
  if (
    typeof loadRecords !== "function" ||
    typeof saveRecords !== "function" ||
    typeof checkProduct !== "function" ||
    typeof isSupported !== "function" ||
    typeof now !== "function" ||
    typeof createId !== "function" ||
    typeof schedule !== "function" ||
    typeof cancelSchedule !== "function" ||
    typeof onChange !== "function" ||
    !Number.isSafeInteger(intervalMs) ||
    intervalMs < 1 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < intervalMs
  ) {
    throw new TypeError("安装验证控制器参数无效");
  }

  const maxAttempts = Math.ceil(timeoutMs / intervalMs);
  const tasks = new Map();
  const scheduledHandles = new Map();
  const activeChecks = new Map();
  let disposed = false;
  let rawRecords = {};
  let recordsWereSanitized = false;
  try {
    const loaded = loadRecords();
    if (isPlainObject(loaded)) {
      rawRecords = loaded;
    } else {
      recordsWereSanitized = true;
    }
  } catch {
    recordsWereSanitized = true;
  }
  for (const [productId, value] of Object.entries(rawRecords)) {
    const task = normalizePersistedTask(
      value,
      productId,
      isSupported,
      timeoutMs,
      maxAttempts
    );
    if (task) tasks.set(productId, task);
    else recordsWereSanitized = true;
  }

  const recordsSnapshot = (source = tasks) =>
    Object.fromEntries(
      [...source.entries()].map(([productId, task]) => [
        productId,
        clone(task)
      ])
    );
  const persist = (source = tasks) => saveRecords(recordsSnapshot(source));
  const commitTask = (productId, task) => {
    const nextTasks = new Map(tasks);
    nextTasks.set(productId, task);
    persist(nextTasks);
    tasks.set(productId, task);
  };
  const commitRemoval = (productId) => {
    const nextTasks = new Map(tasks);
    nextTasks.delete(productId);
    persist(nextTasks);
    tasks.delete(productId);
  };
  if (recordsWereSanitized) {
    try {
      persist(tasks);
    } catch {
      // Sanitization is best effort. Valid records remain usable in memory,
      // and the next successful state commit rewrites the complete snapshot.
    }
  }

  const cancelScheduled = (productId) => {
    const handle = scheduledHandles.get(productId);
    if (handle !== undefined) {
      cancelSchedule(handle);
      scheduledHandles.delete(productId);
    }
  };

  const emit = (task) => {
    try {
      onChange(clone(task));
    } catch {
      // Renderer notification is best effort. Persisted verification and
      // background scheduling must survive a closing or reloading window.
    }
  };

  const monotonicNow = (task) =>
    Math.max(Number(now()), Date.parse(task?.updatedAt || 0));

  let checkNow;
  const scheduleTask = (task, delayMs) => {
    cancelScheduled(task.productId);
    if (disposed) return;
    const handle = schedule(() => {
      if (scheduledHandles.get(task.productId) === handle) {
        scheduledHandles.delete(task.productId);
      }
      return Promise.resolve()
        .then(() => checkNow(task.productId, task.verificationId))
        .catch(() => {
          const latest = tasks.get(task.productId) || null;
          if (
            !disposed &&
            latest?.verificationId === task.verificationId
          ) {
            try {
              scheduleTask(latest, intervalMs);
            } catch {
              // A scheduler failure must not turn a contained background
              // persistence failure into an unhandled rejection.
            }
          }
          return clone(latest);
        });
    }, Math.max(0, delayMs));
    scheduledHandles.set(task.productId, handle);
  };

  checkNow = async (productId, expectedVerificationId = null) => {
    if (disposed) return null;
    const current = tasks.get(productId) || null;
    if (
      !current ||
      (expectedVerificationId &&
        current.verificationId !== expectedVerificationId)
    ) {
      return clone(current);
    }
    const existing = activeChecks.get(productId);
    if (existing?.verificationId === current.verificationId) {
      return existing.promise;
    }

    const checkToken = {
      verificationId: current.verificationId,
      promise: null
    };
    checkToken.promise = (async () => {
      let status = null;
      let error = null;
      try {
        status = normalizeDesktopStatus(await checkProduct(productId));
        if (!status) throw new Error("Windows 安装状态无效");
      } catch (candidate) {
        error =
          candidate instanceof Error && candidate.message
            ? candidate.message
            : "Windows 应用信息扫描失败";
      }

      const latest = tasks.get(productId) || null;
      if (
        disposed ||
        !latest ||
        latest.verificationId !== checkToken.verificationId
      ) {
        return clone(latest);
      }

      const checkedAtMs = monotonicNow(latest);
      const checkedAt = new Date(checkedAtMs).toISOString();
      const attempts = Math.min(maxAttempts, latest.attempts + 1);
      if (status?.installed) {
        const completed = {
          ...latest,
          revision: latest.revision + 1,
          phase: "installed",
          attempts,
          updatedAt: checkedAt,
          lastCheckedAt: checkedAt,
          lastDetection: "installed",
          lastError: null,
          desktopStatus: status
        };
        try {
          commitRemoval(productId);
        } catch (persistError) {
          if (latest.phase === "monitoring") {
            scheduleTask(latest, intervalMs);
          }
          throw persistError;
        }
        cancelScheduled(productId);
        emit(completed);
        return clone(completed);
      }

      const timedOut =
        checkedAtMs >= Date.parse(latest.deadlineAt) ||
        attempts >= maxAttempts;
      const next = {
        ...latest,
        revision: latest.revision + 1,
        phase: timedOut ? "timed-out" : "monitoring",
        attempts,
        updatedAt: checkedAt,
        lastCheckedAt: checkedAt,
        lastDetection: status?.detection || "unknown",
        lastError: error,
        desktopStatus: status
      };
      try {
        commitTask(productId, next);
      } catch (persistError) {
        if (latest.phase === "monitoring") {
          scheduleTask(latest, intervalMs);
        }
        throw persistError;
      }
      emit(next);
      if (next.phase === "monitoring") {
        const remaining = Math.max(
          0,
          Date.parse(next.deadlineAt) - checkedAtMs
        );
        scheduleTask(next, Math.min(intervalMs, remaining));
      } else {
        cancelScheduled(productId);
      }
      return clone(next);
    })();
    activeChecks.set(productId, checkToken);
    try {
      return await checkToken.promise;
    } finally {
      if (activeChecks.get(productId) === checkToken) {
        activeChecks.delete(productId);
      }
    }
  };

  const start = (productId) => {
    if (disposed) throw new Error("安装验证控制器已释放");
    if (typeof productId !== "string" || !isSupported(productId)) {
      throw new Error("该产品不支持安装验证");
    }
    const startedAtMs = Number(now());
    if (!Number.isFinite(startedAtMs)) {
      throw new Error("安装验证时间无效");
    }
    const startedAt = new Date(startedAtMs).toISOString();
    const verificationId = createId();
    if (
      typeof verificationId !== "string" ||
      !verificationId.trim() ||
      verificationId !== verificationId.trim() ||
      verificationId === tasks.get(productId)?.verificationId
    ) {
      throw new Error("安装验证标识无效或重复");
    }
    const task = {
      schemaVersion: 1,
      productId,
      verificationId,
      revision: 1,
      phase: "monitoring",
      attempts: 0,
      startedAt,
      updatedAt: startedAt,
      deadlineAt: new Date(startedAtMs + timeoutMs).toISOString(),
      lastCheckedAt: null,
      lastDetection: null,
      lastError: null,
      desktopStatus: null
    };
    commitTask(productId, task);
    cancelScheduled(productId);
    emit(task);
    scheduleTask(task, 0);
    return clone(task);
  };

  const get = (productId) => clone(tasks.get(productId) || null);

  const resume = () => {
    if (disposed) return [];
    const restored = [...tasks.values()].map(clone);
    for (const task of tasks.values()) {
      emit(task);
      scheduleTask(task, 0);
    }
    return restored;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const productId of scheduledHandles.keys()) {
      cancelScheduled(productId);
    }
  };

  return {
    start,
    get,
    checkNow,
    resume,
    dispose
  };
}

module.exports = {
  createInstallVerificationController
};
