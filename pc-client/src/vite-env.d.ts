/// <reference types="vite/client" />

declare module "@tabler/icons-react/dist/esm/icons/*.mjs" {
  import type { Icon } from "@tabler/icons-react";
  const icon: Icon;
  export default icon;
}

type PCSettings = {
  downloadDirectory: string;
  cliInstallDirectory?: string;
  language?: "zh" | "en";
  selectionCanceled?: boolean;
};

type EnvironmentCheck = {
  id: string;
  name: string;
  installed: boolean;
  location: string;
  canUninstall?: boolean;
  canOpen?: boolean;
  version?: string;
  recommendedVersion?: string;
  canUpdate?: boolean;
  updateEnvironmentId?: string;
  detection?: "installed" | "absent" | "unknown";
};

type EnvironmentReport = {
  platform: string;
  architecture: string;
  checkedAt: string;
  checks: EnvironmentCheck[];
  displayChecks?: EnvironmentCheck[];
  wslDistributions?: Array<{
    name: string;
    environments: Array<{
      id: string;
      name: string;
      installed: boolean;
      version: string;
      location: string;
      ownerProductId: string;
      ownerProductName: string;
      scope: "product-private" | "distribution-shared";
      canRepair: boolean;
    }>;
  }>;
};

type EnvironmentInstallResult = {
  downloaded: boolean;
  intent?: "install" | "update";
  recommendedVersion?: string;
  busy?: boolean;
  filePath?: string;
  source?: string;
  task?: ManagedDownloadTask | null;
  operationTask?: EnvironmentOperationTask | null;
  message?: string;
  error?: string;
};

type EnvironmentPackageSnapshot = {
  ready: boolean;
  filePath?: string;
  source?: string;
  message?: string;
};

type EnvironmentInstallerOpenResult = {
  launched: boolean;
  intent?: "update";
  recommendedVersion?: string;
  requiresRecheck?: boolean;
  canceled?: boolean;
  busy?: boolean;
  exitCode?: number | null;
  operationTask?: EnvironmentOperationTask | null;
  warning?: string;
  message?: string;
  error?: string;
};

type EnvironmentUninstallResult = {
  launched: boolean;
  canceled?: boolean;
  busy?: boolean;
  exitCode?: number | null;
  operationTask?: EnvironmentOperationTask | null;
  warning?: string;
  message?: string;
  error?: string;
};

type EnvironmentOperationTask = {
  schemaVersion: 1;
  environmentId: string;
  generation: number;
  operationId: string;
  operation: "install" | "uninstall";
  launchState: "pending" | "confirmed" | "unknown";
  revision: number;
  phase:
    | "launching"
    | "monitoring"
    | "timed-out"
    | "installed"
    | "uninstalled";
  attempts: number;
  startedAt: string;
  updatedAt: string;
  deadlineAt: string;
  lastCheckedAt: string | null;
  lastDetection: "installed" | "absent" | "unknown" | null;
  lastError: string | null;
  environmentStatus: DesktopStatus | null;
};

type DownloadProgress = {
  productId: string;
  receivedBytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  etaSeconds: number | null;
  percent: number | null;
  availableBytes?: number;
  requiredBytes?: number;
  remainingBytes?: number;
  reserveBytes?: number;
  downloadDirectory?: string;
  installDiskBytes?: number;
  installAvailableBytes?: number;
  installSpaceOk?: boolean;
  spaceOk?: boolean;
};

type DownloadResult = {
  ok: boolean;
  canceled?: boolean;
  resumable?: boolean;
  resumedFrom?: number;
  receivedBytes?: number;
  totalBytes?: number;
  code?: string;
  availableBytes?: number;
  requiredBytes?: number;
  remainingBytes?: number;
  reserveBytes?: number;
  shortfallBytes?: number;
  downloadDirectory?: string;
  filePath?: string;
  sha256?: string;
  fileSize?: number;
  error?: string;
};

type PartialDownloadRecord = {
  productId: string;
  fileName: string;
  targetPath: string;
  receivedBytes: number;
  totalBytes: number;
  updatedAt: string;
};

type DownloadRecord = {
  productId: string;
  filePath: string;
  sha256: string;
  fileSize: number;
  resumedFrom?: number;
  url?: string;
  source?: string;
  downloadedAt: string;
};

type ManagedDownloadTaskProgress = {
  receivedBytes: number;
  totalBytes: number;
  bytesPerSecond: number;
  etaSeconds: number | null;
  percent: number | null;
  availableBytes: number | null;
  requiredBytes: number | null;
  remainingBytes: number | null;
  reserveBytes: number | null;
  installDiskBytes: number | null;
  installAvailableBytes: number | null;
  downloadDirectory: string | null;
  installSpaceOk: boolean | null;
  spaceOk: boolean | null;
};

type ManagedDownloadTask = {
  schemaVersion: 1;
  productId: string;
  attemptId: string;
  attempt: number;
  revision: number;
  phase:
    | "starting"
    | "downloading"
    | "pausing"
    | "paused"
    | "failed"
    | "canceling"
    | "canceled"
    | "completed";
  resumable: boolean;
  progress: ManagedDownloadTaskProgress;
  errorCode: string | null;
  errorMessage: string | null;
  filePath: string | null;
  sha256: string | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
  logs: string[];
};

