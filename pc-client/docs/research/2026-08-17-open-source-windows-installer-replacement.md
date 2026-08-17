# 枕星 AI 助手：开源 Windows 安装器替代方案评估

- 研究日期：2026-08-17
- 范围：替换当前 `electron-builder` 的 NSIS 安装器；不改变 Electron 应用本体
- 证据规则：只采用项目官方文档、官方源码仓库和官方许可证
- 本轮动作：只读研究；未安装工具、未构建、未运行安装器、未修改产品代码或发布状态

## 结论先行

### 主推荐（有许可证/预算前置门）

采用 **WiX Toolset v7 Burn + 自包含 C#/WPF Custom Bootstrapper Application（BA）+ 单个 WiX MSI**。

这是本次候选中唯一能够同时做到以下两件事的方案：

1. 把“大颗四角星就是安装器”做成真正独立、无边框、现代、可动画、可响应进度的窗口；
2. 不自己重写提权、缓存、进度、取消、回滚、修复、升级、卸载和签名链路，而是交给 Burn 与 Windows Installer。

UI 与安装事务必须严格分层：

- WPF BA 只负责窗口、动画、安装目录输入、状态文案、错误呈现、无障碍和用户操作；
- Burn 负责 Detect / Plan / Cache / Elevate / Apply / Progress / Restart / Uninstall；
- MSI 负责文件、目录、快捷方式、注册表、ARP、修复、回滚和产品升级规则；
- Electron 应用仍先由现有 `electron-builder --dir` 生成 `win-unpacked`，再由 MSI 收取该 payload。

**许可证门不能省略。** WiX 源码许可证是 MS-RL，但当前 WiX v7 发布物还执行 Open Source Maintenance Fee（OSMF）EULA。官方说明：源码仍按仓库 LICENSE 开放；从使用 WiX 的项目产生的年收入达到官方阈值后，需要参加维护费，WiX v7 构建还要求显式接受 EULA。WiX 官方同时明确，仅使用 WiX 生成安装包不会让输出包因此成为 WiX 的衍生作品；真正修改/分发 WiX 源码时才需要按 MS-RL 具体评估。因此，进入实现前必须由项目所有者书面确认可接受 WiX v7 EULA、维护费与年度升级策略。若不能接受，立即切换下面的 Inno Setup 备选，不允许为了规避条款而固定在已结束消费者安全支持的 WiX v5。

官方依据：

- Burn 与完全自定义 native/managed BA：https://docs.firegiant.com/wix/tools/burn/
- WiX v5+ 的进程外 BA：https://docs.firegiant.com/wix/whatsnew/oopbas/
- WiX v7 发布与 OSMF 变化：https://docs.firegiant.com/wix/whatsnew/releasenotes/
- OSMF/EULA：https://docs.firegiant.com/wix/osmf/
- WiX 源码许可证：https://github.com/wixtoolset/wix/blob/main/LICENSE.TXT
- WiX 生命周期：https://docs.firegiant.com/wix/

### 备选

采用 **Inno Setup 7.1.0 自定义向导/主题**，并保留枕星 AI 助手现有的软件更新后台与签名发布通道。本报告最终冻结时，官方实时下载页和 What is 页面均显示正式版 **7.1.0（2026-08-12）**，并且官方 GitHub 存在不可变、签名状态为 Verified 的 `is-7_1_0` Release；不采用预览版、分支源码或搜索缓存里的旧版本号作为决策依据。

它的优点是迁移快、脚本清晰、商业使用与修改/再分发权写在许可证里、管理员安装/目录/卸载/进度/签名都成熟，维护成本显著低于自定义 WPF BA。它能做漂亮的大图、PNG、深色/现代向导、有限的帧动画和自定义页面。

它的限制也必须直说：Inno Setup 是 VCL/向导控件与 Pascal Script 模型，不是 WPF 动画框架。若要求高质量 3D 银色星体、连续材质变化、全窗口透明与复杂动效，脚本、WinAPI 和图像帧管理会迅速变成维护负担。因此它是“快速稳定、视觉足够好”的备选，不是“任意现代动画”的等价物。

官方依据：

- Inno Setup 许可证：https://github.com/jrsoftware/issrc/blob/main/license.txt
- 产品能力：https://jrsoftware.org/ishelp/topic_whatisinnosetup.htm
- 官方下载与正式版本：https://jrsoftware.org/isdl.php
- 官方下载验证：https://jrsoftware.org/isdl-verify.php
- 7.1.0 不可变、签名 Verified 的官方 Release：https://github.com/jrsoftware/issrc/releases/tag/is-7_1_0
- 自定义向导页面：https://jrsoftware.org/ishelp/topic_scriptpages.htm
- 脚本控件/类：https://jrsoftware.org/ishelp/topic_scriptclasses.htm
- UAC/管理员模式：https://jrsoftware.org/ishelp/topic_setup_privilegesrequired.htm
- 安装目录：https://jrsoftware.org/ishelp/topic_setup_defaultdirname.htm
- 卸载：https://jrsoftware.org/ishelp/topic_setup_uninstallable.htm
- 签名：https://jrsoftware.org/ishelp/topic_setup_signtool.htm
- 商业使用购买请求（官方明确说明并非严格强制）：https://jrsoftware.org/isorder.php

