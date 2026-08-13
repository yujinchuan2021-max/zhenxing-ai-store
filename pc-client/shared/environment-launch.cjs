"use strict";

const path = require("node:path");

function localExecutable(value, expectedName = "") {
  if (typeof value !== "string" || !path.win32.isAbsolute(value) || value.startsWith("\\\\")) return "";
  const normalized = path.win32.normalize(value);
  return !expectedName || path.win32.basename(normalized).toLowerCase() === expectedName.toLowerCase()
    ? normalized
    : "";
}

function createEnvironmentOpenAction({ plan, status, commandExecutable }) {
  const executable = localExecutable(status?.executable);
  if (!status?.installed || !status?.canOpen || !executable) return null;
  if (plan?.openMode === "application") {
    return { type: "shell-open", executable };
  }
  if (plan?.openMode !== "terminal") return null;
  const command = localExecutable(commandExecutable, "cmd.exe");
  if (!command) return null;
  return {
    type: "process",
    executable: command,
    args: ["/d", "/k", executable],
    options: {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      shell: false
    }
  };
}

module.exports = { createEnvironmentOpenAction };
