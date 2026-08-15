# 插件商店未受管项一手复核（2026-08-05）

本次复核读取了 `docs/audit/2026-08-05-plugin-store-readonly-audit.md`，只检查该报告中的 7 个无固定 profile 候选。来源限官方文档/官方仓库；没有下载、安装、登录、修改 catalog/state、调用 `saveDraft` 或发布。

## 总结

7 个候选均保持 `official-link-only`。本轮没有提出新的可安装 profile：客户端现有 `plugin-managed` 固定原语要求已批准宿主、固定 profile、固定 scope 和客户端本地审核；候选插件的官方流程普遍涉及交互式商店、远程/动态下载、Git/npm/URL 来源、Gateway/CLI 重启、人工确认、OAuth/API 凭据或 MCP/脚本/钩子，因此不能安全映射成后台可下发的安装动作。

## 逐项复核

| 资源 | 官方证据确认 | Windows/范围/权限/凭据/版本 | 结论 |
| --- | --- | --- | --- |
| `anthropic-official-plugin-marketplace` | Claude Code 官方插件发现页是交互式插件市场入口；当前目录 target 是 `claude-code`，只有 `resource-link`。 | 需 Claude Code 本地交互与市场选择；市场内容/版本由远程目录动态提供，具体插件可能需要登录或额外配置；固定版本、权限和移除契约未由该目录项固定。 | `official-link-only`；不得创建通用 marketplace profile。来源：[Claude Code plugins](https://code.claude.com/docs/en/discover-plugins)。 |
| `comfy-custom-nodes` | Comfy 官方文档将 custom nodes 作为可扩展代码，官方 Registry 与 `comfy-cli` 均是安装入口。 | Windows 安装依赖宿主环境与节点包；节点可能包含 Python/依赖和自定义代码，版本/权限/移除由节点与宿主流程决定，不能由固定 `resource-link` 推导。 | `official-link-only`；不得由后台下发节点包或脚本。来源：[ComfyUI custom nodes](https://docs.comfy.org/development/core-concepts/custom-nodes)、[Comfy Registry](https://registry.comfy.org/)、[comfy-cli](https://github.com/Comfy-Org/comfy-cli)。 |
| `google-gemini-cli-extensions` | Gemini CLI 官方仓库明确支持从 GitHub URL 或本地路径安装、更新、启用、停用、卸载。 | 支持 `--ref` 分支/tag/commit，但安装会复制远程扩展并要求 Git；扩展可带 MCP server、hooks、commands、skills、agents；设置可保存 API key/URL 等敏感值，且可按 user/workspace scope 管理。 | `official-link-only`；虽然有版本/启停原语，固定来源与内容审核仍不足，且涉及凭据和代码执行面。来源：[extension reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md)。 |
| `moonshot-kimi-plugins` | Kimi Code 官方文档说明 `/plugins` 是交互式管理器，支持官方/第三方/自定义市场，URL、GitHub、zip 和本地目录安装。 | 插件按用户安装并作用于所有项目；可 pin 到 tag/commit，但官方/第三方目录动态加载；插件可含 system prompt、hooks、MCP、agents 和 commands；官方 Kimi Datasource 明确要求 OAuth 登录并使用本地凭据。移除默认只删安装记录，保留 managed copy。 | `official-link-only`；不提出 profile，尤其不得收集 OAuth/API 凭据或代替用户操作。来源：[Kimi Code Plugins](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html)。 |
| `amazon-kiro-powers` | Kiro 官方文档把 Powers 作为 IDE 内的扩展能力，并提供 Install powers / Create powers 页面。 | 当前一手页面未给出足以固定 Windows 安装、版本锁、启停、移除、权限和凭据契约；安装面依赖 Kiro IDE 的交互和其目录。 | `official-link-only`；证据不足，不推测 URL 或 profile。来源：[Kiro Powers](https://kiro.dev/docs/powers/)。 |
| `openclaw-clawhub-plugins` | OpenClaw 官方文档说明 ClawHub 是插件 registry，可搜索、安装、更新、启用、停用、卸载。 | 安装由 Gateway 执行并可能自动重启；来源可为 ClawHub、npm、Git、marketplace 或本地路径；可 pin 版本，但任意来源需要确认/`--force`，安装/启停/移除需 `operator.admin`；ClawHub 登录可产生 telemetry，插件还可能需要 OAuth/MCP 登录和配置。 | `official-link-only`；不得把动态 registry 或权限/凭据流程转成后台固定安装。来源：[Manage plugins](https://docs.openclaw.ai/plugins/manage-plugins)、[ClawHub quickstart](https://docs.openclaw.ai/clawhub/quickstart)、[Plugin CLI](https://docs.openclaw.ai/cli/plugins)。 |
| `cline-official-skills-plugins` | 当前目录只链接 Cline 官方仓库；官方文档入口确认 Cline 支持扩展生态，但没有在本轮证据中得到该目录项对应的固定插件安装契约。 | 未核实到可绑定的固定 Windows 宿主 profile、固定版本/来源、启停/移除与权限/凭据字段；名称还混合 Skills、Plugins、MCP，存在频道越界风险。 | `official-link-only`；保持资源层级为目录链接，不在插件频道代管 Skill/MCP。来源：[Cline official docs](https://docs.cline.bot/cline-overview)、[Cline repository](https://github.com/cline/cline)。 |

## 客户端映射判定

现有 `plugin-managed` 原语虽提供 install/update/repair/enable/disable/uninstall，但需要客户端预先注册的 `extension-install-registry` profile。它不能接受后台传入命令、脚本、包名、动态 URL、参数、配置片段或文件路径。上述 7 项均未满足“固定 profile + 固定来源/版本 + 固定宿主范围 + 不需人工凭据/交互”的完整条件，因此没有新增 profile 候选。

建议暂保持现有目录中的 `moduleId=resource-link`、空 `installProfileId` 和仅 `website` capability；后续若要受管，必须先由客户端实现并审核专用固定 profile，再单独做人工验收。

## 来源与限制

本报告记录的是官方文档在 2026-08-05 可见的契约，不代表已在 Windows 机器上安装或验收。没有执行任何候选插件的安装、启停、移除、登录、下载或动态市场交互。