### 明确拒绝作为本次主安装器

- **InstallForge：拒绝。** 它是 proprietary setup engine + Freeware EULA，不是开源；禁止反向工程/反编译/反汇编。即使可免费商业使用，也不满足“开源、好改”的硬条件，且 UI 主要是传统向导、图标、PNG/头图、Splash 级定制，无法证明可做完整 WPF 级动画窗口。
- **WiX MSI 内置 UI：拒绝单独承担前端。** MSI 很适合可靠安装后端，但数据库式 Dialog/Control UI 不适合本次品牌动画。
- **Velopack：拒绝作为本次主 UI。** 更新链优秀、MIT、Electron 支持好，但官方安装器是 one-click + icon/splash（GIF 可动），深度定制很少；per-machine 走标准 MSI，不能实现“星星就是安装器”的完整交互。
- **MSIX/App Installer：拒绝作为当前消费端主安装器。** UI 属于 Windows App Installer，可定制字段有限；安装目录/容器语义不符合现有普通 Program Files 与可变资源假设。可未来作为 Microsoft Store/企业部署并行渠道。
- **Squirrel.Windows：硬拒绝。** 官方目标就是 wizard-free/no UAC，默认 `%LocalAppData%` per-user；不符合全机、目录、现代完整 UI，且官方仓库仍在征维护者、更新流程无内建回滚。
- **手写 WPF 启动器 + `msiexec`：拒绝。** 这会重复实现 Burn 的安全 IPC、UAC 边界、进度、FilesInUse、取消、重启、检测和错误映射。若选择“自定义 UI + 标准 MSI”，正确实现就是 Burn custom BA + MSI。

## 当前仓库事实与迁移边界

本地配置快照表明：

- `package.json` 当前仍声明 `portable` 与 `nsis` 两个 Windows target；
- NSIS 当前为 `perMachine: true`、允许 UAC、允许用户选择安装目录；
- `scripts/package-server-connected-review.cjs` 当前一次生成 Portable 与 NSIS，并检查 `win-unpacked/resources/app.asar`、catalog channel 与 update channel；
- 产品名已是“枕星AI助手”，内部 `appId` 仍是 `com.aihub.desktop`；内部兼容标识不能在安装器迁移时随意改掉。

因此最小风险路径不是“把 electron-builder 整套删掉”，而是：

```text
现有前端构建
  -> electron-builder --dir
  -> win-unpacked/
  -> WiX MSI（静默安装 payload）
  -> WiX Burn v7
  -> 自包含 WPF BA（唯一可见 UI）
```

`electron-builder --dir` 是官方支持的 unpacked directory 输出；现有脚本也已经把 `win-unpacked` 当作包内闭包核验对象，因此可以先只替换 NSIS 的最后一层，不碰 Electron 打包语义与 Portable 产物。

官方依据：https://www.electron.build/docs/cli/

## 硬条件对比矩阵

