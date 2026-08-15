# 连接器固定客户端 profile 审核候选（2026-08-06）

状态：只读研究与候选队列；未修改代码、catalog、state，未调用 `saveDraft`，未发布、封包或执行外部授权。

## 事实源边界

本轮只把 `pc-client/admin/published/catalog-store/state.json` 指定的版本作为目录事实源，并通过项目现有 `pc-client/admin/release-store.cjs` 的 `readRelease()` 读取、校验 immutable signed envelope：

- `draft.catalog`：revision `89`，含 146 个顶层资源。
- 根发布通道：active catalog version `72`（用户称 v1 active72）。
- `channels.v2.activeReleaseId`：active catalog version `6`，对应 draft revision `89`；签名 envelope 的实际路径为 `envelope.payload.catalog`，其中 `schemaVersion=2`、4 个 `resourceStores`、146 个 `resources`、513 个 `targets`。

因此，3 条 connector 记录在 draft revision 89 与 v2 active6 的已验证 payload/catalog 中一致存在；不能把 envelope 外层字段误判为 catalog 内容，也不能把解析路径错误写成发布缺口。v1 active72 是较早的独立通道版本，本轮不从其旧 payload 推断 v2 内容。以下队列是“候选 profile 审核”，不是已实现的客户端 profile。

## 宿主工具主目录 → 连接器列表 → 单项说明/安装/配置

### Claude Desktop / Claude 连接器目录

Anthropic 官方说明区分 remote connector 与桌面扩展：连接器目录中的 remote connector 可跨 Claude Web、Desktop、移动端、Cowork 和 Claude Code 使用；桌面扩展才是本机进程/文件访问路径。本轮 3 条候选都只能按“用户在 Claude 官方界面完成连接”的 remote connector 处理，不能下发本地命令、参数、环境变量、请求头、脚本或凭据。见 [Anthropic：desktop 与 web connectors](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors)。

