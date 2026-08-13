const assert = require("node:assert/strict");
const test = require("node:test");

const { waitForUninstallation } = require("../shared/uninstall-monitor.cjs");

const installed = { installed: true, version: "1.2.3", detection: "installed" };
const removed = { installed: false, version: "", detection: "absent" };
const unknown = { installed: false, version: "", detection: "unknown" };

test("stops only after installation evidence disappears", async () => {
  let checks = 0;
  const result = await waitForUninstallation({
    check: async () => (++checks === 3 ? removed : installed),
    wait: async () => {},
    maxAttempts: 5
  });
  assert.equal(result.outcome, "uninstalled");
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.desktopStatus, removed);
});

test("continues after a temporary status scan failure", async () => {
  let checks = 0;
  const result = await waitForUninstallation({
    check: async () => {
      checks += 1;
      if (checks === 1) return unknown;
      return removed;
    },
    wait: async () => {},
    maxAttempts: 3
  });
  assert.equal(result.outcome, "uninstalled");
  assert.equal(result.attempts, 2);
});

test("never treats an unknown scan as confirmed removal", async () => {
  const result = await waitForUninstallation({
    check: async () => unknown,
    wait: async () => {},
    maxAttempts: 2
  });
  assert.equal(result.outcome, "timeout");
  assert.deepEqual(result.desktopStatus, unknown);
});

test("times out without claiming uninstall success", async () => {
  const result = await waitForUninstallation({
    check: async () => installed,
    wait: async () => {},
    maxAttempts: 3
  });
  assert.deepEqual(result, {
    outcome: "timeout",
    attempts: 3,
    desktopStatus: installed
  });
});

test("honors cancellation before another scan", async () => {
  const controller = new AbortController();
  controller.abort();
  let checks = 0;
  const result = await waitForUninstallation({
    check: async () => {
      checks += 1;
      return removed;
    },
    wait: async () => {},
    maxAttempts: 3,
    signal: controller.signal
  });
  assert.equal(result.outcome, "canceled");
  assert.equal(checks, 0);
});
