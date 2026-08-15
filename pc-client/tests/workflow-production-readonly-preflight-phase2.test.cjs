"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const runnerPath = path.join(root, "scripts", "test-workflow-production-readonly-preflight-phase2.cjs");
const launcher = require(path.join(root, "scripts", "workflow-production-readonly-preflight.cjs"));

test("formal local Phase2 fixture executes the exported coordinator program without copying Phase2", () => {
  const runner = require(runnerPath);
  const program = launcher.createPhase2Program();
  const source = runner.createInnerFixtureSource({
    fixtureSource: runner.readFrozenBaselineFixture(),
    phase2Program: program,
    preparedReleaseRoot: "/opt/zhenxing-ai/releases/community-production-r11-phase2test01",
    workspaceRoot: "/workspace"
  });

  assert.match(source, new RegExp(runner.sha256(program)));
  assert.equal(source.split("function phase2RemoteMain(").length - 1, 1);
  assert.match(source, /node-v24\.18\.1-linux-x64/);
  assert.match(source, /zhenxing-community-production-identity-1/);
  assert.match(source, /baselineKind === "retained"/);
  assert.match(source, /const baseStart=compose\(\["up", "-d", "identity-database", "community-database", "admin"\]\);/);
  assert.match(source, /compose\(\["ps", "--all", "--format", "json", "identity-database", "community-database", "admin"\]\)/);
  assert.match(source, /if \(baseStart\.status !== 0\) \{\n      report\.checks\.baseServiceStart = \{ reason: classifyBaseStartFailure\(baseStart\.stderr\), services: summarizeBaseServices\(\) \};/);
  assert.match(source, /const runRoot = "\/workspace\/output\/workflow-production-readonly-phase2-inner";/);
  assert.doesNotMatch(source, /workflow-reviewer-cutover-\$\{scenario\}/);
  assert.doesNotMatch(source, /ensureOfficialSourcePosts/);
  assert.doesNotThrow(() => new Function(source));
});

test("nonzero inner execution preserves the fixed allowlisted terminal report before teardown", () => {
  const runner = require(runnerPath);
  let reads = 0;
  const collected = runner.collectInnerTerminal({
    execution: { status: 1, stdout: "", stderr: "raw daemon error must not be projected" },
    readReport(reportPath) {
      reads += 1;
      assert.equal(reportPath, runner.INNER_REPORT_PATH);
      return {
        schema: "internal-fixture-report",
        status: "blocked",
        failure: { name: "Error", message: "raw database and path detail" },
        checks: { phase2Failure: { stage: "public-list-https", code: "PUBLIC_LIST_HTTPS_INVALID" } },
        cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRemoved: true, backupRemoved: true },
        terminal: { finalized: true, exitCode: 1 }
      };
    }
  });

  assert.equal(reads, 1);
  assert.equal(collected.outer, null);
  assert.deepEqual(collected.projection, {
    stage: "retained-phase2",
    substage: "public-list-https",
    status: "blocked",
    finalized: true,
    exitCode: 1,
    failure: { stage: "public-list-https", code: "PUBLIC_LIST_HTTPS_INVALID" },
    cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRemoved: true, backupRemoved: true }
  });
  assert.doesNotMatch(JSON.stringify(collected.projection), /raw|database|path|daemon/i);
  assert.throws(() => runner.collectInnerTerminal({
    execution: { status: 1, stdout: "", stderr: "" },
    readReport: () => ({
      status: "pass",
      checks: {},
      cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRemoved: true, backupRemoved: true },
      terminal: { finalized: true, exitCode: 0 }
    })
  }), /terminal report/);
});

