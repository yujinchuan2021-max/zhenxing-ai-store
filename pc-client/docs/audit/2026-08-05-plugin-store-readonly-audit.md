# 插件商店第一轮只读审计（2026-08-05）

范围：仅审计插件频道的目录、宿主产品关系和后台 CRUD/schema。未修改共享前端、未调用 saveDraft、未发布。

## 结论

- 当前目录采用“宿主工具主目录 → 资源列表 → 单项详情/安装”的数据模型基础：资源位于顶层 `resources`，通过 `targets[].productId` 关联宿主产品，不应把插件平铺为一级 AI 产品。
- `pc-client/admin/data/catalog-v1.json` 当前可解析，`schemaVersion=2`，包含 375 个厂商、614 个宿主产品、146 个生态资源，其中 8 个资源含 `plugin` 类型。
- 当前插件资源候选 ID：`anthropic-official-plugin-marketplace`、`comfy-custom-nodes`、`google-gemini-cli-extensions`、`moonshot-kimi-plugins`、`amazon-kiro-powers`、`openclaw-clawhub-plugins`、`cline-official-skills-plugins`、`anthropic-commit-commands-plugin`。
- 客户端安装 profile 注册表当前仅有 1 个插件 profile：`plugin.claude.commit-commands`，宿主为 `claude-code`，适配器为 `claude-plugin-cli`，支持安装、更新、修复、启停和移除。其他 7 个候选没有发现对应的已注册插件安装 profile，不能在后台标记为可安装。

## 后台 CRUD/schema 观察

`pc-client/shared/ecosystem-resources.cjs` 定义了资源类型 `skill`、`mcp`、`plugin`、`connector`；插件频道应只投影 `resourceTypes` 含 `plugin` 的资源，不能跨频道编辑或展示为 Skill/MCP/连接器。资源关系字段为：

- 资源身份与展示：`id`、`name`、`description`、`website`、`tutorial`、`enabled`、`order`、`version`。
- 来源关系：`publisherVendorId`、`publisher`、`sourceProductIds`。
- 宿主关系：`targets[]`，每项绑定已存在的 `productId`、兼容性、`moduleId`、`installProfileId`、能力和启用状态。
- 后台必须使用已批准的模块/profile ID；不得录入命令、包名、任意 URL、参数、配置片段、文件路径或密钥字段。

`pc-client/admin/server.cjs` 的目录接口为 `GET /api/catalog`、`PUT /api/catalog`、`POST /api/validate` 和 `POST /api/publish`。因此 CRUD 具备统一目录读写、校验和发布入口，但本轮没有调用写接口。发布前还会执行资源、图标、产品认证和发布配置校验。

## 候选与缺口

| 候选 | 当前宿主关系 | 插件安装 profile | 建议 |
| --- | --- | --- | --- |
| `anthropic-commit-commands-plugin` | 已关联 Claude Code | 有：`plugin.claude.commit-commands` | 保留为唯一当前可安装候选；发布前核对官方一手来源、版本和宿主兼容性 |
| 其余 7 个 plugin 资源 | 目录中存在，需逐项核对 `targets` | 未发现对应 profile | 仅保留为目录候选/官方来源待核验；不得显示“一键安装” |

### 需要补证的官方一手来源

对每个候选补齐并复核：官方发布者/组织、官方仓库或官方文档 URL、版本或版本引用、宿主支持范围、安装/启停/移除语义、来源更新时间。第三方页面、推测 URL、聚合站和搜索摘要不能作为证据。

### 需要后续最小验证的安全边界

- 验证后台表单只能选择已批准的宿主产品、模块和安装 profile。
- 验证插件详情页显示宿主产品归属，不在 AI 工具主页产品列表中平铺。
- 验证未注册 profile 的资源只有官方入口/说明，不出现安装、启停或移除动作。
- 验证后端 payload 不接受任意命令、脚本、参数、用户密钥、令牌或密码字段。
- 验证同一资源跨多个宿主时复用同一资源身份和版本，不创建重复后台记录。

## 证据文件

- `pc-client/admin/data/catalog-v1.json`
- `pc-client/shared/ecosystem-resources.cjs`
- `pc-client/shared/extension-install-registry.cjs`
- `pc-client/admin/server.cjs`
- `pc-client/docs/product-module-admin-model.md`
- `pc-client/docs/adr/0003-product-extension-catalog.md`（历史 ADR；以当前资源模型和 ADR-0006 为准）

本报告仅为候选/缺口文档；未保存草稿、未修改后台数据、未发布目录。
