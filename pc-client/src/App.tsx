import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { runEnvironmentInstall } from "@aihub-shared/environment-install-flow.cjs";
import { runDownloadedPackageAction } from "@aihub-shared/downloaded-package-action.cjs";
import { getProductInstallPresentation } from "@aihub-shared/product-install-presentation.cjs";
import { resolveProductBehavior } from "@aihub-shared/product-policy.cjs";
import { getUninstallPresentation } from "@aihub-shared/uninstall-presentation.cjs";
import {
  categories,
  Product,
  ProductCategory,
  ProductKind,
  Vendor,
  vendors as builtInVendors
} from "./data";

type View = "home" | "vendors" | "community";
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
type Language = "zh" | "en";
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
      return "正在检测下载源…";
    case "downloading":
      return `暂停 ${environmentName} 下载`;
    case "paused":
      return "继续下载";
    case "download-error":
      return "重试下载";
    case "ready":
      return "打开安装包";
    case "opening-install":
      return "正在打开安装程序…";
    case "awaiting-install":
      return "等待完成安装…";
    case "opening-uninstall":
      return "正在打开卸载程序…";
    case "awaiting-uninstall":
      return "正在确认卸载…";
    case "timed-out-install":
    case "timed-out-uninstall":
      return "立即检测";
    default:
      return idleLabel;
  }
}

function environmentUninstallButtonLabel(
  stage?: EnvironmentPackageStage
) {
  switch (stage) {
    case "opening-install":
      return "正在打开安装程序…";
    case "awaiting-install":
      return "正在确认安装…";
    case "opening-uninstall":
      return "正在打开卸载程序…";
    case "awaiting-uninstall":
      return "正在确认卸载…";
    case "timed-out-install":
    case "timed-out-uninstall":
      return "立即检测";
    default:
      return "一键卸载";
  }
}

function managedDownloadPhaseLabel(task: ManagedDownloadTask) {
  switch (task.phase) {
    case "starting":
      return "准备下载";
    case "downloading":
      return "正在下载";
    case "pausing":
      return "正在暂停";
    case "paused":
      return "已暂停";
    case "canceling":
      return "正在取消";
    case "failed":
      return "下载失败";
    case "completed":
      return "已完成";
    default:
      return "已取消";
  }
}

function operationTaskPhaseLabel(
  operation: "install" | "uninstall",
  phase: DesktopOperationTask["phase"] | EnvironmentOperationTask["phase"]
) {
  if (phase === "installed") return "安装完成";
  if (phase === "uninstalled") return "卸载完成";
  if (phase === "launching") {
    return operation === "install"
      ? "正在打开安装程序"
      : "正在打开卸载程序";
  }
  if (phase === "timed-out") {
    return operation === "install"
      ? "等待手动确认安装"
      : "等待手动确认卸载";
  }
  return operation === "install" ? "等待完成安装" : "等待完成卸载";
}

