"use strict";

const { getManagedDownload } = require("./managed-downloads.cjs");
const { getDesktopLifecycle } = require("./desktop-lifecycle.cjs");
const {
  WINDOWS_DESKTOP_PRODUCTS
} = require("./windows-desktop-catalog.cjs");
const { WINDOWS_CLI_PRODUCTS } = require("./windows-cli-catalog.cjs");
const {
  buildProductIntakeDossier,
  validateProductIntakeDossier
} = require("./product-intake-dossier.cjs");
const PRODUCT_INTAKE_APPROVALS = require("./product-intake-approvals.cjs");

const INSTALL_MODES = Object.freeze({
  MANAGED_CLI: "managed-cli",
  MANAGED_INSTALLER: "managed-installer"
});

const INSTALL_REGISTRY = Object.freeze({
  "chatgpt-desktop": Object.freeze({
    label: "ChatGPT Desktop",
    profileId: "desktop.chatgpt",
    moduleId: "desktop-managed",
    vendorId: "openai",
    productType: "desktop-reviewed",
    kind: "桌面端",
    mode: INSTALL_MODES.MANAGED_INSTALLER,
    desktopAdapterId: "appx.openai-codex",
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze([])
  }),
  "claude-desktop": Object.freeze({
    label: "Claude Desktop",
    profileId: "desktop.claude",
    moduleId: "desktop-managed",
    vendorId: "anthropic",
    productType: "desktop-reviewed",
    kind: "桌面端",
    mode: INSTALL_MODES.MANAGED_INSTALLER,
    desktopAdapterId: "squirrel.anthropic-claude",
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze([])
  }),
  "codex-cli": Object.freeze({
    label: "Codex CLI",
    profileId: "cli.codex",
    moduleId: "cli-managed",
    vendorId: "openai",
    productType: "cli",
    kind: "CLI",
    mode: INSTALL_MODES.MANAGED_CLI,
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze(["node"]),
    cli: Object.freeze({
      name: "Codex CLI",
      packageName: "@openai/codex",
      expectedVersion: "0.146.0",
      installSpec: "@openai/codex@0.146.0",
      minimumNodeMajor: 16,
      commandName: "codex"
    })
  }),
  "claude-code": Object.freeze({
    label: "Claude Code",
    profileId: "cli.claude-code",
    moduleId: "cli-managed",
    vendorId: "anthropic",
    productType: "cli",
    kind: "CLI",
    mode: INSTALL_MODES.MANAGED_CLI,
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze(["node", "git"]),
    cli: Object.freeze({
      name: "Claude Code",
      packageName: "@anthropic-ai/claude-code",
      expectedVersion: "2.1.220",
      installSpec: "@anthropic-ai/claude-code@2.1.220",
      minimumNodeMajor: 22,
      commandName: "claude",
      postInstall: Object.freeze({
        manifestCommand: "node install.cjs",
        scriptFile: "install.cjs",
        executableFile: "bin\\claude.exe",
        verificationArgs: Object.freeze(["--version"])
      })
    })
  }),
  "gemini-cli": Object.freeze({
    label: "Gemini CLI",
    profileId: "cli.gemini",
    moduleId: "cli-managed",
    vendorId: "google",
    productType: "cli",
    kind: "CLI",
    mode: INSTALL_MODES.MANAGED_CLI,
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze(["node"]),
    cli: Object.freeze({
      name: "Gemini CLI",
      packageName: "@google/gemini-cli",
      expectedVersion: "0.53.0",
      installSpec: "@google/gemini-cli@0.53.0",
      minimumNodeMajor: 20,
      commandName: "gemini"
    })
  }),
  "google-antigravity-cli": Object.freeze({
    label: "Antigravity CLI",
    profileId: "cli.antigravity",
    moduleId: "cli-managed",
    vendorId: "google",
    productType: "cli",
    kind: "CLI",
    mode: INSTALL_MODES.MANAGED_CLI,
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze([]),
    cli: Object.freeze({
      name: "Antigravity CLI",
      driver: "portable-binary",
      version: "1.1.9",
      commandName: "agy",
      managedEnvironment: Object.freeze({
        AGY_CLI_DISABLE_AUTO_UPDATE: "true"
      }),
      artifacts: Object.freeze({
        x64: Object.freeze({
          url: "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.1.9-6572839516635136/windows-x64/cli_windows_x64.exe",
          fileName: "agy.exe",
          sha512: "ea4e55761b8252dcf5e051c61b1cdae1dcafcb9b8a76672aab13a2e8407fd8ae9fa5a389449f594c2fc970991afd5188a4bead1b06fe86dbb096ac2472893af1",
          maximumBytes: 256 * 1024 * 1024,
          allowedHosts: Object.freeze(["storage.googleapis.com"])
        }),
        arm64: Object.freeze({
          url: "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.1.9-6572839516635136/windows-arm/cli_windows_arm64.exe",
          fileName: "agy.exe",
          sha512: "e9ee3960b023adec8bf6add28339bd9ab7cddf01f6d4e9374dc134faa21a44d195a0cb8dd5a0e308e37137f38a631630fec5094662cda13eadce26b009f853f4",
          maximumBytes: 256 * 1024 * 1024,
          allowedHosts: Object.freeze(["storage.googleapis.com"])
        })
      })
    })
  }),
  "moonshot-kimi-code-cli": Object.freeze({
    label: "Kimi Code CLI",
    profileId: "cli.kimi-code",
    moduleId: "cli-managed",
    vendorId: "moonshot",
    productType: "cli",
    kind: "CLI",
    mode: INSTALL_MODES.MANAGED_CLI,
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze(["git"]),
    cli: Object.freeze({
      name: "Kimi Code CLI",
      driver: "portable-binary",
      version: "0.31.1",
      commandName: "kimi",
      managedEnvironment: Object.freeze({
        KIMI_CODE_NO_AUTO_UPDATE: "1"
      }),
      managedSettings: Object.freeze({
        format: "toml",
        relativePath: Object.freeze([".kimi-code", "tui.toml"]),
        values: Object.freeze({
          upgrade: Object.freeze({ auto_install: false })
        })
      }),
      artifacts: Object.freeze({
        x64: Object.freeze({
          url: "https://cdn.kimi.com/kimi-code/binaries/0.31.1/kimi-code-win32-x64.exe",
          fileName: "kimi.exe",
          sha256: "50e7aaa5db973553871e617af76df7470d305c36954298928a86f9ecdcd3ce5a",
          maximumBytes: 192 * 1024 * 1024,
          allowedHosts: Object.freeze(["cdn.kimi.com"])
        }),
        arm64: Object.freeze({
          url: "https://cdn.kimi.com/kimi-code/binaries/0.31.1/kimi-code-win32-arm64.exe",
          fileName: "kimi.exe",
          sha256: "f03fdd012ad4e9893c35f0e8e85a7a559c04b406d9e803c9e77081064ddd171e",
          maximumBytes: 192 * 1024 * 1024,
          allowedHosts: Object.freeze(["cdn.kimi.com"])
        })
      })
    })
  }),
  "openclaw-agent": Object.freeze({
    label: "OpenClaw",
    profileId: "cli.openclaw",
    moduleId: "cli-managed",
    vendorId: "openclaw",
    productType: "cli",
    kind: "CLI",
    mode: INSTALL_MODES.MANAGED_CLI,
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze(["node"]),
    cli: Object.freeze({
      name: "OpenClaw",
      packageName: "openclaw",
      expectedVersion: "2026.7.1-2",
      installSpec: "openclaw@2026.7.1-2",
      minimumNodeMajor: 22,
      supportedNodeRanges: Object.freeze([
        Object.freeze({ minimum: "22.22.3", maximumExclusive: "23.0.0" }),
        Object.freeze({ minimum: "24.15.0", maximumExclusive: "25.0.0" }),
        Object.freeze({ minimum: "25.9.0", maximumExclusive: "26.0.0" })
      ]),
      commandName: "openclaw",
      launchArgs: Object.freeze(["onboard", "--install-daemon"]),
      postInstall: Object.freeze({
        manifestCommand: "node scripts/postinstall-bundled-plugins.mjs",
        scriptFile: "scripts\\postinstall-bundled-plugins.mjs",
        executableFile: "openclaw.mjs",
        verificationWithNode: true,
        verificationArgs: Object.freeze(["--version"])
      }),
      beforeUninstall: Object.freeze({
        executableFile: "openclaw.mjs",
        args: Object.freeze([
          "uninstall", "--service", "--yes", "--non-interactive"
        ])
      })
    })
  }),
  "openclaw-wsl-gateway": Object.freeze({
    label: "OpenClaw WSL Gateway",
    profileId: "cli.openclaw-wsl",
    moduleId: "cli-managed",
    vendorId: "openclaw",
    productType: "cli",
    kind: "CLI",
    mode: INSTALL_MODES.MANAGED_CLI,
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze(["wsl"]),
    cli: Object.freeze({
      name: "OpenClaw WSL Gateway",
      driver: "companion-runtime",
      distribution: "OpenClawGateway",
      hubProductId: "openclaw-windows-hub",
      requiresInstallDirectory: false,
      commandName: "openclaw",
      setupAction: "setup",
      openAction: "commandcenter",
      setupTimeoutMs: 20 * 60 * 1_000,
      cleanupScript: "Uninstall-LocalGateway.ps1",
      cleanupScriptSha256: "ab1b05459c7016837fa9cd3c2235463e07036d3082c680b3b7b047260769aaef",
      officialSources: Object.freeze([
        "https://github.com/openclaw/openclaw/blob/main/docs/platforms/windows.md",
        "https://github.com/openclaw/openclaw-windows-node/blob/main/docs/SETUP.md",
        "https://github.com/openclaw/openclaw-windows-node/blob/main/src/OpenClaw.SetupEngine/default-config.json"
      ])
    })
  }),
  ...Object.fromEntries(
    Object.entries(WINDOWS_CLI_PRODUCTS).map(([productId, product]) => [
      productId,
      Object.freeze({
        ...product,
        mode: INSTALL_MODES.MANAGED_CLI
      })
    ])
  ),
  "comfy-desktop": Object.freeze({
    label: "Comfy Desktop",
    profileId: "desktop.comfy",
    moduleId: "desktop-managed",
    vendorId: "comfy",
    productType: "desktop-reviewed",
    kind: "桌面端",
    mode: INSTALL_MODES.MANAGED_INSTALLER,
    desktopAdapterId: "nsis.comfy-desktop",
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze([])
  }),
  "ollama-cli": Object.freeze({
    label: "Ollama",
    profileId: "local-model.ollama",
    moduleId: "local-model-managed",
    vendorId: "ollama",
    productType: "local-model",
    kind: "桌面端",
    mode: INSTALL_MODES.MANAGED_INSTALLER,
    desktopAdapterId: "inno.ollama",
    capabilities: Object.freeze([
      "website", "tutorial", "install", "open", "uninstall"
    ]),
    requirements: Object.freeze([])
  }),
  ...Object.fromEntries(
    Object.entries(WINDOWS_DESKTOP_PRODUCTS).map(([productId, product]) => [
      productId,
      Object.freeze({
        label: product.label,
        profileId: product.profileId,
        moduleId: "desktop-managed",
        vendorId: product.vendorId,
        productType: "desktop-reviewed",
        kind: "桌面端",
        mode: INSTALL_MODES.MANAGED_INSTALLER,
        desktopAdapterId: product.adapterId,
        capabilities: product.capabilities,
        requirements: product.requirements
      })
    ])
  )
});

