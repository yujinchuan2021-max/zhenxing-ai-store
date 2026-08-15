# DeepSeek Harness 官方一手证据冻结（2026-08-15）

## 结论先行

- **研究对象**：仅 `https://github.com/deepseek-ai/deepseek-harness`；官方归属为 DeepSeek AI。
- **固定版本**：默认分支 `master` 在本次核验时指向 commit [`47f943859bef60e4160492346772ded9b24f765a`](https://github.com/deepseek-ai/deepseek-harness/commit/47f943859bef60e4160492346772ded9b24f765a)，根清单及公开 CLI 包版本均为 `0.1.0-rc.5`。GitHub Releases 页面在 2026-08-15 显示无 Release，Tags 页面也未给出可用发布标签，因此本研究只以完整 commit SHA 为可复核版本锚点，不把 `rc.5` 宣称为稳定版。
- **真实性分类**：它首先是一个**独立 AI 开发者产品 / agent harness / 插件宿主平台**，同时提供 Web、CLI 与 headless 运行形态。仓库内含 Skill 能力族、许多第一方 Cordis 插件，以及一个 MCP **客户端桥**；但仓库整体**不是一个 Skill、不是一个单独 Plugin、也不是 MCP Server**。
- **Resource Store 总体处置**：**DEFERRED**。当前本地 Resource 模型没有 `DeepSeek Harness` 这一宿主的精确 `CompatibleHost` ID，强塞进 Skill / Plugin / MCP 任一资源类型都会失真。若以后扩展独立产品目录，可先做 **READY-LINK-ONLY Product**，只打开官方页面；不得创建 connection edge，不得托管安装或执行。
- **主要安全边界**：默认新会话为 `workspace-write`；文件写入和 shell 有沙箱策略，但官方明确说明网络访问与进程可见性不在该沙箱词汇内，Windows ACL 后端只报告 `partial`。MCP stdio 命令和外部插件属于可信可执行代码，且 MCP 命令在 agent sandbox 之外运行。
- **本轮动作边界**：未 clone、install、execute、login、调用任何 API、启动服务、生成 candidate 或测试；未修改 active/state/channel/release/App/schema/package/server。本文仅记录官方材料和冻结的本地只读去重结果。

## 1. 冻结范围与方法

### 1.1 上游固定点

| 项目 | 冻结事实 | 官方证据 |
| --- | --- | --- |
| Canonical repository | `deepseek-ai/deepseek-harness` | [固定 SHA 的根 README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/README.md) |
| Default branch at inspection | `master` | [commit 历史（动态页，仅用于 2026-08-15 当前性核验）](https://github.com/deepseek-ai/deepseek-harness/commits/master/) |
| Reproducible version anchor | `47f943859bef60e4160492346772ded9b24f765a` | [固定 commit](https://github.com/deepseek-ai/deepseek-harness/commit/47f943859bef60e4160492346772ded9b24f765a) |
| Repository/package version | `0.1.0-rc.5` | [根 package.json](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/package.json), [CLI package.json](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/package.json) |
| Release maturity | Developer preview；官方警告会有破坏性兼容变更 | [固定 README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/README.md) |
| GitHub Release / tag | 2026-08-15 检查时无 GitHub Release，Tags 视图未给出可用 tag | [Releases（动态状态）](https://github.com/deepseek-ai/deepseek-harness/releases), [Tags（动态状态）](https://github.com/deepseek-ai/deepseek-harness/tags) |

动态的 branch / release / tag 页面只用于确定“本次检查时”的状态；所有代码、文档、清单和许可事实均引用完整 SHA URL。后续收录前必须重新核验默认分支与发布状态。

### 1.2 来源约束

本研究只使用：

1. `deepseek-ai/deepseek-harness` 固定 SHA 下的 README、docs、tree、manifest、lock、license 与 workflow；
2. README 明示的 DeepSeek 官方归属；
3. 仓库内保存的第三方目录级许可证与上游固定点；
4. 本地冻结 catalog 的只读去重结果。

未使用同名第三方仓库作为身份、版本或兼容性证据；尤其不得把 `HenryZ838978` 名下的同名仓库误认成 DeepSeek 官方对象。

## 2. 官方归属、版本和许可

### 2.1 Ownership

- Canonical GitHub owner 是 `deepseek-ai`。
- 根 README 将 DeepSeek Harness 描述为由 DeepSeek AI 开发的开源 agent harness，并链接 DeepSeek 官方站点；这同时确立产品名、开发者和用途。[固定 README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/README.md)
- 根许可证版权行为 `Copyright (c) 2026 DeepSeek`。[根 LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/LICENSE)
- Python SDK 的 `authors` 也是 `DeepSeek`，homepage/source 均回到该官方仓库。[python/sdk/pyproject.toml](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/python/sdk/pyproject.toml)

### 2.2 根许可与目录级许可边界

| 层级 | 许可事实 | 说明 |
| --- | --- | --- |
| 仓库根 | MIT，2026 DeepSeek | 根项目许可；不能据此覆盖依赖各自条款。[LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/LICENSE) |
| `vendor/` Cordis 基础层 | 9 个 vendored 目录均保留上游 MIT LICENSE | 被重新命名到 `@deepseek-ai` scope 不改变上游来源或许可。版本、commit 与本地修改由 [vendor/README.md](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/README.md) 记录。 |
| `native/landlock-run` | BSD-3-Clause，`node-addon-landlock-run contributors` | 官方通知明确把它列为本仓库第一方 native package，而不是第三方；仍不能写成根 MIT。[目录 LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/native/landlock-run/LICENSE) |
| npm / Python 外部依赖 | MIT、Apache-2.0、BSD、ISC 等混合条款；Claude Agent SDK 为其 README/LICENSE 中另行声明的条款 | 不得把整套运行闭包概括成“全 MIT”。[THIRD_PARTY_NOTICES.md](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/THIRD_PARTY_NOTICES.md) |

`vendor/` 目录级证据：

- `cordis/`：[LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/cordis/LICENSE)
- `cosmokit/`：[LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/cosmokit/LICENSE)
- `schemastery/`：[LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/schemastery/LICENSE)
- `loader/`：[LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/loader/LICENSE)
- `include/`：[LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/include/LICENSE)
- `group/`：[LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/group/LICENSE)
- `timer/`：[LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/timer/LICENSE)
- `hmr/`：[LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/hmr/LICENSE)
- `logger-console/`：[LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/logger-console/LICENSE)

固定的 vendored 上游 commit 为：`cosmokit@16f6fc058ade66e8ac5da0033d35a8d0f279f544`、`schemastery@e67cee00ad725bd1534aee930a979ea3eec6f698`、`cordis/loader@56b3d4f725681cf4556c1a8695a709cc3b6eed74`，其余五个 Cordis plugin 目录为 `abb0a307cb1d3b0947f455d590cf5ba922d4caa4`。[vendor manifest](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/README.md)

依赖闭包证据分层：npm 的完整精确版本闭包在 [pnpm-lock.yaml](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/pnpm-lock.yaml)，Python 闭包在 [python/sdk/uv.lock](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/python/sdk/uv.lock)；许可证归类以各项目自身许可及官方生成的 [THIRD_PARTY_NOTICES.md](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/THIRD_PARTY_NOTICES.md) 为准，lockfile 只证明版本/哈希闭包，不替代许可文本。

## 3. 事实分类：Product、Harness、Skill、Plugin、MCP

| 候选分类 | 判定 | 证据与解释 |
| --- | --- | --- |
| 独立 AI 产品 | **是，主分类** | 公开 `dsh` CLI、Web UI 和 headless profile，可独立启动并调用模型。[README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/README.md), [CLI manifest](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/package.json) |
| Agent harness | **是，主分类** | 官方自称 agent harness；具备 agent loop、tools、session、approval、sandbox、subagent 等能力。[architecture](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/architecture.md) |
| Plugin host/platform | **是，主能力** | Cordis 组合树驱动，模型适配器、工具、session log、agent loop 都是插件；profile 可装 out-of-tree plugins。[architecture](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/architecture.md) |
| 单一 Plugin | **否** | 仓库包含许多第一方 Cordis plugins，但整个产品不是一个插件包。插件的真实单位是导出 `apply(ctx)` 的 TypeScript module。[plugin tutorial](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/user/develop/basic/index.md) |
| Skill host | **是，能力** | `ctx.skills` 合并本地、嵌入或远程 provider；filesystem provider 加载 `SKILL.md`/flat Markdown。[skills subsystem](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/subsystems/skills.md) |
| 单一 Skill | **否** | 仓库中的 `.agents/skills` 是维护该仓库的技能集合；产品本身不是其中某一个 Skill。 |
| MCP client/host | **是，能力** | `@deepseek-ai/dsh-mcp-client` 连接外部 MCP server 并把工具注册进 `ctx.tools`。[MCP README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/mcp-client/README.md) |
| MCP Server | **否** | `packages/mcp` 只有 `mcp-client`；当前只桥接 Tools，Resources/Prompts 明确 deferred。[MCP tree README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/README.md) |
| 多种资源的集合 | **仓库内部是；Catalog 根对象不是** | 内含 plugins、Skills、MCP client 和工具，但不能因此把一个根 repo 拆成未经逐项审计的批量 Resource。 |

## 4. 仓库结构、清单与锁文件核验

### 4.1 根与运行清单

- 根 workspace 名为 `@deepseek-ai/dsh-root`，`private: true`，版本 `0.1.0-rc.5`，包管理器 `pnpm@11.7.0`，Node engine 为 `^22.19.0 || >=24.0.0`。[package.json](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/package.json)
- workspace 包含 `vendor/*`、`packages/*/*`、native Landlock、`apps/*`、website、examples 和 Python SDK runtime deploy root；依赖构建脚本由 `allowBuilds` 显式控制，包含 Windows ConPTY 所需 `node-pty`。[pnpm-workspace.yaml](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/pnpm-workspace.yaml)
- `@deepseek-ai/dsh` 是公开 CLI 包，bin 名 `dsh`，依赖 Web/headless、skill、MCP client、PowerShell/bash、filesystem、web、subagent、telemetry 等第一方模块。[apps/cli/package.json](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/package.json)
- `pnpm-lock.yaml` 为 lockfile v9，固定 workspace importer、外部版本、完整转移依赖、平台包和 patched `node-pty`；不能把 manifest 范围当作实际锁定版本。[pnpm-lock.yaml](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/pnpm-lock.yaml)

### 4.2 Skills

固定树中的 `.agents/skills` 有 11 个仓库维护型 Skill：

`dsh-archive-agent-notes`、`dsh-code-review`、`dsh-doc-site-sync`、`dsh-doc-standards`、`dsh-find-simplifications`、`dsh-merging-stacked-prs`、`dsh-pre-push-checks`、`dsh-prose-standard`、`dsh-translate-docs`、`dsh-trim-cot-leakage`、`record-browser-gif`。[固定 tree](https://github.com/deepseek-ai/deepseek-harness/tree/47f943859bef60e4160492346772ded9b24f765a/.agents/skills)

`.claude/skills` 是指向 `../.agents/skills` 的 symlink，不是第二份资源集合。[固定 symlink](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/.claude/skills)

产品侧 `packages/skill` 有 `skill`、`skill-badge`、`skill-filesystem`、`tool-skill` 四个包；它们组成 provider-neutral registry、可选 badge provider、本地 filesystem provider 和模型 loader。[固定 tree](https://github.com/deepseek-ai/deepseek-harness/tree/47f943859bef60e4160492346772ded9b24f765a/packages/skill)

本地发现顺序是项目 `.dsh/skills`、项目 `.agents/skills`、custom、用户 `$DSH_HOME/skills`、用户 `~/.agents/skills`、可选 bundled；支持单层 `<name>/SKILL.md` 或 `<name>.md`，不递归发现嵌套 `**/SKILL.md`。[skills subsystem](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/subsystems/skills.md), [filesystem provider README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/skill/skill-filesystem/README.md)

`@deepseek-ai/dsh-skill-filesystem@0.1.0-rc.5` 是公开 MIT 包，运行依赖包括 Chokidar 与 YAML；它会读本地技能根并默认监视变化。[manifest](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/skill/skill-filesystem/package.json)

### 4.3 Plugins

- 运行中的 `dsh` 是按层组合的插件树；`web` 与 `headless` 是模板 profile，base bundle 提供模型、工具、持久化、sandbox、approval、settings、credentials、telemetry。[architecture](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/architecture.md)
- 外部插件通过 `dsh plugin --profile <name> ...` 直接转发给 pnpm，可执行 `add/remove/update` 等任意 pnpm verb。Git-hosted source plugin 可能在安装时运行 `prepare`，pnpm 要求显式 `allowBuilds` 后才放行。[CLI reference](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/reference/README.md)
- 插件可以注册工具、服务、事件或网络连接；插件和依赖的代码、许可、遥测和外部副作用归各插件所有，不能从根仓库 MIT 或 sandbox 宣称推导安全性。[plugin tutorial](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/user/develop/basic/index.md)

### 4.4 MCP

- 固定 `packages/mcp` tree 只有 `mcp-client`。[固定 tree](https://github.com/deepseek-ai/deepseek-harness/tree/47f943859bef60e4160492346772ded9b24f765a/packages/mcp)
- stdio 配置含任意 `command`、`args`、`env`、`cwd`；HTTP 配置含 URL、headers/token。连接后会发现并调用外部工具，外部 MCP server 决定其网络和写入能力。[mcp-client README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/mcp-client/README.md)
- `@deepseek-ai/dsh-mcp-client@0.1.0-rc.5` 为公开 MIT 包，依赖官方 `@modelcontextprotocol/sdk`；测试用 server 包是 devDependencies，不是默认启用的产品服务。[manifest](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/mcp-client/package.json)
- 当前仅桥接 MCP Tools；MCP Resources、Prompts 未接入。非文本结果在 Native 模型上下文中可能只显示 placeholder。[mcp-client limitations](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/mcp-client/README.md)

### 4.5 Python SDK

- `deepseek-harness-sdk` 的仓库开发版本为 `0.0.0.dev0`，要求 Python `>=3.10`，runtime 依赖 `pydantic>=2.12,<3` 与本地 runtime-bin。[pyproject.toml](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/python/sdk/pyproject.toml)
- `python/sdk-runtime/package.json` 是 dependency-only deploy root，闭包包含 agent、shell、filesystem、sandbox、skill、subagent、web 与 provider 等第一方包。[sdk-runtime manifest](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/python/sdk-runtime/package.json)
- `uv.lock` 固定 Python 3.10+ 的完整开发/运行闭包及文件哈希；例如锁定 `pydantic 2.13.4`，而不是仅按 pyproject 范围猜测。[uv.lock](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/python/sdk/uv.lock)
- 官方 Python runtime release workflow 当前只列 Linux x64、Linux arm64、macOS arm64；没有 Windows runtime wheel target。因此“主 Node 产品有 Windows 路径”不等于“Python SDK runtime 已有 Windows 发布证据”。[build workflow](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/.github/workflows/build-exe-for-python-sdk.yml)

## 5. 官方支持宿主、系统与 Windows 证据

### 5.1 可以确认

| 层面 | 官方明示 |
| --- | --- |
| 运行时 | Node `^22.19.0 || >=24.0.0`；从源码使用 `pnpm@11.7.0`。[root manifest](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/package.json) |
| 产品形态 | Web UI 默认监听 `127.0.0.1:3080`；CLI 与无 server 的 headless profile。[README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/README.md), [CLI reference](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/reference/README.md) |
| Linux | CI 使用 Ubuntu，sandbox 有 bwrap/Landlock；Python runtime 有 Linux x64/arm64 target。[sandbox workflow](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/.github/workflows/sandbox.yml) |
| macOS | sandbox 有 Seatbelt；Python runtime 有 macOS arm64 target。[sandbox workflow](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/.github/workflows/sandbox.yml) |
| Windows | CI 有 Wine blocking lane 和真实 Windows Node 24 native-complete lane；CLI 依赖 PowerShell 与 Windows ACL sandbox 包。[CI workflow](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/.github/workflows/ci.yml), [CLI manifest](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/package.json) |

Windows 的具体证据：

- `dsh-pwsh-local` 每次以非交互、无 profile 的 PowerShell 启动命令；优先显式路径和 PowerShell 7，Windows PowerShell 5.1 只是 legacy fallback。该 executor 本身不隔离，按 Harness 进程权限运行。[pwsh-local README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/shell/pwsh-local/README.md)
- `dsh-pwsh-sandbox` 在 Windows 走 ACL restricted-token chain，但官方明示读取不受限，`read-only` 仍是 `partial`。[pwsh-sandbox README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/shell/pwsh-sandbox/README.md)
- Windows ACL backend 的 Everyone ACL、hard link、standing ACE 和 best-effort cleanup 等边界，使其不能宣称完整文件系统隔离。[windows-acl README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/sandbox/sandbox-windows-acl/README.md)
- Windows native CI runner 名为 `dsh-windows-2025-16core`，执行 `check:ci:windows-complete`；这是强 Windows 工程证据，但不是一份面向最终用户的 Windows 版本/架构支持矩阵。[CI workflow](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/.github/workflows/ci.yml)

### 5.2 不能确认或不得扩写

- 官方未给出“支持所有 Windows 10/11 版本与所有架构”的正式矩阵，不能自行补齐。
- 主 Node 产品的 Windows CI 不能替代真实用户安装验收。
- Python SDK 发布 workflow 没有 Windows runtime target，不能写成 Python SDK Windows 已正式支持。
- Web UI 是浏览器前端，不等于产品内置浏览器自动化宿主。
- 本地 catalog 没有 `DeepSeek Harness` 的精确 CompatibleHost ID；不能用 `Codex`、`Claude Code`、`OpenClaw`、`Hermes` 或通用 “agents” ID 猜配。

## 6. 官方安装/运行命令（仅记录，未执行）

以下命令均来自固定官方文档。本研究**没有执行**；其中 `npx`、`pnpm install`、plugin add 会下载或运行供应链代码。

```sh
# npm 直接启动 Web UI
npx @deepseek-ai/dsh web

# 从源码运行
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web

# 已安装 CLI 的 headless 任务
dsh --profile headless "run the tests"

# 只打印组合配置
dsh --profile web --dump-default-config
dsh --profile web --dump-config

# 外部插件管理；会转发给 pnpm
dsh plugin --profile <name> add <package-or-git-spec>
dsh plugin --profile <name> update
dsh plugin --profile <name> remove <package>
```

来源：[root README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/README.md)、[CLI reference](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/reference/README.md)。

不得把这些命令变成 AI Hub 的一键安装：当前没有冻结安装包、签名、哈希、版本升级/卸载、回滚、网络代理、失败恢复和真实 Windows 设备验收合同。

## 7. 风险与外部副作用矩阵

| 风险面 | DeepSeek Harness 官方能力/默认 | 第三方或用户配置带来的扩大面 | AI Hub 边界 |
| --- | --- | --- | --- |
| Network / API | 模型请求、DeepSeek `web_search`、可选 `web_fetch`、Web UI server；custom provider 可查询 `/models`。[providers guide](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/user/guide/providers.md), [web tools](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/web/tool-web/README.md) | OpenAI/Anthropic/custom endpoint、MCP HTTP、外部插件、npm/pnpm/Git 下载均会访问各自服务。 | 只链接，不代理请求、不代填 endpoint、不替用户联网。 |
| Model provider | 原生 DeepSeek adapter；也可配置 Anthropic、OpenAI、Bedrock、Vertex、Azure、Codex 或 custom route。 | 每个 provider 的条款、计费、数据处理与可用模型独立。 | 不声称免费、不替用户选择 provider、不保存 provider 配置。 |
| API key / credential | 密钥写入 `$DSH_HOME/.credentials.yaml`，UI 读回 redacted descriptor；也可从环境和 `.env` 层解析。[providers guide](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/user/guide/providers.md), [CLI reference](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/reference/README.md) | MCP env/headers、AWS/ADC/OAuth 和第三方插件可引入更多凭据。 | **never collect**；不读、不传、不缓存、不回显任何 key/token/header/.env/credentials 文件。 |
| Shell / code execution | Bash、PowerShell、persistent shell、background jobs；agent 可运行命令。[Web guide](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/user/guide/index.md) | MCP stdio `command` 是外部可执行代码；插件 module 与 `prepare` script 可执行供应链代码。 | 不代执行任何命令，不做 managed install。 |
| Filesystem reads | agent 能读 workspace；Windows confined mode 仍不限制读取；skill provider 扫描本地目录。 | 插件、shell、MCP server 可能读取其进程权限可见的其他路径。 | link-only 不读取用户项目或 Skill 目录。 |
| Filesystem writes | 默认 `workspace-write`；内置 `write/edit` 可创建、覆盖、编辑文件，settings/profile/session/credential 也会写本地状态。[filesystem tools](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/fs/tool-fs/README.md) | shell、插件和 MCP 工具可写更多内容；`danger-full-access` 绕过 confinement。 | 不创建 profile/patch/settings，不触碰 `$DSH_HOME`。 |
| Deletes | 没有单独证明默认模型工具中存在专用 delete API，但 shell 可执行删除命令，插件/MCP 工具也可能暴露删除能力。 | 外部 MCP server 的 delete/issue/repo/cloud 工具由其自身定义。 | 不因“未见专用 delete tool”而标成无删除风险。 |
| Git | 文档的源码路径会执行 `git clone`；shell 可调用系统 Git，Skill project root 还会探测 `.git`。没有发现一个受限的、专门 Git API 可以替代 shell 风险。 | Git-hosted plugins、远程仓库和认证由 Git/pnpm 管理。 | 不 clone、不 pull、不 commit、不 push。 |
| Browser | Web profile 提供浏览器 UI；`web_search`/`web_fetch` 是 HTTP 内容工具，不是浏览器自动化。[tool-web README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/web/tool-web/README.md) | 仓库维护 Skill `record-browser-gif` 与 dev-only Playwright 不应被描述成默认产品浏览器控制能力。 | 不创建 browser-control CompatibleHost/connection。 |
| Subagent | 可选 subagent seam 支持 in-process spawn/fork，以及 ACP、Codex、Claude Code、DSH SDK providers；可列出、消息、打断子代理。[subagent docs](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/subsystems/subagent.md) | 外部 provider 可能在另一个产品/进程运行，权限和费用随 provider。 | 不把 subagent provider 自动映射成 AI Hub connector。 |
| Sandbox | `read-only`、`workspace-write`、`danger-full-access`；sandbox 只约束文件 effects，网络和 process visibility 不在边界内。[sandbox docs](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/subsystems/sandbox.md) | Windows ACL 当前 `partial`；外部 MCP command 明示在 agent sandbox 外。 | UI 必须展示 guarded 风险，禁止“安全沙箱/完全隔离”宣传。 |
| Telemetry | 默认 session telemetry local/off；`FULL` 通过 OTLP/HTTP 发所有投影事件，`FEEDBACK_ONLY` 在反馈时上传 session suffix，`DSH_TELEMETRY_DISABLED` 可硬关闭。官方说明启用导出时没有内置 redaction，可能包含消息、工具参数/结果和 workspace path。[CLI reference](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/reference/README.md) | 自定义 collector 和第三方 plugin 可另有遥测。 | 不切换 telemetry，不收 session data，不把默认 off 延伸成“永不联网”。 |
| External writes | DeepSeek 自带文件/shell 能改本地工作区；MCP tool call 会把参数发给外部 server。 | issue、repo、数据库、云盘等实际写操作完全取决于安装的 MCP server/plugin/provider。 | 无 connection edge；任何未来连接都须独立权限/破坏性动作审计。 |
| Supply chain / license | 根 MIT；依赖闭包精确锁定并生成 notices。 | 外部插件拥有自己的代码和依赖；Anthropic Claude platform payload 并非 MIT 统一条款。 | 不从根 MIT 推导第三方可再分发；不镜像二进制。 |

## 8. 本地 active7 与 270 candidate 去重

### 8.1 冻结输入

| 基线 | 路径 | SHA-256 | 结构 |
| --- | --- | --- | --- |
| 当前 active 签名发布 | `admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json` | `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4` | catalog schema v2；375 vendors；615 products；250 resources；777 targets；0 resourceConnections |
| 最新恰为 270 的冻结 candidate | `docs/research/agentic-news-affiliate-hermes-catalog-v3-candidate-2026-08-15.json` | `265b622e3f9fc52c436724228704615163435d47c151e9b4007370dabe064c20` | catalog schema v3；375 vendors；615 products；270 resources；821 targets；10 resourceConnections |

### 8.2 结果

- 对两份基线的 resource `id/name/repo/canonical URL` 及完整对象文本做大小写、连字符和空格归一后的语义扫描，均无 `deepseek-harness` collision。
- 两份基线都已有 vendor `deepseek`（显示名“深度求索”），且已有三项产品：`deepseek-web`、`deepseek-api`、`deepseek-open-models`。未来若新增 Product 必须复用现有 vendor，不能再造第二个 DeepSeek 厂商。
- 现有三项产品与 Harness 不同：在线助手、API、开放模型集合都不是该 agent harness repo；因此不存在产品语义重复。
- 两份 Resource 集合都没有该 repo 的 canonical identity；也没有可复用的 `DeepSeek Harness` CompatibleHost ID。**无 collision 不等于可以随便选择资源类型或宿主。**
- 未以同名第三方仓库补齐任何字段；canonical repo 只能是 `https://github.com/deepseek-ai/deepseek-harness`。

## 9. Catalog 处置建议

### 9.1 Resource lane：DEFERRED

当前不要生成 Resource candidate，理由：

1. 根对象是独立 Product / agent harness，不是 Skill、Plugin 或 MCP Server。
2. `CompatibleHost` 必须是精确、已存在、可验证的 host ID；本地没有 DeepSeek Harness host。
3. 把它挂到 Codex、Claude Code、OpenClaw、Hermes 或任意通用 host 会伪造兼容关系。
4. MCP client 只是产品能力，不构成 MCP server connection；Skills/Plugins 需要逐项身份、许可、宿主和风险审计，不能由根 repo 批量继承。
5. 开发者预览且无 GitHub Release/tag，兼容性会破坏；managed install 没有签名、哈希、回滚、卸载和真实设备证据。

因此：

- `resourceId`：**不分配**
- `resourceType`：**不分配**
- `compatibleHostIds`：`[]`（证据空缺，不猜）
- `resourceConnections`：**不创建**
- managed install / download / launch：**禁止**

### 9.2 独立 Product lane：未来可 READY-LINK-ONLY

若产品目录允许新增一个纯链接 Product，可采用以下**非发布、待 CTO 审核**草案：

| 字段 | 建议值 |
| --- | --- |
| canonical product id | `deepseek-harness` |
| name | `DeepSeek Harness` |
| publisher / vendorId | `deepseek`（复用现有厂商） |
| directoryKind | `ai-tool` |
| category / kind | `智能体` / `其他产品`；描述可写 agent harness，但不要写成 Skill、Plugin 或 MCP Server |
| website / tutorial | `https://github.com/deepseek-ai/deepseek-harness`；只打开 canonical repo，不镜像、不自动下载 |
| productType / moduleId | `tutorial` / `tutorial-link` |
| installPolicy | `open-tutorial` |
| downloadPolicy | `none` |
| signaturePolicy | `not-applicable`（因为不托管 artifact） |
| uninstallPolicy | `not-managed` |
| requirements / installProfileId | `[]` / `""` |
| capabilities | `["tutorial"]` |
| CompatibleHost / connection edge | 不创建；Product 本身不伪造 Resource target 或 connection |
| 研究版本锚点（非 Product schema 字段） | `commit:47f943859bef60e4160492346772ded9b24f765a`；展示证据可附 `0.1.0-rc.5` 与 Developer Preview |
| 风险裁决（非 Product schema 字段） | `guarded`；`riskLevel`、`sourceKind` 属 Resource 语义，不得写入当前 Product exact schema |

**Never collect / never proxy 边界**：AI Hub 不收集、读取、缓存、转发或显示 `DEEPSEEK_API_KEY`、其他 provider key、OAuth、AWS/ADC、MCP token/header/env、`.env`、`$DSH_HOME/.credentials.yaml`、用户 workspace、Skill 内容、session/log/telemetry、Git credential、插件配置；不代表用户执行 npx/pnpm/git/shell；不替用户连接模型、MCP server 或外部服务。

### 9.3 解除 deferred 所需证据

仅在以下条件齐备后，才可另起变更：

1. Catalog 已有独立 Product 分类，或新增了 canonical `DeepSeek Harness` host ID；
2. 若收具体 Skill/Plugin/MCP 对象，逐项固定其 own repo/path、许可、版本、publisher 与精确 CompatibleHost；
3. 若做 connection edge，完成 credentials、权限 scope、外部写入、删除/破坏性动作、撤销与审计合同；
4. 若做 managed install，固定 release artifact、hash/signature、平台矩阵、代理/断点、升级/卸载/回滚和真实 Windows 设备验收；
5. 重查 upstream 当前 commit、Release/tag、Developer Preview 状态与第三方 notices。

## 10. 证据索引（均为官方；内容页固定完整 SHA）

- [README](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/README.md)
- [root package.json](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/package.json)
- [root LICENSE](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/LICENSE)
- [THIRD_PARTY_NOTICES](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/THIRD_PARTY_NOTICES.md)
- [vendor manifest](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/vendor/README.md)
- [architecture](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/architecture.md)
- [CLI behavior reference](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/apps/cli/reference/README.md)
- [Skill subsystem](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/subsystems/skills.md)
- [MCP client](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/mcp-client/README.md)
- [sandbox subsystem](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/subsystems/sandbox.md)
- [Windows ACL sandbox](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/packages/sandbox/sandbox-windows-acl/README.md)
- [subagent subsystem](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/subsystems/subagent.md)
- [model providers](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/docs/user/guide/providers.md)
- [CI workflow](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/.github/workflows/ci.yml)
- [Python pyproject](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/python/sdk/pyproject.toml)
- [Python uv.lock](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/47f943859bef60e4160492346772ded9b24f765a/python/sdk/uv.lock)

## 11. 停止条件

本文是研究证据，不是 publish authority、candidate、测试结果、安装验收或连接授权。结论停在：**Resource DEFERRED；独立 Product 未来仅可 link-only**。任何后续 catalog/state/release/App/schema/server/package 变更必须另行授权与审核。