type ManagedDownloadQueueTask = {
  taskId: string;
  productId: string;
  profileId: string;
  phase: "queued" | "downloading" | "downloaded" | "failed" | "cancelled";
  progress: {
    receivedBytes: number;
    totalBytes: number;
    bytesPerSecond: number;
    percent: number | null;
  };
  errorCode?: string;
  presentation: {
    state: "active" | "failed" | "completed";
    canCancel: boolean;
    canRetry: boolean;
  };
};

type ManagedDownloadQueueCommandResult = {
  ok: boolean;
  reused?: boolean;
  task?: ManagedDownloadQueueTask;
  errorCode?: string;
};

type DownloadTaskCommandResult = {
  ok: boolean;
  canceled?: boolean;
  task?: ManagedDownloadTask | null;
  filePath?: string;
  error?: string;
};

type ClearCompletedDownloadsResult = {
  ok: boolean;
  canceled?: boolean;
  clearedProductIds: string[];
  errors: Array<{ productId: string; error: string }>;
};

type DesktopOperationTask = {
  schemaVersion: 1;
  productId: string;
  generation: number;
  operationId: string;
  operation: "install" | "uninstall";
  launchState: "pending" | "confirmed" | "unknown";
  revision: number;
  phase:
    | "launching"
    | "monitoring"
    | "timed-out"
    | "installed"
    | "uninstalled"
    | "canceled"
    | "failed";
  attempts: number;
  startedAt: string;
  updatedAt: string;
  deadlineAt: string;
  lastCheckedAt: string | null;
  lastDetection: "installed" | "absent" | "unknown" | null;
  lastError: string | null;
  desktopStatus: DesktopStatus | null;
};

type InstallerLaunchResult = {
  launched: boolean;
  canceled?: boolean;
  busy?: boolean;
  exitCode?: number | null;
  operationTask?: DesktopOperationTask | null;
  verificationMode?:
    | "presence-transition"
    | "installer-owned-maintenance"
    | "manual-installer";
  warning?: string;
  error?: string;
};

type DesktopStatus = {
  installed: boolean;
  version: string;
  availableVersion?: string;
  location: string;
  executable: string;
  appId: string;
  canOpen: boolean;
  canUninstall: boolean;
  uninstallMode?: "automatic" | "interactive";
  legacyInstall?: "comfy-desktop-v1";
  detection: "installed" | "absent" | "unknown";
};

type DesktopUninstallResult = {
  launched: boolean;
  canceled?: boolean;
  busy?: boolean;
  exitCode?: number | null;
  operationTask?: DesktopOperationTask | null;
  uninstallMode?: "automatic" | "interactive";
  warning?: string;
  message?: string;
  error?: string;
};

type CatalogBanner = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  localized?: {
    en: { eyebrow: string; title: string; description: string; action: string };
  };
};

type CatalogHomeCarouselAction = {
  label: string;
  href: string;
  localized?: { en: { label: string } };
};

type CatalogHomeSlide = {
  id: string;
  imageUrl: string;
  imageAlt: string;
  title: string;
  description: string;
  localized?: { en: { imageAlt: string; title: string; description: string } };
  primaryAction: CatalogHomeCarouselAction;
  secondaryAction?: CatalogHomeCarouselAction;
  sort: number;
  enabled: boolean;
};

type CatalogHomeCarousel = {
  autoplayMs: number;
  slides: CatalogHomeSlide[];
};

type CatalogBrand = {
  name: string;
  mark: string;
  slogan: string;
  localized?: { en: { slogan: string } };
};

type CatalogExtraSection = {
  id: string;
  title: string;
  localized?: { en: { title: string } };
  description: string;
  url: string;
  enabled: boolean;
};

type CatalogCommunity = {
  title: string;
  description: string;
  localized?: { en: { title: string; description: string } };
  provider: string;
  url: string;
  enabled: boolean;
};

type RemoteCatalog = {
  updatedAt?: string;
  categories?: import("./data").ProductCategory[];
  brand?: CatalogBrand;
  extraSections?: CatalogExtraSection[];
  community?: CatalogCommunity;
  home?: {
    banners: CatalogBanner[];
    featuredVendorIds: string[];
  };
  homeCarousel?: CatalogHomeCarousel;
  vendors: import("./data").Vendor[];
  resourceStores?: import("./data").ResourceStore[];
  resources?: import("./data").EcosystemResource[];
} & (
  | { schemaVersion: 1 | 2; resourceConnections?: never }
  | { schemaVersion: 3; resourceConnections: import("./data").ResourceConnection[] }
);

type ClientInstallProfile = {
  id: string;
  label: string;
  moduleId: string;
  productId: string;
  vendorId: string;
  productType: string;
  kind: string;
  mode: "managed-installer" | "managed-package-manager" | "managed-cli";
  downloadPolicy?: "package-manager";
  requirements: string[];
  capabilities: string[];
  download?: { url: string; fileName: string };
  lifecycle?: {
    productId: string;
    updateOwner: string;
    updateStrategy: string;
    latestSource: string;
    dataRetention: {
      mode: string;
      retainedPaths: string[];
      userChoiceRequired: boolean;
    };
    installerIdentity: Record<string, unknown>;
  };
};

type ManagedProductInventorySnapshot = {
  checkedAt: string;
  profiles: ClientInstallProfile[];
  desktopStatuses: Record<string, DesktopStatus>;
  cliStatuses: Record<string, CliStatus>;
};

type CatalogResult = {
  source: "remote" | "cache" | "built-in" | "unavailable";
  catalog: RemoteCatalog | null;
  catalogVersion?: number;
  error: string;
};

