const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  planUpdateInstallerDownload,
  updateInstallerFileName,
  verifyUpdateInstallerDownload
} = require("../shared/update-installer.cjs");

const digest = "a".repeat(64);
const offer = {
  version: "0.1.1",
  downloadUrl:
    "https://updates.aihub.example/AI-Hub-0.1.1-Windows-x64-Setup.exe",
  sha256: digest,
  fileSize: 123
};
const channel = {
  allowedReleaseOrigins: ["https://updates.aihub.example"]
};

test("creates a fixed update installer name from a semantic version", () => {
  assert.equal(
    updateInstallerFileName("0.1.1"),
    "AI-Hub-0.1.1-Windows-x64-Setup.exe"
  );
  assert.throws(() => updateInstallerFileName("../escape"), /版本号/);
});

test("pins an update installer download to the signed channel origin", () => {
  const root = path.resolve("C:\\AIHub\\updates");
  const plan = planUpdateInstallerDownload(offer, channel, root);
  assert.equal(plan.target, path.join(root, updateInstallerFileName("0.1.1")));
  assert.deepEqual(plan.allowedFinalOrigins, [
    "https://updates.aihub.example"
  ]);
  assert.equal(plan.expectedSha256, digest);
});

test("rejects update installers from an unpinned origin", () => {
  assert.throws(
    () =>
      planUpdateInstallerDownload(
        { ...offer, downloadUrl: "https://attacker.example/setup.exe" },
        channel,
        path.resolve("C:\\AIHub\\updates")
      ),
    /来源/
  );
});

test("does not broaden a pinned update origin to another port", () => {
  assert.throws(
    () =>
      planUpdateInstallerDownload(
        {
          ...offer,
          downloadUrl:
            "https://updates.aihub.example:4444/AI-Hub-0.1.1-Windows-x64-Setup.exe"
        },
        channel,
        path.resolve("C:\\AIHub\\updates")
      ),
    /来源/
  );
});

test("requires both hash and file size before an update can launch", () => {
  const plan = planUpdateInstallerDownload(
    offer,
    channel,
    path.resolve("C:\\AIHub\\updates")
  );
  const valid = {
    filePath: plan.target,
    sha256: digest,
    fileSize: 123
  };
  assert.deepEqual(verifyUpdateInstallerDownload(valid, plan), valid);
  assert.throws(
    () => verifyUpdateInstallerDownload({ ...valid, sha256: "b".repeat(64) }, plan),
    /完整性/
  );
  assert.throws(
    () => verifyUpdateInstallerDownload({ ...valid, fileSize: 122 }, plan),
    /完整性/
  );
});
