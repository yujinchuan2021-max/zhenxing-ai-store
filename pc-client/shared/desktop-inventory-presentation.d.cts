export type DesktopInventoryPresentationStage =
  | "idle"
  | "blocked"
  | "ready"
  | "downloading"
  | "paused"
  | "detecting"
  | "deploying"
  | "removing-cli"
  | "downloaded"
  | "launching-installer"
  | "awaiting-verification"
  | "awaiting-uninstall"
  | "detection-error"
  | "error"
  | "installed";

export function reconcileDesktopInstalledEvidence(input: {
  hadInstalledEvidence: boolean;
  installed: boolean;
  detection: "installed" | "absent" | "unknown";
}): boolean;

export function reconcileDesktopInventoryStage(input: {
  currentStage: DesktopInventoryPresentationStage | undefined;
  installed: boolean;
  detection: "installed" | "absent" | "unknown";
  completedPackage: boolean;
}): DesktopInventoryPresentationStage | undefined;
