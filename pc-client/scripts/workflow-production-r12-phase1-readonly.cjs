"use strict";

// Local-only Phase 1 inventory launcher. This file is intentionally excluded
// from the deployment manifest and performs no transfer, mutation, or launch.
const childProcess = require("node:child_process");
const path = require("node:path");
const {
  SERVICES,
  validateProductionServices
} = require("../deployment/community-production/workflow-production-service-contract.cjs");
const { R12 } = require("../deployment/community-production/workflow-production-r12-in-place.cjs");

const SCHEMA = "aihub-r12-phase1-readonly-launcher-v1";
const SSH_PATH = "C:\\Windows\\System32\\OpenSSH\\ssh.exe";
const IDENTITY_FILE = "C:\\Users\\yujin\\.ssh\\zhenxingai_deploy_ed25519";
const KNOWN_HOSTS_FILE = "C:\\Users\\yujin\\.ssh\\known_hosts";
const REMOTE_TARGET = "admin@47.236.62.189";
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 256 * 1024;
const SECTION_ORDER = Object.freeze([
  "HOST",
  "PROJECT",
  "SERVICES",
  "NAMESPACE",
  "UNITS",
  "PROCESSES",
  "HISTORY",
  "STATE",
  "STORAGE"
]);
const MEMORY_AVAILABLE_MIN_KIB = 262_144;
const DISABLED_FLAGS = Object.freeze([
  "AIHUB_RESOURCE_SUBMISSIONS_ENABLED",
  "AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION",
  "AIHUB_WORKFLOW_STORE_ENABLED",
  "AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED",
  "AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED",
  "AIHUB_WORKFLOW_STORE_SCHEMA_VERSION"
]);
const RESOURCE_LIMITS = Object.freeze({
  admin: Object.freeze({ Memory: 201326592, NanoCpus: 750000000, PidsLimit: 128 }),
  identityDatabase: Object.freeze({ Memory: 268435456, NanoCpus: 400000000, PidsLimit: 192 }),
  identity: Object.freeze({ Memory: 201326592, NanoCpus: 350000000, PidsLimit: 128 }),
  communityDatabase: Object.freeze({ Memory: 335544320, NanoCpus: 450000000, PidsLimit: 384 }),
  community: Object.freeze({ Memory: 335544320, NanoCpus: 450000000, PidsLimit: 256 }),
  caddy: Object.freeze({ Memory: 67108864, NanoCpus: 150000000, PidsLimit: 128 })
});
const ONE_SHOT_MAX_BYTES = 192 * 1024 * 1024;
const HOST_HEADROOM_BYTES = 128 * 1024 * 1024;
const MEMORY_TOTAL_MIN_KIB = (Object.values(RESOURCE_LIMITS).reduce((sum, limit) => sum + limit.Memory, 0) +
  ONE_SHOT_MAX_BYTES + HOST_HEADROOM_BYTES) / 1024;
const MEMORY_TRANSFER_MIN_KIB = 512 * 1024;
const BUNDLE_BYTES = 539694770;
const TRANSFER_HEADROOM_BYTES = 256 * 1024 * 1024;
const DISK_TRANSFER_MIN_KIB = Math.ceil((BUNDLE_BYTES + TRANSFER_HEADROOM_BYTES) / 1024);
if (!Number.isInteger(MEMORY_TOTAL_MIN_KIB)) throw new Error("invalid r12 planned peak memory floor");
const UNIT_NAMES = Object.freeze(
  Array.from({ length: 8 }, (_, index) => `zhenxing-ai-workflow-production-r${index + 5}.service`)
);
const NAMESPACE_LINES = Object.freeze([
  "control=absent",
  "evidence=absent",
  "release=absent",
  "staging=absent"
]);
const REPORT_KEYS = Object.freeze(["schema", "status", "phase", "failure", "hostDiskObservation", "storageInventory", "checks", "effects", "decision"]);
const DISK_OBSERVATION_KEYS = Object.freeze([
  "headerExact",
  "dataRowCount",
  "fieldCount",
  "availableKiB",
  "requiredKiB",
  "mountProfile",
  "capacityProfile"
]);
const STORAGE_SCOPES = Object.freeze(["release", "staging", "backup"]);
const STORAGE_ITEM_KEYS = Object.freeze(["scope", "name", "sizeKiB", "kind"]);
const STORAGE_MAX_PER_SCOPE = 64;
const STORAGE_MAX_TOTAL = 192;
const CHECK_KEYS = Object.freeze([
  "hostCapacityExact",
  "hostMemoryProfile",
  "hostLaunchMemoryEligible",
  "hostMemoryAvailabilityProfile",
  "hostDiskProfile",
  "productionProjectExact",
  "productionServicesExact",
  "flagsExact",
  "featureProfile",
  "resourceLimitsExact",
  "resourceProfile",
  "publishedMountExact",
  "r12NamespaceAbsent",
  "oldUnitsInactive",
  "concurrentProcesses",
  "historyEvidenceChecked",
  "historyProfile",
  "active6StateExact"
]);
const EFFECT_KEYS = Object.freeze([
  "sshInvocations",
  "remoteConnections",
  "remoteWrites",
  "dockerMutations",
  "transferCalls",
  "prepareCalls",
  "launchCalls"
]);
const DECISION_KEYS = Object.freeze(["phase1Pass", "eligibleForTransfer", "eligibleForPrepare", "eligibleForLaunch"]);
const FAILURE_STAGES = Object.freeze({
  PHASE1_CLI_INVALID: "local-cli",
  PHASE1_SSH_SPAWN_FAILED: "ssh-transport",
  PHASE1_SSH_TIMEOUT: "ssh-transport",
  PHASE1_SSH_SIGNAL: "ssh-transport",
  PHASE1_SSH_NONZERO: "ssh-transport",
  PHASE1_SSH_DIAGNOSTIC_OUTPUT: "ssh-transport",
  PHASE1_SSH_OUTPUT_OVERSIZE: "ssh-transport",
  PHASE1_PROTOCOL_INVALID: "protocol",
  PHASE1_OUTPUT_OVERSIZE: "protocol",
  PHASE1_HOST_IDENTITY_DRIFT: "host-identity",
  PHASE1_HOST_CPU_DRIFT: "host-cpu",
  PHASE1_HOST_MEMORY_TOTAL_DRIFT: "host-memory-total",
  PHASE1_HOST_MEMORY_METADATA_INVALID: "host-memory-metadata",
  PHASE1_HOST_DISK_FORMAT_DRIFT: "host-disk-format",
  PHASE1_HOST_DISK_MOUNT_DRIFT: "host-disk-mount",
  PHASE1_HOST_DISK_CAPACITY_DRIFT: "host-disk-capacity",
  PHASE1_PROJECT_DRIFT: "project-inventory",
  PHASE1_SERVICE_DRIFT: "service-inventory",
  PHASE1_FLAGS_DRIFT: "service-inventory",
  PHASE1_RESOURCE_LIMITS_DRIFT: "service-inventory",
  PHASE1_PUBLISHED_MOUNT_DRIFT: "service-inventory",
  PHASE1_R12_NAMESPACE_PRESENT: "r12-namespace",
  PHASE1_R12_UNIT_PRESENT: "durable-units",
  PHASE1_OLD_UNIT_ACTIVE: "durable-units",
  PHASE1_CONCURRENT_PROCESS: "process-inventory",
  PHASE1_HISTORY_EVIDENCE_DRIFT: "history-evidence",
  PHASE1_ACTIVE6_STATE_DRIFT: "active6-state",
  PHASE1_STORAGE_INVENTORY_DRIFT: "storage-inventory"
});
const SENSITIVE = /(?:raw|stdout|stderr|password|secret|token|authorization|cookie|body|stack|\bsql\b|\benv\b|\bpath\b|\bpid\b|containername|workflowid|identityid|reviewerid|publisherid|discussionid|postid|https?:\/\/|127\.0\.0\.1)/i;

