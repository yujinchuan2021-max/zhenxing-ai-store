# 第八批 Windows 图形产品核验

## 范围与结论

本次先读取 `pc-client/admin/data/catalog-v1.json`。核验基线为 **197 个厂商、351 个产品、118 项生态资源**。下列 12 个产品的厂商名、产品名和官方域名均未出现在现有目录中；其中检索 `Craft` 时只命中现有的 **Recraft**，两者不是同一厂商或产品，不能合并。

本批只研究当前仍受支持、具有官方 Windows 图形客户端，并且由厂商明确说明含有 AI 能力的产品；不研究 CLI。所有资料来自厂商官网、官方帮助中心或官方文档，没有采用软件下载站、媒体报道或搜索摘要作为录入依据。

建议本批所有 Windows 产品继续调用现有 `desktop-official` 模块：

- `installPolicy`: `open-official-download`
- `downloadPolicy`: `official-page`
- `signaturePolicy`: `vendor-controlled`
- `uninstallPolicy`: `vendor-managed`
- 客户端只打开厂商长期维护的产品页、下载页或账户下载页，不保存版本化 EXE/MSI/MSIX 直链，不替厂商下载、校验或启动图形安装器。

12 个产品都建议归入 `ai-tool`。Craft、Capacities、Tana、Heptabase 等产品另有 MCP/API 能力时，应在资源商店建立关系，不应把同一个 Windows 产品重复录入成 `ai-connectable` 产品。

## 建议录入的 12 个产品

