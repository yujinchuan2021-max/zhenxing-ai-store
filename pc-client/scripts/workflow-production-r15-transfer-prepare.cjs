"use strict";

// Local-only fixed asset coordinator. It is intentionally outside the
// deployment manifest and never invokes the production launcher.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const stage0 = require("./workflow-production-fresh-host-stage0-launcher.cjs");

const ROOT = path.resolve(__dirname, "..");
const BUNDLE_ROOT = path.join(ROOT, "output", "workflow-production-r27-target-verifier.bundle");
const REMOTE_TARGET = "admin@47.236.62.189";
const REMOTE_STAGING = "/opt/zhenxing-ai/staging/community-production-r27-1b04aa02.bundle";
const REMOTE_RELEASE = "/opt/zhenxing-ai/releases/community-production-r27-1b04aa02";
const SSH_PATH = stage0.SSH_PATH;
const SCP_PATH = "C:\\Windows\\System32\\OpenSSH\\scp.exe";
const SENTINEL = "@@AIHUB_R27_ASSET_V1@@";
const REMOTE_SCHEMA = "aihub-workflow-production-r27-asset-remote-v1";
const REPORT_SCHEMA = "aihub-workflow-production-r27-asset-coordinator-v1";
const PHASES = Object.freeze(["dry-preflight", "transfer", "prepare", "verify"]);
const CANDIDATE = Object.freeze({
  deploymentSetDigest: "1b04aa02c881b18039b051bae5634599c54e3545514fcc4c456190c4cd411ad1",
  deploymentManifestSha256: "8382bef837dbf05b0f80862c43bad132582fae647fe011f5cb917637b2309a84",
  payloadDigest: "fa72276839c0401a5743c15e304f505750e624641423cd5b2941e179b880ca17",
  bundleManifestSha256: "a0d084efd2d98b421e1cf56b11a7c23d7bd17089c302d78edb2b4fb821924512",
  bundleTableSha256: "48e7af773b3517b1f93fea3881e32bf3ddf4fe93e3697e6dc8cf776829130baa",
  fileCount: 350,
  directoryCount: 14
});
const SSH_OPTIONS = Object.freeze([
  "-T",
  "-o", "BatchMode=yes",
  "-o", "IdentitiesOnly=yes",
  "-o", "StrictHostKeyChecking=yes",
  "-o", "ConnectionAttempts=1",
  "-o", "ControlMaster=no",
  "-o", "ClearAllForwardings=yes"
]);

const DRY_PREFLIGHT_PROGRAM = `#!/bin/bash
set -euo pipefail
staging_root='/opt/zhenxing-ai/staging'
release_root='/opt/zhenxing-ai/releases'
incoming='/opt/zhenxing-ai/staging/community-production-r27-1b04aa02.bundle'
release='/opt/zhenxing-ai/releases/community-production-r27-1b04aa02'
[[ "$(id -u):$(id -g)" == '0:0' ]]
[[ "\${SUDO_UID:-}:\${SUDO_GID:-}" == '1000:1000' ]]
[[ -d "$staging_root" && ! -L "$staging_root" && "$(realpath -e -- "$staging_root")" == "$staging_root" ]]
[[ -d "$release_root" && ! -L "$release_root" && "$(realpath -e -- "$release_root")" == "$release_root" ]]
[[ "$(stat -c '%u:%g %a' -- "$staging_root")" == '1000:1000 755' ]]
[[ "$(stat -c '%u:%g %a' -- "$release_root")" == '1000:1000 755' ]]
[[ ! -e "$incoming" && ! -L "$incoming" && ! -e "$release" && ! -L "$release" ]]
printf '%s\n' '${SENTINEL}'
printf '%s\n' '{"schema":"${REMOTE_SCHEMA}","phase":"dry-preflight","ok":true,"staging":"absent","release":"absent"}'
`;

