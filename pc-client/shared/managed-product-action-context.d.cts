import type { Product, Vendor } from "../src/data";

export type ClientInstallProfileSnapshot = {
  id: string;
  label: string;
  moduleId: string;
  productId: string;
  vendorId: string;
  productType: string;
  kind: string;
  mode: "managed-installer" | "managed-cli";
  requirements: string[];
  capabilities: string[];
  download?: { url: string; fileName: string };
  lifecycle?: {
    productId?: string;
    updateOwner?: string;
    updateStrategy?: string;
    latestSource?: string;
    dataRetention?: {
      mode?: string;
      retainedPaths?: string[];
      userChoiceRequired?: boolean;
    };
    installerIdentity?: Record<string, unknown>;
  };
};

export function resolveManagedProductActionContext(input: {
  productId: string;
  vendors?: Vendor[];
  localInventory?: ClientInstallProfileSnapshot[];
  requireCatalogEnabled?: boolean;
}): Product | null;

export function resolveManagedProductActionContexts(input?: {
  vendors?: Vendor[];
  localInventory?: ClientInstallProfileSnapshot[];
}): Product[];
