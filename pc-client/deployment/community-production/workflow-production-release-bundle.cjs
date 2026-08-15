"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createManifest } = require("./verify-manifest.cjs");
const { createIdentitySourceManifest } = require("./identity-source-manifest.cjs");
const {
  validateVendorIconAsset,
  verifyVendorIconAssetFile
} = require("../../shared/vendor-icon.cjs");
const {
  flarumImageArtifact,
  oldAdminImageArtifact,
  rollbackIdentityImageArtifact,
  verifyWorkflowImageArchive
} = require("./workflow-image-archive.cjs");

const workspace = path.resolve(__dirname, "..", "..");
const deploymentManifestPath = "deployment/community-production/manifest.json";
const controlFiles = Object.freeze({
  bundle: ".aihub-workflow-release-bundle.json",
  table: ".aihub-workflow-release-bundle.tsv",
  identity: ".aihub-identity-source-manifest.json",
  marker: ".aihub-workflow-release-prepared.json"
});
const adminImageArtifact = Object.freeze({
  source: "output/workflow-production-admin-active7-0.1.40-src-186ff057efd3.tar",
  path: "artifacts/admin-active7-image.tar",
  image: "zhenxing-ai/admin:0.1.40-src-186ff057efd3",
  imageId: "sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd",
  sourceDigest: "186ff057efd317b5b54af564e22c7cf3e3eac0f8af62b18dd48defc2d719f6e9",
  sourceRevision: "f90543d936397fbdfa8a370a9a0b62e7b3a3f0ce",
  releaseLabel: "0.1.40",
  user: "node",
  bytes: 60332032,
  sha256: "e9088c657e0acb18835b295b5e3436fd1733881cfe0a670d3ed62eaaf939fd40"
});
const identityImageArtifact = Object.freeze({
  source: "output/identity-pure-source-post-readback-candidate-20260810-2a1147346c5e/identity-image.tar",
  path: "artifacts/identity-r11-image.tar",
  image: "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e",
  imageId: "sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748",
  sourceDigest: "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7",
  sourceRevision: "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7",
  releaseLabel: "candidate-only-2a1147346c5e",
  user: "node",
  bytes: 58903552,
  sha256: "5026c7ae3fd05518434d28a1a704aacd81d138e7e74ca239d8110d8b15faa79b"
});
const protectedImageArtifacts = Object.freeze([
  rollbackIdentityImageArtifact,
  oldAdminImageArtifact,
  flarumImageArtifact
]);
const catalogActivationManifest = require("./catalog-active7-state-activation-manifest.json");
const catalogActivationArtifacts = Object.freeze({
  state: {
    source: "admin/published/catalog-store/state.json",
    path: "artifacts/catalog-active7-state.json",
    sha256: catalogActivationManifest.target.stateSha256
  },
  release: {
    source: "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json",
    path: "artifacts/catalog-active7-release.json",
    sha256: catalogActivationManifest.target.releaseSha256
  }
});
const catalogFreshInstallArtifacts = Object.freeze({
  active6: Object.freeze({
    source: "admin/published/catalog-store/releases/catalog-v00000006-567e671621f1-3dcee587.json",
    path: "artifacts/catalog-active6-release.json",
    releaseId: "catalog-v00000006-567e671621f1-3dcee587",
    bytes: 1449805,
    sha256: "c1ea9b76d1e134be1e565cf5018a77013a2387fe59452f3ebdc1f0e96f49e139"
  }),
  active72: Object.freeze({
    source: "admin/published/catalog-store/releases/catalog-v00000072-e286516335da-a8b62a49.json",
    path: "artifacts/catalog-active72-v1-release.json",
    releaseId: "catalog-v00000072-e286516335da-a8b62a49",
    bytes: 1397265,
    sha256: "1321cf4507ed601fc201ed13a7ceadb9b542b51375e9f7ac6b7099d2f280b6b8"
  })
});
const catalogActivationRuntimePaths = Object.freeze([
  "admin/release-store.cjs",
  "shared/catalog-channel.cjs",
  "shared/catalog-release-icon-compat.cjs",
  "shared/catalog.cjs",
  "shared/signed-release.cjs"
]);
const CATALOG_VENDOR_ICON_DIRECTORY = "artifacts/catalog-vendor-icons";

