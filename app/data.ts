export type HubProduct = {
  name: string;
  type: "桌面端" | "CLI" | "其他产品";
  category:
    | "AI 对话"
    | "编程开发"
    | "图像创作"
    | "视频创作"
    | "智能体"
    | "本地模型";
  description: string;
  platforms: string[];
  website: string;
  requires?: string[];
};

export type HubVendor = {
  slug: string;
  name: string;
  mark: string;
  color: string;
  initial: string;
  category: HubProduct["category"];
  description: string;
  website: string;
  products: HubProduct[];
};

export const vendors: HubVendor[] = [
  {
    slug: "anthropic",
    name: "Anthropic",
    mark: "A",
    color: "#c66d3d",
    initial: "A",
    category: "AI 对话",
    description: "专注于构建可靠、可解释和可控的人工智能系统。",
    website: "https://www.anthropic.com",
    products: [
      {
        name: "Claude Desktop",
        type: "桌面端",
        category: "AI 对话",
        description: "Claude 的桌面客户端。",
        platforms: ["Windows", "macOS"],
        website: "https://claude.ai/download",
      },
      {
        name: "Claude Code",
        type: "CLI",
        category: "编程开发",
        description: "在终端中协助理解、修改和运行代码。",
        platforms: ["CLI"],
        website: "https://claude.ai/code",
        requires: ["Node.js"],
      },
      {
        name: "Claude",
        type: "其他产品",
        category: "AI 对话",
        description: "通过浏览器使用 Claude。",
        platforms: ["Web"],
        website: "https://claude.ai",
      },
    ],
  },
  {
    slug: "bytedance",
    name: "字节跳动",
    mark: "字",
    color: "#111827",
    initial: "B",
    category: "视频创作",
    description: "提供内容创作、视频处理与人工智能产品。",
    website: "https://www.bytedance.com",
    products: [
      {
        name: "剪映专业版",
        type: "桌面端",
        category: "视频创作",
        description: "覆盖剪辑、字幕、配音和智能成片的视频创作工具。",
        platforms: ["Windows", "macOS"],
        website: "https://www.capcut.cn",
      },
      {
        name: "豆包",
        type: "其他产品",
        category: "AI 对话",
        description: "面向日常使用的 AI 助手。",
        platforms: ["Web"],
        website: "https://www.doubao.com",
      },
    ],
  },
  {
    slug: "comfy-org",
    name: "Comfy Org",
    mark: "C",
    color: "#20242b",
    initial: "C",
    category: "图像创作",
    description: "围绕节点式生成工作流开发开源图像工具。",
    website: "https://www.comfy.org",
    products: [
      {
        name: "ComfyUI Desktop",
        type: "桌面端",
        category: "图像创作",
        description: "通过节点连接构建 AI 图像生成工作流。",
        platforms: ["Windows"],
        website: "https://www.comfy.org/download",
        requires: ["显卡驱动", "Python"],
      },
    ],
  },
  {
    slug: "deepseek",
    name: "深度求索",
    mark: "D",
    color: "#4268f6",
    initial: "D",
    category: "AI 对话",
    description: "研发大语言模型及相关人工智能产品。",
    website: "https://www.deepseek.com",
    products: [
      {
        name: "DeepSeek",
        type: "其他产品",
        category: "AI 对话",
        description: "提供推理、写作、翻译和代码能力的在线 AI 助手。",
        platforms: ["Web"],
        website: "https://chat.deepseek.com",
      },
    ],
  },
  {
    slug: "google",
    name: "Google",
    mark: "G",
    color: "#4285f4",
    initial: "G",
    category: "AI 对话",
    description: "提供模型、生产力工具和开发者人工智能服务。",
    website: "https://ai.google",
    products: [
      {
        name: "Gemini",
        type: "其他产品",
        category: "AI 对话",
        description: "Google 的多模态 AI 助手。",
        platforms: ["Web"],
        website: "https://gemini.google.com",
      },
      {
        name: "Gemini CLI",
        type: "CLI",
        category: "编程开发",
        description: "在终端中使用 Gemini。",
        platforms: ["CLI"],
        website: "https://github.com/google-gemini/gemini-cli",
        requires: ["Node.js"],
      },
    ],
  },
  {
    slug: "langgenius",
    name: "LangGenius",
    mark: "L",
    color: "#7055ef",
    initial: "L",
    category: "智能体",
    description: "构建 AI 应用、知识库和自动化工作流。",
    website: "https://dify.ai",
    products: [
      {
        name: "Dify",
        type: "其他产品",
        category: "智能体",
        description: "可视化构建 AI 应用和智能体工作流。",
        platforms: ["Web", "开源"],
        website: "https://dify.ai",
      },
    ],
  },
  {
    slug: "ollama",
    name: "Ollama",
    mark: "O",
    color: "#0d9488",
    initial: "O",
    category: "本地模型",
    description: "帮助用户在自己的电脑上运行和管理开源模型。",
    website: "https://ollama.com",
    products: [
      {
        name: "Ollama",
        type: "CLI",
        category: "本地模型",
        description: "下载、运行和管理本地大语言模型。",
        platforms: ["Windows", "CLI"],
        website: "https://ollama.com/download",
        requires: ["Windows 10 或更高版本"],
      },
    ],
  },
  {
    slug: "openai",
    name: "OpenAI",
    mark: "O",
    color: "#159475",
    initial: "O",
    category: "AI 对话",
    description: "研发并提供通用人工智能模型、产品和开发平台。",
    website: "https://openai.com",
    products: [
      {
        name: "ChatGPT",
        type: "桌面端",
        category: "AI 对话",
        description: "ChatGPT 的桌面客户端。",
        platforms: ["Windows", "macOS"],
        website: "https://chatgpt.com/download",
      },
      {
        name: "Codex CLI",
        type: "CLI",
        category: "编程开发",
        description: "在终端中使用 Codex 完成开发任务。",
        platforms: ["CLI"],
        website: "https://github.com/openai/codex",
        requires: ["Node.js"],
      },
      {
        name: "ChatGPT Web",
        type: "其他产品",
        category: "AI 对话",
        description: "通过浏览器使用 ChatGPT。",
        platforms: ["Web"],
        website: "https://chatgpt.com",
      },
    ],
  },
];

export const vendorCategories = [
  "全部",
  "AI 对话",
  "编程开发",
  "图像创作",
  "视频创作",
  "智能体",
  "本地模型",
];

export function getVendor(slug: string) {
  return vendors.find((vendor) => vendor.slug === slug);
}
