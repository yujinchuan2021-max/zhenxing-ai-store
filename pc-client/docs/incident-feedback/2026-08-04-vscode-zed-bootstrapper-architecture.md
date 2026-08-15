# VS Code 与 Zed 安装器引导壳架构误判

日期：2026-08-04

## 现象与证据

用户在 `0.1.34` Portable 中分别下载 Visual Studio Code 与 Zed，两个任务都在完整下载后显示“安装包架构或产品身份与客户端白名单不匹配”，错误码均为 `DOWNLOADED_INSTALLER_INVALID`。

- Visual Studio Code：完整接收 232,347,808 bytes；SHA-256 为 `8cd4350898dec154d97104c9126bd52aebb387bb6824b4349ffba1c347fded34`；Authenticode 为 `Valid`，签名者为 `Microsoft Corporation`；VersionInfo 为 `Visual Studio Code` / `Visual Studio Code Setup` / `Microsoft Corporation`；PE Machine 为 `0x014c`（x86）。
- Zed：完整接收 91,201,584 bytes；SHA-256 为 `f9e73b28ed1d202832dc2ff1e5df1be46297d16ac7aa1762f230f7c9995fd5b3`；Authenticode 为 `Valid`，签名者为 `Zed Industries Inc`；VersionInfo 为 `Zed` / `Zed Setup` / `Zed Industries`；PE Machine 为 `0x014c`（x86）。

两款产品的旧合同都只产生一项 `ARCHITECTURE_MISMATCH: expected x64, actual x86`。只把被下载 PE 引导壳的预期架构改为 x86 后，其他校验原样通过。

## 根因

首批桌面产品审计把下载入口和文件名中的 x64 当成了安装器可执行文件的 PE 架构。VS Code 与 Zed 的 x64 应用载荷都由 x86 Inno Setup bootstrapper 承载。

Jan 出现同类问题后，修复和回归测试只覆盖了 Jan，没有把同一批次的 Inno 产品一起放进表驱动身份门禁，因此同一错误在两个兄弟产品中残留。

## 排除的错误猜测

- 不是网络或断点续传问题：两个任务都在完整接收文件后进入本地身份校验失败。
- 不是下载损坏：大小与 SHA-256 均和审计证据一致。
- 不是签名或产品名称变化：Authenticode、签名主体和全部要求的 VersionInfo 字段都通过。
- 不是旧客户端：复现进程和任务记录来自 `0.1.34` Portable。

## 修复

- 同步修正 VS Code、Zed 在统一桌面白名单和生命周期合同中的下载 PE 架构为 `x86`。
- 保留官方来源、允许主机、Zed 固定 SHA-256、有效签名与全部 VersionInfo 校验。
- 重新计算两款产品的独立审批合同哈希，旧审批自动失效。
- 把 Jan、VS Code、Zed 合并进一个表驱动回归测试，明确“x64 应用载荷可以使用 x86 安装器引导壳”。

## 自动验证

- 新回归测试在旧合同时稳定失败，修复后通过。
- 开发客户端分别完整下载 VS Code 232,347,808 bytes 与 Zed 91,201,584 bytes，并通过哈希、签名、PE 与 VersionInfo 身份校验。
- `0.1.35` Portable 分别完整下载 VS Code 232,347,808 bytes 与 Zed 91,201,584 bytes，两个任务均进入 `completed`，并再次通过哈希、签名、PE 与 VersionInfo 身份校验。
- `0.1.35` Setup 的隔离安装、启动、关闭、卸载、目录清理和注册项清理验证通过；本地 HTTPS 发布运行时读取目录 `v68` 与客户端版本 `0.1.35`。

## 剩余人工验收

自动化不会运行第三方安装器。仍需用户确认两款产品的交互安装选项、首次启动、厂商更新、数据保留和卸载。

## 防复发门禁

`expectedInstallerIdentity.architecture` 只描述客户端下载后将要启动的 PE 文件 Machine，不描述文件名、下载通道或最终应用载荷。每个新受管桌面产品在进入白名单前必须保存真实 PE Machine 证据；同一批产品的同类安装器必须进入同一表驱动回归测试，不能只修截图中的一个产品。
