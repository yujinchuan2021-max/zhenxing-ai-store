# MCP resource platformSupport Batch 1（draft89 / v2 active6）

状态：`candidate-only=true`、`publishable=false`。只读研究，不改 catalog/state/schema/profile，不 saveDraft、publish、package、upload、download 或 install。

## 基线与范围

权威事实源为 `pc-client/admin/published/catalog-store/state.json`：`draft.revision=89`、v2 active release `catalog-v00000006-567e671621f1-3dcee587`、123 MCP resources、472 targets、6 managed targets，其余 link-only。

本批覆盖全部 6 个 managed targets：

| resourceId | hosts | 当前 module/profile 事实 |
|---|---|---|
| `openai-codex-mcp-config` | `codex-cli`、`claude-code`、`cursor-desktop` | 现有 `mcp-managed` targets；profile 仍由现有 registry 约束 |
| `zep-docs-mcp` | `codex-cli`、`claude-code`、`cursor-desktop` | 现有 `mcp-managed` targets；profile 仍由现有 registry 约束 |

另选 18 个高价值 official MCP resources：`microsoft-azure-mcp`、`microsoft-playwright-mcp`、`github-copilot-mcp`、`aws-mcp-servers`、`unity-official-mcp-server`、`figma-mcp-server`、`notion-mcp`、`atlassian-rovo-mcp-server`、`docker-mcp-toolkit`、`cloudflare-api-mcp-server`、`linear-mcp-server`、`stripe-mcp-server`、`supabase-mcp-server`、`vercel-mcp`、`slack-mcp-server`、`jetbrains-idea-mcp-server`、`canva-mcp`、`postman-mcp-server`。

选择结果：20 resources、97 现有 resource×host tuples、291 个 resource×host×platform 预览组合。target 不增加 platform 字段。

## 证据模型

每个 resource 都有 Windows/macOS/Linux 三条 platform claim，字段严格采用共享 candidate seam：`platform`、`runtime`、`status`、`architectures`、`evidence`。`native`、`remote`、`container` 仅在官方入口能确定运行形态时使用；平台支持没有一手明确文字时为 `unknown`，不会从 npm、Python、Docker、Electron 或客户端存在推断支持。

- `openai-codex-mcp-config`、`zep-docs-mcp`、GitHub、Figma、Notion、Atlassian、Cloudflare、Linear、Stripe、Supabase、Vercel、Slack、Canva：按一手页面记录为 `remote` 形态候选；账号、OAuth、状态/revoke 和固定 transport 合同仍未形成 managed 资格。
- Docker MCP Toolkit：按官方 Toolkit 页面记录 `container` 形态候选；容器依赖不等于宿主 native 支持。
- Playwright、Azure、AWS、Unity、JetBrains、Postman：按官方入口记录 `native` 形态候选；未把包存在或客户端配置示例当作 Windows/macOS/Linux 支持，三平台状态按证据分别为 `unknown` 或一手明确的 supported。
- 所有 claims 的 `observedAt=2026-08-07T00:00:00.000Z`；canonical resourceId、canonicalSource 与 target tuple 取自 active draft，未复制外部热度。

## Managed 与交集结论

当前 fixed profiles 没有 platformSupport claim，故：

| 预览范围 | 组合数 | available | managedEligible | blocked 原因 |
|---|---:|---:|---:|---|
| 全部 Batch 1 resource×host×platform | 291 | 0 | 0 | fixed profile platformSupport 缺失；且部分 resource/host claim 为 unknown |
| 其中 6 个现有 managed targets×三平台 | 18 | 0 | 0 | 现有 profile 未提供 platform-specific artifact/lifecycle/receipt claim |

resource claim 与 host candidate claim 的交集只能用于展示/筛选预览；不能把“客户端可连接”变成 native install。remote 还必须补齐固定 transport、auth handoff、status、revoke；API key/OAuth 登录不属于无秘密 managed。

## 平台统计

| 统计对象 | Windows | macOS | Linux |
|---|---:|---:|---:|
| resource claims | 20 | 20 | 20 |
| resource claims `supported` | 0 | 0 | 0 |
| resource claims `unknown` | 20 | 20 | 20 |
| host candidate claims | 由既有 product platform candidate 引用 | 由既有 product platform candidate 引用 | 由既有 product platform candidate 引用 |
| fixed profile claims | 0 | 0 | 0 |

本批对 resource claims 采取保守 unknown：官方页面证明 MCP 身份/入口或 runtime 形态，不足以证明该 MCP server 在三种平台均可运行。这样不会把 npm/Python/Docker 或 browser/remote 连接误报为平台安装支持。

## 安全与去重门禁

- 只接受一手 HTTPS evidence；canonicalSource 来自现有 resource identity。未使用聚合站热度、未虚构 stars/ratings/downloads。
- resourceId 与 canonical source 去重；host 关系只引用现有 target tuple。没有把 platform 写入 target。
- candidate JSON 不含后台执行字段；不包含命令、参数、环境、请求头、凭据、脚本、秘密、任意 endpoint 或 path。
- `adapterEvidence` 仅作为现有 adapter/registry 的只读引用；不新增 adapter，不写 registry，不创建 profile。
- `profilePlatformSupportClaims=[]` 是事实缺口，不是默认支持；因此 Agent Broker、前端动作与安装管理均保持 fail-closed。

## 下一批估算

若 CTO 批准下一批，只做最多 20 个 resource 的逐页 first-party refresh：约 20–40 HTTPS 页面请求、1–3 分钟、缓存元数据不超过 10 MiB；不下载包、不调用禁用 API、不运行安装。优先补 6 个 managed resource 的实际 server transport/Windows host boundary 与 profile-specific evidence，再考虑 resource claim 的 supported/unsupported，而不是直接新增 profile。

## 来源

具体 canonicalSource、observedAt、resource×host tuples、claims 与统计见同名 JSON。官方入口包括 [OpenAI Docs MCP](https://developers.openai.com/resources/docs-mcp)、[Zep Docs MCP](https://help.getzep.com/docs-mcp-server)、[Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)、[GitHub MCP Server](https://github.com/github/github-mcp-server)、[Figma MCP](https://developers.figma.com/docs/figma-mcp-server/)、[Docker MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/)、[Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/)。
