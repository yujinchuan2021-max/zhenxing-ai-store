"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MANAGEMENT_ID = /^[a-f0-9]{48}$/;
const PRODUCT_CODE = /^\{[A-F0-9-]{36}\}$/;

function localWindowsPath(value, { allowRoot = false } = {}) {
  if (typeof value !== "string" || !value.trim()) return "";
  const normalized = path.win32.normalize(value.trim());
  if (!/^[A-Za-z]:\\/.test(normalized) || normalized.startsWith("\\\\")) return "";
  if (!allowRoot && normalized.toLowerCase() === path.win32.parse(normalized).root.toLowerCase()) return "";
  return normalized;
}

function validPlan(productId, plan) {
  if (!PRODUCT_ID.test(String(productId || "")) || plan?.driver !== "managed-msi" ||
    !VERSION.test(String(plan.version || "")) || plan.architecture !== "x64" ||
    !PRODUCT_CODE.test(String(plan.productCode || "")) || plan.installDirectory !== "%LOCALAPPDATA%\\Kiro-Cli" ||
    plan.executableFile !== "kiro-cli.exe" || !SHA256.test(String(plan.artifact?.sha256 || "")) ||
    !Number.isSafeInteger(plan.artifact?.maximumBytes) || plan.artifact.maximumBytes < 1024 || plan.artifact.maximumBytes > 512 * 1024 * 1024 ||
    plan.artifact.fileName !== "kiro-cli-2.16.0-x64.msi" || plan.artifact.expectedSigner !== "Amazon Web Services, Inc." ||
    !Array.isArray(plan.postInstallArgs) || plan.postInstallArgs.join("\0") !== "settings\0app.disableAutoupdates\0true") return false;
  try {
    const url = new URL(plan.artifact.url);
    return url.protocol === "https:" && url.hostname === "prod.download.cli.kiro.dev" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function createManagedMsiCliLayout({ productId, plan, localAppData }) {
  const root = localWindowsPath(localAppData);
  if (!root || !validPlan(productId, plan)) return null;
  const directory = path.win32.join(root, "Kiro-Cli");
  return { productId, directory, executable: path.win32.join(directory, plan.executableFile), version: plan.version, productCode: plan.productCode, artifact: { ...plan.artifact } };
}

function inspectManagedMsiCli({ productId, plan, receipt, localAppData, fileSystem = fs, hashFile }) {
  const layout = createManagedMsiCliLayout({ productId, plan, localAppData });
  const base = { installed: false, version: "", directory: layout?.directory || "", executable: "", detection: layout ? "absent" : "unknown", managed: false, canUninstall: false, ownership: layout ? "none" : "unknown" };
  if (!layout) return base;
  if (!receipt) return fileSystem.existsSync(layout.executable) ? { ...base, detection: "unknown", ownership: "untracked" } : base;
  if (receipt.driver !== "managed-msi" || receipt.productId !== productId || receipt.version !== plan.version || receipt.productCode !== plan.productCode ||
    localWindowsPath(receipt.directory) !== layout.directory || localWindowsPath(receipt.executable) !== layout.executable || !SHA256.test(String(receipt.executableSha256 || "")) ||
    !MANAGEMENT_ID.test(String(receipt.managementId || "")) || !Number.isFinite(Date.parse(receipt.installedAt))) return { ...base, detection: "unknown", ownership: "mismatch" };
  try {
    const canonicalDirectory = localWindowsPath(fileSystem.realpathSync.native(layout.directory));
    const canonicalExecutable = localWindowsPath(fileSystem.realpathSync.native(layout.executable));
    const stat = fileSystem.lstatSync(layout.executable);
    if (canonicalDirectory.toLowerCase() !== layout.directory.toLowerCase() || canonicalExecutable.toLowerCase() !== layout.executable.toLowerCase() || !stat.isFile() || stat.isSymbolicLink() ||
      (typeof hashFile === "function" && hashFile(layout.executable) !== receipt.executableSha256)) return { ...base, detection: "unknown", ownership: "mismatch" };
    return { installed: true, version: plan.version, directory: layout.directory, executable: layout.executable, detection: "installed", managed: true, canUninstall: true, ownership: "managed" };
  } catch (error) {
    return error?.code === "ENOENT" ? base : { ...base, detection: "unknown", ownership: "unknown" };
  }
}

function createManagedMsiCliReceipt({ productId, plan, localAppData, fileSystem = fs, hashFile, now = () => new Date().toISOString(), randomBytes = crypto.randomBytes }) {
  const layout = createManagedMsiCliLayout({ productId, plan, localAppData });
  if (!layout || typeof hashFile !== "function") return null;
  try {
    const executableSha256 = hashFile(layout.executable);
    const managementId = randomBytes(24).toString("hex");
    const installedAt = now();
    const canonicalExecutable = localWindowsPath(fileSystem.realpathSync.native(layout.executable));
    if (!SHA256.test(executableSha256) || !MANAGEMENT_ID.test(managementId) || !Number.isFinite(Date.parse(installedAt)) || canonicalExecutable.toLowerCase() !== layout.executable.toLowerCase() || !fileSystem.lstatSync(layout.executable).isFile()) return null;
    return { driver: "managed-msi", productId, version: plan.version, productCode: plan.productCode, directory: layout.directory, executable: layout.executable, executableSha256, managementId, installedAt };
  } catch {
    return null;
  }
}

function createManagedMsiTerminalAction({ plan, status, commandExecutable, fileSystem = fs }) {
  if (!status?.installed || !status.managed) return null;
  try {
    const command = localWindowsPath(fileSystem.realpathSync.native(commandExecutable));
    const executable = localWindowsPath(fileSystem.realpathSync.native(status.executable));
    if (path.win32.basename(command).toLowerCase() !== "cmd.exe" || executable.toLowerCase() !== status.executable.toLowerCase()) return null;
    return { executable: command, args: ["/d", "/k", "call", executable], options: { cwd: status.directory, detached: true, shell: false, stdio: "ignore", windowsHide: false } };
  } catch {
    return null;
  }
}

function createManagedMsiUninstallAction({ productId, plan, receipt, localAppData, msiexecExecutable, fileSystem = fs, hashFile }) {
  const status = inspectManagedMsiCli({ productId, plan, receipt, localAppData, fileSystem, hashFile });
  const msiexec = localWindowsPath(msiexecExecutable);
  if (!status.canUninstall || !msiexec || path.win32.basename(msiexec).toLowerCase() !== "msiexec.exe") return null;
  return { executable: msiexec, args: ["/x", plan.productCode, "/quiet", "/norestart"], options: { windowsHide: true, shell: false }, managementId: receipt.managementId, directory: status.directory, productExecutable: status.executable };
}

module.exports = { createManagedMsiCliLayout, createManagedMsiCliReceipt, createManagedMsiTerminalAction, createManagedMsiUninstallAction, inspectManagedMsiCli, validPlan };
