"use strict";

function desktopProduct({
  id,
  name,
  category,
  description,
  website,
  tutorial = website,
  home = website,
  web,
  desktopLabel = `${name} Windows 下载`
}) {
  const entryPoints = [{ type: "website", label: "工具官网", url: home }];
  if (web) {
    entryPoints.push({ type: "web", label: `${name} 网页版`, url: web });
  }
  entryPoints.push({ type: "desktop", label: desktopLabel });
  return {
    id,
    name,
    directoryKind: "ai-tool",
    kind: "桌面端",
    category,
    description,
    website,
    tutorial,
    productType: "desktop-official",
    moduleId: "desktop-official",
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    requirements: [],
    installProfileId: "",
    capabilities: ["website", "tutorial"],
    entryPoints,
    enabled: true
  };
}

function vendor({
  id,
  name,
  initial,
  mark = initial,
  color,
  description,
  website,
  tutorial = website,
  products
}) {
  return {
    id,
    name,
    initial,
    mark,
    color,
    description,
    website,
    tutorial,
    iconUrl: "",
    products,
    enabled: true
  };
}

const existingVendorProducts = Object.freeze({
  nousresearch: [
    desktopProduct({
      id: "nous-hermes-desktop",
      name: "Hermes Desktop",
      category: "智能体",
      description: "Nous Research 的 Hermes 原生可视化 Agent；Windows 版本仍处于 Early Beta。",
      website: "https://github.com/nousresearch/hermes-agent/releases/latest",
      home: "https://nousresearch.net/hermes-agent/",
      tutorial: "https://github.com/nousresearch/hermes-agent/blob/main/apps/desktop/README.md"
    })
  ],
  microsoft: [
    desktopProduct({
      id: "microsoft-365-copilot",
      name: "Microsoft 365 Copilot",
      category: "智能体",
      description: "面向文档、表格、演示和协作工作流的 Microsoft 365 Copilot Windows 应用。",
      website: "https://support.microsoft.com/en-us/microsoft-365-copilot/access-microsoft-365-copilot-on-windows",
      home: "https://www.microsoft.com/en-us/microsoft-365-copilot",
      web: "https://m365.cloud.microsoft/",
      tutorial: "https://support.microsoft.com/en-us/microsoft-365-copilot/what-is-the-microsoft-365-copilot-app"
    })
  ],
  bytedance: [
    desktopProduct({
      id: "bytedance-feishu",
      name: "飞书",
      category: "智能体",
      description: "集成知识问答、妙记、多维表格等 AI 能力的飞书 Windows 协作客户端。",
      website: "https://www.feishu.cn/download?lang=zh-CN",
      home: "https://www.feishu.cn/",
      web: "https://www.feishu.cn/product/base",
      tutorial: "https://www.feishu.cn/service/ai?open-from=official_website"
    })
  ],
  alibaba: [
    desktopProduct({
      id: "alibaba-quark-ai-browser",
      name: "夸克 AI 浏览器",
      category: "智能体",
      description: "提供 AI 搜索、AI 助手和内容处理能力的夸克 Windows 浏览器。",
      website: "https://www.quark.cn/",
      home: "https://www.quark.cn/",
      web: "https://quark.cn/",
      tutorial: "https://www.quark.cn/"
    }),
    desktopProduct({
      id: "alibaba-dingtalk-ai",
      name: "钉钉",
      category: "智能体",
      description: "集成 AI 听记、AI 表格和 AI 搜问的钉钉 Windows 工作平台。",
      website: "https://www.dingtalk.com/download?isLite=0",
      home: "https://www.dingtalk.com/",
      tutorial: "https://www.dingtalk.com/download?isLite=0"
    })
  ],
  tencent: [
    desktopProduct({
      id: "tencent-qq-ai-browser",
      name: "QQ 浏览器",
      category: "智能体",
      description: "集成元宝助手和智能 Agent 的 QQ 浏览器 Windows 客户端。",
      website: "https://browser.qq.com/",
      home: "https://browser.qq.com/",
      tutorial: "https://browser.qq.com/"
    })
  ],
  baidu: [
    desktopProduct({
      id: "baidu-ruliu",
      name: "如流",
      category: "智能体",
      description: "百度面向组织协作和知识工作的智能工作平台 Windows 客户端。",
      website: "https://infoflow.baidu.com/newweb/",
      home: "https://infoflow.baidu.com/newweb/",
      tutorial: "https://infoflow.baidu.com/newweb/"
    })
  ],
  nvidia: [
    desktopProduct({
      id: "nvidia-broadcast",
      name: "NVIDIA Broadcast",
      category: "音频创作",
      description: "面向 RTX 设备的 AI 降噪、虚拟背景和音视频增强 Windows 应用。",
      website: "https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-app/",
      home: "https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-app/",
      tutorial: "https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-app/"
    }),
    desktopProduct({
      id: "nvidia-canvas",
      name: "NVIDIA Canvas",
      category: "图像创作",
      description: "使用生成式模型把简单笔触转成风景图像的 RTX Windows 创作应用。",
      website: "https://www.nvidia.com/en-us/studio/canvas.html",
      home: "https://www.nvidia.com/en-us/studio/canvas.html",
      tutorial: "https://www.nvidia.com/en-us/studio/canvas.html"
    })
  ]
});

