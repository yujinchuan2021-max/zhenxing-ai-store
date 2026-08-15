"use strict";

// Local transport coordinator only. It is intentionally outside the
// deployment manifest and reads the Stage0 program from one frozen bundle.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SSH_PATH = "C:\\Windows\\System32\\OpenSSH\\ssh.exe";
const SSH_KEYGEN_PATH = "C:\\Windows\\System32\\OpenSSH\\ssh-keygen.exe";
const IDENTITY_FILE = "C:\\Users\\yujin\\.ssh\\zhenxingai_deploy_ed25519";
const IDENTITY_PUBLIC_KEY_FINGERPRINT = "SHA256:30qQ4kGdaJxbDUXu31TJybjq5g5GAuptdKBgHcYxW50";
const KNOWN_HOSTS_FILE = "C:\\Users\\yujin\\.ssh\\known_hosts_aihub_production";
const KNOWN_HOSTS_SHA256 = "a6a35075c8ea44425ef8b3db35f09c17670672cad83a64dc2e4bd110d58a5697";
const HOST_KEY_FINGERPRINT = "SHA256:q4aNRJbw9Pday5Wfq9W1bVErTe1b4Yz6nn7aM+gLDrI";
const REMOTE_TARGET = "admin@47.236.62.189";
const BUNDLE_ROOT = path.join(ROOT, "output", "workflow-production-r16-5aefec93-capability-readiness-20260811.bundle");
const STAGE0_RELATIVE = path.join("payload", "deployment", "community-production", "workflow-production-fresh-host-stage0.sh");
const SENTINEL = "@@AIHUB_FRESH_HOST_STAGE0_V1@@";
const SSH_OPTIONS = Object.freeze([
  "-T",
  "-o", "BatchMode=yes",
  "-o", "IdentitiesOnly=yes",
  "-o", "StrictHostKeyChecking=yes",
  "-o", "ConnectionAttempts=1",
  "-o", "ControlMaster=no",
  "-o", "ClearAllForwardings=yes"
]);
const REMOTE_FAILURE_CODES = Object.freeze([
  "FRESH_HOST_ARGUMENT_INVALID",
  "FRESH_HOST_COMPOSE_VERSION_DRIFT",
  "FRESH_HOST_CPU_UNDERSIZED",
  "FRESH_HOST_DIRECTORY_CONFLICT",
  "FRESH_HOST_DISK_UNDERSIZED",
  "FRESH_HOST_DNS_DRIFT",
  "FRESH_HOST_DOCKER_NOT_READY",
  "FRESH_HOST_DOCKER_NOT_ROOTFUL",
  "FRESH_HOST_DOCKER_VERSION_DRIFT",
  "FRESH_HOST_GLIBC_DRIFT",
  "FRESH_HOST_IDENTITY_CONFLICT",
  "FRESH_HOST_KERNEL_DRIFT",
  "FRESH_HOST_LOGIN_IDENTITY_DRIFT",
  "FRESH_HOST_LOGIN_IDENTITY_NOT_FROZEN",
  "FRESH_HOST_OS_DRIFT",
  "FRESH_HOST_PACKAGE_CONFLICT",
  "FRESH_HOST_PARTIAL_INSTALL",
  "FRESH_HOST_PLATFORM_DRIFT",
  "FRESH_HOST_PORT_CONFLICT",
  "FRESH_HOST_ROOT_REQUIRED"
]);
const REMOTE_FAILURE_CODE_SET = new Set(REMOTE_FAILURE_CODES);
const REPORT_KEYS = Object.freeze([
  "schema", "status", "phase", "code", "remoteFailureCode", "sshProcessStarts", "remoteConnections", "remoteWrites",
  "eligibleForTransfer", "prepareAuthorized", "launchAuthorized", "secretValuesEmitted"
]);
const MAX_OUTPUT_LINE_BYTES = 64 * 1024;

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }

