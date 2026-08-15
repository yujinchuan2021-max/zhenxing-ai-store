"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const launcherPath = path.join(root, "scripts", "workflow-production-fresh-host-stage0-launcher.cjs");

test("fresh-host Stage0 has one fixed strict-known-hosts transport", () => {
  const launcher = require(launcherPath);
  assert.equal(path.basename(launcher.BUNDLE_ROOT), "workflow-production-r16-5aefec93-capability-readiness-20260811.bundle");
  assert.equal(launcher.SSH_PATH, "C:\\Windows\\System32\\OpenSSH\\ssh.exe");
  assert.equal(launcher.IDENTITY_FILE, "C:\\Users\\yujin\\.ssh\\zhenxingai_deploy_ed25519");
  assert.equal(launcher.IDENTITY_PUBLIC_KEY_FINGERPRINT, "SHA256:30qQ4kGdaJxbDUXu31TJybjq5g5GAuptdKBgHcYxW50");
  assert.equal(launcher.KNOWN_HOSTS_FILE, "C:\\Users\\yujin\\.ssh\\known_hosts_aihub_production");
  assert.equal(launcher.KNOWN_HOSTS_SHA256, "a6a35075c8ea44425ef8b3db35f09c17670672cad83a64dc2e4bd110d58a5697");
  assert.equal(launcher.REMOTE_TARGET, "admin@47.236.62.189");
  assert.deepEqual(launcher.SSH_OPTIONS, [
    "-T", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=yes",
    "-o", "ConnectionAttempts=1", "-o", "ControlMaster=no", "-o", "ClearAllForwardings=yes"
  ]);
});

test("Stage0 parses only the fixed receipt and tolerates legal long inventory metadata", () => {
  const launcher = require(launcherPath);
  const legalInventory = `docker-security-options=${"x".repeat(1024)}`;
  const stdout = `${launcher.SENTINEL}\n${legalInventory}\n${JSON.stringify({
    schema: "aihub-workflow-production-fresh-host-stage0-v1",
    status: "pass",
    eligibleForTransfer: true,
    prepareAuthorized: false,
    launchAuthorized: false
  })}\n`;
  assert.deepEqual(launcher.parseStage0Output(stdout), {
    schema: "aihub-workflow-production-fresh-host-stage0-v1",
    status: "pass",
    eligibleForTransfer: true,
    prepareAuthorized: false,
    launchAuthorized: false
  });
  assert.throws(() => launcher.parseStage0Output(stdout.replace(legalInventory, `bad\u0000metadata`)));
  assert.throws(() => launcher.parseStage0Output(stdout.replace(legalInventory, "x".repeat(64 * 1024 + 1))));
});

test("deployment identity authority is bound to the fixed ED25519 public fingerprint", () => {
  const launcher = require(launcherPath);
  const valid = { status: 0, signal: null, stderr: "", stdout: "256 SHA256:30qQ4kGdaJxbDUXu31TJybjq5g5GAuptdKBgHcYxW50 deployment (ED25519)\n" };
  assert.equal(launcher.validateIdentityFingerprintResult(valid), true);
  assert.throws(() => launcher.validateIdentityFingerprintResult({ ...valid, stdout: valid.stdout.replace("30qQ4", "wrong") }));
  assert.throws(() => launcher.validateIdentityFingerprintResult({ ...valid, stdout: `${valid.stdout}extra\n` }));
  assert.throws(() => launcher.validateIdentityFingerprintResult({ ...valid, status: 1 }));
  const source = fs.readFileSync(launcherPath, "utf8");
  assert.match(source, /ssh-keygen\.exe/);
  assert.match(source, /\["-lf", IDENTITY_FILE, "-E", "sha256"\]/);
  assert.match(source, /shell: false/);
});

test("known-host authority accepts only the exact OOB ED25519 host", () => {
  const { validateKnownHostsBytes } = require(launcherPath);
  const key = Buffer.from("fixed-ed25519-host-key").toString("base64");
  const crypto = require("node:crypto");
  const fingerprint = `SHA256:${crypto.createHash("sha256").update(Buffer.from(key, "base64")).digest("base64").replace(/=+$/, "")}`;
  assert.equal(validateKnownHostsBytes(Buffer.from(`47.236.62.189 ssh-ed25519 ${key}\n`), { fingerprint }), true);
  for (const value of [
    `other.example ssh-ed25519 ${key}\n`,
    `47.236.62.189 ssh-rsa ${key}\n`,
    `47.236.62.189 ssh-ed25519 ${key}\n47.236.62.189 ssh-ed25519 ${key}\n`,
    `47.236.62.189 ssh-ed25519 !!!!\n`
  ]) assert.throws(() => validateKnownHostsBytes(Buffer.from(value), { fingerprint }));
});

