"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const {
  windowsPowerShellPath
} = require("../shared/windows-system-paths.cjs");

test("Windows PowerShell resolves to the real inbox executable", () => {
  assert.equal(
    windowsPowerShellPath("C:\\Windows"),
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
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
