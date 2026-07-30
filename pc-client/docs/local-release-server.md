# Docker 本地发布环境

第五阶段在没有真实服务器的前提下，使用 Docker 同时运行后台管理服务和只读 HTTPS 发布服务。

## 地址

- 后台管理：`http://127.0.0.1:4173`
- HTTPS 发布源：`https://localhost:4443`
- 健康检查：`http://127.0.0.1:4173/ready`、`https://localhost:4443/health`

后台负责厂商、产品、首页和已批准策略参数；PC 客户端继续持有安装白名单和执行权限。后台不能下发任意 EXE、Shell、PowerShell 或 CMD 命令。

## 一次性升级

```powershell
npm.cmd run release:local:upgrade
```

该命令依次执行：

1. 生成并签名新发布包。
2. 验证目录、更新清单和安装包完整性。
3. 自动备份当前发布版本并原子切换 `runtime/current`。
4. 启动或更新 Docker 服务。
5. 验证 TLS、Range 下载、文件大小和 SHA-256。
6. 重新生成本地验收客户端的短期证书指纹。

运行数据位于 `deployment/local/runtime`：

- `current`：Caddy 当前只读发布目录。
- `backups`：自动备份和手工备份。
- `staging`：发布切换前的临时目录。

签名私钥不进入发布目录、容器镜像或客户端包。本地开发密钥分别保存在被 Git 忽略的后台数据目录和 `deployment/local/private`。

## 备份与恢复

```powershell
npm.cmd run release:local:backup
npm.cmd run release:local:backups
npm.cmd run release:local:restore -- <backup-name>
```

恢复只接受工具列出的严格备份名。恢复前后都会重新验证整个发布包；当前版本会先自动备份，因此可以再次回退。恢复功能只提供本机 CLI，不暴露 HTTP 接口。

## 单步命令

```powershell
npm.cmd run release:local:prepare
npm.cmd run release:local:verify
npm.cmd run release:local:up
npm.cmd run release:local:test-server
npm.cmd run release:local:pin-tls
npm.cmd run package:win:local-release
npm.cmd run release:local:test-client
```

Windows 有时会锁住“文档”目录里的 Electron 临时解包目录，因此本地验收打包会在系统临时目录完成解包，再只把 Portable、Setup 和 blockmap 复制到 `release-local-server-client`。

正式生产 channel 仍保持禁用。本地证书信任只进入带 `localReleaseAcceptance=true` 标记的专用验收包，不修改 Windows 系统证书库，也不会进入正式包。

## 客户端更新行为

客户端先验证签名更新清单，再将安装包下载到自己的更新目录。最终重定向必须匹配完整的固定 HTTPS origin；文件大小和 SHA-256 必须同时匹配。全部通过后才允许用户确认并启动 Windows 安装器，不再打开官网让用户自行下载。

接入真实服务器时，继续使用同一发布包结构，只需在受控环境注入正式目录签名私钥、更新签名私钥、HTTPS 基础地址、版本和已签名安装包路径。
