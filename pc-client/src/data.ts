import catalogSnapshot from "../admin/data/catalog-v1.json";

export type ProductKind = "桌面端" | "CLI" | "其他产品";
export type ProductDirectoryKind = "ai-tool" | "ai-connectable";
export type ProductType =
  | "web"
  | "desktop-official"
  | "desktop-reviewed"
  | "cli-official"
  | "cli"
  | "local-model"
  | "tutorial";
export type InstallPolicy =
  | "open-product-website"
  | "open-official-download"
  | "open-official-install"
  | "client-managed-installer"
  | "client-managed-cli"
  | "open-tutorial";
export type DownloadPolicy = "none" | "official-page" | "client-managed";
export type SignaturePolicy =
  | "not-applicable"
  | "vendor-controlled"
  | "client-reviewed";
export type UninstallPolicy =
  | "not-managed"
  | "vendor-managed"
  | "client-managed";
export type ProductCategory = string;
export type ProductCapability =
  | "website"
  | "tutorial"
  | "install"
  | "update"
  | "repair"
  | "open"
  | "uninstall";

export type ProductEntryPoint =
  | {
      type: "website" | "web" | "tutorial" | "external";
      label: string;
      url: string;
    }
  | {
      type: "desktop" | "cli";
      label: string;
    };

export type Product = {
  id: string;
  enabled?: boolean;
  order?: number;
  directoryKind?: ProductDirectoryKind;
  name: string;
  kind: ProductKind;
  category: ProductCategory;
  description: string;
  website: string;
  tutorial: string;
  productType: ProductType;
  moduleId?: string;
  installProfileId?: string;
  requirements: string[];
  installPolicy: InstallPolicy;
  downloadPolicy: DownloadPolicy;
  signaturePolicy: SignaturePolicy;
  uninstallPolicy: UninstallPolicy;
  capabilities?: ProductCapability[];
  entryPoints?: ProductEntryPoint[];
  componentProductIds?: string[];
  download?: {
    url: string;
    fileName: string;
  };
};

export type Vendor = {
  id: string;
  enabled?: boolean;
  order?: number;
  iconUrl?: string;
  iconAsset?: {
    path: string;
    sha256: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/x-icon" | "image/svg+xml";
  };
  name: string;
  initial: string;
  requiresCrossBorderNetwork?: boolean;
  mark: string;
  color: string;
  description: string;
  website: string;
  tutorial: string;
  products: Product[];
};

export type ResourceStore = {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
};

export type ResourceTarget = {
  productId: string;
  compatibility: "official" | "protocol-compatible" | "verified";
  moduleId:
    | "resource-link"
    | "skill-managed"
    | "mcp-managed"
    | "plugin-managed";
  installProfileId: string;
  capabilities: Array<
    | "website"
    | "install"
    | "update"
    | "repair"
    | "enable"
    | "disable"
    | "uninstall"
  >;
  enabled: boolean;
};

export type EcosystemResource = {
  id: string;
  enabled?: boolean;
  order?: number;
  name: string;
  resourceTypes: string[];
  description: string;
  website: string;
  tutorial: string;
  publisherVendorId?: string;
  publisher?: string;
  sourceKind?: "official" | "reviewed-community" | "community";
  sourceProductIds: string[];
  targets: ResourceTarget[];
  versionRef?: string;
  requestedPermissions?: string[];
  credentialRequirements?: string[];
  installScope?: string;
  uninstallPlan?: string;
  provenanceEvidence?: string[];
  lastVerifiedAt?: string;
};

// The checked-in backend catalog is the only built-in fallback snapshot.
// One source prevents an offline client from reverting to an obsolete demo.
export const vendors = catalogSnapshot.vendors as unknown as Vendor[];
export const resources = catalogSnapshot.resources as unknown as EcosystemResource[];
export const resourceStores = catalogSnapshot.resourceStores as ResourceStore[];
