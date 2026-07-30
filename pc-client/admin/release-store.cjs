"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  canonicalize,
  createSignedEnvelope,
  normalizeTrustedKeys,
  validateRollout,
  verifySignedEnvelope
} = require("../shared/signed-release.cjs");

const STATE_SCHEMA_VERSION = 1;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function timestamp(clock) {
  const value = clock();
  const milliseconds =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new Error("发布时钟返回了无效时间");
  }
  return new Date(milliseconds).toISOString();
}

function validateNotes(value) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 500) {
    throw new Error("发布说明无效");
  }
  return value;
}

function initialState() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    draft: null,
    activeReleaseId: null,
    activeCatalogVersion: 0,
    history: [],
    trustedKeys: []
  };
}

function validateState(value) {
  if (
    !value ||
    value.schemaVersion !== STATE_SCHEMA_VERSION ||
    !Number.isSafeInteger(value.activeCatalogVersion) ||
    value.activeCatalogVersion < 0 ||
    !Array.isArray(value.history) ||
    !Array.isArray(value.trustedKeys)
  ) {
    throw new Error("目录发布状态无效");
  }
  if (value.trustedKeys.length > 0) normalizeTrustedKeys(value.trustedKeys);
  if (
    (value.activeReleaseId === null) !==
    (value.activeCatalogVersion === 0)
  ) {
    throw new Error("目录发布状态无效");
  }
  if (
    value.activeReleaseId !== null &&
    (typeof value.activeReleaseId !== "string" ||
      !value.history.some(
        (entry) =>
          entry.releaseId === value.activeReleaseId &&
          entry.catalogVersion === value.activeCatalogVersion
      ))
  ) {
    throw new Error("活动目录发布状态无效");
  }
  if (value.draft !== null) {
    if (
      !Number.isSafeInteger(value.draft.revision) ||
      value.draft.revision < 1 ||
      typeof value.draft.updatedAt !== "string" ||
      Number.isNaN(Date.parse(value.draft.updatedAt))
    ) {
      throw new Error("目录草稿状态无效");
    }
    validateCatalog(clone(value.draft.catalog));
  }
  let previousVersion = 0;
  let previousReleaseId = null;
  const releaseIds = new Set();
  for (const entry of value.history) {
    if (
      !entry ||
      !Number.isSafeInteger(entry.catalogVersion) ||
      entry.catalogVersion !== previousVersion + 1 ||
      typeof entry.releaseId !== "string" ||
      releaseIds.has(entry.releaseId) ||
      typeof entry.fileName !== "string" ||
      path.basename(entry.fileName) !== entry.fileName ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      typeof entry.publishedAt !== "string" ||
      Number.isNaN(Date.parse(entry.publishedAt)) ||
      !Number.isSafeInteger(entry.draftRevision) ||
      entry.draftRevision < 1 ||
      typeof entry.keyId !== "string" ||
      entry.parentReleaseId !== previousReleaseId ||
      (entry.sourceReleaseId !== null &&
        !releaseIds.has(entry.sourceReleaseId))
    ) {
      throw new Error("目录发布历史无效");
    }
    previousVersion = entry.catalogVersion;
    previousReleaseId = entry.releaseId;
    releaseIds.add(entry.releaseId);
  }
  if (previousVersion !== value.activeCatalogVersion) {
    throw new Error("目录发布版本不连续");
  }
  return value;
}

function publicState(state) {
  const activeRelease =
    state.history.find(
      (entry) => entry.releaseId === state.activeReleaseId
    ) || null;
  return clone({
    schemaVersion: state.schemaVersion,
    draft: state.draft,
    activeRelease,
    activeCatalogVersion: state.activeCatalogVersion
  });
}

function atomicWrite(filePath, raw) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, raw, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // The rename already consumed the temporary file.
    }
  }
}

function writeImmutable(filePath, raw) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, raw, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.linkSync(temporaryPath, filePath);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // Best-effort cleanup; immutable target is authoritative.
    }
  }
}

