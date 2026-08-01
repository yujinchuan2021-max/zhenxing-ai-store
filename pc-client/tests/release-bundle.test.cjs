"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  catalogReleaseSha256
} = require("../shared/catalog-release.cjs");
const {
  prepareReleaseBundle
} = require("../admin/release-bundle.cjs");
const {
  verifyReleaseBundle
} = require("../admin/release-bundle-verifier.cjs");
const {
  createArtifactBuildMetadata
} = require("../shared/release-provenance.cjs");

function signingKey() {
  const { privateKey } = crypto.generateKeyPairSync("ed25519");
  return { privateKey, source: "environment" };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-bundle-"));
  const catalog = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "..", "admin", "data", "catalog-v1.json"),
      "utf8"
    )
  );
  const installer = path.join(
    root,
    "AI-Hub-0.1.1-Windows-x64-Setup.exe"
  );
  fs.writeFileSync(installer, crypto.randomBytes(4096));
  const catalogEnvelope = {
    payload: {
      schemaVersion: 1,
      releaseId: "catalog-v00000001-aaaaaaaaaaaa-aaaaaaaa",
      catalogVersion: 1,
      publishedAt: "2026-07-30T00:00:00.000Z",
      draftRevision: 1,
      parentReleaseId: null,
      sourceReleaseId: null,
      notes: "",
      rollout: { percentage: 100, salt: "catalog-release-2026" },
      catalogSha256: catalogReleaseSha256(catalog),
      catalog
    }
  };
  const buildProvenance = createArtifactBuildMetadata({
    version: "0.1.1",
    source: {
      revision: "a".repeat(40),
      dirty: false,
      versionTag: "v0.1.1"
    },
    artifactPaths: [installer],
    builtAt: "2026-07-30T00:30:00.000Z"
  });
  return { root, installer, catalogEnvelope, buildProvenance };
}

