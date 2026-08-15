# Desktop download real-time official scan (draft84)

- Candidate-only; not publishable. No catalog/state/saveDraft/publish changes.
- Source: authoritative draft revision 84 (615 products).
- Fresh live scan: **213** remaining `downloadPolicy=official-page` products; Tana is excluded because it is the prior candidate and is listed separately below.
- Method: first-party official product/download pages, official GitHub release API/assets, official redirects and HEAD/small-response checks only; no installer body download.
- Results: **22 candidates**, **191 blocked**.

## Previous Tana candidate (separate)

`tana-outliner` — https://assets.tana.inc/desktop/Tana-Setup-windows.exe

## Fresh candidates

| productId | vendorId | evidenceUrl | finalArtifactUrl | fileName | kind | stability |
|---|---|---|---|---|---|---|
| aftershoot | aftershoot | https://aftershoot.com/downloads/ | https://download.aftershoot.com/production/x86_64-windows/AfterShoot-win-latest-2.21.3.exe | AfterShoot-win-latest-2.21.3.exe | exe | versioned |
| airtable-platform | airtable | https://www.airtable.com/windows | https://static.airtable.com/download/AirtableSetup.exe | AirtableSetup.exe | exe | stable |
| amd-gaia | amd | https://github.com/amd/gaia/releases/latest | https://github.com/amd/gaia/releases/download/v0.22.0/gaia-agent-ui-0.22.0-x64-setup.exe | gaia-agent-ui-0.22.0-x64-setup.exe | exe | versioned |
| audiate | techsmith | https://www.techsmith.com/camtasia/audiate/download/download-audiate-win/ | https://cdn-audiate.cloud.techsmith.com/audiate/latest/Audiate.exe | Audiate.exe | exe | stable |
| ilastik-desktop | ilastik | https://www.ilastik.org/download | https://files.ilastik.org/ilastik-1.4.2-win64.exe | ilastik-1.4.2-win64.exe | exe | versioned |
| laiye-worker | laiye | https://laiye.com/product/worker | https://cw-res.laiye.com/update/laiyeworker-latest-win32-x64-setup.exe | laiyeworker-latest-win32-x64-setup.exe | exe | stable |
| lobehub-desktop | lobehub | https://github.com/lobehub/lobehub/releases/latest | https://github.com/lobehub/lobehub/releases/download/v2.2.13/LobeHub-2.2.13-setup.exe | LobeHub-2.2.13-setup.exe | exe | versioned |
| maxqda-desktop | maxqda | https://www.maxqda.com/updates | https://updates.maxqda.de/MAXQDA/MAXQDA_Setup.msi | MAXQDA_Setup.msi | msi | stable |
| meitu-pc | meitu | https://pc.meitu.com/pc | https://kankan-dl.meitudata.com/V2/1125/KanKan_kk360Setup.exe | KanKan_kk360Setup.exe | exe | versioned |
| miro-workspace | miro | https://miro.com/apps/ | https://desktop.miro.com/platforms/win32-nsis-pu/Miro-setup.exe | Miro-setup.exe | exe | stable |
| msty-nexus | msty | https://msty.ai/products/nexus/ | https://nexus-assets.msty.ai/app/latest/win/Msty-Nexus_x64.exe | Msty-Nexus_x64.exe | exe | stable |
| msty-studio | msty | https://msty.ai/products/studio/ | https://next-assets.msty.studio/app/latest/win/MstyStudio_x64.exe | MstyStudio_x64.exe | exe | stable |
| nvidia-canvas | nvidia | https://www.nvidia.com/en-us/studio/canvas.html | https://images.nvidia.cn/canvas/Canvas1.4.311.exe | Canvas1.4.311.exe | exe | versioned |
| obs-studio | obs-project | https://obsproject.com/download | https://cdn-fastly.obsproject.com/downloads/OBS-Studio-32.2.1-Windows-x64-Installer.exe | OBS-Studio-32.2.1-Windows-x64-Installer.exe | exe | versioned |
| orange-data-mining-desktop | orange-data-mining | https://orangedatamining.com/download/ | https://download.biolab.si/download/files/Orange3-3.40.0-x86_64.exe | Orange3-3.40.0-x86_64.exe | exe | versioned |
| paintshop-pro | corel | https://www.paintshoppro.com/en/products/paintshop-pro/ | https://dwnld.paintshoppro.com/trials/psp/2023/VrCk2he58y/PSP2023Installer.exe | PSP2023Installer.exe | exe | versioned |
| qihoo360-agent-safe | qihoo360 | https://agentsafe.360.cn/ | https://dl.360scdn.com/AgentSafe/360AgentSafeSetup.exe | 360AgentSafeSetup.exe | exe | versioned |
| qihoo360-ai-browser | qihoo360 | https://browser.360.cn/?from=xp | https://down.360safe.com/se/360se15.3.6440.64.exe | 360se15.3.6440.64.exe | exe | versioned |
| qupath-desktop | qupath | https://github.com/qupath/qupath/releases | https://github.com/qupath/qupath/releases/download/v0.7.0/QuPath-v0.7.0-Windows.msi | QuPath-v0.7.0-Windows.msi | msi | versioned |
| read-desktop | read-ai | https://www.read.ai/ | https://desktop.read.ai/installers/windows/x86_64/latest/Read+AI_latest_x64-setup.exe | Read+AI_latest_x64-setup.exe | exe | stable |
| skywork-desktop | skywork | https://skywork.ai/desktop/zh/index.html | https://static-us-img.skywork.ai/desktop-package/skywork-desktop_2.4.0_x64-setup.exe | skywork-desktop_2.4.0_x64-setup.exe | exe | versioned |
| upscayl-desktop | upscayl | https://upscayl.org/download | https://github.com/upscayl/upscayl/releases/download/latest/upscayl-latest-win.exe | upscayl-latest-win.exe | exe | stable |

