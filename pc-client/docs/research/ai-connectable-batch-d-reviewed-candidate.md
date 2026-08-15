# AI 可接入 Batch D：严格一手证据二次复核

日期：2026-08-05。范围为历史 65 项队列的最后 5 项。未调用 saveDraft、未发布、未新增 schema/实体/执行能力。

## 结果

| 结论 | 数量 |
|---|---:|
| accepted | 3 |
| rejected | 1 |
| needs-more-evidence | 1 |

### Accepted（均已正确，no-op）

| productId | 一手依据 | directoryKind/category | 结论 |
|---|---|---|---|
| airtable-platform | 官方 Airtable MCP 明确兼容 ChatGPT/Claude 等并以权限范围访问 Airtable | ai-connectable / 办公自动化 | 正确，no-op |
| ptc-creo | 官方 Creo AI Assistant；仅 Advise 是当前正式能力，Assist 为 Beta、Automate 为 Alpha | ai-connectable / 3D 与工业仿真 | 正确，no-op |
| anytype-desktop | 官方 MCP 让 AI assistants 通过 Anytype API 操作 Anytype | ai-connectable / 文档与知识库 | 正确，no-op |

来源：
- https://support.airtable.com/docs/using-the-airtable-mcp-server
- https://www.ptc.com/en/products/creo/capabilities
- https://developers.anytype.io/docs/examples/featured/mcp/

### Rejected / needs-more-evidence

anydesk-windows：官方 REST API 为账户、设备和会话管理自动化，不是 AI 接入，rejected。  
allplan：所列 ALLPLAN Connect/Campus 法律文件含 AI Assistant 表述，但未直接绑定到当前 ALLPLAN Windows 产品，needs-more-evidence。

## A–D 覆盖核对

A–D JSON 合计 65 条且 productId 唯一，无重复、缺失或越界。历史 65 条集合保持完整。

但 Batch D 原文“当前 catalog 以 ai-connectable + desktop-reviewed/desktop-official 筛出 65”已经过时：draft84 中 docker-desktop（Batch A）和 audacity-desktop（Batch C）均已改为 desktop-download-only，按该当前筛选仅为 63。该差异不代表历史 65 条研究集合遗漏。

最小 catalog patch：no-op。

