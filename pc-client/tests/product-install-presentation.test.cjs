"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getDownloadTaskPreparation,
  getProductDownloadRecoveryPresentation,
  getProductInstallPresentation
} = require("../shared/product-install-presentation.cjs");

test("a failed recovered task re-enters the shared download action", () => {
  assert.equal(
    getDownloadTaskPreparation({ phase: "failed", resumable: false }),
    "ready"
  );
  assert.equal(
    getDownloadTaskPreparation({ phase: "failed", resumable: true }),
    "ready"
  );
  assert.equal(getDownloadTaskPreparation({ phase: "completed" }), "downloaded");
  assert.equal(getDownloadTaskPreparation({ phase: "downloading" }), "active");
  assert.equal(getDownloadTaskPreparation({ phase: "canceled" }), null);
});

test("installing is one disabled button without explanatory copy", () => {
  for (const stage of [
    "deploying",
    "launching-installer",
    "awaiting-verification"
  ]) {
    assert.deepEqual(getProductInstallPresentation({ stage }), {
      filePath: "",
      buttonLabel: "正在安装",
      disabled: true,
      showHash: false,
      showTaskLog: false
    });
  }
});

test("preparing an install keeps one disabled button visible", () => {
  assert.deepEqual(getProductInstallPresentation({ stage: "detecting" }), {
    filePath: "",
    buttonLabel: "正在准备",
    disabled: true,
    showHash: false,
    showTaskLog: false
  });
});

test("a downloaded package shows only its path and immediate install", () => {
  assert.deepEqual(
    getProductInstallPresentation({
      stage: "downloaded",
      filePath: "D:\\AI Hub\\Claude-Setup-x64.exe"
    }),
    {
      filePath: "D:\\AI Hub\\Claude-Setup-x64.exe",
      buttonLabel: "立即安装",
      disabled: false,
      showHash: false,
      showTaskLog: false
    }
  );
});

test("a failed desktop download exposes one clear retry action", () => {
  assert.deepEqual(
    getProductDownloadRecoveryPresentation({
      stage: "error",
      downloadTask: {
        phase: "failed",
        resumable: false,
        errorMessage: "net::ERR_FAILED"
      }
    }),
    {
      messageKey: "download.connectionFailed",
      actions: ["retry"]
    }
  );
});

test("a failed desktop download with a verified partial exposes one resume action", () => {
  assert.deepEqual(
    getProductDownloadRecoveryPresentation({
      stage: "error",
      downloadTask: {
        phase: "failed",
        resumable: true,
        errorMessage: "下载连接失败"
      }
    }),
    {
      messageKey: null,
      actions: ["resume"]
    }
  );
});

test("a paused desktop download keeps pause-specific recovery actions", () => {
  assert.deepEqual(
    getProductDownloadRecoveryPresentation({
      stage: "paused",
      downloadTask: {
        phase: "paused",
        resumable: true,
        errorMessage: ""
      }
    }),
    {
      messageKey: null,
      actions: ["resume", "relocate", "cancel"]
    }
  );
});
