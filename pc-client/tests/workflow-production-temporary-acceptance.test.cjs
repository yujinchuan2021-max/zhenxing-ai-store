"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const runnerPath = path.join(deployment, "workflow-production-temporary-acceptance.cjs");
const cutoverPath = path.join(deployment, "workflow-production-cutover.sh");
const cutoverHarnessPath = path.join(root, "output", "workflow-reviewer-service-independent-cutover-harness.cjs");
const bundleContractPath = path.join(deployment, "workflow-production-release-bundle.cjs");
const imageArchiveContractPath = path.join(deployment, "workflow-image-archive.cjs");
const releaseBundleCutoverGatePath = path.join(root, "scripts", "test-workflow-production-release-bundle-cutover.cjs");
const TEST_CAPABILITY_PROBE_TIMEOUT_MS = 1_000;
const TEST_CAPABILITY_PROBE_INTERVAL_MS = 250;
const TEST_CAPABILITY_PROBE_REQUEST_TIMEOUT_MS = 100;

function runNodeProgram(program) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", program], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("catalog readiness probe test timed out"));
    }, 5_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`catalog readiness probe exited ${code}: ${stderr}`));
      else resolve(JSON.parse(stdout));
    });
  });
}

async function withCapabilityServer(responder, action) {
  let attempts = 0;
  const server = http.createServer((request, response) => {
    attempts += 1;
    assert.equal(request.method, "GET");
    assert.equal(request.url, "/v1/community/workflow-store/capability");
    const reply = responder(attempts);
    response.writeHead(reply.status, { "content-type": reply.contentType || "application/json" });
    response.end(reply.body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => {
      server.removeListener("error", reject);
      resolve();
    });
    server.listen(4180, "127.0.0.1");
  });
  assert.deepEqual(server.address(), { address: "127.0.0.1", family: "IPv4", port: 4180 });
  try {
    return await action(() => attempts);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("production Workflow acceptance owns one representable Flarum fixture post", () => {
  const runner = require(runnerPath);
  assert.equal(runner.FIXTURE_POST_ID, "2147483647");
  assert.equal(runner.normalizeFixturePostId("2147483647"), "2147483647");
  assert.throws(() => runner.normalizeFixturePostId(String(runner.UINT32_MAX + 1n)), /fixture post ID/i);
  assert.throws(() => runner.normalizeFixturePostId(`${runner.FIXTURE_POST_ID}\n`), /fixture post ID/i);
});

test("runner pins the reviewed Admin image instead of accepting an environment-selected image", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /zhenxing-ai\/admin:0\.1\.40-src-186ff057efd3/);
  assert.match(source, /sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd/);
  assert.match(source, /AIHUB_ADMIN_CMS_IMAGE: ADMIN_IMAGE/);
});

test("independent cutover harness binds active7 images and exact prior-image rollback", () => {
  const source = [bundleContractPath, imageArchiveContractPath, releaseBundleCutoverGatePath]
    .map((filename) => fs.readFileSync(filename, "utf8")).join("\n");
  assert.match(source, /zhenxing-ai\/admin:0\.1\.40-src-186ff057efd3/);
  assert.match(source, /sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd/);
  assert.match(source, /zhenxing-ai\/admin:community-candidate-b6ea4c5bd0e9/);
  assert.match(source, /sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2/);
  assert.match(source, /zhenxing-ai\/identity:workflow-readiness-candidate-d9fa8de84dc8/);
  assert.match(source, /sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01/);
  assert.match(source, /d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8/);
  assert.match(source, /zhenxing-ai\/identity:workflow-readiness-candidate-19a223a18392/);
  assert.match(source, /sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567/);
  assert.match(source, /createWorkflowProductionReleaseBundle/);
  assert.match(source, /verifyPreparedRelease\(prepared\)/);
  assert.match(source, /\.aihub-workflow-release-prepared\.json/);
  assert.doesNotMatch(source, /AIHUB_WORKFLOW_RELEASE_PREPARED_BYPASS/);
});