test("builds and verifies a server-migratable signed release bundle", () => {
  const value = fixture();
  try {
    const outputDirectory = path.join(value.root, "bundle");
    const result = prepareReleaseBundle({
      outputDirectory,
      baseUrl: "https://localhost:4443/",
      catalogEnvelope: value.catalogEnvelope,
      installerPath: value.installer,
      version: "0.1.1",
      buildProvenance: value.buildProvenance,
      signingKeys: {
        catalog: signingKey(),
        update: signingKey()
      },
      publishedAt: "2026-07-30T01:00:00.000Z"
    });
    const verified = verifyReleaseBundle({ bundleDirectory: outputDirectory });
    assert.equal(verified.catalogVersion, 1);
    assert.equal(verified.updateVersion, "0.1.1");
    assert.notEqual(verified.catalogKeyId, verified.updateKeyId);
    assert.equal(verified.source.revision, "a".repeat(40));
    assert.equal(result.update.sha256.length, 64);

    const allPublicText = fs
      .readdirSync(result.publicDirectory, { recursive: true })
      .filter((entry) =>
        fs.statSync(path.join(result.publicDirectory, entry)).isFile()
      )
      .map((entry) => fs.readFileSync(path.join(result.publicDirectory, entry)))
      .map((entry) => entry.toString("utf8"))
      .join("\n");
    assert.doesNotMatch(allPublicText, /BEGIN PRIVATE KEY/);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("signed build provenance binds both Setup and Portable acceptance bytes", () => {
  const value = fixture();
  try {
    const portable = path.join(
      value.root,
      "AI-Hub-0.1.1-Windows-x64-Portable.exe"
    );
    fs.writeFileSync(portable, crypto.randomBytes(3072));
    const buildProvenance = createArtifactBuildMetadata({
      version: "0.1.1",
      source: value.buildProvenance.source,
      artifactPaths: [value.installer, portable],
      builtAt: value.buildProvenance.builtAt
    });
    const outputDirectory = path.join(value.root, "portable-bundle");
    prepareReleaseBundle({
      outputDirectory,
      baseUrl: "https://localhost:4443/",
      catalogEnvelope: value.catalogEnvelope,
      installerPath: value.installer,
      version: "0.1.1",
      buildProvenance,
      attestedArtifactPaths: [value.installer, portable],
      signingKeys: { catalog: signingKey(), update: signingKey() },
      publishedAt: "2026-07-30T01:00:00.000Z"
    });
    const verified = verifyReleaseBundle({ bundleDirectory: outputDirectory });
    assert.deepEqual(
      verified.buildArtifacts.map((entry) => entry.name).sort(),
      [path.basename(value.installer), path.basename(portable)].sort()
    );

    fs.appendFileSync(portable, "tampered");
    assert.throws(
      () =>
        prepareReleaseBundle({
          outputDirectory: path.join(value.root, "tampered-portable-bundle"),
          baseUrl: "https://localhost:4443/",
          catalogEnvelope: value.catalogEnvelope,
          installerPath: value.installer,
          version: "0.1.1",
          buildProvenance,
          attestedArtifactPaths: [value.installer, portable],
          signingKeys: { catalog: signingKey(), update: signingKey() },
          publishedAt: "2026-07-30T01:00:00.000Z"
        }),
      /不一致/
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("rejects source provenance changed outside the signed build attestation", () => {
  const value = fixture();
  try {
    const outputDirectory = path.join(value.root, "bundle");
    prepareReleaseBundle({
      outputDirectory,
      baseUrl: "https://localhost:4443/",
      catalogEnvelope: value.catalogEnvelope,
      installerPath: value.installer,
      version: "0.1.1",
      buildProvenance: value.buildProvenance,
      signingKeys: { catalog: signingKey(), update: signingKey() },
      publishedAt: "2026-07-30T01:00:00.000Z"
    });
    const manifestPath = path.join(
      outputDirectory,
      "public",
      "release-manifest.json"
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.build.source.revision = "f".repeat(40);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest), "utf8");
    assert.throws(
      () => verifyReleaseBundle({ bundleDirectory: outputDirectory }),
      /签名内容/
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("accepts only the fixed local Docker installer name variant", () => {
  const value = fixture();
  try {
    const localInstaller = path.join(
      value.root,
      "AI-Hub-Local-0.1.1-Windows-x64-Setup.exe"
    );
    fs.copyFileSync(value.installer, localInstaller);
    const localBuildProvenance = createArtifactBuildMetadata({
      version: "0.1.1",
      source: value.buildProvenance.source,
      artifactPaths: [localInstaller],
      builtAt: value.buildProvenance.builtAt
    });
    const result = prepareReleaseBundle({
      outputDirectory: path.join(value.root, "local-bundle"),
      baseUrl: "https://localhost:4443/",
      catalogEnvelope: value.catalogEnvelope,
      installerPath: localInstaller,
      version: "0.1.1",
      buildProvenance: localBuildProvenance,
      publishedAt: "2026-08-01T00:00:00.000Z",
      signingKeys: { catalog: signingKey(), update: signingKey() },
      notes: [],
      rollout: { percentage: 100, salt: "local-release-2026" },
      allowLocalhost: true
    });
    assert.equal(
      path.basename(new URL(result.update.downloadUrl).pathname),
      "AI-Hub-Local-0.1.1-Windows-x64-Setup.exe"
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("detects a modified installer before accepting a release bundle", () => {
  const value = fixture();
  try {
    const outputDirectory = path.join(value.root, "bundle");
    const result = prepareReleaseBundle({
      outputDirectory,
      baseUrl: "https://localhost:4443/",
      catalogEnvelope: value.catalogEnvelope,
      installerPath: value.installer,
      version: "0.1.1",
      buildProvenance: value.buildProvenance,
      signingKeys: {
        catalog: signingKey(),
        update: signingKey()
      },
      publishedAt: "2026-07-30T01:00:00.000Z"
    });
    fs.appendFileSync(
      path.join(
        result.publicDirectory,
        "artifacts",
        path.basename(value.installer)
      ),
      "tampered"
    );
    assert.throws(
      () => verifyReleaseBundle({ bundleDirectory: outputDirectory }),
      /完整性/
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("rejects one signing key reused for catalog and update", () => {
  const value = fixture();
  try {
    const shared = signingKey();
    assert.throws(
      () =>
        prepareReleaseBundle({
          outputDirectory: path.join(value.root, "bundle"),
          baseUrl: "https://localhost:4443/",
          catalogEnvelope: value.catalogEnvelope,
          installerPath: value.installer,
          version: "0.1.1",
          buildProvenance: value.buildProvenance,
          signingKeys: { catalog: shared, update: shared }
        }),
      /不同/
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("rejects an installer whose filename version differs from the release", () => {
  const value = fixture();
  try {
    assert.throws(
      () =>
        prepareReleaseBundle({
          outputDirectory: path.join(value.root, "bundle"),
          baseUrl: "https://localhost:4443/",
          catalogEnvelope: value.catalogEnvelope,
          installerPath: value.installer,
          version: "0.1.2",
          buildProvenance: value.buildProvenance,
          signingKeys: { catalog: signingKey(), update: signingKey() }
        }),
      /文件名版本/
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});
