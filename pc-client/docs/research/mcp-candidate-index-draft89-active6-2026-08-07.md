# MCP 候选索引与缺口报告（draft89 / v2 active6）

日期：2026-08-07  
范围：MCP 商店频道；candidate-only。  
事实源：`pc-client/admin/published/catalog-store/state.json` 的 `state.draft.catalog`，`draft.revision=89`；本报告不修改事实源。

## 结论

- 基线为 123 个 MCP resource、472 个 target tuple；当前 117 个 `official`、5 个 `reviewed-community`、1 个 `community`。
- 当前 6 个 `mcp-managed` target 均属于既有固定 registry/profile/host/capability 白名单；其余 466 个 target 仍为 `resource-link`，本轮没有新增 managed、安装、启停、卸载或 Agent/Workflow 绑定候选。
- 候选索引收录 8 个去重后的频道候选：6 个 official（其中 Roblox、PlayCanvas 为本轮一手复核的游戏开发覆盖；Unity、Playwright、Figma、MiniMax 为现有索引再核对）和 2 个 `reviewed-community`（现有资源的安全边界复核）。全部 `managedEligibility=not-eligible`，不能因候选索引自动产生动作。
- “游戏”和“游戏开发”均保留：`shared/catalog-taxonomy.cjs` 的 canonical IDs 分别是 `gaming` 与 `game-development`；`rawTags` 保留原始词，`mappingEvidence` 显式映射到这两个 ID，不擅自增加 taxonomy。
- 没有抓取聚合站热度、没有调用禁用 API、没有下载或运行包。热度字段保留为空，不能把 GitHub star 或社区出现次数当成 reviewStatus、riskLevel 或 managed 资格。

## Intake 估算与执行边界

| 阶段 | 估算请求/耗时/磁盘 | 本轮处理 |
|---|---:|---|
| 本地基线读取与去重 | 1 个 JSON 读取；约 1–3 秒；小于 1 MiB 临时数据 | 已执行；只读 |
| 第一方种子页复核 | 8–12 个 HTTPS 页面请求；约 15–60 秒；缓存不超过 2 MiB | 已执行小规模复核；未抓包、未下载包 |
| 详情扩展（最多 20 候选） | 20–40 请求；约 1–3 分钟；不超过 10 MiB 元数据 | 未执行，需 CTO 另行批准 |

后续如批准，只能使用可恢复、按 canonical URL 缓存、单域限速的页面 intake；遇 robots 禁止、需要登录或要求用户秘密时停止。不得把可变命令、远程 bootstrap、动态包版本或用户提供的秘密写入候选数据。

## 去重与字段合同

去重键为：原作者身份、canonical repo/package、现有 `resourceId`、宿主 target tuple。现有 resource 只保留一条候选身份记录，宿主关系列在 `targetTuples`，不复制长描述。

每项都保留 `rawTags`、`normalizedTags`、`mappingEvidence` 与 `agentCompatibility.raw/normalized/mappingEvidence`。`normalizedTags` 只能使用 `catalog-taxonomy.cjs` 的 canonical IDs，例如 `gaming`、`game-development`、`3d-cad-industrial`。`reviewStatus`、`riskLevel`、外部热度和 `managedEligibility` 分离；`unsafe` 或 `rejected` 不可 managed、Agent 绑定或 Workflow 依赖。候选对象不声明新的 profile，也不携带后台执行字段或用户凭据。

`targetTuples[].moduleId=resource-link` 只表示当前 link-only 展示关系，属于合法只读展示描述；不得被 importer 直接消费为 module/profile binding。候选 importer 必须重新依据现有 registry、resource/module/host/profile/capability 白名单授权，缺一项即保持 link-only。

## 候选摘要

| resourceId | 类型 | canonical 一手来源 | 主要宿主/场景 | reviewStatus | riskLevel | managedEligibility | 结论 |
|---|---|---|---|---|---|---|---|
| `roblox-studio-mcp-server` | official / existing resource-link | Roblox Creator Hub | `roblox-studio`; 游戏、游戏开发 | automated-reviewed | unsafe | not-eligible | 官方内置本地 MCP，但可读写脚本、运行 Luau、输入鼠标键盘；需真实宿主安全验收，不能托管安装 |
| `playcanvas-editor-mcp` | official / existing resource-link | PlayCanvas Developer Site | `playcanvas-editor`; 3D/CAD、游戏开发 | automated-reviewed | guarded | not-eligible | 官方包入口明确，但文档使用动态 `npx` 安装且可删除资产/分支；缺固定发行物与收据 |
| `unity-official-mcp-server` | official / existing resource-link | Unity AI / Unity package docs | `unity-editor`; 3D/CAD、游戏 | automated-reviewed | guarded | not-eligible | 官方身份成立；当前版本入口为 rolling/latest，缺固定版本和生命周期收据 |
| `microsoft-playwright-mcp` | official / existing resource-link | Microsoft GitHub repository | 多个现有宿主；浏览器采集、编程 | automated-reviewed | guarded | not-eligible | 官方仓库成立，但安装/容器和浏览器运行面可变，不能仅凭仓库升级 managed |
| `figma-mcp-server` | official / existing resource-link | Figma Developer Docs | `figma-design`; 3D/CAD、办公 | automated-reviewed | guarded | not-eligible | 官方远程/桌面两种形态，写回画布及 OAuth/客户端白名单使固定托管边界不足 |
| `minimax-official-mcp` | official / existing resource-link | MiniMax official GitHub | `minimax-cli`; 图像、视频音频、Agent | automated-reviewed | unsafe | not-eligible | 官方仓库明确要求地区匹配的 API 凭据和动态 Python 包；不收集秘密、不托管 |
| `godot-mcp` | reviewed-community / existing resource-link | 原作者 GitHub | `godot-engine`; 游戏、游戏开发 | automated-reviewed | unsafe | rejected | 社区来源；可改工程文件/运行编辑器，缺官方发布者与固定生命周期证据 |
| `unreal-mcp` | reviewed-community / existing resource-link | 原作者 GitHub | `unreal-engine`; 游戏、游戏开发 | automated-reviewed | unsafe | rejected | 社区来源；宿主写入面和版本/安装边界不足，保持警示外链 |

