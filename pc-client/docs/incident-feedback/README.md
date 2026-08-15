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
| Windows 桌面目录重放、字段残留和名称回退 | `2026-08-04-windows-catalog-replay-content-drift.md` | 只运行统一事务入口；临时副本完成三段策略和最终校验后一次提交，无语义变化不得改变目录哈希。 |
| 安装包名称、载荷架构与 PE 引导壳不一致 | `2026-08-03-jan-nsis-bootstrapper-architecture.md`、`2026-08-04-vscode-zed-bootstrapper-architecture.md` | 分别实测分发目标、PE Machine 与安装后主程序；同批同类安装器进入表驱动回归，文件名中的 x64 不能代替被启动文件的身份校验。 |
| 中文签名、VersionInfo 与 PowerShell 输出编码 | `2026-08-04-powershell-localized-installer-identity.md` | 所有 JSON 身份探针先固定无 BOM UTF-8；真实包 SHA、有效签名和稳定产品身份必须同时通过，不能因系统代码页误判，也不能降级为只验哈希。 |
| Docker 镜像或静态文件仍是旧版 | `2026-08-01-post-acceptance-audit-remediation.md`、`2026-08-01-local-release-delivery-atomicity.md` | 重建并强制重建目标容器，再核对宿主机与容器文件哈希。 |
| 国际版生产首次部署、备份和 DNS/TLS | `2026-08-04-international-production-bootstrap.md` | 境外服务器仍需有效域名状态；首次目录、后台写入来源、备份位置和公网 HTTPS 必须按固定顺序验证。 |
| 安装包、Portable、品牌名和源码版本混淆 | `2026-08-01-local-release-version-regression.md`、`2026-08-01-production-package-catalog-fallback.md`、`2026-08-03-windows-installer-acceptance-product-name-encoding.md`、`2026-08-04-stale-pc-package-after-social-features.md` | 制品必须绑定版本、Git revision、大小和 SHA-256；Local 与 Production 名称和通道分离；客户端能力交付还必须从新版本包内验证桥接与登录，不能用 `5174` 代替 PC 验收。 |
| 网络、系统代理、TLS 和下载源 | `2026-07-29-environment-installer-download.md`、`2026-08-01-openclaw-download-err-failed.md`、`2026-08-02-local-release-certificate-rotation-and-install-feedback.md` | 使用系统网络、官方源优先、固定最终主机和证书边界；同时验证目录请求和实际资源请求。 |
| 官网下载按钮或 REST 地址实际返回 HTML / 登录页 | `2026-08-04-comet-public-download-endpoint-not-binary.md` | 受管准入必须采集真实二进制；成功状态码和官方起始域名都不能替代最终主机、内容与安装包身份验证。 |
| Microsoft Store、VPN 和修复 | `2026-08-03-microsoft-store-vpn-and-repair-flow.md` | 仅 Store 产品先提示关闭 VPN/代理；仍失败才由用户选择固定的微软官方检测/修复入口，不自动修改网络、服务、注册表或 Appx。 |
| 安装状态、下载状态和迟到事件 | `2026-07-29-download-task-lifecycle.md`、`2026-07-30-desktop-operation-two-phase-recovery.md`、`2026-07-30-install-verification-recovery.md`、`2026-08-04-desktop-install-runtime-and-preflight-stall.md` | 使用 attempt/revision 和两阶段恢复；安装器启动不等于安装完成；系统工具走共享路径，包管理器安装不能长期阻塞 IPC。 |
| 已安装软件检测、更新与后台发布 | `2026-08-15-installed-software-update-presentation.md` | 客户端启动只自动验签和检测；后台扫描、人工审核并签名发布；单项/全部更新都必须同时命中本机安装证据、发布许可和本地安全适配器，绝不从网络清单执行命令或任意 URL。 |
| 卸载、托盘进程和厂商程序残留 | `2026-07-29-safe-desktop-uninstall.md`、`2026-08-01-openclaw-uninstall-tray-lock.md`、`2026-08-04-package-manager-install-ownership-receipt-gap.md` | AI Hub 只自动清理自己的收据；用户手装软件调起厂商或 Windows 卸载入口，并处理托盘锁。 |
| 桌面产品身份与安装实例所有权混淆 | `2026-08-04-desktop-install-ownership-receipt-gap.md` | 名称、发布者和签名只能证明产品身份；自动管理还必须绑定安装前基线中唯一新增的精确注册表实例，禁止失效后改绑同名软件。 |
| CLI、WSL、运行环境与产品身份 | `2026-07-30-environment-operation-recovery.md`、`2026-07-31-node25-windows-cmd-spawn.md`、`2026-08-01-core-desktop-lifecycle-gaps.md`、`2026-08-04-cli-product-identity-and-lifecycle-classification.md`、`2026-08-04-wsl-managed-prefix-ownership.md` | 环境依赖进入统一环境子目录和生命周期模块；源码项目、复合服务和桌面 EXE 不得冒充受管 CLI；WSL 产品必须绑定实例标记、原子前缀和逐次 realpath guard。 |
| CLI/资源生命周期、收据与离线卸载 | `2026-08-03-cli-resource-lifecycle-closure.md`、`2026-08-04-extension-host-and-inventory-recovery.md` | 原始动作意图必须贯穿重试；宿主状态检测只读；收据绑定实际安装实例；清单枚举固定 profile 后由 Adapter 恢复状态；后台停用或离线不能移除已安装内容的安全卸载入口。 |
| 产品漏录、分类、搜索和 A–Z | `2026-07-31-incomplete-official-product-coverage.md`、`2026-08-02-chinese-vendor-letter-buckets-and-network-notice.md`、`2026-08-02-global-catalog-search-and-shared-filters.md` | 只采用官方证据；中文用审核映射；精准搜索不匹配描述；所有频道复用统一投影。 |
| 目录体积、资源类型和安全字段漂移 | `2026-08-03-catalog-resource-contract-drift.md` | 目录保存独享受测上限；新增资源类型同步共享契约、后台和语言模块；高权限资源同时固定来源脚本与正式草稿。 |
| Logo、头像与图片破图或错配 | `2026-07-31-account-avatar-language-and-button-feedback.md`、`2026-08-02-vendor-logo-assets.md`、`2026-08-02-catalog-logo-release-host-and-renderer-readiness.md`、`2026-08-03-vendor-logo-identity-and-contrast.md` | 图片使用受控源、内容哈希和明确 CSP；还必须核验品牌身份、唯一归属和最终对比度，HTTP 200 或成功解码不代表 Logo 正确。 |
| 开发页缓存、白屏和布局漂移 | `2026-08-02-stale-vite-commonjs-render.md`、`2026-08-02-vendor-page-entrypoints-white-screen.md`、`2026-07-31-product-action-layout-wrap.md` | Vite 强制重建依赖，检查真实 DOM、控制台和关键页面，不以服务端 200 代替渲染验收。 |
| 账号、社区和设备身份 | `2026-07-30-flarum-sso-pc-device-id.md`、`2026-07-31-device-account-switch-conflict.md`、`2026-07-31-unified-pc-community-personal-center.md` | PC 和社区共用身份接口；设备归属冲突必须显式处理，不能静默覆盖。 |
| Electron IPC 用户错误文案 | `2026-08-07-resource-submission-ipc-error-envelope.md` | 不把 rejected IPC 的 `error.message` 当协议；main/preload 使用固定结构化结果，原始 cause 仅留 main 日志。 |
| Workflow 冷态签名目录依赖误判 | `2026-08-07-workflow-cold-catalog-resolver-timeout.md` | liveness 不等于目录 authority readiness；未就绪/失败必须 503，只有完整验签投影后的精确缺失才是 400，并发共享 in-flight 且失败可重试。 |
| Identity PostgreSQL 目标库假健康 | `2026-08-10-identity-postgresql-target-readiness.md` | sibling migration 的健康门禁必须用 TCP SQL 证明固定数据库与主体；`pg_isready`、socket-only 连接、sleep 和隐式建库均不可替代。 |
| Workflow 生产切换依赖宿主 Node | `2026-08-08-workflow-production-host-node-runtime.md` | Node 必须是 release-scoped、manifest-controlled 的固定官方资产；安装与 cutover 共用固定 `1000:1000` owner projector，root 只接受精确 sudo caller；损坏、owner/mode 或宿主 ABI 不符须在备份前失败。 |
| Workflow 生产 release 传输丢失文件模式 | `2026-08-08-workflow-production-release-transfer-mode.md` | release bundle 必须精确枚举路径、字节、SHA、owner 和 mode；在新的未发布临时目录内逐项安装并验证后原子落位，不得依赖 Windows tar、远端 umask 或手工 chmod 清单。 |
| Workflow Public Store ONLINE 但公开内容为空 | `2026-08-09-workflow-public-store-empty-bootstrap.md` | ONLINE 不代表已有内容；官方启动内容必须由独立不可登录组织身份走正常状态机，真实 Flarum post 与活动签名目录逐项 fail closed，失败只能补偿下架而不能删事件。 |
| Workflow 生产切换会话、Compose 参数或 secret-file 形态漂移 | `2026-08-09-workflow-production-ssh-session-hup.md`、`2026-08-09-workflow-production-bootstrap-wrapper-compose-arity.md`、`2026-08-09-workflow-production-forum-api-key-terminal-lf.md` | 长任务只由固定 systemd unit 持有；wrapper 必须分别实测 production canonical two-file 与受控 acceptance five-file；secret parser 只剥离明确授权的单个终止序列并对真实文件形态回归，禁止 `trim()`。 |

## 变更后的最小门禁

- 目录或资源变化：先验证正式目录与 compact example；生态资源只能指向 `ai-tool` 目标，扩充脚本必须重复执行哈希不变，总量基线同步更新。最终再运行 `npm.cmd run test:release`、`npm.cmd run build`，通过后台校验和统一目录发布。
- Docker 或发布变化：任何 Docker `COPY` 都必须同步进入镜像源码哈希清单；重建对应镜像后核对 `/ready`、签名目录版本、HTTPS 资源和 `release:local:test-server`。
- 发布协议或旧客户端兼容变化：额外运行 `release:local:test-client`，要求旧客户端实际读取目录并解码至少一个资源。
- UI、搜索或筛选变化：重启强制预编译的 Vite，操作真实页面并检查控制台错误。
- 安装、打开或卸载变化：自动化通过后仍保留真实 Windows 用户验收，不提前写成“已完成”。
- 没有修改客户端制品时不重新封包；只有客户端代码、固定白名单或发布协议确实变化并需要交付时才封包。
- 开发中按变更触发器运行聚焦测试；一次完整发布前再统一运行全量 `test:release` 与生产构建，避免无意义重复。
