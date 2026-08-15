"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  catalogActivationArtifacts,
  catalogFreshInstallArtifacts,
  catalogVendorIconAssetsFromState,
  CATALOG_VENDOR_ICON_DIRECTORY
} = require("./workflow-production-release-bundle.cjs");
const { readActiveRelease } = require("./catalog-active7-state-activation.cjs");
const { verifyVendorIconAssetFile } = require("../../shared/vendor-icon.cjs");

const PUBLISHED_DIRECTORY = "/opt/zhenxing-ai/shared/admin/published/catalog-store";
const ADMIN_DATA_DIRECTORY = "/opt/zhenxing-ai/shared/admin/data";
const RELEASE_PREFIX = "/opt/zhenxing-ai/releases/community-production-r25-";
const TERMINAL_SCHEMA = "aihub-catalog-active7-fresh-install-v1";
const CATALOG_FAILURE_CODES_BY_STAGE = Object.freeze({
  "catalog-release-root": "R16_FRESH_CATALOG_RELEASE_ROOT_FAILED",
  "catalog-published-store": "R16_FRESH_CATALOG_PUBLISHED_STORE_FAILED",
  "catalog-artifact-state": "R16_FRESH_CATALOG_STATE_ARTIFACT_FAILED",
  "catalog-artifact-active7": "R16_FRESH_CATALOG_ACTIVE7_ARTIFACT_FAILED",
  "catalog-artifact-active6": "R16_FRESH_CATALOG_ACTIVE6_ARTIFACT_FAILED",
  "catalog-artifact-active72": "R16_FRESH_CATALOG_ACTIVE72_ARTIFACT_FAILED",
  "catalog-state-contract": "R16_FRESH_CATALOG_STATE_CONTRACT_FAILED",
  "catalog-vendor-icon-directory": "R16_FRESH_CATALOG_VENDOR_ICON_DIRECTORY_FAILED",
  "catalog-artifact-vendor-icons": "R16_FRESH_CATALOG_VENDOR_ICON_ARTIFACTS_FAILED",
  "catalog-install-vendor-icons": "R16_FRESH_CATALOG_VENDOR_ICON_INSTALL_FAILED",
  "catalog-release-directory": "R16_FRESH_CATALOG_RELEASE_DIRECTORY_FAILED",
  "catalog-install-active6": "R16_FRESH_CATALOG_INSTALL_ACTIVE6_FAILED",
  "catalog-install-active72": "R16_FRESH_CATALOG_INSTALL_ACTIVE72_FAILED",
  "catalog-install-active7": "R16_FRESH_CATALOG_INSTALL_ACTIVE7_FAILED",
  "catalog-install-state": "R16_FRESH_CATALOG_INSTALL_STATE_FAILED",
  "catalog-verify-v1": "R16_FRESH_CATALOG_VERIFY_V1_FAILED",
  "catalog-verify-v2": "R16_FRESH_CATALOG_VERIFY_V2_FAILED",
  "catalog-unknown": "R16_FRESH_CATALOG_UNKNOWN_FAILED"
});

function catalogFailure(stage) {
  if (!Object.hasOwn(CATALOG_FAILURE_CODES_BY_STAGE, stage)) stage = "catalog-unknown";
  return Object.assign(new Error("fresh catalog install blocked"), {
    catalogFailure: { stage, code: CATALOG_FAILURE_CODES_BY_STAGE[stage] }
  });
}

function catalogStep(stage, operation) {
  try { return operation(); }
  catch { throw catalogFailure(stage); }
}

async function catalogStepAsync(stage, operation) {
  try { return await operation(); }
  catch { throw catalogFailure(stage); }
}

function safeCatalogFailure(error) {
  const failure = error?.catalogFailure;
  return failure && CATALOG_FAILURE_CODES_BY_STAGE[failure.stage] === failure.code
    ? { stage: failure.stage, code: failure.code }
    : { stage: "catalog-unknown", code: CATALOG_FAILURE_CODES_BY_STAGE["catalog-unknown"] };
}

function preserveCatalogFailure(error, cleanup) {
  const failure = safeCatalogFailure(error);
  try { cleanup(); } catch {}
  throw catalogFailure(failure.stage);
}

