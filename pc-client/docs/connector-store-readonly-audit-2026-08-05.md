# 连接器商店第一轮只读审计（2026-08-05）

状态：候选/缺口文档；未修改共享前端，未调用 `saveDraft`，未发布。

## 审计范围与证据

- 主目录：`pc-client/admin/data/catalog-v1.json`，schema v2，顶层 `vendors`、`resourceStores`、`resources`。
- 目录规则：`pc-client/docs/adr/0006-catalog-views-and-ecosystem-resource-stores.md` 与 `pc-client/docs/product-module-admin-model.md`。
- 后台 UI/schema 线索：`pc-client/admin/public/app.js`、`pc-client/admin/server.cjs`、相关 admin/ecosystem 测试。
- 本轮只读统计：375 个厂商、156 个 `ai-connectable` 产品、128 个含可接入产品的厂商、146 个生态资源、3 个 `resourceTypes` 含 `connector` 的资源。

## 宿主工具主目录 → 连接器列表 → 单项说明/安装/配置

### Claude Desktop（唯一已登记的连接器宿主）

当前 3 条连接器资源均指向 `claude-desktop`，兼容性为 `official`，模块为 `resource-link`，能力只有 `website`；因此当前实际行为是打开官方页面/教程，不是本地安装、连接或断开。

| 连接器 ID | 资源层级 | 目标 AI 工具 | 当前安装/配置 | 当前权限说明 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `adobe-for-creativity` | connector resource；不冒充一级 AI 产品 | Claude Desktop | 官方网站/教程跳转；无 install profile | 用户明确选择的文件会发送到 Adobe 与 Claude 云服务；组织授权由用户完成 | 候选，需官方连接流程证据 |
| `sketchup-claude-connector` | connector resource；来源产品为 SketchUp | Claude Desktop | 官方网站/教程跳转；无 install profile | 当前只生成新的 SKP 文件，不能宣称接管用户本机 SketchUp | 候选，需确认授权与撤销 |
| `affinity-ai-connector` | connector resource；来源产品为 Affinity | Claude Desktop | 官方网站/教程跳转；无 install profile | 官方撤销文档尚未完整；脚本首次运行必须展示写入范围并确认 | 候选，需补齐权限/撤销证据 |

资源公共字段已具备：`id`、`name`、`resourceTypes`、`description`、`website`、`tutorial`、`publisherVendorId`、`publisher`、`sourceKind`、`sourceProductIds`、`targets`、`versionRef`、`requestedPermissions`、`credentialRequirements`、`installScope`、`uninstallPlan`、`provenanceEvidence`、`lastVerifiedAt`。

## 现有可接入宿主覆盖

现有 `ai-connectable` 产品包含大量 AI 宿主/可接入产品，但本轮没有把它们推断为“连接器宿主”。必须以官方一手来源逐项确认后，才能新增宿主关系。当前目录中可见的候选宿主包括 Claude Desktop、Codex CLI、Cursor、GitHub Copilot、Gemini CLI、Windsurf、OpenCode、Kiro、Cline 等；这些只是目录中已有目标产品，不能代替连接器授权证据。

## 后台 CRUD/schema 缺口

1. 已有通用资源 CRUD 的字段基础，但连接器专用的 `hostProductId`/宿主目录视图、授权方式、权限分级、连接状态、断开/撤销说明没有形成独立且可审计的字段约束。
2. `targets` 目前使用 `productId`、`compatibility`、`moduleId`、`installProfileId`、`capabilities`；连接器记录仍只有 `resource-link`，不能表达安全的 connect/disconnect 候选流程。
3. `credentialRequirements` 等字段存在，但必须明确“只说明用户在官方页面自行授权”，不得让后台收集、保存或索取密钥、令牌、密码。
4. `installScope`、`uninstallPlan` 已存在，但需要连接器语义：安装/连接仅能指向固定客户端能力或官方授权页；断开只能说明官方撤销路径，不得下发任意命令。
5. 去重应以稳定 `resource.id` 为主；同一厂商可同时有 AI 产品和连接器资源，但不能复制厂商记录，也不能把资源提升为一级 AI 产品。目标关系应按 `(resourceId, hostProductId)` 去重。
6. 官方证据字段必须要求 HTTPS 官方域名、来源类型、核验时间与权限/撤销证据；第三方页面和推测 URL 不可作为发布依据。

## 候选字段（仅建议，不入库）

```text
resource.id
resource.resourceTypes = ["connector"]
resource.publisherVendorId
resource.sourceProductIds
resource.hostTargets[].productId
resource.hostTargets[].compatibility
resource.authorization.method       // official-oauth | official-account-link | official-manual
resource.authorization.scopes[]
resource.authorization.userAction
resource.permissions[]
resource.connectPlan
resource.disconnectPlan
resource.credentialPolicy           // never-collect
resource.provenanceEvidence[]
resource.lastVerifiedAt
```

上述字段仍需后台/架构负责人确认；本轮没有写入 schema。

## 最小验证结果

- JSON 可读取，`schemaVersion=2`。
- 连接器资源数量为 3，三条均有唯一 ID、目标产品和权限说明。
- 三条连接器资源均未声明安装 profile，均为 `resource-link` + `website`，符合当前“只展示、不执行”的安全边界。
- `ai-connectable` 产品与厂商数量可统计，未发现需要复制厂商记录的理由。
- 未完成真实官方页面授权/连接/断开验收；未把自动化测试或目录检查当作用户/设备验收。

## 下一轮阻塞/建议

需要 CTO、AI 商店后台和 Skill 商店确认：连接器宿主是否独立于 Skill/MCP/插件商店展示；确认后再以官方一手来源补充授权方式、权限范围、安装/连接/断开候选。当前不建议发布任何新增连接器关系。
