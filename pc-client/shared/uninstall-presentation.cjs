"use strict";

const UNINSTALL_MODES = Object.freeze(["automatic", "interactive"]);

const UNINSTALL_PRESENTATIONS = Object.freeze({
  automatic: Object.freeze({
    preparing: "正在验证并启动自动卸载…",
    activeTitle: "正在自动卸载",
    activeDetail: "AI Hub 正在确认产品是否已移除…",
    timedOut:
      "暂未确认卸载完成。自动卸载可能仍在运行，请稍后点击“立即检测”。",
    stillInstalled: "自动卸载尚未完成，请稍后再次检测",
    launched: "已启动自动卸载，AI Hub 正在确认卸载结果。"
  }),
  interactive: Object.freeze({
    preparing: "正在验证并调起厂商卸载面板…",
    activeTitle: "已调起厂商卸载面板",
    activeDetail: "请在卸载面板中手动完成，AI Hub 将自动确认结果。",
    timedOut:
      "暂未确认卸载完成。请在卸载面板中完成后点击“立即检测”。",
    stillInstalled: "仍检测到该产品，请先在厂商卸载面板中完成卸载",
    launched: "已调起厂商卸载面板，请手动完成卸载。"
  })
});

function normalizeUninstallMode(value) {
  return UNINSTALL_MODES.includes(value) ? value : "interactive";
}

function getUninstallPresentation(value) {
  return UNINSTALL_PRESENTATIONS[normalizeUninstallMode(value)];
}

module.exports = {
  UNINSTALL_MODES,
  getUninstallPresentation,
  normalizeUninstallMode
};
