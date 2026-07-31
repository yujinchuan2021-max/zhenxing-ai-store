"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  closeReviewedProcesses
} = require("../shared/reviewed-process-close.cjs");

test("force-after-grace closes a tray process that ignores a normal taskkill", async () => {
  const calls = [];
  let running = true;
  const result = await closeReviewedProcesses({
    processNames: ["OpenClaw.Tray.WinUI.exe"],
    strategy: "force-after-grace",
    runTaskkill: async (name, force) => {
      calls.push({ name, force });
      if (force) running = false;
      return { ok: true, notRunning: false };
    },
    isProcessRunning: async () => running,
    wait: async () => {}
  });

  assert.deepEqual(calls, [
    { name: "OpenClaw.Tray.WinUI.exe", force: false },
    { name: "OpenClaw.Tray.WinUI.exe", force: true }
  ]);
  assert.deepEqual(result, { ok: true, closed: true });
});

test("graceful close refuses to launch an uninstaller while the app remains", async () => {
  const result = await closeReviewedProcesses({
    processNames: ["Example.exe"],
    runTaskkill: async () => ({ ok: true, notRunning: false }),
    isProcessRunning: async () => true,
    wait: async () => {}
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /仍在运行/);
});
