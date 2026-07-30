# Windows 文档目录中的 Electron 解包目录被锁定

日期：2026-07-31

## 用户可见现象

执行 `npm.cmd run package:win` 时，前端构建完成，但 Electron Builder 在将 `release\win-unpacked.tmp` 重命名为 `release\win-unpacked` 时返回 `EPERM`，最终没有完成安装包生成。

## 根因

Windows 上的实时扫描、索引或同步组件可能短暂占用“文档”目录里的大型 Electron 解包目录。Electron Builder 的目录重命名依赖该目录在瞬间没有任何句柄，因此在本机工作区内直接解包不稳定。

## 修复

正式配置版与本地验收版统一采用两段式打包：

1. 在系统临时目录中完成 Electron 解包、Portable 和 NSIS 构建。
2. 只将最终 EXE、blockmap 和 YML 产物复制到项目的 `release` 目录。
3. 构建结束后删除临时解包目录。

该修改不改变安装包内容、生产 channel 或签名策略。

## 回归门槛

- `npm.cmd run package:win` 必须生成 Portable 和 Setup。
- 正式配置版不得包含本地发布 channel 或本地 TLS 指纹。
- Setup 必须通过隔离安装、启动、托盘驻留、卸载和残留检查。
