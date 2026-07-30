"use strict";

const { spawn } = require("node:child_process");

function formatExitCode(exitCode) {
  if (!Number.isInteger(exitCode)) return "未知";
  const unsigned = exitCode >>> 0;
  return unsigned > 255
    ? `0x${unsigned.toString(16).padStart(8, "0")}`
    : String(exitCode);
}

function launchProcessWithGrace({
  command,
  args = [],
  env,
  graceMs = 2_000,
  onSpawn = () => {},
  processLabel = "安装程序",
  spawnProcess = spawn
}) {
  if (
    typeof command !== "string" ||
    !command ||
    !Array.isArray(args) ||
    (env !== undefined && (!env || typeof env !== "object")) ||
    !Number.isSafeInteger(graceMs) ||
    graceMs < 1 ||
    typeof onSpawn !== "function" ||
    typeof processLabel !== "string" ||
    !processLabel.trim() ||
    typeof spawnProcess !== "function"
  ) {
    return Promise.resolve({
      launched: false,
      exitCode: null,
      error: `${processLabel || "程序"}启动参数无效`
    });
  }

  return new Promise((resolve) => {
    let child;
    let timer = null;
    let settled = false;
    let spawnWarning = "";

    const withWarning = (result) =>
      spawnWarning ? { ...result, warning: spawnWarning } : result;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child?.removeListener("error", onError);
      child?.removeListener("exit", onExit);
      child?.unref?.();
      resolve(withWarning(result));
    };

    const onError = (error) => {
      finish({
        launched: false,
        exitCode: null,
        error:
          error instanceof Error && error.message
            ? `Windows 无法启动${processLabel}：${error.message}`
            : `Windows 无法启动${processLabel}`
      });
    };

    const onExit = (exitCode, signal) => {
      if (exitCode === 0) {
        finish({ launched: true, exitCode: 0, error: "" });
        return;
      }
      finish({
        launched: false,
        exitCode: Number.isInteger(exitCode) ? exitCode : null,
        error: signal
          ? `${processLabel}启动后立即退出（信号 ${signal}）`
          : `${processLabel}启动后立即退出（代码 ${formatExitCode(exitCode)}）`
      });
    };

    try {
      child = spawnProcess(command, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
        shell: false,
        ...(env === undefined ? {} : { env })
      });
      child.once("error", onError);
      child.once("exit", onExit);
      child.once("spawn", () => {
        try {
          onSpawn();
        } catch (error) {
          spawnWarning =
            error instanceof Error && error.message
              ? `进程已经启动，但启动状态保存失败：${error.message}`
              : "进程已经启动，但启动状态保存失败";
        }
        timer = setTimeout(() => {
          finish({ launched: true, exitCode: null, error: "" });
        }, graceMs);
      });
    } catch (error) {
      onError(error);
    }
  });
}

module.exports = {
  formatExitCode,
  launchProcessWithGrace
};
