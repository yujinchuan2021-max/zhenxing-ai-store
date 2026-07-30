const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {
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
  moduleIdForProductType,
  publicProductModules
} = require("../shared/product-modules.cjs");
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
  defaultReleaseSettings,
  mergeReleaseSettings,
  validatePublication,
  validateReleaseSettings
} = require("./config-validation.cjs");

const host = process.env.AIHUB_ADMIN_HOST || "127.0.0.1";
const port = Number(process.env.AIHUB_ADMIN_PORT || 4173);
const publicOrigin =
  process.env.AIHUB_ADMIN_PUBLIC_ORIGIN || `http://${host}:${port}`;
const root = path.resolve(__dirname, "..");
const publicDirectory = path.join(__dirname, "public");
const draftPath = path.join(__dirname, "data", "catalog-v1.json");
const publishedDirectory = path.join(__dirname, "published");
const releaseStoreDirectory = path.join(publishedDirectory, "catalog-store");
const releaseSettingsPath = path.join(__dirname, "data", "release-settings.json");
const updateReleasePath = path.join(publishedDirectory, "update-release.json");
const channelPath = path.join(root, "catalog", "channel.json");
const updateChannelPath = path.join(root, "updates", "channel.json");
const signingKey = loadSigningKey({
  dataDirectory: path.join(__dirname, "data")
});
const releaseStore = createReleaseStore({
  rootDirectory: releaseStoreDirectory,
  signingKeyProvider: async () => signingKey
});

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("目录不能超过 1 MB"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON 格式无效"));
      }
    });
    request.on("error", reject);
  });
}

function readCatalog(filePath) {
  return validateCatalog(JSON.parse(fs.readFileSync(filePath, "utf8")));
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, filePath);
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
  if (!state.draft) {
    await releaseStore.saveDraft({
      catalog: readCatalog(draftPath),
      expectedRevision: 0
    });
    state = await releaseStore.readState();
  }
  if (
    !state.draft.catalog.environmentDownloads ||
    state.draft.catalog.vendors.some(
      (vendor) =>
        vendor.enabled === undefined ||
        vendor.order === undefined ||
        vendor.iconUrl === undefined ||
        vendor.products.some(
          (product) =>
            product.enabled === undefined ||
            product.order === undefined ||
            product.moduleId === undefined ||
            product.installProfileId === undefined
        )
    )
  ) {
    const catalog = structuredClone(state.draft.catalog);
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
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(filePath).pipe(response);
}

async function handleApi(request, response, pathname) {
  if (
    request.method !== "GET" &&
    (request.headers["x-aihub-admin"] !== "1" ||
      (request.headers.origin &&
        request.headers.origin !== publicOrigin))
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

  if (request.method === "GET" && pathname === "/api/product-modules") {
    sendJson(response, 200, {
      modules: publicProductModules(),
      installProfiles: publicInstallProfiles()
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return true;
  }

  if (request.method === "GET" && pathname === "/ready") {
    const state = await ensureDraft();
    validatePublication(state.draft.catalog, readReleaseSettings());
    sendJson(response, 200, {
      status: "ready",
      draftRevision: state.draft.revision,
      activeCatalogVersion: state.activeCatalogVersion,
      signingKeyId: signingKey.keyId
    });
    return true;
  }

  if (request.method === "PUT" && pathname === "/api/catalog") {
    const body = await readJson(request);
    const catalog = validateCatalog(body.catalog);
    const saved = await releaseStore.saveDraft({
      catalog,
      expectedRevision: body.expectedRevision
    });
    catalog.updatedAt = saved.updatedAt;
    writeJsonAtomic(draftPath, catalog);
    sendJson(response, 200, {
      ok: true,
      revision: saved.revision,
      updatedAt: saved.updatedAt
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/release") {
    const state = await ensureDraft();
    sendJson(response, 200, {
      state,
      history: await releaseStore.listHistory(),
      settings: readReleaseSettings(),
      signing: {
        keyId: signingKey.keyId,
        publicKey: signingKey.publicKey,
        source: signingKey.source
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
    const report = validatePublication(
      state.draft.catalog,
      readReleaseSettings()
    );
    sendJson(response, 200, report);
    return true;
  }

  if (request.method === "POST" && pathname === "/api/publish") {
    const body = await readJson(request);
    const state = await ensureDraft();
    const settings = readReleaseSettings();
    validatePublication(state.draft.catalog, settings);
    const published = await releaseStore.publish({
      expectedDraftRevision:
        body.expectedDraftRevision ?? state.draft.revision,
      expectedActiveCatalogVersion:
        body.expectedActiveCatalogVersion ?? state.activeCatalogVersion,
      notes: settings.catalog.notes,
      rollout: {
        percentage: settings.catalog.rolloutPercentage,
        salt: settings.catalog.rolloutSalt
      }
    });
    writeJsonAtomic(
      channelPath,
      developmentChannel(
        "catalog",
        `${publicOrigin}/catalog-release.json`
      )
    );
    sendJson(response, 200, {
      ok: true,
      url: `${publicOrigin}/catalog-release.json`,
      catalogVersion: published.release.catalogVersion,
      releaseId: published.release.releaseId,
      sha256: published.release.sha256,
      updatedAt: published.release.publishedAt
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/rollback") {
    const body = await readJson(request);
    const settings = readReleaseSettings();
    const state = await ensureDraft();
    validatePublication(state.draft.catalog, settings);
    const result = await releaseStore.rollback({
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

    if (
      request.method === "GET" &&
      ["/catalog-release.json", "/catalog-v1.json"].includes(url.pathname)
    ) {
      const state = await releaseStore.readState();
      if (!state.activeRelease) {
        sendJson(response, 404, { error: "尚未发布目录" });
        return;
      }
      const release = await releaseStore.readRelease(
        state.activeRelease.releaseId
      );
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
  console.log(`AI Hub CMS 已启动：http://${host}:${port}`);
});
