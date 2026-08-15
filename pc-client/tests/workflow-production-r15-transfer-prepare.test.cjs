"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "scripts", "workflow-production-r15-transfer-prepare.cjs");
const bashPath = "C:\\Program Files\\Git\\bin\\bash.exe";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function gitBashPath(filename) {
  const resolved = path.resolve(filename);
  return `/${resolved[0].toLowerCase()}${resolved.slice(2).replaceAll("\\", "/")}`;
}

function createIngressFixture() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-r15-ingress-"));
  const bundle = path.join(temporary, "bundle");
  const payload = path.join(bundle, "payload");
  fs.mkdirSync(payload, { recursive: true });
  const rows = ["AIHUB_WORKFLOW_PRODUCTION_RELEASE_BUNDLE_V1"];
  for (let index = 0; index < 7; index += 1) rows.push(`M\tmetadata${index}\tvalue${index}`);
  for (let index = 0; index < 14; index += 1) {
    const directory = `d${String(index).padStart(2, "0")}`;
    fs.mkdirSync(path.join(payload, directory));
    rows.push(`D\t0755\t${directory}`);
  }
  const content = Buffer.from("fixed-ingress-payload", "utf8");
  for (let index = 0; index < 350; index += 1) {
    const relative = `d${String(index % 14).padStart(2, "0")}/f${String(index).padStart(3, "0")}.bin`;
    fs.writeFileSync(path.join(payload, ...relative.split("/")), content);
    rows.push(`F\t0644\t${content.length}\t${sha256(content)}\t${relative}`);
  }
  fs.writeFileSync(path.join(bundle, ".aihub-workflow-release-bundle.json"), "{}\n");
  fs.writeFileSync(path.join(bundle, ".aihub-identity-source-manifest.json"), "{}\n");
  fs.writeFileSync(path.join(bundle, ".aihub-workflow-release-bundle.tsv"), `${rows.join("\n")}\n`);
  return { temporary, bundle, content };
}

function runIngressValidator(module, fixture) {
  const program = `set -euo pipefail\nbundle='${gitBashPath(fixture.bundle)}'\ntable=\"$bundle/.aihub-workflow-release-bundle.tsv\"\n${module.INGRESS_PAYLOAD_VALIDATOR}\nverify_ingress_payload\nprintf 'validated\\n'\n`;
  return childProcess.spawnSync(bashPath, ["-c", program], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: 60_000,
    maxBuffer: 1024 * 1024
  });
}

function withIngressFixture(mutate, verify) {
  const fixture = createIngressFixture();
  try {
    mutate?.(fixture);
    verify(runIngressValidator(require(modulePath), fixture), fixture);
  } finally {
    fs.rmSync(fixture.temporary, { recursive: true, force: true });
  }
}

function receipt(module, phase, extra) {
  return {
    status: 0,
    signal: null,
    error: null,
    stdout: `${module.SENTINEL}\n${JSON.stringify({ schema: module.REMOTE_SCHEMA, phase, ok: true, ...extra })}\n`,
    stderr: ""
  };
}

function dependencies(module, results) {
  const calls = [];
  return {
    calls,
    value: {
      validateAuthority: () => true,
      verifyLocalBundle: () => module.CANDIDATE,
      spawnSync(file, args, options) {
        calls.push({ file, args, options });
        return results.shift();
      }
    }
  };
}

test("r27 target-verifier transfer coordinator binds only the exact current candidate and paths", () => {
  const module = require(modulePath);
  assert.equal(path.basename(module.BUNDLE_ROOT), "workflow-production-r27-target-verifier.bundle");
  assert.deepEqual(module.CANDIDATE, {
    deploymentSetDigest: "1b04aa02c881b18039b051bae5634599c54e3545514fcc4c456190c4cd411ad1",
    deploymentManifestSha256: "8382bef837dbf05b0f80862c43bad132582fae647fe011f5cb917637b2309a84",
    payloadDigest: "fa72276839c0401a5743c15e304f505750e624641423cd5b2941e179b880ca17",
    bundleManifestSha256: "a0d084efd2d98b421e1cf56b11a7c23d7bd17089c302d78edb2b4fb821924512",
    bundleTableSha256: "48e7af773b3517b1f93fea3881e32bf3ddf4fe93e3697e6dc8cf776829130baa",
    fileCount: 350,
    directoryCount: 14
  });
  assert.equal(module.REMOTE_STAGING, "/opt/zhenxing-ai/staging/community-production-r27-1b04aa02.bundle");
  assert.equal(module.REMOTE_RELEASE, "/opt/zhenxing-ai/releases/community-production-r27-1b04aa02");
  assert.equal(module.REMOTE_TARGET, "admin@47.236.62.189");
  assert.equal(module.TRANSFER_PROGRAM.includes(module.CANDIDATE.bundleManifestSha256), true);
  assert.equal(module.TRANSFER_PROGRAM.includes(module.CANDIDATE.bundleTableSha256), true);
  assert.doesNotMatch(fs.readFileSync(modulePath, "utf8"), /b95faa2f|community-production-r15-/);
});

