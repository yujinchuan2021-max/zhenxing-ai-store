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
            productType: "desktop-reviewed"
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
      },
      {
        id: "python",
        name: "Python",
        installed: false,
        version: "",
        location: "",
        detection: "absent",
        canOpen: false,
        canUninstall: false
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
  assert.deepEqual(result.reinstallableEnvironments, [
    {
      id: "environment:python",
      environmentId: "python",
      name: "Python",
      vendorName: "运行环境",
      type: "environment",
      packageReady: false
    }
  ]);
});

test("keeps an absent environment reinstallable with a cached installer", () => {
  const result = buildInstalledProductManagement({
    environmentChecks: [
      {
        id: "node",
        name: "Node.js",
        installed: false,
        detection: "absent"
      }
    ],
    downloadTasks: {
      "environment:node": {
        productId: "environment:node",
        phase: "completed",
        filePath: "D:\\Downloads\\node-v24.18.0-x64.msi"
      }
    }
  });

  assert.deepEqual(result.reinstallableEnvironments, [
    {
      id: "environment:node",
      environmentId: "node",
      name: "Node.js",
      vendorName: "运行环境",
      type: "environment",
      packageReady: true
    }
  ]);
});

test("exposes every installed environment's reviewed open action instead of special-casing Docker", () => {
  const result = buildInstalledProductManagement({
    environmentChecks: [
      {
        id: "wsl",
        name: "Windows Subsystem for Linux",
        installed: true,
        version: "2.7.10.0",
        location: "C:\\Windows\\System32\\wsl.exe",
        canOpen: true,
        canUninstall: true
      }
    ],
    wslDistributions: [
      {
        name: "Ubuntu-24.04",
        environments: [
          {
            id: "node",
            name: "Node.js",
            installed: true,
            version: "24.18.0",
            location: "/home/user/.openclaw/tools/node/bin/node",
            ownerProductId: "openclaw-wsl-gateway",
            ownerProductName: "OpenClaw WSL Gateway",
            scope: "product-private",
            canRepair: true
          }
        ]
      }
    ]
  });

  assert.deepEqual(result.products, [
    {
      id: "environment:wsl",
      name: "Windows Subsystem for Linux",
      vendorName: "运行环境",
      type: "environment",
      version: "2.7.10.0",
      location: "C:\\Windows\\System32\\wsl.exe",
      canOpen: true,
      canClose: false,
      canManageFiles: true,
      canReinstall: false,
      canUninstall: true,
      children: [
        {
          id: "wsl:Ubuntu-24.04",
          name: "Ubuntu-24.04",
          environments: [
            {
              id: "wsl:Ubuntu-24.04:node:openclaw-wsl-gateway",
              name: "Node.js",
              installed: true,
              version: "24.18.0",
              location: "/home/user/.openclaw/tools/node/bin/node",
              distribution: "Ubuntu-24.04",
              ownerProductId: "openclaw-wsl-gateway",
              ownerProductName: "OpenClaw WSL Gateway",
              scope: "product-private",
              canRepair: true
            }
          ]
        }
      ]
    }
  ]);
});

test("keeps a locally approved installed product manageable after its backend card is removed", () => {
  const result = buildInstalledProductManagement({
    vendors: [],
    localInventory: [
      {
        productId: "retired-desktop-card",
        label: "Reviewed Desktop",
        vendorId: "reviewed-vendor",
        productType: "desktop-reviewed",
        mode: "managed-installer",
        capabilities: ["install", "open", "uninstall"]
      }
    ],
    desktopStatuses: {
      "retired-desktop-card": {
        installed: true,
        version: "2.4.0",
        location: "C:\\Program Files\\Reviewed Desktop",
        canOpen: true,
        canUninstall: true
      }
    }
  });

  assert.deepEqual(result.products, [
    {
      id: "retired-desktop-card",
      name: "Reviewed Desktop",
      vendorName: "reviewed-vendor",
      type: "desktop",
      version: "2.4.0",
      location: "C:\\Program Files\\Reviewed Desktop",
      canOpen: true,
      canClose: true,
      canManageFiles: true,
      canReinstall: false,
      canUninstall: true
    }
  ]);
});
