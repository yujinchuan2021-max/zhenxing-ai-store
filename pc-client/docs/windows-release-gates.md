# Windows 发布与升级门槛

## 已自动验证

- TypeScript 与 Vite 生产构建。
- Electron 主进程、预加载脚本和共享校验器语法。
- 生产依赖审计。
- NSIS 隔离安装、安装版启动、静默卸载。
- 卸载后的安装目录、注册表、桌面快捷方式和开始菜单残留。
- 正式包内目录通道与更新通道默认关闭。
- 便携版、安装版 SHA-256 与 Authenticode 状态。

运行安装生命周期验收：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\scripts\test-windows-installer.ps1
```

脚本仅安装到 `%LOCALAPPDATA%\AIHubAcceptance\` 下的随机隔离目录，并使用安装包自带卸载器清理。脚本不会递归删除失败的安装目录。

生成本地 `0.1.1` 升级测试包并执行覆盖升级验收：

```powershell
npm.cmd run package:win:upgrade-fixture
npm.cmd run test:windows-upgrade
```

覆盖升级脚本会拒绝在已有正式 AI Hub 安装记录时运行。它验证 `0.1.0 → 0.1.1` 的注册表版本、可执行文件版本、启动状态和用户数据保留，然后调用新版自带卸载器清理隔离安装。

## 更新通道

- PC 客户端只手动检查更新，不在后台自动下载。
- 更新清单必须使用 HTTPS；仅开发环境允许 localhost。
- 清单中的下载地址必须使用 HTTPS。
- 更新通道必须通过 `allowedDownloadOrigins` 固定允许的下载来源；清单不能把用户重定向到未固定的站点。
- 客户端只打开已验证清单给出的官方下载页，不自动运行安装程序。
- `updates/channel.production.json` 在正式地址未确定前必须保持空。

## 正式发布前仍需人工完成

- 购买并配置 Windows 代码签名证书。
- 对主程序、卸载器、便携版和安装版验证有效 Authenticode 签名。
- 在真实 HTTPS 域名发布更新清单和安装包。
- 从已安装的旧版本升级到新版本，确认用户配置保留。
- 验证 Windows SmartScreen、开始菜单、桌面快捷方式和卸载面板。
- 在干净的 Windows x64 机器上完成一次人工安装、启动、升级和卸载。

未完成以上项目时，不应宣称已经完成生产发布或自动升级验收。
