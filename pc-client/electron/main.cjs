const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  Notification,
  safeStorage,
  session,
  shell,
  Tray
} = require("electron");
const { execFile, spawn } = require("node:child_process");
const crypto = require("node:crypto");
const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { BRAND } = require("../shared/brand.cjs");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { pathToFileURL } = require("node:url");
const { promisify } = require("node:util");

// Keep existing accounts, receipts, downloads and settings across the public
// brand rename. Explicit test/user-data overrides still take precedence.
if (!app.commandLine.hasSwitch("user-data-dir")) {
  app.setPath(
    "userData",
    path.join(app.getPath("appData"), BRAND.legacyUserDataDirectory)
  );
}

const {
  isAllowedUrl
} = require("../shared/catalog.cjs");
const {
  CATALOG_RELEASE_MAX_BYTES,
  verifyCatalogRelease,
  verifyCatalogReleaseCache
} = require("../shared/catalog-release.cjs");
const {
  resolvePackagedCatalogFallback
} = require("../shared/catalog-runtime-policy.cjs");
const {
  catalogChannelStorage,
  normalizeCatalogHighWater,
  readCatalogClientChannel,
  recordCatalogHighWater
} = require("../shared/catalog-client-channel.cjs");
const {
  resolveCatalogIconUrls
} = require("../shared/catalog-icon-runtime.cjs");
const {
  authorizeFreshCatalogProduct,
  authorizeFreshDesktopDownloadOnlyProduct,
  runFreshCatalogAuthorizedOperation
} = require("../shared/managed-catalog-install-authorization.cjs");
const {
  clientIdToDeviceId,
  readOrCreateClientId
} = require("../shared/client-identity.cjs");
const {
  cliInstallPlans,
  INSTALL_REGISTRY,
  getInstallRegistration,
  getProductIntakeDossier,
  publicInstallProfiles
} = require("../shared/install-registry.cjs");
const {
  cliDeployOnlyPlans,
  createCliDeployOnlyReceipt,
  publicCliDeployOnlyProfiles
} = require("../shared/cli-deploy-only.cjs");
const {
  desktopProbes,
  getDesktopAdapterForProduct
} = require("../shared/desktop-adapters.cjs");
const {
  createManagedCliTerminalAction
} = require("../shared/cli-terminal.cjs");
const {
  bindRegistryEvidenceToAuthenticode,
  matchesDesktopIdentity,
  resolveDesktopLegacyMigration,
  resolveDesktopPresence,
  signatureInspectionIsConclusive,
  selectTrustedDesktopRegistryMatch
} = require("../shared/desktop-detection.cjs");
const {
  selectCompatibleNodeRuntime
} = require("../shared/node-runtime-policy.cjs");
const {
  buildDesktopUninstallConfirmation,
  getDesktopUninstallPresentation
} = require("../shared/uninstall-presentation.cjs");
const {
  buildDesktopInstallConfirmation,
  getDesktopInstallConfirmationAction
} = require("../shared/product-install-presentation.cjs");
const {
  MICROSOFT_STORE_SUPPORT_URL,
  MICROSOFT_STORE_WEB_URL,
  analyzeMicrosoftStoreHealth,
  buildMicrosoftStoreRepairDialog,
  microsoftStoreRepairSettingsUri
} = require("../shared/microsoft-store-repair.cjs");
const {
  getManagedDownload: getStaticManagedDownload,
  isAllowedManagedDownloadUrl
} = require("../shared/managed-downloads.cjs");
const {
  discoverManagedPackages,
  reviewedManagedPackagePlan
} = require("../shared/managed-package-inventory.cjs");
const {
  buildDesktopDownloadOnlyPlan,
  desktopDownloadOnlyArtifactFromReceipt,
  signedDesktopDownloadArtifactFromReceipt,
  buildSignedDesktopDownloadPlan,
  getDesktopDownloadOnlyProfile,
  SIGNED_CATALOG_PROFILE_ID
} = require("../shared/desktop-download-only.cjs");
const {
  createPortableDesktopLayout,
  createPortableDesktopUninstallAction,
  inspectPortableDesktop,
  portableDesktopPlan,
  portableDesktopTrustForReceipt
} = require("../shared/managed-portable-desktop.cjs");
const {
  cleanupInterruptedPortableFiles,
  uninstallManagedPortableDirectory,
  uninstallManagedPortableFiles
} = require("../shared/managed-portable-files.cjs");
const {
  createPendingBaseline: createManagedRegistryPendingBaseline,
  createReceiptFromTransition: createManagedRegistryReceiptFromTransition,
  inspectReceipt: inspectManagedRegistryReceipt,
  parseManagedRegistryPendingJson,
  parseManagedRegistryReceiptJson
} = require("../shared/managed-registry-desktop.cjs");
const {
  applyDownloadTaskEvent,
  restoreDownloadTask,
  projectManagedDownloadTask,
  authorizeManagedDownloadCancellation,
  validateManagedDownloadCancelRequest
} = require("../shared/download-task.cjs");
const {
  planManagedDownloadTaskRecovery
} = require("../shared/download-task-recovery.cjs");
const {
  createManagedDownloadTransport,
  isManagedDownloadSourceFallbackError,
  managedDownloadFailure,
  refreshManagedDownloadSession
} = require("../shared/managed-download-network.cjs");
const {
  DEFAULT_CONCURRENCY: MANAGED_DOWNLOAD_CONCURRENCY,
  createManagedDownloadQueue
} = require("../shared/managed-download-queue.cjs");
const {
  runWhenManagedDownloadSlotAvailable
} = require("../shared/managed-download-refresh.cjs");
const {
  cancelSupersededPackageCleanupForProduct,
  commitManagedDownloadReplacement,
  managedDownloadCleanupCapacity,
  recordsMatch,
  retrySupersededPackageCleanup
} = require("../shared/managed-download-replacement.cjs");
const {
  localizeRuntimePayload,
  runtimeText
} = require("../shared/runtime-language.cjs");
const {
  assertDownloadCanFinalize,
  classifyPartialForStart,
  isCurrentDownloadAttempt,
  isReusablePartialEvidence,
  parsePlainObjectJson,
  raiseDownloadIntent,
  removeRecordMetadata,
  selectCleanupFailurePartial
} = require("../shared/managed-download-reliability.cjs");
const {
  launchProcessWithGrace
} = require("../shared/installer-launch.cjs");
const {
  validateWindowsInstallerIdentity
} = require("../shared/windows-installer-identity.cjs");
const {
  windowsPowerShellEnvironment,
  windowsPowerShellPath
} = require("../shared/windows-system-paths.cjs");
const {
  resolveDesktopInstallerLaunchPolicy
} = require("../shared/desktop-installer-launch-policy.cjs");
const {
  applicationCrashMessage,
  normalizeApplicationCrash
} = require("../shared/windows-application-crash.cjs");
const {
  createDesktopOperationController
} = require("../shared/desktop-operation.cjs");
const {
  createOpenClawCompanionAction,
  inspectOpenClawCompanionRuntime,
  parseOpenClawSetupJournal
} = require("../shared/openclaw-companion-runtime.cjs");
const {
  createEnvironmentOperationController
} = require("../shared/environment-operation.cjs");
const {
  isMissingExactRegistryValueQuery
} = require("../shared/environment-registry-query.cjs");
const {
  createEnvironmentUpdatePlan,
  environmentUpdateMemberIds,
  projectEnvironmentFamilyChecks
} = require("../shared/environment-update.cjs");
const {
  createResumeHeaders,
  resolveResumeResponse
} = require("../shared/download-resume.cjs");
const { assessDownloadSpace } = require("../shared/download-space.cjs");
const {
  verifyAndEvaluateUpdateRelease
} = require("../shared/update-release.cjs");
const {
  isSoftwareUpdatePublished,
  normalizeSoftwareUpdateHighWater,
  recordSoftwareUpdateHighWater,
  verifySoftwareUpdateRelease
} = require("../shared/software-update-release.cjs");
const {
  planUpdateInstallerDownload,
  verifyUpdateInstallerDownload
} = require("../shared/update-installer.cjs");
const {
  readReleaseChannel
} = require("../shared/release-channel.cjs");
const {
  readResponseTextWithLimit
} = require("../shared/limited-response.cjs");
const {
  resolveReleaseResponseUrl
} = require("../shared/release-response.cjs");
const {
  environmentIdFromManagedDownload,
  getEnvironmentDownloadPlan,
  getEnvironmentManagedDownloadPlan,
  selectReachableSource
} = require("../shared/environment-download.cjs");
const {
  resolveEnvironmentEvidence,
  resolveEnvironmentOperationStatus,
  resolveEnvironmentUpdateOffer,
  resolveRegisteredEnvironmentExecutable,
  resolveTrustedEnvironmentExecutableProbe
} = require("../shared/environment-detection.cjs");
const {
  createEnvironmentOpenAction
} = require("../shared/environment-launch.cjs");
const {
  findTrustedProductExecutable,
  findTrustedUninstallRecord,
  pathIsInside,
  registryInstallLocation
} = require("../shared/windows-uninstall.cjs");
const {
  closeReviewedProcesses: closeReviewedProcessSet
} = require("../shared/reviewed-process-close.cjs");
const {
  createAppxUninstallAction,
  trustedAppxPackage
} = require("../shared/windows-appx.cjs");
const {
  computeNpmTreeSha256,
  createManagedCliBeforeUninstallAction,
  createManagedCliInstallAction,
  createManagedCliReconcileAction,
  createManagedCliPostInstallAction,
  createManagedCliReceipt,
  createManagedCliTransactionRollbackAction,
  createManagedCliUninstallAction,
  inspectManagedCli
} = require("../shared/managed-cli.cjs");
const {
  applyManagedCliSettings
} = require("../shared/managed-cli-settings.cjs");
const {
  artifactFor,
  createManagedBinaryLayout,
  createManagedBinaryReceipt,
  createManagedBinaryTerminalAction,
  createManagedBinaryUninstallAction,
  inspectManagedBinaryCli
} = require("../shared/managed-binary-cli.cjs");
const {
  createManagedCliLifecycleCandidate,
  createPortableBinaryLifecycleExecutor,
  receiptOwnsPortableBinaryPlan
} = require("../shared/managed-cli-lifecycle-candidate.cjs");
const {
  FIXED_PORTABLE_BINARY_PRODUCT_IDS,
  createManagedCliLifecycleIpcFacade,
  registerManagedCliLifecycleIpc
} = require("./managed-cli-lifecycle-ipc.cjs");
const {
  inspectExtractedTree,
  validateZipEntries
} = require("../shared/safe-zip-extraction.cjs");
const {
  createManagedPythonLayout,
  createManagedPythonReceipt,
  createManagedPythonTerminalAction,
  createManagedPythonUninstallAction,
  createPythonPipInstallAction,
  createPythonVenvAction,
  inspectManagedPythonCli
} = require("../shared/managed-python-cli.cjs");
const {
  createManagedMsiCliLayout,
  createManagedMsiCliReceipt,
  createManagedMsiTerminalAction,
  createManagedMsiUninstallAction,
  inspectManagedMsiCli,
  matchesManagedMsiReceipt
} = require("../shared/managed-msi-cli.cjs");
const {
  createManagedWslBootstrapAction,
  createManagedWslDeployAction,
  createManagedWslDistributionAction,
  createManagedWslInstallPreflightAction,
  createManagedWslOpenAction,
  createManagedWslProbeAction,
  createManagedWslRepairAction,
  createManagedWslRepairProbeAction,
  createManagedWslReceipt,
  createManagedWslUpdateAction,
  createManagedWslUninstallActions,
  inspectManagedWslCli,
  managedWslReceiptMatchesPlan,
  managedWslReceiptOwnsPrefix,
  managedWslArtifact
} = require("../shared/managed-wsl-cli.cjs");
const {
  buildWslEnvironmentDefinitions,
  createWslEnvironmentProbeAction,
  createWslPlatformUninstallAction,
  parseWslEnvironmentProbe,
  wslPlatformManagementStatus
} = require("../shared/wsl-environment-management.cjs");
const {
  inferNpmPrefixFromCommandPath
} = require("../shared/cli-system-discovery.cjs");
const {
  CLI_RECONCILE_INTENTS,
  createCliDriverRegistry
} = require("../shared/cli-driver-registry.cjs");
const {
  scanManagedDesktopInventory
} = require("../shared/managed-product-inventory.cjs");
const {
  resolveManagedProductActionContext,
  isFixedCatalogDesktopDownloadOnlyProduct,
  isSignedCatalogDesktopDownloadOnlyProduct
} = require("../shared/managed-product-action-context.cjs");
const {
  getWindowsPackageManagerProduct
} = require("../shared/windows-package-manager-catalog.cjs");
const {
  createWindowsPackageManagerReceipt,
  findWingetListEntry,
  parseWindowsPackageManagerReceiptJson,
  windowsPackageManagerReceiptMatches,
  wingetArgsFor,
  wingetListAllArgs
} = require("../shared/windows-package-manager.cjs");
const {
  normalizeCliTrayTask,
  normalizeCliTaskNotification,
  rememberNotificationKey
} = require("../shared/task-notification.cjs");
const {
  shouldHideWindowOnClose,
  shouldKeepAppAlive
} = require("../shared/tray-lifecycle.cjs");
const {
  approvedCommunityOrigin,
  communityEmbedSessionFailure,
  isApprovedCommunityNavigation,
  validateCommunityLaunchUrl
} = require("../shared/community-embed.cjs");
const {
  resolveClientServices
} = require("../shared/client-services.cjs");
const {
  createIdentityClient
} = require("./identity-client.cjs");
const {
  registerIdentityLoginIpc
} = require("./identity-login-ipc.cjs");
const {
  registerResourceSubmissionIpc
} = require("./resource-submission-ipc.cjs");
const {
  registerWorkflowStoreIpc
} = require("./workflow-store-ipc.cjs");
const {
  registerLocalAgentBridgeIpc
} = require("./local-agent-bridge-ipc.cjs");
const {
  clearCommunitySessionCookies
} = require("./community-session.cjs");
const {
  resolveCertificateVerificationCode,
  readLocalReleaseTrust,
  shouldTrustLocalReleaseCertificate
} = require("../shared/local-release-trust.cjs");
const {
  createExtensionRuntime
} = require("../shared/extension-runtime.cjs");
const {
  createCodexMcpRuntime
} = require("../shared/extension-mcp-runtime.cjs");
const {
  createClaudeCodeMcpRuntime
} = require("../shared/extension-claude-mcp-runtime.cjs");
const {
  createCursorMcpRuntime
} = require("../shared/extension-cursor-mcp-runtime.cjs");
const {
  createClaudePluginRuntime
} = require("../shared/extension-plugin-runtime.cjs");
const {
  createExtensionResourceManager
} = require("../shared/extension-resource-manager.cjs");
const {
  createExtensionIpcFacade
} = require("../shared/extension-ipc.cjs");
const {
  resolveCodexConfigPath,
  resolveCodexSkillsRoot,
  resolveCursorMcpConfigPath
} = require("../shared/extension-host-targets.cjs");
const {
  findTrustedExternalExtensionCliHost
} = require("../shared/extension-host-discovery.cjs");
const {
  getExtensionRuntimeProfile,
  publicExtensionInstallProfiles
} = require("../shared/extension-install-registry.cjs");
const {
  authorizeFreshCatalogResource
} = require("../shared/managed-catalog-resource-authorization.cjs");

const PACKAGE_METADATA = require("../package.json");
const LOCAL_RELEASE_ACCEPTANCE =
  PACKAGE_METADATA.localReleaseAcceptance === true;
const UPGRADE_FIXTURE = PACKAGE_METADATA.upgradeFixture === true;

const execFileAsync = promisify(execFile);
const POWERSHELL_UTF8_OUTPUT =
  "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)";
const activeCliProducts = new Set();
const activeCliPrefixes = new Set();
const discoveredCliPrefixes = new Map();
const managedWslStatusCache = new Map();
const activeDownloads = new Map();
let managedDownloadQueue = null;
let managedPackageDiscoveryInFlight = null;
const signedDesktopDownloadPlans = new Map();
let managedDownloadRefreshPending = false;
const activeDesktopOperationEntries = new Set();
let windowsPackageManagerExecutablePromise = null;
let desktopOperationController = null;
let environmentOperationController = null;
const managedDownloadTasks = new Map();
const downloadTaskLastPersistedAt = new Map();
const downloadTaskLastEmittedAt = new Map();
let managedDownloadTasksLoaded = false;
const activeEnvironmentDownloads = new Set();
const trustedSignatureCache = new Map();
const shownTaskNotifications = new Map();
const activeTaskNotifications = new Set();
const trayTaskStates = new Map();
let tray = null;
let isQuitting = false;
let lastVerifiedUpdateOffer = null;
let lastVerifiedSoftwareUpdateRelease = null;
let identityClientInstance = null;
let clientServicesInstance = null;
let extensionIpcFacade = createExtensionIpcFacade(null);
let updateCheckGeneration = 0;
let softwareUpdateCheckGeneration = 0;
let activeEnvironmentSourcePreferences;
let managedDownloadTransportInstance = null;
const DOWNLOAD_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZhenXing-AI/0.1";
const ENVIRONMENT_PLANS = Object.freeze({
  node: {
    name: "Node.js",
    command: "node.exe",
    officialUrl: "https://nodejs.org/en/download",
    displayName: /^Node\.js$/i,
    registryPublisher: /^(?:OpenJS Foundation|Node\.js Foundation)$/i,
    openMode: "terminal",
    installedSigner:
      /^CN=(?:OpenJS Foundation|Node\.js Foundation)(?:,|$)/i
  },
  git: {
    name: "Git",
    command: "git.exe",
    officialUrl: "https://git-scm.com/download/win",
    displayName: /^Git(?: version .+)?$/i,
    registryPublisher: /^The Git Development Community$/i,
    openMode: "terminal",
    installedSigner: /^CN=Johannes Schindelin(?:,|$)/i
  },
  python: {
    name: "Python 3.13",
    command: "python.exe",
    officialUrl: "https://www.python.org/downloads/windows/",
    displayName: /^Python 3\.13(?:\.\d+)? \(64-bit\)$/i,
    registryPublisher: /^Python Software Foundation$/i,
    openMode: "terminal",
    installedSigner: /^CN=Python Software Foundation(?:,|$)/i,
    pythonMinor: 13
  },
  python312: {
    name: "Python 3.12",
    command: "python.exe",
    officialUrl: "https://www.python.org/downloads/windows/",
    displayName: /^Python 3\.12(?:\.\d+)? \(64-bit\)$/i,
    registryPublisher: /^Python Software Foundation$/i,
    openMode: "terminal",
    installedSigner: /^CN=Python Software Foundation(?:,|$)/i,
    pythonMinor: 12
  },
  docker: {
    name: "Docker",
    command: "docker.exe",
    officialUrl: "https://www.docker.com/products/docker-desktop/",
    displayName: /^Docker Desktop$/i,
    registryPublisher: /^Docker Inc\.?$/i,
    openMode: "application",
    installedSigner: /^CN=Docker Inc(?:,|$)/i
  },
  wsl: {
    name: "Windows Subsystem for Linux",
    command: "wsl.exe",
    officialUrl: "https://learn.microsoft.com/windows/wsl/install",
    displayName: /^(?:Windows Subsystem for Linux|适用于 Linux 的 Windows 子系统)$/i,
    registryPublisher: /^Microsoft Corporation$/i,
    openMode: "terminal",
    installedSigner: /^CN=Microsoft Windows(?:,|$)/i,
    nativeWindowsFeature: true
  }
});
const ENVIRONMENT_UNINSTALL_POLICIES = Object.freeze({
  node: {
    displayName: ENVIRONMENT_PLANS.node.displayName,
    publisher: ENVIRONMENT_PLANS.node.registryPublisher,
    allowMsi: true,
    machineMsiOnly: true
  },
  git: {
    displayName: ENVIRONMENT_PLANS.git.displayName,
    publisher: ENVIRONMENT_PLANS.git.registryPublisher,
    executableName: /^unins\d+\.exe$/i,
    allowedArguments: [[]],
    launchWithoutArguments: true,
    allowMsi: false,
    signer: ENVIRONMENT_PLANS.git.installedSigner
  },
  python: {
    displayName: ENVIRONMENT_PLANS.python.displayName,
    publisher: ENVIRONMENT_PLANS.python.registryPublisher,
    executableName:
      /^python-\d+(?:\.\d+){1,2}-(?:amd64|arm64|win32)\.exe$/i,
    allowedArguments: [["/uninstall"]],
    allowMsi: false,
    signer: ENVIRONMENT_PLANS.python.installedSigner
  },
  python312: {
    displayName: ENVIRONMENT_PLANS.python312.displayName,
    publisher: ENVIRONMENT_PLANS.python312.registryPublisher,
    executableName:
      /^python-3\.12(?:\.\d+)?-(?:amd64|arm64|win32)\.exe$/i,
    allowedArguments: [["/uninstall"]],
    allowMsi: false,
    signer: ENVIRONMENT_PLANS.python312.installedSigner
  },
  docker: {
    displayName: ENVIRONMENT_PLANS.docker.displayName,
    publisher: ENVIRONMENT_PLANS.docker.registryPublisher,
    executableName: /^Docker Desktop Installer\.exe$/i,
    allowedArguments: [["uninstall"]],
    allowMsi: false,
    signer: ENVIRONMENT_PLANS.docker.installedSigner
  }
});
const ENVIRONMENT_CLOSE_PROCESSES = Object.freeze({
  docker: Object.freeze(["Docker Desktop.exe"])
});

function getEnvironmentPlan(environmentId) {
  return typeof environmentId === "string" &&
    environmentId.length > 0 &&
    environmentId.length <= 32 &&
    Object.hasOwn(ENVIRONMENT_PLANS, environmentId)
    ? ENVIRONMENT_PLANS[environmentId]
    : null;
}

function resolveManagedDownloadPlan(productId, preferredSourceUrl = "", artifact = null) {
  const signedPlan = signedDesktopDownloadPlans.get(productId);
  if (signedPlan) {
    const sources = Array.isArray(signedPlan.sources) ? signedPlan.sources : [];
    const source = sources.find((candidate) =>
      candidate.url === (preferredSourceUrl || signedPlan.url)
    );
    return source ? {
      ...signedPlan,
      url: source.url,
      allowedHosts: [...source.allowedHosts],
      sourceLabel: source.label || "official"
    } : null;
  }
  const staticPlan = getStaticManagedDownload(productId);
  if (staticPlan) {
    const partialRecord = readPartialDownloadRecords()[productId];
    const completedRecord = readDownloadRecords()[productId];
    const persistedSourceUrl =
      typeof partialRecord?.url === "string" && partialRecord.url
        ? partialRecord.url
        : typeof completedRecord?.url === "string"
          ? completedRecord.url
          : "";
    const sources = [
      {
        url: staticPlan.url,
        allowedHosts: staticPlan.allowedHosts,
        label: "官方源"
      },
      ...(Array.isArray(staticPlan.mirrors) ? staticPlan.mirrors : [])
    ];
    const requestedSourceUrl =
      preferredSourceUrl ||
      (sources.some((source) => source.url === persistedSourceUrl)
        ? persistedSourceUrl
        : staticPlan.url);
    const source = sources.find(
      (candidate) => candidate.url === requestedSourceUrl
    );
    if (!source) return null;
    return {
      ...staticPlan,
      url: source.url,
      allowedHosts: [...source.allowedHosts],
      productId,
      environmentId: "",
      sourceLabel: source.label || "镜像源",
      managedProductId: productId,
      sources
    };
  }
  if (getDesktopDownloadOnlyProfile(productId)) {
    const persisted =
      desktopDownloadOnlyArtifactFromReceipt(
        productId,
        readPartialDownloadRecords()[productId]
      ) ||
      desktopDownloadOnlyArtifactFromReceipt(
        productId,
        readDownloadRecords()[productId]
      );
    const plan = buildDesktopDownloadOnlyPlan(productId, artifact || persisted);
    return plan ? { ...plan, managedProductId: productId, sources: [{ url: plan.url, allowedHosts: plan.allowedHosts, label: "official" }] } : null;
  }
  const signedArtifact =
    signedDesktopDownloadArtifactFromReceipt(readPartialDownloadRecords()[productId]) ||
    signedDesktopDownloadArtifactFromReceipt(readDownloadRecords()[productId]);
  if (signedArtifact) return buildSignedDesktopDownloadPlan(productId, signedArtifact);
  if (!environmentIdFromManagedDownload(productId)) return null;
  const partialRecord = readPartialDownloadRecords()[productId];
  const completedRecord = readDownloadRecords()[productId];
  const persistedSourceUrl =
    typeof partialRecord?.url === "string" && partialRecord.url
      ? partialRecord.url
      : typeof completedRecord?.url === "string"
        ? completedRecord.url
        : "";
  return getEnvironmentManagedDownloadPlan(productId, {
    preferredSourceUrl,
    persistedSourceUrl,
    sourcePreferences: activeEnvironmentSourcePreferences
  });
}

function nextManagedDownloadPlan(plan) {
  if (!plan) return null;
  if (!plan.environmentId) {
    const sources = Array.isArray(plan.sources) ? plan.sources : [];
    const currentIndex = sources.findIndex((source) => source.url === plan.url);
    const nextSource = sources[currentIndex + 1];
    if (plan.downloadPolicy === "desktop-download-only" && nextSource) {
      return {
        ...plan,
        url: nextSource.url,
        allowedHosts: [...nextSource.allowedHosts],
        sourceLabel: nextSource.label || "mirror"
      };
    }
    return nextSource
      ? resolveManagedDownloadPlan(plan.productId, nextSource.url)
      : null;
  }
  const downloadPlan = getEnvironmentDownloadPlan(
    plan.environmentId,
    activeEnvironmentSourcePreferences
  );
  const currentIndex = downloadPlan.sources.findIndex(
    (source) => source.url === plan.url
  );
  const nextSource = downloadPlan.sources[currentIndex + 1];
  return nextSource
    ? getEnvironmentManagedDownloadPlan(plan.productId, {
        preferredSourceUrl: nextSource.url,
        sourcePreferences: activeEnvironmentSourcePreferences
      })
    : null;
}

const CLI_INSTALL_PLANS = Object.freeze({ ...cliInstallPlans(), ...cliDeployOnlyPlans() });
const CLIENT_INSTALL_PROFILES = Object.freeze([
  ...publicInstallProfiles(),
  ...publicCliDeployOnlyProfiles()
]);

function createPortableBinaryReceipt(options) {
  return options.plan?.deployOnlyProfileId
    ? createCliDeployOnlyReceipt(options)
    : createManagedBinaryReceipt(options);
}
const DESKTOP_PROBES = desktopProbes();

function managedRegistryDesktopContext(productId) {
  const registration = getInstallRegistration(productId);
  const adapter = getDesktopAdapterForProduct(productId);
  const dossier = getProductIntakeDossier(productId);
  if (
    adapter?.ownershipPolicy !== "post-install-registry-receipt" ||
    !registration?.desktopAdapterId ||
    !dossier?.executionContractSha256
  ) {
    return null;
  }
  return {
    productId,
    adapterId: registration.desktopAdapterId,
    executionContractSha256: dossier.executionContractSha256,
    adapter
  };
}

function configPath() {
  return path.join(app.getPath("userData"), "pc-settings.json");
}

function downloadRecordsPath() {
  return path.join(app.getPath("userData"), "download-records.json");
}

function partialDownloadRecordsPath() {
  return path.join(app.getPath("userData"), "partial-download-records.json");
}

function managedDownloadTasksPath() {
  return path.join(app.getPath("userData"), "managed-download-tasks.json");
}

function desktopOperationRecordsPath() {
  return path.join(
    app.getPath("userData"),
    "desktop-operations.json"
  );
}

function legacyInstallVerificationRecordsPath() {
  return path.join(
    app.getPath("userData"),
    "desktop-install-verifications.json"
  );
}

function environmentDownloadRecordsPath() {
  return path.join(
    app.getPath("userData"),
    "environment-download-records.json"
  );
}

function environmentOperationRecordsPath() {
  return path.join(
    app.getPath("userData"),
    "environment-operations.json"
  );
}

function managedCliRecordsPath() {
  return path.join(app.getPath("userData"), "cli-install-records.json");
}

function portableDesktopRecordsDirectory() {
  return path.join(
    app.getPath("userData"),
    "portable-desktop-install-records"
  );
}

function managedRegistryDesktopRecordsDirectory() {
  return path.join(
    app.getPath("userData"),
    "registry-desktop-install-records"
  );
}

function managedRegistryDesktopPendingDirectory() {
  return path.join(
    app.getPath("userData"),
    "registry-desktop-install-pending"
  );
}

function windowsPackageManagerRecordsDirectory() {
  return path.join(
    app.getPath("userData"),
    "windows-package-manager-install-records"
  );
}

function windowsPackageManagerRecordPath(productId) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(String(productId || ""))) {
    throw new Error("软件包产品 ID 无效");
  }
  return path.join(windowsPackageManagerRecordsDirectory(), `${productId}.json`);
}

function readWindowsPackageManagerRecord(productId) {
  try {
    return parseWindowsPackageManagerReceiptJson(
      fs.readFileSync(windowsPackageManagerRecordPath(productId), "utf8")
    );
  } catch {
    return null;
  }
}

function setWindowsPackageManagerRecord(productId, receipt) {
  writeJsonAtomically(windowsPackageManagerRecordPath(productId), receipt);
}

function removeWindowsPackageManagerRecordStrict(productId) {
  const recordPath = windowsPackageManagerRecordPath(productId);
  if (fs.existsSync(recordPath)) fs.unlinkSync(recordPath);
}

function managedRegistryDesktopStatePath(directory, productId) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(String(productId || ""))) {
    throw new Error("桌面程序产品 ID 无效");
  }
  return path.join(directory, `${productId}.json`);
}

function managedRegistryDesktopReceiptPath(productId) {
  return managedRegistryDesktopStatePath(
    managedRegistryDesktopRecordsDirectory(),
    productId
  );
}

function managedRegistryDesktopPendingPath(productId) {
  return managedRegistryDesktopStatePath(
    managedRegistryDesktopPendingDirectory(),
    productId
  );
}

function readManagedRegistryDesktopReceipt(productId) {
  try {
    return parseManagedRegistryReceiptJson(
      fs.readFileSync(managedRegistryDesktopReceiptPath(productId), "utf8")
    );
  } catch {
    return null;
  }
}

function readManagedRegistryDesktopPending(productId) {
  try {
    return parseManagedRegistryPendingJson(
      fs.readFileSync(managedRegistryDesktopPendingPath(productId), "utf8")
    );
  } catch {
    return null;
  }
}

function setManagedRegistryDesktopReceipt(productId, receipt) {
  writeJsonAtomically(managedRegistryDesktopReceiptPath(productId), receipt);
}

function setManagedRegistryDesktopPending(productId, pending) {
  writeJsonAtomically(managedRegistryDesktopPendingPath(productId), pending);
}

function removeManagedRegistryDesktopStateStrict(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function removeManagedRegistryDesktopReceiptStrict(productId) {
  removeManagedRegistryDesktopStateStrict(
    managedRegistryDesktopReceiptPath(productId)
  );
}

function removeManagedRegistryDesktopPendingStrict(productId) {
  removeManagedRegistryDesktopStateStrict(
    managedRegistryDesktopPendingPath(productId)
  );
}

function portableDesktopRecordPath(productId) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(String(productId || ""))) {
    throw new Error("便携程序产品 ID 无效");
  }
  return path.join(portableDesktopRecordsDirectory(), `${productId}.json`);
}

function readPortableDesktopRecord(productId) {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(portableDesktopRecordPath(productId), "utf8")
    );
  } catch {
    return null;
  }
}

function setPortableDesktopRecord(productId, receipt) {
  writeJsonAtomically(portableDesktopRecordPath(productId), receipt);
}

function removePortableDesktopRecord(productId) {
  try {
    fs.rmSync(portableDesktopRecordPath(productId), { force: true });
  } catch {
    // The exact per-product receipt is the only removal target.
  }
}

function removePortableDesktopRecordStrict(productId) {
  const recordPath = portableDesktopRecordPath(productId);
  if (fs.existsSync(recordPath)) fs.unlinkSync(recordPath);
}

function readManagedCliRecords() {
  try {
    const records = JSON.parse(fs.readFileSync(managedCliRecordsPath(), "utf8"));
    return records && typeof records === "object" && !Array.isArray(records)
      ? records
      : {};
  } catch {
    return {};
  }
}

function writeManagedCliRecords(records) {
  const recordPath = managedCliRecordsPath();
  const temporaryPath = `${recordPath}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(records, null, 2),
    { encoding: "utf8", flag: "w" }
  );
  fs.renameSync(temporaryPath, recordPath);
}

function setManagedCliRecord(productId, receipt) {
  const records = readManagedCliRecords();
  records[productId] = receipt;
  writeManagedCliRecords(records);
}

function removeManagedCliRecord(productId) {
  const records = readManagedCliRecords();
  if (!records[productId]) return;
  delete records[productId];
  writeManagedCliRecords(records);
}

function readDownloadRecords() {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(downloadRecordsPath(), "utf8")
    );
  } catch {
    return {};
  }
}

function writeJsonAtomically(filePath, value) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto
    .randomBytes(6)
    .toString("hex")}`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), {
      encoding: "utf8",
      flag: "wx"
    });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Never broaden cleanup beyond the exact temporary file.
    }
  }
}

function migrateLegacyInstallVerificationRecords(records) {
  const products = {};
  for (const [productId, value] of Object.entries(records || {})) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      typeof value.verificationId !== "string" ||
      !value.verificationId.trim() ||
      !["monitoring", "timed-out"].includes(value.phase)
    ) {
      continue;
    }
    const attempts = Number.isSafeInteger(value.attempts)
      ? Math.max(0, Math.min(120, value.attempts))
      : 0;
    const revision = Number.isSafeInteger(value.revision)
      ? Math.max(1, value.revision)
      : 1;
    products[productId] = {
      generation: 1,
      operation: {
        schemaVersion: 1,
        productId,
        generation: 1,
        operationId: value.verificationId,
        operation: "install",
        phase: value.phase,
        launchState: "confirmed",
        revision,
        attempts,
        startedAt: value.startedAt,
        updatedAt: value.updatedAt,
        deadlineAt: value.deadlineAt,
        lastCheckedAt: value.lastCheckedAt ?? null,
        lastDetection: value.lastDetection ?? null,
        lastError: value.lastError ?? null,
        desktopStatus: value.desktopStatus ?? null
      }
    };
  }
  return { schemaVersion: 1, products };
}

function readDesktopOperationRecords() {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(desktopOperationRecordsPath(), "utf8")
    );
  } catch (error) {
    if (error?.code !== "ENOENT") {
      return { schemaVersion: 1, products: {} };
    }
  }
  try {
    const legacyRecords = parsePlainObjectJson(
      fs.readFileSync(legacyInstallVerificationRecordsPath(), "utf8")
    );
    const migrated = migrateLegacyInstallVerificationRecords(legacyRecords);
    writeDesktopOperationRecords(migrated);
    return migrated;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("Unable to migrate desktop operation records", error);
    }
    return { schemaVersion: 1, products: {} };
  }
}

function writeDesktopOperationRecords(records) {
  writeJsonAtomically(desktopOperationRecordsPath(), records);
}

function taskNotificationProductName(productId) {
  if (CLI_INSTALL_PLANS[productId]) {
    return CLI_INSTALL_PLANS[productId].name;
  }
  const environmentId = environmentIdFromManagedDownload(productId);
  if (environmentId && ENVIRONMENT_PLANS[environmentId]) {
    return ENVIRONMENT_PLANS[environmentId].name;
  }
  if (DESKTOP_PROBES[productId]?.names?.[0]) {
    return DESKTOP_PROBES[productId].names[0];
  }
  const packageManagerProduct = getWindowsPackageManagerProduct(productId);
  if (packageManagerProduct?.label) return packageManagerProduct.label;
  return `${BRAND.name} 任务`;
}

function taskNotificationTarget(productId) {
  return environmentIdFromManagedDownload(productId)
    ? { target: "task-center", productId }
    : { target: "product", productId };
}

function focusTaskNotificationTarget(target) {
  const window = showMainWindow();
  if (!window || window.webContents.isDestroyed()) return;
  const sendTarget = () => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send("task-notification:open", target);
    }
  };
  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once("did-finish-load", sendTarget);
  } else {
    sendTarget();
  }
}

function openTaskCenterFromTray() {
  focusTaskNotificationTarget({
    target: "task-center",
    productId: "tray"
  });
}

function updateTrayPresentation() {
  if (!tray || tray.isDestroyed()) return;
  const states = [...trayTaskStates.values()];
  const count = states.length;
  const language = readSettings().language;
  tray.setToolTip(
    count === 0
      ? runtimeText("TRAY_BACKGROUND", language)
      : count === 1
        ? `${BRAND.name} · ${states[0]}`
        : runtimeText("TRAY_TASKS", language, { count })
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label:
          count > 0
            ? runtimeText("TRAY_TASKS", language, { count }).replace(
                `${BRAND.name} · `,
                ""
              )
            : runtimeText("TRAY_NONE", language),
        enabled: count > 0,
        click: () => openTaskCenterFromTray()
      },
      {
        label: runtimeText("TRAY_OPEN_TASKS", language),
        click: () => openTaskCenterFromTray()
      },
      {
        label: runtimeText("TRAY_OPEN_HUB", language),
        click: () => showMainWindow()
      },
      { type: "separator" },
      {
        label: runtimeText("TRAY_EXIT", language),
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

function setTrayTaskState(key, label, active) {
  if (active) trayTaskStates.set(key, label);
  else trayTaskStates.delete(key);
  updateTrayPresentation();
}

function updateDownloadTrayTask(task) {
  const active = [
    "starting",
    "downloading",
    "pausing",
    "canceling"
  ].includes(task?.phase);
  const name = taskNotificationProductName(task?.productId);
  const language = readSettings().language;
  const action =
    task?.phase === "pausing"
      ? runtimeText("TASK_PAUSING", language)
      : task?.phase === "canceling"
        ? runtimeText("TASK_CANCELING", language)
        : runtimeText("TASK_DOWNLOADING", language);
  setTrayTaskState(
    `download:${task?.productId || ""}`,
    `${action} ${name}`,
    active
  );
}

function showTaskNotification({
  key,
  productId,
  title,
  body,
  restored = false
}) {
  if (
    typeof key !== "string" ||
    !key ||
    typeof productId !== "string" ||
    !productId ||
    typeof title !== "string" ||
    !title ||
    typeof body !== "string" ||
    !body ||
    !app.isReady() ||
    !Notification.isSupported()
  ) {
    return false;
  }
  if (
    !rememberNotificationKey(
      shownTaskNotifications,
      key,
      Date.now(),
      500
    )
  ) {
    return false;
  }
  if (restored) return false;
  try {
    const notification = new Notification(localizedSystemOptions({
      title,
      body,
      silent: false,
      timeoutType: "default"
    }));
    activeTaskNotifications.add(notification);
    notification.on("click", () =>
      focusTaskNotificationTarget(taskNotificationTarget(productId))
    );
    notification.on("close", () =>
      activeTaskNotifications.delete(notification)
    );
    notification.on("failed", (_event, message) => {
      activeTaskNotifications.delete(notification);
      console.error("Task notification failed", message);
    });
    notification.show();
    return true;
  } catch (error) {
    console.error("Unable to show task notification", error);
    return false;
  }
}

function notifyDesktopOperationTask(task, { restored = false } = {}) {
  if (!["installed", "uninstalled", "timed-out"].includes(task?.phase)) return;
  const name = taskNotificationProductName(task.productId);
  const title =
    task.phase === "installed"
      ? `${name} 安装完成`
      : task.phase === "uninstalled"
        ? `${name} 卸载完成`
        : `${name} 操作等待超时`;
  const body =
    task.phase === "timed-out"
      ? "点击返回产品页重新检测实际安装状态。"
      : "点击返回对应厂商产品页。";
  showTaskNotification({
    key: `desktop:${task.productId}:${task.generation}:${task.phase}`,
    productId: task.productId,
    title,
    body,
    restored
  });
}

function emitDesktopOperationTask(task, context) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      try {
        window.webContents.send("desktop:operation", task);
      } catch (error) {
        console.error("Unable to emit desktop operation snapshot", error);
      }
    }
  }
  setTrayTaskState(
    `desktop:${task?.productId || ""}`,
    `${taskNotificationProductName(task?.productId)} ${runtimeText(
      task?.operation === "uninstall"
        ? "TASK_UNINSTALL_CHECK"
        : "TASK_INSTALL_CHECK",
      readSettings().language
    )}`,
    ["launching", "monitoring"].includes(task?.phase)
  );
  notifyDesktopOperationTask(task, context);
}

function getDesktopOperationController() {
  if (desktopOperationController) return desktopOperationController;
  desktopOperationController = createDesktopOperationController({
    loadRecords: readDesktopOperationRecords,
    saveRecords: writeDesktopOperationRecords,
    checkProduct: detectDesktopProductForOperation,
    isSupported: (productId) =>
      Boolean(windowsPackageManagerPlan(productId)) ||
      (Boolean(DESKTOP_PROBES[productId]) &&
        (Boolean(resolveManagedDownloadPlan(productId)) ||
          Boolean(DESKTOP_PROBES[productId]?.uninstall))),
    createId: () => crypto.randomUUID(),
    onChange: emitDesktopOperationTask,
    intervalMs: 5_000,
    timeoutMs: 10 * 60 * 1_000
  });
  return desktopOperationController;
}

function cleanupLegacyPortableInstallArtifacts(productId) {
  const managedDownload = getStaticManagedDownload(productId);
  const portable = portableDesktopPlan(managedDownload);
  const layout = portable
    ? createPortableDesktopLayout({
        productId,
        download: managedDownload,
        localAppData: process.env.LOCALAPPDATA || ""
      })
    : null;
  if (
    !portable ||
    portable.kind === "zip-directory" ||
    !layout ||
    !fs.existsSync(layout.directory) ||
    fs.existsSync(layout.executable) ||
    fs.existsSync(layout.marker)
  ) {
    return;
  }
  cleanupInterruptedPortableFiles({
    directory: layout.directory,
    executableFileName: portable.executableRelativePath
  });
}

async function desktopOperationForRenderer(productId) {
  const controller = getDesktopOperationController();
  let task = controller.get(productId);
  if (task?.operation === "install") {
    try {
      cleanupLegacyPortableInstallArtifacts(productId);
    } catch (error) {
      console.error("Unable to clean legacy portable staging files", error);
    }
    await controller.finishProcess(
      productId,
      task.generation,
      task.operationId,
      { exitCode: 0, signal: null }
    );
    return controller.get(productId);
  }
  const adapter = getDesktopAdapterForProduct(productId);
  const foregroundLifecycle =
    (task?.operation === "install" &&
      adapter?.installerLifecycle === "foreground") ||
    (task?.operation === "uninstall" &&
      adapter?.uninstallLifecycle === "foreground");
  if (
    task &&
    task.phase === "timed-out" &&
    foregroundLifecycle
  ) {
    // Older clients could only poll for installation evidence. If a user
    // closed a foreground installer/uninstaller, that left a durable timeout even though
    // the process had already ended. Current launches observe process exit;
    // normalize the legacy terminal record the first time the renderer asks.
    await controller.finishProcess(
      productId,
      task.generation,
      task.operationId,
      { exitCode: 0, signal: null }
    );
    task = controller.get(productId);
  }
  return task;
}

function readEnvironmentOperationRecords() {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(environmentOperationRecordsPath(), "utf8")
    );
  } catch {
    return { schemaVersion: 1, environments: {} };
  }
}

function writeEnvironmentOperationRecords(records) {
  writeJsonAtomically(environmentOperationRecordsPath(), records);
}

function emitEnvironmentOperationTask(task, { restored = false } = {}) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      try {
        window.webContents.send("environment:operation", task);
      } catch (error) {
        console.error("Unable to emit environment operation snapshot", error);
      }
    }
  }
  setTrayTaskState(
    `environment:${task?.environmentId || ""}`,
    `${ENVIRONMENT_PLANS[task?.environmentId]?.name || "运行环境"} ${runtimeText(
      task?.operation === "uninstall"
        ? "TASK_UNINSTALL_CHECK"
        : "TASK_INSTALL_CHECK",
      readSettings().language
    )}`,
    ["launching", "monitoring"].includes(task?.phase)
  );
  if (["installed", "uninstalled", "timed-out"].includes(task?.phase)) {
    const productId = `environment:${task.environmentId}`;
    const name = ENVIRONMENT_PLANS[task.environmentId]?.name || "运行环境";
    showTaskNotification({
      key: `environment:${task.environmentId}:${task.generation}:${task.phase}`,
      productId,
      title:
        task.phase === "installed"
          ? `${name} 安装完成`
          : task.phase === "uninstalled"
            ? `${name} 卸载完成`
            : `${name} 操作等待超时`,
      body:
        task.phase === "timed-out"
          ? "点击打开任务中心重新检测实际状态。"
          : "点击打开任务中心查看结果。",
      restored
    });
  }
}

function getEnvironmentOperationController() {
  if (environmentOperationController) return environmentOperationController;
  environmentOperationController = createEnvironmentOperationController({
    loadRecords: readEnvironmentOperationRecords,
    saveRecords: writeEnvironmentOperationRecords,
    checkProduct: detectEnvironmentOperationStatus,
    isSupported: (environmentId) => Boolean(getEnvironmentPlan(environmentId)),
    createId: () => crypto.randomUUID(),
    onChange: emitEnvironmentOperationTask,
    intervalMs: 5_000,
    timeoutMs: 10 * 60 * 1_000
  });
  return environmentOperationController;
}

function writeDownloadRecords(records) {
  writeJsonAtomically(downloadRecordsPath(), records);
}

function readPartialDownloadRecords() {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(partialDownloadRecordsPath(), "utf8")
    );
  } catch {
    return {};
  }
}

function writePartialDownloadRecords(records) {
  writeJsonAtomically(partialDownloadRecordsPath(), records);
}

function removePartialDownloadRecord(productId) {
  const records = readPartialDownloadRecords();
  if (!records[productId]) return;
  delete records[productId];
  writePartialDownloadRecords(records);
}

function loadManagedDownloadTasks() {
  if (managedDownloadTasksLoaded) return;
  managedDownloadTasksLoaded = true;
  let records = {};
  let needsRewrite = false;
  try {
    const value = JSON.parse(
      fs.readFileSync(managedDownloadTasksPath(), "utf8")
    );
    if (value && typeof value === "object" && !Array.isArray(value)) {
      records = value;
    } else {
      needsRewrite = true;
    }
  } catch {
    records = {};
    needsRewrite = true;
  }
  const recovery = planManagedDownloadTaskRecovery({
    records,
    isSupported: (productId) => Boolean(resolveManagedDownloadPlan(productId)),
    inspectPartial: (productId) => {
      const partialRecords = readPartialDownloadRecords();
      if (!Object.prototype.hasOwnProperty.call(partialRecords, productId)) {
        return null;
      }
      const plan = resolveManagedDownloadPlan(productId);
      const partial = plan ? managedPartialDownload(productId, plan) : null;
      return partial
        ? {
            kind: "validated",
            productId,
            updatedAt: partial.updatedAt
          }
        : { kind: "unsafe" };
    },
    now: Date.now,
    staleAfterMs: 30 * 24 * 60 * 60 * 1000
  });
  for (const productId of recovery.discardPartialProductIds) {
    const plan = resolveManagedDownloadPlan(productId);
    const cleanup = plan
      ? discardManagedPartialDownload(productId, plan)
      : { ok: false };
    if (cleanup.ok) {
      delete recovery.records[productId];
    }
  }
  for (const [productId, task] of Object.entries(recovery.records)) {
    managedDownloadTasks.set(productId, task);
  }
  if (needsRewrite || recovery.changed) {
    writeManagedDownloadTasks();
  }
}

function writeManagedDownloadTasks() {
  const records = Object.fromEntries(managedDownloadTasks.entries());
  writeJsonAtomically(managedDownloadTasksPath(), records);
}

function removeManagedDownloadState(productId, options) {
  const {
    expectedAttemptId = "",
    clearCompletedRecord = false
  } = options || {};
  loadManagedDownloadTasks();
  const previousTask = managedDownloadTasks.get(productId) || null;
  if (
    expectedAttemptId &&
    previousTask?.attemptId !== expectedAttemptId
  ) {
    return false;
  }
  const records = readDownloadRecords();
  const previousRecord = records[productId] || null;
  managedDownloadTasks.delete(productId);
  if (clearCompletedRecord) delete records[productId];
  try {
    writeManagedDownloadTasks();
    if (clearCompletedRecord) writeDownloadRecords(records);
  } catch (error) {
    if (previousTask) managedDownloadTasks.set(productId, previousTask);
    if (clearCompletedRecord && previousRecord) {
      records[productId] = previousRecord;
    }
    try {
      writeManagedDownloadTasks();
      if (clearCompletedRecord) writeDownloadRecords(records);
    } catch {
      // Preserve the original persistence failure.
    }
    throw error;
  }
  downloadTaskLastPersistedAt.delete(productId);
  downloadTaskLastEmittedAt.delete(productId);
  setTrayTaskState(`download:${productId}`, "", false);
  return true;
}

function isMissingDownloadedFileTask(task) {
  return (
    task?.phase === "failed" &&
    task.errorCode === "DOWNLOADED_FILE_MISSING"
  );
}

function emitManagedDownloadTask(task) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send("download:task", task);
    }
  }
  updateDownloadTrayTask(task);
  if (task?.phase === "completed" || task?.phase === "failed") {
    const name = taskNotificationProductName(task.productId);
    showTaskNotification({
      key: `download:${task.productId}:${task.attemptId}:${task.phase}`,
      productId: task.productId,
      title:
        task.phase === "completed"
          ? `${name} 下载完成`
          : `${name} 下载失败`,
      body:
        task.phase === "completed"
          ? environmentIdFromManagedDownload(task.productId)
            ? "点击打开任务中心，继续安装环境。"
            : "点击返回产品页，打开已验证的安装包。"
          : "点击查看失败原因并重试。"
    });
  }
}

function advanceManagedDownloadTask(
  productId,
  event,
  { persist = true, broadcast = true } = {}
) {
  loadManagedDownloadTasks();
  const current = managedDownloadTasks.get(productId) || null;
  const result = applyDownloadTaskEvent(
    current,
    { ...event, productId },
    { now: () => new Date().toISOString() }
  );
  if (!result.accepted || !result.task) return result;
  managedDownloadTasks.set(productId, result.task);
  if (persist) {
    writeManagedDownloadTasks();
    downloadTaskLastPersistedAt.set(productId, Date.now());
  }
  if (broadcast) {
    emitManagedDownloadTask(result.task);
    downloadTaskLastEmittedAt.set(productId, Date.now());
  }
  return result;
}

function recordManagedDownloadProgress(productId, attemptId, progress) {
  const now = Date.now();
  const publicPhase = projectManagedDownloadTask(
    currentManagedDownloadTask(productId)
  )?.phase;
  const persist =
    now - (downloadTaskLastPersistedAt.get(productId) || 0) >= 1000;
  const broadcast =
    publicPhase !== "downloading" ||
    now - (downloadTaskLastEmittedAt.get(productId) || 0) >= 100;
  return advanceManagedDownloadTask(
    productId,
    { type: "progress", attemptId, progress, resumable: true },
    { persist, broadcast }
  );
}

function currentManagedDownloadTask(productId) {
  loadManagedDownloadTasks();
  return managedDownloadTasks.get(productId) || null;
}

function readEnvironmentDownloadRecords() {
  try {
    return parsePlainObjectJson(
      fs.readFileSync(environmentDownloadRecordsPath(), "utf8")
    );
  } catch {
    return {};
  }
}

function writeEnvironmentDownloadRecords(records) {
  writeJsonAtomically(environmentDownloadRecordsPath(), records);
}

function fileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function fileIntegritySync(filePath, algorithm) {
  if (!new Set(["sha256", "sha512"]).has(algorithm)) {
    throw new Error("不支持的文件完整性算法");
  }
  const hash = crypto.createHash(algorithm);
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const descriptor = fs.openSync(filePath, "r");
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
    return hash.digest("hex");
  } finally {
    fs.closeSync(descriptor);
  }
}

function updateHashFromFile(hash, filePath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
}

async function inspectSignature(filePath) {
  const script = [
    POWERSHELL_UTF8_OUTPUT,
    "$s=Get-AuthenticodeSignature -LiteralPath $env:AIHUB_SIGNATURE_PATH",
    "$v=[pscustomobject]@{Status=[string]$s.Status;Signer=if($s.SignerCertificate){$s.SignerCertificate.Subject}else{''}}",
    "$v|ConvertTo-Json -Compress"
  ].join(";");
  try {
    const { stdout } = await execFileAsync(
      windowsPowerShellPath(),
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        timeout: 15000,
        env: {
          ...isolatedThirdPartyEnvironment(),
          AIHUB_SIGNATURE_PATH: filePath
        }
      }
    );
    const value = JSON.parse(stdout.trim());
    return {
      status: String(value.Status || "Unknown"),
      signer: String(value.Signer || "")
    };
  } catch {
    return {
      status: "Unknown",
      signer: "",
      error: "Windows 验签命令执行失败"
    };
  }
}

async function inspectWindowsInstallerIdentity(filePath, expected) {
  if (!expected) {
    return { ok: false, error: "该安装包缺少客户端产品身份契约" };
  }
  let descriptor;
  let buffer;
  try {
    descriptor = fs.openSync(filePath, "r");
    const stat = fs.fstatSync(descriptor);
    const bytesToRead = Math.min(stat.size, 1024 * 1024);
    buffer = Buffer.alloc(bytesToRead);
    const bytesRead = fs.readSync(
      descriptor,
      buffer,
      0,
      bytesToRead,
      0
    );
    buffer = buffer.subarray(0, bytesRead);
  } catch {
    return { ok: false, error: "无法读取安装包产品身份" };
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }

  const script = [
    POWERSHELL_UTF8_OUTPUT,
    "$v=(Get-Item -LiteralPath $env:AIHUB_INSTALLER_IDENTITY_PATH).VersionInfo",
    "$o=[pscustomobject]@{ProductName=[string]$v.ProductName;FileDescription=[string]$v.FileDescription;OriginalFilename=[string]$v.OriginalFilename;CompanyName=[string]$v.CompanyName}",
    "$o|ConvertTo-Json -Compress"
  ].join(";");
  let versionInfo;
  try {
    const { stdout } = await execFileAsync(
      windowsPowerShellPath(),
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        timeout: 15_000,
        env: {
          ...isolatedThirdPartyEnvironment(),
          AIHUB_INSTALLER_IDENTITY_PATH: filePath
        }
      }
    );
    versionInfo = JSON.parse(stdout.trim());
  } catch {
    return { ok: false, error: "Windows 无法读取安装包产品信息" };
  }
  const result = validateWindowsInstallerIdentity({
    buffer,
    versionInfo,
    expected
  });
  return result.ok
    ? { ok: true, identity: result.value }
    : {
        ok: false,
        error: "安装包架构或产品身份与客户端白名单不匹配",
        identityError: result.error
      };
}

async function inspectRecentWindowsApplicationCrash(filePath, startedAtMs) {
  if (
    typeof filePath !== "string" ||
    !path.isAbsolute(filePath) ||
    !Number.isFinite(startedAtMs)
  ) {
    return null;
  }
  const script = [
    POWERSHELL_UTF8_OUTPUT,
    "$start=[DateTimeOffset]::FromUnixTimeMilliseconds([long]$env:AIHUB_LAUNCH_STARTED_MS).LocalDateTime.AddSeconds(-1)",
    "$event=Get-WinEvent -FilterHashtable @{LogName='Application';Id=1000;StartTime=$start} -ErrorAction SilentlyContinue|Where-Object{$_.Properties.Count -gt 10 -and [string]$_.Properties[10].Value -ieq $env:AIHUB_LAUNCH_PATH}|Sort-Object TimeCreated -Descending|Select-Object -First 1",
    "if($event){[pscustomobject]@{occurredAt=$event.TimeCreated.ToUniversalTime().ToString('o');applicationName=[string]$event.Properties[0].Value;moduleName=[string]$event.Properties[3].Value;exceptionCode=[string]$event.Properties[6].Value;applicationPath=[string]$event.Properties[10].Value}|ConvertTo-Json -Compress}"
  ].join(";");
  try {
    const { stdout } = await execFileAsync(
      windowsPowerShellPath(),
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        timeout: 5_000,
        env: {
          ...isolatedThirdPartyEnvironment(),
          AIHUB_LAUNCH_PATH: filePath,
          AIHUB_LAUNCH_STARTED_MS: String(Math.trunc(startedAtMs))
        }
      }
    );
    const output = stdout.trim();
    return output
      ? normalizeApplicationCrash(
          JSON.parse(output),
          filePath,
          startedAtMs
        )
      : null;
  } catch {
    return null;
  }
}

async function verifyExpectedSignature(filePath, expectedSigner, force = false) {
  if (!(expectedSigner instanceof RegExp)) {
    return { ok: false, status: "Unknown", signer: "" };
  }
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return { ok: false, status: "NotFound", signer: "" };
  }
  const cacheKey = path.resolve(filePath).toLowerCase();
  const cached = trustedSignatureCache.get(cacheKey);
  if (
    !force &&
    cached &&
    cached.size === stat.size &&
    cached.mtimeMs === stat.mtimeMs
  ) {
    return cached.result;
  }
  const signature = await inspectSignature(filePath);
  expectedSigner.lastIndex = 0;
  const result = {
    ok:
      signature.status === "Valid" &&
      expectedSigner.test(String(signature.signer || "")),
    status: signature.status,
    signer: signature.signer
  };
  if (signatureInspectionIsConclusive(result)) {
    trustedSignatureCache.set(cacheKey, {
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      result
    });
  }
  return result;
}

function parseRegistryOutput(raw) {
  const entries = [];
  let current = null;
  for (const line of raw.split(/\r?\n/)) {
    if (/^HKEY_/i.test(line.trim())) {
      if (current) entries.push(current);
      current = { key: line.trim() };
      continue;
    }
    if (!current) continue;
    const match = line.match(
      /^\s+(DisplayName|DisplayVersion|InstallLocation|DisplayIcon|Publisher|UninstallString|QuietUninstallString)\s+REG_\w+\s+(.*)$/i
    );
    if (match) current[match[1].toLowerCase()] = match[2].trim();
  }
  if (current) entries.push(current);
  return entries.filter((entry) => entry.displayname);
}

function parseRegistryKeys(raw) {
  return [
    ...new Set(
      String(raw || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(
          (line) =>
            /^HKEY_/i.test(line) &&
            /\\CURRENTVERSION\\UNINSTALL\\[^\\]+$/i.test(line)
        )
    )
  ];
}

function isMissingRegistryQuery(error) {
  const message = `${error?.stdout || ""}\n${error?.stderr || ""}\n${error?.message || ""}`;
  return (
    Number(error?.code) === 1 &&
    !error?.killed &&
    /unable to find|cannot find|not found|找不到|不存在/i.test(message)
  );
}

async function scanRegistryAppsWithStatus() {
  const roots = [
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
  ];
  const results = await Promise.all(
    roots.map(async (root) => {
      try {
        const { stdout } = await execFileAsync("reg.exe", ["query", root, "/s"], {
          windowsHide: true,
          timeout: 15000,
          maxBuffer: 8 * 1024 * 1024
        });
        return {
          ok: true,
          entries: parseRegistryOutput(stdout),
          keys: parseRegistryKeys(stdout)
        };
      } catch (error) {
        return isMissingRegistryQuery(error)
          ? { ok: true, entries: [], keys: [] }
          : { ok: false, entries: [], keys: [] };
      }
    })
  );
  return {
    ok: results.every((result) => result.ok),
    entries: results.flatMap((result) => result.entries),
    keys: [...new Set(results.flatMap((result) => result.keys))]
  };
}

async function scanRegistryApps() {
  return (await scanRegistryAppsWithStatus()).entries;
}

async function locateRegisteredPythonWithStatus(pythonMinor) {
  const roots = [
    "HKCU\\SOFTWARE\\Python\\PythonCore",
    "HKLM\\SOFTWARE\\Python\\PythonCore",
    "HKLM\\SOFTWARE\\WOW6432Node\\Python\\PythonCore"
  ].map((root) =>
    Number.isInteger(pythonMinor)
      ? `${root}\\3.${pythonMinor}\\InstallPath`
      : root
  );
  const results = await Promise.all(
    roots.map(async (root) => {
      try {
        const { stdout } = await execFileAsync(
          "reg.exe",
          ["query", root, "/s", "/v", "ExecutablePath"],
          {
            windowsHide: true,
            timeout: 5000,
            maxBuffer: 1024 * 1024
          }
        );
        return {
          ok: true,
          candidates: [
            ...stdout.matchAll(
              /^\s+ExecutablePath\s+REG_\w+\s+(.+)$/gim
            )
          ].map((match) => match[1].trim())
        };
      } catch (error) {
        return isMissingExactRegistryValueQuery(error)
          ? { ok: true, candidates: [] }
          : { ok: false, candidates: [] };
      }
    })
  );
  const location =
    results
      .flatMap((result) => result.candidates)
      .find(
        (candidate) =>
          path.isAbsolute(candidate) &&
          /^python\.exe$/i.test(path.basename(candidate)) &&
          fs.existsSync(candidate)
      ) || "";
  return {
    ok: results.every((result) => result.ok),
    location
  };
}

function fixedEnvironmentExecutableCandidates(environmentId) {
  const programRoots = [
    process.env.ProgramW6432,
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"]
  ].filter(Boolean);
  const localPrograms = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Programs")
    : "";
  const candidates = [];
  for (const root of programRoots) {
    if (environmentId === "node") {
      candidates.push(path.join(root, "nodejs", "node.exe"));
    } else if (environmentId === "git") {
      candidates.push(path.join(root, "Git", "cmd", "git.exe"));
    } else if (environmentId === "docker") {
      candidates.push(
        path.join(root, "Docker", "Docker", "resources", "bin", "docker.exe")
      );
    }
  }
  if (localPrograms && environmentId === "git") {
    candidates.push(path.join(localPrograms, "Git", "cmd", "git.exe"));
  } else if (localPrograms && environmentId === "python") {
    candidates.push(
      path.join(localPrograms, "Python", "Python313", "python.exe")
    );
  } else if (localPrograms && environmentId === "python312") {
    candidates.push(
      path.join(localPrograms, "Python", "Python312", "python.exe")
    );
  }
  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
}

async function trustedFixedEnvironmentExecutable(environmentId, plan) {
  let foundUntrustedCandidate = false;
  for (const candidate of fixedEnvironmentExecutableCandidates(environmentId)) {
    if (!fs.existsSync(candidate)) continue;
    foundUntrustedCandidate = true;
    let canonical = "";
    try {
      canonical = fs.realpathSync.native(candidate);
    } catch {
      continue;
    }
    const signature = await verifyExpectedSignature(
      canonical,
      plan.installedSigner,
      true
    );
    if (signature.ok) {
      return { ok: true, location: canonical };
    }
  }
  return { ok: !foundUntrustedCandidate, location: "" };
}

async function locateEnvironment(environmentId, plan) {
  if (environmentId === "wsl") {
    const candidate = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "wsl.exe"
    );
    const canonical = canonicalExistingPath(candidate);
    if (!canonical) return { installed: false, location: "", probeOk: true };
    const signature = await verifyExpectedSignature(
      canonical,
      plan.installedSigner,
      true
    );
    if (!signature.ok) {
      return { installed: false, location: "", probeOk: false };
    }
    try {
      await execFileAsync(canonical, ["--status"], {
        windowsHide: true,
        timeout: 15_000,
        env: isolatedThirdPartyEnvironment()
      });
      return { installed: true, location: canonical, probeOk: true };
    } catch {
      return { installed: false, location: "", probeOk: true };
    }
  }
  const [rawPathProbe, rawRegisteredProbe, fixedProbe] = await Promise.all([
    Number.isInteger(plan.pythonMinor)
      ? Promise.resolve({ ok: true, location: "" })
      : locateWithStatus(plan.command),
    Number.isInteger(plan.pythonMinor)
      ? locateRegisteredPythonWithStatus(plan.pythonMinor)
      : Promise.resolve({ ok: true, location: "" }),
    trustedFixedEnvironmentExecutable(environmentId, plan)
  ]);
  let registeredProbe = rawRegisteredProbe;
  if (rawRegisteredProbe.location) {
    const canonical = canonicalExistingPath(rawRegisteredProbe.location);
    const signature = canonical
      ? await verifyExpectedSignature(canonical, plan.installedSigner, true)
      : { ok: false };
    registeredProbe = signature.ok
      ? { ok: rawRegisteredProbe.ok, location: canonical }
      : { ok: false, location: "" };
  }
  const pathProbe = await resolveTrustedEnvironmentExecutableProbe({
    probe: rawPathProbe,
    canonicalize: canonicalExistingPath,
    verify: async (candidate) =>
      (
        await verifyExpectedSignature(
          candidate,
          plan.installedSigner,
          true
        )
      ).ok
  });
  const resolved = resolveEnvironmentEvidence({
    pathLocation: pathProbe.location,
    registeredLocation: registeredProbe.location || fixedProbe.location,
    exists: fs.existsSync
  });
  return {
    ...resolved,
    probeOk: pathProbe.ok && registeredProbe.ok && fixedProbe.ok
  };
}

function environmentRegistryMatches(entry, plan) {
  plan.displayName.lastIndex = 0;
  plan.registryPublisher.lastIndex = 0;
  return (
    plan.displayName.test(String(entry.displayname || "")) &&
    plan.registryPublisher.test(String(entry.publisher || ""))
  );
}

function environmentRegistryCandidates(environmentId, registry) {
  const plan = getEnvironmentPlan(environmentId);
  if (!plan || !Array.isArray(registry)) return [];
  return registry.filter((entry) => environmentRegistryMatches(entry, plan));
}

function canonicalExistingPath(candidate) {
  if (
    typeof candidate !== "string" ||
    !path.isAbsolute(candidate) ||
    !fs.existsSync(candidate)
  ) {
    return "";
  }
  try {
    return fs.realpathSync.native(candidate);
  } catch {
    return "";
  }
}

function chooseEnvironmentRegistryEntry(environmentId, location, registry) {
  const candidates = environmentRegistryCandidates(environmentId, registry);
  if (!candidates.length) return null;
  const canonicalLocation = canonicalExistingPath(location);
  if (canonicalLocation) {
    const associated = candidates.filter((entry) => {
      const registeredRoot = canonicalExistingPath(
        registryInstallLocation(entry)
      );
      return registeredRoot && pathIsInside(canonicalLocation, registeredRoot);
    });
    if (associated.length === 1) return associated[0];
    if (associated.length > 1) return null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

async function trustedRegisteredEnvironmentExecutable(
  environmentId,
  plan,
  registryEntries
) {
  let foundUntrustedCandidate = false;
  for (const entry of registryEntries) {
    const candidate = resolveRegisteredEnvironmentExecutable({
      environmentId,
      installLocation: String(entry.installlocation || ""),
      exists: fs.existsSync
    });
    if (!candidate) continue;
    foundUntrustedCandidate = true;
    const canonical = canonicalExistingPath(candidate);
    if (!canonical) continue;
    const signature = await verifyExpectedSignature(
      canonical,
      plan.installedSigner,
      true
    );
    if (signature.ok) {
      return { ok: true, location: canonical };
    }
  }
  return { ok: !foundUntrustedCandidate, location: "" };
}

async function trustedEnvironmentUninstallRecord(
  environmentId,
  registry
) {
  const policy = Object.hasOwn(
    ENVIRONMENT_UNINSTALL_POLICIES,
    environmentId
  )
    ? ENVIRONMENT_UNINSTALL_POLICIES[environmentId]
    : null;
  if (!policy) return null;
  const record = findTrustedUninstallRecord({
    registry,
    policy,
    exists: fs.existsSync,
    realpath: fs.realpathSync.native,
    systemRoot: process.env.SystemRoot || "C:\\Windows"
  });
  if (!record) return null;
  if (record.action.kind === "msi") {
    const productCode = record.action.args[1] || "";
    const registryProductCode = path.win32.basename(
      String(record.entry.key || "")
    );
    if (
      (policy.machineMsiOnly &&
        !/^HKEY_LOCAL_MACHINE\\/i.test(String(record.entry.key || ""))) ||
      registryProductCode.toUpperCase() !== productCode.toUpperCase()
    ) {
      return null;
    }
    return record;
  }
  const signature = await verifyExpectedSignature(
    record.action.executable,
    policy.signer,
    true
  );
  return signature.ok ? record : null;
}

async function environmentStatusFromScan(
  environmentId,
  evidence,
  registryScan
) {
  const plan = getEnvironmentPlan(environmentId);
  if (!plan) {
    return resolveEnvironmentOperationStatus({
      evidence: { installed: false, location: "" },
      registryScanOk: false,
      evidenceProbeOk: false,
      registryEntry: null,
      registryEvidencePresent: false,
      uninstallAction: null
    });
  }
  const registryEntries = environmentRegistryCandidates(
    environmentId,
    registryScan.entries
  );
  const registeredProbe = await trustedRegisteredEnvironmentExecutable(
    environmentId,
    plan,
    registryEntries
  );
  const mergedEvidence = resolveEnvironmentEvidence({
    pathLocation: evidence.location,
    registeredLocation: registeredProbe.location,
    exists: fs.existsSync
  });
  const entry = chooseEnvironmentRegistryEntry(
    environmentId,
    mergedEvidence.location,
    registryEntries
  );
  const uninstallRecord = await trustedEnvironmentUninstallRecord(
    environmentId,
    registryEntries
  );
  const status = resolveEnvironmentOperationStatus({
    evidence: mergedEvidence,
    registryScanOk: registryScan.ok,
    evidenceProbeOk: evidence.probeOk === true && registeredProbe.ok,
    registryEntry: entry,
    registryEvidencePresent: registryEntries.length > 0,
    uninstallAction: uninstallRecord?.action || null
  });
  if (environmentId === "wsl" && status.installed) {
    return wslPlatformManagementStatus(status);
  }
  return status;
}

async function detectEnvironmentOperationStatus(environmentId) {
  const plan = getEnvironmentPlan(environmentId);
  if (!plan) {
    return resolveEnvironmentOperationStatus({
      evidence: { installed: false, location: "" },
      registryScanOk: false,
      evidenceProbeOk: false,
      registryEntry: null,
      registryEvidencePresent: false,
      uninstallAction: null
    });
  }
  const [registryScan, evidence] = await Promise.all([
    scanRegistryAppsWithStatus(),
    locateEnvironment(environmentId, plan)
  ]);
  return await environmentStatusFromScan(
    environmentId,
    evidence,
    registryScan
  );
}

async function detectEnvironmentUpdateStatuses(environmentId) {
  return Object.fromEntries(
    await Promise.all(
      environmentUpdateMemberIds(environmentId).map(async (memberId) => [
        memberId,
        await detectEnvironmentOperationStatus(memberId)
      ])
    )
  );
}

function isolatedThirdPartyEnvironment() {
  const blocked = /^(PORTABLE_EXECUTABLE_|ELECTRON_|NODE_OPTIONS$|NODE_PATH$|npm_config_node_options$|__COMPAT_LAYER$)/i;
  return windowsPowerShellEnvironment(
    Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !blocked.test(name))
    )
  );
}

async function scanEnvironment() {
  const [registryScan, locations, wslDistributions] = await Promise.all([
    scanRegistryAppsWithStatus(),
    Promise.all(
      Object.entries(ENVIRONMENT_PLANS).map(async ([id, plan]) => ({
        id,
        evidence: await locateEnvironment(id, plan)
      }))
    ),
    scanWslDistributionEnvironments()
  ]);
  const scanned = await Promise.all(
    locations.map(async ({ id, evidence }) => {
      const plan = getEnvironmentPlan(id);
      const status = await environmentStatusFromScan(
        id,
        evidence,
        registryScan
      );
      const recommendedVersion = plan.nativeWindowsFeature
        ? ""
        : getEnvironmentDownloadPlan(id, activeEnvironmentSourcePreferences)
            .recommendedVersion;
      const publishedRecommendedVersion =
        recommendedVersion &&
        isSoftwareUpdatePublished(lastVerifiedSoftwareUpdateRelease, {
          kind: "environment",
          subjectId: id,
          mode: "environment-download",
          version: recommendedVersion
        })
          ? recommendedVersion
          : "";
      const updateOffer = resolveEnvironmentUpdateOffer({
        detection: status.detection,
        installedVersion: status.version,
        recommendedVersion: publishedRecommendedVersion
      });
      return {
        status,
        check: {
          id,
          name: plan.name,
          installed: status.installed,
          version: status.version,
          location: status.location,
          canOpen: status.canOpen,
          canUninstall: status.canUninstall,
          detection: status.detection,
          ...updateOffer
        }
      };
    })
  );
  const operationController = getEnvironmentOperationController();
  for (const { check, status } of scanned) {
    const operation = operationController.get(check.id);
    const terminalScan =
      operation?.phase === "timed-out" &&
      ((operation.operation === "install" && status.detection === "installed") ||
        (operation.operation === "uninstall" && status.detection === "absent"));
    if (terminalScan) {
      await operationController.reconcileScan(
        check.id,
        operation.generation,
        operation.operationId,
        status
      );
    }
  }
  const checks = scanned.map(({ check }) => check);
  return {
    platform: process.platform,
    architecture: process.arch,
    checkedAt: new Date().toISOString(),
    checks,
    displayChecks: projectEnvironmentFamilyChecks(checks),
    wslDistributions
  };
}

function windowsPackageManagerPlan(productId) {
  return getWindowsPackageManagerProduct(productId)?.packageManager || null;
}

async function resolveWindowsPackageManagerExecutable() {
  if (process.platform !== "win32") return "";
  if (windowsPackageManagerExecutablePromise) {
    const cached = await windowsPackageManagerExecutablePromise;
    if (cached && fs.existsSync(cached)) return cached;
    windowsPackageManagerExecutablePromise = null;
  }
  windowsPackageManagerExecutablePromise = (async () => {
    const script = [
      POWERSHELL_UTF8_OUTPUT,
      "$package=Get-AppxPackage -Name Microsoft.DesktopAppInstaller -ErrorAction SilentlyContinue|Sort-Object Version -Descending|Select-Object -First 1",
      "if($null -eq $package){exit 1}",
      "$candidate=Join-Path $package.InstallLocation 'winget.exe'",
      "if(-not(Test-Path -LiteralPath $candidate -PathType Leaf)){exit 1}",
      "[IO.Path]::GetFullPath($candidate)"
    ].join(";");
    const { stdout } = await execFileAsync(
      windowsPowerShellPath(),
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        shell: false,
        timeout: 15_000,
        maxBuffer: 64 * 1024
      }
    );
    const candidate = String(stdout || "").trim();
    if (
      !candidate ||
      !path.isAbsolute(candidate) ||
      path.basename(candidate).toLowerCase() !== "winget.exe" ||
      !fs.existsSync(candidate)
    ) {
      return "";
    }
    return fs.realpathSync.native(candidate);
  })().catch(() => "");
  const executable = await windowsPackageManagerExecutablePromise;
  if (!executable) windowsPackageManagerExecutablePromise = null;
  return executable;
}

function windowsPackageManagerFailure(error, fallback) {
  const detail = String(error?.stderr || error?.stdout || "")
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim();
  if (detail) return `${fallback}: ${detail.slice(-1200)}`;
  return error instanceof Error && error.message
    ? `${fallback}: ${error.message}`
    : fallback;
}

function windowsPackageManagerText(code, parameters = {}) {
  return runtimeText(code, readSettings().language, parameters);
}

async function runWindowsPackageManager(operation, plan, timeout) {
  const executable = await resolveWindowsPackageManagerExecutable();
  if (!executable) {
    throw new Error(windowsPackageManagerText("WPM_UNAVAILABLE"));
  }
  const args =
    operation === "list-all"
      ? wingetListAllArgs()
      : wingetArgsFor(operation, plan);
  return await execFileAsync(executable, args, {
    windowsHide: true,
    shell: false,
    timeout,
    maxBuffer: 16 * 1024 * 1024,
    env: isolatedThirdPartyEnvironment()
  });
}

async function scanWindowsPackageManager() {
  try {
    const { stdout } = await runWindowsPackageManager(
      "list-all",
      null,
      120_000
    );
    return { ok: true, output: String(stdout || ""), error: "" };
  } catch (error) {
    return {
      ok: false,
      output: "",
      error: windowsPackageManagerFailure(
        error,
        windowsPackageManagerText("WPM_INVENTORY_FAILED")
      )
    };
  }
}

async function detectWindowsPackageManagerProduct(
  productId,
  product,
  scanSnapshot = null
) {
  const [packageSnapshot, windowsApps, registryScan] = await Promise.all([
    scanSnapshot?.windowsPackageManager || scanWindowsPackageManager(),
    scanSnapshot?.windowsApps || scanWindowsApps(),
    scanSnapshot?.registryScan || scanRegistryAppsWithStatus()
  ]);
  if (!packageSnapshot.ok) {
    return {
      installed: false,
      version: "",
      location: "",
      executable: "",
      appId: "",
      canOpen: false,
      canUninstall: false,
      uninstallMode: "interactive",
      availableVersion: "",
      detection: "unknown"
    };
  }
  const entry = findWingetListEntry(
    packageSnapshot.output,
    product.packageManager.packageId
  );
  const managed = Boolean(
    entry &&
      windowsPackageManagerReceiptMatches(
        readWindowsPackageManagerRecord(productId),
        productId,
        product.packageManager
      )
  );
  const expectedNames = product.packageManager.expectedNames || [];
  const startMatch = entry
    ? windowsApps.starts.find((candidate) =>
        matchesDesktopIdentity(expectedNames, candidate.Name)
      )
    : null;
  let location = "";
  if (entry && registryScan.ok) {
    for (const candidate of registryScan.entries) {
      if (
        !matchesDesktopIdentity(expectedNames, candidate.displayname) ||
        typeof candidate.installlocation !== "string"
      ) {
        continue;
      }
      const proposed = candidate.installlocation.trim().replace(/^"|"$/g, "");
      try {
        if (!path.isAbsolute(proposed) || !fs.existsSync(proposed)) continue;
        const resolved = fs.realpathSync.native(proposed);
        if (fs.statSync(resolved).isDirectory()) {
          location = resolved;
          break;
        }
      } catch {
        // Registry location is auxiliary only; exact winget ID owns presence.
      }
    }
  }
  return {
    installed: Boolean(entry),
    version: String(entry?.version || ""),
    availableVersion: String(entry?.availableVersion || ""),
    location,
    executable: "",
    appId: entry ? String(startMatch?.AppID || "") : "",
    canOpen: Boolean(entry && startMatch?.AppID),
    canUninstall: Boolean(entry),
    uninstallMode: managed ? "interactive" : "system-panel",
    managed,
    ownership: managed ? "managed" : entry ? "external" : "absent",
    detection: entry ? "installed" : "absent"
  };
}

function claimWindowsPackageManagerInstallation(productId, product, status) {
  if (!status?.installed || status.ownership === "managed") return status;
  setWindowsPackageManagerRecord(
    productId,
    createWindowsPackageManagerReceipt({
      productId,
      plan: product.packageManager,
      installedVersion: status.version
    })
  );
  return {
    ...status,
    canUninstall: true,
    uninstallMode: "interactive",
    managed: true,
    ownership: "managed"
  };
}

async function scanWindowsApps() {
  const script = [
    POWERSHELL_UTF8_OUTPUT,
    "$packages=Get-AppxPackage|Select-Object Name,PackageFullName,PackageFamilyName,Publisher,Architecture,InstallLocation,Version",
    "$starts=Get-StartApps|Select-Object Name,AppID",
    "[pscustomobject]@{packages=$packages;starts=$starts}|ConvertTo-Json -Depth 4 -Compress"
  ].join(";");
  try {
    const { stdout } = await execFileAsync(
      windowsPowerShellPath(),
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        timeout: 20000,
        maxBuffer: 8 * 1024 * 1024
      }
    );
    const value = JSON.parse(stdout.trim());
    return {
      ok: true,
      packages: Array.isArray(value.packages)
        ? value.packages
        : value.packages
          ? [value.packages]
          : [],
      starts: Array.isArray(value.starts)
        ? value.starts
        : value.starts
          ? [value.starts]
          : []
    };
  } catch {
    return { ok: false, packages: [], starts: [] };
  }
}

async function createDesktopProductScanSnapshot({
  includeWindowsPackageManager = false
} = {}) {
  const [registryScan, windowsApps, windowsPackageManager] = await Promise.all([
    scanRegistryAppsWithStatus(),
    scanWindowsApps(),
    includeWindowsPackageManager
      ? scanWindowsPackageManager()
      : Promise.resolve(null)
  ]);
  return { registryScan, windowsApps, windowsPackageManager };
}

function normalizedIconPath(value) {
  if (!value) return "";
  const candidate = value.replace(/^"/, "").replace(/".*$/, "").split(",")[0];
  return path.isAbsolute(candidate) && fs.existsSync(candidate) ? candidate : "";
}

function trustedDesktopUninstallRecord(productId, registry) {
  const policy = DESKTOP_PROBES[productId]?.uninstall;
  if (!policy) return null;
  return findTrustedUninstallRecord({
    registry,
    policy,
    exists: fs.existsSync,
    realpath: fs.realpathSync.native,
    systemRoot: process.env.SystemRoot || "C:\\Windows"
  });
}

function trustedLegacyDesktopInstallRecord(productId, registry) {
  const policy = DESKTOP_PROBES[productId]?.legacyInstall?.uninstall;
  if (!policy) return null;
  return findTrustedUninstallRecord({
    registry,
    policy,
    exists: fs.existsSync,
    realpath: fs.realpathSync.native,
    systemRoot: process.env.SystemRoot || "C:\\Windows"
  });
}

function trustedDesktopAppxPackage(productId, packages) {
  const policy = DESKTOP_PROBES[productId]?.appx;
  return policy ? trustedAppxPackage(packages, policy) : null;
}

async function verifyTrustedDesktopUninstaller(record, probe) {
  if (!record?.action?.executable || !probe?.uninstall) {
    return { ok: false, signer: "" };
  }
  const signature = await verifyExpectedSignature(
    record.action.executable,
    probe.signer,
    true
  );
  if (signature.ok) return signature;
  const expectedSha256 = probe.uninstall.expectedSha256;
  if (
    typeof expectedSha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(expectedSha256)
  ) {
    return { ok: false, signer: "" };
  }
  try {
    const sha256 = await fileSha256(record.action.executable);
    return sha256.toLowerCase() === expectedSha256.toLowerCase()
      ? { ok: true, signer: "客户端审核哈希", sha256 }
      : { ok: false, signer: "", sha256 };
  } catch {
    return { ok: false, signer: "" };
  }
}

function managedRegistryDesktopUnknownStatus(ownership = "mismatch") {
  return {
    installed: false,
    version: "",
    location: "",
    executable: "",
    appId: "",
    canOpen: false,
    canUninstall: false,
    uninstallMode: "interactive",
    detection: "unknown",
    managed: false,
    ownership
  };
}

function publicManagedRegistryDesktopStatus(status) {
  if (!status || typeof status !== "object") {
    return managedRegistryDesktopUnknownStatus();
  }
  const { uninstallAction: _uninstallAction, ...publicStatus } = status;
  return publicStatus;
}

async function inspectManagedRegistryDesktopInstance(
  productId,
  registryScan = null
) {
  const context = managedRegistryDesktopContext(productId);
  const receipt = context
    ? readManagedRegistryDesktopReceipt(productId)
    : null;
  if (!context) return null;
  if (!receipt) {
    return fs.existsSync(managedRegistryDesktopReceiptPath(productId))
      ? {
          context,
          receipt: null,
          registryScan,
          status: managedRegistryDesktopUnknownStatus("mismatch")
        }
      : null;
  }
  const scan = registryScan || (await scanRegistryAppsWithStatus());
  if (!scan.ok) {
    return {
      context,
      receipt,
      registryScan: scan,
      status: managedRegistryDesktopUnknownStatus("scan-unknown")
    };
  }
  const status = await inspectManagedRegistryReceipt({
    receipt,
    ...context,
    registry: scan.entries,
    exists: fs.existsSync,
    realpath: fs.realpathSync.native,
    verifySignature: (filePath, signer) =>
      verifyExpectedSignature(filePath, signer, true)
  });
  return { context, receipt, registryScan: scan, status };
}

async function prepareManagedRegistryDesktopPending(productId, operationTask) {
  const context = managedRegistryDesktopContext(productId);
  if (!context) return null;
  if (
    operationTask?.operation !== "install" ||
    typeof operationTask.operationId !== "string"
  ) {
    throw new Error("桌面安装所有权操作无效");
  }
  const registryScan = await scanRegistryAppsWithStatus();
  if (!registryScan.ok) {
    throw new Error("Windows 卸载项扫描不完整，无法建立安装基线");
  }
  const pending = createManagedRegistryPendingBaseline({
    ...context,
    operationId: operationTask.operationId,
    startedAt: operationTask.startedAt,
    deadlineAt: operationTask.deadlineAt,
    registry: registryScan.keys.map((key) => ({ key }))
  });
  if (!pending) throw new Error("无法建立桌面安装注册表基线");
  if (readManagedRegistryDesktopReceipt(productId)) {
    removeManagedRegistryDesktopReceiptStrict(productId);
  }
  setManagedRegistryDesktopPending(productId, pending);
  return pending;
}

async function detectDesktopProductForOperation(productId) {
  const operationTask = desktopOperationController?.get(productId) || null;
  const packageManagerProduct = getWindowsPackageManagerProduct(productId);
  if (packageManagerProduct && operationTask?.operation === "install") {
    const status = await detectWindowsPackageManagerProduct(
      productId,
      packageManagerProduct
    );
    return status.installed
      ? claimWindowsPackageManagerInstallation(
          productId,
          packageManagerProduct,
          status
        )
      : status;
  }
  const context = managedRegistryDesktopContext(productId);
  if (!context || !operationTask) return detectDesktopProduct(productId);

  const registryScan = await scanRegistryAppsWithStatus();
  if (!registryScan.ok) {
    return managedRegistryDesktopUnknownStatus("scan-unknown");
  }

  if (operationTask.operation === "install") {
    const existingReceipt = readManagedRegistryDesktopReceipt(productId);
    if (existingReceipt) {
      const inspected = await inspectManagedRegistryDesktopInstance(
        productId,
        registryScan
      );
      return publicManagedRegistryDesktopStatus(inspected?.status);
    }
    const pending = readManagedRegistryDesktopPending(productId);
    if (pending) {
      const receipt = await createManagedRegistryReceiptFromTransition({
        pending,
        ...context,
        operationId: operationTask.operationId,
        registry: registryScan.entries,
        exists: fs.existsSync,
        realpath: fs.realpathSync.native,
        verifySignature: (filePath, signer) =>
          verifyExpectedSignature(filePath, signer, true)
      });
      if (receipt) {
        setManagedRegistryDesktopReceipt(productId, receipt);
        try {
          removeManagedRegistryDesktopPendingStrict(productId);
        } catch (error) {
          try {
            removeManagedRegistryDesktopReceiptStrict(productId);
          } catch {
            throw new Error("桌面安装收据提交失败且无法安全回滚");
          }
          throw error;
        }
        const inspected = await inspectManagedRegistryDesktopInstance(
          productId,
          registryScan
        );
        return publicManagedRegistryDesktopStatus(inspected?.status);
      }
    }
    const externalStatus = await detectDesktopProduct(productId, {
      registryScan,
      windowsApps: { ok: true, packages: [], starts: [] }
    });
    return externalStatus.detection === "installed"
      ? managedRegistryDesktopUnknownStatus("receipt-pending")
      : externalStatus;
  }

  const hadReceipt = Boolean(readManagedRegistryDesktopReceipt(productId));
  const status = await detectDesktopProduct(productId, {
    registryScan,
    windowsApps: { ok: true, packages: [], starts: [] }
  });
  if (hadReceipt && status.detection === "absent") {
    removeManagedRegistryDesktopReceiptStrict(productId);
    removeManagedRegistryDesktopPendingStrict(productId);
  }
  return status;
}

function signedCatalogDesktopDownloadOnlyAbsentStatus() {
  return {
    installed: false,
    version: "",
    location: "",
    executable: "",
    appId: "",
    canOpen: false,
    canUninstall: false,
    uninstallMode: "interactive",
    detection: "absent"
  };
}

async function detectDesktopProduct(productId, scanSnapshot = null, catalogResult = null) {
  const packageManagerProduct = getWindowsPackageManagerProduct(productId);
  if (packageManagerProduct) {
    const currentCatalog = catalogResult || (await resolveCatalog());
    if (
      isSignedCatalogDesktopDownloadOnlyProduct({
        productId,
        vendors: currentCatalog?.catalog?.vendors
      })
    ) {
      return signedCatalogDesktopDownloadOnlyAbsentStatus();
    }
    const status = await detectWindowsPackageManagerProduct(
      productId,
      packageManagerProduct,
      scanSnapshot
    );
    return status.detection === "unknown" &&
      isFixedCatalogDesktopDownloadOnlyProduct({
        productId,
        vendors: currentCatalog?.catalog?.vendors
      })
      ? signedCatalogDesktopDownloadOnlyAbsentStatus()
      : status;
  }
  const managedDownload = getStaticManagedDownload(productId);
  const portablePlan = portableDesktopPlan(managedDownload);
  if (portablePlan) {
    const receipt = readPortableDesktopRecord(productId);
    const status = inspectPortableDesktop({
      productId,
      download: managedDownload,
      receipt,
      localAppData: process.env.LOCALAPPDATA || ""
    });
    if (!status.installed || !status.executable) return status;
    const trust = portableDesktopTrustForReceipt(
      managedDownload,
      receipt
    );
    if (!trust) {
      return {
        ...status,
        installed: false,
        version: "",
        executable: "",
        canOpen: false,
        canUninstall: false,
        detection: "unknown",
        ownership: "mismatch"
      };
    }
    const signature = await verifyPortableExecutableTrust(
      status.executable,
      trust
    );
    return signature.ok
      ? status
      : {
          ...status,
          installed: false,
          version: "",
          executable: "",
          canOpen: false,
          canUninstall: false,
          detection: "unknown",
          ownership: "mismatch"
        };
  }
  const probe = DESKTOP_PROBES[productId];
  if (!probe) {
    return {
      installed: false,
      version: "",
      location: "",
      executable: "",
      appId: "",
      canOpen: false,
      canUninstall: false,
      uninstallMode: "interactive",
      detection: "unknown"
    };
  }
  const matches = (value) => matchesDesktopIdentity(probe.names, value);
  const { registryScan, windowsApps } =
    scanSnapshot || (await createDesktopProductScanSnapshot());
  if (
    managedRegistryDesktopContext(productId) &&
    fs.existsSync(managedRegistryDesktopReceiptPath(productId))
  ) {
    const managedInstance = await inspectManagedRegistryDesktopInstance(
      productId,
      registryScan
    );
    return publicManagedRegistryDesktopStatus(managedInstance?.status);
  }
  const registry = registryScan.entries;
  const uninstallRecord = registryScan.ok
    ? trustedDesktopUninstallRecord(productId, registry)
    : null;
  const legacyInstallRecord =
    registryScan.ok && probe.legacyInstall
      ? trustedLegacyDesktopInstallRecord(productId, registry)
      : null;
  const registryCandidate = selectTrustedDesktopRegistryMatch({
    uninstallPolicy: probe.uninstall,
    uninstallRecord
  });
  const packageMatch = probe.appx
    ? trustedDesktopAppxPackage(productId, windowsApps.packages)
    : null;
  const startMatch = windowsApps.starts.find((entry) => matches(entry.Name));
  const uninstallSignature = uninstallRecord
    ? await verifyTrustedDesktopUninstaller(uninstallRecord, probe)
    : null;
  const executableCandidate = probe.uninstall
    ? uninstallRecord
      ? findTrustedProductExecutable({
          entry: uninstallRecord.entry,
          executableNames: probe.executableNames,
          exists: fs.existsSync,
          realpath: fs.realpathSync.native
        })
      : ""
    : normalizedIconPath(registryCandidate?.displayicon);
  const executableSignature =
    executableCandidate && probe.uninstall
      ? await verifyExpectedSignature(executableCandidate, probe.signer, true)
      : null;
  const legacyExecutableCandidate = legacyInstallRecord
    ? findTrustedProductExecutable({
        entry: legacyInstallRecord.entry,
        executableNames: probe.legacyInstall.executableNames,
        exists: fs.existsSync,
        realpath: fs.realpathSync.native
      })
    : "";
  const legacyExecutableSignature = legacyExecutableCandidate
    ? await verifyExpectedSignature(
        legacyExecutableCandidate,
        probe.legacyInstall.signer || probe.signer,
        true
      )
    : null;
  const registryMatch = bindRegistryEvidenceToAuthenticode({
    registryMatch: registryCandidate,
    executableSignature
  });
  const registryEvidenceScanSucceeded =
    registryScan.ok &&
    (!registryCandidate ||
      !executableCandidate ||
      signatureInspectionIsConclusive(executableSignature));
  const executable = probe.uninstall
    ? executableSignature?.ok
      ? executableCandidate
      : ""
    : executableCandidate;
  const installLocation =
    registryMatch?.installlocation ||
    packageMatch?.InstallLocation ||
    (executable ? path.dirname(executable) : "");
  const presence = resolveDesktopPresence({
    evidencePolicy: probe.presenceEvidence,
    registryMatched: Boolean(registryMatch),
    packageMatched: Boolean(packageMatch),
    startMatched: Boolean(startMatch),
    registryScanSucceeded: registryEvidenceScanSucceeded,
    windowsAppsScanSucceeded: windowsApps.ok
  });
  const legacyInstall = resolveDesktopLegacyMigration({
    currentInstalled: presence.installed,
    legacyInstallId: probe.legacyInstall?.id,
    legacyRegistryMatched: Boolean(legacyInstallRecord),
    legacyExecutableSignature
  });
  return {
    installed: presence.installed,
    version: String(
      registryMatch?.displayversion || packageMatch?.Version || ""
    ),
    location:
      installLocation && path.isAbsolute(installLocation)
        ? installLocation
        : "",
    executable,
    appId: presence.installed ? String(startMatch?.AppID || "") : "",
    canOpen:
      presence.installed &&
      (probe.uninstall
        ? Boolean(executable)
        : Boolean(executable || startMatch?.AppID)),
    canUninstall:
      presence.installed &&
      Boolean(
        packageMatch && probe.appx
          ? true
          : uninstallRecord && uninstallSignature?.ok
      ),
    uninstallMode: probe.uninstallMode,
    detection: presence.detection,
    ...(managedRegistryDesktopContext(productId)
      ? { managed: false, ownership: "external" }
      : {}),
    ...(legacyInstall ? { legacyInstall } : {})
  };
}

async function detectDesktopProducts(productIds) {
  const supportedProductIds = productIds.filter(
    (productId) =>
      DESKTOP_PROBES[productId] || windowsPackageManagerPlan(productId)
  );
  const catalogResult = supportedProductIds.some((productId) =>
    Boolean(windowsPackageManagerPlan(productId))
  )
    ? await resolveCatalog()
    : null;
  const includeWindowsPackageManager = supportedProductIds.some(
    (productId) =>
      Boolean(windowsPackageManagerPlan(productId)) &&
      !isSignedCatalogDesktopDownloadOnlyProduct({
        productId,
        vendors: catalogResult?.catalog?.vendors
      })
  );
  return await scanManagedDesktopInventory({
    productIds: supportedProductIds,
    createSnapshot: () =>
      createDesktopProductScanSnapshot({ includeWindowsPackageManager }),
    detectProduct: (productId, snapshot) =>
      detectDesktopProduct(productId, snapshot, catalogResult)
  });
}

async function uninstallTrustedAppxProduct(
  productId,
  probe,
  operationController
) {
  let operationTask = null;
  let processSpawned = false;
  try {
    const firstScan = await scanWindowsApps();
    if (!firstScan.ok) {
      return {
        launched: false,
        error: "Windows 应用包扫描不完整，请稍后重新检测"
      };
    }
    const packageEntry = trustedDesktopAppxPackage(
      productId,
      firstScan.packages
    );
    const interactiveAppxUninstall =
      probe.appx.uninstallStrategy === "windows-settings";
    const action = interactiveAppxUninstall
      ? null
      : createAppxUninstallAction(packageEntry, probe.appx);
    if (!packageEntry || (!interactiveAppxUninstall && !action)) {
      return {
        launched: false,
        error: "未找到名称、发布者和包身份均匹配的可信 Windows 应用"
      };
    }

    const productName = probe.names[0];
    const uninstallPresentation = getDesktopUninstallPresentation(
      productId,
      probe.uninstallMode,
      readSettings().language
    );
    const confirmation = await showDesktopUninstallConfirmation({
      productId,
      mode: probe.uninstallMode,
      language: readSettings().language,
      surface: interactiveAppxUninstall
        ? "windows-settings"
        : "appx-package",
      productName,
      version: packageEntry.Version,
      publisher: packageEntry.Publisher,
      packageFullName: packageEntry.PackageFullName
    });
    if (confirmation.response !== 1) {
      return { launched: false, canceled: true };
    }

    const finalScan = await scanWindowsApps();
    const finalPackage = finalScan.ok
      ? trustedDesktopAppxPackage(productId, finalScan.packages)
      : null;
    if (
      !finalPackage ||
      finalPackage.PackageFullName !== packageEntry.PackageFullName
    ) {
      return {
        launched: false,
        error: "应用包在确认期间发生变化，已拒绝执行卸载"
      };
    }

    operationTask = operationController.begin(productId, "uninstall");
    const identity = {
      generation: operationTask.generation,
      operationId: operationTask.operationId
    };
    const finishLaunch = (launched) => {
      operationTask = operationController.finishLaunch(
        productId,
        identity.generation,
        identity.operationId,
        launched
      );
      return operationTask;
    };
    if (interactiveAppxUninstall) {
      await shell.openExternal("ms-settings:appsfeatures");
      processSpawned = true;
      finishLaunch(true);
      return {
        launched: true,
        operationTask: operationController.get(productId) || operationTask,
        uninstallMode: "interactive",
        message: uninstallPresentation.launched
      };
    }
    const launchResult = await launchProcessWithGrace({
      command: action.executable,
      args: action.args,
      graceMs: 2_000,
      env: isolatedThirdPartyEnvironment(),
      processLabel: "Windows 应用卸载",
      onSpawn: () => {
        processSpawned = true;
        finishLaunch(true);
      }
    });
    if (!launchResult.launched) {
      if (operationTask?.phase === "launching") finishLaunch(false);
      return {
        ...launchResult,
        operationTask,
        error: launchResult.error || `无法卸载 ${productName}`
      };
    }
    if (operationTask?.phase === "launching") finishLaunch(true);
    return {
      ...launchResult,
      operationTask: operationController.get(productId) || operationTask,
      uninstallMode: probe.uninstallMode,
      message: uninstallPresentation.launched
    };
  } catch (error) {
    if (operationTask && !processSpawned) {
      try {
        operationTask = operationController.finishLaunch(
          productId,
          operationTask.generation,
          operationTask.operationId,
          false
        );
      } catch {
        operationTask = operationController.get(productId);
      }
    }
    return {
      launched: false,
      operationTask,
      error:
        error instanceof Error && error.message
          ? `无法卸载 Windows 应用：${error.message}`
          : "无法卸载 Windows 应用"
    };
  }
}

function catalogCachePath(catalogChannel) {
  return path.join(
    app.getPath("userData"),
    catalogChannelStorage(catalogChannel).cacheFileName
  );
}

function catalogHighWaterPath(catalogChannel) {
  return path.join(
    app.getPath("userData"),
    catalogChannelStorage(catalogChannel).highWaterFileName
  );
}

function readCatalogHighWater(catalogChannel) {
  try {
    return normalizeCatalogHighWater(
      JSON.parse(fs.readFileSync(catalogHighWaterPath(catalogChannel), "utf8"))
    );
  } catch {
    return normalizeCatalogHighWater();
  }
}

function writeCatalogHighWater(catalogChannel, release) {
  const highWater = recordCatalogHighWater(
    readCatalogHighWater(catalogChannel),
    release
  );
  writeJsonAtomically(catalogHighWaterPath(catalogChannel), {
    schemaVersion: 1,
    ...highWater
  });
  return highWater;
}

function releaseClientIdPath() {
  return path.join(app.getPath("userData"), "release-client-id.txt");
}

function releaseClientId() {
  return readOrCreateClientId(releaseClientIdPath());
}

function channelPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "catalog", "channel.json")
    : path.join(__dirname, "..", "catalog", "channel.json");
}

function readChannel() {
  try {
    return readCatalogClientChannel(
      JSON.parse(fs.readFileSync(channelPath(), "utf8")),
      {
        kind: "catalog",
        allowLocalhost: !app.isPackaged || LOCAL_RELEASE_ACCEPTANCE
      }
    );
  } catch (error) {
    return {
      schemaVersion: 2,
      kind: "catalog",
      releaseUrl: "",
      allowedReleaseOrigins: [],
      trustedKeys: [],
      catalogChannel: "v1",
      error:
        error instanceof Error ? error.message : "目录发布通道配置无效"
    };
  }
}

async function fetchRemoteCatalogRelease(channel, clientId, highest = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await net.fetch(channel.releaseUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`远程目录返回 ${response.status}`);
    }
    const finalUrl = resolveReleaseResponseUrl(response, channel.releaseUrl);
    if (!channel.allowedReleaseOrigins.includes(finalUrl.origin)) {
      throw new Error("远程目录重定向到了未固定的来源");
    }
    const raw = await readResponseTextWithLimit(
      response,
      CATALOG_RELEASE_MAX_BYTES
    );
    return {
      envelope: JSON.parse(raw),
      release: verifyCatalogRelease(JSON.parse(raw), {
        trustedKeys: channel.trustedKeys,
        clientId,
        highestCatalogVersion: highest?.catalogVersion || 0,
        highestCatalogSha256: highest?.catalogSha256 || ""
      })
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readCachedCatalogRelease(channel, clientId, highest) {
  const release = verifyCatalogReleaseCache(
    JSON.parse(fs.readFileSync(catalogCachePath(channel.catalogChannel), "utf8")),
    {
      expectedSourceUrl: channel.releaseUrl,
      trustedKeys: channel.trustedKeys,
      clientId,
      highestCatalogVersion: highest.catalogVersion,
      highestCatalogSha256: highest.catalogSha256,
      allowLocalhost: !app.isPackaged || LOCAL_RELEASE_ACCEPTANCE
    }
  );
  return {
    ...release,
    catalog: resolveCatalogIconUrls(release.catalog, channel.releaseUrl)
  };
}

async function loadCatalogUnshared() {
  const channel = readChannel();
  if (channel.error) {
    return resolvePackagedCatalogFallback({
      cached: null,
      error: channel.error
    });
  }
  if (!channel.releaseUrl) {
    return resolvePackagedCatalogFallback({
      cached: null,
      error: "后台目录通道尚未配置"
    });
  }
  const clientId = releaseClientId();
  const highest = readCatalogHighWater(channel.catalogChannel);
  let remoteError = "";
  let cached = null;
  try {
    cached = readCachedCatalogRelease(channel, clientId, highest);
  } catch {
    cached = null;
  }
  try {
    const result = await fetchRemoteCatalogRelease(channel, clientId, highest);
    if (!result.release.eligible) {
      return resolvePackagedCatalogFallback({
        cached,
        error: "当前客户端不在目录发布范围内"
      });
    }
    writeCatalogHighWater(channel.catalogChannel, result.release);
    writeJsonAtomically(catalogCachePath(channel.catalogChannel), {
      schemaVersion: 1,
      sourceUrl: channel.releaseUrl,
      cachedAt: new Date().toISOString(),
      envelope: result.envelope
    });
    return {
      source: "remote",
      catalog: resolveCatalogIconUrls(
        result.release.catalog,
        channel.releaseUrl
      ),
      catalogVersion: result.release.catalogVersion,
      error: ""
    };
  } catch (error) {
    remoteError =
      error instanceof Error ? error.message : "远程目录加载失败";
  }
  return resolvePackagedCatalogFallback({ cached, error: remoteError });
}

let catalogResolveInFlight = null;

function resolveCatalog() {
  if (catalogResolveInFlight) return catalogResolveInFlight;
  catalogResolveInFlight = loadCatalogUnshared();
  return catalogResolveInFlight.finally(() => {
    catalogResolveInFlight = null;
  });
}

function authorizeCurrentCatalogProduct(productId, requiredCapability = "install") {
  return authorizeFreshCatalogProduct({
    productId,
    requiredCapability,
    loadCatalog: resolveCatalog
  });
}

function authorizeCurrentDesktopDownloadOnlyProduct(productId, artifact) {
  return authorizeFreshDesktopDownloadOnlyProduct({
    productId,
    artifact,
    loadCatalog: resolveCatalog
  });
}

function updateChannelPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "updates", "channel.json")
    : path.join(__dirname, "..", "updates", "channel.json");
}

function readUpdateChannel() {
  try {
    return readReleaseChannel(
      JSON.parse(fs.readFileSync(updateChannelPath(), "utf8")),
      {
        kind: "update",
        allowLocalhost: !app.isPackaged || LOCAL_RELEASE_ACCEPTANCE
      }
    );
  } catch (error) {
    return {
      schemaVersion: 2,
      kind: "update",
      releaseUrl: "",
      allowedReleaseOrigins: [],
      trustedKeys: [],
      error:
        error instanceof Error ? error.message : "更新通道配置无效"
    };
  }
}

async function fetchUpdateManifest(channel, currentVersion, clientId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await net.fetch(channel.releaseUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`更新服务器返回 ${response.status}`);
    }
    const finalUrl = resolveReleaseResponseUrl(response, channel.releaseUrl);
    if (
      finalUrl.toString() !== channel.releaseUrl ||
      !channel.allowedReleaseOrigins.includes(finalUrl.origin)
    ) {
      throw new Error("更新清单重定向到了未固定的来源");
    }
    const contentType = String(response.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (contentType !== "application/json") {
      throw new Error("更新服务器返回了非 JSON 内容");
    }
    const raw = await readResponseTextWithLimit(response, 64 * 1024);
    return verifyAndEvaluateUpdateRelease(JSON.parse(raw), {
      trustedKeys: channel.trustedKeys,
      allowedDownloadOrigins: channel.allowedReleaseOrigins,
      currentVersion,
      clientId
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkForUpdate() {
  const generation = ++updateCheckGeneration;
  const currentVersion = app.getVersion();
  const channel = readUpdateChannel();
  lastVerifiedUpdateOffer = null;
  if (channel.error) {
    return {
      status: "error",
      currentVersion,
      message: channel.error
    };
  }
  if (!channel.releaseUrl) {
    return {
      status: "disabled",
      currentVersion,
      message: "尚未配置正式 HTTPS 更新通道"
    };
  }
  try {
    const result = await fetchUpdateManifest(
      channel,
      currentVersion,
      releaseClientId()
    );
    if (generation !== updateCheckGeneration) {
      return {
        status: "error",
        currentVersion,
        message: "更新检查已被更新的请求替代"
      };
    }
    if (result.status === "current") {
      return {
        status: "current",
        currentVersion,
        version: result.version,
        message: "当前已是最新版本"
      };
    }
    if (result.status === "not-eligible") {
      return {
        status: "current",
        currentVersion,
        version: result.version,
        message: "当前灰度批次暂无可用更新"
      };
    }
    const release = result.release;
    lastVerifiedUpdateOffer = {
      generation,
      expiresAt: Date.now() + 10 * 60 * 1000,
      version: release.version,
      downloadUrl: release.downloadUrl,
      sha256: release.sha256,
      fileSize: release.fileSize
    };
    return {
      status: "available",
      currentVersion,
      version: release.version,
      publishedAt: release.publishedAt,
      notes: release.notes,
      sha256: release.sha256,
      fileSize: release.fileSize,
      message: `发现新版本 ${release.version}`
    };
  } catch (error) {
    if (generation === updateCheckGeneration) {
      lastVerifiedUpdateOffer = null;
    }
    return {
      status: "error",
      currentVersion,
      message: error instanceof Error ? error.message : "检查更新失败"
    };
  }
}

function softwareUpdateHighWaterPath() {
  return path.join(app.getPath("userData"), "software-update-high-water.json");
}

function readSoftwareUpdateHighWater() {
  try {
    return normalizeSoftwareUpdateHighWater(
      JSON.parse(fs.readFileSync(softwareUpdateHighWaterPath(), "utf8"))
    );
  } catch {
    return normalizeSoftwareUpdateHighWater();
  }
}

function softwareUpdateReleaseUrl(channel) {
  if (!channel?.releaseUrl) return "";
  const releaseUrl = new URL("/software-update-release.json", channel.releaseUrl);
  if (
    !channel.allowedReleaseOrigins.includes(releaseUrl.origin) ||
    releaseUrl.username ||
    releaseUrl.password ||
    releaseUrl.search ||
    releaseUrl.hash
  ) {
    throw new Error("软件更新发布地址不属于客户端固定来源");
  }
  return releaseUrl.toString();
}

async function fetchSoftwareUpdateRelease(channel, clientId, highWater) {
  const releaseUrl = softwareUpdateReleaseUrl(channel);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await net.fetch(releaseUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`软件更新服务器返回 ${response.status}`);
    }
    const finalUrl = resolveReleaseResponseUrl(response, releaseUrl);
    if (
      finalUrl.toString() !== releaseUrl ||
      !channel.allowedReleaseOrigins.includes(finalUrl.origin)
    ) {
      throw new Error("软件更新清单重定向到了未固定的来源");
    }
    const contentType = String(response.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (contentType !== "application/json") {
      throw new Error("软件更新服务器返回了非 JSON 内容");
    }
    const raw = await readResponseTextWithLimit(response, 64 * 1024);
    return verifySoftwareUpdateRelease(JSON.parse(raw), {
      trustedKeys: channel.trustedKeys,
      clientId,
      highWater
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkSoftwareUpdates() {
  const generation = ++softwareUpdateCheckGeneration;
  const channel = readChannel();
  lastVerifiedSoftwareUpdateRelease = null;
  if (channel.error) {
    return { status: "error", message: channel.error, publishedEntries: 0 };
  }
  if (!channel.releaseUrl) {
    return {
      status: "disabled",
      message: "尚未配置软件更新发布通道",
      publishedEntries: 0
    };
  }
  try {
    const release = await fetchSoftwareUpdateRelease(
      channel,
      releaseClientId(),
      readSoftwareUpdateHighWater()
    );
    if (generation !== softwareUpdateCheckGeneration) {
      return {
        status: "error",
        message: "软件更新检查已被更新的请求替代",
        publishedEntries: 0
      };
    }
    if (!release.eligible) {
      return {
        status: "current",
        releaseVersion: release.releaseVersion,
        publishedAt: release.publishedAt,
        message: "当前灰度批次暂无软件更新",
        publishedEntries: 0
      };
    }
    writeJsonAtomically(
      softwareUpdateHighWaterPath(),
      recordSoftwareUpdateHighWater(readSoftwareUpdateHighWater(), release)
    );
    lastVerifiedSoftwareUpdateRelease = release;
    return {
      status: release.entries.length ? "available" : "current",
      releaseVersion: release.releaseVersion,
      publishedAt: release.publishedAt,
      message: release.entries.length
        ? `后台已发布 ${release.entries.length} 项软件更新`
        : "当前软件均为最新版本",
      publishedEntries: release.entries.length
    };
  } catch (error) {
    if (generation === softwareUpdateCheckGeneration) {
      lastVerifiedSoftwareUpdateRelease = null;
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "检查软件更新失败",
      publishedEntries: 0
    };
  }
}

function assertSoftwareUpdatePublished(input) {
  if (!isSoftwareUpdatePublished(lastVerifiedSoftwareUpdateRelease, input)) {
    const error = new Error("该更新尚未由管理员发布，请重新打开软件后再试");
    error.code = "SOFTWARE_UPDATE_NOT_PUBLISHED";
    throw error;
  }
}

function cliPlanVersion(plan) {
  return String(plan?.expectedVersion || plan?.version || "").trim();
}

function extensionProfileVersion(profile) {
  return String(
    profile?.versionRef || profile?.sourceManifest?.versionRef || ""
  ).trim();
}

function filterPublishedExtensionUpdates(profileId, status) {
  if (!status || !Array.isArray(status.allowedActions)) return status;
  const profile = getExtensionRuntimeProfile(profileId);
  const version = extensionProfileVersion(profile);
  if (
    !status.allowedActions.includes("update") ||
    (version && isSoftwareUpdatePublished(lastVerifiedSoftwareUpdateRelease, {
      kind: "extension",
      subjectId: profileId,
      mode: "extension",
      version
    }))
  ) {
    return status;
  }
  return {
    ...status,
    allowedActions: status.allowedActions.filter((action) => action !== "update")
  };
}

function readSettings() {
  try {
    const value = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    return {
      downloadDirectory:
        typeof value.downloadDirectory === "string"
          ? value.downloadDirectory
          : "",
      cliInstallDirectory:
        typeof value.cliInstallDirectory === "string"
          ? value.cliInstallDirectory
          : "",
      language: value.language === "en" ? "en" : "zh"
    };
  } catch {
    return {
      downloadDirectory: "",
      cliInstallDirectory: "",
      language: "zh"
    };
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(settings, null, 2), "utf8");
}

function localizedSystemOptions(options) {
  return localizeRuntimePayload(options, readSettings().language);
}

function showLocalizedMessageBox(options) {
  return dialog.showMessageBox(localizedSystemOptions(options));
}

function showDesktopUninstallConfirmation(options) {
  // This presentation is already localized as one structured unit. Sending it
  // through the generic runtime localizer would replace the whole detail when
  // opaque Windows metadata (for example a product name or path) contains Han
  // characters, discarding the reviewed version, signer and retention facts.
  return dialog.showMessageBox(buildDesktopUninstallConfirmation(options));
}

function showDesktopInstallConfirmation(options) {
  return dialog.showMessageBox(buildDesktopInstallConfirmation(options));
}

async function probeMicrosoftStoreEndpoint() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    await refreshManagedDownloadSession({
      networkSession: session.defaultSession
    });
    const response = await session.defaultSession.fetch(
      MICROSOFT_STORE_WEB_URL,
      {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal
      }
    );
    await response.body?.cancel().catch(() => {});
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function inspectMicrosoftStoreHealth() {
  const [windowsApps, endpointReachable] = await Promise.all([
    scanWindowsApps(),
    probeMicrosoftStoreEndpoint()
  ]);
  return analyzeMicrosoftStoreHealth({
    scanOk: windowsApps.ok,
    packages: windowsApps.packages,
    endpointReachable
  });
}

async function runMicrosoftStoreRepairTool() {
  const language = readSettings().language;
  const health = await inspectMicrosoftStoreHealth();
  const presentation = buildMicrosoftStoreRepairDialog({ language, health });
  const choice = await dialog.showMessageBox(presentation.options);
  const action = presentation.actions[choice.response] || "close";

  if (action === "open-proxy-settings") {
    await shell.openExternal("ms-settings:network-proxy");
    return { opened: true, action, health };
  }
  if (action === "open-repair-settings") {
    await shell.openExternal(microsoftStoreRepairSettingsUri(health));
    return { opened: true, action, health };
  }
  if (action === "open-windows-update") {
    await shell.openExternal("ms-settings:windowsupdate");
    return { opened: true, action, health };
  }
  if (action === "open-official-help") {
    await shell.openExternal(MICROSOFT_STORE_SUPPORT_URL);
    return { opened: true, action, health };
  }
  if (action === "reset-cache") {
    const wsreset = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "wsreset.exe"
    );
    if (!fs.existsSync(wsreset)) {
      return {
        opened: false,
        action,
        health,
        error:
          language === "en"
            ? "Windows wsreset.exe was not found."
            : "Windows 未找到 wsreset.exe。"
      };
    }
    const launch = await launchProcessWithGrace({
      command: wsreset,
      graceMs: 2_000,
      processLabel:
        language === "en" ? "Microsoft Store cache reset" : "商店缓存重置"
    });
    return { opened: launch.launched, action, health, ...launch };
  }
  return { opened: false, action: "close", health, canceled: true };
}

function showLocalizedOpenDialog(options) {
  return dialog.showOpenDialog(localizedSystemOptions(options));
}

async function locateNpmRuntime(plan = {}) {
  const probe = await locateAllWithStatus("node.exe");
  const runtimes = [];
  for (const candidate of probe.locations) {
    try {
      runtimes.push(await inspectNpmRuntimeCandidate(candidate));
    } catch {
      // Continue to the next signed Node/npm pair on PATH.
    }
  }
  const selected = probe.ok
    ? selectCompatibleNodeRuntime(runtimes, plan)
    : null;
  if (!selected) {
    throw new Error("未找到满足该产品版本要求的可信 Node.js 与 npm");
  }
  return selected;
}

async function inspectNpmRuntimeCandidate(nodeExecutable) {
  const npmCommand = path.join(path.dirname(nodeExecutable), "npm.cmd");
  if (!nodeExecutable || !npmCommand) {
    throw new Error("未检测到 Node.js 与 npm");
  }
  let canonicalNode;
  let canonicalNpmCommand;
  try {
    canonicalNode = fs.realpathSync.native(nodeExecutable);
    canonicalNpmCommand = fs.realpathSync.native(npmCommand);
  } catch {
    throw new Error("Node.js 或 npm 路径无法安全解析");
  }
  const nodeDirectory = path.dirname(canonicalNode);
  if (
    path.basename(canonicalNode).toLowerCase() !== "node.exe" ||
    path.dirname(canonicalNpmCommand).toLowerCase() !== nodeDirectory.toLowerCase()
  ) {
    throw new Error("Node.js 与 npm 不属于同一个可信安装目录");
  }
  const npmCliCandidate = path.join(
    nodeDirectory,
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js"
  );
  let npmCli;
  try {
    npmCli = fs.realpathSync.native(npmCliCandidate);
  } catch {
    throw new Error("无法定位 npm-cli.js");
  }
  if (npmCli.toLowerCase() !== npmCliCandidate.toLowerCase()) {
    throw new Error("npm-cli.js 路径发生跳转，已拒绝使用");
  }
  const npmManifestPath = path.join(
    nodeDirectory,
    "node_modules",
    "npm",
    "package.json"
  );
  let npmManifest;
  try {
    npmManifest = JSON.parse(fs.readFileSync(npmManifestPath, "utf8"));
  } catch {
    throw new Error("npm 安装信息无法读取");
  }
  if (
    npmManifest?.name !== "npm" ||
    typeof npmManifest?.version !== "string" ||
    !/^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/.test(npmManifest.version)
  ) {
    throw new Error("npm 安装信息无效");
  }
  const signature = await verifyExpectedSignature(
    canonicalNode,
    ENVIRONMENT_PLANS.node.installedSigner,
    true
  );
  if (!signature.ok) {
    throw new Error("Node.js 数字签名与预期发布者不匹配");
  }
  const [nodeSha256, npmCliSha256] = await Promise.all([
    fileSha256(canonicalNode),
    fileSha256(npmCli)
  ]);
  const npmTreeSha256 = computeNpmTreeSha256(
    path.join(nodeDirectory, "node_modules", "npm")
  );
  if (!npmTreeSha256) {
    throw new Error("npm 安装目录包含链接、跳转或无法读取的文件");
  }
  let nodeVersion;
  try {
    const versionResult = await execFileAsync(canonicalNode, ["--version"], {
      windowsHide: true,
      shell: false,
      timeout: 10_000,
      maxBuffer: 64 * 1024
    });
    nodeVersion = String(versionResult.stdout || "").trim().replace(/^v/, "");
  } catch {
    throw new Error("无法确认 Node.js 版本");
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(nodeVersion)) {
    throw new Error("Node.js 版本信息无效");
  }
  return {
    nodeExecutable: canonicalNode,
    npmCli,
    nodeSha256,
    npmCliSha256,
    npmTreeSha256,
    npmVersion: npmManifest.version,
    nodeVersion
  };
}

const NPM_EXECUTION_DIRECTORY_PREFIX = "aihub-npm-exec-";
const OFFICIAL_NPM_REGISTRY = "https://registry.npmjs.org/";

function createNpmExecutionContext() {
  const temporaryRoot = fs.realpathSync.native(app.getPath("temp"));
  const directory = fs.mkdtempSync(
    path.join(temporaryRoot, NPM_EXECUTION_DIRECTORY_PREFIX)
  );
  const userConfigPath = path.join(directory, "user.npmrc");
  const globalConfigPath = path.join(directory, "global.npmrc");
  fs.writeFileSync(userConfigPath, "# Isolated ZhenXing AI Assistant user npm configuration\n", {
    encoding: "utf8",
    flag: "wx"
  });
  fs.writeFileSync(
    globalConfigPath,
    "# Isolated ZhenXing AI Assistant global npm configuration\n",
    { encoding: "utf8", flag: "wx" }
  );
  return { directory, userConfigPath, globalConfigPath, temporaryRoot };
}

function removeNpmExecutionContext(context) {
  if (!context?.directory || !context?.temporaryRoot) return;
  try {
    const resolvedRoot = fs.realpathSync.native(context.temporaryRoot);
    const resolvedDirectory = fs.realpathSync.native(context.directory);
    if (
      path.dirname(resolvedDirectory).toLowerCase() !== resolvedRoot.toLowerCase() ||
      !path.basename(resolvedDirectory).startsWith(NPM_EXECUTION_DIRECTORY_PREFIX) ||
      resolvedDirectory.toLowerCase() === resolvedRoot.toLowerCase() ||
      resolvedDirectory.toLowerCase() === path.parse(resolvedDirectory).root.toLowerCase()
    ) {
      return;
    }
    fs.rmSync(resolvedDirectory, { recursive: true, force: true });
  } catch {
    // The context may already be gone; never broaden the cleanup target.
  }
}

function safeNpmEnvironment(context) {
  const blocked = new Set([
    "node_options",
    "node_path",
    "npm_node_execpath",
    "npm_execpath"
  ]);
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => {
      const normalized = key.toLowerCase();
      return !blocked.has(normalized) && !normalized.startsWith("npm_config_");
    })
  );
  environment.npm_config_update_notifier = "false";
  environment.npm_config_userconfig = context.userConfigPath;
  environment.npm_config_globalconfig = context.globalConfigPath;
  environment.npm_config_registry = OFFICIAL_NPM_REGISTRY;
  environment.npm_config_ignore_scripts = "true";
  return environment;
}

function sameNpmRuntime(left, right) {
  return [
    "nodeExecutable",
    "npmCli",
    "nodeSha256",
    "npmCliSha256",
    "npmTreeSha256",
    "npmVersion"
  ].every((key) => String(left?.[key] || "") === String(right?.[key] || ""));
}

function readInstalledCliVersion(directory, packageName) {
  try {
    const manifest = path.join(
      directory,
      "node_modules",
      ...packageName.split("/"),
      "package.json"
    );
    const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
    return value.name === packageName && typeof value.version === "string"
      ? value.version
      : "";
  } catch {
    return "";
  }
}

async function runReviewedCliPostInstall({
  emit,
  productId,
  directory,
  plan,
  runtime,
  executionContext
}) {
  if (!plan.postInstall) return { ok: true };
  try {
    const confirmedRuntime = await locateNpmRuntime(plan);
    if (!sameNpmRuntime(runtime, confirmedRuntime)) {
      return {
        ok: false,
        error: "CLI 安装期间 Node.js 或 npm 运行环境发生变化，已拒绝执行后置步骤"
      };
    }
    const action = createManagedCliPostInstallAction({
      productId,
      plan,
      prefix: directory,
      runtime: confirmedRuntime
    });
    if (!action) {
      return {
        ok: false,
        error: "官方软件包的 postinstall 契约与客户端审核记录不一致"
      };
    }
    emit("stdout", `正在运行已审核的 ${plan.name} 官方后置安装步骤`);
    const postInstall = await execFileAsync(action.executable, action.args, {
      ...action.options,
      env: {
        ...safeNpmEnvironment(executionContext),
        npm_lifecycle_event: "postinstall",
        npm_package_name: action.packageName,
        npm_package_version: action.version
      },
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024
    });
    if (postInstall.stdout?.trim()) emit("stdout", postInstall.stdout.trim());
    if (postInstall.stderr?.trim()) emit("stderr", postInstall.stderr.trim());

    let executable;
    try {
      executable = fs.realpathSync.native(action.expectedExecutable);
      const stat = fs.lstatSync(action.expectedExecutable);
      if (
        executable.toLowerCase() !== action.expectedExecutable.toLowerCase() ||
        !stat.isFile() ||
        stat.isSymbolicLink()
      ) {
        throw new Error("invalid executable");
      }
    } catch {
      return {
        ok: false,
        error: `${plan.name} 后置安装结束，但未生成可信的原生可执行文件`
      };
    }
    const verificationExecutable = action.verificationWithNode
      ? confirmedRuntime.nodeExecutable
      : executable;
    const verificationArgs = action.verificationWithNode
      ? [executable, ...action.verificationArgs]
      : action.verificationArgs;
    const verification = await execFileAsync(
      verificationExecutable,
      verificationArgs,
      {
        cwd: path.dirname(executable),
        windowsHide: true,
        shell: false,
        env: safeNpmEnvironment(executionContext),
        timeout: 30000,
        maxBuffer: 1024 * 1024
      }
    );
    const versionOutput = `${verification.stdout || ""}\n${verification.stderr || ""}`.trim();
    if (!versionOutput) {
      return { ok: false, error: `${plan.name} 可执行文件未返回版本信息` };
    }
    emit("stdout", `${plan.name} 验证通过：${versionOutput.slice(0, 500)}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `${plan.name} 后置安装或启动验证失败：${error.message}`
          : `${plan.name} 后置安装或启动验证失败`
    };
  }
}

function decodeWslOutput(value) {
  if (Buffer.isBuffer(value)) {
    const encoding = value.length > 1 && value[1] === 0 ? "utf16le" : "utf8";
    return value.toString(encoding).replace(/^\uFEFF/, "");
  }
  return String(value || "").replace(/\0/g, "");
}

async function listWslDistributions(wslExecutable) {
  try {
    const result = await execFileAsync(wslExecutable, ["--list", "--quiet"], {
      windowsHide: true,
      shell: false,
      encoding: "buffer",
      timeout: 30_000,
      maxBuffer: 1024 * 1024
    });
    return decodeWslOutput(result.stdout)
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function scanWslDistributionEnvironments() {
  const wslExecutable = systemCommandPath("wsl.exe");
  const distributions = await listWslDistributions(wslExecutable);
  const definitionsByDistribution = new Map();
  for (const [productId, plan] of Object.entries(CLI_INSTALL_PLANS)) {
    if (plan?.driver !== "wsl-managed") continue;
    const definitions = buildWslEnvironmentDefinitions({
      productId,
      productName: plan.name || productId,
      plan
    });
    if (!definitions.length) continue;
    const current = definitionsByDistribution.get(plan.distribution) || [];
    current.push(...definitions.map((definition) => ({ definition, plan })));
    definitionsByDistribution.set(plan.distribution, current);
  }

  return await Promise.all(
    distributions.map(async (distribution) => {
      const configured = definitionsByDistribution.get(distribution) || [];
      const environments = await Promise.all(
        configured.map(async ({ definition, plan }) => {
          const action = createWslEnvironmentProbeAction({
            wslExecutable,
            distribution,
            dependencyId: definition.id,
            plan
          });
          if (!action) {
            return parseWslEnvironmentProbe({
              definition,
              distribution,
              stdout: "",
              installed: false
            });
          }
          try {
            const result = await execFileAsync(action.executable, action.args, {
              ...action.options,
              timeout: 20_000,
              maxBuffer: 256 * 1024
            });
            return parseWslEnvironmentProbe({
              definition,
              distribution,
              stdout: decodeWslOutput(result.stdout)
            });
          } catch {
            return parseWslEnvironmentProbe({
              definition,
              distribution,
              stdout: "",
              installed: false
            });
          }
        })
      );
      return { name: distribution, environments };
    })
  );
}

async function inspectManagedWslStatus(productId, plan) {
  const wslExecutable = systemCommandPath("wsl.exe");
  const distributions = await listWslDistributions(wslExecutable);
  const receipt = readManagedCliRecords()[productId] || null;
  if (!distributions.some((name) => name.toLowerCase() === plan.distribution.toLowerCase())) {
    const status = inspectManagedWslCli({
      productId,
      plan,
      receipt,
      probe: { ok: false }
    });
    managedWslStatusCache.set(productId, status);
    return status;
  }
  const action = createManagedWslProbeAction({
    productId,
    plan,
    receipt,
    wslExecutable
  });
  if (!action) {
    const status = inspectManagedWslCli({ productId, plan, receipt, probe: { unknown: true } });
    managedWslStatusCache.set(productId, status);
    return status;
  }
  try {
    const result = await execFileAsync(action.executable, action.args, {
      ...action.options,
      timeout: 30_000,
      maxBuffer: 1024 * 1024
    });
    const output = `${decodeWslOutput(result.stdout)}\n${decodeWslOutput(result.stderr)}`.trim();
    const version = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
    const status = inspectManagedWslCli({
      productId,
      plan,
      receipt,
      probe: { ok: Boolean(version), version }
    });
    managedWslStatusCache.set(productId, status);
    return status;
  } catch (error) {
    const output = `${decodeWslOutput(error?.stdout)}\n${decodeWslOutput(error?.stderr)}`;
    const status = inspectManagedWslCli({
      productId,
      plan,
      receipt,
      probe: /not found|No such file|command not found/i.test(output)
        ? { ok: false }
        : { unknown: true }
    });
    managedWslStatusCache.set(productId, status);
    return status;
  }
}

function readOptionalJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function latestOpenClawSetupJournal() {
  const roots = [
    path.join(app.getPath("appData"), "OpenClawTray", "Logs", "Setup"),
    path.join(process.env.LOCALAPPDATA || app.getPath("appData"), "OpenClawTray", "Logs", "Setup")
  ];
  const candidates = [];
  for (const root of roots) {
    try {
      for (const name of fs.readdirSync(root)) {
        if (!/^setup-engine-.+\.journal\.jsonl$/i.test(name)) continue;
        const filePath = path.join(root, name);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) candidates.push({ filePath, modifiedAt: stat.mtimeMs });
      }
    } catch {
      // An absent log directory is a valid not-yet-configured state.
    }
  }
  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt);
  if (!candidates[0]) return { state: "idle" };
  try {
    return parseOpenClawSetupJournal(
      fs.readFileSync(candidates[0].filePath, "utf8")
    );
  } catch {
    return { state: "idle" };
  }
}

async function inspectOpenClawCompanionStatus(plan) {
  const hubStatus = await detectDesktopProduct(plan.hubProductId);
  const wslExecutable = systemCommandPath("wsl.exe");
  const distributions = await listWslDistributions(wslExecutable);
  const hasGateway = distributions.some(
    (name) => name.toLowerCase() === plan.distribution.toLowerCase()
  );
  let versionProbe = { ok: false };
  let gatewayProbe = { ok: false };
  if (hasGateway) {
    try {
      const version = await execFileAsync(
        wslExecutable,
        [
          "--distribution",
          plan.distribution,
          "--user",
          "openclaw",
          "--exec",
          "sh",
          "-lc",
          "command -v openclaw >/dev/null 2>&1 && openclaw --version"
        ],
        { windowsHide: true, shell: false, timeout: 30_000, maxBuffer: 256 * 1024 }
      );
      const output = `${decodeWslOutput(version.stdout)}\n${decodeWslOutput(version.stderr)}`
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      versionProbe = output ? { ok: true, version: output } : { ok: false };
    } catch (error) {
      const output = `${decodeWslOutput(error?.stdout)}\n${decodeWslOutput(error?.stderr)}`;
      versionProbe = /not found|command not found|No such file/i.test(output)
        ? { ok: false }
        : { ok: false, unknown: true };
    }
    if (versionProbe.ok) {
      try {
        await execFileAsync(
          wslExecutable,
          [
            "--distribution",
            plan.distribution,
            "--user",
            "openclaw",
            "--exec",
            "sh",
            "-lc",
            "openclaw gateway status --json --require-rpc"
          ],
          { windowsHide: true, shell: false, timeout: 30_000, maxBuffer: 1024 * 1024 }
        );
        gatewayProbe = { ok: true, ready: true };
      } catch {
        gatewayProbe = { ok: false, ready: false };
      }
    }
  }

  const hubRoot = hubStatus.executable ? path.dirname(hubStatus.executable) : "";
  const cleanupScript = hubRoot ? path.join(hubRoot, plan.cleanupScript) : "";
  let cleanupScriptTrusted = false;
  try {
    cleanupScriptTrusted =
      Boolean(cleanupScript && fs.statSync(cleanupScript).isFile()) &&
      fileIntegritySync(cleanupScript, "sha256").toLowerCase() ===
        plan.cleanupScriptSha256.toLowerCase();
  } catch {
    cleanupScriptTrusted = false;
  }
  const setupState =
    readOptionalJson(path.join(process.env.LOCALAPPDATA || app.getPath("appData"), "OpenClawTray", "setup-state.json")) ||
    readOptionalJson(path.join(app.getPath("appData"), "OpenClawTray", "setup-state.json"));
  const status = inspectOpenClawCompanionRuntime({
    hubStatus,
    distributions,
    versionProbe,
    gatewayProbe,
    setupState,
    journalState: latestOpenClawSetupJournal(),
    cleanupScriptTrusted
  });
  managedWslStatusCache.set("openclaw-wsl-gateway", status);
  return status;
}

function unknownCliStatus(overrides = {}) {
  return {
    installed: false,
    version: "",
    directory: "",
    detection: "unknown",
    managed: false,
    canUninstall: false,
    canUpdate: false,
    canRepair: false,
    ownership: "unknown",
    ...overrides
  };
}

function getNpmCliStatus({ productId, plan }) {
  const records = readManagedCliRecords();
  const status = inspectManagedCli({
    productId,
    plan,
    receipt: records[productId] || null,
    configuredPrefix:
      discoveredCliPrefixes.get(productId) ||
      readSettings().cliInstallDirectory ||
      ""
  });
  return {
    ...status,
    canRepair: ["managed", "stale"].includes(status.ownership)
  };
}

function getCompanionRuntimeCliStatus({ productId, plan }) {
  return managedWslStatusCache.get(productId) ||
    unknownCliStatus({
      directory: `WSL:${plan.distribution}`,
      requiresInstallDirectory: false,
      summary: "正在检测 OpenClaw 本地网关"
    });
}

function getWslManagedCliStatus({ productId, plan }) {
  return managedWslStatusCache.get(productId) ||
    unknownCliStatus({
      directory: `${plan.distribution}:${plan.managedPrefix}`
    });
}

function getPortableBinaryCliStatus({ productId, plan }) {
  const records = readManagedCliRecords();
  return inspectManagedBinaryCli({
    productId,
    plan,
    receipt: records[productId] || null,
    configuredPrefix: readSettings().cliInstallDirectory || "",
    architecture: process.arch,
    verifyIntegrity: false,
    hashFile: fileIntegritySync
  });
}

function getPythonVenvCliStatus({ productId, plan }) {
  const records = readManagedCliRecords();
  return inspectManagedPythonCli({
    productId,
    plan,
    receipt: records[productId] || null,
    configuredPrefix: readSettings().cliInstallDirectory || "",
    hashFile: (filePath) => fileIntegritySync(filePath, "sha256")
  });
}

function getManagedMsiCliStatus({ productId, plan }) {
  const records = readManagedCliRecords();
  return inspectManagedMsiCli({
    productId,
    plan,
    receipt: records[productId] || null,
    localAppData: process.env.LOCALAPPDATA || "",
    programFiles: process.env.ProgramFiles || "",
    hashFile: (filePath) => fileIntegritySync(filePath, "sha256")
  });
}

function getCliStatus(productId) {
  const plan = CLI_INSTALL_PLANS[productId];
  if (!plan) return unknownCliStatus();
  return CLI_DRIVER_REGISTRY.status({ productId, plan });
}

async function discoverNpmCliStatus({ productId, plan }) {
  let current = getNpmCliStatus({ productId, plan });
  if (current.installed) return current;

  const commandPath = await locate(`${plan.commandName}.cmd`);
  const prefix = inferNpmPrefixFromCommandPath(commandPath, plan.commandName);
  if (!prefix) return current;
  const discovered = inspectManagedCli({
    productId,
    plan,
    receipt: null,
    configuredPrefix: prefix
  });
  if (!discovered.installed) return current;
  discoveredCliPrefixes.set(productId, prefix);
  return getNpmCliStatus({ productId, plan });
}

async function discoverCompanionRuntimeCliStatus({ plan }) {
  return await inspectOpenClawCompanionStatus(plan);
}

async function discoverWslManagedCliStatus({ productId, plan }) {
  return await inspectManagedWslStatus(productId, plan);
}

async function discoverPortableBinaryCliStatus({ productId, plan }) {
  const current = getPortableBinaryCliStatus({ productId, plan });
  if (current.ownership !== "untracked") return current;
  const receipt = createPortableBinaryReceipt({
    productId,
    plan,
    prefix: readSettings().cliInstallDirectory || "",
    architecture: process.arch,
    hashFile: fileIntegritySync
  });
  if (receipt) {
    try {
      setManagedCliRecord(productId, receipt);
      return getPortableBinaryCliStatus({ productId, plan });
    } catch {
      // Leave the verified executable untouched if persistence is unavailable.
    }
  }
  return current;
}

async function discoverPythonVenvCliStatus({ productId, plan }) {
  const current = getPythonVenvCliStatus({ productId, plan });
  if (current.ownership !== "untracked") return current;
  const prefix = readSettings().cliInstallDirectory || "";
  const installAction = createPythonPipInstallAction({ productId, plan, prefix });
  const layout = createManagedPythonLayout({ productId, plan, prefix });
  try {
    if (
      installAction &&
      layout &&
      fs.readFileSync(layout.requirementsLock, "utf8") ===
        installAction.requirementsText
    ) {
      const verification = await execFileAsync(
        layout.pythonExecutable,
        [
          "-I",
          "-c",
          "import importlib.metadata as m,sys;print(m.version(sys.argv[1]))",
          plan.distributionName
        ],
        {
          cwd: layout.directory,
          windowsHide: true,
          shell: false,
          env: safePythonEnvironment(plan),
          timeout: 30_000,
          maxBuffer: 64 * 1024
        }
      );
      if (String(verification.stdout || "").trim() === plan.version) {
        const receipt = createManagedPythonReceipt({
          productId,
          plan,
          prefix,
          hashFile: (filePath) => fileIntegritySync(filePath, "sha256")
        });
        if (receipt) {
          setManagedCliRecord(productId, receipt);
          return getPythonVenvCliStatus({ productId, plan });
        }
      }
    }
  } catch {
    // Keep unverified Python installations visible but non-destructive.
  }
  return current;
}

async function discoverManagedMsiCliStatus({ productId, plan }) {
  const current = getManagedMsiCliStatus({ productId, plan });
  if (current.ownership !== "untracked") return current;
  const layout = createManagedMsiCliLayout({
    productId,
    plan,
    localAppData: process.env.LOCALAPPDATA || "",
    programFiles: process.env.ProgramFiles || ""
  });
  try {
    if (layout) {
      const signature = await verifyPortableExecutableTrust(
        layout.executable,
        managedMsiTrust(plan)
      );
      const version = await execFileAsync(layout.executable, ["--version"], {
        cwd: layout.directory,
        windowsHide: true,
        shell: false,
        timeout: 30_000,
        maxBuffer: 64 * 1024
      });
      if (
        signature.ok &&
        `${version.stdout || ""}\n${version.stderr || ""}`.includes(plan.version)
      ) {
        const receipt = createManagedMsiCliReceipt({
          productId,
          plan,
          localAppData: process.env.LOCALAPPDATA || "",
          programFiles: process.env.ProgramFiles || "",
          hashFile: (filePath) => fileIntegritySync(filePath, "sha256")
        });
        if (receipt) {
          setManagedCliRecord(productId, receipt);
          return getManagedMsiCliStatus({ productId, plan });
        }
      }
    }
  } catch {
    // Keep an unverified MSI installation visible but non-destructive.
  }
  return current;
}

async function discoverCliStatus(productId) {
  const plan = CLI_INSTALL_PLANS[productId];
  if (!plan) return unknownCliStatus();
  return await CLI_DRIVER_REGISTRY.discover({ productId, plan });
}

function systemCommandPath(fileName) {
  return path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    fileName
  );
}

function openNpmCli({ productId, plan, status }) {
  return createManagedCliTerminalAction({
    productId,
    plan,
    status,
    commandExecutable: systemCommandPath("cmd.exe"),
    exists: fs.existsSync,
    realpath: fs.realpathSync.native
  });
}

async function openCompanionRuntimeCli({ plan }) {
  const hubStatus = await detectDesktopProduct(plan.hubProductId);
  const action = createOpenClawCompanionAction(hubStatus, plan.openAction);
  if (action) {
    action.options = {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      shell: false
    };
  }
  return action;
}

function openWslManagedCli({ productId, plan, status }) {
  return createManagedWslOpenAction({
    productId,
    plan,
    receipt: productId ? readManagedCliRecords()[productId] || null : null,
    status,
    wslExecutable: systemCommandPath("wsl.exe"),
    commandExecutable: systemCommandPath("cmd.exe")
  });
}

function openPortableBinaryCli({ productId, plan }) {
  const records = readManagedCliRecords();
  const strictStatus = inspectManagedBinaryCli({
    productId,
    plan,
    receipt: records[productId] || null,
    configuredPrefix: readSettings().cliInstallDirectory || "",
    architecture: process.arch,
    verifyIntegrity: true,
    hashFile: fileIntegritySync
  });
  return createManagedBinaryTerminalAction({
    productId,
    plan,
    status: strictStatus,
    commandExecutable: systemCommandPath("cmd.exe")
  });
}

function openPythonVenvCli({ productId, plan, status }) {
  return createManagedPythonTerminalAction({
    productId,
    plan,
    status,
    commandExecutable: systemCommandPath("cmd.exe")
  });
}

function openManagedMsiCli({ productId, plan, status }) {
  return createManagedMsiTerminalAction({
    productId,
    plan,
    status,
    commandExecutable: systemCommandPath("cmd.exe")
  });
}

async function openManagedCliTerminal(productId) {
  const plan = CLI_INSTALL_PLANS[productId];
  if (!plan) {
    return { ok: false, error: "该产品不在客户端 CLI 启动白名单中" };
  }
  const status = await discoverCliStatus(productId);
  if (plan.managedSettings) {
    const settingsResult = applyManagedCliSettings({
      homeDirectory: app.getPath("home"),
      policy: plan.managedSettings
    });
    if (!settingsResult.ok) {
      return { ok: false, error: settingsResult.error };
    }
  }
  const action = await CLI_DRIVER_REGISTRY.open({ productId, plan, status });
  if (!action) {
    return {
      ok: false,
      error: status.installed
        ? `CLI 启动入口与${BRAND.name}管理记录不一致`
        : "该 CLI 尚未安装"
    };
  }
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      const child = spawn(action.executable, action.args, {
        ...action.options,
        ...(action.environment
          ? { env: { ...process.env, ...action.environment } }
          : {})
      });
      child.once("spawn", () => {
        child.unref();
        finish({ ok: true });
      });
      child.once("error", (error) =>
        finish({
          ok: false,
          error: `无法打开 CLI 命令窗口：${error.message}`
        })
      );
    } catch (error) {
      finish({
        ok: false,
        error:
          error instanceof Error
            ? `无法打开 CLI 命令窗口：${error.message}`
            : "无法打开 CLI 命令窗口"
      });
    }
  });
}

function openClawJournalIsCurrent(status, startedAtMs) {
  const timestamp = Date.parse(status?.setupTimestamp || "");
  return Number.isFinite(timestamp) && timestamp >= startedAtMs - 2_000;
}

async function deployOpenClawCompanionRuntime(sender, productId, plan) {
  let status = await inspectOpenClawCompanionStatus(plan);
  if (!status.hubInstalled) {
    return { ok: false, error: "请先安装 OpenClaw Windows Hub" };
  }
  if (status.gatewayPaired) {
    return {
      ok: true,
      version: status.version,
      directory: status.directory,
      managed: status.managed,
      warning: status.summary
    };
  }
  const confirmation = await showLocalizedMessageBox({
    type: "question",
    title: "配置 OpenClaw 本地网关",
    message: "由 OpenClaw Windows Hub 配置专属 WSL 网关？",
    detail: "将打开官方配置流程，创建 OpenClawGateway 并完成服务与配对。不会修改普通 Ubuntu 发行版。",
    buttons: ["取消", "开始配置"],
    defaultId: 1,
    cancelId: 0,
    noLink: true
  });
  if (confirmation.response !== 1) return { ok: false, canceled: true };

  const hubStatus = await detectDesktopProduct(plan.hubProductId);
  const action = createOpenClawCompanionAction(hubStatus, plan.setupAction);
  if (!action) {
    return { ok: false, error: "OpenClaw Windows Hub 启动入口未通过校验" };
  }
  const probe = DESKTOP_PROBES[plan.hubProductId];
  const signature = await verifyExpectedSignature(
    action.executable,
    probe?.signer,
    true
  );
  if (!signature.ok) {
    return { ok: false, error: "OpenClaw Windows Hub 签名校验失败" };
  }

  const startedAtMs = Date.now();
  const launch = await launchProcessWithGrace({
    command: action.executable,
    args: action.args,
    graceMs: 2_000,
    env: isolatedThirdPartyEnvironment(),
    processLabel: "OpenClaw 官方配置"
  });
  if (!launch.launched) return { ok: false, error: launch.error };

  const emit = (line) => {
    try {
      sender.send("cli:log", { productId, stream: "stdout", line });
    } catch {
      // Closing the renderer does not own the vendor setup lifecycle.
    }
  };
  emit("已打开 OpenClaw 官方本地网关配置");
  const deadline = startedAtMs + plan.setupTimeoutMs;
  let lastSummary = "";
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    status = await inspectOpenClawCompanionStatus(plan);
    if (status.summary !== lastSummary) {
      lastSummary = status.summary;
      emit(status.summary);
    }
    if (status.gatewayPaired) {
      return {
        ok: true,
        version: status.version,
        directory: status.directory,
        managed: status.managed,
        warning: status.summary
      };
    }
    if (
      openClawJournalIsCurrent(status, startedAtMs) &&
      status.setupPhase === "canceled"
    ) {
      return { ok: false, canceled: true };
    }
    if (
      openClawJournalIsCurrent(status, startedAtMs) &&
      status.setupPhase === "failed"
    ) {
      return {
        ok: false,
        error: status.setupDetail || "OpenClaw 官方配置失败，请查看 Hub 配置日志"
      };
    }
  }
  status = await inspectOpenClawCompanionStatus(plan);
  if (status.gatewayCliInstalled) {
    return {
      ok: true,
      version: status.version,
      directory: status.directory,
      managed: status.managed,
      warning: status.summary
    };
  }
  return {
    ok: false,
    error: `OpenClaw 官方配置尚未完成：${status.summary}`
  };
}

async function uninstallOpenClawCompanionRuntime(productId, plan) {
  const status = await inspectOpenClawCompanionStatus(plan);
  if (!status.canUninstall) {
    return {
      ok: false,
      error: status.gatewayDistributionInstalled
        ? "官方网关清理组件未通过当前客户端审核"
        : "未检测到 OpenClawGateway"
    };
  }
  const confirmation = await showLocalizedMessageBox({
    type: "warning",
    title: "移除 OpenClaw 本地网关",
    message: "确认移除专属 OpenClawGateway？",
    detail: "只清理 OpenClaw Hub 创建的专属 WSL 网关及其配对状态；不会删除普通 Ubuntu。",
    buttons: ["取消", "确认移除"],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  if (confirmation.response !== 1) return { ok: false, canceled: true };

  const hubStatus = await detectDesktopProduct(plan.hubProductId);
  const appRoot = hubStatus.executable ? path.dirname(hubStatus.executable) : "";
  const scriptPath = appRoot ? path.join(appRoot, plan.cleanupScript) : "";
  try {
    if (
      !scriptPath ||
      fileIntegritySync(scriptPath, "sha256").toLowerCase() !==
        plan.cleanupScriptSha256.toLowerCase()
    ) {
      return { ok: false, error: "网关清理组件在确认期间发生变化" };
    }
  } catch {
    return { ok: false, error: "无法读取官方网关清理组件" };
  }
  const powershell = windowsPowerShellPath();
  try {
    await execFileAsync(
      powershell,
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-AppRoot",
        appRoot
      ],
      {
        windowsHide: true,
        shell: false,
        timeout: 20 * 60 * 1_000,
        maxBuffer: 2 * 1024 * 1024,
        env: isolatedThirdPartyEnvironment()
      }
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "OpenClawGateway 清理失败"
    };
  }
  managedWslStatusCache.delete(productId);
  const finalStatus = await inspectOpenClawCompanionStatus(plan);
  return finalStatus.gatewayDistributionInstalled
    ? { ok: false, status: finalStatus, error: "OpenClawGateway 仍然存在" }
    : { ok: true, status: finalStatus };
}

async function isReviewedProcessRunning(name) {
  try {
    const { stdout } = await execFileAsync(
      systemCommandPath("tasklist.exe"),
      ["/FI", `IMAGENAME eq ${name}`, "/FO", "CSV", "/NH"],
      {
        windowsHide: true,
        shell: false,
        timeout: 10_000,
        maxBuffer: 1024 * 1024
      }
    );
    return String(stdout || "")
      .split(/\r?\n/)
      .some((line) => line.match(/^"([^"]+)"/)?.[1]?.toLowerCase() === name.toLowerCase());
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `无法确认 ${name} 是否仍在运行：${error.message}`
        : `无法确认 ${name} 是否仍在运行`
    );
  }
}

async function runReviewedTaskkill(name, force) {
  try {
    await execFileAsync(
      systemCommandPath("taskkill.exe"),
      [...(force ? ["/F"] : []), "/IM", name, "/T"],
      {
        windowsHide: true,
        shell: false,
        timeout: 15_000,
        maxBuffer: 1024 * 1024
      }
    );
    return { ok: true, notRunning: false };
  } catch (error) {
    if (!(await isReviewedProcessRunning(name))) {
      return { ok: false, notRunning: true };
    }
    return {
      ok: false,
      notRunning: false,
      error:
        error instanceof Error
          ? `无法关闭产品：${error.message}`
          : "无法关闭产品"
    };
  }
}

async function closeReviewedProcesses(processNames, strategy = "graceful") {
  return closeReviewedProcessSet({
    processNames,
    strategy,
    runTaskkill: runReviewedTaskkill,
    isProcessRunning: isReviewedProcessRunning,
    wait: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds))
  });
}

function runCliInstall(
  sender,
  productId,
  directory,
  plan,
  intent = "install",
  receipt = null,
  rollback = false
) {
  return new Promise(async (resolve) => {
    let executionContext = null;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      removeNpmExecutionContext(executionContext);
      resolve(result);
    };
    const emit = (stream, line) => {
      sender.send("cli:log", {
        productId,
        stream,
        line: String(line).replace(/\x1b\[[0-9;]*m/g, "").slice(0, 2000)
      });
    };

    try {
      const runtime = await locateNpmRuntime(plan);
      fs.mkdirSync(directory, { recursive: true });
      executionContext = createNpmExecutionContext();
      const action = rollback
        ? createManagedCliInstallAction({
            productId,
            plan,
            prefix: directory,
            runtime,
            executionContext
          })
        : createManagedCliReconcileAction({
            intent,
            productId,
            plan,
            receipt,
            configuredPrefix: directory,
            prefix: directory,
            runtime,
            executionContext
          });
      if (!action) throw new Error("无法建立隔离的 CLI 生命周期动作");
      const child = spawn(
        action.executable,
        action.args,
        {
          ...action.options,
          env: safeNpmEnvironment(executionContext)
        }
      );

      let stdoutBuffer = "";
      let stderrBuffer = "";
      const flush = (stream, chunk) => {
        const combined =
          (stream === "stdout" ? stdoutBuffer : stderrBuffer) +
          chunk.toString("utf8");
        const lines = combined.split(/\r?\n/);
        const remainder = lines.pop() || "";
        if (stream === "stdout") stdoutBuffer = remainder;
        else stderrBuffer = remainder;
        lines.filter(Boolean).forEach((line) => emit(stream, line));
      };

      child.stdout.on("data", (chunk) => flush("stdout", chunk));
      child.stderr.on("data", (chunk) => flush("stderr", chunk));
      child.on("error", (error) => finish({ ok: false, error: error.message }));
      child.on("close", async (code) => {
        if (stdoutBuffer) emit("stdout", stdoutBuffer);
        if (stderrBuffer) emit("stderr", stderrBuffer);
        const version = readInstalledCliVersion(
          directory,
          plan.packageName
        );
        if (code === 0 && version) {
          const postInstall = await runReviewedCliPostInstall({
            emit,
            productId,
            directory,
            plan,
            runtime,
            executionContext
          });
          if (!postInstall.ok) {
            finish(postInstall);
            return;
          }
          finish({ ok: true, version, directory, runtime });
        } else {
          finish({
            ok: false,
            error:
              code === 0
                ? "安装结束，但未找到有效的软件包"
                : `安装进程退出，代码 ${code}`
          });
        }
      });
    } catch (error) {
      finish({
        ok: false,
        error: error instanceof Error ? error.message : "CLI 安装失败"
      });
    }
  });
}

async function rollbackManagedNpmReconcile({
  sender,
  productId,
  plan,
  directory,
  previousReceipt
}) {
  if (
    !previousReceipt?.version ||
    previousReceipt.productId !== productId ||
    previousReceipt.packageName !== plan.packageName
  ) {
    return false;
  }
  if (
    path.win32.normalize(directory).toLowerCase() !==
      path.win32.normalize(previousReceipt.prefix).toLowerCase()
  ) {
    return false;
  }
  const rollbackPlan = {
    ...plan,
    expectedVersion: previousReceipt.version,
    installSpec: `${plan.packageName}@${previousReceipt.version}`
  };
  const rollback = await runCliInstall(
    sender,
    productId,
    directory,
    rollbackPlan,
    "install",
    previousReceipt,
    true
  );
  if (!rollback.ok || !rollback.runtime) return false;
  const restoredReceipt = createManagedCliReceipt({
    productId,
    plan: rollbackPlan,
    prefix: directory,
    runtime: rollback.runtime,
    previousReceipt
  });
  if (!restoredReceipt) return false;
  try {
    setManagedCliRecord(productId, restoredReceipt);
  } catch {
    return false;
  }
  const persisted = readManagedCliRecords()[productId];
  return Boolean(
    persisted?.managementId === previousReceipt.managementId &&
      persisted?.version === previousReceipt.version &&
      restoredReceipt.managementId === previousReceipt.managementId &&
      restoredReceipt.version === previousReceipt.version
  );
}

async function rollbackFreshManagedNpmInstall({
  sender,
  productId,
  plan,
  directory
}) {
  let executionContext = null;
  try {
    const runtime = await locateNpmRuntime(plan);
    executionContext = createNpmExecutionContext();
    const action = createManagedCliTransactionRollbackAction({
      productId,
      plan,
      prefix: directory,
      runtime,
      executionContext
    });
    if (!action) return false;
    const result = await runCliUninstall(sender, action, executionContext);
    if (!result.ok) return false;
    const status = inspectManagedCli({
      productId,
      plan,
      receipt: null,
      configuredPrefix: directory
    });
    return !status.installed;
  } catch {
    return false;
  } finally {
    removeNpmExecutionContext(executionContext);
  }
}

function runCliUninstall(sender, action, executionContext) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const emit = (stream, line) => {
      sender.send("cli:log", {
        productId: action.productId,
        stream,
        line: String(line).replace(/\x1b\[[0-9;]*m/g, "").slice(0, 2000)
      });
    };
    try {
      const child = spawn(action.executable, action.args, {
        ...action.options,
        env: safeNpmEnvironment(executionContext)
      });
      let stdoutBuffer = "";
      let stderrBuffer = "";
      const flush = (stream, chunk) => {
        const combined =
          (stream === "stdout" ? stdoutBuffer : stderrBuffer) +
          chunk.toString("utf8");
        const lines = combined.split(/\r?\n/);
        const remainder = lines.pop() || "";
        if (stream === "stdout") stdoutBuffer = remainder;
        else stderrBuffer = remainder;
        lines.filter(Boolean).forEach((line) => emit(stream, line));
      };
      child.stdout.on("data", (chunk) => flush("stdout", chunk));
      child.stderr.on("data", (chunk) => flush("stderr", chunk));
      child.on("error", (error) =>
        finish({ ok: false, error: error.message })
      );
      child.on("close", (code) => {
        if (stdoutBuffer) emit("stdout", stdoutBuffer);
        if (stderrBuffer) emit("stderr", stderrBuffer);
        finish(
          code === 0
            ? { ok: true }
            : {
                ok: false,
                error: `CLI 卸载进程退出，代码 ${code}`
              }
        );
      });
    } catch (error) {
      finish({
        ok: false,
        error: error instanceof Error ? error.message : "CLI 卸载失败"
      });
    }
  });
}

function emitCliLog(sender, productId, stream, line) {
  if (!sender?.send) return;
  sender.send("cli:log", {
    productId,
    stream,
    line: String(line).replace(/\x1b\[[0-9;]*m/g, "").slice(0, 2000)
  });
}

function runManagedWslAction(sender, productId, action) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      const child = spawn(action.executable, action.args, action.options);
      const forward = (stream, chunk) => {
        const text = decodeWslOutput(chunk);
        text.split(/\r?\n/).filter(Boolean).forEach((line) =>
          emitCliLog(sender, productId, stream, line)
        );
      };
      child.stdout?.on("data", (chunk) => forward("stdout", chunk));
      child.stderr?.on("data", (chunk) => forward("stderr", chunk));
      child.on("error", (error) => finish({ ok: false, error: error.message }));
      child.on("close", (code) => finish(
        code === 0
          ? { ok: true }
          : { ok: false, error: `WSL 部署进程退出，代码 ${code}` }
      ));
    } catch (error) {
      finish({ ok: false, error: error instanceof Error ? error.message : "WSL 部署失败" });
    }
  });
}

async function downloadManagedWslScript(sender, productId, plan) {
  const artifact = managedWslArtifact(plan);
  if (!artifact) throw new Error("WSL 部署档案未通过客户端白名单校验");
  const temporaryRoot = fs.realpathSync.native(app.getPath("temp"));
  const target = path.join(
    temporaryRoot,
    `aihub-${productId}-${crypto.randomBytes(8).toString("hex")}-${artifact.fileName}`
  );
  try {
    if (artifact.source === "packaged") {
      emitCliLog(sender, productId, "stdout", "正在校验客户端内置的 WSL 安装脚本…");
      const source = path.join(
        __dirname,
        "..",
        "shared",
        ...artifact.relativePath.split("/")
      );
      const script = fs.readFileSync(source);
      if (!script.length || script.length > artifact.maximumBytes) {
        throw new Error("内置 WSL 安装脚本大小超过客户端白名单限制");
      }
      if (crypto.createHash("sha256").update(script).digest("hex") !== artifact.sha256) {
        throw new Error("内置 WSL 安装脚本 SHA-256 与客户端白名单不一致");
      }
      fs.writeFileSync(target, script, { flag: "wx", mode: 0o600 });
      return target;
    }
    emitCliLog(sender, productId, "stdout", "正在下载已审核的官方 WSL 安装脚本…");
    const { response } = await fetchReviewedDownload({
      url: artifact.url,
      options: {
        method: "GET",
        redirect: "error",
        cache: "no-store",
        headers: { "User-Agent": DOWNLOAD_USER_AGENT }
      },
      isAllowedFinalUrl: (url) => url === artifact.url
    });
    if (!response.ok || !response.body) {
      throw new Error(`官方安装脚本下载失败（HTTP ${response.status}）`);
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > artifact.maximumBytes) {
      throw new Error("官方安装脚本大小超过客户端白名单限制");
    }
    let receivedBytes = 0;
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        receivedBytes += chunk.length;
        callback(
          receivedBytes > artifact.maximumBytes
            ? new Error("官方安装脚本大小超过客户端白名单限制")
            : null,
          chunk
        );
      }
    });
    await pipeline(
      Readable.fromWeb(response.body),
      limiter,
      fs.createWriteStream(target, { flags: "wx" })
    );
    if (!receivedBytes || (declaredLength && receivedBytes !== declaredLength)) {
      throw new Error("官方安装脚本下载不完整");
    }
    if (fileIntegritySync(target, "sha256") !== artifact.sha256) {
      throw new Error("官方安装脚本 SHA-256 与客户端白名单不一致");
    }
    return target;
  } catch (error) {
    try { fs.rmSync(target, { force: true }); } catch {}
    throw error;
  }
}

async function deployManagedWslCli(sender, productId, plan) {
  const wslExecutable = systemCommandPath("wsl.exe");
  let distributions = await listWslDistributions(wslExecutable);
  if (!distributions.some((name) => name.toLowerCase() === plan.distribution.toLowerCase())) {
    const distributionAction = createManagedWslDistributionAction({ plan, wslExecutable });
    if (!distributionAction) return { ok: false, error: "无法建立受审核的 WSL 发行版安装动作" };
    emitCliLog(sender, productId, "stdout", `正在安装 ${plan.distribution}…`);
    const distributionResult = await runManagedWslAction(sender, productId, distributionAction);
    if (!distributionResult.ok) return distributionResult;
    distributions = await listWslDistributions(wslExecutable);
    if (!distributions.some((name) => name.toLowerCase() === plan.distribution.toLowerCase())) {
      return {
        ok: false,
        restartRequired: true,
        error: `${plan.distribution} 已提交安装；Windows 完成初始化或重启后，再次点击即可继续部署`
      };
    }
  }

  const before = await inspectManagedWslStatus(productId, plan);
  if (before.installed) {
    return { ok: false, error: before.managed ? `该 WSL 产品已由${BRAND.name}部署` : `检测到同路径的非受管安装，${BRAND.name}不会覆盖` };
  }
  const preflightAction = createManagedWslInstallPreflightAction({
    plan,
    wslExecutable
  });
  if (!preflightAction) {
    return { ok: false, error: "无法建立 WSL 产品目录所有权检查" };
  }
  const preflightResult = await runManagedWslAction(
    sender,
    productId,
    preflightAction
  );
  if (!preflightResult.ok) {
    return {
      ok: false,
      error: `${plan.managedPrefix} 已存在；为避免覆盖非受管文件，已停止安装`
    };
  }
  const receipt = createManagedWslReceipt({
    productId,
    plan,
    distributionIdentity: plan.distribution,
    managementId: crypto.randomBytes(24).toString("hex")
  });
  if (!receipt) return { ok: false, error: "无法建立 WSL 产品管理身份" };
  const environmentConfirmation = await showLocalizedMessageBox({
    type: "warning",
    title: `准备 ${plan.distribution} 共享环境`,
    message: `允许在 ${plan.distribution} 中安装固定环境依赖？`,
    detail: [
      `将以 root 安装：${plan.bootstrapPackages.join(", ")}`,
      `这些依赖属于共享 WSL 环境，不在 ${plan.managedPrefix} 产品目录内。`,
      `以后卸载 ${plan.name} 时不会删除这些共享环境依赖，也不会注销 WSL 发行版。`
    ].join("\n"),
    buttons: ["取消", "继续"],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  if (environmentConfirmation.response !== 1) {
    return { ok: false, canceled: true };
  }
  const bootstrapAction = createManagedWslBootstrapAction({
    plan,
    wslExecutable
  });
  if (!bootstrapAction) {
    return { ok: false, error: "无法建立受审核的 WSL 环境准备动作" };
  }
  emitCliLog(
    sender,
    productId,
    "stdout",
    `正在准备 ${plan.distribution} 内部环境…`
  );
  const bootstrapResult = await runManagedWslAction(
    sender,
    productId,
    bootstrapAction
  );
  if (!bootstrapResult.ok) return bootstrapResult;
  let scriptPath = "";
  try {
    scriptPath = await downloadManagedWslScript(sender, productId, plan);
    const action = createManagedWslDeployAction({
      productId,
      plan,
      wslExecutable,
      scriptWindowsPath: scriptPath,
      managementId: receipt.managementId
    });
    if (!action) return { ok: false, error: "无法建立受审核的 WSL 产品部署动作" };
    const result = await runManagedWslAction(sender, productId, action);
    if (!result.ok) return result;
  } finally {
    if (scriptPath) {
      try { fs.rmSync(scriptPath, { force: true }); } catch {}
    }
  }

  setManagedCliRecord(productId, receipt);
  managedWslStatusCache.delete(productId);
  const probed = await inspectManagedWslStatus(productId, plan);
  if (!probed.installed || probed.version !== plan.version) {
    return { ok: false, error: "WSL 安装已结束，但所有权或固定版本校验未通过；管理收据已保留，可安全卸载" };
  }
  managedWslStatusCache.delete(productId);
  const status = await inspectManagedWslStatus(productId, plan);
  const terminal = await openManagedCliTerminal(productId);
  return {
    ok: true,
    version: status.version,
    directory: status.directory,
    managed: status.managed,
    terminalOpened: terminal.ok,
    warning: terminal.ok ? undefined : terminal.error
  };
}

async function updateManagedWslCli(sender, productId, plan) {
  const receipt = readManagedCliRecords()[productId] || null;
  const before = await inspectManagedWslStatus(productId, plan);
  if (!before.installed || !managedWslReceiptOwnsPrefix(receipt, productId, plan)) {
    return { ok: false, error: "WSL 产品不是由 AI Hub 精确收据管理，已拒绝更新" };
  }
  const confirmation = await showLocalizedMessageBox({
    type: "question",
    title: `更新 ${plan.name}`,
    message: `确认更新 ${plan.name}？`,
    detail: `仅替换 ${plan.managedPrefix} 内由 AI Hub 管理的固定 Node 与 CLI 制品；失败将恢复原受管前缀，不会修改 WSL 发行版或 ~/.augment 数据。`,
    buttons: ["取消", "确认更新"], defaultId: 0, cancelId: 0, noLink: true
  });
  if (confirmation.response !== 1) return { ok: false, canceled: true };
  const confirmedReceipt = readManagedCliRecords()[productId] || null;
  if (!managedWslReceiptOwnsPrefix(confirmedReceipt, productId, plan) || confirmedReceipt.managementId !== receipt.managementId) {
    return { ok: false, error: "确认期间 WSL 管理收据发生变化，已拒绝更新" };
  }
  let scriptPath = "";
  try {
    scriptPath = await downloadManagedWslScript(sender, productId, plan);
    const action = createManagedWslUpdateAction({
      productId, plan, receipt, wslExecutable: systemCommandPath("wsl.exe"), scriptWindowsPath: scriptPath
    });
    if (!action) return { ok: false, error: "无法建立受审核的 WSL 更新动作" };
    const result = await runManagedWslAction(sender, productId, action);
    if (!result.ok) return result;
  } finally {
    if (scriptPath) {
      try { fs.rmSync(scriptPath, { force: true }); } catch {}
    }
  }
  const nextReceipt = createManagedWslReceipt({
    productId, plan, distributionIdentity: plan.distribution, managementId: receipt.managementId
  });
  if (!nextReceipt) return { ok: false, error: "无法更新 WSL 管理收据" };
  setManagedCliRecord(productId, nextReceipt);
  managedWslStatusCache.delete(productId);
  const status = await inspectManagedWslStatus(productId, plan);
  if (!status.installed || !status.managed || status.version !== plan.version) {
    setManagedCliRecord(productId, receipt);
    managedWslStatusCache.delete(productId);
    return { ok: false, error: "WSL 更新结束，但固定版本或所有权复核未通过；原收据已保留" };
  }
  const terminal = await openManagedCliTerminal(productId);
  return { ok: true, version: status.version, directory: status.directory, managed: true, terminalOpened: terminal.ok, warning: terminal.ok ? undefined : terminal.error };
}

async function repairManagedWslCli(sender, productId, plan) {
  const receipt = readManagedCliRecords()[productId] || null;
  if (!managedWslReceiptMatchesPlan(receipt, productId, plan) || plan.repairStrategy !== "rebuild-owned-prefix") {
    return { ok: false, error: "WSL 修复仅适用于版本和脚本均匹配的 AI Hub 受管收据" };
  }
  const healthy = await inspectManagedWslStatus(productId, plan);
  if (healthy.installed && healthy.managed && healthy.version === plan.version) {
    return { ok: true, version: healthy.version, directory: healthy.directory, managed: true, warning: "完整性检查已通过，无需修复" };
  }
  const ownershipAction = createManagedWslRepairProbeAction({
    productId, plan, receipt, wslExecutable: systemCommandPath("wsl.exe")
  });
  if (!ownershipAction) return { ok: false, error: "无法建立受审核的 WSL 所有权检查" };
  const ownership = await runManagedWslAction(sender, productId, ownershipAction);
  if (!ownership.ok) return { ok: false, error: "受管 WSL 前缀或所有权标记不完整，已拒绝修复" };
  const confirmation = await showLocalizedMessageBox({
    type: "question",
    title: `修复 ${plan.name}`,
    message: `确认修复 ${plan.name}？`,
    detail: `仅重建 ${plan.managedPrefix} 内与当前收据完全匹配的固定 Node 与 CLI 制品；将备份并在失败时恢复该专属前缀，不会修改 WSL 发行版或 ~/.augment 数据。`,
    buttons: ["取消", "确认修复"], defaultId: 0, cancelId: 0, noLink: true
  });
  if (confirmation.response !== 1) return { ok: false, canceled: true };
  const confirmedReceipt = readManagedCliRecords()[productId] || null;
  if (!managedWslReceiptMatchesPlan(confirmedReceipt, productId, plan) || confirmedReceipt.managementId !== receipt.managementId) {
    return { ok: false, error: "确认期间 WSL 管理收据发生变化，已拒绝修复" };
  }
  const confirmedOwnership = await runManagedWslAction(sender, productId, ownershipAction);
  if (!confirmedOwnership.ok) return { ok: false, error: "确认后受管 WSL 前缀或所有权标记已变化，已拒绝修复" };
  let scriptPath = "";
  try {
    scriptPath = await downloadManagedWslScript(sender, productId, plan);
    const action = createManagedWslRepairAction({
      productId, plan, receipt, wslExecutable: systemCommandPath("wsl.exe"), scriptWindowsPath: scriptPath
    });
    if (!action) return { ok: false, error: "无法建立受审核的 WSL 修复动作" };
    const result = await runManagedWslAction(sender, productId, action);
    if (!result.ok) return result;
  } finally {
    if (scriptPath) {
      try { fs.rmSync(scriptPath, { force: true }); } catch {}
    }
  }
  managedWslStatusCache.delete(productId);
  const status = await inspectManagedWslStatus(productId, plan);
  if (!status.installed || !status.managed || status.version !== plan.version) {
    return { ok: false, error: "WSL 修复结束，但固定版本或所有权复核未通过；原受管前缀已由修复脚本回滚" };
  }
  const terminal = await openManagedCliTerminal(productId);
  return { ok: true, version: status.version, directory: status.directory, managed: true, terminalOpened: terminal.ok, warning: terminal.ok ? undefined : terminal.error };
}

async function uninstallManagedWslCli(sender, productId, plan) {
  const status = await inspectManagedWslStatus(productId, plan);
  if (!status.canUninstall) {
    return { ok: false, error: status.installed ? `该 WSL 产品不属于当前${BRAND.name}管理收据` : "未找到可安全卸载的 WSL 产品" };
  }
  const confirmation = await showLocalizedMessageBox({
    type: "warning",
    title: `卸载 ${plan.name}`,
    message: `确认卸载 ${plan.name}？`,
    detail: `仅移除 ${plan.distribution} 中由${BRAND.name}完整拥有的 ${plan.managedPrefix} 专属目录；不会注销 WSL 发行版，也不会删除目录外的用户配置。`,
    buttons: ["取消", "确认卸载"],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  if (confirmation.response !== 1) return { ok: false, canceled: true };
  const receipt = readManagedCliRecords()[productId] || null;
  const actions = createManagedWslUninstallActions({
    productId,
    plan,
    receipt,
    wslExecutable: systemCommandPath("wsl.exe")
  });
  if (!actions) return { ok: false, error: "WSL 管理收据已变化，已停止卸载" };
  for (const action of actions) {
    const result = await runManagedWslAction(sender, productId, action);
    if (!result.ok) return result;
  }
  managedWslStatusCache.delete(productId);
  const after = await inspectManagedWslStatus(productId, plan);
  if (after.installed) return { ok: false, error: "卸载已结束，但仍检测到该 WSL 产品；管理收据已保留" };
  removeManagedCliRecord(productId);
  managedWslStatusCache.delete(productId);
  return { ok: true, status: await inspectManagedWslStatus(productId, plan) };
}

function binaryCliLayoutAtConfiguredPrefix(productId, plan) {
  const requestedPrefix = readSettings().cliInstallDirectory;
  if (!requestedPrefix || !path.isAbsolute(requestedPrefix)) {
    throw new Error("请先选择 CLI 工具安装位置");
  }
  fs.mkdirSync(requestedPrefix, { recursive: true });
  const canonicalPrefix = fs.realpathSync.native(requestedPrefix);
  if (
    path.normalize(canonicalPrefix).toLowerCase() !==
      path.normalize(requestedPrefix).toLowerCase()
  ) {
    throw new Error("CLI 工具安装位置包含路径跳转");
  }
  const layout = createManagedBinaryLayout({
    productId,
    plan,
    prefix: canonicalPrefix,
    architecture: process.arch
  });
  if (!layout) {
    throw new Error("当前 Windows 架构没有已审核的安装包");
  }
  return layout;
}

function rollbackManagedBinaryLayout(layout) {
  if (layout.artifact.kind === "standalone-executable") {
    fs.rmSync(layout.marker, { force: true });
    fs.rmSync(layout.executable, { force: true });
    return;
  }
  fs.rmSync(layout.directory, { recursive: true, force: true });
}

function createManagedCliReconcileStagingPrefix(prefix) {
  const root = path.join(prefix, ".aihub-reconcile");
  fs.mkdirSync(root, { recursive: true });
  const stagingPrefix = fs.mkdtempSync(path.join(root, "stage-"));
  const canonicalPrefix = fs.realpathSync.native(stagingPrefix);
  if (!pathIsInside(canonicalPrefix, prefix)) {
    fs.rmSync(stagingPrefix, { recursive: true, force: true });
    throw new Error("CLI 更新临时目录不在受管前缀内");
  }
  return canonicalPrefix;
}

function receiptOwnsManagedCliLayout(receipt, driver, productId, layout) {
  if (!receipt || typeof receipt.prefix !== "string" || typeof receipt.directory !== "string" || typeof receipt.executable !== "string") {
    return false;
  }
  const executable = layout.executable || layout.commandExecutable;
  return Boolean(
    receipt && receipt.driver === driver && receipt.productId === productId &&
    receipt.version === layout.version && receipt.prefix &&
    path.normalize(receipt.prefix).toLowerCase() === path.normalize(layout.prefix).toLowerCase() &&
    path.normalize(receipt.directory).toLowerCase() === path.normalize(layout.directory).toLowerCase() &&
    executable && path.normalize(receipt.executable).toLowerCase() === path.normalize(executable).toLowerCase()
  );
}

function replaceManagedCliDirectory({ currentDirectory, stagingDirectory, backupDirectory, createReceipt, inspectReceipt, commitReceipt }) {
  let previousMoved = false;
  let stagingMoved = false;
  try {
    if (fs.existsSync(currentDirectory)) {
      fs.renameSync(currentDirectory, backupDirectory);
      previousMoved = true;
    }
    fs.renameSync(stagingDirectory, currentDirectory);
    stagingMoved = true;
    const receipt = createReceipt();
    if (!receipt || !inspectReceipt(receipt).managed) {
      throw new Error("更新后的 CLI 管理收据复核失败");
    }
    commitReceipt(receipt);
    try {
      if (previousMoved) fs.rmSync(backupDirectory, { recursive: true, force: true });
    } catch {
      // A verified replacement is active; retain only the exact managed backup for later cleanup.
    }
    return receipt;
  } catch (error) {
    try {
      if (stagingMoved && fs.existsSync(currentDirectory)) {
        fs.rmSync(currentDirectory, { recursive: true, force: true });
      }
      if (previousMoved && fs.existsSync(backupDirectory)) {
        fs.renameSync(backupDirectory, currentDirectory);
      }
    } catch (rollbackError) {
      throw new Error(`CLI 更新失败且无法恢复旧受管目录：${rollbackError.message}`);
    }
    throw error;
  }
}

async function downloadManagedBinaryCli(sender, productId, plan, layout) {
  const artifact = artifactFor(plan, process.arch);
  if (!artifact) throw new Error("当前架构的二进制白名单无效");
  fs.mkdirSync(layout.directory, { recursive: true });
  const canonicalDirectory = fs.realpathSync.native(layout.directory);
  if (
    path.normalize(canonicalDirectory).toLowerCase() !==
      path.normalize(layout.directory).toLowerCase() ||
    !pathIsInside(canonicalDirectory, layout.prefix)
  ) {
    throw new Error("受管 CLI 目录包含路径跳转");
  }
  if (fs.readdirSync(canonicalDirectory).length) {
    throw new Error("受管 CLI 目录已有未登记文件，客户端不会覆盖");
  }

  const temporaryPath = path.join(
    canonicalDirectory,
    `.aihub-${productId}-${crypto.randomBytes(8).toString("hex")}${path.extname(artifact.fileName)}`
  );
  let executableCreated = false;
  try {
    emitCliLog(sender, productId, "stdout", "正在下载官方固定版本…");
    const { response } = await fetchReviewedDownload({
      url: artifact.url,
      options: {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        headers: { "User-Agent": DOWNLOAD_USER_AGENT }
      },
      isAllowedFinalUrl: (candidate) => {
        try {
          const url = new URL(candidate);
          return url.protocol === "https:" &&
            !url.username && !url.password &&
            artifact.allowedHosts.includes(url.hostname.toLowerCase());
        } catch {
          return false;
        }
      }
    });
    if (!response.ok || !response.body) {
      throw new Error(`官方下载失败（HTTP ${response.status}）`);
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (
      (contentLength && !Number.isSafeInteger(contentLength)) ||
      contentLength > artifact.maximumBytes
    ) {
      throw new Error("官方文件大小超过客户端白名单限制");
    }
    let receivedBytes = 0;
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        receivedBytes += chunk.length;
        if (receivedBytes > artifact.maximumBytes) {
          callback(new Error("官方文件大小超过客户端白名单限制"));
        } else {
          callback(null, chunk);
        }
      }
    });
    await pipeline(
      Readable.fromWeb(response.body),
      limiter,
      fs.createWriteStream(temporaryPath, { flags: "wx" })
    );
    if (!receivedBytes || (contentLength && receivedBytes !== contentLength)) {
      throw new Error("官方下载内容不完整");
    }
    const integrityLabel = artifact.downloadIntegrityAlgorithm.toUpperCase();
    emitCliLog(sender, productId, "stdout", `正在校验 ${integrityLabel}…`);
    if (
      fileIntegritySync(temporaryPath, artifact.downloadIntegrityAlgorithm) !==
      artifact.downloadIntegrity
    ) {
      throw new Error(`官方文件 ${integrityLabel} 与客户端白名单不一致`);
    }
    if (artifact.kind !== "standalone-executable") {
      const tar = systemCommandPath("tar.exe");
      if (!fs.existsSync(tar)) throw new Error("Windows 解压工具不可用");
      const listing = await execFileAsync(tar, ["-tf", temporaryPath], {
        windowsHide: true,
        shell: false,
        timeout: 30_000,
        maxBuffer: 64 * 1024
      });
      const entries = String(listing.stdout || "").split(/\r?\n/).filter(Boolean);
      const maximumEntries = artifact.kind === "zip-directory"
        ? artifact.maximumArchiveEntries
        : 1;
      const reviewedEntries = validateZipEntries(entries, maximumEntries);
      const reviewedExecutable = artifact.executableFileName.replace(/\\/g, "/");
      if (!reviewedEntries || !reviewedEntries.includes(reviewedExecutable) ||
        (artifact.kind === "zip-single-executable" && reviewedEntries.length !== 1)) {
        throw new Error("官方归档内容与客户端白名单不一致");
      }
      await execFileAsync(
        tar,
        ["-xf", temporaryPath, "-C", canonicalDirectory, ...(artifact.kind === "zip-single-executable" ? [artifact.executableFileName] : [])],
        { windowsHide: true, shell: false, timeout: 5 * 60_000, maxBuffer: 64 * 1024 }
      );
      executableCreated = fs.existsSync(layout.executable);
      const extractedTree = inspectExtractedTree(canonicalDirectory, {
        maximumEntries,
        maximumBytes: artifact.maximumExtractedBytes
      });
      const extracted = fs.lstatSync(layout.executable);
      if (!extractedTree || !extracted.isFile() || extracted.isSymbolicLink()) {
        throw new Error("官方归档解压结果与客户端白名单不一致");
      }
    } else {
      fs.renameSync(temporaryPath, layout.executable);
      executableCreated = true;
    }
    if (
      fileIntegritySync(layout.executable, artifact.integrityAlgorithm) !==
      artifact.integrity
    ) {
      throw new Error("官方程序摘要与客户端白名单不一致");
    }
    const versionCheck = await execFileAsync(layout.executable, ["--version"], {
      cwd: layout.directory,
      windowsHide: true,
      shell: false,
      env: { ...process.env, ...(plan.managedEnvironment || {}) },
      timeout: 30_000,
      maxBuffer: 1024 * 1024
    });
    const versionOutput = `${versionCheck.stdout || ""}\n${versionCheck.stderr || ""}`.trim();
    if (!versionOutput.includes(plan.version)) {
      throw new Error("官方程序返回的版本与客户端白名单不一致");
    }
    emitCliLog(
      sender,
      productId,
      "stdout",
      `${plan.name} ${plan.version} 校验完成`
    );
    return { ok: true, versionOutput };
  } catch (error) {
    try {
      if (executableCreated || artifact.kind !== "standalone-executable") {
        rollbackManagedBinaryLayout(layout);
      }
    } catch {
      // Never broaden rollback beyond the exact version directory created above.
    }
    throw error;
  } finally {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Never broaden cleanup beyond the exact temporary download.
    }
  }
}

async function deployManagedBinaryCli(sender, productId, plan) {
  const checks = await Promise.all(
    plan.requirements.map(async (requirement) => ({
      requirement,
      location: await locate(
        requirement === "node"
          ? "node.exe"
          : requirement === "git"
            ? "git.exe"
            : `${requirement}.exe`
      )
    }))
  );
  const missing = checks
    .filter((check) => !check.location)
    .map((check) => check.requirement);
  if (missing.length) {
    return { ok: false, error: `缺少运行环境：${missing.join("、")}` };
  }
  let layout;
  try {
    layout = binaryCliLayoutAtConfiguredPrefix(productId, plan);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  const currentStatus = getCliStatus(productId);
  if (currentStatus.detection === "unknown") {
    return { ok: false, error: "受管 CLI 目录存在未登记内容或状态无法确认" };
  }
  if (currentStatus.installed) {
    return { ok: false, error: `该 CLI 已由${BRAND.name}部署` };
  }
  const prefixKey = layout.directory.toLowerCase();
  if (activeCliPrefixes.has(prefixKey)) {
    return { ok: false, error: "该 CLI 安装位置正在执行其他操作" };
  }
  activeCliPrefixes.add(prefixKey);
  try {
    const confirmation = await showLocalizedMessageBox({
      type: "question",
      title: `部署 ${plan.name}`,
      message: `确认安装 ${plan.name} ${plan.version}？`,
      detail: [
        `安装位置：${layout.directory}`,
        `系统架构：${process.arch}`,
        `客户端直接下载固定官方二进制并校验 ${layout.artifact.integrityAlgorithm.toUpperCase()}。`,
        "不会执行厂商远程 PowerShell 或 CMD 安装脚本。"
      ].join("\n"),
      buttons: ["取消", "确认部署"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) return { ok: false, canceled: true };

    try {
      await downloadManagedBinaryCli(sender, productId, plan, layout);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "固定二进制下载失败"
      };
    }
    if (plan.managedSettings) {
      const settingsResult = applyManagedCliSettings({
        homeDirectory: app.getPath("home"),
        policy: plan.managedSettings
      });
      if (!settingsResult.ok) {
        try {
          rollbackManagedBinaryLayout(layout);
        } catch {
          // Keep rollback scoped to the exact managed version directory.
        }
        return { ok: false, error: settingsResult.error };
      }
    }
    const receipt = createPortableBinaryReceipt({
      productId,
      plan,
      prefix: layout.prefix,
      architecture: process.arch,
      hashFile: fileIntegritySync
    });
    if (!receipt) {
      try {
        rollbackManagedBinaryLayout(layout);
      } catch {
        // Keep rollback scoped to the exact managed version directory.
      }
      return { ok: false, error: "安装已停止：无法建立二进制管理收据" };
    }
    const committedStatus = inspectManagedBinaryCli({
      productId,
      plan,
      receipt,
      configuredPrefix: layout.prefix,
      architecture: process.arch,
      verifyIntegrity: true,
      hashFile: fileIntegritySync
    });
    if (!committedStatus.managed) {
      try {
        rollbackManagedBinaryLayout(layout);
      } catch {
        // Keep rollback scoped to the exact module-owned files.
      }
      return { ok: false, error: "安装已停止：二进制管理收据复核失败" };
    }
    try {
      setManagedCliRecord(productId, receipt);
    } catch (error) {
      try {
        rollbackManagedBinaryLayout(layout);
      } catch {
        // Keep rollback scoped to the exact module-owned files.
      }
      return {
        ok: false,
        error:
          error instanceof Error
            ? `管理收据写入失败：${error.message}`
            : "管理收据写入失败"
      };
    }
    const terminal = await openManagedCliTerminal(productId);
    return {
      ok: true,
      version: receipt.version,
      directory: receipt.directory,
      managed: true,
      terminalOpened: terminal.ok,
      warning: terminal.ok ? undefined : terminal.error
    };
  } finally {
    activeCliPrefixes.delete(prefixKey);
  }
}

async function reconcileManagedBinaryCli(sender, productId, plan, intent) {
  if (intent === "install") return await deployManagedBinaryCli(sender, productId, plan);
  const checks = await Promise.all(plan.requirements.map(async (requirement) => ({
    requirement,
    location: await locate(requirement === "node" ? "node.exe" : requirement === "git" ? "git.exe" : `${requirement}.exe`)
  })));
  const missing = checks.filter((check) => !check.location).map((check) => check.requirement);
  if (missing.length) return { ok: false, error: `缺少运行环境：${missing.join("、")}` };
  let layout;
  try { layout = binaryCliLayoutAtConfiguredPrefix(productId, plan); } catch (error) { return { ok: false, error: error.message }; }
  if (!receiptOwnsManagedCliLayout(readManagedCliRecords()[productId], "portable-binary", productId, layout)) {
    return { ok: false, error: "仅可更新或修复 AI Hub 收据拥有的二进制 CLI" };
  }
  const prefixKey = layout.directory.toLowerCase();
  if (activeCliPrefixes.has(prefixKey)) return { ok: false, error: "该 CLI 安装位置正在执行其他操作" };
  activeCliPrefixes.add(prefixKey);
  let stagingPrefix = "";
  try {
    const confirmation = await showLocalizedMessageBox({
      type: "question", title: `${intent === "update" ? "更新" : "修复"} ${plan.name}`,
      message: `确认${intent === "update" ? "更新" : "修复"} ${plan.name} ${plan.version}？`,
      detail: "仅重新部署客户端已批准的固定官方制品；失败会保留原受管版本。",
      buttons: ["取消", "确认"], defaultId: 0, cancelId: 0, noLink: true
    });
    if (confirmation.response !== 1) return { ok: false, canceled: true };
    if (!receiptOwnsManagedCliLayout(readManagedCliRecords()[productId], "portable-binary", productId, layout)) {
      return { ok: false, error: "确认期间 CLI 收据发生变化，已拒绝操作" };
    }
    stagingPrefix = createManagedCliReconcileStagingPrefix(layout.prefix);
    const stagingLayout = createManagedBinaryLayout({ productId, plan, prefix: stagingPrefix, architecture: process.arch });
    if (!stagingLayout) return { ok: false, error: "无法建立受管二进制更新目录" };
    await downloadManagedBinaryCli(sender, productId, plan, stagingLayout);
    if (plan.managedSettings) {
      const settingsResult = applyManagedCliSettings({ homeDirectory: app.getPath("home"), policy: plan.managedSettings });
      if (!settingsResult.ok) return { ok: false, error: settingsResult.error };
    }
    const receipt = replaceManagedCliDirectory({
      currentDirectory: layout.directory,
      stagingDirectory: stagingLayout.directory,
      backupDirectory: `${layout.directory}.backup-${crypto.randomBytes(8).toString("hex")}`,
      createReceipt: () => createPortableBinaryReceipt({ productId, plan, prefix: layout.prefix, architecture: process.arch, hashFile: fileIntegritySync }),
      inspectReceipt: (candidate) => inspectManagedBinaryCli({ productId, plan, receipt: candidate, configuredPrefix: layout.prefix, architecture: process.arch, verifyIntegrity: true, hashFile: fileIntegritySync }),
      commitReceipt: (candidate) => setManagedCliRecord(productId, candidate)
    });
    const terminal = await openManagedCliTerminal(productId);
    return { ok: true, version: receipt.version, directory: receipt.directory, managed: true, terminalOpened: terminal.ok, warning: terminal.ok ? undefined : terminal.error };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "二进制 CLI 更新失败" };
  } finally {
    if (stagingPrefix) {
      try { fs.rmSync(stagingPrefix, { recursive: true, force: true }); } catch {}
    }
    activeCliPrefixes.delete(prefixKey);
  }
}

async function uninstallManagedBinaryCli(productId, plan) {
  const records = readManagedCliRecords();
  const receipt = records[productId] || null;
  const action = createManagedBinaryUninstallAction({
    productId,
    plan,
    receipt,
    configuredPrefix: readSettings().cliInstallDirectory || "",
    architecture: process.arch,
    hashFile: fileIntegritySync
  });
  if (!action) {
    return { ok: false, error: "二进制、完整性或管理收据不一致，已拒绝卸载" };
  }
  const prefixKey = action.directory.toLowerCase();
  if (activeCliPrefixes.has(prefixKey)) {
    return { ok: false, error: "该 CLI 安装位置正在执行其他操作" };
  }
  activeCliPrefixes.add(prefixKey);
  try {
    const confirmation = await showLocalizedMessageBox({
      type: "warning",
      title: `卸载 ${plan.name}`,
      message: `确认卸载 ${plan.name}？`,
      detail: [
        `当前版本：${action.version}`,
        `安装位置：${action.directory}`,
        `只删除${BRAND.name}管理的程序文件；账号、设置和会话数据会保留。`
      ].join("\n"),
      buttons: ["取消", "确认卸载"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) return { ok: false, canceled: true };

    const latestRecords = readManagedCliRecords();
    const confirmedAction = createManagedBinaryUninstallAction({
      productId,
      plan,
      receipt: latestRecords[productId] || null,
      configuredPrefix: readSettings().cliInstallDirectory || "",
      architecture: process.arch,
      hashFile: fileIntegritySync
    });
    if (
      !confirmedAction ||
      confirmedAction.managementId !== action.managementId ||
      confirmedAction.directory.toLowerCase() !== prefixKey
    ) {
      return { ok: false, error: "确认期间 CLI 安装状态发生变化，已拒绝卸载" };
    }
    const tombstone = `${action.directory}.removing-${action.managementId}`;
    if (fs.existsSync(tombstone)) {
      return { ok: false, error: "发现未完成的旧卸载目录，已停止操作" };
    }
    fs.renameSync(action.directory, tombstone);
    try {
      removeManagedCliRecord(productId);
    } catch (error) {
      fs.renameSync(tombstone, action.directory);
      return {
        ok: false,
        error:
          error instanceof Error ? `管理收据更新失败：${error.message}` : "管理收据更新失败"
      };
    }
    try {
      fs.rmSync(tombstone, { recursive: true, force: true });
    } catch (error) {
      return {
        ok: true,
        status: getCliStatus(productId),
        warning: `程序已从受管位置移除，但旧文件清理失败：${error.message}`
      };
    }
    return { ok: true, status: getCliStatus(productId) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "固定二进制卸载失败"
    };
  } finally {
    activeCliPrefixes.delete(prefixKey);
  }
}

async function locatePythonRuntime(plan) {
  const environmentId = plan.pythonEnvironmentId || "python";
  const environmentPlan = ENVIRONMENT_PLANS[environmentId];
  if (!environmentPlan) throw new Error("Python 环境白名单无效");
  const located = await locateEnvironment(environmentId, environmentPlan);
  if (!located.installed || !located.location || !located.probeOk) {
    throw new Error("未检测到可信的 Python 环境");
  }
  let output;
  try {
    const result = await execFileAsync(located.location, ["-I", "--version"], {
      windowsHide: true,
      shell: false,
      timeout: 10_000,
      maxBuffer: 64 * 1024
    });
    output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  } catch {
    throw new Error("无法确认 Python 版本");
  }
  const match = output.match(/^Python\s+3\.(\d+)\.(\d+)/i);
  if (!match) throw new Error("Python 版本信息无效");
  const minor = Number(match[1]);
  if (
    minor < plan.minimumPythonMinor ||
    (plan.maximumPythonMinor !== undefined && minor > plan.maximumPythonMinor)
  ) {
    const range = plan.maximumPythonMinor === undefined
      ? `3.${plan.minimumPythonMinor} 或更高版本`
      : `3.${plan.minimumPythonMinor} 至 3.${plan.maximumPythonMinor}`;
    throw new Error(`${plan.name} 需要 Python ${range}`);
  }
  return { executable: located.location, minor, version: output.replace(/^Python\s+/i, "") };
}

function safePythonEnvironment(plan) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => {
      const normalized = key.toLowerCase();
      return !normalized.startsWith("pip_") && !normalized.startsWith("python");
    })
  );
  environment.PIP_CONFIG_FILE = "NUL";
  environment.PIP_DISABLE_PIP_VERSION_CHECK = "1";
  environment.PYTHONNOUSERSITE = "1";
  return { ...environment, ...(plan.managedEnvironment || {}) };
}

function pythonCliLayoutAtConfiguredPrefix(productId, plan) {
  const requestedPrefix = readSettings().cliInstallDirectory;
  if (!requestedPrefix || !path.isAbsolute(requestedPrefix)) {
    throw new Error("请先选择 CLI 工具安装位置");
  }
  fs.mkdirSync(requestedPrefix, { recursive: true });
  const canonicalPrefix = fs.realpathSync.native(requestedPrefix);
  if (path.normalize(canonicalPrefix).toLowerCase() !== path.normalize(requestedPrefix).toLowerCase()) {
    throw new Error("CLI 工具安装位置包含路径跳转");
  }
  const layout = createManagedPythonLayout({ productId, plan, prefix: canonicalPrefix });
  if (!layout) throw new Error("Python CLI 白名单配置无效");
  return layout;
}

async function deployManagedPythonCli(sender, productId, plan) {
  if (process.arch !== plan.architecture) {
    return { ok: false, error: "当前 Python CLI 依赖锁仅支持 Windows x64" };
  }
  let runtime;
  let layout;
  try {
    runtime = await locatePythonRuntime(plan);
    layout = pythonCliLayoutAtConfiguredPrefix(productId, plan);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Python 环境不可用" };
  }
  const currentStatus = getCliStatus(productId);
  if (currentStatus.detection === "unknown") {
    return { ok: false, error: "受管 Python CLI 目录存在未登记内容或状态无法确认" };
  }
  if (currentStatus.installed) return { ok: false, error: `该 CLI 已由${BRAND.name}部署` };
  const prefixKey = layout.directory.toLowerCase();
  if (activeCliPrefixes.has(prefixKey)) return { ok: false, error: "该 CLI 安装位置正在执行其他操作" };
  activeCliPrefixes.add(prefixKey);
  try {
    const confirmation = await showLocalizedMessageBox({
      type: "question",
      title: `部署 ${plan.name}`,
      message: `确认安装 ${plan.name} ${plan.version}？`,
      detail: [
        `安装位置：${layout.directory}`,
        `Python：${runtime.version}`,
        "客户端创建独立虚拟环境，并从 PyPI 官方源安装固定、校验过的官方 wheel。",
        "不会修改系统 Python，也不会执行厂商远程 PowerShell 或 CMD 脚本。"
      ].join("\n"),
      buttons: ["取消", "确认部署"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) return { ok: false, canceled: true };

    fs.mkdirSync(layout.productRoot, { recursive: true });
    const canonicalProductRoot = fs.realpathSync.native(layout.productRoot);
    if (!pathIsInside(canonicalProductRoot, layout.prefix) || fs.existsSync(layout.directory)) {
      return { ok: false, error: "受管 Python CLI 目录已有内容或路径不安全" };
    }
    const venvAction = createPythonVenvAction({
      productId,
      plan,
      prefix: layout.prefix,
      pythonExecutable: runtime.executable,
      pythonMinor: runtime.minor
    });
    const installAction = createPythonPipInstallAction({ productId, plan, prefix: layout.prefix });
    if (!venvAction || !installAction) return { ok: false, error: "无法建立受管 Python 安装计划" };
    try {
      emitCliLog(sender, productId, "stdout", "正在创建独立 Python 环境…");
      await execFileAsync(venvAction.executable, venvAction.args, {
        ...venvAction.options,
        env: safePythonEnvironment(plan),
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024
      });
      fs.writeFileSync(installAction.layout.requirementsLock, installAction.requirementsText, { encoding: "utf8", flag: "wx" });
      emitCliLog(sender, productId, "stdout", "正在安装并校验官方固定版本…");
      const result = await execFileAsync(installAction.executable, installAction.args, {
        ...installAction.options,
        env: safePythonEnvironment(plan),
        timeout: 10 * 60_000,
        maxBuffer: 16 * 1024 * 1024
      });
      if (result.stdout?.trim()) emitCliLog(sender, productId, "stdout", result.stdout.trim());
      if (result.stderr?.trim()) emitCliLog(sender, productId, "stderr", result.stderr.trim());
      const verification = await execFileAsync(
        layout.pythonExecutable,
        ["-I", "-c", "import importlib.metadata as m,sys;print(m.version(sys.argv[1]))", plan.distributionName],
        { cwd: layout.directory, windowsHide: true, shell: false, env: safePythonEnvironment(plan), timeout: 30_000, maxBuffer: 64 * 1024 }
      );
      if (String(verification.stdout || "").trim() !== plan.version || !fs.existsSync(layout.commandExecutable)) {
        throw new Error("安装后的包版本或命令入口与客户端白名单不一致");
      }
      const receipt = createManagedPythonReceipt({
        productId,
        plan,
        prefix: layout.prefix,
        hashFile: (filePath) => fileIntegritySync(filePath, "sha256")
      });
      if (!receipt) throw new Error("无法建立 Python CLI 管理收据");
      setManagedCliRecord(productId, receipt);
      const terminal = await openManagedCliTerminal(productId);
      return { ok: true, version: receipt.version, directory: receipt.directory, managed: true, terminalOpened: terminal.ok, warning: terminal.ok ? undefined : terminal.error };
    } catch (error) {
      try {
        if (fs.existsSync(layout.directory)) fs.rmSync(layout.directory, { recursive: true, force: true });
      } catch {
        // Keep rollback scoped to the exact product version directory.
      }
      return { ok: false, error: error instanceof Error ? error.message : "Python CLI 安装失败" };
    }
  } finally {
    activeCliPrefixes.delete(prefixKey);
  }
}

async function reconcileManagedPythonCli(sender, productId, plan, intent) {
  if (intent === "install") return await deployManagedPythonCli(sender, productId, plan);
  if (process.arch !== plan.architecture) return { ok: false, error: "当前 Python CLI 依赖锁仅支持 Windows x64" };
  let runtime;
  let layout;
  try {
    runtime = await locatePythonRuntime(plan);
    layout = pythonCliLayoutAtConfiguredPrefix(productId, plan);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Python 环境不可用" };
  }
  if (!receiptOwnsManagedCliLayout(readManagedCliRecords()[productId], "python-venv", productId, layout)) {
    return { ok: false, error: "仅可更新或修复 AI Hub 收据拥有的 Python CLI" };
  }
  const prefixKey = layout.directory.toLowerCase();
  if (activeCliPrefixes.has(prefixKey)) return { ok: false, error: "该 CLI 安装位置正在执行其他操作" };
  activeCliPrefixes.add(prefixKey);
  let stagingPrefix = "";
  try {
    const confirmation = await showLocalizedMessageBox({
      type: "question", title: `${intent === "update" ? "更新" : "修复"} ${plan.name}`,
      message: `确认${intent === "update" ? "更新" : "修复"} ${plan.name} ${plan.version}？`,
      detail: "将建立新的隔离虚拟环境并安装固定哈希依赖；失败会保留原受管环境。",
      buttons: ["取消", "确认"], defaultId: 0, cancelId: 0, noLink: true
    });
    if (confirmation.response !== 1) return { ok: false, canceled: true };
    if (!receiptOwnsManagedCliLayout(readManagedCliRecords()[productId], "python-venv", productId, layout)) {
      return { ok: false, error: "确认期间 CLI 收据发生变化，已拒绝操作" };
    }
    stagingPrefix = createManagedCliReconcileStagingPrefix(layout.prefix);
    const stagingLayout = createManagedPythonLayout({ productId, plan, prefix: stagingPrefix });
    const venvAction = createPythonVenvAction({ productId, plan, prefix: stagingPrefix, pythonExecutable: runtime.executable, pythonMinor: runtime.minor });
    const installAction = createPythonPipInstallAction({ productId, plan, prefix: stagingPrefix });
    if (!stagingLayout || !venvAction || !installAction) return { ok: false, error: "无法建立受管 Python 更新计划" };
    fs.mkdirSync(stagingLayout.productRoot, { recursive: true });
    await execFileAsync(venvAction.executable, venvAction.args, { ...venvAction.options, env: safePythonEnvironment(plan), timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    fs.writeFileSync(installAction.layout.requirementsLock, installAction.requirementsText, { encoding: "utf8", flag: "wx" });
    const result = await execFileAsync(installAction.executable, installAction.args, { ...installAction.options, env: safePythonEnvironment(plan), timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024 });
    if (result.stdout?.trim()) emitCliLog(sender, productId, "stdout", result.stdout.trim());
    if (result.stderr?.trim()) emitCliLog(sender, productId, "stderr", result.stderr.trim());
    const verification = await execFileAsync(stagingLayout.pythonExecutable, ["-I", "-c", "import importlib.metadata as m,sys;print(m.version(sys.argv[1]))", plan.distributionName], { cwd: stagingLayout.directory, windowsHide: true, shell: false, env: safePythonEnvironment(plan), timeout: 30_000, maxBuffer: 64 * 1024 });
    if (String(verification.stdout || "").trim() !== plan.version || !fs.existsSync(stagingLayout.commandExecutable)) throw new Error("更新后的 Python 包版本或命令入口与客户端白名单不一致");
    const receipt = replaceManagedCliDirectory({
      currentDirectory: layout.directory,
      stagingDirectory: stagingLayout.directory,
      backupDirectory: `${layout.directory}.backup-${crypto.randomBytes(8).toString("hex")}`,
      createReceipt: () => createManagedPythonReceipt({ productId, plan, prefix: layout.prefix, hashFile: (filePath) => fileIntegritySync(filePath, "sha256") }),
      inspectReceipt: (candidate) => inspectManagedPythonCli({ productId, plan, receipt: candidate, configuredPrefix: layout.prefix, hashFile: (filePath) => fileIntegritySync(filePath, "sha256") }),
      commitReceipt: (candidate) => setManagedCliRecord(productId, candidate)
    });
    const terminal = await openManagedCliTerminal(productId);
    return { ok: true, version: receipt.version, directory: receipt.directory, managed: true, terminalOpened: terminal.ok, warning: terminal.ok ? undefined : terminal.error };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Python CLI 更新失败" };
  } finally {
    if (stagingPrefix) {
      try { fs.rmSync(stagingPrefix, { recursive: true, force: true }); } catch {}
    }
    activeCliPrefixes.delete(prefixKey);
  }
}

async function uninstallManagedPythonCli(productId, plan) {
  const records = readManagedCliRecords();
  const receipt = records[productId] || null;
  const action = createManagedPythonUninstallAction({
    productId,
    plan,
    receipt,
    configuredPrefix: readSettings().cliInstallDirectory || "",
    hashFile: (filePath) => fileIntegritySync(filePath, "sha256")
  });
  if (!action) return { ok: false, error: "Python CLI 文件或管理收据不一致，已拒绝卸载" };
  const prefixKey = action.directory.toLowerCase();
  if (activeCliPrefixes.has(prefixKey)) return { ok: false, error: "该 CLI 安装位置正在执行其他操作" };
  activeCliPrefixes.add(prefixKey);
  try {
    const confirmation = await showLocalizedMessageBox({
      type: "warning",
      title: `卸载 ${plan.name}`,
      message: `确认卸载 ${plan.name}？`,
      detail: [
        `当前版本：${action.version}`,
        `安装位置：${action.directory}`,
        `只删除${BRAND.name}创建的独立 Python 环境；账号、设置、项目和缓存数据会保留。`
      ].join("\n"),
      buttons: ["取消", "确认卸载"], defaultId: 0, cancelId: 0, noLink: true
    });
    if (confirmation.response !== 1) return { ok: false, canceled: true };
    const latest = readManagedCliRecords();
    const confirmed = createManagedPythonUninstallAction({
      productId, plan, receipt: latest[productId] || null,
      configuredPrefix: readSettings().cliInstallDirectory || "",
      hashFile: (filePath) => fileIntegritySync(filePath, "sha256")
    });
    if (!confirmed || confirmed.managementId !== action.managementId || confirmed.directory.toLowerCase() !== prefixKey) {
      return { ok: false, error: "确认期间 CLI 安装状态发生变化，已拒绝卸载" };
    }
    const tombstone = `${action.directory}.removing-${action.managementId}`;
    if (fs.existsSync(tombstone)) return { ok: false, error: "发现未完成的旧卸载目录，已停止操作" };
    fs.renameSync(action.directory, tombstone);
    try { removeManagedCliRecord(productId); } catch (error) {
      fs.renameSync(tombstone, action.directory);
      return { ok: false, error: error instanceof Error ? `管理收据更新失败：${error.message}` : "管理收据更新失败" };
    }
    try { fs.rmSync(tombstone, { recursive: true, force: true }); } catch (error) {
      return { ok: true, status: getCliStatus(productId), warning: `程序已移出受管位置，但旧文件清理失败：${error.message}` };
    }
    return { ok: true, status: getCliStatus(productId) };
  } finally {
    activeCliPrefixes.delete(prefixKey);
  }
}

async function runMsiProcess(executable, args, options = {}) {
  return await new Promise((resolve, reject) => {
    try {
      const child = spawn(executable, args, { windowsHide: options.windowsHide !== false, shell: false, stdio: "ignore" });
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0 || code === 3010) resolve(code);
        else reject(Object.assign(new Error(`Windows Installer 退出，代码 ${code}`), { msiExitCode: code }));
      });
    } catch (error) {
      reject(error);
    }
  });
}

function managedMsiTrust(plan) {
  const signaturePolicy = plan.artifact.signaturePolicy || "signed";
  return {
    signaturePolicy,
    ...(signaturePolicy === "signed"
      ? {
          expectedExecutableSigner: new RegExp(
            plan.artifact.expectedSigner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i"
          )
        }
      : {})
  };
}

async function downloadFixedMsi(sender, productId, plan, target) {
  const { response } = await fetchReviewedDownload({
    url: plan.artifact.url,
    options: {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": DOWNLOAD_USER_AGENT }
    },
    isAllowedFinalUrl: (candidate) => {
      try {
        const url = new URL(candidate);
        return url.protocol === "https:" &&
          !url.username && !url.password &&
          plan.artifact.allowedHosts.includes(url.hostname.toLowerCase());
      } catch {
        return false;
      }
    }
  });
  if (!response.ok || !response.body) {
    throw new Error(`官方下载失败（HTTP ${response.status}）`);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if ((contentLength && !Number.isSafeInteger(contentLength)) || contentLength > plan.artifact.maximumBytes) {
    throw new Error("官方 MSI 大小超过客户端白名单限制");
  }
  let receivedBytes = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      receivedBytes += chunk.length;
      if (receivedBytes > plan.artifact.maximumBytes) callback(new Error("官方 MSI 大小超过客户端白名单限制"));
      else callback(null, chunk);
    }
  });
  emitCliLog(sender, productId, "stdout", "正在下载官方固定 MSI…");
  await pipeline(Readable.fromWeb(response.body), limiter, fs.createWriteStream(target, { flags: "wx" }));
  if (!receivedBytes || (contentLength && receivedBytes !== contentLength)) throw new Error("官方 MSI 下载不完整");
  if (fileIntegritySync(target, "sha256") !== plan.artifact.sha256) throw new Error("官方 MSI 的 SHA-256 与客户端白名单不一致");
  const signature = await verifyPortableExecutableTrust(target, managedMsiTrust(plan));
  if (!signature.ok) throw new Error("官方 MSI 信任策略校验未通过");
}

async function deployManagedMsiCli(sender, productId, plan, intent = "install") {
  if (process.arch !== plan.architecture) return { ok: false, error: `${plan.name} 当前没有适用于本机架构的已审核安装包` };
  const layout = createManagedMsiCliLayout({
    productId,
    plan,
    localAppData: process.env.LOCALAPPDATA || "",
    programFiles: process.env.ProgramFiles || ""
  });
  if (!layout) return { ok: false, error: `${plan.name} 安装白名单无效` };
  const currentReceipt = readManagedCliRecords()[productId] || null;
  const status = getCliStatus(productId);
  if (intent === "install") {
    if (status.detection === "unknown") return { ok: false, error: `检测到未登记的 ${plan.name}，客户端不会覆盖或接管` };
    if (status.installed) return { ok: false, error: `${plan.name} 已由${BRAND.name}部署` };
  } else if (!matchesManagedMsiReceipt({ productId, plan, receipt: currentReceipt, localAppData: process.env.LOCALAPPDATA || "", programFiles: process.env.ProgramFiles || "" })) {
    return { ok: false, error: `${plan.name} 的管理收据不匹配，拒绝更新或修复` };
  }
  const prefixKey = layout.directory.toLowerCase();
  if (activeCliPrefixes.has(prefixKey)) return { ok: false, error: `${plan.name} 正在执行其他操作` };
  activeCliPrefixes.add(prefixKey);
  let temporaryDirectory = "";
  let msiInstalled = false;
  let receiptRecorded = false;
  try {
    const operation = intent === "update" ? "更新" : intent === "repair" ? "修复" : "部署";
    const confirmation = await showLocalizedMessageBox({
      type: "question", title: `${operation} ${plan.name}`, message: `确认${operation} ${plan.name} ${plan.version}？`,
      detail: [intent === "repair" ? "Windows Installer 将使用固定产品代码修复本地受管安装。" : plan.artifact.signaturePolicy === "pinned-unsigned" ? "客户端下载固定官方 MSI，并核对官方文件摘要；该厂商当前未签名此安装包。" : "客户端下载固定官方 MSI，并核对文件摘要与厂商数字签名。", `安装位置：${layout.directory}`, ...(plan.installUi === "interactive" ? ["Windows Installer 可能请求 UAC，并由你确认许可或安装选项。"] : []), ...(plan.postInstallArgs?.length ? ["完成后会应用客户端已审核的产品设置。"] : [])].join("\n"),
      buttons: ["取消", `确认${operation}`], defaultId: 0, cancelId: 0, noLink: true
    });
    if (confirmation.response !== 1) return { ok: false, canceled: true };
    if (intent !== "install" && !matchesManagedMsiReceipt({ productId, plan, receipt: readManagedCliRecords()[productId] || null, localAppData: process.env.LOCALAPPDATA || "", programFiles: process.env.ProgramFiles || "" })) {
      return { ok: false, error: `确认期间 ${plan.name} 的管理收据发生变化，已拒绝操作` };
    }
    const msiexec = systemCommandPath("msiexec.exe");
    if (!fs.existsSync(msiexec)) throw new Error("无法定位 Windows Installer");
    if (intent === "repair") {
      emitCliLog(sender, productId, "stdout", `正在修复 ${plan.name}…`);
      await runMsiProcess(msiexec, ["/f", plan.productCode, ...(plan.installUi === "interactive" ? [] : ["/quiet"]), "/norestart"], { windowsHide: plan.installUi !== "interactive" });
    } else {
      const temporaryRoot = fs.realpathSync.native(app.getPath("temp"));
      const temporaryPrefix = `zhenxing-cli-msi-${productId}-`;
      temporaryDirectory = fs.mkdtempSync(path.join(temporaryRoot, temporaryPrefix));
      const msiPath = path.join(temporaryDirectory, plan.artifact.fileName);
      await downloadFixedMsi(sender, productId, plan, msiPath);
      emitCliLog(sender, productId, "stdout", `正在${intent === "update" ? "更新" : "安装"} ${plan.name}…`);
      await runMsiProcess(msiexec, ["/i", msiPath, ...(plan.installUi === "interactive" ? [] : ["/quiet"]), "/norestart"], { windowsHide: plan.installUi !== "interactive" });
    }
    msiInstalled = true;
    let executable;
    try {
      executable = fs.realpathSync.native(layout.executable);
    } catch {
      throw new Error(`MSI 已退出，但未找到 ${plan.name} 程序`);
    }
    if (path.normalize(executable).toLowerCase() !== path.normalize(layout.executable).toLowerCase()) throw new Error(`${plan.name} 安装路径发生跳转`);
    const executableSignature = await verifyPortableExecutableTrust(
      executable,
      managedMsiTrust(plan)
    );
    if (!executableSignature.ok) throw new Error(`${plan.name} 程序信任策略校验未通过`);
    const versionCheck = await execFileAsync(executable, plan.versionArgs || ["--version"], { cwd: layout.directory, windowsHide: true, shell: false, timeout: 30_000, maxBuffer: 64 * 1024 });
    const versionOutput = `${versionCheck.stdout || ""}\n${versionCheck.stderr || ""}`.trim();
    if (!versionOutput.includes(plan.version)) throw new Error(`${plan.name} 程序版本与客户端白名单不一致`);
    if (plan.postInstallArgs?.length) {
      await execFileAsync(executable, plan.postInstallArgs, { cwd: layout.directory, windowsHide: true, shell: false, timeout: 30_000, maxBuffer: 1024 * 1024 });
    }
    const receipt = createManagedMsiCliReceipt({
      productId,
      plan,
      localAppData: process.env.LOCALAPPDATA || "",
      programFiles: process.env.ProgramFiles || "",
      hashFile: (filePath) => fileIntegritySync(filePath, "sha256")
    });
    if (!receipt) throw new Error(`无法建立 ${plan.name} 管理收据`);
    setManagedCliRecord(productId, receipt);
    receiptRecorded = true;
    const terminal = await openManagedCliTerminal(productId);
    return { ok: true, version: receipt.version, directory: receipt.directory, managed: true, terminalOpened: terminal.ok, warning: terminal.ok ? undefined : terminal.error };
  } catch (error) {
    if (intent === "install" && msiInstalled && !receiptRecorded) {
      try {
        await runMsiProcess(systemCommandPath("msiexec.exe"), ["/x", plan.productCode, ...(plan.uninstallUi === "interactive" ? [] : ["/quiet"]), "/norestart"], { windowsHide: plan.uninstallUi !== "interactive" });
      } catch {
        // Report the original failure; the next status check will show the untracked install.
      }
    }
    return error?.msiExitCode === 1602 || error?.msiExitCode === 1223
      ? { ok: false, canceled: true }
      : { ok: false, error: error instanceof Error ? error.message : `${plan.name} 安装失败` };
  } finally {
    if (temporaryDirectory) {
      try {
        const resolvedTemp = fs.realpathSync.native(app.getPath("temp"));
        const resolvedDirectory = fs.realpathSync.native(temporaryDirectory);
        if (path.dirname(resolvedDirectory).toLowerCase() === resolvedTemp.toLowerCase() && path.basename(resolvedDirectory).startsWith(`zhenxing-cli-msi-${productId}-`)) fs.rmSync(resolvedDirectory, { recursive: true, force: true });
      } catch {
        // Never broaden cleanup beyond the exact temporary directory.
      }
    }
    activeCliPrefixes.delete(prefixKey);
  }
}

async function uninstallManagedMsiCli(productId, plan) {
  const records = readManagedCliRecords();
  const action = createManagedMsiUninstallAction({
    productId, plan, receipt: records[productId] || null,
    localAppData: process.env.LOCALAPPDATA || "",
    programFiles: process.env.ProgramFiles || "",
    msiexecExecutable: systemCommandPath("msiexec.exe"),
    hashFile: (filePath) => fileIntegritySync(filePath, "sha256")
  });
  if (!action) return { ok: false, error: `${plan.name} 文件或管理收据不一致，已拒绝卸载` };
  const prefixKey = action.directory.toLowerCase();
  if (activeCliPrefixes.has(prefixKey)) return { ok: false, error: `${plan.name} 正在执行其他操作` };
  activeCliPrefixes.add(prefixKey);
  try {
    const confirmation = await showLocalizedMessageBox({
      type: "warning", title: `卸载 ${plan.name}`, message: `确认卸载 ${plan.name}？`,
      detail: "Windows Installer 将移除程序；账号、设置和会话数据会保留。",
      buttons: ["取消", "确认卸载"], defaultId: 0, cancelId: 0, noLink: true
    });
    if (confirmation.response !== 1) return { ok: false, canceled: true };
    const latest = readManagedCliRecords();
    const confirmed = createManagedMsiUninstallAction({ productId, plan, receipt: latest[productId] || null, localAppData: process.env.LOCALAPPDATA || "", programFiles: process.env.ProgramFiles || "", msiexecExecutable: systemCommandPath("msiexec.exe"), hashFile: (filePath) => fileIntegritySync(filePath, "sha256") });
    if (!confirmed || confirmed.managementId !== action.managementId) return { ok: false, error: `确认期间 ${plan.name} 状态发生变化，已拒绝卸载` };
    await runMsiProcess(confirmed.executable, confirmed.args, confirmed.options);
    if (fs.existsSync(action.productExecutable)) return { ok: false, error: `Windows Installer 已退出，但 ${plan.name} 仍存在；管理收据已保留` };
    removeManagedCliRecord(productId);
    return { ok: true, status: getCliStatus(productId) };
  } catch (error) {
    return error?.msiExitCode === 1602 || error?.msiExitCode === 1223
      ? { ok: false, canceled: true }
      : { ok: false, error: error instanceof Error ? error.message : `${plan.name} 卸载失败` };
  } finally {
    activeCliPrefixes.delete(prefixKey);
  }
}

function safeDownloadTarget(fileName) {
  const settings = readSettings();
  const directory = settings.downloadDirectory;
  if (!directory || !path.isAbsolute(directory)) {
    throw new Error("请先选择安装包下载位置");
  }

  const safeName = path.basename(fileName);
  if (
    safeName !== fileName ||
    !/\.(exe|msi|msix|zip)$/i.test(safeName)
  ) {
    throw new Error("安装包文件名无效");
  }

  fs.mkdirSync(directory, { recursive: true });
  const parsed = path.parse(safeName);
  let candidateName = safeName;
  let suffix = 1;
  while (
    fs.existsSync(path.resolve(directory, candidateName)) ||
    fs.existsSync(`${path.resolve(directory, candidateName)}.part`)
  ) {
    candidateName = `${parsed.name} (${suffix})${parsed.ext}`;
    suffix += 1;
  }
  const target = path.resolve(directory, candidateName);
  const relative = path.relative(path.resolve(directory), target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("安装包路径无效");
  }
  return target;
}

function availableDiskBytes(targetPath) {
  const stats = fs.statfsSync(path.dirname(targetPath), { bigint: true });
  const available = stats.bavail * stats.bsize;
  return Number(
    available > BigInt(Number.MAX_SAFE_INTEGER)
      ? BigInt(Number.MAX_SAFE_INTEGER)
      : available
  );
}

function gigabytesForMessage(bytes) {
  return `${Math.ceil((bytes / 1024 ** 3) * 10) / 10} GB`;
}

function insufficientDownloadSpaceError(space, target) {
  const error = new Error(
    `下载位置空间不足：需要 ${gigabytesForMessage(space.requiredBytes)}，` +
      `当前可用 ${gigabytesForMessage(space.availableBytes)}，请更换下载位置`
  );
  error.code = "INSUFFICIENT_DISK_SPACE";
  error.availableBytes = space.availableBytes;
  error.requiredBytes = space.requiredBytes;
  error.remainingBytes = space.remainingBytes;
  error.reserveBytes = space.reserveBytes;
  error.shortfallBytes = space.shortfallBytes;
  error.downloadDirectory = path.dirname(target);
  return error;
}

function canonicalDownloadRoot(targetPath) {
  const directory = path.dirname(path.resolve(targetPath));
  const canonical = fs.realpathSync.native(directory);
  if (!path.isAbsolute(canonical)) {
    throw new Error(
      "\u4e0b\u8f7d\u4f4d\u7f6e\u65e0\u6cd5\u5b89\u5168\u89e3\u6790"
    );
  }
  return path.resolve(canonical);
}

function hasExpectedManagedDownloadName(targetPath, fileName) {
  const expected = path.parse(fileName);
  const actual = path.parse(path.basename(targetPath));
  const suffix = actual.name.slice(expected.name.length);
  return (
    actual.ext.toLowerCase() === expected.ext.toLowerCase() &&
    (actual.name === expected.name || /^ \(\d+\)$/.test(suffix))
  );
}

function migrateLegacyManagedPartialRecord(
  productId,
  plan,
  record,
  records
) {
  if (
    !record ||
    (typeof record.downloadRoot === "string" &&
      typeof record.attemptId === "string" &&
      record.attemptId)
  ) {
    return record;
  }
  const settings = readSettings();
  if (
    record.productId !== productId ||
    record.url !== plan.url ||
    record.fileName !== plan.fileName ||
    typeof record.targetPath !== "string" ||
    !path.isAbsolute(record.targetPath) ||
    typeof settings.downloadDirectory !== "string" ||
    !path.isAbsolute(settings.downloadDirectory)
  ) {
    return null;
  }
  const configuredRoot = path.resolve(settings.downloadDirectory);
  const legacyTarget = path.resolve(record.targetPath);
  const relative = path.relative(configuredRoot, legacyTarget);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    path.dirname(legacyTarget).toLowerCase() !==
      configuredRoot.toLowerCase() ||
    !hasExpectedManagedDownloadName(legacyTarget, plan.fileName) ||
    fs.existsSync(legacyTarget)
  ) {
    return null;
  }
  try {
    const canonicalRoot = fs.realpathSync.native(configuredRoot);
    const canonicalTarget = path.join(
      canonicalRoot,
      path.basename(legacyTarget)
    );
    const legacyPartial = `${legacyTarget}.part`;
    if (fs.existsSync(legacyPartial)) {
      const stat = fs.lstatSync(legacyPartial);
      const canonicalPartial = fs.realpathSync.native(legacyPartial);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        path.dirname(canonicalPartial).toLowerCase() !==
          canonicalRoot.toLowerCase()
      ) {
        return null;
      }
    }
    const migrated = {
      ...record,
      attemptId:
        typeof record.attemptId === "string" && record.attemptId
          ? record.attemptId
          : `legacy-${crypto.randomUUID()}`,
      downloadRoot: path.resolve(canonicalRoot),
      targetPath: canonicalTarget,
      updatedAt: new Date().toISOString()
    };
    writePartialDownloadRecords({ ...records, [productId]: migrated });
    return migrated;
  } catch {
    return null;
  }
}

function managedPartialDownload(productId, plan) {
  const records = readPartialDownloadRecords();
  let record = records[productId];
  record = migrateLegacyManagedPartialRecord(
    productId,
    plan,
    record,
    records
  );
  if (
    !record ||
    record.productId !== productId ||
    record.url !== plan.url ||
    record.fileName !== plan.fileName ||
    typeof record.targetPath !== "string" ||
    !path.isAbsolute(record.targetPath) ||
    typeof record.downloadRoot !== "string" ||
    !path.isAbsolute(record.downloadRoot) ||
    typeof record.attemptId !== "string" ||
    !record.attemptId
  ) {
    return null;
  }
  const directory = path.resolve(record.downloadRoot);
  const target = path.resolve(record.targetPath);
  const relative = path.relative(directory, target);
  const partialPath = `${target}.part`;
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    path.dirname(target).toLowerCase() !== directory.toLowerCase() ||
    !hasExpectedManagedDownloadName(target, plan.fileName) ||
    fs.existsSync(target)
  ) {
    return null;
  }
  let receivedBytes = 0;
  let partialExists = false;
  try {
    const resolvedDirectory = fs.realpathSync.native(directory);
    if (resolvedDirectory.toLowerCase() !== directory.toLowerCase()) {
      return null;
    }
    if (fs.existsSync(partialPath)) {
      const stat = fs.lstatSync(partialPath);
      const resolvedPartial = fs.realpathSync.native(partialPath);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        path.dirname(resolvedPartial).toLowerCase() !==
          resolvedDirectory.toLowerCase()
      ) {
        return null;
      }
      receivedBytes = stat.size;
      partialExists = true;
    }
  } catch {
    return null;
  }
  if (!Number.isSafeInteger(receivedBytes) || receivedBytes < 0) return null;
  return {
    productId,
    attemptId: record.attemptId,
    fileName: plan.fileName,
    downloadRoot: directory,
    targetPath: target,
    partialPath,
    partialExists,
    receivedBytes,
    totalBytes:
      Number.isSafeInteger(record.totalBytes) && record.totalBytes > 0
        ? record.totalBytes
        : 0,
    updatedAt: String(record.updatedAt || "")
  };
}

function reusablePartialDownload(productId, plan) {
  const partial = managedPartialDownload(productId, plan);
  return isReusablePartialEvidence(partial) ? partial : null;
}

function discardManagedPartialDownload(productId, plan) {
  const records = readPartialDownloadRecords();
  if (!Object.prototype.hasOwnProperty.call(records, productId)) {
    return { ok: true, receivedBytes: 0, partial: null };
  }
  const partial = managedPartialDownload(productId, plan);
  if (!partial) {
    try {
      const { nextRecords } = removeRecordMetadata(records, productId);
      writePartialDownloadRecords(nextRecords);
      return {
        ok: true,
        receivedBytes: 0,
        partial: null,
        metadataOnly: true
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: "CANCEL_CLEANUP_FAILED",
        errorMessage:
          error instanceof Error
            ? `\u65e0\u6cd5\u6e05\u7406\u65e0\u6548\u65ad\u70b9\u8bb0\u5f55\uff1a${error.message}`
            : "\u65e0\u6cd5\u6e05\u7406\u65e0\u6548\u65ad\u70b9\u8bb0\u5f55\uff0c\u8bf7\u91cd\u8bd5",
        receivedBytes: 0,
        partial: null
      };
    }
  }
  try {
    if (partial.partialExists) {
      try {
        fs.rmSync(partial.partialPath);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    if (fs.existsSync(partial.partialPath)) {
      throw new Error(
        "\u65ad\u70b9\u6587\u4ef6\u5220\u9664\u540e\u4ecd\u5b58\u5728"
      );
    }
    const nextRecords = { ...records };
    delete nextRecords[productId];
    writePartialDownloadRecords(nextRecords);
    return {
      ok: true,
      receivedBytes: partial.receivedBytes,
      partial
    };
  } catch (error) {
    const remainingPartial = managedPartialDownload(productId, plan);
    return {
      ok: false,
      errorCode: "CANCEL_CLEANUP_FAILED",
      errorMessage:
        error instanceof Error
          ? `\u65e0\u6cd5\u6e05\u7406\u4e0b\u8f7d\u65ad\u70b9\uff1a${error.message}`
          : "\u65e0\u6cd5\u6e05\u7406\u4e0b\u8f7d\u65ad\u70b9\uff0c\u8bf7\u91cd\u8bd5\u53d6\u6d88",
      receivedBytes: partial.receivedBytes,
      partial: selectCleanupFailurePartial(remainingPartial, partial)
    };
  }
}

function rollbackUncommittedManagedArtifact(
  productId,
  plan,
  filePath,
  intent,
  attemptId
) {
  if (!filePath) return { ok: true };
  const record = readPartialDownloadRecords()[productId];
  if (
    !record ||
    record.productId !== productId ||
    record.attemptId !== attemptId ||
    record.url !== plan.url ||
    record.fileName !== plan.fileName ||
    typeof record.targetPath !== "string" ||
    typeof record.downloadRoot !== "string" ||
    !path.isAbsolute(record.targetPath) ||
    !path.isAbsolute(record.downloadRoot)
  ) {
    return {
      ok: false,
      errorCode: "CANCEL_CLEANUP_FAILED",
      errorMessage:
        "\u5b8c\u6210\u6587\u4ef6\u7684\u65ad\u70b9\u8bb0\u5f55\u65e0\u6cd5\u5b89\u5168\u9a8c\u8bc1"
    };
  }
  const target = path.resolve(record.targetPath);
  const root = path.resolve(record.downloadRoot);
  if (
    path.resolve(filePath).toLowerCase() !== target.toLowerCase() ||
    path.dirname(target).toLowerCase() !== root.toLowerCase() ||
    !hasExpectedManagedDownloadName(target, plan.fileName)
  ) {
    return {
      ok: false,
      errorCode: "CANCEL_CLEANUP_FAILED",
      errorMessage:
        "\u5b8c\u6210\u6587\u4ef6\u8def\u5f84\u4e0e\u53ef\u4fe1\u65ad\u70b9\u8bb0\u5f55\u4e0d\u4e00\u81f4"
    };
  }
  try {
    const stat = fs.lstatSync(target);
    const canonicalRoot = fs.realpathSync.native(root);
    const canonicalFile = fs.realpathSync.native(target);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      canonicalRoot.toLowerCase() !== root.toLowerCase() ||
      path.dirname(canonicalFile).toLowerCase() !==
        canonicalRoot.toLowerCase()
    ) {
      throw new Error(
        "\u5b8c\u6210\u6587\u4ef6\u672a\u901a\u8fc7\u5b89\u5168\u6821\u9a8c"
      );
    }
    if (intent === "pause") {
      const partialPath = `${target}.part`;
      if (fs.existsSync(partialPath)) {
        throw new Error(
          "\u65ad\u70b9\u6587\u4ef6\u5df2\u5b58\u5728"
        );
      }
      fs.renameSync(target, partialPath);
    } else {
      fs.rmSync(target);
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorCode: "CANCEL_CLEANUP_FAILED",
      errorMessage:
        error instanceof Error
          ? `\u65e0\u6cd5\u56de\u6eda\u672a\u63d0\u4ea4\u7684\u5b8c\u6210\u6587\u4ef6\uff1a${error.message}`
          : "\u65e0\u6cd5\u56de\u6eda\u672a\u63d0\u4ea4\u7684\u5b8c\u6210\u6587\u4ef6"
    };
  }
}

async function downloadPackage(sender, input, target, options = {}) {
  const partial = `${target}.part`;
  const controller = options.controller || new AbortController();
  const requestedBytes =
    options.resumeAllowed && fs.existsSync(partial)
      ? fs.statSync(partial).size
      : 0;
  let output = null;
  let outputError = null;
  let reader = null;
  const canceledDownloadError = () =>
    Object.assign(new Error("Download canceled"), {
      name: "AbortError",
      code: "ABORT_ERR"
    });
  const abortActiveIo = () => {
    const error = canceledDownloadError();
    reader?.cancel(error).catch(() => {});
    if (output && !output.closed) output.destroy(error);
  };
  controller.signal.addEventListener("abort", abortActiveIo, { once: true });
  try {
    if (Number.isSafeInteger(options.completePartialBytes)) {
      assertDownloadCanFinalize({
        receivedBytes: requestedBytes,
        totalBytes: options.completePartialBytes,
        isCurrentAttempt: options.isCurrentAttempt
      });
      const stat = fs.lstatSync(partial);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size !== options.completePartialBytes
      ) {
        const error = new Error("Completed partial changed before promotion");
        error.code = "PARTIAL_PROMOTION_INVALID";
        throw error;
      }
      const completedHash = crypto.createHash("sha256");
      await updateHashFromFile(completedHash, partial);
      const verifiedStat = fs.lstatSync(partial);
      if (
        !verifiedStat.isFile() ||
        verifiedStat.isSymbolicLink() ||
        verifiedStat.size !== options.completePartialBytes
      ) {
        const error = new Error("Completed partial changed while hashing");
        error.code = "PARTIAL_PROMOTION_INVALID";
        throw error;
      }
      assertDownloadCanFinalize({
        receivedBytes: verifiedStat.size,
        totalBytes: options.completePartialBytes,
        isCurrentAttempt: options.isCurrentAttempt
      });
      fs.renameSync(partial, target);
      return {
        filePath: target,
        sha256: completedHash.digest("hex"),
        fileSize: verifiedStat.size,
        resumedFrom: verifiedStat.size
      };
    }
    const { response } = await fetchReviewedDownload({
      url: input.url,
      options: {
        method: "GET",
        headers: {
          "User-Agent": DOWNLOAD_USER_AGENT,
          ...createResumeHeaders(requestedBytes)
        },
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal
      },
      isAllowedFinalUrl: (candidate) => {
        if (
          input.managedProductId &&
          !isAllowedManagedDownloadUrl(input.managedProductId, candidate)
        ) {
          return false;
        }
        let parsed;
        try {
          parsed = new URL(candidate);
        } catch {
          return false;
        }
        if (parsed.protocol !== "https:") return false;
        if (
          Array.isArray(input.allowedFinalHosts) &&
          !input.allowedFinalHosts.includes(parsed.hostname)
        ) {
          return false;
        }
        if (
          Array.isArray(input.allowedFinalOrigins) &&
          !input.allowedFinalOrigins.includes(parsed.origin)
        ) {
          return false;
        }
        return true;
      }
    });
    if (!response.ok) {
      const error = new Error("下载服务器未返回可用安装包");
      error.code = "DOWNLOAD_HTTP_FAILED";
      throw error;
    }
    if (!response.body) {
      const error = new Error("下载服务器未返回安装包内容");
      error.code = "DOWNLOAD_HTTP_BODY_MISSING";
      throw error;
    }

    if (controller.signal.aborted) throw canceledDownloadError();
    const resume = resolveResumeResponse({
      requestedBytes,
      status: response.status,
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range")
    });
    const totalBytes = resume.totalBytes;
    let receivedBytes = resume.receivedBytes;
    options.onMetadata?.({ receivedBytes, totalBytes });
    if (Number.isSafeInteger(options.safetyReserveBytes)) {
      const space = assessDownloadSpace({
        availableBytes: availableDiskBytes(target),
        totalBytes,
        receivedBytes: requestedBytes,
        safetyReserveBytes: options.safetyReserveBytes
      });
      const installAvailableBytes = options.installDiskBytes
        ? availableDiskBytes(path.join(app.getPath("home"), "AI-Hub-Probe"))
        : 0;
      const downloadUsesInstallVolume =
        path.parse(path.resolve(target)).root.toLowerCase() ===
        path.parse(path.resolve(app.getPath("home"))).root.toLowerCase();
      sender.send("download:progress", {
        productId: input.productId,
        receivedBytes,
        totalBytes,
        bytesPerSecond: 0,
        etaSeconds: null,
        percent: totalBytes
          ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
          : null,
        availableBytes: space.availableBytes,
        requiredBytes: space.requiredBytes,
        remainingBytes: space.remainingBytes,
        reserveBytes: space.reserveBytes,
        downloadDirectory: path.dirname(target),
        installDiskBytes: options.installDiskBytes || 0,
        installAvailableBytes,
        installSpaceOk:
          !options.installDiskBytes ||
          installAvailableBytes -
              (downloadUsesInstallVolume ? space.remainingBytes : 0) >=
            options.installDiskBytes,
        spaceOk: space.ok
      });
      if (!space.ok) {
        throw insufficientDownloadSpaceError(space, target);
      }
    }
    const startedAt = Date.now();
    const sessionStartBytes = receivedBytes;
    const hash = crypto.createHash("sha256");
    if (resume.append) await updateHashFromFile(hash, partial);
    output = fs.createWriteStream(partial, {
      flags: resume.append ? "a" : "w"
    });
    output.on("error", (error) => {
      outputError = error;
      reader?.cancel().catch(() => {});
    });
    reader = response.body.getReader();
    let receivedNetworkData = false;

    while (true) {
      let chunk;
      if (receivedNetworkData) {
        chunk = await reader.read();
      } else {
        let timeout = null;
        chunk = await Promise.race([
          reader.read().finally(() => clearTimeout(timeout)),
          new Promise((_, reject) => {
            timeout = setTimeout(() => {
              const error = new Error("官方下载连接后始终没有数据");
              error.code = "DOWNLOAD_SOURCE_NO_DATA";
              reject(error);
            }, 15_000);
          })
        ]);
      }
      if (controller.signal.aborted) throw canceledDownloadError();
      if (chunk.done) break;
      if (outputError) throw outputError;
      const buffer = Buffer.from(chunk.value);
      if (buffer.length > 0) receivedNetworkData = true;
      let liveSpace = null;
      if (Number.isSafeInteger(options.safetyReserveBytes)) {
        liveSpace = assessDownloadSpace({
          availableBytes: availableDiskBytes(target),
          totalBytes,
          receivedBytes,
          safetyReserveBytes: options.safetyReserveBytes,
          nextWriteBytes: buffer.length
        });
        if (!liveSpace.ok) {
          throw insufficientDownloadSpaceError(liveSpace, target);
        }
      }
      receivedBytes += buffer.length;
      hash.update(buffer);
      if (!output.write(buffer)) await once(output, "drain");
      sender.send("download:progress", {
        productId: input.productId,
        receivedBytes,
        totalBytes,
        bytesPerSecond:
          Date.now() > startedAt
            ? Math.round(
                (receivedBytes - sessionStartBytes) /
                  ((Date.now() - startedAt) / 1000)
              )
            : 0,
        etaSeconds:
          totalBytes &&
          receivedBytes > sessionStartBytes &&
          Date.now() > startedAt
            ? Math.max(
                0,
                Math.round(
                  (totalBytes - receivedBytes) /
                    ((receivedBytes - sessionStartBytes) /
                      ((Date.now() - startedAt) / 1000))
                )
              )
            : null,
        percent: totalBytes
          ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
          : null,
        ...(liveSpace
          ? {
              availableBytes: liveSpace.availableBytes,
              requiredBytes: liveSpace.requiredBytes,
              remainingBytes: liveSpace.remainingBytes,
              reserveBytes: liveSpace.reserveBytes,
              spaceOk: liveSpace.ok
            }
          : {})
      });
    }

    if (outputError) throw outputError;
    output.end();
    await once(output, "close");
    assertDownloadCanFinalize({
      receivedBytes,
      totalBytes,
      isCurrentAttempt: options.isCurrentAttempt
    });
    fs.renameSync(partial, target);
    return {
      filePath: target,
      sha256: hash.digest("hex"),
      fileSize: receivedBytes,
      resumedFrom: resume.append ? requestedBytes : 0
    };
  } catch (error) {
    const canceledByUser = controller.signal.aborted;
    if (error?.code === "ENOSPC") {
      error.message = "下载过程中磁盘空间已耗尽，已保留断点，请清理空间后继续";
    }
    controller.abort();
    reader?.cancel().catch(() => {});
    if (output && !output.closed) {
      output.destroy();
      await once(output, "close").catch(() => {});
    }
    if (!options.keepPartial) {
      try {
        fs.rmSync(partial, { force: true });
      } catch {
        // A later attempt truncates the same fixed partial path.
      }
    }
    if (error && typeof error === "object") {
      error.downloadCanceled = canceledByUser;
    }
    throw error;
  } finally {
    controller.signal.removeEventListener("abort", abortActiveIo);
  }
}

function trustedCompletedDownloadRecord(productId) {
  const plan = resolveManagedDownloadPlan(productId);
  const record = readDownloadRecords()[productId];
  if (
    !plan ||
    !record ||
    record.productId !== productId ||
    typeof record.filePath !== "string" ||
    !path.isAbsolute(record.filePath) ||
    typeof record.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(record.sha256) ||
    !Number.isSafeInteger(record.fileSize) ||
    record.fileSize < 0 ||
    (plan.environmentId && record.url !== plan.url)
  ) {
    return null;
  }
  try {
    const resolvedFile = path.resolve(record.filePath);
    const stat = fs.lstatSync(resolvedFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== record.fileSize) {
      return null;
    }
    const expected = path.parse(plan.fileName);
    const actual = path.parse(path.basename(resolvedFile));
    const suffix = actual.name.slice(expected.name.length);
    if (
      actual.ext.toLowerCase() !== expected.ext.toLowerCase() ||
      (actual.name !== expected.name && !/^ \(\d+\)$/.test(suffix))
    ) {
      return null;
    }
    if (typeof record.downloadRoot === "string") {
      const root = path.resolve(record.downloadRoot);
      if (
        !path.isAbsolute(record.downloadRoot) ||
        path.dirname(resolvedFile).toLowerCase() !== root.toLowerCase() ||
        path.dirname(fs.realpathSync.native(resolvedFile)).toLowerCase() !==
          fs.realpathSync.native(root).toLowerCase()
      ) {
        return null;
      }
    }
    return { ...record, filePath: resolvedFile };
  } catch {
    return null;
  }
}

function taskProgressForPartial(task, partial) {
  const totalBytes = partial?.totalBytes || task?.progress?.totalBytes || 0;
  const receivedBytes = partial?.receivedBytes || 0;
  return {
    receivedBytes,
    totalBytes,
    bytesPerSecond: 0,
    etaSeconds: null,
    percent: totalBytes
      ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
      : null,
    downloadDirectory: partial?.downloadRoot || null
  };
}

function advanceManagedDownloadCompleted(productId, attemptId, record) {
  const current = currentManagedDownloadTask(productId);
  if (current?.phase === "completed") return current;
  const completed = advanceManagedDownloadTask(productId, {
    type:
      current?.phase === "canceling"
        ? "recover-completed"
        : "completed",
    attemptId,
    progress: {
      receivedBytes: record.fileSize,
      totalBytes: record.fileSize,
      bytesPerSecond: 0,
      etaSeconds: 0,
      percent: 100,
      remainingBytes: 0,
      downloadDirectory: record.downloadRoot
    },
    filePath: record.filePath,
    sha256: record.sha256,
    fileSize: record.fileSize
  });
  return completed.accepted ? completed.task : current;
}

function failManagedDownloadCancellation(productId, task, cleanup) {
  const failed = advanceManagedDownloadTask(productId, {
    type: "cancel-cleanup-failed",
    attemptId: task.attemptId,
    resumable: isReusablePartialEvidence(cleanup.partial),
    errorCode: cleanup.errorCode || "CANCEL_CLEANUP_FAILED",
    errorMessage:
      cleanup.errorMessage ||
      "\u53d6\u6d88\u65ad\u70b9\u6e05\u7406\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u53d6\u6d88",
    progress: taskProgressForPartial(task, cleanup.partial)
  });
  return failed.accepted ? failed.task : task;
}

function createTaskFromEvidence(productId, evidence) {
  const resumablePartial = isReusablePartialEvidence(evidence.partial)
    ? evidence.partial
    : null;
  const attemptId = crypto.randomUUID();
  const started = advanceManagedDownloadTask(productId, {
    type: "start",
    attemptId,
    progress: evidence.partial
      ? taskProgressForPartial(null, evidence.partial)
      : undefined
  });
  if (!started.accepted) return null;
  if (evidence.record) {
    return advanceManagedDownloadTask(productId, {
      type: "completed",
      attemptId,
      progress: {
        receivedBytes: evidence.record.fileSize,
        totalBytes: evidence.record.fileSize,
        bytesPerSecond: 0,
        etaSeconds: 0,
        percent: 100
      },
      filePath: evidence.record.filePath,
      sha256: evidence.record.sha256,
      fileSize: evidence.record.fileSize
    }).task;
  }
  return advanceManagedDownloadTask(productId, {
    type: "pause",
    attemptId,
    resumable: Boolean(resumablePartial),
    progress: taskProgressForPartial(started.task, resumablePartial)
  }).task;
}

function reconcileManagedDownloadTask(productId) {
  loadManagedDownloadTasks();
  let task = managedDownloadTasks.get(productId) || null;
  const scheduled = managedDownloadQueue?.status(productId);
  if (
    task &&
    (scheduled?.phase === "queued" || scheduled?.phase === "downloading") &&
    ["queued", "starting", "downloading", "canceling"].includes(task.phase)
  ) return task;
  const plan = resolveManagedDownloadPlan(productId);
  if (!plan) return null;
  const record = trustedCompletedDownloadRecord(productId);
  const partial = managedPartialDownload(productId, plan);

  if (!task) {
    return record || partial
      ? createTaskFromEvidence(productId, { record, partial })
      : null;
  }
  if (activeDownloads.has(productId)) return task;

  if (record) {
    if (task.phase === "completed") return task;
    if (task.phase === "canceling") {
      const recovered = advanceManagedDownloadTask(productId, {
        type: "recover-completed",
        attemptId: task.attemptId,
        progress: {
          receivedBytes: record.fileSize,
          totalBytes: record.fileSize,
          bytesPerSecond: 0,
          etaSeconds: 0,
          percent: 100
        },
        filePath: record.filePath,
        sha256: record.sha256,
        fileSize: record.fileSize
      });
      if (recovered.accepted) {
        try {
          removePartialDownloadRecord(productId);
        } catch {
          // The trusted completed record remains authoritative on next startup.
        }
        return recovered.task;
      }
      return task;
    }
    if (!["starting", "downloading", "pausing"].includes(task.phase)) {
      const retried = advanceManagedDownloadTask(productId, {
        type: "retry",
        attemptId: crypto.randomUUID()
      });
      if (!retried.accepted) return task;
      task = retried.task;
    }
    const completed = advanceManagedDownloadTask(productId, {
      type: "completed",
      attemptId: task.attemptId,
      progress: {
        receivedBytes: record.fileSize,
        totalBytes: record.fileSize,
        bytesPerSecond: 0,
        etaSeconds: 0,
        percent: 100
      },
      filePath: record.filePath,
      sha256: record.sha256,
      fileSize: record.fileSize
    });
    return completed.accepted ? completed.task : task;
  }

  if (
    !partial &&
    (task.phase === "completed" || isMissingDownloadedFileTask(task))
  ) {
    removeManagedDownloadState(productId, {
      expectedAttemptId: task.attemptId,
      clearCompletedRecord: true
    });
    return null;
  }

  if (task.phase === "canceling") {
    const cleanup = discardManagedPartialDownload(productId, plan);
    if (!cleanup.ok) {
      return failManagedDownloadCancellation(productId, task, cleanup);
    }
    const canceled = advanceManagedDownloadTask(productId, {
      type: "cancel",
      attemptId: task.attemptId
    });
    return canceled.accepted ? canceled.task : task;
  }

  if (["starting", "downloading", "pausing"].includes(task.phase)) {
    const paused = advanceManagedDownloadTask(productId, {
      type: "pause",
      attemptId: task.attemptId,
      resumable: isReusablePartialEvidence(partial),
      progress: taskProgressForPartial(task, partial)
    });
    return paused.accepted ? paused.task : task;
  }
  return task;
}

function beginManagedDownloadAttempt(
  productId,
  plan,
  target,
  reusable,
  options = {}
) {
  let task = reconcileManagedDownloadTask(productId);
  const desktopDownloadOnly = plan.downloadPolicy === "desktop-download-only";
  const attemptId = options.attemptId || crypto.randomUUID();
  const partialStartMode = classifyPartialForStart(reusable);
  const downloadRoot =
    reusable?.downloadRoot || canonicalDownloadRoot(target);
  const canonicalTarget = path.join(downloadRoot, path.basename(target));
  const transition = options.queuedAttempt
    ? advanceManagedDownloadTask(productId, {
        type: "begin",
        attemptId
      })
    : task
    ? advanceManagedDownloadTask(productId, {
        type: "retry",
        attemptId
      })
    : advanceManagedDownloadTask(productId, {
        type: "start",
        attemptId,
        progress: reusable
          ? taskProgressForPartial(null, reusable)
          : undefined
      });
  if (!transition.accepted || !transition.task) {
    return { ok: false, error: "当前下载任务状态不允许重新开始", task };
  }
  task = transition.task;

  const partialRecords = readPartialDownloadRecords();
  partialRecords[productId] = {
    productId,
    attemptId,
    url: plan.url,
    fileName: plan.fileName,
    artifactKind: plan.artifactKind,
    downloadPolicy: plan.downloadPolicy || "",
    signedCatalogDownload: plan.signedCatalogDownload === true,
    mirrors: plan.signedCatalogDownload
      ? plan.sources.slice(1).map((source) => source.url)
      : undefined,
    downloadRoot,
    targetPath: canonicalTarget,
    totalBytes: reusable?.totalBytes || 0,
    updatedAt: new Date().toISOString()
  };
  writePartialDownloadRecords(partialRecords);

  const controller = options.controller || new AbortController();
  const entry = {
    attemptId,
    controller,
    intent: "download",
    completion: null,
    replacement: options.replacement || null
  };
  activeDownloads.set(productId, entry);

  const taskSender = {
    send(channel, progress) {
      if (channel === "download:progress") {
        recordManagedDownloadProgress(productId, attemptId, progress);
      }
    }
  };

  const completionWork = (async () => {
    let completedResult = null;
    let committedRecord = null;
    try {
      const result = await downloadPackage(
        taskSender,
        {
          productId,
          url: plan.url,
          managedProductId: desktopDownloadOnly
            ? undefined
            : plan.managedProductId || undefined,
          allowedFinalHosts: desktopDownloadOnly || plan.environmentId
            ? plan.allowedHosts
            : undefined
        },
        canonicalTarget,
        {
          controller,
          resumeAllowed: true,
          keepPartial: true,
          completePartialBytes:
            partialStartMode === "promote"
              ? reusable.totalBytes
              : undefined,
          isCurrentAttempt: () =>
            isCurrentDownloadAttempt(
              activeDownloads.get(productId),
              attemptId
            ),
          safetyReserveBytes: plan.safetyReserveBytes,
          installDiskBytes: plan.installDiskBytes,
          onMetadata: ({ receivedBytes, totalBytes }) => {
            const records = readPartialDownloadRecords();
            const receipt = records[productId];
            if (
              !receipt ||
              receipt.attemptId !== attemptId ||
              receipt.downloadRoot !== downloadRoot ||
              receipt.targetPath !== canonicalTarget
            ) {
              return;
            }
            records[productId] = {
              ...receipt,
              totalBytes,
              updatedAt: new Date().toISOString()
            };
            writePartialDownloadRecords(records);
            recordManagedDownloadProgress(productId, attemptId, {
              receivedBytes,
              totalBytes,
              bytesPerSecond: 0,
              etaSeconds: null,
              percent: totalBytes
                ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
                : null
            });
          }
        }
      );
      completedResult = result;
      if (plan.environmentId) {
        const environmentPlan = getEnvironmentPlan(plan.environmentId);
        const signature = await inspectSignature(result.filePath);
        environmentPlan.installedSigner.lastIndex = 0;
        if (
          signature.status !== "Valid" ||
          !environmentPlan.installedSigner.test(signature.signer)
        ) {
          const error = new Error(
            `${environmentPlan.name} 安装包数字签名校验未通过（状态：${signature.status}；发布者：${signature.signer || "未知"}）`
          );
          error.code = "ENVIRONMENT_SIGNATURE_INVALID";
          throw error;
        }
      }
      assertDownloadCanFinalize({
        receivedBytes: result.fileSize,
        totalBytes: result.fileSize,
        isCurrentAttempt: () =>
          isCurrentDownloadAttempt(
            activeDownloads.get(productId),
            attemptId
          )
      });
      const records = readDownloadRecords();
      const record = {
        productId,
        filePath: result.filePath,
        downloadRoot,
        sha256: result.sha256,
        fileSize: result.fileSize,
        resumedFrom: result.resumedFrom,
        downloadedAt: new Date().toISOString(),
        url: plan.url,
        fileName: plan.fileName,
        artifactKind: plan.artifactKind,
        downloadPolicy: plan.downloadPolicy || "",
        signedCatalogDownload: plan.signedCatalogDownload === true,
        mirrors: plan.signedCatalogDownload
          ? plan.sources.slice(1).map((source) => source.url)
          : undefined,
        source: plan.sourceLabel || ""
      };
      if (entry.replacement) {
        const replacement = await commitManagedDownloadReplacement({
          productId,
          currentRecords: records,
          expectedPreviousRecord: entry.replacement.expectedPreviousRecord,
          trustedPreviousRecord: entry.replacement.trustedPreviousRecord,
          nextRecord: record,
          expectedFileName: plan.fileName,
          writeRecords: writeDownloadRecords,
          cleanupPrevious: (previousRecord, nextRecord) =>
            cleanupReplacedManagedDownloadFile(
              previousRecord,
              nextRecord,
              plan
            )
        });
        committedRecord = replacement.record;
        if (!replacement.cleanup.ok) {
          console.error(
            "Unable to clean the replaced managed installer",
            replacement.cleanup.error
          );
        }
      } else {
        records[productId] = record;
        writeDownloadRecords(records);
        committedRecord = record;
      }
      try {
        removePartialDownloadRecord(productId);
      } catch {
        // The completed record is the commit point; stale receipt cleanup is best effort.
      }
      return advanceManagedDownloadCompleted(
        productId,
        attemptId,
        record
      );
    } catch (error) {
      if (committedRecord) {
        try {
          return advanceManagedDownloadCompleted(
            productId,
            attemptId,
            committedRecord
          );
        } catch {
          return currentManagedDownloadTask(productId);
        }
      }
      const active = activeDownloads.get(productId);
      const intent =
        active?.attemptId === attemptId ? active.intent : entry.intent;
      const rollback = rollbackUncommittedManagedArtifact(
        productId,
        plan,
        completedResult?.filePath,
        intent,
        attemptId
      );
      if (intent === "cancel") {
        if (!rollback.ok) {
          return failManagedDownloadCancellation(
            productId,
            currentManagedDownloadTask(productId),
            rollback
          );
        }
        const cleanup = discardManagedPartialDownload(productId, plan);
        if (!cleanup.ok) {
          return failManagedDownloadCancellation(
            productId,
            currentManagedDownloadTask(productId),
            cleanup
          );
        }
        const canceled = advanceManagedDownloadTask(productId, {
          type: "cancel",
          attemptId
        });
        return canceled.task;
      }
      if (!rollback.ok) {
        const failed = advanceManagedDownloadTask(productId, {
          type: "failed",
          attemptId,
          resumable: false,
          errorCode: rollback.errorCode || "DOWNLOAD_ROLLBACK_FAILED",
          errorMessage: rollback.errorMessage,
          progress: taskProgressForPartial(
            currentManagedDownloadTask(productId),
            null
          )
        });
        return failed.task;
      }
      const partial = reusablePartialDownload(productId, plan);
      if (!partial) {
        discardManagedPartialDownload(productId, plan);
      }
      if (intent === "pause") {
        const paused = advanceManagedDownloadTask(productId, {
          type: "pause",
          attemptId,
          resumable: Boolean(partial),
          progress: taskProgressForPartial(
            currentManagedDownloadTask(productId),
            partial
          )
        });
        return paused.task;
      }
      const failure = managedDownloadFailure(error);
      const failed = advanceManagedDownloadTask(productId, {
        type: "failed",
        attemptId,
        resumable: Boolean(partial),
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        progress: taskProgressForPartial(
          currentManagedDownloadTask(productId),
          partial
        )
      });
      const fallbackPlan =
        !partial &&
        isManagedDownloadSourceFallbackError(error)
          ? nextManagedDownloadPlan(plan)
          : null;
      if (fallbackPlan && failed.accepted && failed.task) {
        const failedAttemptId = attemptId;
        setTimeout(() => {
          const current = currentManagedDownloadTask(productId);
          if (
            current?.phase === "failed" &&
            current.attemptId === failedAttemptId &&
            !activeDownloads.has(productId)
          ) {
            startManagedDownload(productId, fallbackPlan);
          }
        }, 0);
      }
      return failed.task;
    } finally {
      if (activeDownloads.get(productId)?.attemptId === attemptId) {
        activeDownloads.delete(productId);
      }
    }
  })();
  entry.completion = completionWork.catch((error) => {
    const current = currentManagedDownloadTask(productId);
    try {
      if (
        current?.attemptId === attemptId &&
        current.phase === "canceling"
      ) {
        return failManagedDownloadCancellation(productId, current, {
          ok: false,
          errorCode: "CANCEL_CLEANUP_FAILED",
          errorMessage:
            error instanceof Error
              ? `\u53d6\u6d88\u6e05\u7406\u5931\u8d25\uff1a${error.message}`
              : "\u53d6\u6d88\u6e05\u7406\u5931\u8d25",
          partial: reusablePartialDownload(productId, plan)
        });
      }
      if (
        current?.attemptId === attemptId &&
        ["starting", "downloading", "pausing"].includes(current.phase)
      ) {
        const partial = reusablePartialDownload(productId, plan);
        const failed = advanceManagedDownloadTask(productId, {
          type: "failed",
          attemptId,
          resumable: Boolean(partial),
          errorCode: "DOWNLOAD_TASK_INTERNAL_ERROR",
          errorMessage:
            error instanceof Error
              ? error.message
              : "\u4e0b\u8f7d\u4efb\u52a1\u5185\u90e8\u5931\u8d25",
          progress: taskProgressForPartial(current, partial)
        });
        return failed.accepted ? failed.task : current;
      }
    } catch {
      // Preserve the last known task instead of leaking an unhandled rejection.
    }
    return current;
  });

  return { ok: true, task, completion: entry.completion };
}

function getManagedDownloadQueue() {
  if (managedDownloadQueue) return managedDownloadQueue;
  managedDownloadQueue = createManagedDownloadQueue({
    concurrency: MANAGED_DOWNLOAD_CONCURRENCY,
    async start(job) {
      const started = beginManagedDownloadAttempt(
        job.productId,
        job.plan,
        job.target,
        job.reusable,
        {
          ...job.options,
          attemptId: job.attemptId,
          queuedAttempt: true,
          controller: job.controller
        }
      );
      if (!started.ok || !started.completion) {
        const error = new Error(started.error || "DOWNLOAD_START_FAILED");
        error.code = "DOWNLOAD_START_FAILED";
        throw error;
      }
      return started.completion;
    }
  });
  return managedDownloadQueue;
}

function hasManagedDownloadWork() {
  return activeDownloads.size > 0 || getManagedDownloadQueue().list().some((task) =>
    task.phase === "queued" || task.phase === "downloading"
  );
}

function discardManagedDownloadQueueOnExit() {
  const queuedIds = getManagedDownloadQueue().list().map((task) => task.id);
  const productIds = new Set([...queuedIds, ...activeDownloads.keys()]);
  getManagedDownloadQueue().dispose();
  for (const [productId, entry] of activeDownloads) {
    entry.intent = raiseDownloadIntent(entry.intent, "cancel");
    entry.controller.abort();
  }
  for (const productId of productIds) {
    const plan = resolveManagedDownloadPlan(productId);
    if (plan) discardManagedPartialDownload(productId, plan);
  }
}

function enqueueManagedDownloadAttempt(productId, plan, target, reusable, options = {}) {
  let task = reconcileManagedDownloadTask(productId);
  const attemptId = crypto.randomUUID();
  const transition = task
    ? advanceManagedDownloadTask(productId, {
        type: "queue",
        attemptId,
        resumable: Boolean(reusable),
        progress: reusable ? taskProgressForPartial(task, reusable) : undefined
      })
    : advanceManagedDownloadTask(productId, {
        type: "queue",
        attemptId,
        progress: reusable ? taskProgressForPartial(null, reusable) : undefined
      });
  if (!transition.accepted || !transition.task) {
    return { ok: false, error: "当前下载任务状态不允许加入队列", task };
  }
  task = transition.task;
  const queued = getManagedDownloadQueue().enqueue({
    id: productId,
    productId,
    attemptId,
    plan,
    target,
    reusable,
    options
  });
  if (!queued.accepted) {
    const failed = advanceManagedDownloadTask(productId, {
      type: "failed",
      attemptId,
      resumable: false,
      errorCode: queued.errorCode || "DOWNLOAD_QUEUE_REJECTED",
      errorMessage: "下载队列无法接收任务"
    });
    return { ok: false, error: failed.task?.errorMessage || "下载队列无法接收任务", task: failed.task || task };
  }
  return { ok: true, queued: queued.reused === true, task: reconcileManagedDownloadTask(productId) || task };
}

function startManagedDownload(productId, overridePlan = null, options = {}) {
  if (
    managedDownloadRefreshPending &&
    options.maintenanceOwner !== true
  ) {
    return {
      ok: false,
      error: "正在整理本地安装包，请稍后重试",
      task: currentManagedDownloadTask(productId)
    };
  }
  const plan = overridePlan || resolveManagedDownloadPlan(productId);
  if (!plan) {
    return { ok: false, error: "该产品不在客户端安装包白名单中" };
  }
  if (plan.downloadPolicy === "desktop-download-only" && !getDesktopDownloadOnlyProfile(productId)) {
    signedDesktopDownloadPlans.set(productId, plan);
  }
  const scheduled = getManagedDownloadQueue().status(productId);
  if (scheduled && (scheduled.phase === "queued" || scheduled.phase === "downloading")) {
    return {
      ok: true,
      reused: true,
      task: currentManagedDownloadTask(productId)
    };
  }
  ensureEnvironmentDownloadDirectory();
  const partial = managedPartialDownload(productId, plan);
  const partialStartMode = classifyPartialForStart(partial);
  if (partialStartMode === "resume" || partialStartMode === "promote") {
    return enqueueManagedDownloadAttempt(
      productId,
      plan,
      partial.targetPath,
      partial,
      options
    );
  }
  const partialRecords = readPartialDownloadRecords();
  if (Object.prototype.hasOwnProperty.call(partialRecords, productId)) {
    const cleanup = discardManagedPartialDownload(productId, plan);
    if (!cleanup.ok) {
      return {
        ok: false,
        error: cleanup.errorMessage,
        task: reconcileManagedDownloadTask(productId)
      };
    }
  }
  const target = safeDownloadTarget(plan.fileName);
  return enqueueManagedDownloadAttempt(productId, plan, target, null, options);
}

async function pauseManagedDownload(productId) {
  const entry = activeDownloads.get(productId);
  if (!entry) {
    const task = reconcileManagedDownloadTask(productId);
    return task?.phase === "paused"
      ? { ok: true, task }
      : { ok: false, error: "当前没有可暂停的下载任务", task };
  }
  const requested = advanceManagedDownloadTask(productId, {
    type: "pause-requested",
    attemptId: entry.attemptId
  });
  if (!requested.accepted) {
    return {
      ok: false,
      error:
        "\u5f53\u524d\u4e0b\u8f7d\u72b6\u6001\u4e0d\u5141\u8bb8\u6682\u505c",
      task: requested.task
    };
  }
  entry.intent = raiseDownloadIntent(entry.intent, "pause");
  entry.controller.abort();
  const task = await entry.completion;
  return { ok: task?.phase === "paused", task };
}

async function discardManagedDownload(request) {
  const confirmed = validateManagedDownloadCancelRequest(request);
  if (!confirmed) {
    return { ok: false, error: "下载取消请求无效" };
  }
  const productId = confirmed.productId;
  const plan = resolveManagedDownloadPlan(productId);
  const task = reconcileManagedDownloadTask(productId);
  const authorization = authorizeManagedDownloadCancellation({
    request: confirmed,
    task,
    plan
  });
  if (!authorization.ok) {
    return {
      ok: false,
      error:
        authorization.errorCode === "DOWNLOAD_ALREADY_COMPLETED"
          ? "下载已经完成，不能取消或删除完成文件"
          : "下载任务已变化，请刷新后重试",
      task
    };
  }
  const entry = activeDownloads.get(productId);
  const attemptId = authorization.attemptId;
  if (entry && entry.attemptId !== attemptId) {
    return { ok: false, error: "下载任务已变化，请刷新后重试", task };
  }
  const requested = advanceManagedDownloadTask(productId, {
    type: "cancel-requested",
    attemptId
  });
  if (!requested.accepted) {
    return {
      ok: false,
      error:
        "\u5f53\u524d\u4e0b\u8f7d\u72b6\u6001\u4e0d\u5141\u8bb8\u53d6\u6d88",
      task: requested.task
    };
  }
  const queued = getManagedDownloadQueue().status(productId);
  if (queued?.phase === "queued") {
    getManagedDownloadQueue().cancel(productId);
    const canceled = advanceManagedDownloadTask(productId, {
      type: "cancel",
      attemptId
    });
    if (!canceled.accepted) return { ok: false, task: canceled.task };
    try {
      removeManagedDownloadState(productId, { expectedAttemptId: attemptId });
      return { ok: true, task: null, cleared: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "下载任务删除失败",
        task: canceled.task
      };
    }
  }
  if (entry) {
    entry.intent = raiseDownloadIntent(entry.intent, "cancel");
    entry.controller.abort();
    const canceled = await entry.completion;
    const ok = canceled?.phase === "canceled";
    if (!ok) {
      return {
        ok: false,
        error:
          canceled?.phase === "completed"
            ? "\u4e0b\u8f7d\u5df2\u5b8c\u6210\uff0c\u53d6\u6d88\u672a\u751f\u6548"
            : canceled?.errorMessage || "\u53d6\u6d88\u6e05\u7406\u5931\u8d25",
        task: canceled
      };
    }
    try {
      removeManagedDownloadState(productId, {
        expectedAttemptId: attemptId
      });
      return { ok: true, task: null, cleared: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "下载任务删除失败",
        task: canceled
      };
    }
  }
  const cleanup = discardManagedPartialDownload(productId, plan);
  if (!cleanup.ok) {
    const failed = failManagedDownloadCancellation(
      productId,
      requested.task,
      cleanup
    );
    return { ok: false, error: failed.errorMessage, task: failed };
  }
  const canceled = advanceManagedDownloadTask(productId, {
    type: "cancel",
    attemptId
  });
  if (!canceled.accepted) return { ok: false, task: canceled.task };
  try {
    removeManagedDownloadState(productId, { expectedAttemptId: attemptId });
    return { ok: true, task: null, cleared: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "下载任务删除失败",
      task: canceled.task
    };
  }
}

function ensureEnvironmentDownloadDirectory() {
  const settings = readSettings();
  if (
    typeof settings.downloadDirectory === "string" &&
    path.isAbsolute(settings.downloadDirectory)
  ) {
    return settings.downloadDirectory;
  }
  const downloadDirectory = path.join(
    app.getPath("downloads"),
    BRAND.legacyManagedDirectoryName
  );
  fs.mkdirSync(downloadDirectory, { recursive: true });
  writeSettings({ ...settings, downloadDirectory });
  return downloadDirectory;
}

async function probeEnvironmentSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const { response } = await fetchReviewedDownload({
      url: source.url,
      options: {
        method: "GET",
        headers: {
          Range: "bytes=0-0",
          "User-Agent": DOWNLOAD_USER_AGENT
        },
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal
      },
      isAllowedFinalUrl: (candidate) => {
        try {
          const finalUrl = new URL(candidate);
          return (
            finalUrl.protocol === "https:" &&
            source.allowedHosts.includes(finalUrl.hostname)
          );
        } catch {
          return false;
        }
      }
    });
    const reachable = [200, 206].includes(response.status);
    response.body?.cancel().catch(() => {});
    return reachable;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifiedEnvironmentRecord(environmentId) {
  const plan = getEnvironmentPlan(environmentId);
  const managedRecord = trustedCompletedDownloadRecord(
    `environment:${environmentId}`
  );
  const legacyRecord = readEnvironmentDownloadRecords()[environmentId];
  const record = managedRecord
    ? {
        ...managedRecord,
        source: managedRecord.source || "可信下载源"
      }
    : legacyRecord;
  if (
    !plan ||
    !record ||
    typeof record.filePath !== "string" ||
    !path.isAbsolute(record.filePath) ||
    !fs.existsSync(record.filePath)
  ) {
    return null;
  }
  const digest = await fileSha256(record.filePath);
  if (digest !== record.sha256) return null;
  const signature = await inspectSignature(record.filePath);
  if (
    signature.status !== "Valid" ||
    !plan.installedSigner.test(signature.signer)
  ) {
    return null;
  }
  return { ...record, signature };
}

async function prepareEnvironmentPackageDownload(environmentId, intent) {
  const environmentPlan = getEnvironmentPlan(environmentId);
  if (!environmentPlan || environmentPlan.nativeWindowsFeature) {
    return { downloaded: false, error: "该环境不使用受管安装包" };
  }
  const operationTask = getEnvironmentOperationController().get(environmentId);
  if (operationTask) {
    return {
      downloaded: false,
      busy: true,
      operationTask,
      error: "该环境仍有待确认的安装或卸载操作"
    };
  }
  const entryKey = `environment:${environmentId}`;
  if (
    activeEnvironmentDownloads.has(environmentId) ||
    activeDesktopOperationEntries.has(entryKey)
  ) {
    return { downloaded: false, busy: true, error: "该环境操作正在进行" };
  }
  activeEnvironmentDownloads.add(environmentId);
  activeDesktopOperationEntries.add(entryKey);
  try {
    const downloadPlan = getEnvironmentDownloadPlan(
      environmentId,
      activeEnvironmentSourcePreferences
    );
    if (intent === "update") {
      assertSoftwareUpdatePublished({
        kind: "environment",
        subjectId: environmentId,
        mode: "environment-download",
        version: downloadPlan.recommendedVersion
      });
    }
    const updatePlan =
      intent === "update"
        ? createEnvironmentUpdatePlan({
            environmentId,
            statuses: await detectEnvironmentUpdateStatuses(environmentId),
            downloadPlan
          })
        : null;
    if (intent === "update" && !updatePlan) {
      return {
        downloaded: false,
        error: "仅可信旧版本可以下载审核推荐版本的更新包"
      };
    }
    const existing = await verifiedEnvironmentRecord(environmentId);
    if (existing) {
      return {
        downloaded: true,
        intent,
        recommendedVersion: downloadPlan.recommendedVersion,
        filePath: existing.filePath,
        source: existing.source,
        message:
          intent === "update"
            ? `${environmentPlan.name} 更新包已验证，可以点击“打开更新安装包”`
            : `${environmentPlan.name} 安装包已下载，可以点击“打开安装包”`
      };
    }

    const currentTask = reconcileManagedDownloadTask(entryKey);
    const persistedPlan = resolveManagedDownloadPlan(entryKey);
    const partial = persistedPlan
      ? managedPartialDownload(entryKey, persistedPlan)
      : null;
    let selectedPlan = persistedPlan;
    if (!partial && !activeDownloads.has(entryKey)) {
      const source = await selectReachableSource(
        downloadPlan,
        probeEnvironmentSource
      );
      selectedPlan = resolveManagedDownloadPlan(entryKey, source.url);
    }
    if (!selectedPlan) {
      throw new Error("环境安装包下载源记录无效，无法安全继续");
    }
    const started = startManagedDownload(entryKey, selectedPlan);
    if (!started.ok) {
      return {
        downloaded: false,
        intent,
        busy: activeDownloads.has(entryKey),
        task: started.task || currentTask,
        error: started.error
      };
    }
    return {
      downloaded: false,
      intent,
      recommendedVersion: downloadPlan.recommendedVersion,
      task: started.task,
      source: selectedPlan.sourceLabel,
      message:
        partial?.receivedBytes > 0
          ? `正在从断点继续下载 ${environmentPlan.name}`
          : `已选择${selectedPlan.sourceLabel}，正在下载 ${environmentPlan.name}`
    };
  } catch (error) {
    return {
      downloaded: false,
      intent,
      error:
        error instanceof Error
          ? error.message
          : `无法下载 ${environmentPlan.name} 安装包`
    };
  } finally {
    activeEnvironmentDownloads.delete(environmentId);
    activeDesktopOperationEntries.delete(entryKey);
  }
}

async function inspectCompletedDownloadRecord(productId) {
  const environmentId = environmentIdFromManagedDownload(productId);
  if (environmentId) {
    const record = await verifiedEnvironmentRecord(environmentId);
    return record
      ? {
          ok: true,
          record,
          sha256: record.sha256,
          signature: record.signature
        }
      : {
          ok: false,
          error: "安装包不存在、已被修改或数字签名无效，请重新下载"
        };
  }

  const record = trustedCompletedDownloadRecord(productId);
  return record
    ? { ok: true, record }
    : { ok: false, error: "未找到已下载的安装包" };
}

function ensureOwnedPortableDirectory(directory, parent = "") {
  const resolved = path.resolve(directory);
  const resolvedParent = parent ? path.resolve(parent) : "";
  if (resolvedParent) {
    const relative = path.relative(resolvedParent, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("便携程序目录越过客户端管理范围");
    }
  }

  const root = path.parse(resolved).root;
  let current = root;
  for (const segment of resolved.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) {
      fs.mkdirSync(current, { recursive: false });
    }
    const stat = fs.lstatSync(current);
    const canonical = fs.realpathSync.native(current);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      path.resolve(canonical).toLowerCase() !== path.resolve(current).toLowerCase()
    ) {
      throw new Error("便携程序目录不可信");
    }
  }
  return fs.realpathSync.native(resolved);
}

async function closeManagedPortableExecutable(executable) {
  let canonical;
  try {
    canonical = fs.realpathSync.native(executable);
    const stat = fs.lstatSync(canonical);
    if (
      !path.isAbsolute(canonical) ||
      !stat.isFile() ||
      stat.isSymbolicLink()
    ) {
      return { ok: false, error: "便携程序路径不可信" };
    }
  } catch {
    return { ok: false, error: "便携程序文件不存在" };
  }
  const script = [
    POWERSHELL_UTF8_OUTPUT,
    "$target=[IO.Path]::GetFullPath($env:AIHUB_PORTABLE_PROCESS_PATH)",
    "$name=[IO.Path]::GetFileName($target)",
    "$matched=@()",
    "$unknown=0",
    "$rows=@(Get-CimInstance Win32_Process -ErrorAction Stop|Where-Object{$_.Name -ieq $name})",
    "foreach($row in $rows){$candidate=[string]$row.ExecutablePath;if(-not $candidate){$unknown++;continue};if([IO.Path]::GetFullPath($candidate) -ieq $target){$matched+=[int]$row.ProcessId}}",
    "if($unknown -gt 0){throw 'PROCESS_PATH_UNAVAILABLE'}",
    "foreach($pidValue in $matched){Stop-Process -Id $pidValue -Force -ErrorAction Stop}",
    "[pscustomobject]@{closed=$matched.Count}|ConvertTo-Json -Compress"
  ].join(";");
  try {
    const { stdout } = await execFileAsync(
      windowsPowerShellPath(),
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        timeout: 15_000,
        env: {
          ...isolatedThirdPartyEnvironment(),
          AIHUB_PORTABLE_PROCESS_PATH: canonical
        }
      }
    );
    const result = JSON.parse(stdout.trim() || "{}");
    return {
      ok: true,
      closed: Number.isSafeInteger(result.closed) ? result.closed : 0
    };
  } catch {
    return {
      ok: false,
      error: "无法确认同名进程的实际路径，已停止操作"
    };
  }
}

async function verifyPortableExecutableTrust(executable, trust) {
  if (trust?.signaturePolicy === "signed") {
    return verifyExpectedSignature(
      executable,
      trust.expectedExecutableSigner,
      true
    );
  }
  if (trust?.signaturePolicy !== "pinned-unsigned") {
    return { ok: false, signer: "", status: "PolicyInvalid" };
  }
  const signature = await inspectSignature(executable);
  return signature.status === "NotSigned"
    ? {
        ok: true,
        signer: "官方未签名文件（客户端已固定 SHA-256）",
        status: signature.status
      }
    : { ok: false, signer: signature.signer || "", status: signature.status };
}

async function uninstallPortableDesktopProduct(productId) {
  const download = getStaticManagedDownload(productId);
  const portable = portableDesktopPlan(download);
  if (!portable) {
    return { launched: false, error: "该产品不是客户端管理的便携程序" };
  }
  const localAppData = process.env.LOCALAPPDATA || "";
  const receipt = readPortableDesktopRecord(productId);
  const action = createPortableDesktopUninstallAction({
    productId,
    download,
    receipt,
    localAppData,
    hashFile: fileIntegritySync
  });
  if (!action) {
    return {
      launched: false,
      error: "未找到与枕星AI助手 安装收据一致的便携程序"
    };
  }
  const trust = portableDesktopTrustForReceipt(download, receipt);
  if (!trust) {
    return { launched: false, error: "便携程序版本不在客户端批准的卸载范围内" };
  }
  const signature = await verifyPortableExecutableTrust(
    action.executable,
    trust
  );
  if (!signature.ok) {
    return { launched: false, error: "便携程序签名发生变化，已拒绝卸载" };
  }

  const adapter = getDesktopAdapterForProduct(productId);
  const confirmation = await showDesktopUninstallConfirmation({
    productId,
    mode: "automatic",
    language: readSettings().language,
    surface: "managed-portable-runtime",
    productName: adapter?.names?.[0] || productId,
    version: action.version,
    publisher: signature.signer,
    installLocation: action.directory,
    executableName: path.basename(action.executable),
    signer: signature.signer
  });
  if (confirmation.response !== 1) {
    return { launched: false, canceled: true };
  }

  const latestReceipt = readPortableDesktopRecord(productId);
  const confirmed = createPortableDesktopUninstallAction({
    productId,
    download,
    receipt: latestReceipt,
    localAppData,
    hashFile: fileIntegritySync
  });
  if (!confirmed || confirmed.managementId !== action.managementId) {
    return {
      launched: false,
      error: "确认期间便携程序状态发生变化，已拒绝卸载"
    };
  }
  const finalTrust = portableDesktopTrustForReceipt(
    download,
    latestReceipt
  );
  if (!finalTrust) {
    return { launched: false, error: "确认期间便携程序版本发生变化" };
  }
  const finalSignature = await verifyPortableExecutableTrust(
    confirmed.executable,
    finalTrust
  );
  if (!finalSignature.ok) {
    return { launched: false, error: "确认期间便携程序签名发生变化" };
  }

  const closeResult = await closeManagedPortableExecutable(
    confirmed.executable
  );
  if (!closeResult.ok) {
    return { launched: false, error: closeResult.error || "无法关闭便携程序" };
  }

  const operationController = getDesktopOperationController();
  let operationTask = operationController.begin(productId, "uninstall");
  try {
    let cleanupWarning = "";
    try {
      const transaction = {
        removeReceipt: () => removePortableDesktopRecordStrict(productId),
        restoreReceipt: () => setPortableDesktopRecord(productId, latestReceipt)
      };
      if (portable.kind === "zip-directory") {
        await uninstallManagedPortableDirectory({
          runtimeRoot: confirmed.runtimeRoot,
          ...transaction
        });
      } else {
        await uninstallManagedPortableFiles({
          directory: confirmed.directory,
          executableFileName: portable.executableRelativePath,
          ...transaction
        });
      }
    } catch (error) {
      if (!error?.committed) throw error;
      cleanupWarning =
        "程序已经卸载，但临时删除文件将在下次维护时继续清理";
    }
    operationTask = operationController.finishLaunch(
      productId,
      operationTask.generation,
      operationTask.operationId,
      true
    );
    operationTask = await operationController.checkNow(
      productId,
      operationTask.generation,
      operationTask.operationId
    );
    return {
      launched: true,
      operationTask,
      uninstallMode: "automatic",
      message: "正在自动卸载",
      ...(cleanupWarning ? { warning: cleanupWarning } : {})
    };
  } catch (error) {
    try {
      operationController.finishLaunch(
        productId,
        operationTask.generation,
        operationTask.operationId,
        false
      );
    } catch {
      // Preserve the exact managed runtime failure below.
    }
    return {
      launched: false,
      operationTask: operationController.get(productId),
      error:
        error instanceof Error
          ? `便携程序卸载失败：${error.message}`
          : "便携程序卸载失败"
    };
  }
}

function removeTrustedCompletedPackage(productId, record) {
  if (!record || record.productId !== productId) {
    return { ok: false, error: "安装包记录无效，已拒绝删除" };
  }
  try {
    const task = reconcileManagedDownloadTask(productId);
    if (
      !task ||
      task.phase !== "completed" ||
      task.productId !== productId ||
      task.filePath !== record.filePath ||
      task.sha256 !== record.sha256 ||
      task.fileSize !== record.fileSize
    ) {
      return { ok: false, error: "安装包任务与记录不一致，已拒绝删除" };
    }
    const stat = fs.lstatSync(record.filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { ok: false, error: "安装包文件类型发生变化，已拒绝删除" };
    }
    const records = readDownloadRecords();
    if (!recordsMatch(records[productId] || null, record)) {
      return { ok: false, error: "安装包记录已发生变化，请刷新后重试" };
    }
    const canceledCleanup = cancelSupersededPackageCleanupForProduct(
      records,
      productId
    );
    const nextRecords = canceledCleanup.records;
    delete nextRecords[productId];
    fs.unlinkSync(record.filePath);
    if (fs.existsSync(record.filePath)) {
      throw new Error("安装包文件删除后仍然存在");
    }
    writeDownloadRecords(nextRecords);
    loadManagedDownloadTasks();
    managedDownloadTasks.delete(productId);
    writeManagedDownloadTasks();
    const environmentId = environmentIdFromManagedDownload(productId);
    if (environmentId) {
      const legacyRecords = readEnvironmentDownloadRecords();
      delete legacyRecords[environmentId];
      writeEnvironmentDownloadRecords(legacyRecords);
    }
    downloadTaskLastPersistedAt.delete(productId);
    downloadTaskLastEmittedAt.delete(productId);
    return { ok: true, filePath: record.filePath };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `无法删除安装包：${error.message}`
          : "无法删除安装包"
    };
  }
}

async function cleanupReplacedManagedDownloadFile(
  previousRecord,
  nextRecord,
  plan
) {
  if (
    !previousRecord ||
    (nextRecord && previousRecord.productId !== nextRecord.productId) ||
    typeof previousRecord.filePath !== "string" ||
    !path.isAbsolute(previousRecord.filePath) ||
    typeof previousRecord.downloadRoot !== "string" ||
    !path.isAbsolute(previousRecord.downloadRoot) ||
    typeof previousRecord.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(previousRecord.sha256) ||
    !Number.isSafeInteger(previousRecord.fileSize) ||
    previousRecord.fileSize < 0 ||
    !plan ||
    !hasExpectedManagedDownloadName(previousRecord.filePath, plan.fileName)
  ) {
    return { ok: false, error: "Replaced package record is not safe to clean" };
  }

  const oldPath = path.resolve(previousRecord.filePath);
  const newPath =
    nextRecord && typeof nextRecord.filePath === "string"
      ? path.resolve(nextRecord.filePath)
      : "";
  const root = path.resolve(previousRecord.downloadRoot);
  if (newPath && oldPath.toLowerCase() === newPath.toLowerCase()) {
    return { ok: true, skipped: true };
  }
  if (
    path.dirname(oldPath).toLowerCase() !== root.toLowerCase() ||
    path.isAbsolute(path.relative(root, oldPath)) ||
    path.relative(root, oldPath).startsWith("..")
  ) {
    return { ok: false, error: "Replaced package escaped its recorded root" };
  }

  try {
    if (!fs.existsSync(oldPath)) return { ok: true, missing: true };
    const stat = fs.lstatSync(oldPath);
    const canonicalRoot = fs.realpathSync.native(root);
    const canonicalFile = fs.realpathSync.native(oldPath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size !== previousRecord.fileSize ||
      canonicalRoot.toLowerCase() !== root.toLowerCase() ||
      path.dirname(canonicalFile).toLowerCase() !==
        canonicalRoot.toLowerCase()
    ) {
      return { ok: false, error: "Replaced package changed before cleanup" };
    }
    const digest = await fileSha256(canonicalFile);
    if (digest.toLowerCase() !== previousRecord.sha256.toLowerCase()) {
      return { ok: false, error: "Replaced package hash changed before cleanup" };
    }
    fs.unlinkSync(canonicalFile);
    if (fs.existsSync(canonicalFile)) {
      return { ok: false, error: "Replaced package still exists after cleanup" };
    }
    return { ok: true, filePath: canonicalFile };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to clean the replaced package"
    };
  }
}

async function retryPersistedSupersededPackageCleanup(productId = null) {
  const currentRecords = readDownloadRecords();
  try {
    return await retrySupersededPackageCleanup({
      currentRecords,
      productId,
      expectedFileNameForProduct: (candidateProductId) => {
        const candidatePlan = resolveManagedDownloadPlan(candidateProductId);
        return candidatePlan && !candidatePlan.environmentId
          ? candidatePlan.fileName
          : null;
      },
      cleanupReceipt: (receipt, currentRecord) => {
        const candidatePlan = resolveManagedDownloadPlan(receipt.productId);
        return cleanupReplacedManagedDownloadFile(
          receipt,
          currentRecord,
          candidatePlan
        );
      },
      writeRecords: writeDownloadRecords
    });
  } catch (error) {
    return {
      records: currentRecords,
      cleanup: {
        ok: false,
        attemptedCount: 0,
        cleanedCount: 0,
        pendingCount: null,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retry superseded installer cleanup"
      }
    };
  }
}

function startFreshManagedDownloadAfterAdmission(productId, plan) {
  const partialCleanup = discardManagedPartialDownload(productId, plan);
  if (!partialCleanup.ok) {
    return {
      ok: false,
      error: partialCleanup.errorMessage || "无法清理旧下载断点"
    };
  }
  const records = readDownloadRecords();
  const expectedPreviousRecord = records[productId] || null;
  const trustedPreviousRecord = trustedCompletedDownloadRecord(productId);
  return startManagedDownload(productId, plan, {
    maintenanceOwner: true,
    replacement: {
      expectedPreviousRecord,
      trustedPreviousRecord
    }
  });
}

async function startFreshManagedDownload(productId) {
  const plan = resolveManagedDownloadPlan(productId);
  if (!plan || plan.environmentId) {
    return { ok: false, error: "该产品不支持获取最新版安装包" };
  }
  const catalogAuthorization =
    await authorizeCurrentCatalogProduct(productId);
  if (!catalogAuthorization.ok) {
    return catalogAuthorization;
  }
  if (managedDownloadRefreshPending) {
    return {
      ok: false,
      error: "正在整理旧安装包，请稍后重试",
      task: currentManagedDownloadTask(productId)
    };
  }
  const admission = runWhenManagedDownloadSlotAvailable(
    {
      productId,
      activeProductIds: [...activeDownloads.keys()]
    },
    () => true
  );
  if (!admission.executed) {
    return admission.reason === "same-product-active"
      ? {
          ok: false,
          error: "下载仍在进行，无需重复获取最新版",
          task: currentManagedDownloadTask(productId)
        }
      : {
          ok: false,
          error: "已有安装包正在下载，请暂停或完成后再获取最新版",
          task: currentManagedDownloadTask(productId)
        };
  }

  managedDownloadRefreshPending = true;
  try {
    const retried = await retryPersistedSupersededPackageCleanup();
    const records = retried.records;
    const trustedPreviousRecord = trustedCompletedDownloadRecord(productId);
    if (trustedPreviousRecord) {
      let capacity;
      try {
        capacity = managedDownloadCleanupCapacity(records);
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? `旧安装包清理记录无效：${error.message}`
              : "旧安装包清理记录无效"
        };
      }
      if (!capacity.canQueue) {
        return {
          ok: false,
          error: "旧安装包仍被占用，请关闭相关程序后重试"
        };
      }
    }
    if (hasManagedDownloadWork()) {
      return {
        ok: false,
        error: "已有安装包正在下载，请完成后再获取最新版",
        task: currentManagedDownloadTask(productId)
      };
    }
    const authorizedStart = await runFreshCatalogAuthorizedOperation({
      productId,
      authorize: authorizeCurrentCatalogProduct,
      operation: () => startFreshManagedDownloadAfterAdmission(productId, plan)
    });
    return authorizedStart.authorized
      ? authorizedStart.value
      : authorizedStart.authorization;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "无法获取最新版安装包"
    };
  } finally {
    managedDownloadRefreshPending = false;
  }
}

function validManagedDownloadQueueArtifact(artifact) {
  if (artifact === undefined) return true;
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return false;
  const prototype = Object.getPrototypeOf(artifact);
  if (prototype !== null && prototype !== Object.prototype) return false;
  const fields = Object.keys(artifact);
  if (!fields.every((field) => ["url", "fileName", "artifactKind", "mirrors"].includes(field))) return false;
  if (typeof artifact.url !== "string" || typeof artifact.fileName !== "string" ||
      artifact.url.length > 2048 || artifact.fileName.length > 256 ||
      /[\\\\/]/.test(artifact.fileName)) return false;
  try {
    const parsed = new URL(artifact.url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) return false;
  } catch {
    return false;
  }
  if (artifact.artifactKind !== undefined && !["exe", "msi", "msix", "zip"].includes(artifact.artifactKind)) return false;
  return artifact.mirrors === undefined ||
    (Array.isArray(artifact.mirrors) && artifact.mirrors.length <= 4 && artifact.mirrors.every((value) => {
      try {
        const parsed = new URL(value);
        return typeof value === "string" && value.length <= 2048 &&
          parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.hash;
      } catch {
        return false;
      }
    }));
}

function validManagedDownloadQueueRequest(request, allowArtifact = true) {
  if (!request || typeof request !== "object" || Array.isArray(request)) return false;
  const prototype = Object.getPrototypeOf(request);
  if (prototype !== null && prototype !== Object.prototype) return false;
  const allowed = allowArtifact ? ["productId", "artifact"] : ["productId"];
  const fields = Object.keys(request);
  return fields.length >= 1 && fields.every((field) => allowed.includes(field)) &&
    Object.hasOwn(request, "productId") && typeof request.productId === "string" &&
    request.productId.length > 0 && request.productId.length <= 160 &&
    (!Object.hasOwn(request, "artifact") || validManagedDownloadQueueArtifact(request.artifact));
}

function validManagedPackageDiscoveryCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length > 128) return false;
  const productIds = new Set();
  return candidates.every((candidate) => {
    if (!validManagedDownloadQueueRequest(candidate)) return false;
    if (productIds.has(candidate.productId)) return false;
    productIds.add(candidate.productId);
    return true;
  });
}

function managedPackageDiscoveryPlan(candidate) {
  let plan = resolveManagedDownloadPlan(
    candidate.productId,
    "",
    candidate.artifact
  );
  if (!plan && candidate.artifact) {
    plan = getDesktopDownloadOnlyProfile(candidate.productId)
      ? buildDesktopDownloadOnlyPlan(candidate.productId, candidate.artifact)
      : buildSignedDesktopDownloadPlan(candidate.productId, candidate.artifact);
  }
  return reviewedManagedPackagePlan(candidate.productId, plan);
}

async function discoverDownloadedPackages(candidates) {
  if (!validManagedPackageDiscoveryCandidates(candidates)) return [];
  if (managedPackageDiscoveryInFlight) return managedPackageDiscoveryInFlight;
  managedPackageDiscoveryInFlight = (async () => {
    if (managedDownloadRefreshPending || hasManagedDownloadWork()) {
      return listManagedDownloadQueueTasks();
    }
    managedDownloadRefreshPending = true;
    try {
      const downloadRoot = readSettings().downloadDirectory;
      if (
        typeof downloadRoot !== "string" ||
        !path.isAbsolute(downloadRoot) ||
        !fs.existsSync(downloadRoot)
      ) {
        return listManagedDownloadQueueTasks();
      }
      const plans = [];
      for (const candidate of candidates) {
        const existingTask = reconcileManagedDownloadTask(candidate.productId);
        if (existingTask?.phase === "completed") continue;
        const plan = managedPackageDiscoveryPlan(candidate);
        if (plan) plans.push(plan);
      }
      const discovered = await discoverManagedPackages({
        downloadRoot,
        plans,
        inspectSignature,
        hashFile: fileSha256
      });
      if (discovered.length > 0) {
        const records = readDownloadRecords();
        for (const record of discovered) records[record.productId] = record;
        writeDownloadRecords(records);
        for (const record of discovered) reconcileManagedDownloadTask(record.productId);
      }
      return listManagedDownloadQueueTasks();
    } catch {
      return listManagedDownloadQueueTasks();
    } finally {
      managedDownloadRefreshPending = false;
    }
  })();
  try {
    return await managedPackageDiscoveryInFlight;
  } finally {
    managedPackageDiscoveryInFlight = null;
  }
}

function managedDownloadTaskProfileId(task) {
  if (!task || typeof task !== "object") return "";
  const profile = getDesktopDownloadOnlyProfile(task.productId) || getInstallRegistration(task.productId);
  const plan = resolveManagedDownloadPlan(task.productId);
  return typeof profile?.profileId === "string"
    ? profile.profileId
    : plan?.downloadPolicy === "desktop-download-only"
      ? SIGNED_CATALOG_PROFILE_ID
      : "";
}

function listManagedDownloadQueueTasks() {
  loadManagedDownloadTasks();
  return [...managedDownloadTasks.values()]
    .map((task) => projectManagedDownloadTask(task, {
      profileId: managedDownloadTaskProfileId(task)
    }))
    .filter(Boolean);
}

function publicManagedDownloadQueueResult(result, productId = "") {
  const task = result?.task && projectManagedDownloadTask(result.task, {
    profileId: managedDownloadTaskProfileId(result.task)
  });
  const current = !task && result?.ok !== true && productId
    ? reconcileManagedDownloadTask(productId)
    : null;
  return {
    ok: result?.ok === true,
    ...(result?.reused === true || result?.queued === true ? { reused: true } : {}),
    ...(task
      ? { task }
      : current
        ? { task: projectManagedDownloadTask(current, {
          profileId: managedDownloadTaskProfileId(current)
        }) }
        : {}),
    ...(result?.ok === true ? {} : { errorCode: "DOWNLOAD_QUEUE_REJECTED" })
  };
}

async function startManagedDownloadFromRequest(productId, artifact) {
  if (typeof productId !== "string" || !validManagedDownloadQueueArtifact(artifact)) {
    return { ok: false, error: "下载请求无效" };
  }
  let plan = resolveManagedDownloadPlan(productId, "", artifact);
  let catalogAuthorization = null;
  if (!plan) {
    catalogAuthorization = await authorizeCurrentDesktopDownloadOnlyProduct(productId, artifact);
    if (!catalogAuthorization.ok) return catalogAuthorization;
    plan = catalogAuthorization.plan;
  }
  if (!plan) return { ok: false, error: "该产品不支持官方安装包下载" };
  if (!plan.environmentId) {
    catalogAuthorization ||= plan.downloadPolicy === "desktop-download-only"
      ? await authorizeCurrentDesktopDownloadOnlyProduct(productId, artifact)
      : await authorizeCurrentCatalogProduct(productId);
    if (!catalogAuthorization.ok) return catalogAuthorization;
    if (plan.downloadPolicy === "desktop-download-only") plan = catalogAuthorization.plan;
  }
  return startManagedDownload(productId, plan);
}

async function clearCompletedDownloadHistory(productId, confirm = true) {
  if (!resolveManagedDownloadPlan(productId)) {
    return { ok: false, error: "该产品不在客户端安装包白名单中" };
  }
  if (activeDownloads.has(productId)) {
    return { ok: false, error: "下载仍在进行，不能清除完成记录" };
  }
  const task = reconcileManagedDownloadTask(productId);
  if (!task || task.phase !== "completed") {
    return { ok: false, error: "没有可清除的已完成下载记录", task };
  }

  const records = readDownloadRecords();
  const record = records[productId];
  if (confirm) {
    const confirmation = await showLocalizedMessageBox({
      type: "question",
      title: "清除下载记录",
      message: `确认从${BRAND.name}下载任务中清除这条完成记录？`,
      detail:
        "只清除任务和验证记录，不会删除电脑上的安装包文件。之后如需再次安装，请从原文件位置打开或重新下载。",
      buttons: ["保留记录", "清除记录"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) {
      return { ok: false, canceled: true, task };
    }
  }

  loadManagedDownloadTasks();
  const previousTask = managedDownloadTasks.get(productId);
  const environmentId = environmentIdFromManagedDownload(productId);
  const legacyRecords = environmentId ? readEnvironmentDownloadRecords() : null;
  const previousLegacyRecord = legacyRecords?.[environmentId];
  try {
    const canceledCleanup = cancelSupersededPackageCleanupForProduct(
      records,
      productId
    );
    const nextRecords = canceledCleanup.records;
    delete nextRecords[productId];
    managedDownloadTasks.delete(productId);
    writeManagedDownloadTasks();
    writeDownloadRecords(nextRecords);
    if (legacyRecords && previousLegacyRecord) {
      delete legacyRecords[environmentId];
      writeEnvironmentDownloadRecords(legacyRecords);
    }
  } catch (error) {
    if (previousTask) managedDownloadTasks.set(productId, previousTask);
    if (legacyRecords && previousLegacyRecord) {
      legacyRecords[environmentId] = previousLegacyRecord;
    }
    try {
      writeManagedDownloadTasks();
      writeDownloadRecords(records);
      if (legacyRecords && previousLegacyRecord) {
        writeEnvironmentDownloadRecords(legacyRecords);
      }
    } catch {
      // Existing completion evidence remains recoverable on the next lookup.
    }
    return {
      ok: false,
      error:
        error instanceof Error
          ? `无法清除下载记录：${error.message}`
          : "无法清除下载记录",
      task: previousTask || task
    };
  }
  downloadTaskLastPersistedAt.delete(productId);
  downloadTaskLastEmittedAt.delete(productId);
  return {
    ok: true,
    filePath:
      record && typeof record.filePath === "string" ? record.filePath : "",
    task: null
  };
}

async function clearAllCompletedDownloadHistories() {
  loadManagedDownloadTasks();
  const productIds = [...managedDownloadTasks.values()]
    .filter((task) => task.phase === "completed")
    .map((task) => task.productId);
  if (!productIds.length) {
    return { ok: true, clearedProductIds: [], errors: [] };
  }
  const confirmation = await showLocalizedMessageBox({
    type: "question",
    title: "清除全部已完成任务",
    message: `确认清除 ${productIds.length} 条已完成下载记录？`,
    detail:
      `只清除${BRAND.name}的任务和验证记录，不会删除电脑上的安装包文件。`,
    buttons: ["保留记录", "全部清除"],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  if (confirmation.response !== 1) {
    return {
      ok: false,
      canceled: true,
      clearedProductIds: [],
      errors: []
    };
  }
  const clearedProductIds = [];
  const errors = [];
  for (const productId of productIds) {
    const result = await clearCompletedDownloadHistory(productId, false);
    if (result.ok) clearedProductIds.push(productId);
    else errors.push({ productId, error: result.error || "无法清除下载记录" });
  }
  return {
    ok: errors.length === 0,
    clearedProductIds,
    errors
  };
}

async function locateWithStatus(command) {
  const result = await locateAllWithStatus(command);
  return {
    ok: result.ok,
    location: result.locations[0] || ""
  };
}

async function locateAllWithStatus(command) {
  try {
    const { stdout } = await execFileAsync("where.exe", [command], {
      windowsHide: true,
      timeout: 5000
    });
    const candidates = stdout
      .split(/\r?\n/)
      .map((candidate) => candidate.trim())
      .filter(Boolean);
    const locations = [...new Set(
      candidates.filter(
        (candidate) => path.isAbsolute(candidate) && fs.existsSync(candidate)
      )
    )];
    return {
      ok: locations.length > 0 || candidates.length === 0,
      locations
    };
  } catch (error) {
    const message = `${error?.stdout || ""}\n${error?.stderr || ""}\n${error?.message || ""}`;
    const notFound =
      Number(error?.code) === 1 &&
      !error?.killed &&
      /could not find|cannot find|not found|找不到/i.test(message);
    return notFound
      ? { ok: true, locations: [] }
      : { ok: false, locations: [] };
  }
}

async function locate(command) {
  return (await locateWithStatus(command)).location;
}

function identitySessionPath() {
  return path.join(app.getPath("userData"), "identity-session.bin");
}

function identityVault() {
  return {
    read() {
      try {
        const encrypted = fs.readFileSync(identitySessionPath());
        if (!safeStorage.isEncryptionAvailable()) return null;
        return JSON.parse(safeStorage.decryptString(encrypted));
      } catch {
        return null;
      }
    },
    write(value) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("Windows 安全凭据存储暂时不可用");
      }
      const target = identitySessionPath();
      const temporary = `${target}.${process.pid}.tmp`;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(
        temporary,
        safeStorage.encryptString(JSON.stringify(value))
      );
      const previous = `${target}.previous`;
      fs.rmSync(previous, { force: true });
      if (fs.existsSync(target)) {
        fs.renameSync(target, previous);
      }
      try {
        fs.renameSync(temporary, target);
        fs.rmSync(previous, { force: true });
      } catch (error) {
        if (!fs.existsSync(target) && fs.existsSync(previous)) {
          fs.renameSync(previous, target);
        }
        throw error;
      }
    },
    clear() {
      fs.rmSync(identitySessionPath(), { force: true });
    }
  };
}

async function identityRequest(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await net.fetch(url, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
        ...(options.idempotencyKey
          ? { "Idempotency-Key": String(options.idempotencyKey) }
          : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal
    });
    const text = await readResponseTextWithLimit(response, 256 * 1024);
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error("身份服务返回了无效响应");
    }
    if (!response.ok) {
      const error = new Error(value.message || "身份服务请求失败");
      error.code = value.error || "TEMPORARILY_UNAVAILABLE";
      error.status = response.status;
      throw error;
    }
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

function getClientServices() {
  if (clientServicesInstance) return clientServicesInstance;
  clientServicesInstance = resolveClientServices({
    isPackaged: app.isPackaged,
    localReleaseAcceptance: LOCAL_RELEASE_ACCEPTANCE,
    upgradeFixture: UPGRADE_FIXTURE,
    packagedConfig: PACKAGE_METADATA.clientServices,
    env: process.env
  });
  return clientServicesInstance;
}

function getIdentityClient() {
  if (identityClientInstance) return identityClientInstance;
  identityClientInstance = createIdentityClient({
    origin: getClientServices().identityOrigin,
    request: identityRequest,
    vault: identityVault(),
    deviceId: clientIdToDeviceId(releaseClientId()),
    deviceName: os.hostname() || "Windows PC"
  });
  return identityClientInstance;
}

function extensionResourcesRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "extensions")
    : path.join(__dirname, "..", "extension-resources");
}

async function inspectExtensionHost(productId) {
  if (productId === "cursor-desktop") {
    const status = (await detectDesktopProducts([productId]))[productId];
    return {
      installed: status?.installed === true,
      detection: ["installed", "absent", "unknown"].includes(status?.detection)
        ? status.detection
        : "unknown"
    };
  }
  const status = getCliStatus(productId);
  if (status.installed === true && status.managed === true) {
    return { installed: true, detection: "installed" };
  }
  if (productId === "cursor-desktop") {
    const desktop = await detectDesktopProduct(productId);
    return {
      installed: desktop.detection === "installed",
      detection: ["installed", "absent", "unknown"].includes(
        desktop.detection
      )
        ? desktop.detection
        : "unknown"
    };
  }
  const external = await discoverTrustedExternalExtensionCliHost(productId);
  if (external.installed) {
    return { installed: true, detection: "installed" };
  }
  return {
    installed: false,
    detection:
      status.detection === "unknown" || external.detection === "unknown"
        ? "unknown"
        : "absent"
  };
}

async function discoverTrustedExternalExtensionCliHost(productId) {
  return findTrustedExternalExtensionCliHost(productId, {
    architecture: process.arch,
    locateAll: locateAllWithStatus,
    exists: fs.existsSync,
    realpath: fs.realpathSync.native,
    verifySignature: (filePath, expectedSigner) =>
      verifyExpectedSignature(filePath, expectedSigner)
  });
}

async function resolveManagedExtensionHostExecutable(productId) {
  const plan = CLI_INSTALL_PLANS[productId];
  const status = getCliStatus(productId);
  if (
    !plan?.postInstall?.executableFile ||
    !status.installed ||
    !status.managed ||
    !status.directory
  ) {
    return "";
  }
  try {
    const prefix = fs.realpathSync.native(status.directory);
    const expected = path.join(
      prefix,
      "node_modules",
      ...plan.packageName.split("/"),
      ...plan.postInstall.executableFile.split(/[\\/]+/)
    );
    const executable = fs.realpathSync.native(expected);
    const relative = path.relative(prefix, executable);
    if (
      executable.toLowerCase() !== expected.toLowerCase() ||
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      !fs.statSync(executable).isFile() ||
      path.extname(executable).toLowerCase() !== ".exe"
    ) {
      return "";
    }
    return executable;
  } catch {
    return "";
  }
}

async function resolveExtensionHostExecutable(productId) {
  const managed = await resolveManagedExtensionHostExecutable(productId);
  if (managed) return managed;
  const external = await discoverTrustedExternalExtensionCliHost(productId);
  return external.executable;
}

function runExtensionHostCommand({ executable, args }) {
  return new Promise((resolve) => {
    let stdout = "";
    let outputBytes = 0;
    let settled = false;
    let timeout = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(result);
    };
    let child;
    try {
      child = spawn(executable, args, {
        cwd: path.dirname(executable),
        env: isolatedThirdPartyEnvironment(),
        windowsHide: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch {
      return resolve({ ok: false, stdout: "" });
    }
    const collect = (chunk, keep) => {
      outputBytes += chunk.length;
      if (outputBytes > 2 * 1024 * 1024) {
        child.kill();
        finish({ ok: false, stdout: "" });
        return;
      }
      if (keep) stdout += chunk.toString("utf8");
    };
    child.stdout.on("data", (chunk) => collect(chunk, true));
    child.stderr.on("data", (chunk) => collect(chunk, false));
    child.once("error", () => finish({ ok: false, stdout: "" }));
    child.once("close", (code) =>
      finish({ ok: code === 0, stdout: code === 0 ? stdout : "" })
    );
    timeout = setTimeout(() => {
      child.kill();
      finish({ ok: false, stdout: "" });
    }, 120_000);
  });
}

function initializeExtensionRuntime() {
  let listProfiles = () => publicExtensionInstallProfiles();
  try {
    const userDataRoot = app.getPath("userData");
    const receiptsRoot = path.join(userDataRoot, "extension-receipts");
    const directoryRuntime = createExtensionRuntime({
      resourcesRoot: extensionResourcesRoot(),
      userDataRoot,
      receiptsRoot,
      targetRoots: {
        "agent-skills": resolveCodexSkillsRoot()
      }
    });
    const mcpRuntime = createCodexMcpRuntime({
      configPath: resolveCodexConfigPath(),
      receiptsRoot,
      profileLookup: getExtensionRuntimeProfile
    });
    const claudeMcpRuntime = createClaudeCodeMcpRuntime({
      receiptsRoot,
      profileLookup: getExtensionRuntimeProfile,
      resolveHostExecutable: resolveManagedExtensionHostExecutable,
      runHostCommand: runExtensionHostCommand
    });
    const cursorMcpRuntime = createCursorMcpRuntime({
      configPath: resolveCursorMcpConfigPath(),
      receiptsRoot,
      profileLookup: getExtensionRuntimeProfile
    });
    const pluginRuntime = createClaudePluginRuntime({
      receiptsRoot,
      ownershipRoot: path.join(os.homedir(), ".claude", "plugins", "data"),
      registryPath: path.join(
        os.homedir(),
        ".claude",
        "plugins",
        "installed_plugins.json"
      ),
      profileLookup: getExtensionRuntimeProfile,
      resolveHostExecutable: resolveExtensionHostExecutable,
      runHostCommand: runExtensionHostCommand
    });
    const manager = createExtensionResourceManager({
      profileLookup: getExtensionRuntimeProfile,
      adapters: {
        "directory-snapshot": directoryRuntime,
        "codex-mcp-toml": mcpRuntime,
        "claude-code-mcp-cli": claudeMcpRuntime,
        "cursor-mcp-json": cursorMcpRuntime,
        "claude-plugin-cli": pluginRuntime
      },
      inspectHost: inspectExtensionHost,
      authorizeAction: ({ profileId, profile, action }) =>
        authorizeFreshCatalogResource({
          loadCatalog: resolveCatalog,
          profileId,
          profile,
          requiredCapability: action
        })
    });
    extensionIpcFacade = createExtensionIpcFacade(manager, {
      listProfiles,
      statusFilter: filterPublishedExtensionUpdates
    });
  } catch (error) {
    extensionIpcFacade = createExtensionIpcFacade(null, {
      listProfiles,
      statusFilter: filterPublishedExtensionUpdates
    });
    console.warn(
      "Extension resources are unavailable; managed extensions are disabled",
      error?.code || "EXTENSION_RUNTIME_UNAVAILABLE"
    );
  }
}

async function deployManagedNpmCli(
  sender,
  productId,
  plan,
  intent = "install"
) {
  const settings = readSettings();
  const records = readManagedCliRecords();
  const previousReceipt = records[productId] || null;
  const requestedDirectory =
    intent === "install"
      ? settings.cliInstallDirectory
      : previousReceipt?.prefix || settings.cliInstallDirectory;
  if (!requestedDirectory || !path.isAbsolute(requestedDirectory)) {
    return { ok: false, error: "请先选择 CLI 工具安装位置" };
  }

  const checks = await Promise.all(
    plan.requirements.map(async (requirement) => ({
      requirement,
      location: await locate(
        requirement === "node"
          ? "node.exe"
          : requirement === "git"
            ? "git.exe"
            : `${requirement}.exe`
      )
    }))
  );
  const missing = checks
    .filter((check) => !check.location)
    .map((check) => check.requirement);
  if (missing.length) {
    return {
      ok: false,
      error: `缺少运行环境：${missing.join("、")}`
    };
  }

  let directory = "";
  try {
    fs.mkdirSync(requestedDirectory, { recursive: true });
    const prefixStatus = inspectManagedCli({
      productId,
      plan,
      receipt: null,
      configuredPrefix: requestedDirectory
    });
    if (!prefixStatus.directory || prefixStatus.detection === "unknown") {
      return { ok: false, error: "CLI 工具安装位置无法安全解析" };
    }
    directory = prefixStatus.directory;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "CLI 工具安装位置不可用"
    };
  }

  const currentStatus = getNpmCliStatus({ productId, plan });
  if (currentStatus.detection === "unknown") {
    return { ok: false, error: "暂时无法确认该 CLI 的当前安装状态" };
  }
  if (intent === "install" && (currentStatus.installed || previousReceipt)) {
    return {
      ok: false,
      error: currentStatus.managed
        ? `该 CLI 已由${BRAND.name}部署`
        : `检测到非${BRAND.name}管理的同名 CLI，客户端不会覆盖或接管`
    };
  }
  if (intent === "update" && !currentStatus.canUpdate) {
    return { ok: false, error: "该 CLI 当前没有可安全应用的受管更新" };
  }
  if (
    intent === "repair" &&
    !["managed", "stale"].includes(currentStatus.ownership)
  ) {
    return { ok: false, error: "该 CLI 当前不具备可验证的修复边界" };
  }

  const prefixKey = directory.toLowerCase();
  if (activeCliPrefixes.has(prefixKey)) {
    return { ok: false, error: "该 CLI 安装位置正在执行其他操作" };
  }

  activeCliPrefixes.add(prefixKey);
  try {
    const actionLabel =
      intent === "update" ? "更新" : intent === "repair" ? "修复" : "安装";
    const confirmation = await showLocalizedMessageBox({
      type: "question",
      title: `${actionLabel} ${plan.name}`,
      message: `确认${actionLabel} ${plan.name}？`,
      detail: [
        `官方软件包：${plan.packageName}`,
        `安装位置：${directory}`,
        "固定使用 npm 官方仓库，并隔离本机 npm 配置。",
        plan.postInstall
          ? "依赖包脚本全部禁用；仅运行客户端已审核的该软件包官方 postinstall，并验证原生程序版本。"
          : "软件包与依赖包的安装生命周期脚本全部禁用。"
      ].join("\n"),
      buttons: ["取消", `确认${actionLabel}`],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) {
      return { ok: false, canceled: true };
    }

    const installResult = await runCliInstall(
      sender,
      productId,
      directory,
      plan,
      intent,
      previousReceipt
    );
    if (!installResult.ok) {
      const rolledBack = previousReceipt
        ? await rollbackManagedNpmReconcile({
            sender,
            productId,
            plan,
            directory,
            previousReceipt
          })
        : await rollbackFreshManagedNpmInstall({
            sender,
            productId,
            plan,
            directory
          });
      return {
        ok: false,
        error: rolledBack
          ? `${installResult.error || `CLI ${actionLabel}失败`}，已自动恢复操作前状态`
          : `${installResult.error || `CLI ${actionLabel}失败`}，自动恢复失败，请保留当前文件并重新检测`
      };
    }
    const { runtime } = installResult;
    const receipt = createManagedCliReceipt({
      productId,
      plan,
      prefix: directory,
      runtime,
      previousReceipt
    });
    if (!receipt) {
      const rolledBack = previousReceipt
        ? await rollbackManagedNpmReconcile({
            sender,
            productId,
            plan,
            directory,
            previousReceipt
          })
        : await rollbackFreshManagedNpmInstall({
            sender,
            productId,
            plan,
            directory
          });
      if (rolledBack) {
        return {
          ok: false,
          error: `CLI ${actionLabel}未能建立新收据，已自动恢复操作前状态`
        };
      }
      return {
        ok: false,
        error: `CLI ${actionLabel}未能建立安全收据，自动恢复失败，请保留当前文件并重新检测`
      };
    }
    try {
      setManagedCliRecord(productId, receipt);
    } catch (error) {
      const rolledBack = previousReceipt
        ? await rollbackManagedNpmReconcile({
            sender,
            productId,
            plan,
            directory,
            previousReceipt
          })
        : await rollbackFreshManagedNpmInstall({
            sender,
            productId,
            plan,
            directory
          });
      if (rolledBack) {
        return {
          ok: false,
          error: `CLI ${actionLabel}收据保存失败，已自动恢复操作前状态`
        };
      }
      return {
        ok: false,
        error:
          error instanceof Error
            ? `CLI 管理收据写入失败且自动恢复失败：${error.message}`
            : "CLI 管理收据写入失败且自动恢复失败"
      };
    }
    const terminal = await openManagedCliTerminal(productId);
    return {
      ok: true,
      version: receipt.version,
      directory: receipt.prefix,
      managed: true,
      terminalOpened: terminal.ok,
      warning: terminal.ok ? undefined : terminal.error
    };
  } finally {
    activeCliPrefixes.delete(prefixKey);
  }
}

async function uninstallManagedNpmCli(sender, productId, plan) {
  const records = readManagedCliRecords();
  const receipt = records[productId] || null;
  const status = getNpmCliStatus({ productId, plan });
  if (!status.canUninstall) {
    return {
      ok: false,
      error: status.installed
        ? "该 CLI 的身份或安装位置无法安全确认，已停止卸载"
        : `未找到可安全卸载的${BRAND.name}受管 CLI`
    };
  }

  let runtime;
  try {
    runtime = await locateNpmRuntime(plan);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "无法定位 Node.js 和 npm"
    };
  }
  let executionContext;
  try {
    executionContext = createNpmExecutionContext();
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "无法建立隔离的 npm 执行环境"
    };
  }
  const action = createManagedCliUninstallAction({
    productId,
    plan,
    receipt,
    configuredPrefix: readSettings().cliInstallDirectory || "",
    runtime,
    executionContext
  });
  if (!action) {
    removeNpmExecutionContext(executionContext);
    return { ok: false, error: "CLI 管理收据或安装内容已变化，已拒绝卸载" };
  }

  const prefixKey = action.prefix.toLowerCase();
  if (activeCliPrefixes.has(prefixKey)) {
    removeNpmExecutionContext(executionContext);
    return { ok: false, error: "该 CLI 安装位置正在执行其他操作" };
  }
  activeCliPrefixes.add(prefixKey);
  try {
    const confirmation = await showLocalizedMessageBox({
      type: "warning",
      title: `卸载 ${plan.name}`,
      message: `确认卸载 ${plan.name}？`,
      detail: [
        `受管软件包：${action.packageName}`,
        `当前版本：${action.version}`,
        `安装位置：${action.prefix}`,
        "只移除这个 npm CLI 包；不会删除模型、项目、npm 缓存或用户配置。",
        "卸载时会禁用软件包生命周期脚本。"
      ].join("\n"),
      buttons: ["取消", "确认卸载"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) {
      return { ok: false, canceled: true };
    }

    let confirmedRuntime;
    try {
      confirmedRuntime = await locateNpmRuntime(plan);
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `确认后运行环境校验失败：${error.message}`
            : "确认后运行环境校验失败"
      };
    }
    const currentRecords = readManagedCliRecords();
    const confirmedAction = createManagedCliUninstallAction({
      productId,
      plan,
      receipt: currentRecords[productId] || null,
      configuredPrefix: readSettings().cliInstallDirectory || "",
      runtime: confirmedRuntime,
      executionContext
    });
    if (
      !confirmedAction ||
      confirmedAction.prefix.toLowerCase() !== prefixKey ||
      confirmedAction.managementId !== action.managementId ||
      confirmedAction.ownership !== action.ownership ||
      confirmedAction.manifestSha256 !== action.manifestSha256 ||
      confirmedAction.version !== action.version ||
      confirmedAction.packageName !== action.packageName ||
      confirmedAction.executable.toLowerCase() !==
        action.executable.toLowerCase() ||
      JSON.stringify(confirmedAction.args) !== JSON.stringify(action.args)
    ) {
      return { ok: false, error: "确认期间 CLI 安装状态发生变化，已拒绝卸载" };
    }

    if (plan.beforeUninstall) {
      const beforeUninstall = createManagedCliBeforeUninstallAction({
        productId,
        plan,
        receipt: currentRecords[productId] || null,
        configuredPrefix: readSettings().cliInstallDirectory || "",
        runtime: confirmedRuntime
      });
      if (
        !beforeUninstall ||
        beforeUninstall.prefix.toLowerCase() !== prefixKey ||
        beforeUninstall.managementId !== confirmedAction.managementId ||
        beforeUninstall.ownership !== confirmedAction.ownership ||
        beforeUninstall.version !== confirmedAction.version
      ) {
        return {
          ok: false,
          error: "无法建立已审核的卸载前清理步骤，已保留 OpenClaw 与其服务"
        };
      }
      try {
        await execFileAsync(beforeUninstall.executable, beforeUninstall.args, {
          ...beforeUninstall.options,
          env: safeNpmEnvironment(executionContext),
          timeout: 120000,
          maxBuffer: 8 * 1024 * 1024
        });
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? `OpenClaw Gateway 服务清理失败，已停止卸载：${error.message}`
              : "OpenClaw Gateway 服务清理失败，已停止卸载"
        };
      }
    }

    const result = await runCliUninstall(
      sender,
      confirmedAction,
      executionContext
    );
    if (!result.ok) return result;
    const after = getNpmCliStatus({ productId, plan });
    if (after.detection !== "absent") {
      return {
        ok: false,
        error:
          after.detection === "unknown"
            ? "npm 已退出，但暂时无法可靠确认卸载结果；管理收据已保留"
            : "npm 已退出，但仍检测到该 CLI；管理收据已保留"
      };
    }
    removeManagedCliRecord(productId);
    return { ok: true, status: getNpmCliStatus({ productId, plan }) };
  } finally {
    removeNpmExecutionContext(executionContext);
    activeCliPrefixes.delete(prefixKey);
  }
}

const CLI_DRIVER_REGISTRY = createCliDriverRegistry({
  npm: {
    status: getNpmCliStatus,
    discover: discoverNpmCliStatus,
    open: openNpmCli,
    reconcile: ({ sender, productId, plan, intent }) =>
      deployManagedNpmCli(sender, productId, plan, intent),
    uninstall: ({ sender, productId, plan }) =>
      uninstallManagedNpmCli(sender, productId, plan)
  },
  "companion-runtime": {
    status: getCompanionRuntimeCliStatus,
    discover: discoverCompanionRuntimeCliStatus,
    open: openCompanionRuntimeCli,
    reconcile: ({ sender, productId, plan, intent }) =>
      intent === "install"
        ? deployOpenClawCompanionRuntime(sender, productId, plan)
        : { ok: false, error: "该运行组件暂不支持更新或修复" },
    uninstall: ({ productId, plan }) =>
      uninstallOpenClawCompanionRuntime(productId, plan)
  },
  "wsl-managed": {
    status: getWslManagedCliStatus,
    discover: discoverWslManagedCliStatus,
    open: openWslManagedCli,
    reconcile: ({ sender, productId, plan, intent }) =>
      intent === "install"
        ? deployManagedWslCli(sender, productId, plan)
        : intent === "update"
          ? updateManagedWslCli(sender, productId, plan)
          : repairManagedWslCli(sender, productId, plan),
    uninstall: ({ sender, productId, plan }) =>
      uninstallManagedWslCli(sender, productId, plan)
  },
  "portable-binary": {
    status: getPortableBinaryCliStatus,
    discover: discoverPortableBinaryCliStatus,
    open: openPortableBinaryCli,
    reconcile: ({ sender, productId, plan, intent }) =>
      reconcileManagedBinaryCli(sender, productId, plan, intent),
    uninstall: ({ productId, plan }) =>
      uninstallManagedBinaryCli(productId, plan)
  },
  "python-venv": {
    status: getPythonVenvCliStatus,
    discover: discoverPythonVenvCliStatus,
    open: openPythonVenvCli,
    reconcile: ({ sender, productId, plan, intent }) =>
      reconcileManagedPythonCli(sender, productId, plan, intent),
    uninstall: ({ productId, plan }) =>
      uninstallManagedPythonCli(productId, plan)
  },
  "managed-msi": {
    status: getManagedMsiCliStatus,
    discover: discoverManagedMsiCliStatus,
    open: openManagedMsiCli,
    reconcile: ({ sender, productId, plan, intent }) =>
      deployManagedMsiCli(sender, productId, plan, intent),
    uninstall: ({ productId, plan }) =>
      uninstallManagedMsiCli(productId, plan)
  }
});

async function reconcileManagedCli(event, productId, intent) {
  const plan = CLI_INSTALL_PLANS[productId];
  if (!plan) {
    return { ok: false, error: "该产品不在客户端 CLI 安装白名单中" };
  }
  if (!CLI_RECONCILE_INTENTS.includes(intent)) {
    return { ok: false, error: "该 CLI 操作未通过客户端审核" };
  }
  if (activeCliProducts.has(productId)) {
    return { ok: false, error: "该工具正在执行其他生命周期操作" };
  }
  const catalogAuthorization = await authorizeCurrentCatalogProduct(
    productId,
    intent
  );
  if (!catalogAuthorization.ok) return catalogAuthorization;
  if (activeCliProducts.has(productId)) {
    return { ok: false, error: "该工具正在执行其他生命周期操作" };
  }
  activeCliProducts.add(productId);
  try {
    return await CLI_DRIVER_REGISTRY.reconcile({
      sender: event.sender,
      productId,
      plan,
      intent
    });
  } finally {
    activeCliProducts.delete(productId);
  }
}

function cleanupFixedCliArtifactDirectories(directories) {
  const temporaryRoot = fs.realpathSync.native(app.getPath("temp"));
  for (const directory of directories) {
    try {
      const resolved = fs.realpathSync.native(directory);
      if (pathIsInside(resolved, temporaryRoot)) {
        fs.rmSync(resolved, { recursive: true, force: true });
      }
    } catch {
      // Best-effort cleanup of only the exact temporary artifact directory.
    }
  }
}

function createFixedCliLifecycleFacade() {
  const transientArtifactDirectories = new Set();
  const receiptStore = {
    read(productId) {
      return readManagedCliRecords()[productId] || null;
    },
    write(productId, receipt) {
      setManagedCliRecord(productId, receipt);
    },
    remove(productId) {
      removeManagedCliRecord(productId);
    }
  };
  const artifactProvider = async ({ productId, artifact }) => {
    const plan = CLI_INSTALL_PLANS[productId];
    const expected = artifactFor(plan, process.arch);
    if (!expected || JSON.stringify(expected) !== JSON.stringify(artifact)) {
      throw new Error("fixed CLI artifact is not approved by the client profile");
    }
    const temporaryRoot = fs.realpathSync.native(app.getPath("temp"));
    const temporaryPrefix = fs.mkdtempSync(
      path.join(temporaryRoot, `aihub-fixed-cli-${productId}-`)
    );
    transientArtifactDirectories.add(temporaryPrefix);
    const layout = createManagedBinaryLayout({
      productId,
      plan,
      prefix: temporaryPrefix,
      architecture: process.arch
    });
    if (!layout) throw new Error("fixed CLI artifact layout is unavailable");
    await downloadManagedBinaryCli(null, productId, plan, layout);
    return { filePath: layout.executable };
  };
  const executor = {
    applyFixedPlan(input) {
      return createPortableBinaryLifecycleExecutor({
        installRoot: readSettings().cliInstallDirectory || "",
        artifactProvider,
        receiptStore,
        architecture: process.arch,
        fileSystem: fs,
        hashFile: fileIntegritySync
      }).applyFixedPlan(input);
    }
  };
  const lifecycle = createManagedCliLifecycleCandidate({
    registrations: INSTALL_REGISTRY,
    plans: CLI_INSTALL_PLANS,
    readReceipt: async ({ productId }) => readManagedCliRecords()[productId] || null,
    receiptOwnsPlan: ({ productId, plan, receipt }) =>
      receiptOwnsPortableBinaryPlan({
        productId,
        plan,
        receipt,
        installRoot: readSettings().cliInstallDirectory || "",
        architecture: process.arch,
        fileSystem: fs,
        hashFile: fileIntegritySync
      }),
    verifyUserConfirmation: async ({ useId, confirmationId }) =>
      typeof useId === "string" && typeof confirmationId === "string" &&
      useId.length > 0 && confirmationId.length > 0,
    executor: {
      async applyFixedPlan(input) {
        try {
          return await executor.applyFixedPlan(input);
        } finally {
          const directories = [...transientArtifactDirectories];
          transientArtifactDirectories.clear();
          cleanupFixedCliArtifactDirectories(directories);
        }
      }
    }
  });
  return createManagedCliLifecycleIpcFacade({
    registrations: INSTALL_REGISTRY,
    lifecycle,
    loadCatalog: resolveCatalog,
    readStatus: async (productId) => getCliStatus(productId),
    recheckStatus: async (productId) => discoverCliStatus(productId)
  });
}

const WINDOWS_PACKAGE_MANAGER_RECONCILE_INTENTS = Object.freeze([
  "install",
  "reinstall",
  "refresh",
  "update"
]);

async function confirmWindowsPackageManagerInstall(product, status, intent) {
  const reinstalling = intent === "reinstall";
  const updating = status.installed && !reinstalling;
  const action = windowsPackageManagerText(
    reinstalling ? "WPM_REINSTALL" : updating ? "WPM_UPDATE" : "WPM_INSTALL"
  );
  const storeSource = product.packageManager.source === "msstore";
  const confirmation = await dialog.showMessageBox({
    type: "question",
    title: `${action} ${product.label}`,
    message: windowsPackageManagerText(
      storeSource ? "WPM_STORE_CONFIRM" : "WPM_CONFIRM",
      { action, name: product.label }
    ),
    detail: [
      `Package: ${product.packageManager.packageId}`,
      `Source: ${product.packageManager.source}`,
      windowsPackageManagerText(
        storeSource ? "WPM_STORE_CONFIRM_DETAIL" : "WPM_CONFIRM_DETAIL"
      )
    ].join("\n"),
    buttons: storeSource
      ? [
          windowsPackageManagerText("WPM_CANCEL"),
          windowsPackageManagerText("WPM_STORE_REPAIR"),
          windowsPackageManagerText("WPM_STORE_CONTINUE")
        ]
      : [windowsPackageManagerText("WPM_CANCEL"), action],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  if (storeSource && confirmation.response === 1) {
    await runMicrosoftStoreRepairTool();
    return "repair";
  }
  if (confirmation.response === (storeSource ? 2 : 1)) return "continue";
  return "cancel";
}

async function authorizeCurrentWindowsPackageManagerProduct(productId) {
  let catalogResult = null;
  const authorization = await authorizeFreshCatalogProduct({
    productId,
    requiredCapability: "install",
    loadCatalog: async () => {
      catalogResult = await resolveCatalog();
      return catalogResult;
    }
  });
  if (!authorization.ok) return authorization;
  const context = resolveManagedProductActionContext({
    productId,
    vendors: catalogResult?.catalog?.vendors,
    localInventory: CLIENT_INSTALL_PROFILES,
    requireCatalogEnabled: true
  });
  const product = getWindowsPackageManagerProduct(productId);
  if (
    !context ||
    !product ||
    context.downloadPolicy !== "package-manager" ||
    context.installProfileId !== product.profileId ||
    !context.capabilities.includes("install")
  ) {
    return {
      ok: false,
      error: windowsPackageManagerText("WPM_CATALOG_MISMATCH"),
      errorCode: "CATALOG_PACKAGE_MANAGER_POLICY_INVALID"
    };
  }
  return authorization;
}

async function reconcileWindowsPackageManagerProduct(productId, intent) {
  const product = getWindowsPackageManagerProduct(productId);
  if (!product) {
    return {
      ok: false,
      error: windowsPackageManagerText("WPM_NOT_APPROVED")
    };
  }
  if (!WINDOWS_PACKAGE_MANAGER_RECONCILE_INTENTS.includes(intent)) {
    return { ok: false, error: windowsPackageManagerText("WPM_ACTION_DENIED") };
  }
  if (activeDesktopOperationEntries.has(productId)) {
    return {
      ok: false,
      busy: true,
      error: windowsPackageManagerText("WPM_BUSY")
    };
  }
  const catalogAuthorization =
    await authorizeCurrentWindowsPackageManagerProduct(productId);
  if (!catalogAuthorization.ok) return catalogAuthorization;
  if (activeDesktopOperationEntries.has(productId)) {
    return {
      ok: false,
      busy: true,
      error: windowsPackageManagerText("WPM_BUSY")
    };
  }
  activeDesktopOperationEntries.add(productId);
  try {
    const executable = await resolveWindowsPackageManagerExecutable();
    if (!executable) {
      return {
        ok: false,
        error: windowsPackageManagerText("WPM_UNAVAILABLE")
      };
    }
    const operationController = getDesktopOperationController();
    const existingOperation = operationController.get(productId);
    if (existingOperation) {
      return {
        ok: false,
        busy: true,
        operationTask: existingOperation,
        error: windowsPackageManagerText("WPM_BUSY")
      };
    }
    const before = await detectDesktopProduct(productId);
    if (before.detection === "unknown") {
      return {
        ok: false,
        status: before,
        error: windowsPackageManagerText("WPM_STATE_UNKNOWN")
      };
    }
    if (
      before.installed &&
      !before.availableVersion &&
      intent !== "reinstall"
    ) {
      return { ok: true, status: before };
    }
    const confirmation = await confirmWindowsPackageManagerInstall(
      product,
      before,
      intent
    );
    if (confirmation !== "continue") {
      return { ok: false, canceled: true, status: before };
    }
    const operation =
      before.installed && intent === "reinstall"
        ? "reinstall"
        : before.installed
          ? "upgrade"
          : "install";
    const shouldOwnAfter = !before.installed || before.ownership === "managed";
    if (!before.installed) {
      let operationTask = operationController.begin(productId, "install");
      const identity = {
        generation: operationTask.generation,
        operationId: operationTask.operationId
      };
      let processSpawned = false;
      const launchResult = await launchProcessWithGrace({
        command: executable,
        args: wingetArgsFor(operation, product.packageManager),
        graceMs: 2_000,
        env: isolatedThirdPartyEnvironment(),
        processLabel: product.label || "Windows 软件包安装",
        onSpawn: () => {
          processSpawned = true;
          operationTask = operationController.finishLaunch(
            productId,
            identity.generation,
            identity.operationId,
            true
          );
        },
        onProcessExit: (exit) =>
          operationController
            .finishProcess(
              productId,
              identity.generation,
              identity.operationId,
              exit
            )
            .then((task) => {
              operationTask = task;
            })
      });
      if (!launchResult.launched) {
        if (!processSpawned || operationTask?.phase === "launching") {
          operationTask = operationController.finishLaunch(
            productId,
            identity.generation,
            identity.operationId,
            false
          );
        }
        if (product.packageManager.source === "msstore") {
          await runMicrosoftStoreRepairTool();
        }
        return {
          ok: false,
          launched: false,
          operationTask,
          error:
            launchResult.error ||
            windowsPackageManagerText("WPM_OPERATION_FAILED")
        };
      }
      return {
        ok: true,
        launched: true,
        operationTask:
          operationController.get(productId) || operationTask,
        warning: launchResult.warning
      };
    }
    await runWindowsPackageManager(
      operation,
      product.packageManager,
      45 * 60 * 1_000
    );
    let status = await detectDesktopProduct(productId);
    if (status.installed && shouldOwnAfter) {
      status = claimWindowsPackageManagerInstallation(
        productId,
        product,
        status
      );
    }
    return status.installed
      ? { ok: true, status }
      : {
          ok: false,
          status,
          error:
            status.detection === "unknown"
              ? windowsPackageManagerText("WPM_INSTALL_NOT_VERIFIED")
              : windowsPackageManagerText("WPM_INSTALL_NO_RECORD")
        };
  } catch (error) {
    if (product.packageManager.source === "msstore") {
      await runMicrosoftStoreRepairTool();
    }
    return {
      ok: false,
      error: windowsPackageManagerFailure(
        error,
        windowsPackageManagerText("WPM_OPERATION_FAILED")
      )
    };
  } finally {
    activeDesktopOperationEntries.delete(productId);
  }
}

async function uninstallWindowsPackageManagerProduct(productId) {
  const product = getWindowsPackageManagerProduct(productId);
  if (!product) {
    return {
      launched: false,
      error: windowsPackageManagerText("WPM_NOT_APPROVED")
    };
  }
  if (activeDesktopOperationEntries.has(productId)) {
    return {
      launched: false,
      busy: true,
      error: windowsPackageManagerText("WPM_BUSY")
    };
  }
  activeDesktopOperationEntries.add(productId);
  try {
    const before = await detectDesktopProduct(productId);
    if (!before.installed) {
      return {
        launched: false,
        error:
          before.detection === "unknown"
            ? windowsPackageManagerText("WPM_STATE_UNKNOWN")
            : windowsPackageManagerText("WPM_NOT_INSTALLED")
      };
    }
    const receipt = readWindowsPackageManagerRecord(productId);
    if (
      !windowsPackageManagerReceiptMatches(
        receipt,
        productId,
        product.packageManager
      )
    ) {
      await shell.openExternal("ms-settings:appsfeatures");
      return {
        launched: true,
        operationTask: null,
        uninstallMode: "system-panel",
        message: windowsPackageManagerText("WPM_SYSTEM_PANEL_OPENED")
      };
    }
    const confirmation = await showDesktopUninstallConfirmation({
      productId,
      mode: "interactive",
      language: readSettings().language,
      surface: "vendor-uninstaller",
      productName: product.label,
      version: before.version,
      publisher: `Windows Package Manager (${product.packageManager.packageId})`
    });
    if (confirmation.response !== 1) {
      return { launched: false, canceled: true };
    }
    if (
      !windowsPackageManagerReceiptMatches(
        readWindowsPackageManagerRecord(productId),
        productId,
        product.packageManager
      )
    ) {
      return {
        launched: false,
        error: windowsPackageManagerText("WPM_RECEIPT_CHANGED")
      };
    }
    await runWindowsPackageManager(
      "uninstall",
      product.packageManager,
      45 * 60 * 1_000
    );
    const status = await detectDesktopProduct(productId);
    if (!status.installed && status.detection === "absent") {
      removeWindowsPackageManagerRecordStrict(productId);
    }
    return {
      launched: true,
      operationTask: null,
      uninstallMode: "interactive",
      message: windowsPackageManagerText("WPM_UNINSTALL_FINISHED"),
      warning: status.installed
        ? windowsPackageManagerText("WPM_STILL_INSTALLED")
        : undefined
    };
  } catch (error) {
    return {
      launched: false,
      error: windowsPackageManagerFailure(
        error,
        windowsPackageManagerText("WPM_UNINSTALL_FAILED")
      )
    };
  } finally {
    activeDesktopOperationEntries.delete(productId);
  }
}

function publishedDesktopStatus(productId, status) {
  const registration = getInstallRegistration(productId);
  const availableVersion = String(status?.availableVersion || "").trim();
  const published =
    registration?.mode === "managed-package-manager" &&
    Boolean(availableVersion) &&
    isSoftwareUpdatePublished(lastVerifiedSoftwareUpdateRelease, {
      kind: "product",
      subjectId: productId,
      mode: "package-manager",
      version: availableVersion
    });
  return published ? status : { ...status, availableVersion: "" };
}

function publishedCliStatus(productId, status) {
  const version = cliPlanVersion(CLI_INSTALL_PLANS[productId]);
  const published =
    status?.canUpdate === true &&
    Boolean(version) &&
    isSoftwareUpdatePublished(lastVerifiedSoftwareUpdateRelease, {
      kind: "product",
      subjectId: productId,
      mode: "managed-cli",
      version
    });
  return {
    ...status,
    canUpdate: Boolean(published),
    availableVersion: published ? version : ""
  };
}

async function scanApprovedProductInventory() {
  const desktopProfiles = CLIENT_INSTALL_PROFILES.filter(
    (profile) =>
      profile.mode === "managed-installer" ||
      profile.mode === "managed-package-manager"
  );
  const cliProfiles = CLIENT_INSTALL_PROFILES.filter(
    (profile) => profile.mode === "managed-cli"
  );
  const [detectedDesktopStatuses, detectedCliStatusEntries] = await Promise.all([
    detectDesktopProducts(desktopProfiles.map((profile) => profile.productId)),
    Promise.all(
      cliProfiles.map(async (profile) => [
        profile.productId,
        await discoverCliStatus(profile.productId)
      ])
    )
  ]);
  const desktopStatuses = Object.fromEntries(
    Object.entries(detectedDesktopStatuses).map(([productId, status]) => [
      productId,
      publishedDesktopStatus(productId, status)
    ])
  );
  const cliStatusEntries = detectedCliStatusEntries.map(([productId, status]) => [
    productId,
    publishedCliStatus(productId, status)
  ]);
  return {
    checkedAt: new Date().toISOString(),
    profiles: CLIENT_INSTALL_PROFILES,
    desktopStatuses,
    cliStatuses: Object.fromEntries(cliStatusEntries)
  };
}

function registerIpc() {
  const senderWindow = (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window && !window.isDestroyed() ? window : null;
  };
  ipcMain.handle("window:minimize", (event) => {
    const window = senderWindow(event);
    if (!window) return false;
    window.minimize();
    return true;
  });
  ipcMain.handle("window:toggle-maximize", (event) => {
    const window = senderWindow(event);
    if (!window) return false;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
    return true;
  });
  ipcMain.handle("window:close", (event) => {
    const window = senderWindow(event);
    if (!window) return false;
    window.close();
    return true;
  });
  ipcMain.handle("catalog:get", async () => {
    const result = await resolveCatalog();
    activeEnvironmentSourcePreferences =
      result.catalog?.environmentDownloads?.sources;
    return result;
  });
  ipcMain.handle("update:check", () => checkForUpdate());
  ipcMain.handle("software-updates:check", () => checkSoftwareUpdates());
  ipcMain.handle("inventory:scan", () => scanApprovedProductInventory());
  ipcMain.handle("extension:list", () => extensionIpcFacade.list());
  ipcMain.handle("extension:inspect", (_event, profileId) =>
    extensionIpcFacade.inspect(profileId)
  );
  ipcMain.handle("extension:execute", (_event, profileId, action) => {
    if (action === "update") {
      const version = extensionProfileVersion(
        getExtensionRuntimeProfile(profileId)
      );
      assertSoftwareUpdatePublished({
        kind: "extension",
        subjectId: profileId,
        mode: "extension",
        version
      });
    }
    return extensionIpcFacade.execute(profileId, action);
  });
  ipcMain.handle("extension:status", (_event, profileId) =>
    extensionIpcFacade.inspect(profileId)
  );
  ipcMain.handle("extension:install", (_event, profileId) =>
    extensionIpcFacade.execute(profileId, "install")
  );
  ipcMain.handle("extension:uninstall", (_event, profileId) =>
    extensionIpcFacade.execute(profileId, "uninstall")
  );
  ipcMain.handle("identity:current", () => getIdentityClient().current());
  ipcMain.handle("identity:request-code", (_event, email) =>
    getIdentityClient().requestRegistrationCode(email)
  );
  ipcMain.handle("identity:register", (_event, input) =>
    getIdentityClient().register(input)
  );
  registerIdentityLoginIpc(ipcMain, {
    getIdentityClient,
    logError: console.error
  });
  ipcMain.handle("identity:logout", async () => {
    try {
      return await getIdentityClient().logout();
    } finally {
      await clearCommunitySessionCookies(session);
    }
  });
  ipcMain.handle("identity:list-sessions", () =>
    getIdentityClient().listSessions()
  );
  ipcMain.handle("identity:revoke-session", async (_event, sessionId) => {
    const result = await getIdentityClient().revokeSession(sessionId);
    if (result.revokedCurrent) {
      await clearCommunitySessionCookies(session);
    }
    return result;
  });
  ipcMain.handle("identity:update-profile", (_event, input) =>
    getIdentityClient().updateProfile(input)
  );
  ipcMain.handle("identity:update-avatar", (_event, input) =>
    getIdentityClient().updateAvatar(input)
  );
  ipcMain.handle("identity:update-phone", (_event, input) =>
    getIdentityClient().updatePhone(input)
  );
  ipcMain.handle("identity:request-email-change", (_event, input) =>
    getIdentityClient().requestEmailChange(input)
  );
  ipcMain.handle("identity:complete-email-change", (_event, input) =>
    getIdentityClient().completeEmailChange(input)
  );
  ipcMain.handle("identity:change-password", (_event, input) =>
    getIdentityClient().changePassword(input)
  );
  ipcMain.handle("identity:get-personal-center", () =>
    getIdentityClient().getPersonalCenter()
  );
  registerResourceSubmissionIpc(ipcMain, {
    getIdentityClient,
    logError: console.error
  });
  registerWorkflowStoreIpc(ipcMain, {
    getIdentityClient,
    logError: console.error
  });
  // Candidate-only: no immutable Workflow release resolver or session-bound
  // receipt snapshot is connected here, so the fixed facade stays disabled.
  registerLocalAgentBridgeIpc(ipcMain, { logError: console.error });
  registerManagedCliLifecycleIpc(ipcMain, createFixedCliLifecycleFacade());
  ipcMain.handle("identity:get-user-by-username", (_event, username) =>
    getIdentityClient().getIdentityUserByUsername(username)
  );
  ipcMain.handle("identity:list-followers", (_event, options) =>
    getIdentityClient().listIdentityFollowers(options)
  );
  ipcMain.handle("identity:list-following", (_event, options) =>
    getIdentityClient().listIdentityFollowing(options)
  );
  ipcMain.handle("identity:follow-user", (_event, userId) =>
    getIdentityClient().followIdentityUser(userId)
  );
  ipcMain.handle("identity:unfollow-user", (_event, userId) =>
    getIdentityClient().unfollowIdentityUser(userId)
  );
  ipcMain.handle("identity:list-direct-conversations", (_event, options) =>
    getIdentityClient().listDirectConversations(options)
  );
  ipcMain.handle("identity:list-direct-messages", (_event, peerUserId, options) =>
    getIdentityClient().listDirectMessages(peerUserId, options)
  );
  ipcMain.handle(
    "identity:send-direct-message",
    (_event, peerUserId, input) =>
      getIdentityClient().sendDirectMessage(peerUserId, input)
  );
  ipcMain.handle(
    "identity:mark-direct-messages-read",
    (_event, peerUserId, throughMessageId) =>
      getIdentityClient().markDirectMessagesRead(
        peerUserId,
        throughMessageId
      )
  );
  ipcMain.handle(
    "identity:mark-personal-center-notification-read",
    (_event, source, notificationId) =>
      getIdentityClient().markPersonalCenterNotificationRead(
        source,
        notificationId
      )
  );
  ipcMain.handle("identity:list-messages", () =>
    getIdentityClient().listMessages()
  );
  ipcMain.handle("identity:mark-message-read", (_event, messageId) =>
    getIdentityClient().markMessageRead(messageId)
  );
  ipcMain.handle("identity:list-community-interactions", () =>
    getIdentityClient().listCommunityInteractions()
  );
  ipcMain.handle(
    "identity:set-community-interaction",
    (_event, discussionId, input) =>
      getIdentityClient().setCommunityInteraction(discussionId, input)
  );
  ipcMain.handle("community:create-embed-session", async () => {
    try {
      const handoff = await getIdentityClient().createCommunityHandoff();
      const approvedOrigin = getClientServices().communityOrigin;
      return {
        ok: true,
        value: {
          launchUrl: validateCommunityLaunchUrl(
            handoff.launchUrl,
            approvedOrigin
          ),
          origin: approvedCommunityOrigin(approvedOrigin),
          expiresAt: handoff.expiresAt
        }
      };
    } catch (error) {
      return communityEmbedSessionFailure(error);
    }
  });
  ipcMain.handle("update:open-download", async (event) => {
    const offer = lastVerifiedUpdateOffer;
    if (!offer || offer.expiresAt < Date.now()) {
      lastVerifiedUpdateOffer = null;
      return {
        ok: false,
        stage: "offer",
        error: "更新信息已过期，请重新检查更新"
      };
    }

    let plan;
    try {
      const channel = readUpdateChannel();
      if (channel.error) throw new Error(channel.error);
      const updateRoot = path.join(app.getPath("userData"), "updates");
      plan = planUpdateInstallerDownload(offer, channel, updateRoot);
      fs.mkdirSync(updateRoot, { recursive: true });
      const rootStat = fs.lstatSync(updateRoot);
      if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
        throw new Error("客户端更新目录不安全");
      }
      if (fs.existsSync(plan.target)) {
        const existing = fs.lstatSync(plan.target);
        if (!existing.isFile() || existing.isSymbolicLink()) {
          throw new Error("现有更新安装包路径不安全");
        }
        fs.rmSync(plan.target);
      }

      const result = await downloadPackage(
        event.sender,
        {
          productId: plan.productId,
          url: plan.url,
          allowedFinalOrigins: plan.allowedFinalOrigins
        },
        plan.target,
        {
          resumeAllowed: true,
          keepPartial: true,
          safetyReserveBytes: 512 * 1024 * 1024,
          isCurrentAttempt: () =>
            lastVerifiedUpdateOffer === offer &&
            offer.expiresAt >= Date.now()
        }
      );
      const verified = verifyUpdateInstallerDownload(result, plan);
      const confirmation = await showLocalizedMessageBox({
        type: "warning",
        title: `安装${BRAND.name}更新`,
        message: `${BRAND.name} ${offer.version} 已下载并通过完整性校验`,
        detail: [
          `安装包：${path.basename(verified.filePath)}`,
          `SHA-256：${verified.sha256}`,
          "点击“安装更新”后将启动 Windows 安装器。"
        ].join("\n"),
        buttons: ["取消", "安装更新"],
        defaultId: 1,
        cancelId: 0,
        noLink: true
      });
      if (confirmation.response !== 1) {
        return {
          ok: false,
          stage: "confirmation",
          canceled: true,
          filePath: verified.filePath,
          error: "更新安装已取消，安装包仍保留在本机"
        };
      }

      const launch = await launchProcessWithGrace({
        command: verified.filePath,
        graceMs: 2_000,
        env: isolatedThirdPartyEnvironment(),
        processLabel: `${BRAND.name}更新安装器`
      });
      if (!launch.launched) {
        return {
          ok: false,
          stage: "launch",
          filePath: verified.filePath,
          error: launch.error || "Windows 未能启动更新安装器"
        };
      }
      lastVerifiedUpdateOffer = null;
      return {
        ok: true,
        stage: "launched",
        filePath: verified.filePath,
        warning: launch.warning || ""
      };
    } catch (error) {
      if (plan?.target) {
        try {
          if (fs.existsSync(plan.target)) fs.rmSync(plan.target);
        } catch {
          // The fixed update path remains quarantined until the next attempt.
        }
      }
      const failure = managedDownloadFailure(error);
      return {
        ok: false,
        stage: "download",
        errorCode: failure.errorCode,
        error: failure.errorMessage
      };
    }
  });
  ipcMain.handle("settings:get", () => readSettings());

  ipcMain.handle("settings:set-language", (_event, language) => {
    const settings = {
      ...readSettings(),
      language: language === "en" ? "en" : "zh"
    };
    writeSettings(settings);
    return settings;
  });

  ipcMain.handle("settings:choose-download-directory", async () => {
    const result = await showLocalizedOpenDialog({
      title: "选择安装包下载位置",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) {
      return { ...readSettings(), selectionCanceled: true };
    }
    const settings = {
      ...readSettings(),
      downloadDirectory: result.filePaths[0]
    };
    writeSettings(settings);
    return { ...settings, selectionCanceled: false };
  });

  ipcMain.handle("settings:choose-cli-directory", async () => {
    const result = await showLocalizedOpenDialog({
      title: "选择 CLI 工具安装位置",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) {
      return readSettings();
    }
    const settings = {
      ...readSettings(),
      cliInstallDirectory: result.filePaths[0]
    };
    writeSettings(settings);
    return settings;
  });

  ipcMain.handle("settings:open-download-directory", async () => {
    const target = readSettings().downloadDirectory;
    if (!target || !path.isAbsolute(target) || !fs.existsSync(target)) {
      return false;
    }
    return (await shell.openPath(target)) === "";
  });

  ipcMain.handle("settings:open-cli-directory", async () => {
    const configured = readSettings().cliInstallDirectory;
    if (!configured || !path.isAbsolute(configured)) return false;
    try {
      const target = fs.realpathSync(configured);
      if (!fs.statSync(target).isDirectory()) return false;
      return (await shell.openPath(target)) === "";
    } catch {
      return false;
    }
  });

  ipcMain.handle("settings:open-windows-uninstall", async () => {
    try {
      await shell.openExternal("ms-settings:appsfeatures");
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("settings:clear-download-directory", () => {
    const settings = { ...readSettings(), downloadDirectory: "" };
    writeSettings(settings);
    return settings;
  });

  ipcMain.handle("environment:scan", () => scanEnvironment());

  ipcMain.handle("environment:open-location", async (_event, environmentId) => {
    if (!getEnvironmentPlan(environmentId)) return false;
    const status = await detectEnvironmentOperationStatus(environmentId);
    if (!status.installed || !status.executable) {
      return false;
    }
    shell.showItemInFolder(status.executable);
    return true;
  });

  ipcMain.handle("environment:install", async (_event, environmentId) => {
    const environmentPlan = getEnvironmentPlan(environmentId);
    if (!environmentPlan) {
      return { downloaded: false, error: "该环境不在客户端白名单中" };
    }
    const entryKey = `environment:${environmentId}`;
    const operationTask =
      getEnvironmentOperationController().get(environmentId);
    if (operationTask) {
      return {
        downloaded: false,
        busy: true,
        operationTask,
        error:
          operationTask.operation === "uninstall"
            ? "该环境仍在确认卸载结果，不能同时下载安装包"
            : "该环境安装程序已打开，正在确认安装结果"
      };
    }
    if (
      activeEnvironmentDownloads.has(environmentId) ||
      activeDesktopOperationEntries.has(entryKey)
    ) {
      return { downloaded: false, busy: true, error: "该环境操作正在进行" };
    }
    if (environmentPlan.nativeWindowsFeature) {
      activeDesktopOperationEntries.add(entryKey);
      let launchedTask = null;
      let processSpawned = false;
      try {
        const baselineStatus = await detectEnvironmentOperationStatus(environmentId);
        if (baselineStatus.installed) {
          return {
            downloaded: false,
            message: `${environmentPlan.name} 已安装`
          };
        }
        if (baselineStatus.detection !== "absent") {
          return {
            downloaded: false,
            error: `暂时无法可靠确认 ${environmentPlan.name} 状态，请稍后重试`
          };
        }
        const operationController = getEnvironmentOperationController();
        launchedTask = operationController.begin(environmentId, "install");
        const identity = {
          generation: launchedTask.generation,
          operationId: launchedTask.operationId
        };
        const wslExecutable = path.join(
          process.env.SystemRoot || "C:\\Windows",
          "System32",
          "wsl.exe"
        );
        const powershellExecutable = windowsPowerShellPath();
        const elevationScript = [
          "$ErrorActionPreference='Stop'",
          `$p=Start-Process -FilePath '${wslExecutable.replaceAll("'", "''")}' -ArgumentList @('--install','--no-distribution') -Verb RunAs -PassThru`,
          "if($null -eq $p){exit 1}",
          "exit 0"
        ].join(";");
        const result = await launchProcessWithGrace({
          command: powershellExecutable,
          args: [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            elevationScript
          ],
          graceMs: 4_000,
          env: isolatedThirdPartyEnvironment(),
          processLabel: `${environmentPlan.name} 安装程序`,
          onSpawn: () => {
            processSpawned = true;
            launchedTask = operationController.finishLaunch(
              environmentId,
              identity.generation,
              identity.operationId,
              true
            );
          }
        });
        if (!result.launched) {
          if (!processSpawned) {
            launchedTask = operationController.finishLaunch(
              environmentId,
              identity.generation,
              identity.operationId,
              false
            );
          }
          return {
            downloaded: false,
            operationTask: launchedTask,
            error: result.error || `无法启动 ${environmentPlan.name} 安装`
          };
        }
        return {
          downloaded: false,
          operationTask: operationController.get(environmentId) || launchedTask,
          message: `正在安装 ${environmentPlan.name}`
        };
      } catch (error) {
        return {
          downloaded: false,
          operationTask: launchedTask,
          error: error instanceof Error ? error.message : "无法安装 WSL"
        };
      } finally {
        activeDesktopOperationEntries.delete(entryKey);
      }
    }
    return await prepareEnvironmentPackageDownload(environmentId, "install");
  });

  ipcMain.handle("environment:update", (_event, environmentId) =>
    prepareEnvironmentPackageDownload(environmentId, "update")
  );

  ipcMain.handle("environment:package-get", async (_event, environmentId) => {
    const plan = getEnvironmentPlan(environmentId);
    if (!plan) return null;
    if (plan.nativeWindowsFeature) {
      return {
        ready: false,
        message: "WSL 由 Windows 功能安装，不使用独立安装包"
      };
    }
    const record = await verifiedEnvironmentRecord(environmentId);
    return record
      ? {
          ready: true,
          filePath: record.filePath,
          source: record.source,
          message: `${plan.name} 安装包已验证，可以点击“打开安装包”`
        }
      : { ready: false };
  });

  ipcMain.handle("environment:operation-get", (_event, environmentId) =>
    getEnvironmentPlan(environmentId)
      ? getEnvironmentOperationController().get(environmentId)
      : null
  );

  ipcMain.handle(
    "environment:operation-check",
    (_event, environmentId, generation, operationId) =>
      Boolean(getEnvironmentPlan(environmentId)) &&
      Number.isSafeInteger(generation) &&
      generation > 0 &&
      typeof operationId === "string" &&
      operationId.trim() === operationId &&
      operationId.length > 0
        ? getEnvironmentOperationController().checkNow(
            environmentId,
            generation,
            operationId
          )
        : null
  );

  ipcMain.handle(
    "environment:open-updater",
    async (_event, environmentId) => {
      const plan = getEnvironmentPlan(environmentId);
      if (!plan || plan.nativeWindowsFeature) {
        return { launched: false, error: "该环境没有固定更新安装包" };
      }
      const operationTask = getEnvironmentOperationController().get(environmentId);
      const entryKey = `environment:${environmentId}`;
      if (operationTask || activeDesktopOperationEntries.has(entryKey)) {
        return {
          launched: false,
          busy: true,
          operationTask,
          error: "该环境仍有其他操作正在进行"
        };
      }
      activeDesktopOperationEntries.add(entryKey);
      try {
        const downloadPlan = getEnvironmentDownloadPlan(
          environmentId,
          activeEnvironmentSourcePreferences
        );
        const baseline = createEnvironmentUpdatePlan({
          environmentId,
          statuses: await detectEnvironmentUpdateStatuses(environmentId),
          downloadPlan
        });
        if (!baseline) {
          return { launched: false, error: "当前状态不再满足安全更新条件" };
        }
        const record = await verifiedEnvironmentRecord(environmentId);
        if (!record) {
          return { launched: false, error: "更新包不存在、已被修改或签名无效" };
        }
        const confirmed = createEnvironmentUpdatePlan({
          environmentId,
          statuses: await detectEnvironmentUpdateStatuses(environmentId),
          downloadPlan
        });
        if (
          !confirmed ||
          confirmed.installedEnvironmentId !== baseline.installedEnvironmentId ||
          confirmed.installedVersion !== baseline.installedVersion ||
          confirmed.recommendedVersion !== baseline.recommendedVersion
        ) {
          return { launched: false, error: "确认期间环境版本发生变化，已拒绝更新" };
        }
        const isMsi = /\.msi$/i.test(record.filePath);
        const command = isMsi
          ? path.join(
              process.env.SystemRoot || "C:\\Windows",
              "System32",
              "msiexec.exe"
            )
          : record.filePath;
        const args = isMsi ? ["/i", record.filePath] : [];
        if (!fs.existsSync(command)) {
          return { launched: false, error: `${plan.name} 更新程序启动路径不存在` };
        }
        const result = await launchProcessWithGrace({
          command,
          args,
          graceMs: 2_000,
          env: isolatedThirdPartyEnvironment(),
          processLabel: `${plan.name} 更新安装程序`
        });
        return result.launched
          ? {
              ...result,
              intent: "update",
              recommendedVersion: confirmed.recommendedVersion,
              requiresRecheck: true,
              message: `已打开 ${plan.name} 更新安装程序；完成或取消后请重新检测版本`
            }
          : result;
      } catch (error) {
        return {
          launched: false,
          error: error instanceof Error ? error.message : "无法打开环境更新安装包"
        };
      } finally {
        activeDesktopOperationEntries.delete(entryKey);
      }
    }
  );

  ipcMain.handle(
    "environment:open-installer",
    async (_event, environmentId) => {
      const plan = getEnvironmentPlan(environmentId);
      if (!plan) {
        return { launched: false, error: "该环境不在客户端白名单中" };
      }
      if (plan.nativeWindowsFeature) {
        return {
          launched: false,
          error: "WSL 由 Windows 功能自动安装，请点击安装按钮"
        };
      }
      const operationController = getEnvironmentOperationController();
      const existingOperation = operationController.get(environmentId);
      if (existingOperation) {
        return {
          launched: false,
          busy: true,
          operationTask: existingOperation,
          error:
            existingOperation.operation === "uninstall"
              ? "该环境仍在确认卸载结果，不能同时打开安装程序"
              : "该环境仍在自动确认安装结果，无需重复打开安装程序"
        };
      }
      const entryKey = `environment:${environmentId}`;
      if (activeDesktopOperationEntries.has(entryKey)) {
        return {
          launched: false,
          busy: true,
          error: "该环境操作正在准备，请勿重复点击"
        };
      }
      activeDesktopOperationEntries.add(entryKey);
      let operationTask = null;
      let processSpawned = false;
      try {
        const record = await verifiedEnvironmentRecord(environmentId);
        if (!record) {
          return {
            launched: false,
            error: "安装包不存在、已被修改或数字签名无效，请重新下载"
          };
        }
        const isMsi = /\.msi$/i.test(record.filePath);
        const command = isMsi
          ? path.join(
              process.env.SystemRoot || "C:\\Windows",
              "System32",
              "msiexec.exe"
            )
          : record.filePath;
        const args = isMsi ? ["/i", record.filePath] : [];
        if (!fs.existsSync(command)) {
          return {
            launched: false,
            error: `${plan.name} 安装程序启动路径不存在`
          };
        }
        const baselineStatus =
          await detectEnvironmentOperationStatus(environmentId);
        if (baselineStatus.detection === "installed") {
          return {
            launched: false,
            error: `${plan.name} 已安装；为避免把升级或取消误判为首次安装，客户端不会重复打开该安装包`
          };
        }
        if (baselineStatus.detection !== "absent") {
          return {
            launched: false,
            error: `暂时无法可靠确认 ${plan.name} 是否已安装，请稍后重新检测`
          };
        }

        operationTask = operationController.begin(environmentId, "install");
        const identity = {
          generation: operationTask.generation,
          operationId: operationTask.operationId
        };
        const finishLaunch = (launched) => {
          operationTask = operationController.finishLaunch(
            environmentId,
            identity.generation,
            identity.operationId,
            launched
          );
          return operationTask;
        };
        const launchResult = await launchProcessWithGrace({
          command,
          args,
          graceMs: 2_000,
          env: isolatedThirdPartyEnvironment(),
          processLabel: `${plan.name} 安装程序`,
          onSpawn: () => {
            processSpawned = true;
            finishLaunch(true);
          }
        });
        if (!launchResult.launched) {
          let cleanupWarning = "";
          try {
            finishLaunch(false);
          } catch (cleanupError) {
            operationTask = operationController.get(environmentId);
            cleanupWarning =
              cleanupError instanceof Error
                ? `；且无法清理操作记录：${cleanupError.message}`
                : "；且无法清理操作记录";
          }
          return {
            ...launchResult,
            operationTask,
            error: `${launchResult.error || `无法打开 ${plan.name} 安装程序`}${cleanupWarning}`
          };
        }
        let persistenceWarning = launchResult.warning || "";
        try {
          if (operationTask?.phase === "launching") finishLaunch(true);
        } catch (verificationError) {
          operationTask = operationController.get(environmentId);
          const message =
            verificationError instanceof Error
              ? `自动检测任务暂时无法更新：${verificationError.message}`
              : "自动检测任务暂时无法更新";
          persistenceWarning = persistenceWarning
            ? `${persistenceWarning}；${message}`
            : message;
        }
        return {
          ...launchResult,
          operationTask:
            operationController.get(environmentId) || operationTask,
          warning: persistenceWarning || undefined,
          message: `已打开 ${plan.name} 安装程序，正在自动确认安装结果`
        };
      } catch (error) {
        if (operationTask && !processSpawned) {
          try {
            operationTask = operationController.finishLaunch(
              environmentId,
              operationTask.generation,
              operationTask.operationId,
              false
            );
          } catch {
            operationTask = operationController.get(environmentId);
          }
        }
        return {
          launched: false,
          operationTask,
          error:
            error instanceof Error && error.message
              ? `无法打开 ${plan.name} 安装程序：${error.message}`
              : `无法打开 ${plan.name} 安装程序`
        };
      } finally {
        activeDesktopOperationEntries.delete(entryKey);
      }
    }
  );

  ipcMain.handle("environment:uninstall", async (_event, environmentId) => {
    const plan = getEnvironmentPlan(environmentId);
    if (!plan) {
      return { launched: false, error: "该环境不在客户端卸载白名单中" };
    }
    const operationController = getEnvironmentOperationController();
    const existingOperation = operationController.get(environmentId);
    if (existingOperation) {
      return {
        launched: false,
        busy: true,
        operationTask: existingOperation,
        error:
          existingOperation.operation === "install"
            ? "该环境仍在确认安装结果，不能同时启动卸载程序"
            : "该环境仍在确认卸载结果，无需重复启动卸载程序"
      };
    }
    const entryKey = `environment:${environmentId}`;
    if (activeDesktopOperationEntries.has(entryKey)) {
      return {
        launched: false,
        busy: true,
        error: "该环境操作正在准备，请勿重复点击"
      };
    }
    activeDesktopOperationEntries.add(entryKey);
    let operationTask = null;
    let processSpawned = false;
    try {
      if (environmentId === "wsl") {
        const wslExecutable = systemCommandPath("wsl.exe");
        const action = createWslPlatformUninstallAction({ wslExecutable });
        const status = await detectEnvironmentOperationStatus(environmentId);
        if (!status.installed || !action) {
          return { launched: false, error: "未检测到可卸载的 WSL 平台" };
        }
        const distributions = await listWslDistributions(wslExecutable);
        const confirmation = await showLocalizedMessageBox({
          type: "warning",
          title: "卸载 WSL",
          message: "卸载 WSL 平台？",
          detail: distributions.length
            ? `检测到 ${distributions.length} 个发行版：${distributions.join("、")}。${BRAND.name}不会注销发行版，也不会执行会删除发行版数据的命令。卸载平台后，这些发行版将暂时无法运行。`
            : `${BRAND.name}只卸载 WSL 平台，不会执行发行版注销命令。`,
          buttons: ["取消", "继续卸载"],
          defaultId: 0,
          cancelId: 0,
          noLink: true
        });
        if (confirmation.response !== 1) {
          return { launched: false, canceled: true };
        }
        const finalStatus = await detectEnvironmentOperationStatus(environmentId);
        if (!finalStatus.installed) {
          return { launched: false, error: "WSL 状态已变化，请刷新后重试" };
        }
        operationTask = operationController.begin(environmentId, "uninstall");
        const identity = {
          generation: operationTask.generation,
          operationId: operationTask.operationId
        };
        const powershellExecutable = windowsPowerShellPath();
        const elevationScript = [
          "$ErrorActionPreference='Stop'",
          `$p=Start-Process -FilePath '${action.executable.replaceAll("'", "''")}' -ArgumentList @('--uninstall') -Verb RunAs -PassThru`,
          "if($null -eq $p){exit 1}",
          "exit 0"
        ].join(";");
        const finishLaunch = (launched) => {
          operationTask = operationController.finishLaunch(
            environmentId,
            identity.generation,
            identity.operationId,
            launched
          );
          return operationTask;
        };
        const launchResult = await launchProcessWithGrace({
          command: powershellExecutable,
          args: [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            elevationScript
          ],
          graceMs: 4_000,
          env: isolatedThirdPartyEnvironment(),
          processLabel: "WSL 卸载程序",
          onSpawn: () => {
            processSpawned = true;
            finishLaunch(true);
          }
        });
        if (!launchResult.launched) {
          if (operationTask?.phase === "launching") finishLaunch(false);
          return {
            ...launchResult,
            operationTask,
            error: launchResult.error || "无法启动 WSL 卸载程序"
          };
        }
        if (operationTask?.phase === "launching") finishLaunch(true);
        return {
          ...launchResult,
          managed: true,
          operationTask:
            operationController.get(environmentId) || operationTask,
          message: "正在卸载 WSL"
        };
      }
      const [registryScan, evidence] = await Promise.all([
        scanRegistryAppsWithStatus(),
        locateEnvironment(environmentId, plan)
      ]);
      if (!registryScan.ok) {
        return {
          launched: false,
          error: "Windows 卸载项扫描不完整，请稍后重新检测"
        };
      }
      const uninstallRecord = await trustedEnvironmentUninstallRecord(
        environmentId,
        registryScan.entries
      );
      const status = await environmentStatusFromScan(
        environmentId,
        evidence,
        registryScan
      );
      if (!status.installed || !uninstallRecord) {
        return {
          launched: false,
          error: "未找到可信的 Windows 卸载项，已拒绝执行"
        };
      }
      const { entry, action } = uninstallRecord;

      const confirmation = await showLocalizedMessageBox({
        type: "warning",
        title: `卸载 ${plan.name}`,
        message: `确认打开 ${plan.name} 的官方卸载程序？`,
        detail: [
          `Windows 登记名称：${entry.displayname}`,
          `发布者：${entry.publisher}`,
          `卸载程序打开不代表卸载已经完成；${BRAND.name}会继续确认可信安装证据是否消失。`
        ].join("\n"),
        buttons: ["取消", "继续卸载"],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      if (confirmation.response !== 1) {
        return { launched: false, canceled: true };
      }

      const finalRegistryScan = await scanRegistryAppsWithStatus();
      if (!finalRegistryScan.ok) {
        return {
          launched: false,
          error: "卸载项在确认期间无法重新验证，已拒绝执行"
        };
      }
      const finalEvidence = await locateEnvironment(environmentId, plan);
      const finalStatus = await environmentStatusFromScan(
        environmentId,
        finalEvidence,
        finalRegistryScan
      );
      const finalRecord = await trustedEnvironmentUninstallRecord(
        environmentId,
        finalRegistryScan.entries
      );
      const finalEntry = finalRecord?.entry || null;
      const finalAction = finalRecord?.action || null;
      if (
        !finalStatus.installed ||
        !finalEntry ||
        !finalAction ||
        finalEntry.key !== entry.key ||
        finalAction.kind !== action.kind ||
        finalAction.executable.toLowerCase() !==
          action.executable.toLowerCase() ||
        JSON.stringify(finalAction.args) !== JSON.stringify(action.args)
      ) {
        return {
          launched: false,
          error: "卸载程序在确认期间发生变化，已拒绝执行"
        };
      }

      const command = finalAction.executable;
      if (!fs.existsSync(command)) {
        return {
          launched: false,
          error: `${plan.name} 卸载程序不存在`
        };
      }
      operationTask = operationController.begin(environmentId, "uninstall");
      const identity = {
        generation: operationTask.generation,
        operationId: operationTask.operationId
      };
      const finishLaunch = (launched) => {
        operationTask = operationController.finishLaunch(
          environmentId,
          identity.generation,
          identity.operationId,
          launched
        );
        return operationTask;
      };
      const launchResult = await launchProcessWithGrace({
        command,
        args: finalAction.args,
        graceMs: 2_000,
        env: isolatedThirdPartyEnvironment(),
        processLabel: `${plan.name} 卸载程序`,
        onSpawn: () => {
          processSpawned = true;
          finishLaunch(true);
        }
      });
      if (!launchResult.launched) {
        let cleanupWarning = "";
        try {
          finishLaunch(false);
        } catch (cleanupError) {
          operationTask = operationController.get(environmentId);
          cleanupWarning =
            cleanupError instanceof Error
              ? `；且无法清理操作记录：${cleanupError.message}`
              : "；且无法清理操作记录";
        }
        return {
          ...launchResult,
          operationTask,
          error: `${launchResult.error || `无法打开 ${plan.name} 卸载程序`}${cleanupWarning}`
        };
      }
      let persistenceWarning = launchResult.warning || "";
      try {
        if (operationTask?.phase === "launching") finishLaunch(true);
      } catch (verificationError) {
        operationTask = operationController.get(environmentId);
        const message =
          verificationError instanceof Error
            ? `自动卸载检测任务暂时无法更新：${verificationError.message}`
            : "自动卸载检测任务暂时无法更新";
        persistenceWarning = persistenceWarning
          ? `${persistenceWarning}；${message}`
          : message;
      }
      return {
        ...launchResult,
        operationTask:
          operationController.get(environmentId) || operationTask,
        warning: persistenceWarning || undefined,
        message: `已打开 ${plan.name} 卸载程序，正在自动确认卸载结果`
      };
    } catch (error) {
      if (operationTask && !processSpawned) {
        try {
          operationTask = operationController.finishLaunch(
            environmentId,
            operationTask.generation,
            operationTask.operationId,
            false
          );
        } catch {
          operationTask = operationController.get(environmentId);
        }
      }
      return {
        launched: false,
        operationTask,
        error:
          error instanceof Error && error.message
            ? `无法打开 ${plan.name} 卸载程序：${error.message}`
            : `无法打开 ${plan.name} 卸载程序`
      };
    } finally {
      activeDesktopOperationEntries.delete(entryKey);
    }
  });

  ipcMain.handle("download:start", async (_event, productId, artifact) => {
    try {
      if (artifact === undefined) {
        const catalogAuthorization = await authorizeCurrentCatalogProduct(productId);
        if (!catalogAuthorization.ok) return catalogAuthorization;
      }
      return await startManagedDownloadFromRequest(productId, artifact);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "无法启动下载任务",
        task:
          typeof productId === "string"
            ? reconcileManagedDownloadTask(productId)
            : null
      };
    }
  });
  ipcMain.handle("download:enqueue", async (_event, request) => {
    if (!validManagedDownloadQueueRequest(request) || !request || typeof request !== "object" || Array.isArray(request) ||
        !["productId", "artifact"].includes(Object.keys(request)[0]) ||
        !Object.keys(request).every((field) => ["productId", "artifact"].includes(field))) {
      return { ok: false, error: "下载队列请求无效" };
    }
    try {
      return publicManagedDownloadQueueResult(
        await startManagedDownloadFromRequest(request.productId, request.artifact),
        request.productId
      );
    } catch {
      return { ok: false, error: "无法加入下载队列" };
    }
  });
  ipcMain.handle("download:discover-packages", (_event, candidates) =>
    discoverDownloadedPackages(candidates)
  );
  ipcMain.handle("download:list", () => listManagedDownloadQueueTasks());
  ipcMain.handle("download:status", (_event, request) => {
    if (!validManagedDownloadQueueRequest(request, false) || !request || typeof request !== "object" || Array.isArray(request) ||
        Object.keys(request).length !== 1 || typeof request.productId !== "string") {
      return publicManagedDownloadQueueResult({ ok: false });
    }
    const task = reconcileManagedDownloadTask(request.productId);
    return publicManagedDownloadQueueResult(task ? { ok: true, task } : { ok: false });
  });
  ipcMain.handle("download:cancel", async (_event, request) => {
    return publicManagedDownloadQueueResult(await discardManagedDownload(request));
  });
  ipcMain.handle("download:retry", async (_event, request) => {
    if (!validManagedDownloadQueueRequest(request) || !request || typeof request !== "object" || Array.isArray(request) ||
        !Object.keys(request).every((field) => ["productId", "artifact"].includes(field))) {
      return { ok: false, error: "下载队列请求无效" };
    }
    try {
      return publicManagedDownloadQueueResult(
        await startManagedDownloadFromRequest(request.productId, request.artifact),
        request.productId
      );
    } catch {
      return { ok: false, error: "无法重试下载" };
    }
  });
  ipcMain.handle("download:refresh", async (_event, productId, artifact) => {
    try {
      if (typeof productId !== "string") {
        return { ok: false, error: "下载产品 ID 无效" };
      }
      if (getDesktopDownloadOnlyProfile(productId) || artifact !== undefined) {
        const catalogAuthorization =
          await authorizeCurrentDesktopDownloadOnlyProduct(productId, artifact);
        if (catalogAuthorization.ok) return startManagedDownload(productId, catalogAuthorization.plan);
        if (getDesktopDownloadOnlyProfile(productId)) return catalogAuthorization;
      }
      return startFreshManagedDownload(productId);
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "无法获取最新版安装包"
      };
    }
  });

  ipcMain.handle("download:pause", (_event, productId) =>
    typeof productId === "string"
      ? pauseManagedDownload(productId)
      : { ok: false, error: "下载产品 ID 无效" }
  );

  ipcMain.handle("download:discard", (_event, request) => discardManagedDownload(request));

  ipcMain.handle("download:get-task", (_event, productId) =>
    typeof productId === "string"
      ? reconcileManagedDownloadTask(productId)
      : null
  );

  ipcMain.handle("download:get-partial", (_event, productId) => {
    if (typeof productId !== "string") return null;
    const plan = resolveManagedDownloadPlan(productId);
    return plan ? reusablePartialDownload(productId, plan) : null;
  });

  ipcMain.handle("download:get-record", (_event, productId) => {
    return typeof productId === "string"
      ? trustedCompletedDownloadRecord(productId)
      : null;
  });

  ipcMain.handle("download:show-in-folder", async (_event, productId) => {
    if (typeof productId !== "string") {
      return { ok: false, error: "下载产品 ID 无效" };
    }
    try {
      const inspected = await inspectCompletedDownloadRecord(productId);
      if (!inspected.ok || !inspected.record) return inspected;
      shell.showItemInFolder(inspected.record.filePath);
      return { ok: true, filePath: inspected.record.filePath };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `无法打开安装包所在文件夹：${error.message}`
            : "无法打开安装包所在文件夹"
      };
    }
  });

  ipcMain.handle("download:clear-history", async (_event, productId) => {
    if (typeof productId !== "string") {
      return { ok: false, error: "下载产品 ID 无效" };
    }
    if (managedDownloadRefreshPending || hasManagedDownloadWork()) {
      return { ok: false, error: "安装包任务正在处理，请稍后重试" };
    }
    managedDownloadRefreshPending = true;
    try {
      return await clearCompletedDownloadHistory(productId);
    } finally {
      managedDownloadRefreshPending = false;
    }
  });
  ipcMain.handle("download:clear-completed", async () => {
    if (managedDownloadRefreshPending || hasManagedDownloadWork()) {
      return { ok: false, error: "安装包任务正在处理，请稍后重试" };
    }
    managedDownloadRefreshPending = true;
    try {
      return await clearAllCompletedDownloadHistories();
    } finally {
      managedDownloadRefreshPending = false;
    }
  });
  ipcMain.handle("download:delete-package", async (_event, productId) => {
    if (typeof productId !== "string") {
      return { ok: false, error: "安装包产品 ID 无效" };
    }
    if (managedDownloadRefreshPending || hasManagedDownloadWork()) {
      return { ok: false, error: "安装包任务正在处理，不能删除安装包" };
    }
    managedDownloadRefreshPending = true;
    try {
      const inspected = await inspectCompletedDownloadRecord(productId);
      if (!inspected.ok || !inspected.record) {
        return {
          ok: false,
          error: inspected.error || "本地安装包不存在或不可信"
        };
      }
      const record = inspected.record;
      const confirmation = await showLocalizedMessageBox({
        type: "warning",
        title: "删除安装包",
        message: "确认删除这个本地安装包？",
        detail: record.filePath,
        buttons: ["取消", "删除安装包"],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      if (confirmation.response !== 1) {
        return { ok: false, canceled: true };
      }
      return removeTrustedCompletedPackage(productId, record);
    } finally {
      managedDownloadRefreshPending = false;
    }
  });

  ipcMain.handle("installer:launch", async (_event, productId, intent) => {
    if (typeof productId !== "string") {
      return { launched: false, error: "安装产品 ID 无效" };
    }
    if (!resolveDesktopInstallerLaunchPolicy(intent)) {
      return { launched: false, error: "安装操作类型无效" };
    }
    const launchPlan = resolveManagedDownloadPlan(productId);
    const launchRecord = readDownloadRecords()[productId];
    const catalogAuthorization =
      launchPlan?.downloadPolicy === "desktop-download-only"
        ? await authorizeCurrentDesktopDownloadOnlyProduct(productId, {
            url: launchRecord?.url,
            fileName: launchRecord?.fileName,
            artifactKind: launchRecord?.artifactKind,
            ...(Array.isArray(launchRecord?.mirrors)
              ? { mirrors: launchRecord.mirrors }
              : {})
          })
        : await authorizeCurrentCatalogProduct(productId);
    if (!catalogAuthorization.ok) {
      return { launched: false, ...catalogAuthorization };
    }

    const downloadTask = currentManagedDownloadTask(productId);
    const retainedCompletedRecord = trustedCompletedDownloadRecord(productId);
    if (
      downloadTask &&
      downloadTask.phase !== "completed" &&
      (activeDownloads.has(productId) || !retainedCompletedRecord)
    ) {
      return {
        launched: false,
        busy: true,
        error: "安装包尚未下载完成"
      };
    }

    const operationController = getDesktopOperationController();
    let existingOperation = operationController.get(productId);
    if (existingOperation?.operation === "install") {
      try {
        cleanupLegacyPortableInstallArtifacts(productId);
      } catch (error) {
        console.error("Unable to clean legacy portable staging files", error);
      }
      await operationController.finishProcess(
        productId,
        existingOperation.generation,
        existingOperation.operationId,
        { exitCode: 0, signal: null }
      );
      existingOperation = operationController.get(productId);
    }
    if (existingOperation) {
      return {
        launched: false,
        busy: true,
        error: "该产品正在卸载，请稍后再试",
        operationTask: existingOperation
      };
    }
    if (activeDesktopOperationEntries.has(productId)) {
      return {
        launched: false,
        busy: true,
        error: "正在打开安装包，请勿重复点击"
      };
    }

    activeDesktopOperationEntries.add(productId);
    try {
      const inspected = await inspectCompletedDownloadRecord(productId);
      if (!inspected.ok || !inspected.record) {
        return {
          launched: false,
          error: inspected.error || "未找到已下载的安装包"
        };
      }
      const resolvedFile = path.resolve(inspected.record.filePath);
      let stat;
      try {
        stat = fs.lstatSync(resolvedFile);
      } catch {
        stat = null;
      }
      if (
        !path.isAbsolute(resolvedFile) ||
        !/\.(exe|msi|msix|zip)$/i.test(resolvedFile) ||
        !stat?.isFile() ||
        stat.isSymbolicLink()
      ) {
        return { launched: false, error: "本地安装包不存在，请重新下载" };
      }

      const managedDownload = getStaticManagedDownload(productId);
      if (managedDownload?.installerKind === "store-bootstrapper") {
        const confirmation = await showDesktopInstallConfirmation({
          language: readSettings().language,
          fileName: path.basename(resolvedFile),
          installerKind: managedDownload.installerKind
        });
        const confirmationAction = getDesktopInstallConfirmationAction(
          managedDownload.installerKind,
          confirmation.response
        );
        if (confirmationAction === "repair-store") {
          return {
            launched: false,
            canceled: true,
            storeRepair: await runMicrosoftStoreRepairTool()
          };
        }
        if (confirmationAction !== "launch") {
          return { launched: false, canceled: true };
        }
      }

      const openError = await shell.openPath(resolvedFile);
      return openError
        ? { launched: false, error: `无法打开安装包：${openError}` }
        : {
            launched: true,
            verificationMode: "manual-installer"
          };
    } catch (error) {
      return {
        launched: false,
        error:
          error instanceof Error && error.message
            ? `无法打开安装包：${error.message}`
            : "无法打开安装包"
      };
    } finally {
      activeDesktopOperationEntries.delete(productId);
    }
  });
  ipcMain.handle("desktop:operation-get", (_event, productId) =>
    typeof productId === "string"
      ? desktopOperationForRenderer(productId)
      : null
  );

  ipcMain.handle(
    "desktop:operation-check",
    (_event, productId, generation, operationId) =>
      typeof productId === "string" &&
      Number.isSafeInteger(generation) &&
      generation > 0 &&
      typeof operationId === "string" &&
      operationId.trim() === operationId &&
      operationId.length > 0
        ? getDesktopOperationController().checkNow(
            productId,
            generation,
            operationId
          )
        : null
  );

  ipcMain.handle("desktop:status", async (_event, productId) =>
    publishedDesktopStatus(productId, await detectDesktopProduct(productId))
  );

  ipcMain.handle("desktop:update", async (_event, productId) => {
    const status = await detectDesktopProduct(productId);
    const version = String(status.availableVersion || "").trim();
    assertSoftwareUpdatePublished({
      kind: "product",
      subjectId: productId,
      mode: "package-manager",
      version
    });
    return reconcileWindowsPackageManagerProduct(productId, "update");
  });

  ipcMain.handle("desktop:uninstall", async (_event, productId) => {
    if (portableDesktopPlan(getStaticManagedDownload(productId))) {
      const operationController = getDesktopOperationController();
      const existingOperation = operationController.get(productId);
      if (existingOperation) {
        return {
          launched: false,
          busy: true,
          error:
            existingOperation.operation === "install"
              ? "该产品仍在确认安装结果，不能同时卸载"
              : "该产品正在卸载，无需重复点击",
          operationTask: existingOperation
        };
      }
      if (activeDesktopOperationEntries.has(productId)) {
        return { launched: false, busy: true, error: "该产品正在处理" };
      }
      activeDesktopOperationEntries.add(productId);
      try {
        const authorized = await runFreshCatalogAuthorizedOperation({
          productId,
          authorize: authorizeCurrentCatalogProduct,
          operation: () => uninstallPortableDesktopProduct(productId)
        });
        return authorized.authorized
          ? authorized.value
          : { launched: false, ...authorized.authorization };
      } finally {
        activeDesktopOperationEntries.delete(productId);
      }
    }
    if (windowsPackageManagerPlan(productId)) {
      return await uninstallWindowsPackageManagerProduct(productId);
    }
    const probe = DESKTOP_PROBES[productId];
    if (!probe?.uninstall && !probe?.appx) {
      return {
        launched: false,
        error: "该产品尚未通过客户端卸载安全审核"
      };
    }
    const operationController = getDesktopOperationController();
    const existingOperation = operationController.get(productId);
    if (existingOperation) {
      return {
        launched: false,
        busy: true,
        error:
          existingOperation.operation === "install"
            ? "该产品仍在自动检测安装结果，不能同时启动卸载程序"
            : "该产品仍在自动确认卸载结果，无需重复启动卸载程序",
        operationTask: existingOperation
      };
    }
    if (activeDesktopOperationEntries.has(productId)) {
      return {
        launched: false,
        busy: true,
        error: "该产品的桌面操作正在准备，请勿重复点击"
      };
    }
    activeDesktopOperationEntries.add(productId);
    let operationTask = null;
    let processSpawned = false;
    try {
      if (probe.appx && !probe.uninstall) {
        return await uninstallTrustedAppxProduct(
          productId,
          probe,
          operationController
        );
      }
      const registryScan = await scanRegistryAppsWithStatus();
      if (!registryScan.ok) {
        return {
          launched: false,
          error: "Windows 卸载项扫描不完整，请稍后重新检测"
        };
      }
      const managedContext = managedRegistryDesktopContext(productId);
      const managedReceiptPresent = Boolean(
        managedContext &&
          fs.existsSync(managedRegistryDesktopReceiptPath(productId))
      );
      let managedInstance = managedReceiptPresent
        ? await inspectManagedRegistryDesktopInstance(productId, registryScan)
        : null;
      let record = managedReceiptPresent
        ? managedInstance?.status?.installed &&
          managedInstance.status.uninstallAction
          ? {
              action: managedInstance.status.uninstallAction,
              entry: {
                key: managedInstance.receipt.registryKey,
                displayname: managedInstance.receipt.displayName,
                displayversion: managedInstance.receipt.displayVersion,
                publisher: managedInstance.receipt.publisher,
                installlocation: managedInstance.receipt.installLocation
              },
              location: managedInstance.receipt.installLocation
            }
          : null
        : trustedDesktopUninstallRecord(productId, registryScan.entries);
      if (!record) {
        if (managedReceiptPresent) {
          return {
            launched: false,
            error: "枕星AI助手 安装收据与当前软件实例不一致，已停止卸载"
          };
        }
        if (probe.appx) {
          return await uninstallTrustedAppxProduct(
            productId,
            probe,
            operationController
          );
        }
        return {
          launched: false,
          error: "未找到名称、发布者和安装位置均匹配的可信卸载项"
        };
      }

      const { entry, location } = record;
      const productName = String(entry.displayname || probe.names[0]);
      const signature = await verifyTrustedDesktopUninstaller(record, probe);
      if (!signature.ok) {
        return {
          launched: false,
          error: "卸载程序数字签名与预期厂商不匹配，已拒绝执行"
        };
      }
      const uninstallPresentation = getDesktopUninstallPresentation(
        productId,
        probe.uninstallMode,
        readSettings().language
      );
      const confirmation = await showDesktopUninstallConfirmation({
        productId,
        mode: probe.uninstallMode,
        language: readSettings().language,
        surface: "vendor-uninstaller",
        productName,
        version: entry.displayversion,
        publisher: entry.publisher,
        installLocation: location,
        executableName: path.basename(record.action.executable),
        signer: signature.signer
      });
      if (confirmation.response !== 1) {
        return { launched: false, canceled: true };
      }

      if (managedReceiptPresent) {
        const finalRegistryScan = await scanRegistryAppsWithStatus();
        if (!finalRegistryScan.ok) {
          return {
            launched: false,
            error: "Windows 卸载项扫描不完整，已停止卸载"
          };
        }
        managedInstance = await inspectManagedRegistryDesktopInstance(
          productId,
          finalRegistryScan
        );
        if (
          !managedInstance?.status?.installed ||
          !managedInstance.status.uninstallAction
        ) {
          return {
            launched: false,
            error: "枕星AI助手 安装收据在确认期间发生变化，已停止卸载"
          };
        }
        record = {
          action: managedInstance.status.uninstallAction,
          entry: {
            key: managedInstance.receipt.registryKey,
            displayname: managedInstance.receipt.displayName,
            displayversion: managedInstance.receipt.displayVersion,
            publisher: managedInstance.receipt.publisher,
            installlocation: managedInstance.receipt.installLocation
          },
          location: managedInstance.receipt.installLocation
        };
      }

      const finalSignature = await verifyTrustedDesktopUninstaller(record, probe);
      if (!finalSignature.ok) {
        return {
          launched: false,
          error: "卸载程序在确认期间发生变化，已拒绝执行"
        };
      }

      const adapter = getDesktopAdapterForProduct(productId);
      const closeResult = await closeReviewedProcesses(
        adapter?.closeProcessNames,
        adapter?.closeProcessStrategy
      );
      if (!closeResult.ok) {
        return {
          launched: false,
          error: closeResult.error || `无法关闭 ${productName}`
        };
      }

      operationTask = operationController.begin(productId, "uninstall");
      const identity = {
        generation: operationTask.generation,
        operationId: operationTask.operationId
      };
      const finishLaunch = (launched) => {
        operationTask = operationController.finishLaunch(
          productId,
          identity.generation,
          identity.operationId,
          launched
        );
        return operationTask;
      };
      const launchResult = await launchProcessWithGrace({
        command: record.action.executable,
        args:
          adapter?.uninstall?.launchArguments?.length > 0
            ? [...adapter.uninstall.launchArguments]
            : record.action.args,
        graceMs: 2_000,
        env: isolatedThirdPartyEnvironment(),
        processLabel: "卸载程序",
        onSpawn: () => {
          processSpawned = true;
          finishLaunch(true);
        },
        onProcessExit:
          adapter?.uninstallLifecycle === "foreground"
            ? async (result) => {
                operationTask = await operationController.finishProcess(
                  productId,
                  identity.generation,
                  identity.operationId,
                  result
                );
              }
            : null
      });
      if (!launchResult.launched) {
        let cleanupWarning = "";
        try {
          finishLaunch(false);
        } catch (cleanupError) {
          operationTask = operationController.get(productId);
          cleanupWarning =
            cleanupError instanceof Error
              ? `；且无法清理操作记录：${cleanupError.message}`
              : "；且无法清理操作记录";
        }
        return {
          ...launchResult,
          operationTask,
          error: `${launchResult.error || `无法打开 ${productName} 卸载程序`}${cleanupWarning}`
        };
      }

      let persistenceWarning = launchResult.warning || "";
      try {
        if (operationTask?.phase === "launching") {
          finishLaunch(true);
        }
      } catch (verificationError) {
        operationTask = operationController.get(productId);
        const message =
          verificationError instanceof Error
            ? `自动卸载检测任务暂时无法更新：${verificationError.message}`
            : "自动卸载检测任务暂时无法更新";
        persistenceWarning = persistenceWarning
          ? `${persistenceWarning}；${message}`
          : message;
      }
      return {
        ...launchResult,
        operationTask: operationController.get(productId) || operationTask,
        warning: persistenceWarning || undefined,
        uninstallMode: probe.uninstallMode,
        message: uninstallPresentation.launched
      };
    } catch (error) {
      if (operationTask && !processSpawned) {
        try {
          operationTask = operationController.finishLaunch(
            productId,
            operationTask.generation,
            operationTask.operationId,
            false
          );
        } catch {
          operationTask = operationController.get(productId);
        }
      }
      return {
        launched: false,
        operationTask,
        error:
          error instanceof Error && error.message
            ? `无法打开卸载程序：${error.message}`
            : "无法打开卸载程序"
      };
    } finally {
      activeDesktopOperationEntries.delete(productId);
    }
  });

  ipcMain.handle("desktop:open-location", async (_event, productId) => {
    const status = await detectDesktopProduct(productId);
    if (
      !status.installed ||
      !status.location ||
      !path.isAbsolute(status.location) ||
      !fs.existsSync(status.location)
    ) {
      return false;
    }
    return (await shell.openPath(status.location)) === "";
  });

  ipcMain.handle("desktop:close", async (_event, productId) => {
    if (portableDesktopPlan(getStaticManagedDownload(productId))) {
      const status = await detectDesktopProduct(productId);
      return status.installed && status.executable
        ? closeManagedPortableExecutable(status.executable)
        : {
            ok: false,
            closed: false,
            error: "未找到由枕星AI助手 管理的便携程序"
          };
    }
    if (windowsPackageManagerPlan(productId)) {
      return {
        ok: false,
        closed: false,
        error: "This package has no client-reviewed process close rule"
      };
    }
    const adapter = getDesktopAdapterForProduct(productId);
    return await closeReviewedProcesses(
      adapter?.closeProcessNames,
      adapter?.closeProcessStrategy
    );
  });

  ipcMain.handle("environment:open", async (_event, environmentId) => {
    const plan = getEnvironmentPlan(environmentId);
    if (!plan) return false;
    const status = await detectEnvironmentOperationStatus(environmentId);
    const action = createEnvironmentOpenAction({
      plan,
      status,
      commandExecutable: systemCommandPath("cmd.exe")
    });
    if (!action) return false;
    if (action.type === "shell-open") {
      return (await shell.openPath(action.executable)) === "";
    }
    try {
      const child = spawn(action.executable, action.args, action.options);
      child.unref();
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("environment:close", async (_event, environmentId) =>
    closeReviewedProcesses(ENVIRONMENT_CLOSE_PROCESSES[environmentId])
  );

  ipcMain.handle("desktop:open", async (_event, productId) => {
    const probe = DESKTOP_PROBES[productId];
    const status = await detectDesktopProduct(productId);
    if (!status.installed) return false;
    const portable = portableDesktopPlan(getStaticManagedDownload(productId));
    if (portable) {
      const receipt = readPortableDesktopRecord(productId);
      const trustedStatus = inspectPortableDesktop({
        productId,
        download: getStaticManagedDownload(productId),
        receipt,
        localAppData: process.env.LOCALAPPDATA || "",
        verifyIntegrity: true,
        hashFile: fileIntegritySync
      });
      if (!trustedStatus.installed || !trustedStatus.executable) return false;
      const signature = await verifyPortableExecutableTrust(
        trustedStatus.executable,
        portableDesktopTrustForReceipt(
          getStaticManagedDownload(productId),
          receipt
        )
      );
      if (!signature.ok) return false;
      try {
        const dataDirectory = trustedStatus.dataDirectory;
        ensureOwnedPortableDirectory(
          dataDirectory,
          path.dirname(dataDirectory)
        );
        const child = spawn(trustedStatus.executable, [], {
          cwd: path.dirname(trustedStatus.executable),
          detached: true,
          shell: false,
          stdio: "ignore",
          windowsHide: false,
          env: isolatedThirdPartyEnvironment()
        });
        child.unref();
        return true;
      } catch {
        return false;
      }
    }
    if (status.executable) {
      if (probe?.uninstall) {
        const signature = await verifyExpectedSignature(
          status.executable,
          probe.signer,
          true
        );
        if (!signature.ok) return false;
      }
      return (await shell.openPath(status.executable)) === "";
    }
    if (probe?.uninstall) return false;
    if (status.appId) {
      try {
        const launcher = spawn(
          "explorer.exe",
          [`shell:AppsFolder\\${status.appId}`],
          {
            detached: true,
            stdio: "ignore",
            windowsHide: false
          }
        );
        launcher.unref();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  });

  ipcMain.handle("cli:status", async (_event, productId) =>
    publishedCliStatus(productId, await discoverCliStatus(productId))
  );
  ipcMain.handle("cli:open", (_event, productId) =>
    openManagedCliTerminal(productId)
  );
  ipcMain.handle("cli:open-location", async (_event, productId) => {
    const status = getCliStatus(productId);
    if (!status.installed || !status.directory) return false;
    try {
      const location = fs.realpathSync.native(status.directory);
      if (!path.isAbsolute(location) || !fs.statSync(location).isDirectory()) {
        return false;
      }
      return (await shell.openPath(location)) === "";
    } catch {
      return false;
    }
  });

  ipcMain.handle("task-notification:cli", (_event, payload) => {
    const normalized = normalizeCliTaskNotification(
      payload,
      CLI_INSTALL_PLANS
    );
    if (!normalized) return false;
    const plan = CLI_INSTALL_PLANS[normalized.productId];
    const action = {
      install: "安装",
      update: "更新",
      repair: "修复",
      uninstall: "卸载"
    }[normalized.operation];
    const succeeded = normalized.outcome === "completed";
    return showTaskNotification({
      key: `cli:${normalized.productId}:${normalized.generation}:${normalized.operation}:${normalized.outcome}`,
      productId: normalized.productId,
      title: `${plan.name} ${action}${succeeded ? "完成" : "失败"}`,
      body: succeeded
        ? "点击返回对应厂商产品页。"
        : "点击返回产品页或任务中心重试。"
    });
  });

  ipcMain.handle("tray:update-cli-task", (_event, payload) => {
    const normalized = normalizeCliTrayTask(payload, CLI_INSTALL_PLANS);
    if (!normalized) return false;
    const name = CLI_INSTALL_PLANS[normalized.productId].name;
    setTrayTaskState(
      `cli:${normalized.productId}`,
      `${name} ${runtimeText(
        normalized.operation === "uninstall"
          ? "TASK_UNINSTALLING"
          : "TASK_DEPLOYING",
        readSettings().language
      )}`,
      normalized.phase === "running"
    );
    return true;
  });

  ipcMain.handle("cli:reconcile", (event, productId, intent) => {
    if (intent === "update") {
      assertSoftwareUpdatePublished({
        kind: "product",
        subjectId: productId,
        mode: "managed-cli",
        version: cliPlanVersion(CLI_INSTALL_PLANS[productId])
      });
    }
    return reconcileManagedCli(event, productId, intent);
  });
  ipcMain.handle("cli:deploy", (event, productId) =>
    reconcileManagedCli(event, productId, "install")
  );

  ipcMain.handle("cli:uninstall", async (event, productId) => {
    const plan = CLI_INSTALL_PLANS[productId];
    if (!plan) {
      return { ok: false, error: "该产品不在客户端 CLI 管理白名单中" };
    }
    if (activeCliProducts.has(productId)) {
      return { ok: false, error: "该工具正在执行安装或卸载操作" };
    }
    activeCliProducts.add(productId);
    try {
      return await CLI_DRIVER_REGISTRY.uninstall({
        sender: event.sender,
        productId,
        plan
      });
    } finally {
      activeCliProducts.delete(productId);
    }
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: "#f4f8fb",
    title: BRAND.name,
    frame: false,
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: !app.isPackaged
    }
  });

  window.removeMenu();
  const appPage = path.join(__dirname, "..", "dist", "index.html");
  const communityOrigin = approvedCommunityOrigin(
    getClientServices().communityOrigin
  );
  window.webContents.on(
    "will-attach-webview",
    (event, webPreferences, params) => {
      const initialUrl = String(params.src || "");
      if (
        !isApprovedCommunityNavigation(initialUrl, communityOrigin) ||
        params.partition !== "persist:aihub-community"
      ) {
        event.preventDefault();
        return;
      }
      delete webPreferences.preload;
      delete webPreferences.preloadURL;
      webPreferences.nodeIntegration = false;
      webPreferences.nodeIntegrationInSubFrames = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      webPreferences.webSecurity = true;
      webPreferences.allowRunningInsecureContent = false;
      webPreferences.devTools = false;
    }
  );
  window.webContents.on("did-attach-webview", (_event, contents) => {
    contents.session.setPermissionCheckHandler(() => false);
    contents.session.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false)
    );
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//i.test(url) && !isApprovedCommunityNavigation(url, communityOrigin)) {
        void shell.openExternal(url);
      } else if (isApprovedCommunityNavigation(url, communityOrigin)) {
        void contents.loadURL(url);
      }
      return { action: "deny" };
    });
    contents.on("will-navigate", (event, url) => {
      if (isApprovedCommunityNavigation(url, communityOrigin)) return;
      event.preventDefault();
      if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    });
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url === pathToFileURL(appPage).href) return;
    event.preventDefault();
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
  });
  window.loadFile(appPage);
  window.once("ready-to-show", () => window.show());
  window.on("close", (event) => {
    if (
      !shouldHideWindowOnClose({
        isQuitting,
        trayAvailable: Boolean(tray && !tray.isDestroyed())
      })
    ) {
      return;
    }
    event.preventDefault();
    window.hide();
  });
  return window;
}

function showMainWindow() {
  let window = BrowserWindow.getAllWindows().find(
    (candidate) => !candidate.isDestroyed()
  );
  if (!window) window = createWindow();
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  return window;
}

function createTray() {
  if (tray && !tray.isDestroyed()) return tray;
  const trayIconPath = path.join(__dirname, "..", "build", "icon.png");
  try {
    tray = new Tray(trayIconPath);
    loadManagedDownloadTasks();
    for (const productId of managedDownloadTasks.keys()) {
      updateDownloadTrayTask(reconcileManagedDownloadTask(productId));
    }
    updateTrayPresentation();
    tray.on("click", () =>
      trayTaskStates.size > 0 ? openTaskCenterFromTray() : showMainWindow()
    );
  } catch (error) {
    tray = null;
    console.error("Unable to create system tray", error);
  }
  return tray;
}

async function configureSystemNetwork() {
  await Promise.all([
    refreshManagedDownloadSession({ networkSession: session.defaultSession }),
    refreshManagedDownloadSession({ networkSession: managedDownloadSession() })
  ]);
}

function managedDownloadSession() {
  return session.fromPartition("aihub-managed-downloads", { cache: false });
}

function managedDownloadTransport() {
  if (!managedDownloadTransportInstance) {
    managedDownloadTransportInstance = createManagedDownloadTransport({
      networkSession: managedDownloadSession(),
      retries: 3
    });
  }
  return managedDownloadTransportInstance;
}

async function fetchReviewedDownload({ url, options, isAllowedFinalUrl }) {
  return await managedDownloadTransport().fetch({
    url,
    options,
    isAllowedFinalUrl
  });
}

function configureLocalReleaseCertificateTrust() {
  let trust;
  try {
    trust = readLocalReleaseTrust({
      resourcesPath: process.resourcesPath,
      acceptanceBuild: app.isPackaged && LOCAL_RELEASE_ACCEPTANCE
    });
  } catch (error) {
    if (LOCAL_RELEASE_ACCEPTANCE) {
      throw new Error(
        `本地发布证书配置不可用：${error instanceof Error ? error.message : "未知错误"}`
      );
    }
    return;
  }
  if (!trust) return;
  for (const networkSession of [
    session.defaultSession,
    managedDownloadSession()
  ]) {
    networkSession.setCertificateVerifyProc((request, callback) => {
      const accepted = shouldTrustLocalReleaseCertificate(trust, request);
      try {
        fs.appendFileSync(
          path.join(app.getPath("userData"), "local-release-certificate.log"),
          `${JSON.stringify({
            at: new Date().toISOString(),
            hostname: request.hostname,
            fingerprint: request.certificate?.fingerprint || "",
            verificationResult: request.verificationResult,
            accepted
          })}\n`,
          "utf8"
        );
      } catch {
        // Acceptance diagnostics must not change certificate verification.
      }
      callback(resolveCertificateVerificationCode(trust, request));
    });
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });

  app
    .whenReady()
    .then(async () => {
      if (process.platform === "win32") {
        app.setAppUserModelId(BRAND.legacyAppId);
      }
      configureLocalReleaseCertificateTrust();
      await configureSystemNetwork();
      const supersededCleanup =
        await retryPersistedSupersededPackageCleanup();
      if (!supersededCleanup.cleanup.ok) {
        console.error(
          "Unable to finish superseded managed installer cleanup",
          supersededCleanup.cleanup.error || supersededCleanup.cleanup.results
        );
      }
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(false)
      );
      managedDownloadSession().setPermissionCheckHandler(() => false);
      managedDownloadSession().setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(false)
      );
      initializeExtensionRuntime();
      registerIpc();
      createWindow();
      createTray();
      try {
        getDesktopOperationController().resume();
      } catch (error) {
        console.error("Unable to resume desktop operations", error);
      }
      try {
        getEnvironmentOperationController().resume();
      } catch (error) {
        console.error("Unable to resume environment operations", error);
      }
      app.on("activate", () => {
        showMainWindow();
      });
    })
    .catch((error) => {
      console.error("ZhenXing AI Assistant failed to initialize", error);
      app.quit();
    });

  app.on("before-quit", () => {
    isQuitting = true;
    discardManagedDownloadQueueOnExit();
    if (tray && !tray.isDestroyed()) tray.destroy();
    tray = null;
    desktopOperationController?.dispose();
    environmentOperationController?.dispose();
  });

  app.on("window-all-closed", () => {
    if (
      !shouldKeepAppAlive({
        platform: process.platform,
        isQuitting,
        trayAvailable: Boolean(tray && !tray.isDestroyed())
      })
    ) {
      app.quit();
    }
  });
}
