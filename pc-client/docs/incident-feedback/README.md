# 用户问题与防复发台账

这里保存枕星 AI 已经遇到过的真实问题。单个问题的详细证据、根因和修复仍以同目录对应事件文档为准；本页负责把它们串成开发前必须执行的检查流程。

## 每次修改前必须做

1. 先搜索相关关键词：

   ```powershell
   rg -n "<产品名|错误码|功能名|协议名>" docs/incident-feedback
   ```

2. 同时确认四层状态，不能只看其中一层：

   - 工作区源码和目录草稿。
   - Docker 镜像及容器实际文件。
   - 当前签名发布版本和 HTTPS 资源。
   - 浏览器页面、已封装客户端或用户电脑上的真实状态。

3. 修复应落在共享模块或统一流程，不能只给被截图的单个产品加特例。
4. 用户可见问题必须补充或更新事件文档，至少记录：现象、证据、根因、被排除的错误猜测、修复、自动验证、剩余人工验收和防复发门禁。
5. 单元测试、浏览器模拟和打包客户端自动化不能替代真实 Windows 安装、打开、卸载及设备行为验收。

## 高频问题索引

| 类别 | 开发前先看 | 固定防复发原则 |
| --- | --- | --- |
| 目录、白名单和后台版本错位 | `2026-07-31-catalog-allowlist-release-order.md`、`2026-08-01-identity-catalog-static-file-drift.md` | 目录与客户端白名单分别校验，使用统一发布脚本，不手工改变顺序。 |
| Docker 镜像或静态文件仍是旧版 | `2026-08-01-post-acceptance-audit-remediation.md`、`2026-08-01-local-release-delivery-atomicity.md` | 重建并强制重建目标容器，再核对宿主机与容器文件哈希。 |
| 安装包、Portable 和源码版本混淆 | `2026-08-01-local-release-version-regression.md`、`2026-08-01-production-package-catalog-fallback.md` | 制品必须绑定版本、Git revision、大小和 SHA-256；Local 与 Production 名称和通道分离。 |
| 网络、系统代理、TLS 和下载源 | `2026-07-29-environment-installer-download.md`、`2026-08-01-openclaw-download-err-failed.md`、`2026-08-02-local-release-certificate-rotation-and-install-feedback.md` | 使用系统网络、官方源优先、固定最终主机和证书边界；同时验证目录请求和实际资源请求。 |
| 安装状态、下载状态和迟到事件 | `2026-07-29-download-task-lifecycle.md`、`2026-07-30-desktop-operation-two-phase-recovery.md`、`2026-07-30-install-verification-recovery.md` | 使用 attempt/revision 和两阶段恢复；安装器启动不等于安装完成，每次操作重新检测。 |
| 卸载、托盘进程和厂商程序残留 | `2026-07-29-safe-desktop-uninstall.md`、`2026-08-01-openclaw-uninstall-tray-lock.md` | AI Hub 只自动清理自己的收据；用户手装软件调起厂商或 Windows 卸载入口，并处理托盘锁。 |
| CLI、WSL 与运行环境 | `2026-07-30-environment-operation-recovery.md`、`2026-07-31-node25-windows-cmd-spawn.md`、`2026-08-01-core-desktop-lifecycle-gaps.md` | 环境依赖进入统一环境子目录和生命周期模块，不按产品复制命令逻辑。 |
| 产品漏录、分类、搜索和 A–Z | `2026-07-31-incomplete-official-product-coverage.md`、`2026-08-02-chinese-vendor-letter-buckets-and-network-notice.md`、`2026-08-02-global-catalog-search-and-shared-filters.md` | 只采用官方证据；中文用审核映射；精准搜索不匹配描述；所有频道复用统一投影。 |
| 目录体积、资源类型和安全字段漂移 | `2026-08-03-catalog-resource-contract-drift.md` | 目录保存独享受测上限；新增资源类型同步共享契约、后台和语言模块；高权限资源同时固定来源脚本与正式草稿。 |
| Logo、头像与图片破图或错配 | `2026-07-31-account-avatar-language-and-button-feedback.md`、`2026-08-02-vendor-logo-assets.md`、`2026-08-02-catalog-logo-release-host-and-renderer-readiness.md`、`2026-08-03-vendor-logo-identity-and-contrast.md` | 图片使用受控源、内容哈希和明确 CSP；还必须核验品牌身份、唯一归属和最终对比度，HTTP 200 或成功解码不代表 Logo 正确。 |
| 开发页缓存、白屏和布局漂移 | `2026-08-02-stale-vite-commonjs-render.md`、`2026-08-02-vendor-page-entrypoints-white-screen.md`、`2026-07-31-product-action-layout-wrap.md` | Vite 强制重建依赖，检查真实 DOM、控制台和关键页面，不以服务端 200 代替渲染验收。 |
| 账号、社区和设备身份 | `2026-07-30-flarum-sso-pc-device-id.md`、`2026-07-31-device-account-switch-conflict.md`、`2026-07-31-unified-pc-community-personal-center.md` | PC 和社区共用身份接口；设备归属冲突必须显式处理，不能静默覆盖。 |

## 变更后的最小门禁

- 目录或资源变化：先验证正式目录与 compact example；生态资源只能指向 `ai-tool` 目标，扩充脚本必须重复执行哈希不变，总量基线同步更新。最终再运行 `npm.cmd run test:release`、`npm.cmd run build`，通过后台校验和统一目录发布。
- Docker 或发布变化：任何 Docker `COPY` 都必须同步进入镜像源码哈希清单；重建对应镜像后核对 `/ready`、签名目录版本、HTTPS 资源和 `release:local:test-server`。
- 发布协议或旧客户端兼容变化：额外运行 `release:local:test-client`，要求旧客户端实际读取目录并解码至少一个资源。
- UI、搜索或筛选变化：重启强制预编译的 Vite，操作真实页面并检查控制台错误。
- 安装、打开或卸载变化：自动化通过后仍保留真实 Windows 用户验收，不提前写成“已完成”。
- 没有修改客户端制品时不重新封包；只有客户端代码、固定白名单或发布协议确实变化并需要交付时才封包。
- 开发中按变更触发器运行聚焦测试；一次完整发布前再统一运行全量 `test:release` 与生产构建，避免无意义重复。