function catalogVendorIconAssetsFromState(stateBytes) {
  const state = JSON.parse(stateBytes);
  assert.ok(state?.draft?.catalog && Array.isArray(state.draft.catalog.vendors));
  const assets = new Map();
  for (const vendor of state.draft.catalog.vendors) {
    if (vendor.iconAsset === undefined) continue;
    const asset = validateVendorIconAsset(vendor.iconAsset);
    const existing = assets.get(asset.path);
    if (existing) assert.deepEqual(existing, asset, `conflicting vendor icon asset: ${asset.path}`);
    else assets.set(asset.path, asset);
  }
  assert.equal(assets.size, 204, "active7 vendor icon closure drifted");
  return Object.freeze(ordered(assets.keys()).map((relative) => Object.freeze({ ...assets.get(relative) })));
}

function catalogVendorIconRecords(stateBytes, sourceDirectory = path.join(workspace, "admin", "data", "vendor-icons")) {
  return catalogVendorIconAssetsFromState(stateBytes).map((asset) => {
    const source = path.join(sourceDirectory, path.posix.basename(asset.path));
    const stat = fs.lstatSync(source);
    assert.equal(stat.isFile(), true, `vendor icon is not a regular file: ${asset.path}`);
    assert.equal(stat.isSymbolicLink(), false, `vendor icon is a symlink: ${asset.path}`);
    assert.equal(stat.nlink, 1, `vendor icon has multiple links: ${asset.path}`);
    const bytes = fs.readFileSync(source);
    assert.equal(sha256(bytes), asset.sha256, `vendor icon digest drifted: ${asset.path}`);
    if (sourceDirectory === path.join(workspace, "admin", "data", "vendor-icons")) {
      verifyVendorIconAssetFile(path.join(workspace, "admin", "data"), asset);
    }
    return {
      path: `${CATALOG_VENDOR_ICON_DIRECTORY}/${path.posix.basename(asset.path)}`,
      bytes: bytes.length,
      sha256: asset.sha256,
      mode: "0644"
    };
  });
}

