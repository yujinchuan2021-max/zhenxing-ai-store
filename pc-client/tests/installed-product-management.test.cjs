const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  buildInstalledProductManagement
} = require("../shared/installed-product-management.cjs");

test("builds one catalog-driven management model for desktop, CLI, environments and packages", () => {
  const result = buildInstalledProductManagement({
    localInventory: [
      {
        productId: "comfy-desktop",
        label: "Comfy Desktop",
        vendorId: "comfy",
        mode: "managed-installer",
        capabilities: ["install", "open", "uninstall"]
      }
    ],
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
      canGetLatest: false,
      managedByPackageManager: false,
      updateOwner: "",
      updateStrategy: "",
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
      canClose: false,
      canManageFiles: false,
      canReinstall: false,
      canGetLatest: false,
      managedByPackageManager: false,
      updateOwner: "",
      updateStrategy: "",
      canUninstall: true
    }
  ]);
});

test("a disabled desktop exposes only the reviewed open and uninstall recovery actions", () => {
  const result = buildInstalledProductManagement({
    vendors: [
      {
        id: "anthropic",
        enabled: true,
        products: [
          {
            id: "claude-desktop",
            name: "Claude Desktop",
            productType: "desktop-reviewed",
            enabled: false,
            capabilities: ["install", "open", "uninstall"]
          }
        ]
      }
    ],
    localInventory: [
      {
        productId: "claude-desktop",
        label: "Claude Desktop",
        vendorId: "anthropic",
        mode: "managed-installer",
        capabilities: ["install", "open", "uninstall"]
      }
    ],
    desktopStatuses: {
      "claude-desktop": {
        installed: true,
        version: "1.0.0",
        location: "C:\\Apps\\Claude",
        canOpen: true,
        canUninstall: true
      }
    }
  });

  assert.deepEqual(
    result.products.map((entry) => ({
      canOpen: entry.canOpen,
      canClose: entry.canClose,
      canManageFiles: entry.canManageFiles,
      canReinstall: entry.canReinstall,
      canGetLatest: entry.canGetLatest,
      canUninstall: entry.canUninstall
    })),
    [
      {
        canOpen: true,
        canClose: false,
        canManageFiles: false,
        canReinstall: false,
        canGetLatest: false,
        canUninstall: true
      }
    ]
  );
});

test("a disabled backend card cannot reinstall a cached reviewed package", () => {
  const result = buildInstalledProductManagement({
    vendors: [
      {
        id: "anthropic",
        enabled: true,
        products: [
          {
            id: "claude-desktop",
            name: "Claude Desktop",
            productType: "desktop-reviewed",
            enabled: false,
            capabilities: ["install", "open", "uninstall"]
          }
        ]
      }
    ],
    localInventory: [
      {
        productId: "claude-desktop",
        label: "Claude Desktop",
        vendorId: "anthropic",
        mode: "managed-installer",
        capabilities: ["install", "open", "uninstall"]
      }
    ],
    downloadTasks: {
      "claude-desktop": {
        productId: "claude-desktop",
        phase: "completed",
        filePath: "D:\\Downloads\\Claude-Setup-x64.exe"
      }
    }
  });

  assert.equal(result.packages[0].canInstall, false);
});

test("a package-manager desktop can reinstall and update without a cached installer", () => {
  const result = buildInstalledProductManagement({
    vendors: [
      {
        id: "example",
        enabled: true,
        products: [
          {
            id: "example-desktop",
            name: "Example Desktop",
            productType: "desktop-reviewed",
            enabled: true,
            capabilities: ["install", "open", "uninstall"]
          }
        ]
      }
    ],
    localInventory: [
      {
        productId: "example-desktop",
        label: "Example Desktop",
        vendorId: "example",
        mode: "managed-package-manager",
        capabilities: ["install", "open", "uninstall"]
      }
    ],
    desktopStatuses: {
      "example-desktop": {
        installed: true,
        version: "1.0.0",
        location: "",
        canOpen: false,
        canUninstall: true
      }
    }
  });

  assert.equal(result.products[0].canReinstall, true);
  assert.equal(result.products[0].canGetLatest, true);
  assert.equal(result.products[0].managedByPackageManager, true);
  assert.equal(result.products[0].canClose, false);
});

