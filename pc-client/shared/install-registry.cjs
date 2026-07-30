"use strict";

const { getManagedDownload } = require("./managed-downloads.cjs");

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
    requirements: Object.freeze(["node"]),
    cli: Object.freeze({
      name: "Codex CLI",
      packageName: "@openai/codex"
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
    requirements: Object.freeze(["node", "git"]),
    cli: Object.freeze({
      name: "Claude Code",
      packageName: "@anthropic-ai/claude-code",
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
    requirements: Object.freeze(["node"]),
    cli: Object.freeze({
      name: "Gemini CLI",
      packageName: "@google/gemini-cli"
    })
  }),
  "comfy-desktop": Object.freeze({
    label: "Comfy Desktop",
    profileId: "desktop.comfy",
    moduleId: "desktop-managed",
    vendorId: "comfy",
    productType: "desktop-reviewed",
    kind: "桌面端",
    mode: INSTALL_MODES.MANAGED_INSTALLER,
    requirements: Object.freeze(["python"])
  }),
  "ollama-cli": Object.freeze({
    label: "Ollama",
    profileId: "local-model.ollama",
    moduleId: "local-model-managed",
    vendorId: "ollama",
    productType: "local-model",
    kind: "桌面端",
    mode: INSTALL_MODES.MANAGED_INSTALLER,
    requirements: Object.freeze([])
  })
});

function getInstallRegistration(productId) {
  return INSTALL_REGISTRY[productId] || null;
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
      return Object.freeze({
        id: entry.profileId,
        label: entry.label,
        moduleId: entry.moduleId,
        productId,
        vendorId: entry.vendorId,
        requirements: entry.requirements,
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
  getInstallProfile,
  getInstallRegistration,
  publicInstallProfiles
};
