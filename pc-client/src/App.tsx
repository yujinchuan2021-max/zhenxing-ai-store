import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import IconArrowLeft from "@tabler/icons-react/dist/esm/icons/IconArrowLeft.mjs";
import IconBell from "@tabler/icons-react/dist/esm/icons/IconBell.mjs";
import IconBuildingStore from "@tabler/icons-react/dist/esm/icons/IconBuildingStore.mjs";
import IconChevronRight from "@tabler/icons-react/dist/esm/icons/IconChevronRight.mjs";
import IconDownload from "@tabler/icons-react/dist/esm/icons/IconDownload.mjs";
import IconExternalLink from "@tabler/icons-react/dist/esm/icons/IconExternalLink.mjs";
import IconHome from "@tabler/icons-react/dist/esm/icons/IconHome.mjs";
import IconLayoutGrid from "@tabler/icons-react/dist/esm/icons/IconLayoutGrid.mjs";
import IconLink from "@tabler/icons-react/dist/esm/icons/IconLink.mjs";
import IconMessages from "@tabler/icons-react/dist/esm/icons/IconMessages.mjs";
import IconPlus from "@tabler/icons-react/dist/esm/icons/IconPlus.mjs";
import IconPlugConnected from "@tabler/icons-react/dist/esm/icons/IconPlugConnected.mjs";
import IconPuzzle from "@tabler/icons-react/dist/esm/icons/IconPuzzle.mjs";
import IconRoute from "@tabler/icons-react/dist/esm/icons/IconRoute.mjs";
import IconSearch from "@tabler/icons-react/dist/esm/icons/IconSearch.mjs";
import IconSettings from "@tabler/icons-react/dist/esm/icons/IconSettings.mjs";
import IconSparkles from "@tabler/icons-react/dist/esm/icons/IconSparkles.mjs";
import IconX from "@tabler/icons-react/dist/esm/icons/IconX.mjs";
import {
  ActionIcon,
  AppShell,
  Burger,
  Button,
  Drawer,
  Modal,
  PasswordInput,
  Popover,
  Select,
  TextInput,
  useMantineColorScheme
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  Spotlight,
  spotlight,
  type SpotlightActionData
} from "@mantine/spotlight";
import { runEnvironmentInstall } from "@aihub-shared/environment-install-flow.cjs";
import { createEnvironmentInstallOrchestrator } from "@aihub-shared/environment-install-orchestrator.cjs";
import { runDownloadedPackageAction } from "@aihub-shared/downloaded-package-action.cjs";
import {
  reconcileDesktopInstalledEvidence,
  reconcileDesktopInventoryStage
} from "@aihub-shared/desktop-inventory-presentation.cjs";
import { resolveCompletedPackageInstallIntent } from "@aihub-shared/desktop-installer-launch-policy.cjs";
import {
  buildDownloadPopoverItems,
  createDownloadTaskRevisionTracker
} from "@aihub-shared/download-task-presentation.cjs";
import { loadDevelopmentCatalog } from "@aihub-shared/development-catalog.cjs";
import { buildInstalledProductManagement } from "@aihub-shared/installed-product-management.cjs";
import {
  resolveManagedProductActionContext,
  resolveManagedProductActionContexts
} from "@aihub-shared/managed-product-action-context.cjs";
import {
  getDownloadTaskPreparation,
  getProductDownloadRecoveryPresentation,
  getProductInstallPresentation
} from "@aihub-shared/product-install-presentation.cjs";
import { resolveProductBehavior } from "@aihub-shared/product-policy.cjs";
import { getDesktopUninstallPresentation } from "@aihub-shared/uninstall-presentation.cjs";
import { runVerifiedManagedInstall } from "@aihub-shared/verified-managed-install.cjs";
import { buildProductDirectory } from "@aihub-shared/product-components.cjs";
import { goBackOrFallback } from "@aihub-shared/navigation-back.cjs";
import {
  classifyCommunityLoadFailure,
  communityProfileSyncKey
} from "@aihub-shared/community-embed.cjs";
import { resolveOfficialDownloadUrl } from "@aihub-shared/official-download-page.cjs";
import {
  isAllowedCarouselActionHref,
  resolveCarouselImageUrl,
  selectHomeCarouselSlides
} from "@aihub-shared/home-carousel-presentation.cjs";
import {
  projectVendorsByDirectory,
  searchCatalog
} from "@aihub-shared/catalog-projections.cjs";
// @ts-expect-error The frozen CommonJS projection is consumed through the typed seam below.
import { createResourceMarketplace } from "@aihub-shared/resource-marketplace.cjs";
import {
  resourceRiskLevel,
  resourceProvenancePresentation,
  resourceReviewStatus,
  resourceSourceChannel,
  resourceTargetPresentation
} from "@aihub-shared/resource-store.cjs";
import {
  MATURE_AGENT_CHANNEL,
  SCENARIO_TAGS
} from "@aihub-shared/catalog-taxonomy.cjs";
import { BRAND } from "@aihub-shared/brand.cjs";
import packageJson from "../package.json";
import { catalogDisplayField } from "./catalog-localization.cjs";
import {
  createLanguage,
  normalizeLanguage,
  runtimeMessage,
  setActiveLanguage,
  uiText,
  type Language,
  type LanguageKey
} from "./language";
import {
  Product,
  ProductCategory,
  ProductDirectoryKind,
  EcosystemResource,
  ResourceConnection,
  ResourceStore,
  ResourceStoreKind,
  ResourceTarget,
  ProductKind,
  Vendor,
  resourceStores as builtInResourceStores,
  resources as builtInResources,
  vendors as builtInVendors
} from "./data";

type View =
  | "home"
  | "vendors"
  | "resources"
  | "search"
  | "community"
  | "contribution"
  | "workflow-public-store"
  | "management"
  | "account";
type CommunityParentView = Exclude<View, "community">;
type ProductStage =
  | "idle"
  | "blocked"
  | "ready"
  | "downloading"
  | "paused"
  | "detecting"
  | "deploying"
  | "removing-cli"
  | "downloaded"
  | "launching-installer"
  | "awaiting-verification"
  | "awaiting-uninstall"
  | "detection-error"
  | "error"
  | "installed";
type ProductPreparation =
  | "active"
  | "blocked"
  | "ready"
  | "downloaded"
  | "installed"
  | "error";
type ManagedInstallIntent = "install" | "reinstall" | "refresh";
type PendingDownloadCancellation = {
  source: "queue" | "legacy";
  productId: string;
  taskId: string;
  productName: string;
  receivedBytes: number;
  trigger: HTMLElement | null;
  afterConfirm?: "relocate";
};
type CliManagedOperation = "install" | "update" | "repair" | "uninstall";
type FixedCliLifecycleOperation = "install" | "update" | "repair" | "uninstall";
type CliManagedTask = {
  productId: string;
  generation: number;
  operation: CliManagedOperation;
  phase: "running" | "completed" | "failed" | "canceled";
  message: string;
  updatedAt: string;
};
type EnvironmentPackageStage =
  | "idle"
  | "probing"
  | "downloading"
  | "paused"
  | "download-error"
  | "ready"
  | "opening-install"
  | "awaiting-install"
  | "timed-out-install"
  | "opening-uninstall"
  | "awaiting-uninstall"
  | "timed-out-uninstall";

const ENVIRONMENT_BUSY_STAGES = new Set<EnvironmentPackageStage>([
  "probing",
  "downloading",
  "opening-install",
  "awaiting-install",
  "opening-uninstall",
  "awaiting-uninstall"
]);

const FIXED_CLI_LIFECYCLE_PRODUCT_IDS = new Set([
  "google-antigravity-cli",
  "moonshot-kimi-code-cli",
  "amp-cli",
  "daytona-cli"
]);

const ALL_FILTER = "全部" as const;
const RESOURCE_SOURCE_CHANNELS = ["official", "community"] as const;
const RESOURCE_COMPATIBILITY_FILTERS = [
  "all",
  "official",
  "verified",
  "protocol-compatible"
] as const;
const RESOURCE_TYPE_OUTCOME_KEYS: Record<ResourceStoreKind, readonly LanguageKey[]> = {
  skill: [
    "resources.outcome.skill.reuse",
    "resources.outcome.skill.consistency"
  ],
  mcp: [
    "resources.outcome.mcp.context",
    "resources.outcome.mcp.flow"
  ],
  plugin: [
    "resources.outcome.plugin.extend",
    "resources.outcome.plugin.reuse"
  ],
  connector: [
    "resources.outcome.connector.authorize",
    "resources.outcome.connector.sync"
  ]
};
const RESOURCE_SCENARIO_TAG_IDS = new Set(
  SCENARIO_TAGS.map(({ id }: { id: string }) => id)
);
const CONTRIBUTION_SCOPES = [
  "vendor",
  "agent",
  "skill",
  "mcp",
  "plugin",
  "connector",
  "workflow"
] as const;
type ResourceSourceChannel = (typeof RESOURCE_SOURCE_CHANNELS)[number];
type ResourceCompatibilityFilter = (typeof RESOURCE_COMPATIBILITY_FILTERS)[number];
type ResourceMarketplaceEntry = {
  resource: EcosystemResource;
  publisher: { id: string | null; name: string } | null;
  hosts: Array<{ target: ResourceTarget; product: Product; vendor: Vendor }>;
  connections: ResourceConnection[];
};
type ResourceMarketplace = {
  browse: (query?: {
    store?: ResourceStoreKind | "all";
    category?: string;
    hostId?: string;
    source?: ResourceSourceChannel | "all";
    compatibility?: ResourceCompatibilityFilter;
  }) => ResourceMarketplaceEntry[];
  detail: (resourceId: string) => ResourceMarketplaceEntry | null;
  facets: (query?: {
    store?: ResourceStoreKind | "all";
    source?: ResourceSourceChannel | "all";
  }) => {
    scenarios: Record<string, number>;
    compatibility: Record<Exclude<ResourceCompatibilityFilter, "all">, number>;
  };
};

function resourceOutcomeKeys(resource: EcosystemResource): LanguageKey[] {
  const typeOutcomes = resource.resourceTypes.flatMap(
    (resourceType) => RESOURCE_TYPE_OUTCOME_KEYS[resourceType] || []
  );
  const scenarioOutcomes = (resource.scenarioTags || [])
    .filter((scenarioTag) => RESOURCE_SCENARIO_TAG_IDS.has(scenarioTag))
    .map((scenarioTag) =>
      `resources.outcome.scenario.${scenarioTag}` as LanguageKey
    );
  return [...new Set([...typeOutcomes, ...scenarioOutcomes])].slice(0, 6);
}
const createMarketplace = createResourceMarketplace as (input: {
  resources: EcosystemResource[];
  vendors: Vendor[];
  connections?: ResourceConnection[];
}) => ResourceMarketplace;

type CatalogSearchResults = {
  query: string;
  vendors: Array<{
    vendor: Vendor;
    products: Product[];
    directoryKind: ProductDirectoryKind;
  }>;
  resources: Array<{
    store: ResourceStore;
    resource: EcosystemResource;
    target: ResourceTarget;
    product: Product;
    vendor: Vendor;
  }>;
};

function environmentStageIsBusy(stage?: EnvironmentPackageStage) {
  return stage ? ENVIRONMENT_BUSY_STAGES.has(stage) : false;
}

function environmentStageNeedsCheck(stage?: EnvironmentPackageStage) {
  return stage === "timed-out-install" || stage === "timed-out-uninstall";
}

function environmentInstallButtonLabel(
  stage: EnvironmentPackageStage | undefined,
  environmentName: string,
  idleLabel: string
) {
  switch (stage) {
    case "probing":
      return uiText("auto.94f0baff28f4");
    case "downloading":
      return uiText("auto.2a63d718ac48", { value1: environmentName });
    case "paused":
      return uiText("auto.7730fe6c7fbe");
    case "download-error":
      return uiText("auto.87dd9db3387c");
    case "ready":
      return uiText("auto.1c9b810ab5b0");
    case "opening-install":
      return uiText("auto.d81b40f55a7e");
    case "awaiting-install":
      return uiText("auto.03fdb4985739");
    case "opening-uninstall":
      return uiText("auto.5e85ee12a76b");
    case "awaiting-uninstall":
      return uiText("auto.eea53c4becb5");
    case "timed-out-install":
    case "timed-out-uninstall":
      return uiText("auto.14ca09ce1fd2");
    default:
      return idleLabel;
  }
}

function environmentUninstallButtonLabel(
  stage?: EnvironmentPackageStage
) {
  switch (stage) {
    case "opening-install":
      return uiText("auto.d81b40f55a7e");
    case "awaiting-install":
      return uiText("auto.6c862ecfce82");
    case "opening-uninstall":
      return uiText("auto.5e85ee12a76b");
    case "awaiting-uninstall":
      return uiText("auto.eea53c4becb5");
    case "timed-out-install":
    case "timed-out-uninstall":
      return uiText("auto.14ca09ce1fd2");
    default:
      return uiText("auto.3f4f6f0b49c4");
  }
}

function desktopUpdateOwnerLabel(updateOwner?: string) {
  if (!updateOwner) return "";
  return updateOwner.includes("microsoft-store")
    ? uiText("desktop.updateManagedByStore")
    : uiText("desktop.updateManagedByVendor");
}

function managedDownloadPhaseLabel(task: ManagedDownloadTask) {
  switch (task.phase) {
    case "starting":
      return uiText("auto.d0274ba5736a");
    case "downloading":
      return uiText("auto.06b2117d58cc");
    case "pausing":
      return uiText("auto.7c78a6c31980");
    case "paused":
      return uiText("auto.eb0c326b60ae");
    case "canceling":
      return uiText("auto.0b58e0113da6");
    case "failed":
      return uiText("auto.8a03e35ad323");
    case "completed":
      return uiText("auto.f28461bb49c8");
    default:
      return uiText("auto.a37778f17c5f");
  }
}

function managedDownloadErrorLabel(task: ManagedDownloadTask) {
  return task.errorCode === "DOWNLOAD_CONNECTION_FAILED" ||
    /(?:net::)?ERR_/i.test(task.errorMessage || "")
    ? uiText("download.connectionFailed")
    : runtimeMessage(
        task.errorMessage,
        task.errorCode,
        "runtime.downloadInternalError"
      );
}

function managedDownloadQueuePhaseLabel(task: ManagedDownloadQueueTask) {
  switch (task.phase) {
    case "queued":
      return uiText("downloadQueue.queued");
    case "downloading":
      return uiText("downloadQueue.downloading");
    case "downloaded":
      return uiText("downloadQueue.downloadedWait");
    case "cancelled":
      return uiText("downloadQueue.cancelled");
    default:
      return uiText("downloadQueue.failed");
  }
}

function hasManagedDownloadQueueApi() {
  const api = window.aihubPC;
  return Boolean(
    api &&
      "enqueueManagedDownload" in api &&
      "listManagedDownloadTasks" in api &&
      "getManagedDownloadTaskStatus" in api &&
      "cancelManagedDownload" in api &&
      "retryManagedDownload" in api
  );
}

function operationTaskPhaseLabel(
  operation: "install" | "uninstall",
  phase: DesktopOperationTask["phase"] | EnvironmentOperationTask["phase"]
) {
  if (phase === "installed") return uiText("auto.57cf47f232a8");
  if (phase === "uninstalled") return uiText("auto.caa61a1470e1");
  if (phase === "canceled") return uiText("desktop.installCanceled");
  if (phase === "failed") return uiText("desktop.installFailed");
  if (phase === "launching") {
    return operation === "install"
      ? uiText("auto.343372e2f5fa")
      : uiText("auto.ed63b6566fbb");
  }
  if (phase === "timed-out") {
    return operation === "install"
      ? uiText("auto.ee6feed3275c")
      : uiText("auto.a2ccef9b43bf");
  }
  return operation === "install" ? uiText("auto.4f8df3ce8b6a") : uiText("auto.da1524a00c1b");
}

function cliTaskPhaseLabel(task: CliManagedTask) {
  const deploying = task.operation !== "uninstall";
  if (task.phase === "running") {
    return deploying ? uiText("auto.c16fe800ef5d") : uiText("auto.3a3d21968447");
  }
  if (task.phase === "completed") {
    return deploying ? uiText("auto.53f17e6ef17f") : uiText("auto.6a075107a270");
  }
  if (task.phase === "canceled") return uiText("auto.9596d1ac92cd");
  return deploying ? uiText("auto.29d1d9dff3c7") : uiText("auto.7274d68dcc45");
}

const INSTALLATION_PRIORITY_STAGES = new Set<ProductStage>([
  "launching-installer",
  "awaiting-verification",
  "awaiting-uninstall",
  "installed"
]);

function preserveInstallationStage(
  current: ProductStage | undefined,
  fallback: ProductStage
) {
  return current && INSTALLATION_PRIORITY_STAGES.has(current)
    ? current
    : fallback;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(value) / Math.log(1024))
  );
  const amount = value / 1024 ** exponent;
  return `${amount >= 10 || exponent < 2 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return uiText("auto.28a8e216754d");
  if (seconds < 60) return uiText("auto.8e9c8e4d3e42", { value1: Math.max(1, Math.round(seconds)) });
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? uiText("auto.d28542b54a1e", { value1: minutes }) : uiText("auto.496ff0810302", { value1: Math.ceil(minutes / 60) });
}
const ENVIRONMENT_NAMES: Record<string, string> = {
  node: "Node.js",
  git: "Git",
  python: "Python 3.13",
  python312: "Python 3.12",
  docker: "Docker",
  wsl: "WSL"
};

async function prepareAvatarImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(uiText("auto.845503516821"));
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error(uiText("auto.a19801a42127"));
  }
  const bitmap = await createImageBitmap(file);
  try {
    const crop = Math.min(bitmap.width, bitmap.height);
    const sourceX = Math.floor((bitmap.width - crop) / 2);
    const sourceY = Math.floor((bitmap.height - crop) / 2);
    for (const [size, quality] of [
      [512, 0.84],
      [384, 0.78],
      [320, 0.72]
    ] as const) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error(uiText("auto.7635afac978f"));
      context.drawImage(
        bitmap,
        sourceX,
        sourceY,
        crop,
        crop,
        0,
        0,
        size,
        size
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (blob && blob.size <= 384 * 1024) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error(uiText("auto.5ca5aa5f6f01")));
          reader.readAsDataURL(blob);
        });
      }
    }
    throw new Error(uiText("auto.4603edb8f99b"));
  } finally {
    bitmap.close();
  }
}

const browserEnvironmentFallback: EnvironmentReport = {
  platform: "win32",
  architecture: "x64",
  checkedAt: "",
  checks: [
    { id: "node", name: "Node.js", installed: false, location: "" },
    { id: "git", name: "Git", installed: false, location: "" },
    { id: "python", name: "Python", installed: false, location: "" },
    { id: "docker", name: "Docker", installed: false, location: "" },
    { id: "wsl", name: "WSL", installed: false, location: "" }
  ]
};

function builtInBanners(language: Language): CatalogBanner[] {
  const text = createLanguage(language).text;
  return [
    {
      eyebrow: text("home.primaryBannerEyebrow"),
      title: text("home.primaryBannerTitle"),
      description: text("home.primaryBannerDescription"),
      action: text("home.primaryBannerAction")
    },
    {
      eyebrow: text("home.vendorBannerEyebrow"),
      title: text("home.vendorBannerTitle"),
      description: text("home.vendorDirectoryDescription"),
      action: text("home.vendorDirectoryAction")
    }
  ];
}

function builtInBrand(language: Language): CatalogBrand {
  return {
    name: BRAND.name,
    mark: BRAND.mark,
    slogan: createLanguage(language).text("brand.defaultSlogan")
  };
}

const BRAND_ICON_SRC = "/brand-icon.png";

function BrandMark() {
  return (
    <span className="brandMark" aria-hidden="true">
      <img src={BRAND_ICON_SRC} alt="" />
    </span>
  );
}

const CATALOG_REFRESH_TTL_MS = 60_000;

function sortCatalogVendors(vendors: Vendor[]) {
  return vendors
    .map((vendor) => ({
      ...vendor,
      products: [...vendor.products].sort(
        (left, right) =>
          (left.order ?? 0) - (right.order ?? 0) ||
          left.name.localeCompare(right.name, "zh-CN")
      )
    }))
    .sort(
      (left, right) =>
        (left.order ?? 0) - (right.order ?? 0) ||
        left.name.localeCompare(right.name, "zh-CN")
    );
}

function visibleCatalogVendors(vendors: Vendor[]) {
  return vendors
    .filter((vendor) => vendor.enabled !== false)
    .map((vendor) => ({
      ...vendor,
      products: vendor.products.filter((product) => product.enabled !== false)
    }));
}

function vendorDisplayName(vendor: Vendor, language: Language) {
  const name = catalogDisplayField(vendor, "name", language);
  return vendor.requiresCrossBorderNetwork
    ? `${name}${uiText("vendor.requiresCrossBorderNetwork")}`
    : name;
}

function resourceStoreDisplayLabel(store: ResourceStore, language: Language) {
  return catalogDisplayField(store, "label", language);
}

function resourceCompatibilityLabel(
  compatibility: ResourceTarget["compatibility"]
) {
  if (compatibility === "official") {
    return uiText("resources.compatibility.official");
  }
  if (compatibility === "verified") {
    return uiText("resources.compatibility.verified");
  }
  return uiText("resources.compatibility.protocolCompatible");
}

function extensionStatusLabel(status: ExtensionRuntimeResult | null) {
  switch (status?.state) {
    case "installed": return uiText("extensions.installed");
    case "disabled": return uiText("extensions.disabled");
    case "outdated": return uiText("extensions.outdated");
    case "not-installed": return uiText("extensions.notInstalled");
    case "external": return uiText("extensions.external");
    case "stale": return uiText("extensions.stale");
    case "modified": return uiText("extensions.modified");
    case "unsafe": return uiText("extensions.unsafe");
    case "host-missing": return uiText("extensions.hostMissing");
    case "invalid-receipt": return uiText("extensions.invalidReceipt");
    default: return runtimeMessage(status?.error, undefined, "extensions.failed");
  }
}

function extensionActionLabel(action: ExtensionRuntimeAction, busy = false) {
  if (busy) return uiText("extensions.processing");
  switch (action) {
    case "install": return uiText("extensions.install");
    case "update": return uiText("extensions.update");
    case "repair": return uiText("extensions.repair");
    case "enable": return uiText("extensions.enable");
    case "disable": return uiText("extensions.disable");
    case "uninstall": return uiText("extensions.uninstall");
  }
}

function inferCatalogCategories(vendors: Vendor[]) {
  return [
    ...new Set(
      vendors.flatMap((vendor) =>
        vendor.products.map((product) => product.category)
      )
    )
  ];
}

const builtInCatalogVendors = sortCatalogVendors(builtInVendors);

export default function App() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [catalogAllVendors, setCatalogAllVendors] =
    useState<Vendor[]>(() => (window.aihubPC ? [] : builtInCatalogVendors));
  const [catalogVendors, setCatalogVendors] =
    useState<Vendor[]>(() =>
      window.aihubPC ? [] : visibleCatalogVendors(builtInCatalogVendors)
    );
  const [catalogResources, setCatalogResources] = useState<EcosystemResource[]>(
    () => (window.aihubPC ? [] : builtInResources)
  );
  const [catalogResourceConnections, setCatalogResourceConnections] =
    useState<ResourceConnection[]>([]);
  const [catalogResourceStores, setCatalogResourceStores] = useState<
    ResourceStore[]
  >(() => (window.aihubPC ? [] : builtInResourceStores));
  const [catalogCategories, setCatalogCategories] = useState<ProductCategory[]>(() =>
    inferCatalogCategories(window.aihubPC ? [] : builtInCatalogVendors)
  );
  const [catalogError, setCatalogError] = useState("");
  const [catalogStartupPending, setCatalogStartupPending] = useState(
    () => Boolean(window.aihubPC) || import.meta.env.DEV
  );
  const [catalogHomeBanners, setHomeBanners] =
    useState<CatalogBanner[]>([]);
  const [homeCarousel, setHomeCarousel] =
    useState<CatalogHomeCarousel | undefined>();
  const [catalogBrand, setBrand] = useState<CatalogBrand | null>(null);
  const [extraSections, setExtraSections] = useState<CatalogExtraSection[]>([]);
  const [catalogCommunity, setCatalogCommunity] =
    useState<CatalogCommunity | null>(null);
  const [featuredVendorIds, setFeaturedVendorIds] = useState<string[]>([]);
  const [view, setView] = useState<View>("home");
  const [vendorDirectory, setVendorDirectory] =
    useState<ProductDirectoryKind>("ai-tool");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedResourceStoreId, setSelectedResourceStoreId] =
    useState("skill");
  const [resourceStoreVisit, setResourceStoreVisit] = useState(0);
  const [resourceStoreSelection, setResourceStoreSelection] = useState({
    resourceId: ""
  });
  const [publicWorkflowPage, setPublicWorkflowPage] = useState<
    PublicWorkflowPage | null
  >(null);
  const [localAgentBridgeCapability, setLocalAgentBridgeCapability] =
    useState<LocalAgentBridgeCapability | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<
    typeof ALL_FILTER | ProductCategory
  >(ALL_FILTER);
  const [letter, setLetter] = useState<string>(ALL_FILTER);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const mobileViewport = useMediaQuery("(max-width: 47.99em)");
  const [authOpen, setAuthOpen] = useState(false);
  const [identity, setIdentity] = useState<IdentitySnapshot>({
    status: "anonymous"
  });
  const [personalCenter, setPersonalCenter] =
    useState<PersonalCenterSnapshot | null>(null);
  const [accountInitialTab, setAccountInitialTab] =
    useState<PersonalCenterTab>("profile");
  const [communityTargetPath, setCommunityTargetPath] = useState("");
  const [communityParentView, setCommunityParentView] =
    useState<CommunityParentView>("home");
  const theme: "light" | "dark" = colorScheme === "dark" ? "dark" : "light";
  const [language, setLanguage] = useState<Language>("zh");
  const homeBanners = catalogHomeBanners.length
    ? catalogHomeBanners
    : builtInBanners(language);
  const brand = catalogBrand || builtInBrand(language);
  const [downloadDirectory, setDownloadDirectory] = useState("");
  const [cliInstallDirectory, setCliInstallDirectory] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [softwareUpdateResult, setSoftwareUpdateResult] =
    useState<SoftwareUpdateCheckResult | null>(null);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateInstallMessage, setUpdateInstallMessage] = useState("");
  const [environmentMessages, setEnvironmentMessages] = useState<
    Record<string, string>
  >({});
  const [environmentPackageStages, setEnvironmentPackageStages] = useState<
    Record<string, EnvironmentPackageStage>
  >({});
  const [productStages, setProductStages] = useState<Record<string, ProductStage>>({});
  const [productMissing, setProductMissing] = useState<Record<string, string[]>>({});
  const [productProgress, setProductProgress] = useState<Record<string, number | null>>({});
  const [productDownloadDetails, setProductDownloadDetails] = useState<
    Record<string, DownloadProgress>
  >({});
  const [downloadTasks, setDownloadTasks] = useState<
    Record<string, ManagedDownloadTask>
  >({});
  const [managedDownloadQueueTasks, setManagedDownloadQueueTasks] = useState<
    Record<string, ManagedDownloadQueueTask>
  >({});
  const [pendingDownloadCancellation, setPendingDownloadCancellation] =
    useState<PendingDownloadCancellation | null>(null);
  const [downloadCancellationBusy, setDownloadCancellationBusy] = useState(false);
  const [desktopOperationTasks, setDesktopOperationTasks] = useState<
    Record<string, DesktopOperationTask>
  >({});
  const [environmentOperationTasks, setEnvironmentOperationTasks] = useState<
    Record<string, EnvironmentOperationTask>
  >({});
  const [productFiles, setProductFiles] = useState<Record<string, string>>({});
  const [desktopStatuses, setDesktopStatuses] = useState<
    Record<string, DesktopStatus>
  >({});
  const [localInventory, setLocalInventory] = useState<
    ClientInstallProfile[]
  >([]);
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [cliLogs, setCliLogs] = useState<Record<string, CliLogEntry[]>>({});
  const [cliVersions, setCliVersions] = useState<Record<string, string>>({});
  const [cliStatuses, setCliStatuses] = useState<Record<string, CliStatus>>({});
  const [cliManagedTasks, setCliManagedTasks] = useState<
    Record<string, CliManagedTask>
  >({});
  const [managementMessages, setManagementMessages] = useState<
    Record<string, string>
  >({});
  const downloadNotificationsReady = useRef(false);
  const downloadNotificationStates = useRef<Record<string, string>>({});
  const productOperationGenerations = useRef<Record<string, number>>({});
  const downloadTaskRevisions = useRef(createDownloadTaskRevisionTracker());
  const managedDownloadQueueEventRevisions = useRef(
    createDownloadTaskRevisionTracker()
  );
  const managedDownloadQueueSyncs = useRef(
    new Map<
      string,
      {
        generation: number;
        dirtyRevision: number;
        statusRevision: number;
        inFlight: boolean;
        taskId: string | null;
      }
    >()
  );
  const desktopOperationRevisions = useRef<
    Record<
      string,
      { generation: number; operationId: string; revision: number }
    >
  >({});
  const environmentOperationRevisions = useRef<
    Record<
      string,
      { generation: number; operationId: string; revision: number }
    >
  >({});
  const environmentOperations = useRef<
    Record<string, EnvironmentOperationTask>
  >({});
  const environmentScanGeneration = useRef(0);
  const installedEnvironmentEvidence = useRef<Set<string>>(new Set());
  const installedEvidenceProducts = useRef<Set<string>>(new Set());
  const recoveredProductIds = useRef<Set<string>>(new Set());
  const recoveredEnvironmentIds = useRef<Set<string>>(new Set());
  const initialInventoryRecovered = useRef(false);
  const activeProductActions = useRef<Set<string>>(new Set());
  const managedActionContextSnapshot = useRef({
    vendors: catalogAllVendors,
    localInventory
  });
  const automaticEnvironmentFlow = useRef(
    createEnvironmentInstallOrchestrator()
  );
  const pendingEnvironmentProducts = useRef<Map<string, Product>>(new Map());
  const autoOpenEnvironmentInstallers = useRef<Set<string>>(new Set());
  const advancingEnvironmentFlow = useRef(false);

  const languageModule = useMemo(() => createLanguage(language), [language]);
  const t = {
    home: languageModule.text("nav.home"),
    aiVendors: languageModule.text("nav.aiVendors"),
    connectableVendors: languageModule.text("nav.connectableVendors"),
    community: languageModule.text("nav.communityDiscussions"),
    navigation: languageModule.text("nav.navigation"),
    searchPlaceholder: languageModule.text("nav.searchPlaceholder"),
    search: languageModule.text("nav.search"),
    settings: languageModule.text("nav.settings"),
    login: languageModule.text("nav.login")
  };
  const aiVendors = useMemo(
    () =>
      projectVendorsByDirectory(catalogVendors, "ai-tool") as Vendor[],
    [catalogVendors]
  );
  const directoryVendors = useMemo(
    () =>
      projectVendorsByDirectory(
        catalogVendors,
        vendorDirectory
      ) as Vendor[],
    [catalogVendors, vendorDirectory]
  );
  const selectedVendor = useMemo(
    () =>
      directoryVendors.find((vendor) => vendor.id === selectedVendorId) || null,
    [directoryVendors, selectedVendorId]
  );
  const directoryCategories = useMemo(() => {
    const available = new Set(
      directoryVendors.flatMap((vendor) =>
        vendor.products.map((product) => product.category)
      )
    );
    return catalogCategories.filter((categoryName) =>
      available.has(categoryName)
    );
  }, [catalogCategories, directoryVendors]);
  const activeResourceStores = useMemo(
    () =>
      [...catalogResourceStores]
        .filter((store) => store.enabled)
        .sort(
          (left, right) =>
            left.order - right.order || left.label.localeCompare(right.label)
        ),
    [catalogResourceStores]
  );
  const selectedResourceStore =
    activeResourceStores.find(
      (store) => store.id === selectedResourceStoreId
    ) || activeResourceStores[0] || null;
  const hasPublicWorkflowStore = Boolean(
    publicWorkflowPage?.items.length
  );
  useEffect(() => {
    if (
      category !== ALL_FILTER &&
      !directoryCategories.includes(category)
    ) {
      setCategory(ALL_FILTER);
    }
  }, [category, directoryCategories]);
  const letters = useMemo(
    () => [
      ALL_FILTER,
      ...[...new Set(directoryVendors.map((vendor) => vendor.initial))].sort()
    ],
    [directoryVendors]
  );
  useEffect(() => {
    if (!letters.includes(letter)) setLetter(ALL_FILTER);
  }, [letter, letters]);
  const searchResults = useMemo(
    () =>
      searchCatalog({
        vendors: catalogVendors,
        resources: catalogResources,
        resourceStores: catalogResourceStores,
        query: search
      }) as CatalogSearchResults,
    [catalogVendors, catalogResources, catalogResourceStores, search]
  );
  const downloadTaskNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const vendor of catalogAllVendors) {
      for (const product of vendor.products) {
        names[product.id] = catalogDisplayField(product, "name", language);
      }
    }
    for (const [environmentId, name] of Object.entries(ENVIRONMENT_NAMES)) {
      names[`environment:${environmentId}`] = uiText("auto.07990042ef55", { value1: name });
    }
    return names;
  }, [catalogAllVendors, language]);
  const downloadPopover = useMemo(
    () =>
      buildDownloadPopoverItems({
        names: downloadTaskNames,
        queueTasks: managedDownloadQueueTasks,
        legacyTasks: downloadTasks
      }),
    [downloadTaskNames, downloadTasks, managedDownloadQueueTasks]
  );
  useEffect(() => {
    const nextStates = Object.fromEntries(
      downloadPopover.items.map((item) => [
        `${item.source}:${item.id}`,
        item.state
      ])
    );
    if (!downloadNotificationsReady.current) {
      downloadNotificationStates.current = nextStates;
      downloadNotificationsReady.current = true;
      return;
    }
    for (const item of downloadPopover.items) {
      const key = `${item.source}:${item.id}`;
      const previousState = downloadNotificationStates.current[key];
      if (
        previousState === "active" &&
        (item.state === "completed" || item.state === "failed")
      ) {
        notifications.show({
          id: `download:${key}:${item.state}`,
          title: item.name,
          message:
            item.state === "completed"
              ? uiText("downloadMenu.completed")
              : uiText("downloadMenu.failed"),
          color: item.state === "completed" ? "aiHubCyan" : "red"
        });
      }
    }
    downloadNotificationStates.current = nextStates;
  }, [downloadPopover.items]);
  const installedManagement = useMemo(
    () =>
      buildInstalledProductManagement({
        vendors: catalogAllVendors,
        localInventory,
        desktopStatuses,
        cliStatuses,
        environmentChecks:
          environment?.displayChecks || environment?.checks || [],
        wslDistributions: environment?.wslDistributions || [],
        downloadTasks,
        managedDownloadQueueTasks,
        verifiedDownloadTasks: downloadTasks
      }),
    [
      catalogAllVendors,
      localInventory,
      desktopStatuses,
      cliStatuses,
      environment,
      downloadTasks,
      managedDownloadQueueTasks
    ]
  );
  const desktopUpdateOwners = useMemo(
    () =>
      Object.fromEntries(
        localInventory.map((profile) => [
          profile.productId,
          profile.lifecycle?.updateOwner || ""
        ])
      ),
    [localInventory]
  );
  const operationTaskNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const vendor of catalogAllVendors) {
      for (const product of vendor.products) {
        names[product.id] = catalogDisplayField(product, "name", language);
      }
    }
    for (const [environmentId, name] of Object.entries(ENVIRONMENT_NAMES)) {
      names[`environment:${environmentId}`] = uiText("auto.2201a196b4ed", { value1: name });
    }
    return names;
  }, [catalogAllVendors, language]);

  const updateCliManagedTask = (
    productId: string,
    generation: number,
    operation: CliManagedTask["operation"],
    phase: CliManagedTask["phase"],
    message: string
  ) => {
    const trayUpdate = window.aihubPC?.updateCliTrayTask({
      productId,
      generation,
      operation,
      phase
    });
    trayUpdate?.catch(() => {
      // Tray presentation is supplementary and cannot change task state.
    });
    if (phase === "completed" || phase === "failed") {
      const notification = window.aihubPC?.notifyCliTask({
        productId,
        generation,
        operation,
        outcome: phase
      });
      notification?.catch(() => {
        // A Windows notification failure must not change the task result.
      });
    }
    setCliManagedTasks((current) => ({
      ...current,
      [productId]: {
        productId,
        generation,
        operation,
        phase,
        message,
        updatedAt: new Date().toISOString()
      }
    }));
  };

  const applyManagedDownloadTask = (
    task: ManagedDownloadTask,
    options?: { freshStart?: boolean }
  ) => {
    if (!downloadTaskRevisions.current.accept(task, options)) return;
    setDownloadTasks((current) => ({
      ...current,
      [task.productId]: task
    }));
    if (task.productId.startsWith("environment:")) {
      const environmentId = task.productId.slice("environment:".length);
      const name = ENVIRONMENT_NAMES[environmentId] || environmentId;
      const percent =
        task.progress.percent === null ? "" : ` ${task.progress.percent}%`;
      const stage: EnvironmentPackageStage =
        task.phase === "completed"
          ? "ready"
          : task.phase === "paused"
            ? "paused"
            : task.phase === "failed"
              ? "download-error"
              : task.phase === "canceled"
                ? "idle"
                : "downloading";
      setEnvironmentPackageStages((current) => ({
        ...current,
        [environmentId]: stage
      }));
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]:
          task.phase === "completed"
            ? uiText("auto.e8abf82dd793", { value1: name })
            : task.phase === "paused"
              ? uiText("auto.05fe6ea844c2", { value1: name, value2: percent })
              : task.phase === "failed"
                ? task.errorMessage || uiText("auto.e9386003600e", { value1: name })
                : task.phase === "canceled"
                  ? ""
                  : uiText("auto.51323b31d536", { value1: name, value2: percent })
      }));
      if (
        task.phase === "completed" &&
        autoOpenEnvironmentInstallers.current.delete(environmentId)
      ) {
        void openEnvironmentInstaller(environmentId);
      } else if (
        task.phase === "failed" &&
        automaticEnvironmentFlow.current.snapshot().activeEnvironmentId ===
          environmentId
      ) {
        failAutomaticEnvironmentSetup(
          environmentId,
          task.errorMessage || uiText("auto.5d99c0cf7688", { value1: name })
        );
      }
      return;
    }

    if (task.phase === "canceled") {
      setProductProgress((current) => ({ ...current, [task.productId]: null }));
      setProductDownloadDetails((current) => {
        const next = { ...current };
        delete next[task.productId];
        return next;
      });
      setProductFiles((current) => {
        const next = { ...current };
        delete next[task.productId];
        return next;
      });
      setProductErrors((current) => ({ ...current, [task.productId]: "" }));
      setProductStages((current) => ({ ...current, [task.productId]: "ready" }));
      return;
    }

    setProductProgress((current) => ({
      ...current,
      [task.productId]: task.progress.percent
    }));
    const downloadProgress: DownloadProgress = {
      productId: task.productId,
      receivedBytes: task.progress.receivedBytes,
      totalBytes: task.progress.totalBytes,
      bytesPerSecond: task.progress.bytesPerSecond,
      etaSeconds: task.progress.etaSeconds,
      percent: task.progress.percent,
      ...(task.progress.availableBytes === null
        ? {}
        : { availableBytes: task.progress.availableBytes }),
      ...(task.progress.requiredBytes === null
        ? {}
        : { requiredBytes: task.progress.requiredBytes }),
      ...(task.progress.remainingBytes === null
        ? {}
        : { remainingBytes: task.progress.remainingBytes }),
      ...(task.progress.reserveBytes === null
        ? {}
        : { reserveBytes: task.progress.reserveBytes }),
      ...(task.progress.installDiskBytes === null
        ? {}
        : { installDiskBytes: task.progress.installDiskBytes }),
      ...(task.progress.installAvailableBytes === null
        ? {}
        : { installAvailableBytes: task.progress.installAvailableBytes }),
      ...(task.progress.downloadDirectory === null
        ? {}
        : { downloadDirectory: task.progress.downloadDirectory }),
      ...(task.progress.installSpaceOk === null
        ? {}
        : { installSpaceOk: task.progress.installSpaceOk }),
      ...(task.progress.spaceOk === null
        ? {}
        : { spaceOk: task.progress.spaceOk })
    };
    setProductDownloadDetails((current) => ({
      ...current,
      [task.productId]: downloadProgress
    }));

    if (task.phase === "completed") {
      setProductFiles((current) => ({
        ...current,
        [task.productId]: task.filePath || ""
      }));
      setProductErrors((current) => ({ ...current, [task.productId]: "" }));
      setProductStages((current) => ({
        ...current,
        [task.productId]: preserveInstallationStage(
          current[task.productId],
          "downloaded"
        )
      }));
      return;
    }
    if (task.phase === "paused") {
      setProductErrors((current) => ({
        ...current,
        [task.productId]:
          task.errorMessage || uiText("auto.d5cd56f6c0aa")
      }));
      setProductStages((current) => ({
        ...current,
        [task.productId]: "paused"
      }));
      return;
    }
    if (task.phase === "failed") {
      setProductFiles((current) => {
        const next = { ...current };
        delete next[task.productId];
        return next;
      });
      setProductErrors((current) => ({
        ...current,
        [task.productId]: managedDownloadErrorLabel(task)
      }));
      setProductStages((current) => ({
        ...current,
        [task.productId]: installedEvidenceProducts.current.has(task.productId)
          ? "installed"
          : "error"
      }));
      return;
    }
    setProductErrors((current) => ({
      ...current,
      [task.productId]:
        task.phase === "pausing"
          ? uiText("auto.1006f93767b8")
          : task.phase === "canceling"
            ? uiText("auto.4d0d3353c378")
            : ""
    }));
    setProductStages((current) => ({
      ...current,
      [task.productId]: "downloading"
    }));
  };

  const managedDownloadQueueSyncFor = (productId: string) => {
    let sync = managedDownloadQueueSyncs.current.get(productId);
    if (!sync) {
      sync = {
        generation: 0,
        dirtyRevision: 0,
        statusRevision: 0,
        inFlight: false,
        taskId: null
      };
      managedDownloadQueueSyncs.current.set(productId, sync);
    }
    return sync;
  };

  const bindManagedDownloadQueueAttempt = (task: ManagedDownloadQueueTask) => {
    const sync = managedDownloadQueueSyncFor(task.productId);
    if (sync.taskId === task.taskId) return;
    sync.taskId = task.taskId;
    sync.generation += 1;
    sync.dirtyRevision = 0;
    sync.statusRevision = 0;
  };

  const applyManagedDownloadQueueTask = (task: ManagedDownloadQueueTask) => {
    bindManagedDownloadQueueAttempt(task);
    setManagedDownloadQueueTasks((current) => ({
      ...current,
      [task.productId]: task
    }));
    setDownloadTasks((current) => {
      if (!current[task.productId]) return current;
      const next = { ...current };
      delete next[task.productId];
      return next;
    });
  };

  const removeManagedDownloadQueueTask = (productId: string) => {
    const sync = managedDownloadQueueSyncFor(productId);
    sync.taskId = null;
    sync.generation += 1;
    sync.dirtyRevision = 0;
    sync.statusRevision = 0;
    setManagedDownloadQueueTasks((current) => {
      if (!current[productId]) return current;
      const next = { ...current };
      delete next[productId];
      return next;
    });
  };

  const requestManagedDownloadQueueStatus = (
    productId: string,
    taskId: string
  ) => {
    if (!hasManagedDownloadQueueApi() || productId.startsWith("environment:")) return;
    const sync = managedDownloadQueueSyncFor(productId);
    if (sync.taskId !== taskId) {
      sync.taskId = taskId;
      sync.generation += 1;
      sync.dirtyRevision = 0;
      sync.statusRevision = 0;
    }
    sync.dirtyRevision += 1;
    if (sync.inFlight) return;
    sync.inFlight = true;
    void (async () => {
      while (true) {
        const generation = sync.generation;
        const dirtyRevision = sync.dirtyRevision;
        const expectedTaskId = sync.taskId;
        try {
          const result = await window.aihubPC!.getManagedDownloadTaskStatus({
            productId
          });
          if (
            generation === sync.generation &&
            expectedTaskId === sync.taskId &&
            result.task?.taskId === expectedTaskId
          ) {
            sync.statusRevision += 1;
            applyManagedDownloadQueueTask(result.task);
          }
        } catch {
          // The last trusted presentation stays visible until the next event.
        }
        if (
          generation === sync.generation &&
          dirtyRevision === sync.dirtyRevision
        ) {
          break;
        }
      }
      sync.inFlight = false;
    })();
  };

  const refreshManagedDownloadQueue = async () => {
    if (!hasManagedDownloadQueueApi()) return;
    const snapshotVersions = new Map(
      [...managedDownloadQueueSyncs.current].map(([productId, sync]) => [
        productId,
        [sync.generation, sync.dirtyRevision, sync.statusRevision] as const
      ])
    );
    try {
      const tasks = await window.aihubPC!.listManagedDownloadTasks();
      const queueTasks = tasks.filter(
        (task) => !task.productId.startsWith("environment:")
      );
      const productIds = new Set(queueTasks.map((task) => task.productId));
      const snapshotIsCurrent = (productId: string) => {
        const sync = managedDownloadQueueSyncs.current.get(productId);
        const version = snapshotVersions.get(productId) || [0, 0, 0];
        return (
          (sync?.generation || 0) === version[0] &&
          (sync?.dirtyRevision || 0) === version[1] &&
          (sync?.statusRevision || 0) === version[2]
        );
      };
      const acceptedTasks = queueTasks.filter((task) =>
        snapshotIsCurrent(task.productId)
      );
      acceptedTasks.forEach(bindManagedDownloadQueueAttempt);
      setManagedDownloadQueueTasks((current) => {
        const next = { ...current };
        for (const task of acceptedTasks) {
          next[task.productId] = task;
        }
        for (const productId of Object.keys(next)) {
          if (
            !productIds.has(productId) &&
            snapshotIsCurrent(productId)
          ) {
            delete next[productId];
          }
        }
        return next;
      });
      setDownloadTasks((current) => {
        const next = { ...current };
        for (const task of acceptedTasks) delete next[task.productId];
        return next;
      });
    } catch {
      // Queue availability is supplementary. Legacy download recovery remains intact.
    }
  };

  const applyDesktopOperationTask = (task: DesktopOperationTask) => {
    const known = desktopOperationRevisions.current[task.productId];
    if (
      known &&
      (task.generation < known.generation ||
        (task.generation === known.generation &&
          (task.operationId !== known.operationId ||
            task.revision <= known.revision)))
    ) {
      return;
    }
    desktopOperationRevisions.current[task.productId] = {
      generation: task.generation,
      operationId: task.operationId,
      revision: task.revision
    };
    setDesktopOperationTasks((current) => ({
      ...current,
      [task.productId]: task
    }));
    if (task.desktopStatus) {
      setDesktopStatuses((current) => ({
        ...current,
        [task.productId]: task.desktopStatus!
      }));
    }
    if (task.phase === "installed") {
      installedEvidenceProducts.current.add(task.productId);
      setProductErrors((current) => ({ ...current, [task.productId]: "" }));
      setProductStages((current) => ({
        ...current,
        [task.productId]: "installed"
      }));
      return;
    }
    if (task.phase === "uninstalled") {
      installedEvidenceProducts.current.delete(task.productId);
      setProductErrors((current) => ({ ...current, [task.productId]: "" }));
      void restoreDownloadedOrReady(task.productId, () => true, true);
      return;
    }
    if (task.phase === "canceled" || task.phase === "failed") {
      setDesktopOperationTasks((current) => {
        const next = { ...current };
        delete next[task.productId];
        return next;
      });
      if (task.operation === "uninstall") {
        installedEvidenceProducts.current.add(task.productId);
        setProductErrors((current) => ({
          ...current,
          [task.productId]:
            task.phase === "failed"
              ? task.lastError || uiText("desktop.uninstallFailed")
              : ""
        }));
        setProductStages((current) => ({
          ...current,
          [task.productId]: "installed"
        }));
        return;
      }
      installedEvidenceProducts.current.delete(task.productId);
      setProductErrors((current) => ({
        ...current,
        [task.productId]:
          task.phase === "failed"
            ? task.lastError || uiText("desktop.installFailed")
            : ""
      }));
      setProductStages((current) => ({
        ...current,
        [task.productId]: "downloaded"
      }));
      return;
    }
    if (task.operation === "uninstall") {
      const uninstallCopy = getDesktopUninstallPresentation(
        task.productId,
        task.desktopStatus?.uninstallMode ??
          desktopStatuses[task.productId]?.uninstallMode,
        language
      );
      setProductStages((current) => ({
        ...current,
        [task.productId]: "awaiting-uninstall"
      }));
      setProductErrors((current) => ({
        ...current,
        [task.productId]:
          task.phase === "timed-out"
            ? uninstallCopy.timedOut
            : task.phase === "launching"
              ? uninstallCopy.preparing
              : task.lastError
                ? uiText("auto.049cf69939d2")
                : task.launchState === "unknown"
                  ? uiText("auto.467262737ebe", { value1: uninstallCopy.activeDetail })
                  : uninstallCopy.activeDetail
      }));
      return;
    }
    if (installedEvidenceProducts.current.has(task.productId)) return;
    if (task.phase === "timed-out") {
      setProductErrors((current) => ({
        ...current,
        [task.productId]: uiText("auto.cb7ac2dda21b")
      }));
      setProductStages((current) => ({
        ...current,
        [task.productId]: "error"
      }));
      return;
    }
    setProductStages((current) => ({
      ...current,
      [task.productId]: "awaiting-verification"
    }));
    setProductErrors((current) => ({
      ...current,
      [task.productId]:
        task.phase === "timed-out"
          ? uiText("auto.83201b1b5445")
          : task.phase === "launching"
            ? uiText("auto.6bb29222c392")
            : task.lastError
              ? uiText("auto.63c4b45bea14")
              : task.launchState === "unknown"
                ? uiText("auto.e56cd1db6648")
                : uiText("auto.22339d0032a4")
    }));
  };

  const applyEnvironmentReport = (report: EnvironmentReport) => {
    setEnvironment(report);
    for (const check of report.checks) {
      if (check.installed) {
        installedEnvironmentEvidence.current.add(check.id);
      } else if (check.detection !== "unknown") {
        installedEnvironmentEvidence.current.delete(check.id);
      }
    }
    setEnvironmentPackageStages((current) => {
      const next = { ...current };
      for (const check of report.checks) {
        if (
          check.installed &&
          !environmentOperations.current[check.id]
        ) {
          next[check.id] = "idle";
        }
      }
      return next;
    });
    const installedIds = new Set(
      report.checks
        .filter((check) => check.installed)
        .map((check) => check.id)
    );
    const products = catalogAllVendors.flatMap((vendor) => vendor.products);
    setProductMissing((current) => {
      const next = { ...current };
      for (const product of products) {
        if (
          !product.requirements.length ||
          !Object.prototype.hasOwnProperty.call(current, product.id)
        ) {
          continue;
        }
        next[product.id] = product.requirements.filter(
          (requirement) => !installedIds.has(requirement)
        );
      }
      return next;
    });
    setProductStages((current) => {
      const next = { ...current };
      for (const product of products) {
        if (
          !product.requirements.length ||
          !["blocked", "ready"].includes(current[product.id])
        ) {
          continue;
        }
        const missing = product.requirements.some(
          (requirement) => !installedIds.has(requirement)
        );
        next[product.id] = missing ? "blocked" : "ready";
      }
      return next;
    });
  };

  const refreshEnvironmentReport = async (showProgress = false) => {
    const generation = ++environmentScanGeneration.current;
    if (showProgress) setScanning(true);
    try {
      const report = window.aihubPC
        ? await window.aihubPC.scanEnvironment()
        : { ...browserEnvironmentFallback, checkedAt: new Date().toISOString() };
      if (environmentScanGeneration.current === generation) {
        applyEnvironmentReport(report);
      }
      return report;
    } finally {
      if (showProgress && environmentScanGeneration.current === generation) {
        setScanning(false);
      }
    }
  };

  const restoreEnvironmentPackage = async (
    environmentId: string,
    announce = true
  ) => {
    if (!window.aihubPC?.getEnvironmentPackage) return null;
    let snapshot: EnvironmentPackageSnapshot | null = null;
    try {
      snapshot = await window.aihubPC.getEnvironmentPackage(environmentId);
    } catch {
      snapshot = null;
    }
    if (environmentOperations.current[environmentId]) return snapshot;
    if (installedEnvironmentEvidence.current.has(environmentId)) {
      setEnvironmentPackageStages((current) => ({
        ...current,
        [environmentId]: "idle"
      }));
      return snapshot;
    }
    setEnvironmentPackageStages((current) => ({
      ...current,
      [environmentId]: snapshot?.ready ? "ready" : "idle"
    }));
    if (announce && snapshot?.ready) {
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]:
          snapshot?.message ||
          uiText("auto.5472f6458434", { value1: ENVIRONMENT_NAMES[environmentId] || environmentId })
      }));
    }
    return snapshot;
  };

  const applyEnvironmentOperationTask = (
    task: EnvironmentOperationTask,
    allowGeneralProbe = true
  ) => {
    const known = environmentOperationRevisions.current[task.environmentId];
    if (
      known &&
      (task.generation < known.generation ||
        (task.generation === known.generation &&
          (task.operationId !== known.operationId ||
            task.revision <= known.revision)))
    ) {
      return false;
    }
    environmentOperationRevisions.current[task.environmentId] = {
      generation: task.generation,
      operationId: task.operationId,
      revision: task.revision
    };
    setEnvironmentOperationTasks((current) => ({
      ...current,
      [task.environmentId]: task
    }));

    if (task.environmentStatus) {
      if (task.environmentStatus.installed) {
        installedEnvironmentEvidence.current.add(task.environmentId);
      } else if (task.environmentStatus.detection !== "unknown") {
        installedEnvironmentEvidence.current.delete(task.environmentId);
      }
      setEnvironment((current) =>
        current
          ? {
              ...current,
              checkedAt: task.lastCheckedAt || current.checkedAt,
              checks: current.checks.map((check) =>
                check.id === task.environmentId
                  ? {
                      ...check,
                      installed: task.environmentStatus!.installed,
                      location: task.environmentStatus!.location,
                      canUninstall: task.environmentStatus!.canUninstall,
                      detection: task.environmentStatus!.detection
                    }
                  : check
              )
            }
          : current
      );
    }

    const name = ENVIRONMENT_NAMES[task.environmentId] || task.environmentId;
    if (task.phase === "installed" || task.phase === "uninstalled") {
      delete environmentOperations.current[task.environmentId];
      for (const product of catalogAllVendors.flatMap(
        (vendor) => vendor.products
      )) {
        if (product.requirements.includes(task.environmentId)) {
          productOperationGenerations.current[product.id] =
            (productOperationGenerations.current[product.id] || 0) + 1;
        }
      }
      if (task.phase === "installed") {
        installedEnvironmentEvidence.current.add(task.environmentId);
        setEnvironmentPackageStages((current) => ({
          ...current,
          [task.environmentId]: "idle"
        }));
        setEnvironmentMessages((current) => ({
          ...current,
          [task.environmentId]: uiText("auto.59f68a10399b", { value1: name })
        }));
        automaticEnvironmentFlow.current.complete(task.environmentId);
        autoOpenEnvironmentInstallers.current.delete(task.environmentId);
        if (allowGeneralProbe) {
          window.setTimeout(() => {
            void continueAutomaticEnvironmentInstalls();
          }, 0);
        }
      } else {
        installedEnvironmentEvidence.current.delete(task.environmentId);
        setEnvironmentPackageStages((current) => ({
          ...current,
          [task.environmentId]: "idle"
        }));
        setEnvironmentMessages((current) => ({
          ...current,
          [task.environmentId]: uiText("auto.182fb8926e89", { value1: name })
        }));
        void restoreEnvironmentPackage(task.environmentId, false);
      }
      if (allowGeneralProbe) void refreshEnvironmentReport(false);
      return true;
    }

    environmentOperations.current[task.environmentId] = task;
    const operationStage: EnvironmentPackageStage =
      task.operation === "install"
        ? task.phase === "launching"
          ? "opening-install"
          : task.phase === "timed-out"
            ? "timed-out-install"
            : "awaiting-install"
        : task.phase === "launching"
          ? "opening-uninstall"
          : task.phase === "timed-out"
            ? "timed-out-uninstall"
            : "awaiting-uninstall";
    setEnvironmentPackageStages((current) => ({
      ...current,
      [task.environmentId]: operationStage
    }));
    setEnvironmentMessages((current) => ({
      ...current,
      [task.environmentId]:
        task.phase === "timed-out"
          ? task.operation === "install"
            ? uiText("auto.e83425e3a66a", { value1: name })
            : uiText("auto.87263864ca91", { value1: name })
          : task.phase === "launching"
            ? task.operation === "install"
              ? uiText("auto.695ac7cdb0aa", { value1: name })
              : uiText("auto.97ed8e6fa1d6", { value1: name })
            : task.lastError
              ? uiText("auto.3387aeea1571", { value1: name })
              : task.launchState === "unknown"
                ? uiText("auto.59697449b2f9", { value1: name, value2: task.operation === "install" ? uiText("auto.e8f88f51ccb0") : uiText("auto.06bc14b60f35") })
                : uiText("auto.637f9cedf44d", { value1: name, value2: task.operation === "install" ? uiText("auto.e8f88f51ccb0") : uiText("auto.06bc14b60f35") })
    }));
    if (
      task.operation === "install" &&
      task.phase === "timed-out" &&
      automaticEnvironmentFlow.current.snapshot().activeEnvironmentId ===
        task.environmentId
    ) {
      failAutomaticEnvironmentSetup(
        task.environmentId,
        uiText("auto.a13ad2d64b34", { value1: name })
      );
    }
    return true;
  };

  const recheckEnvironmentOperation = async (environmentId: string) => {
    if (!window.aihubPC) return false;
    let task: EnvironmentOperationTask | null =
      environmentOperations.current[environmentId] || null;
    if (!task) {
      task =
        (await window.aihubPC.getEnvironmentOperation?.(environmentId)) || null;
      if (task) applyEnvironmentOperationTask(task);
    }
    if (!task) return false;
    const checked =
      (await window.aihubPC.checkEnvironmentOperation?.(
        environmentId,
        task.generation,
        task.operationId
      )) || null;
    if (checked) {
      applyEnvironmentOperationTask(checked);
    } else {
      delete environmentOperations.current[environmentId];
      setEnvironmentOperationTasks((current) => {
        const next = { ...current };
        delete next[environmentId];
        return next;
      });
      await restoreEnvironmentPackage(environmentId, false);
      void refreshEnvironmentReport(false);
    }
    return true;
  };

  const applyManagedInventory = (
    snapshot: ManagedProductInventorySnapshot
  ) => {
    const profiles = snapshot.profiles || [];
    managedActionContextSnapshot.current = {
      ...managedActionContextSnapshot.current,
      localInventory: profiles
    };
    setLocalInventory(profiles);
    setDesktopStatuses((current) => ({
      ...current,
      ...snapshot.desktopStatuses
    }));
    setCliStatuses((current) => ({ ...current, ...snapshot.cliStatuses }));
    setCliVersions((current) => {
      const next = { ...current };
      for (const [productId, status] of Object.entries(snapshot.cliStatuses)) {
        next[productId] = status.installed ? status.version : "";
      }
      return next;
    });
    for (const [productId, status] of Object.entries(
      snapshot.desktopStatuses
    )) {
      const shouldRetainInstalledEvidence = reconcileDesktopInstalledEvidence({
        hadInstalledEvidence:
          installedEvidenceProducts.current.has(productId),
        installed: status.installed,
        detection: status.detection
      });
      if (shouldRetainInstalledEvidence) {
        installedEvidenceProducts.current.add(productId);
      } else {
        installedEvidenceProducts.current.delete(productId);
      }
    }
    setProductStages((current) => {
      const next = { ...current };
      for (const [productId, status] of Object.entries(
        snapshot.desktopStatuses
      )) {
        const reconciled = reconcileDesktopInventoryStage({
          currentStage: current[productId],
          installed: status.installed,
          detection: status.detection,
          completedPackage: downloadTasks[productId]?.phase === "completed"
        });
        if (reconciled !== undefined) {
          next[productId] = reconciled;
        }
      }
      for (const [productId, status] of Object.entries(snapshot.cliStatuses)) {
        if (["deploying", "removing-cli"].includes(current[productId])) {
          continue;
        }
        if (status.installed) next[productId] = "installed";
        else if (status.detection === "unknown") {
          next[productId] = "detection-error";
        }
      }
      return next;
    });
  };

  useEffect(() => {
    window.aihubPC?.getSettings().then((settings) => {
      setDownloadDirectory(settings.downloadDirectory);
      setCliInstallDirectory(settings.cliInstallDirectory || "");
      const nextLanguage = normalizeLanguage(settings.language);
      setActiveLanguage(nextLanguage);
      setLanguage(nextLanguage);
      document.documentElement.lang =
        createLanguage(nextLanguage).documentLocale;
    });
  }, []);

  useEffect(() => {
    window.aihubPC
      ?.getIdentity()
      .then(setIdentity)
      .catch(() => setIdentity({ status: "anonymous" }));
  }, []);

  useEffect(() => {
    if (!window.aihubPC) return;
    let active = true;
    void window.aihubPC.getWorkflowPublicCapability().then(async (capability) => {
      if (!active || !capability.ok || !capability.value.enabled) return;
      const page = await window.aihubPC!.listPublicWorkflows({ limit: 20 });
      if (active && page.ok && page.value.items.length) {
        setPublicWorkflowPage(page.value);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!window.aihubPC?.getLocalAgentBridgeCapability) return;
    let active = true;
    void window.aihubPC.getLocalAgentBridgeCapability()
      .then((result) => {
        if (active) setLocalAgentBridgeCapability(result.ok ? result.value : null);
      })
      .catch(() => {
        if (active) setLocalAgentBridgeCapability(null);
      });
    return () => { active = false; };
  }, []);

  const loadMorePublicWorkflows = async () => {
    if (!window.aihubPC || !publicWorkflowPage?.next) return;
    const result = await window.aihubPC.listPublicWorkflows({
      limit: 20,
      after: publicWorkflowPage.next
    });
    if (!result.ok) return;
    setPublicWorkflowPage((current) => current
      ? { items: [...current.items, ...result.value.items], next: result.value.next }
      : current);
  };

  useEffect(() => {
    if (!window.aihubPC || initialInventoryRecovered.current) return;
    initialInventoryRecovered.current = true;
    let active = true;
    void (async () => {
      const updateResult = await window.aihubPC!.checkSoftwareUpdates();
      if (active) setSoftwareUpdateResult(updateResult);
      const [inventoryResult] = await Promise.allSettled([
        window.aihubPC!.scanManagedInventory(),
        refreshEnvironmentReport(false)
      ]);
      if (active && inventoryResult.status === "fulfilled") {
        applyManagedInventory(inventoryResult.value);
      }
      if (inventoryResult.status === "rejected") {
        initialInventoryRecovered.current = false;
      }
    })().catch(() => {
      initialInventoryRecovered.current = false;
      if (active) {
        setSoftwareUpdateResult({
          status: "error",
          publishedEntries: 0,
          message: uiText("softwareUpdates.checkFailed")
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (identity.status !== "authenticated" || !window.aihubPC) {
      setPersonalCenter(null);
      return;
    }
    let active = true;
    const refresh = () =>
      window.aihubPC!
        .getPersonalCenter()
        .then((snapshot) => {
          if (active) setPersonalCenter(snapshot);
        })
        .catch(() => {
          // The account button remains usable while a refresh is retried.
        });
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [identity.status === "authenticated" ? identity.user.id : "anonymous"]);


  useEffect(() => {
    if (!window.aihubPC) return;
    for (const environmentId of Object.keys(ENVIRONMENT_NAMES)) {
      if (recoveredEnvironmentIds.current.has(environmentId)) continue;
      recoveredEnvironmentIds.current.add(environmentId);
      void (async () => {
        try {
          const packageSnapshot =
            (await window.aihubPC?.getEnvironmentPackage?.(environmentId)) ||
            null;
          if (
            packageSnapshot?.ready &&
            !environmentOperations.current[environmentId] &&
            !installedEnvironmentEvidence.current.has(environmentId)
          ) {
            setEnvironmentPackageStages((current) => ({
              ...current,
              [environmentId]: "ready"
            }));
            setEnvironmentMessages((current) => ({
              ...current,
              [environmentId]:
                packageSnapshot.message ||
                uiText("auto.5472f6458434", { value1: ENVIRONMENT_NAMES[environmentId] || environmentId })
            }));
          }
          const downloadTask =
            (await window.aihubPC?.getDownloadTask?.(
              `environment:${environmentId}`
            )) || null;
          if (downloadTask) {
            applyManagedDownloadTask(downloadTask);
          }
          const operationTask =
            (await window.aihubPC?.getEnvironmentOperation?.(environmentId)) ||
            null;
          if (operationTask) {
            applyEnvironmentOperationTask(operationTask, false);
          }
        } catch {
          recoveredEnvironmentIds.current.delete(environmentId);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (!window.aihubPC) return;
    resolveManagedProductActionContexts({
      vendors: catalogAllVendors,
      localInventory
    })
      .filter((product) => product.download)
      .forEach((product) => {
        if (recoveredProductIds.current.has(product.id)) return;
        recoveredProductIds.current.add(product.id);
        void (async () => {
          try {
            if (product.download) {
              if (hasManagedDownloadQueueApi()) {
                return;
              }
              const task = await window.aihubPC?.getDownloadTask?.(product.id);
              if (task) {
                applyManagedDownloadTask(task);
              } else {
                const record =
                  await window.aihubPC?.getDownloadRecord(product.id);
                if (record) {
                  setProductFiles((current) => ({
                    ...current,
                    [product.id]: record.filePath
                  }));
                  setProductStages((current) => ({
                    ...current,
                    [product.id]: preserveInstallationStage(
                      current[product.id],
                      "downloaded"
                    )
                  }));
                } else {
                  const partial =
                    await window.aihubPC?.getPartialDownload(product.id);
                  if (partial) {
                    setProductProgress((current) => ({
                      ...current,
                      [product.id]: partial.totalBytes
                        ? Math.round(
                            (partial.receivedBytes / partial.totalBytes) * 100
                          )
                        : null
                    }));
                    setProductDownloadDetails((current) => ({
                      ...current,
                      [product.id]: {
                        productId: product.id,
                        receivedBytes: partial.receivedBytes,
                        totalBytes: partial.totalBytes,
                        bytesPerSecond: 0,
                        etaSeconds: null,
                        percent: partial.totalBytes
                          ? Math.round(
                              (partial.receivedBytes / partial.totalBytes) * 100
                            )
                          : null
                      }
                    }));
                    setProductErrors((current) => ({
                      ...current,
                      [product.id]: uiText("auto.fbeddaa85ddd")
                    }));
                    setProductStages((current) => ({
                      ...current,
                      [product.id]: preserveInstallationStage(
                        current[product.id],
                        "paused"
                      )
                    }));
                  }
                }
              }
            }
            if (!resolveProductBehavior(product).managedDesktop) return;
            const operationTask =
              (await window.aihubPC?.getDesktopOperation?.(product.id)) || null;
            if (operationTask) applyDesktopOperationTask(operationTask);
          } catch {
            // A damaged local record must not block recovery for other products.
            recoveredProductIds.current.delete(product.id);
          }
        })();
      });
  }, [catalogAllVendors, localInventory]);

  useEffect(() => {
    let disposed = false;
    let hasCatalogSnapshot = false;
    let lastSuccessfulRefreshAt = 0;
    let pendingRefresh: Promise<void> | null = null;

    const refreshCatalog = (force = false) => {
      if (
        !force &&
        Date.now() - lastSuccessfulRefreshAt < CATALOG_REFRESH_TTL_MS
      ) {
        return Promise.resolve();
      }
      if (pendingRefresh) return pendingRefresh;

      const request =
        window.aihubPC?.getCatalog() ??
        (import.meta.env.DEV
          ? loadDevelopmentCatalog(window.fetch.bind(window))
          : undefined);
      if (!request) {
        setCatalogStartupPending(false);
        return Promise.resolve();
      }

      pendingRefresh = request
        .then((result: CatalogResult) => {
          if (disposed) return;
          if (!result.catalog) {
            if (!hasCatalogSnapshot) {
              managedActionContextSnapshot.current = {
                ...managedActionContextSnapshot.current,
                vendors: []
              };
              setCatalogAllVendors([]);
              setCatalogVendors([]);
              setCatalogResources([]);
              setCatalogResourceConnections([]);
              setCatalogResourceStores([]);
              setCatalogCommunity(null);
              setCatalogCategories([]);
              setCatalogError(
                result.error || uiText("catalog.unavailableDescription")
              );
            }
            return;
          }

          const catalog = result.catalog as NonNullable<
            CatalogResult["catalog"]
          > & { categories?: ProductCategory[] };
          const allVendors = sortCatalogVendors(catalog.vendors);
          const visibleVendors = visibleCatalogVendors(allVendors);
          const nextCategories =
            Array.isArray(catalog.categories) && catalog.categories.length
              ? [...catalog.categories]
              : inferCatalogCategories(allVendors);

          hasCatalogSnapshot = true;
          lastSuccessfulRefreshAt = Date.now();
          managedActionContextSnapshot.current = {
            ...managedActionContextSnapshot.current,
            vendors: allVendors
          };
          setCatalogError("");
          setCatalogAllVendors(allVendors);
          setCatalogVendors(visibleVendors);
          setCatalogResources(catalog.resources || []);
          setCatalogResourceConnections(catalog.resourceConnections || []);
          setCatalogResourceStores(catalog.resourceStores || []);
          setCatalogCategories(nextCategories);
          setCategory((current) =>
            current === ALL_FILTER || nextCategories.includes(current)
              ? current
              : ALL_FILTER
          );
          setBrand(catalog.brand || null);
          setExtraSections(catalog.extraSections || []);
          setCatalogCommunity(catalog.community || null);
          setHomeBanners(catalog.home?.banners || []);
          setHomeCarousel(catalog.homeCarousel);
          setFeaturedVendorIds(catalog.home?.featuredVendorIds || []);
        })
        .catch((error: unknown) => {
          if (disposed || hasCatalogSnapshot) return;
          managedActionContextSnapshot.current = {
            ...managedActionContextSnapshot.current,
            vendors: []
          };
          setCatalogAllVendors([]);
          setCatalogVendors([]);
          setCatalogResources([]);
          setCatalogResourceConnections([]);
          setCatalogResourceStores([]);
          setCatalogCommunity(null);
          setCatalogCategories([]);
          setCatalogError(
            error instanceof Error
              ? error.message
              : uiText("catalog.unavailableDescription")
          );
        })
        .finally(() => {
          if (!disposed) setCatalogStartupPending(false);
          pendingRefresh = null;
        });
      return pendingRefresh;
    };

    void refreshCatalog(true);
    const refreshOnFocus = () => void refreshCatalog(false);
    window.addEventListener("focus", refreshOnFocus);
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshCatalog(false);
    }, CATALOG_REFRESH_TTL_MS);
    return () => {
      disposed = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  useEffect(() => {
    return window.aihubPC?.onDownloadTask?.((task) => {
      if (hasManagedDownloadQueueApi() && !task.productId.startsWith("environment:")) {
        if (!managedDownloadQueueEventRevisions.current.accept(task)) return;
        requestManagedDownloadQueueStatus(task.productId, task.attemptId);
        return;
      }
      applyManagedDownloadTask(task);
    });
  }, []);

  useEffect(() => {
    if (!hasManagedDownloadQueueApi()) return;
    let disposed = false;
    const refresh = async () => {
      if (disposed) return;
      await refreshManagedDownloadQueue();
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    return window.aihubPC?.onDesktopOperation?.((task) => {
      applyDesktopOperationTask(task);
    });
  }, []);

  useEffect(() => {
    return window.aihubPC?.onEnvironmentOperation?.((task) => {
      applyEnvironmentOperationTask(task);
    });
  }, []);

  useEffect(() => {
    return window.aihubPC?.onCliLog((entry) => {
      setCliLogs((current) => ({
        ...current,
        [entry.productId]: [...(current[entry.productId] || []), entry].slice(
          -8
        )
      }));
      setCliManagedTasks((current) => {
        const task = current[entry.productId];
        return !task || task.phase !== "running"
          ? current
          : {
              ...current,
              [entry.productId]: {
                ...task,
                message: entry.line,
                updatedAt: new Date().toISOString()
              }
            };
      });
    });
  }, []);

  useEffect(() => {
    const dispose = window.aihubPC?.onTaskNotificationOpen?.((target) => {
      if (
        !target ||
        typeof target.productId !== "string" ||
        !["product", "task-center"].includes(target.target)
      ) {
        return;
      }
      if (target.target === "task-center") {
        setSettingsOpen(true);
        return;
      }
      const owner = catalogAllVendors
        .map((vendor) => ({
          vendor,
          product: vendor.products.find(
            (product) => product.id === target.productId
          )
        }))
        .find((entry) => entry.product);
      if (!owner?.product) {
        setSettingsOpen(true);
        return;
      }
      setSettingsOpen(false);
      setVendorDirectory(owner.product.directoryKind || "ai-tool");
      setView("vendors");
      setSelectedVendorId(owner.vendor.id);
    });
    return typeof dispose === "function" ? dispose : undefined;
  }, [catalogAllVendors]);

  useEffect(() => {
    return window.aihubPC?.onDownloadProgress((progress) => {
      if (progress.productId === "aihub-update") {
        setUpdateInstallMessage(
          progress.percent === null
            ? uiText("auto.5ae75007f375")
            : uiText("auto.afbbc2060f78", { value1: progress.percent })
        );
        return;
      }
      if (progress.productId.startsWith("environment:")) {
        const environmentId = progress.productId.slice("environment:".length);
        const name = ENVIRONMENT_NAMES[environmentId] || environmentId;
        setEnvironmentMessages((current) => ({
          ...current,
          [environmentId]:
            progress.percent === null
              ? uiText("auto.e5ccd4f636cb", { value1: name })
              : uiText("auto.d0c6e4b5b8e3", { value1: name, value2: progress.percent })
        }));
        return;
      }
      setProductProgress((current) => ({
        ...current,
        [progress.productId]: progress.percent
      }));
      setProductDownloadDetails((current) => ({
        ...current,
        [progress.productId]: {
          ...current[progress.productId],
          ...progress
        }
      }));
    });
  }, []);

  const visibleVendors = useMemo(() => {
    return directoryVendors
      .filter((vendor) => {
        const categoryProducts = vendor.products.filter(
          (product) =>
            category === ALL_FILTER || product.category === category
        );
        if (!categoryProducts.length) return false;
        return letter === ALL_FILTER || vendor.initial === letter;
      })
      .sort(
        (left, right) =>
          left.initial.localeCompare(right.initial, "en") ||
          left.name.localeCompare(right.name, "zh-CN")
      );
  }, [directoryVendors, category, letter]);

  const navigate = (next: View) => {
    setSelectedVendorId("");
    setView(next);
  };

  const openVendorDirectory = (directoryKind: ProductDirectoryKind) => {
    setVendorDirectory(directoryKind);
    setSelectedVendorId("");
    setCategory(ALL_FILTER);
    setLetter(ALL_FILTER);
    setSearch("");
    setView("vendors");
  };

  const openResourceStore = (storeId: string) => {
    setSelectedResourceStoreId(storeId);
    setResourceStoreVisit((current) => current + 1);
    setResourceStoreSelection({ resourceId: "" });
    setSelectedVendorId("");
    setView("resources");
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch((current) => current.trim());
    setSelectedVendorId("");
    setCategory(ALL_FILTER);
    setLetter(ALL_FILTER);
    setView("search");
  };

  const openSearchResource = (
    result: CatalogSearchResults["resources"][number]
  ) => {
    setSelectedResourceStoreId(result.store.id);
    setResourceStoreSelection({
      resourceId: result.resource.id
    });
    setResourceStoreVisit((current) => current + 1);
    setSelectedVendorId("");
    setView("resources");
  };

  const chooseDownloadDirectory = async () => {
    const settings = window.aihubPC
      ? await window.aihubPC.chooseDownloadDirectory()
      : {
          downloadDirectory: `D:\\${BRAND.name}\\Downloads`,
          selectionCanceled: false
        };
    setDownloadDirectory(settings.downloadDirectory);
    return settings;
  };

  const runEnvironmentScan = () => refreshEnvironmentReport(true);

  const beginProductOperation = (productId: string) => {
    const generation = (productOperationGenerations.current[productId] || 0) + 1;
    productOperationGenerations.current[productId] = generation;
    return generation;
  };

  const isCurrentProductOperation = (productId: string, generation: number) =>
    productOperationGenerations.current[productId] === generation;

  const installEnvironment = async (environmentId: string) => {
    if (!window.aihubPC) return;
    if (await recheckEnvironmentOperation(environmentId)) return;
    const downloadTask = downloadTasks[`environment:${environmentId}`];
    if (
      downloadTask &&
      ["starting", "downloading", "pausing"].includes(downloadTask.phase)
    ) {
      if (downloadTask.phase === "pausing") return;
      const paused = await window.aihubPC.pauseDownload(downloadTask.productId);
      if (paused.task) applyManagedDownloadTask(paused.task);
      if (!paused.ok && paused.error) {
        setEnvironmentMessages((current) => ({
          ...current,
          [environmentId]: paused.error!
        }));
      }
      return;
    }
    const result = (await runEnvironmentInstall({
      environmentId,
      client: window.aihubPC,
      onState: ({ stage, message }) => {
        setEnvironmentPackageStages((current) => ({
          ...current,
          [environmentId]: stage
        }));
        setEnvironmentMessages((current) => ({
          ...current,
          [environmentId]: message
        }));
      }
    })) as EnvironmentInstallResult;
    if (result.task) {
      applyManagedDownloadTask(result.task);
    }
    if (result.operationTask) {
      applyEnvironmentOperationTask(result.operationTask);
    }
    if (
      result.downloaded &&
      autoOpenEnvironmentInstallers.current.delete(environmentId)
    ) {
      await openEnvironmentInstaller(environmentId);
      return;
    }
    if (
      result.error &&
      !result.task &&
      !result.operationTask &&
      automaticEnvironmentFlow.current.snapshot().activeEnvironmentId ===
        environmentId
    ) {
      failAutomaticEnvironmentSetup(environmentId, result.error);
    }
  };

  const setDownloadTaskError = (productId: string, message: string) => {
    if (productId.startsWith("environment:")) {
      const environmentId = productId.slice("environment:".length);
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]: message
      }));
      return;
    }
    setProductErrors((current) => ({ ...current, [productId]: message }));
  };

  const resumeDownloadTask = async (productId: string) => {
    if (!window.aihubPC) return;
    let artifact: Product["download"] | undefined;
    if (!productId.startsWith("environment:")) {
      const product = resolveProductActionContext(productId, true);
      if (!product) {
        setDownloadTaskError(productId, uiText("auto.0174b6fcadff"));
        return;
      }
      artifact = product.download;
    }
    try {
      const result = await window.aihubPC.startDownload(productId, artifact);
      if (result.task) applyManagedDownloadTask(result.task);
      if (!result.ok) {
        setDownloadTaskError(
          productId,
          result.error || result.task?.errorMessage || uiText("auto.3270956f505f")
        );
      }
    } catch (error) {
      setDownloadTaskError(
        productId,
        error instanceof Error ? error.message : uiText("auto.3270956f505f")
      );
    }
  };

  const retryDownloadTask = async (productId: string) => {
    await resumeDownloadTask(productId);
  };

  const pauseDownloadTask = async (productId: string) => {
    if (!window.aihubPC) return;
    try {
      const result = await window.aihubPC.pauseDownload(productId);
      if (result.task) applyManagedDownloadTask(result.task);
      if (!result.ok && !result.canceled) {
        setDownloadTaskError(
          productId,
          result.error || result.task?.errorMessage || uiText("auto.fa1c57bcf3cb")
        );
      }
    } catch (error) {
      setDownloadTaskError(
        productId,
        error instanceof Error ? error.message : uiText("auto.fa1c57bcf3cb")
      );
    }
  };

  const requestDownloadCancellation = (
    productId: string,
    source: "queue" | "legacy",
    afterConfirm?: "relocate",
    trigger?: HTMLElement | null
  ) => {
    const queueTask = managedDownloadQueueTasks[productId];
    const legacyTask = downloadTasks[productId];
    const taskId = source === "queue" ? queueTask?.taskId : legacyTask?.attemptId;
    const receivedBytes = source === "queue"
      ? queueTask?.progress.receivedBytes
      : legacyTask?.progress.receivedBytes;
    if (!taskId) {
      setDownloadTaskError(productId, uiText("auto.1768ce955e7d"));
      return;
    }
    const product = catalogAllVendors
      .flatMap((vendor) => vendor.products)
      .find((entry) => entry.id === productId);
    setPendingDownloadCancellation({
      source,
      productId,
      taskId,
      productName: product?.name || downloadTaskNames[productId] || productId,
      receivedBytes: receivedBytes || 0,
      trigger: trigger && trigger.isConnected ? trigger : null,
      ...(afterConfirm ? { afterConfirm } : {})
    });
  };

  const cancelDownloadTask = (productId: string, trigger: HTMLElement) =>
    requestDownloadCancellation(productId, "legacy", undefined, trigger);

  const openCompletedDownloadTask = async (
    productId: string,
    requestedIntent?: ManagedInstallIntent
  ) => {
    if (productId.startsWith("environment:")) {
      const environmentId = productId.slice("environment:".length);
      const snapshot = await window.aihubPC?.getEnvironmentPackage?.(
        environmentId
      );
      if (snapshot?.ready) await openEnvironmentInstaller(environmentId);
      else await installEnvironment(environmentId);
      return;
    }
    const product = resolveProductActionContext(productId, true);
    if (!product) {
      setDownloadTaskError(productId, uiText("auto.0174b6fcadff"));
      return;
    }
    const intent = resolveCompletedPackageInstallIntent({
      requestedIntent,
      installed: desktopStatuses[productId]?.installed === true
    });
    if (!intent) {
      setDownloadTaskError(productId, uiText("runtime.operationFailed"));
      return;
    }
    await requestUnifiedInstall(product, intent);
  };

  const showDownloadInFolder = async (productId: string) => {
    if (!window.aihubPC) return;
    try {
      const result = await window.aihubPC.showDownloadInFolder(productId);
      if (!result.ok) {
        setDownloadTaskError(
          productId,
          result.error || uiText("auto.ec7c452924d5")
        );
      }
    } catch (error) {
      setDownloadTaskError(
        productId,
        error instanceof Error
          ? error.message
          : uiText("auto.ec7c452924d5")
      );
    }
  };

  const removeClearedDownloadTask = (productId: string) => {
    downloadTaskRevisions.current.clearProduct(productId);
    setDownloadTasks((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    if (productId.startsWith("environment:")) {
      const environmentId = productId.slice("environment:".length);
      setEnvironmentPackageStages((current) => ({
        ...current,
        [environmentId]: "idle"
      }));
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]: ""
      }));
      return;
    }
    setProductFiles((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setProductProgress((current) => ({ ...current, [productId]: null }));
    setProductDownloadDetails((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setProductErrors((current) => ({ ...current, [productId]: "" }));
    setProductStages((current) => ({
      ...current,
      [productId]:
        installedEvidenceProducts.current.has(productId)
          ? "installed"
          : "idle"
    }));
  };

  const clearDownloadHistory = async (productId: string) => {
    if (!window.aihubPC) return;
    try {
      const result = await window.aihubPC.clearDownloadHistory(productId);
      if (result.canceled) return;
      if (!result.ok) {
        setDownloadTaskError(
          productId,
          result.error || uiText("auto.a3f8e58e4762")
        );
        return;
      }
      removeClearedDownloadTask(productId);
    } catch (error) {
      setDownloadTaskError(
        productId,
        error instanceof Error ? error.message : uiText("auto.a3f8e58e4762")
      );
    }
  };

  const clearCompletedTasks = async () => {
    if (!window.aihubPC) return;
    let result: ClearCompletedDownloadsResult;
    try {
      result = await window.aihubPC.clearCompletedDownloads();
    } catch (error) {
      setProductErrors((current) => ({
        ...current,
        "task-center":
          error instanceof Error ? error.message : uiText("auto.99f0751357d7")
      }));
      return;
    }
    if (result.canceled) return;
    for (const productId of result.clearedProductIds) {
      removeClearedDownloadTask(productId);
    }
    for (const entry of result.errors) {
      setDownloadTaskError(entry.productId, entry.error);
    }
    setDesktopOperationTasks((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([productId, task]) => {
            const completed =
              task.phase === "installed" || task.phase === "uninstalled";
            if (completed) delete desktopOperationRevisions.current[productId];
            return !completed;
          }
        )
      )
    );
    setEnvironmentOperationTasks((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([environmentId, task]) => {
            const completed =
              task.phase === "installed" || task.phase === "uninstalled";
            if (completed) {
              delete environmentOperationRevisions.current[environmentId];
              delete environmentOperations.current[environmentId];
            }
            return !completed;
          }
        )
      )
    );
    const completedCliProductIds = Object.values(cliManagedTasks)
      .filter((task) => task.phase === "completed")
      .map((task) => task.productId);
    setCliManagedTasks((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([productId]) => !completedCliProductIds.includes(productId)
        )
      )
    );
    setCliLogs((current) => {
      const next = { ...current };
      for (const productId of completedCliProductIds) delete next[productId];
      return next;
    });
  };

  const openEnvironmentInstaller = async (environmentId: string) => {
    if (!window.aihubPC) return;
    if (await recheckEnvironmentOperation(environmentId)) return;
    const name = ENVIRONMENT_NAMES[environmentId] || environmentId;
    setEnvironmentPackageStages((current) => ({
      ...current,
      [environmentId]: "opening-install"
    }));
    setEnvironmentMessages((current) => ({
      ...current,
      [environmentId]: uiText("auto.695ac7cdb0aa", { value1: name })
    }));
    try {
      const result =
        await window.aihubPC.openEnvironmentInstaller(environmentId);
      if (result.operationTask) {
        applyEnvironmentOperationTask(result.operationTask);
        return;
      }
      if (result.launched) {
        setEnvironmentPackageStages((current) => ({
          ...current,
          [environmentId]: "awaiting-install"
        }));
      } else {
        await restoreEnvironmentPackage(environmentId, false);
        if (
          automaticEnvironmentFlow.current.snapshot().activeEnvironmentId ===
          environmentId
        ) {
          failAutomaticEnvironmentSetup(
            environmentId,
            result.error || uiText("auto.68d6219c04fb", { value1: name })
          );
        }
      }
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]:
          [result.message, result.warning].filter(Boolean).join("；") ||
          result.error ||
          uiText("auto.633a7cff13e6")
      }));
    } catch (error) {
      await restoreEnvironmentPackage(environmentId, false);
      if (
        automaticEnvironmentFlow.current.snapshot().activeEnvironmentId ===
        environmentId
      ) {
        failAutomaticEnvironmentSetup(
          environmentId,
          error instanceof Error ? error.message : uiText("auto.68d6219c04fb", { value1: name })
        );
      }
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]:
          error instanceof Error ? error.message : uiText("auto.633a7cff13e6")
      }));
    }
  };

  const failAutomaticEnvironmentSetup = (
    environmentId: string,
    message: string
  ) => {
    autoOpenEnvironmentInstallers.current.delete(environmentId);
    const productIds = automaticEnvironmentFlow.current.fail(environmentId);
    for (const productId of productIds) {
      pendingEnvironmentProducts.current.delete(productId);
      setProductErrors((current) => ({
        ...current,
        [productId]: message
      }));
      setProductStages((current) => ({
        ...current,
        [productId]: "error"
      }));
    }
  };

  const continueAutomaticEnvironmentInstalls = async () => {
    if (!window.aihubPC || advancingEnvironmentFlow.current) return;
    advancingEnvironmentFlow.current = true;
    try {
      const report = await refreshEnvironmentReport(false);
      const installedIds = report.checks
        .filter((check) => check.installed)
        .map((check) => check.id);
      const readyProductIds =
        automaticEnvironmentFlow.current.readyProducts(installedIds);
      for (const productId of readyProductIds) {
        const product = pendingEnvironmentProducts.current.get(productId);
        pendingEnvironmentProducts.current.delete(productId);
        if (!product) continue;
        setProductMissing((current) => ({ ...current, [productId]: [] }));
        window.setTimeout(() => {
          void runExclusiveProductAction(
            product.id,
            uiText("auto.e8f88f51ccb0"),
            () => installUsingUnifiedRule(product)
          );
        }, 0);
      }

      const nextEnvironmentId =
        automaticEnvironmentFlow.current.next(installedIds);
      if (!nextEnvironmentId) return;
      autoOpenEnvironmentInstallers.current.add(nextEnvironmentId);
      for (const productId of automaticEnvironmentFlow.current.snapshot()
        .pendingProductIds) {
        setProductStages((current) => ({
          ...current,
          [productId]: "detecting"
        }));
        setProductErrors((current) => ({
          ...current,
          [productId]: uiText("auto.f48a5c1296de", { value1: ENVIRONMENT_NAMES[nextEnvironmentId] || nextEnvironmentId })
        }));
      }
      await installEnvironment(nextEnvironmentId);
    } catch (error) {
      const activeEnvironmentId =
        automaticEnvironmentFlow.current.snapshot().activeEnvironmentId;
      if (activeEnvironmentId) {
        failAutomaticEnvironmentSetup(
          activeEnvironmentId,
          error instanceof Error ? error.message : uiText("auto.ffa5be06b050")
        );
      }
    } finally {
      advancingEnvironmentFlow.current = false;
    }
  };

  const beginAutomaticEnvironmentSetup = async (product: Product) => {
    const report = await refreshEnvironmentReport(false);
    const installedIds = new Set(
      report.checks
        .filter((check) => check.installed)
        .map((check) => check.id)
    );
    const missing = product.requirements.filter(
      (environmentId) => !installedIds.has(environmentId)
    );
    if (!missing.length) {
      await installUsingUnifiedRule(product);
      return;
    }
    pendingEnvironmentProducts.current.set(product.id, product);
    automaticEnvironmentFlow.current.enqueue(product.id, missing);
    setProductMissing((current) => ({ ...current, [product.id]: missing }));
    await continueAutomaticEnvironmentInstalls();
  };

  const openEnvironmentLocation = async (environmentId: string) => {
    if (!window.aihubPC) return;
    const opened = await window.aihubPC.openEnvironmentLocation(environmentId);
    if (!opened) {
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]: uiText("auto.edb6262845cf")
      }));
    }
  };

  const uninstallEnvironment = async (environmentId: string) => {
    if (!window.aihubPC) return;
    if (await recheckEnvironmentOperation(environmentId)) return;
    const name = ENVIRONMENT_NAMES[environmentId] || environmentId;
    setEnvironmentPackageStages((current) => ({
      ...current,
      [environmentId]: "opening-uninstall"
    }));
    setEnvironmentMessages((current) => ({
      ...current,
      [environmentId]: uiText("auto.97ed8e6fa1d6", { value1: name })
    }));
    try {
      const result = await window.aihubPC.uninstallEnvironment(environmentId);
      if (result.operationTask) {
        applyEnvironmentOperationTask(result.operationTask);
        return;
      }
      if (result.canceled) {
        setEnvironmentPackageStages((current) => ({
          ...current,
          [environmentId]: "idle"
        }));
        return;
      }
      setEnvironmentPackageStages((current) => ({
        ...current,
        [environmentId]: result.launched ? "awaiting-uninstall" : "idle"
      }));
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]:
          [result.message, result.warning].filter(Boolean).join("；") ||
          result.error ||
          uiText("auto.90301fb062a2")
      }));
    } catch (error) {
      setEnvironmentPackageStages((current) => ({
        ...current,
        [environmentId]: "idle"
      }));
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]:
          error instanceof Error
            ? error.message
            : uiText("auto.90301fb062a2")
      }));
    }
  };

  const restoreDownloadedOrReady = async (
    product: Product | string,
    isCurrent: () => boolean = () => true,
    forceOperationCompletion = false
  ): Promise<ProductPreparation> => {
    const productId = typeof product === "string" ? product : product.id;
    let task: ManagedDownloadTask | null = null;
    try {
      task = (await window.aihubPC?.getDownloadTask?.(productId)) || null;
    } catch {
      task = null;
    }
    if (!isCurrent()) return "active";
    const taskPreparation = getDownloadTaskPreparation(task);
    if (task && taskPreparation) {
      applyManagedDownloadTask(task);
      if (forceOperationCompletion && taskPreparation === "downloaded") {
        setProductStages((current) => ({
          ...current,
          [productId]: "downloaded"
        }));
      }
      return taskPreparation;
    }
    let record: DownloadRecord | null = null;
    try {
      record = (await window.aihubPC?.getDownloadRecord(productId)) || null;
    } catch {
      record = null;
    }
    if (!isCurrent()) return "active";
    if (record) {
      setProductFiles((current) => ({
        ...current,
        [productId]: record!.filePath
      }));
      setProductStages((current) => ({
        ...current,
        [productId]: forceOperationCompletion
          ? "downloaded"
          : preserveInstallationStage(current[productId], "downloaded")
      }));
      return "downloaded";
    } else {
      setProductStages((current) => ({
        ...current,
        [productId]: forceOperationCompletion
          ? "ready"
          : preserveInstallationStage(current[productId], "ready")
      }));
      return "ready";
    }
  };

  const detectForProduct = async (
    product: Product,
    intent: ManagedInstallIntent = "install"
  ): Promise<ProductPreparation> => {
    const generation = beginProductOperation(product.id);
    setProductErrors((current) => ({ ...current, [product.id]: "" }));
    setProductStages((current) => ({ ...current, [product.id]: "detecting" }));
    let report: EnvironmentReport;
    try {
      report = await runEnvironmentScan();
    } catch (error) {
      if (!isCurrentProductOperation(product.id, generation)) return "active";
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error ? error.message : uiText("auto.c8c0c43af477")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: "detection-error"
      }));
      return "error";
    }
    if (!isCurrentProductOperation(product.id, generation)) return "active";
    const missing = product.requirements.filter(
      (requirement) =>
        !report.checks.some(
          (check) => check.id === requirement && check.installed
        )
    );
    setProductMissing((current) => ({ ...current, [product.id]: missing }));
    if (resolveProductBehavior(product).managedDesktop && window.aihubPC) {
      let desktopStatus: DesktopStatus;
      try {
        desktopStatus = await window.aihubPC.getDesktopStatus(product.id);
      } catch (error) {
        if (!isCurrentProductOperation(product.id, generation)) return "active";
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            error instanceof Error
              ? error.message
              : uiText("auto.3f79af99e698")
        }));
        setProductStages((current) => ({
          ...current,
          [product.id]: "detection-error"
        }));
        return "error";
      }
      if (!isCurrentProductOperation(product.id, generation)) return "active";
      setDesktopStatuses((current) => ({
        ...current,
        [product.id]: desktopStatus
      }));
      if (desktopStatus.installed) {
        installedEvidenceProducts.current.add(product.id);
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            productStages[product.id] === "awaiting-uninstall"
              ? current[product.id]
              : ""
        }));
        if (intent === "install") {
          setProductStages((current) => ({
            ...current,
            [product.id]:
              current[product.id] === "awaiting-uninstall"
                ? "awaiting-uninstall"
                : "installed"
          }));
          return "installed";
        }
        if (missing.length) {
          setProductStages((current) => ({
            ...current,
            [product.id]: "blocked"
          }));
          return "blocked";
        }
        if (intent === "refresh") {
          setProductStages((current) => ({
            ...current,
            [product.id]: "ready"
          }));
          return "ready";
        }
        return await restoreDownloadedOrReady(product);
      }
      installedEvidenceProducts.current.delete(product.id);
      if (desktopStatus.detection === "unknown") {
        setProductErrors((current) => ({
          ...current,
          [product.id]: uiText("auto.a95e2a95a834")
        }));
        setProductStages((current) => ({
          ...current,
          [product.id]:
            current[product.id] === "awaiting-verification" ||
            current[product.id] === "awaiting-uninstall"
              ? current[product.id]
              : "detection-error"
        }));
        return "error";
      }
      setProductErrors((current) => ({ ...current, [product.id]: "" }));
      if (missing.length) {
        setProductStages((current) => ({
          ...current,
          [product.id]: "blocked"
        }));
        return "blocked";
      }
      return await restoreDownloadedOrReady(product);
    }
    if (resolveProductBehavior(product).managedCli && window.aihubPC) {
      let status: CliStatus;
      try {
        status = await window.aihubPC.getCliStatus(product.id);
      } catch (error) {
        if (!isCurrentProductOperation(product.id, generation)) return "active";
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            error instanceof Error
              ? error.message
              : uiText("auto.34948cd2cea4")
        }));
        setProductStages((current) => ({
          ...current,
          [product.id]: "detection-error"
        }));
        return "error";
      }
      if (!isCurrentProductOperation(product.id, generation)) return "active";
      setCliStatuses((current) => ({
        ...current,
        [product.id]: status
      }));
      if (status.installed) {
        setProductErrors((current) => ({ ...current, [product.id]: "" }));
        setCliVersions((current) => ({
          ...current,
          [product.id]: status.version
        }));
        setProductStages((current) => ({
          ...current,
          [product.id]: "installed"
        }));
        return "installed";
      }
      if (status.detection === "unknown") {
        setProductErrors((current) => ({
          ...current,
          [product.id]: uiText("auto.34948cd2cea4")
        }));
        setProductStages((current) => ({
          ...current,
          [product.id]: "detection-error"
        }));
        return "error";
      }
      setProductErrors((current) => ({ ...current, [product.id]: "" }));
    }
    setProductStages((current) => ({
      ...current,
      [product.id]: missing.length ? "blocked" : "ready"
    }));
    return missing.length ? "blocked" : "ready";
  };

  const downloadProduct = async (
    product: Product,
    fresh = false
  ) => {
    const enabledProduct = resolveProductActionContext(product.id, true);
    if (!enabledProduct) {
      setProductErrors((current) => ({
        ...current,
        [product.id]: uiText("auto.0174b6fcadff")
      }));
      return;
    }
    product = enabledProduct;
    if (!product.download) {
      window.open(product.website);
      return;
    }
    if (!window.aihubPC) {
      setProductErrors((current) => ({
        ...current,
        [product.id]: uiText("auto.680d9556526a")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: "error"
      }));
      return;
    }
    setProductErrors((current) => ({ ...current, [product.id]: "" }));
    try {
      if (hasManagedDownloadQueueApi()) {
        const result = fresh
          ? await window.aihubPC!.retryManagedDownload({
              productId: product.id,
              artifact: product.download
            })
          : await window.aihubPC!.enqueueManagedDownload({
              productId: product.id,
              artifact: product.download
            });
        if (result.task) {
          applyManagedDownloadQueueTask(result.task);
          requestManagedDownloadQueueStatus(product.id, result.task.taskId);
        }
        if (result.reused) {
          setProductErrors((current) => ({
            ...current,
            [product.id]: uiText("downloadQueue.alreadyQueued")
          }));
        } else if (!result.ok) {
          setProductErrors((current) => ({
            ...current,
            [product.id]: uiText("downloadQueue.failed")
          }));
          if (!result.task) {
            setProductStages((current) => ({
              ...current,
              [product.id]: installedEvidenceProducts.current.has(product.id)
                ? "installed"
                : "error"
            }));
          }
        }
        return;
      }
      if (fresh) {
        downloadTaskRevisions.current.beginFreshDownload(product.id);
      }
      const result = fresh
        ? await window.aihubPC.refreshDownload(product.id, product.download)
        : await window.aihubPC.startDownload(product.id, product.download);
      if (fresh) {
        if (result.ok && result.task) {
          applyManagedDownloadTask(result.task, { freshStart: true });
        } else {
          downloadTaskRevisions.current.cancelFreshDownload(product.id);
          if (result.task) applyManagedDownloadTask(result.task);
        }
      } else if (result.task) {
        applyManagedDownloadTask(result.task);
      }
      if (!result.ok) {
        setProductErrors((current) => ({
          ...current,
          [product.id]: result.error || uiText("auto.8d0943c7356b")
        }));
        if (!result.task) {
          setProductStages((current) => ({
            ...current,
            [product.id]: installedEvidenceProducts.current.has(product.id)
              ? "installed"
              : "error"
          }));
        }
      }
    } catch (error) {
      if (fresh) {
        downloadTaskRevisions.current.cancelFreshDownload(product.id);
      }
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error ? error.message : uiText("auto.8d0943c7356b")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: installedEvidenceProducts.current.has(product.id)
          ? "installed"
          : "error"
      }));
    }
  };

  const pauseProductDownload = async (product: Product) => {
    await pauseDownloadTask(product.id);
  };

  const cancelProductDownload = (product: Product, trigger: HTMLElement) =>
    requestDownloadCancellation(
      product.id,
      hasManagedDownloadQueueApi() && managedDownloadQueueTasks[product.id]
        ? "queue"
        : "legacy",
      undefined,
      trigger
    );

  const relocateProductDownload = async (product: Product, trigger: HTMLElement) => {
    if (!window.aihubPC) return;
    const selection = await chooseDownloadDirectory();
    if (selection.selectionCanceled || !selection.downloadDirectory) {
      return;
    }
    requestDownloadCancellation(product.id, "legacy", "relocate", trigger);
  };

  const confirmDownloadCancellation = async () => {
    const pending = pendingDownloadCancellation;
    if (!pending || !window.aihubPC || downloadCancellationBusy) return;
    setDownloadCancellationBusy(true);
    try {
      let cancellationSucceeded = false;
      if (pending.source === "queue") {
        const result = await window.aihubPC.cancelManagedDownload({
            productId: pending.productId,
            taskId: pending.taskId,
            confirmed: true
          });
        if (result.task) applyManagedDownloadQueueTask(result.task);
        if (!result.task && result.ok) {
          removeManagedDownloadQueueTask(pending.productId);
        }
        cancellationSucceeded = result.ok;
      } else {
        const result = await window.aihubPC.cancelDownload({
            productId: pending.productId,
            taskId: pending.taskId,
            confirmed: true
          });
        if (result.task) applyManagedDownloadTask(result.task);
        if (result.ok && !result.task) {
          removeClearedDownloadTask(pending.productId);
        }
        cancellationSucceeded = result.ok;
      }
      if (!cancellationSucceeded) {
        setDownloadTaskError(pending.productId, uiText("auto.1768ce955e7d"));
        return;
      }
      if (pending.afterConfirm === "relocate") {
        const product = catalogAllVendors
          .flatMap((vendor) => vendor.products)
          .find((entry) => entry.id === pending.productId);
        if (product) await downloadProduct(product);
      }
    } catch {
      setDownloadTaskError(pending.productId, uiText("auto.1768ce955e7d"));
    } finally {
      setDownloadCancellationBusy(false);
      setPendingDownloadCancellation(null);
    }
  };

  const installProduct = async (
    product: Product,
    intent: ManagedInstallIntent = "install"
  ) => {
    if (!window.aihubPC) return;
    const enabledProduct = resolveProductActionContext(product.id, true);
    if (!enabledProduct) {
      setProductErrors((current) => ({
        ...current,
        [product.id]: uiText("auto.0174b6fcadff")
      }));
      return;
    }
    product = enabledProduct;
    setProductErrors((current) => ({ ...current, [product.id]: "" }));
    setProductStages((current) => ({
      ...current,
      [product.id]: "launching-installer"
    }));
    try {
      const result = await window.aihubPC.launchInstaller(product.id, intent);
      if (result.operationTask) {
        applyDesktopOperationTask(result.operationTask);
        if (!result.launched) {
          if (result.error) {
            setProductErrors((current) => ({
              ...current,
              [product.id]: result.error!
            }));
          }
          return;
        }
      }
      if (result.canceled) {
        setProductStages((current) => ({
          ...current,
          [product.id]: intent === "install" ? "downloaded" : "installed"
        }));
        return;
      }
      if (!result.launched) {
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            result.error ||
            uiText("auto.41ca2609829e")
        }));
        setProductStages((current) => ({
          ...current,
          [product.id]: intent === "install" ? "downloaded" : "installed"
        }));
        return;
      }
      if (!result.operationTask) {
        if (result.verificationMode === "manual-installer") {
          setProductErrors((current) => ({
            ...current,
            [product.id]: result.warning || ""
          }));
          setProductStages((current) => ({
            ...current,
            [product.id]: "downloaded"
          }));
          return;
        }
        if (result.verificationMode === "installer-owned-maintenance") {
          setProductErrors((current) => ({
            ...current,
            [product.id]: result.warning || ""
          }));
          setProductStages((current) => ({
            ...current,
            [product.id]: "installed"
          }));
          return;
        }
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            result.warning ||
            uiText("auto.4db2a049b661")
        }));
        setProductStages((current) => ({
          ...current,
          [product.id]: "awaiting-verification"
        }));
      }
    } catch (error) {
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error
            ? uiText("auto.370eeb21fd82", { value1: error.message })
            : uiText("auto.283624960d3b")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]:
          intent === "install"
            ? preserveInstallationStage(current[product.id], "downloaded")
            : "installed"
      }));
    }
  };

  const installDownloadedProduct = async (
    product: Product,
    intent: ManagedInstallIntent = "install"
  ) => {
    if (!window.aihubPC) return;
    const enabledProduct = resolveProductActionContext(product.id, true);
    if (!enabledProduct) {
      setProductErrors((current) => ({
        ...current,
        [product.id]: uiText("auto.0174b6fcadff")
      }));
      return;
    }
    product = enabledProduct;
    try {
      await runDownloadedPackageAction({
        productId: product.id,
        getDownloadRecord: (productId) =>
          window.aihubPC!.getDownloadRecord(productId),
        install: async (record) => {
          setProductFiles((current) => ({
            ...current,
            [product.id]: record.filePath
          }));
          await installProduct(product, intent);
        },
        download: async () => {
          setProductFiles((current) => {
            const next = { ...current };
            delete next[product.id];
            return next;
          });
          await downloadProduct(product, intent === "refresh");
        }
      });
    } catch (error) {
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error
            ? uiText("auto.0a6cbfe8699c", { value1: error.message })
            : uiText("auto.7a0a26f1501f")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: "error"
      }));
    }
  };

  const recheckDesktopInstall = async (product: Product) => {
    if (!window.aihubPC) return;
    try {
      const knownOperation = desktopOperationRevisions.current[product.id];
      const operationTask = knownOperation
        ? (await window.aihubPC.checkDesktopOperation?.(
            product.id,
            knownOperation.generation,
            knownOperation.operationId
          )) || null
        : null;
      if (operationTask) {
        applyDesktopOperationTask(operationTask);
        return;
      }
      if (knownOperation) {
        setDesktopOperationTasks((current) => {
          const next = { ...current };
          delete next[product.id];
          return next;
        });
      }
    } catch (error) {
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error
            ? uiText("auto.de1e74fd539c", { value1: error.message })
            : uiText("auto.d509aee8e81f")
      }));
      return;
    }
    const status = await window.aihubPC.getDesktopStatus(product.id);
    setDesktopStatuses((current) => ({ ...current, [product.id]: status }));
    if (status.installed) {
      installedEvidenceProducts.current.add(product.id);
      setProductErrors((current) => ({ ...current, [product.id]: "" }));
      setProductStages((current) => ({ ...current, [product.id]: "installed" }));
    } else {
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          status.detection === "unknown"
            ? uiText("auto.63c4b45bea14")
            : uiText("auto.ca9aab2264d2")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: "awaiting-verification"
      }));
    }
  };

  const uninstallDesktopProduct = async (product: Product) => {
    if (!window.aihubPC || !desktopStatuses[product.id]?.canUninstall) return;
    const uninstallCopy = getDesktopUninstallPresentation(
      product.id,
      desktopStatuses[product.id]?.uninstallMode,
      language
    );
    setProductErrors((current) => ({ ...current, [product.id]: "" }));
    setProductStages((current) => ({
      ...current,
      [product.id]: "awaiting-uninstall"
    }));
    setProductErrors((current) => ({
      ...current,
      [product.id]: uninstallCopy.preparing
    }));
    try {
      const result = await window.aihubPC.uninstallDesktopProduct(product.id);
      if (result.operationTask) {
        applyDesktopOperationTask(result.operationTask);
      }
      if (result.canceled) {
        setProductErrors((current) => ({ ...current, [product.id]: "" }));
        setProductStages((current) => ({
          ...current,
          [product.id]: "installed"
        }));
        return;
      }
      if (!result.launched) {
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            result.error || uiText("auto.f1529f55066f")
        }));
        if (!result.operationTask) {
          setProductStages((current) => ({
            ...current,
            [product.id]: "installed"
          }));
        }
        return;
      }
      if (!result.operationTask) {
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            result.warning ||
            result.message ||
            getDesktopUninstallPresentation(
              product.id,
              result.uninstallMode,
              language
            ).launched
        }));
      }
    } catch (error) {
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error
            ? uiText("auto.caf49c3849b1", { value1: error.message })
            : uiText("auto.f681c9099661")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: "installed"
      }));
    }
  };

  const recheckDesktopUninstall = async (product: Product) => {
    if (!window.aihubPC) return;
    const knownOperation = desktopOperationRevisions.current[product.id];
    if (knownOperation) {
      try {
        const operationTask =
          (await window.aihubPC.checkDesktopOperation?.(
            product.id,
            knownOperation.generation,
            knownOperation.operationId
          )) || null;
        if (operationTask) {
          applyDesktopOperationTask(operationTask);
          return;
        }
        setDesktopOperationTasks((current) => {
          const next = { ...current };
          delete next[product.id];
          return next;
        });
      } catch (error) {
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            error instanceof Error
              ? uiText("auto.de1e74fd539c", { value1: error.message })
              : uiText("auto.d509aee8e81f")
        }));
        return;
      }
    }
    const status = await window.aihubPC.getDesktopStatus(product.id);
    setDesktopStatuses((current) => ({ ...current, [product.id]: status }));
    if (status.detection === "absent") {
      installedEvidenceProducts.current.delete(product.id);
      await restoreDownloadedOrReady(product, () => true, true);
      setProductErrors((current) => ({ ...current, [product.id]: "" }));
      return;
    }
    setProductErrors((current) => ({
      ...current,
      [product.id]:
        status.detection === "unknown"
          ? uiText("auto.0afc35a7c46e")
          : getDesktopUninstallPresentation(
              product.id,
              status.uninstallMode,
              language
            ).stillInstalled
    }));
    setProductStages((current) => ({
      ...current,
      [product.id]: "awaiting-uninstall"
    }));
  };

  const checkDesktopOperationTask = async (productId: string) => {
    const product = resolveProductActionContext(productId);
    if (!product) {
      setDownloadTaskError(productId, uiText("auto.0174b6fcadff"));
      return;
    }
    const task = desktopOperationTasks[productId];
    if (task?.operation === "uninstall") {
      await recheckDesktopUninstall(product);
    } else {
      await recheckDesktopInstall(product);
    }
  };

  const checkEnvironmentOperationTask = async (environmentId: string) => {
    await recheckEnvironmentOperation(environmentId);
  };

  const clearCliManagedTask = (productId: string) => {
    setCliManagedTasks((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setCliLogs((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  };

  const resolveProductActionContext = (
    productId: string,
    requireCatalogEnabled = false
  ) =>
    resolveManagedProductActionContext({
      productId,
      vendors: managedActionContextSnapshot.current.vendors,
      localInventory: managedActionContextSnapshot.current.localInventory,
      requireCatalogEnabled
    });

  const chooseCliDirectory = async () => {
    const settings = window.aihubPC
      ? await window.aihubPC.chooseCliDirectory()
      : { downloadDirectory: "", cliInstallDirectory: `D:\\${BRAND.name}\\CLI` };
    setCliInstallDirectory(settings.cliInstallDirectory || "");
    return settings.cliInstallDirectory || "";
  };

  const deployCli = async (
    product: Product,
    requestedIntent: "install" | "update" | "repair" = "install"
  ) => {
    const enabledProduct = resolveProductActionContext(product.id, true);
    if (!enabledProduct) {
      setProductErrors((current) => ({
        ...current,
        [product.id]: uiText("auto.0174b6fcadff")
      }));
      return;
    }
    product = enabledProduct;
    let intent = requestedIntent;
    if (intent === "install" && window.aihubPC) {
      try {
        const current = await window.aihubPC.getCliStatus(product.id);
        setCliStatuses((statuses) => ({ ...statuses, [product.id]: current }));
        if (current.ownership === "stale" && current.canRepair) intent = "repair";
      } catch {
        // The normal deployment path will surface a sanitized detection error.
      }
    }
    let directory = cliInstallDirectory;
    const requiresInstallDirectory =
      cliStatuses[product.id]?.requiresInstallDirectory !== false;
    if (requiresInstallDirectory && !directory) {
      directory = await chooseCliDirectory();
    }
    if ((requiresInstallDirectory && !directory) || !window.aihubPC) return;

    const generation = beginProductOperation(product.id);
    updateCliManagedTask(
      product.id,
      generation,
      intent,
      "running",
      uiText("auto.514d92d737e1")
    );
    setProductErrors((current) => ({ ...current, [product.id]: "" }));
    setCliLogs((current) => ({ ...current, [product.id]: [] }));
    setProductStages((current) => ({ ...current, [product.id]: "deploying" }));
    let result: CliDeployResult;
    try {
      result = window.aihubPC.reconcileCli
        ? await window.aihubPC.reconcileCli(product.id, intent)
        : await window.aihubPC.deployCli(product.id);
    } catch (error) {
      if (!isCurrentProductOperation(product.id, generation)) return;
      updateCliManagedTask(
        product.id,
        generation,
        intent,
        "failed",
        error instanceof Error ? error.message : uiText("auto.29d1d9dff3c7")
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]: error instanceof Error ? error.message : uiText("auto.29d1d9dff3c7")
      }));
      setProductStages((current) => ({ ...current, [product.id]: "error" }));
      return;
    }
    if (!isCurrentProductOperation(product.id, generation)) return;
    if (result.canceled) {
      updateCliManagedTask(
        product.id,
        generation,
        intent,
        "canceled",
        uiText("auto.fbd495eb2c7e")
      );
      setProductStages((current) => ({ ...current, [product.id]: "ready" }));
      return;
    }
    if (!result.ok) {
      updateCliManagedTask(
        product.id,
        generation,
        intent,
        "failed",
        result.error || uiText("auto.29d1d9dff3c7")
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]: result.error || uiText("auto.29d1d9dff3c7")
      }));
      setProductStages((current) => ({ ...current, [product.id]: "error" }));
      return;
    }
    setCliVersions((current) => ({
      ...current,
      [product.id]: result.version || ""
    }));
    let status: CliStatus;
    try {
      status = await window.aihubPC.getCliStatus(product.id);
    } catch (error) {
      if (!isCurrentProductOperation(product.id, generation)) return;
      updateCliManagedTask(
        product.id,
        generation,
        intent,
        "failed",
        error instanceof Error
          ? error.message
          : uiText("auto.88e97dd1aa48")
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error
            ? error.message
            : uiText("auto.88e97dd1aa48")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: "detection-error"
      }));
      return;
    }
    if (!isCurrentProductOperation(product.id, generation)) return;
    setCliStatuses((current) => ({ ...current, [product.id]: status }));
    if (!status.installed) {
      const message =
        status.detection === "unknown"
          ? uiText("auto.5958c31c4bdc")
          : uiText("auto.486674a9aa1f");
      updateCliManagedTask(
        product.id,
        generation,
        intent,
        "failed",
        message
      );
      setCliVersions((current) => ({ ...current, [product.id]: "" }));
      setProductErrors((current) => ({
        ...current,
        [product.id]: message
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]:
          status.detection === "unknown" ? "detection-error" : "error"
      }));
      return;
    }
    if (result.warning) {
      setProductErrors((current) => ({
        ...current,
        [product.id]: result.warning || ""
      }));
    }
    updateCliManagedTask(
      product.id,
      generation,
      intent,
      "completed",
      result.warning || uiText("auto.60482f487ebd", { value1: catalogDisplayField(product, "name", language) })
    );
    setProductStages((current) => ({ ...current, [product.id]: "installed" }));
  };

  const uninstallCli = async (
    product: Product,
    knownStatus = cliStatuses[product.id]
  ) => {
    if (!window.aihubPC || !knownStatus?.canUninstall) return;
    const generation = beginProductOperation(product.id);
    updateCliManagedTask(
      product.id,
      generation,
      "uninstall",
      "running",
      uiText("auto.274be5f39ce7")
    );
    setProductErrors((current) => ({ ...current, [product.id]: "" }));
    setCliLogs((current) => ({ ...current, [product.id]: [] }));
    setProductStages((current) => ({
      ...current,
      [product.id]: "removing-cli"
    }));
    let result: CliUninstallResult;
    try {
      result = await window.aihubPC.uninstallCli(product.id);
    } catch (error) {
      if (!isCurrentProductOperation(product.id, generation)) return;
      let status: CliStatus;
      try {
        status = await window.aihubPC.getCliStatus(product.id);
      } catch {
        if (!isCurrentProductOperation(product.id, generation)) return;
        updateCliManagedTask(
          product.id,
          generation,
          "uninstall",
          "failed",
          error instanceof Error ? error.message : uiText("auto.f52a1914e794")
        );
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            error instanceof Error ? error.message : uiText("auto.f52a1914e794")
        }));
        setProductStages((current) => ({
          ...current,
          [product.id]: "detection-error"
        }));
        return;
      }
      if (!isCurrentProductOperation(product.id, generation)) return;
      setCliStatuses((current) => ({ ...current, [product.id]: status }));
      if (status.detection === "absent") {
        updateCliManagedTask(
          product.id,
          generation,
          "uninstall",
          "completed",
          uiText("auto.f2191c77d0e6", { value1: catalogDisplayField(product, "name", language) })
        );
        setCliVersions((current) => ({ ...current, [product.id]: "" }));
        setProductErrors((current) => ({ ...current, [product.id]: "" }));
        setProductStages((current) => ({ ...current, [product.id]: "ready" }));
        return;
      }
      updateCliManagedTask(
        product.id,
        generation,
        "uninstall",
        "failed",
        error instanceof Error ? error.message : uiText("auto.7274d68dcc45")
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]: error instanceof Error ? error.message : uiText("auto.7274d68dcc45")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: status.installed ? "installed" : "detection-error"
      }));
      return;
    }
    if (!isCurrentProductOperation(product.id, generation)) return;
    if (result.canceled) {
      updateCliManagedTask(
        product.id,
        generation,
        "uninstall",
        "canceled",
        uiText("auto.cc4ad91968e7")
      );
      setProductStages((current) => ({
        ...current,
        [product.id]: "installed"
      }));
      return;
    }
    let status = result.status;
    if (!status) {
      try {
        status = await window.aihubPC.getCliStatus(product.id);
      } catch (error) {
        if (!isCurrentProductOperation(product.id, generation)) return;
        updateCliManagedTask(
          product.id,
          generation,
          "uninstall",
          "failed",
          error instanceof Error
            ? error.message
            : uiText("auto.ad149d963fb5")
        );
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            error instanceof Error
              ? error.message
              : uiText("auto.ad149d963fb5")
        }));
        setProductStages((current) => ({
          ...current,
          [product.id]: "detection-error"
        }));
        return;
      }
    }
    if (!isCurrentProductOperation(product.id, generation)) return;
    setCliStatuses((current) => ({ ...current, [product.id]: status }));
    if (!result.ok) {
      if (status.detection === "absent") {
        updateCliManagedTask(
          product.id,
          generation,
          "uninstall",
          "completed",
          uiText("auto.f2191c77d0e6", { value1: catalogDisplayField(product, "name", language) })
        );
        setCliVersions((current) => ({ ...current, [product.id]: "" }));
        setProductErrors((current) => ({ ...current, [product.id]: "" }));
        setProductStages((current) => ({ ...current, [product.id]: "ready" }));
        return;
      }
      updateCliManagedTask(
        product.id,
        generation,
        "uninstall",
        "failed",
        result.error || uiText("auto.7274d68dcc45")
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]: result.error || uiText("auto.7274d68dcc45")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: status.installed ? "installed" : "detection-error"
      }));
      return;
    }
    if (status.detection !== "absent") {
      const message =
        status.detection === "unknown"
          ? uiText("auto.210b7987d8db")
          : uiText("auto.d91ae5f7f370");
      updateCliManagedTask(
        product.id,
        generation,
        "uninstall",
        "failed",
        message
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]: message
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: status.installed ? "installed" : "detection-error"
      }));
      return;
    }
    setProductErrors((current) => ({ ...current, [product.id]: "" }));
    setCliVersions((current) => ({ ...current, [product.id]: "" }));
    updateCliManagedTask(
      product.id,
      generation,
      "uninstall",
      "completed",
      uiText("auto.f2191c77d0e6", { value1: catalogDisplayField(product, "name", language) })
    );
    setProductStages((current) => ({ ...current, [product.id]: "ready" }));
  };

  const recheckCliManagedTask = async (productId: string) => {
    const task = cliManagedTasks[productId];
    const product = resolveProductActionContext(productId);
    if (!task || !product || !window.aihubPC || task.phase === "running") return;
    const generation = beginProductOperation(productId);
    updateCliManagedTask(
      productId,
      generation,
      task.operation,
      "running",
      uiText("auto.3558a2b2568a")
    );
    let status: CliStatus;
    try {
      status = await window.aihubPC.getCliStatus(productId);
    } catch (error) {
      if (!isCurrentProductOperation(productId, generation)) return;
      const message =
        error instanceof Error ? error.message : uiText("auto.71b9d8abc4ea");
      updateCliManagedTask(
        productId,
        generation,
        task.operation,
        "failed",
        message
      );
      setProductErrors((current) => ({ ...current, [productId]: message }));
      setProductStages((current) => ({
        ...current,
        [productId]: "detection-error"
      }));
      return;
    }
    if (!isCurrentProductOperation(productId, generation)) return;
    setCliStatuses((current) => ({ ...current, [productId]: status }));
    setCliVersions((current) => ({
      ...current,
      [productId]: status.installed ? status.version : ""
    }));
    setProductStages((current) => ({
      ...current,
      [productId]:
        status.detection === "unknown"
          ? "detection-error"
          : status.installed
            ? "installed"
            : "ready"
    }));

    const completed =
      (task.operation !== "uninstall" && status.installed) ||
      (task.operation === "uninstall" && status.detection === "absent");
    if (completed) {
      const message =
        task.operation !== "uninstall"
          ? uiText("auto.0c14c44b2527", { value1: catalogDisplayField(product, "name", language) })
          : uiText("auto.32422ac50536", { value1: catalogDisplayField(product, "name", language) });
      updateCliManagedTask(
        productId,
        generation,
        task.operation,
        "completed",
        message
      );
      setProductErrors((current) => ({ ...current, [productId]: "" }));
      return;
    }

    const message =
      status.detection === "unknown"
        ? uiText("auto.1cf24902d6d5")
        : task.operation !== "uninstall"
          ? uiText("auto.0212bbe4a6ca", { value1: catalogDisplayField(product, "name", language) })
          : uiText("auto.64cea3af67fd", { value1: catalogDisplayField(product, "name", language) });
    updateCliManagedTask(
      productId,
      generation,
      task.operation,
      "failed",
      message
    );
    setProductErrors((current) => ({ ...current, [productId]: message }));
  };

  const retryCliManagedTask = async (productId: string) => {
    const task = cliManagedTasks[productId];
    const product = resolveProductActionContext(
      productId,
      task?.operation !== "uninstall"
    );
    if (!task || !product || !window.aihubPC || task.phase === "running") return;
    if (task.operation !== "uninstall") {
      await deployCli(product, task.operation);
      return;
    }
    let status: CliStatus;
    try {
      status = await window.aihubPC.getCliStatus(productId);
    } catch {
      await recheckCliManagedTask(productId);
      return;
    }
    setCliStatuses((current) => ({ ...current, [productId]: status }));
    if (!status.canUninstall) {
      await recheckCliManagedTask(productId);
      return;
    }
    await uninstallCli(product, status);
  };

  const changeTheme = (next: "light" | "dark") => {
    setColorScheme(next);
    document.documentElement.dataset.theme = next;
  };

  const changeLanguage = (next: Language) => {
    setActiveLanguage(next);
    setLanguage(next);
    document.documentElement.lang = createLanguage(next).documentLocale;
    void window.aihubPC?.setLanguage(next);
  };

  const checkForUpdate = async (announce = false) => {
    setCheckingUpdate(true);
    setUpdateInstallMessage("");
    try {
      const result = window.aihubPC
        ? await window.aihubPC.checkForUpdate()
        : {
            status: "disabled" as const,
            currentVersion: packageJson.version,
            message: uiText("auto.92ae7c88cf13")
          };
      setUpdateResult(result);
      if (announce) {
        notifications.show({
          id: "client-update-check",
          title: uiText("update.version", { value1: result.currentVersion }),
          message: runtimeMessage(result.message),
          color:
            result.status === "error"
              ? "red"
              : result.status === "disabled"
                ? "yellow"
                : "aiHubCyan"
        });
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    void checkForUpdate(false).catch(() => undefined);
  }, []);

  const installUpdate = async () => {
    if (!window.aihubPC || installingUpdate) return;
    setInstallingUpdate(true);
    setUpdateInstallMessage(uiText("auto.699599ce3495"));
    try {
      const result = await window.aihubPC.openUpdateDownload();
      if (result.ok) {
        const message = result.warning
          ? uiText("auto.a129621fd2d5", { value1: result.warning })
          : uiText("auto.79e4bb930e5c");
        setUpdateInstallMessage(message);
        notifications.show({
          id: "client-update-download",
          title: uiText("update.installNow"),
          message,
          color: result.warning ? "yellow" : "aiHubCyan"
        });
        return;
      }
      const message = result.error || uiText("auto.d308fd9d9d27");
      setUpdateInstallMessage(message);
      notifications.show({
        id: "client-update-download",
        title: uiText("update.installNow"),
        message,
        color: "red"
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : uiText("auto.d308fd9d9d27");
      setUpdateInstallMessage(message);
      notifications.show({
        id: "client-update-download",
        title: uiText("update.installNow"),
        message,
        color: "red"
      });
    } finally {
      setInstallingUpdate(false);
    }
  };

  const runExclusiveProductAction = async (
    productId: string,
    label: string,
    action: () => Promise<void>
  ) => {
    if (activeProductActions.current.has(productId)) {
      setProductErrors((current) => ({
        ...current,
        [productId]: uiText("auto.0225cb463342", { value1: label })
      }));
      return;
    }
    activeProductActions.current.add(productId);
    try {
      await action();
    } finally {
      activeProductActions.current.delete(productId);
    }
  };

  const installUsingUnifiedRule = async (
    product: Product,
    intent: ManagedInstallIntent = "install"
  ) => {
    const behavior = resolveProductBehavior(product);
    if (!behavior.managedCli && !behavior.managedDesktop) {
      window.open(behavior.directUrl);
      return;
    }

    if (behavior.managedDesktop && product.download) {
      if (intent === "refresh") {
        await downloadProduct(product, true);
      } else {
        await installDownloadedProduct(product, intent);
      }
      return;
    }

    if (behavior.managedDesktop) {
      window.open(product.website);
      return;
    }

    const continueInstall = async (preparation: ProductPreparation) => {
      if (preparation === "downloaded") {
        await installDownloadedProduct(product, intent);
        return;
      }
      if (preparation !== "ready") return;
      if (behavior.managedCli) {
        await deployCli(product);
        return;
      }
      await downloadProduct(product, intent === "refresh");
    };

    await runVerifiedManagedInstall({
      detect: () => detectForProduct(product, intent),
      setupDependencies: () => beginAutomaticEnvironmentSetup(product),
      continueInstall
    });
  };

  const requestUnifiedInstall = (
    product: Product,
    intent: ManagedInstallIntent = "install"
  ) => {
    if (product.productType === "desktop-download-only" && !product.download) {
      window.open(product.website);
      return Promise.resolve();
    }
    const enabledProduct = resolveProductActionContext(product.id, true);
    if (!enabledProduct) {
      setProductErrors((current) => ({
        ...current,
        [product.id]: uiText("auto.0174b6fcadff")
      }));
      return Promise.resolve();
    }
    return runExclusiveProductAction(
      enabledProduct.id,
      uiText("auto.e8f88f51ccb0"),
      () => installUsingUnifiedRule(enabledProduct, intent)
    );
  };

  const requestLatestDesktopInstaller = (product: Product) =>
    requestUnifiedInstall(product, "refresh");

  const requestCliUninstall = (product: Product) =>
    runExclusiveProductAction(product.id, uiText("auto.80d0f7903461"), () =>
      uninstallCli(product)
    );
  const requestCliReconcile = (
    product: Product,
    intent: "update" | "repair"
  ) =>
    runExclusiveProductAction(
      product.id,
      intent === "update" ? uiText("cli.update") : uiText("cli.repair"),
      () => deployCli(product, intent)
    );
  const requestOpenCli = async (product: Product) => {
    if (!window.aihubPC) return;
    try {
      const result = await window.aihubPC.openCli(product.id);
      setProductErrors((current) => ({
        ...current,
        [product.id]: result.ok
          ? ""
          : result.error || uiText("product.cliOpenFailed")
      }));
    } catch (error) {
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error
            ? error.message
            : uiText("product.cliOpenFailed")
      }));
    }
  };
  const requestDesktopUninstall = (product: Product) =>
    runExclusiveProductAction(product.id, uiText("auto.06bc14b60f35"), () =>
      uninstallDesktopProduct(product)
    );

  const refreshInstalledManagement = async () => {
    if (!window.aihubPC) return;
    const downloadProductIds = new Set([
      ...Object.keys(downloadTasks),
      ...Object.values(managedDownloadQueueTasks)
        .filter((task) => task.phase === "downloaded")
        .map((task) => task.productId)
    ]);
    setScanning(true);
    try {
      const softwareResult = await window.aihubPC.checkSoftwareUpdates();
      setSoftwareUpdateResult(softwareResult);
      const [environmentResult, inventoryResult, downloadResult] =
        await Promise.allSettled([
        refreshEnvironmentReport(false),
        window.aihubPC.scanManagedInventory(),
        Promise.all(
          [...downloadProductIds].map(async (productId) => [
            productId,
            (await window.aihubPC!.getDownloadTask(productId)) || null
          ] as const)
        )
      ]);
      if (inventoryResult.status === "fulfilled") {
        applyManagedInventory(inventoryResult.value);
      }
      if (environmentResult.status === "rejected") {
        setManagementMessage(
          "environment:scan",
          runtimeMessage(environmentResult.reason)
        );
      }
      if (downloadResult.status === "fulfilled") {
        for (const [productId, task] of downloadResult.value) {
          if (task) applyManagedDownloadTask(task);
          else removeClearedDownloadTask(productId);
        }
      }
    } finally {
      setScanning(false);
    }
  };

  const openInstalledManagement = () => {
    navigate("management");
    void refreshInstalledManagement();
  };

  const setManagementMessage = (id: string, message: string) =>
    setManagementMessages((current) => ({ ...current, [id]: message }));

  const openManagedProduct = async (
    entry: (typeof installedManagement.products)[number]
  ) => {
    if (!window.aihubPC) return;
    try {
      if (entry.type === "cli") {
        const result = await window.aihubPC.openCli(entry.id);
        setManagementMessage(
          entry.id,
          result.ok ? uiText("auto.fe828ca72bd3") : result.error || uiText("auto.061b38f04a0f")
        );
        return;
      }
      const opened =
        entry.type === "environment"
          ? await window.aihubPC.openEnvironment(
              entry.id.slice("environment:".length)
            )
          : await window.aihubPC.openDesktopApp(entry.id);
      setManagementMessage(entry.id, opened ? uiText("auto.76ef4ba66457") : uiText("auto.98034d305011"));
    } catch (error) {
      setManagementMessage(
        entry.id,
        error instanceof Error ? error.message : uiText("auto.98034d305011")
      );
    }
  };

  const closeManagedProduct = async (
    entry: (typeof installedManagement.products)[number]
  ) => {
    if (!window.aihubPC) return;
    try {
      const result =
        entry.type === "environment"
          ? await window.aihubPC.closeEnvironment(
              entry.id.slice("environment:".length)
            )
          : await window.aihubPC.closeDesktopApp(entry.id);
      setManagementMessage(
        entry.id,
        result.ok
          ? result.closed
            ? uiText("auto.6744b4c6a9aa")
            : uiText("auto.68cc8625a670")
          : result.error || uiText("auto.d3c7e10d21a1")
      );
    } catch (error) {
      setManagementMessage(
        entry.id,
        error instanceof Error ? error.message : uiText("auto.d3c7e10d21a1")
      );
    }
  };

  const openManagedProductFiles = async (
    entry: (typeof installedManagement.products)[number]
  ) => {
    if (!window.aihubPC) return;
    try {
      const opened =
        entry.type === "environment"
          ? await window.aihubPC.openEnvironmentLocation(
              entry.id.slice("environment:".length)
            )
          : entry.type === "cli"
            ? await window.aihubPC.openCliLocation(entry.id)
            : await window.aihubPC.openDesktopLocation(entry.id);
      if (!opened) setManagementMessage(entry.id, uiText("auto.f76d02f1aa1e"));
    } catch {
      setManagementMessage(entry.id, uiText("auto.f76d02f1aa1e"));
    }
  };

  const uninstallManagedProduct = async (
    entry: (typeof installedManagement.products)[number]
  ) => {
    if (entry.type === "environment") {
      await uninstallEnvironment(entry.id.slice("environment:".length));
      return;
    }
    const product = resolveProductActionContext(entry.id);
    if (!product) return;
    if (entry.type === "cli") await requestCliUninstall(product);
    else await requestDesktopUninstall(product);
  };

  const updateManagedEnvironment = async (environmentId: string) => {
    if (!window.aihubPC) return;
    try {
      const result = await window.aihubPC.updateEnvironment(environmentId);
      if (result.task) applyManagedDownloadTask(result.task);
      if (result.operationTask) applyEnvironmentOperationTask(result.operationTask);
      if (result.downloaded) {
        setEnvironmentPackageStages((current) => ({
          ...current,
          [environmentId]: "ready"
        }));
      }
      const message = result.error || result.message || "";
      setManagementMessage(`environment-update:${environmentId}`, message);
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]: message
      }));
    } catch {
      const message = uiText("environment.updateFailed");
      setManagementMessage(`environment-update:${environmentId}`, message);
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]: message
      }));
    }
  };

  const openManagedEnvironmentUpdater = async (environmentId: string) => {
    if (!window.aihubPC) return;
    try {
      const result = await window.aihubPC.openEnvironmentUpdater(environmentId);
      if (result.operationTask) applyEnvironmentOperationTask(result.operationTask);
      const message = result.error || result.message || result.warning || "";
      setManagementMessage(`environment-update:${environmentId}`, message);
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]: message
      }));
    } catch {
      const message = uiText("environment.updaterOpenFailed");
      setManagementMessage(`environment-update:${environmentId}`, message);
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]: message
      }));
    }
  };

  const deleteManagedPackage = async (productId: string) => {
    if (!window.aihubPC) return;
    try {
      const result = await window.aihubPC.deleteDownloadedPackage(productId);
      if (result.canceled) return;
      if (!result.ok) {
        setManagementMessage(
          `package:${productId}`,
          result.error || uiText("auto.282eb98b7504")
        );
        return;
      }
      removeClearedDownloadTask(productId);
      setManagementMessage(`package:${productId}`, "");
    } catch {
      setManagementMessage(
        `package:${productId}`,
        uiText("auto.282eb98b7504")
      );
    }
  };

  const refreshPersonalCenter = async () => {
    if (!window.aihubPC || identity.status !== "authenticated") {
      setPersonalCenter(null);
      return null;
    }
    const snapshot = await window.aihubPC.getPersonalCenter();
    setPersonalCenter(snapshot);
    return snapshot;
  };

  const openPersonalCenter = (tab: PersonalCenterTab) => {
    if (identity.status !== "authenticated") {
      setAuthOpen(true);
      return;
    }
    setSelectedVendorId("");
    setAccountInitialTab(tab);
    setView("account");
    void refreshPersonalCenter().catch(() => undefined);
  };

  const displayBrandName =
    language === "en" && brand.name === BRAND.name
      ? BRAND.englishName
      : brand.name;
  const personalUnreadCount =
    (personalCenter?.summary.unreadNotifications || 0) +
    (personalCenter?.summary.unreadDirectMessages || 0);
  const spotlightActions: SpotlightActionData[] = [
    {
      id: "navigation:home",
      label: t.home,
      description: catalogDisplayField(brand, "slogan", language),
      leftSection: <IconHome size={21} stroke={1.8} />,
      onClick: () => {
        spotlight.close();
        navigate("home");
      }
    },
    {
      id: "navigation:ai-vendors",
      label: t.aiVendors,
      description: uiText("directory.ai.description"),
      leftSection: <IconBuildingStore size={21} stroke={1.8} />,
      onClick: () => {
        spotlight.close();
        openVendorDirectory("ai-tool");
      }
    },
    {
      id: "navigation:connectable-vendors",
      label: t.connectableVendors,
      description: uiText("directory.connectable.description"),
      leftSection: <IconPlugConnected size={21} stroke={1.8} />,
      onClick: () => {
        spotlight.close();
        openVendorDirectory("ai-connectable");
      }
    },
    ...activeResourceStores.map((store) => ({
      id: `navigation:resource-store:${store.id}`,
      label: resourceStoreDisplayLabel(store, language),
      description: uiText("resources.description"),
      leftSection: <ResourceStoreIcon storeId={store.id} size={21} />,
      onClick: () => {
        spotlight.close();
        openResourceStore(store.id);
      }
    })),
    {
      id: "navigation:installed",
      label: uiText("auto.a8b6c39dcabf"),
      description: uiText("downloadMenu.viewAll"),
      leftSection: <IconDownload size={21} stroke={1.8} />,
      onClick: () => {
        spotlight.close();
        openInstalledManagement();
      }
    },
    {
      id: "navigation:settings",
      label: t.settings,
      description: uiText("settings.language"),
      leftSection: <IconSettings size={21} stroke={1.8} />,
      onClick: () => {
        spotlight.close();
        setSettingsOpen(true);
      }
    },
    ...catalogVendors.flatMap((vendor) => {
      const vendorName = vendorDisplayName(vendor, language);
      return vendor.products
        .filter((product) => product.enabled !== false)
        .map((product) => ({
          id: `product:${product.id}`,
          label: catalogDisplayField(product, "name", language),
          description: `${vendorName} · ${catalogDisplayField(product, "description", language)}`,
          keywords: [vendorName, vendor.id, product.id],
          leftSection: <IconSparkles size={21} stroke={1.8} />,
          onClick: () => {
            spotlight.close();
            setVendorDirectory(product.directoryKind || "ai-tool");
            setSelectedVendorId(vendor.id);
            setView("vendors");
          }
        }));
    }),
    ...catalogResources.flatMap((resource) => {
      if (resource.enabled === false) return [];
      const store = activeResourceStores.find((entry) =>
        resource.resourceTypes.includes(entry.id)
      );
      if (!store) return [];
      return [{
        id: `resource:${resource.id}`,
        label: catalogDisplayField(resource, "name", language),
        description: `${resourceStoreDisplayLabel(store, language)} · ${catalogDisplayField(resource, "description", language)}`,
        keywords: [resource.id, resource.publisher || ""],
        leftSection: <ResourceStoreIcon storeId={store.id} size={21} />,
        onClick: () => {
          spotlight.close();
          setSelectedResourceStoreId(store.id);
          setResourceStoreSelection({ resourceId: resource.id });
          setResourceStoreVisit((current) => current + 1);
          setSelectedVendorId("");
          setView("resources");
        }
      }];
    })
  ];

  const communityShellActive =
    view === "community" &&
    identity.status === "authenticated" &&
    !selectedVendor;

  if (catalogStartupPending) {
    return (
      <main className="pcApp startupScreen" data-theme={theme} data-aihub-startup>
        <div className="startupBrand" aria-hidden="true">
          <BrandMark />
          <strong>{BRAND.name}</strong>
        </div>
        <span className="startupSpinner" aria-hidden="true" />
        <p role="status" aria-live="polite">{uiText("startup.loading")}</p>
      </main>
    );
  }

  return (
    <AppShell
      className={`pcApp${communityShellActive ? " communityWorkspace" : ""}`}
      data-theme={theme}
      data-aihub-app-shell
      header={{ height: { base: 76, sm: 88 } }}
      navbar={{
        width: { base: 218, lg: 248 },
        breakpoint: "sm",
        collapsed: { mobile: !mobileNavigationOpen }
      }}
      padding={0}
      transitionDuration={180}
      withBorder={false}
    >
      <AppShell.Header className="topbar">
        <div className="brandCluster">
          <Burger
            className="mobileNavToggle"
            hiddenFrom="sm"
            opened={mobileNavigationOpen}
            data-aihub-mobile-nav-toggle
            aria-label={t.navigation}
            aria-controls="primary-navigation"
            aria-expanded={mobileNavigationOpen}
            onClick={() => setMobileNavigationOpen((current) => !current)}
          />
          <button
            className="brand"
            title={catalogDisplayField(brand, "slogan", language)}
            onClick={() => navigate("home")}
          >
            <BrandMark />
            <span>{displayBrandName}</span>
            <small>{uiText("chrome.pc")}</small>
          </button>
        </div>

        <form
          className="search"
          data-aihub-action="catalog-search"
          onSubmit={submitSearch}
        >
          <span aria-hidden="true"><IconSearch size={19} stroke={1.8} /></span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.searchPlaceholder}
          />
          <button
            type="button"
            className="searchShortcut"
            data-aihub-command-center
            aria-label={t.search}
            title="Ctrl/Cmd + K"
            onClick={spotlight.open}
          >
            <kbd>Ctrl K</kbd>
          </button>
          <button type="submit">{t.search}</button>
        </form>

        <div className="topActions">
          <div
            className={`clientUpdateBadge clientUpdateBadge-${updateResult?.status || "checking"}`}
            data-aihub-client-update-status={updateResult?.status || "checking"}
          >
            <span className="clientUpdateCopy">
              <b>{uiText("update.version", { value1: updateResult?.currentVersion || packageJson.version })}</b>
              <small>{updateResult ? runtimeMessage(updateResult.message) : uiText("update.checking")}</small>
            </span>
            <button
              type="button"
              onClick={
                updateResult?.status === "available"
                  ? installUpdate
                  : () => void checkForUpdate(true)
              }
              disabled={checkingUpdate || installingUpdate}
            >
              {installingUpdate
                ? uiText("update.installing")
                : updateResult?.status === "available"
                  ? uiText("update.installNow")
                  : checkingUpdate
                    ? uiText("update.checkingAction")
                    : uiText("update.checkAction")}
            </button>
          </div>
          <button className="quietButton" onClick={openInstalledManagement}>
            {uiText("auto.a8b6c39dcabf")}</button>
          <button
            className="quietButton iconTextButton"
            data-aihub-action="open-settings"
            onClick={() => setSettingsOpen(true)}
          >
            <IconSettings size={18} stroke={1.8} aria-hidden="true" /> {t.settings}
          </button>
          <div className="downloadMenu" data-aihub-download-menu>
            <Popover
              opened={downloadMenuOpen}
              onChange={setDownloadMenuOpen}
              position="bottom-end"
              offset={10}
              width={360}
              withArrow
              withinPortal={false}
            >
              <Popover.Target>
                <button
                  type="button"
                  className="downloadMenuButton"
                  data-aihub-download-trigger
                  aria-label={uiText("downloadMenu.title")}
                  aria-expanded={downloadMenuOpen}
                  title={uiText("downloadMenu.title")}
                  onClick={() => setDownloadMenuOpen((current) => !current)}
                >
                  <IconDownload size={19} stroke={1.8} aria-hidden="true" />
                  {downloadPopover.activeCount > 0 && (
                    <b>{Math.min(99, downloadPopover.activeCount)}</b>
                  )}
                </button>
              </Popover.Target>
              <Popover.Dropdown className="downloadPopover">
                <header>
                  <strong>{uiText("downloadMenu.title")}</strong>
                  <small>{uiText("downloadMenu.count", { value1: downloadPopover.totalCount })}</small>
                </header>
                {downloadPopover.items.length === 0 ? (
                  <p>{uiText("downloadMenu.empty")}</p>
                ) : (
                  <div className="downloadPopoverList">
                    {downloadPopover.items.slice(0, 5).map((item) => (
                      <article key={`${item.source}:${item.id}`} data-aihub-download-item={item.productId}>
                        <div>
                          <b>{item.name}</b>
                          <small>
                            {item.state === "completed"
                              ? uiText("downloadMenu.completed")
                              : item.state === "failed"
                                ? uiText("downloadMenu.failed")
                                : uiText("downloadMenu.inProgress")}
                          </small>
                        </div>
                        {item.percent !== null && item.state === "active" && (
                          <span>{item.percent}%</span>
                        )}
                      </article>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    openInstalledManagement();
                  }}
                >
                  {uiText("downloadMenu.viewAll")}
                </button>
              </Popover.Dropdown>
            </Popover>
          </div>
          {identity.status === "authenticated" && (
            <button
              className="notificationButton"
              aria-label={uiText("auto.59e06dbae891", { value1: personalUnreadCount ? uiText("auto.823659594acc", { value1: personalUnreadCount }) : "" })}
              onClick={() =>
                openPersonalCenter(
                  personalCenter?.notifications.some(
                    (item) => item.source === "community" && !item.read
                  )
                    ? "notifications"
                    : personalCenter?.notifications.some(
                          (item) => item.source === "account" && !item.read
                        )
                      ? "siteMessages"
                      : personalCenter?.summary.unreadDirectMessages
                        ? "directMessages"
                        : "notifications"
                )
              }
            >
              <IconBell size={19} stroke={1.8} aria-hidden="true" />
              {Boolean(personalUnreadCount) && (
                <b>{Math.min(99, personalUnreadCount)}</b>
              )}
            </button>
          )}
          <button
            className={
              identity.status === "authenticated"
                ? "accountButton"
                : "accentButton"
            }
            onClick={() => openPersonalCenter("profile")}
          >
            {identity.status === "authenticated" ? (
              <>
                <span className="topAccountAvatar">
                  {identity.user.profile.avatarUrl ? (
                    <img src={identity.user.profile.avatarUrl} alt="" />
                  ) : (
                    identity.user.profile.nickname.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span>{identity.user.profile.nickname}</span>
              </>
            ) : (
              t.login
            )}
          </button>
        </div>
      </AppShell.Header>

      <AppShell.Navbar
        id="primary-navigation"
        className="sidebar"
        style={{
          transform:
            mobileViewport && !mobileNavigationOpen
              ? "translateX(-100%)"
              : "translateX(0)"
        }}
        onClickCapture={() => setMobileNavigationOpen(false)}
      >
          <p>{t.navigation}</p>
          <nav>
            <NavButton active={view === "home"} onClick={() => navigate("home")}>
              <span className="navIcon"><IconHome size={19} stroke={1.8} /></span>{t.home}
            </NavButton>
            <NavButton
              active={view === "vendors" && vendorDirectory === "ai-tool"}
              onClick={() => openVendorDirectory("ai-tool")}
            >
              <span className="navIcon"><IconBuildingStore size={19} stroke={1.8} /></span>{t.aiVendors}
            </NavButton>
            <NavButton
              active={
                view === "vendors" && vendorDirectory === "ai-connectable"
              }
              onClick={() => openVendorDirectory("ai-connectable")}
            >
              <span className="navIcon"><IconPlugConnected size={19} stroke={1.8} /></span>{t.connectableVendors}
            </NavButton>
            {activeResourceStores.map((store) => (
              <NavButton
                key={store.id}
                resourceStoreId={store.id}
                active={
                  view === "resources" &&
                  selectedResourceStore?.id === store.id
                }
                onClick={() => openResourceStore(store.id)}
              >
                <span className="navIcon"><ResourceStoreIcon storeId={store.id} size={19} /></span>{resourceStoreDisplayLabel(store, language)}
              </NavButton>
            ))}
            {hasPublicWorkflowStore && (
              <button
                type="button"
                className={view === "workflow-public-store" ? "navItem active" : "navItem"}
                data-aihub-workflow-store="public"
                onClick={() => {
                  setSelectedVendorId("");
                  setView("workflow-public-store");
                }}
              >
                <span className="navIcon"><IconRoute size={19} stroke={1.8} /></span>{uiText("workflow.public.nav")}
              </button>
            )}
            <NavButton
              active={view === "community"}
              title={uiText("nav.communityDiscussionsHint")}
              communityDiscussions
              onClick={() => {
                setSelectedVendorId("");
                setCommunityParentView("home");
                setView("community");
              }}
            >
              <span className="navIcon"><IconMessages size={19} stroke={1.8} /></span>{t.community}
            </NavButton>
            {extraSections
              .filter((section) => section.enabled)
              .map((section) => (
                <NavButton
                  key={section.id}
                  active={false}
                  onClick={() => window.open(section.url)}
                >
                  <span className="navIcon"><IconExternalLink size={19} stroke={1.8} /></span>
                  {catalogDisplayField(section, "title", language)}
                </NavButton>
              ))}
          </nav>
          <div className="sidebarContribution">
            <NavButton
              active={view === "contribution"}
              onClick={() => navigate("contribution")}
            >
              <span className="navIcon"><IconPlus size={19} stroke={1.8} /></span>{uiText("resources.submit.nav")}
            </NavButton>
          </div>
      </AppShell.Navbar>

      <AppShell.Main
        className={`appShellMain${communityShellActive ? " communityAppShellMain" : ""}`}
      >
        <div className={`content${communityShellActive ? " communityContent" : ""}`}>
          {selectedVendor ? (
            <VendorPage
              vendor={selectedVendor}
              directoryKind={vendorDirectory}
              language={language}
              environment={environment}
              productStages={productStages}
              productMissing={productMissing}
              productProgress={productProgress}
              productDownloadDetails={productDownloadDetails}
              downloadTasks={downloadTasks}
              managedDownloadQueueTasks={managedDownloadQueueTasks}
              productErrors={productErrors}
              productFiles={productFiles}
              desktopStatuses={desktopStatuses}
              desktopOperationTasks={desktopOperationTasks}
              desktopUpdateOwners={desktopUpdateOwners}
              cliLogs={cliLogs}
              cliVersions={cliVersions}
              cliStatuses={cliStatuses}
              environmentMessages={environmentMessages}
              environmentPackageStages={environmentPackageStages}
              onBack={() => setSelectedVendorId("")}
              onInstallProduct={requestUnifiedInstall}
              onGetLatestDesktop={requestLatestDesktopInstaller}
              onResumeDownload={(product) =>
                void resumeDownloadTask(product.id)
              }
              onRetryDownload={(product) =>
                void retryDownloadTask(product.id)
              }
              onPauseDownload={pauseProductDownload}
              onCancelDownload={cancelProductDownload}
              onCancelManagedDownload={cancelProductDownload}
              onRetryManagedDownload={(product) => void downloadProduct(product, true)}
              onRelocateDownload={relocateProductDownload}
              onUninstallCli={requestCliUninstall}
              onReconcileCli={requestCliReconcile}
              onOpenCli={requestOpenCli}
              onUninstallDesktop={requestDesktopUninstall}
              onRecheckDesktopUninstall={recheckDesktopUninstall}
              onOpenDesktop={(product) =>
                window.aihubPC?.openDesktopApp(product.id)
              }
              onOpenDesktopLocation={(product) =>
                window.aihubPC?.openDesktopLocation(product.id)
              }
              onOpenWindowsUninstall={() =>
                window.aihubPC?.openWindowsUninstallSettings()
              }
              onInstallEnvironment={installEnvironment}
              onOpenEnvironmentInstaller={openEnvironmentInstaller}
            />
          ) : view === "home" ? (
            <HomePage
              language={language}
              vendors={aiVendors}
              banners={homeBanners}
              carousel={homeCarousel}
              featuredVendorIds={featuredVendorIds}
              onOpenVendors={() => openVendorDirectory("ai-tool")}
              onOpenResourceStore={openResourceStore}
              onOpenVendor={(vendor) => {
                setVendorDirectory("ai-tool");
                setView("vendors");
                setSelectedVendorId(vendor.id);
              }}
            />
          ) : view === "vendors" ? (
            <VendorsPage
              language={language}
              vendors={visibleVendors}
              catalogError={catalogError}
              categoryOptions={[ALL_FILTER, ...directoryCategories]}
              category={category}
              letter={letter}
              letters={letters}
              search={search}
              onCategory={setCategory}
              onLetter={setLetter}
              directoryKind={vendorDirectory}
              onOpenVendor={(vendor) => setSelectedVendorId(vendor.id)}
            />
          ) : view === "search" ? (
            <SearchResultsPage
              language={language}
              results={searchResults}
              catalogError={catalogError}
              onOpenVendor={(result) => {
                setVendorDirectory(result.directoryKind);
                setSelectedVendorId(result.vendor.id);
              }}
              onOpenResource={openSearchResource}
            />
          ) : view === "resources" ? (
            <ResourceStorePage
              language={language}
              key={`${selectedResourceStore?.id || "empty"}:${resourceStoreVisit}`}
              kind={selectedResourceStore?.id || null}
              resourceStores={activeResourceStores}
              resources={catalogResources}
              connections={catalogResourceConnections}
              vendors={catalogVendors}
              initialResourceId={resourceStoreSelection.resourceId}
              onOpenContribution={() => navigate("contribution")}
            />
          ) : view === "contribution" ? (
            <ContributionPage
              identity={identity}
              onBack={() => navigate("home")}
              onLogin={() => setAuthOpen(true)}
            />
          ) : view === "workflow-public-store" && publicWorkflowPage ? (
            <WorkflowPublicStorePage
              language={language}
              page={publicWorkflowPage}
              onLoadMore={loadMorePublicWorkflows}
              agentBridgeCapability={localAgentBridgeCapability}
              vendors={catalogVendors}
            />
          ) : view === "management" ? (
            <InstalledProductsPage
              management={installedManagement}
              messages={managementMessages}
              language={language}
              productStages={productStages}
              productErrors={productErrors}
              environmentChecks={
                environment?.displayChecks || environment?.checks || []
              }
              environmentPackageStages={environmentPackageStages}
              scanning={scanning}
              softwareUpdateResult={softwareUpdateResult}
              onRefresh={refreshInstalledManagement}
              onOpen={openManagedProduct}
              onClose={closeManagedProduct}
              onOpenFiles={openManagedProductFiles}
              onReinstall={(entry) =>
                void openCompletedDownloadTask(entry.id, "reinstall")
              }
              onGetLatest={(entry) =>
                void openCompletedDownloadTask(entry.id, "refresh")
              }
              onUpdateDesktop={async (entry) => {
                if (!window.aihubPC) return;
                try {
                  const result = await window.aihubPC.updateDesktopProduct(entry.id);
                  setManagementMessage(
                    entry.id,
                    result.ok
                      ? uiText("softwareUpdates.updateStarted")
                      : result.error || uiText("softwareUpdates.updateFailed")
                  );
                  await refreshInstalledManagement();
                } catch (error) {
                  setManagementMessage(
                    entry.id,
                    error instanceof Error
                      ? error.message
                      : uiText("softwareUpdates.updateFailed")
                  );
                }
              }}
              onUpdateCli={async (entry) => {
                const product = resolveProductActionContext(entry.id, true);
                if (!product) return;
                await requestCliReconcile(product, "update");
              }}
              onReinstallEnvironment={(entry) =>
                void openCompletedDownloadTask(entry.id)
              }
              onUninstall={uninstallManagedProduct}
              onUpdateEnvironment={updateManagedEnvironment}
              onOpenEnvironmentUpdater={openManagedEnvironmentUpdater}
              onOpenWindowsUninstall={() =>
                window.aihubPC?.openWindowsUninstallSettings()
              }
              onRepairWslEnvironment={async (entry) => {
                const product = resolveProductActionContext(
                  entry.ownerProductId,
                  true
                );
                if (!product) return;
                await deployCli(product);
                await refreshInstalledManagement();
              }}
              onInstallPackage={(entry) =>
                openCompletedDownloadTask(entry.id)
              }
              onShowPackage={(entry) =>
                showDownloadInFolder(entry.id)
              }
              onDeletePackage={(entry) =>
                deleteManagedPackage(entry.id)
              }
            />
          ) : view === "account" ? (
            <PersonalCenterPage
              identity={identity}
              center={personalCenter}
              initialTab={accountInitialTab}
              onIdentity={setIdentity}
              onCenter={setPersonalCenter}
              onRefresh={refreshPersonalCenter}
              onLogin={() => setAuthOpen(true)}
              onLogout={() => {
                setIdentity({ status: "anonymous" });
                setPersonalCenter(null);
                setView("home");
              }}
              onBack={() => navigate("home")}
              onOpenCommunity={(path) => {
                setCommunityTargetPath(path);
                setCommunityParentView("account");
                setView("community");
              }}
            />
          ) : (
            <FlarumCommunityPage
              identity={identity}
              theme={theme}
              language={language}
              community={catalogCommunity}
              onLogin={() => setAuthOpen(true)}
              onSessionRevoked={() => {
                setIdentity({ status: "anonymous" });
                setPersonalCenter(null);
                setAuthOpen(true);
              }}
              targetPath={communityTargetPath}
              onTargetConsumed={() => setCommunityTargetPath("")}
              onBack={() => {
                setCommunityTargetPath("");
                setView(communityParentView);
              }}
            />
          )}
        </div>
      </AppShell.Main>

      <Spotlight
        actions={spotlightActions}
        shortcut="mod + K"
        limit={7}
        highlightQuery
        scrollable
        maxHeight={420}
        data-aihub-command-center
        nothingFound={uiText("directory.emptyTitle")}
        overlayProps={{ backgroundOpacity: 0.48, blur: 14 }}
        classNames={{
          content: "aiHubSpotlightContent",
          search: "aiHubSpotlightSearch",
          actionsList: "aiHubSpotlightActions",
          action: "aiHubSpotlightAction",
          empty: "aiHubSpotlightEmpty"
        }}
        searchProps={{
          leftSection: <IconSearch size={20} stroke={1.8} />,
          placeholder: t.searchPlaceholder,
          "aria-label": t.search
        }}
      />

      {settingsOpen && (
        <SettingsPanel
          opened={settingsOpen}
          theme={theme}
          language={language}
          downloadDirectory={downloadDirectory}
          cliInstallDirectory={cliInstallDirectory}
          environment={environment}
          environmentMessages={environmentMessages}
          environmentPackageStages={environmentPackageStages}
          downloadTasks={downloadTasks}
          managedDownloadQueueTasks={managedDownloadQueueTasks}
          downloadTaskNames={downloadTaskNames}
          desktopOperationTasks={desktopOperationTasks}
          environmentOperationTasks={environmentOperationTasks}
          operationTaskNames={operationTaskNames}
          cliManagedTasks={cliManagedTasks}
          cliLogs={cliLogs}
          installedTaskIds={[
            ...Object.entries(desktopStatuses)
              .filter(([, status]) => status.installed)
              .map(([productId]) => productId),
            ...(environment?.checks || [])
              .filter((check) => check.installed)
              .map((check) => `environment:${check.id}`)
          ]}
          installableDownloadTaskIds={installedManagement.packages
            .filter((entry) => entry.canInstall)
            .map((entry) => entry.id)}
          scanning={scanning}
          onClose={() => setSettingsOpen(false)}
          onTheme={changeTheme}
          onLanguage={changeLanguage}
          onChooseDirectory={chooseDownloadDirectory}
          onChooseCliDirectory={chooseCliDirectory}
          onOpenCliDirectory={() =>
            window.aihubPC?.openCliDirectory() ?? Promise.resolve(false)
          }
          onOpenDirectory={() => window.aihubPC?.openDownloadDirectory()}
          onClearDirectory={async () => {
            const settings = window.aihubPC
              ? await window.aihubPC.clearDownloadDirectory()
              : { downloadDirectory: "" };
            setDownloadDirectory(settings.downloadDirectory);
          }}
          onScan={runEnvironmentScan}
          onInstallEnvironment={installEnvironment}
          onOpenEnvironmentInstaller={openEnvironmentInstaller}
          onOpenEnvironmentLocation={openEnvironmentLocation}
          onUninstallEnvironment={uninstallEnvironment}
          onUpdateEnvironment={updateManagedEnvironment}
          onOpenEnvironmentUpdater={openManagedEnvironmentUpdater}
          onResumeDownloadTask={resumeDownloadTask}
          onPauseDownloadTask={pauseDownloadTask}
          onCancelDownloadTask={cancelDownloadTask}
          onCancelManagedDownloadTask={(productId, trigger) => {
            const task = managedDownloadQueueTasks[productId];
            if (!task || !hasManagedDownloadQueueApi()) return;
            requestDownloadCancellation(productId, "queue", undefined, trigger);
          }}
          onRetryManagedDownloadTask={async (productId) => {
            const product = catalogAllVendors
              .flatMap((vendor) => vendor.products)
              .find((entry) => entry.id === productId);
            if (product) await downloadProduct(product, true);
          }}
          onOpenCompletedDownloadTask={openCompletedDownloadTask}
          onShowDownloadInFolder={showDownloadInFolder}
          onClearDownloadHistory={clearDownloadHistory}
          onClearCompletedTasks={clearCompletedTasks}
          onCheckDesktopOperationTask={checkDesktopOperationTask}
          onCheckEnvironmentOperationTask={checkEnvironmentOperationTask}
          onClearCliManagedTask={clearCliManagedTask}
          onRetryCliManagedTask={(productId) =>
            runExclusiveProductAction(productId, uiText("auto.465ac1927c3d"), () =>
              retryCliManagedTask(productId)
            )
          }
          onRecheckCliManagedTask={recheckCliManagedTask}
        />
      )}
      {authOpen && (
        <AuthModal
          identity={identity}
          onClose={() => setAuthOpen(false)}
          onIdentity={setIdentity}
        />
      )}
      {pendingDownloadCancellation && (
        <ManagedDownloadCancelDialog
          pending={pendingDownloadCancellation}
          busy={downloadCancellationBusy}
          onKeep={() => setPendingDownloadCancellation(null)}
          onDiscard={() => void confirmDownloadCancellation()}
        />
      )}
    </AppShell>
  );
}

function ManagedDownloadCancelDialog({
  pending,
  busy,
  onKeep,
  onDiscard
}: {
  pending: PendingDownloadCancellation;
  busy: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const trigger = pending.trigger;
  useEffect(() => () => {
    if (trigger?.isConnected) trigger.focus();
  }, [trigger]);
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onKeep();
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || [])];
    if (buttons.length < 2) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <div className="modalBackdrop managedDownloadCancelBackdrop" onMouseDown={() => !busy && onKeep()}>
      <section
        ref={dialogRef}
        className="managedDownloadCancelModal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="managed-download-cancel-title"
        aria-describedby="managed-download-cancel-description"
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>{uiText("downloadQueue.cancelDialog.eyebrow")}</p>
            <h2 id="managed-download-cancel-title">{uiText("downloadQueue.cancelDialog.title")}</h2>
          </div>
          <button type="button" aria-label={uiText("downloadQueue.cancelDialog.keep")} disabled={busy} onClick={onKeep}>×</button>
        </header>
        <p className="managedDownloadCancelProduct">{pending.productName}</p>
        <p id="managed-download-cancel-description">{uiText("downloadQueue.cancelDialog.description")}</p>
        <small>{uiText("downloadQueue.cancelDialog.received", { value1: formatBytes(pending.receivedBytes) })}</small>
        <div className="managedDownloadCancelActions">
          <button type="button" autoFocus disabled={busy} onClick={onKeep}>
            {uiText("downloadQueue.cancelDialog.keep")}
          </button>
          <button type="button" className="dangerButton" disabled={busy} onClick={onDiscard}>
            {busy ? uiText("downloadQueue.cancelDialog.cancelling") : uiText("downloadQueue.cancelDialog.discard")}
          </button>
        </div>
      </section>
    </div>
  );
}

function ResourceStoreIcon({
  storeId,
  size = 20
}: {
  storeId: string;
  size?: number;
}) {
  const StoreIcon = storeId === "skill"
    ? IconSparkles
    : storeId === "mcp"
      ? IconPlugConnected
      : storeId === "plugin"
        ? IconPuzzle
        : storeId === "connector"
          ? IconLink
          : IconLayoutGrid;
  return <StoreIcon size={size} stroke={1.8} aria-hidden="true" />;
}

function NavButton({
  active,
  onClick,
  children,
  resourceStoreId,
  title,
  communityDiscussions = false
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  resourceStoreId?: string;
  title?: string;
  communityDiscussions?: boolean;
}) {
  return (
    <button
      className={active ? "navItem active" : "navItem"}
      data-aihub-resource-store-id={resourceStoreId}
      data-aihub-community-discussions={communityDiscussions || undefined}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function HomePage({
  language,
  vendors,
  banners,
  carousel,
  featuredVendorIds,
  onOpenVendors,
  onOpenResourceStore,
  onOpenVendor
}: {
  language: Language;
  vendors: Vendor[];
  banners: CatalogBanner[];
  carousel?: CatalogHomeCarousel;
  featuredVendorIds: string[];
  onOpenVendors: () => void;
  onOpenResourceStore: (storeId: string) => void;
  onOpenVendor: (vendor: Vendor) => void;
}) {
  const [bannerIndex, setBannerIndex] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [prefersReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [carouselPaused, setCarouselPaused] = useState(prefersReducedMotion);
  const [imageFailed, setImageFailed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const carouselSlides = useMemo(() => selectHomeCarouselSlides(carousel), [carousel]);
  const useCarousel = carouselSlides.length > 0;
  useEffect(() => setBannerIndex(0), [banners]);
  useEffect(() => {
    setCarouselIndex(0);
    setCarouselPaused(prefersReducedMotion);
  }, [carousel, prefersReducedMotion]);
  useEffect(() => {
    if (prefersReducedMotion || !useCarousel || carouselPaused || carouselSlides.length < 2 || !carousel?.autoplayMs) return;
    const timer = window.setInterval(
      () => setCarouselIndex((index) => (index + 1) % carouselSlides.length),
      carousel.autoplayMs
    );
    return () => window.clearInterval(timer);
  }, [carousel?.autoplayMs, carouselPaused, carouselSlides.length, prefersReducedMotion, useCarousel]);
  const banner = banners[bannerIndex] ?? banners[0]!;
  const slide = carouselSlides[carouselIndex] || carouselSlides[0];
  const carouselImageUrl = slide
    ? resolveCarouselImageUrl(slide.imageUrl, document.baseURI)
    : "";
  useEffect(() => setImageFailed(false), [slide?.id, slide?.imageUrl]);
  const selectCarouselSlide = (index: number) => {
    setCarouselPaused(true);
    setCarouselIndex((index + carouselSlides.length) % carouselSlides.length);
  };
  const openCarouselAction = (href: string) => {
    if (href === "/vendors") return onOpenVendors();
    const storeId = href.match(/^\/resources\/(skill|mcp|plugin|connector)$/)?.[1];
    if (storeId) return onOpenResourceStore(storeId);
    if (isAllowedCarouselActionHref(href)) window.open(href);
  };
  const carouselHero = useCarousel && slide ? (
    <section className={`hero carouselHero${imageFailed || !carouselImageUrl ? " imageFailed" : ""}`} onMouseEnter={() => setCarouselPaused(true)} onFocusCapture={() => setCarouselPaused(true)}>
      <div className="heroCopy" aria-live={carouselPaused ? "polite" : "off"}>
        <h1>{catalogDisplayField(slide, "title", language)}</h1>
        <span>{catalogDisplayField(slide, "description", language)}</span>
        <div className="carouselActions">
          <button className="primaryAction" onClick={() => openCarouselAction(slide.primaryAction.href)}>{catalogDisplayField(slide.primaryAction, "label", language)} →</button>
          {slide.secondaryAction ? <button className="quietButton" onClick={() => openCarouselAction(slide.secondaryAction!.href)}>{catalogDisplayField(slide.secondaryAction, "label", language)}</button> : null}
        </div>
        <div className="bannerControls carouselControls" role="group" aria-label={uiText("carousel.controls")}>
          {carouselSlides.map((item, index) => <button key={item.id} className={carouselIndex === index ? "active" : ""} aria-label={uiText("carousel.slide", { value1: index + 1 })} aria-current={carouselIndex === index ? "true" : undefined} onClick={() => selectCarouselSlide(index)} />)}
        </div>
      </div>
      <button
        type="button"
        className="carouselEdge carouselEdgePrevious"
        data-aihub-carousel-action="previous"
        aria-label={uiText("carousel.previous")}
        onClick={() => selectCarouselSlide(carouselIndex - 1)}
      ><span aria-hidden="true">←</span></button>
      <button
        type="button"
        className="carouselEdge carouselEdgeNext"
        data-aihub-carousel-action="next"
        aria-label={uiText("carousel.next")}
        onClick={() => selectCarouselSlide(carouselIndex + 1)}
      ><span aria-hidden="true">→</span></button>
      {!imageFailed && carouselImageUrl ? <div className="heroVisual" tabIndex={0} aria-label={uiText("carousel.controls")} onKeyDown={(event) => {
        if (event.key === "ArrowLeft") selectCarouselSlide(carouselIndex - 1);
        if (event.key === "ArrowRight") selectCarouselSlide(carouselIndex + 1);
      }} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        const end = event.changedTouches[0]?.clientX;
        if (start === null || end === undefined || Math.abs(end - start) < event.currentTarget.clientWidth * 0.12) return;
        selectCarouselSlide(end < start ? carouselIndex + 1 : carouselIndex - 1);
      }}>
        <img className="carouselImage" src={carouselImageUrl} alt={catalogDisplayField(slide, "imageAlt", language)} onLoad={() => setImageFailed(false)} onError={() => setImageFailed(true)} />
      </div> : null}
    </section>
  ) : null;
  const configuredFeatured = featuredVendorIds
    .map((id) => vendors.find((vendor) => vendor.id === id))
    .filter((vendor): vendor is Vendor => Boolean(vendor));
  const featured = configuredFeatured.length
    ? configuredFeatured.slice(0, 4)
    : vendors.slice(0, 4);
  return (
    <>
      {carouselHero || <section className="hero">
        <div className="heroCopy">
          <h1>{catalogDisplayField(banner, "title", language)}</h1>
          <span>{catalogDisplayField(banner, "description", language)}</span>
          <button className="primaryAction" onClick={onOpenVendors}>
            {catalogDisplayField(banner, "action", language)} →
          </button>
          <div className="bannerControls" aria-label={uiText("auto.35bf6ebc40df")}>
            {banners.map((item, index) => (
              <button
                key={catalogDisplayField(item, "title", language)}
                className={bannerIndex === index ? "active" : ""}
                aria-label={uiText("auto.104e810b4b12", { value1: index + 1 })}
                onClick={() => setBannerIndex(index)}
              />
            ))}
          </div>
        </div>
        <div className="heroVisual">
          <div className="orbit orbitOne" />
          <div className="orbit orbitTwo" />
          <div className="heroCore">
            <b>{uiText("chrome.ai")}</b>
            <small>{uiText("chrome.hubPc")}</small>
          </div>
        </div>
      </section>}

      <section className="homeSection">
        <div className="sectionHeading">
          <div>
            <h2>{uiText("auto.1af1e69bc945")}</h2>
          </div>
          <button onClick={onOpenVendors}>{uiText("home.aiVendorsAction")}</button>
        </div>
        <div className="featuredGrid">
          {featured.map((vendor) => (
            <button
              className="featuredCard"
              key={vendor.id}
              onClick={() => onOpenVendor(vendor)}
            >
              <VendorMark vendor={vendor} />
              <span>
                <b>{vendorDisplayName(vendor, language)}</b>
              </span>
              <i>→</i>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function SearchResultsPage({
  language,
  results,
  catalogError,
  onOpenVendor,
  onOpenResource
}: {
  language: Language;
  results: CatalogSearchResults;
  catalogError: string;
  onOpenVendor: (result: CatalogSearchResults["vendors"][number]) => void;
  onOpenResource: (result: CatalogSearchResults["resources"][number]) => void;
}) {
  const resultCount = results.vendors.length + results.resources.length;
  return (
    <>
      <header className="pageHeader" data-aihub-search-results>
        <h1>
          {results.query
            ? uiText("auto.ce30bf880263", { value1: results.query })
            : uiText("nav.search")}
        </h1>
        <span>
          {results.vendors.length} {uiText("auto.cad10bb229ea")} ·{" "}
          {results.resources.length} {uiText("resources.count")}
        </span>
      </header>

      {catalogError ? (
        <section className="catalogUnavailable" role="status">
          <b>{uiText("catalog.unavailableTitle")}</b>
          <span>
            {runtimeMessage(
              catalogError,
              "CATALOG_UNAVAILABLE",
              "catalog.unavailableDescription"
            )}
          </span>
        </section>
      ) : resultCount === 0 ? (
        <section className="catalogUnavailable" role="status">
          <b>{uiText("directory.emptyTitle")}</b>
          <span>{uiText("nav.searchPlaceholder")}</span>
        </section>
      ) : (
        <>
          {results.vendors.length > 0 && (
            <section className="homeSection">
              <div className="sectionHeading">
                <div>
                  <h2>{uiText("auto.9900470a1321")}</h2>
                </div>
              </div>
              <div className="vendorGrid">
                {results.vendors.map((result) => (
                  <button
                    type="button"
                    className="vendorCard"
                    key={`${result.directoryKind}:${result.vendor.id}`}
                    data-aihub-search-result-kind="vendor"
                    data-aihub-search-directory-kind={result.directoryKind}
                    data-aihub-vendor-id={result.vendor.id}
                    onClick={() => onOpenVendor(result)}
                  >
                    <div className="vendorCardTop">
                      <VendorMark vendor={result.vendor} large />
                    </div>
                    <h2>{vendorDisplayName(result.vendor, language)}</h2>
                    <p>{catalogDisplayField(result.vendor, "description", language)}</p>
                    <div className="productTags">
                      {result.products.map((product) => (
                        <span key={product.id}>{catalogDisplayField(product, "name", language)}</span>
                      ))}
                    </div>
                    <footer>
                      <span>
                        {result.products.length} {uiText("auto.ab2dacacbc82")}
                      </span>
                      <b>{uiText("auto.0eca81598063")}</b>
                    </footer>
                  </button>
                ))}
              </div>
            </section>
          )}

          {results.resources.length > 0 && (
            <section className="homeSection">
              <div className="sectionHeading">
                <div>
                  <h2>{uiText("resources.eyebrow")}</h2>
                </div>
              </div>
              <div className="resourceCardGrid">
                {results.resources.map((result) => (
                  <button
                    type="button"
                    className="resourceSummaryCard"
                    key={`${result.store.id}:${result.resource.id}:${result.target.productId}`}
                    data-aihub-search-result-kind="resource"
                    data-aihub-resource-store-id={result.store.id}
                    data-aihub-resource-id={result.resource.id}
                    data-aihub-resource-product-id={result.product.id}
                    onClick={() => onOpenResource(result)}
                  >
                    <b>{catalogDisplayField(result.resource, "name", language)}</b>
                    <small>
                      {vendorDisplayName(result.vendor, language)} · {catalogDisplayField(result.product, "name", language)}
                    </small>
                    <footer>
                      <span>
                        {resourceCompatibilityLabel(result.target.compatibility)}
                      </span>
                      <strong>{uiText("resources.viewDetail")} →</strong>
                    </footer>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function VendorsPage({
  language,
  vendors: visible,
  catalogError,
  categoryOptions,
  category,
  letter,
  letters,
  search,
  directoryKind,
  onCategory,
  onLetter,
  onOpenVendor
}: {
  language: Language;
  vendors: Vendor[];
  catalogError: string;
  categoryOptions: Array<typeof ALL_FILTER | ProductCategory>;
  category: typeof ALL_FILTER | ProductCategory;
  letter: string;
  letters: string[];
  search: string;
  directoryKind: ProductDirectoryKind;
  onCategory: (value: typeof ALL_FILTER | ProductCategory) => void;
  onLetter: (value: string) => void;
  onOpenVendor: (vendor: Vendor) => void;
}) {
  return (
    <>
      <header className="pageHeader resourceStoreHeader">
        <h1>
          {directoryKind === "ai-tool"
            ? uiText("directory.ai.title")
            : uiText("directory.connectable.title")}
        </h1>
        <span>
          {directoryKind === "ai-tool"
            ? uiText("directory.ai.description")
            : uiText("directory.connectable.description")}
        </span>
      </header>

      <section className="filters">
        <FilterRow
          label={uiText("auto.a74a788ef2ea")}
          values={categoryOptions}
          active={category}
          onChange={(value) =>
            onCategory(value as typeof ALL_FILTER | ProductCategory)
          }
        />
        <FilterRow
          label={uiText("auto.4f06c63c2949")}
          values={letters}
          active={letter}
          onChange={onLetter}
        />
      </section>

      <div className="directorySummary">
        <b>{search.trim() ? uiText("auto.ce30bf880263", { value1: search.trim() }) : uiText("auto.9900470a1321")}</b>
        <span>{visible.length} {uiText("auto.cad10bb229ea")}</span>
      </div>

      {catalogError ? (
        <section className="catalogUnavailable" role="status">
          <b>{uiText("catalog.unavailableTitle")}</b>
          <span>
            {runtimeMessage(
              catalogError,
              "CATALOG_UNAVAILABLE",
              "catalog.unavailableDescription"
            )}
          </span>
        </section>
      ) : visible.length === 0 ? (
        <section className="catalogUnavailable" role="status">
          <b>{uiText("directory.emptyTitle")}</b>
          <span>{uiText("directory.emptyDescription")}</span>
        </section>
      ) : (
        <div className="vendorGrid">
          {visible.map((vendor) => (
          <button
            className="vendorCard"
            data-aihub-vendor-id={vendor.id}
            key={vendor.id}
            onClick={() => onOpenVendor(vendor)}
          >
            <div className="vendorCardTop">
              <VendorMark vendor={vendor} large />
              <span>{vendor.products.length} {uiText("auto.ab2dacacbc82")}</span>
            </div>
            <h2>{vendorDisplayName(vendor, language)}</h2>
            <p>{catalogDisplayField(vendor, "description", language)}</p>
            <div className="productTags">
              {vendor.products.map((product) => (
                <span key={product.id}>{catalogDisplayField(product, "name", language)}</span>
              ))}
            </div>
            <footer>
              <span>{vendor.products.length} {uiText("auto.ab2dacacbc82")}</span>
              <b>{uiText("auto.0eca81598063")}</b>
            </footer>
          </button>
          ))}
        </div>
      )}
    </>
  );
}

function FilterRow({
  label,
  values,
  active,
  onChange,
  labels,
  marker
}: {
  label: string;
  values: readonly string[];
  active: string;
  onChange: (value: string) => void;
  labels?: Record<string, string>;
  marker?: string;
}) {
  const data = values.map((value) => ({
    value,
    label:
      labels?.[value] ||
      (value === ALL_FILTER ? uiText("auto.5c55a67935af") : value)
  }));

  return (
    <div className="filterRow" data-aihub-resource-filter={marker}>
      <b>{label}</b>
      <Select
        className="filterCompactSelect"
        data-aihub-filter-compact={marker}
        aria-label={label}
        data={data}
        value={active}
        searchable={values.length > 8}
        allowDeselect={false}
        onChange={(value) => value && onChange(value)}
      />
      <div className="filterChipGroup" role="group" aria-label={label}>
        {data.map(({ value, label: valueLabel }) => (
          <button
            type="button"
            key={value}
            className={active === value ? "active" : ""}
            data-aihub-filter-value={value}
            aria-pressed={active === value}
            onClick={() => onChange(value)}
          >
            {valueLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

type ContributionForm = {
  submissionKind: ResourceSubmissionKind;
  title: string;
  summary: string;
  originalAuthor: string;
  organization: string;
  canonicalSource: string;
  licenseId: string;
  sourceRevision: string;
  hostCandidate: string;
  platforms: string;
  scenarioTags: string[];
  rawTags: string;
  agentCompatibility: string;
  evidenceRefs: string;
  discoveredVia: string;
};

const EMPTY_CONTRIBUTION_FORM: ContributionForm = {
  submissionKind: "vendor", title: "", summary: "", originalAuthor: "",
  organization: "", canonicalSource: "", licenseId: "", sourceRevision: "",
  hostCandidate: "", platforms: "", scenarioTags: [], rawTags: "",
  agentCompatibility: "", evidenceRefs: "", discoveredVia: ""
};

function contributionValues(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function isContributionHttps(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function contributionFormFromProposal(proposal: ResourceSubmissionProposal): ContributionForm {
  return {
    ...EMPTY_CONTRIBUTION_FORM,
    submissionKind: proposal.submissionKind, title: proposal.title || "", summary: proposal.summary || "",
    originalAuthor: proposal.originalAuthor || "", organization: proposal.organization || "",
    canonicalSource: proposal.canonicalSource || "", licenseId: proposal.licenseId || "",
    sourceRevision: proposal.sourceRevision || "", hostCandidate: proposal.catalogReferences?.[0]?.canonicalId || "",
    platforms: (proposal.platforms || []).join(", "), scenarioTags: proposal.scenarioTags || [],
    rawTags: (proposal.rawTags || []).join(", "), agentCompatibility: (proposal.agentCompatibility || []).join(", "),
    evidenceRefs: (proposal.evidenceRefs || []).join("\n"), discoveredVia: proposal.discoveredVia || ""
  };
}

function proposalFromContributionForm(form: ContributionForm): ResourceSubmissionProposal | null {
  const evidenceRefs = contributionValues(form.evidenceRefs);
  const discoveredVia = form.discoveredVia.trim();
  if (!form.title.trim() || !form.summary.trim() || !isContributionHttps(form.canonicalSource.trim()) || evidenceRefs.some((item) => !isContributionHttps(item)) || (discoveredVia && !isContributionHttps(discoveredVia))) return null;
  return {
    submissionKind: form.submissionKind, title: form.title.trim(), summary: form.summary.trim(), canonicalSource: form.canonicalSource.trim(),
    ...(form.originalAuthor.trim() ? { originalAuthor: form.originalAuthor.trim() } : {}),
    ...(form.organization.trim() ? { organization: form.organization.trim() } : {}),
    ...(form.licenseId.trim() ? { licenseId: form.licenseId.trim() } : {}),
    ...(form.sourceRevision.trim() ? { sourceRevision: form.sourceRevision.trim() } : {}),
    ...(form.hostCandidate.trim() ? { catalogReferences: [{ kind: "product", canonicalId: form.hostCandidate.trim() }] } : {}),
    platforms: contributionValues(form.platforms), scenarioTags: form.scenarioTags,
    rawTags: contributionValues(form.rawTags), agentCompatibility: contributionValues(form.agentCompatibility), evidenceRefs,
    ...(discoveredVia ? { discoveredVia } : {})
  };
}

function ownerSubmissionForRenderer(value: OwnerSubmission): OwnerSubmission {
  const { submissionId, expectedRevision, status, proposal, allowedActions, evidenceRequired } = value;
  return { submissionId, expectedRevision, status, proposal, allowedActions, evidenceRequired };
}

type SubmissionNoticeTone = "success" | "error" | "info";
type SubmissionBusyAction = "refresh" | "save" | "submit" | "evidence" | "withdraw";

function ContributionCallout({ message = uiText("resources.submit.unavailable") }: { message?: string }) {
  const descriptionId = "resource-submission-unavailable";
  return (
    <section
      className="submissionCallout"
      data-aihub-submission-scope={CONTRIBUTION_SCOPES.join(",")}
    >
      <b>{uiText("resources.submit.title")}</b>
      <small>{uiText("resources.submit.candidateOnly")}</small>
      <small>{CONTRIBUTION_SCOPES.map((scope) => uiText(`resources.submit.scope.${scope}` as LanguageKey)).join(" · ")}</small>
      <button
        type="button"
        data-aihub-action="submit-resource"
        disabled
        aria-describedby={descriptionId}
      >
        {uiText("resources.submit.action")}
      </button>
      <small id={descriptionId} aria-live="polite">
        {message}
      </small>
    </section>
  );
}

function ContributionPage({
  identity,
  onBack,
  onLogin
}: {
  identity: IdentitySnapshot;
  onBack: () => void;
  onLogin: () => void;
}) {
  const [capability, setCapability] = useState<ResourceSubmissionCapability | null>(null);
  const [notice, setNotice] = useState<{ tone: SubmissionNoticeTone; message: string } | null>(null);
  const [items, setItems] = useState<OwnerSubmission[]>([]);
  const [selected, setSelected] = useState<OwnerSubmission | null>(null);
  const [form, setForm] = useState<ContributionForm>(EMPTY_CONTRIBUTION_FORM);
  const [busyAction, setBusyAction] = useState<SubmissionBusyAction | null>(null);
  const createIdempotencyKey = useRef<string | null>(null);
  const authenticated = identity.status === "authenticated";
  const canSubmit = Boolean(capability?.enabled && authenticated && window.aihubPC);
  const workflowUnavailable = (capability?.temporarilyUnavailableKinds || []).includes("workflow");
  const busy = busyAction !== null;

  useEffect(() => {
    let active = true;
    if (!window.aihubPC) {
      setNotice({ tone: "error", message: uiText("resources.submit.unavailable") });
      return;
    }
    void window.aihubPC.getSubmissionCapability().then((result) => {
      if (!active) return;
      if (result.ok) setCapability(result.value);
      else setNotice({ tone: "error", message: uiText(result.error.messageKey) });
    });
    return () => { active = false; };
  }, []);

  const apply = (next: OwnerSubmission) => {
    const safe = ownerSubmissionForRenderer(next);
    setItems((current) => [safe, ...current.filter((item) => item.submissionId !== safe.submissionId)]);
    setSelected(safe);
    setForm(contributionFormFromProposal(safe.proposal));
  };

  const refresh = async () => {
    if (!canSubmit || !window.aihubPC || busy) return;
    setBusyAction("refresh");
    try {
      const result = await window.aihubPC.listOwnSubmissions({ offset: 0, limit: 20 });
      if (!result.ok) return setNotice({ tone: "error", message: uiText(result.error.messageKey) });
      setItems(result.value.items.map(ownerSubmissionForRenderer));
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => { void refresh(); }, [canSubmit]);

  const update = <K extends keyof ContributionForm>(key: K, value: ContributionForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const disabled = busy || form.submissionKind === "workflow";

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || disabled || !window.aihubPC) return;
    const proposal = proposalFromContributionForm(form);
    if (!proposal) return setNotice({ tone: "error", message: uiText("resources.submit.invalid") });
    setBusyAction("save"); setNotice(null);
    try {
      if (selected && !selected.allowedActions.includes("update")) return;
      const result = selected
        ? await window.aihubPC.updateSubmissionDraft({ submissionId: selected.submissionId, expectedRevision: selected.expectedRevision, submission: proposal })
        : await window.aihubPC.createSubmission({ idempotencyKey: (createIdempotencyKey.current ||= crypto.randomUUID()), submission: proposal });
      if (!result.ok) return setNotice({ tone: "error", message: uiText(result.error.messageKey) });
      apply(result.value);
      if (!selected) createIdempotencyKey.current = null;
      setNotice({ tone: "success", message: uiText("resources.submit.saved") });
    } finally { setBusyAction(null); }
  };

  const action = async (name: "submit" | "evidence" | "withdraw") => {
    if (!selected || !canSubmit || busy || !selected.allowedActions.includes(name) || !window.aihubPC) return;
    setBusyAction(name); setNotice(null);
    try {
      const input = { submissionId: selected.submissionId, expectedRevision: selected.expectedRevision };
      const result = name === "submit"
        ? await window.aihubPC.submitSubmission(input)
        : name === "evidence"
          ? await window.aihubPC.addSubmissionEvidence({ ...input, evidenceRefs: contributionValues(form.evidenceRefs) })
          : await window.aihubPC.withdrawSubmission(input);
      if (!result.ok) return setNotice({ tone: "error", message: uiText(result.error.messageKey) });
      apply(result.value);
      setNotice({ tone: "success", message: uiText(`resources.submit.${name}Done` as LanguageKey) });
    } finally { setBusyAction(null); }
  };

  const choose = (item: OwnerSubmission) => {
    const safe = ownerSubmissionForRenderer(item);
    setSelected(safe); setForm(contributionFormFromProposal(safe.proposal)); setNotice(null);
  };

  return <section className="contributionPage">
    <BackButton onBack={onBack} />
    {!capability && <ContributionCallout message={notice?.message || uiText("resources.submit.loading")} />}
    {capability && !capability.enabled && <ContributionCallout />}
    {capability?.enabled && !authenticated && <section className="submissionCallout"><b>{uiText("resources.submit.title")}</b><small>{uiText("resources.submit.loginRequired")}</small><button type="button" onClick={onLogin}>{uiText("resources.submit.login")}</button><button type="button" disabled>{uiText("resources.submit.action")}</button></section>}
    {canSubmit && <div className="submissionWorkspace" data-aihub-submission-capability="enabled">
      <header><div><b>{uiText("resources.submit.title")}</b><small>{uiText("resources.submit.owner", { value1: identity.status === "authenticated" ? identity.user.profile.nickname : "" })}</small><small className="submissionCandidateBoundary">{uiText("resources.submit.candidateBoundary")}</small></div><button type="button" onClick={() => void refresh()} disabled={busy}>{busyAction === "refresh" ? uiText("resources.submit.refreshing") : uiText("resources.submit.refresh")}</button></header>
      <div className="submissionLayout">
        <aside className="submissionList" aria-label={uiText("resources.submit.mySubmissions")}>
          <button type="button" onClick={() => { setSelected(null); setForm(EMPTY_CONTRIBUTION_FORM); setNotice(null); }} disabled={busy}>{uiText("resources.submit.newDraft")}</button>
          {items.length ? items.map((item) => <button key={item.submissionId} type="button" className={selected?.submissionId === item.submissionId ? "selected" : ""} onClick={() => choose(item)}><b>{item.proposal.title}</b><small>{uiText(`resources.submit.status.${item.status}` as LanguageKey)}</small></button>) : <small>{uiText("resources.submit.empty")}</small>}
        </aside>
        <form className="submissionForm" onSubmit={save}>
          <label>{uiText("resources.submit.kind")}<select value={form.submissionKind} onChange={(event) => update("submissionKind", event.target.value as ResourceSubmissionKind)} disabled={busy || Boolean(selected)}>{CONTRIBUTION_SCOPES.map((kind) => <option key={kind} value={kind} disabled={kind === "workflow" || workflowUnavailable || !capability!.supportedKinds.includes(kind)}>{uiText(`resources.submit.scope.${kind}` as LanguageKey)}{kind === "workflow" ? ` — ${uiText("resources.submit.workflowUnavailable")}` : ""}</option>)}</select></label>
          {form.submissionKind === "workflow" && <p className="submissionNotice submissionNotice-info" role="status">{uiText("resources.submit.workflowUnavailable")}</p>}
          <div className="submissionFields">
            <label>{uiText("resources.submit.field.title")}<input required value={form.title} onChange={(event) => update("title", event.target.value)} disabled={disabled} /></label>
            <label>{uiText("resources.submit.field.canonicalSource")}<input required type="url" value={form.canonicalSource} onChange={(event) => update("canonicalSource", event.target.value)} disabled={disabled} /></label>
            <label>{uiText("resources.submit.field.originalAuthor")}<input value={form.originalAuthor} onChange={(event) => update("originalAuthor", event.target.value)} disabled={disabled} /></label>
            <label>{uiText("resources.submit.field.organization")}<input value={form.organization} onChange={(event) => update("organization", event.target.value)} disabled={disabled} /></label>
            <label>{uiText("resources.submit.field.license")}<input value={form.licenseId} onChange={(event) => update("licenseId", event.target.value)} disabled={disabled} /></label>
          </div>
          <label>{uiText("resources.submit.field.summary")}<textarea required value={form.summary} onChange={(event) => update("summary", event.target.value)} disabled={disabled} /></label>
          <label>{uiText("resources.submit.field.evidence")}<textarea value={form.evidenceRefs} onChange={(event) => update("evidenceRefs", event.target.value)} disabled={disabled} /></label>
          <details className="submissionSupplemental">
            <summary>{uiText("resources.submit.supplemental")}</summary>
            <small>{uiText("resources.submit.supplementalHint")}</small>
            <div className="submissionFields">
              <label>{uiText("resources.submit.field.version")}<input value={form.sourceRevision} onChange={(event) => update("sourceRevision", event.target.value)} disabled={disabled} /></label>
              <label>{uiText("resources.submit.field.hostCandidate")}<input placeholder={uiText("resources.submit.field.hostCandidateHint")} value={form.hostCandidate} onChange={(event) => update("hostCandidate", event.target.value)} disabled={disabled} /></label>
              <label>{uiText("resources.submit.field.platforms")}<input value={form.platforms} onChange={(event) => update("platforms", event.target.value)} disabled={disabled} /></label>
            </div>
            <fieldset disabled={disabled}><legend>{uiText("resources.submit.field.scenarioTags")}</legend><div className="submissionTagGrid">{SCENARIO_TAGS.map((tag) => <label key={tag.id}><input type="checkbox" checked={form.scenarioTags.includes(tag.id)} onChange={(event) => update("scenarioTags", event.target.checked ? [...form.scenarioTags, tag.id] : form.scenarioTags.filter((item) => item !== tag.id))} />{uiText(`resources.scenario.${tag.id}` as LanguageKey)}</label>)}</div></fieldset>
            <div className="submissionFields">
              <label>{uiText("resources.submit.field.rawTags")}<input value={form.rawTags} onChange={(event) => update("rawTags", event.target.value)} disabled={disabled} /></label>
              <label>{uiText("resources.submit.field.agentCompatibility")}<input value={form.agentCompatibility} onChange={(event) => update("agentCompatibility", event.target.value)} disabled={disabled} /></label>
              <label>{uiText("resources.submit.field.discoveredVia")}<input type="url" value={form.discoveredVia} onChange={(event) => update("discoveredVia", event.target.value)} disabled={disabled} /></label>
            </div>
          </details>
          <div className="submissionActions">
            <button className="accentButton" type="submit" data-aihub-action="save-submission" disabled={disabled || Boolean(selected && !selected.allowedActions.includes("update"))}>{busyAction === "save" ? uiText("resources.submit.saving") : uiText("resources.submit.saveDraft")}</button>
            <button type="button" data-aihub-action="submit-submission" onClick={() => void action("submit")} disabled={busy || !selected?.allowedActions.includes("submit")}>{busyAction === "submit" ? uiText("resources.submit.submitting") : uiText("resources.submit.submit")}</button>
            <button type="button" data-aihub-action="add-submission-evidence" onClick={() => void action("evidence")} disabled={busy || !selected?.allowedActions.includes("evidence")}>{busyAction === "evidence" ? uiText("resources.submit.addingEvidence") : uiText("resources.submit.addEvidence")}</button>
            <button type="button" data-aihub-action="withdraw-submission" onClick={() => void action("withdraw")} disabled={busy || !selected?.allowedActions.includes("withdraw")}>{busyAction === "withdraw" ? uiText("resources.submit.withdrawing") : uiText("resources.submit.withdraw")}</button>
          </div>
          {selected?.evidenceRequired && <small>{uiText("resources.submit.evidenceRequired")}</small>}
          {notice && <p className={`submissionNotice submissionNotice-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.message}</p>}
        </form>
      </div>
    </div>}
  </section>;
}

function BackButton({
  onBack,
  action = "back"
}: {
  onBack: () => void;
  action?: string;
}) {
  return (
    <button
      type="button"
      className="backButton"
      data-aihub-action={action}
      aria-label={uiText("navigation.back")}
      title={uiText("navigation.back")}
      onClick={onBack}
    >
      <IconArrowLeft size={21} stroke={2} aria-hidden="true" />
    </button>
  );
}

function VendorPage({
  vendor,
  directoryKind,
  language,
  productStages,
  productMissing,
  productProgress,
  productDownloadDetails,
  downloadTasks,
  managedDownloadQueueTasks,
  productErrors,
  productFiles,
  desktopStatuses,
  desktopOperationTasks,
  desktopUpdateOwners,
  cliLogs,
  cliVersions,
  cliStatuses,
  environmentMessages,
  environmentPackageStages,
  onBack,
  onInstallProduct,
  onGetLatestDesktop,
  onResumeDownload,
  onRetryDownload,
  onPauseDownload,
  onCancelDownload,
  onCancelManagedDownload,
  onRetryManagedDownload,
  onRelocateDownload,
  onUninstallCli,
  onReconcileCli,
  onOpenCli,
  onUninstallDesktop,
  onRecheckDesktopUninstall,
  onOpenDesktop,
  onOpenDesktopLocation,
  onOpenWindowsUninstall,
  onInstallEnvironment,
  onOpenEnvironmentInstaller
}: {
  vendor: Vendor;
  directoryKind: ProductDirectoryKind;
  language: Language;
  environment: EnvironmentReport | null;
  productStages: Record<string, ProductStage>;
  productMissing: Record<string, string[]>;
  productProgress: Record<string, number | null>;
  productDownloadDetails: Record<string, DownloadProgress>;
  downloadTasks: Record<string, ManagedDownloadTask>;
  managedDownloadQueueTasks: Record<string, ManagedDownloadQueueTask>;
  productErrors: Record<string, string>;
  productFiles: Record<string, string>;
  desktopStatuses: Record<string, DesktopStatus>;
  desktopOperationTasks: Record<string, DesktopOperationTask>;
  desktopUpdateOwners: Record<string, string>;
  cliLogs: Record<string, CliLogEntry[]>;
  cliVersions: Record<string, string>;
  cliStatuses: Record<string, CliStatus>;
  environmentMessages: Record<string, string>;
  environmentPackageStages: Record<string, EnvironmentPackageStage>;
  onBack: () => void;
  onInstallProduct: (product: Product) => void;
  onGetLatestDesktop: (product: Product) => void;
  onResumeDownload: (product: Product) => void;
  onRetryDownload: (product: Product) => void;
  onPauseDownload: (product: Product) => void;
  onCancelDownload: (product: Product, trigger: HTMLElement) => void;
  onCancelManagedDownload: (product: Product, trigger: HTMLElement) => void;
  onRetryManagedDownload: (product: Product) => void;
  onRelocateDownload: (product: Product, trigger: HTMLElement) => void;
  onUninstallCli: (product: Product) => void;
  onReconcileCli: (
    product: Product,
    intent: "update" | "repair"
  ) => void;
  onOpenCli: (product: Product) => void;
  onUninstallDesktop: (product: Product) => void;
  onRecheckDesktopUninstall: (product: Product) => void;
  onOpenDesktop: (product: Product) => void;
  onOpenDesktopLocation: (product: Product) => void;
  onOpenWindowsUninstall: () => void;
  onInstallEnvironment: (environmentId: string) => void;
  onOpenEnvironmentInstaller: (environmentId: string) => void;
}) {
  const groups: ProductKind[] = ["桌面端", "CLI", "其他产品"];
  const productDirectory = buildProductDirectory(vendor.products);
  const renderProduct = (product: Product, nested = false) => {
    const components = productDirectory.childrenByProductId[product.id] || [];
    return (
      <div
        className={nested ? "productDirectoryEntry nested" : "productDirectoryEntry"}
        key={product.id}
      >
        <ProductRow
          product={product}
          language={language}
          stage={productStages[product.id] || "idle"}
          missing={productMissing[product.id] || []}
          progress={productProgress[product.id] ?? null}
          downloadDetail={productDownloadDetails[product.id]}
          downloadTask={downloadTasks[product.id]}
          managedDownloadQueueTask={managedDownloadQueueTasks[product.id]}
          error={
            productErrors[product.id]
              ? runtimeMessage(productErrors[product.id])
              : ""
          }
          filePath={productFiles[product.id] || ""}
          desktopStatus={desktopStatuses[product.id]}
          desktopOperationTask={desktopOperationTasks[product.id]}
          updateOwner={desktopUpdateOwners[product.id]}
          logs={cliLogs[product.id] || []}
          version={cliVersions[product.id] || ""}
          cliStatus={cliStatuses[product.id]}
          environmentMessages={environmentMessages}
          environmentPackageStages={environmentPackageStages}
          onInstallProduct={() => onInstallProduct(product)}
          onGetLatestDesktop={() => onGetLatestDesktop(product)}
          onResumeDownload={() => onResumeDownload(product)}
          onRetryDownload={() => onRetryDownload(product)}
          onPauseDownload={() => onPauseDownload(product)}
          onCancelDownload={(trigger) => onCancelDownload(product, trigger)}
          onCancelManagedDownload={(trigger) => onCancelManagedDownload(product, trigger)}
          onRetryManagedDownload={() => onRetryManagedDownload(product)}
          onRelocateDownload={(trigger) => onRelocateDownload(product, trigger)}
          onUninstallCli={() => onUninstallCli(product)}
          onReconcileCli={(intent) => onReconcileCli(product, intent)}
          onOpenCli={() => onOpenCli(product)}
          onUninstallDesktop={() => onUninstallDesktop(product)}
          onRecheckDesktopUninstall={() =>
            onRecheckDesktopUninstall(product)
          }
          onOpenDesktop={() => onOpenDesktop(product)}
          onOpenDesktopLocation={() => onOpenDesktopLocation(product)}
          onOpenWindowsUninstall={onOpenWindowsUninstall}
          onInstallEnvironment={onInstallEnvironment}
          onOpenEnvironmentInstaller={onOpenEnvironmentInstaller}
        />
        {components.length > 0 ? (
          <details className="productComponents">
            <summary>
              {uiText("products.components", { count: components.length })}
            </summary>
            <div className="productComponentList">
              {components.map((component) => renderProduct(component, true))}
            </div>
          </details>
        ) : null}
      </div>
    );
  };
  return (
    <>
      <BackButton onBack={onBack} />
      <section className="vendorHero">
        <VendorMark vendor={vendor} hero />
        <div>
          <h1>{vendorDisplayName(vendor, language)}</h1>
          <span>{catalogDisplayField(vendor, "description", language)}</span>
        </div>
        <button className="quietButton" onClick={() => window.open(vendor.website)}>
          {uiText("auto.32991a0a11cb")}</button>
      </section>

      <section className="vendorProducts">
        <div className="sectionHeading">
          <div>
            <h2>
              {vendorDisplayName(vendor, language)} {directoryKind === "ai-connectable"
                ? uiText("directory.vendorProducts.connectable")
                : uiText("directory.vendorProducts.ai")}
            </h2>
          </div>
        </div>
        {groups.map((group) => {
          const products = productDirectory.roots.filter(
            (product) => product.kind === group
          );
          if (!products.length) return null;
          return (
            <section className="productGroup" key={group}>
              <h3>
                {group === "CLI"
                  ? uiText("product.kind.cli")
                  : group === "桌面端"
                    ? uiText("product.kind.visual")
                    : group}
              </h3>
              {products.map((product) => renderProduct(product))}
            </section>
          );
        })}
      </section>

      <section className="tutorialCard">
        <div>
          <h2>{vendorDisplayName(vendor, language)} {uiText("auto.8ef3fead5883")}</h2>
        </div>
        <button onClick={() => window.open(vendor.tutorial)}>
          {uiText("auto.08f7d323aada")}</button>
      </section>
    </>
  );
}

function ResourceStorePage({
  language,
  kind,
  resourceStores,
  resources,
  connections,
  vendors,
  initialResourceId = "",
  onOpenContribution
}: {
  language: Language;
  kind: ResourceStore["id"] | null;
  resourceStores: ResourceStore[];
  resources: EcosystemResource[];
  connections: ResourceConnection[];
  vendors: Vendor[];
  initialResourceId?: string;
  onOpenContribution: () => void;
}) {
  const [selectedResourceId, setSelectedResourceId] =
    useState(initialResourceId);
  const [sourceChannel, setSourceChannel] =
    useState<ResourceSourceChannel>("official");
  const [hostId, setHostId] = useState<string>(ALL_FILTER);
  const [compatibilityFilter, setCompatibilityFilter] =
    useState<ResourceCompatibilityFilter>("all");
  const store = resourceStores.find((candidate) => candidate.id === kind) || null;
  const marketplace = useMemo(
    () => createMarketplace({ resources, vendors, connections }),
    [resources, vendors, connections]
  );
  const sourceEntries = store
    ? marketplace.browse({ store: store.id, source: sourceChannel })
    : [];
  const filterFacets = store
    ? marketplace.facets({ store: store.id, source: sourceChannel })
    : { scenarios: {}, compatibility: { official: 0, verified: 0, "protocol-compatible": 0 } };
  const compatibilityOptions = RESOURCE_COMPATIBILITY_FILTERS.filter(
    (value) => value === "all" || filterFacets.compatibility[value] > 0
  );
  const hostOptions = [...new Map(
    sourceEntries.flatMap(({ hosts }) =>
      hosts.map(({ product }) => [product.id, product] as const)
    )
  ).values()];
  useEffect(() => {
    if (hostId !== ALL_FILTER && !hostOptions.some((product) => product.id === hostId)) {
      setHostId(ALL_FILTER);
    }
  }, [hostId, hostOptions]);
  useEffect(() => {
    if (!compatibilityOptions.includes(compatibilityFilter)) {
      setCompatibilityFilter("all");
    }
  }, [compatibilityFilter, compatibilityOptions]);
  if (!store) {
    return (
      <section className="catalogUnavailable" role="status">
        <b>{uiText("resources.emptyTitle")}</b>
        <span>{uiText("resources.emptyDescription")}</span>
      </section>
    );
  }
  const filteredEntries = marketplace
    .browse({
      store: store.id,
      source: sourceChannel,
      category: "all",
      hostId: hostId === ALL_FILTER ? "all" : hostId,
      compatibility: compatibilityFilter
    });
  const storeLabel = resourceStoreDisplayLabel(store, language);
  const sourceLabel = uiText("resources.channel.store", {
    value1: uiText(`resources.channel.${sourceChannel}` as LanguageKey),
    value2: storeLabel
  });
  const selectedEntry = selectedResourceId
    ? marketplace.detail(selectedResourceId)
    : null;
  const connectionEdges = (selectedEntry?.connections || []).flatMap(
    (connection) => {
      const host = selectedEntry?.hosts.find(
        ({ product }) => product.id === connection.hostProductId
      );
      return host ? [{ connection, host }] : [];
    }
  );
  const selectedHost = selectedEntry?.hosts.find(({ product }) => product.id === hostId) ||
    selectedEntry?.hosts[0] || null;

  return (
    <section
      className={`resourceStorePage${selectedEntry && selectedHost ? " resourceStorePageDetail" : ""}`}
      data-aihub-resource-store-window={store.id}
    >
      {!(selectedEntry && selectedHost) && (
        <header
          className="pageHeader resourceStoreHeader"
          data-aihub-resource-store-current={store.id}
        >
          <h1>{storeLabel}</h1>
          <span>{uiText("resources.description")}</span>
          <small className="resourceSourceContext" data-aihub-resource-source-context={sourceChannel} aria-live="polite">
            {uiText("resources.currentSource", { value1: sourceLabel })}
          </small>
        </header>
      )}
      {marketplace.browse({ store: store.id }).length === 0 ? (
        <section className="catalogUnavailable" role="status">
          <b>{uiText("resources.emptyTitle")}</b>
          <span>{uiText("resources.emptyDescription")}</span>
        </section>
      ) : selectedEntry && selectedHost ? (
        <section
          className="resourceLevel"
          data-aihub-resource-level="detail"
          data-aihub-resource-detail-id={selectedEntry.resource.id}
        >
          <header className="resourceLevelHeader">
            <BackButton
              action="back-resource-list"
              onBack={() => setSelectedResourceId("")}
            />
            <div className="resourceDetailIdentity" data-aihub-resource-detail-identity>
              <span className="resourceDetailIcon" aria-hidden="true">
                <ResourceStoreIcon storeId={store.id} size={30} />
              </span>
              <div className="resourceDetailCopy">
                <h2 className="resourceDetailName">
                  {catalogDisplayField(selectedEntry.resource, "name", language)}
                </h2>
                <p className="resourceDetailMeta" data-aihub-resource-detail-meta>
                  {[
                    selectedEntry.publisher?.name || selectedEntry.resource.publisher,
                    uiText(`resources.type.${store.id}` as LanguageKey),
                    uiText("resources.compatibleHostCount", { value1: selectedEntry.hosts.length })
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          </header>
          <section className="resourceOverview" data-aihub-resource-overview>
            <span className="resourceOverviewIcon">
              <ResourceStoreIcon storeId={store.id} size={30} />
            </span>
            <div className="resourceOverviewMain">
              <h3>{uiText("resources.whatItDoes")}</h3>
              <div className="resourcePurpose" data-aihub-resource-purpose>
                <b>{uiText("resources.resourceNote")}</b>
                <span>{catalogDisplayField(selectedEntry.resource, "description", language)}</span>
              </div>
              <p className="resourceOutcomeIntro">{uiText("resources.outcomeIntro")}</p>
              <ul className="resourceOutcomeList">
                {resourceOutcomeKeys(selectedEntry.resource).map((outcomeKey) => (
                  <li
                    className="resourceOutcomeItem"
                    key={outcomeKey}
                    data-aihub-resource-outcome={outcomeKey}
                  >
                    <span className="resourceOutcomeMarker" aria-hidden="true" />
                    <span>{uiText(outcomeKey)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <div className="resourceRelationFacts">
            {selectedEntry.publisher && (
              <div className="resourceRelationFact" data-aihub-resource-publisher>
                <b>{uiText("resources.publisher")}</b>
                <span>{selectedEntry.publisher.name}</span>
              </div>
            )}
            <div className="resourceRelationFact resourceCompatibleHosts" data-aihub-resource-compatible-hosts>
              <b>{uiText("resources.compatibleHosts")}</b>
              {selectedEntry.hosts.map(({ product, target }) => (
                <span key={product.id} data-aihub-resource-host-id={product.id}>
                  {catalogDisplayField(product, "name", language)} · {resourceCompatibilityLabel(target.compatibility)}
                </span>
              ))}
            </div>
            {connectionEdges.length > 0 && (
              <div className="resourceRelationFact" data-aihub-resource-connection-modes>
                <b>{uiText("resources.connectionModes")}</b>
                {connectionEdges.map(({ connection, host }) => (
                  <span
                    key={`${connection.connectionMode}:${connection.hostProductId}:${connection.bindingKind}`}
                    data-aihub-resource-connection-mode={connection.connectionMode}
                    data-aihub-resource-connection-host-id={connection.hostProductId}
                    data-aihub-resource-connection-binding-kind={connection.bindingKind}
                  >
                    {uiText(`resources.connectionMode.${connection.connectionMode}` as LanguageKey)} · {catalogDisplayField(host.product, "name", language)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ResourceRow
            resource={selectedEntry.resource}
            target={selectedHost.target}
          />
        </section>
      ) : (
        <section className="resourceStoreBrowse" data-aihub-resource-level="resources">
          <aside
            className="resourceFilterPanel"
            data-aihub-resource-filter-panel
          >
            <button
              type="button"
              className="submissionTextLink"
              data-aihub-action="open-resource-submission"
              onClick={onOpenContribution}
            >
              <span>{uiText("resources.submit.storeLink")}</span>
              <IconChevronRight size={18} stroke={1.9} aria-hidden="true" />
            </button>
            <div className="filters resourceStoreFilters">
            <FilterRow
              label={uiText("resources.sourceFilter")}
              values={RESOURCE_SOURCE_CHANNELS}
              labels={{
                official: uiText("resources.channel.store", {
                  value1: uiText("resources.channel.official"),
                  value2: storeLabel
                }),
                community: uiText("resources.channel.store", {
                  value1: uiText("resources.channel.community"),
                  value2: storeLabel
                })
              }}
              active={sourceChannel}
              onChange={(value) => {
                setSourceChannel(value as ResourceSourceChannel);
                setSelectedResourceId("");
              }}
              marker="source-channel"
            />
            <FilterRow
              label={uiText("resources.hostFilter")}
              values={[ALL_FILTER, ...hostOptions.map((product) => product.id)]}
              labels={Object.fromEntries([
                [ALL_FILTER, uiText("resources.filter.all")],
                ...hostOptions.map((product) => [
                  product.id,
                  catalogDisplayField(product, "name", language)
                ])
              ])}
              active={hostId}
              onChange={setHostId}
              marker="host"
            />
            <FilterRow
              label={uiText("resources.compatibilityFilter")}
              values={compatibilityOptions}
              labels={Object.fromEntries(
                compatibilityOptions.map((value) => [
                  value,
                  value === "all"
                    ? `${uiText("resources.filter.all")} (${sourceEntries.length})`
                    : `${uiText(`resources.compatibility.${value}` as LanguageKey)} (${filterFacets.compatibility[value]})`
                ])
              )}
              active={compatibilityFilter}
              onChange={(value) => setCompatibilityFilter(value as ResourceCompatibilityFilter)}
              marker="compatibility"
            />
            </div>
          </aside>
          <div
            className="resourceStoreResults"
            data-aihub-resource-results-scroll
            tabIndex={0}
            aria-label={sourceLabel}
          >
          {filteredEntries.length === 0 ? (
            <section
              className="catalogUnavailable resourceSourceEmpty"
              role="status"
              data-aihub-resource-empty-source={sourceEntries.length === 0 ? sourceChannel : undefined}
              data-aihub-resource-empty-filter={sourceEntries.length > 0 ? "" : undefined}
            >
              <b>{sourceEntries.length > 0
                ? uiText("resources.filterEmptyTitle")
                : sourceChannel === "community"
                  ? uiText("resources.communityEmptyTitle")
                  : uiText("resources.emptyTitle")}</b>
              <span>{sourceEntries.length > 0
                ? uiText("resources.filterEmptyDescription")
                : sourceChannel === "community"
                  ? uiText("resources.communityEmptyDescription")
                  : uiText("resources.emptyDescription")}</span>
              {sourceEntries.length === 0 && sourceChannel === "community" && (
                <button
                  type="button"
                  className="accentButton"
                  data-aihub-action="switch-resource-source-official"
                  onClick={() => setSourceChannel("official")}
                >
                  {uiText("resources.communityEmptyAction")}
                </button>
              )}
            </section>
          ) : (
            <>
          <div className="directorySummary">
            <b>{sourceLabel}</b>
            <span>
              {filteredEntries.length} {uiText("resources.count")}
            </span>
          </div>
          <div className="resourceCardGrid">
            {filteredEntries.map(({ resource, hosts, publisher }) => (
              <button
                type="button"
                className="resourceSummaryCard"
                key={resource.id}
                data-aihub-action="open-resource-detail"
                data-aihub-resource-id={resource.id}
                onClick={() => setSelectedResourceId(resource.id)}
              >
                <span className="resourceCardIdentity">
                  <span className="resourceCardIcon">
                    <ResourceStoreIcon storeId={store.id} size={29} />
                  </span>
                  <span className="resourceCardTitle">
                    <b>{catalogDisplayField(resource, "name", language)}</b>
                  </span>
                </span>
                <small className="resourceCardDescription">{catalogDisplayField(resource, "description", language)}</small>
                {publisher && <small className="resourceCardPublisher">{uiText("resources.publisher")}: {publisher.name}</small>}
                <footer>
                  <span>{uiText("resources.compatibleHostCount", { value1: hosts.length })}</span>
                  <strong>{uiText("resources.viewDetail")} <IconChevronRight size={16} stroke={2} aria-hidden="true" /></strong>
                </footer>
              </button>
            ))}
          </div>
            </>
          )}
          </div>
        </section>
      )}
    </section>
  );
}

function ResourceRow({
  resource,
  target
}: {
  resource: EcosystemResource;
  target: ResourceTarget;
}) {
  const presentation = resourceTargetPresentation(resource, target);
  const managed = presentation.managed;
  const sourceChannel = resourceSourceChannel(resource);
  const reviewStatus = resourceReviewStatus(resource);
  const riskLevel = resourceRiskLevel(resource);
  const source = resource.metadataSnapshot;
  const provenanceActions = resourceProvenancePresentation(resource);
  const blockedFromManagement =
    reviewStatus === "rejected" || riskLevel === "unsafe";
  const externalReference = source?.externalReference
    ? Object.entries(source.externalReference)
    : [];
  const facts = [
    resource.versionRef
      ? `${uiText("resources.version")}: ${resource.versionRef}`
      : "",
    resource.requestedPermissions?.length
      ? `${uiText("resources.permissions")}: ${resource.requestedPermissions.join(" · ")}`
      : "",
    resource.credentialRequirements?.length
      ? `${uiText("resources.credentials")}: ${resource.credentialRequirements.join(" · ")}`
      : "",
    resource.installScope
      ? `${uiText("resources.installScope")}: ${resource.installScope}`
      : "",
    resource.uninstallPlan
      ? `${uiText("resources.uninstallPlan")}: ${resource.uninstallPlan}`
      : "",
    resource.lastVerifiedAt
      ? `${uiText("resources.lastVerifiedAt")}: ${resource.lastVerifiedAt.slice(0, 10)}`
      : ""
  ].filter(Boolean);
  const [status, setStatus] = useState<ExtensionRuntimeResult | null>(null);
  const [busyAction, setBusyAction] = useState<ExtensionRuntimeAction | "inspect" | null>(null);

  const runAction = async (action: ExtensionRuntimeAction | "inspect") => {
    const api = window.aihubPC;
    if (!api || !managed || busyAction) return;
    if (
      riskLevel === "guarded" &&
      action !== "inspect" &&
      !window.confirm(uiText("resources.risk.guardedConfirm"))
    ) {
      return;
    }
    setBusyAction(action);
    try {
      const result =
        action === "inspect"
          ? await api.inspectExtension(target.installProfileId)
          : await api.executeExtension(target.installProfileId, action);
      setStatus(result);
    } catch {
      setStatus({
        ok: false,
        state: "error",
        managed: false,
        allowedActions: [],
        error: uiText("extensions.failed")
      });
    } finally {
      setBusyAction(null);
    }
  };

  const availableActions = status?.ok
    ? status.allowedActions.filter((action) => target.capabilities.includes(action))
    : [];
  const statusLabel =
    busyAction === "inspect"
      ? uiText("extensions.checking")
      : extensionStatusLabel(status);

  return (
    <article
      className="resourceRow"
      data-aihub-resource-id={resource.id}
      data-aihub-extension-profile-id={target.installProfileId || undefined}
    >
      <div className="resourceRowMain">
        <h3 className="resourceInstallHeading">{uiText("resources.installAndTrust")}</h3>
        <div className="resourceGovernance">
          {sourceChannel && (
            <span>{uiText(`resources.channel.${sourceChannel}` as LanguageKey)}</span>
          )}
          <span>{uiText("resources.review")}: {uiText(`resources.review.${reviewStatus}` as LanguageKey)}</span>
          <span>{uiText("resources.risk")}: {uiText(`resources.risk.${riskLevel}` as LanguageKey)}</span>
        </div>
        {blockedFromManagement && (
          <small className="resourceWarning">
            {uiText(
              reviewStatus === "rejected"
                ? "resources.warning.rejected"
                : "resources.warning.unsafe"
            )}
          </small>
        )}
        {riskLevel === "guarded" && !blockedFromManagement && (
          <small className="resourceGuarded">
            {uiText("resources.risk.guardedNotice")}
          </small>
        )}
        <div className="resourceFacts">
          <small>
            {uiText("resources.compatibility")}: {resourceCompatibilityLabel(target.compatibility)}
          </small>
          {facts.map((fact) => <small key={fact}>{fact}</small>)}
        </div>
        {source && (
          <details className="resourceSourceDetails">
            <summary>{uiText("resources.sourceDetails")}</summary>
            <small>{uiText("resources.sourcePlatform")}: {source.sourcePlatform}</small>
            <small>{uiText("resources.observedAt")}: {source.observedAt.slice(0, 10)}</small>
            {source.originalAuthor && (
              <small>{uiText("resources.originalAuthor")}: {source.originalAuthor}</small>
            )}
            {source.discoveredVia && (
              <small>{uiText("resources.discoveredVia")}: {source.discoveredVia}</small>
            )}
            {externalReference.length > 0 && (
              <small>
                {uiText("resources.externalData")}: {source.sourcePlatform} · {source.observedAt.slice(0, 10)} · {externalReference.map(([key, value]) => `${key}: ${value}`).join(" · ")}
              </small>
            )}
            {source.canonicalSource && (
              <button
                data-aihub-action="open-resource-canonical-source"
                onClick={() => window.open(source.canonicalSource)}
              >
                {uiText("resources.openCanonicalSource")} ↗
              </button>
            )}
            <button
              data-aihub-action="open-resource-source-detail"
              onClick={() => window.open(source.sourcePage)}
            >
              {uiText("resources.openSourceDetail")} ↗
            </button>
          </details>
        )}
        {managed && statusLabel && (
          <small className={status?.ok === false ? "resourceError" : ""}>
            {statusLabel}
          </small>
        )}
      </div>
      <div className="resourceActions">
        {presentation.links.map((link) => (
          <button
            key={link.kind}
            data-aihub-action={`open-resource-${link.kind}`}
            onClick={() => window.open(link.href)}
          >
            {uiText(link.labelKey)} ↗
          </button>
        ))}
        {provenanceActions.map((action) => (
          <button
            key={action.href}
            data-aihub-action="open-resource-provenance"
            onClick={() => window.open(action.href)}
          >
            {uiText(action.labelKey as LanguageKey)} ↗
          </button>
        ))}
        {managed && !status && (
          <button
            data-aihub-action="inspect-extension"
            disabled={busyAction !== null}
            onClick={() => void runAction("inspect")}
          >
            {busyAction ? uiText("extensions.checking") : uiText("extensions.checkAvailability")}
          </button>
        )}
        {availableActions.map((action) => (
          <button
            key={action}
            className={action === "install" || action === "update" || action === "repair" || action === "enable" ? "accentButton" : ""}
            data-aihub-action={`${action}-extension`}
            disabled={busyAction !== null}
            onClick={() => void runAction(action)}
          >
            {extensionActionLabel(action, busyAction === action)}
          </button>
        ))}
      </div>
    </article>
  );
}

function FixedCliLifecycleActions({
  product,
  language
}: {
  product: Product;
  language: Language;
}) {
  const api = window.aihubPC;
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<FixedCliLifecycleStatus | null>(null);
  const [plan, setPlan] = useState<FixedCliLifecyclePlan | null>(null);
  const [busy, setBusy] = useState<"plan" | "update-plan" | "uninstall-plan" | "apply" | "recheck" | null>(null);
  const [restoreFocus, setRestoreFocus] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const useId = useRef(crypto.randomUUID());
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const fixedCliConfirmationHeading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    let active = true;
    setAvailable(false);
    setStatus(null);
    setPlan(null);
    if (!api) return;
    void api.getFixedCliLifecycleStatus({ productId: product.id }).then((result) => {
      if (!active) return;
      if (result.ok) {
        setStatus(result.value);
        setAvailable(true);
      }
    });
    return () => { active = false; };
  }, [api, product.id]);

  useEffect(() => {
    if (plan) fixedCliConfirmationHeading.current?.focus();
  }, [plan]);

  useEffect(() => {
    if (restoreFocus && !busy) {
      triggerRef.current?.focus();
      setRestoreFocus(false);
    }
  }, [busy, restoreFocus]);

  if (!api || !available || !status) return null;
  const closePlan = () => {
    setPlan(null);
    setRestoreFocus(true);
  };
  const begin = async (operation: FixedCliLifecycleOperation, trigger: HTMLButtonElement) => {
    if (busy) return;
    triggerRef.current = trigger;
    setBusy(operation === "uninstall" ? "uninstall-plan" : operation === "update" ? "update-plan" : "plan");
    setNotice(null);
    setPlan(null);
    try {
      const result = await api.planFixedCliLifecycle({
        productId: product.id,
        operation,
        useId: useId.current
      });
      if (!result.ok) return setNotice({ tone: "error", message: uiText(result.error.messageKey) });
      setPlan(result.value);
    } finally { setBusy(null); }
  };
  const confirm = async () => {
    if (!plan || busy) return;
    const confirmationId = crypto.randomUUID();
    setBusy("apply");
    setNotice(null);
    try {
      const confirmation = await api.confirmFixedCliLifecycle({
        planId: plan.planId,
        useId: useId.current,
        confirmationId
      });
      if (!confirmation.ok) return setNotice({ tone: "error", message: uiText(confirmation.error.messageKey) });
      const applied = await api.applyFixedCliLifecycle({
        planId: plan.planId,
        useId: useId.current,
        confirmationId,
        dryRun: false
      });
      if (!applied.ok) return setNotice({ tone: "error", message: uiText(applied.error.messageKey) });
      setBusy("recheck");
      const rechecked = await api.recheckFixedCliLifecycle({ productId: product.id });
      if (!rechecked.ok) return setNotice({ tone: "error", message: uiText(rechecked.error.messageKey) });
      setStatus(rechecked.value);
      closePlan();
      setNotice({
        tone: "success",
        message: uiText(plan.operation === "uninstall" ? "cli.lifecycle.uninstallSuccess" : "cli.lifecycle.success")
      });
    } finally { setBusy(null); }
  };
  const recheck = async () => {
    if (busy) return;
    setBusy("recheck");
    setNotice(null);
    try {
      const result = await api.recheckFixedCliLifecycle({ productId: product.id });
      if (!result.ok) return setNotice({ tone: "error", message: uiText(result.error.messageKey) });
      setStatus(result.value);
    } finally { setBusy(null); }
  };
  const deployOperation: FixedCliLifecycleOperation = status.installed && status.managed ? "update" : "install";
  const confirmationTitle = plan?.operation === "uninstall"
    ? "cli.lifecycle.confirmUninstallTitle"
    : plan?.operation === "update"
      ? "cli.lifecycle.confirmUpdateTitle"
      : "cli.lifecycle.confirmTitle";
  const confirmationRisk = plan?.operation === "uninstall"
    ? "cli.lifecycle.uninstallScope"
    : plan?.operation === "update"
      ? "cli.lifecycle.updateRisk"
      : "cli.lifecycle.risk";
  return (
    <div className="fixedCliLifecycle" data-aihub-fixed-cli-lifecycle={product.id}>
      {status.installed && status.managed && <small>{uiText("cli.lifecycle.installed")}</small>}
      <div className="fixedCliLifecycleActions">
        <button
          className="accentButton"
          data-aihub-action="fixed-cli-deploy"
          disabled={busy !== null}
          onClick={(event) => void begin(deployOperation, event.currentTarget)}
        >
          {busy === "plan"
            ? uiText("cli.lifecycle.preparing")
            : busy === "update-plan"
              ? uiText("cli.lifecycle.preparingUpdate")
              : uiText(deployOperation === "install" ? "cli.lifecycle.deploy" : "cli.lifecycle.update")}
        </button>
        <button data-aihub-action="fixed-cli-recheck" disabled={busy !== null} onClick={() => void recheck()}>
          {busy === "recheck" ? uiText("cli.lifecycle.preparing") : uiText("cli.lifecycle.recheck")}
        </button>
        {status.installed && status.managed && (
          <button data-aihub-action="fixed-cli-uninstall" disabled={busy !== null} onClick={(event) => void begin("uninstall", event.currentTarget)}>
            {busy === "uninstall-plan" ? uiText("cli.lifecycle.preparingUninstall") : uiText("cli.lifecycle.uninstall")}
          </button>
        )}
      </div>
      {plan && (
        <section className="fixedCliLifecycleConfirm" role="group" aria-labelledby={`fixed-cli-title-${product.id}`}>
          <h4 ref={fixedCliConfirmationHeading} tabIndex={-1} id={`fixed-cli-title-${product.id}`}>
            {uiText(confirmationTitle)}
          </h4>
          <small>{uiText("cli.lifecycle.product", { value1: catalogDisplayField(product, "name", language) })}</small>
          <small>{uiText("cli.lifecycle.profile", { value1: plan.profileId })}</small>
          <small className="fixedCliLifecycleSource">{uiText("cli.lifecycle.source", { value1: product.website })}</small>
          <small>{uiText(confirmationRisk)}</small>
          {plan.operation !== "uninstall" && <small>{uiText("cli.lifecycle.noAgent")}</small>}
          <div className="fixedCliLifecycleActions">
            <button className="fixedCliCancel" type="button" disabled={busy !== null} onClick={closePlan}>{uiText("cli.lifecycle.cancel")}</button>
            <button
              type="button"
              className={plan.operation === "uninstall" ? "dangerButton" : "accentButton"}
              data-aihub-action="fixed-cli-confirm"
              disabled={busy !== null}
              onClick={() => void confirm()}
            >
              {busy === "apply"
                ? uiText(plan.operation === "uninstall" ? "cli.lifecycle.uninstalling" : "cli.lifecycle.applying")
                : uiText(plan.operation === "uninstall" ? "cli.lifecycle.confirmUninstall" : "cli.lifecycle.confirmDeploy")}
            </button>
          </div>
        </section>
      )}
      {notice && <small className={`fixedCliLifecycleNotice ${notice.tone === "error" ? "error" : "success"}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.message}</small>}
    </div>
  );
}

function ManagedDownloadQueueProductState({
  task,
  fileName,
  language,
  onOpenDownloaded,
  onCancel,
  onRetry
}: {
  task: ManagedDownloadQueueTask;
  fileName?: string;
  language: Language;
  onOpenDownloaded: () => void;
  onCancel: (trigger: HTMLButtonElement) => void;
  onRetry: () => void;
}) {
  const active = task.presentation.canCancel;
  const retryable = task.presentation.canRetry;
  const progress = task.progress;
  const downloadedPresentation = task.phase === "downloaded"
    ? getProductInstallPresentation({ stage: "downloaded", filePath: fileName, language })
    : null;
  return (
    <div className="managedDownloadQueueProduct" data-aihub-managed-download-phase={task.phase}>
      <button
        className="accentButton"
        data-aihub-action={active ? "enqueue-managed-download" : "managed-download-status"}
        disabled
      >
        {managedDownloadQueuePhaseLabel(task)}
      </button>
      {task.phase === "downloaded" ? (
        <>
          <small role="status">{uiText("downloadQueue.downloadedWait")}</small>
          <button
            type="button"
            className="accentButton"
            data-aihub-action="open-downloaded-package"
            onClick={onOpenDownloaded}
          >
            {downloadedPresentation?.buttonLabel}
          </button>
        </>
      ) : (
        <>
          {task.phase === "queued" && <small role="status">{uiText("downloadQueue.alreadyQueued")}</small>}
          {active && (
            <div className="downloadStateActions">
              <button data-aihub-action="cancel-managed-download" onClick={(event) => onCancel(event.currentTarget)}>
                {uiText("downloadQueue.cancel")}
              </button>
            </div>
          )}
          {retryable && (
            <button data-aihub-action="retry-managed-download" onClick={onRetry}>
              {uiText("downloadQueue.retry")}
            </button>
          )}
          {progress.receivedBytes > 0 && (
            <small>
              {formatBytes(progress.receivedBytes)}
              {progress.totalBytes > 0 ? ` / ${formatBytes(progress.totalBytes)}` : ""}
            </small>
          )}
          {progress.percent !== null && active && (
            <div className="downloadProgressTrack">
              <i style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} />
            </div>
          )}
          {task.phase === "failed" && <small className="queueTaskError" role="alert">{uiText("downloadQueue.failed")}</small>}
        </>
      )}
    </div>
  );
}

function ProductRow({
  product,
  language,
  stage,
  missing,
  progress,
  downloadDetail,
  downloadTask,
  managedDownloadQueueTask,
  error,
  filePath,
  desktopStatus,
  desktopOperationTask,
  updateOwner,
  logs,
  version,
  cliStatus,
  environmentMessages,
  environmentPackageStages,
  onInstallProduct,
  onGetLatestDesktop,
  onResumeDownload,
  onRetryDownload,
  onPauseDownload,
  onCancelDownload,
  onCancelManagedDownload,
  onRetryManagedDownload,
  onRelocateDownload,
  onUninstallCli,
  onReconcileCli,
  onOpenCli,
  onUninstallDesktop,
  onRecheckDesktopUninstall,
  onOpenDesktop,
  onOpenDesktopLocation,
  onOpenWindowsUninstall,
  onInstallEnvironment,
  onOpenEnvironmentInstaller
}: {
  product: Product;
  language: Language;
  stage: ProductStage;
  missing: string[];
  progress: number | null;
  downloadDetail?: DownloadProgress;
  downloadTask?: ManagedDownloadTask;
  managedDownloadQueueTask?: ManagedDownloadQueueTask;
  error: string;
  filePath: string;
  desktopStatus?: DesktopStatus;
  desktopOperationTask?: DesktopOperationTask;
  updateOwner?: string;
  logs: CliLogEntry[];
  version: string;
  cliStatus?: CliStatus;
  environmentMessages: Record<string, string>;
  environmentPackageStages: Record<string, EnvironmentPackageStage>;
  onInstallProduct: () => void;
  onGetLatestDesktop: () => void;
  onResumeDownload: () => void;
  onRetryDownload: () => void;
  onPauseDownload: () => void;
  onCancelDownload: (trigger: HTMLButtonElement) => void;
  onCancelManagedDownload: (trigger: HTMLButtonElement) => void;
  onRetryManagedDownload: () => void;
  onRelocateDownload: (trigger: HTMLButtonElement) => void;
  onUninstallCli: () => void;
  onReconcileCli: (intent: "update" | "repair") => void;
  onOpenCli: () => void;
  onUninstallDesktop: () => void;
  onRecheckDesktopUninstall: () => void;
  onOpenDesktop: () => void;
  onOpenDesktopLocation: () => void;
  onOpenWindowsUninstall: () => void;
  onInstallEnvironment: (environmentId: string) => void;
  onOpenEnvironmentInstaller: (environmentId: string) => void;
}) {
  const officialDownloadCopy = product.officialDownload && ({
    "vendor-bootstrap": {
      label: "desktop.acquisition.vendorBootstrap",
      hint: "desktop.acquisition.vendorBootstrapHint"
    },
    "download-page": {
      label: "desktop.acquisition.downloadPage",
      hint: "desktop.acquisition.downloadPageHint"
    },
    "fixed-redirect": {
      label: "desktop.acquisition.fixedRedirect",
      hint: "desktop.acquisition.fixedRedirectHint"
    },
    "stable-redirect": {
      label: "desktop.acquisition.stableRedirect",
      hint: "desktop.acquisition.stableRedirectHint"
    },
    "store": {
      label: "desktop.acquisition.store",
      hint: "desktop.acquisition.storeHint"
    },
    "login-required": {
      label: "desktop.acquisition.loginRequired",
      hint: "desktop.acquisition.loginRequiredHint"
    },
    "manual-selector": {
      label: "desktop.acquisition.manualSelector",
      hint: "desktop.acquisition.manualSelectorHint"
    },
    "no-windows": {
      label: "desktop.acquisition.noWindows",
      hint: "desktop.acquisition.noWindowsHint"
    }
  } as const)[product.officialDownload.kind];
  const behavior = resolveProductBehavior(product);
  const installPresentation = getProductInstallPresentation({
    stage,
    filePath,
    language
  });
  const downloadRecoveryPresentation =
    getProductDownloadRecoveryPresentation({ stage, downloadTask });
  const uninstallCopy = getDesktopUninstallPresentation(
    product.id,
    desktopStatus?.uninstallMode,
    language
  );
  // A stale development pre-bundle must not be able to blank the entire
  // vendor page while the shared behavior module is being updated.
  const entryPoints = behavior.entryPoints || [];
  const actionEntry = entryPoints.find(
    (entry) => entry.type === (product.kind === "CLI" ? "cli" : "desktop")
  );
  const linkEntries = entryPoints.filter(
    (entry): entry is Extract<(typeof behavior.entryPoints)[number], { url: string }> =>
      "url" in entry &&
      (entry.type === "tutorial"
        ? behavior.canOpenTutorial
        : behavior.canOpenWebsite)
  );
  const managedDesktopAction =
    product.productType === "desktop-download-only"
      ? behavior.managedDownload
      : behavior.managedDesktop;
  const installButtonLabel =
    managedDesktopAction
      ? behavior.managedDownload
        ? uiText("download.oneClick")
        : uiText("desktop.openOfficialDownload")
      : behavior.managedCli && cliStatus?.canRepair && !cliStatus.installed
      ? uiText("cli.repair")
      : actionEntry?.label ||
        behavior.primaryLabel ||
        (behavior.managedCli || behavior.managedDesktop
          ? uiText("auto.c5a01527da36")
          : product.productType === "desktop-official"
            ? uiText("auto.6136b14a050c")
            : uiText("auto.96b410ae01e3"));
  const installable = behavior.canInstall;
  const fixedCliLifecycle =
    product.kind === "CLI" &&
    FIXED_CLI_LIFECYCLE_PRODUCT_IDS.has(product.id) &&
    Boolean(
      window.aihubPC &&
      "planFixedCliLifecycle" in window.aihubPC &&
      "confirmFixedCliLifecycle" in window.aihubPC &&
      "applyFixedCliLifecycle" in window.aihubPC &&
      "getFixedCliLifecycleStatus" in window.aihubPC &&
      "recheckFixedCliLifecycle" in window.aihubPC
    );
  const managedActionsAvailable =
    !fixedCliLifecycle &&
    Boolean(actionEntry) &&
    (behavior.managedCli || managedDesktopAction) &&
    (behavior.canInstall ||
      behavior.canOpenInstalled ||
      behavior.canUninstall);
  const officialPageAction =
    product.productType === "desktop-official" &&
    product.downloadPolicy === "official-page";
  const officialDownloadUrl = officialPageAction
    ? resolveOfficialDownloadUrl(product.officialDownload, product.website)
    : product.website;
  const officialDownloadLabel =
    officialDownloadCopy
      ? uiText(officialDownloadCopy.label)
      : uiText("desktop.openOfficialDownload");
  const openOfficialDownload = () => window.open(officialDownloadUrl);
  const cliDeployable = behavior.managedCli;
  const productOperationBusy = [
    "detecting",
    "deploying",
    "removing-cli",
    "downloading",
    "launching-installer",
    "awaiting-verification",
    "awaiting-uninstall"
  ].includes(stage);
  const downloadTaskChanging =
    downloadTask?.phase === "pausing" ||
    downloadTask?.phase === "canceling";
  const downloadStatusLabel =
    downloadTask?.phase === "starting"
      ? uiText("auto.05ca4cf43882")
      : downloadTask?.phase === "pausing"
        ? uiText("auto.1006f93767b8")
        : downloadTask?.phase === "canceling"
          ? uiText("auto.4d0d3353c378")
          : uiText("auto.0e88061a5088", { value1: progress === null ? "…" : ` ${progress}%` });
  const environmentStatus = missing
    .map((environmentId) => environmentMessages[environmentId])
    .find(Boolean);
  return (
    <article className="productRow" data-aihub-product-id={product.id}>
      <div className="productInfo">
        <div className="productInfoMain">
          <span className="productKind">
            {product.kind === "CLI"
              ? uiText("product.kind.cli")
              : product.kind === "桌面端"
                ? uiText("product.kind.visual")
                : product.kind}
          </span>
          <h4>{catalogDisplayField(product, "name", language)}</h4>
          <p className="productDescription">{catalogDisplayField(product, "description", language)}</p>
        </div>
        <div className="productStatusStack">
          {product.kind === "CLI" && (
            <small>{uiText("product.kind.cliHint")}</small>
          )}
          {product.kind === "桌面端" && (
            <small>{uiText("product.kind.visualHint")}</small>
          )}
          {officialDownloadCopy && (
            <small className="acquisitionHint">{uiText(officialDownloadCopy.hint)}</small>
          )}
          {product.officialDownload?.note && (
            <small className="acquisitionHint">{product.officialDownload.note}</small>
          )}
          {desktopStatus?.legacyInstall === "comfy-desktop-v1" && (
            <small>{uiText("desktop.comfyLegacyMigration")}</small>
          )}
          {cliStatus?.summary && <small>{runtimeMessage(cliStatus.summary)}</small>}
        </div>
      </div>
      <div className="productActions">
      {linkEntries.map((entry, index) => (
          <button
            key={`${entry.type}-${index}-${entry.url}`}
            className="websiteButton"
            onClick={() => window.open(entry.url)}
          >
            {entry.label} ↗
          </button>
      ))}
      {actionEntry && !managedActionsAvailable && !fixedCliLifecycle && (
        <button
          className="websiteButton"
          onClick={officialPageAction ? openOfficialDownload : onInstallProduct}
        >
          {officialPageAction
            ? officialDownloadLabel
            : product.kind === "桌面端"
              ? uiText("desktop.openOfficialDownload")
              : actionEntry.label} ↗
        </button>
      )}
      {fixedCliLifecycle ? <FixedCliLifecycleActions product={product} language={language} /> : managedActionsAvailable ? (
        <div className="installFlow">
          {managedDownloadQueueTask ? (
            <ManagedDownloadQueueProductState
              task={managedDownloadQueueTask}
              fileName={product.download?.fileName}
              language={language}
              onOpenDownloaded={onInstallProduct}
              onCancel={onCancelManagedDownload}
              onRetry={onRetryManagedDownload}
            />
          ) : <>
          {stage === "idle" && installable && (
            <button
              className="accentButton"
              data-aihub-action={hasManagedDownloadQueueApi() && behavior.managedDownload ? "enqueue-managed-download" : "install-product"}
              disabled={productOperationBusy}
              onClick={onInstallProduct}
            >
              {installButtonLabel}
            </button>
          )}
          {stage === "blocked" && (
            <div className="blockedState">
              <span>{uiText("auto.463071aaadb9")}{missing.join("、")}</span>
              <div className="missingEnvironmentActions">
                {missing.map((environmentId) => {
                  const environmentStage =
                    environmentPackageStages[environmentId];
                  const environmentName =
                    ENVIRONMENT_NAMES[environmentId] || environmentId;
                  return (
                    <button
                      key={environmentId}
                      disabled={
                        environmentStageIsBusy(environmentStage) &&
                        environmentStage !== "downloading"
                      }
                      onClick={() =>
                        environmentStage === "ready"
                          ? onOpenEnvironmentInstaller(environmentId)
                          : onInstallEnvironment(environmentId)
                      }
                    >
                      {environmentInstallButtonLabel(
                        environmentStage,
                        environmentName,
                        uiText("auto.fa43ae0d543c", { value1: environmentName })
                      )}
                    </button>
                  );
                })}
              </div>
              <small>
                {environmentStatus
                  ? runtimeMessage(environmentStatus)
                  : uiText("auto.b7d7fb13afb6")}
              </small>
            </div>
          )}
          {stage === "ready" && (
            <button
              className="accentButton"
              data-aihub-action={hasManagedDownloadQueueApi() && behavior.managedDownload ? "enqueue-managed-download" : "install-product"}
              onClick={onInstallProduct}
            >
              {installButtonLabel}
            </button>
          )}
          {stage === "removing-cli" && (
            <div className="cliLog">
              <b>{uiText("auto.ffce5549645d")}</b>
              {logs.length ? (
                logs.map((entry, index) => (
                  <span className={entry.stream} key={`${index}-${entry.line}`}>
                    {entry.line}
                  </span>
                ))
              ) : (
                <span>
                  {uiText("auto.ee4363795ed4")}</span>
              )}
            </div>
          )}
          {stage === "downloading" && (
            <div className="downloadState">
              <button
                className="accentButton"
                data-aihub-action="product-busy"
                disabled
              >
                {uiText("download.downloading")}
              </button>
              <div className="downloadStateHeader">
                <span>{downloadStatusLabel}</span>
                <div className="downloadStateActions">
                  <button
                    data-aihub-action="pause-download"
                    disabled={downloadTaskChanging}
                    onClick={onPauseDownload}
                  >
                    {downloadTask?.phase === "pausing" ? uiText("auto.5a4ba5a4128c") : uiText("auto.8d12fc0d4eb2")}
                  </button>
                  <button
                    disabled={downloadTaskChanging}
                    onClick={(event) => onCancelDownload(event.currentTarget)}
                  >
                    {downloadTask?.phase === "canceling"
                      ? uiText("auto.0addd7784578")
                      : uiText("auto.537d17f1c531")}
                  </button>
                </div>
              </div>
              {downloadDetail && downloadDetail.receivedBytes > 0 && (
                <small>
                  {formatBytes(downloadDetail.receivedBytes)}
                  {downloadDetail.totalBytes > 0
                    ? ` / ${formatBytes(downloadDetail.totalBytes)}`
                    : ""}
                  {" · "}
                  {formatBytes(downloadDetail.bytesPerSecond)}/s
                  {uiText("auto.6e52ee9814a2")}
                  {formatDuration(downloadDetail.etaSeconds)}
                </small>
              )}
              {downloadDetail?.availableBytes !== undefined && (
                <small>
                  {uiText("auto.038984d5ab69")}{formatBytes(downloadDetail.requiredBytes || 0)}
                  {" · "}
                  {uiText("auto.4d99c976beb8")}{formatBytes(downloadDetail.availableBytes)}
                  {downloadDetail.installDiskBytes
                    ? uiText("auto.12b8e3fc6fad", { value1: formatBytes(downloadDetail.installDiskBytes) })
                    : ""}
                </small>
              )}
              {downloadDetail?.installSpaceOk === false && (
                <small className="spaceWarning">
                  {uiText("auto.bb16e221d02b")}</small>
              )}
              <div className="downloadProgressTrack">
                <i style={{ width: `${progress ?? 12}%` }} />
              </div>
            </div>
          )}
          {stage === "paused" && (
            <div className="blockedState">
              <span>
                {error
                  ? runtimeMessage(error)
                  : uiText("auto.d5cd56f6c0aa")}
              </span>
              {downloadDetail && downloadDetail.receivedBytes > 0 && (
                <small>
                  {uiText("auto.e309f2263e75")}{formatBytes(downloadDetail.receivedBytes)}
                  {downloadDetail.totalBytes > 0
                    ? ` / ${formatBytes(downloadDetail.totalBytes)}`
                    : ""}
                </small>
              )}
              <div className="missingEnvironmentActions">
                {downloadRecoveryPresentation?.actions.includes("resume") && (
                  <button onClick={onResumeDownload}>
                    {uiText("auto.c3c6d7017082")}
                  </button>
                )}
                {downloadRecoveryPresentation?.actions.includes("relocate") && (
                  <button onClick={(event) => onRelocateDownload(event.currentTarget)}>
                    {uiText("auto.16d7a29d9fbb")}</button>
                )}
                {downloadRecoveryPresentation?.actions.includes("cancel") && (
                  <button onClick={(event) => onCancelDownload(event.currentTarget)}>{uiText("auto.537d17f1c531")}</button>
                )}
              </div>
            </div>
          )}
          {stage === "downloaded" && (
            <div className="verifiedPackage">
              <span className="packagePath" title={installPresentation?.filePath}>
                {installPresentation?.filePath}
              </span>
              {error && (
                <small className="launchError">{runtimeMessage(error)}</small>
              )}
              <button className="accentButton" onClick={onInstallProduct}>
                {installPresentation?.buttonLabel}
              </button>
            </div>
          )}
          {installPresentation &&
            [
              "detecting",
              "deploying",
              "launching-installer",
              "awaiting-verification"
            ].includes(stage) && (
            <div className="installingState">
              <button
                className="accentButton"
                data-aihub-action="product-busy"
                disabled={installPresentation.disabled}
              >
                {installPresentation.buttonLabel}
              </button>
            </div>
          )}
          {stage === "awaiting-uninstall" && (
            <div className="verificationState">
              <span>
                {desktopOperationTask?.launchState === "confirmed"
                  ? uninstallCopy.activeTitle
                  : uninstallCopy.preparingTitle}
              </span>
              {error && <small>{runtimeMessage(error)}</small>}
              <button onClick={onRecheckDesktopUninstall}>{uiText("auto.14ca09ce1fd2")}</button>
            </div>
          )}
          {stage === "detection-error" && (
            <div className="verificationState">
              <span>
                {cliDeployable
                  ? uiText("auto.215fc25c9b31")
                  : uiText("auto.d1f06ca3ba4f")}
              </span>
              {error && <small>{runtimeMessage(error)}</small>}
              <button onClick={onInstallProduct}>{uiText("auto.2ee26e222f2c")}</button>
            </div>
          )}
          {stage === "error" && (
            <div className="blockedState">
              <span>
                {downloadRecoveryPresentation?.messageKey
                  ? uiText(downloadRecoveryPresentation.messageKey)
                  : runtimeMessage(error, undefined, "runtime.downloadInternalError")}
              </span>
              <div className="missingEnvironmentActions">
                {downloadRecoveryPresentation ? (
                  <>
                    {downloadRecoveryPresentation.actions.includes("resume") && (
                      <button onClick={onResumeDownload}>
                        {uiText("auto.c3c6d7017082")}
                      </button>
                    )}
                    {downloadRecoveryPresentation.actions.includes("retry") && (
                      <button onClick={onRetryDownload}>
                        {uiText("download.retry")}
                      </button>
                    )}
                  </>
                ) : (
                  <button onClick={onInstallProduct}>
                    {uiText("auto.453ad482ccef")}
                  </button>
                )}
              </div>
            </div>
          )}
          {stage === "installed" && (
            <div className="installedActions">
              <b className="successState">
                {uiText("auto.a8b6c39dcabf")}{desktopStatus?.version
                  ? ` · v${desktopStatus.version}`
                  : version
                    ? ` · v${version}`
                    : ""}
              </b>
              {desktopStatus && (
                <>
                  {behavior.canOpenInstalled && <button
                    disabled={!desktopStatus.canOpen}
                    onClick={onOpenDesktop}
                  >
                    {uiText("auto.e3b060997e4e")}</button>}
                  {behavior.canOpenInstalled && <button
                    disabled={!desktopStatus.location}
                    onClick={onOpenDesktopLocation}
                  >
                    {uiText("auto.58add6c08002")}</button>}
                  {behavior.canUninstall && desktopStatus.canUninstall && (
                    <button onClick={onUninstallDesktop}>{uiText("auto.06bc14b60f35")}</button>
                  )}
                  {behavior.canUninstall && !desktopStatus.canUninstall && (
                    <button onClick={onOpenWindowsUninstall}>
                      {uiText("desktop.openUninstallSettings")}
                    </button>
                  )}
                  {behavior.canInstall && (
                    <button
                      data-aihub-action="refresh-product"
                      onClick={onGetLatestDesktop}
                    >
                      {uiText("desktop.getLatestInstaller")}
                    </button>
                  )}
                </>
              )}
              {desktopStatus && desktopUpdateOwnerLabel(updateOwner) && (
                <small className="installedNote">
                  {desktopUpdateOwnerLabel(updateOwner)}
                </small>
              )}
              {behavior.canOpenInstalled &&
                cliDeployable &&
                cliStatus?.installed && (
                  <button onClick={onOpenCli}>
                    {uiText("product.openCli")}
                  </button>
                )}
              {cliDeployable && cliStatus?.canUpdate && (
                <button onClick={() => onReconcileCli("update")}>
                  {uiText("cli.update")}
                </button>
              )}
              {cliDeployable && cliStatus?.canRepair && !cliStatus.canUpdate && (
                <button onClick={() => onReconcileCli("repair")}>
                  {uiText("cli.repair")}
                </button>
              )}
              {behavior.canUninstall &&
                cliDeployable &&
                cliStatus?.canUninstall && (
                <button onClick={onUninstallCli}>{uiText("auto.06bc14b60f35")}</button>
              )}
              {cliDeployable && cliStatus?.installed && !cliStatus.managed && (
                <small className="installedNote">
                  {cliStatus.ownership === "mismatch"
                    ? uiText("auto.f2d8cf04d81a")
                    : uiText("auto.f6f82f2d112e")}
                </small>
              )}
              {error && (
                <small className="installedError">{runtimeMessage(error)}</small>
              )}
            </div>
          )}
          </>}
        </div>
      ) : null}
      </div>
    </article>
  );
}

function AuthModal({
  identity,
  onClose,
  onIdentity
}: {
  identity: IdentitySnapshot;
  onClose: () => void;
  onIdentity: (identity: IdentitySnapshot) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<RegistrationChallenge | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "info">("info");

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch {
      setMessageTone("error");
      setMessage(uiText("identity.login.failed"));
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!window.aihubPC) {
        setMessageTone("error");
        setMessage(uiText("identity.login.serviceUnavailable"));
        return;
      }
      const result = await window.aihubPC.login({ identifier, password });
      if (!result.ok) {
        setMessageTone("error");
        setMessage(uiText(result.error.messageKey));
        return;
      }
      onIdentity(result.value);
      setPassword("");
      onClose();
    });
  };

  const requestCode = () =>
    run(async () => {
      if (!window.aihubPC) return;
      setChallenge(await window.aihubPC.requestRegistrationCode(email));
      setMessageTone("info");
      setMessage(uiText("auto.c786f87c2144"));
    });

  const submitRegistration = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!window.aihubPC || !challenge) {
        setMessage(uiText("auto.904998a72784"));
        return;
      }
      const next = await window.aihubPC.register({
        email,
        username,
        nickname: nickname || username,
        password,
        challengeId: challenge.challengeId,
        code
      });
      onIdentity(next);
      setPassword("");
      setCode("");
      onClose();
    });
  };

  return (
    <Modal
      opened
      onClose={onClose}
      centered
      size={520}
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.52, blur: 14 }}
      classNames={{
        content: "authDialogContent",
        body: "authDialogBody"
      }}
      data-aihub-auth-modal
    >
      <section className="authModal">
        <header>
          <div>
            <p>{uiText("auto.53ef710af69d")}</p>
            <h2>
              {mode === "login" ? uiText("auto.1e2df9c3075a") : uiText("auto.c4fb62202bad")}
            </h2>
          </div>
          <ActionIcon
            variant="subtle"
            onClick={onClose}
            aria-label={uiText("action.close")}
          >
            <IconX size={18} stroke={1.8} />
          </ActionIcon>
        </header>

        {mode === "login" && (
          <form className="authForm" onSubmit={submitLogin}>
            <TextInput
              label={uiText("auto.1ef7b40a9c43")}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              required
            />
            <PasswordInput
              label={uiText("auto.a621ab606db2")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button className="accentButton" disabled={busy}>
              {busy ? uiText("auto.3f06ed8f8c38") : uiText("auto.1e2df9c3075a")}
            </button>
            <button type="button" onClick={() => setMode("register")}>
              {uiText("auto.4cebd79c6738")}</button>
          </form>
        )}

        {mode === "register" && (
          <form className="authForm" onSubmit={submitRegistration}>
            <TextInput
              type="email"
              label={uiText("auto.73075237fd0f")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <div className="verificationRow">
              <TextInput
                className="verificationField"
                label={uiText("auto.3acdd163e67a")}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                maxLength={6}
                required
              />
              <button type="button" disabled={busy} onClick={requestCode}>
                {uiText("auto.3b91d186d44e")}</button>
            </div>
            {challenge?.localMailViewerUrl && (
              <button
                type="button"
                onClick={() => window.open(challenge.localMailViewerUrl)}
              >
                {uiText("auto.6d27eba56d2c")}</button>
            )}
            <TextInput
              label={uiText("auto.1a3f0617d6de")}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
            <TextInput
              label={uiText("auto.19bf5d20cb51")}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder={uiText("auto.f79fd585f90f")}
            />
            <PasswordInput
              label={uiText("auto.a621ab606db2")}
              description={uiText("auto.8ada8911bed2")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={10}
              required
            />
            <button className="accentButton" disabled={busy}>
              {busy ? uiText("auto.0debc065262a") : uiText("auto.8aa3eb250835")}
            </button>
            <button type="button" onClick={() => setMode("login")}>
              {uiText("auto.747b0f9082e6")}</button>
          </form>
        )}

        {message && (
          <p
            className={`authMessage authMessage-${messageTone}`}
            role={messageTone === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        )}
      </section>
    </Modal>
  );
}

type PersonalCenterTab =
  | "profile"
  | "security"
  | "workflows"
  | "notifications"
  | "siteMessages"
  | "following"
  | "followers"
  | "directMessages"
  | "readingHistory"
  | "favorites"
  | "likes";

type WorkflowNoticeTone = "success" | "error" | "info";
type WorkflowBusyAction = "refresh" | "save" | "submit" | "withdraw" | "attach" | "detach" | "report";
type WorkflowForm = {
  sourceCommunityPostId: string;
  licenseId: string;
  title: string;
  summary: string;
  instructions: string;
};

const EMPTY_WORKFLOW_FORM: WorkflowForm = {
  sourceCommunityPostId: "",
  licenseId: "",
  title: "",
  summary: "",
  instructions: ""
};

function workflowFormFromOwner(value: OwnerWorkflow): WorkflowForm {
  return {
    sourceCommunityPostId: value.sourceCommunityPostId,
    licenseId: value.provenance.licenseId,
    title: value.content.title,
    summary: value.content.summary,
    instructions: value.content.instructions.join("\n")
  };
}

function workflowContentFromForm(value: WorkflowForm): OwnerWorkflowContent | null {
  const title = value.title.trim();
  const summary = value.summary.trim();
  if (!title || !summary) return null;
  return {
    title,
    summary,
    inputs: [],
    outputs: [],
    instructions: value.instructions.split("\n").map((item) => item.trim()).filter(Boolean),
    dependencies: [],
    secretPlaceholders: []
  };
}

function WorkflowReferenceCard({ reference }: { reference: { workflowId: string; version: number } }) {
  const [workflow, setWorkflow] = useState<PublicWorkflow | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    if (!window.aihubPC) return;
    void window.aihubPC.resolvePublicWorkflow(reference).then((result) => {
      if (!active) return;
      if (result.ok) setWorkflow(result.value);
      else setUnavailable(true);
    });
    return () => { active = false; };
  }, [reference.workflowId, reference.version]);

  if (unavailable) {
    return <p className="workflowPublicUnavailable" role="status">{uiText("workflow.public.unavailable")}</p>;
  }
  return <section className="workflowReferenceCard" data-aihub-workflow-reference="exact">
    <b>{uiText("workflow.public.referenceTitle")}</b>
    <small>{workflow ? `${workflow.content.title} · v${workflow.version}` : uiText("workflow.public.loading")}</small>
  </section>;
}

function WorkflowPublicStorePage({
  language,
  page,
  onLoadMore,
  agentBridgeCapability,
  vendors
}: {
  language: Language;
  page: PublicWorkflowPage;
  onLoadMore: () => Promise<void>;
  agentBridgeCapability: LocalAgentBridgeCapability | null;
  vendors: Vendor[];
}) {
  const [selected, setSelected] = useState<PublicWorkflow | null>(null);
  const [detail, setDetail] = useState<PublicWorkflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const open = async (workflow: PublicWorkflow) => {
    if (!window.aihubPC || loading) return;
    setSelected(workflow); setLoading(true); setUnavailable(false);
    try {
      const result = await window.aihubPC.getPublicWorkflow({
        workflowId: workflow.workflowId,
        version: workflow.version
      });
      if (result.ok) {
        setDetail(result.value);
      } else {
        setDetail(null);
        setUnavailable(true);
      }
    } finally { setLoading(false); }
  };
  const active = detail || selected;

  return <section className="workflowPublicStore" data-aihub-workflow-public="enabled">
    <BackButton onBack={() => { setSelected(null); setDetail(null); setUnavailable(false); }} />
    <header className="workflowPublicHeader"><div><h1>{uiText("workflow.public.title")}</h1><p>{uiText("workflow.public.description")}</p></div></header>
    {!selected && <div className="workflowPublicLayout">
      <div className="workflowPublicList" aria-label={uiText("workflow.public.title")}>
        {page.items.map((workflow) => <article key={`${workflow.workflowId}:${workflow.version}`}>
          <div><b>{workflow.content.title}</b><small>{workflow.content.summary}</small><span>{uiText(`workflow.public.risk.${workflow.riskLevel}` as LanguageKey)}</span></div>
          <button type="button" onClick={() => void open(workflow)}>{uiText("workflow.public.viewDetails")}</button>
        </article>)}
        {page.next && <button type="button" disabled={loading} onClick={() => void onLoadMore()}>{uiText("workflow.public.loadMore")}</button>}
      </div>
    </div>}
    {selected && <section className="workflowPublicDetail">
      <nav className="workflowPublicBreadcrumb" aria-label={uiText("workflow.public.breadcrumb")}>
        <button type="button" onClick={() => { setSelected(null); setDetail(null); setUnavailable(false); }}>{uiText("workflow.public.back")}</button>
      </nav>
      {unavailable || !active ? <p className="workflowPublicUnavailable" role="status">{uiText("workflow.public.unavailable")}</p> : <>
        <h2>{active.content.title}</h2><p>{active.content.summary}</p>
        <div className="workflowPublicBadges"><span>{uiText("workflow.public.review")}: {uiText(`workflow.public.review.${active.reviewStatus}` as LanguageKey)}</span><span>{uiText("workflow.public.risk")}: {uiText(`workflow.public.risk.${active.riskLevel}` as LanguageKey)}</span></div>
        {active.riskLevel === "guarded" && <p className="workflowPublicGuarded" role="status">{uiText("workflow.public.risk.guarded")}</p>}
        <dl className="workflowPublicFacts"><div><dt>{uiText("workflow.public.author")}</dt><dd>{active.author.displayName}</dd></div><div><dt>{uiText("workflow.public.originalAuthor")}</dt><dd>{active.originalAuthorDisplayName || uiText("workflow.public.originalAuthorVerified")}</dd></div><div><dt>{uiText("workflow.public.source")}</dt><dd>{active.provenance.canonicalSource.kind}: {active.provenance.canonicalSource.canonicalId}</dd></div><div><dt>{uiText("workflow.public.license")}</dt><dd>{active.provenance.licenseId}</dd></div><div><dt>{uiText("workflow.public.version")}</dt><dd>v{active.version}</dd></div><div><dt>{uiText("workflow.public.releasedAt")}</dt><dd>{new Date(active.releasedAt).toLocaleString()}</dd></div></dl>
        <WorkflowReferenceCard reference={{ workflowId: active.workflowId, version: active.version }} />
        {agentBridgeCapability?.enabled && (
          <WorkflowComposerPanel workflow={active} vendors={vendors} language={language} />
        )}
        <details className="workflowPublicDetails"><summary>{uiText("workflow.public.details")}</summary><section><h3>{uiText("workflow.public.inputs")}</h3><p>{active.content.inputs.length ? active.content.inputs.map((item) => `${item.name}: ${item.type}`).join(" · ") : "—"}</p></section><section><h3>{uiText("workflow.public.outputs")}</h3><p>{active.content.outputs.length ? active.content.outputs.map((item) => `${item.name}: ${item.type}`).join(" · ") : "—"}</p></section><section><h3>{uiText("workflow.public.instructions")}</h3><ol>{active.content.instructions.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}</ol></section><section><h3>{uiText("workflow.public.dependencies")}</h3>{active.content.dependencies.length ? <ul>{active.content.dependencies.map((item) => <li key={`${item.kind}:${item.canonicalId}`}>{item.kind}: {item.canonicalId}{item.kind === "resource" ? ` · ${item.hostProductId}` : ""}</li>)}</ul> : <p>{uiText("workflow.public.noDependencies")}</p>}</section></details>
        <p className="workflowPublicPopularity">{uiText("workflow.public.popularityUnavailable")}</p>
      </>}
    </section>}
  </section>;
}

function workflowAgentCandidates(vendors: Vendor[]) {
  return vendors
    .filter((vendor) => vendor.enabled !== false)
    .flatMap((vendor) => vendor.products)
    .filter((product) =>
      product.enabled !== false &&
      (product.agentTag === true || product.agentChannel === MATURE_AGENT_CHANNEL)
    );
}

function WorkflowComposerPanel({
  workflow,
  vendors,
  language
}: {
  workflow: PublicWorkflow;
  vendors: Vendor[];
  language: Language;
}) {
  const agentCandidates = useMemo(() => workflowAgentCandidates(vendors), [vendors]);
  const [agentProductId, setAgentProductId] = useState("");
  const selectedAgent = agentCandidates.find((product) => product.id === agentProductId) ||
    agentCandidates[0] || null;
  const resourceSteps = workflow.content.dependencies.filter(
    (item): item is Extract<OwnerWorkflowDependency, { kind: "resource" }> =>
      item.kind === "resource"
  );

  useEffect(() => {
    if (!agentProductId && agentCandidates[0]) {
      setAgentProductId(agentCandidates[0].id);
    }
  }, [agentCandidates, agentProductId]);

  return (
    <section className="workflowComposer" data-aihub-workflow-composer="disabled" aria-labelledby="workflow-composer-title">
      <div>
        <h3 id="workflow-composer-title">{uiText("workflow.composer.title")}</h3>
        <p>{uiText("workflow.composer.summary")}</p>
      </div>
      <label>
        {uiText("workflow.composer.agent")}
        <select
          value={selectedAgent?.id || ""}
          disabled={!agentCandidates.length}
          onChange={(event) => setAgentProductId(event.target.value)}
        >
          {agentCandidates.length ? agentCandidates.map((product) => (
            <option key={product.id} value={product.id}>{catalogDisplayField(product, "name", language)}</option>
          )) : (
            <option value="">{uiText("workflow.composer.noAgents")}</option>
          )}
        </select>
      </label>
      <div className="workflowComposerNotice" role="status">
        <p>{uiText("workflow.composer.compositionUnavailable")}</p>
        <p>{uiText("workflow.composer.sessionMissing")}</p>
      </div>
      <section className="workflowComposerSteps" aria-label={uiText("workflow.composer.steps")}>
        <h4>{uiText("workflow.composer.steps")}</h4>
        {resourceSteps.length ? (
          <ol>
            {resourceSteps.map((step, index) => (
              <li key={`${step.canonicalId}:${step.hostProductId}:${index}`}>
                <b>{index + 1}. {step.bindingKind}</b>
                <span>{step.canonicalId}</span>
                <small>{step.hostProductId} · {uiText(index === 0 ? "workflow.composer.workflowInput" : "workflow.composer.previousOutput")}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p>{uiText("workflow.composer.noSteps")}</p>
        )}
      </section>
      <div className="submissionActions">
        <button type="button" disabled data-aihub-action="workflow-plan-agent">
          {uiText("workflow.composer.plan")}
        </button>
        <button type="button" disabled data-aihub-action="workflow-request-agent-confirmation">
          {uiText("workflow.composer.requestConfirmation")}
        </button>
      </div>
      <p className="workflowPublicPopularity">{uiText("workflow.composer.pendingConfirmation")}</p>
    </section>
  );
}

function MyWorkflowsPage({ capability }: { capability: WorkflowStoreCapability }) {
  const [items, setItems] = useState<OwnerWorkflow[]>([]);
  const [selected, setSelected] = useState<OwnerWorkflow | null>(null);
  const [form, setForm] = useState<WorkflowForm>(EMPTY_WORKFLOW_FORM);
  const [notice, setNotice] = useState<{ tone: WorkflowNoticeTone; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState<WorkflowBusyAction | null>(null);
  const [postId, setPostId] = useState("");
  const [reportReason, setReportReason] = useState("");
  const createIdempotencyKey = useRef<string | null>(null);
  const busy = busyAction !== null;

  const apply = (next: OwnerWorkflow) => {
    setItems((current) => [next, ...current.filter((item) => item.workflowId !== next.workflowId)]);
    setSelected(next);
    setForm(workflowFormFromOwner(next));
  };

  const refresh = async () => {
    if (!window.aihubPC || busy) return;
    setBusyAction("refresh");
    try {
      const result = await window.aihubPC.listOwnWorkflowDrafts({ limit: 20 });
      if (!result.ok) {
        setNotice({ tone: "error", message: uiText(result.error.messageKey) });
        return;
      }
      setItems(result.value.items);
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const update = <K extends keyof WorkflowForm>(key: K, value: WorkflowForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const can = (action: string) => Boolean(selected?.allowedActions.includes(action));
  const start = (action: WorkflowBusyAction) => { setBusyAction(action); setNotice(null); };
  const stop = () => setBusyAction(null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const content = workflowContentFromForm(form);
    if (busy || !window.aihubPC || !content || (!selected && (!form.sourceCommunityPostId.trim() || !form.licenseId.trim()))) {
      if (!content || (!selected && (!form.sourceCommunityPostId.trim() || !form.licenseId.trim()))) {
        setNotice({ tone: "error", message: uiText("workflow.store.invalid") });
      }
      return;
    }
    if (selected && !can("update")) return;
    start("save");
    try {
      const result = selected
        ? await window.aihubPC.updateWorkflowDraft({
            idempotencyKey: crypto.randomUUID(),
            workflowId: selected.workflowId,
            expectedRevision: selected.expectedRevision,
            content
          })
        : await window.aihubPC.createWorkflowDraft({
            idempotencyKey: (createIdempotencyKey.current ||= crypto.randomUUID()),
            draft: {
              sourceCommunityPostId: form.sourceCommunityPostId.trim(),
              provenance: { licenseId: form.licenseId.trim(), derivedFrom: [], discoveredVia: [] },
              content
            }
          });
      if (!result.ok) {
        setNotice({ tone: "error", message: uiText(result.error.messageKey) });
        return;
      }
      apply(result.value);
      createIdempotencyKey.current = null;
      setNotice({ tone: "success", message: uiText("workflow.store.saved") });
    } finally { stop(); }
  };

  const mutate = async (
    action: Exclude<WorkflowBusyAction, "refresh" | "save" | "report">
  ) => {
    if (!selected || !can(action === "submit" ? "submit" : action === "withdraw" ? "withdraw" : `${action}-post`) || busy || !window.aihubPC) return;
    if ((action === "attach" || action === "detach") && (!postId.trim() || !selected.latestReleaseVersion)) {
      setNotice({ tone: "error", message: uiText("workflow.store.invalid") });
      return;
    }
    start(action);
    try {
      const base = { idempotencyKey: crypto.randomUUID(), workflowId: selected.workflowId, expectedRevision: selected.expectedRevision };
      const result = action === "submit"
        ? await window.aihubPC.submitWorkflowDraft(base)
        : action === "withdraw"
          ? await window.aihubPC.withdrawWorkflowDraft(base)
          : action === "attach"
            ? await window.aihubPC.attachWorkflowPost({ ...base, version: selected.latestReleaseVersion!, communityPostId: postId.trim() })
            : await window.aihubPC.detachWorkflowPost({ ...base, version: selected.latestReleaseVersion!, communityPostId: postId.trim() });
      if (!result.ok) {
        setNotice({ tone: "error", message: uiText(result.error.messageKey) });
        return;
      }
      apply("draft" in result.value ? result.value.draft : result.value);
      setNotice({ tone: "success", message: uiText(`workflow.store.${action}Done` as LanguageKey) });
    } finally { stop(); }
  };

  const report = async () => {
    if (!selected || !can("report") || busy || !window.aihubPC || !selected.latestReleaseVersion || reportReason.trim().length < 2) return;
    start("report");
    try {
      const result = await window.aihubPC.reportWorkflowRelease({
        idempotencyKey: crypto.randomUUID(), workflowId: selected.workflowId,
        version: selected.latestReleaseVersion, reason: reportReason.trim()
      });
      setNotice(result.ok
        ? { tone: "success", message: uiText("workflow.store.reportDone") }
        : { tone: "error", message: uiText(result.error.messageKey) });
    } finally { stop(); }
  };

  return <section className="workflowOwnerPage" data-aihub-workflow-capability={capability.enabled ? "enabled" : "disabled"}>
    <header><div><h2>{uiText("workflow.store.myTitle")}</h2><small>{uiText("workflow.store.candidateBoundary")}</small></div><button type="button" onClick={() => void refresh()} disabled={busy}>{busyAction === "refresh" ? uiText("workflow.store.refreshing") : uiText("workflow.store.refresh")}</button></header>
    <div className="workflowOwnerLayout">
      <aside className="workflowOwnerList" aria-label={uiText("workflow.store.myTitle")}>
        <button type="button" disabled={busy} onClick={() => { setSelected(null); setForm(EMPTY_WORKFLOW_FORM); setNotice(null); }}>{uiText("workflow.store.newDraft")}</button>
        {items.length ? items.map((item) => <button type="button" key={item.workflowId} className={selected?.workflowId === item.workflowId ? "selected" : ""} onClick={() => { setSelected(item); setForm(workflowFormFromOwner(item)); setNotice(null); }}><b>{item.content.title}</b><small>{uiText(`workflow.store.status.${item.status}` as LanguageKey)}</small></button>) : <small>{uiText("workflow.store.empty")}</small>}
      </aside>
      <form className="workflowOwnerForm" onSubmit={save}>
        <label>{uiText("workflow.store.field.title")}<input required value={form.title} disabled={busy} onChange={(event) => update("title", event.target.value)} /></label>
        <label>{uiText("workflow.store.field.summary")}<textarea required value={form.summary} disabled={busy} onChange={(event) => update("summary", event.target.value)} /></label>
        {!selected && <><label>{uiText("workflow.store.field.sourcePost")}<input required inputMode="numeric" value={form.sourceCommunityPostId} disabled={busy} onChange={(event) => update("sourceCommunityPostId", event.target.value)} /></label><label>{uiText("workflow.store.field.license")}<input required value={form.licenseId} disabled={busy} onChange={(event) => update("licenseId", event.target.value)} /></label></>}
        <label>{uiText("workflow.store.field.instructions")}<textarea value={form.instructions} disabled={busy} onChange={(event) => update("instructions", event.target.value)} /></label>
        <details className="workflowSupplemental"><summary>{uiText("workflow.store.dependencies")}</summary><small>{uiText("workflow.store.dependenciesUnavailable")}</small></details>
        <div className="submissionActions">
          <button className="accentButton" type="submit" data-aihub-action="save-workflow" disabled={busy || Boolean(selected && !can("update"))}>{busyAction === "save" ? uiText("workflow.store.saving") : uiText("workflow.store.save")}</button>
          <button type="button" data-aihub-action="submit-workflow" onClick={() => void mutate("submit")} disabled={busy || !can("submit")}>{busyAction === "submit" ? uiText("workflow.store.submitting") : uiText("workflow.store.submit")}</button>
          <button type="button" data-aihub-action="withdraw-workflow" onClick={() => void mutate("withdraw")} disabled={busy || !can("withdraw")}>{busyAction === "withdraw" ? uiText("workflow.store.withdrawing") : uiText("workflow.store.withdraw")}</button>
        </div>
        {(can("attach-post") || can("detach-post")) && <details className="workflowSupplemental"><summary>{uiText("workflow.store.postReferences")}</summary><label>{uiText("workflow.store.field.postId")}<input inputMode="numeric" value={postId} disabled={busy} onChange={(event) => setPostId(event.target.value)} /></label><div className="submissionActions"><button type="button" disabled={busy || !can("attach-post")} onClick={() => void mutate("attach")}>{busyAction === "attach" ? uiText("workflow.store.attaching") : uiText("workflow.store.attach")}</button><button type="button" disabled={busy || !can("detach-post")} onClick={() => void mutate("detach")}>{busyAction === "detach" ? uiText("workflow.store.detaching") : uiText("workflow.store.detach")}</button></div></details>}
        {can("report") && <details className="workflowSupplemental"><summary>{uiText("workflow.store.report")}</summary><label>{uiText("workflow.store.field.reportReason")}<textarea value={reportReason} disabled={busy} onChange={(event) => setReportReason(event.target.value)} /></label><button type="button" disabled={busy || reportReason.trim().length < 2} onClick={() => void report()}>{busyAction === "report" ? uiText("workflow.store.reporting") : uiText("workflow.store.report")}</button></details>}
        {notice && <p className={`submissionNotice submissionNotice-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.message}</p>}
      </form>
    </div>
  </section>;
}

function PersonalCenterPage({
  identity,
  center,
  initialTab,
  onIdentity,
  onCenter,
  onRefresh,
  onLogin,
  onLogout,
  onBack,
  onOpenCommunity
}: {
  identity: IdentitySnapshot;
  center: PersonalCenterSnapshot | null;
  initialTab: PersonalCenterTab;
  onIdentity: (identity: IdentitySnapshot) => void;
  onCenter: (center: PersonalCenterSnapshot | null) => void;
  onRefresh: () => Promise<PersonalCenterSnapshot | null>;
  onLogin: () => void;
  onLogout: () => void;
  onBack: () => void;
  onOpenCommunity: (path: string) => void;
}) {
  const [tab, setTab] = useState<PersonalCenterTab>(initialTab);
  const [nickname, setNickname] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailChallenge, setEmailChallenge] =
    useState<RegistrationChallenge | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [searchedUser, setSearchedUser] =
    useState<PublicIdentityUser | null>(null);
  const [socialUsers, setSocialUsers] = useState<PublicIdentityUser[]>([]);
  const [socialPage, setSocialPage] = useState<{
    hasMore: boolean;
    nextOffset: number | null;
  }>({ hasMore: false, nextOffset: null });
  const [conversations, setConversations] =
    useState<DirectConversation[]>([]);
  const [conversationPage, setConversationPage] = useState<{
    hasMore: boolean;
    nextOffset: number | null;
  }>({ hasMore: false, nextOffset: null });
  const [activePeer, setActivePeer] = useState<PublicIdentityUser | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [directMessagePage, setDirectMessagePage] = useState<{
    hasMore: boolean;
    nextBefore: string | null;
  }>({ hasMore: false, nextBefore: null });
  const [directMessageBody, setDirectMessageBody] = useState("");
  const [readingHistoryVisible, setReadingHistoryVisible] = useState(25);
  const [editingContact, setEditingContact] = useState<
    "phone" | "email" | null
  >(null);
  const [workflowCapability, setWorkflowCapability] =
    useState<WorkflowStoreCapability | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const directMessageListRef = useRef<HTMLDivElement>(null);

  const authenticated =
    identity.status === "authenticated" ? identity : null;
  const sessions = center?.sessions || [];
  const notifications = center?.notifications || [];
  const communityNotifications = notifications.filter(
    (item) => item.source === "community"
  );
  const siteMessages = notifications.filter((item) => item.source === "account");
  const interactions = center?.interactions || [];
  const readingHistory = center?.readingHistory || [];

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!authenticated || !window.aihubPC) {
      setWorkflowCapability(null);
      return;
    }
    let active = true;
    void window.aihubPC.getWorkflowStoreCapability().then((result) => {
      if (active) setWorkflowCapability(result.ok ? result.value : null);
    });
    return () => { active = false; };
  }, [authenticated?.user.id]);

  useEffect(() => {
    if (!authenticated || !window.aihubPC) return;
    let active = true;
    if (tab === "following" || tab === "followers") {
      setSectionLoading(true);
      setSearchedUser(null);
      const request =
        tab === "following"
          ? window.aihubPC.listIdentityFollowing({ limit: 25, offset: 0 })
          : window.aihubPC.listIdentityFollowers({ limit: 25, offset: 0 });
      void request
        .then((page) => {
          if (!active) return;
          setSocialUsers(page.users);
          setSocialPage({
            hasMore: page.hasMore,
            nextOffset: page.nextOffset
          });
        })
        .catch((error) => {
          if (active) {
            setNotice(
              error instanceof Error
                ? error.message
                : uiText("runtime.operationFailed")
            );
          }
        })
        .finally(() => {
          if (active) setSectionLoading(false);
        });
    } else if (tab === "directMessages") {
      setSectionLoading(true);
      void window.aihubPC
        .listDirectConversations({ limit: 25, offset: 0 })
        .then((page) => {
          if (!active) return;
          setConversations(page.conversations);
          setConversationPage({
            hasMore: page.hasMore,
            nextOffset: page.nextOffset
          });
        })
        .catch((error) => {
          if (active) {
            setNotice(
              error instanceof Error
                ? error.message
                : uiText("runtime.operationFailed")
            );
          }
        })
        .finally(() => {
          if (active) setSectionLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [tab, authenticated?.user.id]);

  useEffect(() => {
    if (!authenticated) return;
    setNickname(authenticated.user.profile.nickname);
    setAvatarPreview(authenticated.user.profile.avatarUrl);
    setBio(authenticated.user.profile.bio);
    setPhone("");
    setEmail("");
    setReadingHistoryVisible(25);
  }, [authenticated?.user]);

  const refreshPrivateData = async () => {
    if (!window.aihubPC || !authenticated) return;
    await onRefresh();
  };

  useEffect(() => {
    if (!authenticated) return;
    void refreshPrivateData().catch((error) =>
      setNotice(error instanceof Error ? error.message : uiText("auto.cb4d3f8e48c9"))
    );
  }, [authenticated?.user.id]);

  useEffect(() => {
    if (!authenticated || !window.aihubPC || tab !== "directMessages") return;
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.visibilityState !== "visible") return;
      refreshing = true;
      try {
        const conversationResult = await window.aihubPC!.listDirectConversations({
          limit: Math.max(25, Math.min(100, conversations.length)),
          offset: 0
        });
        if (!active) return;
        setConversations((current) => {
          const merged = new Map(
            current.map((item) => [item.peer.id, item] as const)
          );
          for (const item of conversationResult.conversations) {
            merged.set(item.peer.id, item);
          }
          return [...merged.values()].sort(
            (left, right) =>
              Date.parse(right.lastMessage.createdAt) -
              Date.parse(left.lastMessage.createdAt)
          );
        });
        if (conversations.length <= conversationResult.conversations.length) {
          setConversationPage({
            hasMore: conversationResult.hasMore,
            nextOffset: conversationResult.nextOffset
          });
        }
        if (activePeer) {
          const list = directMessageListRef.current;
          const keepAtBottom =
            !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80;
          const result = await window.aihubPC!.listDirectMessages(activePeer.id, {
            limit: 50
          });
          if (!active) return;
          setDirectMessages((current) => {
            const merged = new Map(
              current.map((message) => [message.id, message] as const)
            );
            for (const message of result.messages) merged.set(message.id, message);
            return [...merged.values()].sort(
              (left, right) =>
                Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
                left.id.localeCompare(right.id)
            );
          });
          if (directMessages.length <= result.messages.length) {
            setDirectMessagePage({
              hasMore: result.hasMore,
              nextBefore: result.nextBefore
            });
          }
          const through = result.messages
            .slice()
            .reverse()
            .find(
              (message) =>
                message.senderUserId === activePeer.id && !message.readAt
            );
          if (through) {
            await window.aihubPC!.markDirectMessagesRead(
              activePeer.id,
              through.id
            );
            setConversations((current) =>
              current.map((conversation) =>
                conversation.peer.id === activePeer.id
                  ? { ...conversation, unreadCount: 0 }
                  : conversation
              )
            );
          }
          if (keepAtBottom) {
            window.requestAnimationFrame(() => {
              const current = directMessageListRef.current;
              if (current) current.scrollTop = current.scrollHeight;
            });
          }
        }
        await onRefresh();
      } catch {
        // Background refresh stays quiet; manual refresh reports failures.
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [
    tab,
    authenticated?.user.id,
    activePeer?.id,
    conversations.length,
    directMessages.length
  ]);

  const run = async (action: () => Promise<void>, success = "") => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      if (success) setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : uiText("auto.7d6b5b294bc1"));
    } finally {
      setBusy(false);
    }
  };

  if (!authenticated) {
    return (
      <section className="emptyPanel accountEmpty">
        <span>◎</span>
        <h1>{uiText("auto.5a2cac68fd2d")}</h1>
        <small>{uiText("auto.a83ac4ce12c4")}</small>
        <button className="accentButton" onClick={onLogin}>
          {uiText("auto.1e2df9c3075a")}</button>
      </section>
    );
  }

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const next = await window.aihubPC!.updateIdentityProfile({
        nickname,
        bio
      });
      onIdentity(next);
      await refreshPrivateData();
    }, uiText("auto.a5bb8284ea69"));
  };

  const submitPhone = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const next = await window.aihubPC!.updateIdentityPhone({
        phone,
        currentPassword: phonePassword
      });
      onIdentity(next);
      setPhonePassword("");
      setPhone("");
      setEditingContact(null);
      await refreshPrivateData();
    }, phone ? uiText("auto.01cf08b12940") : uiText("auto.ef1669f6b1ce"));
  };

  const requestEmailCode = () =>
    run(async () => {
      const challenge = await window.aihubPC!.requestIdentityEmailChange({
        email,
        currentPassword: emailPassword
      });
      setEmailChallenge(challenge);
      setNotice(uiText("auto.49952a32db6c"));
    });

  const submitEmail = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!emailChallenge) {
        throw new Error(uiText("auto.e1dac1d3e5d2"));
      }
      const next = await window.aihubPC!.completeIdentityEmailChange({
        challengeId: emailChallenge.challengeId,
        code: emailCode
      });
      onIdentity(next);
      setEmailPassword("");
      setEmailCode("");
      setEmailChallenge(null);
      setEmail("");
      setEditingContact(null);
      await refreshPrivateData();
    }, uiText("auto.0870a627daa8"));
  };

  const chooseAvatar = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      const dataUrl = await prepareAvatarImage(file);
      setAvatarPreview(dataUrl);
      const next = await window.aihubPC!.updateIdentityAvatar({ dataUrl });
      onIdentity(next);
      setAvatarPreview(
        next.status === "authenticated"
          ? next.user.profile.avatarUrl
          : dataUrl
      );
      await refreshPrivateData();
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }, uiText("auto.a938ed15b3e5"));
  };

  const removeAvatar = () =>
    run(async () => {
      const next = await window.aihubPC!.updateIdentityAvatar({ dataUrl: "" });
      onIdentity(next);
      setAvatarPreview("");
      await refreshPrivateData();
    }, uiText("auto.eca726423f04"));

  const beginContactEdit = (kind: "phone" | "email") => {
    setEditingContact(kind);
    setNotice("");
    setPhone("");
    setPhonePassword("");
    setEmail("");
    setEmailPassword("");
    setEmailCode("");
    setEmailChallenge(null);
  };

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await window.aihubPC!.changeIdentityPassword({
        currentPassword,
        newPassword
      });
      setCurrentPassword("");
      setNewPassword("");
      await refreshPrivateData();
    }, uiText("auto.caf0f408936f"));
  };

  const reloadSocialUsers = async () => {
    if (!window.aihubPC || (tab !== "following" && tab !== "followers")) {
      return;
    }
    const page =
      tab === "following"
        ? await window.aihubPC.listIdentityFollowing({
            limit: Math.max(25, socialUsers.length),
            offset: 0
          })
        : await window.aihubPC.listIdentityFollowers({
            limit: Math.max(25, socialUsers.length),
            offset: 0
          });
    setSocialUsers(page.users);
    setSocialPage({ hasMore: page.hasMore, nextOffset: page.nextOffset });
    if (searchedUser) {
      setSearchedUser(
        await window.aihubPC.getIdentityUserByUsername(searchedUser.username)
      );
    }
    await refreshPrivateData();
  };

  const searchIdentityUser = (event: FormEvent) => {
    event.preventDefault();
    const handle = userSearch.trim();
    if (!/^@[\p{L}\p{N}_-]{2,32}$/u.test(handle)) {
      setNotice(uiText("personal.social.invalidUsername"));
      return;
    }
    void run(async () => {
      setSearchedUser(
        await window.aihubPC!.getIdentityUserByUsername(handle.slice(1))
      );
    });
  };

  const toggleIdentityFollow = (user: PublicIdentityUser) =>
    run(
      async () => {
        if (user.social.isFollowing) {
          await window.aihubPC!.unfollowIdentityUser(user.id);
        } else {
          await window.aihubPC!.followIdentityUser(user.id);
        }
        await reloadSocialUsers();
      },
      user.social.isFollowing
        ? uiText("personal.social.unfollowed")
        : uiText("personal.social.followed")
    );

  const loadMoreSocialUsers = () =>
    run(async () => {
      if (
        !window.aihubPC ||
        socialPage.nextOffset === null ||
        (tab !== "following" && tab !== "followers")
      ) {
        return;
      }
      const page =
        tab === "following"
          ? await window.aihubPC.listIdentityFollowing({
              limit: 25,
              offset: socialPage.nextOffset
            })
          : await window.aihubPC.listIdentityFollowers({
              limit: 25,
              offset: socialPage.nextOffset
            });
      setSocialUsers((current) => {
        const users = new Map(current.map((item) => [item.id, item] as const));
        for (const item of page.users) users.set(item.id, item);
        return [...users.values()];
      });
      setSocialPage({ hasMore: page.hasMore, nextOffset: page.nextOffset });
    });

  const scrollDirectMessagesToBottom = () => {
    window.requestAnimationFrame(() => {
      const list = directMessageListRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    });
  };

  const markLatestDirectMessagesRead = async (
    peer: PublicIdentityUser,
    messages: DirectMessage[]
  ) => {
    const through = messages
      .slice()
      .reverse()
      .find(
        (message) => message.senderUserId === peer.id && !message.readAt
      );
    if (!through) return;
    await window.aihubPC!.markDirectMessagesRead(peer.id, through.id);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.peer.id === peer.id
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )
    );
    await refreshPrivateData();
  };

  const openDirectConversation = (peer: PublicIdentityUser) => {
    setTab("directMessages");
    setActivePeer(peer);
    setDirectMessages([]);
    setDirectMessagePage({ hasMore: false, nextBefore: null });
    void run(async () => {
      const result = await window.aihubPC!.listDirectMessages(peer.id, {
        limit: 50
      });
      setActivePeer(result.peer);
      setDirectMessages(result.messages);
      setDirectMessagePage({
        hasMore: result.hasMore,
        nextBefore: result.nextBefore
      });
      await markLatestDirectMessagesRead(result.peer, result.messages);
      scrollDirectMessagesToBottom();
    });
  };

  const loadOlderDirectMessages = () =>
    run(async () => {
      if (!activePeer || !directMessagePage.nextBefore) return;
      const list = directMessageListRef.current;
      const previousHeight = list?.scrollHeight || 0;
      const previousTop = list?.scrollTop || 0;
      const result = await window.aihubPC!.listDirectMessages(activePeer.id, {
        limit: 50,
        before: directMessagePage.nextBefore
      });
      setDirectMessages((current) => {
        const messages = new Map(
          current.map((message) => [message.id, message] as const)
        );
        for (const message of result.messages) messages.set(message.id, message);
        return [...messages.values()].sort(
          (left, right) =>
            Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
            left.id.localeCompare(right.id)
        );
      });
      setDirectMessagePage({
        hasMore: result.hasMore,
        nextBefore: result.nextBefore
      });
      window.requestAnimationFrame(() => {
        const current = directMessageListRef.current;
        if (current) {
          current.scrollTop = previousTop + current.scrollHeight - previousHeight;
        }
      });
    });

  const loadMoreConversations = () =>
    run(async () => {
      if (conversationPage.nextOffset === null) return;
      const page = await window.aihubPC!.listDirectConversations({
        limit: 25,
        offset: conversationPage.nextOffset
      });
      setConversations((current) => {
        const items = new Map(
          current.map((conversation) => [conversation.peer.id, conversation] as const)
        );
        for (const conversation of page.conversations) {
          items.set(conversation.peer.id, conversation);
        }
        return [...items.values()].sort(
          (left, right) =>
            Date.parse(right.lastMessage.createdAt) -
            Date.parse(left.lastMessage.createdAt)
        );
      });
      setConversationPage({
        hasMore: page.hasMore,
        nextOffset: page.nextOffset
      });
    });

  const refreshDirectMessages = () =>
    run(async () => {
      const page = await window.aihubPC!.listDirectConversations({
        limit: Math.max(25, Math.min(100, conversations.length)),
        offset: 0
      });
      setConversations((current) => {
        const items = new Map(
          current.map((conversation) => [conversation.peer.id, conversation] as const)
        );
        for (const conversation of page.conversations) {
          items.set(conversation.peer.id, conversation);
        }
        return [...items.values()].sort(
          (left, right) =>
            Date.parse(right.lastMessage.createdAt) -
            Date.parse(left.lastMessage.createdAt)
        );
      });
      setConversationPage({
        hasMore: page.hasMore,
        nextOffset: page.nextOffset
      });
      if (activePeer) {
        const list = directMessageListRef.current;
        const keepAtBottom =
          !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        const result = await window.aihubPC!.listDirectMessages(activePeer.id, {
          limit: 50
        });
        setDirectMessages((current) => {
          const messages = new Map(
            current.map((message) => [message.id, message] as const)
          );
          for (const message of result.messages) messages.set(message.id, message);
          return [...messages.values()].sort(
            (left, right) =>
              Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
              left.id.localeCompare(right.id)
          );
        });
        if (directMessages.length <= result.messages.length) {
          setDirectMessagePage({
            hasMore: result.hasMore,
            nextBefore: result.nextBefore
          });
        }
        await markLatestDirectMessagesRead(result.peer, result.messages);
        if (keepAtBottom) scrollDirectMessagesToBottom();
      }
      await refreshPrivateData();
    });

  const submitDirectMessage = (event: FormEvent) => {
    event.preventDefault();
    const body = directMessageBody.trim();
    if (!activePeer || !body) {
      setNotice(uiText("personal.direct.emptyBody"));
      return;
    }
    void run(async () => {
      const message = await window.aihubPC!.sendDirectMessage(activePeer.id, {
        body
      });
      setDirectMessages((current) => [...current, message]);
      setDirectMessageBody("");
      const page = await window.aihubPC!.listDirectConversations({
        limit: Math.max(25, Math.min(100, conversations.length)),
        offset: 0
      });
      setConversations((current) => {
        const items = new Map(
          current.map((conversation) => [conversation.peer.id, conversation] as const)
        );
        for (const conversation of page.conversations) {
          items.set(conversation.peer.id, conversation);
        }
        return [...items.values()].sort(
          (left, right) =>
            Date.parse(right.lastMessage.createdAt) -
            Date.parse(left.lastMessage.createdAt)
        );
      });
      setConversationPage({
        hasMore: page.hasMore,
        nextOffset: page.nextOffset
      });
      scrollDirectMessagesToBottom();
      await refreshPrivateData();
    }, uiText("personal.direct.sent"));
  };

  const markNotificationRead = (item: PersonalCenterNotification) =>
    run(async () => {
      await window.aihubPC!.markPersonalCenterNotificationRead(
        item.source,
        item.id
      );
      if (!center) return;
      const nextNotifications = center.notifications.map((notification) =>
        notification.id === item.id && notification.source === item.source
          ? {
              ...notification,
              read: true,
              readAt: new Date().toISOString()
            }
          : notification
      );
      onCenter({
        ...center,
        notifications: nextNotifications,
        summary: {
          ...center.summary,
          unreadNotifications: nextNotifications.filter(
            (notification) => !notification.read
          ).length
        }
      });
    });

  const renderNotifications = (
    items: PersonalCenterNotification[],
    emptyText: string,
    showCommunityUnavailable = false
  ) => (
    <div className="personalList">
      {items.map((item) => (
        <article
          className={item.read ? "" : "unread"}
          key={`${item.source}:${item.id}`}
        >
          <div>
            <b>{item.title}</b>
            <p>{item.body}</p>
            <small>{new Date(item.createdAt).toLocaleString()}</small>
          </div>
          <div className="rowActions">
            {item.actionPath.startsWith("/d/") && (
              <button onClick={() => onOpenCommunity(item.actionPath)}>
                {uiText("auto.db8db0530432")}
              </button>
            )}
            {!item.read && (
              <button
                disabled={busy}
                onClick={() => void markNotificationRead(item)}
              >
                {uiText("auto.82f35d89b827")}
              </button>
            )}
          </div>
        </article>
      ))}
      {!items.length && <div className="emptyPanel">{emptyText}</div>}
      {showCommunityUnavailable &&
        center?.sources.community === "unavailable" && (
          <div className="emptyPanel">{uiText("auto.33c6d4e50a98")}</div>
        )}
    </div>
  );

  const interactionList =
    tab === "favorites"
      ? interactions.filter((item) => item.favorited)
      : interactions.filter((item) => item.liked);
  const backPersonalPage = () => {
    if (activePeer) {
      setActivePeer(null);
    } else if (tab !== "profile") {
      setTab("profile");
    } else {
      onBack();
    }
  };

  return (
    <section className="personalCenter">
      {(tab !== "profile" || activePeer) && <BackButton onBack={backPersonalPage} />}
      <header className="personalCenterHeader">
        <div className="personalIdentity">
          <span className="accountAvatar">
            {authenticated.user.profile.avatarUrl ? (
              <img src={authenticated.user.profile.avatarUrl} alt="" />
            ) : (
              authenticated.user.profile.nickname.slice(0, 1).toUpperCase()
            )}
          </span>
          <div>
            <p>{uiText("auto.5a2cac68fd2d")}</p>
            <h1>{authenticated.user.profile.nickname}</h1>
            <small>@{authenticated.user.username}</small>
          </div>
        </div>
        <button
          onClick={() =>
            void run(async () => {
              await window.aihubPC?.logout();
              onLogout();
            })
          }
        >
          {uiText("auto.3ab8cc15939f")}</button>
      </header>

      <nav className="personalTabs">
        {(
          [
            ["profile", uiText("personal.tabs.profile")],
            ["security", uiText("personal.tabs.security")],
            ...(workflowCapability?.enabled
              ? [["workflows", uiText("workflow.store.myTitle")] as [PersonalCenterTab, string]]
              : []),
            [
              "notifications",
              `${uiText("personal.tabs.reminders")}${
                communityNotifications.some((item) => !item.read)
                  ? ` · ${communityNotifications.filter((item) => !item.read).length}`
                  : ""
              }`
            ],
            [
              "siteMessages",
              `${uiText("personal.tabs.siteMessages")}${
                siteMessages.some((item) => !item.read)
                  ? ` · ${siteMessages.filter((item) => !item.read).length}`
                  : ""
              }`
            ],
            [
              "following",
              `${uiText("personal.tabs.following")}${center?.social?.following ? ` · ${center.social.following}` : ""}`
            ],
            [
              "followers",
              `${uiText("personal.tabs.followers")}${center?.social?.followers ? ` · ${center.social.followers}` : ""}`
            ],
            [
              "directMessages",
              `${uiText("personal.tabs.directMessages")}${center?.summary.unreadDirectMessages ? ` · ${center.summary.unreadDirectMessages}` : ""}`
            ],
            ["readingHistory", uiText("personal.tabs.readingHistory")],
            ["favorites", `${uiText("personal.tabs.favorites")}${center?.summary.favorites ? ` · ${center.summary.favorites}` : ""}`],
            ["likes", `${uiText("personal.tabs.likes")}${center?.summary.likes ? ` · ${center.summary.likes}` : ""}`]
          ] as Array<[PersonalCenterTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "profile" && (
        <div className="personalGrid">
          <form className="personalCard profileCard" onSubmit={submitProfile}>
            <h2>{uiText("auto.3026d618c5a7")}</h2>
            <div className="avatarEditor">
              <button
                type="button"
                className="avatarPreviewButton"
                aria-label={uiText("auto.42ece898483f")}
                disabled={busy}
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt={uiText("auto.fb06241b7258")} />
                ) : (
                  <span>
                    {authenticated.user.profile.nickname
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                )}
                <b>{uiText("auto.916afcd85322")}</b>
              </button>
              <div>
                <strong>{uiText("auto.3ea2d23c902c")}</strong>
                <small>{uiText("auto.52945905245f")}</small>
                <div className="compactActions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {uiText("auto.9ad12a1ab4f6")}</button>
                  {authenticated.user.profile.avatarUrl && (
                    <button
                      type="button"
                      className="dangerButton"
                      disabled={busy}
                      onClick={() => void removeAvatar()}
                    >
                      {uiText("auto.6135d4159e89")}</button>
                  )}
                </div>
              </div>
              <input
                ref={avatarInputRef}
                className="visuallyHidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => chooseAvatar(event.target.files?.[0])}
              />
            </div>
            <label>
              {uiText("auto.7a1e2b964b67")}<input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                minLength={2}
                maxLength={32}
                required
              />
            </label>
            <label>
              {uiText("auto.dd15354365c7")}<textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={200}
                placeholder={uiText("auto.7e7d393dd1a0")}
              />
            </label>
            <button className="accentButton" disabled={busy}>
              {uiText("auto.c0a70fcb56f0")}</button>
          </form>

          <section className="personalCard contactCard">
            <div>
              <h2>{uiText("auto.323a881ebd47")}</h2>
              <small>{uiText("auto.f80221147dad")}</small>
            </div>

            <div className="contactSetting">
              <div>
                <span>{uiText("auto.6f52cc94db65")}</span>
                <b>{authenticated.user.phone || uiText("auto.e026c6693dc5")}</b>
              </div>
              <button
                type="button"
                onClick={() => beginContactEdit("phone")}
              >
                {authenticated.user.phone ? uiText("auto.916afcd85322") : uiText("auto.7a8a11ead507")}
              </button>
            </div>
            {editingContact === "phone" && (
              <form className="contactEditor" onSubmit={submitPhone}>
                <label>
                  {uiText("auto.28a4a891a117")}<input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    placeholder="+86 13800000000"
                    required
                  />
                </label>
                <label>
                  {uiText("auto.a114cfb687e6")}<input
                    type="password"
                    value={phonePassword}
                    onChange={(event) => setPhonePassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <div className="contactEditorActions">
                  <button
                    type="button"
                    onClick={() => setEditingContact(null)}
                  >
                    {uiText("auto.2cd0f3be8738")}</button>
                  <button className="accentButton" disabled={busy}>
                    {uiText("auto.8d5675026228")}</button>
                </div>
              </form>
            )}

            <div className="contactSetting">
              <div>
                <span>{uiText("auto.a9eaab0fd837")}</span>
                <b>{authenticated.user.email}</b>
              </div>
              <button type="button" onClick={() => beginContactEdit("email")}>
                {uiText("auto.916afcd85322")}</button>
            </div>
            {editingContact === "email" && (
              <form className="contactEditor" onSubmit={submitEmail}>
                <label>
                  {uiText("auto.3067c39fa4b2")}<input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    disabled={Boolean(emailChallenge)}
                  />
                </label>
                <label>
                  {uiText("auto.a114cfb687e6")}<input
                    type="password"
                    value={emailPassword}
                    onChange={(event) => setEmailPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={Boolean(emailChallenge)}
                  />
                </label>
                {!emailChallenge ? (
                  <div className="contactEditorActions">
                    <button
                      type="button"
                      onClick={() => setEditingContact(null)}
                    >
                      {uiText("auto.2cd0f3be8738")}</button>
                    <button
                      type="button"
                      className="accentButton"
                      disabled={busy || !email || !emailPassword}
                      onClick={requestEmailCode}
                    >
                      {uiText("auto.ef9dc55cd6be")}</button>
                  </div>
                ) : (
                  <>
                    <label>
                      {uiText("auto.3acdd163e67a")}<input
                        value={emailCode}
                        onChange={(event) => setEmailCode(event.target.value)}
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                        required
                      />
                    </label>
                    {emailChallenge.localMailViewerUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(emailChallenge.localMailViewerUrl)
                        }
                      >
                        {uiText("auto.6d27eba56d2c")}</button>
                    )}
                    <div className="contactEditorActions">
                      <button
                        type="button"
                        onClick={() => beginContactEdit("email")}
                      >
                        {uiText("auto.3160fc9159f0")}</button>
                      <button className="accentButton" disabled={busy}>
                        {uiText("auto.8d5675026228")}</button>
                    </div>
                  </>
                )}
              </form>
            )}
          </section>
        </div>
      )}

      {tab === "security" && (
        <div className="personalGrid">
          <form className="personalCard" onSubmit={submitPassword}>
            <h2>{uiText("auto.08d008062411")}</h2>
            <label>
              {uiText("auto.a114cfb687e6")}<input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              {uiText("auto.515e9c7cf7b2")}<input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                required
              />
              <small>{uiText("auto.8ada8911bed2")}</small>
            </label>
            <button className="accentButton" disabled={busy}>
              {uiText("auto.08d008062411")}</button>
          </form>

          <section className="personalCard sessionCard">
            <h2>{uiText("auto.cd438f5d0cca")}</h2>
            <div className="sessionList">
              {sessions.map((session) => (
                <article key={session.id}>
                  <div>
                    <b>{session.deviceName}</b>
                    <small>
                      {session.current ? uiText("auto.c68978537cf3") : uiText("auto.829738648ba0")} ·{" "}
                      {new Date(session.lastSeenAt).toLocaleString()}
                    </small>
                  </div>
                  {!session.current && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await window.aihubPC!.revokeIdentitySession(session.id);
                          await refreshPrivateData();
                        }, uiText("auto.e0e8a0631e50"))
                      }
                    >
                      {uiText("auto.f820413fa2db")}</button>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "workflows" && workflowCapability?.enabled && (
        <MyWorkflowsPage capability={workflowCapability} />
      )}

      {tab === "notifications" &&
        renderNotifications(
          communityNotifications,
          uiText("personal.reminders.empty"),
          true
        )}

      {tab === "siteMessages" &&
        renderNotifications(siteMessages, uiText("personal.siteMessages.empty"))}

      {(tab === "following" || tab === "followers") && (
        <div className="socialCenter">
          <form className="personalCard socialSearch" onSubmit={searchIdentityUser}>
            <div>
              <h2>{uiText("personal.social.searchTitle")}</h2>
              <small>{uiText("personal.social.searchHint")}</small>
            </div>
            <div className="socialSearchControls">
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder={uiText("personal.social.searchPlaceholder")}
                autoComplete="off"
                spellCheck={false}
              />
              <button className="accentButton" disabled={busy}>
                {uiText("personal.social.search")}
              </button>
              {searchedUser && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchedUser(null);
                    setUserSearch("");
                  }}
                >
                  {uiText("personal.social.showAll")}
                </button>
              )}
            </div>
          </form>
          <div className="personalList socialUserList">
            {(searchedUser ? [searchedUser] : socialUsers).map((user) => (
              <article key={user.id}>
                <div className="socialUserIdentity">
                  <span className="socialAvatar">
                    {user.profile.avatarUrl ? (
                      <img src={user.profile.avatarUrl} alt="" />
                    ) : (
                      user.profile.nickname.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div>
                    <b>{user.profile.nickname}</b>
                    <small>@{user.username}</small>
                    {user.profile.bio && <p>{user.profile.bio}</p>}
                    <small>
                      {uiText("personal.social.followersCount", {
                        count: user.social.followers
                      })}
                      {" · "}
                      {uiText("personal.social.followingCount", {
                        count: user.social.following
                      })}
                    </small>
                  </div>
                </div>
                {!user.social.isMe && (
                  <div className="rowActions">
                    <button
                      disabled={busy}
                      onClick={() => void toggleIdentityFollow(user)}
                    >
                      {user.social.isFollowing
                        ? uiText("personal.social.unfollow")
                        : uiText("personal.social.follow")}
                    </button>
                    <button
                      className="accentButton"
                      disabled={busy}
                      onClick={() => openDirectConversation(user)}
                    >
                      {uiText("personal.social.message")}
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!sectionLoading &&
              !(searchedUser ? 1 : socialUsers.length) && (
                <div className="emptyPanel">
                  {tab === "following"
                    ? uiText("personal.social.emptyFollowing")
                    : uiText("personal.social.emptyFollowers")}
                </div>
              )}
            {!searchedUser && socialPage.hasMore && (
              <div className="paginationActions">
                <button disabled={busy} onClick={() => void loadMoreSocialUsers()}>
                  {uiText("personal.pagination.more")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "directMessages" && (
        <div className="directMessageLayout">
          <div className="personalList conversationList">
            <div className="listToolbar">
              <b>{uiText("personal.direct.conversations")}</b>
              <button disabled={busy} onClick={() => void refreshDirectMessages()}>
                {uiText("personal.direct.refresh")}
              </button>
            </div>
            {conversations.map((conversation) => (
              <article
                className={conversation.unreadCount ? "unread" : ""}
                key={conversation.peer.id}
              >
                <div>
                  <b>{conversation.peer.profile.nickname}</b>
                  <small>@{conversation.peer.username}</small>
                  <p>{conversation.lastMessage.body}</p>
                  <small>
                    {new Date(conversation.lastMessage.createdAt).toLocaleString()}
                  </small>
                </div>
                <div className="rowActions">
                  {Boolean(conversation.unreadCount) && (
                    <small>
                      {uiText("personal.direct.unread", {
                        count: conversation.unreadCount
                      })}
                    </small>
                  )}
                  <button
                    className="accentButton"
                    disabled={busy}
                    onClick={() => openDirectConversation(conversation.peer)}
                  >
                    {uiText("personal.social.message")}
                  </button>
                </div>
              </article>
            ))}
            {!sectionLoading && !conversations.length && (
              <div className="emptyPanel">{uiText("personal.direct.empty")}</div>
            )}
            {conversationPage.hasMore && (
              <div className="paginationActions">
                <button disabled={busy} onClick={() => void loadMoreConversations()}>
                  {uiText("personal.pagination.more")}
                </button>
              </div>
            )}
          </div>

          {activePeer ? (
            <section className="personalCard directThread">
              <header>
                <div>
                  <h2>{activePeer.profile.nickname}</h2>
                  <small>@{activePeer.username}</small>
                </div>
                <BackButton onBack={() => setActivePeer(null)} />
              </header>
              <div className="directMessageList" ref={directMessageListRef}>
                {directMessagePage.hasMore && (
                  <div className="paginationActions">
                    <button disabled={busy} onClick={() => void loadOlderDirectMessages()}>
                      {uiText("personal.direct.older")}
                    </button>
                  </div>
                )}
                {directMessages.map((message) => {
                  const sentByMe = message.senderUserId === authenticated.user.id;
                  return (
                    <article className={sentByMe ? "sent" : "received"} key={message.id}>
                      <small>
                        {sentByMe
                          ? uiText("personal.direct.you")
                          : activePeer.profile.nickname}
                        {" · "}
                        {new Date(message.createdAt).toLocaleString()}
                      </small>
                      <p>{message.body}</p>
                    </article>
                  );
                })}
                {!directMessages.length && (
                  <div className="emptyPanel">
                    {uiText("personal.direct.noMessages")}
                  </div>
                )}
              </div>
              <form className="directComposer" onSubmit={submitDirectMessage}>
                <label>
                  {uiText("personal.direct.compose", {
                    username: activePeer.username
                  })}
                  <textarea
                    value={directMessageBody}
                    onChange={(event) => setDirectMessageBody(event.target.value)}
                    placeholder={uiText("personal.direct.placeholder")}
                    maxLength={4000}
                    required
                  />
                </label>
                <button className="accentButton" disabled={busy}>
                  {uiText("personal.direct.send")}
                </button>
              </form>
            </section>
          ) : (
            <div className="emptyPanel directMessagePrompt">
              {uiText("personal.direct.select")}
            </div>
          )}
        </div>
      )}

      {tab === "readingHistory" && (
        <div className="personalList">
          {readingHistory.slice(0, readingHistoryVisible).map((item) => (
            <article key={item.discussionId}>
              <div>
                <b>{item.title}</b>
                <small>
                  {uiText("personal.reading.viewedAt", {
                    time: new Date(item.viewedAt).toLocaleString()
                  })}
                </small>
              </div>
              <button onClick={() => onOpenCommunity(item.path)}>
                {uiText("personal.reading.open")}
              </button>
            </article>
          ))}
          {!readingHistory.length && (
            <div className="emptyPanel">{uiText("personal.reading.empty")}</div>
          )}
          {readingHistoryVisible < readingHistory.length && (
            <div className="paginationActions">
              <button
                onClick={() => setReadingHistoryVisible((count) => count + 25)}
              >
                {uiText("personal.pagination.more")}
              </button>
            </div>
          )}
          {center?.readingHistoryCapped &&
            readingHistoryVisible >= readingHistory.length && (
              <div className="historyCapNotice">
                <small>{uiText("personal.reading.capped")}</small>
                <button onClick={() => onOpenCommunity("/")}>
                  {uiText("personal.reading.openCommunity")}
                </button>
              </div>
            )}
        </div>
      )}

      {(tab === "favorites" || tab === "likes") && (
        <div className="personalList">
          {interactionList.map((item) => (
            <article key={item.discussionId}>
              <div>
                <b>{item.title}</b>
                <small>
                  {tab === "favorites" ? uiText("auto.471dd4d7f869") : uiText("auto.6bb2bc5ecde8")} ·{" "}
                  {new Date(item.updatedAt).toLocaleString()}
                </small>
              </div>
              <button onClick={() => onOpenCommunity(item.path)}>
                {uiText("auto.62d212529605")}</button>
            </article>
          ))}
          {!interactionList.length && (
            <div className="emptyPanel">
              {tab === "favorites" ? uiText("auto.8cd0fd647ba7") : uiText("auto.4a4e373f27a5")}
            </div>
          )}
        </div>
      )}

      {notice && <p className="personalNotice">{runtimeMessage(notice)}</p>}
    </section>
  );
}

type EmbeddedCommunityWebview = HTMLElement & {
  getURL(): string;
  canGoBack(): boolean;
  goBack(): void;
  loadURL(url: string): Promise<void>;
  executeJavaScript<T = unknown>(code: string): Promise<T>;
};

const COMMUNITY_THEME_PALETTES = {
  light: {
    "color-scheme": "light",
    "--body-bg": "#F5F7FB",
    "--body-bg-shaded": "#E9EEF8",
    "--body-bg-light": "#ffffff",
    "--body-bg-faded": "rgba(245,247,251,0.93)",
    "--text-color": "#13213A",
    "--heading-color": "#13213A",
    "--muted-color": "#52627A",
    "--muted-color-light": "#71819A",
    "--muted-color-dark": "#13213A",
    "--shadow-color": "rgba(24,40,68,0.1)",
    "--control-bg": "#E9EEF8",
    "--control-bg-light": "#ffffff",
    "--control-bg-shaded": "#D6DEEB",
    "--control-color": "#52627A",
    "--control-body-bg-mix": "#EEF2F8",
    "--header-bg": "#F5F7FB",
    "--header-color": "#13213A",
    "--header-control-bg": "#E9EEF8",
    "--header-control-color": "#52627A",
    "--button-color": "#13213A",
    "--button-bg": "#E9EEF8",
    "--button-bg-hover": "#D6DEEB",
    "--button-bg-active": "#C5D0E1",
    "--button-bg-disabled": "#E9EEF8",
    "--button-primary-color": "#FFFFFF",
    "--button-primary-bg": "#087E8B",
    "--button-primary-bg-hover": "#065C68",
    "--button-primary-bg-active": "#054C56",
    "--button-primary-bg-disabled": "#087E8B",
    "--primary-color": "#087E8B",
    "--secondary-color": "#13213A",
    "--link-color": "#065C68"
  },
  dark: {
    "color-scheme": "dark",
    "--body-bg": "#08111F",
    "--body-bg-shaded": "#0C1930",
    "--body-bg-light": "#101C2E",
    "--body-bg-faded": "rgba(8,17,31,0.93)",
    "--text-color": "#F3F7FF",
    "--heading-color": "#F3F7FF",
    "--muted-color": "#B2C0D8",
    "--muted-color-light": "#CCD7EA",
    "--muted-color-dark": "#F3F7FF",
    "--shadow-color": "rgba(0,0,0,0.28)",
    "--control-bg": "#101C2E",
    "--control-bg-light": "#172641",
    "--control-bg-shaded": "#253550",
    "--control-color": "#B2C0D8",
    "--control-body-bg-mix": "#0D1728",
    "--header-bg": "#08111F",
    "--header-color": "#F3F7FF",
    "--header-control-bg": "#101C2E",
    "--header-control-color": "#B2C0D8",
    "--button-color": "#F3F7FF",
    "--button-bg": "#101C2E",
    "--button-bg-hover": "#172641",
    "--button-bg-active": "#253550",
    "--button-bg-disabled": "#101C2E",
    "--button-primary-color": "#08111F",
    "--button-primary-bg": "#49D6DD",
    "--button-primary-bg-hover": "#8AE8EA",
    "--button-primary-bg-active": "#36BCC4",
    "--button-primary-bg-disabled": "#49D6DD",
    "--primary-color": "#49D6DD",
    "--secondary-color": "#F3F7FF",
    "--link-color": "#8AE8EA"
  }
} as const;

function buildCommunityThemeScript(theme: "light" | "dark") {
  const declarations = Object.entries(COMMUNITY_THEME_PALETTES[theme])
    .map(([property, value]) => `${property}:${value}`)
    .join(";");
  const heroBackground = theme === "light" ? "#E9EEF8" : "#0C1930";
  const heroColor = theme === "light" ? "#13213A" : "#F3F7FF";
  const themeSelector = `html[data-aihub-theme="${theme}"]`;
  const css = [
    `${themeSelector}{${declarations}}`,
    `${themeSelector} .DiscussionHero{--hero-bg:${heroBackground};background:${heroBackground}!important;color:${heroColor}!important}`,
    `${themeSelector} .DiscussionHero a{color:${heroColor}!important}`,
    `${themeSelector} .Post-body{color:var(--text-color)!important}`,
    `${themeSelector} .ReplyPlaceholder,${themeSelector} .ReplyPlaceholder *{color:var(--muted-color-light)!important}`,
    `${themeSelector} .Avatar{background:var(--control-bg)!important;outline:1px solid var(--control-bg-shaded)!important;outline-offset:1px}`
  ].join("");
  return `
    (() => {
      document.documentElement.setAttribute("data-theme", ${JSON.stringify(theme)});
      document.documentElement.setAttribute("data-aihub-theme", ${JSON.stringify(theme)});
      let style = document.getElementById("aihub-community-theme-style");
      if (!style) {
        style = document.createElement("style");
        style.id = "aihub-community-theme-style";
        document.head.appendChild(style);
      }
      style.textContent = ${JSON.stringify(css)};
      return {
        theme: document.documentElement.getAttribute("data-aihub-theme"),
        bodyBackground: getComputedStyle(document.documentElement)
          .getPropertyValue("--body-bg")
          .trim(),
        primaryColor: getComputedStyle(document.documentElement)
          .getPropertyValue("--primary-color")
          .trim()
      };
    })()
  `;
}

function buildCommunityLanguageScript(language: Language) {
  const module = createLanguage(language);
  return `
    (() => {
      const targetLocale = ${JSON.stringify(module.communityLocale)};
      document.documentElement.lang = ${JSON.stringify(module.documentLocale)};
      try {
        const flarumApp = typeof app !== "undefined" ? app : globalThis.app;
        const user = flarumApp?.session?.user;
        const preferences = user?.preferences?.() || {};
        const syncKey = "aihub-community-locale-sync";
        if (
          user?.savePreferences &&
          preferences.locale !== targetLocale &&
          sessionStorage.getItem(syncKey) !== targetLocale
        ) {
          sessionStorage.setItem(syncKey, targetLocale);
          void user.savePreferences({ locale: targetLocale }).then(() => {
            window.location.reload();
          }).catch(() => sessionStorage.removeItem(syncKey));
        } else if (preferences.locale === targetLocale) {
          sessionStorage.removeItem(syncKey);
        }
      } catch {
        // Flarum may still be booting. A later lifecycle event retries sync.
      }
      return targetLocale;
    })()
  `;
}

function buildCommunityChromeControlsScript(language: Language) {
  const module = createLanguage(language);
  const refreshLabel = module.text("community.refresh");
  const discussionHintLabel = module.text("community.discussionListHint");
  const discussionHintTitle = module.text(
    "community.discussionListHintTitle"
  );
  return String.raw`
(() => {
  const itemId = "aihub-community-refresh-item";
  const buttonId = "aihub-community-refresh";
  const styleId = "aihub-community-refresh-style";
  const discussionHintId = "aihub-discussion-list-hint";

  const install = () => {
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = [
        ".Header-title,#header-primary,#app-navigation,#header-navigation,.App-backControl{display:none!important}",
        "#header-secondary{margin-left:auto!important}",
        "#header-secondary>ul>li:not(.item-search):not(#" + itemId + "){display:none!important}",
        "#" + itemId + "{display:flex;align-items:center;margin-left:6px}",
        "#" + buttonId + "{display:grid;place-items:center;width:36px;min-width:36px;height:36px;padding:0;border:0;border-radius:8px;color:var(--header-control-color);background:var(--header-control-bg);cursor:pointer}",
        "#" + buttonId + ":hover{color:var(--header-color);background:var(--control-bg-shaded)}",
        "#" + buttonId + ":active{transform:translateY(2px) scale(.96);filter:brightness(.92)}",
        "#" + buttonId + ":focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}",
        "#" + buttonId + " .aihub-refresh-glyph{font-size:20px;line-height:1;transform:translateY(-1px)}",
        "#" + discussionHintId + "{display:none}",
        "@media (min-width:768px){.App.App--discussion>#" + discussionHintId + "{box-sizing:border-box;display:flex;position:fixed;left:0;top:50%;z-index:999;width:32px;padding:12px 7px;align-items:center;gap:5px;writing-mode:vertical-rl;font-size:13px;font-weight:700;line-height:1.15;letter-spacing:1px;color:var(--button-primary-color);background:var(--button-primary-bg);border-radius:0 10px 10px 0;box-shadow:0 4px 14px var(--shadow-color);pointer-events:none;opacity:.92;transform:translateY(-50%);transition:opacity .16s ease}.App.paneShowing>#" + discussionHintId + ",.App.panePinned>#" + discussionHintId + "{opacity:0}}",
        "#" + discussionHintId + " .aihub-discussion-list-glyph{font-size:18px;line-height:1;writing-mode:horizontal-tb}",
        "@media (prefers-reduced-motion:reduce){#" + discussionHintId + "{transition:none!important}}"
      ].join("");
      document.head.appendChild(style);
    }

    const appRoot = document.getElementById("app");
    let discussionHint = document.getElementById(discussionHintId);
    if (!discussionHint && appRoot) {
      discussionHint = document.createElement("div");
      discussionHint.id = discussionHintId;
      discussionHint.setAttribute("role", "note");
      appRoot.appendChild(discussionHint);
    }
    if (discussionHint) {
      discussionHint.title = ${JSON.stringify(discussionHintTitle)};
      discussionHint.setAttribute(
        "aria-label",
        ${JSON.stringify(discussionHintTitle)}
      );
      let discussionHintText = discussionHint.querySelector(
        ".aihub-discussion-list-label"
      );
      if (!discussionHintText) {
        discussionHintText = document.createElement("span");
        discussionHintText.className = "aihub-discussion-list-label";
        discussionHint.appendChild(discussionHintText);
      }
      if (
        discussionHintText.textContent !==
        ${JSON.stringify(discussionHintLabel)}
      ) {
        discussionHintText.textContent = ${JSON.stringify(discussionHintLabel)};
      }
      if (!discussionHint.querySelector(".aihub-discussion-list-glyph")) {
        const glyph = document.createElement("span");
        glyph.className = "aihub-discussion-list-glyph";
        glyph.setAttribute("aria-hidden", "true");
        glyph.textContent = "›";
        discussionHint.appendChild(glyph);
      }
    }

    let button = document.getElementById(buttonId);
    if (!button) {
      const search = document.querySelector(
        "#header-secondary .Search, .Header-secondary .Search, .Search"
      );
      if (search?.parentElement) {
        const anchor = search.closest("li") || search;
        const wrapper = document.createElement(
          anchor.parentElement?.tagName === "UL" ? "li" : "span"
        );
        wrapper.id = itemId;
        wrapper.className = "item-aihub-community-refresh";

        button = document.createElement("button");
        button.id = buttonId;
        button.className = "Button Button--icon Button--flat";
        button.type = "button";
        button.innerHTML =
          '<span class="aihub-refresh-glyph" aria-hidden="true">&#8635;</span>';
        button.addEventListener("click", () => window.location.reload());
        wrapper.appendChild(button);
        anchor.insertAdjacentElement("afterend", wrapper);
      }
    }
    if (button) {
      button.title = ${JSON.stringify(refreshLabel)};
      button.setAttribute("aria-label", ${JSON.stringify(refreshLabel)});
    }
    return Boolean(button && discussionHint);
  };

  install();
  if (!window.__aihubCommunityRefreshObserver) {
    const root = document.body;
    const observer = new MutationObserver(install);
    observer.observe(root, { childList: true, subtree: true });
    window.__aihubCommunityRefreshObserver = observer;
  }
  return install();
})()
`;
}

function FlarumCommunityPage({
  identity,
  theme,
  language,
  community,
  onLogin,
  onSessionRevoked,
  targetPath,
  onTargetConsumed,
  onBack
}: {
  identity: IdentitySnapshot;
  theme: "light" | "dark";
  language: Language;
  community: CatalogCommunity | null;
  onLogin: () => void;
  onSessionRevoked: () => void;
  targetPath: string;
  onTargetConsumed: () => void;
  onBack: () => void;
}) {
  const webviewRef = useRef<EmbeddedCommunityWebview | null>(null);
  const webviewHostRef = useRef<HTMLDivElement | null>(null);
  const pendingTarget = useRef(targetPath);
  const webviewReadyRef = useRef(false);
  const webviewFailedRef = useRef(false);
  const webviewLaunchRef = useRef("");
  const webviewRecoveringRef = useRef(false);
  const webviewRecoveryCountRef = useRef(0);
  const onTargetConsumedRef = useRef(onTargetConsumed);
  const onSessionRevokedRef = useRef(onSessionRevoked);
  const communityThemeRef = useRef(theme);
  const communityLanguageRef = useRef(language);
  const [embed, setEmbed] = useState<CommunityEmbedSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [webviewReady, setWebviewReady] = useState(false);
  const [embedAttempt, setEmbedAttempt] = useState(0);
  const communityText = createLanguage(language);
  const profileSyncKey = communityProfileSyncKey(identity);
  onTargetConsumedRef.current = onTargetConsumed;
  onSessionRevokedRef.current = onSessionRevoked;
  communityThemeRef.current = theme;
  communityLanguageRef.current = language;

  const goBack = () => {
    const webview = webviewRef.current;
    goBackOrFallback({
      canGoBack: () => {
        try {
          return Boolean(webview?.canGoBack());
        } catch {
          return false;
        }
      },
      goBack: () => webview?.goBack(),
      fallback: onBack
    });
  };

  useEffect(() => {
    pendingTarget.current = targetPath;
  }, [targetPath]);

  useEffect(() => {
    if (identity.status !== "authenticated" || !window.aihubPC) {
      setEmbed(null);
      setWebviewReady(false);
      webviewReadyRef.current = false;
      webviewFailedRef.current = false;
      webviewLaunchRef.current = "";
      webviewRecoveringRef.current = false;
      webviewRecoveryCountRef.current = 0;
      return;
    }
    let canceled = false;
    setEmbed(null);
    setLoading(true);
    setError("");
    setWebviewReady(false);
    webviewReadyRef.current = false;
    webviewFailedRef.current = false;
    webviewLaunchRef.current = "";
    window.aihubPC
      .createCommunityEmbedSession()
      .then((result) => {
        if (!canceled) {
          webviewRecoveringRef.current = false;
          if (!result.ok) {
            if (result.error.code === "SESSION_REVOKED") {
              onSessionRevokedRef.current();
            } else {
              setError(
                createLanguage(communityLanguageRef.current).text(
                  result.error.messageKey
                )
              );
            }
            return;
          }
          setEmbed(result.value);
        }
      })
      .catch((cause) => {
        if (!canceled) {
          webviewRecoveringRef.current = false;
          setError(
            cause instanceof Error
              ? cause.message
              : communityText.text("community.loadFailed")
          );
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [
    embedAttempt,
    profileSyncKey
  ]);

  useEffect(() => {
    const host = webviewHostRef.current;
    if (!host || !embed) return;
    const webview = document.createElement("webview") as EmbeddedCommunityWebview;
    webview.className = "communityWebview";
    webview.setAttribute("partition", "persist:aihub-community");
    webview.setAttribute(
      "webpreferences",
      "contextIsolation=yes,nodeIntegration=no,sandbox=yes"
    );
    webviewRef.current = webview;

    const updateLocation = () => {
      const url = webview.getURL();
      const parsed = new URL(url);
      const nextPath = pendingTarget.current;
      if (
        parsed.origin === embed.origin &&
        parsed.pathname === "/" &&
        /^\/d\/[0-9]+/.test(nextPath)
      ) {
        pendingTarget.current = "";
        onTargetConsumedRef.current();
        void webview.loadURL(new URL(nextPath, `${embed.origin}/`).href);
      }
    };
    const installCommunityChrome = () => {
      const runScript = (script: string) => {
        try {
          void webview.executeJavaScript(script).catch(() => undefined);
        } catch {
          // The first React effect can run before Electron emits dom-ready.
        }
      };
      runScript(buildCommunityThemeScript(communityThemeRef.current));
      runScript(buildCommunityLanguageScript(communityLanguageRef.current));
      runScript(buildCommunityChromeControlsScript(communityLanguageRef.current));
    };
    const markReady = () => {
      if (webviewFailedRef.current) return;
      webviewReadyRef.current = true;
      webviewRecoveringRef.current = false;
      webviewRecoveryCountRef.current = 0;
      setWebviewReady(true);
      setLoading(false);
      installCommunityChrome();
    };
    const recoverWebview = () => {
      if (webviewRecoveringRef.current) return;
      try {
        const current = new URL(webview.getURL());
        if (
          current.origin === embed.origin &&
          /^\/d\/[0-9]+/.test(current.pathname)
        ) {
          pendingTarget.current = `${current.pathname}${current.search}${current.hash}`;
        }
      } catch {
        // A guest that never attached has no readable URL to preserve.
      }
      webviewReadyRef.current = false;
      setWebviewReady(false);
      if (webviewRecoveryCountRef.current >= 1) {
        setLoading(false);
        setError(
          createLanguage(communityLanguageRef.current).text(
            "community.loadFailed"
          )
        );
        return;
      }
      webviewRecoveryCountRef.current += 1;
      webviewRecoveringRef.current = true;
      setError("");
      setLoading(true);
      setEmbed(null);
      setEmbedAttempt((attempt) => attempt + 1);
    };
    const failed = (event: Event) => {
      const detail = event as Event & {
        errorCode?: number;
        isMainFrame?: boolean;
      };
      const failure = classifyCommunityLoadFailure(
        detail.errorCode,
        detail.isMainFrame
      );
      if (!failure) return;
      webviewFailedRef.current = true;
      webviewReadyRef.current = false;
      setWebviewReady(false);
      setLoading(false);
      setError(
        createLanguage(communityLanguageRef.current).text(failure.messageKey)
      );
    };
    webview.addEventListener("did-navigate", updateLocation);
    webview.addEventListener("did-navigate-in-page", updateLocation);
    webview.addEventListener("dom-ready", markReady);
    webview.addEventListener("did-stop-loading", markReady);
    webview.addEventListener("did-fail-load", failed);
    webview.addEventListener("render-process-gone", recoverWebview);
    webview.addEventListener("crashed", recoverWebview);
    webviewLaunchRef.current = embed.launchUrl;
    webview.setAttribute("src", embed.launchUrl);
    host.replaceChildren(webview);
    installCommunityChrome();
    const attachWatchdog = window.setTimeout(() => {
      if (!webviewReadyRef.current) recoverWebview();
    }, 8_000);
    return () => {
      window.clearTimeout(attachWatchdog);
      webview.removeEventListener("did-navigate", updateLocation);
      webview.removeEventListener("did-navigate-in-page", updateLocation);
      webview.removeEventListener("dom-ready", markReady);
      webview.removeEventListener("did-stop-loading", markReady);
      webview.removeEventListener("did-fail-load", failed);
      webview.removeEventListener("render-process-gone", recoverWebview);
      webview.removeEventListener("crashed", recoverWebview);
      if (webviewRef.current === webview) webviewRef.current = null;
      webview.remove();
    };
  }, [embed]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !webviewReadyRef.current) return;
    const runScript = (script: string) => {
      try {
        void webview.executeJavaScript(script).catch(() => undefined);
      } catch {
        // The community guest may be between documents during a theme switch.
      }
    };
    runScript(buildCommunityThemeScript(theme));
    runScript(buildCommunityLanguageScript(language));
    runScript(buildCommunityChromeControlsScript(language));
  }, [language, theme]);

  if (identity.status !== "authenticated") {
    return (
      <section className="emptyPanel communityLoginRequired">
        <BackButton onBack={onBack} />
        <span>◎</span>
        <p>{community?.provider || communityText.text("community.provider")}</p>
        <h1>{community ? catalogDisplayField(community, "title", language) : communityText.text("community.title")}</h1>
        {community && <small>{catalogDisplayField(community, "description", language)}</small>}
        <small>{communityText.text("community.loginHint")}</small>
        <button className="accentButton" onClick={onLogin}>
          {communityText.text("community.loginAction")}
        </button>
      </section>
    );
  }

  return (
    <section className="embeddedCommunity">
      <div className="communityBackControl">
        <BackButton onBack={goBack} />
      </div>
      <div className="communityViewport">
        {!embed ? (
          <div className="communityLoading">
            {loading
              ? communityText.text("community.loading")
              : error
                ? runtimeMessage(error)
                : communityText.text("community.unavailable")}
          </div>
        ) : (
          <div ref={webviewHostRef} className="communityWebviewMount" />
        )}
        {embed && !webviewReady && (
          <div className="communityLoading communityLoadingOverlay">
            {loading
              ? communityText.text("community.loading")
              : error
                ? runtimeMessage(error)
                : communityText.text("community.unavailable")}
          </div>
        )}
        {error && (
          <em className="communityError">{runtimeMessage(error)}</em>
        )}
      </div>
    </section>
  );
}

function CommunityWorkspace({
  identity,
  discussions,
  selected,
  error,
  onLogin,
  onRefresh,
  onSelect,
  onBack,
  onCreate,
  onReply
}: {
  identity: IdentitySnapshot;
  discussions: CommunityDiscussionSummary[];
  selected: CommunityDiscussion | null;
  error: string;
  onLogin: () => void;
  onRefresh: () => Promise<void>;
  onSelect: (discussionId: string) => Promise<void>;
  onBack: () => void;
  onCreate: (input: {
    title: string;
    body: string;
    productId?: string;
  }) => Promise<void>;
  onReply: (discussionId: string, body: string) => Promise<void>;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const submitDiscussion = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActionError("");
    void onCreate({ title, body })
      .then(() => {
        setTitle("");
        setBody("");
        setComposerOpen(false);
      })
      .catch((error) =>
        setActionError(error instanceof Error ? error.message : uiText("auto.c8bceff124ed"))
      )
      .finally(() => setBusy(false));
  };

  const submitReply = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setActionError("");
    void onReply(selected.id, reply)
      .then(() => setReply(""))
      .catch((error) =>
        setActionError(error instanceof Error ? error.message : uiText("auto.3acd6932b6ef"))
      )
      .finally(() => setBusy(false));
  };

  if (selected) {
    return (
      <section className="communityPage">
        <BackButton onBack={onBack} />
        <article className="discussionDetail">
          <small>{selected.author.nickname}</small>
          <h1>{selected.title}</h1>
          <p>{selected.body}</p>
        </article>
        <div className="replyList">
          {selected.replies.map((item) => (
            <article key={item.id}>
              <b>{item.author.nickname}</b>
              <p>{item.body}</p>
              <small>{new Date(item.createdAt).toLocaleString()}</small>
            </article>
          ))}
        </div>
        {identity.status === "authenticated" ? (
          <form className="replyComposer" onSubmit={submitReply}>
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder={uiText("auto.32a8e18e1f84")}
              required
            />
            <button className="accentButton" disabled={busy}>
              {uiText("auto.83f08c796de7")}</button>
          </form>
        ) : (
          <button className="accentButton" onClick={onLogin}>
            {uiText("auto.7dac936fe9f0")}</button>
        )}
        {actionError && <em>{runtimeMessage(actionError)}</em>}
      </section>
    );
  }

  return (
    <section className="communityPage">
      <header className="communityHeader">
        <div>
          <p>{uiText("community.legacyTitle")}</p>
          <h1>{uiText("auto.5bcd0ddcdd69")}</h1>
          <span>{uiText("auto.c60f6496d06c")}</span>
        </div>
        <div className="rowActions">
          <button onClick={() => void onRefresh()}>{uiText("auto.aee887434131")}</button>
          <button
            className="accentButton"
            onClick={
              identity.status === "authenticated"
                ? () => setComposerOpen(true)
                : onLogin
            }
          >
            {identity.status === "authenticated" ? uiText("auto.9cf5f152776d") : uiText("auto.033e8dd2f134")}
          </button>
        </div>
      </header>
      {composerOpen && (
        <form className="discussionComposer" onSubmit={submitDiscussion}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={uiText("auto.fc4e7c9b6375")}
            minLength={3}
            required
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={uiText("auto.45c33a66c5e7")}
            minLength={3}
            required
          />
          <div className="rowActions">
            <button type="button" onClick={() => setComposerOpen(false)}>
              {uiText("auto.2cd0f3be8738")}</button>
            <button className="accentButton" disabled={busy}>
              {uiText("auto.b61f333b91b2")}</button>
          </div>
        </form>
      )}
      <div className="discussionList">
        {discussions.map((discussion) => (
          <button
            key={discussion.id}
            onClick={() => void onSelect(discussion.id)}
          >
            <div>
              <small>{discussion.author.nickname}</small>
              <h3>{discussion.title}</h3>
              <p>{discussion.body}</p>
            </div>
            <span>{discussion.replyCount} {uiText("auto.cd5bc7df2e31")}</span>
          </button>
        ))}
        {!discussions.length && !error && (
          <div className="emptyPanel">
            <b>{uiText("auto.1e23ee458041")}</b>
            <small>{uiText("auto.87ca2b6e304e")}</small>
          </div>
        )}
      </div>
      {(error || actionError) && (
        <em>{runtimeMessage(error || actionError)}</em>
      )}
    </section>
  );
}

function CommunityPage({
  community,
  language
}: {
  community: CatalogCommunity;
  language: Language;
}) {
  return (
    <section className="emptyPanel">
      <span>◎</span>
      <p>{community.provider}</p>
      <h1>{catalogDisplayField(community, "title", language)}</h1>
      <small>{catalogDisplayField(community, "description", language)}</small>
      {community.enabled && community.url ? (
        <button
          className="accentButton"
          onClick={() => window.open(community.url)}
        >
          {uiText("auto.cc43dbc3e4fb")}</button>
      ) : (
        <b>{uiText("auto.10b42e126120")}</b>
      )}
    </section>
  );
}

function InstalledProductsPage({
  management,
  messages,
  language,
  productStages,
  productErrors,
  environmentChecks,
  environmentPackageStages,
  scanning,
  softwareUpdateResult,
  onRefresh,
  onOpen,
  onClose,
  onOpenFiles,
  onReinstall,
  onGetLatest,
  onUpdateDesktop,
  onUpdateCli,
  onReinstallEnvironment,
  onUninstall,
  onUpdateEnvironment,
  onOpenEnvironmentUpdater,
  onOpenWindowsUninstall,
  onRepairWslEnvironment,
  onInstallPackage,
  onShowPackage,
  onDeletePackage
}: {
  management: ReturnType<typeof buildInstalledProductManagement>;
  messages: Record<string, string>;
  language: Language;
  productStages: Record<string, ProductStage>;
  productErrors: Record<string, string>;
  environmentChecks: EnvironmentCheck[];
  environmentPackageStages: Record<string, EnvironmentPackageStage>;
  scanning: boolean;
  softwareUpdateResult: SoftwareUpdateCheckResult | null;
  onRefresh: () => Promise<void>;
  onOpen: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["products"][number]
  ) => Promise<void>;
  onClose: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["products"][number]
  ) => Promise<void>;
  onOpenFiles: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["products"][number]
  ) => Promise<void>;
  onReinstall: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["products"][number]
  ) => void;
  onGetLatest: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["products"][number]
  ) => void;
  onUpdateDesktop: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["products"][number]
  ) => Promise<void>;
  onUpdateCli: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["products"][number]
  ) => Promise<void>;
  onReinstallEnvironment: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["reinstallableEnvironments"][number]
  ) => void;
  onUninstall: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["products"][number]
  ) => Promise<void>;
  onUpdateEnvironment: (environmentId: string) => Promise<void>;
  onOpenEnvironmentUpdater: (environmentId: string) => Promise<void>;
  onOpenWindowsUninstall: () => void;
  onRepairWslEnvironment: (entry: {
    ownerProductId: string;
  }) => Promise<void>;
  onInstallPackage: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["packages"][number]
  ) => void;
  onShowPackage: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["packages"][number]
  ) => Promise<void>;
  onDeletePackage: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["packages"][number]
  ) => Promise<void>;
}) {
  type ManagementBusyAction =
    | "open"
    | "close"
    | "open-files"
    | "uninstall"
    | "prepare-update"
    | "open-updater"
    | "desktop-update"
    | "cli-update"
    | "show-package"
    | "delete-package";
  const [managementBusy, setManagementBusy] = useState<
    Record<string, ManagementBusyAction>
  >({});
  const managementBusyKeys = useRef(new Set<string>());
  const runManagementAction = async (
    key: string,
    action: ManagementBusyAction,
    run: () => Promise<void>
  ) => {
    if (managementBusyKeys.current.has(key)) return;
    managementBusyKeys.current.add(key);
    setManagementBusy((current) => ({ ...current, [key]: action }));
    try {
      await run();
    } finally {
      managementBusyKeys.current.delete(key);
      setManagementBusy((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };
  const [extensionInventory, setExtensionInventory] = useState<
    ExtensionInventoryEntry[]
  >([]);
  const [extensionInventoryError, setExtensionInventoryError] = useState("");
  const [extensionInventoryScanning, setExtensionInventoryScanning] =
    useState(false);
  const [extensionBusy, setExtensionBusy] = useState<{
    profileId: string;
    action: ExtensionRuntimeAction;
  } | null>(null);
  const [updatingAll, setUpdatingAll] = useState(false);

  const refreshExtensionInventory = async () => {
    const api = window.aihubPC;
    if (!api || extensionInventoryScanning) return;
    setExtensionInventoryScanning(true);
    setExtensionInventoryError("");
    try {
      setExtensionInventory(await api.listExtensions());
    } catch {
      setExtensionInventoryError(uiText("extensions.failed"));
    } finally {
      setExtensionInventoryScanning(false);
    }
  };

  useEffect(() => {
    void refreshExtensionInventory();
  }, []);

  const runExtensionInventoryAction = async (
    entry: ExtensionInventoryEntry,
    action: ExtensionRuntimeAction
  ) => {
    const api = window.aihubPC;
    if (!api || extensionBusy) return;
    setExtensionBusy({ profileId: entry.profileId, action });
    try {
      const result = await api.executeExtension(entry.profileId, action);
      if (action === "uninstall" && result.ok) {
        setExtensionInventory((current) =>
          current.filter((item) => item.profileId !== entry.profileId)
        );
      } else {
        setExtensionInventory((current) =>
          current.map((item) =>
            item.profileId !== entry.profileId
              ? item
              : result.ok
                ? { ...item, ...result, error: undefined }
                : {
                    ...item,
                    ok: false,
                    error: result.error || uiText("extensions.failed")
                  }
          )
        );
      }
    } catch {
      setExtensionInventory((current) =>
        current.map((item) =>
          item.profileId === entry.profileId
            ? {
                ...item,
                ok: false,
                error: uiText("extensions.failed")
              }
            : item
        )
      );
    } finally {
      setExtensionBusy(null);
    }
  };

  const productUpdates = management.products.filter(
    (entry) =>
      entry.canUpdate === true &&
      (entry.type === "desktop" || entry.type === "cli")
  );
  const environmentUpdates = environmentChecks.filter(
    (check) => check.installed && check.canUpdate === true
  );
  const extensionUpdates = extensionInventory.filter((entry) =>
    entry.allowedActions.includes("update")
  );
  const availableUpdateCount =
    productUpdates.length + environmentUpdates.length + extensionUpdates.length;

  const updateAllInstalled = async () => {
    if (
      updatingAll ||
      scanning ||
      extensionBusy !== null ||
      managementBusyKeys.current.size > 0 ||
      availableUpdateCount === 0
    ) {
      return;
    }
    setUpdatingAll(true);
    try {
      for (const entry of productUpdates) {
        try {
          await runManagementAction(
            entry.id,
            entry.type === "cli" ? "cli-update" : "desktop-update",
            () => entry.type === "cli" ? onUpdateCli(entry) : onUpdateDesktop(entry)
          );
        } catch {
          // Each product action owns its safe, user-visible failure message.
        }
      }
      for (const check of environmentUpdates) {
        const environmentId = check.updateEnvironmentId || check.id;
        try {
          await runManagementAction(
            `environment:${environmentId}`,
            "prepare-update",
            () => onUpdateEnvironment(environmentId)
          );
        } catch {
          // Environment update preparation reports its own bounded error.
        }
      }
      for (const entry of extensionUpdates) {
        await runExtensionInventoryAction(entry, "update");
      }
      await onRefresh();
      await refreshExtensionInventory();
    } finally {
      setUpdatingAll(false);
    }
  };

  return (
    <section className="installedManagementPage">
      <header className="pageHeader managementHeader">
        <div>
          <span>{uiText("auto.f242c2020794")}</span>
          <h2>{uiText("auto.6b8e74aca534")}</h2>
          <p>{uiText("auto.c23f887504cb")}</p>
        </div>
        <div className="managementHeaderActions">
          <small data-aihub-software-update-status={softwareUpdateResult?.status || "checking"}>
            {softwareUpdateResult?.message || uiText("softwareUpdates.checking")}
          </small>
          <Button
            className="accentButton"
            type="button"
            data-aihub-action="update-all-installed"
            loading={updatingAll}
            disabled={
              updatingAll ||
              scanning ||
              availableUpdateCount === 0 ||
              extensionBusy !== null ||
              Object.keys(managementBusy).length > 0
            }
            onClick={() => void updateAllInstalled()}
          >
            {updatingAll
              ? uiText("softwareUpdates.updatingAll")
              : uiText("softwareUpdates.updateAll", {
                  count: availableUpdateCount
                })}
          </Button>
          <button disabled={scanning || updatingAll} onClick={() => void onRefresh()}>
            {scanning ? uiText("auto.71659de804df") : uiText("auto.802a407c7743")}
          </button>
        </div>
      </header>

      <div className="managementList">
        {management.products.length ? (
          management.products.map((entry) => {
            const environmentId = entry.type === "environment"
              ? entry.id.slice("environment:".length)
              : "";
            const environmentCheck = environmentChecks.find(
              (check) => check.id === environmentId
            );
            const updateEnvironmentId =
              environmentCheck?.updateEnvironmentId || environmentId;
            const updateReady = Boolean(
              updateEnvironmentId &&
              environmentPackageStages[updateEnvironmentId] === "ready"
            );
            return (
            <article className="managementCard installedProductCard" key={entry.id}>
              <div className="managementInfo">
                <div className="managementIdentity">
                  <span>
                    {entry.vendorName} ·{" "}
                    {entry.type === "cli"
                      ? "CLI"
                      : entry.type === "environment"
                        ? uiText("auto.423f51a28678")
                        : uiText("auto.a3dc386f84de")}
                  </span>
                  <h3>{entry.name}</h3>
                  <p className="managementMeta">
                    {entry.version ? `v${entry.version}` : uiText("auto.a8b6c39dcabf")}
                    {entry.location ? ` · ${entry.location}` : ""}
                  </p>
                </div>
                <div className="managementStatusStack" role="status" aria-live="polite">
                  {messages[entry.id] && (
                    <small className="managementRuntimeStatus">{runtimeMessage(messages[entry.id])}</small>
                  )}
                  {entry.updateOwner && (
                    <small className="managementStatusNote">{desktopUpdateOwnerLabel(entry.updateOwner)}</small>
                  )}
                  {entry.canUpdate && entry.availableVersion && (
                    <small className="managementUpdateNotice">
                      {uiText("desktop.updateAvailable", {
                        value1: entry.availableVersion
                      })}
                    </small>
                  )}
                  {environmentCheck?.canUpdate && environmentCheck.recommendedVersion && (
                    <small className="managementUpdateNotice">{uiText("environment.recommendedVersion", { value1: environmentCheck.recommendedVersion })}</small>
                  )}
                  {messages[`environment-update:${updateEnvironmentId}`] && (
                    <small className="managementRuntimeStatus">{runtimeMessage(messages[`environment-update:${updateEnvironmentId}`])}</small>
                  )}
                </div>
              </div>
              <div className="managementActions">
                {entry.canOpen && (
                  <button
                    disabled={Boolean(managementBusy[entry.id])}
                    onClick={() => void runManagementAction(entry.id, "open", () => onOpen(entry))}
                  >
                    {managementBusy[entry.id] === "open" ? uiText("management.opening") : uiText("auto.c771248e511f")}
                  </button>
                )}
                {entry.canClose && (
                  <button
                    disabled={Boolean(managementBusy[entry.id])}
                    onClick={() => void runManagementAction(entry.id, "close", () => onClose(entry))}
                  >
                    {managementBusy[entry.id] === "close" ? uiText("management.closing") : uiText("auto.3fd47edce45b")}
                  </button>
                )}
                {entry.canManageFiles && (
                  <button
                    disabled={Boolean(managementBusy[entry.id])}
                    onClick={() => void runManagementAction(entry.id, "open-files", () => onOpenFiles(entry))}
                  >
                    {managementBusy[entry.id] === "open-files" ? uiText("management.openingFiles") : uiText("auto.b3bd5ac7cc4d")}
                  </button>
                )}
                {entry.canReinstall && !environmentCheck?.canUpdate && !entry.canUpdate && (
                  <button onClick={() => onReinstall(entry)}>{uiText("auto.453ad482ccef")}</button>
                )}
                {entry.type === "desktop" && entry.canUpdate && (
                  <button
                    className="accentButton"
                    data-aihub-action="update-installed-desktop"
                    disabled={Boolean(managementBusy[entry.id])}
                    onClick={() => void runManagementAction(
                      entry.id,
                      "desktop-update",
                      () => onUpdateDesktop(entry)
                    )}
                  >
                    {uiText("environment.update")}
                  </button>
                )}
                {entry.type === "cli" && entry.canUpdate && (
                  <button
                    className="accentButton"
                    data-aihub-action="update-installed-cli"
                    disabled={Boolean(managementBusy[entry.id])}
                    onClick={() => void runManagementAction(
                      entry.id,
                      "cli-update",
                      () => onUpdateCli(entry)
                    )}
                  >
                    {managementBusy[entry.id] === "cli-update"
                      ? uiText("softwareUpdates.updating")
                      : uiText("environment.update")}
                  </button>
                )}
                {environmentCheck?.canUpdate && (
                  <button
                    className="accentButton"
                    disabled={Boolean(managementBusy[entry.id])}
                    onClick={() => void runManagementAction(
                      entry.id,
                      updateReady ? "open-updater" : "prepare-update",
                      () => updateReady
                        ? onOpenEnvironmentUpdater(updateEnvironmentId)
                        : onUpdateEnvironment(updateEnvironmentId)
                    )}
                  >
                    {managementBusy[entry.id] === "prepare-update"
                      ? uiText("environment.updating")
                      : managementBusy[entry.id] === "open-updater"
                        ? uiText("environment.openingUpdater")
                        : updateReady
                          ? uiText("environment.openUpdater")
                          : uiText("environment.update")}
                  </button>
                )}
                {entry.canGetLatest && !entry.canUpdate && (
                  <button onClick={() => onGetLatest(entry)}>
                    {uiText("desktop.getLatestInstaller")}
                  </button>
                )}
                {entry.canUninstall && (
                  <button
                    className="dangerButton"
                    disabled={Boolean(managementBusy[entry.id])}
                    onClick={() => void runManagementAction(entry.id, "uninstall", () => onUninstall(entry))}
                  >
                    {managementBusy[entry.id] === "uninstall" ? uiText("management.uninstalling") : uiText("auto.06bc14b60f35")}</button>
                )}
                {entry.type === "desktop" && !entry.canUninstall && (
                  <button onClick={onOpenWindowsUninstall}>
                    {uiText("desktop.openUninstallSettings")}
                  </button>
                )}
              </div>
              {entry.children?.length ? (
                <details className="managementChildren">
                  <summary>{uiText("wsl.directory", { count: entry.children.length })}</summary>
                  <div className="managementChildList">
                    {entry.children.map((distribution) => (
                      <section key={distribution.id}>
                        <header>
                          <b>{distribution.name}</b>
                          <span>{uiText("wsl.distribution")}</span>
                        </header>
                        {distribution.environments.length ? (
                          distribution.environments.map((environment) => (
                            <div className="managementChild" key={environment.id}>
                              <div>
                                <b>{environment.name}</b>
                                <small>
                                  {environment.installed
                                    ? environment.version
                                      ? `v${environment.version}`
                                      : uiText("extensions.installed")
                                    : uiText("extensions.notInstalled")}
                                  {` · ${environment.ownerProductName}`}
                                </small>
                                {environment.location ? (
                                  <small>{environment.location}</small>
                                ) : null}
                              </div>
                              {!environment.installed && environment.canRepair ? (
                                <button
                                  className="accentButton"
                                  onClick={() =>
                                    void onRepairWslEnvironment(environment)
                                  }
                                >
                                  {uiText("wsl.repair")}
                                </button>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <small className="managementChildEmpty">
                            {uiText("wsl.noManagedEnvironment")}
                          </small>
                        )}
                      </section>
                    ))}
                  </div>
                </details>
              ) : null}
            </article>
            );
          })
        ) : (
          <div className="emptyManagement">{uiText("auto.cbdc685957fb")}</div>
        )}
      </div>

      <section
        className="packageManagement"
        data-aihub-extension-inventory="local-receipts"
      >
        <header className="managementHeader">
          <div className="sectionHeading">
            <h2>{uiText("extensions.managementTitle")}</h2>
            <p>{uiText("extensions.managementDescription")}</p>
          </div>
          <button
            data-aihub-action="refresh-extension-inventory"
            disabled={extensionInventoryScanning || extensionBusy !== null}
            onClick={() => void refreshExtensionInventory()}
          >
            {extensionInventoryScanning
              ? uiText("extensions.refreshing")
              : uiText("extensions.refresh")}
          </button>
        </header>
        {extensionInventory.length ? (
          <div className="managementList">
            {extensionInventory.map((entry) => (
              <article
                className="managementCard"
                key={entry.profileId}
                data-aihub-extension-profile-id={entry.profileId}
              >
                <div className="managementInfo">
                  <span>{entry.resourceType.toUpperCase()}</span>
                  <h3>{entry.label}</h3>
                  <p>{extensionStatusLabel(entry)}</p>
                  {entry.error && entry.error !== extensionStatusLabel(entry) && (
                    <small>{entry.error}</small>
                  )}
                </div>
                <div className="managementActions">
                  {entry.allowedActions.map((action) => (
                    <button
                      key={action}
                      className={
                        action === "uninstall"
                          ? "dangerButton"
                          : ["install", "update", "repair", "enable"].includes(action)
                            ? "accentButton"
                            : ""
                      }
                      data-aihub-action={`${action}-installed-extension`}
                      disabled={extensionBusy !== null}
                      onClick={() => void runExtensionInventoryAction(entry, action)}
                    >
                      {extensionActionLabel(
                        action,
                        extensionBusy?.profileId === entry.profileId &&
                          extensionBusy.action === action
                      )}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyManagement">
            {extensionInventoryError || uiText("extensions.managementEmpty")}
          </div>
        )}
      </section>

      {management.reinstallableEnvironments.length > 0 && (
        <section className="packageManagement">
          <div className="sectionHeading">
            <span>{uiText("auto.423f51a28678")}</span>
            <h2>{uiText("auto.8179fb170486")}</h2>
          </div>
          <div className="managementList">
            {management.reinstallableEnvironments.map((entry) => (
              <article className="managementCard" key={entry.id}>
                <div className="managementInfo">
                  <span>{entry.vendorName}</span>
                  <h3>{entry.name}</h3>
                  <p>{uiText("auto.eb02bb5f25fd")}</p>
                  {messages[entry.id] && <small>{messages[entry.id]}</small>}
                </div>
                <div className="managementActions">
                  <button
                    className="accentButton"
                    onClick={() => onReinstallEnvironment(entry)}
                  >
                    {entry.packageReady ? uiText("auto.a6ad67f21008") : uiText("auto.453ad482ccef")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="packageManagement">
        <div className="sectionHeading">
          <h2>{uiText("auto.f9300f5383cb")}</h2>
        </div>
        {management.packages.length ? (
          <div className="managementList">
            {management.packages.map((entry) => {
              const packageBusyKey = `package:${entry.id}`;
              const packageBusy = managementBusy[packageBusyKey];
              const installPresentation = getProductInstallPresentation({
                stage: productStages[entry.id] || "downloaded",
                filePath: entry.filePath,
                language
              });
              const message =
                productErrors[entry.id] || messages[`package:${entry.id}`];
              return (
                <article className="managementCard packageCard" key={entry.id}>
                  <div className="managementInfo">
                    <h3>{entry.name}</h3>
                    <p title={entry.filePath}>{entry.filePath}</p>
                    {message && <small>{runtimeMessage(message)}</small>}
                  </div>
                  <div className="managementActions">
                    {entry.canInstall && (
                      <button
                        className="accentButton"
                        disabled={installPresentation?.disabled}
                        onClick={() => onInstallPackage(entry)}
                      >
                        {installPresentation?.buttonLabel ||
                          uiText("auto.88eab834cb5f")}
                      </button>
                    )}
                    <button
                      disabled={Boolean(packageBusy)}
                      onClick={() => void runManagementAction(packageBusyKey, "show-package", () => onShowPackage(entry))}
                    >
                      {packageBusy === "show-package" ? uiText("management.openingFolder") : uiText("auto.fcf8b4bff0df")}</button>
                    <button
                      className="dangerButton"
                      disabled={Boolean(packageBusy)}
                      onClick={() => void runManagementAction(packageBusyKey, "delete-package", () => onDeletePackage(entry))}
                    >
                      {packageBusy === "delete-package" ? uiText("management.deletingPackage") : uiText("auto.200615f03adf")}</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="emptyManagement">{uiText("auto.7f0386e672ea")}</div>
        )}
      </section>
    </section>
  );
}

function SettingsPanel({
  opened,
  theme,
  language,
  downloadDirectory,
  cliInstallDirectory,
  environment,
  environmentMessages,
  environmentPackageStages,
  downloadTasks,
  managedDownloadQueueTasks,
  downloadTaskNames,
  desktopOperationTasks,
  environmentOperationTasks,
  operationTaskNames,
  cliManagedTasks,
  cliLogs,
  installedTaskIds,
  installableDownloadTaskIds,
  scanning,
  onClose,
  onTheme,
  onLanguage,
  onChooseDirectory,
  onChooseCliDirectory,
  onOpenCliDirectory,
  onOpenDirectory,
  onClearDirectory,
  onScan,
  onInstallEnvironment,
  onOpenEnvironmentInstaller,
  onOpenEnvironmentLocation,
  onUninstallEnvironment,
  onUpdateEnvironment,
  onOpenEnvironmentUpdater,
  onResumeDownloadTask,
  onPauseDownloadTask,
  onCancelDownloadTask,
  onCancelManagedDownloadTask,
  onRetryManagedDownloadTask,
  onOpenCompletedDownloadTask,
  onShowDownloadInFolder,
  onClearDownloadHistory,
  onClearCompletedTasks,
  onCheckDesktopOperationTask,
  onCheckEnvironmentOperationTask,
  onClearCliManagedTask,
  onRetryCliManagedTask,
  onRecheckCliManagedTask
}: {
  opened: boolean;
  theme: "light" | "dark";
  language: Language;
  downloadDirectory: string;
  cliInstallDirectory: string;
  environment: EnvironmentReport | null;
  environmentMessages: Record<string, string>;
  environmentPackageStages: Record<string, EnvironmentPackageStage>;
  downloadTasks: Record<string, ManagedDownloadTask>;
  managedDownloadQueueTasks: Record<string, ManagedDownloadQueueTask>;
  downloadTaskNames: Record<string, string>;
  desktopOperationTasks: Record<string, DesktopOperationTask>;
  environmentOperationTasks: Record<string, EnvironmentOperationTask>;
  operationTaskNames: Record<string, string>;
  cliManagedTasks: Record<string, CliManagedTask>;
  cliLogs: Record<string, CliLogEntry[]>;
  installedTaskIds: string[];
  installableDownloadTaskIds: string[];
  scanning: boolean;
  onClose: () => void;
  onTheme: (value: "light" | "dark") => void;
  onLanguage: (value: Language) => void;
  onChooseDirectory: () => void;
  onChooseCliDirectory: () => void;
  onOpenCliDirectory: () => Promise<boolean>;
  onOpenDirectory: () => void;
  onClearDirectory: () => void;
  onScan: () => void;
  onInstallEnvironment: (environmentId: string) => void;
  onOpenEnvironmentInstaller: (environmentId: string) => void;
  onOpenEnvironmentLocation: (environmentId: string) => void;
  onUninstallEnvironment: (environmentId: string) => void;
  onUpdateEnvironment: (environmentId: string) => Promise<void>;
  onOpenEnvironmentUpdater: (environmentId: string) => Promise<void>;
  onResumeDownloadTask: (productId: string) => void;
  onPauseDownloadTask: (productId: string) => void;
  onCancelDownloadTask: (productId: string, trigger: HTMLButtonElement) => void;
  onCancelManagedDownloadTask: (productId: string, trigger: HTMLButtonElement) => void;
  onRetryManagedDownloadTask: (productId: string) => void;
  onOpenCompletedDownloadTask: (productId: string) => void;
  onShowDownloadInFolder: (productId: string) => void;
  onClearDownloadHistory: (productId: string) => void;
  onClearCompletedTasks: () => void;
  onCheckDesktopOperationTask: (productId: string) => void;
  onCheckEnvironmentOperationTask: (environmentId: string) => void;
  onClearCliManagedTask: (productId: string) => void;
  onRetryCliManagedTask: (productId: string) => void;
  onRecheckCliManagedTask: (productId: string) => void;
}) {
  type TaskFilter = "active" | "failed" | "completed";
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("active");
  const [cliDirectoryError, setCliDirectoryError] = useState("");
  const desktopTaskState = (task: DesktopOperationTask): TaskFilter =>
    task.phase === "installed" || task.phase === "uninstalled"
      ? "completed"
      : task.phase === "timed-out" ||
          task.phase === "failed" ||
          task.phase === "canceled"
        ? "failed"
        : "active";
  const environmentTaskState = (
    task: EnvironmentOperationTask
  ): TaskFilter =>
    task.phase === "installed" || task.phase === "uninstalled"
      ? "completed"
      : task.phase === "timed-out"
        ? "failed"
        : "active";
  const cliTaskState = (task: CliManagedTask): TaskFilter =>
    task.phase === "completed"
      ? "completed"
      : task.phase === "failed" || task.phase === "canceled"
        ? "failed"
        : "active";
  const downloadTaskState = (task: ManagedDownloadTask): TaskFilter =>
    task.phase === "completed"
      ? "completed"
      : task.phase === "failed"
        ? "failed"
        : "active";
  const queueTaskState = (task: ManagedDownloadQueueTask): TaskFilter =>
    task.presentation.state;
  const operationDownloadIds = new Set([
    ...Object.keys(desktopOperationTasks),
    ...Object.keys(environmentOperationTasks).map(
      (environmentId) => `environment:${environmentId}`
    )
  ]);
  const installedIds = new Set(installedTaskIds);
  const installableDownloadIds = new Set(installableDownloadTaskIds);
  const visibleDownloadTasks = Object.values(downloadTasks)
    .filter(
      (task) =>
        task.phase !== "canceled" &&
        !(
          task.phase === "completed" &&
          (operationDownloadIds.has(task.productId) ||
            installedIds.has(task.productId))
        )
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const visibleManagedDownloadQueueTasks = Object.values(managedDownloadQueueTasks)
    .sort((left, right) => left.taskId.localeCompare(right.taskId));
  const visibleDesktopOperations = Object.values(desktopOperationTasks).sort(
    (left, right) => right.updatedAt.localeCompare(left.updatedAt)
  );
  const visibleEnvironmentOperations = Object.values(
    environmentOperationTasks
  ).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const visibleCliTasks = Object.values(cliManagedTasks).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
  const taskCounts: Record<TaskFilter, number> = {
    active:
      visibleDownloadTasks.filter((task) => downloadTaskState(task) === "active")
        .length +
      visibleManagedDownloadQueueTasks.filter((task) => queueTaskState(task) === "active").length +
      visibleDesktopOperations.filter(
        (task) => desktopTaskState(task) === "active"
      ).length +
      visibleEnvironmentOperations.filter(
        (task) => environmentTaskState(task) === "active"
      ).length +
      visibleCliTasks.filter((task) => cliTaskState(task) === "active").length,
    failed:
      visibleDownloadTasks.filter((task) => downloadTaskState(task) === "failed")
        .length +
      visibleManagedDownloadQueueTasks.filter((task) => queueTaskState(task) === "failed").length +
      visibleDesktopOperations.filter(
        (task) => desktopTaskState(task) === "failed"
      ).length +
      visibleEnvironmentOperations.filter(
        (task) => environmentTaskState(task) === "failed"
      ).length +
      visibleCliTasks.filter((task) => cliTaskState(task) === "failed").length,
    completed:
      visibleDownloadTasks.filter(
        (task) => downloadTaskState(task) === "completed"
      ).length +
      visibleManagedDownloadQueueTasks.filter((task) => queueTaskState(task) === "completed").length +
      visibleDesktopOperations.filter(
        (task) => desktopTaskState(task) === "completed"
      ).length +
      visibleEnvironmentOperations.filter(
        (task) => environmentTaskState(task) === "completed"
      ).length +
      visibleCliTasks.filter((task) => cliTaskState(task) === "completed")
        .length
  };
  const filteredDownloadTasks = visibleDownloadTasks.filter(
    (task) => downloadTaskState(task) === taskFilter
  );
  const filteredManagedDownloadQueueTasks = visibleManagedDownloadQueueTasks.filter(
    (task) => queueTaskState(task) === taskFilter
  );
  const filteredDesktopOperations = visibleDesktopOperations.filter(
    (task) => desktopTaskState(task) === taskFilter
  );
  const filteredEnvironmentOperations = visibleEnvironmentOperations.filter(
    (task) => environmentTaskState(task) === taskFilter
  );
  const filteredCliTasks = visibleCliTasks.filter(
    (task) => cliTaskState(task) === taskFilter
  );
  const hasManagedTasks =
    filteredDownloadTasks.length > 0 ||
    filteredManagedDownloadQueueTasks.length > 0 ||
    filteredDesktopOperations.length > 0 ||
    filteredEnvironmentOperations.length > 0 ||
    filteredCliTasks.length > 0;
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="min(490px, 94vw)"
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.18, blur: 0 }}
      classNames={{
        content: "settingsDrawerContent",
        body: "settingsDrawerBody"
      }}
      data-aihub-settings-drawer
    >
      <aside className="settingsPanel">
        <header>
          <div>
            <p>{uiText("auto.df3d58c7d84b")}</p>
            <h2>{uiText("auto.1c39e6a19bda")}</h2>
          </div>
          <ActionIcon
            variant="subtle"
            onClick={onClose}
            aria-label={uiText("action.close")}
          >
            <IconX size={18} stroke={1.8} />
          </ActionIcon>
        </header>

        <SettingBlock title={uiText("auto.7d5ce714f1d6")}>
          <div className="segmented">
            <button className={theme === "light" ? "active" : ""} onClick={() => onTheme("light")}>{uiText("auto.f56e7eff58bf")}</button>
            <button className={theme === "dark" ? "active" : ""} onClick={() => onTheme("dark")}>{uiText("auto.ed7d2c54184b")}</button>
          </div>
        </SettingBlock>

        <SettingBlock title={uiText("auto.81e37eb6d0c7")}>
          <p className="pathValue">{downloadDirectory || uiText("auto.c8feeb4f19fc")}</p>
          <div className="rowActions">
            <button onClick={onChooseDirectory}>{uiText("auto.38418cc70d55")}</button>
            <button disabled={!downloadDirectory} onClick={onOpenDirectory}>{uiText("auto.fcf8b4bff0df")}</button>
            <button disabled={!downloadDirectory} onClick={onClearDirectory}>{uiText("auto.2f9daa828907")}</button>
          </div>
        </SettingBlock>

        <SettingBlock title={uiText("auto.00b514c36a6c")}>
          <div className="taskCenterToolbar">
            <div className="taskFilters" role="group" aria-label={uiText("auto.41f0f19eb5a4")}>
              <button
                className={taskFilter === "active" ? "active" : ""}
                aria-pressed={taskFilter === "active"}
                onClick={() => setTaskFilter("active")}
              >
                {uiText("downloadQueue.allActive")} {taskCounts.active}
              </button>
              <button
                className={taskFilter === "failed" ? "active" : ""}
                aria-pressed={taskFilter === "failed"}
                onClick={() => setTaskFilter("failed")}
              >
                {uiText("auto.28384d7afd2e")}{taskCounts.failed}
              </button>
              <button
                className={taskFilter === "completed" ? "active" : ""}
                aria-pressed={taskFilter === "completed"}
                onClick={() => setTaskFilter("completed")}
              >
                {uiText("auto.f28461bb49c8")}{taskCounts.completed}
              </button>
            </div>
            {taskFilter === "completed" && taskCounts.completed > 0 && (
              <button
                className="clearCompletedTasks"
                onClick={onClearCompletedTasks}
              >
                {uiText("auto.2646816f2288")}</button>
            )}
          </div>
          <div className="managedDownloadList">
            {hasManagedTasks ? (
              <>
                {filteredManagedDownloadQueueTasks.length > 0 && (
                  <section className="managedQueueSection" aria-labelledby="managed-download-queue-heading">
                    <h3 id="managed-download-queue-heading">{uiText("downloadQueue.sectionTitle")}</h3>
                {filteredManagedDownloadQueueTasks.map((task) => {
                      const active = task.presentation.canCancel;
                      const downloading = task.phase === "downloading";
                      const retryable = task.presentation.canRetry;
                      const productName = downloadTaskNames[task.productId] || task.productId;
                      const percent = task.progress.percent;
                      const status = managedDownloadQueuePhaseLabel(task);
                      const progressLabel = percent === null
                        ? status
                        : `${status} ${percent}%`;
                      return (
                        <div
                          className="managedQueueTask"
                          key={`queue:${task.taskId}`}
                          data-product-id={task.productId}
                          data-task-state={queueTaskState(task)}
                          data-aihub-managed-download-phase={task.phase}
                        >
                          <div>
                            <b>{productName}</b>
                            <small role={task.phase === "failed" ? "alert" : "status"}>
                              {task.phase === "failed" ? uiText("downloadQueue.failed") : progressLabel}
                            </small>
                            {task.phase === "downloaded" && <small role="status">{uiText("downloadQueue.downloadedWait")}</small>}
                            {task.progress.receivedBytes > 0 && (
                              <small>
                                {formatBytes(task.progress.receivedBytes)}
                                {task.progress.totalBytes > 0 ? ` / ${formatBytes(task.progress.totalBytes)}` : ""}
                              </small>
                            )}
                          </div>
                          {active && (
                            <button
                              data-aihub-action="cancel-managed-download"
                              onClick={(event) => onCancelManagedDownloadTask(task.productId, event.currentTarget)}
                            >
                              {uiText("downloadQueue.cancel")}
                            </button>
                          )}
                          {retryable && (
                            <button
                              data-aihub-action="retry-managed-download"
                              onClick={() => onRetryManagedDownloadTask(task.productId)}
                            >
                              {uiText("downloadQueue.retry")}
                            </button>
                          )}
                          {percent !== null && downloading && (
                            <div
                              className="managedDownloadProgress"
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.max(0, Math.min(100, percent))}
                              aria-label={uiText("downloadQueue.progress", { value1: productName, value2: progressLabel })}
                            >
                              <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}
                {filteredDesktopOperations.map((task) => {
                  const terminal =
                    task.phase === "installed" ||
                    task.phase === "uninstalled" ||
                    task.phase === "canceled" ||
                    task.phase === "failed";
                  return (
                    <div
                      className="managedOperationTask"
                      key={`desktop:${task.productId}:${task.generation}`}
                      data-product-id={task.productId}
                      data-task-state={desktopTaskState(task)}
                    >
                      <div>
                        <b>
                          {operationTaskNames[task.productId] || task.productId}
                          {task.operation === "install" ? uiText("auto.f4e5f66e2b69") : uiText("auto.2ae4aad83e79")}
                        </b>
                        <small>
                          {operationTaskPhaseLabel(task.operation, task.phase)}
                        </small>
                      </div>
                      {!terminal && task.phase !== "launching" && (
                        <button
                          onClick={() =>
                            onCheckDesktopOperationTask(task.productId)
                          }
                        >
                          {uiText("auto.14ca09ce1fd2")}</button>
                      )}
                      {task.lastError && <em>{runtimeMessage(task.lastError, undefined, task.operation === "uninstall" ? "desktop.uninstallFailed" : "desktop.installFailed")}</em>}
                    </div>
                  );
                })}
                {filteredEnvironmentOperations.map((task) => {
                  const terminal =
                    task.phase === "installed" ||
                    task.phase === "uninstalled";
                  const productId = `environment:${task.environmentId}`;
                  return (
                    <div
                      className="managedOperationTask"
                      key={`${productId}:${task.generation}`}
                      data-product-id={productId}
                      data-task-state={environmentTaskState(task)}
                    >
                      <div>
                        <b>
                          {operationTaskNames[productId] || task.environmentId}
                          {task.operation === "install" ? uiText("auto.f4e5f66e2b69") : uiText("auto.2ae4aad83e79")}
                        </b>
                        <small>
                          {operationTaskPhaseLabel(task.operation, task.phase)}
                        </small>
                      </div>
                      {!terminal && task.phase !== "launching" && (
                        <button
                          onClick={() =>
                            onCheckEnvironmentOperationTask(task.environmentId)
                          }
                        >
                          {uiText("auto.14ca09ce1fd2")}</button>
                      )}
                      {task.lastError && <em>{task.lastError}</em>}
                    </div>
                  );
                })}
                {filteredCliTasks.map((task) => {
                  const terminal = task.phase !== "running";
                  const retryable =
                    task.phase === "failed" || task.phase === "canceled";
                  const logs = cliLogs[task.productId] || [];
                  return (
                    <div
                      className="managedOperationTask"
                      key={`cli:${task.productId}:${task.generation}`}
                      data-product-id={task.productId}
                      data-task-state={cliTaskState(task)}
                    >
                      <div>
                        <b>
                          {operationTaskNames[task.productId] || task.productId}
                          {task.operation === "update"
                            ? ` · ${uiText("cli.update")}`
                            : task.operation === "repair"
                              ? ` · ${uiText("cli.repair")}`
                              : task.operation === "install"
                                ? uiText("auto.c95b0c24780b")
                                : uiText("auto.228b82046736")}
                        </b>
                        <small>{cliTaskPhaseLabel(task)}</small>
                      </div>
                      {terminal && (
                        <div className="managedTaskActions">
                          {retryable && (
                            <>
                              <button
                                onClick={() =>
                                  onRetryCliManagedTask(task.productId)
                                }
                              >
                                {uiText("auto.b8784c8dd563")}</button>
                              <button
                                onClick={() =>
                                  onRecheckCliManagedTask(task.productId)
                                }
                              >
                                {uiText("auto.a13550662fea")}</button>
                            </>
                          )}
                          <button
                            onClick={() =>
                              onClearCliManagedTask(task.productId)
                            }
                          >
                            {uiText("auto.bce2377283c2")}</button>
                        </div>
                      )}
                      {task.message && <em>{runtimeMessage(task.message)}</em>}
                      {logs.length > 0 && (
                        <details className="managedCliTaskLog">
                          <summary>{uiText("auto.72c17219da64")}{logs.length}）</summary>
                          <div>
                            {logs.map((entry, index) => (
                              <span
                                className={entry.stream}
                                key={`${index}-${entry.line}`}
                              >
                                {entry.line}
                              </span>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
                {filteredDownloadTasks.map((task) => {
                  const changing =
                    task.phase === "pausing" || task.phase === "canceling";
                  const canPause =
                    task.phase === "starting" || task.phase === "downloading";
                  const canResume =
                    task.phase === "paused" ||
                    (task.phase === "failed" && task.resumable);
                  const canRetry = task.phase === "failed" && !task.resumable;
                  const canDelete = task.phase === "failed";
                  const percent =
                    task.progress.percent === null
                      ? ""
                      : ` · ${task.progress.percent}%`;
                  return (
                    <div
                      key={task.productId}
                      data-product-id={task.productId}
                      data-task-state={downloadTaskState(task)}
                    >
                      <div>
                        <b>
                          {downloadTaskNames[task.productId] || task.productId}
                        </b>
                        <small>
                          {managedDownloadPhaseLabel(task)}
                          {percent}
                        </small>
                      </div>
                      {(canPause || canResume || canRetry) && (
                        <button
                          disabled={changing}
                          onClick={() =>
                            canPause
                              ? onPauseDownloadTask(task.productId)
                              : onResumeDownloadTask(task.productId)
                          }
                        >
                          {canPause
                            ? uiText("auto.8d12fc0d4eb2")
                            : canRetry
                              ? uiText("download.retry")
                              : uiText("auto.7c9691192f1b")}
                        </button>
                      )}
                      {!["completed", "canceled", "failed"].includes(task.phase) && (
                        <button
                          disabled={changing}
                          onClick={(event) => onCancelDownloadTask(task.productId, event.currentTarget)}
                        >
                          {task.phase === "canceling"
                            ? uiText("auto.e8e08b0f61dd")
                            : uiText("auto.185a34ac72db")}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          disabled={changing}
                          onClick={(event) => onCancelDownloadTask(task.productId, event.currentTarget)}
                        >
                          {uiText("auto.bce2377283c2")}
                        </button>
                      )}
                      {task.phase === "completed" && (
                        <>
                          {installableDownloadIds.has(task.productId) && (
                            <button
                              onClick={() =>
                                onOpenCompletedDownloadTask(task.productId)
                              }
                            >
                              {uiText("auto.1c9b810ab5b0")}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              onShowDownloadInFolder(task.productId)
                            }
                          >
                            {uiText("auto.064fc3c848b0")}</button>
                          <button
                            onClick={() =>
                              onClearDownloadHistory(task.productId)
                            }
                          >
                            {uiText("auto.c7b8aba1d148")}</button>
                        </>
                      )}
                      {task.progress.percent !== null &&
                        task.phase !== "completed" && (
                          <div className="managedDownloadProgress">
                            <i
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(100, task.progress.percent)
                                )}%`
                              }}
                            />
                          </div>
                        )}
                      {task.errorMessage && <em>{managedDownloadErrorLabel(task)}</em>}
                    </div>
                  );
                })}
              </>
            ) : (
              <p>
                {taskFilter === "active"
                  ? uiText("auto.ce57756d6012")
                  : taskFilter === "failed"
                    ? uiText("auto.a250b57662b6")
                    : uiText("auto.4407ef33f81e")}
              </p>
            )}
          </div>
        </SettingBlock>

        <SettingBlock title={uiText("auto.52418c918084")}>
          <p className="pathValue">
            {cliInstallDirectory || uiText("auto.f46842f98326")}
          </p>
          <div className="rowActions">
            <button
              onClick={() => {
                setCliDirectoryError("");
                onChooseCliDirectory();
              }}
            >
              {uiText("auto.38418cc70d55")}
            </button>
            <button
              disabled={!cliInstallDirectory}
              onClick={() => {
                void onOpenCliDirectory().then((opened) => {
                  setCliDirectoryError(
                    opened ? "" : uiText("settings.cliFolderFailed")
                  );
                });
              }}
            >
              {uiText("settings.openFolder")}
            </button>
          </div>
          {cliDirectoryError && <em>{cliDirectoryError}</em>}
        </SettingBlock>

        <SettingBlock title={uiText("auto.68ecdf839c52")}>
          <button className="scanButton" onClick={onScan} disabled={scanning}>
            {scanning ? uiText("auto.3a1abf3422d2") : uiText("auto.aab6c5f64108")}
          </button>
          {environment && (
            <div className="environmentList">
              {(environment.displayChecks || environment.checks).map((check) => {
                const updateEnvironmentId =
                  check.updateEnvironmentId || check.id;
                const environmentStage =
                  environmentPackageStages[check.id];
                const updateStage =
                  environmentPackageStages[updateEnvironmentId];
                const actionStage =
                  check.installed && check.canUpdate
                    ? updateStage
                    : environmentStage;
                const environmentDownloadTask =
                  downloadTasks[
                    `environment:${
                      check.installed && check.canUpdate
                        ? updateEnvironmentId
                        : check.id
                    }`
                  ];
                const operationBusy =
                  environmentStageIsBusy(environmentStage) ||
                  environmentStageIsBusy(updateStage);
                const operationNeedsCheck =
                  environmentStageNeedsCheck(environmentStage);
                const updateReady = updateStage === "ready";
                return (
                  <div className="environmentItem" key={check.id}>
                    <span
                      className={check.installed ? "statusDot ok" : "statusDot"}
                    />
                    <div className="environmentItemMain">
                      <b>{check.name}</b>
                      <small className={check.canUpdate ? "environmentItemState update" : "environmentItemState"}>
                        {check.installed
                          ? check.canUpdate
                            ? uiText("environment.updateAvailable")
                            : uiText("auto.a8b6c39dcabf")
                          : check.detection === "unknown"
                            ? uiText("auto.89a7e9d49a47")
                            : uiText("auto.156219e305f6")}
                      </small>
                    </div>
                    <div className="environmentItemActions">
                      {check.installed ? (
                        <>
                          {check.canUpdate && (
                            <button
                              className="accentButton"
                              data-aihub-action="update-environment"
                              data-aihub-update-environment-id={updateEnvironmentId}
                              disabled={operationBusy}
                              onClick={() =>
                                updateReady
                                  ? onOpenEnvironmentUpdater(updateEnvironmentId)
                                  : onUpdateEnvironment(updateEnvironmentId)
                              }
                            >
                              {environmentInstallButtonLabel(
                                actionStage,
                                check.name,
                                uiText("environment.update")
                              )}
                            </button>
                          )}
                          <button
                            disabled={!check.location || operationBusy}
                            onClick={() => onOpenEnvironmentLocation(check.id)}
                          >
                            {uiText("auto.9a0ea4b1177d")}</button>
                          <button
                            disabled={
                              operationBusy ||
                              (!operationNeedsCheck && !check.canUninstall)
                            }
                            title={
                              operationNeedsCheck
                                ? uiText("auto.ee268c8851e5")
                                : check.canUninstall
                                  ? uiText("auto.c9667f9ac158")
                                  : uiText("auto.d4b02f63b3b8")
                            }
                            onClick={() => onUninstallEnvironment(check.id)}
                          >
                            {environmentUninstallButtonLabel(environmentStage)}
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={
                            operationBusy &&
                            environmentStage !== "downloading"
                          }
                          onClick={() =>
                            environmentStage === "ready"
                              ? onOpenEnvironmentInstaller(check.id)
                              : onInstallEnvironment(check.id)
                          }
                        >
                          {environmentInstallButtonLabel(
                            environmentStage,
                            check.name,
                            uiText("auto.4a34bde479c3")
                          )}
                        </button>
                      )}
                      {!check.installed &&
                        environmentDownloadTask &&
                        !["completed", "canceled"].includes(
                          environmentDownloadTask.phase
                        ) && (
                          <button
                            disabled={
                              environmentDownloadTask.phase === "canceling"
                            }
                            onClick={(event) =>
                              onCancelDownloadTask(environmentDownloadTask.productId, event.currentTarget)
                            }
                          >
                            {environmentDownloadTask.phase === "canceling"
                              ? uiText("auto.e36f3187b31a")
                              : uiText("auto.6afefc66ccdd")}
                          </button>
                        )}
                    </div>
                    {check.canUpdate && check.recommendedVersion && (
                      <small className="environmentItemRecommendation">
                        {uiText("environment.recommendedVersion", {
                          value1: check.recommendedVersion
                        })}
                      </small>
                    )}
                    {environmentMessages[
                      check.canUpdate ? updateEnvironmentId : check.id
                    ] && (
                      <em className="environmentItemMessage">
                        {runtimeMessage(
                          environmentMessages[
                            check.canUpdate ? updateEnvironmentId : check.id
                          ]
                        )}
                      </em>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SettingBlock>

        <SettingBlock title={createLanguage(language).text("settings.language")}>
          <div className="segmented">
            <button className={language === "zh" ? "active" : ""} onClick={() => onLanguage("zh")}>
              {createLanguage(language).text("settings.language.zh")}
            </button>
            <button className={language === "en" ? "active" : ""} onClick={() => onLanguage("en")}>
              {createLanguage(language).text("settings.language.en")}
            </button>
          </div>
        </SettingBlock>
      </aside>
    </Drawer>
  );
}

function SettingBlock({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settingBlock">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function VendorMark({
  vendor,
  large = false,
  hero = false
}: {
  vendor: Vendor;
  large?: boolean;
  hero?: boolean;
}) {
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => setIconFailed(false), [vendor.iconUrl]);

  return (
    <span
      className={`vendorMark${large ? " large" : ""}${hero ? " heroMark" : ""}`}
      style={{
        background: "#fff"
      }}
    >
      {vendor.iconUrl && !iconFailed ? (
        <img
          src={vendor.iconUrl}
          alt=""
          loading={hero ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setIconFailed(true)}
        />
      ) : (
        vendor.mark
      )}
    </span>
  );
}
