# AI 可接入厂商第一方证据核对：Batch B

核对日期：2026-08-05  
范围：65 项 evidence queue 中 Batch A 之后的第 21–40 项。  
严格口径：只有官方材料明确说明 AI 接入、AI 宿主兼容、官方 MCP、AI API 或 AI 专用能力才记为 `confirmed`。普通 API、普通插件、脚本或自动化接口不作 AI 接入推断。本轮不改 catalog、不改 state、不 `saveDraft`、不发布。

## 结果摘要

- `confirmed`：7 项
- `blocked`：13 项
- 主要确认项：UiPath Studio、Adobe Creative Cloud、monday、MongoDB Compass、Roblox Studio、Miro、MATLAB。
- Autodesk、Trimble、Blackmagic、ClickUp、Box、Zoom、Wolfram、Ansys 等本轮只看到通用开发/自动化/产品 API，按规则阻塞。

## 逐项结果

| # | vendor / product | status | 官方证据与接入类型 | 对应一级产品 | 现有 category | category 判断 | 官方 URL |
|---:|---|---|---|---|---|---|---|
| 21 | UiPath / UiPath Studio | confirmed | Autopilot；自然语言生成/编辑 API workflows；AI 生成代码 | UiPath Studio / Studio Web | 工作流自动化 | 准确；建议增加“AI 自动化开发”能力标签 | [Autopilot and API workflows](https://docs.uipath.com/studio-web/automation-cloud/latest/user-guide/autopilot-and-api-workflows); [Generating code with Autopilot](https://docs.uipath.com/studio/standalone/latest/user-guide/generating-code) |
| 22 | Adobe / Adobe Creative Cloud | confirmed | Firefly Services Generative AI API；图像、视频、音频、内容标记与 Creative Cloud API；Adobe AI Registry | Adobe Creative Cloud / Firefly Services | 图像与设计 | 基本准确；建议补充视频、音频与生成式内容 | [Firefly API](https://developer.adobe.com/firefly-services/docs/firefly-api/); [Firefly Services guides](https://developer.adobe.com/firefly-services/docs/guides/); [Adobe developer APIs](https://developer.adobe.com/apis) |
| 23 | Adobe / Adobe Acrobat Reader | blocked | 官方材料可证明 Acrobat 内置 AI Assistant，但本轮未找到“外部 AI 接入 Acrobat Reader”的明确 API/MCP/OAuth/宿主兼容证据 | Adobe Acrobat / Document Cloud | 文档与知识库 | 分类准确；AI Assistant 不能替代外部接入证据 | [Adobe Acrobat AI Assistant overview](https://www.adobe.com/acrobat/generative-ai-pdf.html) |
| 24 | Autodesk / Autodesk Fusion | blocked | 找到 Autodesk Automation API，可云端执行 Fusion 脚本；属于通用 CAD 自动化，未证明 AI 接入 | Autodesk Fusion | 3D 创作 | 准确，但不应以此证据确认 AI 接入 | [Autodesk Automation APIs](https://aps.autodesk.com/automation-apis) |
| 25 | Autodesk / AutoCAD | blocked | 找到 AutoCAD Automation API、脚本与 AutoLISP；没有明确 AI 接入/AI 宿主兼容证据 | Autodesk AutoCAD | 3D 与工业仿真 | 准确；通用自动化不满足本批口径 | [AutoCAD Automation API](https://aps.autodesk.com/automation-apis) |
| 26 | Autodesk / Revit | blocked | 找到 Revit Automation API 与 Revit DB API；没有明确 AI 接入证据 | Autodesk Revit | 3D 与工业仿真 | 准确；通用自动化不满足本批口径 | [Revit Automation API](https://aps.autodesk.com/automation-apis) |
| 27 | Trimble / SketchUp 2026 | blocked | 本轮未找到明确 AI API/MCP/AI 宿主兼容的一手证据 | SketchUp | 3D 创作 | 准确 | — |
| 28 | Trimble / Tekla Structures | blocked | 本轮未找到明确 AI API/MCP/AI 宿主兼容的一手证据 | Tekla Structures | 3D 与工业仿真 | 准确 | — |
| 29 | Blackmagic Design / DaVinci Resolve | blocked | 本轮未找到明确 AI 接入 API/MCP/AI 宿主兼容证据；普通脚本能力不能推断 | DaVinci Resolve | 视频创作 | 准确 | — |
| 30 | monday.com / monday | confirmed | 官方 Platform MCP；OAuth 2.1；官方 OpenAI-compatible Models API；可接入外部 AI agents；GraphQL 与 Webhook | monday work management / CRM / dev / service | 项目与协作 | 准确；应补充 AI 工作平台、MCP、OpenAI-compatible | [Build with AI](https://developer.monday.com/api-reference/docs/build-on-monday-with-ai); [Models API](https://developer.monday.com/api-reference/docs/getting-started-with-the-models-api) |
| 31 | MongoDB / MongoDB Compass | confirmed | 官方 MongoDB MCP Server；AI clients 兼容；自然语言查询/管理数据库与 Atlas；官方 AI integrations | MongoDB / Atlas | 数据库与数据 | 准确；建议补充数据库 AI/MCP、向量检索 | [MongoDB MCP Server](https://www.mongodb.com/docs/mcp-server/); [AI client compatibility](https://www.mongodb.com/docs/mcp-server/configuration/); [Build with AI](https://www.mongodb.com/docs/build-with-ai/) |
| 32 | Roblox / Roblox Studio | confirmed | Studio 内置 Code Assist、Roblox Assistant/Developer Intelligence；官方 Studio Assistant 可驱动测试 API 和 Skills | Roblox Studio | 游戏开发 | 准确；应补充游戏开发 AI 助手/AI 编程 | [Code Assist full release](https://devforum.roblox.com/t/code-assist-full-release-ai-powered-code-completion/2848978); [Studio Assistant improvements](https://devforum.roblox.com/t/new-studio-testing-apis-and-assistant-improvements/4657854) |
| 33 | Miro / Miro | confirmed | 官方远程 Miro MCP Server；AI agents、OAuth；板面搜索总结、生成图表、创建/更新内容 | Miro boards / collaboration | 项目与协作 | 准确；建议补充白板协作、MCP、AI 总结/生成 | [Miro MCP Server](https://developers.miro.com/docs/miro-mcp); [MCP vs REST API](https://developers.miro.com/docs/mcp-server-vs-rest-api) |
| 34 | MathWorks / MATLAB | confirmed | MATLAB Copilot；桌面内生成式 AI；官方材料说明可连接外部 AI agents | MATLAB | 工程计算与仿真 | 准确；建议增加工程计算 AI Copilot | [MATLAB Copilot](https://www.mathworks.com/help/matlab-copilot/); [What’s New in MATLAB 2026](https://www.mathworks.com/content/dam/mathworks/mathworks-dot-com/company/events/conferences/matlab-expo-india/2026/in-expo-2026-mathworks-whats-new-matlab-simulink.pdf) |
| 35 | MathWorks / Simulink | blocked | MATLAB Copilot 证据明确针对 MATLAB；本轮未找到 Simulink 独立 AI 接入/宿主兼容证据 | Simulink | 工程计算与仿真 | 准确；不得从 MATLAB 证据外推到 Simulink | [MATLAB Copilot](https://www.mathworks.com/help/matlab-copilot/) |
| 36 | ClickUp / ClickUp | blocked | 本轮未找到可确认的官方 AI API/MCP/AI 宿主兼容证据；普通 API 不足 | ClickUp | 项目与协作 | 准确 | — |
| 37 | Box / Box | blocked | 本轮未找到明确 AI 接入 API/MCP/AI 宿主兼容证据；普通内容 API 不足 | Box Content Cloud | 文档与知识库 | 准确 | — |
| 38 | Zoom / Zoom Workplace | blocked | 本轮未找到明确 AI 接入 API/MCP/AI 宿主兼容证据；普通会议/SDK API 不足 | Zoom Workplace | 项目与协作 | 基本准确；AI Companion 需要独立一手接入证据 |
| 39 | Wolfram Research / Wolfram Mathematica | blocked | 本轮未找到明确 AI 接入或 AI 宿主兼容证据；普通 Wolfram API 不足 | Mathematica | 工程计算与仿真 | 准确 | — |
| 40 | Ansys / Ansys Lumerical | blocked | 本轮未找到明确 AI 接入 API/MCP/AI 宿主兼容证据；普通仿真自动化不足 | Ansys Lumerical | 工程计算与仿真 | 准确 | — |

## 关键边界结论

1. Adobe Creative Cloud 的 confirmed 依据是 Firefly Services/Adobe AI Registry，而不是 Creative Cloud 桌面客户端的一般插件能力；产品关系需要表达为“Creative Cloud → Firefly Services/AI Registry”。
2. monday、MongoDB、Miro 是本批最清晰的 AI 接入型产品：官方明确给出 MCP、AI agent、OAuth 或 OpenAI-compatible 入口。
3. Roblox Studio 和 MATLAB 是 AI 宿主内置型证据：官方 AI 助手直接属于 Studio/MATLAB 一级产品，但不应因此推导出对外 API，接入类型应写“内置 AI 宿主/AI Copilot”。
4. Autodesk 的 Automation API、普通 CAD SDK、普通插件和脚本只证明自动化，不满足本批“明确 AI 接入”标准。
5. blocked 不代表产品没有 AI 功能，只代表当前证据队列未取得符合严格口径的第一方接入证据。

## 后续缺口

- 为“内置 AI 宿主”“外部 MCP”“OpenAI-compatible API”“生成式 AI API”建立不同 `integrationType`，不要合并成“AI 接入工具”。
- Adobe Acrobat Reader、Simulink、Zoom、ClickUp、Box、Wolfram、Ansys 需要继续做官方开发者门户定向核对。
- Autodesk、Trimble、DaVinci Resolve 的通用自动化记录应保留为候选，但不得在接入频道以 AI 接入证据确认。
