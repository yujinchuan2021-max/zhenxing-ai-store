import {
  createElement,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { runEnvironmentInstall } from "@aihub-shared/environment-install-flow.cjs";
import { runDownloadedPackageAction } from "@aihub-shared/downloaded-package-action.cjs";
import { buildInstalledProductManagement } from "@aihub-shared/installed-product-management.cjs";
import { getProductInstallPresentation } from "@aihub-shared/product-install-presentation.cjs";
import { resolveProductBehavior } from "@aihub-shared/product-policy.cjs";
import { getUninstallPresentation } from "@aihub-shared/uninstall-presentation.cjs";
import {
  createLanguage,
  normalizeLanguage,
  setActiveLanguage,
  uiText,
  type Language
} from "./language";
import {
  categories,
  Product,
  ProductCategory,
  ProductKind,
  Vendor,
  vendors as builtInVendors
} from "./data";

type View = "home" | "vendors" | "community" | "management" | "account";
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
type CliManagedTask = {
  productId: string;
  generation: number;
  operation: "deploy" | "uninstall";
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

function operationTaskPhaseLabel(
  operation: "install" | "uninstall",
  phase: DesktopOperationTask["phase"] | EnvironmentOperationTask["phase"]
) {
  if (phase === "installed") return uiText("auto.57cf47f232a8");
  if (phase === "uninstalled") return uiText("auto.caa61a1470e1");
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
  if (task.phase === "running") {
    return task.operation === "deploy" ? uiText("auto.c16fe800ef5d") : uiText("auto.3a3d21968447");
  }
  if (task.phase === "completed") {
    return task.operation === "deploy" ? uiText("auto.53f17e6ef17f") : uiText("auto.6a075107a270");
  }
  if (task.phase === "canceled") return uiText("auto.9596d1ac92cd");
  return task.operation === "deploy" ? uiText("auto.29d1d9dff3c7") : uiText("auto.7274d68dcc45");
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
  python: "Python",
  docker: "Docker"
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
    { id: "docker", name: "Docker", installed: false, location: "" }
  ]
};

const builtInBanners: CatalogBanner[] = [
  {
    eyebrow: "AI HUB · PC",
    title: "一个地方，找到并安装你的 AI 工具",
    description:
      "从厂商进入，查看桌面端、CLI 与其他产品；只有点击安装后才进行环境检测。",
    action: "查看全部厂商"
  },
  {
    eyebrow: "厂商优先",
    title: "先选厂商，再看它旗下的全部产品",
    description:
      "按 A–Z 和工具特性筛选厂商，进入厂商页后统一查看产品、官网与使用教程。",
    action: "进入厂商目录"
  }
];
const builtInBrand: CatalogBrand = {
  name: "AI Hub",
  mark: "A",
  slogan: "一个地方，找到并安装你的 AI 工具"
};
export default function App() {
  const [catalogVendors, setCatalogVendors] =
    useState<Vendor[]>(builtInVendors);
  const [homeBanners, setHomeBanners] =
    useState<CatalogBanner[]>(builtInBanners);
  const [brand, setBrand] = useState<CatalogBrand>(builtInBrand);
  const [extraSections, setExtraSections] = useState<CatalogExtraSection[]>([]);
  const [featuredVendorIds, setFeaturedVendorIds] = useState<string[]>([]);
  const [view, setView] = useState<View>("home");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"全部" | ProductCategory>("全部");
  const [letter, setLetter] = useState("全部");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [identity, setIdentity] = useState<IdentitySnapshot>({
    status: "anonymous"
  });
  const [personalCenter, setPersonalCenter] =
    useState<PersonalCenterSnapshot | null>(null);
  const [accountInitialTab, setAccountInitialTab] =
    useState<PersonalCenterTab>("profile");
  const [communityTargetPath, setCommunityTargetPath] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState<Language>("zh");
  const [downloadDirectory, setDownloadDirectory] = useState("");
  const [cliInstallDirectory, setCliInstallDirectory] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
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
  const productOperationGenerations = useRef<Record<string, number>>({});
  const downloadTaskRevisions = useRef<Record<string, number>>({});
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
  const recoveredCliIds = useRef<Set<string>>(new Set());
  const activeProductActions = useRef<Set<string>>(new Set());
  const autoLaunchInstallerProducts = useRef<Set<string>>(new Set());

  const languageModule = useMemo(() => createLanguage(language), [language]);
  const t = {
    home: languageModule.text("nav.home"),
    vendors: languageModule.text("nav.vendors"),
    community: languageModule.text("nav.community"),
    navigation: languageModule.text("nav.navigation"),
    searchPlaceholder: languageModule.text("nav.searchPlaceholder"),
    search: languageModule.text("nav.search"),
    settings: languageModule.text("nav.settings"),
    login: languageModule.text("nav.login")
  };
  const letters = [
    uiText("auto.5c55a67935af"),
    ...[...new Set(catalogVendors.map((vendor) => vendor.initial))].sort()
  ];
  const downloadTaskNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const vendor of catalogVendors) {
      for (const product of vendor.products) {
        names[product.id] = product.name;
      }
    }
    for (const [environmentId, name] of Object.entries(ENVIRONMENT_NAMES)) {
      names[`environment:${environmentId}`] = uiText("auto.07990042ef55", { value1: name });
    }
    return names;
  }, [catalogVendors]);
  const installedManagement = useMemo(
    () =>
      buildInstalledProductManagement({
        vendors: catalogVendors,
        desktopStatuses,
        cliStatuses,
        environmentChecks: environment?.checks || [],
        downloadTasks
      }),
    [
      catalogVendors,
      desktopStatuses,
      cliStatuses,
      environment,
      downloadTasks
    ]
  );
  const operationTaskNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const vendor of catalogVendors) {
      for (const product of vendor.products) {
        names[product.id] = product.name;
      }
    }
    for (const [environmentId, name] of Object.entries(ENVIRONMENT_NAMES)) {
      names[`environment:${environmentId}`] = uiText("auto.2201a196b4ed", { value1: name });
    }
    return names;
  }, [catalogVendors]);

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

  const applyManagedDownloadTask = (task: ManagedDownloadTask) => {
    const knownRevision = downloadTaskRevisions.current[task.productId] || 0;
    if (task.revision < knownRevision) return;
    downloadTaskRevisions.current[task.productId] = task.revision;
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
      return;
    }

    if (task.phase === "canceled") {
      autoLaunchInstallerProducts.current.delete(task.productId);
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
      autoLaunchInstallerProducts.current.delete(task.productId);
      setProductErrors((current) => ({
        ...current,
        [task.productId]: task.errorMessage || uiText("auto.8a03e35ad323")
      }));
      setProductStages((current) => ({
        ...current,
        [task.productId]: "error"
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
    if (task.operation === "uninstall") {
      const uninstallCopy = getUninstallPresentation(
        task.desktopStatus?.uninstallMode ??
          desktopStatuses[task.productId]?.uninstallMode
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
    const products = catalogVendors.flatMap((vendor) => vendor.products);
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

  const applyEnvironmentOperationTask = (task: EnvironmentOperationTask) => {
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
      for (const product of catalogVendors.flatMap(
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
      void refreshEnvironmentReport(false);
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
            applyEnvironmentOperationTask(operationTask);
          }
        } catch {
          recoveredEnvironmentIds.current.delete(environmentId);
        }
      })();
    }
    // A completion event may have fired before this renderer subscribed.
    // One trusted startup scan reconciles a tombstoned operation without
    // reopening any installer.
    void refreshEnvironmentReport(false);
  }, []);

  useEffect(() => {
    if (!window.aihubPC) return;
    catalogVendors
      .flatMap((vendor) => vendor.products)
      .filter((product) => product.download)
      .forEach((product) => {
        if (recoveredProductIds.current.has(product.id)) return;
        recoveredProductIds.current.add(product.id);
        void (async () => {
          try {
            if (product.download) {
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
            let desktopStatus: DesktopStatus | null = null;
            try {
              desktopStatus = await window.aihubPC!.getDesktopStatus(product.id);
            } catch {
              desktopStatus = null;
            }
            if (operationTask?.operation === "uninstall") {
              applyDesktopOperationTask(operationTask);
            } else if (desktopStatus?.installed) {
              installedEvidenceProducts.current.add(product.id);
              setDesktopStatuses((current) => ({
                ...current,
                [product.id]: desktopStatus!
              }));
              setProductErrors((current) => ({
                ...current,
                [product.id]: ""
              }));
              setProductStages((current) => ({
                ...current,
                [product.id]: "installed"
              }));
            } else if (operationTask) {
              applyDesktopOperationTask(operationTask);
            } else if (desktopStatus) {
              setDesktopStatuses((current) => ({
                ...current,
                [product.id]: desktopStatus!
              }));
            }
          } catch {
            // A damaged local record must not block recovery for other products.
            recoveredProductIds.current.delete(product.id);
          }
        })();
      });
  }, [catalogVendors]);

  useEffect(() => {
    if (!window.aihubPC) return;
    catalogVendors
      .flatMap((vendor) => vendor.products)
      .filter((product) => resolveProductBehavior(product).managedCli)
      .forEach((product) => {
        if (recoveredCliIds.current.has(product.id)) return;
        recoveredCliIds.current.add(product.id);
        void window.aihubPC!
          .getCliStatus(product.id)
          .then((status) => {
            if (
              !status ||
              !["installed", "absent", "unknown"].includes(status.detection)
            ) {
              recoveredCliIds.current.delete(product.id);
              return;
            }
            setCliStatuses((current) => ({
              ...current,
              [product.id]: status
            }));
            setCliVersions((current) => ({
              ...current,
              [product.id]: status.installed ? status.version : ""
            }));
            setProductStages((current) => {
              if (
                current[product.id] === "deploying" ||
                current[product.id] === "removing-cli"
              ) {
                return current;
              }
              return {
                ...current,
                [product.id]:
                  status.detection === "unknown"
                    ? "detection-error"
                    : status.installed
                      ? "installed"
                      : current[product.id] === "installed" ||
                          current[product.id] === "detection-error"
                        ? "ready"
                        : current[product.id] || "idle"
              };
            });
            setProductErrors((current) => ({
              ...current,
              [product.id]:
                status.detection === "unknown"
                  ? uiText("auto.365fe0e4894c")
                  : ""
            }));
          })
          .catch(() => {
            recoveredCliIds.current.delete(product.id);
          });
      });
  }, [catalogVendors]);

  useEffect(() => {
    window.aihubPC?.getCatalog().then((result) => {
      if (!result.catalog) return;
      setCatalogVendors(
        result.catalog.vendors
          .filter((vendor) => vendor.enabled !== false)
          .map((vendor) => ({
            ...vendor,
            products: vendor.products
              .filter((product) => product.enabled !== false)
              .sort(
                (left, right) =>
                  (left.order ?? 0) - (right.order ?? 0) ||
                  left.name.localeCompare(right.name, "zh-CN")
              )
          }))
          .sort(
            (left, right) =>
              (left.order ?? 0) - (right.order ?? 0) ||
              left.name.localeCompare(right.name, "zh-CN")
          )
      );
      if (result.catalog.brand) setBrand(result.catalog.brand);
      setExtraSections(result.catalog.extraSections || []);
      if (result.catalog.home) {
        setHomeBanners(result.catalog.home.banners);
        setFeaturedVendorIds(result.catalog.home.featuredVendorIds);
      }
    });
  }, []);

  useEffect(() => {
    return window.aihubPC?.onDownloadTask?.((task) => {
      applyManagedDownloadTask(task);
    });
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
      const vendor = catalogVendors.find((candidate) =>
        candidate.products.some((product) => product.id === target.productId)
      );
      if (!vendor) {
        setSettingsOpen(true);
        return;
      }
      setSettingsOpen(false);
      setView("vendors");
      setSelectedVendor(vendor);
    });
    return typeof dispose === "function" ? dispose : undefined;
  }, [catalogVendors]);

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
    const normalized = search.trim().toLowerCase();
    return catalogVendors
      .filter((vendor) => {
        const categoryProducts = vendor.products.filter(
          (product) => category === "全部" || product.category === category
        );
        if (!categoryProducts.length) return false;
        if (letter !== "全部" && vendor.initial !== letter) return false;
        if (!normalized) return true;
        return (
          `${vendor.name} ${vendor.description}`
            .toLowerCase()
            .includes(normalized) ||
          categoryProducts.some((product) =>
            `${product.name} ${product.description}`
              .toLowerCase()
              .includes(normalized)
          )
        );
      })
      .sort(
        (left, right) =>
          left.initial.localeCompare(right.initial, "en") ||
          left.name.localeCompare(right.name, "zh-CN")
      );
  }, [catalogVendors, category, letter, search]);

  const navigate = (next: View) => {
    setSelectedVendor(null);
    setView(next);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSelectedVendor(null);
    setView("vendors");
  };

  const chooseDownloadDirectory = async () => {
    const settings = window.aihubPC
      ? await window.aihubPC.chooseDownloadDirectory()
      : {
          downloadDirectory: "D:\\AI Hub\\Downloads",
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
    try {
      const result = await window.aihubPC.startDownload(productId);
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

  const cancelDownloadTask = async (productId: string) => {
    if (!window.aihubPC) return;
    try {
      const result = await window.aihubPC.cancelDownload(productId);
      if (result.task) applyManagedDownloadTask(result.task);
      if (!result.ok && !result.canceled) {
        setDownloadTaskError(
          productId,
          result.error || result.task?.errorMessage || uiText("auto.1768ce955e7d")
        );
      }
    } catch (error) {
      setDownloadTaskError(
        productId,
        error instanceof Error ? error.message : uiText("auto.1768ce955e7d")
      );
    }
  };

  const openCompletedDownloadTask = async (productId: string) => {
    if (productId.startsWith("environment:")) {
      const environmentId = productId.slice("environment:".length);
      const snapshot = await window.aihubPC?.getEnvironmentPackage?.(
        environmentId
      );
      if (snapshot?.ready) await openEnvironmentInstaller(environmentId);
      else await installEnvironment(environmentId);
      return;
    }
    const product = catalogVendors
      .flatMap((vendor) => vendor.products)
      .find((candidate) => candidate.id === productId);
    if (!product) {
      setDownloadTaskError(productId, uiText("auto.0174b6fcadff"));
      return;
    }
    await installDownloadedProduct(product);
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
    downloadTaskRevisions.current[productId] = 0;
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
    setProductStages((current) => ({
      ...current,
      [productId]:
        current[productId] === "downloaded" ? "idle" : current[productId]
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
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]:
          error instanceof Error ? error.message : uiText("auto.633a7cff13e6")
      }));
    }
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
    if (task && task.phase !== "canceled") {
      applyManagedDownloadTask(task);
      if (forceOperationCompletion && task.phase === "completed") {
        setProductStages((current) => ({
          ...current,
          [productId]: "downloaded"
        }));
      }
      return task.phase === "completed" ? "downloaded" : "active";
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
    product: Product
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
        setProductStages((current) => ({
          ...current,
          [product.id]:
            current[product.id] === "awaiting-uninstall"
              ? "awaiting-uninstall"
              : "installed"
        }));
        return "installed";
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
    autoLaunchInstaller = false
  ) => {
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
    if (autoLaunchInstaller) {
      autoLaunchInstallerProducts.current.add(product.id);
    }
    try {
      const result = await window.aihubPC.startDownload(product.id);
      if (result.task) applyManagedDownloadTask(result.task);
      if (!result.ok) {
        autoLaunchInstallerProducts.current.delete(product.id);
        setProductErrors((current) => ({
          ...current,
          [product.id]: result.error || uiText("auto.8d0943c7356b")
        }));
        if (!result.task) {
          setProductStages((current) => ({
            ...current,
            [product.id]: "error"
          }));
        }
      }
    } catch (error) {
      autoLaunchInstallerProducts.current.delete(product.id);
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error ? error.message : uiText("auto.8d0943c7356b")
      }));
      setProductStages((current) => ({
        ...current,
        [product.id]: "error"
      }));
    }
  };

  const pauseProductDownload = async (product: Product) => {
    await pauseDownloadTask(product.id);
  };

  const cancelProductDownload = async (product: Product) => {
    await cancelDownloadTask(product.id);
  };

  const relocateProductDownload = async (product: Product) => {
    if (!window.aihubPC) return;
    const selection = await chooseDownloadDirectory();
    if (selection.selectionCanceled || !selection.downloadDirectory) {
      return;
    }
    try {
      const canceled = await window.aihubPC.cancelDownload(product.id);
      if (canceled.task) applyManagedDownloadTask(canceled.task);
      if (canceled.canceled) return;
      if (!canceled.ok) {
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            canceled.error ||
            canceled.task?.errorMessage ||
            uiText("auto.15031d50cadb")
        }));
        return;
      }
      await downloadProduct(product);
    } catch (error) {
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error
            ? error.message
            : uiText("auto.c0f112918b7c")
      }));
    }
  };

  const installProduct = async (product: Product) => {
    if (!window.aihubPC) return;
    setProductErrors((current) => ({ ...current, [product.id]: "" }));
    setProductStages((current) => ({
      ...current,
      [product.id]: "launching-installer"
    }));
    try {
      const inspection = await window.aihubPC.inspectInstaller(product.id);
      if (!inspection.ok) {
        setProductErrors((current) => ({
          ...current,
          [product.id]: inspection.error || uiText("auto.b5eece942d25")
        }));
        setProductStages((current) => ({ ...current, [product.id]: "error" }));
        return;
      }
      const result = await window.aihubPC.launchInstaller(product.id);
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
          [product.id]: "downloaded"
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
          [product.id]: "downloaded"
        }));
        return;
      }
      if (!result.operationTask) {
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
        [product.id]: preserveInstallationStage(
          current[product.id],
          "downloaded"
        )
      }));
    }
  };

  const installDownloadedProduct = async (product: Product) => {
    if (!window.aihubPC) return;
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
          await installProduct(product);
        },
        download: async () => {
          setProductFiles((current) => {
            const next = { ...current };
            delete next[product.id];
            return next;
          });
          await downloadProduct(product, true);
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

  useEffect(() => {
    for (const task of Object.values(downloadTasks)) {
      if (
        task.phase !== "completed" ||
        !autoLaunchInstallerProducts.current.delete(task.productId)
      ) {
        continue;
      }
      const product = catalogVendors
        .flatMap((vendor) => vendor.products)
        .find((candidate) => candidate.id === task.productId);
      if (product) {
        void installProduct(product);
      }
    }
  }, [catalogVendors, downloadTasks]);

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
    const uninstallCopy = getUninstallPresentation(
      desktopStatuses[product.id]?.uninstallMode
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
            getUninstallPresentation(result.uninstallMode).launched
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
          : getUninstallPresentation(status.uninstallMode).stillInstalled
    }));
    setProductStages((current) => ({
      ...current,
      [product.id]: "awaiting-uninstall"
    }));
  };

  const checkDesktopOperationTask = async (productId: string) => {
    const product = catalogVendors
      .flatMap((vendor) => vendor.products)
      .find((candidate) => candidate.id === productId);
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

  const findCatalogProduct = (productId: string) => {
    for (const vendor of catalogVendors) {
      const product = vendor.products.find((item) => item.id === productId);
      if (product) return product;
    }
    return null;
  };

  const chooseCliDirectory = async () => {
    const settings = window.aihubPC
      ? await window.aihubPC.chooseCliDirectory()
      : { downloadDirectory: "", cliInstallDirectory: "D:\\AI Hub\\CLI" };
    setCliInstallDirectory(settings.cliInstallDirectory || "");
    return settings.cliInstallDirectory || "";
  };

  const deployCli = async (product: Product) => {
    let directory = cliInstallDirectory;
    if (!directory) directory = await chooseCliDirectory();
    if (!directory || !window.aihubPC) return;

    const generation = beginProductOperation(product.id);
    updateCliManagedTask(
      product.id,
      generation,
      "deploy",
      "running",
      uiText("auto.514d92d737e1")
    );
    setProductErrors((current) => ({ ...current, [product.id]: "" }));
    setCliLogs((current) => ({ ...current, [product.id]: [] }));
    setProductStages((current) => ({ ...current, [product.id]: "deploying" }));
    let result: CliDeployResult;
    try {
      result = await window.aihubPC.deployCli(product.id);
    } catch (error) {
      if (!isCurrentProductOperation(product.id, generation)) return;
      updateCliManagedTask(
        product.id,
        generation,
        "deploy",
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
        "deploy",
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
        "deploy",
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
        "deploy",
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
        "deploy",
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
      "deploy",
      "completed",
      result.warning || uiText("auto.60482f487ebd", { value1: product.name })
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
          uiText("auto.f2191c77d0e6", { value1: product.name })
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
          uiText("auto.f2191c77d0e6", { value1: product.name })
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
      uiText("auto.f2191c77d0e6", { value1: product.name })
    );
    setProductStages((current) => ({ ...current, [product.id]: "ready" }));
  };

  const recheckCliManagedTask = async (productId: string) => {
    const task = cliManagedTasks[productId];
    const product = findCatalogProduct(productId);
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
      (task.operation === "deploy" && status.installed) ||
      (task.operation === "uninstall" && status.detection === "absent");
    if (completed) {
      const message =
        task.operation === "deploy"
          ? uiText("auto.0c14c44b2527", { value1: product.name })
          : uiText("auto.32422ac50536", { value1: product.name });
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
        : task.operation === "deploy"
          ? uiText("auto.0212bbe4a6ca", { value1: product.name })
          : uiText("auto.64cea3af67fd", { value1: product.name });
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
    const product = findCatalogProduct(productId);
    if (!task || !product || !window.aihubPC || task.phase === "running") return;
    if (task.operation === "deploy") {
      await deployCli(product);
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
    setTheme(next);
    document.documentElement.dataset.theme = next;
  };

  const changeLanguage = (next: Language) => {
    setActiveLanguage(next);
    setLanguage(next);
    document.documentElement.lang = createLanguage(next).documentLocale;
    void window.aihubPC?.setLanguage(next);
  };

  const checkForUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateInstallMessage("");
    try {
      const result = window.aihubPC
        ? await window.aihubPC.checkForUpdate()
        : {
            status: "disabled" as const,
            currentVersion: "0.1.0",
            message: uiText("auto.92ae7c88cf13")
          };
      setUpdateResult(result);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    if (!window.aihubPC || installingUpdate) return;
    setInstallingUpdate(true);
    setUpdateInstallMessage(uiText("auto.699599ce3495"));
    try {
      const result = await window.aihubPC.openUpdateDownload();
      if (result.ok) {
        setUpdateInstallMessage(
          result.warning
            ? uiText("auto.a129621fd2d5", { value1: result.warning })
            : uiText("auto.79e4bb930e5c")
        );
        return;
      }
      setUpdateInstallMessage(result.error || uiText("auto.d308fd9d9d27"));
    } catch (error) {
      setUpdateInstallMessage(
        error instanceof Error ? error.message : uiText("auto.d308fd9d9d27")
      );
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

  const installUsingUnifiedRule = async (product: Product) => {
    const behavior = resolveProductBehavior(product);
    if (!behavior.managedCli && !behavior.managedDesktop) {
      window.open(behavior.directUrl);
      return;
    }

    const continueInstall = async (preparation: ProductPreparation) => {
      if (preparation === "downloaded") {
        await installDownloadedProduct(product);
        return;
      }
      if (preparation !== "ready") return;
      if (behavior.managedCli) {
        await deployCli(product);
        return;
      }
      await downloadProduct(product, true);
    };

    const currentStage = productStages[product.id] || "idle";
    if (currentStage === "downloaded") {
      await installDownloadedProduct(product);
      return;
    }
    if (currentStage === "ready") {
      await continueInstall("ready");
      return;
    }
    if (currentStage === "paused" && behavior.managedDesktop) {
      await downloadProduct(product, true);
      return;
    }
    await continueInstall(await detectForProduct(product));
  };

  const requestUnifiedInstall = (product: Product) =>
    runExclusiveProductAction(product.id, uiText("auto.e8f88f51ccb0"), () =>
      installUsingUnifiedRule(product)
    );

  const requestCliUninstall = (product: Product) =>
    runExclusiveProductAction(product.id, uiText("auto.80d0f7903461"), () =>
      uninstallCli(product)
    );
  const requestDesktopUninstall = (product: Product) =>
    runExclusiveProductAction(product.id, uiText("auto.06bc14b60f35"), () =>
      uninstallDesktopProduct(product)
    );

  const refreshInstalledManagement = async () => {
    if (!window.aihubPC) return;
    setScanning(true);
    try {
      const products = catalogVendors.flatMap((vendor) => vendor.products);
      await Promise.allSettled([
        refreshEnvironmentReport(false),
        ...products
          .filter(
            (product) => resolveProductBehavior(product).managedDesktop
          )
          .map(async (product) => {
            const status = await window.aihubPC!.getDesktopStatus(product.id);
            setDesktopStatuses((current) => ({
              ...current,
              [product.id]: status
            }));
          }),
        ...products
          .filter((product) => resolveProductBehavior(product).managedCli)
          .map(async (product) => {
            const status = await window.aihubPC!.getCliStatus(product.id);
            setCliStatuses((current) => ({
              ...current,
              [product.id]: status
            }));
          })
      ]);
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
    const opened =
      entry.type === "environment"
        ? await window.aihubPC.openEnvironmentLocation(
            entry.id.slice("environment:".length)
          )
        : entry.type === "cli"
          ? await window.aihubPC.openCliLocation(entry.id)
          : await window.aihubPC.openDesktopLocation(entry.id);
    if (!opened) setManagementMessage(entry.id, uiText("auto.f76d02f1aa1e"));
  };

  const uninstallManagedProduct = async (
    entry: (typeof installedManagement.products)[number]
  ) => {
    if (entry.type === "environment") {
      await uninstallEnvironment(entry.id.slice("environment:".length));
      return;
    }
    const product = findCatalogProduct(entry.id);
    if (!product) return;
    if (entry.type === "cli") await requestCliUninstall(product);
    else await requestDesktopUninstall(product);
  };

  const deleteManagedPackage = async (productId: string) => {
    if (!window.aihubPC) return;
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
    setSelectedVendor(null);
    setAccountInitialTab(tab);
    setView("account");
    void refreshPersonalCenter().catch(() => undefined);
  };

  return (
    <div className="pcApp" data-theme={theme}>
      <header className="topbar">
        <button
          className="brand"
          title={brand.slogan}
          onClick={() => navigate("home")}
        >
          <span className="brandMark">{brand.mark}</span>
          <span>{brand.name}</span>
          <small>{uiText("chrome.pc")}</small>
        </button>

        <form className="search" onSubmit={submitSearch}>
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.searchPlaceholder}
          />
          <button type="submit">{t.search}</button>
        </form>

        <div className="topActions">
          <button className="quietButton" onClick={openInstalledManagement}>
            {uiText("auto.a8b6c39dcabf")}</button>
          <button className="quietButton" onClick={() => setSettingsOpen(true)}>
            ⚙ {t.settings}
          </button>
          {identity.status === "authenticated" && (
            <button
              className="notificationButton"
              aria-label={uiText("auto.59e06dbae891", { value1: personalCenter?.summary.unreadNotifications ? uiText("auto.823659594acc", { value1: personalCenter.summary.unreadNotifications }) : "" })}
              onClick={() => openPersonalCenter("notifications")}
            >
              <span aria-hidden="true">🔔</span>
              {Boolean(personalCenter?.summary.unreadNotifications) && (
                <b>{Math.min(99, personalCenter!.summary.unreadNotifications)}</b>
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
      </header>

      <div
        className={`workspace${
          view === "community" &&
          identity.status === "authenticated" &&
          !selectedVendor
            ? " communityWorkspace"
            : ""
        }`}
      >
        <aside className="sidebar">
          <p>{t.navigation}</p>
          <nav>
            <NavButton active={view === "home"} onClick={() => navigate("home")}>
              <span>⌂</span>{t.home}
            </NavButton>
            <NavButton
              active={view === "vendors"}
              onClick={() => navigate("vendors")}
            >
              <span>◇</span>{t.vendors}
            </NavButton>
            <NavButton
              active={view === "community"}
              onClick={() => {
                setSelectedVendor(null);
                setView("community");
              }}
            >
              <span>◎</span>{t.community}
            </NavButton>
            {extraSections
              .filter((section) => section.enabled)
              .map((section) => (
                <NavButton
                  key={section.id}
                  active={false}
                  onClick={() => window.open(section.url)}
                >
                  <span>↗</span>
                  {section.title}
                </NavButton>
              ))}
          </nav>
        </aside>

        <main
          className={`content${
            view === "community" &&
            identity.status === "authenticated" &&
            !selectedVendor
              ? " communityContent"
              : ""
          }`}
        >
          {selectedVendor ? (
            <VendorPage
              vendor={selectedVendor}
              environment={environment}
              productStages={productStages}
              productMissing={productMissing}
              productProgress={productProgress}
              productDownloadDetails={productDownloadDetails}
              downloadTasks={downloadTasks}
              productErrors={productErrors}
              productFiles={productFiles}
              desktopStatuses={desktopStatuses}
              cliLogs={cliLogs}
              cliVersions={cliVersions}
              cliStatuses={cliStatuses}
              environmentMessages={environmentMessages}
              environmentPackageStages={environmentPackageStages}
              onBack={() => setSelectedVendor(null)}
              onInstallProduct={requestUnifiedInstall}
              onPauseDownload={pauseProductDownload}
              onCancelDownload={cancelProductDownload}
              onRelocateDownload={relocateProductDownload}
              onUninstallCli={requestCliUninstall}
              onUninstallDesktop={requestDesktopUninstall}
              onRecheckDesktopUninstall={recheckDesktopUninstall}
              onOpenDesktop={(product) =>
                window.aihubPC?.openDesktopApp(product.id)
              }
              onOpenDesktopLocation={(product) =>
                window.aihubPC?.openDesktopLocation(product.id)
              }
              onInstallEnvironment={installEnvironment}
              onOpenEnvironmentInstaller={openEnvironmentInstaller}
            />
          ) : view === "home" ? (
            <HomePage
              vendors={catalogVendors}
              banners={homeBanners}
              featuredVendorIds={featuredVendorIds}
              onOpenVendors={() => navigate("vendors")}
              onOpenVendor={(vendor) => {
                setView("vendors");
                setSelectedVendor(vendor);
              }}
            />
          ) : view === "vendors" ? (
            <VendorsPage
              vendors={visibleVendors}
              category={category}
              letter={letter}
              letters={letters}
              search={search}
              onCategory={setCategory}
              onLetter={setLetter}
              onOpenVendor={setSelectedVendor}
            />
          ) : view === "management" ? (
            <InstalledProductsPage
              management={installedManagement}
              messages={managementMessages}
              scanning={scanning}
              onRefresh={refreshInstalledManagement}
              onOpen={openManagedProduct}
              onClose={closeManagedProduct}
              onOpenFiles={openManagedProductFiles}
              onReinstall={(entry) =>
                void openCompletedDownloadTask(entry.id)
              }
              onReinstallEnvironment={(entry) =>
                void openCompletedDownloadTask(entry.id)
              }
              onUninstall={uninstallManagedProduct}
              onInstallPackage={(entry) =>
                void openCompletedDownloadTask(entry.id)
              }
              onShowPackage={(entry) =>
                void showDownloadInFolder(entry.id)
              }
              onDeletePackage={(entry) =>
                void deleteManagedPackage(entry.id)
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
              onOpenCommunity={(path) => {
                setCommunityTargetPath(path);
                setView("community");
              }}
            />
          ) : (
            <FlarumCommunityPage
              identity={identity}
              theme={theme}
              language={language}
              onLogin={() => setAuthOpen(true)}
              targetPath={communityTargetPath}
              onTargetConsumed={() => setCommunityTargetPath("")}
            />
          )}
        </main>
      </div>

      {settingsOpen && (
        <SettingsPanel
          theme={theme}
          language={language}
          downloadDirectory={downloadDirectory}
          cliInstallDirectory={cliInstallDirectory}
          environment={environment}
          environmentMessages={environmentMessages}
          environmentPackageStages={environmentPackageStages}
          downloadTasks={downloadTasks}
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
          scanning={scanning}
          checkingUpdate={checkingUpdate}
          installingUpdate={installingUpdate}
          updateResult={updateResult}
          updateInstallMessage={updateInstallMessage}
          onClose={() => setSettingsOpen(false)}
          onTheme={changeTheme}
          onLanguage={changeLanguage}
          onChooseDirectory={chooseDownloadDirectory}
          onChooseCliDirectory={chooseCliDirectory}
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
          onResumeDownloadTask={resumeDownloadTask}
          onPauseDownloadTask={pauseDownloadTask}
          onCancelDownloadTask={cancelDownloadTask}
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
          onCheckForUpdate={checkForUpdate}
          onOpenUpdate={installUpdate}
        />
      )}
      {authOpen && (
        <AuthModal
          identity={identity}
          onClose={() => setAuthOpen(false)}
          onIdentity={setIdentity}
        />
      )}
    </div>
  );
}

function NavButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={active ? "navItem active" : "navItem"} onClick={onClick}>
      {children}
    </button>
  );
}

function HomePage({
  vendors,
  banners,
  featuredVendorIds,
  onOpenVendors,
  onOpenVendor
}: {
  vendors: Vendor[];
  banners: CatalogBanner[];
  featuredVendorIds: string[];
  onOpenVendors: () => void;
  onOpenVendor: (vendor: Vendor) => void;
}) {
  const [bannerIndex, setBannerIndex] = useState(0);
  useEffect(() => setBannerIndex(0), [banners]);
  const banner = banners[bannerIndex] || builtInBanners[0];
  const configuredFeatured = featuredVendorIds
    .map((id) => vendors.find((vendor) => vendor.id === id))
    .filter((vendor): vendor is Vendor => Boolean(vendor));
  const featured = configuredFeatured.length
    ? configuredFeatured.slice(0, 4)
    : vendors.slice(0, 4);
  return (
    <>
      <section className="hero">
        <div className="heroCopy">
          <p>{banner.eyebrow}</p>
          <h1>{banner.title}</h1>
          <span>{banner.description}</span>
          <button className="primaryAction" onClick={onOpenVendors}>
            {banner.action} →
          </button>
          <div className="bannerControls" aria-label={uiText("auto.35bf6ebc40df")}>
            {banners.map((item, index) => (
              <button
                key={item.title}
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
      </section>

      <section className="homeSection">
        <div className="sectionHeading">
          <div>
            <p>{uiText("auto.cf2b91fc1b4a")}</p>
            <h2>{uiText("auto.1af1e69bc945")}</h2>
          </div>
          <button onClick={onOpenVendors}>{uiText("auto.2b2b5d7f4271")}</button>
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
                <small>{uiText("auto.2e10281b39c0")}</small>
                <b>{vendor.name}</b>
              </span>
              <i>→</i>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function VendorsPage({
  vendors: visible,
  category,
  letter,
  letters,
  search,
  onCategory,
  onLetter,
  onOpenVendor
}: {
  vendors: Vendor[];
  category: "全部" | ProductCategory;
  letter: string;
  letters: string[];
  search: string;
  onCategory: (value: "全部" | ProductCategory) => void;
  onLetter: (value: string) => void;
  onOpenVendor: (vendor: Vendor) => void;
}) {
  return (
    <>
      <header className="pageHeader">
        <p>{uiText("auto.98ee9e2f83f2")}</p>
        <h1>{uiText("auto.6310cc279f00")}</h1>
        <span>{uiText("auto.db289d57b452")}</span>
      </header>

      <section className="filters">
        <FilterRow
          label={uiText("auto.a74a788ef2ea")}
          values={categories}
          active={category}
          onChange={(value) => onCategory(value as "全部" | ProductCategory)}
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

      <div className="vendorGrid">
        {visible.map((vendor) => (
          <button
            className="vendorCard"
            key={vendor.id}
            onClick={() => onOpenVendor(vendor)}
          >
            <div className="vendorCardTop">
              <VendorMark vendor={vendor} large />
              <span>{vendor.products.length} {uiText("auto.ab2dacacbc82")}</span>
            </div>
            <h2>{vendor.name}</h2>
            <p>{vendor.description}</p>
            <div className="productTags">
              {vendor.products.map((product) => (
                <span key={product.id}>{product.name}</span>
              ))}
            </div>
            <footer>
              <span>{vendor.products.length} {uiText("auto.ab2dacacbc82")}</span>
              <b>{uiText("auto.0eca81598063")}</b>
            </footer>
          </button>
        ))}
      </div>
    </>
  );
}

function FilterRow({
  label,
  values,
  active,
  onChange
}: {
  label: string;
  values: readonly string[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="filterRow">
      <b>{label}</b>
      <div>
        {values.map((value) => (
          <button
            key={value}
            className={active === value ? "active" : ""}
            onClick={() => onChange(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function VendorPage({
  vendor,
  productStages,
  productMissing,
  productProgress,
  productDownloadDetails,
  downloadTasks,
  productErrors,
  productFiles,
  desktopStatuses,
  cliLogs,
  cliVersions,
  cliStatuses,
  environmentMessages,
  environmentPackageStages,
  onBack,
  onInstallProduct,
  onPauseDownload,
  onCancelDownload,
  onRelocateDownload,
  onUninstallCli,
  onUninstallDesktop,
  onRecheckDesktopUninstall,
  onOpenDesktop,
  onOpenDesktopLocation,
  onInstallEnvironment,
  onOpenEnvironmentInstaller
}: {
  vendor: Vendor;
  environment: EnvironmentReport | null;
  productStages: Record<string, ProductStage>;
  productMissing: Record<string, string[]>;
  productProgress: Record<string, number | null>;
  productDownloadDetails: Record<string, DownloadProgress>;
  downloadTasks: Record<string, ManagedDownloadTask>;
  productErrors: Record<string, string>;
  productFiles: Record<string, string>;
  desktopStatuses: Record<string, DesktopStatus>;
  cliLogs: Record<string, CliLogEntry[]>;
  cliVersions: Record<string, string>;
  cliStatuses: Record<string, CliStatus>;
  environmentMessages: Record<string, string>;
  environmentPackageStages: Record<string, EnvironmentPackageStage>;
  onBack: () => void;
  onInstallProduct: (product: Product) => void;
  onPauseDownload: (product: Product) => void;
  onCancelDownload: (product: Product) => void;
  onRelocateDownload: (product: Product) => void;
  onUninstallCli: (product: Product) => void;
  onUninstallDesktop: (product: Product) => void;
  onRecheckDesktopUninstall: (product: Product) => void;
  onOpenDesktop: (product: Product) => void;
  onOpenDesktopLocation: (product: Product) => void;
  onInstallEnvironment: (environmentId: string) => void;
  onOpenEnvironmentInstaller: (environmentId: string) => void;
}) {
  const groups: ProductKind[] = ["桌面端", "CLI", "其他产品"];
  return (
    <>
      <button className="backButton" onClick={onBack}>{uiText("auto.897b497715a6")}</button>
      <section className="vendorHero">
        <VendorMark vendor={vendor} hero />
        <div>
          <p>{uiText("auto.1ffe67baf7b9")}</p>
          <h1>{vendor.name}</h1>
          <span>{vendor.description}</span>
        </div>
        <button className="quietButton" onClick={() => window.open(vendor.website)}>
          {uiText("auto.32991a0a11cb")}</button>
      </section>

      <section className="vendorProducts">
        <div className="sectionHeading">
          <div>
            <p>{uiText("auto.47935eda89dd")}</p>
            <h2>{vendor.name} {uiText("auto.3a0cd01f42b9")}</h2>
          </div>
        </div>
        {groups.map((group) => {
          const products = vendor.products.filter((product) => product.kind === group);
          if (!products.length) return null;
          return (
            <section className="productGroup" key={group}>
              <h3>{group}</h3>
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  stage={productStages[product.id] || "idle"}
                  missing={productMissing[product.id] || []}
                  progress={productProgress[product.id] ?? null}
                  downloadDetail={productDownloadDetails[product.id]}
                  downloadTask={downloadTasks[product.id]}
                  error={productErrors[product.id] || ""}
                  filePath={productFiles[product.id] || ""}
                  desktopStatus={desktopStatuses[product.id]}
                  logs={cliLogs[product.id] || []}
                  version={cliVersions[product.id] || ""}
                  cliStatus={cliStatuses[product.id]}
                  environmentMessages={environmentMessages}
                  environmentPackageStages={environmentPackageStages}
                  onInstallProduct={() => onInstallProduct(product)}
                  onPauseDownload={() => onPauseDownload(product)}
                  onCancelDownload={() => onCancelDownload(product)}
                  onRelocateDownload={() => onRelocateDownload(product)}
                  onUninstallCli={() => onUninstallCli(product)}
                  onUninstallDesktop={() => onUninstallDesktop(product)}
                  onRecheckDesktopUninstall={() =>
                    onRecheckDesktopUninstall(product)
                  }
                  onOpenDesktop={() => onOpenDesktop(product)}
                  onOpenDesktopLocation={() => onOpenDesktopLocation(product)}
                  onInstallEnvironment={onInstallEnvironment}
                  onOpenEnvironmentInstaller={onOpenEnvironmentInstaller}
                />
              ))}
            </section>
          );
        })}
      </section>

      <section className="tutorialCard">
        <div>
          <p>{uiText("auto.ca89fe5c9aa4")}</p>
          <h2>{vendor.name} {uiText("auto.8ef3fead5883")}</h2>
        </div>
        <button onClick={() => window.open(vendor.tutorial)}>
          {uiText("auto.08f7d323aada")}</button>
      </section>
    </>
  );
}

function ProductRow({
  product,
  stage,
  missing,
  progress,
  downloadDetail,
  downloadTask,
  error,
  filePath,
  desktopStatus,
  logs,
  version,
  cliStatus,
  environmentMessages,
  environmentPackageStages,
  onInstallProduct,
  onPauseDownload,
  onCancelDownload,
  onRelocateDownload,
  onUninstallCli,
  onUninstallDesktop,
  onRecheckDesktopUninstall,
  onOpenDesktop,
  onOpenDesktopLocation,
  onInstallEnvironment,
  onOpenEnvironmentInstaller
}: {
  product: Product;
  stage: ProductStage;
  missing: string[];
  progress: number | null;
  downloadDetail?: DownloadProgress;
  downloadTask?: ManagedDownloadTask;
  error: string;
  filePath: string;
  desktopStatus?: DesktopStatus;
  logs: CliLogEntry[];
  version: string;
  cliStatus?: CliStatus;
  environmentMessages: Record<string, string>;
  environmentPackageStages: Record<string, EnvironmentPackageStage>;
  onInstallProduct: () => void;
  onPauseDownload: () => void;
  onCancelDownload: () => void;
  onRelocateDownload: () => void;
  onUninstallCli: () => void;
  onUninstallDesktop: () => void;
  onRecheckDesktopUninstall: () => void;
  onOpenDesktop: () => void;
  onOpenDesktopLocation: () => void;
  onInstallEnvironment: (environmentId: string) => void;
  onOpenEnvironmentInstaller: (environmentId: string) => void;
}) {
  const behavior = resolveProductBehavior(product);
  const installPresentation = getProductInstallPresentation({
    stage,
    filePath
  });
  const uninstallCopy = getUninstallPresentation(
    desktopStatus?.uninstallMode
  );
  const installButtonLabel =
    behavior.primaryLabel ||
    (behavior.managedCli || behavior.managedDesktop
      ? uiText("auto.c5a01527da36")
      : product.productType === "desktop-official"
        ? uiText("auto.6136b14a050c")
        : uiText("auto.96b410ae01e3"));
  const installable = behavior.canInstall;
  const managedActionsAvailable =
    (behavior.managedCli || behavior.managedDesktop) &&
    (behavior.canInstall ||
      behavior.canOpenInstalled ||
      behavior.canUninstall);
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
    <article className="productRow">
      <div className="productInfo">
        <span>{product.kind}</span>
        <h4>{product.name}</h4>
        <p>{product.description}</p>
      </div>
      <div className="productActions">
      {behavior.canOpenWebsite && (
        <button
          className="websiteButton"
          onClick={() => window.open(product.website)}
        >
          {product.productType === "web"
            ? uiText("auto.82d9ce3a5b37")
            : product.productType === "desktop-official"
              ? uiText("auto.c1ac19efecee")
              : product.kind === "CLI"
                ? uiText("auto.2af802abaa86")
                : product.kind === "桌面端"
                  ? uiText("auto.2034e0d3f299")
                  : uiText("auto.c4462f4f03f9")} ↗
        </button>
      )}
      {behavior.canOpenTutorial &&
        (!behavior.canOpenWebsite || product.tutorial !== product.website) && (
          <button
            className="websiteButton"
            onClick={() => window.open(product.tutorial)}
          >
            {uiText("auto.51bd5a77da66")}</button>
        )}
      {managedActionsAvailable ? (
        <div className="installFlow">
          {stage === "idle" && installable && (
            <button
              className="accentButton"
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
                {environmentStatus ||
                  uiText("auto.b7d7fb13afb6")}
              </small>
            </div>
          )}
          {stage === "ready" && (
            <button
              className="accentButton"
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
              <div className="downloadStateHeader">
                <span>{downloadStatusLabel}</span>
                <div className="downloadStateActions">
                  <button
                    disabled={downloadTaskChanging}
                    onClick={onPauseDownload}
                  >
                    {downloadTask?.phase === "pausing" ? uiText("auto.5a4ba5a4128c") : uiText("auto.8d12fc0d4eb2")}
                  </button>
                  <button
                    disabled={downloadTaskChanging}
                    onClick={onCancelDownload}
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
              <span>{error || uiText("auto.d5cd56f6c0aa")}</span>
              {downloadDetail && downloadDetail.receivedBytes > 0 && (
                <small>
                  {uiText("auto.e309f2263e75")}{formatBytes(downloadDetail.receivedBytes)}
                  {downloadDetail.totalBytes > 0
                    ? ` / ${formatBytes(downloadDetail.totalBytes)}`
                    : ""}
                </small>
              )}
              <div className="missingEnvironmentActions">
                <button onClick={onInstallProduct}>
                  {downloadTask?.resumable ? uiText("auto.c3c6d7017082") : uiText("auto.cc92cb4b8980")}
                </button>
                <button onClick={onRelocateDownload}>
                  {uiText("auto.16d7a29d9fbb")}</button>
                <button onClick={onCancelDownload}>{uiText("auto.537d17f1c531")}</button>
              </div>
            </div>
          )}
          {stage === "downloaded" && (
            <div className="verifiedPackage">
              <span className="packagePath" title={installPresentation?.filePath}>
                {installPresentation?.filePath}
              </span>
              {error && <small className="launchError">{error}</small>}
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
              <button className="accentButton" disabled={installPresentation.disabled}>
                {installPresentation.buttonLabel}
              </button>
            </div>
          )}
          {stage === "awaiting-uninstall" && (
            <div className="verificationState">
              <span>{uninstallCopy.activeTitle}</span>
              {error && <small>{error}</small>}
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
              {error && <small>{error}</small>}
              <button onClick={onInstallProduct}>{uiText("auto.2ee26e222f2c")}</button>
            </div>
          )}
          {stage === "error" && (
            <div className="blockedState">
              <span>{error}</span>
              <div className="missingEnvironmentActions">
                <button onClick={onInstallProduct}>
                  {cliDeployable
                    ? uiText("auto.453ad482ccef")
                    : downloadTask?.resumable
                      ? uiText("auto.b80b97d6351b")
                      : uiText("auto.453ad482ccef")}
                </button>
                {product.download &&
                  downloadTask &&
                  downloadTask.phase !== "completed" && (
                  <button onClick={onCancelDownload}>{uiText("auto.537d17f1c531")}</button>
                )}
                {product.download && (
                  <button onClick={onRelocateDownload}>
                    {uiText("auto.16d7a29d9fbb")}</button>
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
                </>
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
              {error && <small className="installedError">{error}</small>}
            </div>
          )}
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

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : uiText("auto.7d6b5b294bc1"));
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!window.aihubPC) return;
      const next = await window.aihubPC.login({ identifier, password });
      onIdentity(next);
      setPassword("");
      onClose();
    });
  };

  const requestCode = () =>
    run(async () => {
      if (!window.aihubPC) return;
      setChallenge(await window.aihubPC.requestRegistrationCode(email));
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
    <div className="modalBackdrop" onMouseDown={onClose}>
      <section
        className="authModal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>{uiText("auto.53ef710af69d")}</p>
            <h2>
              {mode === "login" ? uiText("auto.1e2df9c3075a") : uiText("auto.c4fb62202bad")}
            </h2>
          </div>
          <button onClick={onClose}>×</button>
        </header>

        {mode === "login" && (
          <form className="authForm" onSubmit={submitLogin}>
            <label>
              {uiText("auto.1ef7b40a9c43")}<input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              {uiText("auto.a621ab606db2")}<input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="accentButton" disabled={busy}>
              {busy ? uiText("auto.3f06ed8f8c38") : uiText("auto.1e2df9c3075a")}
            </button>
            <button type="button" onClick={() => setMode("register")}>
              {uiText("auto.4cebd79c6738")}</button>
          </form>
        )}

        {mode === "register" && (
          <form className="authForm" onSubmit={submitRegistration}>
            <label>
              {uiText("auto.73075237fd0f")}<input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <div className="verificationRow">
              <label>
                {uiText("auto.3acdd163e67a")}<input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
              </label>
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
            <label>
              {uiText("auto.1a3f0617d6de")}<input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              {uiText("auto.19bf5d20cb51")}<input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder={uiText("auto.f79fd585f90f")}
              />
            </label>
            <label>
              {uiText("auto.a621ab606db2")}<input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                required
              />
              <small>{uiText("auto.8ada8911bed2")}</small>
            </label>
            <button className="accentButton" disabled={busy}>
              {busy ? uiText("auto.0debc065262a") : uiText("auto.8aa3eb250835")}
            </button>
            <button type="button" onClick={() => setMode("login")}>
              {uiText("auto.747b0f9082e6")}</button>
          </form>
        )}

        {message && <p className="authMessage">{message}</p>}
      </section>
    </div>
  );
}

type PersonalCenterTab =
  | "profile"
  | "security"
  | "notifications"
  | "favorites"
  | "likes";

function PersonalCenterPage({
  identity,
  center,
  initialTab,
  onIdentity,
  onCenter,
  onRefresh,
  onLogin,
  onLogout,
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
  const [notice, setNotice] = useState("");
  const [editingContact, setEditingContact] = useState<
    "phone" | "email" | null
  >(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const authenticated =
    identity.status === "authenticated" ? identity : null;
  const sessions = center?.sessions || [];
  const notifications = center?.notifications || [];
  const interactions = center?.interactions || [];

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!authenticated) return;
    setNickname(authenticated.user.profile.nickname);
    setAvatarPreview(authenticated.user.profile.avatarUrl);
    setBio(authenticated.user.profile.bio);
    setPhone("");
    setEmail("");
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

  const interactionList =
    tab === "favorites"
      ? interactions.filter((item) => item.favorited)
      : interactions.filter((item) => item.liked);

  return (
    <section className="personalCenter">
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
            ["profile", uiText("auto.cba1ec75f4ca")],
            ["security", uiText("auto.2079bd640fc8")],
            [
              "notifications",
              uiText("auto.59e06dbae891", { value1: notifications.some((item) => !item.read) ? ` · ${notifications.filter((item) => !item.read).length}` : "" })
            ],
            ["favorites", uiText("auto.ab01d900fe35", { value1: center?.summary.favorites ? ` · ${center.summary.favorites}` : "" })],
            ["likes", uiText("auto.8917aeccc621", { value1: center?.summary.likes ? ` · ${center.summary.likes}` : "" })]
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

      {tab === "notifications" && (
        <div className="personalList">
          {notifications.map((item) => (
            <article
              className={item.read ? "" : "unread"}
              key={`${item.source}:${item.id}`}
            >
              <div>
                <b>{item.title}</b>
                <p>{item.body}</p>
                <small>
                  {item.source === "community" ? uiText("auto.5bcd0ddcdd69") : uiText("auto.311bb313fdec")} ·{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </small>
              </div>
              <div className="rowActions">
                {item.actionPath.startsWith("/d/") && (
                  <button onClick={() => onOpenCommunity(item.actionPath)}>
                    {uiText("auto.db8db0530432")}</button>
                )}
                {!item.read && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await window.aihubPC!.markPersonalCenterNotificationRead(
                          item.source,
                          item.id
                        );
                        if (!center) return;
                        const notifications = center.notifications.map(
                          (notification) =>
                            notification.id === item.id &&
                            notification.source === item.source
                              ? {
                                  ...notification,
                                  read: true,
                                  readAt: new Date().toISOString()
                                }
                              : notification
                        );
                        onCenter({
                          ...center,
                          notifications,
                          summary: {
                            ...center.summary,
                            unreadNotifications: notifications.filter(
                              (notification) => !notification.read
                            ).length
                          }
                        });
                      })
                    }
                  >
                    {uiText("auto.82f35d89b827")}</button>
                )}
              </div>
            </article>
          ))}
          {!notifications.length && <div className="emptyPanel">{uiText("auto.0f0d8276fbee")}</div>}
          {center?.sources.community === "unavailable" && (
            <div className="emptyPanel">{uiText("auto.33c6d4e50a98")}</div>
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

      {notice && <p className="personalNotice">{notice}</p>}
    </section>
  );
}

type EmbeddedCommunityWebview = HTMLElement & {
  getURL(): string;
  loadURL(url: string): Promise<void>;
  executeJavaScript<T = unknown>(code: string): Promise<T>;
};

const COMMUNITY_THEME_PALETTES = {
  light: {
    "color-scheme": "light",
    "--body-bg": "#f3f7f4",
    "--body-bg-shaded": "#e7efea",
    "--body-bg-light": "#ffffff",
    "--body-bg-faded": "rgba(243,247,244,0.93)",
    "--text-color": "#18211f",
    "--heading-color": "#18211f",
    "--muted-color": "#6d7874",
    "--muted-color-light": "#8a9691",
    "--muted-color-dark": "#17362d",
    "--shadow-color": "rgba(20,60,50,0.18)",
    "--control-bg": "#e8efeb",
    "--control-bg-light": "#ffffff",
    "--control-bg-shaded": "#dce5e0",
    "--control-color": "#6d7874",
    "--control-body-bg-mix": "#edf3ef",
    "--header-bg": "#f3f7f4",
    "--header-color": "#17362d",
    "--header-control-bg": "#e8efeb",
    "--header-control-color": "#6d7874",
    "--button-color": "#17362d",
    "--button-bg": "#e8efeb",
    "--button-bg-hover": "#dce5e0",
    "--button-bg-active": "#cddad3",
    "--button-bg-disabled": "#e8efeb",
    "--button-primary-color": "#17362d",
    "--button-primary-bg": "#a8ff56",
    "--button-primary-bg-hover": "#98ef49",
    "--button-primary-bg-active": "#88dc3d",
    "--button-primary-bg-disabled": "#a8ff56",
    "--primary-color": "#a8ff56",
    "--secondary-color": "#17362d",
    "--link-color": "#367a2a"
  },
  dark: {
    "color-scheme": "dark",
    "--body-bg": "#0e1916",
    "--body-bg-shaded": "#0a1311",
    "--body-bg-light": "#182823",
    "--body-bg-faded": "rgba(14,25,22,0.93)",
    "--text-color": "#eef6f2",
    "--heading-color": "#eef6f2",
    "--muted-color": "#9fafaa",
    "--muted-color-light": "#b7c5c0",
    "--muted-color-dark": "#eef6f2",
    "--shadow-color": "rgba(0,0,0,0.5)",
    "--control-bg": "#182823",
    "--control-bg-light": "#21342e",
    "--control-bg-shaded": "#0b1512",
    "--control-color": "#9fafaa",
    "--control-body-bg-mix": "#13201c",
    "--header-bg": "#0e1916",
    "--header-color": "#9df04f",
    "--header-control-bg": "#182823",
    "--header-control-color": "#9fafaa",
    "--button-color": "#eef6f2",
    "--button-bg": "#182823",
    "--button-bg-hover": "#21342e",
    "--button-bg-active": "#2b4039",
    "--button-bg-disabled": "#182823",
    "--button-primary-color": "#17362d",
    "--button-primary-bg": "#a8ff56",
    "--button-primary-bg-hover": "#b5ff70",
    "--button-primary-bg-active": "#91e848",
    "--button-primary-bg-disabled": "#a8ff56",
    "--primary-color": "#a8ff56",
    "--secondary-color": "#eef6f2",
    "--link-color": "#9df04f"
  }
} as const;

function buildCommunityThemeScript(theme: "light" | "dark") {
  const declarations = Object.entries(COMMUNITY_THEME_PALETTES[theme])
    .map(([property, value]) => `${property}:${value}`)
    .join(";");
  const heroBackground = theme === "light" ? "#e7fbd7" : "#143c32";
  const heroColor = theme === "light" ? "#17362d" : "#eef6f2";
  const themeSelector = `html[data-aihub-theme="${theme}"]`;
  const css = [
    `${themeSelector}{${declarations}}`,
    `${themeSelector} .DiscussionHero{--hero-bg:${heroBackground};background:${heroBackground}!important;color:${heroColor}!important}`,
    `${themeSelector} .DiscussionHero a{color:${heroColor}!important}`
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

function buildCommunityRefreshControlScript(language: Language) {
  const refreshLabel = createLanguage(language).text("community.refresh");
  return String.raw`
(() => {
  const itemId = "aihub-community-refresh-item";
  const buttonId = "aihub-community-refresh";
  const styleId = "aihub-community-refresh-style";

  const install = () => {
    const existing = document.getElementById(buttonId);
    if (existing) return true;

    const search = document.querySelector(
      "#header-secondary .Search, .Header-secondary .Search, .Search"
    );
    if (!search || !search.parentElement) return false;

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
        "#" + buttonId + " .aihub-refresh-glyph{font-size:20px;line-height:1;transform:translateY(-1px)}"
      ].join("");
      document.head.appendChild(style);
    }

    const anchor = search.closest("li") || search;
    const wrapper = document.createElement(
      anchor.parentElement?.tagName === "UL" ? "li" : "span"
    );
    wrapper.id = itemId;
    wrapper.className = "item-aihub-community-refresh";

    const button = document.createElement("button");
    button.id = buttonId;
    button.className = "Button Button--icon Button--flat";
    button.type = "button";
    button.title = ${JSON.stringify(refreshLabel)};
    button.setAttribute("aria-label", ${JSON.stringify(refreshLabel)});
    button.innerHTML =
      '<span class="aihub-refresh-glyph" aria-hidden="true">&#8635;</span>';
    button.addEventListener("click", () => window.location.reload());
    wrapper.appendChild(button);
    anchor.insertAdjacentElement("afterend", wrapper);
    return true;
  };

  install();
  if (!window.__aihubCommunityRefreshObserver) {
    const root = document.querySelector("#header-secondary") || document.body;
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
  onLogin,
  targetPath,
  onTargetConsumed
}: {
  identity: IdentitySnapshot;
  theme: "light" | "dark";
  language: Language;
  onLogin: () => void;
  targetPath: string;
  onTargetConsumed: () => void;
}) {
  const webviewRef = useRef<EmbeddedCommunityWebview | null>(null);
  const pendingTarget = useRef(targetPath);
  const [embed, setEmbed] = useState<CommunityEmbedSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const communityText = createLanguage(language);

  useEffect(() => {
    pendingTarget.current = targetPath;
  }, [targetPath]);

  useEffect(() => {
    if (identity.status !== "authenticated" || !window.aihubPC) {
      setEmbed(null);
      return;
    }
    let canceled = false;
    setLoading(true);
    setError("");
    window.aihubPC
      .createCommunityEmbedSession()
      .then((session) => {
        if (!canceled) setEmbed(session);
      })
      .catch((cause) => {
        if (!canceled) {
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
  }, [identity.status === "authenticated" ? identity.user.id : "anonymous"]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !embed) return;

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
        onTargetConsumed();
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
      runScript(buildCommunityThemeScript(theme));
      runScript(buildCommunityLanguageScript(language));
      runScript(buildCommunityRefreshControlScript(language));
    };
    const failed = (event: Event) => {
      const detail = event as Event & {
        errorCode?: number;
        errorDescription?: string;
      };
      if (detail.errorCode === -3) return;
      setError(
        detail.errorDescription || communityText.text("community.pageFailed")
      );
    };
    webview.addEventListener("did-navigate", updateLocation);
    webview.addEventListener("did-navigate-in-page", updateLocation);
    webview.addEventListener("dom-ready", installCommunityChrome);
    webview.addEventListener("did-stop-loading", installCommunityChrome);
    webview.addEventListener("did-fail-load", failed);
    installCommunityChrome();
    return () => {
      webview.removeEventListener("did-navigate", updateLocation);
      webview.removeEventListener("did-navigate-in-page", updateLocation);
      webview.removeEventListener("dom-ready", installCommunityChrome);
      webview.removeEventListener("did-stop-loading", installCommunityChrome);
      webview.removeEventListener("did-fail-load", failed);
    };
  }, [embed, language, onTargetConsumed, theme]);

  if (identity.status !== "authenticated") {
    return (
      <section className="emptyPanel communityLoginRequired">
        <span>◎</span>
        <p>{communityText.text("community.provider")}</p>
        <h1>{communityText.text("community.title")}</h1>
        <small>{communityText.text("community.loginHint")}</small>
        <button className="accentButton" onClick={onLogin}>
          {communityText.text("community.loginAction")}
        </button>
      </section>
    );
  }

  return (
    <section className="embeddedCommunity">
      <div className="communityViewport">
        {!embed ? (
          <div className="communityLoading">
            {loading
              ? communityText.text("community.loading")
              : error || communityText.text("community.unavailable")}
          </div>
        ) : (
          createElement("webview", {
            ref: (element: EmbeddedCommunityWebview | null) => {
              webviewRef.current = element;
            },
            className: "communityWebview",
            src: embed.launchUrl,
            partition: "persist:aihub-community",
            allowpopups: "false",
            webpreferences:
              "contextIsolation=yes,nodeIntegration=no,sandbox=yes"
          })
        )}
        {error && <em className="communityError">{error}</em>}
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
        <button onClick={onBack}>{uiText("auto.a8a335061044")}</button>
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
        {actionError && <em>{actionError}</em>}
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
      {(error || actionError) && <em>{error || actionError}</em>}
    </section>
  );
}

function CommunityPage({ community }: { community: CatalogCommunity }) {
  return (
    <section className="emptyPanel">
      <span>◎</span>
      <p>{community.provider}</p>
      <h1>{community.title}</h1>
      <small>{community.description}</small>
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
  scanning,
  onRefresh,
  onOpen,
  onClose,
  onOpenFiles,
  onReinstall,
  onReinstallEnvironment,
  onUninstall,
  onInstallPackage,
  onShowPackage,
  onDeletePackage
}: {
  management: ReturnType<typeof buildInstalledProductManagement>;
  messages: Record<string, string>;
  scanning: boolean;
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
  onInstallPackage: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["packages"][number]
  ) => void;
  onShowPackage: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["packages"][number]
  ) => void;
  onDeletePackage: (
    entry: ReturnType<
      typeof buildInstalledProductManagement
    >["packages"][number]
  ) => void;
}) {
  return (
    <section className="installedManagementPage">
      <header className="pageHeader managementHeader">
        <div>
          <span>{uiText("auto.f242c2020794")}</span>
          <h2>{uiText("auto.6b8e74aca534")}</h2>
          <p>{uiText("auto.c23f887504cb")}</p>
        </div>
        <button disabled={scanning} onClick={() => void onRefresh()}>
          {scanning ? uiText("auto.71659de804df") : uiText("auto.802a407c7743")}
        </button>
      </header>

      <div className="managementList">
        {management.products.length ? (
          management.products.map((entry) => (
            <article className="managementCard" key={entry.id}>
              <div className="managementInfo">
                <span>
                  {entry.vendorName} ·{" "}
                  {entry.type === "cli"
                    ? "CLI"
                    : entry.type === "environment"
                      ? uiText("auto.423f51a28678")
                      : uiText("auto.a3dc386f84de")}
                </span>
                <h3>{entry.name}</h3>
                <p>
                  {entry.version ? `v${entry.version}` : uiText("auto.a8b6c39dcabf")}
                  {entry.location ? ` · ${entry.location}` : ""}
                </p>
                {messages[entry.id] && <small>{messages[entry.id]}</small>}
              </div>
              <div className="managementActions">
                {entry.canOpen && (
                  <button onClick={() => void onOpen(entry)}>{uiText("auto.c771248e511f")}</button>
                )}
                {entry.canClose && (
                  <button onClick={() => void onClose(entry)}>{uiText("auto.3fd47edce45b")}</button>
                )}
                {entry.canManageFiles && (
                  <button onClick={() => void onOpenFiles(entry)}>
                    {uiText("auto.b3bd5ac7cc4d")}</button>
                )}
                {entry.canReinstall && (
                  <button onClick={() => onReinstall(entry)}>{uiText("auto.453ad482ccef")}</button>
                )}
                {entry.canUninstall && (
                  <button
                    className="dangerButton"
                    onClick={() => void onUninstall(entry)}
                  >
                    {uiText("auto.06bc14b60f35")}</button>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="emptyManagement">{uiText("auto.cbdc685957fb")}</div>
        )}
      </div>

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
          <span>{uiText("auto.57e88a43ef2b")}</span>
          <h2>{uiText("auto.f9300f5383cb")}</h2>
        </div>
        {management.packages.length ? (
          <div className="managementList">
            {management.packages.map((entry) => (
              <article className="managementCard packageCard" key={entry.id}>
                <div className="managementInfo">
                  <h3>{entry.name}</h3>
                  <p title={entry.filePath}>{entry.filePath}</p>
                  {messages[`package:${entry.id}`] && (
                    <small>{messages[`package:${entry.id}`]}</small>
                  )}
                </div>
                <div className="managementActions">
                  {entry.canInstall && (
                    <button
                      className="accentButton"
                      onClick={() => onInstallPackage(entry)}
                    >
                      {uiText("auto.88eab834cb5f")}</button>
                  )}
                  <button onClick={() => onShowPackage(entry)}>
                    {uiText("auto.fcf8b4bff0df")}</button>
                  <button
                    className="dangerButton"
                    onClick={() => onDeletePackage(entry)}
                  >
                    {uiText("auto.200615f03adf")}</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyManagement">{uiText("auto.7f0386e672ea")}</div>
        )}
      </section>
    </section>
  );
}

function SettingsPanel({
  theme,
  language,
  downloadDirectory,
  cliInstallDirectory,
  environment,
  environmentMessages,
  environmentPackageStages,
  downloadTasks,
  downloadTaskNames,
  desktopOperationTasks,
  environmentOperationTasks,
  operationTaskNames,
  cliManagedTasks,
  cliLogs,
  installedTaskIds,
  scanning,
  checkingUpdate,
  installingUpdate,
  updateResult,
  updateInstallMessage,
  onClose,
  onTheme,
  onLanguage,
  onChooseDirectory,
  onChooseCliDirectory,
  onOpenDirectory,
  onClearDirectory,
  onScan,
  onInstallEnvironment,
  onOpenEnvironmentInstaller,
  onOpenEnvironmentLocation,
  onUninstallEnvironment,
  onResumeDownloadTask,
  onPauseDownloadTask,
  onCancelDownloadTask,
  onOpenCompletedDownloadTask,
  onShowDownloadInFolder,
  onClearDownloadHistory,
  onClearCompletedTasks,
  onCheckDesktopOperationTask,
  onCheckEnvironmentOperationTask,
  onClearCliManagedTask,
  onRetryCliManagedTask,
  onRecheckCliManagedTask,
  onCheckForUpdate,
  onOpenUpdate
}: {
  theme: "light" | "dark";
  language: Language;
  downloadDirectory: string;
  cliInstallDirectory: string;
  environment: EnvironmentReport | null;
  environmentMessages: Record<string, string>;
  environmentPackageStages: Record<string, EnvironmentPackageStage>;
  downloadTasks: Record<string, ManagedDownloadTask>;
  downloadTaskNames: Record<string, string>;
  desktopOperationTasks: Record<string, DesktopOperationTask>;
  environmentOperationTasks: Record<string, EnvironmentOperationTask>;
  operationTaskNames: Record<string, string>;
  cliManagedTasks: Record<string, CliManagedTask>;
  cliLogs: Record<string, CliLogEntry[]>;
  installedTaskIds: string[];
  scanning: boolean;
  checkingUpdate: boolean;
  installingUpdate: boolean;
  updateResult: UpdateCheckResult | null;
  updateInstallMessage: string;
  onClose: () => void;
  onTheme: (value: "light" | "dark") => void;
  onLanguage: (value: Language) => void;
  onChooseDirectory: () => void;
  onChooseCliDirectory: () => void;
  onOpenDirectory: () => void;
  onClearDirectory: () => void;
  onScan: () => void;
  onInstallEnvironment: (environmentId: string) => void;
  onOpenEnvironmentInstaller: (environmentId: string) => void;
  onOpenEnvironmentLocation: (environmentId: string) => void;
  onUninstallEnvironment: (environmentId: string) => void;
  onResumeDownloadTask: (productId: string) => void;
  onPauseDownloadTask: (productId: string) => void;
  onCancelDownloadTask: (productId: string) => void;
  onOpenCompletedDownloadTask: (productId: string) => void;
  onShowDownloadInFolder: (productId: string) => void;
  onClearDownloadHistory: (productId: string) => void;
  onClearCompletedTasks: () => void;
  onCheckDesktopOperationTask: (productId: string) => void;
  onCheckEnvironmentOperationTask: (environmentId: string) => void;
  onClearCliManagedTask: (productId: string) => void;
  onRetryCliManagedTask: (productId: string) => void;
  onRecheckCliManagedTask: (productId: string) => void;
  onCheckForUpdate: () => void;
  onOpenUpdate: () => void;
}) {
  type TaskFilter = "active" | "failed" | "completed";
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("active");
  const desktopTaskState = (task: DesktopOperationTask): TaskFilter =>
    task.phase === "installed" || task.phase === "uninstalled"
      ? "completed"
      : task.phase === "timed-out"
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
  const operationDownloadIds = new Set([
    ...Object.keys(desktopOperationTasks),
    ...Object.keys(environmentOperationTasks).map(
      (environmentId) => `environment:${environmentId}`
    )
  ]);
  const installedIds = new Set(installedTaskIds);
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
    filteredDesktopOperations.length > 0 ||
    filteredEnvironmentOperations.length > 0 ||
    filteredCliTasks.length > 0;
  return (
    <div className="overlay" onMouseDown={onClose}>
      <aside className="settingsPanel" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p>{uiText("auto.df3d58c7d84b")}</p>
            <h2>{uiText("auto.1c39e6a19bda")}</h2>
          </div>
          <button onClick={onClose}>×</button>
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
                {uiText("auto.dc9591e56d50")}{taskCounts.active}
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
                {filteredDesktopOperations.map((task) => {
                  const terminal =
                    task.phase === "installed" ||
                    task.phase === "uninstalled";
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
                      {task.lastError && <em>{task.lastError}</em>}
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
                          {task.operation === "deploy"
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
                      {task.message && <em>{task.message}</em>}
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
                    task.phase === "paused" || task.phase === "failed";
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
                      {(canPause || canResume) && (
                        <button
                          disabled={changing}
                          onClick={() =>
                            canPause
                              ? onPauseDownloadTask(task.productId)
                              : onResumeDownloadTask(task.productId)
                          }
                        >
                          {canPause ? uiText("auto.8d12fc0d4eb2") : uiText("auto.7c9691192f1b")}
                        </button>
                      )}
                      {!["completed", "canceled"].includes(task.phase) && (
                        <button
                          disabled={changing}
                          onClick={() => onCancelDownloadTask(task.productId)}
                        >
                          {task.phase === "canceling"
                            ? uiText("auto.e8e08b0f61dd")
                            : uiText("auto.185a34ac72db")}
                        </button>
                      )}
                      {task.phase === "completed" && (
                        <>
                          <button
                            onClick={() =>
                              onOpenCompletedDownloadTask(task.productId)
                            }
                          >
                            {uiText("auto.1c9b810ab5b0")}</button>
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
                      {task.errorMessage && <em>{task.errorMessage}</em>}
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
            <button onClick={onChooseCliDirectory}>{uiText("auto.38418cc70d55")}</button>
          </div>
        </SettingBlock>

        <SettingBlock title={uiText("auto.68ecdf839c52")}>
          <button className="scanButton" onClick={onScan} disabled={scanning}>
            {scanning ? uiText("auto.3a1abf3422d2") : uiText("auto.aab6c5f64108")}
          </button>
          {environment && (
            <div className="environmentList">
              {environment.checks.map((check) => {
                const environmentStage =
                  environmentPackageStages[check.id];
                const environmentDownloadTask =
                  downloadTasks[`environment:${check.id}`];
                const operationBusy =
                  environmentStageIsBusy(environmentStage);
                const operationNeedsCheck =
                  environmentStageNeedsCheck(environmentStage);
                return (
                  <div key={check.id}>
                    <span
                      className={check.installed ? "statusDot ok" : "statusDot"}
                    />
                    <b>{check.name}</b>
                    <small>
                      {check.installed
                        ? uiText("auto.a8b6c39dcabf")
                        : check.detection === "unknown"
                          ? uiText("auto.89a7e9d49a47")
                          : uiText("auto.156219e305f6")}
                    </small>
                    {check.installed ? (
                      <>
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
                          onClick={() =>
                            onCancelDownloadTask(environmentDownloadTask.productId)
                          }
                        >
                          {environmentDownloadTask.phase === "canceling"
                            ? uiText("auto.e36f3187b31a")
                            : uiText("auto.6afefc66ccdd")}
                        </button>
                      )}
                    {environmentMessages[check.id] && (
                      <em>{environmentMessages[check.id]}</em>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SettingBlock>

        <SettingBlock title={uiText("auto.42e40f432b6d")}>
          <p className="pathValue">
            {uiText("auto.435bd0f89db5")}{updateResult?.currentVersion || "0.1.0"}
          </p>
          <div className="rowActions">
            <button onClick={onCheckForUpdate} disabled={checkingUpdate}>
              {checkingUpdate ? uiText("auto.fb11aa6f2982") : uiText("auto.7f68ebad19ba")}
            </button>
            <button
              onClick={onOpenUpdate}
              disabled={
                updateResult?.status !== "available" || installingUpdate
              }
            >
              {installingUpdate ? uiText("auto.f324661ed993") : uiText("auto.fe31585819ad")}
            </button>
          </div>
          {updateResult && <em>{updateResult.message}</em>}
          {updateInstallMessage && <em>{updateInstallMessage}</em>}
          {updateResult?.notes?.length ? (
            <ul className="updateNotes">
              {updateResult.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          ) : null}
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
    </div>
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
  return (
    <span
      className={`vendorMark${large ? " large" : ""}${hero ? " heroMark" : ""}`}
      style={{ background: vendor.color }}
    >
      {vendor.iconUrl ? (
        <img src={vendor.iconUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        vendor.mark
      )}
    </span>
  );
}
