# Third-party notices

枕星 AI 的原创软件源代码采用 Apache License 2.0。第三方软件、素材、
目录元数据和用户内容不因本项目许可证而重新授权。

## 直接软件依赖

下表依据仓库内固定的 `package-lock.json` 记录主要直接依赖。完整的精确版本、
传递依赖和许可证表达式以各 lockfile 与上游包内许可证文件为准。

| 组件 | 固定版本 | 上游许可证 | 使用范围 |
| --- | --- | --- | --- |
| Drizzle ORM | 0.45.2 | Apache-2.0 | 网站数据访问 |
| Next.js | 16.2.6 | MIT | 网站运行时 |
| React / React DOM | 19.2.x | MIT | 网站与 Windows 客户端界面 |
| Electron | 39.8.10 | MIT | Windows 客户端运行时 |
| Vite | 7.3.6 / 8.0.13 | MIT | 客户端与网站构建 |
| TypeScript | 5.9.3 | Apache-2.0 | 构建工具链 |
| node-postgres (`pg`) | 8.16.3 | MIT | Identity 服务数据库访问 |
| Nodemailer | 9.0.3 | MIT-0 | Identity 服务邮件发送 |

Electron 分发物还包含 Chromium 等第三方组件；正式分发中由 Electron 提供的
`LICENSE.electron.txt` 和 `LICENSES.chromium.html` 继续适用，不能由本文件替代。

## 随仓库提供的扩展资源

- `pc-client/extension-resources/codex/chatgpt-apps/` 随附自己的
  `LICENSE.txt`（Apache-2.0）和来源记录；该目录的许可证与归属声明继续保留。
- 其他扩展、Skill、MCP、插件或连接器只有在各自目录明确随附许可证时，才按该
  许可证授权其内容。目录中的链接或元数据不代表枕星 AI 获得上游代码的再授权权。

## 商标、图标、目录与社区内容

- 厂商名称、商标和图标归各权利人所有，仅用于识别相应产品或服务。
- 资源目录中的第三方事实、描述和链接受其来源条款约束，不自动成为 Apache-2.0 内容。
- 社区帖子、用户提交和外部网站内容归其作者或权利人所有。

本文件用于说明边界，不替代任何第三方组件随附的许可证、NOTICE、服务条款或
商标规则。如本文件与上游许可文本冲突，以相应上游许可文本为准。
