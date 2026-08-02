import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createIsolatedAcceptanceProfile,
  launchPackagedClientCdp,
  packagedManagedDownloadAction,
  removeIsolatedAcceptanceProfile,
  verifyManagedDownloadPause
} from "./lib/packaged-client-cdp.mjs";

const require = createRequire(import.meta.url);
const {
  verifyReleaseBundle
} = require("../admin/release-bundle-verifier.cjs");
const {
  readArtifactBuildMetadata
} = require("../shared/release-provenance.cjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const runtimeBundleDirectory = path.join(
  root,
  "deployment",
  "local",
  "runtime",
  "current"
);
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(
      runtimeBundleDirectory,
      "public",
      "release-manifest.json"
    ),
    "utf8"
  )
);
const baseVersion =
  process.env.AIHUB_LOCAL_RELEASE_BASE_VERSION || packageJson.version;
const portablePath = path.resolve(
  process.env.AIHUB_LOCAL_RELEASE_CLIENT ||
    path.join(
      root,
      "release-local-server-client",
      `ZhenXing-AI-Local-${baseVersion}-Windows-x64-Portable.exe`
    )
);
const downloadProductId =
  process.env.AIHUB_RELEASE_DOWNLOAD_PRODUCT || "openclaw-windows-hub";

if (process.platform !== "win32") {
  throw new Error("本地发布客户端验收当前仅支持 Windows");
}
if (!fs.existsSync(portablePath)) {
  throw new Error(`本地发布验收客户端不存在：${portablePath}`);
}
const portableBuild = readArtifactBuildMetadata({
  artifactPath: portablePath,
  version: baseVersion
});
const verifiedRuntime = verifyReleaseBundle({
  bundleDirectory: runtimeBundleDirectory,
  allowLocalRuntimeTrust: true
});
if (
  manifest?.schemaVersion !== 2 ||
  typeof manifest.build?.source?.revision !== "string" ||
  manifest.update?.version !== packageJson.version
) {
  throw new Error("本地发布清单没有绑定当前版本和源码来源");
}
if (baseVersion === manifest.update.version) {
  const portableName = path.basename(portablePath);
  const localPortable = portableBuild.artifacts.find(
    (entry) => entry.name === portableName
  );
  const signedPortable = verifiedRuntime.buildArtifacts.find(
    (entry) => entry.name === portableName
  );
  if (
    !localPortable ||
    !signedPortable ||
    JSON.stringify(portableBuild.source) !==
      JSON.stringify(verifiedRuntime.source) ||
    portableBuild.builtAt !== verifiedRuntime.builtAt ||
    localPortable.sha256 !== signedPortable.sha256 ||
    localPortable.fileSize !== signedPortable.fileSize
  ) {
    throw new Error("Portable 验收客户端与签名构建来源不一致");
  }
}

