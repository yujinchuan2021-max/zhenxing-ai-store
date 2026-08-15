"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  buildDesktopInstallConfirmation,
  getDesktopInstallConfirmationAction,
  getDownloadTaskPreparation,
  getProductDownloadRecoveryPresentation,
  getProductInstallPresentation
} = require("../shared/product-install-presentation.cjs");

test("only Microsoft Store bootstrappers ask China users to turn off VPN", () => {
  const store = buildDesktopInstallConfirmation({
    installerKind: "store-bootstrapper",
    fileName: "ChatGPT Installer.exe",
    architecture: "x86",
    signer: "Microsoft Corporation",
    sha256: "abc"
  });
  assert.match(store.message, /关闭 VPN 或代理/);
  assert.match(store.detail, /Microsoft Store/);
  assert.deepEqual(store.buttons, [
    "取消",
    "仍打不开，检测修复",
    "我已关闭，继续"
  ]);

  const direct = buildDesktopInstallConfirmation({
    installerKind: "vendor-installer",
    fileName: "Claude-Setup-x64.exe",
    architecture: "x64",
    signer: "Anthropic, PBC",
    sha256: "def"
  });
  assert.doesNotMatch(direct.message, /VPN|代理/);
  assert.doesNotMatch(direct.detail, /VPN|代理/);
  assert.equal(direct.buttons[1], "打开");
});

test("Microsoft Store network guidance follows the selected language", () => {
  const confirmation = buildDesktopInstallConfirmation({
    language: "en",
    installerKind: "store-bootstrapper",
    fileName: "ChatGPT Installer.exe"
  });
  assert.match(confirmation.message, /Turn off VPN or proxy/);
  assert.deepEqual(confirmation.buttons, [
    "Cancel",
    "Still not opening? Repair",
    "I turned it off, continue"
  ]);
});

test("Microsoft Store repair is optional and never changes direct-installer routing", () => {
  assert.equal(
    getDesktopInstallConfirmationAction("store-bootstrapper", 0),
    "cancel"
  );
  assert.equal(
    getDesktopInstallConfirmationAction("store-bootstrapper", 1),
    "repair-store"
  );
  assert.equal(
    getDesktopInstallConfirmationAction("store-bootstrapper", 2),
    "launch"
  );
  assert.equal(
    getDesktopInstallConfirmationAction("vendor-installer", 1),
    "launch"
  );
});

test("ZIP and standalone portable packages are only opened", () => {
  const archive = buildDesktopInstallConfirmation({
    installerKind: "portable-zip",
    fileName: "app.zip"
  });
  assert.equal(archive.title, "打开压缩包");
  assert.equal(archive.buttons[1], "打开");
  assert.match(archive.detail, /自行解压并运行/);

  const executable = buildDesktopInstallConfirmation({
    installerKind: "portable-exe",
    fileName: "koboldcpp.exe"
  });
  assert.equal(executable.title, "打开安装包");
  assert.equal(executable.buttons[1], "打开");
  assert.match(executable.detail, /厂商安装程序中完成/);
});

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

test("a downloaded package shows only its path and install button", () => {
  assert.deepEqual(
    getProductInstallPresentation({
      stage: "downloaded",
      filePath: "D:\\AI Hub\\Claude-Setup-x64.exe"
    }),
    {
      filePath: "D:\\AI Hub\\Claude-Setup-x64.exe",
      buttonLabel: "点击安装",
      disabled: false,
      showHash: false,
      showTaskLog: false
    }
  );
});

test("a downloaded ZIP opens as an archive while installer artifacts keep install copy", () => {
  assert.equal(
    getProductInstallPresentation({
      stage: "downloaded",
      filePath: "D:\\AI Hub\\Msty.zip",
      artifactKind: "zip"
    }).buttonLabel,
    "点击打开压缩包"
  );
  assert.equal(
    getProductInstallPresentation({
      stage: "downloaded",
      filePath: "D:\\AI Hub\\Msty.exe",
      artifactKind: "exe"
    }).buttonLabel,
    "点击安装"
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
    "Install"
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

test("package management reuses product install stage and error state", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");
  const page = source.match(
    /function InstalledProductsPage\([\s\S]*?function SettingsPanel/
  )?.[0];
  assert.ok(page, "InstalledProductsPage source was not found");
  assert.match(
    page,
    /getProductInstallPresentation\(\{[\s\S]*?productStages\[entry\.id\][\s\S]*?disabled=\{installPresentation\?\.disabled\}/
  );
  assert.match(
    page,
    /productErrors\[entry\.id\][\s\S]*?runtimeMessage\(message\)/
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