test("each public phase is explicit, fixed, and never reaches launch", () => {
  const module = require(modulePath);
  const cases = [
    ["dry-preflight", [receipt(module, "dry-preflight", { staging: "absent", release: "absent" })]],
    ["transfer", [
      receipt(module, "dry-preflight", { staging: "absent", release: "absent" }),
      { status: 0, signal: null, error: null, stdout: "", stderr: "" },
      receipt(module, "transfer", { staging: "exact", release: "absent" })
    ]],
    ["prepare", [receipt(module, "prepare", { staging: "retained", release: "prepared", assetDockerWrite: true })]],
    ["verify", [receipt(module, "verify", { release: "prepared" })]]
  ];
  for (const [phase, results] of cases) {
    const fixture = dependencies(module, results);
    const report = module.runPhase(phase, fixture.value);
    assert.equal(report.status, "pass", phase);
    assert.equal(report.phase, phase);
    assert.equal(report.effects.launchCalls, 0);
    assert.equal(report.effects.productionDataWrites, 0);
    assert.equal(report.effects.serviceChanges, 0);
    assert.equal(results.length, 0);
    for (const call of fixture.calls) assert.equal(call.options.shell, false);
  }
  for (const phase of ["", "launch", "all", "transfer --force"]) {
    assert.throws(() => module.runPhase(phase, {}));
  }
});