function catalogActivationArtifactPaths(options = {}) {
  return {
    state: options.catalogStateArtifactPath
      ? path.resolve(options.catalogStateArtifactPath)
      : path.join(workspace, catalogActivationArtifacts.state.source),
    release: options.catalogReleaseArtifactPath
      ? path.resolve(options.catalogReleaseArtifactPath)
      : path.join(workspace, catalogActivationArtifacts.release.source)
  };
}
const executablePaths = new Set([
  "deployment/community-production/backup.sh",
  "deployment/community-production/caddy-entrypoint.sh",
  "deployment/community-production/caddy-secret-seed.sh",
  "deployment/community-production/host-secret-authority.sh",
  "deployment/community-production/identity-entrypoint.sh",
  "deployment/community-production/issue-caddy-gateway-secret.sh",
  "deployment/community-production/prepare-workflow-production-release.sh",
  "deployment/community-production/probe-caddy-secret-volume.sh",
  "deployment/community-production/restore-drill.sh",
  "deployment/community-production/run-migrations.sh",
  "deployment/community-production/run-workflow-migration.sh",
  "deployment/community-production/run-workflow-production-migration.sh",
  "deployment/community-production/seed-caddy-secret-volume.sh",
  "deployment/community-production/workflow-cutover-admin-origin.sh",
  "deployment/community-production/workflow-cutover-compose-files.sh",
  "deployment/community-production/workflow-cutover-reviewer-origin.sh",
  "deployment/community-production/workflow-node-runtime.sh",
  "deployment/community-production/workflow-production-cutover.sh",
  "deployment/community-production/workflow-production-cutover-launcher.sh",
  "deployment/community-production/workflow-production-emergency-disable.sh",
  "deployment/community-production/workflow-production-fresh-host-launcher.sh",
  "deployment/community-production/workflow-production-fresh-host-runner.sh",
  "deployment/community-production/workflow-production-fresh-host-stage0.sh",
  "deployment/community-production/workflow-production-fresh-secret-authority.sh",
  "deployment/community-production/workflow-production-r12-executor.sh",
  "deployment/community-production/workflow-production-r12-launcher.sh",
  "deployment/community-production/workflow-review-secret.sh"
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function ordered(values) {
  return [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function expectedMode(relative) {
  return executablePaths.has(relative) ? "0755" : "0644";
}

function assertFrozenDeploymentManifest(manifest) {
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(workspace, deploymentManifestPath), "utf8")),
    manifest,
    "deployment manifest is not frozen at the current source set"
  );
}

function publicImageArtifact(artifact) {
  return {
    path: artifact.path,
    image: artifact.image,
    imageId: artifact.imageId,
    sourceDigest: artifact.sourceDigest,
    user: artifact.user,
    bytes: artifact.bytes,
    sha256: artifact.sha256
  };
}

function createWorkflowProductionReleaseBundleManifest(options = {}) {
  const deployment = createManifest();
  if (options.requireFrozen === true) assertFrozenDeploymentManifest(deployment);
  const identity = createIdentitySourceManifest();
  const records = new Map();
  for (const entry of [...deployment.files, ...identity.files]) records.set(entry.path, entry);
  for (const relative of catalogActivationRuntimePaths) {
    const bytes = fs.readFileSync(path.join(workspace, relative));
    records.set(relative, { path: relative, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const deploymentManifestBytes = fs.readFileSync(path.join(workspace, deploymentManifestPath));
  records.set(deploymentManifestPath, {
    path: deploymentManifestPath,
    bytes: deploymentManifestBytes.length,
    sha256: sha256(deploymentManifestBytes)
  });

  const files = ordered(records.keys()).map((relative) => ({
    ...records.get(relative),
    mode: expectedMode(relative)
  }));
  const adminArtifactPath = options.artifactPath
    ? path.resolve(options.artifactPath)
    : path.join(workspace, adminImageArtifact.source);
  const adminArtifactBytes = fs.readFileSync(adminArtifactPath);
  assert.equal(adminArtifactBytes.length, adminImageArtifact.bytes, "Admin image archive size drifted");
  assert.equal(sha256(adminArtifactBytes), adminImageArtifact.sha256, "Admin image archive digest drifted");
  files.push({
    path: adminImageArtifact.path,
    bytes: adminImageArtifact.bytes,
    sha256: adminImageArtifact.sha256,
    mode: "0644"
  });
  const identityArtifactPath = options.identityArtifactPath
    ? path.resolve(options.identityArtifactPath)
    : path.join(workspace, identityImageArtifact.source);
  const identityArtifactBytes = fs.readFileSync(identityArtifactPath);
  assert.equal(identityArtifactBytes.length, identityImageArtifact.bytes, "Identity image archive size drifted");
  assert.equal(sha256(identityArtifactBytes), identityImageArtifact.sha256, "Identity image archive digest drifted");
  files.push({
    path: identityImageArtifact.path,
    bytes: identityImageArtifact.bytes,
    sha256: identityImageArtifact.sha256,
    mode: "0644"
  });
  for (const [artifact, option] of [
    [rollbackIdentityImageArtifact, "rollbackArtifactPath"],
    [oldAdminImageArtifact, "oldAdminArtifactPath"],
    [flarumImageArtifact, "flarumArtifactPath"]
  ]) {
    const archive = options[option] ? path.resolve(options[option]) : path.join(workspace, artifact.source);
    verifyWorkflowImageArchive({ archive, expected: artifact });
    files.push({ path: artifact.path, bytes: artifact.bytes, sha256: artifact.sha256, mode: "0644" });
  }
  const catalogArtifacts = catalogActivationArtifactPaths(options);
  let catalogStateBytes;
  for (const [kind, artifact] of Object.entries(catalogActivationArtifacts)) {
    const bytes = fs.readFileSync(catalogArtifacts[kind]);
    assert.equal(sha256(bytes), artifact.sha256, `catalog activation artifact drifted: ${artifact.path}`);
    files.push({ path: artifact.path, bytes: bytes.length, sha256: artifact.sha256, mode: "0644" });
    if (kind === "state") catalogStateBytes = bytes;
  }
  const catalogVendorIconArtifactDirectory = options.catalogVendorIconArtifactDirectory
    ? path.resolve(options.catalogVendorIconArtifactDirectory)
    : path.join(workspace, "admin", "data", "vendor-icons");
  files.push(...catalogVendorIconRecords(catalogStateBytes, catalogVendorIconArtifactDirectory));
  for (const [kind, artifact] of Object.entries(catalogFreshInstallArtifacts)) {
    const option = kind === "active6" ? "catalogActive6ArtifactPath" : "catalogActive72ArtifactPath";
    const artifactPath = options[option] ? path.resolve(options[option]) : path.join(workspace, artifact.source);
    const bytes = fs.readFileSync(artifactPath);
    assert.equal(bytes.length, artifact.bytes, `fresh catalog artifact size drifted: ${artifact.path}`);
    assert.equal(sha256(bytes), artifact.sha256, `fresh catalog artifact digest drifted: ${artifact.path}`);
    files.push({ path: artifact.path, bytes: artifact.bytes, sha256: artifact.sha256, mode: "0644" });
  }
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const actualShellFiles = files
    .map((entry) => entry.path)
    .filter((relative) => relative.startsWith("deployment/community-production/") && relative.endsWith(".sh"));
  assert.deepEqual(actualShellFiles, ordered(executablePaths), "release executable path allowlist drifted");
  for (const entry of files) {
    assert.match(entry.path, /^[A-Za-z0-9._/-]+$/, `unsafe release path: ${entry.path}`);
    assert.equal(entry.path.startsWith("/") || entry.path.split("/").includes(".."), false);
    assert.equal(/(^|\/)(?:\.env[^/]*|[^/]+\.(?:pem|key))$/i.test(entry.path), false);
  }

  const directories = new Set();
  for (const entry of files) {
    let current = path.posix.dirname(entry.path);
    while (current !== ".") {
      directories.add(current);
      current = path.posix.dirname(current);
    }
  }
  const directoryRecords = ordered(directories).map((relative) => ({ path: relative, mode: "0755" }));
  const canonical = directoryRecords.map((entry) => `D\t${entry.mode}\t${entry.path}\n`)
    .concat(files.map((entry) => `F\t${entry.mode}\t${entry.bytes}\t${entry.sha256}\t${entry.path}\n`))
    .join("");
  const identityBytes = jsonBytes(identity);
  const manifest = {
    format: "aihub-workflow-production-release-bundle-v1",
    candidateOnly: true,
    publishable: false,
    deployment: {
      setDigest: deployment.digest.sha256,
      manifestSha256: sha256(deploymentManifestBytes),
      fileCount: deployment.files.length
    },
    identity: {
      sourceDigest: identity.digest.sha256,
      sourceManifestSha256: sha256(identityBytes),
      fileCount: identity.files.length
    },
    adminImage: {
      path: adminImageArtifact.path,
      image: adminImageArtifact.image,
      imageId: adminImageArtifact.imageId,
      bytes: adminImageArtifact.bytes,
      sha256: adminImageArtifact.sha256
    },
    identityImage: {
      path: identityImageArtifact.path,
      image: identityImageArtifact.image,
      imageId: identityImageArtifact.imageId,
      sourceDigest: identityImageArtifact.sourceDigest,
      user: identityImageArtifact.user,
      bytes: identityImageArtifact.bytes,
      sha256: identityImageArtifact.sha256
    },
    rollbackIdentityImage: {
      path: rollbackIdentityImageArtifact.path,
      image: rollbackIdentityImageArtifact.image,
      imageId: rollbackIdentityImageArtifact.imageId,
      configDigest: rollbackIdentityImageArtifact.configDigest,
      sourceDigest: rollbackIdentityImageArtifact.sourceDigest,
      releaseLabel: rollbackIdentityImageArtifact.releaseLabel,
      user: rollbackIdentityImageArtifact.user,
      bytes: rollbackIdentityImageArtifact.bytes,
      sha256: rollbackIdentityImageArtifact.sha256
    },
    oldAdminImage: publicImageArtifact(oldAdminImageArtifact),
    flarumImage: publicImageArtifact(flarumImageArtifact),
    payload: {
      fileCount: files.length,
      directoryCount: directoryRecords.length,
      digest: sha256(Buffer.from(canonical, "utf8")),
      record: "D\\t<mode>\\t<path>\\n or F\\t<mode>\\t<bytes>\\t<sha256>\\t<path>\\n"
    },
    directories: directoryRecords,
    files
  };
  return manifest;
}

function renderBundleTable(manifest) {
  const rows = [
    "AIHUB_WORKFLOW_PRODUCTION_RELEASE_BUNDLE_V1",
    `M\tdeploymentSetDigest\t${manifest.deployment.setDigest}`,
    `M\tdeploymentManifestSha256\t${manifest.deployment.manifestSha256}`,
    `M\tidentitySourceDigest\t${manifest.identity.sourceDigest}`,
    `M\tidentitySourceManifestSha256\t${manifest.identity.sourceManifestSha256}`,
    `M\tpayloadDigest\t${manifest.payload.digest}`,
    `M\tfileCount\t${manifest.payload.fileCount}`,
    `M\tdirectoryCount\t${manifest.payload.directoryCount}`,
    ...manifest.directories.map((entry) => `D\t${entry.mode}\t${entry.path}`),
    ...manifest.files.map((entry) => `F\t${entry.mode}\t${entry.bytes}\t${entry.sha256}\t${entry.path}`)
  ];
  return `${rows.join("\n")}\n`;
}

function removeExactTree(target, parent) {
  const resolvedParent = path.resolve(parent);
  const resolvedTarget = path.resolve(target);
  if (path.dirname(resolvedTarget) !== resolvedParent || !path.basename(resolvedTarget).includes(".tmp.")) {
    throw new Error("refusing to remove a non-temporary bundle path");
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

function createWorkflowProductionReleaseBundle(outputDirectory) {
  assert.equal(path.isAbsolute(outputDirectory), true, "bundle output must be absolute");
  const output = path.resolve(outputDirectory);
  assert.equal(fs.existsSync(output), false, "bundle output already exists");
  const parent = path.dirname(output);
  fs.mkdirSync(parent, { recursive: true });
  const temporary = path.join(parent, `${path.basename(output)}.tmp.${process.pid}`);
  assert.equal(fs.existsSync(temporary), false, "bundle temporary output already exists");
  const manifest = createWorkflowProductionReleaseBundleManifest({ requireFrozen: true });
  const identity = createIdentitySourceManifest();
  try {
    fs.mkdirSync(path.join(temporary, "payload"), { recursive: true, mode: 0o755 });
    for (const entry of manifest.files) {
      const source = entry.path === adminImageArtifact.path
        ? path.join(workspace, adminImageArtifact.source)
        : entry.path === identityImageArtifact.path
          ? path.join(workspace, identityImageArtifact.source)
        : protectedImageArtifacts.some((artifact) => artifact.path === entry.path)
          ? path.join(workspace, protectedImageArtifacts.find((artifact) => artifact.path === entry.path).source)
        : Object.values(catalogFreshInstallArtifacts).some((artifact) => artifact.path === entry.path)
          ? path.join(workspace, Object.values(catalogFreshInstallArtifacts).find((artifact) => artifact.path === entry.path).source)
        : entry.path === catalogActivationArtifacts.state.path
          ? path.join(workspace, catalogActivationArtifacts.state.source)
        : entry.path === catalogActivationArtifacts.release.path
            ? path.join(workspace, catalogActivationArtifacts.release.source)
        : entry.path.startsWith(`${CATALOG_VENDOR_ICON_DIRECTORY}/`)
          ? path.join(workspace, "admin", "data", "vendor-icons", path.basename(entry.path))
        : path.join(workspace, entry.path);
      const target = path.join(temporary, "payload", ...entry.path.split("/"));
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(target, Number.parseInt(entry.mode, 8));
    }
    fs.writeFileSync(path.join(temporary, controlFiles.bundle), jsonBytes(manifest), { flag: "wx", mode: 0o644 });
    fs.writeFileSync(path.join(temporary, controlFiles.table), renderBundleTable(manifest), { flag: "wx", mode: 0o644 });
    fs.writeFileSync(path.join(temporary, controlFiles.identity), jsonBytes(identity), { flag: "wx", mode: 0o644 });
    fs.renameSync(temporary, output);
  } catch (error) {
    if (fs.existsSync(temporary)) removeExactTree(temporary, parent);
    throw error;
  }
  return manifest;
}

function filesIn(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`prepared release contains a symlink: ${relative}`);
    return entry.isDirectory() ? filesIn(absolute, relative) : [relative];
  });
}

function treeEntries(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`bundle contains a symlink: ${relative}`);
    if (entry.isDirectory()) return [`D\t${relative}`, ...treeEntries(absolute, relative)];
    assert.equal(entry.isFile(), true, `bundle contains a non-regular entry: ${relative}`);
    return [`F\t${relative}`];
  });
}