| 方案 | 许可证/使用条款 | 现代窗口与动画 | 全机/UAC | 用户选目录 | 可信进度/回滚 | 卸载/升级 | Electron 与更新/签名 | 维护成本 | 本次决策 |
|---|---|---|---|---|---|---|---|---|---|
| WiX v7 Burn + WPF BA + MSI | 源码 MS-RL；v7 另有 OSMF EULA/收入阈值 | **完全自定义**；WPF 支持矢量、2D/3D、动画、模板 | 是 | 是；BA 传 MSI 属性 | **强**；Burn 事件 + MSI rollback | 强；ARP、repair、major upgrade、bundle uninstall | 收取 `win-unpacked`；签 MSI、engine、bundle；更新可后置 | 中高，但职责清晰 | **主推荐，需先过条款门** |
| WiX MSI only | 同上 | 弱；传统 MSI Dialog/Control | 是 | 是 | 强 | 强 | 可收 Electron payload；签 MSI | 中 | 只作后端 |
| Inno Setup 7.1.0 | 明确许可商业使用、修改与再分发；官方另请求符合条件商业用户购买 | 中；自定义页/PNG/控件/有限动画，复杂动效成本高 | 是 | 是 | 中；有真实进度但回滚有限，不是 MSI 事务模型 | 强；内建卸载，升级依赖稳定 AppId/脚本 | 任意 payload；签 setup/uninstaller；更新需自有通道 | **低至中** | **备选** |
| InstallForge | **非开源**；Freeware EULA，禁止反编译 | 低至中；传统向导、图标/头图/Splash | 通常管理员模式 | 是 | 有进度；事务/回滚契约不透明 | 内建卸载；迁移需自写命令 | 可打包任意技术；商业更新器另收费 | 工具使用低，深改不可控 | **不符合硬条件** |
| Velopack | MIT | 低；one-click + PNG/JPG/GIF splash，官方称定制很少 | Setup 是 per-user；MSI 才能 per-machine | Setup 参数/新版 MSI 可覆盖，但不是品牌向导 | 更新链强；安装 UI 受限 | 强更新/卸载 | 官方 Electron JS；签名链清晰 | 低至中 | 更新层候选，不作主 UI |
| MSIX + App Installer | MSIX SDK MIT；部署由 Windows 平台承载 | 低；OS UI 仅有限 XML 字段 | 企业 device context 可做；不是目标交互 | 不提供普通任意目录体验 | 原子部署/更新强 | 干净卸载/更新强 | Electron 可转包，但需签名并适配容器 | 中，兼容迁移风险高 | Store/企业并行渠道 |
| Squirrel.Windows | MIT | 不符合；wizard-free，仅 loading GIF/icon | **否**；Setup 无 UAC/per-user；生成的 MSI 只是 Group Policy 引导器，仍让各用户下次登录时安装 | 否 | 更新有 delta；官方无内建 rollback | 有 Update.exe 卸载/更新模型 | Electron 有官方组织封装，但要接入 Squirrel events/RELEASES | **高**；官方征维护者，最新正式 release 停在 2020 | **硬拒绝** |
| 手写 UI EXE + MSI | UI 代码可自有；MSI 工具许可另算 | 完全自定义 | 必须自写安全提权/IPC | 可自写 | **风险最高**；不能靠解析 stdout | 必须自写检测/重启/错误映射 | 可行但重复造轮子 | **最高** | 改用 Burn BA |

## 方案详评

### 1. WiX Burn custom WPF BA + WiX MSI

#### 为什么最匹配

Burn 官方把 BA 定义为 bundle 的用户体验与业务逻辑层，并允许 entirely custom native 或 managed BA。WiX v5 起 custom BA 是进程外 EXE，降低了把 UI 装进安装引擎进程的耦合。WiX v7 是研究日的当前 major；不得直接照搬过时的 WiX v3 DLL BA 示例。

WPF 本身是开源 MIT，官方能力包含分辨率无关矢量渲染、2D/3D、硬件加速、动画、样式和模板，适合实现：

- 无边框圆角窗口与可拖动标题区；
- 大颗四角星矢量主体，不依赖低分辨率位图；
- 灰色到银色的材质、光泽、阴影和高光插值；
- 根据真实 `OverallPercentage` 推进亮度，不使用假计时器伪造进度；
- 安装完成时短暂闪烁，卸载时反向变暗；
- 减弱动画、键盘导航、屏幕阅读器名称和高对比度回退。

官方依据：

- WPF 概览：https://learn.microsoft.com/en-us/dotnet/desktop/wpf/overview/
- WPF 动画：https://learn.microsoft.com/en-us/dotnet/desktop/wpf/graphics-multimedia/animation-overview
- WPF MIT 许可证：https://github.com/dotnet/wpf/blob/main/LICENSE.TXT
- .NET 自包含/单文件部署：https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file/overview

#### 安装可靠性

Burn 可链 MSI/EXE/MSP/MSU，并向 BA 提供 Detect、Plan、Cache、Verify、Execute、Progress、Rollback、Restart 等事件。`ExecuteProgressEventArgs` 同时提供单包进度和整体百分比。MSI 默认安装失败时创建 rollback script 并恢复原状态。per-machine MSI 使用 Windows Installer 的 machine context；安装目录通过 Burn 变量映射到 MSI 的公开属性。

官方依据：

- BA 事件接口：https://docs.firegiant.com/wix/api/wixtoolsetmbacore/idefaultbootstrapperapplication/
- 进度事件：https://docs.firegiant.com/wix/api/wixtoolsetmbacore/executeprogresseventargs/
- Burn 向 MSI 传属性：https://docs.firegiant.com/wix/schema/wxs/msiproperty/
- MSI 安装上下文：https://learn.microsoft.com/en-us/windows/win32/msi/installation-context
- MSI 回滚：https://learn.microsoft.com/en-us/windows/win32/msi/rollback-installation
- WiX Package scope/默认 major upgrade：https://docs.firegiant.com/wix/schema/wxs/package/
- WiX MajorUpgrade：https://docs.firegiant.com/wix/schema/wxs/majorupgrade/

