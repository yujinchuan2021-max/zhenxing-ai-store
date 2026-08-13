"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const DISTRIBUTION = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/;
const COMMAND = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const MANAGEMENT_ID = /^[a-f0-9]{48}$/;
const MARKER_NAME = ".aihub-managed.json";
const MANAGED_ROOT = ".aihub-python";
const LOCK_NAME = ".aihub-requirements.lock";

function localWindowsPath(value, { allowRoot = false } = {}) {
  if (typeof value !== "string" || !value.trim()) return "";
  const normalized = path.win32.normalize(value.trim());
  if (!/^[A-Za-z]:\\/.test(normalized) || normalized.startsWith("\\\\")) return "";
  if (!allowRoot && normalized.toLowerCase() === path.win32.parse(normalized).root.toLowerCase()) return "";
  return normalized;
}

function pathIsInside(candidate, parent) {
  const relative = path.win32.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.win32.isAbsolute(relative));
}

function validPlan(productId, plan) {
  if (
    !PRODUCT_ID.test(String(productId || "")) ||
    plan?.driver !== "python-venv" ||
    !DISTRIBUTION.test(String(plan.distributionName || "")) ||
    !VERSION.test(String(plan.version || "")) ||
    !COMMAND.test(String(plan.commandName || "")) ||
    !Number.isInteger(plan.minimumPythonMinor) ||
    plan.minimumPythonMinor < 8 ||
    plan.minimumPythonMinor > 99 ||
    (plan.maximumPythonMinor !== undefined &&
      (!Number.isInteger(plan.maximumPythonMinor) ||
        plan.maximumPythonMinor < plan.minimumPythonMinor ||
        plan.maximumPythonMinor > 99)) ||
    (plan.pythonEnvironmentId !== undefined &&
      !["python", "python312"].includes(plan.pythonEnvironmentId)) ||
    (plan.pythonEnvironmentId === "python312" &&
      (plan.minimumPythonMinor !== 12 || plan.maximumPythonMinor !== 12)) ||
    plan.architecture !== "x64" ||
    !SHA256.test(String(plan.wheel?.sha256 || "")) ||
    !Array.isArray(plan.lockedRequirements) ||
    plan.lockedRequirements.length < 1 ||
    plan.lockedRequirements.length > 160
  ) return false;
  try {
    const url = new URL(plan.wheel.url);
    if (!(url.protocol === "https:" && url.hostname === "files.pythonhosted.org" &&
      !url.username && !url.password && !url.search && !url.hash && url.pathname.endsWith(".whl"))) return false;
    const locksAreValid = plan.lockedRequirements.every((entry) => {
      if (!DISTRIBUTION.test(String(entry?.name || "")) || !VERSION.test(String(entry?.version || "")) || !SHA256.test(String(entry?.sha256 || ""))) return false;
      try {
        const artifact = new URL(entry.url);
        return artifact.protocol === "https:" && artifact.hostname === "files.pythonhosted.org" &&
          !artifact.username && !artifact.password && !artifact.search && !artifact.hash && artifact.pathname.endsWith(".whl");
      } catch {
        return false;
      }
    });
    const root = plan.lockedRequirements.find((entry) => entry.name.toLowerCase().replace(/[-_.]+/g, "-") === plan.distributionName.toLowerCase().replace(/[-_.]+/g, "-"));
    return locksAreValid && root?.version === plan.version && root?.url === plan.wheel.url && root?.sha256 === plan.wheel.sha256;
  } catch {
    return false;
  }
}

function createManagedPythonLayout({ productId, plan, prefix }) {
  const normalizedPrefix = localWindowsPath(prefix);
  if (!normalizedPrefix || !validPlan(productId, plan)) return null;
  const productRoot = path.win32.join(normalizedPrefix, MANAGED_ROOT, productId);
  const directory = path.win32.join(productRoot, plan.version);
  return {
    productId,
    prefix: normalizedPrefix,
    productRoot,
    directory,
    pythonExecutable: path.win32.join(directory, "Scripts", "python.exe"),
    commandExecutable: path.win32.join(directory, "Scripts", `${plan.commandName}.exe`),
    requirementsLock: path.win32.join(directory, LOCK_NAME),
    marker: path.win32.join(directory, MARKER_NAME),
    version: plan.version
  };
}

