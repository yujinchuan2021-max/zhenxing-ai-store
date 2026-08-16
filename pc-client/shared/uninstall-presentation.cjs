"use strict";

const { getDesktopLifecycle } = require("./desktop-lifecycle.cjs");

const UNINSTALL_MODES = Object.freeze(["automatic", "interactive"]);

const UNINSTALL_PRESENTATIONS = Object.freeze({
  zh: Object.freeze({
    automatic: Object.freeze({
      preparingTitle: "正在准备自动卸载",
      preparing: "正在验证并启动自动卸载",
      activeTitle: "正在自动卸载",
      activeDetail: "枕星AI助手 正在确认产品是否已移除。",
      timedOut:
        "暂未确认卸载完成。自动卸载可能仍在运行，请稍后点击“立即检测”。",
      stillInstalled: "自动卸载尚未完成，请稍后再次检测。",
      launched: "已启动自动卸载，枕星AI助手 正在确认卸载结果。"
    }),
    interactive: Object.freeze({
      preparingTitle: "正在验证卸载程序",
      preparing: "正在验证并调起厂商卸载面板",
      activeTitle: "已调起厂商卸载面板",
      activeDetail:
        "请在卸载面板中手动完成，枕星AI助手 将自动确认结果。",
      timedOut:
        "暂未确认卸载完成。请在卸载面板中完成后点击“立即检测”。",
      stillInstalled: "仍检测到该产品，请先在厂商卸载面板中完成卸载。",
      launched: "已调起厂商卸载面板，请手动完成卸载。"
    })
  }),
  en: Object.freeze({
    automatic: Object.freeze({
      preparingTitle: "Preparing automatic uninstall",
      preparing: "Verifying and starting automatic uninstall",
      activeTitle: "Uninstalling automatically",
      activeDetail: "ZhenXing AI Assistant is confirming whether the product has been removed.",
      timedOut:
        "Uninstall is not confirmed yet. It may still be running; check again shortly.",
      stillInstalled: "Automatic uninstall is not complete. Check again shortly.",
      launched:
        "Automatic uninstall started. ZhenXing AI Assistant is confirming the result."
    }),
    interactive: Object.freeze({
      preparingTitle: "Verifying uninstaller",
      preparing: "Verifying and opening the vendor uninstaller",
      activeTitle: "Vendor uninstaller opened",
      activeDetail:
        "Finish the uninstall manually in the vendor panel. ZhenXing AI Assistant will confirm the result.",
      timedOut:
        "Uninstall is not confirmed yet. Finish it in the vendor panel, then check again.",
      stillInstalled:
        "The product is still detected. Finish uninstalling it in the vendor panel.",
      launched: "The vendor uninstaller opened. Finish the uninstall manually."
    })
  })
});

function normalizeUninstallMode(value) {
  return UNINSTALL_MODES.includes(value) ? value : "interactive";
}

function normalizeLanguage(value) {
  return value === "en" ? "en" : "zh";
}

function retainedPaths(value) {
  if (!Array.isArray(value?.retainedPaths)) return [];
  return value.retainedPaths.filter(
    (item) => typeof item === "string" && item.trim().length > 0
  );
}

function retentionPresentation(dataRetention, language) {
  const paths = retainedPaths(dataRetention);
  const english = language === "en";
  if (dataRetention?.mode === "vendor-uninstaller-choice") {
    const pathDetail = paths.length
      ? english
        ? ` Model directories: ${paths.join("; ")}.`
        : ` 模型目录：${paths.join("、")}。`
      : "";
    return {
      retentionNotice: english
        ? `The vendor uninstaller decides whether model data is removed. In the vendor uninstaller, choose whether to delete model data and confirm.${pathDetail}`
        : `是否删除模型数据由厂商卸载器决定；请在卸载器中选择并确认。${pathDetail}`,
      requiresVendorConfirmation: true
    };
  }
  if (dataRetention?.mode !== "retain-listed-data" || paths.length === 0) {
    return null;
  }
  return {
    retentionNotice: english
      ? `The following data directories will be kept after uninstall: ${paths.join("; ")}.`
      : `卸载后会保留以下数据目录：${paths.join("、")}。`,
    requiresVendorConfirmation: false
  };
}

function getUninstallPresentation(value, dataRetention, language = "zh") {
  const locale = normalizeLanguage(language);
  const base = UNINSTALL_PRESENTATIONS[locale][normalizeUninstallMode(value)];
  const retention = retentionPresentation(dataRetention, locale);
  if (!retention) return base;
  const { retentionNotice, requiresVendorConfirmation } = retention;
  return Object.freeze({
    ...base,
    activeDetail: `${base.activeDetail} ${retentionNotice}`,
    timedOut: `${base.timedOut} ${retentionNotice}`,
    stillInstalled: `${base.stillInstalled} ${retentionNotice}`,
    launched: `${base.launched} ${retentionNotice}`,
    retentionNotice,
    confirmationDetail: retentionNotice,
    requiresVendorConfirmation
  });
}

