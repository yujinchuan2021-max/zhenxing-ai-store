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

export function communityProfileSyncKey(identity: {
  status?: string;
  user?: {
    id?: string;
    profile?: { nickname?: string; avatarUrl?: string; bio?: string };
  };
}): string;

export function classifyCommunityLoadFailure(
  errorCode?: number,
  isMainFrame?: boolean
): { errorClass: string; messageKey: string } | null;

export function communityEmbedSessionFailure(error?: {
  code?: string;
  status?: number;
}):
  | {
      ok: false;
      error: {
        code: "SESSION_REVOKED";
        status: 401;
        messageKey: "community.sessionExpired";
      };
    }
  | {
      ok: false;
      error: {
        code: "TEMPORARILY_UNAVAILABLE";
        status: 503;
        messageKey: "community.serviceUnavailable";
      };
    };
