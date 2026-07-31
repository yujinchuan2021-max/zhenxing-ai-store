"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("creates and removes an isolated packaged-client profile", async () => {
  const module = await import("../scripts/lib/packaged-client-cdp.mjs");
  const profile = module.createIsolatedAcceptanceProfile("aihub-cdp-test-");
  assert.equal(
    path.relative(path.resolve(os.tmpdir()), profile.root).startsWith(".."),
    false
  );
  assert.equal(fs.existsSync(path.join(profile.userData, "pc-settings.json")), true);
  await module.removeIsolatedAcceptanceProfile(profile);
  assert.equal(fs.existsSync(profile.root), false);
});

test("requires a real byte threshold and paused task from the download gate", async () => {
  const { verifyManagedDownloadPause } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const calls = [];
  const result = await verifyManagedDownloadPause({
    productId: "openclaw-windows-hub",
    minimumBytes: 1024,
    timeoutMs: 1000,
    async evaluate(expression) {
      calls.push(expression);
      if (expression.startsWith("Boolean")) return true;
      if (expression.includes("startDownload")) return { ok: true, task: {} };
      if (expression.includes("getDownloadTask")) {
        return { phase: "downloading", progress: { receivedBytes: 2048 } };
      }
      if (expression.includes("pauseDownload")) {
        return {
          task: {
            phase: "paused",
            progress: { receivedBytes: 2048 },
            sourceUrl: "https://example.test/installer.exe"
          }
        };
      }
      throw new Error(`Unexpected expression: ${expression}`);
    }
  });
  assert.deepEqual(result, {
    productId: "openclaw-windows-hub",
    phase: "paused",
    receivedBytes: 2048,
    sourceUrl: "https://example.test/installer.exe"
  });
  assert.equal(calls.some((entry) => entry.includes("pauseDownload")), true);
});