function validateKnownHostsBytes(bytes, options = {}) {
  assert.ok(Buffer.isBuffer(bytes));
  assert.ok(bytes.length > 0 && bytes.length <= 4096);
  const lines = bytes.toString("utf8").split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 1);
  const fields = lines[0].split(" ");
  assert.equal(fields.length, 3);
  assert.equal(fields[0], "47.236.62.189");
  assert.equal(fields[1], "ssh-ed25519");
  assert.match(fields[2], /^[A-Za-z0-9+/]+={0,2}$/);
  const decoded = Buffer.from(fields[2], "base64");
  assert.ok(decoded.length > 0);
  const canonical = decoded.toString("base64").replace(/=+$/, "");
  assert.equal(canonical, fields[2].replace(/=+$/, ""));
  const fingerprint = `SHA256:${crypto.createHash("sha256").update(decoded).digest("base64").replace(/=+$/, "")}`;
  assert.equal(fingerprint, options.fingerprint || HOST_KEY_FINGERPRINT);
  return true;
}

function validateIdentityFingerprintResult(result) {
  assert.equal(result?.status, 0);
  assert.equal(result?.signal, null);
  assert.equal(result?.stderr, "");
  assert.equal(typeof result?.stdout, "string");
  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 1);
  const match = /^256 (SHA256:[A-Za-z0-9+/]+) .+ \(ED25519\)$/.exec(lines[0]);
  assert.ok(match);
  assert.equal(match[1], IDENTITY_PUBLIC_KEY_FINGERPRINT);
  return true;
}

