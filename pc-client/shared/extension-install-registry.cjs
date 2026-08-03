"use strict";

const EXTENSION_INSTALL_REGISTRY = Object.freeze({
  "skill.codex.chatgpt-apps": Object.freeze({
    label: "ChatGPT Apps Skill",
    moduleId: "skill-managed",
    extensionId: "openai-chatgpt-apps-skill",
    hostProductId: "codex-cli",
    capabilities: Object.freeze([
      "website",
      "install",
      "update",
      "repair",
      "uninstall"
    ]),
    adapterId: "directory-snapshot",
    sourcePath: "codex/chatgpt-apps",
    targetRootId: "agent-skills",
    targetRelativePath: "chatgpt-apps",
    sourceManifest: Object.freeze({
      versionRef: "49f948faa9258a0c61caceaf225e179651397431",
      files: Object.freeze({
        "agents/openai.yaml": "c126d350e70b56a26d7b9942bf94b5d99d6972f0b361e1a068b2c04b26242b60",
        "LICENSE.txt": "f40b718f40ec4b8f421f87c4abdea9c32b2c76203c176c947ec4ddaaef5b832c",
        "references/app-archetypes.md": "6004f49292f67fba49d62b0bd149f5279eb6f98d4ad1a0b9d2741dab51e11454",
        "references/apps-sdk-docs-workflow.md": "476ee613f6f9ce507c5a4124db2ba92bd865aee27a9ac733a733e026adb048f0",
        "references/interactive-state-sync-patterns.md": "3eb29a7e4be55b2e567a58b25bd1ee666448dff8a3d91a61aab3e30bedff4657",
        "references/repo-contract-and-validation.md": "604e0be1ae54160d6b7890bd3e0000cc3943560931c72a9451b3dce8df1f98e8",
        "references/search-fetch-standard.md": "2d3d3f4c286aba6abf0501a410889032c934775f5a7042a024ce0e283692b2a6",
        "references/upstream-example-workflow.md": "ed8ec87f75da303df2a97ce290616bdc7e6d2ff02b7d3beb4ff83be3a5585498",
        "references/window-openai-patterns.md": "9313351a77ed8fcfbc7cf31f51ccbadda7ddaa87127a620e58f4125640ea99f3",
        "scripts/scaffold_node_ext_apps.mjs": "3952d9012ddd4b7940b69c024809331ba4e1d39944f89d38f5374e2f15f7acd1",
        "SKILL.md": "928530dd05490d9cd38a8935c824049c5f562422a1bcaa2516ff3032d524ee44"
      })
    })
  }),
  "mcp.codex.openai-developer-docs": Object.freeze({
    label: "OpenAI Developer Docs MCP",
    moduleId: "mcp-managed",
    extensionId: "openai-codex-mcp-config",
    hostProductId: "codex-cli",
    capabilities: Object.freeze([
      "website",
      "install",
      "update",
      "repair",
      "enable",
      "disable",
      "uninstall"
    ]),
    adapterId: "codex-mcp-toml",
    serverId: "openaiDeveloperDocs",
    versionRef: "2026-08-03",
    entry: Object.freeze({ url: "https://developers.openai.com/mcp" })
  }),
  "plugin.claude.commit-commands": Object.freeze({
    label: "Claude Code Commit Commands",
    moduleId: "plugin-managed",
    extensionId: "anthropic-commit-commands-plugin",
    hostProductId: "claude-code",
    capabilities: Object.freeze([
      "website",
      "install",
      "update",
      "repair",
      "enable",
      "disable",
      "uninstall"
    ]),
    adapterId: "claude-plugin-cli",
    pluginId: "commit-commands@anthropics-claude-code",
    scope: "user",
    versionRef: "1.0.0",
    marketplace: Object.freeze({ source: "anthropics/claude-code" })
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
