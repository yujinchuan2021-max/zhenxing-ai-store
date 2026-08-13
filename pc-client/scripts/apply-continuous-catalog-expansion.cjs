"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const fallbackPath = path.join(root, "admin", "data", "vendor-icon-fallbacks.json");
const verifiedAt = "2026-08-03T18:00:00.000Z";

function desktopProduct({
  id,
  name,
  category,
  description,
  downloadPage,
  homePage,
  webPage = "",
  webLabel = "",
  tutorial,
  desktopLabel = "获取 Windows 客户端"
}) {
  return {
    id,
    enabled: true,
    order: 0,
    directoryKind: "ai-tool",
    name,
    kind: "桌面端",
    category,
    description,
    website: downloadPage,
    tutorial,
    productType: "desktop-official",
    moduleId: "desktop-official",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      ...(homePage ? [{ type: "website", label: "工具官网", url: homePage }] : []),
      ...(webPage
        ? [{ type: "web", label: webLabel || `${name} 网页版`, url: webPage }]
        : []),
      { type: "desktop", label: desktopLabel },
      ...(tutorial && tutorial !== downloadPage
        ? [{ type: "tutorial", label: "使用教程", url: tutorial }]
        : [])
    ]
  };
}

function webProduct({ id, name, category, description, website, tutorial }) {
  return {
    id,
    enabled: true,
    order: 0,
    directoryKind: "ai-tool",
    name,
    kind: "其他产品",
    category,
    description,
    website,
    tutorial,
    productType: "web",
    moduleId: "web-link",
    installProfileId: "",
    requirements: [],
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

const d = desktopProduct;
const w = webProduct;

const definitions = [
  {
    id: "mylio",
    name: "Mylio",
    initial: "M",
    color: "#2867b2",
    description: "提供本地优先的照片整理、同步、检索和智能标记工具。",
    website: "https://mylio.com/",
    tutorial: "https://support.mylio.com/what-is-mylio-photos",
    products: [d({
      id: "mylio-photos",
      name: "Mylio Photos",
      category: "图像创作",
      description: "Windows 本地优先照片管理工具，支持智能标签、快速检索和跨设备整理；新用户需先选择方案，账号、存储与同步范围以官方说明为准。",
      downloadPage: "https://support.mylio.com/where-can-i-download-the-mylio-photos-software",
      homePage: "https://mylio.com/",
      tutorial: "https://support.mylio.com/installing-mylio-photos-on-a-computer",
      desktopLabel: "获取 Mylio Photos Windows 版"
    })]
  },
  {
    id: "clarivate",
    name: "Clarivate",
    initial: "C",
    color: "#e56a2e",
    description: "提供科研信息、文献管理与研究工作流产品。",
    website: "https://clarivate.com/",
    tutorial: "https://docs.endnote.com/docs/endnote/2025/v1/windows/en/content/03editref/ai_in_endnote_research_assistant.htm",
    products: [d({
      id: "endnote-2025",
      name: "EndNote 2025",
      category: "文档与知识库",
      description: "Windows 文献管理与写作工具，内置 AI Research Assistant；AI、同步和全文能力受许可、账号与在线服务范围限制。",
      downloadPage: "https://endnote.com/downloads/",
      homePage: "https://endnote.com/product-details?language=en",
      webPage: "https://web.endnote.com/",
      webLabel: "EndNote Web",
      tutorial: "https://docs.endnote.com/docs/endnote/2025/v1/windows/en/content/03editref/ai_in_endnote_research_assistant.htm",
      desktopLabel: "获取 EndNote 2025 Windows 版"
    })]
  },
  {
    id: "taskade",
    name: "Taskade",
    initial: "T",
    color: "#ff5b5b",
    description: "提供 AI Agent、项目协作、自动化与应用生成工作台。",
    website: "https://www.taskade.com/",
    tutorial: "https://help.taskade.com/en/articles/8958455-taskade-ai-usage",
    products: [d({
      id: "taskade-workspace",
      name: "Taskade",
      category: "智能体",
      description: "合并 Web 与 Windows 入口的 AI Agent 和团队工作台，可创建 Agent、工作流与应用；额度、模型和自动化能力以账号方案为准。",
      downloadPage: "https://www.taskade.com/downloads",
      homePage: "https://www.taskade.com/",
      webPage: "https://www.taskade.com/login",
      tutorial: "https://help.taskade.com/en/articles/8958455-taskade-ai-usage",
      desktopLabel: "获取 Taskade Windows 版"
    })]
  },
  {
    id: "tldv",
    name: "tl;dv",
    initial: "T",
    color: "#6954e8",
    description: "提供会议录制、转写、摘要和团队会议信息分析。",
    website: "https://tldv.io/",
    tutorial: "https://tldv.io/features/ai-meeting-minutes/",
    products: [d({
      id: "tldv-desktop",
      name: "tl;dv Desktop",
      category: "办公自动化",
      description: "Windows 无机器人会议录制与 AI 笔记工具，支持转写、摘要和会议信息检索；录音前需遵守会议授权与当地隐私规则。",
      downloadPage: "https://tldv.io/desktop-app/",
      homePage: "https://tldv.io/",
      tutorial: "https://tldv.io/features/ai-meeting-minutes/",
      desktopLabel: "获取 tl;dv Windows 版"
    })]
  },
  {
    id: "aftershoot",
    name: "Aftershoot",
    initial: "A",
    color: "#18181b",
    description: "提供面向摄影工作流的本地 AI 选片、编辑与修图软件。",
    website: "https://aftershoot.com/",
    tutorial: "https://support.aftershoot.com/en/articles/5353327-how-to-download-and-install-aftershoot",
    products: [d({
      id: "aftershoot",
      name: "Aftershoot",
      category: "图像创作",
      description: "Windows 摄影选片、批量编辑与修图工具，AI 处理可在本机工作；订阅、训练配置与硬件要求以官方说明为准。",
      downloadPage: "https://aftershoot.com/downloads/",
      homePage: "https://aftershoot.com/",
      tutorial: "https://support.aftershoot.com/en/articles/5353327-how-to-download-and-install-aftershoot",
      desktopLabel: "获取 Aftershoot Windows 版"
    })]
  },
  {
    id: "excire",
    name: "Excire",
    initial: "E",
    color: "#ef5a29",
    description: "开发本地运行的 AI 照片与视频管理、检索和选片软件。",
    website: "https://excire.com/en/",
    tutorial: "https://excire.com/en/excire-foto-2027-is-here/",
    products: [d({
      id: "excire-foto",
      name: "Excire Foto",
      category: "图像创作",
      description: "Windows 本地 AI 照片和视频管理工具，支持内容检索、人物识别与智能选片；当前版本、系统要求和授权方式以官网为准。",
      downloadPage: "https://support.excire.com/portal/en/kb/articles/download-excire-foto-2025",
      homePage: "https://excire.com/en/excire-foto-2027-is-here/",
      tutorial: "https://excire.com/en/excire-foto-2027-is-here/",
      desktopLabel: "获取 Excire Foto Windows 版"
    })]
  },
  {
    id: "evoto",
    name: "Evoto",
    initial: "E",
    color: "#1f8aff",
    description: "提供人像、色彩、背景和批量工作流结合的 AI 照片编辑器。",
    website: "https://www.evoto.ai/",
    tutorial: "https://www.evoto.ai/ai-photo-editor",
    products: [d({
      id: "evoto-desktop",
      name: "Evoto",
      category: "图像创作",
      description: "Windows AI 人像与照片编辑器，支持批量修图、色彩、背景和人像调整；导出消耗、账号与云端能力以官方方案为准。",
      downloadPage: "https://www.evoto.ai/download",
      homePage: "https://www.evoto.ai/ai-photo-editor",
      tutorial: "https://www.evoto.ai/ai-photo-editor",
      desktopLabel: "获取 Evoto Windows 版"
    })]
  },
  {
    id: "maxqda",
    name: "MAXQDA",
    initial: "M",
    color: "#ff6b00",
    description: "提供定性与混合方法研究、数据分析及 AI 辅助研究工具。",
    website: "https://www.maxqda.com/",
    tutorial: "https://www.maxqda.com/help/ai-assist/what-is-ai-assist",
    products: [d({
      id: "maxqda-desktop",
      name: "MAXQDA",
      category: "文档与知识库",
      description: "Windows 定性与混合方法研究软件，可通过 AI Assist 辅助摘要、编码和分析；AI Assist 需联网且存在许可与地区限制。",
      downloadPage: "https://www.maxqda.com/updates",
      homePage: "https://www.maxqda.com/products/maxqda",
      tutorial: "https://www.maxqda.com/help/ai-assist/what-is-ai-assist",
      desktopLabel: "获取 MAXQDA Windows 版"
    })]
  },
  {
    id: "lumivero",
    name: "Lumivero",
    initial: "L",
    color: "#5b2aa6",
    description: "提供研究分析、定性数据处理和知识组织软件。",
    website: "https://lumivero.com/",
    tutorial: "https://lumivero.com/ai-info/",
    products: [
      d({
        id: "nvivo",
        name: "NVivo",
        category: "文档与知识库",
        description: "Windows 定性数据分析工具，支持 AI 摘要、主题与自动编码等辅助能力；功能范围取决于版本、许可和账号。",
        downloadPage: "https://lumivero.com/resources/support/getting-started-with-nvivo/download-and-activate-nvivo/",
        homePage: "https://lumivero.com/products/nvivo/",
        tutorial: "https://lumivero.com/resources/blog/nvivo-15-3-release/",
        desktopLabel: "获取 NVivo Windows 版"
      }),
      d({
        id: "atlas-ti",
        name: "ATLAS.ti",
        category: "文档与知识库",
        description: "Windows 质性研究与数据分析工具，提供 AI Coding、对话和检索辅助；许可、模型、数据处理与联网要求以官方说明为准。",
        downloadPage: "https://atlasti.com/atlas-ti-desktop",
        homePage: "https://atlasti.com/atlas-ti-desktop",
        tutorial: "https://manuals.atlasti.com/Win/en/manual/SearchAndCode/SearchAndCode.html",
        desktopLabel: "获取 ATLAS.ti Windows 版"
      }),
      d({
        id: "citavi",
        name: "Citavi",
        category: "文档与知识库",
        description: "合并 Web 与 Windows 入口的文献、知识和任务管理工具，提供 AI 辅助研究能力；桌面与云功能边界以许可和账号为准。",
        downloadPage: "https://www1.citavi.com/sub/manual7/en/using_msi_assistant.html",
        homePage: "https://lumivero.com/products/citavi/",
        webPage: "https://citaviweb.citavi.com/",
        webLabel: "Citavi Web",
        tutorial: "https://lumivero.com/products/citavi/",
        desktopLabel: "获取 Citavi Windows 版"
      })
    ]
  },
  {
    id: "wrike",
    name: "Wrike",
    initial: "W",
    color: "#08a88a",
    description: "提供项目管理、团队协作和 Work Intelligence AI 能力。",
    website: "https://www.wrike.com/",
    tutorial: "https://www.wrike.com/features/work-intelligence/",
    products: [d({
      id: "wrike-desktop",
      name: "Wrike",
      category: "项目与协作",
      description: "合并 Web 与 Windows 入口的项目协作平台，包含内容生成、风险预测和工作智能功能；可用性取决于方案与管理员设置。",
      downloadPage: "https://www.wrike.com/apps/mobile-and-desktop/desktop-app/",
      homePage: "https://www.wrike.com/ai/",
      webPage: "https://www.wrike.com/workspace.htm",
      tutorial: "https://help.wrike.com/hc/en-us/articles/1500005218242-Install-the-Desktop-App",
      desktopLabel: "获取 Wrike Windows 版"
    })]
  },
  {
    id: "motion",
    name: "Motion",
    initial: "M",
    color: "#5b45ff",
    description: "提供 AI 日历、任务、项目和时间规划工作台。",
    website: "https://www.usemotion.com/",
    tutorial: "https://www.usemotion.com/help",
    products: [d({
      id: "motion-desktop",
      name: "Motion",
      category: "办公自动化",
      description: "合并 Web 与 Windows 入口的 AI 日历和任务规划工具，可自动安排工作；账号、团队功能和自动排程范围以官方方案为准。",
      downloadPage: "https://www.usemotion.com/download",
      homePage: "https://www.usemotion.com/features/ai-calendar",
      webPage: "https://app.usemotion.com/",
      tutorial: "https://www.usemotion.com/help",
      desktopLabel: "获取 Motion Windows 版"
    })]
  },
  {
    id: "coda",
    name: "Coda",
    initial: "C",
    color: "#f46a54",
    description: "提供文档、表格、应用构建与 Coda AI 协作平台。",
    website: "https://coda.io/",
    tutorial: "https://help.coda.io/hc/en-us/articles/39555802361613-Coda-AI-features",
    products: [w({
      id: "coda-ai",
      name: "Coda AI",
      category: "文档与知识库",
      description: "网页文档与团队工作台，可使用 AI 助手、AI 列和 AI 块生成、总结与整理内容；额度和数据范围以方案为准。",
      website: "https://coda.io/product/ai",
      tutorial: "https://help.coda.io/hc/en-us/articles/39555802361613-Coda-AI-features"
    })]
  },
  {
    id: "reclaim",
    name: "Reclaim.ai",
    initial: "R",
    color: "#625df5",
    description: "提供面向 Google 与 Outlook 日历的 AI 排程和时间管理服务。",
    website: "https://reclaim.ai/",
    tutorial: "https://help.reclaim.ai/en/articles/14846468-reclaim-ai-2-0-overview",
    products: [w({
      id: "reclaim-ai",
      name: "Reclaim.ai",
      category: "办公自动化",
      description: "网页 AI 日历助理，可协调会议、任务、专注时间和日程冲突；2.0 Agent 与 Assistant 的开放范围以官方账号状态为准。",
      website: "https://app.reclaim.ai/",
      tutorial: "https://help.reclaim.ai/en/articles/14846468-reclaim-ai-2-0-overview"
    })]
  },
  {
    id: "techsmith",
    name: "TechSmith",
    initial: "T",
    color: "#1e6bd6",
    description: "开发屏幕录制、截图、视频编辑和文本式音频编辑软件。",
    website: "https://www.techsmith.com/",
    tutorial: "https://www.techsmith.com/learn/",
    products: [
      d({
        id: "camtasia",
        name: "Camtasia",
        category: "视频创作",
        description: "Windows 屏幕录制与视频编辑器，提供 AI 脚本、背景、降噪、字幕和工作流辅助；免费导出、订阅和 AI 权益以官方方案为准。",
        downloadPage: "https://www.techsmith.com/download/camtasia/",
        homePage: "https://www.techsmith.com/camtasia/",
        tutorial: "https://www.techsmith.com/learn/tutorials/camtasia/",
        desktopLabel: "获取 Camtasia Windows 版"
      }),
      d({
        id: "snagit",
        name: "Snagit",
        category: "图像创作",
        description: "Windows 截图与屏幕录制工具，包含文本识别、智能编辑和生成式辅助功能；具体能力取决于当前版本与许可。",
        downloadPage: "https://www.techsmith.com/snagit/",
        homePage: "https://www.techsmith.com/snagit/",
        tutorial: "https://support.techsmith.com/hc/en-us/articles/203731078",
        desktopLabel: "获取 Snagit Windows 版"
      }),
      d({
        id: "audiate",
        name: "Audiate",
        category: "音频创作",
        description: "Windows 文本式音频编辑和语音处理工具，支持转写、语气清理与 AI 辅助编辑；功能与额度以 TechSmith 许可为准。",
        downloadPage: "https://www.techsmith.com/camtasia/audiate/download/download-audiate-win/",
        homePage: "https://www.techsmith.com/camtasia/audiate/",
        tutorial: "https://www.techsmith.com/learn/tutorials/audiate/",
        desktopLabel: "获取 Audiate Windows 版"
      })
    ]
  },
  {
    id: "knime",
    name: "KNIME",
    initial: "K",
    color: "#f8d922",
    description: "提供开源数据分析、可视化工作流和 AI Agent 编排平台。",
    website: "https://www.knime.com/",
    tutorial: "https://www.knime.com/release-notes",
    products: [d({
      id: "knime-analytics-platform",
      name: "KNIME Analytics Platform",
      category: "数据库与数据",
      description: "Windows 开源可视化数据分析工具，包含 K-AI 和 Agentic AI 工作流能力；扩展、模型连接和企业能力以官方说明为准。",
      downloadPage: "https://www.knime.com/get-started",
      homePage: "https://www.knime.com/knime-analytics-platform",
      tutorial: "https://www.knime.com/release-notes",
      desktopLabel: "获取 KNIME Windows 版"
    })]
  },
  {
    id: "dbeaver",
    name: "DBeaver",
    initial: "D",
    color: "#382923",
    description: "提供跨数据库管理、开发和 AI 辅助查询工具。",
    website: "https://dbeaver.com/",
    tutorial: "https://dbeaver.com/docs/dbeaver/Installation/",
    products: [d({
      id: "dbeaver-pro",
      name: "DBeaver PRO",
      category: "数据库与数据",
      description: "Windows 数据库管理工具，Lite、Enterprise 和 Ultimate 版本可使用 AI Assistant；Community 版不包含该能力。",
      downloadPage: "https://dbeaver.com/download/",
      homePage: "https://dbeaver.com/edition/",
      tutorial: "https://dbeaver.com/docs/dbeaver/Installation/",
      desktopLabel: "获取 DBeaver PRO Windows 版"
    })]
  },
  {
    id: "alteryx",
    name: "Alteryx",
    initial: "A",
    color: "#0078c9",
    description: "提供企业数据准备、分析自动化和 AI 工作流工具。",
    website: "https://www.alteryx.com/",
    tutorial: "https://help.alteryx.com/current/en/designer/tools/ai-tools.html",
    products: [d({
      id: "alteryx-designer",
      name: "Alteryx Designer",
      category: "数据库与数据",
      description: "Windows 可视化数据分析和自动化工具，Professional 与 Enterprise 方案提供 AI 工具；当前版本需通过 Alteryx One 账号获取。",
      downloadPage: "https://help.alteryx.com/current/en/designer/what-s-new-in-designer.html",
      homePage: "https://www.alteryx.com/products/alteryx-designer",
      tutorial: "https://help.alteryx.com/current/en/designer/tools/ai-tools.html",
      desktopLabel: "获取 Alteryx Designer Windows 版"
    })]
  },
  {
    id: "gitkraken",
    name: "GitKraken",
    initial: "G",
    color: "#179287",
    description: "提供 Git 图形客户端、开发协作和 GitKraken AI。",
    website: "https://www.gitkraken.com/",
    tutorial: "https://support.gitkraken.com/gitkraken-desktop/gkd-gitkraken-ai/",
    products: [d({
      id: "gitkraken-desktop",
      name: "GitKraken Desktop",
      category: "编程与调试",
      description: "Windows Git 图形客户端，提供提交说明、变更解释和开发辅助 AI；AI 权益取决于付费方案与管理员策略。",
      downloadPage: "https://www.gitkraken.com/download",
      homePage: "https://www.gitkraken.com/git-client",
      tutorial: "https://support.gitkraken.com/gitkraken-desktop/gkd-gitkraken-ai/",
      desktopLabel: "获取 GitKraken Windows 版"
    })]
  },
  {
    id: "termius",
    name: "Termius",
    initial: "T",
    color: "#171a21",
    description: "提供跨平台 SSH、终端管理与 AI 辅助运维能力。",
    website: "https://termius.com/",
    tutorial: "https://termius.com/blog/boost-your-terminal-experience-with-ai",
    products: [d({
      id: "termius-desktop",
      name: "Termius",
      category: "云服务与运维",
      description: "Windows SSH 与终端管理客户端，提供 AI 自动补全并逐步开放 AI Agent；部分能力仍处于测试或受邀范围。",
      downloadPage: "https://termius.com/download/windows",
      homePage: "https://termius.com/",
      tutorial: "https://termius.com/blog/ai-agent",
      desktopLabel: "获取 Termius Windows 版"
    })]
  },
  {
    id: "lens",
    name: "Lens",
    initial: "L",
    color: "#3d90ce",
    description: "提供 Kubernetes 图形管理、集群可观测与 AI 辅助运维工具。",
    website: "https://k8slens.dev/",
    tutorial: "https://docs.k8slens.dev/k8slens/premium-features/",
    products: [d({
      id: "lens-desktop",
      name: "Lens Desktop",
      category: "云服务与运维",
      description: "Windows Kubernetes IDE，Premium 能力包含 Lens Prism、Ask AI 与 MCP；集群权限和 AI 方案以组织设置为准。",
      downloadPage: "https://k8slens.dev/download",
      homePage: "https://k8slens.dev/",
      tutorial: "https://docs.k8slens.dev/k8slens/premium-features/",
      desktopLabel: "获取 Lens Windows 版"
    })]
  },
  {
    id: "nero",
    name: "Nero",
    initial: "N",
    color: "#111111",
    description: "开发 Windows 多媒体处理、照片管理和 AI 增强软件。",
    website: "https://www.nero.com/",
    tutorial: "https://support.nero.com/",
    products: [
      d({
        id: "nero-ai-photo-tagger",
        name: "Nero AI Photo Tagger",
        category: "图像创作",
        description: "Windows 本地 AI 照片分类和标签工具，可按内容组织图库；版本、模型包和系统要求以官方说明为准。",
        downloadPage: "https://www.nero.com/eng/downloads/",
        homePage: "https://www.nero.com/enu/products/nero-ai-phototagger/",
        tutorial: "https://support.nero.com/en/support/solutions/articles/44001805758-download-links-of-nero-program-installers",
        desktopLabel: "获取 Nero AI Photo Tagger"
      }),
      d({
        id: "nero-ai-image-upscaler",
        name: "Nero AI Image Upscaler",
        category: "图像创作",
        description: "Windows AI 图像放大和增强工具；免费额度、批量处理、输出分辨率与硬件要求以官方方案为准。",
        downloadPage: "https://www.nero.com/eng/downloads/",
        homePage: "https://ai.nero.com/image-upscaler",
        tutorial: "https://support.nero.com/",
        desktopLabel: "获取 Nero AI Image Upscaler"
      }),
      d({
        id: "nero-ai-video-upscaler",
        name: "Nero AI Video Upscaler",
        category: "视频创作",
        description: "Windows AI 视频放大与画质增强工具；模型、导出限制、显卡和许可要求以官方页面为准。",
        downloadPage: "https://www.nero.com/eng/downloads/",
        homePage: "https://ai.nero.com/video-upscaler",
        tutorial: "https://support.nero.com/",
        desktopLabel: "获取 Nero AI Video Upscaler"
      })
    ]
  },
  {
    id: "hitpaw",
    name: "HitPaw",
    initial: "H",
    color: "#6c4cff",
    description: "提供 Windows 视频、照片、语音与剪辑类 AI 创作软件。",
    website: "https://www.hitpaw.com/",
    tutorial: "https://www.hitpaw.com/download-center/",
    products: [
      d({
        id: "hitpaw-vikpea",
        name: "HitPaw VikPea",
        category: "视频创作",
        description: "Windows AI 视频增强工具，支持放大、修复、降噪和上色；模型、免费导出和显卡要求以官方版本为准。",
        downloadPage: "https://www.hitpaw.com/download-center/",
        homePage: "https://www.hitpaw.com/vikpea-video-enhancer.html",
        tutorial: "https://www.hitpaw.com/video-tips/",
        desktopLabel: "获取 VikPea Windows 版"
      }),
      d({
        id: "hitpaw-fotorpea",
        name: "HitPaw FotorPea",
        category: "图像创作",
        description: "Windows AI 照片增强与编辑工具，支持修复、放大和人像生成；免费额度、模型和导出边界以官方说明为准。",
        downloadPage: "https://www.hitpaw.com/download-center/",
        homePage: "https://www.hitpaw.com/fotorpea-photo-enhancer.html",
        tutorial: "https://www.hitpaw.com/photo-tips/",
        desktopLabel: "获取 FotorPea Windows 版"
      }),
      d({
        id: "hitpaw-voicepea",
        name: "HitPaw VoicePea",
        category: "音频创作",
        description: "Windows 实时 AI 变声与音频创作工具，支持声音效果、翻唱和音乐生成；声音授权和商用范围由用户自行确认。",
        downloadPage: "https://www.hitpaw.com/download-center/",
        homePage: "https://www.hitpaw.com/voice-changer.html",
        tutorial: "https://www.hitpaw.com/audio-tips/",
        desktopLabel: "获取 VoicePea Windows 版"
      }),
      d({
        id: "hitpaw-edimakor",
        name: "HitPaw Edimakor",
        category: "视频创作",
        description: "Windows AI 视频编辑器，提供字幕、脚本、配音、翻译与素材生成辅助；功能、额度和素材许可以官方方案为准。",
        downloadPage: "https://www.hitpaw.com/download-center/",
        homePage: "https://edimakor.hitpaw.com/",
        tutorial: "https://www.hitpaw.com/video-editing-tips/",
        desktopLabel: "获取 Edimakor Windows 版"
      })
    ]
  },
  {
    id: "anthropics",
    name: "Anthropics Technology",
    initial: "A",
    color: "#343434",
    description: "开发基于机器学习的人像、面部和影像编辑软件。",
    website: "https://www.anthropics.com/",
    tutorial: "https://www.anthropics.com/portraitpro/",
    products: [d({
      id: "portraitpro",
      name: "PortraitPro",
      category: "图像创作",
      description: "Windows AI 人像修图工具，可进行面部、皮肤、光线、头发和背景调整；版本、插件与商用许可以官方说明为准。",
      downloadPage: "https://www.anthropics.com/portraitpro/download/",
      homePage: "https://www.anthropics.com/portraitpro/",
      tutorial: "https://www.anthropics.com/portraitpro/support/",
      desktopLabel: "获取 PortraitPro Windows 版"
    })]
  },
  {
    id: "izotope",
    name: "iZotope",
    initial: "I",
    color: "#171717",
    description: "开发智能音频修复、混音、母带和创作软件。",
    website: "https://www.izotope.com/",
    tutorial: "https://www.izotope.com/en/products/rx/features",
    products: [d({
      id: "izotope-rx",
      name: "iZotope RX",
      category: "音频创作",
      description: "Windows 智能音频修复工具，使用机器学习与神经网络处理噪声、对白和残缺音频；插件、版本与宿主要求以官方说明为准。",
      downloadPage: "https://www.izotope.com/en/products/downloads.html",
      homePage: "https://www.izotope.com/products/rx-standard",
      tutorial: "https://www.izotope.com/en/products/rx/features",
      desktopLabel: "获取 iZotope RX Windows 版"
    })]
  },
  {
    id: "steinberg",
    name: "Steinberg",
    initial: "S",
    color: "#1c5fa8",
    description: "开发数字音频、谱层编辑和音乐制作软件。",
    website: "https://www.steinberg.net/",
    tutorial: "https://www.steinberg.net/spectralayers/features/",
    products: [d({
      id: "steinberg-spectralayers",
      name: "SpectraLayers",
      category: "音频创作",
      description: "Windows 谱层音频编辑工具，提供 AI 驱动的分离、去混响和修复能力；版本、授权管理和硬件要求以官方说明为准。",
      downloadPage: "https://www.steinberg.net/spectralayers/",
      homePage: "https://www.steinberg.net/spectralayers/",
      tutorial: "https://www.steinberg.net/spectralayers/features/",
      desktopLabel: "获取 SpectraLayers Windows 版"
    })]
  },
  {
    id: "supernormal",
    name: "Supernormal",
    initial: "S",
    color: "#6b46c1",
    description: "提供会议记录、摘要、行动项和会议信息自动化。",
    website: "https://www.supernormal.com/",
    tutorial: "https://www.supernormal.com/meeting-notetaker",
    products: [d({
      id: "supernormal-desktop",
      name: "Supernormal",
      category: "办公自动化",
      description: "Windows 11 无机器人会议捕获与 AI 笔记工具，录制后在 Web 中查看摘要与内容；使用前需确认会议参与者授权。",
      downloadPage: "https://help.supernormal.com/en/articles/11801191-download-the-app-for-your-system",
      homePage: "https://www.supernormal.com/meeting-notetaker",
      webPage: "https://app.supernormal.com/",
      tutorial: "https://help.supernormal.com/en/articles/7208093-which-operating-systems-does-supernormal-work-with",
      desktopLabel: "获取 Supernormal Windows 版"
    })]
  },
  {
    id: "meetgeek",
    name: "MeetGeek",
    initial: "M",
    color: "#6857ff",
    description: "提供会议录制、转写、摘要、会议信息分析和 AI Agent。",
    website: "https://meetgeek.ai/",
    tutorial: "https://support.meetgeek.ai/en/articles/13745672-meetgeek-desktop-app-quickstart-guide",
    products: [d({
      id: "meetgeek-desktop",
      name: "MeetGeek Desktop",
      category: "办公自动化",
      description: "Windows 无机器人会议录制与 AI 摘要工具，可捕获本机会议并生成笔记；录音授权、额度与集成范围以官方说明为准。",
      downloadPage: "https://meetgeek.ai/desktop-app",
      homePage: "https://meetgeek.ai/desktop-app",
      webPage: "https://app.meetgeek.ai/",
      tutorial: "https://support.meetgeek.ai/en/articles/13745672-meetgeek-desktop-app-quickstart-guide",
      desktopLabel: "获取 MeetGeek Windows 版"
    })]
  },
  {
    id: "fellow",
    name: "Fellow",
    initial: "F",
    color: "#5d58e8",
    description: "提供会议议程、录制、转写、摘要和团队会议知识库。",
    website: "https://fellow.app/",
    tutorial: "https://help.fellow.app/en/articles/4340265-download-the-desktop-app",
    products: [d({
      id: "fellow-desktop",
      name: "Fellow",
      category: "办公自动化",
      description: "合并 Web 与 Windows 入口的 AI 会议助手，可录制、转写、生成回顾与洞察；桌面端需要联网，录音前需取得参与者授权。",
      downloadPage: "https://fellow.app/download",
      homePage: "https://fellow.app/",
      webPage: "https://app.fellow.app/",
      tutorial: "https://help.fellow.app/en/articles/4340265-download-the-desktop-app",
      desktopLabel: "获取 Fellow Windows 版"
    })]
  },
  {
    id: "teamviewer",
    name: "TeamViewer",
    initial: "T",
    color: "#006ce0",
    description: "提供远程支持、设备管理及 AI 会话洞察和故障辅助。",
    website: "https://www.teamviewer.com/",
    tutorial: "https://www.teamviewer.com/en-us/global/support/knowledge-base/teamviewer-remote/licenses/licenses-and-features/ai-credit-based-payment-model/",
    products: [d({
      id: "teamviewer-remote-ai",
      name: "TeamViewer Remote",
      category: "远程控制",
      description: "Windows 远程支持客户端，可按许可使用 Session Insights、Tia 和 AI 辅助脚本；AI 处理受管理员策略、权限与点数控制。",
      downloadPage: "https://www.teamviewer.com/en/download/windows/",
      homePage: "https://www.teamviewer.com/en/products/remote/",
      webPage: "https://web.teamviewer.com/",
      tutorial: "https://www.teamviewer.com/en-us/global/support/knowledge-base/teamviewer-remote/licenses/licenses-and-features/ai-credit-based-payment-model/",
      desktopLabel: "获取 TeamViewer Windows 版"
    })]
  },
  {
    id: "microsoft",
    products: [d({
      id: "microsoft-power-bi-desktop",
      name: "Power BI Desktop",
      category: "数据库与数据",
      description: "Windows 商业分析与报表工具，可在满足 Fabric 或 Premium 容量、租户和工作区条件时使用 Copilot；免费桌面版不等于自动获得 Copilot。",
      downloadPage: "https://www.microsoft.com/en-us/download/details.aspx?id=58494",
      homePage: "https://powerbi.microsoft.com/desktop/",
      webPage: "https://app.powerbi.com/",
      webLabel: "Power BI Web",
      tutorial: "https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-power-bi-desktop",
      desktopLabel: "获取 Power BI Desktop"
    })]
  },
  {
    id: "salesforce",
    products: [d({
      id: "tableau-desktop",
      name: "Tableau Desktop",
      category: "数据库与数据",
      description: "Windows 可视化分析工具，2025.1 及以上版本可在满足站点、许可和功能开关条件时使用 Tableau Agent。",
      downloadPage: "https://www.tableau.com/support/releases",
      homePage: "https://www.tableau.com/products/desktop",
      webPage: "https://www.tableau.com/products/cloud-bi",
      webLabel: "Tableau Cloud",
      tutorial: "https://help.tableau.com/current/pro/desktop/en-gb/desktop_einstein.htm",
      desktopLabel: "获取 Tableau Desktop Windows 版"
    })]
  },
  {
    id: "adobe",
    products: [
      d({
        id: "adobe-photoshop",
        name: "Adobe Photoshop",
        category: "图像创作",
        description: "Windows 专业图像编辑器，提供生成式填充、生成式扩展和多种 Firefly AI 工作流；功能、点数与地区范围以 Adobe 账号为准。",
        downloadPage: "https://www.adobe.com/products/photoshop/free-trial-download.html",
        homePage: "https://www.adobe.com/products/photoshop.html",
        webPage: "https://photoshop.adobe.com/",
        webLabel: "Photoshop Web",
        tutorial: "https://helpx.adobe.com/photoshop/desktop/generative-ai/generative-ai-features-overview.html",
        desktopLabel: "获取 Photoshop Windows 版"
      }),
      d({
        id: "adobe-lightroom",
        name: "Adobe Lightroom",
        category: "图像创作",
        description: "Windows 照片整理与编辑器，提供生成式移除、降噪和智能蒙版；云同步、生成点数与功能范围以 Adobe 方案为准。",
        downloadPage: "https://www.adobe.com/products/photoshop-lightroom/free-trial-download.html",
        homePage: "https://www.adobe.com/products/photoshop-lightroom.html",
        webPage: "https://lightroom.adobe.com/",
        webLabel: "Lightroom Web",
        tutorial: "https://helpx.adobe.com/lightroom/desktop/using/generative-remove-faq.html",
        desktopLabel: "获取 Lightroom Windows 版"
      }),
      d({
        id: "adobe-premiere",
        name: "Adobe Premiere",
        category: "视频创作",
        description: "Windows 专业视频编辑器，提供生成式延长、语音增强、文本式编辑和智能媒体工作流；AI 能力依赖版本、账号与点数。",
        downloadPage: "https://www.adobe.com/products/premiere/free-trial-download.html",
        homePage: "https://www.adobe.com/products/premiere.html",
        tutorial: "https://helpx.adobe.com/uk/premiere/desktop/edit-projects/edit-with-generative-ai/add-frames-using-generative-extend.html",
        desktopLabel: "获取 Premiere Windows 版"
      }),
      d({
        id: "adobe-illustrator",
        name: "Adobe Illustrator",
        category: "图像创作",
        description: "Windows 矢量设计工具，提供生成式形状填充、文本生成矢量和智能编辑；模型、点数与商用条款以 Adobe 说明为准。",
        downloadPage: "https://www.adobe.com/products/illustrator/free-trial-download.html",
        homePage: "https://www.adobe.com/products/illustrator.html",
        tutorial: "https://helpx.adobe.com/illustrator/desktop/use-generative-ai/generate-shape-fills.html",
        desktopLabel: "获取 Illustrator Windows 版"
      }),
      w({
        id: "adobe-firefly",
        name: "Adobe Firefly",
        category: "图像创作",
        description: "Adobe 网页生成式创作平台，可生成与编辑图像、视频、音频和设计内容；模型、生成点数及地区可用性以官方账号为准。",
        website: "https://firefly.adobe.com/",
        tutorial: "https://helpx.adobe.com/creative-cloud/apps/generative-ai/generative-ai-overview.html"
      })
    ]
  }
];

const reviewedFallbacks = {
  mylio: "https://mylio.com/",
  clarivate: "https://clarivate.com/",
  taskade: "https://www.taskade.com/",
  tldv: "https://tldv.io/",
  aftershoot: "https://aftershoot.com/",
  excire: "https://excire.com/en/",
  evoto: "https://www.evoto.ai/",
  maxqda: "https://www.maxqda.com/",
  lumivero: "https://lumivero.com/",
  wrike: "https://www.wrike.com/",
  motion: "https://www.usemotion.com/",
  coda: "https://coda.io/",
  reclaim: "https://reclaim.ai/",
  techsmith: "https://www.techsmith.com/",
  knime: "https://www.knime.com/",
  dbeaver: "https://dbeaver.com/",
  alteryx: "https://www.alteryx.com/",
  gitkraken: "https://www.gitkraken.com/",
  termius: "https://www.termius.com/brand-resources",
  lens: "https://k8slens.dev/",
  nero: "https://www.nero.com/",
  hitpaw: "https://www.hitpaw.com/",
  anthropics: "https://www.anthropics.com/",
  izotope: "https://www.izotope.com/",
  steinberg: "https://www.steinberg.net/",
  supernormal: "https://www.supernormal.com/",
  meetgeek: "https://meetgeek.ai/",
  fellow: "https://fellow.app/",
  teamviewer: "https://www.teamviewer.com/"
};

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const productOwners = new Map(
  catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => [product.id, vendor.id])
  )
);
let nextVendorOrder = Math.max(-1, ...catalog.vendors.map((vendor) => vendor.order ?? 0)) + 1;

