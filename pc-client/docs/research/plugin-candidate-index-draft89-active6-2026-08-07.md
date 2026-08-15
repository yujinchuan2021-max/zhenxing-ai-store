# Plugin 候选索引与缺口报告（draft89 / v2 active6，2026-08-07）

## 事实基线与范围

本报告只新增候选研究索引，不新增 catalog/resource/target，不修改 state，不调用 saveDraft/publish，不下载或运行插件。事实基线：

- draft revision 89；
- v2 activeCatalogVersion 6，activeReleaseId 为 catalog-v00000006-567e671621f1-3dcee587；
- 当前 Plugin 资源 8 条，其中既有 1 条 managed target（Claude Commit Commands），其余 7 条为 resource-link/official-link-only；
- 所有候选都必须以宿主产品为第一兼容边界，不能因为同一插件支持多个 Agent 就创建产品频道或硬编码 Agent 绑定。

## 21 个 canonical 场景标签

候选只保存固定 canonical ID；aliases/rawTags 仅用于 intake/search 和映射证据。当前 vocabulary：

编程、Agent、多Agent、自动化、办公、数据、科研、知识库、内容、图像、视频音频、3D/CAD、游戏、营销、电商、财务、教育、健康、安全运维、社交、浏览器采集。

“游戏开发”保留在 rawTags，通过 mappingEvidence 映射到 canonical “游戏”，不增加第 22 个标签。所有本轮候选均未创建 mature-agent 频道。

## 新增候选索引

以下条目是官方或社区作者来源的研究候选，不是可安装许可。重复判断键为 originalAuthorIdentity + canonicalRepoOrPackage + resourceId + hostProductId。

| candidateId / resourceId | 来源层 | 原作者与 canonical source | 宿主 | 版本/维护/license 证据 | 标签与 Agent 兼容 | 状态与缺口 |
| --- | --- | --- | --- | --- | --- | --- |
| anthropic-claude-code-code-review | official | Anthropic；github.com/anthropics/claude-code/tree/main/plugins/code-review | claude-code | 官方仓库插件目录；本轮未将 main commit 当固定版本；许可证/发布包身份仍待逐项记录；仓库显示持续维护 | rawTags: code-review, programming, agent；normalizedTags: 编程, Agent；兼容 Claude Code，非 mature-agent | automated-reviewed / guarded / not-eligible；缺固定 release/content hash、Windows 宿主安装位置和独立 receipt |
| anthropic-claude-code-feature-dev | official | Anthropic；github.com/anthropics/claude-code/tree/main/plugins/feature-dev | claude-code | 官方仓库插件目录；main 为 rolling；许可证和固定发布身份待核验 | rawTags: programming, agent, workflow；normalizedTags: 编程, Agent, 自动化；兼容 Claude Code | automated-reviewed / guarded / not-eligible；含 commands/agents/workflow，不能后台下发 |
| anthropic-claude-code-pr-review-toolkit | official | Anthropic；github.com/anthropics/claude-code/tree/main/plugins/pr-review-toolkit | claude-code | 官方仓库插件目录；main 为 rolling；许可证和固定发布身份待核验 | rawTags: code-review, programming, agent；normalizedTags: 编程, Agent；兼容 Claude Code | automated-reviewed / guarded / not-eligible；缺固定版本、安装/卸载收据和 Windows 实机证据 |
| anthropic-claude-code-plugin-dev | official | Anthropic；github.com/anthropics/claude-code/tree/main/plugins/plugin-dev | claude-code | 官方仓库插件目录；官方 README 记录 toolkit 内容，但未形成 AI Hub 固定发行物 | rawTags: programming, agent, automation；normalizedTags: 编程, Agent, 自动化；兼容 Claude Code | automated-reviewed / guarded / not-eligible；开发工具本身可生成插件/钩子/MCP，不能作为 managed 执行资源 |
| openclaw-official-diffs | official | OpenClaw；github.com/openclaw/openclaw/tree/main/extensions/diffs | openclaw-agent | 官方 bundled plugin 身份随 OpenClaw 构建；本轮未固定 OpenClaw release 与插件内容 hash；license/维护证据待 release 级核验 | rawTags: programming, agent；normalizedTags: 编程, Agent；兼容 OpenClaw | automated-reviewed / guarded / not-eligible；Gateway trusted-computing-base，缺 AI Hub 固定宿主 profile 与 Windows receipt |
| comfyui-manager-custom-node-manager | official | Comfy-Org；github.com/Comfy-Org/ComfyUI-Manager | comfy-desktop | 官方组织仓库；支持 custom node registry/CLI 管理；版本与节点内容是分离的 rolling 集合，许可证和 Windows 位置待逐项核验 | rawTags: image, automation, 3d；normalizedTags: 图像, 自动化, 3D/CAD；兼容 Comfy Desktop | automated-reviewed / unsafe / not-eligible；会安装/更新/启停/卸载节点及依赖，属于动态代码/脚本执行面 |
| obra-superpowers-claude-plugin | community | Jesse Vincent / obra；github.com/obra/superpowers；plugin manifest version 5.1.0、MIT | claude-code | 作者 manifest 提供版本、作者、repo、MIT；官方 README 同时说明 Claude marketplace 与 GitHub 安装 | rawTags: programming, agent, automation, tdd；normalizedTags: 编程, Agent, 自动化；兼容 Claude Code，其他 harness 仅保留 raw compatibility evidence | automated-reviewed / guarded / not-eligible；多 harness/marketplace、hooks/skills、Windows hook 与缓存边界待独立宿主验收 |
| openclaw-codex-app-server-community-lead | community | 原作者/包身份待确认；仅作为 OpenClaw 官方文档中支持的 ClawHub/npm/Git 来源研究线索，不设 canonical package | openclaw-agent | 没有原作者 canonical repo/package、版本、许可证或维护证据，故不构造虚假 resourceId | rawTags: agent, tools；normalizedTags: Agent；agentCompatibility 未确认 | unreviewed / null / not-eligible；仅线索，必须先找到原作者一手来源，不能用 ClawHub 聚合页代替 |

