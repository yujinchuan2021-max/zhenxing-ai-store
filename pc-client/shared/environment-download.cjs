const PLANS = Object.freeze({
  node: {
    name: "Node.js",
    recommendedVersion: "24.18.0",
    fileName: "node-v24.18.0-x64.msi",
    sources: [
      {
        id: "node-official",
        kind: "official",
        region: "global",
        label: "Node.js 官方源",
        url: "https://nodejs.org/dist/v24.18.0/node-v24.18.0-x64.msi",
        allowedHosts: ["nodejs.org"]
      },
      {
        id: "node-npmmirror",
        kind: "mirror",
        region: "china",
        label: "npmmirror 镜像",
        url: "https://npmmirror.com/mirrors/node/v24.18.0/node-v24.18.0-x64.msi",
        allowedHosts: ["npmmirror.com", "cdn.npmmirror.com"]
      }
    ]
  },
  git: {
    name: "Git",
    recommendedVersion: "2.55.0.3",
    fileName: "Git-2.55.0.3-64-bit.exe",
    sources: [
      {
        id: "git-official",
        kind: "official",
        region: "global",
        label: "Git for Windows 官方源",
        url: "https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.3/Git-2.55.0.3-64-bit.exe",
        allowedHosts: [
          "github.com",
          "release-assets.githubusercontent.com"
        ]
      }
    ]
  },
  python: {
    name: "Python",
    recommendedVersion: "3.13.14",
    fileName: "python-3.13.14-amd64.exe",
    sources: [
      {
        id: "python-official",
        kind: "official",
        region: "global",
        label: "Python 官方源",
        url: "https://www.python.org/ftp/python/3.13.14/python-3.13.14-amd64.exe",
        allowedHosts: ["www.python.org"]
      },
      {
        id: "python-huaweicloud",
        kind: "mirror",
        region: "china",
        label: "华为云镜像",
        url: "https://mirrors.huaweicloud.com/repository/toolkit/python/3.13.14/python-3.13.14-amd64.exe",
        allowedHosts: ["mirrors.huaweicloud.com"]
      }
    ]
  },
  python312: {
    name: "Python 3.12",
    recommendedVersion: "3.12.10",
    fileName: "python-3.12.10-amd64.exe",
    sources: [
      {
        id: "python312-official",
        kind: "official",
        region: "global",
        label: "Python 3.12 官方源",
        url: "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe",
        allowedHosts: ["www.python.org"]
      }
    ]
  },
  docker: {
    name: "Docker Desktop",
    recommendedVersion: "",
    fileName: "Docker Desktop Installer.exe",
    sources: [
      {
        id: "docker-official",
        kind: "official",
        region: "global",
        label: "Docker 官方源",
        url: "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe",
        allowedHosts: ["desktop.docker.com"]
      }
    ]
  }
});

const ENVIRONMENT_DOWNLOAD_PRODUCT_PREFIX = "environment:";

