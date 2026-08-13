const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createEnvironmentOperationController
} = require("../shared/environment-operation.cjs");

const absent = {
  installed: false,
  version: "",
  location: "",
  executable: "",
  appId: "",
  canOpen: false,
  canUninstall: false,
  detection: "absent"
};

const installed = {
  installed: true,
  version: "24.18.0",
  location: "C:\\Program Files\\nodejs\\node.exe",
  executable: "C:\\Program Files\\nodejs\\node.exe",
  appId: "",
  canOpen: true,
  canUninstall: true,
  detection: "installed"
};

const unknown = {
  installed: false,
  version: "",
  location: "",
  executable: "",
  appId: "",
  canOpen: false,
  canUninstall: false,
  detection: "unknown"
};

function createHarness({
  records = { schemaVersion: 1, environments: {} },
  statuses = [absent],
  startTime = Date.parse("2026-07-30T01:00:00.000Z")
} = {}) {
  let stored = structuredClone(records);
  let clock = startTime;
  let nextId = 1;
  const statusQueue = [...statuses];
  const scheduled = [];
  const changes = [];
  let deferredCheck = null;
  const controller = createEnvironmentOperationController({
    loadRecords: () => structuredClone(stored),
    saveRecords: (value) => {
      stored = structuredClone(value);
    },
    checkProduct: async () => {
      if (deferredCheck) return deferredCheck.promise;
      return structuredClone(statusQueue.shift() || absent);
    },
    isSupported: (environmentId) =>
      ["node", "git", "python"].includes(environmentId),
    now: () => clock,
    createId: () => `environment-operation-${nextId++}`,
    schedule: (callback, delayMs) => {
      const handle = { callback, delayMs, canceled: false };
      scheduled.push(handle);
      return handle;
    },
    cancelSchedule: (handle) => {
      handle.canceled = true;
    },
    onChange: (task) => changes.push(structuredClone(task)),
    intervalMs: 5_000,
    timeoutMs: 10 * 60 * 1_000
  });
  return {
    controller,
    changes,
    get records() {
      return structuredClone(stored);
    },
    advance(milliseconds) {
      clock += milliseconds;
    },
    async runNext() {
      const handle = scheduled.find((candidate) => !candidate.canceled);
      assert.ok(handle, "expected a scheduled environment check");
      handle.canceled = true;
      return await handle.callback();
    },
    deferNextCheck() {
      let resolve;
      const promise = new Promise((done) => {
        resolve = done;
      });
      deferredCheck = { promise };
      return {
        resolve(value) {
          deferredCheck = null;
          resolve(structuredClone(value));
        }
      };
    }
  };
}

test("persists an environment-shaped launching task before process spawn", () => {
  const harness = createHarness();
  const task = harness.controller.begin("node", "install");

  assert.equal(task.environmentId, "node");
  assert.equal(task.environmentStatus, null);
  assert.equal(task.phase, "launching");
  assert.equal("productId" in task, false);
  assert.equal("desktopStatus" in task, false);
  assert.deepEqual(
    harness.records.environments.node.operation,
    task
  );
  assert.equal("products" in harness.records, false);
});

test("recovers a launching environment operation without relaunching", () => {
  const first = createHarness();
  const launching = first.controller.begin("python", "install");
  first.controller.dispose();

  const restored = createHarness({
    records: first.records,
    startTime: Date.parse(launching.startedAt) + 2_000
  });
  const tasks = restored.controller.resume();

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].environmentId, "python");
  assert.equal(tasks[0].operationId, launching.operationId);
  assert.equal(tasks[0].phase, "monitoring");
  assert.equal(tasks[0].launchState, "unknown");
});

test("emits installed only after trusted environment evidence appears", async () => {
  const harness = createHarness({ statuses: [absent, installed] });
  const launching = harness.controller.begin("node", "install");
  harness.controller.finishLaunch(
    launching.environmentId,
    launching.generation,
    launching.operationId,
    true
  );

  await harness.runNext();
  const monitoring = harness.changes.at(-1);
  assert.equal(monitoring.phase, "monitoring");
  assert.equal(monitoring.environmentStatus.detection, "absent");

  harness.advance(5_000);
  await harness.runNext();
  const completed = harness.changes.at(-1);
  assert.equal(completed.phase, "installed");
  assert.deepEqual(completed.environmentStatus, installed);
  assert.equal(harness.controller.get("node"), null);
  assert.deepEqual(harness.records.environments.node, {
    generation: 1,
    operation: null
  });
});

test("keeps unknown scans non-terminal for install and uninstall", async () => {
  for (const operation of ["install", "uninstall"]) {
    const harness = createHarness({ statuses: [unknown] });
    const launching = harness.controller.begin("git", operation);
    const monitoring = harness.controller.finishLaunch(
      launching.environmentId,
      launching.generation,
      launching.operationId,
      true
    );

    const checked = await harness.controller.checkNow(
      monitoring.environmentId,
      monitoring.generation,
      monitoring.operationId
    );

    assert.equal(checked.phase, "monitoring");
    assert.equal(checked.generation, monitoring.generation);
    assert.equal(checked.operationId, monitoring.operationId);
    assert.equal(checked.revision, monitoring.revision + 1);
    assert.equal(checked.lastDetection, "unknown");
    assert.deepEqual(checked.environmentStatus, unknown);
    assert.deepEqual(
      harness.records.environments.git.operation,
      checked
    );
  }
});

