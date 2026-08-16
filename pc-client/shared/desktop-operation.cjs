"use strict";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeDesktopStatus(value) {
  if (
    !isPlainObject(value) ||
    typeof value.installed !== "boolean" ||
    !["installed", "absent", "unknown"].includes(value.detection)
  ) {
    return null;
  }
  if (value.installed !== (value.detection === "installed")) return null;
  const normalized = {
    installed: value.installed,
    version: typeof value.version === "string" ? value.version : "",
    location: typeof value.location === "string" ? value.location : "",
    executable: typeof value.executable === "string" ? value.executable : "",
    appId: typeof value.appId === "string" ? value.appId : "",
    canOpen: value.canOpen === true,
    canUninstall: value.canUninstall === true,
    detection: value.detection
  };
  if (value.uninstallMode !== undefined) {
    if (!["automatic", "interactive"].includes(value.uninstallMode)) {
      return null;
    }
    normalized.uninstallMode = value.uninstallMode;
  }
  if (value.legacyInstall !== undefined) {
    if (
      typeof value.legacyInstall !== "string" ||
      value.legacyInstall !== "comfy-desktop-v1"
    ) {
      return null;
    }
    normalized.legacyInstall = value.legacyInstall;
  }
  return normalized;
}

function validTimestamp(value) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === value
  );
}