function getDesktopUninstallPresentation(productId, value, language = "zh") {
  return getUninstallPresentation(
    value,
    getDesktopLifecycle(productId)?.dataRetention,
    language
  );
}

function presentValue(value, fallback, language) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text) return text;
  return language === "en" ? fallback.en : fallback.zh;
}

function buildDesktopUninstallConfirmation({
  productId,
  mode,
  language = "zh",
  surface = "vendor-uninstaller",
  productName,
  version,
  publisher,
  packageFullName,
  installLocation,
  executableName,
  signer
}) {
  const locale = normalizeLanguage(language);
  const english = locale === "en";
  const normalizedMode = normalizeUninstallMode(mode);
  const name = presentValue(
    productName,
    { zh: "该产品", en: "this product" },
    locale
  );
  const presentation = getDesktopUninstallPresentation(
    productId,
    normalizedMode,
    locale
  );
  const isWindowsSettings = surface === "windows-settings";
  const isAutomatic = normalizedMode === "automatic" && !isWindowsSettings;
  const message = english
    ? isWindowsSettings
      ? `Open Windows Installed apps to uninstall ${name}?`
      : isAutomatic
        ? `Allow ZhenXing AI Assistant to uninstall ${name} automatically?`
        : `Open the vendor uninstaller for ${name}?`
    : isWindowsSettings
      ? `确认打开 Windows 已安装的应用来卸载 ${name}？`
      : isAutomatic
        ? `确认由枕星AI助手 自动卸载 ${name}？`
        : `确认打开 ${name} 的厂商卸载程序？`;
  const unknown = english ? "Not provided by Windows" : "Windows 未提供";
  const lines = english
    ? [
        `Product: ${name}`,
        `Version: ${presentValue(version, { zh: unknown, en: unknown }, locale)}`,
        `Publisher: ${presentValue(publisher, { zh: unknown, en: unknown }, locale)}`,
        packageFullName ? `Package identity: ${packageFullName}` : "",
        installLocation ? `Install location: ${installLocation}` : "",
        executableName ? `Uninstaller: ${executableName}` : "",
        signer ? `Signer: ${signer}` : "",
        isWindowsSettings
          ? "ZhenXing AI Assistant will not silently remove this package. Confirm the uninstall in Windows."
          : isAutomatic
            ? "ZhenXing AI Assistant will close the running product, start the reviewed vendor uninstaller, and confirm that the installation record is gone."
            : "Opening the vendor uninstaller does not mean uninstall is complete. ZhenXing AI Assistant will keep checking the installation record.",
        presentation.confirmationDetail || ""
      ]
    : [
        `产品：${name}`,
        `版本：${presentValue(version, { zh: unknown, en: unknown }, locale)}`,
        `发布者：${presentValue(publisher, { zh: unknown, en: unknown }, locale)}`,
        packageFullName ? `包身份：${packageFullName}` : "",
        installLocation ? `安装位置：${installLocation}` : "",
        executableName ? `卸载程序：${executableName}` : "",
        signer ? `签发者：${signer}` : "",
        isWindowsSettings
          ? "枕星AI助手 不会静默移除该应用包；请在 Windows 界面中确认卸载。"
          : isAutomatic
            ? "枕星AI助手 会先关闭正在运行的产品，再执行已审核的厂商卸载程序并确认安装记录已经消失。"
            : "打开卸载程序不代表卸载已经完成；枕星AI助手 会继续检测安装记录是否真正消失。",
        presentation.confirmationDetail || ""
      ];
  const confirmLabel = english
    ? isWindowsSettings
      ? "Open Windows settings"
      : isAutomatic
        ? "Uninstall"
        : "Open uninstaller"
    : isWindowsSettings
      ? "打开 Windows 设置"
      : isAutomatic
        ? "继续卸载"
        : "打开卸载程序";
  return {
    type: "warning",
    title: english ? `Uninstall ${name}` : `卸载 ${name}`,
    message,
    detail: lines.filter(Boolean).join("\n"),
    buttons: [english ? "Cancel" : "取消", confirmLabel],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  };
}

module.exports = {
  UNINSTALL_MODES,
  buildDesktopUninstallConfirmation,
  getDesktopUninstallPresentation,
  getUninstallPresentation,
  normalizeUninstallMode
};
