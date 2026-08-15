# AI 桌面版缺口审计第二批（2026-08-15）

## 结论

本批按指定候选快照中仍为 `web` / `tutorial` 的 AI 产品收束到 15 个对象，并显式排除第一批已审的 12 项。处置结果为：

| 处置 | 数量 | 含义 |
| --- | ---: | --- |
| **ready** | **4** | 一方已明确提供非浏览器安装的桌面应用、平台和稳定官方下载落地页；可以进入 `official-link-only` 目录评审 |
| **deferred** | **2** | 一方桌面信号存在，但当前产品名或平台/安装器边界仍不闭合，不能安全写入目录 |
| **blocked** | **9** | 目前只有网页、PWA、移动端、CLI、IDE/Office/浏览器扩展，或桌面能力已由现有统一宿主承载；不能新增独立桌面身份 |

本批闭合的 4 个桌面入口是 **Gemini for macOS、Comate AI IDE、Kortix Desktop、GitHub Copilot app**。其中前 3 项和 GitHub Copilot 都应复用现有产品身份、增加桌面 entry point，而不是复制产品卡。`Spellbook Associate` 确有一方桌面安装说明，但公开文档没有明确写出支持的操作系统，因此降为 deferred。

本报告只形成研究结论；没有修改目录、候选 JSON、代码或测试，没有下载、安装或运行任何应用，也没有核验安装包签名、哈希、更新器、安装收据或卸载残留。`ready` 不等于 `desktop-managed` 或一键安装获批。

## 审计基线与固定边界

- 指定候选：`docs/research/auralogs-mcp-catalog-v3-candidate-2026-08-15.json`。
- 候选 SHA-256：`dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8`；大小 `1,790,395` bytes。
- 候选规模：375 个厂商、616 个产品、280 个资源；目录时间戳为 `2026-08-08T18:27:54.775Z`。
- 活动目录对照：`admin/data/catalog-v1.json`，SHA-256 `75ff95ce9d579965e04fc44725787b72e9ed133ce9ed684747af04a0dd3d1d36`，大小 `1,610,289` bytes；375 个厂商、615 个产品、250 个资源。
- 从候选中筛出启用的 `directoryKind=ai-tool` 且 `productType=web/tutorial`，排除第一批 12 项后共有 202 项（146 Web、56 Tutorial）。本批只选其中官网有 Download/Desktop/Windows/macOS 信号，或产品语义明显指向本地客户端的 15 项，不继续扩源。
- 第一批排除项：`minimax-agent`、`notion-desktop`、`replit-agent`、`flowith-agent-neo`、`zhipu-agentmore`、`openai-codex`、`chatgpt-work`、`claude-cowork`、`cognition-devin`、`mistral-vibe`、`xai-grok-web`、`zhipu-qingyan-web`。
- “桌面应用”在本报告中指厂商提供可下载、脱离浏览器安装流程运行的 Windows/macOS/Linux 应用。PWA、“安装此网站”、网页快捷方式、浏览器扩展、Office/IDE 插件、CLI、移动 App 和云端 Desktop Mode 均不算独立桌面版。
- 只接受一方官网、帮助中心、文档、条款或厂商官方 GitHub 组织。稳定入口优先记录落地页或 releases 页，不固化滚动二进制 URL。

## Ready：可进入官方桌面入口评审（4）

### 1. `gemini-web`：复用现有 Gemini 身份，增加 macOS 桌面入口

