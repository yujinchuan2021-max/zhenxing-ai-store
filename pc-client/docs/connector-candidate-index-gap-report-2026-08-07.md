# Connector 候选索引与缺口报告（candidate-only，2026-08-07）

状态：只读研究候选；未修改 catalog/state，未 `saveDraft`、发布、封包、上传、下载、安装、登录或授权。

## 1. 事实基线与本轮估算

事实基线通过 `pc-client/admin/release-store.cjs` 的 `readRelease()` 读取 `channels.v2.activeReleaseId` 对应签名 envelope：

- release：`catalog-v00000006-567e671621f1-3dcee587`
- catalog version：`6`
- draft revision：`89`
- catalog：146 resources、513 targets、4 resourceStores
- 现有 Connector：3 条，均为 `claude-desktop + official + resource-link + 空 installProfileId + [website]`

本轮预估：12 个新增/补证候选（9 个官方、3 个社区线索）、约 20–30 个官方页面或官方帮助入口、约 15–25 分钟低量元数据核验、报告增量约 40–80 KB。实际只核验公开页面，不进行 OAuth、连接状态探测、下载或安装。

## 2. 去重与安全判定规则

候选唯一性按以下 tuple 记录：

```text
authorOrServiceIdentity + canonicalSource + resourceId + hostProductId + authorizationTargetTuple
```

聚合站只能进入 `discoveredVia`，不能成为作者、canonical source 或权限证据。Connector 只表示 AI 宿主与外部服务之间的授权连接，不等同于 MCP、Skill、Plugin 或一级 AI 产品。

只有同时具备以下条件，才允许后续进入 managed profile 审核：

- 无秘密的状态接口或固定可见状态读取合同；
- 固定权限声明与用户确认；
- 精确断开/撤销路径和后验检测；
- 可归因事务标识；
- 已批准的固定本地 connector profile。

本报告中的所有候选均暂不满足完整 managed 条件；没有复用 `mcp-managed`，没有新增执行字段。

## 3. 官方 Connector 候选索引

