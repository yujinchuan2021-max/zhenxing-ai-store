"use strict";

const RUNTIME_MESSAGES = Object.freeze({
  zh: Object.freeze({
    OPERATION_FAILED: "操作失败，请稍后重试",
    OPERATION_WARNING: "操作需要进一步确认，请查看产品窗口",
    OPERATION_STATUS: "操作状态已更新",
    SYSTEM_TITLE: "枕星AI助手",
    SYSTEM_ACTION: "操作",
    TRAY_BACKGROUND: "枕星AI助手 · 后台运行",
    TRAY_TASKS: "枕星AI助手 · {count} 个任务进行中",
    TRAY_NONE: "当前没有进行中的任务",
    TRAY_OPEN_TASKS: "打开任务中心",
    TRAY_OPEN_HUB: "打开枕星AI助手",
    TRAY_EXIT: "完全退出",
    TASK_DOWNLOADING: "正在下载",
    TASK_PAUSING: "正在暂停",
    TASK_CANCELING: "正在取消",
    TASK_INSTALL_CHECK: "安装检测中",
    TASK_UNINSTALL_CHECK: "卸载检测中",
    TASK_DEPLOYING: "部署中",
    TASK_UNINSTALLING: "卸载中",
    DOWNLOAD_CONNECTION_FAILED: "下载连接失败",
    DOWNLOAD_FAILED: "安装包下载失败",
    DOWNLOADED_FILE_MISSING: "本地安装包不存在，请重新下载",
    CANCEL_CLEANUP_FAILED: "下载任务清理失败，请稍后重试",
    DOWNLOAD_ROLLBACK_FAILED: "下载恢复失败，请重新下载",
    DOWNLOAD_TASK_INTERNAL_ERROR: "下载任务异常，请重新下载",
    CATALOG_UNAVAILABLE: "厂商目录暂时不可用",
    WPM_INSTALL: "安装",
    WPM_REINSTALL: "重新安装",
    WPM_UPDATE: "更新",
    WPM_CANCEL: "取消",
    WPM_CONFIRM: "使用 Windows 程序包管理器{action}{name}？",
    WPM_CONFIRM_DETAIL: "厂商安装器可能要求确认许可协议、安装选项或 UAC。",
    WPM_STORE_CONFIRM: "安装{name}前，请先关闭 VPN 或代理",
    WPM_STORE_CONFIRM_DETAIL: "该产品由 Microsoft Store 安装。若商店仍无法打开，可先运行检测修复。",
    WPM_STORE_REPAIR: "仍打不开，检测修复",
    WPM_STORE_CONTINUE: "我已关闭，继续",
    WPM_UNAVAILABLE: "Windows 应用安装程序（winget）不可用",
    WPM_INVENTORY_FAILED: "无法读取 Windows 软件包清单",
    WPM_NOT_APPROVED: "该产品不在客户端软件包白名单中",
    WPM_ACTION_DENIED: "该软件包操作未获客户端批准",
    WPM_BUSY: "该产品正在处理，请勿重复点击",
    WPM_STATE_UNKNOWN: "暂时无法确认 Windows 软件包状态",
    WPM_CATALOG_MISMATCH: "当前目录与客户端软件包配置不一致",
    WPM_INSTALL_NOT_VERIFIED: "安装器已结束，但无法确认安装结果",
    WPM_INSTALL_NO_RECORD: "安装器已结束，但未发现安装记录",
    WPM_OPERATION_FAILED: "Windows 软件包操作失败",
    WPM_NOT_INSTALLED: "未检测到该产品",
    WPM_UNINSTALL_FINISHED: "卸载流程已结束",
    WPM_STILL_INSTALLED: "仍检测到该产品；请完成厂商卸载窗口后再次检测",
    WPM_UNINSTALL_FAILED: "Windows 软件包卸载失败",
    WPM_SYSTEM_PANEL_OPENED: "已打开 Windows 已安装的应用，请在系统面板中手动卸载",
    WPM_RECEIPT_CHANGED: "安装收据已变化，已停止自动卸载"
  }),
  en: Object.freeze({
    OPERATION_FAILED: "The operation failed. Try again later.",
    OPERATION_WARNING: "The operation needs confirmation. Check the product window.",
    OPERATION_STATUS: "The operation status was updated.",
    SYSTEM_TITLE: "ZhenXing AI Assistant",
    SYSTEM_ACTION: "Action",
    TRAY_BACKGROUND: "ZhenXing AI Assistant · Running in background",
    TRAY_TASKS: "ZhenXing AI Assistant · {count} active task(s)",
    TRAY_NONE: "No active tasks",
    TRAY_OPEN_TASKS: "Open task center",
    TRAY_OPEN_HUB: "Open ZhenXing AI Assistant",
    TRAY_EXIT: "Quit",
    TASK_DOWNLOADING: "Downloading",
    TASK_PAUSING: "Pausing",
    TASK_CANCELING: "Canceling",
    TASK_INSTALL_CHECK: "Checking installation",
    TASK_UNINSTALL_CHECK: "Checking uninstallation",
    TASK_DEPLOYING: "Deploying",
    TASK_UNINSTALLING: "Uninstalling",
    DOWNLOAD_CONNECTION_FAILED: "Download connection failed.",
    DOWNLOAD_FAILED: "The installer could not be downloaded.",
    DOWNLOADED_FILE_MISSING: "The local installer is missing. Download it again.",
    CANCEL_CLEANUP_FAILED: "The download task could not be cleaned up. Try again.",
    DOWNLOAD_ROLLBACK_FAILED: "The download could not be resumed. Download it again.",
    DOWNLOAD_TASK_INTERNAL_ERROR: "The download task failed. Download it again.",
    CATALOG_UNAVAILABLE: "The vendor catalog is temporarily unavailable.",
    WPM_INSTALL: "Install",
    WPM_REINSTALL: "Reinstall",
    WPM_UPDATE: "Update",
    WPM_CANCEL: "Cancel",
    WPM_CONFIRM: "{action} {name} with Windows Package Manager?",
    WPM_CONFIRM_DETAIL: "The vendor installer may ask you to accept its license, choose options, or approve UAC.",
    WPM_STORE_CONFIRM: "Turn off VPN or proxy before continuing with {name}.",
    WPM_STORE_CONFIRM_DETAIL: "This product is installed through Microsoft Store. If Store still will not open, run the repair check first.",
    WPM_STORE_REPAIR: "Still not opening? Repair",
    WPM_STORE_CONTINUE: "I turned it off, continue",
    WPM_UNAVAILABLE: "Windows App Installer (winget) is unavailable.",
    WPM_INVENTORY_FAILED: "The Windows package inventory could not be read.",
    WPM_NOT_APPROVED: "This product is not in the client package allowlist.",
    WPM_ACTION_DENIED: "This package operation is not approved by the client.",
    WPM_BUSY: "This product is already being processed.",
    WPM_STATE_UNKNOWN: "The current Windows package state could not be verified.",
    WPM_CATALOG_MISMATCH: "The active catalog does not match the client package profile.",
    WPM_INSTALL_NOT_VERIFIED: "The installer finished, but the installed state could not be verified.",
    WPM_INSTALL_NO_RECORD: "The installer finished without an installed package record.",
    WPM_OPERATION_FAILED: "The Windows package operation failed.",
    WPM_NOT_INSTALLED: "The product is not installed.",
    WPM_UNINSTALL_FINISHED: "The uninstall process finished.",
    WPM_STILL_INSTALLED: "The product is still detected. Finish any vendor uninstall window and check again.",
    WPM_UNINSTALL_FAILED: "Windows could not uninstall the package.",
    WPM_SYSTEM_PANEL_OPENED: "Windows Installed apps is open. Uninstall this externally managed product from the system panel.",
    WPM_RECEIPT_CHANGED: "The install receipt changed, so automatic uninstall was stopped."
  })
});

