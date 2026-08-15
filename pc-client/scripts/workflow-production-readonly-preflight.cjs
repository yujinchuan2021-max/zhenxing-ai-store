"use strict";

// Local-only coordinator. It is intentionally excluded from the deployment
// manifest and never transfers, prepares, loads, mutates, or launches anything.
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { verifyWorkflowProductionReleaseBundle } = require("../deployment/community-production/workflow-production-release-bundle.cjs");
const { PROJECT, SERVICES, validateProductionServices } = require("../deployment/community-production/workflow-production-service-contract.cjs");

const SCHEMA = "aihub-workflow-production-readonly-preflight-v3";
const PHASE1_SCHEMA = "aihub-workflow-production-readonly-pretransfer-v1";
const PHASE2_SCHEMA = "aihub-workflow-production-readonly-postprepare-v1";
const PHASE2_FAILURE_SCHEMA = "aihub-workflow-production-readonly-postprepare-failure-v1";
const MAX_OUTPUT_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const TERMINATION_TIMEOUT_MS = 2_000;
const WORKSPACE = path.resolve(__dirname, "..");
const LOCAL_BUNDLE_ROOT = path.join(WORKSPACE, "output", "workflow-production-r11-2a114734-20260810-v2.bundle");
const SSH_PATH = process.platform === "win32"
  ? "C:\\Windows\\System32\\OpenSSH\\ssh.exe"
  : "/usr/bin/ssh";
const IDENTITY_FILE = path.join(os.homedir(), ".ssh", "zhenxingai_deploy_ed25519");
const KNOWN_HOSTS_FILE = path.join(os.homedir(), ".ssh", "known_hosts");
const WINDOWS_POWERSHELL = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const RUN_ID = "workflow-production-r11";
const CONTROL_ROOT = `/opt/zhenxing-ai/shared/${RUN_ID}`;
const UNIT = "zhenxing-ai-workflow-production-r11.service";
const PHASE1_RECEIPT = "aihub-r11-pretransfer-remote-v1";
const PHASE2_RECEIPT = "aihub-r11-postprepare-remote-v1";
const PHASE2_FAILURES = Object.freeze({
  "prepared-runtime": "PREPARED_RUNTIME_INVALID",
  "service-baseline": "SERVICE_BASELINE_INVALID",
  "source-post-https": "SOURCE_POST_HTTPS_INVALID",
  catalog: "CATALOG_INVALID",
  database: "DATABASE_INVALID",
  capability: "CAPABILITY_INVALID",
  "public-list-https": "PUBLIC_LIST_HTTPS_INVALID",
  "secret-authority": "SECRET_AUTHORITY_INVALID",
  "retained-verifier": "RETAINED_VERIFIER_INVALID"
});
const REMOTE_USER = "admin";
const REMOTE_HOST = "47.236.62.189";
const REMOTE_RELEASE_PATTERN = /^\/opt\/zhenxing-ai\/releases\/community-production-r11-[A-Za-z0-9][A-Za-z0-9-]{5,64}$/;
const SSH_OPTIONS = Object.freeze([
  "-T", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes",
  "-o", "StrictHostKeyChecking=yes", "-o", "ConnectionAttempts=1",
  "-o", "ControlMaster=no", "-o", "ClearAllForwardings=yes"
]);
const ZERO_EFFECTS = Object.freeze({
  remoteWrites: 0,
  assetWrites: 0,
  productionDataWrites: 0,
  imageLoads: 0,
  serviceMutations: 0,
  catalogMutations: 0,
  databaseMutations: 0,
  launchCalls: 0
});
const SENSITIVE = /(?:authorization|bearer|password|secret(?:value|hash)|token|cookie|dsn|stack|sql|env|container(?:name)?|workflowId|identityId|reviewerId|publisherId|discussionId|postId|https?:\/\/|127\.0\.0\.1)/i;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filename) {
  return sha256(fs.readFileSync(filename));
}

function exactObject(value, keys) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function safeJson(value) {
  const encoded = JSON.stringify(value);
  if (SENSITIVE.test(encoded) || Buffer.byteLength(encoded) > MAX_OUTPUT_BYTES) {
    throw new Error("unsafe report");
  }
  return encoded;
}

function effects(phase, connections, starts, preparedAssetsRetained) {
  return {
    ...ZERO_EFFECTS,
    remoteConnections: connections,
    sshProcessStarts: starts,
    preparedAssetsRetained
  };
}

function blocked(phase, stage, code, connections = 0, starts = 0) {
  const value = {
    schema: SCHEMA,
    status: "blocked",
    phase,
    stage,
    code,
    ...effects(phase, connections, starts, phase === "post-prepare")
  };
  safeJson(value);
  return Object.freeze(value);
}

function readWindowsAuthorityMetadata(filename) {
  const program = String.raw`$ErrorActionPreference='Stop';$p=$env:AIHUB_AUTHORITY_FILE;$i=Get-Item -LiteralPath $p -Force;$a=Get-Acl -LiteralPath $p;$rules=@($a.Access|ForEach-Object{[ordered]@{identity=$_.IdentityReference.Value;type=$_.AccessControlType.ToString();rights=$_.FileSystemRights.ToString()}});[ordered]@{path=$i.FullName;owner=$a.Owner;rules=$rules}|ConvertTo-Json -Compress -Depth 5`;
  const result = spawnSync(WINDOWS_POWERSHELL, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", program], {
    encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024, env: { SystemRoot: process.env.SystemRoot, AIHUB_AUTHORITY_FILE: filename }
  });
  if (result.status !== 0 || result.error || result.stderr) throw new Error("authority metadata unavailable");
  const acl = JSON.parse(result.stdout);
  const stat = fs.lstatSync(filename);
  return {
    canonical: fs.realpathSync(filename),
    regular: stat.isFile(),
    symlink: stat.isSymbolicLink(),
    nlink: stat.nlink,
    owner: acl.owner,
    rules: Array.isArray(acl.rules) ? acl.rules : acl.rules ? [acl.rules] : []
  };
}

function readPosixAuthorityMetadata(filename) {
  const stat = fs.lstatSync(filename);
  return {
    canonical: fs.realpathSync(filename), regular: stat.isFile(), symlink: stat.isSymbolicLink(),
    nlink: stat.nlink, uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o777
  };
}