const REMOTE_SCRIPT = [
  "set -euo pipefail",
  "shopt -s nullglob",
  "emit() { /usr/bin/printf '@@%s@@\\n' \"$1\"; }",
  "absent() { if /usr/bin/test ! -e \"$2\" && /usr/bin/test ! -L \"$2\"; then /usr/bin/printf '%s=absent\\n' \"$1\"; else /usr/bin/printf '%s=present\\n' \"$1\"; fi; }",
  "/usr/bin/printf '@@AIHUB_R12_PHASE1_V1@@\\n'",
  "emit HOST",
  "/usr/bin/id -u",
  "/usr/bin/id -g",
  "/usr/bin/nproc",
  "/usr/bin/grep -E '^(MemTotal|MemAvailable):' /proc/meminfo",
  "/bin/df -Pk /opt/zhenxing-ai",
  "emit PROJECT",
  "/usr/bin/docker ps -aq --filter label=com.docker.compose.project=zhenxing-community-production",
  "emit SERVICES",
  "/usr/bin/docker inspect zhenxing-community-production-admin-1 zhenxing-community-production-identity-database-1 zhenxing-community-production-identity-1 zhenxing-community-production-community-database-1 zhenxing-community-production-community-1 zhenxing-community-production-caddy-1",
  "emit NAMESPACE",
  "absent control /opt/zhenxing-ai/shared/workflow-production-r12",
  "absent evidence /opt/zhenxing-ai/shared/backups/workflow-production-r12-evidence",
  "release_matches=(/opt/zhenxing-ai/releases/community-production-r12-*); if (( ${#release_matches[@]} == 0 )); then /usr/bin/printf 'release=absent\\n'; else /usr/bin/printf 'release=present\\n'; fi",
  "staging_matches=(/opt/zhenxing-ai/staging/community-production-r12-*.bundle); if (( ${#staging_matches[@]} == 0 )); then /usr/bin/printf 'staging=absent\\n'; else /usr/bin/printf 'staging=present\\n'; fi",
  "emit UNITS",
  "for unit in zhenxing-ai-workflow-production-r5.service zhenxing-ai-workflow-production-r6.service zhenxing-ai-workflow-production-r7.service zhenxing-ai-workflow-production-r8.service zhenxing-ai-workflow-production-r9.service zhenxing-ai-workflow-production-r10.service zhenxing-ai-workflow-production-r11.service zhenxing-ai-workflow-production-r12.service; do /usr/bin/printf '%s\\n' \"$unit\"; /usr/bin/systemctl show --property=LoadState --property=ActiveState --property=SubState \"$unit\"; done",
  "emit PROCESSES",
  "matches=$(/usr/bin/pgrep -f '[w]orkflow-production-(cutover|release-bundle-cutover|r[5-9]|r1[012])' || true); if [[ -n \"$matches\" ]]; then /usr/bin/printf '%s\\n' \"$matches\"; else /usr/bin/printf '0\\n'; fi",
  "emit HISTORY",
  "for generation in 6 7 8; do control=/opt/zhenxing-ai/shared/workflow-production-r${generation}; evidence=/opt/zhenxing-ai/shared/backups/workflow-production-r${generation}-evidence; if /usr/bin/test -d \"$control\" && /usr/bin/test ! -L \"$control\" && /usr/bin/test -f \"$control/status.json\" && /usr/bin/test ! -L \"$control/status.json\" && /usr/bin/test -f \"$control/receipt.json\" && /usr/bin/test ! -L \"$control/receipt.json\" && /usr/bin/test -d \"$evidence\" && /usr/bin/test ! -L \"$evidence\"; then /usr/bin/printf 'r%s=controls-present\\n' \"$generation\"; else /usr/bin/printf 'r%s=drift\\n' \"$generation\"; fi; done",
  "backup=/opt/zhenxing-ai/shared/backups/community-production-20260809T152002Z; sums=$backup/SHA256SUMS; if /usr/bin/test -d \"$backup\" && /usr/bin/test ! -L \"$backup\" && /usr/bin/test -f \"$sums\" && /usr/bin/test ! -L \"$sums\" && [[ \"$(/usr/bin/sha256sum \"$sums\")\" == \"ac508a707ae255b7c9ed7551a8fcf1e90a018e9bf5fa1e7379036f42d6e84608  $sums\" ]]; then /usr/bin/printf 'r8-backup-control=exact\\n'; else /usr/bin/printf 'r8-backup-control=drift\\n'; fi",
  "emit STATE",
  "/usr/bin/docker exec zhenxing-community-production-admin-1 node -e 'const fs=require(\"node:fs\"),crypto=require(\"node:crypto\"),p=\"/app/admin/published/catalog-store/state.json\",s=fs.lstatSync(p),b=fs.readFileSync(p);process.stdout.write([s.uid,s.gid,(s.mode&511).toString(8),s.nlink,s.isFile()?\"regular file\":\"other\",s.size].join(\"\\t\")+\"\\n\"+crypto.createHash(\"sha256\").update(b).digest(\"hex\")+\"  \"+p+\"\\n\")'",
  "emit STORAGE",
  "storage_scope() { local scope=\"$1\" root=\"$2\" child name size kind; local children=(\"$root\"/*) matches=(); for child in \"${children[@]}\"; do name=${child##*/}; case \"$scope\" in release) [[ \"$name\" =~ ^community-production-[A-Za-z0-9._-]+$ ]] || continue ;; staging) [[ \"$name\" =~ ^community-production-[A-Za-z0-9._-]+[.]bundle$ ]] || continue ;; backup) [[ \"$name\" =~ ^community-production-[A-Za-z0-9._-]+$ || \"$name\" =~ ^workflow-production-(r[4-9]|r1[0-2])-evidence$ ]] || continue ;; esac; matches+=(\"$child\"); done; if (( ${#matches[@]} > 64 )); then /usr/bin/printf '%s\\tlimit-drift\\t0\\tlimit-drift\\n' \"$scope\"; return; fi; for child in \"${matches[@]}\"; do name=${child##*/}; if /usr/bin/test -L \"$child\"; then size=0; kind=symlink-drift; elif /usr/bin/test -d \"$child\"; then read -r size _ < <(/usr/bin/du -sk -- \"$child\"); kind=directory; else size=0; kind=type-drift; fi; /usr/bin/printf '%s\\t%s\\t%s\\t%s\\n' \"$scope\" \"$name\" \"$size\" \"$kind\"; done; }",
  "storage_scope release /opt/zhenxing-ai/releases",
  "storage_scope staging /opt/zhenxing-ai/staging",
  "storage_scope backup /opt/zhenxing-ai/shared/backups",
  "/usr/bin/printf '@@END@@\\n'"
].join("\n");

