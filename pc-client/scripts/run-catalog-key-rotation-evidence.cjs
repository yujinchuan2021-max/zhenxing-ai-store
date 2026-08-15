"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createPublicEvidenceCollector } = require("./lib/catalog-public-evidence.cjs");
const { validateCatalogKeyRetirementEvidence } = require("../shared/catalog-key-retirement.cjs");

const TEST_FILES = Object.freeze([
  "tests/catalog-key-rotation.test.cjs",
  "tests/admin-signing-key.test.cjs",
  "tests/admin-release-store.test.cjs",
  "tests/catalog-release.test.cjs",
  "tests/catalog-client-channel.test.cjs",
  "tests/release-channel.test.cjs",
  "tests/release-package-policy.test.cjs",
  "tests/server-connected-review-package.test.cjs"
]);
const STATIC_RUNTIME_FILES = Object.freeze([
  ".gitignore",
  "package.json",
  "catalog/channel.server-connected-review.json",
  "catalog/channel.local-v2.json",
  "admin/data/catalog-v1.json",
  "admin/published/catalog-store/state.json",
  "electron-builder.local-release.cjs",
  "electron-builder.server-connected-review.cjs",
  "scripts/create-catalog-key-rotation-candidate.cjs",
  "scripts/run-catalog-key-rotation-evidence.cjs"
]);
const CANDIDATE_PUBLIC_FILES = Object.freeze([
  "output/catalog-key-rotation-20260812-candidate/public/report.json",
  "output/catalog-key-rotation-20260812-candidate/public/catalog-channel-0.1.82-transition.json",
  "output/catalog-key-rotation-20260812-candidate/public/catalog-channel-next-new-only.json"
]);
const RETIREMENT_PUBLIC_FILES = Object.freeze([
  "output/catalog-key-rotation-20260812-candidate/public/RETIRED.json",
  "output/catalog-key-rotation-20260812-candidate/public/KEY-DENYLIST.json"
]);
const RETIREMENT_SEAM_FILES = Object.freeze([
  "shared/catalog-key-retirement.cjs",
  "shared/catalog-client-channel.cjs",
  "shared/signed-release.cjs",
  "shared/release-package-policy.cjs",
  "admin/signing-key.cjs",
  "admin/release-store.cjs",
  "admin/release-bundle.cjs",
  "admin/release-bundle-verifier.cjs",
  "admin/server.cjs"
]);
const ANSI_SEQUENCE = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g;
const LOCAL_REQUIRE = /require\(["'](\.{1,2}\/[^"']+)["']\)/g;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function exactFile(rootDirectory, relativePath) {
  const root = fs.realpathSync(path.resolve(rootDirectory));
  const candidate = path.resolve(root, relativePath);
  if (!candidate.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) {
    throw new Error("EVIDENCE_DEPENDENCY_BOUNDARY_INVALID");
  }
  const stat = fs.lstatSync(candidate);
  if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(candidate).toLowerCase() !== candidate.toLowerCase()) {
    throw new Error("EVIDENCE_DEPENDENCY_FILE_INVALID");
  }
  return candidate;
}

function resolveLocalRequire(rootDirectory, fromFile, request) {
  const unresolved = path.resolve(path.dirname(fromFile), request);
  const candidates = [
    unresolved,
    `${unresolved}.cjs`,
    `${unresolved}.js`,
    `${unresolved}.json`,
    path.join(unresolved, "index.cjs"),
    path.join(unresolved, "index.js")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isFile()) {
      return exactFile(rootDirectory, path.relative(rootDirectory, candidate));
    }
  }
  throw new Error("EVIDENCE_DEPENDENCY_UNRESOLVED");
}