const INGRESS_PAYLOAD_VALIDATOR = String.raw`verify_ingress_payload() {
  local line_number=0 metadata_rows=0 directory_rows=0 file_rows=0
  local kind first second third fourth extra target links size digest
  while IFS=$'\t' read -r kind first second third fourth extra; do
    line_number=$((line_number + 1))
    if [[ "$line_number" == '1' ]]; then
      [[ "$kind" == 'AIHUB_WORKFLOW_PRODUCTION_RELEASE_BUNDLE_V1' && -z "$first$second$third$fourth$extra" ]]
      continue
    fi
    case "$kind" in
      M)
        metadata_rows=$((metadata_rows + 1))
        [[ "$first" =~ ^[A-Za-z][A-Za-z0-9]+$ && -n "$second" && -z "$third$fourth$extra" ]]
        ;;
      D)
        directory_rows=$((directory_rows + 1))
        [[ "$first" == '0755' && "$second" =~ ^[A-Za-z0-9._/-]+$ && "$second" != /* && "/$second/" != *'/../'* && -z "$third$fourth$extra" ]]
        ;;
      F)
        file_rows=$((file_rows + 1))
        [[ "$first" == '0644' || "$first" == '0755' ]]
        [[ "$second" =~ ^[1-9][0-9]*$ && "$third" =~ ^[0-9a-f]{64}$ && "$fourth" =~ ^[A-Za-z0-9._/-]+$ && "$fourth" != /* && "/$fourth/" != *'/../'* && -z "$extra" ]]
        target="$bundle/payload/$fourth"
        [[ -f "$target" && ! -L "$target" ]]
        read -r links size < <(stat -c '%h %s' -- "$target")
        [[ "$links" == '1' && "$size" == "$second" ]]
        digest="$(sha256sum -- "$target" | awk '{print $1}')"
        [[ "$digest" == "$third" ]]
        ;;
      *) return 1 ;;
    esac
  done < "$table"
  [[ "$line_number" == '372' && "$metadata_rows" == '7' && "$directory_rows" == '14' && "$file_rows" == '350' ]]
  local actual_files expected_files actual_directories expected_directories
  actual_files="$(cd "$bundle" && find -P . -type f -printf '%P\n' | LC_ALL=C sort)"
  expected_files="$( { printf '%s\n' '.aihub-workflow-release-bundle.json' '.aihub-workflow-release-bundle.tsv' '.aihub-identity-source-manifest.json'; awk -F '\t' '$1=="F" {print "payload/"$5}' "$table"; } | LC_ALL=C sort)"
  [[ "$actual_files" == "$expected_files" ]]
  actual_directories="$(cd "$bundle" && find -P . -mindepth 1 -type d -printf '%P\n' | LC_ALL=C sort)"
  expected_directories="$( { printf '%s\n' payload; awk -F '\t' '$1=="D" {print "payload/"$3}' "$table"; } | LC_ALL=C sort)"
  [[ "$actual_directories" == "$expected_directories" ]]
}`;

const TRANSFER_PROGRAM = `#!/bin/bash
set -euo pipefail
bundle='/opt/zhenxing-ai/staging/community-production-r27-1b04aa02.bundle'
release='/opt/zhenxing-ai/releases/community-production-r27-1b04aa02'
table="$bundle/.aihub-workflow-release-bundle.tsv"
[[ ! -e "$release" && ! -L "$release" ]]
[[ -d "$bundle" && ! -L "$bundle" && "$(realpath -e -- "$bundle")" == "$bundle" ]]
[[ "$(dirname -- "$bundle")" == '/opt/zhenxing-ai/staging' ]]
if find -P "$bundle" -mindepth 1 ! -type d ! -type f -print -quit | grep -q .; then exit 21; fi
while IFS= read -r entry; do
  read -r owner mode links < <(stat -c '%u:%g %a %h' -- "$entry")
  [[ "$owner" == '1000:1000' ]]
  if [[ -f "$entry" ]]; then [[ "$links" == '1' ]]; fi
done < <(find -P "$bundle" -mindepth 0 -print)
[[ "$(sha256sum -- "$bundle/.aihub-workflow-release-bundle.json" | awk '{print $1}')" == 'a0d084efd2d98b421e1cf56b11a7c23d7bd17089c302d78edb2b4fb821924512' ]]
[[ "$(sha256sum -- "$table" | awk '{print $1}')" == '48e7af773b3517b1f93fea3881e32bf3ddf4fe93e3697e6dc8cf776829130baa' ]]
[[ "$(sha256sum -- "$bundle/.aihub-identity-source-manifest.json" | awk '{print $1}')" == '5d958a8afdfc70f09cb9ddd6df755bab09af62419c77d996dbb63a5743ddfff3' ]]
${INGRESS_PAYLOAD_VALIDATOR}
verify_ingress_payload
chown -R 1000:1000 -- "$bundle"
find -P "$bundle" -type d -exec chmod 0700 -- {} +
find -P "$bundle" -type f -exec chmod 0600 -- {} +
while IFS= read -r entry; do
  read -r owner mode links < <(stat -c '%u:%g %a %h' -- "$entry")
  [[ "$owner" == '1000:1000' ]]
  if [[ -d "$entry" ]]; then [[ "$mode" == '700' ]]; else [[ "$mode" == '600' && "$links" == '1' ]]; fi
done < <(find -P "$bundle" -mindepth 0 -print)
printf '%s\n' '${SENTINEL}'
printf '%s\n' '{"schema":"${REMOTE_SCHEMA}","phase":"transfer","ok":true,"staging":"exact","release":"absent"}'
`;

