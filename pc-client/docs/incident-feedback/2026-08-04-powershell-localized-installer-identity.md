# 中文厂商签名被误判为不匹配

日期：2026-08-04

## 现象

枕星 AI 0.1.35 Portable 能完整下载剪映、TRAE、TRAE Work 和豆包的固定官方安装包，SHA-256 也与客户端合同一致，但下载任务最终统一失败为 `DOWNLOADED_INSTALLER_INVALID`，提示安装包签发者与产品安全合同不匹配。

## 证据

- 同一固定 URL 的只读直采文件与客户端合同 SHA-256 完全一致，排除 CDN 内容漂移。
- 四个文件的 Windows Authenticode 状态均为 `Valid`。
- 签名主体分别是客户端已批准的中文公司名；完整证据见 `docs/research/2026-08-04-existing-desktop-identities-batch-a.md`。
- Google Antigravity 和 Cursor 使用英文签名主体，在同一客户端流程中通过。

## 根因

客户端通过 Windows PowerShell 读取签名 Subject 和 VersionInfo，再由 Node.js 按 UTF-8 解析 JSON。脚本没有显式固定 PowerShell 的输出编码；本地化字符可能按系统代码页输出，进入 Node.js 后发生损坏，导致正确的中文 Subject 无法匹配客户端正则。

## 被排除的错误猜测

- 不是下载链接失效：六款固定包都完整下载。
- 不是文件内容更新：实测 SHA-256 与固定合同一致。
- 不是证书失效：Windows 返回 `Valid`。
- 不能通过放宽为“只验 SHA”解决；滚动包和未来版本仍必须验证有效签名与产品身份。

## 修复

- 所有产生 JSON 的 PowerShell 身份探针先设置无 BOM UTF-8 输出。
- 六款已采样产品分别固定真实 PE Machine 与稳定 VersionInfo，不再从文件名中的 `x64` 推断引导壳架构。
- 目录发布脚本只把拥有完整生命周期合同和独立审批指纹的产品标记为 `desktop-reviewed`；其余产品自动退回官网下载，不再让不完整白名单拖垮整个目录。

## 自动验证

- `tests/core-desktop-installer-security.test.cjs` 固定 PowerShell UTF-8 门禁。
- `tests/windows-desktop-catalog.test.cjs` 验证只有完整审批产品进入本地执行白名单。
- 新客户端封装后仍要用真实 Portable 对中文签名产品执行完整下载重放。

## 剩余人工验收

自动验签与静态身份通过不等于安装、打开、更新和卸载已在用户机器完成。最终包仍需至少选择一款中文签名产品进行真实点击验收。

## 防复发

任何读取本地化 Windows 文本的 PowerShell JSON 探针都必须使用统一 UTF-8 前缀；新增中文签名厂商时必须同时覆盖真实下载重放，不能只写正则单元测试。
