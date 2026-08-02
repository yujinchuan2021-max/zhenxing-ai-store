const adminOrigin = process.env.AIHUB_ADMIN_ORIGIN || "http://127.0.0.1:4173";

const policy = {
  web: {
    kind: "其他产品",
    installPolicy: "open-product-website",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed"
  },
  "desktop-official": {
    kind: "桌面端",
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed"
  },
  tutorial: {
    kind: "其他产品",
    installPolicy: "open-tutorial",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed"
  }
};

function product(input, order) {
  return {
    ...input,
    ...policy[input.productType],
    directoryKind: "ai-tool",
    requirements: [],
    enabled: true,
    order
  };
}

const newVendors = [
  {
    id: "microsoft",
    name: "Microsoft",
    initial: "M",
    mark: "M",
    color: "#2563EB",
    description: "提供面向个人与组织的 AI 助手、开发工具和生产力服务。",
    website: "https://www.microsoft.com/ai",
    tutorial: "https://support.microsoft.com/en-US/microsoft-copilot/getting-started-with-microsoft-copilot",
    products: [
      product({
        id: "microsoft-copilot-desktop", name: "Microsoft Copilot",
        category: "AI 对话", productType: "desktop-official",
        description: "通过 Microsoft 官方入口获取的 Windows AI 助手。",
        website: "https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/get-copilot",
        tutorial: "https://support.microsoft.com/en-US/microsoft-copilot/getting-started-with-microsoft-copilot",
        entryPoints: [
          { type: "website", label: "工具官网", url: "https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/get-copilot" },
          { type: "web", label: "Copilot 网页版", url: "https://copilot.com/" },
          { type: "desktop", label: "Copilot 客户端官方下载" }
        ]
      }, 0)
    ]
  },
  {
    id: "github", name: "GitHub", initial: "G", mark: "G", color: "#24292F",
    description: "提供代码托管、协作和贯穿开发流程的 AI 编程服务。",
    website: "https://github.com/", tutorial: "https://docs.github.com/en/copilot",
    products: [product({
      id: "github-copilot", name: "GitHub Copilot", category: "编程开发",
      productType: "tutorial", description: "面向 IDE、GitHub 和命令行工作流的 AI 编程助手。",
      website: "https://github.com/features/copilot",
      tutorial: "https://docs.github.com/en/copilot/get-started"
    }, 0)]
  },
  {
    id: "anysphere", name: "Anysphere", initial: "A", mark: "A", color: "#111111",
    description: "开发以代码库理解、补全、编辑和智能体协作为核心的 AI 代码编辑器。",
    website: "https://cursor.com/", tutorial: "https://docs.cursor.com/get-started",
    products: [product({
      id: "cursor-desktop", name: "Cursor", category: "编程开发",
      productType: "desktop-official", description: "以 AI 协作为核心的跨平台代码编辑器。",
      website: "https://cursor.com/download",
      tutorial: "https://docs.cursor.com/get-started/installation"
    }, 0)]
  },
  {
    id: "moonshot", name: "月之暗面", initial: "Y", mark: "月", color: "#111827",
    description: "提供长文本、多模态、联网搜索和智能体能力的 Kimi AI 助手。",
    website: "https://www.moonshot.cn/", tutorial: "https://www.kimi.com/zh-cn/help",
    products: [product({
      id: "kimi-web", name: "Kimi", category: "AI 对话", productType: "web",
      description: "支持长文本、搜索、文档和智能体能力的在线 AI 助手。",
      website: "https://www.kimi.com/",
      tutorial: "https://www.kimi.com/zh-cn/help/new-user-guide/overview"
    }, 0)]
  },
  {
    id: "alibaba", name: "阿里巴巴", initial: "A", mark: "阿", color: "#FF6A00",
    description: "通过千问及阿里云模型服务提供个人助手和开发者 AI 能力。",
    website: "https://www.alibabagroup.com/", tutorial: "https://help.aliyun.com/zh/model-studio/",
    products: [product({
      id: "alibaba-qwen-studio", name: "千问", category: "AI 对话", productType: "web",
      description: "阿里巴巴面向个人用户的通用在线 AI 助手。",
      website: "https://www.qianwen.com/", tutorial: "https://www.qianwen.com/",
      entryPoints: [
        { type: "website", label: "工具官网", url: "https://www.qianwen.com/" },
        { type: "web", label: "千问网页版", url: "https://www.qianwen.com/" }
      ]
    }, 0)]
  },
  {
    id: "tencent", name: "腾讯", initial: "T", mark: "腾", color: "#0052D9",
    description: "提供社交、内容、云服务以及面向个人用户的 AI 助手产品。",
    website: "https://www.tencent.com/", tutorial: "https://yuanbao.tencent.com/",
    products: [
      product({
        id: "tencent-yuanbao-desktop", name: "腾讯元宝", category: "AI 对话",
        productType: "desktop-official", description: "由腾讯官方页面提供的元宝桌面客户端入口。",
        website: "https://yuanbao.tencent.com/evt/dl", tutorial: "https://yuanbao.tencent.com/evt/dl",
        entryPoints: [
          { type: "website", label: "工具官网", url: "https://yuanbao.tencent.com/evt/dl" },
          { type: "web", label: "元宝网页版", url: "https://yuanbao.tencent.com/" },
          { type: "desktop", label: "元宝客户端官方下载" }
        ]
      }, 0)
    ]
  },
  {
    id: "zhipu", name: "智谱", initial: "Z", mark: "智", color: "#3B82F6",
    description: "研发大模型并提供对话、内容生成、智能体和开发平台。",
    website: "https://www.zhipuai.cn/", tutorial: "https://chatglm.cn/",
    products: [product({
      id: "zhipu-qingyan-web", name: "智谱清言", category: "AI 对话",
      productType: "web", description: "覆盖对话、创作、阅读和智能体的在线 AI 助手。",
      website: "https://chatglm.cn/", tutorial: "https://chatglm.cn/"
    }, 0)]
  },
  {
    id: "midjourney", name: "Midjourney", initial: "M", mark: "M", color: "#111827",
    description: "提供由文本和图像驱动的在线视觉创作与编辑工具。",
    website: "https://www.midjourney.com/", tutorial: "https://docs.midjourney.com/hc/en-us",
    products: [product({
      id: "midjourney-web", name: "Midjourney", category: "图像创作",
      productType: "web", description: "用于生成、修改和管理视觉作品的在线创作工具。",
      website: "https://www.midjourney.com/",
      tutorial: "https://docs.midjourney.com/hc/en-us/articles/33329261836941-Getting-Started-Guide"
    }, 0)]
  },
  {
    id: "runway", name: "Runway", initial: "R", mark: "R", color: "#6C5CE7",
    description: "提供生成式视频、视觉编辑、创意智能体和工作流工具。",
    website: "https://runwayml.com/", tutorial: "https://help.runwayml.com/hc/en-us",
    products: [product({
      id: "runway-web", name: "Runway", category: "视频创作",
      productType: "web", description: "面向生成式视频和视觉编辑的 Web 创作平台。",
      website: "https://app.runwayml.com/",
      tutorial: "https://help.runwayml.com/hc/en-us/articles/37425232841875-Getting-Started-with-Generative-Video"
    }, 0)]
  },
  {
    id: "elevenlabs", name: "ElevenLabs", initial: "E", mark: "E", color: "#111111",
    description: "提供文本转语音、配音、声音设计和生成式音频工具。",
    website: "https://elevenlabs.io/", tutorial: "https://elevenlabs.io/docs/overview",
    products: [product({
      id: "elevenlabs-web", name: "ElevenLabs", category: "音频创作",
      productType: "web", description: "提供语音生成、配音和声音设计的在线工具。",
      website: "https://elevenlabs.io/ai-voice-generator",
      tutorial: "https://help.elevenlabs.io/hc/en-us"
    }, 0)]
  },
  {
    id: "suno", name: "Suno", initial: "S", mark: "S", color: "#8B5CF6",
    description: "提供通过文本、歌词或音频素材创作歌曲和音乐的在线工具。",
    website: "https://suno.com/", tutorial: "https://help.suno.com/en/",
    products: [product({
      id: "suno-web", name: "Suno", category: "音频创作", productType: "web",
      description: "通过文本描述、歌词或音频素材创作歌曲的在线工具。",
      website: "https://suno.com/create", tutorial: "https://help.suno.com/en/articles/2462273"
    }, 0)]
  },
  {
    id: "lmstudio", name: "LM Studio", initial: "L", mark: "L", color: "#16A34A",
    description: "提供在个人电脑上发现、下载、运行和调用开放模型的桌面工具。",
    website: "https://lmstudio.ai/", tutorial: "https://lmstudio.ai/docs/app",
    products: [product({
      id: "lm-studio-desktop", name: "LM Studio", category: "本地模型",
      productType: "desktop-official", description: "在个人电脑上发现、下载和运行开放模型的桌面工具。",
      website: "https://lmstudio.ai/download",
      tutorial: "https://lmstudio.ai/docs/app/basics/download-model"
    }, 0)]
  },
  {
    id: "nomic", name: "Nomic AI", initial: "N", mark: "N", color: "#D97706",
    description: "开发本地优先的模型运行、私有对话和文档检索工具。",
    website: "https://www.nomic.ai/", tutorial: "https://docs.gpt4all.io/",
    products: [product({
      id: "gpt4all-desktop", name: "GPT4All Desktop", category: "本地模型",
      productType: "desktop-official", description: "在普通桌面设备上本地下载并运行语言模型。",
      website: "https://gpt4all.io/",
      tutorial: "https://docs.gpt4all.io/gpt4all_desktop/quickstart.html"
    }, 0)]
  },
  {
    id: "mintplex", name: "Mintplex Labs", initial: "M", mark: "M", color: "#16A085",
    description: "开发支持本地模型、RAG、知识库和智能体的 AnythingLLM。",
    website: "https://anythingllm.com/", tutorial: "https://docs.anythingllm.com/",
    products: [product({
      id: "anythingllm-desktop", name: "AnythingLLM Desktop", category: "智能体",
      productType: "desktop-official", description: "支持本地模型、知识库、RAG 和智能体的桌面工具。",
      website: "https://anythingllm.com/desktop",
      tutorial: "https://docs.anythingllm.com/installation-desktop/windows"
    }, 0)]
  }
];

