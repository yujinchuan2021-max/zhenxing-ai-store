"use strict";

const path = require("node:path");

function windowsPowerShellPath(systemRoot = process.env.SystemRoot || "C:\\Windows") {
  return path.win32.join(
    systemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe"
  );
}

module.exports = {
  windowsPowerShellPath
};