function hasUnsafeWindowsWrite(metadata, allowedWriters) {
  const write = /(?:FullControl|Modify|Write|CreateFiles|CreateDirectories|AppendData|Delete|ChangePermissions|TakeOwnership)/i;
  return metadata.rules.some((rule) => rule.type === "Allow" && write.test(rule.rights) && !allowedWriters.has(String(rule.identity).toLowerCase()));
}

function validateTransportAuthority(options = {}) {
  const reader = options.metadataReader || (process.platform === "win32" ? readWindowsAuthorityMetadata : readPosixAuthorityMetadata);
  const expected = [SSH_PATH, IDENTITY_FILE, KNOWN_HOSTS_FILE];
  const values = expected.map((filename) => {
    if (!path.isAbsolute(filename) || !fs.existsSync(filename)) throw new Error("transport authority is invalid");
    return reader(filename);
  });
  for (let index = 0; index < values.length; index += 1) {
    const metadata = values[index];
    if (path.resolve(metadata.canonical).toLowerCase() !== path.resolve(expected[index]).toLowerCase() || !metadata.regular || metadata.symlink) {
      throw new Error("transport authority is invalid");
    }
  }
  if (values[1].canonical.toLowerCase() === values[2].canonical.toLowerCase()) throw new Error("transport authority is invalid");
  if (process.platform === "win32" || options.platform === "win32") {
    const username = String(options.username || os.userInfo().username).toLowerCase();
    if (values[0].nlink < 1 || !/trustedinstaller$/i.test(values[0].owner) || hasUnsafeWindowsWrite(values[0], new Set(["nt service\\trustedinstaller"]))) {
      throw new Error("transport authority is invalid");
    }
    const allowed = new Set(["nt authority\\system", "builtin\\administrators"]);
    for (const metadata of values.slice(1)) {
      const owner = String(metadata.owner).toLowerCase();
      if (metadata.nlink !== 1 || !(owner === username || owner.endsWith(`\\${username}`))) throw new Error("transport authority is invalid");
      const allowedWriters = new Set([...allowed, owner]);
      if (hasUnsafeWindowsWrite(metadata, allowedWriters)) throw new Error("transport authority is invalid");
    }
  } else {
    const uid = process.getuid();
    if (values[0].mode !== 0o755 || values[0].nlink !== 1 || values[0].uid !== 0 ||
        values.slice(1).some((entry) => entry.mode !== 0o600 || entry.nlink !== 1 || entry.uid !== uid)) {
      throw new Error("transport authority is invalid");
    }
  }
  return true;
}

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function loadLocalCandidate(bundleRoot = LOCAL_BUNDLE_ROOT) {
  if (path.resolve(bundleRoot) !== path.resolve(LOCAL_BUNDLE_ROOT) || !fs.existsSync(bundleRoot) ||
      !fs.lstatSync(bundleRoot).isDirectory() || fs.lstatSync(bundleRoot).isSymbolicLink()) {
    throw new Error("local candidate bundle is invalid");
  }
  const root = fs.realpathSync(bundleRoot);
  const closure = verifyWorkflowProductionReleaseBundle(root);
  const bundlePath = path.join(root, ".aihub-workflow-release-bundle.json");
  const identityPath = path.join(root, ".aihub-identity-source-manifest.json");
  const existingPath = path.join(root, "payload", "deployment", "community-production", "workflow-production-existing-state.cjs");
  const sourcePostPath = path.join(root, "payload", "community", "workflow-official-source-posts.cjs");
  const bundle = readJson(bundlePath);
  const identity = readJson(identityPath);
  if (bundle?.format !== "aihub-workflow-production-release-bundle-v1" || bundle.candidateOnly !== true ||
      bundle.publishable !== false || bundle.deployment?.setDigest !== closure.deploymentSetDigest ||
      bundle.deployment?.manifestSha256 !== closure.deploymentManifestSha256 ||
      bundle.payload?.digest !== closure.payloadDigest ||
      bundle.identity?.sourceDigest !== identity?.digest?.sha256 ||
      bundle.identity?.sourceManifestSha256 !== sha256(Buffer.from(`${JSON.stringify(identity, null, 2)}\n`, "utf8")) ||
      bundle.identity?.sourceDigest !== "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7" ||
      sha256File(sourcePostPath) !== "a069520aff7b98806744841ab54212d7c193c5df1123e371fdc0d478c78e2fe6" ||
      sha256File(existingPath) !== "70fab968a12550e65fe30985e31609675d105bcfc422513ad5b44c0c9d9f0bdf") {
    throw new Error("local candidate closure drifted");
  }
  return Object.freeze({
    ...closure,
    identitySourceDigest: bundle.identity.sourceDigest,
    identitySourceManifestSha256: bundle.identity.sourceManifestSha256,
    existingStateVerifierSha256: sha256File(existingPath),
    sourcePostModuleSha256: sha256File(sourcePostPath)
  });
}

