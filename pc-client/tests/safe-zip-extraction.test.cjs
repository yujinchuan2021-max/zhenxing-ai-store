"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  inspectExtractedTree,
  validateZipEntries
} = require("../shared/safe-zip-extraction.cjs");

test("accepts a bounded relative ZIP tree and rejects traversal", () => {
  assert.deepEqual(
    validateZipEntries(["zeroclaw.exe", "web/", "web/dist/index.html"], 10),
    ["zeroclaw.exe", "web/", "web/dist/index.html"]
  );
  for (const entries of [
    ["../outside.exe"],
    ["C:/outside.exe"],
    ["/outside.exe"],
    ["same.txt", "SAME.txt"]
  ]) assert.equal(validateZipEntries(entries, 10), null);
});

test("bounds the extracted tree without following links", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-safe-zip-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "web", "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "zeroclaw.exe"), "binary");
  fs.writeFileSync(path.join(root, "web", "dist", "index.html"), "html");
  assert.deepEqual(inspectExtractedTree(root, { maximumEntries: 10, maximumBytes: 100 }), {
    entries: 4,
    bytes: 10
  });
  assert.equal(inspectExtractedTree(root, { maximumEntries: 3, maximumBytes: 100 }), null);
  assert.equal(inspectExtractedTree(root, { maximumEntries: 10, maximumBytes: 9 }), null);
});
