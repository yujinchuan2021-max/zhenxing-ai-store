"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const BLOCK = 512;
const DIGEST = /^sha256:([0-9a-f]{64})$/;
const identityImageArtifact = Object.freeze({
  source: "output/identity-current-workflow-candidate-20260816-d9fa8de84dc8/identity-image.tar",
  path: "artifacts/identity-r11-image.tar",
  bytes: 58_910_720,
  sha256: "01769b7769bf0f93f3d98c5d864822d2c03937b480b145abb7a456b5a6c8519f",
  image: "zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8",
  imageId: "sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01",
  configDigest: "sha256:ed2c114916b7aa84069e44d4e55c1bb60fc4efef9d9bbfcfce4f7657b1826dc5",
  sourceDigest: "d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8",
  sourceRevision: "d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8",
  releaseLabel: "candidate-only-d9fa8de84dc8",
  user: "node",
  os: "linux",
  architecture: "amd64"
});
const rollbackIdentityImageArtifact = Object.freeze({
  source: "output/protected-production-image-exports/identity-19a-production-readonly-20260810T035233/zhenxing-ai-identity-19a-production-readonly.tar",
  path: "artifacts/identity-19a-rollback-image.tar",
  bytes: 58_887_168,
  sha256: "9205edae43228dd7afb66bf179ff321c032f2d8e47e71f61d65fc4165b56e904",
  image: "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392",
  imageId: "sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567",
  configDigest: "sha256:341b0551662a03e16672d6171e1f297fe9f61a015a1aec19d04008bd82b22e5c",
  sourceDigest: "19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c",
  sourceRevision: "f90543d936397fbdfa8a370a9a0b62e7b3a3f0ce",
  releaseLabel: "workflow-reviewer-service-identity-candidate-2026-08-08",
  user: "node",
  os: "linux",
  architecture: "amd64"
});
const recoveryArchive = Object.freeze({
  source: "output/community-production-server-deploy-20260806T1503Z/community-production-images.tar",
  bytes: 300_546_048,
  sha256: "1572dd9d1eebefd73333e7311d608e8e1084d9c74243b8b287113a25ed91048a"
});
const oldAdminImageArtifact = Object.freeze({
  source: "output/protected-production-image-exports/community-baseline-images-20260810/old-admin-b6ea4c5bd0e9.tar",
  path: "artifacts/admin-old-b6ea4c5bd0e9.tar",
  bytes: 60_279_808,
  sha256: "2604d520d1c0a428725c73f507598785cdbdb4c78ac80fba937eec4f953f0ad0",
  image: "zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9",
  imageId: "sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2",
  configDigest: "sha256:fc299d854ac27e7f7edc9dadc73a79772a80682482785579c934ce4cfa60431b",
  sourceDigest: "b6ea4c5bd0e9517579a3c4380fcf2c1617975f1ff6a2c6024a703a71ed4620de",
  sourceRevision: "f90543d936397fbdfa8a370a9a0b62e7b3a3f0ce",
  releaseLabel: "0.1.40",
  user: "node",
  os: "linux",
  architecture: "amd64",
  recoveredFrom: recoveryArchive
});
const flarumImageArtifact = Object.freeze({
  source: "output/protected-production-image-exports/community-baseline-images-20260810/flarum-8b13962a36bf.tar",
  path: "artifacts/flarum-8b13962a36bf.tar",
  bytes: 239_078_912,
  sha256: "2ed8a402b6020f8c7197c53ca2b3ded956b2ea57a616dd12ba8ef044844c779f",
  image: "zhenxing-ai/flarum:community-candidate-8b13962a36bf",
  imageId: "sha256:6c32c21c9961e0dd35757c46be35ec2c8725f5b3537d4d0e7634c3a1cd11ba12",
  configDigest: "sha256:13685e6c481bdc710af3fbf6ee7ba0e65d94bae86735756d1788036c92c8a6a1",
  sourceDigest: "8b13962a36bf031652bd5863163948ed245314f0025852a9529fdbacbbcab3f6",
  sourceRevision: "f90543d936397fbdfa8a370a9a0b62e7b3a3f0ce",
  releaseLabel: "0.1.40",
  user: "",
  os: "linux",
  architecture: "amd64",
  recoveredFrom: recoveryArchive
});

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function field(buffer, start, length) {
  return buffer.subarray(start, start + length).toString("utf8").replace(/\0.*$/s, "").trim();
}

function octal(buffer, start, length) {
  const value = field(buffer, start, length);
  assert.match(value, /^[0-7]+$/, "archive numeric field is invalid");
  return Number.parseInt(value, 8);
}

function isZeroBlock(buffer, offset) {
  for (let index = offset; index < offset + BLOCK; index += 1) {
    if (buffer[index] !== 0) return false;
  }
  return true;
}

function safeEntryName(name) {
  assert.equal(typeof name, "string", "archive entry name is invalid");
  assert.ok(name.length > 0 && !name.includes("\\") && !name.startsWith("/"), "archive entry name is unsafe");
  const withoutSlash = name.replace(/\/$/, "");
  const normalized = path.posix.normalize(withoutSlash);
  assert.equal(normalized, withoutSlash, "archive entry name is unsafe");
  assert.ok(!normalized.split("/").includes(".."), "archive entry name is unsafe");
  return normalized;
}

