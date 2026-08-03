# CLI / Agent 与生态资源安装闭环审计

日期：2026-08-03  
范围：`pc-client` 的 Skill、MCP、插件、连接器目录、Electron 本地执行、宿主适配、收据与生命周期。  
结论性质：代码与当前官方一手文档核对；未把自动化测试等同于真实 Windows 用户验收。

## 结论

当前生态资源商店已经具备完整的目录、后台选择、客户端白名单和一个安全的目录快照运行时，但还不是“Skill / MCP / 插件安装闭环”。

- 当前目录有 145 个资源、510 个资源目标关系。
- Skill 商店有 16 个资源、34 个目标行，其中 1 个目标可托管安装。
- MCP 商店有 123 个资源、470 个目标行，全部是 `resource-link`。
- 插件商店有 7 个资源、7 个目标行，全部是 `resource-link`。
- 连接器商店有 3 个资源、3 个目标行，全部是 `resource-link`；客户端甚至没有 `connector-managed` 模块。
- 唯一托管目标是 `ChatGPT Apps Skill -> Codex CLI`，配置 ID 为 `skill.codex.chatgpt-apps`，使用 `directory-snapshot` Adapter。
- 其余 509 个目标关系只打开官方页面，不能安装、更新、启停或卸载。

更关键的是，唯一托管样例当前写入 `{CODEX_HOME}/skills/chatgpt-apps`，而 OpenAI 现行文档列出的 Codex 用户级 Skill 目录是 `$HOME/.agents/skills`。现有测试把旧路径固化为正确结果，因此测试通过不能证明 Codex 会加载该 Skill。这个路径漂移必须在继续扩量前修复，并为已有 AI Hub 收据提供兼容迁移。

## 当前实现链路

目录链路已经贯通：

1. schema v2 将 Skill、MCP、插件和连接器保存在顶层 `resources`。
2. 每个 `Resource.targets[]` 指向一个 AI 工具产品，并声明 `moduleId`、`installProfileId`、兼容性和能力。
3. `shared/ecosystem-resources.cjs` 只接受固定模块：`resource-link`、`skill-managed`、`mcp-managed`、`plugin-managed`。
4. 后台从 `/api/product-modules` 读取公开模块和本地批准配置。没有匹配配置时，后台会退回 `resource-link`，不能填写命令、参数或本地路径。
5. 客户端按“资源类型 -> 目标工具 -> 资源列表 -> 详情”投影展示。
6. 托管详情页只把 `installProfileId` 交给 preload；Electron IPC 只有 `extension:status`、`extension:install`、`extension:uninstall`。
7. `extension-runtime.cjs` 再从本地注册表解析配置，拒绝后台选择任意 Adapter、源路径或目标路径。
8. 当前 `directory-snapshot` Adapter 校验源目录、拒绝符号链接、禁止覆盖已有目标，复制固定快照并在 Electron `userData/extension-receipts` 写收据；卸载只接受合法收据。

这条链路的安全方向是正确的：后台只选择客户端已发布身份，本地代码拥有执行原语。

## 尚未闭环的缺口

### 1. 宿主路径已经漂移

`resolveCodexSkillsRoot()` 当前返回 `{CODEX_HOME}/skills`。OpenAI 当前文档列出的用户级目录是 `$HOME/.agents/skills`，项目级目录是从当前目录向仓库根扫描的 `.agents/skills`。`~/.codex/config.toml` 现在用于 Skill 的启停配置，而不是用户级 Skill 内容根目录。

处理要求：

- 新安装写入 `$HOME/.agents/skills/<skill>`。
- 不以 `CODEX_HOME` 推导 Skill 内容目录；`CODEX_HOME` 仍可用于 Codex 配置和状态，但二者不是同一根目录合同。
- 读取旧 `skill.codex.chatgpt-apps` 收据时同时检查旧目标；只有收据与固定快照身份都匹配时才允许迁移或卸载。
- 迁移采用“复制到新目录 -> 校验 -> 写新收据 -> 再清理旧收据拥有的旧目录”，中途失败保留旧内容。
- 真实验收必须在新 Codex 会话中确认 Skill 可被发现；仅检查文件存在不够。