| 项目 | 核验结果 |
| --- | --- |
| 当前目录语义 | Google 厂商下已有 `gemini-web`、`gemini-cli`、`google-gemini-spark`。桌面应用是 Gemini 主产品的原生 macOS 表面，不是 CLI，也不是 Spark 的独立安装器 |
| 原生性与平台 | 一方称其为 native desktop experience；仅支持 Apple Silicon，要求 macOS Sequoia 15.0+、8 GB RAM 和至少 200 MB 空间 |
| 稳定下载入口 | [https://gemini.google/mac/](https://gemini.google/mac/) |
| 一方证据 | [Gemini for macOS](https://gemini.google/mac/)、[Gemini macOS 安装与系统要求](https://support.google.com/gemini/answer/17011627?hl=en) |
| 条款、账户与权限边界 | 专有 Google 服务；需要个人 Google 账户，或由管理员启用的工作/学校账户。聊天历史和记忆按同一账户同步。窗口共享、屏幕上下文、语音输入、Accessibility、Screen Recording，以及用户明确连接的本地目录均属于高敏权限；Gemini Spark 仅访问用户显式连接的目录，部分能力还受年龄、国家和 Google AI 订阅限制 |
| 去重与目录动作 | 保留稳定 ID `gemini-web`，把显示范围校正为 Gemini 主产品并增加 macOS desktop entry point；保留 Web 入口。不要新增第二张 `google-gemini-desktop` 卡，不要与 `gemini-cli` 或 `google-gemini-spark` 合并。首轮只打开官方落地页 |

### 2. `baidu-comate`：复用同一产品，补 Comate AI IDE 桌面入口

| 项目 | 核验结果 |
| --- | --- |
| 当前目录语义 | 当前 `baidu-comate` 为 Web，描述只提 IDE 官方市场或厂商入口；活动目录没有第二个 Comate 桌面身份 |
| 原生性与平台 | 一方产品文档明确区分 VS Code/JetBrains 等插件与“独立 AI IDE”。下载页提供 Windows 10/11 x64、macOS 11+ Apple Silicon/Intel，以及 Linux 安装入口 |
| 稳定下载入口 | [https://comate.baidu.com/zh/download/ai-ide](https://comate.baidu.com/zh/download/ai-ide) |
| 一方证据 | [Comate AI IDE 下载](https://comate.baidu.com/zh/download/ai-ide)、[Comate 产品形态与平台](https://comate.baidu.com/docs/vscode.html)、[Comate AI IDE 快速入门](https://comate.baidu.com/docs/%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B/%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8/Comate%20AI%20IDE%20%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8/Comate%20IDE.html) |
| 条款、账户与权限边界 | 专有商业服务；首次使用需个人账户登录，企业/私有化场景可使用 License，功能和额度受个人或企业套餐约束。IDE 可打开本地项目、导入 VS Code/Cursor 设置与扩展、写代码并通过 `comate` 命令启动；目录应显式提示项目文件、终端/命令和第三方扩展信任边界 |
| 去重与目录动作 | 复用 `baidu-comate`，增加 Windows/macOS（以及后续可单列 Linux）desktop entry point，继续保留插件/教程入口；不要新增 `baidu-comate-ai-ide` 重复产品卡。首轮只打开官方下载页 |

### 3. `kortix-command-center`：复用 Kortix 产品，桌面与 CLI 分开

| 项目 | 核验结果 |
| --- | --- |
| 当前目录语义 | 当前有 `kortix-command-center`（Web）和 `kortix-cli`（CLI）。官方 changelog 把 Desktop 描述为同一产品的 desktop app shell，不是另一家公司或另一套 Agent 平台 |
| 原生性与平台 | 官方 GitHub releases 提供 Windows `.exe`、macOS `.dmg` / universal zip 和 Linux AppImage；官方 changelog 记录桌面壳、Download apps 页和桌面自动更新 |
| 稳定下载入口 | [https://github.com/kortix-ai/suna/releases](https://github.com/kortix-ai/suna/releases) |
| 一方证据 | [Kortix 官方 releases](https://github.com/kortix-ai/suna/releases)、[Kortix changelog](https://kortix.com/changelog)、[Kortix 官方仓库](https://github.com/kortix-ai/suna)、[LICENSE](https://github.com/kortix-ai/suna/blob/main/LICENSE)、[定价与账户边界](https://kortix.com/pricing) |
| 条款、账户与权限边界 | 代码采用 **Elastic License 2.0**，不是 Apache/MIT 式宽松许可证，并禁止把实质功能作为第三方托管服务提供。托管产品按账户/席位/算力计费，可 BYOK 或连接 ChatGPT 订阅。Agent 可接触 Git 仓库、文件、终端、沙箱、密钥和连接器；需把账户、项目、secret grant、connector scope 和 human approval 视为独立授权边界 |
| 去重与目录动作 | 复用 `kortix-command-center` 并增加 Windows/macOS/Linux desktop entry point；保留现有 `kortix-cli` 独立生命周期。不要再造 `kortix-desktop` 产品卡。首轮只打开 releases 页；ELv2 和高权限 Agent 提示必须可见 |

### 4. `github-copilot`：复用 Copilot 主产品，补官方桌面 app

| 项目 | 核验结果 |
| --- | --- |
| 当前目录语义 | 当前 `github-copilot` 是 Tutorial，另有独立 `github-copilot-cli`。一方现在正式提供名为 **GitHub Copilot app** 的桌面体验，仍属于 GitHub Copilot 产品和同一套餐体系 |
| 原生性与平台 | 一方产品页明确写明 macOS、Windows、Linux；应用可连接本地文件夹/仓库、运行 Agent session、查看 diff、使用终端和内置浏览器并创建 PR |
| 稳定下载入口 | [https://github.com/features/ai/github-app](https://github.com/features/ai/github-app) |
| 一方证据 | [GitHub Copilot app 产品/下载页](https://github.com/features/ai/github-app)、[官方快速入门](https://docs.github.com/en/copilot/how-tos/github-copilot-app/getting-started)、[Copilot CLI 安装说明](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli) |
| 条款、账户与权限边界 | 专有 GitHub 服务；需要 GitHub 账户、Git 和 Copilot 套餐，或用户自行配置模型提供商/API 凭据。Business/Enterprise 还受单独的 Copilot app 组织策略控制。应用可读取、克隆和修改本地或远程仓库、运行命令、创建分支/PR；BYOK 时仓库上下文会发送给所选模型提供商，应单独提示数据处理责任 |
| 去重与目录动作 | 复用 `github-copilot`，把其从纯教程入口提升为 Copilot 主产品并增加 Windows/macOS/Linux desktop entry point；保留 `github-copilot-cli`，也不要把 GitHub Desktop 的内置 Copilot 功能误当成此安装器。首轮只打开官方产品页 |

## Deferred：桌面信号存在，但证据未闭合（2）

### 5. `baidu-wenxiaoyan`：Windows/macOS 已证实，当前显示名未闭合

| 项目 | 核验结果 |
| --- | --- |
| 桌面证据 | 一方 `/pc` 页面明确写“你的桌面智能助手”，同时提供 macOS 版和 Windows 版，并描述本地文件拖拽解析、导出与手机/电脑消息同步 |
| 稳定下载入口 | [https://wenxiaoyan.com/pc](https://wenxiaoyan.com/pc) |
| 暂缓原因 | 候选仍名为“文小言”，但当前一方页面标题已显示“文心官网”，同时继续使用 `wenxiaoyan.com` 旧域名；页面正文没有给出可审计的品牌迁移说明。下载页也没有公开账户、系统权限、当前版本或条款链接。桌面形态已闭合，但“当前产品身份”未闭合 |
| 条款、账户与权限边界 | 北京百度网讯科技有限公司提供的专有服务。文件拖拽解析、导出、跨端消息与问答同步意味着本地文件和云账户数据边界；在一方公开说明补齐前，不推断百度账号登录方式、所需系统权限或离线能力 |
| 再评审门槛 | 保留稳定 ID `baidu-wenxiaoyan`，取得百度一方的“文小言 → 文心”当前命名说明，或不下载二进制即可核验的安装器元数据/帮助文档；随后以“文心（原文小言）”等可追溯显示名增加 Windows/macOS entry point。不要新建第二个 `baidu-wenxin-desktop` 身份 |

### 6. `spellbook-legal`：相邻产品 Spellbook Associate 有桌面安装，但平台未写明

| 项目 | 核验结果 |
| --- | --- |
| 桌面证据 | Spellbook 当前 Word 安装文档仍明确说主产品只是 Microsoft Word add-in、没有 standalone desktop app；但另一份一方帮助文档明确把 **Spellbook Associate** 分为网站和 Desktop App，并给出安装流程与官方下载域名 |
| 稳定官方入口 | [Associate 安装说明](https://help.spellbook.legal/en/articles/10437537-how-to-set-up-spellbook-associate)；文档指向 [https://download.spellbook.legal/](https://download.spellbook.legal/)（会自动开始下载，本轮未访问二进制） |
| 暂缓原因 | 一方只写“PC”、`.zip` 和“installation app”，没有明确列出 Windows/macOS 兼容矩阵、架构、版本或发布者；因此不能把它安全标成 Windows 或 macOS。`download.spellbook.legal` 还是自动下载端点，不是可观察的版本落地页 |
| 条款、账户与权限边界 | 专有法律 AI 服务；需要 Spellbook 账户、邮箱验证和 License Key。Associate 可上传、读取、比较并改写 Word/PDF/TXT 等高敏法律文件；与 Word add-in、Google Docs add-on、Chrome extension 和 iManage/OneDrive 连接器是不同入口，不能共享未经说明的权限结论 |
| 再评审门槛 | 保留 `spellbook-legal` 作为 Word add-in/主产品；为相邻产品预留 `spellbook-associate-desktop`，取得一方明确的 OS/架构、稳定版本页、发布者和更新/卸载说明后再录入。不能用 Associate 安装器改写 `spellbook-legal` 的“Word add-in”身份 |

## Blocked：本批不能新增独立桌面身份（9）

| 当前候选对象 | 一方核验 | 稳定官方入口 | 去重、条款/账户/权限边界与正确动作 |
| --- | --- | --- | --- |
| `deepseek-web` | DeepSeek 主站把当前表面列为 Web、App、API 和 Harness；官方 App 公告与下载页只列 iOS、Google Play 和各 Android 商店，没有 Windows/macOS 客户端 | [DeepSeek 官网](https://deepseek.com/en/index.html)、[官方 App 下载](https://download.deepseek.com/app)、[官方 App 公告](https://api-docs.deepseek.com/news/news250115/) | 保持 Web；移动 App 账户支持邮箱/Google/Apple 并同步聊天历史。`deepseek-harness` 是另一个官方本地 Agent/开发工具身份，不是 DeepSeek Chat 桌面 GUI；开源模型权重的 MIT 许可也不适用于专有聊天应用。拒绝第三方桌面封装 |
| `google-notebooklm` | 当前一方帮助中心已使用 **Gemini Notebook** 名称，明确桌面计算机入口是浏览器，另有移动 App；没有原生 Windows/macOS 下载页 | [Gemini Notebook 官方帮助](https://support.google.com/notebooklm/answer/16164461?hl=en) | 保持 Web；PWA/网页快捷方式不能升桌面。需要个人 Google 账户或管理员启用的工作/学校账户；个人、Workspace、Education 适用不同条款和数据处理边界，上传的来源文件属于账户数据 |
| `kimi-web` | 一方明确区分 Kimi Web 与原生 Windows/macOS **Kimi Work**；活动目录已经存在 `kimi-work-desktop` | [Kimi Work 官方下载](https://www.kimi.com/zh-cn/products/kimi-work)、[Web 与 Desktop 区别](https://www.kimi.com/resources/kimi-work-introduction) | 不新增 Kimi 桌面卡；把“可在桌面工作”的关系指向现有 `kimi-work-desktop`。Kimi Work 可挂载本地目录、运行 Python/shell、自动操作浏览器和执行计划任务，修改/覆盖/执行前有 Ask before acting；这是高权限本地 Agent，不应回写到普通 Kimi Web 权限描述 |
| `kimi-claw-desktop` | 一方帮助说明 Kimi Claw Desktop 是在 **Kimi 桌面应用内**选择“部署在我的电脑”，不是另一个安装包 | [Kimi Claw 官方帮助](https://www.kimi.com/help/kimi-claw)、[Kimi Claw 产品页](https://www.kimi.com/bot/) | 保持 Tutorial 并复用现有 `kimi-work-desktop` 安装身份。部署需要 Kimi 账户和 Allegretto 或更高套餐；每账户最多一个本地实例，可经用户许可迁移已有 OpenClaw 的人格、记忆、聊天历史和工作区文件。OpenClaw 的开源身份不能替代 Kimi 桌面宿主的专有账户/套餐边界 |
| `amazon-q-developer` | 当前入口是 VS Code/JetBrains/Eclipse/Visual Studio 插件、CLI、AWS Console 和聊天集成，没有独立 GUI 桌面应用；AWS 已宣布新 Q Developer 账户/订阅自 2026-05-15 停止，IDE 插件面向既有用户维持到 2027-04-30，并引导转向 Kiro | [Amazon Q Developer 入门](https://aws.amazon.com/q/developer/getting-started/)、[IDE 安装](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/q-in-IDE-setup.html)、[一方停止支持公告](https://aws.amazon.com/blogs/devops/amazon-q-developer-end-of-support-announcement/) | 保持 Web/教程生命周期，不新增桌面。插件/CLI 使用 Builder ID 或 IAM Identity Center，并可读写项目文件、执行 shell/AWS 操作；当前目录已有 `amazon-kiro-ide` 和 `amazon-kiro-cli`，迁移关系应指向 Kiro，不能把 Q CLI 或插件冒充桌面 App |
| `jetbrains-junie` | 一方推荐在 JetBrains IDE 的 AI Chat 中下载 Junie，另提供单独插件和 Junie CLI；没有独立 Windows/macOS GUI 安装器 | [Junie IDE plugin](https://junie.jetbrains.com/docs/junie-ide-plugin.html)、[Junie 产品说明](https://www.jetbrains.com/help/ai-assistant/junie-agent.html)、[Junie CLI 与 IDE 集成](https://junie.jetbrains.com/docs/junie-cli-jetbrains-ide-integration.html) | 保持插件/教程身份；活动目录已有 `jetbrains-intellij-idea` 桌面宿主。需要 JetBrains Account 和 JetBrains AI 订阅/试用，插件/CLI 可访问项目文件、运行测试和终端命令并调用 MCP；这些权限属于 IDE/CLI，不是独立桌面应用 |
| `adobe-firefly` | 一方技术要求明确 Firefly 是在 `firefly.adobe.com` 运行的 Web app，桌面要求其实是浏览器/系统要求；可下载的原生 App 仅 iOS/Android | [Firefly 技术要求](https://helpx.adobe.com/firefly/web/get-started/learn-the-basics/technical-requirements.html)、[Firefly Web](https://firefly.adobe.com/) | 保持 Web；不要把“Desktop requirements”文字或 Creative Cloud Desktop 当作 Firefly 安装器。活动目录已有 Adobe Creative Cloud、Photoshop、Illustrator、Lightroom、Premiere 等独立桌面产品。Firefly 受 Adobe 账户、套餐/生成点数、上传素材和地区可用性约束 |
| `bardeen-agents` | 当前一方安装指南和上手文档都要求 Chrome/Chromium 扩展；兼容性文档把 native macOS app 写成未来计划，未提供当前下载页 | [Bardeen 安装指南](https://support.bardeen.ai/hc/en-us/articles/32728205410317-How-to-Install-Uninstall-Bardeen-Extension)、[浏览器兼容性](https://support.bardeen.ai/hc/en-us/articles/23925152357901-Browser-compatibility-of-Bardeen)、[当前上手说明](https://support.bardeen.ai/hc/en-us/articles/23646078000141-Start-here-for-a-video-walkthrough) | 保持 Web/浏览器扩展；不要把本地运行的 extension 或未来承诺标成桌面。需 Bardeen 账户（邮箱/Google/GitHub）和对连接应用的 OAuth 授权；例如 Google Sheets 可能请求读写删除范围，网页自动化还可使用当前登录会话，权限提示应属于扩展/连接器入口 |
| `elevenlabs-studio` | 一方总览明确 ElevenCreative/Studio 是直接在浏览器运行的 no-code web application；官方原生 App 只有 iOS/iPadOS/Android，且是 ElevenLabs 通用移动 App，不是 Studio 桌面端 | [ElevenLabs 产品形态总览](https://elevenlabs.io/docs/overview/intro/)、[Studio 文档](https://elevenlabs.io/docs/eleven-creative/products/studio)、[官方 App 说明](https://help.elevenlabs.io/hc/en-us/articles/19833992491793-Does-ElevenLabs-have-an-official-app) | 保持 Web；不要把音频“Download/Export”按钮误认成应用下载。需要 ElevenLabs 账户，生成和导出受免费/付费套餐及 credits 影响；用户上传的文档、音频、图像、视频和共享评论在云端工作区处理 |

## 去重与后续录入规则

1. **同一产品的桌面表面优先追加 entry point。** `gemini-web`、`baidu-comate`、`kortix-command-center`、`github-copilot` 均复用稳定 ID；Web、教程、插件或 CLI 入口继续保留。不要为了显示“桌面版”复制产品卡。
2. **真正的相邻产品才建新身份。** Spellbook Associate 与 Spellbook Word add-in 是不同工作流和安装边界；只有平台与安装合同补齐后，才建立 `spellbook-associate-desktop`。
3. **统一宿主只保留一个安装生命周期。** Kimi Web 和 Kimi Claw 的桌面关系都指向现有 `kimi-work-desktop`；检测、更新、卸载和收据不能复制。
4. **CLI、插件、PWA、移动 App 不冒充桌面应用。** Amazon Q、Junie、Bardeen、DeepSeek、Gemini Notebook、Adobe Firefly、ElevenLabs Studio 保持真实形态；可展示入口，但不生成桌面安装状态。
5. **`ready` 仍只允许官方落地页。** 若后续要托管下载或“一键安装/更新”，每个产品都必须另做当前版本发现、架构、发布者、Authenticode/Apple notarization、哈希或滚动 URL、安装收据、更新器、卸载和残留审计。
6. **品牌漂移不靠猜。** `baidu-wenxiaoyan` 在当前一方页面标题与候选显示名之间存在“文心/文小言”冲突；稳定 ID 可以保留，但用户可见名称必须等一方身份说明闭合。

## 本批冻结声明

- 固定审计对象：15。
- 精确处置：`ready=4`、`deferred=2`、`blocked=9`。
- 本批停止于上述 15 项，不把“没有在本批一方页面找到”扩写成“永久不存在”。后续资源更新时必须重新读取活动目录、重验官方下载落地页与产品关系，再生成新的候选差异；不得直接覆盖本次快照结论。
- 本文件是研究冻结件，不是发布清单、安装授权或生产变更。
