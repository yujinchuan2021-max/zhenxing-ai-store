# 官方 CLI 软件包隔离验收

日期：2026-07-31

## 目标

验证客户端为 Codex CLI 和 Gemini CLI 配置的固定模块能够处理官方 npm 仓库中的真实软件包，同时不污染用户全局 npm 环境。

## 方法

`scripts/test-official-cli-packages.cjs` 对每个产品创建独立的系统临时目录，并使用客户端生产代码生成安装和卸载动作。

验收器固定：

- npm 源：`https://registry.npmjs.org/`
- 独立 prefix
- 空的 user/global npm 配置
- 独立 npm cache
- `shell: false`
- 安装和卸载均使用 `--ignore-scripts`

验收器不会修改用户的全局 npm prefix，也不会保存账号令牌。

## 结果

| 产品 | 官方软件包 | 版本探针 | 结果 |
| --- | --- | --- | --- |
| Codex CLI | `@openai/codex@0.146.0` | `codex-cli 0.146.0` | 通过 |
| Gemini CLI | `@google/gemini-cli@0.53.0` | `0.53.0` | 通过 |

每个产品均通过：

- 官方包真实安装。
- 包内 CLI 入口路径约束和真实路径检查。
- `--version` 执行。
- 无收据时拒绝生成受管卸载动作。
- 有收据时生成固定卸载动作。
- 卸载后目标包消失。
- 同一 prefix 下无关 sentinel 文件保持不变。
- 临时验收根目录安全清理。

## 边界

这证明当前官方软件包与客户端模块兼容，不代表用户日常网络、权限、代理和登录流程已经验收。用户仍需按 `docs/user-acceptance-checklist.md` 完成真实一键部署确认。
