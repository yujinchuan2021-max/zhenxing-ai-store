# 国际版生产部署首次启动问题

## 范围

- 部署目标：新加坡服务器上的枕星 AI 国际版。
- 对外入口：`zhenxingai.com`、`community.zhenxingai.com`，DNS 生效前允许通过公网 IP 检查站点。
- 国际版表示使用境外服务器和全球官方源优先，不表示只能使用英文，也不自动关闭现有中英文切换。

## 现象与证据

1. Linux Docker 构建执行 `npm ci` 时提示缺少跨平台可选包。
2. Flarum 镜像的 Composer 锁文件与依赖声明不一致，构建门禁拒绝继续。
3. 全新服务器没有已发布目录时，Identity 把目录 404 当成启动失败，连带阻塞社区和网关。
4. 生产后台只允许域名 Origin，但实际通过 `127.0.0.1:4173` SSH 隧道访问，写请求返回 403。
5. MariaDB 备份管道可能掩盖 `mariadb-dump` 失败，且旧默认目录会进入网站 Docker 构建上下文。
6. 服务全部健康后，Caddy 仍无法签发证书；权威查询返回 `NXDOMAIN`，注册商控制台显示域名尚未完成注册人验证。
7. 在 2 核 2GB 生产机执行官网 Docker 构建时，依赖安装触发重度换页，HTTP 与 SSH 一度无法响应。

## 根因

- Windows 上生成的根 `package-lock.json` 未包含 Linux 构建需要的完整可选依赖集合。
- 社区依赖锁摘要没有随审核后的 Composer 锁文件同步。
- 首次启动把“目录尚未首次发布”错误地等同于“身份服务不可用”。
- 后台把对外发布 Origin 和管理员写入 Origin 混成一个配置。
- 备份脚本没有让数据库导出失败可靠地终止脚本，备份位置也没有与发布构建上下文隔离。
- TLS 失败发生在 DNS/注册商层，不是服务器重启、Caddy 或防火墙故障；国际服务器不等于可以绕过域名注册状态。
- 生产机内存只适合运行受限容器，不适合并行承载前端依赖安装和镜像导出；2GB swap 是运行保护，不是构建容量。

## 被排除的猜测

- Docker、80/443 端口和服务器重启均正常；七个容器重启后保持 healthy。
- 公网 IP 的 `/health` 和首页均返回 200，说明站点与网关回源正常。
- Caddy 已进入 ACME 流程，失败信息明确为根域名和社区子域名 `NXDOMAIN`。

## 修复

- 在干净 Linux Node 24 环境重建根锁文件，并保留可复现的 `npm ci` 构建。
- 审核 Composer 锁文件、运行无开发依赖安全审计并更新固定摘要。
- Identity 健康检查不再依赖首次目录；涉及产品的业务操作仍从活动目录读取并在缺失时 fail-closed。
- 分离 `AIHUB_ADMIN_PUBLIC_ORIGIN` 与固定的 `AIHUB_ADMIN_WRITE_ORIGINS`，只允许域名和本机 SSH 隧道来源。
- 备份先生成数据库文件再压缩，失败立即退出；默认保存到 `/opt/zhenxing-ai/shared/backups`，并从 Docker 构建上下文排除。
- 网关健康检查固定公网 IP Host；DNS 生效后由 Caddy 自动重试并签发证书。
- 应用镜像固定在本机 Docker Linux 引擎构建和验证。只有用户明确确认上传后才写入云端 `incoming`，校验 SHA-256 后执行 `docker load` 和 `compose --no-build`；生产机禁止 `docker compose build`。

## 自动验证

- 七个 Docker 服务均为 healthy，重启策略为 `unless-stopped`。
- 公网 IP 健康检查与首页返回 200。
- 初始目录已校验并发布；后台错误 Origin 返回 403，本机隧道 Origin 可写。
- 首份 PostgreSQL、MariaDB、后台数据和社区文件备份通过格式、解压和校验和检查。
- 目录发布、Identity 安全、SMTP 配置相关聚焦测试通过；Docker Compose 与 Caddy 配置验证通过。

## 剩余人工步骤

- 在注册商完成域名注册人验证，并确认 `zhenxingai.com` 与 `community.zhenxingai.com` 的 A 记录公开可解析。
- DNS 生效后检查浏览器公开 HTTPS、证书链、社区登录和目录下载。
- 在真实 SMTP 发信测试通过前继续关闭注册。

## 防复发门禁

1. 生产构建必须在 Linux 干净环境运行锁文件安装，不接受仅在 Windows 开发机成功。
2. 新服务器验收顺序固定为：Compose 校验、容器健康、首次目录发布、业务检查、备份、DNS、HTTPS。
3. 后台对外发布地址与管理写入来源分开配置，管理端口只绑定 loopback。
4. 备份必须位于发布目录和 Docker 构建上下文之外，并验证数据库导出命令退出码及归档可读性。
5. 境外部署只免除中国大陆 ICP/境内节点工作；注册商锁定、域名验证和公共 DNS 仍是 HTTPS 前置条件。
6. 2 核 2GB 生产机只负责拉取基础镜像、加载本机构建的应用镜像和运行服务，任何应用构建都必须在本机完成。
