"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  createSignedEnvelope
} = require("../shared/signed-release.cjs");
const {
  validateSoftwareUpdatePayload
} = require("../shared/software-update-release.cjs");
const {
  INSTALL_MODES,
  INSTALL_REGISTRY
} = require("../shared/install-registry.cjs");
const {
  EXTENSION_INSTALL_REGISTRY
} = require("../shared/extension-install-registry.cjs");
const {
  getApprovedEnvironmentDownloadSources,
  getEnvironmentDownloadPlan
} = require("../shared/environment-download.cjs");

const PUBLISHABLE_STATUSES = new Set(["ready", "delegated"]);
const ENTRY_KEYS = [
  "id",
  "kind",
  "subjectId",
  "label",
  "mode",
  "detectedVersion",
  "status",
  "selected"
];

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys) {
  return (
    isPlainObject(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function validateCenterEntry(entry) {
  if (
    !exactKeys(entry, ENTRY_KEYS) ||
    typeof entry.id !== "string" ||
    entry.id !== `${entry.kind}:${entry.subjectId}` ||
    typeof entry.subjectId !== "string" ||
    typeof entry.label !== "string" ||
    !entry.label.trim() ||
    !["environment", "extension", "product"].includes(entry.kind) ||
    ![
      "environment-download",
      "extension",
      "managed-cli",
      "managed-installer",
      "package-manager"
    ].includes(entry.mode) ||
    !["ready", "delegated", "manual-review", "vendor-managed"].includes(entry.status) ||
    typeof entry.selected !== "boolean" ||
    !(
      entry.detectedVersion === null ||
      (typeof entry.detectedVersion === "string" &&
        /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/.test(entry.detectedVersion))
    ) ||
    (entry.status === "ready" && entry.detectedVersion === null) ||
    (entry.status === "delegated" && entry.detectedVersion !== null) ||
    (entry.selected && !PUBLISHABLE_STATUSES.has(entry.status))
  ) {
    throw new Error("软件更新扫描条目无效");
  }
  return { ...entry, label: entry.label.trim() };
}

function inventoryEntry(input) {
  return validateCenterEntry({
    ...input,
    selected: PUBLISHABLE_STATUSES.has(input.status)
  });
}

function buildSoftwareUpdateInventory({ catalog = null } = {}) {
  const entries = [];
  const environmentIds = [...new Set(
    getApprovedEnvironmentDownloadSources().map((source) => source.environmentId)
  )];
  for (const environmentId of environmentIds) {
    const plan = getEnvironmentDownloadPlan(environmentId);
    const version = String(plan.recommendedVersion || "").trim() || null;
    entries.push(inventoryEntry({
      id: `environment:${environmentId}`,
      kind: "environment",
      subjectId: environmentId,
      label: plan.name,
      mode: "environment-download",
      detectedVersion: version,
      status: version ? "ready" : "manual-review"
    }));
  }

  for (const [productId, registration] of Object.entries(INSTALL_REGISTRY)) {
    let mode = "managed-installer";
    let detectedVersion = null;
    let status = "vendor-managed";
    if (registration.mode === INSTALL_MODES.MANAGED_CLI) {
      mode = "managed-cli";
      detectedVersion = String(
        registration.cli?.expectedVersion || registration.cli?.version || ""
      ).trim() || null;
      status = detectedVersion ? "ready" : "manual-review";
    } else if (registration.mode === INSTALL_MODES.MANAGED_PACKAGE_MANAGER) {
      mode = "package-manager";
      status = "delegated";
    }
    entries.push(inventoryEntry({
      id: `product:${productId}`,
      kind: "product",
      subjectId: productId,
      label: String(registration.label || productId),
      mode,
      detectedVersion,
      status
    }));
  }

  for (const [profileId, profile] of Object.entries(EXTENSION_INSTALL_REGISTRY)) {
    const detectedVersion = String(
      profile.versionRef || profile.sourceManifest?.versionRef || ""
    ).trim() || null;
    entries.push(inventoryEntry({
      id: `extension:${profileId}`,
      kind: "extension",
      subjectId: profileId,
      label: String(profile.label || profileId),
      mode: "extension",
      detectedVersion,
      status: detectedVersion ? "ready" : "manual-review"
    }));
  }

  const knownIds = new Set(entries.map((entry) => entry.id));
  for (const vendor of Array.isArray(catalog?.vendors) ? catalog.vendors : []) {
    for (const product of Array.isArray(vendor?.products) ? vendor.products : []) {
      const id = `product:${String(product?.id || "")}`;
      if (!product?.id || knownIds.has(id)) continue;
      entries.push(inventoryEntry({
        id,
        kind: "product",
        subjectId: product.id,
        label: `${String(vendor.name || vendor.id || "厂商")} · ${String(product.name || product.id)}`,
        mode: "managed-installer",
        detectedVersion: null,
        status: "manual-review"
      }));
      knownIds.add(id);
    }
  }
  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

function defaultState() {
  return {
    schemaVersion: 1,
    revision: 0,
    activeReleaseVersion: 0,
    scannedAt: null,
    publishedAt: null,
    entries: []
  };
}

function validateState(value) {
  const keys = [
    "schemaVersion",
    "revision",
    "activeReleaseVersion",
    "scannedAt",
    "publishedAt",
    "entries"
  ];
  if (
    !exactKeys(value, keys) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !Number.isSafeInteger(value.activeReleaseVersion) ||
    value.activeReleaseVersion < 0 ||
    !(value.scannedAt === null || typeof value.scannedAt === "string") ||
    !(value.publishedAt === null || typeof value.publishedAt === "string") ||
    !Array.isArray(value.entries)
  ) {
    throw new Error("软件更新中心状态无效");
  }
  const entries = value.entries.map(validateCenterEntry);
  const ids = entries.map((entry) => entry.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id, index) => index > 0 && ids[index - 1].localeCompare(id) >= 0)
  ) {
    throw new Error("软件更新中心条目必须唯一并排序");
  }
  return { ...value, entries };
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx"
  });
  fs.renameSync(temporary, filePath);
}

