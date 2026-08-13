"use strict";

const SAFE_EXTENSION_ERRORS = Object.freeze({
  EXTENSION_PROFILE_NOT_APPROVED: "该资源尚未通过当前客户端审核",
  EXTENSION_ADAPTER_UNAVAILABLE: "当前客户端不支持该资源的安装方式",
  EXTENSION_ACTION_NOT_APPROVED: "当前客户端不允许执行该操作",
  EXTENSION_ACTION_UNAVAILABLE: "当前状态下不能执行该操作，请先重新检测",
  EXTENSION_BUSY: "该资源正在执行其他操作",
  EXTENSION_TARGET_EXISTS: "目标位置已有内容，枕星 AI 不会覆盖或接管",
  EXTENSION_RECEIPT_INVALID: "本地安装记录异常，未执行任何修改",
  EXTENSION_OWNED_PATH_UNSAFE: "资源目录状态异常，未执行卸载",
  EXTENSION_SYMLINK_REJECTED: "资源目录包含不安全链接，操作已停止",
  EXTENSION_SOURCE_MISSING: "扩展安装资源缺失，请更新枕星 AI 后重试",
  EXTENSION_SOURCE_INVALID: "扩展安装资源无效，请更新枕星 AI 后重试",
  EXTENSION_SOURCE_MANIFEST_MISMATCH: "扩展安装资源校验失败，请更新枕星 AI 后重试",
  EXTENSION_SOURCE_OUTSIDE_ROOT: "扩展安装资源未通过安全检查",
  EXTENSION_FILE_TYPE_REJECTED: "扩展安装资源包含不支持的文件",
  EXTENSION_PATH_INVALID: "扩展安装路径未通过安全检查",
  EXTENSION_PATH_OUTSIDE_ROOT: "扩展安装路径未通过安全检查",
  EXTENSION_ROOT_INVALID: "扩展安装目录配置无效",
  EXTENSION_ROOT_UNAVAILABLE: "扩展宿主目录不可用",
  EXTENSION_ROOT_UNSAFE: "扩展宿主目录未通过安全检查",
  EXTENSION_CODEX_HOME_INVALID: "Codex 配置目录无效",
  EXTENSION_HOST_MISSING: "请先安装对应的 AI 工具",
  EXTENSION_HOST_COMMAND_FAILED: "宿主工具执行失败，请稍后重试",
  EXTENSION_HOST_RESPONSE_INVALID: "宿主工具返回了无法识别的状态",
  EXTENSION_POSTCONDITION_FAILED: "操作已结束，但未能确认最终状态",
  EXTENSION_TARGET_MODIFIED: "资源内容已被修改，为保护用户数据已停止操作",
  EXTENSION_CONTENT_MODIFIED: "资源配置已被修改，为保护用户配置已停止操作",
  EXTENSION_CONFIG_CHANGED: "宿主配置刚刚发生变化，请重新检测后再试",
  EXTENSION_CATALOG_AUTHORIZATION_FAILED: "当前资源目录授权失败，请刷新目录后重试",
  ACTIVE_RESOURCE_CATALOG_UNAVAILABLE: "暂时无法取得最新资源目录，请稍后重试",
  CATALOG_RESOURCE_DISABLED: "该资源已由后台停用",
  CATALOG_RESOURCE_TARGET_DISABLED: "该资源的当前目标已由后台停用",
  CATALOG_RESOURCE_CAPABILITY_DISABLED: "该操作已由后台停用"
});

const SAFE_STATUS_STATES = new Set([
  "not-installed",
  "external",
  "stale",
  "unsafe",
  "modified",
  "installed",
  "disabled",
  "outdated",
  "host-missing",
  "invalid-receipt"
]);
const SAFE_ACTIONS = new Set([
  "install",
  "update",
  "repair",
  "enable",
  "disable",
  "uninstall"
]);
const SAFE_INVENTORY_MODULES = Object.freeze({
  "skill-managed": "skill",
  "mcp-managed": "mcp",
  "plugin-managed": "plugin"
});
const SAFE_PROFILE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SAFE_INVENTORY_ANOMALIES = new Set([
  "stale",
  "unsafe",
  "modified",
  "invalid-receipt",
  "unavailable",
  "error"
]);

function safeExtensionError(error) {
  return SAFE_EXTENSION_ERRORS[error?.code] || "扩展操作失败，请稍后重试";
}

function unavailableResult() {
  return {
    ok: false,
    state: "unavailable",
    managed: false,
    allowedActions: [],
    error: "扩展安装资源不可用，请更新枕星 AI 后重试"
  };
}

function failedResult(error) {
  return {
    ok: false,
    state: "error",
    managed: false,
    allowedActions: [],
    error: safeExtensionError(error)
  };
}

function sanitizeStatus(status) {
  if (!status || !SAFE_STATUS_STATES.has(status.state)) return failedResult();
  return {
    ok: true,
    state: status.state,
    managed: status.managed === true,
    ...(typeof status.enabled === "boolean" ? { enabled: status.enabled } : {}),
    ...(typeof status.hostInstalled === "boolean"
      ? { hostInstalled: status.hostInstalled }
      : {}),
    ...(["installed", "absent", "unknown"].includes(status.hostDetection)
      ? { hostDetection: status.hostDetection }
      : {}),
    allowedActions: Array.isArray(status.allowedActions)
      ? status.allowedActions.filter((action) => SAFE_ACTIONS.has(action))
      : []
  };
}

function safeInventoryProfile(profile) {
  const resourceType = SAFE_INVENTORY_MODULES[profile?.moduleId];
  if (
    !SAFE_PROFILE_ID.test(profile?.id || "") ||
    typeof profile?.label !== "string" ||
    !profile.label ||
    !resourceType ||
    !SAFE_PROFILE_ID.test(profile?.hostProductId || "")
  ) {
    return null;
  }
  return {
    profileId: profile.id,
    label: profile.label,
    resourceType,
    hostProductId: profile.hostProductId
  };
}

function createExtensionIpcFacade(manager, { listProfiles = () => [] } = {}) {
  async function inspect(profileId) {
    if (!manager) return unavailableResult();
    try {
      return sanitizeStatus(await manager.inspect(profileId));
    } catch (error) {
      return failedResult(error);
    }
  }

  async function execute(profileId, action) {
    if (!manager) return unavailableResult();
    try {
      return sanitizeStatus(await manager.execute(profileId, action));
    } catch (error) {
      return failedResult(error);
    }
  }

  async function list() {
    let profiles;
    try {
      profiles = listProfiles();
    } catch {
      return [];
    }
    if (!Array.isArray(profiles)) return [];
    const unique = new Map();
    for (const profile of profiles) {
      const safeProfile = safeInventoryProfile(profile);
      if (safeProfile) unique.set(safeProfile.profileId, safeProfile);
    }
    const entries = await Promise.all(
      [...unique.values()].map(async (profile) => {
        const status = await inspect(profile.profileId);
        if (
          !status.managed &&
          !SAFE_INVENTORY_ANOMALIES.has(status.state)
        ) {
          return null;
        }
        return { ...profile, ...status };
      })
    );
    return entries.filter(Boolean);
  }

  return Object.freeze({
    list,
    inspect,
    execute,
    status: inspect,
    install: (profileId) => execute(profileId, "install"),
    uninstall: (profileId) => execute(profileId, "uninstall")
  });
}

module.exports = {
  createExtensionIpcFacade,
  safeExtensionError,
  sanitizeStatus
};
