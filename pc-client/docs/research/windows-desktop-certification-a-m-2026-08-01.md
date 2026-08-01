# Windows 桌面产品核验（A–M 组）

核验日期：2026-08-01（Asia/Shanghai）
核验范围：ChatGPT Desktop、Claude Desktop、剪映专业版、TRAE、豆包桌面版、TRAE SOLO CN、Comfy Desktop、Google Antigravity 2.0、Cursor、Kimi Windows 客户端、千问桌面版、Qoder CN IDE、QoderWork CN、腾讯元宝。
代码边界：本次只做资料与现状审计，没有修改任何产品代码或配置。

## 1. 方法与结论口径

- 只使用厂商官网、官方帮助/文档、官方 API、官方 GitHub、Microsoft Store/目录，以及这些页面实际指向的厂商下载域名。
- 对照文件：
  - `shared/windows-desktop-catalog.cjs`：本组通用 Windows 桌面产品的客户端执行白名单；
  - `shared/install-registry.cjs`：把桌面白名单投影成统一安装模块；
  - `admin/data/catalog-v1.json`：后台展示数据及重复保存的公开下载字段。
- 2026-08-01 对代码中锁定的 14 个安装入口做了在线可达性复核；除 Claude 因当前出口地区被 Anthropic 重定向到“区域不可用”外，其余锁定地址当时仍返回可执行文件。**可达不等于当前、不等于正确产品，也不等于安装后可管理。**
- 对锁定包的 PE 头与 Authenticode `WIN_CERTIFICATE` 做了只读抽样。表内“签名主体”表示本次看到的证书 Subject 线索；它不是厂商承诺的永久证书，也不替代 Windows 完整信任链、时间戳与吊销检查。
- `x86 wrapper` 只表示安装器外壳的 PE Machine；不能据此判断其最终安装的应用是 x86。许多 x64 应用使用 x86 NSIS/Squirrel/引导器。
- 没有官方依据的字段一律写 `unknown`，不根据 Electron、NSIS、Inno 等框架惯例猜测数据清理或静默参数。

结论：14 项中，**5 项存在会直接影响当前交付的高风险漂移**（TRAE Work 名称、Cursor 版本、Kimi 版本、千问中国版入口/版本、Qoder 版本标签），另有多项缺失官方系统要求、架构分支和数据保留提示。签名白名单本次没有发现主体错配，但签名主体不应被当作永久常量。

## 2. 必须优先处理的差异

