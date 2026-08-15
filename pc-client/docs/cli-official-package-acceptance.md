# 官方 CLI 软件包隔离验收

日期：2026-08-03

## 目标

使用客户端生产模块验证固定版本的官方 npm、Windows 单文件和 Python Wheel 安装闭环，不污染用户全局环境，不执行远程动态脚本。

## 结果

| 驱动 | 已通过的产品 | 验收内容 |
| --- | --- | --- |
| `npm` | Codex、Gemini、Promptfoo、Continue、Ruflo、Agent TARS、Factory、Kilo、Letta、PixVerse、Qoder CN | 精确包版本、禁用生命周期脚本、真实 CLI 入口、隔离 prefix、收据卸载、无关文件保留 |
| `portable-binary` | Amp `0.0.1785761938-g468e20`、Daytona `0.190.0`、OpenFang `0.6.9`、ZeroClaw `0.8.4`、Open Interpreter `0.0.34` | 固定 HTTPS 域名与摘要、单文件/ZIP/`.tar.gz` 受限解压、完整目录树、真实版本探针、收据卸载、无关文件保留；Open Interpreter ARM64 只完成静态产物核验 |
| `python-venv` | Deepgram `0.2.26`、nanobot `0.3.0`、PraisonAI `4.6.159`、Aider `0.86.2` | Python 3.13/3.12 x64 私有 venv、99/93/90/109 个固定 Wheel 和哈希、`--no-index --require-hashes --no-deps`、命令启动、收据卸载 |
| `wsl-managed` | Auggie `0.34.0` | Ubuntu 24.04 内固定 Node `22.23.2` 和官方 npm tarball、禁用安装脚本与可选依赖、随机实例标记、HOME 同盘暂存与原子前缀、逐次 realpath guard、关闭产品自更新、收据卸载且不注销发行版；真实账号登录与交互仍需用户机器验收 |

验收脚本：

- `scripts/test-official-cli-packages.cjs`
- `scripts/test-official-binary-cli-artifacts.cjs`
- `scripts/test-official-python-cli-packages.cjs`

三个脚本都会创建独立系统临时目录，使用客户端生成的安装与卸载动作，并验证没有收据时不能生成受管卸载动作。二进制验收只读取当前 Windows 系统代理配置，不硬编码 Clash 或任何具体代理产品。

## 阻断边界

剩余 `cli-official` 已逐项记录阻断原因。WSL/Docker 多服务、动态团队安装器、源码工作区、浏览器/daemon、用户服务归属、多运行时或未支持的 Python 版本不能套用现有驱动；这些产品继续提供官网和教程，但不显示虚假的一键安装。OpenManus 与 NanoClaw 已改为源码/部署教程，AgenticSeek 的重复 CLI 卡已合并到自托管产品。

完整矩阵见 `docs/research/2026-08-03-windows-cli-catalog-closure.md`。

## 验收含义

隔离实包验收证明固定产物与客户端模块兼容，不等于用户日常账户的网络、UAC、登录、模型服务、付费额度或厂商许可流程已经全部验收。用户仍需在真实账户中确认首次登录和厂商交互。