function verifyBundleTree(bundleDirectory, expected, identity) {
  assert.equal(path.isAbsolute(bundleDirectory), true, "bundle path must be absolute");
  const bundle = fs.realpathSync(bundleDirectory);
  const rootStat = fs.lstatSync(bundle);
  assert.equal(rootStat.isDirectory(), true, "bundle root is not a directory");
  assert.equal(rootStat.isSymbolicLink(), false, "bundle root is a symlink");

  const actual = JSON.parse(fs.readFileSync(path.join(bundle, controlFiles.bundle), "utf8"));
  assert.deepEqual(actual, expected, "bundle manifest drifted");
  assert.equal(fs.readFileSync(path.join(bundle, controlFiles.table), "utf8"), renderBundleTable(expected), "bundle table drifted");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(bundle, controlFiles.identity), "utf8")), identity, "bundle Identity manifest drifted");

  const controls = new Set([controlFiles.bundle, controlFiles.table, controlFiles.identity]);
  const expectedEntries = [
    ...[...controls].map((relative) => `F\t${relative}`),
    "D\tpayload",
    ...expected.directories.map((entry) => `D\tpayload/${entry.path}`),
    ...expected.files.map((entry) => `F\tpayload/${entry.path}`)
  ].sort();
  assert.deepEqual(treeEntries(bundle).sort(), expectedEntries, "bundle path set drifted");
  for (const relative of controls) {
    const stat = fs.lstatSync(path.join(bundle, relative));
    assert.equal(stat.isFile(), true, `${relative} is not a regular file`);
    assert.equal(stat.isSymbolicLink(), false, `${relative} is a symlink`);
    assert.equal(stat.nlink, 1, `${relative} has multiple hard links`);
  }
  for (const entry of expected.files) {
    const absolute = path.join(bundle, "payload", ...entry.path.split("/"));
    const stat = fs.lstatSync(absolute);
    assert.equal(stat.isFile(), true, `${entry.path} is not a regular file`);
    assert.equal(stat.isSymbolicLink(), false, `${entry.path} is a symlink`);
    assert.equal(stat.nlink, 1, `${entry.path} has multiple hard links`);
    const bytes = fs.readFileSync(absolute);
    assert.equal(bytes.length, entry.bytes, `${entry.path} bytes drifted`);
    assert.equal(sha256(bytes), entry.sha256, `${entry.path} digest drifted`);
  }
  return Object.freeze({
    deploymentSetDigest: expected.deployment.setDigest,
    deploymentManifestSha256: expected.deployment.manifestSha256,
    payloadDigest: expected.payload.digest,
    bundleManifestSha256: sha256(fs.readFileSync(path.join(bundle, controlFiles.bundle))),
    bundleTableSha256: sha256(fs.readFileSync(path.join(bundle, controlFiles.table))),
    identitySourceDigest: expected.identity.sourceDigest,
    identitySourceManifestSha256: expected.identity.sourceManifestSha256,
    fileCount: expected.payload.fileCount,
    directoryCount: expected.payload.directoryCount
  });
}

