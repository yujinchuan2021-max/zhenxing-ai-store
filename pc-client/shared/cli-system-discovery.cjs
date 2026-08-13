"use strict";

const path = require("node:path");

const COMMAND_NAME = /^[a-z0-9][a-z0-9._-]{0,79}$/i;

function inferNpmPrefixFromCommandPath(commandPath, commandName) {
  if (
    typeof commandPath !== "string" ||
    typeof commandName !== "string" ||
    !COMMAND_NAME.test(commandName)
  ) {
    return "";
  }
  const normalized = path.win32.normalize(commandPath.trim());
  if (!/^[A-Za-z]:\\/.test(normalized) || normalized.startsWith("\\\\")) {
    return "";
  }
  if (
    path.win32.basename(normalized).toLowerCase() !==
    `${commandName}.cmd`.toLowerCase()
  ) {
    return "";
  }
  const prefix = path.win32.dirname(normalized);
  return prefix.toLowerCase() === path.win32.parse(prefix).root.toLowerCase()
    ? ""
    : prefix;
}

module.exports = { inferNpmPrefixFromCommandPath };
