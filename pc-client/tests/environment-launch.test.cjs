"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createEnvironmentOpenAction } = require("../shared/environment-launch.cjs");

test("every reviewed terminal environment uses the same launch module", () => {
  const action = createEnvironmentOpenAction({
    plan: { openMode: "terminal" },
    status: { installed: true, canOpen: true, executable: "C:\\Windows\\System32\\wsl.exe" },
    commandExecutable: "C:\\Windows\\System32\\cmd.exe"
  });
  assert.deepEqual(action, {
    type: "process",
    executable: "C:\\Windows\\System32\\cmd.exe",
    args: ["/d", "/k", "C:\\Windows\\System32\\wsl.exe"],
    options: { detached: true, stdio: "ignore", windowsHide: false, shell: false }
  });
});

test("reviewed GUI environments still open their signed executable", () => {
  assert.deepEqual(createEnvironmentOpenAction({
    plan: { openMode: "application" },
    status: { installed: true, canOpen: true, executable: "C:\\Program Files\\Docker\\Docker Desktop.exe" },
    commandExecutable: "C:\\Windows\\System32\\cmd.exe"
  }), {
    type: "shell-open",
    executable: "C:\\Program Files\\Docker\\Docker Desktop.exe"
  });
});

test("environment launch refuses unreviewed modes and unavailable states", () => {
  assert.equal(createEnvironmentOpenAction({ plan: { openMode: "powershell" }, status: { installed: true, canOpen: true, executable: "C:\\x.exe" }, commandExecutable: "C:\\Windows\\System32\\cmd.exe" }), null);
  assert.equal(createEnvironmentOpenAction({ plan: { openMode: "terminal" }, status: { installed: false, canOpen: true, executable: "C:\\x.exe" }, commandExecutable: "C:\\Windows\\System32\\cmd.exe" }), null);
});
