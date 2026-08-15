# Official MCP Registry run3 source signals 一手来源复核

- 复核日期：2026-08-15（Asia/Shanghai）
- 状态：冻结研究结论；只读、discovery-only；不是 catalog 发布授权、安装授权或安全认证
- 范围：只复核 run3 handoff 已映射的 12 条 source-signal；不扩到 run3 其他记录
- 输出：本文件是本轮唯一新增文件；自身 SHA-256 在冻结回传中给出，避免把自引用哈希写入正文

## 结论

12 条 Registry 记录的裁决为：

| 裁决 | 行数 | 含义 |
|---|---:|---|
| `duplicate-lineage` | 11 | 已有 Resource 的同一 server/package lineage、旧版本、transport/distribution 形态或固定 release；不得再建卡 |
| `distinct-server` | 0 | 没有一条同时具备独立 publisher-owned implementation/service identity 的充分证据 |
| `deferred` | 1 | `io.github.PremierInc/azure-devops@v0.0.1` 的服务身份仍未闭合；既不能合并，也不能新建 |
| 合计 | 12 | 算术闭合：11 + 0 + 1 = 12 |

这 12 行映射到 11 个唯一 `resourceId`；两个 Brave Registry 身份都落在 `brave-search-mcp-server`。11 条 duplicate 覆盖 10 个唯一已有 Resource，1 条 deferred 对应另 1 个已有映射。`duplicate-lineage` 只说明身份去重，不继承新版安全结论、Registry `verified` 含义、hosted service 可用性或 publisher endorsement。

## 冻结输入与判断门槛

| 输入 | SHA-256 | 本轮用途 |
|---|---|---|
| `docs/research/official-mcp-registry-run3-complete-triage-handoff-2026-08-15.md` | `627dae3b82e749c451925a21bd9812055443de0814aa99ca98bae94f6a40cddc` | 锁定 exact 12 行及既有 `resourceId` 映射 |
| `output/research/official-mcp-registry-intake-2026-08-15-run3/registry-index.ndjson` | `a0ac7fe2e126b7c65eb4b6ff700ea71a5fb95c17b2db57518d9fd1fb5606ba7a` | 锁定 Registry normalized signal；未调用其中 MCP endpoint |
| `docs/research/official-unbound-mcp-d12-d16-catalog-v3-candidate-2026-08-15.json` | `3efc8e7e8f1e417d38982e630247c845da3d9f1876afa3cc5a997b5138929cba` | 核对已有 Resource provenance；未编辑 candidate |

裁决门槛：

- `duplicate-lineage`：不能只凭同仓库；至少要由固定 commit/tag 下的 MCP name、package/container identity、版本、明确子目录，或第一方文档对 local/remote 同一家族的说明闭合。
- `distinct-server`：必须有独立发布者拥有的实现、服务 endpoint identity 或 tool contract；仅 namespace、hosted wrapper、镜像或不同 transport 不足以拆卡。
- `deferred`：现有证据互相暗示但缺少上述闭合条件；保持不合并、不新建。
- 第一方边界：代码发布者的仓库用于确认实现 lineage；托管平台页面只确认其自身 distribution/session 事实，不能把托管平台声明转移给上游作者。

## 逐行复核

