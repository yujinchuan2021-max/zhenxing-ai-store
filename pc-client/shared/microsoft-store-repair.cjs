"use strict";

const MICROSOFT_STORE_PACKAGE_NAME = "Microsoft.WindowsStore";
const MICROSOFT_STORE_PACKAGE_FAMILY_NAME =
  "Microsoft.WindowsStore_8wekyb3d8bbwe";
const MICROSOFT_STORE_WEB_URL = "https://apps.microsoft.com/";
const MICROSOFT_STORE_SUPPORT_URL =
  "https://support.microsoft.com/en-US/accounts-billing/microsoft-store-doesn-t-open";

function trustedMicrosoftStorePackage(entry) {
  return Boolean(
    entry &&
      entry.Name === MICROSOFT_STORE_PACKAGE_NAME &&
      entry.PackageFamilyName === MICROSOFT_STORE_PACKAGE_FAMILY_NAME &&
      typeof entry.Publisher === "string" &&
      /(?:^|,\s*)O=Microsoft Corporation(?:,|$)/i.test(entry.Publisher)
  );
}

function analyzeMicrosoftStoreHealth({
  scanOk = false,
  packages = [],
  endpointReachable = null
} = {}) {
  const storePackage = Array.isArray(packages)
    ? packages.find(trustedMicrosoftStorePackage) || null
    : null;
  return Object.freeze({
    scanOk: scanOk === true,
    storePresent: Boolean(storePackage),
    packageFamilyName: storePackage
      ? MICROSOFT_STORE_PACKAGE_FAMILY_NAME
      : "",
    version:
      storePackage && typeof storePackage.Version === "string"
        ? storePackage.Version
        : "",
    endpointReachable:
      endpointReachable === true
        ? true
        : endpointReachable === false
          ? false
          : null
  });
}

function buildMicrosoftStoreRepairDialog({ language = "zh", health } = {}) {
  const english = language === "en";
  const value = health || analyzeMicrosoftStoreHealth();
  const shared = {
    type: "warning",
    title: english ? "Microsoft Store repair" : "Microsoft Store 检测修复",
    defaultId: 0,
    cancelId: 0,
    noLink: true
  };

  if (value.scanOk && !value.storePresent) {
    return {
      options: {
        ...shared,
        message: english
          ? "Microsoft Store was not detected"
          : "未检测到 Microsoft Store 系统组件",
        detail: english
          ? "Use Windows Update first. If Store is still missing, follow Microsoft's official support page. ZhenXing AI will not register or replace system packages itself."
          : "请先运行 Windows 更新；若商店仍然缺失，再按微软官方帮助处理。枕星 AI 不会自行注册或替换系统组件。",
        buttons: english
          ? ["Close", "Open Windows Update", "Microsoft help"]
          : ["关闭", "打开 Windows 更新", "微软官方帮助"]
      },
      actions: ["close", "open-windows-update", "open-official-help"]
    };
  }

  if (value.endpointReachable === false) {
    return {
      options: {
        ...shared,
        message: english
          ? "Microsoft Store's web endpoint is not reachable"
          : "Microsoft Store 基础网络连接失败",
        detail: english
          ? "Check or turn off VPN/proxy, or switch networks and try again. ZhenXing AI will not change your VPN or proxy. You can still run Microsoft's wsreset.exe cache reset."
          : "请检查或关闭 VPN/代理，或切换网络后重试。枕星 AI 不会自动修改 VPN 或代理；你仍可运行微软的 wsreset.exe 重置商店缓存。",
        buttons: english
          ? ["Close", "Open proxy settings", "Reset Store cache"]
          : ["关闭", "打开代理设置", "重置商店缓存"]
      },
      actions: ["close", "open-proxy-settings", "reset-cache"]
    };
  }

  return {
    options: {
      ...shared,
      message: english
        ? value.storePresent
          ? "Basic Store checks passed"
          : "Store component status could not be confirmed"
        : value.storePresent
          ? "Microsoft Store 基础检测通过"
          : "暂时无法确认 Microsoft Store 组件状态",
      detail: english
        ? "This does not prove Store is working. Microsoft's first recovery step is wsreset.exe. If it still fails, open Store advanced options and choose Repair, then Reset if needed. Also check Windows Update, time, and region."
        : "基础检测通过不代表商店一定正常。按微软官方顺序先运行 wsreset.exe；若仍失败，打开商店高级选项，先选“修复”，无效后再选“重置”。同时检查 Windows 更新、时间和区域。",
      buttons: english
        ? ["Close", "Open repair settings", "Reset Store cache"]
        : ["关闭", "打开修复设置", "重置商店缓存"]
    },
    actions: ["close", "open-repair-settings", "reset-cache"]
  };
}

function microsoftStoreRepairSettingsUri(health) {
  return health?.packageFamilyName === MICROSOFT_STORE_PACKAGE_FAMILY_NAME
    ? `ms-settings:appsfeatures-app?${MICROSOFT_STORE_PACKAGE_FAMILY_NAME}`
    : "ms-settings:appsfeatures";
}

module.exports = {
  MICROSOFT_STORE_PACKAGE_FAMILY_NAME,
  MICROSOFT_STORE_SUPPORT_URL,
  MICROSOFT_STORE_WEB_URL,
  analyzeMicrosoftStoreHealth,
  buildMicrosoftStoreRepairDialog,
  microsoftStoreRepairSettingsUri,
  trustedMicrosoftStorePackage
};
