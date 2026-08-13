"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  formatLocalReleaseChecksums,
  supersededLocalReleaseArtifacts
} = require("../shared/local-release-artifacts.cjs");

test("keeps only current local release artifacts without touching unrelated files", () => {
  assert.deepEqual(
    supersededLocalReleaseArtifacts(
      [
        "ZhenXing-AI-Local-0.1.20-SHA256.txt",
        "ZhenXing-AI-Local-0.1.20-BUILD.json",
        "ZhenXing-AI-Local-0.1.20-Windows-x64-Portable.exe",
        "ZhenXing-AI-Local-0.1.20-Windows-x64-Setup.exe",
        "ZhenXing-AI-Local-0.1.20-Windows-x64-Setup.exe.blockmap",
        "ZhenXing-AI-Local-0.1.21-SHA256.txt",
        "ZhenXing-AI-Local-0.1.21-BUILD.json",
        "ZhenXing-AI-Local-0.1.21-Windows-x64-Portable.exe",
        "ZhenXing-AI-Local-0.1.21-Windows-x64-Setup.exe",
        "ZhenXing-AI-Local-0.1.21-Windows-x64-Setup.exe.blockmap",
        "builder-debug.yml",
        "notes.txt",
        "..\\escape.exe"
      ],
      "0.1.21"
    ),
    [
      "ZhenXing-AI-Local-0.1.20-SHA256.txt",
      "ZhenXing-AI-Local-0.1.20-BUILD.json",
      "ZhenXing-AI-Local-0.1.20-Windows-x64-Portable.exe",
      "ZhenXing-AI-Local-0.1.20-Windows-x64-Setup.exe",
      "ZhenXing-AI-Local-0.1.20-Windows-x64-Setup.exe.blockmap"
    ]
  );
});

test("formats one deterministic checksum file for packages and build metadata", () => {
  assert.equal(
    formatLocalReleaseChecksums([
      { name: "ZhenXing-AI-Local-0.1.21-Windows-x64-Setup.exe", sha256: "a".repeat(64) },
      { name: "ZhenXing-AI-Local-0.1.21-Windows-x64-Portable.exe", sha256: "b".repeat(64) }
    ]),
    `${"A".repeat(64)}  ZhenXing-AI-Local-0.1.21-Windows-x64-Setup.exe\n` +
      `${"B".repeat(64)}  ZhenXing-AI-Local-0.1.21-Windows-x64-Portable.exe\n`
  );
});
