# active5 catalog/artifact 7 项 FAIL 官方复核（candidate-only）

核验时间：2026-08-06。权威输入为 `v2-active5-0.1.52-full-discovery-2026-08-06-final.{md,csv}`（265 唯一、140 PASS / 103 BLOCKED / 22 FAIL）和 active5 发布包 `catalog-v00000005-9654219dbedb-3f44cffa`（draftRevision 88，615 产品）。本文件及 JSON 仅候选，不修改 catalog/state/code，不 saveDraft/publish/package。

## 结论总览

7 项均找到一手可核验获取路径：Quark、Fireflies、Pieces、Zoom 为官方稳定跳转；Upscayl、Blender、Anytype 为收到首段的版本化官方制品；均未继续保留原失效入口。

| productId | 原失败 | 建议 | 证据与最终入口 | HEAD / Range |
|---|---|---|---|---|
| `alibaba-quark-ai-browser` | 旧 umcdn V1.2.5.25 404 | `stable-redirect` | [夸克官网](https://www.quark.cn/)；[官方跳转](https://download.quark.cn/download/quarkpc?ch=pcquark@default) → `QuarkPC_V7.0.5.931...exe` | 302 → 200 `application/octet-stream`, 3316024；206 `0-1023/3316024` |
| `fireflies-desktop` | staging `Fireflies Setup 0.1.23.exe` 404 | `stable-redirect` | [Fireflies Desktop](https://fireflies.ai/desktop)；[官方 Windows 跳转](https://m.fireflies.ai/desktop/releases/download?platform=windows) → `Fireflies Setup 0.1.38.exe` | 302 → 200 `application/x-msdos-program`, 221304736；206 `0-1023/221304736` |
| `upscayl-desktop` | GitHub `latest/upscayl-latest-win.exe` 404 | `direct-artifact` | [Upscayl 下载页](https://upscayl.org/download)；[官方 latest API](https://api.github.com/repos/upscayl/upscayl/releases/latest)；v2.15.0 `upscayl-2.15.0-win.exe` | 302 → 200 `application/octet-stream`, 260912662；206 `0-1023/260912662` |
| `blender` | `www.blender.org/...msi` 301 后变 HTML；实测 47755 bytes 对比预留 536918667 | `direct-artifact` | [Blender 下载页](https://www.blender.org/download/) → [官方 CDN MSI](https://download.blender.org/release/Blender5.2/blender-5.2.0-windows-x64.msi) | CDN 200 `application/octet-stream`, 365240320；206 `0-1023/365240320` |
| `pieces-for-developers` | `pieces.app/download` 404 | `stable-redirect` | [Pieces Windows EXE 文档](https://docs.pieces.app/products/meet-pieces/windows-installation-guide/exe) → [官方构建跳转](https://builds.pieces.app/stages/production/pieces_for_x/windows-exe/download?download=true&product=DOCUMENTATION_WEBSITE) → `out-windows.exe` | 302 → 200 `application/x-msdownload`, 113015544；206 `0-1023/113015544` |
| `zoom-workplace` | 旧 Zoom download-center 404 | `stable-redirect` | [Zoom 官方安装器索引](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060407)；x64 [官方跳转](https://zoom.us/client/latest/ZoomInstaller.exe?archType=x64) → `ZoomInstaller.exe` | 302 → 200 `application/octet-stream`, 38034584；206 `0-1023/38034584` |
| `anytype-desktop` | `anytype.io/downloads` 404 | `direct-artifact` | [Anytype 下载壳](https://download.anytype.io/)；[官方 latestRelease API](https://publish-releases.anytype.io/api/v1/latestRelease) WINDOWS → `Anytype Setup 0.56.1.exe` | 200 `application/vnd.microsoft.portable-executable`, 231536320；206 `0-1023/231536320` |

## Blender 47,755 bytes 异常解释

失败记录的 `www.blender.org/download/release/Blender5.2/blender-5.2.0-windows-x64.msi` 首次响应是 301，Location 为同一路径的尾斜杠 URL；跟随后响应为 `text/html; charset=UTF-8`，Range 头显示 HTML 总长度 10,820 bytes。它不是 MSI，故“完成 47,755 bytes”只能解释为 HTML/错误页面内容被误当制品，不能与预留 536,918,667 bytes 比较为 MSI 截断。Blender 官方 CDN 的同版本路径则返回 `application/octet-stream`，真实长度 365,240,320，且 1 KiB Range 为 206；建议改用 CDN URL。

## 当前入口降级处理

- Pieces 的旧 download page 已 404；官方 Windows 文档明确给出 EXE、AppInstaller 和 WinGet 三种路径。本候选只采用已验证 EXE 稳定跳转，不把 WinGet 命令写入目录执行字段。
- Zoom 的旧产品 download-center 已 404；官方安装器索引明确列出 Windows 32-bit、64-bit、ARM 及 MSI，x64 EXE 稳定入口返回有效制品。
- Anytype 的旧 downloads 页面已 404；当前官方 Nuxt 下载壳通过 `publish-releases.anytype.io/api/v1/latestRelease` 提供 WINDOWS 精确 EXE、版本、大小和 SHA-512。

## 探测边界与事故记录

所有最终制品只做 HEAD 和 1 KiB Range，未保存、安装或运行完整安装包。一次 Fireflies 页面提取命令误使用 `curl -L`，将官方重定向后的约 210 MB 响应流入管道；未落盘、未安装、未启动，随后已改用 HEAD/Range。该偏差已写入 JSON，供验收审计。

禁止执行字段扫描：`command`、`args`、`env`、`script`、`headers`、`credentials` 均无违规写入；所有记录仍为 candidate-only。
