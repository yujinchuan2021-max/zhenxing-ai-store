"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._+-]{0,127}\.exe$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const MANAGEMENT_ID = /^[a-f0-9]{48}$/;
const MARKER_NAME = ".zhenxingai-managed.json";
const PORTABLE_KINDS = new Set([
  "zip-single-executable",
  "zip-directory",
  "standalone-executable"
]);

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
    segments.every(
      (segment) =>
        segment &&
        segment !== "." &&
        segment !== ".." &&
        !segment.includes(":") &&
        /^[A-Za-z0-9][A-Za-z0-9 ._+-]{0,127}$/.test(segment)
    ) &&
    FILE_NAME.test(segments.at(-1))
    ? normalized
    : "";
}

function portableDesktopPlan(download) {
  const portable = download?.portable;
  const kind = String(portable?.kind || "");
  const relativeExecutable = executableRelativePath(
    portable?.executableRelativePath || portable?.executableFileName
  );
  const signaturePolicy = portable?.signaturePolicy || "signed";
  if (
    !portable ||
    portable.driver !== "portable-desktop" ||
    !PORTABLE_KINDS.has(kind) ||
    !VERSION.test(String(portable.version || "")) ||
    !relativeExecutable ||
    !SHA256.test(String(portable.expectedExecutableSha256 || "")) ||
    !["signed", "pinned-unsigned"].includes(signaturePolicy) ||
    (signaturePolicy === "signed" &&
      !(portable.expectedExecutableSigner instanceof RegExp)) ||
    (signaturePolicy === "pinned-unsigned" &&
      portable.expectedExecutableSigner !== undefined) ||
    !Number.isSafeInteger(portable.maximumExecutableBytes) ||
    portable.maximumExecutableBytes < 1024 ||
    portable.maximumExecutableBytes > 2 * 1024 * 1024 * 1024
  ) {
    return null;
  }
  const previousExecutables = Array.isArray(
    portable.approvedPreviousExecutables
  )
    ? portable.approvedPreviousExecutables
    : [];
  if (
    previousExecutables.length > 16 ||
    previousExecutables.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        !VERSION.test(String(entry.version || "")) ||
        entry.version === portable.version ||
        !SHA256.test(String(entry.sha256 || "")) ||
        (signaturePolicy === "signed" &&
          !(entry.expectedExecutableSigner instanceof RegExp)) ||
        (signaturePolicy === "pinned-unsigned" &&
          entry.expectedExecutableSigner !== undefined)
    ) ||
    new Set(previousExecutables.map((entry) => entry.version)).size !==
      previousExecutables.length
  ) {
    return null;
  }
  if (
    kind === "zip-single-executable" &&
    (!FILE_NAME.test(String(portable.archiveEntry || "")) ||
      path.win32.basename(portable.archiveEntry) !== portable.archiveEntry ||
      path.win32.basename(relativeExecutable) !== relativeExecutable)
  ) {
    return null;
  }
  if (
    kind === "standalone-executable" &&
    path.win32.basename(relativeExecutable) !== relativeExecutable
  ) {
    return null;
  }
  if (
    kind === "zip-directory" &&
    (!Number.isSafeInteger(portable.maximumArchiveEntries) ||
      portable.maximumArchiveEntries < 1 ||
      portable.maximumArchiveEntries > 50_000 ||
      !Number.isSafeInteger(portable.maximumExtractedBytes) ||
      portable.maximumExtractedBytes < portable.maximumExecutableBytes ||
      portable.maximumExtractedBytes > 8 * 1024 * 1024 * 1024)
  ) {
    return null;
  }
  return {
    driver: "portable-desktop",
    kind,
    version: portable.version,
    executableRelativePath: relativeExecutable,
    ...(kind === "zip-single-executable"
      ? { archiveEntry: portable.archiveEntry }
      : {}),
    expectedExecutableSha256:
      portable.expectedExecutableSha256.toLowerCase(),
    signaturePolicy,
    ...(signaturePolicy === "signed"
      ? { expectedExecutableSigner: portable.expectedExecutableSigner }
      : {}),
    approvedExecutables: [
      {
        version: portable.version,
        sha256: portable.expectedExecutableSha256.toLowerCase(),
        ...(signaturePolicy === "signed"
          ? { expectedExecutableSigner: portable.expectedExecutableSigner }
          : {})
      },
      ...previousExecutables.map((entry) => ({
        version: entry.version,
        sha256: entry.sha256.toLowerCase(),
        ...(signaturePolicy === "signed"
          ? { expectedExecutableSigner: entry.expectedExecutableSigner }
          : {})
      }))
    ],
    maximumExecutableBytes: portable.maximumExecutableBytes,
    ...(kind === "zip-directory"
      ? {
          maximumArchiveEntries: portable.maximumArchiveEntries,
          maximumExtractedBytes: portable.maximumExtractedBytes
        }
      : {})
  };
}

