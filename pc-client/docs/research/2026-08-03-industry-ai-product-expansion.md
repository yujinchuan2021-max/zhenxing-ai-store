# 行业 AI 产品持续扩充复核

日期：2026-08-03

## 结论

- 本轮在 282 个厂商、470 个一级产品的基线上新增 29 个厂商和 35 个产品，目录达到 311 个厂商、505 个一级产品、118 个顶层生态资源。
- 新增产品中 17 个是官方明确提供 Windows 图形交付的产品，统一使用固定 `desktop-official` 模块；18 个是在线产品，统一使用 `web-link`。本轮没有增加 CLI、安装包直链、哈希、命令、环境探测或本地安装 profile。
- 13 个产品归入 `ai-connectable`，22 个归入 `ai-tool`。同一厂商资料仍只保存一份；Autodesk、Siemens、Trimble 与 Clarivate 均复用既有记录。
- 图形产品的“桌面”按钮只打开厂商维护的官方 Windows 获取页，不自动下载或运行安装器。在线产品直接打开官方产品页。

## 复核方法

1. 候选来自 `2026-08-03-continuous-catalog-expansion-next.md`，再逐项与当前 282/470 目录做产品 ID、产品名和厂商归属去重。
2. 只使用厂商官网、官方帮助中心、官方产品文档或官方 GitHub 组织作为产品身份和交付形态证据。
3. 对最终产品的官网、获取页、教程和卡片入口做去重后的实时 GET 审计；将登录墙、WAF 403 与真正 404 分开处理。
4. 品牌素材与产品资料分开审查。没有确认可用于第三方目录的方形官方素材时保留文字兜底，不使用 favicon、搜索图片、GitHub 头像或相似品牌图标。

## 工程设计与科研分析

