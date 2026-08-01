const {
  WINDOWS_DESKTOP_PRODUCTS
} = require("./windows-desktop-catalog.cjs");
const { getDesktopLifecycle } = require("./desktop-lifecycle.cjs");

function coreDesktopInstallerContract(productId) {
  const identity = getDesktopLifecycle(productId)?.installerIdentity;
  return Object.freeze({
    installerKind: identity?.installerKind || "vendor-installer",
    expectedInstallerIdentity: identity?.downloadedFile || null
  });
}

const MANAGED_DOWNLOADS = Object.freeze({
  "chatgpt-desktop": Object.freeze({
    ...coreDesktopInstallerContract("chatgpt-desktop"),
    url: "https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi",
    fileName: "ChatGPT Installer.exe",
    allowedHosts: Object.freeze(["get.microsoft.com"]),
    expectedSigner: /^CN=Microsoft Corporation(?:,|$)/i,
    safetyReserveBytes: 512 * 1024 * 1024,
    installDiskBytes: 2 * 1024 * 1024 * 1024
  }),
  "claude-desktop": Object.freeze({
    ...coreDesktopInstallerContract("claude-desktop"),
    url: "https://claude.ai/api/desktop/win32/x64/setup/latest/redirect",
    fileName: "Claude-Setup-x64.exe",
    allowedHosts: Object.freeze(["claude.ai", "downloads.claude.ai"]),
    expectedSigner: /^CN="?Anthropic, PBC"?(?:,|$)/i,
    safetyReserveBytes: 512 * 1024 * 1024,
    installDiskBytes: 2 * 1024 * 1024 * 1024
  }),
  "comfy-desktop": Object.freeze({
    ...coreDesktopInstallerContract("comfy-desktop"),
    url: "https://dl.todesktop.com/241130tqe9q3y",
    fileName: "Comfy-Desktop-Setup-x64.exe",
    allowedHosts: Object.freeze([
      "download.comfy.org",
      "dl.todesktop.com"
    ]),
    expectedSigner: /^CN=Drip Artificial Inc(?:,|$)/i,
    safetyReserveBytes: 512 * 1024 * 1024,
    installDiskBytes: 15 * 1024 * 1024 * 1024
  }),
  "ollama-cli": Object.freeze({
    ...coreDesktopInstallerContract("ollama-cli"),
    url: "https://ollama.com/download/OllamaSetup.exe",
    fileName: "OllamaSetup.exe",
    allowedHosts: Object.freeze([
      "ollama.com",
      "github.com",
      "release-assets.githubusercontent.com"
    ]),
    expectedSigner: /^CN=Ollama Inc\.(?:,|$)/i,
    safetyReserveBytes: 512 * 1024 * 1024,
    installDiskBytes: 4 * 1024 * 1024 * 1024
  }),
  ...Object.fromEntries(
    Object.entries(WINDOWS_DESKTOP_PRODUCTS).map(([productId, product]) => [
      productId,
      product.download
    ])
  )
});

function getManagedDownload(productId) {
  const plan = MANAGED_DOWNLOADS[productId];
  if (!plan) return null;
  return {
    url: plan.url,
    fileName: plan.fileName,
    allowedHosts: [...plan.allowedHosts],
    expectedSigner: plan.expectedSigner,
    expectedSha256: plan.expectedSha256 || "",
    ...(plan.installerKind ? { installerKind: plan.installerKind } : {}),
    ...(plan.expectedInstallerIdentity
      ? { expectedInstallerIdentity: plan.expectedInstallerIdentity }
      : {}),
    safetyReserveBytes: plan.safetyReserveBytes,
    installDiskBytes: plan.installDiskBytes
  };
}

function matchesManagedDownload(productId, download) {
  const plan = MANAGED_DOWNLOADS[productId];
  return Boolean(
    plan &&
      download &&
      download.url === plan.url &&
      download.fileName === plan.fileName
  );
}

function isAllowedManagedDownloadUrl(productId, value) {
  const plan = MANAGED_DOWNLOADS[productId];
  if (!plan || typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      plan.allowedHosts.includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

module.exports = {
  getManagedDownload,
  isAllowedManagedDownloadUrl,
  matchesManagedDownload
};