function createPhase1Program() {
  return [
    "#!/bin/bash",
    "set -euo pipefail",
    "export LC_ALL=C",
    "[[ \"$(/usr/bin/uname -s)\" == Linux ]]",
    "[[ \"$(/usr/bin/uname -m)\" == x86_64 ]]",
    "[[ \"$(/usr/bin/id -u)\" == 1000 && \"$(/usr/bin/id -g)\" == 1000 ]]",
    "/usr/bin/docker --version >/dev/null",
    "/usr/bin/docker version --format '{{.Server.Version}}' >/dev/null",
    "/usr/bin/docker compose version --short >/dev/null",
    "[[ \"$(/bin/df -Pk /opt/zhenxing-ai | /usr/bin/awk 'NR==2{print $4}')\" -ge 4194304 ]]",
    `control_root=${JSON.stringify(CONTROL_ROOT)}`,
    "for target in \"$control_root\" \"$control_root/status.json\" \"$control_root/receipt.json\" \"$control_root/request.json\" \"$control_root/environment.sh\"; do [[ ! -e \"$target\" && ! -L \"$target\" ]]; done",
    "[[ ! -e /opt/zhenxing-ai/shared/backups/workflow-production-r11-evidence ]]",
    "[[ -z \"$(/usr/bin/find /opt/zhenxing-ai/releases /opt/zhenxing-ai/staging -maxdepth 1 -name 'community-production-r11-*' -print -quit 2>/dev/null)\" ]]",
    `unit_state=$(/usr/bin/systemctl show --property=LoadState --property=ActiveState --property=SubState ${UNIT} 2>/dev/null)`,
    "[[ \"$(printf '%s\\n' \"$unit_state\" | /usr/bin/awk 'NF{count++} END{print count+0}')\" == 3 ]]",
    "[[ \"$(printf '%s\\n' \"$unit_state\" | /usr/bin/grep -c '^LoadState=not-found$')\" == 1 ]]",
    "[[ \"$(printf '%s\\n' \"$unit_state\" | /usr/bin/grep -c '^ActiveState=inactive$')\" == 1 ]]",
    "[[ \"$(printf '%s\\n' \"$unit_state\" | /usr/bin/grep -c '^SubState=dead$')\" == 1 ]]",
    "! /usr/bin/pgrep -f '[w]orkflow-production-(cutover|cutover-launcher)' >/dev/null 2>&1",
    "services=(admin identity-database identity community-database community caddy)",
    "names=(zhenxing-community-production-admin-1 zhenxing-community-production-identity-database-1 zhenxing-community-production-identity-1 zhenxing-community-production-community-database-1 zhenxing-community-production-community-1 zhenxing-community-production-caddy-1)",
    "images=(zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9 'postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193' zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392 'mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4' zhenxing-ai/flarum:community-candidate-8b13962a36bf 'caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d')",
    "image_ids=('sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2' '' 'sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567' '' '' '')",
    "for i in \"${!names[@]}\"; do",
    "  [[ \"$(/usr/bin/docker inspect --format '{{.State.Health.Status}}' \"${names[$i]}\")\" == healthy ]]",
    "  [[ \"$(/usr/bin/docker inspect --format '{{.Config.Image}}' \"${names[$i]}\")\" == \"${images[$i]}\" ]]",
    "  [[ -z \"${image_ids[$i]}\" || \"$(/usr/bin/docker inspect --format '{{.Image}}' \"${names[$i]}\")\" == \"${image_ids[$i]}\" ]]",
    "done",
    `printf '%s' '{"schema":"${PHASE1_SCHEMA}","receipt":"${PHASE1_RECEIPT}","linux":true,"x64":true,"remoteIdentityExact":true,"diskSufficient":true,"r11TargetsAbsent":true,"r11UnitAbsent":true,"r11UnitStateExact":true,"r11ProcessesAbsent":true,"concurrentCutovers":0,"serviceCount":6,"healthyServices":6,"oldImagesExact":true,"dockerClient":true,"dockerDaemon":true,"compose":true}'`,
    ""
  ].join("\n");
}

function validateAbsentSystemdUnit(text) {
  if (typeof text !== "string") throw new Error("systemd unit state is invalid");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length !== 3 || new Set(lines).size !== 3 ||
      !lines.includes("LoadState=not-found") ||
      !lines.includes("ActiveState=inactive") ||
      !lines.includes("SubState=dead")) {
    throw new Error("systemd unit state is invalid");
  }
  return true;
}

function validateServiceBaseline(inspectAll) {
  return validateProductionServices(inspectAll, "baseline");
}

function validateCatalogBaseline({ v1Channel, v1Release, v2Channel, v2Release } = {}) {
  const exactRelease = (channel, release, contract) => {
    if (channel?.activeCatalogVersion !== contract.version || channel?.activeRelease?.releaseId !== contract.id ||
        release?.release?.releaseId !== contract.id || release?.release?.catalogVersion !== contract.version ||
        release?.envelope?.payload?.releaseId !== contract.id || release?.envelope?.payload?.catalogVersion !== contract.version ||
        release?.envelope?.payload?.catalogSha256 !== contract.catalogSha256) throw new Error("signed catalog baseline is invalid");
  };
  exactRelease(v2Channel, v2Release, {
    id: "catalog-v00000006-567e671621f1-3dcee587", version: 6,
    catalogSha256: "567e671621f14d7788ecdbe642be738aa5133d9688d45bbae4d0f7760a926d9f"
  });
  exactRelease(v1Channel, v1Release, {
    id: "catalog-v00000072-e286516335da-a8b62a49", version: 72,
    catalogSha256: "e286516335da9272ce42902008c5f9016fdc444a42d988de2b22d8550a73f5ff"
  });
  return true;
}

function validSecretBytes(name, bytes) {
  if (!Buffer.isBuffer(bytes)) return false;
  if (name === "forum_api_key") {
    if (bytes.length !== 65 || bytes[64] !== 10) return false;
    const body = bytes.subarray(0, 64);
    return body.every((byte) => byte >= 0x21 && byte <= 0x7e && byte !== 0x3b);
  }
  if (name === "community_cms_gateway") {
    return bytes.length === 64 &&
      bytes.every((byte) => (byte >= 0x30 && byte <= 0x39) || (byte >= 0x61 && byte <= 0x66));
  }
  const maximum = ["forum_db_password", "forum_db_root_password", "forum_admin_password", "forum_password_token"].includes(name) ? 4096 : 512;
  const rawMaximum = maximum === 4096 ? 4096 : 513;
  const body = bytes.at(-1) === 10 ? bytes.subarray(0, -1) : bytes;
  if (body.length < 32 || body.length > maximum || bytes.length > rawMaximum) return false;
  return body.every((byte) => byte >= 0x21 && byte <= 0x7e && byte !== 0x3b);
}

function secretMountFor(inspect, destination) {
  const mounts = (inspect?.Mounts || []).filter((mount) => mount.Destination === destination);
  if (mounts.length !== 1 || mounts[0].Type !== "bind" || mounts[0].RW !== false || typeof mounts[0].Source !== "string") {
    throw new Error("secret mount is invalid");
  }
  return mounts[0];
}

function validatePublishedCatalogMount({ inspect, fsImpl }) {
  const mounts = (inspect?.Mounts || []).filter((mount) => mount.Destination === "/app/admin/published");
  if (mounts.length !== 1 || mounts[0].Type !== "bind" || mounts[0].RW !== true || typeof mounts[0].Source !== "string" || !mounts[0].Source.startsWith("/")) {
    throw new Error("published catalog mount is invalid");
  }
  const source = mounts[0].Source;
  const canonical = fsImpl.realpathSync(source);
  const stat = fsImpl.lstatSync(source);
  if (canonical !== source || !stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 1000 || stat.gid !== 1000 ||
      (stat.mode & 0o777) !== 0o755 || !Number.isSafeInteger(stat.nlink) || stat.nlink < 2) {
    throw new Error("published catalog authority is invalid");
  }
  return source;
}

