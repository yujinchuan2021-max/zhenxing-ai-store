"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { SERVICES } = require("../deployment/community-production/workflow-production-service-contract.cjs");
const { R12 } = require("../deployment/community-production/workflow-production-r12-in-place.cjs");
const launcher = require("../scripts/workflow-production-r12-phase1-readonly.cjs");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "scripts", "workflow-production-r12-phase1-readonly.cjs");
const bundlePath = path.join(root, "output", "workflow-production-r12-15620c86-20260810.bundle");
const BUNDLE_BYTES = 539694770;
const TRANSFER_HEADROOM_BYTES = 256 * 1024 * 1024;
const DISK_TRANSFER_MIN_KIB = Math.ceil((BUNDLE_BYTES + TRANSFER_HEADROOM_BYTES) / 1024);
const units = Array.from({ length: 8 }, (_, index) => `zhenxing-ai-workflow-production-r${index + 5}.service`);
const flags = [
  "AIHUB_RESOURCE_SUBMISSIONS_ENABLED",
  "AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION",
  "AIHUB_WORKFLOW_STORE_ENABLED",
  "AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED",
  "AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED",
  "AIHUB_WORKFLOW_STORE_SCHEMA_VERSION"
];
const limits = Object.freeze({
  admin: [201326592, 750000000, 128],
  identityDatabase: [268435456, 400000000, 192],
  identity: [201326592, 350000000, 128],
  communityDatabase: [335544320, 450000000, 384],
  community: [335544320, 450000000, 256],
  caddy: [67108864, 150000000, 128]
});

function inspectFixture() {
  return SERVICES.map((service, index) => {
    const image = service.baseline;
    return {
      Id: `sha256:${String(index + 1).repeat(64)}`,
      Name: `/${service.containerName}`,
      Image: image.id || `sha256:${String(index + 1).repeat(64)}`,
      Config: {
        Image: image.tag,
        Env: service.key === "identity" ? flags.map((name) => `${name}=0`) : [],
        User: image.user || "",
        Labels: {
          "com.docker.compose.project": "zhenxing-community-production",
          "com.docker.compose.service": service.composeService,
          ...(image.source ? {
            "com.aihub.source-content-sha256": image.source,
            "com.aihub.source-revision": image.revision
          } : {}),
          ...(image.release ? { "com.aihub.release-version": image.release } : {})
        }
      },
      State: { Health: { Status: "healthy" } },
      HostConfig: {
        Memory: limits[service.key][0],
        NanoCpus: limits[service.key][1],
        PidsLimit: limits[service.key][2]
      },
      Mounts: service.key === "admin" ? [{
        Type: "bind",
        Source: "/opt/zhenxing-ai/shared/admin-published",
        Destination: "/app/admin/published",
        RW: true
      }] : []
    };
  });
}

function section(name, body) {
  return `@@${name}@@\n${body}\n`;
}

function passStdout() {
  const unitState = units.flatMap((unit) => [
    unit,
    "LoadState=not-found",
    "ActiveState=inactive",
    "SubState=dead"
  ]).join("\n");
  return [
    "@@AIHUB_R12_PHASE1_V1@@\n",
    section("HOST", [
      "1000",
      "1000",
      "2",
      "MemTotal:        2013260 kB",
      "MemAvailable:     393216 kB",
      "Filesystem 1024-blocks Used Available Capacity Mounted on",
      "/dev/root 16777216 4194304 12582912 25% /opt/zhenxing-ai"
    ].join("\n")),
    section("PROJECT", Array.from({ length: 6 }, (_, index) => String(index + 1).repeat(64)).join("\n")),
    section("SERVICES", JSON.stringify(inspectFixture(), null, 2)),
    section("NAMESPACE", ["control=absent", "evidence=absent", "release=absent", "staging=absent"].join("\n")),
    section("UNITS", unitState),
    section("PROCESSES", "0"),
    section("HISTORY", [
      "r6=controls-present",
      "r7=controls-present",
      "r8=controls-present",
      "r8-backup-control=exact"
    ].join("\n")),
    section("STATE", `1000\t1000\t600\t1\tregular file\t1521912\n${R12.active6.stateSha256}  /app/admin/published/catalog-store/state.json`),
    section("STORAGE", storageLines.join("\n")),
    "@@END@@\n"
  ].join("");
}

const storageLines = [
  "release\tcommunity-production-r6-retained\t100\tdirectory",
  "release\tcommunity-production-r7-retained\t200\tdirectory",
  "staging\tcommunity-production-r8-retained.bundle\t300\tdirectory",
  "backup\tcommunity-production-20260809T152002Z\t400\tdirectory",
  "backup\tworkflow-production-r6-evidence\t500\tdirectory",
  "backup\tworkflow-production-r7-evidence\t600\tdirectory",
  "backup\tworkflow-production-r8-evidence\t700\tdirectory"
];

