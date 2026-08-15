"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const {
  PUBLIC_DISABLED,
  RESOURCE_CAPABILITY,
  TARGET_FAILURE_CODES,
  assertNoConcurrentR12Run,
  assertNoConcurrentR26Run,
  assertNoConcurrentR27Run,
  createTargetWorkflowCapabilityProbeProgram,
  createR12FixedCollector,
  forumApiKeyFromAuthority,
  parseTargetWorkflowCapabilityProbe,
  sanitizeCollectorReceipt,
  stateDigest,
  targetFailureTerminal,
  targetStep,
  targetWorkflowCapability,
  validateBaselineCatalog,
  validateTargetCatalog,
  validatePublicList,
  validateResourceCapability
} = require("../deployment/community-production/workflow-production-r12-fixed-collector.cjs");
const { R12 } = require("../deployment/community-production/workflow-production-r12-in-place.cjs");
const { DATA_MOUNTS, SERVICES, validateProductionMounts } = require("../deployment/community-production/workflow-production-service-contract.cjs");
const { SECRET_CONSUMERS_BY_PROFILE, validateSecretSnapshot } = require("../deployment/community-production/workflow-production-secret-authority-contract.cjs");

const RELEASE = "/opt/zhenxing-ai/releases/community-production-r12-2a114734";

function runNodeProgram(program) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", program], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("target capability probe timed out")); }, 5_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || stderr) reject(new Error("target capability probe failed"));
      else resolve(stdout);
    });
  });
}

