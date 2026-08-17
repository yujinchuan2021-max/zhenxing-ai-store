# NSIS 到 Inno Setup 安装器迁移

## 用户反馈

0.1.100 的 NSIS 安装器虽然尝试过矩形向导、纯星形窗口和透明星形外壳，但真实截图仍出现锯齿、控件遮挡、大片空白和系统默认控件风格。用户要求更换为一个开源、容易定制且能稳定支持管理员全机安装的安装器，同时保留“大颗灰色星芒随进度变成 3D 银色并闪烁”的品牌过程。

## 根因

- NSIS 的 `CreatePolygonRgn` / `SetWindowRgn` 是二值窗口区域，无法提供稳定的每像素抗锯齿；把整个向导裁成细长星形后也没有可靠的矩形控件安全区。
- 后续透明色键方案仍需要大量自绘控件和窗口行为，视觉与可访问性维护成本过高。
- 旧 electron-builder NSIS 流程同时承担 Portable、安装器、blockmap 和卸载器生成，品牌 UI 与打包协议耦合，难以单独验证。

## 候选安装器裁决

| 候选 | 裁决 | 原因 |
| --- | --- | --- |
| InstallForge | 拒绝 | 免费使用但 EULA 为专有软件许可，不符合“开源安装器”要求。 |
| Squirrel.Windows | 拒绝 | MIT，但官方目标是无向导、无 UAC、当前用户 `%LocalAppData%` 安装；其 machine-wide MSI 只是组策略引导器，不是通用全机安装器。 |
| WiX Burn | 暂不采用 | 能力完整，但制作当前单一 Electron 应用的自定义向导需要更大的 bootstrapper 工程。 |
| Inno Setup 7.1.0 | 采用 | 官方开源，原生支持管理员全机安装、目录页、现代向导、Pascal Script、PNG、自定义进度和独立卸载 UI；能保留 Portable 并只替换 Setup。 |

一手研究与许可边界见：

- `docs/research/2026-08-17-open-source-windows-installer-replacement.md`
- `docs/research/2026-08-17-four-point-star-brand-rights-review.md`

## 实现