function verifyWorkflowProductionReleaseBundle(bundleDirectory) {
  const bundle = fs.realpathSync(bundleDirectory);
  const expected = createWorkflowProductionReleaseBundleManifest({
    requireFrozen: true,
    artifactPath: path.join(bundle, "payload", adminImageArtifact.path),
    identityArtifactPath: path.join(bundle, "payload", identityImageArtifact.path),
    rollbackArtifactPath: path.join(bundle, "payload", rollbackIdentityImageArtifact.path),
    oldAdminArtifactPath: path.join(bundle, "payload", oldAdminImageArtifact.path),
    flarumArtifactPath: path.join(bundle, "payload", flarumImageArtifact.path),
    catalogStateArtifactPath: path.join(bundle, "payload", catalogActivationArtifacts.state.path),
    catalogReleaseArtifactPath: path.join(bundle, "payload", catalogActivationArtifacts.release.path),
    catalogActive6ArtifactPath: path.join(bundle, "payload", catalogFreshInstallArtifacts.active6.path),
    catalogActive72ArtifactPath: path.join(bundle, "payload", catalogFreshInstallArtifacts.active72.path),
    catalogVendorIconArtifactDirectory: path.join(bundle, "payload", CATALOG_VENDOR_ICON_DIRECTORY)
  });
  return verifyBundleTree(bundle, expected, createIdentitySourceManifest());
}

