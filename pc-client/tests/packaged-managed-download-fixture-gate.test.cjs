"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const gatePath = path.resolve(__dirname, "../scripts/lib/packaged-managed-download-fixture-gate.cjs");

test("the real hidden no-output renderer fixture passes the packaged gate", { timeout: 120_000 }, () => {
  const { runPackagedManagedDownloadFixtureGate } = require(gatePath);
  assert.deepEqual(runPackagedManagedDownloadFixtureGate(), { ok: true });
});

test("the deterministic renderer gate reports one fixed safe failure class without child output", () => {
  const { runPackagedManagedDownloadFixtureGate } = require(gatePath);
  const cases = [
    { failureClass: "nonzero", temporaryEntries: () => [], spawn: () => ({ status: 1, signal: null, stdout: "", stderr: "" }) },
    { failureClass: "signal", temporaryEntries: () => [], spawn: () => ({ status: null, signal: "SIGTERM", stdout: "", stderr: "" }) },
    { failureClass: "stdout", temporaryEntries: () => [], spawn: () => ({ status: 0, signal: null, stdout: "\r\n", stderr: "" }) },
    { failureClass: "stdout", temporaryEntries: () => [], spawn: () => ({ status: 0, signal: null, stdout: "RAW_OUTPUT_TOKEN", stderr: "" }) },
    { failureClass: "stderr", temporaryEntries: () => [], spawn: () => ({ status: 0, signal: null, stdout: "", stderr: "RAW_OUTPUT_TOKEN" }) },
    { failureClass: "timeout", temporaryEntries: () => [], spawn: () => ({ status: null, signal: "SIGTERM", stdout: "", stderr: "", error: { code: "ETIMEDOUT" } }) },
    { failureClass: "spawn-error", temporaryEntries: () => [], spawn: () => { throw new Error("RAW_OUTPUT_TOKEN"); } },
    { failureClass: "pre-residue", temporaryEntries: () => ["aihub-managed-download-queue-before"], spawn: () => { throw new Error("must not spawn"); } },
    { failureClass: "post-residue", temporaryEntries: (() => { let reads = 0; return () => (++reads === 1 ? [] : ["aihub-managed-download-queue-after"]); })(), spawn: () => ({ status: 0, signal: null, stdout: "", stderr: "" }) }
  ];
  for (const fixture of cases) {
    assert.throws(
      () => runPackagedManagedDownloadFixtureGate(fixture),
      (error) => error?.message === "DETERMINISTIC_RENDERER_FIXTURE_FAILED"
        && error.failureClass === fixture.failureClass
        && !JSON.stringify(error).includes("RAW_OUTPUT_TOKEN")
    );
  }
});

test("the deterministic renderer contract hash binds four ordered paths and their bytes", () => {
  const { deterministicFixtureContractSha256 } = require(gatePath);
  const relativeFiles = [
    "scripts/lib/packaged-managed-download-fixture-gate.cjs",
    "scripts/test-managed-download-queue-layout.cjs",
    "scripts/fixtures/managed-download-queue-preview-runner.cjs",
    "scripts/fixtures/installed-management-preview-preload.cjs"
  ];
  const expected = crypto.createHash("sha256");
  for (const relative of relativeFiles) {
    expected.update(relative, "utf8");
    expected.update("\0", "utf8");
    expected.update(fs.readFileSync(path.join(__dirname, "..", ...relative.split("/"))));
    expected.update("\0", "utf8");
  }
  const current = deterministicFixtureContractSha256();
  assert.equal(current, expected.digest("hex"));
  assert.notEqual(deterministicFixtureContractSha256({
    readFile(file) {
      const bytes = fs.readFileSync(file);
      return file.endsWith("installed-management-preview-preload.cjs") ? Buffer.concat([bytes, Buffer.from("tamper")]) : bytes;
    }
  }), current);
});

test("the deterministic renderer gate requires zero owned residue before and after a bounded no-output run", () => {
  const { runPackagedManagedDownloadFixtureGate } = require(gatePath);
  const calls = [];
  const result = runPackagedManagedDownloadFixtureGate({
    temporaryEntries: () => [],
    spawn(command, args, options) {
      calls.push({ command, args, options });
      return { status: 0, signal: null, stdout: "", stderr: "" };
    }
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, process.execPath);
  assert.deepEqual(calls[0].args, [path.resolve(__dirname, "../scripts/test-managed-download-queue-layout.cjs")]);
  assert.equal(calls[0].options.timeout <= 120_000, true);
  assert.equal(calls[0].options.env.AIHUB_MANAGED_DOWNLOAD_QUEUE_NO_OUTPUT, "1");
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.encoding, "utf8");
  assert.equal(path.resolve(calls[0].options.cwd), path.resolve(__dirname, ".."));
  assert.equal(os.tmpdir().length > 0, true);

  assert.throws(() => runPackagedManagedDownloadFixtureGate({
    temporaryEntries: () => ["aihub-managed-download-queue-owned"],
    spawn: () => { throw new Error("must not spawn"); }
  }), /DETERMINISTIC_RENDERER_FIXTURE_FAILED/);

  let reads = 0;
  assert.throws(() => runPackagedManagedDownloadFixtureGate({
    temporaryEntries: () => (++reads === 1 ? [] : ["aihub-managed-download-queue-owned"]),
    spawn: () => ({ status: 0, signal: null, stdout: "", stderr: "" })
  }), /DETERMINISTIC_RENDERER_FIXTURE_FAILED/);

  reads = 0;
  assert.throws(() => runPackagedManagedDownloadFixtureGate({
    temporaryEntries: () => (++reads === 1 ? [] : ["aihub-managed-download-queue-owned-after-spawn-failure"]),
    spawn: () => ({ status: 1, signal: null, stdout: "", stderr: "" })
  }), /DETERMINISTIC_RENDERER_FIXTURE_FAILED/);
  assert.equal(reads, 2);
});