| # | Exact Registry ID | 既有 `resourceId` | 固定一手身份与版本证据 | 裁决 | 冲突、边界与后续动作 |
|---:|---|---|---|---|---|
| 1 | `ai.adeu/adeu@1.7.1` | `adeu-mcp-server` | Adeu `v1.7.1` 固定 commit `5b41cca9c83b1a3231f2564ef1ff02f750f7bb3c`；[package.json](https://github.com/dealfluence/adeu/blob/5b41cca9c83b1a3231f2564ef1ff02f750f7bb3c/node/packages/mcp-server/package.json) 同时声明 `@adeu/mcp-server@1.7.1`、`mcpName=ai.adeu/adeu` 与同一 repo。已有 Resource 固定为 `ai.adeu/adeu@2.4.0`、commit `55f271eb7024d428e5a8f62819ff1376a138166c`。 | `duplicate-lineage` | 同 MCP/package/repo 的旧 release；不能把 2.4.0 的功能、安全或安装审查倒灌给 1.7.1。 |
| 2 | `ai.smithery/brave@2.0.58` | `brave-search-mcp-server` | Brave `v2.0.58` 固定 commit `59cca5d812f6b43f09c09e84b1b0d8196356f1cb`；[package.json](https://github.com/brave/brave-search-mcp-server/blob/59cca5d812f6b43f09c09e84b1b0d8196356f1cb/package.json) 声明 `@brave/brave-search-mcp-server@2.0.58`、`mcpName=io.github.brave/brave-search-mcp-server`，并含 Smithery 构建接线；[Smithery server page](https://smithery.ai/servers/brave) 指向同一 Brave repo/tool surface，并说明其 hosted connection/session。 | `duplicate-lineage` | 这是同一 Brave server lineage 的 Smithery 托管分发，不是第二实现。Smithery 的 qualified name、认证、运行可用性与 SLA 只属于分发层，不能升级为 Brave endorsement。 |
| 3 | `io.github.ChromeDevTools/chrome-devtools-mcp@1.7.0` | `google-chrome-devtools-mcp` | tag `chrome-devtools-mcp-v1.7.0` 固定 commit `774d78f5eef5e610407a0c92fa6ec5ed74b027e8`；[package.json](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/774d78f5eef5e610407a0c92fa6ec5ed74b027e8/package.json) 精确闭合 package/version/MCP name/repo，author 为 Google LLC，license 为 Apache-2.0。 | `duplicate-lineage` | 既有 Resource 虽采用 rolling 版本口径，server identity 相同；固定 1.7.0 不应另建卡。 |
| 4 | `io.github.PagerDuty/pagerduty-mcp@0.2.1` | `pagerduty-official-mcp` | 固定 commit `22adbf1967215083e4afde5a09d4de5959d402f8`；[server.json](https://github.com/PagerDuty/pagerduty-mcp-server/blob/22adbf1967215083e4afde5a09d4de5959d402f8/server.json) 精确声明 Registry name、`0.2.1`、PyPI `pagerduty-mcp`、stdio 与 repo；同 commit 的 [pyproject.toml](https://github.com/PagerDuty/pagerduty-mcp-server/blob/22adbf1967215083e4afde5a09d4de5959d402f8/pyproject.toml) 已是 `1.1.0`。 | `duplicate-lineage` | 既有 Resource 明确建模 PagerDuty hosted+local family。`server.json=0.2.1` 与代码包 `1.1.0` 有版本漂移；0.2.1 只能保留为 Registry observed release，不能称当前代码版本。 |
| 5 | `io.github.PremierInc/azure-devops@v0.0.1` | `microsoft-azure-devops-mcp` | Microsoft 固定 commit `6330dab67868c1f54ee670ed0edf06f3d45ea4c3`；[server.json](https://github.com/microsoft/azure-devops-mcp/blob/6330dab67868c1f54ee670ed0edf06f3d45ea4c3/server.json) 的官方身份是 `com.microsoft/azure-devops@2.4.0`，并记录 Microsoft-hosted remote；[Microsoft Learn](https://learn.microsoft.com/en-us/azure/devops/mcp-server/mcp-server-overview?view=azure-devops) 说明 Azure DevOps 有官方 remote 与 local server。 | `deferred` | Run3 行却是 PremierInc namespace、`v0.0.1`、remote-only；normalized snapshot 未保留可比 endpoint，也没有 PremierInc-owned immutable manifest。要判 duplicate，需 exact endpoint/manifest 证明其直接指向 Microsoft service 且无 wrapper；要判 distinct，需独立实现或服务 contract。当前两者都没有。 |
| 6 | `io.github.brave/brave-search-mcp-server@2.1.0` | `brave-search-mcp-server` | 既有固定 commit `937e85a61f69e36f5a88e44308d47836a8d5d523`；[package.json](https://github.com/brave/brave-search-mcp-server/blob/937e85a61f69e36f5a88e44308d47836a8d5d523/package.json) 精确声明 `@brave/brave-search-mcp-server@2.1.0`、exact MCP name、Brave author/repo；同 commit [LICENSE](https://github.com/brave/brave-search-mcp-server/blob/937e85a61f69e36f5a88e44308d47836a8d5d523/LICENSE) 为 MIT。 | `duplicate-lineage` | 版本、package、MCP name、repo 与既有 Resource 的固定 provenance 一致；只保留 Registry observation，不增卡。 |
| 7 | `io.github.docling-project/docling-mcp@3.1.0` | `docling-mcp` | Docling `v3.1.0` 固定 commit `7276df8894efe7f2bd08750f58e6a843e2ebaa4e`；[pyproject.toml](https://github.com/docling-project/docling-mcp/blob/7276df8894efe7f2bd08750f58e6a843e2ebaa4e/pyproject.toml) 精确闭合 `docling-mcp@3.1.0`、entry point、repo 与 MIT license。 | `duplicate-lineage` | 既有 rolling official Resource 与此固定 release 是同一 server；固定版本不构成独立资源。 |
| 8 | `io.github.getsentry/sentry-mcp@0.25.0` | `sentry-mcp` | Sentry `0.25.0` 固定 commit `0340251967cff36b8cff316dec0346c223bcbff8`；[packages/mcp-server/package.json](https://github.com/getsentry/sentry-mcp/blob/0340251967cff36b8cff316dec0346c223bcbff8/packages/mcp-server/package.json) 精确闭合 MCP name、`@sentry/mcp-server@0.25.0`、subfolder、author/repo，并声明 `FSL-1.1-ALv2`。 | `duplicate-lineage` | 同一 Sentry MCP server。license 必须按固定 manifest 记录；现有文案中的“开源”不能替代或弱化 `FSL-1.1-ALv2` 边界。 |
| 9 | `io.github.github/github-mcp-server@1.9.0` | `github-copilot-mcp` | GitHub `v1.9.0` annotated tag 解引用到 commit `cdfa34e0a9d3e1ae6825345471f25185dd61d74e`；[server.json](https://github.com/github/github-mcp-server/blob/cdfa34e0a9d3e1ae6825345471f25185dd61d74e/server.json) 精确闭合 Registry name、repo、OCI `ghcr.io/github/github-mcp-server:1.9.0`，并同时列 stdio/remote transport。 | `duplicate-lineage` | 既有 ID 名称含 `copilot`，但其 Resource name/source provenance 是 GitHub MCP Server family；ID alias 不构成第二 server。 |
| 10 | `io.github.microsoft/playwright-mcp@0.0.79` | `microsoft-playwright-mcp` | Microsoft Playwright `v0.0.79` 固定 commit `4c5077651542f68525a0b51e97bab2a32abc9290`；[package.json](https://github.com/microsoft/playwright-mcp/blob/4c5077651542f68525a0b51e97bab2a32abc9290/package.json) 精确闭合 `@playwright/mcp@0.0.79`、MCP name、repo、Microsoft author 与 Apache-2.0。 | `duplicate-lineage` | 既有 rolling Resource 与固定 0.0.79 是同一 package/server；不增卡。 |
| 11 | `io.github.tomyud1/godot-mcp@0.5.0` | `godot-mcp` | community repo `v0.5.0` 固定 commit `f794f7f4d3029172c06a7ebee02543e12dbf60ef`；[mcp-server/package.json](https://github.com/tomyud1/godot-mcp/blob/f794f7f4d3029172c06a7ebee02543e12dbf60ef/mcp-server/package.json) 与 [mcp-server/server.json](https://github.com/tomyud1/godot-mcp/blob/f794f7f4d3029172c06a7ebee02543e12dbf60ef/mcp-server/server.json) 精确闭合 `godot-mcp-server@0.5.0`、MCP name、repo/subfolder 与 MIT。 | `duplicate-lineage` | 身份与既有 Resource 相同，但固定来源发布者是 community author `tomyud1`；既有 `publisher="Godot Engine"` 不能据此升级为官方关系，应另行修正 publisher 事实。 |
| 12 | `io.snyk/mcp@1.1304.2` | `snyk-studio-mcp` | Snyk CLI `v1.1304.2` 固定 tag commit `3a70970868b8dd40f3a01c0267da85043c6a947b`；[CLI package.json](https://github.com/snyk/cli/blob/3a70970868b8dd40f3a01c0267da85043c6a947b/package.json) 固定该 release 的 package lineage。Snyk Studio repo `v1.15.3` 固定 commit `0c0aad375d65b612c569bb4b787e1a94ec978bbc`；[Studio README](https://github.com/snyk/studio-mcp/blob/0c0aad375d65b612c569bb4b787e1a94ec978bbc/README.md) 与 [Snyk docs](https://docs.snyk.io/integrations/snyk-studio-agentic-integrations/getting-started-with-snyk-studio) 明确本地 MCP server 经 Snyk CLI 运行。 | `duplicate-lineage` | CLI release `1.1304.2` 与 Studio MCP release `1.15.3` 是两个版本轴，不能互相等同；既有 Resource 已按 `snyk-cli-rolling+studio-mcp-v1.15.3` 建模同一产品家族。 |

## 跨行去重与冲突账本

1. Brave 两行不是两张卡：`ai.smithery/brave@2.0.58` 是 Smithery hosted distribution，`io.github.brave/brave-search-mcp-server@2.1.0` 是 Brave first-party package release；两者都落到同一 canonical server lineage，但 distribution/auth/version 事实必须分别保留。
2. Azure DevOps 保持未决：相同 Microsoft repo/网站本身不足以把 PremierInc namespace 合并进 Microsoft server；本轮也没有足够证据建立独立 Resource。
3. Godot 存在 publisher 事实冲突：identity 去重成立，但 publisher 应保持 community author `tomyud1`，不能将 Godot Engine 品牌推导为发布者。
4. Sentry 存在许可措辞风险：固定 package 声明 `FSL-1.1-ALv2`；不得仅用“开源”概括。
5. PagerDuty 存在 manifest/package 版本漂移；Snyk 存在 CLI/Studio 两个合法版本轴。两类情况都不能靠选一个数字抹平。

## 质量与停止边界

- 12/12 行均保留 exact Registry ID、映射 Resource ID、固定 commit/version 或明确的证据缺口；无一条仅凭同 repo 作结论。
- 11 条 duplicate 均由 package/MCP name/container/subfolder/官方产品文档中的至少一种强身份信号闭合；1 条 deferred 明确给出可升级裁决所需证据。
- 未调用任何 MCP endpoint，未登录、安装、下载或执行 server/package，未访问私有 API，未保存 endpoint、token、credential 或 raw Registry response。
- 未修改 candidate、catalog、state、channel、release、App、schema、package 或 server；本报告不授权创建/更新任何 Resource。
- `Registry verified`、平台目录收录、hosted availability、review badge 均未被当作 AI Hub 安全认证。
- 最终文件采用 UTF-8（无 BOM）、LF、末尾换行；输出 SHA-256、bytes、lines 与 scoped diff-check 由冻结回传给出。
