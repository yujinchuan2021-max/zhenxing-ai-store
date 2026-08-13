"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  flarumImageArtifact,
  oldAdminImageArtifact,
  verifyWorkflowImageArchive
} = require("../deployment/community-production/workflow-image-archive.cjs");

const root = path.resolve(__dirname, "..");
const archive = path.join(
  root,
  "output",
  "protected-production-image-exports",
  "identity-19a-production-readonly-20260810T035233",
  "zhenxing-ai-identity-19a-production-readonly.tar.partial"
);

const expected = Object.freeze({
  bytes: 58_887_168,
  sha256: "9205edae43228dd7afb66bf179ff321c032f2d8e47e71f61d65fc4165b56e904",
  image: "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392",
  imageId: "sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567",
  configDigest: "sha256:341b0551662a03e16672d6171e1f297fe9f61a015a1aec19d04008bd82b22e5c",
  sourceDigest: "19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c",
  releaseLabel: "workflow-reviewer-service-identity-candidate-2026-08-08",
  user: "node",
  os: "linux",
  architecture: "amd64"
});

test("protected 19a archive closes the exact OCI descriptor, config, and layer graph", () => {
  const result = verifyWorkflowImageArchive({ archive, expected });

  assert.deepEqual(result, {
    bytes: expected.bytes,
    sha256: expected.sha256,
    image: expected.image,
    imageId: expected.imageId,
    configDigest: expected.configDigest,
    sourceDigest: expected.sourceDigest,
    releaseLabel: expected.releaseLabel,
    user: expected.user,
    os: expected.os,
    architecture: expected.architecture,
    rootDescriptorCount: 1,
    manifestCount: 2,
    runnableManifestCount: 1,
    attestationManifestCount: 1,
    layerCount: 16,
    blobCount: 22,
    unreferencedBlobCount: 0,
    repoTagCount: 1
  });
});

test("protected old Admin and Flarum archives close only their exact recovered images", () => {
  const contracts = [
    [oldAdminImageArtifact, { layers: 15, blobs: 21, user: "node" }],
    [flarumImageArtifact, { layers: 27, blobs: 32, user: "" }]
  ];
  for (const [artifact, counts] of contracts) {
    const result = verifyWorkflowImageArchive({ archive: path.join(root, artifact.source), expected: artifact });
    assert.equal(result.image, artifact.image);
    assert.equal(result.imageId, artifact.imageId);
    assert.equal(result.user, counts.user);
    assert.equal(result.layerCount, counts.layers);
    assert.equal(result.blobCount, counts.blobs);
    assert.equal(result.rootDescriptorCount, 1);
    assert.equal(result.runnableManifestCount, 1);
    assert.equal(result.attestationManifestCount, 1);
    assert.equal(result.unreferencedBlobCount, 0);
    assert.equal(result.repoTagCount, 1);
  }
});

function entryContentOffset(buffer, wanted) {
  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
    const size = Number.parseInt(header.subarray(124, 136).toString("ascii").replace(/\0.*$/s, "").trim(), 8);
    if (name === wanted) return offset + 512;
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`fixture entry not found: ${wanted}`);
}

test("19a archive rejects every frozen supply-chain drift before use", () => {
  assert.throws(() => verifyWorkflowImageArchive({ archive: `${archive}.missing`, expected }), /ENOENT/);
  assert.throws(() => verifyWorkflowImageArchive({ archive, expected: { ...expected, bytes: expected.bytes + 1 } }), /size drifted/);
  assert.throws(() => verifyWorkflowImageArchive({ archive, expected: { ...expected, sha256: "0".repeat(64) } }), /digest drifted/);
  assert.throws(() => verifyWorkflowImageArchive({ archive, expected: { ...expected, image: `wrong/${expected.image}` } }), /name drifted|tag drifted/);
  assert.throws(() => verifyWorkflowImageArchive({ archive, expected: { ...expected, sourceDigest: "0".repeat(64) } }), /source digest label drifted/);
  assert.throws(() => verifyWorkflowImageArchive({ archive, expected: { ...expected, releaseLabel: "wrong-release" } }), /release label drifted/);
  assert.throws(() => verifyWorkflowImageArchive({ archive, expected: { ...expected, user: "root" } }), /image user drifted/);

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-image-archive-"));
  try {
    const original = fs.readFileSync(archive);
    for (const [name, entry] of [
      ["index", "index.json"],
      ["manifest", "blobs/sha256/8b31aeabaf35f0d21b65d9ea9a9fc554d4f5ceb72a39b1bde42328a578c54ef8"],
      ["config", "blobs/sha256/341b0551662a03e16672d6171e1f297fe9f61a015a1aec19d04008bd82b22e5c"],
      ["layer", "blobs/sha256/55afa1ecc21d2bb5e5045f32dafee56272ffd89860bac26f6c32123439af26a4"]
    ]) {
      const changed = Buffer.from(original);
      const offset = entryContentOffset(changed, entry);
      changed[offset] ^= 1;
      const filename = path.join(temporary, `${name}.tar`);
      fs.writeFileSync(filename, changed);
      const changedExpected = { ...expected, sha256: crypto.createHash("sha256").update(changed).digest("hex") };
      assert.throws(() => verifyWorkflowImageArchive({ archive: filename, expected: changedExpected }), /invalid|drifted/);
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
