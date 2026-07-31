export type ProductKind = "桌面端" | "CLI" | "其他产品";
export type ProductType =
  | "web"
  | "desktop-official"
  | "desktop-reviewed"
  | "cli-official"
  | "cli"
  | "local-model"
  | "tutorial";
export type InstallPolicy =
  | "open-product-website"
  | "open-official-download"
  | "open-official-install"
  | "client-managed-installer"
  | "client-managed-cli"
  | "open-tutorial";
export type DownloadPolicy = "none" | "official-page" | "client-managed";
export type SignaturePolicy =
  | "not-applicable"
  | "vendor-controlled"
  | "client-reviewed";
export type UninstallPolicy =
  | "not-managed"
  | "vendor-managed"
  | "client-managed";
export type ProductCategory = string;
export type ProductCapability =
  | "website"
  | "tutorial"
  | "install"
  | "open"
  | "uninstall";

export type ProductExtension = {
  id: string;
  enabled?: boolean;
  order?: number;
  name: string;
  extensionType: "skill" | "mcp";
  description: string;
  website: string;
  tutorial: string;
  moduleId: "skill-link" | "mcp-link" | "skill-managed" | "mcp-managed";
  installProfileId: string;
  capabilities: Array<"website" | "install" | "uninstall">;
  publisher?: string;
  sourceKind?: "official" | "reviewed-community" | "community";
  versionRef?: string;
  requestedPermissions?: string[];
  credentialRequirements?: string[];
  installScope?: string;
  uninstallPlan?: string;
  provenanceEvidence?: string[];
  lastVerifiedAt?: string;
};

export type Product = {
  id: string;
  enabled?: boolean;
  order?: number;
  name: string;
  kind: ProductKind;
  category: ProductCategory;
  description: string;
  website: string;
  tutorial: string;
  productType: ProductType;
  moduleId?: string;
  installProfileId?: string;
  requirements: string[];
  installPolicy: InstallPolicy;
  downloadPolicy: DownloadPolicy;
  signaturePolicy: SignaturePolicy;
  uninstallPolicy: UninstallPolicy;
  capabilities?: ProductCapability[];
  componentProductIds?: string[];
  extensions?: ProductExtension[];
  download?: {
    url: string;
    fileName: string;
  };
};

export type Vendor = {
  id: string;
  enabled?: boolean;
  order?: number;
  iconUrl?: string;
  name: string;
  initial: string;
  mark: string;
  color: string;
  description: string;
  website: string;
  tutorial: string;
  products: Product[];
};