const bytedanceProducts = [
  product({
    id: "trae-desktop", name: "TRAE", category: "编程开发",
    productType: "desktop-official", description: "字节跳动旗下的 AI 原生代码编辑器。",
    website: "https://www.trae.ai/download", tutorial: "https://www.trae.ai/"
  }, 2),
  product({
    id: "jimeng-web", name: "即梦 AI", category: "图像创作",
    productType: "web", description: "面向图像与视频生成的在线 AI 创作工具。",
    website: "https://jimeng.jianying.com/", tutorial: "https://jimeng.jianying.com/"
  }, 3),
  product({
    id: "coze-web", name: "扣子", category: "智能体",
    productType: "web", description: "面向个人和团队的智能体与自动化开发平台。",
    website: "https://www.coze.cn/", tutorial: "https://www.coze.cn/"
  }, 4)
];

async function request(pathname, options = {}) {
  const response = await fetch(`${adminOrigin}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-AIHub-Admin": "1",
      Origin: adminOrigin,
      ...options.headers
    }
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `${response.status}`);
  return value;
}

const current = await request("/api/catalog");
const catalog = structuredClone(current.catalog);
const bytedance = catalog.vendors.find((vendor) => vendor.id === "bytedance");
if (!bytedance) throw new Error("现有目录缺少 bytedance 厂商");

for (const candidate of bytedanceProducts) {
  if (!bytedance.products.some((item) => item.id === candidate.id)) {
    bytedance.products.push(candidate);
  }
}

for (const candidate of newVendors) {
  if (!catalog.vendors.some((vendor) => vendor.id === candidate.id)) {
    catalog.vendors.push({
      ...candidate,
      iconUrl: "",
      enabled: true,
      order: catalog.vendors.length
    });
  }
}
catalog.updatedAt = new Date().toISOString();

const saved = await request("/api/catalog", {
  method: "PUT",
  body: JSON.stringify({
    catalog,
    expectedRevision: current.revision
  })
});
const validation = await request("/api/validate", {
  method: "POST",
  body: "{}"
});
const published = await request("/api/publish", {
  method: "POST",
  body: JSON.stringify({
    expectedDraftRevision: saved.revision,
    expectedActiveCatalogVersion: current.activeCatalogVersion
  })
});

console.log(JSON.stringify({
  vendors: catalog.vendors.length,
  products: catalog.vendors.reduce((sum, vendor) => sum + vendor.products.length, 0),
  validation,
  published
}, null, 2));
