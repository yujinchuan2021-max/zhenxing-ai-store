# MCP + Connector 小批次候选（active7）

## 边界

- `candidateOnly=true`，`publishable=false`。
- 只新增候选资料与聚焦测试；未改活动目录、state、schema、App、保存、签名、发布、封包或服务端。
- 所有 target 都是 CompatibleHost 的 `resource-link` + `website`；没有受管安装，也没有任何层级的 `endpoint`、`command`、`args`、`env`、`headers`、`credentials`、`token`、`apiKey`、`install`、`runtime`、脚本或 shell 字段。
- `credentialPolicy=never-collect`：枕星 AI 不接收 OAuth token、API key、账号或密码，也不冒充连接成功。

## 去重基线

活动基线是 `catalog-v00000007-8c49e1972186-0cec5335`。候选 ID 已同时对活动资源和以下冻结队列做 exact ID 去重：

- `docs/research/mcp-candidate-index-draft89-active6-2026-08-07.json`
- `docs/research/mcp-needs-review-batch-2026-08-05.json`
- `docs/connector-candidate-index-gap-report-2026-08-07.md`

## Ready 1：Lovable MCP

- ID：`lovable-official-mcp`
- 类型：MCP；官方；`resource-link`。
- 一方仓库固定 revision：`0336e6db8026b0f02cb89d1451cc48ea3f469791`。
- 固定 `server.json` 声明版本 `0.1.3`、远程 Streamable HTTP 服务与官方仓库；仓库许可证为 Apache-2.0。[固定 server.json](https://github.com/lovablelabs/mcp/blob/0336e6db8026b0f02cb89d1451cc48ea3f469791/server.json) [固定许可证](https://github.com/lovablelabs/mcp/blob/0336e6db8026b0f02cb89d1451cc48ea3f469791/LICENSE)
- 官方文档列出 ChatGPT、Claude Desktop、Claude Code、Cursor 和 VS Code，并说明 OAuth 是唯一认证方式；权限覆盖用户完整 Lovable 账号，调用会真实修改项目、消耗额度、部署应用或运行数据库 SQL。[Lovable MCP 官方文档](https://docs.lovable.dev/integrations/lovable-mcp-server)
- 因远程服务仍滚动运行且权限面高，本候选不升级为 `mcp-managed`；固定 revision 只冻结证据与目录描述，不声称冻结线上服务字节。

## Ready 2：Lucid for Claude

- ID：`lucid-claude-connector`
- 类型：Connector；官方；`resource-link`。
- Lucid 官方产品页明确提供 Claude 快速连接，能力包括查找、总结、分享文档和生成图表。[Lucid MCP 官方产品页](https://lucid.co/mcp-server)
- Lucid Help Center 说明官方连接通过 OAuth 授权，可访问用户有权限的文档，并可创建、编辑、删除、分享内容；凭据由 Lucid 处理。该页在 2026-08-06 更新。[Lucid MCP 官方帮助](https://help.lucid.co/hc/en-us/articles/42578801807508-Integrate-Lucid-with-AI-tools-using-the-Lucid-MCP-server)
- 本候选只打开 [Lucid 连接 Claude 的官方教程](https://help.lucid.co/hc/en-us/articles/47850709372180-Connect-Lucid-to-Claude)，不保存授权状态、不代替 OAuth、不宣称已连接。
- 上述 Lucid 一手教程与 MCP 帮助页均未给出可复核的用户侧 disconnect/revoke/remove 步骤，因此本候选不声明断开或撤销能力；该生命周期能力等待一手证据后再审。
- 这是滚动服务，许可证记为 `service-terms`，不虚构源码许可证或固定发行物。

## Deferred

1. **Lovable Claude plugin**：官方 MCP 文档提到插件，但它与本批 MCP 共用能力面；没有独立固定插件发行与许可证证据，不复制成第二资源。
2. **Lucid for Codex**：官方入口存在，但本批只闭合 Claude 的独立教程；等待 Codex 专页与断开路径达到同等证据强度。
3. 其他 MCP、Connector、Plugin 不为凑数扩面；历史队列里的项目继续沿用原阻断理由。

## TDD 与验收

公共 seam：活动去重 → 每层 exact candidate schema → 递归 executable/credential forbidden-key 扫描 → CompatibleHost target 校验 → `shared/catalog.cjs#validateCatalog` → 剥离新增资源后与 active7 exact 相等 → 固定 link-only/never-collect 安全边界。

- 审计修复 RED：专属测试加入 Lucid 保守断开声明后为 `0/1`，精确失败于原候选过宽的“Claude 断开 + Lucid 管理界面撤销”声明。
- GREEN：`node --test --test-reporter=spec tests/mcp-connector-small-batch-active7-candidate.test.cjs`，专属候选测试仅按实际记为 `1/1`；相关资源合同测试单列，不合并冒充专属测试数量。

冻结输入 SHA-256（后续任何字节变化都必须重新审计）：

- candidate：`ee151bc52a47f42b96d113be26652247ec1dd257178a3706799efd18463715cd`
- focused test：`e2e702718cd32f4503b9f4963a06d09a0c0c95973edebbd3ae11effdba7c08c4`

## 冻结结论

- Ready：2（MCP 1，Connector 1，Plugin 0）。
- Deferred：2。
- 这是一份可复核候选，不是发布授权；正式目录消费前仍需 CTO 审计与单独发布流程。
