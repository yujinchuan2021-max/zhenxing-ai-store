"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getDesktopLifecycle
} = require("../shared/desktop-lifecycle.cjs");
const {
  getDesktopAdapterForProduct
} = require("../shared/desktop-adapters.cjs");
const { getManagedDownload } = require("../shared/managed-downloads.cjs");
const {
  getInstallRegistration,
  publicInstallProfiles
} = require("../shared/install-registry.cjs");
const { validateProductPolicy } = require("../shared/product-policy.cjs");
const catalog = require("../admin/data/catalog-v1.json");

function catalogProduct(productId) {
  return catalog.vendors
    .flatMap((vendor) => vendor.products)
    .find((product) => product.id === productId);
}

function catalogVendorProduct(productId) {
  for (const vendor of catalog.vendors) {
    const product = vendor.products.find((candidate) => candidate.id === productId);
    if (product) return { vendor, product };
  }
  return null;
}

test("ChatGPT lifecycle is a deeply read-only client contract", () => {
  const lifecycle = getDesktopLifecycle("chatgpt-desktop");

  assert.deepEqual(lifecycle, {
    productId: "chatgpt-desktop",
    updateOwner: "microsoft-store-openai",
    updateStrategy: "vendor-auto-update",
    latestSource: "https://chatgpt.com/download/",
    dataRetention: {
      mode: "platform-defined",
      retainedPaths: [],
      userChoiceRequired: false
    },
    installerIdentity: {
      kind: "microsoft-store",
      installerKind: "store-bootstrapper",
      storeProductId: "9PLM9XGG6VKS",
      packageIdentityName: "OpenAI.Codex",
      packageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0",
      downloadedFile: {
        architecture: "x86",
        versionInfo: {
          ProductName: /^Store Installer$/i,
          FileDescription: /^Store Installer$/i,
          OriginalFilename: /^StoreInstaller\.exe$/i,
          CompanyName: /^Microsoft Corporation$/i
        }
      }
    }
  });
  assert.equal(Object.isFrozen(lifecycle), true);
  assert.equal(Object.isFrozen(lifecycle.dataRetention), true);
  assert.equal(Object.isFrozen(lifecycle.dataRetention.retainedPaths), true);
  assert.equal(Object.isFrozen(lifecycle.installerIdentity), true);
  assert.throws(() => {
    lifecycle.updateOwner = "backend-value";
  }, TypeError);
  assert.throws(() => {
    lifecycle.installerIdentity.storeProductId = "9NT1R1C2HH7J";
  }, TypeError);
  assert.equal(getDesktopLifecycle("unknown-product"), null);
});

test("Claude lifecycle leaves updates to Claude or enterprise MDM exclusively", () => {
  assert.deepEqual(getDesktopLifecycle("claude-desktop"), {
    productId: "claude-desktop",
    updateOwner: "claude-or-enterprise-mdm",
    updateStrategy: "exclusive-vendor-or-mdm",
    latestSource:
      "https://claude.ai/api/desktop/win32/x64/setup/latest/redirect",
    dataRetention: {
      mode: "vendor-unspecified",
      retainedPaths: [],
      userChoiceRequired: false
    },
    installerIdentity: {
      kind: "vendor-setup-or-msix",
      installerKind: "vendor-installer",
      consumerDistribution: "setup",
      appxIdentityName: "Claude",
      consumerProductCodePublished: false,
      downloadedFile: {
        architecture: "x64",
        versionInfo: {
          ProductName: /^Claude$/i,
          FileDescription: /^Claude Setup$/i,
          OriginalFilename: /^ClaudeSetup\.exe$/i,
          CompanyName: /^Anthropic, PBC$/i
        }
      }
    }
  });
});

test("Comfy lifecycle retains every documented user-data directory", () => {
  assert.deepEqual(getDesktopLifecycle("comfy-desktop"), {
    productId: "comfy-desktop",
    updateOwner: "comfy-desktop",
    updateStrategy: "vendor-auto-update",
    latestSource: "https://dl.todesktop.com/241130tqe9q3y",
    dataRetention: {
      mode: "retain-listed-data",
      retainedPaths: [
        "%USERPROFILE%\\ComfyUI-Installs",
        "%USERPROFILE%\\ComfyUI-Shared",
        "%APPDATA%\\Comfy Desktop"
      ],
      userChoiceRequired: false
    },
    installerIdentity: {
      kind: "nsis",
      installerKind: "vendor-installer",
      appId: "com.todesktop.241012ess7yxs0e",
      productName: "Comfy Desktop",
      perMachine: false,
      downloadedFile: {
        architecture: "x86",
        versionInfo: {
          ProductName: /^Comfy Desktop$/i,
          FileDescription: /^Comfy Desktop$/i,
          CompanyName: /^Comfy Org$/i
        }
      }
    }
  });
});

test("Ollama lifecycle delegates model retention to the vendor uninstaller", () => {
  assert.deepEqual(getDesktopLifecycle("ollama-cli"), {
    productId: "ollama-cli",
    updateOwner: "ollama",
    updateStrategy: "vendor-auto-download-user-restart",
    latestSource: "https://ollama.com/download/OllamaSetup.exe",
    dataRetention: {
      mode: "vendor-uninstaller-choice",
      retainedPaths: [
        "%USERPROFILE%\\.ollama\\models",
        "%OLLAMA_MODELS%"
      ],
      userChoiceRequired: true
    },
    installerIdentity: {
      kind: "inno",
      installerKind: "vendor-installer",
      appId: "{44E83376-CE68-45EB-8FC1-393500EB558C}",
      productName: "Ollama",
      publisher: "Ollama",
      perMachine: false,
      downloadedFile: {
        architecture: "x86",
        versionInfo: {
          ProductName: /^\s*Ollama\s*$/i,
          FileDescription: /^\s*Ollama Setup\s*$/i,
          CompanyName: /^\s*Ollama\s*$/i
        }
      }
    }
  });
});

