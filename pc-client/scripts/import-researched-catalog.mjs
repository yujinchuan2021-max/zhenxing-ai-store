import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { normalizeCatalog, validateCatalog } = require("../shared/catalog.cjs");
const { applyConnectableTaxonomy } = require("../catalog/ai-connectable-taxonomy.cjs");

const root = path.resolve(import.meta.dirname, "..");
const researchPath = path.join(
  root,
  "docs",
  "research",
  "2026-07-31-ai-vendor-product-agent-ecosystem.md"
);
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");

const vendorAliases = new Map([
  ["langgenius", "dify"]
]);

const productAliases = new Map([
  ["openai-chatgpt-web", "chatgpt-desktop"],
  ["openai-chatgpt-desktop", "chatgpt-desktop"],
  ["openai-codex-cli", "codex-cli"],
  ["anthropic-claude-web", "claude-desktop"],
  ["anthropic-claude-desktop", "claude-desktop"],
  ["anthropic-claude-code-cli", "claude-code"],
  ["anthropic-claude-code-desktop", "claude-desktop"],
  ["google-gemini-web", "gemini-web"],
  ["google-gemini-cli", "gemini-cli"],
  ["microsoft-copilot", "microsoft-copilot-desktop"],
  ["github-copilot", "github-copilot"],
  ["bytedance-trae", "trae-desktop"],
  ["bytedance-coze", "coze-web"],
  ["bytedance-jimeng", "jimeng-web"],
  ["doubao", "bytedance-doubao"],
  ["tencent-yuanbao", "tencent-yuanbao-desktop"],
  ["qianwen-web", "alibaba-qwen-studio"],
  ["deepseek-chat-web", "deepseek-web"],
  ["moonshot-kimi", "kimi-web"],
  ["zhipu-qingyan", "zhipu-qingyan-web"],
  ["midjourney-web", "midjourney-web"],
  ["runway-web", "runway-web"],
  ["ollama-windows", "ollama-cli"],
  ["comfy-desktop", "comfy-desktop"],
  ["cursor-desktop", "cursor-desktop"],
  ["dify", "dify-web"],
  ["anythingllm", "anythingllm-desktop"]
]);

const resourceTargetAliases = new Map([
  ["openai-codex", "codex-cli"],
  ["anthropic-claude-code-cli", "claude-code"],
  ["google-gemini-cli", "gemini-cli"],
  ["moonshot-kimi-code-cli", "moonshot-kimi-code-cli"],
  ["anythingllm", "anythingllm-desktop"]
]);

const productTypeOverrides = new Map([
  ["baidu-wenxiaoyan", "web"],
  ["openai-codex", "web"]
]);

const productNameOverrides = new Map([
  ["bytedance-doubao", "豆包"],
  ["alibaba-qwen-studio", "千问"],
  ["microsoft-copilot-desktop", "Microsoft Copilot"],
  ["tencent-yuanbao-desktop", "腾讯元宝"],
  ["chatgpt-desktop", "ChatGPT"],
  ["claude-desktop", "Claude"]
]);

const resourceNameOverrides = new Map([
  ["openai-codex-skills-catalog", "OpenAI Codex Skills"],
  ["openai-codex-mcp-config", "Codex MCP 配置"],
  ["anthropic-official-plugin-marketplace", "Claude Code 官方插件市场"],
  ["anthropic-claude-code-mcp", "Claude Code MCP"],
  ["google-gemini-cli-extensions", "Gemini CLI Extensions"],
  ["github-copilot-mcp", "GitHub Copilot MCP"],
  ["microsoft-playwright-mcp", "Microsoft Playwright MCP"],
  ["microsoft-azure-mcp", "Microsoft Azure MCP"],
  ["amazon-kiro-powers", "Kiro Powers"],
  ["aws-mcp-servers", "AWS MCP Servers"],
  ["moonshot-kimi-plugins", "Kimi Code 插件"],
  ["minimax-official-skills", "MiniMax 官方 Skills"],
  ["minimax-official-mcp", "MiniMax MCP"],
  ["hf-agent-skills", "Hugging Face Agent Skills"],
  ["hf-mcp-server", "Hugging Face MCP"],
  ["openclaw-clawhub-skills", "OpenClaw ClawHub Skills"],
  ["openclaw-clawhub-plugins", "OpenClaw ClawHub 插件"],
  ["hermes-agent-skills", "Hermes Agent Skills"],
  ["cline-official-skills-plugins", "Cline Skills、Plugins 与 MCP"],
  ["opencode-agent-skills", "OpenCode Agent Skills"],
  ["anythingllm-agent-skills", "AnythingLLM Agent Skills 与 MCP"],
  ["comfy-custom-nodes", "Comfy Custom Nodes"],
  ["pika-mcp-skills", "Pika MCP Skills"]
]);

