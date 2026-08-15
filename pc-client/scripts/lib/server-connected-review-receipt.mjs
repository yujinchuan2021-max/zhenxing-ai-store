import fs from "node:fs";
import path from "node:path";

const SEMVER = /^(?:0|[1-9]\d*)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[a-f0-9]{64}$/;
const KEYS = ["schemaVersion", "kind", "version", "artifactSha256", "invocationCount"];
const BUILD_KEYS = ["schemaVersion", "version", "builtAt", "source", "artifacts", "packageInvocationCount", "packageAsarSha256", "packageCatalogChannelSha256", "packageUpdateChannelSha256"];
const FREEZE_KEYS = ["schemaVersion", "version", "status", "packageInvocationCount", "formalAcceptanceInvocationCount", "artifacts", "closure", "remainingGate", "installerLaunched", "installed", "uploaded", "published", "userMachineAcceptance"];
const CLOSURE_KEYS = ["packageVersionExact", "mainExact", "preloadExact", "rendererExact", "identityLoginExact", "downloadedPackageActionExact", "downloadTaskExact", "managedDownloadNetworkExact", "managedDownloadQueueExact", "secretFilesScanned", "secretFindings", "prohibitedTopLevelCount", "asarSha256", "catalogChannelSha256", "updateChannelSha256", "catalogSource", "catalogVersion", "catalogKeyId"];
const REMAINING_GATE_KEYS = ["code", "status", "blockingPackage", "localizedCatalogEnglishAcceptance", "communityRedirectAcceptance"];
const BUILD_ARTIFACT_KEYS = ["name", "sha256", "fileSize"];
const FREEZE_ARTIFACT_KEYS = ["kind", "name", "bytes", "sha256"];
const REVISION = /^[a-f0-9]{40}$/;

function exactRecord(value, keys) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key)));
}

function validArtifacts(buildArtifacts, freezeArtifacts, version) {
  if (!Array.isArray(buildArtifacts) || !Array.isArray(freezeArtifacts) || buildArtifacts.length !== 3 || freezeArtifacts.length !== 3) return false;
  const expected = new Map([
    ["portable", `ZhenXing-AI-Server-Connected-Review-${version}-Windows-x64-Portable.exe`],
    ["setup", `ZhenXing-AI-Server-Connected-Review-${version}-Windows-x64-Setup.exe`],
    ["blockmap", `ZhenXing-AI-Server-Connected-Review-${version}-Windows-x64-Setup.exe.blockmap`]
  ]);
  const expectedNames = new Set(expected.values());
  const buildByName = new Map();
  for (const artifact of buildArtifacts) {
    if (!exactRecord(artifact, BUILD_ARTIFACT_KEYS) || !expectedNames.has(artifact.name) || !SHA256.test(artifact.sha256 || "") || !Number.isSafeInteger(artifact.fileSize) || artifact.fileSize < 1 || buildByName.has(artifact.name)) return false;
    buildByName.set(artifact.name, artifact);
  }
  for (const artifact of freezeArtifacts) {
    if (!exactRecord(artifact, FREEZE_ARTIFACT_KEYS) || expected.get(artifact.kind) !== artifact.name || !SHA256.test(artifact.sha256 || "") || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1) return false;
    const built = buildByName.get(artifact.name);
    if (!built || built.sha256 !== artifact.sha256 || built.fileSize !== artifact.bytes) return false;
  }
  return new Set(freezeArtifacts.map(({ kind }) => kind)).size === 3;
}

function receiptName(kind) {
  if (kind === "package") return "PACKAGE-CONTROL.json";
  if (kind === "acceptance") return "CONTROL.json";
  throw new Error("INVOCATION_RECEIPT_INVALID");
}

function assertReceipt(value, { kind, version, artifactSha256 }) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).some((key) => !KEYS.includes(key)) ||
    value.schemaVersion !== 1 ||
    value.kind !== kind ||
    value.version !== version ||
    value.artifactSha256 !== artifactSha256 ||
    value.invocationCount !== 1
  ) {
    throw new Error("PACKAGE_RECEIPT_INVALID");
  }
  return value;
}

export function claimServerConnectedReviewInvocation({ directory, kind, version, artifactSha256 }) {
  if (
    !path.isAbsolute(directory) ||
    !SEMVER.test(version) ||
    (artifactSha256 !== null && !SHA256.test(artifactSha256))
  ) {
    throw new Error("INVOCATION_RECEIPT_INVALID");
  }
  const value = { schemaVersion: 1, kind, version, artifactSha256, invocationCount: 1 };
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    fs.writeFileSync(path.join(directory, receiptName(kind)), bytes, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`${kind.toUpperCase()}_ALREADY_INVOKED`);
    throw error;
  }
  return value;
}

