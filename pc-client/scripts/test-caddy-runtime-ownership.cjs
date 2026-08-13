"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const image = "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d";
const suffix = crypto.randomBytes(6).toString("hex");
const prefix = `aihub-caddy-ownership-${suffix}`;
const container = `${prefix}-caddy`;
const volumes = [`${prefix}-data`, `${prefix}-config`, `${prefix}-secret`];
const fixtureSecret = `fixture-${"a".repeat(56)}`;

function docker(args, { input, allowFailure = false } = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", input });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`docker ${args[0]} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

function removeContainer() {
  docker(["rm", "-f", container], { allowFailure: true });
}

function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const state = docker(["inspect", "--format", "{{json .State}}", container], { allowFailure: true });
    if (state.status !== 0) break;
    const parsed = JSON.parse(state.stdout);
    if (parsed.Status !== "running") break;
    const successful = (parsed.Health?.Log || []).filter((entry) => entry.ExitCode === 0);
    if (parsed.Health?.Status === "healthy" && successful.length >= 3) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  const logs = docker(["logs", container], { allowFailure: true });
  throw new Error(`Caddy did not become healthy: ${logs.stderr || logs.stdout}`);
}

function startCycle(cycle) {
  removeContainer();
  docker([
    "run", "-d", "--name", container,
    "--user", "0:0",
    "--cap-drop", "ALL",
    "--cap-add", "CHOWN",
    "--cap-add", "SETGID",
    "--cap-add", "SETUID",
    "--cap-add", "NET_BIND_SERVICE",
    "--security-opt", "no-new-privileges:true",
    "--read-only", "--tmpfs", "/tmp",
    "--health-cmd", "wget -q -O /dev/null http://127.0.0.1:2015/health",
    "--health-interval", "1s",
    "--health-timeout", "3s",
    "--health-retries", "3",
    "-e", "AIHUB_PUBLIC_HOST=workflow.invalid",
    "-e", "AIHUB_COMMUNITY_PUBLIC_HOST=community.workflow.invalid",
    "--mount", `type=volume,src=${volumes[0]},dst=/data`,
    "--mount", `type=volume,src=${volumes[1]},dst=/config`,
    "--mount", `type=volume,src=${volumes[2]},dst=/run/aihub-caddy-secret,readonly`,
    "--mount", `type=bind,src=${path.join(root, "deployment", "community-production", "Caddyfile")},dst=/etc/caddy/Caddyfile,readonly`,
    "--mount", `type=bind,src=${path.join(root, "deployment", "community-production", "caddy-entrypoint.sh")},dst=/usr/local/bin/aihub-caddy-entrypoint,readonly`,
    "--entrypoint", "/bin/sh", image, "/usr/local/bin/aihub-caddy-entrypoint"
  ]);
  waitForHealth();
  const status = docker(["exec", container, "sh", "-c", "cat /proc/1/status"]);
  assert.match(status.stdout, /^Uid:\s+65534\s+65534\s+65534\s+65534$/m, `cycle ${cycle} UID`);
  assert.match(status.stdout, /^Gid:\s+65534\s+65534\s+65534\s+65534$/m, `cycle ${cycle} GID`);
  assert.match(status.stdout, /^CapEff:\s+0+$/m, `cycle ${cycle} capabilities`);
  assert.equal(
    docker(["exec", "--user", "0:0", container, "stat", "-c", "%u:%g:%a", "/run/aihub-caddy-secret/community_cms_gateway"]).stdout.trim(),
    "0:0:400"
  );
  assert.equal(
    docker(["exec", "--user", "65534:65534", container, "sh", "-c", "test ! -r /run/aihub-caddy-secret/community_cms_gateway"]).status,
    0
  );
  docker(["exec", "--user", "65534:65534", container, "sh", "-c", "touch /data/caddy/.aihub-write-test && rm /data/caddy/.aihub-write-test"]);
  const logs = docker(["logs", container], { allowFailure: true });
  assert.equal(`${logs.stdout}${logs.stderr}`.includes(fixtureSecret), false);
  docker(["stop", "-t", "2", container]);
}

try {
  for (const volume of volumes) docker(["volume", "create", volume]);
  docker([
    "run", "--rm", "-i",
    "--mount", `type=volume,src=${volumes[2]},dst=/seed`,
    "--entrypoint", "sh", image,
    "-c", "umask 077; cat > /seed/.tmp; chown 0:0 /seed/.tmp; chmod 0400 /seed/.tmp; mv /seed/.tmp /seed/community_cms_gateway"
  ], { input: fixtureSecret });
  for (let cycle = 1; cycle <= 3; cycle += 1) startCycle(cycle);
  process.stdout.write("Caddy named-volume ownership restart gate PASS (3/3)\n");
} finally {
  removeContainer();
  for (const volume of volumes) docker(["volume", "rm", volume], { allowFailure: true });
}