| 优先级 | 产品 | 当前代码 | 官方当前状态（2026-08-01） | 影响 |
|---|---|---|---|---|
| P0 | 千问桌面版 | 固定 `2.3.1` 包；官网写 `qwen.ai`；类别为“编程开发”；文案含内部语句“仍按 B 处理” | 中国千问 PC 官方页面给出滚动入口 `download.qianwen.com/download/qianwenpc?...`，本次解析为 `QianwenPC_V3.7.5.145...x64.exe`；全球 `qwen.ai` 是另一条下载配置，返回 `Qwen-1.0.3.44...exe` | 当前把中国千问 PC、全球 Qwen Desktop 和编程产品形态混在一个条目；下载已明显过期，网站、类别和文案也不准确 |
| P0 | Kimi Windows 客户端 | 固定 `Kimi-Setup-3.1.5.exe` | Kimi Work 官方页内滚动入口 `appsupport.moonshot.cn/api/app/pkg/latest/windows/download` 本次重定向到 `kimi_3.1.6.exe` | 固定包已落后一版；产品官方名称是 **Kimi Work / Kimi 官方桌面客户端**，应以滚动解析+重新审核生成新锁定包 |
| P0 | Cursor | 固定 `3.13.25` x64 User Setup | 官方下载页当前 Latest 为 `3.14`，x64 User 实际重定向到 `CursorUserSetup-x64-3.14.7.exe`；同时提供 x64/ARM64、System/User 四种 Windows 变体 | 当前包过期，且只覆盖 x64 User；后台 `requirements` 为空，未表达架构/安装作用域 |
| P0 | TRAE SOLO CN | 产品名、描述和文件名仍为 `TRAE SOLO CN 0.1.43` | 官网下载中心显示 **TRAE Work**；`/solo` 已转向 `/work`；官方 API 的 `solo.win32` 实际文件名为 `TRAE_Work_CN-Setup-x64.exe`、版本 `2.3.62834` | 产品名称和用户认知错误；检测兼容别名可保留，但展示名、描述、站点和文件名必须改为 TRAE Work |
| P1 | Qoder CN IDE | 下载路径含 `1.20.1`，展示文件名写 `Qoder-1.106.3` | 官方发布日志当前产品版本为 `v1.5.0`；`1.106.3` 在官方日志中是 VS Code 内核版本，不是 Qoder 产品版本 | UI 把内核版本冒充产品版本；即使锁定包仍有效，也不能用该文件名向用户展示产品版本 |
| P1 | TRAE | URL/API 版本为 `2.3.62837`，展示文件名写 `3.3.83` | 官方 API 当前仍为 `2.3.62837` | 下载源当前匹配，但版本标签无法由官方 API 证明；应显示 API 版本或明确区分“应用版本/内核版本” |
| P1 | ChatGPT Desktop | 主入口正确，但 `requirements: []` | 当前主应用 Product ID `9PLM9XGG6VKS`；Windows 10 build 17763+，x64/ARM64；另有稳定 x64/ARM64 Store-signed MSIX | 安装前兼容性信息缺失；Web Installer 是引导器，不能拿引导器版本/路径判断主应用安装状态 |
| P1 | Claude Desktop | `requirements: []`；只呈现 x64 普通 setup | Windows 10+；官方另有 x64/ARM64 MSIX。完整 Cowork 需要管理员权限、Virtual Machine Platform 和重启 | “Claude 已安装”与“Cowork 可用”必须分开；当前依赖表达缺失 |
| P1 | Comfy Desktop | `requirements: []`，下载名固定写 x64 | 官方当前支持 Windows 10+、x64/ARM64；每个实例建议至少 4.85 GB，独显推荐但非必需 | 当前 15 GB 磁盘预留保守可接受，但后台没有公开系统/架构要求，且文件名暗示只支持 x64 |
| P1 | Google Antigravity 2.0 | 只锁定 x64，`requirements: []` | 官网当前为 2.4.3，提供 Windows x64 与 ARM64，最低 Windows 10 64-bit | 当前版本正确，但缺 ARM64 和系统要求 |
| P1 | QoderWork CN | 只锁定 x64 User，`requirements: []`，未呈现数据保留 | 官方同时提供 System/User；Windows 10 64-bit+、x86_64、500 MB、稳定网络；卸载后 `%USERPROFILE%\.qoderwork` 需手动删除 | 用户无法看见安装作用域、依赖和卸载后保留数据 |
| P2 | 豆包桌面版 | 管理型安装器，但描述写“桌面版只打开官方入口” | 官方确有 Windows 桌面下载；锁定 2.20.9 包仍可达且签名主体匹配 | 文案与真实行为矛盾，会让用户误解 AI Hub 是否接管安装 |
| P2 | 剪映专业版 | 检测别名同时接受“剪映专业版/JianyingPro/CapCut”及 ByteDance Pte. Ltd. | 中国官网产品和本次包签名主体均是深圳市脸萌科技有限公司；官网把全球 CapCut 视为另一品牌/分发面 | 过宽别名可能把全球 CapCut 误识别为中国剪映专业版，进而打开/卸载错产品 |
| P2 | 腾讯元宝 | 固定 2.77.1.612 包 | 官方下载页当前通过多条渠道 EXE 分发；没有公开稳定版本 API 或长期下载合同 | 当前固定包是腾讯域名且签名匹配，但无法证明仍为官网“最新”；必须保留周期复核而不能宣称自动跟随最新 |

## 3. 产品逐项核验

### 3.1 ChatGPT Desktop