function validateSecretSnapshot({ inspectAll, fsImpl }) {
  const fail = () => { throw new Error("secret authority is invalid"); };
  const expected = Object.freeze({
    identity_db_password: ["identityDatabase", "identity"],
    forum_db_password: ["communityDatabase", "community"],
    forum_db_root_password: ["communityDatabase"],
    forum_admin_password: ["community"],
    forum_api_key: ["community"],
    forum_password_token: ["community"],
    community_internal: ["identity", "community"],
    community_management: ["admin", "community"],
    community_cms_gateway: ["admin"],
    workflow_review_secret: []
  });
  let metadataCount = 0;
  let consumerCount = 0;
  const sources = {};
  for (const [name, expectedConsumers] of Object.entries(expected)) {
    const actualConsumers = [];
    let source = null;
    for (const [service, inspect] of Object.entries(inspectAll)) {
      const mounts = (inspect?.Mounts || []).filter((mount) => mount.Destination === `/run/secrets/${name}`);
      if (mounts.length > 1) fail();
      if (mounts.length === 1) {
        if (mounts[0].Type !== "bind" || mounts[0].RW !== false || typeof mounts[0].Source !== "string") fail();
        actualConsumers.push(service);
        if (source !== null && source !== mounts[0].Source) fail();
        source = mounts[0].Source;
      }
    }
    if (JSON.stringify(actualConsumers.sort()) !== JSON.stringify([...expectedConsumers].sort())) fail();
    consumerCount += actualConsumers.length;
    if (expectedConsumers.length === 0) continue;
    sources[name] = source;
  }
  const roots = new Set(Object.values(sources).map((source) => path.posix.dirname(source)));
  if (roots.size !== 1) fail();
  const authorityRoot = [...roots][0];
  const root = fsImpl.realpathSync(authorityRoot);
  const rootStat = fsImpl.lstatSync(authorityRoot);
  if (root !== authorityRoot || !rootStat.isDirectory() || rootStat.isSymbolicLink() || rootStat.uid !== 1000 || rootStat.gid !== 1000 || (rootStat.mode & 0o777) !== 0o700) fail();
  for (const [name, source] of Object.entries(sources)) {
    const canonical = fsImpl.realpathSync(source);
    const stat = fsImpl.lstatSync(source);
    if (canonical !== `${authorityRoot}/${name}` || source !== canonical ||
        !stat.isFile() || stat.isSymbolicLink() || stat.uid !== 1000 || stat.gid !== 1000 || (stat.mode & 0o777) !== 0o600 || stat.nlink !== 1 ||
        !validSecretBytes(name, fsImpl.readFileSync(source))) fail();
    metadataCount += 1;
  }
  const caddyMounts = inspectAll.caddy?.Mounts || [];
  const caddyDerived = caddyMounts.filter((mount) => mount.Destination === "/run/aihub-caddy-secret" && mount.Type === "volume" && mount.RW === false).length === 1 &&
    !caddyMounts.some((mount) => mount.Destination.startsWith("/run/secrets/"));
  if (!caddyDerived) fail();
  return Object.freeze({ metadataCount, consumerCount, consumersExact: true, caddyDerived: true });
}

