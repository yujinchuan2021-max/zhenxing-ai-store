"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeCliTrayTask,
  normalizeCliTaskNotification,
  rememberNotificationKey
} = require("../shared/task-notification.cjs");

const allowedProducts = Object.freeze({
  "codex-cli": { name: "Codex CLI" }
});

test("accepts only one allowlisted CLI task notification shape", () => {
  const payload = {
    productId: "codex-cli",
    generation: 2,
    operation: "install",
    outcome: "completed"
  };
  assert.deepEqual(
    normalizeCliTaskNotification(payload, allowedProducts),
    payload
  );
  assert.equal(
    normalizeCliTaskNotification(
      { ...payload, productId: "renderer-package" },
      allowedProducts
    ),
    null
  );
  assert.equal(
    normalizeCliTaskNotification({ ...payload, generation: 0 }, allowedProducts),
    null
  );
  assert.equal(
    normalizeCliTaskNotification({ ...payload, url: "https://example.com" }, allowedProducts),
    null
  );
  assert.equal(
    normalizeCliTaskNotification({ ...payload, operation: "update" }, allowedProducts)?.operation,
    "update"
  );
  assert.equal(
    normalizeCliTaskNotification({ ...payload, operation: "repair" }, allowedProducts)?.operation,
    "repair"
  );
});

test("accepts only allowlisted CLI tray task states", () => {
  const payload = {
    productId: "codex-cli",
    generation: 3,
    operation: "uninstall",
    phase: "running"
  };
  assert.deepEqual(normalizeCliTrayTask(payload, allowedProducts), payload);
  assert.equal(
    normalizeCliTrayTask({ ...payload, phase: "paused" }, allowedProducts),
    null
  );
  assert.equal(
    normalizeCliTrayTask(
      { ...payload, command: "npm uninstall" },
      allowedProducts
    ),
    null
  );
});

test("deduplicates notification identities and keeps a bounded history", () => {
  const records = new Map();
  assert.equal(rememberNotificationKey(records, "first", 1, 2), true);
  assert.equal(rememberNotificationKey(records, "first", 2, 2), false);
  assert.equal(rememberNotificationKey(records, "second", 2, 2), true);
  assert.equal(rememberNotificationKey(records, "third", 3, 2), true);
  assert.deepEqual([...records.keys()], ["second", "third"]);
});
