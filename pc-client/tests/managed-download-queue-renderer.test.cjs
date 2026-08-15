"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

test("queue task presentation has one renderer authority across snapshot and events", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "../scripts/test-managed-download-queue-layout.cjs")],
    {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
      env: { ...process.env, AIHUB_MANAGED_DOWNLOAD_QUEUE_NO_OUTPUT: "1" }
    }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), "", "NO_OUTPUT fixture must not emit calls, artifacts, URLs, file names, paths, or raw tokens");
});

test("the deterministic renderer fixture owns queued modal safety without packaged-network timing", () => {
  const source = require("node:fs").readFileSync(
    path.join(__dirname, "../scripts/fixtures/managed-download-queue-preview-runner.cjs"),
    "utf8"
  );
  assert.match(source, /fourth resource must queue/);
  assert.match(source, /queued task must remain at zero received bytes/);
  assert.match(source, /queued task attempt must remain current/);
  assert.match(source, /Escape must keep the queued task/);
  assert.match(source, /safe dismissal must keep the queued task/);
  assert.match(source, /danger cancellation must not change the independent task/);
  assert.match(source, /retry must create a fresh attempt/);
});

test("the renderer fixture refuses a target artifact before removing its temporary root", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "../scripts/test-managed-download-queue-layout.cjs")],
    {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
      env: {
        ...process.env,
        AIHUB_MANAGED_DOWNLOAD_QUEUE_NO_OUTPUT: "1",
        AIHUB_MANAGED_DOWNLOAD_QUEUE_FORCE_TARGET_RESIDUE: "formal"
      }
    }
  );
  assert.notEqual(result.status, 0, "a target formal artifact must fail before fixture cleanup");
  assert.equal(result.stdout.trim(), "");
});
