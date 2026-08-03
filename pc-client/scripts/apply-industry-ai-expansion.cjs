"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");
const { applyDefinition } = require("../shared/catalog-maintenance.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const fallbackPath = path.join(root, "admin", "data", "vendor-icon-fallbacks.json");
const verifiedAt = "2026-08-03T15:30:00.000Z";

function desktop({
  id,
  name,
  category,
  description,
  downloadPage,
  homePage,
  tutorial,
  directoryKind,
  order = 0,
  desktopLabel = `获取 ${name} Windows 版`
}) {
  return {
    id,
    enabled: true,
    order,
    directoryKind,
    name,
    kind: "桌面端",
    category,
    description,
    website: downloadPage,
    tutorial,
    productType: "desktop-official",
    moduleId: "desktop-official",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-official-download",
    downloadPolicy: "official-page",
    signaturePolicy: "vendor-controlled",
    uninstallPolicy: "vendor-managed",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "website", label: "工具官网", url: homePage },
      { type: "desktop", label: desktopLabel },
      ...(tutorial !== downloadPage
        ? [{ type: "tutorial", label: "使用教程", url: tutorial }]
        : [])
    ]
  };
}

function web({
  id,
  name,
  category,
  description,
  website,
  tutorial,
  directoryKind,
  order = 0
}) {
  return {
    id,
    enabled: true,
    order,
    directoryKind,
    name,
    kind: "其他产品",
    category,
    description,
    website,
    tutorial,
    productType: "web",
    moduleId: "web-link",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-product-website",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "web", label: `打开 ${name}`, url: website },
      ...(tutorial !== website
        ? [{ type: "tutorial", label: "使用教程", url: tutorial }]
        : [])
    ]
  };
}

function vendor(id, name, initial, color, description, website, tutorial, products) {
  return { id, name, initial, color, description, website, tutorial, products };
}

const connectableDesktop = (definition) =>
  desktop({ ...definition, directoryKind: "ai-connectable" });
const toolDesktop = (definition) =>
  desktop({ ...definition, directoryKind: "ai-tool" });
const connectableWeb = (definition) =>
  web({ ...definition, directoryKind: "ai-connectable" });
const toolWeb = (definition) => web({ ...definition, directoryKind: "ai-tool" });