const CHATGPT_APPS_COMMIT = "49f948faa9258a0c61caceaf225e179651397431";

function managedChatgptAppsResource(order) {
  const treeUrl = `https://github.com/openai/skills/tree/${CHATGPT_APPS_COMMIT}/skills/.curated/chatgpt-apps`;
  return {
    id: "openai-chatgpt-apps-skill",
    name: "ChatGPT Apps Skill",
    resourceTypes: ["skill"],
    description:
      "OpenAI 官方 curated Skill，用于设计、搭建和检查基于 Apps SDK 的 ChatGPT 应用。枕星 AI 固定安装经过审核的目录快照。",
    website: treeUrl,
    tutorial: `https://github.com/openai/skills/blob/${CHATGPT_APPS_COMMIT}/skills/.curated/chatgpt-apps/SKILL.md`,
    sourceProductIds: [],
    targets: [
      {
        productId: "codex-cli",
        compatibility: "official",
        moduleId: "skill-managed",
        installProfileId: "skill.codex.chatgpt-apps",
        capabilities: ["website", "install", "uninstall"],
        enabled: true
      }
    ],
    enabled: true,
    order,
    sourceKind: "official",
    versionRef: CHATGPT_APPS_COMMIT,
    requestedPermissions: ["写入 Codex 用户级 skills 目录"],
    credentialRequirements: [],
    installScope: "Codex 用户级 skills/chatgpt-apps 目录",
    uninstallPlan:
      "仅删除枕星 AI 回执记录的 chatgpt-apps 目录；保留 Codex skills 根目录和其他 Skill。",
    provenanceEvidence: [
      "https://github.com/openai/skills",
      `https://github.com/openai/skills/commit/${CHATGPT_APPS_COMMIT}`,
      treeUrl
    ],
    lastVerifiedAt: "2026-07-31T11:23:00.000Z",
    publisher: "OpenAI"
  };
}

const productPolicies = Object.freeze({
  web: Object.freeze({
    directoryKind: "ai-tool",
    kind: "其他产品",
    moduleId: "web-link",
    installPolicy: "open-product-website",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["website", "tutorial"]
  }),
  "desktop-official": Object.freeze({
    directoryKind: "ai-tool",
    kind: "桌面端",
    moduleId: "desktop-official",
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    capabilities: ["website", "tutorial"]
  }),
  "cli-official": Object.freeze({
    directoryKind: "ai-tool",
    kind: "CLI",
    moduleId: "cli-official",
    installPolicy: "open-official-install",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["website", "tutorial"]
  }),
  cli: Object.freeze({
    directoryKind: "ai-tool",
    kind: "CLI",
    moduleId: "cli-managed",
    installPolicy: "client-managed-cli",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "client-managed",
    capabilities: ["website", "tutorial", "install", "open", "uninstall"]
  }),
  tutorial: Object.freeze({
    directoryKind: "ai-tool",
    kind: "其他产品",
    moduleId: "tutorial-link",
    installPolicy: "open-tutorial",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["tutorial"]
  })
});

function parseCodeAndLabel(value) {
  const match = value.trim().match(/^`([^`]+)`\s*(.*)$/);
  if (!match) return null;
  return { id: match[1].trim(), label: match[2].trim() };
}

function parseLinks(value) {
  return [...value.matchAll(/\[[^\]]+\]\((https:\/\/[^)]+)\)/g)].map(
    (match) => match[1]
  );
}

function cleanText(value, fallback) {
  const cleaned = value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, 500);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function researchRows(markdown) {
  const lines = markdown.split(/\r?\n/);
  const rows = [];
  let section = "";
  for (const line of lines) {
    if (/^### 3\./.test(line)) section = "products";
    else if (/^## 4\./.test(line)) section = "agents";
    else if (/^## 5\./.test(line)) section = "resources";
    if (!line.startsWith("| `")) continue;
    const cells = splitTableRow(line);
    if (section === "products" && cells.length === 8) {
      rows.push({
        section,
        vendor: cells[0],
        product: cells[1],
        rawType: cells[3],
        links: cells[4],
        candidate: cells[6],
        notes: cells[7]
      });
    } else if (section === "agents" && cells.length === 7) {
      rows.push({
        section,
        vendor: cells[0],
        product: cells[1],
        rawType: cells[2],
        links: cells[3],
        candidate: cells[5],
        notes: cells[6]
      });
    } else if (section === "resources" && cells.length === 6) {
      rows.push({
        section,
        resource: cells[0],
        target: cells[1],
        rawType: cells[2],
        links: cells[3],
        candidate: cells[4],
        notes: cells[5]
      });
    }
  }
  return rows;
}

