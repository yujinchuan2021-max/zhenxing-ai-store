const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("the sole submission route reads capability before it renders owner actions", () => {
  const app = read("src/App.tsx");

  assert.match(app, /function ContributionPage\([\s\S]*?getSubmissionCapability\(/);
  assert.match(app, /capability\.enabled/);
  assert.match(app, /identity\.status !== "authenticated"/);
  assert.match(app, /listOwnSubmissions\(/);
  assert.match(app, /temporarilyUnavailableKinds[\s\S]*?workflow/);
});

test("submission mutations stay owner-scoped and use server actions and revisions", () => {
  const app = read("src/App.tsx");

  for (const call of [
    "createSubmission",
    "updateSubmissionDraft",
    "submitSubmission",
    "addSubmissionEvidence",
    "withdrawSubmission"
  ]) {
    assert.match(app, new RegExp(`\\.${call}\\(`));
  }
  assert.match(app, /idempotencyKey/);
  assert.match(app, /expectedRevision/);
  assert.match(app, /allowedActions\.includes\(/);
  assert.match(app, /if \(result\.ok\)/);
  assert.match(app, /uiText\(result\.error\.messageKey\)/);
  assert.doesNotMatch(app, /function submissionErrorMessage\(/);
});

test("submission renderer consumes only the structured IPC result envelope", () => {
  const types = read("src/vite-env.d.ts");

  assert.match(types, /type SubmissionIpcResult<T> =/);
  assert.match(types, /messageKey: SubmissionMessageKey/);
  for (const call of [
    "getSubmissionCapability",
    "createSubmission",
    "listOwnSubmissions",
    "getOwnSubmission",
    "updateSubmissionDraft",
    "submitSubmission",
    "addSubmissionEvidence",
    "withdrawSubmission"
  ]) assert.match(types, new RegExp(`${call}[\\s\\S]{0,220}SubmissionIpcResult`));
});

test("renderer keeps owner data separate from review and public contribution data", () => {
  const app = read("src/App.tsx");

  assert.match(app, /function ownerSubmissionForRenderer\(/);
  assert.doesNotMatch(app, /window\.aihubPC!\.(?:reviewSubmission|listAllSubmissions)/);
  assert.doesNotMatch(app, /PublicContributionCard/);
});

test("enabled submissions keep candidate boundaries, clear feedback, and optional matching metadata", () => {
  const app = read("src/App.tsx");
  const styles = read("src/styles.css");
  const language = read("src/language/index.ts");

  assert.match(app, /resources\.submit\.candidateBoundary/);
  assert.match(app, /submissionNotice-\$\{notice\.tone\}/);
  assert.match(app, /role=\{notice\.tone === "error" \? "alert" : "status"\}/);
  assert.match(app, /resources\.submit\.saving/);
  assert.match(app, /resources\.submit\.submitting/);
  assert.match(app, /<details className="submissionSupplemental">/);
  assert.match(styles, /\.submissionNotice-error/);
  assert.match(language, /"resources\.submit\.candidateBoundary"/);
  assert.match(language, /"resources\.submit\.saving"/);
  assert.match(language, /"resources\.submit\.status\.accepted"/);
});