export const vendors: Vendor[] = [
  {
    id: "openai",
    name: "OpenAI",
    initial: "O",
    mark: "O",
    color: "#159475",
    description: "提供 AI 对话、桌面客户端与编程开发工具。",
    website: "https://openai.com",
    tutorial: "https://help.openai.com",
    products: [
      {
        id: "chatgpt-desktop",
        name: "ChatGPT Desktop",
        kind: "桌面端",
        category: "AI 对话",
        description: "通过 Microsoft Store 官方安装引导器获取的 ChatGPT Windows 客户端，包含 Codex 桌面模式。",
        website: "https://chatgpt.com/download",
        tutorial: "https://help.openai.com/en/collections/3742473-chatgpt",
        productType: "desktop-reviewed",
        requirements: [],
        installPolicy: "client-managed-installer",
        downloadPolicy: "client-managed",
        signaturePolicy: "client-reviewed",
        uninstallPolicy: "client-managed",
        download: {
          url: "https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi",
          fileName: "ChatGPT Installer.exe"
        }
      },
      {
        id: "codex-cli",
        name: "Codex CLI",
        kind: "CLI",
        category: "编程开发",
        description: "在终端中运行的编程智能体。",
        website: "https://github.com/openai/codex",
        tutorial: "https://github.com/openai/codex",
        productType: "cli",
        requirements: ["node"],
        installPolicy: "client-managed-cli",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "client-managed"
      },
      {
        id: "chatgpt-web",
        name: "ChatGPT Web",
        kind: "其他产品",
        category: "AI 对话",
        description: "通过浏览器使用 ChatGPT。",
        website: "https://chatgpt.com",
        tutorial: "https://help.openai.com/en/collections/3742473-chatgpt",
        productType: "web",
        requirements: [],
        installPolicy: "open-product-website",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "not-managed"
      }
    ]
  },
  {
    id: "anthropic",
    name: "Anthropic",
    initial: "A",
    mark: "A",
    color: "#c66d3d",
    description: "构建可靠、可解释和可控的人工智能系统。",
    website: "https://www.anthropic.com",
    tutorial: "https://support.anthropic.com",
    products: [
      {
        id: "claude-desktop",
        name: "Claude Desktop",
        kind: "桌面端",
        category: "AI 对话",
        description: "面向个人用户的 Claude Windows 桌面客户端，包含 Claude Code 和 Cowork 桌面能力。",
        website: "https://claude.com/download",
        tutorial: "https://support.claude.com/en/collections/16163169-claude-desktop",
        productType: "desktop-reviewed",
        requirements: [],
        installPolicy: "client-managed-installer",
        downloadPolicy: "client-managed",
        signaturePolicy: "client-reviewed",
        uninstallPolicy: "client-managed",
        download: {
          url: "https://claude.ai/api/desktop/win32/x64/exe/latest/redirect",
          fileName: "Claude-Setup-x64.exe"
        }
      },
      {
        id: "claude-code",
        name: "Claude Code",
        kind: "CLI",
        category: "编程开发",
        description: "在终端中协助理解、修改和运行代码。",
        website: "https://docs.anthropic.com/en/docs/claude-code/getting-started",
        tutorial: "https://docs.anthropic.com/en/docs/claude-code/getting-started",
        productType: "cli",
        requirements: ["node", "git"],
        installPolicy: "client-managed-cli",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "client-managed"
      },
      {
        id: "claude-web",
        name: "Claude",
        kind: "其他产品",
        category: "AI 对话",
        description: "通过浏览器使用 Claude。",
        website: "https://claude.ai",
        tutorial: "https://support.claude.com",
        productType: "web",
        requirements: [],
        installPolicy: "open-product-website",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "not-managed"
      }
    ]
  },
  {
    id: "bytedance",
    name: "字节跳动",
    initial: "B",
    mark: "字",
    color: "#111827",
    description: "提供内容创作、视频处理与人工智能产品。",
    website: "https://www.bytedance.com",
    tutorial: "https://www.capcut.cn/learning",
    products: [
      {
        id: "jianying",
        name: "剪映专业版",
        kind: "桌面端",
        category: "视频创作",
        description: "覆盖剪辑、字幕、配音和智能成片的视频工具。",
        website: "https://www.capcut.cn",
        tutorial: "https://www.capcut.cn/learning",
        productType: "desktop-official",
        requirements: [],
        installPolicy: "open-official-download",
        downloadPolicy: "official-page",
        signaturePolicy: "vendor-controlled",
        uninstallPolicy: "vendor-managed"
      },
      {
        id: "doubao",
        name: "豆包",
        kind: "其他产品",
        category: "AI 对话",
        description: "面向日常使用的 AI 助手。",
        website: "https://www.doubao.com",
        tutorial: "https://www.doubao.com",
        productType: "web",
        requirements: [],
        installPolicy: "open-product-website",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "not-managed"
      }
    ]
  },
  {
    id: "comfy",
    name: "Comfy Org",
    initial: "C",
    mark: "C",
    color: "#20242b",
    description: "围绕节点式生成工作流开发开源图像工具。",
    website: "https://www.comfy.org",
    tutorial: "https://docs.comfy.org",
    products: [
      {
        id: "comfy-desktop",
        name: "Comfy Desktop",
        kind: "桌面端",
        category: "图像创作",
          description: "Comfy 官方桌面启动器，用于管理本地 ComfyUI 实例与工作流。",
          website: "https://www.comfy.org/download",
          tutorial: "https://docs.comfy.org",
          productType: "desktop-reviewed",
          requirements: ["python"],
          installPolicy: "client-managed-installer",
          downloadPolicy: "client-managed",
          signaturePolicy: "client-reviewed",
          uninstallPolicy: "client-managed",
          download: {
            url: "https://download.comfy.org/windows/nsis/x64",
            fileName: "Comfy-Desktop-Setup-x64.exe"
          }
        }
    ]
  },
  {
    id: "deepseek",
    name: "深度求索",
    initial: "D",
    mark: "D",
    color: "#4268f6",
    description: "研发大语言模型及相关人工智能产品。",
    website: "https://www.deepseek.com",
    tutorial: "https://api-docs.deepseek.com",
    products: [
      {
        id: "deepseek-web",
        name: "DeepSeek",
        kind: "其他产品",
        category: "AI 对话",
        description: "提供推理、写作、翻译和代码能力的在线助手。",
        website: "https://chat.deepseek.com",
        tutorial: "https://api-docs.deepseek.com",
        productType: "web",
        requirements: [],
        installPolicy: "open-product-website",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "not-managed"
      }
    ]
  },
  {
    id: "google",
    name: "Google",
    initial: "G",
    mark: "G",
    color: "#4285f4",
    description: "提供模型、生产力工具和开发者人工智能服务。",
    website: "https://ai.google",
    tutorial: "https://ai.google.dev",
    products: [
      {
        id: "gemini-web",
        name: "Gemini",
        kind: "其他产品",
        category: "AI 对话",
        description: "Google 的多模态 AI 助手。",
        website: "https://gemini.google.com",
        tutorial: "https://support.google.com/gemini",
        productType: "web",
        requirements: [],
        installPolicy: "open-product-website",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "not-managed"
      },
      {
        id: "gemini-cli",
        name: "Gemini CLI",
        kind: "CLI",
        category: "编程开发",
        description: "在终端中使用 Gemini。",
        website: "https://github.com/google-gemini/gemini-cli",
        tutorial: "https://github.com/google-gemini/gemini-cli",
        productType: "cli",
        requirements: ["node"],
        installPolicy: "client-managed-cli",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "client-managed"
      }
    ]
  },
  {
    id: "dify",
    name: "LangGenius",
    initial: "L",
    mark: "L",
    color: "#7055ef",
    description: "构建 AI 应用、知识库和自动化工作流。",
    website: "https://dify.ai",
    tutorial: "https://docs.dify.ai",
    products: [
      {
        id: "dify-web",
        name: "Dify",
        kind: "其他产品",
        category: "智能体",
        description: "可视化构建 AI 应用和智能体工作流。",
        website: "https://dify.ai",
        tutorial: "https://docs.dify.ai",
        productType: "web",
        requirements: [],
        installPolicy: "open-product-website",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "not-managed"
      }
    ]
  },
  {
    id: "ollama",
    name: "Ollama",
    initial: "O",
    mark: "O",
    color: "#0d9488",
    description: "帮助用户在自己的电脑上运行和管理开源模型。",
    website: "https://ollama.com",
    tutorial: "https://docs.ollama.com",
    products: [
      {
        id: "ollama-cli",
        name: "Ollama",
        kind: "桌面端",
        category: "本地模型",
        description: "下载、运行和管理本地大语言模型。",
        website: "https://ollama.com/download/windows",
        tutorial: "https://docs.ollama.com",
        productType: "local-model",
        requirements: [],
        installPolicy: "client-managed-installer",
        downloadPolicy: "client-managed",
        signaturePolicy: "client-reviewed",
        uninstallPolicy: "client-managed",
        download: {
          url: "https://ollama.com/download/OllamaSetup.exe",
          fileName: "OllamaSetup.exe"
        }
      }
    ]
  }
];
