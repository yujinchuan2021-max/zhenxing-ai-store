# Google app for desktop catalog intake candidate（2026-08-06）

状态：仅候选，未保存、发布、封包或上传。

## 客户端裁决

Google 的一手产品页将 **Google app for desktop** 描述为 Windows 10+ 的独立桌面应用，覆盖 AI-powered responses、Lens、跨电脑及 Google Drive 搜索。其稳定官方入口为 `https://dl.google.com/windows-google-app/GoogleAppInstaller.exe`；本轮 HEAD 为 200、`application/x-msdos-program`、12,411,832 bytes，且仅以 1 KiB Range 获得 206/`bytes 0-1023/12411832`，没有下载完整制品。

现有 `desktop-download-only.signed-catalog` 已完整承载该候选：它只接受签名目录的 HTTPS URL、无路径文件名、`exe|msi|msix|zip` 与最多四个 HTTPS 镜像；下载完成后仅由用户点击打开文件。`dl.google.com` 不需要写入客户端静态允许列表，canonical 计划从当前已签名 artifact URL 派生唯一 host。没有新增客户端 profile、下载执行器、安装器启动、检测、打开产品、卸载、更新或 AI Hub 收据。

完整的机器可消费字段、来源 precondition、禁止字段及内存验证输入见同名 JSON。后台在再次确认 draft revision 89 与 v2 active6 release ID 后，只需通过现有 canonical module 导入该一项候选；不得把候选视为发布授权。
