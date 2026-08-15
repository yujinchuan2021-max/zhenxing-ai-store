# ClawHub 官方 Feed 首批 100 条 Discovery-only 本地合同修复冻结交接

日期：2026-08-15（保留 2026-08-14 真实采集证据）

状态：**LOCAL CONTRACT FIX FROZEN / candidate JSON 未生成 / 不可发布**

## 结论

2026-08-14 的两次真实采集均安全停止，没有生成 `clawhub-official-feed-first100-discovery-2026-08-14.json`。2026-08-15 仅在 synthetic feed 和注入文件系统上修复本地合同：没有第三次真实 GET，没有生成实际 first100 输出，也没有把测试 fake write 当作生产采集。

历史阻断来自锁定集合内的 Skill `@aws/agents-build`：其 feed `version` 未通过严格 semver。经主审明确授权，只有可安全持久化的一手 ASCII version token 可产生 `metadata-deferred/version-invalid`，而不会伪造版本；identity、type、publisher、exact-key、source、执行/凭据字段和全局 feed/HTTP 错误仍整批停止。该修订不授权拿后续资源补位、猜测版本或请求 enrichment/detail/download。

## 输入与边界

- 一手来源研究：`docs/research/clawhub-public-enumeration-seam-2026-08-14.md`
- 研究报告 SHA-256：`893ac720b78de38f0866779ef282c62232c812c551c646587369f3c13c1f35ee`
- 唯一远端 seam：
  - `https://clawhub.ai/v1/feeds/skills`
  - `https://clawhub.ai/v1/feeds/plugins`
- 每轮固定串行 GET、`redirect=manual`、exact host/path、HTTP 200、`application/json`、2 MiB 解码后正文上限。
- `401`/`403`/`429` 立即停止、不重试；重定向、URL 漂移、非 JSON、超限、JSON/schema 错误全部 fail closed。
- 未调用登录/private API、`/_next`、detail/version/download/artifact/scan/export；未安装或执行 Skill/Plugin。
- 原始 response body 只在内存解析，未落盘；没有保存 header、token、credentials 或 `install.candidates`。

## TDD 证据

首个真实 RED：

```text
node --test tests/clawhub-public-feed-intake.test.cjs
Cannot find module '../shared/clawhub-public-feed.cjs'
tests 1, pass 0, fail 1
```

解析/关系边界随后分片 RED→GREEN，最终离线聚焦命令：

```text
node --test tests/clawhub-public-feed-intake.test.cjs tests/limited-response.test.cjs
tests 10, pass 10, fail 0
```

覆盖项：80/20 exact quota、normalized identity 排序、Skill/Plugin 分型、全 feed kind/identity/duplicate 校验、仅锁定集合 exact schema 校验、publisher scope/trust、严格 semver、available state、不得读取 `install` getter、递归禁字段、确定性序列化、两 feed 串行且各一次、manual redirect、401/403/429/read-zero、URL/content-type/content-length 门禁和流式 byte cap/cancel。

语法与文本门禁：

```text
node --check shared/clawhub-public-feed.cjs
node --check scripts/clawhub-public-feed-intake.mjs
node --check tests/clawhub-public-feed-intake.test.cjs
trailing-whitespace: PASS
```

## 2026-08-14 两次真实采集记录（历史证据）

### 第一轮：实现顺序错误，安全停止

预检：目标 JSON 不存在；ClawHub/OpenClaw/electron-builder/makensis/7z 相关进程为 0；研究目录不是 reparse point；D 盘可用空间 `684759515136` bytes。

结果：

```text
skill entry 120 schema has unexpected fields
exit 1
```

这是实现违反冻结合同，不是来源阻断：实现错误地对完整 feed 先做 exact entry field 校验；正确合同是完整 feed 只校 kind、可规范化 identity 与 duplicate，排序锁定后才对前 80/20 做 exact schema。没有写 JSON。随后新增反例，明确排序后第 120 条 extra field 不阻断，而锁定集合 extra/invalid 仍整批阻断；离线测试 GREEN 后，由主审明确授权仅一次新采集轮次。

### 第二轮：锁定资源版本不满足合同，最终 BLOCKED

重新预检结果与第一轮相同：目标不存在、受控进程 0、目录无 reparse、空间充足；没有缓存旁路。两个 feed 仍按 Skill→Plugin 串行各一次读取。

结果：

```text
@aws/agents-build version must be strict semver
exit 1
```

未遇到 `401`、`403` 或 `429`。由于 compose/locked validation 在两个 feed 都完成内存读取后执行，第二轮两个 endpoint 各读取一次。失败后未重试、未后补、未访问 detail/version seam、未落 raw body，目标 JSON 仍不存在。

## 实际持久化结果

- 发现记录持久化数：`0`
- Candidate resource 数：`0`
- Skill/Plugin quota 达成：`未重新采集，不能作真实达成声明`
- `candidateOnly` JSON：未生成
- `publishable` artifact：未生成
- active catalog/state/channel/release/App/server/package 修改：`0`

