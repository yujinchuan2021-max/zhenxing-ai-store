# 插件商店固定 profile 审核队列复核（2026-08-06）

## 范围与事实源

本轮完整读取 CTO manual、团队 ownership、development-status、插件只读审计和未受管项一手复核，并以 pc-client/admin/published/catalog-store/state.json 为目录事实源。未修改代码、catalog、state；未调用 saveDraft、发布、封包或下载大文件。

实际文件状态：

- draft.revision = 89，draft catalog 含 146 个资源。
- state.json 顶层/legacy v1 实际为 activeCatalogVersion = 72，activeReleaseId = catalog-v00000072-e286516335da-a8b62a49。
- state.json 的 channels.v2 实际为 activeCatalogVersion = 6，activeReleaseId = catalog-v00000006-567e671621f1-3dcee587。
- 因此本轮口径同时报告 v1=72 与 v2=6；v1 的 72 不称为 schema v2 active。state 未被修改。

## Plugin 资源盘点

当前 draft revision 89 与 v2 active release v6 的 8 个 plugin 资源及 targets 一致；legacy v1 active release 为 v72。两条通道均只作本轮事实核对，不修改 active 指针：

| resourceId | 宿主 productId | 官方发布者/来源身份 | 当前 target 原语 | 固定版本/内容身份 | Windows 与生命周期边界 | 队列结论 |
| --- | --- | --- | --- | --- | --- | --- |
| anthropic-official-plugin-marketplace | claude-code | Anthropic / Claude Code 官方插件发现页 | resource-link，空 profile，website | 市场目录动态；单个插件版本未固定 | 需要宿主内交互市场；安装、更新、权限和移除随选中插件变化 | 不进入固定 profile 队列；保持 official-link-only |
| comfy-custom-nodes | comfy-desktop | Comfy-Org Registry、官方 comfy-cli | resource-link，空 profile，website | 节点包/依赖/提交未固定 | 自定义代码与 Python 依赖；需宿主环境和人工选择，不能下发脚本/包/参数 | 不进入；保持 official-link-only |
| google-gemini-cli-extensions | gemini-cli | Google Gemini CLI 官方仓库/文档 | resource-link，空 profile，website | 可用 Git ref，但目录未固定具体仓库、ref 或内容 hash | 官方 CLI 支持 URL/本地路径、Git ref、MCP、hooks、commands、settings；可涉及敏感设置 | 不进入；保持 official-link-only |
| moonshot-kimi-plugins | moonshot-kimi-code-cli | Moonshot Kimi Code 官方文档/官方市场 | resource-link，空 profile，website | 市场版本动态；自定义 URL/GitHub/zip 可 pin 但当前资源未指定 | 用户级、全项目生效；交互安装、reload、新会话；可含 hooks/MCP/agents/commands；部分官方插件需 OAuth | 不进入；保持 official-link-only |
| amazon-kiro-powers | amazon-kiro-ide | Kiro 官方 Powers 文档 | resource-link，空 profile，website | 当前目录没有固定 Power 身份/版本/hash | 官方证据不足以固定 Windows 安装、检测、启停、更新、卸载和权限契约 | 不进入；保持 official-link-only |
| openclaw-clawhub-plugins | openclaw-agent | OpenClaw 官方文档/ClawHub | resource-link，空 profile，website | ClawHub 版本可 pin，但当前资源没有具体包/version | Gateway 执行并可能重启；多来源、operator.admin、配置/信任确认、OAuth/MCP 登录和 telemetry 边界 | 不进入；保持 official-link-only |
| cline-official-skills-plugins | cline-agent | Cline 官方文档/官方仓库 | resource-link，空 profile，website | 当前资源混合 Skills/Plugins/MCP，无单一固定内容身份 | 未形成固定 Windows 插件生命周期契约，存在频道越界风险 | 不进入；保持 official-link-only |
| anthropic-commit-commands-plugin | claude-code | Anthropic 官方仓库 plugins/commit-commands | plugin-managed，profile plugin.claude.commit-commands | 客户端已有 profile/versionRef 约束；需以客户端注册表为准 | 这是唯一已绑定 install/update/repair/enable/disable/uninstall 的插件 profile；仍需客户端审核/实机验收 | 已在固定 profile 审核边界内，作为现有项保留 |

## 最小候选队列

本轮没有从 7 个未受管资源新增候选。最小队列为空；唯一现有可继续审核的固定 profile 是：

plugin.claude.commit-commands → claude-code → anthropic-commit-commands-plugin

该项不是本轮新批准，也不因官方仓库存在而自动获得执行许可。下一步应由插件商店责任人整理固定来源/版本内容证据，由 AI 商店后台员工只读核验 schema 映射，再由测试发布运维负责客户端审核与 Windows 实机验收。任何新增 profile 的实现责任人应是“插件商店”员工；后台员工不能代替客户端 runtime 实现，测试发布运维不能代替来源/目录归属判断。

## 不得越过的边界

- 插件始终是资源层，不进入 AI 工具一级产品列表。
- 后台只可引用已批准的 productId、固定 moduleId 和 installProfileId；不接收 command、args、env、headers、脚本、凭据、令牌、密码、任意路径或任意动态下载地址。
- 扩展市场、GitHub 仓库存在、官方页面可访问，都不等于可执行或可安装许可。
- 需要用户登录、OAuth/API key、市场交互、动态下载、人工确认或宿主配置的候选，只能保留官方入口。
- Windows 支持、安装/检测/启停/更新/卸载边界必须来自官方一手资料和客户端固定原语；没有完整证据不得进入 profile 审核队列。

## 官方一手来源

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