test("Stage0 launcher invokes one SSH with fixed argv, shell false, and exact stdin bytes", () => {
  const launcher = require(launcherPath);
  const calls = [];
  const script = Buffer.from("fixed-stage0-script\n");
  const spawn = (file, args, options) => {
    calls.push({ file, args, options });
    return {
      status: 0,
      signal: null,
      stdout: `${launcher.SENTINEL}\npackage output\n{\"schema\":\"aihub-workflow-production-fresh-host-stage0-v1\",\"status\":\"pass\",\"eligibleForTransfer\":true,\"prepareAuthorized\":false,\"launchAuthorized\":false}\n`,
      stderr: "non-sensitive package progress"
    };
  };
  const report = launcher.runStage0("preflight", {
    spawnSync: spawn,
    validateAuthority: () => true,
    verifyBundle: () => true,
    readStage0: () => script
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, launcher.SSH_PATH);
  assert.deepEqual(calls[0].args, launcher.fixedSshArgs("preflight"));
  assert.equal(calls[0].options.shell, false);
  assert.deepEqual(calls[0].options.input, script);
  assert.deepEqual(report, {
    schema: "aihub-workflow-production-fresh-host-stage0-launcher-v1",
    status: "pass",
    phase: "preflight",
    code: null,
    remoteFailureCode: null,
    sshProcessStarts: 1,
    remoteConnections: 1,
    remoteWrites: 0,
    eligibleForTransfer: true,
    prepareAuthorized: false,
    launchAuthorized: false,
    secretValuesEmitted: false
  });
});

test("Stage0 launcher projects only one exact frozen remote failure enum", () => {
  const launcher = require(launcherPath);
  const run = (phase, result) => launcher.runStage0(phase, {
    spawnSync: () => result,
    validateAuthority: () => true,
    verifyBundle: () => true,
    readStage0: () => Buffer.from("secret-stage0-bytes")
  });
  const remote = run("apply", { status: 1, signal: null, stdout: `${launcher.SENTINEL}\n`, stderr: "FRESH_HOST_DNS_DRIFT\n" });
  assert.equal(remote.status, "blocked");
  assert.equal(remote.code, "FRESH_HOST_STAGE0_FAILED");
  assert.equal(remote.remoteFailureCode, "FRESH_HOST_DNS_DRIFT");
  assert.equal(remote.remoteConnections, 1);
  assert.equal(remote.remoteWrites, 1);
  assert.doesNotMatch(JSON.stringify(remote), /stderr|secret-stage0/);

  for (const stderr of [
    "FRESH_HOST_NOT_FROZEN\n",
    "FRESH_HOST_DNS_DRIFT\nFRESH_HOST_PORT_CONFLICT\n",
    "FRESH_HOST_DNS_DRIFT\u0000\n",
    `FRESH_HOST_DNS_DRIFT${"x".repeat(1024)}\n`,
    "noise FRESH_HOST_DNS_DRIFT\n"
  ]) {
    const rejected = run("preflight", { status: 1, signal: null, stdout: `${launcher.SENTINEL}\n`, stderr });
    assert.equal(rejected.remoteFailureCode, null);
    assert.doesNotMatch(JSON.stringify(rejected), /NOT_FROZEN|PORT_CONFLICT|noise|stderr/);
  }

  const noSentinel = run("verify", { status: 1, signal: null, stdout: "", stderr: "FRESH_HOST_DNS_DRIFT\n" });
  assert.equal(noSentinel.remoteFailureCode, null);
  const transport = run("verify", { status: 255, signal: null, stdout: "", stderr: "FRESH_HOST_DNS_DRIFT\n" });
  assert.equal(transport.remoteConnections, 0);
  assert.equal(transport.remoteWrites, 0);
  assert.equal(transport.remoteFailureCode, null);
  const signaled = run("verify", { status: null, signal: "SIGTERM", stdout: `${launcher.SENTINEL}\n`, stderr: "FRESH_HOST_DNS_DRIFT\n" });
  assert.equal(signaled.remoteConnections, 1);
  assert.equal(signaled.remoteFailureCode, null);
  assert.throws(() => launcher.runStage0("launch", { spawnSync: () => { throw new Error("must not spawn"); } }));
});

test("Stage0 remote failure allowlist is exact to the frozen program", () => {
  const launcher = require(launcherPath);
  const program = fs.readFileSync(path.join(
    launcher.BUNDLE_ROOT,
    "payload", "deployment", "community-production", "workflow-production-fresh-host-stage0.sh"
  ), "utf8");
  const programCodes = [...program.matchAll(/\bfail\s+(FRESH_HOST_[A-Z0-9_]+)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(programCodes)].sort(), [...launcher.REMOTE_FAILURE_CODES].sort());
  assert.equal(launcher.REMOTE_FAILURE_CODES.includes("FRESH_HOST_STAGE0_V1"), false);
  assert.equal(launcher.REMOTE_FAILURE_CODES.includes("FRESH_HOST_MEMORY_UNDERSIZED"), false);
});

test("Stage0 launcher is local-only, bounded, and does not involve PowerShell or transfer tools", () => {
  const source = fs.readFileSync(launcherPath, "utf8");
  const executableSource = source.replace(/const REMOTE_FAILURE_CODES = Object\.freeze\(\[[\s\S]*?\]\);/, "");
  assert.match(source, /require\.main === module/);
  assert.match(source, /maxBuffer:/);
  assert.match(source, /timeout:/);
  assert.doesNotMatch(executableSource, /powershell|ConvertFrom-Json|scp|sftp|mktemp|docker|systemctl/i);
  assert.doesNotMatch(executableSource, /(?:spawn|exec).*base64/i);
  assert.doesNotMatch(executableSource, /known_hosts(?:["'])/);
});