#### 签名链

正式包至少需要：

1. 签 Electron 主 EXE 和随包原生二进制；
2. 签 MSI；
3. 按 WiX 官方顺序分离 Burn engine、签 engine，再重新附加 container 并签最终 bundle；
4. 使用 SHA-256 与可信时间戳；
5. 在发布 manifest 中冻结 Setup、MSI、payload 与签名验证结果。

WiX 官方还说明 bundle manifest 会记录所含文件哈希，签名 bundle 后 Burn 会核验这些哈希。

官方依据：https://docs.firegiant.com/wix/tools/signing/

#### WPF 与 native BA 的选择

- **推荐 WPF BA：** XAML、动画、数据绑定、无障碍与设计迭代效率远胜 C++，更适合当前视觉目标；发布为 self-contained x64，避免目标机先装 .NET Desktop Runtime。
- **native C++ BA 仅作特殊备选：** 启动依赖更少，但窗口、动画、DPI、无障碍、状态机与安全代码的实现/审查成本明显更高。除非存在“连自包含 .NET BA 都不能接受”的明确需求，否则不选。
- **WixStdBA 不够：** 它能通过 XML theme 改外观，但仍是受限标准 BA，不应承担本次完整动画设计。

#### 必须接受的维护代价

- WiX 采用年度 major；消费者安全修复窗口有明确期限，必须每年预留升级验证，而不是永久钉死版本；
- WPF self-contained 会增加 Setup 体积；
- BA 必须覆盖失败、取消、回滚、重启、UAC 被拒、磁盘不足、文件占用、旧版本检测，而不仅是成功动画；
- MSI 的 Component GUID、UpgradeCode、产品版本与 key path 一旦发布就是兼容契约；
- 任何 WiX 源码修改都要按 MS-RL 单独评估；通常不需要 fork WiX。

### 2. WiX MSI only

MSI 能可靠提供 per-machine、UAC、INSTALLFOLDER、进度、repair、rollback、ARP 和 major upgrade。它应该成为 payload 执行层，但不应该直接呈现本次动画。

Windows Installer 的内置 UI 是 MSI 数据库里的 Dialog、Control 和序列。即使 WiX `WixUI_Advanced` 能选目录/功能，也仍是传统向导，不适合无边框 3D 星体与材质动画。

官方依据：

- Windows Installer UI：https://learn.microsoft.com/en-us/windows/win32/msi/using-the-user-interface
- WiX UI：https://docs.firegiant.com/wix/schema/ui/wixui/
- WiXUI Advanced：https://docs.firegiant.com/wix3/wixui/dialog_reference/wixui_advanced/

### 3. Inno Setup 7.1.0

Inno Setup 源码许可证明确允许任何目的（包括商业）使用、修改和再分发，但有保留版权声明、修改版本标识等条件。官方商业页面另请求达到条件的商业用户购买许可证，并明确说该购买不是严格强制；这与代码许可证不是同一概念，项目所有者仍应记录选择。

#### 版本证据冲突说明

本轮一度从搜索索引缓存读到 `7.0.2（2026-07-13）`，但该摘要已经滞后，不能作为“当前版本”的最终证据。随后重新直接打开官方实时页面，得到一致的当前证据：

- `https://jrsoftware.org/isdl.php` 实时列出 `innosetup-7.1.0-x64.exe` 与 `innosetup-7.1.0-x86.exe`，日期为 2026-08-12；
- `https://jrsoftware.org/ishelp/topic_whatisinnosetup.htm` 页面正文为 `Inno Setup version 7.1.0`；
- `https://github.com/jrsoftware/issrc/releases/tag/is-7_1_0` 是 Immutable release，tag 与对应 commit 均显示 Verified signature。

因此本报告最终锁定 **7.1.0**。以后核验易变的“当前版本”时，证据优先级固定为：官方实时下载页 + 官方不可变 release/tag > 官方正文页 > 搜索引擎缓存摘要。旧缓存只能说明历史快照，不能推翻更新后的官方发布证据。

它满足本次大部分安装生命周期要求：

- `PrivilegesRequired=admin` 默认触发 UAC，并进入 administrative install mode；
- 默认目录可指向 `{autopf}`/Program Files，用户可选择目录；
- 内建卸载器，setup 与 uninstaller 都能签名；
- `[Code]` 可创建自定义页面、表单和受支持控件；
- `CurInstallProgressChanged(CurProgress, MaxProgress)` 可驱动真实进度；
- PNG、Wizard image/header、暗色/现代样式可实现品牌化向导；
- 稳定 `AppId` 决定后续安装对既有卸载日志的识别。

官方依据：

