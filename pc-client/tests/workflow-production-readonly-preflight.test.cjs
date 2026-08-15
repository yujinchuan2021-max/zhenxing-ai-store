"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const test = require("node:test");
const launcher = require("../scripts/workflow-production-readonly-preflight.cjs");
const bundleModule = require("../deployment/community-production/workflow-production-release-bundle.cjs");

const candidate = Object.freeze({
  deploymentSetDigest: "1".repeat(64),
  deploymentManifestSha256: "2".repeat(64),
  payloadDigest: "3".repeat(64),
  bundleManifestSha256: "4".repeat(64),
  bundleTableSha256: "5".repeat(64),
  identitySourceDigest: "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7",
  identitySourceManifestSha256: "6".repeat(64),
  existingStateVerifierSha256: "70fab968a12550e65fe30985e31609675d105bcfc422513ad5b44c0c9d9f0bdf",
  sourcePostModuleSha256: "a069520aff7b98806744841ab54212d7c193c5df1123e371fdc0d478c78e2fe6"
});

function phase2Value() {
  return {
    schema: launcher.PHASE2_SCHEMA,
    receipt: "aihub-r11-postprepare-remote-v1",
    candidate: {
      deploymentSetDigest: candidate.deploymentSetDigest,
      deploymentManifestSha256: candidate.deploymentManifestSha256,
      payloadDigest: candidate.payloadDigest,
      identitySourceDigest: candidate.identitySourceDigest
    },
    prepared: { verified: true, runtimeExact: true, modulesSameRelease: true },
    retained: { baseline: "disabled-retained-official-bootstrap", events: 9, idempotency: 9, eventHead: 9, idempotentReplay: true, sourcePosts: 3 },
    capabilityDisabledExact: true,
    publicFeatureDisabledExact: true,
    launchBaselineExact: true,
    catalogV2SignedExact: true,
    catalogV1SignedExact: true,
    secretMetadataCount: 9,
    secretConsumerCount: 13,
    secretConsumersExact: true,
    caddyDerivedSecretExact: true,
    launchCalls: 0
  };
}

function fakeChild({ stdout = "", stderr = "", code = 0, closeOnKill = true, stdinError = false, signalClose = false } = {}) {
  const child = new EventEmitter();
  child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.killCount = 0;
  child.kill = () => { child.killCount += 1; if (closeOnKill) process.nextTick(() => child.emit("close", null)); };
  process.nextTick(() => {
    if (stdinError) return child.stdin.emit("error", Object.assign(new Error("epipe"), { code: "EPIPE" }));
    if (stdout) child.stdout.emit("data", stdout);
    if (stderr) child.stderr.emit("data", stderr);
    if (signalClose) child.emit("close", null, "SIGTERM");
    else if (code !== null) child.emit("close", code);
  });
  return child;
}

test("two phases use one fixed SSH transport and only the prepared runtime may execute Phase 2", () => {
  const pre = launcher.fixedSshArgs({ phase: "pre-transfer" });
  assert.deepEqual(pre.slice(-2), ["/bin/bash", "-s"]);
  const root = "/opt/zhenxing-ai/releases/community-production-r11-candidate01";
  const post = launcher.fixedSshArgs({ phase: "post-prepare", preparedRoot: root });
  assert.deepEqual(post.slice(-3), [`${root}/.workflow-runtime/node-v24.18.1-linux-x64/bin/node`, "-", root]);
  for (const args of [pre, post]) {
    const joined = args.join(" ");
    for (const option of ["BatchMode=yes", "IdentitiesOnly=yes", "StrictHostKeyChecking=yes", "ConnectionAttempts=1", "ControlMaster=no", "ClearAllForwardings=yes"]) assert.match(joined, new RegExp(option));
    assert.doesNotMatch(joined, /(?:scp|sftp|compose\s+(?:run|up)|docker\s+(?:load|run|cp)|\bnode\s+-)$/i);
  }
  assert.ok(pre.includes(launcher.IDENTITY_FILE));
  assert.ok(pre.includes(`UserKnownHostsFile=${launcher.KNOWN_HOSTS_FILE}`));
  assert.throws(() => launcher.fixedSshArgs({ phase: "post-prepare", preparedRoot: "/tmp/r11" }));
});

