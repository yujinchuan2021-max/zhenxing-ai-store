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
};

export function resolveManagedProductActionContext(input: {
  productId: string;
  vendors?: Vendor[];
  localInventory?: ClientInstallProfileSnapshot[];
}): Product | null;

export function resolveManagedProductActionContexts(input?: {
  vendors?: Vendor[];
  localInventory?: ClientInstallProfileSnapshot[];
}): Product[];
