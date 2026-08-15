"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const image = "ubuntu@sha256:561618e2c15bf2397621dd04f96926663a3b5616c189cf7e38db7e82f5c538ea";
const prefix = `aihub-workflow-node-${process.pid}-${Date.now()}`;
const volumes = [];

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: options.timeout ?? 180_000
  });
  if (options.allowFailure !== true) {
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  return result;
}

function newCandidateVolume(label) {
  const name = `${prefix}-${label}`;
  docker(["volume", "create", name]);
  volumes.push(name);
  docker([
    "run", "--rm", "--network", "none",
    "-v", `${name}:/candidate`,
    "-v", `${deployment}:/source:ro`,
    image,
    "bash", "-euc",
    "mkdir -p /candidate/deployment/community-production; cp -a /source/. /candidate/deployment/community-production/; chown -R 1000:1000 /candidate; find /candidate -type d -exec chmod 0755 {} +; find /candidate -type f -exec chmod 0644 {} +; find /candidate/deployment/community-production -maxdepth 1 -type f -name '*.sh' -exec chmod 0755 {} +"
  ]);
  return name;
}

function runCase(volume, script, allowFailure = false) {
  return docker([
    "run", "--rm", "--network", "none",
    "-v", `${volume}:/candidate`,
    image,
    "bash", "-euc", script
  ], { allowFailure });
}

const helper = "/candidate/deployment/community-production/workflow-node-runtime.sh";
const archive = "/candidate/deployment/community-production/runtime/node-v24.18.1-linux-x64.tar.gz";
const marker = "/candidate/backup-started";
const cleanEnv = "env -i HOME=/tmp PATH=/usr/sbin:/usr/bin:/sbin:/bin";
const sudoCallerEnv = `${cleanEnv} SUDO_UID=1000 SUDO_GID=1000`;
const results = {};

function expectBlocked(label, mutation, invocation = `${sudoCallerEnv} ${helper} prepare`) {
  const volume = newCandidateVolume(label);
  const result = runCase(
    volume,
    `${mutation}\nif ${invocation}; then touch ${marker}; exit 97; fi\ntest ! -e ${marker}\ntest -z "$(find /candidate/.workflow-runtime -maxdepth 1 -name '.node-v24.18.1-linux-x64.tmp.*' -print 2>/dev/null || true)"`,
    true
  );
  assert.equal(result.status, 0, `${label}: ${result.stderr || result.stdout}`);
  results[label] = { blockedBeforeBackup: true };
}

function expectInstalledBlocked(label, mutation) {
  const volume = newCandidateVolume(label);
  const result = runCase(volume, `
    ${sudoCallerEnv} ${helper} prepare >/dev/null
    ${mutation}
    if ${sudoCallerEnv} ${helper} prepare; then touch ${marker}; exit 97; fi
    test ! -e ${marker}
  `, true);
  assert.equal(result.status, 0, `${label}: ${result.stderr || result.stdout}`);
  results[label] = { blockedBeforeBackup: true };
}