test("transfer uses one fixed SCP attempt and exact guarded normalization", () => {
  const module = require(modulePath);
  const fixture = dependencies(module, [
    receipt(module, "dry-preflight", { staging: "absent", release: "absent" }),
    { status: 0, signal: null, error: null, stdout: "", stderr: "" },
    receipt(module, "transfer", { staging: "exact", release: "absent" })
  ]);
  const report = module.runPhase("transfer", fixture.value);
  assert.equal(report.status, "pass");
  assert.equal(fixture.calls.filter((call) => call.file === module.SCP_PATH).length, 1);
  assert.deepEqual(fixture.calls.find((call) => call.file === module.SCP_PATH).args, module.fixedScpArgs());
  assert.match(module.TRANSFER_PROGRAM, /realpath -e/);
  assert.match(module.TRANSFER_PROGRAM, /find -P/);
  assert.match(module.TRANSFER_PROGRAM, /%u:%g %a %h/);
  assert.match(module.TRANSFER_PROGRAM, /chmod 0700/);
  assert.match(module.TRANSFER_PROGRAM, /chmod 0600/);
  assert.match(module.TRANSFER_PROGRAM, /sha256sum/);
  assert.doesNotMatch(module.TRANSFER_PROGRAM, /\$\{?[A-Za-z_]*CALLER|eval|source \/tmp/i);
});

test("public transfer ingress validates every exact TSV payload byte before receipt", () => {
  const module = require(modulePath);
  assert.match(module.TRANSFER_PROGRAM, new RegExp(module.INGRESS_PAYLOAD_VALIDATOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  withIngressFixture(null, (result) => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "validated\n");
  });
  const first = (fixture) => path.join(fixture.bundle, "payload", "d00", "f000.bin");
  for (const [label, mutate] of [
    ["same-size tamper", (fixture) => fs.writeFileSync(first(fixture), Buffer.alloc(fixture.content.length, 0x78))],
    ["size drift", (fixture) => fs.appendFileSync(first(fixture), "x")],
    ["missing", (fixture) => fs.rmSync(first(fixture))],
    ["extra", (fixture) => fs.writeFileSync(path.join(fixture.bundle, "payload", "d00", "extra.bin"), fixture.content)],
    ["symlink", (fixture) => {
      const directory = path.join(fixture.bundle, "payload", "d00");
      const shadow = path.join(fixture.temporary, "shadow-d00");
      fs.cpSync(directory, shadow, { recursive: true });
      fs.rmSync(directory, { recursive: true });
      fs.symlinkSync(shadow, directory, "junction");
    }],
    ["hardlink", (fixture) => { fs.rmSync(first(fixture)); fs.linkSync(path.join(fixture.bundle, "payload", "d00", "f014.bin"), first(fixture)); }]
  ]) {
    withIngressFixture(mutate, (result) => assert.notEqual(result.status, 0, `${label} unexpectedly validated`));
  }
});

test("candidate drift and partial transfer fail before the next phase and clean only the fixed staging child", () => {
  const module = require(modulePath);
  let spawned = 0;
  const local = module.runPhase("dry-preflight", {
    validateAuthority: () => true,
    verifyLocalBundle: () => ({ ...module.CANDIDATE, payloadDigest: "0".repeat(64) }),
    spawnSync() { spawned += 1; }
  });
  assert.equal(local.status, "blocked");
  assert.equal(local.code, "R16_ASSET_LOCAL_CANDIDATE_DRIFT");
  assert.equal(spawned, 0);

  const fixture = dependencies(module, [
    receipt(module, "dry-preflight", { staging: "absent", release: "absent" }),
    { status: 1, signal: null, error: null, stdout: "", stderr: "sensitive transfer detail" },
    receipt(module, "cleanup", { staging: "absent", release: "absent" })
  ]);
  const partial = module.runPhase("transfer", fixture.value);
  assert.equal(partial.status, "blocked");
  assert.equal(partial.code, "R16_ASSET_TRANSFER_PARTIAL");
  assert.equal(partial.checks.cleanupExact, true);
  assert.equal(partial.effects.scpProcessStarts, 1);
  assert.equal(fixture.calls.filter((call) => call.file === module.SCP_PATH).length, 1);
  assert.doesNotMatch(JSON.stringify(partial), /sensitive|transfer detail|\\|\/opt\//i);
});

test("existing target and staging path, mode, symlink, or hardlink drift never advance", () => {
  const module = require(modulePath);
  const existing = dependencies(module, [
    { status: 1, signal: null, error: null, stdout: "", stderr: "already exists" }
  ]);
  const second = module.runPhase("transfer", existing.value);
  assert.equal(second.code, "R16_ASSET_TRANSFER_PREFLIGHT_FAILED");
  assert.equal(existing.calls.length, 1);
  assert.equal(existing.calls.some((call) => call.file === module.SCP_PATH), false);

  for (const label of ["unsafe-path", "wrong-mode", "symlink", "hardlink"]) {
    const fixture = dependencies(module, [
      receipt(module, "dry-preflight", { staging: "absent", release: "absent" }),
      { status: 0, signal: null, error: null, stdout: "", stderr: "" },
      { status: 1, signal: null, error: null, stdout: "", stderr: label },
      receipt(module, "cleanup", { staging: "absent", release: "absent" })
    ]);
    const report = module.runPhase("transfer", { ...fixture.value, host: "attacker.invalid", path: "/tmp/evil" });
    assert.equal(report.code, "R16_ASSET_TRANSFER_VERIFY_FAILED", label);
    assert.equal(report.checks.cleanupExact, true, label);
    assert.equal(fixture.calls.some((call) => call.args.includes("attacker.invalid") || call.args.includes("/tmp/evil")), false, label);
    assert.doesNotMatch(JSON.stringify(report), new RegExp(label), label);
  }
});

test("strict receipts reject wrong pairs, extra keys, raw output, and unsafe subprocess results", () => {
  const module = require(modulePath);
  const valid = receipt(module, "verify", { release: "prepared" });
  assert.deepEqual(module.parseRemoteReceipt(valid.stdout, "verify"), {
    schema: module.REMOTE_SCHEMA, phase: "verify", ok: true, release: "prepared"
  });
  for (const stdout of [
    valid.stdout.replace('"verify"', '"prepare"'),
    valid.stdout.replace('"prepared"', '"prepared","raw":"secret"'),
    `${valid.stdout}extra\n`,
    valid.stdout.replace(module.SENTINEL, `${module.SENTINEL}\n${module.SENTINEL}`)
  ]) assert.throws(() => module.parseRemoteReceipt(stdout, "verify"));

  const fixture = dependencies(module, [{ status: 0, signal: null, error: null, stdout: valid.stdout, stderr: "secret diagnostic" }]);
  const report = module.runPhase("verify", fixture.value);
  assert.equal(report.status, "blocked");
  assert.equal(report.code, "R16_ASSET_VERIFY_FAILED");
  assert.doesNotMatch(JSON.stringify(report), /secret diagnostic/);
  assert.throws(() => module.validateReport({ ...report, unknown: true }));
});

test("source keeps fixed authority and excludes caller overrides, retries, launch, and secret material", () => {
  const source = fs.readFileSync(modulePath, "utf8");
  assert.match(source, /require\.main === module/);
  assert.match(source, /scp\.exe/);
  assert.match(source, /shell: false/g);
  assert.doesNotMatch(source, /process\.env\.(?:HOST|URL|PATH|NODE_PATH|NODE_OPTIONS)|--host|--path|--project|retry|sleep|workflow-production-fresh-host-launcher\.sh/i);
  assert.doesNotMatch(source, /(?:^|[\s"']){1}(?:password|token|secret)=/im);
});
