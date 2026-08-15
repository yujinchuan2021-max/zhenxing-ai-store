# 社区 Workflow Store 持久化/API 候选合同

状态：`candidate-only`、默认关闭。当前只有领域状态机、追加事件仓库、固定 HTTP 适配器和显式 migration 文件；没有接入 Identity/Flarum/Admin runtime、`schema.sql`、Compose、客户端 IPC 或生产数据库，也没有执行引擎。

## 唯一事实源与存储边界

- `community/workflow-store.cjs` 是 WorkflowDraft、不可变 WorkflowRelease、WorkflowListing、举报和帖子卡片规则的唯一领域状态机。
- Identity 只认证用户并提供不可变 `users.id`。显示名不作为主键，owner API 不接收作者 ID，reviewer API 不接收客户端自报的 reviewer ID。
- Flarum 仍是帖子、回复和社区审核事实源。Workflow Store 只验证精确 Flarum post ID；帖子卡片只保存 `{ workflowId, version }`，不保存工作流内容。
- Workflow Store 候选把事件与幂等结果存进现有 Identity PostgreSQL 实例中的独立 `community_workflow` schema。选择该物理数据库是为了复用 `users.id` 外键、事务和备份边界，不把工作流归属转移给 Identity。
- PostgreSQL repository 只追加事件；加载时所有事件必须重新经过 `workflow-store.cjs`。它不复制 Draft/Release/Listing 状态机，也不维护第二套物化业务规则。
- Admin 负责认证 S2S reviewer；公开 API 只读已发布、仍公开且风险为 `low|guarded` 的 Listing/Release。

## Data-only 内容合同

`WorkflowDraft.content` 与 `WorkflowRelease.content` 只接受：

- `title`、`summary`：受限纯文本；
- `inputs`、`outputs`：固定名称、类型和说明，不带真实值或路径；
- `instructions`：人工可读步骤，不解释为节点、命令或脚本；
- `dependencies`：产品使用 canonical product ID；资源必须使用精确 `canonical resourceId + hostProductId + bindingKind`；
- `secretPlaceholders`：只允许占位符名称和说明，不接受秘密值。

资源 binding 只允许 `skill-context`、`mcp-tool`、`mcp-resource`、`mcp-prompt`、`plugin-host-extension`、`connector-authorized-connection`，不得统一成任意 invoke。依赖还要声明受限权限。注入的 `hasCanonicalDependency(tuple)` 必须读取当前活动且已验签目录并精确匹配整个 tuple；默认 adapter 返回 false，未知或未接目录时 fail closed。

Persistence ingress 在 create/update/attach 前先用同一个同步领域状态机收集已经规范化的 dependency tuple、license ID 与 Flarum post ID，再逐项等待受限 resolver；只有字面量 `true` 才批准，`false`、`undefined`、对象、异常与超时都拒绝。批准集合仅在该次 mutation 中消费且只能命中同一精确值。事件 replay 不调用任何外部 resolver，仍只重放当时已批准并写入的规范化事件。

任意层出现未知字段都会拒绝。因此 `command`、`args`、`env`、`headers`、`credentials`、`script`、`url`、`endpoint`、`path`、任意 nodes 和秘密值均不能进入 Draft、Release、事件或公开投影。

## 模块化 Workflow Composition candidate

`community/workflow-composition.cjs` 是未接线的纯 data-only 深模块：不读写 DB、事件、catalog、state、IPC、Compose 或 runtime，不改变 `WorkflowDraft`、`WorkflowRelease`、`WorkflowListing`、`ImportedWorkflow` 的状态机。帖子仍只引用 `{ workflowId, version }`，Workflow Store 仍是唯一事实源。

唯一入口是 `normalizeWorkflowComposition({ workflowRelease, steps, runSelection? })`。它只接受现有 Store 产生的精确不可变 Release 内容和受限组合输入；V1 只接受 1–32 个有序 `WorkflowStep`，拒绝 `dependsOn`/DAG。每个步骤只能引用 Release 中完全相同的 canonical product/resource tuple，权限从 Release 原样派生；输入只能来自 Release workflow input 或精确的前序 `step-output`，类型必须一致；输出只有固定名称和类型，不能覆盖 input 或其它步骤输出，且必须覆盖所有 Release 输出。未知依赖、未来/自身/循环输出、命令、脚本、URL、路径、秘密、`nodes` 和商业字段全部 fail closed。

规范化结果深度不可变，且不构成执行或发布事实：

```js
{
  composition: {
    contractVersion: 1,
    workflow: { workflowId, version },
    steps: [{ stepId, dependency, inputs, outputs }]
  },
  runSelection: {
    workflow: { workflowId, version },
    primaryAgentProductId
  } | null,
  agentBridgePlanInput: {
    contractVersion: 1,
    workflow: { workflowId, version },
    primaryAgentProductId: string | null,
    requiredAgentHostProductId: string | null,
    requirements: [/* exact Release dependency tuples, including Release permissions */],
    steps: [/* same normalized data-only steps */]
  }
}
```