function phase2RemoteMain() {
  "use strict";
  const cp = require("node:child_process");
  const crypto = require("node:crypto");
  const fs = require("node:fs");
  const https = require("node:https");
  const path = require("node:path");
  let stage = "prepared-runtime";
  const phaseFailure = (failureStage) => Object.freeze({ phase2Failure: true, stage: failureStage, code: PHASE2_FAILURES[failureStage] });
  const guard = (failureStage, promise) => Promise.resolve(promise).catch(() => { throw phaseFailure(failureStage); });
  const run = async () => { try {
  const releaseInput = process.argv[2];
  const releasePattern = /^\/opt\/zhenxing-ai\/releases\/community-production-r11-[A-Za-z0-9][A-Za-z0-9-]{5,64}$/;
  const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  const fail = () => { throw new Error("post-prepare preflight failed"); };
  if (!releasePattern.test(releaseInput || "")) fail();
  const release = fs.realpathSync(releaseInput);
  if (release !== releaseInput || fs.lstatSync(release).isSymbolicLink()) fail();
  const deployment = path.join(release, "deployment", "community-production");
  const runtime = path.join(release, ".workflow-runtime", "node-v24.18.1-linux-x64", "bin", "node");
  if (process.execPath !== runtime || process.env.NODE_PATH !== undefined || process.env.NODE_OPTIONS !== undefined) fail();
  const localRequire = (relative) => {
    const target = path.join(release, relative);
    const resolved = require.resolve(target);
    if (!resolved.startsWith(`${release}${path.sep}`) || fs.realpathSync(resolved) !== resolved) fail();
    return require(resolved);
  };
  const bundleModule = localRequire("deployment/community-production/workflow-production-release-bundle.cjs");
  const existing = localRequire("deployment/community-production/workflow-production-existing-state.cjs");
  const sourcePostsModule = localRequire("community/workflow-official-source-posts.cjs");
  const productionBootstrap = localRequire("identity/workflow-official-bootstrap-production.cjs");
  const { createReleaseStore } = localRequire("admin/release-store.cjs");
  const marker = bundleModule.verifyPreparedRelease(release);
  const helper = path.join(deployment, "workflow-node-runtime.sh");
  const helperProgram = "set -euo pipefail\nsource \"$1\"\nworkflow_node_paths\nworkflow_node_validate_installed\n[[ \"$workflow_node_binary\" == \"$2\" ]]\n";
  const helperResult = cp.spawnSync("/bin/bash", ["-s", "--", helper, runtime], {
    input: helperProgram, encoding: "utf8", maxBuffer: 65536,
    env: { LC_ALL: "C" }
  });
  if (helperResult.status !== 0 || helperResult.error || helperResult.stdout || helperResult.stderr) fail();
  stage = "service-baseline";
  const containers = Object.freeze({
    admin: "zhenxing-community-production-admin-1",
    identityDatabase: "zhenxing-community-production-identity-database-1",
    identity: "zhenxing-community-production-identity-1",
    communityDatabase: "zhenxing-community-production-community-database-1",
    community: "zhenxing-community-production-community-1",
    caddy: "zhenxing-community-production-caddy-1"
  });
  const docker = (args) => {
    if (!Array.isArray(args) || !["inspect", "exec"].includes(args[0])) fail();
    const result = cp.spawnSync("/usr/bin/docker", args, { encoding: "utf8", maxBuffer: 512 * 1024, env: { LC_ALL: "C" } });
    if (result.status !== 0 || result.error || result.stderr) fail();
    return String(result.stdout || "").trim();
  };
  const inspectAll = Object.fromEntries(Object.entries(containers).map(([name, container]) => {
    const value = JSON.parse(docker(["inspect", container]));
    if (!Array.isArray(value) || value.length !== 1) fail();
    return [name, value[0]];
  }));
  validateServiceBaseline(inspectAll);
  stage = "source-post-https";
  const envValue = (inspect, key) => {
    const values = (inspect?.Config?.Env || []).filter((entry) => entry.startsWith(`${key}=`));
    if (values.length !== 1) fail();
    return values[0].slice(key.length + 1);
  };
  const mainPublicHost = envValue(inspectAll.caddy, "AIHUB_PUBLIC_HOST");
  const communityPublicHost = envValue(inspectAll.caddy, "AIHUB_COMMUNITY_PUBLIC_HOST");
  const validPublicHost = (value) => /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])$/i.test(value);
  if (!validPublicHost(mainPublicHost) || !validPublicHost(communityPublicHost) || mainPublicHost === communityPublicHost) fail();
  const requestHttps = ({ publicHost, method, path: requestPath, headers = {} }) => new Promise((resolve, reject) => {
    if ((publicHost !== mainPublicHost && publicHost !== communityPublicHost) || method !== "GET" || !requestPath.startsWith("/")) fail();
    const request = https.request({
      host: "127.0.0.1", port: 443, servername: publicHost, method: "GET", path: requestPath,
      headers: { ...headers, Host: publicHost }, agent: false, rejectUnauthorized: true
    }, (response) => {
      const chunks = []; let bytes = 0;
      response.on("data", (chunk) => { bytes += chunk.length; if (bytes > 1024 * 1024) response.destroy(); else chunks.push(chunk); });
      response.on("end", () => {
        if (bytes > 1024 * 1024 || response.headers.location) return reject(new Error("response"));
        let value = null;
        try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return reject(new Error("response")); }
        resolve({ status: response.statusCode, value });
      });
    });
    request.setTimeout(10_000, () => request.destroy(new Error("timeout")));
    request.on("error", reject); request.end();
  });
  const forumMount = secretMountFor(inspectAll.community, "/run/secrets/forum_api_key");
  const forumApi = fs.readFileSync(forumMount.Source);
  const apiKey = productionBootstrap.parseForumApiKeyFile(forumApi.toString("utf8"));
  const allowedSourcePath = /^\/api\/(?:discussions\?filter%5Bq%5D=AIHUBWFOS(?:CHATGPTDESKTOP|CODEXCLIREVIEW|CLAUDEDESKTOP)V1&page%5Blimit%5D=20|posts\/[1-9][0-9]{0,9})$/;
  const requestFlarum = async (request) => {
    if (!exact(request, ["method", "path"]) || request.method !== "GET" || !allowedSourcePath.test(request.path) || Object.hasOwn(request, "body")) fail();
    const original = new URL(request.path, "http://127.0.0.1");
    if (original.origin !== "http://127.0.0.1" || original.username || original.password || original.hash) fail();
    const response = await requestHttps({ publicHost: communityPublicHost, method: "GET", path: `${original.pathname}${original.search}`, headers: { Accept: "application/vnd.api+json", Authorization: `Token ${apiKey}; userId=1` } });
    return { status: response.status, value: response.value };
  };
  const manifest = sourcePostsModule.validateOfficialSourcePostManifest(JSON.parse(fs.readFileSync(path.join(release, "community", "workflow-official-source-posts-candidate.json"), "utf8")));
  const sourceItemsPromise = guard("source-post-https", sourcePostsModule.readExistingOfficialSourcePosts({ manifest, requestFlarum }));
  stage = "catalog";
  const publishedSource = validatePublishedCatalogMount({ inspect: inspectAll.admin, fsImpl: fs });
  const catalogStore = createReleaseStore({
    rootDirectory: path.join(publishedSource, "catalog-store"),
    signingKeyProvider: async () => { throw new Error("readonly"); }
  });
  const catalogPromise = guard("catalog", Promise.resolve().then(() => Promise.all([catalogStore.readChannel("v1"), catalogStore.readChannel("v2")])).then(async ([v1Channel, v2Channel]) => {
    if (!v1Channel?.activeRelease?.releaseId || !v2Channel?.activeRelease?.releaseId) fail();
    const [v1Release, v2Release] = await Promise.all([
      catalogStore.readRelease(v1Channel.activeRelease.releaseId, { channel: "v1" }),
      catalogStore.readRelease(v2Channel.activeRelease.releaseId, { channel: "v2" })
    ]);
    validateCatalogBaseline({ v1Channel, v1Release, v2Channel, v2Release });
    return true;
  }));
  stage = "database";
  const phpMarkerProgram = "$c=require('/var/lib/flarum/config.php');$p=new PDO('mysql:host=community-database;dbname=aihub_forum;charset=utf8mb4',$c['database']['username'],$c['database']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$p->exec('SET SESSION TRANSACTION READ ONLY');echo $p->query(\"SELECT COUNT(*) FROM discussions WHERE title LIKE '% [AIHUBWFOS%V1]'\")->fetchColumn();";
  const markerCount = Number(docker(["exec", containers.community, "php", "-r", phpMarkerProgram]));
  if (markerCount !== 3) fail();
  const pgSql = `BEGIN READ ONLY; SELECT json_build_object(
 'schemaState','present|present|present','appendOnlyTriggers',(SELECT count(*)::int FROM pg_trigger WHERE tgname='community_workflow_events_append_only' AND NOT tgisinternal),'eventHeadRows',(SELECT count(*)::int FROM community_workflow.event_head WHERE singleton=true),'eventHead',(SELECT last_sequence::int FROM community_workflow.event_head WHERE singleton=true),
 'reviewerExact',(SELECT count(*)::int FROM public.users WHERE id='5f16d5ac-6663-5905-b920-c2140ac6769c' AND identity_kind='workflow-reviewer-service' AND status='disabled' AND email IS NULL AND normalized_email IS NULL AND phone IS NULL AND normalized_phone IS NULL AND password_hash IS NULL),
 'reviewerForbiddenRelations',(SELECT count(*)::int FROM public.community_profiles WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c')+(SELECT count(*)::int FROM public.profile_avatars WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c')+(SELECT count(*)::int FROM public.devices WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c')+(SELECT count(*)::int FROM public.sessions WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c')+(SELECT count(*)::int FROM public.community_handoffs WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c')+(SELECT count(*)::int FROM public.email_change_challenges WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c'),
 'publisherExact',(SELECT count(*)::int FROM public.users WHERE id='46564566-f5f4-599c-8ce5-0609069f5148' AND identity_kind='workflow-official-publisher-service' AND status='disabled' AND email IS NULL AND normalized_email IS NULL AND phone IS NULL AND normalized_phone IS NULL AND password_hash IS NULL),
 'publisherForbiddenRelations',(SELECT count(*)::int FROM public.community_profiles WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148')+(SELECT count(*)::int FROM public.profile_avatars WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148')+(SELECT count(*)::int FROM public.devices WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148')+(SELECT count(*)::int FROM public.sessions WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148')+(SELECT count(*)::int FROM public.community_handoffs WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148')+(SELECT count(*)::int FROM public.email_change_challenges WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148'),
  'officialSourceMarkerDiscussions',${markerCount},'events',COALESCE((SELECT json_agg(json_build_object('sequence',e.sequence::int,'operation',e.operation,'actorIdentityId',e.actor_identity_id::text,'eventData',e.event_data,'timestampExact',e.created_at=(e.event_data->>'at')::timestamptz) ORDER BY e.sequence) FROM community_workflow.events e),'[]'::json),'idempotency',COALESCE((SELECT json_agg(json_build_object('actorIdentityId',i.actor_identity_id::text,'keyHash',i.key_hash::text,'requestHash',i.request_hash::text,'response',i.response,'eventSequence',i.event_sequence::int) ORDER BY i.event_sequence) FROM community_workflow.idempotency i),'[]'::json))::text; COMMIT;`;
  const database = JSON.parse(docker(["exec", containers.identityDatabase, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", "-U", "aihub", "-d", "aihub", "-c", pgSql]).split(/\r?\n/).find((line) => line.startsWith("{")) || "null");
  stage = "capability";
  const capabilityProgram = "const http=require('http');const r=http.get({host:'127.0.0.1',port:4180,path:'/v1/owner/submissions/capability',agent:false},x=>{const a=[];x.on('data',v=>a.push(v));x.on('end',()=>process.stdout.write(JSON.stringify({status:x.statusCode,body:JSON.parse(Buffer.concat(a))}))) });r.setTimeout(10000,()=>r.destroy());r.on('error',()=>process.exit(2));";
  const capability = JSON.parse(docker(["exec", containers.identity, "node", "-e", capabilityProgram]));
  stage = "public-list-https";
  const publicPromise = guard("public-list-https", requestHttps({ publicHost: mainPublicHost, method: "GET", path: "/v1/community/workflow-store/public/list?limit=50" }));
  stage = "secret-authority";
  const secretSnapshot = validateSecretSnapshot({ inspectAll, fsImpl: fs });
  const [sourceItems, publicList] = await Promise.all([sourceItemsPromise, publicPromise, catalogPromise]);
    const sourcePosts = { schema: "aihub-workflow-official-source-post-readback-v1", status: "pass", checkedKeys: manifest.posts.map((post) => post.key), sourcePostCount: sourceItems.length, items: sourceItems };
    stage = "capability";
    if (capability.status !== 200 || !exact(capability.body, ["enabled", "schemaVersion", "execution", "workflowSubmissionLookup"]) || capability.body.enabled !== false || capability.body.schemaVersion !== 1 || capability.body.execution !== false || capability.body.workflowSubmissionLookup !== false) fail();
    stage = "public-list-https";
    if (publicList.status !== 503 || !exact(publicList.value, ["error"]) || !exact(publicList.value.error, ["code", "messageKey"]) || publicList.value.error.code !== "FEATURE_DISABLED" || publicList.value.error.messageKey !== "workflow.public.unavailable") fail();
    stage = "retained-verifier";
    const retained = await guard("retained-verifier", Promise.resolve().then(() => existing.verifyExistingWorkflowState({ database, identityInspect: [inspectAll.identity], sourcePosts })));
    const output = {
      schema: "aihub-workflow-production-readonly-postprepare-v1",
      receipt: PHASE2_RECEIPT,
      candidate: { deploymentSetDigest: marker.deploymentSetDigest, deploymentManifestSha256: marker.deploymentManifestSha256, payloadDigest: marker.payloadDigest, identitySourceDigest: marker.identitySourceDigest },
      prepared: { verified: true, runtimeExact: true, modulesSameRelease: true },
      retained: { baseline: retained.baseline, events: retained.events, idempotency: retained.idempotency, eventHead: retained.eventHead, idempotentReplay: retained.idempotentReplay, sourcePosts: retained.sourcePostsExact },
      capabilityDisabledExact: true, publicFeatureDisabledExact: true,
      launchBaselineExact: true, catalogV2SignedExact: true, catalogV1SignedExact: true,
      secretMetadataCount: secretSnapshot.metadataCount, secretConsumerCount: secretSnapshot.consumerCount, secretConsumersExact: secretSnapshot.consumersExact, caddyDerivedSecretExact: secretSnapshot.caddyDerived,
      launchCalls: 0
    };
    process.stdout.write(JSON.stringify(output));
  } catch (error) {
    const failure = error?.phase2Failure === true && PHASE2_FAILURES[error.stage] === error.code ? error : phaseFailure(stage);
    const output = { schema: PHASE2_FAILURE_SCHEMA, receipt: PHASE2_RECEIPT, status: "blocked", failure: { stage: failure.stage, code: failure.code } };
    process.stdout.write(JSON.stringify(output));
    process.exitCode = 1;
  } };
  run();
}

function createPhase2Program() {
  return `const path=require("node:path");const PROJECT=${JSON.stringify(PROJECT)};const SERVICES=${JSON.stringify(SERVICES)};const validateProductionServices=${validateProductionServices.toString()};const PHASE2_RECEIPT=${JSON.stringify(PHASE2_RECEIPT)};const PHASE2_FAILURE_SCHEMA=${JSON.stringify(PHASE2_FAILURE_SCHEMA)};const PHASE2_FAILURES=${JSON.stringify(PHASE2_FAILURES)};const validSecretBytes=${validSecretBytes.toString()};const secretMountFor=${secretMountFor.toString()};const validatePublishedCatalogMount=${validatePublishedCatalogMount.toString()};const validateSecretSnapshot=${validateSecretSnapshot.toString()};const validateServiceBaseline=${validateServiceBaseline.toString()};const validateCatalogBaseline=${validateCatalogBaseline.toString()};(${phase2RemoteMain.toString()})();`;
}

function validatePhase1Output(text) {
  const value = JSON.parse(text);
  const booleanKeys = ["linux", "x64", "remoteIdentityExact", "diskSufficient", "r11TargetsAbsent", "r11UnitAbsent", "r11UnitStateExact", "r11ProcessesAbsent", "oldImagesExact", "dockerClient", "dockerDaemon", "compose"];
  if (!exactObject(value, ["schema", "receipt", ...booleanKeys, "concurrentCutovers", "serviceCount", "healthyServices"]) ||
      value.schema !== PHASE1_SCHEMA || value.receipt !== PHASE1_RECEIPT || booleanKeys.some((key) => value[key] !== true) ||
      value.concurrentCutovers !== 0 || value.serviceCount !== 6 || value.healthyServices !== 6) {
    throw new Error("phase1 output invalid");
  }
  return value;
}

function validatePhase2Output(text, candidate) {
  const value = JSON.parse(text);
  if (!exactObject(value, ["schema", "receipt", "candidate", "prepared", "retained", "capabilityDisabledExact", "publicFeatureDisabledExact", "launchBaselineExact", "catalogV2SignedExact", "catalogV1SignedExact", "secretMetadataCount", "secretConsumerCount", "secretConsumersExact", "caddyDerivedSecretExact", "launchCalls"]) ||
      value.schema !== PHASE2_SCHEMA || value.receipt !== PHASE2_RECEIPT || !exactObject(value.candidate, ["deploymentSetDigest", "deploymentManifestSha256", "payloadDigest", "identitySourceDigest"]) ||
      JSON.stringify(value.candidate) !== JSON.stringify({ deploymentSetDigest: candidate.deploymentSetDigest, deploymentManifestSha256: candidate.deploymentManifestSha256, payloadDigest: candidate.payloadDigest, identitySourceDigest: candidate.identitySourceDigest }) ||
      !exactObject(value.prepared, ["verified", "runtimeExact", "modulesSameRelease"]) || Object.values(value.prepared).some((entry) => entry !== true) ||
      !exactObject(value.retained, ["baseline", "events", "idempotency", "eventHead", "idempotentReplay", "sourcePosts"]) ||
      value.retained.baseline !== "disabled-retained-official-bootstrap" || value.retained.events !== 9 || value.retained.idempotency !== 9 || value.retained.eventHead !== 9 || value.retained.idempotentReplay !== true || value.retained.sourcePosts !== 3 ||
      value.capabilityDisabledExact !== true || value.publicFeatureDisabledExact !== true || value.launchBaselineExact !== true || value.catalogV2SignedExact !== true || value.catalogV1SignedExact !== true || value.secretMetadataCount !== 9 || value.secretConsumerCount !== 13 || value.secretConsumersExact !== true || value.caddyDerivedSecretExact !== true || value.launchCalls !== 0) {
    throw new Error("phase2 output invalid");
  }
  return value;
}

function validatePhase2FailureOutput(text) {
  const value = JSON.parse(text);
  if (!exactObject(value, ["schema", "receipt", "status", "failure"]) ||
      value.schema !== PHASE2_FAILURE_SCHEMA || value.receipt !== PHASE2_RECEIPT || value.status !== "blocked" ||
      !exactObject(value.failure, ["stage", "code"]) || PHASE2_FAILURES[value.failure.stage] !== value.failure.code) {
    throw new Error("phase2 failure output invalid");
  }
  return value;
}

function fixedSshArgs({ phase, preparedRoot }) {
  const target = `${REMOTE_USER}@${REMOTE_HOST}`;
  const common = [...SSH_OPTIONS, "-i", IDENTITY_FILE, "-o", `UserKnownHostsFile=${KNOWN_HOSTS_FILE}`, target, "env", "-i"];
  if (phase === "pre-transfer") return [...common, "/bin/bash", "-s"];
  if (phase !== "post-prepare" || !REMOTE_RELEASE_PATTERN.test(preparedRoot || "")) throw new Error("phase invalid");
  return [...common, `${preparedRoot}/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`, "-", preparedRoot];
}

function validateReadOnlyTransport({ phase, sshPath, args, program, preparedRoot }) {
  if (path.resolve(sshPath || "").toLowerCase() !== path.resolve(SSH_PATH).toLowerCase()) throw new Error("transport executable drifted");
  const expectedArgs = fixedSshArgs({ phase, preparedRoot });
  const expectedProgram = phase === "pre-transfer" ? createPhase1Program() : createPhase2Program();
  if (JSON.stringify(args) !== JSON.stringify(expectedArgs) || program !== expectedProgram || sha256(program) !== sha256(expectedProgram)) {
    throw new Error("read-only transport contract drifted");
  }
  return true;
}

function receiptConnection(phase, stdout) {
  try {
    const value = JSON.parse(stdout);
    return value.receipt === (phase === "pre-transfer" ? PHASE1_RECEIPT : PHASE2_RECEIPT) ? 1 : 0;
  } catch { return 0; }
}

function runSsh({ phase, program, args, spawnImpl = spawn, sshPath = SSH_PATH, timeoutMs = DEFAULT_TIMEOUT_MS, terminationTimeoutMs = TERMINATION_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    let child; let started = false; let stdout = ""; let stderr = ""; let terminalCode = null;
    let timeout; let terminationTimeout; let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true; clearTimeout(timeout); clearTimeout(terminationTimeout); resolve(result);
    };
    const terminate = (code) => {
      if (terminalCode) return;
      terminalCode = code;
      try { child.kill("SIGKILL"); } catch {}
      terminationTimeout = setTimeout(() => finish(blocked(phase, "ssh", "CHILD_TERMINATION_FAILED", 0, started ? 1 : 0)), terminationTimeoutMs);
    };
    try {
      child = spawnImpl(sshPath, args, { shell: false, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
      started = true;
      child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) terminate("STDOUT_LIMIT"); });
      child.stderr.on("data", (chunk) => { stderr += chunk; if (Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) terminate("STDERR_LIMIT"); });
      child.stdin.once("error", () => terminate("STDIN_FAILED"));
      child.once("error", () => finish(blocked(phase, "ssh", "SSH_START_FAILED", 0, started ? 1 : 0)));
      child.once("close", (code) => {
        clearTimeout(terminationTimeout);
        if (terminalCode) return finish(blocked(phase, "ssh", terminalCode, 0, 1));
        const connections = receiptConnection(phase, stdout);
        if (phase === "post-prepare" && stderr.length === 0) {
          let failure;
          try { failure = validatePhase2FailureOutput(stdout).failure; } catch {}
          if (failure) return finish(blocked(phase, code === 1 ? failure.stage : "ssh", code === 1 ? failure.code : "SSH_EARLY_EXIT", connections, 1));
        }
        if (code !== 0 || stderr.length !== 0) return finish(blocked(phase, "ssh", "SSH_EARLY_EXIT", connections, 1));
        finish({ stdout, connections, starts: 1 });
      });
      timeout = setTimeout(() => terminate("SSH_TIMEOUT"), timeoutMs);
      child.stdin.end(program);
    } catch {
      finish(blocked(phase, "ssh", "SSH_START_FAILED", 0, 0));
    }
  });
}