function portableDesktopTrustForReceipt(download, receipt) {
  const plan = portableDesktopPlan(download);
  const receiptSha256 = String(receipt?.executableSha256 || "").toLowerCase();
  const approved = plan?.approvedExecutables.find(
    (entry) =>
      entry.version === receipt?.version && entry.sha256 === receiptSha256
  );
  return approved
    ? {
        signaturePolicy: plan.signaturePolicy,
        ...(plan.signaturePolicy === "signed"
          ? { expectedExecutableSigner: approved.expectedExecutableSigner }
          : {})
      }
    : null;
}

function portableDesktopSignerForReceipt(download, receipt) {
  return portableDesktopTrustForReceipt(download, receipt)
    ?.expectedExecutableSigner || null;
}

function createPortableDesktopLayout({ productId, download, localAppData }) {
  const plan = portableDesktopPlan(download);
  const root = localWindowsPath(localAppData);
  if (!PRODUCT_ID.test(String(productId || "")) || !plan || !root) {
    return null;
  }
  const productRoot = path.win32.join(
    root,
    "ZhenXingAI",
    "ManagedDesktop",
    productId
  );
  const directoryInstall = plan.kind === "zip-directory";
  const runtimeRoot = directoryInstall
    ? path.win32.join(productRoot, "runtime")
    : productRoot;
  const directory = directoryInstall
    ? path.win32.join(runtimeRoot, "app")
    : productRoot;
  return {
    productId,
    productRoot,
    runtimeRoot,
    dataDirectory: path.win32.join(productRoot, "Data"),
    directory,
    executable: path.win32.join(directory, plan.executableRelativePath),
    marker: path.win32.join(directory, MARKER_NAME),
    version: plan.version,
    plan
  };
}

function absentStatus(directory = "") {
  return {
    installed: false,
    version: "",
    location: directory,
    executable: "",
    appId: "",
    canOpen: false,
    canUninstall: false,
    uninstallMode: "automatic",
    detection: "absent",
    managed: false,
    ownership: "none"
  };
}

function unknownStatus(directory = "", ownership = "unknown") {
  return {
    ...absentStatus(directory),
    detection: "unknown",
    ownership
  };
}

function receiptMatches(receipt, productId, layout) {
  const receiptSha256 = String(receipt?.executableSha256 || "").toLowerCase();
  const approvedExecutable = layout.plan.approvedExecutables.find(
    (entry) =>
      entry.version === receipt?.version && entry.sha256 === receiptSha256
  );
  return Boolean(
    receipt &&
      typeof receipt === "object" &&
      !Array.isArray(receipt) &&
      receipt.driver === "portable-desktop" &&
      receipt.productId === productId &&
      approvedExecutable &&
      localWindowsPath(receipt.productRoot) === layout.productRoot &&
      localWindowsPath(receipt.directory) === layout.directory &&
      localWindowsPath(receipt.executable) === layout.executable &&
      SHA256.test(receiptSha256) &&
      Number.isSafeInteger(receipt.executableBytes) &&
      receipt.executableBytes >= 1024 &&
      receipt.executableBytes <= layout.plan.maximumExecutableBytes &&
      Number.isFinite(receipt.executableMtimeMs) &&
      receipt.executableMtimeMs > 0 &&
      MANAGEMENT_ID.test(String(receipt.managementId || "")) &&
      typeof receipt.installedAt === "string" &&
      Number.isFinite(Date.parse(receipt.installedAt))
  );
}

