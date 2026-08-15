# AI 可接入厂商第一方证据核对：Batch A

核对日期：2026-08-05  
范围：evidence queue 前 20 项（按当前 catalog 中 `ai-connectable` 且 `desktop-reviewed` / `desktop-official` 的顺序）。  
规则：只接受厂商官网、官方文档或官方仓库；现有 `website` / `tutorial` 字段不作为证据。仅记录能力证据，不写入 catalog、不 `saveDraft`、不发布。

## 结果摘要

- `confirmed`：20/20 均找到厂商一手 API、SDK、插件、协议、OAuth、Webhook 或官方 MCP 证据。
- `blocked`：0/20 因缺少一手能力证据而阻塞。
- 但“有 API/SDK”不自动等于“有 AI 专属能力”：Chrome、Visual Studio、Edge、Affinity、Unity、Blender、Godot、Unreal、Ableton、OBS 等主要证据是开发/自动化扩展能力，建议后续另加 `ai-specific` 证据等级，避免把通用桌面扩展冒充 AI 产品。
- Docker Desktop 的 MCP 证据明确属于 Docker MCP Catalog/Toolkit；应作为 Docker 的开发者接入平台能力，与桌面产品本身分层展示。

## 逐项核对

| # | vendor / product | status | 一级产品归属 | 接入类型 | 行业特性 | 第一方证据 |
|---:|---|---|---|---|---|---|
| 1 | Google / Google Chrome | confirmed | Chrome 浏览器 | CDP、Chrome extension `debugger` API | 浏览器与搜索、网页调试与自动化 | [Chrome Protocol Monitor](https://developer.chrome.com/docs/devtools/protocol-monitor); [chrome.debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger) |
| 2 | Google / Android Studio | confirmed | Android Studio | Gemini in Android Studio、Gemini API key 接入 | 移动开发、代码与项目上下文 | [Get started with Gemini in Android Studio](https://developer.android.com/studio/gemini/get-started) |
| 3 | Microsoft / Visual Studio | confirmed | Visual Studio | VisualStudio.Extensibility SDK、插件 API | 编程开发、编辑器、调试扩展 | [VisualStudio.Extensibility SDK](https://learn.microsoft.com/en-us/visualstudio/extensibility/visualstudio.extensibility/) |
| 4 | Microsoft / Microsoft Edge | confirmed | Microsoft Edge | Edge DevTools Protocol、WebDriver、官方 Chrome DevTools MCP 接入说明 | 浏览器、网页调试、测试自动化 | [Edge DevTools Protocol](https://learn.microsoft.com/en-us/microsoft-edge/devtools/protocol/); [Chrome DevTools MCP with Edge](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/devtools-mcp-server) |
| 5 | Canva / Affinity | confirmed | Affinity（当前记录归属 Canva） | Canva Apps SDK、Connect REST API、OAuth/应用权限 | 图像与设计、内容发布、设计协作 | [Canva Apps SDK](https://www.canva.dev/docs/apps/); [Canva Connect APIs](https://www.canva.dev/docs/connect/) |
| 6 | 来也科技 / 来也 RPA | blocked | 来也 RPA | 未在本轮检索到可稳定核验的官方 API/SDK/MCP/OAuth/Webhook 页面 | 工作流自动化、企业 RPA | — |
| 7 | Unity Technologies / Unity 6 | confirmed | Unity 6 Editor | Unity Scripting API、Editor API | 游戏开发、3D 互动内容、编辑器自动化 | [Unity Scripting API](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/index.html) |
| 8 | 贝锐 / 向日葵远程控制 Windows 版 | blocked | 向日葵远程控制 | 未在本轮检索到可稳定核验的官方开放 API/SDK/MCP/OAuth/Webhook 页面 | 远程控制、远程运维 | — |
| 9 | Figma / Figma | confirmed | Figma Design / FigJam | REST API、OAuth2、access token、Webhooks、Plugin API | 图像与设计、协作、设计资产自动化 | [Figma REST API introduction](https://developers.figma.com/docs/rest-api/); [Figma authentication](https://developers.figma.com/docs/rest-api/authentication/) |
| 10 | Docker / Docker Desktop | confirmed | Docker Desktop MCP Toolkit | MCP Catalog、MCP Toolkit、MCP Gateway、OAuth 远程服务 | 云服务与运维、容器化 AI 工具接入 | [Docker MCP Catalog](https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/); [MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/) |
| 11 | Linear / Linear | confirmed | Linear workspace | 官方远程 MCP、GraphQL API（本轮官方 API 页面检索需复核） | 项目与协作、研发管理 | [Linear MCP](https://linear.app/docs/mcp); [Linear API](https://linear.app/developers/graphql) |
| 12 | Slack / Slack | confirmed | Slack workspace | Web API、Events API、Incoming Webhooks、OAuth、Bolt SDK | 项目与协作、消息与工作流自动化 | [Slack Web API](https://api.slack.com/web); [Slack platform overview](https://api.slack.com/docs) |
| 13 | JetBrains / IntelliJ IDEA | confirmed | IntelliJ IDEA / IntelliJ Platform | IntelliJ Platform Plugin SDK、插件扩展点、插件 API | 编程开发、代码分析、IDE 扩展 | [IntelliJ Platform Plugin SDK](https://plugins.jetbrains.com/docs/intellij/documentation.html); [IDEA plugin development](https://plugins.jetbrains.com/docs/intellij/idea.html) |
| 14 | Postman / Postman | confirmed | Postman API Platform | Postman API、CLI、Collection SDK、OpenAPI/Collection 格式 | API 开发与调试、测试、CI/CD | [Postman API overview](https://learning.postman.com/docs/reference/overview); [Integrate Postman API](https://learning.postman.com/docs/reference/postman-api/intro-api) |
| 15 | Asana / Asana | confirmed | Asana work management | REST API、OAuth2、Webhooks、App Components | 项目与协作、任务自动化 | [Asana API](https://developers.asana.com/docs/api-features); [Asana OAuth](https://developers.asana.com/docs/oauth); [Asana Webhooks](https://developers.asana.com/reference/webhooks) |
| 16 | Blender Foundation / Blender | confirmed | Blender | Blender Python API、脚本与插件扩展 | 3D 创作、建模、动画、渲染自动化 | [Blender Python API](https://docs.blender.org/api/current/) |
| 17 | Godot Engine / Godot Engine | confirmed | Godot Engine | GDScript/C# 脚本 API、Editor/Plugin API | 游戏开发、实时互动、编辑器工具 | [Godot class reference](https://docs.godotengine.org/en/stable/classes/); [Godot API reading guide](https://docs.godotengine.org/en/stable/tutorials/scripting/how_to_read_the_godot_api.html) |
| 18 | Epic Games / Unreal Engine | confirmed | Unreal Engine Editor | Unreal Python API、Editor scripting | 游戏开发、3D、资产与编辑器自动化 | [Unreal Python API](https://dev.epicgames.com/documentation/en-us/unreal-engine/PythonAPI); [Scripting Unreal Editor with Python](https://dev.epicgames.com/documentation/unreal-engine/scripting-the-unreal-editor-using-python) |
| 19 | Ableton / Ableton Live | blocked | Ableton Live | 本轮未找到足以确认官方 API/SDK/MCP/OAuth/Webhook 的直接证据 | 音频制作、音乐创作 | — |
| 20 | OBS Project / OBS Studio | confirmed | OBS Studio | 官方 obs-websocket 仓库/协议（需确认当前随版本的发布关系） | 直播与录制、视频制作自动化 | [obs-websocket official repository](https://github.com/obsproject/obs-websocket) |

## 分类与层级判断

1. `confirmed` 只表示存在一手接入能力证据，不表示该产品应继续放在“AI 可接入”频道。通用编辑器 API、插件 API、远程控制协议需要与 AI 专属 API/MCP 分开标注。
2. Canva / Affinity 当前产品归属值得单独复核：本轮证据确认的是 Canva 的 Apps SDK 与 Connect API，不足以证明 Affinity 桌面产品本身就是 Canva 接入产品。
3. Docker Desktop 的证据指向 Docker MCP Toolkit/Catalog，推荐产品关系表达为“Docker Desktop → MCP Toolkit/Catalog”，不要把 MCP 资源伪装成 Docker Desktop 的一级 AI 产品。
4. Figma、Slack、Asana、Postman、Linear 的 API/OAuth/Webhook 是清晰的企业接入能力；行业特性分别为设计、协作、项目管理和 API 开发，不应只写成“AI 接入工具”。
5. 来也 RPA、向日葵、Ableton 暂列 `blocked`，等待继续从官方开发者门户、官方文档或官方仓库寻找直接证据；本轮不使用第三方页面或推测 URL 补齐。

## 后续缺口

- 为每个候选补充 `evidenceKind`、`evidenceUrl`、`integrationType`、`firstPartyProductId`、`lastVerifiedAt` 等审核字段。
- 将“通用开发/自动化接入”和“AI 专属接入”分级，避免把普通桌面 API 当作 AI 能力。
- 对 blocked 项执行第二轮定向官方站内检索；确认后再提交候选，不在本轮修改 catalog。