async function runPhase(options = {}) {
  const phase = options.phase;
  if (!['pre-transfer', 'post-prepare'].includes(phase)) return blocked("local", "arguments", "INVALID_PHASE", 0);
  let candidate; let args;
  const program = phase === "pre-transfer" ? createPhase1Program() : createPhase2Program();
  try {
    candidate = loadLocalCandidate(options.bundleRoot);
    validateTransportAuthority({ metadataReader: options.metadataReader });
    args = fixedSshArgs({ phase, preparedRoot: options.preparedRoot });
    validateReadOnlyTransport({ phase, sshPath: SSH_PATH, args, program, preparedRoot: options.preparedRoot });
  } catch {
    return blocked(phase, "local", "LOCAL_PREFLIGHT_FAILED", 0);
  }
  const result = await runSsh({ phase, program, args, spawnImpl: options.spawnImpl, sshPath: SSH_PATH, timeoutMs: options.timeoutMs });
  if (!Object.hasOwn(result, "stdout")) return result;
  try {
    const remote = phase === "pre-transfer" ? validatePhase1Output(result.stdout) : validatePhase2Output(result.stdout, candidate);
    const report = phase === "pre-transfer" ? {
      schema: SCHEMA, status: "pass", phase, nextAuthorization: "transfer-prepare", candidate,
      checks: {
        linux: remote.linux, x64: remote.x64, remoteIdentityExact: remote.remoteIdentityExact,
        diskSufficient: remote.diskSufficient, r11TargetsAbsent: remote.r11TargetsAbsent,
        r11UnitAbsent: remote.r11UnitAbsent, r11UnitStateExact: remote.r11UnitStateExact, r11ProcessesAbsent: remote.r11ProcessesAbsent,
        concurrentCutovers: remote.concurrentCutovers, serviceCount: remote.serviceCount,
        healthyServices: remote.healthyServices, oldImagesExact: remote.oldImagesExact,
        dockerClient: remote.dockerClient, dockerDaemon: remote.dockerDaemon, compose: remote.compose
      },
      ...effects(phase, result.connections, result.starts, false)
    } : {
      schema: SCHEMA, status: "pass", phase, nextAuthorization: "launch", candidate,
      checks: { prepared: true, runtime: true, sameReleaseModules: true, launchBaselineExact: true, catalogV2SignedExact: true, catalogV1SignedExact: true, retainedEvents: 9, retainedIdempotency: 9, retainedHead: 9, retainedReplay: true, sourcePosts: 3, capabilityDisabledExact: true, publicFeatureDisabledExact: true, secretMetadata: 9, secretConsumers: 13, caddyDerivedSecret: true },
      ...effects(phase, result.connections, result.starts, true)
    };
    safeJson(report);
    return Object.freeze(report);
  } catch {
    return blocked(phase, "remote-contract", "REMOTE_OUTPUT_INVALID", result.connections, result.starts);
  }
}