const newVendors = Object.freeze([
  vendor({
    id: "jan",
    name: "Jan",
    initial: "J",
    color: "#2563eb",
    description: "开发可离线运行本地模型并连接云模型的开源桌面客户端。",
    website: "https://www.jan.ai/",
    tutorial: "https://www.jan.ai/docs/desktop/install/windows",
    products: [desktopProduct({ id: "jan-desktop", name: "Jan", category: "本地模型", description: "可在 Windows 本地运行模型并连接兼容云服务的开源 AI 客户端。", website: "https://www.jan.ai/docs/desktop/install/windows", home: "https://www.jan.ai/" })]
  }),
  vendor({
    id: "cherryhq",
    name: "CherryHQ",
    initial: "C",
    color: "#ef4444",
    description: "开发多模型、知识库与智能体桌面客户端 Cherry Studio。",
    website: "https://cherry-ai.com/",
    tutorial: "https://docs.cherry-ai.com/",
    products: [desktopProduct({ id: "cherry-studio", name: "Cherry Studio", category: "AI 对话", description: "支持多模型、知识库和 Agent 的跨平台桌面 AI 客户端。", website: "https://cherry-ai.com/download", home: "https://cherry-ai.com/", tutorial: "https://docs.cherry-ai.com/cherry-studio-wen-dang/en-us/pre-basic/installation/windows" })]
  }),
  vendor({
    id: "chatboxai",
    name: "Chatbox AI",
    initial: "C",
    color: "#0ea5e9",
    description: "开发支持多种模型服务的桌面 AI 客户端 Chatbox。",
    website: "https://chatboxai.app/",
    tutorial: "https://chatboxai.app/en/guide/",
    products: [desktopProduct({ id: "chatbox-desktop", name: "Chatbox", category: "AI 对话", description: "支持云模型和本地模型接口的 Windows 桌面 AI 客户端。", website: "https://chatboxai.app/en/install", home: "https://chatboxai.app/", tutorial: "https://chatboxai.app/en/guide/getting-started/download" })]
  }),
  vendor({
    id: "msty",
    name: "Msty",
    initial: "M",
    color: "#7c3aed",
    description: "提供本地模型工作台、自治 Agent 和模型网关产品。",
    website: "https://msty.ai/",
    tutorial: "https://docs.msty.app/",
    products: [
      desktopProduct({ id: "msty-studio", name: "Msty Studio", category: "本地模型", description: "支持本地与在线模型、知识工作流和 Agent Mode 的桌面工作台。", website: "https://msty.ai/products/studio/", home: "https://msty.ai/products/studio/" }),
      desktopProduct({ id: "msty-go", name: "Msty Go", category: "智能体", description: "带审批、Skills 和隔离环境的原生自治 Agent，目前为 Beta。", website: "https://msty.ai/go/", home: "https://msty.ai/go/" }),
      desktopProduct({ id: "msty-nexus", name: "Msty Nexus", category: "本地模型", description: "面向本地模型连接、网关和运行时管理的 Windows 控制中心。", website: "https://msty.ai/products/nexus/", home: "https://msty.ai/products/nexus/" })
    ]
  }),
  vendor({
    id: "lobehub",
    name: "LobeHub",
    initial: "L",
    color: "#111827",
    description: "开发支持本地和远程 Agent 的开源 AI 工作空间。",
    website: "https://lobehub.com/",
    tutorial: "https://github.com/lobehub/lobehub",
    products: [desktopProduct({ id: "lobehub-desktop", name: "LobeHub", category: "智能体", description: "包含本地与远程 Agent 能力的 LobeHub Windows 桌面应用。", website: "https://github.com/lobehub/lobehub/releases/latest", home: "https://lobehub.com/", tutorial: "https://github.com/lobehub/lobehub" })]
  }),
  vendor({
    id: "pieces",
    name: "Pieces",
    initial: "P",
    color: "#f97316",
    description: "开发面向软件工程工作流的本地上下文与 AI 助手。",
    website: "https://pieces.app/",
    tutorial: "https://docs.pieces.app/",
    products: [desktopProduct({ id: "pieces-for-developers", name: "Pieces for Developers", category: "编程开发", description: "面向开发者的本地上下文、代码片段和 AI 工作流桌面应用；Pieces OS 作为随附组件。", website: "https://pieces.app/download", home: "https://pieces.app/about", tutorial: "https://code.pieces.app/support-articles/how-do-i-use-the-windows-pieces-suite-installer" })]
  }),
  vendor({
    id: "windsurf",
    name: "Windsurf",
    initial: "W",
    color: "#14b8a6",
    description: "开发以 Cascade Agent 为核心的 AI 原生代码编辑器。",
    website: "https://windsurf.com/",
    tutorial: "https://docs.windsurf.com/",
    products: [desktopProduct({ id: "windsurf-editor", name: "Windsurf", category: "编程开发", description: "提供 Cascade Agent 和代码库协作能力的 Windows AI IDE。", website: "https://windsurf.com/", home: "https://windsurf.com/", tutorial: "https://docs.windsurf.com/zh/windsurf/getting-started" })]
  }),
  vendor({
    id: "warp",
    name: "Warp",
    initial: "W",
    color: "#6d5dfc",
    description: "开发带智能体能力的现代终端与开发环境。",
    website: "https://www.warp.dev/",
    tutorial: "https://docs.warp.dev/",
    products: [desktopProduct({ id: "warp-windows", name: "Warp", category: "编程开发", description: "支持 Agent 工作流的 Windows 图形终端和开发环境。", website: "https://www.warp.dev/windows-terminal", home: "https://www.warp.dev/", tutorial: "https://www.warp.dev/blog/launching-warp-on-windows" })]
  }),
  vendor({
    id: "zed-industries",
    name: "Zed Industries",
    initial: "Z",
    mark: "Z",
    color: "#22c55e",
    description: "开发原生高性能代码编辑器 Zed 及其 AI Agent 工作流。",
    website: "https://zed.dev/",
    tutorial: "https://zed.dev/docs/",
    products: [desktopProduct({ id: "zed-editor", name: "Zed", category: "编程开发", description: "支持 WSL、AI 和 ACP Agent 的原生 Windows 代码编辑器。", website: "https://zed.dev/windows", home: "https://zed.dev/", tutorial: "https://zed.dev/docs/windows" })]
  }),
  vendor({
    id: "raycast",
    name: "Raycast",
    initial: "R",
    color: "#ff6363",
    description: "开发包含 AI Chat、Skills 和 MCP 的桌面效率平台。",
    website: "https://www.raycast.com/",
    tutorial: "https://manual.raycast.com/",
    products: [desktopProduct({ id: "raycast-windows", name: "Raycast", category: "智能体", description: "包含 AI Chat、Skills 和 MCP 的 Windows 桌面效率平台，目前为 Beta。", website: "https://www.raycast.com/windows", home: "https://www.raycast.com/", tutorial: "https://www.raycast.com/changelog/windows" })]
  }),
  vendor({
    id: "manus",
    name: "Manus",
    initial: "M",
    color: "#111827",
    description: "开发可访问本地文件并执行多步骤工作流的通用智能体。",
    website: "https://manus.im/",
    tutorial: "https://manus.im/docs/",
    products: [desktopProduct({ id: "manus-desktop", name: "Manus", category: "智能体", description: "可访问本地文件、运行命令并自动化工作流的 Manus Windows 客户端。", website: "https://manus.im/desktop", home: "https://manus.im/", web: "https://manus.im/app", tutorial: "https://manus.im/docs/features/desktop" })]
  }),
  vendor({
    id: "quora",
    name: "Quora",
    initial: "Q",
    mark: "Q",
    color: "#5d25d0",
    description: "运营多模型 AI 对话与应用平台 Poe。",
    website: "https://poe.com/",
    tutorial: "https://help.poe.com/",
    products: [desktopProduct({ id: "poe", name: "Poe", category: "AI 对话", description: "聚合多种模型和用户机器人能力的 Poe Windows 桌面客户端。", website: "https://poe.com/download", home: "https://poe.com/", web: "https://poe.com/", tutorial: "https://help.poe.com/" })]
  }),
  vendor({
    id: "pinokio",
    name: "Pinokio",
    initial: "P",
    color: "#f59e0b",
    description: "开发用于发现和运行本地 AI 应用的开源桌面浏览器。",
    website: "https://pinokio.computer/",
    tutorial: "https://github.com/pinokiocomputer/pinokio",
    products: [desktopProduct({ id: "pinokio-ai-browser", name: "Pinokio", category: "智能体", description: "用于安装和运行本地 AI 应用的桌面浏览器；第三方脚本不继承枕星AI助手 信任。", website: "https://github.com/pinokiocomputer/pinokio/releases/latest", home: "https://pinokio.computer/", tutorial: "https://github.com/pinokiocomputer/pinokio" })]
  }),
  vendor({
    id: "lykos-ai",
    name: "Lykos AI",
    initial: "L",
    color: "#8b5cf6",
    description: "开发本地生成式 AI 包管理桌面工具 Stability Matrix。",
    website: "https://lykos.ai/",
    tutorial: "https://github.com/LykosAI/StabilityMatrix",
    products: [desktopProduct({ id: "stability-matrix", name: "Stability Matrix", category: "图像创作", description: "管理多种本地生成式 AI 包的 Windows 便携桌面工具；下游包不自动进入白名单。", website: "https://github.com/LykosAI/StabilityMatrix/releases/latest", home: "https://lykos.ai/", tutorial: "https://github.com/LykosAI/StabilityMatrix" })]
  }),
  vendor({
    id: "intel",
    name: "Intel",
    initial: "I",
    color: "#0071c5",
    description: "提供面向 Intel 平台的本地生成式 AI 工具和开发能力。",
    website: "https://www.intel.com/",
    tutorial: "https://game.intel.com/stories/introducing-ai-playground/",
    products: [desktopProduct({ id: "intel-ai-playground", name: "AI Playground", category: "本地模型", description: "面向受支持 Intel 硬件的本地生成式 AI Windows 桌面体验。", website: "https://game.intel.com/stories/introducing-ai-playground/", home: "https://game.intel.com/stories/introducing-ai-playground/" })]
  }),
  vendor({
    id: "amd",
    name: "AMD",
    initial: "A",
    color: "#ed1c24",
    description: "提供面向 AMD 平台的本地 AI 与 Agent 工具。",
    website: "https://www.amd.com/",
    tutorial: "https://github.com/amd/gaia",
    products: [desktopProduct({ id: "amd-gaia", name: "GAIA", category: "本地模型", description: "支持本地模型和 Agent UI 的 Windows 11 工具，适配受支持的 AMD 平台。", website: "https://github.com/amd/gaia/releases/latest", home: "https://github.com/amd/gaia", tutorial: "https://github.com/amd/gaia" })]
  }),
  vendor({
    id: "aaif",
    name: "Agentic AI Foundation",
    initial: "A",
    mark: "AAIF",
    color: "#4f46e5",
    description: "维护开放的智能体项目和互操作生态。",
    website: "https://aaif.io/",
    tutorial: "https://github.com/aaif-goose/goose",
    products: [desktopProduct({ id: "goose-desktop", name: "goose Desktop", category: "智能体", description: "支持桌面、CLI 和 API 形态的开源本地智能体，本卡仅提供 Windows 图形客户端。", website: "https://github.com/aaif-goose/goose/releases/latest", home: "https://block.github.io/goose/", tutorial: "https://github.com/aaif-goose/goose" })]
  }),
  vendor({
    id: "thinkinai",
    name: "ThinkInAI",
    initial: "T",
    color: "#2563eb",
    description: "开发支持本地模型、Agent 和 MCP 的开源桌面客户端。",
    website: "https://github.com/ThinkInAIXYZ/deepchat",
    products: [desktopProduct({ id: "deepchat-desktop", name: "DeepChat", category: "AI 对话", description: "支持多模型、Ollama、ACP Agent 和 MCP 的 Windows 桌面客户端。", website: "https://github.com/ThinkInAIXYZ/deepchat/releases/latest", home: "https://github.com/ThinkInAIXYZ/deepchat" })]
  }),
  vendor({
    id: "fiveire",
    name: "5ire",
    initial: "F",
    mark: "5",
    color: "#7c3aed",
    description: "开发支持 MCP、本地知识库和多模型服务的桌面 AI 客户端。",
    website: "https://5ire.app/",
    tutorial: "https://github.com/nanbingxyz/5ire",
    products: [desktopProduct({ id: "fiveire-desktop", name: "5ire", category: "智能体", description: "支持 MCP、多模型和本地知识库的 Windows 桌面 AI 客户端。", website: "https://5ire.app/", home: "https://5ire.app/", tutorial: "https://github.com/nanbingxyz/5ire" })]
  }),
  vendor({
    id: "browseros",
    name: "BrowserOS",
    initial: "B",
    color: "#10b981",
    description: "开发本地优先的开源 AI 原生浏览器和自动化平台。",
    website: "https://browseros.com/",
    tutorial: "https://docs.browseros.com/",
    products: [desktopProduct({ id: "browseros-desktop", name: "BrowserOS", category: "智能体", description: "包含本地 Agent、MCP 和浏览器自动化能力的开源 Windows 浏览器。", website: "https://browseros.com/", home: "https://browseros.com/", tutorial: "https://docs.browseros.com/" })]
  }),
  vendor({
    id: "genspark",
    name: "Genspark",
    initial: "G",
    color: "#16a34a",
    description: "提供桌面 Agent、AI 浏览器和全局语音输入产品。",
    website: "https://www.genspark.ai/",
    tutorial: "https://www.genspark.ai/helpcenter",
    products: [
      desktopProduct({ id: "genspark-claw", name: "Genspark Claw", category: "智能体", description: "提供本地 Chat、Channels、Skills 和 Memory 的 Windows 桌面 Agent。", website: "https://www.genspark.ai/download", home: "https://www.genspark.ai/", tutorial: "https://www.genspark.ai/helpcenter/genspark-claw" }),
      desktopProduct({ id: "genspark-ai-browser", name: "Genspark AI Browser", category: "智能体", description: "包含设备端 AI、Autopilot 与 MCP Store 的 Windows AI 浏览器。", website: "https://www.genspark.ai/browser", home: "https://www.genspark.ai/browser" }),
      desktopProduct({ id: "genspark-speakly", name: "Speakly", category: "音频创作", description: "提供全局 AI 语音输入和 Agent Mode 的 Windows 桌面应用。", website: "https://www.genspark.ai/helpcenter/speakly", home: "https://www.genspark.ai/helpcenter/speakly" })
    ]
  }),
  vendor({
    id: "block",
    name: "Block",
    initial: "B",
    color: "#111111",
    description: "维护开放协作和智能体相关软件项目。",
    website: "https://block.xyz/",
    tutorial: "https://block.github.io/buzz/support.html",
    products: [desktopProduct({ id: "block-buzz", name: "Buzz", category: "智能体", description: "让用户与 AI Agent 在社区和频道协作的开源桌面应用，通信会使用外部 relay。", website: "https://block.github.io/buzz/support.html", home: "https://block.github.io/buzz/", tutorial: "https://block.github.io/buzz/support.html" })]
  }),
  vendor({
    id: "lostruins",
    name: "LostRuins",
    initial: "L",
    color: "#9333ea",
    description: "维护本地模型运行工具 KoboldCpp。",
    website: "https://github.com/LostRuins/koboldcpp",
    products: [desktopProduct({ id: "koboldcpp", name: "KoboldCpp", category: "本地模型", description: "自包含的 Windows 本地模型运行程序，不带参数启动时提供图形界面。", website: "https://github.com/LostRuins/koboldcpp/releases/latest", home: "https://github.com/LostRuins/koboldcpp" })]
  }),
  vendor({
    id: "deepl",
    name: "DeepL",
    initial: "D",
    color: "#0f2b46",
    description: "提供 AI 翻译、写作和语言处理产品。",
    website: "https://www.deepl.com/",
    tutorial: "https://support.deepl.com/",
    products: [desktopProduct({ id: "deepl-desktop", name: "DeepL", category: "智能体", description: "提供翻译与 DeepL Write 的 Windows 桌面应用。", website: "https://www.deepl.com/en/windows-app", home: "https://www.deepl.com/translator", web: "https://www.deepl.com/translator", tutorial: "https://support.deepl.com/hc/en-us/articles/18606772245916-Get-started-with-DeepL-desktop-apps" })]
  }),
  vendor({
    id: "grammarly",
    name: "Grammarly",
    initial: "G",
    color: "#15c39a",
    description: "提供跨应用 AI 写作、改写和生成能力。",
    website: "https://www.grammarly.com/",
    tutorial: "https://support.grammarly.com/",
    products: [desktopProduct({ id: "grammarly-windows", name: "Grammarly", category: "智能体", description: "在 Windows 多种应用中提供写作建议与生成式 AI 的桌面客户端。", website: "https://www.grammarly.com/desktop/windows", home: "https://www.grammarly.com/", web: "https://app.grammarly.com/", tutorial: "https://support.grammarly.com/" })]
  }),
  vendor({
    id: "notion",
    name: "Notion",
    initial: "N",
    color: "#111111",
    description: "提供集成 Notion AI 的知识、文档和协作工作空间。",
    website: "https://www.notion.com/",
    tutorial: "https://www.notion.com/help",
    products: [desktopProduct({ id: "notion-desktop", name: "Notion", category: "智能体", description: "集成 Notion AI 的文档、知识库和协作 Windows 客户端。", website: "https://www.notion.com/desktop", home: "https://www.notion.com/", web: "https://www.notion.so/", tutorial: "https://www.notion.com/en-gb/help/notion-for-desktop" })]
  }),
  vendor({
    id: "descript",
    name: "Descript",
    initial: "D",
    color: "#635bff",
    description: "提供以文字编辑音视频的 AI 创作工具。",
    website: "https://www.descript.com/",
    tutorial: "https://help.descript.com/",
    products: [desktopProduct({ id: "descript-desktop", name: "Descript", category: "视频创作", description: "集成转录、编辑和生成式 AI 的 Windows 音视频编辑器。", website: "https://www.descript.com/download/windows", home: "https://www.descript.com/", tutorial: "https://help.descript.com/hc/en-us/articles/10503599253773-Download-and-install-Descript" })]
  }),
  vendor({
    id: "read-ai",
    name: "Read AI",
    initial: "R",
    mark: "R",
    color: "#2563eb",
    description: "提供会议转录、摘要、行动项和搜索助手。",
    website: "https://www.read.ai/",
    tutorial: "https://support.read.ai/",
    products: [desktopProduct({ id: "read-desktop", name: "Read Desktop", category: "智能体", description: "提供会议转录、摘要、行动项和 Ask Read 的 Windows 桌面应用。", website: "https://www.read.ai/", home: "https://www.read.ai/", tutorial: "https://support.read.ai/hc/en-us/articles/45911611006995-How-to-Use-Read-s-Desktop-App-for-Windows-and-Mac" })]
  }),
  vendor({
    id: "canva",
    name: "Canva",
    initial: "C",
    color: "#7d2ae8",
    description: "提供集成 Magic Studio 的视觉设计与内容创作平台。",
    website: "https://www.canva.com/",
    tutorial: "https://www.canva.com/help/",
    products: [desktopProduct({ id: "canva-windows", name: "Canva for Windows", category: "图像创作", description: "集成 Magic Studio AI 创作能力的 Canva Windows 应用。", website: "https://www.canva.com/en_in/download/windows/", home: "https://www.canva.com/", web: "https://www.canva.com/", tutorial: "https://www.canva.com/en_in/newsroom/news/magic-studio/" })]
  }),
  vendor({
    id: "wondershare",
    name: "Wondershare",
    initial: "W",
    color: "#06b6d4",
    description: "提供集成 AI 的视频、图示、思维导图和 PDF 创作软件。",
    website: "https://www.wondershare.com/",
    tutorial: "https://support.wondershare.com/",
    products: [
      desktopProduct({ id: "wondershare-filmora", name: "Filmora", category: "视频创作", description: "集成多种 AI 辅助能力的 Windows 视频编辑器。", website: "https://filmora.wondershare.com/video-editor/video-editor-download.html", home: "https://filmora.wondershare.com/" }),
      desktopProduct({ id: "wondershare-edrawmax", name: "EdrawMax（万兴图示）", category: "图像创作", description: "支持 AI 一键绘图的 Windows 图示设计软件。", website: "https://edraw.wondershare.cn/download/", home: "https://edraw.wondershare.cn/" }),
      desktopProduct({ id: "wondershare-edrawmind", name: "EdrawMind（万兴脑图）", category: "图像创作", description: "集成 AI 生成功能的 Windows 思维导图软件。", website: "https://edraw.wondershare.cn/download/", home: "https://www.edrawmind.com/" }),
      desktopProduct({ id: "wondershare-pdfelement", name: "PDFelement（万兴 PDF）", category: "智能体", description: "提供 AI 对话、总结、翻译和校对的 Windows PDF 工具。", website: "https://pdf.wondershare.cn/", home: "https://pdf.wondershare.cn/" })
    ]
  }),
  vendor({
    id: "skylum",
    name: "Skylum",
    initial: "S",
    color: "#2563eb",
    description: "开发以 AI 为核心的照片编辑器 Luminar Neo。",
    website: "https://skylum.com/",
    tutorial: "https://support.skylum.com/",
    products: [desktopProduct({ id: "luminar-neo", name: "Luminar Neo", category: "图像创作", description: "面向 Windows 的 AI 照片编辑和增强工具。", website: "https://skylum.com/luminar-download", home: "https://skylum.com/luminar", tutorial: "https://support.skylum.com/getting-started/downloading-and-installing" })]
  }),
  vendor({
    id: "topazlabs",
    name: "Topaz Labs",
    initial: "T",
    mark: "T",
    color: "#111827",
    description: "开发使用本地 AI 模型进行照片、视频增强和放大的桌面软件。",
    website: "https://www.topazlabs.com/",
    tutorial: "https://docs.topazlabs.com/",
    products: [
      desktopProduct({ id: "topaz-photo", name: "Topaz Photo", category: "图像创作", description: "使用本地生成模型增强、降噪和锐化照片的 Windows 应用。", website: "https://www.topazlabs.com/downloads", home: "https://www.topazlabs.com/topaz-photo", tutorial: "https://docs.topazlabs.com/topaz-photo/system-requirements" }),
      desktopProduct({ id: "topaz-video", name: "Topaz Video", category: "视频创作", description: "使用 AI 模型进行视频增强、插帧、稳定和放大的 Windows 应用。", website: "https://www.topazlabs.com/downloads", home: "https://www.topazlabs.com/topaz-video", tutorial: "https://docs.topazlabs.com/topaz-video/quick-start" }),
      desktopProduct({ id: "topaz-gigapixel", name: "Topaz Gigapixel", category: "图像创作", description: "使用 AI 模型放大和恢复图像细节的 Windows 应用。", website: "https://www.topazlabs.com/downloads", home: "https://www.topazlabs.com/gigapixel", tutorial: "https://docs.topazlabs.com/topaz-gigapixel/system-requirements" })
    ]
  }),
  vendor({
    id: "moises",
    name: "Moises",
    initial: "M",
    color: "#7c3aed",
    description: "提供 AI 音轨分离、母带和实时音乐处理产品。",
    website: "https://moises.ai/",
    tutorial: "https://help.moises.ai/",
    products: [
      desktopProduct({ id: "moises-desktop", name: "Moises Desktop", category: "音频创作", description: "提供 AI 分轨、母带和音乐工作流的 Windows 桌面应用。", website: "https://moises.ai/products/moises-desktop-app/", home: "https://moises.ai/products/moises-desktop-app/" }),
      desktopProduct({ id: "moises-live", name: "Moises Live", category: "音频创作", description: "提供 AI Smart Volume 的 Windows 实时音乐处理应用。", website: "https://moises.ai/products/live/", home: "https://moises.ai/products/live/" })
    ]
  }),
  vendor({
    id: "voicemod",
    name: "Voicemod",
    initial: "V",
    color: "#7c3aed",
    description: "提供实时 AI 变声和声音创作工具。",
    website: "https://www.voicemod.net/",
    products: [desktopProduct({ id: "voicemod-windows", name: "Voicemod", category: "音频创作", description: "面向 Windows 10/11 的实时 AI 变声与声音创作客户端。", website: "https://www.voicemod.net/", home: "https://www.voicemod.net/" })]
  }),
  vendor({
    id: "lalalai",
    name: "LALAL.AI",
    initial: "L",
    mark: "L",
    color: "#f97316",
    description: "提供 AI 音轨分离和声音清理服务。",
    website: "https://www.lalal.ai/",
    products: [desktopProduct({ id: "lalalai-desktop", name: "LALAL.AI Desktop", category: "音频创作", description: "面向 Windows 的 AI 分轨与降噪桌面应用。", website: "https://www.lalal.ai/desktop-app/", home: "https://www.lalal.ai/", web: "https://www.lalal.ai/" })]
  }),
  vendor({
    id: "otterai",
    name: "Otter.ai",
    initial: "O",
    mark: "O",
    color: "#2563eb",
    description: "提供会议转录、摘要、AI Chat 和知识检索。",
    website: "https://otter.ai/",
    tutorial: "https://help.otter.ai/",
    products: [desktopProduct({ id: "otter-desktop", name: "Otter", category: "智能体", description: "提供本地录制、会议转录、摘要和 AI Chat 的 Windows 客户端。", website: "https://otter.ai/", home: "https://otter.ai/", web: "https://otter.ai/", tutorial: "https://help.otter.ai/hc/en-us/articles/35973988280215-Otter-Desktop-App-Mac-Windows" })]
  }),
  vendor({
    id: "firefliesai",
    name: "Fireflies.ai",
    initial: "F",
    mark: "F",
    color: "#7c3aed",
    description: "提供会议记录、摘要、AskFred 和 AI Skills。",
    website: "https://fireflies.ai/",
    tutorial: "https://guide.fireflies.ai/",
    products: [desktopProduct({ id: "fireflies-desktop", name: "Fireflies", category: "智能体", description: "提供会议转录、摘要、AskFred 和 AI Skills 的 Windows 客户端。", website: "https://fireflies.ai/desktop", home: "https://fireflies.ai/", web: "https://app.fireflies.ai/", tutorial: "https://guide.fireflies.ai/articles/1208704416-getting-started-with-the-fireflies-desktop-app" })]
  }),
  vendor({
    id: "fathom",
    name: "Fathom",
    initial: "F",
    color: "#2563eb",
    description: "提供 AI 会议记录、摘要和行动项工具。",
    website: "https://fathom.video/",
    tutorial: "https://help.fathom.video/",
    products: [desktopProduct({ id: "fathom-desktop", name: "Fathom", category: "智能体", description: "提供 AI 会议记录、摘要和行动项的 Windows 托盘应用。", website: "https://fathom.video/download/win", home: "https://fathom.video/", web: "https://fathom.video/", tutorial: "https://help.fathom.video/en/articles/449088" })]
  }),
  vendor({
    id: "granola",
    name: "Granola",
    initial: "G",
    color: "#d97706",
    description: "提供 AI 会议笔记和总结工作空间。",
    website: "https://www.granola.ai/",
    tutorial: "https://docs.granola.ai/",
    products: [desktopProduct({ id: "granola-desktop", name: "Granola", category: "智能体", description: "提供会议笔记整理和 AI 总结的 Windows 桌面应用。", website: "https://www.granola.ai/", home: "https://www.granola.ai/", tutorial: "https://docs.granola.ai/help-center/getting-started/managed-installations" })]
  }),
  vendor({
    id: "krisp",
    name: "Krisp",
    initial: "K",
    color: "#5b5bf7",
    description: "提供 AI 会议降噪、转录和助手能力。",
    website: "https://krisp.ai/",
    tutorial: "https://help.krisp.ai/",
    products: [desktopProduct({ id: "krisp-desktop", name: "Krisp", category: "智能体", description: "提供 AI 降噪、会议转录和助手能力的 Windows 客户端；下载需要登录。", website: "https://help.krisp.ai/hc/en-us/articles/4420088642460-Install-Krisp-AI-Meeting-Assistant", home: "https://krisp.ai/", tutorial: "https://help.krisp.ai/hc/en-us/articles/4420088642460-Install-Krisp-AI-Meeting-Assistant" })]
  }),
  vendor({
    id: "wisprflow",
    name: "Wispr Flow",
    initial: "W",
    mark: "W",
    color: "#111827",
    description: "提供跨应用的 AI 语音输入和文字整理。",
    website: "https://wisprflow.ai/",
    tutorial: "https://docs.wisprflow.ai/",
    products: [desktopProduct({ id: "wispr-flow-desktop", name: "Wispr Flow", category: "音频创作", description: "在 Windows 各类应用中提供 AI 语音输入和文字整理。", website: "https://wisprflow.ai/", tutorial: "https://docs.wisprflow.ai/articles/2772472373-what-is-flow" })]
  }),
  vendor({
    id: "qihoo360",
    name: "360",
    initial: "Q",
    mark: "360",
    color: "#16a34a",
    description: "提供 AI 浏览器、办公、个人 Agent 和智能体安全产品。",
    website: "https://www.360.cn/",
    tutorial: "https://www.360.cn/",
    products: [
      desktopProduct({ id: "qihoo360-ai-browser", name: "360 AI 浏览器", category: "智能体", description: "集成 AI 搜索、助手和创作能力的 Windows 浏览器。", website: "https://browser.360.cn/?from=xp", home: "https://browser.360.cn/?from=xp" }),
      desktopProduct({ id: "qihoo360-nami-ai-pc", name: "纳米 AI PC", category: "AI 对话", description: "360 推出的纳米 AI Windows 客户端。", website: "https://www.n.cn/", home: "https://www.n.cn/", tutorial: "https://weishi.360.cn/n/12653.html" }),
      desktopProduct({ id: "qihoo360-ai-office", name: "360 AI 办公", category: "智能体", description: "面向文档和办公任务的 360 AI Windows 客户端。", website: "https://bangong.360.cn/", home: "https://bangong.360.cn/" }),
      desktopProduct({ id: "qihoo360-safe-claw", name: "360 安全龙虾", category: "智能体", description: "360 推出的 Windows 桌面 Agent 产品。", website: "https://claw.360.cn/", home: "https://claw.360.cn/" }),
      desktopProduct({ id: "qihoo360-agent-safe", name: "360 智能体卫士", category: "智能体", description: "面向智能体运行安全的 Windows 客户端。", website: "https://agentsafe.360.cn/", home: "https://agentsafe.360.cn/" })
    ]
  }),
  vendor({
    id: "iflytek",
    name: "科大讯飞",
    initial: "K",
    mark: "讯",
    color: "#2563eb",
    description: "提供星火大模型、语音转写和实时同传产品。",
    website: "https://www.iflytek.com/",
    tutorial: "https://xinghuo.xfyun.cn/",
    products: [
      desktopProduct({ id: "iflytek-sparkdesk", name: "讯飞星火", category: "AI 对话", description: "讯飞星火大模型的 Windows 桌面客户端。", website: "https://xinghuo.xfyun.cn/app/download", home: "https://xinghuo.xfyun.cn/", web: "https://xinghuo.xfyun.cn/" }),
      desktopProduct({ id: "iflytek-listen", name: "讯飞听见", category: "音频创作", description: "提供 AI 语音转写和会议记录的 Windows 助手。", website: "https://www.iflyrec.com/html/iflyrecAssistant.html", home: "https://www.iflyrec.com/" }),
      desktopProduct({ id: "iflytek-simultaneous", name: "讯飞同传", category: "音频创作", description: "提供实时语音识别和翻译的 Windows 同传客户端。", website: "https://tongchuan.iflyrec.com/download.html", home: "https://tongchuan.iflyrec.com/" })
    ]
  }),
  vendor({
    id: "youdao",
    name: "网易有道",
    initial: "W",
    mark: "有",
    color: "#dc2626",
    description: "提供个人 Agent、翻译、写作和智能笔记产品。",
    website: "https://www.youdao.com/",
    tutorial: "https://note.youdao.com/help-center/",
    products: [
      desktopProduct({ id: "youdao-lobsterai", name: "有道龙虾", category: "智能体", description: "支持 Skills 和多场景任务的 Windows 个人 Agent。", website: "https://lobsterai.youdao.com/", home: "https://lobsterai.youdao.com/", tutorial: "https://note.youdao.com/help-center/skill-install-guide-agent.html" }),
      desktopProduct({ id: "youdao-translate", name: "有道翻译", category: "智能体", description: "集成 AI 助手、AI 写作和 PPT 能力的 Windows 翻译客户端。", website: "https://fanyi.youdao.com/download/", home: "https://fanyi.youdao.com/", web: "https://fanyi.youdao.com/" }),
      desktopProduct({ id: "youdao-note", name: "有道云笔记", category: "智能体", description: "集成 AI 工具的 Windows 笔记和知识管理客户端。", website: "https://note.youdao.com/note-download", home: "https://note.youdao.com/", web: "https://note.youdao.com/" })
    ]
  }),
  vendor({
    id: "laiye",
    name: "来也科技",
    initial: "L",
    mark: "来",
    color: "#2563eb",
    description: "提供 AI 员工、RPA 和企业自动化产品。",
    website: "https://laiye.com/",
    products: [desktopProduct({ id: "laiye-worker", name: "Laiye Worker", category: "智能体", description: "可访问本地文件、内网和跨系统执行任务的 Windows AI 员工客户端。", website: "https://laiye.com/product/worker", home: "https://laiye.com/product/worker" })]
  }),
  vendor({
    id: "skywork",
    name: "Skywork",
    initial: "S",
    color: "#2563eb",
    description: "提供可交付文档、演示、表格、网站和代码的桌面 Agent。",
    website: "https://skywork.ai/",
    products: [desktopProduct({ id: "skywork-desktop", name: "Skywork Desktop", category: "智能体", description: "可处理本地工作并交付文档、PPT、表格、网站和代码的 Windows Agent。", website: "https://skywork.ai/desktop/zh/index.html", home: "https://skywork.ai/", web: "https://skywork.ai/" })]
  }),
  vendor({
    id: "monica",
    name: "Monica",
    initial: "M",
    color: "#7c3aed",
    description: "提供跨应用 AI 侧边栏、翻译、总结和截图分析。",
    website: "https://monica.im/",
    tutorial: "https://monica.im/help/",
    products: [desktopProduct({ id: "monica-desktop", name: "Monica", category: "AI 对话", description: "提供跨应用侧边栏、截图分析、翻译和总结的 Windows AI 客户端。", website: "https://monica.im/download", home: "https://monica.im/", web: "https://monica.im/home" })]
  }),
  vendor({
    id: "kingsoft",
    name: "金山办公",
    initial: "J",
    mark: "WPS",
    color: "#dc2626",
    description: "提供集成 WPS AI 的文档、演示、表格和阅读软件。",
    website: "https://www.wps.cn/",
    tutorial: "https://platform.wps.cn/",
    products: [desktopProduct({ id: "wps-office-ai", name: "WPS Office", category: "智能体", description: "集成 AI 文档、PPT、数据和阅读能力的 Windows 办公套件。", website: "https://www.wps.cn/", home: "https://www.wps.cn/", web: "https://www.kdocs.cn/", tutorial: "https://platform.wps.cn/" })]
  }),
  vendor({
    id: "xmind",
    name: "Xmind",
    initial: "X",
    color: "#f59e0b",
    description: "提供集成 Xmind AI 的思维导图和协作产品。",
    website: "https://xmind.cn/",
    tutorial: "https://xmind.cn/guide/",
    products: [desktopProduct({ id: "xmind-ai", name: "Xmind", category: "图像创作", description: "支持 AI 辅助生成和协作的 Windows 思维导图客户端。", website: "https://xmind.cn/download", home: "https://xmind.cn/", web: "https://xmind.ai/" })]
  }),
  vendor({
    id: "meitu",
    name: "美图",
    initial: "M",
    mark: "美",
    color: "#ec4899",
    description: "提供 AI 修图、图像处理和商业摄影工作流产品。",
    website: "https://www.meitu.com/",
    products: [
      desktopProduct({ id: "meitu-pc", name: "美图秀秀", category: "图像创作", description: "提供 AI 修图、改字和图像处理的 Windows 客户端。", website: "https://pc.meitu.com/pc", home: "https://pc.meitu.com/pc" }),
      desktopProduct({ id: "meitu-ultra", name: "美图云修", category: "图像创作", description: "面向商业摄影批量处理的 Windows AI 专业修图客户端。", website: "https://ultra.meitu.com/download", home: "https://ultra.meitu.com/" })
    ]
  }),
  vendor({
    id: "yingdao",
    name: "影刀",
    initial: "Y",
    mark: "影",
    color: "#2563eb",
    description: "提供 RPA、AI 流程生成和桌面自动化工具。",
    website: "https://www.yingdao.com/",
    tutorial: "https://www.yingdao.com/encyclopedia/",
    products: [desktopProduct({ id: "yingdao-rpa", name: "影刀 RPA 6", category: "智能体", description: "可通过对话生成自动化流程的 Windows RPA 客户端。", website: "https://www.yingdao.com/xbot-go-download/", home: "https://www.yingdao.com/", tutorial: "https://www.yingdao.com/encyclopedia/detail?uuid=951354527115943936" })]
  })
]);

