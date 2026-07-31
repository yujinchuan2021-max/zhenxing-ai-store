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

1. 只重建本地 HTTPS 发布容器，刷新 Docker 端口映射和本地验收证书指纹。
2. 从当前源码生成 Setup、Portable、校验文件和 `BUILD.json`。
3. 核对版本、安装包 SHA-256、Git 提交和工作区状态。
4. 生成并签名新发布包，原子切换 `runtime/current`。
5. 验证目录、更新清单、TLS、Range 下载、文件大小和 SHA-256。
6. 启动隔离 Portable 客户端，验证远程目录、更新、扩展安装/卸载与真实托管下载暂停门禁。

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
npm.cmd run release:local:recreate-server
npm.cmd run release:local:pin-tls
npm.cmd run package:win:local-release
npm.cmd run release:local:prepare
npm.cmd run release:local:verify
npm.cmd run release:local:recreate-server
npm.cmd run release:local:up
npm.cmd run release:local:test-server
npm.cmd run release:local:pin-tls
npm.cmd run release:local:test-client
```

先让现有本地发布源可用并刷新证书指纹，再运行 `package:win:local-release`；打包前会拒绝过期或无效的本地证书配置。随后运行 `release:local:prepare`。`BUILD.json` 会把安装包字节绑定到 Git 提交和工作区状态；发布时再生成由更新密钥签名的 `build-provenance.json`。本地候选允许明确标记为 dirty，正式生产发布则拒绝 dirty 来源并要求精确的 `v<version>` 标签。

Windows 有时会锁住“文档”目录里的 Electron 临时解包目录，因此本地验收打包会在系统临时目录完成解包，再只把发布文件复制到 `release-local-server-client`。

`release:local:test-client` 会自行启动专用 Portable 客户端，使用随机回环 CDP 端口、独立 APPDATA/LOCALAPPDATA、下载目录和 Codex Home，验证签名目录、更新和扩展资源，并从批准产品源真实下载至少 1 MiB 后确认暂停。运行前如发现用户正在使用 AI Hub，它会直接拒绝验收，不会连接、复用或关闭用户会话；完成后只终止带本次临时用户目录参数的进程。

需要单独复现托管下载时可运行 `npm.cmd run test:packaged-managed-download -- <product-id>`；该命令同样禁止使用真实用户配置。

正式生产 channel 仍保持禁用。本地证书信任只进入带 `localReleaseAcceptance=true` 标记的专用验收包，不修改 Windows 系统证书库，也不会进入正式包。

## 客户端更新行为

客户端先验证签名更新清单，再将安装包下载到自己的更新目录。最终重定向必须匹配完整的固定 HTTPS origin；文件大小和 SHA-256 必须同时匹配。全部通过后才允许用户确认并启动 Windows 安装器，不再打开官网让用户自行下载。

接入真实服务器时，继续使用同一发布包结构，只需在受控环境注入正式目录签名私钥、更新签名私钥、HTTPS 基础地址、版本和已签名安装包路径。
