# platformSupport 一手证据 Batch 1（draft89 / v2 active6）

状态：`candidate-only=true`、`publishable=false`。本轮只读，不写 catalog/state，不创建 artifact/profile/lifecycle/receipt，不下载或安装制品。

## 选择与规则

从 615 个现有产品中选择 20 个具有明确官方桌面或 CLI/Agent 身份、且对资源宿主/本地 AI 用户有直接价值的代表项。选择理由逐项写入 JSON；不按主观热度排序。仅使用厂商官网、官方文档、官方仓库或官方发布页。Electron、Python/npm/Docker/浏览器存在本身不证明 native 支持。

Adapter 合同固定：

- 平台：`windows|macos|linux`
- 运行形态：`native|wsl|container|browser|remote`
- 状态：`supported|unsupported|unknown|blocked`
- 架构：`x64|arm64|x86|universal|unknown`
- 证据：`kind=first-party`、HTTPS、ISO-8601 `observedAt`

## 汇总

| 项目 | 数量 |
| --- | ---: |
| 选中产品 | 20 |
| platform claims | 61 |
| supported | 54 |
| unknown | 7 |
| unsupported / blocked | 0 |

`unknown` 7 项为 ChatGPT Linux、Comfy Desktop Linux、Gemini CLI 三个平台、OpenCode Windows native 与 macOS；OpenCode Linux 已由官方安装文档补为 native supported。

## 产品批次

| vendor/productId | 平台与运行形态结论 | 后续责任 |
| --- | --- | --- |
| openai/chatgpt-desktop | Windows native supported；macOS native supported；Linux unknown | 仅展示 Windows/macOS；Linux 需证据 |
| anthropic/claude-desktop | Windows/macOS native；Linux native beta（x64/arm64） | 三个平台独立 profile/lifecycle |
| anysphere/cursor-desktop | Windows/macOS/Linux native | 三个平台独立 artifact/profile |
| microsoft/microsoft-vscode | Windows/macOS/Linux native | 各平台独立 artifact/profile |
| zed-industries/zed-editor | Windows/macOS/Linux native | 各平台独立 artifact/profile |
| ollama/ollama-cli | Windows/macOS/Linux native | 本地模型 runtime 与 receipt 独立审核 |
| lmstudio/lm-studio-desktop | Windows/macOS/Linux native；x64/arm64 文档证据 | 每架构独立 artifact/profile |
| docker/docker-desktop | Windows/macOS/Linux native host app | 不把 container runtime 当 native；独立 container profile |
| blender/blender | Windows/macOS/Linux native | 各平台独立 artifact/profile |
| obs-project/obs-studio | Windows/macOS/Linux native | 官方 release asset 逐平台审核 |
| anytype/anytype-desktop | Windows/macOS/Linux native | 各平台独立 artifact/profile与数据边界 |
| jan/jan-desktop | Windows/macOS/Linux native；Windows x64、macOS universal | 模型/连接器生命周期另审 |
| discord/discord-desktop | Windows/macOS/Linux native | 仅桌面支持；API/资源另算 |
| slack/slack-workspace | Windows/macOS/Linux native | MCP 资源保持独立 target |
| comfy/comfy-desktop | Windows native x64；macOS native arm64；Linux unknown | Linux 需官方桌面证据 |
| anthropic/claude-code | Windows WSL；macOS/Linux native | Windows 仅 WSL profile，不得当 native |
| google/gemini-cli | Windows/macOS/Linux unknown | CLI 员工补固定分发与生命周期证据 |
| openai/codex-cli | Windows WSL；macOS/Linux native | WSL 与 native 平台独立 profile |
| openwebui/open-webui | Windows/macOS/Linux container | 仅 container/remote 展示，不能冒充 native |
| anomalyco/opencode | Windows WSL supported；Windows native/macOS native unknown；Linux native supported | Windows/macOS 仍需独立 profile；Linux 仅为平台展示证据 |

每项的精确 evidence URL、observedAt、架构和 selectionReason 位于同名 JSON；所有 productId 均与 draft89 canonical ID 匹配且无重复。

## 不产生安装权限

本候选不把官方下载页、动态 latest、包名或 Release 页面直接升级为 artifact/profile；不写 `moduleId`、`installProfileId`、command、args、env、headers、credentials、script。Windows 现有 profile 不跨平台复用；后续每个平台单独审查 artifact、生命周期和收据数据边界。

## Batch 2 估算

剩余高价值产品/资源预计约 30–40 个产品、146 resources/513 targets 的宿主交集复核：约 80–120 次一手页面/Release/API 请求，不下载制品；约 2–3 个资料研究时段，另加 1 个资源×宿主交集人工复核时段。