function quote(value) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

const REMOTE_COMMAND = `/usr/bin/env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C /bin/bash -lc ${quote(REMOTE_SCRIPT)}`;
const SSH_ARGS = Object.freeze([
  "-T",
  "-o", "BatchMode=yes",
  "-o", "IdentitiesOnly=yes",
  "-o", "StrictHostKeyChecking=yes",
  "-o", "ConnectionAttempts=1",
  "-o", "ControlMaster=no",
  "-o", "ClearAllForwardings=yes",
  "-i", IDENTITY_FILE,
  "-o", `UserKnownHostsFile=${KNOWN_HOSTS_FILE}`,
  REMOTE_TARGET,
  REMOTE_COMMAND
]);

class Phase1Error extends Error {
  constructor(stage, code, hostDiskObservation = null) {
    super(code);
    this.stage = stage;
    this.code = code;
    this.hostDiskObservation = hostDiskObservation;
  }
}

function exactObject(value, keys) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function storageNameAllowed(scope, name) {
  if (typeof name !== "string") return false;
  if (scope === "staging") return /^community-production-[A-Za-z0-9._-]+\.bundle$/.test(name);
  if (scope === "release") return /^community-production-[A-Za-z0-9._-]+$/.test(name);
  return scope === "backup" && (/^community-production-[A-Za-z0-9._-]+$/.test(name) ||
    /^workflow-production-(?:r[4-9]|r1[0-2])-evidence$/.test(name));
}

