# 官方产品覆盖不完整

## 现象

客户端目录遗漏 Kimi Work、Kimi Claw、Kimi WebBridge 和 OpenClaw 一键部署等已经存在的官方产品或产品形态；仅靠逐厂商手工搜索容易漏掉官网二级入口和后来发布的新产品。

## 根因

已有研究导入流程依赖一次性 Markdown 清单，没有可重复运行的官方站点发现步骤，也没有把“现有目录与官网导航、产品页和 sitemap 的差异”作为发布前输入。

## 修复

- 增加只访问目录中官方来源域名的产品发现脚本。
- 对 GitHub、npm 等共享托管域名限定到现有厂商仓库或包路径，禁止横向抓取其他发布者。
- 输出已匹配、待审核和请求失败三类结果，并保存证据 URL。
- 自动发现结果不得直接发布；产品类型、生命周期、安装和卸载策略仍须审核。
- 后台新增“产品候选”审核队列，支持固定参数扫描、每 24 小时定期扫描、忽略、恢复和加入停用草稿。
- 候选确认接口只允许 Web、官方下载、官方 CLI 说明和教程四种无本地执行模块；不能从抓取结果创建一键安装配置。
- Kimi 与 OpenClaw 的已确认产品通过正式目录导入和本地安装白名单单独落库。
- CLI 候选增加第二层安装审计：Qoder CN CLI 已以固定 npm 包、版本、Node 20 门槛和本地设置策略进入白名单；Antigravity 已进入固定二进制适配器；Cursor 因 Windows 仅支持 WSL 且缺少发布哈希继续保留官方入口。
- Kimi Code CLI 已从旧版官方说明入口升级为原生 Windows 受管产品：复用固定二进制模块，按 x64/ARM64 固定 `0.31.1` 和 SHA-256，安装点击后才检测 Git for Windows。
- 固定二进制模块的完整性接口已从单一 SHA-512 深化为客户端白名单声明 SHA-256 或 SHA-512；旧 Antigravity SHA-512 收据继续兼容，后台仍看不到 URL、哈希或命令。
- Kimi 启动时设置 `KIMI_CODE_NO_AUTO_UPDATE=1`，并以保守 TOML 合并方式把 `%USERPROFILE%\.kimi-code\tui.toml` 的 `[upgrade].auto_install` 固定为 `false`，不覆盖其他用户配置。

## 验证与预防

- 纯函数测试覆盖官方域名边界、共享托管路径边界、HTML/sitemap 提取、已有产品匹配和候选分类。
- 审核模块接口测试覆盖跨厂商 URL 拒绝、决定状态持久化、旧报告标记、默认停用入库和本地执行模块拒绝。
- 真实 Docker 后台扫描覆盖 49 个厂商和 146 个官方页面；降噪后留下 7 条人工候选，报告与当前草稿时间戳一致。
- 浏览器实际点击验证了候选筛选、忽略和恢复；恢复后审核状态文件没有留下测试决定。
- 后续补录前运行 `npm run catalog:discover`，将待审核清单作为研究输入。
- 正式发布继续通过目录结构校验、客户端本地模块白名单和签名发布流程。
- Qoder `@qoder-ai/qodercli@1.1.9` 已在隔离 prefix 中使用 `--ignore-scripts` 实装并执行 `qodercli --version`，返回 `1.1.9`；客户端启动前只合并 `general.enableAutoUpdate=false`，不覆盖其他用户设置。
- Antigravity Windows x64 官方产物已真实下载：170,597,528 字节，SHA-512 与 Google 发布清单完全一致，设置 `AGY_CLI_DISABLE_AUTO_UPDATE=true` 后执行 `agy.exe --version` 返回 `1.1.9`。客户端不执行远程 `install.ps1`/`install.cmd`，卸载只处理受管目录和收据。
- Kimi 目录变更首次通过 API 保存时被旧 Docker 后台拒绝，证明后台本地白名单版本必须先于目录发布更新；重建 admin 容器后，发布前校验通过并签名发布目录版本 21。以后新增本地安装配置时，把“重建后台并验证 `/api/product-modules` 返回对应 `installProfiles`”作为发布前门槛。
- Kimi Windows x64 官方产物已真实下载：133,023,744 字节，SHA-256 为 `50e7aaa5db973553871e617af76df7470d305c36954298928a86f9ecdcd3ce5a`，设置 `KIMI_CODE_NO_AUTO_UPDATE=1` 后执行 `kimi.exe --version` 返回 `0.31.1`；临时验证文件已删除。

## Windows 桌面端收口

