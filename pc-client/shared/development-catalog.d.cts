export const DEVELOPMENT_CATALOG_URL: string;

export function loadDevelopmentCatalog(
  fetchCatalog: typeof fetch
): Promise<CatalogResult>;