const USER_MESSAGE_FIELDS = new Set([
  "error",
  "errorMessage",
  "lastError",
  "message",
  "warning",
  "summary",
  "setupDetail",
  "title",
  "body",
  "detail",
  "label"
]);

const ENGLISH_BUTTONS = Object.freeze({
  "取消": "Cancel",
  "关闭": "Close",
  "确定": "OK",
  "继续": "Continue",
  "立即安装": "Install now",
  "重新下载": "Download again",
  "确认安装": "Install",
  "确认卸载": "Uninstall",
  "打开安装包": "Open installer",
  "保留文件": "Keep files",
  "删除": "Delete"
});

function normalizeLanguage(value) {
  return value === "en" ? "en" : "zh";
}

function runtimeText(code, language = "zh", parameters = {}) {
  const locale = normalizeLanguage(language);
  const key = Object.hasOwn(RUNTIME_MESSAGES[locale], code)
    ? code
    : "OPERATION_FAILED";
  return RUNTIME_MESSAGES[locale][key].replace(
    /\{([a-zA-Z0-9_]+)\}/g,
    (match, name) =>
      Object.hasOwn(parameters, name) ? String(parameters[name]) : match
  );
}

function fallbackCodeForField(field) {
  if (field === "title") return "SYSTEM_TITLE";
  if (field === "label") return "SYSTEM_ACTION";
  if (field === "warning") return "OPERATION_WARNING";
  if (
    field === "message" ||
    field === "summary" ||
    field === "setupDetail" ||
    field === "body" ||
    field === "detail"
  ) {
    return "OPERATION_STATUS";
  }
  return "OPERATION_FAILED";
}

function localizedUserMessage(value, { language, code, field }) {
  if (typeof value !== "string" || !value) return value;
  if (normalizeLanguage(language) === "zh" || !/\p{Script=Han}/u.test(value)) {
    return value;
  }
  return runtimeText(
    typeof code === "string" && code ? code : fallbackCodeForField(field),
    language
  );
}

function localizeRuntimePayload(value, language = "zh", depth = 0) {
  if (depth > 12 || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((entry) =>
      localizeRuntimePayload(entry, language, depth + 1)
    );
  }
  if (typeof value !== "object") return value;
  const code =
    typeof value.errorCode === "string"
      ? value.errorCode
      : typeof value.code === "string"
        ? value.code
        : "";
  return Object.fromEntries(
    Object.entries(value).map(([field, entry]) => [
      field,
      field === "buttons" &&
      normalizeLanguage(language) === "en" &&
      Array.isArray(entry)
        ? entry.map((button) => {
            if (typeof button !== "string" || !/\p{Script=Han}/u.test(button)) {
              return button;
            }
            return ENGLISH_BUTTONS[button] || "Confirm";
          })
        : USER_MESSAGE_FIELDS.has(field)
        ? localizedUserMessage(entry, { language, code, field })
        : localizeRuntimePayload(entry, language, depth + 1)
    ])
  );
}

function localizeRuntimeError(error, language = "zh") {
  const original = error instanceof Error ? error : new Error(String(error));
  const message = localizedUserMessage(original.message, {
    language,
    code: original.code,
    field: "error"
  });
  if (message === original.message) return original;
  const localized = new Error(message);
  localized.name = original.name;
  if (typeof original.code === "string") localized.code = original.code;
  return localized;
}

module.exports = {
  RUNTIME_MESSAGES,
  localizeRuntimeError,
  localizeRuntimePayload,
  localizedUserMessage,
  normalizeLanguage,
  runtimeText
};