test("a current official-page product cannot inherit a stale package-manager lifecycle", () => {
  const result = buildInstalledProductManagement({
    vendors: [
      {
        id: "msty",
        name: "Msty",
        enabled: true,
        products: [
          {
            id: "msty-studio",
            name: "Msty Studio",
            productType: "desktop-official",
            moduleId: "desktop-official",
            installProfileId: "",
            capabilities: ["website", "tutorial"]
          }
        ]
      }
    ],
    localInventory: [
      {
        productId: "msty-studio",
        mode: "managed-package-manager",
        productType: "desktop-reviewed",
        moduleId: "desktop-managed",
        profileId: "desktop.msty-studio.winget",
        capabilities: ["website", "tutorial", "install", "open", "uninstall"],
        lifecycle: { updateOwner: "winget", updateStrategy: "package-manager" }
      }
    ],
    desktopStatuses: {
      "msty-studio": {
        installed: true,
        version: "1.0.0",
        location: "C:\\Apps\\Msty",
        canOpen: true,
        canUninstall: true
      }
    }
  });

  assert.deepEqual(result.products[0], {
    id: "msty-studio",
    name: "Msty Studio",
    vendorName: "Msty",
    type: "desktop",
    version: "1.0.0",
    location: "C:\\Apps\\Msty",
    canOpen: false,
    canClose: false,
    canManageFiles: true,
    canReinstall: false,
    canGetLatest: false,
    managedByPackageManager: false,
    updateOwner: "",
    updateStrategy: "",
    canUninstall: false
  });
});

test("a disabled CLI exposes only open and uninstall recovery actions", () => {
  const result = buildInstalledProductManagement({
    vendors: [
      {
        id: "openai",
        enabled: true,
        products: [
          {
            id: "codex-cli",
            name: "Codex CLI",
            productType: "cli",
            enabled: false,
            capabilities: ["install", "open", "uninstall"]
          }
        ]
      }
    ],
    localInventory: [
      {
        productId: "codex-cli",
        label: "Codex CLI",
        vendorId: "openai",
        mode: "managed-cli",
        capabilities: ["install", "open", "uninstall"]
      }
    ],
    cliStatuses: {
      "codex-cli": {
        installed: true,
        version: "1.0.0",
        directory: "D:\\AI Hub\\CLI\\codex-cli",
        managed: true,
        canUninstall: true
      }
    }
  });

  assert.deepEqual(
    result.products.map((entry) => ({
      canOpen: entry.canOpen,
      canClose: entry.canClose,
      canManageFiles: entry.canManageFiles,
      canReinstall: entry.canReinstall,
      canGetLatest: entry.canGetLatest,
      canUninstall: entry.canUninstall
    })),
    [
      {
        canOpen: true,
        canClose: false,
        canManageFiles: false,
        canReinstall: false,
        canGetLatest: false,
        canUninstall: true
      }
    ]
  );
});

test("a vendor-managed CLI can open without granting AI Hub file management", () => {
  const result = buildInstalledProductManagement({
    vendors: [
      {
        id: "openclaw",
        enabled: true,
        products: [
          {
            id: "openclaw-wsl-gateway",
            name: "OpenClaw WSL Gateway",
            productType: "cli",
            enabled: true,
            capabilities: ["open", "uninstall"]
          }
        ]
      }
    ],
    cliStatuses: {
      "openclaw-wsl-gateway": {
        installed: true,
        version: "2026.7.1-2",
        directory: "WSL:OpenClawGateway",
        managed: false,
        canOpen: true,
        canUninstall: true
      }
    }
  });

  assert.deepEqual(result.products.map((entry) => ({
    canOpen: entry.canOpen,
    canManageFiles: entry.canManageFiles,
    canUninstall: entry.canUninstall
  })), [{ canOpen: true, canManageFiles: false, canUninstall: true }]);
});

test("the task center only exposes install for active catalog packages", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../src/App.tsx"),
    "utf8"
  );
  assert.match(
    source,
    /installableDownloadIds\.has\(task\.productId\)[\s\S]*?onOpenCompletedDownloadTask\(task\.productId\)/
  );
});

test("a completed canonical desktop-download-only artifact remains user-installable without a legacy profile", () => {
  const result = buildInstalledProductManagement({
    vendors: [
      {
        id: "example",
        enabled: true,
        products: [
          {
            id: "canonical-download",
            name: "Canonical Download",
            productType: "desktop-download-only",
            moduleId: "desktop-download-only.signed-catalog",
            installProfileId: "desktop-download-only.signed-catalog",
            capabilities: ["website", "tutorial", "install"],
            download: {
              url: "https://downloads.example.com/Canonical-Setup.exe",
              fileName: "Canonical-Setup.exe",
              artifactKind: "exe"
            }
          }
        ]
      }
    ],
    downloadTasks: {
      "canonical-download": {
        productId: "canonical-download",
        phase: "completed",
        filePath: "D:\\Downloads\\Canonical-Setup.exe"
      }
    }
  });

  assert.deepEqual(result.packages, [
    {
      id: "canonical-download",
      name: "Canonical Download",
      filePath: "D:\\Downloads\\Canonical-Setup.exe",
      canInstall: true
    }
  ]);
});

