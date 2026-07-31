"use strict";

const SAFE_EXTENSION_ERRORS = Object.freeze({
  EXTENSION_PROFILE_NOT_APPROVED: "该扩展尚未通过当前客户端审核",
  EXTENSION_TARGET_EXISTS: "目标位置已有内容，AI Hub 未进行覆盖",
  EXTENSION_ALREADY_MANAGED: "该扩展已有本地安装记录",
  EXTENSION_RECEIPT_INVALID: "本地安装记录异常，未执行文件操作",
  EXTENSION_OWNED_PATH_UNSAFE: "扩展目录状态异常，未执行卸载",
  EXTENSION_SYMLINK_REJECTED: "扩展目录包含不安全的链接，操作已停止",
  EXTENSION_SOURCE_MISSING: "扩展安装资源缺失，请更新 AI Hub 后重试",
  EXTENSION_SOURCE_INVALID: "扩展安装资源无效，请更新 AI Hub 后重试",
  EXTENSION_SOURCE_OUTSIDE_ROOT: "扩展安装资源未通过安全检查",
  EXTENSION_FILE_TYPE_REJECTED: "扩展安装资源包含不支持的文件",
  EXTENSION_PATH_INVALID: "扩展安装路径未通过安全检查",
  EXTENSION_PATH_OUTSIDE_ROOT: "扩展安装路径未通过安全检查",
  EXTENSION_ROOT_INVALID: "扩展安装目录配置无效",
  EXTENSION_ROOT_UNAVAILABLE: "扩展宿主目录不可用",
  EXTENSION_ROOT_UNSAFE: "扩展宿主目录未通过安全检查",
  EXTENSION_CODEX_HOME_INVALID: "Codex 扩展目录配置无效"
});

const SAFE_STATUS_STATES = new Set([
  "not-installed",
  "external",
  "stale",
  "unsafe",
  "installed",
  "invalid-receipt"
]);

function safeExtensionError(error) {
  return (
    SAFE_EXTENSION_ERRORS[error?.code] ||
    "扩展操作失败，请稍后重试"
  );
}

function unavailableResult() {
  return {
    ok: false,
    state: "unavailable",
    managed: false,
    error: "扩展安装资源不可用，请更新 AI Hub 后重试"
  };
}

function failedResult(error) {
  return {
    ok: false,
    state: "error",
    managed: false,
    error: safeExtensionError(error)
  };
}

function sanitizeStatus(status) {
  if (!status || !SAFE_STATUS_STATES.has(status.state)) {
    return failedResult();
  }
  return {
    ok: true,
    state: status.state,
    managed: status.managed === true
  };
}

function createExtensionIpcFacade(runtime) {
  return Object.freeze({
    status(profileId) {
      if (!runtime) return unavailableResult();
      try {
        return sanitizeStatus(runtime.getStatus(profileId));
      } catch (error) {
        return failedResult(error);
      }
    },
    install(profileId) {
      if (!runtime) return unavailableResult();
      try {
        runtime.install(profileId);
        return sanitizeStatus(runtime.getStatus(profileId));
      } catch (error) {
        return failedResult(error);
      }
    },
    uninstall(profileId) {
      if (!runtime) return unavailableResult();
      try {
        runtime.uninstall(profileId);
        return sanitizeStatus(runtime.getStatus(profileId));
      } catch (error) {
        return failedResult(error);
      }
    }
  });
}

module.exports = {
  createExtensionIpcFacade,
  safeExtensionError
};
