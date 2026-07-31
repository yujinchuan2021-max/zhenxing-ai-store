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
  children?: Array<{
    id: string;
    name: string;
    environments: Array<{
      id: string;
      name: string;
      installed: boolean;
      version: string;
      location: string;
      distribution: string;
      ownerProductId: string;
      ownerProductName: string;
      scope: "product-private" | "distribution-shared";
      canRepair: boolean;
    }>;
  }>;
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
  localInventory?: Array<{
    id?: string;
    productId?: string;
    label?: string;
    name?: string;
    vendorId?: string;
    vendorName?: string;
    productType?: string;
    mode?: string;
    capabilities?: string[];
  }>;
  desktopStatuses?: Record<string, unknown>;
  cliStatuses?: Record<string, unknown>;
  environmentChecks?: unknown[];
  wslDistributions?: unknown[];
  downloadTasks?: Record<string, unknown>;
}): {
  products: InstalledProductManagementEntry[];
  reinstallableEnvironments: ReinstallableEnvironmentEntry[];
  packages: ManagedInstallerPackageEntry[];
};
