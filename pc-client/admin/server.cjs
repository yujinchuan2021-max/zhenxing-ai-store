const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  normalizeCatalog,
  validateCatalog
} = require("../shared/catalog.cjs");
const {
  createSignedEnvelope
} = require("../shared/signed-release.cjs");
const {
  getApprovedEnvironmentDownloadSources,
  normalizeSourcePreferences
} = require("../shared/environment-download.cjs");
const {
  getInstallRegistration,
  publicInstallProfiles
} = require("../shared/install-registry.cjs");
const {
  publicDesktopDownloadOnlyProfiles
} = require("../shared/desktop-download-only.cjs");
const {
  getProductModule,
  moduleIdForProductType,
  publicProductModules
} = require("../shared/product-modules.cjs");
const {
  entryPointTypeMetadata
} = require("../shared/product-entry-points.cjs");
const {
  publicOfficialDownloadKinds
} = require("../shared/official-download-page.cjs");
const {
  publicResourceModules
} = require("../shared/ecosystem-resources.cjs");
const {
  RESOURCE_SOURCE_CHANNELS,
  RESOURCE_SOURCE_KINDS,
  RESOURCE_REVIEW_STATUSES,
  RESOURCE_RISK_LEVELS
} = require("../shared/resource-store.cjs");
const {
  publicExtensionInstallProfiles
} = require("../shared/extension-install-registry.cjs");
const {
  validateUpdatePayload
} = require("../shared/update-release.cjs");
const {
  createReleaseStore
} = require("./release-store.cjs");
const {
  loadSigningKey
} = require("./signing-key.cjs");
const {
  isAdminReadOnly,
  isAdminReadOnlyWriteBlocked
} = require("./read-only-mode.cjs");
const {
  createCommunityManagement
} = require("./community-management.cjs");
const {
  defaultReleaseSettings,
  mergeReleaseSettings,
  validatePublication,
  validateReleaseSettings
} = require("./config-validation.cjs");
const { createDiscoveryReview } = require("./discovery-review.cjs");
const {
  createProductCertification
} = require("./product-certification.cjs");
const { createVendorIconStore } = require("./vendor-icon-store.cjs");
const {
  vendorIconAssetFromPath
} = require("../shared/vendor-icon.cjs");
const {
  materializeLegacyVendorIconUrls
} = require("../shared/catalog-release-icon-compat.cjs");
const {
  CATALOG_JSON_BODY_LIMIT_BYTES,
  readJson
} = require("./request-json.cjs");
const { shouldSyncDiskCatalogDraft } = require("./draft-sync.cjs");
const {
  normalizeCatalogChannel,
  catalogReleasePath
} = require("../shared/catalog-channel.cjs");
const {
  readCatalogClientChannel
} = require("../shared/catalog-client-channel.cjs");
const {
  createSoftwareUpdateCenter
} = require("./software-update-center.cjs");

const host = process.env.AIHUB_ADMIN_HOST || "127.0.0.1";
const port = Number(process.env.AIHUB_ADMIN_PORT || 4173);
const adminReadOnly = isAdminReadOnly();
const publicOrigin =
  process.env.AIHUB_ADMIN_PUBLIC_ORIGIN || `http://${host}:${port}`;
