"use strict";

function getProductInstallPresentation({ stage, filePath, artifactKind, language = "zh" }) {
  const english = language === "en";
  if (stage === "downloaded") {
    const archive = artifactKind === "zip" || /\.zip$/i.test(filePath || "");
    return {
      filePath,
      buttonLabel: archive
        ? english ? "Open archive" : "点击打开压缩包"
        : english ? "Install" : "点击安装",
      disabled: false,
      showHash: false,
      showTaskLog: false
    };
  }
  if (stage === "detecting") {
    return {
      filePath: "",
      buttonLabel: english ? "Preparing" : "正在准备",
      disabled: true,
      showHash: false,
      showTaskLog: false
    };
  }
  if (
    [
      "deploying",
      "launching-installer",
      "awaiting-verification"
    ].includes(stage)
  ) {
    return {
      filePath: "",
      buttonLabel: english ? "Installing" : "正在安装",
      disabled: true,
      showHash: false,
      showTaskLog: false
    };
  }
  return null;
}

function buildDesktopInstallConfirmation({
  language = "zh",
  fileName,
  installerKind
}) {
  const english = language === "en";
  const storeBootstrapper = installerKind === "store-bootstrapper";
  const archive = /\.zip$/i.test(fileName || "");
  const detail = storeBootstrapper
    ? english
      ? "If Microsoft Store does not open, turn off VPN or proxy first, then use the repair tool only if needed."
      : "如果 Microsoft Store 无法打开，请先关闭 VPN 或代理；仍无效时再使用修复工具。"
    : archive
      ? english
        ? "The archive will open. Extract it and run the vendor app yourself."
        : "将直接打开压缩包，后续请自行解压并运行厂商程序。"
      : english
        ? "The downloaded installer will open. Continue in the vendor installer."
        : "将直接打开下载好的安装包，后续请在厂商安装程序中完成。";
  return {
    type: "warning",
    title: storeBootstrapper
      ? english
        ? "Open Microsoft Store"
        : "打开 Microsoft Store"
      : archive
        ? english
          ? "Open archive"
          : "打开压缩包"
        : english
        ? "Open installer"
        : "打开安装包",
    message: storeBootstrapper
      ? english
        ? "Turn off VPN or proxy before opening Microsoft Store"
        : "请先关闭 VPN 或代理，再打开 Microsoft Store"
      : archive
        ? english
          ? `Open ${fileName}?`
          : `打开 ${fileName}`
        : english
        ? `Open ${fileName}?`
        : `打开 ${fileName}`,
    detail,
    buttons: storeBootstrapper
      ? [
          english ? "Cancel" : "取消",
          english ? "Still not opening? Repair" : "仍打不开，检测修复",
          english ? "I turned it off, continue" : "我已关闭，继续"
        ]
      : [
          english ? "Cancel" : "取消",
          english ? "Open" : "打开"
        ],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  };
}

function getDesktopInstallConfirmationAction(installerKind, response) {
  if (installerKind === "store-bootstrapper") {
    if (response === 1) return "repair-store";
    if (response === 2) return "launch";
    return "cancel";
  }
  return response === 1 ? "launch" : "cancel";
}

function getDownloadTaskPreparation(downloadTask) {
  if (!downloadTask || typeof downloadTask !== "object") return null;
  if (downloadTask.phase === "canceled") return null;
  if (downloadTask.phase === "completed") return "downloaded";
  if (downloadTask.phase === "failed") return "ready";
  return "active";
}

function getProductDownloadRecoveryPresentation({ stage, downloadTask }) {
  if (!downloadTask || typeof downloadTask !== "object") return null;
  if (stage === "error" && downloadTask.phase === "failed") {
    return {
      messageKey:
        downloadTask.errorCode === "DOWNLOAD_CONNECTION_FAILED" ||
        /(?:net::)?ERR_/i.test(downloadTask.errorMessage || "")
          ? "download.connectionFailed"
          : null,
      actions: [downloadTask.resumable ? "resume" : "retry"]
    };
  }
  if (stage === "paused" && downloadTask.phase === "paused") {
    return {
      messageKey: null,
      actions: ["resume", "relocate", "cancel"]
    };
  }
  return null;
}

module.exports = {
  buildDesktopInstallConfirmation,
  getDesktopInstallConfirmationAction,
  getDownloadTaskPreparation,
  getProductDownloadRecoveryPresentation,
  getProductInstallPresentation
};
