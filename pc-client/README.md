# AI Hub PC

AI Hub 是一个以厂商为第一层的 Windows AI 产品目录与安装管理客户端。页面内容由后台目录驱动，本机探测、下载、校验、安装和卸载能力由客户端固定白名单控制。

## 本地运行

安装依赖并启动桌面客户端：

```powershell
npm.cmd install
npm.cmd run desktop
```

启动完整本地服务：

```powershell
npm.cmd run release:local:up
```

本地入口：

- 后台管理：`http://127.0.0.1:4173`
- 身份服务：`http://127.0.0.1:4180`
- 邮件测试箱：`http://127.0.0.1:8025`
- Flarum 社区：`http://127.0.0.1:8088`
- HTTPS 发布源：`https://localhost:4443`

这些地址只绑定本机回环接口。Docker Compose 内置凭据仅用于本地开发，不能用于生产环境。

## 当前能力

- 厂商优先的主页、全部厂商、厂商详情、产品和教程。
- Web 产品打开官网；普通桌面软件打开官方下载页。
- 已审核桌面软件支持下载、断点续传、SHA-256/Authenticode 校验、打开安装器和安装后复检。
- Codex CLI、Claude Code、Gemini CLI 等 CLI 产品使用客户端固定模块部署。
- 后台管理厂商、产品、排序、启停、首页内容、发布参数和目录历史版本。
- 邮箱验证码注册、登录、刷新会话、退出、资料维护和设备会话撤销。
- PC 账号通过 60 秒、单次使用票据进入 Flarum，无需再次输入社区密码。
- Docker 本地运行 PostgreSQL、身份服务、Mailpit、MariaDB、Flarum、后台和只读 HTTPS 发布源。
- Windows Portable 与 NSIS 安装包、隔离安装/升级/卸载验收脚本。

## 常用验证

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:identity-community
npm.cmd run release:local:test-server
npm.cmd run release:local:pin-tls
npm.cmd run package:win:local-release
npm.cmd run release:local:test-client
```

Windows 安装生命周期：

```powershell
npm.cmd run package:win
npm.cmd run test:windows-installer
```

## 安全边界

- 后台不能向客户端下发任意 EXE、Shell、PowerShell 或 CMD 命令。
- 自动化执行只允许客户端内置、版本化、可测试的白名单模块。
- 图形桌面产品默认只打开厂商官方下载地址；只有经过审核并进入本地白名单的产品才能托管下载和校验。
- “安装器已打开”不等于“软件已安装”，必须通过固定探针重新检测。
- 正式发布仍需要生产 HTTPS 域名、正式邮件服务、独立密钥、Windows 代码签名、监控告警和外部安全评估。

当前完成度见 [开发状态](docs/development-status.md)，真实 Windows 与产品行为见 [用户验收清单](docs/user-acceptance-checklist.md)。
