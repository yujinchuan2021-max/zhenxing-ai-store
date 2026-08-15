# MCP needs-official-review 复核（2026-08-05）

范围：对审计中需要官方复核的 6 个创作工具 MCP 候选，仅核对宿主厂商官方资料与现有候选仓库入口。未下载、未改 catalog/state、未调用 saveDraft。

## 结论

6 项均不能升级为安全固定安装 profile，全部 `blocked`。原因不是宿主 Windows 能力不足，而是当前 MCP 实现均为社区仓库，缺少厂商官方 MCP 身份背书；其中多数还缺少可审计的固定版本、依赖锁定、权限/凭据说明或安全卸载契约。按任务规则不得把社区包、远程 bootstrap、可变命令或缺版本锁的实现变成一键安装候选。

## 逐项复核

| id | 官方宿主证据与 Windows | MCP 身份/安装 | 权限与凭据 | 固定 profile 结论 |
| --- | --- | --- | --- | --- |
| `blender-mcp` | Blender 官方提供 Windows installer/portable，支持 x64/arm64；官方 Python API 允许脚本读写场景。 | `ahujasid/blender-mcp` 不是 Blender 官方仓库；依赖 Blender 插件与 Python 服务，当前记录无厂商发布版本锁。 | 可触达场景、对象、材质并执行 Python；凭据/外部网络权限不能由官方宿主资料确认。 | **blocked**：高权限、社区实现、无固定 release/profile。 |
| `godot-mcp` | Godot 官方文档说明 Windows 编辑器插件通过 Asset Library/ZIP 安装，并可在 Project Settings 启停。 | `tomyud1/godot-mcp` 是社区仓库；宿主官方资料不确认该 MCP 身份、包版本或安全安装方式。 | 可作用于项目编辑器；项目文件写入边界、凭据与依赖需上游固定版本审计。 | **blocked**：社区包且现记录为 rolling/review-required。 |
| `unreal-mcp` | Epic 官方下载页支持 Windows 10 64-bit，并要求 Epic Games Launcher/账号；官方资料提供引擎安装入口。 | `GenOrca/unreal-mcp` 是社区仓库，且候选包含 `execute_python`；无厂商官方 MCP 发布物或固定安装包证据。 | 可执行 Unreal/Python 类高影响操作；需要工程级授权、逐次确认和完整卸载边界。 | **blocked**：任意代码能力与社区包不满足安全 profile。 |
| `ableton-mcp-extended` | Ableton 官方提供 Live Windows 安装/卸载资料；宿主安装需用户授权。 | `uisato/ableton-mcp-extended` 是社区仓库，依赖 Remote Script/本地 Socket；没有厂商官方 MCP 身份或固定包证据。 | 可修改 Live Session；候选还涉及可选外部音频服务，凭据和网络权限不能由官方宿主资料确认。 | **blocked**：实时项目写入、社区实现、版本与依赖未锁定。 |
| `obs-mcp` | OBS 官方支持 Windows 10/11；OBS 28+ 内置 WebSocket。官方建议 WebSocket 开启认证并设置密码。 | `sbroenne/mcp-server-obs` 是社区仓库；OBS 官方只证明内置 WebSocket，不证明该 MCP 包或安装方式。 | 可控制场景、来源、录制/直播；WebSocket 密码必须由用户在 OBS 本地管理，目录不得收集。 | **blocked**：不能把社区 MCP 或密码配置变成固定安装 profile。 |
| `davinci-resolve-mcp` | Blackmagic 官方文档覆盖 Windows；官方版本资料提到 Scripting API，但未确认该 MCP。 | `samuelgursky/davinci-resolve-mcp` 是社区仓库；当前记录为 review-required，未提供固定版本、锁依赖和可验证 Windows 安装包。 | 可能修改项目、素材、渲染设置或脚本；Studio/External Scripting 前置条件和权限需用户确认。 | **blocked**：付费/版本前置复杂，社区包与安装契约未达标。 |

## 允许保留的候选形态

仅保留 `resource-link` 说明入口，卡片明确标注“社区实现，非宿主厂商官方 MCP”，链接到官方宿主资料和上游仓库；不提供安装、启停、移除或命令模板。后续只有在取得固定 release/commit、依赖锁定、SHA 校验、Windows 验证、权限/凭据说明和卸载方案后，才可重新申请 `mcp-managed` profile。

## 一手资料

- Blender：[Windows 下载](https://www.blender.org/download/)、[系统要求](https://www.blender.org/download/requirements/)、[Python API](https://www.blender.org/api/pythonapi.pdf)
- Godot：[官方插件安装文档](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/installing_plugins.html)
- Unreal：[Epic 官方下载与 Windows 要求](https://www.unrealengine.com/download)
- Ableton：[官方 Windows 安装说明](https://help.ableton.com/hc/en-us/articles/209773565-Installing-Ableton-Live)
- OBS：[官方下载](https://obsproject.com/download)、[官方 Remote Control/WebSocket 指南](https://obsproject.com/kb/remote-control-guide)
- DaVinci Resolve：[Blackmagic 官方 Resolve 20 编辑指南](https://documents.blackmagicdesign.com/UserManuals/DaVinci-Resolve-20-Editors-Guide.pdf)