function validateAuthority() {
  for (const filename of [SSH_PATH, SSH_KEYGEN_PATH, IDENTITY_FILE, KNOWN_HOSTS_FILE]) {
    assert.equal(path.isAbsolute(filename), true);
    const stat = fs.lstatSync(filename);
    assert.equal(stat.isFile(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(path.resolve(fs.realpathSync(filename)).toLowerCase(), path.resolve(filename).toLowerCase());
  }
  assert.equal(fs.lstatSync(IDENTITY_FILE).nlink, 1);
  assert.equal(fs.lstatSync(KNOWN_HOSTS_FILE).nlink, 1);
  const knownHosts = fs.readFileSync(KNOWN_HOSTS_FILE);
  assert.equal(sha256(knownHosts), KNOWN_HOSTS_SHA256);
  validateKnownHostsBytes(knownHosts);
  validateIdentityFingerprintResult(childProcess.spawnSync(SSH_KEYGEN_PATH, ["-lf", IDENTITY_FILE, "-E", "sha256"], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: 10_000,
    maxBuffer: 4096
  }));
  return true;
}

function verifyBundle() {
  const modulePath = path.join(ROOT, "deployment", "community-production", "workflow-production-release-bundle.cjs");
  const receipt = require(modulePath).verifyWorkflowProductionReleaseBundle(BUNDLE_ROOT);
  assert.equal(receipt.deploymentSetDigest, "5aefec9384957eb1a814bde7a27e2adcb3bbfa4fb4378d8c273ab37c95f7b334");
  assert.equal(receipt.deploymentManifestSha256, "2b401a6c042691c4ccb26617379e7aeddea4a95769e822058bc5649748fb0a1e");
  assert.equal(receipt.payloadDigest, "477270793bc1aabd8d0866cdddec88c66383c54e7bb17fc4ee79dff9d0b5081e");
  assert.equal(receipt.bundleManifestSha256, "37db7b5496bee4a03d5c700336a49d1269d578baaf031cd068cbc869d758fe00");
  assert.equal(receipt.bundleTableSha256, "c491c9abf1ba79ac05e8e0fa4eb9a318fe5edb748e5c1e8b22a2ac5c537a4bfc");
  assert.equal(receipt.fileCount, 146);
  assert.equal(receipt.directoryCount, 13);
  return true;
}

function readStage0() {
  const filename = path.join(BUNDLE_ROOT, STAGE0_RELATIVE);
  const stat = fs.lstatSync(filename);
  assert.equal(stat.isFile(), true);
  assert.equal(stat.isSymbolicLink(), false);
  assert.equal(stat.nlink, 1);
  return fs.readFileSync(filename);
}

function fixedSshArgs(phase) {
  assert.equal(["preflight", "apply", "verify"].includes(phase), true);
  return [
    ...SSH_OPTIONS,
    "-i", IDENTITY_FILE,
    "-o", `UserKnownHostsFile=${KNOWN_HOSTS_FILE}`,
    REMOTE_TARGET,
    "/usr/bin/env", "-i", "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL=C",
    "/usr/bin/sudo", "-n", "/bin/bash", "-s", "--", phase
  ];
}

function safeReport(report) {
  assert.deepEqual(Object.keys(report), REPORT_KEYS);
  assert.equal(report.schema, "aihub-workflow-production-fresh-host-stage0-launcher-v1");
  assert.equal(["pass", "blocked"].includes(report.status), true);
  assert.equal(["preflight", "apply", "verify"].includes(report.phase), true);
  assert.equal(report.sshProcessStarts === 0 || report.sshProcessStarts === 1, true);
  assert.equal(report.remoteConnections === 0 || report.remoteConnections === 1, true);
  assert.equal(report.remoteWrites === 0 || report.remoteWrites === 1, true);
  assert.equal(report.secretValuesEmitted, false);
  assert.equal(report.prepareAuthorized, false);
  assert.equal(report.launchAuthorized, false);
  assert.equal(report.remoteFailureCode === null || REMOTE_FAILURE_CODE_SET.has(report.remoteFailureCode), true);
  if (report.remoteFailureCode !== null) {
    assert.equal(report.status, "blocked");
    assert.equal(report.code, "FRESH_HOST_STAGE0_FAILED");
    assert.equal(report.remoteConnections, 1);
  }
  if (report.status === "pass") assert.equal(report.remoteFailureCode, null);
  const encoded = JSON.stringify(report);
  assert.equal(Buffer.byteLength(encoded) <= 2048, true);
  assert.equal(/(?:PRIVATE KEY|ssh-ed25519|stdout|stderr|stack|password|token|[A-Za-z]:\\|\/opt\/)/i.test(encoded), false);
  return Object.freeze(report);
}

function blocked(phase, code, starts, connections, remoteFailureCode = null) {
  return safeReport({
    schema: "aihub-workflow-production-fresh-host-stage0-launcher-v1",
    status: "blocked",
    phase,
    code,
    remoteFailureCode,
    sshProcessStarts: starts,
    remoteConnections: connections,
    remoteWrites: phase === "apply" && connections === 1 ? 1 : 0,
    eligibleForTransfer: false,
    prepareAuthorized: false,
    launchAuthorized: false,
    secretValuesEmitted: false
  });
}

function parseRemoteFailureCode(stderr) {
  if (typeof stderr !== "string" || Buffer.byteLength(stderr) === 0 || Buffer.byteLength(stderr) > 256) return null;
  const match = /^(FRESH_HOST_[A-Z0-9_]+)(?:\r?\n)?$/.exec(stderr);
  return match && REMOTE_FAILURE_CODE_SET.has(match[1]) ? match[1] : null;
}

function parseStage0Output(stdout) {
  assert.equal(typeof stdout, "string");
  assert.equal(Buffer.byteLength(stdout) <= 8 * 1024 * 1024, true);
  assert.equal(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(stdout), false);
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length >= 2, true);
  assert.equal(lines[0], SENTINEL);
  assert.equal(lines.filter((line) => line === SENTINEL).length, 1);
  for (const line of lines) assert.equal(Buffer.byteLength(line) <= MAX_OUTPUT_LINE_BYTES, true);
  const receipt = JSON.parse(lines.at(-1));
  assert.deepEqual(Object.keys(receipt), ["schema", "status", "eligibleForTransfer", "prepareAuthorized", "launchAuthorized"]);
  assert.equal(receipt.schema, "aihub-workflow-production-fresh-host-stage0-v1");
  assert.equal(receipt.status, "pass");
  assert.equal(receipt.eligibleForTransfer, true);
  assert.equal(receipt.prepareAuthorized, false);
  assert.equal(receipt.launchAuthorized, false);
  return Object.freeze(receipt);
}

