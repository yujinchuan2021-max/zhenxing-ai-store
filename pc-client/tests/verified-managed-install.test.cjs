"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  runVerifiedManagedInstall
} = require("../shared/verified-managed-install.cjs");

test("a recovered downloaded package is blocked when fresh detection finds a missing dependency", async () => {
  let installerOpened = false;
  let dependencySetupStarted = false;

  const result = await runVerifiedManagedInstall({
    detect: async () => "blocked",
    setupDependencies: async () => {
      dependencySetupStarted = true;
    },
    continueInstall: async () => {
      installerOpened = true;
    }
  });

  assert.equal(result, "blocked");
  assert.equal(dependencySetupStarted, true);
  assert.equal(installerOpened, false);
});

test("a recovered ready product proceeds only with the preparation returned by fresh detection", async () => {
  const observed = [];

  const result = await runVerifiedManagedInstall({
    detect: async () => {
      observed.push("fresh-detection");
      return "downloaded";
    },
    setupDependencies: async () => {
      observed.push("dependency-setup");
    },
    continueInstall: async (preparation) => {
      observed.push(`continue:${preparation}`);
    }
  });

  assert.equal(result, "downloaded");
  assert.deepEqual(observed, ["fresh-detection", "continue:downloaded"]);
});

test("management and task-center package actions re-enter the unified fresh-detection rule", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../src/App.tsx"),
    "utf8"
  );
  const body = source.match(
    /const openCompletedDownloadTask = async[\s\S]*?const showDownloadInFolder/
  )?.[0];
  assert.ok(body, "openCompletedDownloadTask source was not found");
  assert.match(body, /await requestUnifiedInstall\(product\)/);
  assert.doesNotMatch(body, /installDownloadedProduct\(product\)/);
});