### 2. UI 没有可恢复的状态检测

资源详情组件不会调用 `getExtensionStatus()`；测试还明确断言页面不能自动探测。首次安装后，同一 React 会话可以显示卸载，但客户端重启后按钮重新显示“安装”。再次点击会得到 `EXTENSION_ALREADY_MANAGED`，无法进入卸载。

环境探测必须延迟到用户明确动作，但这不等于不提供“检测”动作。详情页应有明确的检测/管理入口，或在用户进入已安装管理页后统一扫描本地批准的资源收据。

### 3. 点击时没有重新授权当前目录

产品 CLI 安装会在 `cli:deploy` 时重新读取当前可信目录并校验产品仍启用；扩展 IPC 目前只接收 `profileId`，直接调用本地运行时。正常 UI 会隐藏停用目标，但 IPC 没有验证当前目录中仍存在启用且完全匹配的 `resourceId + hostProductId + moduleId + profileId`。

安装、更新和启用必须重新授权当前签名目录；检测、停用和卸载可凭合法本地收据保留恢复能力，即使后台卡片已经删除或停用。

### 4. 收据不足以支持更新、修复和保守卸载

当前收据只有 profile、Adapter、资源、宿主、安装时间和拥有目录：

- 没有 `versionRef`、源快照哈希或逐文件清单；无法判断可更新、内容漂移或修复需要。
- 状态只要“收据有效 + 目录存在”就是 `installed`，用户或恶意程序修改内容也不会被发现。
- 卸载递归删除整个拥有目录；安装后用户新增的文件也会一起删除。
- 已有收据时一律拒绝再次安装，没有原子更新或回滚协议。

收据 v2 至少需要记录 `catalogResourceId`、`hostProductId`、`profileId`、`adapterId`、`installedVersionRef`、源清单哈希、逐文件相对路径与安装时哈希、配置项键和安装前值摘要。卸载只删除仍与安装清单匹配的 AI Hub 文件/键；发现用户修改时进入 `modified`，要求用户确认保留或另行处理。

### 5. 没有宿主生命周期依赖

Codex Skill 安装不检查 Codex CLI 是否存在或是否支持当前 Skill 位置；目标产品关系只是目录关系。资源安装必须复用 CLI / Agent 的本地宿主发现结果：宿主缺失时先展示“安装宿主”，宿主版本不支持时拒绝写配置，宿主已运行且需要重载时明确提示或调用固定重载入口。

### 6. 运行时只有一个 Adapter

虽然目录模块声明了 `mcp-managed` 和 `plugin-managed`，`assertDirectorySnapshotProfile()` 只接受 `directory-snapshot`。没有 TOML/JSON 配置项 Adapter、宿主 CLI Adapter、OAuth 交接、启停、打开、更新或修复实现。

## 官方宿主合同（2026-08-03 核对）