function cliTaskPhaseLabel(task: CliManagedTask) {
  if (task.phase === "running") {
    return task.operation === "deploy" ? "正在部署 CLI" : "正在卸载 CLI";
  }
  if (task.phase === "completed") {
    return task.operation === "deploy" ? "CLI 部署完成" : "CLI 卸载完成";
  }
  if (task.phase === "canceled") return "操作已取消";
  return task.operation === "deploy" ? "CLI 部署失败" : "CLI 卸载失败";
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
  if (seconds === null || !Number.isFinite(seconds)) return "计算中";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} 秒`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `${minutes} 分钟` : `${Math.ceil(minutes / 60)} 小时`;
}
const ENVIRONMENT_NAMES: Record<string, string> = {
  node: "Node.js",
  git: "Git",
  python: "Python",
  docker: "Docker"
};

const copy = {
  zh: {
    home: "主页",
    vendors: "全部厂商",
    community: "社区",
    navigation: "导航",
    searchPlaceholder: "精准搜索厂商或者产品",
    search: "搜索",
    settings: "设置",
    login: "登录"
  },
  en: {
    home: "Home",
    vendors: "All vendors",
    community: "Community",
    navigation: "Navigation",
    searchPlaceholder: "Search vendors or products",
    search: "Search",
    settings: "Settings",
    login: "Sign in"
  }
};

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

  const t = copy[language];
  const letters = [
    "全部",
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
      names[`environment:${environmentId}`] = `${name} 环境安装包`;
    }
    return names;
  }, [catalogVendors]);
  const operationTaskNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const vendor of catalogVendors) {
      for (const product of vendor.products) {
        names[product.id] = product.name;
      }
    }
    for (const [environmentId, name] of Object.entries(ENVIRONMENT_NAMES)) {
      names[`environment:${environmentId}`] = `${name} 环境`;
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
            ? `${name} 安装包已下载并通过数字签名验证`
            : task.phase === "paused"
              ? `${name} 下载已暂停，断点已保存${percent}`
              : task.phase === "failed"
                ? task.errorMessage || `${name} 下载失败，点击重试`
                : task.phase === "canceled"
                  ? ""
                  : `正在下载 ${name}…${percent}`
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
          task.errorMessage || "下载已暂停，已保留当前进度"
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
        [task.productId]: task.errorMessage || "下载失败"
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
          ? "正在安全暂停…"
          : task.phase === "canceling"
            ? "正在取消并清理断点…"
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
                ? "Windows 应用信息扫描暂时失败，正在继续确认卸载结果"
                : task.launchState === "unknown"
                  ? `客户端已恢复卸载任务，${uninstallCopy.activeDetail}`
                  : uninstallCopy.activeDetail
      }));
      return;
    }
    if (installedEvidenceProducts.current.has(task.productId)) return;
    if (task.phase === "timed-out") {
      setProductErrors((current) => ({
        ...current,
        [task.productId]: "安装未完成，请重试"
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
          ? "暂未检测到安装完成。若安装向导仍在运行，请完成后点击“立即检测”。"
          : task.phase === "launching"
            ? "正在验证并启动安装程序…"
            : task.lastError
              ? "Windows 应用信息扫描暂时失败，正在继续检测"
              : task.launchState === "unknown"
                ? "客户端已恢复安装任务，正在确认安装结果…"
                : "正在自动检测安装结果…"
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
          `${ENVIRONMENT_NAMES[environmentId] || environmentId} 安装包已验证`
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
          [task.environmentId]: `${name} 已安装，环境状态已自动更新`
        }));
      } else {
        installedEnvironmentEvidence.current.delete(task.environmentId);
        setEnvironmentPackageStages((current) => ({
          ...current,
          [task.environmentId]: "idle"
        }));
        setEnvironmentMessages((current) => ({
          ...current,
          [task.environmentId]: `${name} 已卸载，环境状态已自动更新`
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
            ? `暂未检测到 ${name} 安装完成。完成安装向导后，请点击“立即检测”。`
            : `暂未确认 ${name} 卸载完成。完成卸载向导后，请点击“立即检测”。`
          : task.phase === "launching"
            ? task.operation === "install"
              ? `正在验证并打开 ${name} 安装程序…`
              : `正在验证并打开 ${name} 卸载程序…`
            : task.lastError
              ? `环境扫描暂时失败，正在继续确认 ${name} 的状态`
              : task.launchState === "unknown"
                ? `客户端已恢复 ${name} ${task.operation === "install" ? "安装" : "卸载"}任务，正在确认结果…`
                : `正在自动确认 ${name} ${task.operation === "install" ? "安装" : "卸载"}结果…`
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
                `${ENVIRONMENT_NAMES[environmentId] || environmentId} 安装包已验证`
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
                      [product.id]: "下载已暂停，点击继续下载"
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
                  ? "启动恢复时暂时无法可靠确认该 CLI 的安装状态"
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
            ? "正在下载 AI Hub 更新…"
            : `正在下载 AI Hub 更新… ${progress.percent}%`
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
              ? `正在下载 ${name}…`
              : `正在下载 ${name}… ${progress.percent}%`
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
          result.error || result.task?.errorMessage || "无法继续下载任务"
        );
      }
    } catch (error) {
      setDownloadTaskError(
        productId,
        error instanceof Error ? error.message : "无法继续下载任务"
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
          result.error || result.task?.errorMessage || "无法暂停下载任务"
        );
      }
    } catch (error) {
      setDownloadTaskError(
        productId,
        error instanceof Error ? error.message : "无法暂停下载任务"
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
          result.error || result.task?.errorMessage || "无法取消下载任务"
        );
      }
    } catch (error) {
      setDownloadTaskError(
        productId,
        error instanceof Error ? error.message : "无法取消下载任务"
      );
    }
  };

  const openCompletedDownloadTask = async (productId: string) => {
    if (productId.startsWith("environment:")) {
      await openEnvironmentInstaller(
        productId.slice("environment:".length)
      );
      return;
    }
    const product = catalogVendors
      .flatMap((vendor) => vendor.products)
      .find((candidate) => candidate.id === productId);
    if (!product) {
      setDownloadTaskError(productId, "当前目录中找不到该产品");
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
          result.error || "无法打开安装包所在文件夹"
        );
      }
    } catch (error) {
      setDownloadTaskError(
        productId,
        error instanceof Error
          ? error.message
          : "无法打开安装包所在文件夹"
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
          result.error || "无法清除下载记录"
        );
        return;
      }
      removeClearedDownloadTask(productId);
    } catch (error) {
      setDownloadTaskError(
        productId,
        error instanceof Error ? error.message : "无法清除下载记录"
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
          error instanceof Error ? error.message : "无法清除已完成任务"
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
      [environmentId]: `正在验证并打开 ${name} 安装程序…`
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
          "无法打开该环境安装包"
      }));
    } catch (error) {
      await restoreEnvironmentPackage(environmentId, false);
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]:
          error instanceof Error ? error.message : "无法打开该环境安装包"
      }));
    }
  };

  const openEnvironmentLocation = async (environmentId: string) => {
    if (!window.aihubPC) return;
    const opened = await window.aihubPC.openEnvironmentLocation(environmentId);
    if (!opened) {
      setEnvironmentMessages((current) => ({
        ...current,
        [environmentId]: "未找到可打开的软件位置，请重新检测"
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
      [environmentId]: `正在验证并打开 ${name} 卸载程序…`
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
          "未能打开该环境的卸载程序"
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
            : "未能打开该环境的卸载程序"
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
          error instanceof Error ? error.message : "环境检测暂时失败，请重试"
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
              : "Windows 应用信息扫描暂时失败"
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
          [product.id]: "Windows 应用信息扫描暂时失败，尚不能确认是否已安装"
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
              : "暂时无法可靠确认该 CLI 的安装状态"
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
          [product.id]: "暂时无法可靠确认该 CLI 的安装状态"
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
        [product.id]: "请在 PC 客户端中下载"
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
          [product.id]: result.error || "无法启动下载任务"
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
          error instanceof Error ? error.message : "无法启动下载任务"
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
            "旧位置的下载断点尚未清理，无法在新位置重新下载"
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
            : "无法在新位置重新开始下载"
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
          [product.id]: inspection.error || "安装包验证失败"
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
            "安装程序没有保持运行，请重试或检查 Windows 安全记录"
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
            "安装程序已打开，请完成厂商安装向导后点击“立即检测”。"
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
            ? `无法启动安装程序：${error.message}`
            : "无法启动安装程序，请重试"
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
            ? `无法检查本地安装包：${error.message}`
            : "无法检查本地安装包"
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
            ? `Windows 应用信息扫描暂时失败：${error.message}`
            : "Windows 应用信息扫描暂时失败，请重试"
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
            ? "Windows 应用信息扫描暂时失败，正在继续检测"
            : "尚未检测到安装完成，请完成厂商安装向导后重试"
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
            result.error || "未能打开该产品的可信卸载程序"
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
            ? `无法启动卸载程序：${error.message}`
            : "无法启动卸载程序，请重试"
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
              ? `Windows 应用信息扫描暂时失败：${error.message}`
              : "Windows 应用信息扫描暂时失败，请重试"
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
          ? "Windows 应用信息扫描暂时失败，尚不能确认卸载完成"
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
      setDownloadTaskError(productId, "当前目录中找不到该产品");
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
      "正在启动官方 CLI 部署方案"
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
        error instanceof Error ? error.message : "CLI 部署失败"
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]: error instanceof Error ? error.message : "CLI 部署失败"
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
        "用户取消了 CLI 部署"
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
        result.error || "CLI 部署失败"
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]: result.error || "CLI 部署失败"
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
          : "CLI 已部署，但暂时无法确认安装状态"
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]:
          error instanceof Error
            ? error.message
            : "CLI 已部署，但暂时无法确认安装状态"
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
          ? "部署进程已结束，但暂时无法可靠确认 CLI 状态"
          : "部署进程已结束，但未检测到有效的 CLI 安装";
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
      result.warning || `${product.name} CLI 部署完成`
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
      "正在安全卸载 AI Hub 管理的 CLI 软件包"
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
          error instanceof Error ? error.message : "CLI 卸载状态未知"
        );
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            error instanceof Error ? error.message : "CLI 卸载状态未知"
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
          `${product.name} CLI 已卸载`
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
        error instanceof Error ? error.message : "CLI 卸载失败"
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]: error instanceof Error ? error.message : "CLI 卸载失败"
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
        "用户取消了 CLI 卸载"
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
            : "卸载操作已结束，但暂时无法确认 CLI 状态"
        );
        setProductErrors((current) => ({
          ...current,
          [product.id]:
            error instanceof Error
              ? error.message
              : "卸载操作已结束，但暂时无法确认 CLI 状态"
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
          `${product.name} CLI 已卸载`
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
        result.error || "CLI 卸载失败"
      );
      setProductErrors((current) => ({
        ...current,
        [product.id]: result.error || "CLI 卸载失败"
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
          ? "卸载操作已结束，但暂时无法可靠确认结果"
          : "卸载操作已结束，但仍检测到该 CLI";
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
      `${product.name} CLI 已卸载`
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
      "正在重新检测 CLI 安装状态"
    );
    let status: CliStatus;
    try {
      status = await window.aihubPC.getCliStatus(productId);
    } catch (error) {
      if (!isCurrentProductOperation(productId, generation)) return;
      const message =
        error instanceof Error ? error.message : "暂时无法可靠确认 CLI 状态";
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
          ? `${product.name} CLI 已确认安装`
          : `${product.name} CLI 已确认卸载`;
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
        ? "暂时无法可靠确认 CLI 安装状态"
        : task.operation === "deploy"
          ? `${product.name} CLI 仍未安装`
          : `${product.name} CLI 仍然存在`;
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

  const checkForUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateInstallMessage("");
    try {
      const result = window.aihubPC
        ? await window.aihubPC.checkForUpdate()
        : {
            status: "disabled" as const,
            currentVersion: "0.1.0",
            message: "浏览器预览不提供更新通道"
          };
      setUpdateResult(result);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    if (!window.aihubPC || installingUpdate) return;
    setInstallingUpdate(true);
    setUpdateInstallMessage("正在准备更新安装包…");
    try {
      const result = await window.aihubPC.openUpdateDownload();
      if (result.ok) {
        setUpdateInstallMessage(
          result.warning
            ? `更新安装器已启动；${result.warning}`
            : "更新安装器已启动，请按 Windows 安装向导完成更新"
        );
        return;
      }
      setUpdateInstallMessage(result.error || "更新安装未完成");
    } catch (error) {
      setUpdateInstallMessage(
        error instanceof Error ? error.message : "更新安装未完成"
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
        [productId]: `${label}正在处理，请勿重复点击`
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
    runExclusiveProductAction(product.id, "安装", () =>
      installUsingUnifiedRule(product)
    );

  const requestCliUninstall = (product: Product) =>
    runExclusiveProductAction(product.id, "CLI 卸载", () =>
      uninstallCli(product)
    );
  const requestDesktopUninstall = (product: Product) =>
    runExclusiveProductAction(product.id, "卸载", () =>
      uninstallDesktopProduct(product)
    );

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
          <small>PC</small>
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
          <button className="quietButton" onClick={() => setSettingsOpen(true)}>
            ⚙ {t.settings}
          </button>
          <button
            className="accentButton"
            onClick={() => setAuthOpen(true)}
          >
            {identity.status === "authenticated"
              ? identity.user.profile.nickname
              : t.login}
          </button>
        </div>
      </header>

      <div className="workspace">
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

        <main className="content">
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
          ) : (
            <FlarumCommunityPage
              identity={identity}
              onLogin={() => setAuthOpen(true)}
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
          onLanguage={setLanguage}
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
            runExclusiveProductAction(productId, "CLI 重试", () =>
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
          <div className="bannerControls" aria-label="轮播页切换">
            {banners.map((item, index) => (
              <button
                key={item.title}
                className={bannerIndex === index ? "active" : ""}
                aria-label={`切换到第 ${index + 1} 页`}
                onClick={() => setBannerIndex(index)}
              />
            ))}
          </div>
        </div>
        <div className="heroVisual">
          <div className="orbit orbitOne" />
          <div className="orbit orbitTwo" />
          <div className="heroCore">
            <b>AI</b>
            <small>HUB PC</small>
          </div>
        </div>
      </section>

      <section className="homeSection">
        <div className="sectionHeading">
          <div>
            <p>后台精选</p>
            <h2>精选 AI 厂商</h2>
          </div>
          <button onClick={onOpenVendors}>全部厂商 →</button>
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
                <small>厂商</small>
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
        <p>全部厂商</p>
        <h1>所有 AI 厂商</h1>
        <span>选择厂商后，查看该厂商旗下的全部 AI 产品。</span>
      </header>

      <section className="filters">
        <FilterRow
          label="工具特性"
          values={categories}
          active={category}
          onChange={(value) => onCategory(value as "全部" | ProductCategory)}
        />
        <FilterRow
          label="从 A–Z 排列"
          values={letters}
          active={letter}
          onChange={onLetter}
        />
      </section>

      <div className="directorySummary">
        <b>{search.trim() ? `“${search.trim()}” 的搜索结果` : "厂商目录"}</b>
        <span>{visible.length} 个厂商</span>
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
              <span>{vendor.products.length} 个产品</span>
            </div>
            <h2>{vendor.name}</h2>
            <p>{vendor.description}</p>
            <div className="productTags">
              {vendor.products.map((product) => (
                <span key={product.id}>{product.name}</span>
              ))}
            </div>
            <footer>
              <span>{vendor.products.length} 个产品</span>
              <b>查看厂商 →</b>
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
      <button className="backButton" onClick={onBack}>← 返回全部厂商</button>
      <section className="vendorHero">
        <VendorMark vendor={vendor} hero />
        <div>
          <p>厂商描述</p>
          <h1>{vendor.name}</h1>
          <span>{vendor.description}</span>
        </div>
        <button className="quietButton" onClick={() => window.open(vendor.website)}>
          厂商官网 ↗
        </button>
      </section>

      <section className="vendorProducts">
        <div className="sectionHeading">
          <div>
            <p>厂商产品</p>
            <h2>{vendor.name} 的所有 AI 产品</h2>
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
          <p>使用教学</p>
          <h2>{vendor.name} 产品使用教学</h2>
        </div>
        <button onClick={() => window.open(vendor.tutorial)}>
          跳转到该厂商教学页面 ↗
        </button>
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
      ? "一键安装"
      : product.productType === "desktop-official"
        ? "获取官方安装包"
        : "打开产品");
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
      ? "正在连接官方下载源…"
      : downloadTask?.phase === "pausing"
        ? "正在安全暂停…"
        : downloadTask?.phase === "canceling"
          ? "正在取消并清理断点…"
          : `正在下载${progress === null ? "…" : ` ${progress}%`}`;
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
            ? "打开网页"
            : product.productType === "desktop-official"
              ? "前往官方下载"
              : product.kind === "CLI"
                ? "CLI 官网"
                : product.kind === "桌面端"
                  ? "工具官网"
                  : "产品官网"} ↗
        </button>
      )}
      {behavior.canOpenTutorial &&
        (!behavior.canOpenWebsite || product.tutorial !== product.website) && (
          <button
            className="websiteButton"
            onClick={() => window.open(product.tutorial)}
          >
            打开教程 ↗
          </button>
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
              <span>缺少：{missing.join("、")}</span>
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
                        `安装 ${environmentName}`
                      )}
                    </button>
                  );
                })}
              </div>
              <small>
                {environmentStatus ||
                  "完成官方安装后，点击“重新检测”继续。"}
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
          {(stage === "deploying" || stage === "removing-cli") && (
            <div className="cliLog">
              <b>{stage === "removing-cli" ? "正在安全卸载…" : "正在部署…"}</b>
              {logs.length ? (
                logs.map((entry, index) => (
                  <span className={entry.stream} key={`${index}-${entry.line}`}>
                    {entry.line}
                  </span>
                ))
              ) : (
                <span>
                  {stage === "removing-cli"
                    ? "正在移除 AI Hub 管理的软件包"
                    : "正在启动官方安装方案"}
                </span>
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
                    {downloadTask?.phase === "pausing" ? "暂停中…" : "暂停"}
                  </button>
                  <button
                    disabled={downloadTaskChanging}
                    onClick={onCancelDownload}
                  >
                    {downloadTask?.phase === "canceling"
                      ? "取消中…"
                      : "取消任务"}
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
                  {" · 剩余 "}
                  {formatDuration(downloadDetail.etaSeconds)}
                </small>
              )}
              {downloadDetail?.availableBytes !== undefined && (
                <small>
                  下载空间：需要 {formatBytes(downloadDetail.requiredBytes || 0)}
                  {" · "}
                  可用 {formatBytes(downloadDetail.availableBytes)}
                  {downloadDetail.installDiskBytes
                    ? ` · 安装建议预留 ${formatBytes(downloadDetail.installDiskBytes)}`
                    : ""}
                </small>
              )}
              {downloadDetail?.installSpaceOk === false && (
                <small className="spaceWarning">
                  默认安装盘空间可能不足；可以先暂停并清理空间，或在安装器中改用其他磁盘。
                </small>
              )}
              <div className="downloadProgressTrack">
                <i style={{ width: `${progress ?? 12}%` }} />
              </div>
            </div>
          )}
          {stage === "paused" && (
            <div className="blockedState">
              <span>{error || "下载已暂停，已保留当前进度"}</span>
              {downloadDetail && downloadDetail.receivedBytes > 0 && (
                <small>
                  已保留 {formatBytes(downloadDetail.receivedBytes)}
                  {downloadDetail.totalBytes > 0
                    ? ` / ${formatBytes(downloadDetail.totalBytes)}`
                    : ""}
                </small>
              )}
              <div className="missingEnvironmentActions">
                <button onClick={onInstallProduct}>
                  {downloadTask?.resumable ? "继续原位置下载" : "重新开始"}
                </button>
                <button onClick={onRelocateDownload}>
                  更换位置并重新下载
                </button>
                <button onClick={onCancelDownload}>取消任务</button>
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
            ["launching-installer", "awaiting-verification"].includes(stage) && (
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
              <button onClick={onRecheckDesktopUninstall}>立即检测</button>
            </div>
          )}
          {stage === "detection-error" && (
            <div className="verificationState">
              <span>
                {cliDeployable
                  ? "暂时无法确认 CLI 安装状态"
                  : "暂时无法确认 Windows 安装状态"}
              </span>
              {error && <small>{error}</small>}
              <button onClick={onInstallProduct}>重新检测并安装</button>
            </div>
          )}
          {stage === "error" && (
            <div className="blockedState">
              <span>{error}</span>
              <div className="missingEnvironmentActions">
                <button onClick={onInstallProduct}>
                  {cliDeployable
                    ? "重新安装"
                    : downloadTask?.resumable
                      ? "继续安装"
                      : "重新安装"}
                </button>
                {product.download &&
                  downloadTask &&
                  downloadTask.phase !== "completed" && (
                  <button onClick={onCancelDownload}>取消任务</button>
                )}
                {product.download && (
                  <button onClick={onRelocateDownload}>
                    更换位置并重新下载
                  </button>
                )}
              </div>
            </div>
          )}
          {stage === "installed" && (
            <div className="installedActions">
              <b className="successState">
                已安装
                {desktopStatus?.version
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
                    打开软件
                  </button>}
                  {behavior.canOpenInstalled && <button
                    disabled={!desktopStatus.location}
                    onClick={onOpenDesktopLocation}
                  >
                    打开安装位置
                  </button>}
                  {behavior.canUninstall && desktopStatus.canUninstall && (
                    <button onClick={onUninstallDesktop}>卸载</button>
                  )}
                </>
              )}
              {behavior.canUninstall &&
                cliDeployable &&
                cliStatus?.canUninstall && (
                <button onClick={onUninstallCli}>卸载</button>
              )}
              {cliDeployable && cliStatus?.installed && !cliStatus.managed && (
                <small className="installedNote">
                  {cliStatus.ownership === "mismatch"
                    ? "版本或安装内容已变化，AI Hub 不会自动卸载"
                    : "此安装不是由 AI Hub 部署，客户端不会接管或卸载"}
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
  const [mode, setMode] = useState<"login" | "register" | "account">(
    identity.status === "authenticated" ? "account" : "login"
  );
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<RegistrationChallenge | null>(
    null
  );
  const [sessions, setSessions] = useState<IdentityDeviceSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (mode !== "account" || identity.status !== "authenticated") return;
    window.aihubPC
      ?.listIdentitySessions()
      .then(setSessions)
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : "无法读取设备会话")
      );
  }, [mode, identity]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作没有完成");
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
      setMode("account");
      setPassword("");
    });
  };

  const requestCode = () =>
    run(async () => {
      if (!window.aihubPC) return;
      setChallenge(await window.aihubPC.requestRegistrationCode(email));
      setMessage("验证码已发送，请在本地邮件箱中查看");
    });

  const submitRegistration = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (!window.aihubPC || !challenge) {
        setMessage("请先获取邮箱验证码");
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
      setMode("account");
      setPassword("");
      setCode("");
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
            <p>AI Hub 统一账号</p>
            <h2>
              {mode === "login"
                ? "登录"
                : mode === "register"
                  ? "注册"
                  : "个人中心"}
            </h2>
          </div>
          <button onClick={onClose}>×</button>
        </header>

        {mode === "login" && (
          <form className="authForm" onSubmit={submitLogin}>
            <label>
              邮箱或用户名
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="accentButton" disabled={busy}>
              {busy ? "登录中…" : "登录"}
            </button>
            <button type="button" onClick={() => setMode("register")}>
              创建新账号
            </button>
          </form>
        )}

        {mode === "register" && (
          <form className="authForm" onSubmit={submitRegistration}>
            <label>
              邮箱
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <div className="verificationRow">
              <label>
                邮箱验证码
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
              </label>
              <button type="button" disabled={busy} onClick={requestCode}>
                获取验证码
              </button>
            </div>
            {challenge?.localMailViewerUrl && (
              <button
                type="button"
                onClick={() => window.open(challenge.localMailViewerUrl)}
              >
                打开本地邮件箱
              </button>
            )}
            <label>
              用户名
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              社区昵称
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="默认使用用户名"
              />
            </label>
            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                required
              />
              <small>至少 10 位，同时包含字母和数字</small>
            </label>
            <button className="accentButton" disabled={busy}>
              {busy ? "注册中…" : "完成注册"}
            </button>
            <button type="button" onClick={() => setMode("login")}>
              返回登录
            </button>
          </form>
        )}

        {mode === "account" && identity.status === "authenticated" && (
          <div className="accountPanel">
            <div className="accountIdentity">
              <span className="accountAvatar">
                {identity.user.profile.nickname.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <b>{identity.user.profile.nickname}</b>
                <small>{identity.user.email}</small>
                <small>@{identity.user.username}</small>
              </div>
            </div>
            <h3>设备会话</h3>
            <div className="sessionList">
              {sessions.map((session) => (
                <article key={session.id}>
                  <div>
                    <b>{session.deviceName}</b>
                    <small>
                      {session.current ? "当前设备" : "其他设备"} ·{" "}
                      {new Date(session.lastSeenAt).toLocaleString()}
                    </small>
                  </div>
                  {!session.current && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await window.aihubPC?.revokeIdentitySession(
                            session.id
                          );
                          setSessions((current) =>
                            current.filter((item) => item.id !== session.id)
                          );
                        })
                      }
                    >
                      撤销
                    </button>
                  )}
                </article>
              ))}
            </div>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (!window.aihubPC) return;
                  onIdentity(await window.aihubPC.logout());
                  setMode("login");
                })
              }
            >
              退出登录
            </button>
          </div>
        )}
        {message && <p className="authMessage">{message}</p>}
      </section>
    </div>
  );
}

function FlarumCommunityPage({
  identity,
  onLogin
}: {
  identity: IdentitySnapshot;
  onLogin: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const openCommunity = async () => {
    if (identity.status !== "authenticated") {
      onLogin();
      return;
    }
    if (!window.aihubPC) return;
    setBusy(true);
    setError("");
    try {
      await window.aihubPC.openCommunity();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法打开社区");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="communityPage">
      <header className="communityHeader">
        <div>
          <p>FLARUM · OPEN SOURCE</p>
          <h1>AI Hub 社区</h1>
          <span>社区由 Flarum 驱动，账号与 AI Hub 统一。</span>
        </div>
      </header>
      <div className="communityLaunchCard">
        <div>
          <b>在系统浏览器中进入社区</b>
          <p>
            发帖、回复、通知和社区权限由 Flarum 提供。已登录用户无需再次输入账号密码。
          </p>
          <small>本地预发布环境 · Flarum 2.0 RC</small>
        </div>
        <button className="accentButton" disabled={busy} onClick={openCommunity}>
          {identity.status !== "authenticated"
            ? "登录后进入"
            : busy
              ? "正在打开…"
              : "进入社区 ↗"}
        </button>
      </div>
      {error && <em>{error}</em>}
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
        setActionError(error instanceof Error ? error.message : "发布失败")
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
        setActionError(error instanceof Error ? error.message : "回复失败")
      )
      .finally(() => setBusy(false));
  };

  if (selected) {
    return (
      <section className="communityPage">
        <button onClick={onBack}>← 返回社区</button>
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
              placeholder="写下你的回复"
              required
            />
            <button className="accentButton" disabled={busy}>
              发布回复
            </button>
          </form>
        ) : (
          <button className="accentButton" onClick={onLogin}>
            登录后回复
          </button>
        )}
        {actionError && <em>{actionError}</em>}
      </section>
    );
  }

  return (
    <section className="communityPage">
      <header className="communityHeader">
        <div>
          <p>AI HUB COMMUNITY</p>
          <h1>社区</h1>
          <span>分享 AI 工具的安装经验、使用方法和工作流。</span>
        </div>
        <div className="rowActions">
          <button onClick={() => void onRefresh()}>刷新</button>
          <button
            className="accentButton"
            onClick={
              identity.status === "authenticated"
                ? () => setComposerOpen(true)
                : onLogin
            }
          >
            {identity.status === "authenticated" ? "发起讨论" : "登录后发帖"}
          </button>
        </div>
      </header>
      {composerOpen && (
        <form className="discussionComposer" onSubmit={submitDiscussion}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="讨论标题"
            minLength={3}
            required
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="描述你的问题、经验或工作流"
            minLength={3}
            required
          />
          <div className="rowActions">
            <button type="button" onClick={() => setComposerOpen(false)}>
              取消
            </button>
            <button className="accentButton" disabled={busy}>
              发布
            </button>
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
            <span>{discussion.replyCount} 条回复</span>
          </button>
        ))}
        {!discussions.length && !error && (
          <div className="emptyPanel">
            <b>还没有讨论</b>
            <small>登录后发布第一条社区内容。</small>
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
          进入社区 ↗
        </button>
      ) : (
        <b>预发布环境尚未对外开放</b>
      )}
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
            <p>设置</p>
            <h2>PC 客户端设置</h2>
          </div>
          <button onClick={onClose}>×</button>
        </header>

        <SettingBlock title="主题颜色">
          <div className="segmented">
            <button className={theme === "light" ? "active" : ""} onClick={() => onTheme("light")}>白色</button>
            <button className={theme === "dark" ? "active" : ""} onClick={() => onTheme("dark")}>黑色</button>
          </div>
        </SettingBlock>

        <SettingBlock title="安装包下载位置（PC 端）">
          <p className="pathValue">{downloadDirectory || "未设置，将在下载页面选择"}</p>
          <div className="rowActions">
            <button onClick={onChooseDirectory}>选择位置</button>
            <button disabled={!downloadDirectory} onClick={onOpenDirectory}>打开文件夹</button>
            <button disabled={!downloadDirectory} onClick={onClearDirectory}>删除</button>
          </div>
        </SettingBlock>

        <SettingBlock title="任务中心">
          <div className="taskCenterToolbar">
            <div className="taskFilters" role="group" aria-label="任务筛选">
              <button
                className={taskFilter === "active" ? "active" : ""}
                aria-pressed={taskFilter === "active"}
                onClick={() => setTaskFilter("active")}
              >
                进行中 {taskCounts.active}
              </button>
              <button
                className={taskFilter === "failed" ? "active" : ""}
                aria-pressed={taskFilter === "failed"}
                onClick={() => setTaskFilter("failed")}
              >
                失败 {taskCounts.failed}
              </button>
              <button
                className={taskFilter === "completed" ? "active" : ""}
                aria-pressed={taskFilter === "completed"}
                onClick={() => setTaskFilter("completed")}
              >
                已完成 {taskCounts.completed}
              </button>
            </div>
            {taskFilter === "completed" && taskCounts.completed > 0 && (
              <button
                className="clearCompletedTasks"
                onClick={onClearCompletedTasks}
              >
                清除全部已完成
              </button>
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
                          {task.operation === "install" ? " · 安装" : " · 卸载"}
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
                          立即检测
                        </button>
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
                          {task.operation === "install" ? " · 安装" : " · 卸载"}
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
                          立即检测
                        </button>
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
                            ? " · CLI 部署"
                            : " · CLI 卸载"}
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
                                重试
                              </button>
                              <button
                                onClick={() =>
                                  onRecheckCliManagedTask(task.productId)
                                }
                              >
                                重新检测
                              </button>
                            </>
                          )}
                          <button
                            onClick={() =>
                              onClearCliManagedTask(task.productId)
                            }
                          >
                            清除
                          </button>
                        </div>
                      )}
                      {task.message && <em>{task.message}</em>}
                      {logs.length > 0 && (
                        <details className="managedCliTaskLog">
                          <summary>查看运行日志（{logs.length}）</summary>
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
                          {canPause ? "暂停" : "继续"}
                        </button>
                      )}
                      {!["completed", "canceled"].includes(task.phase) && (
                        <button
                          disabled={changing}
                          onClick={() => onCancelDownloadTask(task.productId)}
                        >
                          {task.phase === "canceling"
                            ? "正在取消…"
                            : "取消并清除断点"}
                        </button>
                      )}
                      {task.phase === "completed" && (
                        <>
                          <button
                            onClick={() =>
                              onOpenCompletedDownloadTask(task.productId)
                            }
                          >
                            打开安装包
                          </button>
                          <button
                            onClick={() =>
                              onShowDownloadInFolder(task.productId)
                            }
                          >
                            打开所在文件夹
                          </button>
                          <button
                            onClick={() =>
                              onClearDownloadHistory(task.productId)
                            }
                          >
                            清除记录
                          </button>
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
                  ? "当前没有进行中任务"
                  : taskFilter === "failed"
                    ? "当前没有失败任务"
                    : "当前没有已完成任务"}
              </p>
            )}
          </div>
        </SettingBlock>

        <SettingBlock title="CLI 工具安装位置（PC 端）">
          <p className="pathValue">
            {cliInstallDirectory || "未设置，将在首次部署 CLI 时选择"}
          </p>
          <div className="rowActions">
            <button onClick={onChooseCliDirectory}>选择位置</button>
          </div>
        </SettingBlock>

        <SettingBlock title="手动环境检测（PC 端）">
          <button className="scanButton" onClick={onScan} disabled={scanning}>
            {scanning ? "检测中…" : "开始检测"}
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
                        ? "已安装"
                        : check.detection === "unknown"
                          ? "暂时无法确认"
                          : "未安装"}
                    </small>
                    {check.installed ? (
                      <>
                        <button
                          disabled={!check.location || operationBusy}
                          onClick={() => onOpenEnvironmentLocation(check.id)}
                        >
                          打开软件安装位置
                        </button>
                        <button
                          disabled={
                            operationBusy ||
                            (!operationNeedsCheck && !check.canUninstall)
                          }
                          title={
                            operationNeedsCheck
                              ? "立即重新检测当前安装或卸载结果"
                              : check.canUninstall
                                ? "打开 Windows 登记的官方卸载程序"
                                : "未找到可信的 Windows 卸载项"
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
                          "点击安装"
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
                            ? "正在取消并清除断点…"
                            : "取消下载并清除断点"}
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

        <SettingBlock title="版本更新">
          <p className="pathValue">
            当前版本：{updateResult?.currentVersion || "0.1.0"}
          </p>
          <div className="rowActions">
            <button onClick={onCheckForUpdate} disabled={checkingUpdate}>
              {checkingUpdate ? "检查中…" : "检查更新"}
            </button>
            <button
              onClick={onOpenUpdate}
              disabled={
                updateResult?.status !== "available" || installingUpdate
              }
            >
              {installingUpdate ? "正在下载并校验…" : "下载并安装更新"}
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

        <SettingBlock title="语言">
          <div className="segmented">
            <button className={language === "zh" ? "active" : ""} onClick={() => onLanguage("zh")}>中文</button>
            <button className={language === "en" ? "active" : ""} onClick={() => onLanguage("en")}>English</button>
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
