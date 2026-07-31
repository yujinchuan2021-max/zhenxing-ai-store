"use strict";

function normalizeWindowsPath(value) {
  return String(value || "")
    .replace(/\//g, "\\")
    .toLowerCase();
}

function normalizeApplicationCrash(value, expectedPath, notBeforeMs) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof expectedPath !== "string" ||
    !expectedPath ||
    !Number.isFinite(notBeforeMs)
  ) {
    return null;
  }
  const occurredAtMs = Date.parse(String(value.occurredAt || ""));
  if (
    !Number.isFinite(occurredAtMs) ||
    occurredAtMs < notBeforeMs ||
    normalizeWindowsPath(value.applicationPath) !==
      normalizeWindowsPath(expectedPath)
  ) {
    return null;
  }
  const exceptionCode = String(value.exceptionCode || "")
    .replace(/^0x/i, "")
    .toLowerCase();
  return {
    occurredAt: new Date(occurredAtMs).toISOString(),
    applicationName: String(value.applicationName || ""),
    applicationPath: expectedPath,
    moduleName: String(value.moduleName || ""),
    exceptionCode: exceptionCode ? `0x${exceptionCode}` : ""
  };
}

function applicationCrashMessage(crash, processLabel = "安装程序") {
  if (!crash) return "";
  const code = crash.exceptionCode ? `（${crash.exceptionCode}）` : "";
  return `${processLabel}启动后崩溃${code}`;
}

module.exports = {
  applicationCrashMessage,
  normalizeApplicationCrash
};
