"use strict";

const { validateReleaseChannel } = require("./release-channel.cjs");

function assertReleasePackageReady({
  variant,
  catalogChannel,
  updateChannel
}) {
  if (!['local', 'production'].includes(variant)) {
    throw new Error("未知客户端发布类型");
  }
  const allowLocalhost = variant === "local";
  let catalog;
  let update;
  try {
    catalog = validateReleaseChannel(catalogChannel, {
      kind: "catalog",
      allowLocalhost
    });
    update = validateReleaseChannel(updateChannel, {
      kind: "update",
      allowLocalhost
    });
  } catch (error) {
    throw new Error(
      variant === "production"
        ? `正式服务器目录通道尚未配置：${error.message}`
        : `本地 Docker 发布通道无效：${error.message}`
    );
  }
  if (!catalog.releaseUrl || !catalog.trustedKeys.length) {
    throw new Error(
      variant === "production"
        ? "正式服务器目录通道尚未配置"
        : "本地 Docker 目录通道尚未配置"
    );
  }
  if (!update.releaseUrl || !update.trustedKeys.length) {
    throw new Error(
      variant === "production"
        ? "正式服务器更新通道尚未配置"
        : "本地 Docker 更新通道尚未配置"
    );
  }
  return Object.freeze({ variant, catalog, update });
}

module.exports = {
  assertReleasePackageReady
};
