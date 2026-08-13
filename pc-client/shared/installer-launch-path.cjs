"use strict";

const fs = require("node:fs");
const path = require("node:path");

function asciiOnly(value) {
  return /^[\x20-\x7e]+$/.test(String(value || ""));
}

async function prepareInstallerLaunchArtifact({
  sourcePath,
  stagingRoot,
  stagedFileName,
  expectedSha256,
  hashFile,
  verifySignature
}) {
  if (
    typeof sourcePath !== "string" ||
    !path.isAbsolute(sourcePath) ||
    typeof stagingRoot !== "string" ||
    !path.isAbsolute(stagingRoot) ||
    typeof stagedFileName !== "string" ||
    stagedFileName !== path.basename(stagedFileName) ||
    !asciiOnly(stagedFileName) ||
    !/^[a-f0-9]{64}$/i.test(String(expectedSha256 || "")) ||
    typeof hashFile !== "function" ||
    typeof verifySignature !== "function"
  ) {
    throw new TypeError("安装包兼容启动参数无效");
  }
  const source = path.resolve(sourcePath);
  const sourceStat = fs.lstatSync(source);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error("安装包不是普通文件");
  }
  if (asciiOnly(source)) {
    return { filePath: source, staged: false };
  }
  if (!asciiOnly(path.resolve(stagingRoot))) {
    throw new Error("无法为特殊字符路径准备兼容启动位置");
  }

  fs.mkdirSync(stagingRoot, { recursive: true });
  const requestedRootStat = fs.lstatSync(stagingRoot);
  if (!requestedRootStat.isDirectory() || requestedRootStat.isSymbolicLink()) {
    throw new Error("安装包兼容启动目录不可信");
  }
  const canonicalRoot = fs.realpathSync.native(stagingRoot);
  const rootStat = fs.lstatSync(canonicalRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("安装包兼容启动目录不可信");
  }
  const target = path.join(canonicalRoot, stagedFileName);
  fs.copyFileSync(source, target);
  try {
    const [digest, signatureAccepted] = await Promise.all([
      hashFile(target),
      verifySignature(target)
    ]);
    if (
      String(digest || "").toLowerCase() !==
        String(expectedSha256).toLowerCase() ||
      signatureAccepted !== true
    ) {
      throw new Error("兼容启动副本校验失败");
    }
    return { filePath: target, staged: true };
  } catch (error) {
    try {
      fs.rmSync(target, { force: true });
    } catch {
      // A failed fixed target is never launched or reused as trusted evidence.
    }
    throw error;
  }
}

module.exports = {
  prepareInstallerLaunchArtifact
};
