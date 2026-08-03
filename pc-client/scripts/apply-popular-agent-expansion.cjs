"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const fallbackPath = path.join(root, "admin", "data", "vendor-icon-fallbacks.json");
const verifiedAt = "2026-08-03T21:00:00.000Z";

function product({
  id,
  name,
  mode,
  description,
  website,
  tutorial,
  category = "智能体",
  homePage = "",
  desktopLabel = "获取 Windows 客户端",
  webPage = "",
  webLabel = "打开网页版"
}) {
  const shared = {
    id,
    enabled: true,
    order: 0,
    directoryKind: "ai-tool",
    name,
    category,
    description,
    website,
    tutorial,
    installProfileId: "",
    requirements: []
  };

  if (mode === "desktop") {
    return {
      ...shared,
      kind: "桌面端",
      productType: "desktop-official",
      moduleId: "desktop-official",
      installPolicy: "open-official-download",
      downloadPolicy: "official-page",
      signaturePolicy: "vendor-controlled",
      uninstallPolicy: "vendor-managed",
      capabilities: ["website", "tutorial"],
      entryPoints: [
        ...(homePage
          ? [{ type: "website", label: "工具官网", url: homePage }]
          : []),
        ...(webPage
          ? [{ type: "web", label: webLabel, url: webPage }]
          : []),
        { type: "desktop", label: desktopLabel },
        ...(tutorial !== website
          ? [{ type: "tutorial", label: "使用教程", url: tutorial }]
          : [])
      ]
    };
  }

  if (mode === "cli") {
    return {
      ...shared,
      kind: "CLI",
      productType: "cli-official",
      moduleId: "cli-official",
      installPolicy: "open-official-install",
      downloadPolicy: "none",
      signaturePolicy: "not-applicable",
      uninstallPolicy: "not-managed",
      capabilities: ["website", "tutorial"]
    };
  }

  if (mode === "tutorial") {
    return {
      ...shared,
      kind: "其他产品",
      productType: "tutorial",
      moduleId: "tutorial-link",
      installPolicy: "open-tutorial",
      downloadPolicy: "none",
      signaturePolicy: "not-applicable",
      uninstallPolicy: "not-managed",
      capabilities: ["tutorial"]
    };
  }

  return {
    ...shared,
    kind: "其他产品",
    productType: "web",
    moduleId: "web-link",
    installPolicy: "open-product-website",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "web", label: `打开 ${name}`, url: website },
      ...(tutorial !== website
        ? [{ type: "tutorial", label: "使用教程", url: tutorial }]
        : [])
    ]
  };
}

const p = product;

