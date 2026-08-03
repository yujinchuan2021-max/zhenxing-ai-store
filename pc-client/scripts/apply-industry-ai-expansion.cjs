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

function cliOfficial({
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
    kind: "CLI",
    category,
    description,
    website,
    tutorial,
    productType: "cli-official",
    moduleId: "cli-official",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-official-install",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["website", "tutorial"],
    entryPoints: [
      { type: "website", label: "CLI 官网", url: website },
      { type: "cli", label: "查看 CLI 安装说明" },
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
const toolCli = (definition) =>
  cliOfficial({ ...definition, directoryKind: "ai-tool" });

const resourceTarget = (productId, compatibility = "official") => ({
  productId,
  compatibility,
  moduleId: "resource-link",
  installProfileId: "",
  capabilities: ["website"],
  enabled: true
});

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
  ),
  vendor(
    "amp",
    "Amp",
    "A",
    "#f97316",
    "独立的 AI 编程 Agent，提供命令行和远程开发工作流。",
    "https://ampcode.com/",
    "https://ampcode.com/manual",
    [
      toolCli({
        id: "amp-cli",
        name: "Amp CLI",
        category: "编程开发",
        description: "Amp 的命令行编程 Agent；Windows 用户按官方说明通过 WSL 使用，不冒充原生 Windows 桌面客户端。",
        website: "https://ampcode.com/manual",
        tutorial: "https://ampcode.com/manual"
      })
    ]
  ),
  vendor(
    "augment",
    "Augment Code",
    "A",
    "#0b6bcb",
    "面向团队代码库上下文的 AI 编程工具。",
    "https://www.augmentcode.com/",
    "https://docs.augmentcode.com/quickstart",
    [
      toolWeb({
        id: "augment-code",
        name: "Augment Code",
        category: "编程开发",
        description: "面向 VS Code 和 JetBrains 的代码库上下文 AI 助手；IDE 插件不是独立 Windows 桌面客户端。",
        website: "https://www.augmentcode.com/",
        tutorial: "https://docs.augmentcode.com/quickstart"
      }),
      toolCli({
        id: "augment-auggie-cli",
        name: "Auggie CLI",
        category: "编程开发",
        description: "Augment 的命令行 Agent（Beta）；官方 Windows 路径为 WSL，需按官方系统要求配置。",
        website: "https://docs.augmentcode.com/cli/overview",
        tutorial: "https://docs.augmentcode.com/cli/setup-auggie/install-auggie-cli"
      })
    ]
  ),
  vendor(
    "qodo",
    "Qodo",
    "Q",
    "#6d28d9",
    "面向代码审查、测试和工程治理的 AI 开发平台。",
    "https://qodo.ai/",
    "https://docs.qodo.ai/",
    [
      toolWeb({
        id: "qodo-code-review",
        name: "Qodo",
        category: "编程开发",
        description: "覆盖代码审查、测试和 Git/IDE 集成的 AI 工程平台；不同入口共用同一产品身份。",
        website: "https://qodo.ai/",
        tutorial: "https://docs.qodo.ai/code-review"
      })
    ]
  ),
  vendor(
    "coderabbit",
    "CodeRabbit",
    "C",
    "#f59e0b",
    "面向代码审查和开发流程的 AI 协作工具。",
    "https://www.coderabbit.ai/",
    "https://docs.coderabbit.ai/",
    [
      toolWeb({
        id: "coderabbit-code-review",
        name: "CodeRabbit",
        category: "编程开发",
        description: "在 Git、IDE 和 CLI 工作流中提供 AI 代码审查；CLI 在 Windows 上按官方 WSL 说明使用。",
        website: "https://www.coderabbit.ai/",
        tutorial: "https://docs.coderabbit.ai/overview/ide-cli-review"
      })
    ]
  ),
  vendor(
    "greptile",
    "Greptile",
    "G",
    "#111827",
    "面向代码库理解和审查的 AI 开发平台。",
    "https://www.greptile.com/",
    "https://www.greptile.com/docs/introduction",
    [
      toolWeb({
        id: "greptile-code-review",
        name: "Greptile",
        category: "编程开发",
        description: "连接 GitHub 或 GitLab 代码库的 AI 代码审查 Agent；云端、托管和 CLI 属于同一产品入口。",
        website: "https://www.greptile.com/",
        tutorial: "https://www.greptile.com/docs/introduction"
      })
    ]
  ),
  {
    id: "github",
    products: [
      toolWeb({
        id: "github-spark",
        name: "GitHub Spark",
        category: "编程开发",
        description: "用自然语言构建、编辑并发布全栈应用的 Web 产品（Public Preview）；不等同于 GitHub Copilot。",
        website: "https://github.com/features/spark",
        tutorial: "https://docs.github.com/en/copilot/tutorials/build-apps-with-spark"
      })
    ]
  },
  {
    id: "langchain",
    products: [
      toolWeb({
        id: "langchain-langsmith",
        name: "LangSmith",
        category: "智能体",
        description: "用于 Agent/LLM 应用追踪、评估、提示词管理和部署的开发平台；不等同于 LangChain 框架。",
        website: "https://smith.langchain.com/",
        tutorial: "https://docs.langchain.com/langsmith/evaluation"
      })
    ]
  },
  vendor(
    "clickhouse",
    "ClickHouse",
    "C",
    "#ffcc00",
    "开源分析数据库及 AI 可观测性产品提供商。",
    "https://clickhouse.com/",
    "https://langfuse.com/docs",
    [
      toolWeb({
        id: "clickhouse-langfuse",
        name: "Langfuse",
        category: "智能体",
        description: "ClickHouse 旗下的开源 LLM/Agent 可观测性平台，提供追踪、评估和提示词管理。",
        website: "https://langfuse.com/",
        tutorial: "https://langfuse.com/docs"
      })
    ]
  ),
  vendor(
    "promptfoo",
    "Promptfoo",
    "P",
    "#2563eb",
    "用于提示词、模型和 Agent 评估及红队测试的工具。",
    "https://www.promptfoo.dev/",
    "https://www.promptfoo.dev/docs/installation/",
    [
      toolCli({
        id: "promptfoo-cli",
        name: "Promptfoo CLI",
        category: "智能体",
        description: "命令行评估和红队测试工具；Windows 官方安装路径以文档为准，AI Hub 不代执行任意命令。",
        website: "https://www.promptfoo.dev/docs/installation/",
        tutorial: "https://www.promptfoo.dev/docs/usage/web-ui/"
      })
    ]
  ),
  vendor(
    "daytona",
    "Daytona",
    "D",
    "#111827",
    "面向 AI Agent 的安全代码沙箱基础设施。",
    "https://www.daytona.io/",
    "https://www.daytona.io/docs/en/",
    [
      toolWeb({
        id: "daytona-sandboxes",
        name: "Daytona Sandboxes",
        category: "云服务与运维",
        description: "为 AI Agent 提供隔离代码执行环境的云平台；控制台、API、CLI 和 MCP 属于同一服务。",
        website: "https://www.daytona.io/",
        tutorial: "https://www.daytona.io/docs/en/"
      }),
      toolCli({
        id: "daytona-cli",
        name: "Daytona CLI",
        category: "云服务与运维",
        description: "Daytona 沙箱管理命令行工具；官方提供 Windows CLI 文档，安装前需确认账号和远程执行权限。",
        website: "https://www.daytona.io/docs/en/tools/cli/",
        tutorial: "https://www.daytona.io/docs/en/tools/cli/"
      })
    ]
  ),
  vendor(
    "e2b",
    "E2B",
    "E",
    "#111827",
    "面向 Agent 的隔离代码执行沙箱平台。",
    "https://e2b.dev/",
    "https://e2b.dev/docs",
    [
      toolWeb({
        id: "e2b-sandboxes",
        name: "E2B Sandboxes",
        category: "云服务与运维",
        description: "为 AI Agent 提供隔离 Linux VM 和代码执行环境的云平台；不是本地 Windows Agent。",
        website: "https://e2b.dev/",
        tutorial: "https://e2b.dev/docs"
      })
    ]
  ),
  {
    id: "amazon",
    products: [
      toolWeb({
        id: "amazon-q-developer",
        name: "Amazon Q Developer",
        category: "编程开发",
        description: "AWS 的生成式 AI 开发助手，覆盖 AWS 控制台、IDE 和代码工作流；IDE 扩展不冒充独立 Windows 客户端。",
        website: "https://aws.amazon.com/q/developer/",
        tutorial: "https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/what-is.html"
      })
    ]
  },
  {
    id: "google",
    products: [
      toolWeb({
        id: "google-gemini-code-assist",
        name: "Gemini Code Assist",
        category: "编程开发",
        description: "Google Cloud 面向 IDE 的 AI 编程辅助产品；Standard/Enterprise 与个人层级的可用性按官方公告区分。",
        website: "https://cloud.google.com/gemini/code-assist",
        tutorial: "https://docs.cloud.google.com/gemini/docs/codeassist/overview"
      })
    ]
  },
  {
    id: "jetbrains",
    products: [
      toolWeb({
        id: "jetbrains-junie",
        name: "Junie",
        category: "编程开发",
        description: "JetBrains IDE/Android Studio 内的 AI 编程 Agent 插件；不是独立 Windows 桌面客户端。",
        website: "https://www.jetbrains.com/junie/",
        tutorial: "https://www.jetbrains.com/help/ai-assistant/junie-agent.html"
      })
    ]
  },
  {
    id: "vercel",
    products: [
      toolWeb({
        id: "vercel-v0",
        name: "v0",
        category: "编程开发",
        description: "Vercel 的自然语言应用构建和部署 Web 产品，可生成 UI、代码并发布到 Vercel。",
        website: "https://v0.dev/",
        tutorial: "https://vercel.com/docs/v0"
      })
    ]
  },
  {
    id: "atlassian",
    products: [
      toolWeb({
        id: "atlassian-rovo",
        name: "Rovo",
        category: "办公自动化",
        description: "Atlassian 的企业搜索、聊天、Agent 和 Studio 产品，连接 Jira、Confluence 及第三方 SaaS。",
        website: "https://www.atlassian.com/software/rovo",
        tutorial: "https://www.atlassian.com/software/rovo/guides/end-user-guide/introduction"
      })
    ]
  },
  {
    id: "microsoft",
    products: [
      toolWeb({
        id: "microsoft-security-copilot",
        name: "Microsoft Security Copilot",
        category: "云服务与运维",
        description: "面向安全与 IT 团队的生成式 AI 产品，支持威胁调查、响应、态势管理和安全 Agent。",
        website: "https://learn.microsoft.com/en-us/copilot/security/workspaces-overview",
        tutorial: "https://learn.microsoft.com/en-us/copilot/security/get-started-security-copilot"
      })
    ]
  },
  {
    id: "sap",
    products: [
      toolWeb({
        id: "sap-joule",
        name: "Joule",
        category: "办公自动化",
        description: "SAP 面向业务系统的企业 AI 助手，按角色和业务权限提供搜索、问答与流程协助。",
        website: "https://www.sap.com/products/artificial-intelligence/ai-assistant.html",
        tutorial: "https://help.sap.com/docs/joule"
      })
    ]
  },
  vendor(
    "cisco",
    "Cisco",
    "C",
    "#049fd9",
    "提供 Webex 协作和企业网络产品。",
    "https://www.cisco.com/",
    "https://help.webex.com/webex-ai",
    [
      connectableDesktop({
        id: "cisco-webex-ai-assistant",
        name: "Webex with Cisco AI Assistant",
        category: "办公自动化",
        description: "Windows Webex 客户端内置 Cisco AI Assistant，覆盖会议、消息和通话摘要；功能按组织管理员和套餐开放。",
        downloadPage: "https://www.webex.com/downloads.html",
        homePage: "https://www.webex.com/ai",
        tutorial: "https://help.webex.com/article/ub8jcj/"
      })
    ]
  ),
  vendor(
    "playcanvas",
    "PlayCanvas",
    "P",
    "#f05a28",
    "提供浏览器 3D 编辑器和游戏开发平台。",
    "https://playcanvas.com/",
    "https://developer.playcanvas.com/user-manual/editor/mcp-server/",
    [
      connectableWeb({
        id: "playcanvas-editor",
        name: "PlayCanvas Editor",
        category: "游戏开发",
        description: "浏览器 3D 编辑器，可通过官方 Editor MCP 由 AI 客户端读取和修改项目；首版仅展示官方连接说明。",
        website: "https://playcanvas.com/",
        tutorial: "https://developer.playcanvas.com/user-manual/editor/mcp-server/"
      })
    ]
  ),
  vendor(
    "vimeo",
    "Vimeo",
    "V",
    "#1ab7ea",
    "提供视频托管、协作和媒体管理服务。",
    "https://vimeo.com/",
    "https://developer.vimeo.com/api/mcp-server",
    [
      connectableWeb({
        id: "vimeo-platform",
        name: "Vimeo Platform",
        category: "视频创作",
        description: "Vimeo 视频平台及官方远程 MCP（Public Beta），用于搜索、管理和分析媒体内容。",
        website: "https://vimeo.com/",
        tutorial: "https://developer.vimeo.com/api/mcp-server"
      })
    ]
  ),
  vendor(
    "cloudinary",
    "Cloudinary",
    "C",
    "#3448c5",
    "提供图像、视频和媒体资产管理平台。",
    "https://cloudinary.com/",
    "https://cloudinary.com/documentation/cloudinary_llm_mcp",
    [
      connectableWeb({
        id: "cloudinary-media-platform",
        name: "Cloudinary Media Platform",
        category: "视频创作",
        description: "媒体资产管理和处理平台，提供官方 MCP 能力；首版以远程连接和最小权限说明为主。",
        website: "https://cloudinary.com/",
        tutorial: "https://cloudinary.com/documentation/cloudinary_llm_mcp"
      })
    ]
  ),
  vendor(
    "onlyoffice",
    "ONLYOFFICE",
    "O",
    "#ff6f00",
    "提供在线文档协作和桌面办公套件。",
    "https://www.onlyoffice.com/",
    "https://api.onlyoffice.com/docspace/mcp-server/getting-started/",
    [
      connectableWeb({
        id: "onlyoffice-docspace",
        name: "ONLYOFFICE DocSpace",
        category: "办公自动化",
        description: "文档协作空间及官方远程 MCP；首版只展示 OAuth 连接和权限说明，不自动执行本地 npm/Docker。",
        website: "https://www.onlyoffice.com/docspace.aspx",
        tutorial: "https://api.onlyoffice.com/docspace/mcp-server/getting-started/"
      })
    ]
  ),
  vendor(
    "airtable",
    "Airtable",
    "A",
    "#18a66b",
    "提供可协作的数据表和业务应用平台。",
    "https://www.airtable.com/",
    "https://support.airtable.com/v1/docs/using-the-airtable-mcp-server",
    [
      connectableWeb({
        id: "airtable-platform",
        name: "Airtable Platform",
        category: "办公自动化",
        description: "可协作数据表平台及官方远程 MCP；连接沿用用户在 Airtable 中已有的角色权限。",
        website: "https://www.airtable.com/",
        tutorial: "https://support.airtable.com/v1/docs/using-the-airtable-mcp-server"
      })
    ]
  ),
  vendor(
    "pandadoc",
    "PandaDoc",
    "P",
    "#2f80ed",
    "提供文档、合同和电子签署工作流。",
    "https://www.pandadoc.com/",
    "https://developers.pandadoc.com/docs/how-to-use-the-pandadoc-mcp-server",
    [
      connectableWeb({
        id: "pandadoc-workspace",
        name: "PandaDoc Workspace",
        category: "办公自动化",
        description: "文档、合同和签署工作流平台及官方远程 MCP；发送、修改和提醒操作必须逐次确认。",
        website: "https://www.pandadoc.com/",
        tutorial: "https://developers.pandadoc.com/docs/how-to-use-the-pandadoc-mcp-server"
      })
    ]
  ),
  vendor(
    "superwhisper",
    "Superwhisper",
    "S",
    "#111827",
    "提供跨应用 AI 语音听写和上下文处理工具。",
    "https://superwhisper.com/",
    "https://superwhisper.com/docs/get-started/windows",
    [
      toolDesktop({
        id: "superwhisper-windows",
        name: "Superwhisper",
        category: "音频创作",
        description: "Windows 10/11 AI 语音听写工具，可在应用中转写和处理上下文；麦克风与上下文访问须由用户授权。",
        downloadPage: "https://superwhisper.com/download",
        homePage: "https://superwhisper.com/windows",
        tutorial: "https://superwhisper.com/docs/get-started/windows"
      })
    ]
  ),
  vendor(
    "screenpipe",
    "screenpipe",
    "S",
    "#111827",
    "提供本地优先的屏幕和音频记录及 Agent 上下文工具。",
    "https://screenpipe.com/",
    "https://github.com/screenpipe/screenpipe",
    [
      toolDesktop({
        id: "screenpipe-desktop",
        name: "screenpipe",
        category: "智能体",
        description: "持续记录并搜索屏幕与音频的本地优先 Windows 工具，可向 Agent 提供上下文；使用前应配置隐私排除项。",
        downloadPage: "https://screenpipe.com/",
        homePage: "https://screenpipe.com/",
        tutorial: "https://github.com/screenpipe/screenpipe"
      })
    ]
  ),
  vendor(
    "pdfgear",
    "PDFgear",
    "P",
    "#2563eb",
    "提供 PDF 编辑、转换、OCR 和 AI 文档问答工具。",
    "https://www.pdfgear.com/",
    "https://www.pdfgear.com/windows-user-guide/download-install-pdfgear-on-windows.htm",
    [
      toolDesktop({
        id: "pdfgear-windows",
        name: "PDFgear",
        category: "文档与知识库",
        description: "Windows PDF 编辑、OCR、转换和 AI 文档问答工具；PDF 聊天与在线更新需要网络。",
        downloadPage: "https://www.pdfgear.com/pdfgear-for-windows/",
        homePage: "https://www.pdfgear.com/",
        tutorial: "https://www.pdfgear.com/windows-user-guide/download-install-pdfgear-on-windows.htm"
      })
    ]
  ),
  vendor(
    "updf",
    "UPDF",
    "U",
    "#645cff",
    "提供跨平台 PDF 编辑和 AI 文档助手。",
    "https://updf.com/",
    "https://updf.com/updf/",
    [
      toolDesktop({
        id: "updf-windows",
        name: "UPDF",
        category: "文档与知识库",
        description: "Windows PDF 编辑、OCR、语义搜索、总结和翻译工具；使用 UPDF AI 时文档可能上传至云端。",
        downloadPage: "https://updf.com/download/",
        homePage: "https://updf.com/updf/",
        tutorial: "https://updf.com/whats-new/"
      })
    ]
  ),
  vendor(
    "vrew",
    "Vrew",
    "V",
    "#7c3aed",
    "提供转录式视频剪辑、字幕、配音和生成式视频工具。",
    "https://vrew.ai/",
    "https://vrew.ai/en/terms-of-service/",
    [
      toolDesktop({
        id: "vrew-desktop",
        name: "Vrew",
        category: "视频创作",
        description: "Windows 视频编辑器，支持 AI 字幕、配音、翻译和文本生成视频；功能受账号、额度和地区版本影响。",
        downloadPage: "https://vrew.ai/es/",
        homePage: "https://vrew.ai/es/",
        tutorial: "https://vrew.ai/en/terms-of-service/"
      })
    ]
  ),
  vendor(
    "voiceai",
    "Voice.ai",
    "V",
    "#8b5cf6",
    "提供实时 AI 变声和声音创作工具。",
    "https://voice.ai/",
    "https://support.voice.ai/",
    [
      toolDesktop({
        id: "voice-ai-windows",
        name: "Voice.ai",
        category: "音频创作",
        description: "Windows 实时 AI 变声和声音克隆工具，会使用麦克风、虚拟音频设备和 GPU；声音必须获得合法授权。",
        downloadPage: "https://voice.ai/platforms/pc",
        homePage: "https://voice.ai/platforms/pc",
        tutorial: "https://support.voice.ai/hc/en-us/articles/8296005604253-What-platforms-is-the-voice-changer-available-on"
      })
    ]
  ),
  vendor(
    "finevoice",
    "FineVoice",
    "F",
    "#ef4444",
    "提供 AI 变声、克隆、TTS、STT 和音频增强工具。",
    "https://finevoice.ai/",
    "https://finevoice.ai/official-website-migration.html",
    [
      toolDesktop({
        id: "finevoice-desktop",
        name: "FineVoice",
        category: "音频创作",
        description: "Windows/macOS AI 语音工作室，支持变声、声音克隆、TTS、STT 和翻译；只使用当前 finevoice.ai 官方域名。",
        downloadPage: "https://finevoice.ai/download",
        homePage: "https://finevoice.ai/",
        tutorial: "https://finevoice.ai/official-website-migration.html"
      })
    ]
  ),
  vendor(
    "gitbutler",
    "GitButler",
    "G",
    "#f97316",
    "提供可视化 Git 分支管理和 AI 辅助开发工具。",
    "https://gitbutler.com/",
    "https://docs.gitbutler.com/releases",
    [
      toolDesktop({
        id: "gitbutler-desktop",
        name: "GitButler",
        category: "编程开发",
        description: "Windows 可视化 Git 客户端，提供 AI 提交信息和本地模型支持；会修改工作树、分支并可能触发 hooks。",
        downloadPage: "https://gitbutler.com/downloads",
        homePage: "https://gitbutler.com/",
        tutorial: "https://docs.gitbutler.com/features/branch-management/ai-assistance"
      })
    ]
  ),
  vendor(
    "affine",
    "AFFiNE",
    "A",
    "#1f2937",
    "提供本地优先的文档、白板和知识库工作空间。",
    "https://affine.pro/",
    "https://affine.pro/download",
    [
      toolDesktop({
        id: "affine-desktop",
        name: "AFFiNE",
        category: "文档与知识库",
        description: "本地优先的 Windows 文档、白板和知识库应用，提供实验性 AI BYOK；本地优先不代表所有 AI 都在本地运行。",
        downloadPage: "https://affine.pro/download",
        homePage: "https://affine.pro/",
        tutorial: "https://affine.pro/blog/whats-new-july-update-2026"
      })
    ]
  ),
  vendor(
    "appflowy",
    "AppFlowy",
    "A",
    "#00b886",
    "提供可自托管的文档、项目和 AI 工作空间。",
    "https://appflowy.com/",
    "https://docs.appflowy.io/docs/appflowy/readme/install-appflowy",
    [
      toolDesktop({
        id: "appflowy-desktop",
        name: "AppFlowy",
        category: "文档与知识库",
        description: "Windows 文档和项目工作空间，提供 AI Overview、会议记录及云端或自托管模型选择。",
        downloadPage: "https://appflowy.com/download",
        homePage: "https://appflowy.com/",
        tutorial: "https://docs.appflowy.io/docs/appflowy/readme/install-appflowy"
      })
    ]
  ),
  vendor(
    "duckduckgo",
    "DuckDuckGo",
    "D",
    "#de5833",
    "提供隐私搜索、浏览器和 Duck.ai 服务。",
    "https://duckduckgo.com/",
    "https://duckduckgo.com/duckduckgo-help-pages/",
    [
      toolDesktop({
        id: "duckduckgo-browser",
        name: "DuckDuckGo Browser",
        category: "浏览器与搜索",
        description: "Windows 隐私浏览器，内置可选 Duck.ai 多模型聊天；Duck.ai 不是独立 Windows 客户端。",
        downloadPage: "https://duckduckgo.com/app",
        homePage: "https://duckduckgo.com/app",
        tutorial: "https://duckduckgo.com/duckduckgo-help-pages/get-duckduckgo/get-duckduckgo-browser-on-windows"
      })
    ]
  ),
  vendor(
    "spark-mail",
    "Spark Mail",
    "S",
    "#2563eb",
    "提供跨平台邮件客户端和 AI 邮件助手。",
    "https://sparkmailapp.com/",
    "https://sparkmailapp.com/help/spark-ai/ai-assistant",
    [
      toolDesktop({
        id: "spark-mail-windows",
        name: "Spark Mail",
        category: "办公自动化",
        description: "Windows 邮件客户端，支持 AI 写作、改写、总结和搜索；AI 功能在中国大陆不可用并涉及邮箱云端处理。",
        downloadPage: "https://sparkmailapp.com/download",
        homePage: "https://sparkmailapp.com/windows",
        tutorial: "https://sparkmailapp.com/help/spark-ai/ai-assistant"
      })
    ]
  ),
  vendor(
    "canarymail",
    "Canary Mail",
    "C",
    "#f5b700",
    "提供安全邮件客户端和可选 AI 邮件功能。",
    "https://canarymail.io/",
    "https://canarymail.io/help/whats-new",
    [
      toolDesktop({
        id: "canary-mail",
        name: "Canary Mail",
        category: "办公自动化",
        description: "Windows 邮件客户端，提供可选 AI 写作和总结能力；需要邮箱、联系人和 Microsoft Store 权限。",
        downloadPage: "https://canarymail.io/downloads",
        homePage: "https://canarymail.io/features",
        tutorial: "https://canarymail.io/help/whats-new"
      })
    ]
  ),
  vendor(
    "movavi",
    "Movavi",
    "M",
    "#8b5cf6",
    "提供视频、照片和多媒体创作软件。",
    "https://www.movavi.com/",
    "https://www.movavi.com/video-editor-plus/whats-new.html",
    [
      toolDesktop({
        id: "movavi-video-editor",
        name: "Movavi Video Editor",
        category: "视频创作",
        description: "Windows 视频编辑器，提供 AI 字幕、降噪、背景移除、运动跟踪和静音删除；功能受版本与套餐限制。",
        downloadPage: "https://www.movavi.com/video-editor-plus/",
        homePage: "https://www.movavi.com/video-editor-plus/",
        tutorial: "https://help.movavi.com/kb/license-usage-rules/ai-features-in-movavi"
      })
    ]
  ),
  vendor(
    "corel",
    "Corel",
    "C",
    "#00a5e5",
    "提供 CorelDRAW 等专业图形设计软件。",
    "https://www.coreldraw.com/",
    "https://www.coreldraw.com/en/support/updates/",
    [
      toolDesktop({
        id: "coreldraw-graphics-suite",
        name: "CorelDRAW Graphics Suite",
        category: "图像与设计",
        description: "Windows 专业设计套件，提供 AI Generate、生成式重混、背景移除和对象选择；AI credits 受许可方案限制。",
        downloadPage: "https://www.coreldraw.com/en/product/coreldraw/",
        homePage: "https://www.coreldraw.com/en/product/coreldraw/",
        tutorial: "https://www.coreldraw.com/en/learn/tutorials/new-in-march-2026/"
      })
    ]
  ),
  vendor(
    "braintrust",
    "Braintrust",
    "B",
    "#111827",
    "提供 AI 应用和 Agent 的评估、可观测性与数据平台。",
    "https://www.braintrust.dev/",
    "https://www.braintrust.dev/docs",
    [
      toolWeb({
        id: "braintrust-platform",
        name: "Braintrust",
        category: "智能体",
        description: "用于 Agent/AI 应用评估、实验、可观测性和数据管理的 Web 平台；官方 bt eval CLI 不标为 Windows CLI。",
        website: "https://www.braintrust.dev/",
        tutorial: "https://www.braintrust.dev/docs/evaluate/run-evaluations"
      })
    ]
  ),
  vendor(
    "agentops",
    "AgentOps",
    "A",
    "#7c3aed",
    "提供 AI Agent 测试、调试和可观测性平台。",
    "https://www.agentops.ai/",
    "https://docs.agentops.ai/v1/introduction",
    [
      toolWeb({
        id: "agentops-platform",
        name: "AgentOps",
        category: "智能体",
        description: "面向 AI Agent 的测试、调试、会话追踪和可观测性 Web 平台；SDK 集成不是独立 Windows 客户端。",
        website: "https://www.agentops.ai/",
        tutorial: "https://docs.agentops.ai/v1/introduction"
      })
    ]
  ),
  vendor(
    "helicone",
    "Helicone",
    "H",
    "#0f172a",
    "提供 LLM 网关、路由、缓存和可观测性平台。",
    "https://www.helicone.ai/",
    "https://docs.helicone.ai/getting-started/platform-overview",
    [
      toolWeb({
        id: "helicone-platform",
        name: "Helicone",
        category: "可观测性",
        description: "面向 LLM/Agent 的网关、路由、缓存和可观测性 Web 平台；自托管与 SDK 仅作为官方说明入口。",
        website: "https://www.helicone.ai/",
        tutorial: "https://docs.helicone.ai/guides/cookbooks/ai-agents"
      })
    ]
  ),
  vendor(
    "mod-io",
    "mod.io",
    "M",
    "#111827",
    "提供游戏 UGC、模组、审核和分发平台。",
    "https://mod.io/",
    "https://docs.mod.io/getting-started",
    [
      connectableWeb({
        id: "mod-io-platform",
        name: "mod.io Platform",
        category: "游戏开发",
        description: "游戏 UGC 和模组平台，提供官方 REST API 与 SDK，可把外部 AI 服务接入内容审核流程；当前未声明官方 MCP。",
        website: "https://mod.io/",
        tutorial: "https://docs.mod.io/restapi/introduction"
      })
    ]
  ),
  vendor(
    "assemblyai",
    "AssemblyAI",
    "A",
    "#0f172a",
    "提供语音识别、理解和实时 Voice AI API。",
    "https://www.assemblyai.com/",
    "https://www.assemblyai.com/docs/api-reference/overview/",
    [
      connectableWeb({
        id: "assemblyai-voice-ai-platform",
        name: "AssemblyAI Voice AI Platform",
        category: "音频创作",
        description: "提供录音转写、实时 WebSocket、语音理解和 Voice Agent API；官方 MCP 当前用于检索文档，不操作账户任务。",
        website: "https://www.assemblyai.com/",
        tutorial: "https://www.assemblyai.com/docs/api-reference/overview/"
      })
    ]
  ),
  vendor(
    "livekit",
    "LiveKit",
    "L",
    "#111827",
    "提供实时音视频基础设施和 Voice Agent 框架。",
    "https://livekit.io/",
    "https://docs.livekit.io/intro/about/",
    [
      connectableWeb({
        id: "livekit-cloud-agents",
        name: "LiveKit Cloud + Agents",
        category: "音频创作",
        description: "实时音视频云平台与 Agent SDK；SDK 可消费外部 MCP，官方 Docs MCP 仅检索文档，不等于平台控制接口。",
        website: "https://livekit.io/",
        tutorial: "https://docs.livekit.io/intro/about/"
      })
    ]
  ),
  vendor(
    "anydesk",
    "AnyDesk",
    "A",
    "#ef443b",
    "提供远程桌面、设备和会话管理产品。",
    "https://anydesk.com/",
    "https://support.anydesk.com/docs/rest-api",
    [
      connectableDesktop({
        id: "anydesk-windows",
        name: "AnyDesk",
        category: "远程控制",
        description: "Windows 远程桌面客户端；官方 REST API 仅管理 my.anydesk 设备和会话元数据，不代表 AI 可直接接管交互式桌面。",
        downloadPage: "https://anydesk.com/en/downloads/windows",
        homePage: "https://anydesk.com/",
        tutorial: "https://support.anydesk.com/docs/rest-api"
      })
    ]
  ),
  vendor(
    "tripo",
    "Tripo AI",
    "T",
    "#6d28d9",
    "提供 AI 生成 3D 模型和开发者 OpenAPI。",
    "https://www.tripo3d.ai/",
    "https://docs.tripo3d.ai/get-started/introduction.html",
    [
      toolWeb({
        id: "tripo-studio",
        name: "Tripo AI",
        category: "3D 创作",
        description: "在线 AI 3D 生成平台，可从文本或图像创建模型并进行后处理。",
        website: "https://www.tripo3d.ai/",
        tutorial: "https://www.tripo3d.ai/"
      }),
      connectableWeb({
        id: "tripo-openapi",
        name: "Tripo OpenAPI",
        category: "3D 创作",
        description: "异步 3D 生成 API；调用会消耗 credits，结果下载链接短期有效，密钥和成果归档须由接入方管理。",
        website: "https://docs.tripo3d.ai/get-started/introduction.html",
        tutorial: "https://docs.tripo3d.ai/get-started/pricing.html"
      })
    ]
  ),
  vendor(
    "docling-project",
    "Docling Project",
    "D",
    "#111827",
    "提供开源文档解析、转换和 AI 工作流工具。",
    "https://github.com/docling-project/docling",
    "https://github.com/docling-project/docling-mcp",
    [
      connectableWeb({
        id: "docling",
        name: "Docling",
        category: "文档与知识库",
        description: "LF AI & Data 托管的开源文档解析项目，提供项目官方 MCP；本地运行会读取文件并下载依赖，首版仅展示说明。",
        website: "https://github.com/docling-project/docling",
        tutorial: "https://github.com/docling-project/docling-mcp"
      })
    ]
  ),
  vendor(
    "tailscale",
    "Tailscale",
    "T",
    "#242424",
    "提供基于身份的私网连接和安全访问基础设施。",
    "https://tailscale.com/",
    "https://tailscale.com/docs/aperture/mcp-server",
    [
      connectableWeb({
        id: "tailscale-aperture",
        name: "Tailscale Aperture",
        category: "云服务与运维",
        description: "Tailscale 的 MCP Server Proxy（Alpha），用于在用户自己的 tailnet 中聚合和授权远程 MCP；没有公共统一端点。",
        website: "https://tailscale.com/docs/aperture/mcp-server",
        tutorial: "https://tailscale.com/use-cases/secure-ai-agent-connectivity"
      })
    ]
  ),
  vendor(
    "spline",
    "Spline",
    "S",
    "#665cf6",
    "提供浏览器交互式 3D 设计和发布平台。",
    "https://spline.design/",
    "https://docs.spline.design/basics/what-is-spline",
    [
      connectableWeb({
        id: "spline-platform",
        name: "Spline",
        category: "3D 创作",
        description: "浏览器交互式 3D 设计平台，可通过 AI Voice Assistant API 触发预定义场景动作；该接口不是通用 Spline MCP。",
        website: "https://spline.design/",
        tutorial: "https://docs.spline.design/interaction-states-events-and-actions/ai-voice-assistant-api"
      })
    ]
  )
];

const resourceDefinitions = [
  {
    id: "playcanvas-editor-mcp",
    name: "PlayCanvas Editor MCP",
    resourceTypes: ["mcp"],
    description: "PlayCanvas 官方本地 Editor MCP，可让兼容 AI 工具读取和修改当前编辑器项目；执行前应建立项目 checkpoint。",
    website: "https://developer.playcanvas.com/user-manual/editor/mcp-server/",
    tutorial: "https://developer.playcanvas.com/user-manual/editor/mcp-server/",
    publisherVendorId: "playcanvas",
    publisher: "PlayCanvas",
    sourceKind: "official",
    sourceProductIds: ["playcanvas-editor"],
    targets: [
      resourceTarget("codex-cli"),
      resourceTarget("claude-code"),
      resourceTarget("claude-desktop"),
      resourceTarget("cursor-desktop")
    ],
    versionRef: "rolling-official-docs",
    requestedPermissions: [
      "可读取和修改当前 PlayCanvas Editor 项目；删除实体、资产、构建或分支前必须确认。"
    ],
    credentialRequirements: [
      "使用已登录的 PlayCanvas Editor 会话；目录不保存账号或项目凭据。"
    ],
    installScope: "仅打开官方 MCP 配置说明；当前不执行 npx 或写入目标 AI 工具配置。",
    uninstallPlan: "从目标 AI 工具删除 MCP 连接；保留 PlayCanvas 项目、编辑器数据和 checkpoint。",
    provenanceEvidence: [
      "https://developer.playcanvas.com/user-manual/editor/mcp-server/"
    ],
    lastVerifiedAt: "2026-08-03T00:00:00.000Z"
  },
  {
    id: "vimeo-mcp-server",
    name: "Vimeo MCP Server",
    resourceTypes: ["mcp"],
    description: "Vimeo 官方远程 MCP（Public Beta），用于搜索、管理和分析用户有权访问的视频内容。",
    website: "https://developer.vimeo.com/api/mcp-server",
    tutorial: "https://developer.vimeo.com/api/mcp-server",
    publisherVendorId: "vimeo",
    publisher: "Vimeo",
    sourceKind: "official",
    sourceProductIds: ["vimeo-platform"],
    targets: [
      resourceTarget("chatgpt-desktop", "protocol-compatible"),
      resourceTarget("claude-desktop", "protocol-compatible"),
      resourceTarget("codex-cli", "protocol-compatible")
    ],
    versionRef: "public-beta-rolling-service",
    requestedPermissions: [
      "读取视频、分析、转录和展示信息；修改隐私、团队权限、章节或评论前必须确认。"
    ],
    credentialRequirements: [
      "Vimeo OAuth 和适用会员方案；目录不保存令牌。"
    ],
    installScope: "仅打开官方远程 MCP 接入说明；当前不写入本地配置。",
    uninstallPlan: "从目标 AI 工具删除连接并在 Vimeo 撤销 OAuth；保留视频、团队和分析数据。",
    provenanceEvidence: [
      "https://developer.vimeo.com/api/mcp-server",
      "https://developer.vimeo.com/"
    ],
    lastVerifiedAt: "2026-08-03T00:00:00.000Z"
  },
  {
    id: "cloudinary-mcp-servers",
    name: "Cloudinary MCP Servers",
    resourceTypes: ["mcp"],
    description: "Cloudinary 官方媒体资产、配置、元数据、分析和 MediaFlows MCP 入口。",
    website: "https://cloudinary.com/documentation/cloudinary_llm_mcp",
    tutorial: "https://cloudinary.com/documentation/cloudinary_llm_mcp",
    publisherVendorId: "cloudinary",
    publisher: "Cloudinary",
    sourceKind: "official",
    sourceProductIds: ["cloudinary-media-platform"],
    targets: [
      resourceTarget("claude-desktop", "protocol-compatible"),
      resourceTarget("codex-cli", "protocol-compatible"),
      resourceTarget("cursor-desktop", "protocol-compatible"),
      resourceTarget("windsurf-editor", "protocol-compatible")
    ],
    versionRef: "rolling-official-service",
    requestedPermissions: [
      "默认只读检索；上传、重命名、删除资产或修改环境、webhook、元数据结构和流程前必须确认。"
    ],
    credentialRequirements: [
      "优先使用远程 OAuth；API key 只能由系统凭据存储或目标工具管理。"
    ],
    installScope: "仅打开官方接入说明；当前不自动运行本地 MCP 包。",
    uninstallPlan: "删除目标 AI 工具连接并撤销 OAuth/API key；保留媒体资产、元数据和流程。",
    provenanceEvidence: [
      "https://cloudinary.com/documentation/cloudinary_llm_mcp"
    ],
    lastVerifiedAt: "2026-08-03T00:00:00.000Z"
  },
  {
    id: "onlyoffice-docspace-mcp",
    name: "ONLYOFFICE DocSpace MCP",
    resourceTypes: ["mcp"],
    description: "ONLYOFFICE 官方 DocSpace MCP，可连接房间、文件、成员和权限工作流。",
    website: "https://api.onlyoffice.com/docspace/mcp-server/getting-started/",
    tutorial: "https://api.onlyoffice.com/docspace/mcp-server/getting-started/clients/",
    publisherVendorId: "onlyoffice",
    publisher: "ONLYOFFICE",
    sourceKind: "official",
    sourceProductIds: ["onlyoffice-docspace"],
    targets: [
      resourceTarget("chatgpt-desktop", "protocol-compatible"),
      resourceTarget("claude-desktop", "protocol-compatible"),
      resourceTarget("codex-cli", "protocol-compatible"),
      resourceTarget("cursor-desktop", "protocol-compatible")
    ],
    versionRef: "rolling-official-service",
    requestedPermissions: [
      "默认只读；复制、移动、重命名、删除文件以及修改成员和权限前必须确认。"
    ],
    credentialRequirements: [
      "远程模式使用 OAuth；本地模式所需 DocSpace URL 和 API key 不写入目录。"
    ],
    installScope: "仅打开官方远程 MCP 接入说明；当前不执行 npm 或 Docker。",
    uninstallPlan: "删除目标 AI 工具连接并撤销 DocSpace 授权；保留房间、成员、文件和审计记录。",
    provenanceEvidence: [
      "https://api.onlyoffice.com/docspace/mcp-server/getting-started/",
      "https://api.onlyoffice.com/docspace/mcp-server/getting-started/clients/"
    ],
    lastVerifiedAt: "2026-08-03T00:00:00.000Z"
  },
  {
    id: "airtable-mcp-server",
    name: "Airtable MCP Server",
    resourceTypes: ["mcp"],
    description: "Airtable 官方远程 MCP，通过 OAuth 按用户现有角色连接工作区、base、schema 和记录。",
    website: "https://support.airtable.com/v1/docs/using-the-airtable-mcp-server",
    tutorial: "https://support.airtable.com/v1/docs/using-the-airtable-mcp-server",
    publisherVendorId: "airtable",
    publisher: "Airtable",
    sourceKind: "official",
    sourceProductIds: ["airtable-platform"],
    targets: [
      resourceTarget("chatgpt-desktop"),
      resourceTarget("claude-desktop"),
      resourceTarget("codex-cli"),
      resourceTarget("cursor-desktop")
    ],
    versionRef: "rolling-official-service",
    requestedPermissions: [
      "继承用户 Airtable 角色；创建 base、修改 schema、批量写记录或评论前必须确认。"
    ],
    credentialRequirements: [
      "Airtable OAuth；授权前展示 records、schema、comments 和 workspaces scopes。"
    ],
    installScope: "仅打开 Airtable 官方 OAuth MCP 接入说明；当前不写入目标工具配置。",
    uninstallPlan: "删除目标 AI 工具连接并在 Airtable 撤销 OAuth；不删除 base、table 或记录。",
    provenanceEvidence: [
      "https://support.airtable.com/v1/docs/using-the-airtable-mcp-server"
    ],
    lastVerifiedAt: "2026-08-03T00:00:00.000Z"
  },
  {
    id: "pandadoc-mcp-server",
    name: "PandaDoc MCP Server",
    resourceTypes: ["mcp"],
    description: "PandaDoc 官方远程 MCP，可搜索、创建、更新、发送和分析文档工作流。",
    website: "https://developers.pandadoc.com/docs/how-to-use-the-pandadoc-mcp-server",
    tutorial: "https://developers.pandadoc.com/docs/getting-started-with-mcp",
    publisherVendorId: "pandadoc",
    publisher: "PandaDoc",
    sourceKind: "official",
    sourceProductIds: ["pandadoc-workspace"],
    targets: [
      resourceTarget("chatgpt-desktop"),
      resourceTarget("claude-desktop"),
      resourceTarget("codex-cli"),
      resourceTarget("cursor-desktop"),
      resourceTarget("microsoft-vscode")
    ],
    versionRef: "rolling-official-service",
    requestedPermissions: [
      "默认搜索和查看；创建、更新、发送、提醒或触发签署流程前必须显示文档、收件人和影响并确认。"
    ],
    credentialRequirements: [
      "PandaDoc OAuth；目录不保存访问令牌。"
    ],
    installScope: "仅打开官方远程 MCP 接入说明；当前不写入本地配置。",
    uninstallPlan: "删除目标 AI 工具连接并撤销 PandaDoc OAuth；保留 workspace、模板、文档、签名和审计记录。",
    provenanceEvidence: [
      "https://developers.pandadoc.com/docs/how-to-use-the-pandadoc-mcp-server",
      "https://developers.pandadoc.com/docs/getting-started-with-mcp"
    ],
    lastVerifiedAt: "2026-08-03T00:00:00.000Z"
  },
  {
    id: "assemblyai-docs-mcp",
    name: "AssemblyAI Docs MCP",
    resourceTypes: ["mcp"],
    description: "AssemblyAI 官方文档 MCP，只检索产品文档和示例，不提交转写任务或操作用户账户。",
    website: "https://www.assemblyai.com/docs/coding-agent-prompts",
    tutorial: "https://www.assemblyai.com/docs/coding-agent-prompts",
    publisherVendorId: "assemblyai",
    publisher: "AssemblyAI",
    sourceKind: "official",
    sourceProductIds: ["assemblyai-voice-ai-platform"],
    targets: [
      resourceTarget("codex-cli", "protocol-compatible"),
      resourceTarget("claude-code", "protocol-compatible"),
      resourceTarget("cursor-desktop", "protocol-compatible")
    ],
    versionRef: "rolling-official-docs",
    requestedPermissions: [
      "仅搜索和读取 AssemblyAI 官方文档；不授予 API 任务或账户写权限。"
    ],
    credentialRequirements: [
      "文档 MCP 不需要 AssemblyAI API key；真实语音 API 凭据不由目录保存。"
    ],
    installScope: "仅打开官方文档 MCP 说明；当前不写入目标工具配置。",
    uninstallPlan: "从目标 AI 工具删除文档 MCP 连接；不影响 AssemblyAI 账户或 API 项目。",
    provenanceEvidence: [
      "https://www.assemblyai.com/docs/coding-agent-prompts"
    ],
    lastVerifiedAt: "2026-08-03T00:00:00.000Z"
  },
  {
    id: "livekit-docs-mcp",
    name: "LiveKit Docs MCP",
    resourceTypes: ["mcp"],
    description: "LiveKit 官方文档 MCP，只检索文档、示例和更新记录，不控制房间、媒体或 Agent 部署。",
    website: "https://docs.livekit.io/reference/developer-tools/docs-mcp/",
    tutorial: "https://docs.livekit.io/reference/developer-tools/docs-mcp/",
    publisherVendorId: "livekit",
    publisher: "LiveKit",
    sourceKind: "official",
    sourceProductIds: ["livekit-cloud-agents"],
    targets: [
      resourceTarget("codex-cli", "protocol-compatible"),
      resourceTarget("claude-code", "protocol-compatible"),
      resourceTarget("cursor-desktop", "protocol-compatible")
    ],
    versionRef: "rolling-official-docs",
    requestedPermissions: [
      "仅搜索和读取 LiveKit 官方文档；不授予房间、媒体、电话或 Agent 控制权限。"
    ],
    credentialRequirements: [
      "文档 MCP 不使用 LiveKit 项目凭据；真实云项目凭据不由目录保存。"
    ],
    installScope: "仅打开官方文档 MCP 说明；当前不写入目标工具配置。",
    uninstallPlan: "从目标 AI 工具删除文档 MCP 连接；不影响 LiveKit Cloud 项目和运行中会话。",
    provenanceEvidence: [
      "https://docs.livekit.io/reference/developer-tools/docs-mcp/"
    ],
    lastVerifiedAt: "2026-08-03T00:00:00.000Z"
  },
  {
    id: "docling-mcp",
    name: "Docling MCP",
    resourceTypes: ["mcp"],
    description: "Docling 项目官方开源 MCP，可连接 Docling Serve 或在本地解析和转换文档。",
    website: "https://github.com/docling-project/docling-mcp",
    tutorial: "https://github.com/docling-project/docling-mcp",
    publisherVendorId: "docling-project",
    publisher: "Docling Project",
    sourceKind: "official",
    sourceProductIds: ["docling"],
    targets: [
      resourceTarget("codex-cli", "protocol-compatible"),
      resourceTarget("claude-code", "protocol-compatible"),
      resourceTarget("claude-desktop", "protocol-compatible"),
      resourceTarget("cursor-desktop", "protocol-compatible")
    ],
    versionRef: "rolling-official-repository",
    requestedPermissions: [
      "本地模式会读取用户选择的文件或 URL、下载依赖并生成缓存和输出；操作范围必须由用户确认。"
    ],
    credentialRequirements: [
      "连接 Docling Serve 时由目标工具管理服务地址和凭据；目录不保存秘密。"
    ],
    installScope: "仅打开项目官方仓库；当前不执行 pip、uvx、模型下载或本地服务器启动。",
    uninstallPlan: "从目标 AI 工具删除连接；保留用户文档、输出、Docling Serve 和未由 AI Hub 创建的缓存。",
    provenanceEvidence: [
      "https://github.com/docling-project/docling-mcp",
      "https://github.com/docling-project/docling"
    ],
    lastVerifiedAt: "2026-08-03T00:00:00.000Z"
  },
  {
    id: "tailscale-aperture-mcp-proxy",
    name: "Tailscale Aperture MCP Proxy",
    resourceTypes: ["mcp"],
    description: "Tailscale 官方 MCP Server Proxy（Alpha），在用户自己的 tailnet 中聚合、发现和授权远程 MCP。",
    website: "https://tailscale.com/docs/aperture/mcp-server",
    tutorial: "https://tailscale.com/docs/aperture/mcp-server",
    publisherVendorId: "tailscale",
    publisher: "Tailscale",
    sourceKind: "official",
    sourceProductIds: ["tailscale-aperture"],
    targets: [
      resourceTarget("codex-cli", "protocol-compatible"),
      resourceTarget("claude-code", "protocol-compatible"),
      resourceTarget("claude-desktop", "protocol-compatible")
    ],
    versionRef: "alpha-rolling-service",
    requestedPermissions: [
      "按用户 tailnet grants 和动态工具发现暴露 MCP；每个下游服务仍需单独审核权限。"
    ],
    credentialRequirements: [
      "需要用户自己的 tailnet、Aperture 主机和身份配置；不存在可预置的公共端点。"
    ],
    installScope: "仅打开 Alpha 文档；当前不部署 Aperture、不写入端点，也不配置 tailnet。",
    uninstallPlan: "从目标 AI 工具删除连接，并由用户在自己的 tailnet 中停用 Aperture；不修改其他 Tailscale 设备。",
    provenanceEvidence: [
      "https://tailscale.com/docs/aperture/mcp-server",
      "https://tailscale.com/use-cases/secure-ai-agent-connectivity"
    ],
    lastVerifiedAt: "2026-08-03T00:00:00.000Z"
  }
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

let nextResourceOrder =
  Math.max(-1, ...catalog.resources.map((resource) => resource.order ?? 0)) + 1;
for (const definition of resourceDefinitions) {
  const existing = catalog.resources.find((resource) => resource.id === definition.id);
  if (existing) applyDefinition(existing, definition, ["enabled", "order"]);
  else {
    catalog.resources.push({
      ...definition,
      enabled: true,
      order: nextResourceOrder++
    });
  }
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
