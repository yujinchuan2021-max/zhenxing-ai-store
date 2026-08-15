const assert = require("node:assert/strict");
const test = require("node:test");

const {
  OPENCLAW_GATEWAY_DISTRIBUTION,
  createOpenClawCompanionAction,
  inspectOpenClawCompanionRuntime,
  parseOpenClawSetupJournal
} = require("../shared/openclaw-companion-runtime.cjs");

const installedHub = Object.freeze({
  installed: true,
  executable: "C:\\Users\\Tester\\AppData\\Local\\OpenClawTray\\OpenClaw.Tray.WinUI.exe",
  version: "0.6.12",
  detection: "installed"
});

test("does not mistake an ordinary Ubuntu distribution for the Hub gateway", () => {
  const status = inspectOpenClawCompanionRuntime({
    hubStatus: installedHub,
    distributions: ["Ubuntu-24.04"],
    versionProbe: { ok: false },
    gatewayProbe: { ok: false },
    setupState: null,
    journalState: { state: "idle" },
    cleanupScriptTrusted: true
  });

  assert.equal(status.installed, false);
  assert.equal(status.gatewayDistributionInstalled, false);
  assert.equal(status.directory, `WSL:${OPENCLAW_GATEWAY_DISTRIBUTION}`);
  assert.equal(status.detection, "absent");
});

test("reports the dedicated gateway layers independently", () => {
  const status = inspectOpenClawCompanionRuntime({
    hubStatus: installedHub,
    distributions: ["docker-desktop", "OpenClawGateway"],
    versionProbe: { ok: true, version: "2026.7.1-2" },
    gatewayProbe: { ok: true, ready: true },
    setupState: { Phase: 13, Status: 7 },
    journalState: { state: "completed" },
    cleanupScriptTrusted: true
  });

  assert.equal(status.installed, true);
  assert.equal(status.gatewayDistributionInstalled, true);
  assert.equal(status.gatewayCliInstalled, true);
  assert.equal(status.gatewayRunning, true);
  assert.equal(status.gatewayReady, true);
  assert.equal(status.gatewayPaired, true);
  assert.equal(status.managed, false);
  assert.equal(status.ownership, "vendor-managed");
  assert.equal(status.canOpen, true);
  assert.equal(status.canUninstall, true);
  assert.equal(status.requiresInstallDirectory, false);
});

test("builds only fixed official Hub deep-link actions", () => {
  assert.deepEqual(createOpenClawCompanionAction(installedHub, "setup"), {
    executable: installedHub.executable,
    args: ["openclaw://setup"]
  });
  assert.deepEqual(createOpenClawCompanionAction(installedHub, "commandcenter"), {
    executable: installedHub.executable,
    args: ["openclaw://commandcenter"]
  });
  assert.equal(createOpenClawCompanionAction(installedHub, "arbitrary"), null);
  assert.equal(
    createOpenClawCompanionAction(
      { ...installedHub, executable: "C:\\Temp\\OpenClaw.Tray.WinUI.exe" },
      "setup"
    ),
    null
  );
});

test("parses cancellation from the official setup journal", () => {
  const result = parseOpenClawSetupJournal([
    JSON.stringify({ Timestamp: "2026-08-01T00:00:00Z", Event: "pipeline_started" }),
    JSON.stringify({ Timestamp: "2026-08-01T00:00:20Z", Event: "pipeline_cancelled", Detail: "during step wsl-create" })
  ].join("\n"));

  assert.deepEqual(result, {
    state: "canceled",
    event: "pipeline_cancelled",
    detail: "during step wsl-create",
    timestamp: "2026-08-01T00:00:20Z"
  });
});
