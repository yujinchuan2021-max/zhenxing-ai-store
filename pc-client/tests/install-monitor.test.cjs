const assert = require("node:assert/strict");
const test = require("node:test");

const { waitForInstallation } = require("../shared/install-monitor.cjs");

const missing = {
  installed: false,
  version: "",
  location: "",
  executable: "",
  appId: ""
};
const installed = {
  installed: true,
  version: "1.2.3",
  location: "C:\\Program Files\\Example",
  executable: "C:\\Program Files\\Example\\Example.exe",
  appId: "Example.App"
};

test("stops as soon as installation evidence appears", async () => {
  let checks = 0;
  const attempts = [];
  const result = await waitForInstallation({
    check: async () => (++checks === 3 ? installed : missing),
    wait: async () => {},
    intervalMs: 1,
    maxAttempts: 5,
    onAttempt: (_status, attempt) => attempts.push(attempt)
  });
  assert.equal(result.outcome, "installed");
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.desktopStatus, installed);
  assert.deepEqual(attempts, [1, 2, 3]);
});

test("continues after a temporary scan failure", async () => {
  let checks = 0;
  const result = await waitForInstallation({
    check: async () => {
      checks += 1;
      if (checks === 1) throw new Error("PowerShell busy");
      return installed;
    },
    wait: async () => {},
    intervalMs: 1,
    maxAttempts: 3
  });
  assert.equal(result.outcome, "installed");
  assert.equal(result.attempts, 2);
});

test("returns timeout without claiming installation success", async () => {
  const result = await waitForInstallation({
    check: async () => missing,
    wait: async () => {},
    intervalMs: 1,
    maxAttempts: 3
  });
  assert.deepEqual(result, {
    outcome: "timeout",
    attempts: 3,
    desktopStatus: missing
  });
});

test("honors cancellation before another scan starts", async () => {
  const controller = new AbortController();
  controller.abort();
  let checks = 0;
  const result = await waitForInstallation({
    check: async () => {
      checks += 1;
      return missing;
    },
    wait: async () => {},
    intervalMs: 1,
    maxAttempts: 3,
    signal: controller.signal
  });
  assert.equal(result.outcome, "canceled");
  assert.equal(checks, 0);
});
