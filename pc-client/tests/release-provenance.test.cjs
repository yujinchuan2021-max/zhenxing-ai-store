"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  artifactBuildMetadataPath,
  createArtifactBuildMetadata,
  inspectGitReleaseSource,
  normalizeReleaseSource,
  verifyArtifactBuildMetadata
} = require("../shared/release-provenance.cjs");

const cleanSource = {
  revision: "a".repeat(40),
  dirty: false,
  versionTag: "v0.1.21"
};

test("binds an installer to its exact version, bytes and source revision", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-provenance-"));
  try {
    const installer = path.join(
      root,
      "AI-Hub-Local-0.1.21-Windows-x64-Setup.exe"
    );
    fs.writeFileSync(installer, "installer");
    const metadata = createArtifactBuildMetadata({
      version: "0.1.21",
      source: cleanSource,
      artifactPaths: [installer],
      builtAt: "2026-08-01T00:00:00.000Z"
    });
    assert.equal(
      artifactBuildMetadataPath(installer),
      path.join(root, "AI-Hub-Local-0.1.21-BUILD.json")
    );
    assert.deepEqual(
      verifyArtifactBuildMetadata({
        metadata,
        artifactPath: installer,
        version: "0.1.21"
      }).source,
      cleanSource
    );
    fs.appendFileSync(installer, "tampered");
    assert.throws(
      () =>
        verifyArtifactBuildMetadata({
          metadata,
          artifactPath: installer,
          version: "0.1.21"
        }),
      /不一致/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("allows local untagged sources but rejects a tag for another version", () => {
  assert.throws(
    () =>
      normalizeReleaseSource(
        { revision: "b".repeat(40), dirty: false, versionTag: "v0.1.20" },
        "0.1.21"
      ),
    /来源/
  );
  assert.deepEqual(
    normalizeReleaseSource(
      { revision: "b".repeat(40), dirty: false, versionTag: null },
      "0.1.21"
    ),
    { revision: "b".repeat(40), dirty: false, versionTag: null }
  );
});

test("production source inspection requires a clean exact version tag", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-source-git-"));
  function git(...args) {
    const result = spawnSync("git", args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      shell: false
    });
    if (result.status !== 0) throw new Error(result.stderr || "git failed");
  }
  try {
    git("init", "--quiet");
    git("config", "user.email", "release-test@aihub.local");
    git("config", "user.name", "AI Hub Release Test");
    fs.writeFileSync(path.join(root, "source.txt"), "release source\n", "utf8");
    git("add", "source.txt");
    git("commit", "--quiet", "-m", "release source");
    assert.throws(
      () =>
        inspectGitReleaseSource({
          root,
          version: "0.1.21",
          requireClean: true,
          requireVersionTag: true
        }),
      /v0\.1\.21/
    );
    git("tag", "v0.1.21");
    const source = inspectGitReleaseSource({
      root,
      version: "0.1.21",
      requireClean: true,
      requireVersionTag: true
    });
    assert.equal(source.dirty, false);
    assert.equal(source.versionTag, "v0.1.21");
    fs.appendFileSync(path.join(root, "source.txt"), "dirty\n", "utf8");
    assert.throws(
      () =>
        inspectGitReleaseSource({
          root,
          version: "0.1.21",
          requireClean: true,
          requireVersionTag: true
        }),
      /未提交/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