function validateStorageInventory(value) {
  if (!Array.isArray(value) || value.length > STORAGE_MAX_TOTAL) throw new Error("invalid storage inventory");
  const counts = new Map(STORAGE_SCOPES.map((scope) => [scope, 0]));
  let previousScope = -1;
  let previousName = "";
  let symlinkDrift = false;
  for (const item of value) {
    if (!exactObject(item, STORAGE_ITEM_KEYS) || !STORAGE_SCOPES.includes(item.scope) ||
        !storageNameAllowed(item.scope, item.name) || SENSITIVE.test(item.name) ||
        !Number.isSafeInteger(item.sizeKiB) || item.sizeKiB < 0 ||
        !["directory", "symlink-drift"].includes(item.kind) ||
        (item.kind === "symlink-drift" && item.sizeKiB !== 0)) {
      throw new Error("invalid storage inventory");
    }
    const scopeIndex = STORAGE_SCOPES.indexOf(item.scope);
    if (scopeIndex < previousScope || (scopeIndex === previousScope && item.name <= previousName)) {
      throw new Error("invalid storage inventory");
    }
    const count = counts.get(item.scope) + 1;
    if (count > STORAGE_MAX_PER_SCOPE) throw new Error("invalid storage inventory");
    counts.set(item.scope, count);
    previousScope = scopeIndex;
    previousName = item.name;
    symlinkDrift ||= item.kind === "symlink-drift";
  }
  if (Buffer.byteLength(JSON.stringify(value)) >= 16 * 1024) throw new Error("invalid storage inventory");
  return { symlinkDrift };
}

function parseStorage(text) {
  if (typeof text !== "string") throw new Phase1Error("storage-inventory", "PHASE1_STORAGE_INVENTORY_DRIFT");
  const items = text === "" ? [] : text.split("\n").map((line) => {
    const fields = line.split("\t");
    if (fields.length !== 4 || !/^(?:0|[1-9][0-9]*)$/.test(fields[2])) {
      throw new Phase1Error("storage-inventory", "PHASE1_STORAGE_INVENTORY_DRIFT");
    }
    return { scope: fields[0], name: fields[1], sizeKiB: Number(fields[2]), kind: fields[3] };
  });
  try { return { inventory: Object.freeze(items.map(Object.freeze)), ...validateStorageInventory(items) }; }
  catch { throw new Phase1Error("storage-inventory", "PHASE1_STORAGE_INVENTORY_DRIFT"); }
}

function safeReport(value) {
  validateStorageInventory(value.storageInventory);
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded) > 16 * 1024 || SENSITIVE.test(encoded)) throw new Error("unsafe report");
  return value;
}

function emptyDiskObservation() {
  return {
    headerExact: false,
    dataRowCount: 0,
    fieldCount: 0,
    availableKiB: null,
    requiredKiB: DISK_TRANSFER_MIN_KIB,
    mountProfile: "unparsed",
    capacityProfile: "unparsed"
  };
}

function validateDiskObservation(value) {
  if (!exactObject(value, DISK_OBSERVATION_KEYS) || typeof value.headerExact !== "boolean" ||
      !Number.isSafeInteger(value.dataRowCount) || value.dataRowCount < 0 || value.dataRowCount > MAX_OUTPUT_BYTES ||
      !Number.isSafeInteger(value.fieldCount) || value.fieldCount < 0 || value.fieldCount > MAX_OUTPUT_BYTES ||
      (value.availableKiB !== null && (!Number.isSafeInteger(value.availableKiB) || value.availableKiB < 0)) ||
      value.requiredKiB !== DISK_TRANSFER_MIN_KIB ||
      !["root", "ancestor", "target", "invalid", "unparsed"].includes(value.mountProfile) ||
      !["sufficient", "insufficient", "unparsed"].includes(value.capacityProfile) ||
      (value.availableKiB === null) !== (value.capacityProfile === "unparsed") ||
      (value.availableKiB === null) !== (value.mountProfile === "unparsed") ||
      (value.availableKiB !== null && (!value.headerExact || value.dataRowCount !== 1 || value.fieldCount !== 6)) ||
      (value.availableKiB !== null && value.capacityProfile !==
        (value.availableKiB >= DISK_TRANSFER_MIN_KIB ? "sufficient" : "insufficient"))) {
    throw new Error("invalid disk observation");
  }
}