const CLEANUP_PROGRAM = `#!/bin/bash
set -euo pipefail
bundle='/opt/zhenxing-ai/staging/community-production-r27-1b04aa02.bundle'
release='/opt/zhenxing-ai/releases/community-production-r27-1b04aa02'
[[ ! -e "$release" && ! -L "$release" ]]
if [[ -e "$bundle" || -L "$bundle" ]]; then
  [[ -d "$bundle" && ! -L "$bundle" && "$(realpath -e -- "$bundle")" == "$bundle" ]]
  [[ "$(dirname -- "$bundle")" == '/opt/zhenxing-ai/staging' && "$(stat -c '%u:%g' -- "$bundle")" == '1000:1000' ]]
  if find -P "$bundle" -mindepth 1 ! -type d ! -type f -print -quit | grep -q .; then exit 31; fi
  while IFS= read -r entry; do [[ "$(stat -c '%u:%g' -- "$entry")" == '1000:1000' ]]; done < <(find -P "$bundle" -mindepth 0 -print)
  find -P "$bundle" -depth -delete
fi
[[ ! -e "$bundle" && ! -L "$bundle" ]]
printf '%s\n' '${SENTINEL}'
printf '%s\n' '{"schema":"${REMOTE_SCHEMA}","phase":"cleanup","ok":true,"staging":"absent","release":"absent"}'
`;

const PREPARE_PROGRAM = `#!/bin/bash
set -euo pipefail
incoming='/opt/zhenxing-ai/staging/community-production-r27-1b04aa02.bundle'
release='/opt/zhenxing-ai/releases/community-production-r27-1b04aa02'
preparer="$incoming/payload/deployment/community-production/prepare-workflow-production-release.sh"
[[ -f "$preparer" && ! -L "$preparer" ]]
/bin/bash "$preparer" "$incoming" "$release" >/dev/null 2>/dev/null
printf '%s\n' '${SENTINEL}'
printf '%s\n' '{"schema":"${REMOTE_SCHEMA}","phase":"prepare","ok":true,"staging":"retained","release":"prepared","assetDockerWrite":true}'
`;

const VERIFY_PROGRAM = `#!/bin/bash
set -euo pipefail
release='/opt/zhenxing-ai/releases/community-production-r27-1b04aa02'
runtime="$release/.workflow-runtime/node-v24.18.1-linux-x64/bin/node"
helper="$release/deployment/community-production/workflow-node-runtime.sh"
verifier="$release/deployment/community-production/workflow-production-release-bundle.cjs"
/bin/bash "$helper" preflight >/dev/null 2>/dev/null
[[ -x "$runtime" && ! -L "$runtime" ]]
"$runtime" "$verifier" verify-prepared "$release" >/dev/null 2>/dev/null
printf '%s\n' '${SENTINEL}'
printf '%s\n' '{"schema":"${REMOTE_SCHEMA}","phase":"verify","ok":true,"release":"prepared"}'
`;

