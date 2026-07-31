export type UninstallMode = "automatic" | "interactive";

export type UninstallPresentation = {
  preparing: string;
  activeTitle: string;
  activeDetail: string;
  timedOut: string;
  stillInstalled: string;
  launched: string;
};

export const UNINSTALL_MODES: readonly UninstallMode[];
export function normalizeUninstallMode(value: unknown): UninstallMode;
export function getUninstallPresentation(
  value: unknown
): UninstallPresentation;
