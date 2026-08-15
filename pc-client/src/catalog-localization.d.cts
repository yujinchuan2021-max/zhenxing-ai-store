type LocalizedCatalogValue<T> = T & {
  localized?: { en?: Partial<T> };
};

export function catalogDisplayField<
  T extends object,
  K extends keyof T
>(value: LocalizedCatalogValue<T>, field: K, language: "zh" | "en"): T[K];
