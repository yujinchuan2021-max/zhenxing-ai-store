# 通用桌面下载模块迁移候选（draft84）

> **SUPERSEDED**：本文件仅保留为历史证据，禁止作为候选消费或导入入口。后续唯一输入为 [desktop-download-canonical-migration-candidate-draft84-2026-08-05.md](desktop-download-canonical-migration-candidate-draft84-2026-08-05.md) 及同名 `.json`。两份候选语义相同，Tana 只能导入一次。

只读来源：revision store authoritative draft84、immutable signed v2 active1 release 与既有官方深查 `windows-desktop-download-deep-research-rev83.json` / Markdown。

## 结果

| 项目 | 数量 |
|---|---:|
| draft84 产品 | 615 |
| draft84 official-page 产品 | 214 |
| 可立即迁移为真实一键下载 | 1 |
| 保持 official-page/blocked | 213 |

仅纳入同时已有最终 HTTPS 文件 URL、文件名和制品类型的记录。下载页、动态按钮、登录、版本模板和未解析 Release 资产均不纳入。

## 候选

| productId | 最终制品 | 文件名 | 类型 | URL 派生 host |
|---|---|---|---|---|
| tana-outliner | https://assets.tana.inc/desktop/Tana-Setup-windows.exe | Tana-Setup-2026.29.20+c0082d7-windows.exe | exe | assets.tana.inc |

官方证据入口：https://tana.inc/download  
候选迁移：desktop-official / official-page → `desktop-download-only.signed-catalog` / desktop-download-only；module/profile 均使用稳定 ID。host 由验签目录内的 HTTPS URL 派生，不作为后台可写字段。仅候选，仍需独立复核。

## 排除

coreldraw-graphics-suite 在既有深查中虽记录 `CDGS2025.exe` 文件名，但 `finalArtifactUrl` 实际是 Corel 产品页而非文件 URL，严格排除，不猜测或重建下载链接。

## 源漂移

磁盘原始 state 显示 draft84 为 615 产品；immutable signed v2 active1（`catalog-v00000001-d20c8aa29d87-96030cc9`）也为 615 产品，并包含 agenticseek-cli。旧候选中的“active v2=614、agenticseek-cli 仅 draft 存在”已过时。Tana 在两侧均存在且仍为 desktop-official / official-page，因此本轮只保留候选，不写 draft。

未下载、未安装、未改 catalog/state，未调用 saveDraft 或发布。候选不含 command、args、env、script、headers、credentials。
