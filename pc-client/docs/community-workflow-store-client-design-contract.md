# 社区 Workflow Store 客户端信息架构与视觉合同

状态：设计合同；以 `community-workflow-store` 的 `candidate-only`、默认关闭边界为准。

本文只规定客户端的导航、文案、展示和验收。它不启用 Workflow Store，不修改 Flarum、
目录、投稿状态机、IPC、Capability Broker 或本地执行。当前候选已有受 capability 与认证
门控的私有“我的工作流” owner UI；它仍没有公开 Workflow Store、公开帖子卡、导入或执行
路径。在公开 capability、公开 Listing 和本地能力均未接线前，客户端不得显示空的 Workflow
Store 或任何可点击的导入/运行承诺。

## 1. 导航与对象边界

- `Workflow Store` 是**独立的资源商店频道**，在左侧资源商店组内与 Skill、MCP、插件、
  连接器并列；不是任一现有商店的子类，也不是首页一级产品或厂商目录。
- 仅在已存在至少一个 `published`、公开、`low|guarded` 的 Workflow Listing 时显示此
  导航。无 Listing、能力关闭或公开读失败时隐藏该频道，不用“即将开放”空页替代。
- 社区仍是讨论与帖子事实源。帖子只保存并引用精确 `{ workflowId, version }`；点击卡片
  进入该版本的 Workflow Store 详情，不把工作流内容复制进 Flarum 帖子。
- 个人中心的“我的工作流”是私有 owner 入口：当前 capability 已启用且认证后才显示草稿、
  已提交、被退回、已发布版本和帖子引用；未来可再加入已导入副本。它不复用“我的投稿”
  列表；后者仍是统一资源投稿的 owner DTO。
- 统一投稿的 `workflow` 类型继续保持不可用，直至它能通过同一公开 release lookup
  精确验证 `{ workflowId, version }`。不能以自由文本、帖子链接或社区热度绕过此门槛。

## 2. 社区帖子 Workflow 卡

### 公开卡 allowlist

帖子卡先解析精确版本；成功后只显示公开 DTO 中的以下内容：

1. 标题、两行内简介、`v{version}`；
2. 当前公开作者显示名；原作者、组织（若与提交者不同则单列“原作者”）；
3. “来自社区帖子”及受控的原帖跳转、许可证、派生来源；
4. `reviewStatus` 和 `riskLevel` 两个独立标记；
5. 输入/输出摘要、依赖数量、权限摘要、是否需每次确认；
6. 版本发布时间和可用性状态。

不得显示 reviewer、审核备注、审核日志、举报、`discoveredVia`、证据链接、内部 ID、
去重、秘密值或秘密占位符名称、命令/脚本/URL/path/endpoints。详细依赖仅在客户端详情
中展开，仍只消费 data-only allowlist。

### 解析失败与下架

| 解析结果 | 卡片显示 | 可用动作 |
| --- | --- | --- |
| 当前公开 `low` / `guarded` | 完整公开卡与版本 | `查看详情`；导入仅按第 4 节能力门控 |
| 缺失版本 / 下架 / 公开读失败 | `该工作流版本当前不可用`，保留帖子正文与原帖 | 无导入、运行、绑定动作 |
| `unsafe` / `rejected` | 与上行相同的通用不可用文案；不公开原因、审核人或风险细节 | 无动作 |

`unsafe` 与 `rejected` 本身不能进入公开 DTO；因此帖子引用必须 fail closed，不能用帖子
旧缓存补出卡片或推断状态。已导入副本由“我的工作流”保留来源版本和本地状态，但不能
因原帖仍存在而重新获得可用性。

## 3. 生命周期、风险与热度文案

| 状态 | 用户文案 | 不能暗示的含义 |
| --- | --- | --- |
| Draft | `草稿，仅自己可见` | 已提交、已审核、已上架 |
| Submitted | `已提交审核，尚未上架或可运行` | 审核通过、可导入、可执行 |
| Review | `正在审核；审核接受不等于上架、安装或可调用` | 自动安全保证 |
| Published | `已上架到 Workflow Store`，辅文 `本地导入/运行仍取决于版本、平台、依赖与本地能力` | 已安装、已运行、已绑定 Agent |
| Unlisted | `已下架，不能再导入或新建绑定` | 删除旧本地副本、自动卸载 |

- `low`：`低风险（已审核，不是安全保证）`。
- `guarded`：`受限：未来每次使用需确认`；它不是较低星级，也不是已授权运行。
- `unsafe`：不进入公开卡；私有作者/审核界面才可见固定安全说明，不展示内部理由给普通
  帖子读者。
- 星级、热度、收藏或安装量只能标作 `社区热度` / `外部参考`，同时显示来源与观察日期。
  它们绝不替代 reviewStatus、riskLevel、许可证或平台可用性，也不改变按钮状态。

## 4. 按钮层级与本地能力门控

详情页只可基于显式 capability/projection 决定动作；不得从帖子、平台、风险或星级推断。

