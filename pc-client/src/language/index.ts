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
    "settings.language.en": "English"
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
    "settings.language.en": "English"
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

export function setActiveLanguage(language: Language) {
  activeLanguage = language;
}

export function uiText(key: LanguageKey, variables: Variables = {}) {
  return createLanguage(activeLanguage).text(key, variables);
}
import {
  generatedChineseMessages
} from "./generated";
import { generatedEnglishMessages } from "./generated.en";
