# MCP 下一批固定 profile 候选研究（2026-08-06）

## 结论：no-op

基于 `state.json` 中 `state.draft.revision=89` 的 123 条 MCP、472 个 targets，以及 v2 active6 指针，本轮没有找到可以进入客户端固定 profile 审核的新增候选。候选队列为空；现有 3 个 OpenAI Developer Docs MCP managed targets 不属于“下一批”，继续沿用既有审核结论。

筛选硬条件是：官方一手资料、固定宿主与本地配置边界、无需 AI Hub 收集密钥、可精确检测/安装/启停/卸载、可建立 AI Hub 所有权收据。当前 resource-link 记录的共同事实是“不写入本地配置/仅打开官方说明”，因此不满足生命周期与收据条件。

本轮只读，未改代码、catalog、state、release；未 saveDraft、发布、封包、下载、安装。

## 机械筛选结果

- 123 条 MCP 资源中，resource-link targets 469 个；没有新增 `mcp-managed` profile。
- 官方来源不等于可安装证据：官方远程服务、官方文档、官方仓库仍需有固定版本/包、宿主配置边界、可逆生命周期和收据契约。
- “只读无密钥”也不自动满足：如果宿主配置是用户自有 URL/账号空间，或连接依赖 OAuth/账户授权，仍属于远端账号连接器边界。
- 任何需要动态目录、可变版本、用户秘密、任意运行入口或高权限本地操作的记录均保持 resource-link/blocked。

## 最近候选与阻断记录（均不是 candidate）

下表只用于说明为何 no-op，不构成安装队列。

| resourceId | target host | 官方入口 | 所需固定字段（安全抽象） | 生命周期/权限 | 阻断 |
| --- | --- | --- | --- | --- | --- |
| `unity-official-mcp-server` | `codex-cli` | [Unity AI/MCP](https://unity.com/features/ai)、[Unity Assistant package docs](https://docs.unity3d.com/Packages/com.unity.ai.assistant@latest/index.html?subfolder=%2Fmanual%2Fintegration%2Funity-mcp-get-started.html) | Unity package 的固定 release、Unity Editor/项目身份、配置收据、检测与移除谓词 | 本地编辑器/项目上下文；可读写场景和编辑器内容，需用户确认 | 当前 `versionRef=rolling-official-package`；官方入口解析到 latest 包；catalog 明确“不写配置”，无 AI Hub 可持有的安装/卸载收据 |
| `microsoft-playwright-mcp` | `codex-cli` | [Microsoft Playwright MCP 官方仓库](https://github.com/microsoft/playwright-mcp) | 固定 npm/package release 与哈希、宿主配置文件位置、浏览器 profile 所有权、检测/清理谓词 | 可控制浏览器、读取登录态与下载；用户浏览器会话边界高 | 官方示例使用 rolling `@latest` 与动态浏览器 profile；本地配置和浏览器数据的所有权边界未形成受管收据；不能复制其安装示例升级为 profile |
| `gitbook-published-docs-mcp` | `codex-cli` | [GitBook published docs MCP](https://gitbook.com/docs/publishing-documentation/mcp-servers-for-published-docs) | 用户站点 URL、发布空间身份、远程连接收据、断开谓词 | 只读已发布文档；私有站点仍需要站点认证 | 官方说明是按用户站点 URL 生成远程 HTTP endpoint，不是固定本地服务/包；站点身份与授权属于远端账号连接器，无法由 AI Hub 建立本地安装收据 |
| `figma-mcp-server` | `cursor-desktop` | [Figma MCP introduction](https://developers.figma.com/docs/figma-mcp-server/)、[remote installation](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)、[desktop server](https://developers.figma.com/docs/figma-mcp-server/local-server-installation/) | 固定宿主配置位置、受支持客户端清单、Figma desktop 状态、授权收据、启停/撤销谓词 | 可读取设计上下文并写入画布；官方远程方案要求 OAuth，桌面方案依赖 Figma Desktop 与文件上下文 | 官方推荐 remote MCP 并要求 OAuth；desktop server 需用户在 Figma Desktop 内启用，且 catalog 记录为 service/不写本地配置；属于账号授权和用户设备状态，blocked |
| `minimax-official-mcp` | `minimax-cli` | [MiniMax official MCP repository](https://github.com/MiniMax-AI/MiniMax-MCP) | 固定 release/依赖锁、Windows 包身份、宿主配置收据、凭据不落入 AI Hub 的检测/卸载谓词 | 生成语音、图像、视频，可能产生费用并写本地输出 | 官方仓库要求用户 API key、区域 API host 和本地配置；使用动态 Python runner/依赖，且当前 catalog 为 `rolling-directory`；违反无需秘密与固定生命周期条件 |

## 后续触发条件

只有当上游提供并能由后台冻结以下信息时，才重新进入候选研究：官方固定 release/package digest、明确 Windows 宿主配置文件、客户端可验证安装状态、仅管理 AI Hub 创建且可匹配的所有权收据、启停/更新/修复/卸载谓词、权限与 OAuth 由宿主托管且不经 AI Hub 收集。届时由 AI 商店后台先冻结 schema/profile 合同，再由桌面或 CLI 员工实现客户端适配。

## 最小验证

- revision 89、MCP 123、targets 472 与 active6 指针读取成功。
- 新候选队列为空；没有写入任何 catalog/state。
- 报告配套 JSON 解析成功，`git diff --check` 通过。
