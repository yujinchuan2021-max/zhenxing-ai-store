# Windows 桌面下载合同全量盘点

审计日期：2026-08-05  
审计范围：当前 draft `pc-client/admin/data/catalog-v1.json` 的全部 Windows 桌面记录（含 Ollama 本地模型桌面合同）及客户端固定批准合同。未联网、未运行安装器、未发布或封包。

## 事实源与口径

- Draft：375 个厂商、614 个一级产品；其中 266 个记录属于桌面/本地模型桌面范围（169 `desktop-reviewed`、96 `desktop-official`、1 `local-model`）。
- 最新活动 revision store 仍是 catalog v71 / draft revision 74，包含 615 个产品；它比当前 draft 多出一张旧 CLI 卡，本审计按当前 draft 盘点，不把活动目录倒灌回 draft。
- “stable-approved-direct”要求 `client-managed`、固定安装 profile、独立 intake approval、稳定官方 Windows 直链，并排除 Store bootstrapper。
- “official-page-only”要求 `desktop-official`/`official-page`，只打开厂商官方页面。
- “store-only”包括 Store bootstrapper，以及固定包管理器源为 `msstore` 的记录。
- “package-manager-only”指仍依赖固定 `winget` 源的记录；这是按最新用户规则的迁移阻断，不是新的推荐策略。
- “inconsistent”指目录类型、按钮/下载策略与客户端合同互相矛盾。本轮按字段、profile、approval、package-manager registry 交叉核对。

## 盘点结果

| 类别 | 数量 |
| --- | ---: |
| stable-approved-direct | 37 |
| official-page-only | 96 |
| store-only | 7 |
| package-manager-only | 126 |
| inconsistent | 0 |
| **合计** | **266** |

明确归类：

| productId | 名称 | 归类 | 证据摘要 |
| --- | --- | --- | --- |
| `msty-go` | Msty Go | stable-approved-direct | `desktop-reviewed`，有批准记录、`desktop.msty-go.windows`、稳定官方 `.exe` 直链 |
| `stability-matrix` | Stability Matrix | stable-approved-direct | `desktop-reviewed`，有批准记录、`desktop.stability-matrix.windows`、固定官方 GitHub `.zip` 直链 |
| `audacity-desktop` | Audacity | package-manager-only | `desktop-reviewed`，`downloadPolicy=package-manager`，profile 为 `desktop.audacity-desktop.winget`，固定源为 `winget` |

Store-only 的 7 个 productId 为：

`chatgpt-desktop`, `microsoft-copilot-desktop`, `raycast-windows`, `luminar-neo`, `voicemod-windows`, `krisp-desktop`, `canary-mail`

## package-manager-only productId

以下 126 条均为 `downloadPolicy=package-manager`、固定 `winget` 源；按最新用户规则属于迁移阻断清单：

```text
bytedance-feishu, bytedance-capcut-desktop, bytedance-ui-tars-desktop,
google-chrome-devtools, google-android-studio, microsoft-365-copilot,
microsoft-edge-ai, microsoft-power-bi-desktop, alibaba-quark-ai-browser,
alibaba-dingtalk-ai, tencent-qq-ai-browser, perplexity-web, perplexity-comet,
open-webui, cherry-studio, chatbox-desktop, msty-studio, lobehub-desktop,
windsurf-editor, warp-windows, poe, pinokio-ai-browser, deepchat-desktop,
fiveire-desktop, browseros-desktop, block-buzz, deepl-desktop, grammarly-windows,
notion-desktop, descript-desktop, canva-windows, affinity, wondershare-filmora,
wondershare-edrawmax, wondershare-edrawmind, wondershare-pdfelement,
topaz-photo, topaz-video, topaz-gigapixel, moises-desktop, fathom-desktop,
granola-desktop, qihoo360-nami-ai-pc, qihoo360-safe-claw, iflytek-listen,
iflytek-simultaneous, youdao-lobsterai, youdao-translate, youdao-note,
skywork-desktop, monica-desktop, wps-office-ai, xmind-ai, meitu-ultra,
unity-editor, figma-design, docker-desktop, linear-workspace, slack-workspace,
jetbrains-intellij-idea, postman-api-platform, asana-work-graph, blender,
godot-engine, obs-studio, adobe-creative-cloud, adobe-acrobat-reader-ai,
autodesk-fusion, sketchup, monday-work-management, mongodb-compass,
roblox-studio, miro-workspace, tableau-desktop, clickup-workspace,
box-content-cloud, zoom-workplace, redis-insight, neo4j-desktop,
brave-browser-leo, obsidian-desktop, discord-desktop, opera-one,
mozilla-firefox, upscayl-desktop, fotor-windows, craft-desktop,
evernote-desktop, acdsee-photo-studio-ultimate, endnote-2025,
taskade-workspace, excire-foto, citavi, wrike-desktop, motion-desktop,
camtasia, snagit, audiate, knime-analytics-platform, gitkraken-desktop,
termius-desktop, lens-desktop, fellow-desktop, teamviewer-remote-ai,
factory-droids, qupath-desktop, orange-data-mining-desktop, genesys-cloud-cx,
dialpad-desktop, audacity-desktop, streamlabs-desktop, navicat-premium,
cisco-webex-ai-assistant, airtable-platform, superwhisper-windows,
pdfgear-windows, updf-windows, vrew-desktop, gitbutler-desktop,
affine-desktop, appflowy-desktop, duckduckgo-browser, spark-mail-windows,
movavi-video-editor, anydesk-windows, anytype-desktop
```

## inconsistent

未发现 productId。交叉检查未发现以下矛盾：

- `desktop-official` 携带受管 profile、批准记录或托管下载字段；
- `client-managed` 缺少批准 profile、稳定直链或 profile URL 不一致；
- `package-manager` 缺少固定 package-manager registry/profile；
- `official-page` 同时声明本地安装 profile或批准受管安装。

“inconsistent=0”只表示当前字段与现有合同彼此一致，不代表 126 个 Winget 合同符合最新用户策略；后者仍需桌面产品员工提出迁移清单并由 CTO 分阶段处理。

## 只读证据来源

- `pc-client/admin/data/catalog-v1.json`
- `pc-client/admin/published/catalog-store/releases/catalog-v00000071-463e6579c863-812735b6.json`
- `pc-client/shared/install-registry.cjs`
- `pc-client/shared/product-intake-approvals.cjs`
- `pc-client/shared/windows-package-manager-catalog.cjs`
- `pc-client/docs/team-ownership-and-coordination.md`（P0 桌面策略：官方直链优先，不回退 Winget）