- 官方入口：<https://chatgpt.com/download/>；当前 Windows Web Installer：<https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi>。
- 当前主产品身份：Microsoft Store Product ID `9PLM9XGG6VKS`。官方当前 Windows 文档也给出 `winget install --id 9PLM9XGG6VKS -s msstore`：<https://learn.chatgpt.com/docs/windows/windows-app>。
- 官方企业部署还提供始终指向最新包的 x64/ARM64 Store-signed MSIX，并明确“不提供独立 MSI 或非 Store EXE”：<https://learn.chatgpt.com/docs/enterprise/windows-deployment>。
- 包/架构：代码下载的是 x86 Microsoft Web Installer 引导器；最终 Store 包当前支持 x64/ARM64。引导器签名主体线索为 `Microsoft Corporation`，Store 目录发布者为 OpenAI；两者不能混为同一签名身份。
- 依赖：Windows 10 x64/ARM64 build 17763+。Codex 在 Windows 原生运行；WSL2 是可选执行环境，不是安装 ChatGPT 主应用的硬依赖。
- 打开/更新/卸载：从开始菜单或 Appx 身份启动；更新归 Microsoft/OpenAI Store/MSIX；卸载交给 Windows 包管理。OpenAI 没有公开产品专属的“卸载后本地数据清单”，数据保留为 `unknown`。
- 对照结论：`shared/desktop-lifecycle.cjs` 的 Product ID/PFN 方向正确；`requirements: []` 不正确。`admin/data/catalog-v1.json` 不应让 Web Installer 的文件版本代表 ChatGPT 应用版本。
- 官方资料内部仍有旧帮助文章写 `9NT1R1C2HH7J`：<https://help.openai.com/en/articles/9982051-using-the-chatgpt-windows-app>。当前下载页和新 Windows 部署文档都指向 `9PLM9XGG6VKS`，因此不能因旧文章回退当前配置；应记录为官方文档冲突并持续监控。

### 3.2 Claude Desktop

- 官方入口：<https://claude.com/download>；普通 Windows x64 滚动入口当前为 `https://claude.ai/api/desktop/win32/x64/setup/latest/redirect`。代码使用该滚动入口，方向正确。
- 包/架构：普通用户 setup；企业部署另有 x64/ARM64 per-user MSIX。代码当前只管理 x64 普通 setup。
- 本次锁定目标的签名主体线索为 `Anthropic, PBC`；当前出口地区访问滚动入口会被重定向到区域不可用页，因此“国外可下载”与“当前机器可下载”必须由网络层分别报告，不能把区域阻断误报为文件损坏。
- 依赖：Windows 10+。完整 Claude Cowork 需要管理员权限、Virtual Machine Platform，启用后需重启；普通用户无管理员权限仍可安装 Claude，但 Cowork 不可用。官方依据：<https://support.claude.com/en/articles/10065433-install-claude-desktop>、<https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows>。
- 更新：Claude 默认约每四小时检查并自动应用更新；企业 MDM 与 Claude 自更新必须二选一。
- 卸载/数据：普通 setup 的稳定静默卸载参数和本地数据保留清单未由官方公开，均为 `unknown`。应调起 Windows/厂商卸载 UI，不删除猜测的 AppData 或 Cowork 工作区。
- 对照结论：下载入口和签名主体未发现错配；`requirements: []`、只覆盖 x64、未区分“主应用已安装/Cowork 依赖就绪”是主要缺口。

### 3.3 剪映专业版

- 官方入口：<https://www.capcut.cn/>；中国官网明确产品为剪映专业版，开发者为深圳市脸萌科技有限公司。
- 代码固定包：`Jianying_11_1_0_14287_jianyingpro_0_creatortool.exe`，来自 `vlabstatic.com` 官方资源域，当前仍可达。
- 包/架构：x64 EXE/Inno 安装器；签名主体线索为 `深圳市脸萌科技有限公司`。
- 系统要求、稳定更新协议、卸载数据保留：官网当前可抓取内容没有给出可靠 Windows 契约，均记 `unknown`。
- 对照结论：下载域名和签名匹配；当前 `names`、publisher、executable 同时接受全球 `CapCut`，识别范围超过中国剪映条目的证据边界。建议中国剪映与 CapCut 分离成两个产品身份，至少不能仅凭 `CapCut.exe` 就把它归为剪映专业版。