function normalizeOperationTask({
  value,
  productId,
  generation,
  isSupported,
  timeoutMs,
  maxAttempts
}) {
  const fields = new Set([
    "schemaVersion",
    "productId",
    "generation",
    "operationId",
    "operation",
    "phase",
    "launchState",
    "revision",
    "attempts",
    "startedAt",
    "updatedAt",
    "deadlineAt",
    "lastCheckedAt",
    "lastDetection",
    "lastError",
    "desktopStatus"
  ]);
  if (
    !isPlainObject(value) ||
    Object.keys(value).length !== fields.size ||
    Object.keys(value).some((field) => !fields.has(field)) ||
    value.schemaVersion !== 1 ||
    value.productId !== productId ||
    value.generation !== generation ||
    !isSupported(productId) ||
    typeof value.operationId !== "string" ||
    !value.operationId.trim() ||
    value.operationId !== value.operationId.trim() ||
    !["install", "uninstall"].includes(value.operation) ||
    !["launching", "monitoring", "timed-out"].includes(value.phase) ||
    !["pending", "confirmed", "unknown"].includes(value.launchState) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    !Number.isSafeInteger(value.attempts) ||
    value.attempts < 0 ||
    value.attempts > maxAttempts ||
    value.revision < value.attempts + 1 ||
    !validTimestamp(value.startedAt) ||
    !validTimestamp(value.updatedAt) ||
    !validTimestamp(value.deadlineAt)
  ) {
    return null;
  }

  const startedAtMs = Date.parse(value.startedAt);
  const updatedAtMs = Date.parse(value.updatedAt);
  const deadlineAtMs = Date.parse(value.deadlineAt);
  if (
    updatedAtMs < startedAtMs ||
    deadlineAtMs <= startedAtMs ||
    deadlineAtMs - startedAtMs > timeoutMs ||
    (value.phase === "launching" &&
      (value.launchState !== "pending" ||
        value.revision !== 1 ||
        value.attempts !== 0)) ||
    (value.phase !== "launching" && value.launchState === "pending") ||
    (value.phase === "monitoring" && value.attempts >= maxAttempts)
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
  if (
    value.lastError !== null &&
    (typeof value.lastError !== "string" || !value.lastError.trim())
  ) {
    return null;
  }

  const desktopStatus =
    value.desktopStatus === null
      ? null
      : normalizeDesktopStatus(value.desktopStatus);
  if (value.desktopStatus !== null && !desktopStatus) return null;

  if (value.attempts === 0) {
    if (
      value.lastCheckedAt !== null ||
      value.lastDetection !== null ||
      value.lastError !== null ||
      desktopStatus !== null
    ) {
      return null;
    }
  } else {
    if (
      value.lastCheckedAt === null ||
      Date.parse(value.lastCheckedAt) !== updatedAtMs ||
      value.lastDetection === null ||
      (desktopStatus &&
        (desktopStatus.detection !== value.lastDetection ||
          value.lastError !== null)) ||
      (!desktopStatus &&
        (value.lastDetection !== "unknown" || value.lastError === null))
    ) {
      return null;
    }
  }

  if (
    (value.operation === "install" &&
      desktopStatus?.detection === "installed") ||
    (value.operation === "uninstall" &&
      desktopStatus?.detection === "absent")
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    productId,
    generation,
    operationId: value.operationId,
    operation: value.operation,
    phase: value.phase,
    launchState: value.launchState,
    revision: value.revision,
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

function migrateLegacyTask({
  value,
  productId,
  isSupported,
  timeoutMs,
  maxAttempts
}) {
  if (
    !isPlainObject(value) ||
    value.schemaVersion !== 1 ||
    value.productId !== productId ||
    typeof value.verificationId !== "string" ||
    !["monitoring", "timed-out"].includes(value.phase)
  ) {
    return null;
  }
  return normalizeOperationTask({
    value: {
      schemaVersion: 1,
      productId,
      generation: 1,
      operationId: value.verificationId,
      operation: "install",
      phase: value.phase,
      launchState: "confirmed",
      revision: value.revision,
      attempts: value.attempts,
      startedAt: value.startedAt,
      updatedAt: value.updatedAt,
      deadlineAt: value.deadlineAt,
      lastCheckedAt: value.lastCheckedAt,
      lastDetection: value.lastDetection,
      lastError: value.lastError,
      desktopStatus: value.desktopStatus
    },
    productId,
    generation: 1,
    isSupported,
    timeoutMs,
    maxAttempts
  });
}

function createDesktopOperationController({
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
    throw new TypeError("桌面操作控制器参数无效");
  }

  const maxAttempts = Math.ceil(timeoutMs / intervalMs);
  let envelope = { schemaVersion: 1, products: {} };
  let disposed = false;
  const scheduledHandles = new Map();
  const activeChecks = new Map();
  let rewriteLoadedRecords = false;
  let loadedRecords = null;
  try {
    loadedRecords = loadRecords();
  } catch {
    rewriteLoadedRecords = true;
  }

  if (
    isPlainObject(loadedRecords) &&
    loadedRecords.schemaVersion === 1 &&
    isPlainObject(loadedRecords.products)
  ) {
    for (const [productId, entry] of Object.entries(loadedRecords.products)) {
      if (
        !isPlainObject(entry) ||
        !Number.isSafeInteger(entry.generation) ||
        entry.generation < 1
      ) {
        rewriteLoadedRecords = true;
        continue;
      }
      if (entry.operation === null) {
        envelope.products[productId] = {
          generation: entry.generation,
          operation: null
        };
        if (
          Object.keys(entry).length !== 2 ||
          !isSupported(productId)
        ) {
          rewriteLoadedRecords = true;
          if (!isSupported(productId)) delete envelope.products[productId];
        }
        continue;
      }
      const operation = normalizeOperationTask({
        value: entry.operation,
        productId,
        generation: entry.generation,
        isSupported,
        timeoutMs,
        maxAttempts
      });
      envelope.products[productId] = {
        generation: entry.generation,
        operation
      };
      if (!operation || Object.keys(entry).length !== 2) {
        rewriteLoadedRecords = true;
      }
    }
    if (
      Object.keys(loadedRecords).length !== 2 ||
      Object.keys(loadedRecords).some(
        (field) => !["schemaVersion", "products"].includes(field)
      )
    ) {
      rewriteLoadedRecords = true;
    }
  } else if (isPlainObject(loadedRecords)) {
    rewriteLoadedRecords = true;
    for (const [productId, value] of Object.entries(loadedRecords)) {
      const operation = migrateLegacyTask({
        value,
        productId,
        isSupported,
        timeoutMs,
        maxAttempts
      });
      if (operation) {
        envelope.products[productId] = {
          generation: 1,
          operation
        };
      }
    }
  } else {
    rewriteLoadedRecords = true;
  }

  if (rewriteLoadedRecords) {
    try {
      saveRecords(clone(envelope));
    } catch {
      // Valid recovered records remain usable; the next commit rewrites all.
    }
  }

  const safeEmit = (task, context = {}) => {
    try {
      onChange(clone(task), clone(context));
    } catch {
      // Renderer listeners cannot own the durable operation lifecycle.
    }
  };

  const commitEnvelope = (nextEnvelope) => {
    saveRecords(clone(nextEnvelope));
    envelope = nextEnvelope;
  };

  const currentMatches = (productId, generation, operationId) => {
    const entry = envelope.products[productId] || null;
    const task = entry?.operation || null;
    return Boolean(
      task &&
        entry.generation === generation &&
        task.generation === generation &&
        task.operationId === operationId
    );
  };

  const cancelScheduled = (productId) => {
    const handle = scheduledHandles.get(productId);
    if (handle !== undefined) {
      cancelSchedule(handle);
      scheduledHandles.delete(productId);
    }
  };

  let checkNow;
  let scheduleLaunchingTransitionRetry;
  let scheduleOperationClearRetry;
  const scheduleTask = (task, delayMs) => {
    cancelScheduled(task.productId);
    if (disposed) return;
    const handle = schedule(() => {
      if (scheduledHandles.get(task.productId) === handle) {
        scheduledHandles.delete(task.productId);
      }
      return Promise.resolve()
        .then(() =>
          checkNow(task.productId, task.generation, task.operationId)
        )
        .catch(() => {
          const latest = envelope.products[task.productId]?.operation || null;
          if (
            !disposed &&
            latest?.phase === "monitoring" &&
            latest.generation === task.generation &&
            latest.operationId === task.operationId
          ) {
            try {
              scheduleTask(latest, intervalMs);
            } catch {
              // A scheduler failure remains contained in the controller.
            }
          }
          return clone(latest);
        });
    }, Math.max(0, delayMs));
    scheduledHandles.set(task.productId, handle);
  };

  const transitionLaunchingTask = (task, launchState) => {
    const current = envelope.products[task.productId]?.operation || null;
    if (
      !currentMatches(task.productId, task.generation, task.operationId) ||
      current?.phase !== "launching"
    ) {
      return clone(current);
    }
    const updatedAtMs = Math.max(Number(now()), Date.parse(current.updatedAt));
    const next = {
      ...current,
      phase: "monitoring",
      launchState,
      revision: current.revision + 1,
      updatedAt: new Date(updatedAtMs).toISOString()
    };
    const nextEnvelope = clone(envelope);
    nextEnvelope.products[task.productId] = {
      generation: task.generation,
      operation: clone(next)
    };
    commitEnvelope(nextEnvelope);
    return clone(next);
  };

  scheduleLaunchingTransitionRetry = (task, launchState) => {
    cancelScheduled(task.productId);
    if (disposed) return;
    const handle = schedule(() => {
      if (scheduledHandles.get(task.productId) === handle) {
        scheduledHandles.delete(task.productId);
      }
      const latest = envelope.products[task.productId]?.operation || null;
      if (
        disposed ||
        latest?.phase !== "launching" ||
        latest.generation !== task.generation ||
        latest.operationId !== task.operationId
      ) {
        return clone(latest);
      }
      try {
        const monitoring = transitionLaunchingTask(latest, launchState);
        safeEmit(monitoring);
        try {
          scheduleTask(monitoring, 0);
        } catch {
          // A later manual check or resume can restore monitoring.
        }
        return clone(monitoring);
      } catch {
        const retryTask =
          envelope.products[task.productId]?.operation || null;
        if (
          !disposed &&
          retryTask?.phase === "launching" &&
          retryTask.generation === task.generation &&
          retryTask.operationId === task.operationId
        ) {
          try {
            scheduleLaunchingTransitionRetry(retryTask, launchState);
          } catch {
            // A scheduler failure must not replace the durable launching state.
          }
        }
        return clone(retryTask);
      }
    }, intervalMs);
    scheduledHandles.set(task.productId, handle);
  };

  const clearOperationTask = (task) => {
    const current = envelope.products[task.productId]?.operation || null;
    if (
      !currentMatches(task.productId, task.generation, task.operationId)
    ) {
      return clone(current);
    }
    const nextEnvelope = clone(envelope);
    nextEnvelope.products[task.productId] = {
      generation: task.generation,
      operation: null
    };
    commitEnvelope(nextEnvelope);
    return null;
  };

  scheduleOperationClearRetry = (task) => {
    cancelScheduled(task.productId);
    if (disposed) return;
    const handle = schedule(() => {
      if (scheduledHandles.get(task.productId) === handle) {
        scheduledHandles.delete(task.productId);
      }
      const latest = envelope.products[task.productId]?.operation || null;
      if (
        disposed ||
        latest?.generation !== task.generation ||
        latest.operationId !== task.operationId
      ) {
        return clone(latest);
      }
      try {
        return clearOperationTask(latest);
      } catch {
        const retryTask =
          envelope.products[task.productId]?.operation || null;
        if (
          !disposed &&
          retryTask?.generation === task.generation &&
          retryTask.operationId === task.operationId
        ) {
          try {
            scheduleOperationClearRetry(retryTask);
          } catch {
            // A scheduler failure must not replace the durable task snapshot.
          }
        }
        return clone(retryTask);
      }
    }, intervalMs);
    scheduledHandles.set(task.productId, handle);
  };

  const begin = (productId, operation) => {
    if (
      typeof productId !== "string" ||
      !isSupported(productId) ||
      !["install", "uninstall"].includes(operation)
    ) {
      throw new Error("桌面操作不受支持");
    }
    const currentEntry = envelope.products[productId] || null;
    if (currentEntry?.operation) {
      throw new Error("该产品已有进行中的桌面操作");
    }
    const startedAtMs = Number(now());
    if (!Number.isFinite(startedAtMs)) {
      throw new Error("桌面操作时间无效");
    }
    const operationId = createId();
    if (
      typeof operationId !== "string" ||
      !operationId.trim() ||
      operationId !== operationId.trim()
    ) {
      throw new Error("桌面操作标识无效");
    }
    const generation = (currentEntry?.generation || 0) + 1;
    const startedAt = new Date(startedAtMs).toISOString();
    const task = {
      schemaVersion: 1,
      productId,
      generation,
      operationId,
      operation,
      phase: "launching",
      launchState: "pending",
      revision: 1,
      attempts: 0,
      startedAt,
      updatedAt: startedAt,
      deadlineAt: new Date(startedAtMs + timeoutMs).toISOString(),
      lastCheckedAt: null,
      lastDetection: null,
      lastError: null,
      desktopStatus: null
    };
    const nextEnvelope = clone(envelope);
    nextEnvelope.products[productId] = {
      generation,
      operation: clone(task)
    };
    commitEnvelope(nextEnvelope);
    safeEmit(task);
    return clone(task);
  };

  const get = (productId) =>
    clone(envelope.products[productId]?.operation || null);

  const finishLaunch = (
    productId,
    generation,
    operationId,
    launched
  ) => {
    const current = envelope.products[productId]?.operation || null;
    if (
      typeof launched !== "boolean" ||
      !currentMatches(productId, generation, operationId)
    ) {
      return clone(current);
    }
    if (!launched) {
      try {
        clearOperationTask(current);
      } catch (error) {
        try {
          scheduleOperationClearRetry(current);
        } catch {
          // Preserve the original persistence error for the launch caller.
        }
        throw error;
      }
      cancelScheduled(productId);
      return null;
    }
    if (current?.phase !== "launching") return clone(current);
    let monitoring;
    try {
      monitoring = transitionLaunchingTask(current, "confirmed");
    } catch (error) {
      try {
        scheduleLaunchingTransitionRetry(current, "confirmed");
      } catch {
        // Preserve the original persistence error for the launch caller.
      }
      throw error;
    }
    safeEmit(monitoring);
    scheduleTask(monitoring, 0);
    return clone(monitoring);
  };
  const finishProcess = async (
    productId,
    generation,
    operationId,
    result
  ) => {
    const current = envelope.products[productId]?.operation || null;
    if (
      !currentMatches(productId, generation, operationId) ||
      !isPlainObject(result) ||
      (result.exitCode !== null && !Number.isInteger(result.exitCode)) ||
      (result.signal !== null && typeof result.signal !== "string")
    ) {
      return clone(current);
    }

    const checked = await checkNow(productId, generation, operationId);
    if (
      checked?.phase === "installed" ||
      checked?.phase === "uninstalled" ||
      !currentMatches(productId, generation, operationId)
    ) {
      return clone(checked);
    }
    const latest = envelope.products[productId]?.operation || null;
    if (!latest) return clone(checked);

    cancelScheduled(productId);
    const updatedAtMs = Math.max(Number(now()), Date.parse(latest.updatedAt));
    const failed = result.exitCode !== 0 || result.signal !== null;
    const processLabel = latest.operation === "uninstall" ? "卸载程序" : "安装程序";
    const terminal = {
      ...latest,
      phase: failed ? "failed" : "canceled",
      revision: latest.revision + 1,
      updatedAt: new Date(updatedAtMs).toISOString(),
      lastError: failed
        ? result.signal
          ? `${processLabel}被信号 ${result.signal} 终止`
          : `${processLabel}退出代码 ${result.exitCode}`
        : null
    };
    clearOperationTask(latest);
    safeEmit(terminal);
    return clone(terminal);
  };
  checkNow = async (
    productId,
    expectedGeneration = null,
    expectedOperationId = null
  ) => {
    if (disposed) return null;
    const current = envelope.products[productId]?.operation || null;
    if (
      !current ||
      (expectedGeneration !== null &&
        current.generation !== expectedGeneration) ||
      (expectedOperationId !== null &&
        current.operationId !== expectedOperationId) ||
      current.phase === "launching"
    ) {
      return clone(current);
    }
    const existing = activeChecks.get(productId);
    if (
      existing?.generation === current.generation &&
      existing?.operationId === current.operationId
    ) {
      return existing.promise;
    }

    const token = {
      generation: current.generation,
      operationId: current.operationId,
      promise: null
    };
    token.promise = (async () => {
      let status = null;
      let error = null;
      try {
        status = normalizeDesktopStatus(await checkProduct(productId));
        if (!status) throw new Error("Windows 桌面状态无效");
      } catch (candidate) {
        error =
          candidate instanceof Error && candidate.message
            ? candidate.message
            : "Windows 应用信息扫描失败";
      }

      const latest = envelope.products[productId]?.operation || null;
      if (
        disposed ||
        !latest ||
        latest.generation !== token.generation ||
        latest.operationId !== token.operationId
      ) {
        return clone(latest);
      }

      const checkedAtMs = Math.max(
        Number(now()),
        Date.parse(latest.updatedAt)
      );
      const checkedAt = new Date(checkedAtMs).toISOString();
      const attempts = Math.min(latest.attempts + 1, maxAttempts);
      const terminal =
        (latest.operation === "install" &&
          status?.detection === "installed") ||
        (latest.operation === "uninstall" &&
          status?.detection === "absent");
      if (terminal) {
        const completed = {
          ...latest,
          phase: latest.operation === "install" ? "installed" : "uninstalled",
          revision: latest.revision + 1,
          attempts,
          updatedAt: checkedAt,
          lastCheckedAt: checkedAt,
          lastDetection: status.detection,
          lastError: null,
          desktopStatus: status
        };
        const nextEnvelope = clone(envelope);
        nextEnvelope.products[productId] = {
          generation: latest.generation,
          operation: null
        };
        commitEnvelope(nextEnvelope);
        cancelScheduled(productId);
        safeEmit(completed);
        return clone(completed);
      }

      const timedOut =
        latest.phase === "timed-out" ||
        checkedAtMs >= Date.parse(latest.deadlineAt) ||
        attempts >= maxAttempts;
      const next = {
        ...latest,
        phase: timedOut ? "timed-out" : "monitoring",
        revision: latest.revision + 1,
        attempts,
        updatedAt: checkedAt,
        lastCheckedAt: checkedAt,
        lastDetection: status?.detection || "unknown",
        lastError: error,
        desktopStatus: status
      };
      const nextEnvelope = clone(envelope);
      nextEnvelope.products[productId] = {
        generation: latest.generation,
        operation: clone(next)
      };
      commitEnvelope(nextEnvelope);
      safeEmit(next);
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
    activeChecks.set(productId, token);
    try {
      return await token.promise;
    } finally {
      if (activeChecks.get(productId) === token) {
        activeChecks.delete(productId);
      }
    }
  };
  const resume = () => {
    if (disposed) return [];
    const restored = [];
    for (const productId of Object.keys(envelope.products)) {
      let task = envelope.products[productId]?.operation || null;
      if (!task) continue;
      if (task.phase === "launching") {
        try {
          task = transitionLaunchingTask(task, "unknown");
        } catch {
          try {
            scheduleLaunchingTransitionRetry(task, "unknown");
          } catch {
            // Keep the last durable launching snapshot for a later resume.
          }
        }
      }
      safeEmit(task, { restored: true });
      if (
        task.phase !== "launching" &&
        !scheduledHandles.has(productId)
      ) {
        try {
          scheduleTask(task, 0);
        } catch {
          // One scheduler failure must not block recovery for other products.
        }
      }
      restored.push(clone(task));
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
    begin,
    finishLaunch,
    finishProcess,
    get,
    checkNow,
    resume,
    dispose
  };
}

module.exports = {
  createDesktopOperationController
};
