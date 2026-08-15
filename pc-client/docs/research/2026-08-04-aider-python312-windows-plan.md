# AI Hub 受管 Aider 0.86.2 / Python 3.12 Windows x64 最小可靠方案

核对日期：2026-08-04

## 结论

AI Hub 应固定 **CPython 3.12.10 64-bit full installer**，而不是当前最新的 3.12 安全修复版。Python.org 明确说明 [3.12.10 是最后一个仍带二进制安装器的 3.12 版本](https://www.python.org/downloads/release/python-31210/)，并在当前 [3.12.13 发布页的 “No installers”](https://www.python.org/downloads/release/python-31213/) 中再次确认：3.12.10 之后的 3.12 安全发布只提供源码。

Aider 固定为 **`aider-chat==0.86.2` 的 base install（不带 extra）**。其 [PyPI 0.86.2 JSON](https://pypi.org/pypi/aider-chat/0.86.2/json) 与 [官方 `v0.86.2` `pyproject.toml`](https://github.com/Aider-AI/aider/blob/v0.86.2/pyproject.toml) 都给出 `Requires-Python: >=3.10,<3.13`，因此 3.12.10 在支持区间内，3.13 不在支持区间内。console entry 是 `aider = aider.main:main`。

针对 CPython 3.12 / Windows x64 的 base install 可以从 PyPI 生成全 wheel、全 SHA-256 的确定性清单：**109 个 wheel（Aider 根包 1 + 依赖 108），sdist 0，缺失 SHA-256 0**。Aider 官方源文件有 36 个一层依赖；官方编译后的 base requirements 在 Python 3.12 上选择 107 个依赖声明；Windows 解析时另增加 `click` 的传递依赖 `colorama==0.4.6`。本轮只解析和核验元数据/文件，没有安装 Python 或 Aider，也没有做真实启动验收。

## 1. Python 3.12.10 官方安装器身份

| 字段 | 固定值 | 一手依据 |
|---|---|---|
| 版本 / 架构 | `3.12.10`, `x64` | [Python 3.12.10 release](https://www.python.org/downloads/release/python-31210/) |
| 官方文件名 | `python-3.12.10-amd64.exe` | [Python.org 3.12.10 FTP index](https://www.python.org/ftp/python/3.12.10/) |
| 精确下载 URL | `https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe` | [官方下载文件](https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe) |
| 文件大小 | `26,964,224` bytes（发布页显示 `25.7 MB`） | [FTP index 的精确字节数](https://www.python.org/ftp/python/3.12.10/)、[release files table](https://www.python.org/downloads/release/python-31210/) |
| SHA-256 | `67b5635e80ea51072b87941312d00ec8927c4db9ba18938f7ad2d27b328b95fb` | [官方 Sigstore bundle](https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe.sigstore) 中的 SHA-256 digest；本轮下载后 `Get-FileHash -Algorithm SHA256` 复算一致 |
| Authenticode 状态 | `Valid` | 对上述固定哈希的官方 EXE 运行 `Get-AuthenticodeSignature` 的直接文件核验 |
| 签名发布者 | `CN=Python Software Foundation, O=Python Software Foundation, L=Beaverton, S=Oregon, C=US` | 同上，签名内嵌证书 Subject |
| 签名证书颁发者 | `CN=Microsoft ID Verified CS AOC CA 01, O=Microsoft Corporation, C=US` | 同上，签名内嵌证书 Issuer |
| 签名证书 thumbprint | `DE01DAAE82D04F466A576E178F6B07A839238953` | 同上 |
| Windows 文件身份 | Product name `Python 3.12.10 (64-bit)`；Product/File version `3.12.10150.0` | 同一固定哈希 EXE 的 Windows VersionInfo |

SHA-256 不能只写成本轮机器上的计算结果。客户端清单应固定上述值，并同时要求：下载域名/路径精确匹配、长度精确匹配、SHA-256 精确匹配、Authenticode `Status=Valid` 且 signer Subject 精确匹配。Sigstore bundle 是 Python.org 对同一 digest 的独立官方证明。

## 2. 静默 per-user 安装

Python 3.12 的 [Windows “Installing Without UI” 官方文档](https://docs.python.org/3.12/using/windows.html#installing-without-ui) 明确定义 `/quiet`、`/uninstall`、`/log`、`InstallAllUsers`、`TargetDir` 与各组件开关。AI Hub 应以 `shell: false` 传递固定 argv，不拼接 shell 命令，也不把运行时加入用户 PATH。

建议 argv（`<runtime-dir>` 与 `<install-log>` 必须是 AI Hub 根据当前用户受管根目录生成并完成边界校验的绝对路径）：

```text
/quiet
/log
<install-log>
InstallAllUsers=0
TargetDir=<runtime-dir>
AssociateFiles=0
CompileAll=0
PrependPath=0
AppendPath=0
Shortcuts=0
Include_doc=0
Include_debug=0
Include_dev=1
Include_exe=1
Include_launcher=0
InstallLauncherAllUsers=0
Include_lib=1
Include_pip=1
Include_symbols=0
Include_tcltk=0
Include_test=0
Include_tools=1
LauncherOnly=0
```

选择依据：

- `InstallAllUsers=0` 是官方 per-user 模式，不应触发全机 Python 安装。
- `Include_exe=1`、`Include_lib=1`、`Include_pip=1` 是创建 venv 和安装 Aider 所需组件；官方文档特别警告省略 executable、library 或 developer components 可能得到不可用安装，因此最小可靠方案保留 `Include_dev=1` 与 `Include_tools=1`。
- Aider 不需要 IDLE/Tk、文档、标准库测试、debug binaries 或 symbols，因此关闭这些组件。
- AI Hub 始终使用受管绝对路径，不需要 launcher、文件关联、快捷方式或 PATH 修改；这些全局集成全部关闭。

官方文档提醒，一般用户的 per-user 安装省略 launcher 只适合机器上已有全局 launcher 的情况。AI Hub 这里不是要提供通用用户 Python，而是提供只由客户端以绝对路径调用的应用私有 runtime，因此有意不把 launcher 纳入产品契约；真实 Windows 验收仍需确认该选择没有产生 installer repair/modify 副作用。

安装只允许在用户明确点击安装后开始。此时先核验下载文件，再检查目标目录和所有权冲突。保守规则是：若 [PEP 514](https://peps.python.org/pep-0514/) 的当前用户 `PythonCore\3.12` 注册已指向 AI Hub 受管目录之外，或目标目录已有无 AI Hub 收据的内容，则不得把该安装认领为 AI Hub 所有，也不得自动覆盖/卸载；应保持阻断并给出冲突提示。这条规则避免误修改用户已有的同版本 Python。

## 3. Python 检测、收据与卸载

### 安装后检测

不要用 `PATH` 上的 `python`、`py` launcher 或“任意 3.12”作为成功依据。成功状态必须同时满足：

1. AI Hub 收据记录 installer URL、长度、SHA-256、签名 Subject、精确 `TargetDir`、安装时间和管理 ID。
2. `<runtime-dir>\python.exe` 的 canonical path 仍位于收据中的受管目录。
3. 以固定绝对路径、`shell: false` 运行隔离探针，检查 `sys.executable` 指向该文件、`sys.version_info[:3] == (3, 12, 10)`、`struct.calcsize("P") * 8 == 64`。
4. 可用 [PEP 514 注册规范](https://peps.python.org/pep-0514/) 的 `HKCU\Software\Python\PythonCore\3.12\InstallPath` 做交叉检查，但注册表不能替代收据和精确 executable 检测。
5. 用该绝对 Python 创建 Aider venv；Aider 本身的成功检测再要求 venv 收据、`Scripts\aider.exe` 存在、`python -m pip check` 成功且 `aider --version` 精确为 `0.86.2`。

建议版本/位数探针语义：

```python
import os, struct, sys

expected = os.path.normcase(os.path.realpath(sys.argv[1]))
ok = (
    sys.version_info[:3] == (3, 12, 10)
    and struct.calcsize("P") * 8 == 64
    and os.path.normcase(os.path.realpath(sys.executable)) == expected
)
raise SystemExit(0 if ok else 1)
```

固定代码应以 `python.exe -I -S -c <fixed-code> <expected-python.exe>` 运行；`expected-python.exe` 由客户端从受管布局生成，不接受后台或用户提供任意代码片段。

### 卸载

Python 官方同一文档规定 `/uninstall` 删除 Python、`/quiet` 隐藏 UI。最小可靠卸载流程是：

1. 先卸载/删除仅由 AI Hub 收据拥有的 Aider 0.86.2 venv；不得删除项目仓库、Git 数据、Aider 用户配置或手工环境。
2. Python 3.12.10 runtime 若被其他 AI Hub 产品引用则保留；引用计数归零后才考虑卸载共享 runtime。
3. 只有收据、canonical `TargetDir`、Python 版本/位数和 PEP 514 交叉检查全部匹配时，才使用保留的同一固定哈希安装器（或重新下载并完成相同核验），以固定 argv `[/uninstall, /quiet, /log, <uninstall-log>]` 启动并等待退出。
4. 卸载后复查受管 `python.exe` 已不存在、PEP 514 项不再指向该受管路径；残留清理也只能发生在收据拥有且已通过边界校验的目录。
5. 任一所有权检查失败时，状态应为 unknown/mismatch，禁止自动卸载。尤其不得依据显示名搜索并删除任意用户 Python。

## 4. Aider 0.86.2 包身份与依赖结构

| 字段 | 固定值 | 一手依据 |
|---|---|---|
| Distribution | `aider-chat` | [PyPI 0.86.2 JSON](https://pypi.org/pypi/aider-chat/0.86.2/json) |
| Version | `0.86.2` | 同上、[官方 `v0.86.2` tag](https://github.com/Aider-AI/aider/tree/v0.86.2) |
| Requires-Python | `>=3.10,<3.13` | [PyPI JSON](https://pypi.org/pypi/aider-chat/0.86.2/json)、[`pyproject.toml`](https://github.com/Aider-AI/aider/blob/v0.86.2/pyproject.toml) |
| Console script | `aider = aider.main:main` | [`pyproject.toml` `[project.scripts]`](https://github.com/Aider-AI/aider/blob/v0.86.2/pyproject.toml)；本轮也从固定 wheel 的 `entry_points.txt` 复核 |
| 根 wheel | `aider_chat-0.86.2-py3-none-any.whl`, `377,009` bytes | [PyPI JSON](https://pypi.org/pypi/aider-chat/0.86.2/json)、[exact wheel](https://files.pythonhosted.org/packages/75/f7/e20749d9a510673e7adf910b005e3efe4ceaf9c194f1dd40d6931a3f34b9/aider_chat-0.86.2-py3-none-any.whl) |
| 根 wheel SHA-256 | `64f6a0c66c9f4633ad9f479bca3e64ebcba02b9da03c6b604b74a44736b2416e` | [PyPI JSON](https://pypi.org/pypi/aider-chat/0.86.2/json)；本轮下载复算一致 |
| Base 一层依赖 | 36 项 | [官方 `requirements/requirements.in`](https://github.com/Aider-AI/aider/blob/v0.86.2/requirements/requirements.in) |
| 官方编译依赖 | [`requirements.txt`](https://github.com/Aider-AI/aider/blob/v0.86.2/requirements.txt) 由 `uv pip compile` 生成；`pyproject.toml` 将它作为 distribution dependencies | [requirements.txt](https://github.com/Aider-AI/aider/blob/v0.86.2/requirements.txt)、[pyproject.toml](https://github.com/Aider-AI/aider/blob/v0.86.2/pyproject.toml) |
| Optional extras | `dev`, `help`, `browser`, `playwright` | [PyPI JSON](https://pypi.org/pypi/aider-chat/0.86.2/json) |

Aider 官方明确建议使用隔离环境，并说明其固定依赖版本是经过测试的组合；随意升级/降级（尤其 `litellm`）会造成导入或兼容问题，见 [Dependency versions](https://aider.chat/docs/troubleshooting/imports.html)。官方安装页也明确让 Aider 使用独立 Python 3.12，见 [Installation](https://aider.chat/docs/install.html)。这支持 AI Hub 使用独占 venv 和完整 hash lock，而不是把 Aider 装进项目环境或用户系统 Python。

“直接/传递”的口径需要区分：

- Aider 源码的真正一层输入是 `requirements.in` 的 36 项。
- Aider 把编译后的 `requirements.txt` 当作 wheel 的 dynamic dependencies，因此 PyPI `Requires-Dist` 对 base 暴露的是已经展开并固定的集合：base 共 108 条，其中两条 `tree-sitter` 由 Python 版本 marker 二选一；Python 3.12 实际选择 107 条。
- 在 Windows 上，`click==8.3.1` 还按自己的 marker 引入 `colorama`。它不在 Aider base 的 107 条选中声明中，所以 AI Hub 最终 lock 必须额外固定 `colorama==0.4.6` 的 [exact wheel](https://files.pythonhosted.org/packages/d1/d6/3965ed04c63042e047cb6a3e6ed1a63a35087b6a609aa3a15ed8ac56c221/colorama-0.4.6-py2.py3-none-any.whl) 与 SHA-256 `4f1d9991f5acc0ca119f9d443620b77f9d6b33703e51011c16baf57afb285fc6`。

## 5. 可复现的 PyPI wheel-lock 生成与安装

本轮在 Windows x64 / Python 3.12 上使用 pip 的 dry-run report，并强制 `--only-binary=:all:`、`--ignore-installed`。等价的显式目标命令如下；它只解析并写报告，不安装包：

```powershell
python -m pip install `
  --isolated `
  --disable-pip-version-check `
  --no-cache-dir `
  --dry-run `
  --ignore-installed `
  --only-binary=:all: `
  --platform win_amd64 `
  --python-version 3.12 `
  --implementation cp `
  --abi cp312 `
  --report aider-0.86.2-win-amd64-cp312.json `
  aider-chat==0.86.2
```

报告结果：109 个 install records；每个 `download_info.url` 都是 `https://files.pythonhosted.org/.../*.whl`，每个 `archive_info.hashes.sha256` 都是 64 位十六进制；没有 sdist fallback。本轮又对 109 项逐一请求 PyPI 官方 `https://pypi.org/pypi/<name>/<version>/json`：109/109 都能以 exact URL 匹配 `bdist_wheel`，且 JSON 中 SHA-256 与 report 完全一致。包括常见的原生风险项 `numpy`、`scipy`、`cffi`、`pydantic-core`、`orjson`、`regex`、`tiktoken`、`tree-sitter*`、`sounddevice`、`soundfile` 在内，均解析到了 CPython 3.12 / Windows x64 兼容 wheel。因此在 **base install** 范围内，不存在 Windows x64 / Python 3.12 无 wheel 的依赖。

为便于实现阶段检查生成物漂移，可将每项规范化为 `normalized-name|version|url|sha256`，按整行 ordinal 排序、以 LF 连接并保留末尾 LF；本轮 109 项规范化内容的 SHA-256 是 `2db4cd0cf2325efb69690f56ccd5eba15581fdc256074c35092b4d765a503f11`。这是研究快照指纹，不替代逐项 URL/hash 清单。

AI Hub 的最终 lock 应把 109 项全部转换为：

```text
Normalized-Name @ https://files.pythonhosted.org/.../exact.whl --hash=sha256:<exact-sha256>
```

安装时不再解析依赖，固定使用受管 venv 的绝对 Python：

```powershell
<venv-python> -I -m pip install `
  --isolated `
  --disable-pip-version-check `
  --no-input `
  --no-cache-dir `
  --only-binary=:all: `
  --no-compile `
  --require-hashes `
  --no-deps `
  --no-index `
  --requirement <aihub-owned-lock-file>
```

`--no-deps` 很重要：锁内已经显式列出完整闭包，安装阶段不能让 pip 重新选择版本或新 URL。`--no-index` 与 exact direct URLs 一起使用，确保只访问审核过的 PyPI artifacts。

本最小方案不请求 `dev`、`help`、`browser` 或 `playwright` extra；这些会显著扩大闭包（例如 help extra 会带入模型/ML 栈），不属于 Aider 核心 CLI 的最低交付。若未来产品需求明确启用任一 extra，必须为该 extra 单独重新生成、审核并做 Windows 实机验收，不能复用本 base lock 的“无缺 wheel”结论。

## 6. 实施与验收门槛

研究结论支持实现，但不能把本轮 dry-run/哈希核验当成用户机器验收。解除 `aider-cli` 阻断前至少需要：

1. 在干净 Windows x64 用户账户中真实静默安装 Python 3.12.10，核对 exit code、安装日志、PEP 514 注册、版本/位数探针和无 PATH/launcher/shortcut 污染。
2. 用 109-wheel lock 创建独占 venv，运行 `pip check`、`aider --version`、`python -m aider --version`。
3. 在真实 Git 仓库中完成一次不需要真实付费调用的启动/退出流程，再由用户自行完成模型供应商登录或 API key 配置；AI Hub 不代填密钥。
4. 验证 Aider venv 卸载不触碰仓库/用户配置；验证共享 Python runtime 的引用计数；最后验证同一官方 EXE `/uninstall /quiet` 的删除与残留语义。
5. 专门覆盖“用户已经有 Python 3.12.10/其他 3.12”与“PEP 514 指向外部目录”的冲突场景，确认 AI Hub 不认领、不覆盖、不卸载用户安装。

在这些真实闭环完成前，目录中可记录已审核版本与 artifact identity，但安装能力仍应保持 blocked/pending acceptance。