### 3.4 TRAE

- 官方入口：<https://www.trae.cn/ide/download>；官网注明 Windows 10/11、x64。
- 官方当前 API：<https://api.trae.cn/icube/api/v1/native/version/trae/cn/latest>。本次 `manifest.win32.version` 为 `2.3.62837`，CN x64 URL与代码完全相同。
- 包/架构：URL 明确 x64 payload；安装器外壳为 x86；签名主体线索为 `北京引力弹弓科技有限公司`。
- 打开/更新/卸载/数据保留：当前官方公开页没有足够稳定契约，均记 `unknown`；代码通用 Inno 打开/卸载只能视为客户端审核结果，不能写成厂商承诺。
- 对照结论：真实 URL 当前正确；`fileName: TRAE-CN-3.3.83...` 与官方 API `2.3.62837` 不一致，`3.3.83` 无一手证据，应纠正或明确版本层级。

### 3.5 豆包桌面版

- 官方入口：<https://www.doubao.com/download/desktop>。官方页面明确提供 Windows 桌面 AI 助手。
- 代码固定包：`Doubao_installer_2.20.9.exe`，来自 `lf-flow-web-cdn.doubao.com`，当前仍可达。
- 包/架构：x64 EXE；签名主体线索为 `北京春田知韵科技有限公司`，与豆包现行用户协议中的服务主体一致。
- Windows 最低要求、更新机制、卸载后的本地数据：官方公开下载页没有给出可稳定引用的契约，均为 `unknown`。
- 对照结论：固定包和签名未发现错配；后台描述“桌面版只打开官方入口”与 `client-managed-installer`、安装/打开/卸载能力直接冲突，必须改文案。固定版本是否为官网最新也无法由公开 API 证明。

### 3.6 TRAE Work（代码名 TRAE SOLO CN）

- 官方入口：<https://www.trae.cn/ide/download> 的产品名是 **TRAE Work**，Windows 10/11、x64；旧 `/solo` 路径已转向 `/work`。
- 官方 API 仍把 JSON 分组键写作 `solo`，但 Windows 文件是 `TRAE_Work_CN-Setup-x64.exe`，当前版本 `2.3.62834`。分组键是兼容实现细节，不应继续作为产品展示名。
- 包/架构：x64 payload、x86 安装器外壳；签名主体线索为 `北京引力弹弓科技有限公司`。
- 打开/更新/卸载/数据保留：官方稳定契约 `unknown`。
- 对照结论：URL当前正确，产品形态和文件名错误。客户端检测可继续接受旧 `TRAE SOLO CN` 作为迁移别名，但后台名称、描述、官网和下载文件名应改为 TRAE Work。

### 3.7 Comfy Desktop

- 官方入口：<https://www.comfy.org/download>；自动平台入口：<https://dl.todesktop.com/241130tqe9q3y>。代码使用滚动入口，当前解析到 `Comfy Desktop Setup 1.0.34...exe`。
- 包/架构：官方明确为 NSIS `.exe`，Windows 支持 x64/ARM64；本次下载外壳为 x86；签名主体线索为 `Drip Artificial Inc`。该主体是当前观察值，不是 Comfy 文档承诺的永久主体。
- 依赖：Windows 10+；每个 ComfyUI 安装建议至少 4.85 GB；NVIDIA/AMD 独显推荐但非必需。代码的 15 GB 安装磁盘预留比官方最低值更保守，可保留为 AI Hub 策略，但应说明是平台预留而非厂商最低值。
- 更新：Comfy Desktop 自行检查更新，可自动或在设置内手动重启更新。
- 卸载：Windows Settings → Apps → Installed apps → Comfy Desktop。卸载只移除启动器，保留下列数据：
  - `%USERPROFILE%\ComfyUI-Installs`
  - `%USERPROFILE%\ComfyUI-Shared`
  - `%APPDATA%\Comfy Desktop`
