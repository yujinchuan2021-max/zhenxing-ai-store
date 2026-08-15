# Windows official-page-only 深查（draft83）

访问日期：2026-08-05（Asia/Shanghai）。来源为 authoritative draft revision 83，共 615 产品；本轮筛出 219 个 official-page-only。实习生仅读取官方网页/官方发布页并执行 HEAD/小请求核验，未下载制品、未安装、未修改共享文件。

## 分片与结果

| 分片 | 产品数 | A direct-stable | B stable-redirect | C Store | D login/dynamic | E no-Windows/not-graphical | F unresolved |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 36 | 2 | 0 | 0 | 0 | 0 | 34 |
| 2 | 37 | 6 | 0 | 0 | 0 | 0 | 31 |
| 3 | 36 | 0 | 0 | 0 | 0 | 0 | 36 |
| 4 | 37 | 0 | 0 | 0 | 0 | 0 | 37 |
| 5 | 36 | 0 | 0 | 0 | 0 | 0 | 36 |
| 6 | 37 | 8 | 0 | 0 | 0 | 0 | 29 |
| **合计** | **219** | **16** | **0** | **0** | **0** | **0** | **203** |

F 表示官方页面或发布页不足以同时证明最终制品 URL 与文件名；不得把下载页、动态按钮、版本模板或未解析 Release 资产升级为一键下载。

## A direct-stable 候选

| productId | 最终 URL | 文件名 | 允许域名 |
|---|---|---|---|
| audacity-desktop | https://github.com/audacity/audacity/releases/download/Audacity-3.7.8/audacity-win-3.7.8-64bit.exe | audacity-win-3.7.8-64bit.exe | release-assets.githubusercontent.com |
| canva-windows | https://desktop-release.canva.com/Canva%20Setup%201.123.1.exe | Canva Setup 1.123.1.exe | desktop-release.canva.com |
| coreldraw-graphics-suite | 官方 Corel 下载页给出的 EXE | CDGS2025.exe | www.corel.com |
| craft-desktop | https://www.craft.do/download/desktop/Craft%20Installer.exe | Craft Installer.exe | luki-prod-us-east-1-web.s3.us-east-1.amazonaws.com |
| docker-desktop | https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe | Docker Desktop Installer.exe | desktop.docker.com |
| deepl-desktop | https://appdownload.deepl.com/windows/0install/DeepLSetup.exe | DeepLSetup.exe | appdownload.deepl.com |
| evernote-desktop | https://win.desktop.evernote.com/builds/Evernote-latest.exe | Evernote-latest.exe | win.desktop.evernote.com |
| finevoice-desktop | https://dlaudio.fineshare.net/source/finevoice-setup.exe | finevoice-setup.exe | dlaudio.fineshare.net |
| tana-outliner | https://assets.tana.inc/desktop/Tana-Setup-windows.exe | Tana-Setup-2026.29.20+c0082d7-windows.exe | assets.tana.inc |
| taskade-workspace | https://apps.taskade.com/updates/Taskade_Setup_4.6.14.exe | Taskade_Setup_4.6.14.exe | apps.taskade.com |
| teamviewer-remote-ai | https://dl.teamviewer.com/download/version_15x/TeamViewer_Setup_x64.exe | TeamViewer_Setup_x64.exe | dl.teamviewer.com |
| xmind-ai | https://dl3.xmind.cn/Xmind-for-Windows-x64bit-26.05.01105-202607290750.exe | Xmind-for-Windows-x64bit-26.05.01105-202607290750.exe | dl3.xmind.cn |
| wondershare-edrawmax | 官方万兴下载页列出的 EXE | 万兴图示_安装程序.exe | cc-download.wondershare.cc |
| wondershare-edrawmind | 官方万兴下载页列出的 EXE | 万兴脑图_Installer.exe | cc-download.wondershare.cc |
| wondershare-filmora | https://download.wondershare.com/filmora_full846.exe | filmora_full846.exe | download.wondershare.com |
| wondershare-pdfelement | 官方万兴下载页列出的 EXE | Wondershare_PDFelement_Installer.exe | cc-download.wondershare.cc |

## 交接边界

A 候选共 16 项，仅进入桌面产品管理的后续合同复核，不自动发布或授予安装权限。B/C/D/E 本轮为 0。其余 203 项保持 F，需未来逐项官方研究。候选 JSON 不含 command、args、env、script、headers、credentials。

