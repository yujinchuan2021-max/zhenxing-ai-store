# MCP resource platformSupport Batch 4（全量收口，draft89 / v2 active6）

状态：`candidate-only=true`、`publishable=false`。本批覆盖排除 Batch 1/2/3 后的全部 23 个 MCP resource；不改 catalog/state/schema/profile，不 saveDraft、publish、package、upload、download 或 install。

## 全量机械核对

权威事实源：`pc-client/admin/published/catalog-store/state.json`，`draft.revision=89`、v2 active release `catalog-v00000006-567e671621f1-3dcee587`。

| 项目 | 结果 |
|---|---:|
| active MCP resources | 123 |
| Batch 1–4 unique resources | 123 |
| 缺失 resourceId | 0 |
| 重复 resourceId | 0 |
| active MCP targets | 472 |
| Batch 1 targets | 97 |
| Batch 2 targets（已修正前批统计漂移） | 200 |
| Batch 3 targets | 126 |
| Batch 4 targets | 49 |
| Batch 1–4 target coverage | 472/472 |
| Batch 1–4 three-platform preview coverage | 1416/1416 |
| 重复/遗漏 target tuple | 0/0 |

Batch 4 的 23 个 resource 分布为 17 official、5 reviewed-community、1 community。全部 23 个均有 canonical HTTPS source；社区项另记录 original repository、author identity 与 license 状态。license 未能从一手仓库明确核验的项保持 blocked，不把社区仓库变成 official。

## Claims 与交集

每个 resource 通过 JSON 的 `claimSetId` 关联 Windows/macOS/Linux 三条 claim；所有平台状态均为 `unknown`、架构为 `unknown`，观察时间为 `2026-08-07T00:00:00.000Z`。runtime 只标记一手入口可辨识的 `native` 或 `remote`；没有明确 WSL、container、browser 证据，不声明这些 runtime。

Batch 4 有 49 个 resource×host tuples，147 个 resource×host×platform 预览组合：`available=0`、`managedEligible=0`。fixed profile platformSupport 为空，故即使 resource/host 未来有 supported claim，也不能直接获得 managed、Agent 或 Workflow 权限。

remote/社区资源继续要求独立的 transport、auth handoff、status、revoke、权限、生命周期和 ownership receipt；社区项目还必须通过固定版本、依赖锁定、Windows 宿主与安全权限审计。当前全部 blocked。

## 社区来源核对

| resourceId | canonical original source / author | license 状态 | 结论 |
|---|---|---|---|
| `blender-mcp` | `ahujasid/blender-mcp` | MIT | reviewed-community，unsafe，blocked；含 Blender 工程写入/Python 高权限边界 |
| `godot-mcp` | `tomyud1/godot-mcp` | MIT | reviewed-community，blocked；社区插件与滚动包边界未锁定 |
| `unreal-mcp` | `GenOrca/unreal-mcp` | Apache-2.0 | reviewed-community，unsafe，blocked；含高影响工程/Python 操作 |
| `ableton-mcp-extended` | `uisato/ableton-mcp-extended` | 未在本轮一手证据中确认 | reviewed-community，blocked；本地 socket/session 写入与可选外部服务 |
| `davinci-resolve-mcp` | `samuelgursky/davinci-resolve-mcp` | 上游仓库记录 MIT | reviewed-community，blocked；版本、依赖、Studio/Windows lifecycle 未形成固定合同 |
| `obs-mcp` | `sbroenne/mcp-server-obs` | MIT | community，blocked；OBS WebSocket 密码必须由用户本地管理 |

聚合发现、GitHub star、第三方评分和下载量不作为 canonical source、作者、license 或安全依据。

## 平台统计与安全门禁

| 对象 | Windows | macOS | Linux |
|---|---:|---:|---:|
| resource claims | 23 | 23 | 23 |
| supported | 0 | 0 | 0 |
| unknown | 23 | 23 | 23 |
| fixed profile claims | 0 | 0 | 0 |

target 仍只保留现有 resourceId/host/module/profile/capability；平台只存在于 candidate projection。JSON 进行了 resourceId 唯一性、前三批重复排除、三平台 claim 完整性、HTTPS evidence/observedAt、target tuple 数量与禁止字段键校验。

## 最终收口结果

- Batch 1–4 覆盖 active 123/123 resources、472/472 targets、1416/1416 三平台 preview；缺失列表与重复列表均为空。
- `acceptedManagedCandidates=[]`、`available=0`、`managedEligible=0`。
- 不新增 adapter、profile、registry 或 schema；不将 remote/community 资源转为 Agent/Workflow 依赖。
- 全量收口后无剩余资源；后续如需平台 supported claim，只能进行单项 first-party refresh 和真实宿主/设备验收，不能由本批 candidate 自动升级。