- 官方依据：<https://docs.comfy.org/installation/desktop/windows>。
- 对照结论：`shared/desktop-lifecycle.cjs` 的三条保留路径与当前官方文档一致；此前怀疑的路径漂移不存在。真正缺口是后台 `requirements: []` 和仅有 x64 安装入口。

### 3.8 Google Antigravity 2.0

- 官方入口：<https://antigravity.google/download>。
- 当前官方版本：2.4.3；代码固定 URL 与官网 x64 链接一致。官网另有 ARM64：`.../windows-arm/Antigravity-arm64.exe`。
- 包/架构：x64 payload、x86 安装器外壳；签名主体线索为 `Google LLC`。
- 依赖：Windows 10 64-bit。
- 打开/更新/卸载/数据保留：当前官方公开页未给出稳定契约，均为 `unknown`。
- 对照结论：产品名、版本、x64 URL 和签名未发现错配；缺 ARM64 分支与最低系统要求。

### 3.9 Cursor

- 官方入口：<https://cursor.com/download>。
- 当前 Latest：3.14；官方 x64 User 链接本次重定向到 <https://downloads.cursor.com/production/a758f2241ca99fecf380180b6cbdbbce0f1f42cf/win32/x64/user-setup/CursorUserSetup-x64-3.14.7.exe>。代码固定为 3.13.25，已经落后。
- Windows 变体：x64 System、x64 User、ARM64 System、ARM64 User 四种。代码只覆盖 x64 User。
- 包/架构：当前代码锁定的 x64 User payload 使用 x86 安装器外壳；其签名主体线索为 `Anysphere, Inc.`。3.14.7 新包签名本次未重新下载验证，记 `unknown`，不能直接沿用旧包结论。
- 更新/卸载/数据：当前公开下载页没有给出足够稳定的生命周期契约；旧 `docs.cursor.com/en/troubleshooting/troubleshooting-guide` 目前重定向到新文档首页，因此本次不把历史缓存中的清理命令当作当前厂商合同。上述三项记 `unknown`。
- 对照结论：必须重新审核 3.14.7 并更新锁定包；若产品当前只支持 x64 User，应在 UI 明示，不要让用户误以为覆盖所有 Windows 架构和安装作用域。

### 3.10 Kimi Work（代码名 Kimi Windows 客户端）

- 官方产品页：<https://www.kimi.com/zh-cn/products/kimi-work>；官方帮助：<https://www.kimi.com/zh-sg/help/kimi-work/overview>。
- 官网页面嵌入的 Windows 滚动入口：<https://appsupport.moonshot.cn/api/app/pkg/latest/windows/download>。本次重定向到 `https://kimi-img.moonshot.cn/app/download/windows/kimi_3.1.6.exe`；代码仍固定 3.1.5。
- 包/架构：代码锁定的 3.1.5 为 x86 安装器外壳，签名主体线索为 `北京月之暗面科技有限公司`。3.1.6 当前包签名未重新完整验证，记 `unknown`。
- 依赖：Windows 10+。
- 产品形态：官方名称是 Kimi Work / Kimi 官方桌面客户端，具备 Chat 与 Work 模式，能访问授权的本地文件、调用浏览器、运行 Python/Shell、定时任务等。官方说明本地文件处理的数据保留在设备端，但没有给出 Windows 卸载后精确保留目录。
- 更新/卸载：稳定更新协议和完整卸载数据清单 `unknown`。
- 对照结论：名称可改成“Kimi Work（Windows）”以对齐厂商；必须从滚动入口解析新版本、重新做哈希/签名审核后再更新客户端白名单，不能直接让后台任意替换 URL。

### 3.11 千问桌面版（中国版）