const definitions = [
  {
    id: "autodesk",
    products: [
      connectableDesktop({
        id: "autodesk-autocad",
        name: "AutoCAD",
        category: "3D 与工业仿真",
        description: "Autodesk 的 Windows CAD 产品，包含 Autodesk Assistant、Smart Blocks 等辅助设计能力；功能随版本与订阅方案变化。",
        downloadPage: "https://www.autodesk.com/products/autocad/overview",
        homePage: "https://www.autodesk.com/products/autocad/overview",
        tutorial: "https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-WhatsNew/files/GUID-B4E1E636-E08E-4277-8971-910D47440116.htm",
        order: 1
      }),
      connectableDesktop({
        id: "autodesk-revit",
        name: "Revit",
        category: "3D 与工业仿真",
        description: "Autodesk 的 Windows BIM 产品，提供面向建筑设计工作流的 Assistant 与 MCP 预览能力；可用范围以官方版本说明为准。",
        downloadPage: "https://www.autodesk.com/products/revit/overview/",
        homePage: "https://www.autodesk.com/products/revit/overview/",
        tutorial: "https://help.autodesk.com/view/RVT/2027/ENU/?guid=GUID-68D8FE6D-C5B0-4503-AE27-02C715BAC25B",
        order: 2
      })
    ]
  },
  vendor(
    "graphisoft",
    "Graphisoft",
    "G",
    "#1f6f43",
    "提供面向建筑师的 BIM 设计、协作和可视化软件。",
    "https://www.graphisoft.com/",
    "https://help.graphisoft.com/AC/28/INT/_AC28_Help/100_Visualization/100_Visualization-10.htm",
    [
      connectableDesktop({
        id: "graphisoft-archicad",
        name: "Archicad",
        category: "3D 与工业仿真",
        description: "面向建筑设计的 Windows BIM 软件，提供 AI Visualizer 等生成式可视化能力。",
        downloadPage: "https://www.graphisoft.com/en-us/downloads/",
        homePage: "https://www.graphisoft.com/",
        tutorial: "https://help.graphisoft.com/AC/28/INT/_AC28_Help/100_Visualization/100_Visualization-10.htm"
      })
    ]
  ),
  vendor(
    "vectorworks",
    "Vectorworks",
    "V",
    "#ef3e42",
    "提供建筑、景观、舞台与娱乐设计软件。",
    "https://www.vectorworks.net/",
    "https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Rendering2/Generating_AI_images.htm",
    [
      connectableDesktop({
        id: "vectorworks-design-suite",
        name: "Vectorworks Design Suite",
        category: "3D 与工业仿真",
        description: "Windows 设计套件，覆盖建筑、景观和娱乐设计，并提供 AI Visualizer 图像生成工作流。",
        downloadPage: "https://www.vectorworks.net/en-US/products?showModal=trial-form",
        homePage: "https://www.vectorworks.net/en-US/products",
        tutorial: "https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Rendering2/Generating_AI_images.htm"
      })
    ]
  ),
  vendor(
    "octave",
    "Octave",
    "O",
    "#c8102e",
    "提供 Octave BricsCAD CAD 与 BIM 设计产品；产品原由 Bricsys 品牌发布。",
    "https://bricscad.octave.com/",
    "https://help.bricsys.com/en-us/document/bricscad/installation-and-licensing/installing-bricscad",
    [
      connectableDesktop({
        id: "octave-bricscad",
        name: "Octave BricsCAD",
        category: "3D 与工业仿真",
        description: "Windows CAD 与 BIM 产品，内置机器学习辅助的图纸整理、识别和建模能力。",
        downloadPage: "https://bricscad.octave.com/bricscad",
        homePage: "https://bricscad.octave.com/bricscad",
        tutorial: "https://help.bricsys.com/en-us/document/bricscad/installation-and-licensing/installing-bricscad"
      })
    ]
  ),
  vendor(
    "dassault-systemes",
    "Dassault Systèmes",
    "D",
    "#005386",
    "提供 3D 设计、工程、仿真与制造软件。",
    "https://www.3ds.com/",
    "https://www.solidworks.com/support/system-requirements",
    [
      connectableDesktop({
        id: "dassault-solidworks-design",
        name: "SOLIDWORKS Design",
        category: "3D 与工业仿真",
        description: "Windows 机械设计产品，提供 AI 辅助命令搜索、设计建议和自动化工作流；具体能力以许可版本为准。",
        downloadPage: "https://www.solidworks.com/support/downloads",
        homePage: "https://www.solidworks.com/product/solidworks-design",
        tutorial: "https://my.solidworks.com/training"
      })
    ]
  ),
  {
    id: "siemens",
    products: [
      connectableDesktop({
        id: "siemens-designcenter-nx",
        name: "Designcenter NX",
        category: "3D 与工业仿真",
        description: "Siemens 的 Windows CAD/CAM/CAE 产品，提供 AI 驱动的设计辅助与工程工作流。",
        downloadPage: "https://www.siemens.com/en-us/products/designcenter/cad-software/",
        homePage: "https://www.siemens.com/en-us/products/designcenter/",
        tutorial: "https://blogs.sw.siemens.com/designcenter/learn-designcenter-nx-cad-software/",
        order: 1
      }),
      toolDesktop({
        id: "siemens-rapidminer-ai-studio",
        name: "Rapidminer AI Studio",
        category: "数据库与数据",
        description: "Siemens 的 Windows 可视化数据科学与机器学习工作台，支持无代码建模、数据准备和模型评估；原 Altair AI Studio 已完成品牌迁移。",
        downloadPage: "https://www.siemens.com/en-us/products/rapidminer/ai-studio/",
        homePage: "https://www.siemens.com/en-us/products/rapidminer/ai-studio/",
        tutorial: "https://docs.rapidminer.com/latest/studio/installation/index.html",
        order: 2
      })
    ]
  },
  {
    id: "trimble",
    products: [
      connectableDesktop({
        id: "trimble-tekla-structures",
        name: "Tekla Structures",
        category: "3D 与工业仿真",
        description: "Windows 结构 BIM 产品，面向工程建模、详图与施工协作；AI 能力和许可范围以厂商版本说明为准。",
        downloadPage: "https://download.trimble.com/tekla-structures/for-businesses",
        homePage: "https://www.tekla.com/products/tekla-structures",
        tutorial: "https://support.tekla.com/tekla-structures/learn",
        order: 1
      })
    ]
  },
  vendor(
    "ilastik",
    "ilastik",
    "I",
    "#f3a712",
    "开发面向生物图像分析的交互式机器学习工具。",
    "https://www.ilastik.org/",
    "https://www.ilastik.org/documentation/",
    [
      toolDesktop({
        id: "ilastik-desktop",
        name: "ilastik",
        category: "数据库与数据",
        description: "面向生物医学图像分割与分类的 Windows 交互式机器学习桌面工具。",
        downloadPage: "https://www.ilastik.org/download",
        homePage: "https://www.ilastik.org/",
        tutorial: "https://www.ilastik.org/documentation/"
      })
    ]
  ),
  vendor(
    "qupath",
    "QuPath",
    "Q",
    "#5b3f8c",
    "开发面向数字病理和生物图像分析的开源软件。",
    "https://qupath.github.io/",
    "https://qupath.readthedocs.io/en/stable/",
    [
      toolDesktop({
        id: "qupath-desktop",
        name: "QuPath",
        category: "数据库与数据",
        description: "用于数字病理、显微图像分析和机器学习分类的 Windows 开源桌面工具。",
        downloadPage: "https://github.com/qupath/qupath/releases",
        homePage: "https://qupath.github.io/",
        tutorial: "https://qupath.readthedocs.io/en/stable/"
      })
    ]
  ),
  vendor(
    "orange-data-mining",
    "Orange Data Mining",
    "O",
    "#f58220",
    "开发面向教学、研究和分析的可视化数据挖掘工具。",
    "https://orangedatamining.com/",
    "https://orangedatamining.com/docs/",
    [
      toolDesktop({
        id: "orange-data-mining-desktop",
        name: "Orange Data Mining",
        category: "数据库与数据",
        description: "Windows 可视化机器学习与数据挖掘工具，通过组件式工作流完成分析和建模。",
        downloadPage: "https://orangedatamining.com/download/",
        homePage: "https://orangedatamining.com/",
        tutorial: "https://orangedatamining.com/docs/"
      })
    ]
  ),
  vendor(
    "elsevier",
    "Elsevier",
    "E",
    "#ff6c00",
    "提供科研出版、文献检索和研究分析产品。",
    "https://www.elsevier.com/",
    "https://researcheracademy.elsevier.com/uploads/2024-08/Scopus%20AI%20Quick%20Reference%20Guide%20.pdf",
    [
      toolWeb({
        id: "elsevier-scopus-ai",
        name: "Scopus with AI",
        category: "文档与知识库",
        description: "基于 Scopus 学术内容的生成式研究检索与摘要产品，需要相应机构或个人访问权限。",
        website: "https://www.elsevier.com/products/scopus/scopus-ai",
        tutorial: "https://researcheracademy.elsevier.com/uploads/2024-08/Scopus%20AI%20Quick%20Reference%20Guide%20.pdf"
      })
    ]
  ),
  {
    id: "clarivate",
    products: [
      toolWeb({
        id: "clarivate-web-of-science-research-assistant",
        name: "Web of Science Research Assistant",
        category: "文档与知识库",
        description: "Web of Science 内的研究检索与探索助手，通过自然语言发现、梳理和解释文献。",
        website: "https://clarivate.com/academia-government/scientific-and-academic-research/research-discovery-and-referencing/web-of-science/web-of-science-research-assistant/",
        tutorial: "https://clarivate.com/academia-government/blog/a-more-transparent-connected-experience-in-web-of-science-research-assistant/",
        order: 1
      })
    ]
  },
  vendor(
    "scispace",
    "SciSpace",
    "S",
    "#5d5fef",
    "提供论文检索、阅读、解释与文献综述工具。",
    "https://scispace.com/",
    "https://scispace.com/help/en/articles/10660587-how-to-conduct-a-literature-review-using-scispace",
    [
      toolWeb({
        id: "scispace-literature-review",
        name: "SciSpace Literature Review",
        category: "文档与知识库",
        description: "面向论文发现、阅读和文献综述的在线 AI 研究工具。",
        website: "https://scispace.com/search",
        tutorial: "https://scispace.com/help/en/articles/10660587-how-to-conduct-a-literature-review-using-scispace"
      })
    ]
  ),
  vendor(
    "scite",
    "scite",
    "S",
    "#111827",
    "Research Solutions 旗下基于引文上下文的科研发现与验证工具。",
    "https://scite.ai/",
    "https://help.researchsolutions.com/hc/en-us/articles/31949427606292-Writing-a-paper-with-Scite-AI",
    [
      toolWeb({
        id: "scite-assistant",
        name: "scite Assistant",
        category: "文档与知识库",
        description: "基于 Smart Citations 的在线研究助手，帮助发现、评估和核验学术主张。",
        website: "https://scite.ai/",
        tutorial: "https://help.researchsolutions.com/hc/en-us/articles/31949427606292-Writing-a-paper-with-Scite-AI"
      })
    ]
  ),
  vendor(
    "thomson-reuters",
    "Thomson Reuters",
    "T",
    "#ff8000",
    "提供法律、税务、会计与专业信息服务。",
    "https://www.thomsonreuters.com/",
    "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/get-started/about",
    [
      toolWeb({
        id: "thomson-reuters-cocounsel-legal",
        name: "CoCounsel Legal",
        category: "文档与知识库",
        description: "面向法律检索、文档分析和专业工作流的在线 AI 助手，需要相应产品订阅。",
        website: "https://legal.thomsonreuters.com/en/products/cocounsel-legal",
        tutorial: "https://www.thomsonreuters.com/en-us/help/cocounsel/legal/get-started/about"
      })
    ]
  ),
  vendor(
    "lexisnexis",
    "LexisNexis",
    "L",
    "#c8102e",
    "提供法律研究、业务信息和风险解决方案。",
    "https://www.lexisnexis.com/",
    "https://www.lexisnexis.com/en-us/training/default.page",
    [
      toolWeb({
        id: "lexisnexis-lexis-plus-protege",
        name: "Lexis+ with Protégé",
        category: "文档与知识库",
        description: "面向法律研究、起草、摘要和文档分析的在线 AI 工作空间，需要 LexisNexis 账号与许可。",
        website: "https://www.lexisnexis.com/en-us/products/lexis-plus-protege.page",
        tutorial: "https://www.lexisnexis.com/en-us/training/default.page"
      })
    ]
  ),
  vendor(
    "harvey",
    "Harvey",
    "H",
    "#1d1d1f",
    "开发面向法律和专业服务团队的生成式 AI 平台。",
    "https://www.harvey.ai/",
    "https://help.harvey.ai/articles/getting-started-with-harvey",
    [
      toolWeb({
        id: "harvey-platform",
        name: "Harvey",
        category: "文档与知识库",
        description: "面向法律与专业服务团队的在线 AI 工作空间，覆盖研究、起草、文档分析和工作流。",
        website: "https://www.harvey.ai/platform",
        tutorial: "https://help.harvey.ai/articles/getting-started-with-harvey"
      })
    ]
  ),
  vendor(
    "spellbook",
    "Spellbook",
    "S",
    "#5b45d6",
    "提供面向合同起草、审阅和谈判的法律 AI 工具。",
    "https://spellbook.com/",
    "https://help.spellbook.legal/en/articles/9079381-how-to-install-spellbook-in-microsoft-word",
    [
      toolWeb({
        id: "spellbook-legal",
        name: "Spellbook",
        category: "文档与知识库",
        description: "面向合同起草、审阅和谈判的 Microsoft Word AI 加载项；官方当前不提供独立桌面应用。",
        website: "https://spellbook.com/",
        tutorial: "https://help.spellbook.legal/en/articles/9079381-how-to-install-spellbook-in-microsoft-word"
      })
    ]
  ),
  vendor(
    "vlex",
    "vLex",
    "V",
    "#ec1c24",
    "提供全球法律研究、知识与 AI 辅助产品。",
    "https://vlex.com/",
    "https://knowledge.vlex.com/en/vincent-ai",
    [
      toolWeb({
        id: "vlex-vincent-ai",
        name: "Vincent AI",
        category: "文档与知识库",
        description: "面向法律研究、文档分析和专业工作流的在线 AI 助手。",
        website: "https://vlex.com/vincent-ai?hsLang=en",
        tutorial: "https://knowledge.vlex.com/en/vincent-ai"
      })
    ]
  ),
  vendor(
    "relativity",
    "Relativity",
    "R",
    "#0067b1",
    "提供电子取证、法律数据管理和审阅平台。",
    "https://www.relativity.com/",
    "https://help.relativity.com/RelativityOne/Content/Relativity/aiR_for_Review/aiR_for_Review.htm",
    [
      toolWeb({
        id: "relativity-air-review",
        name: "Relativity aiR for Review",
        category: "文档与知识库",
        description: "面向电子取证审阅的生成式 AI 产品，帮助组织、解释和优先处理案件材料。",
        website: "https://www.relativity.com/data-solutions/air/review/",
        tutorial: "https://help.relativity.com/RelativityOne/Content/Relativity/aiR_for_Review/aiR_for_Review.htm"
      })
    ]
  ),
  vendor(
    "zendesk",
    "Zendesk",
    "Z",
    "#03363d",
    "提供客户服务、工单管理和联络中心产品。",
    "https://www.zendesk.com/",
    "https://support.zendesk.com/hc/en-us/articles/7908817636378-About-agent-copilot",
    [
      toolWeb({
        id: "zendesk-copilot",
        name: "Zendesk Copilot",
        category: "客户服务",
        description: "嵌入 Zendesk 客服工作流的 AI 助手，提供建议回复、工单摘要和下一步操作建议。",
        website: "https://www.zendesk.com/service/ai/copilot/",
        tutorial: "https://support.zendesk.com/hc/en-us/articles/7908817636378-About-agent-copilot"
      })
    ]
  ),
  vendor(
    "freshworks",
    "Freshworks",
    "F",
    "#0b1320",
    "提供客户服务、IT 服务和销售支持软件。",
    "https://www.freshworks.com/",
    "https://support.freshdesk.com/support/solutions/articles/50000010359-overview-of-freddy-ai-for-ticketing",
    [
      toolWeb({
        id: "freshworks-freddy-ai-copilot",
        name: "Freddy AI Copilot",
        category: "客户服务",
        description: "面向客服团队的 AI Copilot，辅助生成回复、汇总对话和执行服务工作流。",
        website: "https://www.freshworks.com/freshdesk/freddy-ai-for-cx/helpdesk/",
        tutorial: "https://support.freshdesk.com/support/solutions/articles/50000010359-overview-of-freddy-ai-for-ticketing"
      })
    ]
  ),
  vendor(
    "genesys",
    "Genesys",
    "G",
    "#ff4f1f",
    "提供云联络中心、客户体验和开发者平台。",
    "https://www.genesys.com/",
    "https://developer.genesys.cloud/",
    [
      connectableDesktop({
        id: "genesys-cloud-cx",
        name: "Genesys Cloud CX",
        category: "客户服务",
        description: "云联络中心与客户体验平台，提供 Windows 桌面应用，并可通过官方 API 和开发者工具接入 AI 工作流。",
        downloadPage: "https://help.genesys.cloud/articles/desktop-app/",
        homePage: "https://www.genesys.com/genesys-cloud",
        tutorial: "https://developer.genesys.cloud/"
      })
    ]
  ),
  vendor(
    "gong",
    "Gong",
    "G",
    "#6e3ff3",
    "提供面向销售团队的收入智能与对话分析平台。",
    "https://www.gong.io/",
    "https://help.gong.io/docs/getting-started-welcome-to-gong",
    [
      toolWeb({
        id: "gong-revenue-ai-os",
        name: "Gong Revenue AI OS",
        category: "营销与搜索",
        description: "面向销售团队的在线收入智能平台，分析客户互动并提供 AI 辅助建议。",
        website: "https://www.gong.io/platform",
        tutorial: "https://help.gong.io/docs/getting-started-welcome-to-gong"
      })
    ]
  ),
  vendor(
    "dialpad",
    "Dialpad",
    "D",
    "#1e1e1e",
    "提供云通信、联络中心和 AI 会议产品。",
    "https://www.dialpad.com/",
    "https://help.dialpad.com/v1/docs/en/dialpad-app-requirements",
    [
      connectableDesktop({
        id: "dialpad-desktop",
        name: "Dialpad",
        category: "客户服务",
        description: "Windows 云通信与联络中心客户端，包含通话转写、摘要和 AI 助理能力。",
        downloadPage: "https://www.dialpad.com/download/",
        homePage: "https://www.dialpad.com/",
        tutorial: "https://help.dialpad.com/v1/docs/en/dialpad-app-requirements"
      })
    ]
  ),
  vendor(
    "audacity",
    "Audacity",
    "A",
    "#000000",
    "开发开源音频录制、编辑与处理软件。",
    "https://www.audacityteam.org/",
    "https://www.audacityteam.org/download/openvino/",
    [
      connectableDesktop({
        id: "audacity-desktop",
        name: "Audacity",
        category: "音频制作",
        description: "Windows 开源音频编辑器，可通过官方 OpenVINO AI 插件使用降噪、分轨、转录和生成能力。",
        downloadPage: "https://www.audacityteam.org/download/windows/",
        homePage: "https://www.audacityteam.org/",
        tutorial: "https://www.audacityteam.org/download/openvino/"
      })
    ]
  ),
  vendor(
    "streamlabs",
    "Streamlabs",
    "S",
    "#31c48d",
    "提供直播、录制、创作者工具和互动组件。",
    "https://streamlabs.com/",
    "https://support.streamlabs.com/hc/en-us/articles/47097311788443-Introducing-the-Game-Pulse-Widget-by-Streamlabs",
    [
      connectableDesktop({
        id: "streamlabs-desktop",
        name: "Streamlabs Desktop",
        category: "直播与录制",
        description: "Windows 直播与录制工作台，可通过官方组件和 AI 功能扩展创作者工作流。",
        downloadPage: "https://streamlabs.com/desktop",
        homePage: "https://streamlabs.com/desktop",
        tutorial: "https://support.streamlabs.com/hc/en-us/articles/47097311788443-Introducing-the-Game-Pulse-Widget-by-Streamlabs"
      })
    ]
  ),
  vendor(
    "riverside",
    "Riverside",
    "R",
    "#6c4cff",
    "提供远程录制、视频编辑和内容再利用工具。",
    "https://riverside.com/",
    "https://riverside.com/video-editor",
    [
      toolWeb({
        id: "riverside-ai-video-editor",
        name: "Riverside AI Video Editor",
        category: "视频创作",
        description: "在线 AI 视频编辑器，支持文本式剪辑、字幕、摘要和短内容生成。",
        website: "https://riverside.com/tools/ai-video-editor",
        tutorial: "https://riverside.com/video-editor"
      })
    ]
  ),
  vendor(
    "opusclip",
    "OpusClip",
    "O",
    "#ff5d45",
    "提供长视频切片、重构和社交短视频生成工具。",
    "https://www.opus.pro/",
    "https://help.opus.pro/",
    [
      toolWeb({
        id: "opusclip",
        name: "OpusClip",
        category: "视频创作",
        description: "将长视频自动转换为社交短视频的在线 AI 编辑与内容再利用工具。",
        website: "https://www.opus.pro/",
        tutorial: "https://help.opus.pro/"
      })
    ]
  ),
  vendor(
    "thoughtspot",
    "ThoughtSpot",
    "T",
    "#e52b50",
    "提供搜索式分析、商业智能和数据智能体产品。",
    "https://www.thoughtspot.com/",
    "https://www.thoughtspot.com/product/agents/spotter",
    [
      toolWeb({
        id: "thoughtspot-spotter",
        name: "Spotter",
        category: "数据库与数据",
        description: "面向业务数据问答、分析和洞察的在线 AI 分析智能体。",
        website: "https://www.thoughtspot.com/product/agents/spotter",
        tutorial: "https://www.thoughtspot.com/product/agents/spotter"
      })
    ]
  ),
  vendor(
    "qlik",
    "Qlik",
    "Q",
    "#2e7d32",
    "提供数据集成、分析和商业智能产品。",
    "https://www.qlik.com/",
    "https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/Qlik-Answers.htm",
    [
      toolWeb({
        id: "qlik-answers",
        name: "Qlik Answers",
        category: "数据库与数据",
        description: "基于组织非结构化内容提供可追溯回答的在线生成式 AI 产品。",
        website: "https://www.qlik.com/us/products/qlik-answers",
        tutorial: "https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/Qlik-Answers.htm"
      })
    ]
  ),
  vendor(
    "dataiku",
    "Dataiku",
    "D",
    "#2ab7a9",
    "提供企业数据科学、机器学习和生成式 AI 平台。",
    "https://www.dataiku.com/",
    "https://doc.dataiku.com/dss/latest/",
    [
      toolWeb({
        id: "dataiku-platform",
        name: "Dataiku",
        category: "数据库与数据",
        description: "企业数据科学与 AI 平台，覆盖数据准备、机器学习、生成式 AI 和治理工作流。",
        website: "https://www.dataiku.com/product/",
        tutorial: "https://doc.dataiku.com/dss/latest/"
      })
    ]
  ),
  vendor(
    "navicat",
    "Navicat",
    "N",
    "#0f9ed5",
    "提供数据库开发、管理、迁移和建模工具。",
    "https://www.navicat.com/",
    "https://www.navicat.com/en/navicat-17-highlights.html",
    [
      connectableDesktop({
        id: "navicat-premium",
        name: "Navicat Premium",
        category: "数据库与数据",
        description: "Windows 多数据库开发与管理工具，提供 AI 辅助查询、解释与数据库工作流。",
        downloadPage: "https://www.navicat.com/en/download/navicat-premium",
        homePage: "https://www.navicat.com/en/navicat-17-highlights.html",
        tutorial: "https://www.navicat.com/en/navicat-17-highlights.html"
      })
    ]
  )
];

