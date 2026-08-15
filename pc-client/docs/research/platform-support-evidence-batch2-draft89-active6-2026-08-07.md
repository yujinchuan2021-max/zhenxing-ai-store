# Platform support evidence Batch 2 (draft89 / v2 active6)

Candidate-only; no catalog/state/schema/profile/artifact changes. Observed at 2026-08-07T00:00:00.000Z.

## Summary

Selected **30** products and **90** product-platform claims: {"supported":71,"unknown":15,"unsupported":4,"blocked":0}. Batch 1 IDs were excluded. Resources (146) and targets (513) are intentionally out of scope.

## Method and limits

Only first-party HTTPS pages/docs were used. `unknown` means the cited official product identity page did not provide a verified claim for that platform in this pass; no inference from Electron, npm, Python, browser, container or generic requirements. Runtime is `native` only when the product is a desktop/native claim; WSL/container/browser/remote were not inferred. No files were downloaded or executed.

### Kimi Work（Windows） (`moonshot/kimi-work-desktop`)

Selection: Agent/desktop identity; official help names Mac/Windows

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.kimi.com/de/help/kimi-work/overview (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence: https://www.kimi.com/de/help/kimi-work/overview (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence: https://www.kimi.com/de/help/kimi-work/overview (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Verify platform-specific first-party requirements/release assets before any catalog claim.

### Msty Go (`msty/msty-go`)

Selection: Local-model desktop representative; per-platform evidence still needed

- windows: **unknown**, runtime=native, architectures=unknown; evidence: https://msty.ai/go/ (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence: https://msty.ai/go/ (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence: https://msty.ai/go/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Verify platform-specific first-party requirements/release assets before any catalog claim.

### Pieces for Developers (`pieces/pieces-for-developers`)

Selection: Developer AI desktop with explicit three-platform download chooser

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://pieces.app/download (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://pieces.app/download (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://pieces.app/download (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Raycast (`raycast/raycast-windows`)

Selection: Windows beta and macOS official FAQ; Linux explicitly not planned

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.raycast.com/faq (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://www.raycast.com/faq (observed 2026-08-07T00:00:00.000Z)
- linux: **unsupported**, runtime=native, architectures=unknown; evidence: https://www.raycast.com/faq (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### DeepChat (`thinkinai/deepchat-desktop`)

Selection: Official repository states Windows/macOS/Linux multi-platform

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://github.com/ThinkInAIXYZ/deepchat (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://github.com/ThinkInAIXYZ/deepchat (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://github.com/ThinkInAIXYZ/deepchat (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Notion (`notion/notion-desktop`)

Selection: Official desktop download identity; Linux native evidence absent

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.notion.com/desktop (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://www.notion.com/desktop (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence: https://www.notion.com/desktop (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Verify platform-specific first-party requirements/release assets before any catalog claim.

### Obsidian (`obsidian/obsidian-desktop`)

Selection: Official download page is platform-specific; verify current Linux packaging

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://obsidian.md/download (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://obsidian.md/download (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://obsidian.md/download (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Affinity (`canva/affinity`)

Selection: Creative desktop representative; Windows/macOS evidence, Linux absent

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.affinity.studio/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://www.affinity.studio/ (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence: https://www.affinity.studio/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Verify platform-specific first-party requirements/release assets before any catalog claim.

### Unity 6 (`unity-technologies/unity-editor`)

Selection: Official Hub docs state Windows/macOS/Linux Editor support

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://docs.unity.com/en-us/hub/install-hub (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://docs.unity.com/en-us/hub/install-hub (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://docs.unity.com/en-us/hub/install-hub (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Figma (`figma/figma-design`)

Selection: Desktop download representative; Linux native evidence not verified

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.figma.com/downloads/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://www.figma.com/downloads/ (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence: https://www.figma.com/downloads/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Verify platform-specific first-party requirements/release assets before any catalog claim.

### Linear (`linear/linear-workspace`)

Selection: Official docs state macOS/Windows desktop and browser-only Linux

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://linear.app/docs/get-the-app (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://linear.app/docs/get-the-app (observed 2026-08-07T00:00:00.000Z)
- linux: **unsupported**, runtime=native, architectures=unknown; evidence: https://linear.app/docs/get-the-app (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### IntelliJ IDEA (`jetbrains/jetbrains-intellij-idea`)

Selection: Official download lists Windows/macOS/Linux builds

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.jetbrains.com/idea/download/?os=win&section=windows (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://www.jetbrains.com/idea/download/?os=win&section=windows (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://www.jetbrains.com/idea/download/?os=win&section=windows (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Postman (`postman/postman-api-platform`)

Selection: Official install docs list native Windows/macOS/Linux and architectures

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://learning.postman.com/docs/getting-started/installation/install-app/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://learning.postman.com/docs/getting-started/installation/install-app/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://learning.postman.com/docs/getting-started/installation/install-app/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Godot Engine (`godot/godot-engine`)

Selection: Official Windows download identity; cross-platform release evidence

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://godotengine.org/download/windows/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://godotengine.org/download/windows/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://godotengine.org/download/windows/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Unreal Engine (`epic-games/unreal-engine`)

Selection: Official engine distribution representative; platform-specific editor evidence requires follow-up

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.unrealengine.com/download (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence: https://www.unrealengine.com/download (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence: https://www.unrealengine.com/download (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Verify platform-specific first-party requirements/release assets before any catalog claim.

### SketchUp 2026 (`trimble/sketchup`)

Selection: Official help lists Windows offline installer and macOS; no Linux native

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://help.sketchup.com/en/downloading-sketchup (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://help.sketchup.com/en/downloading-sketchup (observed 2026-08-07T00:00:00.000Z)
- linux: **unsupported**, runtime=native, architectures=unknown; evidence: https://help.sketchup.com/en/downloading-sketchup (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### DaVinci Resolve (`blackmagic-design/davinci-resolve`)

Selection: Official download page exposes Windows/macOS/Linux options

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.blackmagicdesign.com/uk/event/davinciresolvedownload (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://www.blackmagicdesign.com/uk/event/davinciresolvedownload (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://www.blackmagicdesign.com/uk/event/davinciresolvedownload (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### monday (`monday/monday-work-management`)

Selection: Official desktop-app documentation; Linux native evidence absent

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://support.monday.com/hc/en-us/articles/115005316885-monday-com-s-desktop-app (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://support.monday.com/hc/en-us/articles/115005316885-monday-com-s-desktop-app (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence: https://support.monday.com/hc/en-us/articles/115005316885-monday-com-s-desktop-app (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Verify platform-specific first-party requirements/release assets before any catalog claim.

### MongoDB Compass (`mongodb/mongodb-compass`)

Selection: Official GUI download exposes Windows/macOS and Linux installer paths

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.mongodb.com/try/download/compass (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://www.mongodb.com/try/download/compass (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://www.mongodb.com/try/download/compass (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Roblox Studio (`roblox/roblox-studio`)

Selection: Official Creator docs explicitly state Windows and Mac; no Linux native

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://create.roblox.com/docs/studio/setup (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://create.roblox.com/docs/studio/setup (observed 2026-08-07T00:00:00.000Z)
- linux: **unsupported**, runtime=native, architectures=unknown; evidence: https://create.roblox.com/docs/studio/setup (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### ClickUp (`clickup/clickup-workspace`)

Selection: Official help lists Windows, macOS and Linux desktop apps

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://help.clickup.com/hc/en-us/articles/6311884486423-Use-the-ClickUp-desktop-app (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://help.clickup.com/hc/en-us/articles/6311884486423-Use-the-ClickUp-desktop-app (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://help.clickup.com/hc/en-us/articles/6311884486423-Use-the-ClickUp-desktop-app (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Box (`box/box-content-cloud`)

Selection: Official Box Drive docs state Windows Explorer and macOS Finder; Linux absent

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://support.box.com/hc/en-us/sections/21356707082387-Box-Drive (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://support.box.com/hc/en-us/sections/21356707082387-Box-Drive (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence: https://support.box.com/hc/en-us/sections/21356707082387-Box-Drive (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Verify platform-specific first-party requirements/release assets before any catalog claim.

### Zoom Workplace (`zoom/zoom-workplace`)

Selection: Official download-center identity; platform claims require current page verification

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.zoom.com/en/products/virtual-meetings/download-center/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://www.zoom.com/en/products/virtual-meetings/download-center/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://www.zoom.com/en/products/virtual-meetings/download-center/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Redis Insight (`redis/redis-insight`)

Selection: Official FAQ states traditional OS packages for Windows/macOS/Linux

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://redis.io/faq/doc/18gyy2gec1/how-to-download-and-install-redisinsight (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://redis.io/faq/doc/18gyy2gec1/how-to-download-and-install-redisinsight (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://redis.io/faq/doc/18gyy2gec1/how-to-download-and-install-redisinsight (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Neo4j Desktop (`neo4j/neo4j-desktop`)

Selection: Official installation docs state Mac/Linux/Windows availability

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://neo4j.com/docs/desktop/current/installation/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://neo4j.com/docs/desktop/current/installation/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://neo4j.com/docs/desktop/current/installation/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Opera Stable (`opera/opera-one`)

Selection: Official support pages cover Windows/macOS/Linux desktop browsers

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://help.opera.com/en/latest/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://help.opera.com/en/latest/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://help.opera.com/en/latest/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### SOLIDWORKS Design (`dassault-systemes/dassault-solidworks-design`)

Selection: Enterprise CAD representative; official support/download page is Windows-focused

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.solidworks.com/support/downloads (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence: https://www.solidworks.com/support/downloads (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence: https://www.solidworks.com/support/downloads (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Verify platform-specific first-party requirements/release assets before any catalog claim.

### Audacity (`audacity/audacity-desktop`)

Selection: Official downloads state Windows/macOS/GNU/Linux

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.audacityteam.org/download/?lang=en (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://www.audacityteam.org/download/?lang=en (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://www.audacityteam.org/download/?lang=en (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

### Streamlabs Desktop (`streamlabs/streamlabs-desktop`)

Selection: Official requirements state Windows 10 and macOS 12+; Linux absent

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://support.streamlabs.com/hc/en-us/articles/4417738527515-Streamlabs-Desktop-System-Requirements (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://support.streamlabs.com/hc/en-us/articles/4417738527515-Streamlabs-Desktop-System-Requirements (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence: https://support.streamlabs.com/hc/en-us/articles/4417738527515-Streamlabs-Desktop-System-Requirements (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Verify platform-specific first-party requirements/release assets before any catalog claim.

### Navicat Premium (`navicat/navicat-premium`)

Selection: Official download page lists Windows/macOS/Linux trial editions

- windows: **supported**, runtime=native, architectures=unknown; evidence: https://www.navicat.com.sg/download/navicat-premium (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence: https://www.navicat.com.sg/download/navicat-premium (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence: https://www.navicat.com.sg/download/navicat-premium (observed 2026-08-07T00:00:00.000Z)
- Follow-up: No platform follow-up beyond independent profile review.

## Validation checklist

- Canonical vendor/product IDs must be checked against `state.draft.catalog` before any downstream use.
- Each record has exactly three platform claims and first-party HTTPS evidence.
- Forbidden execution/profile fields are absent; candidateOnly=true and publishable=false.
- This document does not authorize saveDraft, publish, package, upload, install or download.
