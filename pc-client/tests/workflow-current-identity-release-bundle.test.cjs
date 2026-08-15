"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const current = Object.freeze({
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

test("production bundle binds the fully verified current Identity image", () => {
  const archive = require(path.join(deployment, "workflow-image-archive.cjs"));
  const bundle = require(path.join(deployment, "workflow-production-release-bundle.cjs"));
  assert.deepEqual(archive.identityImageArtifact, current);
  assert.deepEqual(bundle.identityImageArtifact, current);

  const manifest = bundle.createWorkflowProductionReleaseBundleManifest();
  assert.equal(manifest.candidateOnly, true);
  assert.equal(manifest.publishable, false);
  assert.equal(manifest.identity.sourceDigest, current.sourceDigest);
  assert.deepEqual(manifest.identityImage, {
    path: current.path,
    image: current.image,
    imageId: current.imageId,
    sourceDigest: current.sourceDigest,
    user: current.user,
    bytes: current.bytes,
    sha256: current.sha256
  });
  assert.deepEqual(manifest.files.find((entry) => entry.path === current.path), {
    path: current.path,
    bytes: current.bytes,
    sha256: current.sha256,
    mode: "0644"
  });
  assert.deepEqual(
    archive.verifyWorkflowImageArchive({ archive: path.join(root, current.source), expected: current }),
    {
      bytes: current.bytes,
      sha256: current.sha256,
      image: current.image,
      imageId: current.imageId,
      configDigest: current.configDigest,
      sourceDigest: current.sourceDigest,
      sourceRevision: current.sourceRevision,
      releaseLabel: current.releaseLabel,
      user: current.user,
      os: current.os,
      architecture: current.architecture,
      rootDescriptorCount: 1,
      manifestCount: 2,
      runnableManifestCount: 1,
      attestationManifestCount: 1,
      layerCount: 16,
      blobCount: 22,
      unreferencedBlobCount: 0,
      repoTagCount: 1
    }
  );
});

test("every active production consumer uses the current Identity generation", () => {
  const files = [
    "compose.server.yaml",
    "compose.workflow-production.yaml",
    "workflow-official-bootstrap-production-wrapper.cjs",
    "workflow-official-bootstrap-temporary-acceptance.cjs",
    "workflow-production-cutover.sh",
    "workflow-production-fresh-host-runner.sh",
    "workflow-production-r12-executor.sh",
    "workflow-production-temporary-acceptance.cjs"
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(deployment, file), "utf8");
    assert.match(source, new RegExp(current.image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), file);
    assert.doesNotMatch(source, /workflow-readiness-candidate-2a1147346c5e/, file);
  }
});
