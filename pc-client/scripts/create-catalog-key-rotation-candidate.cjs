"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { publicKeyRecord } = require("../admin/signing-key.cjs");
const { verifyCatalogReleaseIntegrity } = require("../shared/catalog-release.cjs");
const { readCatalogClientChannel } = require("../shared/catalog-client-channel.cjs");

const SHA256 = /^[a-f0-9]{64}$/;
const ICACLS = "C:\\Windows\\System32\\icacls.exe";
const POWERSHELL = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const SYSTEM_SID = "S-1-5-18";
const ADMINISTRATORS_SID = "S-1-5-32-544";
const CONSUMERS = Object.freeze([
  "catalog/channel.server-connected-review.json",
  "electron/main.cjs",
  "shared/catalog-client-channel.cjs",
  "shared/signed-release.cjs",
  "shared/catalog-release.cjs",
  "shared/release-package-policy.cjs",
  "scripts/check-packaged-catalog.mjs",
  "scripts/electron-builder-before-pack.cjs",
  "admin/signing-key.cjs",
  "admin/release-store.cjs",
  "admin/server.cjs"
]);

function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function exactRegularFile(file, code) {
  const resolved = path.resolve(file);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(resolved).toLowerCase() !== resolved.toLowerCase()) {
    throw new Error(code);
  }
  return resolved;
}

function fixedWindowsExecutable(file) {
  return exactRegularFile(file, "CATALOG_KEY_ACL_TOOL_INVALID");
}

function runFixed(executable, args, code) {
  const result = spawnSync(fixedWindowsExecutable(executable), args, {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: 20_000,
    maxBuffer: 256 * 1024
  });
  if (result.error || result.status !== 0) throw new Error(code);
  return result.stdout;
}

