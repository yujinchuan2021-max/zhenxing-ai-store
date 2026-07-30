# AI Hub 受管 CLI 安全卸载

## 范围

该能力只覆盖客户端白名单中的 Codex CLI、Claude Code 与 Gemini CLI。Ollama 仍按 Windows 桌面产品处理，不进入 npm CLI 卸载链路。

## 所有权边界

- 只有由 AI Hub 成功部署、写入管理收据并在软件包目录留下随机所有权标记的安装，才显示“卸载”。
- 手工安装、旧版安装、收据损坏、标记缺失、同版本手工重装、版本变化或安装内容变化都不会被接管。
- 收据记录产品、固定 npm 包名、规范安装前缀、版本、随机安装实例 ID、manifest 摘要、部署时间和 npm runtime 指纹。
- 包目录必须是预期目录本身；任何 junction、符号链接或真实路径跳转都会变成不可卸载状态。

## npm 执行边界

- Node.js 必须具有有效的 OpenJS Foundation 或 Node.js Foundation Authenticode 签名。
- Node、npm 入口与整个 npm 安装树均写入确定性 SHA-256 指纹；npm 树内出现链接、跳转或非普通文件时拒绝执行。
- 安装和卸载都由 `shared/managed-cli.cjs` 生成固定 action，不接受渲染进程传入包名或命令。
- 固定使用 `https://registry.npmjs.org/`，每次操作创建随机隔离工作目录与空的 user/global npm 配置。
- 子进程环境移除全部 `npm_config_*`、`NODE_OPTIONS` 与 `NODE_PATH` 等注入入口。
- 安装先使用 `--ignore-scripts` 禁用软件包及全部依赖脚本；Claude Code 仅额外运行客户端白名单中精确匹配的官方 `node install.cjs`，随后直接执行生成的 `claude.exe --version` 验证。Codex CLI 与 Gemini CLI 不运行额外安装脚本。
- 卸载始终使用 `--ignore-scripts`，只执行固定包名的全局 npm uninstall，`shell:false`。
- 用户配置、模型、项目、npm 缓存和同一前缀中的其他包不在删除范围内。

## 并发与确认

- Electron 使用单实例锁，第二个客户端只聚焦现有窗口。
- 产品锁在异步预检之前取得；同一安装前缀还有单独操作锁。
- 用户确认后重新计算完整 runtime 指纹并重新验证收据、随机实例 ID、版本、包名、前缀、可执行文件和完整 argv。
- 收据使用同目录临时文件加原子替换；只有可靠检测到目标包已经消失后才删除收据。

## 验证

- `npm.cmd test`：71/71 通过。
- `npm.cmd run lint`：通过。
- `npm.cmd run test:managed-cli-uninstall`：在系统临时目录离线创建真实 npm fixture，安装后走固定卸载 action。
- 集成验证确认目标包被移除，preuninstall/uninstall/postuninstall 均未执行，用户配置、模型、项目与同前缀无关包的 4 个哨兵文件全部保留，最终状态为 `absent`。
- `npm.cmd run test:claude-code-postinstall`：从官方 npm registry 在隔离临时目录真实安装 `@anthropic-ai/claude-code@2.1.220`，先禁用全部生命周期脚本，再只执行精确审核的包内 `node install.cjs`；生成的普通文件 `claude.exe` 未发生路径跳转，`claude.exe --version` 返回 `2.1.220 (Claude Code)`，测试结束后临时目录已清理。
- Playwright 覆盖：受管安装、取消卸载、成功卸载、外部安装、版本/内容不匹配、未知检测、IPC 中断后复查，以及部署后未知状态不误报成功。
- Windows x64 的 NSIS 安装版和便携版已成功打包；安装版完成一次真实的安装、启动、卸载生命周期，退出码均为 0，安装目录与注册表项均已移除，快捷方式状态恢复。
- 本轮安装版 SHA-256：`1135D3149735AC7CFC1B022D2663F3D72D1E2B3CA1009C6F03B38570FA3AA023`；便携版 SHA-256：`A2313A52FA8F6A7C3018AF9EF81979713F6CA8DC18EC5BCA5B8C397DDF443FDA`。
- 当前为开发构建，两个交付文件均未配置 Authenticode 代码签名，Windows 可能显示发布者警告；这不等同于正式签名发布验收。

## 剩余用户验收

自动验证没有卸载这台电脑上真实的 Codex CLI、Claude Code 或 Gemini CLI。正式交付前仍需用户用一个可删除的测试 CLI 安装做一次桌面客户端确认，验证确认框、日志、状态刷新和实际命令入口符合预期。

## 防回归门

- 不得只依赖包名、版本或安装路径判断所有权。
- 不得从当前 PATH 直接执行未签名、未指纹化的 Node/npm runtime。
- 不得读取用户或项目 `.npmrc` 决定白名单包来源。
- 不得启用依赖包或未审核的安装生命周期脚本；新增例外必须精确固定产品、manifest 命令、包内脚本路径、预期产物和启动验证。
- 不得启用任何卸载生命周期脚本。
- 检测为 `unknown` 时不得显示安装或卸载成功。
- 不得递归删除 CLI 前缀、用户目录、配置、缓存、模型或项目目录。
