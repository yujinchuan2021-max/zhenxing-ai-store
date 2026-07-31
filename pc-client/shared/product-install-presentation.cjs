"use strict";

function getProductInstallPresentation({ stage, filePath }) {
  if (stage === "downloaded") {
    return {
      filePath,
      buttonLabel: "立即安装",
      disabled: false,
      showHash: false,
      showTaskLog: false
    };
  }
  if (stage === "detecting") {
    return {
      filePath: "",
      buttonLabel: "正在准备",
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
      buttonLabel: "正在安装",
      disabled: true,
      showHash: false,
      showTaskLog: false
    };
  }
  return null;
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
  getDownloadTaskPreparation,
  getProductDownloadRecoveryPresentation,
  getProductInstallPresentation
};