| 宿主 | 当前官方合同 | 固定落地点或命令 | 来源日期 |
| --- | --- | --- | --- |
| Codex Skill | 用户级 Skill 在 `$HOME/.agents/skills`；仓库级 Skill 在沿工作目录到仓库根的 `.agents/skills`；`~/.codex/config.toml` 的 `[[skills.config]]` 可按 `SKILL.md` 路径禁用 | 目录快照 + TOML 启停键 | [OpenAI Build skills](https://developers.openai.com/codex/skills)，2026-08-03 访问 |
| Codex MCP | 用户级配置默认在 `~/.codex/config.toml`，可信项目可使用 `.codex/config.toml`；支持 STDIO、Streamable HTTP、OAuth 和 `enabled=false` | `[mcp_servers.<fixed-id>]`，或固定参数的 `codex mcp add/list/login` | [OpenAI MCP](https://developers.openai.com/codex/mcp)，2026-08-03 访问 |
| Codex / ChatGPT 插件 | 插件需要 `.codex-plugin/plugin.json`；本地市场位于仓库或用户 `.agents/plugins/marketplace.json`；安装副本进入 `~/.codex/plugins/cache/<market>/<plugin>/<version>`，启停状态在 `~/.codex/config.toml` | `codex plugin marketplace add/list/upgrade/remove` 只管理市场；实际插件安装由 ChatGPT/Codex 插件目录完成 | [OpenAI Package your plugin](https://developers.openai.com/plugins/build/plugins)，2026-08-03 访问 |
| Claude Code Skill | 项目或用户 `.claude/skills/<name>/SKILL.md` | 审核目录快照；作用域必须固定 | [Claude Code `.claude` directory](https://code.claude.com/docs/en/claude-directory)，2026-08-03 访问 |
| Claude Code MCP | Local/User 存在 `~/.claude.json`，Project 存在项目根 `.mcp.json`；官方 CLI 支持 add/list/get/remove；Windows 原生 STDIO 的 `npx` 需要固定 `cmd /c` 包装 | 优先使用 `claude mcp ... --scope user`，不自行改写整个 `~/.claude.json` | [Claude Code MCP](https://code.claude.com/docs/en/mcp)，2026-08-03 访问 |
| Claude Code 插件 | 官方市场自动可用；非交互 CLI 支持 `claude plugin install/uninstall ... --scope`，并有 enable/disable、marketplace list/update/remove 和 validate | 固定插件 ID、固定市场 ID、固定作用域的 `claude plugin` 子命令 | [Claude Code plugin discovery](https://code.claude.com/docs/en/discover-plugins)；[plugins reference](https://code.claude.com/docs/en/plugins-reference)，2026-08-03 访问 |
| Cursor MCP | 项目配置 `.cursor/mcp.json`，用户配置 `~/.cursor/mcp.json`；`agent`/`cursor-agent mcp list` 可验证，`mcp login` 处理 OAuth | JSON `mcpServers.<fixed-id>` 的键级合并；用 `agent mcp list` 验证 | [Cursor MCP](https://docs.cursor.com/id/advanced/model-context-protocol)；[Cursor CLI parameters](https://docs.cursor.com/en/cli/reference/parameters)，2026-08-03 访问 |
| Cursor 插件 | 2026-02-17 发布插件市场，插件可包含 Skill、MCP、子 Agent、规则和 Hook；当前公开安装入口是市场/UI 或交互 `/add-plugin` | 只打开固定市场详情或宿主交互入口，暂不伪装非交互一键安装 | [Cursor marketplace announcement, 2026-02-17](https://cursor.com/blog/marketplace)，2026-08-03 访问 |
| ComfyUI Custom Nodes | 官方推荐 Desktop 内置的 ComfyUI Manager；Manager 管理安装、更新、禁用和卸载。手动方式会克隆到 `ComfyUI/custom_nodes` 并在 Comfy 独立 Python 环境安装依赖，插件还可能执行 `install.py`/`uninstall.py`/`enable.py`/`disable.py` | 优先打开 Manager 的固定节点详情；不要由通用快照 Adapter 直接执行仓库脚本或 pip | [ComfyUI custom nodes](https://docs.comfy.org/development/core-concepts/custom-nodes)；[Manager](https://docs.comfy.org/manager/pack-management)；[publisher lifecycle](https://docs.comfy.org/custom-nodes/backend/manager)，2026-08-03 访问 |

Claude Desktop 聊天应用的 `claude_desktop_config.json` 与 Claude Code/桌面 Code 页使用的 `~/.claude.json`、`.mcp.json` 是两套不同配置。第一批不得把 `claude-desktop` 和 `claude-code` 当作同一个 MCP 宿主 Adapter。[Claude Code Desktop](https://code.claude.com/docs/en/desktop)

## 可安全落地的固定 Adapter

### A. `skill-directory-snapshot-v2`

适用：Codex、Claude Code 等有公开 Skill 目录合同的宿主。

固定输入全部来自客户端注册表：宿主 ID、目标根解析器、目标相对目录、资源快照路径、固定 `versionRef`、文件清单及哈希、启停配置位置。目录只提供 profile ID。

行为：

1. 通过宿主生命周期模块确认宿主存在且版本受支持。
2. 校验签名目录中的资源目标仍启用并匹配本地 profile。
3. 校验固定快照和逐文件哈希。
4. 拒绝符号链接、重解析点、越界路径和已有外部目标。
5. 写临时同盘目录，校验后原子换入。
6. 写收据 v2；安装后重新读取目标并比较清单。
7. `disable/enable` 只修改固定宿主配置中的该 Skill 键；不移动或删除未知内容。
8. 更新以新快照替换仍由旧收据完整拥有的文件；发现用户修改则停止并进入 `modified`。
9. 卸载逐文件核对，只删除未被用户修改的拥有文件和最终空目录。

第一真实样例：保留当前固定 commit `49f948faa9258a0c61caceaf225e179651397431` 的 ChatGPT Apps Skill，但目标改为 `$HOME/.agents/skills/chatgpt-apps`，增加旧 `{CODEX_HOME}/skills/chatgpt-apps` 收据迁移测试。真实验收必须启动新 Codex 会话确认 Skill 出现在可用列表。

### B. `mcp-config-entry`

适用：远程 HTTP MCP 和已经由 AI Hub 固定部署的本地 STDIO MCP。不要让后台提供 command、args、URL、env、headers 或配置片段。

共同规则：

- profile 固定 server ID、transport、endpoint/可执行身份、固定参数、允许的环境变量名、作用域和默认启用状态。
- 收据按“配置文件 + 服务器键”拥有，不拥有整个配置文件。
- 安装前读取并解析完整配置；同名外部键返回 `external/conflict`，不覆盖。
- 原子键级合并且保留格式能保留到宿主允许的程度；至少保留所有未知键和值。
- 密钥只允许引用环境变量名或走宿主 OAuth；目录和收据不得保存 token。
- 卸载只删除收据拥有且仍与安装值匹配的服务器键。

宿主 Adapter：

- `codex-mcp-toml`：写 `~/.codex/config.toml` 的一个 `[mcp_servers.<id>]` 表；状态读取该表并可用 `codex mcp list` 验证；启停修改该表的 `enabled`。
- `claude-code-mcp-cli`：调用固定 `claude mcp add/get/list/remove --scope user` 参数；Windows STDIO 的 `cmd /c` 只能由本地 profile 固定。优先让宿主 CLI 自己维护 `~/.claude.json`。
- `cursor-mcp-json`：键级合并 `~/.cursor/mcp.json` 的 `mcpServers.<id>`；用 `agent mcp list` 验证。当前公开非交互启停合同不足，第一版只做安装、检测、打开设置和卸载；启停仍交给 Cursor。

第一真实样例建议使用只读、无本地包、无静态密钥的 OpenAI Developer Docs 远程 MCP：固定 URL `https://developers.openai.com/mcp`，先接 Codex。验证 `codex mcp list`、新会话可列出工具、禁用后不加载、卸载后仅该表消失。随后把同一资源以独立 profile 接入 Claude Code 和 Cursor；每个宿主分别产生收据。

### C. `host-plugin-cli`

插件不应退化为“复制目录”，因为宿主市场负责依赖、缓存、启停、更新和卸载。Adapter 只允许固定宿主、固定市场、固定插件、固定 scope 和固定子命令。

- 第一支持宿主应为 Claude Code：官方已经提供可脚本化的 `claude plugin install/uninstall`、enable/disable、marketplace 管理和 validate。
- 安装前要求 Claude Code 宿主发现通过；调用时 `shell:false`，插件和市场 ID 全部来自本地 profile。
- 安装后用官方 list/status 输出验证插件 ID、scope 和 enabled 状态；收据记录宿主报告的插件版本与 scope，不记录宿主缓存内部路径作为删除依据。
- 更新调用官方 marketplace update/插件更新合同；AI Hub 不直接改 `~/.claude/plugins/cache`。
- 卸载只调用固定官方子命令；宿主返回失败时保留收据。

第一真实样例建议使用 Anthropic 自己的演示市场 `anthropics/claude-code` 中的 `commit-commands`，固定 user scope；它不要求第三方 token，且只有用户显式调用命令时才改仓库。验收覆盖 install -> list -> disable -> enable -> uninstall。若产品要求只上正式官方市场，则改选 `claude-plugins-official` 中一个无需凭据的轻量插件，并重新锁定身份与版本。

Codex/ChatGPT 插件暂缓“后台一键完成安装”：官方 CLI 目前管理 marketplace，而实际安装仍由 Plugins Directory 完成。可安全落地的是“添加固定、锁定来源的 marketplace -> 打开宿主插件详情 -> 由用户确认安装”。Cursor 插件同理，当前公开合同以 Marketplace/UI 和交互 `/add-plugin` 为主，没有稳定的非交互安装/卸载接口。

### D. `comfy-manager-handoff`

Comfy Custom Nodes 可以执行 Python 依赖安装和可选生命周期脚本，等同于在用户权限下运行第三方代码。第一版只做：

1. 复用 Comfy Desktop 生命周期确认具体实例和工作区。
2. 打开该实例内置 ComfyUI Manager 的固定节点详情。
3. 由 Manager 显示版本、依赖、更新、禁用和卸载并让用户确认。
4. AI Hub 记录“已交接”，但不伪造拥有文件收据或宣称安装完成。

只有 Comfy 官方提供稳定、可审计且能锁定 registry node ID/version 的非交互 Manager 接口，并完成真实 Windows 实例测试后，才新增托管 Adapter。不得复用通用 `directory-snapshot` 后再自行执行 `requirements.txt` 或 `install.py`。

## 最小深模块接口

不要为 Skill、MCP、插件分别复制一套 IPC 和 UI 状态机。建立一个资源生命周期模块，外部只暴露两个操作：

```ts
inspect(profileId: string): Promise<ResourceLifecycleState>
execute(profileId: string, action: ResourceAction): Promise<ResourceLifecycleState>
```

`ResourceAction` 只允许 `install | update | repair | enable | disable | open | uninstall`。返回值包含统一 `state`、`installedVersionRef`、`availableVersionRef`、`allowedActions`、`requiresHostAction` 和安全错误码；不返回本地私密路径、命令或凭据。

模块内部完成：本地 profile 解析、当前签名目录重新授权、宿主发现、Adapter 分派、互斥、事务/回滚、收据 v2、内容漂移检测和安全结果清洗。宿主与资源 Adapter 是内部 seam：至少已有目录快照、配置键和宿主 CLI 三种真实 Adapter，因此该 seam 不是为未来预留的空抽象。

IPC 可收敛为：

```text
resource:inspect(profileId)
resource:execute(profileId, action)
resource:inventory()
```

`resource:inventory()` 只扫描本地批准 profile 和合法收据，并接入现有“已安装管理”。UI 只渲染 `allowedActions`，不自行推导 `shouldInstall/shouldUninstall`。

安装/更新/启用要求当前目录授权；检测/停用/卸载可凭合法收据继续。这样既保留后台启停，又不会因后台删卡让用户失去卸载能力。

## 必须通过的测试

### 合同与单元测试

- 目录目标必须与本地 profile 的资源、宿主、模块、能力完全一致；未知 profile 永远不能选择 Adapter。
- 当前目录停用或删除目标后，install/update/enable 被拒绝，inspect/disable/uninstall 仍可从合法收据恢复。
- 宿主缺失、版本过低、状态未知分别返回不同状态，且检查动作不创建目录或修改配置。
- Codex 新路径解析、`$HOME/.agents/skills` 与旧 `{CODEX_HOME}/skills` 收据迁移分别测试；不能再次把旧路径当作唯一真值。
- 快照路径穿越、绝对路径、junction/symlink、特殊文件、超大文件、哈希不符全部拒绝。
- 安装和更新支持故障注入：复制中断、配置写入中断、收据写入失败均回滚到原状态。
- 收据 v2 被篡改不能扩大删除范围。
- 用户修改已安装文件、增加文件、修改 MCP 键时进入 `modified/conflict`；默认卸载不得删除用户改动。
- JSON/TOML 配置包含注释/未知键/并发修改/畸形内容时不丢数据；无法安全合并就停止。
- 同一 MCP 名称已由用户配置时返回 `external`，不领养、不覆盖；只有显式且可证明完全相同的领养流程才写收据。
- CLI Adapter 断言 `shell:false`、固定 executable、固定参数顺序、固定 scope；错误输出不泄漏 token、路径或环境变量值。
- OAuth 只返回“需要宿主认证”，不由 AI Hub 截获授权码或凭据。
- install/update/repair/enable/disable/uninstall 对同一 profile 串行互斥，重复操作幂等。

### 宿主集成测试

- Codex Skill：临时 HOME 安装、更新、禁用、启用、保守卸载；再在真实 Codex 新会话确认发现。
- Codex MCP：临时 config 安装和键级卸载；真实执行 `codex mcp list`，必要时新会话列工具。
- Claude Code MCP：真实 `claude mcp add/list/get/remove --scope user`，使用隔离 HOME；Windows STDIO 另测固定 `cmd /c`。
- Claude Code 插件：真实 install/list/disable/enable/uninstall，宿主拒绝或插件更新失败时收据保留。
- Cursor MCP：临时 JSON 合并，再由真实 `agent mcp list` 读取；Windows Home 与 WSL Home 分开验收。
- Comfy：只验收打开正确实例的 Manager 详情，没有稳定官方非交互接口前不做自动安装成功断言。

### 客户端 UI 与打包测试

- 进入资源详情不自动探测；用户点击“检测”后显示真实状态和允许动作。
- 客户端重启后已安装资源仍能检测、禁用、更新或卸载。
- 已安装管理页汇总产品、环境和资源，但资源收据不混入产品安装收据。
- 远程目录新增普通资源无需重打包；新增本地 profile/Adapter 必须升级客户端。
- 打包产物包含所有固定快照、清单和许可证；安装包内哈希与源码测试一致。
- 自动化通过后仍保留 Windows 用户验收：真实宿主加载、OAuth、重启/重载、代理网络和卸载后的用户文件保留。

## 本轮验证证据

执行以下只读/临时目录测试，33 项全部通过：

```text
node --test \
  tests/extension-host-targets.test.cjs \
  tests/extension-runtime.test.cjs \
  tests/extension-ipc.test.cjs \
  tests/extension-resource-snapshot.test.cjs \
  tests/ecosystem-resources.test.cjs \
  tests/ecosystem-store-contract.test.cjs \
  tests/catalog-projections.test.cjs \
  tests/admin-ecosystem-resource-ui.test.cjs
```

这些测试证明当前白名单、路径防逃逸、符号链接拒绝、收据边界、目录投影和 IPC 字段清洗有效；它们没有证明现行 Codex 会加载旧目标目录，也没有覆盖版本、更新、修复、启停、宿主依赖、配置键合并或真实客户端验收。

## 实施顺序

1. 先修 Codex Skill 现行路径与旧收据迁移，升级收据 v2，并让资源状态进入已安装管理。
2. 用 OpenAI Developer Docs 远程 MCP 打通 `codex-mcp-toml` 的完整状态、启停和卸载。
3. 复用同一资源生命周期模块增加 `claude-code-mcp-cli` 和 `cursor-mcp-json`。
4. 用 Claude Code 官方命令打通一个固定插件的 install/list/disable/enable/uninstall。
5. Codex/ChatGPT 与 Cursor 插件先做官方市场交接，不宣称自动安装。
6. Comfy Custom Nodes 保持 Manager 交接，等稳定官方非交互接口和安全审计后再评估托管。

完成前四步并通过真实 Windows 宿主验收后，才可以把“Skill / MCP / 插件安装闭环”标记为完成。