const adminWriteOrigins = new Set(
  [publicOrigin, ...(process.env.AIHUB_ADMIN_WRITE_ORIGINS || "").split(",")]
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin)
);
const catalogAssetOrigin = process.env.AIHUB_CATALOG_ASSET_ORIGIN || "";
const communityManagement = createCommunityManagement();
const root = path.resolve(__dirname, "..");
const publicDirectory = path.join(__dirname, "public");
const draftPath = path.join(__dirname, "data", "catalog-v1.json");
const publishedDirectory = path.join(__dirname, "published");
const releaseStoreDirectory = path.join(publishedDirectory, "catalog-store");
const releaseSettingsPath = path.join(__dirname, "data", "release-settings.json");
const vendorIconSourcePath = path.join(
  __dirname,
  "data",
  "vendor-icon-sources.json"
);
const vendorIconFallbackPath = path.join(
  __dirname,
  "data",
  "vendor-icon-fallbacks.json"
);
const updateReleasePath = path.join(publishedDirectory, "update-release.json");
const softwareUpdateReleasePath = path.join(
  publishedDirectory,
  "software-update-release.json"
);
const softwareUpdateStatePath = path.join(
  publishedDirectory,
  "software-update-store",
  "state.json"
);
const channelPath = path.join(root, "catalog", "channel.json");
const updateChannelPath = path.join(root, "updates", "channel.json");
const discoveryReportPath = path.join(
  root,
  "output",
  "catalog-research",
  "official-product-candidates.json"
);
const discoveryStatePath = path.join(
  __dirname,
  "data",
  "discovery-review.json"
);
const productAcceptancePath = path.join(
  __dirname,
  "data",
  "product-acceptance.local.json"
);
const signingKey = adminReadOnly ? null : loadSigningKey({
  dataDirectory: path.join(__dirname, "data"),
  keyMetadata: readCatalogClientChannel(
    JSON.parse(fs.readFileSync(channelPath, "utf8")),
    { kind: "catalog", allowLocalhost: true }
  ).trustedKeys[0]
});
const releaseStore = createReleaseStore({
  rootDirectory: releaseStoreDirectory,
  signingKeyProvider: async () => {
    if (!signingKey) throw new Error("只读后台不能签名发布目录");
    return signingKey;
  },
  transformCatalogForRelease: (catalog) =>
    materializeLegacyVendorIconUrls(catalog, catalogAssetOrigin)
});
const softwareUpdateCenter = createSoftwareUpdateCenter({
  statePath: softwareUpdateStatePath,
  releasePath: softwareUpdateReleasePath,
  keyId: signingKey?.keyId || "",
  privateKey: signingKey?.privateKey || null
});
const productCertification = createProductCertification({
  filePath: productAcceptancePath
});
const vendorIconStore = createVendorIconStore({
  rootDirectory: path.join(__dirname, "data"),
  manifestPath: vendorIconSourcePath
});

function reviewedVendorLogoFallbackIds() {
  try {
    const value = JSON.parse(fs.readFileSync(vendorIconFallbackPath, "utf8"));
    return Object.keys(value?.vendors || {});
  } catch {
    return [];
  }
}

function validateCurrentPublication(catalog, settings) {
  return validatePublication(catalog, settings, {
    reviewedVendorLogoFallbackIds: reviewedVendorLogoFallbackIds()
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  });
  response.end(JSON.stringify(value));
}

function readCatalog(filePath) {
  return validateCatalog(
    normalizeCatalog(JSON.parse(fs.readFileSync(filePath, "utf8")))
  );
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, filePath);
}

async function saveCatalogDraft({ catalog, expectedRevision }) {
  const validated = validateCatalog(normalizeCatalog(catalog));
  vendorIconStore.verifyCatalog(validated);
  const saved = await releaseStore.saveDraft({
    catalog: validated,
    expectedRevision
  });
  writeJsonAtomic(draftPath, saved.catalog);
  return {
    revision: saved.revision,
    updatedAt: saved.updatedAt,
    catalog: saved.catalog
  };
}

function runDiscoveryScan() {
  const scriptPath = path.join(root, "scripts", "discover-official-products.mjs");
  const argumentsList = [
    scriptPath,
    "--max-pages=3",
    "--timeout-ms=3500",
    "--concurrency=8"
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argumentsList, {
      cwd: root,
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let outputTail = "";
    const append = (chunk) => {
      outputTail = `${outputTail}${chunk.toString("utf8")}`.slice(-12000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `官方产品扫描失败（${signal || `退出码 ${code}`}）${
              outputTail ? `：${outputTail.trim()}` : ""
            }`
          )
        );
      }
    });
  });
}

const discoveryReview = createDiscoveryReview({
  reportPath: discoveryReportPath,
  statePath: discoveryStatePath,
  runScan: runDiscoveryScan,
  commitCatalog: saveCatalogDraft
});

const discoveryIntervalHours = Number(
  process.env.AIHUB_DISCOVERY_SCAN_INTERVAL_HOURS || 24
);
if (!adminReadOnly && Number.isFinite(discoveryIntervalHours) && discoveryIntervalHours > 0) {
  const timer = setInterval(
    async () => {
      try {
        await ensureDraft();
        discoveryReview.startScan();
      } catch {
        // Readiness and the review page expose configuration failures.
      }
    },
    Math.max(1, discoveryIntervalHours) * 60 * 60 * 1000
  );
  timer.unref();
}

function readReleaseSettings() {
  try {
    const value = JSON.parse(fs.readFileSync(releaseSettingsPath, "utf8"));
    return mergeReleaseSettings(value);
  } catch (error) {
    if (error?.code === "ENOENT") return defaultReleaseSettings();
    throw new Error(`发布设置读取失败：${error.message}`);
  }
}

