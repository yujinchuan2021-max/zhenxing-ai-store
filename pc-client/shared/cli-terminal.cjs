"use strict";

const path = require("node:path");

const COMMAND_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/i;

function canonicalLocalPath(value, exists, realpath) {
  if (
    typeof value !== "string" ||
    !/^[a-z]:\\/i.test(value) ||
    typeof exists !== "function" ||
    !exists(value)
  ) {
    return "";
  }
  try {
    const resolved =
      typeof realpath === "function" ? realpath(value) : value;
    return typeof resolved === "string" && /^[a-z]:\\/i.test(resolved)
      ? path.win32.normalize(resolved)
      : "";
  } catch {
    return "";
  }
}

function pathIsInside(candidate, root) {
  const relative = path.win32.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.win32.isAbsolute(relative))
  );
}

function createManagedCliTerminalAction({
  productId,
  plan,
  status,
  commandExecutable,
  exists,
  realpath
}) {
  if (
    typeof productId !== "string" ||
    !productId ||
    !plan ||
    !COMMAND_NAME.test(String(plan.commandName || "")) ||
    !status?.installed ||
    !status?.managed
  ) {
    return null;
  }
  const prefix = canonicalLocalPath(status.directory, exists, realpath);
  const command = canonicalLocalPath(commandExecutable, exists, realpath);
  if (!prefix || !command || path.win32.basename(command).toLowerCase() !== "cmd.exe") {
    return null;
  }
  const expectedLauncher = path.win32.join(
    prefix,
    `${plan.commandName}.cmd`
  );
  const launcher = canonicalLocalPath(expectedLauncher, exists, realpath);
  if (
    !launcher ||
    launcher.toLowerCase() !== expectedLauncher.toLowerCase() ||
    !pathIsInside(launcher, prefix)
  ) {
    return null;
  }
  return {
    executable: command,
    args: ["/d", "/k", "call", launcher],
    options: {
      cwd: prefix,
      detached: true,
      shell: false,
      stdio: "ignore",
      windowsHide: false
    }
  };
}

module.exports = {
  createManagedCliTerminalAction
};