- 进度事件：https://jrsoftware.org/ishelp/topic_scriptevents.htm
- PNG/向导图：https://jrsoftware.org/ishelp/topic_setup_wizardimagefile.htm
- 稳定 AppId：https://jrsoftware.org/ishelp/topic_setup_appid.htm
- 签名卸载器：https://jrsoftware.org/ishelp/topic_setup_signeduninstaller.htm
- 安装更新说明：https://jrsoftware.org/ishelp/topic_technotes.htm

局限：Inno Setup 的“自定义”主要在其既有 Wizard/VCL 模型上。能做一套协调、顺滑、维护成本低的星形主题安装器；但若把“任意现代窗口、3D 材质实时变化”视为不可降级硬条件，最终仍应选 WPF BA。

它也不是 MSI 事务/repair 引擎。官方 Installation Order 明确：完成卸载器/日志创建后用户不能再取消，之后发生错误时，之前已经完成的更改不会继续回滚。因此，Inno 适合单体 Electron 应用的文件/快捷方式安装，但不能把它描述成与 MSI rollback 等价。

官方依据：https://jrsoftware.org/ishelp/topic_installorder.htm

### 4. InstallForge（新增候选）

#### 是否开源

**不是。** 官方 Features 明确称其为 `native, proprietary setup engine`；官方 EULA 称工具按 Freeware 分发，同时禁止 reverse engineer、decompile 或 disassemble，并保留全部著作权。这与“源码可查看、可修改、可按开源许可证再分发”完全不同。

官方依据：

- Features：https://docs.installforge.net/getting-started/features/
- EULA：https://docs.installforge.net/license/

#### 商业使用

官方 FAQ 与 EULA 表示 InstallForge 可免费用于个人和商业用途，使用其功能创建的 setup package 可以分发；但 EULA 的 distribution/use-restriction 表述存在容易误读的限制性语句，且 Visual Update 自 1.5.0 起商业使用另需 Pro 许可。这里仅记录官方文本，不作法律意见；若商业发布使用，仍应由项目所有者按完整 EULA 做书面确认。

官方依据：

- FAQ：https://docs.installforge.net/faq/
- Release notes（Visual Update 商业限制）：https://docs.installforge.net/release-notes/
- EULA：https://docs.installforge.net/license/

#### UI、全机安装与卸载

InstallForge 支持传统 wizard、GUI 外观、setup icon、PNG header/wizard image、自定义 splash、安装路径、管理员权限、内建卸载和任务栏进度。这些足够做传统品牌化安装器，却没有官方证据证明可以替换整个窗口渲染/状态机，或实现 WPF 级矢量、3D、透明无边框和进度绑定动画。新版 release notes 还记录移除了 custom dynamic libraries，进一步削弱深度扩展可控性。

官方依据：

- 默认 Program Files 与允许改目录：https://docs.installforge.net/getting-started/quick-start-guide/
- 管理员/全机路径常量：https://docs.installforge.net/how-tos/using-predefined-constants/
- 内建卸载与自定义 ARP icon：https://docs.installforge.net/how-tos/using-custom-display-icon-in-windows-apps-and-features/
- Custom commands：https://docs.installforge.net/how-tos/using-custom-commands/

#### 旧 NSIS 迁移

InstallForge 不能继承现有 NSIS 的 uninstall registry、安装收据与文件所有权。唯一可见途径是用 custom command 调用旧卸载器，但官方没有给出跨 NSIS 的检测、事务回滚和所有权迁移契约。这样做仍需枕星 AI 助手自己编写、测试并承担迁移失败。

与 Inno Setup 对比：

- 两者都不能自动“接管”旧 NSIS；都必须显式检测旧卸载注册项并调用旧 uninstaller 或要求先卸载；
- Inno Setup 的引擎源码和脚本模型可审查、可修改，许可证允许修改；InstallForge 的 proprietary engine 不可修改；
- Inno Setup 的 `[Code]`/自定义表单/事件 API 比 InstallForge GUI builder + custom commands 更适合复杂迁移和 UI 状态控制；
- InstallForge 可能更快拖拽出传统向导，但不满足“开源、好改、好看”的组合硬条件。

**结论：InstallForge 不进入 PoC。**

### 5. Velopack

Velopack 是 MIT，更新与签名流程清晰，也有官方 JavaScript/Electron 集成。它适合“应用启动后检查/下载/应用更新”，但不适合本次安装窗口：

- 官方称 Setup 是 one-click，主要定制是 icon 与 PNG/JPG/animated GIF splash；
- Setup 默认安装 `%LocalAppData%`，不提权；
- per-machine 需要生成 MSI，安装到 Program Files/HKLM 并触发 UAC；
- MSI 由 WiX 5 生成。WiX 官方生命周期显示 v5 的消费者安全修复已于 2026-02-05 结束，因此在 2026-08-17 采用前必须要求 Velopack 明确其 WiX toolchain 升级计划；这不是断言现有产物有漏洞，而是供应链尽调项。

