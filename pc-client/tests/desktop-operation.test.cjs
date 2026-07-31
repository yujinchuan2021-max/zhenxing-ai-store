const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createDesktopOperationController
} = require("../shared/desktop-operation.cjs");

const absent = Object.freeze({
  installed: false,
  version: "",
  location: "",
  executable: "",
  appId: "",
  canOpen: false,
  canUninstall: false,
  detection: "absent"
});

const installed = Object.freeze({
  installed: true,
  version: "1.2.3",
  location: "C:\\Program Files\\Example",
  executable: "C:\\Program Files\\Example\\Example.exe",
  appId: "",
  canOpen: true,
  canUninstall: true,
  detection: "installed"
});

function createHarness({
  records = { schemaVersion: 1, products: {} },
  statuses = [absent],
  ids = ["operation-1", "operation-2", "operation-3"],
  startTime = Date.parse("2026-07-30T00:00:00.000Z"),
  onChange = null
} = {}) {
  let clock = startTime;
  let stored = structuredClone(records);
  let failWrites = false;
  const statusQueue = [...statuses];
  const idQueue = [...ids];
  const scheduled = [];
  const changes = [];
  let checkCalls = 0;
  let deferredCheck = null;

  const controller = createDesktopOperationController({
    loadRecords: () => structuredClone(stored),
    saveRecords: (value) => {
      if (failWrites) throw new Error("disk full");
      stored = structuredClone(value);
    },
    checkProduct: async () => {
      checkCalls += 1;
      if (deferredCheck) return deferredCheck.promise;
      return structuredClone(statusQueue.shift() || absent);
    },
    isSupported: (productId) =>
      ["comfy-desktop", "ollama-cli"].includes(productId),
    now: () => clock,
    createId: () => idQueue.shift(),
    schedule: (callback, delayMs) => {
      const handle = { callback, delayMs, canceled: false };
      scheduled.push(handle);
      return handle;
    },
    cancelSchedule: (handle) => {
      handle.canceled = true;
    },
    onChange: (task) => {
      changes.push(structuredClone(task));
      onChange?.(task);
    },
    intervalMs: 5_000,
    timeoutMs: 10 * 60 * 1_000
  });

  return {
    controller,
    changes,
    get records() {
      return structuredClone(stored);
    },
    get scheduled() {
      return scheduled;
    },
    get checkCalls() {
      return checkCalls;
    },
    advance(milliseconds) {
      clock += milliseconds;
    },
    setWriteFailure(value) {
      failWrites = value;
    },
    async runNext() {
      const handle = scheduled.find((candidate) => !candidate.canceled);
      assert.ok(handle, "expected a scheduled operation check");
      handle.canceled = true;
      return await handle.callback();
    },
    deferNextCheck() {
      let resolve;
      const promise = new Promise((done) => {
        resolve = done;
      });
      deferredCheck = { promise, resolve };
      return {
        resolve(value) {
          deferredCheck = null;
          resolve(value);
        }
      };
    }
  };
}

test("begin atomically persists one launching operation with a generation", () => {
  const harness = createHarness();
  const task = harness.controller.begin("comfy-desktop", "install");

  assert.deepEqual(task, {
    schemaVersion: 1,
    productId: "comfy-desktop",
    generation: 1,
    operationId: "operation-1",
    operation: "install",
    phase: "launching",
    launchState: "pending",
    revision: 1,
    attempts: 0,
    startedAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    deadlineAt: "2026-07-30T00:10:00.000Z",
    lastCheckedAt: null,
    lastDetection: null,
    lastError: null,
    desktopStatus: null
  });
  assert.deepEqual(harness.records, {
    schemaVersion: 1,
    products: {
      "comfy-desktop": {
        generation: 1,
        operation: task
      }
    }
  });
  assert.deepEqual(harness.controller.get("comfy-desktop"), task);
  assert.deepEqual(harness.changes, [task]);
  assert.equal(
    harness.scheduled.filter((handle) => !handle.canceled).length,
    0
  );
});