test("independent cutover harness rebuilds only its disposable catalog state pointer from the fixed active6 snapshot", async (t) => {
  const harness = require(cutoverHarnessPath);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-cutover-active6-fixture-"));
  const sourcePublished = path.join(root, "admin", "published");
  const sourceState = path.join(sourcePublished, "catalog-store", "state.json");
  const sourceStateBefore = fs.readFileSync(sourceState);
  const fixturePublished = path.join(temporary, "admin-published");
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));

  const result = await harness.prepareActive6CatalogFixture(sourcePublished, fixturePublished);

  assert.equal(result.v2.activeRelease.releaseId, harness.ACTIVE6_FIXTURE.v2ReleaseId);
  assert.equal(result.activeV2.envelope.payload.catalogSha256, harness.ACTIVE6_FIXTURE.v2CatalogSha256);
  assert.equal(result.v1.activeRelease.releaseId, harness.ACTIVE6_FIXTURE.v1ReleaseId);
  assert.equal(fs.existsSync(path.join(fixturePublished, "catalog-store", "releases", "catalog-v00000007-8c49e1972186-0cec5335.json")), true);
  assert.deepEqual(fs.readFileSync(sourceState), sourceStateBefore, "workspace authority state must remain untouched");
});

test("independent cutover harness constructs and preserves the exact existing-online-empty baseline", () => {
  const harness = require(cutoverHarnessPath);
  const source = fs.readFileSync(cutoverHarnessPath, "utf8");
  const expected = {
    schema: "applied",
    appendOnly: true,
    events: 0,
    idempotency: 0,
    eventHead: 0,
    reviewerExact: 1,
    reviewerForbiddenRelations: 0,
    productionFlagsEnabled: true
  };
  const rolledBackDisabled = { ...expected, productionFlagsEnabled: false };

  assert.deepEqual(harness.assertExistingOnlineEmptyBaseline(expected), expected);
  assert.deepEqual(harness.assertExistingOnlineEmptyBaseline(rolledBackDisabled), rolledBackDisabled);
  assert.throws(
    () => harness.assertExistingOnlineEmptyBaseline({ ...expected, reviewerForbiddenRelations: 1 }),
    /existing-online-empty baseline/i
  );
  assert.throws(
    () => harness.assertExistingOnlineEmptyBaseline({ ...expected, productionFlagsEnabled: "partial" }),
    /existing-online-empty baseline/i
  );
  assert.match(source, /AIHUB_WORKFLOW_MIGRATION_MODE=apply/);
  assert.match(source, /AIHUB_WORKFLOW_MIGRATION_MODE=verify/);
  assert.match(source, /workflow-reviewer-provision"\], \{ input: "commit\\n" \}/);
  assert.match(source, /existingOnlineEmptyBaseline/);
  assert.match(source, /reviewerForbiddenRelations/);
  assert.match(source, /AIHUB_ADMIN_CMS_IMAGE: oldAdminImage/);
  assert.match(source, /construct rolled-back disabled baseline through emergency-disable/);
  assert.match(source, /existingOnlineEmptyBaseline\.productionFlagsEnabled, false/);
  assert.match(source, /community_workflow\.events"\), "9"/);
  assert.match(source, /community_workflow\.idempotency"\), "9"/);
  assert.match(source, /event_head where singleton=true"\), "9"/);
  assert.match(source, /createDraft,submitDraft,reviewSubmission,createDraft,submitDraft,reviewSubmission,createDraft,submitDraft,reviewSubmission/);
  assert.match(source, /failureRollbackPreservedExistingBaseline/);
  assert.match(source, /failureRollbackRestoredOldImages = \{ adminPrior: true, identityPrior: true \}/);
  assert.doesNotMatch(source, /baseHealthyNoImplicitCandidate/);
});

test("independent cutover harness constructs the exact retained bootstrap baseline and keeps it through failure rollback", () => {
  const harness = require(cutoverHarnessPath);
  const source = fs.readFileSync(cutoverHarnessPath, "utf8");
  const retained = {
    schema: "applied",
    appendOnly: true,
    events: 9,
    idempotency: 9,
    eventHead: 9,
    reviewerExact: 1,
    reviewerForbiddenRelations: 0,
    publisherExact: 1,
    publisherForbiddenRelations: 0,
    sourcePostsExact: 3,
    productionFlagsEnabled: false
  };
  assert.deepEqual(harness.assertDisabledRetainedOfficialBootstrapBaseline(retained), retained);
  assert.throws(
    () => harness.assertDisabledRetainedOfficialBootstrapBaseline({ ...retained, events: 10 }),
    /retained official bootstrap baseline/i
  );
  assert.match(source, /retained-baseline-official-bootstrap/);
  assert.match(source, /workflow-official-bootstrap-production-wrapper\.cjs/);
  assert.match(source, /catalog-active7-state-activation\.cjs/);
  assert.match(source, /compose\(\["up", "-d", "--no-build", "--no-deps", "admin"\]\), "restore retained baseline prior Admin"/);
  assert.doesNotMatch(source, /compose\(\["up", "-d", "--no-build", "admin", "caddy"\]\), "restore retained baseline prior Admin\/Caddy"/);
  assert.match(source, /disabledRetainedOfficialBootstrapBaseline/);
  assert.match(source, /retainedOneShotStayedIdempotent/);
  assert.match(source, /retained-success/);
  assert.match(source, /retained-failure/);
});

test("independent cutover harness uses real Caddy HTTPS with one test-only trusted local CA", () => {
  const source = fs.readFileSync(cutoverHarnessPath, "utf8");
  assert.match(source, /NODE_EXTRA_CA_CERTS: \/run\/aihub-caddy-ca\/root\.crt/);
  assert.match(source, /caddy_trust:\/run\/aihub-caddy-ca:ro/);
  assert.match(source, /AIHUB_CADDY_TRUST_VOLUME/);
  assert.doesNotMatch(source, /caddy_data:\/run\/aihub-caddy-(?:data|ca):ro/);
  assert.match(source, /AIHUB_PUBLIC_HOST: "workflow-cutover\.localhost"/);
  assert.match(source, /async function prepareCaddyLocalCaTrust/);
  assert.match(source, /--cap-add", "DAC_READ_SEARCH"/);
  assert.match(source, /\/source\/caddy\/pki\/authorities\/local\/root\.crt/);
  assert.match(source, /--user", "1000:1000"/);
  assert.match(source, /test -r \/trust\/root\.crt/);
  assert.match(source, /report\.checks\.caddyLocalCaTrustReady = await prepareCaddyLocalCaTrust\(\)/);
  assert.doesNotMatch(source, /replace\(\/\^\\\{\\\$AIHUB_(?:COMMUNITY_)?PUBLIC_HOST/);
});

test("independent cutover harness keeps fresh active6 provisioning behind canonical final-TCP readiness", () => {
  const harness = require(cutoverHarnessPath);
  const source = fs.readFileSync(cutoverHarnessPath, "utf8");
  const finalTcpConfig = {
    services: {
      "identity-database": {
        healthcheck: {
          test: ["CMD-SHELL", "PGPASSWORD=\"$(cat /run/secrets/identity_db_password)\" psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U aihub -d aihub -Atqc \"SELECT CASE WHEN current_database()='aihub' AND current_user='aihub' THEN 1 ELSE 0 END\" | grep -qx 1"]
        }
      }
    }
  };

  assert.deepEqual(harness.assertBaselineDatabaseFinalTcpReady(finalTcpConfig), {
    gate: "compose-service-healthy",
    transport: "tcp",
    host: "127.0.0.1"
  });
  assert.throws(
    () => harness.assertBaselineDatabaseFinalTcpReady({
      services: {
        "identity-database": {
          healthcheck: { test: ["CMD-SHELL", "psql -X -v ON_ERROR_STOP=1 -U aihub -d aihub -Atqc \"SELECT 1\""] }
        }
      }
    }),
    /final-TCP readiness/i
  );
  assert.match(source, /test: \$\{JSON\.stringify\(BASELINE_DATABASE_FINAL_TCP_HEALTHCHECK\)\}/);
  assert.match(source, /replaceAll\("\$\$", "\$"\)/);
  assert.match(source, /compose\(\["config", "--format", "json"\]\)/);
  assert.match(source, /baselineDatabaseFinalTcpReady/);
  assert.match(source, /files = \[priorBase, priorOverlay, windowsOverride, portsOverride, caddyOverride\]/);
});

test("release bundle cutover gate can select empty or retained scenarios while defaulting to all four", () => {
  const source = fs.readFileSync(releaseBundleCutoverGatePath, "utf8");

  assert.match(source, /const requestedScenario = process\.argv\[3\] \|\| "both"/);
  assert.match(source, /"retained-success", "retained-failure"/);
  assert.match(source, /report\.retainedSuccess/);
  assert.match(source, /report\.retainedFailure/);
  assert.match(source, /\["both", "success"\]\.includes\(requestedScenario\)/);
  assert.match(source, /\["both", "failure"\]\.includes\(requestedScenario\)/);
});

test("release bundle cutover gate accepts only an exited child with an atomically finalized report and reuses its prepared release", () => {
  const runner = fs.readFileSync(runnerPath, "utf8");
  const cutover = fs.readFileSync(cutoverPath, "utf8");
  const gate = fs.readFileSync(releaseBundleCutoverGatePath, "utf8");
  const harness = fs.readFileSync(cutoverHarnessPath, "utf8");

  assert.match(runner, /finalized/);
  assert.match(runner, /fs\.renameSync\(/);
  assert.match(cutover, /workflow-temporary-acceptance-report\.json/);
  assert.match(cutover, /report\.finalized\s*!==\s*true/);
  assert.match(gate, /verifyPreparedRelease\(prepared/);
  assert.match(gate, /preparedReleaseRoot/);
  assert.match(gate, /function createPreparedCutoverFixtureSource/);
  assert.match(gate, /const sourceDeployment = \$\{JSON\.stringify\(preparedDeployment\)\}/);
  assert.match(gate, /generated fixture must not build a fallback prepared release/);
  assert.match(gate, /scenario must reuse the verified prepared release/);
  assert.match(gate, /scenario must produce exactly one finalized inner acceptance report/);
  assert.match(gate, /inner acceptance report must bind the caller prepared release manifest/);
  assert.match(harness, /report\.terminal = \{ finalized: true, exitCode:/);
});

test("independent cutover harness executes the production canonical two-file bootstrap wrapper", () => {
  const source = fs.readFileSync(cutoverHarnessPath, "utf8");
  assert.match(source, /name === "forum_api_key" \? `\$\{secret\}\\n` : secret/);
  assert.match(source, /productionTwoFileBootstrap/);
  assert.match(source, /workflow-official-bootstrap-production-wrapper\.cjs/);
  assert.match(
    source,
    /workflow-official-bootstrap-production-wrapper\.cjs"\),\s+productionEvidence, adminOrigin, env\.AIHUB_PUBLIC_HOST, base, overlay/
  );
  assert.match(source, /productionEnvironment\.AIHUB_ADMIN_CMS_IMAGE = adminImage/);
  assert.match(source, /delete productionEnvironment\.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE/);
  assert.match(source, /officialWorkflows: 3, events: 9, idempotency: 9/);
});

test("runner writes its non-secret Caddyfile for the dropped runtime identity while secrets stay private", () => {
  const runner = require(runnerPath);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-runner-caddyfile-"));
  const caddyfile = path.join(directory, "Caddyfile");
  try {
    runner.writeAcceptanceCaddyfile(caddyfile, ":2015 { respond /health 200 }\n");
    if (process.platform !== "win32") assert.equal(fs.statSync(caddyfile).mode & 0o777, 0o644);

    const source = fs.readFileSync(runnerPath, "utf8");
    assert.match(source, /function writeAcceptanceCaddyfile[\s\S]*mode: 0o644[\s\S]*chmodSync\(filename, 0o644\)/);
    assert.match(source, /writeAcceptanceCaddyfile\(caddyfile,/);
    assert.match(source, /for \(const name of names\) writePrivate\(path\.join\(secrets, name\)/);
    assert.match(source, /writePrivate\(override,/);
    assert.doesNotMatch(source, /writePrivate\(caddyfile,/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("cutover pins the repository runner and rejects an arbitrary runner environment seam", () => {
  const source = fs.readFileSync(cutoverPath, "utf8");
  assert.match(source, /"\$workflow_node" "\$script_dir\/workflow-production-temporary-acceptance\.cjs" "\$base" "\$overlay" "\$evidence"/);
  assert.doesNotMatch(source, /(^|[;&|()\s])node(?:\s|$)/m);
  assert.doesNotMatch(source, /AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_RUNNER/);
  assert.doesNotMatch(source, /acceptance_runner=/);
});

test("runner is isolated, report-allowlisted, and never tears down shared production", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /workflowacceptance/);
  assert.match(source, /down", "--volumes", "--remove-orphans"/);
  assert.match(source, /community_workflow\.events/);
  assert.match(source, /PUBLIC_WORKFLOW_UNAVAILABLE/);
  assert.match(source, /secretPlaceholders/);
  assert.match(source, /cleanup/);
  assert.doesNotMatch(source, /DELETE\s+FROM\s+community_workflow\.events/i);
  assert.doesNotMatch(source, /DROP\s+SCHEMA\s+community_workflow/i);
  assert.doesNotMatch(source, /docker\s+(?:system\s+)?prune/i);
});

test("report boundary rejects identity, secret, URL, and unknown-field leakage", () => {
  const runner = require(runnerPath);
  const base = {
    schema: "aihub-workflow-temporary-acceptance-v1", candidateOnly: true, deployable: false,
    status: "blocked", manifestDigest: null, identityImageId: null, identitySourceDigest: null,
    runnerSha256: "0".repeat(64), isolatedProjectScope: "workflowacceptancefixture",
    checks: {}, steps: {}, workflowReference: null, publicRedaction: null, database: null,
    cleanup: { scope: "workflowacceptancefixture", completed: true }, failureStage: "preflight", finalized: false
  };
  assert.equal(runner.assertSafeReport(base), base);
  assert.equal(runner.assertSafeReport({ ...base, readyAttribution: null }).status, "blocked");
  assert.throws(() => runner.assertSafeReport({
    ...base,
    readyAttribution: {
      component: "community", reason: "health-timeout", status: "starting",
      elapsedBucket: "180-240s", attemptCount: 181, httpStatusClass: null, raw: "hidden"
    }
  }), /attribution/i);
  assert.equal(runner.assertSafeReport({ ...base, steps: { fullStackCapability: { status: 200, code: null } } }).status, "blocked");
  assert.throws(() => runner.assertSafeReport({ ...base, token: "value" }), /schema/i);
  assert.throws(() => runner.assertSafeReport({ ...base, steps: { leak: { message: "Bearer hidden" } } }), /private/i);
  assert.throws(() => runner.assertSafeReport({ ...base, steps: { leak: { message: "https://example.invalid" } } }), /private/i);
  assert.throws(() => runner.assertSafeReport({ ...base, steps: { leak: { stack: "at hidden:1" } } }), /private/i);
});

test("runner emits a minimal allowlisted report if a collected result fails redaction", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /report\.checks = \{ reportRedaction: false \}/);
  assert.match(source, /report\.steps = \{\}/);
  assert.match(source, /assertSafeReport\(report\);[\s\S]*writeSafeReport\(reportPath, report\)/);
});

test("ready-stage failures retain one safe exact probe without raw error text", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  const probes = [
    "community-health",
    "caddy-health",
    "flarum-post-exact",
    "public-capability",
    "full-stack-readiness",
    "passed"
  ];
  let previous = source.indexOf('updateStage("ready")');
  assert.notEqual(previous, -1);
  for (const probe of probes) {
    const current = source.indexOf(`report.checks.readyProbe = "${probe}"`, previous);
    assert.ok(current > previous, `missing ordered ready probe ${probe}`);
    previous = current;
  }
  assert.doesNotMatch(source, /report\.checks\.ready(?:Error|Message|Body|Url|Stack)/);
});

test("ready attribution is a strict allowlisted component contract", () => {
  const runner = require(runnerPath);
  const starting = runner.createReadyAttribution({
    component: "community",
    reason: "health-timeout",
    status: "starting",
    elapsedMs: 181_000,
    attemptCount: 181
  });
  assert.deepEqual(starting, {
    component: "community",
    reason: "health-timeout",
    status: "starting",
    elapsedBucket: "180-240s",
    attemptCount: 181,
    httpStatusClass: null
  });
  assert.throws(() => runner.createReadyAttribution({
    component: "community",
    reason: "health-timeout",
    status: "starting",
    elapsedMs: 1,
    attemptCount: 1,
    message: "raw error"
  }), /attribution/i);
  assert.throws(() => runner.createReadyAttribution({
    component: "external-host",
    reason: "health-timeout",
    status: "starting",
    elapsedMs: 1,
    attemptCount: 1
  }), /attribution/i);
});

test("ready health diagnosis distinguishes Community and Caddy without raw Compose rows", () => {
  const runner = require(runnerPath);
  const healthyDependencies = ["identity-database", "community-database", "admin", "identity"]
    .map((Service) => ({ Service, State: "running", Health: "healthy" }));
  assert.deepEqual(runner.classifyReadyHealth({
    component: "community",
    rows: [...healthyDependencies, { Service: "community", State: "running", Health: "starting" }],
    elapsedMs: 220_000,
    attemptCount: 220
  }), {
    component: "community",
    reason: "health-timeout",
    status: "starting",
    elapsedBucket: "180-240s",
    attemptCount: 220,
    httpStatusClass: null
  });
  assert.deepEqual(runner.classifyReadyHealth({
    component: "caddy",
    rows: [...healthyDependencies, { Service: "community", State: "running", Health: "healthy" }],
    elapsedMs: 1_000,
    attemptCount: 2
  }), {
    component: "caddy",
    reason: "service-missing",
    status: "missing",
    elapsedBucket: "under-5s",
    attemptCount: 2,
    httpStatusClass: null
  });
  assert.equal(runner.classifyReadyHealth({
    component: "community",
    rows: [
      { Service: "identity-database", State: "running", Health: "healthy" },
      { Service: "admin", State: "running", Health: "healthy" },
      { Service: "identity", State: "running", Health: "unhealthy" }
    ],
    elapsedMs: 5_000,
    attemptCount: 1
  }).component, "identity");
});

test("ready HTTP attribution distinguishes the three fixed post-health components", () => {
  const runner = require(runnerPath);
  const cases = [
    ["flarum-post", "http-status", "unexpected-status", "5xx"],
    ["public-capability", "contract-mismatch", "contract-mismatch", "2xx"],
    ["catalog-readiness", "readiness-timeout", "not-ready", "5xx"]
  ];
  for (const [component, reason, status, httpStatusClass] of cases) {
    assert.deepEqual(runner.createReadyAttribution({
      component, reason, status, elapsedMs: 30_000, attemptCount: 3, httpStatusClass
    }), {
      component, reason, status, elapsedBucket: "30-60s", attemptCount: 3, httpStatusClass
    });
  }
});

test("full-stack catalog readiness reaches the fifth real HTTP response in one persistent in-container process", async () => {
  const runner = require(runnerPath);
  await withCapabilityServer(
    (attempt) => ({
      status: 200,
      body: JSON.stringify({
        enabled: attempt >= 5,
        execution: false,
        schemaVersion: 1,
        workflowSubmissionLookup: false
      })
    }),
    async (attempts) => {
      const result = await runNodeProgram(runner.catalogReadinessProbeProgram(1_000, 5, 100));
      assert.deepEqual(result, { status: 200, enabled: true, attemptCount: 5 });
      assert.equal(attempts(), 5, "the old four responses remain not-ready and the fifth is authoritative ready");
    }
  );
});

test("catalog readiness persistent probe fails closed for non-2xx, false, malformed, early-exit, and timeout results", async (t) => {
  const runner = require(runnerPath);
  const cases = [
    ["non-2xx", () => ({ status: 503, body: JSON.stringify({ enabled: true }) }), 503],
    ["enabled false", () => ({ status: 200, body: JSON.stringify({ enabled: false }) }), 200],
    ["malformed", () => ({ status: 200, contentType: "text/plain", body: "not-json" }), 200]
  ];
  for (const [name, responder, expectedStatus] of cases) {
    await t.test(name, async () => {
      await withCapabilityServer(responder, async (attempts) => {
        const result = await runNodeProgram(runner.catalogReadinessProbeProgram(
          TEST_CAPABILITY_PROBE_TIMEOUT_MS,
          TEST_CAPABILITY_PROBE_INTERVAL_MS,
          TEST_CAPABILITY_PROBE_REQUEST_TIMEOUT_MS
        ));
        assert.equal(result.status, expectedStatus, JSON.stringify({ attempts: attempts(), result }));
        assert.equal(result.enabled, false);
        assert.ok(result.attemptCount >= 2);
        assert.ok(result.attemptCount >= attempts());
        assert.ok(result.attemptCount - attempts() <= 1, "only the deadline-edge fetch may abort before server receipt");
      });
    });
  }

  for (const code of ["EARLY_EXIT", "ETIMEDOUT"]) {
    const error = new Error("private child failure must not escape");
    error.code = code;
    const result = runner.runCatalogReadinessProbe("workflowacceptancefixed-identity-1", () => { throw error; });
    assert.deepEqual(result, { status: 0, enabled: false, attemptCount: 1 });
  }
});

test("catalog readiness persistent probe requires the exact owner capability contract without exporting it", async (t) => {
  const runner = require(runnerPath);
  const cases = [
    ["schema drift", { enabled: true, execution: false, schemaVersion: 2, workflowSubmissionLookup: false }],
    ["execution drift", { enabled: true, execution: true, schemaVersion: 1, workflowSubmissionLookup: false }],
    ["submission lookup enabled", { enabled: true, execution: false, schemaVersion: 1, workflowSubmissionLookup: true }],
    ["submission lookup missing", { enabled: true, execution: false, schemaVersion: 1 }]
  ];
  for (const [name, body] of cases) {
    await t.test(name, async () => {
      await withCapabilityServer(
        () => ({ status: 200, body: JSON.stringify(body) }),
        async (attempts) => {
          const result = await runNodeProgram(runner.catalogReadinessProbeProgram(
            TEST_CAPABILITY_PROBE_TIMEOUT_MS,
            TEST_CAPABILITY_PROBE_INTERVAL_MS,
            TEST_CAPABILITY_PROBE_REQUEST_TIMEOUT_MS
          ));
          assert.equal(result.status, 200, JSON.stringify({ attempts: attempts(), result }));
          assert.equal(result.enabled, false);
          assert.deepEqual(Object.keys(result).sort(), ["attemptCount", "enabled", "status"]);
        }
      );
    });
  }
});

test("owner capability readiness stays separate from the manifest-controlled signed v2 tuple", () => {
  const runner = require(runnerPath);
  const program = runner.catalogReadinessProbeProgram();
  const cutover = fs.readFileSync(cutoverPath, "utf8");
  const activation = JSON.parse(fs.readFileSync(
    path.join(deployment, "catalog-active7-state-activation-manifest.json"),
    "utf8"
  ));
  assert.match(program, /\/v1\/community\/workflow-store\/capability/);
  assert.doesNotMatch(program, /channels\/v2|catalog-release\.json/);
  assert.equal(activation.target.releaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  assert.equal(activation.target.catalogVersion, 7);
  assert.equal(activation.target.releaseSha256, "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4");
  assert.equal(activation.target.parentReleaseId, "catalog-v00000006-567e671621f1-3dcee587");
  assert.match(cutover, /catalog-active7-state-activation\.cjs" activate/);
  assert.match(cutover, /catalogSha256!=="8c49e1972186f841dca9cea8f26074fe27aed9a140e4f5687cf7f23d134f034c"/);
});

test("catalog readiness probe is fixed, single-exec, bounded, redacted, and leaves failure cleanup reachable", () => {
  const runner = require(runnerPath);
  const calls = [];
  const result = runner.runCatalogReadinessProbe("workflowacceptancefixed-identity-1", (args, options) => {
    calls.push({ args, options });
    return JSON.stringify({
      status: 200,
      enabled: true,
      attemptCount: 5,
      secret: "must-not-cross-the-probe-boundary"
    });
  });
  assert.deepEqual(result, { status: 0, enabled: false, attemptCount: 1 });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.slice(0, 5), [
    "exec", "-i", "workflowacceptancefixed-identity-1", "node", "-e"
  ]);
  assert.equal(calls[0].options.timeout, 35_000);
  assert.equal(calls[0].options.killSignal, "SIGKILL");
  assert.doesNotMatch(calls[0].args[5], /process\.env|secret|authorization|cookie/i);

  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /CATALOG_READY_TIMEOUT_MS\s*=\s*30_000/);
  assert.match(source, /CATALOG_READY_INTERVAL_MS\s*=\s*250/);
  assert.match(source, /fullStackCapability\s*=\s*runCatalogReadinessProbe\([^)]+\)/);
  assert.doesNotMatch(source, /while \(Date\.now\(\) < fullStackReadyDeadline\)/);
  assert.match(source, /fullStackCapability\s*=\s*runCatalogReadinessProbe[\s\S]*finally \{[\s\S]*compose\(\["down", "--volumes", "--remove-orphans"\]/);
});

test("ready health uses bounded component-specific windows instead of one shared timeout", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /COMMUNITY_READY_TIMEOUT_MS\s*=\s*240_000/);
  assert.match(source, /CADDY_READY_TIMEOUT_MS\s*=\s*150_000/);
  assert.match(source, /startReadyService\("community", COMMUNITY_READY_TIMEOUT_MS\)/);
  assert.match(source, /startReadyService\("caddy", CADDY_READY_TIMEOUT_MS\)/);
  assert.doesNotMatch(source, /waitHealthy\(\["identity", "community", "caddy"\]\)/);
});

test("runner attempts every exact cleanup target even if Compose teardown fails", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /let cleanupComplete = true/);
  assert.match(source, /for \(const volume of externalVolumes\) \{[\s\S]*docker\(\["volume", "rm", "-f", volume\]/);
  assert.match(source, /const projectResourcesRemoved = cleanupComplete && !containers && !networks && !volumes/);
  assert.match(source, /writeSafeReport\(reportPath, report\);[\s\S]*cleanupPrivateFixtureDirectory[\s\S]*writeSafeReport\(reportPath, report\)/);
});

test("private cleanup scope accepts only the exact runner-owned project directory", () => {
  const runner = require(runnerPath);
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-runner-evidence-"));
  const project = "workflowacceptance20260808123456789abcdef123456";
  const runRoot = path.join(evidence, `${project}-private`);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-runner-outside-"));
  fs.mkdirSync(runRoot);
  try {
    assert.equal(
      runner.validatePrivateFixtureCleanupScope({ evidence, project, runRoot }),
      fs.realpathSync.native(runRoot)
    );
    assert.throws(
      () => runner.validatePrivateFixtureCleanupScope({ evidence, project, runRoot: outside }),
      /private cleanup scope/i
    );
  } finally {
    fs.rmSync(evidence, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("private cleanup refuses symlinks and active container bind references", () => {
  const runner = require(runnerPath);
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-runner-evidence-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-runner-outside-"));
  const project = "workflowacceptance20260808123456789abcdef123456";
  const runRoot = path.join(evidence, `${project}-private`);
  fs.mkdirSync(runRoot);
  fs.symlinkSync(outside, path.join(runRoot, "community-db"), process.platform === "win32" ? "junction" : "dir");
  const noContainers = (args) => args[0] === "ps" ? "" : "[]";
  try {
    assert.equal(runner.cleanupPrivateFixtureDirectory({ evidence, project, runRoot, dockerFn: noContainers }), false);
    assert.equal(fs.existsSync(runRoot), true);
    assert.equal(fs.existsSync(outside), true);
    fs.rmdirSync(path.join(runRoot, "community-db"));
    fs.mkdirSync(path.join(runRoot, "community-db"));
    const referenced = (args) => args[0] === "ps" ? "container-id\n" : JSON.stringify([{ Mounts: [{ Type: "bind", Source: runRoot }] }]);
    assert.equal(runner.cleanupPrivateFixtureDirectory({ evidence, project, runRoot, dockerFn: referenced }), false);
    assert.equal(fs.existsSync(runRoot), true);
  } finally {
    fs.rmSync(evidence, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("private cleanup removes only approved entries and the privileged helper never deletes", () => {
  const runner = require(runnerPath);
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-runner-evidence-"));
  const project = "workflowacceptance20260808123456789abcdef123456";
  const runRoot = path.join(evidence, `${project}-private`);
  const noContainers = (args) => args[0] === "ps" ? "" : "[]";
  fs.mkdirSync(path.join(runRoot, "community-db", "mysql"), { recursive: true });
  fs.writeFileSync(path.join(runRoot, "community-db", "mysql", "ibdata1"), "fixture");
  try {
    if (process.platform !== "linux") {
      assert.equal(runner.cleanupPrivateFixtureDirectory({ evidence, project, runRoot, dockerFn: noContainers }), true);
      assert.equal(fs.existsSync(runRoot), false);
    }
    assert.doesNotMatch(runner.PRIVATE_FIXTURE_OWNERSHIP_SCRIPT, /\brm\b|unlink|rmdir/);
    const source = fs.readFileSync(runnerPath, "utf8");
    assert.match(source, /--cap-drop", "ALL"[\s\S]*--cap-add", "CHOWN"[\s\S]*--cap-add", "DAC_READ_SEARCH"/);
    assert.doesNotMatch(source, /\bsudo\b/);
  } finally {
    fs.rmSync(evidence, { recursive: true, force: true });
  }
});

test("private cleanup falls back to a strict postorder walk when recursive removal is a no-op", () => {
  const runner = require(runnerPath);
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-runner-evidence-"));
  const project = "workflowacceptance20260808123456789abcdef123456";
  const runRoot = path.join(evidence, `${project}-private`);
  const noContainers = (args) => args[0] === "ps" ? "" : "[]";
  let removeCalls = 0;
  fs.mkdirSync(path.join(runRoot, "community-db", "mysql"), { recursive: true });
  fs.writeFileSync(path.join(runRoot, "community-db", "mysql", "ibdata1"), "fixture");
  try {
    assert.equal(runner.cleanupPrivateFixtureDirectory({
      evidence,
      project,
      runRoot,
      dockerFn: noContainers,
      removeFn(target, options) {
        removeCalls += 1;
        assert.equal(target, fs.realpathSync.native(runRoot));
        assert.deepEqual(options, { recursive: true, force: true });
      }
    }), true);
    assert.equal(removeCalls, 1);
    assert.equal(fs.existsSync(runRoot), false);
  } finally {
    fs.rmSync(evidence, { recursive: true, force: true });
  }
});

test("safe report is flushed outside the private fixture directory", () => {
  const runner = require(runnerPath);
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-runner-report-"));
  const reportPath = path.join(evidence, "workflow-temporary-acceptance-report.json");
  const report = {
    schema: "aihub-workflow-temporary-acceptance-v1", candidateOnly: true, deployable: false,
    status: "partial", manifestDigest: null, identityImageId: null, identitySourceDigest: null,
    runnerSha256: "0".repeat(64), isolatedProjectScope: "workflowacceptancefixture",
    checks: {}, steps: {}, workflowReference: null, publicRedaction: null, database: null,
    cleanup: { scope: "workflowacceptancefixture", completed: false, projectResourcesRemoved: true, privateFixtureRemoved: false },
    failureStage: "cleanup", finalized: false
  };
  try {
    runner.writeSafeReport(reportPath, report);
    assert.deepEqual(JSON.parse(fs.readFileSync(reportPath, "utf8")), report);
    assert.deepEqual(fs.readdirSync(evidence), ["workflow-temporary-acceptance-report.json"]);
  } finally {
    fs.rmSync(evidence, { recursive: true, force: true });
  }
});