function withStorage(stdout = passStdout(), lines = storageLines) {
  return stdout.replace(/@@STORAGE@@\n[\s\S]*?\n@@END@@\n$/, `${section("STORAGE", lines.join("\n"))}@@END@@\n`);
}

function result(stdout = passStdout(), overrides = {}) {
  return { status: 0, signal: null, error: undefined, stdout, stderr: "", ...overrides };
}

function runWith(output = result()) {
  const calls = [];
  const report = launcher.runPhase1({
    spawnSyncImpl(file, args, options) {
      calls.push({ file, args, options });
      return output;
    }
  });
  return { calls, report };
}

function recursiveFileBytes(directory) {
  let total = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) total += recursiveFileBytes(child);
    else if (entry.isFile()) total += fs.statSync(child).size;
  }
  return total;
}

test("fixed launcher invokes exactly one strict SSH process without a shell", () => {
  const { calls, report } = runWith();
  assert.equal(report.status, "pass");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, launcher.SSH_PATH);
  assert.deepEqual(calls[0].args, launcher.SSH_ARGS);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.input, undefined);
  assert.equal(calls[0].options.timeout, launcher.TIMEOUT_MS);
  assert.equal(calls[0].options.maxBuffer, launcher.MAX_OUTPUT_BYTES);
  assert.deepEqual(report.effects, {
    sshInvocations: 1,
    remoteConnections: 1,
    remoteWrites: 0,
    dockerMutations: 0,
    transferCalls: 0,
    prepareCalls: 0,
    launchCalls: 0
  });

  const attempted = [];
  launcher.runPhase1({
    host: "override.invalid",
    remoteCommand: "override",
    identityFile: "override",
    spawnSyncImpl(file, args, options) {
      attempted.push({ file, args, options });
      return result();
    }
  });
  assert.equal(attempted.length, 1);
  assert.equal(attempted[0].file, launcher.SSH_PATH);
  assert.deepEqual(attempted[0].args, launcher.SSH_ARGS);
});

test("transfer capacity separates total memory from transient available-memory pressure", () => {
  assert.equal(runWith().report.status, "pass");
  assert.equal(runWith().report.checks.hostMemoryProfile, "meets-r12-planned-peak");
  assert.equal(runWith().report.checks.hostMemoryAvailabilityProfile, "at-least-256-mib");
  const pressured = runWith(result(passStdout().replace("MemAvailable:     393216 kB", "MemAvailable:     131072 kB"))).report;
  assert.equal(pressured.status, "pass");
  assert.equal(pressured.checks.hostMemoryAvailabilityProfile, "below-256-mib");
  assert.equal(pressured.decision.eligibleForTransfer, true);
  assert.equal(pressured.decision.eligibleForPrepare, false);
  assert.equal(pressured.decision.eligibleForLaunch, false);
  const insufficientTotal = passStdout().replace("MemTotal:        2013260 kB", "MemTotal:         524287 kB");
  assert.equal(runWith(result(insufficientTotal)).report.failure.code, "PHASE1_HOST_MEMORY_TOTAL_DRIFT");
});

test("pre-transfer capacity permits valid sub-peak memory without declaring launch eligibility", () => {
  const atBoundary = passStdout().replace("MemTotal:        2013260 kB", "MemTotal:        1703936 kB");
  assert.equal(runWith(result(atBoundary)).report.status, "pass");
  assert.equal(runWith(result(atBoundary)).report.checks.hostMemoryProfile, "meets-r12-planned-peak");
  assert.equal(runWith(result(atBoundary)).report.checks.hostLaunchMemoryEligible, true);
  const oneKiBBelow = passStdout().replace("MemTotal:        2013260 kB", "MemTotal:        1703935 kB");
  assert.equal(runWith(result(oneKiBBelow)).report.status, "pass");
  assert.equal(runWith(result(oneKiBBelow)).report.checks.hostMemoryProfile, "below-r12-planned-peak");
  assert.equal(runWith(result(oneKiBBelow)).report.checks.hostLaunchMemoryEligible, false);
  const serverRange = passStdout().replace("MemTotal:        2013260 kB", "MemTotal:        1572864 kB");
  const report = runWith(result(serverRange)).report;
  assert.equal(report.status, "pass");
  assert.equal(report.decision.eligibleForTransfer, true);
  assert.equal(report.decision.eligibleForPrepare, false);
  assert.equal(report.decision.eligibleForLaunch, false);
  assert.equal(report.checks.hostLaunchMemoryEligible, false);
  const atTransferMinimum = passStdout().replace("MemTotal:        2013260 kB", "MemTotal:         524288 kB");
  assert.equal(runWith(result(atTransferMinimum)).report.status, "pass");
  const oneKiBBelowTransferMinimum = passStdout().replace("MemTotal:        2013260 kB", "MemTotal:         524287 kB");
  assert.equal(runWith(result(oneKiBBelowTransferMinimum)).report.failure.code, "PHASE1_HOST_MEMORY_TOTAL_DRIFT");
  assert.throws(() => launcher.validateReport({ ...report, checks: { ...report.checks, hostLaunchMemoryEligible: true } }));
  assert.throws(() => launcher.validateReport({ ...runWith(result(atBoundary)).report, checks: { ...runWith(result(atBoundary)).report.checks, hostLaunchMemoryEligible: false } }));
});

