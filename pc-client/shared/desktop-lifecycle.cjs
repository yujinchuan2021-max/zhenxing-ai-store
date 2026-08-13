"use strict";

const {
  WINDOWS_DESKTOP_PRODUCTS
} = require("./windows-desktop-catalog.cjs");

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const DESKTOP_LIFECYCLES = deepFreeze({
  "chatgpt-desktop": {
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
  },
  "claude-desktop": {
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
  },
  "comfy-desktop": {
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
  },
  "ollama-cli": {
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
  },
  ...Object.fromEntries(
    Object.entries(WINDOWS_DESKTOP_PRODUCTS)
      .filter(([, product]) => product.lifecycle)
      .map(([productId, product]) => [
        productId,
        { productId, ...product.lifecycle }
      ])
  )
});

function getDesktopLifecycle(productId) {
  return DESKTOP_LIFECYCLES[productId] || null;
}

module.exports = {
  getDesktopLifecycle
};
