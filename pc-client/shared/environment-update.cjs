"use strict";

const {
  resolveEnvironmentUpdateOffer
} = require("./environment-detection.cjs");

function createEnvironmentUpdatePlan({ environmentId, status, downloadPlan }) {
  if (
    typeof environmentId !== "string" ||
    !/^[a-z][a-z0-9]{1,31}$/.test(environmentId) ||
    !status ||
    typeof status !== "object" ||
    !downloadPlan ||
    typeof downloadPlan !== "object"
  ) {
    return null;
  }
  const offer = resolveEnvironmentUpdateOffer({
    detection: status.detection,
    installedVersion: status.version,
    recommendedVersion: downloadPlan.recommendedVersion
  });
  return offer.canUpdate
    ? {
        environmentId,
        intent: "update",
        installedVersion: status.version,
        recommendedVersion: offer.recommendedVersion
      }
    : null;
}

module.exports = { createEnvironmentUpdatePlan };
