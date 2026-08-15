# 统一资源投稿客户端入口契约

当前客户端只展示一个全局“提交资源”入口。它进入候选提案说明页；在后端
capability 可用前，按钮必须禁用，不能创建草稿、写入目录、模拟成功或授予受管
安装、Agent 绑定和 Workflow 依赖。各资源商店只能链接回这个入口，不能复制
表单、路由或状态。

## 唯一领域模型

客户端不定义投稿状态机。`admin/resource-submissions.cjs` 是投稿 kind、status、
revision、audit、归属、查重与合并署名的唯一合同；Identity HTTP 和 Electron
Identity client 只是认证、持久化与传输适配器。

支持 kind 固定为 `vendor`、`agent`、`skill`、`mcp`、`plugin`、`connector`、
`workflow`。状态固定为 `draft`、`submitted`、`triaged`、`needs-evidence`、
`accepted`、`rejected`、`withdrawn`、`merged`，客户端不得发明 `pending` 等第二套
状态。

## Capability 与“我的投稿”边界

客户端必须先只读请求：

```text
GET /v1/resource-submissions/capability

ResourceSubmissionCapability {
  enabled: boolean
  supportedKinds: SubmissionKind[]
  temporarilyUnavailableKinds?: SubmissionKind[]
  authenticationRequired: true
  proposalSchemaVersion: 1
}
```

只有 `enabled=true` 才能在登录后启用表单。当前服务默认返回 `false`；renderer 已接入
owner-only main/preload IPC 的 candidate UI，但 capability=false、未登录或 IPC 失败时入口
仍不可提交，且不保留本地投稿状态。当前 `workflow` 虽然仍是领域 kind，但 Identity 没有可信 release lookup，
所以 capability 的 `temporarilyUnavailableKinds` 必须包含 `workflow`，preload 也会
拒绝 workflow create/update，不能伪装成功。

preload 只暴露以下固定方法：

```text
getSubmissionCapability()
createSubmission({ idempotencyKey, submission })
listOwnSubmissions({ offset?, limit? })
getOwnSubmission({ submissionId })
updateSubmissionDraft({ submissionId, expectedRevision, submission })
submitSubmission({ submissionId, expectedRevision })
addSubmissionEvidence({ submissionId, expectedRevision, evidenceRefs })
withdrawSubmission({ submissionId, expectedRevision })
```

所有方法都返回固定的 fulfilled envelope，不以 rejected Electron IPC 的
`error.message` 传递业务错误：

```text
SubmissionIpcResult<T> =
  | { ok: true, value: T }
  | {
      ok: false,
      error: {
        code: fixed submission error code
        status: 400 | 401 | 404 | 409 | 429 | 502 | 503
        messageKey: fixed resources.submit.* key
      }
    }
```

main 保留原始 cause 日志，但 envelope 不得包含 IPC channel、异常类、stack、URL、
数据库或 secret。preload 对 Electron invoke reject、畸形 envelope 和本地参数校验
统一返回安全失败结果；renderer 只按 `ok` 分支并通过 `messageKey` 取本地化文案，
不得解析 `Error.message`。

main 每次 owner 调用都先重新确认当前 Identity session，再通过现有
`identity-client.cjs` 调用 owner HTTP。renderer 不能传 `identityId` 或自证所有权；
capability=false 时 identity client 在任何 owner HTTP 读写前失败关闭。

后续 UI 只能调用下列 owner-scoped seam：

```text
POST /v1/me/resource-submissions
  Idempotency-Key: opaque client-generated key
  body: ResourceSubmissionProposal

GET /v1/me/resource-submissions?offset=0&limit=20
GET /v1/me/resource-submissions/:submissionId

POST /v1/me/resource-submissions/:submissionId/actions
  body: { expectedRevision, action, submission? | evidenceRefs? }
```

用户 action 只允许保存草稿 `update`、`submit`、补证据 `evidence` 和 `withdraw`。
`expectedRevision` 冲突返回 `409`；跨用户读取或写入返回 `404`，避免确认他人投稿
是否存在。分页上限为 100。

### OwnerSubmission DTO

“我的投稿”只能接收下列私有 owner DTO：

```text
OwnerSubmission {
  submissionId
  expectedRevision
  status
  proposal
  allowedActions: (update | submit | evidence | withdraw)[]
  evidenceRequired
}
```

`allowedActions` 由服务端按当前状态派生。DTO 不含 `reviewerId`/`reviewedBy`、
`reviewStatus`、`riskLevel`、merge target/contributors、audit、查重 fingerprint 或
其他用户的 duplicate IDs。客户端不能从 canonical record 自行挑字段形成 owner
DTO。

社区的 `PublicContributionCard` 是另一个只读 DTO，只能由
`createPublicContributionReadModel` 在 `public eligibility === true` 时生成。它可以
包含公开 reviewed status/time、risk 与合并贡献署名，但不能回流为 owner 表单、
保存结果或 mutation state；个人中心也不能复用社区 DTO。

## 身份、审核与安全

- `submittedByIdentityId` 只能由服务端当前会话派生。显示名只是当时的展示快照，
  修改昵称不能改变投稿归属或合并贡献者署名。
- `originalAuthorIdentityId`、`originalAuthor`、`organization`、ownership claim、
  canonical source 和 `discoveredVia` 是不同事实，客户端不得互相代填。
- reviewer 不属于用户 API。客户端不得发送 `reviewerId`、review status、risk 或
  merge decision；出现这些字段必须被拒绝。审核端通过固定服务认证调用独立
  Admin adapter。
- proposal 继续使用严格白名单；拒绝 command/args/env/headers/credentials/
  script/secret、任意执行 endpoint/path 与通用 URL。canonical source、evidence、
  ownership evidence 只能是严格 HTTPS。
- workflow 只提交精确 `{workflowId, version}` release ref；没有后端 release lookup
  时必须拒绝，不能把社区帖子或自由文本当作工作流事实源。
- 投稿与活动签名目录彻底分离。即使审核接受，也只生成 `candidateOnly:true` 的
  merge candidate；不能启用本地执行、固定 profile、受管安装、Agent 调用、
  catalog publish 或 Workflow 依赖。
- `PublicContributionCard.riskLevel` 仅为公开信息。任何 risk 值都不能授予 managed
  install、Agent/Workflow invoke/bind 或其他执行权限；unsafe/rejected 当前继续
  fail closed，不进入公开贡献投影。

## 删除、保留、举报

“撤回”是投稿状态转换，不等于隐私硬删除。用户数据导出、删除、法定保留和审计
脱敏由 Identity 的独立 retention seam 处理；当前没有客户端删除入口。滥用举报
进入独立 moderation seam，不能改变投稿状态或授予审核权限。相关能力在真实
政策、隔离数据库和授权回归完成前同样不可在 UI 中宣称可用。