test("inner terminal collector accepts every fixed Phase2 failure enum and rejects unknown or raw detail", () => {
  const runner = require(runnerPath);
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
  const collect = (failure) => runner.collectInnerTerminal({
    execution: { status: 1, stdout: "", stderr: "" },
    readReport: () => ({
      status: "blocked",
      checks: { phase2Failure: failure },
      cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRemoved: true, backupRemoved: true },
      terminal: { finalized: true, exitCode: 1 }
    })
  });
  for (const [stage, code] of Object.entries(contracts)) {
    const projection = collect({ stage, code }).projection;
    assert.equal(projection.substage, stage);
    assert.deepEqual(projection.failure, { stage, code });
  }
  assert.throws(() => collect({ stage: "unknown", code: "UNKNOWN" }), /failure output/);
  assert.throws(() => collect({ stage: "catalog", code: "CATALOG_INVALID", raw: "detail" }), /failure output/);
});

test("execution and inner report evidence use fixed allowlisted states without raw process detail", () => {
  const runner = require(runnerPath);
  assert.deepEqual(runner.normalizeExecutionTerminal({ status: 0, stdout: "raw", stderr: "raw" }), { state: "completed", exitCode: 0 });
  assert.deepEqual(runner.normalizeExecutionTerminal({ status: 1, stdout: "raw", stderr: "raw" }), { state: "completed", exitCode: 1 });
  assert.deepEqual(runner.normalizeExecutionTerminal({ status: 2, stdout: "raw", stderr: "raw" }), { state: "completed", exitCode: 1 });
  assert.deepEqual(runner.normalizeExecutionTerminal({ status: 255, stdout: "raw", stderr: "raw" }), { state: "completed", exitCode: 1 });
  assert.deepEqual(runner.normalizeExecutionTerminal({ status: null, signal: "SIGTERM", error: { code: "ETIMEDOUT", message: "raw" } }), { state: "timeout", exitCode: null });
  assert.deepEqual(runner.normalizeExecutionTerminal({ status: null, error: { code: "ENOENT", message: "raw" } }), { state: "spawn-failed", exitCode: null });

  const execution = { status: 1, stdout: "", stderr: "" };
  const classify = (readReport) => runner.collectInnerEvidence({ execution, readReport });
  const missing = new Error("raw missing path"); missing.code = "ENOENT";
  const unreadable = new Error("raw permission detail"); unreadable.code = "EACCES";
  assert.deepEqual(classify(() => { throw missing; }), { executionTerminal: { state: "completed", exitCode: 1 }, innerReportState: "missing" });
  assert.deepEqual(classify(() => { throw unreadable; }), { executionTerminal: { state: "completed", exitCode: 1 }, innerReportState: "unreadable" });
  assert.deepEqual(classify(() => "{"), {
    executionTerminal: { state: "completed", exitCode: 1 },
    innerReportState: "valid",
    innerReportClass: "json-invalid"
  });

  const valid = {
    status: "blocked",
    failure: { name: "Error", message: "raw detail must not project" },
    checks: {
      phase2FixtureMilestone: "phase2-failure-envelope-valid",
      phase2Failure: { stage: "catalog", code: "CATALOG_INVALID" }
    },
    cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRemoved: true, backupRemoved: true },
    terminal: { finalized: true, exitCode: 1 }
  };
  const evidence = classify(() => JSON.stringify(valid));
  assert.equal(evidence.innerReportState, "valid");
  assert.equal(evidence.innerReportClass, "valid-phase2-blocked");
  assert.equal(evidence.lastCompletedMilestone, "phase2-failure-envelope-valid");
  assert.deepEqual(evidence.innerTerminal.failure, { stage: "catalog", code: "CATALOG_INVALID" });
  assert.doesNotMatch(JSON.stringify(evidence), /raw|missing path|permission detail/i);
  valid.checks.phase2Failure.raw = "secret detail";
  assert.equal(classify(() => JSON.stringify(valid)).innerReportClass, "harness-contract-invalid");
});

