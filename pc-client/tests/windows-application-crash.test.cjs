"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  applicationCrashMessage,
  normalizeApplicationCrash
} = require("../shared/windows-application-crash.cjs");

test("matches an exact post-launch Windows application crash", () => {
  const crash = normalizeApplicationCrash(
    {
      occurredAt: "2026-07-31T03:40:28.990Z",
      applicationName: "Comfy-Desktop-Setup-x64.exe",
      applicationPath: "D:\\文件\\Comfy-Desktop-Setup-x64.exe",
      moduleName: "System.dll",
      exceptionCode: "c0000005"
    },
    "D:\\文件\\Comfy-Desktop-Setup-x64.exe",
    Date.parse("2026-07-31T03:40:27.917Z")
  );

  assert.equal(crash.exceptionCode, "0xc0000005");
  assert.equal(
    applicationCrashMessage(crash),
    "安装程序启动后崩溃（0xc0000005）"
  );
});

test("rejects a crash for another path or before this launch", () => {
  const event = {
    occurredAt: "2026-07-31T03:40:20.000Z",
    applicationPath: "D:\\文件\\Other.exe",
    exceptionCode: "c0000005"
  };
  assert.equal(
    normalizeApplicationCrash(
      event,
      "D:\\文件\\Comfy-Desktop-Setup-x64.exe",
      Date.parse("2026-07-31T03:40:27.917Z")
    ),
    null
  );
});