Anthropic 官方文档确认 Connector 目录覆盖 Claude Web、Claude Desktop、移动端、Cowork 和 Claude Code；本项目本轮只把能被官方资料明确支持的 `claude-desktop` 记入宿主候选，其他宿主逐项待证。[Anthropic Connector overview](https://claude.com/docs/connectors/overview)

| 候选 resourceId | 服务/原作者 | 支持宿主候选 | 授权入口 | 权限范围（仅公开声明） | 状态可见性/撤销 | 后验检测 | 维护状态 | license/terms 证据 | review/risk | 当前判定/阻断 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `slack-claude-connector-candidate` | Slack / Anthropic | Claude Desktop、Claude Web | Claude Settings → Connectors → Slack → Connect；Team/Enterprise 需管理员启用 | 搜索工作区频道、DM、共享文件；计划与组织管理员设置影响范围 | 官方帮助页说明可在 Claude 设置断开；组织级 enable/disable 另需管理员证据 | 可见连接账号/组织信息；尚缺可归因事务 ID 合同 | 官方帮助页本周更新，并提示 Slack 将迁移到 Claude Tag | [Slack connector help](https://support.claude.com/en/articles/11506255-get-started-with-claude-in-slack)；隐私/条款需单独入证据字段 | official；中风险：组织批准与读范围需精确化 | candidate-only；resource-link；待固定状态/后验检测合同 |
| `microsoft-365-claude-connector-candidate` | Anthropic / Microsoft 365 | Claude Desktop、Claude Web、Claude Mobile、Claude Code（以官方页面为准） | Claude Connectors；Microsoft Entra Global Administrator 一次性 consent，用户随后授权 | SharePoint、OneDrive、Outlook、Teams 搜索/分析；写工具是否启用由组织管理员决定 | 官方支持页有组织启用与重新认证说明；需补充精确 disconnect/revoke 证据 | 可见组织/账号连接状态；尚缺事务级后验检测 | 官方 Claude connector 页面和 Help Center 均维护 | [Claude Microsoft 365 connector](https://claude.com/connectors/microsoft-365)、[Connect to Microsoft 365](https://support.claude.com/en/articles/15183774-connect-to-microsoft-365)；Terms/privacy links 待结构化保存 | official；高风险：可能有写邮件、日历、文件能力，必须锁定只读/写分层 | candidate-only；不得把管理员 consent 转成 AI Hub credential 字段 |
| `google-drive-claude-connector-candidate` | Google / Anthropic | Claude Desktop、Claude Web；项目/文件范围需官方限制核验 | Claude Settings → Connectors → Google Drive；用户在 Google OAuth 页确认 | 官方文档确认搜索/添加 Google Drive 文档并自动同步；精确 scopes 尚未在本轮抽取 | 官方文档提供 disconnect/reconnect 处理；需把 revoke 入口与断开状态拆开 | 可见同步/连接状态；尚缺稳定无秘密探针与事务 ID | 官方 Claude Help Center 文档可用，但部分页面仍使用旧 URL/旧名称 | [Claude connector getting started](https://claude.com/docs/connectors/getting-started)、[Google Workspace connectors](https://support.claude.com/en/articles/10166901-use-google-workspace-connectors) | official；中高风险：文件访问与同步范围需最小化 | candidate-only；先补 scopes、revoke、后验检测证据 |
| `github-claude-connector-candidate` | GitHub / Anthropic | Claude Desktop、Claude Web、Claude Code | Claude Settings → Connectors → GitHub；用户完成 GitHub 授权 | 官方 Claude 文档仅确认仓库/文件上下文用途；仓库、组织、写权限范围待官方 GitHub 证据 | 需补 GitHub App/Claude connector 的 disconnect 与 revoke 路径 | 可见连接账户/仓库列表；尚缺固定探针与事务归因 | Anthropic connector 文档持续维护 | [Claude connector getting started](https://claude.com/docs/connectors/getting-started)；GitHub authorization/terms 需补 canonical link | official；高风险：代码与组织数据，写能力必须默认为阻断 | candidate-only；不进入 managed，保持外链 |
| `notion-claude-connector-candidate` | Notion / Anthropic | Claude Desktop、Claude Web | Claude Connectors Directory；Notion 官方说明明确支持 Claude Desktop/Claude.ai | Notion 官方说明确认直接连接 workspace；具体页面/数据库读写范围待精确 scopes | 需同时记录 Claude 侧 disconnect 与 Notion workspace integration revoke | 可见 workspace/连接账号；尚缺标准后验检测 | Notion Help Center 与 Claude connector listing 均有维护页面 | [Notion MCP/connection help](https://www.notion.com/help/notion-mcp)、[Claude Notion connector](https://claude.com/de/connectors/notion)；Notion terms/privacy 待结构化 | official；高风险：读写 workspace 可能混入 MCP 语义，必须保留 Connector 身份证据 | candidate-only；若证据只落到 MCP server，转为 MCP 频道，不登记 Connector |
| `canva-claude-connector-candidate` | Canva / Anthropic | Claude Desktop、Claude Web；Canva 官方另称支持 ChatGPT | Canva AI Connector / Claude 官方连接入口；用户确认授权 | Canva 官方说明覆盖创建品牌演示与视觉内容；具体资产/写入范围需细分 | 需补 Claude disconnect、Canva app revoke 与组织管理员路径 | 可见已连接 AI assistant/账户；尚缺事务归因与无秘密后验检测 | Canva 官方 AI Connector 页面与新闻稿均为近期维护 | [Canva AI Connector](https://www.canva.com/ai-connector/)、[Canva Claude connector announcement](https://www.canva.com/newsroom/news/claude-ai-connector/) | official；高风险：内容创建与资产写入，不能默认授予写能力 | candidate-only；保持 official-link-only |
| `adobe-for-creativity`（现有） | Adobe | Claude Desktop、Claude Web、Cowork | Adobe 官方页：Claude Customize → Connectors → Browse → Install/confirm | 用户选择的文件发送至 Adobe/Claude；Adobe 账号用于更多工具、保存与额度 | Adobe 官方支持页有 Disconnect → Connect 重新授权 | 目前仅用户可见连接状态；无 AI Hub 后验探针 | 官方 Adobe developer docs/FAQ | [Adobe getting started](https://developer.adobe.com/adobe-for-creativity/getting-started/)、[Adobe support](https://developer.adobe.com/adobe-for-creativity/support/) | official；中高风险：文件/创意资产范围 | 保持现有 resource-link；不升 managed |
| `sketchup-claude-connector`（现有） | Trimble / SketchUp | Claude Desktop、Claude Web | Trimble ID + Claude；Claude Connectors Directory → Add → Connect | 只生成新的 `.skp`；不能编辑或渲染既有文件 | 官方连接步骤明确；撤销需补 Trimble/Claude 双侧路径 | 可见连接/生成结果；无固定 AI Hub 状态探针 | Trimble Help 页面有版本/更新时间 | [SketchUp Connector for Claude](https://help.sketchup.com/hu/sketchup-claude-connector) | official；中风险：输出文件与账号授权边界 | 保持现有 resource-link；不升 managed |
| `affinity-ai-connector`（现有） | Canva / Affinity | Claude（具体 Desktop/Web 入口待补） | Canva 官方新闻稿确认 AI Connector with Claude，但未给完整入口 | Claude 可创建并保存可复用脚本到 Affinity Scripting panel | 缺官方断开/撤销与权限说明 | 无固定后验检测 | Canva 官方新闻稿为一手发布，但不是连接配置文档 | [Canva Create 2026](https://www.canva.com/newsroom/news/canva-create-2026-launches/) | official claim；高风险：脚本写入可能影响本地工作流 | 阻断；只保留 resource-link，等待完整官方文档 |

## 4. 社区 Connector 线索（不进入发布候选）

本轮没有把第三方聚合站、MCP server、Plugin marketplace 或 Skill repository 直接登记为 Connector。以下只作为 discoveredVia/缺口线索，等待原作者与授权服务身份核验：

| 线索 | 目前看到的形态 | 为什么不能当 Connector | 需要的最小补证 |
| --- | --- | --- | --- |
| Composio connector-like integrations | 多宿主集成平台/工具目录 | 可能是 MCP/工具网关，不等于单一外部服务授权连接；服务身份与 token 托管边界不清 | 原作者 canonical resource、宿主官方连接入口、每服务 scopes、撤销与状态接口 |
| Arcade connector-like integrations | 授权网关/工具平台 | 平台身份、被连接服务身份和事务归因可能混合；不能复制成多个厂商记录 | 原作者/服务 tuple、授权服务条款、每宿主断开/撤销、无秘密状态合同 |
| Pipedream/其他社区目录线索 | 聚合/工作流目录 | 聚合站不能作为 author 或 canonical source；目录动作可能是 MCP、插件或任意 workflow | 原始作者官方 repo/site、license/terms、明确的 Connector 定义和 OAuth/revoke 文档 |

这些线索只保留 `discoveredVia`、`rawTags` 和阻断原因，不写入 active catalog，不赋予 `hostProductId` 关系，不生成 profile。

## 5. 21 个场景标签与兼容性记录规范

候选索引必须使用 `shared/catalog-taxonomy.cjs` 的 canonical IDs，不新增自由标签。建议按证据归一化如下：

| 候选族 | rawTags 示例 | normalizedTags | agentCompatibility |
| --- | --- | --- | --- |
| Slack / Microsoft 365 / Google Drive / Notion | `office`, `collaboration`, `docs`, `knowledge`, `agent` | `office-collaboration`, `knowledge-docs`, 必要时 `agent-multi-agent` | `Claude Desktop`, `Claude Web`; 其他宿主逐项核验 |
| GitHub | `code`, `programming`, `developer`, `agent` | `programming-development`, `agent-multi-agent` | `Claude Desktop`, `Claude Code`; 不把 GitHub MCP 记录复用为 Connector |
| Canva / Adobe / Affinity | `design`, `image`, `content`, `marketing` | `image-design`, `writing-content`, `marketing` | `Claude Desktop`, `Claude Web`; Canva 另有官方 ChatGPT evidence |
| SketchUp | `3d`, `cad`, `architecture` | `3d-cad-industrial` | `Claude Desktop`; 当前官方文档称 Claude 是唯一支持 AI provider |
| 游戏方向缺口 | `gaming`, `game-development`, `agent` | `gaming`, `game-development`, `agent-multi-agent` | 仅积累成熟 Agent/宿主证据，不推断 Connector |

`rawTags`、`normalizedTags`、`mappingEvidence`、`agentCompatibility` 仅用于候选索引；不改变现有 catalog 字段，也不将 Hermes/OpenClaw 等成熟生态提升为频道。Hermes 等仍遵守 mature-agent candidate-only 条件：身份、维护者、至少 3 个 canonical host resources、2 个连续性证据和 review timestamp 全部满足后才可另行评审。

## 6. 缺口与责任人

1. **Connector module/profile 缺口**：当前 registry 没有 connector profile；不能复用 `mcp-managed`。下一步由 AI 商店桌面管理（`019fcd13-be2b-7990-bf2e-5f75f4a8002f`）提出固定 profile 和非秘密状态合同。
2. **后台 schema/CRUD 缺口**：AI 商店后台（`019fcd18-fc4d-7960-9aa6-e0e1720e90d4`）在收到 profile 合同后，才可设计最小白名单字段；不能新增 command/args/env/headers/script/credentials/任意 endpoint。
3. **官方证据缺口**：Connector 商店负责人（本任务）继续补充 exact scopes、license/terms、disconnect/revoke、后验检测和维护状态；聚合站只进入 discoveredVia。
4. **真实验收缺口**：测试发布运维（`019fcd6c-dd93-7bd3-b32f-c79d4c2a0a8f`）和用户真实设备验收仍未启动；自动化/DOM/公开文档不替代真实宿主连接验收。
5. **目录发布边界**：在固定 profile、状态合同和双侧撤销证据没有通过前，所有新增候选保持 candidate-only/resource-link/official-link-only。

## 7. 本轮结论

- 新增官方候选索引：6 个低量候选（Slack、Microsoft 365、Google Drive、GitHub、Notion、Canva）。
- 现有官方 Connector：3 个，全部保留 resource-link；Adobe/SketchUp 可继续补 profile 合同证据，Affinity 阻断。
- 社区 Connector：0 个可进入发布/managed 队列；3 个线索仅记录为发现缺口。
- 未新增目录数据、profile、能力、schema、宿主关系或执行语义。
- 下一步顺序：桌面管理先提供固定 connector profile/status 合同 → 后台白名单接线设计 → CTO 复核 → 再决定是否进入实现与真实授权验收。
