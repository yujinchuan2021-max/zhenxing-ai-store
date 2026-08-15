"use strict";

function createDownloadTaskRevisionTracker() {
  const products = new Map();

  function stateFor(productId) {
    let state = products.get(productId);
    if (!state) {
      state = {
        attemptId: null,
        attempt: 0,
        revision: 0,
        awaitingFresh: false,
        seenAttemptIds: new Set()
      };
      products.set(productId, state);
    }
    return state;
  }

  function validTask(task) {
    return Boolean(
      task &&
        typeof task.productId === "string" &&
        task.productId &&
        typeof task.attemptId === "string" &&
        task.attemptId &&
        Number.isSafeInteger(task.attempt) &&
        task.attempt >= 1 &&
        Number.isSafeInteger(task.revision) &&
        task.revision >= 1
    );
  }

  function bind(state, task) {
    state.attemptId = task.attemptId;
    state.attempt = task.attempt;
    state.revision = task.revision;
    state.seenAttemptIds.add(task.attemptId);
  }

  return Object.freeze({
    accept(task, options = {}) {
      if (!validTask(task)) return false;
      const state = stateFor(task.productId);
      const freshStart = options.freshStart === true;

      if (freshStart && state.awaitingFresh) {
        state.awaitingFresh = false;
        if (task.attemptId === state.attemptId) {
          if (task.revision <= state.revision) return false;
          state.revision = task.revision;
          return true;
        }
        if (state.seenAttemptIds.has(task.attemptId)) return false;
        bind(state, task);
        return true;
      }

      if (state.awaitingFresh) {
        if (
          task.attemptId === state.attemptId ||
          state.seenAttemptIds.has(task.attemptId) ||
          (state.attemptId && task.attempt <= state.attempt)
        ) {
          return false;
        }
        state.awaitingFresh = false;
        bind(state, task);
        return true;
      }
      if (task.attemptId === state.attemptId) {
        if (task.revision <= state.revision) return false;
        state.revision = task.revision;
        return true;
      }
      if (state.seenAttemptIds.has(task.attemptId)) return false;
      if (state.attemptId && task.attempt <= state.attempt) return false;
      bind(state, task);
      return true;
    },

    beginFreshDownload(productId) {
      if (typeof productId === "string" && productId) {
        stateFor(productId).awaitingFresh = true;
      }
    },

    cancelFreshDownload(productId) {
      if (typeof productId === "string" && productId) {
        stateFor(productId).awaitingFresh = false;
      }
    },

    clearProduct(productId) {
      if (typeof productId === "string" && productId) {
        const state = stateFor(productId);
        state.attemptId = null;
        state.attempt = 0;
        state.revision = 0;
        state.awaitingFresh = false;
      }
    }
  });
}

function buildDownloadPopoverItems({ names = {}, queueTasks = {}, legacyTasks = {} } = {}) {
  const queueProductIds = new Set();
  const items = [];
  for (const task of Object.values(queueTasks)) {
    if (!task?.productId || !task?.taskId) continue;
    queueProductIds.add(task.productId);
    items.push({
      id: task.taskId,
      productId: task.productId,
      name: names[task.productId] || task.productId,
      source: "queue",
      phase: task.phase,
      state: task.presentation?.state || "active",
      percent: Number.isFinite(task.progress?.percent) ? task.progress.percent : null
    });
  }
  for (const task of Object.values(legacyTasks)) {
    if (!task?.productId || !task?.attemptId || queueProductIds.has(task.productId)) continue;
    items.push({
      id: task.attemptId,
      productId: task.productId,
      name: names[task.productId] || task.productId,
      source: "legacy",
      phase: task.phase,
      state: task.phase === "completed" ? "completed" : task.phase === "failed" ? "failed" : "active",
      percent: Number.isFinite(task.progress?.percent) ? task.progress.percent : null
    });
  }
  const rank = { active: 0, failed: 1, completed: 2 };
  items.sort((left, right) =>
    (rank[left.state] ?? 3) - (rank[right.state] ?? 3) ||
    left.name.localeCompare(right.name)
  );
  return {
    activeCount: items.filter((item) => item.state === "active").length,
    totalCount: items.length,
    items
  };
}

module.exports = { buildDownloadPopoverItems, createDownloadTaskRevisionTracker };