上述 8 项均只表示“候选索引/缺口记录”，不是发布候选，也不是客户端动作候选。

## 一手证据与安全判断

- Roblox 官方文档确认 MCP server 内置于 Roblox Studio，支持本地 stdio，并列出 Codex CLI、Claude Code、Claude Desktop、Cursor 等客户端；同时明确可读写脚本、运行 Luau、输入鼠标键盘。因此官方身份和 Windows 入口成立，但动作权限过宽，标记 `unsafe`，不得托管。
- PlayCanvas 官方文档确认 Editor MCP Server 使用 `@playcanvas/editor-mcp-server`，Windows JSON 客户端需经过 `cmd /c`，且仅连接当前打开的 Editor；文档同时警告可删除实体、资产、构建、分支及重置项目状态。动态 `npx` 与破坏性编辑共同阻断 fixed profile。
- Unity 官方页面确认存在 Official MCP Server；现有 catalog 已有 Unity resource-link，但版本入口仍是 rolling/latest 语义，不能由“官方”推导固定安装生命周期。
- Microsoft Playwright 官方仓库是第一方 canonical repository；其安装示例存在滚动包/容器语义，未形成 AI Hub 可验证的固定版本、收据和卸载合同。
- Figma 官方文档确认 remote MCP 为推荐路径、desktop server 为本地形态，并说明仅 Figma MCP Catalog 列出的客户端可连接；文档还确认可写回画布。远程账号/OAuth 与写入面阻断托管。
- MiniMax 官方仓库确认需要用户 API key、地区匹配的 API host，并以动态 Python 包管理方式启动；本仓库不收集或保存这些秘密，故标记 unsafe/rejected 边界。

## 缺口报告

1. **固定生命周期缺口**：除既有 6 个 managed target 外，466 个 target 没有同时满足 AI Hub 固定 registry、resource/module/host/profile/capability 白名单及可恢复收据的合同；不得补造 profile。
2. **版本证据缺口**：Unity、PlayCanvas、Playwright、MiniMax 等官方入口存在 rolling/latest、运行时下载或地区动态配置；需厂商固定版本/校验和及 Windows 生命周期证据后才能重新审核。
3. **权限边界缺口**：Roblox、PlayCanvas、Figma、Godot、Unreal 等能修改宿主内容；即使来源可信，也不能直接成为 managed。需要明确只读检测、最小权限、repair/update/uninstall 归属和人工确认。
4. **凭据缺口**：Figma remote 与 MiniMax 需要账号/OAuth/API key；AI Hub 只能让用户在宿主官方界面完成授权，不保存、索取或转发秘密。
5. **标签缺口**：现有 MCP catalog 对象没有完整保留本轮 intake 所需的 `rawTags`、`normalizedTags`、`mappingEvidence`、`agentCompatibility`；这些字段仅在本 candidate index 中表达，未回写 catalog。`normalizedTags` 已按 `shared/catalog-taxonomy.cjs` 输出 canonical IDs，游戏与游戏开发分别为 `gaming`、`game-development`。
6. **热度缺口**：本轮没有读取第三方聚合热度；`popularity` 字段为空，`sourcePlatform/observedAt` 不得缺省为猜测值。若以后读取官方 GitHub 页面上的 star，只能作为外部观察值，不能改变审核结论。
7. **真实验收缺口**：本轮是本地只读和官方页面证据，不等同真实 Windows 宿主 CLI、marketplace、用户设备或账号验收。

## 处理决定

- `acceptedManagedCandidates=[]`，`proposedBindings=[]`，`published=false`。
- 执行字段检查只针对候选对象是否出现后台执行字段，结果为通过；`targetTuples` 中的 `moduleId`、`capabilities` 等只读展示字段另行检查，不合并为同一统计。importer 直接消费 `targetTuples` 为 binding 的检查结果为拒绝。
- 官方候选继续显示为 `resource-link/official-link-only`；社区候选显示警示外链；unsafe/rejected 不进入安装、Agent 或 Workflow 依赖。
- 下一步若 CTO 批准，优先由 MCP 商店负责人补做 2–3 个官方页面的固定版本/Windows 检测证据；实现仍需后台/客户端正式员工另行接单。本轮不改代码、不改 catalog/state、不 saveDraft、不发布、不封包、不上传、不安装。

## 官方来源

- [Roblox Studio MCP 官方文档](https://create.roblox.com/docs/studio/mcp)
- [PlayCanvas Editor MCP 官方文档](https://developer.playcanvas.com/user-manual/editor/mcp-server/)
- [Unity AI 官方页面](https://unity.com/features/ai)
- [Microsoft Playwright MCP 官方仓库](https://github.com/microsoft/playwright-mcp)
- [Figma MCP 官方开发者文档](https://developers.figma.com/docs/figma-mcp-server/)
- [MiniMax MCP 官方仓库](https://github.com/MiniMax-AI/MiniMax-MCP)
- [Godot MCP 原作者仓库](https://github.com/tomyud1/godot-mcp)
- [Unreal MCP 原作者仓库](https://github.com/GenOrca/unreal-mcp)
