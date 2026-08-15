"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { verifyPreparedRelease } = require(path.join(__dirname, "..", "deployment", "community-production", "workflow-production-release-bundle.cjs"));

function sha256(filename) {
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

function createPreparedCutoverFixtureSource({ fixtureSource, root, preparedReleaseRoot, acceptanceNode }) {
  for (const value of [root, preparedReleaseRoot, acceptanceNode]) {
    assert.equal(typeof value, "string");
    assert.equal(path.isAbsolute(value), true, "prepared fixture inputs must be absolute");
  }
  const rootLine = "const root = path.resolve(__dirname, \"..\");";
  const sourceDeploymentLine = "const sourceDeployment = path.join(root, \"deployment\", \"community-production\");";
  const prepareLine = "    prepareCutoverRelease(runRoot);";
  const acceptanceLine = "      AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: \"1\",";
  assert.equal(fixtureSource.includes(rootLine), true, "fixture root seam is missing");
  assert.equal(fixtureSource.includes(sourceDeploymentLine), true, "fixture deployment seam is missing");
  assert.equal(fixtureSource.includes(prepareLine), true, "fixture prepare seam is missing");
  assert.equal(fixtureSource.includes(acceptanceLine), true, "fixture acceptance seam is missing");

  const preparedDeployment = path.join(preparedReleaseRoot, "deployment", "community-production");
  const source = fixtureSource
    .replace(rootLine, `const root = ${JSON.stringify(root)};`)
    .replace(
      sourceDeploymentLine,
      `const preparedReleaseRoot = ${JSON.stringify(preparedReleaseRoot)};\nconst sourceDeployment = ${JSON.stringify(preparedDeployment)};\nconst workflowReleaseAcceptanceNode = ${JSON.stringify(acceptanceNode)};`
    )
    .replace(
      prepareLine,
      "    assert.equal(fs.realpathSync(path.resolve(deployment, \"..\", \"..\")), preparedReleaseRoot, \"scenario must reuse the verified prepared release\");"
    )
    .replace(
      acceptanceLine,
      `${acceptanceLine}\n      AIHUB_WORKFLOW_NODE_RUNTIME_ISOLATED_ACCEPTANCE: \"1\",\n      AIHUB_WORKFLOW_NODE_RUNTIME_ACCEPTANCE_PATH: bashPath(workflowReleaseAcceptanceNode),`
    )
    .replace('if [[ "$1" == "-f" ]]', 'if [[ "$1" == "-f" || "$1" == "-i" ]]');

  assert.equal(source.includes(sourceDeploymentLine), false, "generated fixture must not retain its workspace deployment source");
  assert.equal(source.includes("prepareCutoverRelease(runRoot);"), false, "generated fixture must not build a fallback prepared release");
  assert.equal(source.includes(JSON.stringify(preparedDeployment)), true, "generated fixture must bind the caller prepared deployment exactly");
  assert.doesNotMatch(source, /[\\/]output[\\/]community-production-/i, "generated fixture must not reference an output default deployment");
  return source;
}

function parseHarnessOutput(value, { expectedScenario, expectedManifestDigest }) {
  assert.equal(value.status, 0, value.stderr || value.stdout);
  assert.equal(["success", "failure", "retained-success", "retained-failure"].includes(expectedScenario), true, "expected cutover scenario is invalid");
  const line = value.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  const parsed = JSON.parse(line);
  assert.equal(parsed.ok, true);
  const result = parsed.result;
  const expectedOutcome = expectedScenario.endsWith("success") ? "success" : "failure";
  const expectedBaseline = expectedScenario.startsWith("retained-") ? "retained" : "empty";
  assert.equal(result.kind, expectedOutcome, "harness result kind must match the requested scenario");
  const report = JSON.parse(fs.readFileSync(result.reportPath, "utf8"));
  assert.equal(report.status, "pass");
  assert.equal(report.kind, expectedScenario);
  assert.equal(report.outcome, expectedOutcome);
  assert.equal(report.baselineKind, expectedBaseline);
  assert.equal(report.checks?.supplyChain, true, "scenario supply-chain check must pass");
  assert.equal(report.checks?.secretValueHits, 0, "scenario secret scan must be empty");
  assert.deepEqual(report.cleanup, { completed: true, containers: 0, networks: 0, volumes: 0, privateRemoved: true, backupRemoved: true });
  assert.deepEqual(report.terminal, { finalized: true, exitCode: 0 });

  const acceptanceEvidence = path.join(result.runRoot, "cutover-evidence");
  assert.equal(fs.statSync(acceptanceEvidence).isDirectory(), true, "scenario cutover evidence directory is missing");
  const acceptanceReports = fs.readdirSync(acceptanceEvidence, { recursive: true })
    .map((entry) => path.join(acceptanceEvidence, entry))
    .filter((entry) => path.basename(entry) === "workflow-temporary-acceptance-report.json");

  let acceptanceReport = null;
  if (expectedOutcome === "success") {
    assert.equal(acceptanceReports.length, 1, "successful scenario must produce exactly one finalized inner acceptance report");
    acceptanceReport = JSON.parse(fs.readFileSync(acceptanceReports[0], "utf8"));
    assert.equal(acceptanceReport.status, "pass", "inner acceptance report must pass");
    assert.equal(acceptanceReport.manifestDigest, expectedManifestDigest, "inner acceptance report must bind the caller prepared release manifest");
    assert.equal(acceptanceReport.finalized, true, "inner acceptance report must be finalized");
    assert.equal(acceptanceReport.cleanup?.completed, true, "inner acceptance report cleanup must complete");
  } else {
    assert.equal(acceptanceReports.length, 0, "pre-runner failure scenario must not produce an inner acceptance report");
    const expectedExisting = expectedBaseline === "retained"
      ? { baseline: "disabled-retained-official-bootstrap", events: 9, idempotency: 9, eventHead: 9, sourcePostsExact: 3, publisherExact: 1 }
      : { baseline: "rolled-back-disabled-empty", events: 0, idempotency: 0, eventHead: 0, sourcePostsExact: 0, publisherExact: 0 };
    const expectedRollback = expectedBaseline === "retained"
      ? { schema: "applied", appendOnly: true, events: 9, idempotency: 9, eventHead: 9, reviewerExact: 1, reviewerForbiddenRelations: 0, publisherExact: 1, publisherForbiddenRelations: 0, sourcePostsExact: 3, productionFlagsEnabled: false }
      : { schema: "applied", appendOnly: true, events: 0, idempotency: 0, eventHead: 0, reviewerExact: 1, reviewerForbiddenRelations: 0, workflowFlags: "disabled" };
    assert.deepEqual(report.checks?.cutoverExistingState, expectedExisting, "failure scenario existing-state evidence drifted");
    assert.deepEqual(report.checks?.failureRollbackPreservedExistingBaseline, expectedRollback, "failure scenario rollback evidence drifted");
    assert.equal(report.checks?.catalogExactActive6Rollback, true, "failure scenario catalog rollback must pass");
    assert.deepEqual(report.checks?.failureRollbackRestoredOldImages, { adminPrior: true, identityPrior: true }, "failure scenario old-image rollback must pass");
    assert.equal(report.checks?.caddyIdentityAndSecretBoundary, true, "failure scenario Caddy and secret boundary must pass");
  }

  return {
    kind: report.kind,
    reportPath: result.reportPath,
    reportSha256: sha256(result.reportPath),
    acceptanceReportSha256: acceptanceReport ? sha256(acceptanceReports[0]) : null,
    manifestDigest: acceptanceReport?.manifestDigest || null,
    preparedManifestDigest: expectedManifestDigest,
    nestedAcceptanceCount: acceptanceReports.length,
    checks: report.checks,
    cleanup: report.cleanup,
    terminal: report.terminal
  };
}

module.exports = { createPreparedCutoverFixtureSource, parseHarnessOutput };

if (require.main === module) {
const root = path.resolve(__dirname, "..");
const prepared = path.resolve(process.argv[2] || "");
const requestedScenario = process.argv[3] || "both";
const fixture = path.join(root, "output", "workflow-reviewer-service-independent-cutover-harness.cjs");
assert.equal(path.isAbsolute(prepared), true, "prepared release path is required");
assert.equal(fs.statSync(prepared).isDirectory(), true);
assert.equal(["both", "success", "failure", "retained-success", "retained-failure"].includes(requestedScenario), true, "cutover scenario is invalid");
assert.equal(fs.existsSync(fixture), true, "reviewer cutover fixture is unavailable");

const deployment = path.join(prepared, "deployment", "community-production");
const acceptanceNode = path.join(root, "output", "workflow-node-runtime-windows-v24.18.1", "extracted", "node-v24.18.1-win-x64", "node.exe");
assert.equal(fs.statSync(acceptanceNode).size, 92_540_232, "frozen Windows acceptance Node is unavailable");
const previousAcceptance = process.env.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE;
let preparedVerification;
try {
  process.env.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE = "1";
  preparedVerification = verifyPreparedRelease(prepared);
} finally {
  if (previousAcceptance === undefined) delete process.env.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE;
  else process.env.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE = previousAcceptance;
}
const preparedReleaseRoot = fs.realpathSync(prepared);
const rollbackIdentityArchive = path.join(preparedReleaseRoot, "artifacts", "identity-19a-rollback-image.tar");
const oldAdminArchive = path.join(preparedReleaseRoot, "artifacts", "admin-old-b6ea4c5bd0e9.tar");
const flarumArchive = path.join(preparedReleaseRoot, "artifacts", "flarum-8b13962a36bf.tar");
const imageArchiveVerifier = path.join(deployment, "workflow-image-archive.cjs");
const suffix = crypto.randomBytes(5).toString("hex");
const generated = path.join(root, "output", `.workflow-release-cutover-fixture-${suffix}.cjs`);
const output = path.join(root, "output", `workflow-production-release-bundle-cutover-${suffix}`);
const reportPath = path.join(output, "report.json");

function run(command, args, options = {}) {
  const value = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options
  });
  if (value.error) throw value.error;
  return value;
}