const definitions = [
  {
    id: "openhands",
    name: "OpenHands",
    initial: "O",
    color: "#6f59d9",
    description: "提供云端与命令行形态的软件开发智能体。",
    website: "https://www.openhands.dev/",
    tutorial: "https://docs.openhands.dev/",
    products: [
      p({
        id: "openhands-cloud",
        name: "OpenHands Cloud",
        mode: "web",
        description: "无需本地安装的云端软件开发智能体，可在隔离工作区中处理代码任务。",
        website: "https://app.all-hands.dev/",
        tutorial: "https://docs.openhands.dev/overview/quickstart"
      }),
      p({
        id: "openhands-agent-canvas",
        name: "OpenHands Agent Canvas",
        mode: "tutorial",
        description: "官方当前推荐的自托管开发智能体控制台，可连接 OpenHands、Codex、Claude Code 等后端；本地部署具有文件与命令权限。",
        website: "https://github.com/OpenHands/OpenHands",
        tutorial: "https://docs.openhands.dev/overview/quickstart"
      })
    ]
  },
  {
    id: "significant-gravitas",
    name: "Significant Gravitas",
    initial: "S",
    color: "#7b4ce2",
    description: "维护 AutoGPT 智能体构建、部署与运行平台。",
    website: "https://www.agpt.co/",
    tutorial: "https://github.com/Significant-Gravitas/AutoGPT",
    products: [p({
      id: "autogpt-platform",
      name: "AutoGPT Platform",
      mode: "web",
      description: "用于构建、部署和运行持续型智能体的平台；可直接使用托管版，也可按官方说明使用 Docker 自托管。",
      website: "https://platform.agpt.co/",
      tutorial: "https://github.com/Significant-Gravitas/AutoGPT"
    })]
  },
  {
    id: "agent0ai",
    name: "Agent0AI",
    initial: "A",
    color: "#171717",
    description: "维护 Agent Zero 可扩展本地智能体工作台。",
    website: "https://www.agent-zero.ai/",
    tutorial: "https://github.com/agent0ai/agent-zero",
    products: [p({
      id: "agent-zero",
      name: "Agent Zero",
      mode: "tutorial",
      description: "在容器中提供 Linux 桌面、浏览器、技能、插件和多智能体协作的本地工作台；部署前需阅读隔离与权限说明。",
      website: "https://www.agent-zero.ai/",
      tutorial: "https://github.com/agent0ai/agent-zero/blob/main/docs/setup/installation.md"
    })]
  },
  {
    id: "browser-use",
    name: "Browser Use",
    initial: "B",
    color: "#3b82f6",
    description: "提供面向 AI 智能体的浏览器自动化云服务与命令行工具。",
    website: "https://browser-use.com/",
    tutorial: "https://docs.browser-use.com/",
    products: [
      p({
        id: "browser-use-cloud",
        name: "Browser Use Cloud",
        mode: "web",
        description: "托管浏览器会话与智能体任务的云平台，可管理配置、任务结果和用量。",
        website: "https://cloud.browser-use.com/",
        tutorial: "https://github.com/browser-use/browser-use/blob/main/CLOUD.md"
      }),
      p({
        id: "browser-use-cli",
        name: "Browser Use CLI",
        mode: "cli",
        description: "命令行浏览器自动化工具，可控制本地或云端浏览器；当前只提供官方安装说明。",
        website: "https://github.com/browser-use/browser-use",
        tutorial: "https://docs.browser-use.com/open-source/browser-use-cli"
      })
    ]
  },
  {
    id: "skyvern",
    name: "Skyvern",
    initial: "S",
    color: "#16a34a",
    description: "提供结合视觉模型与 Playwright 的浏览器工作流智能体。",
    website: "https://www.skyvern.com/",
    tutorial: "https://www.skyvern.com/docs/developers/getting-started/introduction",
    products: [
      p({
        id: "skyvern-cloud",
        name: "Skyvern Cloud",
        mode: "web",
        description: "托管式浏览器工作流和无代码智能体平台，适合跨网站执行可复核任务。",
        website: "https://app.skyvern.com/",
        tutorial: "https://www.skyvern.com/docs/developers/getting-started/introduction"
      }),
      p({
        id: "skyvern-self-hosted",
        name: "Skyvern 自托管版",
        mode: "tutorial",
        description: "包含 Web UI、API 和 SDK 的本地部署形态；不是 Windows 桌面客户端，部署前需审核浏览器控制与凭据权限。",
        website: "https://github.com/Skyvern-AI/skyvern",
        tutorial: "https://www.skyvern.com/docs/developers/getting-started/introduction"
      })
    ]
  },
  {
    id: "foundation-agents",
    name: "Foundation Agents",
    initial: "F",
    color: "#5557d9",
    description: "维护 OpenManus 与 MetaGPT 等开源通用、多智能体项目。",
    website: "https://foundationagents.org/",
    tutorial: "https://foundationagents.org/projects/",
    products: [
      p({
        id: "openmanus-cli",
        name: "OpenManus",
        mode: "cli",
        description: "面向通用任务的开源命令行智能体框架，支持规划、工具调用与多步骤执行。",
        website: "https://foundationagents.org/projects/openmanus/",
        tutorial: "https://github.com/FoundationAgents/OpenManus"
      }),
      p({
        id: "metagpt-framework",
        name: "MetaGPT CLI",
        mode: "cli",
        description: "以软件团队角色和标准作业流程组织多个智能体的命令行开发框架，不是 Windows 图形客户端。",
        website: "https://github.com/FoundationAgents/MetaGPT",
        tutorial: "https://github.com/FoundationAgents/MetaGPT"
      })
    ]
  },
  {
    id: "bytedance",
    products: [
      p({
        id: "bytedance-ui-tars-desktop",
        name: "UI-TARS Desktop",
        mode: "desktop",
        description: "字节跳动开源的 Windows 图形界面智能体，可操作本地或远程电脑与浏览器；只打开官方发布页。",
        website: "https://github.com/bytedance/UI-TARS-desktop/releases/latest",
        homePage: "https://github.com/bytedance/UI-TARS-desktop",
        tutorial: "https://github.com/bytedance/UI-TARS-desktop",
        desktopLabel: "获取 UI-TARS Windows 版"
      }),
      p({
        id: "bytedance-agent-tars-cli",
        name: "Agent TARS CLI",
        mode: "cli",
        description: "命令行多模态智能体，配套本地 Web UI、GUI 操作和 MCP 工具；当前只打开官方说明。",
        website: "https://github.com/bytedance/UI-TARS-desktop",
        tutorial: "https://github.com/bytedance/UI-TARS-desktop"
      }),
      p({
        id: "bytedance-deerflow",
        name: "DeerFlow",
        mode: "tutorial",
        description: "字节跳动开源的长时任务 Super Agent，结合子智能体、记忆、沙箱、技能和消息网关；Windows 适合开发评估，持久运行推荐 Linux 与 Docker。",
        website: "https://deerflow.tech/",
        tutorial: "https://github.com/bytedance/deer-flow"
      })
    ]
  },
  {
    id: "rightnow-ai",
    name: "RightNow AI",
    initial: "R",
    color: "#f97316",
    description: "维护 Rust 编写的 OpenFang 智能体操作系统。",
    website: "https://www.openfang.sh/",
    tutorial: "https://github.com/RightNow-AI/openfang",
    products: [p({
      id: "openfang-cli",
      name: "OpenFang",
      mode: "cli",
      description: "带后台服务、仪表盘、技能和定时任务的命令行智能体操作系统；仍处于 1.0 前阶段。",
      website: "https://www.openfang.sh/",
      tutorial: "https://github.com/RightNow-AI/openfang"
    })]
  },
  {
    id: "zeroclaw-labs",
    name: "ZeroClaw Labs",
    initial: "Z",
    color: "#dc2626",
    description: "维护本地优先、跨平台的 ZeroClaw 智能体运行时。",
    website: "https://zeroclawlabs.ai/",
    tutorial: "https://github.com/zeroclaw-labs/zeroclaw",
    products: [p({
      id: "zeroclaw-cli",
      name: "ZeroClaw",
      mode: "cli",
      description: "Rust 单二进制个人智能体运行时，可接入模型、消息渠道、工具和 MCP；仅信任官方仓库。",
      website: "https://github.com/zeroclaw-labs/zeroclaw",
      tutorial: "https://github.com/zeroclaw-labs/zeroclaw/blob/master/docs/README.md"
    })]
  },
  {
    id: "near-ai",
    name: "NEAR AI",
    initial: "N",
    color: "#111827",
    description: "维护重视隐私、安全和扩展性的 IronClaw 智能体操作系统。",
    website: "https://near.ai/",
    tutorial: "https://github.com/nearai/ironclaw",
    products: [p({
      id: "ironclaw-cli",
      name: "IronClaw",
      mode: "cli",
      description: "提供终端、Web Gateway、WASM 沙箱、记忆和多渠道能力的智能体运行时；Windows 入口只指向官方发布说明。",
      website: "https://github.com/nearai/ironclaw",
      tutorial: "https://github.com/nearai/ironclaw/releases/latest"
    })]
  },
  {
    id: "hkuds",
    name: "HKUDS",
    initial: "H",
    color: "#f59e0b",
    description: "维护轻量个人智能体、研究与知识工作流项目。",
    website: "https://github.com/HKUDS",
    tutorial: "https://github.com/HKUDS/nanobot",
    products: [p({
      id: "hkuds-nanobot-cli",
      name: "nanobot",
      mode: "cli",
      description: "轻量开源个人智能体，支持聊天渠道、记忆、MCP、定时任务和 Web UI；当前只打开官方部署说明。",
      website: "https://github.com/HKUDS/nanobot",
      tutorial: "https://github.com/HKUDS/nanobot/blob/main/docs/README.md"
    })]
  },
  {
    id: "nanoco",
    name: "NanoCo",
    initial: "N",
    color: "#0f766e",
    description: "维护以容器隔离为核心的 NanoClaw 个人智能体。",
    website: "https://nanoclaw.dev/",
    tutorial: "https://docs.nanoclaw.dev/",
    products: [p({
      id: "nanoclaw-cli",
      name: "NanoClaw",
      mode: "cli",
      description: "通过容器隔离运行个人智能体并接入多种消息渠道；Windows 需要 WSL2 与 Docker，当前只打开官方说明。",
      website: "https://nanoclaw.dev/",
      tutorial: "https://github.com/nanocoai/nanoclaw"
    })]
  },
  {
    id: "astrbot",
    name: "AstrBot",
    initial: "A",
    color: "#6366f1",
    description: "维护可连接多种即时通信平台、模型和插件的智能体助手框架。",
    website: "https://astrbot.app/",
    tutorial: "https://github.com/AstrBotDevs/AstrBot",
    products: [p({
      id: "astrbot-platform",
      name: "AstrBot",
      mode: "tutorial",
      description: "面向多平台聊天机器人的智能体助手与开发框架，部署和插件权限需按官方文档配置。",
      website: "https://astrbot.app/",
      tutorial: "https://github.com/AstrBotDevs/AstrBot"
    })]
  },
  {
    id: "langbot",
    name: "LangBot",
    initial: "L",
    color: "#2563eb",
    description: "维护生产级多平台智能机器人和知识编排平台。",
    website: "https://langbot.app/",
    tutorial: "https://github.com/RockChinQ/LangBot",
    products: [p({
      id: "langbot-platform",
      name: "LangBot",
      mode: "tutorial",
      description: "支持 Agent、知识库、插件和多种即时通信渠道的自托管机器人平台。",
      website: "https://langbot.app/",
      tutorial: "https://github.com/RockChinQ/LangBot"
    })]
  },
  {
    id: "open-interpreter",
    name: "Open Interpreter",
    initial: "O",
    color: "#202020",
    description: "提供可在本机执行代码和操作工具的终端智能体。",
    website: "https://www.openinterpreter.com/",
    tutorial: "https://www.openinterpreter.com/docs/terminal/quickstart",
    products: [p({
      id: "open-interpreter-cli",
      name: "Open Interpreter CLI",
      mode: "cli",
      description: "面向本地与开放模型的命令行编码智能体，可运行代码和工具；执行权限应由用户明确控制。",
      website: "https://www.openinterpreter.com/",
      tutorial: "https://www.openinterpreter.com/docs/terminal/quickstart"
    })]
  },
  {
    id: "cognition",
    name: "Cognition",
    initial: "C",
    color: "#111827",
    description: "开发自主软件工程智能体 Devin。",
    website: "https://devin.ai/",
    tutorial: "https://docs.devin.ai/",
    products: [p({
      id: "cognition-devin",
      name: "Devin",
      mode: "web",
      description: "可在云端工作区中编写、运行和测试代码的自主软件工程智能体。",
      website: "https://app.devin.ai/",
      tutorial: "https://docs.devin.ai/get-started/devin-intro"
    })]
  },
  {
    id: "factory-ai",
    name: "Factory",
    initial: "F",
    color: "#111111",
    description: "提供可跨浏览器、IDE、终端和协作工具工作的 Droids 编码智能体。",
    website: "https://factory.ai/",
    tutorial: "https://docs.factory.ai/welcome",
    products: [
      p({
        id: "factory-droids",
        name: "Factory Droids",
        mode: "web",
        description: "可规划、编写、测试并交付代码变更的云端软件开发智能体。",
        website: "https://factory.ai/product/droids",
        tutorial: "https://docs.factory.ai/welcome"
      }),
      p({
        id: "factory-cli",
        name: "Factory CLI",
        mode: "cli",
        description: "Factory Droids 的命令行入口；Windows 安装与权限边界以官方快速入门为准。",
        website: "https://factory.ai/product/droids",
        tutorial: "https://docs.factory.ai/welcome"
      })
    ]
  },
  {
    id: "kortix",
    name: "Kortix",
    initial: "K",
    color: "#6d28d9",
    description: "提供面向企业智能体、技能、连接器和记忆的 AI 指挥中心。",
    website: "https://kortix.com/",
    tutorial: "https://kortix.com/docs/",
    products: [
      p({
        id: "kortix-command-center",
        name: "Kortix",
        mode: "web",
        description: "集中创建、运行和治理企业智能体、技能、连接器与共享记忆的 Web 平台。",
        website: "https://kortix.com/",
        tutorial: "https://kortix.com/docs/"
      }),
      p({
        id: "kortix-cli",
        name: "Kortix CLI",
        mode: "cli",
        description: "用于初始化、部署和管理 Kortix 项目的命令行工具；本地部署前需审核服务器与权限配置。",
        website: "https://github.com/kortix-ai/suna",
        tutorial: "https://kortix.com/docs/"
      })
    ]
  },
  {
    id: "flowith",
    name: "Flowith",
    initial: "F",
    color: "#5b5bd6",
    description: "提供面向研究、创作和多步骤任务的通用智能体平台。",
    website: "https://flowith.io/",
    tutorial: "https://flowith.io/docs/",
    products: [p({
      id: "flowith-agent-neo",
      name: "Agent Neo",
      mode: "web",
      description: "可动态规划、调用工具并自我修正的通用 Web 智能体，适合复杂多步骤任务。",
      website: "https://flowith.io/",
      tutorial: "https://flowith.io/docs/en/agent-neo/about/"
    })]
  },
  {
    id: "relevance-ai",
    name: "Relevance AI",
    initial: "R",
    color: "#7c3aed",
    description: "提供无代码智能体与多智能体团队构建平台。",
    website: "https://relevanceai.com/",
    tutorial: "https://relevanceai.com/docs/get-started/introduction",
    products: [p({
      id: "relevance-ai-agents",
      name: "Relevance AI Agents",
      mode: "web",
      description: "用于构建、配置和运行智能体及多智能体团队的低代码 Web 平台。",
      website: "https://relevanceai.com/agents",
      tutorial: "https://relevanceai.com/docs/get-started/introduction"
    })]
  },
  {
    id: "gumloop",
    name: "Gumloop",
    initial: "G",
    color: "#f0b429",
    description: "提供无代码 AI 自动化、工作流和智能体构建平台。",
    website: "https://www.gumloop.com/",
    tutorial: "https://docs.gumloop.com/",
    products: [p({
      id: "gumloop-agents",
      name: "Gumloop Agents",
      mode: "web",
      description: "可连接触发器、工具和子智能体的无代码 Web 智能体平台。",
      website: "https://www.gumloop.com/",
      tutorial: "https://docs.gumloop.com/core-concepts/agents"
    })]
  },
  {
    id: "bardeen",
    name: "Bardeen",
    initial: "B",
    color: "#6c5ce7",
    description: "提供在浏览器中运行的 AI 自动化和业务智能体平台。",
    website: "https://www.bardeen.ai/",
    tutorial: "https://support.bardeen.ai/",
    products: [p({
      id: "bardeen-agents",
      name: "Bardeen",
      mode: "web",
      description: "在浏览器中连接网页和业务应用、执行端到端自动化的 AI 智能体平台。",
      website: "https://www.bardeen.ai/",
      tutorial: "https://support.bardeen.ai/hc/en-us/articles/23646078000141-Start-here-for-a-video-walkthrough"
    })]
  },
  {
    id: "lindy",
    name: "Lindy",
    initial: "L",
    color: "#ef4444",
    description: "提供邮件、日程、会议和业务流程自动化的 AI 助理。",
    website: "https://www.lindy.ai/",
    tutorial: "https://docs.lindy.ai/",
    products: [p({
      id: "lindy-ai-assistant",
      name: "Lindy",
      mode: "web",
      description: "可连接邮件、日历、会议和业务应用的 Web 智能体助理，关键操作应保留人工审批。",
      website: "https://chat.lindy.ai/",
      tutorial: "https://docs.lindy.ai/"
    })]
  },
  {
    id: "flowise",
    name: "Flowise",
    initial: "F",
    color: "#2f8f83",
    description: "维护可视化生成式 AI、智能体和 LLM 工作流平台。",
    website: "https://flowiseai.com/",
    tutorial: "https://docs.flowiseai.com/",
    products: [p({
      id: "flowise-platform",
      name: "Flowise",
      mode: "tutorial",
      description: "可视化构建 Assistant、Chatflow 和 Agentflow 的开源平台；自托管时需独立审核服务器安全。",
      website: "https://flowiseai.com/",
      tutorial: "https://docs.flowiseai.com/"
    })]
  },
  {
    id: "langflow",
    name: "Langflow",
    initial: "L",
    color: "#111827",
    description: "维护用于构建智能体、RAG 应用和 MCP 服务的可视化框架。",
    website: "https://www.langflow.org/",
    tutorial: "https://docs.langflow.org/",
    products: [p({
      id: "langflow-platform",
      name: "Langflow",
      mode: "tutorial",
      description: "Python 可视化 AI 应用框架，可编排智能体、工具和 MCP；不是原生 Windows 桌面产品。",
      website: "https://www.langflow.org/",
      tutorial: "https://docs.langflow.org/agents-overview"
    })]
  },
  {
    id: "mastra",
    name: "Mastra",
    initial: "M",
    color: "#ff5d2e",
    description: "提供 TypeScript 智能体、工作流、记忆和评测框架。",
    website: "https://mastra.ai/",
    tutorial: "https://mastra.ai/docs/",
    products: [p({
      id: "mastra-agent-framework",
      name: "Mastra",
      mode: "tutorial",
      description: "面向 TypeScript 应用的智能体框架，支持工具、MCP、记忆、追踪和评测。",
      website: "https://mastra.ai/ai-agents",
      tutorial: "https://mastra.ai/docs/"
    })]
  },
  {
    id: "pydantic",
    name: "Pydantic",
    initial: "P",
    color: "#e92063",
    description: "维护以类型安全和结构化数据为核心的 Python AI 开发工具。",
    website: "https://pydantic.dev/",
    tutorial: "https://pydantic.dev/docs/ai/overview/",
    products: [p({
      id: "pydantic-ai-framework",
      name: "Pydantic AI",
      mode: "tutorial",
      description: "用于构建生产级生成式 AI 应用和工作流的 Python 智能体框架。",
      website: "https://pydantic.dev/docs/ai/overview/",
      tutorial: "https://pydantic.dev/docs/ai/core-concepts/agent/"
    })]
  },
  {
    id: "agno",
    name: "Agno",
    initial: "A",
    color: "#6d28d9",
    description: "提供构建、运行和管理智能体集群的框架与 AgentOS。",
    website: "https://www.agno.com/",
    tutorial: "https://docs.agno.com/",
    products: [p({
      id: "agno-agentos",
      name: "Agno AgentOS",
      mode: "tutorial",
      description: "用于构建、运行和管理多智能体系统的 Python 框架与运行时平台。",
      website: "https://www.agno.com/agentos",
      tutorial: "https://docs.agno.com/"
    })]
  },
  {
    id: "camel-ai",
    name: "CAMEL-AI",
    initial: "C",
    color: "#c0841a",
    description: "维护可扩展、可演化和有状态的多智能体框架。",
    website: "https://www.camel-ai.org/",
    tutorial: "https://docs.camel-ai.org/",
    products: [p({
      id: "camel-ai-framework",
      name: "CAMEL",
      mode: "tutorial",
      description: "用于构建角色协作、工具调用、记忆和大规模多智能体系统的开源框架。",
      website: "https://www.camel-ai.org/framework",
      tutorial: "https://docs.camel-ai.org/get_started/introduction"
    })]
  },
  {
    id: "llamaindex",
    name: "LlamaIndex",
    initial: "L",
    color: "#6c63ff",
    description: "提供面向数据、知识和工作流的智能体开发框架。",
    website: "https://www.llamaindex.ai/",
    tutorial: "https://docs.llamaindex.ai/",
    products: [p({
      id: "llamaindex-agents",
      name: "LlamaIndex Agents",
      mode: "tutorial",
      description: "用于让智能体连接数据、工具和多步骤工作流的开发框架。",
      website: "https://www.llamaindex.ai/",
      tutorial: "https://docs.llamaindex.ai/en/stable/module_guides/deploying/agents/"
    })]
  },
  {
    id: "huggingface",
    products: [p({
      id: "huggingface-smolagents",
      name: "smolagents",
      mode: "tutorial",
      description: "Hugging Face 维护的轻量 Python 智能体库，支持代码智能体、工具调用和多模型提供商。",
      website: "https://github.com/huggingface/smolagents",
      tutorial: "https://huggingface.co/docs/smolagents/main/index"
    })]
  },
  {
    id: "aider",
    name: "Aider",
    initial: "A",
    color: "#22c55e",
    description: "维护终端内的开源 AI 结对编程工具。",
    website: "https://aider.chat/",
    tutorial: "https://aider.chat/docs/",
    products: [p({
      id: "aider-cli",
      name: "Aider CLI",
      mode: "cli",
      description: "在终端中读取代码、编辑文件并配合 Git 工作的 AI 结对编程工具。",
      website: "https://aider.chat/",
      tutorial: "https://aider.chat/docs/install.html"
    })]
  },
  {
    id: "continue",
    name: "Continue",
    initial: "C",
    color: "#111827",
    description: "维护开源 IDE 与命令行编码智能体。",
    website: "https://www.continue.dev/",
    tutorial: "https://docs.continue.dev/",
    products: [
      p({
        id: "continue-agent",
        name: "Continue Agent",
        mode: "tutorial",
        description: "运行在 VS Code 与 JetBrains 中的可视化编码智能体，可按权限使用编辑、命令和 MCP 工具。",
        website: "https://www.continue.dev/",
        tutorial: "https://docs.continue.dev/ide-extensions/agent/quick-start"
      }),
      p({
        id: "continue-cli",
        name: "Continue CLI",
        mode: "cli",
        description: "命令行编码智能体，可编辑文件、运行命令并执行多步骤任务。",
        website: "https://www.continue.dev/",
        tutorial: "https://docs.continue.dev/cli/quickstart"
      })
    ]
  },
  {
    id: "kilo",
    name: "Kilo",
    initial: "K",
    color: "#f97316",
    description: "维护跨 IDE、终端、浏览器和云端的开源编码智能体平台。",
    website: "https://kilo.ai/",
    tutorial: "https://kilo.ai/docs/getting-started",
    products: [
      p({
        id: "kilo-code-agent",
        name: "Kilo Code",
        mode: "tutorial",
        description: "运行于 VS Code 与 JetBrains 的可视化编码智能体，IDE 插件应从官方市场安装。",
        website: "https://kilo.ai/",
        tutorial: "https://kilo.ai/docs/code-with-ai"
      }),
      p({
        id: "kilo-code-cli",
        name: "Kilo Code CLI",
        mode: "cli",
        description: "用于终端编程和自动化的命令行智能体，与 IDE 产品分开显示。",
        website: "https://kilo.ai/",
        tutorial: "https://kilo.ai/docs/code-with-ai/platforms/cli"
      })
    ]
  },
  {
    id: "swe-agent",
    name: "SWE-agent",
    initial: "S",
    color: "#4f46e5",
    description: "维护用于真实软件工程任务的开源研究型编码智能体。",
    website: "https://swe-agent.com/",
    tutorial: "https://github.com/SWE-agent/mini-swe-agent",
    products: [p({
      id: "mini-swe-agent-cli",
      name: "mini-SWE-agent",
      mode: "cli",
      description: "SWE-agent 团队当前推荐的精简命令行编码智能体；旧 SWE-agent 已由该项目取代。",
      website: "https://github.com/SWE-agent/mini-swe-agent",
      tutorial: "https://github.com/SWE-agent/mini-swe-agent"
    })]
  },
  {
    id: "nvidia",
    products: [
      p({
        id: "nvidia-nemoclaw-cli",
        name: "NVIDIA NemoClaw CLI",
        mode: "cli",
        description: "NVIDIA OpenShell 上的沙箱化智能体参考栈，可运行 OpenClaw、Hermes 与 LangChain Deep Agents；当前为 Alpha，只打开官方说明。",
        website: "https://github.com/NVIDIA/NemoClaw",
        tutorial: "https://docs.nvidia.com/nemoclaw/latest/"
      }),
      p({
        id: "nvidia-nemo-agent-toolkit",
        name: "NVIDIA NeMo Agent Toolkit",
        mode: "tutorial",
        description: "用于构建、连接、评测、分析和部署智能体工作流的开源工具包，支持 MCP、A2A 与多种框架。",
        website: "https://github.com/NVIDIA/NeMo-Agent-Toolkit",
        tutorial: "https://docs.nvidia.com/nemo/agent-toolkit/latest/"
      })
    ]
  },
  {
    id: "google",
    products: [p({
      id: "google-agent-development-kit",
      name: "Google Agent Development Kit",
      mode: "tutorial",
      description: "Google 开源的代码优先智能体开发框架，提供 Python SDK、交互式 CLI 与本地 Web 调试界面。",
      website: "https://github.com/google/adk-python",
      tutorial: "https://google.github.io/adk-docs/"
    })]
  },
  {
    id: "microsoft",
    products: [p({
      id: "microsoft-agent-framework",
      name: "Microsoft Agent Framework",
      mode: "tutorial",
      description: "Microsoft 面向 Python 与 .NET 的生产级智能体和多智能体工作流框架，是 AutoGen 的官方后继方案。",
      website: "https://github.com/microsoft/agent-framework",
      tutorial: "https://learn.microsoft.com/agent-framework/"
    })]
  },
  {
    id: "langchain",
    products: [p({
      id: "langchain-deep-agents",
      name: "LangChain Deep Agents",
      mode: "tutorial",
      description: "带任务规划、文件上下文、子智能体和长期记忆的开源智能体 Harness，建立在 LangGraph 运行时之上。",
      website: "https://github.com/langchain-ai/deepagents",
      tutorial: "https://docs.langchain.com/oss/python/deepagents/overview"
    })]
  },
  {
    id: "amazon",
    products: [p({
      id: "amazon-strands-agents",
      name: "Strands Agents SDK",
      mode: "tutorial",
      description: "AWS 开源的模型驱动智能体 SDK，支持 Python、工具、MCP、多智能体和多模型提供商。",
      website: "https://github.com/strands-agents/sdk-python",
      tutorial: "https://strandsagents.com/latest/"
    })]
  },
  {
    id: "letta",
    name: "Letta",
    initial: "L",
    color: "#6d28d9",
    description: "提供具有长期记忆、身份和持续学习能力的有状态智能体。",
    website: "https://www.letta.com/agent",
    tutorial: "https://docs.letta.com/quickstart",
    products: [
      p({
        id: "letta-agent",
        name: "Letta Agent",
        mode: "desktop",
        description: "有状态个人智能体，支持 Windows 图形客户端、网页端、记忆、日程、消息渠道和技能。",
        website: "https://docs.letta.com/platform/desktop-app",
        homePage: "https://www.letta.com/agent",
        webPage: "https://chat.letta.com/",
        webLabel: "Letta 网页版",
        tutorial: "https://docs.letta.com/quickstart",
        desktopLabel: "获取 Letta Windows 版"
      }),
      p({
        id: "letta-code-cli",
        name: "Letta Code CLI",
        mode: "cli",
        description: "带长期记忆、技能、子智能体和权限模式的命令行智能体；当前只打开官方安装说明。",
        website: "https://github.com/letta-ai/letta-code",
        tutorial: "https://docs.letta.com/quickstart"
      })
    ]
  },
  {
    id: "activepieces",
    name: "Activepieces",
    initial: "A",
    color: "#6e41e2",
    description: "提供开源 AI 自动化、智能体、工作流与 MCP 集成平台。",
    website: "https://www.activepieces.com/",
    tutorial: "https://www.activepieces.com/docs",
    products: [p({
      id: "activepieces-platform",
      name: "Activepieces",
      mode: "web",
      description: "可视化构建 AI Agent 与自动化流程的 Web 平台，可使用云服务或按官方文档自托管。",
      website: "https://cloud.activepieces.com/",
      tutorial: "https://www.activepieces.com/docs"
    })]
  },
  {
    id: "rowboat",
    name: "Rowboat Labs",
    initial: "R",
    color: "#1f6f5b",
    description: "维护本地优先、带长期工作记忆的 Rowboat AI Coworker。",
    website: "https://www.rowboatlabs.com/",
    tutorial: "https://github.com/rowboatlabs/rowboat",
    products: [p({
      id: "rowboat-desktop",
      name: "Rowboat",
      mode: "desktop",
      description: "面向 Windows、macOS 与 Linux 的本地优先 AI Coworker，整合邮件、笔记、浏览器、代码和会议工作面板。",
      website: "https://www.rowboatlabs.com/downloads",
      homePage: "https://www.rowboatlabs.com/",
      tutorial: "https://github.com/rowboatlabs/rowboat",
      desktopLabel: "获取 Rowboat Windows 版"
    })]
  },
  {
    id: "plandex",
    name: "Plandex",
    initial: "P",
    color: "#2563eb",
    description: "维护面向大型代码库和真实开发任务的开源编码智能体。",
    website: "https://plandex.ai/",
    tutorial: "https://docs.plandex.ai/",
    products: [p({
      id: "plandex-cli",
      name: "Plandex CLI",
      mode: "cli",
      category: "编程开发",
      description: "面向大型项目的终端编码智能体；Windows 官方要求在 WSL 中使用，云服务已停止接收新用户。",
      website: "https://github.com/plandex-ai/plandex",
      tutorial: "https://docs.plandex.ai/"
    })]
  },
  {
    id: "simular-ai",
    name: "Simular",
    initial: "S",
    color: "#334155",
    description: "研究并维护可像人类一样操作电脑的 Agent S。",
    website: "https://www.simular.ai/",
    tutorial: "https://github.com/simular-ai/Agent-S",
    products: [p({
      id: "simular-agent-s-cli",
      name: "Agent S CLI",
      mode: "cli",
      description: "支持 Windows、macOS 与 Linux 的电脑操作智能体研究框架；会运行 Python 并控制鼠标键盘，需谨慎授权。",
      website: "https://github.com/simular-ai/Agent-S",
      tutorial: "https://github.com/simular-ai/Agent-S"
    })]
  },
  {
    id: "bytebot",
    name: "Bytebot",
    initial: "B",
    color: "#0f766e",
    description: "维护运行在容器化 Linux 桌面中的自托管电脑操作智能体。",
    website: "https://www.bytebot.ai/",
    tutorial: "https://docs.bytebot.ai/",
    products: [p({
      id: "bytebot-self-hosted",
      name: "Bytebot",
      mode: "tutorial",
      description: "通过 Web UI 驱动隔离 Linux 桌面、浏览器和应用的自托管智能体；部署依赖 Docker，不是 Windows 桌面客户端。",
      website: "https://github.com/bytebot-ai/bytebot",
      tutorial: "https://docs.bytebot.ai/"
    })]
  },
  {
    id: "voltagent",
    name: "VoltAgent",
    initial: "V",
    color: "#f97316",
    description: "提供 TypeScript 智能体框架与工程平台。",
    website: "https://voltagent.dev/",
    tutorial: "https://voltagent.dev/docs/",
    products: [p({
      id: "voltagent-framework",
      name: "VoltAgent",
      mode: "tutorial",
      description: "用于构建、编排、观测和部署 TypeScript 智能体及工作流的开源框架。",
      website: "https://github.com/VoltAgent/voltagent",
      tutorial: "https://voltagent.dev/docs/"
    })]
  },
  {
    id: "praisonai",
    name: "PraisonAI",
    initial: "P",
    color: "#ef4444",
    description: "维护支持多智能体、记忆、RAG、工作流和多模型的开源智能体工具。",
    website: "https://praison.ai/",
    tutorial: "https://docs.praison.ai/",
    products: [p({
      id: "praisonai-cli",
      name: "PraisonAI CLI",
      mode: "cli",
      description: "可在终端运行研究、编码和自动化任务的多智能体工具，并提供可选 Dashboard 与可视化工作流组件。",
      website: "https://github.com/MervinPraison/PraisonAI",
      tutorial: "https://docs.praison.ai/"
    })]
  },
  {
    id: "agenticseek",
    name: "AgenticSeek",
    initial: "A",
    color: "#15803d",
    description: "维护可使用本地模型或外部 API 的开源通用智能体。",
    website: "https://github.com/Fosowl/agenticSeek",
    tutorial: "https://github.com/Fosowl/agenticSeek",
    products: [
      p({
        id: "agenticseek-self-hosted",
        name: "AgenticSeek",
        mode: "tutorial",
        description: "包含 Web UI、浏览器、代码执行和本地模型支持的自托管智能体；Windows 依赖 Docker 等环境。",
        website: "https://github.com/Fosowl/agenticSeek",
        tutorial: "https://github.com/Fosowl/agenticSeek"
      }),
      p({
        id: "agenticseek-cli",
        name: "AgenticSeek CLI",
        mode: "cli",
        description: "AgenticSeek 的命令行运行形态；Windows 需要 Python、Docker 和项目脚本，当前只打开官方说明。",
        website: "https://github.com/Fosowl/agenticSeek",
        tutorial: "https://github.com/Fosowl/agenticSeek"
      })
    ]
  },
  {
    id: "ruvnet",
    name: "rUv",
    initial: "R",
    color: "#0ea5e9",
    description: "维护面向 Claude Code、Codex 与其他智能体的 Ruflo 元编排工具。",
    website: "https://github.com/ruvnet/ruflo",
    tutorial: "https://github.com/ruvnet/ruflo",
    products: [p({
      id: "ruflo-cli",
      name: "Ruflo CLI",
      mode: "cli",
      description: "为 Claude Code、Codex 等提供多智能体编排、记忆、MCP、插件和后台任务的命令行元 Harness。",
      website: "https://github.com/ruvnet/ruflo",
      tutorial: "https://github.com/ruvnet/ruflo"
    })]
  },
  {
    id: "infiniflow",
    name: "InfiniFlow",
    initial: "I",
    color: "#0f766e",
    description: "维护融合 RAG、知识库和 Agent 工作流的 RAGFlow。",
    website: "https://ragflow.io/",
    tutorial: "https://ragflow.io/docs/",
    products: [p({
      id: "ragflow-platform",
      name: "RAGFlow",
      mode: "web",
      description: "融合文档解析、RAG、知识库和 Agent 工作流的 Web 平台，可使用官方云服务或 Docker 自托管。",
      website: "https://cloud.ragflow.io/",
      tutorial: "https://ragflow.io/docs/"
    })]
  },
  {
    id: "opera",
    products: [p({
      id: "opera-neon",
      name: "Opera Neon",
      mode: "desktop",
      description: "Opera 面向 Windows 的订阅制智能体浏览器，可执行研究、跨网页任务与内容创建；只打开官方获取页。",
      website: "https://www.operaneon.com/",
      homePage: "https://www.operaneon.com/",
      tutorial: "https://www.operaneon.com/",
      desktopLabel: "获取 Opera Neon Windows 版"
    })]
  }
];

