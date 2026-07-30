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
