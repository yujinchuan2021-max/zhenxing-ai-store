"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getUninstallPresentation,
  normalizeUninstallMode
} = require("../shared/uninstall-presentation.cjs");

test("automatic uninstall copy never promises a visible panel", () => {
  const copy = getUninstallPresentation("automatic");
  assert.equal(copy.activeTitle, "正在自动卸载");
  assert.match(copy.activeDetail, /确认产品是否已移除/);
  assert.doesNotMatch(Object.values(copy).join(" "), /面板|手动完成/);
});

test("interactive uninstall copy tells the user to finish in the panel", () => {
  const copy = getUninstallPresentation("interactive");
  assert.equal(copy.activeTitle, "已调起厂商卸载面板");
  assert.match(copy.activeDetail, /手动完成/);
});

test("unknown uninstall modes fail safely as interactive", () => {
  assert.equal(normalizeUninstallMode("future-mode"), "interactive");
});