test("host capacity failures distinguish identity, cpu, memory metadata, and disk", () => {
  const cases = [
    [passStdout().replace("1000\n1000\n2", "0\n1000\n2"), "PHASE1_HOST_IDENTITY_DRIFT"],
    [passStdout().replace("1000\n1000\n2", "1000\n1000\n1"), "PHASE1_HOST_CPU_DRIFT"],
    [passStdout().replace("MemAvailable:     393216 kB", "MemAvailable:          0 kB"), "PHASE1_HOST_MEMORY_METADATA_INVALID"],
    [passStdout().replace("MemAvailable:     393216 kB", "MemAvailable:     9999999 kB"), "PHASE1_HOST_MEMORY_METADATA_INVALID"],
    [passStdout().replace("MemAvailable:     393216 kB", "MemAvailable:     393216 kB\nMemAvailable:     393216 kB"), "PHASE1_HOST_MEMORY_METADATA_INVALID"],
    [passStdout().replace("/dev/root 16777216 4194304 12582912 25% /opt/zhenxing-ai", `/dev/root 16777216 4194304 ${DISK_TRANSFER_MIN_KIB - 1} 75% /opt/zhenxing-ai`), "PHASE1_HOST_DISK_CAPACITY_DRIFT"]
  ];
  for (const [stdout, code] of cases) assert.equal(runWith(result(stdout)).report.failure.code, code);
});

test("transfer disk capacity derives from the actual frozen bundle plus fixed headroom", () => {
  assert.equal(recursiveFileBytes(bundlePath), BUNDLE_BYTES);
  assert.equal(launcher.BUNDLE_BYTES, BUNDLE_BYTES);
  assert.equal(launcher.TRANSFER_HEADROOM_BYTES, TRANSFER_HEADROOM_BYTES);
  assert.equal(launcher.DISK_TRANSFER_MIN_KIB, DISK_TRANSFER_MIN_KIB);
  const atBoundary = passStdout().replace("/dev/root 16777216 4194304 12582912 25% /opt/zhenxing-ai", `/dev/root 16777216 4194304 ${DISK_TRANSFER_MIN_KIB} 75% /opt/zhenxing-ai`);
  const report = runWith(result(atBoundary)).report;
  assert.equal(report.status, "pass");
  assert.equal(report.checks.hostDiskProfile, "r12-bundle-plus-256m");
  assert.equal(report.decision.eligibleForTransfer, true);
  assert.equal(report.decision.eligibleForPrepare, false);
  assert.equal(report.decision.eligibleForLaunch, false);
  const oneKiBBelow = atBoundary.replace(`${DISK_TRANSFER_MIN_KIB} 75%`, `${DISK_TRANSFER_MIN_KIB - 1} 75%`);
  assert.equal(runWith(result(oneKiBBelow)).report.failure.code, "PHASE1_HOST_DISK_CAPACITY_DRIFT");
});

test("disk gate accepts rootfs or an ancestor mount and rejects malformed mount ownership", () => {
  const original = "/dev/root 16777216 4194304 12582912 25% /opt/zhenxing-ai";
  const usableRootfs = `/dev/root 16777216 4194304 ${DISK_TRANSFER_MIN_KIB} 75% /`;
  const usableAncestor = `/dev/root 16777216 4194304 ${DISK_TRANSFER_MIN_KIB} 75% /opt`;
  const usableDedicated = `/dev/root 16777216 4194304 ${DISK_TRANSFER_MIN_KIB} 75% /opt/zhenxing-ai`;
  assert.equal(runWith(result(passStdout().replace(original, usableRootfs))).report.status, "pass");
  assert.equal(runWith(result(passStdout().replace(original, usableAncestor))).report.hostDiskObservation.mountProfile, "ancestor");
  assert.equal(runWith(result(passStdout().replace(original, usableDedicated))).report.status, "pass");
  const invalidRows = [
    [`/dev/root 16777216 4194304 ${DISK_TRANSFER_MIN_KIB - 1} 75% /`, "PHASE1_HOST_DISK_CAPACITY_DRIFT"],
    [`/dev/root 16777216 4194304 ${DISK_TRANSFER_MIN_KIB} 75% opt/zhenxing-ai`, "PHASE1_HOST_DISK_MOUNT_DRIFT"],
    [`/dev/root 16777216 4194304 ${DISK_TRANSFER_MIN_KIB} 75% /var`, "PHASE1_HOST_DISK_MOUNT_DRIFT"],
    [`/dev/root 16777216 4194304 ${DISK_TRANSFER_MIN_KIB} 75% /opt/zhenxing-ai-other`, "PHASE1_HOST_DISK_MOUNT_DRIFT"],
    ["/dev/root 16777216 4194304 not-a-number 75% /", "PHASE1_HOST_DISK_FORMAT_DRIFT"],
    ["/dev/root 16777216 4194304 -1 75% /", "PHASE1_HOST_DISK_FORMAT_DRIFT"],
    ["/dev/root 16777216 4194304 999999999999999999999 75% /", "PHASE1_HOST_DISK_FORMAT_DRIFT"]
  ];
  for (const [row, code] of invalidRows) {
    assert.equal(runWith(result(passStdout().replace(original, row))).report.failure.code, code);
  }
  const duplicated = passStdout().replace(original, `${usableRootfs}\n${usableRootfs}`);
  const extraHeader = passStdout().replace("Filesystem 1024-blocks Used Available Capacity Mounted on", "Filesystem 1024-blocks Used Available Capacity Mounted on\nFilesystem 1024-blocks Used Available Capacity Mounted on");
  const blankData = passStdout().replace(original, `${usableRootfs}\n`);
  for (const stdout of [duplicated, extraHeader, blankData]) {
    assert.equal(runWith(result(stdout)).report.failure.code, "PHASE1_HOST_DISK_FORMAT_DRIFT");
  }
});

