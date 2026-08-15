"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const hostSeed = path.join(deployment, "seed-caddy-secret-volume.sh");
const innerSeed = path.join(deployment, "caddy-secret-seed.sh");
const linuxImage = "mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4";

function docker(args, { allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`docker ${args[0]} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result;
}

function fixtureName(suffix) {
  return `aihub-source-owner-${process.pid}-${Date.now()}-${suffix}`.toLowerCase();
}

function runCase({ setup, sudoUid, sudoGid, extraEnv = [], extraArgs = [] }) {
  const volume = fixtureName(Math.random().toString(16).slice(2));
  docker(["volume", "create", volume]);
  try {
    const environment = ["-e", "PATH=/fixture/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"];
    if (sudoUid !== undefined) environment.push("-e", `SUDO_UID=${sudoUid}`);
    if (sudoGid !== undefined) environment.push("-e", `SUDO_GID=${sudoGid}`);
    for (const value of extraEnv) environment.push("-e", value);
    const command = `
set -eu
mkdir -p /fixture/bin
mkdir -p /fixture/scripts
cp /scripts/seed-caddy-secret-volume.sh /fixture/scripts/seed-caddy-secret-volume.sh
cp /scripts/caddy-secret-seed.sh /fixture/scripts/caddy-secret-seed.sh
chmod 644 /fixture/scripts/seed-caddy-secret-volume.sh /fixture/scripts/caddy-secret-seed.sh
trap '[ ! -e /fixture/docker-calls ] || echo DOCKER_CALLED >&2' EXIT
cat > /fixture/bin/docker <<'EOF'
#!/bin/sh
printf '%s\\n' "$*" >> /fixture/docker-calls
case " $* " in *' -i '*) cat >/dev/null;; esac
exit 0
EOF
chmod 755 /fixture/bin/docker
${setup}
/bin/bash /fixture/scripts/seed-caddy-secret-volume.sh test-volume /fixture/source ${extraArgs.join(" ")}
`;
    return docker([
      "run", "--rm", "--user", "0:0", ...environment,
      "-v", `${volume}:/fixture`,
      "-v", `${hostSeed}:/scripts/seed-caddy-secret-volume.sh:ro`,
      "-v", `${innerSeed}:/scripts/caddy-secret-seed.sh:ro`,
      linuxImage, "/bin/bash", "-ec", command
    ], { allowFailure: true });
  } finally {
    docker(["volume", "rm", volume], { allowFailure: true });
  }
}

test("host seed accepts only the sudo caller-owned 0600 source and does not need an executable bit", () => {
  const secret = "caller-owned-secret-0123456789abcdef";
  const result = runCase({
    sudoUid: 1000,
    sudoGid: 1000,
    setup: `printf '%s' '${secret}' > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source`
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(secret));
});

test("direct root accepts only a root-owned 0600 source", () => {
  const result = runCase({
    setup: "printf '%s' 'root-owned-secret-0123456789abcdef' > /fixture/source; chown 0:0 /fixture/source; chmod 600 /fixture/source"
  });
  assert.equal(result.status, 0, result.stderr);
});

test("host seed itself refuses a non-root effective UID", () => {
  const volume = fixtureName("nonroot");
  docker(["volume", "create", volume]);
  try {
    docker([
      "run", "--rm", "--user", "0:0", "-v", `${volume}:/fixture`, linuxImage,
      "/bin/bash", "-ec",
      "printf '%s' 'caller-owned-secret-0123456789abcdef' > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source"
    ]);
    const result = docker([
      "run", "--rm", "--user", "1000:1000", "-e", "SUDO_UID=1000", "-e", "SUDO_GID=1000",
      "-v", `${volume}:/fixture`, "-v", `${hostSeed}:/scripts/seed.sh:ro`,
      linuxImage, "/bin/bash", "/scripts/seed.sh", "test-volume", "/fixture/source"
    ], { allowFailure: true });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must run as root/);
  } finally {
    docker(["volume", "rm", volume], { allowFailure: true });
  }
});

test("host seed rejects unsafe source metadata and content before invoking Docker", async (t) => {
  const cases = [
    ["group-readable mode", "printf '%s' 'safe-length-secret-0123456789abcdef' > /fixture/source; chown 1000:1000 /fixture/source; chmod 640 /fixture/source"],
    ["symlink", "printf '%s' 'safe-length-secret-0123456789abcdef' > /fixture/real; chown 1000:1000 /fixture/real; chmod 600 /fixture/real; ln -s /fixture/real /fixture/source"],
    ["multiple hard links", "printf '%s' 'safe-length-secret-0123456789abcdef' > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source; ln /fixture/source /fixture/other"],
    ["wrong owner", "printf '%s' 'safe-length-secret-0123456789abcdef' > /fixture/source; chown 1001:1001 /fixture/source; chmod 600 /fixture/source"],
    ["empty", ": > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source"],
    ["control character", "printf 'safe-length-secret-0123456789abcdef\\n' > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source"]
  ];
  for (const [name, setup] of cases) {
    await t.test(name, () => {
      const result = runCase({ sudoUid: 1000, sudoGid: 1000, setup });
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(result.stdout + result.stderr, /safe-length-secret-0123456789abcdef/);
      assert.doesNotMatch(result.stderr, /DOCKER_CALLED/);
    });
  }
});

test("owner cannot be supplied by an extra parameter or ordinary environment override", () => {
  const setup = "printf '%s' 'wrong-owner-secret-0123456789abcdef' > /fixture/source; chown 1001:1001 /fixture/source; chmod 600 /fixture/source";
  const envResult = runCase({
    sudoUid: 1000,
    sudoGid: 1000,
    extraEnv: ["AIHUB_CADDY_SOURCE_UID=1001", "AIHUB_CADDY_SOURCE_GID=1001"],
    setup
  });
  assert.notEqual(envResult.status, 0);
  assert.doesNotMatch(envResult.stderr, /DOCKER_CALLED/);
  const argResult = runCase({ sudoUid: 1000, sudoGid: 1000, setup, extraArgs: ["1001:1001"] });
  assert.notEqual(argResult.status, 0);
  assert.doesNotMatch(argResult.stderr, /DOCKER_CALLED/);
});

test("host orchestration explicitly invokes scripts through bash", () => {
  const probe = fs.readFileSync(path.join(deployment, "probe-caddy-secret-volume.sh"), "utf8");
  const readme = fs.readFileSync(path.join(deployment, "README.md"), "utf8");
  assert.match(probe, /bash "\$script_dir\/seed-caddy-secret-volume\.sh"/);
  assert.match(readme, /sudo -n bash deployment\/community-production\/seed-caddy-secret-volume\.sh/);
  assert.match(readme, /sudo -n bash deployment\/community-production\/probe-caddy-secret-volume\.sh/);
});
