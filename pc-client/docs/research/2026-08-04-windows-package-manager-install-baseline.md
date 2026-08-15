# Windows 包管理器安装基线（2026-08-04）

## 结论

本轮先将 113 个已核对的 Windows 图形产品映射到客户端内置的固定 WinGet 包 ID，随后依据剩余产品审计补入 13 个精确 WinGet 包和 6 个精确 Microsoft Store Product ID，当前合计 132 个。后台只能选择这些已存在的产品配置；不能提供包 ID、源、命令、Shell 或安装参数。

客户端只调用系统的 `winget.exe`，并自行生成以下封闭操作：精确查询、安装、重装、升级、卸载。所有单产品操作都固定 `--id <客户端包ID> --exact --source <客户端固定来源>`；来源只能是 `winget` 或 `msstore`，不会拼接后台字符串，也不会通过 Shell 执行。

## 为什么采用 WinGet

WinGet 的社区源清单包含产品标识、发布者、官方下载地址、安装器类型和安装器 SHA-256。客户端固定包 ID 后，厂商升级版本通常只需由 WinGet 源更新清单；枕星 AI 不必把每个厂商的下载 URL 和版本哈希重新写进客户端。WinGet 在安装前依据清单校验下载内容，厂商安装界面、许可协议、UAC 和安装选项仍由用户确认。

微软官方资料：

- [WinGet install 命令](https://learn.microsoft.com/en-us/windows/package-manager/winget/install)
- [WinGet list 命令](https://learn.microsoft.com/en-us/windows/package-manager/winget/list)
- [WinGet upgrade 命令](https://learn.microsoft.com/en-us/windows/package-manager/winget/upgrade)
- [WinGet uninstall 命令](https://learn.microsoft.com/en-us/windows/package-manager/winget/uninstall)
- [Windows Package Manager 清单格式](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest)
- [安装器清单及 SHA-256 字段](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest?tabs=minschema%2Cversion-example#installer-manifest)

## 审核方法

1. 从当前后台目录中取得所有 `desktop-official` 产品。
2. 用产品名、厂商名和官网域名搜索 WinGet。
3. 对候选项运行 `winget show --id <ID> --exact --source winget`，比对发布者、产品名、官网和安装器来源。
4. 只把身份一致的包 ID 写入客户端静态表。
5. 对 132 行静态表计算 SHA-256，并在客户端固定该摘要；任何未审核修改都会使整张表失效。

## 明确排除的误匹配

以下搜索结果看似相近，但不是目录中的目标产品，因此没有进入固定映射：

| 目录目标 | 排除候选 | 原因 |
| --- | --- | --- |
| Visual Studio | VSDotNetLogCollect | 日志收集工具，不是 Visual Studio |
| Otter | Otter Browser | 同名浏览器，不是会议转录产品 |
| Firefox | CrashFirefoxIntentionally | 测试工具，不是 Firefox；已改用 `Mozilla.Firefox` |
| MATLAB | MATLAB Connector | 连接组件，不是 MATLAB 主产品 |
| DBeaver PRO | DBeaver Community | 不同授权版本 |
| DaVinci Resolve | DaVinci Resolve RPC Tool | 辅助工具，不是剪辑软件 |
| AutoCAD / Revit | BCF 插件 | 插件，不是 Autodesk 主产品 |
| Goose AI Agent | Pressly Goose | 数据库迁移工具，不是 AI Agent |
| BricsCAD Octave | GNU Octave | 不同产品 |
| Moises Live | Moises | 产品形态不同 |
| ClickUp Brain MAX | ClickUp | AI 桌面产品与普通客户端不同 |
| Dropbox Dash | Dropbox | 搜索产品与同步客户端不同 |
| Unity Editor | Unity Hub | Hub 只是启动器，不能代表 Editor 已安装 |
| Unreal Engine | Epic Games Launcher | 启动器不能代表引擎已安装 |
| Nous Research Hermes Desktop | `fathah.HermesDesktop` | 第三方 `fathah/hermes-desktop` 项目，不是目录中的 Nous Research 官方桌面产品 |

## 安全与产品边界

- WinGet 包 ID、源和允许的四种操作全部归客户端代码所有。
- 后台只能启停或选择已审核配置，无法下发任意 EXE、PowerShell、CMD、Shell、URL 或附加参数。
- `winget list` 的结果按精确包 ID 识别；相似名称不算已安装。
- 不能确认 Windows 主产品身份的条目仍保留“前往官方下载”，不伪装成一键安装。
- 自动化测试只验证静态白名单、固定参数和输出解析；真实 UAC、许可协议及厂商安装器交互仍需在 Windows 用户环境验收。
