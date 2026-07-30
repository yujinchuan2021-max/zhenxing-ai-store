"use strict";

const {
  createDesktopOperationController
} = require("./desktop-operation.cjs");

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function toCoreTask(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) return task;
  const coreTask = {
    ...task,
    productId: task.environmentId,
    desktopStatus: task.environmentStatus
  };
  delete coreTask.environmentId;
  delete coreTask.environmentStatus;
  return coreTask;
}

function toEnvironmentTask(task) {
  if (!task) return null;
  const environmentTask = {
    ...clone(task),
    environmentId: task.productId,
    environmentStatus: clone(task.desktopStatus)
  };
  delete environmentTask.productId;
  delete environmentTask.desktopStatus;
  return environmentTask;
}

function toCoreEnvelope(records) {
  if (
    !records ||
    typeof records !== "object" ||
    Array.isArray(records) ||
    records.schemaVersion !== 1 ||
    !records.environments ||
    typeof records.environments !== "object" ||
    Array.isArray(records.environments)
  ) {
    return {};
  }
  return {
    schemaVersion: 1,
    products: Object.fromEntries(
      Object.entries(records.environments).map(([environmentId, entry]) => [
        environmentId,
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? {
              ...entry,
              operation:
                entry.operation === null
                  ? null
                  : toCoreTask(entry.operation)
            }
          : entry
      ])
    )
  };
}

function toEnvironmentEnvelope(records) {
  return {
    schemaVersion: 1,
    environments: Object.fromEntries(
      Object.entries(records?.products || {}).map(([environmentId, entry]) => [
        environmentId,
        {
          generation: entry.generation,
          operation: toEnvironmentTask(entry.operation)
        }
      ])
    )
  };
}

function createEnvironmentOperationController({
  loadRecords,
  saveRecords,
  onChange = () => {},
  ...options
}) {
  if (
    typeof loadRecords !== "function" ||
    typeof saveRecords !== "function" ||
    typeof onChange !== "function"
  ) {
    throw new TypeError("环境操作控制器参数无效");
  }
  const core = createDesktopOperationController({
    ...options,
    loadRecords: () => toCoreEnvelope(loadRecords()),
    saveRecords: (records) =>
      saveRecords(toEnvironmentEnvelope(records)),
    onChange: (task) => onChange(toEnvironmentTask(task))
  });
  return {
    begin(environmentId, operation) {
      return toEnvironmentTask(core.begin(environmentId, operation));
    },
    finishLaunch(environmentId, generation, operationId, launched) {
      return toEnvironmentTask(
        core.finishLaunch(
          environmentId,
          generation,
          operationId,
          launched
        )
      );
    },
    get(environmentId) {
      return toEnvironmentTask(core.get(environmentId));
    },
    async checkNow(environmentId, generation, operationId) {
      return toEnvironmentTask(
        await core.checkNow(environmentId, generation, operationId)
      );
    },
    resume() {
      return core.resume().map(toEnvironmentTask);
    },
    dispose() {
      core.dispose();
    }
  };
}

module.exports = {
  createEnvironmentOperationController
};
