"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const electron = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const runner = path.join(__dirname, "fixtures", "managed-download-queue-preview-runner.cjs");
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-managed-download-queue-"));
const targetFiles = new Set([
  "Missing-Setup.exe",
  "Queue-Long-Setup.exe",
  "Queue-Second-Setup.exe",
  "Queue-Third-Setup.exe"
]);

if (process.env.AIHUB_MANAGED_DOWNLOAD_QUEUE_FORCE_TARGET_RESIDUE === "formal") {
  fs.writeFileSync(path.join(userData, "Queue-Third-Setup.exe"), "fixture");
} else if (process.env.AIHUB_MANAGED_DOWNLOAD_QUEUE_FORCE_TARGET_RESIDUE === "part") {
  fs.writeFileSync(path.join(userData, "Queue-Third-Setup.exe.part"), "fixture");
}

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

const child = spawn(electron, [runner], {
  cwd: root,
  env: {
    ...process.env,
    AIHUB_MANAGED_DOWNLOAD_QUEUE_FIXTURE_MODE: "enabled",
    AIHUB_MANAGED_DOWNLOAD_QUEUE_USER_DATA: userData
  },
  stdio: process.env.AIHUB_MANAGED_DOWNLOAD_QUEUE_NO_OUTPUT === "1" ? ["ignore", "ignore", "inherit"] : "inherit",
  windowsHide: true
});
child.once("error", fail);
child.once("exit", (code, signal) => {
  try {
    if (code !== 0 || signal) throw new Error(`managed download queue layout failed: ${code || signal}`);
    const files = walkFiles(userData);
    const partCount = files.filter((file) => file.endsWith(".part")).length;
    const formalCount = files.filter((file) => targetFiles.has(path.basename(file))).length;
    if (partCount !== 0 || formalCount !== 0) {
      throw new Error(`managed download queue residue: part=${partCount} formal=${formalCount}`);
    }
  } catch (error) { return fail(error); }
  fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
function fail(error) {
  try { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  console.error(error.stack || error);
  process.exitCode = 1;
}
