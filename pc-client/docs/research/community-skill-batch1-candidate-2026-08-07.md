# 社区 Skill Batch 1 候选（2026-08-07）

状态：`candidateOnly=true`、`publishable=false`。本分片已完成 **20/100** 条一手来源、作者和许可证复核；剩余 80 条列为可复核来源队列，未用数量填充未验证记录。

## 字段、去重与安全合同

- canonical identity 是 `GitHub owner/repository + distinct Skill identity`；同一仓库的不同独立 Skill 可以保留，多个聚合来源只并入 `discoveredVia`。本分片 0 个批内重复；OpenAI ChatGPT Apps Skill 已存在 active catalog，记录为 1 个 merge candidate，不重复计数。
- 每条有 canonical source、原作者链接、license 状态/证据、source kind/platform、观察时间和 discoveredVia。GitHub 是本分片的直接一手来源；没有把 CocoLoop、awesome list 或任何聚合站写成 canonical source。
- `reviewStatus=manually-reviewed` 与 `riskLevel=guarded` 独立；20 条全是外链候选，没有 profile、安装、Agent binding 或 Workflow action。Cloudflare、Anthropic DOCX/PDF 的许可证未确认，明确 `blocked-license-unresolved`。
- 分类仅使用既有 21 项 canonical taxonomy；原始标签和映射证据均保留。成熟 Agent 标记仅用于频道候选，不能提升执行权限。

## 本批统计

| 项目 | 结果 |
|---|---:|
| 已核验候选 / 目标 | 20 / 100 |
| 来源 | GitHub 20 |
| 许可证 | resolved 17；unresolved/blocked 3 |
| review / risk | manually-reviewed 20；guarded 20 |
| 批内重复 / active merge | 0 / 1 |
| 原作者直链覆盖率 | 100% |
| 外部热度 | 未采集，不参与任何门禁 |

首批内容为 Superpowers 的 14 个独立 Skill、Agent Browser、Supabase 的 2 个独立 Skill、Cloudflare Skill，以及 Anthropic DOCX/PDF。Superpowers 的 Skill 列表与 MIT license、Agent Browser 的 Apache-2.0 license、Supabase 的 Agent Skills/许可证都由原仓库直接说明；Anthropic 明确部分文档 Skill 为 source-available，故不把它们误标为开源或可安装。[Superpowers](https://github.com/obra/superpowers) · [Agent Browser](https://github.com/vercel-labs/agent-browser) · [Supabase Agent Skills](https://github.com/supabase/agent-skills) · [Anthropic Skills](https://github.com/anthropics/skills)

## 剩余队列与交接

剩余 80 个槽位按 Anthropic、Cloudflare、Google Workspace CLI、Sentry replacement、Flutter、Supabase 的原作者仓库排队。每项仍须逐 Skill 核验 LICENSE、不可变来源/版本线索、权限与凭据边界；Google Workspace 等需要 OAuth/CLI 的内容必须保留 link-only/blocked，不能被归入受管安装。

未修改 catalog/state/schema/profile，未 saveDraft、publish、sign、package、upload、download 或 install。本文件是候选索引，不代表已上线。