test("finishLaunch confirms or clears only the matching launching operation", () => {
  const harness = createHarness();
  const first = harness.controller.begin("comfy-desktop", "install");
  harness.advance(1_000);

  const monitoring = harness.controller.finishLaunch(
    first.productId,
    first.generation,
    first.operationId,
    true
  );
  assert.equal(monitoring.phase, "monitoring");
  assert.equal(monitoring.launchState, "confirmed");
  assert.equal(monitoring.revision, 2);
  assert.equal(monitoring.startedAt, first.startedAt);
  assert.equal(monitoring.deadlineAt, first.deadlineAt);
  assert.equal(monitoring.updatedAt, "2026-07-30T00:00:01.000Z");
  assert.deepEqual(
    harness.records.products["comfy-desktop"].operation,
    monitoring
  );
  assert.equal(
    harness.scheduled.filter((handle) => !handle.canceled).length,
    1
  );

  assert.deepEqual(
    harness.controller.finishLaunch(
      first.productId,
      first.generation - 1,
      first.operationId,
      false
    ),
    monitoring
  );
  assert.deepEqual(harness.controller.get(first.productId), monitoring);

  const cleared = harness.controller.finishLaunch(
    first.productId,
    first.generation,
    first.operationId,
    false
  );
  assert.equal(cleared, null);
  assert.deepEqual(harness.records.products["comfy-desktop"], {
    generation: 1,
    operation: null
  });
  assert.equal(
    harness.scheduled.filter((handle) => !handle.canceled).length,
    0
  );

  harness.advance(-5_000);
  const second = harness.controller.begin("comfy-desktop", "uninstall");
  assert.equal(second.generation, 2);
  assert.equal(second.startedAt, "2026-07-29T23:59:56.000Z");
  assert.throws(
    () => harness.controller.begin("comfy-desktop", "install"),
    /进行中/
  );
});

test("finishLaunch retries a failed launching commit without changing identity", async () => {
  const harness = createHarness({ statuses: [installed] });
  const launching = harness.controller.begin(
    "comfy-desktop",
    "install"
  );
  harness.setWriteFailure(true);

  assert.throws(
    () =>
      harness.controller.finishLaunch(
        launching.productId,
        launching.generation,
        launching.operationId,
        true
      ),
    /disk full/
  );
  assert.deepEqual(harness.controller.get(launching.productId), launching);
  assert.deepEqual(
    harness.records.products[launching.productId].operation,
    launching
  );
  assert.deepEqual(harness.changes, [launching]);
  assert.equal(
    harness.scheduled.filter((handle) => !handle.canceled).length,
    1
  );

  const stillLaunching = await harness.runNext();
  assert.deepEqual(stillLaunching, launching);
  assert.equal(
    harness.scheduled.filter((handle) => !handle.canceled).length,
    1
  );

  harness.setWriteFailure(false);
  harness.advance(5_000);
  const monitoring = await harness.runNext();
  assert.equal(monitoring.phase, "monitoring");
  assert.equal(monitoring.launchState, "confirmed");
  assert.equal(monitoring.generation, launching.generation);
  assert.equal(monitoring.operationId, launching.operationId);
  assert.equal(monitoring.revision, launching.revision + 1);
  assert.deepEqual(
    harness.records.products[launching.productId].operation,
    monitoring
  );
  assert.equal(
    harness.scheduled.filter((handle) => !handle.canceled).length,
    1
  );

  const completed = await harness.runNext();
  assert.equal(completed.phase, "installed");
  assert.equal(harness.controller.get(launching.productId), null);
});

test("finishLaunch retries a failed clear without monitoring or relaunching", async () => {
  const harness = createHarness({ statuses: [installed] });
  const launching = harness.controller.begin(
    "comfy-desktop",
    "install"
  );
  harness.setWriteFailure(true);

  assert.throws(
    () =>
      harness.controller.finishLaunch(
        launching.productId,
        launching.generation,
        launching.operationId,
        false
      ),
    /disk full/
  );
  assert.deepEqual(harness.controller.get(launching.productId), launching);
  assert.deepEqual(
    harness.records.products[launching.productId].operation,
    launching
  );
  assert.deepEqual(harness.changes, [launching]);
  assert.equal(harness.checkCalls, 0);
  assert.equal(
    harness.scheduled.filter((handle) => !handle.canceled).length,
    1
  );

  harness.setWriteFailure(false);
  assert.equal(await harness.runNext(), null);
  assert.equal(harness.controller.get(launching.productId), null);
  assert.deepEqual(harness.records.products[launching.productId], {
    generation: launching.generation,
    operation: null
  });
  assert.deepEqual(harness.changes, [launching]);
  assert.equal(harness.checkCalls, 0);
  assert.equal(
    harness.scheduled.filter((handle) => !handle.canceled).length,
    0
  );
});

