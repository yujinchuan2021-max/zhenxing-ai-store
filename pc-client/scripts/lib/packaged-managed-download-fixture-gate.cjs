"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const script = path.join(root, "scripts", "test-managed-download-queue-layout.cjs");
const prefix = "aihub-managed-download-queue-";
const contractFiles = Object.freeze([
  "scripts/lib/packaged-managed-download-fixture-gate.cjs",
  "scripts/test-managed-download-queue-layout.cjs",
  "scripts/fixtures/managed-download-queue-preview-runner.cjs",
  "scripts/fixtures/installed-management-preview-preload.cjs"
]);

function deterministicFixtureContractSha256({ readFile = fs.readFileSync } = {}) {
  const hash = crypto.createHash("sha256");
  for (const relative of contractFiles) {
    const bytes = readFile(path.join(root, ...relative.split("/")));
    hash.update(relative, "utf8");
    hash.update("\0", "utf8");
    hash.update(bytes);
    hash.update("\0", "utf8");
  }
  return hash.digest("hex");
}

function runPackagedManagedDownloadFixtureGate({
  spawn = spawnSync,
  temporaryEntries = () => fs.readdirSync(os.tmpdir())
} = {}) {
  let failureClass = null;
  try {
    if (temporaryEntries().some((entry) => entry.startsWith(prefix))) failureClass = "pre-residue";
  } catch {
    failureClass = "pre-residue";
  }
  if (!failureClass) {
    try {
      const result = spawn(process.execPath, [script], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, AIHUB_MANAGED_DOWNLOAD_QUEUE_NO_OUTPUT: "1" },
        shell: false,
        timeout: 120_000,
        windowsHide: true
      });
      if (result.error?.code === "ETIMEDOUT") failureClass = "timeout";
      else if (result.error) failureClass = "spawn-error";
      else if (result.signal !== null) failureClass = "signal";
      else if (!Number.isInteger(result.status)) failureClass = "spawn-error";
      else if (result.status !== 0) failureClass = "nonzero";
      else if (result.stdout !== "") failureClass = "stdout";
      else if (result.stderr !== "") failureClass = "stderr";
    } catch {
      failureClass = "spawn-error";
    }
  }
  let postResidue;
  try {
    postResidue = temporaryEntries().some((entry) => entry.startsWith(prefix));
  } catch {
    postResidue = true;
  }
  if (!failureClass && postResidue) failureClass = "post-residue";
  if (failureClass) {
    const error = new Error("DETERMINISTIC_RENDERER_FIXTURE_FAILED");
    error.failureClass = failureClass;
    throw error;
  }
  return { ok: true };
}

module.exports = { deterministicFixtureContractSha256, runPackagedManagedDownloadFixtureGate };
