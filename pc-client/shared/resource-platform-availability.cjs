"use strict";

const PLATFORMS = new Set(["windows", "macos", "linux"]);
const RUNTIMES = new Set(["native", "wsl", "container", "browser", "remote"]);
const STATUSES = new Set(["supported", "unsupported", "unknown", "blocked"]);
const ARCHITECTURES = new Set(["x64", "arm64", "x86", "universal", "unknown"]);
const RUNTIME_DEPENDENCIES = new Set(["wsl", "container"]);
const LOCAL_RUNTIMES = new Set(["native", "wsl", "container"]);
const EVIDENCE_MAX_AGE_MS = 366 * 24 * 60 * 60 * 1000;

function isObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactObject(value, fields) {
  return isObject(value) &&
    Object.keys(value).length === fields.length &&
    Object.keys(value).every((field) => fields.includes(field));
}

function isoTimestamp(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function validEvidenceUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash;
  } catch {
    return false;
  }
}

function invalid(reason) {
  return Object.freeze({ valid: false, reason });
}

function validatePlatformSupportClaims(claims, { now = new Date().toISOString() } = {}) {
  if (!isoTimestamp(now)) return invalid("PLATFORM_CLOCK_INVALID");
  if (!Array.isArray(claims) || claims.length === 0) {
    return invalid("PLATFORM_CLAIMS_MISSING");
  }
  const identities = new Set();
  for (const claim of claims) {
    if (!exactObject(claim, [
      "platform", "runtime", "status", "architectures", "evidence"
    ])) return invalid("PLATFORM_CLAIM_INVALID");
    if (!PLATFORMS.has(claim.platform) ||
      !RUNTIMES.has(claim.runtime) ||
      !STATUSES.has(claim.status) ||
      !Array.isArray(claim.architectures) ||
      new Set(claim.architectures).size !== claim.architectures.length ||
      !claim.architectures.every((architecture) => ARCHITECTURES.has(architecture)) ||
      !Array.isArray(claim.evidence) ||
      claim.evidence.length === 0) {
      return invalid("PLATFORM_CLAIM_INVALID");
    }
    if (claim.runtime === "wsl" && claim.platform !== "windows") {
      return invalid("WSL_REQUIRES_WINDOWS");
    }
    const identity = `${claim.platform}:${claim.runtime}`;
    if (identities.has(identity)) return invalid("PLATFORM_CLAIM_DUPLICATE");
    identities.add(identity);
    for (const evidence of claim.evidence) {
      if (!exactObject(evidence, ["kind", "url", "observedAt"]) ||
        evidence.kind !== "first-party" ||
        !validEvidenceUrl(evidence.url) ||
        !isoTimestamp(evidence.observedAt)) {
        return invalid("PLATFORM_EVIDENCE_INVALID");
      }
      const age = Date.parse(now) - Date.parse(evidence.observedAt);
      if (age < 0) return invalid("PLATFORM_EVIDENCE_INVALID");
      if (age > EVIDENCE_MAX_AGE_MS) return invalid("PLATFORM_EVIDENCE_STALE");
    }
  }
  return Object.freeze({ valid: true, reason: null });
}

function validateRequest(requested) {
  if (!exactObject(requested, [
    "platform", "runtime", "architecture", "runtimeDependencies"
  ]) ||
    !PLATFORMS.has(requested.platform) ||
    !RUNTIMES.has(requested.runtime) ||
    !ARCHITECTURES.has(requested.architecture) ||
    requested.architecture === "unknown" ||
    !Array.isArray(requested.runtimeDependencies) ||
    new Set(requested.runtimeDependencies).size !== requested.runtimeDependencies.length ||
    !requested.runtimeDependencies.every((dependency) => RUNTIME_DEPENDENCIES.has(dependency)) ||
    (requested.runtime === "wsl" && requested.platform !== "windows")) {
    return false;
  }
  if (["native", "browser", "remote"].includes(requested.runtime)) {
    return requested.runtimeDependencies.length === 0;
  }
  return requested.runtimeDependencies.every((dependency) =>
    dependency === requested.runtime
  );
}

function architectureMatches(architectures, requested) {
  return architectures.includes("universal") || architectures.includes(requested);
}

function matchingClaim(claims, requested) {
  return claims.find((claim) =>
    claim.status === "supported" &&
    claim.platform === requested.platform &&
    claim.runtime === requested.runtime &&
    architectureMatches(claim.architectures, requested.architecture)
  ) || null;
}

function blocked(reason) {
  return Object.freeze({
    available: false,
    managedEligible: false,
    reason,
    platform: null,
    runtime: null,
    architecture: null
  });
}

function projectResourcePlatformAvailability(input = {}) {
  if (!exactObject(input, [
    "resourceSupport", "hostSupport", "profileSupport", "requested", "now"
  ])) return blocked("PLATFORM_PROJECTION_INPUT_INVALID");
  const {
    resourceSupport,
    hostSupport,
    profileSupport,
    requested,
    now
  } = input;
  if (!validateRequest(requested)) return blocked("PLATFORM_REQUEST_INVALID");
  const requiredDependency = requested.runtime === "wsl" ? "wsl"
    : requested.runtime === "container" ? "container"
      : null;
  if (requiredDependency && !requested.runtimeDependencies.includes(requiredDependency)) {
    return blocked("RUNTIME_DEPENDENCY_MISSING");
  }
  for (const [label, claims] of [
    ["RESOURCE", resourceSupport],
    ["HOST", hostSupport],
    ["PROFILE", profileSupport]
  ]) {
    const validation = validatePlatformSupportClaims(claims, { now });
    if (!validation.valid) return blocked(`${label}_${validation.reason}`);
  }
  if (LOCAL_RUNTIMES.has(requested.runtime)) {
    const approvedPlatforms = new Set(profileSupport
      .filter((claim) => claim.status === "supported" && LOCAL_RUNTIMES.has(claim.runtime))
      .map((claim) => claim.platform));
    if (approvedPlatforms.size !== 1) return blocked("PROFILE_NOT_PLATFORM_SPECIFIC");
  }
  if (!matchingClaim(resourceSupport, requested) ||
    !matchingClaim(hostSupport, requested) ||
    !matchingClaim(profileSupport, requested)) {
    return blocked("PLATFORM_INTERSECTION_EMPTY");
  }
  return Object.freeze({
    available: true,
    managedEligible: true,
    reason: null,
    platform: requested.platform,
    runtime: requested.runtime,
    architecture: requested.architecture
  });
}

module.exports = {
  EVIDENCE_MAX_AGE_MS,
  projectResourcePlatformAvailability,
  validatePlatformSupportClaims
};