function validateReport(value) {
  validateDiskObservation(value?.hostDiskObservation);
  const pass = value?.status === "pass";
  if (!exactObject(value, REPORT_KEYS) || value.schema !== SCHEMA || value.phase !== "pre-transfer" ||
      !["pass", "blocked"].includes(value.status) || !Array.isArray(value.storageInventory) || !exactObject(value.checks, CHECK_KEYS) ||
      !exactObject(value.effects, EFFECT_KEYS) || !exactObject(value.decision, DECISION_KEYS) ||
      typeof value.checks.hostCapacityExact !== "boolean" || !["meets-r12-planned-peak", "below-r12-planned-peak", "unverified"].includes(value.checks.hostMemoryProfile) ||
      typeof value.checks.hostLaunchMemoryEligible !== "boolean" ||
      !["at-least-256-mib", "below-256-mib", "unverified"].includes(value.checks.hostMemoryAvailabilityProfile) ||
      !["r12-bundle-plus-256m", "unverified"].includes(value.checks.hostDiskProfile) ||
      typeof value.checks.productionProjectExact !== "boolean" ||
      typeof value.checks.productionServicesExact !== "boolean" || typeof value.checks.r12NamespaceAbsent !== "boolean" ||
      typeof value.checks.flagsExact !== "boolean" || !["disabled", "unverified"].includes(value.checks.featureProfile) ||
      typeof value.checks.resourceLimitsExact !== "boolean" || !["r12-2c2g", "unverified"].includes(value.checks.resourceProfile) ||
      typeof value.checks.publishedMountExact !== "boolean" || typeof value.checks.historyEvidenceChecked !== "boolean" ||
      !["r6-r8-controls-r8-backup-control-exact", "unverified"].includes(value.checks.historyProfile) ||
      typeof value.checks.oldUnitsInactive !== "boolean" || !Number.isSafeInteger(value.checks.concurrentProcesses) ||
      typeof value.checks.active6StateExact !== "boolean" ||
      !Object.values(value.effects).every(Number.isSafeInteger) ||
      !Object.values(value.decision).every((item) => typeof item === "boolean") ||
      (value.failure !== null && (!exactObject(value.failure, ["stage", "code"]) ||
        FAILURE_STAGES[value.failure.code] !== value.failure.stage)) ||
      (pass ? value.failure !== null : value.failure === null) ||
      (pass && value.storageInventory.some((item) => item.kind !== "directory")) ||
      (value.storageInventory.some((item) => item.kind === "symlink-drift") && value.failure?.code !== "PHASE1_STORAGE_INVENTORY_DRIFT") ||
      ![0, 1].includes(value.effects.sshInvocations) || ![0, 1].includes(value.effects.remoteConnections) ||
      value.effects.remoteConnections > value.effects.sshInvocations ||
      ["remoteWrites", "dockerMutations", "transferCalls", "prepareCalls", "launchCalls"].some((key) => value.effects[key] !== 0) ||
      value.decision.phase1Pass !== pass || value.decision.eligibleForTransfer !== pass ||
      value.decision.eligibleForPrepare !== false || value.decision.eligibleForLaunch !== false ||
      (pass && (value.effects.sshInvocations !== 1 || value.effects.remoteConnections !== 1 || value.checks.hostCapacityExact !== true ||
        !["meets-r12-planned-peak", "below-r12-planned-peak"].includes(value.checks.hostMemoryProfile) ||
        value.checks.hostLaunchMemoryEligible !== (value.checks.hostMemoryProfile === "meets-r12-planned-peak") ||
        !["at-least-256-mib", "below-256-mib"].includes(value.checks.hostMemoryAvailabilityProfile) ||
        value.checks.hostDiskProfile !== "r12-bundle-plus-256m" ||
        value.checks.flagsExact !== true || value.checks.featureProfile !== "disabled" ||
        value.checks.resourceLimitsExact !== true || value.checks.resourceProfile !== "r12-2c2g" || value.checks.publishedMountExact !== true ||
        value.checks.productionProjectExact !== true || value.checks.productionServicesExact !== true ||
        value.checks.r12NamespaceAbsent !== true || value.checks.oldUnitsInactive !== true ||
        value.checks.concurrentProcesses !== 0 || value.checks.historyEvidenceChecked !== true ||
        value.checks.historyProfile !== "r6-r8-controls-r8-backup-control-exact" || value.checks.active6StateExact !== true ||
        value.hostDiskObservation.headerExact !== true || value.hostDiskObservation.dataRowCount !== 1 ||
        value.hostDiskObservation.fieldCount !== 6 || value.hostDiskObservation.availableKiB === null ||
        !["root", "ancestor", "target"].includes(value.hostDiskObservation.mountProfile) ||
        value.hostDiskObservation.capacityProfile !== "sufficient")) ||
      (value.failure?.code === "PHASE1_HOST_DISK_FORMAT_DRIFT" &&
        (value.hostDiskObservation.mountProfile !== "unparsed" || value.hostDiskObservation.capacityProfile !== "unparsed")) ||
      (value.failure?.code === "PHASE1_HOST_DISK_MOUNT_DRIFT" && value.hostDiskObservation.mountProfile !== "invalid") ||
      (value.failure?.code === "PHASE1_HOST_DISK_CAPACITY_DRIFT" &&
        (value.hostDiskObservation.capacityProfile !== "insufficient" || value.hostDiskObservation.mountProfile === "invalid" ||
          value.hostDiskObservation.mountProfile === "unparsed"))) {
    throw new Error("invalid report");
  }
  safeReport(value);
  return true;
}

function report(status, failure, checks, sshInvocations, remoteConnections, storageInventory = [], hostDiskObservation = emptyDiskObservation()) {
  const pass = status === "pass";
  const value = {
    schema: SCHEMA,
    status,
    phase: "pre-transfer",
    failure,
    hostDiskObservation,
    storageInventory,
    checks,
    effects: {
      sshInvocations,
      remoteConnections,
      remoteWrites: 0,
      dockerMutations: 0,
      transferCalls: 0,
      prepareCalls: 0,
      launchCalls: 0
    },
    decision: {
      phase1Pass: pass,
      eligibleForTransfer: pass,
      eligibleForPrepare: false,
      eligibleForLaunch: false
    }
  };
  validateReport(value);
  return Object.freeze(value);
}

function emptyChecks() {
  return {
    hostCapacityExact: false,
    hostMemoryProfile: "unverified",
    hostLaunchMemoryEligible: false,
    hostMemoryAvailabilityProfile: "unverified",
    hostDiskProfile: "unverified",
    productionProjectExact: false,
    productionServicesExact: false,
    flagsExact: false,
    featureProfile: "unverified",
    resourceLimitsExact: false,
    resourceProfile: "unverified",
    publishedMountExact: false,
    r12NamespaceAbsent: false,
    oldUnitsInactive: false,
    concurrentProcesses: 0,
    historyEvidenceChecked: false,
    historyProfile: "unverified",
    active6StateExact: false
  };
}