test("a completed canonical package without a current valid artifact is not installable", () => {
  const base = {
    id: "canonical-download",
    name: "Canonical Download",
    productType: "desktop-download-only",
    moduleId: "desktop-download-only.signed-catalog",
    installProfileId: "desktop-download-only.signed-catalog",
    capabilities: ["website", "tutorial", "install"]
  };
  for (const product of [
    base,
    { ...base, download: { url: "https://downloads.example.com/Setup.exe", fileName: "Setup.exe", artifactKind: "exe", command: "bad" } }
  ]) {
    const result = buildInstalledProductManagement({
      vendors: [{ id: "example", enabled: true, products: [product] }],
      downloadTasks: {
        "canonical-download": {
          productId: "canonical-download",
          phase: "completed",
          filePath: "D:\\Downloads\\Canonical-Setup.exe"
        }
      }
    });
    assert.equal(result.packages[0].canInstall, false);
  }
});

test("projects receipt ownership, external desktop recovery, CLI, and environments without treating an environment as a product", () => {
  const result = buildInstalledProductManagement({
    vendors: [
      {
        id: "example",
        enabled: true,
        products: [
          {
            id: "receipt-desktop",
            name: "Receipt Desktop",
            productType: "desktop-reviewed",
            moduleId: "desktop-managed",
            installProfileId: "desktop.receipt",
            capabilities: ["install", "open", "uninstall"]
          },
          {
            id: "external-store",
            name: "External Store App",
            productType: "desktop-reviewed",
            capabilities: ["open", "uninstall"]
          },
          {
            id: "fixed-download",
            name: "Fixed Download",
            productType: "desktop-download-only",
            moduleId: "desktop-download-only",
            installProfileId: "desktop-download-only.fixed-download",
            capabilities: ["website", "tutorial", "install"]
          },
          {
            id: "canonical-download",
            name: "Canonical Download",
            productType: "desktop-download-only",
            moduleId: "desktop-download-only.signed-catalog",
            installProfileId: "desktop-download-only.signed-catalog",
            capabilities: ["website", "tutorial", "install"],
            download: {
              url: "https://downloads.example.com/Canonical-Setup.exe",
              fileName: "Canonical-Setup.exe",
              artifactKind: "exe"
            }
          },
          ...["native-cli", "wsl-cli", "deploy-only-cli", "openclaw-companion"].map((id) => ({
            id,
            name: id,
            productType: "cli",
            capabilities: ["open", "uninstall"]
          }))
        ]
      }
    ],
    localInventory: [
      {
        productId: "receipt-desktop",
        profileId: "desktop.receipt",
        moduleId: "desktop-managed",
        productType: "desktop-reviewed",
        mode: "managed-installer"
      },
      {
        productId: "fixed-download",
        profileId: "desktop-download-only.fixed-download",
        moduleId: "desktop-download-only",
        productType: "desktop-download-only",
        mode: "desktop-download-only"
      }
    ],
    desktopStatuses: {
      "receipt-desktop": {
        installed: true,
        version: "1.0.0",
        location: "C:\\Apps\\Receipt",
        canOpen: true,
        canUninstall: true,
        managed: true,
        ownership: "managed"
      },
      "external-store": {
        installed: true,
        version: "2.0.0",
        location: "C:\\Apps\\External",
        canOpen: true,
        canUninstall: true,
        managed: false,
        ownership: "external"
      },
      "fixed-download": {
        installed: true,
        version: "3.0.0",
        location: "C:\\Apps\\Fixed",
        canOpen: false,
        canUninstall: false,
        managed: false,
        ownership: "external"
      }
    },
    cliStatuses: {
      "native-cli": { installed: true, managed: true, canOpen: true, canUninstall: true, directory: "D:\\CLI\\native" },
      "wsl-cli": { installed: true, managed: true, canOpen: true, canUninstall: true, directory: "WSL:Ubuntu-24.04" },
      "deploy-only-cli": { installed: true, managed: true, canOpen: true, canUninstall: true, directory: "D:\\CLI\\deploy-only" },
      "openclaw-companion": { installed: true, managed: false, canOpen: true, canUninstall: true, directory: "WSL:OpenClawGateway" }
    },
    environmentChecks: [
      { id: "docker", name: "Docker", installed: true, canOpen: true, canUninstall: true, location: "C:\\Docker\\Docker.exe" },
      { id: "node", name: "Node.js", installed: false, detection: "absent" }
    ],
    downloadTasks: {
      "receipt-desktop": { productId: "receipt-desktop", phase: "completed", filePath: "D:\\Downloads\\Receipt.exe" },
      "fixed-download": { productId: "fixed-download", phase: "completed", filePath: "D:\\Downloads\\Fixed.exe" },
      "canonical-download": { productId: "canonical-download", phase: "completed", filePath: "D:\\Downloads\\Canonical.exe" },
      "environment:node": { productId: "environment:node", phase: "completed", filePath: "D:\\Downloads\\node.msi" }
    }
  });

  const entries = Object.fromEntries(result.products.map((entry) => [entry.id, entry]));
  assert.deepEqual(
    [entries["receipt-desktop"].canReinstall, entries["receipt-desktop"].canGetLatest, entries["receipt-desktop"].canUninstall],
    [true, true, true]
  );
  assert.deepEqual(
    [entries["external-store"].canOpen, entries["external-store"].canReinstall, entries["external-store"].canGetLatest, entries["external-store"].canUninstall],
    [true, false, false, true],
    "an external Store/Appx-style product can be opened or sent to its reviewed uninstall flow, never re-managed"
  );
  assert.equal(entries["fixed-download"].canReinstall, false);
  assert.equal(entries["fixed-download"].canUninstall, false);
  for (const id of ["native-cli", "wsl-cli", "deploy-only-cli"]) {
    assert.equal(entries[id].canManageFiles, true, id);
    assert.equal(entries[id].canUninstall, true, id);
  }
  assert.deepEqual(
    [entries["openclaw-companion"].canOpen, entries["openclaw-companion"].canManageFiles],
    [true, false]
  );
  assert.equal(entries["environment:docker"].type, "environment");
  assert.equal(entries.node, undefined, "absent environments stay outside product entries");
  assert.deepEqual(
    Object.fromEntries(result.packages.map((entry) => [entry.id, entry.canInstall])),
    {
      "receipt-desktop": true,
      "fixed-download": true,
      "canonical-download": true,
      "environment:node": true
    }
  );
  assert.equal(result.reinstallableEnvironments.length, 1);
  assert.deepEqual(
    {
      id: result.reinstallableEnvironments[0].id,
      environmentId: result.reinstallableEnvironments[0].environmentId,
      type: result.reinstallableEnvironments[0].type,
      packageReady: result.reinstallableEnvironments[0].packageReady
    },
    {
      id: "environment:node",
      environmentId: "node",
      type: "environment",
      packageReady: true
    }
  );
});

