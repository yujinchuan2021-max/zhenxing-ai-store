"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  executeWithIdentityContract
} = require("../deployment/community-production/workflow-production-temporary-acceptance.cjs");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const outputRoot = path.join(root, "output");
const CURRENT_IDENTITY_CONTRACT = Object.freeze({
  image: "zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8",
  imageId: "sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01",
  sourceDigest: "d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8"
});

function acceptanceArgumentsFor(evidence) {
  return [
    path.join(deployment, "compose.server.yaml"),
    path.join(deployment, "compose.workflow-production.yaml"),
    evidence
  ];
}

function validateEvidenceDirectory(value) {
  if (typeof value !== "string" || !path.isAbsolute(value)) {
    throw new Error("current Identity A-E evidence path must be absolute");
  }
  const resolved = fs.realpathSync.native(value);
  const canonicalOutput = fs.realpathSync.native(outputRoot);
  const stat = fs.lstatSync(resolved);
  if (
    stat.isSymbolicLink() || !stat.isDirectory() ||
    path.dirname(resolved) !== canonicalOutput ||
    !/^workflow-current-identity-ae-[0-9]{17}-[0-9a-f]{12}$/.test(path.basename(resolved))
  ) {
    throw new Error("current Identity A-E evidence directory is invalid");
  }
  return resolved;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) throw new Error("usage: node workflow-current-identity-temporary-acceptance.cjs <evidence-directory>");
  const evidence = validateEvidenceDirectory(argv[0]);
  process.env.AIHUB_ADMIN_DATA_DIR = fs.realpathSync.native(path.join(root, "admin", "data"));
  process.env.AIHUB_ADMIN_PUBLISHED_DIR = fs.realpathSync.native(path.join(root, "admin", "published"));
  return executeWithIdentityContract(acceptanceArgumentsFor(evidence), CURRENT_IDENTITY_CONTRACT);
}

if (require.main === module) {
  main().catch(() => { process.exitCode = 1; });
}

module.exports = {
  CURRENT_IDENTITY_CONTRACT,
  acceptanceArgumentsFor,
  main,
  validateEvidenceDirectory
};
