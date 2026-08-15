# Windows 图形产品一键下载覆盖审计

审计时间：2026-08-05（Asia/Shanghai）  
事实源：authoritative revision store draft 83（615 products）与 active release 72（615 products，payload draftRevision 83）。两者产品集合与数量核对一致，未发现漂移。磁盘 draft 未作为事实源。

## 分工与培训留档

| 角色 | 分片/职责 | 状态 |
|---|---|---|
| 实习生 A | productId 排序分片 1：`01ai-api-platform`–`cyberlink-photodirector`（153） | 已确认培训，回传 49 条一手证据；未确认项标 blocked |
| 实习生 B | 分片 2：`cyberlink-powerdirector`–`langgraph`（154） | 已确认培训，回传 62 条 desktop 一手证据；其余保持未确认 |
| 实习生 C | 分片 3：`lens-desktop`–`qodo-code-review`（154） | 已确认培训，回传分片 4 组一手证据；未确认项标 blocked |
| 主管 | 分片 4/合并、规则、抽样复核、去重、唯一文档与候选 JSON、交接 | 本报告作者 |

实习生均被告知：只读官方一手来源；不得读写后台 draft、共享文件、代码或发布物；不得下载、安装、启动、探测本机或猜 URL；冲突/不确定必须标未确认并升级。三名实习生已在正式分派前回复“已阅读并理解”，任务完成后已终止。

## 覆盖结果

| 分类 | 数量 | 口径 |
|---|---:|---|
| stable-official-direct | 38 | 当前 authoritative profile 为 `client-managed`；其中 37 个 desktop-reviewed 加 Ollama Windows 官方 exe，仍需管理员逐条复核最终稳定 URL |
| microsoft-store | 0 | draft83 当前无 store-only 合同；不得从页面出现 Store 按钮推断为 Store-only |
| dynamic-or-login | 9 | 官方证据明确需要账户/订阅/动态选择：Ableton、Affinity、AutoCAD、Fusion、Revit、SOLIDWORKS、Camtasia、Snagit、Roblox Studio |
| official-page-only | 219 | 其余 desktop-official 页面合同；已有官方页面但未固化稳定制品 URL |
| no-windows/not-graphical | 349 | 其余 productType（web/cli/tutorial/cli-official）按目录字段不显示桌面一键下载；名称不足以推翻该结论 |
| **合计** | **615** | 以 productId 去重 |

## 抽样一手证据

