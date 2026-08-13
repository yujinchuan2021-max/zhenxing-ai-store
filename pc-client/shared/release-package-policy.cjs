"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { readReleaseChannel } = require("./release-channel.cjs");
const { readCatalogClientChannel } = require("./catalog-client-channel.cjs");
const { validateClientServices } = require("./client-services.cjs");
const { verifyCatalogReleaseIntegrity } = require("./catalog-release.cjs");
const { assertCatalogSigningKeyAllowed } = require("./catalog-key-retirement.cjs");

function assertActiveV2CatalogRelease(catalog, catalogReleaseStoreDirectory) {
  if (!path.isAbsolute(catalogReleaseStoreDirectory || "")) {
    throw new Error("v2 catalog active release store is required");
  }
  let state;
  try {
    state = JSON.parse(
      fs.readFileSync(
        path.join(catalogReleaseStoreDirectory, "state.json"),
        "utf8"
      )
    );
  } catch {
    throw new Error("v2 catalog active release is unreadable");
  }
  const current = state?.channels?.v2;
  const active = current?.history?.find(
    (entry) => entry?.releaseId === current?.activeReleaseId
  );
  if (
    !Number.isSafeInteger(current?.activeCatalogVersion) ||
    current.activeCatalogVersion < 1 ||
    !active ||
    active.catalogVersion !== current.activeCatalogVersion ||
    typeof active.fileName !== "string"
  ) {
    throw new Error("v2 catalog channel has no active signed release");
  }
  const releasesDirectory = path.resolve(catalogReleaseStoreDirectory, "releases");
  const releasePath = path.resolve(releasesDirectory, active.fileName);
  if (!releasePath.startsWith(`${releasesDirectory}${path.sep}`)) {
    throw new Error("v2 catalog active release is unreadable");
  }
  let release;
  try {
    release = verifyCatalogReleaseIntegrity(
      JSON.parse(fs.readFileSync(releasePath, "utf8")),
      { trustedKeys: catalog.trustedKeys }
    );
  } catch {
    throw new Error("v2 catalog active release is unreadable");
  }
  if (
    release.releaseId !== active.releaseId ||
    release.catalogVersion !== current.activeCatalogVersion
  ) {
    throw new Error("v2 catalog active release is unreadable");
  }
}

function assertReleasePackageReady({
  variant,
  catalogChannel,
  updateChannel,
  clientServices,
  catalogReleaseStoreDirectory
}) {
  if (!['local', 'production', 'server-connected-review'].includes(variant)) {
    throw new Error("未知客户端发布类型");
  }
  const allowLocalhost = variant === "local";
  const serverConnectedReview = variant === "server-connected-review";
  let catalog;
  let update;
  let services;
  try {
    catalog = readCatalogClientChannel(catalogChannel, {
      kind: "catalog",
      allowLocalhost
    });
    update = readReleaseChannel(updateChannel, {
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
  for (const key of catalog.trustedKeys) assertCatalogSigningKeyAllowed(key.keyId, "package");
  if (catalog.catalogChannel === "v2") {
    assertActiveV2CatalogRelease(catalog, catalogReleaseStoreDirectory);
  }
  if (serverConnectedReview && (update.releaseUrl || update.trustedKeys.length)) {
    throw new Error("server-connected review must keep the update channel disabled");
  }
  if (!serverConnectedReview && (!update.releaseUrl || !update.trustedKeys.length)) {
    throw new Error(
      variant === "production"
        ? "正式服务器更新通道尚未配置"
        : "本地 Docker 更新通道尚未配置"
    );
  }
  try {
    services = validateClientServices(clientServices, {
      variant: allowLocalhost ? "local" : "production"
    });
  } catch (error) {
    throw new Error(
      variant === "production"
        ? `正式客户端身份与社区服务尚未配置：${error.message}`
        : `本地 Docker 客户端服务地址无效：${error.message}`
    );
  }
  return Object.freeze({ variant, catalog, update, clientServices: services });
}

module.exports = {
  assertReleasePackageReady
};
