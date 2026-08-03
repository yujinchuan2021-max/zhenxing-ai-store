# 下一批 Windows AI 桌面产品与厂商缺口核验

## 范围、基线与结论

本次只研究具有厂商官方 Windows 入口、厂商明确说明含有 AI 能力，并且截至 2026-08-03 仍有近期维护证据的桌面产品。资料只采用厂商官网、官方帮助中心、官方文档或厂商维护的官方 GitHub 仓库；没有把软件下载站、媒体文章或第三方聚合页作为录入依据。

核验时读取 `pc-client/admin/data/catalog-v1.json`，基线为 `schemaVersion: 2`、**311 个厂商、505 个产品、118 项生态资源**，目录 `updatedAt` 为 `2026-08-03T04:50:17.949Z`，文件修改时间为 `2026-08-03T04:54:01.956Z`。对厂商 ID/名称和嵌套产品 ID/名称做规范化精确比较后，下列 15 个候选均无同名记录：Superwhisper、screenpipe、PDFgear、UPDF、Vrew、Voice.ai、FineVoice、GitButler、AFFiNE、AppFlowy、DuckDuckGo、Spark Mail、Canary Mail、Movavi Video Editor、CorelDRAW Graphics Suite。

这是一份研究证据清单，不修改目录或客户端。目录在其他任务中仍可能继续增长，真正录入前必须基于当时的最新版再次去重。

建议优先核验并录入 10 个较明确的候选：Superwhisper、screenpipe、PDFgear、UPDF、Voice.ai、FineVoice、AFFiNE、AppFlowy、Canary Mail 和 Movavi Video Editor。Vrew、GitButler、DuckDuckGo Browser、Spark Mail 与 CorelDRAW 的官方 Windows 入口也成立，但分别存在地区页面不一致、稳定版节奏、AI 只是可选能力、中国大陆可用性或广义专业套件等边界，建议列为下一层优先级。

## 统一安装与产品边界

这 15 个产品都是图形产品，建议沿用现有 `desktop-official` 路由：

- `productType`: `desktop-official`
- `moduleId`: `desktop-official`
- `installPolicy`: `open-official-download`
- `downloadPolicy`: `official-page`
- `signaturePolicy`: `vendor-controlled`
- `uninstallPolicy`: `vendor-managed`
- 客户端只打开厂商长期维护的产品页、下载页或商店页，不保存版本化 EXE、MSI、MSIX 直链，不替厂商下载、解析、校验、启动或卸载图形安装器。
- 产品卡被浏览时不主动探测麦克风、GPU、音频驱动、浏览器、邮箱账户、屏幕录制权限或本地模型；这些信息只作为安装前提示，仍由用户在厂商流程中确认。
- 同一产品同时拥有 Web、MCP、API 或本地 API 时，只建立入口或生态资源关系，不重复新增一个同名 Windows 产品。

## 建议候选

