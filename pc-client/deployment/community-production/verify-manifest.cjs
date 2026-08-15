"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const workspace = path.resolve(__dirname, "..", "..");
const manifestPath = path.join(__dirname, "manifest.json");
const excluded = "deployment/community-production/manifest.json";

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(absolute) : [absolute];
  });
}

function createManifest() {
  const files = filesIn(__dirname)
    .map((absolute) => {
      const relative = path.relative(workspace, absolute).replaceAll("\\", "/");
      const bytes = fs.readFileSync(absolute);
      return {
        path: relative,
        bytes: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex")
      };
    })
    .filter((entry) => entry.path !== excluded)
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const canonical = files
    .map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`)
    .join("");
  return {
    format: "aihub-deployment-source-manifest-v1",
    root: "pc-client",
    excluded: [excluded],
    digest: {
      algorithm: "sha256",
      encoding: "utf8",
      ordering: "path ascending by UTF-16 code units",
      record: "<path>\\t<bytes>\\t<sha256>\\n",
      sha256: crypto.createHash("sha256").update(canonical, "utf8").digest("hex")
    },
    files
  };
}

function verifyManifest() {
  assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath, "utf8")), createManifest());
  return true;
}

if (require.main === module) {
  if (process.argv[2] === "--write" && process.argv.length === 3) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(createManifest(), null, 2)}\n`, "utf8");
    console.log("community production manifest written");
  } else {
    assert.equal(process.argv.length, 2, "usage: node verify-manifest.cjs [--write]");
    verifyManifest();
    console.log("community production manifest verified");
  }
}

module.exports = { createManifest, verifyManifest };
