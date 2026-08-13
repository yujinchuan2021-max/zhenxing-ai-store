const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const electron = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const runner = path.join(
  __dirname,
  "fixtures",
  "installed-management-preview-runner.cjs"
);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-installed-layout-"));

const child = spawn(electron, [runner], {
  cwd: root,
  env: {
    ...process.env,
    AIHUB_INSTALLED_LAYOUT_USER_DATA: userData,
    AIHUB_MANAGED_DOWNLOAD_QUEUE_FIXTURE_MODE: "installed",
    AIHUB_INSTALLED_QUEUE_ONLY: "1"
  },
  stdio: "inherit",
  windowsHide: true
});

child.once("error", (error) => {
  process.exitCode = 1;
  console.error(error.stack || error);
});

child.once("exit", (code, signal) => {
  try {
    fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    process.exitCode = 1;
    console.error(error.stack || error);
  }
  if (code !== 0 || signal) process.exitCode = 1;
});