function normalizeSigningKey(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.keyId !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value.keyId) ||
    !value.privateKey
  ) {
    throw new Error("目录签名密钥不可用");
  }
  let privateKey;
  let publicKey;
  try {
    privateKey =
      value.privateKey instanceof crypto.KeyObject
        ? value.privateKey
        : crypto.createPrivateKey(value.privateKey);
    if (privateKey.type !== "private") throw new Error();
    publicKey = crypto.createPublicKey(privateKey);
  } catch {
    throw new Error("目录签名密钥无效");
  }
  if (
    privateKey.asymmetricKeyType !== "ed25519" ||
    publicKey.asymmetricKeyType !== "ed25519"
  ) {
    throw new Error("目录签名密钥必须使用 Ed25519");
  }
  return {
    keyId: value.keyId,
    privateKey,
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64")
  };
}

function createReleaseStore({
  rootDirectory,
  clock = () => new Date(),
  signingKeyProvider
}) {
  if (
    typeof rootDirectory !== "string" ||
    !path.isAbsolute(rootDirectory) ||
    typeof clock !== "function" ||
    typeof signingKeyProvider !== "function"
  ) {
    throw new TypeError("目录发布存储配置无效");
  }
  const statePath = path.join(rootDirectory, "state.json");
  const releaseDirectory = path.join(rootDirectory, "releases");
  let queue = Promise.resolve();

  const enqueue = (operation) => {
    const result = queue.then(operation, operation);
    queue = result.catch(() => {});
    return result;
  };

  const readInternalState = () => {
    if (!fs.existsSync(statePath)) return initialState();
    return validateState(JSON.parse(fs.readFileSync(statePath, "utf8")));
  };

  const writeState = (state) => {
    validateState(state);
    atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`);
  };

  const releaseMetadata = (state, releaseId) =>
    state.history.find((entry) => entry.releaseId === releaseId) || null;

  const readEnvelope = (state, metadata) => {
    const filePath = path.join(releaseDirectory, metadata.fileName);
    const raw = fs.readFileSync(filePath, "utf8");
    if (sha256(raw) !== metadata.sha256) {
      throw new Error("目录发布文件完整性校验失败");
    }
    const envelope = JSON.parse(raw);
    const payload = verifySignedEnvelope(envelope, {
      kind: "catalog",
      trustedKeys: state.trustedKeys
    });
    if (
      payload.releaseId !== metadata.releaseId ||
      payload.catalogVersion !== metadata.catalogVersion
    ) {
      throw new Error("目录发布文件与历史记录不匹配");
    }
    validateCatalog(clone(payload.catalog));
    return envelope;
  };

  const publishCatalog = async ({
    catalog,
    draftRevision,
    activeCatalogVersion,
    notes,
    rollout,
    sourceReleaseId = null
  }) => {
    const state = readInternalState();
    if (
      !state.draft ||
      state.draft.revision !== draftRevision ||
      state.activeCatalogVersion !== activeCatalogVersion
    ) {
      throw new Error("目录草稿或活动版本已变化，请重新读取");
    }
    const normalizedCatalog = validateCatalog(clone(catalog));
    const signingKey = normalizeSigningKey(await signingKeyProvider());
    const publishedAt = timestamp(clock);
    const catalogVersion = state.activeCatalogVersion + 1;
    const releaseId = `catalog-v${String(catalogVersion).padStart(8, "0")}-${sha256(
      canonicalize(normalizedCatalog)
    ).slice(0, 12)}-${crypto.randomUUID().slice(0, 8)}`;
    const existingKey = state.trustedKeys.find(
      (entry) => entry.keyId === signingKey.keyId
    );
    if (existingKey && existingKey.publicKey !== signingKey.publicKey) {
      throw new Error("相同签名密钥 ID 对应了不同公钥");
    }
    const normalizedRollout = validateRollout(
      rollout || {
        percentage: 100,
        salt: `catalog-${String(catalogVersion).padStart(8, "0")}`
      }
    );
    const normalizedNotes = validateNotes(notes);
    const payload = {
      schemaVersion: 1,
      releaseId,
      catalogVersion,
      publishedAt,
      draftRevision,
      parentReleaseId: state.activeReleaseId,
      sourceReleaseId,
      notes: normalizedNotes,
      rollout: normalizedRollout,
      catalogSha256: sha256(canonicalize(normalizedCatalog)),
      catalog: normalizedCatalog
    };
    const envelope = createSignedEnvelope({
      kind: "catalog",
      keyId: signingKey.keyId,
      payload,
      privateKey: signingKey.privateKey
    });
    const raw = `${JSON.stringify(envelope, null, 2)}\n`;
    const fileName = `${releaseId}.json`;
    writeImmutable(path.join(releaseDirectory, fileName), raw);

    const nextState = clone(state);
    if (!existingKey) {
      nextState.trustedKeys.push({
        keyId: signingKey.keyId,
        publicKey: signingKey.publicKey
      });
    }
    const metadata = {
      releaseId,
      catalogVersion,
      publishedAt,
      draftRevision,
      parentReleaseId: state.activeReleaseId,
      sourceReleaseId,
      notes: normalizedNotes,
      keyId: signingKey.keyId,
      sha256: sha256(raw),
      fileName
    };
    nextState.history.push(metadata);
    nextState.activeReleaseId = releaseId;
    nextState.activeCatalogVersion = catalogVersion;
    writeState(nextState);
    return clone({ release: metadata, envelope });
  };

  return Object.freeze({
    readState() {
      return enqueue(() => publicState(readInternalState()));
    },

    saveDraft({ catalog, expectedRevision }) {
      return enqueue(() => {
        const state = readInternalState();
        const currentRevision = state.draft?.revision || 0;
        if (
          !Number.isSafeInteger(expectedRevision) ||
          expectedRevision !== currentRevision
        ) {
          throw new Error("目录草稿版本冲突");
        }
        const normalizedCatalog = validateCatalog(clone(catalog));
        const nextState = clone(state);
        nextState.draft = {
          revision: currentRevision + 1,
          updatedAt: timestamp(clock),
          catalog: normalizedCatalog
        };
        writeState(nextState);
        return clone(nextState.draft);
      });
    },

    publish({
      expectedDraftRevision,
      expectedActiveCatalogVersion,
      notes,
      rollout
    }) {
      return enqueue(async () => {
        const state = readInternalState();
        if (!state.draft) throw new Error("没有可发布的目录草稿");
        return publishCatalog({
          catalog: state.draft.catalog,
          draftRevision: expectedDraftRevision,
          activeCatalogVersion: expectedActiveCatalogVersion,
          notes,
          rollout
        });
      });
    },

    listHistory() {
      return enqueue(() =>
        clone(readInternalState().history).sort(
          (left, right) => right.catalogVersion - left.catalogVersion
        )
      );
    },

    readRelease(releaseId) {
      return enqueue(() => {
        const state = readInternalState();
        const metadata = releaseMetadata(state, releaseId);
        if (!metadata) throw new Error("目录发布不存在");
        return clone({
          release: metadata,
          envelope: readEnvelope(state, metadata)
        });
      });
    },

    rollback({
      releaseId,
      expectedActiveCatalogVersion,
      notes,
      rollout
    }) {
      return enqueue(async () => {
        const state = readInternalState();
        if (state.activeCatalogVersion !== expectedActiveCatalogVersion) {
          throw new Error("活动目录版本已变化，请重新读取");
        }
        const target = releaseMetadata(state, releaseId);
        if (!target) throw new Error("回滚目标不存在");
        if (target.releaseId === state.activeReleaseId) {
          throw new Error("回滚目标已经是活动目录");
        }
        const envelope = readEnvelope(state, target);
        return publishCatalog({
          catalog: envelope.payload.catalog,
          draftRevision: state.draft?.revision || target.draftRevision,
          activeCatalogVersion: expectedActiveCatalogVersion,
          notes,
          rollout,
          sourceReleaseId: target.releaseId
        });
      });
    }
  });
}

module.exports = {
  createReleaseStore
};
