"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { atomicWrite, createReleaseStore, writeImmutable } = require("../../admin/release-store.cjs");
const { validateCatalog } = require("../../shared/catalog.cjs");
const { materializeLegacyVendorIconUrls } = require("../../shared/catalog-release-icon-compat.cjs");
const { verifySignedEnvelope } = require("../../shared/signed-release.cjs");

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function readRegular(filePath) {
  const stat = fs.lstatSync(filePath);
  assert.equal(stat.isFile(), true, `${filePath} is not a regular file`);
  assert.equal(stat.isSymbolicLink(), false, `${filePath} is a symlink`);
  return fs.readFileSync(filePath);
}

function readJson(filePath) {
  return JSON.parse(readRegular(filePath).toString("utf8"));
}

function requireAbsolute(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.equal(path.isAbsolute(value), true, `${label} must be absolute`);
  return path.resolve(value);
}

function stateWithoutTransitionFields(value) {
  const stable = structuredClone(value);
  delete stable.draft;
  delete stable.channels.v2;
  return stable;
}

function readActiveRelease(publishedDirectory, channel) {
  const store = createReleaseStore({
    rootDirectory: publishedDirectory,
    signingKeyProvider: async () => { throw new Error("activation never signs"); }
  });
  return store.readChannel(channel).then((state) => {
    assert.ok(state.activeRelease, `${channel} has no active release`);
    return store.readRelease(state.activeRelease.releaseId, { channel });
  });
}

function assertTransition({ manifest, baseline, target, active7Envelope }) {
  assert.deepEqual(stateWithoutTransitionFields(target), stateWithoutTransitionFields(baseline));
  assert.equal(baseline.draft.revision, manifest.baseline.draftRevision);
  assert.equal(baseline.channels.v2.activeReleaseId, manifest.baseline.activeV2ReleaseId);
  assert.equal(baseline.channels.v2.activeCatalogVersion, manifest.baseline.activeV2CatalogVersion);
  assert.equal(target.draft.revision, manifest.target.draftRevision);
  assert.equal(target.draft.updatedAt, manifest.target.draftUpdatedAt);
  validateCatalog(structuredClone(target.draft.catalog));
  assert.deepEqual(
    materializeLegacyVendorIconUrls(target.draft.catalog, manifest.catalogAssetOrigin),
    active7Envelope.payload.catalog,
    "draft publication projection must equal the fixed signed active7 catalog"
  );
  assert.equal(target.channels.v2.activeReleaseId, manifest.target.releaseId);
  assert.equal(target.channels.v2.activeCatalogVersion, manifest.target.catalogVersion);
  assert.deepEqual(
    target.channels.v2.history.slice(0, baseline.channels.v2.history.length),
    baseline.channels.v2.history
  );
  assert.equal(target.channels.v2.history.length, baseline.channels.v2.history.length + 1);
  assert.deepEqual(target.channels.v2.history.at(-1), {
    releaseId: manifest.target.releaseId,
    catalogVersion: manifest.target.catalogVersion,
    publishedAt: active7Envelope.payload.publishedAt,
    draftRevision: manifest.target.draftRevision,
    parentReleaseId: manifest.target.parentReleaseId,
    sourceReleaseId: null,
    notes: "",
    keyId: active7Envelope.keyId,
    sha256: manifest.target.releaseSha256,
    fileName: `${manifest.target.releaseId}.json`
  });
  assert.equal(target.activeReleaseId, manifest.v1.activeReleaseId);
  assert.equal(target.activeCatalogVersion, manifest.v1.activeCatalogVersion);
}

function verifyActive7Envelope(envelope, target, trustedKeys) {
  const payload = verifySignedEnvelope(envelope, { kind: "catalog", trustedKeys });
  assert.equal(payload.releaseId, target.releaseId);
  assert.equal(payload.catalogVersion, target.catalogVersion);
  assert.equal(payload.parentReleaseId, target.parentReleaseId);
  return payload;
}

function writeBackup(backupDirectory, stateRaw, manifest) {
  assert.equal(fs.existsSync(backupDirectory), false, "activation backup already exists");
  fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  const statePath = path.join(backupDirectory, "state.json");
  atomicWrite(statePath, stateRaw.toString("utf8"));
  assert.equal(sha256(readRegular(statePath)), manifest.baseline.stateSha256);
  atomicWrite(path.join(backupDirectory, "backup.json"), `${JSON.stringify({
    format: "aihub-catalog-state-activation-backup-v1",
    baselineStateSha256: manifest.baseline.stateSha256,
    activeV2ReleaseId: manifest.baseline.activeV2ReleaseId
  }, null, 2)}\n`);
  return statePath;
}

async function rollbackCatalogState({ publishedDirectory, backupDirectory, manifestPath }) {
  publishedDirectory = requireAbsolute(publishedDirectory, "publishedDirectory");
  backupDirectory = requireAbsolute(backupDirectory, "backupDirectory");
  const manifest = readJson(requireAbsolute(manifestPath, "manifestPath"));
  const backup = readRegular(path.join(backupDirectory, "state.json"));
  assert.equal(sha256(backup), manifest.baseline.stateSha256, "backup state SHA drifted");
  atomicWrite(path.join(publishedDirectory, "state.json"), backup.toString("utf8"));
  assert.equal(sha256(readRegular(path.join(publishedDirectory, "state.json"))), manifest.baseline.stateSha256);
  const release = await readActiveRelease(publishedDirectory, "v2");
  assert.equal(release.release.releaseId, manifest.baseline.activeV2ReleaseId);
  return { activeReleaseId: release.release.releaseId, stateSha256: manifest.baseline.stateSha256 };
}

