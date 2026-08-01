"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  resolveCompletedPackageInstallIntent,
  resolveDesktopInstallerLaunchPolicy,
  resolveTrustedDesktopInstallerLaunchPolicy
} = require("../shared/desktop-installer-launch-policy.cjs");

test("only a first install is verified through an absent-to-installed transition", () => {
  assert.deepEqual(resolveDesktopInstallerLaunchPolicy("install"), {
    intent: "install",
    trackPresenceTransition: true,
    verificationMode: "presence-transition"
  });
  for (const intent of ["reinstall", "refresh"]) {
    assert.deepEqual(resolveDesktopInstallerLaunchPolicy(intent), {
      intent,
      trackPresenceTransition: false,
      verificationMode: "installer-owned-maintenance"
    });
  }
});

test("an unknown renderer intent cannot influence installer execution", () => {
  assert.equal(resolveDesktopInstallerLaunchPolicy("repair-with-command"), null);
  assert.equal(resolveDesktopInstallerLaunchPolicy({ intent: "install" }), null);
});

test("the trusted main-process presence baseline owns verification mode", () => {
  assert.deepEqual(
    resolveTrustedDesktopInstallerLaunchPolicy("reinstall", {
      installed: false,
      detection: "absent"
    }),
    {
      ok: true,
      requestedIntent: "reinstall",
      intent: "install",
      trackPresenceTransition: true,
      verificationMode: "presence-transition"
    }
  );
  assert.deepEqual(
    resolveTrustedDesktopInstallerLaunchPolicy("refresh", {
      installed: true,
      detection: "installed"
    }),
    {
      ok: true,
      requestedIntent: "refresh",
      intent: "reinstall",
      trackPresenceTransition: false,
      verificationMode: "installer-owned-maintenance"
    }
  );
});

test("installed plus renderer install cannot enter presence-transition verification", () => {
  const resolution = resolveTrustedDesktopInstallerLaunchPolicy("install", {
    installed: true,
    detection: "installed"
  });
  assert.deepEqual(resolution, {
    ok: false,
    errorCode: "PRODUCT_ALREADY_INSTALLED"
  });
});

test("unknown or internally inconsistent presence fails closed", () => {
  for (const status of [
    { installed: false, detection: "unknown" },
    { installed: true, detection: "absent" },
    { installed: false, detection: "installed" }
  ]) {
    assert.deepEqual(
      resolveTrustedDesktopInstallerLaunchPolicy("reinstall", status),
      { ok: false, errorCode: "PRODUCT_PRESENCE_UNKNOWN" }
    );
  }
});

test("a completed package uses first-install verification only when the product is absent", () => {
  assert.equal(
    resolveCompletedPackageInstallIntent({ installed: false }),
    "install"
  );
  assert.equal(
    resolveCompletedPackageInstallIntent({ installed: true }),
    "reinstall"
  );
  assert.equal(
    resolveCompletedPackageInstallIntent({
      requestedIntent: "refresh",
      installed: true
    }),
    "refresh"
  );
  assert.equal(
    resolveCompletedPackageInstallIntent({
      requestedIntent: "arbitrary",
      installed: false
    }),
    null
  );
});

test("the installer IPC and renderer preserve the reviewed intent end to end", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const preload = fs.readFileSync(
    path.resolve(__dirname, "../electron/preload.cjs"),
    "utf8"
  );
  const app = fs.readFileSync(
    path.resolve(__dirname, "../src/App.tsx"),
    "utf8"
  );

  assert.match(
    main,
    /ipcMain\.handle\("installer:launch", async \(_event, productId, intent\)/
  );
  assert.match(
    main,
    /resolveTrustedDesktopInstallerLaunchPolicy\(intent, trustedPresence\)/
  );
  assert.match(main, /trustedLaunchPolicy\.trackPresenceTransition/);
  assert.match(preload, /launchInstaller: \(productId, intent\)/);
  assert.match(app, /window\.aihubPC\.launchInstaller\(product\.id, intent\)/);
  assert.match(app, /useRef<Map<string, ManagedInstallIntent>>/);
  assert.match(app, /resolveCompletedPackageInstallIntent/);
});
