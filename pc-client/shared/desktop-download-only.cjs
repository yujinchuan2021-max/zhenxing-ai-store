"use strict";

const PROFILES = Object.freeze({
  "audacity-desktop": ["audacity", ["github.com", "release-assets.githubusercontent.com"]],
  "canva-windows": ["canva", ["desktop-release.canva.com"]],
  "craft-desktop": ["craft", ["www.craft.do", "luki-prod-us-east-1-web.s3.us-east-1.amazonaws.com"]],
  "deepl-desktop": ["deepl", ["appdownload.deepl.com"]],
  "docker-desktop": ["docker", ["desktop.docker.com"]],
  "evernote-desktop": ["evernote", ["win.desktop.evernote.com"]],
  "finevoice-desktop": ["finevoice", ["dlaudio.fineshare.net"]],
  "taskade-workspace": ["taskade", ["apps.taskade.com"]],
  "teamviewer-remote-ai": ["teamviewer", ["dl.teamviewer.com"]],
  "wondershare-edrawmax": ["wondershare", ["cc-download.wondershare.cc"]],
  "wondershare-edrawmind": ["wondershare", ["cc-download.wondershare.cc"]],
  "wondershare-filmora": ["wondershare", ["download.wondershare.com"]],
  "wondershare-pdfelement": ["wondershare", ["cc-download.wondershare.cc"]],
  "xmind-ai": ["xmind", ["dl3.xmind.cn"]]
});
const ARTIFACT_KINDS = new Set(["exe", "msi", "msix", "zip"]);
const ALLOWED_FIELDS = new Set(["url", "fileName", "artifactKind"]);
const LEGACY_DESKTOP_DOWNLOAD_MODULE_ID = "desktop-download-only";
const SIGNED_CATALOG_MODULE_ID = "desktop-download-only.signed-catalog";
const SIGNED_CATALOG_PROFILE_ID = SIGNED_CATALOG_MODULE_ID;
const SIGNED_CATALOG_FIELDS = new Set(["url", "fileName", "artifactKind", "mirrors"]);
const MAX_ARTIFACT_URL_LENGTH = 2048;
const MAX_ARTIFACT_FILE_NAME_LENGTH = 180;
const MAX_MIRRORS = 4;

function isHttpsUrl(value) {
  if (typeof value !== "string" || value.length > MAX_ARTIFACT_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isSafeArtifactFileName(fileName, artifactKind) {
  return typeof fileName === "string" &&
    fileName.length > 0 &&
    fileName.length <= MAX_ARTIFACT_FILE_NAME_LENGTH &&
    !/[\\/]/.test(fileName) &&
    new RegExp(`\\.${artifactKind}$`, "i").test(fileName);
}

function validateSignedDesktopDownloadArtifact(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    return { ok: false, error: "signed desktop artifact invalid" };
  }
  if (Object.keys(artifact).some((key) => !SIGNED_CATALOG_FIELDS.has(key))) {
    return { ok: false, error: "signed desktop artifact contains execution fields" };
  }
  if (
    !isHttpsUrl(artifact.url) ||
    typeof artifact.fileName !== "string" ||
    typeof artifact.artifactKind !== "string" ||
    !ARTIFACT_KINDS.has(artifact.artifactKind) ||
    !isSafeArtifactFileName(artifact.fileName, artifact.artifactKind)
  ) {
    return { ok: false, error: "signed desktop artifact format rejected" };
  }
  if (
    artifact.mirrors !== undefined &&
    (!Array.isArray(artifact.mirrors) ||
      artifact.mirrors.length > MAX_MIRRORS ||
      artifact.mirrors.some((url) => !isHttpsUrl(url)) ||
      artifact.mirrors.includes(artifact.url) ||
      new Set(artifact.mirrors).size !== artifact.mirrors.length)
  ) {
    return { ok: false, error: "signed desktop artifact mirrors rejected" };
  }
  return Object.freeze({
    ok: true,
    artifact: Object.freeze({
      url: artifact.url,
      fileName: artifact.fileName,
      artifactKind: artifact.artifactKind,
      ...(artifact.mirrors ? { mirrors: Object.freeze([...artifact.mirrors]) } : {})
    })
  });
}

function getDesktopDownloadOnlyProfile(productId) {
  const row = PROFILES[productId];
  if (!row) return null;
  return Object.freeze({
    productId,
    vendorId: row[0],
    profileId: `desktop-download-only.${productId}`,
    allowedDomains: Object.freeze([...row[1]]),
    allowedArtifactKinds: Object.freeze(["exe", "msi", "msix", "zip"])
  });
}

function publicDesktopDownloadOnlyProfiles() {
  return Object.freeze(Object.keys(PROFILES).map((productId) => {
    const profile = getDesktopDownloadOnlyProfile(productId);
    return Object.freeze({
      id: profile.profileId,
      label: productId,
      moduleId: LEGACY_DESKTOP_DOWNLOAD_MODULE_ID,
      productId,
      vendorId: profile.vendorId,
      productType: "desktop-download-only",
      kind: "桌面端",
      mode: "desktop-download-only",
      requirements: Object.freeze([]),
      capabilities: Object.freeze(["website", "tutorial", "install"])
    });
  }));
}

function validateDesktopDownloadOnlyArtifact(productId, artifact) {
  const profile = getDesktopDownloadOnlyProfile(productId);
  if (!profile || !artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    return { ok: false, error: "desktop-download-only artifact invalid" };
  }
  if (Object.keys(artifact).some((key) => !ALLOWED_FIELDS.has(key))) {
    return { ok: false, error: "desktop-download-only artifact contains execution fields" };
  }
  if (typeof artifact.url !== "string" || typeof artifact.fileName !== "string" || typeof artifact.artifactKind !== "string") {
    return { ok: false, error: "desktop-download-only artifact incomplete" };
  }
  if (!ARTIFACT_KINDS.has(artifact.artifactKind) || !profile.allowedArtifactKinds.includes(artifact.artifactKind)) {
    return { ok: false, error: "desktop-download-only artifact kind rejected" };
  }
  if (!isHttpsUrl(artifact.url) || !isSafeArtifactFileName(artifact.fileName, artifact.artifactKind)) {
    return { ok: false, error: "desktop-download-only artifact format rejected" };
  }
  let url;
  try { url = new URL(artifact.url); } catch { return { ok: false, error: "desktop-download-only URL invalid" }; }
  if (!profile.allowedDomains.includes(url.hostname.toLowerCase())) {
    return { ok: false, error: "desktop-download-only URL domain rejected" };
  }
  return { ok: true, profile, artifact: Object.freeze({ ...artifact }) };
}

function desktopDownloadOnlyArtifactFromReceipt(productId, receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return null;
  }
  const result = validateDesktopDownloadOnlyArtifact(productId, {
    url: receipt.url,
    fileName: receipt.fileName,
    artifactKind: receipt.artifactKind
  });
  return result.ok ? { ...result.artifact } : null;
}