test("a launch commit retry is inert after its operation is cleared", async () => {
  const harness = createHarness();
  const launching = harness.controller.begin(
    "comfy-desktop",
    "install"
  );
  harness.setWriteFailure(true);
  assert.throws(
    () =>
      harness.controller.finishLaunch(
        launching.productId,
        launching.generation,
        launching.operationId,
        true
      ),
    /disk full/
  );
  const retryHandle = harness.scheduled.find((handle) => !handle.canceled);
  assert.ok(retryHandle);

  harness.setWriteFailure(false);
  assert.equal(
    harness.controller.finishLaunch(
      launching.productId,
      launching.generation,
      launching.operationId,
      false
    ),
    null
  );
  assert.equal(retryHandle.canceled, true);
  assert.equal(await retryHandle.callback(), null);
  assert.deepEqual(harness.records.products[launching.productId], {
    generation: launching.generation,
    operation: null
  });
  assert.equal(
    harness.scheduled.filter((handle) => !handle.canceled).length,
    0
  );
});

test("install and uninstall complete only on their opposite trusted evidence", async () => {
  const installHarness = createHarness({
    statuses: [absent, installed]
  });
  const install = installHarness.controller.begin(
    "comfy-desktop",
    "install"
  );
  installHarness.controller.finishLaunch(
    install.productId,
    install.generation,
    install.operationId,
    true
  );

  const stillInstalling = await installHarness.runNext();
  assert.equal(stillInstalling.phase, "monitoring");
  assert.equal(stillInstalling.attempts, 1);
  assert.equal(stillInstalling.lastDetection, "absent");
  assert.deepEqual(installHarness.controller.get(install.productId), stillInstalling);

  installHarness.advance(5_000);
  const installedEvent = await installHarness.runNext();
  assert.equal(installedEvent.phase, "installed");
  assert.equal(installedEvent.lastDetection, "installed");
  assert.deepEqual(installedEvent.desktopStatus, installed);
  assert.equal(installHarness.controller.get(install.productId), null);
  assert.deepEqual(installHarness.records.products[install.productId], {
    generation: 1,
    operation: null
  });

  const uninstallHarness = createHarness({
    statuses: [installed, absent]
  });
  const uninstall = uninstallHarness.controller.begin(
    "ollama-cli",
    "uninstall"
  );
  uninstallHarness.controller.finishLaunch(
    uninstall.productId,
    uninstall.generation,
    uninstall.operationId,
    true
  );

  const stillInstalled = await uninstallHarness.runNext();
  assert.equal(stillInstalled.phase, "monitoring");
  assert.equal(stillInstalled.lastDetection, "installed");
  assert.deepEqual(stillInstalled.desktopStatus, installed);

  uninstallHarness.advance(5_000);
  const uninstalledEvent = await uninstallHarness.runNext();
  assert.equal(uninstalledEvent.phase, "uninstalled");
  assert.equal(uninstalledEvent.lastDetection, "absent");
  assert.deepEqual(uninstalledEvent.desktopStatus, absent);
  assert.equal(uninstallHarness.controller.get(uninstall.productId), null);
});

test("desktop operations preserve the adapter uninstall interaction mode", async () => {
  const automaticStatus = {
    ...installed,
    uninstallMode: "automatic"
  };
  const harness = createHarness({
    statuses: [automaticStatus]
  });
  const operation = harness.controller.begin(
    "comfy-desktop",
    "uninstall"
  );
  harness.controller.finishLaunch(
    operation.productId,
    operation.generation,
    operation.operationId,
    true
  );

  const monitoring = await harness.runNext();
  assert.equal(monitoring.phase, "monitoring");
  assert.equal(monitoring.desktopStatus.uninstallMode, "automatic");
  assert.equal(
    harness.records.products[operation.productId].operation.desktopStatus
      .uninstallMode,
    "automatic"
  );
});