function verifyPreparedRelease(releaseDirectory, options = {}) {
  assert.equal(path.isAbsolute(releaseDirectory), true, "prepared release path must be absolute");
  const enforcePosixMetadata = process.platform !== "win32";
  if (!enforcePosixMetadata) {
    assert.equal(process.env.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE, "1", "Windows release verification is isolated-acceptance only");
  }
  const release = fs.realpathSync(releaseDirectory);
  assert.equal(fs.lstatSync(release).isSymbolicLink(), false);
  const expected = createWorkflowProductionReleaseBundleManifest({
    requireFrozen: true,
    artifactPath: path.join(release, adminImageArtifact.path),
    identityArtifactPath: path.join(release, identityImageArtifact.path),
    rollbackArtifactPath: path.join(release, rollbackIdentityImageArtifact.path),
    oldAdminArtifactPath: path.join(release, oldAdminImageArtifact.path),
    flarumArtifactPath: path.join(release, flarumImageArtifact.path),
    catalogStateArtifactPath: path.join(release, catalogActivationArtifacts.state.path),
    catalogReleaseArtifactPath: path.join(release, catalogActivationArtifacts.release.path),
    catalogActive6ArtifactPath: path.join(release, catalogFreshInstallArtifacts.active6.path),
    catalogActive72ArtifactPath: path.join(release, catalogFreshInstallArtifacts.active72.path),
    catalogVendorIconArtifactDirectory: path.join(release, CATALOG_VENDOR_ICON_DIRECTORY)
  });
  const actual = JSON.parse(fs.readFileSync(path.join(release, controlFiles.bundle), "utf8"));
  assert.deepEqual(actual, expected, "prepared release bundle manifest drifted");
  assert.equal(fs.readFileSync(path.join(release, controlFiles.table), "utf8"), renderBundleTable(expected));
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(release, controlFiles.identity), "utf8")),
    createIdentitySourceManifest()
  );
  for (const relative of [controlFiles.bundle, controlFiles.table, controlFiles.identity]) {
    const stat = fs.lstatSync(path.join(release, relative));
    assert.equal(stat.isFile(), true, `${relative} is not a regular file`);
    assert.equal(stat.isSymbolicLink(), false, `${relative} is a symlink`);
    assert.equal(stat.nlink, 1, `${relative} has multiple hard links`);
    if (enforcePosixMetadata) {
      assert.equal(`${stat.uid}:${stat.gid}`, "1000:1000", `${relative} owner drifted`);
      assert.equal((stat.mode & 0o7777).toString(8).padStart(4, "0"), "0644", `${relative} mode drifted`);
    }
  }

  const expectedPaths = new Set(expected.files.map((entry) => entry.path));
  const ignored = new Set(Object.values(controlFiles));
  for (const relative of filesIn(release)) {
    if (relative.startsWith(".workflow-runtime/")) continue;
    if (ignored.has(relative)) continue;
    assert.equal(expectedPaths.has(relative), true, `prepared release contains an unknown file: ${relative}`);
  }
  for (const entry of expected.files) {
    const absolute = path.join(release, ...entry.path.split("/"));
    const stat = fs.lstatSync(absolute);
    assert.equal(stat.isFile(), true, `${entry.path} is not a regular file`);
    assert.equal(stat.isSymbolicLink(), false, `${entry.path} is a symlink`);
    assert.equal(stat.nlink, 1, `${entry.path} has multiple hard links`);
    if (enforcePosixMetadata) {
      assert.equal(`${stat.uid}:${stat.gid}`, "1000:1000", `${entry.path} owner drifted`);
      assert.equal((stat.mode & 0o7777).toString(8).padStart(4, "0"), entry.mode, `${entry.path} mode drifted`);
    }
    const bytes = fs.readFileSync(absolute);
    assert.equal(bytes.length, entry.bytes, `${entry.path} bytes drifted`);
    assert.equal(sha256(bytes), entry.sha256, `${entry.path} digest drifted`);
  }
  const marker = {
    format: "aihub-workflow-production-release-prepared-v1",
    candidateOnly: true,
    deploymentSetDigest: expected.deployment.setDigest,
    deploymentManifestSha256: expected.deployment.manifestSha256,
    identitySourceDigest: expected.identity.sourceDigest,
    identitySourceManifestSha256: expected.identity.sourceManifestSha256,
    payloadDigest: expected.payload.digest,
    fileCount: expected.payload.fileCount,
    directoryCount: expected.payload.directoryCount,
    verified: true
  };
  if (options.writeMarker === true) {
    fs.writeFileSync(path.join(release, controlFiles.marker), jsonBytes(marker), { flag: "wx", mode: 0o644 });
  } else {
    const markerPath = path.join(release, controlFiles.marker);
    assert.deepEqual(JSON.parse(fs.readFileSync(markerPath, "utf8")), marker);
    const stat = fs.lstatSync(markerPath);
    assert.equal(stat.isFile(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.nlink, 1);
    if (enforcePosixMetadata) {
      assert.equal(`${stat.uid}:${stat.gid}`, "1000:1000");
      assert.equal((stat.mode & 0o7777).toString(8).padStart(4, "0"), "0644");
    }
  }
  return marker;
}

