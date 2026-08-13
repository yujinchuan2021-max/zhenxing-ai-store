# Windows 桌面产品认证

更新时间：2026-08-04

## 当前范围

目录共有 266 个 Windows 桌面相关记录：

- 169 个 `desktop-reviewed` 产品由客户端本地白名单管理。
- Ollama 由 `local-model` 受管模块管理。
- 96 个 `desktop-official` 产品仍只打开厂商官方页面，不获得本地执行权限。

当前 132 个桌面产品使用客户端固定的 Windows Package Manager 配置，其中 6 个使用固定 Microsoft Store Product ID；另有 37 个非包管理器图形安装合同和 Ollama 本地模型合同。客户端当前合计管理 170 个 Windows 产品。

## 三种状态

| 状态 | 含义 | 本地安装能力 |
|---|---|---|
| 普通桌面 / 官方入口 | 后台可维护展示内容和厂商页面，但客户端没有本地执行合同 | 禁止 |
| 已审核 | 下载、适配器、生命周期和独立审批哈希全部匹配 | 允许 |
| 已实机验收 | 同一执行合同已在真实 Windows 日常账户完成完整生命周期验收 | 允许 |

自动测试、静态验签和打包客户端都不能替代真实安装、首次启动、更新、交互式卸载与数据保留验收。

## 完整执行合同

桌面产品只有同时满足以下条件，目录发布脚本才会把它升级为 `desktop-reviewed`：

1. 官方 HTTPS 起始地址与允许的最终主机。
2. 固定版本包的 SHA-256，或滚动包的稳定签名者和文件身份。
3. Authenticode 发布者、PE Machine 与 Windows VersionInfo；确实没有可用 VersionInfo 的固定包必须显式记录原因并固定 SHA。
4. 安装检测必须来自可信 Windows 安装收据，不以下载文件存在或进程短暂启动代替。
5. 打开、关闭和卸载适配器只能使用客户端本地固定规则。
6. 厂商更新归属、最新版本来源和用户数据保留边界。
7. 独立审核记录必须绑定整个执行合同哈希；任一字段变化都会让旧批准自动失效。

## 普通桌面产品判定

`shared/windows-desktop-review-decisions.cjs` 为全部桌面记录返回明确判定。没有客户端执行合同的产品统一使用 `client-execution-contract-not-reviewed`，已知特殊阻断另有专用原因码，例如：

- Comet：公开入口不是二进制。
- Cherry Studio、DeepChat：当前审核包未签名。
- Obsidian：尚未捕获可信安装收据。
- Grammarly：仍需隔离生命周期验收。
- Notion：legacy NSIS 到 MSIX 的迁移尚未验收。
- DeepL：Zero Install 生命周期尚未验收。
- Windsurf：厂商产品身份迁移尚未收口。

普通桌面产品仍遵循产品规则：用户点击后打开厂商官方下载页面。后台不能仅靠改字段把它变成一键安装产品。

## 后台边界

后台可以维护厂商和产品的名称、描述、排序、启停、官网、教程和已存在模块的显示能力。后台不能下发任意 EXE、Shell、PowerShell、CMD、安装参数或新的本地探测规则，也不能创建新的执行白名单。

产品认证页只记录审核与实机验收状态；真正的下载来源、签名者、安装检测、打开和卸载规则仍由客户端本地代码决定。

## 当前基线

- 受管 Windows 安装产品：170。
- `desktop-reviewed`：169。
- `desktop-official`：96。
- 已记录真实整套产品生命周期验收：0；旧版客户端自身安装/卸载验收不等于第三方产品验收。
- 本轮新增静态合同：QoderWork CN、ima、LM Studio、GPT4All、AnythingLLM Desktop、Kiro IDE、NVIDIA AI Workbench、OpenCode Desktop、Msty Go、Letta。
- Comet 阻断证据：`docs/research/2026-08-04-existing-desktop-identities-batch-c.md`。
- `0.1.36` 打包 Portable 已完整下载并验证 QoderWork（中文目录样本）与 OpenCode（英文目录样本）；两者均通过固定 SHA-256、有效 Authenticode、PE 和 VersionInfo 身份校验，未执行安装器。

## 发布门禁

1. 运行桌面目录、身份、dossier、卸载和产品模块测试。
2. 运行 `npm run catalog:apply:windows-desktops`；它在临时副本依次应用桌面基线、直装合同和包管理器合同，完整校验后一次提交，确认所有无 dossier 产品仍是 `desktop-official`。
3. 运行完整 `npm.cmd run test:release` 与 `npm.cmd run build`。
4. 封装 Setup 和 Portable，并验证制品清单、版本、哈希、签名目录与至少一个中文签名包和一个英文签名包的完整下载身份。
5. 把真实第三方安装器交互和安装后行为留给明确的用户验收，不把自动化结果写成已实机通过。