test("Ollama retention choice cannot be bypassed by a silent uninstall launch", () => {
  const adapter = getDesktopAdapterForProduct("ollama-cli");

  assert.equal(adapter.uninstallMode, "interactive");
  assert.equal(adapter.uninstall.launchWithoutArguments, true);
  assert.equal(
    getDesktopLifecycle("ollama-cli").dataRetention.userChoiceRequired,
    true
  );
});

test("Comfy Desktop current presence excludes the legacy ComfyUI Desktop V1 identity", () => {
  const adapter = getDesktopAdapterForProduct("comfy-desktop");

  assert.deepEqual(adapter.names, ["Comfy Desktop"]);
  assert.deepEqual(adapter.executableNames, ["Comfy Desktop.exe"]);
  assert.equal(adapter.uninstall.displayName.test("ComfyUI Desktop 1.0.31"), false);
  assert.equal(
    adapter.uninstall.executableName.test("Uninstall ComfyUI Desktop.exe"),
    false
  );
  assert.equal(adapter.legacyInstall.id, "comfy-desktop-v1");
  assert.deepEqual(adapter.legacyInstall.executableNames, [
    "ComfyUI Desktop.exe",
    "ComfyUI.exe"
  ]);
  assert.equal(
    adapter.legacyInstall.uninstall.displayName.test("ComfyUI Desktop 1.0.31"),
    true
  );
  assert.equal(
    adapter.legacyInstall.uninstall.displayName.test("Comfy Desktop 1.0.31"),
    true,
    "a current-looking display name with the legacy executable/uninstaller remains migration-only"
  );
});

test("Claude always launches the reviewed vendor uninstall UI", () => {
  const adapter = getDesktopAdapterForProduct("claude-desktop");

  assert.equal(adapter.uninstallMode, "interactive");
  assert.deepEqual(adapter.uninstall.allowedArguments, [
    ["--uninstall"],
    ["--uninstall", "-s"]
  ]);
  assert.deepEqual(adapter.uninstall.launchArguments, ["--uninstall"]);
  assert.equal(adapter.appx.uninstallStrategy, "windows-settings");
});

test("reviewed desktop adapters expose their client-owned installer identity", () => {
  for (const productId of [
    "chatgpt-desktop",
    "claude-desktop",
    "comfy-desktop",
    "ollama-cli"
  ]) {
    assert.deepEqual(
      getDesktopAdapterForProduct(productId).installerIdentity,
      getDesktopLifecycle(productId).installerIdentity,
      productId
    );
  }
});

test("Claude and Comfy use the current official consumer download entries", () => {
  assert.equal(
    getManagedDownload("claude-desktop").url,
    "https://claude.ai/api/desktop/win32/x64/setup/latest/redirect"
  );
  assert.equal(
    catalogProduct("claude-desktop").download.url,
    "https://claude.ai/api/desktop/win32/x64/setup/latest/redirect"
  );
  assert.equal(
    getManagedDownload("comfy-desktop").url,
    "https://dl.todesktop.com/241130tqe9q3y"
  );
  assert.equal(
    catalogProduct("comfy-desktop").download.url,
    "https://dl.todesktop.com/241130tqe9q3y"
  );
});

test("Comfy Desktop does not install an unsupported system Python prerequisite", () => {
  assert.deepEqual(
    getInstallRegistration("comfy-desktop").requirements,
    []
  );
  assert.deepEqual(catalogProduct("comfy-desktop").requirements, []);
});

test("backend catalog data cannot override client lifecycle contracts", () => {
  const lifecycleFields = [
    "updateOwner",
    "updateStrategy",
    "latestSource",
    "dataRetention",
    "installerIdentity"
  ];
  for (const productId of [
    "chatgpt-desktop",
    "claude-desktop",
    "comfy-desktop",
    "ollama-cli"
  ]) {
    const { vendor, product } = catalogVendorProduct(productId);
    for (const field of lifecycleFields) {
      assert.equal(Object.hasOwn(product, field), false, `${productId}:${field}`);
      assert.match(
        validateProductPolicy({ ...product, [field]: "backend-value" }, vendor.id),
        /不支持的策略字段/,
        `${productId}:${field}`
      );
    }
  }
});

test("public install profiles expose lifecycle metadata from the client whitelist", () => {
  const profiles = publicInstallProfiles();
  for (const productId of [
    "chatgpt-desktop",
    "claude-desktop",
    "comfy-desktop",
    "ollama-cli"
  ]) {
    const profile = profiles.find((candidate) => candidate.productId === productId);
    assert.deepEqual(profile.lifecycle, getDesktopLifecycle(productId), productId);
    assert.equal(Object.isFrozen(profile.lifecycle), true, productId);
  }
  assert.equal(
    Object.hasOwn(
      profiles.find((candidate) => candidate.productId === "codex-cli"),
      "lifecycle"
    ),
    false
  );
});