本冻结交接不授权按名称修正版本、人工补齐第 81 个 Skill、再次请求 feed、进入 detail/version/download enrichment、合并 catalog、签名、封包或发布。未来任何真实采集仍需单独授权和完整预检；本地 GREEN 不是生产数据验收。

## 2026-08-15 本地合同修复

### 100 条、100 个唯一 outcome

`composeClawHubFirst100` 与 `validateClawHubFirst100` 共同锁定以下结构：

- outer exact allowlist 固定 `candidateOnly=true`、`publishable=false`、`discoveryOnly=true`、`classification=discovery-only`；
- 恰好 80 Skill + 20 Plugin，共 100 个按 `{resourceKind, registryId}` 唯一的 Resource；
- `reviewLedger` 恰好 100 行，与 Resource 按顺序一对一，且每行只投影 `resourceKind`、`registryId`、`outcome`、`failureClass`、`rawVersion`，不复制 title、description 或任意执行/凭据内容；
- 严格 semver 的唯一合法三元组是 `discovered-unreviewed / null / null`，Resource 保存 exact semver 且 `versionLineageStatus=feed-latest-only`；
- 非严格 semver 只有在原值满足 `^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$` 时才形成 `metadata-deferred / version-invalid / <exact safe token>`，Resource 的 `latestObservedVersion=null`、`versionLineageStatus=metadata-deferred`；
- 缺少 `version` key、非字符串、空值、control、超过 64 字符或含其他字符都不是可落盘 metadata，继续整批 `field-invalid` 停止；
- identity、type、duplicate、publisher scope/official claim、entry/feed exact-key、state、source 字段、执行/凭据字段漂移仍整批停止，不生成部分结果也不拿后续条目补位。

Resource 仍只有 discovery allowlist：没有 catalog、install、command、args、env、headers、credentials、token、endpoint、download/artifact URL、file bytes 或 state-write。`install.candidates` 只作为 feed 已知字段存在，compose 从不读取其 getter，也不复制到 artifact。

### 一个 exact validator 保护 generated 与 cache

新 compose 结果、序列化输入和 cached artifact 都必须经过同一个 `validateClawHubFirst100`：

- outer、Resource 和 ledger row 均 exact-key；
- ledger identity 必须与同序 Resource 一致，outcome 三元组必须互斥；
- `installProfileId=""`，source URL/repo/ref/commit/path 保持 `null`，provenance/license/subtype 仍按 discovery 合同固定；
- 恶意 canonical cache 在任何 fetch/open/write 前校验；测试中的非空 `installProfileId` cache 结果为 `read=1, fetch=0, open=0, write=0`。

### 可注入 runner

公开 runner seam 固定为 `runClawHubFirst100Intake({fetchImpl, fsImpl})`。cached read 与 generated bytes 共用上述 validator；只有 fetch、compose、validate、serialize 全部完成后才可 `open(outputPath, "wx")`。

synthetic `@aws/agents-build@latest` 集成测试使用两份内存 response 和 fake filesystem：Skill、Plugin endpoint 各调用一次，顺序固定，成功 `open=1/write=1`，写出的 canonical bytes 含 100 Resource + 100 ledger outcome，其中 99 条 `discovered-unreviewed`、1 条 `metadata-deferred/version-invalid/latest`。测试前后真实目标 JSON 均不存在。

### TDD 证据

Compose tracer RED：

```text
node --test --test-name-pattern="keeps one exact metadata-deferred outcome" tests/clawhub-public-feed-intake.test.cjs
tests 1; pass 0; fail 1
TypeError: @aws/agents-build version must be strict semver
```

最小 compose GREEN：`tests 1; pass 1; fail 0`。

Runner seam RED：

```text
node --test --test-name-pattern="invalid version token runner" tests/clawhub-public-feed-intake.test.cjs
tests 1; pass 0; fail 1
actual "undefined"; expected "function"
```

最小 runner GREEN：`tests 1; pass 1; fail 0`。

最终离线聚焦回归：

```text
node --test tests/clawhub-public-feed-intake.test.cjs tests/limited-response.test.cjs
tests 14; pass 14; fail 0
```

### 四文件 manifest 算法

冻结集合仅包含以下四条路径：

1. `docs/research/clawhub-official-feed-first100-frozen-handoff-2026-08-14.md`
2. `scripts/clawhub-public-feed-intake.mjs`
3. `shared/clawhub-public-feed.cjs`
4. `tests/clawhub-public-feed-intake.test.cjs`

算法固定为：将 repo-relative `/` 路径按 ordinal 升序排列；对每个文件计算 lowercase SHA-256；每行精确写成 `<sha256>  <path>\n`（hash 与 path 之间两个 ASCII 空格）；将四行按 UTF-8、无 BOM 拼接，再对这些 bytes 计算 SHA-256。最终 manifest 值在 handoff bytes 冻结后外部记录，避免把自身 manifest 写回 handoff 造成自引用漂移。

本返修没有修改 ClawHub research 报告、Brave candidate、active catalog/history、state、channel、release、App、server、package 或 schema。共享 dirty worktree 不被宣称为 clean。
