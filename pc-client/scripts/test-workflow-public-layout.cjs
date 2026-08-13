"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const electron = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const runner = path.join(__dirname, "fixtures", "workflow-public-preview-runner.cjs");
const modes = (process.env.AIHUB_WORKFLOW_PUBLIC_LAYOUT_MODES || "disabled,empty,unavailable,named,missing,unsafe-omitted,guarded,detail-unavailable,leak,composer,fixed-cli,fixed-cli-busy,fixed-cli-busy-update,fixed-cli-busy-uninstall,fixed-cli-error,fixed-cli-unavailable").split(",");

async function run(mode) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-public-"));
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(electron, [runner], {
        cwd: root,
        env: {
          ...process.env,
          AIHUB_WORKFLOW_PUBLIC_FIXTURE_MODE: mode,
          AIHUB_AGENT_BRIDGE_FIXTURE_MODE: mode === "composer" ? "enabled" : "disabled",
          AIHUB_FIXED_CLI_LIFECYCLE_FIXTURE_MODE: mode === "fixed-cli" ? "enabled" : mode === "fixed-cli-busy" ? "busy" : mode === "fixed-cli-busy-update" ? "busy-update" : mode === "fixed-cli-busy-uninstall" ? "busy-uninstall" : mode === "fixed-cli-error" ? "error" : mode === "fixed-cli-unavailable" ? "unavailable" : "disabled",
          AIHUB_WORKFLOW_PUBLIC_USER_DATA: userData
        },
        stdio: "inherit",
        windowsHide: true
      });
      child.once("error", reject);
      child.once("exit", (code, signal) => code === 0 && !signal ? resolve() : reject(new Error(`${mode} failed`)));
    });
  } finally { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
}

(async () => { for (const mode of modes) await run(mode); })().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
