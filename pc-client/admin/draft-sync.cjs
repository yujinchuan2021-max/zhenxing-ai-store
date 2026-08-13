"use strict";

function shouldSyncDiskCatalogDraft(diskCatalog, stateDraft) {
  const diskSchemaVersion = diskCatalog?.schemaVersion;
  const stateSchemaVersion = stateDraft?.catalog?.schemaVersion;
  if (
    !Number.isSafeInteger(diskSchemaVersion) ||
    !Number.isSafeInteger(stateSchemaVersion)
  ) {
    return false;
  }
  if (diskSchemaVersion !== stateSchemaVersion) {
    return diskSchemaVersion > stateSchemaVersion;
  }
  const diskUpdatedAt = Date.parse(diskCatalog.updatedAt || "");
  const stateUpdatedAt = Date.parse(stateDraft.updatedAt || "");
  return Number.isFinite(diskUpdatedAt) &&
    Number.isFinite(stateUpdatedAt) &&
    diskUpdatedAt > stateUpdatedAt;
}

module.exports = { shouldSyncDiskCatalogDraft };
