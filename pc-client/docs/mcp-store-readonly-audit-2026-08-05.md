# MCP 商店第一轮只读审计（2026-08-05）

范围：`pc-client/admin/data/catalog-v1.json`、MCP 资源校验模型、宿主关系模型和本地 Admin API 路由。未修改客户端共享前端、未调用 `saveDraft`、未发布。

## 候选数据概览

- Catalog schema：v2；资源总数 146，其中 MCP 123，Skill/Plugin/Connector 仍为独立资源类型。
- MCP 资源中 117 条 `sourceKind=official`，115 条声明 `sourceProductIds`；资源身份是顶层单条记录，宿主关系位于 `targets`，符合去重原则。
- 当前 MCP 宿主主目录应按 `targets[].productId` 投影，页面顺序为：宿主工具 → MCP 列表 → 单项说明/安装。
- MCP 商店已在 `resourceStores` 中独立启用，order=1；MCP 未作为主页一级产品或产品详情页扩展目录的依据。

## 宿主工具主目录（按 MCP 数量降序）

| 宿主工具 | MCP 数量 | 可安装 | 当前能力形态 |
| --- | ---: | ---: | --- |
| Cursor Desktop | 95 | 1 | 1 条 `mcp-managed`，其余 `resource-link` |
| Claude Desktop | 94 | 0 | 全部 `resource-link` |
| Claude Code | 75 | 1 | 1 条 `mcp-managed`，其余 `resource-link` |
| Codex CLI | 59 | 1 | 1 条 `mcp-managed`，含启停 |
| GitHub Copilot | 42 | 0 | `resource-link` |
| ChatGPT Desktop | 28 | 0 | `resource-link` |
| Windsurf Editor | 27 | 0 | `resource-link` |
| Gemini CLI | 12 | 0 | `resource-link` |
| 其余 18 个宿主 | 1–8 | 0 | `resource-link` |

## 后台 CRUD/schema 观察

资源字段已覆盖：`id`、`name`、`description`、`website`、`tutorial`、`resourceTypes`、`sourceProductIds`、`targets`、`publisherVendorId`、`publisher`、`sourceKind`、`versionRef`、`requestedPermissions`、`credentialRequirements`、`installScope`、`uninstallPlan`、`provenanceEvidence`、`enabled`、`order`。

每个目标关系要求独立保存 `productId`、`compatibility`、`moduleId`、`installProfileId`、`capabilities`、`enabled`。`mcp-managed` 只引用客户端预审核安装配置；后台字段不是命令，也不能下发任意命令。

本地 Admin 已提供只读目录/配置、草稿目录读取、发现审核和发布前校验路由，并以 `PUT /api/catalog` 作为草稿保存入口。本轮未调用写入路由。

## 缺口与候选工作项（不实施）

1. 可安装能力仅覆盖 Codex CLI、Claude Code、Cursor Desktop 各 1 条候选；其余宿主全部为 `resource-link`，需要产品/客户端确认后才能补充安装 profile，不能仅凭协议兼容性推断“可安装”。
2. 123 条 MCP 中仍有 6 条 `sourceKind` 不是 official 或缺少 `sourceProductIds`；需逐条回到厂商官网、官方文档或官方仓库核验身份与来源，不能以第三方目录或推测 URL 补证。
3. 资源级 `credentialRequirements`、权限与 `installScope` 需要按单项说明展示；涉及密钥/令牌时只能说明用户在宿主或厂商页面自行配置，后台不得收集、保存或索取凭据。
4. 需要确认 MCP 资源是否应允许复合 `resourceTypes`；若存在同时标为 Skill/Connector/Plugin 的记录，MCP 频道只投影 MCP 身份，不复制或管理其他频道记录。
5. 需要补充后台 CRUD 的“来源证据”和“宿主目标唯一性”审核提示，确保同一 MCP 不因多宿主而复制身份、版本或审核状态。

## 最小验证

- JSON 可解析，schemaVersion 为 2。
- MCP 资源均为顶层 `resources` 记录，未从 `vendors[].products[].extensions` 读取。
- MCP 资源的目标关系均引用宿主 `productId`，未发现把资源来源产品直接当作安装宿主的模型依据。
- 资源商店配置包含独立 `mcp` store，且已启用。

结论：现有模型已经支持“宿主工具主目录 → MCP 列表 → 单项说明/安装”的投影与资源去重；当前主要缺口是官方来源清理、宿主安装能力覆盖，以及凭据/权限/安装范围的单项运营审计。
