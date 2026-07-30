"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  shouldHideWindowOnClose,
  shouldKeepAppAlive
} = require("../shared/tray-lifecycle.cjs");

test("hides the main window only while the tray owns app lifetime", () => {
  assert.equal(
    shouldHideWindowOnClose({ isQuitting: false, trayAvailable: true }),
    true
  );
  assert.equal(
    shouldHideWindowOnClose({ isQuitting: true, trayAvailable: true }),
    false
  );
  assert.equal(
    shouldHideWindowOnClose({ isQuitting: false, trayAvailable: false }),
    false
  );
});

test("keeps Windows alive for the tray but allows an explicit quit", () => {
  assert.equal(
    shouldKeepAppAlive({
      platform: "win32",
      isQuitting: false,
      trayAvailable: true
    }),
    true
  );
  assert.equal(
    shouldKeepAppAlive({
      platform: "win32",
      isQuitting: true,
      trayAvailable: true
    }),
    false
  );
  assert.equal(
    shouldKeepAppAlive({
      platform: "win32",
      isQuitting: false,
      trayAvailable: false
    }),
    false
  );
});