- 固定 Inno Setup `7.1.0`，工具链清单同时锁定官方发行地址、下载 SHA-256、编译器 SHA-256 和发行者证书主体；编译器不匹配即停止。
- electron-builder 只生成 Portable 与 `win-unpacked`；新的公共封包 seam 再把同一 `win-unpacked` 交给 Inno，正式输出不再包含 NSIS blockmap。
- 安装器使用 `PrivilegesRequired=admin`、`{autopf}\aihub-pc-client`、x64 模式和中文现代向导，面向整台电脑安装并保留安装目录选择。
- 欢迎、安装和完成页使用用户提供的四角星源图。最终实现只保留一张始终可见的灰色底星和一张预解码的银色叠加星；33 ms 计时器只更新独立 layered window 的逐像素 alpha 合成强度，使用 smoothstep 曲线完成约 6.34 秒的呼吸循环，不再加载或替换可见位图。
- 源 PNG 的背景虽然肉眼为黑色，但 alpha 通道实际完全不透明。生成器最初误把整张方图当作遮罩；现在以源图亮度构造真实 alpha，测试锁定 220 × 220 原生显示尺寸、透明四角和不透明中心，避免方形银片与运行时拉伸回归。
- 卸载初始化先把灰星、银星和两张进度条资产复制到 `{tmp}`，再启动动画。卸载过程不再从正在删除的 `{app}` 目录读图，避免文件删除与计时器加载竞争。
- 用户真实卸载曾在完成阶段报告 `Runtime error (at 36:553): Null Pointer Exception`。根因是计时器回调仍可能访问已经隐藏或即将释放的图像控件；安装、确认、卸载进度和卸载完成四条动画现各自使用 readiness 门禁，释放顺序固定为“先禁回调、再杀计时器、恢复窗口过程、最后释放窗体”。
- 用户真实预览先暴露换帧空白，随后又证明“暂停父窗口重绘再整窗重绘”的补丁会让整个安装器随每一帧一起闪烁。最终修复不再存在帧序列、隐藏缓冲或父窗体重绘：灰星属于独立透明窗体且永不移除，银星只加载一次；呼吸期间只用 `UpdateLayeredWindow` 重新合成银星的全局强度，卡片与宿主窗体不参与动画。
- 初版叠加层沿用了有标题窗体的外框尺寸，改成无边框后 client area 被放大，造成灰星与银星错位，看起来像双影闪烁。现在去边框后重新固定叠加层 client area 为 220 × 220，并用 `ClientToScreen` 将宿主客户区坐标转换为屏幕坐标；拖动和 DPI 缩放都复用同一定位 seam。
- 全窗口 `wizard-back.png` 会遮住桌面，不符合“星星和操作卡片之外留白透明”的最终要求，现已从生成器、Inno `[Files]` 和全部窗体中删除。主安装、卸载确认、卸载进度与卸载完成窗体都被裁成唯一的圆角操作卡片；灰星与银星则使用两个逐像素 Alpha 窗体悬浮在卡片上方，桌面从其余区域真实透出。中间版本使用透明色键渲染星图，真实预览出现白方块或洋红抗锯齿边；逐像素合成替代色键后两种伪影均消失。
- 用户点击“安装”后曾进入原生中间任务页，并重新出现“下一步/上一步”。任务页继续由 `ShouldSkipPage(wpSelectTasks)` 跳过；真正不可跳过的 `wpPreparing` 与 `wpInstalling` 现在都在 `CurPageChanged` 中立即映射为自定义安装进度态，且 `ShowInstallerState` 每次切换都强制隐藏返回按钮。安全 `PreviewMode` 实际点击验证后只出现 `取消安装`，未出现“下一步”或“上一步”。
- Inno 会在复制每个文件时把状态标签改成技术文案“正在提取文件…”。自定义进度回调现统一把该标签固定为“正在安装中…”，保留文件路径、百分比和进度条，不向普通用户暴露内部解包阶段。
- 后续真实截图又暴露两个合同外缺口：星窗先 `Show` 再首次合成会短暂显示完整黑色矩形；已运行客户端的关闭动作会被托盘逻辑改成隐藏，原生文件占用提示又因自定义外壳不可见。现在两张星图都先通过 `UpdateLayeredWindow` 完成首帧合成再显示；点击“安装”离开目录页前先按精确客户端窗口名检测运行状态，提示用户从托盘退出并提供“重试/取消”，客户端未退出时不进入安装态，也不强杀进程。
- 首帧预合成后，用户真实截图仍显示星芒周围的完整黑色方块。根因不是源 PNG 缺透明像素，而是 Inno 的 `TPngImage.Canvas.Handle` 不能为 `UpdateLayeredWindow` 提供可直接使用的预乘 BGRA 表面。生成器现把两张星图编码为 32 位、top-down、BI_RGB 的预乘 Alpha BMP；Inno 用 `TBitmapImage.Bitmap` 加载并显式设为 `afPremultiplied`，分层窗口只读取该 bitmap DC。灰星底层始终存在，银星层只改变全局 alpha，透明像素不会再被合成为黑色。
- 旧 NSIS 升级只接受固定 HKLM64 卸载键、绝对存在的 `Uninstall 枕星AI助手.exe` 和精确 `/allusers /S` 参数；直接执行并等待，卸载记录未消失即停止，不经过 `cmd.exe`、PowerShell 或任意 `ShellExec`。
- 安装完成页默认不启动应用；只有用户明确点击“打开枕星AI助手”才以原登录用户启动，点击“关闭窗口”只退出安装器。

## TDD 与自动验证

