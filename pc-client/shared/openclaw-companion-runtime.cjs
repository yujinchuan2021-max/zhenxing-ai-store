"use strict";

const path = require("node:path");

const OPENCLAW_GATEWAY_DISTRIBUTION = "OpenClawGateway";
const OPENCLAW_HUB_EXECUTABLE = "OpenClaw.Tray.WinUI.exe";
const OPENCLAW_ACTIONS = Object.freeze({
  setup: "openclaw://setup",
  commandcenter: "openclaw://commandcenter"
});

function isOfficialHubExecutable(value) {
  if (typeof value !== "string" || !path.win32.isAbsolute(value)) return false;
  const normalized = path.win32.normalize(value);
  return (
    path.win32.basename(normalized).toLowerCase() ===
      OPENCLAW_HUB_EXECUTABLE.toLowerCase() &&
    path.win32.basename(path.win32.dirname(normalized)).toLowerCase() ===
      "openclawtray" &&
    /\\appdata\\local\\openclawtray\\/i.test(normalized)
  );
}

function createOpenClawCompanionAction(hubStatus, action) {
  const target = OPENCLAW_ACTIONS[action];
  if (
    !target ||
    hubStatus?.installed !== true ||
    hubStatus?.detection !== "installed" ||
    !isOfficialHubExecutable(hubStatus.executable)
  ) {
    return null;
  }
  return { executable: path.win32.normalize(hubStatus.executable), args: [target] };
}

function setupCompleted(setupState) {
  if (!setupState || typeof setupState !== "object") return false;
  const phase = Number(setupState.Phase ?? setupState.phase);
  const status = Number(setupState.Status ?? setupState.status);
  return phase === 13 && status === 7;
}

function parseOpenClawSetupJournal(value) {
  let latest = null;
  for (const line of String(value || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry.Event === "string") latest = entry;
    } catch {
      // A partially written final line does not invalidate prior durable events.
    }
  }
  const event = String(latest?.Event || "");
  const state =
    event === "pipeline_completed"
      ? "completed"
      : event === "pipeline_cancelled"
        ? "canceled"
        : event === "pipeline_failed"
          ? "failed"
          : event === "pipeline_started" || event === "started"
            ? "running"
            : "idle";
  return {
    state,
    ...(event ? { event } : {}),
    ...(typeof latest?.Detail === "string" && latest.Detail
      ? { detail: latest.Detail }
      : {}),
    ...(typeof latest?.Timestamp === "string" && latest.Timestamp
      ? { timestamp: latest.Timestamp }
      : {})
  };
}

function inspectOpenClawCompanionRuntime({
  hubStatus,
  distributions,
  versionProbe,
  gatewayProbe,
  setupState,
  journalState,
  cleanupScriptTrusted
}) {
  const hubInstalled =
    hubStatus?.installed === true && hubStatus?.detection === "installed";
  const gatewayDistributionInstalled = (Array.isArray(distributions)
    ? distributions
    : []
  ).some(
    (name) =>
      String(name).trim().toLowerCase() ===
      OPENCLAW_GATEWAY_DISTRIBUTION.toLowerCase()
  );
  const gatewayCliInstalled =
    gatewayDistributionInstalled && versionProbe?.ok === true;
  const gatewayRunning = gatewayCliInstalled && gatewayProbe?.ok === true;
  const gatewayReady = gatewayRunning && gatewayProbe?.ready === true;
  const gatewayPaired = gatewayReady && setupCompleted(setupState);
  const detection = !hubInstalled
    ? hubStatus?.detection === "unknown"
      ? "unknown"
      : "absent"
    : gatewayCliInstalled
      ? "installed"
      : gatewayDistributionInstalled && versionProbe?.unknown
        ? "unknown"
        : "absent";
  const setupPhase = String(journalState?.state || "idle");
  const summary = !hubInstalled
    ? "需要先安装 OpenClaw Windows Hub"
    : !gatewayDistributionInstalled
      ? setupPhase === "canceled"
        ? "本地网关配置已取消"
        : "桌面端已安装 · 本地网关未部署"
      : !gatewayCliInstalled
        ? "本地网关环境已创建 · OpenClaw 尚未就绪"
        : !gatewayRunning
          ? "本地网关已部署 · 服务未运行"
          : !gatewayPaired
            ? "本地网关运行中 · 等待配对"
            : "本地网关已连接";

  return {
    installed: gatewayCliInstalled,
    version: gatewayCliInstalled ? String(versionProbe.version || "") : "",
    directory: `WSL:${OPENCLAW_GATEWAY_DISTRIBUTION}`,
    detection,
    managed: hubInstalled && gatewayDistributionInstalled,
    canUninstall:
      hubInstalled &&
      gatewayDistributionInstalled &&
      cleanupScriptTrusted === true,
    ownership:
      hubInstalled && gatewayDistributionInstalled
        ? "adopted"
        : gatewayDistributionInstalled
          ? "external"
          : "none",
    requiresInstallDirectory: false,
    hubInstalled,
    hubRunning: hubStatus?.running === true,
    gatewayDistributionInstalled,
    gatewayCliInstalled,
    gatewayRunning,
    gatewayReady,
    gatewayPaired,
    setupPhase,
    setupDetail: String(journalState?.detail || ""),
    setupTimestamp: String(journalState?.timestamp || ""),
    summary
  };
}

module.exports = {
  OPENCLAW_GATEWAY_DISTRIBUTION,
  OPENCLAW_HUB_EXECUTABLE,
  createOpenClawCompanionAction,
  inspectOpenClawCompanionRuntime,
  isOfficialHubExecutable,
  parseOpenClawSetupJournal,
  setupCompleted
};