官方依据：

- 仓库与 MIT：https://github.com/velopack/velopack
- Installers：https://docs.velopack.io/packaging/installer
- Windows per-user/per-machine：https://docs.velopack.io/packaging/operating-systems/windows
- Electron JS：https://docs.velopack.io/getting-started/javascript
- Signing：https://docs.velopack.io/packaging/signing

若未来选择 Velopack，只建议单独立项评估 updater；不要把“换安装器 UI”和“换更新协议/发布资产”绑成一次迁移。

### 6. MSIX / App Installer

MSIX 的优势是签名、原子部署、差分更新和干净卸载，App Installer file 可定义更新源。MSIX SDK 仓库是 MIT。但消费端安装窗口由 Windows App Installer 提供，官方 XML 只允许背景/强调色/字体/图标/按钮文字/对齐等有限字段，不是任意窗口或动画框架。

MSIX 还把包安装进受保护的 `C:\Program Files\WindowsApps`，包文件只读并受容器/重定向规则约束；这与当前普通安装目录、现有更新资源和兼容收据可能冲突。全机部署更适合 Store、Intune、企业 device context，而不是本次用户可选目录的品牌向导。

官方依据：

- MSIX SDK MIT：https://github.com/microsoft/msix-packaging/blob/master/LICENSE
- App Installer UI：https://learn.microsoft.com/en-us/windows/msix/app-installer/app-installer-root
- 有限 UX XML：https://learn.microsoft.com/en-us/windows/msix/app-installer/how-to-create-custom-app-installer-ux
- App Installer 更新文件：https://learn.microsoft.com/en-us/windows/msix/app-installer/app-installer-file-overview
- MSIX 容器：https://learn.microsoft.com/en-us/windows/msix/msix-containerization-overview
- 签名：https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview

### 7. Squirrel.Windows

Squirrel.Windows 是 MIT，但目标与本次要求相反：官方 README 明确 wizard-free、无 UAC；安装文档明确使用 `%LocalAppData%` 保证普通用户写权限。官方 update-process 仍使用 SHA1 RELEASES，并明确没有 built-in rollback。

#### 当前维护状态

截至 2026-08-17，官方仓库首页仍以 `Contributors Needed` 开头，明确征集维护者；官方 Releases 页显示的最新正式版为 `2.0.1`，发布日期是 2020-09-27。仓库仍可见提交/PR，不等于完全无活动，但“六年没有新的正式 release + 明确征维护者”不适合作为新产品安装/更新根链路的维护基线。

官方依据：

- 仓库首页：https://github.com/Squirrel/Squirrel.Windows
- Releases：https://github.com/Squirrel/Squirrel.Windows/releases

#### per-user、所谓 machine-wide 与 UAC

普通 `Setup.exe` 固定采用 `%LocalAppData%\MyApp`，目的就是让普通用户可写；README 把 no UAC 作为设计目标。Squirrel 的 Releasify 虽会生成 MSI，但官方 `machine-wide-installs.md` 明确说它**不是 general-purpose installer**，而是适合 Group Policy 的引导器：运行 MSI 后，各用户在下一次登录时才得到应用，实际应用仍落在各自 LocalAppData。它不等价于本项目要求的“一次 UAC 后安装到 Program Files、全机共用一份应用”。

官方依据：https://github.com/Squirrel/Squirrel.Windows/blob/develop/docs/using/machine-wide-installs.md

#### UI 与卸载

Squirrel 的安装体验刻意没有 wizard。官方 Electron 封装可配置 loading GIF、Setup icon、ARP icon，但没有可替换整窗布局、目录页或 WPF 动画状态机的正式接口。卸载由 `Update.exe --uninstall` 和应用收到的 `--squirrel-uninstall` 事件协作；这说明它有卸载通路，但应用必须在主进程最早期接住 Squirrel events，并在短时间内退出/清理。

官方依据：https://github.com/electron/windows-installer

#### Electron 适配与旧 NSIS 迁移

Electron 官方 GitHub 组织维护的 `electron-winstaller` 能把 Electron 目录打成 `.nupkg`、`RELEASES`、Setup.exe/MSI，并支持 Authenticode。接入不是只换最后一个 EXE：应用还要引入/实现 Squirrel events，更新协议改成 RELEASES + full/delta nupkg，快捷方式也改为指向 Update.exe。

Squirrel 官方 FAQ 只给出 ClickOnce -> Squirrel 的迁移提示，没有 NSIS -> Squirrel 的所有权迁移能力。对本项目仍需显式检测旧 NSIS uninstall registry、调用旧 uninstaller、验证旧目录/进程，再进入 Squirrel 安装；而安装范围又从旧 per-machine Program Files 变成 per-user LocalAppData，数据、快捷方式、更新后台与已安装检测都会同时改变。这个迁移面比 Inno Setup 或 Burn+MSI 更大。

