"use strict";

const path = require("node:path");

function windowsPowerShellEnvironment(environment = process.env) {
  return Object.fromEntries(
    Object.entries(environment || {}).filter(
      ([name]) => !/^PSModulePath$/i.test(name)
    )
  );
}

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
  windowsPowerShellEnvironment,
  windowsPowerShellPath
};