type UpdateCheckResult = {
  status: "disabled" | "current" | "available" | "error";
  currentVersion: string;
  version?: string;
  publishedAt?: string;
  notes?: string[];
  sha256?: string;
  fileSize?: number;
  message: string;
};

type SoftwareUpdateCheckResult = {
  status: "disabled" | "current" | "available" | "error";
  releaseVersion?: number;
  publishedAt?: string;
  publishedEntries: number;
  message: string;
};

type UpdateInstallResult = {
  ok: boolean;
  stage: "offer" | "download" | "confirmation" | "launch" | "launched";
  canceled?: boolean;
  filePath?: string;
  warning?: string;
  errorCode?: string;
  error?: string;
};

type IdentityUser = {
  id: string;
  email: string;
  phone: string;
  username: string;
  profile: {
    nickname: string;
    avatarUrl: string;
    bio: string;
  };
};

type IdentitySnapshot =
  | { status: "anonymous" }
  | {
      status: "authenticated";
      user: IdentityUser;
      sessionId: string;
    };

type IdentityLoginResult =
  | { ok: true; value: Extract<IdentitySnapshot, { status: "authenticated" }> }
  | {
      ok: false;
      error: {
        code: string;
        status: number;
        messageKey:
          | "identity.login.failed"
          | "identity.login.invalid"
          | "identity.login.invalidCredentials"
          | "identity.login.rateLimited"
          | "identity.login.serviceUnavailable";
      };
    };

type PublicIdentityUser = {
  id: string;
  username: string;
  profile: {
    nickname: string;
    avatarUrl: string;
    bio: string;
  };
  social: {
    followers: number;
    following: number;
    isFollowing: boolean;
    isMe: boolean;
  };
};

type DirectMessage = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type DirectConversation = {
  peer: PublicIdentityUser;
  lastMessage: DirectMessage;
  unreadCount: number;
};

type IdentityUserPage = {
  users: PublicIdentityUser[];
  hasMore: boolean;
  nextOffset: number | null;
};

type DirectConversationPage = {
  conversations: DirectConversation[];
  hasMore: boolean;
  nextOffset: number | null;
};

type DirectMessagePage = {
  peer: PublicIdentityUser;
  messages: DirectMessage[];
  hasMore: boolean;
  nextBefore: string | null;
};

type RegistrationChallenge = {
  challengeId: string;
  expiresAt: string;
  localMailViewerUrl?: string;
};

