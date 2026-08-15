"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const types = fs.readFileSync(path.join(root, "src", "vite-env.d.ts"), "utf8");
const language = fs.readFileSync(path.join(root, "src", "language", "index.ts"), "utf8");

test("workflow owner UI remains fail-closed until the owner capability is enabled", () => {
  const ownerTabs = app.slice(app.indexOf("function PersonalCenterPage"));
  const ownerSurface = app.slice(
    app.indexOf("function MyWorkflowsPage"),
    app.indexOf("function PersonalCenterPage")
  );
  assert.match(ownerTabs, /workflowCapability\?\.enabled/);
  assert.match(ownerTabs, /tab === "workflows" && workflowCapability\?\.enabled/);
  assert.match(ownerSurface, /data-aihub-workflow-capability/);
  assert.doesNotMatch(ownerSurface, /getPublicWorkflow|listPublicWorkflow|fetch\([^)]*workflow-store\/public/);
});

test("workflow renderer uses the fixed owner IPC surface and structured envelopes", () => {
  for (const method of [
    "getWorkflowStoreCapability",
    "createWorkflowDraft",
    "listOwnWorkflowDrafts",
    "getOwnWorkflowDraft",
    "updateWorkflowDraft",
    "submitWorkflowDraft",
    "withdrawWorkflowDraft",
    "attachWorkflowPost",
    "detachWorkflowPost",
    "reportWorkflowRelease"
  ]) {
    assert.match(types, new RegExp(`${method}\\(`));
  }
  assert.match(app, /uiText\(result\.error\.messageKey\)/);
  assert.doesNotMatch(app.slice(app.indexOf("function MyWorkflowsPage"), app.indexOf("function PersonalCenterPage")), /error\.message(?!Key)|identityId|reviewer|audit/);
});

test("workflow UI has bilingual candidate and unavailable-execution language", () => {
  for (const key of [
    "workflow.store.myTitle",
    "workflow.store.candidateBoundary",
    "workflow.store.dependenciesUnavailable",
    "workflow.store.saving",
    "workflow.store.submitting",
    "workflow.store.invalid",
    "workflow.store.serviceUnavailable"
  ]) {
    assert.equal((language.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) || []).length, 2, key);
  }
});
