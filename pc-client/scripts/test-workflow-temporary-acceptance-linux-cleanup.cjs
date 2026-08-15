"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  CADDY_IMAGE,
  PRIVATE_FIXTURE_OWNERSHIP_SCRIPT
} = require("../deployment/community-production/workflow-production-temporary-acceptance.cjs");

const suffix = crypto.randomBytes(6).toString("hex");
const prefix = `workflow-cleanup-${suffix}`;
const root = path.resolve(__dirname, "..");
const mainVolume = `${prefix}-private`;
const reportVolume = `${prefix}-report`;
const outsideVolume = `${prefix}-outside`;
const nestedVolume = `${prefix}-nested`;
const sleeper = `${prefix}-active`;
const volumes = [mainVolume, reportVolume, outsideVolume, nestedVolume];

function docker(args, options = {}) {
  return String(execFileSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    ...options
  }) || "");
}

function helper(extraMounts = []) {
  return spawnSync("docker", [
    "run", "--rm", "--network", "none", "--user", "0:0", "--read-only",
    "--cap-drop", "ALL", "--cap-add", "CHOWN", "--cap-add", "DAC_READ_SEARCH", "--security-opt", "no-new-privileges:true",
    "--mount", `type=volume,src=${mainVolume},dst=/cleanup-root`, ...extraMounts,
    "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=1m", "--entrypoint", "/bin/sh", CADDY_IMAGE,
    "-ec", PRIVATE_FIXTURE_OWNERSHIP_SCRIPT, "cleanup", "1000", "1000"
  ], { encoding: "utf8", windowsHide: true });
}

function seed(script, mounts = []) {
  docker([
    "run", "--rm", "--network", "none", "--user", "0:0",
    "--mount", `type=volume,src=${mainVolume},dst=/cleanup-root`, ...mounts,
    "--entrypoint", "/bin/sh", CADDY_IMAGE, "-ec", script
  ]);
}

function emptyMainVolume() {
  seed("find /cleanup-root -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +");
}

let result;
try {
  for (const volume of volumes) docker(["volume", "create", volume]);

  seed("mkdir -p /cleanup-root/community-db/mysql /cleanup-root/community-storage; printf root > /cleanup-root/community-db/mysql/ibdata1; chmod 700 /cleanup-root/community-db/mysql; chown -R 0:0 /cleanup-root");
  docker(["run", "--rm", "--network", "none", "--user", "0:0", "--mount", `type=volume,src=${reportVolume},dst=/evidence`, "--entrypoint", "/bin/sh", CADDY_IMAGE, "-ec", "chown 1000:1000 /evidence; chmod 700 /evidence"]);
  let attempt = helper();
  assert.equal(attempt.status, 0, `root ownership helper must accept the exact root-owned private fixture: ${attempt.stderr || "no stderr"}`);
  docker([
    "run", "--rm", "--network", "none", "--user", "1000:1000", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges:true", "--mount", `type=volume,src=${mainVolume},dst=/cleanup-root`,
    "--mount", `type=volume,src=${reportVolume},dst=/evidence`, "--entrypoint", "/bin/sh", CADDY_IMAGE,
    "-ec", "rm -rf /cleanup-root/community-db /cleanup-root/community-storage; test -z \"$(ls -A /cleanup-root)\"; printf '{\"status\":\"pass\",\"cleanup\":true}\\n' > /evidence/report.json; sync"
  ]);
  assert.equal(docker(["run", "--rm", "--network", "none", "--mount", `type=volume,src=${reportVolume},dst=/evidence,readonly`, "--entrypoint", "/bin/sh", CADDY_IMAGE, "-ec", "cat /evidence/report.json"]).trim(), '{"status":"pass","cleanup":true}');

  seed("mkdir -p /cleanup-root/community-db; ln -s /etc /cleanup-root/community-db/outside");
  attempt = helper();
  assert.notEqual(attempt.status, 0, "symlink injection must fail closed");
  emptyMainVolume();

  seed("mkdir -p /cleanup-root/community-db/nested");
  attempt = helper(["--mount", `type=volume,src=${nestedVolume},dst=/cleanup-root/community-db/nested`]);
  assert.notEqual(attempt.status, 0, "a nested mount must fail closed");
  emptyMainVolume();

  docker(["run", "--rm", "--network", "none", "--mount", `type=volume,src=${outsideVolume},dst=/outside`, "--entrypoint", "/bin/sh", CADDY_IMAGE, "-ec", "printf sentinel > /outside/sentinel"]);
  seed("mkdir -p /cleanup-root/community-db; printf root > /cleanup-root/community-db/owned");
  attempt = helper();
  assert.equal(attempt.status, 0);
  assert.equal(docker(["run", "--rm", "--network", "none", "--mount", `type=volume,src=${outsideVolume},dst=/outside,readonly`, "--entrypoint", "/bin/sh", CADDY_IMAGE, "-ec", "cat /outside/sentinel"]).trim(), "sentinel");

  docker(["run", "-d", "--name", sleeper, "--network", "none", "--mount", `type=volume,src=${mainVolume},dst=/fixture`, "--entrypoint", "/bin/sh", CADDY_IMAGE, "-ec", "while :; do sleep 30; done"]);
  const active = JSON.parse(docker(["container", "inspect", sleeper]))[0];
  assert.equal(active.Mounts.some((mount) => mount.Name === mainVolume), true, "active-container reference injection must be observable before cleanup");
  docker(["rm", "-f", sleeper]);

  result = {
    ok: true,
    rootOwnedCleanup: true,
    reportFlushed: true,
    symlinkRejected: true,
    nestedMountRejected: true,
    outsideVolumePreserved: true,
    activeReferenceObserved: true
  };
} finally {
  try { docker(["rm", "-f", sleeper], { stdio: "ignore" }); } catch {}
  for (const volume of volumes) {
    try { docker(["volume", "rm", "-f", volume], { stdio: "ignore" }); } catch {}
  }
}

const encoded = `${JSON.stringify(result, null, 2)}\n`;
const reportDirectory = path.join(root, "output", `workflow-temporary-acceptance-linux-cleanup-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${suffix}`);
fs.mkdirSync(reportDirectory, { recursive: false, mode: 0o700 });
const reportPath = path.join(reportDirectory, "report.json");
fs.writeFileSync(reportPath, encoded, { encoding: "utf8", mode: 0o600 });
process.stdout.write(`${JSON.stringify({ ok: true, reportPath, reportSha256: crypto.createHash("sha256").update(encoded).digest("hex") })}\n`);
