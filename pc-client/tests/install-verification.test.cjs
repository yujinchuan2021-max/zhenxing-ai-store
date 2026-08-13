const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createInstallVerificationController
} = require("../shared/install-verification.cjs");

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
  version: "1.2.3",
  location: "C:\\Program Files\\Example",
  executable: "C:\\Program Files\\Example\\Example.exe",
  appId: "",
  canOpen: true,
  canUninstall: true,
  detection: "installed"
};

const unknown = {
  ...absent,
  detection: "unknown"
};

function createHarness({
  records = {},
  statuses = [absent],
  ids = null,
  startTime = Date.parse("2026-07-30T00:00:00.000Z")
} = {}) {
  let clock = startTime;
  let stored = structuredClone(records);
  let nextId = 1;
  const scheduled = [];
  const changes = [];
  const statusQueue = [...statuses];
  const idQueue = Array.isArray(ids) ? [...ids] : null;
  let deferredCheck = null;

  const controller = createInstallVerificationController({
    loadRecords: () => structuredClone(stored),
    saveRecords: (value) => {
      stored = structuredClone(value);
    },
    checkProduct: async () => {
      if (deferredCheck) return deferredCheck.promise;
      return structuredClone(statusQueue.shift() || absent);
    },
    isSupported: (productId) =>
      ["comfy-desktop", "ollama-cli"].includes(productId),
    now: () => clock,
    createId: () => idQueue?.shift() ?? `verification-${nextId++}`,
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
      assert.ok(handle, "expected a scheduled verification");
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

test("starts one persisted verification with an absolute deadline", () => {
  const harness = createHarness();
  const task = harness.controller.start("comfy-desktop");

  assert.equal(task.phase, "monitoring");
  assert.equal(task.attempts, 0);
  assert.equal(task.verificationId, "verification-1");
  assert.equal(
    Date.parse(task.deadlineAt) - Date.parse(task.startedAt),
    10 * 60 * 1_000
  );
  assert.deepEqual(harness.records["comfy-desktop"], task);
});

test("keeps polling absent evidence and finishes on installed evidence", async () => {
  const harness = createHarness({ statuses: [absent, installed] });
  harness.controller.start("comfy-desktop");

  await harness.runNext();
  assert.equal(harness.controller.get("comfy-desktop").attempts, 1);
  assert.equal(harness.controller.get("comfy-desktop").phase, "monitoring");

  harness.advance(5_000);
  const completed = await harness.runNext();
  assert.equal(completed.phase, "installed");
  assert.deepEqual(completed.desktopStatus, installed);
  assert.equal(harness.controller.get("comfy-desktop"), null);
  assert.equal(harness.records["comfy-desktop"], undefined);
});

test("restores before the original deadline and times out against wall clock", async () => {
  const first = createHarness();
  const original = first.controller.start("comfy-desktop");
  first.controller.dispose();

  const restored = createHarness({
    records: { "comfy-desktop": original },
    startTime: Date.parse(original.deadlineAt) + 1,
    statuses: [absent]
  });
  const resumed = restored.controller.resume();
  assert.equal(resumed[0].verificationId, original.verificationId);

  const timedOut = await restored.runNext();
  assert.equal(timedOut.phase, "timed-out");
  assert.equal(restored.controller.get("comfy-desktop").phase, "timed-out");
});

test("times out by bounded attempts when the system clock moves backward", async () => {
  const first = createHarness();
  const original = first.controller.start("comfy-desktop");
  first.advance(5_000);
  await first.runNext();
  const futureDated = first.controller.get("comfy-desktop");
  first.controller.dispose();

  const restored = createHarness({
    records: { "comfy-desktop": futureDated },
    startTime: Date.parse(original.startedAt),
    statuses: []
  });
  restored.controller.resume();
  let result = futureDated;
  const maxAttempts = Math.ceil((10 * 60 * 1_000) / 5_000);
  while (result.attempts < maxAttempts) {
    result = await restored.runNext();
  }

  assert.equal(result.attempts, maxAttempts);
  assert.equal(result.phase, "timed-out");
  assert.equal(restored.controller.get("comfy-desktop").phase, "timed-out");

  const restarted = createHarness({
    records: { "comfy-desktop": result },
    startTime: Date.parse(original.startedAt)
  });
  assert.equal(restarted.controller.get("comfy-desktop").phase, "timed-out");
});

test("keeps saturated timed-out verification valid across repeated checks and restarts", async () => {
  const first = createHarness();
  const original = first.controller.start("comfy-desktop");
  first.advance(5_000);
  await first.runNext();
  const futureDated = first.controller.get("comfy-desktop");
  first.controller.dispose();

  let current = createHarness({
    records: { "comfy-desktop": futureDated },
    startTime: Date.parse(original.startedAt)
  });
  current.controller.resume();
  let timedOut = futureDated;
  const maxAttempts = Math.ceil((10 * 60 * 1_000) / 5_000);
  while (timedOut.attempts < maxAttempts) {
    timedOut = await current.runNext();
  }
  assert.equal(timedOut.phase, "timed-out");
  assert.equal(timedOut.attempts, maxAttempts);
  current.controller.dispose();

  let persisted = current.records["comfy-desktop"];
  for (const status of [absent, unknown, absent]) {
    const previousRevision = persisted.revision;
    current = createHarness({
      records: { "comfy-desktop": persisted },
      statuses: [status],
      startTime: Date.parse(original.startedAt)
    });
    const restored = current.controller.get("comfy-desktop");
    assert.ok(restored, "timed-out verification must survive reconstruction");
    assert.equal(restored.phase, "timed-out");

    const checked = await current.controller.checkNow(
      "comfy-desktop",
      restored.verificationId
    );
    assert.equal(checked.phase, "timed-out");
    assert.equal(checked.attempts, maxAttempts);
    assert.equal(checked.revision, previousRevision + 1);
    current.controller.dispose();
    persisted = current.records["comfy-desktop"];
  }

  const completedHarness = createHarness({
    records: { "comfy-desktop": persisted },
    statuses: [installed],
    startTime: Date.parse(original.startedAt)
  });
  const completed = await completedHarness.controller.checkNow(
    "comfy-desktop",
    persisted.verificationId
  );
  assert.equal(completed.phase, "installed");
  assert.equal(completed.attempts, maxAttempts);
  assert.equal(completedHarness.controller.get("comfy-desktop"), null);
  assert.deepEqual(completedHarness.records, {});
});

test("a timed-out task still detects installation completed while closed", async () => {
  const first = createHarness();
  const original = first.controller.start("comfy-desktop");
  first.advance(10 * 60 * 1_000);
  const timedOutRecord = await first.runNext();
  first.controller.dispose();
  const restored = createHarness({
    records: { "comfy-desktop": timedOutRecord },
    startTime: Date.parse(original.deadlineAt) + 60_000,
    statuses: [installed]
  });

  restored.controller.resume();
  const completed = await restored.runNext();
  assert.equal(completed.phase, "installed");
  assert.equal(restored.controller.get("comfy-desktop"), null);
});

test("drops only damaged or unsupported records during recovery", () => {
  const validHarness = createHarness();
  const valid = validHarness.controller.start("comfy-desktop");
  validHarness.controller.dispose();

  const restored = createHarness({
    records: {
      "comfy-desktop": valid,
      "ollama-cli": [],
      unknown: { ...valid, productId: "unknown" }
    }
  });

  assert.deepEqual(Object.keys(restored.records), ["comfy-desktop"]);
  assert.equal(restored.controller.get("ollama-cli"), null);
});

test("drops a persisted verification whose deadline exceeds the configured timeout", () => {
  const validHarness = createHarness();
  const valid = validHarness.controller.start("comfy-desktop");
  validHarness.controller.dispose();
  const damaged = {
    ...valid,
    deadlineAt: new Date(
      Date.parse(valid.startedAt) + 10 * 60 * 1_000 + 1
    ).toISOString()
  };

  const restored = createHarness({
    records: { "comfy-desktop": damaged }
  });

  assert.equal(restored.controller.get("comfy-desktop"), null);
  assert.deepEqual(restored.records, {});
});

test("drops persisted verifications with inconsistent chronology or status", () => {
  const validHarness = createHarness();
  const valid = validHarness.controller.start("comfy-desktop");
  validHarness.controller.dispose();
  const checkedAt = new Date(Date.parse(valid.startedAt) + 5_000).toISOString();
  const checked = {
    ...valid,
    revision: 2,
    attempts: 1,
    updatedAt: checkedAt,
    lastCheckedAt: checkedAt,
    lastDetection: "absent",
    desktopStatus: absent
  };
  const damagedRecords = [
    { ...valid, deadlineAt: valid.startedAt },
    {
      ...checked,
      lastCheckedAt: new Date(Date.parse(valid.startedAt) - 1).toISOString()
    },
    { ...checked, revision: 3 },
    { ...checked, revision: 122, attempts: 121 },
    { ...checked, phase: "timed-out" },
    {
      ...checked,
      desktopStatus: { ...absent, detection: "unknown" }
    },
    {
      ...checked,
      desktopStatus: {
        installed: false,
        version: "",
        location: "",
        executable: "",
        appId: "",
        canUninstall: false,
        detection: "absent"
      }
    }
  ];

  for (const damaged of damagedRecords) {
    const restored = createHarness({
      records: { "comfy-desktop": damaged }
    });
    assert.equal(
      restored.controller.get("comfy-desktop"),
      null,
      JSON.stringify(damaged)
    );
    assert.deepEqual(restored.records, {});
  }
});

test("rejects a late scan result after a new installer launch", async () => {
  const harness = createHarness();
  const first = harness.controller.start("comfy-desktop");
  const deferred = harness.deferNextCheck();
  const staleCheck = harness.runNext();

  const second = harness.controller.start("comfy-desktop");
  const changesAfterSecondStart = harness.changes.length;
  assert.notEqual(second.verificationId, first.verificationId);
  deferred.resolve(installed);
  await staleCheck;

  assert.equal(
    harness.controller.get("comfy-desktop").verificationId,
    second.verificationId
  );
  assert.equal(harness.controller.get("comfy-desktop").phase, "monitoring");
  assert.deepEqual(harness.records["comfy-desktop"], second);
  assert.equal(harness.changes.length, changesAfterSecondStart);
});

test("requires a fresh non-empty identity for each verification", () => {
  const reused = createHarness({ ids: ["same-id", "same-id"] });
  const first = reused.controller.start("comfy-desktop");

  assert.throws(
    () => reused.controller.start("comfy-desktop"),
    /验证标识/
  );
  assert.deepEqual(reused.controller.get("comfy-desktop"), first);
  assert.deepEqual(reused.records["comfy-desktop"], first);

  const empty = createHarness({ ids: [" "] });
  assert.throws(
    () => empty.controller.start("comfy-desktop"),
    /验证标识/
  );
  assert.equal(empty.controller.get("comfy-desktop"), null);
  assert.deepEqual(empty.records, {});
});

test("notification failures do not block starting or resuming verification", async () => {
  let stored = {};
  let scheduled = [];
  const createController = () =>
    createInstallVerificationController({
      loadRecords: () => structuredClone(stored),
      saveRecords: (value) => {
        stored = structuredClone(value);
      },
      checkProduct: async () => absent,
      isSupported: (productId) => productId === "comfy-desktop",
      now: () => Date.parse("2026-07-30T00:00:00.000Z"),
      createId: () => "verification-notification-failure",
      schedule: (callback, delayMs) => {
        const handle = { callback, delayMs, canceled: false };
        scheduled.push(handle);
        return handle;
      },
      cancelSchedule: (handle) => {
        handle.canceled = true;
      },
      onChange: () => {
        throw new Error("window closed");
      }
    });

  const first = createController();
  const started = first.start("comfy-desktop");
  const firstHandle = scheduled.find((handle) => !handle.canceled);
  assert.ok(firstHandle, "a notification failure must not suppress scheduling");
  firstHandle.canceled = true;
  await firstHandle.callback();
  assert.equal(first.get("comfy-desktop").attempts, 1);
  first.dispose();

  scheduled = [];
  const restored = createController();
  assert.deepEqual(restored.resume().map((task) => task.verificationId), [
    started.verificationId
  ]);
  const restoredHandle = scheduled.find((handle) => !handle.canceled);
  assert.ok(
    restoredHandle,
    "a notification failure must not suppress recovery scheduling"
  );
});

test("does not expose a task when atomic persistence fails", () => {
  const changes = [];
  const controller = createInstallVerificationController({
    loadRecords: () => ({}),
    saveRecords: () => {
      throw new Error("disk full");
    },
    checkProduct: async () => absent,
    isSupported: (productId) => productId === "comfy-desktop",
    now: () => Date.parse("2026-07-30T00:00:00.000Z"),
    createId: () => "verification-write-failure",
    schedule: () => 1,
    cancelSchedule: () => {},
    onChange: (task) => changes.push(task)
  });

  assert.throws(() => controller.start("comfy-desktop"), /disk full/);
  assert.equal(controller.get("comfy-desktop"), null);
  assert.deepEqual(changes, []);
});

test("contains a background persistence failure and safely schedules a retry", async () => {
  let stored = {};
  let failWrites = false;
  const scheduled = [];
  const changes = [];
  const controller = createInstallVerificationController({
    loadRecords: () => structuredClone(stored),
    saveRecords: (value) => {
      if (failWrites) throw new Error("disk full");
      stored = structuredClone(value);
    },
    checkProduct: async () => absent,
    isSupported: (productId) => productId === "comfy-desktop",
    now: () => Date.parse("2026-07-30T00:00:00.000Z"),
    createId: () => "verification-background-write-failure",
    schedule: (callback, delayMs) => {
      const handle = { callback, delayMs, canceled: false };
      scheduled.push(handle);
      return handle;
    },
    cancelSchedule: (handle) => {
      handle.canceled = true;
    },
    onChange: (task) => changes.push(structuredClone(task))
  });
  const original = controller.start("comfy-desktop");
  const initialHandle = scheduled.find((handle) => !handle.canceled);
  assert.ok(initialHandle);
  initialHandle.canceled = true;
  failWrites = true;

  const result = await initialHandle.callback();

  assert.deepEqual(result, original);
  assert.deepEqual(controller.get("comfy-desktop"), original);
  assert.deepEqual(stored["comfy-desktop"], original);
  assert.deepEqual(changes, [original]);
  assert.equal(
    scheduled.filter((handle) => !handle.canceled).length,
    1,
    "the same verification should be retried"
  );
});

test("keeps valid in-memory recovery when sanitization cannot be persisted", () => {
  const validHarness = createHarness();
  const valid = validHarness.controller.start("comfy-desktop");
  validHarness.controller.dispose();
  let writes = 0;

  const controller = createInstallVerificationController({
    loadRecords: () => ({
      "comfy-desktop": valid,
      "ollama-cli": []
    }),
    saveRecords: () => {
      writes += 1;
      throw new Error("disk full");
    },
    checkProduct: async () => absent,
    isSupported: (productId) =>
      ["comfy-desktop", "ollama-cli"].includes(productId),
    now: () => Date.parse(valid.startedAt),
    createId: () => "verification-after-sanitize-failure",
    schedule: () => 1,
    cancelSchedule: () => {}
  });

  assert.deepEqual(controller.get("comfy-desktop"), valid);
  assert.equal(controller.get("ollama-cli"), null);
  assert.equal(writes, 1);
});
