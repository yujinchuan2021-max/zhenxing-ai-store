"use strict";

const EXTENSION_INSTALL_REGISTRY = Object.freeze({
  "skill.codex.chatgpt-apps": Object.freeze({
    label: "ChatGPT Apps Skill",
    moduleId: "skill-managed",
    extensionId: "openai-chatgpt-apps-skill",
    hostProductId: "codex-cli",
    capabilities: Object.freeze(["website", "install", "uninstall"]),
    adapterId: "directory-snapshot",
    sourcePath: "codex/chatgpt-apps",
    targetRootId: "codex-skills",
    targetRelativePath: "chatgpt-apps"
  })
});

function getExtensionInstallProfile(profileId) {
  return EXTENSION_INSTALL_REGISTRY[profileId] || null;
}

function getExtensionRuntimeProfile(profileId) {
  return EXTENSION_INSTALL_REGISTRY[profileId] || null;
}

function publicExtensionInstallProfiles() {
  return Object.freeze(
    Object.entries(EXTENSION_INSTALL_REGISTRY).map(([id, profile]) =>
      Object.freeze({
        id,
        label: profile.label,
        moduleId: profile.moduleId,
        extensionId: profile.extensionId,
        hostProductId: profile.hostProductId,
        capabilities: profile.capabilities,
        adapterId: profile.adapterId
      })
    )
  );
}

module.exports = {
  EXTENSION_INSTALL_REGISTRY,
  getExtensionInstallProfile,
  getExtensionRuntimeProfile,
  publicExtensionInstallProfiles
};
