function parseVersion(value) {
  const match = String(value || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error("版本号必须使用 x.y.z 格式");
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

function validateUpdateChannel(value, isAllowedUrl) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    typeof value.manifestUrl !== "string" ||
    typeof isAllowedUrl !== "function" ||
    (value.allowedDownloadOrigins !== undefined &&
      !Array.isArray(value.allowedDownloadOrigins))
  ) {
    throw new Error("更新通道结构无效");
  }

  const manifestUrl = value.manifestUrl.trim();
  const allowedDownloadOrigins = value.allowedDownloadOrigins || [];
  if (
    allowedDownloadOrigins.length > 8 ||
    new Set(allowedDownloadOrigins).size !== allowedDownloadOrigins.length
  ) {
    throw new Error("更新下载来源配置无效");
  }
  for (const origin of allowedDownloadOrigins) {
    try {
      const parsed = new URL(origin);
      if (
        !isAllowedUrl(origin) ||
        parsed.origin !== origin ||
        parsed.hostname.includes("*") ||
        parsed.username ||
        parsed.password
      ) {
        throw new Error();
      }
    } catch {
      throw new Error("更新下载来源必须是完整的 HTTPS origin");
    }
  }

  if (!manifestUrl) {
    if (allowedDownloadOrigins.length > 0) {
      throw new Error("禁用的更新通道不能配置下载来源");
    }
  } else if (
    !isAllowedUrl(manifestUrl) ||
    allowedDownloadOrigins.length < 1
  ) {
    throw new Error("更新通道必须配置可信清单地址和下载来源");
  }

  return {
    schemaVersion: 1,
    manifestUrl,
    allowedDownloadOrigins: [...allowedDownloadOrigins]
  };
}

function validateUpdateManifest(
  value,
  isAllowedUrl,
  allowedDownloadOrigins = []
) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    typeof isAllowedUrl !== "function" ||
    !Array.isArray(allowedDownloadOrigins)
  ) {
    throw new Error("更新清单结构无效");
  }
  parseVersion(value.version);
  let downloadOrigin = "";
  try {
    downloadOrigin = new URL(value.downloadUrl).origin;
  } catch {
    throw new Error("更新清单内容无效");
  }
  if (
    typeof value.publishedAt !== "string" ||
    Number.isNaN(Date.parse(value.publishedAt)) ||
    !isAllowedUrl(value.downloadUrl) ||
    !Array.isArray(value.notes) ||
    value.notes.length > 20 ||
    value.notes.some(
      (note) => typeof note !== "string" || note.length < 1 || note.length > 300
    )
  ) {
    throw new Error("更新清单内容无效");
  }
  if (!allowedDownloadOrigins.includes(downloadOrigin)) {
    throw new Error("更新清单使用了未固定的下载来源");
  }
  return {
    schemaVersion: 1,
    version: value.version,
    publishedAt: value.publishedAt,
    downloadUrl: value.downloadUrl,
    notes: value.notes
  };
}

module.exports = {
  compareVersions,
  parseVersion,
  validateUpdateChannel,
  validateUpdateManifest
};