- 第一轮 RED：Inno 脚本、工具链清单和编译 seam 均不存在，专属测试 `0/3`。
- 工具链、全机安装、品牌帧、旧 NSIS 精确迁移和 Portable→Inno 接线完成后，专属合同先达到 `4/4`。
- 卸载动画竞争由测试新增 `{tmp}` 缓存要求取得 RED，修复后 GREEN。
- 星芒遮罩由真实像素测试锁定 `star-base.bmp` / `star-silver.bmp` 的 32 位 top-down DIB、透明四角、实心中心与预乘 RGB；生成目录被限制为两张星图和两张进度资产，不允许编号帧或 twinkle 资产重新出现。
- 叠加层定位先由真实 Windows 预览暴露双影，再新增 `ClientToScreen` 与去边框后精确 client size 两个 RED；修复后原生预览显示单一轮廓，灰色底星在整个呼吸周期始终存在，银色只平滑变亮/变暗。
- 透明留白与直接安装切片先取得 3 个 RED：星图仍依赖色键合成、生成资产尺寸与原生窗口不一致、点击安装后的不可跳过页面没有专属映射。最终专属合同 `12/12` GREEN；Inno 7.1.0 PreviewMode 实机显示桌面从星芒及卡片外透出，实际点击“安装”后直接进入 `0%` 进度态，辅助功能树中仅有“取消安装”。
- 黑色首帧与运行客户端覆盖安装切片取得 2 个 RED：旧顺序确认为 `Show` 早于首次合成，且不存在离开目录页前的运行客户端门禁。最小返修后专属合同 `13/13` GREEN，固定 Inno 7.1.0 PreviewMode 编译 PASS；当前真实客户端主窗口标题为“枕星AI助手”，与新门禁的精确匹配条件一致。
- 黑方块返修先让专属合同命中两个 RED：安装器仍从 PNG canvas 合成、生成目录中不存在预乘 BMP。改为预乘 BMP 后专属合同 `13/13` GREEN；PreviewMode v5 在真实 Windows 分别于两个呼吸阶段截图，星芒轮廓始终存在、亮度平滑变化，星芒和卡片以外均透出其后桌面，未观察到黑框或整窗闪白。预览包为 `output/inno-preview-premultiplied-star-v5/artifact/ZhenXing-AI-Installer-Premultiplied-Star-Preview-v5.exe`，2,353,822 字节，SHA-256 `beca712c724840038145307f004aa337b84d09b7ba3476544a47c53745c80dd7`；它是 `PreviewMode`，不写系统。
- 安装状态文案合同锁定 `CurInstallProgressChanged` 每次都恢复“正在安装中…”，避免 Inno 后续升级重新暴露逐文件提取术语；专属合同继续为 `13/13` GREEN。
- 最终封包内置 packaged acceptance `25/25`、TypeScript + Vite production build 和 packaged catalog gate 均通过；目录仍为 v7、375 个厂商、615 个产品，normalized SHA-256 仍为 `8c49e1972186f841dca9cea8f26074fe27aed9a140e4f5687cf7f23d134f034c`。

## 最终 0.1.100 review 包

最终目录 `release-review-server-connected-0.1.100-candidate` 精确为 5 个普通文件：

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `PACKAGE-CONTROL.json` | 120 | `49133af8f0096129b07df6771e7482df879930e58abe23a77f41bb831bbe0f02` |
| `ZhenXing-AI-Server-Connected-Review-0.1.100-BUILD.json` | 974 | `ddf578a434de1d52e40cd6fa26d78553e76896c8efef34f14ea40e4fb9195afb` |
| `ZhenXing-AI-Server-Connected-Review-0.1.100-SHA256.txt` | 475 | `9e18aecf5ffe987ddb3ca4881f70a92f1f83ed7cdfd55aa95066bec446916adb` |
| `ZhenXing-AI-Server-Connected-Review-0.1.100-Windows-x64-Portable.exe` | 108,132,638 | `fe42cf909ab759e89204be113758bfb470fc3829926f5012a4353005bda6441f` |
| `ZhenXing-AI-Server-Connected-Review-0.1.100-Windows-x64-Setup.exe` | 154,974,445 | `c29421ef0732035b7c0e3a2ea6e922b29ed1f094871a1a1c7bf73b2d1401705b` |

SHA 清单 4/4 复算一致；BUILD 只声明 Portable 与 Setup 两个可执行制品，封包调用次数为 1。两者 Windows `ProductName` 均为“枕星AI助手”，版本均为 `0.1.100`。

本版把 HarmonyOS Sans SC 字体作为离线客户端资产完整内置；安装器品牌资源已收敛为两张星图与两张极小进度图，不再用帧序列放大安装包。字体不做裁剪或改造，继续遵守其原始许可边界。

## 可回滚与失败证据