test("disk diagnostics classify format, mount ownership, and capacity without raw host data", () => {
  const original = "/dev/root 16777216 4194304 12582912 25% /opt/zhenxing-ai";
  const cloudRoot = "/dev/root 52428800 15372165 37056635 30% /";
  const cloud = runWith(result(passStdout().replace(original, cloudRoot))).report;
  assert.equal(cloud.status, "pass");
  assert.deepEqual(cloud.hostDiskObservation, {
    headerExact: true,
    dataRowCount: 1,
    fieldCount: 6,
    availableKiB: 37056635,
    requiredKiB: DISK_TRANSFER_MIN_KIB,
    mountProfile: "root",
    capacityProfile: "sufficient"
  });

  const lowAvailable = DISK_TRANSFER_MIN_KIB - 1;
  const capacity = runWith(result(passStdout().replace(
    original,
    `/dev/root 52428800 15372165 ${lowAvailable} 99% /`
  ))).report;
  assert.deepEqual(capacity.failure, {
    stage: "host-disk-capacity",
    code: "PHASE1_HOST_DISK_CAPACITY_DRIFT"
  });
  assert.deepEqual(capacity.hostDiskObservation, {
    headerExact: true,
    dataRowCount: 1,
    fieldCount: 6,
    availableKiB: lowAvailable,
    requiredKiB: DISK_TRANSFER_MIN_KIB,
    mountProfile: "root",
    capacityProfile: "insufficient"
  });

  for (const row of [
    ` /dev/root 52428800 15372165 ${DISK_TRANSFER_MIN_KIB} 30% /`,
    `/dev/root 52428800 15372165 ${DISK_TRANSFER_MIN_KIB} 30% / extra`
  ]) {
    const format = runWith(result(passStdout().replace(original, row))).report;
    assert.deepEqual(format.failure, {
      stage: "host-disk-format",
      code: "PHASE1_HOST_DISK_FORMAT_DRIFT"
    });
    assert.equal(format.hostDiskObservation.headerExact, true);
    assert.equal(format.hostDiskObservation.dataRowCount, 1);
    assert.equal(format.hostDiskObservation.fieldCount, row.trim().split(/\s+/).length);
    assert.equal(format.hostDiskObservation.availableKiB, null);
    assert.equal(format.hostDiskObservation.mountProfile, "unparsed");
    assert.equal(format.hostDiskObservation.capacityProfile, "unparsed");
  }

  const mount = runWith(result(passStdout().replace(
    original,
    `/dev/root 52428800 15372165 ${DISK_TRANSFER_MIN_KIB} 30% /var`
  ))).report;
  assert.deepEqual(mount.failure, {
    stage: "host-disk-mount",
    code: "PHASE1_HOST_DISK_MOUNT_DRIFT"
  });
  assert.equal(mount.hostDiskObservation.mountProfile, "invalid");
  assert.equal(mount.hostDiskObservation.capacityProfile, "sufficient");

  const overflow = runWith(result(passStdout().replace(
    original,
    "/dev/root 52428800 15372165 999999999999999999999 30% /"
  ))).report;
  assert.deepEqual(overflow.failure, {
    stage: "host-disk-format",
    code: "PHASE1_HOST_DISK_FORMAT_DRIFT"
  });
  assert.equal(overflow.hostDiskObservation.availableKiB, null);
  assert.doesNotMatch(JSON.stringify(overflow), /999999999999999999999|\/dev\/root/);

  const history = runWith(result(passStdout().replace("r8=controls-present", "r8=drift"))).report;
  assert.deepEqual(history.failure, { stage: "history-evidence", code: "PHASE1_HISTORY_EVIDENCE_DRIFT" });
  assert.equal(history.hostDiskObservation.capacityProfile, "sufficient");
  assert.equal(history.hostDiskObservation.mountProfile, "target");
});