function loadPreparedImage({ command, archive, image: expected }) {
  const verified = run(process.execPath, [imageArchiveVerifier, command, archive]);
  assert.equal(verified.status, 0, verified.stderr || verified.stdout);
  const loaded = run("docker", ["load", "-i", archive]);
  assert.equal(loaded.status, 0, loaded.stderr || loaded.stdout);
  const inspected = run("docker", ["image", "inspect", expected.ref]);
  assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
  const [image] = JSON.parse(inspected.stdout);
  assert.equal(image.Id, expected.id);
  assert.deepEqual(image.RepoTags, [expected.ref]);
  assert.equal(image.Config.User || "", expected.user);
  assert.equal(image.Config.Labels["com.aihub.source-content-sha256"], expected.source);
  assert.equal(image.Config.Labels["com.aihub.release-version"], expected.release);
}

loadPreparedImage({
  command: "verify-rollback",
  archive: rollbackIdentityArchive,
  image: {
    ref: "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392",
    id: "sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567",
    source: "19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c",
    release: "workflow-reviewer-service-identity-candidate-2026-08-08",
    user: "node"
  }
});
loadPreparedImage({
  command: "verify-old-admin",
  archive: oldAdminArchive,
  image: {
    ref: "zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9",
    id: "sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2",
    source: "b6ea4c5bd0e9517579a3c4380fcf2c1617975f1ff6a2c6024a703a71ed4620de",
    release: "0.1.40",
    user: "node"
  }
});
loadPreparedImage({
  command: "verify-flarum",
  archive: flarumArchive,
  image: {
    ref: "zhenxing-ai/flarum:community-candidate-8b13962a36bf",
    id: "sha256:6c32c21c9961e0dd35757c46be35ec2c8725f5b3537d4d0e7634c3a1cd11ba12",
    source: "8b13962a36bf031652bd5863163948ed245314f0025852a9529fdbacbbcab3f6",
    release: "0.1.40",
    user: ""
  }
});