#### 与 Inno Setup 的直接比较

- 两者都是开源，但 Squirrel 是 MIT；Inno 是允许商业使用/修改/再分发的自定义许可证；
- Inno Setup 7.1.0 可明确 `PrivilegesRequired=admin`、Program Files、用户选目录、传统向导与自定义页面；Squirrel 普通 Setup 固定 per-user/no UAC/wizard-free；
- Inno 能保留当前枕星 AI 助手更新后台，只替换安装器；Squirrel 会同时引入自己的 RELEASES/nupkg/Update.exe 更新模型；
- Inno 没有 MSI 级完整回滚/repair，但仍更符合本项目当前全机、目录、UI、迁移面可控四项锁定条件；
- Squirrel 的优势是 per-user 无感安装与 delta 更新，而这些恰好不是本次优先目标。

结论：**Squirrel 符合“开源”，但不符合“全机、UAC、自选目录、完整现代 UI、低风险旧 NSIS 迁移”；不进入 PoC。**

官方依据：

- 仓库/维护状态/许可证：https://github.com/Squirrel/Squirrel.Windows
- MIT：https://github.com/Squirrel/Squirrel.Windows/blob/develop/COPYING
- per-user 安装流程：https://github.com/Squirrel/Squirrel.Windows/blob/develop/docs/using/install-process.md
- 所谓 machine-wide MSI：https://github.com/Squirrel/Squirrel.Windows/blob/develop/docs/using/machine-wide-installs.md
- 更新与无内建 rollback：https://github.com/Squirrel/Squirrel.Windows/blob/develop/docs/using/update-process.md
- Electron 封装与 uninstall events：https://github.com/electron/windows-installer

### 8. 手写 UI 启动器 + 标准 MSI

Windows Installer 的 external UI API 的确可以报告 progress units、install start/end、FilesInUse 和错误记录，但这并不意味着“启动 `msiexec` 并解析 stdout”可靠。一个真正可发布的手写 launcher 仍需负责：

- UAC 前后两个进程的身份与安全 IPC；
- MSI 检测、repair、upgrade、reboot/resume；
- cancellation、FilesInUse、错误码和日志；
- UI 退出时安装事务的所有权；
- launcher 自己的签名、缓存、来源验证与防劫持。

这正是 Burn 已经解决的问题。因此，本报告把“custom WPF BA + MSI”视为可接受的“自定义 UI 启动器 + 标准 MSI”；把普通手写 EXE + `msiexec` 视为拒绝方案。

官方依据：https://learn.microsoft.com/en-us/windows/win32/api/msi/nf-msi-msisetexternaluirecord

## 旧 NSIS 迁移不是普通升级

无论换 WiX、Inno Setup 还是 InstallForge，新安装器都不会自动拥有旧 NSIS 安装的文件、注册表、快捷方式和卸载条目。第一版新安装器必须把跨技术迁移当作单独产品流程：

1. 只读检测旧 NSIS uninstall registry、旧安装目录、运行进程和旧版本；
2. 若检测到旧版，明确提示用户将先关闭应用并调用**旧版官方 uninstaller**；
3. 不直接删除旧目录，不伪造旧卸载收据，不把旧文件误记为 MSI Component；
4. 旧卸载成功且目录/进程验证通过后，才开始新安装；
5. 旧卸载失败时停止并保留日志，不继续覆盖；
6. 用户数据目录必须列入保留 allowlist，不随程序文件卸载；
7. 新 installer/bundle 的产品标识、UpgradeCode、Component GUID 与 install receipt 从首次发布起冻结；
8. 用真实的已安装 0.1.100（或发布时实际旧版）做迁移验收，不能只在空机测试。

Burn 可以通过 `ExePackage` 链旧卸载器，但是否安全取决于旧卸载器的检测条件、退出码、静默参数与缓存可用性；没有这些确证前，不应自动链入。保守首发可先要求用户确认卸载旧版，再继续新安装。

## 最小迁移切片

### Slice 0：冻结基线，不动发布

- 冻结当前正式 NSIS/Portable 的文件名、SHA-256、签名状态、安装目录、ARP 条目、卸载命令与旧数据目录；
- 记录现有 `appId`、产品名、内部 `aihub` 兼容标识和已安装检测逻辑；
- 现有安装器继续作为唯一正式通道，新方案只是 review candidate。

### Slice 1：只做 MSI payload PoC

- 保留现有 Electron build；调用 `electron-builder --dir` 产出 `win-unpacked`；
- 新建最小 WiX MSI，只安装 payload、快捷方式、ARP 与 uninstall；
- 不加 custom action，不迁移 updater，不接生产发布；
- 验证 per-machine、Program Files、自选目录、repair、uninstall、取消/rollback。