test("Phase 1 is a static read-only Bash collector and Phase 2 is same-release, pure-GET, and launch-free", () => {
  const first = launcher.createPhase1Program();
  assert.match(first, /^#!\/bin\/bash/);
  assert.match(first, /docker version/);
  assert.match(first, /control_root="\/opt\/zhenxing-ai\/shared\/workflow-production-r11"/);
  for (const child of ["status.json", "receipt.json", "request.json", "environment.sh"]) assert.match(first, new RegExp(`\\$control_root/${child.replace(".", "\\.")}`));
  assert.doesNotMatch(first, /workflow-production-r11-control/);
  assert.match(first, /LoadState=not-found/);
  assert.match(first, /ActiveState=inactive/);
  assert.match(first, /SubState=dead/);
  assert.match(first, /\.Image/);
  assert.doesNotMatch(first, /(?:docker\s+(?:load|run|cp)|compose\s+(?:run|up)|\bcurl\b|\bwget\b|\bscp\b|\bsftp\b|\bbase64\b|\bmktemp\b|(?:^|[;\s])rm\s|(?:^|[;\s])mv\s|\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b)/i);
  const second = launcher.createPhase2Program();
  for (const seam of ["verifyPreparedRelease", "workflow_node_validate_installed", "require.resolve", "readExistingOfficialSourcePosts", "verifyExistingWorkflowState", "createReleaseStore", "readRelease", "validateServiceBaseline", "validateCatalogBaseline", "rejectUnauthorized: true", "BEGIN READ ONLY", "TRANSACTION READ ONLY"]) assert.match(second, new RegExp(seam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(second, /ensureOfficialSourcePosts|compose\s+(?:run|up)|docker[^\n]{0,40}(?:load|run|cp)|method:\s*["'](?:POST|PUT|PATCH|DELETE)/i);
  assert.match(second, /sourcePostModuleSha256|workflow-official-source-posts\.cjs/);
});

test("Phase 2 binds source-post GETs to the Community vhost and public-list GETs to the main vhost", () => {
  const program = launcher.createPhase2Program();
  assert.match(program, /mainPublicHost\s*=\s*envValue\(inspectAll\.caddy,\s*"AIHUB_PUBLIC_HOST"\)/);
  assert.match(program, /communityPublicHost\s*=\s*envValue\(inspectAll\.caddy,\s*"AIHUB_COMMUNITY_PUBLIC_HOST"\)/);
  assert.match(program, /mainPublicHost\s*===\s*communityPublicHost/);
  assert.match(program, /requestHttps\(\{\s*publicHost:\s*communityPublicHost,\s*method:\s*"GET",\s*path:\s*`\$\{original\.pathname\}\$\{original\.search\}`/);
  assert.match(program, /requestHttps\(\{\s*publicHost:\s*mainPublicHost,\s*method:\s*"GET",\s*path:\s*"\/v1\/community\/workflow-store\/public\/list\?limit=50"\s*\}\)/);
  assert.doesNotMatch(program, /const publicHost\s*=\s*envValue\(inspectAll\.caddy,\s*"AIHUB_COMMUNITY_PUBLIC_HOST"\)/);
});

test("Phase 2 failures use one exact allowlisted stage and code envelope and never validate as success", () => {
  const contracts = {
    "prepared-runtime": "PREPARED_RUNTIME_INVALID",
    "service-baseline": "SERVICE_BASELINE_INVALID",
    "source-post-https": "SOURCE_POST_HTTPS_INVALID",
    catalog: "CATALOG_INVALID",
    database: "DATABASE_INVALID",
    capability: "CAPABILITY_INVALID",
    "public-list-https": "PUBLIC_LIST_HTTPS_INVALID",
    "secret-authority": "SECRET_AUTHORITY_INVALID",
    "retained-verifier": "RETAINED_VERIFIER_INVALID"
  };
  for (const [stage, code] of Object.entries(contracts)) {
    const envelope = {
      schema: "aihub-workflow-production-readonly-postprepare-failure-v1",
      receipt: "aihub-r11-postprepare-remote-v1",
      status: "blocked",
      failure: { stage, code }
    };
    assert.deepEqual(launcher.validatePhase2FailureOutput(JSON.stringify(envelope)), envelope);
    assert.throws(() => launcher.validatePhase2Output(JSON.stringify(envelope), candidate), /phase2 output/);
  }
  const valid = {
    schema: "aihub-workflow-production-readonly-postprepare-failure-v1",
    receipt: "aihub-r11-postprepare-remote-v1",
    status: "blocked",
    failure: { stage: "catalog", code: "CATALOG_INVALID" }
  };
  for (const mutate of [
    (value) => { value.failure.stage = "unknown"; },
    (value) => { value.failure.code = "WRONG"; },
    (value) => { value.failure.raw = "detail"; },
    (value) => { value.rawError = "detail"; }
  ]) {
    const value = structuredClone(valid);
    mutate(value);
    assert.throws(() => launcher.validatePhase2FailureOutput(JSON.stringify(value)), /failure output/);
  }
});

test("Phase 2 program funnels synchronous and asynchronous failures through the same fixed envelope", () => {
  const program = launcher.createPhase2Program();
  assert.match(program, /aihub-workflow-production-readonly-postprepare-failure-v1/);
  assert.match(program, /const run\s*=\s*async\s*\(\)\s*=>\s*\{\s*try\s*\{/);
  assert.match(program, /process\.stdout\.write\(JSON\.stringify\(output\)\)/);
  assert.match(program, /await Promise\.all/);
  assert.match(program, /await guard\("retained-verifier"/);
  assert.doesNotMatch(program, /\.catch\(\(\)\s*=>\s*\{\s*process\.exitCode\s*=\s*1/);
});

test("exact Phase contracts reject missing, extra, status, retained, and secret drift", () => {
  const phase1 = { schema: launcher.PHASE1_SCHEMA, receipt: "aihub-r11-pretransfer-remote-v1", linux: true, x64: true, remoteIdentityExact: true, diskSufficient: true, r11TargetsAbsent: true, r11UnitAbsent: true, r11UnitStateExact: true, r11ProcessesAbsent: true, concurrentCutovers: 0, serviceCount: 6, healthyServices: 6, oldImagesExact: true, dockerClient: true, dockerDaemon: true, compose: true };
  assert.deepEqual(launcher.validatePhase1Output(JSON.stringify(phase1)), phase1);
  for (const mutate of [
    (value) => { value.extra = true; },
    (value) => { value.dockerDaemon = false; },
    (value) => { value.diskSufficient = false; },
    (value) => { value.r11TargetsAbsent = false; },
    (value) => { value.serviceCount = 5; },
    (value) => { value.healthyServices = 5; },
    (value) => { value.oldImagesExact = false; },
    (value) => { value.receipt = "wrong"; }
  ]) { const value = structuredClone(phase1); mutate(value); assert.throws(() => launcher.validatePhase1Output(JSON.stringify(value))); }
  assert.deepEqual(launcher.validatePhase2Output(JSON.stringify(phase2Value()), candidate), phase2Value());
  const mutations = [
    (v) => { v.candidate.payloadDigest = "0".repeat(64); },
    (v) => { v.prepared.runtimeExact = false; },
    (v) => { v.retained.events = 8; },
    (v) => { v.retained.idempotency = 8; },
    (v) => { v.retained.eventHead = 8; },
    (v) => { v.retained.idempotentReplay = false; },
    (v) => { v.retained.sourcePosts = 2; },
    (v) => { v.capabilityDisabledExact = false; },
    (v) => { v.publicFeatureDisabledExact = false; },
    (v) => { v.launchBaselineExact = false; },
    (v) => { v.catalogV2SignedExact = false; },
    (v) => { v.catalogV1SignedExact = false; },
    (v) => { v.secretMetadataCount = 8; },
    (v) => { v.secretConsumerCount = 12; },
    (v) => { v.launchCalls = 1; },
    (v) => { v.extra = true; }
  ];
  for (const mutate of mutations) { const value = phase2Value(); mutate(value); assert.throws(() => launcher.validatePhase2Output(JSON.stringify(value), candidate)); }
});

test("systemd absence requires the exact not-found inactive dead property set", () => {
  assert.equal(launcher.validateAbsentSystemdUnit("LoadState=not-found\nActiveState=inactive\nSubState=dead\n"), true);
  for (const value of [
    "LoadState=loaded\nActiveState=inactive\nSubState=dead\n",
    "LoadState=not-found\nActiveState=failed\nSubState=failed\n",
    "LoadState=not-found\nActiveState=active\nSubState=running\n",
    "LoadState=not-found\nActiveState=inactive\nSubState=dead\nUnknown=value\n",
    "LoadState=not-found\nActiveState=inactive\nSubState=dead\nSubState=dead\n",
    ""
  ]) assert.throws(() => launcher.validateAbsentSystemdUnit(value));
});

function oldServiceInspectFixture() {
  const composeServices = {
    admin: "admin", identityDatabase: "identity-database", identity: "identity",
    communityDatabase: "community-database", community: "community", caddy: "caddy"
  };
  const images = [
    ["admin", "zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9", "sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2"],
    ["identityDatabase", "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193", "ignored"],
    ["identity", "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392", "sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567"],
    ["communityDatabase", "mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4", "ignored"],
    ["community", "zhenxing-ai/flarum:community-candidate-8b13962a36bf", "sha256:6c32c21c9961e0dd35757c46be35ec2c8725f5b3537d4d0e7634c3a1cd11ba12"],
    ["caddy", "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d", "ignored"]
  ];
  return Object.fromEntries(images.map(([name, image, id]) => [name, {
    Name: `/zhenxing-community-production-${composeServices[name]}-1`,
    Config: { Image: image, Labels: { "com.docker.compose.project": "zhenxing-community-production", "com.docker.compose.service": composeServices[name] } },
    Image: id,
    State: { Health: { Status: "healthy" } },
    Mounts: []
  }]));
}

test("launch baseline binds six healthy old tags and both immutable old image IDs", () => {
  const fixture = oldServiceInspectFixture();
  assert.equal(launcher.validateServiceBaseline(fixture), true);
  for (const mutate of [
    (value) => { value.admin.Image = "sha256:" + "0".repeat(64); },
    (value) => { value.identity.Image = "sha256:" + "0".repeat(64); },
    (value) => { value.community.State.Health.Status = "starting"; },
    (value) => { value.caddy.Config.Image = "caddy:latest"; },
    (value) => { delete value.admin; }
  ]) { const value = structuredClone(fixture); mutate(value); assert.throws(() => launcher.validateServiceBaseline(value)); }
});

test("signed catalog baseline binds active6 v2 and unchanged active72 v1 tuples", () => {
  const value = {
    v2Channel: { activeCatalogVersion: 6, activeRelease: { releaseId: "catalog-v00000006-567e671621f1-3dcee587" } },
    v2Release: { release: { releaseId: "catalog-v00000006-567e671621f1-3dcee587", catalogVersion: 6 }, envelope: { payload: { releaseId: "catalog-v00000006-567e671621f1-3dcee587", catalogVersion: 6, catalogSha256: "567e671621f14d7788ecdbe642be738aa5133d9688d45bbae4d0f7760a926d9f" } } },
    v1Channel: { activeCatalogVersion: 72, activeRelease: { releaseId: "catalog-v00000072-e286516335da-a8b62a49" } },
    v1Release: { release: { releaseId: "catalog-v00000072-e286516335da-a8b62a49", catalogVersion: 72 }, envelope: { payload: { releaseId: "catalog-v00000072-e286516335da-a8b62a49", catalogVersion: 72, catalogSha256: "e286516335da9272ce42902008c5f9016fdc444a42d988de2b22d8550a73f5ff" } } }
  };
  assert.equal(launcher.validateCatalogBaseline(value), true);
  for (const mutate of [
    (copy) => { copy.v2Release.envelope.payload.catalogSha256 = "0".repeat(64); },
    (copy) => { copy.v2Channel.activeCatalogVersion = 7; },
    (copy) => { copy.v1Release.release.releaseId = "wrong"; },
    (copy) => { copy.v1Release.envelope.payload.catalogSha256 = "0".repeat(64); }
  ]) { const copy = structuredClone(value); mutate(copy); assert.throws(() => launcher.validateCatalogBaseline(copy)); }
});

test("SSH timeout, output limit, stdin failure, and a child that will not close all fail closed", async () => {
  const common = { phase: "post-prepare", program: "fixed", args: ["fixed"], sshPath: launcher.SSH_PATH };
  let child = fakeChild({ stdout: "x".repeat(launcher.MAX_OUTPUT_BYTES + 1), code: null });
  let value = await launcher.runSsh({ ...common, spawnImpl: () => child, terminationTimeoutMs: 10 });
  assert.equal(value.code, "STDOUT_LIMIT"); assert.equal(child.killCount, 1);
  child = fakeChild({ stdinError: true, code: null });
  value = await launcher.runSsh({ ...common, spawnImpl: () => child, terminationTimeoutMs: 10 });
  assert.equal(value.code, "STDIN_FAILED"); assert.equal(child.killCount, 1);
  child = fakeChild({ code: null });
  value = await launcher.runSsh({ ...common, spawnImpl: () => child, timeoutMs: 1, terminationTimeoutMs: 10 });
  assert.equal(value.code, "SSH_TIMEOUT"); assert.equal(child.killCount, 1);
  child = fakeChild({ code: null, closeOnKill: false });
  value = await launcher.runSsh({ ...common, spawnImpl: () => child, timeoutMs: 1, terminationTimeoutMs: 5 });
  assert.equal(value.code, "CHILD_TERMINATION_FAILED"); assert.equal(child.killCount, 1);
});

test("CLI grammar is exact and has no digest, URL, command, or launch input", () => {
  assert.deepEqual(launcher.parseCli(["pre-transfer"]), { phase: "pre-transfer" });
  assert.deepEqual(launcher.parseCli(["post-prepare", "--prepared-root", "/opt/zhenxing-ai/releases/community-production-r11-candidate01"]), { phase: "post-prepare", preparedRoot: "/opt/zhenxing-ai/releases/community-production-r11-candidate01" });
  for (const argv of [[], ["pre-transfer", "--digest", "a"], ["post-prepare"], ["pre-transfer", "--identity-file", "a"], ["pre-transfer", "--known-hosts-file", "b"], ["pre-transfer", "--url", "c"]]) assert.throws(() => launcher.parseCli(argv));
});

test("real Windows OpenSSH and fixed authority files use ACL semantics instead of POSIX mode fiction", { skip: process.platform !== "win32" }, () => {
  const ssh = launcher.readWindowsAuthorityMetadata(launcher.SSH_PATH);
  assert.equal(ssh.regular, true);
  assert.equal(ssh.symlink, false);
  assert.ok(ssh.nlink >= 1);
  assert.match(ssh.owner, /TrustedInstaller$/i);
  assert.equal(launcher.validateTransportAuthority(), true);
});

test("transport authority rejects replacement, unsafe ACL, wrong owner, links, and aliasing", { skip: process.platform !== "win32" }, () => {
  const owner = `MARK\\${os.userInfo().username}`;
  const safe = new Map([
    [launcher.SSH_PATH.toLowerCase(), { canonical: launcher.SSH_PATH, regular: true, symlink: false, nlink: 2, owner: "NT SERVICE\\TrustedInstaller", rules: [{ identity: "NT SERVICE\\TrustedInstaller", type: "Allow", rights: "FullControl" }] }],
    [launcher.IDENTITY_FILE.toLowerCase(), { canonical: launcher.IDENTITY_FILE, regular: true, symlink: false, nlink: 1, owner, rules: [{ identity: owner, type: "Allow", rights: "Modify" }] }],
    [launcher.KNOWN_HOSTS_FILE.toLowerCase(), { canonical: launcher.KNOWN_HOSTS_FILE, regular: true, symlink: false, nlink: 1, owner, rules: [{ identity: owner, type: "Allow", rights: "Modify" }] }]
  ]);
  const validate = (mutate) => {
    const copy = new Map([...safe].map(([key, value]) => [key, structuredClone(value)]));
    mutate?.(copy);
    return () => launcher.validateTransportAuthority({ platform: "win32", username: os.userInfo().username, metadataReader: (filename) => copy.get(filename.toLowerCase()) });
  };
  assert.equal(validate()(), true);
  assert.throws(validate((copy) => { copy.get(launcher.IDENTITY_FILE.toLowerCase()).symlink = true; }));
  assert.throws(validate((copy) => { copy.get(launcher.KNOWN_HOSTS_FILE.toLowerCase()).nlink = 2; }));
  assert.throws(validate((copy) => { copy.get(launcher.IDENTITY_FILE.toLowerCase()).owner = "BUILTIN\\Users"; }));
  assert.throws(validate((copy) => { copy.get(launcher.KNOWN_HOSTS_FILE.toLowerCase()).rules.push({ identity: "BUILTIN\\Users", type: "Allow", rights: "Write" }); }));
  assert.throws(validate((copy) => { copy.get(launcher.KNOWN_HOSTS_FILE.toLowerCase()).canonical = launcher.IDENTITY_FILE; }));
});

test("secret byte contracts reject C0, DEL, bad terminal LF, and delimiter drift", () => {
  const plain = Buffer.from("x".repeat(64));
  assert.equal(launcher.validSecretBytes("identity_db_password", plain), true);
  assert.equal(launcher.validSecretBytes("identity_db_password", Buffer.concat([plain, Buffer.from("\n")])), true);
  assert.equal(launcher.validSecretBytes("identity_db_password", Buffer.from(`${"x".repeat(512)}\n`)), true);
  assert.equal(launcher.validSecretBytes("forum_admin_password", Buffer.from("x".repeat(4096))), true);
  assert.equal(launcher.validSecretBytes("forum_admin_password", Buffer.from(`${"x".repeat(4096)}\n`)), false);
  for (const bad of [Buffer.concat([plain, Buffer.from("\n\n")]), Buffer.concat([plain.subarray(0, 31), Buffer.from("\n"), plain.subarray(31)]), Buffer.concat([plain.subarray(0, 31), Buffer.from("\t")]), Buffer.concat([plain.subarray(0, 31), Buffer.from([0x7f])]), Buffer.concat([plain.subarray(0, 31), Buffer.from(";"), plain.subarray(32)]), Buffer.from("x".repeat(31))]) {
    assert.equal(launcher.validSecretBytes("identity_db_password", bad), false);
  }
  const forum = Buffer.concat([plain, Buffer.from("\n")]);
  assert.equal(launcher.validSecretBytes("forum_api_key", forum), true);
  for (const bad of [plain, Buffer.concat([forum, Buffer.from("\n")]), Buffer.concat([plain.subarray(0, 20), Buffer.from(";"), plain.subarray(21), Buffer.from("\n")]), Buffer.concat([plain.subarray(0, 20), Buffer.from([0]), plain.subarray(21), Buffer.from("\n")])]) {
    assert.equal(launcher.validSecretBytes("forum_api_key", bad), false);
  }
  const cms = Buffer.from("a".repeat(64));
  assert.equal(launcher.validSecretBytes("community_cms_gateway", cms), true);
  for (const bad of [
    Buffer.concat([cms, Buffer.from("\n")]),
    Buffer.concat([cms, Buffer.from("\r")]),
    Buffer.concat([cms.subarray(0, 20), Buffer.from("\t"), cms.subarray(21)]),
    Buffer.from("a".repeat(31)),
    Buffer.from("a".repeat(513))
  ]) assert.equal(launcher.validSecretBytes("community_cms_gateway", bad), false);
});

test("CMS secret matches the exact issuer, Admin, and Caddy consumer intersection", () => {
  const good = "0123456789abcdef".repeat(4);
  const at = (character) => Buffer.from(`${good.slice(0, 31)}${character}${good.slice(32)}`);
  const rejected = [
    Buffer.from(("a-b_c.d/e+f=".repeat(5)).slice(0, 64)),
    at('"'), at("#"), at("$"), at("\\"), at("{"), at("}"),
    Buffer.from("A".repeat(64)),
    Buffer.from(good.slice(0, 63)),
    Buffer.from(`${good}a`),
    Buffer.from(`${good}\n`)
  ];
  assert.deepEqual(rejected.map((value) => launcher.validSecretBytes("community_cms_gateway", value)), rejected.map(() => false));
  assert.equal(launcher.validSecretBytes("community_cms_gateway", Buffer.from(good)), true);
});

function publishedMountFixture() {
  const source = "/opt/zhenxing-ai/shared/admin-published";
  const meta = { directory: true, symlink: false, uid: 1000, gid: 1000, mode: 0o755, nlink: 3 };
  const inspect = { Mounts: [{ Source: source, Destination: "/app/admin/published", Type: "bind", RW: true }] };
  const fsImpl = {
    realpathSync(value) { return value; },
    lstatSync(value) { assert.equal(value, source); return { isDirectory: () => meta.directory, isSymbolicLink: () => meta.symlink, ...meta }; }
  };
  return { source, meta, inspect, fsImpl };
}

test("Admin published catalog is a canonical RW bind while secret mounts remain separately read-only", () => {
  let fixture = publishedMountFixture();
  assert.equal(launcher.validatePublishedCatalogMount({ inspect: fixture.inspect, fsImpl: fixture.fsImpl }), fixture.source);
  for (const mutate of [
    (value) => { value.inspect.Mounts[0].RW = false; },
    (value) => { value.inspect.Mounts[0].Type = "volume"; },
    (value) => { value.inspect.Mounts = []; },
    (value) => { value.inspect.Mounts.push({ ...value.inspect.Mounts[0] }); },
    (value) => { value.meta.symlink = true; },
    (value) => { value.meta.uid = 0; },
    (value) => { value.meta.mode = 0o775; },
    (value) => { value.meta.nlink = 1; },
    (value) => { value.fsImpl.realpathSync = () => `${value.source}-other`; }
  ]) {
    fixture = publishedMountFixture(); mutate(fixture);
    assert.throws(() => launcher.validatePublishedCatalogMount({ inspect: fixture.inspect, fsImpl: fixture.fsImpl }));
  }
});

test("release-store signed catalog reads do not mutate the published tree", async () => {
  const storeRoot = path.resolve(__dirname, "../admin/published/catalog-store");
  const digestTree = () => {
    const values = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const absolute = path.join(directory, entry.name);
        const relative = path.relative(storeRoot, absolute).replaceAll("\\", "/");
        if (entry.isDirectory()) walk(absolute);
        else values.push(`${relative}\0${crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")}`);
      }
    };
    walk(storeRoot);
    return crypto.createHash("sha256").update(values.join("\n")).digest("hex");
  };
  const before = digestTree();
  const store = require("../admin/release-store.cjs").createReleaseStore({ rootDirectory: storeRoot, signingKeyProvider: async () => { throw new Error("readonly"); } });
  for (const channel of ["v1", "v2"]) {
    const state = await store.readChannel(channel);
    await store.readRelease(state.activeRelease.releaseId, { channel });
  }
  assert.equal(digestTree(), before);
});

function secretFixture() {
  const root = "/srv/frozen-authority/current";
  const consumers = {
    identity_db_password: ["identityDatabase", "identity"], forum_db_password: ["communityDatabase", "community"],
    forum_db_root_password: ["communityDatabase"], forum_admin_password: ["community"], forum_api_key: ["community"],
    forum_password_token: ["community"], community_internal: ["identity", "community"], community_management: ["admin", "community"],
    community_cms_gateway: ["admin"]
  };
  const inspectAll = Object.fromEntries(["admin", "identityDatabase", "identity", "communityDatabase", "community", "caddy"].map((name) => [name, { Mounts: [] }]));
  const files = new Map();
  for (const [name, services] of Object.entries(consumers)) {
    const source = `${root}/${name}`;
    files.set(source, { bytes: name === "forum_api_key" ? Buffer.from(`${"x".repeat(64)}\n`) : Buffer.from((name === "community_cms_gateway" ? "a" : "x").repeat(64)), symlink: false, nlink: 1, uid: 1000, gid: 1000, mode: 0o600 });
    for (const service of services) inspectAll[service].Mounts.push({ Source: source, Destination: `/run/secrets/${name}`, RW: false, Type: "bind" });
  }
  inspectAll.caddy.Mounts.push({ Source: "managed", Destination: "/run/aihub-caddy-secret", RW: false, Type: "volume" });
  const rootMeta = { directory: true, symlink: false, uid: 1000, gid: 1000, mode: 0o700 };
  const fsImpl = {
    realpathSync(value) { return value; },
    lstatSync(value) {
      if (value === root) return { isDirectory: () => rootMeta.directory, isFile: () => false, isSymbolicLink: () => rootMeta.symlink, ...rootMeta };
      const valueMeta = files.get(value); if (!valueMeta) throw new Error("missing");
      return { isDirectory: () => false, isFile: () => true, isSymbolicLink: () => valueMeta.symlink, ...valueMeta };
    },
    readFileSync(value) { return files.get(value).bytes; }
  };
  return { root, consumers, inspectAll, files, rootMeta, fsImpl };
}

test("secret snapshot derives one canonical authority root from mounts and binds metadata, bytes, and every exact consumer", () => {
  let fixture = secretFixture();
  assert.deepEqual(launcher.validateSecretSnapshot({ inspectAll: fixture.inspectAll, fsImpl: fixture.fsImpl }), { metadataCount: 9, consumerCount: 13, consumersExact: true, caddyDerived: true });
  for (const [name, services] of Object.entries(fixture.consumers)) {
    fixture = secretFixture();
    fixture.inspectAll[services[0]].Mounts = fixture.inspectAll[services[0]].Mounts.filter((mount) => mount.Destination !== `/run/secrets/${name}`);
    assert.throws(() => launcher.validateSecretSnapshot({ inspectAll: fixture.inspectAll, fsImpl: fixture.fsImpl }));
    fixture = secretFixture();
    fixture.inspectAll.caddy.Mounts.push({ Source: `${fixture.root}/${name}`, Destination: `/run/secrets/${name}`, RW: false, Type: "bind" });
    assert.throws(() => launcher.validateSecretSnapshot({ inspectAll: fixture.inspectAll, fsImpl: fixture.fsImpl }));
  }
  for (const mutate of [
    (value) => { value.rootMeta.mode = 0o755; },
    (value) => { value.rootMeta.uid = 0; },
    (value) => { value.files.get(`${value.root}/identity_db_password`).symlink = true; },
    (value) => { value.files.get(`${value.root}/identity_db_password`).nlink = 2; },
    (value) => { value.files.get(`${value.root}/identity_db_password`).bytes = Buffer.from(`${"x".repeat(31)}\t${"x".repeat(32)}`); },
    (value) => { value.inspectAll.admin.Mounts.find((mount) => mount.Destination === "/run/secrets/community_management").RW = true; },
    (value) => { value.inspectAll.admin.Mounts.find((mount) => mount.Destination === "/run/secrets/community_management").Type = "volume"; }
  ]) {
    fixture = secretFixture(); mutate(fixture);
    assert.throws(() => launcher.validateSecretSnapshot({ inspectAll: fixture.inspectAll, fsImpl: fixture.fsImpl }));
  }
  fixture = secretFixture();
  const mount = fixture.inspectAll.identity.Mounts.find((entry) => entry.Destination === "/run/secrets/identity_db_password");
  mount.Source = "/srv/other-authority/identity_db_password";
  assert.throws(() => launcher.validateSecretSnapshot({ inspectAll: fixture.inspectAll, fsImpl: fixture.fsImpl }));
});

test("spawn contract is exact for executable, argv, and stdin bytes", () => {
  const root = "/opt/zhenxing-ai/releases/community-production-r11-candidate01";
  for (const phase of ["pre-transfer", "post-prepare"]) {
    const preparedRoot = phase === "post-prepare" ? root : undefined;
    const args = launcher.fixedSshArgs({ phase, preparedRoot });
    const program = phase === "pre-transfer" ? launcher.createPhase1Program() : launcher.createPhase2Program();
    assert.equal(launcher.validateReadOnlyTransport({ phase, sshPath: launcher.SSH_PATH, args, program, preparedRoot }), true);
    assert.throws(() => launcher.validateReadOnlyTransport({ phase, sshPath: `${launcher.SSH_PATH}.copy`, args, program, preparedRoot }));
    for (const token of ["scp", "docker load", "compose up", "mktemp", "rm -rf", "POST"]) {
      assert.throws(() => launcher.validateReadOnlyTransport({ phase, sshPath: launcher.SSH_PATH, args: [...args, token], program, preparedRoot }));
      assert.throws(() => launcher.validateReadOnlyTransport({ phase, sshPath: launcher.SSH_PATH, args, program: `${program}\n${token}`, preparedRoot }));
    }
  }
});

test("SSH process start is not reported as a remote connection without the fixed receipt", async () => {
  let child = fakeChild({ code: 255 });
  let value = await launcher.runSsh({ phase: "pre-transfer", program: "x", args: ["x"], spawnImpl: () => child });
  assert.equal(value.sshProcessStarts, 1);
  assert.equal(value.remoteConnections, 0);
  child = fakeChild({ stdout: JSON.stringify({ receipt: "wrong" }), code: 0 });
  value = await launcher.runSsh({ phase: "pre-transfer", program: "x", args: ["x"], spawnImpl: () => child });
  assert.equal(value.connections, 0);
  assert.equal(value.starts, 1);
});

test("post-prepare nonzero exact failure envelope remains blocked with allowlisted Phase2 attribution", async () => {
  const envelope = {
    schema: launcher.PHASE2_FAILURE_SCHEMA,
    receipt: launcher.PHASE2_RECEIPT,
    status: "blocked",
    failure: { stage: "catalog", code: "CATALOG_INVALID" }
  };
  const invoke = (options = {}) => launcher.runSsh({
    phase: options.phase || "post-prepare",
    program: "fixed",
    args: ["fixed"],
    sshPath: launcher.SSH_PATH,
    spawnImpl: () => fakeChild({ stdout: options.stdout ?? JSON.stringify(envelope), stderr: options.stderr || "", code: options.code ?? 1, signalClose: options.signalClose === true })
  });

  const attributed = await invoke();
  assert.equal(attributed.status, "blocked");
  assert.equal(attributed.phase, "post-prepare");
  assert.equal(attributed.stage, "catalog");
  assert.equal(attributed.code, "CATALOG_INVALID");
  assert.equal(attributed.remoteConnections, 1);
  assert.equal(attributed.sshProcessStarts, 1);
  assert.equal(attributed.remoteWrites, 0);
  assert.doesNotMatch(JSON.stringify(attributed), /stdout|stderr|raw|path|secret|stack|identity/i);

  for (const options of [
    { stdout: `${JSON.stringify(envelope)}\n${JSON.stringify(envelope)}` },
    { stdout: JSON.stringify({ ...envelope, raw: "detail" }) },
    { stdout: JSON.stringify({ ...envelope, failure: { stage: "unknown", code: "UNKNOWN" } }) },
    { stderr: "remote detail" },
    { code: 0 },
    { code: 2 },
    { code: 255 },
    { signalClose: true },
    { phase: "pre-transfer" }
  ]) {
    const blocked = await invoke(options);
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.code, "SSH_EARLY_EXIT");
    assert.doesNotMatch(JSON.stringify(blocked), /remote detail|stdout|stderr|raw/i);
  }
});

test("bundle tree validation rejects non-core corruption, extras, table drift, fake digest, and hard links", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-r11-bundle-contract-"));
  const bytes = Buffer.from("payload");
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const expected = { deployment: { setDigest: "1".repeat(64), manifestSha256: "2".repeat(64) }, identity: { sourceDigest: "3".repeat(64), sourceManifestSha256: "4".repeat(64) }, payload: { digest: "5".repeat(64), fileCount: 1, directoryCount: 1 }, directories: [{ path: "nested", mode: "0755" }], files: [{ path: "nested/non-core.txt", mode: "0644", bytes: bytes.length, sha256: hash }] };
  const identity = { digest: { sha256: expected.identity.sourceDigest } };
  const write = () => {
    fs.mkdirSync(path.join(root, "payload", "nested"), { recursive: true });
    fs.writeFileSync(path.join(root, "payload", "nested", "non-core.txt"), bytes);
    fs.writeFileSync(path.join(root, bundleModule.controlFiles.bundle), `${JSON.stringify(expected)}\n`);
    fs.writeFileSync(path.join(root, bundleModule.controlFiles.table), bundleModule.renderBundleTable(expected));
    fs.writeFileSync(path.join(root, bundleModule.controlFiles.identity), `${JSON.stringify(identity)}\n`);
  };
  try {
    write();
    assert.equal(bundleModule.verifyBundleTree(root, expected, identity).fileCount, 1);
    fs.appendFileSync(path.join(root, "payload", "nested", "non-core.txt"), "x");
    assert.throws(() => bundleModule.verifyBundleTree(root, expected, identity));
    fs.writeFileSync(path.join(root, "payload", "nested", "non-core.txt"), bytes);
    fs.writeFileSync(path.join(root, "payload", "extra.txt"), "extra");
    assert.throws(() => bundleModule.verifyBundleTree(root, expected, identity));
    fs.rmSync(path.join(root, "payload", "extra.txt"));
    fs.mkdirSync(path.join(root, "payload", "unknown-empty"));
    assert.throws(() => bundleModule.verifyBundleTree(root, expected, identity));
    fs.rmdirSync(path.join(root, "payload", "unknown-empty"));
    fs.appendFileSync(path.join(root, bundleModule.controlFiles.table), "x");
    assert.throws(() => bundleModule.verifyBundleTree(root, expected, identity));
    fs.writeFileSync(path.join(root, bundleModule.controlFiles.table), bundleModule.renderBundleTable(expected));
    const fake = structuredClone(expected); fake.payload.digest = "f".repeat(64);
    fs.writeFileSync(path.join(root, bundleModule.controlFiles.bundle), `${JSON.stringify(fake)}\n`);
    assert.throws(() => bundleModule.verifyBundleTree(root, expected, identity));
    fs.writeFileSync(path.join(root, bundleModule.controlFiles.bundle), `${JSON.stringify(expected)}\n`);
    fs.linkSync(path.join(root, "payload", "nested", "non-core.txt"), path.join(root, "payload", "linked.txt"));
    assert.throws(() => bundleModule.verifyBundleTree(root, expected, identity));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
