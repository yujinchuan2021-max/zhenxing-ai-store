"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const relative = {
  snapshot: "docs/research/cocoloop-skill-metadata-phase2-stop-4069-2026-08-14.json",
  phase1Snapshot: "docs/research/cocoloop-skill-discovery-index-phase1-2026-08-14.json",
  phase1Index: "output/research/cocoloop-skill-intake/candidate-index.ndjson",
  checkpoint: "output/research/cocoloop-skill-intake/phase2-first1000/checkpoint.json",
  metadata: "output/research/cocoloop-skill-intake/phase2-first1000/metadata.ndjson",
  failures: "output/research/cocoloop-skill-intake/phase2-first1000/failures.ndjson",
  stopped: "output/research/cocoloop-skill-intake/phase2-first1000/stopped.json",
  summary: "output/research/cocoloop-skill-intake/phase2-first1000/summary.json",
  parser: "shared/cocoloop-skill-metadata-parser.cjs",
  resumeStdout: "output/research/cocoloop-skill-intake/phase2-first1000/resume-4013.stdout.log",
  resumeStderr: "output/research/cocoloop-skill-intake/phase2-first1000/resume-4013.stderr.log"
};
const expectedArtifacts = {
  phase1Snapshot: { path: relative.phase1Snapshot, bytes: 2701, lines: 72, sha256: "2b7aad5471d53b6eec84d548a070a19fd2a073bf07e7199ac6de84e4523097bd" },
  phase1Index: { path: relative.phase1Index, bytes: 12242811, lines: 72051, sha256: "19ca436a08f0747ff07b90baf95efa5a7bdad300c836086098e0bee19c91c171" },
  checkpoint: { path: relative.checkpoint, bytes: 1296, lines: 41, sha256: "f79c7a3a4e814a4faba7bd84de10e4838d8bc44a84c1e3e744b824241f06d364" },
  metadata: { path: relative.metadata, bytes: 2430752, lines: 4018, sha256: "008d84da043a44c4da42d406d508838d9a85aca7f2015a1fb3b3c418e200c28e" },
  failures: { path: relative.failures, bytes: 7136, lines: 51, sha256: "ee12017131ebbb05754e6d4aea96ec0bd9d9ebbd765147f37ce4ee56f361b7cc" },
  stopped: { path: relative.stopped, bytes: 84, lines: 5, sha256: "e9eb99d0eb7dcd0a4af95d1ea17d8a94f471999098d756d47e17a133b90b643d" },
  summary: { path: relative.summary, bytes: 1207, lines: 37, sha256: "06960defc1f7927b7df521dff7e682baf6550945cc6a2715abaf0d004a572584", role: "completed-first1000-baseline-only" },
  parser: { path: relative.parser, bytes: 4305, lines: 58, sha256: "0182e734cfe891f340e7c630b99f5c321dcdd916b1cca83bf5fd515b143919b8" },
  resumeStdout: { path: relative.resumeStdout, bytes: 0, lines: 0, sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
  resumeStderr: { path: relative.resumeStderr, bytes: 1045, lines: 11, sha256: "b1534359af4f84287e6f44d0770539160657cf9dbe1fd010ef08cabe605277ac" }
};

const absolute = (key) => path.join(root, relative[key]);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const lines = (bytes) => bytes.length ? bytes.toString("utf8").split(/\r?\n/).filter(Boolean) : [];
const readJson = (key) => JSON.parse(fs.readFileSync(absolute(key), "utf8"));
const readNdjson = (key) => lines(fs.readFileSync(absolute(key))).map(JSON.parse);
const manifestHash = (rows) => sha256(JSON.stringify(rows.map(({ externalId, pageUrl }) => [String(externalId), String(pageUrl)])));

function filesystemState() {
  const start = path.join(root, "output/research/cocoloop-skill-intake");
  const items = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      items.push({ entry, full });
      if (entry.isDirectory()) visit(full);
    }
  };
  visit(start);
  const canonical = (value) => fs.realpathSync.native(value).toLowerCase();
  return {
    entries: items.length,
    files: items.filter(({ entry }) => entry.isFile()).length,
    directories: items.filter(({ entry }) => entry.isDirectory()).length,
    reparsePoints: items.filter(({ entry, full }) => entry.isSymbolicLink() || canonical(full) !== path.resolve(full).toLowerCase()).length,
    ownerLocks: items.filter(({ entry }) => entry.name.toLowerCase() === "owner.lock").length,
    temporaryOrPartialTails: items.filter(({ entry }) => /(?:\.tmp|\.temp|\.partial|\.part|\.tail)$/i.test(entry.name)).length
  };
}