`WorkflowRunSelection` 只在本地存在，不写入 Release。一个被引用的 resource host 是显式主 Agent 宿主约束，选择必须精确匹配；没有 resource host 时不约束本地选择；多个宿主在 V1 直接拒绝，不能被解释为多 Agent transport。`agentBridgePlanInput` 只是未来 Agent Bridge 可消费的只读 DTO，不是 invoke/install/bind/authorization 请求，也不证明发布、审核、风险、目录签名或 Agent 能力已经获批。

## 只读 Release planning resolver

`createCommunityWorkflowCandidate(...)` 增加内部、transport-neutral 的 `resolvePlanningRelease({ workflowId, version })` seam。输入只允许这两个字段；在 `enabled=false`（默认）、missing、版本不是当前 Listing、`unlisted`、非 `publiclyVisible`、`rejected`、`unsafe` 或其它未审核状态时一律返回 `null`，不查询或暴露 owner draft。`lookupPublishedRelease` 复用同一精确门禁并仅返回布尔值。

成功时它返回深度不可变的 planning allowlist：

```js
{
  workflowId,
  version,
  reviewStatus, // automated-reviewed | manually-reviewed
  riskLevel,    // low | guarded
  content: {
    title, summary,
    inputs, outputs, instructions,
    dependencies,       // exact canonical tuple + Release permissions
    secretPlaceholders  // only { name, description }, never a secret value
  }
}
```

该 DTO 故意没有 author/owner/reviewer identity、community post、provenance、`discoveredVia`、notes、audit、Listing 或商业字段；它不是 public UI DTO，也没有新增 HTTP/IPC/CLI 路由。它可作为 Composition 的 `workflowRelease` 输入，并可由未来的本地 snapshot adapter 只读注入 Agent Bridge；Bridge 只能消费，不能据此复建 Workflow 状态机。

## 商业化边界（仅术语预留）

`WorkflowRelease` 内容版本与价格、货币、订单、购买资格严格分离；未来修改商业条件不得重发内容版本。本轮仍为 free/candidate-only，不实现或暴露价格、支付、订单、分账、退款、税务、结算或收费按钮。

未来若获单独授权，`WorkflowCommercialPolicy` / Offer 可以作为独立投影关联 `WorkflowListing` 或精确 `{ workflowId, version }`；Agent 的付费使用资格必须由其外部的独立 entitlement 判断。商业条件、`published`、`reviewed`、`riskLevel` 不得进入 Workflow 状态机或互相推导，也不得成为安全审核或执行门禁。

## 评审包前的默认关闭与接线门禁

Composition 与 planning resolver 都没有 runtime consumer；默认关闭由 Workflow candidate 的 `enabled=false`、未接入 Identity/Community HTTP、renderer、Electron IPC、CLI、Compose 和 Agent Bridge 保证。未来接线至少要同时满足：真实不可变 Release 经 `resolvePlanningRelease` 取得、Composition 通过 fail-closed 规范化、活动签名目录逐 tuple 重验、Agent Bridge 独立完成本地 capability/grant/confirmation/entitlement 判断。`published`、`reviewed`、`riskLevel` 或未来付费资格本身都不是启用或执行授权。

用户评审包目前还不能把它称为可用工作流功能，缺口是：

- 前端没有只读 Composition 展示或本地主 Agent 选择界面；不得补收费、购买、安装或执行按钮。
- Electron IPC 没有窄化的 planning resolver/Composition DTO 通道；不得把 public card 或 owner draft 代替它。
- CLI/Agent Bridge 尚未把 `resolvePlanningRelease` 注入其 `planningReleases` snapshot，也尚未把 `agentBridgePlanInput` 接为只读输入；不得新增 MCP、HTTP、CLI transport 或执行器。
- package gate 先须通过 `node --test tests/community-workflow-composition.test.cjs tests/community-workflow-persistence.test.cjs` 及所有未来接线回归；之后必须在真实 Windows 评审包 Electron 中验证默认无入口/无副作用、宿主不匹配拒绝、missing/unlisted Release 拒绝，以及 UI/IPC/CLI 不能将 DTO 解释成 invoke。

这些聚焦测试只验证 data contract，不替代 Agent、MCP、Connector、真实 Electron、封包或生产验收；本轮不封包、不部署，也不触服务器。

## 来源与审核语义

作者、来源、发现渠道不得混淆：