type SiteMessage = {
  id: string;
  title: string;
  body: string;
  actionPath: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

type PersonalCenterNotification = {
  id: string;
  source: "account" | "community";
  title: string;
  body: string;
  actionPath: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

type CommunityInteraction = {
  discussionId: string;
  title: string;
  path: string;
  favorited: boolean;
  liked: boolean;
  updatedAt: string;
};

type PersonalCenterSnapshot = {
  user: IdentityUser;
  sessions: IdentityDeviceSession[];
  notifications: PersonalCenterNotification[];
  interactions: CommunityInteraction[];
  social: {
    followers: number;
    following: number;
  };
  readingHistory: Array<{
    discussionId: string;
    title: string;
    path: string;
    viewedAt: string;
  }>;
  readingHistoryCapped: boolean;
  summary: {
    unreadNotifications: number;
    unreadDirectMessages: number;
    favorites: number;
    likes: number;
  };
  sources: {
    account: "ready";
    community: "ready" | "unavailable";
  };
  generatedAt: string;
};

type CommunityEmbedSession = {
  launchUrl: string;
  origin: string;
  expiresAt: string;
};

type CommunityEmbedSessionResult =
  | { ok: true; value: CommunityEmbedSession }
  | {
      ok: false;
      error: {
        code: "SESSION_REVOKED" | "TEMPORARILY_UNAVAILABLE" | "INVALID_IDENTITY_RESPONSE";
        status: 401 | 502 | 503;
        messageKey:
          | "community.sessionExpired"
          | "community.serviceUnavailable"
          | "community.invalidResponse";
      };
    };

type IdentityDeviceSession = {
  id: string;
  deviceId: string;
  deviceName: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
};

type CommunityAuthor = {
  nickname: string;
  avatarUrl: string;
};

type CommunityDiscussionSummary = {
  id: string;
  productId: string;
  title: string;
  body: string;
  author: CommunityAuthor;
  replyCount: number;
  createdAt: string;
};

type CommunityDiscussion = CommunityDiscussionSummary & {
  replies: Array<{
    id: string;
    body: string;
    author: CommunityAuthor;
    createdAt: string;
  }>;
};

type CliLogEntry = {
  productId: string;
  stream: "stdout" | "stderr";
  line: string;
};

type CliDeployResult = {
  ok: boolean;
  canceled?: boolean;
  version?: string;
  directory?: string;
  managed?: boolean;
  terminalOpened?: boolean;
  warning?: string;
  error?: string;
};

type CliStatus = {
  installed: boolean;
  version: string;
  availableVersion?: string;
  directory: string;
  detection: "installed" | "absent" | "unknown";
  managed: boolean;
  canUninstall: boolean;
  canUpdate?: boolean;
  canRepair?: boolean;
  ownership: "managed" | "managed-outdated" | "external" | "mismatch" | "stale" | "none" | "unknown";
  requiresInstallDirectory?: boolean;
  hubInstalled?: boolean;
  hubRunning?: boolean;
  gatewayDistributionInstalled?: boolean;
  gatewayCliInstalled?: boolean;
  gatewayRunning?: boolean;
  gatewayReady?: boolean;
  gatewayPaired?: boolean;
  setupPhase?: string;
  setupDetail?: string;
  summary?: string;
};

type CliUninstallResult = {
  ok: boolean;
  canceled?: boolean;
  status?: CliStatus;
  error?: string;
};

type CliTaskNotification = {
  productId: string;
  generation: number;
  operation: "install" | "update" | "repair" | "uninstall";
  outcome: "completed" | "failed";
};

type CliTrayTask = {
  productId: string;
  generation: number;
  operation: "install" | "update" | "repair" | "uninstall";
  phase: "running" | "completed" | "failed" | "canceled";
};

type TaskNotificationTarget = {
  target: "product" | "task-center";
  productId: string;
};

type ExtensionRuntimeResult = {
  ok: boolean;
  state:
    | "not-installed"
    | "external"
    | "stale"
    | "unsafe"
    | "modified"
    | "installed"
    | "disabled"
    | "outdated"
    | "host-missing"
    | "invalid-receipt"
    | "unavailable"
    | "error";
  managed: boolean;
  enabled?: boolean;
  hostInstalled?: boolean;
  hostDetection?: "installed" | "absent" | "unknown";
  allowedActions: Array<
    "install" | "update" | "repair" | "enable" | "disable" | "uninstall"
  >;
  error?: string;
};

type ExtensionRuntimeAction =
  | "install"
  | "update"
  | "repair"
  | "enable"
  | "disable"
  | "uninstall";

type ResourceSubmissionKind =
  | "vendor"
  | "agent"
  | "skill"
  | "mcp"
  | "plugin"
  | "connector"
  | "workflow";

type ResourceSubmissionProposal = {
  submissionKind: ResourceSubmissionKind;
  title: string;
  summary: string;
  canonicalSource: string;
  originalAuthorIdentityId?: string | null;
  originalAuthor?: string | null;
  organization?: string | null;
  ownershipClaim?: {
    kind: "author" | "organization";
    evidenceRefs: string[];
  } | null;
  licenseId?: string | null;
  sourceRevision?: string | null;
  catalogReferences?: Array<{
    kind: "product" | "resource";
    canonicalId: string;
    hostProductId?: string | null;
  }>;
  hostTuples?: Array<{
    kind: "resource";
    canonicalId: string;
    hostProductId: string;
    bindingKind:
      | "skill-context"
      | "mcp-tool"
      | "mcp-resource"
      | "mcp-prompt"
      | "plugin-host-extension"
      | "connector-authorized-connection";
  }>;
  platforms?: string[];
  scenarioTags?: string[];
  rawTags?: string[];
  agentCompatibility?: string[];
  evidenceRefs?: string[];
  discoveredVia?: string | null;
  workflowRef?: { workflowId: string; version: string } | null;
};

type OwnerSubmission = {
  submissionId: string;
  expectedRevision: number;
  status:
    | "draft"
    | "submitted"
    | "triaged"
    | "needs-evidence"
    | "accepted"
    | "rejected"
    | "withdrawn"
    | "merged";
  proposal: ResourceSubmissionProposal;
  allowedActions: Array<"update" | "submit" | "evidence" | "withdraw">;
  evidenceRequired: boolean;
};

type ResourceSubmissionCapability = {
  enabled: boolean;
  supportedKinds: ResourceSubmissionKind[];
  temporarilyUnavailableKinds?: ResourceSubmissionKind[];
  authenticationRequired: true;
  proposalSchemaVersion: 1;
};

type OwnerSubmissionPage = {
  items: OwnerSubmission[];
  page: { offset: number; limit: number; nextOffset: number | null };
};

type SubmissionMessageKey =
  | "resources.submit.loginRequired"
  | "resources.submit.conflict"
  | "resources.submit.rateLimited"
  | "resources.submit.serviceUnavailable"
  | "resources.submit.unavailable"
  | "resources.submit.invalid"
  | "resources.submit.failed";

type SubmissionIpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; status: number; messageKey: SubmissionMessageKey } };

type WorkflowStoreMessageKey =
  | "workflow.store.loginRequired"
  | "workflow.store.accessDenied"
  | "workflow.store.notFound"
  | "workflow.store.conflict"
  | "workflow.store.rateLimited"
  | "workflow.store.unavailable"
  | "workflow.store.invalid"
  | "workflow.store.serviceUnavailable"
  | "workflow.store.failed";

type WorkflowIpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; status: number; messageKey: WorkflowStoreMessageKey } };

type WorkflowStoreCapability = {
  enabled: boolean;
  schemaVersion: number;
  execution: boolean;
  workflowSubmissionLookup: boolean;
};

type OwnerWorkflowDependency =
  | { kind: "product"; canonicalId: string; permissions: string[] }
  | {
      kind: "resource";
      canonicalId: string;
      hostProductId: string;
      bindingKind: string;
      permissions: string[];
    };

type OwnerWorkflowContent = {
  title: string;
  summary: string;
  inputs: Array<{ name: string; type: string; required: boolean; description: string }>;
  outputs: Array<{ name: string; type: string; description: string }>;
  instructions: string[];
  dependencies: OwnerWorkflowDependency[];
  secretPlaceholders: Array<{ name: string; description: string }>;
};