function absentStatus(directory = "") {
  return { installed: false, version: "", directory, executable: "", detection: "absent", managed: false, canUninstall: false, ownership: "none" };
}

function unknownStatus(directory = "", ownership = "unknown") {
  return { installed: false, version: "", directory, executable: "", detection: "unknown", managed: false, canUninstall: false, ownership };
}

function receiptMatches(receipt, productId, layout, plan) {
  return Boolean(
    receipt && receipt.driver === "python-venv" && receipt.productId === productId &&
    receipt.version === plan.version && receipt.distributionName === plan.distributionName &&
    localWindowsPath(receipt.prefix) === layout.prefix &&
    localWindowsPath(receipt.directory) === layout.directory &&
    localWindowsPath(receipt.pythonExecutable) === layout.pythonExecutable &&
    localWindowsPath(receipt.executable) === layout.commandExecutable &&
    SHA256.test(String(receipt.commandSha256 || "")) && SHA256.test(String(receipt.lockSha256 || "")) &&
    MANAGEMENT_ID.test(String(receipt.managementId || "")) &&
    typeof receipt.installedAt === "string" && Number.isFinite(Date.parse(receipt.installedAt))
  );
}

function inspectManagedPythonCli({ productId, plan, receipt, configuredPrefix = "", fileSystem = fs, hashFile }) {
  const layout = createManagedPythonLayout({ productId, plan, prefix: receipt?.prefix || configuredPrefix });
  if (!layout) return unknownStatus();
  if (!receipt) {
    return fileSystem.existsSync(layout.directory)
      ? unknownStatus(layout.directory, "untracked")
      : absentStatus(layout.directory);
  }
  if (!receiptMatches(receipt, productId, layout, plan)) return unknownStatus(layout.directory, "mismatch");
  try {
    const canonicalPrefix = localWindowsPath(fileSystem.realpathSync.native(layout.prefix));
    const canonicalDirectory = localWindowsPath(fileSystem.realpathSync.native(layout.directory));
    const canonicalPython = localWindowsPath(fileSystem.realpathSync.native(layout.pythonExecutable));
    const canonicalCommand = localWindowsPath(fileSystem.realpathSync.native(layout.commandExecutable));
    const marker = JSON.parse(fileSystem.readFileSync(layout.marker, "utf8"));
    if (
      canonicalPrefix.toLowerCase() !== layout.prefix.toLowerCase() ||
      canonicalDirectory.toLowerCase() !== layout.directory.toLowerCase() ||
      canonicalPython.toLowerCase() !== layout.pythonExecutable.toLowerCase() ||
      canonicalCommand.toLowerCase() !== layout.commandExecutable.toLowerCase() ||
      !pathIsInside(canonicalDirectory, canonicalPrefix) ||
      !pathIsInside(canonicalPython, canonicalDirectory) ||
      !pathIsInside(canonicalCommand, canonicalDirectory) ||
      !fileSystem.lstatSync(layout.pythonExecutable).isFile() ||
      !fileSystem.lstatSync(layout.commandExecutable).isFile() ||
      marker?.driver !== "python-venv" || marker?.productId !== productId ||
      marker?.version !== plan.version || marker?.distributionName !== plan.distributionName ||
      marker?.managementId !== receipt.managementId || marker?.commandSha256 !== receipt.commandSha256 ||
      marker?.lockSha256 !== receipt.lockSha256 ||
      (typeof hashFile === "function" &&
        (hashFile(layout.commandExecutable) !== receipt.commandSha256 || hashFile(layout.requirementsLock) !== receipt.lockSha256))
    ) return unknownStatus(layout.directory, "mismatch");
    return { installed: true, version: plan.version, directory: layout.directory, executable: layout.commandExecutable, detection: "installed", managed: true, canUninstall: true, ownership: "managed" };
  } catch (error) {
    return error?.code === "ENOENT" ? absentStatus(layout.directory) : unknownStatus(layout.directory);
  }
}

function createPythonVenvAction({ productId, plan, prefix, pythonExecutable, pythonMinor }) {
  const layout = createManagedPythonLayout({ productId, plan, prefix });
  const python = localWindowsPath(pythonExecutable);
  if (!layout || !python || !Number.isInteger(pythonMinor) || pythonMinor < plan.minimumPythonMinor ||
    (plan.maximumPythonMinor !== undefined && pythonMinor > plan.maximumPythonMinor)) return null;
  return { executable: python, args: ["-I", "-m", "venv", layout.directory], options: { cwd: layout.productRoot, windowsHide: true, shell: false }, layout };
}