function signedDesktopDownloadArtifactFromReceipt(receipt) {
  if (!receipt || receipt.signedCatalogDownload !== true) return null;
  const result = validateSignedDesktopDownloadArtifact({
    url: receipt.url,
    fileName: receipt.fileName,
    artifactKind: receipt.artifactKind,
    ...(Array.isArray(receipt.mirrors) ? { mirrors: receipt.mirrors } : {})
  });
  return result.ok ? { ...result.artifact } : null;
}

function buildDesktopDownloadOnlyPlan(productId, artifact) {
  const result = validateDesktopDownloadOnlyArtifact(productId, artifact);
  if (!result.ok) return null;
  const sources = [Object.freeze({
    url: result.artifact.url,
    allowedHosts: Object.freeze([...result.profile.allowedDomains]),
    label: "official"
  })];
  return Object.freeze({
    productId,
    url: result.artifact.url,
    fileName: result.artifact.fileName,
    allowedHosts: [...result.profile.allowedDomains],
    sources: Object.freeze(sources),
    installerKind: result.artifact.artifactKind === "zip" ? "portable-zip" : "vendor-installer",
    artifactKind: result.artifact.artifactKind,
    safetyReserveBytes: 512 * 1024 * 1024,
    installDiskBytes: 2 * 1024 * 1024 * 1024,
    environmentId: "",
    sourceLabel: "official",
    downloadPolicy: "desktop-download-only",
    signedCatalogDownload: true
  });
}

function buildSignedDesktopDownloadPlan(productId, artifact) {
  const result = validateSignedDesktopDownloadArtifact(artifact);
  if (!result.ok) return null;
  const sources = [result.artifact.url, ...(result.artifact.mirrors || [])].map((url, index) => ({
    url,
    allowedHosts: [new URL(url).hostname.toLowerCase()],
    label: index === 0 ? "official" : "mirror"
  }));
  return Object.freeze({
    productId,
    url: result.artifact.url,
    fileName: result.artifact.fileName,
    allowedHosts: sources.flatMap((source) => source.allowedHosts),
    sources: Object.freeze(sources.map((source) => Object.freeze(source))),
    installerKind: result.artifact.artifactKind === "zip" ? "portable-zip" : "vendor-installer",
    artifactKind: result.artifact.artifactKind,
    safetyReserveBytes: 512 * 1024 * 1024,
    installDiskBytes: 2 * 1024 * 1024 * 1024,
    environmentId: "",
    sourceLabel: "official",
    downloadPolicy: "desktop-download-only",
    signedCatalogDownload: true
  });
}

module.exports = {
  getDesktopDownloadOnlyProfile,
  publicDesktopDownloadOnlyProfiles,
  LEGACY_DESKTOP_DOWNLOAD_MODULE_ID,
  SIGNED_CATALOG_MODULE_ID,
  SIGNED_CATALOG_PROFILE_ID,
  validateSignedDesktopDownloadArtifact,
  validateDesktopDownloadOnlyArtifact,
  desktopDownloadOnlyArtifactFromReceipt,
  signedDesktopDownloadArtifactFromReceipt,
  buildDesktopDownloadOnlyPlan,
  buildSignedDesktopDownloadPlan,
  desktopDownloadOnlyProductIds: Object.freeze(Object.keys(PROFILES))
};
