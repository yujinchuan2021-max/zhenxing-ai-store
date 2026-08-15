# 枕星 AI PC 开发状态

更新时间：2026-08-04

## 已实现并通过自动验证

- catalog schema v2 的厂商第一层目录信息架构；厂商资料只保存一份。
- “全部 AI 厂商”和“全部 AI 可接入厂商”由已启用产品的 `directoryKind` 投影，同一厂商在两个页面只显示各自相关产品。
- 375 个厂商、614 个一级产品的后台目录；同一可视化产品的官网、Web 与 Windows 入口集中在一张卡片，CLI 保持独立。
- Skill、MCP、插件和连接器使用顶层资源记录与独立商店，按“资源类型 → 目标工具 → 资源列表 → 单项详情”展示；目标工具卡同时显示厂商与产品，产品页不再维护扩展子目录。
- 146 个顶层生态资源；尚无固定客户端配置的资源只打开官方说明，不显示一键安装。
- 首批固定资源模块已经闭环：Codex Skill、OpenAI Developer Docs MCP 的 Codex/Claude Code/Cursor 三宿主独立配置，以及 Claude Code 插件，共 5 个本地 profile 支持检测、安装、更新、修复和精确卸载，适用时还支持启用/停用；“已安装”页枚举全部固定 profile，主收据缺失但实例标记仍在时也不会漏掉恢复入口。
- 后台新增资源目标默认标记为“协议兼容”，不得在未完成真实验证时默认标记“已验证”；PC 资源卡展示兼容性、发布者、版本、权限、凭据、安装范围、卸载方式、最后核验时间和来源证据。
- Web、普通桌面、已审核桌面、CLI、本地模型和教程的统一路由策略。
- 后台厂商、产品、生态资源、来源/目标关系的编辑、排序和启停，以及发布前校验、签名发布、历史版本和回滚。
- 下载源选择、代理识别、断点续传、磁盘预检、哈希校验和任务恢复。
- 托管下载在系统代理切换后关闭旧连接并按当前系统网络重新建连；用户已在 `0.1.21` 手动确认真实下载恢复。
- 仅 Microsoft Store 引导器产品在启动前提示关闭 VPN/代理；仍打不开时，用户可主动运行固定的商店检查与修复入口。普通官网直装产品不显示该提示，客户端不会自动改代理、服务、注册表或 Appx。
- 已审核桌面产品的托管下载、校验、安装器调起、安装后复检和安全卸载协议已由自动化覆盖；自动化没有运行第三方安装器。
- 170 个 Windows 产品已有客户端固定执行合同（目录中的 169 个 `desktop-reviewed` 产品，加上本地模型模块管理的 Ollama）；后台产品页区分待审核、已审核和已实机验收，状态变化保留历史，待审核产品不能发布安装能力。
- 完整执行契约覆盖下载计划、检测与签名身份、打开/卸载适配器和生命周期策略；任一执行字段变化都会使旧验收失效。
- ChatGPT Desktop、Claude Desktop、Comfy Desktop 与 Ollama 的官方分发策略已按当前厂商一手资料复核，并锁定消费者入口、来源域名和签发者契约。
- Cursor 3.14.7、Kimi Work 3.1.6、千问 3.7.5.145 与 WorkBuddy 5.3.8 的当前官方实包已完成大小、SHA-256、VersionInfo 与 Authenticode 身份复审；滚动最新版的哈希只作为当次审计证据。
- Jan 0.8.4、Visual Studio Code 用户版与 Zed 1.13.2 已进入同一桌面受管模块；三者均固定官方来源、签名者、安装器身份、安装检测、打开、更新归属、交互式卸载和数据保留策略。Cherry Studio 与 DeepChat 因当前官方 Windows 包未签名继续保留官方下载，Windsurf 因官方身份迁移至 Devin Desktop 暂缓纳管。
- QoderWork CN、ima、LM Studio、GPT4All、AnythingLLM Desktop、Kiro IDE、NVIDIA AI Workbench 与 OpenCode Desktop 已补齐真实包静态身份和生命周期合同；Comet 当前公开 REST 地址返回 HTML 而非安装包，因此保留官方页面。全部 266 个桌面记录都有明确的受管或官方入口判定，后台字段不能绕过客户端准入门。
- Msty Go 与 Letta 使用统一的安装所有权收据模块：启动安装器前记录全部卸载项键，安装后只接管本次操作产生的唯一新增项，并再次校验主程序和卸载器签名；既有手动安装只显示为外部安装，不会被枕星 AI 冒领。
- 34 个固定受管 CLI 共用隔离安装、更新、修复、命令窗口启动与收据所有权卸载模块；Aider、OpenFang、ZeroClaw、IronClaw、Open Interpreter 与 Auggie 已分别接入固定 Python 3.12、二进制、MSI 或 WSL 驱动。目录中其余 11 个候选已记录明确阻断原因，只保留真实官网、教程或源码部署入口。
- CLI 任务中心保存原始安装、更新、修复或卸载意图，失败重试不会退化成另一种动作；后台只能在客户端固定能力集合内逐项关闭能力。
- 邮箱验证码注册、登录、访问令牌、刷新会话、退出和设备会话撤销。
- 统一个人中心通过单一接口管理昵称、个签、头像、邮箱、手机号、密码、账号与社区提醒、Flarum 原生收藏和喜欢；PC 右上角统一提供账号与提醒入口。
- 个人中心已统一提供用户精确查找、关注、粉丝、一对一私信、系统站内信和 Flarum 阅读记录；用户私信、系统站内信与社区提醒保持独立名称和未读计数。
- 用户关注与私信由统一身份服务保存，粉丝由关注关系反向投影；讨论关注、喜欢、社区提醒和阅读记录仍以 Flarum 为唯一事实源。
- 所有用户都按不可变用户 ID 确定性生成稳定的 Flarum 技术映射名；既有论坛账号首次按身份邮箱安全认领，随后通过固定身份链接绑定论坛用户 ID，更换邮箱不会创建新社区账号。社区只展示统一昵称和头像，不暴露技术映射名。
- 封包客户端只读取受门禁校验的固定身份与社区地址；正式包要求非回环 HTTPS，本地验收包使用固定回环地址，开发模式才允许环境变量覆盖。
- 60 秒、单次使用、不可重放的社区登录票据。
- Flarum 内嵌 PC、自动建号、发帖和回复链路。
- Docker 本地数据库、账号、邮件测试、社区、后台和 HTTPS 发布服务。
- Windows Portable、NSIS、升级以及隔离安装/卸载验收工具。
- Windows 安装、升级、用户数据保留和卸载的隔离验收工具；`0.1.37` 为历史本地评审版本。
- `0.1.36` Local Setup 与 Portable 已生成并写入制品哈希清单。隔离 Portable 已读取签名目录 v70，并分别完整接收 QoderWork 252,233,192 bytes 与 OpenCode 124,337,464 bytes；两个任务都通过 SHA-256、有效 Authenticode 签名、PE 与 VersionInfo 身份校验。本轮没有执行第三方安装器；`0.1.35` Setup 的隔离安装/卸载验收结果不冒充新包或第三方产品验收。
- `0.1.37` Local Setup 与 Portable 已生成；包内源码与当前工作区一致，Portable 已从包内完成账号登录，并读取个人中心、关注/粉丝和私信会话。该制品为未签名、脏工作区生成的本机验收包，不作为正式发布包。
- 安装包构建来源清单：版本、Setup 与 Portable 制品字节、Git 提交及工作区状态会一起进入由更新密钥签名的来源证明；生产发布只接受干净且带同版本标签的源码。
- 隔离 Portable 发布门禁通过真实页面按钮读取远程签名目录、检查签名更新、安装/卸载扩展，并真实下载至少 1 MiB 后确认暂停状态和对应 `.part` 文件。
- 一键本地发布会从同一个带版本标签的 Git 提交离线、无缓存构建后台、身份与社区候选镜像，逐文件比对提交清单和候选容器 SHA-256；候选通过后才统一提升为活动镜像。日常目录发布还会在写入前比对宿主与正在运行的后台容器源码，旧镜像或缺失文件会直接阻断发布。
- 本地发布使用统一可回滚事务：测试、构建和依赖审计在切换前执行；交付目录、运行时和三个服务镜像共享主日志，验收后封存三份子收据哈希，切换或收尾失败会精确恢复上一版本并保留不确定现场。
- Docker 发布目录 v5/v4 回滚与恢复，以及后台活动目录 v10 的原子发布。
- 发布策略升级时可用精确草稿版本替换已过时草稿；旧发布包仅可做签名与完整性备份，不能绕过新策略恢复。