- `originalAuthorIdentityId` 是创建时固定的 Identity ID；
- `canonicalSource` 当前只允许精确 Flarum post ID；
- `licenseId` 必须通过 canonical license resolver；
- `derivedFrom` 只引用已存在的不可变 `{ workflowId, version }`；
- `discoveredVia` 仅为受限审计信息，不进入公开 DTO，也不能冒充作者或 canonical source。

审核与风险是双轴：`reviewStatus=unreviewed|automated-reviewed|manually-reviewed|rejected`，`riskLevel=low|guarded|unsafe`。只有已审核的 `low|guarded` 可生成 Release；`unsafe` 是已判定高风险，只保留隔离审核结果，不生成可发布 Release。`guarded` 仅声明未来每次使用都要确认；当前没有 import、invoke 或 Agent bind 权限。

Release 版本递增且不可变；下架和举报处理只改变 Listing/举报投影。`published`、`accepted`、星级或热度都不代表可执行。

## 候选模块与 HTTP 路由

`community/workflow-persistence.cjs` 提供：

- `createPostgresWorkflowRepository({ pool, enabled })`：默认关闭的事务事件仓库；
- `createCommunityWorkflowCandidate(...)`：owner、reviewer、public 适配器与 capability；
- `createCommunityWorkflowHttpHandler({ candidate })`：只匹配下列固定路径的 transport-neutral HTTP 候选；
- `createInMemoryWorkflowRepository()`：只用于聚焦测试。

Owner 从 Identity session 派生 immutable ID：

- `POST /v1/community/workflow-store/owner/drafts`
- `POST .../owner/drafts/update|submit|withdraw`
- `POST .../owner/posts/attach|detach`
- `POST .../owner/reports`
- `GET .../owner/drafts|draft`

所有写操作要求 `Idempotency-Key`；修改 Draft 或帖子引用还要求 `expectedRevision`。owner list/get 分页且跨 owner 返回 404。Owner DTO 不含 reviewer ID、内部 notes、完整 audit 或其他用户 PII。

Reviewer ID 只能由 S2S 认证 resolver 注入：

- `POST .../reviewer/review|unlist|reports/resolve`
- `GET .../reviewer/reports`

请求体中的额外 `reviewerId`、未知字段或近似路径一律拒绝。审核内部结果不进入 public DTO。

公开只读路由为：

- `GET .../public/list|release|history`

公开 DTO 只包含不可变作者 ID 与当前公开显示名、canonical source、license、derivedFrom、安全内容、审核状态、风险级别和发布时间；不含 Draft、reviewer、内部 notes/audit、`discoveredVia` 或 secret value。下架后公开读与异步 `lookupPublishedRelease` 均 fail closed。

没有 `execute`、`invoke`、`install`、`import` 或 Agent binding 路由。HTTP handler 只返回固定错误 envelope，不回显内部异常。

## Capability 与统一资源投稿

默认 capability：

```json
{
  "enabled": false,
  "schemaVersion": 1,
  "execution": false,
  "workflowSubmissionLookup": false
}
```

统一资源投稿的 workflow kind 只有在正式接线后，使用同一候选的异步 `lookupPublishedRelease({workflowId, version})` 查到仍公开的真实 Release，才可能解除 validator 的 fail-closed。Admin 已提供 `createAsyncWorkflowReleaseValidator()`：它先规范化精确 `{ workflowId, version }`，再等待 resolver，并且只有字面量 `true` 才通过；Promise、对象、异常、超时及下架结果均拒绝。Identity candidate 已在 create、owner update、review accept、设置 public eligibility 为 true 和生成 catalog candidate 时逐次重验精确 Release。`identity/server.cjs` 与社区 capability 仍固定 `workflowSubmissionLookupEnabled=false` / `workflowSubmissionLookup=false`，尚未获准注入真实社区 resolver，也未接 Compose、schema、runtime 或生产 HTTP。因此不得启用 workflow 投稿、客户端入口或目录写入；测试 fixture 不代表运行态商店。

## 显式 migration 与回滚

- apply：`community/migrations/candidates/0001-workflow-store.sql`
- rollback：`community/migrations/candidates/0001-workflow-store.rollback.sql`

Apply 创建独立 schema、单行 event head、append-only events、Identity UUID 外键和幂等响应表。事件 UPDATE/DELETE 由数据库 trigger 拒绝。Rollback 只在已验证备份、隔离恢复和单独授权后删除整个 candidate schema。

这两个文件不得加入 `identity/schema.sql`、Identity/Flarum runtime entrypoint、现有 migration job 或 production/local Compose。后续正式启用至少需要：备份与恢复演练、apply→rollback→reapply、并发与重试验收、活动签名目录 resolver、Flarum post resolver、S2S secret 轮换/限流，以及真实客户端与公开读验收。

## 正式 temporary acceptance fixture 合同