function createPythonPipInstallAction({ productId, plan, prefix }) {
  const layout = createManagedPythonLayout({ productId, plan, prefix });
  if (!layout) return null;
  const requirementsText = `${plan.lockedRequirements
    .map((entry) => `${entry.name} @ ${entry.url} --hash=sha256:${entry.sha256}`)
    .join("\n")}\n`;
  return {
    executable: layout.pythonExecutable,
    args: ["-I", "-m", "pip", "install", "--isolated", "--disable-pip-version-check", "--no-input", "--no-cache-dir", "--only-binary=:all:", "--no-compile", "--require-hashes", "--no-deps", "--no-index", "--requirement", layout.requirementsLock],
    options: { cwd: layout.directory, windowsHide: true, shell: false },
    layout,
    requirementsText
  };
}

function createManagedPythonReceipt({ productId, plan, prefix, fileSystem = fs, hashFile, now = () => new Date().toISOString(), randomBytes = crypto.randomBytes }) {
  const layout = createManagedPythonLayout({ productId, plan, prefix });
  if (!layout || typeof hashFile !== "function") return null;
  try {
    const installedAt = now();
    const managementId = randomBytes(24).toString("hex");
    const commandSha256 = hashFile(layout.commandExecutable);
    const lockSha256 = hashFile(layout.requirementsLock);
    const canonicalDirectory = localWindowsPath(fileSystem.realpathSync.native(layout.directory));
    const canonicalCommand = localWindowsPath(fileSystem.realpathSync.native(layout.commandExecutable));
    if (!Number.isFinite(Date.parse(installedAt)) || !MANAGEMENT_ID.test(managementId) || !SHA256.test(commandSha256) || !SHA256.test(lockSha256) ||
      canonicalDirectory.toLowerCase() !== layout.directory.toLowerCase() ||
      canonicalCommand.toLowerCase() !== layout.commandExecutable.toLowerCase() ||
      !fileSystem.lstatSync(layout.commandExecutable).isFile()) return null;
    const receipt = { driver: "python-venv", productId, distributionName: plan.distributionName, version: plan.version, prefix: layout.prefix, directory: layout.directory, pythonExecutable: layout.pythonExecutable, executable: layout.commandExecutable, commandSha256, lockSha256, managementId, installedAt };
    fileSystem.writeFileSync(layout.marker, JSON.stringify({ driver: receipt.driver, productId, distributionName: plan.distributionName, version: plan.version, commandSha256, lockSha256, managementId }, null, 2), { encoding: "utf8", flag: "wx" });
    return receipt;
  } catch {
    return null;
  }
}

function createManagedPythonTerminalAction({ plan, status, commandExecutable, fileSystem = fs }) {
  if (!status?.installed || !status.managed || !status.executable) return null;
  try {
    const command = localWindowsPath(fileSystem.realpathSync.native(commandExecutable));
    const executable = localWindowsPath(fileSystem.realpathSync.native(status.executable));
    if (path.win32.basename(command).toLowerCase() !== "cmd.exe" || executable.toLowerCase() !== status.executable.toLowerCase() || !pathIsInside(executable, status.directory)) return null;
    return { executable: command, args: ["/d", "/k", "call", executable, ...(plan.launchArgs || [])], environment: { ...(plan.managedEnvironment || {}) }, options: { cwd: status.directory, detached: true, shell: false, stdio: "ignore", windowsHide: false } };
  } catch {
    return null;
  }
}

function createManagedPythonUninstallAction(options) {
  const status = inspectManagedPythonCli({ ...options, hashFile: options.hashFile });
  if (!status.canUninstall) return null;
  const layout = createManagedPythonLayout({ productId: options.productId, plan: options.plan, prefix: options.receipt?.prefix });
  if (!layout) return null;
  return { productId: options.productId, version: layout.version, managementId: options.receipt.managementId, directory: layout.directory, productRoot: layout.productRoot };
}

module.exports = { createManagedPythonLayout, createManagedPythonReceipt, createManagedPythonTerminalAction, createManagedPythonUninstallAction, createPythonPipInstallAction, createPythonVenvAction, inspectManagedPythonCli };