function parseSections(stdout) {
  if (typeof stdout !== "string") throw new Phase1Error("protocol", "PHASE1_PROTOCOL_INVALID");
  if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) throw new Phase1Error("protocol", "PHASE1_OUTPUT_OVERSIZE");
  const lines = stdout.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const markers = lines.filter((line) => /^@@[A-Z0-9_]+@@$/.test(line));
  const expectedMarkers = ["@@AIHUB_R12_PHASE1_V1@@", ...SECTION_ORDER.map((name) => `@@${name}@@`), "@@END@@"];
  if (markers.length !== expectedMarkers.length || markers.some((marker, index) => marker !== expectedMarkers[index]) ||
      lines[0] !== expectedMarkers[0] || lines.at(-1) !== "@@END@@") {
    throw new Phase1Error("protocol", "PHASE1_PROTOCOL_INVALID");
  }
  const sections = {};
  for (let index = 0; index < SECTION_ORDER.length; index += 1) {
    const start = lines.indexOf(`@@${SECTION_ORDER[index]}@@`) + 1;
    const end = lines.indexOf(index + 1 < SECTION_ORDER.length ? `@@${SECTION_ORDER[index + 1]}@@` : "@@END@@");
    if (start < 1 || end < start) throw new Phase1Error("protocol", "PHASE1_PROTOCOL_INVALID");
    sections[SECTION_ORDER[index]] = lines.slice(start, end).join("\n");
  }
  return sections;
}

function inspectDisk(lines) {
  const header = "Filesystem 1024-blocks Used Available Capacity Mounted on";
  const headerIndexes = lines.flatMap((line, index) => line === header ? [index] : []);
  const headerExact = headerIndexes.length === 1 && headerIndexes[0] === 5;
  const rows = headerExact ? lines.slice(6) : [];
  const row = rows.length === 1 ? rows[0] : null;
  const fields = row === null || row === "" ? [] : row.trim().split(/\s+/);
  const base = {
    headerExact,
    dataRowCount: rows.length,
    fieldCount: fields.length,
    availableKiB: null,
    requiredKiB: DISK_TRANSFER_MIN_KIB,
    mountProfile: "unparsed",
    capacityProfile: "unparsed"
  };
  const integersExact = fields.length === 6 && fields.slice(1, 4).every((field) =>
    /^(?:0|[1-9][0-9]*)$/.test(field) && Number.isSafeInteger(Number(field)));
  const capacityPercent = /^(?:0|[1-9][0-9]*)%$/.test(fields[4] || "")
    ? Number(fields[4].slice(0, -1)) : NaN;
  if (!headerExact || rows.length !== 1 || row !== row.trim() || /[\t\r]/.test(row) || !integersExact ||
      !Number.isSafeInteger(capacityPercent) || capacityPercent < 0 || capacityPercent > 100) {
    return { observation: base, failure: ["host-disk-format", "PHASE1_HOST_DISK_FORMAT_DRIFT"] };
  }
  const availableKiB = Number(fields[3]);
  const mountPoint = fields[5];
  const normalizedMountPoint = path.posix.normalize(mountPoint);
  const mountProfile = mountPoint === "/" ? "root" : mountPoint === "/opt/zhenxing-ai" ? "target" :
    mountPoint.startsWith("/") && mountPoint === normalizedMountPoint && "/opt/zhenxing-ai".startsWith(`${mountPoint}/`)
      ? "ancestor" : "invalid";
  const observation = {
    ...base,
    availableKiB,
    mountProfile,
    capacityProfile: availableKiB >= DISK_TRANSFER_MIN_KIB ? "sufficient" : "insufficient"
  };
  if (mountProfile === "invalid") {
    return { observation, failure: ["host-disk-mount", "PHASE1_HOST_DISK_MOUNT_DRIFT"] };
  }
  if (observation.capacityProfile === "insufficient") {
    return { observation, failure: ["host-disk-capacity", "PHASE1_HOST_DISK_CAPACITY_DRIFT"] };
  }
  return { observation, failure: null };
}

function validateHost(text) {
  const lines = text.split("\n");
  const uid = Number(lines[0]);
  const gid = Number(lines[1]);
  const cpus = Number(lines[2]);
  const totalLines = lines.filter((line) => /^MemTotal:\s+\d+ kB$/.test(line));
  const availableLines = lines.filter((line) => /^MemAvailable:\s+\d+ kB$/.test(line));
  const totalKiB = Number(totalLines[0]?.match(/\d+/)?.[0]);
  const availableKiB = Number(availableLines[0]?.match(/\d+/)?.[0]);
  const disk = inspectDisk(lines);
  if (uid !== 1000 || gid !== 1000) throw new Phase1Error("host-identity", "PHASE1_HOST_IDENTITY_DRIFT", disk.observation);
  if (!Number.isSafeInteger(cpus) || cpus < 2) throw new Phase1Error("host-cpu", "PHASE1_HOST_CPU_DRIFT", disk.observation);
  if (totalLines.length !== 1 || availableLines.length !== 1 || !Number.isSafeInteger(totalKiB) ||
      !Number.isSafeInteger(availableKiB) || availableKiB <= 0 || availableKiB > totalKiB) {
    throw new Phase1Error("host-memory-metadata", "PHASE1_HOST_MEMORY_METADATA_INVALID", disk.observation);
  }
  if (totalKiB < MEMORY_TRANSFER_MIN_KIB) throw new Phase1Error("host-memory-total", "PHASE1_HOST_MEMORY_TOTAL_DRIFT", disk.observation);
  if (disk.failure) throw new Phase1Error(disk.failure[0], disk.failure[1], disk.observation);
  return {
    memoryProfile: totalKiB >= MEMORY_TOTAL_MIN_KIB ? "meets-r12-planned-peak" : "below-r12-planned-peak",
    memoryAvailabilityProfile: availableKiB >= MEMORY_AVAILABLE_MIN_KIB ? "at-least-256-mib" : "below-256-mib",
    diskProfile: "r12-bundle-plus-256m",
    diskObservation: disk.observation
  };
}