async function withWorkflowCapabilityServer(responder, action) {
  let requests = 0;
  const server = http.createServer((request, response) => {
    requests += 1;
    assert.equal(request.method, "GET");
    assert.equal(request.url, "/v1/community/workflow-store/capability");
    const reply = responder(requests);
    response.writeHead(reply.status, { "content-type": reply.contentType || "application/json" });
    response.end(reply.body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
    server.listen(4180, "127.0.0.1");
  });
  try { return await action(() => requests); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("target collector waits in one process for the workflow-only capability to warm", async () => {
  await withWorkflowCapabilityServer(
    (attempt) => ({
      status: 200,
      body: JSON.stringify({ enabled: attempt >= 5, schemaVersion: 1, execution: false, workflowSubmissionLookup: false })
    }),
    async (requests) => {
      const output = await runNodeProgram(createTargetWorkflowCapabilityProbeProgram(1_000, 5, 100));
      assert.deepEqual(parseTargetWorkflowCapabilityProbe(output), { status: 200, enabled: true, attemptCount: 5 });
      assert.equal(requests(), 5);
    }
  );
});

test("target workflow capability probe fails closed for persistent false, HTTP failure, malformed, and DTO drift", async (t) => {
  for (const [name, reply] of [
    ["false", { status: 200, body: JSON.stringify({ enabled: false, schemaVersion: 1, execution: false, workflowSubmissionLookup: false }) }],
    ["503", { status: 503, body: JSON.stringify({ enabled: true, schemaVersion: 1, execution: false, workflowSubmissionLookup: false }) }],
    ["malformed", { status: 200, contentType: "text/plain", body: "not-json" }],
    ["wrong DTO", { status: 200, body: JSON.stringify({ enabled: true, schemaVersion: 1, execution: false, workflowSubmissionLookup: true }) }]
  ]) {
    await t.test(name, async () => {
      await withWorkflowCapabilityServer(
        () => reply,
        async () => {
          const output = await runNodeProgram(createTargetWorkflowCapabilityProbeProgram(30, 5, 10));
          assert.equal(parseTargetWorkflowCapabilityProbe(output).enabled, false);
        }
      );
    });
  }
});

test("target capability readiness projects one fixed failure code without raw output", () => {
  assert.throws(() => targetWorkflowCapability(() => ({
    status: 0,
    signal: null,
    error: null,
    stderr: "",
    stdout: JSON.stringify({ status: 200, enabled: false, attemptCount: 120 })
  }), "zhenxing-community-production-identity-1"), (error) => {
    assert.equal(error.code, "FRESH_HOST_WORKFLOW_CAPABILITY_NOT_READY");
    assert.doesNotMatch(String(error.message), /identity|attemptCount|stdout/i);
    return true;
  });
});

test("target collector assigns one exact allowlisted failure pair to each target seam", async () => {
  assert.deepEqual(TARGET_FAILURE_CODES, {
    services: "FRESH_HOST_TARGET_SERVICES_FAILED",
    mount: "FRESH_HOST_TARGET_MOUNT_FAILED",
    flags: "FRESH_HOST_TARGET_FLAGS_FAILED",
    secret: "FRESH_HOST_TARGET_SECRET_FAILED",
    catalog: "FRESH_HOST_TARGET_CATALOG_FAILED",
    "source-public": "FRESH_HOST_TARGET_SOURCE_PUBLIC_FAILED",
    "resource-capability": "FRESH_HOST_TARGET_RESOURCE_CAPABILITY_FAILED",
    "workflow-capability": "FRESH_HOST_WORKFLOW_CAPABILITY_NOT_READY",
    database: "FRESH_HOST_TARGET_DATABASE_FAILED",
    "existing-state": "FRESH_HOST_TARGET_EXISTING_STATE_FAILED",
    "final-target-assertions": "FRESH_HOST_TARGET_FINAL_ASSERTIONS_FAILED",
    "target-unknown": "FRESH_HOST_TARGET_UNKNOWN_FAILED"
  });
  for (const [stage, code] of Object.entries(TARGET_FAILURE_CODES)) {
    await assert.rejects(targetStep(stage, async () => { throw new Error("/raw/secret stack message"); }), (error) => {
      assert.deepEqual(targetFailureTerminal(error), { stage, code });
      assert.doesNotMatch(JSON.stringify(targetFailureTerminal(error)), /\/raw\/|stack|message|path/i);
      return true;
    });
  }
  await assert.rejects(targetStep("workflow-capability", () => targetWorkflowCapability(() => ({
    status: 0, signal: null, error: null, stderr: "", stdout: JSON.stringify({ status: 200, enabled: false, attemptCount: 120 })
  }), "zhenxing-community-production-identity-1")), (error) => {
    assert.deepEqual(targetFailureTerminal(error), {
      stage: "workflow-capability",
      code: "FRESH_HOST_WORKFLOW_CAPABILITY_NOT_READY"
    });
    return true;
  });
  const crossPair = Object.assign(new Error("raw"), {
    targetFailure: { stage: "services", code: TARGET_FAILURE_CODES.database }
  });
  assert.deepEqual(targetFailureTerminal(crossPair), {
    stage: "target-unknown",
    code: TARGET_FAILURE_CODES["target-unknown"]
  });
  const extra = Object.assign(new Error("raw"), {
    targetFailure: { stage: "services", code: TARGET_FAILURE_CODES.services, extra: true }
  });
  assert.deepEqual(targetFailureTerminal(extra), {
    stage: "target-unknown",
    code: TARGET_FAILURE_CODES["target-unknown"]
  });
});

test("r12 collector redacts raw values instead of publishing decorative command claims", () => {
  const receipt = sanitizeCollectorReceipt({
    projectName: R12.projectName,
    concurrentRuns: 0,
    services: R12.services.map((name) => ({ name, health: "healthy" })),
    flags: { profile: "disabled" },
    activeCatalog: { stateSha256: R12.active6.stateSha256, releaseId: R12.active6.releaseId, releaseSha256: R12.active6.releaseSha256, v1ReleaseId: R12.v1.releaseId, v1CatalogVersion: R12.v1.catalogVersion, v1ReleaseSha256: R12.v1.releaseSha256, v1CatalogSha256: R12.v1.catalogSha256 },
    resourceSubmissionTables: [],
    preservedDataRoles: [...R12.preservedDataRoles],
    workflowStateInput: { database: { raw: "must-not-cross" }, identityInspect: [], sourcePosts: {} }
  });
  assert.equal(receipt.workflowStateInput, undefined);
  assert.equal(JSON.stringify(receipt).includes("must-not-cross"), false);
  assert.equal(Object.hasOwn(receipt, "mountsExact"), false);
});

test("r12 collector accepts no caller selected docker command, project, SQL, URL, or runtime path", async () => {
  assert.throws(() => createR12FixedCollector({ releaseRoot: "/tmp/unsafe" }), /collector/i);
  assert.throws(() => createR12FixedCollector({ releaseRoot: RELEASE, project: "evil" }), /collector/i);
  const collector = createR12FixedCollector({ releaseRoot: RELEASE, executeFile: async () => { throw new Error("fixture"); } });
  await assert.rejects(() => collector.baseline("docker", "evil", "SELECT write"), /collector/i);
});

test("r12 collector rejects old units, legacy processes, or one-shot containers as concurrency", () => {
  const execute = (file, args) => {
    if (file === "/usr/bin/systemctl") return { status: 0, stdout: args.at(-1).includes("r12") ? "LoadState=loaded\nActiveState=active\nSubState=running\n" : "LoadState=not-found\nActiveState=inactive\nSubState=dead\n", stderr: "" };
    if (file === "/usr/bin/pgrep") return args.at(-1).includes("r12-prepared") ? { status: 0, stdout: `${process.pid}\n`, stderr: "" } : { status: 1, stdout: "", stderr: "" };
    if (file === "/usr/bin/docker") return { status: 0, stdout: `${SERVICES.map((service) => service.composeService).join("\n")}\n`, stderr: "" };
    throw new Error("unexpected");
  };
  assert.equal(assertNoConcurrentR12Run(execute), 0);
  assert.throws(() => assertNoConcurrentR12Run((file, args, options) => file === "/usr/bin/systemctl" && args.at(-1) === "zhenxing-ai-workflow-production-r8.service" ? { status: 0, stdout: "LoadState=loaded\nActiveState=active\nSubState=running\n", stderr: "" } : execute(file, args, options)), /collector/i);
  assert.throws(() => assertNoConcurrentR12Run((file, args, options) => file === "/usr/bin/pgrep" && !args.at(-1).includes("r12-prepared") ? { status: 0, stdout: "123\n", stderr: "" } : execute(file, args, options)), /collector/i);
  assert.throws(() => assertNoConcurrentR12Run((file, args, options) => file === "/usr/bin/pgrep" && args.at(-1).includes("r12-prepared") ? { status: 0, stdout: `${process.pid}\n${process.pid + 1}\n`, stderr: "" } : execute(file, args, options)), /collector/i);
  assert.throws(() => assertNoConcurrentR12Run((file, args, options) => file === "/usr/bin/pgrep" && args.at(-1).includes("r12-prepared") ? { status: 0, stdout: `${process.pid + 1}\n`, stderr: "" } : execute(file, args, options)), /collector/i);
  assert.throws(() => assertNoConcurrentR12Run((file, args, options) => file === "/usr/bin/docker" ? { status: 0, stdout: `${SERVICES.map((service) => service.composeService).join("\n")}\nworkflow-migrate\n`, stderr: "" } : execute(file, args, options)), /collector/i);
});

test("r26 target-only verification accepts exactly one fixed transient verifier unit", () => {
  const execute = (file, args) => {
    if (file === "/usr/bin/systemctl") return { status: 0, stdout: args.at(-1).includes("r26") ? "LoadState=loaded\nActiveState=active\nSubState=running\n" : "LoadState=not-found\nActiveState=inactive\nSubState=dead\n", stderr: "" };
    if (file === "/usr/bin/pgrep") return args.at(-1).includes("fresh-host-preflight") ? { status: 0, stdout: `${process.pid}\n`, stderr: "" } : { status: 1, stdout: "", stderr: "" };
    if (file === "/usr/bin/docker") return { status: 0, stdout: `${SERVICES.map((service) => service.composeService).join("\n")}\n`, stderr: "" };
    throw new Error("unexpected");
  };
  assert.equal(assertNoConcurrentR26Run(execute), 0);
});

test("r27 target-only verification accepts exactly one fixed transient verifier unit", () => {
  const execute = (file, args) => {
    if (file === "/usr/bin/systemctl") return { status: 0, stdout: args.at(-1).includes("r27") ? "LoadState=loaded\nActiveState=active\nSubState=running\n" : "LoadState=not-found\nActiveState=inactive\nSubState=dead\n", stderr: "" };
    if (file === "/usr/bin/pgrep") return args.at(-1).includes("fresh-host-preflight") ? { status: 0, stdout: `${process.pid}\n`, stderr: "" } : { status: 1, stdout: "", stderr: "" };
    if (file === "/usr/bin/docker") return { status: 0, stdout: `${SERVICES.map((service) => service.composeService).join("\n")}\n`, stderr: "" };
    throw new Error("unexpected");
  };
  assert.equal(assertNoConcurrentR27Run(execute), 0);
});

test("r12 resource capability and public disabled DTOs are exact", () => {
  assert.equal(validateResourceCapability({ status: 200, body: structuredClone(RESOURCE_CAPABILITY) }), true);
  assert.throws(() => validateResourceCapability({ status: 200, body: { ...RESOURCE_CAPABILITY, extra: true } }), /collector/i);
  assert.equal(validatePublicList("baseline", { status: 503, value: structuredClone(PUBLIC_DISABLED) }), 0);
  assert.throws(() => validatePublicList("baseline", { status: 503, value: { code: "FEATURE_DISABLED" } }), /collector/i);
});

test("r12 catalog state evidence is hashed from the mounted regular file", () => {
  const raw = Buffer.from("fixed-state\n");
  const digest = require("node:crypto").createHash("sha256").update(raw).digest("hex");
  const fsImpl = { realpathSync(value) { return value; }, lstatSync() { return { isFile: () => true, isSymbolicLink: () => false, nlink: 1, uid: 1000, gid: 1000, mode: 0o100600 }; }, readFileSync() { return raw; } };
  assert.equal(stateDigest("/published", digest, fsImpl), digest);
  assert.throws(() => stateDigest("/published", "0".repeat(64), fsImpl), /collector/i);
  const unsafe = { ...fsImpl, lstatSync() { return { ...fsImpl.lstatSync(), nlink: 2 }; } };
  assert.throws(() => stateDigest("/published", digest, unsafe), /collector/i);
  const wrongMode = { ...fsImpl, lstatSync() { return { ...fsImpl.lstatSync(), mode: 0o100644 }; } };
  assert.throws(() => stateDigest("/published", digest, wrongMode), /collector/i);
});

test("catalog verification reads the signed v2 catalog digest from the envelope payload", () => {
  const v1Channel = { activeRelease: { releaseId: R12.v1.releaseId } };
  const v1Release = {
    release: { releaseId: R12.v1.releaseId, catalogVersion: R12.v1.catalogVersion, sha256: R12.v1.releaseSha256 },
    envelope: { payload: { catalogSha256: R12.v1.catalogSha256 } }
  };
  const targetChannel = { activeRelease: { releaseId: R12.active7.releaseId } };
  const targetRelease = {
    release: { releaseId: R12.active7.releaseId, catalogVersion: 7, sha256: R12.active7.releaseSha256 },
    envelope: { payload: { catalogSha256: "8c49e1972186f841dca9cea8f26074fe27aed9a140e4f5687cf7f23d134f034c" } }
  };
  assert.doesNotThrow(() => validateTargetCatalog({ v1Channel, v1Release, v2Channel: targetChannel, v2Release: targetRelease }));
  const baselineChannel = { activeRelease: { releaseId: R12.active6.releaseId } };
  const baselineRelease = {
    release: { releaseId: R12.active6.releaseId, catalogVersion: 6, sha256: R12.active6.releaseSha256 },
    envelope: { payload: { catalogSha256: "567e671621f14d7788ecdbe642be738aa5133d9688d45bbae4d0f7760a926d9f" } }
  };
  assert.doesNotThrow(() => validateBaselineCatalog({ v1Channel, v1Release, v2Channel: baselineChannel, v2Release: baselineRelease }));
  assert.throws(() => validateTargetCatalog({
    v1Channel, v1Release, v2Channel: targetChannel,
    v2Release: { ...targetRelease, envelope: { payload: { catalogSha256: "0".repeat(64) } } }
  }), /collector/i);
});

function secretFixture(profile) {
  const inspectAll = Object.fromEntries(SERVICES.map((service) => [service.key, { Mounts: [] }]));
  for (const [name, consumers] of Object.entries(SECRET_CONSUMERS_BY_PROFILE[profile])) {
    const root = name === "workflow_review_secret" ? "/workflow-secrets" : "/secrets";
    for (const consumer of consumers) inspectAll[consumer].Mounts.push({ Destination: `/run/secrets/${name}`, Source: `${root}/${name}`, Type: "bind", RW: false });
  }
  inspectAll.caddy.Mounts.push({ Destination: "/run/aihub-caddy-secret", Source: "caddy-secret", Type: "volume", RW: false });
  const bytes = Object.fromEntries(Object.entries(SECRET_CONSUMERS_BY_PROFILE[profile]).filter(([, consumers]) => consumers.length).map(([name]) => [name, name === "forum_api_key" ? Buffer.from(`${"a".repeat(64)}\n`) : Buffer.from("a".repeat(64))]));
  const fsImpl = {
    realpathSync(value) { return value; },
    lstatSync(value) {
      if (value === "/secrets" || value === "/workflow-secrets") return { isDirectory: () => true, isSymbolicLink: () => false, uid: 1000, gid: 1000, mode: 0o40700 };
      return { isFile: () => true, isSymbolicLink: () => false, uid: 1000, gid: 1000, mode: 0o100600, nlink: 1 };
    },
    readFileSync(value) { return bytes[path.posix.basename(value)]; }
  };
  return { inspectAll, fsImpl, environment: { AIHUB_SECRET_DIR: "/secrets", AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR: "/workflow-secrets" } };
}

test("r12 secret consumers are exact and profile-specific", () => {
  const baseline = secretFixture("baseline");
  assert.equal(validateSecretSnapshot({ ...baseline, profile: "baseline" }).consumerCount, 13);
  const target = secretFixture("target");
  assert.equal(validateSecretSnapshot({ ...target, profile: "target" }).consumerCount, 14);
  assert.throws(() => validateSecretSnapshot({ ...target, profile: "baseline" }), /secret authority/i);
  target.inspectAll.admin.Mounts.push({ Destination: "/run/secrets/workflow_review_secret", Source: "/workflow-secrets/workflow_review_secret", Type: "bind", RW: false });
  assert.throws(() => validateSecretSnapshot({ ...target, profile: "target" }), /secret authority/i);
  for (const change of [
    (fixture) => { fixture.inspectAll.identity.Mounts.find((mount) => mount.Destination === "/run/secrets/workflow_review_secret").RW = true; },
    (fixture) => { fixture.fsImpl.realpathSync = (value) => value === "/workflow-secrets/workflow_review_secret" ? "/elsewhere" : value; },
    (fixture) => { const prior = fixture.fsImpl.lstatSync; fixture.fsImpl.lstatSync = (value) => value.endsWith("workflow_review_secret") ? { ...prior(value), nlink: 2 } : prior(value); },
    (fixture) => { const prior = fixture.fsImpl.lstatSync; fixture.fsImpl.lstatSync = (value) => value.endsWith("workflow_review_secret") ? { ...prior(value), uid: 0 } : prior(value); },
    (fixture) => { const prior = fixture.fsImpl.lstatSync; fixture.fsImpl.lstatSync = (value) => value.endsWith("workflow_review_secret") ? { ...prior(value), mode: 0o100640 } : prior(value); }
  ]) {
    const fixture = secretFixture("target"); change(fixture);
    assert.throws(() => validateSecretSnapshot({ ...fixture, profile: "target" }), /secret authority/i);
  }
});

test("target source readback parses the already-validated forum authority without loading the bootstrap runtime", () => {
  const secret = Buffer.from(`${"a".repeat(64)}\n`);
  assert.equal(forumApiKeyFromAuthority("/secrets/forum_api_key", { readFileSync() { return secret; } }), "a".repeat(64));
  assert.throws(() => forumApiKeyFromAuthority("/secrets/forum_api_key", { readFileSync() { return Buffer.from("a".repeat(64)); } }), /collector/i);
  const source = fs.readFileSync(path.join(__dirname, "..", "deployment", "community-production", "workflow-production-r12-fixed-collector.cjs"), "utf8");
  assert.doesNotMatch(source, /require\(path\.join\(options\.releaseRoot, "identity", "workflow-official-bootstrap-production\.cjs"\)\)/);
});

function mountFixture(profile, caddyReleaseRoot = "/opt/zhenxing-ai/releases/community-production-r8-retained") {
  const releaseRoot = RELEASE;
  const environment = {
    AIHUB_ADMIN_DATA_DIR: "/data/admin", AIHUB_ADMIN_PUBLISHED_DIR: "/data/published", AIHUB_ADMIN_OUTPUT_DIR: "/data/output",
    AIHUB_IDENTITY_DB_DIR: "/data/identity-db", AIHUB_COMMUNITY_DB_DIR: "/data/community-db",
    AIHUB_COMMUNITY_CONFIG_DIR: "/data/flarum", AIHUB_COMMUNITY_STORAGE_DIR: "/data/storage", AIHUB_COMMUNITY_ASSETS_DIR: "/data/assets",
    AIHUB_SECRET_DIR: "/secrets", AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR: "/workflow-secrets",
    AIHUB_CADDY_DATA_VOLUME: "caddy-data", AIHUB_CADDY_CONFIG_VOLUME: "caddy-config", AIHUB_CADDY_CMS_SECRET_VOLUME: "caddy-secret"
  };
  const inspectAll = Object.fromEntries(SERVICES.map((service) => [service.key, { Mounts: [] }]));
  for (const service of SERVICES) {
    for (const contract of DATA_MOUNTS[service.key]) {
      const source = contract.releaseFile ? `${caddyReleaseRoot}/deployment/community-production/${contract.releaseFile}` : environment[contract.sourceEnv];
      inspectAll[service.key].Mounts.push({ Destination: contract.destination, ...(contract.type === "volume" ? { Name: source, Source: `/var/lib/docker/volumes/${source}/_data` } : { Source: source }), Type: contract.type, RW: contract.rw });
    }
  }
  for (const [name, consumers] of Object.entries(SECRET_CONSUMERS_BY_PROFILE[profile])) {
    const root = name === "workflow_review_secret" ? "/workflow-secrets" : "/secrets";
    for (const consumer of consumers) inspectAll[consumer].Mounts.push({ Destination: `/run/secrets/${name}`, Source: `${root}/${name}`, Type: "bind", RW: false });
  }
  const files = Object.freeze({ Caddyfile: Buffer.from("fixed-caddyfile\n"), "caddy-entrypoint.sh": Buffer.from("#!/bin/sh\nfixed-entrypoint\n") });
  const fsImpl = {
    realpathSync(value) { return value; },
    lstatSync(value) {
      const name = path.posix.basename(value);
      const file = value.includes("secrets/") || Object.hasOwn(files, name);
      return { isFile: () => file, isDirectory: () => !file, isSymbolicLink: () => false, uid: 1000, gid: 1000, mode: file ? (name === "caddy-entrypoint.sh" ? 0o100755 : name === "Caddyfile" ? 0o100644 : 0o100600) : 0o40700, nlink: file ? 1 : 2 };
    },
    readFileSync(value) { return files[path.posix.basename(value)]; }
  };
  return { inspectAll, profile, environment, releaseRoot, fsImpl, secretConsumers: SECRET_CONSUMERS_BY_PROFILE[profile] };
}

test("r12 mount receipt accepts byte-identical Caddy files from one retained release and rejects drift", () => {
  for (const profile of ["baseline", "target"]) {
    const fixture = mountFixture(profile);
    assert.equal(validateProductionMounts(fixture).profile, profile);
  }
  const fixture = mountFixture("target");
  const { inspectAll } = fixture;
  for (const [field, value] of [["RW", false], ["Type", "volume"], ["Source", "/data/wrong"]]) {
    const original = inspectAll.admin.Mounts[0][field]; inspectAll.admin.Mounts[0][field] = value;
    assert.throws(() => validateProductionMounts(fixture), /service contract/i);
    inspectAll.admin.Mounts[0][field] = original;
  }
  inspectAll.community.Mounts.push({ Destination: "/unexpected", Source: "/data/extra", Type: "bind", RW: true });
  assert.throws(() => validateProductionMounts(fixture), /service contract/i);
  inspectAll.community.Mounts.pop();
  for (const change of [
    (value) => { value.inspectAll.caddy.Mounts[0].Source = "/tmp/community-production-r8-retained/deployment/community-production/Caddyfile"; },
    (value) => { const prior = value.fsImpl.readFileSync; value.fsImpl.readFileSync = (file) => file.includes("r8-retained") && file.endsWith("Caddyfile") ? Buffer.from("drift\n") : prior(file); },
    (value) => { const prior = value.fsImpl.realpathSync; value.fsImpl.realpathSync = (file) => file.includes("r8-retained") && file.endsWith("Caddyfile") ? "/opt/zhenxing-ai/releases/elsewhere/Caddyfile" : prior(file); },
    (value) => { const prior = value.fsImpl.lstatSync; value.fsImpl.lstatSync = (file) => file.includes("r8-retained") && file.endsWith("Caddyfile") ? { ...prior(file), uid: 0 } : prior(file); },
    (value) => { const prior = value.fsImpl.lstatSync; value.fsImpl.lstatSync = (file) => file.includes("r8-retained") && file.endsWith("Caddyfile") ? { ...prior(file), isSymbolicLink: () => true } : prior(file); },
    (value) => { const prior = value.fsImpl.lstatSync; value.fsImpl.lstatSync = (file) => file.includes("r8-retained") && file.endsWith("Caddyfile") ? { ...prior(file), mode: 0o100600 } : prior(file); },
    (value) => { const prior = value.fsImpl.lstatSync; value.fsImpl.lstatSync = (file) => file.includes("r8-retained") && file.endsWith("Caddyfile") ? { ...prior(file), nlink: 2 } : prior(file); }
  ]) {
    const value = mountFixture("target"); change(value);
    assert.throws(() => validateProductionMounts(value), /service contract/i);
  }
});

test("r12 collector uses only fixed read-only database and HTTPS source/public paths", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "deployment", "community-production", "workflow-production-r12-fixed-collector.cjs"), "utf8");
  assert.match(source, /BEGIN TRANSACTION READ ONLY/);
  assert.match(source, /exec psql -X -q -v ON_ERROR_STOP=1 -h 127\.0\.0\.1 -U aihub -d aihub -At -c/);
  assert.match(source, /-h 127\.0\.0\.1/);
  assert.match(source, /PGPASSWORD=\"\$\(cat \/run\/secrets\/identity_db_password\)\"/);
  assert.match(source, /\"\/bin\/sh\", \"-ec\"/);
  assert.match(source, /current_database\(\).*current_user/);
  assert.match(source, /START TRANSACTION READ ONLY/);
  assert.match(source, /tgrelid='community_workflow\.events'::regclass/);
  assert.match(source, /rejectUnauthorized: true/);
  assert.match(source, /servername: publicHost/);
  assert.match(source, /readExistingOfficialSourcePosts/);
  assert.match(source, /identity_kind='workflow-reviewer-service'/);
  assert.match(source, /identity_kind='workflow-official-publisher-service'/);
  assert.match(source, /markerDiscussionCount/);
  assert.match(source, /R12\.active6\.releaseSha256/);
  assert.match(source, /R12\.active7\.releaseSha256/);
  assert.doesNotMatch(source, /\bPOST\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b|docker cp|docker load|compose run|compose up/);
  assert.doesNotMatch(source, /R12_COLLECTOR_COMMANDS|mountsExact: true|rollbackArtifactsExact: true|targetArtifactsExact: true|bootstrapReplayZero: true/);
});
