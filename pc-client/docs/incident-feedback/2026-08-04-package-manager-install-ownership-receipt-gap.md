# Windows 包管理器安装实例缺少枕星 AI 收据

## 现象

Windows 包管理器产品能按固定 Package ID 安装、检测、打开和卸载，但客户端没有独立安装收据。用户手工安装的软件只要被 Winget 映射到同一 Package ID，也会被客户端当作可自动卸载对象。

## 证据

- `detectWindowsPackageManagerProduct` 只依据 `winget list` 的精确 Package ID，把所有命中项都标记为 `canUninstall: true`。
- `uninstallWindowsPackageManagerProduct` 在确认后直接调用固定 `winget uninstall`，未验证该实例是否由枕星 AI 安装。
- 132 个包管理器产品共用同一实现，因此不是 Audacity 单品问题。

## 根因

固定 Package ID 证明的是产品身份，不证明安装实例所有权。初版模块把“能够精确定位软件包”错误等同于“枕星 AI 有权自动卸载该软件包”。

## 被排除的错误方案

- 不因本机验收前确认 Audacity 未安装，就忽略长期所有权问题。
- 不给 Audacity 添加单品特例。
- 不把用户手工安装的软件静默收编为枕星 AI 所有。

## 修复

- 在共享 Windows 包管理器模块中新增固定 schema 的安装收据，绑定产品 ID、driver、source 和 Package ID。
- 仅当安装前精确不存在，或已有匹配收据时，安装/升级成功后写入或刷新收据。
- 自动 Winget 卸载前和用户确认后都重新验证收据；确认后收据变化立即停止。
- 卸载后只有精确检测为 absent 才删除收据。
- 对已存在但没有匹配收据的软件，只打开 Windows“已安装的应用”面板，由用户手动卸载，不执行 `winget uninstall`。

## 自动验证

- 共享模块测试覆盖收据创建、解析、大小写无关的精确 Package ID 匹配、source 和产品 ID 错配拒绝、路径型产品 ID 拒绝。
- Electron 结构门禁覆盖安装后写收据、自动卸载双重收据校验、外部软件只打开系统面板、卸载确认后删除收据。

## 剩余人工验收

使用一个安装前不存在的 Winget 产品，真实完成安装、检测、打开、卸载，并确认收据仅在安装成功后出现、卸载确认 absent 后消失。另需在已有但无收据的软件上确认只打开系统面板。

## 防复发门禁

包管理器目录扩充不得改变所有权规则。新增 driver 或 source 时，必须先扩展收据 schema 和匹配测试；固定 Package ID 永远不能单独授予自动卸载权。
