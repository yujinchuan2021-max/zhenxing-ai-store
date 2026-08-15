# Workflow Public Store ONLINE but empty

## Symptom

生产 Workflow overlay 已 ONLINE，owner/public capability 开启且 `execution=false`，但 append-only events、idempotency 和 public listing 均为 0。客户端按设计隐藏空频道，因此用户看不到 Workflow Public Store。

## Evidence and root cause

最新生产切换报告为 `output/workflow-production-8e7-server-cutover-20260809/report.json`，报告 SHA-256 为 `4c8b053778778f62bf88febd175b1e53745293ce7bf4079e070ff69480f8d196`。运行状态正常；缺口不是 renderer 或 public DTO 故障，而是没有经过 owner→submit→review→publish 状态机的真实 public Release。

现有系统只有独立 reviewer service identity，没有 official/system publisher seam。用普通用户、直接插入 events 或 renderer 假数据都会破坏作者语义、append-only 审计或单一状态机。

## Candidate remediation

新增 candidate-only 的 `workflow-official-publisher-service` 固定组织身份、严格 public display allowlist、三条 dependency-exact data-only starter manifest，以及只调用既有 owner/reviewer/public adapter 的幂等 bootstrap 编排。部分失败只执行 reviewer unlist，不删除历史。

Identity 侧固定 ID 为 `46564566-f5f4-599c-8ce5-0609069f5148`，状态为 disabled，email/phone/password 为空；数据库候选约束拒绝 profile、avatar、device、session、community handoff 和 email-change relation。public resolver 只有在完整固定行与六类关系均精确通过时才返回组织显示名“枕星 AI”，Identity outer DTO 继续移除 identity ID 和内部 kind。该主体与 production reviewer service identity 严格分离，不能通过环境变量、HTTP body 或 renderer input 覆盖。

## Verification

聚焦单元测试覆盖身份分离、manifest/catalog/post/dependency fail-closed、Composition 禁止执行/商业字段、重复 bootstrap 不新增事件、公开 DTO 脱敏与部分失败补偿下架。新鲜 PostgreSQL candidate 验证首次/幂等 provision、冲突、六类关系拒绝、零引用 rollback，以及出现 Workflow event/idempotency 引用后保留服务身份。

## Remaining acceptance and prevention gate

当前 manifest 的三个 post ID 仅供未来 runner-owned 新鲜隔离 Flarum。生产仍缺真实官方 Flarum posts、Identity image/source closure、manifest-controlled one-shot runner、新鲜 PG+Flarum+HTTP public list/detail 验收和新的单次切换授权，因此 `deployable=false`。今后 Public Store 上线门禁必须同时检查 capability、至少一条真实 public listing、outer DTO 脱敏和 event/idempotency 计数，不能用 ONLINE 或 HTTP 200 代替内容验收。
