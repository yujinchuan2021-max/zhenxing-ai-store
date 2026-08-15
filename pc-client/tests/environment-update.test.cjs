const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createEnvironmentUpdatePlan,
  projectEnvironmentFamilyChecks
} = require("../shared/environment-update.cjs");

test("projects one Python family card and offers an explicit 3.12 to 3.13 update", () => {
  assert.deepEqual(
    projectEnvironmentFamilyChecks([
      {
        id: "node",
        name: "Node.js",
        installed: true,
        version: "24.17.0",
        recommendedVersion: "24.18.0",
        canUpdate: true,
        detection: "installed"
      },
      {
        id: "python",
        name: "Python 3.13",
        installed: false,
        version: "",
        recommendedVersion: "3.13.14",
        canUpdate: false,
        detection: "absent"
      },
      {
        id: "python312",
        name: "Python 3.12",
        installed: true,
        version: "3.12.10",
        recommendedVersion: "3.12.10",
        canUpdate: false,
        detection: "installed",
        location: "C:\\Python312\\python.exe"
      }
    ]),
    [
      {
        id: "node",
        name: "Node.js",
        installed: true,
        version: "24.17.0",
        recommendedVersion: "24.18.0",
        canUpdate: true,
        detection: "installed"
      },
      {
        id: "python312",
        name: "Python 3.12",
        installed: true,
        version: "3.12.10",
        recommendedVersion: "3.13.14",
        canUpdate: true,
        detection: "installed",
        location: "C:\\Python312\\python.exe",
        updateEnvironmentId: "python"
      }
    ]
  );
});

test("uses an installed family member as the trusted baseline for a reviewed update target", () => {
  assert.deepEqual(
    createEnvironmentUpdatePlan({
      environmentId: "python",
      statuses: {
        python: { detection: "absent", version: "" },
        python312: { detection: "installed", version: "3.12.10" }
      },
      downloadPlan: { recommendedVersion: "3.13.14" }
    }),
    {
      environmentId: "python",
      intent: "update",
      installedEnvironmentId: "python312",
      installedVersion: "3.12.10",
      recommendedVersion: "3.13.14"
    }
  );
});

test("the settings UI consumes family cards and keeps update launch user initiated", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../src/App.tsx"),
    "utf8"
  );
  const settings = source.match(
    /function SettingsPanel\([\s\S]*?function SettingBlock/
  )?.[0];
  assert.ok(settings);
  assert.match(settings, /environment\.displayChecks \|\| environment\.checks/);
  assert.match(settings, /uiText\("environment\.updateAvailable"\)/);
  assert.match(settings, /data-aihub-action="update-environment"/);
  assert.match(settings, /onUpdateEnvironment\(updateEnvironmentId\)/);
  assert.doesNotMatch(settings, /useEffect[\s\S]*?onUpdateEnvironment/);
});

test("the main process preserves exact dependency checks but revalidates family updates", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const scan = source.match(
    /async function scanEnvironment\(\)[\s\S]*?function windowsPackageManagerPlan/
  )?.[0];
  const updateDownload = source.match(
    /async function prepareEnvironmentPackageDownload[\s\S]*?async function startManagedDownload/
  )?.[0];
  const openUpdaterStart = source.indexOf('"environment:open-updater"');
  const openUpdaterEnd = source.indexOf(
    '"environment:open-installer"',
    openUpdaterStart
  );
  const openUpdater = source.slice(openUpdaterStart, openUpdaterEnd);
  assert.ok(scan);
  assert.ok(updateDownload);
  assert.ok(openUpdaterStart >= 0 && openUpdaterEnd > openUpdaterStart);
  assert.match(scan, /checks,/);
  assert.match(scan, /displayChecks: projectEnvironmentFamilyChecks\(checks\)/);
  assert.match(updateDownload, /statuses: await detectEnvironmentUpdateStatuses\(environmentId\)/);
  assert.match(openUpdater, /statuses: await detectEnvironmentUpdateStatuses\(environmentId\)/);
  assert.match(openUpdater, /confirmed\.installedEnvironmentId !== baseline\.installedEnvironmentId/);
});

test("creates an update intent only from a trusted lower installed version", () => {
  assert.deepEqual(
    createEnvironmentUpdatePlan({
      environmentId: "python312",
      status: { detection: "installed", version: "3.12.9" },
      downloadPlan: { recommendedVersion: "3.12.10" }
    }),
    {
      environmentId: "python312",
      intent: "update",
      installedVersion: "3.12.9",
      recommendedVersion: "3.12.10"
    }
  );
});

test("rejects absent, unknown, equal, newer, and rolling-latest update baselines", () => {
  for (const [detection, version, recommendedVersion] of [
    ["absent", "", "3.12.10"],
    ["unknown", "", "3.12.10"],
    ["installed", "3.12.10", "3.12.10"],
    ["installed", "3.13.0", "3.12.10"],
    ["installed", "1.0.0", ""]
  ]) {
    assert.equal(
      createEnvironmentUpdatePlan({
        environmentId: "python312",
        status: { detection, version },
        downloadPlan: { recommendedVersion }
      }),
      null
    );
  }
});
