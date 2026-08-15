import type { ProductEntryPoint } from "./product-entry-points.cjs";

export type ProductBehavior = {
  productType: string;
  directUrl: string;
  opensDirectly: boolean;
  capabilities: readonly string[];
  canOpenWebsite: boolean;
  canOpenTutorial: boolean;
  canInstall: boolean;
  canOpenInstalled: boolean;
  canUninstall: boolean;
  requiresEnvironmentCheck: boolean;
  managedDownload: boolean;
  managedCli: boolean;
  managedDesktop: boolean;
  clientManagedInstall: boolean;
  installMode:
    | "managed-cli"
    | "managed-installer"
    | "managed-package-manager"
    | "official-installer-page"
    | "direct-open";
  entryPoints: readonly ProductEntryPoint[];
  primaryLabel: string;
};

export function resolveProductBehavior(product: {
  id: string;
  productType: string;
  website: string;
  tutorial: string;
  kind: string;
  entryPoints?: ProductEntryPoint[];
  moduleId?: string;
  capabilities?: string[];
  downloadPolicy: string;
  download?: { url: string; fileName: string };
}): ProductBehavior;

export function validateProductPolicy(
  product: Record<string, unknown>,
  vendorId: string
): string;
