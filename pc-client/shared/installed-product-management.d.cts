export type InstalledProductManagementEntry = {
  id: string;
  name: string;
  vendorName: string;
  type: "desktop" | "cli" | "environment";
  version: string;
  location: string;
  canOpen: boolean;
  canClose: boolean;
  canManageFiles: boolean;
  canReinstall: boolean;
  canUninstall: boolean;
};

export type ManagedInstallerPackageEntry = {
  id: string;
  name: string;
  filePath: string;
  canInstall: boolean;
};

export type ReinstallableEnvironmentEntry = {
  id: string;
  environmentId: string;
  name: string;
  vendorName: string;
  type: "environment";
  packageReady: boolean;
};

export function buildInstalledProductManagement(input: {
  vendors?: unknown[];
  desktopStatuses?: Record<string, unknown>;
  cliStatuses?: Record<string, unknown>;
  environmentChecks?: unknown[];
  downloadTasks?: Record<string, unknown>;
}): {
  products: InstalledProductManagementEntry[];
  reinstallableEnvironments: ReinstallableEnvironmentEntry[];
  packages: ManagedInstallerPackageEntry[];
};
