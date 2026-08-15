# Skill 资源分类筛选错用目标产品标签

## 用户反馈

Skill 商店虽然显示分类筛选，但选择分类后没有得到对应 Skill。

## 根因

资源商店把 `scenarioTags` 读取自目标 `Product`。活动目录中的 Skill 分类证据属于资源自身，且 `EcosystemResource` 合同此前不允许保存该字段，因此分类按钮无法筛选 Skill。

## 修复

- `EcosystemResource.scenarioTags` 复用统一的 21 个 canonical 场景标签，保持可选且最多 8 个。
- 仅 Skill 商店展示分类，并把来源与分类在 Skill 资源行上组合筛选；MCP、插件和连接器不展示或应用 Skill 分类。Agent 兼容和成熟频道仍按目标产品筛选。
- 来源本身为空与“当前筛选无匹配”使用不同空态。
- 通用筛选按钮明确为 `type=button`，使用带标签的 `role=group`，并保留 `aria-pressed`。

## 验证

- Schema 测试覆盖合法 canonical 标签、别名、未知、重复和超过 8 项。
- 隐藏 Electron 从 Skill 商店真实点击官方/社区来源和分类，验证可见目标集合严格缩小、组合不串、无匹配文案、选择“全部”恢复，以及焦点和按压状态；并确认 MCP 不显示分类且仍能按来源和 Agent 筛选进入资源详情。

## 剩余验收

本修复不改活动目录。后续目录版本必须把已审核 Skill 候选的 `normalizedTags` 投影到 `resource.scenarioTags`，签名发布后再做正式客户端实机验收。

## 防回退

不得再用目标产品分类代替 Skill 分类，也不得把 Skill 分类扩散到 MCP、插件或连接器；fixture 必须让 Skill 标签与宿主标签不同，防止旧实现假绿。

## 2026-08-14 资源优先浏览补充

旧 `ResourceStorePage` 先投影目标产品，再在产品内渲染资源；一个 canonical Resource 具有多个目标产品时会落入多个宿主分支，界面身份实际变成 `resourceId + productId`。现改为消费纯 `ResourceMarketplace` 投影：商店列表按 `resourceId` 唯一，兼容宿主仅作为交叉筛选和详情事实；Publisher 仍是事实，不进入父子导航。Skill 支持来源、场景、宿主相交，其他三个资源商店支持来源、宿主相交；详情返回只清除所选资源，保留当前筛选。fixture 固定包含一个双宿主 Skill，并通过 hidden Electron 验证唯一卡、四商店入口、空态、完整宿主详情和返回恢复。

## 2026-08-14 连接关系 UI candidate 补充

### 用户可见缺口

同一个资源可以通过同一个 AI 宿主提供多种连接方式，但旧详情只有 Publisher 与兼容宿主，无法说明 `remote-mcp`、`chatgpt-app` 等连接事实。若直接按关系生成卡片，又会把一个 canonical Resource 重复显示。

### 修复边界

- `createResourceMarketplace` 接收可选、扁平且字段精确的 `connections` join；关系必须命中同一 enabled Resource 的 enabled target 与 enabled AI 宿主，并按 `bindingKind` 校验资源类型。
- 商店仍按 `resourceId` 生成唯一卡片。详情把 Publisher、兼容宿主、连接方式显示为平级事实，不把 Publisher 建成父层，也不从连接方式推导安装、授权或执行能力。
- `RemoteCatalog.resourceConnections` 只作为当前 UI-ready candidate 的可选输入；未提供时保持原有界面。此 slice 不修改活动目录、目录 Schema 或签名发布合同。

### 验证与剩余验收

公共 seam 先得到“详情没有 connections”的 RED，再覆盖合法双关系与无效字段、模式、binding、资源、宿主、target、重复 tuple 的 fail-closed GREEN。隐藏 Electron 先得到“connection modes did not render”的 RED，再验证同一资源一张卡、Publisher 可见、一个宿主、两种连接方式，以及 Back 后社区筛选与单卡状态保留。

活动目录当前没有该可选关系字段；把真实 next-major 关系接入正式目录 Schema、签名发布与实机验收，仍须后续独立审计和授权。

## 2026-08-14 关系审计返修

- `connectionMode` 与 `bindingKind` 现在使用固定配对：`remote-mcp` 仅接受三个 MCP binding，三个宿主连接模式仅接受 `connector-authorized-connection`；错误组合在 marketplace seam 关闭。
- 连接详情不再分别去重模式与宿主。每条 edge 精确显示“连接方式 · 宿主”，并保留 mode、host ID、binding kind DOM 证据，避免界面暗示不存在的笛卡尔积。
- hidden Electron fixture 使用一个 canonical MCP/Connector 资源、两个宿主和两条不同 edge，验证单卡、精确 mode→host、三组平级事实及 Back 后非默认筛选保留。
- admin UI 的旧 `resource.publisher` 静态断言已改为验证 marketplace `selectedEntry.publisher` 投影及 Publisher peer fact；资源安全字段与禁止静默执行断言保持不变。