try {
  const successVolume = newCandidateVolume("success");
  const success = runCase(successVolume, `
    test -z "$(PATH=/usr/sbin:/usr/bin:/sbin:/bin command -v node || true)"
    node_path="$(${sudoCallerEnv} ${helper} prepare)"
    test "$node_path" = /candidate/.workflow-runtime/node-v24.18.1-linux-x64/bin/node
    test "$($node_path -e 'process.stdout.write(process.version+"|"+process.platform+"|"+process.arch)')" = 'v24.18.1|linux|x64'
    runtime_metadata="$(stat -c '%u:%g %a %h %s' "$node_path")"
    printf 'runtimeMetadata=%s\n' "$runtime_metadata"
    test "$runtime_metadata" = '1000:1000 555 1 123656816'
    test "$(sha256sum "$node_path" | awk '{print $1}')" = f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a
    touch ${marker}
  `, true);
  assert.equal(success.status, 0, success.stderr || success.stdout);
  results.noHostPathNode = true;
  results.success = true;

  expectBlocked("missing", `rm -f ${archive}`);
  expectBlocked("corrupt", `printf x >> ${archive}`);
  expectBlocked("symlink", `mv ${archive} ${archive}.real; ln -s ${archive}.real ${archive}`);
  expectBlocked("hardlink", `ln ${archive} ${archive}.other`);
  expectBlocked("wrong-source-owner", `chown 0:0 ${archive}`);
  expectBlocked("wrong-source-mode", `chmod 600 ${archive}`);
  expectBlocked("wrong-version", `sed -i "s/NODE_VERSION='v24.18.1'/NODE_VERSION='v24.18.0'/" ${helper}`);
  expectBlocked("wrong-architecture", `sed -i 's/"$(uname -m)" == "x86_64"/"$(uname -m)" == "aarch64"/' ${helper}`);
  expectBlocked("root-without-sudo-caller", ":", `${cleanEnv} ${helper} prepare`);
  expectBlocked("wrong-sudo-caller", ":", `${cleanEnv} SUDO_UID=1001 SUDO_GID=1001 ${helper} prepare`);
  expectBlocked("malformed-sudo-caller", ":", `${cleanEnv} SUDO_UID=abc SUDO_GID=1000 ${helper} prepare`);
  expectBlocked("zero-sudo-caller", ":", `${cleanEnv} SUDO_UID=0 SUDO_GID=0 ${helper} prepare`);
  expectBlocked("out-of-range-sudo-caller", ":", `${cleanEnv} SUDO_UID=4294967296 SUDO_GID=4294967296 ${helper} prepare`);
  expectBlocked("incomplete-sudo-caller", ":", `${cleanEnv} SUDO_UID=1000 ${helper} prepare`);

  expectInstalledBlocked("installed-symlink", `mv /candidate/.workflow-runtime/node-v24.18.1-linux-x64/bin/node /candidate/.workflow-runtime/node-v24.18.1-linux-x64/bin/node.real; ln -s node.real /candidate/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`);
  expectInstalledBlocked("installed-hardlink", `ln /candidate/.workflow-runtime/node-v24.18.1-linux-x64/bin/node /candidate/node-hardlink`);
  expectInstalledBlocked("installed-wrong-owner", `chown 0:0 /candidate/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`);
  expectInstalledBlocked("installed-wrong-mode", `chmod 755 /candidate/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`);
  expectInstalledBlocked("installed-corrupt", `cp /candidate/.workflow-runtime/node-v24.18.1-linux-x64/bin/node /candidate/node.corrupt; chmod 755 /candidate/node.corrupt; printf x >> /candidate/node.corrupt; chown 1000:1000 /candidate/node.corrupt; chmod 555 /candidate/node.corrupt; mv -f /candidate/node.corrupt /candidate/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`);
  expectInstalledBlocked("installed-directory-owner", `chown 0:0 /candidate/.workflow-runtime/node-v24.18.1-linux-x64/bin`);
  expectInstalledBlocked("installed-directory-mode", `chmod 775 /candidate/.workflow-runtime/node-v24.18.1-linux-x64`);
  expectBlocked("existing-target", `mkdir -p /candidate/.workflow-runtime/node-v24.18.1-linux-x64; chown -R 1000:1000 /candidate/.workflow-runtime; chmod 755 /candidate/.workflow-runtime /candidate/.workflow-runtime/node-v24.18.1-linux-x64; printf sentinel > /candidate/.workflow-runtime/node-v24.18.1-linux-x64/sentinel`);
  expectBlocked("rename-failure", `mv /usr/bin/mv /usr/bin/mv.real; printf '#!/bin/sh\nexit 1\n' > /usr/bin/mv; chmod 755 /usr/bin/mv`);

  const execVolume = newCandidateVolume("exec-failure");
  const execFailure = runCase(execVolume, `
    ${sudoCallerEnv} ${helper} prepare >/dev/null
    if (ulimit -v 32768; ${sudoCallerEnv} ${helper} prepare >/dev/null 2>&1); then touch ${marker}; exit 97; fi
    test ! -e ${marker}
  `, true);
  assert.equal(execFailure.status, 0, execFailure.stderr || execFailure.stdout);
  results.execFailure = { blockedBeforeBackup: true };

  const output = path.join(root, "output", "workflow-node-runtime-linux-candidate.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify({
    schemaVersion: 1,
    candidateOnly: true,
    deployable: false,
    image,
    runtime: "node-v24.18.1-linux-x64",
    results
  }, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ ok: true, output, cases: Object.keys(results).length })}\n`);
} finally {
  for (const volume of volumes.reverse()) {
    docker(["volume", "rm", "-f", volume], { allowFailure: true, timeout: 30_000 });
  }
}