## 当前本地服务

| 服务 | 地址 | 状态用途 |
| --- | --- | --- |
| 后台管理 | `http://127.0.0.1:4173` | 目录与发布管理 |
| 身份服务 | `http://127.0.0.1:4180` | 用户、个人中心与社区凭据 |
| Mailpit | `http://127.0.0.1:8025` | 本地验证码邮件 |
| Flarum | `http://127.0.0.1:8088` | 本地社区 |
| HTTPS 发布源 | `https://localhost:4443` | 签名目录与客户端更新 |

社区入口由 PC 客户端直接调用统一身份服务，不依赖目录中的旧 `community.enabled` 展示字段。用户未登录时先进入登录流程；登录后客户端校验社区 origin、路径和一次性凭据，在隔离分区内直接显示 Flarum，不再打开系统浏览器。

当前权威草稿为 revision 84：375 个厂商、615 个一级产品、146 个顶层生态资源、3 张 `homeCarousel`、14 项 `desktop-download-only` 与 Anytype `cli-deploy-only`。v1 active 保持 catalog v72；v2 active 为 catalog v1。schema v2 在不复制厂商或资源记录的前提下提供双目录视图和四个资源商店；客户端仅接受签名目录与固定本地 profile，草稿本身尚未改变 v1 active。

## 热门 Agent 扩充