test("valid storage inventory survives the host-disk transfer gate without authorizing transfer", () => {
  const lowDisk = withStorage(passStdout().replace(
    "/dev/root 16777216 4194304 12582912 25% /opt/zhenxing-ai",
    `/dev/root 16777216 4194304 ${DISK_TRANSFER_MIN_KIB - 1} 75% /opt/zhenxing-ai`
  ));
  const report = runWith(result(lowDisk)).report;
  assert.equal(report.status, "blocked");
  assert.deepEqual(report.failure, { stage: "host-disk-capacity", code: "PHASE1_HOST_DISK_CAPACITY_DRIFT" });
  assert.deepEqual(report.storageInventory, storageLines.map((line) => {
    const [scope, name, sizeKiB, kind] = line.split("\t");
    return { scope, name, sizeKiB: Number(sizeKiB), kind };
  }));
  assert.equal(report.decision.eligibleForTransfer, false);
  assert.equal(report.decision.eligibleForPrepare, false);
  assert.equal(report.decision.eligibleForLaunch, false);
});

test("storage inventory rejects unknown, duplicate, unordered, unbounded, or unsafe rows", () => {
  const tooMany = Array.from({ length: 65 }, (_, index) =>
    `release\tcommunity-production-r6-${String(index).padStart(2, "0")}\t1\tdirectory`);
  const oversized = Array.from({ length: 64 }, (_, index) =>
    `release\tcommunity-production-${"a".repeat(220)}-${String(index).padStart(2, "0")}\t1\tdirectory`);
  const cases = [
    ["unknown scope", ["other\tcommunity-production-r6\t1\tdirectory"]],
    ["unknown release name", ["release\tunrelated\t1\tdirectory"]],
    ["staging without bundle suffix", ["staging\tcommunity-production-r6\t1\tdirectory"]],
    ["unknown evidence generation", ["backup\tworkflow-production-r13-evidence\t1\tdirectory"]],
    ["duplicate", [storageLines[0], storageLines[0]]],
    ["order drift", [storageLines[1], storageLines[0]]],
    ["scope limit", tooMany],
    ["json limit", oversized],
    ["noninteger", ["release\tcommunity-production-r6\t1.5\tdirectory"]],
    ["negative", ["release\tcommunity-production-r6\t-1\tdirectory"]],
    ["raw path", ["release\tcommunity-production-../../escape\t1\tdirectory"]],
    ["sensitive name", ["release\tcommunity-production-secret\t1\tdirectory"]],
    ["unknown kind", ["release\tcommunity-production-r6\t1\tfile"]]
  ];
  for (const [label, lines] of cases) {
    const report = runWith(result(withStorage(passStdout(), lines))).report;
    assert.equal(report.status, "blocked", label);
    assert.deepEqual(report.failure, { stage: "storage-inventory", code: "PHASE1_STORAGE_INVENTORY_DRIFT" }, label);
    assert.deepEqual(report.storageInventory, [], label);
  }
});

test("storage symlinks are reported as fixed drift and never pass Phase1", () => {
  const lines = [...storageLines];
  lines[0] = "release\tcommunity-production-r6-retained\t0\tsymlink-drift";
  const report = runWith(result(withStorage(passStdout(), lines))).report;
  assert.equal(report.status, "blocked");
  assert.deepEqual(report.failure, { stage: "storage-inventory", code: "PHASE1_STORAGE_INVENTORY_DRIFT" });
  assert.equal(report.storageInventory[0].kind, "symlink-drift");
  assert.equal(report.decision.eligibleForTransfer, false);
});

test("valid storage inventory does not replace another Phase1 failure", () => {
  const report = runWith(result(passStdout().replace("r8=controls-present", "r8=drift"))).report;
  assert.deepEqual(report.failure, { stage: "history-evidence", code: "PHASE1_HISTORY_EVIDENCE_DRIFT" });
  assert.equal(report.storageInventory.length, storageLines.length);
});

test("missing, duplicate, or malformed STORAGE protocol fails closed", () => {
  const missing = passStdout().replace(/@@STORAGE@@\n[\s\S]*?\n@@END@@\n$/, "@@END@@\n");
  const duplicate = passStdout().replace("@@STORAGE@@", "@@STORAGE@@\n@@STORAGE@@");
  assert.equal(runWith(result(missing)).report.failure.code, "PHASE1_PROTOCOL_INVALID");
  assert.equal(runWith(result(duplicate)).report.failure.code, "PHASE1_PROTOCOL_INVALID");
  assert.equal(runWith(result(withStorage(passStdout(), ["release\tcommunity-production-r6\t1"]))).report.failure.code,
    "PHASE1_STORAGE_INVENTORY_DRIFT");
});

