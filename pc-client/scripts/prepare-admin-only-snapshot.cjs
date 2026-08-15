"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const DOCKERFILE = "deployment/admin-only/Dockerfile";
const BASE_IMAGE = "node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd";
const COPY_LINES = [
  "COPY --chown=node:node admin/*.cjs /app/admin/",
  "COPY --chown=node:node admin/public /app/admin/public",
  "COPY --chown=node:node admin/data/catalog-v1.json admin/data/release-settings.json admin/data/vendor-icon-fallbacks.json /app/admin/data/",
  "COPY --chown=node:node admin/data/vendor-icon-sources.json /app/admin/data/",
  "COPY --chown=node:node admin/data/vendor-icons /app/admin/data/vendor-icons",
  "COPY --chown=node:node shared /app/shared",
  "COPY --chown=node:node scripts/discover-official-products.mjs /app/scripts/discover-official-products.mjs",
  "COPY --chown=node:node catalog/channel.json /app/catalog/channel.json",
  "COPY --chown=node:node updates/channel.json /app/updates/channel.json"
];

function posix(value) {
  return value.split(path.sep).join("/");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertRegularFile(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`snapshot source must be a regular file: ${relativePath}`);
  }
}

function recursiveFiles(relativeDirectory) {
  const absoluteDirectory = path.join(ROOT, relativeDirectory);
  const files = [];
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = posix(path.join(relativeDirectory, entry.name));
    if (entry.isDirectory()) files.push(...recursiveFiles(relativePath));
    else if (entry.isFile()) files.push(relativePath);
    else throw new Error(`snapshot source contains unsupported entry: ${relativePath}`);
  }
  return files;
}

function sourceFiles() {
  const adminRoot = path.join(ROOT, "admin");
  const adminModules = fs.readdirSync(adminRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".cjs"))
    .map((entry) => `admin/${entry.name}`);
  return [
    DOCKERFILE,
    ...adminModules,
    ...recursiveFiles("admin/public"),
    "admin/data/catalog-v1.json",
    "admin/data/release-settings.json",
    "admin/data/vendor-icon-fallbacks.json",
    "admin/data/vendor-icon-sources.json",
    ...recursiveFiles("admin/data/vendor-icons"),
    ...recursiveFiles("shared"),
    "scripts/discover-official-products.mjs",
    "catalog/channel.json",
    "updates/channel.json"
  ].sort();
}

function verifyDockerfileContract() {
  const content = fs.readFileSync(path.join(ROOT, DOCKERFILE), "utf8");
  if (!content.startsWith(`FROM ${BASE_IMAGE}\n`)) throw new Error("unexpected admin-only base image");
  const actualCopyLines = content.split(/\r?\n/).filter((line) => line.startsWith("COPY "));
  if (JSON.stringify(actualCopyLines) !== JSON.stringify(COPY_LINES)) {
    throw new Error("admin-only Dockerfile COPY contract changed; update the explicit snapshot list first");
  }
}

function gitReference() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
}

function main() {
  verifyDockerfileContract();
  const files = sourceFiles();
  for (const relativePath of files) assertRegularFile(relativePath);
  const entries = files.map((relativePath) => {
    const bytes = fs.readFileSync(path.join(ROOT, relativePath));
    return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
  });
  const contentDigest = sha256(entries.map((entry) => `${entry.path}\0${entry.bytes}\0${entry.sha256}\n`).join(""));
  const snapshotDirectory = path.join(ROOT, "output", "admin-only-snapshots", contentDigest);
  const manifest = {
    schemaVersion: 1,
    baseImage: BASE_IMAGE,
    gitReference: gitReference(),
    contentDigest,
    files: entries
  };
  if (fs.existsSync(snapshotDirectory)) {
    const existing = JSON.parse(fs.readFileSync(path.join(snapshotDirectory, "source-manifest.json"), "utf8"));
    if (JSON.stringify(existing) !== JSON.stringify(manifest)) throw new Error("existing snapshot digest collision");
  } else {
    for (const entry of entries) {
      const destination = path.join(snapshotDirectory, entry.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(ROOT, entry.path), destination, fs.constants.COPYFILE_EXCL);
    }
    fs.writeFileSync(path.join(snapshotDirectory, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  }
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  const image = `zhenxing-ai/admin:${version}-src-${contentDigest.slice(0, 12)}`;
  process.stdout.write(`${JSON.stringify({ ok: true, snapshotDirectory, manifestPath: path.join(snapshotDirectory, "source-manifest.json"), contentDigest, image }, null, 2)}\n`);
}

main();