| 队列 | 资源 ID | 目标 AI 宿主 | 官方一手证据 | 授权/权限 | 连接、断开、检测边界 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | `adobe-for-creativity` | Claude Desktop；官方页同时支持 Claude Web、Desktop、Cowork | [Adobe 官方 Getting started](https://developer.adobe.com/adobe-for-creativity/getting-started/) 明确说明在 Claude 的 Customize → Connectors → Browse connectors 中搜索、Install、confirm connection | Claude 账号；Adobe 账号可选但用于更多工具、额度和 Creative Cloud 保存。目录只展示权限说明，不接触账号或 token。Adobe 官方说明中可见用户选择的连接与 Adobe 登录流程 | 连接：固定打开 Adobe 官方说明/Claude 连接器目录；授权由用户完成。断开：Adobe 官方支持页明确提供 Customize → Connectors → Adobe → Disconnect，再 Connect 重新授权。[Adobe FAQ](https://developer.adobe.com/adobe-for-creativity/support/)；检测：只能显示目录声明和用户可见连接状态，不探测 token 或远程账户 | 进入最小 profile 审核队列；当前仍是 `resource-link` 候选，不能直接标记 install/connect 已实现 |
| P0 | `sketchup-claude-connector` | Claude；官方文档明确 Claude 为当前唯一支持的 AI provider，覆盖 Claude Desktop 使用路径 | [Trimble/SketchUp 官方文档](https://help.sketchup.com/hu/sketchup-claude-connector) 明确要求 Trimble ID + Claude 账号，并给出 Customize → Connectors → Connect Your Apps → Add → Connect 流程 | Trimble ID + Claude 账号；官方能力限制为生成新的 `.skp`，不能编辑或渲染既有 `.skp`。目录不保存账号、OAuth 或令牌 | 连接：只引导用户在 Claude 官方目录完成 Connect；断开/撤销：候选中仅保留“用户在 Claude/Trimble 官方账户界面自行断开或撤销”的说明，不能由 AI Hub 执行。检测：不探测本机 SketchUp，也不宣称接管本机 SketchUp | 进入最小 profile 审核队列；需后台补齐官方撤销路径证据后才能批准 disconnect 文案 |
| 补证 | `affinity-ai-connector` | Claude；publisher 为 Canva/Affinity | [Canva 官方新闻稿](https://www.canva.com/newsroom/news/canva-create-2026-launches/) 仅确认 Affinity 的 AI Connector with Claude，以及 Claude 可创建并保存可复用脚本到 Affinity Scripting panel | 已确认连接能力和脚本写入范围，但官方新闻稿没有给出连接入口、OAuth/登录方式、精确权限、断开/撤销路径 | 只能展示官方新闻稿；不得自行推断 OAuth、安装方式、撤销方式或本机检测。尤其不能把“脚本写入”扩展为任意本机执行授权 | 不进入最小 profile 审核队列；等待 Canva/Affinity 官方连接、权限和撤销文档 |

## 逐项 draft target 核对

draft revision 89 的 3 个 connector target 均为：

```text
productId: claude-desktop
compatibility: official
moduleId: resource-link
installProfileId: ""
capabilities: ["website"]
enabled: true
```

这意味着当前 v2 catalog 只允许官方页面跳转；没有固定 connector profile、没有客户端安装/连接/断开执行。这里的“没有固定 profile”来自 target 的 `moduleId=resource-link` 和空 `installProfileId`，不是资源不存在。当前需要关注的是 profile 审核，而不是 catalog 发布缺口：

1. 可以把 v2 active6 的 3 条资源描述为已发布的 connector 目录记录，但不能描述为已实现连接/断开能力。
2. 不能在后台新增 profile 或能力字段后直接发布；必须先由客户端固定模块负责人提供已审查的 profile 合同，再由后台做 schema/CRUD 校验。

## 凭据与安全边界

- OAuth、账号登录、组织管理员批准和令牌撤销全部由用户在 Claude、Adobe、Trimble 或 Canva/Affinity 官方流程完成。
- AI Hub 不收集、保存或索取密钥、令牌、密码、OAuth code、refresh token 或自定义 connector URL。
- 后台不得下发 `command`、`args`、`env`、`headers`、`script`、`credentials`，也不得把连接器伪装成 MCP、Skill、插件或一级 AI 产品。
- `connect`/`disconnect` 只能作为固定客户端 profile 的候选能力；在 profile 未审核前只能 `resource-link`。
- `detect` 只能检查固定客户端已公开的、非秘密的连接状态（若未来 profile 明确支持）；不得读取本地配置中的凭据或探测远程账户。

## 最小审核队列与下一步责任人

### 进入审核队列

1. `adobe-for-creativity`
2. `sketchup-claude-connector`

队列仅表示“允许进入固定客户端 connector profile 合同审核”，不表示批准发布或实现。

### 暂不进入队列

- `affinity-ai-connector`：补齐官方连接入口、授权方式、权限范围和断开/撤销证据后重新审计。
- 所有不在已验证 `envelope.payload.catalog.resources` 中的 connector：不能从其他文件或推测 URL 外推为 active 事实。

### 责任分工

- 连接器商店负责人（本任务）：维护官方一手证据、资源层级、宿主关系、权限/授权/断开文案和去重规则；继续补证，不改后台 schema。
- AI 商店后台（`019fcd18-fc4d-7960-9aa6-e0e1720e90d4`）：收到 P0 候选后，设计并校验 connector-specific CRUD/schema 与发布阻塞规则；不得自行发明执行字段或凭据字段。
- AI 商店桌面管理（`019fcd13-be2b-7990-bf2e-5f75f4a8002f`）：在后台合同确定后，评估固定客户端 connector profile 的 connect/disconnect/detect 实现；不得接受后台任意命令或凭据。
- CTO（`019fa61a-ffd6-7072-983a-538695626693`）：裁定 active 发布版本漂移、批准跨模块 profile 合同和后续实现顺序。

## 审计结论

本轮最小高置信队列为 Adobe + SketchUp，两者都有官方连接步骤；Affinity 暂缓。v2 active6 已发布 3 条 connector 目录记录，但三者仍是 `resource-link` 候选，不是已实现 profile。下一步应由 AI 商店后台先提出固定字段合同并回传 CTO，桌面管理再基于该合同做最小 profile 设计；不应因目录记录已发布而跳过 profile 审核。
