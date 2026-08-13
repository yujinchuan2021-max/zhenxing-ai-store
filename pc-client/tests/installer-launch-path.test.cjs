"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  prepareInstallerLaunchArtifact
} = require("../shared/installer-launch-path.cjs");

const hashFile = async (filePath) =>
  crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

test("stages and reverifies an installer downloaded under a non-ASCII path", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-launch-path-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceDirectory = path.join(root, "文件");
  const stagingRoot = path.join(root, "staged");
  fs.mkdirSync(sourceDirectory);
  const sourcePath = path.join(sourceDirectory, "Setup.exe");
  fs.writeFileSync(sourcePath, "signed installer fixture");
  const expectedSha256 = await hashFile(sourcePath);
  const verified = [];

  const result = await prepareInstallerLaunchArtifact({
    sourcePath,
    stagingRoot,
    stagedFileName: "approved-product-Setup.exe",
    expectedSha256,
    hashFile,
    verifySignature: async (filePath) => {
      verified.push(filePath);
      return true;
    }
  });

  assert.equal(result.staged, true);
  assert.equal(result.filePath, path.join(fs.realpathSync(stagingRoot), "approved-product-Setup.exe"));
  assert.equal(await hashFile(result.filePath), expectedSha256);
  assert.deepEqual(verified, [result.filePath]);
});

test("keeps an ASCII installer at its original verified path", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-launch-path-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "Setup.exe");
  fs.writeFileSync(sourcePath, "signed installer fixture");

  const result = await prepareInstallerLaunchArtifact({
    sourcePath,
    stagingRoot: path.join(root, "staged"),
    stagedFileName: "approved-product-Setup.exe",
    expectedSha256: await hashFile(sourcePath),
    hashFile,
    verifySignature: async () => true
  });

  assert.deepEqual(result, {
    filePath: path.resolve(sourcePath),
    staged: false
  });
  assert.equal(fs.existsSync(path.join(root, "staged")), false);
});