const localImageContracts = Object.freeze([
  { name: "admin-old", ref: "zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9", id: "sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2", source: "b6ea4c5bd0e9517579a3c4380fcf2c1617975f1ff6a2c6024a703a71ed4620de", user: "node" },
  { name: "identity-old", ref: "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392", id: "sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567", source: "19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c", user: "node" },
  { name: "community-flarum", ref: "zhenxing-ai/flarum:community-candidate-8b13962a36bf", id: "sha256:6c32c21c9961e0dd35757c46be35ec2c8725f5b3537d4d0e7634c3a1cd11ba12", source: "8b13962a36bf031652bd5863163948ed245314f0025852a9529fdbacbbcab3f6", user: "" },
  { name: "postgres", ref: "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193", id: "sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193", source: null, user: "" },
  { name: "mariadb", ref: "mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4", id: "sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4", source: null, user: "" },
  { name: "caddy", ref: "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d", id: "sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d", source: null, user: "" }
]);

function assertLocalImageClosure() {
  const failures = [];
  for (const expected of localImageContracts) {
    const inspected = run("docker", ["image", "inspect", expected.ref]);
    if (inspected.status !== 0) {
      failures.push(`${expected.name}:missing`);
      continue;
    }
    let image;
    try {
      [image] = JSON.parse(inspected.stdout);
    } catch {
      failures.push(`${expected.name}:invalid`);
      continue;
    }
    if (image?.Id !== expected.id) failures.push(`${expected.name}:id`);
    if ((image?.Config?.User || "") !== expected.user) failures.push(`${expected.name}:user`);
    if (expected.source !== null && image?.Config?.Labels?.["com.aihub.source-content-sha256"] !== expected.source) {
      failures.push(`${expected.name}:source`);
    }
  }
  assert.equal(failures.length, 0, `missing local image closure: ${failures.join(",")}`);
  return { complete: true, count: localImageContracts.length, names: localImageContracts.map(({ name }) => name) };
}