function createSoftwareUpdateCenter({
  statePath,
  releasePath,
  keyId,
  privateKey,
  now = () => new Date().toISOString(),
  scan = buildSoftwareUpdateInventory
}) {
  function readState() {
    try {
      return validateState(JSON.parse(fs.readFileSync(statePath, "utf8")));
    } catch (error) {
      if (error?.code === "ENOENT") return defaultState();
      throw error;
    }
  }

  function commit(state) {
    const validated = validateState(state);
    writeJsonAtomic(statePath, validated);
    return structuredClone(validated);
  }

  function assertRevision(state, expectedRevision) {
    if (!Number.isSafeInteger(expectedRevision) || state.revision !== expectedRevision) {
      throw new Error("软件更新中心修订已变化，请刷新后重试");
    }
  }

  return Object.freeze({
    snapshot() {
      return structuredClone(readState());
    },
    scan({ expectedRevision, catalog = null }) {
      const state = readState();
      assertRevision(state, expectedRevision);
      const previous = new Map(state.entries.map((entry) => [entry.id, entry]));
      const entries = scan({ scannedAt: now(), catalog })
        .map(validateCenterEntry)
        .map((entry) => ({
          ...entry,
          selected: PUBLISHABLE_STATUSES.has(entry.status)
            ? previous.get(entry.id)?.selected ?? entry.selected
            : false
        }))
        .sort((left, right) => left.id.localeCompare(right.id));
      return commit({
        ...state,
        revision: state.revision + 1,
        scannedAt: now(),
        entries
      });
    },
    saveReview({ expectedRevision, selectedIds }) {
      const state = readState();
      assertRevision(state, expectedRevision);
      if (!Array.isArray(selectedIds) || new Set(selectedIds).size !== selectedIds.length) {
        throw new Error("软件更新审核选择无效");
      }
      const selected = new Set(selectedIds);
      for (const id of selected) {
        const entry = state.entries.find((candidate) => candidate.id === id);
        if (!entry || !PUBLISHABLE_STATUSES.has(entry.status)) {
          throw new Error("软件更新审核包含不可发布条目");
        }
      }
      return commit({
        ...state,
        revision: state.revision + 1,
        entries: state.entries.map((entry) => ({
          ...entry,
          selected: selected.has(entry.id)
        }))
      });
    },
    publish({ expectedRevision, rollout }) {
      const state = readState();
      assertRevision(state, expectedRevision);
      if (!state.scannedAt) throw new Error("请先检测软件更新");
      const entries = state.entries
        .filter((entry) => entry.selected)
        .map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          subjectId: entry.subjectId,
          mode: entry.mode,
          version: entry.detectedVersion
        }));
      const publishedAt = now();
      const payload = validateSoftwareUpdatePayload({
        schemaVersion: 1,
        releaseVersion: state.activeReleaseVersion + 1,
        publishedAt,
        rollout,
        entries
      });
      const envelope = createSignedEnvelope({
        kind: "software-updates",
        keyId,
        payload,
        privateKey
      });
      writeJsonAtomic(releasePath, envelope);
      const saved = commit({
        ...state,
        revision: state.revision + 1,
        activeReleaseVersion: payload.releaseVersion,
        publishedAt
      });
      return {
        ...saved,
        publishedEntries: payload.entries.length,
        releasePath
      };
    }
  });
}

module.exports = {
  buildSoftwareUpdateInventory,
  createSoftwareUpdateCenter
};