test("parsed inner reports distinguish harness, pre-Phase2, Phase2, and execution contracts", () => {
  const runner = require(runnerPath);
  const report = ({ status = "blocked", milestone, phase2Failure, baseServiceStart, failure = { name: "Error", message: "raw ignored" }, cleanup } = {}) => ({
    status,
    ...(status === "pass" ? {} : { failure }),
    checks: {
      ...(milestone ? { phase2FixtureMilestone: milestone } : {}),
      ...(phase2Failure ? { phase2Failure } : {}),
      ...(baseServiceStart ? { baseServiceStart } : {})
    },
    cleanup: cleanup || { completed: true, containers: 0, networks: 0, volumes: 0, privateRemoved: true, backupRemoved: true },
    terminal: { finalized: true, exitCode: status === "pass" ? 0 : 1 }
  });
  const classify = (execution, value) => runner.collectInnerEvidence({ execution, readReport: () => JSON.stringify(value) });

  assert.equal(classify({ status: 1, stdout: "" }, report()).innerReportClass, "harness-contract-invalid");
  const earlyMilestones = [
    "harness-entered",
    "supply-chain-ready",
    "fixture-inputs-ready",
    "compose-contract-ready",
    "base-services-started",
    "identity-migration-ready",
    "flarum-migration-ready",
    "workflow-migration-applied",
    "workflow-migration-verified",
    "reviewer-provision-returned",
    "base-provision-ready",
    "ca-trust-ready",
    "old-disabled-baseline-ready",
    "retained-seed-ready",
    "active6-restored",
    "old-images-restored",
    "retained-state-verified",
    "retained-catalog-verified",
    "retained-baseline-ready",
    "pre-phase2-snapshot-ready"
  ];
  for (const milestone of earlyMilestones) {
    const evidence = classify({ status: 1, stdout: "" }, report({ milestone }));
    assert.equal(evidence.innerReportClass, "blocked-before-phase2");
    assert.equal(evidence.lastCompletedMilestone, milestone);
  }
  const baseStart = {
    reason: "port-conflict",
    services: {
      identityDatabase: { state: "created", health: "none" },
      communityDatabase: { state: "running", health: "healthy" },
      admin: { state: "absent", health: "none" }
    }
  };
  const baseStartEvidence = classify({ status: 1, stdout: "" }, report({ milestone: "compose-contract-ready", baseServiceStart: baseStart }));
  assert.deepEqual(baseStartEvidence.baseServiceStart, baseStart);
  assert.doesNotMatch(JSON.stringify(baseStartEvidence), /raw ignored/i);
  assert.equal(classify({ status: 1, stdout: "" }, report({ milestone: "supply-chain-ready", baseServiceStart: baseStart })).innerReportClass, "harness-contract-invalid");
  assert.equal(classify({ status: 1, stdout: "" }, report({ milestone: "compose-contract-ready", baseServiceStart: { ...baseStart, raw: "secret=/tmp/id" } })).innerReportClass, "harness-contract-invalid");
  assert.equal(classify({ status: 1, stdout: "" }, report({ milestone: "phase2-process-returned" })).innerReportClass, "harness-contract-invalid");
  assert.equal(classify({ status: 1, stdout: "" }, report({ milestone: "unknown" })).innerReportClass, "harness-contract-invalid");
  assert.equal(classify({ status: 1, stdout: "" }, report({ failure: { name: "Error", message: "raw", extra: true } })).innerReportClass, "harness-contract-invalid");
  assert.equal(classify({ status: 1, stdout: "" }, report({ cleanup: { completed: true } })).innerReportClass, "harness-contract-invalid");
  assert.equal(classify({ status: 0, stdout: "" }, report({ milestone: "harness-entered" })).innerReportClass, "execution-mismatch");
  assert.equal(classify({ status: 1, stdout: "" }, report({ status: "pass", milestone: "drift-rejection-complete" })).innerReportClass, "execution-mismatch");

  const phase2 = classify({ status: 2, stdout: "" }, report({
    milestone: "phase2-failure-envelope-valid",
    phase2Failure: { stage: "database", code: "DATABASE_INVALID" }
  }));
  assert.equal(phase2.innerReportClass, "valid-phase2-blocked");
  assert.deepEqual(phase2.executionTerminal, { state: "completed", exitCode: 1 });
  assert.doesNotMatch(JSON.stringify(phase2), /raw ignored/i);
});

