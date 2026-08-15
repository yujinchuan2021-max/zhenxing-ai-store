# Canonical 通用桌面下载迁移候选（draft84）

唯一后续消费入口：本文件及同名 `.json`。旧 `universal-desktop-download-module-migration-candidate-draft84-2026-08-05.{md,json}` 仅为保留证据，已 superseded，禁止重复导入。

事实源：authoritative draft84（615 产品）与既有官方深查材料。只读整理，不下载、不安装、不修改代码/catalog/state、不 saveDraft、不发布。

## Canonical 合同

- productType/moduleId/installProfileId 固定为 desktop-download-only / desktop-download-only.signed-catalog。
- 下载参数只含 HTTPS url、fileName、artifactKind 和最多 4 个唯一 HTTPS mirrors。
- artifactKind 只能是 exe、msi、msix、zip；URL 后缀须与文件名制品类型匹配。
- 禁止 allowedHosts、command、args、env、script、headers、credentials。

## 结果

214 个 official-page 产品中，立即具备可核验最终 Windows 文件 URL 的新增候选：**1**。其余 **213** 项阻断，原因包括下载页、动态/登录按钮、模板版本 URL、最终制品 URL 缺失，或已有记录把产品页误写成 finalArtifactUrl。

| productId | 官方证据 | 最终 URL | fileName | artifactKind | mirrors |
|---|---|---|---|---|---|
| tana-outliner | https://tana.inc/download | https://assets.tana.inc/desktop/Tana-Setup-windows.exe | Tana-Setup-2026.29.20+c0082d7-windows.exe | exe | none |

Tana 仍需桌面产品管理复核后才能进入下一批导入。CorelDRAW 明确排除：现有深查记录的 finalArtifactUrl 是产品页而非文件 URL，不能猜测或重建。

既有 14 个 desktop-download-only 产品不重复计入本轮新增候选。候选 JSON 不包含命令、参数、环境、脚本、headers、凭据或 allowedHosts。