| productId | 结论 | 官方页面与证据位置 |
|---|---|---|
| `audacity-desktop` | stable-official-direct 候选 | [Download for Windows](https://www.audacityteam.org/download/windows)：Windows 64/32 installer 与 zip、校验和、Win10/11 支持 |
| `blender` | stable-official-direct 候选 | [Blender download](https://www.blender.org/download/)：Windows Installer/Portable zip；[系统要求](https://www.blender.org/download/requirements/) |
| `cursor-desktop` | stable-official-direct 候选 | [Cursor downloads](https://www.cursor.com/downloads)：Windows x64/ARM64；最终制品 URL仍待管理员固化 |
| `qupath-desktop` | official-page-only | [QuPath](https://qupath.github.io/)：Windows MSI 与 portable zip 下载区；未固化稳定资产 URL |
| `screenpipe-desktop` | official-page-only | [官方 GitHub releases](https://github.com/screenpipe/screenpipe/releases)：App release/assets，Windows 修复记录；未固化资产 URL |
| `stability-matrix` | official-page-only | [官方 GitHub releases](https://github.com/LykosAI/StabilityMatrix/releases)：Windows 支持/修复与 assets；未固化资产 URL |
| `ableton-live` | dynamic-or-login | [Installing Ableton Live](https://help.ableton.com/hc/en-us/articles/209773565-Installing-Ableton-Live)：登录账户后按版本/OS 下载 |
| `autodesk-fusion` | dynamic-or-login | [Download Fusion](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-download-Fusion-360.html)：Autodesk Account/订阅下载；[系统要求](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/System-requirements-for-Autodesk-Fusion-360.html) |
| `roblox-studio` | dynamic-or-login | [Install Roblox Studio](https://create.roblox.com/docs/tutorials/curriculums/studio/install-studio)：Windows 安装流程与 `RobloxStudio.exe`，未固化直链 |
| `zoom-workplace` | official-page-only | [Zoom desktop download](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060928)：Windows 32/64/ARM64 下载按钮与 `ZoomInstaller.exe` |
| `kimi-work-desktop` | stable-approved existing contract | [Kimi Work](https://www.kimi.com/zh-cn/products/kimi-work)：官方 Windows 桌面下载说明；纳入现有 client-managed 合同复核 |

## 其他分组复核

按 productId 分片复核“其他产品”中的疑似 GUI 条目：未发现可由官方一手页面直接证明、且不已属于 266 个 desktop/local-model 记录的新增 Windows 图形产品。`home-assistant` 是 Windows 服务/系统部署，不是桌面 GUI；`kimi-claw-desktop`、`kilo-code-agent` 缺乏独立 Windows GUI 一手证据，均保持 `no-windows/not-graphical` 或 blocked，不进入候选。

## 交接规则

候选 JSON 只含 vendor/product 身份、策略、官方证据 URL、模块与按钮意图；不含 command、args、env、script、headers、credentials。任何“stable”条目在管理员固化最终 URL、校验和、批准 profile 前不得发布或获得安装权限。
+
## Final direct-link review (2026-08-05)

Scope: the 38 stable-official-direct candidates marked needsReview. Intern evidence was merged; no downloads or installations were performed.

Confirmed official final artifacts (9):

| productId | artifact | filename | allowed domain(s) |
|---|---|---|---|
| cursor-desktop | https://downloads.cursor.com/production/a758f2241ca99fecf380180b6cbdbbce0f1f42cf/win32/x64/system-setup/CursorSetup-x64-3.14.7.exe | CursorSetup-x64-3.14.7.exe | downloads.cursor.com |
| invokeai-community-edition | https://github.com/invoke-ai/launcher/releases/latest/download/Invoke.Community.Edition.Setup.latest.exe | Invoke.Community.Edition.Setup.latest.exe | github.com |
| jan-desktop | https://app.jan.ai/download/latest/win-x64 (official GitHub redirect) | Jan_0.8.4_x64-setup.exe | app.jan.ai, github.com |
| kimi-work-desktop | https://appsupport.moonshot.cn/api/app/pkg/latest/windows/download | kimi_3.1.6.exe | appsupport.moonshot.cn, kimi-img.moonshot.cn |
| letta-agent | https://download.letta.com/windows/nsis/x64 | Letta Setup 0.29.12 - x64.exe | download.letta.com |
| lm-studio-desktop | https://lmstudio.ai/download/latest/win32/x64 | LM-Studio-0.4.20-1-x64.exe | lmstudio.ai, installers.lmstudio.ai |
| msty-go | https://go-assets.msty.ai/app/latest/win/MstyGo_x64.exe | MstyGo_x64.exe | go-assets.msty.ai |
| ollama-cli | https://ollama.com/download/OllamaSetup.exe | OllamaSetup.exe | ollama.com (official redirect may reach GitHub release-assets) |
| opencode | https://opencode.ai/download/stable/windows-x64-nsis | opencode-desktop-windows-x64.exe | opencode.ai |

All other 29 candidates remain blocked pending a directly verifiable final artifact URL and filename. Download pages, dynamic buttons, version templates, and unresolved release assets do not qualify as final direct links.
+
Blocked productIds (29):
alibaba-qoder-cn-ide, alibaba-qoderwork-cn, alibaba-qwen-studio, amazon-kiro-ide, anythingllm-desktop, bytedance-doubao, chatgpt-desktop, claude-desktop, comfy-desktop, google-antigravity-desktop, goose-desktop, gpt4all-desktop, intel-ai-playground, jianying, koboldcpp, microsoft-vscode, nvidia-ai-workbench, openclaw-windows-hub, rowboat-desktop, stability-matrix, tencent-codebuddy, tencent-ima, tencent-qclaw, tencent-workbuddy, tencent-yuanbao-desktop, trae-desktop, trae-solo-cn, wispr-flow-desktop, zed-editor.

Each blocked item lacks an official page-verifiable final EXE/MSI/ZIP URL plus filename; it must remain official-page-only/blocked and cannot receive a client-managed direct-download contract.