function validateProject(text) {
  const ids = text.split("\n").filter(Boolean);
  if (ids.length !== 6 || new Set(ids).size !== 6 || ids.some((id) => !/^[a-f0-9]{12,64}$/.test(id))) {
    throw new Phase1Error("project-inventory", "PHASE1_PROJECT_DRIFT");
  }
}

function validateServices(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Phase1Error("service-inventory", "PHASE1_SERVICE_DRIFT"); }
  if (!Array.isArray(raw) || raw.length !== SERVICES.length) throw new Phase1Error("service-inventory", "PHASE1_SERVICE_DRIFT");
  const inspectAll = {};
  for (const service of SERVICES) {
    const matches = raw.filter((item) => item?.Name === `/${service.containerName}`);
    if (matches.length !== 1) throw new Phase1Error("service-inventory", "PHASE1_SERVICE_DRIFT");
    inspectAll[service.key] = matches[0];
  }
  try { validateProductionServices(inspectAll, "baseline"); } catch { throw new Phase1Error("service-inventory", "PHASE1_SERVICE_DRIFT"); }
  for (const service of SERVICES) {
    const expected = RESOURCE_LIMITS[service.key];
    const actual = inspectAll[service.key]?.HostConfig;
    if (!expected || !actual || actual.Memory !== expected.Memory || actual.NanoCpus !== expected.NanoCpus || actual.PidsLimit !== expected.PidsLimit) {
      throw new Phase1Error("service-inventory", "PHASE1_RESOURCE_LIMITS_DRIFT");
    }
  }
  const identityEnvironment = inspectAll.identity?.Config?.Env;
  if (!Array.isArray(identityEnvironment)) throw new Phase1Error("service-inventory", "PHASE1_FLAGS_DRIFT");
  const governed = identityEnvironment.filter((entry) => /^(?:AIHUB_RESOURCE_SUBMISSIONS_|AIHUB_WORKFLOW_STORE_|AIHUB_WORKFLOW_PUBLIC_STORE_|AIHUB_WORKFLOW_SUBMISSION_LOOKUP_)/.test(entry));
  const parsed = governed.map((entry) => entry.match(/^([^=]+)=(.*)$/)).filter(Boolean);
  if (parsed.length !== DISABLED_FLAGS.length || new Set(parsed.map((match) => match[1])).size !== DISABLED_FLAGS.length ||
      parsed.some((match) => !DISABLED_FLAGS.includes(match[1]) || match[2] !== "0") ||
      DISABLED_FLAGS.some((name) => !parsed.some((match) => match[1] === name))) {
    throw new Phase1Error("service-inventory", "PHASE1_FLAGS_DRIFT");
  }
  const published = (inspectAll.admin?.Mounts || []).filter((mount) => mount?.Destination === "/app/admin/published");
  if (published.length !== 1 || published[0].Type !== "bind" || published[0].RW !== true ||
      typeof published[0].Source !== "string" || !published[0].Source.startsWith("/opt/zhenxing-ai/") ||
      path.posix.normalize(published[0].Source) !== published[0].Source) {
    throw new Phase1Error("service-inventory", "PHASE1_PUBLISHED_MOUNT_DRIFT");
  }
}

function validateNamespace(text) {
  const lines = text.split("\n");
  if (lines.length !== NAMESPACE_LINES.length || lines.some((line, index) => line !== NAMESPACE_LINES[index])) {
    throw new Phase1Error("r12-namespace", "PHASE1_R12_NAMESPACE_PRESENT");
  }
}

function validateUnits(text) {
  const lines = text.split("\n");
  if (lines.length !== UNIT_NAMES.length * 4) throw new Phase1Error("durable-units", "PHASE1_OLD_UNIT_ACTIVE");
  for (let index = 0; index < UNIT_NAMES.length; index += 1) {
    const group = lines.slice(index * 4, index * 4 + 4);
    const expectedLoad = index === UNIT_NAMES.length - 1 ? ["LoadState=not-found"] : ["LoadState=not-found", "LoadState=loaded"];
    if (group[0] !== UNIT_NAMES[index] || !expectedLoad.includes(group[1]) || group[2] !== "ActiveState=inactive" || group[3] !== "SubState=dead") {
      throw new Phase1Error("durable-units", index === UNIT_NAMES.length - 1 ? "PHASE1_R12_UNIT_PRESENT" : "PHASE1_OLD_UNIT_ACTIVE");
    }
  }
}

function validateProcesses(text) {
  if (text !== "0") throw new Phase1Error("process-inventory", "PHASE1_CONCURRENT_PROCESS");
}

function validateHistory(text) {
  if (text !== "r6=controls-present\nr7=controls-present\nr8=controls-present\nr8-backup-control=exact") {
    throw new Phase1Error("history-evidence", "PHASE1_HISTORY_EVIDENCE_DRIFT");
  }
}

