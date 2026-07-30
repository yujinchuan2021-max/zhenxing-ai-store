# AI Hub PC

AI Hub Windows 客户端按照“厂商为第一层”的产品思维导图实现。

## 本地运行

```powershell
npm.cmd install
npm.cmd run desktop
```

本地 CMS：

```powershell
npm.cmd run admin
```

后台地址：`http://127.0.0.1:4173`

## Windows 打包

```powershell
npm.cmd run package:win
```

输出目录：`release/`

- `AI-Hub-0.1.0-Windows-x64-Portable.exe`
- `AI-Hub-0.1.0-Windows-x64-Setup.exe`

正式包使用 `catalog/channel.production.json`，不会携带本机 CMS 地址。生产发布前需要填写真实 HTTPS 目录地址、重新打包并使用正式 Windows 代码签名证书签名。

## 当前功能

- 主页、厂商目录、厂商旗下桌面端/CLI/其他产品和教程。
- 搜索、工具特性筛选、A–Z 排列。
- CMS 管理品牌、Slogan、轮播、精选厂商、厂商、产品和其他板块。
- PC 环境检测、官方环境安装入口、可信卸载项确认。
- GUI 安装包下载、SHA-256 与 Authenticode 校验、安装后重新检测。
- Codex CLI、Claude Code、Gemini CLI 固定白名单部署。
- Windows 便携版和 NSIS 安装版。

## 发布门槛

- 不以“安装器已打开”代替“软件已安装”；必须通过固定探针重新检测。
- 不从 CMS 执行任意本机命令；环境和 CLI 动作由客户端白名单固定。
- 正式发布需要 HTTPS 目录、Windows 代码签名和真实机器安装/卸载验收。
- 账号、邮箱验证码和社区部署仍需业务与服务方案确定后接入。