const existingProductUpdates = Object.freeze({
  "open-webui": desktopProduct({
    id: "open-webui",
    name: "Open WebUI",
    category: "智能体",
    description: "可本地运行或连接服务器的 Open WebUI Windows Desktop，目前为 Early Alpha。",
    website: "https://github.com/open-webui/desktop/releases/latest",
    home: "https://github.com/open-webui/desktop",
    tutorial: "https://docs.openwebui.com/getting-started/quick-start/"
  }),
  "perplexity-web": desktopProduct({
    id: "perplexity-web",
    name: "Perplexity",
    category: "AI 对话",
    description: "提供 AI 搜索、问答和研究能力的 Perplexity Web 与 Windows 客户端。",
    website: "https://www.perplexity.ai/platforms",
    home: "https://www.perplexity.ai/",
    web: "https://www.perplexity.ai/",
    tutorial: "https://www.perplexity.ai/help-center"
  }),
  jianying: {
    entryPoints: [
      { type: "website", label: "工具官网", url: "https://www.capcut.cn/" },
      { type: "desktop", label: "剪映专业版一键安装" },
      { type: "external", label: "CapCut 全球版", url: "https://www.capcut.com/resource/capcut-for-windows" }
    ]
  }
});

module.exports = {
  existingProductUpdates,
  existingVendorProducts,
  newVendors
};