- 根因不只是目录遗漏：目录中的桌面产品此前只有少数产品接入客户端本地执行白名单，另有若干网页功能、教程和 CLI 被误标成桌面安装项，因此后台即使补了产品，前台也不能安全地直接复用安装能力。
- 新增集中式 Windows 桌面产品白名单，统一声明产品、官方 HTTPS 安装包、允许域名、发布者签名、固定版本哈希、检测、打开、卸载和磁盘预算；后台仍只能引用已批准模块，不能下发 URL、哈希或命令。
- 本轮新增 22 个受管 Windows 桌面产品定义；连同既有 ChatGPT、Claude、Comfy 和 Ollama，客户端共有 26 个本地受管的一键安装产品。目录中另有 Microsoft Copilot Windows 客户端保留为 Microsoft Store 官方入口，不伪造无法稳定校验的独立安装包。
- WSL 从产品目录移入环境模块。NVIDIA AI Workbench 等依赖产品点击安装后，客户端先按本地白名单检测 WSL、Docker、Git 等环境，依次安装缺失项，等待可信安装证据，再自动继续原产品安装。
- 桌面安装包下载完成后同时校验本次下载哈希、可选固定版本哈希和 Authenticode 发布者签名；任何一步不匹配都不会启动安装器。
- 后台目录已校验并发布为版本 23，共 49 个厂商、147 个产品，其中 25 个 `desktop-reviewed`、1 个 `desktop-official`；客户端实际启动后已读取到同一目录并显示新增桌面产品。
- 自动验证通过：338 项测试、TypeScript 检查和 Vite 生产构建均通过。Windows UAC、第三方安装向导及重启后的真实产品检测仍保留为用户设备验收项，不能由自动测试替代。

## 仍需人工验收

自动发现只能证明官方页面存在，不能单独证明它是独立产品、仍在售、具备 Windows 客户端或适合一键安装；这些结论必须依据官方产品页和安装文档复核。

## 2026-08-03 AI 工具第五批扩充

- 研究记录位于 `docs/research/2026-08-03-vendor-expansion-batch5.md`，所有产品边界使用厂商官网、官方文档或官方帮助中心复核，不把普通 favicon、第三方图标和搜索结果当作品牌证据。
- 新增 Replit、StackBlitz / Bolt、Lovable、Brave / Leo、Tabnine、Ideogram、Recraft、Luma AI、HeyGen、Synthesia、IBM watsonx、Deepgram、Pinecone、Oracle 和 SAP 共 15 个厂商及 15 个产品。
- 目录基线达到 183 个厂商、320 个产品、113 项生态资源；12 个新产品进入 AI 工具目录，Pinecone、Oracle 和 SAP 进入 AI 可接入目录。
- Brave Leo 明确归入 Brave Browser，不伪造独立安装器；Tabnine 只打开受支持 IDE 的官方安装说明；其余 Web 平台直接打开官方产品入口。
- 新厂商在没有确认第三方目录展示授权前统一使用审核文字回退。扩充脚本重复执行保持 183/320/113，不复制厂商或产品身份。
- 本地后台通过完整校验并签名发布目录 v48；开发客户端真实页面已显示新增厂商、精准 AMD 搜索结果和四个资源商店。本轮未重新封装 PC 安装包。

## 2026-08-02 第二轮 Windows 图形产品普查

- 原有 49 个厂商、142 个产品只是首轮样本，不能作为“全部 AI 产品”的完成口径。本轮按海外产品、中国产品、Agent/开发/本地模型三路并行，以厂商官网、官方帮助、官方文档和官方 GitHub/Release 做了一手来源复核。
- 研究结论记录在 `docs/research/2026-08-02-windows-desktop-product-expansion-second-pass.md`；Web 与 Windows 属于同一可视产品时合并为一张产品卡，CLI 继续单列。
- 高置信批次新增 51 个厂商、79 个产品，并调整 Open WebUI、Perplexity 和剪映/CapCut 入口；目录现为 100 个厂商、221 个产品。
- 新增图形产品全部先使用 `desktop-official` 固定模块，只打开厂商官方下载入口；没有安装白名单、下载参数、命令、环境探测或自动卸载权限。Skales、NextChat、ChatALL、PearAI 等待复核项及已停更/无 Windows 证据项目没有进入正式目录。
- 本地 Docker 后台校验后发布目录版本 35：100 个厂商、221 个产品、24 个扩展资源。客户端开发目录加载器实读版本 35，并确认 Poe、Hermes Desktop 已出现且 Skales 未混入。
- 目录与策略定向测试 35/35 通过；生产构建和 Electron 布局验收通过，实际渲染 100 张厂商卡，新增中文、数字和英文厂商均能进入对应 A-Z 分组。
- 后续每轮继续先运行自动发现，再做人审和来源分级；只有逐产品完成下载、签名、检测、启动、更新与卸载审计后，才允许从 `desktop-official` 升级到 `desktop-managed`。

## 2026-08-02 AI 可接入厂商第三批扩充