function relatedIntakeProcesses() {
  assert.equal(process.platform, "win32");
  const command = [
    "$needle=[string]::Concat('coco','loop-skill-intake.mjs')",
    "$count=@(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -like \"*$needle*\" }).Count",
    "$count"
  ].join("; ");
  return Number(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8" }).trim());
}

test("CocoLoop Phase2 stop 4069 snapshot binds the exact local stopped state", () => {
  const snapshotPath = absolute("snapshot");
  assert.equal(fs.existsSync(snapshotPath), true, "Phase2 stop snapshot must exist");
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

  assert.equal(snapshot.candidateOnly, true);
  assert.equal(snapshot.discoveryOnly, true);
  assert.equal(snapshot.publishable, false);
  assert.equal(snapshot.resumeAuthorized, false);
  assert.equal(snapshot.status, "stopped");
  assert.match(snapshot.observedAt, /^2026-08-14T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.deepEqual(snapshot.artifacts, expectedArtifacts);
  for (const artifact of Object.values(expectedArtifacts)) {
    const bytes = fs.readFileSync(path.join(root, artifact.path));
    assert.equal(bytes.length, artifact.bytes, `${artifact.path} byte drift`);
    assert.equal(lines(bytes).length, artifact.lines, `${artifact.path} line drift`);
    assert.equal(sha256(bytes), artifact.sha256, `${artifact.path} SHA drift`);
  }

  const checkpoint = readJson("checkpoint");
  const stopped = readJson("stopped");
  const summary = readJson("summary");
  const phase1 = readNdjson("phase1Index");
  const metadata = readNdjson("metadata");
  const failures = readNdjson("failures");
  const metadataById = new Map(metadata.map((row) => [String(row.externalId), row]));
  const failuresById = new Map(failures.map((row) => [String(row.externalId), row]));

  assert.equal(new Set(phase1.map((row) => String(row.externalId))).size, phase1.length);
  assert.equal(metadataById.size, metadata.length);
  assert.equal(failuresById.size, failures.length);
  assert.equal([...metadataById.keys()].some((id) => failuresById.has(id)), false);
  const outcomes = new Map([
    ...metadata.map((row) => [String(row.externalId), { statusClass: "metadata-observed-unreviewed", row }]),
    ...failures.map((row) => [String(row.externalId), { statusClass: row.statusClass, row }])
  ]);
  const ordered = phase1.slice(0, checkpoint.nextIndex).map((input, index) => {
    const outcome = outcomes.get(String(input.externalId));
    assert.ok(outcome, `missing Phase2 outcome at index ${index}`);
    assert.equal(outcome.row.pageUrl, input.pageUrl, `Phase2 URL mismatch at index ${index}`);
    return { index, externalId: String(input.externalId), statusClass: outcome.statusClass };
  });
  const prefixIds = new Set(phase1.slice(0, checkpoint.nextIndex).map((row) => String(row.externalId)));
  assert.equal([...outcomes.keys()].some((id) => !prefixIds.has(id)), false);
  assert.equal(outcomes.size, checkpoint.nextIndex);

  assert.deepEqual(snapshot.progress, {
    targetCount: 5000,
    nextIndex: 4069,
    remaining: 931,
    metadata: 4018,
    failures: 51,
    outcomes: 4069,
    http2xx: 4042,
    parsed: 4018,
    parseFailure: 24,
    fetchFailure: 27,
    exactPhase1Prefix: {
      length: 4069,
      orderedIdentitySha256: manifestHash(phase1.slice(0, checkpoint.nextIndex)),
      missing: 0,
      extra: 0,
      idConflicts: 0,
      pageUrlMismatches: 0
    }
  });
  assert.equal(snapshot.progress.metadata + snapshot.progress.failures, snapshot.progress.nextIndex);
  assert.equal(snapshot.progress.parsed + snapshot.progress.parseFailure, snapshot.progress.http2xx);
  assert.deepEqual(checkpoint.records, { bytes: expectedArtifacts.metadata.bytes, sha256: expectedArtifacts.metadata.sha256, lines: expectedArtifacts.metadata.lines });
  assert.deepEqual(checkpoint.failures, { bytes: expectedArtifacts.failures.bytes, sha256: expectedArtifacts.failures.sha256, lines: expectedArtifacts.failures.lines });
  assert.deepEqual(snapshot.bindings, {
    phase1IndexSha256: checkpoint.phase1IndexSha256,
    first1000InputManifestSha256: checkpoint.first1000InputManifestSha256,
    target5000InputManifestSha256: checkpoint.inputManifestSha256,
    parserArtifactSha256: checkpoint.parserArtifactSha256,
    summarySha256: checkpoint.summarySha256
  });
  assert.equal(checkpoint.phase1IndexSha256, expectedArtifacts.phase1Index.sha256);
  assert.equal(checkpoint.first1000InputManifestSha256, manifestHash(phase1.slice(0, 1000)));
  assert.equal(checkpoint.inputManifestSha256, manifestHash(phase1.slice(0, 5000)));
  assert.equal(checkpoint.parserArtifactSha256, expectedArtifacts.parser.sha256);
  assert.equal(checkpoint.summarySha256, expectedArtifacts.summary.sha256);
  assert.equal(summary.targetCount, 1000);
  assert.equal(summary.records.lines + summary.failures.lines, 1000);

  const trailing = ordered.slice(-10);
  assert.deepEqual(snapshot.batch, {
    startIndex: 1000,
    completed: 3069,
    fetchFailure: 22,
    parseFailure: 23,
    otherFailure: 0,
    consecutiveFailures: 10,
    trailingFailureStreak: {
      length: 10,
      statusClass: "fetch-failure",
      firstInputIndex: 4059,
      lastInputIndex: 4068,
      externalIds: trailing.map((row) => row.externalId)
    }
  });
  assert.equal(trailing.every((row) => row.statusClass === "fetch-failure"), true);
  assert.equal(ordered.at(-11).statusClass, "metadata-observed-unreviewed");
  assert.deepEqual(checkpoint.batchCounts, {
    completed: snapshot.batch.completed,
    fetchFailure: snapshot.batch.fetchFailure,
    parseFailure: snapshot.batch.parseFailure,
    otherFailure: snapshot.batch.otherFailure,
    consecutiveFailures: snapshot.batch.consecutiveFailures
  });
  assert.deepEqual(stopped, { stopped: true, statusClass: "consecutive-failures", completed: 3069 });
  assert.deepEqual(snapshot.stop, {
    statusClass: stopped.statusClass,
    completed: stopped.completed,
    decision: "hold",
    manualAcknowledgementRequired: true,
    resetImplemented: false,
    clearMarkerAuthorized: false
  });

  assert.deepEqual(snapshot.filesystemAudit, {
    scope: "output/research/cocoloop-skill-intake",
    ...filesystemState(),
    relatedProcesses: relatedIntakeProcesses()
  });
  assert.equal(snapshot.filesystemAudit.relatedProcesses, 0);
  const stdout = fs.readFileSync(absolute("resumeStdout"), "utf8");
  const stderr = fs.readFileSync(absolute("resumeStderr"), "utf8");
  assert.deepEqual(snapshot.resumeLogAudit, {
    rawContentIncluded: false,
    rawPublicationAuthorized: false,
    stdout: { lineBreaks: 0, nonEmptyLines: 0 },
    stderr: {
      lineBreaks: 13,
      nonEmptyLines: 11,
      httpUrlMatches: 0,
      authorizationOrTokenMatches: 0,
      rawPayloadMatches: 0,
      stackFrameLines: 4,
      localAbsolutePathMatches: 1,
      safetyStopMentions: 2,
      consecutiveFailureMentions: 1
    }
  });
  assert.equal(stdout, "");
  assert.equal((stderr.match(/https?:\/\/\S+/gi) || []).length, snapshot.resumeLogAudit.stderr.httpUrlMatches);
  assert.equal((stderr.match(/authorization\s*:|bearer\s+|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|runToken)\s*[:=]/gi) || []).length, snapshot.resumeLogAudit.stderr.authorizationOrTokenMatches);
  assert.equal((stderr.match(/<html|<!doctype|pageUrl|raw(?:Body|Html|Response)?\s*[:=]/gi) || []).length, snapshot.resumeLogAudit.stderr.rawPayloadMatches);

  const serialized = JSON.stringify(snapshot);
  assert.equal(Object.hasOwn(snapshot, "reviewQueue"), false);
  assert.equal(/"(?:pageUrl|title|tags|publisher|official)"\s*:/.test(serialized), false);
  assert.equal(/https?:\/\//i.test(serialized), false);
});
