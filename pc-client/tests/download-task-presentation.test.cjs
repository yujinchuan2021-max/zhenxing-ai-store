"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createDownloadTaskRevisionTracker
} = require("../shared/download-task-presentation.cjs");

function task(productId, attemptId, attempt, revision) {
  return { productId, attemptId, attempt, revision };
}

test("a fresh download binds the new attempt even if its event beats the command reply", () => {
  const revisions = createDownloadTaskRevisionTracker();

  assert.equal(revisions.accept(task("claude-desktop", "old", 1, 8)), true);

  revisions.beginFreshDownload("claude-desktop");

  assert.equal(
    revisions.accept(task("claude-desktop", "old", 1, 9)),
    false,
    "late events from the current generation are quarantined while refresh starts"
  );
  assert.equal(
    revisions.accept(task("claude-desktop", "new", 2, 1)),
    true,
    "the main-process event may legitimately arrive before the invoke reply"
  );
  assert.equal(
    revisions.accept(task("claude-desktop", "new", 2, 1), {
      freshStart: true
    }),
    false,
    "the duplicate command reply does not reapply the same revision"
  );
  assert.equal(
    revisions.accept(task("claude-desktop", "old", 1, 99)),
    false,
    "an older attempt cannot win merely by carrying a larger revision"
  );
  assert.equal(
    revisions.accept(task("claude-desktop", "new", 2, 2)),
    true
  );
});

test("an unconfirmed fresh download can be canceled without losing the current attempt", () => {
  const revisions = createDownloadTaskRevisionTracker();

  assert.equal(revisions.accept(task("chatgpt-desktop", "current", 4, 3)), true);
  revisions.beginFreshDownload("chatgpt-desktop");
  assert.equal(revisions.accept(task("chatgpt-desktop", "current", 4, 4)), false);

  revisions.cancelFreshDownload("chatgpt-desktop");
  assert.equal(revisions.accept(task("chatgpt-desktop", "current", 4, 4)), true);
});

test("clearing a product forgets its cursor but permanently rejects its known attempt", () => {
  const revisions = createDownloadTaskRevisionTracker();

  assert.equal(revisions.accept(task("comfy-desktop", "cleared", 1, 5)), true);
  revisions.clearProduct("comfy-desktop");
  assert.equal(revisions.accept(task("comfy-desktop", "cleared", 1, 6)), false);
  assert.equal(revisions.accept(task("comfy-desktop", "replacement", 1, 1)), true);
});

test("invalid or duplicate task identities are rejected", () => {
  const revisions = createDownloadTaskRevisionTracker();

  assert.equal(revisions.accept({ productId: "ollama-cli", revision: 1 }), false);
  assert.equal(revisions.accept(task("ollama-cli", "a", 0, 1)), false);
  assert.equal(revisions.accept(task("ollama-cli", "a", 1, 1)), true);
  assert.equal(revisions.accept(task("ollama-cli", "a", 1, 1)), false);
  assert.equal(revisions.accept(task("ollama-cli", "b", 1, 2)), false);
  assert.equal(revisions.accept(task("ollama-cli", "b", 2, 1)), true);
});