## Blocked records

All blocked records were live-checked in this run; no final Windows artifact was accepted. The JSON preserves each product's official evidence URL and precise block reason (including observed mismatches).

| productId | vendorId | evidenceUrl | blockedReason |
|---|---|---|---|
| ableton-live | ableton | https://www.ableton.com/en/trial/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| acdsee-photo-studio-ultimate | acd-systems | https://www.acdsee.com/en/products/photo-studio-ultimate/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| adobe-acrobat-reader-ai | adobe | https://www.adobe.com/acrobat/pdf-reader.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| adobe-creative-cloud | adobe | https://www.adobe.com/download/creative-cloud | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| adobe-illustrator | adobe | https://www.adobe.com/products/illustrator/free-trial-download.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| adobe-lightroom | adobe | https://www.adobe.com/products/photoshop-lightroom/free-trial-download.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| adobe-photoshop | adobe | https://www.adobe.com/products/photoshop/free-trial-download.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| adobe-premiere | adobe | https://www.adobe.com/products/premiere/free-trial-download.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| affine-desktop | affine | https://affine.pro/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| affinity | canva | https://www.affinity.studio/ | official page requires login or denied access |
| alibaba-dingtalk-ai | alibaba | https://www.dingtalk.com/download?isLite=0 | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| alibaba-quark-ai-browser | alibaba | https://www.quark.cn/ | official endpoint check failed: terminated |
| allplan | allplan | https://www.allplan.com/products/allplan/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| alteryx-designer | alteryx | https://help.alteryx.com/current/en/designer/what-s-new-in-designer.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| ansys-lumerical | ansys | https://www.ansys.com/products/optics | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| anydesk-windows | anydesk | https://anydesk.com/en/downloads/windows | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| anytype-desktop | anytype | https://anytype.io/downloads | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| appflowy-desktop | appflowy | https://appflowy.com/download | official page requires login or denied access |
| asana-work-graph | asana | https://asana.com/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| atlas-ti | lumivero | https://atlasti.com/atlas-ti-desktop | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| autodesk-autocad | autodesk | https://www.autodesk.com/products/autocad/overview | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| autodesk-fusion | autodesk | https://www.autodesk.com/products/fusion-360/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| autodesk-revit | autodesk | https://www.autodesk.com/products/revit/overview/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| baidu-ruliu | baidu | https://infoflow.baidu.com/newweb/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| blender | blender | https://www.blender.org/download/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| block-buzz | block | https://block.github.io/buzz/support.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| box-content-cloud | box | https://www.box.com/drive | official page requires login or denied access |
| brave-browser-leo | brave | https://brave.com/download/ | official endpoint check failed: The operation was aborted due to timeout |
| browseros-desktop | browseros | https://browseros.com/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| bytedance-capcut-desktop | bytedance | https://www.capcut.com/tools/desktop-video-editor | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| bytedance-feishu | bytedance | https://www.feishu.cn/download?lang=zh-CN | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| bytedance-ui-tars-desktop | bytedance | https://github.com/bytedance/UI-TARS-desktop/releases/latest | official GitHub latest release has no Windows EXE/MSI/MSIX/ZIP asset |
| camtasia | techsmith | https://www.techsmith.com/download/camtasia/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| canary-mail | canarymail | https://canarymail.io/downloads | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| capacities-desktop | capacities | https://capacities.io/download-app | official endpoint check failed: The operation was aborted due to timeout |
| capture-one-pro | capture-one | https://www.captureone.com/en/account/download | official page requires login or denied access |
| chatbox-desktop | chatboxai | https://chatboxai.app/en/install | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| cherry-studio | cherryhq | https://cherry-ai.com/download | official endpoint check failed: fetch failed |
| cisco-webex-ai-assistant | cisco | https://www.webex.com/downloads.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| citavi | lumivero | https://www1.citavi.com/sub/manual7/en/using_msi_assistant.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| clickup-brain-max | clickup | https://clickup.com/brain/max | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| clickup-workspace | clickup | https://clickup.com/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| coreldraw-graphics-suite | corel | https://www.coreldraw.com/en/product/coreldraw/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| cyberlink-photodirector | cyberlink | https://www.cyberlink.com/products/photodirector-photo-editing-software-365/features_en_AU.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| cyberlink-powerdirector | cyberlink | https://www.cyberlink.com/products/powerdirector-video-editing-software/overview_en_US.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| dassault-solidworks-design | dassault-systemes | https://www.solidworks.com/support/downloads | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| davinci-resolve | blackmagic-design | https://www.blackmagicdesign.com/products/davinciresolve | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| dbeaver-pro | dbeaver | https://dbeaver.com/download/ | official endpoint check failed: The operation was aborted due to timeout |
| deepchat-desktop | thinkinai | https://github.com/ThinkInAIXYZ/deepchat/releases/latest | official GitHub release exposed a macOS ZIP, not a Windows artifact |
| descript-desktop | descript | https://www.descript.com/download/windows | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| dialpad-desktop | dialpad | https://www.dialpad.com/download/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| discord-desktop | discord | https://discord.com/download | official endpoint check failed: The operation was aborted due to timeout |
| dropbox-dash | dropbox | https://help.dropbox.com/installs/download-install-dropbox-dash | official endpoint check failed: The operation was aborted due to timeout |
| duckduckgo-browser | duckduckgo | https://duckduckgo.com/app | official endpoint check failed: The operation was aborted due to timeout |
| dxo-photolab | dxo | https://www.dxo.com/en/dxo-photolab/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| endnote-2025 | clarivate | https://endnote.com/downloads/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| evoto-desktop | evoto | https://www.evoto.ai/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| excire-foto | excire | https://support.excire.com/portal/en/kb/articles/download-excire-foto-2025 | official page exposed a DMG ZIP; not a Windows EXE/MSI/MSIX/ZIP |
| factory-droids | factory-ai | https://factory.ai/product/desktop | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| fathom-desktop | fathom | https://fathom.video/download/win | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| fellow-desktop | fellow | https://fellow.app/download | official page requires login or denied access |
| figma-design | figma | https://www.figma.com/downloads/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| fireflies-desktop | firefliesai | https://fireflies.ai/desktop | resolved artifact is on a staging host, not a stable production endpoint |
| fiveire-desktop | fiveire | https://5ire.app/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| fotor-windows | fotor | https://www.fotor.com/windows/index.html | official endpoint check failed: The operation was aborted due to timeout |
| genesys-cloud-cx | genesys | https://help.genesys.cloud/articles/desktop-app/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| genspark-ai-browser | genspark | https://www.genspark.ai/browser | official endpoint check failed: The operation was aborted due to timeout |
| genspark-claw | genspark | https://www.genspark.ai/download | official page requires login or denied access |
| genspark-speakly | genspark | https://www.genspark.ai/helpcenter/speakly | official page requires login or denied access |
| gitbutler-desktop | gitbutler | https://gitbutler.com/downloads | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| gitkraken-desktop | gitkraken | https://www.gitkraken.com/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| godot-engine | godot | https://godotengine.org/download/windows/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| google-android-studio | google | https://developer.android.com/studio | official endpoint check failed: The operation was aborted due to timeout |
| google-chrome-devtools | google | https://www.google.com/chrome/download-chrome/ | official endpoint check failed: The operation was aborted due to timeout |
| grammarly-windows | grammarly | https://www.grammarly.com/desktop/windows | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| granola-desktop | granola | https://www.granola.ai/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| graphisoft-archicad | graphisoft | https://www.graphisoft.com/en-us/downloads/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| heptabase-desktop | heptabase | https://heptabase.com/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| hitpaw-edimakor | hitpaw | https://www.hitpaw.com/download-center/ | official page resolved to a VikPea installer, product identity mismatch |
| hitpaw-fotorpea | hitpaw | https://www.hitpaw.com/download-center/ | official page resolved to a VikPea installer, product identity mismatch |
| hitpaw-vikpea | hitpaw | https://www.hitpaw.com/download-center/ | official page resolved to a VikPea installer but product identity could not be independently tied to this item |
| hitpaw-voicepea | hitpaw | https://www.hitpaw.com/download-center/ | official page resolved to a VikPea installer, product identity mismatch |
| iflytek-listen | iflytek | https://www.iflyrec.com/html/iflyrecAssistant.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| iflytek-simultaneous | iflytek | https://tongchuan.iflyrec.com/download.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| iflytek-sparkdesk | iflytek | https://xinghuo.xfyun.cn/app/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| izotope-rx | izotope | https://www.izotope.com/en/products/downloads.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| jetbrains-intellij-idea | jetbrains | https://www.jetbrains.com/idea/download/?section=windows | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| knime-analytics-platform | knime | https://www.knime.com/get-started | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| krisp-desktop | krisp | https://help.krisp.ai/hc/en-us/articles/4420088642460-Install-Krisp-AI-Meeting-Assistant | official page requires login or denied access |
| laiye-rpa | laiye | https://laiye.com/product/rpa-platform | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| lalalai-desktop | lalalai | https://www.lalal.ai/desktop-app/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| lens-desktop | lens | https://k8slens.dev/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| linear-workspace | linear | https://linear.app/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| lovable-ai-app-builder | lovable | https://lovable.dev/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| luminar-neo | skylum | https://skylum.com/luminar-download | official page requires login or denied access |
| manus-desktop | manus | https://manus.im/desktop | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| matlab | mathworks | https://www.mathworks.com/products/matlab.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| meetgeek-desktop | meetgeek | https://meetgeek.ai/desktop-app | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| meitu-ultra | meitu | https://ultra.meitu.com/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| microsoft-365-copilot | microsoft | https://support.microsoft.com/en-us/microsoft-365-copilot/access-microsoft-365-copilot-on-windows | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| microsoft-copilot-desktop | microsoft | https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/get-copilot | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| microsoft-edge-ai | microsoft | https://www.microsoft.com/en-us/edge/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| microsoft-power-bi-desktop | microsoft | https://www.microsoft.com/en-us/download/details.aspx?id=58494 | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| microsoft-visual-studio | microsoft | https://visualstudio.microsoft.com/downloads/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| moises-desktop | moises | https://moises.ai/products/moises-desktop-app/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| moises-live | moises | https://moises.ai/products/live/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| monday-work-management | monday | https://support.monday.com/hc/en-us/articles/115005316885-monday-com-s-desktop-app | official page requires login or denied access |
| mongodb-compass | mongodb | https://www.mongodb.com/try/download/compass | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| monica-desktop | monica | https://monica.im/download | official endpoint check failed: The operation was aborted due to timeout |
| motion-desktop | motion | https://www.usemotion.com/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| movavi-video-editor | movavi | https://www.movavi.com/video-editor-plus/ | final URL carries dynamic webuid/browser query parameters; not a stable canonical artifact |
| mozilla-firefox | mozilla | https://www.firefox.com/en-US/download/windows/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| mylio-photos | mylio | https://support.mylio.com/where-can-i-download-the-mylio-photos-software | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| navicat-premium | navicat | https://www.navicat.com/en/download/navicat-premium | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| neo4j-desktop | neo4j | https://neo4j.com/download/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| neo4j-enterprise-studio | neo4j | https://neo4j.com/product/enterprise-studio/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| nero-ai-image-upscaler | nero | https://www.nero.com/eng/downloads/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| nero-ai-photo-tagger | nero | https://www.nero.com/eng/downloads/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| nero-ai-video-upscaler | nero | https://www.nero.com/eng/downloads/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| notion-desktop | notion | https://www.notion.com/desktop | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| nous-hermes-desktop | nousresearch | https://github.com/nousresearch/hermes-agent/releases/latest | official GitHub latest release has no Windows EXE/MSI/MSIX/ZIP asset |
| nvidia-broadcast | nvidia | https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-app/ | official endpoint check failed: The operation was aborted due to timeout |
| nvivo | lumivero | https://lumivero.com/resources/support/getting-started-with-nvivo/download-and-activate-nvivo/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| obsidian-desktop | obsidian | https://obsidian.md/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| octave-bricscad | octave | https://bricscad.octave.com/bricscad | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| on1-photo-raw | on1 | https://www.on1.com/products/photo-raw/download/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| open-interpreter-desktop | open-interpreter | https://www.openinterpreter.com/desktop | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| open-webui | openwebui | https://github.com/open-webui/desktop/releases/latest | official GitHub release exposed a macOS ZIP, not a Windows artifact |
| opera-neon | opera | https://www.operaneon.com/ | official page requires login or denied access |
| opera-one | opera | https://www.opera.com/one | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| otter-desktop | otterai | https://otter.ai/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| pdfgear-windows | pdfgear | https://www.pdfgear.com/pdfgear-for-windows/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| perplexity-comet | perplexity | https://www.perplexity.ai/comet | official endpoint check failed: The operation was aborted due to timeout |
| perplexity-web | perplexity | https://www.perplexity.ai/platforms | official endpoint check failed: The operation was aborted due to timeout |
| pieces-for-developers | pieces | https://pieces.app/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| pinokio-ai-browser | pinokio | https://github.com/pinokiocomputer/pinokio/releases/latest | official GitHub release exposed a macOS ZIP, not a Windows artifact |
| poe | quora | https://poe.com/download | official endpoint check failed: The operation was aborted due to timeout |
| portraitpro | anthropics | https://www.anthropics.com/portraitpro/download/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| postman-api-platform | postman | https://www.postman.com/downloads/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| ptc-creo | ptc | https://www.ptc.com/en/products/creo/capabilities | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| qihoo360-ai-office | qihoo360 | https://bangong.360.cn/ | official page resolved to a 360 browser installer, product identity mismatch |
| qihoo360-nami-ai-pc | qihoo360 | https://www.n.cn/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| qihoo360-safe-claw | qihoo360 | https://claw.360.cn/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| raycast-windows | raycast | https://www.raycast.com/windows | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| redis-insight | redis | https://redis.io/docs/latest/operate/redisinsight/install/install-on-desktop/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| roblox-studio | roblox | https://create.roblox.com/docs/studio/setup | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| screenpipe-desktop | screenpipe | https://screenpipe.com/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| sider-windows | sider | https://sider.ai/apps/windows | official endpoint check failed: The operation was aborted due to timeout |
| siemens-designcenter-nx | siemens | https://www.siemens.com/en-us/products/designcenter/cad-software/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| siemens-eigen-engineering-agent | siemens | https://www.siemens.com/en-us/products/tia-portal/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| siemens-rapidminer-ai-studio | siemens | https://www.siemens.com/en-us/products/rapidminer/ai-studio/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| simulink | mathworks | https://www.mathworks.com/products/simulink.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| skales-desktop | skales | https://skales.app/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| sketchup | trimble | https://sketchup.trimble.com/en/download/all | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| slack-workspace | slack | https://slack.com/downloads/windows | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| snagit | techsmith | https://www.techsmith.com/snagit/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| spark-mail-windows | spark-mail | https://sparkmailapp.com/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| steinberg-spectralayers | steinberg | https://www.steinberg.net/spectralayers/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| streamlabs-desktop | streamlabs | https://streamlabs.com/desktop | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| sunlogin-windows | oray | https://sunlogin.oray.com/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| supernormal-desktop | supernormal | https://help.supernormal.com/en/articles/11801191-download-the-app-for-your-system | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| superwhisper-windows | superwhisper | https://superwhisper.com/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| synopsys-verdi | synopsys | https://www.synopsys.com/verification/debug/verdi.html | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| tableau-desktop | salesforce | https://www.tableau.com/support/releases | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| tencent-qq-ai-browser | tencent | https://browser.qq.com/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| termius-desktop | termius | https://termius.com/download/windows | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| tldv-desktop | tldv | https://tldv.io/desktop-app/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| topaz-gigapixel | topazlabs | https://www.topazlabs.com/downloads | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| topaz-photo | topazlabs | https://www.topazlabs.com/downloads | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| topaz-video | topazlabs | https://www.topazlabs.com/downloads | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| trimble-tekla-structures | trimble | https://download.trimble.com/tekla-structures/for-businesses | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| uipath-studio | uipath | https://www.uipath.com/product/studio | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| unity-editor | unity-technologies | https://unity.com/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| unreal-engine | epic-games | https://www.unrealengine.com/download | official page requires login or denied access |
| updf-windows | updf | https://updf.com/download/ | official endpoint check failed: The operation was aborted due to timeout |
| vectorworks-design-suite | vectorworks | https://www.vectorworks.net/en-US/products?showModal=trial-form | official endpoint check failed: The operation was aborted due to timeout |
| vegas-pro | boris-fx | https://vfx.borisfx.com/vegas-pro-free-trial | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| voice-ai-windows | voiceai | https://voice.ai/platforms/pc | official endpoint check failed: The operation was aborted due to timeout |
| voicemod-windows | voicemod | https://www.voicemod.net/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| vrew-desktop | vrew | https://vrew.ai/es/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| warp-windows | warp | https://www.warp.dev/windows-terminal | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| windsurf-editor | windsurf | https://windsurf.com/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| wolfram-mathematica | wolfram-research | https://www.wolfram.com/mathematica/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| wps-office-ai | kingsoft | https://www.wps.cn/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| wrike-desktop | wrike | https://www.wrike.com/apps/mobile-and-desktop/desktop-app/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| yingdao-rpa | yingdao | https://www.yingdao.com/xbot-go-download/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| youdao-lobsterai | youdao | https://lobsterai.youdao.com/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| youdao-note | youdao | https://note.youdao.com/note-download | official page exposed an opaque ZIP/signed artifact without a Windows file identity |
| youdao-translate | youdao | https://fanyi.youdao.com/download/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| zoner-studio | zoner | https://www.zoner.com/en/download | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |
| zoom-workplace | zoom | https://www.zoom.com/en/products/virtual-meetings/download-center/ | official page exposes no final Windows EXE/MSI/MSIX/ZIP URL |

