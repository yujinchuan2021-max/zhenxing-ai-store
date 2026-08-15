# Adeu MCP 当前第一方版本独立复核（2026-08-14）

> 状态：只读研究冻结稿。本文只支持后续 `ready-link-only` 人工审查，不是 catalog candidate、安装说明、连接授权、安全认证或发布许可。

## 裁决

- **当前 canonical identity**：`ai.adeu/adeu@2.4.0`，publisher 为 Dealfluence Oy / Adeu，canonical repository 为 [`dealfluence/adeu`](https://github.com/dealfluence/adeu/tree/55f271eb7024d428e5a8f62819ff1376a138166c)。
- **裁决**：`ready-link-only`，风险按现有目录词汇应至少为 `unsafe`（研究口径 `high`）。这只表示可以准确打开固定第一方源码/说明页并展示权限与风险事实；不表示允许下载、安装、配置或运行。
- **不具备的裁决**：managed install、自动配置和直接连接仍为 `deferred`。官方推荐入口会在用户机器上下载并执行本地代码，公开资料没有给本轮可锁定的分发资产哈希/签名；本轮也未运行服务器或验证包内容。
- **历史 Registry 线索不升级**：Official MCP Registry 的 `ai.adeu/adeu@1.7.1` 只保留为旧 discovery metadata。当前结论独立建立在 2.4.0 的第一方仓库字节上，不能把 1.7.1 与 2.4.0 混成一个版本，也不能把 Registry 状态解释为安全认证。旧线索见[上一轮 Registry 复核](./official-mcp-registry-next10-first-party-review-2026-08-14.md)。

## 当前 revision 与版本谱系

2026-08-14 匿名读取 Git ref 时，`main` 两次解析为 **`55f271eb7024d428e5a8f62819ff1376a138166c`**。该提交只删除一个已完成计划文件，父提交 [`a19c4001e477cca0d75fb51c484f57854380a033`](https://github.com/dealfluence/adeu/commit/a19c4001e477cca0d75fb51c484f57854380a033) 是 2026-08-13 的 2.4.0 release commit，并把 Python、Node MCP、Claude Desktop extension 与 Gemini extension 同步提升为 2.4.0；因此本稿固定到当前 `main` 的完整 SHA，而不引用漂移的 `main` URL。

当前第一方版本事实相互闭合：

- Adeu [开发者页](https://adeu.ai/developers)写明 MIT、v2.4.0、2026-08-13 发布、Python 3.12+ 与 Node 22+。
- 固定 [`python/pyproject.toml`](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/python/pyproject.toml)声明 Python 项目 `adeu` 为 2.4.0，并公开 MCP server 的 Python 实现入口。
- 固定 [`python/server.json`](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/python/server.json)声明 MCP identity `ai.adeu/adeu`、版本 2.4.0、包 `@adeu/mcp-server` 2.4.0 与 `stdio` transport。
- 固定 [`node/packages/mcp-server/package.json`](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/node/packages/mcp-server/package.json)再次声明 `@adeu/mcp-server` 2.4.0、`mcpName=ai.adeu/adeu`、Node 22+ 与 MIT。
- 源码边界分别是 [`node/packages/mcp-server`](https://github.com/dealfluence/adeu/tree/55f271eb7024d428e5a8f62819ff1376a138166c/node/packages/mcp-server) 和 [`python/src/adeu`](https://github.com/dealfluence/adeu/tree/55f271eb7024d428e5a8f62819ff1376a138166c/python/src/adeu)；两者是同一 canonical Adeu 资源的两种本地实现，不应复制成两张资源卡。

## 许可证与 NOTICE 边界

- 固定根 [`LICENSE`](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/LICENSE)是 MIT，copyright 2026 Dealfluence Oy；Python 和 Node package metadata 也声明 MIT。官网开发者页同样把 Redlining Engine 与 Python/TypeScript MCP server 描述为 MIT。
- 固定 revision 的仓库根目录只列出 `LICENSE`，没有独立根 `NOTICE`；对关键分发目录的常见 `NOTICE` / `NOTICE.md` 路径也未形成可读取工件。GitHub 的全库 code search 又要求登录，因此本文只能确认“MIT 正文包含版权与许可通知”，**不能声称仓库另有独立 NOTICE 工件，也不能断言所有依赖的通知义务已审完**。
- 这不阻碍 link-only 准确展示 MIT 源码事实；若未来要下载、重分发或 managed install，仍须对实际 wheel、npm 包、desktop extension 资产及其依赖逐一复核许可证与 notice 内容。

## MCP 身份与宿主证据

| 现有 CompatibleHost ID | 第一方证据 | 精确结论 |
| --- | --- | --- |
| `claude-desktop` | 固定 [`desktop-extension/manifest.json`](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/desktop-extension/manifest.json)为 Adeu 2.4.0 的本地 MCP extension；[README](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/README.md)也给出 Claude Desktop extension 流程 | MCP host 证据闭合 |
| `gemini-cli` | 固定 [`gemini-extension.json`](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/gemini-extension.json)为 2.4.0，内含 Adeu MCP server；README 称为 native Gemini CLI extension | MCP host 证据闭合 |
| `cursor-desktop` | 固定 README 与 [`@adeu/mcp-server` README](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/node/packages/mcp-server/README.md)明确点名 Cursor 为 MCP client | MCP host 证据闭合 |
| `windsurf-editor` | 同一份第一方 MCP client 说明明确点名 Windsurf | MCP host 证据闭合 |
| `microsoft-vscode` | README 只在“Skills-compatible agents”中点名 VS Code Copilot；没有闭合 Adeu 对 VS Code 的 MCP 配置或 extension 证据 | **仅 Skill surface 闭合；不得升级为 MCP host binding** |

“支持任意 MCP client”或 `etc.` 不能替代精确宿主证据。未来若把同一 canonical Adeu 资源建模为多类型资源，也必须分别保存 MCP 与 Skill 的真实关系，不能从一个 surface 推导另一个 surface。

## 本地 DOCX、活动 Word 与 Track Changes

- 固定 [README](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/README.md)把 Adeu 定义为 DOCX ↔ LLM translator：可从磁盘或活动 Word 读取文档，把文本投影为 CriticMarkup，校验变更，并把修改写回为原生 Word Track Changes。
- 固定 [MCP server README](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/node/packages/mcp-server/README.md)列出的文档能力包含读取、批量修改、表格编辑、评论回复、接受全部修订、删除评论、比较文档、清理 metadata 与加只读锁。这些都是有实质副作用的本地文件操作，不是只读查询。
- 活动 Word 仅在 Windows、已安装 Microsoft Word 且使用 Python backend 时成立。第一方 [`live_word.py`](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/python/src/adeu/mcp_components/tools/live_word.py)对现有 Word COM 实例和活动文档进行操作；未指定文件时可落到用户当前打开的文档。读取、修改、接受/拒绝修订、清理或锁定错误目标都可能造成数据损失。
- 第一方 [`server.py`](https://github.com/dealfluence/adeu/blob/55f271eb7024d428e5a8f62819ff1376a138166c/python/src/adeu/server.py)明确说明“DOCX scope”只过滤工具列表，未列出的工具仍可按名称调用；它是展示提示，不是访问控制。未来不能把 scope 选项当作 capability sandbox 或最小权限保证。

## 账号、凭据与本地/云边界

- 对开源本地 Redlining Engine 和本地 DOCX 工具，第一方资料没有要求 Adeu 账号、API key 或云端 workspace；开发者页明确称 engine 是基础设施而不是用户登录的平台。
- 固定 README 称本地 core 在用户机器上执行，Adeu 不把本地文档主动回传；但它同时提醒，用户所选 LLM provider 会处理 agent 读取到的文本。因此“本地 engine”不等于文档内容不会离开设备。
- 固定 Node MCP README 另列出需要 authenticated Adeu Cloud session 的邮箱读取、邮箱列表与草稿创建工具。当前公开源码边界、OAuth scopes、token 保存位置、撤权时序和 Cloud 服务条款没有在本轮完整闭合；[Adeu Privacy Policy](https://adeu.ai/privacy)只说明云服务会处理账号资料，Subscriber Content 则作为 processor 受 DPA 管理。
- Node README 对 Cloud 工具的描述与本轮可见的开源 server source surface 尚有漂移，不能把扩展 Cloud/邮件能力冒充为已核验的本地 OSS 能力，也不能反向声称当前发行物一定不含这些工具。
- 对 AI Hub 的最小 credentialPolicy：`never-collect`。AI Hub 不代用户登录、不接触 Adeu/LLM/邮箱凭据、不保存授权、不代理或转发 token；link-only 页面也不得自动启动 Cloud onboarding。

## 安装与运行风险

1. 官方文档的便捷安装入口默认解析滚动包或 release 资产，本轮没有固定资产哈希、签名或包内容审计；仅有源码 commit 不足以证明下载到的归档与该 commit 完全相同。
2. Node MCP 在本地以 Node 22+ 进程运行；Python backend 要求 Python 3.12+，包含 Windows COM 依赖，并在 2.4.0 锁定 FastMCP 4 的预发行依赖。宿主启动的本地进程继承用户可访问的文件和应用边界。
3. 本地能力既能读敏感合同，也能写回 DOCX、修改活动 Word、接受或拒绝修订、删除评论、清理 metadata 和锁定文件；风险为 `high/unsafe`，即使发布方声称有校验层也不能降为 `guarded`。
4. Cloud/邮箱 surface 还可能读取邮箱并创建草稿，认证与撤权合同未闭合；不得与无账号的本地 DOCX engine 混成“完全离线、无凭据”的统一声明。
5. 本轮没有下载、安装、启动、连接或调用 Adeu；所有能力均为第一方代码/文档声明，不是 AI Hub 实机验证。

## 语义去重

本轮按以下 canonical keys 扫描 `admin/published/`、`docs/research/`（包含当前广告增量 candidate）以及 active/history 研究基线：

- repository：`github:dealfluence/adeu`
- MCP identity：`ai.adeu/adeu`
- package identity：`@adeu/mcp-server`
- normalized publisher/name：Dealfluence Oy / Adeu
- canonical domain：`adeu.ai`

结果：**0 个已发布或 candidate Resource 重复**。唯一命中是上一轮 Registry 研究中的 discovery/deferred 元数据，不是资源卡，因此不构成 duplicate。已有 DOCX Skill 与 Adeu 的 publisher、canonical source、实现和资源类型不同，也不是同一 identity。任何后续 candidate 仍须在其生成时重新对届时 active/history 做一次语义去重；本稿不授予写目录权限。

## 后续最小合同

若 CTO 决定进入 candidate 阶段，最多建立一条 canonical Adeu 资源，只允许固定第一方 repository/说明页的 `resource-link + website + empty install profile` 投影；不得保存运行参数、环境变量、远程地址、凭据或本地路径，不得自动安装/启动，也不得增加未证实的 VS Code MCP relation。Managed install、Cloud/邮箱连接、分发资产完整性和实际 Windows Word 行为均继续 `deferred`。

## 未触碰边界

- 未修改 active catalog、state、channel、release、App、schema、package 或 server。
- 未生成 candidate、test、generator、draft、签名、封包或发布物。
- 未登录、未下载/执行任何 Adeu 包或 extension、未调用 MCP tool，也未访问私有 API。
- 本文没有保存可执行命令、参数、环境变量、凭据或 MCP endpoint。
