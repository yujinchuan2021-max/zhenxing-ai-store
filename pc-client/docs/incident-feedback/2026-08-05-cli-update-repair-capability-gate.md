# CLI 更新与修复能力门禁

## 现象

authoritative draft revision 78 的 34 个 `cli-managed` 产品中，18 个未显示“更新”和“修复”。

## 证据与根因

- `shared/cli-driver-registry.cjs` 接受 `install`、`update`、`repair` 三种 intent；这不代表每个 driver 已实现安全协调。
- `portable-binary` 与 `python-venv` 原来只允许首次部署，已改为：只在精确 AI Hub 收据存在时先完成受控 staging，再交换受管目录；失败恢复旧目录。
- `companion-runtime`、`wsl-managed` 与 `managed-msi` 仍只允许首次部署。前两者分别包含运行时组件和 WSL 前缀，不能以卸载再安装冒充修复。

## 处理

14 个 portable-binary/Python profile 现公开更新和修复；不增加命令、参数、环境变量、下载地址或脚本。其余 4 项继续 partial。新增注册表与 staging 合同测试，防止仅修改展示能力而绕过 driver 的实际限制。

## 验证与后续验收

运行时仍以 authoritative catalog capability 再授权；若 draft 未同步这 14 项能力，IPC 会拒绝操作。自动测试不能替代真实 Windows 验收：仍需覆盖网络/代理、权限、登录、失败后的收据和数据保留；WSL/Auggie 还需真实 Ubuntu 发行版验收。

## 2026-08-05 managed-MSI update/repair

- `amazon-kiro-cli` and `ironclaw-cli` now share the receipt-gated managed-MSI reconcile path. Update downloads only the profile-pinned MSI and invokes fixed `/i`; repair invokes fixed local `msiexec /f <productCode>`.
- Both paths retain the existing receipt until executable path, trust, version and a replacement receipt verify. Download, installer startup and cancellation failures do not uninstall the existing product or remove its receipt.
- The authoritative draft still needs the two capability updates before IPC can authorize them. This is implementation and automated-contract evidence only, not Windows user acceptance.

## 2026-08-05 WSL lifecycle gate

- `augment-auggie-cli` update builds a fixed, hashed replacement under its AI Hub-owned prefix and swaps only after the staged Node 22/CLI checks pass; any post-swap failure restores the previous prefix. It leaves the WSL distribution and `~/.augment` untouched. Repair remains unavailable because the vendor's Node 20/22 and repair contract conflict is unresolved.
- `openclaw-wsl-gateway` remains partial: the current companion profile lacks an exact AI Hub receipt, fixed Node/service action contract, and a verified configuration backup-and-restore path. It must not adopt an existing `OpenClawGateway` distribution or emulate rollback through uninstall/reinstall.
- The catalog still needs the Auggie update capability before IPC authorization. Automated checks are not real Ubuntu WSL acceptance.
