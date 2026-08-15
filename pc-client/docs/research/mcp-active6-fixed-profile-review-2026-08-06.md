# MCP active6 固定 profile 审核队列（2026-08-06）

## 审计边界

已完整读取 CTO manual、ownership、development-status、`mcp-store-readonly-audit-2026-08-05.md`、`mcp-needs-review-batch-2026-08-05.md`，以及工作区现有的 v2 active6 验证报告。后台已校正权威事实源：raw draft89 位于 `pc-client/admin/published/catalog-store/state.json` 的 `state.draft.catalog`，其 `draft.revision=89`；v2 active6 由同一 state 的 `channels.v2.activeReleaseId` 指向 immutable release。该 state 中 MCP 资源为 123 条、targets 为 472 条。本轮按这一权威位置完成机械复核，没有用猜测内容替代 raw draft89。

本轮只读：未改共享代码、catalog 或 state；未调用 `saveDraft`；未发布、封包、下载大文件。

## 事实盘点

- MCP 资源：123 条；targets：472 条；资源 ID 无重复。
- `sourceKind`：official 451 个 target、reviewed-community 17 个、community 4 个。
- `moduleId`：`mcp-managed` 3 个 target，`resource-link` 469 个 target。
- `install/update/repair/uninstall` 仅出现在 3 个 managed target；`enable/disable` 仅出现在 Codex CLI target。
- 宿主覆盖 24 个 `productId`；最多的是 Cursor Desktop 95、Claude Desktop 94、Claude Code 75、Codex CLI 59。
- 资源层级保持为顶层 MCP resource；没有把 MCP 记录提升为主页一级 AI 产品。
- 逐项检查 MCP resource/target 对象未发现 `command`、`args`、`env`、`headers`、`script`、`credentials` 字段。

## 最小固定 profile 审核队列

只保留现有 `openai-codex-mcp-config` 资源的 3 个宿主目标，不新增资源、不复制身份：

| 队列项 | 宿主 | 现有 profile | 版本/来源 | 生命周期边界 | 判定 |
| --- | --- | --- | --- | --- | --- |
| `openai-codex-mcp-config` | Codex CLI | `mcp.codex.openai-developer-docs` | `versionRef=2026-08-04`；OpenAI 官方 Docs MCP 与 Codex MCP 文档 | 用户级固定 `openaiDeveloperDocs` 条目；可检测、安装、更新、修复、启停、卸载；卸载只删除仍匹配收据的条目 | **进入固定 profile 审核** |
| 同一资源 | Claude Code | `mcp.claude-code.openai-developer-docs` | 同上；宿主配置依据 Anthropic 官方 MCP 文档 | 只管理该宿主的固定条目；不得写入任意 command/args/env/headers；OAuth/令牌不由目录接收或保存 | **进入固定 profile 审核** |
| 同一资源 | Cursor Desktop | `mcp.cursor.openai-developer-docs` | 同上；宿主协议依据 Cursor 官方 MCP 文档 | 只管理用户选择的固定 Docs MCP 条目；检测/更新/卸载必须以客户端收据与内容匹配为前提 | **进入固定 profile 审核** |

### 一手证据核对

- OpenAI 官方 MCP 文档确认 ChatGPT desktop、Codex CLI 和 IDE extension 支持 MCP，并共享 MCP 配置；同时列出 STDIO/Streamable HTTP 及 OAuth/Bearer 等能力，但本候选为公开文档服务，目录不收集凭据：[OpenAI MCP 文档](https://developers.openai.com/codex/mcp)。
- Claude Code 官方文档确认 Windows 宿主存在 MCP 配置路径，并提供 MCP 的添加、列表、移除和 `/mcp` 状态管理；其 OAuth 说明明确凭据由宿主安全保存，目录不应代管：[Claude Code MCP 文档](https://code.claude.com/docs/en/mcp)。
- Cursor 官方文档确认 MCP 连接方式由宿主管理，区分本地 stdio 与远程 HTTP/SSE，并将认证交给手动/OAuth 流程；本轮不把通用协议支持扩大为其他资源的可安装证据：[Cursor MCP 文档](https://docs.cursor.com/context/model-context-protocol)。
- 当前资源自身的 `versionRef`、`installScope`、`uninstallPlan`、`requestedPermissions`、`credentialRequirements` 与 3 个 profile 已存在；这些是进入客户端固定 profile 审核的必要输入，不等同于本轮完成真实 Windows 用户验收。

## 其余资源处理

- 469 个 `resource-link` 不进入固定安装审核：其中大量为滚动官方服务/文档，或只有官方入口而没有固定客户端包、检测、更新、卸载契约。
- 17 个 `reviewed-community` 与 4 个 `community` target 保持 blocked/link-only；GitHub 存在、通用 MCP API、协议兼容、社区包或可变命令都不足以形成安装证据。
- 任何需要远程 bootstrap、运行可变 command/args、注入 env/headers、保存 API key/OAuth secret、或缺失版本锁/哈希/Windows 验证的项目，不得进入 `mcp-managed`。

## 下一步责任人

若 CTO 批准继续推进，下一步由 **AI 商店后台**（`019fcd18-fc4d-7960-9aa6-e0e1720e90d4`）先审核并冻结这 3 个既有 profile 的 CRUD/schema 合同；涉及客户端检测、安装、更新、启停或卸载实现时，再由对应桌面/CLI 员工接手。MCP 商店员工不修改共享代码或客户端实现。

## 验证

- 当前 catalog JSON 解析成功，schema v2；MCP 123、targets 472。
- 资源 ID 唯一；禁止字段扫描为空。
- 本报告 JSON 解析成功，`git diff --check` 通过。
