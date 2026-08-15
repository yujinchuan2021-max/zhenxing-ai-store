# AI 可接入厂商桌面型条目：官方证据复核队列

本文件只读生成，不调用 saveDraft、不发布、不改变核心轮播/desktop/CLI 合并。 authoritative draft revision 83，共 615 产品；筛出 65 个 directoryKind=ai-connectable 且 productType=desktop-official 条目。

| 统计 | 数量 |
|---|---:|
| 待复核条目 | 65 |
| 已确认可接入 | 0（本队列尚未作结论） |
| 官方证据来源 | 仅使用现有 website/tutorial 作为待核入口，必须回到官网/官方文档/官方仓库逐项确认 |

## 复核规则

- 桌面软件名称不能自动等同于 API、模型服务、开发平台或可接入云能力。
- 第三方页面、搜索摘要、推测 URL 不得作为证据。
- 未能由第一方材料同时支持产品身份与接入能力时，保持 pending/blocked。
- 厂商实体只保留一份；产品按官方身份去重；不复制进核心轮播、desktop 或 CLI 合并。
- 本队列不得包含命令、参数、环境、脚本、headers 或 credentials。

## 条目清单

| productId | vendorId | 官方待核入口 | 当前类型 |
|---|---|---|---|
| ableton-live | ableton | https://www.ableton.com/en/trial/<br>https://github.com/uisato/ableton-mcp-extended | desktop-official |
| adobe-acrobat-reader-ai | adobe | https://www.adobe.com/acrobat/pdf-reader.html<br>https://helpx.adobe.com/acrobat/desktop/use-acrobat-ai/generative-ai-features/ai-get-answers.html | desktop-official |
| adobe-creative-cloud | adobe | https://www.adobe.com/download/creative-cloud<br>https://developer.adobe.com/adobe-for-creativity/getting-started/ | desktop-official |
| affinity | canva | https://www.affinity.studio/<br>https://www.canva.com/newsroom/news/canva-create-2026-launches/ | desktop-official |
| airtable-platform | airtable | https://www.airtable.com/windows<br>https://support.airtable.com/v1/docs/using-the-airtable-mcp-server | desktop-official |
| allplan | allplan | https://www.allplan.com/products/allplan/<br>https://www.allplan.com/us_en/system/releasenotes/2026/allplan-2026-0-1/ | desktop-official |
| ansys-lumerical | ansys | https://www.ansys.com/products/optics<br>https://github.com/ansys/pylumerical-mcp | desktop-official |
| anydesk-windows | anydesk | https://anydesk.com/en/downloads/windows<br>https://support.anydesk.com/docs/rest-api | desktop-official |
| anytype-desktop | anytype | https://anytype.io/downloads<br>https://doc.anytype.io/anytype-docs/getting-started/install-and-setup | desktop-official |
| asana-work-graph | asana | https://asana.com/download<br>https://help.asana.com/s/article/asana-desktop-app?language=en_US | desktop-official |
| audacity-desktop | audacity | https://www.audacityteam.org/download/windows/<br>https://www.audacityteam.org/download/openvino/ | desktop-official |
| autodesk-autocad | autodesk | https://www.autodesk.com/products/autocad/overview<br>https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-WhatsNew/files/GUID-B4E1E636-E08E-4277-8971-910D47440116.htm | desktop-official |
| autodesk-fusion | autodesk | https://www.autodesk.com/products/fusion-360/<br>https://help.autodesk.com/view/fusion360/ENU/?guid=FMCP-OVERVIEW | desktop-official |
| autodesk-revit | autodesk | https://www.autodesk.com/products/revit/overview/<br>https://help.autodesk.com/view/RVT/2027/ENU/?guid=GUID-68D8FE6D-C5B0-4503-AE27-02C715BAC25B | desktop-official |
| blender | blender | https://www.blender.org/download/<br>https://github.com/ahujasid/blender-mcp | desktop-official |
| box-content-cloud | box | https://www.box.com/drive<br>https://support.box.com/hc/en-us/articles/50483150712723-Box-AI-for-Drive | desktop-official |
| cisco-webex-ai-assistant | cisco | https://www.webex.com/downloads.html<br>https://help.webex.com/article/ub8jcj/ | desktop-official |
| clickup-workspace | clickup | https://clickup.com/download<br>https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server | desktop-official |
| dassault-solidworks-design | dassault-systemes | https://www.solidworks.com/support/downloads<br>https://my.solidworks.com/training | desktop-official |
| davinci-resolve | blackmagic-design | https://www.blackmagicdesign.com/products/davinciresolve<br>https://github.com/samuelgursky/davinci-resolve-mcp | desktop-official |
| dialpad-desktop | dialpad | https://www.dialpad.com/download/<br>https://help.dialpad.com/v1/docs/en/dialpad-app-requirements | desktop-official |
| discord-desktop | discord | https://discord.com/download<br>https://discord.com/developers/docs/intro | desktop-official |
| docker-desktop | docker | https://www.docker.com/products/docker-desktop/<br>https://docs.docker.com/ai/mcp-catalog-and-toolkit/get-started/ | desktop-official |
| figma-design | figma | https://www.figma.com/downloads/<br>https://developers.figma.com/docs/figma-mcp-server/ | desktop-official |
| genesys-cloud-cx | genesys | https://help.genesys.cloud/articles/desktop-app/<br>https://developer.genesys.cloud/ | desktop-official |
| godot-engine | godot | https://godotengine.org/download/windows/<br>https://github.com/tomyud1/godot-mcp | desktop-official |
| google-android-studio | google | https://developer.android.com/studio<br>https://developer.android.com/studio/gemini/overview | desktop-official |
| google-chrome-devtools | google | https://www.google.com/chrome/download-chrome/<br>https://support.google.com/chrome/answer/16283624 | desktop-official |
| graphisoft-archicad | graphisoft | https://www.graphisoft.com/en-us/downloads/<br>https://help.graphisoft.com/AC/28/INT/_AC28_Help/100_Visualization/100_Visualization-10.htm | desktop-official |
| jetbrains-intellij-idea | jetbrains | https://www.jetbrains.com/idea/download/?section=windows<br>https://www.jetbrains.com/help/idea/mcp-server.html | desktop-official |
| laiye-rpa | laiye | https://laiye.com/product/rpa-platform<br>https://documents.laiye.com/ | desktop-official |
| linear-workspace | linear | https://linear.app/download<br>https://linear.app/docs/mcp | desktop-official |
| matlab | mathworks | https://www.mathworks.com/products/matlab.html<br>https://www.mathworks.com/products/matlab-mcp-server.html | desktop-official |
| microsoft-edge-ai | microsoft | https://www.microsoft.com/en-us/edge/download<br>https://support.microsoft.com/en-us/microsoft-copilot/getting-started-with-copilot-in-microsoft-edge | desktop-official |
| microsoft-visual-studio | microsoft | https://visualstudio.microsoft.com/downloads/<br>https://learn.microsoft.com/en-us/visualstudio/ide/visual-studio-github-copilot-install-and-states?view=visualstudio | desktop-official |
| miro-workspace | miro | https://miro.com/apps/<br>https://help.miro.com/hc/en-us/articles/31625301583890-How-to-enable-Miro-s-MCP-Server-user-guide | desktop-official |
| monday-work-management | monday | https://support.monday.com/hc/en-us/articles/115005316885-monday-com-s-desktop-app<br>https://developer.monday.com/api-reference/docs/integrate-with-monday-mcp | desktop-official |
| mongodb-compass | mongodb | https://www.mongodb.com/try/download/compass<br>https://www.mongodb.com/docs/compass/query-with-natural-language/ | desktop-official |
| mozilla-firefox | mozilla | https://www.firefox.com/en-US/download/windows/<br>https://support.mozilla.org/en-US/kb/ai-chatbot | desktop-official |
| navicat-premium | navicat | https://www.navicat.com/en/download/navicat-premium<br>https://www.navicat.com/en/navicat-17-highlights.html | desktop-official |
| neo4j-desktop | neo4j | https://neo4j.com/download/<br>https://neo4j.com/docs/desktop/current/ | desktop-official |
| neo4j-enterprise-studio | neo4j | https://neo4j.com/product/enterprise-studio/<br>https://neo4j.com/product/enterprise-studio/ | desktop-official |
| obs-studio | obs-project | https://obsproject.com/download<br>https://github.com/sbroenne/mcp-server-obs | desktop-official |
| obsidian-desktop | obsidian | https://obsidian.md/download<br>https://help.obsidian.md/ | desktop-official |
| octave-bricscad | octave | https://bricscad.octave.com/bricscad<br>https://help.bricsys.com/en-us/document/bricscad/installation-and-licensing/installing-bricscad | desktop-official |
| opera-one | opera | https://www.opera.com/one<br>https://help.opera.com/en/browser-ai-faq/ | desktop-official |
| postman-api-platform | postman | https://www.postman.com/downloads/<br>https://learning.postman.com/docs/reference/postman-api/postman-mcp-server/overview/ | desktop-official |
| ptc-creo | ptc | https://www.ptc.com/en/products/creo/capabilities<br>https://www.ptc.com/en/news/2026/ptc-brings-ai-powered-guidance-to-the-design-environment-with-creo-13 | desktop-official |
| redis-insight | redis | https://redis.io/docs/latest/operate/redisinsight/install/install-on-desktop/<br>https://redis.io/docs/latest/operate/redisinsight/ | desktop-official |
| roblox-studio | roblox | https://create.roblox.com/docs/studio/setup<br>https://create.roblox.com/docs/studio/mcp | desktop-official |
| siemens-designcenter-nx | siemens | https://www.siemens.com/en-us/products/designcenter/cad-software/<br>https://blogs.sw.siemens.com/designcenter/learn-designcenter-nx-cad-software/ | desktop-official |
| siemens-eigen-engineering-agent | siemens | https://www.siemens.com/en-us/products/tia-portal/<br>https://www.siemens.com/en-us/products/tia-portal/ | desktop-official |
| simulink | mathworks | https://www.mathworks.com/products/simulink.html<br>https://www.mathworks.com/products/simulink-agentic-toolkit.html | desktop-official |
| sketchup | trimble | https://sketchup.trimble.com/en/download/all<br>https://help.sketchup.com/pl/sketchup-claude-connector | desktop-official |
| slack-workspace | slack | https://slack.com/downloads/windows<br>https://docs.slack.dev/ai/slack-mcp-server/ | desktop-official |
| streamlabs-desktop | streamlabs | https://streamlabs.com/desktop<br>https://support.streamlabs.com/hc/en-us/articles/47097311788443-Introducing-the-Game-Pulse-Widget-by-Streamlabs | desktop-official |
| sunlogin-windows | oray | https://sunlogin.oray.com/download<br>https://service.oray.com/question/50091.html | desktop-official |
| synopsys-verdi | synopsys | https://www.synopsys.com/verification/debug/verdi.html<br>https://www.synopsys.com/blogs/chip-design/using-ai-to-debug-more-quickly-and-accurately.html | desktop-official |
| trimble-tekla-structures | trimble | https://download.trimble.com/tekla-structures/for-businesses<br>https://support.tekla.com/tekla-structures/learn | desktop-official |
| uipath-studio | uipath | https://www.uipath.com/product/studio<br>https://www.uipath.com/platform/agentic-automation/agentic-ai/agent-builder | desktop-official |
| unity-editor | unity-technologies | https://unity.com/download<br>https://docs.unity3d.com/Packages/com.unity.ai.assistant@latest/index.html?subfolder=%2Fmanual%2Fintegration%2Funity-mcp-get-started.html | desktop-official |
| unreal-engine | epic-games | https://www.unrealengine.com/download<br>https://github.com/GenOrca/unreal-mcp | desktop-official |
| vectorworks-design-suite | vectorworks | https://www.vectorworks.net/en-US/products?showModal=trial-form<br>https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Rendering2/Generating_AI_images.htm | desktop-official |
| wolfram-mathematica | wolfram-research | https://www.wolfram.com/mathematica/<br>https://www.wolfram.com/artificial-intelligence/mcp/local/wolfram-mcp-local/ | desktop-official |
| zoom-workplace | zoom | https://www.zoom.com/en/products/virtual-meetings/download-center/<br>https://developers.zoom.us/docs/mcp/zoom-mcp-server/ | desktop-official |