function chooseProductType(row, productId) {
  if (productTypeOverrides.has(productId)) {
    return productTypeOverrides.get(productId);
  }
  if (row.candidate.includes("B") && row.rawType.includes("desktop")) {
    return "desktop-official";
  }
  if (row.candidate.includes("A") && row.rawType.includes("cli")) {
    return "cli-official";
  }
  if (row.candidate.includes("C") && row.rawType.includes("web")) {
    return "web";
  }
  return "tutorial";
}

function chooseCategory(row, productName) {
  const value = `${row.rawType} ${productName}`.toLowerCase();
  if (row.rawType.includes("agent")) return "智能体";
  if (row.rawType.includes("local-model")) return "本地模型";
  if (/hailuo|kling|runway|pika|sora|video|即梦|可灵|海螺/.test(value)) {
    return "视频创作";
  }
  if (/stable|dreamstudio|flux|midjourney|image/.test(value)) {
    return "图像创作";
  }
  if (
    /cli|sdk|api|studio|platform|foundry|framework|stack|workbench|models|hub|cog|code|copilot/.test(
      value
    )
  ) {
    return "编程开发";
  }
  return "AI 对话";
}

const REVIEWED_VENDOR_INITIALS = new Map([
  ["alibaba", "A"],
  ["baichuan", "B"],
  ["baidu", "B"],
  ["bytedance", "Z"],
  ["deepseek", "S"],
  ["iflytek", "K"],
  ["kingsoft", "J"],
  ["kuaishou", "K"],
  ["laiye", "L"],
  ["meitu", "M"],
  ["moonshot", "Y"],
  ["oray", "B"],
  ["sensetime", "S"],
  ["tencent", "T"],
  ["yingdao", "Y"],
  ["youdao", "W"],
  ["zhipu", "Z"]
]);

function vendorInitial(name, id) {
  const reviewedInitial = REVIEWED_VENDOR_INITIALS.get(id);
  if (reviewedInitial) return reviewedInitial;
  return (name.match(/[A-Za-z]/)?.[0] || id.match(/[A-Za-z]/)?.[0] || "A").toUpperCase();
}

function vendorColor(id) {
  return `#${crypto.createHash("sha256").update(id).digest("hex").slice(0, 6)}`;
}

function makeProduct(row, productId, productName, order) {
  const urls = parseLinks(row.links);
  if (!urls.length) throw new Error(`研究记录缺少官方 URL：${productId}`);
  const productType = chooseProductType(row, productId);
  const policy = productPolicies[productType];
  return {
    id: productId,
    name: productName,
    ...policy,
    category: chooseCategory(row, productName),
    description: cleanText(row.notes, `${productName} 官方产品。`),
    website: urls[0],
    tutorial: urls[1] || urls[0],
    productType,
    requirements: [],
    installProfileId: "",
    enabled: true,
    order,
    capabilities: [...policy.capabilities]
  };
}

const reviewedResourceTypes = new Map([
  ["anthropic-official-plugin-marketplace", ["plugin"]],
  ["comfy-custom-nodes", ["plugin"]],
  ["google-gemini-cli-extensions", ["plugin"]],
  ["moonshot-kimi-plugins", ["plugin"]],
  ["anythingllm-agent-skills", ["skill", "mcp"]],
  ["amazon-kiro-powers", ["plugin"]],
  ["pika-mcp-skills", ["mcp", "skill"]],
  ["openclaw-clawhub-plugins", ["plugin"]],
  ["cline-official-skills-plugins", ["skill", "mcp", "plugin"]]
]);

function resourceTypesFor(rawType, resourceId) {
  const reviewed = reviewedResourceTypes.get(resourceId);
  if (reviewed) return [...reviewed];
  const declared = [...new Set(rawType.toLowerCase().match(/skill|mcp|plugin/g) || [])];
  if (declared.length) return declared;
  if (resourceId.includes("plugin")) return ["plugin"];
  return [resourceId.includes("mcp") ? "mcp" : "skill"];
}

function cleanLegacyResourceDescription(value) {
  return value
    .replace(
      /\s*原始形态为 [^。]+，当前按最接近的 (?:skill|mcp) 子目录展示。/g,
      ""
    )
    .trim();
}

