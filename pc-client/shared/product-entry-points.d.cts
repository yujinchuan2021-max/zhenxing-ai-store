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

export function entryPointTypeMetadata(): Array<{
  type: ProductEntryPoint["type"];
  label: string;
  kind: "link" | "product-action";
}>;

export function resolveProductEntryPoints(product: {
  productType: string;
  kind: string;
  website: string;
  tutorial: string;
  entryPoints?: ProductEntryPoint[];
}): readonly ProductEntryPoint[];

export function validateProductEntryPoints(
  product: Record<string, unknown>
): string;
