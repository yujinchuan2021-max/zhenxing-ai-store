# AI Hub 厂商资源扩充候选清单

核验日期：2026-07-30

> 历史候选说明：本清单早于 catalog schema v2。当前厂商只保存一份，产品以 `directoryKind` 进入“全部 AI 厂商”或“全部 AI 可接入厂商”，Skill/MCP/插件进入独立资源商店；表中的产品类型和接入建议仅作为当时研究快照。

## 结论与使用边界

本清单只使用厂商官网、官方产品页、官方帮助中心或官方文档作为依据。候选项尚未写入产品目录，需经过产品确认后再由后台发布。

- 图形化桌面软件一律使用 `desktop-official`：客户端只打开厂商官方下载页，不托管、不解析、不代为运行安装包。
- Web 产品使用 `web`：客户端直接打开产品网站。
- IDE 扩展或暂未纳入本地白名单的 CLI 使用 `tutorial`：只打开官方安装文档。
- 清单不采用搜索结果中的第三方“下载站”、镜像站或无法确认归属的直链。
- `requirements` 为客户端展示提示，不代表 AI Hub 对第三方产品兼容性的保证。
- 颜色为 AI Hub 的界面建议色，并非厂商商标色声明。

## 第一批：建议直接纳入

这一批覆盖国内外主流对话、编程、图像、视频、音频、智能体和本地模型工具，且官方入口和教程相对稳定。

