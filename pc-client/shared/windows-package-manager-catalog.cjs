"use strict";

const { sha256Hex } = require("./sha256-portable.cjs");

// Product IDs and package IDs are both client-owned. The backend may select a
// profile, but it cannot supply a package ID, source, argument or command.
const ROWS = Object.freeze([
  ["acdsee-photo-studio-ultimate", "acd-systems", "ACDSystems.ACDSeePhotoStudio.Ultimate", "ACDSee Photo Studio Ultimate", "https://www.acdsee.com/en/products/photo-studio-ultimate/"],
  ["adobe-acrobat-reader-ai", "adobe", "Adobe.Acrobat.Reader.64-bit", "Adobe Acrobat Reader", "https://www.adobe.com/acrobat/pdf-reader.html"],
  ["adobe-creative-cloud", "adobe", "Adobe.CreativeCloud", "Adobe Creative Cloud", "https://www.adobe.com/download/creative-cloud"],
  ["affine-desktop", "affine", "ToEverything.AFFiNE", "AFFiNE", "https://affine.pro/download"],
  ["affinity", "canva", "Canva.Affinity", "Affinity", "https://www.affinity.studio/"],
  ["airtable-platform", "airtable", "Formagrid.Airtable", "Airtable", "https://www.airtable.com/windows"],
  ["alibaba-dingtalk-ai", "alibaba", "Alibaba.DingTalk.Mainland", "DingTalk", "https://www.dingtalk.com/download?isLite=0"],
  ["alibaba-quark-ai-browser", "alibaba", "Alibaba.Quark", "夸克", "https://www.quark.cn/", "winget", ["夸克"], ["https://download.quark.cn/download/quarkpc?ch=pcquark@default"]],
  ["anydesk-windows", "anydesk", "AnyDesk.AnyDesk", "AnyDesk", "https://anydesk.com/en/downloads/windows"],
  ["anytype-desktop", "anytype", "AnyAssociation.Anytype", "Anytype", "https://anytype.io/downloads"],
  ["appflowy-desktop", "appflowy", "AppFlowy.AppFlowy", "AppFlowy", "https://appflowy.com/download"],
  ["asana-work-graph", "asana", "Asana.Asana", "Asana", "https://asana.com/download"],
  ["audacity-desktop", "audacity", "Audacity.Audacity", "Audacity", "https://www.audacityteam.org/download/windows/"],
  ["audiate", "techsmith", "TechSmith.Audiate", "Camtasia Audiate", "https://www.techsmith.com/camtasia/audiate/download/download-audiate-win/"],
  ["autodesk-fusion", "autodesk", "Autodesk.Fusion", "Autodesk Fusion", "https://www.autodesk.com/products/fusion-360/"],
  ["blender", "blender", "BlenderFoundation.Blender", "Blender", "https://www.blender.org/download/"],
  ["block-buzz", "block", "ChidiWilliams.Buzz", "Buzz", "https://block.github.io/buzz/support.html"],
  ["box-content-cloud", "box", "Box.Box", "Box", "https://www.box.com/drive"],
  ["brave-browser-leo", "brave", "Brave.Brave", "Brave", "https://brave.com/download/"],
  ["browseros-desktop", "browseros", "BrowserOS.BrowserOS", "BrowserOS", "https://browseros.com/"],
  ["bytedance-capcut-desktop", "bytedance", "ByteDance.CapCut", "CapCut", "https://www.capcut.com/tools/desktop-video-editor"],
  ["bytedance-feishu", "bytedance", "ByteDance.Feishu", "Feishu", "https://www.feishu.cn/download?lang=zh-CN"],
  ["bytedance-ui-tars-desktop", "bytedance", "ByteDance.UI-TARS", "UI TARS", "https://github.com/bytedance/UI-TARS-desktop/releases/latest"],
  ["camtasia", "techsmith", "TechSmith.Camtasia", "Camtasia", "https://www.techsmith.com/download/camtasia/"],
  ["canva-windows", "canva", "Canva.Canva", "Canva", "https://www.canva.com/en_in/download/windows/"],
  ["chatbox-desktop", "chatboxai", "Bin-Huang.Chatbox", "Chatbox", "https://chatboxai.app/en/install"],
  ["cherry-studio", "cherryhq", "kangfenmao.CherryStudio", "Cherry Studio", "https://cherry-ai.com/download"],
  ["clickup-workspace", "clickup", "ClickUp.ClickUp", "ClickUp", "https://clickup.com/download"],
  ["craft-desktop", "craft", "LukiLabs.Craft", "Craft", "https://www.craft.do/download"],
  ["deepchat-desktop", "thinkinai", "ThinkInAIXYZ.DeepChat", "DeepChat", "https://github.com/ThinkInAIXYZ/deepchat/releases/latest"],
  ["deepl-desktop", "deepl", "DeepL.DeepL", "DeepL", "https://www.deepl.com/en/windows-app"],
  ["descript-desktop", "descript", "Descript.Descript", "Descript", "https://www.descript.com/download/windows"],
  ["dialpad-desktop", "dialpad", "Dialpad.Dialpad", "Dialpad", "https://www.dialpad.com/download/"],
  ["discord-desktop", "discord", "Discord.Discord", "Discord", "https://discord.com/download"],
  ["docker-desktop", "docker", "Docker.DockerDesktop", "Docker Desktop", "https://www.docker.com/products/docker-desktop/"],
  ["duckduckgo-browser", "duckduckgo", "DuckDuckGo.DesktopBrowser", "DuckDuckGo", "https://duckduckgo.com/app"],
  ["endnote-2025", "clarivate", "ClarivateAnalytics.EndNote", "EndNote 2025", "https://endnote.com/downloads/"],
  ["evernote-desktop", "evernote", "Evernote.Evernote", "Evernote", "https://evernote.com/download"],
  ["excire-foto", "excire", "PRC.ExcireFoto", "Excire Foto", "https://support.excire.com/portal/en/kb/articles/download-excire-foto-2025"],
  ["factory-droids", "factory-ai", "FactoryAI.Factory", "Factory", "https://factory.ai/product/desktop"],
  ["fathom-desktop", "fathom", "Fathom.Fathom", "Fathom", "https://fathom.video/download/win"],
  ["fellow-desktop", "fellow", "FellowInsights.Fellow", "Fellow", "https://fellow.app/download"],
  ["figma-design", "figma", "Figma.Figma", "Figma", "https://www.figma.com/downloads/"],
  ["fiveire-desktop", "fiveire", "Ironben.5ire", "5ire", "https://5ire.app/"],
  ["fotor-windows", "fotor", "fotor.fotor", "Fotor", "https://www.fotor.com/windows/index.html"],
  ["gitbutler-desktop", "gitbutler", "GitButler.GitButler", "GitButler", "https://gitbutler.com/downloads"],
  ["gitkraken-desktop", "gitkraken", "Axosoft.GitKraken", "GitKraken", "https://www.gitkraken.com/download"],
  ["godot-engine", "godot", "GodotEngine.GodotEngine", "Godot Engine", "https://godotengine.org/download/windows/"],
  ["google-android-studio", "google", "Google.AndroidStudio", "Android Studio", "https://developer.android.com/studio"],
  ["google-chrome-devtools", "google", "Google.Chrome", "Google Chrome", "https://www.google.com/chrome/download-chrome/"],
  ["grammarly-windows", "grammarly", "Grammarly.Grammarly", "Grammarly for Windows", "https://www.grammarly.com/desktop/windows"],
  ["granola-desktop", "granola", "Granola.Granola", "Granola", "https://www.granola.ai/"],
  ["jetbrains-intellij-idea", "jetbrains", "JetBrains.IntelliJIDEA", "IntelliJ IDEA", "https://www.jetbrains.com/idea/download/?section=windows"],
  ["knime-analytics-platform", "knime", "KNIMEAG.KNIMEAnalyticsPlatform", "KNIME Analytics Platform", "https://www.knime.com/get-started"],
  ["lens-desktop", "lens", "Mirantis.Lens", "Lens", "https://k8slens.dev/download"],
  ["linear-workspace", "linear", "LinearOrbit.Linear", "Linear", "https://linear.app/download"],
  ["lobehub-desktop", "lobehub", "LobeHub.LobeHub", "LobeHub", "https://github.com/lobehub/lobehub/releases/latest"],
  ["microsoft-365-copilot", "microsoft", "Microsoft.365Copilot", "Microsoft 365 Copilot", "https://support.microsoft.com/en-us/microsoft-365-copilot/access-microsoft-365-copilot-on-windows"],
  ["microsoft-edge-ai", "microsoft", "Microsoft.Edge", "Microsoft Edge", "https://www.microsoft.com/en-us/edge/download"],
  ["microsoft-power-bi-desktop", "microsoft", "Microsoft.PowerBI", "Microsoft PowerBI Desktop", "https://www.microsoft.com/en-us/download/details.aspx?id=58494"],
  ["miro-workspace", "miro", "Miro.Miro", "Miro", "https://miro.com/apps/"],
  ["moises-desktop", "moises", "Moises.Moises", "Moises", "https://moises.ai/products/moises-desktop-app/"],
  ["monday-work-management", "monday", "monday.monday", "monday", "https://support.monday.com/hc/en-us/articles/115005316885-monday-com-s-desktop-app"],
  ["mongodb-compass", "mongodb", "MongoDB.Compass.Full", "MongoDB Compass", "https://www.mongodb.com/try/download/compass"],
  ["monica-desktop", "monica", "ButterflyEffect.Monica", "Monica", "https://monica.im/download"],
  ["motion-desktop", "motion", "Nexusbird.Motion", "Motion", "https://www.usemotion.com/download"],
  ["movavi-video-editor", "movavi", "Movavi.MovaviVideoEditor", "Movavi Video Editor", "https://www.movavi.com/video-editor-plus/"],
  ["mozilla-firefox", "mozilla", "Mozilla.Firefox", "Mozilla Firefox", "https://www.firefox.com/en-US/download/windows/"],
  ["msty-studio", "msty", "CloudStack.Msty", "Msty", "https://msty.ai/products/studio/"],
  ["navicat-premium", "navicat", "PremiumSoft.NavicatPremium", "Navicat Premium", "https://www.navicat.com/en/download/navicat-premium"],
  ["neo4j-desktop", "neo4j", "Neo4j.Neo4jDesktop", "Neo4j Desktop", "https://neo4j.com/download/"],
  ["notion-desktop", "notion", "Notion.Notion", "Notion", "https://www.notion.com/desktop"],
  ["obs-studio", "obs-project", "OBSProject.OBSStudio", "OBS Studio", "https://obsproject.com/download"],
  ["obsidian-desktop", "obsidian", "Obsidian.Obsidian", "Obsidian", "https://obsidian.md/download"],
  ["open-webui", "openwebui", "OpenWebUI.OpenWebUI", "Open WebUI", "https://github.com/open-webui/desktop/releases/latest"],
  ["opera-one", "opera", "Opera.Opera", "Opera Stable", "https://www.opera.com/one"],
  ["orange-data-mining-desktop", "orange-data-mining", "UniversityOfLjubljana.Orange", "Orange", "https://orangedatamining.com/download/"],
  ["pdfgear-windows", "pdfgear", "PDFgear.PDFgear", "PDFgear", "https://www.pdfgear.com/pdfgear-for-windows/"],
  ["perplexity-comet", "perplexity", "Perplexity.Comet", "Comet", "https://www.perplexity.ai/comet"],
  ["perplexity-web", "perplexity", "Perplexity.Perplexity", "Perplexity", "https://www.perplexity.ai/platforms"],
  ["pinokio-ai-browser", "pinokio", "pinokiocomputer.pinokio", "Pinokio", "https://github.com/pinokiocomputer/pinokio/releases/latest"],
  ["poe", "quora", "Quora.Poe", "Poe", "https://poe.com/download"],
  ["postman-api-platform", "postman", "Postman.Postman", "Postman", "https://www.postman.com/downloads/"],
  ["qupath-desktop", "qupath", "UniversityOfEdinburgh.QuPath", "QuPath", "https://github.com/qupath/qupath/releases"],
  ["redis-insight", "redis", "RedisInsight.RedisInsight", "Redis Insight", "https://redis.io/docs/latest/operate/redisinsight/install/install-on-desktop/"],
  ["roblox-studio", "roblox", "Roblox.RobloxStudio", "Roblox Studio", "https://create.roblox.com/docs/studio/setup"],
  ["skywork-desktop", "skywork", "Skywork.SkyworkDesktop.WSL2", "Skywork Desktop", "https://skywork.ai/desktop/zh/index.html"],
  ["slack-workspace", "slack", "SlackTechnologies.Slack", "Slack", "https://slack.com/downloads/windows"],
  ["streamlabs-desktop", "streamlabs", "Streamlabs.Streamlabs", "Streamlabs Desktop", "https://streamlabs.com/desktop"],
  ["superwhisper-windows", "superwhisper", "SuperUltra.superwhisper", "superwhisper", "https://superwhisper.com/download"],
  ["tableau-desktop", "salesforce", "Tableau.Desktop", "Tableau Desktop", "https://www.tableau.com/support/releases"],
  ["taskade-workspace", "taskade", "Taskcade.Taskade", "Taskade", "https://www.taskade.com/downloads"],
  ["teamviewer-remote-ai", "teamviewer", "TeamViewer.TeamViewer", "TeamViewer", "https://www.teamviewer.com/en/download/windows/"],
  ["tencent-qq-ai-browser", "tencent", "Tencent.QQBrowser", "QQ浏览器", "https://browser.qq.com/"],
  ["termius-desktop", "termius", "Termius.Termius", "Termius", "https://termius.com/download/windows"],
  ["topaz-gigapixel", "topazlabs", "TopazLabs.TopazGigapixelAI", "Topaz Gigapixel AI", "https://www.topazlabs.com/downloads"],
  ["topaz-photo", "topazlabs", "TopazLabs.TopazPhotoAI", "Topaz Photo AI", "https://www.topazlabs.com/downloads"],
  ["topaz-video", "topazlabs", "TopazLabs.TopazVideoEnhanceAI", "Topaz Video Enhance AI", "https://www.topazlabs.com/downloads"],
  ["updf-windows", "updf", "Superace.UPDF", "UPDF", "https://updf.com/download/"],
  ["upscayl-desktop", "upscayl", "Upscayl.Upscayl", "Upscayl", "https://upscayl.org/download"],
  ["vrew-desktop", "vrew", "VoyagerX.Vrew", "Vrew", "https://vrew.ai/es/"],
  ["warp-windows", "warp", "Warp.Warp", "Warp", "https://www.warp.dev/windows-terminal"],
  ["windsurf-editor", "windsurf", "Codeium.Windsurf", "Windsurf", "https://windsurf.com/"],
  ["wondershare-edrawmax", "wondershare", "EdrawSoft.EdrawMax.CN", "EdrawMax", "https://edraw.wondershare.cn/download/"],
  ["wondershare-edrawmind", "wondershare", "EdrawSoft.EdrawMind", "EdrawMind", "https://edraw.wondershare.cn/download/"],
  ["wondershare-filmora", "wondershare", "Wondershare.Filmora", "Wondershare Filmora", "https://filmora.wondershare.com/video-editor/video-editor-download.html"],
  ["wondershare-pdfelement", "wondershare", "Wondershare.PDFelement.10", "Wondershare PDFelement", "https://pdf.wondershare.cn/"],
  ["wps-office-ai", "kingsoft", "Kingsoft.WPSOffice", "WPS Office", "https://www.wps.cn/"],
  ["wrike-desktop", "wrike", "Wrike.WrikeDesktopApp", "Wrike Desktop App", "https://www.wrike.com/apps/mobile-and-desktop/desktop-app/"],
  ["xmind-ai", "xmind", "Xmind.Xmind", "Xmind", "https://xmind.cn/download"],
  ["youdao-lobsterai", "youdao", "NetEase.LobsterAI", "LobsterAI", "https://lobsterai.youdao.com/"],
  ["youdao-note", "youdao", "NetEase.YoudaoNote", "有道云笔记", "https://note.youdao.com/note-download"],
  ["zoom-workplace", "zoom", "Zoom.Zoom", "Zoom Workplace", "https://www.zoom.com/en/products/virtual-meetings/download-center/"],
  ["youdao-translate", "youdao", "Youdao.YoudaoTranslate", "有道翻译", "https://fanyi.youdao.com/download/", "winget", ["有道翻译", "Youdao Translate"]],
  ["iflytek-listen", "iflytek", "iFlytek.iFlyRecMeeting", "讯飞听见", "https://www.iflyrec.com/html/iflyrecAssistant.html", "winget", ["讯飞听见", "讯飞听见会议", "iFlyRec"]],
  ["iflytek-simultaneous", "iflytek", "iFlytek.iFlyRecSI", "讯飞同传", "https://tongchuan.iflyrec.com/download.html", "winget", ["讯飞同传", "iFlyRec SI"]],
  ["qihoo360-nami-ai-pc", "qihoo360", "360.NamiAI", "纳米 AI", "https://www.n.cn/", "winget", ["纳米 AI", "纳米AI", "Nami AI"]],
  ["qihoo360-safe-claw", "qihoo360", "360.NamiClaw", "360 安全龙虾", "https://claw.360.cn/", "winget", ["360 安全龙虾", "安全龙虾", "NamiClaw"]],
  ["meitu-ultra", "meitu", "Meitu.ColorByte", "美图云修", "https://ultra.meitu.com/download", "winget", ["美图云修", "ColorByte"]],
  ["citavi", "lumivero", "Lumivero.Citavi.7", "Citavi 7", "https://www.citavi.com/download", "winget", ["Citavi", "Citavi 7"]],
  ["snagit", "techsmith", "TechSmith.Snagit.2026", "Snagit 2026", "https://www.techsmith.com/snagit/", "winget", ["Snagit", "Snagit 2026"]],
  ["sketchup", "trimble", "Trimble.SketchUp.2026", "SketchUp 2026", "https://sketchup.trimble.com/en/download/all", "winget", ["SketchUp", "SketchUp 2026", "SketchUp Pro 2026"]],
  ["cisco-webex-ai-assistant", "cisco", "Cisco.Webex", "Webex", "https://www.webex.com/downloads.html", "winget", ["Webex", "Cisco Webex"]],
  ["unity-editor", "unity-technologies", "Unity.Unity.6000", "Unity 6", "https://unity.com/download", "winget", ["Unity", "Unity 6"]],
  ["spark-mail-windows", "spark-mail", "Readdle.Spark", "Spark", "https://sparkmailapp.com/download", "winget", ["Spark", "Spark Desktop"]],
  ["genesys-cloud-cx", "genesys", "Genesys.GenesysCloud", "Genesys Cloud", "https://help.genesys.cloud/articles/desktop-app/", "winget", ["Genesys Cloud"]],
  ["microsoft-copilot-desktop", "microsoft", "XP9CXNGPPJ97XX", "Microsoft Copilot", "https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/get-copilot", "msstore", ["Copilot", "Microsoft Copilot"]],
  ["raycast-windows", "raycast", "9PFXXSHC64H3", "Raycast", "https://www.raycast.com/windows", "msstore", ["Raycast"]],
  ["krisp-desktop", "krisp", "XP9D25XXG3SV5X", "Krisp", "https://krisp.ai/", "msstore", ["Krisp"]],
  ["voicemod-windows", "voicemod", "XP9B0BH6T8Z7KZ", "Voicemod", "https://www.voicemod.net/", "msstore", ["Voicemod"]],
  ["canary-mail", "canarymail", "9MT5MZ5H9WL6", "Canary Mail", "https://canarymail.io/downloads", "msstore", ["Canary Mail", "Canary Mail App"]],
  ["luminar-neo", "skylum", "9P7JQGL6GC8P", "Luminar Neo", "https://skylum.com/luminar-download", "msstore", ["Luminar Neo"]]
]);

