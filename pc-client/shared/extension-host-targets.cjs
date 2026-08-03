"use strict";

const os = require("node:os");
const path = require("node:path");

function resolveCodexSkillsRoot({
  homedir = os.homedir,
  pathApi = path
} = {}) {
  const home = homedir();
  if (!home || home.includes("\0") || !pathApi.isAbsolute(home)) {
    const error = new Error("User home must be an absolute local path");
    error.code = "EXTENSION_USER_HOME_INVALID";
    throw error;
  }
  return pathApi.join(pathApi.resolve(home), ".agents", "skills");
}

function resolveLegacyCodexSkillsRoot({
  env = process.env,
  homedir = os.homedir,
  pathApi = path
} = {}) {
  const configured =
    typeof env?.CODEX_HOME === "string" ? env.CODEX_HOME.trim() : "";
  const codexHome = configured || pathApi.join(homedir(), ".codex");
  if (
    !codexHome ||
    codexHome.includes("\0") ||
    !pathApi.isAbsolute(codexHome)
  ) {
    const error = new Error("CODEX_HOME must be an absolute local path");
    error.code = "EXTENSION_CODEX_HOME_INVALID";
    throw error;
  }
  return pathApi.join(pathApi.resolve(codexHome), "skills");
}

function resolveCodexConfigPath({
  env = process.env,
  homedir = os.homedir,
  pathApi = path
} = {}) {
  const configured =
    typeof env?.CODEX_HOME === "string" ? env.CODEX_HOME.trim() : "";
  const codexHome = configured || pathApi.join(homedir(), ".codex");
  if (
    !codexHome ||
    codexHome.includes("\0") ||
    !pathApi.isAbsolute(codexHome)
  ) {
    const error = new Error("CODEX_HOME must be an absolute local path");
    error.code = "EXTENSION_CODEX_HOME_INVALID";
    throw error;
  }
  return pathApi.join(pathApi.resolve(codexHome), "config.toml");
}

module.exports = {
  resolveCodexConfigPath,
  resolveCodexSkillsRoot,
  resolveLegacyCodexSkillsRoot
};