test("report rejects unknown host capacity profile or check key", () => {
  const report = runWith().report;
  assert.throws(() => launcher.validateReport({ ...report, checks: { ...report.checks, hostMemoryAvailabilityProfile: "unbounded" } }));
  assert.throws(() => launcher.validateReport({ ...report, checks: { ...report.checks, hostDiskProfile: "unbounded" } }));
  assert.throws(() => launcher.validateReport({ ...report, checks: { ...report.checks, availabilityExtra: true } }));
  assert.throws(() => launcher.validateReport({ ...report, storageInventory: [{ ...report.storageInventory[0], extra: true }] }));
  assert.throws(() => launcher.validateReport({ ...report, storageInventory: [{ ...report.storageInventory[0], name: "community-production-token" }] }));
  assert.throws(() => launcher.validateReport({ ...report, hostDiskObservation: { ...report.hostDiskObservation, mountProfile: "arbitrary" } }));
  assert.throws(() => launcher.validateReport({ ...report, hostDiskObservation: { ...report.hostDiskObservation, capacityProfile: "arbitrary" } }));
  assert.throws(() => launcher.validateReport({ ...report, hostDiskObservation: { ...report.hostDiskObservation, availableKiB: -1 } }));
  assert.throws(() => launcher.validateReport({ ...report, hostDiskObservation: { ...report.hostDiskObservation, extra: true } }));
});

test("identity flags must be the exact six-key disabled profile", () => {
  const mutateEnv = (mutator) => passStdout().replace(
    /@@SERVICES@@\n([\s\S]*?)\n@@NAMESPACE@@/,
    (_match, raw) => {
      const value = JSON.parse(raw);
      mutator(value.find((item) => item.Config.Labels["com.docker.compose.service"] === "identity").Config.Env);
      return `@@SERVICES@@\n${JSON.stringify(value)}\n@@NAMESPACE@@`;
    }
  );
  const cases = [
    mutateEnv((env) => env.pop()),
    mutateEnv((env) => env.push(env[0])),
    mutateEnv((env) => { env[0] = env[0].replace("=0", "=1"); }),
    mutateEnv((env) => env.push("AIHUB_WORKFLOW_STORE_UNEXPECTED=0"))
  ];
  for (const stdout of cases) assert.equal(runWith(result(stdout)).report.failure.code, "PHASE1_FLAGS_DRIFT");
  assert.equal(runWith().report.checks.featureProfile, "disabled");
});

test("all six compose-frozen resource limits are exact", () => {
  for (let serviceIndex = 0; serviceIndex < SERVICES.length; serviceIndex += 1) {
    for (const field of ["Memory", "NanoCpus", "PidsLimit"]) {
      const stdout = passStdout().replace(
        /@@SERVICES@@\n([\s\S]*?)\n@@NAMESPACE@@/,
        (_match, raw) => {
          const value = JSON.parse(raw);
          value[serviceIndex].HostConfig[field] += 1;
          return `@@SERVICES@@\n${JSON.stringify(value)}\n@@NAMESPACE@@`;
        }
      );
      assert.equal(runWith(result(stdout)).report.failure.code, "PHASE1_RESOURCE_LIMITS_DRIFT");
    }
  }
  assert.equal(runWith().report.checks.resourceProfile, "r12-2c2g");
});

test("published mount and retained r6-r8 control plus r8 backup-control evidence are fail-closed", () => {
  const mutateMount = (mutator) => passStdout().replace(
    /@@SERVICES@@\n([\s\S]*?)\n@@NAMESPACE@@/,
    (_match, raw) => {
      const value = JSON.parse(raw);
      mutator(value.find((item) => item.Config.Labels["com.docker.compose.service"] === "admin").Mounts);
      return `@@SERVICES@@\n${JSON.stringify(value)}\n@@NAMESPACE@@`;
    }
  );
  const mountDrifts = [
    mutateMount((mounts) => { mounts[0].Source = "/tmp/admin-published"; }),
    mutateMount((mounts) => { mounts[0].Source = "/opt/zhenxing-ai/shared/../escape"; }),
    mutateMount((mounts) => { mounts[0].RW = false; }),
    mutateMount((mounts) => { mounts[0].Type = "volume"; }),
    mutateMount((mounts) => { mounts.push({ ...mounts[0] }); })
  ];
  for (const mountDrift of mountDrifts) {
    assert.equal(runWith(result(mountDrift)).report.failure.code, "PHASE1_PUBLISHED_MOUNT_DRIFT");
  }
  for (const [needle, drift] of [
    ["r6=controls-present", "r6=drift"],
    ["r7=controls-present", "r7=drift"],
    ["r8=controls-present", "r8=drift"],
    ["r8-backup-control=exact", "r8-backup-control=missing"],
    ["r8-backup-control=exact", "r8-backup-control=symlink"],
    ["r8-backup-control=exact", "r8-backup-control=sha-drift"]
  ]) {
    const report = runWith(result(passStdout().replace(needle, drift))).report;
    assert.equal(report.failure.code, "PHASE1_HISTORY_EVIDENCE_DRIFT");
  }
  assert.equal(runWith().report.checks.historyProfile, "r6-r8-controls-r8-backup-control-exact");
  const remote = launcher.REMOTE_COMMAND;
  assert.match(remote, /community-production-20260809T152002Z/);
  assert.match(remote, /ac508a707ae255b7c9ed7551a8fcf1e90a018e9bf5fa1e7379036f42d6e84608/);
  assert.ok((remote.match(/! -L/g) || []).length >= 5);
});