function collectDependencyClosure({ rootDirectory, entryFiles, allowedPaths = entryFiles, readFile }) {
  const root = fs.realpathSync(path.resolve(rootDirectory));
  const allowed = new Set(allowedPaths.map((file) => String(file).replaceAll("\\", "/")));
  const collector = createPublicEvidenceCollector({ rootDirectory: root, allowedPaths: [...allowed], readFile });
  const queue = entryFiles.map((file) => exactFile(root, file));
  const visited = new Set();
  const closure = [];
  while (queue.length) {
    const file = queue.shift();
    const relative = path.relative(root, file).replaceAll("\\", "/");
    if (visited.has(relative)) continue;
    visited.add(relative);
    const bytes = collector.read(relative);
    closure.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
    if (![".cjs", ".js"].includes(path.extname(file))) continue;
    const source = bytes.toString("utf8");
    for (const match of source.matchAll(LOCAL_REQUIRE)) {
      const unresolved = path.resolve(path.dirname(file), match[1]);
      const candidates = [unresolved, `${unresolved}.cjs`, `${unresolved}.js`, `${unresolved}.json`, path.join(unresolved, "index.cjs"), path.join(unresolved, "index.js")];
      const allowedCandidate = candidates.find((candidate) => allowed.has(path.relative(root, candidate).replaceAll("\\", "/")));
      if (!allowedCandidate) throw new Error("EVIDENCE_ALLOWLIST_REJECTED");
      queue.push(resolveLocalRequire(root, file, match[1]));
    }
  }
  return closure.sort((left, right) => left.path.localeCompare(right.path));
}

function dependencyClosureSha256(closure) {
  return sha256(Buffer.from(JSON.stringify(closure), "utf8"));
}