async function ensureDraft() {
  let state = await releaseStore.readState();
  if (adminReadOnly) {
    if (!state.draft) throw new Error("只读后台没有可读取的目录草稿");
    return state;
  }
  if (!state.draft) {
    const catalog = readCatalog(draftPath);
    await releaseStore.saveDraft({
      catalog,
      expectedRevision: 0
    });
    writeJsonAtomic(draftPath, catalog);
    state = await releaseStore.readState();
  }
  const diskInput = JSON.parse(fs.readFileSync(draftPath, "utf8"));
  if (shouldSyncDiskCatalogDraft(diskInput, state.draft)) {
    const catalog = validateCatalog(normalizeCatalog(diskInput));
    await releaseStore.saveDraft({
      catalog,
      expectedRevision: state.draft.revision
    });
    writeJsonAtomic(draftPath, catalog);
    state = await releaseStore.readState();
  }
  const normalizedCatalog = normalizeCatalog(
    structuredClone(state.draft.catalog)
  );
  if (
    JSON.stringify(normalizedCatalog) !== JSON.stringify(state.draft.catalog) ||
    !normalizedCatalog.environmentDownloads ||
    normalizedCatalog.vendors.some(
      (vendor) =>
        vendor.enabled === undefined ||
        vendor.order === undefined ||
        vendor.iconUrl === undefined ||
        vendor.products.some(
          (product) =>
            product.enabled === undefined ||
            product.order === undefined ||
            product.moduleId === undefined ||
            product.installProfileId === undefined ||
            product.capabilities === undefined
        )
    )
  ) {
    const catalog = normalizedCatalog;
    catalog.environmentDownloads ||= {
      strategy: "official-first",
      probeTimeoutMs: 5000,
      sources: normalizeSourcePreferences()
    };
    catalog.vendors.forEach((vendor, vendorIndex) => {
      vendor.enabled ??= true;
      vendor.order ??= vendorIndex;
      vendor.iconUrl ??= "";
      vendor.products.forEach((product, productIndex) => {
        product.enabled ??= true;
        product.order ??= productIndex;
        product.moduleId ??= moduleIdForProductType(product.productType);
        product.installProfileId ??=
          getInstallRegistration(product.id)?.profileId || "";
        product.capabilities ??=
          getInstallRegistration(product.id)?.capabilities ||
          getProductModule(product.moduleId)?.capabilities ||
          [];
      });
    });
    validateCatalog(catalog);
    await releaseStore.saveDraft({
      catalog,
      expectedRevision: state.draft.revision
    });
    writeJsonAtomic(draftPath, catalog);
    state = await releaseStore.readState();
  }
  return state;
}

function developmentChannel(kind, releaseUrl, extraOrigins = []) {
  const releaseOrigin = new URL(releaseUrl).origin;
  return {
    schemaVersion: 2,
    kind,
    releaseUrl,
    allowedReleaseOrigins: [
      releaseOrigin,
      ...extraOrigins
    ],
    trustedKeys: [
      {
        keyId: signingKey.keyId,
        publicKey: signingKey.publicKey
      }
    ]
  };
}

function serveFile(response, filePath, contentType, cacheControl = "no-store") {
  if (!fs.existsSync(filePath)) {
    sendJson(response, 404, { error: "文件不存在" });
    return;
  }
  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'"
  });
  fs.createReadStream(filePath).pipe(response);
}

