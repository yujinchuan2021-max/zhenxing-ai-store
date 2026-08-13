export type DirectoryKind = "ai-tool" | "ai-connectable";

export function resolvedDirectoryKind(product: {
  directoryKind?: DirectoryKind;
}): DirectoryKind;

export function projectVendorsByDirectory<T extends {
  enabled?: boolean;
  products: Array<{ enabled?: boolean; directoryKind?: DirectoryKind }>;
}>(
  vendors: T[],
  directoryKind: DirectoryKind,
  options?: { includeDisabled?: boolean }
): T[];

export function resourceTargetsByType(
  resources: Array<Record<string, unknown>>,
  vendors: Array<Record<string, unknown>>,
  resourceType: string
): Array<Record<string, unknown>>;

export function resourceProductsByType(
  resources: Array<Record<string, unknown>>,
  vendors: Array<Record<string, unknown>>,
  resourceType: string
): Array<{
  vendor: Record<string, unknown>;
  product: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
}>;

export type CatalogSearchProduct = {
  id: string;
  name: string;
  enabled?: boolean;
  order?: number;
  directoryKind?: DirectoryKind;
};

export type CatalogSearchVendor<P extends CatalogSearchProduct> = {
  id: string;
  name: string;
  enabled?: boolean;
  order?: number;
  products: P[];
};

export type CatalogSearchTarget = {
  productId: string;
  enabled?: boolean;
};

export type CatalogSearchResource<T extends CatalogSearchTarget> = {
  id: string;
  name: string;
  enabled?: boolean;
  order?: number;
  resourceTypes?: string[];
  targets?: T[];
};

export type CatalogSearchStore = {
  id: string;
  label: string;
  enabled?: boolean;
  order?: number;
};

export function searchCatalog<
  P extends CatalogSearchProduct,
  V extends CatalogSearchVendor<P>,
  T extends CatalogSearchTarget,
  R extends CatalogSearchResource<T>,
  S extends CatalogSearchStore
>(input: {
  vendors: V[];
  resources: R[];
  resourceStores: S[];
  query: string;
}): {
  query: string;
  vendors: Array<{
    vendor: V;
    products: P[];
    directoryKind: DirectoryKind;
  }>;
  resources: Array<{
    store: S;
    resource: R;
    target: T;
    product: P;
    vendor: V;
  }>;
};

export const DIRECTORY_KINDS: readonly DirectoryKind[];
