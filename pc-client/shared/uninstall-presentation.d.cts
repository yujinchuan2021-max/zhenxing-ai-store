export type UninstallMode = "automatic" | "interactive";
export type UninstallLanguage = "zh" | "en";

export type DesktopDataRetention = {
  mode?: string;
  retainedPaths?: string[];
  userChoiceRequired?: boolean;
};

export type UninstallPresentation = {
  preparingTitle: string;
  preparing: string;
  activeTitle: string;
  activeDetail: string;
  timedOut: string;
  stillInstalled: string;
  launched: string;
  retentionNotice?: string;
  confirmationDetail?: string;
  requiresVendorConfirmation?: boolean;
};

export type DesktopUninstallConfirmation = {
  type: "warning";
  title: string;
  message: string;
  detail: string;
  buttons: string[];
  defaultId: number;
  cancelId: number;
  noLink: boolean;
};

export const UNINSTALL_MODES: readonly UninstallMode[];
export function normalizeUninstallMode(value: unknown): UninstallMode;
export function getUninstallPresentation(
  value: unknown,
  dataRetention?: DesktopDataRetention,
  language?: UninstallLanguage
): UninstallPresentation;
export function getDesktopUninstallPresentation(
  productId: string,
  value: unknown,
  language?: UninstallLanguage
): UninstallPresentation;
export function buildDesktopUninstallConfirmation(input: {
  productId: string;
  mode: unknown;
  language?: UninstallLanguage;
  surface?: "vendor-uninstaller" | "windows-settings" | "appx-package";
  productName?: string;
  version?: string;
  publisher?: string;
  packageFullName?: string;
  installLocation?: string;
  executableName?: string;
  signer?: string;
}): DesktopUninstallConfirmation;
