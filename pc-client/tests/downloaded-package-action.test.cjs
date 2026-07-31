"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  runDownloadedPackageAction
} = require("../shared/downloaded-package-action.cjs");

test("a missing local installer is downloaded again instead of launched", async () => {
  const calls = [];
  const result = await runDownloadedPackageAction({
    productId: "claude-desktop",
    getDownloadRecord: async (productId) => {
      calls.push(`check:${productId}`);
      return null;
    },
    install: async () => {
      calls.push("install");
      return "installed";
    },
    download: async () => {
      calls.push("download");
      return "downloaded";
    }
  });

  assert.equal(result, "downloaded");
  assert.deepEqual(calls, ["check:claude-desktop", "download"]);
});

test("a trusted local installer is passed to the install action", async () => {
  const record = {
    productId: "claude-desktop",
    filePath: "D:\\AI Hub\\Claude-Setup-x64.exe",
    sha256: "a".repeat(64),
    fileSize: 42
  };
  const calls = [];
  await runDownloadedPackageAction({
    productId: record.productId,
    getDownloadRecord: async () => record,
    install: async (resolved) => {
      calls.push(resolved.filePath);
    },
    download: async () => {
      calls.push("download");
    }
  });

  assert.deepEqual(calls, [record.filePath]);
});