export function readServerConnectedReviewPackageInvocation({ portablePath, version }) {
  if (!path.isAbsolute(portablePath) || !SEMVER.test(version)) throw new Error("PACKAGE_RECEIPT_INVALID");
  try {
    const value = JSON.parse(fs.readFileSync(path.join(path.dirname(portablePath), receiptName("package")), "utf8"));
    return assertReceipt(value, { kind: "package", version, artifactSha256: null });
  } catch (error) {
    if (error?.message === "PACKAGE_RECEIPT_INVALID") throw error;
    throw new Error("PACKAGE_RECEIPT_INVALID");
  }
}

export function readServerConnectedReviewRuntimeClosure({ packageDirectory, version }) {
  if (!path.isAbsolute(packageDirectory) || !SEMVER.test(version || "")) throw new Error("PACKAGE_RUNTIME_CLOSURE_INVALID");
  try {
    const prefix = `ZhenXing-AI-Server-Connected-Review-${version}`;
    const build = JSON.parse(fs.readFileSync(path.join(packageDirectory, `${prefix}-BUILD.json`), "utf8"));
    const freeze = JSON.parse(fs.readFileSync(path.join(packageDirectory, `${prefix}-PACKAGE-FREEZE.json`), "utf8"));
    if (
      !exactRecord(build, BUILD_KEYS) || !exactRecord(freeze, FREEZE_KEYS) ||
      build.schemaVersion !== 1 || freeze.schemaVersion !== 1 || build.version !== version || freeze.version !== version ||
      typeof build.builtAt !== "string" || Number.isNaN(Date.parse(build.builtAt)) || new Date(build.builtAt).toISOString() !== build.builtAt ||
      !exactRecord(build.source, ["revision", "dirty", "versionTag"]) || !REVISION.test(build.source.revision || "") || typeof build.source.dirty !== "boolean" || (build.source.versionTag !== null && build.source.versionTag !== `v${version}`) ||
      !validArtifacts(build.artifacts, freeze.artifacts, version) ||
      freeze.status !== "package-complete" || build.packageInvocationCount !== 1 || freeze.packageInvocationCount !== 1 ||
      freeze.formalAcceptanceInvocationCount !== 0 || !exactRecord(freeze.closure, CLOSURE_KEYS) || freeze.closure.packageVersionExact !== true ||
      CLOSURE_KEYS.filter((key) => key.endsWith("Exact")).some((key) => freeze.closure[key] !== true) ||
      !["secretFilesScanned", "secretFindings", "prohibitedTopLevelCount", "catalogVersion"].every((key) => Number.isSafeInteger(freeze.closure[key]) && freeze.closure[key] >= 0) || freeze.closure.catalogSource !== "remote" || typeof freeze.closure.catalogKeyId !== "string" || !freeze.closure.catalogKeyId ||
      !exactRecord(freeze.remainingGate, REMAINING_GATE_KEYS) || freeze.remainingGate.code !== "FORMAL_PACKAGED_ACCEPTANCE_NOT_RUN" || freeze.remainingGate.status !== "pending" || freeze.remainingGate.blockingPackage !== false || freeze.remainingGate.localizedCatalogEnglishAcceptance !== "not-closed" || freeze.remainingGate.communityRedirectAcceptance !== "not-closed" ||
      [freeze.installerLaunched, freeze.installed, freeze.uploaded, freeze.published, freeze.userMachineAcceptance].some((value) => typeof value !== "boolean")
    ) {
      throw new Error("PACKAGE_RUNTIME_CLOSURE_INVALID");
    }
    const buildValues = [build.packageAsarSha256, build.packageCatalogChannelSha256, build.packageUpdateChannelSha256];
    const freezeValues = [freeze.closure.asarSha256, freeze.closure.catalogChannelSha256, freeze.closure.updateChannelSha256];
    if (buildValues.some((value) => !SHA256.test(value || "")) || freezeValues.some((value) => !SHA256.test(value || "")) || buildValues.some((value, index) => value !== freezeValues[index])) {
      throw new Error("PACKAGE_RUNTIME_CLOSURE_INVALID");
    }
    return { asarSha256: buildValues[0], catalogChannelSha256: buildValues[1], updateChannelSha256: buildValues[2] };
  } catch (error) {
    if (error?.message === "PACKAGE_RUNTIME_CLOSURE_INVALID") throw error;
    throw new Error("PACKAGE_RUNTIME_CLOSURE_INVALID");
  }
}
