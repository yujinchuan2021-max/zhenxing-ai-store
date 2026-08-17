"use strict";

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const TOOLCHAIN_KEYS = [
  "schemaVersion",
  "name",
  "version",
  "releaseUrl",
  "installerUrl",
  "licenseUrl",
  "installerSha256",
  "compilerSha256",
  "expectedSignerSubject",
  "defaultCompilerPath",
];
const PINNED = Object.freeze({
  schemaVersion: 1,
  name: "Inno Setup",
  version: "7.1.0",
  releaseUrl: "https://github.com/jrsoftware/issrc/releases/tag/is-7_1_0",
  installerUrl: "https://files.jrsoftware.org/is/7/innosetup-7.1.0-x64.exe",
  licenseUrl: "https://github.com/jrsoftware/issrc/blob/main/license.txt",
  installerSha256: "0362a383ed217d4c4239b5933866dd96d3eb2102737da92f80f6057a4b40df2f",
  compilerSha256: "d06ebd38f38e3cee60a3c50cc45bd449d77e0bc6a5cabc607ea9886808e4de1a",
  expectedSignerSubject: "CN=Pyrsys B.V., O=Pyrsys B.V., S=Noord-Holland, C=NL",
  defaultCompilerPath: "%LOCALAPPDATA%\\ZhenXingAI\\toolchains\\inno-7.1.0\\ISCC.exe",
});
const SEMVER = /^(?:0|[1-9]\d*)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SAFE_OUTPUT_NAME = /^[0-9A-Za-z][0-9A-Za-z._-]{0,180}$/;

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assertToolchainManifest(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).length !== TOOLCHAIN_KEYS.length ||
    !TOOLCHAIN_KEYS.every((key) => Object.hasOwn(value, key)) ||
    TOOLCHAIN_KEYS.some((key) => value[key] !== PINNED[key])
  ) {
    throw new Error("Inno toolchain manifest is invalid or no longer pinned");
  }
  return value;
}

function requireAbsoluteDirectory(value, label) {
  if (typeof value !== "string" || !path.isAbsolute(value) || /[\r\n\0]/.test(value)) {
    throw new Error(`${label} must be an absolute directory`);
  }
  return value;
}

function buildCompilerArguments({
  scriptPath,
  appVersion,
  sourceDir,
  outputDir,
  outputBaseFilename,
}) {
  if (typeof scriptPath !== "string" || !path.isAbsolute(scriptPath) || !/\.iss$/i.test(scriptPath)) {
    throw new Error("Inno script path must be an absolute .iss file");
  }
  if (!SEMVER.test(appVersion || "")) {
    throw new Error("Inno app version must be semantic");
  }
  requireAbsoluteDirectory(sourceDir, "Inno source directory");
  requireAbsoluteDirectory(outputDir, "Inno output directory");
  if (!SAFE_OUTPUT_NAME.test(outputBaseFilename || "")) {
    throw new Error("Inno output filename is invalid");
  }
  return [
    "/Qp",
    `/DAppVersion=${appVersion}`,
    `/DSourceDir=${sourceDir}`,
    `/DOutputDir=${outputDir}`,
    `/DOutputBaseFilename=${outputBaseFilename}`,
    scriptPath,
  ];
}

function resolveCompiler({ root, env = process.env } = {}) {
  if (typeof root !== "string" || !path.isAbsolute(root)) {
    throw new Error("Inno repository root must be absolute");
  }
  const manifestPath = path.join(root, "build", "inno", "toolchain.json");
  const manifest = assertToolchainManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  const localAppData = env.LOCALAPPDATA;
  const compilerPath = env.AIHUB_ISCC_PATH || (
    typeof localAppData === "string" && path.win32.isAbsolute(localAppData)
      ? path.win32.join(localAppData, manifest.defaultCompilerPath.replace(/^%LOCALAPPDATA%\\/i, ""))
      : ""
  );
  if (!path.isAbsolute(compilerPath) || !fs.existsSync(compilerPath) || !fs.statSync(compilerPath).isFile()) {
    throw new Error("Pinned Inno compiler is unavailable");
  }
  if (sha256File(compilerPath) !== manifest.compilerSha256) {
    throw new Error("Pinned Inno compiler SHA-256 does not match");
  }
  return { compilerPath, manifest };
}

function compileInnoSetup({
  root,
  appVersion,
  sourceDir,
  outputDir,
  outputBaseFilename,
  env = process.env,
  spawn = spawnSync,
}) {
  const scriptPath = path.join(root, "build", "inno", "installer.iss");
  if (!fs.existsSync(scriptPath) || !fs.statSync(scriptPath).isFile()) {
    throw new Error("Pinned Inno installer script is unavailable");
  }
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error("Inno source directory is unavailable");
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${outputBaseFilename}.exe`);
  if (fs.existsSync(outputPath)) {
    throw new Error("Inno output already exists");
  }
  const { compilerPath } = resolveCompiler({ root, env });
  const args = buildCompilerArguments({
    scriptPath,
    appVersion,
    sourceDir,
    outputDir,
    outputBaseFilename,
  });
  const result = spawn(compilerPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Inno compiler exited with ${result.status}`);
  if (!fs.existsSync(outputPath) || !fs.statSync(outputPath).isFile()) {
    throw new Error("Inno compiler did not create the exact Setup artifact");
  }
  return outputPath;
}

module.exports = {
  assertToolchainManifest,
  buildCompilerArguments,
  compileInnoSetup,
  resolveCompiler,
};