test("protocol and business rejection after SSH stdout attribute one connection while CLI rejection starts none", () => {
  const protocol = runWith(result("@@AIHUB_R12_PHASE1_V1@@\ninvalid")).report;
  assert.equal(protocol.effects.sshInvocations, 1);
  assert.equal(protocol.effects.remoteConnections, 1);
  assert.equal(runWith(result("invalid")).report.effects.remoteConnections, 0);
  const business = runWith(result(passStdout().replace("r8=controls-present", "r8=drift"))).report;
  assert.equal(business.effects.remoteConnections, 1);
  const cli = launcher.runCli(["node", "launcher", "extra"], { spawnSyncImpl() { throw new Error("must not spawn"); } });
  assert.equal(cli.effects.sshInvocations, 0);
  assert.equal(cli.effects.remoteConnections, 0);
});

test("fixed segmented protocol rejects malformed, missing, duplicate, extra, truncated, and oversized output", () => {
  const valid = passStdout();
  const mutations = [
    valid.replace("@@HOST@@", "HOST"),
    valid.replace(/@@PROJECT@@[\s\S]*?(?=@@SERVICES@@)/, ""),
    valid.replace("@@PROJECT@@", "@@HOST@@"),
    valid.replace("@@END@@", "@@EXTRA@@\nno\n@@END@@"),
    valid.replace("@@END@@\n", "")
  ];
  for (const stdout of mutations) {
    const { report } = runWith(result(stdout));
    assert.equal(report.status, "blocked");
    assert.equal(report.failure.code, "PHASE1_PROTOCOL_INVALID");
  }
  const oversized = runWith(result("x".repeat(launcher.MAX_OUTPUT_BYTES + 1))).report;
  assert.equal(oversized.failure.code, "PHASE1_OUTPUT_OVERSIZE");
});

test("transport stderr, nonzero, signal, timeout, and spawn failures fail closed", () => {
  const cases = [
    [result(passStdout(), { stderr: "diagnostic" }), "PHASE1_SSH_DIAGNOSTIC_OUTPUT"],
    [result("", { status: 255 }), "PHASE1_SSH_NONZERO"],
    [result("", { status: null, signal: "SIGTERM" }), "PHASE1_SSH_SIGNAL"],
    [result("", { status: null, error: Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }) }), "PHASE1_SSH_TIMEOUT"],
    [result("", { status: null, error: Object.assign(new Error("spawn"), { code: "ENOENT" }) }), "PHASE1_SSH_SPAWN_FAILED"]
  ];
  for (const [output, code] of cases) {
    const { calls, report } = runWith(output);
    assert.equal(calls.length, 1);
    assert.equal(report.status, "blocked");
    assert.equal(report.failure.code, code);
  }
});

test("only the fixed remote sentinel proves a connection on nonterminal SSH results", () => {
  const partial = "@@AIHUB_R12_PHASE1_V1@@\n@@HOST@@\n";
  assert.equal(runWith(result(partial, { status: 1 })).report.effects.remoteConnections, 1);
  assert.equal(runWith(result(partial, {
    status: null,
    error: Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })
  })).report.effects.remoteConnections, 1);
  assert.equal(runWith(result("", { status: 255 })).report.effects.remoteConnections, 0);
  const calls = [];
  const spawned = launcher.runPhase1({ spawnSyncImpl() { calls.push(true); throw new Error("spawn"); } });
  assert.equal(calls.length, 1);
  assert.equal(spawned.effects.sshInvocations, 1);
  assert.equal(spawned.effects.remoteConnections, 0);
});

