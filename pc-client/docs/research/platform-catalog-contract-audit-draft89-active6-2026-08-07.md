# Windows/macOS/Linux 资源目录平台合同审计（draft89 / v2 active6）

## 结论

当前目录可以继续作为跨平台合同的事实源，但尚未具备平台过滤所需的最小结构化字段。产品、资源和 target 都没有平台、架构、运行形态或平台证据时间字段；不能据 desktop 标题、Electron、网页、通用 Python 包或 `requirements` 推断原生 Windows/macOS/Linux 支持。

官网只应展示 Windows、macOS、Linux 三张客户端卡。客户端安装后，再按用户请求平台与资源×宿主交集展示资源；未知/blocked 必须隐藏或显示不支持，不能回退执行。

## 当前基线与 shape 扫描

- draft89 与 v2 active6 均为 375 厂商、615 产品；146 顶层资源、513 resource targets。
- 四资源商店固定为 Skill、MCP、Plugin、Connector；资源数分别为 16、123、8、3。
- 产品类型：desktop-reviewed 37、desktop-official 161、desktop-download-only 66（共 264 桌面卡）；CLI/Agent 48；web 247、tutorial 55、local-model 1。
- 现有 `officialDownload`：download-page 130、login-required 18、stable-redirect 4、store 1、no-windows 1、manual-selector 3、vendor-bootstrap 5。
- 139 个产品有非空 installProfileId；资源 target 模块为 resource-link 505、mcp-managed 6、skill-managed 1、plugin-managed 1。
- 结构化平台字段：产品 0、资源 0、target 0。`resource.lastVerifiedAt` 只是资源来源核验时间，不是平台支持证据时间。26 个产品有 `requirements`，但这些是 node/git/python/docker/wsl 等环境标签，不等于原生平台支持。

## 最小可扩展合同（候选，不应用）

平台 canonical ID 固定为 `windows|macos|linux`；运行形态单独表达：`native|wsl|container|browser|remote`。每个产品或资源的支持记录至少包含：

```text
platform: windows|macos|linux
architectures: x64|arm64|x86|universal|unknown[]
runtime: native|wsl|container|browser|remote
status: supported|unsupported|unknown|blocked
evidence: [{ url: first-party-or-approved-channel, observedAt: ISO-8601 }]
```

空架构表示未知，不表示 universal；没有一手证据的记录保持 unknown/blocked。Web、WSL、Docker、浏览器扩展和远程服务不能冒充 native 支持。

target 不复制资源，也不直接存每个 OS 的派生可用性。投影函数计算：`availability = resourceSupport ∩ hostProductSupport ∩ requestedPlatform`，再叠加 target compatibility 和固定 module/profile。Agent Capability Broker 必须消费同一交集；当前 broker 只检查 hostProductId/installProfileId，尚未接收平台输入。

## 生命周期边界

Windows fixed profile/managed action 不得自动扩展到 macOS/Linux。每个平台都要独立审核固定 profile、artifact、install/update/repair/uninstall、receipt 与数据保留边界。未知平台不得回退到执行；没有交集时隐藏或明确显示不支持。

## 后续批次估算

1. 机械 shape 批：615 产品、146 资源、513 targets，只补结构校验，不得作平台结论。
2. 一手产品批：264 桌面卡 + 48 CLI/Agent，约 3 批，每批 100–110 项，分别核验原生 OS、架构、runtime、生命周期。
3. 资源/宿主批：146 资源和 513 targets，分资源来源与 host×platform 交集两批处理。
4. profile 批：139 产品 profiles 与 8 个 managed resource targets，逐个平台独立审核 receipt/lifecycle。

当前不能安全统计“Windows-only”或“远程跨平台”：264 桌面卡只是 Windows-oriented UI 记录；505 个 resource-link targets 只是外部入口记录，均不是平台支持证据。

## 交接与不变项

后台负责 additive schema/validation；前端负责三客户端卡与平台过滤投影；桌面管理负责 macOS/Linux profile/artifact/lifecycle；Agent Capability Broker 负责交集门禁；目录研究负责一手证据和去重。保持现有 21 个 canonical/scenario 标签及四资源商店语义，不复制资源，不改变分类。

本轮仅写本报告与 JSON，未修改 catalog/state/schema/client，未 saveDraft、publish、package、upload、下载或安装。完整字段扫描和数量基线见同名 JSON。
