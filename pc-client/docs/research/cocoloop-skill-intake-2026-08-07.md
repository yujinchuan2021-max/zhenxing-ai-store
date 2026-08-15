# CocoLoop Skill 全量索引与 metadata intake（2026-08-07）

## 本轮状态

状态：**blocked-before-crawl**。已完成最小解析器和 fixture 绿测，但未能读取公开入口 `https://skill.cocoloop.com/robots.txt` / `https://skill.cocoloop.com/sitemap-index.xml`：当前运行环境的 HTTPS TLS 连接在握手阶段失败（PowerShell `基础连接已经关闭`，Node `fetch failed`）。因此没有伪造全量数量、分片、重复或缺失统计，也没有写入不完整的 candidate index。

公开合同仍按既定口径实现：只读 robots 声明的 sitemap index，再读取 `skills-N.xml`；`/api/`、非 HTTPS、外部 host 和 ZIP/源码下载均拒绝。恢复网络后运行：

```text
cd pc-client
node scripts/cocoloop-skill-intake.mjs
```

脚本会在 `pc-client/output/research/cocoloop-skill-intake/` 原子写入 `candidate-index.ndjson`、摘要和 URL 哈希缓存；重复运行可复用缓存。每项保留 `externalId/pageUrl/lastmod/discoveredVia/observedAt`，不会写 active catalog、state、profile 或 binding。

## metadata 解析与风险边界

`shared/cocoloop-skill-intake.cjs` 只解析公开 HTML：名称、简介、版本、作者显示、分类、外部 rating/install/favorites/CLS、页面内安全声明、ZIP 链接和 GitHub/官网/注册表候选链接。新增 `agentCompatibility.raw/normalized/mappingEvidence` 与 `rawTags/normalizedTags/mappingEvidence`；规范化标签只允许 canonical 清单（含 `游戏`，并识别 `game-development`），原始标签始终保留。外部评分带 `sourcePlatform=cocoloop` 与 `observedAt`，不映射本项目 `reviewStatus` 或 `riskLevel`；`provenanceStatus` 默认 `provenance-unresolved`，必须回溯原作者后才能设 canonical source，CocoLoop/dl.cocoloop 永不作为 canonical source 或默认下载源。Hermes 相关页面保留 `matureAgentEcosystemCandidate` 提示，仍只是候选索引，不获得受管安装资格。

## 详情抓取估算与暂停门

本轮未启动详情抓取。按任务提供的约 160,000 个公开 Skill 页面、默认 1.5 秒限速和最多 3 次退避重试估算：约 **160,002 次请求**（robots/index 加页面）、最低串行时间约 **66.7 小时**；按每页 200 KiB 缓存约 **30.5 GiB**（不含索引/重试）。即使 sitemap 恢复，也必须先以 `--metadata` 输出估算，再由 CTO 明确 `--ack-estimate` 后才允许小批 metadata；禁止无界运行。

## 验证与未做事项

- `node --test --test-reporter=spec tests/cocoloop-skill-intake.test.cjs`：5/5 PASS。
- 未调用 `/api/`，未登录，未下载 ZIP/源码，未执行或安装 Skill。
- 未修改 catalog/state/profile/binding，未 saveDraft/publish/package/upload。
- 全量 sitemap index、分片、重复和缺失统计待网络恢复后补跑；当前无候选数据可交给后台审批。