type OwnerWorkflowDraft = {
  sourceCommunityPostId: string;
  provenance: {
    licenseId: string;
    derivedFrom: Array<{ workflowId: string; version: string }>;
    discoveredVia: Array<{ kind: string; canonicalId: string }>;
  };
  content: OwnerWorkflowContent;
};

type OwnerWorkflow = OwnerWorkflowDraft & {
  workflowId: string;
  expectedRevision: number;
  status: string;
  latestReleaseVersion: number | null;
  rejectionReason: string | null;
  postReferences: Array<{
    communityPostId: string;
    card: { workflowId: string; version: number };
    attachedAt: string;
  }>;
  allowedActions: string[];
};

type OwnerWorkflowPage = { items: OwnerWorkflow[]; next: string | null };

type WorkflowPublicMessageKey = WorkflowStoreMessageKey | "workflow.public.unavailable";

type WorkflowPublicIpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; status: number; messageKey: WorkflowPublicMessageKey } };

type WorkflowPublicCapability = {
  enabled: boolean;
  schemaVersion: number;
  execution: false;
};

type PublicWorkflow = {
  workflowId: string;
  version: number;
  author: { displayName: string };
  originalAuthorDisplayName?: string;
  sourceCommunityPostId: string;
  provenance: {
    canonicalSource: { kind: "community-post"; canonicalId: string };
    licenseId: string;
    derivedFrom: Array<{ workflowId: string; version: number }>;
  };
  content: {
    title: string;
    summary: string;
    inputs: Array<{ name: string; type: string; required: boolean; description: string }>;
    outputs: Array<{ name: string; type: string; description: string }>;
    instructions: string[];
    dependencies: OwnerWorkflowDependency[];
  };
  reviewStatus: "automated-reviewed" | "manually-reviewed";
  riskLevel: "low" | "guarded";
  requiresPerUseConfirmation: boolean;
  releasedAt: string;
};

type PublicWorkflowPage = { items: PublicWorkflow[]; next: string | null };

type LocalAgentBridgeMessageKey =
  | "agent.bridge.disabled"
  | "agent.bridge.invalid"
  | "agent.bridge.notFound"
  | "agent.bridge.unavailable";

type LocalAgentBridgeIpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; status: number; messageKey: LocalAgentBridgeMessageKey } };

type LocalAgentBridgeCapability = {
  schemaVersion: 1;
  enabled: boolean;
  execution: false;
  operations: Array<"search" | "get" | "plan" | "request">;
};

type LocalAgentBridgeItemKind = "product" | "resource" | "workflow";

type LocalAgentBridgeSearchItem = {
  kind: LocalAgentBridgeItemKind;
  id: string;
  version?: number;
  title: string;
  summary?: string;
  source: "signed-catalog" | "workflow-release";
};

type LocalAgentBridgeSearchResult = {
  items: LocalAgentBridgeSearchItem[];
};

type LocalAgentBridgeGetResult = LocalAgentBridgeSearchItem;

type LocalAgentBridgePlanResult = {
  planId: string;
  status: "ready" | "confirmation-required" | "blocked";
  reason?: string;
  workflow: { workflowId: string; version: number; title: string };
  capabilities: Array<{
    capabilityKey: string;
    label: string;
    status: "ready" | "confirmation-required" | "blocked";
    reason?: string;
  }>;
};

type LocalAgentBridgeRequestResult = {
  requestId: string;
  planId: string;
  capabilityKey: string;
  status: "pending-user-confirmation";
  expiresAt: string;
};

type FixedCliLifecycleMessageKey =
  | "cli.lifecycle.invalidInput"
  | "cli.lifecycle.inputTooLarge"
  | "cli.lifecycle.unavailable"
  | "cli.lifecycle.catalogUnavailable"
  | "cli.lifecycle.catalogMismatch"
  | "cli.lifecycle.capabilityDisabled";

type FixedCliLifecycleResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; status: number; messageKey: FixedCliLifecycleMessageKey } };

type FixedCliLifecycleStatus = {
  productId?: string;
  installed: boolean;
  managed: boolean;
  detection: string;
  version?: string;
};

type FixedCliLifecyclePlan = {
  planId: string;
  productId: string;
  profileId: string;
  moduleId: string;
  operation: "install" | "update" | "repair" | "uninstall";
  driver: string;
  requirements: string[];
  receiptRequired: boolean;
  rollbackRequired: boolean;
  state: "confirmation-required";
};

type FixedCliLifecycleConfirmation = {
  planId: string;
  confirmationId: string;
  state: "confirmed";
};

type FixedCliLifecycleApplyResult = {
  planId: string;
  state: string;
  receipt: { ownership: "aihub" | "none"; action: string; persisted: boolean; version: string } | null;
  status?: FixedCliLifecycleStatus;
  rollback: { required: boolean; executed: boolean };
};

type ExtensionInventoryEntry = ExtensionRuntimeResult & {
  profileId: string;
  label: string;
  resourceType: "skill" | "mcp" | "plugin";
  hostProductId: string;
};

