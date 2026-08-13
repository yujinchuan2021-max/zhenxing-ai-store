export type ProductWithComponents = {
  id: string;
  componentProductIds?: string[];
  [key: string]: unknown;
};

export function buildProductDirectory<T extends ProductWithComponents>(
  products: T[]
): {
  roots: T[];
  childrenByProductId: Record<string, T[]>;
};

export function validateProductComponentLinks(
  vendors: Array<{ id: string; products: ProductWithComponents[] }>
): string;
