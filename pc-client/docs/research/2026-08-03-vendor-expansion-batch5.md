# 枕星 AI：厂商资源扩充调研（第五批）

- 日期：2026-08-03
- 状态：目录录入前的官方证据审查，不代表已经发布
- 范围：尚未进入当前草稿目录、且具有明确 Windows、Web 或开发者接入面的高价值 AI 厂商与 AI 可接入厂商

## 排重与研究边界

- 本轮先阅读了 `docs/vendor-resource-expansion.md`、`docs/research/2026-07-31-official-catalog-discovery-and-expansion.md`，并核对当前草稿 `admin/data/catalog-v1.json`。
- 核对时草稿更新时间为 `2026-08-02T16:23:55.774Z`，包含 168 个厂商、305 个产品和 113 项生态资源。下列 15 个建议 `vendorId`、`productId` 均已与草稿中的完整 JSON 字符串做精确排重，没有占用。
- 只采用厂商官网、官方产品页、官方帮助中心、官方开发文档或官方组织仓库；不采用搜索结果摘要、第三方评测、下载站、个人仓库或 MCP 聚合市场作为录入证据。
- 本文件只给出候选和证据，不修改 `catalog-v1.json`，也不授予任何本地执行能力。
- 图形化 Windows 软件仍只建议 `desktop-official`，由客户端打开官方下载页；IDE 插件和 API/SDK 优先使用 `tutorial` 或官方 Web 入口，不把安装命令、API Key、Token 或企业凭据写进目录。

## 分类口径

- `ai-tool`：产品本身就是 AI 助手、创作工具、AI 开发环境或 AI 平台，进入“全部 AI 厂商”。
- `ai-connectable`：产品的主要目录价值是作为云、数据或企业系统被 AI 应用、Agent、API 或工作流接入，进入“全部 AI 可接入厂商”。
- `web`：打开稳定的官方 Web 产品或平台页；`desktop-official`：只打开厂商官方 Windows 获取页；`tutorial`：只打开官方安装或接入文档。

## 建议录入清单