async function handleApi(request, response, pathname) {
  if (
    (request.method === "GET" && pathname === "/api/community-management") ||
    (request.method === "POST" && pathname === "/api/community-management/actions")
  ) {
    try {
      const write = pathname.endsWith("/actions");
      communityManagement.authorize(request, { write });
      const result = write
        ? await communityManagement.execute(await readJson(request, 64 * 1024))
        : await communityManagement.list();
      sendJson(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 502;
      if (status >= 500) console.error("Community management request failed", error);
      sendJson(response, status, {
        error: status >= 500 ? "社区管理服务暂不可用" : error.message
      });
    }
    return true;
  }
  if (isAdminReadOnlyWriteBlocked(adminReadOnly, request.method, pathname)) {
    sendJson(response, 503, { error: "后台当前为只读模式" });
    return true;
  }
  if (
    request.method !== "GET" &&
    (request.headers["x-aihub-admin"] !== "1" ||
      (request.headers.origin &&
        !adminWriteOrigins.has(request.headers.origin)))
  ) {
    sendJson(response, 403, { error: "后台写入请求未通过本机来源校验" });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/catalog") {
    const state = await ensureDraft();
    sendJson(response, 200, {
      catalog: state.draft.catalog,
      revision: state.draft.revision,
      activeCatalogVersion: state.activeCatalogVersion
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/software-updates") {
    sendJson(response, 200, {
      ...softwareUpdateCenter.snapshot(),
      published: fs.existsSync(softwareUpdateReleasePath),
      releaseUrl: `${publicOrigin}/software-update-release.json`
    });
    return true;
  }

  if (
    request.method === "POST" &&
    pathname === "/api/software-updates/scan"
  ) {
    const body = await readJson(request, 16 * 1024);
    const state = await ensureDraft();
    sendJson(response, 200, softwareUpdateCenter.scan({
      expectedRevision: body.expectedRevision,
      catalog: state.draft.catalog
    }));
    return true;
  }

  if (request.method === "PUT" && pathname === "/api/software-updates") {
    const body = await readJson(request, 256 * 1024);
    sendJson(response, 200, softwareUpdateCenter.saveReview({
      expectedRevision: body.expectedRevision,
      selectedIds: body.selectedIds
    }));
    return true;
  }

  if (
    request.method === "POST" &&
    pathname === "/api/software-updates/publish"
  ) {
    const body = await readJson(request, 16 * 1024);
    const published = softwareUpdateCenter.publish({
      expectedRevision: body.expectedRevision,
      rollout: {
        percentage: 100,
        salt: "software-updates-stable-2026"
      }
    });
    sendJson(response, 200, {
      ...published,
      releaseUrl: `${publicOrigin}/software-update-release.json`
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/product-modules") {
    const resourceModules = publicResourceModules();
    sendJson(response, 200, {
      modules: publicProductModules(),
      entryPointTypes: entryPointTypeMetadata(),
      officialDownloadKinds: publicOfficialDownloadKinds(),
      installProfiles: [
        ...publicInstallProfiles(),
        ...publicDesktopDownloadOnlyProfiles()
      ],
      resourceModules,
      extensionModules: resourceModules,
      extensionInstallProfiles: publicExtensionInstallProfiles(),
      resourceSourceChannels: RESOURCE_SOURCE_CHANNELS,
      resourceSourceKinds: RESOURCE_SOURCE_KINDS,
      resourceReviewStatuses: RESOURCE_REVIEW_STATUSES,
      resourceRiskLevels: RESOURCE_RISK_LEVELS
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/vendor-icon") {
    const body = await readJson(request);
    const state = await ensureDraft();
    if (!state.draft.catalog.vendors.some((vendor) => vendor.id === body.vendorId)) {
      throw new Error("厂商不存在");
    }
    const asset = vendorIconStore.save(body);
    sendJson(response, 200, { ok: true, asset });
    return true;
  }

  if (
    request.method === "GET" &&
    pathname === "/api/product-certifications"
  ) {
    sendJson(response, 200, productCertification.snapshot());
    return true;
  }

  if (
    request.method === "PUT" &&
    pathname === "/api/product-certifications"
  ) {
    const certifications = productCertification.update(await readJson(request));
    sendJson(response, 200, {
      ok: true,
      ...certifications
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/discovery") {
    const state = await ensureDraft();
    sendJson(response, 200, discoveryReview.snapshot(state.draft.catalog));
    return true;
  }

  if (request.method === "POST" && pathname === "/api/discovery/scan") {
    await ensureDraft();
    const result = discoveryReview.startScan();
    sendJson(response, result.started ? 202 : 200, result);
    return true;
  }

  if (request.method === "POST" && pathname === "/api/discovery/decision") {
    const body = await readJson(request);
    const state = await ensureDraft();
    const snapshot = discoveryReview.decision({
      catalog: state.draft.catalog,
      candidateId: body.candidateId,
      status: body.status
    });
    sendJson(response, 200, snapshot);
    return true;
  }

  if (request.method === "POST" && pathname === "/api/discovery/accept") {
    const body = await readJson(request);
    const state = await ensureDraft();
    const result = await discoveryReview.acceptCandidate({
      catalog: state.draft.catalog,
      candidateId: body.candidateId,
      expectedRevision: body.expectedRevision,
      product: body.product
    });
    sendJson(response, 200, {
      ok: true,
      revision: result.revision,
      updatedAt: result.updatedAt,
      product: result.product
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return true;
  }

  if (request.method === "GET" && pathname === "/ready") {
    const state = await ensureDraft();
    vendorIconStore.verifyCatalog(state.draft.catalog);
    validateCurrentPublication(state.draft.catalog, readReleaseSettings());
    productCertification.snapshot();
    sendJson(response, 200, {
      status: "ready",
      mode: adminReadOnly ? "read-only" : "read-write",
      draftRevision: state.draft.revision,
      activeCatalogVersion: state.activeCatalogVersion,
      signingKeyId: signingKey?.keyId || null
    });
    return true;
  }

  if (request.method === "PUT" && pathname === "/api/catalog") {
    const body = await readJson(request, CATALOG_JSON_BODY_LIMIT_BYTES);
    const saved = await saveCatalogDraft({
      catalog: body.catalog,
      expectedRevision: body.expectedRevision
    });
    sendJson(response, 200, {
      ok: true,
      revision: saved.revision,
      updatedAt: saved.updatedAt
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/release") {
    const state = await ensureDraft();
    const v2State = await releaseStore.readChannel("v2");
    sendJson(response, 200, {
      state,
      history: await releaseStore.listHistory(),
      channels: {
        v1: { state, history: await releaseStore.listHistory({ channel: "v1" }) },
        v2: { state: v2State, history: await releaseStore.listHistory({ channel: "v2" }) }
      },
      settings: readReleaseSettings(),
      signing: {
        keyId: signingKey?.keyId || "",
        publicKey: signingKey?.publicKey || "",
        source: signingKey?.source || "read-only"
      },
      updatePublished: fs.existsSync(updateReleasePath),
      approvedDownloadSources: getApprovedEnvironmentDownloadSources()
    });
    return true;
  }

  if (request.method === "PUT" && pathname === "/api/release") {
    const settings = validateReleaseSettings(await readJson(request));
    writeJsonAtomic(releaseSettingsPath, settings);
    sendJson(response, 200, { ok: true, settings });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/validate") {
    const state = await ensureDraft();
    vendorIconStore.verifyCatalog(state.draft.catalog);
    const report = validateCurrentPublication(
      state.draft.catalog,
      readReleaseSettings()
    );
    const certifications = productCertification.validateCatalog(
      state.draft.catalog
    ).summary;
    report.certifications = certifications;
    if (certifications.reviewed) {
      report.warnings.push(
        `${certifications.reviewed} 个托管桌面产品尚未记录实机验收`
      );
    }
    sendJson(response, 200, report);
    return true;
  }

  if (request.method === "POST" && pathname === "/api/publish") {
    const body = await readJson(request);
    if (!Object.hasOwn(body, "channel")) throw new Error("发布必须显式选择目录频道");
    const channel = normalizeCatalogChannel(body.channel);
    if (!Number.isSafeInteger(body.expectedDraftRevision) || !Number.isSafeInteger(body.expectedActiveCatalogVersion)) {
      throw new Error("发布必须提供预期草稿和频道活动版本");
    }
    const state = await ensureDraft();
    const settings = readReleaseSettings();
    vendorIconStore.verifyCatalog(state.draft.catalog);
    validateCurrentPublication(state.draft.catalog, settings);
    productCertification.validateCatalog(state.draft.catalog);
    const published = await releaseStore.publish({
      channel,
      expectedDraftRevision: body.expectedDraftRevision,
      expectedActiveCatalogVersion: body.expectedActiveCatalogVersion,
      notes: settings.catalog.notes,
      rollout: {
        percentage: settings.catalog.rolloutPercentage,
        salt: settings.catalog.rolloutSalt
      }
    });
    if (channel === "v1") writeJsonAtomic(
      channelPath,
      developmentChannel("catalog", `${publicOrigin}${catalogReleasePath(channel)}`)
    );
    sendJson(response, 200, {
      ok: true,
      channel,
      url: `${publicOrigin}${catalogReleasePath(channel)}`,
      catalogVersion: published.release.catalogVersion,
      releaseId: published.release.releaseId,
      sha256: published.release.sha256,
      updatedAt: published.release.publishedAt
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/rollback") {
    const body = await readJson(request);
    if (!Object.hasOwn(body, "channel")) throw new Error("回滚必须显式选择目录频道");
    const channel = normalizeCatalogChannel(body.channel);
    if (!Number.isSafeInteger(body.expectedActiveCatalogVersion)) {
      throw new Error("回滚必须提供频道活动版本");
    }
    const settings = readReleaseSettings();
    const state = await ensureDraft();
    validateCurrentPublication(state.draft.catalog, settings);
    productCertification.validateCatalog(state.draft.catalog);
    const result = await releaseStore.rollback({
      channel,
      releaseId: body.releaseId,
      expectedActiveCatalogVersion: body.expectedActiveCatalogVersion,
      notes: settings.catalog.notes || `回滚到 ${body.releaseId}`,
      rollout: {
        percentage: settings.catalog.rolloutPercentage,
        salt: settings.catalog.rolloutSalt
      }
    });
    sendJson(response, 200, {
      ok: true,
      channel,
      catalogVersion: result.release.catalogVersion,
      releaseId: result.release.releaseId
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/publish-update") {
    const settings = readReleaseSettings();
    if (!settings.update.enabled) {
      throw new Error("更新发布当前未启用");
    }
    const downloadOrigin = new URL(settings.update.downloadUrl).origin;
    const payload = validateUpdatePayload(
      {
        version: settings.update.version,
        publishedAt: new Date().toISOString(),
        downloadUrl: settings.update.downloadUrl,
        sha256: settings.update.sha256,
        fileSize: settings.update.fileSize,
        platform: "win32",
        arch: "x64",
        channel: "stable",
        notes: settings.update.notes,
        rollout: {
          percentage: settings.update.rolloutPercentage,
          salt: settings.update.rolloutSalt
        }
      },
      [downloadOrigin]
    );
    const envelope = createSignedEnvelope({
      kind: "update",
      keyId: signingKey.keyId,
      payload,
      privateKey: signingKey.privateKey
    });
    writeJsonAtomic(updateReleasePath, envelope);
    writeJsonAtomic(
      updateChannelPath,
      developmentChannel(
        "update",
        `${publicOrigin}/update-release.json`,
        [downloadOrigin]
      )
    );
    sendJson(response, 200, {
      ok: true,
      version: payload.version,
      url: `${publicOrigin}/update-release.json`,
      keyId: signingKey.keyId
    });
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${host}:${port}`);
    if (await handleApi(request, response, url.pathname)) return;

    if (request.method === "GET" && url.pathname.startsWith("/vendor-icons/")) {
      const asset = vendorIconAssetFromPath(url.pathname.slice(1));
      const verified = vendorIconStore.verifyCatalog({
        vendors: [{ iconAsset: asset }]
      });
      if (verified !== 1) throw new Error("厂商 Logo 资产无效");
      serveFile(
        response,
        path.join(__dirname, "data", ...asset.path.split("/")),
        asset.mimeType,
        "public, max-age=31536000, immutable"
      );
      return;
    }

    if (request.method === "GET" && url.pathname === catalogReleasePath("v2")) {
      const state = await releaseStore.readChannel("v2");
      if (!state.activeRelease) {
        sendJson(response, 404, { error: "v2 目录尚未发布" });
        return;
      }
      sendJson(response, 200, (await releaseStore.readRelease(state.activeRelease.releaseId, { channel: "v2" })).envelope);
      return;
    }

    if (request.method === "GET" && ["/catalog-release.json", "/catalog-v1.json"].includes(url.pathname)) {
      const state = await releaseStore.readChannel("v1");
      if (!state.activeRelease) {
        sendJson(response, 404, { error: "尚未发布目录" });
        return;
      }
      const release = await releaseStore.readRelease(state.activeRelease.releaseId, { channel: "v1" });
      if (url.pathname === "/catalog-release.json") {
        sendJson(response, 200, release.envelope);
      } else {
        sendJson(response, 200, release.envelope.payload.catalog);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/update-release.json") {
      serveFile(
        response,
        updateReleasePath,
        "application/json; charset=utf-8",
        "public, max-age=0, must-revalidate"
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/software-update-release.json"
    ) {
      serveFile(
        response,
        softwareUpdateReleasePath,
        "application/json; charset=utf-8",
        "public, max-age=0, must-revalidate"
      );
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "不支持的请求方式" });
      return;
    }

    const relative =
      url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
    const target = path.resolve(publicDirectory, relative);
    const insidePublic =
      target === publicDirectory ||
      target.startsWith(`${publicDirectory}${path.sep}`);
    if (!insidePublic) {
      sendJson(response, 403, { error: "禁止访问" });
      return;
    }
    const extensions = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml"
    };
    serveFile(
      response,
      target,
      extensions[path.extname(target).toLowerCase()] ||
        "application/octet-stream"
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "请求处理失败";
    sendJson(response, /冲突|已变化/.test(message) ? 409 : 400, {
      error: message
    });
  }
});

server.listen(port, host, () => {
  console.log(`枕星 AI CMS 已启动：http://${host}:${port}`);
});
