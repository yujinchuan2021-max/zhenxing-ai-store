"use strict";

const CATALOG_CHANNELS = Object.freeze(["v1", "v2"]);

function normalizeCatalogChannel(value = "v1") {
  if (!CATALOG_CHANNELS.includes(value)) {
    throw new Error("catalog channel invalid");
  }
  return value;
}

function catalogReleasePath(channel = "v1") {
  return normalizeCatalogChannel(channel) === "v1"
    ? "/catalog-release.json"
    : "/channels/v2/catalog-release.json";
}

module.exports = { CATALOG_CHANNELS, normalizeCatalogChannel, catalogReleasePath };
