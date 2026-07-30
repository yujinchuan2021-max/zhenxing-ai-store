const assert = require("node:assert/strict");
const test = require("node:test");

const {
  compareVersions,
  validateUpdateChannel,
  validateUpdateManifest
} = require("../shared/update.cjs");

const isAllowedUrl = (value, allowLocalhost = false) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (allowLocalhost &&
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname))
    );
  } catch {
    return false;
  }
};

test("compares semantic release versions", () => {
  assert.equal(compareVersions("0.1.1", "0.1.0"), 1);
  assert.equal(compareVersions("0.1.0", "0.1.0"), 0);
  assert.equal(compareVersions("0.1.0", "0.2.0"), -1);
});

test("validates a disabled update channel", () => {
  assert.deepEqual(
    validateUpdateChannel(
      {
        schemaVersion: 1,
        manifestUrl: "",
        allowedDownloadOrigins: []
      },
      (url) => isAllowedUrl(url, true)
    ),
    {
      schemaVersion: 1,
      manifestUrl: "",
      allowedDownloadOrigins: []
    }
  );
});

test("requires configured update channels to pin download origins", () => {
  assert.throws(
    () =>
      validateUpdateChannel(
        {
          schemaVersion: 1,
          manifestUrl: "https://updates.aihub.example/update-v1.json",
          allowedDownloadOrigins: []
        },
        isAllowedUrl
      ),
    /更新通道/
  );
});

test("rejects download origins that contain paths or wildcards", () => {
  for (const origin of [
    "https://downloads.aihub.example/releases",
    "https://*.aihub.example"
  ]) {
    assert.throws(
      () =>
        validateUpdateChannel(
          {
            schemaVersion: 1,
            manifestUrl: "https://updates.aihub.example/update-v1.json",
            allowedDownloadOrigins: [origin]
          },
          isAllowedUrl
        ),
      /下载来源/
    );
  }
});

test("accepts a manifest only from a pinned download origin", () => {
  const channel = validateUpdateChannel(
    {
      schemaVersion: 1,
      manifestUrl: "https://updates.aihub.example/update-v1.json",
      allowedDownloadOrigins: ["https://downloads.aihub.example"]
    },
    isAllowedUrl
  );
  const manifest = validateUpdateManifest(
    {
      schemaVersion: 1,
      version: "0.1.1",
      publishedAt: "2026-07-29T00:00:00.000Z",
      downloadUrl:
        "https://downloads.aihub.example/AI-Hub-0.1.1-Windows-x64-Setup.exe",
      notes: ["修复更新通道。"]
    },
    isAllowedUrl,
    channel.allowedDownloadOrigins
  );

  assert.equal(manifest.version, "0.1.1");
});

test("rejects a manifest that redirects users to an unpinned origin", () => {
  assert.throws(
    () =>
      validateUpdateManifest(
        {
          schemaVersion: 1,
          version: "0.1.1",
          publishedAt: "2026-07-29T00:00:00.000Z",
          downloadUrl:
            "https://attacker.example/AI-Hub-0.1.1-Windows-x64-Setup.exe",
          notes: ["伪造更新。"]
        },
        isAllowedUrl,
        ["https://downloads.aihub.example"]
      ),
    /下载来源/
  );
});
