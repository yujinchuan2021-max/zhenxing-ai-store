# OpenFang 官方 Windows CLI 发布核验

核验日期：2026-08-04  
核验范围：只检查 OpenFang 官方 GitHub 仓库、官方 Release、官方文档和官方发布包；未修改生产代码。

## 结论

- 当前最新稳定版是 [`v0.6.9`](https://github.com/RightNow-AI/openfang/releases/tag/v0.6.9)，官方发布页记录的发布日期是 **2026-05-12**。
- Windows 的 `.msi` / `-setup.exe` 是 **Tauri 桌面应用安装器**，不是独立 CLI 安装器。x64 MSI 的只读文件表中只有 `openfang-desktop.exe`，没有 `openfang.exe`。官方文档同时说明桌面应用内部包含完整 OpenFang 系统，因此更准确的表述是：**MSI 安装的是带图形界面的完整桌面应用，但不提供可单独调用的 `openfang.exe` CLI。**
- 独立 Windows CLI 在两个官方 ZIP 中：
  - 普通 Intel / AMD 64 位 Windows：[`openfang-x86_64-pc-windows-msvc.zip`](https://github.com/RightNow-AI/openfang/releases/download/v0.6.9/openfang-x86_64-pc-windows-msvc.zip)
  - Windows on ARM：[`openfang-aarch64-pc-windows-msvc.zip`](https://github.com/RightNow-AI/openfang/releases/download/v0.6.9/openfang-aarch64-pc-windows-msvc.zip)
- 两个 ZIP 的结构都很简单：**压缩包根目录只有一个文件 `openfang.exe`**，没有二级目录、运行时或额外 DLL。
- CLI 版本探测命令是 `openfang.exe --version`；本次直接运行 v0.6.9 x64 官方包得到 `openfang 0.6.9`。
- 因此，OpenFang Windows CLI **适合做 AI Hub 固定本地驱动的一键部署**：按 CPU 架构选择官方 ZIP，下载、解压单个 EXE 到 AI Hub 收据管理的用户目录，再用绝对路径执行 `--version`。不需要 MSI，也不需要 Rust、Node、Python、WSL 或 Docker。

## 1. 官方发布物如何区分

官方发布工作流明确分成两个独立任务：

1. `desktop` 任务从 [`crates/openfang-desktop`](https://github.com/RightNow-AI/openfang/tree/acf2587e46be174c10200489c9a2d23a39a98aeb/crates/openfang-desktop) 构建 Tauri 桌面应用，并生成 Windows `.msi` 和 `-setup.exe`。
2. `cli` 任务用 `cargo build ... --bin openfang` 构建 CLI，并把 Windows 的 `openfang.exe` 压缩为架构对应的 ZIP。

直接证据见官方 [`release.yml`](https://github.com/RightNow-AI/openfang/blob/acf2587e46be174c10200489c9a2d23a39a98aeb/.github/workflows/release.yml)。其中 Windows CLI 的两个目标是 `x86_64-pc-windows-msvc` 与 `aarch64-pc-windows-msvc`，打包命令只把 `target/<target>/release/openfang.exe` 放入 ZIP。官方 [`openfang-cli/Cargo.toml`](https://github.com/RightNow-AI/openfang/blob/acf2587e46be174c10200489c9a2d23a39a98aeb/crates/openfang-cli/Cargo.toml) 也把 CLI 二进制名称声明为 `openfang`；桌面工程则把二进制名称声明为 [`openfang-desktop`](https://github.com/RightNow-AI/openfang/blob/acf2587e46be174c10200489c9a2d23a39a98aeb/crates/openfang-desktop/Cargo.toml)。

v0.6.9 的完整官方资产清单可在 [`expanded_assets/v0.6.9`](https://github.com/RightNow-AI/openfang/releases/expanded_assets/v0.6.9) 查看。

## 2. 发布包实测结果

以下结果来自 2026-08-04 对 v0.6.9 官方资产的只读下载与检查。

| 架构 | 官方 ZIP | ZIP 大小 | ZIP 内结构 | `openfang.exe` 解压后大小 | 官方 SHA-256 |
| --- | --- | ---: | --- | ---: | --- |
| Windows x64 | [`openfang-x86_64-pc-windows-msvc.zip`](https://github.com/RightNow-AI/openfang/releases/download/v0.6.9/openfang-x86_64-pc-windows-msvc.zip) | 25,037,204 bytes | 根目录 `openfang.exe` | 70,922,752 bytes | `18f5a8f6b563304749ce07444de8ca901fccb45e06a2e5a074fbbfbec037dc9f` |
| Windows ARM64 | [`openfang-aarch64-pc-windows-msvc.zip`](https://github.com/RightNow-AI/openfang/releases/download/v0.6.9/openfang-aarch64-pc-windows-msvc.zip) | 22,543,669 bytes | 根目录 `openfang.exe` | 58,110,976 bytes | `0c9b59460e94202583af973cd21be8d2ec864f94d90b05d0ab1fc948b3cd7f63` |

官方校验文件：

- [x64 `.zip.sha256`](https://github.com/RightNow-AI/openfang/releases/download/v0.6.9/openfang-x86_64-pc-windows-msvc.zip.sha256)
- [ARM64 `.zip.sha256`](https://github.com/RightNow-AI/openfang/releases/download/v0.6.9/openfang-aarch64-pc-windows-msvc.zip.sha256)

### 2.1 解压后 `openfang.exe` 的只读核验

本次分别从上述两个官方 ZIP 解压根目录的 `openfang.exe`，重新计算文件哈希，并通过 Windows `Get-AuthenticodeSignature` 读取签名状态：

| 架构 | 解压后 `openfang.exe` SHA-256 | Authenticode | 签名者 |
| --- | --- | --- | --- |
| Windows x64 | `3104389ca4809431b0fd6e6aaf1bcef6a8774bea5ac0e598bc707bf6daee214d` | `NotSigned` | 无 |
| Windows ARM64 | `a4141d75f773413b23f6e8974e02eb68b25c1e449adbc70c25ca8ab1ad16d71c` | `NotSigned` | 无 |

这两个 EXE 哈希是 2026-08-04 从 v0.6.9 官方 ZIP 解压后得到的可复现结果；OpenFang Release 官方发布的是 ZIP 的 `.sha256`，没有单独发布 EXE 哈希。两个 CLI 可执行文件都没有 Authenticode 数字签名，因此不能把 ZIP 哈希匹配表述成“Windows 发布者签名已验证”。

x64 MSI [`OpenFang_0.6.9_x64_en-US.msi`](https://github.com/RightNow-AI/openfang/releases/download/v0.6.9/OpenFang_0.6.9_x64_en-US.msi) 的 Windows Installer 文件表只有：

```text
openfang-desktop.exe | 73,541,632 bytes | 0.6.9.0
```

没有 `openfang.exe`。这与官方发布工作流和桌面工程的二进制声明一致，所以 AI Hub 的 CLI 产品不能调用 MSI。

## 3. Windows 支持与官方命令

官方 [`README`](https://github.com/RightNow-AI/openfang/blob/acf2587e46be174c10200489c9a2d23a39a98aeb/README.md#quick-start) 和 [`Getting Started`](https://github.com/RightNow-AI/openfang/blob/acf2587e46be174c10200489c9a2d23a39a98aeb/docs/getting-started.md#option-3-powershell-installer-windows) 都明确列出原生 Windows PowerShell 安装路径：

```powershell
irm https://openfang.sh/install.ps1 | iex
openfang init
openfang start
```

官方 [`scripts/install.ps1`](https://github.com/RightNow-AI/openfang/blob/acf2587e46be174c10200489c9a2d23a39a98aeb/scripts/install.ps1) 的实际行为是：识别 x64 / ARM64、读取最新或指定版本、下载上面的架构 ZIP、可用时核对 `.sha256`、复制 `openfang.exe`、写入用户 PATH，最后执行 `openfang.exe --version`。

官方 [`CLI Reference`](https://github.com/RightNow-AI/openfang/blob/acf2587e46be174c10200489c9a2d23a39a98aeb/docs/cli-reference.md#global-options) 把 `--version` 定义为打印当前 `openfang` 二进制版本；[`Getting Started`](https://github.com/RightNow-AI/openfang/blob/acf2587e46be174c10200489c9a2d23a39a98aeb/docs/getting-started.md#verify-installation) 也将 `openfang --version` 作为安装验证命令。

## 4. AI Hub 一键部署可行性

### 可以自动完成的部分

1. 识别 Windows CPU 架构。
2. 只允许官方仓库 `RightNow-AI/openfang`、固定 tag 和固定资产命名模板。
3. 下载对应 ZIP，并在 AI Hub 自己的用户级安装目录中解压根目录的 `openfang.exe`。
4. 用安装收据记录版本、架构、资产 URL 和 EXE 绝对路径。
5. 直接执行 `<绝对路径>\openfang.exe --version`，预期输出格式为 `openfang <version>`。
6. 安装成功后打开终端运行 `openfang init`；若产品流程明确选择快速初始化，也可使用官方支持的 `openfang init --quick`。

这条路径不需要 UAC，也不依赖 MSI。官方 PowerShell 安装器已经证明 ZIP 是官方支持的 Windows CLI 分发方式；AI Hub 自己实现固定下载/解压驱动，可以避免执行远程 PowerShell 文本，同时保留同样的官方产物。

### 不能混为“安装完成”的部分

- `openfang.exe` 落盘和 `--version` 通过，只代表 CLI 安装完成。
- 官方文档说明 OpenFang 仍需要初始化工作区并配置至少一个 LLM provider/API key。`openfang init` 是用户配置阶段，不能因为 ZIP 已解压就宣称产品已经可直接工作。
- `openfang init --quick` 可以跳过交互提示，但凭据仍应由用户在本机提供，不能由后台下发。

## 5. 最终固定值

| 字段 | 值 |
| --- | --- |
| 当前稳定 tag | `v0.6.9` |
| 发布日期 | `2026-05-12` |
| Windows x64 CLI 资产 | `openfang-x86_64-pc-windows-msvc.zip` |
| Windows ARM64 CLI 资产 | `openfang-aarch64-pc-windows-msvc.zip` |
| ZIP 内可执行文件 | `openfang.exe`（位于根目录） |
| 版本探测 | `openfang.exe --version` |
| v0.6.9 x64 实测输出 | `openfang 0.6.9` |
| MSI 产品定位 | Tauri 桌面应用；不安装独立 `openfang.exe` CLI |
| Windows CLI 固定驱动 | **可准入**：官方 ZIP 下载 + 单文件解压 + 绝对路径探测 |

版本、URL、哈希和包结构均为 2026-08-04 的点时核验结果。后续发布新版本时，应重新读取官方 `releases/latest` 与对应 Release 资产；后台只能更新受限的版本/资产参数，不能下发任意命令或任意下载地址。