| 优先级 | 厂商 / 建议厂商 ID | 产品 / 建议产品 ID | 分类 | Windows 官方入口 | Web 入口 | AI 能力与官方教程 | 限制、去重与录入结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ON1 / `on1` | ON1 Photo RAW / `on1-photo-raw` | 图像创作 | [官方试用下载页](https://www.on1.com/products/photo-raw/download/) | 无网页编辑器 | [产品页](https://www.on1.com/products/photo-raw/)列出 NoNoise AI、Resize AI、Brilliance AI、Super Select AI、AI 蒙版和生成式编辑；[功能清单](https://www.on1.com/products/photo-raw/features/)和[教程中心](https://www.on1.com/learn/)可作教程入口。 | 当前 2026.4 版要求 Windows 11 64 位 x86/ARM，至少 8 GB 内存、4 GB VRAM 和 6 GB 磁盘；安装、激活、更新和内容下载需要账号与网络，Restore AI、插件等部分能力属于 MAX 版。现有目录无 ON1，建议纳入。 |
| 2 | Capture One / `capture-one` | Capture One Pro / `capture-one-pro` | 图像创作 | [官方账户下载入口](https://www.captureone.com/en/account/download)；[安装说明](https://support.captureone.com/hc/en-us/articles/360002470258-Download-install-and-update-Capture-One)确认 Windows 下载 EXE | [Capture One Live](https://www.captureone.com/en/products/capture-one-live)仅可标注为“网页协作”，不是完整网页编辑器 | [官方 AI 辅助编辑页](https://www.captureone.com/en/explore-features/assisted-editing)与[AI 蒙版说明](https://support.captureone.com/hc/en-us/articles/360002601658-Overview-of-Layers-and-Masks)确认人物/主体/背景蒙版、Match Look、AI Crop 等能力。 | 下载需要登录账号，Windows 安装器可能补装 .NET Framework 与 WebView2，软件需要联网激活；功能与许可版本有关。桌面编辑与 Live 协作可放同一产品卡，但按钮文案必须区分。现有目录无 Capture One，建议纳入。 |
| 3 | DxO / `dxo` | DxO PhotoLab / `dxo-photolab` | 图像创作 | [PhotoLab 官方产品及试用入口](https://www.dxo.com/en/dxo-photolab/) | 无 | [产品页](https://www.dxo.com/en/dxo-photolab/)确认 DeepPRIME 机器学习降噪和 AI Masks；[功能页](https://www.dxo.com/en/dxo-photolab/features/)与[官方用户指南](https://userguides.dxo.com/photolab/en/overview/)可作教程证据。 | 部分 AI 加速效果取决于 Windows 版本与 GPU；[Windows AI Mask 优化说明](https://support.dxo.com/hc/en-us/articles/29991196600093-What-improvements-does-DxO-PhotoLab-9-6-bring-to-AI-Masks-on-Windows-NVIDIA-RTX-WinML)明确不同硬件与系统版本存在差异，卡片不能承诺所有电脑获得相同性能。现有目录无 DxO，建议纳入。 |
| 4 | Craft / `craft` | Craft / `craft-desktop` | 文档与知识库 | [Craft 官方下载页](https://www.craft.do/download)提供 Windows 下载与 Microsoft Store | [Craft Web](https://docs.craft.do/) | [Craft Assistant 官方说明](https://support.craft.do/en/ai-assistant)确认其在 Windows 和 Web 可用于理解、检索、总结和处理内容；[使用说明](https://support.craft.do/en/ai-assistant/using)可作教程。 | 截至核验时，Assistant 的文档编辑动作仍只在 macOS/iOS 提供，Windows 卡片不能宣传“AI 直接修改文档”；Fast/Max 模型和额度受方案约束，Windows 也不能宣传本地模型。Craft 的 MCP/API 应建立资源关系，不另造第二个 Windows 产品。现有 Recraft 与 Craft 无关，建议纳入。 |
| 5 | Capacities / `capacities` | Capacities / `capacities-desktop` | 文档与知识库 | [官方应用下载页](https://capacities.io/download-app)明确提供 Windows | 同一页面提供 Web 入口 | [AI Assistant 文档](https://docs.capacities.io/reference/ai-assistant)确认 Windows 快捷键、笔记上下文、自动标签、属性填充、图像分析及 OpenAI/Anthropic/Gemini/Mistral/xAI 等模型；可同时作为教程。 | AI Assistant 属于 Pro 能力并有每日预算；BYOK 产生独立 API 费用，启用 AI 时相关内容会发送给选定模型提供商，官方明确当前不支持纯本地模型。[AI Chat Connectors](https://docs.capacities.io/reference/ai-chat-connectors)应进入 MCP 资源商店，不重复计算为产品。现有目录无 Capacities，建议纳入。 |
| 6 | Evernote / `evernote` | Evernote / `evernote-desktop` | 文档与知识库 | [Evernote 官方下载页](https://evernote.com/download)；[安装说明](https://help.evernote.com/hc/en-us/articles/209005257-How-to-install-Evernote)明确 Windows 下载 | [Evernote Web](https://www.evernote.com/client/web) | [AI Assistant 官方说明](https://help.evernote.com/hc/en-us/articles/46319409880211-AI-Assistant)确认桌面端和 Web 可围绕笔记检索、总结、写作、OCR 和网页搜索。 | 需要 Evernote v11、登录和网络；AI Assistant 有月度/防滥用限制，只在 OpenAI 支持的国家和地区提供。官方[系统要求](https://help.evernote.com/hc/en-us/articles/115012107027-Operating-system-requirements-for-Evernote)为 Windows 10 及以上，Windows ARM 当前不受官方支持。Web 与桌面合并为一张产品卡。现有目录无 Evernote，建议纳入。 |
| 7 | Dropbox / `dropbox` | Dropbox Dash / `dropbox-dash` | 文档与知识库 | [官方安装说明](https://help.dropbox.com/installs/download-install-dropbox-dash)要求登录 `dash.ai` 后下载 Windows EXE | [Dropbox Dash Web](https://dash.ai/) | [Dash 搜索与问答说明](https://help.dropbox.com/view-edit/dropbox-dash-search-and-explore)确认可跨连接应用搜索、总结文件并回答问题；[桌面应用说明](https://help.dropbox.com/installs/dash-desktop-app-overview)可作教程。 | 支持 Windows 10/11；本地文件搜索只在桌面端提供，但官方明确 AI 总结不支持本地文件，连接应用仍遵守原权限，模型可用性会变化。Dropbox Dash 是独立 AI 工作搜索产品，不能与普通 Dropbox 同步客户端合并。现有目录无 Dropbox，建议纳入。 |
| 8 | Tana / `tana` | Tana Outliner / `tana-outliner` | 文档与知识库 | [Tana 官方下载页](https://tana.inc/download)明确提供 Windows、Mac 与 Linux 桌面版 | [Tana Web](https://home.tana.inc/) | [桌面产品页](https://outliner.tana.inc/desktop)确认 AI 会议记录、转写、摘要、行动项、Tana AI、图像生成以及本地 API/MCP；[AI 使用说明](https://tana.inc/help/working-with-ai)可作教程。 | 桌面核心笔记可离线，但[桌面说明](https://outliner.tana.inc/learn/features/tana-for-desktop)明确 AI、命令、Agent、发布和集成需要联网；免费方案只有有限会议和 AI 查询额度。录音会捕获系统音频，目录应提示用户确认参会者授权。Tana MCP 是生态资源，不另造第二个 Windows 产品。现有目录无 Tana，建议纳入。 |
| 9 | Heptabase / `heptabase` | Heptabase / `heptabase-desktop` | 文档与知识库 | [Heptabase 官方下载页](https://heptabase.com/download)明确提供 Windows | [Heptabase Web](https://app.heptabase.com/) | [官方产品页](https://heptabase.com/)确认 AI Tutor 可围绕 PDF、YouTube、笔记和 Journal 研究；[AI API Key 说明](https://support.heptabase.com/en/articles/10505755-how-can-i-get-an-api-key-to-use-ai-in-heptabase)确认桌面/Web 支持 Gemini、OpenAI 与 Claude，[MCP 文档](https://support.heptabase.com/en/articles/12679581-how-to-use-heptabase-mcp)确认外部 AI 可读写知识库。 | AI 功能按 Pro/Premium/Premium+ 方案分配额度，也支持 BYOK；开启 Space search 后，相关卡片/白板内容会发送给模型，[官方权限说明](https://support.heptabase.com/en/articles/13009956-what-data-can-ai-access-when-i-turn-on-the-space-search-option-in-an-ai-conversation)应作为隐私提示。MCP 进入资源商店，不重复产品。现有目录无 Heptabase，建议纳入。 |
| 10 | ACD Systems / `acd-systems` | ACDSee Photo Studio Ultimate / `acdsee-photo-studio-ultimate` | 图像创作 | [Photo Studio Ultimate 官方产品页](https://www.acdsee.com/en/products/photo-studio-ultimate/)提供购买与试用入口 | 无；ACDSee 365 Cloud 是独立云服务 | [产品页](https://www.acdsee.com/en/products/photo-studio-ultimate/)列出 AI Denoise、Hair Masking、Develop Presets、Face Edit、Keywords 和人脸识别；[功能与系统要求](https://www.acdsee.com/en/products/photo-studio-ultimate/features/)可作教程与兼容性证据。 | 仅支持 Windows 10/11 64 位并要求 DirectX 12；激活、订阅校验和在线服务需要邮箱与网络。官方说明 AI 处理在本机完成。只保存产品页，不保存 `dl.acdsystems.com` 的版本化构建地址。现有目录无 ACD Systems/ACDSee，建议纳入。 |
| 11 | Boris FX / `boris-fx` | Vegas Pro / `vegas-pro` | 视频创作 | [Vegas Pro 官方产品页](https://www.vegascreativesoftware.com/vegas-pro/)与试用入口 | 无 | [2026 新功能页](https://www.vegascreativesoftware.com/vegas-pro/whats-new/)确认 Z-Depth AI、离线语音转文字、离线文字转语音和 AI 处理；[Boris FX 收购公告](https://blog.borisfx.com/press/boris-fx-acquires-vegas-pro-sound-forge-and-acid-pro)确认 2026 年 3 月后产品归属。 | 当前[系统要求](https://www.vegascreativesoftware.com/vegas-pro/system-requirements/)仅列 Windows 11，AI 推荐 32 GB 内存和高性能 GPU；部分离线语音能力仅订阅版提供。必须归到 Boris FX，不能沿用旧 MAGIX 厂商关系。现有目录无 Boris FX/Vegas Pro，建议纳入。 |
| 12 | Zoner / `zoner` | Zoner Studio / `zoner-studio` | 图像创作 | [Zoner Studio 官方 Windows 下载页](https://www.zoner.com/en/download) | 无；Zonerama 与 ZonerCloud 不是网页编辑器 | [产品页](https://www.zoner.com/en)确认照片与轻量视频编辑、RAW 管理、AI 去背景和 AI 蒙版；[官方入门教程](https://learn.zoner.com/getting-started-with-zoner-photo-studio-x/)可作教程入口。 | 当前产品支持 Windows 10/11，完整试用和后续使用受账号与订阅约束；主产品名使用当前品牌 “Zoner Studio”，旧称只保留在历史教程地址。现有目录无 Zoner，建议纳入。 |

## 产品卡与后台字段建议

### Web 与 Windows 合并

- Craft、Capacities、Evernote、Dropbox Dash、Tana Outliner 和 Heptabase 的 Web 与 Windows 入口属于同一产品，应在一张产品卡中展示“工具官网 / 网页版 / Windows 下载”，只计算一个产品。
- Capture One Live 只是网页协作，不是 Capture One Pro 的网页编辑器，按钮应明确写“Live 网页协作”。
- ON1 Photo RAW、DxO PhotoLab、ACDSee、Vegas Pro 和 Zoner Studio 没有等价网页编辑器，不添加 Web 按钮。

### AI 工具与生态资源分离

- 12 个 Windows 产品本身都有厂商确认的 AI 功能，因此主产品统一归 `ai-tool`。
- Craft MCP/API、Capacities AI Chat Connectors、Tana MCP 和 Heptabase MCP 等接入能力属于后续资源目录；后台应以资源关系指向相应产品，不新增同名 `ai-connectable` Windows 产品。
- 本批未发现 ON1、Capture One、DxO、ACDSee、Vegas Pro 或 Zoner Studio 的官方 MCP/Skill 证据，不能根据第三方插件自行创建资源。

### 账号、费用、网络和硬件提示

- “可下载 Windows 客户端”不等于“AI 功能免费”：Craft、Capacities、Evernote、Dropbox Dash、Tana、Heptabase、Capture One、ON1 和 Vegas Pro 均存在账号、额度、许可、试用或套餐边界。
- ON1、DxO、Capture One、ACDSee 和 Vegas Pro 的 AI 处理受 GPU、内存或系统版本影响；目录只展示厂商要求，不在用户点击产品卡时主动扫描环境。
- 是否标注“中国用户需要科学上网”应另做实际区域连通性核验，不能仅凭厂商位于海外自动推断。

## 本批排除或暂缓

- **Mylio Photos、EndNote 2025 与 Taskade**：官方 Windows 与 AI 证据已通过初步核验，留作下一批候选。
- **PaintShop Pro**：官方仍有销售入口，但公开主产品与更新资料主要停留在 2023 版本，本批不把“仍可购买”等同于“当前积极维护”。
- **NVIDIA ChatRTX**：上一批已确认停用，不重新纳入。
- 任何仅 macOS、仅移动端、仅 CLI、只有第三方 AI 插件、缺少稳定 Windows 官方入口或厂商已停止维护的产品。
