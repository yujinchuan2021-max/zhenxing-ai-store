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
  onProcessExit = null,
  verifyLaunch = async () => ({ ok: true }),
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
    (onProcessExit !== null && typeof onProcessExit !== "function") ||
    typeof verifyLaunch !== "function" ||
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
    let verificationStarted = false;
    let startedAtMs = 0;
    let cleanExitCode = null;
    let spawnWarning = "";

    const withWarning = (result) =>
      spawnWarning ? { ...result, warning: spawnWarning } : result;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child?.removeListener("error", onError);
      if (!onProcessExit) child?.removeListener("exit", onExit);
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
      if (onProcessExit) {
        try {
          Promise.resolve(
            onProcessExit({
              exitCode: Number.isInteger(exitCode) ? exitCode : null,
              signal: typeof signal === "string" ? signal : null
            })
          ).catch(() => {});
        } catch {
          // Process-exit observers are advisory and cannot change launch proof.
        }
      }
      if (exitCode === 0) {
        cleanExitCode = 0;
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

    const finishVerifiedLaunch = async () => {
      if (settled || verificationStarted) return;
      verificationStarted = true;
      let verification;
      try {
        verification = await verifyLaunch({
          command,
          args: [...args],
          startedAtMs
        });
      } catch (error) {
        spawnWarning = spawnWarning
          ? `${spawnWarning}；启动结果检查失败`
          : "启动结果检查失败";
      }
      if (verification?.ok === false) {
        finish({
          launched: false,
          exitCode: cleanExitCode,
          error:
            typeof verification.error === "string" && verification.error
              ? verification.error
              : `${processLabel}启动后未能保持运行`
        });
        return;
      }
      finish({
        launched: true,
        exitCode: cleanExitCode,
        error: ""
      });
    };

    try {
      startedAtMs = Date.now();
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
          void finishVerifiedLaunch();
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