test("uninstall writes a tombstone only after a trusted absent scan", async () => {
  const harness = createHarness({ statuses: [installed, absent] });
  const launching = harness.controller.begin("node", "uninstall");
  harness.controller.finishLaunch(
    launching.environmentId,
    launching.generation,
    launching.operationId,
    true
  );

  const monitoring = harness.controller.get("node");
  const stillInstalled = await harness.controller.checkNow(
    monitoring.environmentId,
    monitoring.generation,
    monitoring.operationId
  );
  assert.equal(stillInstalled.phase, "monitoring");
  assert.equal(stillInstalled.lastDetection, "installed");
  assert.deepEqual(
    harness.records.environments.node.operation,
    stillInstalled
  );

  harness.advance(5_000);
  const completed = await harness.controller.checkNow(
    stillInstalled.environmentId,
    stillInstalled.generation,
    stillInstalled.operationId
  );
  assert.equal(completed.phase, "uninstalled");
  assert.equal(completed.lastDetection, "absent");
  assert.deepEqual(completed.environmentStatus, absent);
  assert.equal(harness.controller.get("node"), null);
  assert.deepEqual(harness.records.environments.node, {
    generation: launching.generation,
    operation: null
  });

  const next = harness.controller.begin("node", "install");
  assert.equal(next.generation, launching.generation + 1);
  assert.equal(next.revision, 1);
});

test("a stale scan cannot overwrite a newer environment generation", async () => {
  const harness = createHarness();
  const first = harness.controller.begin("node", "install");
  harness.controller.finishLaunch(
    first.environmentId,
    first.generation,
    first.operationId,
    true
  );
  const deferred = harness.deferNextCheck();
  const staleCheck = harness.controller.checkNow(
    first.environmentId,
    first.generation,
    first.operationId
  );

  harness.controller.finishLaunch(
    first.environmentId,
    first.generation,
    first.operationId,
    false
  );
  harness.advance(-60_000);
  const second = harness.controller.begin("node", "uninstall");
  const changesAfterSecondBegin = harness.changes.length;

  assert.equal(second.generation, first.generation + 1);
  assert.equal(second.revision, 1);
  assert.ok(
    Date.parse(second.startedAt) < Date.parse(first.startedAt),
    "the test must not depend on wall-clock ordering"
  );

  deferred.resolve(installed);
  const staleResult = await staleCheck;

  assert.deepEqual(staleResult, second);
  assert.deepEqual(harness.controller.get("node"), second);
  assert.deepEqual(
    harness.records.environments.node.operation,
    second
  );
  assert.equal(harness.changes.length, changesAfterSecondBegin);
});

test("a timed-out operation preserves identity across restart and manual checks", async () => {
  const first = createHarness({ statuses: [absent] });
  const launching = first.controller.begin("python", "install");
  first.controller.finishLaunch(
    launching.environmentId,
    launching.generation,
    launching.operationId,
    true
  );
  first.advance(10 * 60 * 1_000);
  const timedOut = await first.runNext();

  assert.equal(timedOut.phase, "timed-out");
  first.controller.dispose();

  const restored = createHarness({
    records: first.records,
    statuses: [installed],
    startTime: Date.parse(timedOut.deadlineAt) + 60_000
  });
  const [resumed] = restored.controller.resume();

  assert.equal(resumed.phase, "timed-out");
  assert.equal(resumed.generation, timedOut.generation);
  assert.equal(resumed.operationId, timedOut.operationId);
  assert.equal(resumed.revision, timedOut.revision);

  const staleGeneration = await restored.controller.checkNow(
    resumed.environmentId,
    resumed.generation - 1,
    resumed.operationId
  );
  const staleIdentity = await restored.controller.checkNow(
    resumed.environmentId,
    resumed.generation,
    "stale-operation"
  );

  assert.deepEqual(staleGeneration, resumed);
  assert.deepEqual(staleIdentity, resumed);
  assert.deepEqual(restored.controller.get("python"), resumed);

  const completed = await restored.controller.checkNow(
    resumed.environmentId,
    resumed.generation,
    resumed.operationId
  );

  assert.equal(completed.phase, "installed");
  assert.equal(completed.generation, resumed.generation);
  assert.equal(completed.operationId, resumed.operationId);
  assert.equal(completed.revision, resumed.revision + 1);
  assert.equal(restored.controller.get("python"), null);
  assert.deepEqual(restored.records.environments.python, {
    generation: resumed.generation,
    operation: null
  });
});

test("a trusted global scan settles only the exact timed-out operation identity", async () => {
  const harness = createHarness({ statuses: [unknown] });
  const launching = harness.controller.begin("python", "uninstall");
  harness.controller.finishLaunch(
    launching.environmentId,
    launching.generation,
    launching.operationId,
    true
  );
  harness.advance(10 * 60 * 1_000);
  await harness.runNext();
  const timedOut = harness.controller.get("python");

  assert.equal(timedOut.phase, "timed-out");
  assert.deepEqual(
    await harness.controller.reconcileScan(
      timedOut.environmentId,
      timedOut.generation - 1,
      timedOut.operationId,
      absent
    ),
    timedOut
  );
  assert.deepEqual(harness.controller.get("python"), timedOut);

  const settled = await harness.controller.reconcileScan(
    timedOut.environmentId,
    timedOut.generation,
    timedOut.operationId,
    absent
  );

  assert.equal(settled.phase, "uninstalled");
  assert.equal(settled.generation, timedOut.generation);
  assert.equal(settled.operationId, timedOut.operationId);
  assert.equal(harness.controller.get("python"), null);
});
