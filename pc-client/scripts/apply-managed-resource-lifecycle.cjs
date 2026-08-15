"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { getInstallRegistration } = require("../shared/install-registry.cjs");

const catalogPath = path.join(__dirname, "..", "admin", "data", "catalog-v1.json");
const verifiedAt = "2026-08-04T00:00:00.000Z";

const SKILL_CAPABILITIES = Object.freeze([
  "website",
  "install",
  "update",
  "repair",
  "uninstall"
]);
const FULL_CAPABILITIES = Object.freeze([
  "website",
  "install",
  "update",
  "repair",
  "enable",
  "disable",
  "uninstall"
]);
const MCP_CONFIG_CAPABILITIES = Object.freeze([
  "website",
  "install",
  "update",
  "repair",
  "uninstall"
]);

function requiredResource(catalog, id) {
  const resource = catalog.resources.find((entry) => entry.id === id);
  if (!resource) throw new Error(`Missing reviewed resource: ${id}`);
  return resource;
}

function applyManagedResourceLifecycle(catalog) {
  for (const vendor of catalog.vendors) {
    for (const product of vendor.products || []) {
      if (product.moduleId !== "cli-managed" || product.productType !== "cli") {
        continue;
      }
      const registration = getInstallRegistration(product.id);
      if (registration?.mode === "managed-cli") {
        product.capabilities = [...registration.capabilities];
      }
    }
  }

  const skill = requiredResource(catalog, "openai-chatgpt-apps-skill");
  skill.targets = [
    {
      productId: "codex-cli",
      compatibility: "official",
      moduleId: "skill-managed",
      installProfileId: "skill.codex.chatgpt-apps",
      capabilities: [...SKILL_CAPABILITIES],
      enabled: true
    }
  ];
  skill.requestedPermissions = ["写入 Codex 用户级 Skill 目录"];
  skill.credentialRequirements = ["无需凭据"];
  skill.installScope = "Codex 用户级 ~/.agents/skills/chatgpt-apps 目录";
  skill.uninstallPlan =
    "仅删除收据中逐文件哈希仍匹配的 chatgpt-apps 快照；用户修改或新增内容时停止卸载。";
  skill.lastVerifiedAt = verifiedAt;

  const mcp = requiredResource(catalog, "openai-codex-mcp-config");
  Object.assign(mcp, {
    name: "OpenAI Developer Docs MCP",
    description:
      "OpenAI 官方只读开发者文档 MCP。Codex、Claude Code 和 Cursor 分别使用独立的客户端固定配置与收据。",
    website: "https://developers.openai.com/resources/docs-mcp",
    tutorial: "https://developers.openai.com/codex/mcp",
    versionRef: "2026-08-04",
    requestedPermissions: ["读取公开 OpenAI 开发者文档", "写入所选宿主的一个固定 MCP 配置条目"],
    credentialRequirements: ["无需凭据"],
    installScope: "所选宿主的用户级 openaiDeveloperDocs 条目；每个宿主独立安装和管理",
    uninstallPlan:
      "仅凭对应宿主的合法收据删除内容仍匹配的 openaiDeveloperDocs 条目；不接管同名外部配置。",
    provenanceEvidence: [
      "https://developers.openai.com/resources/docs-mcp",
      "https://developers.openai.com/codex/mcp",
      "https://code.claude.com/docs/en/mcp",
      "https://docs.cursor.com/context/model-context-protocol"
    ],
    lastVerifiedAt: verifiedAt,
    targets: [
      {
        productId: "codex-cli",
        compatibility: "official",
        moduleId: "mcp-managed",
        installProfileId: "mcp.codex.openai-developer-docs",
        capabilities: [...FULL_CAPABILITIES],
        enabled: true
      },
      {
        productId: "claude-code",
        compatibility: "protocol-compatible",
        moduleId: "mcp-managed",
        installProfileId: "mcp.claude-code.openai-developer-docs",
        capabilities: [...MCP_CONFIG_CAPABILITIES],
        enabled: true
      },
      {
        productId: "cursor-desktop",
        compatibility: "protocol-compatible",
        moduleId: "mcp-managed",
        installProfileId: "mcp.cursor.openai-developer-docs",
        capabilities: [...MCP_CONFIG_CAPABILITIES],
        enabled: true
      }
    ]
  });

  const existingPlugin = catalog.resources.find(
    (entry) => entry.id === "anthropic-commit-commands-plugin"
  );
  const plugin = {
    id: "anthropic-commit-commands-plugin",
    name: "Claude Code Commit Commands",
    resourceTypes: ["plugin"],
    description:
      "Anthropic 官方 Git 工作流插件，提供提交、推送与创建 PR 的显式命令。安装和生命周期由 Claude Code 官方插件命令管理。",
    website: "https://github.com/anthropics/claude-code/tree/main/plugins/commit-commands",
    tutorial: "https://code.claude.com/docs/en/discover-plugins",
    publisherVendorId: "anthropic",
    publisher: "Anthropic",
    sourceKind: "official",
    sourceProductIds: [],
    targets: [
      {
        productId: "claude-code",
        compatibility: "official",
        moduleId: "plugin-managed",
        installProfileId: "plugin.claude.commit-commands",
        capabilities: [...FULL_CAPABILITIES],
        enabled: true
      }
    ],
    versionRef: "1.0.0",
    requestedPermissions: ["用户显式调用时可执行 Git 提交、推送和 PR 工作流"],
    credentialRequirements: ["无需新增凭据；推送和 PR 沿用用户现有 Git 或 GitHub 登录"],
    installScope: "Claude Code 用户级插件",
    uninstallPlan:
      "调用 Claude Code 官方 user-scope 卸载命令并保留插件数据；不移除共享 marketplace。",
    provenanceEvidence: [
      "https://github.com/anthropics/claude-code/blob/main/.claude-plugin/marketplace.json",
      "https://github.com/anthropics/claude-code/tree/main/plugins/commit-commands",
      "https://code.claude.com/docs/en/discover-plugins"
    ],
    lastVerifiedAt: verifiedAt,
    enabled: true,
    order: existingPlugin?.order ?? Math.max(...catalog.resources.map((entry) => entry.order || 0)) + 1
  };
  if (existingPlugin) Object.assign(existingPlugin, plugin);
  else catalog.resources.push(plugin);

  catalog.updatedAt = verifiedAt;
  validateCatalog(catalog);
  return catalog;
}

function main() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  applyManagedResourceLifecycle(catalog);
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  process.stdout.write("Applied managed Skill, MCP and plugin lifecycle profiles\n");
}

if (require.main === module) main();

module.exports = {
  applyManagedResourceLifecycle,
  FULL_CAPABILITIES,
  MCP_CONFIG_CAPABILITIES,
  SKILL_CAPABILITIES
};