- 使用官方站点、官方文档和官方仓库复核并新增 44 个厂商、62 个产品，覆盖 OpenHands、AutoGPT、Agent Zero、Browser Use、Skyvern、DeerFlow、UI-TARS、Letta、NemoClaw、Google ADK、LangChain Deep Agents、RAGFlow 等当前 Agent 产品与框架。
- 4 个明确的 Windows 图形产品使用 `desktop-official`，14 个托管平台使用 `web-link`，23 个 CLI 使用 `cli-official`，21 个框架或自托管项目使用教程模块；没有赋予后台任意命令或安装包下发能力。
- Hermes Desktop 与 Hermes Agent 已存在并保持正确拼写；OpenHands 当前按 Cloud 与 Agent Canvas 建模，UI-TARS Desktop 与 Agent TARS CLI 分开，Letta 的可视化产品与 CLI 分开。
- 已归档的 Roo Code、AgentGPT 不进入目录；Fellou 在取得稳定 Windows 官方交付证据前继续暂缓。完整研究与来源记录见 `docs/research/2026-08-03-popular-agent-expansion.md`。
- 本地后台已发布目录 v54；5174 客户端实页精准搜索 Hermes、OpenHands、UI-TARS、DeerFlow 与 Letta 均只返回对应厂商和产品，页面无控制台错误。

## 行业 AI 产品扩充

- 使用厂商官网和官方文档新增 29 个厂商、35 个产品，覆盖工程设计、科研分析、法律、客户服务、音视频创作和商业数据；Autodesk、Siemens、Trimble 与 Clarivate 继续复用原厂商资料。Altair AI Studio 已按 Siemens 官方品牌迁移说明改为 Siemens 旗下 Rapidminer AI Studio，没有保留过时厂商关系。
- 17 个 Windows 图形产品统一调用 `desktop-official`，18 个在线产品调用 `web-link`；全部只包含官方入口和教程，没有增加后台命令、安装包直链、本地探测或安装 profile。Genesys Cloud CX 的 Windows、官网和开发者入口保持在同一产品卡，Spellbook 明确标为 Word 加载项而不是独立桌面应用。
- 13 个产品进入“全部 AI 可接入厂商”，22 个进入“全部 AI 厂商”；AutoCAD、Revit 等工程产品按“3D 与工业仿真”展示，Genesys、Dialpad 等按“客户服务”展示，Audacity 与 Streamlabs 分别按“音频制作”和“直播与录制”展示。
- 完整性测试固定 311/505/118 基线、全部 35 个新增产品身份和安全模块边界；精准搜索固定 AutoCAD、Scopus with AI、CoCounsel、Spotter 与 Navicat 不带出无关厂商。
- BricsCAD 已按当前品牌迁移到 Octave；Scopus 使用当前 `Scopus with AI` 名称；SOLIDWORKS、Designcenter、Tekla、Lexis+ with Protégé、Harvey、scite、Relativity 与 Freddy 的入口角色已按官方产品页和用户文档纠正。
- 本地后台已签名发布目录 v56、草稿修订 59；最终 109 个去重官方入口中 103 个直接可达，6 个由厂商 WAF/访问策略拦截，没有真实 404/410。
- 5174 客户端实页显示 233 个 AI 厂商和 94 个 AI 可接入厂商；AutoCAD 只返回 Autodesk，Rapidminer AI Studio 只返回 Siemens，旧 Altair AI Studio 无结果。可接入目录已显示 3D 与工业仿真、客户服务、音频制作、直播与录制等分类，控制台无错误。

## 尚需真实环境或用户验收