const fallbackEvidence = {
  openhands: "https://www.openhands.dev/",
  "significant-gravitas": "https://www.agpt.co/",
  agent0ai: "https://www.agent-zero.ai/",
  "browser-use": "https://browser-use.com/",
  skyvern: "https://www.skyvern.com/",
  "foundation-agents": "https://foundationagents.org/",
  "rightnow-ai": "https://www.openfang.sh/",
  "zeroclaw-labs": "https://zeroclawlabs.ai/",
  "near-ai": "https://near.ai/",
  hkuds: "https://github.com/HKUDS",
  nanoco: "https://nanoclaw.dev/",
  astrbot: "https://astrbot.app/",
  langbot: "https://langbot.app/",
  "open-interpreter": "https://www.openinterpreter.com/",
  cognition: "https://devin.ai/",
  "factory-ai": "https://factory.ai/",
  kortix: "https://kortix.com/",
  flowith: "https://flowith.io/",
  "relevance-ai": "https://relevanceai.com/",
  gumloop: "https://www.gumloop.com/",
  bardeen: "https://www.bardeen.ai/",
  lindy: "https://www.lindy.ai/",
  flowise: "https://flowiseai.com/",
  langflow: "https://www.langflow.org/",
  mastra: "https://mastra.ai/",
  pydantic: "https://pydantic.dev/",
  agno: "https://www.agno.com/",
  "camel-ai": "https://www.camel-ai.org/",
  llamaindex: "https://www.llamaindex.ai/",
  aider: "https://aider.chat/",
  continue: "https://www.continue.dev/",
  kilo: "https://kilo.ai/",
  "swe-agent": "https://swe-agent.com/",
  letta: "https://www.letta.com/agent",
  activepieces: "https://www.activepieces.com/",
  rowboat: "https://www.rowboatlabs.com/",
  plandex: "https://plandex.ai/",
  "simular-ai": "https://www.simular.ai/",
  bytebot: "https://www.bytebot.ai/",
  voltagent: "https://voltagent.dev/",
  praisonai: "https://praison.ai/",
  agenticseek: "https://github.com/Fosowl/agenticSeek",
  ruvnet: "https://github.com/ruvnet/ruflo",
  infiniflow: "https://ragflow.io/"
};

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
for (const vendor of catalog.vendors) {
  vendor.products = vendor.products.filter(
    (entry) => entry.id !== "amazon-strands-agents-sdk"
  );
}
const productOwners = new Map(
  catalog.vendors.flatMap((vendor) =>
    vendor.products.map((entry) => [entry.id, vendor.id])
  )
);
let nextVendorOrder = Math.max(-1, ...catalog.vendors.map((vendor) => vendor.order ?? 0)) + 1;