function makeResource(row, resourceId, targetProductId, publisher, order) {
  const urls = parseLinks(row.links);
  if (!urls.length) throw new Error(`资源记录缺少官方 URL：${resourceId}`);
  return {
    id: resourceId,
    name:
      resourceNameOverrides.get(resourceId) ||
      resourceId
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    resourceTypes: resourceTypesFor(row.rawType, resourceId),
    description: cleanLegacyResourceDescription(
      cleanText(row.notes, `${resourceId} 官方资源入口。`)
    ),
    website: urls[0],
    tutorial: urls[1] || urls[0],
    sourceProductIds: [],
    targets: [
      {
        productId: targetProductId,
        compatibility: "official",
        moduleId: "resource-link",
        installProfileId: "",
        capabilities: ["website"],
        enabled: true
      }
    ],
    sourceKind: "official",
    publisher,
    versionRef: "rolling-directory",
    requestedPermissions: [],
    credentialRequirements: [],
    installScope: "产品内扩展目录",
    uninstallPlan: "当前仅打开官方入口，不写入本地文件。",
    provenanceEvidence: [...new Set(urls)],
    lastVerifiedAt: "2026-07-31T00:00:00.000+08:00",
    enabled: true,
    order
  };
}

function findProductOwner(catalog, productId) {
  for (const vendor of catalog.vendors) {
    const product = vendor.products.find((item) => item.id === productId);
    if (product) return { vendor, product };
  }
  return null;
}

function findProduct(catalog, productId) {
  return findProductOwner(catalog, productId)?.product || null;
}

function upsertResource(catalog, resource) {
  const existingIndex = catalog.resources.findIndex(
    (candidate) => candidate.id === resource.id
  );
  if (existingIndex === -1) {
    catalog.resources.push(resource);
    return true;
  }
  catalog.resources[existingIndex] = {
    ...resource,
    order: catalog.resources[existingIndex].order
  };
  return false;
}

