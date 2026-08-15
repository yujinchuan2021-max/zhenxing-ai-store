const path = require("node:path");

const REGISTERED_EXECUTABLES = Object.freeze({
  node: [["node.exe"]],
  git: [
    ["cmd", "git.exe"],
    ["bin", "git.exe"]
  ],
  python: [["python.exe"]],
  python312: [["python.exe"]],
  docker: [["Docker Desktop.exe"]]
});

function resolveEnvironmentEvidence({
  pathLocation,
  registeredLocation,
  exists
}) {
  if (typeof exists !== "function") {
    throw new Error("环境检测缺少文件存在性检查");
  }
  for (const candidate of [pathLocation, registeredLocation]) {
    if (
      typeof candidate === "string" &&
      path.isAbsolute(candidate) &&
      exists(candidate)
    ) {
      return {
        installed: true,
        location: candidate
      };
    }
  }
  return {
    installed: false,
    location: ""
  };
}

async function resolveTrustedEnvironmentExecutableProbe({
  probe,
  canonicalize,
  verify
}) {
  if (!probe || probe.ok !== true) {
    return { ok: false, location: "" };
  }
  if (!probe.location) {
    return { ok: true, location: "" };
  }
  if (
    typeof probe.location !== "string" ||
    typeof canonicalize !== "function" ||
    typeof verify !== "function"
  ) {
    return { ok: false, location: "" };
  }
  try {
    const canonical = canonicalize(probe.location);
    if (!canonical || !path.isAbsolute(canonical)) {
      return { ok: false, location: "" };
    }
    return (await verify(canonical))
      ? { ok: true, location: canonical }
      : { ok: false, location: "" };
  } catch {
    return { ok: false, location: "" };
  }
}

function resolveRegisteredEnvironmentExecutable({
  environmentId,
  installLocation,
  exists
}) {
  if (
    typeof environmentId !== "string" ||
    typeof installLocation !== "string" ||
    !path.isAbsolute(installLocation) ||
    typeof exists !== "function"
  ) {
    return "";
  }
  const candidates = REGISTERED_EXECUTABLES[environmentId] || [];
  return (
    candidates
      .map((segments) => path.join(installLocation, ...segments))
      .find((candidate) => exists(candidate)) || ""
  );
}

function resolveEnvironmentOperationStatus({
  evidence,
  registryScanOk,
  evidenceProbeOk = true,
  registryEntry,
  registryEvidencePresent = Boolean(registryEntry),
  uninstallAction
}) {
  const trustedEvidence =
    evidence &&
    typeof evidence === "object" &&
    typeof evidence.installed === "boolean" &&
    typeof evidence.location === "string"
      ? evidence
      : { installed: false, location: "" };
  const installed = trustedEvidence.installed;
  return {
    installed,
    version:
      registryEntry && typeof registryEntry.displayversion === "string"
        ? registryEntry.displayversion
        : "",
    location: trustedEvidence.installed ? trustedEvidence.location : "",
    executable: trustedEvidence.installed ? trustedEvidence.location : "",
    appId: "",
    canOpen: trustedEvidence.installed && Boolean(trustedEvidence.location),
    canUninstall: installed && Boolean(uninstallAction),
    detection: installed
      ? "installed"
      : registryScanOk === true &&
          evidenceProbeOk === true &&
          registryEvidencePresent !== true
        ? "absent"
        : "unknown"
  };
}

function numericVersion(value) {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(value)) {
    return null;
  }
  const parts = value.split(".").map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function resolveEnvironmentUpdateOffer({
  detection,
  installedVersion,
  recommendedVersion
}) {
  const installed = numericVersion(installedVersion);
  const recommended = numericVersion(recommendedVersion);
  let canUpdate = detection === "installed" && Boolean(installed && recommended);
  if (canUpdate) {
    canUpdate = false;
    for (let index = 0; index < Math.max(installed.length, recommended.length); index += 1) {
      const difference = (installed[index] || 0) - (recommended[index] || 0);
      if (difference !== 0) {
        canUpdate = difference < 0;
        break;
      }
    }
  }
  return {
    recommendedVersion: recommended ? recommendedVersion : "",
    canUpdate
  };
}

module.exports = {
  resolveRegisteredEnvironmentExecutable,
  resolveEnvironmentEvidence,
  resolveEnvironmentOperationStatus,
  resolveEnvironmentUpdateOffer,
  resolveTrustedEnvironmentExecutableProbe
};
