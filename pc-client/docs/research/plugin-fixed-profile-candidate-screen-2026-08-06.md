# 插件商店下一批固定 profile 候选筛选（2026-08-06）

## 结论

No-op：7 个现有 official-link-only/resource-link Plugin 资源中，没有满足全部固定 profile 准入条件的候选。没有新增候选，不改代码、catalog、state，不 saveDraft、不发布、不封包、不下载、不安装。

事实源为 state.json：draft revision 89；v2 activeCatalogVersion 6，activeReleaseId catalog-v00000006-567e671621f1-3dcee587。本轮只筛选现有 7 条未受管资源；既有 anthropic-commit-commands-plugin 不属于本批候选。

## 准入条件

必须同时具备：官方固定分发源与固定版本/内容身份；明确 Windows 宿主和安装位置；无需秘密、登录或人工 marketplace 状态；可由客户端固定原语精确 detect/install/enable-disable/update/uninstall；安装范围和权限可固定；可建立 AI Hub 所有权收据。任一条件缺失即 blocked/link-only。

## 逐项结果

| resourceId | 宿主 | 官方来源 | 权限/范围/生命周期 | 阻断 |
| --- | --- | --- | --- | --- |
| anthropic-official-plugin-marketplace | claude-code | Claude Code 官方插件发现/市场页 | 宿主内交互选择；目录和版本由远端市场决定；没有单个插件固定内容身份、安装位置和统一卸载契约 | 远端 marketplace 动态状态；不能建立可复现 profile/receipt |
| comfy-custom-nodes | comfy-desktop | Comfy Registry、Comfy-Org comfy-cli | 节点是自定义代码和依赖，安装依赖宿主环境与人工选择；位置、依赖和卸载边界由节点/宿主决定 | rolling 节点集、动态依赖和脚本/包执行；禁止后台下发 |
| google-gemini-cli-extensions | gemini-cli | Google Gemini CLI 官方仓库/文档 | 官方流程支持 GitHub URL/本地路径、Git ref，并可含 MCP、hooks、commands、skills、agents 和敏感 settings；非固定单一 Windows 安装位置 | 扩展内容和来源未固定；存在动态脚本/命令与秘密配置；不能精确收据化 |
| moonshot-kimi-plugins | moonshot-kimi-code-cli | Kimi Code 官方市场/文档 | 用户级、全项目生效；交互式官方/第三方/自定义市场；支持 URL/GitHub/zip；插件可含 hooks/MCP/agents/commands，部分官方插件需 OAuth | 远端 marketplace、用户登录/秘密、动态内容和人工确认；不能代管 |
| amazon-kiro-powers | amazon-kiro-ide | Kiro 官方 Powers 页面 | 当前一手资料未固定 Windows 安装位置、detect、版本/内容身份、启停、更新、卸载、权限与收据语义 | 仅说明页，证据不足；不得推测 profile |
| openclaw-clawhub-plugins | openclaw-agent | OpenClaw 官方文档/ClawHub | Gateway 执行并可能重启；来源可为 ClawHub/npm/Git/marketplace/本地路径；需 operator.admin，可能需要 OAuth/MCP 登录和配置 | 动态 registry、多来源、权限/秘密/重启和信任流程；社区插件保持 blocked |
| cline-official-skills-plugins | cline-agent | Cline 官方文档/仓库 | 资源名混合 Skills、Plugins、MCP；当前没有单一固定 Plugin 内容身份、Windows 生命周期或安装收据契约 | 频道/资源层级混合，不能把 Skills/MCP 冒充 Plugin，也不能推测执行许可 |

## 处理决定

7 项全部保持现有 target：

- moduleId: resource-link
- installProfileId: 空
- capabilities: ["website"]

不要为了“候选数量”创建 profile。下一步只有在客户端实现固定 adapter、来源/版本 pin、宿主安装位置、所有权 marker/receipt 和无秘密权限边界后，才可重新提交单项候选审核；实现责任人为插件商店员工，后台员工只负责之后的 schema/target 只读核验，测试发布运维负责真实宿主 CLI、marketplace 和用户设备验收。

## 官方来源

- [Claude Code plugin discovery](https://code.claude.com/docs/en/discover-plugins)
- [ComfyUI custom nodes](https://docs.comfy.org/development/core-concepts/custom-nodes)
- [Comfy Registry](https://registry.comfy.org/)
- [Gemini CLI extension reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md)
- [Kimi Code CLI plugins](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html)
- [Kiro Powers](https://kiro.dev/docs/powers/)
- [OpenClaw manage plugins](https://docs.openclaw.ai/plugins/manage-plugins)
- [OpenClaw plugin CLI](https://docs.openclaw.ai/cli/plugins)
- [Cline official docs](https://docs.cline.bot/cline-overview)
- [Cline official repository](https://github.com/cline/cline)

