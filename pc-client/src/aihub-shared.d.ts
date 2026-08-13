declare module "@aihub-shared/navigation-back.cjs" {
  export function goBackOrFallback(input: {
    canGoBack: () => boolean;
    goBack: () => void;
    fallback: () => void;
  }): "history" | "fallback";
}

declare module "@aihub-shared/home-carousel-presentation.cjs" {
  export function isAllowedCarouselActionHref(href: string): boolean;
  export function resolveCarouselImageUrl(
    imageUrl: string,
    baseUrl: string
  ): string;
  export function selectHomeCarouselSlides<T extends { enabled: boolean; sort: number }>(
    homeCarousel: { slides?: T[] } | undefined
  ): T[];
}

declare module "@aihub-shared/official-download-page.cjs" {
  export function resolveOfficialDownloadUrl(
    action: {
      url: string;
      kind:
        | "vendor-bootstrap"
        | "download-page"
        | "fixed-redirect"
        | "stable-redirect"
        | "store"
        | "login-required"
        | "manual-selector"
        | "no-windows";
      coveredProductIds?: string[];
      note?: string;
    } | undefined,
    website: string
  ): string;
}

declare module "@aihub-shared/catalog-taxonomy.cjs" {
  export const MATURE_AGENT_CHANNEL: "mature-agent";
  export const SCENARIO_TAGS: ReadonlyArray<{
    id: string;
    label: string;
    aliases: readonly string[];
  }>;
  export function canonicalScenarioTags(value: unknown): string[];
}

declare module "@aihub-shared/community-embed.cjs" {
  export function classifyCommunityLoadFailure(
    errorCode: number | undefined,
    isMainFrame?: boolean
  ): {
    errorClass: "redirect" | "tls" | "network" | "blocked" | "load";
    messageKey:
      | "community.pageFailedRedirect"
      | "community.pageFailedTls"
      | "community.pageFailedNetwork"
      | "community.pageFailedBlocked"
      | "community.pageFailed";
  } | null;
  export function communityProfileSyncKey(identity: unknown): string;
}
