# Workflow official publisher service identity candidate

状态：`candidateOnly=true`、`deployable=false`。本合同不接入 `identity/schema.sql`、runtime migration、Compose 或生产，也不创建可登录账号。

## 固定身份与数据归属

Identity 只提供 Workflow official publisher 的认证主体、最小受约束记录和公开身份投影；Workflow Draft、Submission、Release、Listing 与 append-only event 仍只属于 `community/workflow-store.cjs`。本候选不复制或绕过 Workflow 状态机。

唯一 production identity 是 URL namespace UUIDv5：

```text
name          https://zhenxing-ai.com/identity/workflow-official-publisher/v1
id            46564566-f5f4-599c-8ce5-0609069f5148
identity_kind workflow-official-publisher-service
displayName   枕星 AI
```

它与 reviewer service identity `5f16d5ac-6663-5905-b920-c2140ac6769c` 严格分离；publisher 不能自审，reviewer 也不能成为公开作者。任何环境变量、HTTP body、renderer input 或 arbitrary UUID 都不能覆盖固定 publisher ID/kind。

## 精确数据库记录与不可登录边界

显式 candidate migration `identity/migrations/candidates/0003-workflow-official-publisher-service-identity.sql` 必须在 `0002` 之后由另行授权的一次性 migration/provision job 调用。它不进入普通 Identity 启动路径。精确记录为：

```text
status              disabled
email               NULL
normalized_email    NULL
phone               NULL
normalized_phone    NULL
password_hash       NULL
username            __workflow_official_publisher_service__
normalized_username __workflow_official_publisher_service__
community_username  zx_46564566f5f4599c8ce50609069
```

数据库约束和 triggers 共同拒绝 `community_profiles`、`profile_avatars`、`devices`、`sessions`、`community_handoffs`、`email_change_challenges`。因此该主体没有昵称/profile/avatar、密码、邮箱、设备、session、cookie、Bearer handoff、SMTP 或浏览器关系；`disabled` 状态也不能进入普通登录查询。固定 technical usernames 只是满足现有 users schema 的内部唯一值，不得公开显示或用于注册认领。

## Provision、verify、rollback 与保留

`identity/workflow-official-publisher-service-identity.cjs` 暴露与 reviewer 相同形态的固定 Identity seam：

- `provisionWorkflowOfficialPublisherIdentity(pool)` 只插入上述固定记录；精确已存在时幂等返回，冲突或任一浏览器关系均 fail closed。
- `verifyWorkflowOfficialPublisherIdentity(pool)` 重新核对完整记录与六类关系。
- `rollbackProvisionedWorkflowOfficialPublisherIdentity(pool, receipt)` 只接受同一 Node 进程本轮首次创建得到的 opaque receipt。receipt 不序列化、不写日志、不作为凭据。

仅当 `community_workflow.events` 和 `community_workflow.idempotency` 均没有该 actor 引用时，当前 provision 可删除本轮新建记录。出现任一引用后，publisher 身份与 Workflow 审计历史必须保留；emergency-disable 只关闭能力，不能删除身份。`0003` schema rollback 同样要求 publisher row 已不存在。

## Public resolver 与 outer DTO

`createPublicIdentityResolver()` 仅在数据库返回完整固定行且六类浏览器关系全部为零时，生成 Community inner projection：

```json
{"identityId":"46564566-f5f4-599c-8ce5-0609069f5148","displayName":"枕星 AI"}
```

查询异常、行字段漂移、额外投影字段、关系存在或记录冲突时返回 `null`。普通 active person 仍按现有 `community_profiles.nickname` 合同解析，不从 publisher、reviewer 或当前登录用户推断。

Identity public Workflow outer DTO 只输出 `author.displayName` 和可选 `originalAuthorDisplayName`；immutable ID、`identity_kind`、technical usernames、reviewer/audit/internal 字段均不进入 main/preload/renderer。Community 当前没有独立的公开组织字段，因此本轮只使用安全 `displayName="枕星 AI"`，不虚构 `organization` 字段。

该展示资格不授予 execute、install、import、invoke、bind 或 Agent Bridge 权限，Owner/Reviewer/Public 现有权限边界保持不变。

## 证据与剩余门禁

聚焦单元测试覆盖固定记录、resolver 精确行/关系/额外字段 fail-closed、普通用户不退化和 outer DTO 去标识。`scripts/test-workflow-official-publisher-service-identity-pg.cjs` 使用新鲜 PostgreSQL 17 验证首次 provision、幂等、冲突、六类关系拒绝、零引用 rollback、Workflow event/idempotency 引用后保留及 public projection。

这些均是本地 candidate 证据，不等于服务器、生产 Identity/Flarum、真实用户或封包验收。

当前 canonical Identity source manifest 为 `output/workflow-official-publisher-identity-candidate-2026-08-09/identity-source-manifest.json`：

```text
source digest       c843b057bdf59f3b1fbfa953e170e46e0445cf5fceca689bd4aa35dc0729e99c
manifest file SHA   f9be221528ea41b5688e4fe1acebefda9816f42f285340c4c08349b1dad0dd49
manifest inputs     67
actual image COPY   65
```

相对旧 `19a223…` 64-input closure，新增 publisher module 和 `0003` apply/rollback 三个文件，并变更 `identity/workflow-resolvers.cjs`；无删除项。因此旧 `19a` image 不可复用。

本地 candidate image 仅用于 closure 交接：

```text
tag       zhenxing-ai/identity:workflow-readiness-candidate-c843b057bdf5
image ID  sha256:082ea027e751a45aa2a997942e8196987400b272cd705bc1d227d8645f20a3bb
size      58,862,444 bytes
label     com.aihub.source-content-sha256=c843b057bdf59f3b1fbfa953e170e46e0445cf5fceca689bd4aa35dc0729e99c
```

逐文件 bytes/SHA、固定 labels、non-root image user、publisher/resolver require closure 与 `/app` secret-shaped path scan 已通过。该 image 没有写入 deployment manifest、Compose 或 cutover；Backend 仍需把精确 image/source 纳入新的 deployment freeze，再进入独立 A–E 与新的单次切换授权。
# Superseding closure for official public-store bootstrap (2026-08-09)

The official public-store one-shot adds its production runner and governed source-post/bootstrap modules to the Identity Docker COPY closure. The recalculated candidate source digest is `f18ec9d51b4e30bb01323e0d1c752d94a4b9e32556ef1e7dd845e3bfcdc358ee` (73 manifest inputs / 71 actual COPY inputs), candidate tag `zhenxing-ai/identity:workflow-readiness-candidate-f18ec9d51b4e`, image ID `sha256:e76979a8c827eb4feb6e1f14026d8813f487535df654838299d139817b856731`. The in-image COPY probe and required module loads passed locally; the earlier `c843…` and d6 images are not valid for this expanded closure.
