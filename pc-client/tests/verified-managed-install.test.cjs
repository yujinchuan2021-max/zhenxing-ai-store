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
  assert.match(body, /await requestUnifiedInstall\(product, intent\)/);
  assert.match(body, /resolveProductActionContext\(productId, true\)/);
  assert.doesNotMatch(body, /installDownloadedProduct\(product\)/);
});

test("every renderer install boundary re-resolves an enabled catalog action context", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../src/App.tsx"),
    "utf8"
  );
  const unifiedInstall = source.match(
    /const requestUnifiedInstall =[\s\S]*?const requestLatestDesktopInstaller/
  )?.[0];
  const installerLaunch = source.match(
    /const installProduct = async[\s\S]*?const installDownloadedProduct/
  )?.[0];
  const actionResolver = source.match(
    /const resolveProductActionContext =[\s\S]*?const chooseCliDirectory/
  )?.[0];

  assert.ok(unifiedInstall, "requestUnifiedInstall source was not found");
  assert.ok(installerLaunch, "installProduct source was not found");
  assert.ok(actionResolver, "managed action context resolver was not found");
  assert.match(
    unifiedInstall,
    /resolveProductActionContext\(product\.id, true\)/
  );
  assert.match(
    installerLaunch,
    /resolveProductActionContext\(product\.id, true\)/
  );
  assert.match(
    actionResolver,
    /managedActionContextSnapshot\.current\.vendors/
  );
  assert.match(
    actionResolver,
    /managedActionContextSnapshot\.current\.localInventory/
  );
});

test("download completion waits for the user while task recovery still fails closed", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../src/App.tsx"),
    "utf8"
  );
  const taskApplication = source.match(
    /const applyManagedDownloadTask =[\s\S]*?const applyDesktopOperationTask/
  )?.[0];
  const taskRecovery = source.match(
    /const resumeDownloadTask = async[\s\S]*?const pauseDownloadTask/
  )?.[0];

  assert.ok(taskApplication, "download task application source was not found");
  assert.ok(taskRecovery, "download recovery source was not found");
  assert.match(
    taskApplication,
    /task\.phase === "completed"[\s\S]*?"downloaded"/
  );
  assert.doesNotMatch(taskApplication, /installProduct\(|launchInstaller\(/);
  assert.match(taskRecovery, /productId\.startsWith\("environment:"\)/);
  assert.match(
    taskRecovery,
    /resolveProductActionContext\(productId, true\)/
  );
  assert.match(taskRecovery, /if \(!product\) \{[\s\S]*?return;/);
});