const verifiedProductUpserts = Object.freeze([
  Object.freeze({
    vendorId: "moonshot",
    product: Object.freeze({
      id: "kimi-work-desktop",
      name: "Kimi Work",
      ...productPolicies["desktop-official"],
      category: "智能体",
      description: "Kimi 官方 Windows 与 macOS 桌面客户端，可在本机处理文件、操作浏览器并执行自动化任务。",
      website: "https://www.kimi.com/zh-cn/products/kimi-work",
      tutorial: "https://www.kimi.com/zh-cn/resources/kimi-work-introduction",
      productType: "desktop-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["desktop-official"].capabilities]
    })
  }),
  Object.freeze({
    vendorId: "moonshot",
    product: Object.freeze({
      id: "kimi-claw",
      name: "Kimi Claw",
      ...productPolicies.web,
      category: "智能体",
      description: "Kimi 集成的 OpenClaw 智能体，支持云端一键创建，也可通过 Kimi 桌面端部署到本机。",
      website: "https://www.kimi.com/zh-cn/resources/kimi-claw-introduction",
      tutorial: "https://www.kimi.com/help/kimi-claw",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "moonshot",
    product: Object.freeze({
      id: "kimi-claw-desktop",
      name: "Kimi Claw 本地部署",
      ...productPolicies["desktop-official"],
      category: "智能体",
      description: "在 Kimi Work 内点击部署到本机，由 Kimi 桌面端自动配置 OpenClaw、模型和搜索能力。",
      website: "https://www.kimi.com/zh-cn/products/kimi-work",
      tutorial: "https://www.kimi.com/help/kimi-claw/desktop-deployment-guide",
      productType: "desktop-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["desktop-official"].capabilities]
    })
  }),
  Object.freeze({
    vendorId: "moonshot",
    product: Object.freeze({
      id: "kimi-webbridge",
      name: "Kimi WebBridge",
      ...productPolicies.web,
      category: "智能体",
      description: "连接 Kimi Work 或本地智能体与浏览器的官方扩展，让智能体在授权后操作当前浏览器。",
      website: "https://www.kimi.com/zh-cn/features/webbridge",
      tutorial: "https://www.kimi.com/zh-cn/features/webbridge",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "moonshot",
    product: Object.freeze({
      id: "moonshot-kimi-code-cli",
      name: "Kimi Code CLI",
      ...productPolicies.cli,
      category: "编程开发",
      description: "Moonshot AI 的原生终端智能体，支持 Windows x64 与 ARM64；由枕星 AI 固定版本下载、校验并管理。",
      website: "https://code.kimi.com/",
      tutorial: "https://moonshotai.github.io/kimi-code/en/guides/getting-started.html",
      productType: "cli",
      requirements: ["git"],
      installProfileId: "cli.kimi-code",
      enabled: true,
      capabilities: [...productPolicies.cli.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "openai",
    product: Object.freeze({
      id: "chatgpt-work",
      name: "ChatGPT Work",
      ...productPolicies.web,
      category: "智能体",
      description: "OpenAI 面向工作场景的智能体，可在 ChatGPT 网页端和桌面端处理文档、表格、演示文稿及跨工具任务。",
      website: "https://openai.com/chatgpt-work/",
      tutorial: "https://openai.com/academy/how-to-use-chatgpt-work-for-everyday-tasks/",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "anthropic",
    product: Object.freeze({
      id: "claude-cowork",
      name: "Claude Cowork",
      ...productPolicies["desktop-official"],
      category: "智能体",
      description: "Claude Desktop 内的协作工作空间，用于跨文件、工具和长流程任务开展本地工作。",
      website: "https://claude.com/product/cowork",
      tutorial: "https://www.anthropic.com/product/claude-cowork",
      productType: "desktop-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["desktop-official"].capabilities]
    })
  }),
  Object.freeze({
    vendorId: "anthropic",
    product: Object.freeze({
      id: "claude-tag",
      name: "Claude Tag",
      ...productPolicies.web,
      category: "智能体",
      description: "在 Slack 频道和讨论串中通过 @Claude 持续处理、分流并推进团队任务的协作智能体。",
      website: "https://claude.com/product/tag",
      tutorial: "https://www.anthropic.com/news/introducing-claude-tag",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "google",
    product: Object.freeze({
      id: "google-notebooklm",
      name: "Gemini Notebook",
      ...productPolicies.web,
      category: "智能体",
      description: "原 NotebookLM，Google 独立的资料研究与学习产品，可基于来源生成分析和多种内容。",
      website: "https://notebooklm.google.com/",
      tutorial: "https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "google",
    product: Object.freeze({
      id: "google-antigravity-desktop",
      name: "Google Antigravity 2.0",
      ...productPolicies["desktop-official"],
      category: "智能体",
      description: "Google 的独立桌面智能体平台，用于并行编排多个智能体并管理其任务与产物。",
      website: "https://antigravity.google/",
      tutorial: "https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/",
      productType: "desktop-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["desktop-official"].capabilities]
    })
  }),
  Object.freeze({
    vendorId: "google",
    product: Object.freeze({
      id: "google-antigravity-cli",
      name: "Antigravity CLI",
      ...productPolicies.cli,
      category: "编程开发",
      description: "Google Antigravity 的终端产品形态，用于快速创建和运行智能体。",
      website: "https://antigravity.google/",
      tutorial: "https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/",
      productType: "cli",
      requirements: [],
      installProfileId: "cli.antigravity",
      enabled: true,
      capabilities: [...productPolicies.cli.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "google",
    product: Object.freeze({
      id: "google-antigravity-sdk",
      name: "Antigravity SDK",
      ...productPolicies.tutorial,
      category: "编程开发",
      description: "用于定制 Antigravity 智能体行为并部署到自有基础设施的官方 SDK。",
      website: "https://antigravity.google/",
      tutorial: "https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/",
      productType: "tutorial",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.tutorial.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "google",
    product: Object.freeze({
      id: "google-gemini-spark",
      name: "Gemini Spark",
      ...productPolicies.web,
      category: "智能体",
      description: "Gemini 应用内可在云端持续运行的个人智能体，用于在用户授权下执行长流程任务。",
      website: "https://gemini.google.com/",
      tutorial: "https://blog.google/innovation-and-ai/sundar-pichai-io-2026/",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "google",
    product: Object.freeze({
      id: "google-flow",
      name: "Google Flow",
      ...productPolicies.web,
      category: "视频创作",
      description: "Google Labs 面向视频和图像生成、编辑及创作流程的 AI 创意工作室。",
      website: "https://flow.google/",
      tutorial: "https://blog.google/innovation-and-ai/models-and-research/google-labs/flow-updates/",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "google",
    product: Object.freeze({
      id: "google-flow-music",
      name: "Google Flow Music",
      ...productPolicies.web,
      category: "音频创作",
      description: "Google Labs 面向音乐人、制作人和词曲作者的 AI 音乐创作与编辑产品。",
      website: "https://labs.google/fx/",
      tutorial: "https://blog.google/innovation-and-ai/models-and-research/google-labs/flow-updates/",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "google",
    product: Object.freeze({
      id: "google-stitch",
      name: "Google Stitch",
      ...productPolicies.web,
      category: "图像创作",
      description: "Google Labs 的实时协作式 AI 设计产品，可从文字、语音、代码和设计文件生成并迭代界面。",
      website: "https://stitch.withgoogle.com/",
      tutorial: "https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "google",
    product: Object.freeze({
      id: "google-project-genie",
      name: "Project Genie",
      ...productPolicies.web,
      category: "视频创作",
      description: "Google Labs 用于创建和探索可交互生成世界的实验性 AI 产品。",
      website: "https://labs.google/fx/",
      tutorial: "https://labs.google/fx/",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "google",
    product: Object.freeze({
      id: "google-musicfx",
      name: "MusicFX",
      ...productPolicies.web,
      category: "音频创作",
      description: "Google Labs 用于探索和生成音乐创意的在线 AI 工具。",
      website: "https://labs.google/fx/",
      tutorial: "https://labs.google/fx/",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "microsoft",
    product: Object.freeze({
      id: "microsoft-agent-365",
      name: "Microsoft Agent 365",
      ...productPolicies.web,
      category: "智能体",
      description: "Microsoft 面向组织的智能体控制平面，用于统一观察、治理和保护企业智能体。",
      website: "https://www.microsoft.com/microsoft-agent-365",
      tutorial: "https://learn.microsoft.com/en-us/microsoft-agent-365/overview",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "anysphere",
    product: Object.freeze({
      id: "cursor-cli",
      name: "Cursor CLI",
      ...productPolicies["cli-official"],
      category: "编程开发",
      description: "Cursor 的终端智能体，可在交互式终端或自动化脚本中读取、修改和审查代码。",
      website: "https://cursor.com/cli",
      tutorial: "https://docs.cursor.com/en/cli/installation",
      productType: "cli-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["cli-official"].capabilities]
    })
  }),
  Object.freeze({
    vendorId: "elevenlabs",
    product: Object.freeze({
      id: "elevenlabs-agents",
      name: "ElevenLabs Agents",
      ...productPolicies.web,
      category: "智能体",
      description: "ElevenLabs 用于构建、测试和部署语音对话智能体的在线产品。",
      website: "https://elevenlabs.io/agents",
      tutorial: "https://elevenlabs.io/docs/agents-platform/overview",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "elevenlabs",
    product: Object.freeze({
      id: "elevenlabs-studio",
      name: "ElevenLabs Studio",
      ...productPolicies.web,
      category: "音频创作",
      description: "ElevenLabs 面向长音频、配音和多轨内容制作的在线创作工作区。",
      website: "https://elevenlabs.io/studio",
      tutorial: "https://elevenlabs.io/docs/creative-platform/products/studio",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "tencent",
    product: Object.freeze({
      id: "tencent-workbuddy",
      name: "WorkBuddy",
      ...productPolicies["desktop-official"],
      category: "智能体",
      description: "腾讯全场景 AI 办公工作台，可在授权范围内读写本地文件、调用工具并完成多智能体任务。",
      website: "https://cloud.tencent.com/product/workbuddy",
      tutorial: "https://cloud.tencent.com/product/workbuddy",
      productType: "desktop-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["desktop-official"].capabilities]
    })
  }),
  Object.freeze({
    vendorId: "tencent",
    product: Object.freeze({
      id: "tencent-qclaw",
      name: "QClaw",
      ...productPolicies["desktop-official"],
      category: "智能体",
      description: "腾讯面向个人用户的本地 AI 智能体桌面产品，提供 OpenClaw 的本地部署和使用体验。",
      website: "https://qclaw.qq.com/",
      tutorial: "https://www.tencent.com/tencent-launches-qclaw-globally-lowering-barriers-to-ai-agent-deployment/",
      productType: "desktop-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["desktop-official"].capabilities]
    })
  }),
  Object.freeze({
    vendorId: "tencent",
    product: Object.freeze({
      id: "tencent-ima",
      name: "ima",
      ...productPolicies["desktop-official"],
      category: "智能体",
      description: "腾讯面向知识管理、资料阅读和内容创作的 AI 工作台，提供网页端与客户端入口。",
      website: "https://ima.qq.com/",
      tutorial: "https://ima.qq.com/",
      productType: "desktop-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["desktop-official"].capabilities]
    })
  }),
  Object.freeze({
    vendorId: "tencent",
    product: Object.freeze({
      id: "tencent-clawpro",
      name: "ClawPro",
      ...productPolicies.web,
      category: "智能体",
      description: "腾讯云面向企业的 AI 智能体管控台，用于部署和管理服务器侧智能体。",
      website: "https://cloud.tencent.com/document/product/213/129694",
      tutorial: "https://cloud.tencent.com/document/product/1759/128832",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "tencent",
    product: Object.freeze({
      id: "tencent-ardot",
      name: "腾讯设计 Ardot",
      ...productPolicies.web,
      category: "图像创作",
      description: "腾讯 AI 原生智能设计协作平台，覆盖设计生成、团队协作、开发交付和资产管理。",
      website: "https://cloud.tencent.com/product/adt",
      tutorial: "https://cloud.tencent.com/product/adt",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "alibaba",
    product: Object.freeze({
      id: "alibaba-qoder-cn-ide",
      name: "Qoder CN IDE",
      ...productPolicies["desktop-official"],
      category: "编程开发",
      description: "阿里云 Qoder CN 系列的独立 AI 编程 IDE，可配合 JetBrains 插件覆盖软件开发流程。",
      website: "https://qoder.com.cn/",
      tutorial: "https://www.alibabacloud.com/help/en/lingma/introduction-of-lingma",
      productType: "desktop-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["desktop-official"].capabilities]
    })
  }),
  Object.freeze({
    vendorId: "alibaba",
    product: Object.freeze({
      id: "alibaba-qoderwork-cn",
      name: "QoderWork CN",
      ...productPolicies["desktop-official"],
      category: "智能体",
      description: "阿里云面向日常办公的桌面 AI 助手，可处理本地文件、浏览器自动化和桌面操作。",
      website: "https://qoder.com.cn/",
      tutorial: "https://www.alibabacloud.com/help/en/lingma/qoderwork-cn/product-overview/what-is-qoderwork-cn",
      productType: "desktop-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["desktop-official"].capabilities]
    })
  }),
  Object.freeze({
    vendorId: "alibaba",
    product: Object.freeze({
      id: "alibaba-qoder-cn-cli",
      name: "Qoder CN CLI",
      ...productPolicies.cli,
      category: "编程开发",
      description: "阿里云 Qoder CN 系列的终端原生智能体，可处理开发、运维和脚本任务。",
      website: "https://qoder.com.cn/",
      tutorial: "https://www.alibabacloud.com/help/en/lingma/qodercli-cn/user-guide/qoder-cli-cn-get-started-quickly",
      productType: "cli",
      requirements: ["node"],
      installProfileId: "cli.qoder-cn",
      enabled: true,
      capabilities: [...productPolicies.cli.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "alibaba",
    product: Object.freeze({
      id: "alibaba-qoderwake-cn",
      name: "QoderWake CN",
      ...productPolicies.web,
      category: "智能体",
      description: "阿里云 Qoder CN 系列的数字员工产品，可在本地或云端持续运行角色化智能体团队。",
      website: "https://qoder.com.cn/",
      tutorial: "https://www.alibabacloud.com/help/en/lingma/introduction-of-lingma",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "alibaba",
    product: Object.freeze({
      id: "alibaba-qoder-cloud-agents-cn",
      name: "Qoder Cloud Agents CN",
      ...productPolicies.web,
      category: "智能体",
      description: "阿里云托管的智能体平台，可在隔离云环境中执行长时间、异步和批量并行任务。",
      website: "https://qoder.com.cn/agents",
      tutorial: "https://www.alibabacloud.com/help/en/lingma/cloud-agents-cn/user-guide/quickstart",
      productType: "web",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies.web.capabilities]
    })
  }),
  Object.freeze({
    vendorId: "openclaw",
    product: Object.freeze({
      id: "openclaw-agent",
      name: "OpenClaw",
      kind: "CLI",
      moduleId: "cli-managed",
      installPolicy: "client-managed-cli",
      downloadPolicy: "none",
      signaturePolicy: "not-applicable",
      uninstallPolicy: "client-managed",
      capabilities: ["website", "tutorial", "install", "open", "uninstall"],
      category: "智能体",
      description: "由客户端本地白名单固定部署官方 OpenClaw 包；安装完成后直接打开官方 onboarding 并安装 Gateway 服务。",
      website: "https://openclaw.ai/",
      tutorial: "https://docs.openclaw.ai/install",
      productType: "cli",
      requirements: ["node"],
      installProfileId: "cli.openclaw",
      enabled: true
    })
  }),
  Object.freeze({
    vendorId: "openclaw",
    product: Object.freeze({
      id: "openclaw-windows-hub",
      name: "OpenClaw Windows Hub",
      ...productPolicies["desktop-official"],
      category: "智能体",
      description: "OpenClaw 官方 Windows 桌面伴侣，提供安装引导、托盘状态、聊天、节点模式和本地 MCP。",
      website: "https://docs.openclaw.ai/windows",
      tutorial: "https://docs.openclaw.ai/windows",
      productType: "desktop-official",
      requirements: [],
      installProfileId: "",
      enabled: true,
      capabilities: [...productPolicies["desktop-official"].capabilities]
    })
  })
]);

const markdown = fs.readFileSync(researchPath, "utf8");
const catalog = normalizeCatalog(
  JSON.parse(fs.readFileSync(catalogPath, "utf8"))
);
const rows = researchRows(markdown);
const vendorNames = new Map();
let addedVendors = 0;
let addedProducts = 0;
let addedResources = 0;

for (const row of rows.filter((item) => item.section !== "resources")) {
  if (row.candidate.includes("X")) continue;
  const vendorIdentity = parseCodeAndLabel(row.vendor);
  const productIdentity = parseCodeAndLabel(row.product);
  if (!vendorIdentity || !productIdentity) continue;
  if (vendorIdentity.label) vendorNames.set(vendorIdentity.id, vendorIdentity.label);
  const sourceVendorId = vendorIdentity.id;
  const vendorId = vendorAliases.get(sourceVendorId) || sourceVendorId;
  const productId = productAliases.get(productIdentity.id) || productIdentity.id;
  if (findProduct(catalog, productId)) continue;

  let vendor = catalog.vendors.find((item) => item.id === vendorId);
  const urls = parseLinks(row.links);
  const vendorName = vendorNames.get(sourceVendorId) || sourceVendorId;
  if (!vendor) {
    vendor = {
      id: vendorId,
      name: vendorName,
      initial: vendorInitial(vendorName, vendorId),
      mark: (vendorName.match(/[\p{L}\p{N}]/u)?.[0] || "A").slice(0, 4),
      iconUrl: "",
      color: vendorColor(vendorId),
      description: `${vendorName} 的官方 AI 产品与开发工具目录。`,
      website: urls[0],
      tutorial: urls[1] || urls[0],
      products: [],
      enabled: true,
      order: catalog.vendors.length
    };
    catalog.vendors.push(vendor);
    addedVendors += 1;
  }
  vendor.products.push(
    makeProduct(row, productId, productIdentity.label, vendor.products.length)
  );
  addedProducts += 1;
}

for (const entry of verifiedProductUpserts) {
  const vendor = catalog.vendors.find((item) => item.id === entry.vendorId);
  if (!vendor) throw new Error(`复核产品所属厂商不存在：${entry.vendorId}`);
  const existingIndex = vendor.products.findIndex(
    (product) => product.id === entry.product.id
  );
  if (existingIndex === -1) {
    vendor.products.push({
      ...entry.product,
      directoryKind: entry.product.directoryKind || "ai-tool",
      order: vendor.products.length
    });
    addedProducts += 1;
    continue;
  }
  const existing = vendor.products[existingIndex];
  vendor.products[existingIndex] = {
    ...existing,
    ...entry.product,
    directoryKind: entry.product.directoryKind || "ai-tool",
    order: existing.order
  };
  delete vendor.products[existingIndex].extensions;
}

for (const row of rows.filter((item) => item.section === "resources")) {
  if (row.candidate.includes("X")) continue;
  const resourceIdentity = parseCodeAndLabel(row.resource);
  const targetIdentity = parseCodeAndLabel(row.target);
  if (!resourceIdentity || !targetIdentity) continue;
  const targetId =
    resourceTargetAliases.get(targetIdentity.id) ||
    productAliases.get(targetIdentity.id) ||
    targetIdentity.id;
  const targetOwner = findProductOwner(catalog, targetId);
  if (!targetOwner) {
    throw new Error(`资源宿主不存在：${resourceIdentity.id} -> ${targetId}`);
  }
  const resource = makeResource(
    row,
    resourceIdentity.id,
    targetId,
    targetOwner.vendor.name,
    catalog.resources.length
  );
  resource.publisherVendorId = targetOwner.vendor.id;
  if (upsertResource(catalog, resource)) addedResources += 1;
}

const codexCli = findProduct(catalog, "codex-cli");
if (!codexCli) throw new Error("受控资源宿主不存在：codex-cli");
const managedChatgptApps = managedChatgptAppsResource(
  catalog.resources.length
);
managedChatgptApps.publisherVendorId = "openai";
if (upsertResource(catalog, managedChatgptApps)) addedResources += 1;

catalog.vendors.forEach((vendor, vendorOrder) => {
  vendor.order = vendorOrder;
  vendor.products.forEach((product, productOrder) => {
    if (productNameOverrides.has(product.id)) {
      product.name = productNameOverrides.get(product.id);
    }
    product.directoryKind ||= "ai-tool";
    product.order = productOrder;
    delete product.extensions;
  });
});
catalog.resources.forEach((resource, resourceOrder) => {
  if (resourceNameOverrides.has(resource.id)) {
    resource.name = resourceNameOverrides.get(resource.id);
  }
  resource.order = resourceOrder;
});
applyConnectableTaxonomy(catalog);
if (addedVendors || addedProducts || addedResources) {
  catalog.updatedAt = new Date().toISOString();
}
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

const products = catalog.vendors.flatMap((vendor) => vendor.products);
console.log(
  JSON.stringify(
    {
      added: {
        vendors: addedVendors,
        products: addedProducts,
        resources: addedResources
      },
      totals: {
        vendors: catalog.vendors.length,
        products: products.length,
        resources: catalog.resources.length
      }
    },
    null,
    2
  )
);