| 优先级 | 厂商 / 建议厂商 ID | 产品 / 建议产品 ID | 分类 | Windows 官方入口 | 官方 AI 与维护证据 | 录入边界 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Superwhisper / `superwhisper` | Superwhisper / `superwhisper-windows` | 音频创作 | [Windows 产品页](https://superwhisper.com/windows)；[官方下载页](https://superwhisper.com/download) | Windows 页明确支持 Windows 10/11、在任意应用中听写、上下文处理和本地模型；下载页分别提供 x64/ARM64，并在核验时标注 Windows v1.5.8。[Windows 入门文档](https://superwhisper.com/docs/get-started/windows)列出当前能力与仍在开发的差异，[官方更新日志](https://superwhisper.com/changelog)显示产品仍持续更新。 | 麦克风与上下文访问需用户授权。Windows 文档明确 FileSync、自定义应用文件夹、Shift 自动发送、模拟按键和部分 agentic coding 集成尚未支持，不能把 macOS 能力全部复制到 Windows 卡片。 |
| 0 | screenpipe / `screenpipe` | screenpipe / `screenpipe-desktop` | 智能体 | [官方产品页](https://screenpipe.com/)；[官方 GitHub Releases](https://github.com/screenpipe/screenpipe/releases) | 官网明确支持 Windows、macOS、Linux，在本地记录屏幕与音频并提供搜索、SQLite、API/SDK 和 agent context；[更新日志](https://screenpipe.com/changelog)和官方 Releases 显示 2026-08-02 仍发布 `app-v2.5.165`，包含 Windows 非 AVX2 启动修复等变更。 | 这是持续捕获屏幕/音频并可连接代理的高敏感工具。产品卡必须提示排除应用、敏感信息遮蔽、录制参与者授权和本地 API 风险；不能把“local-first”简化成“绝不会发生任何网络传输”。 |
| 0 | PDFgear / `pdfgear` | PDFgear / `pdfgear-windows` | 文档与知识库 | [Windows 产品页](https://www.pdfgear.com/pdfgear-for-windows/)；[安装指南](https://www.pdfgear.com/windows-user-guide/download-install-pdfgear-on-windows.htm) | [官网](https://www.pdfgear.com/)明确提供 Windows 10/11 PDF 编辑、转换、OCR、GPT 对话和 Copilot 工作流；[Chat PDF 页面](https://www.pdfgear.com/chat-pdf/)说明可总结、提取和问答。安装指南确认 Windows 10/11，并说明 PDF 聊天、产品帮助与在线更新需要网络。 | 普通 PDF 编辑可离线，但 AI Chatbot 使用网络和 OpenAI API。涉及合同、身份或财务资料时必须提示用户先确认云端处理边界，不能将整个产品宣传为完全本地。 |
| 0 | UPDF（Superace Software）/ `updf` | UPDF / `updf-windows` | 文档与知识库 | [Windows 产品页](https://updf.com/updf/)；[官方下载中心](https://updf.com/download/) | 产品页明确提供 Windows PDF 编辑、OCR、语义搜索、长文档总结/翻译和 AI Assistant；[版本历史](https://updf.com/whats-new/)在核验时列出 2026-07-13 的 v2.5.6，并有 2026 年连续更新。[官方隐私政策](https://updf.com/cs/privacy-policy/)说明使用 UPDF AI 时 PDF 会安全上传至 UPDF Cloud。 | UPDF Pro 与 AI Assistant 是不同计费/额度边界。文档会在 AI 流程中离开设备，不能标注为完全本地；企业禁用云端或 AI 的能力也不等于普通消费者默认关闭。 |
| 1 | Vrew（VoyagerX）/ `vrew` | Vrew / `vrew-desktop` | 视频创作 | [官方产品页（西班牙语）](https://vrew.ai/es/)；[官方产品页（韩语）](https://vrew.ai/ko/) | 官方页面明确支持 Mac、Windows、Ubuntu，并列出 AI 字幕、转录式剪辑、AI 配音、文本生成视频、静音删除、PDF 转视频和翻译；核验时西班牙语与韩语页面均显示 v4.4.1。[官方服务条款](https://vrew.ai/en/terms-of-service/)确认桌面、移动与 Web 形态及自动字幕、语音生成等云服务。 | 英文美国页面仍显示较旧的 v3.8.0，地区页面版本信息不一致。录入前应重新确认可长期维护的 canonical 下载页；语音、转录和生成能力还需提示账户、额度、云处理与声音授权。 |
| 0 | Voice.ai / `voiceai` | Voice.ai / `voice-ai-windows` | 音频创作 | [Windows 官方页](https://voice.ai/platforms/pc)；[平台支持说明](https://support.voice.ai/hc/en-us/articles/8296005604253-What-platforms-is-the-voice-changer-available-on) | Windows 页明确提供 Windows 安装器、实时 AI 变声、声音克隆，以及在游戏、直播、会议和所有使用 Windows 麦克风的应用中工作；官方帮助中心 2026-02 仍确认 Windows 桌面应用和自动更新机制。 | 安装涉及虚拟音频驱动、麦克风、GPU 和系统音频权限。声音克隆与拟声必须限定为合法、经授权的使用，卡片不能用冒充他人的演示文案。 |
| 0 | FineVoice / `finevoice` | FineVoice / `finevoice-desktop` | 音频创作 | [当前官网](https://finevoice.ai/)；[官方下载页](https://finevoice.ai/download) | 官网提供 Windows/macOS 桌面下载，并列出 AI 变声、声音克隆、TTS、STT、翻译和音频增强；[官网迁移公告](https://finevoice.ai/official-website-migration.html)确认已从旧的 FineShare 域名迁移到 `finevoice.ai`，[v1.5 公告](https://finevoice.ai/blog/news/fineshare-finevoice-embraces-its-new-1-5-version-upgrade-as-a-versatile-ai-voice-studio)发布于 2026-02-25。 | 只使用新域名，不保存旧域名或静态安装器。官方迁移公告也要求声音克隆只能用于已获授权声音并禁止冒充、欺骗和欺诈，产品卡应保留这一高风险提示。 |
| 1 | GitButler / `gitbutler` | GitButler / `gitbutler-desktop` | 编程开发 | [官方下载页](https://gitbutler.com/downloads)；[官方版本文档](https://docs.gitbutler.com/releases) | 下载页提供 Windows x86_64 MSI、stable 与 nightly 轨道；核验时稳定版为 2026-02-08 的 0.19.1，nightly 仍持续更新。[AI 辅助文档](https://docs.gitbutler.com/features/branch-management/ai-assistance)及版本记录确认 AI commit message 和 LM Studio 本地模型提供商。 | GitButler 会修改 Git 工作树、分支并可能触发 hooks，不得纳入 AI Hub 的自动命令执行。稳定版发布时间早于多数候选，先列优先级 1；AI 还取决于 API 账户或用户自备本地模型。 |
| 0 | AFFiNE / `affine` | AFFiNE / `affine-desktop` | 文档与知识库 | [官方下载页](https://affine.pro/download)；[官方 GitHub](https://github.com/toeverything/AFFiNE) | 下载页提供 Windows x64/ARM64，核验时稳定版为 0.27.3；[2026 年 7 月更新](https://affine.pro/blog/whats-new-july-update-2026)说明 0.27 桌面版、同步可靠性改进和实验性 AI BYOK，[项目下一阶段公告](https://affine.pro/blog/next-chapter-of-affine)确认项目继续运营。 | “local-first”只描述工作区架构，不能推出所有 AI 都在本地；实验性 BYOK 会调用用户选择的模型服务。AFFiNE 的 API/MCP 若后续录入，应作为生态资源关联同一产品。 |
| 0 | AppFlowy / `appflowy` | AppFlowy / `appflowy-desktop` | 文档与知识库 | [官方下载页](https://appflowy.com/download)；[Windows 安装文档](https://docs.appflowy.io/docs/appflowy/readme/install-appflowy) | 下载页明确提供 Windows 桌面应用；[What's New](https://appflowy.com/what-is-new)在核验时列出 2026-07-24 的 v0.13.0，包含桌面版、AI Overview、自托管部署的 Qwen 模型支持和同步改进；此前更新还列出 Windows AI meeting notes、转录与演讲者识别。 | 自托管模型支持不等于普通安装默认本地 AI；实际可使用云模型、第三方提供商或自托管部署。更新记录还提到 Windows 签名证书续签期间可能出现 SmartScreen 警告，录入前需重新核对当前签名状态。 |
| 1 | DuckDuckGo / `duckduckgo` | DuckDuckGo Browser / `duckduckgo-browser` | 浏览器与搜索 | [浏览器官方下载页](https://duckduckgo.com/app)；[Windows 安装帮助](https://duckduckgo.com/duckduckgo-help-pages/get-duckduckgo/get-duckduckgo-browser-on-windows) | 官方页面确认 Windows 10+ 浏览器、Microsoft Store/官方安装入口，并把 Duck.ai 作为可选的私密 AI 聊天能力，支持多个第三方模型及订阅模型。 | 这是“带可选 AI 的隐私浏览器”，不是独立的 Windows Duck.ai 客户端；应只建一张浏览器产品卡。Windows x86 支持将在 0.170.0 后结束，且不能保存帮助文档中的静态 MSIX 地址。 |
| 1 | Spark Mail / `spark-mail` | Spark Mail / `spark-mail-windows` | 办公自动化 | [Windows 官方页](https://sparkmailapp.com/windows)；[官方下载页](https://sparkmailapp.com/download) | Windows 页确认 Spark +AI 可生成、改写、总结邮件和模板；[AI Assistant 文档](https://sparkmailapp.com/help/spark-ai/ai-assistant)确认 Windows 支持搜索、日历和邮件辅助，并说明本地邮件索引及发送给 AI 提供商的数据范围。 | 必须使用 `spark-mail` 等专用 ID，避免与目录中其他 Spark 产品碰撞。官方文档明确 AI 在中国大陆不可用；相关邮件会发送给受信 AI 提供商并最多保留 30 天，必须显式提示地区、邮箱授权、额度与云处理。 |
| 0 | Canary Mail / `canarymail` | Canary Mail / `canary-mail` | 办公自动化 | [官方下载页](https://canarymail.io/downloads)；[功能页](https://canarymail.io/features) | 下载页提供 Windows 10+ Microsoft Store 入口；[What's New](https://canarymail.io/help/whats-new)和[官方发布公告](https://roadmap.canarymail.io/announcements)在核验时列出 2026-07-08 的 Windows 5.1.56，包含 Gmail 设置、邮件查看、PGP、渲染和稳定性修复。功能页把 AI 写作和总结标为可选能力。 | 需要访问邮箱、联系人和可能的 Microsoft Store/MSIX 流程；AI Copilot、额度和云处理应单独说明。版本页面比下载页更适合维护证据，但产品入口仍应指向官方下载页。 |
| 0 | Movavi / `movavi` | Movavi Video Editor / `movavi-video-editor` | 视频创作 | [Video Editor 2026 官方页](https://www.movavi.com/video-editor-plus/)；[版本更新页](https://www.movavi.com/video-editor-plus/whats-new.html) | 官方页列出 Windows/macOS、AI 自动字幕、降噪、背景移除、运动跟踪和静音删除；核验时当前版本为 26.20，更新日期 2026-07-20，版本页同时列出 7 月与 6 月的连续更新。[AI 功能说明](https://help.movavi.com/kb/license-usage-rules/ai-features-in-movavi)可作能力边界证据。 | AI 能力会受版本、套餐、试用和在线服务限制；不能将全部效果宣传为免费或离线。Windows 要求为 64 位 Windows 10/11，只打开官方产品页。 |
| 1 | Corel / `corel` | CorelDRAW Graphics Suite / `coreldraw-graphics-suite` | 图像与设计 | [CorelDRAW Graphics Suite 2026 官方页](https://www.coreldraw.com/en/product/coreldraw/)；[官方更新页](https://www.coreldraw.com/en/support/updates/) | 产品页明确支持 Windows/macOS，并列出 Artist Intelligence 驱动的 AI Generate、生成式重混、背景移除、对象选择和蒙版；[2026 新功能教程](https://www.coreldraw.com/en/learn/tutorials/new-in-march-2026/)提供功能证据，更新页在核验时列出 2026-07-14 的 v27.1。 | 这是含 AI 的完整专业设计套件，不是 AI 单功能工具；订阅与一次性许可均使用 AI credits，不能描述为无限或完全本地。应保留 CorelDRAW 套件身份，不拆成多个 AI 产品。 |

## 关键产品关系与去重规则

- screenpipe 的本地 API/SDK、AFFiNE 和 AppFlowy 的自托管或接入能力，以及 GitButler 的本地模型提供商，只能作为同一产品的能力或生态资源关系，不能重复创建一个 `ai-connectable` 产品。
- Duck.ai 是 DuckDuckGo Browser 内的可选 AI 能力，本批不建议再建一个同名 Windows 产品。
- Spark Mail 必须使用带 `mail` 的厂商与产品 ID。当前目录含 Google Gemini Spark、Genspark、讯飞星火等无关产品，字符串相似不是同一厂商。
- UPDF 的发布者为 Superace Software，但用户面对的长期品牌和域名均为 UPDF；建议厂商显示名用 UPDF，在描述中记录发布者，不另建 Superace 产品卡。
- Vrew 的当前品牌由 VoyagerX 提供；厂商关系可记录在描述中，但主产品卡保持 Vrew，避免用户需要用公司名寻找产品。
- FineVoice 已从旧 FineShare 域名迁移到 `finevoice.ai`，旧域名只能作为历史别名，不可作为新卡片入口。

## 排除或暂缓

| 候选 | 结论 | 原因 |
| --- | --- | --- |
| PaintShop Pro | 暂缓 | 现有第八批研究已指出官方公开主产品与更新资料主要停留在 2023，不能把仍可购买等同于当前积极维护。 |
| NVIDIA ChatRTX | 排除 | 现有研究已确认停止或废弃，不能因历史 Windows 安装页面再次纳入。 |
| Superhuman Docs | 暂缓 | 官方资料截至本次核验仍只确认 macOS，Windows 尚未提供，缺少可落地的 Windows 官方入口。 |
| Superhuman Go | 暂缓 | 与 Grammarly/Superhuman 品牌迁移和产品身份存在重叠，尚不足以支持单独的稳定 Windows 卡片。 |
| Dia Browser | 暂缓 | 未找到厂商确认的 Windows 正式下载页。 |
| Faraday.dev、SillyTavern、RisuAI、ChatALL、NextChat、PearAI | 暂缓 | 当前 Windows 长期维护入口、产品身份或近期一手维护证据不足；不采用第三方下载页补证。 |
| Anytype AI | 暂缓 | Windows 产品本身成立，但本次没有收敛到足够明确且当前的官方 AI 能力证据。 |

## 录入前的最后核验门槛

1. 再次读取最新 `catalog-v1.json`，同时检查厂商 ID、产品 ID、显示名、旧品牌名、官网域名和资源关系，避免与并行批次重复。
2. 在真实浏览器中从厂商产品页走一遍“Windows 下载”导航，确认仍然落到厂商域名或官方应用商店；只记录页面入口，不记录最终版本化安装器。
3. 重新核对 Windows 版本、CPU 架构、GPU/VRAM、麦克风/屏幕/邮箱权限、虚拟驱动和账户要求，并将其作为静态提示，不在用户浏览卡片时运行环境探测。
4. 单独核对 AI 是否需要网络、上传内容、订阅/credits、BYOK、第三方模型、区域可用性或组织管理员开关；“应用可离线”不能推导为“AI 也离线”。
5. 对 Voice.ai、FineVoice、screenpipe、会议转录和邮件工具加入授权与敏感数据提示；对 GitButler 加入代码仓库修改和 hooks 风险提示。
6. 自动化校验只能证明目录字段、链接格式和路由策略符合约束，不能代表安装器、账户登录、Windows SmartScreen、音频设备或用户机器上的实际验收已经完成。

