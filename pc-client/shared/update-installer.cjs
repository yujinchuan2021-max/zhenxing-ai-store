"use strict";

const path = require("node:path");
const { parseVersion } = require("./update.cjs");

const UPDATE_PRODUCT_ID = "aihub-update";

function updateInstallerFileName(version) {
  parseVersion(version);
  return `ZhenXing-AI-${version}-Windows-x64-Setup.exe`;
}

function planUpdateInstallerDownload(offer, channel, downloadRoot) {
  if (
    !offer ||
    typeof offer.downloadUrl !== "string" ||
    typeof offer.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(offer.sha256) ||
    !Number.isSafeInteger(offer.fileSize) ||
    offer.fileSize < 1 ||
    !channel ||
    !Array.isArray(channel.allowedReleaseOrigins) ||
    !path.isAbsolute(downloadRoot)
  ) {
    throw new Error("更新安装包信息无效");
  }

  const fileName = updateInstallerFileName(offer.version);
  let downloadUrl;
  try {
    downloadUrl = new URL(offer.downloadUrl);
  } catch {
    throw new Error("更新安装包地址无效");
  }
  if (
    downloadUrl.protocol !== "https:" ||
    !channel.allowedReleaseOrigins.includes(downloadUrl.origin)
  ) {
    throw new Error("更新安装包来源未通过客户端安全策略");
  }

  return {
    productId: UPDATE_PRODUCT_ID,
    url: downloadUrl.href,
    target: path.join(downloadRoot, fileName),
    expectedSha256: offer.sha256.toLowerCase(),
    expectedFileSize: offer.fileSize,
    allowedFinalOrigins: [...channel.allowedReleaseOrigins]
  };
}

function verifyUpdateInstallerDownload(result, plan) {
  if (
    !result ||
    !plan ||
    path.resolve(result.filePath || "") !== path.resolve(plan.target || "") ||
    String(result.sha256 || "").toLowerCase() !== plan.expectedSha256 ||
    result.fileSize !== plan.expectedFileSize
  ) {
    throw new Error("更新安装包完整性校验失败");
  }
  return {
    filePath: path.resolve(result.filePath),
    sha256: plan.expectedSha256,
    fileSize: plan.expectedFileSize
  };
}

module.exports = {
  UPDATE_PRODUCT_ID,
  planUpdateInstallerDownload,
  updateInstallerFileName,
  verifyUpdateInstallerDownload
};