test("projects a queued download only after an exact trusted completed-task recheck", () => {
  const result = buildInstalledProductManagement({
    downloadTasks: {
      legacy: {
        productId: "legacy",
        phase: "completed",
        filePath: "D:\\Downloads\\Legacy.exe"
      },
      duplicate: {
        productId: "duplicate",
        phase: "completed",
        filePath: "D:\\Downloads\\Old.exe"
      }
    },
    managedDownloadQueueTasks: {
      trusted: { productId: "trusted", phase: "downloaded" },
      duplicate: { productId: "duplicate", phase: "downloaded" },
      "queue-only": { productId: "queue-only", phase: "downloaded" },
      "wrong-key": { productId: "other-product", phase: "downloaded" },
      active: { productId: "active", phase: "downloading" },
      empty: { productId: "empty", phase: "downloaded" }
    },
    verifiedDownloadTasks: {
      trusted: {
        productId: "trusted",
        phase: "completed",
        filePath: "D:\\Downloads\\Trusted.exe"
      },
      duplicate: {
        productId: "duplicate",
        phase: "completed",
        filePath: "D:\\Downloads\\Latest.exe"
      },
      "queue-only": {
        productId: "queue-only",
        phase: "failed",
        filePath: "D:\\Downloads\\Untrusted.exe"
      },
      "wrong-key": {
        productId: "wrong-key",
        phase: "completed",
        filePath: "D:\\Downloads\\Wrong.exe"
      },
      active: {
        productId: "active",
        phase: "completed",
        filePath: "D:\\Downloads\\Active.exe"
      },
      unqueued: {
        productId: "unqueued",
        phase: "completed",
        filePath: "D:\\Downloads\\Arbitrary.exe"
      },
      empty: {
        productId: "empty",
        phase: "completed",
        filePath: "   "
      }
    }
  });

  assert.deepEqual(
    result.packages.map(({ id, filePath }) => ({ id, filePath })),
    [
      { id: "legacy", filePath: "D:\\Downloads\\Legacy.exe" },
      { id: "duplicate", filePath: "D:\\Downloads\\Latest.exe" },
      { id: "trusted", filePath: "D:\\Downloads\\Trusted.exe" }
    ]
  );
});
