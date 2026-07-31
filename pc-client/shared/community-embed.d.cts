export function approvedCommunityOrigin(value?: string): string;

export function validateCommunityLaunchUrl(
  value: string,
  originValue?: string
): string;

export function isApprovedCommunityNavigation(
  value: string,
  originValue?: string
): boolean;

export function communityDiscussionLocation(
  value: string,
  originValue?: string
): { discussionId: string; path: string } | null;
