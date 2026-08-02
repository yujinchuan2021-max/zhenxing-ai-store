# 枕星 AI PC

## 官方产品自动发现

从后台草稿目录读取已登记的厂商官网和产品入口，扫描官方页面并生成只供审核的候选报告：

```powershell
npm.cmd run catalog:discover -- --max-pages=3 --timeout-ms=3500 --concurrency=8 --resume
```

报告生成到 `output/catalog-research/`。脚本不会修改或发布后台目录；后台“产品候选”页面可以忽略、恢复或把已确认候选加入默认停用的产品草稿，补齐资料并主动启用后仍须走签名目录发布流程。本地 Docker 后台每 24 小时执行一次固定参数扫描，也可从页面手动重新扫描。

枕星 AI 是一个以厂商为第一层的 Windows AI 产品、AI 可接入产品与生态资源目录。页面内容由后台目录驱动，本机探测、下载、校验、安装和卸载能力由客户端固定白名单控制。

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

客户端本地白名单或目录发生变化后，统一使用下面的命令重建后台、替换草稿并发布。不要再手工调整发布顺序：

```powershell
npm.cmd run catalog:publish:local
```

本地入口：

- 后台管理：`http://127.0.0.1:4173`
- 身份服务：`http://127.0.0.1:4180`
- 邮件测试箱：`http://127.0.0.1:8025`
- Flarum 社区：`http://127.0.0.1:8088`
- HTTPS 发布源：`https://localhost:4443`

这些地址只绑定本机回环接口。Docker Compose 内置凭据仅用于本地开发，不能用于生产环境。

## 当前能力

- 厂商优先的主页、“全部 AI 厂商”和“全部 AI 可接入厂商”；同一厂商只保存一份资料，两个页面按产品目录职责分流。
- 独立 Skill、MCP 和插件商店，统一按资源类型、目标厂商和目标产品浏览；产品页不再显示扩展资源子目录。
- Web 产品打开官网；普通桌面软件打开官方下载页。
- 已审核桌面软件支持下载、断点续传、SHA-256/Authenticode 校验、打开安装器和安装后复检。
- Codex CLI、Claude Code、Gemini CLI 等 CLI 产品使用客户端固定模块部署。
- 后台管理厂商、产品、生态资源、来源与目标关系、排序、启停、首页内容、发布参数和目录历史版本。
- 统一个人中心管理昵称、个签、头像、邮箱、手机号、密码、设备会话、站内信、收藏和喜欢。
- Flarum 社区直接内嵌 PC，使用同一用户身份和独立社区分区，不再打开浏览器。
- PC 用户通过 60 秒、单次使用票据建立 Flarum 会话，无需再次输入社区密码。
- Docker 本地运行 PostgreSQL、身份服务、Mailpit、MariaDB、Flarum、后台和只读 HTTPS 发布源。
- Windows Portable 与 NSIS 安装包、隔离安装/升级/卸载验收脚本。

## 常用验证

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:identity-community
npm.cmd run test:personal-center-community
npm.cmd run release:local:recreate-server
npm.cmd run release:local:pin-tls
npm.cmd run package:win:local-release
npm.cmd run release:local:prepare
npm.cmd run release:local:verify
npm.cmd run release:local:up
npm.cmd run release:local:test-server
npm.cmd run release:local:pin-tls
npm.cmd run release:local:test-client
npm.cmd run test:packaged-managed-download -- openclaw-windows-hub
```

也可以直接运行 `npm.cmd run release:local:upgrade` 完成以上发布链路。本地打包会先校验短期证书配置，再生成 `BUILD.json`，把版本、安装包哈希和源码提交绑定在一起；发布包再用更新密钥签名这份来源证明。`release:local:test-client` 使用隔离 Windows 配置运行，并把真实下载达到 1 MiB 后可暂停作为发布门禁；不会复用或终止用户正在运行的 AI Hub。

Windows 安装生命周期：

```powershell
npm.cmd run package:win
npm.cmd run test:windows-installer
```

## 安全边界

- 后台不能向客户端下发任意 EXE、Shell、PowerShell 或 CMD 命令。
- 自动化执行只允许客户端内置、版本化、可测试的白名单模块。
- 生态资源目标只能引用客户端已批准的固定模块和安装配置；资源出现在商店不等于获得本地执行许可。
- 图形桌面产品默认只打开厂商官方下载地址；只有经过审核并进入本地白名单的产品才能托管下载和校验。
- “安装器已打开”不等于“软件已安装”，必须通过固定探针重新检测。
- 正式发布仍需要生产 HTTPS 域名、正式邮件服务、独立密钥、Windows 代码签名、监控告警和外部安全评估。

当前完成度见 [开发状态](docs/development-status.md)，真实 Windows 与产品行为见 [用户验收清单](docs/user-acceptance-checklist.md)。
