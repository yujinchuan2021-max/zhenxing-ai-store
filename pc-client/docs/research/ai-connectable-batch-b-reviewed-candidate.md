# AI 可接入 Batch B：严格一手证据二次复核

日期：2026-08-05  
事实源：authoritative draft revision 84（615 产品）与 Batch B 已列出的第一方材料。  
边界：未调用 saveDraft、未发布，未新增 schema、厂商、产品、资源或执行能力。

## 汇总

| 结论 | 数量 |
|---|---:|
| accepted | 5 |
| rejected | 4 |
| needs-more-evidence | 11 |

## Accepted 与现有目录字段核对

| productId | 直接一手依据 | directoryKind | category | 结果 |
|---|---|---|---|---|
| uipath-studio | Autopilot 以自然语言创建/编辑 API workflows | ai-connectable | 工作流自动化 | 正确，no-op |
| monday-work-management | Platform MCP、AI agents、OpenAI-compatible Models API | ai-connectable | 项目与协作 | 正确，no-op |
| miro-workspace | 官方 remote MCP 面向 AI agents | ai-connectable | 项目与协作 | 正确，no-op |
| matlab | MATLAB Copilot 是 MATLAB 内生成式 AI 能力 | ai-connectable | 工程计算与仿真 | 正确，no-op |
| simulink | 官方材料明确 Simulink Copilot、Agentic Toolkit 与 MCP/外部 AI agent 连接 | ai-connectable | 工程计算与仿真 | 正确，no-op |

一手证据：
- https://docs.uipath.com/studio-web/automation-cloud/latest/user-guide/autopilot-and-api-workflows
- https://developer.monday.com/api-reference/docs/build-on-monday-with-ai
- https://developers.miro.com/docs/miro-mcp
- https://www.mathworks.com/help/matlab-copilot/
- https://www.mathworks.com/content/dam/mathworks/mathworks-dot-com/company/events/conferences/matlab-expo-india/2026/in-expo-2026-mathworks-whats-new-matlab-simulink.pdf

## Rejected

adobe-acrobat-reader-ai：仅内置 AI Assistant，未证实 AI 接入/宿主兼容。  
autodesk-fusion、autodesk-autocad、autodesk-revit：所列 Automation API 均为通用 CAD 自动化，不满足严格定义。

## Needs more evidence

adobe-creative-cloud、mongodb-compass、roblox-studio、sketchup、trimble-tekla-structures、davinci-resolve、clickup-workspace、box-content-cloud、zoom-workplace、wolfram-mathematica、ansys-lumerical。

原因包括证据指向不同产品（Adobe Firefly/Creative Cloud、MongoDB/Atlas 而非 Compass）、所给页无法可验证读取（Roblox），或没有直接的一手 AI 接入/宿主兼容材料。不得按普通 API、插件或自动化能力推定。

结论：所有 accepted 的现有 directoryKind 与 category 均正确，最小 catalog patch 为 no-op。