const fallbackEvidence = Object.fromEntries(
  definitions
    .filter((definition) => definition.name)
    .map((definition) => [definition.id, definition.website])
);

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const retiredProductIds = new Set(["altair-ai-studio", "bricsys-bricscad"]);
for (const vendorDefinition of catalog.vendors) {
  vendorDefinition.products = vendorDefinition.products.filter(
    (product) => !retiredProductIds.has(product.id)
  );
}
const retiredVendorIds = new Set(["altair", "bricsys"]);
catalog.vendors = catalog.vendors.filter(
  (vendorDefinition) =>
    !retiredVendorIds.has(vendorDefinition.id) || vendorDefinition.products.length > 0
);
const productOwners = new Map(
  catalog.vendors.flatMap((vendorDefinition) =>
    vendorDefinition.products.map((product) => [product.id, vendorDefinition.id])
  )
);
let nextVendorOrder =
  Math.max(-1, ...catalog.vendors.map((vendorDefinition) => vendorDefinition.order ?? 0)) + 1;

function upsertProduct(targetVendor, definition) {
  const owner = productOwners.get(definition.id);
  if (owner && owner !== targetVendor.id) {
    throw new Error(`产品 ID 已属于其他厂商：${definition.id}`);
  }
  const existing = targetVendor.products.find((entry) => entry.id === definition.id);
  if (existing) applyDefinition(existing, definition, ["enabled", "order"]);
  else targetVendor.products.push(definition);
  productOwners.set(definition.id, targetVendor.id);
}