const APPROVED_ROWS_SHA256 =
  "c43def3db0fcae7b34465d6e6edf9da1db7406f1ca1a014bcef09829cdcd4f09";
const REVIEW_REFERENCE =
  "docs/research/2026-08-04-windows-package-manager-install-baseline.md";
const REVIEWED_AT = "2026-08-04T06:00:00.000Z";
const PACKAGE_MANAGER_SOURCE =
  "https://cdn.winget.microsoft.com/cache";
const MICROSOFT_STORE_SOURCE = "https://apps.microsoft.com/";
const PACKAGE_MANAGER_DOCUMENTATION =
  "https://learn.microsoft.com/windows/package-manager/winget/";

function rowsSha256() {
  return sha256Hex(JSON.stringify(ROWS));
}

function rowsAreApproved() {
  return rowsSha256() === APPROVED_ROWS_SHA256;
}

const WINDOWS_PACKAGE_MANAGER_PRODUCTS = Object.freeze(
  Object.fromEntries(
    ROWS.map(([
      productId,
      vendorId,
      packageId,
      packageName,
      website,
      source = "winget",
      expectedNames = [packageName],
      officialSources = []
    ]) => [
      productId,
      Object.freeze({
        label: packageName,
        profileId: `desktop.${productId}.winget`,
        vendorId,
        packageManager: Object.freeze({
          driver: "winget",
          source,
          sourceUrl:
            source === "msstore" ? MICROSOFT_STORE_SOURCE : PACKAGE_MANAGER_SOURCE,
          packageId,
          packageName,
          expectedNames: Object.freeze([...expectedNames]),
          officialSources: Object.freeze([
            website,
            PACKAGE_MANAGER_DOCUMENTATION,
            ...(Array.isArray(officialSources) ? officialSources : [])
          ]),
          reviewReference: REVIEW_REFERENCE,
          reviewedAt: REVIEWED_AT
        }),
        capabilities: Object.freeze([
          "website",
          "tutorial",
          "install",
          "open",
          "uninstall"
        ]),
        requirements: Object.freeze([])
      })
    ])
  )
);

function getWindowsPackageManagerProduct(productId) {
  return rowsAreApproved()
    ? WINDOWS_PACKAGE_MANAGER_PRODUCTS[productId] || null
    : null;
}

module.exports = {
  APPROVED_ROWS_SHA256,
  WINDOWS_PACKAGE_MANAGER_PRODUCTS,
  getWindowsPackageManagerProduct,
  rowsAreApproved,
  rowsSha256
};
