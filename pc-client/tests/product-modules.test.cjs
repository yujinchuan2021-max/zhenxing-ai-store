"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getInstallRegistration,
  publicInstallProfiles
} = require("../shared/install-registry.cjs");
const {
  PRODUCT_MODULES,
  applyProductModule,
  moduleIdForProductType,
  publicProductModules
} = require("../shared/product-modules.cjs");
const {
  getDesktopAdapter
} = require("../shared/desktop-adapters.cjs");

test("each product type resolves to one reusable product module", () => {
  assert.equal(moduleIdForProductType("web"), "web-link");
  assert.equal(moduleIdForProductType("desktop-reviewed"), "desktop-managed");
  assert.equal(moduleIdForProductType("cli"), "cli-managed");
  assert.equal(publicProductModules().length, 6);
  assert.equal(
    new Set(publicProductModules().map((module) => module.productType)).size,
    6
  );
});

test("a module derives every low-level product policy", () => {
  const product = applyProductModule(
    {
      id: "example",
      requirements: ["node"],
      installProfileId: "stale",
      download: { url: "https://example.com/tool.exe", fileName: "tool.exe" }
    },
    "desktop-official"
  );
  assert.equal(product.productType, "desktop-official");
  assert.equal(product.kind, "桌面端");
  assert.equal(product.installPolicy, "open-official-download");
  assert.equal(product.downloadPolicy, "official-page");
  assert.equal(product.signaturePolicy, "vendor-controlled");
  assert.equal(product.uninstallPolicy, "vendor-managed");
  assert.equal(product.installProfileId, "");
  assert.deepEqual(product.requirements, []);
});

test("approved profiles expose identity but no executable command", () => {
  const profiles = publicInstallProfiles();
  assert.equal(profiles.length, 7);
  assert.deepEqual(
    profiles.find((profile) => profile.id === "cli.codex"),
    {
      id: "cli.codex",
      label: "Codex CLI",
      moduleId: "cli-managed",
      productId: "codex-cli",
      vendorId: "openai",
      requirements: ["node"],
      capabilities: ["website", "tutorial", "install", "open", "uninstall"]
    }
  );
  assert.equal(
    Object.hasOwn(
      profiles.find((profile) => profile.id === "cli.codex"),
      "packageName"
    ),
    false
  );
  assert.equal(
    getInstallRegistration("comfy-desktop").profileId,
    "desktop.comfy"
  );
  assert.deepEqual(
    profiles.find((profile) => profile.id === "desktop.comfy").download,
    {
      url: "https://download.comfy.org/windows/nsis/x64",
      fileName: "Comfy-Desktop-Setup-x64.exe"
    }
  );
  assert.deepEqual(
    profiles.find((profile) => profile.id === "desktop.chatgpt").download,
    {
      url: "https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi",
      fileName: "ChatGPT Installer.exe"
    }
  );
  assert.deepEqual(
    profiles.find((profile) => profile.id === "desktop.claude").download,
    {
      url: "https://claude.ai/api/desktop/win32/x64/exe/latest/redirect",
      fileName: "Claude-Setup-x64.exe"
    }
  );
  assert.equal(PRODUCT_MODULES["desktop-managed"].requiresProfile, true);
});

test("managed desktop profiles resolve every advertised native capability", () => {
  for (const productId of [
    "chatgpt-desktop",
    "claude-desktop",
    "comfy-desktop",
    "ollama-cli"
  ]) {
    const registration = getInstallRegistration(productId);
    const adapter = getDesktopAdapter(registration.desktopAdapterId);
    assert.ok(adapter, `${productId} must resolve a desktop adapter`);
    assert.equal(adapter.presenceEvidence, "trusted-install-identity");
    assert.ok(
      ["automatic", "interactive"].includes(adapter.uninstallMode),
      `${productId} must declare its uninstall interaction mode`
    );
    assert.equal(registration.capabilities.includes("install"), true);
    assert.equal(registration.capabilities.includes("open"), true);
    assert.equal(
      registration.capabilities.includes("uninstall"),
      Boolean(adapter.uninstall || adapter.appx)
    );
  }
});
