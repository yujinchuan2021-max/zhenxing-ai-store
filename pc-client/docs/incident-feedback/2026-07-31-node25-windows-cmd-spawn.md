# Node 25 Windows 打包脚本无法启动 npm.cmd

日期：2026-07-31

## 用户可见现象

执行 `npm.cmd run package:win:local-release` 后立即失败，没有生成新的本地验收安装包。

## 失败阶段

`scripts/package-local-release.cjs` 使用 `spawnSync("npm.cmd", ..., { shell: false })` 启动内部构建。Node 25.2.1 在 Windows 上对批处理入口返回 `EINVAL`。

## 根因

`.cmd` 是由 Windows 命令解释器处理的脚本，不是可由 `CreateProcess` 直接执行的二进制文件。旧运行时环境没有暴露该兼容性问题，升级到 Node 25 后脚本失败。

## 修复

打包脚本不再直接启动 `npm.cmd` 或 `npx.cmd`。在 Windows 上，它从当前 npm 进程的绝对 `npm_execpath` 定位 `npm-cli.js`/`npx-cli.js`，再使用当前 `process.execPath` 直接执行。

该方式不启用 shell，不拼接命令字符串，也不扩大可执行命令范围。

## 回归门槛

- `npm.cmd run package:win:local-release` 必须生成 Portable 和 Setup。
- 本地验收包必须继续通过签名目录、更新清单和 HTTPS 客户端读取测试。
- 正式配置版仍不得携带本地证书信任或本地 channel。
