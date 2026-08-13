"use strict";

const {
  projectResourcePlatformAvailability,
  validatePlatformSupportClaims
} = require("../shared/resource-platform-availability.cjs");

function platformSupportCandidateCapability() {
  return Object.freeze({ enabled: false });
}

function validateOptionalPlatformSupport(claims, { now } = {}) {
  if (claims === undefined) return Object.freeze({ configured: false });
  const result = validatePlatformSupportClaims(claims, { now });
  if (!result.valid) {
    throw new Error(`Platform support is invalid: ${result.reason}`);
  }
  return Object.freeze({ configured: true });
}

function validateFixedProfilePlatformSupport(claims, options) {
  return validateOptionalPlatformSupport(claims, options);
}

function previewPlatformSupportCandidate(input = {}) {
  const projection = projectResourcePlatformAvailability(input);
  return Object.freeze({
    enabled: false,
    available: projection.available,
    managedEligible: false,
    reason: projection.available
      ? "PLATFORM_SUPPORT_CANDIDATE_DISABLED"
      : projection.reason
  });
}

module.exports = {
  platformSupportCandidateCapability,
  previewPlatformSupportCandidate,
  validateFixedProfilePlatformSupport,
  validateOptionalPlatformSupport
};
