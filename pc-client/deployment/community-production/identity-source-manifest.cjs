"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const dockerfilePath = path.join(__dirname, "identity.Dockerfile");

function filesIn(relative) {
  const absolute = path.join(root, relative);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relative.replaceAll("\\", "/")];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules") return [];
    return filesIn(path.join(relative, entry.name));
  });
}

function dockerfileSources() {
  const source = fs.readFileSync(dockerfilePath, "utf8").replace(/\\\r?\n\s*/g, " ");
  const inputs = new Set([".dockerignore", "deployment/community-production/identity.Dockerfile"]);
  for (const line of source.split(/\r?\n/)) {
    if (!line.startsWith("COPY ")) continue;
    const tokens = line.slice(5).trim().split(/\s+/);
    for (const input of tokens.slice(0, -1)) {
      for (const file of filesIn(input)) inputs.add(file);
    }
  }
  return [...inputs].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function createIdentitySourceManifest() {
  const dockerfile = fs.readFileSync(dockerfilePath, "utf8");
  const baseImage = dockerfile.match(/^FROM (\S+)$/m)?.[1] || "";
  if (!baseImage.includes("@sha256:")) throw new Error("Identity base image is not pinned by digest");
  const files = dockerfileSources().map((relative) => {
    if (/(^|\/)(?:\.env[^/]*|[^/]+\.(?:pem|key))$/i.test(relative)) {
      throw new Error(`Identity source manifest contains a secret-shaped path: ${relative}`);
    }
    const bytes = fs.readFileSync(path.join(root, relative));
    return {
      path: relative,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex")
    };
  });
  const canonical = [`baseImage\t${baseImage}\n`]
    .concat(files.map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`))
    .join("");
  return {
    format: "aihub-identity-source-manifest-v1",
    candidateOnly: true,
    baseImage,
    digest: {
      algorithm: "sha256",
      record: "baseImage\\t<image>\\n then <path>\\t<bytes>\\t<sha256>\\n",
      sha256: crypto.createHash("sha256").update(canonical, "utf8").digest("hex")
    },
    files
  };
}

if (require.main === module) {
  const manifest = createIdentitySourceManifest();
  if (process.argv[2]) {
    fs.mkdirSync(path.dirname(path.resolve(process.argv[2])), { recursive: true });
    fs.writeFileSync(path.resolve(process.argv[2]), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  }
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

module.exports = { createIdentitySourceManifest };