const RECEIPT_KEYS = Object.freeze({
  "dry-preflight": ["schema", "phase", "ok", "staging", "release"],
  transfer: ["schema", "phase", "ok", "staging", "release"],
  cleanup: ["schema", "phase", "ok", "staging", "release"],
  prepare: ["schema", "phase", "ok", "staging", "release", "assetDockerWrite"],
  verify: ["schema", "phase", "ok", "release"]
});
const REPORT_KEYS = Object.freeze(["schema", "status", "phase", "code", "candidate", "effects", "checks"]);
const EFFECT_KEYS = Object.freeze([
  "sshProcessStarts", "scpProcessStarts", "remoteConnections", "remoteWrites", "assetWrites",
  "assetDockerWrites", "productionDataWrites", "serviceChanges", "imageLoads", "launchCalls"
]);
const CHECK_KEYS = Object.freeze([
  "localBundleExact", "remotePathsExact", "transferComplete", "preparedExact", "cleanupExact", "secretValuesEmitted"
]);
const CODES = new Set([
  null,
  "R16_ASSET_LOCAL_AUTHORITY_FAILED",
  "R16_ASSET_LOCAL_CANDIDATE_DRIFT",
  "R16_ASSET_DRY_PREFLIGHT_FAILED",
  "R16_ASSET_TRANSFER_PREFLIGHT_FAILED",
  "R16_ASSET_TRANSFER_PARTIAL",
  "R16_ASSET_TRANSFER_VERIFY_FAILED",
  "R16_ASSET_PREPARE_FAILED",
  "R16_ASSET_VERIFY_FAILED"
]);

function fixedSshArgs() {
  return [
    ...SSH_OPTIONS,
    "-i", stage0.IDENTITY_FILE,
    "-o", `UserKnownHostsFile=${stage0.KNOWN_HOSTS_FILE}`,
    REMOTE_TARGET,
    "/usr/bin/sudo", "-n", "/usr/bin/env", "-i",
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL=C",
    "SUDO_UID=1000", "SUDO_GID=1000", "/bin/bash", "-s"
  ];
}

function fixedScpArgs() {
  return [
    "-q", "-r",
    "-o", "BatchMode=yes",
    "-o", "IdentitiesOnly=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", "ConnectionAttempts=1",
    "-o", "ControlMaster=no",
    "-o", "ClearAllForwardings=yes",
    "-i", stage0.IDENTITY_FILE,
    "-o", `UserKnownHostsFile=${stage0.KNOWN_HOSTS_FILE}`,
    BUNDLE_ROOT,
    `${REMOTE_TARGET}:${REMOTE_STAGING}`
  ];
}

function validateAuthority() {
  stage0.validateAuthority();
  const stat = fs.lstatSync(SCP_PATH);
  assert.equal(stat.isFile(), true);
  assert.equal(stat.isSymbolicLink(), false);
  assert.equal(path.resolve(fs.realpathSync(SCP_PATH)).toLowerCase(), path.resolve(SCP_PATH).toLowerCase());
  return true;
}

function verifyLocalBundle() {
  assert.equal(path.resolve(fs.realpathSync(BUNDLE_ROOT)), path.resolve(BUNDLE_ROOT));
  const modulePath = path.join(ROOT, "deployment", "community-production", "workflow-production-release-bundle.cjs");
  const receipt = require(modulePath).verifyWorkflowProductionReleaseBundle(BUNDLE_ROOT);
  for (const [key, value] of Object.entries(CANDIDATE)) assert.equal(receipt[key], value, `${key} drifted`);
  assert.equal(receipt.identitySourceDigest, "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7");
  assert.equal(receipt.identitySourceManifestSha256, "5d958a8afdfc70f09cb9ddd6df755bab09af62419c77d996dbb63a5743ddfff3");
  return CANDIDATE;
}

function parseRemoteReceipt(stdout, phase) {
  assert.equal(typeof stdout, "string");
  assert.equal(Buffer.byteLength(stdout) <= 16 * 1024, true);
  assert.equal(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(stdout), false);
  const lines = stdout.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  assert.equal(lines.length, 2);
  assert.equal(lines[0], SENTINEL);
  const value = JSON.parse(lines[1]);
  assert.deepEqual(Object.keys(value), RECEIPT_KEYS[phase]);
  assert.equal(value.schema, REMOTE_SCHEMA);
  assert.equal(value.phase, phase);
  assert.equal(value.ok, true);
  if (phase === "dry-preflight" || phase === "cleanup") {
    assert.equal(value.staging, "absent");
    assert.equal(value.release, "absent");
  } else if (phase === "transfer") {
    assert.equal(value.staging, "exact");
    assert.equal(value.release, "absent");
  } else if (phase === "prepare") {
    assert.equal(value.staging, "retained");
    assert.equal(value.release, "prepared");
    assert.equal(value.assetDockerWrite, true);
  } else if (phase === "verify") {
    assert.equal(value.release, "prepared");
  } else {
    throw new Error("invalid receipt phase");
  }
  return Object.freeze(value);
}