- 中国千问 PC 官方页：<https://b.qianwen.com/apps/qkhomepage_twofoufeb/routes/l5Utxkrh6>。
- 页面给出的 Windows 稳定入口：`https://download.qianwen.com/download/qianwenpc?platform=pc&ch=pcqwen@default`。本次解析结果为：
  - 最终 URL：<https://umcdn.qianwen.com/download/37270/qianwenpc/pcqwen@default/QianwenPC_V3.7.5.145_pc_pf3000_(zh-cn)_releasemini_(Build2901209-1001-x64).exe>
  - SHA-256：`5e6c92f79eb0ddc735df6365dc5646b6401fb2f7017c3552d27740a36f8f2921`
  - 安装器 PE 为 x64；Windows Authenticode 状态有效；签名主体 `ALIBABA (CHINA) NETWORK TECHNOLOGY CO.,LTD.`；签名证书 thumbprint `ADFBAB50702A60EBE5481F3C15065F082AA11762`；文件资源 ProductName 为 `Qianwen Installer`。
- 当前代码固定 `qwenclient_setup_2.3.1.2602272243.exe`，虽仍在阿里官方 CDN 可达且签名主体匹配，但已不是中国官网当前入口。
- 全球 Qwen 官方页 <https://qwen.ai/> 另有 `api.app_download_url`，当前 Windows 返回 `Qwen-1.0.3.44-release-win-x64.exe`。这与中国千问 PC 是不同渠道/版本体系，不能互相覆盖。
- 系统要求、更新、卸载后数据清单：中国 PC 页面未给出稳定契约，记 `unknown`。
- 对照结论：这是本组最严重的内容建模问题。应明确选择“中国千问 PC”或“全球 Qwen Desktop”：
  - 若保留“千问桌面版”，官网、教程和滚动解析应使用 `qianwen.com`，类别应为 AI 对话/通用助手，不是编程开发；
  - 若另收录全球 Qwen Desktop，应单列产品和版本体系；
  - 删除“桌面入口仍按 B 处理”等内部审计文案。

### 3.12 Qoder CN IDE

- 官方下载：<https://qoder.com.cn/download>；官方安装文档：<https://www.alibabacloud.com/help/en/lingma/qoder-cn/user-guide/installation-guide>。
- 依赖：Windows 10/11 x64。
- 当前代码锁定的官方域名包：`release/1.20.1/QoderUserSetup-x64.exe`，为 x86 安装器外壳；签名主体线索为 `BRIGHT ZENITH PRIVATE LIMITED`。
- 官方产品发布日志当前为 Qoder CN IDE `v1.5.0`：<https://www.alibabacloud.com/help/en/lingma/qoder-cn-update-log>。日志同时明确 `1.106.3` 是曾升级的 VS Code 内核版本。
- 更新、卸载、数据保留：官方安装页未给出完整稳定契约，记 `unknown`。
- 对照结论：不能再把 `Qoder-1.106.3-Windows-x64.exe` 当作用户看到的产品版本。下载路径中的 `1.20.1` 与产品发布日志 `1.5.0` 是否属于不同构建命名空间也未由官方解释，应显示 `unknown` 或从安装后产品版本资源读取，禁止猜测映射。

### 3.13 QoderWork CN

- 官方下载：<https://qoderwork.cn/download>；官方 Windows 文档：<https://www.alibabacloud.com/help/en/lingma/qoderwork-cn/windows-installation>。
- 代码使用官方滚动 User x64 URL：`https://download.qoder.com.cn/qoder-work/releases/latest/QoderWork-Setup-User-x64.exe`，方向正确。
- 包/架构：x64 User payload、x86 安装器外壳；签名主体线索为 `BRIGHT ZENITH PRIVATE LIMITED`。
- 依赖：Windows 10 64-bit+、x86_64、500 MB 可用空间、稳定网络。
- 安装作用域：官方同时提供 System Installer（Program Files、所有用户、需管理员）和 User Installer（`%LOCALAPPDATA%`、当前用户、无需管理员，官方推荐不确定时选它）。代码只支持 User Installer，可接受，但必须明确展示。
- 打开/更新：开始菜单搜索 Qoder；默认后台检查更新，发现新版后提示，未经用户确认不会下载/应用；可从 Help 手动检查。
- 卸载/数据：Windows Installed apps 搜索 Qoder 并调起卸载；若要移除配置，还需手动删除 `%USERPROFILE%\.qoderwork`。
- 对照结论：滚动 URL 和签名未发现错配；后台 `requirements: []`、缺少 User/System 说明和数据保留提示。

