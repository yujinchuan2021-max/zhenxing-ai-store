const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-startup-preview-"));
const child = spawn(path.join(root, "node_modules", "electron", "dist", "electron.exe"), [path.join(__dirname, "fixtures", "startup-catalog-preview-runner.cjs")], {
  cwd: root,
  env: { ...process.env, AIHUB_STARTUP_PREVIEW_USER_DATA: userData, AIHUB_STARTUP_CATALOG_DELAY_MS: "400" },
  stdio: "inherit",
  windowsHide: true
});
child.once("exit", (code, signal) => {
  fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  if (code !== 0 || signal) process.exitCode = 1;
});
