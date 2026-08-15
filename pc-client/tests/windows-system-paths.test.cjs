"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const {
  windowsPowerShellEnvironment,
  windowsPowerShellPath
} = require("../shared/windows-system-paths.cjs");

test("Windows PowerShell resolves to the real inbox executable", () => {
  assert.equal(
    windowsPowerShellPath("C:\\Windows"),
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
  );
});

test("Windows PowerShell ignores a foreign PowerShell module path", () => {
  assert.deepEqual(
    windowsPowerShellEnvironment({
      Path: "C:\\Windows\\System32",
      PSModulePath: "C:\\Program Files\\PowerShell\\Modules",
      AIHUB_SIGNATURE_PATH: "C:\\Program Files\\Example\\example.exe"
    }),
    {
      Path: "C:\\Windows\\System32",
      AIHUB_SIGNATURE_PATH: "C:\\Program Files\\Example\\example.exe"
    }
  );
});

test(
  "the resolved Windows PowerShell executable starts on Windows",
  { skip: process.platform !== "win32" },
  () => {
    assert.doesNotThrow(() =>
      execFileSync(
        windowsPowerShellPath(process.env.SystemRoot),
        ["-NoProfile", "-NonInteractive", "-Command", "exit 0"],
        { windowsHide: true, timeout: 10_000 }
      )
    );
  }
);