function readTar(buffer) {
  const entries = new Map();
  let offset = 0;
  let ended = false;
  while (offset + BLOCK <= buffer.length) {
    if (isZeroBlock(buffer, offset)) {
      assert.ok(offset + (2 * BLOCK) <= buffer.length && isZeroBlock(buffer, offset + BLOCK), "archive terminator is incomplete");
      for (let index = offset; index < buffer.length; index += 1) assert.equal(buffer[index], 0, "archive trailing bytes are invalid");
      ended = true;
      break;
    }
    const header = buffer.subarray(offset, offset + BLOCK);
    const storedChecksum = octal(header, 148, 8);
    let checksum = 0;
    for (let index = 0; index < BLOCK; index += 1) checksum += index >= 148 && index < 156 ? 32 : header[index];
    assert.equal(checksum, storedChecksum, "archive header checksum is invalid");
    const name = safeEntryName([field(header, 345, 155), field(header, 0, 100)].filter(Boolean).join("/"));
    assert.equal(entries.has(name), false, "archive entry is duplicated");
    const size = octal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    assert.ok(type === "0" || type === "5", "archive contains a non-regular entry");
    assert.ok(offset + BLOCK + size <= buffer.length, "archive entry is truncated");
    if (type === "5") {
      assert.equal(size, 0, "archive directory is invalid");
      entries.set(name, null);
    } else {
      entries.set(name, buffer.subarray(offset + BLOCK, offset + BLOCK + size));
    }
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
  }
  assert.equal(ended, true, "archive is incomplete");
  return entries;
}

function json(entries, name) {
  const value = entries.get(name);
  assert.ok(Buffer.isBuffer(value), "archive JSON entry is missing");
  try {
    return JSON.parse(value.toString("utf8"));
  } catch {
    throw new Error("archive JSON entry is invalid");
  }
}

function descriptorBlob(entries, descriptor, referenced) {
  assert.ok(descriptor && typeof descriptor === "object" && !Array.isArray(descriptor), "image descriptor is invalid");
  const match = DIGEST.exec(descriptor.digest);
  assert.ok(match && Number.isSafeInteger(descriptor.size) && descriptor.size >= 0, "image descriptor is invalid");
  const name = `blobs/sha256/${match[1]}`;
  const value = entries.get(name);
  assert.ok(Buffer.isBuffer(value), "image descriptor blob is missing");
  assert.equal(value.length, descriptor.size, "image descriptor size drifted");
  assert.equal(sha256(value), match[1], "image descriptor digest drifted");
  referenced.add(name);
  return value;
}

