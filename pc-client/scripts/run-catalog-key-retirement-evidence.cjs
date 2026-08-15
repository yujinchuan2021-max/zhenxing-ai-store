"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { createPublicEvidenceCollector } = require("./lib/catalog-public-evidence.cjs");
const {
  collectDependencyClosure,
  dependencyClosureSha256,
  writeEvidenceFiles
} = require("./run-catalog-key-rotation-evidence.cjs");

const TEST_FILES = Object.freeze([
  "tests/catalog-key-retirement.test.cjs",
  "tests/catalog-key-rotation.test.cjs",
  "tests/catalog-localized-v8-signed-candidate.test.cjs",
  "tests/release-package-policy.test.cjs"
]);

function summary(stdout) {
  const value = String(stdout || "");
  const number = (name) => Number((value.match(new RegExp(`\\b${name}\\s+(\\d+)\\r?$`, "m")) || [])[1]);
  return { testCount: number("tests"), passCount: number("pass"), failCount: number("fail") };
}

function evidence(bytes) {
  return { bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}

function main() {
  const root = fs.realpathSync(path.resolve(__dirname, ".."));
  const readPublic = createPublicEvidenceCollector({
    rootDirectory: root,
    allowedPaths: [
      "output/catalog-key-rotation-20260812-final-evidence/PASS.json",
      "output/catalog-key-rotation-20260812-final-evidence/IDENTITY-APPROVAL.json",
      "output/catalog-key-rotation-20260812-candidate/public/RETIRED.json",
      "output/catalog-key-rotation-20260812-candidate/public/KEY-DENYLIST.json",
      "output/catalog-key-rotation-20260812-candidate/public/report.json",
      "output/catalog-key-rotation-20260812-candidate/public/catalog-channel-0.1.82-transition.json",
      "output/catalog-key-rotation-20260812-candidate/public/catalog-channel-next-new-only.json"
    ]
  });
  const prior = JSON.parse(readPublic.read("output/catalog-key-rotation-20260812-final-evidence/PASS.json"));
  const approval = JSON.parse(readPublic.read("output/catalog-key-rotation-20260812-final-evidence/IDENTITY-APPROVAL.json"));
  const retiredBytes = readPublic.read("output/catalog-key-rotation-20260812-candidate/public/RETIRED.json");
  const denylistBytes = readPublic.read("output/catalog-key-rotation-20260812-candidate/public/KEY-DENYLIST.json");
  const reportBytes = readPublic.read("output/catalog-key-rotation-20260812-candidate/public/report.json");
  const transitionBytes = readPublic.read("output/catalog-key-rotation-20260812-candidate/public/catalog-channel-0.1.82-transition.json");
  const nextBytes = readPublic.read("output/catalog-key-rotation-20260812-candidate/public/catalog-channel-next-new-only.json");
  const retired = JSON.parse(retiredBytes);
  const denylist = JSON.parse(denylistBytes);
  if (approval.productionReleaseIdentitySidApproved !== true || retired.status !== "permanently-denied" || denylist.status !== "permanently-denied") throw new Error("RETIREMENT_PUBLIC_EVIDENCE_INVALID");
  const additions = [
    ...TEST_FILES,
    "scripts/run-catalog-key-retirement-evidence.cjs",
    "scripts/create-catalog-localized-v8-signed-candidate.cjs",
    "scripts/lib/catalog-public-evidence.cjs",
    "shared/catalog-key-retirement.cjs",
    "shared/catalog-icon-runtime.cjs",
    "docs/incident-feedback/2026-08-12-catalog-signing-key-permissions-and-rotation.md"
  ];
  const allowedPaths = [...new Set([...prior.dependencyClosure.map((entry) => entry.path), ...additions])];
  const closureBefore = collectDependencyClosure({ rootDirectory: root, entryFiles: additions, allowedPaths });
  const closureBeforeSha256 = dependencyClosureSha256(closureBefore);
  const argv = ["--test", "--test-reporter=spec", ...TEST_FILES];
  const startedAt = new Date();
  const result = spawnSync(process.execPath, argv, { cwd: root, encoding: "utf8", shell: false, windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
  const endedAt = new Date();
  const counts = summary(result.stdout);
  const closureAfter = collectDependencyClosure({ rootDirectory: root, entryFiles: additions, allowedPaths });
  const closureAfterSha256 = dependencyClosureSha256(closureAfter);
  const fixtureResidue = fs.readdirSync(path.join(root, "output"), { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith("catalog-key-rotation-test-")).length;
  const privateResidue = Number(fs.existsSync(path.join(root, "output/catalog-key-rotation-20260812-candidate/private")));
  const expectedTestCount = 4 + 5 + 5 + 5;
  const outcome = {
    exitCode: Number.isInteger(result.status) ? result.status : null,
    ...counts,
    passEligible: !result.error && result.status === 0 && counts.testCount === expectedTestCount && counts.passCount === expectedTestCount && counts.failCount === 0 && closureBeforeSha256 === closureAfterSha256 && fixtureResidue === 0 && privateResidue === 0,
    timedOut: Boolean(result.error?.code === "ETIMEDOUT")
  };
  const written = writeEvidenceFiles({
    evidenceDirectory: path.join(root, "output/catalog-key-retirement-20260812-evidence"),
    rootDirectory: root,
    stdout: result.stdout,
    stderr: result.stderr,
    outcome,
    manifest: {
      schemaVersion: 1,
      expectedTestCount,
      command: { executable: process.execPath, argv, cwd: root, shell: false },
      testFiles: TEST_FILES,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt - startedAt,
      dependencyClosure: closureBefore,
      dependencyClosureSha256: closureBeforeSha256,
      dependencyClosureStable: closureBeforeSha256 === closureAfterSha256,
      retiredKeyId: retired.keyId,
      retirementClass: retired.retirementClass,
      reasonClass: retired.reasonClass,
      publicEvidence: {
        tombstone: evidence(retiredBytes),
        denylist: evidence(denylistBytes),
        priorCandidateReport: evidence(reportBytes),
        obsoleteTransitionCandidate: evidence(transitionBytes),
        obsoleteNewOnlyCandidate: evidence(nextBytes)
      },
      deniedOperations: denylist.deniedOperations,
      obsoletePublicCandidateCount: denylist.obsoletePublicCandidates.length,
      productionReleaseIdentitySidApproved: true,
      identityClass: approval.identityClass,
      fixtureResidue,
      privateResidue,
      collectorReadCount: readPublic.readCount,
      protectedContentReadCount: 0,
      v8Signed: false,
      packaged: false,
      published: false,
      deployed: false,
      serverStateModified: false,
      remainingGate: "CTO_AUDIT_PASS_REQUIRED_BEFORE_NEW_KEY_GENERATION"
    }
  });
  process.stdout.write(`${JSON.stringify({ status: written.status, testCount: counts.testCount, fixtureResidue, privateResidue })}\n`);
  if (written.status !== "PASS") process.exitCode = 2;
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: "BLOCKED", code: /^[A-Z0-9_]+$/.test(error?.message || "") ? error.message : "RETIREMENT_EVIDENCE_FAILED" })}\n`);
    process.exitCode = 2;
  }
}
