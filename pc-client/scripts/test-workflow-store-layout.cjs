"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const electron = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const runner = path.join(__dirname, "fixtures", "workflow-store-preview-runner.cjs");
const modes = ["disabled-auth", "enabled", "refresh-busy", "busy", "conflict", "rate", "unavailable", "leak"];

async function run(mode) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-"));
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(electron, [runner], { cwd: root, env: { ...process.env, AIHUB_WORKFLOW_FIXTURE_MODE: mode, AIHUB_WORKFLOW_USER_DATA: userData }, stdio: "inherit", windowsHide: true });
      child.once("error", reject);
      child.once("exit", (code, signal) => code === 0 && !signal ? resolve() : reject(new Error(`${mode} failed`)));
    });
  } finally { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}

(async () => { for (const mode of modes) await run(mode); })().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
