"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildDownloadPopoverItems,
  createDownloadTaskRevisionTracker
} = require("../shared/download-task-presentation.cjs");
const fs = require("node:fs");
const path = require("node:path");

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

test("the top-bar download list merges queue and legacy tasks without duplicates", () => {
  const result = buildDownloadPopoverItems({
    names: {
      alpha: "Alpha Desktop",
      beta: "Beta Desktop"
    },
    queueTasks: {
      alpha: {
        taskId: "queue-alpha",
        productId: "alpha",
        phase: "downloading",
        progress: { percent: 42 },
        presentation: { state: "active" }
      }
    },
    legacyTasks: {
      alpha: {
        attemptId: "legacy-alpha",
        productId: "alpha",
        phase: "downloading",
        progress: { percent: 10 },
        updatedAt: "2026-08-15T09:00:00.000Z"
      },
      beta: {
        attemptId: "legacy-beta",
        productId: "beta",
        phase: "completed",
        progress: { percent: 100 },
        updatedAt: "2026-08-15T10:00:00.000Z"
      }
    }
  });

  assert.deepEqual(result, {
    activeCount: 1,
    totalCount: 2,
    items: [
      {
        id: "queue-alpha",
        productId: "alpha",
        name: "Alpha Desktop",
        source: "queue",
        phase: "downloading",
        state: "active",
        percent: 42
      },
      {
        id: "legacy-beta",
        productId: "beta",
        name: "Beta Desktop",
        source: "legacy",
        phase: "completed",
        state: "completed",
        percent: 100
      }
    ]
  });

  const root = path.resolve(__dirname, "..");
  const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  const styles = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");
  const language = fs.readFileSync(path.join(root, "src/language/index.ts"), "utf8");
  assert.match(app, /data-aihub-download-menu/);
  assert.match(app, /data-aihub-download-item/);
  assert.match(app, /buildDownloadPopoverItems/);
  assert.match(app, /openInstalledManagement/);
  assert.match(styles, /\.downloadPopover/);
  assert.match(language, /"downloadMenu\.title"/);
  assert.match(language, /"downloadMenu\.empty"/);
});