## 统一状态字段

- official/community 只描述来源层，不代表安全或 managed 资格。
- reviewStatus 只取 unreviewed、automated-reviewed、manually-reviewed、rejected。
- riskLevel 只取 low、guarded、unsafe；未完成风险评估使用 null。
- unsafe/rejected 只能展示警示，不得 managed 安装、Agent 绑定或 Workflow 依赖。
- popularity 本轮全部保持 null；若后续记录外部星级/下载量，必须同时记录 sourcePlatform、observedAt 和原始指标语义，不能映射成审核或风险结论。
- managedEligibility 本轮全部为 not-eligible；只有现有 fixed plugin profile/module/host/capabilities 完整匹配时才可改变。

## 维护、去重与缺口

1. Claude 官方插件子目录必须按每个 plugin directory 独立 canonical source 记录；不能把整个 marketplace 与单项插件复制成两份资源。现有 anthropic-official-plugin-marketplace 继续作为聚合入口，不自动吸收单项执行资格。
2. Superpowers 的 manifest 已给出版本和 MIT，但 marketplace、hooks、skills、跨 harness 分发与 Windows 行为仍需客户端专用 adapter、固定内容 hash、所有权 marker/receipt 和真实宿主验收。
3. ComfyUI-Manager 是管理器，不等于某个 custom node；节点包、依赖和版本必须按原作者 canonical repo/package 去重，不能将 registry 的动态列表作为单个 managed resource。
4. OpenClaw bundled/plugin registry 的“官方”只证明宿主生态来源；Gateway 对插件赋予本地代码同等级信任，不能由后台把它转成任意执行入口。
5. 缺少原作者 canonical source、固定版本/内容身份、license、Windows 安装位置、宿主范围或生命周期收据的候选，保持 link-only/blocked。
6. agentCompatibility 只记录官方文档或原作者 manifest 明示的宿主兼容事实；不建立 Hermes 等单产品频道，也不凭产品 ID 推导兼容性。

## 候选 intake 设计与规模估算

本轮只建立可恢复 intake 设计，没有执行大规模抓取：

- 第一阶段只抓元数据：每个 canonical source 1 个入口请求，最多 8 个新增候选、8 个已有聚合入口复核，总计上限 16 个请求；
- 限速：串行或并发上限 2，单请求超时 5 秒，失败重试最多 1 次，按 canonical URL 缓存；
- 缓存键：normalized canonical URL + observedAt bucket；结果写入候选文档/JSON，不写 catalog/state；
- 不下载 zip/tgz/exe，不运行插件，不读取私有 API，不登录，不收集 secret；
- 预估网络耗时：理想 16 × 1 秒约 16 秒；按 5 秒超时上限约 80 秒，重试最坏约 160 秒；
- 预估磁盘：仅 JSON/Markdown 元数据和响应摘要，低于 1 MiB；插件包下载量严格为 0；
- robots/官方站点规则：尊重 robots 与官方速率限制；聚合站最多作为 discoveredVia，公开链接回原作者。

大规模详情抓取暂不启动。只有在候选数量、请求数、耗时、磁盘和缓存命中率可审计后，才可申请下一阶段的人工批准。

## 官方来源

- [Anthropic official plugin directory](https://github.com/anthropics/claude-code/blob/main/plugins/README.md)
- [Claude Code repository](https://github.com/anthropics/claude-code)
- [OpenClaw plugin CLI](https://github.com/openclaw/openclaw/blob/main/docs/cli/plugins.md)
- [OpenClaw security model](https://github.com/openclaw/openclaw/security)
- [ComfyUI-Manager repository](https://github.com/Comfy-Org/ComfyUI-Manager)
- [ComfyUI-Manager CLI](https://github.com/Comfy-Org/ComfyUI-Manager/blob/main/docs/en/cm-cli.md)
- [Superpowers repository](https://github.com/obra/superpowers)
- [Superpowers plugin manifest](https://github.com/obra/superpowers/blob/main/.claude-plugin/plugin.json)

