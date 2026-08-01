"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

test("desktop install state copy follows the selected PC language", () => {
  assert.equal(
    getProductInstallPresentation({ stage: "detecting", language: "en" })
      .buttonLabel,
    "Preparing"
  );
  assert.equal(
    getProductInstallPresentation({ stage: "launching-installer", language: "en" })
      .buttonLabel,
    "Installing"
  );
  assert.equal(
    getProductInstallPresentation({
      stage: "downloaded",
      filePath: "D:\\AI Hub\\Claude-Setup-x64.exe",
      language: "en"
    }).buttonLabel,
    "Install now"
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

test("the product row routes resume and retry to their dedicated download commands", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");
  const row = source.match(/function ProductRow\([\s\S]*?function AuthModal/)?.[0];
  assert.ok(row, "ProductRow source was not found");
  assert.match(
    row,
    /actions\.includes\("resume"\)[\s\S]*?onClick=\{onResumeDownload\}/
  );
  assert.match(
    row,
    /actions\.includes\("retry"\)[\s\S]*?onClick=\{onRetryDownload\}/
  );
});

test("a failed refresh retains installed presentation instead of becoming a fresh install error", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");
  const taskHandler = source.match(
    /const applyManagedDownloadTask =[\s\S]*?const applyDesktopOperationTask/
  )?.[0];
  assert.ok(taskHandler, "managed download task handler was not found");
  assert.match(
    taskHandler,
    /installedEvidenceProducts\.current\.has\(task\.productId\)[\s\S]*?"installed"[\s\S]*?: "error"/
  );
});