function validatePlan(environmentId, plan) {
  if (
    !plan ||
    typeof plan.name !== "string" ||
    typeof plan.recommendedVersion !== "string" ||
    (plan.recommendedVersion &&
      !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(plan.recommendedVersion)) ||
    !/^[^<>:"/\\|?*]+\.(exe|msi)$/i.test(plan.fileName) ||
    !Array.isArray(plan.sources) ||
    plan.sources.length < 1
  ) {
    throw new Error(`环境安装包配置无效：${environmentId}`);
  }
  for (const source of plan.sources) {
    const url = new URL(source.url);
    if (
      url.protocol !== "https:" ||
      typeof source.id !== "string" ||
      !/^[a-z0-9][a-z0-9-]{2,63}$/.test(source.id) ||
      !["official", "mirror"].includes(source.kind) ||
      !["global", "china"].includes(source.region) ||
      typeof source.label !== "string" ||
      !Array.isArray(source.allowedHosts) ||
      !source.allowedHosts.includes(url.hostname)
    ) {
      throw new Error(`环境安装包来源无效：${environmentId}`);
    }
  }
}

function getApprovedEnvironmentDownloadSources() {
  return Object.entries(PLANS).flatMap(([environmentId, plan]) =>
    plan.sources.map((source, order) =>
      Object.freeze({
        environmentId,
        sourceId: source.id,
        label: source.label,
        kind: source.kind,
        region: source.region,
        order
      })
    )
  );
}

function normalizeSourcePreferences(value) {
  const approved = getApprovedEnvironmentDownloadSources();
  if (value === undefined || typeof value === "boolean") {
    return approved.map((source) => ({
      environmentId: source.environmentId,
      sourceId: source.sourceId,
      enabled: true,
      order: source.order
    }));
  }
  if (!Array.isArray(value) || value.length !== approved.length) {
    throw new Error("下载源配置必须完整对应客户端本地白名单");
  }
  const approvedByKey = new Map(
    approved.map((source) => [
      `${source.environmentId}:${source.sourceId}`,
      source
    ])
  );
  const seen = new Set();
  const normalized = value.map((preference) => {
    const key = `${preference?.environmentId}:${preference?.sourceId}`;
    const source = approvedByKey.get(key);
    if (
      !source ||
      seen.has(key) ||
      !preference ||
      typeof preference !== "object" ||
      Array.isArray(preference) ||
      Object.keys(preference).length !== 4 ||
      Object.keys(preference).some(
        (field) =>
          !["environmentId", "sourceId", "enabled", "order"].includes(field)
      ) ||
      typeof preference.enabled !== "boolean" ||
      !Number.isInteger(preference.order) ||
      preference.order < 0 ||
      preference.order > 100
    ) {
      throw new Error("下载源配置包含未审核来源或无效参数");
    }
    seen.add(key);
    return {
      environmentId: source.environmentId,
      sourceId: source.sourceId,
      enabled: preference.enabled,
      order: preference.order
    };
  });
  for (const environmentId of Object.keys(PLANS)) {
    const enabled = normalized.filter(
      (item) => item.environmentId === environmentId && item.enabled
    );
    const officialIds = new Set(
      approved
        .filter(
          (source) =>
            source.environmentId === environmentId &&
            source.kind === "official"
        )
        .map((source) => source.sourceId)
    );
    if (!enabled.some((item) => officialIds.has(item.sourceId))) {
      throw new Error(`${environmentId} 必须保留至少一个官方源`);
    }
  }
  return normalized;
}

function getEnvironmentDownloadPlan(environmentId, sourcePreferences) {
  const plan = PLANS[environmentId];
  if (!plan) {
    throw new Error("该环境不在环境安装包白名单中");
  }
  validatePlan(environmentId, plan);
  const preferences = normalizeSourcePreferences(sourcePreferences);
  const preferenceById = new Map(
    preferences
      .filter((item) => item.environmentId === environmentId)
      .map((item) => [item.sourceId, item])
  );
  const orderedSources = [...plan.sources]
    .filter((source) => preferenceById.get(source.id)?.enabled)
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "official" ? -1 : 1;
      return (
        preferenceById.get(left.id).order -
        preferenceById.get(right.id).order
      );
    });
  return {
    name: plan.name,
    recommendedVersion: plan.recommendedVersion,
    fileName: plan.fileName,
    sources: orderedSources.map((source) => ({
      ...source,
      allowedHosts: [...source.allowedHosts]
    }))
  };
}

function environmentIdFromManagedDownload(productId) {
  if (
    typeof productId !== "string" ||
    !productId.startsWith(ENVIRONMENT_DOWNLOAD_PRODUCT_PREFIX)
  ) {
    return "";
  }
  const environmentId = productId.slice(
    ENVIRONMENT_DOWNLOAD_PRODUCT_PREFIX.length
  );
  return Object.prototype.hasOwnProperty.call(PLANS, environmentId)
    ? environmentId
    : "";
}

function getEnvironmentManagedDownloadPlan(
  productId,
  {
    preferredSourceUrl = "",
    persistedSourceUrl = "",
    sourcePreferences
  } = {}
) {
  const environmentId = environmentIdFromManagedDownload(productId);
  if (!environmentId) return null;
  const plan = getEnvironmentDownloadPlan(environmentId, sourcePreferences);
  const requestedUrl =
    preferredSourceUrl || persistedSourceUrl || plan.sources[0].url;
  const source = plan.sources.find((candidate) => candidate.url === requestedUrl);
  if (!source) return null;
  return {
    productId,
    environmentId,
    name: plan.name,
    fileName: plan.fileName,
    url: source.url,
    sourceLabel: source.label,
    allowedHosts: [...source.allowedHosts],
    safetyReserveBytes: 512 * 1024 * 1024,
    installDiskBytes: 0
  };
}

async function selectReachableSource(plan, probe) {
  if (!plan || !Array.isArray(plan.sources) || typeof probe !== "function") {
    throw new Error("环境安装包探测参数无效");
  }
  for (const source of plan.sources) {
    try {
      if (await probe(source)) return source;
    } catch {
      // A failed source is expected; continue to the next trusted candidate.
    }
  }
  throw new Error("没有可用的官方下载源或可信镜像");
}

async function downloadFromReachableSources(plan, probe, download) {
  if (
    !plan ||
    !Array.isArray(plan.sources) ||
    typeof probe !== "function" ||
    typeof download !== "function"
  ) {
    throw new Error("环境安装包下载参数无效");
  }
  let lastDownloadError = null;
  for (const source of plan.sources) {
    try {
      if (!(await probe(source))) continue;
      try {
        return {
          source,
          download: await download(source)
        };
      } catch (error) {
        lastDownloadError = error;
      }
    } catch {
      // A failed probe is expected; continue to the next trusted candidate.
    }
  }
  if (lastDownloadError instanceof Error) throw lastDownloadError;
  throw new Error("没有可用的官方下载源或可信镜像");
}

module.exports = {
  downloadFromReachableSources,
  environmentIdFromManagedDownload,
  getApprovedEnvironmentDownloadSources,
  getEnvironmentDownloadPlan,
  getEnvironmentManagedDownloadPlan,
  normalizeSourcePreferences,
  selectReachableSource
};
