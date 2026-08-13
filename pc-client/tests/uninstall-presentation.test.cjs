"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  buildDesktopUninstallConfirmation,
  getDesktopUninstallPresentation,
  getUninstallPresentation,
  normalizeUninstallMode
} = require("../shared/uninstall-presentation.cjs");
const {
  getDesktopLifecycle
} = require("../shared/desktop-lifecycle.cjs");

test("automatic uninstall copy never promises a visible panel", () => {
  const copy = getUninstallPresentation("automatic");
  assert.equal(copy.activeTitle, "正在自动卸载");
  assert.match(copy.activeDetail, /确认产品是否已移除/);
  assert.doesNotMatch(Object.values(copy).join(" "), /面板|手动完成/);
});

test("interactive uninstall copy tells the user to finish in the panel", () => {
  const copy = getUninstallPresentation("interactive");
  assert.equal(copy.preparingTitle, "正在验证卸载程序");
  assert.equal(copy.activeTitle, "已调起厂商卸载面板");
  assert.match(copy.activeDetail, /手动完成/);
});

test("English uninstall copy keeps the full product-specific retention contract", () => {
  const comfy = getDesktopUninstallPresentation(
    "comfy-desktop",
    "interactive",
    "en"
  );
  const ollama = getDesktopUninstallPresentation(
    "ollama-cli",
    "interactive",
    "en"
  );

  assert.equal(comfy.preparingTitle, "Verifying uninstaller");
  assert.equal(comfy.activeTitle, "Vendor uninstaller opened");
  assert.match(comfy.retentionNotice, /ComfyUI-Installs/);
  assert.match(ollama.retentionNotice, /vendor uninstaller/i);
  assert.match(ollama.retentionNotice, /OLLAMA_MODELS/);
  assert.doesNotMatch(
    Object.values({ ...comfy, ...ollama }).join(" "),
    /\p{Script=Han}/u
  );
});

test("English uninstall confirmation preserves product, trust, and data-choice details", () => {
  const confirmation = buildDesktopUninstallConfirmation({
    productId: "ollama-cli",
    mode: "interactive",
    language: "en",
    surface: "vendor-uninstaller",
    productName: "Ollama",
    version: "0.12.11",
    publisher: "Ollama, Inc.",
    installLocation: "C:\\Apps\\Ollama",
    executableName: "unins000.exe",
    signer: "CN=Ollama Inc."
  });

  assert.match(confirmation.title, /Ollama/);
  assert.match(confirmation.message, /vendor uninstaller/i);
  assert.match(confirmation.detail, /0\.12\.11/);
  assert.match(confirmation.detail, /CN=Ollama Inc\./);
  assert.match(confirmation.detail, /OLLAMA_MODELS/);
  assert.match(confirmation.detail, /choose whether to delete model data/i);
  assert.deepEqual(confirmation.buttons, ["Cancel", "Open uninstaller"]);
  assert.doesNotMatch(JSON.stringify(confirmation), /\p{Script=Han}/u);
});

test("English uninstall confirmation preserves opaque Unicode Windows metadata", () => {
  const confirmation = buildDesktopUninstallConfirmation({
    productId: "claude-desktop",
    mode: "interactive",
    language: "en",
    surface: "vendor-uninstaller",
    productName: "Claude 桌面版",
    version: "1.2.3",
    publisher: "示例 Publisher",
    installLocation: "C:\\用户\\测试\\Claude",
    executableName: "uninstall.exe",
    signer: "CN=示例 Signer"
  });

  assert.match(confirmation.title, /Claude 桌面版/);
  assert.match(confirmation.detail, /C:\\用户\\测试\\Claude/);
  assert.match(confirmation.detail, /CN=示例 Signer/);
  assert.match(confirmation.detail, /Version: 1\.2\.3/);
});

test("main uses the structured uninstall confirmation for registry and AppX products", () => {
  const main = fs.readFileSync(path.resolve(__dirname, "../electron/main.cjs"), "utf8");
  const calls = main.match(/showDesktopUninstallConfirmation\(\{/g) || [];
  assert.ok(calls.length >= 2);
  assert.match(
    main,
    /function showDesktopUninstallConfirmation\([\s\S]*?dialog\.showMessageBox\(buildDesktopUninstallConfirmation\(options\)\)/
  );
  assert.doesNotMatch(
    main,
    /showLocalizedMessageBox\(\s*buildDesktopUninstallConfirmation/
  );
});

test("renderer waits for confirmed launch state before claiming the panel opened", () => {
  const app = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");
  const row = app.match(/function ProductRow\([\s\S]*?function AuthModal/)?.[0];
  assert.ok(row, "ProductRow source was not found");
  assert.match(row, /desktopOperationTask\?\.launchState === "confirmed"/);
  assert.match(row, /uninstallCopy\.preparingTitle/);
});

test("unknown uninstall modes fail safely as interactive", () => {
  assert.equal(normalizeUninstallMode("future-mode"), "interactive");
});

test("Comfy uninstall presentation names every retained data directory", () => {
  const copy = getUninstallPresentation(
    "interactive",
    getDesktopLifecycle("comfy-desktop").dataRetention
  );

  assert.equal(copy.requiresVendorConfirmation, false);
  assert.match(copy.retentionNotice, /卸载后会保留以下数据目录/);
  assert.match(copy.retentionNotice, /%USERPROFILE%\\ComfyUI-Installs/);
  assert.match(copy.retentionNotice, /%USERPROFILE%\\ComfyUI-Shared/);
  assert.match(copy.retentionNotice, /%APPDATA%\\Comfy Desktop/);
  assert.match(copy.activeDetail, /卸载后会保留以下数据目录/);
  assert.match(copy.timedOut, /%USERPROFILE%\\ComfyUI-Installs/);
  assert.match(copy.timedOut, /%USERPROFILE%\\ComfyUI-Shared/);
  assert.match(copy.timedOut, /%APPDATA%\\Comfy Desktop/);
});

test("Ollama uninstall presentation requires a model-retention choice in the vendor panel", () => {
  const copy = getUninstallPresentation(
    "interactive",
    getDesktopLifecycle("ollama-cli").dataRetention
  );

  assert.equal(copy.requiresVendorConfirmation, true);
  assert.match(copy.retentionNotice, /是否删除模型数据/);
  assert.match(copy.retentionNotice, /卸载器中选择并确认/);
  assert.match(copy.retentionNotice, /%USERPROFILE%\\\.ollama\\models/);
  assert.match(copy.retentionNotice, /%OLLAMA_MODELS%/);
  assert.match(copy.launched, /卸载器中选择并确认/);
});

test("desktop uninstall presentation resolves client-owned retention policy by product id", () => {
  assert.match(
    getDesktopUninstallPresentation("comfy-desktop", "interactive")
      .confirmationDetail,
    /ComfyUI-Installs/
  );
  assert.equal(
    getDesktopUninstallPresentation("ollama-cli", "interactive")
      .requiresVendorConfirmation,
    true
  );
  assert.equal(
    getDesktopUninstallPresentation("unknown-product", "automatic"),
    getUninstallPresentation("automatic")
  );
});
