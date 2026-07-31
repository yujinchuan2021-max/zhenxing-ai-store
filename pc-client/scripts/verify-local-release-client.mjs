import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createIsolatedAcceptanceProfile,
  launchPackagedClientCdp,
  removeIsolatedAcceptanceProfile,
  verifyManagedDownloadPause
} from "./lib/packaged-client-cdp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "deployment",
      "local",
      "runtime",
      "current",
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
      `AI-Hub-Local-${baseVersion}-Windows-x64-Portable.exe`
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
if (
  manifest?.schemaVersion !== 2 ||
  typeof manifest.build?.source?.revision !== "string" ||
  manifest.update?.version !== packageJson.version
) {
  throw new Error("本地发布清单没有绑定当前版本和源码来源");
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

  const settings = await evaluate("window.aihubPC.getSettings()");
  if (settings?.downloadDirectory !== profile.downloadDirectory) {
    throw new Error(
      `Portable acceptance escaped its isolated Windows profile: ${JSON.stringify(settings)}`
    );
  }

  const catalog = await evaluate("window.aihubPC.getCatalog()");
  if (
    catalog?.source !== "remote" ||
    catalog.catalogVersion !== manifest.catalog.catalogVersion ||
    !Array.isArray(catalog.catalog?.vendors)
  ) {
    throw new Error(
      `客户端没有接受远程签名目录：${JSON.stringify(catalog)}`
    );
  }

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
  const extensionBefore = await evaluate(
    `window.aihubPC.getExtensionStatus(${JSON.stringify(extensionProfileId)})`
  );
  if (extensionBefore?.state !== "not-installed") {
    throw new Error(
      `Packaged extension did not start cleanly: ${JSON.stringify(extensionBefore)}`
    );
  }
  const extensionInstalled = await evaluate(
    `window.aihubPC.installExtension(${JSON.stringify(extensionProfileId)})`
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
  const extensionRemoved = await evaluate(
    `window.aihubPC.uninstallExtension(${JSON.stringify(extensionProfileId)})`
  );
  if (
    extensionRemoved?.state !== "not-installed" ||
    fs.existsSync(path.dirname(installedSkill))
  ) {
    throw new Error(
      `Packaged extension uninstall failed: ${JSON.stringify(extensionRemoved)}`
    );
  }

  const managedDownload = await verifyManagedDownloadPause({
    evaluate,
    productId: downloadProductId,
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
          vendors: catalog.catalog.vendors.length
        },
        update,
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