if (require.main === module) {
  const [command, target, extra] = process.argv.slice(2);
  if (command === "create" && target && extra === undefined) {
    const manifest = createWorkflowProductionReleaseBundle(target);
    process.stdout.write(`${JSON.stringify({
      candidateOnly: true,
      output: path.resolve(target),
      deploymentSetDigest: manifest.deployment.setDigest,
      identitySourceDigest: manifest.identity.sourceDigest,
      payloadDigest: manifest.payload.digest,
      fileCount: manifest.payload.fileCount
    })}\n`);
  } else if (command === "verify-prepared" && target && (extra === undefined || extra === "--write-marker")) {
    process.stdout.write(`${JSON.stringify(verifyPreparedRelease(target, { writeMarker: extra === "--write-marker" }))}\n`);
  } else {
    throw new Error("usage: node workflow-production-release-bundle.cjs create ABS_OUTPUT | verify-prepared ABS_RELEASE [--write-marker]");
  }
}

module.exports = {
  adminImageArtifact,
  catalogActivationArtifacts,
  catalogActivationRuntimePaths,
  catalogVendorIconAssetsFromState,
  CATALOG_VENDOR_ICON_DIRECTORY,
  catalogFreshInstallArtifacts,
  controlFiles,
  createWorkflowProductionReleaseBundle,
  createWorkflowProductionReleaseBundleManifest,
  identityImageArtifact,
  flarumImageArtifact,
  oldAdminImageArtifact,
  rollbackIdentityImageArtifact,
  renderBundleTable,
  verifyBundleTree,
  verifyWorkflowProductionReleaseBundle,
  verifyPreparedRelease
};