### 3.14 腾讯元宝电脑版

- 官方入口：<https://yuanbao.tencent.com/evt/dl>；页面明确提供 Windows 电脑版。
- 代码固定包：`yuanbao_2.77.1.612_x64.exe`，来自腾讯 `cdn-hybrid-prod.hunyuan.tencent.com`，当前可达。
- 官网当前前端还包含多条 `Desktop/business/channels/yuanbao_*_x64.exe` 渠道包；官方没有公开“最新版本”API或一个可长期依赖的版本字段，因此无法从一手来源证明 2.77.1.612 仍是最新，记 `unknown`。
- 包/架构：x64 payload、x86 安装器外壳；签名主体线索为 `Tencent Technology (Shenzhen) Company Limited`。
- 系统要求、更新、卸载数据保留：官方公开下载页没有稳定契约，均为 `unknown`。
- 对照结论：固定包来源与签名未发现错配；应保持周期复核，不得把渠道脚本中任意 EXE 自动加入后台白名单。

## 4. 签名与安装器观察汇总

以下均为 2026-08-01 的观察值，不是永久白名单合同：

| 产品/锁定包 | 安装器外壳 | 观察到的签名主体 |
|---|---|---|
| ChatGPT Web Installer | x86 | Microsoft Corporation |
| Claude x64 setup | x64 | Anthropic, PBC |
| 剪映专业版 | x64 | 深圳市脸萌科技有限公司 |
| TRAE | x86 | 北京引力弹弓科技有限公司 |
| 豆包 | x64 | 北京春田知韵科技有限公司 |
| TRAE Work | x86 | 北京引力弹弓科技有限公司 |
| Comfy Desktop | x86 | Drip Artificial Inc |
| Google Antigravity x64 | x86 | Google LLC |
| Cursor 3.13.25 x64 User | x86 | Anysphere, Inc. |
| Kimi 3.1.5 | x86 | 北京月之暗面科技有限公司 |
| 千问旧锁定包 2.3.1 | x86 | ALIBABA (CHINA) NETWORK TECHNOLOGY CO.,LTD. |
| 千问当前中国官网引导器 | x64 | ALIBABA (CHINA) NETWORK TECHNOLOGY CO.,LTD. |
| Qoder CN IDE | x86 | BRIGHT ZENITH PRIVATE LIMITED |
| QoderWork CN | x86 | BRIGHT ZENITH PRIVATE LIMITED |
| 腾讯元宝 | x86 | Tencent Technology (Shenzhen) Company Limited |

当前正则白名单没有发现主体拼写错误，但应注意：

1. ChatGPT 引导器签名是 Microsoft，最终 Store 包发布者是 OpenAI；两层身份必须分别验证。
2. 官网版本已变化的 Cursor 3.14.7、Kimi 3.1.6 尚未进入本地审核，不能沿用旧包哈希或把旧包签名结论自动继承给新包。
3. 厂商换证属于正常发布行为。正确流程应是“官方入口解析 → 新包隔离下载 → 完整签名链/时间戳/哈希/产品身份审核 → 更新客户端白名单”，不能让后台绕过客户端审批。

## 5. 三份配置的结构性差异

### `shared/windows-desktop-catalog.cjs`

- 是本组客户端执行事实来源：URL、host、哈希、签名、检测别名、卸载器规则都在这里。
- 优点：后台不能任意增加 EXE；符合客户端本地白名单边界。
- 问题：固定版本没有统一的到期/复核日期；`requirements` 几乎全部为空；通用桌面项没有产品级数据保留模型；产品名和展示文件名也混入执行层，导致 TRAE/Qoder 等版本语义漂移。

### `shared/install-registry.cjs`

- 对本组产品主要是从 `WINDOWS_DESKTOP_PRODUCTS` 自动投影，URL 不在这里重复定义，因此没有发现第二套执行 URL 漂移。
- ChatGPT、Claude、Comfy 是独立手写注册项，`requirements` 同样为空；这让官方已明确的 Windows 版本、架构和 Cowork/Comfy 条件无法进入统一安装前提示。