1. **查看详情 / 查看原帖**：始终是导航，非执行动作。
2. **导入本地副本**：只在 Listing 仍 `published`、版本 `low|guarded` 且未来导入
   capability 明确可用时显示为主按钮。导入创建 `ImportedWorkflow` 副本，保留来源版本；
   它不安装依赖、不运行、不授予 Agent 权限。
3. **本地运行 / 绑定 Agent**：只在未来 Capability Broker 针对该精确版本返回 `ready`
   或 `confirmation-required` 后出现。后者按钮应为 `查看条件并确认`，不能直接写为
   “运行”。`blocked` 时展示原因摘要与 `查看所需条件`，不显示假按钮。
4. Broker 未接入、缺少依赖、平台不支持、权限/收据/确认缺失或 Listing 下架时，不显示
   运行或绑定按钮；可保留只读依赖/权限说明。当前私有 owner UI 可按 `allowedActions`
   显示保存草稿、提交审核、撤回和帖子引用；这些不是导入、运行或 Agent 绑定。当前没有
   Broker/导入接线，因此公开详情不能显示上述执行类按钮。

## 5. 平台筛选与可用性

- 仅消费共享 `projectResourcePlatformAvailability` 输出的 platform/runtime/architecture
  projection；不读浏览器 UA、不自动识别 OS，也不从依赖名称推断支持平台。
- 筛选器始终并列 `Windows`、`macOS`、`Linux`，由用户主动选择；未声明时显示
  `平台可用性尚未提供`，而非“支持全部平台”。
- `supported`、`unsupported`、`unknown`、`blocked` 分别以文本和图标显示；未知和阻断
  不产生导入/运行资格。Windows 的既有收据或 profile 绝不能投射为 macOS/Linux 可用。

## 6. 1365 / 740 与无障碍规格

- **1365**：保持现有左侧大导航；频道页为“标题与筛选 / 卡片列表 / 选中详情”三级阅读，
  详情最大阅读宽度约 760px。帖子卡仅提供版本概览，避免在社区正文内展开长依赖表。
- **740**：不增加第二个导航或浮动执行栏；列表和详情单列，筛选横向换行，卡片按钮纵向
  排列。长依赖、许可证、来源和版本号允许断行，使用可复制文本，不以截断或横向滚动
  隐藏关键内容。
- 所有卡片动作、筛选、`details/summary` 与帖子卡链接可 Tab 聚焦，焦点环使用共享冷青
  token 且不只依赖颜色。Enter/Space 可展开补充信息；Esc 仅关闭临时筛选/弹层，不改变
  导入或 Broker 状态。
- 状态标记必须同时含文字：`已审核`、`低风险`、`受限`、`不可用`，不能只用色块。错误
  与阻断信息使用安全的用户文案，不回显 HTTP、IPC、路径、secret、审核内部信息。

## 7. 前端验收清单

- [ ] 公开 Workflow Listing 至少一条前不显示 Workflow Store 导航。
- [ ] 帖子卡只用 `{ workflowId, version }` 解析；缺失、下架、unsafe/rejected 都 fail
  closed，且没有导入/运行/绑定动作。
- [ ] 作者、原作者、提交者、来源和许可证在详情中有独立字段；帖子显示名不能替代原作者。
- [ ] draft/submitted/review/published/unlisted 文案符合第 3 节，已上架不等于可运行。
- [ ] `low/guarded/unsafe` 与星级/热度分别显示；热度不影响审核、风险或能力。
- [ ] 导入与 Broker 动作分别按 capability gate 出现；无 Broker、依赖、平台、权限或确认时
  不出现假动作。
- [ ] 三平台只按共享 projection 筛选；不自动检测或跨平台继承可用性。
- [ ] 1365 与 740 无横向溢出，长依赖/来源可读，键盘焦点顺序覆盖筛选、卡片、详情与返回。
- [ ] 自动截图、fixture 或 isolated Electron 结果单列；真实用户机、真实社区账号和生产
  验收不得由它们替代。

## 8. 实现依赖（供 CTO 排队）

前端负责本合同的渲染与状态；社区员工负责 Flarum 帖子引用/安全解析；个人中心负责
“我的工作流”私有投影；后台/社区候选所有者负责公开 Listing、release lookup 与 capability
合同。Capability Broker、平台 projection、导入和 Agent 绑定各自需要单独审批，不能借
本视觉合同启用。

## 9. Public Read 候选的下一轮视觉依赖

当前个人中心已提供默认关闭的匿名只读 capability/list/get/resolve exact tuple envelope 与
严格 Public DTO。它允许前端在 capability 已启用、且确有公开 Listing 时接线本合同的
频道、详情与帖子卡；`low|guarded` 仅为展示资格，不能授予 install、execute、invoke 或
bind。missing、unlisted、unsafe、rejected 继续统一解析为不可用。

本轮没有公开前端 UI、线框、截图、真实用户或生产证据，故本文不对其布局、可读性、
焦点、响应式或视觉 token 作出结论。下一轮前端接线后，按第 7 节重新验收 1365/740、
键盘焦点、长文本、空态/不可用态与所有动作缺省边界；自动化与隔离证据仍不替代真实
用户机及生产验收。