for (const definition of definitions) {
  let targetVendor = catalog.vendors.find((entry) => entry.id === definition.id);
  if (!targetVendor) {
    if (!definition.name || !definition.initial) {
      throw new Error(`新增厂商缺少资料：${definition.id}`);
    }
    targetVendor = {
      id: definition.id,
      name: definition.name,
      initial: definition.initial,
      mark: definition.initial,
      color: definition.color,
      description: definition.description,
      website: definition.website,
      tutorial: definition.tutorial,
      enabled: true,
      order: nextVendorOrder++,
      iconUrl: "",
      products: []
    };
    catalog.vendors.push(targetVendor);
  }
  for (const product of definition.products) upsertProduct(targetVendor, product);
}

if (!catalog.updatedAt) catalog.updatedAt = verifiedAt;
validateCatalog(catalog);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

const fallbacks = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
fallbacks.reviewedAt = verifiedAt;
for (const vendorId of retiredVendorIds) {
  if (!catalog.vendors.some((vendorDefinition) => vendorDefinition.id === vendorId)) {
    delete fallbacks.vendors[vendorId];
  }
}
for (const [vendorId, evidenceUrl] of Object.entries(fallbackEvidence)) {
  if (catalog.vendors.find((entry) => entry.id === vendorId)?.iconAsset) continue;
  fallbacks.vendors[vendorId] = {
    evidenceUrl,
    reason:
      "厂商与产品身份已由官方来源核验；在未确认可用于第三方目录的方形品牌素材前使用文字兜底，禁止使用 favicon、搜索图片或相似厂商图标。"
  };
}
fs.writeFileSync(fallbackPath, `${JSON.stringify(fallbacks, null, 2)}\n`, "utf8");

process.stdout.write(
  `Expanded ${catalog.vendors.length} vendors, ${catalog.vendors.flatMap((vendorDefinition) => vendorDefinition.products).length} products and ${catalog.resources.length} resources\n`
);
