# Microsoft Store 在 VPN/代理环境下打不开

## 现象

少量 Windows 产品只能通过 Microsoft Store 安装。安装引导器下载成功后，商店仍可能因为 VPN、代理、网络、缓存、系统时间/区域或 Windows 更新状态而打不开。官网 EXE/MSI 下载不受这条流程影响。

## 根因边界

- AI Hub 能证明官方引导器已下载和启动，但不能把“Windows 已接收打开请求”当成商店已正常加载。
- Electron 或浏览器的 HTTPS 基础连通性不等于 Microsoft Store 客户端功能正常。
- 自动关闭 VPN、修改代理、重启服务或重注册 Appx 包会越过用户控制边界，也可能破坏企业或个人网络配置。

## 统一处理

1. 只有 `store-bootstrapper` 安装类型展示商店提示。
2. 首次操作先让用户关闭 VPN/代理并继续；官网直装产品不显示这条提示。
3. 用户明确选择“仍打不开，检测修复”后，才运行只读的商店组件和官方网页基础连通性检测。
4. 修复动作只包含微软公开入口：
   - `wsreset.exe` 重置商店缓存；
   - Microsoft Store 高级选项中的“修复/重置”；
   - Windows 更新、代理设置与微软官方帮助。
5. AI Hub 不自动更改 VPN、代理、服务、注册表或 Appx 注册状态。

## 自动验证

- 非 Store 安装器不会出现 VPN/代理文案或修复分支。
- Store 三个选择固定映射为取消、检测修复、继续启动，防止新增按钮后误运行安装器。
- 商店包只接受固定的 Microsoft 包名称、包族和发布者身份。
- 源码门禁禁止修复流程出现 `Add-AppxPackage`、`Remove-AppxPackage`、服务修改和注册表写入。

## 剩余人工验收

- 在开启与关闭 VPN/代理两种状态下测试 Microsoft Store 引导器。
- 验证 `wsreset.exe` 可见启动并随后打开商店。
- 验证“打开修复设置”进入 Microsoft Store 的高级选项，而不是普通应用列表。
- 真实 Windows 验收通过前，不能宣称商店修复已在所有网络环境完成。

## 防复发门禁

任何新增商店型产品都必须显式使用 `store-bootstrapper`；任何官网 EXE/MSI/MSIX 产品都不得复用商店提示。修复能力继续由固定客户端模块拥有，后台只能选择模块，不能下发命令或系统设置 URI。