test("resume converts a possibly spawned launching task to unknown monitoring", async () => {
  const first = createHarness();
  const launching = first.controller.begin("comfy-desktop", "install");
  first.controller.dispose();

  const restored = createHarness({
    records: first.records,
    statuses: [absent],
    startTime: Date.parse(launching.startedAt) + 2_000
  });
  const resumed = restored.controller.resume();

  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].generation, launching.generation);
  assert.equal(resumed[0].operationId, launching.operationId);
  assert.equal(resumed[0].phase, "monitoring");
  assert.equal(resumed[0].launchState, "unknown");
  assert.equal(resumed[0].revision, launching.revision + 1);
  assert.equal(resumed[0].startedAt, launching.startedAt);
  assert.equal(resumed[0].deadlineAt, launching.deadlineAt);
  assert.deepEqual(
    restored.records.products["comfy-desktop"].operation,
    resumed[0]
  );
  assert.equal(
    restored.scheduled.filter((handle) => !handle.canceled).length,
    1
  );

  const checked = await restored.runNext();
  assert.equal(checked.phase, "monitoring");
  assert.equal(checked.launchState, "unknown");
  assert.equal(checked.lastDetection, "absent");
});

test("resume repeats a failed launching recovery commit until it is durable", async () => {
  const first = createHarness();
  const launching = first.controller.begin("comfy-desktop", "install");
  first.controller.dispose();

  const restored = createHarness({
    records: first.records,
    statuses: [installed],
    startTime: Date.parse(launching.startedAt) + 2_000
  });
  restored.setWriteFailure(true);
  const resumed = restored.controller.resume();

  assert.deepEqual(resumed, [launching]);
  assert.deepEqual(
    restored.records.products[launching.productId].operation,
    launching
  );
  assert.equal(
    restored.scheduled.filter((handle) => !handle.canceled).length,
    1
  );

  assert.deepEqual(await restored.runNext(), launching);
  assert.equal(
    restored.scheduled.filter((handle) => !handle.canceled).length,
    1
  );

  restored.setWriteFailure(false);
  restored.advance(5_000);
  const monitoring = await restored.runNext();
  assert.equal(monitoring.phase, "monitoring");
  assert.equal(monitoring.launchState, "unknown");
  assert.equal(monitoring.generation, launching.generation);
  assert.equal(monitoring.operationId, launching.operationId);
  assert.deepEqual(
    restored.records.products[launching.productId].operation,
    monitoring
  );

  const completed = await restored.runNext();
  assert.equal(completed.phase, "installed");
  assert.equal(restored.controller.get(launching.productId), null);
});

test("a timed-out operation remains checkable after restart and caps attempts", async () => {
  const first = createHarness({ statuses: [absent] });
  const task = first.controller.begin("comfy-desktop", "install");
  first.controller.finishLaunch(
    task.productId,
    task.generation,
    task.operationId,
    true
  );
  first.advance(10 * 60 * 1_000);
  const timedOut = await first.runNext();
  assert.equal(timedOut.phase, "timed-out");
  first.controller.dispose();

  const maxAttempts = 120;
  const saturated = {
    ...timedOut,
    revision: timedOut.revision + maxAttempts,
    attempts: maxAttempts
  };
  const saturatedRecords = structuredClone(first.records);
  saturatedRecords.products["comfy-desktop"].operation = saturated;
  const restored = createHarness({
    records: saturatedRecords,
    statuses: [absent, installed],
    startTime: Date.parse(task.deadlineAt) + 60_000
  });

  restored.controller.resume();
  const stillTimedOut = await restored.runNext();
  assert.equal(stillTimedOut.phase, "timed-out");
  assert.equal(stillTimedOut.attempts, maxAttempts);

  restored.controller.resume();
  const completed = await restored.runNext();
  assert.equal(completed.phase, "installed");
  assert.equal(completed.attempts, maxAttempts);
  assert.equal(restored.controller.get(task.productId), null);
});