test("base-service diagnostics map only fixed control-plane enums and never project raw stderr", () => {
  const runner = require(runnerPath);
  const cases = [
    ["Bind for 0.0.0.0:5432 failed: port is already allocated", "port-conflict"],
    ["error mounting /run/secrets/forum: permission denied", "mount-secret"],
    ["no matching manifest for linux/amd64 in the manifest list entries", "image-platform"],
    ["network zhenxing-community-production_default not found", "name-network"],
    ["OCI runtime create failed", "oci-runtime"],
    ["no space left on device", "resource-storage"],
    ["Cannot connect to the Docker daemon", "daemon"],
    ["unclassified failure", "unknown"]
  ];
  for (const [stderr, expected] of cases) assert.equal(runner.classifyBaseStartFailure(stderr), expected);
  assert.equal(runner.classifyBaseStartFailure("opaque allocator failure"), "unknown");
  assert.doesNotMatch(JSON.stringify(cases.map(([stderr]) => runner.classifyBaseStartFailure(stderr))), /tmp|identity/i);
});

test("final blocked evidence projects only fixed inner report class and milestone enums", () => {
  const runner = require(runnerPath);
  const cases = [
    ["json-invalid", "INNER_REPORT_JSON_INVALID", undefined],
    ["harness-contract-invalid", "INNER_REPORT_HARNESS_CONTRACT_INVALID", "phase2-process-returned"],
    ["blocked-before-phase2", "PHASE2_FIXTURE_BLOCKED_BEFORE_PHASE2", "pre-phase2-snapshot-ready"],
    ["execution-mismatch", "INNER_REPORT_EXECUTION_MISMATCH", "drift-rejection-complete"]
  ];
  for (const [innerReportClass, failureCode, lastCompletedMilestone] of cases) {
    const evidence = {
      executionTerminal: { state: "completed", exitCode: 1 },
      innerReportState: "valid",
      innerReportClass,
      ...(lastCompletedMilestone ? { lastCompletedMilestone } : {})
    };
    const report = runner.createEvidenceFinalReport({
      evidence,
      failureCode,
      cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0 }
    });
    assert.equal(report.innerReportClass, innerReportClass);
    assert.equal(report.lastCompletedMilestone, lastCompletedMilestone);
    assert.equal(runner.validateEvidenceFinalReport(report), true);
    assert.equal(Object.hasOwn(report, "innerTerminal"), false);
  }
  assert.throws(() => runner.createEvidenceFinalReport({
    evidence: { executionTerminal: { state: "completed", exitCode: 1 }, innerReportState: "valid", innerReportClass: "unknown" },
    failureCode: "UNKNOWN",
    cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0 }
  }), /report/);
});

