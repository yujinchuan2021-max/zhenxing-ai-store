# Community Skill Batch 1 — complete candidate index (2026-08-08)

本分片将上一批 20 条与续作 80 条合并为 100 条唯一候选。它是候选索引，不是 active catalog。

- `candidateOnly=true`; `publishable=false`; 未保存草稿、发布、签名、封包、上传、下载、安装或执行。
- 100/100 条来自公开 GitHub 一手仓库；原作者直链覆盖率 100%；批内 canonicalKey 重复 0。
- 许可证：85 条已确认（Anthropic Apache-2.0、Google Workspace CLI Apache-2.0、Sentry MIT、Flutter BSD-3-Clause、上一批 MIT/Apache）；15 条阻断（Cloudflare 11、Anthropic source-available 文档技能 4 中新增 pptx/xlsx 2、上一批 docx/pdf 2）。
- 审核/风险：100 条 manually-reviewed；全部 guarded；未授予 managed install、Agent binding 或 Workflow action。
- 阻断：Google Workspace CLI 的 26 条技能依赖 OAuth/用户凭据并且由动态 API/CLI 生成，记录为 credential/runtime dynamic；Sentry/Flutter/Anthropic/Cloudflare 仅外链或许可证阻断。
- 分类覆盖使用既有 canonical taxonomy；保留 rawTags、normalizedTags、mappingEvidence。Agent/多Agent 仅标签候选，不产生执行权限。
- 合并/别名：现有 active OpenAI Skill 仍保留为 merge candidate；跨仓库同名的 Anthropic/Sentry `brand-guidelines` 与 `doc-coauthoring` 记录 aliasMergeCandidates，不合并 canonical identity。
- 外部热度未采集，因此不参与审核或风险。

一手证据索引：

- [Anthropic Skills](https://github.com/anthropics/skills/tree/main/skills)（README 明确文档技能为 source-available，其余示例技能多数 Apache 2.0）。
- [Cloudflare Skills](https://github.com/cloudflare/skills/tree/main/skills)。
- [Google Workspace CLI Skills Index](https://github.com/googleworkspace/cli/blob/main/docs/skills.md)；该项目 README 明确不是 Google 官方支持产品，且需要 Workspace OAuth。
- [Sentry for AI](https://github.com/getsentry/sentry-for-ai) 与 [Sentry team Skills](https://github.com/getsentry/skills)。
- [Flutter Agent Skills](https://github.com/flutter/skills)（README 列出 10 项，仓库 BSD-3-Clause）。

后续仍需对固定版本/不可变快照、宿主安装生命周期、Windows 支持及许可证逐项复核；本文件不改变 catalog/state/schema/profile。