此节只约束测试发布的正式、可重复的 temporary acceptance runner；它不是
runtime 配置、生产数据 seed、HTTP 扩展或 mock 授权。每次运行必须使用新建且
runner 自有的 Identity、PostgreSQL 与 Flarum project/database，绝不能连接生产
社区数据库、复用真实用户或真实帖子。

固定事实如下：

- owner Identity 是 `11111111-1111-4111-8111-111111111111`，reviewer Identity
  是 `22222222-2222-4222-8222-222222222222`；二者都是 runner seed 身份。reviewer
  仍只由服务端 `AIHUB_WORKFLOW_REVIEWER_ID` 和挂载的 S2S secret 得出，不能进入
  HTTP body；
- `sourceCommunityPostId` 固定为字符串 `2147483647`。runner 必须在其独立真实
  Flarum 中 seed 对应 post，且 `GET http://community/api/posts/2147483647` 必须返回
  `200`、`data.type="posts"`、`data.id="2147483647"`；不得 mock resolver、增加外部
  ID mapping 或使用生产帖子；
- Flarum 候选的 `posts.id` 是 `INT UNSIGNED`，fixture 可表示上限为
  `4294967295`。即使 Workflow 输入正则接受更宽的数字串，任何大于该值的
  Flarum-backed fixture ID 都必须 fail closed；
- provenance 固定为 `{ licenseId: "CC-BY-4.0", derivedFrom: [], discoveredVia: [] }`；
  `dependencies` 与 `secretPlaceholders` 都是空数组。空依赖不免除 active signed
  catalog readiness 门禁；
- 内容只使用普通人类可读 title、summary 和一条 instructions，inputs/outputs 可为空；
  不得包含 `command`、`args`、`env`、`headers`、`credentials`、`script`、`url`、
  `endpoint`、`path`、`secret` 或 `nodes`。`workflowId` 仍由 create 返回，不能由
  fixture 静态指定。

最小验收顺序是 capability/public capability 都启用且 `execution=false`，随后 owner
create（同一 `Idempotency-Key` 重试不得新增事件）和 own-draft read，owner submit
（`expectedRevision=1`），reviewer 以 S2S publish（`manually-reviewed` + `low`，
`expectedRevision=2`），匿名 public list/exact release read，最后 reviewer unlist。
公开 release 在 unlist 后必须返回 `404 PUBLIC_WORKFLOW_UNAVAILABLE`，列表不得再含
该引用。owner body 伪造 `authorIdentityId`、reviewer body 伪造 `reviewerId` 都必须
无副作用地失败；无需也不得借此 fixture 触发 report、attach/detach、import、execute、
invoke、install 或 bind。

写入完成后的 runner 自有数据库只能有四条顺序事件：`createDraft`、`submitDraft`、
`reviewSubmission`、`unlist`；actor 角色依次为 owner、owner、reviewer、reviewer。
create 的 `generatedIds[0]` 与捕获的 workflow ID 相同，后三条的
`input.workflowId` 相同，`event_head=4`，且恰有四条对应的 idempotency 记录。Draft、
Release 与 Listing 没有独立持久化表，均由这组事件回放；不得尝试删除其“记录”。
验证后仅销毁 runner 自有项目、数据库、fixture session 和 fixture post。写出事件后
不得 `DELETE community_workflow.events`、对共享 schema rollback 或借 production backup
清理 fixture。

runner 输出只允许版本/来源摘要、隔离 scope、阶段 status/code、workflow reference hash
及 version、public redaction 断言、事件与幂等计数/角色断言和 cleanup 结果。不得输出
workflow/用户/reviewer UUID、S2S secret、Bearer token、cookie、DSN、原始事件或 HTTP
payload、Flarum payload、catalog/Compose 环境、SQL、stack、URL 或 IP。Fixture identity/
session/post 的 seed 和删除、事件枚举与 database 销毁、planning resolver（无 HTTP 路由）
及 outer public history（Identity 只公开 list/release）都不能经 Workflow HTTP 安全实现；
runner 不能在其受控环境完成这些步骤时必须 fail closed。

## 非目标与 ADR 判断

- 不执行或模拟工作流，不实现节点图、Capability Broker、Agent binding、安装、下载、URL 跳转或本地文件访问。
- 不修改 shared catalog、Admin resource channel、Identity/Flarum schema/runtime、客户端 IPC、catalog/state 或生产数据。
- 不把帖子、竞品内容、热度、评级或免责声明当作执行事实或安全审核。
- 不把聚焦测试称为真实用户、封包或生产验收。

本轮不新增 ADR：候选 seam 默认关闭、可整体删除，migration 未接生产，未形成不可逆承诺；因此尚未同时满足“难以逆转、令人意外、存在真实权衡”三项门槛。若批准将 schema 接入生产 migration 或确定长期服务所有权，再由 CTO 触发 ADR。