test("generated runner-only fixture assigns every fixed early and Phase2 milestone in order", () => {
  const runner = require(runnerPath);
  const source = runner.createInnerFixtureSource({
    fixtureSource: runner.readFrozenBaselineFixture(),
    phase2Program: launcher.createPhase2Program(),
    preparedReleaseRoot: "/opt/zhenxing-ai/releases/community-production-r11-phase2test01",
    workspaceRoot: "/workspace"
  });
  const expected = [
    "harness-entered",
    "supply-chain-ready",
    "fixture-inputs-ready",
    "compose-contract-ready",
    "base-services-started",
    "identity-migration-ready",
    "flarum-migration-ready",
    "workflow-migration-applied",
    "workflow-migration-verified",
    "reviewer-provision-returned",
    "base-provision-ready",
    "ca-trust-ready",
    "old-disabled-baseline-ready",
    "retained-seed-ready",
    "active6-restored",
    "old-images-restored",
    "retained-state-verified",
    "retained-catalog-verified",
    "retained-baseline-ready",
    "pre-phase2-snapshot-ready",
    "phase2-process-returned",
    "phase2-failure-envelope-valid",
    "phase2-success-envelope-valid",
    "post-phase2-snapshot-unchanged",
    "drift-rejection-complete"
  ];
  const assignments = [...source.matchAll(/phase2FixtureMilestone\s*=\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(assignments, expected);
  assert.equal(source.split("phase2FixtureMilestone").length - 1, expected.length);
  assert.equal(runner.sha256(launcher.createPhase2Program()), "d2a1b465324bb4c479d4be20949d1f355ae474e40aaa520d92e09310d114f2ff");
});

test("generated top-level failure writes atomic provisional evidence before missing report classification and partial cleanup", () => {
  const runner = require(runnerPath);
  const directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "aihub-phase2-provisional-"));
  const reportPath = path.join(directory, "report.json");
  try {
    const missing = new Error("raw path"); missing.code = "ENOENT";
    let provisionalSeen = false;
    const evidence = runner.captureInnerEvidence({
      execution: { status: 1, stdout: "", stderr: "" },
      reportPath,
      readReport() {
        const provisional = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        assert.equal(runner.validateProvisionalReport(provisional), true);
        assert.deepEqual(provisional.executionTerminal, { state: "completed", exitCode: 1 });
        provisionalSeen = true;
        throw missing;
      }
    });
    assert.equal(provisionalSeen, true);
    assert.equal(evidence.innerReportState, "missing");
    const finalized = runner.createEvidenceFinalReport({
      evidence,
      failureCode: "INNER_REPORT_MISSING",
      cleanup: { completed: false, containers: 1, networks: 0, volumes: 0, privateRoots: 0 }
    });
    runner.atomicWriteReport(reportPath, finalized);
    assert.deepEqual(JSON.parse(fs.readFileSync(reportPath, "utf8")), finalized);
    assert.equal(finalized.status, "partial");
    assert.deepEqual(finalized.executionTerminal, { state: "completed", exitCode: 1 });
    assert.equal(fs.existsSync(`${reportPath}.tmp`), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("cleanup failure finalizes partial evidence and exact report validation rejects raw or unknown fields", () => {
  const runner = require(runnerPath);
  const evidence = { executionTerminal: { state: "completed", exitCode: 1 }, innerReportState: "missing" };
  const report = runner.createEvidenceFinalReport({
    evidence,
    failureCode: "INNER_REPORT_MISSING",
    cleanup: { completed: false, containers: 1, networks: 0, volumes: 0, privateRoots: 0 }
  });
  assert.equal(report.status, "partial");
  assert.equal(report.terminal.finalized, true);
  assert.deepEqual(report.executionTerminal, evidence.executionTerminal);
  assert.equal(report.innerReportState, "missing");
  assert.equal(Object.hasOwn(report, "innerTerminal"), false);
  assert.equal(runner.validateEvidenceFinalReport(report), true);
  assert.throws(() => runner.validateEvidenceFinalReport({ ...report, raw: "detail" }), /report/);
  assert.throws(() => runner.createEvidenceFinalReport({ ...report, evidence, failureCode: "UNKNOWN", cleanup: report.cleanup }), /report/);

  const blockedInner = runner.collectInnerEvidence({
    execution: { status: 1, stdout: "", stderr: "raw daemon detail" },
    readReport: () => JSON.stringify({
      status: "blocked",
      failure: { name: "Error", message: "raw ignored" },
      checks: {
        phase2FixtureMilestone: "phase2-failure-envelope-valid",
        phase2Failure: { stage: "database", code: "DATABASE_INVALID" }
      },
      cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRemoved: true, backupRemoved: true },
      terminal: { finalized: true, exitCode: 1 }
    })
  });
  const blockedReport = runner.createEvidenceFinalReport({
    evidence: blockedInner,
    failureCode: "PHASE2_FIXTURE_BLOCKED",
    cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0 }
  });
  assert.equal(blockedReport.innerReportClass, "valid-phase2-blocked");
  assert.equal(blockedReport.lastCompletedMilestone, "phase2-failure-envelope-valid");
  assert.deepEqual(blockedReport.innerTerminal.failure, { stage: "database", code: "DATABASE_INVALID" });
  assert.doesNotMatch(JSON.stringify(blockedReport), /raw daemon/i);
  assert.throws(() => runner.validateEvidenceFinalReport({
    ...blockedReport,
    innerTerminal: { ...blockedReport.innerTerminal, raw: "secret detail" }
  }), /report/);
});

test("runner captures execution provisionally before inner report read and atomically finalizes after cleanup", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  const execution = source.indexOf("const execution = innerRaw(");
  const capture = source.indexOf("innerEvidence = captureInnerEvidence(", execution);
  const reportRead = source.indexOf("readReport:", capture);
  const cleanup = source.indexOf("let cleanupControlFailed", reportRead);
  const finalWrite = source.indexOf("atomicWriteReport(reportPath, finalReport)", cleanup);
  assert.ok(execution > 0 && capture > execution && reportRead > capture && cleanup > reportRead && finalWrite > cleanup);
  assert.doesNotMatch(source, /innerTerminal\s*=\s*null/);
  assert.doesNotMatch(source, /innerTerminal:\s*innerTerminal/);
});

test("formal local Phase2 report is exact and retained-only", () => {
  const { validateFinalReport } = require(runnerPath);
  const report = {
    schema: "aihub-workflow-production-readonly-phase2-fixture-v1",
    candidateOnly: true,
    deployable: false,
    baseline: "disabled-retained-official-bootstrap",
    phase2ProgramSha256: "1".repeat(64),
    checks: {
      preparedRuntimeExact: true,
      sourcePureGet: true,
      retainedExact: true,
      catalogExact: true,
      capabilityDisabledExact: true,
      publicFeatureDisabledExact: true,
      serviceImagesExact: true,
      mountsAndSecretsExact: true,
      beforeAfterUnchanged: true,
      preexistingDriftRejected: true
    },
    mutations: { phase2Writes: 0, httpWrites: 0, eventDelta: 0, idempotencyDelta: 0, eventHeadDelta: 0 },
    cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0 },
    residue: { docker: 0, files: 0 },
    status: "pass"
  };
  assert.equal(validateFinalReport(report), true);
  assert.throws(() => validateFinalReport({ ...report, rawRows: [] }), /report/);
  assert.throws(() => validateFinalReport({ ...report, baseline: "empty" }), /report/);
});

