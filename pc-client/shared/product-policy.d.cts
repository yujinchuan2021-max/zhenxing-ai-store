export type ProductBehavior = {
  productType: string;
  directUrl: string;
  opensDirectly: boolean;
  requiresEnvironmentCheck: boolean;
  managedDownload: boolean;
  managedCli: boolean;
  managedDesktop: boolean;
  clientManagedInstall: boolean;
  installMode:
    | "managed-cli"
    | "managed-installer"
    | "official-installer-page"
    | "direct-open";
  primaryLabel: string;
};

export function resolveProductBehavior(product: {
  id: string;
  productType: string;
  website: string;
  tutorial: string;
  downloadPolicy: string;
  download?: { url: string; fileName: string };
}): ProductBehavior;

export function validateProductPolicy(
  product: Record<string, unknown>,
  vendorId: string
): string;
