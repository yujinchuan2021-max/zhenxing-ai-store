"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  resolveManagedProductActionContext,
  resolveManagedProductActionContexts
} = require("../shared/managed-product-action-context.cjs");

const CLAUDE_LOCAL_PROFILE = {
  id: "desktop.claude",
  label: "Claude Desktop",
  moduleId: "desktop-managed",
  productId: "claude-desktop",
  vendorId: "anthropic",
  productType: "desktop-reviewed",
  kind: "桌面端",
  mode: "managed-installer",
  requirements: [],
  capabilities: ["website", "tutorial", "install", "open", "uninstall"],
  download: {
    url: "https://claude.ai/api/desktop/win32/x64/exe/latest/redirect",
    fileName: "Claude-Setup-x64.exe"
  }
};

test("an approved installed product keeps a safe action context after its backend card is removed", () => {
  const product = resolveManagedProductActionContext({
    productId: "claude-desktop",
    vendors: [],
    localInventory: [CLAUDE_LOCAL_PROFILE]
  });

  assert.deepEqual(product, {
    id: "claude-desktop",
    name: "Claude Desktop",
    kind: "桌面端",
    category: "",
    description: "",
    website: "",
    tutorial: "",
    productType: "desktop-reviewed",
    moduleId: "desktop-managed",
    installProfileId: "desktop.claude",
    requirements: [],
    installPolicy: "client-managed-installer",
    downloadPolicy: "client-managed",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
    capabilities: ["website", "tutorial", "install", "open", "uninstall"],
    download: {
      url: "https://claude.ai/api/desktop/win32/x64/exe/latest/redirect",
      fileName: "Claude-Setup-x64.exe"
    }
  });
});

test("an inventory entry that is not in the client whitelist cannot create an action context", () => {
  const product = resolveManagedProductActionContext({
    productId: "backend-invented-desktop",
    vendors: [],
    localInventory: [
      {
        ...CLAUDE_LOCAL_PROFILE,
        id: "desktop.backend-invented",
        productId: "backend-invented-desktop",
        label: "Backend Invented Desktop"
      }
    ]
  });

  assert.equal(product, null);
});

test("a duplicated inventory capability cannot impersonate the approved capability set", () => {
  const product = resolveManagedProductActionContext({
    productId: "claude-desktop",
    vendors: [],
    localInventory: [
      {
        ...CLAUDE_LOCAL_PROFILE,
        capabilities: ["website", "tutorial", "install", "open", "open"]
      }
    ]
  });

  assert.equal(product, null);
});

test("backend catalog metadata cannot widen a locally approved product's capabilities", () => {
  const product = resolveManagedProductActionContext({
    productId: "claude-desktop",
    vendors: [
      {
        id: "anthropic",
        products: [
          {
            id: "claude-desktop",
            name: "Claude for Teams",
            kind: "桌面端",
            category: "AI 对话",
            description: "由后台维护的展示文案",
            website: "https://claude.ai/download",
            tutorial: "https://support.claude.com/",
            productType: "desktop-reviewed",
            moduleId: "desktop-managed",
            installProfileId: "desktop.claude",
            requirements: [],
            capabilities: [
              "website",
              "tutorial",
              "install",
              "open",
              "uninstall",
              "run-arbitrary-command"
            ],
            download: {
              url: "https://attacker.invalid/setup.exe",
              fileName: "setup.exe"
            }
          }
        ]
      }
    ],
    localInventory: []
  });

  assert.equal(product.name, "Claude for Teams");
  assert.deepEqual(product.capabilities, [
    "website",
    "tutorial",
    "install",
    "open",
    "uninstall"
  ]);
  assert.deepEqual(product.download, CLAUDE_LOCAL_PROFILE.download);
});

test("recovery includes removed approved products once and excludes invented inventory entries", () => {
  const products = resolveManagedProductActionContexts({
    vendors: [],
    localInventory: [
      CLAUDE_LOCAL_PROFILE,
      { ...CLAUDE_LOCAL_PROFILE },
      {
        ...CLAUDE_LOCAL_PROFILE,
        id: "desktop.backend-invented",
        productId: "backend-invented-desktop",
        label: "Backend Invented Desktop"
      }
    ]
  });

  assert.deepEqual(
    products.map((product) => product.id),
    ["claude-desktop"]
  );
});