test("runner stays outside the deployment payload and invokes no production transport", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.doesNotMatch(source, /\bssh(?:\.exe)?\b|scp|sftp|workflow-production-cutover\.sh/);
  assert.doesNotMatch(source, /install[^\n]+\/workspace\/prior-deployment/, "docker cp directory target must not preexist");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "deployment", "community-production", "manifest.json"), "utf8"));
  assert.equal(JSON.stringify(manifest).includes(path.basename(runnerPath)), false);
});

test("only the local fixture enables prepared Node system CA trust", () => {
  const runner = require(runnerPath);
  const source = runner.createInnerFixtureSource({
    fixtureSource: runner.readFrozenBaselineFixture(),
    phase2Program: launcher.createPhase2Program(),
    preparedReleaseRoot: "/opt/zhenxing-ai/releases/community-production-r11-phase2test01",
    workspaceRoot: "/workspace"
  });
  assert.match(source, /env:\{LC_ALL:"C",NODE_USE_SYSTEM_CA:"1"\}/);
  assert.doesNotMatch(launcher.createPhase2Program(), /NODE_USE_SYSTEM_CA/);
  const bundleRoot = path.join(root, "output", "workflow-production-r11-2a114734-20260810-v2.bundle");
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(?:cjs|js|json|md|sh|tsv|txt|ya?ml)$/i.test(entry.name)) assert.doesNotMatch(fs.readFileSync(target, "utf8"), /NODE_USE_SYSTEM_CA/);
    }
  };
  visit(bundleRoot);
});