interface Window {
  aihubPC?: {
    getCatalog(): Promise<CatalogResult>;
    scanManagedInventory(): Promise<ManagedProductInventorySnapshot>;
    checkForUpdate(): Promise<UpdateCheckResult>;
    checkSoftwareUpdates(): Promise<SoftwareUpdateCheckResult>;
    openUpdateDownload(): Promise<UpdateInstallResult>;
    listExtensions(): Promise<ExtensionInventoryEntry[]>;
    getExtensionStatus(profileId: string): Promise<ExtensionRuntimeResult>;
    installExtension(profileId: string): Promise<ExtensionRuntimeResult>;
    uninstallExtension(profileId: string): Promise<ExtensionRuntimeResult>;
    inspectExtension(profileId: string): Promise<ExtensionRuntimeResult>;
    executeExtension(
      profileId: string,
      action: ExtensionRuntimeAction
    ): Promise<ExtensionRuntimeResult>;
    getIdentity(): Promise<IdentitySnapshot>;
    requestRegistrationCode(email: string): Promise<RegistrationChallenge>;
    register(input: {
      email: string;
      username: string;
      nickname: string;
      password: string;
      challengeId: string;
      code: string;
    }): Promise<IdentitySnapshot>;
    login(input: {
      identifier: string;
      password: string;
    }): Promise<IdentityLoginResult>;
    logout(): Promise<IdentitySnapshot>;
    listIdentitySessions(): Promise<IdentityDeviceSession[]>;
    revokeIdentitySession(
      sessionId: string
    ): Promise<{ ok: boolean; revokedCurrent: boolean }>;
    updateIdentityProfile(input: {
      nickname: string;
      bio?: string;
    }): Promise<IdentitySnapshot>;
    updateIdentityAvatar(input: {
      dataUrl: string;
    }): Promise<IdentitySnapshot>;
    updateIdentityPhone(input: {
      phone: string;
      currentPassword: string;
    }): Promise<IdentitySnapshot>;
    requestIdentityEmailChange(input: {
      email: string;
      currentPassword: string;
    }): Promise<RegistrationChallenge>;
    completeIdentityEmailChange(input: {
      challengeId: string;
      code: string;
    }): Promise<IdentitySnapshot>;
    changeIdentityPassword(input: {
      currentPassword: string;
      newPassword: string;
    }): Promise<{ ok: boolean }>;
    getPersonalCenter(): Promise<PersonalCenterSnapshot>;
    getSubmissionCapability(): Promise<SubmissionIpcResult<ResourceSubmissionCapability>>;
    createSubmission(input: {
      idempotencyKey: string;
      submission: ResourceSubmissionProposal;
    }): Promise<SubmissionIpcResult<OwnerSubmission>>;
    listOwnSubmissions(input?: {
      offset?: number;
      limit?: number;
    }): Promise<SubmissionIpcResult<OwnerSubmissionPage>>;
    getOwnSubmission(input: {
      submissionId: string;
    }): Promise<SubmissionIpcResult<OwnerSubmission>>;
    updateSubmissionDraft(input: {
      submissionId: string;
      expectedRevision: number;
      submission: ResourceSubmissionProposal;
    }): Promise<SubmissionIpcResult<OwnerSubmission>>;
    submitSubmission(input: {
      submissionId: string;
      expectedRevision: number;
    }): Promise<SubmissionIpcResult<OwnerSubmission>>;
    addSubmissionEvidence(input: {
      submissionId: string;
      expectedRevision: number;
      evidenceRefs: string[];
    }): Promise<SubmissionIpcResult<OwnerSubmission>>;
    withdrawSubmission(input: {
      submissionId: string;
      expectedRevision: number;
    }): Promise<SubmissionIpcResult<OwnerSubmission>>;
    getWorkflowStoreCapability(): Promise<WorkflowIpcResult<WorkflowStoreCapability>>;
    createWorkflowDraft(input: {
      idempotencyKey: string;
      draft: OwnerWorkflowDraft;
    }): Promise<WorkflowIpcResult<OwnerWorkflow>>;
    listOwnWorkflowDrafts(input?: {
      limit?: number;
      after?: string;
    }): Promise<WorkflowIpcResult<OwnerWorkflowPage>>;
    getOwnWorkflowDraft(input: { workflowId: string }): Promise<WorkflowIpcResult<OwnerWorkflow>>;
    updateWorkflowDraft(input: {
      idempotencyKey: string;
      workflowId: string;
      expectedRevision: number;
      content: OwnerWorkflowContent;
    }): Promise<WorkflowIpcResult<OwnerWorkflow>>;
    submitWorkflowDraft(input: {
      idempotencyKey: string;
      workflowId: string;
      expectedRevision: number;
    }): Promise<WorkflowIpcResult<OwnerWorkflow>>;
    withdrawWorkflowDraft(input: {
      idempotencyKey: string;
      workflowId: string;
      expectedRevision: number;
    }): Promise<WorkflowIpcResult<OwnerWorkflow>>;
    attachWorkflowPost(input: {
      idempotencyKey: string;
      workflowId: string;
      expectedRevision: number;
      version: number;
      communityPostId: string;
    }): Promise<WorkflowIpcResult<{ draft: OwnerWorkflow; postReference: OwnerWorkflow["postReferences"][number] | null }>>;
    detachWorkflowPost(input: {
      idempotencyKey: string;
      workflowId: string;
      expectedRevision: number;
      version: number;
      communityPostId: string;
    }): Promise<WorkflowIpcResult<{ draft: OwnerWorkflow; postReference: OwnerWorkflow["postReferences"][number] | null }>>;
    reportWorkflowRelease(input: {
      idempotencyKey: string;
      workflowId: string;
      version: number;
      reason: string;
    }): Promise<WorkflowIpcResult<{ reportId: string; workflowId: string; version: number; status: string; createdAt: string }>>;
    getWorkflowPublicCapability(): Promise<WorkflowPublicIpcResult<WorkflowPublicCapability>>;
    listPublicWorkflows(input?: {
      limit?: number;
      after?: string;
      riskLevel?: "low" | "guarded";
    }): Promise<WorkflowPublicIpcResult<PublicWorkflowPage>>;
    getPublicWorkflow(input: {
      workflowId: string;
      version: number;
    }): Promise<WorkflowPublicIpcResult<PublicWorkflow>>;
    resolvePublicWorkflow(input: {
      workflowId: string;
      version: number;
    }): Promise<WorkflowPublicIpcResult<PublicWorkflow>>;
    getLocalAgentBridgeCapability(): Promise<LocalAgentBridgeIpcResult<LocalAgentBridgeCapability>>;
    searchLocalAgentBridge(input: {
      kind: LocalAgentBridgeItemKind;
      query: string;
      limit: number;
      visibility?: "public" | "private";
      agentId?: string;
      sessionId?: string;
    }): Promise<LocalAgentBridgeIpcResult<LocalAgentBridgeSearchResult>>;
    getLocalAgentBridge(input: {
      kind: LocalAgentBridgeItemKind;
      id: string;
      version?: number;
      visibility?: "public" | "private";
      agentId?: string;
      sessionId?: string;
    }): Promise<LocalAgentBridgeIpcResult<LocalAgentBridgeGetResult>>;
    planLocalAgentBridge(input: {
      agentId: string;
      sessionId: string;
      agentProductId: string;
      workflowId: string;
      version: number;
      useId: string;
    }): Promise<LocalAgentBridgeIpcResult<LocalAgentBridgePlanResult>>;
    requestLocalAgentBridge(input: {
      agentId: string;
      sessionId: string;
      planId: string;
      capabilityKey: string;
      useId: string;
    }): Promise<LocalAgentBridgeIpcResult<LocalAgentBridgeRequestResult>>;
    planFixedCliLifecycle(input: {
      productId: string;
      operation: "install" | "update" | "repair" | "uninstall";
      useId: string;
    }): Promise<FixedCliLifecycleResult<FixedCliLifecyclePlan>>;
    confirmFixedCliLifecycle(input: {
      planId: string;
      useId: string;
      confirmationId: string;
    }): Promise<FixedCliLifecycleResult<FixedCliLifecycleConfirmation>>;
    applyFixedCliLifecycle(input: {
      planId: string;
      useId: string;
      confirmationId: string;
      dryRun: boolean;
    }): Promise<FixedCliLifecycleResult<FixedCliLifecycleApplyResult>>;
    getFixedCliLifecycleStatus(input: {
      productId: string;
    }): Promise<FixedCliLifecycleResult<FixedCliLifecycleStatus>>;
    recheckFixedCliLifecycle(input: {
      productId: string;
    }): Promise<FixedCliLifecycleResult<FixedCliLifecycleStatus>>;
    getIdentityUserByUsername(username: string): Promise<PublicIdentityUser>;
    listIdentityFollowers(options?: {
      limit?: number;
      offset?: number;
    }): Promise<IdentityUserPage>;
    listIdentityFollowing(options?: {
      limit?: number;
      offset?: number;
    }): Promise<IdentityUserPage>;
    followIdentityUser(userId: string): Promise<{ ok: boolean }>;
    unfollowIdentityUser(userId: string): Promise<{ ok: boolean }>;
    listDirectConversations(options?: {
      limit?: number;
      offset?: number;
    }): Promise<DirectConversationPage>;
    listDirectMessages(
      peerUserId: string,
      options?: { limit?: number; before?: string }
    ): Promise<DirectMessagePage>;
    sendDirectMessage(
      peerUserId: string,
      input: { body: string }
    ): Promise<DirectMessage>;
    markDirectMessagesRead(
      peerUserId: string,
      throughMessageId: string
    ): Promise<{ ok: boolean }>;
    markPersonalCenterNotificationRead(
      source: "account" | "community",
      notificationId: string
    ): Promise<{ ok: boolean; readAt?: string }>;
    listSiteMessages(): Promise<SiteMessage[]>;
    markSiteMessageRead(
      messageId: string
    ): Promise<{ ok: boolean; readAt: string }>;
    listCommunityInteractions(): Promise<CommunityInteraction[]>;
    setCommunityInteraction(
      discussionId: string,
      input: {
        title: string;
        path: string;
        favorited: boolean;
        liked: boolean;
      }
    ): Promise<CommunityInteraction>;
    createCommunityEmbedSession(): Promise<CommunityEmbedSessionResult>;
    getSettings(): Promise<PCSettings>;
    setLanguage(language: "zh" | "en"): Promise<PCSettings>;
    chooseDownloadDirectory(): Promise<PCSettings>;
    chooseCliDirectory(): Promise<PCSettings>;
    openCliDirectory(): Promise<boolean>;
    openDownloadDirectory(): Promise<boolean>;
    openWindowsUninstallSettings(): Promise<boolean>;
    clearDownloadDirectory(): Promise<PCSettings>;
    scanEnvironment(): Promise<EnvironmentReport>;
    openEnvironmentLocation(environmentId: string): Promise<boolean>;
    installEnvironment(environmentId: string): Promise<EnvironmentInstallResult>;
    updateEnvironment(environmentId: string): Promise<EnvironmentInstallResult>;
    getEnvironmentPackage(
      environmentId: string
    ): Promise<EnvironmentPackageSnapshot | null>;
    openEnvironmentInstaller(
      environmentId: string
    ): Promise<EnvironmentInstallerOpenResult>;
    openEnvironmentUpdater(
      environmentId: string
    ): Promise<EnvironmentInstallerOpenResult>;
    getEnvironmentOperation(
      environmentId: string
    ): Promise<EnvironmentOperationTask | null>;
    checkEnvironmentOperation(
      environmentId: string,
      generation: number,
      operationId: string
    ): Promise<EnvironmentOperationTask | null>;
    uninstallEnvironment(
      environmentId: string
    ): Promise<EnvironmentUninstallResult>;
    startDownload(productId: string, artifact?: { url: string; fileName: string; artifactKind?: "exe" | "msi" | "msix" | "zip"; mirrors?: string[] }): Promise<DownloadTaskCommandResult>;
    refreshDownload(productId: string, artifact?: { url: string; fileName: string; artifactKind?: "exe" | "msi" | "msix" | "zip"; mirrors?: string[] }): Promise<DownloadTaskCommandResult>;
    pauseDownload(productId: string): Promise<DownloadTaskCommandResult>;
    cancelDownload(input: { productId: string; taskId: string; confirmed: true }): Promise<DownloadTaskCommandResult>;
    enqueueManagedDownload(input: {
      productId: string;
      artifact?: { url: string; fileName: string; artifactKind?: "exe" | "msi" | "msix" | "zip"; mirrors?: string[] };
    }): Promise<ManagedDownloadQueueCommandResult>;
    discoverDownloadedPackages(input: Array<{
      productId: string;
      artifact?: { url: string; fileName: string; artifactKind?: "exe" | "msi" | "msix" | "zip"; mirrors?: string[] };
    }>): Promise<ManagedDownloadQueueTask[]>;
    listManagedDownloadTasks(): Promise<ManagedDownloadQueueTask[]>;
    getManagedDownloadTaskStatus(input: { productId: string }): Promise<ManagedDownloadQueueCommandResult>;
    cancelManagedDownload(input: { productId: string; taskId: string; confirmed: true }): Promise<ManagedDownloadQueueCommandResult>;
    retryManagedDownload(input: {
      productId: string;
      artifact?: { url: string; fileName: string; artifactKind?: "exe" | "msi" | "msix" | "zip"; mirrors?: string[] };
    }): Promise<ManagedDownloadQueueCommandResult>;
    getDownloadTask(productId: string): Promise<ManagedDownloadTask | null>;
    getPartialDownload(
      productId: string
    ): Promise<PartialDownloadRecord | null>;
    getDownloadRecord(productId: string): Promise<DownloadRecord | null>;
    showDownloadInFolder(
      productId: string
    ): Promise<DownloadTaskCommandResult>;
    clearDownloadHistory(
      productId: string
    ): Promise<DownloadTaskCommandResult>;
    clearCompletedDownloads(): Promise<ClearCompletedDownloadsResult>;
    deleteDownloadedPackage(
      productId: string
    ): Promise<DownloadTaskCommandResult>;
    launchInstaller(
      productId: string,
      intent: "install" | "reinstall" | "refresh"
    ): Promise<InstallerLaunchResult>;
    getDesktopOperation(
      productId: string
    ): Promise<DesktopOperationTask | null>;
    checkDesktopOperation(
      productId: string,
      generation: number,
      operationId: string
    ): Promise<DesktopOperationTask | null>;
    getDesktopStatus(productId: string): Promise<DesktopStatus>;
    updateDesktopProduct(productId: string): Promise<{
      ok: boolean;
      canceled?: boolean;
      launched?: boolean;
      busy?: boolean;
      status?: DesktopStatus;
      operationTask?: DesktopOperationTask | null;
      warning?: string;
      error?: string;
    }>;
    uninstallDesktopProduct(
      productId: string
    ): Promise<DesktopUninstallResult>;
    openDesktopApp(productId: string): Promise<boolean>;
    openDesktopLocation(productId: string): Promise<boolean>;
    closeDesktopApp(
      productId: string
    ): Promise<{ ok: boolean; closed?: boolean; error?: string }>;
    openEnvironment(environmentId: string): Promise<boolean>;
    closeEnvironment(
      environmentId: string
    ): Promise<{ ok: boolean; closed?: boolean; error?: string }>;
    getCliStatus(productId: string): Promise<CliStatus>;
    openCli(
      productId: string
    ): Promise<{ ok: boolean; error?: string }>;
    openCliLocation(productId: string): Promise<boolean>;
    deployCli(productId: string): Promise<CliDeployResult>;
    reconcileCli(
      productId: string,
      intent: "install" | "update" | "repair"
    ): Promise<CliDeployResult>;
    uninstallCli(productId: string): Promise<CliUninstallResult>;
    notifyCliTask(payload: CliTaskNotification): Promise<boolean>;
    updateCliTrayTask(payload: CliTrayTask): Promise<boolean>;
    onDownloadProgress(
      callback: (progress: DownloadProgress) => void
    ): () => void;
    onDownloadTask(
      callback: (task: ManagedDownloadTask) => void
    ): () => void;
    onEnvironmentOperation(
      callback: (task: EnvironmentOperationTask) => void
    ): () => void;
    onDesktopOperation(
      callback: (task: DesktopOperationTask) => void
    ): () => void;
    onCliLog(callback: (entry: CliLogEntry) => void): () => void;
    onTaskNotificationOpen(
      callback: (target: TaskNotificationTarget) => void
    ): () => void;
  };
}