test("migrates the legacy install verification map to generation one", () => {
  const legacy = {
    "comfy-desktop": {
      schemaVersion: 1,
      productId: "comfy-desktop",
      verificationId: "legacy-verification",
      revision: 4,
      phase: "monitoring",
      attempts: 3,
      startedAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:15.000Z",
      deadlineAt: "2026-07-30T00:10:00.000Z",
      lastCheckedAt: "2026-07-30T00:00:15.000Z",
      lastDetection: "absent",
      lastError: null,
      desktopStatus: absent
    }
  };
  const harness = createHarness({
    records: legacy,
    startTime: Date.parse("2026-07-30T00:00:20.000Z")
  });
  const migrated = harness.controller.get("comfy-desktop");

  assert.deepEqual(migrated, {
    schemaVersion: 1,
    productId: "comfy-desktop",
    generation: 1,
    operationId: "legacy-verification",
    operation: "install",
    phase: "monitoring",
    launchState: "confirmed",
    revision: 4,
    attempts: 3,
    startedAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:15.000Z",
    deadlineAt: "2026-07-30T00:10:00.000Z",
    lastCheckedAt: "2026-07-30T00:00:15.000Z",
    lastDetection: "absent",
    lastError: null,
    desktopStatus: absent
  });
  assert.deepEqual(harness.records, {
    schemaVersion: 1,
    products: {
      "comfy-desktop": {
        generation: 1,
        operation: migrated
      }
    }
  });
});

test("rejects stale launch and scan results by generation and operation id", async () => {
  const harness = createHarness();
  const first = harness.controller.begin("comfy-desktop", "install");
  harness.controller.finishLaunch(
    first.productId,
    first.generation,
    first.operationId,
    true
  );
  const deferred = harness.deferNextCheck();
  const staleCheck = harness.runNext();

  harness.controller.finishLaunch(
    first.productId,
    first.generation,
    first.operationId,
    false
  );
  harness.advance(-60_000);
  const second = harness.controller.begin("comfy-desktop", "uninstall");
  const changesAfterSecondBegin = harness.changes.length;
  assert.equal(second.generation, first.generation + 1);
  assert.ok(
    Date.parse(second.startedAt) < Date.parse(first.startedAt),
    "the test must exercise a system-clock rollback"
  );

  deferred.resolve(installed);
  const staleResult = await staleCheck;
  assert.deepEqual(staleResult, second);
  assert.deepEqual(harness.controller.get(second.productId), second);
  assert.deepEqual(
    harness.records.products[second.productId].operation,
    second
  );
  assert.equal(harness.changes.length, changesAfterSecondBegin);

  assert.deepEqual(
    harness.controller.finishLaunch(
      first.productId,
      first.generation,
      first.operationId,
      false
    ),
    second
  );
  assert.deepEqual(harness.controller.get(second.productId), second);
});

test("notification failures cannot block durable begin, launch, or resume", () => {
  const first = createHarness({
    onChange: () => {
      throw new Error("renderer closed");
    }
  });
  const launching = first.controller.begin("comfy-desktop", "install");
  const monitoring = first.controller.finishLaunch(
    launching.productId,
    launching.generation,
    launching.operationId,
    true
  );

  assert.equal(monitoring.phase, "monitoring");
  assert.deepEqual(
    first.records.products["comfy-desktop"].operation,
    monitoring
  );
  first.controller.dispose();

  const restored = createHarness({
    records: first.records,
    onChange: () => {
      throw new Error("renderer reloading");
    }
  });
  const resumed = restored.controller.resume();
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].operationId, monitoring.operationId);
  assert.equal(
    restored.scheduled.filter((handle) => !handle.canceled).length,
    1
  );
});

test("a failed atomic begin never exposes an in-memory operation", () => {
  const harness = createHarness();
  harness.setWriteFailure(true);

  assert.throws(
    () => harness.controller.begin("comfy-desktop", "install"),
    /disk full/
  );
  assert.equal(harness.controller.get("comfy-desktop"), null);
  assert.deepEqual(harness.changes, []);
  assert.deepEqual(harness.records, {
    schemaVersion: 1,
    products: {}
  });
});

test("manual checks require the current generation and operation identity", async () => {
  const harness = createHarness({ statuses: [installed] });
  const launching = harness.controller.begin("comfy-desktop", "install");
  const monitoring = harness.controller.finishLaunch(
    launching.productId,
    launching.generation,
    launching.operationId,
    true
  );

  const staleGeneration = await harness.controller.checkNow(
    monitoring.productId,
    monitoring.generation - 1,
    monitoring.operationId
  );
  const staleIdentity = await harness.controller.checkNow(
    monitoring.productId,
    monitoring.generation,
    "stale-operation"
  );

  assert.deepEqual(staleGeneration, monitoring);
  assert.deepEqual(staleIdentity, monitoring);
  assert.deepEqual(harness.controller.get(monitoring.productId), monitoring);
});