- 官方资料审查记录在 `docs/research/2026-08-02-connectable-dev-productivity-batch3.md` 与 `docs/research/2026-08-02-connectable-industry-science-batch3.md`。本轮新增 GitLab、Salesforce、ServiceNow、Terraform、Pulumi、BrowserStack、CircleCI、ClickUp、Box、Pipedream、Make、Zoom、Shopify、Wolfram、Ansys、Cesium、Siemens、Esri、Synopsys 等能力，并复用已有 Microsoft 与 Google 厂商资料。
- 目录现为 158 个厂商、292 个产品、101 项生态资源，其中 70 个产品属于“AI 可接入厂商”。新增资源全部保持 `resource-link`，没有后台命令、任意包地址或自动安装 profile。
- Google Workspace 按 Gmail、Drive、Docs、Sheets、Slides、Calendar、Chat、People 拆成 8 个真实资源；Wolfram Local 与 Cloud 也分开。PTC Onshape MCP 仍是“即将推出”，只保留研究记录；设备控制社区演示没有冒充厂商正式能力。
- 首次录入暴露出四个会造成“后台有数据、前台没出现”的复发条件：资源 target 误指向 `ai-connectable` 产品；compact example 不含正式目录已有的 Microsoft/Google；示例目录没有任一兼容 AI 宿主时资源会被过滤；目录总量与类型断言仍停留在旧基线。
- 修复后，资源目标只允许已存在的 `ai-tool` 产品；扩充脚本为正式目录复用厂商、为 compact example 幂等补齐最小厂商资料；每项资源至少覆盖示例目录已有宿主；完整性测试同步约束 158/292/101 新基线。
- 扩充脚本连续执行后正式目录、示例目录和 Logo 兜底清单 SHA-256 均保持不变。29 个暂无明确可用官方图形资产的厂商进入审核兜底清单，不允许随意抓取搜索图片或第三方 Logo。

## 2026-08-02 AI 可接入厂商第四批扩充

- 官方资料审查记录在 `docs/research/2026-08-02-connectable-cloud-data-business-batch4.md`。本轮补入 Databricks、Snowflake、Redis、Neo4j、Confluent、PayPal、Wix、Automattic / WordPress.com、Semrush 与 Intercom；同时为已有 Microsoft Azure 和 Amazon Web Services 补齐 AI 可接入产品卡，不重复创建厂商。
- 目录现为 168 个厂商、305 个产品、113 项生态资源，其中 83 个产品、75 个厂商属于“AI 可接入厂商”。新增 12 项资源全部为官方 `resource-link`，没有后台命令、任意 URL、安装包或自动部署权限。
- Confluent Global / Regional 按端点、Key 与数据范围拆成两项资源；Intercom Platform / Fin 按产品边界拆开。Databricks、Snowflake 等动态端点只提供官方说明，后台不能保存用户的账号地址、数据库地址或自定义 MCP URL。
- 本轮复发并修复了 compact example 的宿主过滤问题：正式目录已有 AWS 厂商而示例没有，且 Confluent 官方宿主列表未包含示例唯一宿主。扩充脚本现在为缺失厂商补最小资料，并允许资源对标准 MCP 宿主声明 `protocol-compatible`，而不是把协议兼容冒充厂商官方适配。
- 完整性基线同步更新为 168/305/113；扩充脚本连续执行后正式目录、示例目录与 Logo 兜底清单哈希保持不变。资源目标继续只允许 `ai-tool` 产品，Semrush 明确不再挂载已停止支持的 Gemini CLI。

## 2026-08-02 AI 工具与 Windows 入口第六批扩充

- 官方资料审查记录在 `docs/research/2026-08-02-vendor-expansion-batch6.md`。本轮新增 Gamma、Krea、Meshy、生数科技、PixVerse、Udio、Obsidian、Discord 共 8 个厂商，并为字节跳动、Microsoft、ClickUp、Slack、Miro、Linear、Zoom 补齐已确认产品或 Windows 入口。
- 同一可视产品的官网、Web 与 Windows 下载入口合并在一个模块中，不再用重复产品卡制造选择成本；CLI 仍保持独立产品，本批次没有扩充 CLI。
- 新增 Krea MCP、Krea Agent Skills、Meshy MCP、Meshy 3D Skill 和 PixVerse MCP 共 5 项官方资源。全部使用 `resource-link`，只打开官方说明，不下载依赖、不保存凭据、不由后台下发命令。
- 目录基线达到 191 个厂商、337 个产品、118 项生态资源和 405 条目标关系；其中 91 个产品、83 个厂商进入 AI 可接入目录。
- 扩充脚本连续执行后目录与 Logo 兜底清单 SHA-256 保持不变；完整发布测试、TypeScript 检查和 Vite 生产构建通过。本地后台签名发布目录 v49，草稿修订为 52。
- 五个新增图形 Logo 使用已核验的官方 GitHub 组织身份；Gamma、Udio、Obsidian 在未确认可复用方形品牌素材前保留审核文字兜底，避免再次把 favicon 或第三方图片当作厂商 Logo。
