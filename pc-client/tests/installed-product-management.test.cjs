const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildInstalledProductManagement
} = require("../shared/installed-product-management.cjs");

test("builds one catalog-driven management model for desktop, CLI, environments and packages", () => {
  const result = buildInstalledProductManagement({
    vendors: [
      {
        id: "openai",
        name: "OpenAI",
        products: [
          {
            id: "chatgpt-desktop",
            name: "ChatGPT Desktop",
            productType: "desktop-reviewed",
            capabilities: ["install", "open", "uninstall"]
          },
          {
            id: "codex-cli",
            name: "Codex CLI",
            productType: "cli",
            capabilities: ["install", "open", "uninstall"]
          }
        ]
      },
      {
        id: "comfy",
        name: "Comfy Org",
        products: [
          {
            id: "comfy-desktop",
            name: "Comfy Desktop",
            productType: "desktop-reviewed",
            capabilities: ["install", "open", "uninstall"]
          }
        ]
      }
    ],
    desktopStatuses: {
      "chatgpt-desktop": {
        installed: true,
        version: "1.2.3",
        location: "C:\\Apps\\ChatGPT",
        canOpen: true,
        canUninstall: true
      }
    },
    cliStatuses: {
      "codex-cli": {
        installed: true,
        version: "0.9.0",
        directory: "D:\\AI Hub\\CLI",
        managed: true,
        canUninstall: true
      }
    },
    environmentChecks: [
      {
        id: "docker",
        name: "Docker",
        installed: true,
        version: "4.83.0",
        location:
          "C:\\Users\\Tester\\AppData\\Local\\Programs\\DockerDesktop\\Docker Desktop.exe",
        canOpen: true,
        canUninstall: true
      }
    ],
    downloadTasks: {
      "comfy-desktop": {
        productId: "comfy-desktop",
        phase: "completed",
        filePath: "D:\\Downloads\\Comfy-Desktop-Setup-x64.exe"
      }
    }
  });

  assert.deepEqual(
    result.products.map((entry) => ({
      id: entry.id,
      type: entry.type,
      canOpen: entry.canOpen,
      canClose: entry.canClose,
      canManageFiles: entry.canManageFiles,
      canUninstall: entry.canUninstall
    })),
    [
      {
        id: "chatgpt-desktop",
        type: "desktop",
        canOpen: true,
        canClose: true,
        canManageFiles: true,
        canUninstall: true
      },
      {
        id: "codex-cli",
        type: "cli",
        canOpen: true,
        canClose: false,
        canManageFiles: true,
        canUninstall: true
      },
      {
        id: "environment:docker",
        type: "environment",
        canOpen: true,
        canClose: true,
        canManageFiles: true,
        canUninstall: true
      }
    ]
  );
  assert.deepEqual(result.packages, [
    {
      id: "comfy-desktop",
      name: "Comfy Desktop",
      filePath: "D:\\Downloads\\Comfy-Desktop-Setup-x64.exe",
      canInstall: true
    }
  ]);
});
