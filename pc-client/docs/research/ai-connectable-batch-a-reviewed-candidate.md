# AI 可接入 Batch A：严格一手证据复核

日期：2026-08-05  
事实源：authoritative draft revision 84（615 产品）及 Batch A 已列出的第一方 URL。  
边界：未调用 saveDraft，未发布；未新增厂商、产品、资源、URL、安装 profile 或执行能力。

## 判定规则

仅在第一方材料直接说明 AI 接入能力或 AI 宿主兼容时保留。通用 API、普通插件/脚本、自动化接口、远程控制协议本身不构成 AI 可接入证据。

| 结论 | 数量 |
|---|---:|
| accepted | 4 |
| rejected | 13 |
| needs-more-evidence | 3 |

## Accepted：最小目录候选

| productId | 保留依据 | 一手证据 |
|---|---|---|
| google-android-studio | Android Studio 中的 Gemini Agent / Gemini API key 接入 | https://developer.android.com/studio/gemini/get-started |
| microsoft-edge-ai | Edge DevTools MCP 明确向 AI coding assistants 提供 Edge/WebView2 访问能力 | https://learn.microsoft.com/en-us/microsoft-edge/web-platform/devtools-mcp-server |
| docker-desktop | Docker Desktop MCP Toolkit 明确将 MCP clients（如 Claude Desktop）连接到 MCP servers | https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/ |
| linear-workspace | Linear MCP 明确让兼容 AI models/agents 访问 Linear 数据 | https://linear.app/docs/mcp |

CTO 决定：这四项在 draft84 已保持 `directoryKind=ai-connectable`，本批为 no-op；不新增 `featureTags` 或 `officialEvidence`。现有 `product.category` 是后台“工具特性”字段并驱动目录筛选；上述一手证据仅保留在本研究/入库审核资料，不进入发布目录。不得 saveDraft 或发布。

## Rejected：只有通用开发/自动化接口

google-chrome-devtools、microsoft-visual-studio、affinity、unity-editor、figma-design、slack-workspace、jetbrains-intellij-idea、postman-api-platform、asana-work-graph、blender、godot-engine、unreal-engine、obs-studio。

原因分别为 CDP/debugger、扩展 SDK、Canva 平台但非 Affinity、脚本/编辑器 API、REST/OAuth、Web API、插件 SDK、API/CLI/SDK、REST/OAuth/Webhooks、Python API、脚本/插件 API、Editor Python、WebSocket 远程控制；这些均未直接证明该目录产品是 AI 接入对象。

## Needs more evidence

laiye-rpa、sunlogin-windows、ableton-live：Batch A 未提供可验证的一手能力 URL；本轮既不能接受，也不根据缺页推定为永久 rejected。
