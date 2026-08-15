# Connector-managed 客户端安全裁决（2026-08-06）

状态：阻断；保持 `resource-link`。本轮未修改 catalog、state、客户端执行代码或发布物，也未登录、连接或安装外部产品。

## 结论

`adobe-for-creativity` 与 `sketchup-claude-connector` 均不满足 `connector-managed` 的最低闭环。两项连接都由用户在 Claude/Adobe/Trimble 的官方账号界面完成；AI Hub 没有不读取凭据即可查询的连接状态接口，也没有可精确执行并验证结果的断开/撤销接口。因此 AI Hub 不能证明连接由自己创建，不能建立管理收据，也不能安全提供 `connect`、`detect` 或 `disconnect` 能力。

新增一个只打开说明页的 managed adapter 不会增加能力，只会把现有 `resource-link` 包装成虚假的生命周期模块；按深模块删除测试，它属于应删除的浅层接口，不实施。

## 两项逐项裁决

| 候选 | 固定宿主与官方授权 | 无秘密检测 | 精确断开/撤销 | AI Hub 收据所有权 | 裁决 |
| --- | --- | --- | --- | --- | --- |
| `adobe-for-creativity` | 宿主固定为 `claude-desktop`；用户在 Claude Connector 目录确认，Adobe 账号授权留在厂商流程 | 不具备。现有证据只允许查看 Claude 内的用户可见状态；读取远端状态需要账号会话或 token | 不具备客户端接口。官方说明是 Claude 内 `Disconnect` 和按需在 Adobe 账号撤销，不是 AI Hub 可调用并复核的操作 | 不成立。连接和授权均在第三方界面发生，AI Hub 无法证明因果或拥有远端授权 | 保持 `resource-link` + `website` |
| `sketchup-claude-connector` | 宿主固定为 `claude-desktop`；Trimble ID 与 Claude 账号由用户在官方流程授权 | 不具备。不得以本机 SketchUp 是否安装代替远端 Connector 状态，也不得读取 Claude/Trimble 凭据 | 不具备。候选证据仅允许提示用户在官方账户界面自行断开；尚无客户端可调用并验证的精确撤销接口 | 不成立。AI Hub 不创建连接，也不能确认远端授权属于本次操作 | 保持 `resource-link` + `website` |

## 现有客户端 seam 复核

- active6 与 draft89 中两项 target 均为 `moduleId=resource-link`、空 `installProfileId`、`capabilities=["website"]`；这是当前真实能力。
- `extension-install-registry` 的 8 个固定 profile 只覆盖本地 Skill、MCP 和 Plugin adapter；connector 为 0。
- `extension-resource-manager` 只允许 `install/update/repair/enable/disable/uninstall`，并要求 adapter 能检查本地状态、执行动作和复核结果。现有 adapter 的收据绑定本地目录、配置项或宿主 CLI；它们不能证明第三方云账号中的 Connector 所有权。
- `managed-catalog-resource-authorization` 只接受本地批准 profile 与当前远程目录的精确匹配，并拒绝后台执行字段。把 Connector 伪装成 `mcp-managed` 会混淆资源类型、宿主接口和收据边界，应继续拒绝。
- 后台 no-op 回传确认当前没有 `connector-managed` module/profile/capability，也没有可写的 connect/disconnect/detect 或凭据字段；内存改绑 `connector-managed`/`mcp-managed` 均被 catalog 校验拒绝。

## 安全风险与保持的门禁

1. 不读取、收集或保存账号、密码、OAuth code、access/refresh token、Cookie 或 Claude/Adobe/Trimble 本地会话。
2. 不接受后台 `command`、`args`、`env`、`headers`、`script`、`credentials` 或自定义 Connector URL。
3. 不把“打开官方说明页”记录为已连接，不创建 AI Hub 管理收据，不把本机 SketchUp/Claude 安装状态冒充 Connector 状态。
4. 不复用会写 Claude Code/Cursor/Codex 本地配置的 MCP adapter；Claude Desktop 的远端 Connector 与这些本地配置不是同一宿主 seam。

## 未来解除阻断的必要条件

只有厂商或宿主同时提供以下固定、可审计接口后，才重新评估一个共享 connector module：

1. 无需向 AI Hub 暴露秘密即可查询的明确 Connector identity 与连接状态；
2. 固定官方授权入口及可机器校验的最小权限集合，用户在官方界面逐次确认；
3. 针对同一 Connector identity 的精确断开/撤销操作，以及无需读取秘密的完成后检测；
4. 能证明“本次 AI Hub 发起动作”与远端连接之间关系的事务标识；否则只能记录“已打开官方流程”，不能记录管理收据；
5. 客户端固定 profile 与 adapter；后台仍只能引用 profile，不得下发命令、凭据或执行参数。

在这些条件满足前，`resource-link` 已完整表达真实能力，无需新增客户端模块或测试代码。