| vendorId | 厂商名 | 首字母 | 颜色建议 | 官方简介（原创） | 官网 | 教程 | productId | name | category | productType | website | tutorial | requirements | 纳入理由 |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|---|
| `microsoft` | Microsoft | M | `#2563EB` | 提供面向个人与组织的 AI 助手、开发工具和生产力服务。 | [Microsoft AI](https://www.microsoft.com/ai) | [Copilot 入门](https://support.microsoft.com/en-US/microsoft-copilot/getting-started-with-microsoft-copilot) | `microsoft-copilot-web` | Microsoft Copilot | AI 对话 | `web` | [Copilot](https://copilot.com/) | [官方入门](https://support.microsoft.com/en-US/microsoft-copilot/getting-started-with-microsoft-copilot) | `[]` | 补足 Windows 用户最常见的系统级 AI 助手。官方说明明确支持浏览器访问。 |
| `microsoft` | Microsoft | M | `#2563EB` | 提供面向个人与组织的 AI 助手、开发工具和生产力服务。 | [Microsoft AI](https://www.microsoft.com/ai) | [Copilot 入门](https://support.microsoft.com/en-US/microsoft-copilot/getting-started-with-microsoft-copilot) | `microsoft-copilot-desktop` | Microsoft Copilot for Windows | AI 对话 | `desktop-official` | [官方产品与获取入口](https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/get-copilot) | [官方安装说明](https://support.microsoft.com/en-US/microsoft-copilot/getting-started-with-microsoft-copilot) | `["Windows","桌面端登录需个人 Microsoft 账号"]` | 官方支持页确认 Windows 应用通过 Microsoft Store 获取，适合只打开官方入口。 |
| `github` | GitHub | G | `#24292F` | 提供代码托管、协作和贯穿开发流程的 AI 编程服务。 | [GitHub](https://github.com/) | [GitHub Copilot 文档](https://docs.github.com/en/copilot) | `github-copilot` | GitHub Copilot | 编程开发 | `tutorial` | [Copilot 产品页](https://github.com/features/copilot) | [官方入门](https://docs.github.com/en/copilot/get-started) | `["受支持的 IDE、GitHub 或 CLI 环境","GitHub 账号"]` | 覆盖 IDE、GitHub、CLI 与智能体开发场景；具体安装入口随使用载体变化，因此只引导官方教程。 |
| `anysphere` | Anysphere | A | `#111111` | 开发以代码库理解、补全、编辑和智能体协作为核心的 AI 代码编辑器。 | [Cursor](https://cursor.com/) | [Cursor 文档](https://docs.cursor.com/get-started) | `cursor-desktop` | Cursor | 编程开发 | `desktop-official` | [官方下载](https://cursor.com/download) | [官方安装教程](https://docs.cursor.com/get-started/installation) | `["Windows 10/11","x64 或 ARM64"]` | 主流独立 AI 编辑器；官方下载页明确提供 Windows x64 和 ARM64 版本。 |
| `moonshot` | 月之暗面 | M | `#111827` | 提供长文本、多模态、联网搜索和智能体能力的 Kimi AI 助手。 | [Moonshot AI](https://www.moonshot.cn/) | [Kimi 帮助中心](https://www.kimi.com/zh-cn/help) | `kimi-web` | Kimi | AI 对话 | `web` | [Kimi](https://www.kimi.com/) | [Kimi 新手入门](https://www.kimi.com/zh-cn/help/new-user-guide/overview) | `[]` | 国内高频对话与智能体产品；官方帮助中心明确提供网页版、Agent、文档、PPT 和编程等能力。 |
| `alibaba` | 阿里巴巴 | A | `#FF6A00` | 通过千问及阿里云模型服务提供个人助手和开发者 AI 能力。 | [阿里巴巴](https://www.alibabagroup.com/) | [阿里云百炼文档](https://help.aliyun.com/zh/model-studio/) | `qianwen-web` | 千问 | AI 对话 | `web` | [千问](https://www.qianwen.com/) | [千问官方产品页](https://www.qianwen.com/) | `[]` | 补充国内主流通用 AI 助手；使用官方 Web 入口，不推测桌面下载地址。 |
| `tencent` | 腾讯 | T | `#0052D9` | 提供社交、内容、云服务以及面向个人用户的 AI 助手产品。 | [腾讯](https://www.tencent.com/) | [腾讯元宝](https://yuanbao.tencent.com/) | `tencent-yuanbao-web` | 腾讯元宝 | AI 对话 | `web` | [腾讯元宝](https://yuanbao.tencent.com/) | [腾讯元宝官方页](https://yuanbao.tencent.com/) | `[]` | 国内主流 AI 助手，覆盖问答、文档阅读和创作等场景。 |
| `tencent` | 腾讯 | T | `#0052D9` | 提供社交、内容、云服务以及面向个人用户的 AI 助手产品。 | [腾讯](https://www.tencent.com/) | [腾讯元宝](https://yuanbao.tencent.com/) | `tencent-yuanbao-desktop` | 腾讯元宝电脑版 | AI 对话 | `desktop-official` | [官方电脑版页面](https://yuanbao.tencent.com/evt/dl) | [官方电脑版页面](https://yuanbao.tencent.com/evt/dl) | `["Windows（最低版本以厂商页面为准）"]` | 官方页面明确展示 Windows 快捷唤起和电脑版入口；只打开官方页面。 |
| `zhipu` | 智谱 | Z | `#3B82F6` | 研发大模型并提供对话、内容生成、智能体和开发平台。 | [智谱 AI](https://www.zhipuai.cn/) | [智谱清言](https://chatglm.cn/) | `zhipu-qingyan-web` | 智谱清言 | AI 对话 | `web` | [智谱清言](https://chatglm.cn/) | [官方产品页](https://chatglm.cn/) | `[]` | 国内主流通用 AI 助手；官方页面同时呈现对话、画图、阅读、视频和智能体入口。 |
| `midjourney` | Midjourney | M | `#111827` | 提供由文本和图像驱动的在线视觉创作与编辑工具。 | [Midjourney](https://www.midjourney.com/) | [Midjourney 文档](https://docs.midjourney.com/hc/en-us) | `midjourney-web` | Midjourney | 图像创作 | `web` | [Midjourney](https://www.midjourney.com/) | [官方入门指南](https://docs.midjourney.com/hc/en-us/articles/33329261836941-Getting-Started-Guide) | `[]` | 国际主流 AI 图像产品；官方指南明确通过网站 Create 页面生成、修改和管理作品。 |
| `runway` | Runway | R | `#6C5CE7` | 提供生成式视频、视觉编辑、创意智能体和工作流工具。 | [Runway](https://runwayml.com/) | [Runway 帮助中心](https://help.runwayml.com/hc/en-us) | `runway-web` | Runway | 视频创作 | `web` | [Runway 应用](https://app.runwayml.com/) | [生成式视频入门](https://help.runwayml.com/hc/en-us/articles/37425232841875-Getting-Started-with-Generative-Video) | `["建议使用 Chrome 浏览器"]` | 国际主流生成式视频工具；官方指南明确以 Web 应用作为主要入口。 |
| `elevenlabs` | ElevenLabs | E | `#111111` | 提供文本转语音、配音、声音设计和生成式音频工具。 | [ElevenLabs](https://elevenlabs.io/) | [ElevenLabs 文档](https://elevenlabs.io/docs/overview) | `elevenlabs-web` | ElevenLabs | 音频创作 | `web` | [AI Voice Generator](https://elevenlabs.io/ai-voice-generator) | [官方帮助中心](https://help.elevenlabs.io/hc/en-us) | `[]` | 补齐专业语音生成与配音类别；PC 端主要使用 Web 产品。 |
| `suno` | Suno | S | `#8B5CF6` | 提供通过文本、歌词或音频素材创作歌曲和音乐的在线工具。 | [Suno](https://suno.com/) | [Suno 帮助中心](https://help.suno.com/en/) | `suno-web` | Suno | 音频创作 | `web` | [Suno Create](https://suno.com/create) | [简单模式创作歌曲](https://help.suno.com/en/articles/2462273) | `[]` | 补齐 AI 音乐生成；官方教程明确可在网页 Create 页面通过文本描述生成歌曲。 |
| `lmstudio` | LM Studio | L | `#16A34A` | 提供在个人电脑上发现、下载、运行和调用开放模型的桌面工具。 | [LM Studio](https://lmstudio.ai/) | [LM Studio 文档](https://lmstudio.ai/docs/app) | `lm-studio-desktop` | LM Studio | 本地模型 | `desktop-official` | [官方下载](https://lmstudio.ai/download) | [模型下载教程](https://lmstudio.ai/docs/app/basics/download-model) | `["Windows x64 或 ARM","x64 需要 AVX2","建议 16GB RAM","建议 4GB 独立显存"]` | 本地主流模型运行工具；官方文档明确 Windows 架构和硬件建议。 |
| `nomic` | Nomic AI | N | `#D97706` | 开发本地优先的模型运行、私有对话和文档检索工具。 | [Nomic AI](https://www.nomic.ai/) | [GPT4All 文档](https://docs.gpt4all.io/) | `gpt4all-desktop` | GPT4All Desktop | 本地模型 | `desktop-official` | [GPT4All](https://gpt4all.io/) | [官方快速入门](https://docs.gpt4all.io/gpt4all_desktop/quickstart.html) | `["Windows（具体硬件要求以厂商下载页为准）","本地模型需要额外磁盘空间"]` | 官方文档确认可在普通桌面设备上本地下载和运行 LLM，并提供 Windows 下载入口。 |
| `mintplex` | Mintplex Labs | M | `#16A085` | 开发支持本地模型、RAG、知识库和智能体的 AnythingLLM。 | [AnythingLLM](https://anythingllm.com/) | [AnythingLLM 文档](https://docs.anythingllm.com/) | `anythingllm-desktop` | AnythingLLM Desktop | 智能体 | `desktop-official` | [官方桌面版](https://anythingllm.com/desktop) | [Windows 安装教程](https://docs.anythingllm.com/installation-desktop/windows) | `["Windows 10+ Home 或 Professional","x86-64 或 ARM64","建议为当前用户安装"]` | 同时覆盖本地知识库、RAG 和 Agent；官方文档提供明确的 Windows 安装与卸载指导。 |

## 第二批：现有厂商下补充产品

这些产品不增加新的厂商层级，直接归入现有的 `bytedance` 厂商。这样保持“厂商为第一层”的产品结构。

| vendorId | 厂商名 | 首字母 | 颜色建议 | 官方简介（原创） | 官网 | 教程 | productId | name | category | productType | website | tutorial | requirements | 纳入理由 |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|---|
| `bytedance` | 字节跳动 | B | `#111827` | 提供内容创作、视频处理、AI 助手、编程和智能体产品。 | [字节跳动](https://www.bytedance.com/) | [产品对应官方页](https://www.bytedance.com/zh/products) | `trae-desktop` | TRAE | 编程开发 | `desktop-official` | [TRAE 官方下载](https://www.trae.ai/download) | [TRAE 官方站](https://www.trae.ai/) | `["Windows（最低版本以厂商下载页为准）"]` | 补充国产 AI IDE；只打开官方产品下载页。 |
| `bytedance` | 字节跳动 | B | `#111827` | 提供内容创作、视频处理、AI 助手、编程和智能体产品。 | [字节跳动](https://www.bytedance.com/) | [产品对应官方页](https://www.bytedance.com/zh/products) | `jimeng-web` | 即梦 AI | 图像创作 | `web` | [即梦 AI](https://jimeng.jianying.com/) | [即梦 AI 官方页](https://jimeng.jianying.com/) | `[]` | 补充国内图像、视频生成入口；使用剪映官方域名，排除第三方下载站。 |
| `bytedance` | 字节跳动 | B | `#111827` | 提供内容创作、视频处理、AI 助手、编程和智能体产品。 | [字节跳动](https://www.bytedance.com/) | [产品对应官方页](https://www.bytedance.com/zh/products) | `coze-web` | 扣子 | 智能体 | `web` | [扣子](https://www.coze.cn/) | [扣子官方页](https://www.coze.cn/) | `[]` | 补充面向普通用户和团队的智能体与自动化入口。 |

## 待人工确认批次

这两项品牌价值较高，但官方站点对自动化访问有限制，或教程入口稳定性不如第一批。建议产品负责人用普通浏览器确认页面可访问性后再纳入。

| vendorId | 厂商名 | 首字母 | 颜色建议 | 官方简介（原创） | 官网 | 教程 | productId | name | category | productType | website | tutorial | requirements | 纳入理由 |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|---|
| `kuaishou` | 快手 | K | `#FF4906` | 提供内容平台和面向图像、视频生成的可灵 AI 服务。 | [快手](https://www.kuaishou.com/) | [可灵 AI 官方站](https://klingai.kuaishou.com/) | `kling-web` | 可灵 AI | 视频创作 | `web` | [可灵 AI](https://klingai.kuaishou.com/) | [可灵 AI 官方站](https://klingai.kuaishou.com/) | `[]` | 国内重要 AI 视频产品；官方域名可信，但自动化核验被 robots.txt 阻止，需人工确认当前教程入口。 |
| `stability` | Stability AI | S | `#7C3AED` | 研发生成式图像模型，并提供在线创作及开发平台。 | [Stability AI](https://stability.ai/) | [Stability AI 开发文档](https://platform.stability.ai/docs) | `dreamstudio-web` | DreamStudio | 图像创作 | `web` | [DreamStudio](https://dreamstudio.ai/) | [官方平台文档](https://platform.stability.ai/docs) | `[]` | 补充 Stable Diffusion 官方在线创作入口；面向普通用户的教程与开发文档分离，发布前应再确认入口。 |

## 暂不纳入

- 未列出可核验的官方产品页、官方帮助页或来源归属不清晰的产品。
- 搜索结果中出现的豆包、即梦等第三方下载站和仿冒域名。
- 厂商只提供动态安装直链但没有稳定产品页的桌面软件。
- 尚未经过 AI Hub 客户端本地白名单、安全审核和签名策略审核的任何“直接下载安装”方案。
- 当前已有目录中的 OpenAI、Anthropic、Google、DeepSeek、LangGenius、Comfy Org 和 Ollama 不重复新增厂商；它们仍按现有产品归属维护。

## 建议的目录落地顺序

1. 第一批先加入 `Microsoft、GitHub、Anysphere、月之暗面、阿里巴巴、腾讯、智谱、Midjourney、Runway、ElevenLabs、Suno、LM Studio、Nomic AI、Mintplex Labs`，共 14 个新厂商、16 个产品。
2. 在现有字节跳动厂商下加入 `TRAE、即梦 AI、扣子`，不创建品牌级重复厂商。
3. 可灵 AI 与 DreamStudio 先保持候选状态，人工确认教程入口后再发布。
4. 所有新增项首次只使用 `web`、`desktop-official` 或 `tutorial`，不进入客户端托管安装白名单。
