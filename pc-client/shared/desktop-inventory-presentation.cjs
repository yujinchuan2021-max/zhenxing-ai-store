"use strict";

const ACTIVE_DESKTOP_STAGES = new Set([
  "downloading",
  "launching-installer",
  "awaiting-verification"
]);

function reconcileDesktopInstalledEvidence({
  hadInstalledEvidence,
  installed,
  detection
}) {
  if (installed === true) return true;
  if (detection === "absent") return false;
  return hadInstalledEvidence === true;
}

function reconcileDesktopInventoryStage({
  currentStage,
  installed,
  detection,
  completedPackage
}) {
  if (installed === true) return "installed";
  if (detection === "absent" && currentStage === "installed") {
    return completedPackage === true ? "downloaded" : "ready";
  }
  if (detection === "unknown" && !ACTIVE_DESKTOP_STAGES.has(currentStage)) {
    return "detection-error";
  }
  return currentStage;
}

module.exports = {
  reconcileDesktopInstalledEvidence,
  reconcileDesktopInventoryStage
};
