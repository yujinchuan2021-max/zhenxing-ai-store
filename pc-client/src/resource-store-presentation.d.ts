declare module "@aihub-shared/resource-store.cjs" {
  export type ResourceTargetPresentation = {
    managed: boolean;
    links: Array<{
      kind: "website" | "tutorial";
      href: string;
      labelKey: "resources.openWebsite" | "resources.openTutorial";
    }>;
  };

  export type ResourceProvenancePresentation = {
    href: string;
    labelKey:
      | "resources.source.github"
      | "resources.source.gitlab"
      | "resources.source.npm"
      | "resources.source.pypi"
      | "resources.source.huggingFace"
      | "resources.source.modelScope"
      | "resources.source.mcpRegistry"
      | "resources.source.clawHub"
      | "resources.source.official"
      | "resources.source.web";
  };

  export function resourceTargetPresentation(
    resource: {
      id: string;
      website?: string;
      tutorial?: string;
      reviewStatus?: "unreviewed" | "automated-reviewed" | "manually-reviewed" | "rejected";
      riskLevel?: "low" | "guarded" | "unsafe";
    },
    target: {
      productId: string;
      moduleId: string;
      installProfileId?: string;
      capabilities?: string[];
    }
  ): ResourceTargetPresentation;

  export function resourceProvenancePresentation(resource: {
    website?: string;
    tutorial?: string;
    sourceKind?: "official" | "reviewed-community" | "community";
    provenanceEvidence?: string[];
  }): ResourceProvenancePresentation[];

  export function resourceSourceChannel(resource: {
    sourceKind?: "official" | "reviewed-community" | "community";
  }): "official" | "community" | null;
  export function resourceReviewStatus(resource: { reviewStatus?: string }):
    "unreviewed" | "automated-reviewed" | "manually-reviewed" | "rejected";
  export function resourceRiskLevel(resource: { riskLevel?: string }):
    "low" | "guarded" | "unsafe";
}