function catalogFailureTerminal(error) {
  return { schema: TERMINAL_SCHEMA, status: "blocked", failure: safeCatalogFailure(error) };
}

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function readExact(file, expected) {
  const stat = fs.lstatSync(file);
  assert.equal(stat.isFile(), true);
  assert.equal(stat.isSymbolicLink(), false);
  assert.equal(stat.nlink, 1);
  const bytes = fs.readFileSync(file);
  if (expected.bytes !== undefined) assert.equal(bytes.length, expected.bytes);
  assert.equal(sha256(bytes), expected.sha256);
  return bytes;
}
function atomicInstall(target, bytes) {
  const temporary = `${target}.tmp.${process.pid}`;
  try {
    fs.writeFileSync(temporary, bytes, { flag: "wx", mode: 0o644 });
    fs.renameSync(temporary, target);
    if (typeof process.getuid === "function") fs.chownSync(target, 1000, 1000);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

async function installFreshCatalog({ publishedDirectory, artifactDirectory, dataDirectory = ADMIN_DATA_DIRECTORY }) {
  catalogStep("catalog-release-root", () => {
    assert.equal(path.resolve(publishedDirectory), publishedDirectory);
    assert.equal(path.resolve(artifactDirectory), artifactDirectory);
    assert.equal(path.resolve(dataDirectory), dataDirectory);
  });
  catalogStep("catalog-published-store", () => {
    if (fs.existsSync(publishedDirectory)) {
      const stat = fs.lstatSync(publishedDirectory);
      assert.equal(stat.isDirectory(), true);
      assert.equal(stat.isSymbolicLink(), false);
      assert.deepEqual(fs.readdirSync(publishedDirectory), [], "fresh catalog directory is not empty");
    } else {
      fs.mkdirSync(publishedDirectory, { recursive: true, mode: 0o755 });
    }
    if (typeof process.getuid === "function") fs.chownSync(publishedDirectory, 1000, 1000);
    assert.equal(fs.existsSync(path.join(publishedDirectory, "catalog-signing-private.pem")), false);
  });
  const state = catalogStep("catalog-artifact-state", () => readExact(path.join(artifactDirectory, catalogActivationArtifacts.state.path), catalogActivationArtifacts.state));
  const active7 = catalogStep("catalog-artifact-active7", () => readExact(path.join(artifactDirectory, catalogActivationArtifacts.release.path), catalogActivationArtifacts.release));
  const active6 = catalogStep("catalog-artifact-active6", () => readExact(path.join(artifactDirectory, catalogFreshInstallArtifacts.active6.path), catalogFreshInstallArtifacts.active6));
  const active72 = catalogStep("catalog-artifact-active72", () => readExact(path.join(artifactDirectory, catalogFreshInstallArtifacts.active72.path), catalogFreshInstallArtifacts.active72));
  const vendorIcons = catalogStep("catalog-state-contract", () => {
    const parsed = JSON.parse(state);
    assert.equal(parsed.channels.v2.activeReleaseId, "catalog-v00000007-8c49e1972186-0cec5335");
    assert.equal(parsed.activeReleaseId, catalogFreshInstallArtifacts.active72.releaseId);
    return catalogVendorIconAssetsFromState(state);
  });
  const releases = path.join(publishedDirectory, "releases");
  const vendorIconsDirectory = path.join(dataDirectory, "vendor-icons");
  catalogStep("catalog-release-directory", () => {
    fs.mkdirSync(releases, { mode: 0o755 });
    if (typeof process.getuid === "function") fs.chownSync(releases, 1000, 1000);
  });
  try {
    catalogStep("catalog-vendor-icon-directory", () => {
      if (fs.existsSync(dataDirectory)) {
        const stat = fs.lstatSync(dataDirectory);
        assert.equal(stat.isDirectory(), true);
        assert.equal(stat.isSymbolicLink(), false);
        assert.deepEqual(fs.readdirSync(dataDirectory), [], "fresh Admin data directory is not empty");
      } else {
        fs.mkdirSync(dataDirectory, { recursive: true, mode: 0o755 });
      }
      fs.mkdirSync(vendorIconsDirectory, { mode: 0o755 });
      if (typeof process.getuid === "function") {
        fs.chownSync(dataDirectory, 1000, 1000);
        fs.chownSync(vendorIconsDirectory, 1000, 1000);
      }
    });
    for (const asset of vendorIcons) {
      const artifact = path.join(artifactDirectory, CATALOG_VENDOR_ICON_DIRECTORY, path.posix.basename(asset.path));
      const bytes = catalogStep("catalog-artifact-vendor-icons", () => readExact(artifact, { sha256: asset.sha256 }));
      catalogStep("catalog-install-vendor-icons", () => {
        atomicInstall(path.join(vendorIconsDirectory, path.posix.basename(asset.path)), bytes);
        verifyVendorIconAssetFile(dataDirectory, asset);
      });
    }
    catalogStep("catalog-install-active6", () => atomicInstall(path.join(releases, `${catalogFreshInstallArtifacts.active6.releaseId}.json`), active6));
    catalogStep("catalog-install-active72", () => atomicInstall(path.join(releases, `${catalogFreshInstallArtifacts.active72.releaseId}.json`), active72));
    catalogStep("catalog-install-active7", () => atomicInstall(path.join(releases, "catalog-v00000007-8c49e1972186-0cec5335.json"), active7));
    catalogStep("catalog-install-state", () => atomicInstall(path.join(publishedDirectory, "state.json"), state));
    const v1 = await catalogStepAsync("catalog-verify-v1", () => readActiveRelease(publishedDirectory, "v1"));
    catalogStep("catalog-verify-v1", () => assert.equal(v1.release.releaseId, catalogFreshInstallArtifacts.active72.releaseId));
    const v2 = await catalogStepAsync("catalog-verify-v2", () => readActiveRelease(publishedDirectory, "v2"));
    catalogStep("catalog-verify-v2", () => assert.equal(v2.release.releaseId, "catalog-v00000007-8c49e1972186-0cec5335"));
    return Object.freeze({ status: "pass", activeV1: 72, activeV2: 7, vendorIcons: vendorIcons.length, signingKeyPresent: false });
  } catch (error) {
    preserveCatalogFailure(error, () => {
      for (const file of fs.existsSync(releases) ? fs.readdirSync(releases) : []) fs.rmSync(path.join(releases, file), { force: true });
      fs.rmSync(path.join(publishedDirectory, "state.json"), { force: true });
      if (fs.existsSync(releases)) fs.rmdirSync(releases);
      for (const file of fs.existsSync(vendorIconsDirectory) ? fs.readdirSync(vendorIconsDirectory) : []) {
        fs.rmSync(path.join(vendorIconsDirectory, file), { force: true });
      }
      if (fs.existsSync(vendorIconsDirectory)) fs.rmdirSync(vendorIconsDirectory);
    });
  }
}

async function main(argv = process.argv.slice(2)) {
  const releaseRoot = catalogStep("catalog-release-root", () => {
    assert.deepEqual(argv, []);
    const scriptDirectory = fs.realpathSync(__dirname);
    const resolved = fs.realpathSync(path.resolve(scriptDirectory, "..", ".."));
    assert.equal(resolved.startsWith(RELEASE_PREFIX), true);
    return resolved;
  });
  const result = await installFreshCatalog({ publishedDirectory: PUBLISHED_DIRECTORY, artifactDirectory: releaseRoot, dataDirectory: ADMIN_DATA_DIRECTORY });
  process.stdout.write(`${JSON.stringify({ schema: TERMINAL_SCHEMA, ...result })}\n`);
}

if (require.main === module) main().catch((error) => {
  process.stdout.write(`${JSON.stringify(catalogFailureTerminal(error))}\n`);
  process.exitCode = 1;
});

module.exports = {
  CATALOG_FAILURE_CODES_BY_STAGE,
  ADMIN_DATA_DIRECTORY,
  PUBLISHED_DIRECTORY,
  catalogFailureTerminal,
  catalogStep,
  installFreshCatalog,
  preserveCatalogFailure
};
