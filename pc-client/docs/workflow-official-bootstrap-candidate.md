# Workflow official starter bootstrap candidate

状态：`candidateOnly=true`、`deployable=false`。本候选没有连接服务器、没有写生产、没有修改 catalog/state/signature，也没有启用 execute/import/install/invoke/bind 或 Agent Bridge。

## 目的与唯一状态机

生产 Workflow Public Store 已 ONLINE，但事件、幂等记录和 public listing 均为 0；客户端按合同在匿名 public list 为空时隐藏频道。本候选不增加 renderer 特例，也不创建第二状态机。它只通过 `community/workflow-persistence.cjs` 已有的 owner、reviewer、public adapter 调用 `community/workflow-store.cjs`，继续由 append-only events 重放 Draft、Release 和 Listing。

公开内容仍由 Identity outer DTO 输出；新增的组织作者投影不会扩宽外部字段。

## Official publisher 身份

固定 ID 为 `46564566-f5f4-599c-8ce5-0609069f5148`（UUIDv5 URL namespace，名称 `https://zhenxing-ai.com/identity/workflow-official-publisher/v1`），身份种类为 `workflow-official-publisher-service`，公开显示名固定为“枕星 AI”。它不是普通用户，也不是 reviewer：

- `status=disabled`；email、phone、password 均为空；
- 禁止 community profile、avatar、device、session、handoff 和 email-change relation；
- 与固定 reviewer `5f16d5ac-6663-5905-b920-c2140ac6769c` 严格分离，不能自审；
- 只有数据库中完整匹配该 governed row 时，public identity resolver 才返回 `{identityId, displayName}` 的 Community inner projection；Identity outer DTO 继续移除 identity ID；
- migration `0003` 与 provision/rollback API 均为 candidate。写入任何 Workflow event/idempotency 后，只允许保留该身份，禁止删除或 schema rollback。

## Manifest 与内容

受控清单位于 `community/workflow-official-bootstrap-candidate.json`。其 catalog source 精确固定为：

- release ID：`catalog-v00000006-567e671621f1-3dcee587`
- catalog version：`6`
- catalog SHA-256：`567e671621f14d7788ecdbe642be738aa5133d9688d45bbae4d0f7760a926d9f`

active release 的 146 个 resource 尚没有同时满足 Workflow resolver 所需的 reviewed/risk/agentBinding tuple，因此本轮没有编造 Skill/MCP dependency。三个 starter 只使用该已验签目录中可精确命中的 product tuple：

| starter | dependency | 输入 → 输出 | 有序步骤 |
| --- | --- | --- | --- |
| 研究资料整理与摘要 | `product/chatgpt-desktop` | `source_material` → `research_brief` | 提取主张 → 区分证据 → 写摘要 |
| 代码变更审查清单 | `product/codex-cli` | `change_summary` → `review_report` | 检查变更 → 排序发现 → 写审查 |
| 长内容分类与重组 | `product/claude-desktop` | `source_text` → `organized_content` | 分类主题 → 建立层级 → 重组内容 |

Composition 是不可变 data-only 有序声明。每一步仅引用 Release 的精确 dependency 和 workflow input 或前序 output；清单拒绝 command/args/env/script/URL/path/secret value/nodes/dependsOn 与价格、订单、支付、entitlement 字段。`published + manually-reviewed + low` 只允许展示，不授予执行、安装、导入或绑定。

候选清单中的 `2147483601`、`2147483602`、`2147483603` 仅为未来新鲜隔离 runner 自有 Flarum DB 的精确 post IDs，均在 `INT UNSIGNED` 上限 `4294967295` 内。它们不是生产 post，不得在生产兼容、映射或回退。生产清单必须改为经 Community/CTO 批准并由真实生产 Flarum API exact GET 命中的三个官方帖子 ID，然后重新冻结整份 manifest。Flarum 帖子由 Community 自有的官方组织发布合同负责；它与不可登录的 Workflow publisher service identity 严格分离，不能建立 profile/session 映射，也不能据帖子作者倒推 Workflow author。

## 幂等、失败补偿与公开验证

`bootstrapOfficialWorkflows()` 是 transport-neutral 的最小编排接口：

```js
await bootstrapOfficialWorkflows({
  candidate,
  manifest,
  publisherIdentityId,
  reviewerIdentityId,
  validation: { verifyCatalogSnapshot, hasCanonicalDependency, hasCommunityPost }
});
```

每条内容使用固定 `<bootstrapId>:<key>:create|submit|review` idempotency key，依次走 owner create、owner submit、reviewer publish，并用 `normalizeWorkflowComposition()` 和 public exact release read 再验证。重复运行返回第一次结果，不追加事件。结果只含 workflow reference、version、标题、摘要、review/risk、public visibility 和 `execution=false`。

任何中途失败都会对本轮已 publish 的条目使用固定 compensating-unlist key 逐条下架；不能删除 events/idempotency，不能回滚 shared schema，也不能用备份抹掉已写历史。尚未发布的 Draft/Submission 保留为审计历史。成功后未来撤回同样只能 reviewer unlist。

## 生产前置与当前阻断

