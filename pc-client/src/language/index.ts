export type Language = "zh" | "en";

type Variables = Record<string, string | number>;

const messages = {
  zh: {
    "nav.home": "主页",
    "nav.vendors": "全部厂商",
    "nav.community": "社区",
    "nav.navigation": "导航",
    "nav.searchPlaceholder": "精准搜索厂商或者产品",
    "nav.search": "搜索",
    "nav.settings": "设置",
    "nav.login": "登录",
    "community.refresh": "刷新",
    "community.discussionListHint": "全部讨论",
    "community.discussionListHintTitle": "移到这里查看全部讨论",
    "community.loading": "正在进入社区…",
    "community.unavailable": "社区暂时不可用",
    "community.loadFailed": "社区加载失败",
    "community.pageFailed": "社区页面加载失败",
    "community.title": "AI Hub 社区",
    "community.loginHint": "使用 PC 端用户登录后，社区会直接显示在这里。",
    "community.loginAction": "登录后进入社区",
    "community.provider": "FLARUM · 开源社区",
    "community.legacyTitle": "AI HUB 社区",
    "chrome.pc": "PC",
    "chrome.ai": "AI",
    "chrome.hubPc": "HUB PC",
    "settings.language": "语言",
    "settings.language.zh": "中文",
    "settings.language.en": "English",
    "brand.defaultSlogan": "一个地方，找到并安装你的 AI 工具",
    "extensions.directory": "Skill 与 MCP",
    "extensions.skill": "Skill",
    "extensions.mcp": "MCP",
    "extensions.openWebsite": "查看官方页面",
    "extensions.checking": "检测中",
    "extensions.install": "一键安装",
    "extensions.installing": "正在安装",
    "extensions.uninstall": "卸载",
    "extensions.uninstalling": "正在卸载",
    "extensions.cleanup": "清理记录",
    "extensions.installed": "已安装",
    "extensions.notInstalled": "未安装",
    "extensions.external": "目标位置已有内容",
    "extensions.stale": "安装记录待清理",
    "extensions.unavailable": "扩展安装资源不可用",
    "extensions.failed": "扩展操作失败，请稍后重试",
    "wsl.directory": "WSL 子目录 · {count}",
    "wsl.distribution": "Linux 发行版",
    "wsl.noManagedEnvironment": "暂无 AI Hub 管理的内部环境",
    "wsl.repair": "安装",
    "products.components": "运行组件 · {count}",
    "desktop.installCanceled": "安装已取消",
    "desktop.installFailed": "安装失败",
    "desktop.uninstallFailed": "卸载失败",
    "desktop.getLatestInstaller": "获取最新版",
    "desktop.updateManagedByStore": "更新由 Microsoft Store 管理",
    "desktop.updateManagedByVendor": "更新由厂商应用管理",
    "desktop.comfyLegacyMigration": "检测到旧版 ComfyUI Desktop V1。它不是当前 Comfy Desktop；请先在 Windows 已安装的应用中移除旧版，再安装当前版本。",
    "download.connectionFailed": "下载连接失败",
    "download.retry": "重新下载",
    "runtime.operationFailed": "操作失败，请稍后重试",
    "runtime.downloadFailed": "安装包下载失败",
    "runtime.downloadFileMissing": "本地安装包不存在，请重新下载",
    "runtime.downloadCleanupFailed": "下载任务清理失败，请稍后重试",
    "runtime.downloadRollbackFailed": "下载恢复失败，请重新下载",
    "runtime.downloadInternalError": "下载任务异常，请重新下载",
    "runtime.catalogFailed": "厂商目录暂时不可用",
    "home.vendorDirectoryDescription": "按 A–Z 和工具特性筛选厂商，进入厂商页后统一查看产品、官网与使用教程。",
    "home.vendorDirectoryAction": "进入厂商目录",
    "home.primaryBannerEyebrow": "AI HUB · PC",
    "home.primaryBannerTitle": "一个地方，找到并安装你的 AI 工具",
    "home.primaryBannerDescription": "从厂商进入，查看桌面端、CLI 与其他产品；只有点击安装后才进行环境检测。",
    "home.primaryBannerAction": "查看全部厂商",
    "home.vendorBannerEyebrow": "厂商优先",
    "home.vendorBannerTitle": "先选厂商，再看它旗下的全部产品",
    "catalog.unavailableTitle": "厂商目录暂不可用",
    "catalog.unavailableDescription": "未能连接后台，也没有可用的已验证目录缓存。请稍后重试。"
  },
  en: {
    "nav.home": "Home",
    "nav.vendors": "All vendors",
    "nav.community": "Community",
    "nav.navigation": "Navigation",
    "nav.searchPlaceholder": "Search vendors or products",
    "nav.search": "Search",
    "nav.settings": "Settings",
    "nav.login": "Sign in",
    "community.refresh": "Refresh",
    "community.discussionListHint": "Discussions",
    "community.discussionListHintTitle": "Move here to view all discussions",
    "community.loading": "Opening community…",
    "community.unavailable": "Community is temporarily unavailable",
    "community.loadFailed": "Could not load the community",
    "community.pageFailed": "Could not load the community page",
    "community.title": "AI Hub Community",
    "community.loginHint": "Sign in with your PC account to open the community here.",
    "community.loginAction": "Sign in to community",
    "community.provider": "FLARUM · OPEN SOURCE",
    "community.legacyTitle": "AI HUB COMMUNITY",
    "chrome.pc": "PC",
    "chrome.ai": "AI",
    "chrome.hubPc": "HUB PC",
    "settings.language": "Language",
    "settings.language.zh": "中文",
    "settings.language.en": "English",
    "brand.defaultSlogan": "Find and install your AI tools in one place",
    "extensions.directory": "Skills and MCP",
    "extensions.skill": "Skill",
    "extensions.mcp": "MCP",
    "extensions.openWebsite": "Official page",
    "extensions.checking": "Checking",
    "extensions.install": "Install",
    "extensions.installing": "Installing",
    "extensions.uninstall": "Uninstall",
    "extensions.uninstalling": "Uninstalling",
    "extensions.cleanup": "Clean up record",
    "extensions.installed": "Installed",
    "extensions.notInstalled": "Not installed",
    "extensions.external": "The target already contains files",
    "extensions.stale": "Installation record needs cleanup",
    "extensions.unavailable": "Extension resources are unavailable",
    "extensions.failed": "Extension operation failed. Try again later.",
    "wsl.directory": "WSL directory · {count}",
    "wsl.distribution": "Linux distribution",
    "wsl.noManagedEnvironment": "No internal environment is managed by AI Hub",
    "wsl.repair": "Install",
    "products.components": "Runtime components · {count}",
    "desktop.installCanceled": "Installation canceled",
    "desktop.installFailed": "Installation failed",
    "desktop.uninstallFailed": "Uninstallation failed",
    "desktop.getLatestInstaller": "Get latest installer",
    "desktop.updateManagedByStore": "Updates are managed by Microsoft Store",
    "desktop.updateManagedByVendor": "Updates are managed by the vendor app",
    "desktop.comfyLegacyMigration": "ComfyUI Desktop V1 was detected. It is not the current Comfy Desktop; remove the legacy app in Windows Installed apps before installing the current version.",
    "download.connectionFailed": "Download connection failed",
    "download.retry": "Download again",
    "runtime.operationFailed": "The operation failed. Try again later.",
    "runtime.downloadFailed": "The installer could not be downloaded.",
    "runtime.downloadFileMissing": "The local installer is missing. Download it again.",
    "runtime.downloadCleanupFailed": "The download task could not be cleaned up. Try again.",
    "runtime.downloadRollbackFailed": "The download could not be resumed. Download it again.",
    "runtime.downloadInternalError": "The download task failed. Download it again.",
    "runtime.catalogFailed": "The vendor catalog is temporarily unavailable.",
    "home.vendorDirectoryDescription": "Filter vendors by A–Z and product capability, then view their products, official sites, and tutorials together.",
    "home.vendorDirectoryAction": "Open vendor directory",
    "home.primaryBannerEyebrow": "AI HUB · PC",
    "home.primaryBannerTitle": "Find and install your AI tools in one place",
    "home.primaryBannerDescription": "Choose a vendor to view its desktop, CLI, and other products. Environment checks start only after you click install.",
    "home.primaryBannerAction": "View all vendors",
    "home.vendorBannerEyebrow": "Vendor first",
    "home.vendorBannerTitle": "Choose a vendor, then view all of its products",
    "catalog.unavailableTitle": "Vendor directory unavailable",
    "catalog.unavailableDescription": "The backend could not be reached and no verified catalog cache is available. Try again later."
  }
} as const;

