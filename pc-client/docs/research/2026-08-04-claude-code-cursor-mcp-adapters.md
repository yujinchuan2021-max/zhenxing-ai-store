# Claude Code / Cursor 远程 HTTP MCP 适配合同核验

核验日期：2026-08-04  
核验范围：只使用 Anthropic、Cursor、OpenAI 官方文档或官方仓库；只研究远程 Streamable HTTP MCP 的宿主配置与生命周期，不修改产品代码、目录数据或用户配置。

## 结论

- **Claude Code**：官方稳定合同覆盖 `add`、`get`、`list`、`remove`，并支持 `--scope user`；用户级 MCP 存在 `~/.claude.json`。官方也支持在 Claude Code 内的 `/mcp` 面板中临时关闭或重新开启服务器，但这是**交互式、按项目记录**的开关。官方 `claude mcp` 管理命令清单没有公开非交互的 `enable` / `disable` 子命令。因此 AI Hub 首版适配器应自动化“安装、查看、卸载”，不应伪造全局无交互开关。
- **Cursor**：全局 MCP 文件是 `~/.cursor/mcp.json`，远程 HTTP 服务器使用 `mcpServers.<name>.url`。当前官方 Cursor Agent CLI 已公开 `mcp list`、`mcp enable`、`mcp disable`；`agent` 是当前主命令，`cursor-agent` 仍是向后兼容别名。因此 Cursor 可以有正式的非交互启用/停用适配器。
- **OpenAI Developer Docs MCP**：固定 Streamable HTTP URL 为 `https://developers.openai.com/mcp`。它只提供 OpenAI 开发者文档的搜索与页面读取，不代表用户调用 OpenAI API，也不需要 AI Hub 下发脚本或任意命令。

## 1. Claude Code 合同

### 1.1 用户级远程 HTTP 安装

OpenAI 的官方 Docs MCP 页面直接给出 Claude Code 用户级安装命令：

```text
claude mcp add --transport http --scope user openaiDeveloperDocs https://developers.openai.com/mcp
```