### `admin/data/catalog-v1.json`

- 重复保存公开下载 URL/文件名，当前多数与客户端白名单一致，但这份一致性靠人工维护；后台改了 URL也不能改变客户端执行白名单，前端可能显示一个地址、客户端实际执行另一个地址。
- 已发现内容层错误：TRAE SOLO 旧名称、TRAE/Qoder 错版本标签、Kimi/Cursor/千问旧版本、千问错误产品形态、豆包行为文案冲突、内部“按 B 处理”文案。
- 建议后台只保存 `installProfileId` 和展示字段；公开的“当前已批准下载版本”应由客户端白名单投影回后台/API，或发布时强制校验 URL、文件名、架构、产品名、审核版本完全相等。后台仍然不能下发未批准 EXE。

## 6. 建议整改顺序（本次未执行）

1. 先修产品身份：`TRAE SOLO CN → TRAE Work`；千问中国版与全球 Qwen Desktop 分开；Qoder 不再显示 VS Code 内核版本；剪映与 CapCut 不共用宽泛身份。
2. 再刷新已确定过期的锁定包：Kimi 3.1.6、Cursor 3.14.7、千问中国官网 V3.7.5.145。每个新包都必须重新做完整哈希、Authenticode 信任链、时间戳、产品资源、安装/打开/卸载实机验收。
3. 补架构/作用域：ChatGPT、Claude、Comfy、Antigravity、Cursor 的 ARM64；Cursor 和 QoderWork 的 User/System 选择。若本期只支持 x64 User，UI 必须明确，而不是静默假装“Windows 全支持”。
4. 把厂商已明确的要求写入统一 `requirements`：Windows 版本、CPU 架构、磁盘、GPU建议、网络、管理员权限、Virtual Machine Platform、重启要求。
5. 为每个产品增加 `updateOwner`、`uninstallOwner`、`dataRetention` 三个显式字段；没有证据时显示 `unknown`，不要套用 NSIS/Inno 的通用猜测。
6. 加发布门禁：后台目录中的下载展示字段与客户端批准 profile 不一致时禁止发布；滚动入口只用于发现新版本，不能直接成为后台任意远程执行通道。

## 7. 主要一手来源

- OpenAI：<https://chatgpt.com/download/>、<https://learn.chatgpt.com/docs/windows/windows-app>、<https://learn.chatgpt.com/docs/enterprise/windows-deployment>
- Anthropic：<https://support.claude.com/en/articles/10065433-install-claude-desktop>、<https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows>
- 剪映：<https://www.capcut.cn/>
- TRAE：<https://www.trae.cn/ide/download>、<https://api.trae.cn/icube/api/v1/native/version/trae/cn/latest>
- 豆包：<https://www.doubao.com/download/desktop>、<https://www.doubao.com/legal/terms>
- Comfy：<https://www.comfy.org/download>、<https://docs.comfy.org/installation/desktop/windows>、<https://github.com/Comfy-Org/Comfy-Desktop>
- Google Antigravity：<https://antigravity.google/download>
- Cursor：<https://cursor.com/download>
- Kimi：<https://www.kimi.com/zh-cn/products/kimi-work>、<https://www.kimi.com/zh-sg/help/kimi-work/overview>
- 千问中国版：<https://b.qianwen.com/apps/qkhomepage_twofoufeb/routes/l5Utxkrh6>；全球 Qwen：<https://qwen.ai/api/config?api.app_download_url>
- Qoder CN：<https://qoder.com.cn/download>、<https://www.alibabacloud.com/help/en/lingma/qoder-cn/user-guide/installation-guide>、<https://www.alibabacloud.com/help/en/lingma/qoder-cn-update-log>
- QoderWork CN：<https://qoderwork.cn/download>、<https://www.alibabacloud.com/help/en/lingma/qoderwork-cn/windows-installation>
- 腾讯元宝：<https://yuanbao.tencent.com/evt/dl>
