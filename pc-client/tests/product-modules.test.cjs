"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  cliInstallPlans,
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
  assert.equal(moduleIdForProductType("cli-official"), "cli-official");
  assert.equal(moduleIdForProductType("cli"), "cli-managed");
  assert.equal(publicProductModules().length, 7);
  assert.equal(
    new Set(publicProductModules().map((module) => module.productType)).size,
    7
  );
});

test("official CLI module cannot request local execution", () => {
  const product = applyProductModule(
    {
      id: "example-cli",
      requirements: ["node"],
      installProfileId: "unreviewed-profile"
    },
    "cli-official"
  );
  assert.equal(product.productType, "cli-official");
  assert.equal(product.kind, "CLI");
  assert.equal(product.installPolicy, "open-official-install");
  assert.equal(product.downloadPolicy, "none");
  assert.equal(product.signaturePolicy, "not-applicable");
  assert.equal(product.uninstallPolicy, "not-managed");
  assert.deepEqual(product.capabilities, ["website", "tutorial"]);
  assert.equal(product.installProfileId, "");
  assert.deepEqual(product.requirements, []);
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
  assert.equal(profiles.length, 41);
  assert.deepEqual(
    profiles.find((profile) => profile.id === "cli.codex"),
    {
      id: "cli.codex",
      label: "Codex CLI",
      moduleId: "cli-managed",
      productId: "codex-cli",
      vendorId: "openai",
      productType: "cli",
      kind: "CLI",
      mode: "managed-cli",
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
  assert.deepEqual(
    profiles.find((profile) => profile.id === "cli.openclaw"),
    {
      id: "cli.openclaw",
      label: "OpenClaw",
      moduleId: "cli-managed",
      productId: "openclaw-agent",
      vendorId: "openclaw",
      productType: "cli",
      kind: "CLI",
      mode: "managed-cli",
      requirements: ["node"],
      capabilities: ["website", "tutorial", "install", "open", "uninstall"]
    }
  );
  assert.deepEqual(
    profiles.find((profile) => profile.id === "cli.openclaw-wsl"),
    {
      id: "cli.openclaw-wsl",
      label: "OpenClaw WSL Gateway",
      moduleId: "cli-managed",
      productId: "openclaw-wsl-gateway",
      vendorId: "openclaw",
      productType: "cli",
      kind: "CLI",
      mode: "managed-cli",
      requirements: ["wsl"],
      capabilities: ["website", "tutorial", "install", "open", "uninstall"]
    }
  );
  assert.deepEqual(
    profiles.find((profile) => profile.id === "cli.antigravity"),
    {
      id: "cli.antigravity",
      label: "Antigravity CLI",
      moduleId: "cli-managed",
      productId: "google-antigravity-cli",
      vendorId: "google",
      productType: "cli",
      kind: "CLI",
      mode: "managed-cli",
      requirements: [],
      capabilities: ["website", "tutorial", "install", "open", "uninstall"]
    }
  );
  assert.equal(
    Object.hasOwn(
      profiles.find((profile) => profile.id === "cli.antigravity"),
      "artifacts"
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
      url: "https://dl.todesktop.com/241130tqe9q3y",
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
      url: "https://claude.ai/api/desktop/win32/x64/setup/latest/redirect",
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
    assert.ok(
      Array.isArray(adapter.closeProcessNames) &&
        adapter.closeProcessNames.length > 0,
      `${productId} must declare its local close process names`
    );
    assert.equal(
      registration.capabilities.includes("uninstall"),
      Boolean(adapter.uninstall || adapter.appx)
    );
  }
});

test("every managed CLI declares one fixed local terminal command", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(cliInstallPlans()).map(([productId, plan]) => [
        productId,
        plan.commandName
      ])
    ),
    {
      "codex-cli": "codex",
      "claude-code": "claude",
      "gemini-cli": "gemini",
      "google-antigravity-cli": "agy",
      "moonshot-kimi-code-cli": "kimi",
      "openclaw-agent": "openclaw",
      "openclaw-wsl-gateway": "openclaw",
      "alibaba-qwen-code": "qwen",
      "amazon-kiro-cli": "kiro-cli",
      "github-copilot-cli": "copilot",
      "minimax-cli": "mmx",
      "comfy-cli": "comfy",
      "hf-cli": "hf",
      "mistral-vibe-code-cli": "vibe"
    }
  );
});
