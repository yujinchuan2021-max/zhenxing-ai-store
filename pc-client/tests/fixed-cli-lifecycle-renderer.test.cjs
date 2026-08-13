"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "../src/App.tsx"), "utf8");
const language = fs.readFileSync(path.join(__dirname, "../src/language/index.ts"), "utf8");

test("fixed CLI renderer is limited to the facade allowlist and confirms before apply", () => {
  const panel = app.slice(app.indexOf("function FixedCliLifecycleActions"), app.indexOf("function ProductRow"));
  assert.match(app, /FIXED_CLI_LIFECYCLE_PRODUCT_IDS[\s\S]*google-antigravity-cli[\s\S]*moonshot-kimi-code-cli[\s\S]*amp-cli[\s\S]*daytona-cli/);
  assert.match(panel, /planFixedCliLifecycle/);
  assert.match(panel, /confirmFixedCliLifecycle/);
  assert.match(panel, /applyFixedCliLifecycle/);
  assert.match(panel, /recheckFixedCliLifecycle/);
  assert.match(panel, /data-aihub-action="fixed-cli-confirm"/);
  assert.match(panel, /cli\.lifecycle\.noAgent/);
  assert.doesNotMatch(panel, /\b(command|args|env|url|path|script|shell|receipt|vault|identity)\s*:/);
  assert.match(app, /actionEntry && !managedActionsAvailable && !fixedCliLifecycle/);
});

test("fixed CLI renderer has bilingual safe lifecycle copy", () => {
  for (const key of [
    "deploy",
    "confirmTitle",
    "noAgent",
    "unavailable",
    "catalogMismatch",
    "preparingUpdate",
    "preparingUninstall",
    "confirmUpdateTitle",
    "updateRisk",
    "confirmUninstallTitle",
    "uninstallScope"
  ]) {
    assert.equal((language.match(new RegExp(`"cli\\.lifecycle\\.${key}"`, "g")) || []).length, 2, `${key} must have Chinese and English copy`);
  }
});

test("fixed CLI uninstall keeps destructive wording and an inline confirmation focus", () => {
  const panel = app.slice(app.indexOf("function FixedCliLifecycleActions"), app.indexOf("function ProductRow"));
  assert.match(panel, /busy === "uninstall-plan"/);
  assert.match(panel, /cli\.lifecycle\.preparingUninstall/);
  assert.match(panel, /cli\.lifecycle\.confirmUninstallTitle/);
  assert.match(panel, /cli\.lifecycle\.uninstallScope/);
  assert.match(panel, /role="group"/);
  assert.doesNotMatch(panel, /aria-modal/);
  assert.match(panel, /fixedCliConfirmationHeading/);
  assert.match(panel, /triggerRef\.current\?\.focus/);
  assert.match(panel, /"dangerButton"/);
});
