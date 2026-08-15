# Identity Workflow Store gateway candidate

Status: candidate-only, disabled by default. This document records an interface boundary; it does not authorize a migration, deployment, catalog write, or production enablement.

## Ownership and facts

`community/workflow-store.cjs` remains the only workflow domain state machine. `community/workflow-persistence.cjs` remains the persistence and owner/reviewer/public adapter candidate. Identity is only the authentication and transport gateway: it derives the current immutable owner from the access session, authenticates the reviewer through a fixed service-to-service credential, and provides safe HTTP/Electron boundaries. Flarum is referenced only through an injected exact-post resolver and is not the workflow fact store.

The migration remains the explicit candidate under `community/migrations/candidates/`. It is not included in `identity/schema.sql`, an entrypoint, Compose, or a runtime migration job.

## Enablement gate

The gateway enables only when all of the following are literal true or present:

- `workflowStoreEnabled === true`;
- an actual PostgreSQL repository or pool;
- owner, fixed reviewer, and public-identity resolvers;
- exact canonical dependency, license, and Flarum-post async resolvers.

The resource-submission workflow lookup additionally requires `resourceSubmissionsEnabled === true` and `workflowSubmissionLookupEnabled === true`. Any missing switch or resolver makes `workflowSubmissionLookup` false. Every lookup calls the current public release projection, so an unlist immediately returns false; no permanent positive cache exists.

The public read seam is independent and requires `workflowPublicStoreEnabled === true`, a real repository or pool, and the public Identity display-name resolver. It does not enable owner or reviewer actions. `identity/server.cjs` maps this only from `AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED=1` plus the candidate schema-version gate; the default and current Compose configuration remain disabled.

`identity/server.cjs` is intentionally fail closed. Its defaults are false, Compose has not been changed, and the three external fact resolvers are not injected. Environment flags alone therefore cannot enable the candidate.

## Fixed HTTP and Electron seams

Owner HTTP routes are the Community candidate routes under `/v1/community/workflow-store/owner/`: list/get/create/update/submit/withdraw, exact Flarum post attach/detach, and abuse report. The owner comes only from the Identity access session. Mutations use `Idempotency-Key`; every existing-draft mutation also uses `expectedRevision`. List accepts only bounded `limit` and opaque `after` pagination.

Reviewer routes stay under `/reviewer/` and require the fixed `x-aihub-workflow-review-secret`; the reviewer UUID is server configuration, never request data. Identity exposes only the fixed public HTTP reads `/public/capability`, `/public/list`, and exact `/public/release?workflowId=...&version=...`, reusing the Community public adapter. Missing, unlisted, unsafe, and otherwise unavailable exact releases all return `PUBLIC_WORKFLOW_UNAVAILABLE` without an internal reason.

Electron exposes only these owner methods: `getWorkflowStoreCapability`, `createWorkflowDraft`, `listOwnWorkflowDrafts`, `getOwnWorkflowDraft`, `updateWorkflowDraft`, `submitWorkflowDraft`, `withdrawWorkflowDraft`, `attachWorkflowPost`, `detachWorkflowPost`, and `reportWorkflowRelease`. Main derives the active Identity session for every owner operation. Renderer cannot send an identity or reviewer. The client rechecks capability before every network operation.

Electron additionally exposes four anonymous read-only candidates: `getWorkflowPublicCapability`, `listPublicWorkflows`, `getPublicWorkflow`, and `resolvePublicWorkflow`. Both exact methods accept only `{workflowId,version}`; list accepts only bounded `limit`, UUID `after`, and `riskLevel` in `low|guarded`. There is no public create, update, review, import, execute, invoke, bind, or arbitrary URL/path method. The public DTO is a second strict allowlist built from the Community projection and excludes owner/reviewer/audit/internal fields, evidence URLs, discovered-via data, and secret placeholders. It is display data only and grants no installation or runtime authority.

Public attribution has two deliberately separate display fields. `author.displayName` is the current public display name of the submitting Identity. Identity uses the Community projection's immutable `originalAuthorIdentityId` only as an internal resolver key and may add `originalAuthorDisplayName` when the resolver returns the same immutable identity plus one valid current public display name. Neither identity ID is emitted by Identity HTTP, Electron main, or preload. The original-author field is optional: a missing resolver result, resolver error, mismatched identity, unknown profile field, blank value, control/format character, HTML or entity markup, URL-like text, credential-like text, or a value over 160 characters causes only that field to be omitted. It is never inferred from the proposal, an old nickname, the submitter, canonical source, or the active session.

The current Identity schema has no trusted public organization attribute; `community_profiles` provides only nickname, avatar, and bio. Therefore this candidate does not add `originalAuthorOrganization`. A future organization field requires its own authoritative public-profile source and explicit allowlist change; renderer must not derive one.

All ingress is capped at 128 KiB and rejects unknown or prototype-bearing objects and execution/secret fields such as `command`, `args`, `env`, `headers`, `credentials`, `script`, `secret`, `endpoint`, and `path`. Idempotency keys are carried separately and are not copied into domain JSON.

## Safe error contract

HTTP and Electron failures expose only `{code,status,messageKey}`. Raw cause, IPC channel, exception class, SQL, URL, stack, reviewer identity, risk, audit, and secret values stay in server/main diagnostics.

| messageKey | 中文建议文案 | English suggested text |
| --- | --- | --- |
| `workflow.store.loginRequired` | 请先登录后管理工作流。 | Sign in to manage workflows. |
| `workflow.store.accessDenied` | 无权执行此工作流操作。 | You are not allowed to perform this workflow action. |
| `workflow.store.notFound` | 未找到该工作流。 | This workflow was not found. |
| `workflow.store.conflict` | 工作流已在其他位置更新，请刷新后重试。 | This workflow changed elsewhere. Refresh and try again. |
| `workflow.store.rateLimited` | 操作过于频繁，请稍后重试。 | Too many requests. Try again later. |
| `workflow.store.unavailable` | 工作流功能尚未启用。 | The workflow feature is not available yet. |
| `workflow.store.invalid` | 工作流请求无效，请检查后重试。 | The workflow request is invalid. Check it and try again. |
| `workflow.store.serviceUnavailable` | 工作流服务暂时不可用，请稍后重试。 | The workflow service is temporarily unavailable. Try again later. |
| `workflow.store.failed` | 工作流操作未完成，请稍后重试。 | The workflow operation did not complete. Try again later. |
| `workflow.public.unavailable` | 该公开工作流当前不可用。 | This public workflow is not available. |

These are localization keys and candidate copy only. This task does not add renderer UI or enable the entry point.

## Acceptance boundary

Unit and isolated PostgreSQL tests can validate the gate, routes, DTO separation, revision/idempotency behavior, migration apply/rollback, and safe envelopes. They do not constitute production database, real Identity/Flarum, packaged-client, user-machine, or production acceptance. A later authorized release must provide and independently verify all three exact external resolvers before changing any switch.

The formal temporary acceptance runner uses only its own fresh Identity/PostgreSQL/Flarum
project. Its fixed `sourceCommunityPostId` is `2147483647`; the real internal Flarum API
must return that same ID. The Flarum `posts.id` fixture range ends at `4294967295`, so an
over-range reference, external mapping, resolver mock, or production-community post fails
closed. The full event, redaction, and cleanup contract remains in
`community-workflow-store-candidate.md`; this note does not add an HTTP route or a seed API.
