# AI 可接入厂商第一方证据核对：Batch D（收尾）

核对日期：2026-08-05  
范围：原 65 项 evidence queue 中 A/B/C 处理后的剩余 5 项。  
严格口径：只有第一方明确说明 AI 接入、AI 宿主兼容、官方 MCP、AI API 或 AI 专用能力才记为 `confirmed`。通用 REST/API、普通插件和自动化接口不作 AI 接入推断。本轮不改 catalog/state、不 `saveDraft`、不发布、不招人。

## 覆盖校验

原始队列从 catalog 只读生成：`ai-connectable` 且 `desktop-reviewed` / `desktop-official` 的前 65 项。

| 校验项 | 结果 |
| --- | ---: |
| 原始队列总数 | 65 |
| Batch A | 20 |
| Batch B | 20 |
| Batch C | 20 |
| Batch D | 5 |
| A/B/C/D 记录总数 | 65 |
| 去重后 productId 数 | 65 |
| 重复 productId | 0 |
| 未覆盖 productId | 0 |
| 超出原始 65 项的 productId | 0 |

校验方式：读取 A/B/C JSON 的 `items[].productId`，与当前 catalog 生成的原始 65 项集合做集合差集和重复检查；A/B/C 已处理 60 个唯一 ID，D 补齐剩余 5 个唯一 ID。

## Batch D 结果

- `confirmed`：3 项
- `blocked`：2 项

| # | vendor / product | status | 官方证据与接入类型 | 对应一级产品 | 现有 category | category 判断 | 官方 URL |
|---:|---|---|---|---|---|---|---|
| 61 | Airtable / Airtable | confirmed | 官方 Airtable MCP；兼容 Claude、ChatGPT 等 MCP AI 工具；OAuth/权限沿用 Airtable；自然语言搜索、分析、创建和更新记录 | Airtable platform / Airtable MCP | 办公自动化 | 准确；建议补充办公数据库、MCP、AI agent | [Using the Airtable MCP server](https://support.airtable.com/docs/using-the-airtable-mcp-server) |
| 62 | AnyDesk / AnyDesk | blocked | 找到官方 REST API，但本轮没有明确 AI 接入、MCP 或 AI 宿主兼容证据；通用远程控制 API 不计入 | AnyDesk | 远程控制 | 准确 | [AnyDesk REST API](https://support.anydesk.com/docs/de/rest-api) |
| 63 | PTC / PTC Creo / Creo+ | confirmed | Creo AI Assistant；官方说明提供 LLM 对话式设计指导、模型感知洞察、故障排查与设计验证 | Creo / Creo+ | 3D 与工业仿真 | 基本准确；建议补充 CAD AI/设计助手 | [Creo AI capabilities](https://www.ptc.com/en/products/creo/capabilities); [Creo AI Assistant release](https://www.ptc.com/en/news/2026/ptc-brings-ai-powered-guidance-to-the-design-environment-with-creo-13) |
| 64 | ALLPLAN / ALLPLAN | blocked | 仅找到 ALLPLAN Connect 平台旧资料中的 AI Assistant 描述，无法确认其属于当前 ALLPLAN 产品的可核验 AI 接入或 AI 宿主兼容能力 | ALLPLAN | 3D 与工业仿真 | 准确 | [ALLPLAN Connect document](https://www.allplan.com/fileadmin/user_upload/countries/international/pdfs/legal/Allgemeine_Nutzungsbedingungen_ALLPLAN_Connect-Campus_EN.pdf) |
| 65 | Anytype / Anytype | confirmed | 官方 Anytype API MCP Server；AI assistants 通过 MCP 以自然语言管理 spaces、objects、types 等；官方开发者门户 | Anytype API / Anytype MCP | 文档与知识库 | 准确；建议补充本地优先知识库、MCP、RAG | [Anytype MCP Server](https://developers.anytype.io/docs/examples/featured/mcp/); [Anytype API examples](https://developers.anytype.io/docs/examples/overview/) |

## 收尾结论

1. 65 项已全部覆盖，A/B/C/D 之间没有重复，且没有遗漏或越界 productId。
2. 全部 65 项合计：`confirmed` 34 项，`blocked` 31 项；其中 confirmed 只代表存在符合本轮严格口径的一手 AI 证据，不代表已经写入目录或发布。
3. Airtable、Anytype 是清晰的官方 MCP 接入；PTC Creo 是清晰的内置 AI 宿主。AnyDesk 和 ALLPLAN 暂不确认。
4. Batch A–D 的研究结果仍是候选/证据审计，不改变共享目录。后续如需 CRUD，应另行建立证据字段和产品关系审核流程。
