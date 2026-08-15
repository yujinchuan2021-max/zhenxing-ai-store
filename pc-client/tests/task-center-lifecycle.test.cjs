"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const main = fs.readFileSync(
  path.resolve(__dirname, "../electron/main.cjs"),
  "utf8"
);
const renderer = fs.readFileSync(
  path.resolve(__dirname, "../src/App.tsx"),
  "utf8"
);

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing source marker: ${start}`);
  assert.ok(endIndex > startIndex, `missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

function functionSource(source, name) {
  const signature = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = signature.exec(source);
  assert.ok(match, `missing function: ${name}`);
  const open = source.indexOf("{", match.index);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(match.index, index + 1);
  }
  assert.fail(`unterminated function: ${name}`);
}

function durableTaskRemovalFunctions(source) {
  const names = [];
  const signatures = source.matchAll(
    /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g
  );
  for (const [, name] of signatures) {
    const body = functionSource(source, name);
    if (
      /managedDownloadTasks\.delete\(productId\)/.test(body) &&
      /writeManagedDownloadTasks\(\)/.test(body)
    ) {
      names.push(name);
    }
  }
  return names;
}

function callsDurableTaskRemoval(body) {
  if (
    /managedDownloadTasks\.delete\(productId\)[\s\S]*?writeManagedDownloadTasks\(\)/.test(
      body
    )
  ) {
    return true;
  }
  return durableTaskRemovalFunctions(main).some((name) =>
    new RegExp(`\\b${name}\\s*\\(\\s*productId\\b`).test(body)
  );
}

