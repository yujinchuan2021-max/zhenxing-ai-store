"use strict";

const { catalogReleasePath, normalizeCatalogChannel } = require("./catalog-channel.cjs");
const { readReleaseChannel } = require("./release-channel.cjs");

function readCatalogClientChannel(value, options) {
  const catalogChannel = normalizeCatalogChannel(value?.catalogChannel);
  const { catalogChannel: ignored, ...releaseChannel } = value || {};
  const channel = readReleaseChannel(releaseChannel, options);
  const releaseUrl = channel.releaseUrl ? new URL(channel.releaseUrl) : null;
  if (
    releaseUrl &&
    (releaseUrl.pathname !== catalogReleasePath(catalogChannel) || releaseUrl.search)
  ) {
    throw new Error("catalog channel release URL does not match the explicit channel");
  }
  return { ...channel, catalogChannel };
}

function catalogChannelStorage(channel) {
  const catalogChannel = normalizeCatalogChannel(channel);
  return {
    cacheFileName: `catalog-cache-${catalogChannel}.json`,
    highWaterFileName: `catalog-high-water-${catalogChannel}.json`
  };
}

function normalizeCatalogHighWater(value) {
  if (!value) return { schemaVersion: 1, catalogVersion: 0, catalogSha256: "" };
  if (
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.catalogVersion) ||
    value.catalogVersion < 0 ||
    typeof value.catalogSha256 !== "string" ||
    (value.catalogSha256 !== "" && !/^[a-f0-9]{64}$/.test(value.catalogSha256))
  ) {
    throw new Error("catalog channel high water is invalid");
  }
  return {
    schemaVersion: 1,
    catalogVersion: value.catalogVersion,
    catalogSha256: value.catalogSha256
  };
}

function recordCatalogHighWater(current, release) {
  const highest = normalizeCatalogHighWater(current);
  if (release.catalogVersion < highest.catalogVersion) return highest;
  return {
    schemaVersion: 1,
    catalogVersion: release.catalogVersion,
    catalogSha256: release.catalogSha256
  };
}

module.exports = {
  catalogChannelStorage,
  normalizeCatalogHighWater,
  readCatalogClientChannel,
  recordCatalogHighWater
};
