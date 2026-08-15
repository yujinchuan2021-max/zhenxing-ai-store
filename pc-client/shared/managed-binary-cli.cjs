"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/;
const COMMAND = /^[a-z0-9][a-z0-9-]{0,31}$/i;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.exe$/i;
const ARCHIVE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?:\.zip|\.tar\.gz)$/i;
const SAFE_ARGUMENT = /^(?:--?[A-Za-z0-9][A-Za-z0-9-]*|[A-Za-z0-9][A-Za-z0-9._+@/:=-]{0,191})$/;
const INTEGRITY_PATTERNS = Object.freeze({
  sha256: /^[a-f0-9]{64}$/,
  sha512: /^[a-f0-9]{128}$/
});
const MANAGEMENT_ID = /^[a-f0-9]{48}$/;
const MARKER_NAME = ".aihub-managed.json";
const MANAGED_ROOT = ".aihub-bin";
const SUPPORTED_ARCHITECTURES = new Set(["x64", "arm64"]);

function localWindowsPath(value, { allowRoot = false } = {}) {
  if (typeof value !== "string" || !value.trim()) return "";
  const normalized = path.win32.normalize(value.trim());
  if (!/^[A-Za-z]:\\/.test(normalized) || normalized.startsWith("\\\\")) {
    return "";
  }
  if (
    !allowRoot &&
    normalized.toLowerCase() === path.win32.parse(normalized).root.toLowerCase()
  ) {
    return "";
  }
  return normalized;
}

function pathIsInside(candidate, parent) {
  const relative = path.win32.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.win32.isAbsolute(relative))
  );
}