function parseCli(argv) {
  const phase = argv[0];
  const expected = phase === "post-prepare"
    ? ["--prepared-root"]
    : [];
  if (!['pre-transfer', 'post-prepare'].includes(phase) || argv.length !== 1 + expected.length * 2) throw new Error("arguments");
  const values = { phase };
  for (let index = 0; index < expected.length; index += 1) {
    if (argv[1 + index * 2] !== expected[index]) throw new Error("arguments");
    values[expected[index].slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[2 + index * 2];
  }
  return values;
}

async function main(argv = process.argv.slice(2)) {
  let report;
  try { report = await runPhase(parseCli(argv)); } catch { report = blocked("local", "arguments", "INVALID_ARGUMENTS", 0); }
  process.stdout.write(`${safeJson(report)}\n`);
  if (report.status !== "pass") process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  DEFAULT_TIMEOUT_MS,
  IDENTITY_FILE,
  KNOWN_HOSTS_FILE,
  LOCAL_BUNDLE_ROOT,
  MAX_OUTPUT_BYTES,
  PHASE1_SCHEMA,
  PHASE2_SCHEMA,
  PHASE2_FAILURE_SCHEMA,
  PHASE2_FAILURES,
  PHASE2_RECEIPT,
  SCHEMA,
  SSH_PATH,
  createPhase1Program,
  createPhase2Program,
  fixedSshArgs,
  loadLocalCandidate,
  parseCli,
  runPhase,
  runSsh,
  readWindowsAuthorityMetadata,
  sha256File,
  validSecretBytes,
  validateAbsentSystemdUnit,
  validateCatalogBaseline,
  validatePublishedCatalogMount,
  validateServiceBaseline,
  validateSecretSnapshot,
  validatePhase1Output,
  validatePhase2Output,
  validatePhase2FailureOutput,
  validateReadOnlyTransport,
  validateTransportAuthority
};