- 原 NSIS 六件套保留在 `release-review-server-connected-0.1.100-candidate.pre-inno-setup`；旧 Setup SHA-256 为 `b82f5bd9bbd8648645b4785c58b002ed1512a63391a77abf7d0fb39c09b98c6b`。
- 未缓存卸载帧的首版 Inno 五件套保留在 `.failed-inno-uninstall-frame-cache`；不得交付。
- 误用不透明 alpha、会显示方形银片的第二版 Inno 五件套保留在 `.failed-inno-opaque-star-mask`；不得交付。
- 无闪白原子换帧封包前的五件套另保留在 `.pre-atomic-no-flash-font`；没有覆盖或删除，可按整个目录回溯证据。只有无后缀的 candidate 目录是当前 review 候选。
- 用户证明整窗随星芒换帧闪烁且背景未接线的上一候选完整保留在 `.pre-full-window-flash-and-controls-fix`；后续返修不再沿用“局部换帧 + 全窗背景”，而是“静态灰星 + 独立银色 alpha 叠加层 + 透明留白”。
- 本次 compositor 返修前的无后缀五件套已整体移动到 `.pre-compositor-alpha-animation`；没有删除或覆盖其中任何文件。新的无后缀 candidate 才是当前本地审核包。
- 本次逐像素透明与点击“安装”直达进度态返修前的五件套完整保留在 `.pre-transparent-alpha-direct-install`；旧 Setup 为 155,010,801 字节，SHA-256 `1b826190522ac75064545d337ed6abdc2e4b26f25ef8ef98ad77a116a32d7ec7`。
- 本次首帧预合成与运行客户端覆盖安装门禁返修前的五件套完整保留在 `.pre-precompose-running-client-gate`；旧 Setup 为 154,980,916 字节，SHA-256 `b0b9d77103a124edc5f761621af9a3fba90a79e68c283748a7834b5c2340e954`。
- 本次单包精确删除与预乘透明返修前的五件套完整保留在 `.pre-exact-package-delete-premultiplied-star`；旧 Setup SHA-256 为 `632a0116d83e21f485ca9ab80a3247c93a6cc33424d8b01d8cfc1f2ac28fcd55`。新包只执行一次封装并自然退出，未启动正式 Setup、安装、卸载或上传。
- “正在安装中…”文案与空资源区隐藏返修前的完整五件套保留在 `.pre-installing-label-empty-extension-section`；第一次重封在 packaged catalog gate 遇到单次 `Runtime.evaluate` 超时，控制收据保留在 `.failed-packaged-catalog-timeout`。同一窄门禁随后独立通过，唯一受控重试也自然通过；未放宽 CDP 门禁或删除失败证据。

## 权利与剩余验收

- 四角星来自用户提供、由 OpenAI 图像生成对话导出的源图；本地来源链已闭合。常见四角星概念本身不等于无商标混淆风险，正式公开发布前仍需独立商标近似复核。
- Portable 与 Setup 的 Authenticode 状态仍为 `NotSigned`。当前仅是本地 review-only 包，不得进入正式更新通道。
- 本轮只启动了 `PreviewMode` 安装器做原生窗口观察，没有启动正式 Setup、确认 UAC、安装、升级、卸载、覆盖当前客户端或上传。真实管理员安装、旧 NSIS 原地升级、动态安装/卸载动画和回滚仍需隔离 Windows 环境人工验收；自动测试和预览观察不能替代这些步骤。

## 防复发门禁

- 安装器工具链必须由 `build/inno/toolchain.json` 固定版本、哈希和发行者；禁止使用环境中任意 `ISCC.exe`。
- 安装器两张星图必须通过 32 位 top-down DIB、预乘 RGB、透明角、实心中心、尺寸和源资产存在性测试；禁止把 `TPngImage.Canvas.Handle` 直接交给 `UpdateLayeredWindow`，也禁止重新引入编号帧。
- 卸载动画只能从卸载前缓存的灰星/银星资产读取；禁止从删除中的应用目录持续加载。
- 星芒呼吸只能通过 `UpdateLayeredWindow` 更新独立银星窗的 alpha；专属测试拒绝星窗色键、位图替换、父窗口重绘暂停、整窗 `RedrawWindow` 和全子控件重绘标志。
- 安装/卸载四种宿主窗体必须物理裁成操作卡片且不得加载整窗背景；两张星图必须使用逐像素 Alpha，星星与卡片之外必须保留桌面透出区域。
- 安装按钮必须从目录页直接进入自定义进度态；`wpSelectTasks` 必须跳过，`wpPreparing` 与 `wpInstalling` 必须映射到安装态，任何状态切换都不得重新显示返回按钮。
- 星芒窗口必须在首次 `Show` 前完成灰星与银星合成，禁止再次暴露未初始化的 layered window；覆盖安装必须在 `NextButtonClick(wpSelectDir)` 阶段确认客户端已完全退出，未退出只允许重试或返回，不得静默进入安装态或调用强制终止进程。
- 旧安装器迁移必须继续验证 HKLM64 固定键、文件名、绝对路径、参数、退出码和卸载键消失。
- 每次封包都必须检查精确输出集合、BUILD、CONTROL、SHA 清单、ProductName、版本、签名状态、残留进程和临时目录；review-only 不得写成正式发布。