function verifyWorkflowImageArchive({ archive, expected } = {}) {
  assert.ok(typeof archive === "string" && path.isAbsolute(archive), "image archive path must be absolute");
  const stat = fs.lstatSync(archive);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, "image archive must be a single regular file");
  assert.ok(expected && typeof expected === "object", "image archive expectations are missing");
  const archiveBytes = fs.readFileSync(archive);
  assert.equal(archiveBytes.length, expected.bytes, "image archive size drifted");
  assert.equal(sha256(archiveBytes), expected.sha256, "image archive digest drifted");

  const entries = readTar(archiveBytes);
  for (const [name, value] of entries) {
    if (value === null) {
      assert.ok(name === "blobs" || name === "blobs/sha256", "image archive contains an unexpected directory");
    } else {
      assert.ok(name === "index.json" || name === "manifest.json" || name === "oci-layout" || /^blobs\/sha256\/[0-9a-f]{64}$/.test(name), "image archive contains an unexpected file");
    }
  }

  assert.deepEqual(json(entries, "oci-layout"), { imageLayoutVersion: "1.0.0" });
  const index = json(entries, "index.json");
  assert.equal(index.schemaVersion, 2, "OCI index schema is invalid");
  assert.equal(index.mediaType, "application/vnd.oci.image.index.v1+json", "OCI index media type is invalid");
  assert.ok(Array.isArray(index.manifests) && index.manifests.length === 1, "OCI index must contain one target image");
  const root = index.manifests[0];
  assert.equal(root.digest, expected.imageId, "OCI target image ID drifted");
  assert.equal(root.mediaType, "application/vnd.oci.image.index.v1+json", "OCI target descriptor media type is invalid");
  assert.equal(root.annotations?.["io.containerd.image.name"], `docker.io/${expected.image}`, "OCI target image name drifted");

  const dockerManifest = json(entries, "manifest.json");
  assert.ok(Array.isArray(dockerManifest) && dockerManifest.length === 1, "Docker archive must contain one image");
  const dockerImage = dockerManifest[0];
  assert.deepEqual(dockerImage.RepoTags, [expected.image], "Docker archive tag drifted");
  assert.equal(dockerImage.Config, `blobs/sha256/${expected.configDigest.slice(7)}`, "Docker archive config drifted");
  assert.ok(Array.isArray(dockerImage.Layers), "Docker archive layers are invalid");

  const referenced = new Set();
  const targetIndex = JSON.parse(descriptorBlob(entries, root, referenced).toString("utf8"));
  assert.equal(targetIndex.schemaVersion, 2, "target OCI index schema is invalid");
  assert.equal(targetIndex.mediaType, "application/vnd.oci.image.index.v1+json", "target OCI index media type is invalid");
  assert.ok(Array.isArray(targetIndex.manifests), "target OCI manifests are invalid");

  const runnable = targetIndex.manifests.filter((item) => item.platform?.os === expected.os && item.platform?.architecture === expected.architecture);
  const attestations = targetIndex.manifests.filter((item) => item.annotations?.["vnd.docker.reference.type"] === "attestation-manifest");
  assert.equal(runnable.length, 1, "target OCI index must contain one runnable image");
  assert.equal(attestations.length, 1, "target OCI index must contain one attestation manifest");
  assert.equal(targetIndex.manifests.length, runnable.length + attestations.length, "target OCI index contains an unexpected manifest");
  assert.equal(attestations[0].annotations["vnd.docker.reference.digest"], runnable[0].digest, "attestation subject drifted");

  let config;
  let mainLayers;
  for (const descriptor of targetIndex.manifests) {
    const manifest = JSON.parse(descriptorBlob(entries, descriptor, referenced).toString("utf8"));
    assert.equal(manifest.schemaVersion, 2, "OCI manifest schema is invalid");
    assert.equal(manifest.mediaType, "application/vnd.oci.image.manifest.v1+json", "OCI manifest media type is invalid");
    assert.ok(manifest.config && Array.isArray(manifest.layers), "OCI manifest content is invalid");
    const configBytes = descriptorBlob(entries, manifest.config, referenced);
    for (const layer of manifest.layers) descriptorBlob(entries, layer, referenced);
    if (descriptor === runnable[0]) {
      assert.equal(manifest.config.digest, expected.configDigest, "runnable image config digest drifted");
      config = JSON.parse(configBytes.toString("utf8"));
      mainLayers = manifest.layers;
    }
  }

  assert.ok(config && mainLayers, "runnable image content is missing");
  assert.equal(config.os, expected.os, "image operating system drifted");
  assert.equal(config.architecture, expected.architecture, "image architecture drifted");
  assert.equal(config.config?.User || "", expected.user, "image user drifted");
  assert.equal(config.config?.Labels?.["com.aihub.source-content-sha256"], expected.sourceDigest, "image source digest label drifted");
  assert.equal(config.config?.Labels?.["com.aihub.source-revision"], expected.sourceRevision, "image source revision label drifted");
  assert.equal(config.config?.Labels?.["com.aihub.release-version"], expected.releaseLabel, "image release label drifted");
  assert.equal(config.rootfs?.type, "layers", "image rootfs type is invalid");
  assert.equal(config.rootfs?.diff_ids?.length, mainLayers.length, "image rootfs layer count drifted");
  assert.deepEqual(dockerImage.Layers, mainLayers.map((item) => `blobs/sha256/${item.digest.slice(7)}`), "Docker and OCI layer order drifted");

  const blobs = [...entries.keys()].filter((name) => /^blobs\/sha256\/[0-9a-f]{64}$/.test(name));
  const unreferenced = blobs.filter((name) => !referenced.has(name));
  assert.equal(unreferenced.length, 0, "image archive contains an unreferenced blob");

  return Object.freeze({
    bytes: archiveBytes.length,
    sha256: expected.sha256,
    image: expected.image,
    imageId: expected.imageId,
    configDigest: expected.configDigest,
    sourceDigest: expected.sourceDigest,
    sourceRevision: expected.sourceRevision,
    releaseLabel: expected.releaseLabel,
    user: expected.user,
    os: expected.os,
    architecture: expected.architecture,
    rootDescriptorCount: index.manifests.length,
    manifestCount: targetIndex.manifests.length,
    runnableManifestCount: runnable.length,
    attestationManifestCount: attestations.length,
    layerCount: mainLayers.length,
    blobCount: blobs.length,
    unreferencedBlobCount: unreferenced.length,
    repoTagCount: dockerImage.RepoTags.length
  });
}

if (require.main === module) {
  const [command, archive] = process.argv.slice(2);
  const artifacts = {
    "verify-rollback": rollbackIdentityImageArtifact,
    "verify-old-admin": oldAdminImageArtifact,
    "verify-flarum": flarumImageArtifact
  };
  if (!artifacts[command] || !archive) throw new Error("usage: node workflow-image-archive.cjs verify-rollback|verify-old-admin|verify-flarum ABS_ARCHIVE");
  verifyWorkflowImageArchive({ archive: path.resolve(archive), expected: artifacts[command] });
}

module.exports = {
  flarumImageArtifact,
  identityImageArtifact,
  oldAdminImageArtifact,
  recoveryArchive,
  rollbackIdentityImageArtifact,
  verifyWorkflowImageArchive
};