function upsertProduct(vendor, product) {
  const owner = productOwners.get(product.id);
  if (owner && owner !== vendor.id) {
    throw new Error(`产品 ID 已属于其他厂商：${product.id}`);
  }
  const existing = vendor.products.find((entry) => entry.id === product.id);
  if (existing) applyDefinition(existing, product, ["enabled", "order"]);
  else vendor.products.push(product);
  productOwners.set(product.id, vendor.id);
}

for (const definition of definitions) {
  let vendor = catalog.vendors.find((entry) => entry.id === definition.id);
  if (!vendor) {
    if (!definition.name || !definition.initial) {
      throw new Error(`扩展目标厂商不存在且缺少新厂商资料：${definition.id}`);
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
  } else if (definition.name) {
    applyDefinition(vendor, { ...definition, mark: definition.initial }, [
      "enabled",
      "order",
      "iconAsset",
      "iconUrl",
      "requiresCrossBorderNetwork",
      "products"
    ]);
  }
  for (const product of definition.products) upsertProduct(vendor, product);
}

catalog.updatedAt = verifiedAt;
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

const fallbacks = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
fallbacks.reviewedAt = verifiedAt;
for (const [vendorId, evidenceUrl] of Object.entries(reviewedFallbacks)) {
  fallbacks.vendors[vendorId] = {
    evidenceUrl,
    reason: "官方产品与厂商身份已核验，但尚未固定具有明确第三方目录使用边界的方形品牌素材；先使用文字兜底，禁止用 favicon、搜索图片或其他厂商图标替代。"
  };
}
fs.writeFileSync(fallbackPath, `${JSON.stringify(fallbacks, null, 2)}\n`, "utf8");

process.stdout.write(
  `Expanded ${catalog.vendors.length} vendors, ${catalog.vendors.flatMap((vendor) => vendor.products).length} products and ${catalog.resources.length} resources\n`
);