export type LanguageKey =
  | keyof typeof messages.zh
  | keyof typeof generatedChineseMessages;

export const COMMUNITY_LOCALES: Record<Language, string> = {
  zh: "zh-Hans",
  en: "en"
};

export function normalizeLanguage(value: unknown): Language {
  return value === "en" ? "en" : "zh";
}

export function createLanguage(language: Language) {
  const selected = messages[language];
  return {
    id: language,
    documentLocale: language === "zh" ? "zh-CN" : "en",
    communityLocale: COMMUNITY_LOCALES[language],
    text(key: LanguageKey, variables: Variables = {}) {
      const template =
        (selected as Partial<Record<LanguageKey, string>>)[key] ||
        (messages.zh as Partial<Record<LanguageKey, string>>)[key] ||
        (language === "en" ? generatedEnglishMessages[key as keyof typeof generatedChineseMessages] : "") ||
        generatedChineseMessages[key as keyof typeof generatedChineseMessages] ||
        key;
      return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name) =>
        Object.prototype.hasOwnProperty.call(variables, name)
          ? String(variables[name])
          : `{${name}}`
      );
    }
  };
}

let activeLanguage: Language = "zh";

const runtimeErrorKeys: Record<string, LanguageKey> = {
  DOWNLOAD_CONNECTION_FAILED: "download.connectionFailed",
  DOWNLOAD_FAILED: "runtime.downloadFailed",
  DOWNLOADED_FILE_MISSING: "runtime.downloadFileMissing",
  CANCEL_CLEANUP_FAILED: "runtime.downloadCleanupFailed",
  DOWNLOAD_ROLLBACK_FAILED: "runtime.downloadRollbackFailed",
  DOWNLOAD_TASK_INTERNAL_ERROR: "runtime.downloadInternalError",
  CATALOG_UNAVAILABLE: "runtime.catalogFailed"
};

export function setActiveLanguage(language: Language) {
  activeLanguage = language;
}

export function uiText(key: LanguageKey, variables: Variables = {}) {
  return createLanguage(activeLanguage).text(key, variables);
}

export function runtimeMessage(
  value: unknown,
  errorCode?: unknown,
  fallback: LanguageKey = "runtime.operationFailed"
) {
  const code = typeof errorCode === "string" ? errorCode : "";
  const key = runtimeErrorKeys[code] || fallback;
  const detail = typeof value === "string" ? value.trim() : "";
  if (!detail) return uiText(key);
  // Main/shared modules may retain technical diagnostics in Chinese. They are
  // never used as English UI copy; stable codes select copy from this module.
  if (activeLanguage === "en" && /\p{Script=Han}/u.test(detail)) {
    return uiText(key);
  }
  return detail;
}
import {
  generatedChineseMessages
} from "./generated";
import { generatedEnglishMessages } from "./generated.en";