function validateReport(report) {
  assert.deepEqual(Object.keys(report), REPORT_KEYS);
  assert.equal(report.schema, REPORT_SCHEMA);
  assert.equal(["pass", "blocked"].includes(report.status), true);
  assert.equal(PHASES.includes(report.phase), true);
  assert.equal(CODES.has(report.code), true);
  assert.deepEqual(report.candidate, CANDIDATE);
  assert.deepEqual(Object.keys(report.effects), EFFECT_KEYS);
  assert.deepEqual(Object.keys(report.checks), CHECK_KEYS);
  for (const value of Object.values(report.effects)) assert.equal(Number.isInteger(value) && value >= 0 && value <= 4, true);
  for (const value of Object.values(report.checks)) assert.equal(typeof value, "boolean");
  assert.equal(report.effects.productionDataWrites, 0);
  assert.equal(report.effects.serviceChanges, 0);
  assert.equal(report.effects.imageLoads, 0);
  assert.equal(report.effects.launchCalls, 0);
  assert.equal(report.checks.secretValuesEmitted, false);
  const encoded = JSON.stringify(report);
  assert.equal(Buffer.byteLength(encoded) <= 4096, true);
  assert.equal(/(?:PRIVATE KEY|ssh-ed25519|stdout|stderr|stack|password|token|[A-Za-z]:\\|\/opt\/|admin@)/i.test(encoded), false);
  return Object.freeze(report);
}

function report(phase, status, code, effects, checks) {
  return validateReport({
    schema: REPORT_SCHEMA,
    status,
    phase,
    code,
    candidate: CANDIDATE,
    effects: Object.freeze({
      sshProcessStarts: 0,
      scpProcessStarts: 0,
      remoteConnections: 0,
      remoteWrites: 0,
      assetWrites: 0,
      assetDockerWrites: 0,
      productionDataWrites: 0,
      serviceChanges: 0,
      imageLoads: 0,
      launchCalls: 0,
      ...effects
    }),
    checks: Object.freeze({
      localBundleExact: false,
      remotePathsExact: false,
      transferComplete: false,
      preparedExact: false,
      cleanupExact: false,
      secretValuesEmitted: false,
      ...checks
    })
  });
}

function runRemote(program, phase, spawn) {
  const result = spawn(SSH_PATH, fixedSshArgs(), {
    input: Buffer.from(program, "utf8"),
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: phase === "prepare" ? 900_000 : 120_000,
    maxBuffer: 8 * 1024 * 1024
  });
  assert.equal(result?.error == null, true);
  assert.equal(result?.signal, null);
  assert.equal(result?.status, 0);
  assert.equal(result?.stderr, "");
  return parseRemoteReceipt(result.stdout, phase);
}