function executableRelativePath(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const normalized = path.win32.normalize(value.trim());
  const segments = normalized.split("\\");
  return !path.win32.isAbsolute(normalized) &&
    segments.length <= 12 &&
    segments.every((segment) => segment && segment !== "." && segment !== ".." && !/[:*?"<>|]/.test(segment)) &&
    FILE_NAME.test(segments.at(-1))
    ? normalized
    : "";
}

function integrityForArtifact(artifact) {
  if (!artifact || typeof artifact !== "object") return null;
  const matches = Object.entries(INTEGRITY_PATTERNS).filter(
    ([algorithm, pattern]) => pattern.test(String(artifact[algorithm] || ""))
  );
  return matches.length === 1
    ? { algorithm: matches[0][0], value: artifact[matches[0][0]] }
    : null;
}

function artifactFor(plan, architecture) {
  const artifact = plan?.artifacts?.[architecture];
  const downloadIntegrity = integrityForArtifact(artifact);
  const archived = ARCHIVE_NAME.test(String(artifact?.fileName || ""));
  const archiveKind = archived && artifact?.archiveKind === "directory"
    ? "zip-directory"
    : archived
      ? "zip-single-executable"
      : "standalone-executable";
  const executableFileName = archived
    ? executableRelativePath(
        archiveKind === "zip-directory"
          ? artifact?.executableRelativePath
          : artifact?.archiveEntry
      )
    : String(artifact?.fileName || "");
  const executableIntegrity = archived
    ? { algorithm: "sha256", value: String(artifact?.expectedExecutableSha256 || "") }
    : downloadIntegrity;
  if (
    plan?.driver !== "portable-binary" ||
    !VERSION.test(String(plan.version || "")) ||
    !COMMAND.test(String(plan.commandName || "")) ||
    !SUPPORTED_ARCHITECTURES.has(architecture) ||
    !artifact ||
    (archived && artifact.archiveKind !== undefined && artifact.archiveKind !== "directory") ||
    !(FILE_NAME.test(String(artifact.fileName || "")) || archived) ||
    !executableFileName ||
    (archiveKind !== "zip-directory" && path.win32.basename(executableFileName) !== executableFileName) ||
    !downloadIntegrity ||
    !executableIntegrity ||
    !INTEGRITY_PATTERNS[executableIntegrity.algorithm].test(executableIntegrity.value) ||
    (archived &&
      (!Number.isSafeInteger(artifact.maximumExtractedBytes) ||
        artifact.maximumExtractedBytes < 1024 ||
        artifact.maximumExtractedBytes > 1024 * 1024 * 1024)) ||
    (archiveKind === "zip-directory" &&
      (!Number.isSafeInteger(artifact.maximumArchiveEntries) ||
        artifact.maximumArchiveEntries < 1 ||
        artifact.maximumArchiveEntries > 10_000)) ||
    (!Array.isArray(plan.launchArgs || []) ||
      (plan.launchArgs || []).length > 16 ||
      (plan.launchArgs || []).some((argument) => !SAFE_ARGUMENT.test(String(argument || "")))) ||
    !Number.isSafeInteger(artifact.maximumBytes) ||
    artifact.maximumBytes < 1024 ||
    artifact.maximumBytes > 512 * 1024 * 1024
  ) {
    return null;
  }
  try {
    const url = new URL(artifact.url);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      !Array.isArray(artifact.allowedHosts) ||
      !artifact.allowedHosts.includes(url.hostname.toLowerCase())
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return {
    url: artifact.url,
    fileName: artifact.fileName,
    kind: archiveKind,
    executableFileName,
    downloadIntegrityAlgorithm: downloadIntegrity.algorithm,
    downloadIntegrity: downloadIntegrity.value,
    integrityAlgorithm: executableIntegrity.algorithm,
    integrity: executableIntegrity.value,
    maximumBytes: artifact.maximumBytes,
    ...(archived ? { maximumExtractedBytes: artifact.maximumExtractedBytes } : {}),
    ...(archiveKind === "zip-directory" ? { maximumArchiveEntries: artifact.maximumArchiveEntries } : {}),
    allowedHosts: [...artifact.allowedHosts]
  };
}

function createManagedBinaryLayout({ productId, plan, prefix, architecture }) {
  const normalizedPrefix = localWindowsPath(prefix);
  const artifact = artifactFor(plan, architecture);
  if (!PRODUCT_ID.test(String(productId || "")) || !normalizedPrefix || !artifact) {
    return null;
  }
  const productRoot = path.win32.join(normalizedPrefix, MANAGED_ROOT, productId);
  const directory = path.win32.join(productRoot, plan.version);
  return {
    productId,
    prefix: normalizedPrefix,
    productRoot,
    directory,
    executable: path.win32.join(directory, artifact.executableFileName),
    marker: path.win32.join(directory, MARKER_NAME),
    version: plan.version,
    architecture,
    artifact
  };
}

function absentStatus(directory = "") {
  return {
    installed: false,
    version: "",
    directory,
    executable: "",
    detection: "absent",
    managed: false,
    canUninstall: false,
    ownership: "none"
  };
}

function unknownStatus(directory = "", ownership = "unknown") {
  return {
    installed: false,
    version: "",
    directory,
    executable: "",
    detection: "unknown",
    managed: false,
    canUninstall: false,
    ownership
  };
}

function receiptMatches(receipt, productId, layout) {
  const integrityMatches =
    (receipt?.integrityAlgorithm === layout.artifact.integrityAlgorithm &&
      receipt?.integrity === layout.artifact.integrity) ||
    (layout.artifact.integrityAlgorithm === "sha512" &&
      receipt?.integrityAlgorithm === undefined &&
      receipt?.integrity === undefined &&
      receipt?.sha512 === layout.artifact.integrity);
  return Boolean(
    receipt &&
      typeof receipt === "object" &&
      !Array.isArray(receipt) &&
      receipt.driver === "portable-binary" &&
      receipt.productId === productId &&
      receipt.version === layout.version &&
      receipt.architecture === layout.architecture &&
      localWindowsPath(receipt.prefix) === layout.prefix &&
      localWindowsPath(receipt.directory) === layout.directory &&
      localWindowsPath(receipt.executable) === layout.executable &&
      integrityMatches &&
      MANAGEMENT_ID.test(String(receipt.managementId || "")) &&
      typeof receipt.installedAt === "string" &&
      Number.isFinite(Date.parse(receipt.installedAt))
  );
}

function inspectManagedBinaryCli({
  productId,
  plan,
  receipt,
  configuredPrefix = "",
  architecture,
  verifyIntegrity = false,
  fileSystem = fs,
  hashFile
}) {
  const prefix = receipt?.prefix || configuredPrefix;
  const layout = createManagedBinaryLayout({
    productId,
    plan,
    prefix,
    architecture
  });
  if (!layout) return unknownStatus();
  if (!receipt) {
    return fileSystem.existsSync(layout.executable)
      ? unknownStatus(layout.directory, "untracked")
      : absentStatus(layout.directory);
  }
  if (!receiptMatches(receipt, productId, layout)) {
    return unknownStatus(layout.directory, "mismatch");
  }

  try {
    const canonicalPrefix = localWindowsPath(
      fileSystem.realpathSync.native(layout.prefix)
    );
    const canonicalDirectory = localWindowsPath(
      fileSystem.realpathSync.native(layout.directory)
    );
    const canonicalExecutable = localWindowsPath(
      fileSystem.realpathSync.native(layout.executable)
    );
    const executableStat = fileSystem.lstatSync(layout.executable);
    const markerStat = fileSystem.lstatSync(layout.marker);
    if (
      canonicalPrefix.toLowerCase() !== layout.prefix.toLowerCase() ||
      canonicalDirectory.toLowerCase() !== layout.directory.toLowerCase() ||
      canonicalExecutable.toLowerCase() !== layout.executable.toLowerCase() ||
      !pathIsInside(canonicalDirectory, canonicalPrefix) ||
      !pathIsInside(canonicalExecutable, canonicalDirectory) ||
      !executableStat.isFile() ||
      executableStat.isSymbolicLink() ||
      !markerStat.isFile() ||
      markerStat.isSymbolicLink()
    ) {
      return unknownStatus(layout.directory, "mismatch");
    }
    const marker = JSON.parse(fileSystem.readFileSync(layout.marker, "utf8"));
    if (
      marker?.driver !== "portable-binary" ||
      marker?.productId !== productId ||
      marker?.version !== layout.version ||
      marker?.architecture !== architecture ||
      !(
        (marker?.integrityAlgorithm === layout.artifact.integrityAlgorithm &&
          marker?.integrity === layout.artifact.integrity) ||
        (layout.artifact.integrityAlgorithm === "sha512" &&
          marker?.integrityAlgorithm === undefined &&
          marker?.integrity === undefined &&
          marker?.sha512 === layout.artifact.integrity)
      ) ||
      marker?.managementId !== receipt.managementId
    ) {
      return unknownStatus(layout.directory, "mismatch");
    }
    if (
      verifyIntegrity &&
      (typeof hashFile !== "function" ||
        hashFile(layout.executable, layout.artifact.integrityAlgorithm) !==
          layout.artifact.integrity)
    ) {
      return {
        ...unknownStatus(layout.directory, "mismatch"),
        installed: true,
        executable: layout.executable
      };
    }
    return {
      installed: true,
      version: layout.version,
      directory: layout.directory,
      executable: layout.executable,
      detection: "installed",
      managed: true,
      canUninstall: true,
      ownership: "managed"
    };
  } catch (error) {
    return error?.code === "ENOENT"
      ? absentStatus(layout.directory)
      : unknownStatus(layout.directory);
  }
}

function createManagedBinaryReceipt({
  productId,
  plan,
  prefix,
  architecture,
  fileSystem = fs,
  hashFile,
  now = () => new Date().toISOString(),
  randomBytes = crypto.randomBytes
}) {
  const layout = createManagedBinaryLayout({
    productId,
    plan,
    prefix,
    architecture
  });
  if (!layout || typeof hashFile !== "function") return null;
  const installedAt = now();
  if (!Number.isFinite(Date.parse(installedAt))) return null;
  let managementId;
  try {
    managementId = randomBytes(24).toString("hex");
    const canonicalDirectory = localWindowsPath(
      fileSystem.realpathSync.native(layout.directory)
    );
    const canonicalExecutable = localWindowsPath(
      fileSystem.realpathSync.native(layout.executable)
    );
    const executableStat = fileSystem.lstatSync(layout.executable);
    if (
      !MANAGEMENT_ID.test(managementId) ||
      canonicalDirectory.toLowerCase() !== layout.directory.toLowerCase() ||
      canonicalExecutable.toLowerCase() !== layout.executable.toLowerCase() ||
      !executableStat.isFile() ||
      executableStat.isSymbolicLink() ||
      hashFile(layout.executable, layout.artifact.integrityAlgorithm) !==
        layout.artifact.integrity
    ) {
      return null;
    }
    const receipt = {
      driver: "portable-binary",
      productId,
      version: layout.version,
      architecture,
      prefix: layout.prefix,
      directory: layout.directory,
      executable: layout.executable,
      integrityAlgorithm: layout.artifact.integrityAlgorithm,
      integrity: layout.artifact.integrity,
      managementId,
      installedAt
    };
    fileSystem.writeFileSync(
      layout.marker,
      JSON.stringify(
        {
          driver: receipt.driver,
          productId,
          version: receipt.version,
          architecture,
          integrityAlgorithm: receipt.integrityAlgorithm,
          integrity: receipt.integrity,
          managementId
        },
        null,
        2
      ),
      { encoding: "utf8", flag: "wx" }
    );
    return receipt;
  } catch {
    return null;
  }
}

function createManagedBinaryTerminalAction({
  productId,
  plan,
  status,
  commandExecutable,
  fileSystem = fs
}) {
  if (!status?.installed || !status?.managed || !status.executable) return null;
  try {
    const command = localWindowsPath(fileSystem.realpathSync.native(commandExecutable));
    const executable = localWindowsPath(
      fileSystem.realpathSync.native(status.executable)
    );
    if (
      path.win32.basename(command).toLowerCase() !== "cmd.exe" ||
      executable.toLowerCase() !== status.executable.toLowerCase() ||
      !pathIsInside(executable, status.directory)
    ) {
      return null;
    }
    return {
      executable: command,
      args: ["/d", "/k", "call", executable, ...(plan.launchArgs || [])],
      environment: { ...(plan.managedEnvironment || {}) },
      options: {
        cwd: status.directory,
        detached: true,
        shell: false,
        stdio: "ignore",
        windowsHide: false
      }
    };
  } catch {
    return null;
  }
}

function createManagedBinaryUninstallAction(options) {
  const status = inspectManagedBinaryCli({ ...options, verifyIntegrity: true });
  if (!status.canUninstall) return null;
  const layout = createManagedBinaryLayout({
    productId: options.productId,
    plan: options.plan,
    prefix: options.receipt?.prefix,
    architecture: options.architecture
  });
  if (!layout) return null;
  return {
    productId: options.productId,
    version: layout.version,
    managementId: options.receipt.managementId,
    directory: layout.directory,
    executable: layout.executable,
    marker: layout.marker
  };
}

module.exports = {
  artifactFor,
  createManagedBinaryLayout,
  createManagedBinaryReceipt,
  createManagedBinaryTerminalAction,
  createManagedBinaryUninstallAction,
  inspectManagedBinaryCli
};
