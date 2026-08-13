"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const lifecyclePath = path.join(root, "scripts", "lib", "managed-download-production-order-lifecycle.cjs");
const runnerPath = path.join(root, "scripts", "fixtures", "managed-download-electron-lifecycle-probe-runner.cjs");
const previewPreloadPath = path.join(root, "scripts", "fixtures", "installed-management-preview-preload.cjs");
const electronPath = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const contractName = "electron-lifecycle-probe";
const stages = ["window-prerequisites", "window-constructor", "window-destroy", "keepalive-ready"];

async function withOwnedProfile(action) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-lifecycle-probe-unit-"));
  try {
    return await action(profile);
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

test("electron lifecycle probe pure checkpoint contract is exact and ordered", async () => {
  const { createProductionOrderCheckpoint, readProductionOrderCheckpoint } = require(lifecyclePath);
  await withOwnedProfile((profile) => {
    const checkpoint = createProductionOrderCheckpoint(profile, contractName);
    for (const stage of stages) {
      checkpoint.write(stage, "entered");
      checkpoint.write(stage, "completed");
    }
    assert.deepEqual(readProductionOrderCheckpoint(profile, contractName), {
      schemaVersion: 1,
      sequence: 8,
      stage: "keepalive-ready",
      boundary: "completed"
    });
  });
});

test("electron lifecycle probe pure runner keeps one named listener through the final checkpoint", async () => {
  const { startElectronLifecycleProbe } = require(runnerPath);
  const registrations = [];
  const writes = [];
  let destroyed = false;
  let constructorOptions;
  const electron = {
    app: {
      on(event, listener) { registrations.push({ event, listener }); },
      setPath(name, value) { assert.equal(name, "userData"); assert.equal(typeof value, "string"); },
      whenReady() { return Promise.resolve(); },
      isReady() { return true; }
    },
    BrowserWindow: function BrowserWindow(options) {
      constructorOptions = options;
      return {
        webContents: {},
        isDestroyed() { return destroyed; },
        destroy() { destroyed = true; }
      };
    }
  };
  const checkpoint = { write(stage, boundary) { writes.push([stage, boundary]); } };
  await withOwnedProfile((profile) => startElectronLifecycleProbe({
    electron,
    userData: profile,
    preloadPath: previewPreloadPath,
    checkpoint
  }));

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].event, "window-all-closed");
  assert.equal(registrations[0].listener.name, "keepElectronLifecycleProbeRootAlive");
  assert.doesNotThrow(() => registrations[0].listener());
  assert.equal(destroyed, true);
  assert.equal(constructorOptions.show, false);
  assert.equal(constructorOptions.webPreferences.preload, previewPreloadPath);
  assert.deepEqual(writes, stages.flatMap((stage) => [[stage, "entered"], [stage, "completed"]]));
});

test("electron lifecycle probe pure constructor failure remains at constructor entered", async () => {
  const { startElectronLifecycleProbe } = require(runnerPath);
  const writes = [];
  const electron = {
    app: {
      on() {},
      setPath() {},
      whenReady() { return Promise.resolve(); },
      isReady() { return true; }
    },
    BrowserWindow: function BrowserWindow() { throw new Error("raw constructor detail"); }
  };
  await withOwnedProfile(async (profile) => {
    await assert.rejects(
      startElectronLifecycleProbe({ electron, userData: profile, preloadPath: previewPreloadPath, checkpoint: { write(stage, boundary) { writes.push([stage, boundary]); } } }),
      { message: "ELECTRON_LIFECYCLE_PROBE_WINDOW_CONSTRUCTOR_FAILED" }
    );
  });
  assert.deepEqual(writes.at(-1), ["window-constructor", "entered"]);
});

test("electron lifecycle probe hidden runner reaches controlled teardown", async () => {
  const { runProductionOrderChild } = require(lifecyclePath);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-order-lifecycle-probe-"));
  const result = await runProductionOrderChild({
    executable: electronPath,
    args: [runnerPath],
    cwd: root,
    env: { ...process.env, AIHUB_ELECTRON_LIFECYCLE_PROBE_USER_DATA: userData },
    profileDirectory: userData,
    timeoutMs: 30_000,
    contractName
  });
  assert.deepEqual(result, {
    exitClass: "exit-0",
    stderrClass: "empty",
    stage: "keepalive-ready",
    boundary: "completed",
    checkpointValid: true,
    childAbsent: true,
    treeAbsent: true,
    terminationClass: "controlled-success",
    profileAbsent: true,
    cleanupBlocked: false,
    cleanupCode: null
  });
});