function currentIdentitySid() {
  const command = "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value";
  const value = runFixed(POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", command], "CATALOG_KEY_ACL_UNAVAILABLE").trim();
  if (!/^S-1-5-(?:\d+-){1,14}\d+$/.test(value)) throw new Error("CATALOG_KEY_ACL_UNAVAILABLE");
  return value;
}

function applyProtectedAcl(target, { directory, currentSid }) {
  const inheritance = directory ? "(OI)(CI)F" : "F";
  runFixed(ICACLS, [
    target,
    "/inheritance:r",
    "/grant:r",
    `*${currentSid}:${inheritance}`,
    `*${SYSTEM_SID}:${inheritance}`,
    `*${ADMINISTRATORS_SID}:${inheritance}`
  ], "CATALOG_KEY_ACL_APPLY_FAILED");
}

function powershellLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function aclProjection(target, currentSid) {
  const command = [
    "$ErrorActionPreference='Stop'",
    `$p=${powershellLiteral(target)}`,
    "$a=Get-Acl -LiteralPath $p",
    "$owner=[Security.Principal.NTAccount]::new($a.Owner).Translate([Security.Principal.SecurityIdentifier]).Value",
    "$rules=@($a.Access|ForEach-Object{[pscustomobject]@{sid=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;allow=($_.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow);fullControl=($_.FileSystemRights -eq [Security.AccessControl.FileSystemRights]::FullControl);inherited=$_.IsInherited}})",
    "[pscustomobject]@{protected=$a.AreAccessRulesProtected;owner=$owner;rules=$rules}|ConvertTo-Json -Compress -Depth 4"
  ].join(";");
  let parsed;
  try {
    parsed = JSON.parse(runFixed(POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", command], "CATALOG_KEY_ACL_UNAVAILABLE"));
  } catch {
    throw new Error("CATALOG_KEY_ACL_UNAVAILABLE");
  }
  const rules = Array.isArray(parsed.rules) ? parsed.rules : parsed.rules ? [parsed.rules] : [];
  const allowed = new Map([
    [currentSid, "current-release-identity-full-control"],
    [SYSTEM_SID, "system-full-control"],
    [ADMINISTRATORS_SID, "administrators-full-control"]
  ]);
  if (
    parsed.protected !== true ||
    parsed.owner !== currentSid ||
    rules.length !== allowed.size ||
    rules.some((rule) => !allowed.has(rule.sid) || rule.allow !== true || rule.fullControl !== true || rule.inherited !== false)
  ) {
    throw new Error("CATALOG_KEY_ACL_INVALID");
  }
  return {
    inheritanceProtected: true,
    ownerCurrentReleaseIdentity: true,
    ruleClasses: rules.map((rule) => allowed.get(rule.sid)).sort()
  };
}

function writeJsonExclusive(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}

function buildCatalogTrustTransition({ current, oldKey, newKey }) {
  if (
    !current ||
    current.schemaVersion !== 2 ||
    current.kind !== "catalog" ||
    current.catalogChannel !== "v2" ||
    !Array.isArray(current.trustedKeys) ||
    current.trustedKeys.length !== 1 ||
    current.trustedKeys[0]?.keyId !== oldKey?.keyId ||
    oldKey?.keyId === newKey?.keyId
  ) {
    throw new Error("CATALOG_TRUST_TRANSITION_INVALID");
  }
  const transitionChannel = { ...current, trustedKeys: [oldKey, newKey] };
  const retiredChannel = { ...current, trustedKeys: [newKey] };
  return Object.freeze({
    transitionChannel,
    retiredChannel,
    stages: [
      { code: "ACTIVE7_OLD_ONLY", serverReleaseRemainsActive7: true, oldKeyTrusted: true },
      { code: "CLIENT_0_1_82_DUAL_TRUST", serverReleaseRemainsActive7: true, oldKeyTrusted: true },
      {
        code: "NEW_KEY_ACTIVATION_AFTER_ADOPTION",
        serverReleaseRemainsActive7: false,
        oldKeyTrusted: true,
        oldClientBehavior: "reject-new-remote-use-verified-active7-cache-or-unavailable"
      },
      { code: "NEXT_CLIENT_NEW_ONLY", serverReleaseRemainsActive7: false, oldKeyTrusted: false }
    ],
    v8Signed: false,
    published: false
  });
}

function createCatalogKeyRotationCandidate({ rootDirectory, candidateDirectory }) {
  const root = fs.realpathSync(path.resolve(rootDirectory));
  const output = fs.realpathSync(path.join(root, "output"));
  const candidate = path.resolve(candidateDirectory);
  if (
    path.dirname(candidate).toLowerCase() !== output.toLowerCase() ||
    !/^catalog-key-rotation-[a-z0-9-]+$/i.test(path.basename(candidate)) ||
    fs.existsSync(candidate)
  ) {
    throw new Error("CATALOG_KEY_CANDIDATE_PATH_INVALID");
  }

  const channelPath = exactRegularFile(path.join(root, "catalog", "channel.server-connected-review.json"), "CATALOG_CHANNEL_INVALID");
  const current = readCatalogClientChannel(JSON.parse(fs.readFileSync(channelPath, "utf8")), { kind: "catalog" });
  if (current.catalogChannel !== "v2" || current.trustedKeys.length !== 1) throw new Error("CATALOG_TRUST_TRANSITION_INVALID");
  const oldKey = current.trustedKeys[0];

  const store = path.join(root, "admin", "published", "catalog-store");
  const state = JSON.parse(fs.readFileSync(exactRegularFile(path.join(store, "state.json"), "CATALOG_STATE_INVALID"), "utf8"));
  const v2 = state?.channels?.v2;
  const active = v2?.history?.find((entry) => entry?.releaseId === v2?.activeReleaseId);
  if (!active || active.catalogVersion !== 7 || active.keyId !== oldKey.keyId || path.basename(active.fileName || "") !== active.fileName) {
    throw new Error("CATALOG_ACTIVE7_INVALID");
  }
  const activeEnvelopePath = exactRegularFile(path.join(store, "releases", active.fileName), "CATALOG_ACTIVE7_INVALID");
  const activeEnvelope = JSON.parse(fs.readFileSync(activeEnvelopePath, "utf8"));
  const activeRelease = verifyCatalogReleaseIntegrity(activeEnvelope, { trustedKeys: [oldKey] });
  if (activeRelease.catalogVersion !== 7 || activeRelease.releaseId !== active.releaseId) throw new Error("CATALOG_ACTIVE7_INVALID");

  const pair = crypto.generateKeyPairSync("ed25519");
  const newKey = publicKeyRecord(pair.privateKey, "catalog");
  if (newKey.keyId === oldKey.keyId) throw new Error("CATALOG_KEY_ROTATION_COLLISION");
  const transition = buildCatalogTrustTransition({ current, oldKey, newKey });

  fs.mkdirSync(candidate, { recursive: false });
  const publicDirectory = path.join(candidate, "public");
  const privateDirectory = path.join(candidate, "private");
  fs.mkdirSync(publicDirectory);
  fs.mkdirSync(privateDirectory);
  const currentSid = currentIdentitySid();
  applyProtectedAcl(privateDirectory, { directory: true, currentSid });
  aclProjection(privateDirectory, currentSid);

  const privateKeyPath = path.join(privateDirectory, "catalog-signing-private.pem");
  const pem = pair.privateKey.export({ format: "pem", type: "pkcs8" });
  fs.writeFileSync(privateKeyPath, pem, { flag: "wx", mode: 0o600 });
  applyProtectedAcl(privateKeyPath, { directory: false, currentSid });
  const fileAcl = aclProjection(privateKeyPath, currentSid);
  const privateStat = fs.lstatSync(privateKeyPath);
  if (
    !privateStat.isFile() ||
    privateStat.isSymbolicLink() ||
    privateStat.nlink !== 1 ||
    fs.realpathSync(privateKeyPath).toLowerCase() !== privateKeyPath.toLowerCase()
  ) {
    throw new Error("CATALOG_PRIVATE_KEY_FILE_INVALID");
  }

  const transitionChannelPath = path.join(publicDirectory, "catalog-channel-0.1.82-transition.json");
  const retiredChannelPath = path.join(publicDirectory, "catalog-channel-next-new-only.json");
  writeJsonExclusive(transitionChannelPath, transition.transitionChannel);
  writeJsonExclusive(retiredChannelPath, transition.retiredChannel);
  const publicKeyDer = Buffer.from(newKey.publicKey, "base64");
  const consumerClosures = Object.fromEntries(CONSUMERS.map((relative) => [relative, sha256File(exactRegularFile(path.join(root, relative), "CATALOG_TRUST_CONSUMER_INVALID"))]));
  const report = {
    schemaVersion: 1,
    status: "LOCAL_SECURITY_CANDIDATE",
    oldKeyId: oldKey.keyId,
    newKeyId: newKey.keyId,
    newPublicKeyFingerprintSha256: sha256Bytes(publicKeyDer),
    activeCatalogVersion: 7,
    active7Verified: true,
    transitionStages: transition.stages,
    v8Signed: false,
    published: false,
    packaged: false,
    deployed: false,
    privateKeyExcludedFromGit: fs.readFileSync(path.join(root, ".gitignore"), "utf8").split(/\r?\n/).includes("output/"),
    privateKeyExcludedFromPackage: !JSON.stringify(require(path.join(root, "package.json")).build.files).includes("output"),
    privateKeyProtection: {
      regular: true,
      nonReparse: true,
      linkCountOne: true,
      ...fileAcl
    },
    publicArtifacts: {
      transitionChannelSha256: sha256File(transitionChannelPath),
      retiredChannelSha256: sha256File(retiredChannelPath)
    },
    consumerClosures,
    oldClientBehaviorAfterNewKeyActivation: "reject-new-remote-use-verified-active7-cache-or-unavailable",
    remainingGate: "CTO_APPROVAL_REQUIRED_FOR_PACKAGE_ADOPTION_AND_NEW_KEY_ACTIVATION"
  };
  if (!report.privateKeyExcludedFromGit || !report.privateKeyExcludedFromPackage) throw new Error("CATALOG_PRIVATE_KEY_EXCLUSION_INVALID");
  const reportPath = path.join(publicDirectory, "report.json");
  writeJsonExclusive(reportPath, report);
  return {
    reportPath,
    transitionChannelPath,
    retiredChannelPath,
    privateKeyPath,
    newKeyId: newKey.keyId,
    newPublicKeyFingerprintSha256: report.newPublicKeyFingerprintSha256
  };
}

if (require.main === module) {
  const rootDirectory = path.resolve(__dirname, "..");
  const candidateDirectory = path.join(rootDirectory, "output", "catalog-key-rotation-20260812-candidate");
  try {
    const result = createCatalogKeyRotationCandidate({ rootDirectory, candidateDirectory });
    process.stdout.write(`${JSON.stringify({
      status: "PASS",
      newKeyId: result.newKeyId,
      newPublicKeyFingerprintSha256: result.newPublicKeyFingerprintSha256,
      privateKeyProtected: true,
      v8Signed: false,
      published: false
    })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: "BLOCKED", code: /^[A-Z0-9_]+$/.test(error?.message || "") ? error.message : "CATALOG_KEY_ROTATION_FAILED" })}\n`);
    process.exitCode = 2;
  }
}

module.exports = { buildCatalogTrustTransition, createCatalogKeyRotationCandidate };