async function activateCatalogState({
  publishedDirectory,
  artifactDirectory,
  backupDirectory,
  evidenceDirectory,
  manifestPath,
  afterActivation
}) {
  publishedDirectory = requireAbsolute(publishedDirectory, "publishedDirectory");
  artifactDirectory = requireAbsolute(artifactDirectory, "artifactDirectory");
  backupDirectory = requireAbsolute(backupDirectory, "backupDirectory");
  evidenceDirectory = requireAbsolute(evidenceDirectory, "evidenceDirectory");
  manifestPath = requireAbsolute(manifestPath, "manifestPath");
  const manifest = readJson(manifestPath);
  assert.equal(manifest.format, "aihub-catalog-state-activation-v1");
  assert.equal(manifest.candidateOnly, true);
  assert.equal(manifest.publishable, false);
  const statePath = path.join(publishedDirectory, "state.json");
  const baselineRaw = readRegular(statePath);
  assert.equal(sha256(baselineRaw), manifest.baseline.stateSha256, "baseline state SHA drifted");
  const targetPath = path.join(artifactDirectory, manifest.target.stateArtifact);
  const releaseInputPath = path.join(artifactDirectory, manifest.target.releaseArtifact);
  const targetRaw = readRegular(targetPath);
  const releaseRaw = readRegular(releaseInputPath);
  assert.equal(sha256(targetRaw), manifest.target.stateSha256, "target state SHA drifted");
  assert.equal(sha256(releaseRaw), manifest.target.releaseSha256, "active7 release SHA drifted");
  const baseline = JSON.parse(baselineRaw);
  const target = JSON.parse(targetRaw);
  const active7Envelope = JSON.parse(releaseRaw);
  verifyActive7Envelope(active7Envelope, manifest.target, target.trustedKeys);
  assertTransition({ manifest, baseline, target, active7Envelope });
  const active6Path = path.join(publishedDirectory, "releases", `${manifest.baseline.activeV2ReleaseId}.json`);
  assert.equal(sha256(readRegular(active6Path)), manifest.baseline.activeV2ReleaseSha256, "active6 release SHA drifted");
  writeBackup(backupDirectory, baselineRaw, manifest);
  let mustRollback = false;
  try {
    const active7Path = path.join(publishedDirectory, "releases", `${manifest.target.releaseId}.json`);
    if (fs.existsSync(active7Path)) {
      assert.equal(sha256(readRegular(active7Path)), manifest.target.releaseSha256, "existing active7 release SHA drifted");
    } else {
      writeImmutable(active7Path, releaseRaw.toString("utf8"));
    }
    atomicWrite(statePath, targetRaw.toString("utf8"));
    mustRollback = true;
    assert.equal(sha256(readRegular(statePath)), manifest.target.stateSha256, "activated state SHA drifted");
    const release = await readActiveRelease(publishedDirectory, "v2");
    assert.equal(release.release.releaseId, manifest.target.releaseId);
    assert.equal(sha256(readRegular(active6Path)), manifest.baseline.activeV2ReleaseSha256);
    if (afterActivation) await afterActivation();
    fs.mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
    atomicWrite(path.join(evidenceDirectory, "catalog-state-activation.json"), `${JSON.stringify({
      format: "aihub-catalog-state-activation-report-v1",
      baselineStateSha256: manifest.baseline.stateSha256,
      targetStateSha256: manifest.target.stateSha256,
      activeReleaseId: release.release.releaseId,
      activeReleaseSha256: manifest.target.releaseSha256,
      backupDirectory
    }, null, 2)}\n`);
    return { activeReleaseId: release.release.releaseId, stateSha256: manifest.target.stateSha256 };
  } catch (error) {
    if (mustRollback || fs.existsSync(backupDirectory)) {
      try {
        await rollbackCatalogState({ publishedDirectory, backupDirectory, manifestPath });
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], "catalog activation and rollback failed");
      }
    }
    throw error;
  }
}

if (require.main === module) {
  const [command, publishedDirectory, backupDirectory, evidenceDirectory] = process.argv.slice(2);
  const manifestPath = path.join(__dirname, "catalog-active7-state-activation-manifest.json");
  const artifactDirectory = path.join(path.resolve(__dirname, "..", ".."), "artifacts");
  if (command === "activate" && publishedDirectory && backupDirectory && evidenceDirectory && process.argv.length === 6) {
    activateCatalogState({ publishedDirectory, artifactDirectory, backupDirectory, evidenceDirectory, manifestPath })
      .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`));
  } else if (command === "rollback" && publishedDirectory && backupDirectory && !evidenceDirectory && process.argv.length === 5) {
    rollbackCatalogState({ publishedDirectory, backupDirectory, manifestPath })
      .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`));
  } else {
    throw new Error("usage: node catalog-active7-state-activation.cjs activate ABS_PUBLISHED_STORE ABS_BACKUP_DIR ABS_EVIDENCE_DIR | rollback ABS_PUBLISHED_STORE ABS_BACKUP_DIR");
  }
}

module.exports = { activateCatalogState, readActiveRelease, rollbackCatalogState };
