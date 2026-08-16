"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createProductionOrderCheckpoint,
  withProductionOrderHardTimeout
} = require("../lib/managed-download-production-order-lifecycle.cjs");

const contractName = "electron-lifecycle-probe";

function keepElectronLifecycleProbeRootAlive() {}

async function startElectronLifecycleProbe({ electron, userData, preloadPath, checkpoint }) {
  electron.app.on("window-all-closed", keepElectronLifecycleProbeRootAlive);
  electron.app.setPath("userData", userData);
  await electron.app.whenReady();

  checkpoint.write("window-prerequisites", "entered");
  const preloadStat = fs.lstatSync(preloadPath);
  const canonicalPreload = fs.realpathSync.native(preloadPath);
  assert.deepEqual({
    appReady: electron.app.isReady() === true,
    browserWindowCallable: typeof electron.BrowserWindow === "function",
    preloadRegular: preloadStat.isFile(),
    preloadNonSymlink: !preloadStat.isSymbolicLink(),
    preloadCanonical: canonicalPreload.toLowerCase() === path.resolve(preloadPath).toLowerCase()
  }, {
    appReady: true,
    browserWindowCallable: true,
    preloadRegular: true,
    preloadNonSymlink: true,
    preloadCanonical: true
  });
  checkpoint.write("window-prerequisites", "completed");

  checkpoint.write("window-constructor", "entered");
  let window;
  try {
    window = new electron.BrowserWindow({
      show: false,
      width: 1365,
      height: 768,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: canonicalPreload
      }
    });
  } catch {
    throw new Error("ELECTRON_LIFECYCLE_PROBE_WINDOW_CONSTRUCTOR_FAILED");
  }
  if (!window || !window.webContents || typeof window.isDestroyed !== "function" || window.isDestroyed()) {
    try { window?.destroy?.(); } catch {}
    throw new Error("ELECTRON_LIFECYCLE_PROBE_WINDOW_INVALID");
  }
  checkpoint.write("window-constructor", "completed");

  checkpoint.write("window-destroy", "entered");
  window.destroy();
  if (!window.isDestroyed()) throw new Error("ELECTRON_LIFECYCLE_PROBE_WINDOW_DESTROY_FAILED");
  checkpoint.write("window-destroy", "completed");

  await withProductionOrderHardTimeout(
    () => new Promise((resolve) => setImmediate(resolve)),
    1_000,
    "ELECTRON_LIFECYCLE_PROBE_MACROTASK_TIMEOUT"
  );
  checkpoint.write("keepalive-ready", "entered");
  checkpoint.write("keepalive-ready", "completed");
}

if (require.main === module || process.versions?.electron) {
  const electron = require("electron");
  const userData = process.env.AIHUB_ELECTRON_LIFECYCLE_PROBE_USER_DATA;
  const preloadPath = path.join(__dirname, "installed-management-preview-preload.cjs");
  try {
    if (!userData) throw new Error("ELECTRON_LIFECYCLE_PROBE_PROFILE_REQUIRED");
    const checkpoint = createProductionOrderCheckpoint(userData, contractName);
    startElectronLifecycleProbe({ electron, userData, preloadPath, checkpoint }).catch(() => {
      process.stderr.write("ELECTRON_LIFECYCLE_PROBE_FAILED\n");
    });
  } catch {
    process.stderr.write("ELECTRON_LIFECYCLE_PROBE_FAILED\n");
  }
}

module.exports = { startElectronLifecycleProbe };