来源：[OpenAI Docs MCP：Claude Code quickstart](https://developers.openai.com/learn/docs-mcp#quickstart)。Anthropic 官方 MCP 文档也说明远程 HTTP 是云端服务的推荐传输方式，基本格式是 `claude mcp add --transport http <name> <url>`：[Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp#option-1-add-a-remote-http-server)。

Anthropic 对三个 scope 的定义是：

| Scope | 可见范围 | 存储位置 |
| --- | --- | --- |
| `local`（默认） | 当前项目、当前用户 | 当前项目条目下的 `~/.claude.json` |
| `project` | 当前项目、可随仓库共享 | 项目根目录 `.mcp.json` |
| `user` | 当前用户的所有项目 | `~/.claude.json` |

用户级配置应明确使用 `--scope user`；不要把默认 `local` 误当成全局配置。来源：[Anthropic MCP installation scopes](https://code.claude.com/docs/en/mcp#mcp-installation-scopes)。

Claude Code 的 HTTP JSON 条目必须带 `type: "http"` 和 `url`；只有 `url` 而没有 `type` 会被当成配置错误。来源：[Anthropic remote HTTP configuration](https://code.claude.com/docs/en/mcp#option-1-add-a-remote-http-server)。这与 Cursor 的 URL-only 结构不同，两个宿主不能共用同一个 JSON 序列化器。

### 1.2 查看、验证与卸载

Anthropic 官方公开的管理命令是：

```text
claude mcp list
claude mcp get openaiDeveloperDocs
claude mcp remove openaiDeveloperDocs
```

来源：[Anthropic：Managing your servers](https://code.claude.com/docs/en/mcp#managing-your-servers)。

验证合同需要区分两层：

1. `claude mcp add` 输出 `Added ...`，只表示配置已经写入。
2. `claude mcp list` 会继续显示连接健康状态，例如 `Connected`、`Needs authentication`、`Failed to connect`；官方明确说明，服务器显示连接失败不等于 `list` 命令自身执行失败。

因此 AI Hub 不应把 `add` 的零退出码直接写成“服务器可用”。建议适配器把结果分为：

- **已配置**：`add` 成功，且 `get <name>` 能读取该条目；
- **已连接**：`list` / `/mcp` 显示连接成功；
- **需要用户处理**：需要认证、连接失败或宿主策略拒绝。

`claude mcp list` 没有官方承诺的 JSON 输出格式，不能在未做真实版本验收前依赖固定列宽、图标或完整英文句子。

### 1.3 是否存在稳定 enable / disable

存在官方开关，但边界如下：

- 用户可在 Claude Code 会话的 `/mcp` 面板中关闭服务器而不删除配置；服务器仍显示在面板中，但标记为 disabled。
- 该选择是**按项目**记录在 `~/.claude.json` 中。普通用户配置服务器的关闭状态进入该项目的 `disabledMcpServers`。
- Anthropic 当前公开的 `claude mcp` 命令清单只有 `add`、`get`、`list`、`remove` 等，没有公开 `claude mcp enable` 或 `claude mcp disable` 的无交互命令。

来源：[Anthropic：Disable a server without removing it](https://code.claude.com/docs/en/mcp#disable-a-server-without-removing-it) 与 [Managing your servers](https://code.claude.com/docs/en/mcp#managing-your-servers)。

所以首版 Claude Code 适配器边界应是：

- 可以固定参数调用 `add --scope user`、`get`、`list`、`remove`；
- 可以提示用户在 `/mcp` 中按项目启用或停用；
- 不把直接修改 `disabledMcpServers` 包装成官方全局开关；
- 如果产品必须提供“全局停用”，只能对 **AI Hub 有安装收据且仍与收据完全匹配** 的条目执行 `remove`，并将按钮命名为“移除 / 重新安装”，不能伪称“停用 / 启用”。

## 2. Cursor 合同

### 2.1 全局远程 HTTP 配置

Cursor 官方规定：项目级文件是 `.cursor/mcp.json`，全局文件是用户主目录中的 `~/.cursor/mcp.json`。来源：[Cursor MCP：Configuration locations](https://cursor.com/docs/mcp.md#configuration-locations)。

固定 OpenAI Docs MCP 的全局结构应为：

```json
{
  "mcpServers": {
    "openaiDeveloperDocs": {
      "url": "https://developers.openai.com/mcp"
    }
  }
}
```

这既符合 Cursor 的远程服务器结构，也与 OpenAI 官方 Cursor quickstart 完全一致。来源：[Cursor MCP：Remote Server](https://cursor.com/docs/mcp.md#using-mcpjson) 与 [OpenAI Docs MCP：Cursor quickstart](https://developers.openai.com/learn/docs-mcp#quickstart)。

对于此固定公开文档服务器，不需要 `headers`、API key 或 OAuth 客户端参数。适配器应只合并或删除 `mcpServers.openaiDeveloperDocs` 这一项，保留用户文件中的其他字段与其他服务器；若同名条目已由用户创建且 URL 不同，应报告冲突，不得覆盖。

### 2.2 CLI 验证合同

Cursor 当前官方命令名是 `agent`，并明确说明 `cursor-agent` 仍是向后兼容别名。来源：[Cursor CLI 2026-01-08 changelog](https://cursor.com/changelog/cli-jan-08-2026)。

官方 MCP CLI 合同是：

```text
agent mcp list
agent mcp enable openaiDeveloperDocs
agent mcp disable openaiDeveloperDocs
```

相同调用可通过仍受支持的别名运行：

```text
cursor-agent mcp list
cursor-agent mcp enable openaiDeveloperDocs
cursor-agent mcp disable openaiDeveloperDocs
```

官方说明：

- `mcp list`：列出已配置服务器及状态；
- `mcp enable <identifier>`：把服务器加入本地 approved list；
- `mcp disable <identifier>`：禁止该服务器加载，也不再弹出批准提示。

来源：[Cursor Agent CLI Parameters：MCP](https://cursor.com/docs/cli/reference/parameters.md#mcp)。

适配器应先解析 `agent` 的绝对路径，找不到再解析 `cursor-agent`，不要靠 shell PATH 字符串拼接。安装后的最小验证为：

1. 读取 `~/.cursor/mcp.json`，确认目标键仍是固定官方 URL；
2. 运行解析到的宿主可执行文件 `mcp list`；
3. 命令退出成功，且输出中能定位目标 identifier；
4. “连接可用”作为单独状态，不与“JSON 已写入”合并。

当前官方文档没有给 `mcp list` 定义机器可读 JSON 输出，也没有承诺具体状态文本格式。因此首版只能在受支持的真实 Cursor 版本上记录输出样本后再做最小解析，不能预先硬编码表格、颜色或英文文案。

### 2.3 enable / disable 是否可自动化

**可以。** `agent mcp enable` 和 `agent mcp disable` 是当前正式 CLI 文档中的非交互子命令。适配器应调用 CLI，而不是自行编辑 Cursor 未公开的本地 approved / disabled 状态文件。配置项本身仍保留在 `~/.cursor/mcp.json`；删除配置属于“卸载”，与 disable 是两个不同动作。

## 3. OpenAI Developer Docs MCP 固定元数据

| 字段 | 固定值 |
| --- | --- |
| 建议 identifier | `openaiDeveloperDocs` |
| 传输 | Streamable HTTP |
| URL | `https://developers.openai.com/mcp` |
| 权限 | 只读文档搜索与页面内容读取 |
| 文档覆盖 | `developers.openai.com`、`platform.openai.com`、`learn.chatgpt.com` |
| 是否代用户调用 OpenAI API | 否 |

OpenAI 官方说明该服务器是公开、documentation-only 的 MCP：它把 OpenAI 开发文档搜索和页面内容带入 agent 上下文，不代表用户发起 OpenAI API 请求。来源：[OpenAI Docs MCP](https://developers.openai.com/learn/docs-mcp#what-it-provides)。

因此 AI Hub 后台可选择这个固定资源模块，但只能传递受批准的宿主与显示参数；不能把任意 URL、任意 header 或任意命令作为“Docs MCP 参数”下发给客户端。

## 4. 建议的两个固定宿主适配器

| 操作 | Claude Code 用户级 HTTP 适配器 | Cursor 全局 HTTP 适配器 |
| --- | --- | --- |
| 安装 | 官方 `claude mcp add --transport http --scope user ...` | 原子合并固定 `mcpServers.<id>.url` |
| 查看 | `claude mcp get <id>` | 读取目标 JSON 键 |
| 列表 / 宿主识别 | `claude mcp list` | `agent mcp list`，找不到 `agent` 时用 `cursor-agent` |
| 停用 / 启用 | 仅 `/mcp` 交互、按项目；不自动化成全局开关 | `agent mcp disable/enable <id>` |
| 卸载 | 仅对 AI Hub 收据拥有的条目调用 `claude mcp remove <id>` | 仅删除 AI Hub 收据拥有且仍匹配的目标 JSON 键 |
| 用户已有同名不同配置 | 停止并报告冲突 | 停止并报告冲突 |

共同边界：

1. 后台只能选择固定适配器、固定 identifier 与审核过的 HTTPS URL，不能下发命令模板。
2. 安装收据必须记录宿主、identifier、URL、scope / 配置路径和安装前是否已有同名条目。
3. 不删除、不覆盖用户手动创建的同名条目；配置在安装后被用户修改时，AI Hub 只报告“已脱离管理”，不强制恢复。
4. JSON 写入必须做解析、最小键合并、临时文件原子替换和失败回滚；不能重写整个用户配置。
5. HTTP endpoint 的普通 `GET` 结果不是 MCP 握手验证。可用性必须由目标宿主的 MCP 客户端确认。

## 5. 真实宿主待验收项

本次没有在用户机器上安装或修改 Claude Code / Cursor 配置。进入代码准入前仍需用真实宿主完成以下验收：

### Claude Code

- 当前 Windows 版本能解析 `claude`，版本与 `mcp --help` 命令面符合上述官方合同。
- 用户级 add 后，`get` 能看到 `openaiDeveloperDocs`、HTTP URL 与 user scope；`list` 能区分“已配置”和“已连接”。
- 在 `/mcp` 中关闭、重启宿主、重新开启，确认状态按项目持久化。
- AI Hub 收据拥有的条目可被 remove；用户已有同名条目、同名不同 scope 和用户后改 URL 的场景不会被误删。
- 在真实会话中完成一次文档搜索 / 页面读取，而不是只验证配置存在。

### Cursor

- 当前 Windows 版本实际提供 `agent` 或 `cursor-agent`，并记录版本号、绝对路径、退出码和 `mcp list` 输出样本。
- 写入 `~/.cursor/mcp.json` 后，Cursor 重启可以识别目标服务器；`mcp list` 能定位 identifier。
- `mcp disable` 后目标不加载，`mcp enable` 后恢复；两种状态在宿主重启后仍符合官方语义。
- 卸载只删除目标键，用户的其他 MCP 和非 MCP 配置逐字节语义保持不变。
- 在真实 Agent 会话中完成一次 OpenAI 文档搜索 / 页面读取。

在这些真实宿主验收完成前，可以把适配器标记为“官方合同已核验、自动化测试待建”，但不能宣称 Claude Code / Cursor 的用户机器闭环已经验收通过。