- 在用户日常 Windows 账户下继续完成整套客户端升级和卸载验收；`0.1.21` 的托管下载、网络重连与安装器调起已经手动通过。
- 在用户日常 Windows 账户下逐款完成 170 个受管 Windows 产品的安装、首次启动、安装后探针、厂商更新、交互式卸载与数据保留验收；直接安装合同页当前为 38 个已审核、0 个已实机验收，另有 132 个固定包管理器合同。
- 对 34 个受管 CLI 及首批 Skill/MCP/插件继续完成用户日常账户下的网络、权限、登录、厂商服务、更新、修复和卸载验收；本轮新增的 npm、二进制、Python、MSI 与 WSL 安装模块已完成自动或隔离实包验收，Auggie 的真实 WSL 登录与交互仍留给用户机器验收。
- 接入正式 SMTP 并验证公网邮件送达率。
- 配置正式身份与社区 HTTPS 地址后再开放生产封包；当前缺少正式地址时门禁按设计停止封包。
- 选择服务器、生产域名、TLS 证书、数据库备份策略和监控告警。
- 购买并接入 Windows 代码签名证书。
- 生产密钥托管、发布审批和外部安全评估。

## 本地发布候选回归

以下自动化项目已经完成：

1. 两用户注册与会话、用户关注、粉丝投影、一对一私信、系统站内信、Unicode 社区用户名映射、Flarum 阅读记录和内嵌登录端到端回归。
2. 目录、安装模块、下载恢复和卸载策略全量单元测试。
3. 本地 HTTPS 发布包重新生成并验证客户端读取。
4. Windows 安装包重新构建并执行隔离安装、升级和卸载验收。
5. `0.1.36` 评审包的全量单元测试、TypeScript 检查和生产构建通过，`npm audit --audit-level=low` 为零漏洞；打包 Portable 接受远程签名目录 v70，并在完整下载重放中分别通过 QoderWork 252,233,192 bytes 与 OpenCode 124,337,464 bytes 的 SHA-256、Authenticode 和 PE/VersionInfo 身份校验。这是历史记录。
6. 当前本地评审包为 `release-review-0.1.45-candidate/ZhenXing-AI-Local-0.1.45-Windows-x64-Portable.exe`，大小 85,778,463 bytes，SHA-256 `2756b2ed4b668c5fb7ebb05ef21de040fd63702fad4f958d8083e6e9e6e83300`。自动门禁已验证 v2 签名目录 catalog v1、375 个厂商、615 个产品和 283 张实际厂商卡片；该包未安装、未上传，且不等同用户机器验收。
7. DeepL 官方包已进入 `downloading`，但原生取消确认与 Anytype CLI 隔离目录选择仍因 Windows 自动化无法激活目标窗口而待用户手动验收。

本轮自动化收口完成后，只保留用户日常账户下的真实安装、第三方安装器交互和卸载行为验收。
-
## 当前事实校正（2026-08-06）

本节以今日权威事实源覆盖本文前面仍保留的历史数字、旧版本和验收表述；历史研究不删除。

- 当前目录事实源是 `pc-client/admin/published/catalog-store/state.json`：draft revision `89`，更新时间 `2026-08-05T18:11:35.916Z`，草稿为 615 个一级产品；不要继续把 revision 84、614 个产品或 `0.1.40` 当作当前状态。
- `pc-client/docs/acceptance/v2-active6-0.1.54-full-validation-2026-08-06-final.md` 记录的是 0.1.54 / v2 active6 的 265 行桌面自动验证：`PASS=98`、`BLOCKED=167`、`FAIL=0`。这是自动化/隔离证据，不是 98 个用户实机通过；原生取消确认仍需真实 Windows 用户决定。
- `pc-client/docs/acceptance/cli-agent-draft89-coverage-matrix-2026-08-06.md` 记录 draft89 的 CLI/Agent 覆盖矩阵：32 个 managed-ready、2 个 managed partial、1 个 deploy-only、13 个 official-only blocked。矩阵和 CLI 测试是自动化合同覆盖，不等于真实网络、权限、登录、安装、更新、修复或卸载验收。
- 四个资源商店审计均为只读审计：MCP、Skill、Plugin、Connector 仍需按各自官方来源、宿主关系、权限和安装 profile 继续复核；审计未调用 `saveDraft`、未发布，也没有把资源提升为一级 AI 产品。连接器当前仅有官方页面/教程跳转，未完成真实授权、连接和断开验收。
- 当前仍需用户验收：真实 Windows 账户下的桌面安装/启动/取消/卸载/数据保留、CLI 的真实网络与权限生命周期、资源商店真实宿主授权及相关外部服务条件。
