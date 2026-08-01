/// <reference types="vite/client" />

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
  detection?: "installed" | "absent" | "unknown";
};

type EnvironmentReport = {
  platform: string;
  architecture: string;
  checkedAt: string;
  checks: EnvironmentCheck[];
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

type InstallerInspection = {
  ok: boolean;
  sha256?: string;
  signatureStatus?: string;
  signer?: string;
  architecture?: string;
  productName?: string;
  filePath?: string;
  error?: string;
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
    | "installer-owned-maintenance";
  warning?: string;
  error?: string;
};

type DesktopStatus = {
  installed: boolean;
  version: string;
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
};

type CatalogBrand = {
  name: string;
  mark: string;
  slogan: string;
};

type CatalogExtraSection = {
  id: string;
  title: string;
  description: string;
  url: string;
  enabled: boolean;
};

type CatalogCommunity = {
  title: string;
  description: string;
  provider: string;
  url: string;
  enabled: boolean;
};

type RemoteCatalog = {
  schemaVersion: 1;
  updatedAt?: string;
  categories?: import("./data").ProductCategory[];
  brand?: CatalogBrand;
  extraSections?: CatalogExtraSection[];
  community?: CatalogCommunity;
  home?: {
    banners: CatalogBanner[];
    featuredVendorIds: string[];
  };
  vendors: import("./data").Vendor[];
};

type ClientInstallProfile = {
  id: string;
  label: string;
  moduleId: string;
  productId: string;
  vendorId: string;
  productType: string;
  kind: string;
  mode: "managed-installer" | "managed-cli";
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
  summary: {
    unreadNotifications: number;
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
  directory: string;
  detection: "installed" | "absent" | "unknown";
  managed: boolean;
  canUninstall: boolean;
  ownership: "managed" | "adopted" | "external" | "mismatch" | "stale" | "none" | "unknown";
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
  operation: "deploy" | "uninstall";
  outcome: "completed" | "failed";
};

type CliTrayTask = {
  productId: string;
  generation: number;
  operation: "deploy" | "uninstall";
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
    | "installed"
    | "invalid-receipt"
    | "unavailable"
    | "error";
  managed: boolean;
  error?: string;
};

interface Window {
  aihubPC?: {
    getCatalog(): Promise<CatalogResult>;
    scanManagedInventory(): Promise<ManagedProductInventorySnapshot>;
    checkForUpdate(): Promise<UpdateCheckResult>;
    openUpdateDownload(): Promise<UpdateInstallResult>;
    getExtensionStatus(profileId: string): Promise<ExtensionRuntimeResult>;
    installExtension(profileId: string): Promise<ExtensionRuntimeResult>;
    uninstallExtension(profileId: string): Promise<ExtensionRuntimeResult>;
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
    }): Promise<IdentitySnapshot>;
    logout(): Promise<IdentitySnapshot>;
    listIdentitySessions(): Promise<IdentityDeviceSession[]>;
    revokeIdentitySession(
      sessionId: string
    ): Promise<{ ok: boolean; revokedCurrent: boolean }>;
    updateIdentityProfile(input: {
      nickname: string;
      avatarUrl?: string;
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
    createCommunityEmbedSession(): Promise<CommunityEmbedSession>;
    getSettings(): Promise<PCSettings>;
    setLanguage(language: "zh" | "en"): Promise<PCSettings>;
    chooseDownloadDirectory(): Promise<PCSettings>;
    chooseCliDirectory(): Promise<PCSettings>;
    openDownloadDirectory(): Promise<boolean>;
    clearDownloadDirectory(): Promise<PCSettings>;
    scanEnvironment(): Promise<EnvironmentReport>;
    openEnvironmentLocation(environmentId: string): Promise<boolean>;
    installEnvironment(environmentId: string): Promise<EnvironmentInstallResult>;
    getEnvironmentPackage(
      environmentId: string
    ): Promise<EnvironmentPackageSnapshot | null>;
    openEnvironmentInstaller(
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
    startDownload(productId: string): Promise<DownloadTaskCommandResult>;
    refreshDownload(productId: string): Promise<DownloadTaskCommandResult>;
    pauseDownload(productId: string): Promise<DownloadTaskCommandResult>;
    cancelDownload(productId: string): Promise<DownloadTaskCommandResult>;
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
    inspectInstaller(productId: string): Promise<InstallerInspection>;
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