function redactEvidenceStream(value, { rootDirectory }) {
  let output = String(value || "").replace(ANSI_SEQUENCE, "");
  if (output.includes("\x1b")) throw new Error("EVIDENCE_ANSI_UNSAFE");
  output = output
    .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gi, "<REDACTED_SECRET>")
    .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----|-----END [^-\r\n]*PRIVATE KEY-----/gi, "<REDACTED_SECRET>")
    .replace(/catalog-signing-private\.pem/gi, "<REDACTED_PATH>")
    .replaceAll(path.resolve(rootDirectory), "<WORKSPACE>")
    .replaceAll(path.resolve(rootDirectory).replaceAll("\\", "/"), "<WORKSPACE>")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "<REDACTED_URL>")
    .replace(/\b[A-Za-z]:[\\/][^\r\n\t"'<>|]*/g, "<REDACTED_PATH>")
    .replace(/\\\\[^\r\n\t"'<>|]+/g, "<REDACTED_PATH>")
    .replace(/\b(authorization|bearer|token|password|secret|cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=<REDACTED_SECRET>");
  output = output.split(/\r?\n/).map((line) => (
    /^\s+at\s+/i.test(line) || /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|Error):/i.test(line)
      ? "<REDACTED_ERROR>"
      : line
  )).join("\n");
  assertSafeRedactedStream(output);
  return output;
}

function assertSafeRedactedStream(value) {
  const text = String(value);
  if (
    text.includes("\x1b") ||
    /-----BEGIN [^-\r\n]*PRIVATE KEY-----|-----END [^-\r\n]*PRIVATE KEY-----/i.test(text) ||
    /catalog-signing-private\.pem/i.test(text) ||
    /https?:\/\//i.test(text) ||
    /\b[A-Za-z]:[\\/]/.test(text) ||
    /\\\\[^\s]+/.test(text) ||
    /\b(authorization|bearer|token|password|secret|cookie|api[_-]?key)\s*[:=]\s*(?!<REDACTED_SECRET>)/i.test(text) ||
    /^\s+at\s+/m.test(text) ||
    /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|Error):/i.test(text)
  ) {
    throw new Error("EVIDENCE_REDACTION_UNSAFE");
  }
  return true;
}

function writeJsonExclusive(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}

function writeEvidenceFiles({ evidenceDirectory, rootDirectory, stdout, stderr, outcome, manifest }) {
  const directory = path.resolve(evidenceDirectory);
  if (fs.existsSync(directory)) throw new Error("EVIDENCE_DIRECTORY_EXISTS");
  fs.mkdirSync(directory, { recursive: false });
  const redactedStdout = redactEvidenceStream(stdout, { rootDirectory });
  const redactedStderr = redactEvidenceStream(stderr, { rootDirectory });
  const stdoutFile = path.join(directory, "stdout.redacted.txt");
  const stderrFile = path.join(directory, "stderr.redacted.txt");
  fs.writeFileSync(stdoutFile, redactedStdout, { flag: "wx", mode: 0o600 });
  fs.writeFileSync(stderrFile, redactedStderr, { flag: "wx", mode: 0o600 });
  const streamEvidence = {
    stdoutRedactedSha256: sha256(Buffer.from(redactedStdout, "utf8")),
    stdoutFileSha256: sha256(fs.readFileSync(stdoutFile)),
    stderrRedactedSha256: sha256(Buffer.from(redactedStderr, "utf8")),
    stderrFileSha256: sha256(fs.readFileSync(stderrFile)),
    rawStreamsPersisted: false
  };
  const expectedTestCount = manifest.expectedTestCount ?? 45;
  const pass = outcome.passEligible === true && outcome.exitCode === 0 && outcome.testCount === expectedTestCount && outcome.passCount === expectedTestCount && outcome.failCount === 0;
  const record = {
    ...manifest,
    status: pass ? "PASS" : "BLOCKED",
    testEvidence: { ...(manifest.testEvidence || {}), ...outcome, ...streamEvidence }
  };
  const file = path.join(directory, pass ? "PASS.json" : "BLOCKED.json");
  writeJsonExclusive(file, record);
  return { status: record.status, manifestFile: file, streamEvidence };
}

function parseTestSummary(stdout) {
  const tests = Number((stdout.match(/\btests\s+(\d+)\r?$/m) || [])[1]);
  const passed = Number((stdout.match(/\bpass\s+(\d+)\r?$/m) || [])[1]);
  const failed = Number((stdout.match(/\bfail\s+(\d+)\r?$/m) || [])[1]);
  return { testCount: tests, passCount: passed, failCount: failed };
}

function fileEvidence(rootDirectory, relativePath) {
  const bytes = createPublicEvidenceCollector({ rootDirectory, allowedPaths: [relativePath] }).read(relativePath);
  return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
}

function main() {
  const root = fs.realpathSync(path.resolve(__dirname, ".."));
  const evidenceDirectory = path.join(root, "output", "catalog-key-rotation-20260812-final-evidence");
  let protectedContentReadCount = 0;
  const retirementCollector = createPublicEvidenceCollector({
    rootDirectory: root,
    allowedPaths: RETIREMENT_PUBLIC_FILES,
    readFile(file) {
      if (/(?:^|[\\/])(?:private|secret|secrets|protected)(?:[\\/]|$)|\.(?:pem|key|p12|pfx|jwk|env)$/i.test(file)) {
        protectedContentReadCount += 1;
      }
      return fs.readFileSync(file);
    }
  });
  const retirementEvidence = validateCatalogKeyRetirementEvidence({
    retiredBytes: retirementCollector.read(RETIREMENT_PUBLIC_FILES[0]),
    denylistBytes: retirementCollector.read(RETIREMENT_PUBLIC_FILES[1]),
    protectedContentReadCount
  });
  const state = JSON.parse(createPublicEvidenceCollector({ rootDirectory: root, allowedPaths: ["admin/published/catalog-store/state.json"] }).read("admin/published/catalog-store/state.json").toString("utf8"));
  const v2 = state.channels.v2;
  const active = v2.history.find((entry) => entry.releaseId === v2.activeReleaseId);
  if (!active || active.catalogVersion !== 7 || path.basename(active.fileName || "") !== active.fileName) {
    throw new Error("EVIDENCE_ACTIVE7_INVALID");
  }
  const activeRelative = `admin/published/catalog-store/releases/${active.fileName}`;
  const closureEntries = [...TEST_FILES, ...STATIC_RUNTIME_FILES, activeRelative];
  const priorManifest = JSON.parse(createPublicEvidenceCollector({ rootDirectory: root, allowedPaths: ["output/catalog-key-rotation-20260812-final-evidence/PASS.json"] }).read("output/catalog-key-rotation-20260812-final-evidence/PASS.json").toString("utf8"));
  const closureAllowlist = [...new Set([...priorManifest.dependencyClosure.map((entry) => entry.path), ...closureEntries, "scripts/lib/catalog-public-evidence.cjs", "shared/catalog-key-retirement.cjs", "tests/catalog-key-retirement.test.cjs"])];
  const closureBefore = collectDependencyClosure({ rootDirectory: root, entryFiles: closureEntries, allowedPaths: closureAllowlist });
  const closureBeforeSha256 = dependencyClosureSha256(closureBefore);
  const argv = ["--test", "--test-reporter=spec", ...TEST_FILES];
  const startedAt = new Date();
  const result = spawnSync(process.execPath, argv, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024
  });
  const endedAt = new Date();
  const summary = parseTestSummary(String(result.stdout || ""));
  const closureAfter = collectDependencyClosure({ rootDirectory: root, entryFiles: closureEntries, allowedPaths: closureAllowlist });
  const closureAfterSha256 = dependencyClosureSha256(closureAfter);
  const fixtureResidue = fs.readdirSync(path.join(root, "output"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("catalog-key-rotation-test-"))
    .length;
  const outcome = {
    exitCode: Number.isInteger(result.status) ? result.status : null,
    ...summary,
    passEligible: !result.error && result.status === 0 && summary.testCount === 45 && summary.passCount === 45 && summary.failCount === 0 && closureBeforeSha256 === closureAfterSha256 && fixtureResidue === 0,
    timedOut: Boolean(result.error?.code === "ETIMEDOUT")
  };
  const manifest = {
    schemaVersion: 1,
    command: { executable: process.execPath, argv, cwd: root, shell: false },
    testFiles: TEST_FILES,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt - startedAt,
    dependencyClosure: closureBefore,
    dependencyClosureSha256: closureBeforeSha256,
    dependencyClosureStable: closureBeforeSha256 === closureAfterSha256,
    candidatePublicFiles: CANDIDATE_PUBLIC_FILES.map((file) => fileEvidence(root, file)),
    retirementEvidence: {
      retiredSha256: retirementEvidence.retiredSha256,
      denylistSha256: retirementEvidence.denylistSha256,
      collectorReadCount: retirementCollector.readCount,
      protectedContentReadCount,
      seamClosure: RETIREMENT_SEAM_FILES.map((file) => fileEvidence(root, file))
    },
    productionState: {
      historyCount: v2.history.length,
      activeCatalogVersion: active.catalogVersion,
      trustedKeyCount: state.trustedKeys.length,
      state: fileEvidence(root, "admin/published/catalog-store/state.json"),
      active7: fileEvidence(root, activeRelative)
    },
    fixtureResidue,
    unrecoverableRedFixture: {
      canonicalPathAvailable: false,
      classification: "P2_EVIDENCE_GAP"
    },
    productionReleaseIdentitySidApproved: false,
    v8Signed: false,
    packaged: false,
    published: false,
    deployed: false,
    serverStateModified: false
  };
  const written = writeEvidenceFiles({
    evidenceDirectory,
    rootDirectory: root,
    stdout: result.stdout,
    stderr: result.stderr,
    outcome,
    manifest
  });
  process.stdout.write(`${JSON.stringify({ status: written.status, testCount: summary.testCount, fixtureResidue })}\n`);
  if (written.status !== "PASS") process.exitCode = 2;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: "BLOCKED", code: /^[A-Z0-9_]+$/.test(error?.message || "") ? error.message : "EVIDENCE_RUNNER_FAILED" })}\n`);
    process.exitCode = 2;
  }
}

module.exports = {
  assertSafeRedactedStream,
  collectDependencyClosure,
  dependencyClosureSha256,
  redactEvidenceStream,
  writeEvidenceFiles
};