function upsertProduct(vendor, definition) {
  const owner = productOwners.get(definition.id);
  if (owner && owner !== vendor.id) {
    throw new Error(`产品 ID 已属于其他厂商：${definition.id}`);
  }
  const existing = vendor.products.find((entry) => entry.id === definition.id);
  if (existing) applyDefinition(existing, definition, ["enabled", "order"]);
  else vendor.products.push(definition);
  productOwners.set(definition.id, vendor.id);
}

for (const definition of definitions) {
  let vendor = catalog.vendors.find((entry) => entry.id === definition.id);
  if (!vendor) {
    if (!definition.name || !definition.initial) {
      throw new Error(`新增厂商缺少资料：${definition.id}`);
    }
    vendor = {
      id: definition.id,
      name: definition.name,
      initial: definition.initial,
      mark: definition.initial,
      color: definition.color,
      description: definition.description,
      website: definition.website,
      tutorial: definition.tutorial,
      enabled: true,
      order: nextVendorOrder++,
      iconUrl: "",
      products: []
    };
    catalog.vendors.push(vendor);
  }
  for (const definitionProduct of definition.products) {
    upsertProduct(vendor, definitionProduct);
  }
}

catalog.updatedAt = verifiedAt;
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

const fallbacks = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
fallbacks.reviewedAt = verifiedAt;
for (const [vendorId, evidenceUrl] of Object.entries(fallbackEvidence)) {
  fallbacks.vendors[vendorId] = {
    evidenceUrl,
    reason: "厂商与产品身份已由官方来源核验；在未确认可用于第三方目录的方形品牌素材前使用文字兜底，禁止使用 favicon、搜索图片或相似厂商图标。"
  };
}
fs.writeFileSync(fallbackPath, `${JSON.stringify(fallbacks, null, 2)}\n`, "utf8");

process.stdout.write(
  `Expanded ${catalog.vendors.length} vendors, ${catalog.vendors.flatMap((vendor) => vendor.products).length} products and ${catalog.resources.length} resources\n`
);
