"use strict";

const {
  resolveEnvironmentUpdateOffer
} = require("./environment-detection.cjs");

const ENVIRONMENT_UPDATE_FAMILIES = Object.freeze({
  python: Object.freeze(["python", "python312"])
});

function environmentUpdateMemberIds(environmentId) {
  return ENVIRONMENT_UPDATE_FAMILIES[environmentId] || [environmentId];
}

function projectEnvironmentFamilyChecks(checks) {
  if (!Array.isArray(checks)) return [];
  const byId = new Map(
    checks
      .filter((check) => check && typeof check.id === "string")
      .map((check) => [check.id, check])
  );
  const familyMembers = new Set(Object.values(ENVIRONMENT_UPDATE_FAMILIES).flat());
  const projectedFamilies = new Set();
  const result = [];

  for (const check of checks) {
    if (!familyMembers.has(check?.id)) {
      result.push(check);
      continue;
    }
    const targetId = Object.keys(ENVIRONMENT_UPDATE_FAMILIES).find((id) =>
      ENVIRONMENT_UPDATE_FAMILIES[id].includes(check.id)
    );
    if (!targetId || projectedFamilies.has(targetId)) continue;
    projectedFamilies.add(targetId);
    const memberIds = environmentUpdateMemberIds(targetId);
    const target = byId.get(targetId);
    const visible =
      memberIds.map((id) => byId.get(id)).find((entry) => entry?.installed) ||
      target ||
      check;
    const offer = resolveEnvironmentUpdateOffer({
      detection: visible.detection,
      installedVersion: visible.version,
      recommendedVersion: target?.recommendedVersion
    });
    result.push({
      ...visible,
      recommendedVersion: offer.recommendedVersion,
      canUpdate: offer.canUpdate,
      ...(offer.canUpdate && visible.id !== targetId
        ? { updateEnvironmentId: targetId }
        : {})
    });
  }
  return result;
}

function createEnvironmentUpdatePlan({
  environmentId,
  status,
  statuses,
  downloadPlan
}) {
  if (
    typeof environmentId !== "string" ||
    !/^[a-z][a-z0-9]{1,31}$/.test(environmentId) ||
    !(
      (status && typeof status === "object") ||
      (statuses && typeof statuses === "object")
    ) ||
    !downloadPlan ||
    typeof downloadPlan !== "object"
  ) {
    return null;
  }
  const installedStatus = statuses
    ? environmentUpdateMemberIds(environmentId)
        .map((id) => ({ id, status: statuses[id] }))
        .find((entry) => entry.status?.detection === "installed")
    : { id: environmentId, status };
  if (!installedStatus?.status) return null;
  const offer = resolveEnvironmentUpdateOffer({
    detection: installedStatus.status.detection,
    installedVersion: installedStatus.status.version,
    recommendedVersion: downloadPlan.recommendedVersion
  });
  return offer.canUpdate
    ? {
        environmentId,
        intent: "update",
        ...(installedStatus.id !== environmentId
          ? { installedEnvironmentId: installedStatus.id }
          : {}),
        installedVersion: installedStatus.status.version,
        recommendedVersion: offer.recommendedVersion
      }
    : null;
}

module.exports = {
  createEnvironmentUpdatePlan,
  environmentUpdateMemberIds,
  projectEnvironmentFamilyChecks
};