function callsCompletedRecordRemoval(body) {
  const removesInline =
    /delete\s+[A-Za-z_$][\w$]*\[productId\][\s\S]*?writeDownloadRecords\(/.test(
      body
    ) || /removeRecordMetadata\([^,]+,\s*productId\)/.test(body);
  if (removesInline) return true;

  const signatures = main.matchAll(
    /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g
  );
  for (const [, name] of signatures) {
    const candidate = functionSource(main, name);
    const removesRecord =
      /delete\s+[A-Za-z_$][\w$]*\[productId\][\s\S]*?writeDownloadRecords\(/.test(
        candidate
      ) || /removeRecordMetadata\([^,]+,\s*productId\)/.test(candidate);
    if (
      removesRecord &&
      new RegExp(`\\b${name}\\s*\\(\\s*productId\\b`).test(body)
    ) {
      return true;
    }
  }
  return false;
}

test("failed downloads expose delete and use the existing safe cancel flow", () => {
  const cards = sliceBetween(
    renderer,
    "{filteredDownloadTasks.map((task) => {",
    "{task.progress.percent !== null"
  );
  const directFailedDelete =
    /task\.phase === ["']failed["']\s*&&\s*\([\s\S]*?onCancelDownloadTask\(task\.productId(?:,\s*event\.currentTarget)?\)/.test(
      cards
    );
  const namedFailedDelete =
    /const\s+canDelete\s*=\s*task\.phase === ["']failed["']/.test(cards) &&
    /canDelete\s*&&\s*\([\s\S]*?onCancelDownloadTask\(task\.productId(?:,\s*event\.currentTarget)?\)/.test(
      cards
    );
  assert.equal(
    directFailedDelete || namedFailedDelete,
    true,
    "a failed task needs a delete button backed by onCancelDownloadTask"
  );

  const cancel = sliceBetween(
    renderer,
    "const requestDownloadCancellation =",
    "const openCompletedDownloadTask = async"
  );
  const confirm = sliceBetween(
    renderer,
    "const confirmDownloadCancellation = async",
    "const installProduct = async"
  );
  assert.match(cancel, /legacyTask\?\.attemptId/);
  assert.match(cancel, /setPendingDownloadCancellation/);
  assert.match(confirm, /cancelDownload\(\{[\s\S]*?taskId:\s*pending\.taskId[\s\S]*?confirmed:\s*true/);
  assert.match(
    confirm,
    /result\.ok\s*&&\s*!result\.task[\s\S]*?removeClearedDownloadTask\(pending\.productId\)/,
    "successful safe cleanup must remove the task from the renderer immediately"
  );
});

test("successful cancel or delete removes the durable task record", () => {
  const discard = functionSource(main, "discardManagedDownload");

  assert.equal(
    callsDurableTaskRemoval(discard),
    true,
    "discardManagedDownload must delete and persist the product-scoped task record"
  );
  assert.match(
    discard,
    /(?:task:\s*null|cleared:\s*true)/,
    "the IPC result must not return the canceled task as a live task"
  );
});

test("a missing local installer is forgotten so the product can be downloaded again", () => {
  const reconcile = functionSource(main, "reconcileManagedDownloadTask");

  assert.doesNotMatch(
    reconcile,
    /DOWNLOADED_FILE_MISSING/,
    "missing local files must not become a permanent failed task"
  );
  assert.equal(
    callsDurableTaskRemoval(reconcile),
    true,
    "reconciliation must remove the stale durable task"
  );
  assert.equal(
    callsCompletedRecordRemoval(reconcile),
    true,
    "reconciliation must remove stale completed-download metadata too"
  );
  assert.match(reconcile, /return\s+null\s*;/);
});

test("terminal desktop operations leave the task center", () => {
  assert.match(
    renderer,
    /if \(task\.phase === "canceled" \|\| task\.phase === "failed"\) \{[\s\S]*?delete next\[task\.productId\]/,
    "a terminal desktop operation must not remain as a renderer task"
  );
});

test("task-center and resource task DOM localize technical runtime errors", () => {
  const taskCenter = sliceBetween(
    renderer,
    "function SettingsPanel({",
    "function SettingBlock({"
  );

  assert.match(
    taskCenter,
    /task\.lastError && <em>\{runtimeMessage\(task\.lastError, undefined, task\.operation === "uninstall" \? "desktop\.uninstallFailed" : "desktop\.installFailed"\)\}<\/em>/,
    "desktop task errors must cross the localized runtime-message boundary"
  );
  assert.match(
    renderer,
    /default: return runtimeMessage\(status\?\.error, undefined, "extensions\.failed"\);/,
    "resource task errors must not render an IPC technical message verbatim"
  );
});

test("task-center recovery controls keep downloads, CLI, and resources recoverable", () => {
  const taskCenter = sliceBetween(
    renderer,
    "function SettingsPanel({",
    "function SettingBlock({"
  );
  const cancel = sliceBetween(
    renderer,
    "const requestDownloadCancellation =",
    "const openCompletedDownloadTask = async"
  );
  const confirm = sliceBetween(
    renderer,
    "const confirmDownloadCancellation = async",
    "const installProduct = async"
  );
  const retryCli = sliceBetween(
    renderer,
    "const retryCliManagedTask = async",
    "const changeTheme ="
  );
  const resourceRow = sliceBetween(
    renderer,
    "function ResourceRow({",
    "function ProductRow({"
  );

  assert.match(taskCenter, /task\.phase === "pausing" \|\| task\.phase === "canceling"/);
  assert.match(taskCenter, /!\["completed", "canceled", "failed"\]\.includes\(task\.phase\)/);
  assert.match(taskCenter, /const canDelete = task\.phase === "failed"/);
  assert.match(taskCenter, /task\.phase === "completed"/);
  assert.match(taskCenter, /runtimeMessage\(task\.message\)/);
  assert.match(cancel, /taskId/);
  assert.match(confirm, /result\.ok && !result\.task[\s\S]*?removeClearedDownloadTask\(pending\.productId\)/);
  assert.match(retryCli, /deployCli\(product, task\.operation\)/);
  assert.match(resourceRow, /managed && !status/);
  assert.match(resourceRow, /disabled=\{busyAction !== null\}/);
  assert.match(resourceRow, /status\.allowedActions\.filter/);
});