function validateState(text) {
  const lines = text.split("\n");
  const metadata = lines[0]?.split("\t");
  const digest = lines[1]?.match(/^([a-f0-9]{64})  \/app\/admin\/published\/catalog-store\/state\.json$/);
  if (lines.length !== 2 || !metadata || metadata.length !== 6 || metadata[0] !== "1000" || metadata[1] !== "1000" ||
      metadata[2] !== "600" || metadata[3] !== "1" || metadata[4] !== "regular file" ||
      !Number.isSafeInteger(Number(metadata[5])) || Number(metadata[5]) < 1 || !digest || digest[1] !== R12.active6.stateSha256) {
    throw new Phase1Error("active6-state", "PHASE1_ACTIVE6_STATE_DRIFT");
  }
}

function validateInventory(sections, host) {
  const checks = emptyChecks();
  checks.hostCapacityExact = true; checks.hostMemoryProfile = host.memoryProfile;
  checks.hostLaunchMemoryEligible = host.memoryProfile === "meets-r12-planned-peak";
  checks.hostMemoryAvailabilityProfile = host.memoryAvailabilityProfile;
  checks.hostDiskProfile = host.diskProfile;
  validateProject(sections.PROJECT); checks.productionProjectExact = true;
  validateServices(sections.SERVICES); checks.productionServicesExact = true; checks.flagsExact = true; checks.featureProfile = "disabled";
  checks.resourceLimitsExact = true; checks.resourceProfile = "r12-2c2g"; checks.publishedMountExact = true;
  validateNamespace(sections.NAMESPACE); checks.r12NamespaceAbsent = true;
  validateUnits(sections.UNITS); checks.oldUnitsInactive = true;
  validateProcesses(sections.PROCESSES); checks.concurrentProcesses = 0;
  validateHistory(sections.HISTORY); checks.historyEvidenceChecked = true; checks.historyProfile = "r6-r8-controls-r8-backup-control-exact";
  validateState(sections.STATE); checks.active6StateExact = true;
  return checks;
}

function remoteConnectionCount(stdout) {
  return typeof stdout === "string" && /^(?:@@AIHUB_R12_PHASE1_V1@@)(?:\r?\n)/.test(stdout) ? 1 : 0;
}

function runPhase1({ spawnSyncImpl = childProcess.spawnSync } = {}) {
  let result;
  try {
    result = spawnSyncImpl(SSH_PATH, SSH_ARGS, {
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES
    });
  } catch {
    return report("blocked", { stage: "ssh-transport", code: "PHASE1_SSH_SPAWN_FAILED" }, emptyChecks(), 1, 0);
  }
  const remoteConnections = remoteConnectionCount(result?.stdout);
  if (result?.error?.code === "ETIMEDOUT") return report("blocked", { stage: "ssh-transport", code: "PHASE1_SSH_TIMEOUT" }, emptyChecks(), 1, remoteConnections);
  if (result?.error?.code === "ENOBUFS") return report("blocked", { stage: "ssh-transport", code: "PHASE1_SSH_OUTPUT_OVERSIZE" }, emptyChecks(), 1, remoteConnections);
  if (result?.error) return report("blocked", { stage: "ssh-transport", code: "PHASE1_SSH_SPAWN_FAILED" }, emptyChecks(), 1, remoteConnections);
  if (result?.signal) return report("blocked", { stage: "ssh-transport", code: "PHASE1_SSH_SIGNAL" }, emptyChecks(), 1, remoteConnections);
  if (result?.status !== 0) return report("blocked", { stage: "ssh-transport", code: "PHASE1_SSH_NONZERO" }, emptyChecks(), 1, remoteConnections);
  if (result?.stderr !== "") return report("blocked", { stage: "ssh-transport", code: "PHASE1_SSH_DIAGNOSTIC_OUTPUT" }, emptyChecks(), 1, remoteConnections);
  let storageInventory = [];
  let hostDiskObservation = emptyDiskObservation();
  try {
    const sections = parseSections(result.stdout);
    const storage = parseStorage(sections.STORAGE);
    storageInventory = storage.inventory;
    if (storage.symlinkDrift) throw new Phase1Error("storage-inventory", "PHASE1_STORAGE_INVENTORY_DRIFT");
    const host = validateHost(sections.HOST);
    hostDiskObservation = host.diskObservation;
    const checks = validateInventory(sections, host);
    return report("pass", null, checks, 1, 1, storageInventory, hostDiskObservation);
  } catch (error) {
    if (error instanceof Phase1Error && error.hostDiskObservation) hostDiskObservation = error.hostDiskObservation;
    const failure = error instanceof Phase1Error
      ? { stage: error.stage, code: error.code }
      : { stage: "protocol", code: "PHASE1_PROTOCOL_INVALID" };
    return report("blocked", failure, emptyChecks(), 1, remoteConnections, storageInventory, hostDiskObservation);
  }
}

function runCli(argv = process.argv, dependencies = {}) {
  return argv.length === 2
    ? runPhase1(dependencies)
    : report("blocked", { stage: "local-cli", code: "PHASE1_CLI_INVALID" }, emptyChecks(), 0, 0);
}

function main() {
  const value = runCli();
  process.stdout.write(`${JSON.stringify(value)}\n`);
  if (value.status !== "pass") process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  BUNDLE_BYTES,
  DISK_TRANSFER_MIN_KIB,
  MAX_OUTPUT_BYTES,
  REMOTE_COMMAND,
  SSH_ARGS,
  SSH_PATH,
  TIMEOUT_MS,
  TRANSFER_HEADROOM_BYTES,
  parseSections,
  parseStorage,
  runCli,
  runPhase1,
  validateReport
};
