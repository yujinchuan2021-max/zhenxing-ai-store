# Python 已安装但客户端提示未安装

## 现象

Python 3.13.13 已安装，Python 安装器显示“Upgrade to Python 3.13.14”，但 AI Hub 在产品环境检测中仍显示“缺少：python”。

## 证据

- 解释器存在于 `C:\Users\yujin\AppData\Local\Programs\Python\Python313\python.exe`。
- 绝对路径执行返回 `Python 3.13.13`。
- `HKCU\Software\Python\PythonCore\3.13\InstallPath` 的 `ExecutablePath` 指向该解释器。
- 用户 `PATH` 只包含 `Python313\Scripts`，没有 `Python313` 根目录。
- `where.exe python` 因此找不到解释器。

## 根因

客户端读取了 Windows 已安装程序注册表，但 `installed` 字段只根据 `where.exe` 返回的位置生成。注册表结果只参与卸载项匹配，没有参与安装状态判断。

## 修复

- 环境位置改为联合解析命令路径和受信任的官方注册表位置。
- Python 会读取 HKCU、HKLM 及 WOW6432Node 下 `Python\PythonCore` 的 `ExecutablePath`。
- 注册表路径必须是绝对路径、文件名必须为 `python.exe`，并且文件必须真实存在。
- “打开安装位置”与产品环境检测复用同一套位置解析逻辑。

## 验证

- 回归测试覆盖“PATH 为空但官方注册表解释器存在”和“注册表残留路径不存在”。
- 真实桌面 IPC `scanEnvironment()` 返回：
  - `installed: true`
  - `location: C:\Users\yujin\AppData\Local\Programs\Python\Python313\python.exe`
  - `canUninstall: true`

## 防回归门槛

不能把 `PATH` 当成 Windows 软件是否安装的唯一证据。环境检测必须验证命令位置或受信任注册表提供的真实可执行文件。

## 2026-08-13 复发：精确注册表缺值被误判为探针失败

- 用户机器保留可信 Python 3.12.10；Python 3.13 的程序文件和卸载项均已不存在，但客户端长期显示“暂时无法确认”。
- `locateRegisteredPythonWithStatus` 对固定 `PythonCore\\3.x\\InstallPath` 的 `ExecutablePath` 做精确 `reg.exe` 查询。值不存在时 `reg.exe` 以代码 `1` 退出；Node 捕获的本地化 stderr 可能乱码，旧实现依赖错误文字匹配，因此把确定缺值误判为探针失败。
- 修复只作用于该精确值查询：`code === 1` 且没有 killed、timeout 或 signal 时视为 missing；超时、被终止和其他退出码继续 fail closed。通用卸载注册表递归扫描仍使用原有保守分类，没有放宽。
- 自动回归覆盖乱码 code 1、killed、timeout、signal、其他退出码；真实用户机器仍需重新扫描确认 Python 3.13 为 absent、Python 3.12.10 为 installed。
