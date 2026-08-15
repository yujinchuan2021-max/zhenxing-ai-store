# Open Interpreter `rust-v0.0.34` Windows standalone 实物核验

核验日期：2026-08-04  
核验范围：Open Interpreter 官方仓库、官网文档、GitHub Release/Release API，以及 Release 中的 Windows x64/ARM64 归档。没有执行官网远程安装脚本，也没有修改业务代码。

## 结论

- **AI Hub 可以直接把官方 `.tar.gz` 完整解压到自己独占的版本目录，并用绝对路径运行 `bin\interpreter.exe`；运行本身不需要复刻官方 `current` junction、可见 `bin` junction 或用户 `PATH`。** 官方运行时会从 `bin\interpreter.exe` 上溯识别同一包根目录的 `codex-package.json`，再定位 `codex-path` 和 `codex-resources`；这种 package-layout 识别独立于“是否属于官方 standalone 安装”。[官方 install-context 实现](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/codex-rs/install-context/src/lib.rs#L204-L225)
- **必须保留完整归档树，不能只抽取 `interpreter.exe`。** Windows 包还包含短命令别名、code-mode host、内置 `rg.exe`、命令运行器和 Windows sandbox setup helper；官方安装器也把这些文件作为完整性条件。[官方包布局说明](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/codex_package/README.md#L7-L50) [官方安装器完整性检查](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L603-L645)
- **只有要保留 Open Interpreter 自己的 standalone 自更新和全局 `interpreter`/`i` 命令语义时，才需要采用官方 releases/current/visible-bin/PATH 布局。** 官方把可执行文件位于 `INTERPRETER_HOME\packages\standalone\releases` 下作为 standalone 识别条件；位于任意 AI Hub 目录的完整包仍能使用内置资源，但安装方法会是 `Other`，因此 `interpreter update` 不会接管更新。[官方 standalone 识别条件](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/codex-rs/install-context/src/lib.rs#L258-L282) [官方更新动作选择](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/codex-rs/tui/src/update_action.rs#L29-L52)
- **最小安全方案是由 AI Hub 固定并校验 `.tar.gz`，完整解压、绝对路径启动、关闭启动时更新检查，并由 AI Hub 自己更新和卸载。** 不执行可变的 `irm ... | iex`，不写用户 `PATH`，不创建 junction，卸载时只删 AI Hub 拥有的版本目录和收据，保留 `%USERPROFILE%\.openinterpreter` 用户数据。官方支持单次运行用 `-c key=value` 覆盖配置，并明确提供 `check_for_update_on_startup` 开关。[CLI `-c` 说明](https://www.openinterpreter.com/docs/terminal/cli-reference#global-flags) [更新检查配置](https://www.openinterpreter.com/docs/terminal/config-reference#top-level-keys)

## 1. Release 身份与 Windows 资产

截至核验时，GitHub `releases/latest` 返回 `rust-v0.0.34`，Release 名称为 `Open Interpreter 0.0.34`，发布时间为 `2026-07-18T03:43:04Z`。[官方 latest API](https://api.github.com/repos/openinterpreter/openinterpreter/releases/latest) [官方 Release](https://github.com/openinterpreter/openinterpreter/releases/tag/rust-v0.0.34)

该 Release 对每个 Windows 架构同时发布 `.tar.gz` 和 `.tar.zst` 两种同一 package directory 的序列化；**官方 Windows PowerShell 安装器选择 `.tar.gz`**，构造名为 `open-interpreter-package-<target>.tar.gz`，并用 `tar -xzf` 解压。[官方包格式说明](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/codex_package/README.md#L24-L25) [安装器资产选择与解压](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L877-L930)

| 架构 | 官方资产与直接下载 URL | 字节数 | SHA-256 | 压缩格式 | 官方安装器选择 |
| --- | --- | ---: | --- | --- | --- |
| Windows x64 | [`open-interpreter-package-x86_64-pc-windows-msvc.tar.gz`](https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter-package-x86_64-pc-windows-msvc.tar.gz) | `262,895,929` | `c87adf4f85ef6a2eb36135ce8f583257a590a6e7e460de5ab9832cdde3187e4e` | gzip-compressed tar (`.tar.gz`) | **是** |
| Windows ARM64 | [`open-interpreter-package-aarch64-pc-windows-msvc.tar.gz`](https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter-package-aarch64-pc-windows-msvc.tar.gz) | `244,858,690` | `9e9f3a016cbfb627552291ea6e2900bc3b94859add976295edb62a452236abc1` | gzip-compressed tar (`.tar.gz`) | **是** |
| Windows x64 | [`open-interpreter-package-x86_64-pc-windows-msvc.tar.zst`](https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter-package-x86_64-pc-windows-msvc.tar.zst) | `196,854,100` | `918cb47c84a927a4a6c3aa3b35adc7844c2dbcb71a9f06abb53ac9ac0ee284a8` | Zstandard-compressed tar (`.tar.zst`) | 否 |
| Windows ARM64 | [`open-interpreter-package-aarch64-pc-windows-msvc.tar.zst`](https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter-package-aarch64-pc-windows-msvc.tar.zst) | `183,625,105` | `77ff868c45888f5fd8c21bc7d684e13be025dceea596677b6ca44bb22742bed4` | Zstandard-compressed tar (`.tar.zst`) | 否 |

以上精确字节数和 GitHub `digest` 可在该 tag 的 [官方 Release API](https://api.github.com/repos/openinterpreter/openinterpreter/releases/tags/rust-v0.0.34) 复核；四个 SHA-256 也由 Release 随附的 [`codex-package_SHA256SUMS`](https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/codex-package_SHA256SUMS) 给出。此次重新下载并计算的两个 `.tar.gz` 哈希与 API 和校验清单逐字一致。官方发布工作流同时对 `.tar.gz`/`.tar.zst` 生成该清单并上传全部资产。[官方发布工作流](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/.github/workflows/rust-release.yml#L284-L316)

AI Hub 应固定上表两个 `.tar.gz`，不必为这一版引入 `.tar.zst` 解压能力。

## 2. 归档内完整布局

两个 `.tar.gz` 都**没有外层顶级文件夹**；解压后 `codex-package.json`、`bin/`、`codex-path/`、`codex-resources/` 直接出现在目标目录根部。以下是对两个官方归档逐项列出的全部常规文件；路径及构建用途也与官方 package builder 一致。[x64 官方归档](https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter-package-x86_64-pc-windows-msvc.tar.gz) [ARM64 官方归档](https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter-package-aarch64-pc-windows-msvc.tar.gz) [官方布局生成代码](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/codex_package/layout.py#L40-L112)

```text
<package-root>/
├── codex-package.json
├── bin/
│   ├── interpreter.exe
│   ├── i.exe
│   └── codex-code-mode-host.exe
├── codex-path/
│   └── rg.exe
└── codex-resources/
    ├── codex-command-runner.exe
    └── codex-windows-sandbox-setup.exe
```

| 相对路径 | x64 解压后字节数 | ARM64 解压后字节数 | 角色 |
| --- | ---: | ---: | --- |
| `codex-package.json` | `231` | `232` | 布局元数据；两架构仅 `target` 字符串长度不同 |
| `bin\interpreter.exe` | `359,823,872` | `310,059,008` | **主入口** |
| `bin\i.exe` | `359,823,872` | `310,059,008` | `i` 短命令别名；与同架构 `interpreter.exe` 字节相同 |
| `bin\codex-code-mode-host.exe` | `54,915,072` | `51,349,504` | code-mode host helper |
| `codex-path\rg.exe` | `4,266,496` | `3,930,112` | 包内 ripgrep；运行时优先解析此路径 |
| `codex-resources\codex-command-runner.exe` | `1,253,888` | `1,153,536` | Windows command runner helper |
| `codex-resources\codex-windows-sandbox-setup.exe` | `9,063,424` | `8,071,680` | Windows sandbox setup helper |

AI Hub 实际作为启动入口校验的 `bin\interpreter.exe` 摘要为：x64
`9cd0f4714c1e5f73012dc53f516fe473c5da05914c26b5e1c41a9a2a0cee2cb7`，
ARM64
`9eb92382748d59976b963f2ef9df1e3a54b18a0d7cdf6cefd1e91231701a512`
（SHA-256）。两个值均从上表固定 `.tar.gz` 解压后的真实入口重新计算；
ARM64 只做静态摘要核验，没有在 x64 机器上冒充原生运行验收。

归档中的元数据值为：

```json
{
  "layoutVersion": 1,
  "version": "0.0.34",
  "target": "x86_64-pc-windows-msvc | aarch64-pc-windows-msvc",
  "variant": "open-interpreter",
  "entrypoint": "bin/interpreter.exe",
  "resourcesDir": "codex-resources",
  "pathDir": "codex-path"
}
```

其中 `target` 在各自归档中是单一对应值，不含竖线；上面为节省篇幅合并展示。官方 builder 把 Open Interpreter variant 定义为 `interpreter` 主入口加 `i` 别名，并从同一版本字段写入 package metadata。[官方 package builder 说明](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/codex_package/README.md#L33-L38) [官方 metadata 写入代码](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/codex_package/layout.py#L101-L112)

### 哪些文件必须同行

- 对 `bin\interpreter.exe` 的普通启动，`bin\i.exe` 只是别名；但 AI Hub 仍应原样保留，不应自行裁剪官方包。[官方别名生成代码](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/codex_package/layout.py#L48-L59)
- `codex-package.json` 必须留在 `bin` 的父目录；运行时据此识别 package root，并从该 root 查找 `codex-path` 与 `codex-resources`。[官方 package-layout 识别代码](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/codex-rs/install-context/src/lib.rs#L204-L225)
- `codex-path\rg.exe` 是包内搜索工具；运行时优先使用它。`codex-resources` 下的两个 Windows helper 和 `bin\codex-code-mode-host.exe` 都是官方 Windows package 的组成部分，安装器会拒绝缺失这些文件的包。[官方资源解析代码](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/codex-rs/install-context/src/lib.rs#L143-L186) [官方完整性检查](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L603-L645)

因此最安全的收据单位是“整个 package root”，而不是一个 EXE。

## 3. `--version` 与绝对路径运行

官方安装文档使用 `interpreter --version` 验证安装。[官方安装文档](https://www.openinterpreter.com/docs/terminal/install)

本次把 x64 官方 `.tar.gz` 完整解压到一个既不在用户 `PATH`、也不在 `%USERPROFILE%\.openinterpreter\packages\standalone\releases` 下的临时独占目录，然后从另一个工作目录通过绝对路径运行：

```text
<absolute-package-root>\bin\interpreter.exe --version
interpreter 0.0.34
exit code: 0

<absolute-package-root>\bin\i.exe --version
interpreter 0.0.34
exit code: 0
```

该实测使用的输入是上表 [x64 官方归档](https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter-package-x86_64-pc-windows-msvc.tar.gz)，并与 metadata 的 `version: 0.0.34` 一致。ARM64 包的 metadata 同样为 `0.0.34`，但本机是 x64，未冒充 ARM64 原生设备执行验收；ARM64 原生 `--version`/交互启动仍应在 ARM64 Windows 设备上做最终接受测试。[ARM64 官方归档](https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter-package-aarch64-pc-windows-msvc.tar.gz)

这次只验证了归档、资源解析前提和版本探针；没有把它表述为模型登录、交互会话、sandbox 或 ARM64 物理设备的完整用户验收。

## 4. 官方 Windows 安装布局与语义

核验时官网 [`install.ps1`](https://www.openinterpreter.com/install.ps1)、Release 随附的 [`install.ps1`](https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/install.ps1) 和 tag `52a3101` 的 [安装器源码](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1) 三者 SHA-256 都是 `0dba88771f3a53fc35cb715cb98cfac644c9b7ff2901c6c88c853baf5605ee64`。这里只下载、读取和哈希，没有执行远程脚本；Release 页也公开该安装器 digest。[官方 Release 资产清单](https://github.com/openinterpreter/openinterpreter/releases/expanded_assets/rust-v0.0.34)

### 4.1 路径

默认路径和环境变量优先级如下；这些值来自该 tag 的官方安装器。[官方路径实现](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L836-L855)

| 含义 | 默认值 | 覆盖优先级 |
| --- | --- | --- |
| 用户数据/产品 home | `%USERPROFILE%\.openinterpreter` | `INTERPRETER_HOME`，否则兼容 `CODEX_HOME` |
| standalone root | `<home>\packages\standalone` | 随 home |
| 版本目录 | `<standalone>\releases\0.0.34-<target>` | 版本和 `x86_64-pc-windows-msvc`/`aarch64-pc-windows-msvc` 决定 |
| 当前版本入口 | `<standalone>\current` junction | 指向版本目录 |
| 用户可见 bin | `%LOCALAPPDATA%\Programs\Open Interpreter\bin` junction | `OPEN_INTERPRETER_INSTALL_DIR`，否则兼容 `CODEX_INSTALL_DIR` |
| 用户 PATH 项 | 上述可见 bin | 精确加入用户级 `PATH` |

安装器只接受 64 位 Windows，根据 `RuntimeInformation.OSArchitecture` 把 `X64` 映射为 `x86_64-pc-windows-msvc`、把 `Arm64` 映射为 `aarch64-pc-windows-msvc`。[官方架构选择](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L805-L834)

### 4.2 安装与更新

官方流程是：解析指定版本或最新 `rust-v*` Release；读取 GitHub API 资产 digest；下载并验证 `codex-package_SHA256SUMS`；再下载并验证对应 `.tar.gz`；解压到同版本 staging；检查完整布局；移动到 `releases\<version-target>`；把 `current` junction 指向该版本；把可见 bin junction 指向 `current\bin`；最后验证 `interpreter.exe --version` 和 `i.exe --version`。[Release 解析与 digest 读取](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L94-L142) [下载、校验与安装](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L877-L975) [入口验证](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L787-L803)

更新已有安装时，安装器在 install lock 下复用完整的目标版本或重装不完整版本，并直接重定向已由安装器拥有的 junction，避免更新中出现 `current`/可见 bin 暂时消失的窗口；它拒绝重定向不属于该 installer root 的 junction，也拒绝替换非空普通目录或其他 reparse point。[官方 junction 所有权与重定向](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L475-L545) [安装锁与切换](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L899-L975)

可见 bin 不在用户 `PATH` 时，安装器把它加入用户级 `PATH`，并更新当前 PowerShell 进程的 `PATH`；检测到冲突安装时会把自己的 bin 提到前面。[官方 PATH 处理](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/scripts/install/install.ps1#L995-L1027)

官方文档说明 standalone 可在交互启动时检查更新；`interpreter update` 或重新运行公开安装器都会安装最新版本。源代码进一步表明，只有 `InstallMethod::Standalone` 才选择 Windows standalone 更新动作，该动作以 non-interactive 模式重新获取并执行官网 `install.ps1`。[官方更新文档](https://www.openinterpreter.com/docs/terminal/install#updating) [更新动作选择](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/codex-rs/tui/src/update_action.rs#L29-L72) [Open Interpreter 更新命令源](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/codex-rs/product-info/src/lib.rs#L20-L40)

### 4.3 卸载与用户数据保留

官方 Windows 卸载示例先确认可见 bin 是 reparse point，且目标位于 standalone root 下；否则拒绝删除。确认所有权后，它删除可见 bin junction、整个 `packages\standalone`、以及用户 `PATH` 中与可见 bin 精确匹配的项。[官方 Windows 卸载命令](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/docs/install.md#L90-L122)

卸载**有意保留** `.openinterpreter` 中除 `packages\standalone` 外的数据，包括配置、sessions、logs 和 file-stored credentials，以便重装后继续使用；只有用户明确要求彻底清除并完成备份后，才删除 `%USERPROFILE%\.openinterpreter`。即便删除该目录，也不会删除 OS keyring 或环境变量中的凭据。使用自定义 `OPEN_INTERPRETER_INSTALL_DIR`、`INTERPRETER_HOME`、`CODEX_INSTALL_DIR` 或 `CODEX_HOME` 时，卸载路径必须相应替换。[官方保留数据语义](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/docs/install.md#L51-L56) [自定义路径与彻底清除警告](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/docs/install.md#L126-L136)

## 5. AI Hub 最小安全实现建议

现有 portable-binary 驱动若已经支持受限的多文件 `.tar.gz` 目录归档，则不需要复刻官方安装器，只需为本产品固定下面的窄参数：

1. 仅允许 `windows/x64 -> x86_64-pc-windows-msvc.tar.gz` 和 `windows/arm64 -> aarch64-pc-windows-msvc.tar.gz` 两个映射；URL、精确字节数、SHA-256 和入口相对路径 `bin\interpreter.exe` 全部写在受审清单中，后台不得下发任意 URL、命令或相对入口。
2. 下载后先核对精确大小和 SHA-256；安全检查 tar 项，拒绝绝对路径、`..`、链接/reparse 项、重复路径和清单外类型；解压到 AI Hub staging 后再原子切换为独占版本目录。
3. 原样保留整个 package root。安装完成探针使用绝对路径 `<version-dir>\bin\interpreter.exe --version`，期望精确输出 `interpreter 0.0.34` 和退出码 `0`。
4. AI Hub 启动命令直接使用该绝对路径，并为受管运行附加 `-c check_for_update_on_startup=false`；不要把官网远程脚本或 `interpreter update` 当作 AI Hub 更新驱动。`-c key=value` 是官方支持的单次运行覆盖方式。[官方 CLI flags](https://www.openinterpreter.com/docs/terminal/cli-reference#global-flags)
5. 更新时安装新独占版本、通过探针后更新 AI Hub 收据/活动入口；旧版本在没有运行中进程引用后再清理。无需创建官方 `current` junction，也无需写用户 `PATH`。
6. 卸载只删除 AI Hub 收据明确拥有的 package version directory；保留 `%USERPROFILE%\.openinterpreter`，不碰用户配置、sessions、logs、项目文件、凭据、用户手装的 Open Interpreter 或官方 standalone 安装。
7. 如果未来产品要求“任何新终端都能直接输入 `interpreter`/`i`”或要求 `interpreter update` 自己工作，应把它作为单独、显式的全局安装模式，再完整复刻官方 junction/PATH/所有权检查和保留用户数据语义；这不是当前绝对路径启动所必需的最小实现。[官方 managed standalone 目的](https://github.com/openinterpreter/openinterpreter/blob/52a31019714294add53cafbc5268e1467b471263/docs/install.md#L6-L25)

## 6. 核验边界

- 已完成：latest/tag/资产/API 核对；四个 Windows 资产的精确大小和 SHA-256；两个 `.tar.gz` 的官方 checksum 复算；两个归档的完整文件树和 metadata 检查；x64 包通过绝对路径执行 `interpreter.exe --version` 与 `i.exe --version`。
- 未执行：任何官网远程安装脚本；安装器对真实用户 `PATH`/junction 的写入；模型供应商登录或凭据配置；完整交互会话；Windows sandbox 行为；ARM64 原生设备运行。
- 因此本文足以决定 AI Hub 的固定归档驱动和目录语义，但不能替代 x64/ARM64 用户设备上的完整安装、启动、更新、卸载接受测试。
