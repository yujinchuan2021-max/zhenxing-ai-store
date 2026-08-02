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

export const DIRECTORY_KINDS: readonly DirectoryKind[];
