# ClawHub 公共枚举 seam 调查（2026-08-14）

## 结论

ClawHub 是 OpenClaw 官方维护的 Skill + Plugin 公共 registry；其数据模型明确把 Skill、code plugin、bundle plugin 分开。AI Hub 当前可以安全采用的最低风险发现 seam 是 ClawHub `robots.txt` 明确放行的两个只读 JSON feed：

- Skill：[`https://clawhub.ai/v1/feeds/skills`](https://clawhub.ai/v1/feeds/skills)
- Plugin：[`https://clawhub.ai/v1/feeds/plugins`](https://clawhub.ai/v1/feeds/plugins)

这两个 feed 是**官方/已验证发布者子集**，不是全站 Skill/Plugin 总量。它们适合做第一批 discovery-only 发现；不应直接生成安装配置，也不应把 `publisher.trust=official` 解释成“AI Hub 已验证代码安全”或“ClawHub 是资源原作者”。ClawHub 的公共 API 文档另明确允许第三方目录复用 public read endpoints，但要求缓存、遵守 `429`/`Retry-After`、链接 canonical listing 且不得绕过隐藏、私有或 moderation 边界；若以后需要覆盖社区资源，应把它作为独立的 API-client 阶段审计，而不是把 `/api/` 当网页抓取入口。[官方概览](https://github.com/openclaw/clawhub/blob/main/docs/clawhub.md)；[API v1](https://github.com/openclaw/clawhub/blob/main/docs/api.md)；[HTTP API](https://github.com/openclaw/clawhub/blob/main/docs/http-api.md)

本轮没有安装 ClawHub CLI，没有登录，没有调用写接口、私有接口或 token-required export，没有下载/预览任何 Skill/Plugin 文件或 bundle，也没有运行第三方代码。对 `clawhub.ai` 的请求始终串行；未遇到 `401`、`403` 或 `429`。

## 一手来源与 canonical seam

| 来源 | 本轮状态 | 可证明的用途 | 结论 |
| --- | --- | --- | --- |
| [官方仓库](https://github.com/openclaw/clawhub) | 公开可读 | 产品归属、仓库实现、MIT 软件许可 | canonical 项目仓库；仓库 README 明确它同时提供 Skill registry 与 native Plugin catalog。 |
| [官方产品概览](https://github.com/openclaw/clawhub/blob/main/docs/clawhub.md) | 公开可读 | 类型、版本、标签、公开状态、CLI 发现命令 | Skill、code plugin、bundle plugin 是不同 package family；版本、标签、变更记录、文件、下载、收藏和安全扫描均由 registry 记录。 |
| [CLI reference](https://github.com/openclaw/clawhub/blob/main/docs/cli.md) | 只读文档；CLI 未安装 | `search`/`explore`/`package explore`/`package inspect` 对应的官方读取协议 | 可从协议实现只读客户端；`inspect` 不安装，但本轮仍未调用，以避免逐项放大请求。 |
| [API v1 overview](https://github.com/openclaw/clawhub/blob/main/docs/api.md) | 公开可读 | 第三方 catalog 复用授权、认证/限流边界 | public read 无 token；第三方目录可复用，但必须缓存、回链 canonical listing、尊重 rate limit，不能旁路 public filters。 |
| [HTTP API reference](https://github.com/openclaw/clawhub/blob/main/docs/http-api.md) | 公开可读 | 精确 endpoint、分页、owner/version/provenance、公共与认证端点分类 | 全量社区发现应使用受文档约束的 API client，不从网页或前端私有数据层推断。 |
| [`robots.txt`](https://clawhub.ai/robots.txt) | `200` | 网页 crawler 边界 | 当前规则为 `Disallow: /api/`、`Disallow: /admin/`，并显式 `Allow: /v1/feeds/plugins`、`Allow: /v1/feeds/skills`。 |
| [`sitemap.xml`](https://clawhub.ai/sitemap.xml) | `404` | sitemap 可用性 | 当前没有可用 sitemap；不能把它当枚举 seam。 |
| [Skills 页面](https://clawhub.ai/skills) | 公开页面，动态列表 | 人工浏览与 canonical listing 检查 | 页面提供 Trending/Featured/Official/New 等浏览入口，但不是稳定、可复算的全量枚举合同。 |
| [Skill feed](https://clawhub.ai/v1/feeds/skills) | `200`，无需登录 | 一次性发现已验证发布者 Skill | 本轮最优先的 Skill discovery seam。 |
| [Plugin feed](https://clawhub.ai/v1/feeds/plugins) | `200`，无需登录 | 一次性发现官方 Plugin | 本轮最优先的 Plugin discovery seam。 |

### 为什么不选其他入口

- `sitemap.xml` 当前 `404`，不可用。
- HTML 列表是动态 UI，适合人审，不提供完整性或稳定分页保证；本轮没有读取 `/_next`、构建产物或前端私有数据层。
- 搜索是检索/相关性 seam，不是完整枚举；不能用搜索结果数推算总量。[CLI reference](https://github.com/openclaw/clawhub/blob/main/docs/cli.md)
- `/api/v1/skills/export` 与 `/api/v1/plugins/export` 的详细 HTTP 文档明确要求 API token，并返回 ZIP；本轮及下一批 discovery-only 均禁止使用。[HTTP API](https://github.com/openclaw/clawhub/blob/main/docs/http-api.md)
- file、download、artifact、scan-report download、登录、发布、删除、迁移和 moderation 管理接口均超出发现范围；即使某个 download endpoint 是 public read，也不应在 discovery 阶段调用。[HTTP API](https://github.com/openclaw/clawhub/blob/main/docs/http-api.md)

`robots.txt` 对通用 crawler 禁止 `/api/`，而官方 API 文档又明确允许第三方 catalog 作为 API client 使用 public read endpoints。这两个边界不应混为一谈：本报告推荐的首批 100 条只使用 robots 显式放行的 feeds；社区全量 API 枚举另行做 purpose-built API-client 审计与授权，不让网页 crawler 访问 `/api/`。

## 2026-08-14 可证规模快照

本轮对两个公开 feed 做了串行、内存内解析；没有保存 raw response，也没有把条目写入 catalog：

| feed | `generatedAt` | `expiresAt` | 可证条目数 | 类型/信任口径 |
| --- | --- | --- | ---: | --- |
| [`clawhub-official-skills`](https://clawhub.ai/v1/feeds/skills) | `2026-08-14T12:31:01.498Z` | `2026-08-21T12:31:00.245Z` | 839 | 839 个 `type=skill`；feed 描述为由已验证 OpenClaw 发布者发布的 Skills；本轮均为 `publisher.trust=official`。 |
| [`clawhub-official`](https://clawhub.ai/v1/feeds/plugins) | `2026-08-14T12:31:01.498Z` | `2026-08-21T12:31:00.245Z` | 84 | 84 个 `type=plugin`；feed 描述为 ClawHub 上的官方 OpenClaw Plugins；本轮均为 `publisher.trust=official`。 |

因此只能报告：**该时点两个官方 feed 共暴露 923 个记录（839 Skill + 84 Plugin）**。这不是 ClawHub 全站唯一资源总数，不能与社区 API、历史版本、别名、隐藏/私有/blocked 内容或其他目录数量相加。

站点 404 页底部存在装饰性重复文本，其中夹有示例数字；它不是统计接口、不是 feed 元数据，也没有可复算口径，本报告明确不采用。公开 Skills 页面也没有给出可审计的全站总数。ClawHub 官方文档说明被 scan hold 或 blocked 的 release 可能从 public catalog 消失，所以任何公开快照都只是“当时可见集合”，不是历史累计量。[官方概览](https://github.com/openclaw/clawhub/blob/main/docs/clawhub.md)

## Skill 与 Plugin 必须分开

### Skill

- Skill 是以 `SKILL.md` 为中心、可带 supporting files 的版本化文本 bundle；其 family 是 `skill`。[Skill format](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md)
- 每次发布产生新的 semver；tag 是指向版本的可移动指针，`latest` 不是版本身份。[Skill format](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md)
- 所有发布到 ClawHub 的 Skill 使用 `MIT-0`，ClawHub 不支持 per-skill license override。该结论只适用于 ClawHub Skill 发布物，不自动证明其上游仓库所有内容的许可。[Skill format](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md)
- canonical 人审页格式由官方文档定义为 `https://clawhub.ai/<owner>/skills/<slug>`；API 客户端仍应优先使用响应提供的 canonical URL，而不是自行猜测路由。[API v1](https://github.com/openclaw/clawhub/blob/main/docs/api.md)

### Plugin

- Plugin 是打包的 OpenClaw extension；公开 catalog 的稳定 Plugin families 是 `code-plugin` 与 `bundle-plugin`。`GET /api/v1/plugins` 是两者的 plugin-only 聚合视图。[官方概览](https://github.com/openclaw/clawhub/blob/main/docs/clawhub.md)；[HTTP API](https://github.com/openclaw/clawhub/blob/main/docs/http-api.md)
- Plugin 记录可包含 compatibility、host target、environment requirement、artifact digest、source link 与版本记录；这些是 package/release 事实，不是执行授权。[How ClawHub Works](https://github.com/openclaw/clawhub/blob/main/docs/how-it-works.md)
- Plugin 发布采用 npm-style package name；scoped package 的 scope 必须与 publish owner 一致。官方发布文档要求提交 source repository 与 exact commit，或让 CLI 从 GitHub checkout 检测它们。[Publishing](https://github.com/openclaw/clawhub/blob/main/docs/publishing.md)
- 本轮一手文档没有给所有 Plugin 设定统一内容许可。不得把 ClawHub 仓库自身的 MIT 许可继承给第三方 Plugin；Plugin 的 source/package license 未独立回源时必须记为 `unknown`。[ClawHub LICENSE](https://github.com/openclaw/clawhub/blob/main/LICENSE)

公开 feed 的 Plugin 顶层只标为 `type=plugin`，本轮观察到的顶层字段没有可靠地区分 `code-plugin` 与 `bundle-plugin`。因此 feed-only 条目只能先记为 `pluginSubtype=unknown`，后续通过公共 package detail/version 元数据闭合；禁止按名字或安装文案猜 family。实验性的 `claw` package family 也不属于本报告的 Skill/Plugin 首批合同。[Experimental Claw packages](https://github.com/openclaw/clawhub/blob/main/docs/claws.md)

## owner、版本、source repo 与 license 的可信度

### Owner / publisher

- feed 中的 `publisher.id` 是 registry publisher handle；样本中 Skill/Plugin `id` 使用 `@owner/name`，scope 与 `publisher.id` 一致。
- owner handle 表示“谁在 ClawHub 命名空间发布”，不等于源代码原作者、商标所有者或 AI Hub 审核方。
- `publisher.trust=official` 是 ClawHub feed 的信任/频道事实；只能原样展示为 provenance，不得改写为“安全”“无风险”或“AI Hub 官方”。ClawHub 本身说明公开发布仍受 scan、moderation 和下架状态影响。[How ClawHub Works](https://github.com/openclaw/clawhub/blob/main/docs/how-it-works.md)

### Version lineage

- Resource 身份与 version 身份分离。semver 版本是精确 release；`latest` 等 tag 只是指针。[Skill format](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md)
- Skill rename 会保留旧 slug redirect；merge 会隐藏 source listing 并把旧 slug 重定向到 canonical target。soft-delete 期间 slug 保留，已使用的版本号不会因为删除而变成新的 lineage。[CLI reference](https://github.com/openclaw/clawhub/blob/main/docs/cli.md)
- API/CLI 返回 canonical identity 时必须更新 alias map；旧 slug/旧 URL 不能生成第二张资源卡。

### Source repo / provenance

- Skill detail/verify 可以提供 owner-qualified identity；`provenance=server-resolved-github-import` 仅在 ClawHub 实际保存了 GitHub `repo/ref/commit/path` 时成立，否则是 `unavailable`。只有前者可作为强 source lineage。[HTTP API](https://github.com/openclaw/clawhub/blob/main/docs/http-api.md)
- Plugin 发布要求 source repo 与 exact commit；package version/detail 可承载 source、compatibility、verification、artifact metadata。缺字段时保持 `unresolved`，不能从 package scope、publisher handle 或描述文本推断仓库。[Publishing](https://github.com/openclaw/clawhub/blob/main/docs/publishing.md)；[HTTP API](https://github.com/openclaw/clawhub/blob/main/docs/http-api.md)
- 同一 GitHub 仓库可能包含多个 Skill/Plugin；repo 相同不等于资源相同。只有 `repo + exact commit + path + declared registry identity` 同时闭合时，才允许建立 cross-source identity 关系。

### License

- Skill：记录 `registryLicense=MIT-0`；若还展示 source repo license，则必须另取 exact repo/commit 的许可证据，并单独记为 `sourceLicense`。
- Plugin：feed-only 阶段记录 `registryLicense=unknown`、`sourceLicense=unknown`；后续从 package metadata 与 canonical source repo 独立闭合。
- ClawHub 软件仓库的 MIT 只描述 registry 软件本身，不是第三方内容的 blanket license。[ClawHub LICENSE](https://github.com/openclaw/clawhub/blob/main/LICENSE)

## 下一阶段：精确 100 条 discovery-only 合同

### 1. 请求预算与停止规则

1. 串行 GET [`/v1/feeds/skills`](https://clawhub.ai/v1/feeds/skills)，解析完成并释放 response 后，再 GET [`/v1/feeds/plugins`](https://clawhub.ai/v1/feeds/plugins)；同 host concurrency 固定为 `1`。
2. 每个 feed 每轮最多一次成功读取；缓存至少到 feed 的 `expiresAt`。缓存未过期时不重取。
3. 任何一个请求返回 `401`、`403` 或 `429`：立即停止整批，不重试、不换 User-Agent、不改路径、不回退到 HTML/`/_next`/私有接口；保留状态码和 `Retry-After` 作为阻断证据。
4. 其他非 `200`、JSON/schema 错误、feed id 漂移、缺少 `generatedAt`/`expiresAt`/`entries`、条目数不足配额：fail closed，输出 0 条候选，不用社区 API 补齐。
5. 不读取 `install.candidates`，不调用 inspect/file/download/artifact/scan/export，不安装 CLI，不执行包，不保存原始 HTML/JSON body。只保存下述 allowlisted discovery facts。

### 2. 输入校验

每条 feed entry 必须满足：

- exact top-level `type` 是 `skill` 或 `plugin`，且与 feed 匹配；
- `id` 符合 `@owner/name`，normalize 后唯一；
- `publisher.id` 非空，且与 scoped `id` 的 owner 一致；
- `version` 是可解析的 semver（允许 prerelease）；
- `state=available`；
- `publisher.trust=official`；
- `title` 与 `description` 仅作为 registry-supplied display facts，不转译成安全/能力保证。

先按下一节的 key 对完整 feed 排序并锁定 80/20 个原始位置，再做上述校验。锁定集合中任何一项不满足即把整批标为 blocked，并把原因记入 `reviewLedger`；不拿后续条目补成“100 个看似通过”的结果。

### 3. 确定性取样

- Skill：按规范化 `id` 升序并按 exact resource key 去重，锁定前 **80** 条。
- Plugin：按规范化 `id` 升序并按 exact resource key 去重，锁定前 **20** 条。
- 合计必须恰好 **100** 条。当前 839/84 快照足以满足；未来若任一配额不足则整批 blocked，不把 Skill 挪给 Plugin，也不调用社区 API 补位。
- 所有条目统一标为 `classification=discovery-only`、`candidateOnly=true`、`publishable=false`、`installProfileId=""`。这 100 条不是 active catalog、不是安装建议、不是安全审计 PASS。

### 4. 允许保存的字段

```text
sourceId                 = "clawhub"
feedId                   = exact feed.id
feedGeneratedAt          = exact feed.generatedAt
resourceKind             = "skill" | "plugin"
pluginSubtype            = null  # feed 阶段不猜 code/bundle
registryId               = exact entry.id
ownerHandle              = normalized entry.publisher.id
publisherTrust           = exact entry.publisher.trust
title                     = exact entry.title
summary                   = exact entry.description
latestObservedVersion     = exact entry.version
state                     = exact entry.state
featured                  = exact entry.featured
canonicalUrl              = null until returned/resolved by an official detail seam
versionLineageStatus      = "feed-latest-only"
sourceRepo/ref/commit/path = null
sourceProvenance          = "unresolved"
registryLicense           = "MIT-0" for Skill; "unknown" for Plugin
sourceLicense             = "unknown"
classification            = "discovery-only"
candidateOnly/publishable = true/false
installProfileId          = ""
```

禁止字段包括 command、args、env、headers、credentials、token、endpoint、download URL、artifact URL、file bytes、install candidate 和任何 state-write/自动执行信息。

### 5. Dedupe keys

```text
resourceKey
  Skill  = clawhub:skill:<lowercase-normalized-registryId>
  Plugin = clawhub:plugin:<lowercase-normalized-registryId>

versionKey
  = <resourceKey>@<exact-semver>

publisherKey
  = clawhub:publisher:<lowercase-ownerHandle>

strongSourceKey (只有 provenance 闭合后才生成)
  = github:<lowercase-owner/repo>@<exact-commit>:<normalized-path>
```

规则：

- `skill` 与 `plugin` 即使 `registryId` 文本相同也不合并。
- tag、featured、下载数、星标数、标题和描述都不是 identity。
- rename/merge 的旧标识只进入 `alias -> canonicalResourceKey`，不生成新资源。
- publisher 是关系事实，不是 Vendor/Product 父层；多个资源共享 publisher 不合并资源。
- strong source 相同仍需 declared registry identity 相同才可合并；一个 monorepo 的不同 path 默认是不同资源。
- AI Hub active/history 还要按 canonical URL、registryId、strongSourceKey 三层去重；任一层冲突进入人工 ledger，不静默覆盖。

### 6. 后续 enrichment（不属于首批请求）

首批 100 条只做发现。若后续要进入 candidate catalog，应另开低频 enrichment 批次，逐条通过官方 detail/version/verify 或 canonical listing 闭合：canonical URL、Plugin subtype、owner、exact version lineage、source repo/ref/commit/path、license、moderation/security state。若 source/license/canonical identity 仍缺失，保留 discovery-only，不创建可安装卡片。任何 public listing 或 feed 的 `official`/scan badge都不替代上游 publisher、license 与实际运行风险核验。[API v1](https://github.com/openclaw/clawhub/blob/main/docs/api.md)；[HTTP API](https://github.com/openclaw/clawhub/blob/main/docs/http-api.md)

## 最终判定

- **PASS：** ClawHub 可作为 AI Hub 的官方 Skill/Plugin discovery source。
- **首选 seam：** robots 显式允许的两个官方 feed；两次串行 GET 即可得到当前官方/已验证发布者子集。
- **社区扩展 seam：** 官方 public read API/CLI protocol，需另行作为 API-client 阶段，遵守缓存、canonical URL、pagination、moderation 和 rate-limit 合同。
- **不通过的做法：** 抓动态 HTML/`/_next`、用搜索结果冒充全量、登录或调用 token/private/export、下载/执行 bundle、把 feed 数量当全站总量、把 publisher trust 当源作者/安全审计、把 Plugin 继承为 MIT。
- **当前规模口径：** 2026-08-14 的两个 feed 快照为 839 Skill + 84 Plugin = 923 条官方/已验证发布者记录；不报告 ClawHub 全站总量。

本报告只定义 discovery seam 与下一批合同；没有修改 AI Hub catalog、state、channel、release、App、server 或 package。