test("service inventory rejects wrong count, name, project, service, image, and health", () => {
  const mutateJson = (mutator) => passStdout().replace(
    /@@SERVICES@@\n([\s\S]*?)\n@@NAMESPACE@@/,
    (_match, raw) => {
      const value = JSON.parse(raw);
      mutator(value);
      return `@@SERVICES@@\n${JSON.stringify(value)}\n@@NAMESPACE@@`;
    }
  );
  const mutations = [
    passStdout().replace(`${"6".repeat(64)}\n@@SERVICES@@`, "@@SERVICES@@"),
    mutateJson((value) => { value[0].Name = "/wrong"; }),
    mutateJson((value) => { value[0].Config.Labels["com.docker.compose.project"] = "wrong"; }),
    mutateJson((value) => { value[0].Config.Labels["com.docker.compose.service"] = "wrong"; }),
    mutateJson((value) => { value[0].Config.Image = "wrong"; }),
    mutateJson((value) => { value[0].State.Health.Status = "unhealthy"; })
  ];
  for (const stdout of mutations) {
    const report = runWith(result(stdout)).report;
    assert.equal(report.status, "blocked");
    assert.ok(["PHASE1_PROJECT_DRIFT", "PHASE1_SERVICE_DRIFT"].includes(report.failure.code));
  }
});

test("namespace, old unit, process, and active6 state drift are rejected", () => {
  const cases = [
    [passStdout().replace("control=absent", "control=present"), "PHASE1_R12_NAMESPACE_PRESENT"],
    [passStdout().replace("zhenxing-ai-workflow-production-r8.service\nLoadState=not-found\nActiveState=inactive", "zhenxing-ai-workflow-production-r8.service\nLoadState=loaded\nActiveState=active"), "PHASE1_OLD_UNIT_ACTIVE"],
    [passStdout().replace("@@PROCESSES@@\n0", "@@PROCESSES@@\n2"), "PHASE1_CONCURRENT_PROCESS"],
    [passStdout().replace("1000\t1000\t600\t1", "0\t0\t644\t2"), "PHASE1_ACTIVE6_STATE_DRIFT"],
    [passStdout().replace(R12.active6.stateSha256, "0".repeat(64)), "PHASE1_ACTIVE6_STATE_DRIFT"]
  ];
  for (const [stdout, code] of cases) {
    const report = runWith(result(stdout)).report;
    assert.equal(report.status, "blocked");
    assert.equal(report.failure.code, code);
  }
});

test("the process scan includes only the fixed legacy cutover families including release-bundle-cutover", () => {
  assert.match(launcher.REMOTE_COMMAND, /release-bundle-cutover/);
  assert.match(launcher.REMOTE_COMMAND, /\[w\]orkflow-production-\(cutover\|release-bundle-cutover\|r\[5-9\]\|r1\[012\]\)/);
  assert.doesNotMatch(launcher.REMOTE_COMMAND, /workflow-production-\.\*/);
});

test("report schema rejects unknown keys and sensitive output while the source excludes ad hoc transports", () => {
  const report = runWith().report;
  assert.equal(launcher.validateReport(report), true);
  assert.throws(() => launcher.validateReport({ ...report, extra: true }));
  assert.throws(() => launcher.validateReport({ ...report, status: "blocked", failure: { stage: "protocol", code: "PHASE1_UNKNOWN" } }));
  assert.throws(() => launcher.validateReport({ ...report, effects: { ...report.effects, remoteWrites: 1 } }));
  assert.throws(() => launcher.validateReport({ ...report, failure: { stage: "local", code: "password=value" } }));

  const source = fs.readFileSync(sourcePath, "utf8");
  for (const forbidden of [
    /power\s*shell/i,
    /convertfrom-json/i,
    /\bpwsh\b/i,
    /\bscp\b/i,
    /\bsftp\b/i,
    /\bbase64\b/i,
    /\bmktemp\b/i,
    /--format\b/,
    /docker\s+(?:pull|build|tag|load|run|compose)/
  ]) assert.doesNotMatch(source, forbidden);
  assert.match(source, /docker ps -aq --filter/);
  assert.match(source, /docker inspect/);
  assert.match(source, /ONE_SHOT_MAX_BYTES = 192 \* 1024 \* 1024/);
  assert.match(source, /HOST_HEADROOM_BYTES = 128 \* 1024 \* 1024/);
  assert.match(source, /Object\.values\(RESOURCE_LIMITS\)\.reduce/);
  assert.match(launcher.REMOTE_COMMAND, /storage_scope release \/opt\/zhenxing-ai\/releases/);
  assert.match(launcher.REMOTE_COMMAND, /storage_scope staging \/opt\/zhenxing-ai\/staging/);
  assert.match(launcher.REMOTE_COMMAND, /storage_scope backup \/opt\/zhenxing-ai\/shared\/backups/);
  assert.match(launcher.REMOTE_COMMAND, /\/usr\/bin\/du -sk --/);
  for (const forbidden of [/\b(?:rm|mv|chmod|chown)\b/, /\bprune\b/, /\bfind\b[^\n]*-delete/]) {
    assert.doesNotMatch(launcher.REMOTE_COMMAND, forbidden);
  }
  assert.doesNotMatch(source, /docker exec[^\n]+\/usr\/bin\/(?:stat|sha256sum)/);
  assert.equal((source.match(/spawnSyncImpl\(/g) || []).length, 1);
  assert.equal(process.argv.length >= 2, true);
});