| # | 厂商与建议 ID | 官网 | 建议产品与类别 | 产品形态 / 建议 `productType` | AI / 可接入归类 | 官方证据与核验结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Replit；vendor `replit` | [Replit](https://replit.com/) | Replit Agent；product `replit-agent`；编程开发 | 浏览器 AI 应用开发环境；`web` | `ai-tool` | [Replit Agent 产品页](https://replit.com/ai)明确说明可通过自然语言构建并发布应用和网站；[官方 Agent 文档](https://docs.replit.com/learn/build-with-agent)确认 Agent 可规划、写代码、调试和改进应用。 |
| 2 | StackBlitz；vendor `stackblitz` | [StackBlitz](https://stackblitz.com/) | Bolt；product `bolt-new`；编程开发 | 浏览器 AI 全栈应用构建器；`web` | `ai-tool` | [Bolt 官方介绍](https://support.bolt.new/building/intro-bolt)将其定义为网站、Web App 和移动 App 的 AI 构建器，并明确 StackBlitz 是 Bolt 的母公司；[AI App Builder 产品页](https://bolt.new/use-cases/ai-app-builder)确认无需安装、在浏览器 IDE 中生成、编辑和发布应用。 |
| 3 | Lovable；vendor `lovable` | [Lovable](https://lovable.dev/) | Lovable；product `lovable-ai-app-builder`；编程开发 | 浏览器 AI 全栈应用开发平台；`web` | `ai-tool` | [Lovable 官网](https://lovable.dev/)明确通过与 AI 对话创建、迭代并发布应用和网站；[官方产品说明](https://docs.lovable.dev/introduction/welcome)将其定义为以自然语言构建、迭代和部署 Web 应用的全栈 AI 开发平台。 |
| 4 | Brave；vendor `brave` | [Brave](https://brave.com/) | Brave Browser（含 Leo）；product `brave-browser-leo`；AI 对话 | Windows 浏览器内置 AI；`desktop-official` | `ai-tool` | [Brave Leo 产品页](https://brave.com/leo/)确认 Leo 内置于 Brave，支持桌面 Windows、macOS 和 Linux；[官方下载页](https://brave.com/download/)明确提供 Windows 版。Leo 不是独立安装器，产品卡应指向 Brave 官方获取页。 |
| 5 | Tabnine；vendor `tabnine` | [Tabnine](https://www.tabnine.com/) | Tabnine AI Code Assistant；product `tabnine-ai-code-assistant`；编程开发 | IDE 插件 / Agent；`tutorial` | `ai-tool` | [Tabnine 官方概览](https://docs.tabnine.com/main)确认其为安装在 IDE 中的 AI 代码助手；[支持 IDE 与系统页](https://docs.tabnine.com/main/welcome/readme/supported-ides)明确覆盖 Windows 上的 VS Code、JetBrains、Eclipse 和 Visual Studio。首录应只打开官方安装文档。 |
| 6 | Ideogram；vendor `ideogram` | [Ideogram](https://ideogram.ai/) | Ideogram；product `ideogram-web`；图像创作 | 浏览器 AI 图像生成与编辑；`web` | `ai-tool` | [官方生成指南](https://docs.ideogram.ai/using-ideogram/getting-started/generating-images)明确称 Ideogram 为可由文本浏览和生成图像的 Web 应用；[官方 FAQ](https://docs.ideogram.ai/faq)确认直接在浏览器使用，无需下载额外软件。 |
| 7 | Recraft；vendor `recraft` | [Recraft](https://www.recraft.ai/) | Recraft Studio；product `recraft-studio`；图像创作 | 浏览器 AI 图像、矢量与设计工作区；`web` | `ai-tool` | [Recraft 官方文档](https://www.recraft.ai/docs)提供 Web 创作入门；[官方 FAQ](https://www.recraft.ai/docs/support-and-faq/FAQ)将 Recraft 定义为 AI 图像生成与编辑平台，覆盖位图、矢量、样机、品牌视觉和背景处理。 |
| 8 | Luma AI；vendor `luma` | [Luma](https://lumalabs.ai/) | Luma App；product `luma-app`；视频创作 | 浏览器图像与视频创作工作区；`web` | `ai-tool` | [Luma 当前官方口径](https://lumalabs.ai/llm-info)明确消费者创作入口是 `app.lumalabs.ai`，当前视频模型为 Ray3.2，并要求不要把已弃用的 Dream Machine 或 Ray2 当作当前产品；[当前 AI 视频产品页](https://lumalabs.ai/create/ai-video-generator)确认支持文本、图像和提示词生成视频。 |
| 9 | HeyGen；vendor `heygen` | [HeyGen](https://www.heygen.com/) | HeyGen AI Video；product `heygen-ai-video`；视频创作 | 浏览器 AI 视频、Avatar 与翻译平台；`web` | `ai-tool` | [官方 AI Video Generator](https://www.heygen.com/tool/ai-video-generator)明确全部工作流在浏览器标签页内完成；[HeyGen Developers](https://developers.heygen.com/)同时提供官方 API、CLI 和 MCP 接入面。首录产品卡仍使用 Web 入口，CLI/MCP 另行做资源审计。 |
| 10 | Synthesia；vendor `synthesia` | [Synthesia](https://www.synthesia.io/) | Synthesia；product `synthesia-ai-video`；视频创作 | 浏览器企业 AI 视频平台；`web` | `ai-tool` | [官方知识库](https://help.synthesia.io/en/articles/9994493-what-is-synthesia)将其定义为面向企业的 AI 视频平台，并确认在浏览器创建视频；[官方视频创建文档](https://docs.synthesia.io/docs/video-creation)覆盖提示词、文档、URL、脚本、Avatar 与 AI Assistant 工作流。 |
| 11 | IBM；vendor `ibm` | [IBM](https://www.ibm.com/) | IBM watsonx.ai；product `watsonx-ai`；智能体 | 浏览器企业 AI 开发 Studio；`web` | `ai-tool` | [IBM watsonx.ai 产品页](https://www.ibm.com/products/watsonx-ai)将其定义为端到端 AI 开发 Studio，覆盖基础模型、Agent 工具、机器学习、API、RAG 和部署，并提供官方试用入口。 |
| 12 | Deepgram；vendor `deepgram` | [Deepgram](https://deepgram.com/) | Deepgram Voice AI Platform；product `deepgram-voice-ai-platform`；音频创作 | Web 控制台、Playground 与 API/SDK；`web` | `ai-tool` | [Deepgram 官方文档入口](https://developers.deepgram.com/)明确提供端到端 Voice Agent、语音转文字、文字转语音、SDK、Playground、CLI 和 MCP；[API 概览](https://developers.deepgram.com/reference/deepgram-api-overview)列出 Voice Agent、实时/录音转写、TTS 和账号管理 API。 |
| 13 | Pinecone；vendor `pinecone` | [Pinecone](https://www.pinecone.io/) | Pinecone Vector Database；product `pinecone-vector-database`；数据库与数据 | 托管 Web/API 数据平台；`web` | `ai-connectable` | [Pinecone 官方文档](https://docs.pinecone.io/guides/get-started/overview)将其定义为面向生产 AI 应用的向量数据库，并列出 Claude Code、Gemini CLI、Cursor、CLI 和 API 接入；[API 参考](https://docs.pinecone.io/reference/api/introduction)确认数据库、推理、嵌入和重排 API。 |
| 14 | Oracle；vendor `oracle` | [Oracle](https://www.oracle.com/) | Oracle Cloud Infrastructure；product `oracle-cloud-infrastructure`；云服务与运维 | 云控制台与 API 平台；`web` | `ai-connectable` | [OCI Enterprise AI 产品页](https://www.oracle.com/artificial-intelligence/enterprise-ai/)确认 OCI 可跨数据源构建和部署 Agent，支持工具、API、开放标准与 MCP，并提供云试用入口；[官方 Generative AI 文档](https://docs.oracle.com/en-us/iaas/Content/generative-ai/home.htm)覆盖模型、Agent、向量存储、连接器、托管运行时和企业治理。 |
| 15 | SAP；vendor `sap` | [SAP](https://www.sap.com/) | SAP Business AI Platform；product `sap-business-ai-platform`；办公自动化 | 企业 AI、数据与流程平台；`web` | `ai-connectable` | [SAP Business AI Platform 产品页](https://www.sap.com/products/ai-platform.html)明确可构建、集成、治理并运行跨企业系统的 AI Agent、应用和工作流；[Generative AI Hub 官方文档](https://help.sap.com/docs/sap-ai-core/generative-ai/generative-ai-hub)确认其在 SAP BTP 上提供模型访问、编排、业务应用接入和企业治理。 |

## 身份与产品边界修正

1. **Bolt 归 StackBlitz**：官方 Bolt 文档明确 StackBlitz 是母公司，两者共享账号和 WebContainers。不要新建第二个 `bolt` 厂商。
2. **Brave Leo 不是独立桌面包**：Leo 内置于 Brave Browser。目录产品可命名“Brave Browser（含 Leo）”，但 `desktop-official` 必须打开 Brave 官方下载页，不能寻找 Leo 安装器。
3. **Luma 使用当前产品名**：Luma 官方当前口径把消费者入口称为 `Luma App`，并明确 Dream Machine、Ray2 已弃用。不要把旧研究中的 Dream Machine 作为活跃产品重新录入。
4. **Tabnine 先按教程型入口**：它依赖受支持 IDE 的官方插件，不是一个独立 Windows 图形安装包；不同 IDE 的市场、版本和组织部署方式应留在官方安装文档内。
5. **Oracle 与 SAP 按可接入平台归类**：两者都提供 AI 专用产品，但本轮建议产品卡的核心价值是连接企业数据、应用、Agent 与工作流，因此优先进入 `ai-connectable`；如果以后单独录入面向最终用户的 AI 助手，再对具体产品使用 `ai-tool`。

## 官方 Logo 证据与回退策略

官方网页、官方 GitHub 组织或 Verified 标记只能确认“这个标识属于谁”；它们不自动授予缓存、改色、裁切或再分发权。只有厂商明确提供的品牌素材包才进入素材候选，且录入前仍须核对该包的使用指南、商标条款、文件格式和深浅色版本。**普通网站 favicon、GitHub 网站 favicon、第三方 Brandfetch/CDN 和搜索结果图片一律不用。**没有明确可用素材或许可仍需确认时，目录使用文字回退。

| # | 厂商 | 官方品牌素材 / 身份证据 | 可确认的官方 GitHub 组织 | 当前 Logo 结论 |
| --- | --- | --- | --- | --- |
| 1 | Replit | [Replit Brand Center](https://replit.com/brand)；[GitHub 组织](https://github.com/replit)显示 Verified 且控制 `replit.com` | `replit` | 优先从 Brand Center 选官方资产；落库前复核具体下载项的使用条款，组织头像仅作身份旁证。 |
| 2 | StackBlitz | [官方 Logo resource](https://developer.stackblitz.com/public/img/logo/readme)明确把 SVG 标识文件提供给第三方使用；[GitHub 组织](https://github.com/stackblitz)显示 Verified | `stackblitz` | 使用官方 Logo resource 中与背景匹配的 SVG，不抓头像或 favicon。 |
| 3 | Lovable | [Press & Media Resources](https://lovable.dev/brand)链接官方 [Brand Hub](https://lovablebrand.lovable.app/)；[GitHub 组织](https://github.com/lovablelabs)显示 Verified 且控制 `lovable.dev` | `lovablelabs` | 优先使用 Brand Hub 的正式资产，并遵循其中的品牌规范。 |
| 4 | Brave | [Brave Branding Assets](https://brave.com/brave-branding-assets/)提供 Logo Package、色彩与规范；[GitHub 组织](https://github.com/brave)显示 Verified | `brave` | 使用官方 Logo Package；不能把 Leo 单独做成另一个厂商 Logo。 |
| 5 | Tabnine | [GitHub 组织](https://github.com/tabnine)显示 Verified 且控制 `tabnine.com` | `tabnine` | 本轮未找到面向第三方的官方品牌素材包；先用文字回退，除非后续取得可核验的品牌资产与使用许可。 |
| 6 | Ideogram | [官网](https://ideogram.ai/)链接官方开源仓库；仓库属于 [`ideogram-oss`](https://github.com/ideogram-oss/ideogram4)；[服务条款](https://ideogram.ai/tos)保留商标权利 | `ideogram-oss`（代码组织，不等于可复用公司 Logo） | 使用文字回退；不要因为官网链接了 GitHub 就把组织头像当作企业 Logo。 |
| 7 | Recraft | [`recraft-ai`](https://github.com/recraft-ai)链接 `recraft.ai`，但本轮未获得 Verified 标记或官网反向链接；[官方条款](https://www.recraft.ai/legal/terms)保留复制和利用网站、服务的权利 | 未充分确认；`recraft-ai` 仅作后续核验线索 | 使用文字回退；不采用该组织头像。 |
| 8 | Luma AI | [GitHub 组织](https://github.com/lumalabs)显示 Verified 且控制 `lumalabs.ai`；[官方条款](https://lumalabs.ai/legal/terms-of-service)限制未经许可使用 Luma 名称、Logo 和标志 | `lumalabs` | 组织只证明身份；取得书面许可前使用文字回退。 |
| 9 | HeyGen | [HeyGen Brand Kit](https://www.heygen.com/brand-kit)提供可下载 SVG 与使用规范；当前官方代码组织为 [`heygen-com`](https://github.com/heygen-com) | `heygen-com` | 使用 Brand Kit 的正式资产并保持比例、留白和颜色；不要使用已归档的 `HeyGen-Official` 组织头像。 |
| 10 | Synthesia | [Synthesia 官网](https://www.synthesia.io/)可确认企业身份；本轮未找到对外品牌素材页或可由官网确认的 GitHub 组织 | 未确认 | 使用文字回退；不使用 Brandfetch 或其他第三方聚合 Logo。 |
| 11 | IBM | [IBM 8-bar Logo](https://www.ibm.com/design/language/ibm-logos/8-bar/)与[开发者品牌指南](https://www.ibm.com/brand/experience-guides/developer/brand/logo/)提供官方规范；[法律页](https://www.ibm.com/legal/copyright-trademark)要求其他公司取得明确书面许可；[GitHub 组织](https://github.com/IBM)显示 Verified | `IBM` | 未取得 IBM 许可时使用文字回退，不能把 Verified 组织头像视为再分发授权。 |
| 12 | Deepgram | [官方开发者文档](https://developers.deepgram.com/)链接 Deepgram SDK；对应 [`deepgram`](https://github.com/deepgram) 组织；[官方条款](https://deepgram.com/terms)限制未经书面许可使用商标 | `deepgram` | 组织可作身份旁证；取得许可前使用文字回退。 |
| 13 | Pinecone | [Pinecone Newsroom](https://www.pinecone.io/newsroom/)提供黑白 Logo 下载集合；[GitHub 组织](https://github.com/pinecone-io)显示 Verified 且控制 `pinecone.io` | `pinecone-io` | 优先使用 Newsroom 的官方 Logo 包，并在录入前核对具体素材条款。 |
| 14 | Oracle | [Oracle Logo Guidelines](https://www.oracle.com/legal/logos/)明确 Oracle Logo/O Tag 需要书面授权；[`oracle`](https://github.com/oracle) 自述为 Oracle 主要 GitHub 组织 | `oracle` | 未取得 Oracle 书面授权时使用文字回退；不使用组织头像。 |
| 15 | SAP | [SAP Design System Logo](https://www.sap.com/design-system/digital/foundations/identity/logo/)提供官方 `SAP-logo.zip`（含 SVG）并指向品牌规范；[GitHub 组织](https://github.com/SAP)显示 Verified | `SAP` | `SAP-logo.zip` 是首选素材来源，但须先确认目录场景符合使用规范；无法记录许可依据时使用文字回退。 |

按当前证据，最适合先进入素材审核的是 Replit、StackBlitz、Lovable、Brave、HeyGen、Pinecone 和 SAP 的官方品牌包。Tabnine、Ideogram、Recraft、Luma AI、Synthesia、IBM、Deepgram 与 Oracle 先使用文字回退，直到存在明确的官方素材与可记录的使用依据。

## 建议录入顺序

1. **公开 Web / Windows 入口清楚**：Replit、StackBlitz/Bolt、Lovable、Brave、Ideogram、Recraft、Luma、HeyGen、Synthesia。它们可先建立厂商和产品卡，不需要本地执行能力。
2. **开发者产品边界清楚**：Tabnine、IBM watsonx.ai、Deepgram、Pinecone。首录只链接官方 Web/文档；API Key、企业 Token、IDE 配置和计费均由厂商流程处理。
3. **企业账号和租户依赖较强**：Oracle、SAP。先展示官方平台说明和接入文档，不替用户创建云资源、服务实例、模型部署、密钥或企业连接。

## 录入前仍需完成的检查

- 按上表对 7 组官方品牌包逐一确认商标许可、深浅色背景、最小尺寸和 SVG/PNG 安全处理；其余 8 家保持文字回退。研究页中的官方链接和 Verified 组织身份仍不等于可直接复用 Logo。
- 后台录入时重新执行 vendor/product/resource ID 排重，因为本文件之后目录仍可能继续扩充。
- 所有国外 Web 服务在发布前用普通浏览器人工确认中国大陆网络可达性、登录入口、地区限制和账号要求；自动抓取成功不等于用户网络可用。
- HeyGen、Deepgram、Pinecone、Oracle、SAP 虽有 API、CLI 或 MCP 能力，本批不创建一键接入任务。若后续扩展资源，必须单独核验官方发布者、固定端点/包、权限、凭据、计费、断开和撤销流程。
- 不把自动化测试或页面可抓取描述成真实账号登录、付费订阅、Windows 安装、企业租户或生产 API 验收。

## 本轮不建议同时录入

- Luma Dream Machine、Ray2：Luma 当前官方口径已标记为弃用名称/模型。
- 独立 Brave Leo 安装器：官方没有这种产品形态，Leo 随 Brave Browser 提供。
- Bolt 独立厂商：官方证据已确认其归 StackBlitz。
- Tabnine 的第三方下载包、扩展镜像或非官方市场链接。
- 任何由第三方维护、但仅宣称支持上述平台的 MCP、CLI、插件或 SDK；它们必须作为独立资源重新做发布者与权限审计。