function getInstallRegistration(productId) {
  return INSTALL_REGISTRY[productId] || null;
}

function getProductIntakeDossier(productId) {
  const registration = getInstallRegistration(productId);
  if (!registration) return null;
  const dossier = buildProductIntakeDossier(
    productId,
    registration,
    getManagedDownload(productId),
    PRODUCT_INTAKE_APPROVALS[productId] || null
  );
  return validateProductIntakeDossier(dossier) ? null : Object.freeze(dossier);
}

function getInstallProfile(profileId) {
  return (
    Object.values(INSTALL_REGISTRY).find(
      (entry) => entry.profileId === profileId
    ) || null
  );
}

function publicInstallProfiles() {
  return Object.freeze(
    Object.entries(INSTALL_REGISTRY).map(([productId, entry]) => {
      const download = getManagedDownload(productId);
      const lifecycle = getDesktopLifecycle(productId);
      return Object.freeze({
        id: entry.profileId,
        label: entry.label,
        moduleId: entry.moduleId,
        productId,
        vendorId: entry.vendorId,
        productType: entry.productType,
        kind: entry.kind,
        mode: entry.mode,
        requirements: entry.requirements,
        capabilities: entry.capabilities,
        ...(lifecycle ? { lifecycle } : {}),
        ...(download
          ? {
              download: Object.freeze({
                url: download.url,
                fileName: download.fileName
              })
            }
          : {})
      });
    })
  );
}

function cliInstallPlans() {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(INSTALL_REGISTRY)
        .filter(([, entry]) => entry.mode === INSTALL_MODES.MANAGED_CLI)
        .map(([productId, entry]) => [
          productId,
          Object.freeze({
            ...entry.cli,
            requirements: entry.requirements
          })
        ])
    )
  );
}

module.exports = {
  INSTALL_MODES,
  INSTALL_REGISTRY,
  cliInstallPlans,
  getProductIntakeDossier,
  getInstallProfile,
  getInstallRegistration,
  publicInstallProfiles
};