function inspectPortableDesktop({
  productId,
  download,
  receipt,
  localAppData,
  verifyIntegrity = false,
  fileSystem = fs,
  hashFile
}) {
  const layout = createPortableDesktopLayout({
    productId,
    download,
    localAppData
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
    const canonicalRoot = localWindowsPath(
      fileSystem.realpathSync.native(layout.productRoot)
    );
    const canonicalRuntime = localWindowsPath(
      fileSystem.realpathSync.native(layout.runtimeRoot)
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
      canonicalRoot.toLowerCase() !== layout.productRoot.toLowerCase() ||
      canonicalRuntime.toLowerCase() !== layout.runtimeRoot.toLowerCase() ||
      canonicalDirectory.toLowerCase() !== layout.directory.toLowerCase() ||
      canonicalExecutable.toLowerCase() !== layout.executable.toLowerCase() ||
      !pathIsInside(canonicalRuntime, canonicalRoot) ||
      !pathIsInside(canonicalDirectory, canonicalRuntime) ||
      !pathIsInside(canonicalExecutable, canonicalDirectory) ||
      !executableStat.isFile() ||
      executableStat.isSymbolicLink() ||
      executableStat.size < 1024 ||
      executableStat.size > layout.plan.maximumExecutableBytes ||
      executableStat.size !== receipt.executableBytes ||
      Math.trunc(executableStat.mtimeMs) !==
        Math.trunc(receipt.executableMtimeMs) ||
      !markerStat.isFile() ||
      markerStat.isSymbolicLink()
    ) {
      return unknownStatus(layout.directory, "mismatch");
    }
    const marker = JSON.parse(fileSystem.readFileSync(layout.marker, "utf8"));
    if (
      marker?.driver !== "portable-desktop" ||
      marker?.productId !== productId ||
      marker?.version !== receipt.version ||
      marker?.executableSha256 !== receipt.executableSha256 ||
      marker?.executableBytes !== receipt.executableBytes ||
      Math.trunc(marker?.executableMtimeMs) !==
        Math.trunc(receipt.executableMtimeMs) ||
      marker?.managementId !== receipt.managementId
    ) {
      return unknownStatus(layout.directory, "mismatch");
    }
    if (
      verifyIntegrity &&
      (typeof hashFile !== "function" ||
        String(hashFile(layout.executable, "sha256")).toLowerCase() !==
          receipt.executableSha256)
    ) {
      return unknownStatus(layout.directory, "mismatch");
    }
    return {
      installed: true,
      version: receipt.version,
      ...(receipt.version !== layout.version
        ? { availableVersion: layout.version }
        : {}),
      location: layout.directory,
      executable: layout.executable,
      appId: "",
      canOpen: true,
      canUninstall: true,
      uninstallMode: "automatic",
      detection: "installed",
      managed: true,
      ownership: "managed",
      dataDirectory: layout.dataDirectory
    };
  } catch (error) {
    return error?.code === "ENOENT"
      ? absentStatus(layout.directory)
      : unknownStatus(layout.directory);
  }
}

function createPortableDesktopReceipt({
  productId,
  download,
  localAppData,
  fileSystem = fs,
  hashFile,
  now = () => new Date().toISOString(),
  randomBytes = crypto.randomBytes,
  sourceExecutable = "",
  sourceDirectory = "",
  writeMarker = true
}) {
  const layout = createPortableDesktopLayout({
    productId,
    download,
    localAppData
  });
  if (!layout || typeof hashFile !== "function") return null;
  const installedAt = now();
  if (!Number.isFinite(Date.parse(installedAt))) return null;
  try {
    const managementId = randomBytes(24).toString("hex");
    const receiptSource = localWindowsPath(sourceExecutable) || layout.executable;
    const receiptSourceDirectory =
      localWindowsPath(sourceDirectory) || layout.directory;
    const executableStat = fileSystem.lstatSync(receiptSource);
    const canonicalProductRoot = localWindowsPath(
      fileSystem.realpathSync.native(layout.productRoot)
    );
    const canonicalRuntimeRoot = localWindowsPath(
      fileSystem.realpathSync.native(layout.runtimeRoot)
    );
    const canonicalDirectory = localWindowsPath(
      fileSystem.realpathSync.native(receiptSourceDirectory)
    );
    const canonicalExecutable = localWindowsPath(
      fileSystem.realpathSync.native(receiptSource)
    );
    if (
      !MANAGEMENT_ID.test(managementId) ||
      !pathIsInside(canonicalRuntimeRoot, canonicalProductRoot) ||
      !pathIsInside(canonicalDirectory, canonicalRuntimeRoot) ||
      !pathIsInside(canonicalExecutable, canonicalDirectory) ||
      !executableStat.isFile() ||
      executableStat.isSymbolicLink() ||
      executableStat.size < 1024 ||
      executableStat.size > layout.plan.maximumExecutableBytes ||
      String(hashFile(receiptSource, "sha256")).toLowerCase() !==
        layout.plan.expectedExecutableSha256
    ) {
      return null;
    }
    const receipt = {
      driver: "portable-desktop",
      productId,
      version: layout.version,
      productRoot: layout.productRoot,
      directory: layout.directory,
      executable: layout.executable,
      executableSha256: layout.plan.expectedExecutableSha256,
      executableBytes: executableStat.size,
      executableMtimeMs: executableStat.mtimeMs,
      managementId,
      installedAt
    };
    if (writeMarker) {
      fileSystem.writeFileSync(layout.marker, JSON.stringify(receipt, null, 2), {
        encoding: "utf8",
        flag: "wx"
      });
    }
    return receipt;
  } catch {
    return null;
  }
}

function createPortableDesktopUninstallAction(options) {
  const status = inspectPortableDesktop({ ...options, verifyIntegrity: true });
  if (!status.canUninstall) return null;
  const layout = createPortableDesktopLayout({
    productId: options.productId,
    download: options.download,
    localAppData: options.localAppData
  });
  if (!layout) return null;
  return {
    productId: options.productId,
    version: options.receipt.version,
    managementId: options.receipt.managementId,
    productRoot: layout.productRoot,
    runtimeRoot: layout.runtimeRoot,
    directory: layout.directory,
    executable: layout.executable,
    marker: layout.marker,
    dataDirectory: layout.dataDirectory
  };
}

module.exports = {
  createPortableDesktopLayout,
  createPortableDesktopReceipt,
  createPortableDesktopUninstallAction,
  inspectPortableDesktop,
  portableDesktopPlan,
  portableDesktopSignerForReceipt,
  portableDesktopTrustForReceipt
};