function runStage0(phase, dependencies = {}) {
  assert.equal(["preflight", "apply", "verify"].includes(phase), true);
  const authority = dependencies.validateAuthority || validateAuthority;
  const bundle = dependencies.verifyBundle || verifyBundle;
  const reader = dependencies.readStage0 || readStage0;
  const spawn = dependencies.spawnSync || childProcess.spawnSync;
  try {
    authority();
    bundle();
  } catch {
    return blocked(phase, "FRESH_HOST_LOCAL_AUTHORITY_FAILED", 0, 0);
  }
  let program;
  try { program = reader(); } catch { return blocked(phase, "FRESH_HOST_LOCAL_BUNDLE_FAILED", 0, 0); }
  if (!Buffer.isBuffer(program) || program.length === 0 || program.length > 128 * 1024) {
    return blocked(phase, "FRESH_HOST_LOCAL_BUNDLE_FAILED", 0, 0);
  }
  const result = spawn(SSH_PATH, fixedSshArgs(phase), {
    input: program,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: phase === "apply" ? 900_000 : 60_000,
    maxBuffer: 8 * 1024 * 1024
  });
  const stdout = typeof result?.stdout === "string" ? result.stdout : "";
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const connected = lines[0] === SENTINEL ? 1 : 0;
  if (result?.error || result?.signal || result?.status !== 0) {
    const remoteFailureCode = !result?.error && !result?.signal && result?.status === 1 && connected === 1
      ? parseRemoteFailureCode(result.stderr)
      : null;
    return blocked(phase, "FRESH_HOST_STAGE0_FAILED", 1, connected, remoteFailureCode);
  }
  if (connected !== 1 || lines.length < 2) return blocked(phase, "FRESH_HOST_STAGE0_PROTOCOL_FAILED", 1, connected);
  try {
    parseStage0Output(stdout);
  } catch {
    return blocked(phase, "FRESH_HOST_STAGE0_PROTOCOL_FAILED", 1, 1);
  }
  return safeReport({
    schema: "aihub-workflow-production-fresh-host-stage0-launcher-v1",
    status: "pass",
    phase,
    code: null,
    remoteFailureCode: null,
    sshProcessStarts: 1,
    remoteConnections: 1,
    remoteWrites: phase === "apply" ? 1 : 0,
    eligibleForTransfer: true,
    prepareAuthorized: false,
    launchAuthorized: false,
    secretValuesEmitted: false
  });
}

if (require.main === module) {
  const phase = process.argv.length === 3 ? process.argv[2] : "";
  const report = runStage0(phase);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.status !== "pass") process.exitCode = 1;
}

module.exports = {
  BUNDLE_ROOT,
  HOST_KEY_FINGERPRINT,
  IDENTITY_FILE,
  IDENTITY_PUBLIC_KEY_FINGERPRINT,
  KNOWN_HOSTS_FILE,
  KNOWN_HOSTS_SHA256,
  REMOTE_FAILURE_CODES,
  REMOTE_TARGET,
  SENTINEL,
  SSH_OPTIONS,
  SSH_KEYGEN_PATH,
  SSH_PATH,
  fixedSshArgs,
  parseRemoteFailureCode,
  parseStage0Output,
  runStage0,
  validateAuthority,
  validateIdentityFingerprintResult,
  validateKnownHostsBytes
};
