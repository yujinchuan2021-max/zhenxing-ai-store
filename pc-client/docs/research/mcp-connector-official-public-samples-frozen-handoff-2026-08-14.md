# MCP / Connector 官方公共样本 candidate-only frozen handoff

## 冻结结论

- 输入严格限定为 [`mcp-connector-official-public-samples-2026-08-14.md`](./mcp-connector-official-public-samples-2026-08-14.md) 的 15 条样本；没有联网扩证或扩大来源。
- `proposedResources=[]`。没有任何条目同时满足一手作者身份、许可、认证、写副作用与 active7/历史 canonical 去重闭环；不为数量制造 link-only 卡片。
- exact review ledger：`observed=15`、`duplicate=1`、`deferred=1`、`blocked=12`、`rejected=1`，15 个 canonical key 唯一。
- active7 exact baseline：`catalog-v00000007-8c49e1972186-0cec5335`，SHA-256 `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4`。
- ToolHive/Docker 的 `Official`/tier 只保留为 discovery provenance；没有升级为作者官方身份。没有 managed profile，也没有 `endpoint`、`command`、`args`、`env`、`headers`、`credentials` 或执行字段。

## Canonical 决策

- ToolHive `atlassian-remote` 与 active7 `atlassian-rovo-mcp-server` 是同一 publisher/product/rolling remote service：`duplicate`，不新建 Resource。
- Docker `airtable-mcp-server` 是第三方 local API-key implementation；active7 同名资源是 Airtable 官方 remote OAuth implementation：`implementation-conflict`，不得合并或覆盖。
- Docker SQLite 明示 Archived 且来自 reference servers：`rejected`。
- AIS Fleet 只有 unversioned SSE、dynamic tools，缺 repo/license/auth/privacy：`deferred`。
- 其余 12 条因 license/auth/version mapping/network/credential/write or external side-effect 未闭合而 `blocked`。

## RED / GREEN

- Dedicated RED：`0/1`，candidate JSON 缺失，精确 `ENOENT`。
- Dedicated GREEN：`1/1`。
- Related MCP candidate tests：`3/3`（现有 small batch、official small batch 2、本批）。
- `node --check`：PASS。
- JSON parse / exact count：15 ledger、15 unique canonical keys、0 proposed，PASS。
- `git diff --no-index --check`：PASS；仅报告 Windows 后续 LF→CRLF 提示，无 whitespace error。

## Frozen SHA-256

任何后续字节变化都需要重新测试与审计：

- `c4a0d25287f6134407656b4cb64ecd2587b7f634af02a3c01a8cf2787d42fb1b`  `docs/research/mcp-connector-official-public-samples-2026-08-14.md`
- `4b06a2720d64ecfe44bef448bf3248356348849cd246ea46dd1f8482f8a58bb0`  `docs/research/mcp-connector-official-public-samples-candidate-active7-2026-08-14.json`
- `5fc436a25219773e4a13918be6d4a95bbcc6739c97c8cb637d2e988c55a3ecea`  `tests/mcp-connector-official-public-samples-active7-candidate.test.cjs`

## 边界

Candidate-only、freeze-only、not publishable。未改 active catalog/state/channel/release/App/schema/package/server，未保存 draft、签名、发布、封包、下载或执行任何 MCP server。独立 CTO 只读审计之前不得消费本 candidate。