| 厂商 / 产品 | 目录与模块 | 主要一手证据 |
| --- | --- | --- |
| Autodesk / AutoCAD | AI 可接入；Windows 官方页 | [AutoCAD](https://www.autodesk.com/products/autocad/overview)、[Autodesk Assistant / Smart Blocks](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-WhatsNew/files/GUID-B4E1E636-E08E-4277-8971-910D47440116.htm) |
| Autodesk / Revit | AI 可接入；Windows 官方页 | [Revit](https://www.autodesk.com/products/revit/overview/)、[Revit Assistant / MCP 说明](https://help.autodesk.com/view/RVT/2027/ENU/?guid=GUID-68D8FE6D-C5B0-4503-AE27-02C715BAC25B) |
| Graphisoft / Archicad | AI 可接入；Windows 官方页 | [官方下载](https://www.graphisoft.com/en-us/downloads/)、[AI Visualizer](https://help.graphisoft.com/AC/28/INT/_AC28_Help/100_Visualization/100_Visualization-10.htm) |
| Vectorworks / Design Suite | AI 可接入；Windows 官方页 | [产品与试用](https://www.vectorworks.net/en-US/products?showModal=trial-form)、[AI Visualizer](https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Rendering2/Generating_AI_images.htm) |
| Octave / Octave BricsCAD | AI 可接入；Windows 官方页 | [当前产品页](https://bricscad.octave.com/bricscad)、[安装帮助](https://help.bricsys.com/en-us/document/bricscad/installation-and-licensing/installing-bricscad) |
| Dassault Systèmes / SOLIDWORKS Design | AI 可接入；Windows 官方页 | [当前产品页](https://www.solidworks.com/product/solidworks-design)、[官方下载](https://www.solidworks.com/support/downloads)、[官方培训](https://my.solidworks.com/training) |
| Siemens / Designcenter NX | AI 可接入；Windows 官方页 | [Designcenter](https://www.siemens.com/en-us/products/designcenter/)、[CAD 获取入口](https://www.siemens.com/en-us/products/designcenter/cad-software/) |
| Trimble / Tekla Structures | AI 可接入；Windows 官方页 | [产品页](https://www.tekla.com/products/tekla-structures)、[官方下载](https://download.trimble.com/tekla-structures/for-businesses)、[学习中心](https://support.tekla.com/tekla-structures/learn) |
| Siemens / Rapidminer AI Studio | AI 工具；Windows 官方页 | [当前 Siemens 产品页](https://www.siemens.com/en-us/products/rapidminer/ai-studio/)、[Altair 已并入 Siemens](https://www.siemens.com/en-us/company/about/businesses/digital-industries/altair/)、[品牌迁移表](https://blogs.sw.siemens.com/simcenter/beyond-a-name-change-your-altair-rebranding-guide/) |
| ilastik / ilastik | AI 工具；Windows 官方页 | [官网](https://www.ilastik.org/)、[下载](https://www.ilastik.org/download) |
| QuPath / QuPath | AI 工具；Windows 官方页 | [官网](https://qupath.github.io/)、[官方 Releases](https://github.com/qupath/qupath/releases) |
| Orange Data Mining / Orange | AI 工具；Windows 官方页 | [官网](https://orangedatamining.com/)、[下载](https://orangedatamining.com/download/) |
| Elsevier / Scopus with AI | AI 工具；Web | [当前产品页](https://www.elsevier.com/products/scopus/scopus-ai)、[快速参考](https://researcheracademy.elsevier.com/uploads/2024-08/Scopus%20AI%20Quick%20Reference%20Guide%20.pdf) |
| Clarivate / Web of Science Research Assistant | AI 工具；Web | [官方产品页](https://clarivate.com/academia-government/scientific-and-academic-research/research-discovery-and-referencing/web-of-science/web-of-science-research-assistant/) |
| SciSpace / Literature Review | AI 工具；Web | [产品入口](https://scispace.com/search)、[官方教程](https://scispace.com/help/en/articles/10660587-how-to-conduct-a-literature-review-using-scispace) |
| scite / scite Assistant | AI 工具；Web | [scite](https://scite.ai/)、[Research Solutions 用户教程](https://help.researchsolutions.com/hc/en-us/articles/31949427606292-Writing-a-paper-with-Scite-AI) |

## 法律与客户服务

| 厂商 / 产品 | 目录与模块 | 主要一手证据 |
| --- | --- | --- |
| Thomson Reuters / CoCounsel Legal | AI 工具；Web | [CoCounsel Legal](https://legal.thomsonreuters.com/en/products/cocounsel-legal)、[入门帮助](https://www.thomsonreuters.com/en-us/help/cocounsel/legal/get-started/about) |
| LexisNexis / Lexis+ with Protégé | AI 工具；Web | [当前产品页](https://www.lexisnexis.com/en-us/products/lexis-plus-protege.page)、[官方培训](https://www.lexisnexis.com/en-us/training/default.page) |
| Harvey / Harvey | AI 工具；Web | [Harvey Platform](https://www.harvey.ai/platform)、[入门帮助](https://help.harvey.ai/articles/getting-started-with-harvey) |
| Spellbook / Spellbook | AI 工具；Word 加载项 | [官网](https://spellbook.com/)、[官方安装说明](https://help.spellbook.legal/en/articles/9079381-how-to-install-spellbook-in-microsoft-word) |
| vLex / Vincent AI | AI 工具；Web | [当前产品页](https://vlex.com/vincent-ai?hsLang=en)、[官方知识库](https://knowledge.vlex.com/en/vincent-ai) |
| Relativity / aiR for Review | AI 工具；Web | [官方产品页](https://www.relativity.com/data-solutions/air/review/)、[产品文档](https://help.relativity.com/RelativityOne/Content/Relativity/aiR_for_Review/aiR_for_Review.htm) |
| Zendesk / Copilot | AI 工具；Web | [Zendesk Copilot](https://www.zendesk.com/service/ai/copilot/)、[官方帮助](https://support.zendesk.com/hc/en-us/articles/7908817636378-About-agent-copilot) |
| Freshworks / Freddy AI Copilot | AI 工具；Web | [Freddy AI for CX](https://www.freshworks.com/freshdesk/freddy-ai-for-cx/helpdesk/)、[官方使用说明](https://support.freshdesk.com/support/solutions/articles/50000010359-overview-of-freddy-ai-for-ticketing) |
| Genesys / Genesys Cloud CX | AI 可接入；Windows 官方页 | [Genesys Cloud](https://www.genesys.com/genesys-cloud)、[Windows 桌面应用](https://help.genesys.cloud/articles/desktop-app/)、[开发者平台](https://developer.genesys.cloud/) |
| Gong / Revenue AI OS | AI 工具；Web | [Gong Platform](https://www.gong.io/platform)、[官方帮助](https://help.gong.io/docs/getting-started-welcome-to-gong) |
| Dialpad / Dialpad | AI 可接入；Windows 官方页 | [官方下载](https://www.dialpad.com/download/)、[桌面要求](https://help.dialpad.com/v1/docs/en/dialpad-app-requirements) |

## 音视频与商业数据

| 厂商 / 产品 | 目录与模块 | 主要一手证据 |
| --- | --- | --- |
| Audacity / Audacity | AI 可接入；Windows 官方页 | [Windows 下载](https://www.audacityteam.org/download/windows/)、[OpenVINO AI 插件](https://www.audacityteam.org/download/openvino/) |
| Streamlabs / Streamlabs Desktop | AI 可接入；Windows 官方页 | [Streamlabs Desktop](https://streamlabs.com/desktop)、[Game Pulse](https://support.streamlabs.com/hc/en-us/articles/47097311788443-Introducing-the-Game-Pulse-Widget-by-Streamlabs) |
| Riverside / AI Video Editor | AI 工具；Web | [AI Video Editor](https://riverside.com/tools/ai-video-editor)、[编辑器](https://riverside.com/video-editor) |
| OpusClip / OpusClip | AI 工具；Web | [官网](https://www.opus.pro/)、[官方帮助](https://help.opus.pro/) |
| ThoughtSpot / Spotter | AI 工具；Web | [Spotter](https://www.thoughtspot.com/product/agents/spotter) |
| Qlik / Qlik Answers | AI 工具；Web | [Qlik Answers](https://www.qlik.com/us/products/qlik-answers)、[官方帮助](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/Qlik-Answers.htm) |
| Dataiku / Dataiku | AI 工具；Web | [产品页](https://www.dataiku.com/product/)、[官方文档](https://doc.dataiku.com/dss/latest/) |
| Navicat / Navicat Premium | AI 可接入；Windows 官方页 | [官方下载](https://www.navicat.com/en/download/navicat-premium)、[Navicat 17 AI 功能](https://www.navicat.com/en/navicat-17-highlights.html) |

## 本轮纠错与防复发

- 候选中的 `Altair AI Studio` 已过时。Siemens 官方资料明确 Altair 已并入 Siemens，并把 `Altair AI Studio` 更名为 `Rapidminer AI Studio`；正式目录因此复用 `siemens` 厂商，不创建 `altair` 厂商。
- BricsCAD 已使用当前 Octave 品牌与产品页；旧 Bricsys 产品 ID 和文字兜底会在扩充脚本中迁移删除。旧 V26 PDF 返回 404，正式记录使用当前产品页和安装帮助页。
- `https://vlex.com/es/vincent-ai` 返回 404，替换为当前 `https://vlex.com/vincent-ai?hsLang=en`。
- Scopus 当前产品名改为 `Scopus with AI`；Spellbook 明确为 Microsoft Word 加载项，Genesys Cloud CX 的 Web/API 与 Windows 获取入口合并在同一产品卡内。
- SOLIDWORKS、Designcenter、Tekla、Lexis+ with Protégé、Harvey、scite、Relativity 与 Freddy 的营销页或过时教程入口已换成当前产品页、安装说明或用户文档。
- 最终 109 个去重官方入口中 103 个直接可达，6 个被厂商 WAF/访问策略拦截；Vectorworks 在 Node 并发探测中出现一次传输异常，随后经系统网络和实时页面复核返回 200。没有真实 404/410。
- `catalog:expand:industry` 重复执行后目录与文字兜底清单哈希必须保持不变；完整性测试同时禁止旧 `altair-ai-studio`、`bricsys-bricscad` 和对应空厂商重新出现。
- 防复发边界：脚本只在新增厂商时写入厂商资料；已有厂商的排序、启停、文案、颜色和图标仍由后台保留，产品更新也继续保留后台的启停与排序字段。