function runPhase(phase, dependencies = {}) {
  assert.equal(PHASES.includes(phase), true);
  const authority = dependencies.validateAuthority || validateAuthority;
  const localBundle = dependencies.verifyLocalBundle || verifyLocalBundle;
  const spawn = dependencies.spawnSync || childProcess.spawnSync;
  try { authority(); } catch { return report(phase, "blocked", "R16_ASSET_LOCAL_AUTHORITY_FAILED"); }
  try { assert.deepEqual(localBundle(), CANDIDATE); } catch { return report(phase, "blocked", "R16_ASSET_LOCAL_CANDIDATE_DRIFT"); }
  const localChecks = { localBundleExact: true };

  if (phase === "dry-preflight") {
    try {
      runRemote(DRY_PREFLIGHT_PROGRAM, "dry-preflight", spawn);
      return report(phase, "pass", null, { sshProcessStarts: 1, remoteConnections: 1 }, { ...localChecks, remotePathsExact: true });
    } catch {
      return report(phase, "blocked", "R16_ASSET_DRY_PREFLIGHT_FAILED", { sshProcessStarts: 1 }, localChecks);
    }
  }

  if (phase === "transfer") {
    try { runRemote(DRY_PREFLIGHT_PROGRAM, "dry-preflight", spawn); }
    catch { return report(phase, "blocked", "R16_ASSET_TRANSFER_PREFLIGHT_FAILED", { sshProcessStarts: 1 }, localChecks); }
    const scp = spawn(SCP_PATH, fixedScpArgs(), {
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 900_000,
      maxBuffer: 1024 * 1024
    });
    const scpOk = scp?.error == null && scp?.signal == null && scp?.status === 0 && scp?.stdout === "" && scp?.stderr === "";
    if (scpOk) {
      try {
        runRemote(TRANSFER_PROGRAM, "transfer", spawn);
        return report(phase, "pass", null, {
          sshProcessStarts: 2, scpProcessStarts: 1, remoteConnections: 3, remoteWrites: 1, assetWrites: 1
        }, { ...localChecks, remotePathsExact: true, transferComplete: true });
      } catch {
        let cleaned = false;
        try { runRemote(CLEANUP_PROGRAM, "cleanup", spawn); cleaned = true; } catch {}
        return report(phase, "blocked", "R16_ASSET_TRANSFER_VERIFY_FAILED", {
          sshProcessStarts: 3, scpProcessStarts: 1, remoteConnections: cleaned ? 3 : 2, remoteWrites: 1, assetWrites: 1
        }, { ...localChecks, remotePathsExact: true, cleanupExact: cleaned });
      }
    }
    let cleaned = false;
    try { runRemote(CLEANUP_PROGRAM, "cleanup", spawn); cleaned = true; } catch {}
    return report(phase, "blocked", "R16_ASSET_TRANSFER_PARTIAL", {
      sshProcessStarts: 2, scpProcessStarts: 1, remoteConnections: cleaned ? 2 : 1, remoteWrites: 1, assetWrites: 1
    }, { ...localChecks, remotePathsExact: true, cleanupExact: cleaned });
  }

  if (phase === "prepare") {
    try {
      runRemote(PREPARE_PROGRAM, "prepare", spawn);
      return report(phase, "pass", null, {
        sshProcessStarts: 1, remoteConnections: 1, remoteWrites: 1, assetWrites: 1, assetDockerWrites: 1
      }, { ...localChecks, remotePathsExact: true, transferComplete: true, preparedExact: true });
    } catch {
      return report(phase, "blocked", "R16_ASSET_PREPARE_FAILED", {
        sshProcessStarts: 1, remoteWrites: 1, assetWrites: 1, assetDockerWrites: 1
      }, localChecks);
    }
  }

  try {
    runRemote(VERIFY_PROGRAM, "verify", spawn);
    return report(phase, "pass", null, { sshProcessStarts: 1, remoteConnections: 1 }, {
      ...localChecks, remotePathsExact: true, transferComplete: true, preparedExact: true
    });
  } catch {
    return report(phase, "blocked", "R16_ASSET_VERIFY_FAILED", { sshProcessStarts: 1 }, localChecks);
  }
}

if (require.main === module) {
  const phase = process.argv.length === 3 ? process.argv[2] : "";
  const value = runPhase(phase);
  process.stdout.write(`${JSON.stringify(value)}\n`);
  if (value.status !== "pass") process.exitCode = 1;
}

module.exports = {
  BUNDLE_ROOT,
  CANDIDATE,
  CLEANUP_PROGRAM,
  DRY_PREFLIGHT_PROGRAM,
  INGRESS_PAYLOAD_VALIDATOR,
  PREPARE_PROGRAM,
  REMOTE_RELEASE,
  REMOTE_SCHEMA,
  REMOTE_STAGING,
  REMOTE_TARGET,
  SCP_PATH,
  SENTINEL,
  SSH_PATH,
  TRANSFER_PROGRAM,
  VERIFY_PROGRAM,
  fixedScpArgs,
  fixedSshArgs,
  parseRemoteReceipt,
  runPhase,
  validateAuthority,
  validateReport,
  verifyLocalBundle
};