const profile = createIsolatedAcceptanceProfile("aihub-local-release-client-");
let client;
try {
  client = await launchPackagedClientCdp({
    executable: portablePath,
    profile
  });
  const { evaluate, target } = client;

  let rendererReady = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate("Boolean(window.aihubPC && document.body.innerText)")) {
      rendererReady = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!rendererReady) throw new Error("本地发布客户端主界面没有就绪");

  const {
    assertPackagedRemoteCatalog,
    clickPackagedDomAction,
    openPackagedCatalogProduct,
    openPackagedResource,
    waitForPackagedDomAction
  } = await import("./lib/packaged-client-cdp.mjs");

  const settings = await evaluate("window.aihubPC.getSettings()");
  if (settings?.downloadDirectory !== profile.downloadDirectory) {
    throw new Error(
      `Portable acceptance escaped its isolated Windows profile: ${JSON.stringify(settings)}`
    );
  }

  const catalog = assertPackagedRemoteCatalog({
    catalog: await evaluate("window.aihubPC.getCatalog()"),
    minimumCatalogVersion: manifest.catalog.catalogVersion
  });
  const vendorIconUrl = catalog.catalog.vendors.find(
    (vendor) => typeof vendor.iconUrl === "string" && vendor.iconUrl
  )?.iconUrl;
  const vendorIcon = await evaluate(`new Promise((resolve) => {
    const image = new Image();
    const timeout = setTimeout(
      () => resolve({ ok: false, reason: "timeout" }),
      10000
    );
    image.onload = () => {
      clearTimeout(timeout);
      resolve({ ok: true, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      clearTimeout(timeout);
      resolve({ ok: false, reason: "load-error" });
    };
    image.src = ${JSON.stringify(vendorIconUrl)};
  })`);
  if (!vendorIconUrl || vendorIcon?.ok !== true) {
    throw new Error(
      `Packaged vendor icon did not load: ${JSON.stringify({ vendorIconUrl, vendorIcon })}`
    );
  }
  const findCatalogProduct = (productId) => {
    for (const vendor of catalog.catalog.vendors) {
      const product = Array.isArray(vendor?.products)
        ? vendor.products.find((candidate) => candidate?.id === productId)
        : null;
      if (product) return { vendor, product };
    }
    throw new Error(`远程签名目录缺少验收产品：${productId}`);
  };
  const findCatalogResource = (installProfileId) => {
    for (const resource of catalog.catalog.resources || []) {
      const target = Array.isArray(resource?.targets)
        ? resource.targets.find(
            (candidate) => candidate?.installProfileId === installProfileId
          )
        : null;
      if (target) {
        return {
          ...findCatalogProduct(target.productId),
          resource,
          target
        };
      }
    }
    throw new Error(`远程签名目录缺少验收扩展：${installProfileId}`);
  };
  const waitForDownloadTask = async ({
    productId,
    phases,
    timeoutMs
  }) => {
    const encodedProductId = JSON.stringify(productId);
    const deadline = Date.now() + timeoutMs;
    let task = null;
    while (Date.now() < deadline) {
      task = await evaluate(
        `window.aihubPC.getDownloadTask(${encodedProductId})`
      );
      if (phases.includes(task?.phase)) return task;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(
      `下载任务没有进入预期状态：${JSON.stringify({ productId, phases, task })}`
    );
  };

  const update = await evaluate("window.aihubPC.checkForUpdate()");
  const testsUpgradeFixture = baseVersion !== manifest.update.version;
  if (testsUpgradeFixture) {
    if (
      update?.status !== "available" ||
      update.version !== manifest.update.version ||
      update.fileSize !== manifest.update.fileSize ||
      update.sha256 !== manifest.update.sha256
    ) {
      throw new Error(`客户端没有接受签名更新：${JSON.stringify(update)}`);
    }
  } else if (
    update?.status !== "current" ||
    update.currentVersion !== manifest.update.version ||
    update.version !== manifest.update.version
  ) {
    throw new Error(`客户端版本与签名更新不一致：${JSON.stringify(update)}`);
  }

  const bodyText = await evaluate("document.body.innerText");
  if (!bodyText.includes("AI")) {
    throw new Error("客户端主界面没有完成渲染");
  }

  const extensionProfileId = "skill.codex.chatgpt-apps";
  const extensionTarget = findCatalogResource(extensionProfileId);
  const extensionBefore = await evaluate(
    `window.aihubPC.getExtensionStatus(${JSON.stringify(extensionProfileId)})`
  );
  if (extensionBefore?.state !== "not-installed") {
    throw new Error(
      `Packaged extension did not start cleanly: ${JSON.stringify(extensionBefore)}`
    );
  }
  await openPackagedResource({
    evaluate,
    storeId: "skill",
    productId: extensionTarget.product.id,
    resourceId: extensionTarget.resource.id,
    timeoutMs: 10_000
  });
  await waitForPackagedDomAction({
    evaluate,
    productId: "",
    resourceId: extensionTarget.resource.id,
    action: "install-extension",
    extensionProfileId,
    timeoutMs: 10_000
  });
  const extensionInstallDom = await clickPackagedDomAction({
    evaluate,
    productId: "",
    resourceId: extensionTarget.resource.id,
    action: "install-extension",
    extensionProfileId,
    timeoutMs: 8_000
  });
  await waitForPackagedDomAction({
    evaluate,
    productId: "",
    resourceId: extensionTarget.resource.id,
    action: "uninstall-extension",
    extensionProfileId,
    timeoutMs: 20_000
  });
  const extensionInstalled = await evaluate(
    `window.aihubPC.getExtensionStatus(${JSON.stringify(extensionProfileId)})`
  );
  const installedSkill = path.join(
    profile.codexHome,
    "skills",
    "chatgpt-apps",
    "SKILL.md"
  );
  if (extensionInstalled?.state !== "installed" || !fs.existsSync(installedSkill)) {
    throw new Error(
      `Packaged extension installation failed: ${JSON.stringify(extensionInstalled)}`
    );
  }
  const extensionUninstallDom = await clickPackagedDomAction({
    evaluate,
    productId: "",
    resourceId: extensionTarget.resource.id,
    action: "uninstall-extension",
    extensionProfileId,
    timeoutMs: 8_000
  });
  await waitForPackagedDomAction({
    evaluate,
    productId: "",
    resourceId: extensionTarget.resource.id,
    action: "install-extension",
    extensionProfileId,
    timeoutMs: 20_000
  });
  const extensionRemoved = await evaluate(
    `window.aihubPC.getExtensionStatus(${JSON.stringify(extensionProfileId)})`
  );
  if (
    extensionRemoved?.state !== "not-installed" ||
    fs.existsSync(path.dirname(installedSkill))
  ) {
    throw new Error(
      `Packaged extension uninstall failed: ${JSON.stringify(extensionRemoved)}`
    );
  }

  const downloadTarget = findCatalogProduct(downloadProductId);
  await openPackagedCatalogProduct({
    evaluate,
    vendorId: downloadTarget.vendor.id,
    productId: downloadTarget.product.id,
    searchText: downloadTarget.vendor.name,
    timeoutMs: 10_000
  });
  const downloadAction = packagedManagedDownloadAction(
    await evaluate(
      `window.aihubPC.getDesktopStatus(${JSON.stringify(downloadProductId)})`
    )
  );
  await waitForPackagedDomAction({
    evaluate,
    productId: downloadProductId,
    action: downloadAction,
    timeoutMs: 10_000
  });
  let downloadStartDom = null;
  let downloadPauseDom = null;
  const managedDownload = await verifyManagedDownloadPause({
    evaluate,
    productId: downloadProductId,
    downloadDirectory: profile.downloadDirectory,
    startDownload: async () => {
      downloadStartDom = await clickPackagedDomAction({
        evaluate,
        productId: downloadProductId,
        action: downloadAction,
        timeoutMs: 8_000
      });
      const task = await waitForDownloadTask({
        productId: downloadProductId,
        phases: ["starting", "downloading", "failed", "completed"],
        timeoutMs: 30_000
      });
      return { ok: task.phase !== "failed", task };
    },
    pauseDownload: async () => {
      await waitForPackagedDomAction({
        evaluate,
        productId: downloadProductId,
        action: "pause-download",
        timeoutMs: 10_000
      });
      downloadPauseDom = await clickPackagedDomAction({
        evaluate,
        productId: downloadProductId,
        action: "pause-download",
        timeoutMs: 8_000
      });
      const task = await waitForDownloadTask({
        productId: downloadProductId,
        phases: ["paused", "failed", "completed"],
        timeoutMs: 20_000
      });
      return { ok: task.phase === "paused", task };
    },
    minimumBytes: 1024 * 1024,
    timeoutMs: 120_000
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        clientVersion: baseVersion,
        page: target.url,
        isolatedProfile: true,
        source: manifest.build.source,
        catalog: {
          source: catalog.source,
          catalogVersion: catalog.catalogVersion,
          vendors: catalog.catalog.vendors.length,
          vendorIcon
        },
        update,
        domActions: {
          extensionInstall: extensionInstallDom,
          extensionUninstall: extensionUninstallDom,
          managedDownloadStart: downloadStartDom,
          managedDownloadPause: downloadPauseDom
        },
        managedDownload
      },
      null,
      2
    )}\n`
  );
} finally {
  try {
    await client?.close();
  } finally {
    await removeIsolatedAcceptanceProfile(profile);
  }
}
