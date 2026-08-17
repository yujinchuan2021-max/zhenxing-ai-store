# 枕星AI助手 Windows 远程目录

客户端按以下顺序加载内容：

1. `channel.json` 中配置的 HTTPS 远程目录；
2. 上一次成功校验并保存的本地缓存；
3. 客户端内置目录。

## 上线配置

`channel.json` 的 `remoteUrl` 在真实目录部署并通过 HTTPS 验证前必须保持为空。
上线后可填写远程 `catalog-v1.json` 地址。若使用固定发布版本，可同时填写该文件的
SHA-256 到 `expectedSha256`。

活动目录使用 catalog schema v2。核心关系为：

- `vendors`：厂商资料只保存一份。
- `products`：每个产品的 `directoryKind` 只能是 `ai-tool` 或 `ai-connectable`；两个厂商目录由启用产品投影。
- `resources`：顶层生态资源；产品不再包含 `extensions`。
- `resourceTypes`：由 `skill`、`mcp`、`plugin` 组成的非空数组。
- `sourceProductIds`：资源来源或被接入产品。
- `targets`：目标产品、兼容性、固定模块、审核配置和有限能力。

资源商店按“资源类型 → 目标厂商 → 目标产品”展示。同一资源支持多个目标时只保存一份，并通过多个目标关系投影。

客户端会拒绝以下内容：

- 大于 1 MB 的目录；
- 非 HTTPS 的厂商、教程、产品或安装包地址；
- 未知的产品类型、分类或环境要求；
- 重复的厂商 ID、产品 ID；
- 重复的资源 ID、未知的 `directoryKind` 或未知资源类型；
- 引用不存在或已停用边界不合法的厂商、来源产品、目标产品；
- 资源目标使用未知模块、未经批准的安装配置或越权能力；
- 产品中的旧 `extensions` 字段；
- 包含路径的安装包文件名；
- 非 `.exe`、`.msi`、`.msix`、`.zip` 的安装包。

目录只能引用客户端已经公开的固定本地能力。后台不能通过资源或目标关系下发 EXE、Shell、PowerShell、CMD、包名、任意 URL、任意配置片段、参数或本地路径。

远程目录加载或校验失败时不会清空现有内容，而是自动使用缓存或内置目录。