### Slice 2：做无视觉的 Burn 生命周期

- 用最小 BA 接通 Detect -> Plan -> Apply；
- 绑定真实 OverallPercentage、取消、UAC 拒绝、磁盘不足、文件占用、失败/rollback；
- 输出 MSI log 与 Burn log；
- 先通过虚拟机/Windows Sandbox 生命周期矩阵。

### Slice 3：替换为 WPF 品牌窗口

- 星体用 XAML vector/geometry，不用锯齿位图；
- 亮度由真实安装进度驱动，状态切换用可测试的 view-model；
- 安装目录放在主视觉下方；Apply 时才触发 UAC；
- 安装/卸载分别定义灰->银->亮、亮->暗动画；
- 加入 reduced motion、高对比度、键盘操作与错误详情。

### Slice 4：旧 NSIS 迁移 PoC

- 只针对一个冻结旧版本和一个明确安装范围；
- 检测、提示、调用旧 uninstaller、后验证、再安装；
- 覆盖旧版运行中、UAC 取消、卸载器缺失、旧目录残留、数据保留；
- 不允许直接“覆盖旧的就行”。

### Slice 5：并行候选，不替换正式包

- 同一 Electron payload 同时产出旧 NSIS candidate 与新 Burn candidate；
- 分别冻结 SHA-256、文件大小、签名验证、SBOM/第三方许可证；
- 包内检查继续验证 `app.asar`、catalog/update channel；
- 自动化 PASS 只代表候选包闭包，不代表真实安装通过。

### Slice 6：真实机器验收后切换

- 新装、改目录、升级、跨 NSIS 迁移、repair、卸载、重装、重启、低磁盘、进程占用、中文路径；
- 安装器/卸载器 UI、任务栏、UAC 发布者、ARP icon 与快捷方式都人工验收；
- 明确回滚开关：正式下载地址仍可切回旧 NSIS；
- 只有真实用户机器验收通过后，才替换正式下载与 `package-server-connected-review` 的 NSIS target。

### Slice 7：更新器另立项目

- 首次迁移保留现有枕星 AI 助手更新后台、channel 与签名协议；
- Burn 的 bundle update、Velopack 或 MSIX 更新均后置；
- 安装器迁移与更新协议迁移不得同一版本合并，避免无法定位回归来源。

## 验收矩阵与阻断门

至少覆盖：

| 维度 | 必测情形 |
|---|---|
| 安装范围 | 标准用户输入管理员凭据；管理员用户；UAC 取消 |
| 目录 | 默认 Program Files；自选英文/中文/空格目录；无权限目录 |
| 生命周期 | 新装、repair、同版本重装、升级、降级阻断、卸载、重装 |
| 旧版迁移 | 旧 NSIS 正常、运行中、卸载器缺失、卸载失败、残留目录 |
| 事务 | 中途取消、磁盘不足、文件占用、断电/重启模拟、rollback |
| UI | 100%/125%/150%/200% DPI；高对比度；reduced motion；键盘 |
| 签名 | Electron EXE、MSI、Burn engine、最终 bundle、uninstaller、时间戳 |
| 包内闭包 | `app.asar`、catalog channel、update channel、LICENSE/NOTICE |
| 真实验收 | Windows Sandbox/VM 自动化、隔离包、真实用户机、生产发布分别记录 |

阻断条件：

- WiX v7 EULA/OSMF 未书面确认；
- 签名证书/时间戳链未闭合；
- 旧 NSIS 卸载/数据保留规则未冻结；
- 安装进度用模拟计时而非 Burn/MSI 实际事件；
- 只验证成功路径，没有取消/回滚/失败态；
- 只通过自动化或隔离包，就宣称真实用户安装完成；
- 安装器退出而子进程仍运行，或包被提前移动/覆盖；
- 为视觉效果引入未审计的第三方动画/皮肤 DLL。

## 最终决策

1. **目标不降级（完整现代动画）**：WiX v7 Burn + self-contained WPF custom BA + WiX MSI；先过 WiX v7 EULA/OSMF 门。
2. **条款门或投入门不通过**：Inno Setup 7.1.0；把视觉目标降为高质量二维星形主题/帧动画，保留现有更新后台。
3. **InstallForge 不进入 PoC**：免费不等于开源，proprietary engine 与禁止反编译直接违反硬条件。
4. **不采用** MSI-only UI、Velopack one-click 作为主 UI、MSIX consumer UI、Squirrel、普通自写 launcher + `msiexec`。
5. **不把旧 NSIS 当作可直接覆盖的同族升级**；跨技术迁移必须单独验收。

本报告不是实现授权，也不是安装、封包、签名、上传或生产切换授权。
