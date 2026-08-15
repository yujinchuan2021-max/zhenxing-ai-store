"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const types = fs.readFileSync(path.join(root, "src", "vite-env.d.ts"), "utf8");

test("public workflow navigation requires an enabled capability and a non-empty safe list", () => {
  assert.match(types, /getWorkflowPublicCapability\(\)/);
  assert.match(types, /listPublicWorkflows\(/);
  assert.match(app, /getWorkflowPublicCapability/);
  assert.match(app, /listPublicWorkflows/);
  assert.match(app, /workflow-public-store/);
});

test("public workflow detail and post-reference seams only use fixed public DTO actions", () => {
  const start = app.indexOf("function WorkflowReferenceCard");
  const end = app.indexOf("function MyWorkflowsPage");
  const source = app.slice(start, end);
  assert.ok(start >= 0 && end > start, "public workflow renderer component missing");
  assert.match(source, /getPublicWorkflow/);
  assert.match(source, /resolvePublicWorkflow/);
  assert.match(source, /workflow\.public\.unavailable/);
  assert.doesNotMatch(source, /importWorkflow|executeWorkflow|invokeWorkflow|bindWorkflow|window\.open/);
});

test("public workflow detail uses a subordinate, labelled list breadcrumb", () => {
  const start = app.indexOf("function WorkflowPublicStorePage");
  const end = app.indexOf("function MyWorkflowsPage");
  const source = app.slice(start, end);
  assert.match(source, /workflowPublicBreadcrumb/);
  assert.match(source, /workflow\.public\.breadcrumb/);
  assert.doesNotMatch(source, /<section className="workflowPublicDetail">\s*<button/);
});

test("public workflow keeps original-author display separate and has a neutral omission fallback", () => {
  const start = app.indexOf("function WorkflowPublicStorePage");
  const end = app.indexOf("function MyWorkflowsPage");
  const source = app.slice(start, end);
  assert.match(types, /originalAuthorDisplayName\?: string/);
  assert.match(source, /active\.originalAuthorDisplayName/);
  assert.match(source, /workflow\.public\.originalAuthorVerified/);
  assert.doesNotMatch(source, /originalAuthorIdentityId|author\.identityId/);
});
