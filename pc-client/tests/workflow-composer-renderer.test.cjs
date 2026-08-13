"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const types = fs.readFileSync(path.join(root, "src", "vite-env.d.ts"), "utf8");
const language = fs.readFileSync(path.join(root, "src", "language", "index.ts"), "utf8");

test("workflow composer is gated by the fixed Local Agent Bridge capability", () => {
  assert.match(types, /getLocalAgentBridgeCapability\(\)/);
  assert.match(types, /planLocalAgentBridge\(/);
  assert.match(types, /requestLocalAgentBridge\(/);
  assert.match(app, /getLocalAgentBridgeCapability/);
  assert.match(app, /function WorkflowComposerPanel/);
  assert.match(app, /workflowComposer/);
  assert.match(app, /agentBridgeCapability\?\.enabled/);
});

test("workflow composer stays non-executing without the missing desktop composition/session handoff", () => {
  const start = app.indexOf("function WorkflowComposerPanel");
  const end = app.indexOf("function MyWorkflowsPage");
  const source = app.slice(start, end);
  assert.ok(start >= 0 && end > start, "workflow composer component missing");
  assert.match(source, /workflow\.composer\.sessionMissing/);
  assert.match(source, /workflow\.composer\.compositionUnavailable/);
  assert.doesNotMatch(source, /executeWorkflow|invokeWorkflow|importWorkflow|bindWorkflow|window\.open|command|script|endpoint|credential|secret/);
});

test("workflow composer has bilingual text for disabled dependencies and pending confirmation", () => {
  for (const key of [
    "workflow.composer.title",
    "workflow.composer.agent",
    "workflow.composer.steps",
    "workflow.composer.sessionMissing",
    "workflow.composer.compositionUnavailable",
    "workflow.composer.plan",
    "workflow.composer.requestConfirmation",
    "workflow.composer.pendingConfirmation"
  ]) {
    assert.equal((language.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) || []).length, 2, key);
  }
});