const localImageClosure = assertLocalImageClosure();

const source = createPreparedCutoverFixtureSource({
  fixtureSource: fs.readFileSync(fixture, "utf8"),
  root,
  preparedReleaseRoot,
  acceptanceNode
});
fs.writeFileSync(generated, source, { encoding: "utf8", mode: 0o600 });
fs.mkdirSync(output, { recursive: false });

const report = {
  schema: "aihub-workflow-production-release-bundle-cutover-v1",
  candidateOnly: true,
  deployable: false,
  preparedRelease: {
    bundleMarkerSha256: sha256(path.join(prepared, ".aihub-workflow-release-prepared.json")),
    deploymentSetDigest: JSON.parse(fs.readFileSync(path.join(prepared, ".aihub-workflow-release-prepared.json"), "utf8")).deploymentSetDigest,
    verified: preparedVerification.deploymentSetDigest === JSON.parse(fs.readFileSync(path.join(prepared, ".aihub-workflow-release-prepared.json"), "utf8")).deploymentSetDigest,
    localImageClosure
  },
  success: null,
  failure: null,
  retainedSuccess: null,
  retainedFailure: null,
  cleanup: { completed: false }
};

try {
  const parseOptions = (expectedScenario) => ({ expectedScenario, expectedManifestDigest: preparedVerification.deploymentSetDigest });
  if (["both", "success"].includes(requestedScenario)) report.success = parseHarnessOutput(run(process.execPath, [generated, "success"], { timeout: 1_200_000 }), parseOptions("success"));
  if (["both", "failure"].includes(requestedScenario)) report.failure = parseHarnessOutput(run(process.execPath, [generated, "failure"], { timeout: 1_200_000 }), parseOptions("failure"));
  if (["both", "retained-success"].includes(requestedScenario)) report.retainedSuccess = parseHarnessOutput(run(process.execPath, [generated, "retained-success"], { timeout: 1_200_000 }), parseOptions("retained-success"));
  if (["both", "retained-failure"].includes(requestedScenario)) report.retainedFailure = parseHarnessOutput(run(process.execPath, [generated, "retained-failure"], { timeout: 1_200_000 }), parseOptions("retained-failure"));
  report.cleanup.completed = [report.success, report.failure, report.retainedSuccess, report.retainedFailure]
    .every((entry) => entry?.cleanup.completed ?? true);
  report.status = "pass";
} catch (error) {
  report.status = "blocked";
  report.error = { name: error?.name || "Error", message: String(error?.message || error).slice(-4000) };
  process.exitCode = 1;
} finally {
  fs.rmSync(generated, { force: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

assert.equal(report.status, "pass", report.error?.message || "cutover bundle gate blocked");
process.stdout.write(`${JSON.stringify({ ok: true, reportPath, reportSha256: sha256(reportPath), report })}\n`);
}