以下全部完成前，本候选不得进入生产写入：

1. Community/CTO 建立并冻结三个真实官方 Flarum 帖子；exact GET 必须返回相同 post ID，禁止 mock、mapping、共享 fixture 或普通用户帖子。
2. Identity 主责复核 `0003` migration、publisher provision/verify/retention 语义，并把新增源码纳入 Identity Docker COPY closure，重建并冻结 image/source label。
3. Backend 主责把 transport-neutral 编排接入 manifest-controlled one-shot runner；runner 必须只接受冻结 manifest，不接受任意路径、URL、identity 或内容覆盖。
4. 测试发布在全新隔离 project 中使用真实 Postgres、MariaDB/Flarum、Identity HTTP 与 Caddy；先验证备份，再验证三条 create→submit→review→publish、重试事件数不变、anonymous public list=3、三条 exact detail、Identity outer DTO 脱敏和失败 compensating unlist。
5. Frontend 只复验现有行为：public list 非空后频道自然出现；不增加 renderer hardcode。Agent Bridge capability 保持 false，execution 保持 false。
6. 重新计算 Identity source/image closure 和 deployment manifest，完成独立 A–E 后再请求一次新的单次生产授权。

价格与购买资格继续属于未来独立 CommercialPolicy/Offer/entitlement；本轮没有价格、货币、订单、退款、税务、结算字段或 UI。
## Official source-post seam (current)

The three readable Flarum source discussions are now governed by `community/workflow-official-source-posts.cjs` and `community/workflow-official-source-posts-candidate.json`. Any older numeric IDs in this document are historical acceptance fixtures only; they are not production references and must not be reused. Production must create fresh posts through the normal Flarum API path, exact-GET each returned ID, then freeze the resulting IDs in a newly approved manifest.

## Full-stack isolated runner

`deployment/community-production/workflow-official-bootstrap-temporary-acceptance.cjs`
is the manifest-controlled, candidate-only full-stack gate. It locks the active7-compatible
Admin candidate (`zhenxing-ai/admin:0.1.40-src-186ff057efd3`), the exact f18ec9 Identity
candidate, the three manifest `sourcePostKey` values, reviewer-service provisioning, and
the Caddy public route. In a runner-owned fresh project it creates the three sources only
through Flarum's admin JSON:API and exact-GET seam, runs the official publisher one-shot,
checks the outer public list and all three details, then unlists only. Workflow events and
schema are never deleted or rolled back after a write.

The active7 catalog is read only from its fixed v2 Admin endpoint; the runner does not
accept a caller URL or mutate the catalog/state. The one-shot's fixed idempotency replay
contract is covered by `tests/workflow-official-bootstrap.test.cjs`; the Docker runner
asserts the resulting nine pre-unlist events and twelve append-only events after unlist.
It remains `candidateOnly=true` and `deployable=false`; no server bootstrap is authorized.

## Frozen one-shot integration (candidate-only)

The static Workflow manifest now stores only the governed `sourcePostKey` values. `bindOfficialWorkflowSourcePosts()` accepts the exact post records returned by the real Flarum source-post seam and creates an immutable, process-local manifest containing the exact canonical `sourceCommunityPostId`; no fixture ID, mapping, truncation, mock, or fallback is accepted. IDs must remain decimal `INT UNSIGNED` values at or below `4294967295`.

`runOfficialWorkflowBootstrapOneShot()` is the only orchestration seam. Its write order is: ensure and exact-verify official Flarum source discussions, bind their IDs, provision and verify the fixed disabled official publisher service identity, then invoke the existing owner create → submit → reviewer publish state machine and verify the Identity outer public list/detail projection. Re-running the same frozen manifest uses the existing idempotency keys and must add zero source posts and zero Workflow events; the public projection must contain the three starter releases.

If a failure occurs before any Workflow event references a source post, the one-shot may use the current opaque receipts to remove only this invocation's newly-created, unreferenced Flarum discussions and publisher row. Once an owner/reviewer event references a post or actor, all history and schema remain; compensation is reviewer `unlist` only. Public verification is allowlisted and never includes identity IDs, reviewer/audit fields, secret values/placeholders, or commercial/execution/install/import/bind fields.

Production wiring is an explicit Compose profile `workflow-official-bootstrap`; the base ONLINE overlay does not start it automatically. The local candidate Identity COPY closure is source digest `f18ec9d51b4e30bb01323e0d1c752d94a4b9e32556ef1e7dd845e3bfcdc358ee` (73 manifest inputs, 71 actual COPY inputs); image `zhenxing-ai/identity:workflow-readiness-candidate-f18ec9d51b4e`, ID `sha256:e76979a8c827eb4feb6e1f14026d8813f487535df654838299d139817b856731`. Its source-digest label, non-root `node` user, all 71 copied file bytes/SHA-256 values, required official modules, and `/app` secret-shaped/private-key scans were verified locally. The production forum API-key file accepts only no terminator or one terminal LF; all other line-ending, control, boundary-whitespace and length drift fails closed. No server was contacted and no bootstrap content was written; `candidateOnly=true` and `deployable=false` remain until Test/Release runs a fresh isolated A–E.
