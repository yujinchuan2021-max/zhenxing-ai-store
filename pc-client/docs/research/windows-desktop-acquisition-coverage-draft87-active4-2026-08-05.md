# Windows 桌面获取覆盖候选（draft87 / v2 active4）
## Import gate correction (2026-08-05)

- The canonical import set is six changes, not four: `alibaba-dingtalk-ai`, `blender`, `meitu-ultra`, `portraitpro`, `raycast-windows`, and `spark-mail-windows`; no-op count is 259.
- DingTalk and Spark retain the reviewed exact `apps.microsoft.com` Store URLs already recorded in this JSON; the catalog must replace their current generic download-page Store actions.
- Raycast retains the reviewed, credential-free `https://get.microsoft.com/installer/download/9PFXXSHC64H3` redirect. It is a Store external-open action only, never an AI Hub download task or receipt.
- The shared validator admits only the exact Microsoft installer redirect shape (12-character Store ID, no query or fragment); other `get.microsoft.com` paths remain rejected.


仅候选、不可发布；只读研究。来源为 authoritative revision 87 / v2 active4（615 产品），Windows 图形全集 265 个。未修改 catalog、state、代码，也未下载或安装制品。

## 汇总

- 覆盖：265 条，productId 唯一 265，缺失 0，重复 0。
- changedRecords（4）：blender（store→direct-artifact）、meitu-ultra（no-windows→manual-selector）、portraitpro（download-page→manual-selector）、raycast-windows（download-page→store）。
- noChange：261 条（包含 91 条现有 direct/client-managed 的身份与不降级核对）。
- 推荐策略：direct-artifact 92、vendor-bootstrap 5、download-page 143、login-required 18、store 3、manual-selector 3、no-windows 1。
- blockedProductIds：165；逐项原因位于 JSON 的 records[].blockedReason。login-required 按 CTO 裁决保留登录后入口，本轮不深挖、不绕过。

## 优先深查

### PortraitPro

目录 ID：anthropics/portraitpro。官方页 [PortraitPro 下载页](https://www.anthropics.com/portraitpro/download/) 明确提供 “Windows or Mac” 选择器和 “Windows 64-bit” 选项，提交 “Get Free Download” 表单；页面未暴露可长期复用的固定 EXE URL。因此建议 manual-selector，不猜测 POST 后文件地址。

### Raycast

目录 ID：raycast/raycast-windows。官方 [Raycast for Windows](https://www.raycast.com/windows) 页面显示 Windows 10+、Microsoft Store 入口，并说明 Store 被阻止时可用 WinGet。对官方 [ray.so/download-windows](https://ray.so/download-windows) 仅做 HEAD，302 到 https://get.microsoft.com/installer/download/9PFXXSHC64H3；因此建议 store，保留 Microsoft Store 协议入口，不把 WinGet 当下载合同。

### 其他本轮有变化

- Blender 官方 [下载页](https://www.blender.org/download/) 当前暴露 https://www.blender.org/download/release/Blender5.2/blender-5.2.0-windows-x64.msi，文件名与 msi 匹配，建议 direct-artifact（versioned）。
- 美图云修官方 [下载页](https://ultra.meitu.com/download) 明确有 Windows 客户端（Win7/Win10/Win11），但版本/稳定版与普通版按钮由动态脚本加载，未确认固定文件 URL，建议 manual-selector，不再标 no-windows。

## 方法与门禁

- 对 172 external/no-windows 入口执行官方 URL HEAD（HEAD-no-body，不读取/下载安装器正文）；PortraitPro、Raycast、Blender、Meitu Ultra 另做官方 HTML/redirect 核验。
- direct-artifact 仅保留现有 authoritative HTTPS URL、可核验 fileName 和 artifactKind（exe/msi/msix/zip）；vendor-bootstrap 只打开厂商安装中心；store 仅保留明确 Store 协议入口。
- 下载页、登录后动态按钮、平台/版本选择、无 Windows 入口均保留明确策略与 blocker；不猜版本、URL、文件名或命令。
- JSON forbiddenFieldScan.found=[]，禁止字段（command/args/env/script/headers/credentials/label/HTML）未出现。

完整 265 条机读记录、changed/noChange、blockedProductIds、证据 URL、host、版本标记和核验时间见同名 JSON。
