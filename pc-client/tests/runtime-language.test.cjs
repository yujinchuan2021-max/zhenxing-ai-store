"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  localizeRuntimeError,
  localizeRuntimePayload,
  runtimeText
} = require("../shared/runtime-language.cjs");

test("runtime copy is selected by stable code", () => {
  assert.equal(
    runtimeText("DOWNLOAD_CONNECTION_FAILED", "en"),
    "Download connection failed."
  );
  assert.equal(
    runtimeText("DOWNLOAD_CONNECTION_FAILED", "zh"),
    "下载连接失败"
  );
  assert.equal(
    runtimeText("WPM_CONFIRM", "zh", { action: "安装", name: "示例" }),
    "使用 Windows 程序包管理器安装示例？"
  );
  assert.equal(
    runtimeText("WPM_STATE_UNKNOWN", "en"),
    "The current Windows package state could not be verified."
  );
  assert.equal(
    runtimeText("WPM_STORE_CONFIRM", "zh", { name: "Copilot" }),
    "安装Copilot前，请先关闭 VPN 或代理"
  );
});

test("English IPC payloads never expose Chinese diagnostics", () => {
  assert.deepEqual(
    localizeRuntimePayload(
      {
        ok: false,
        errorCode: "DOWNLOADED_FILE_MISSING",
        error: "安装包已被移动",
        nested: { warning: "请在安装窗口确认" }
      },
      "en"
    ),
    {
      ok: false,
      errorCode: "DOWNLOADED_FILE_MISSING",
      error: "The local installer is missing. Download it again.",
      nested: {
        warning: "The operation needs confirmation. Check the product window."
      }
    }
  );
});

test("Chinese keeps useful runtime detail and non-Chinese detail is language neutral", () => {
  assert.equal(
    localizeRuntimePayload({ error: "签名不匹配" }, "zh").error,
    "签名不匹配"
  );
  assert.equal(
    localizeRuntimePayload({ error: "net::ERR_FAILED" }, "en").error,
    "net::ERR_FAILED"
  );
});

test("thrown IPC errors are normalized at the same language boundary", () => {
  const error = new Error("设备标识已经属于其他账号");
  error.code = "IDENTITY_CONFLICT";
  assert.equal(
    localizeRuntimeError(error, "en").message,
    "The operation failed. Try again later."
  );
});

test("system dialogs and notifications use the same runtime language boundary", () => {
  assert.deepEqual(
    localizeRuntimePayload(
      {
        title: "卸载 OpenClaw",
        detail: "只删除枕星AI助手 管理的文件",
        buttons: ["取消", "确认卸载"]
      },
      "en"
    ),
    {
      title: "ZhenXing AI Assistant",
      detail: "The operation status was updated.",
      buttons: ["Cancel", "Uninstall"]
    }
  );
});
