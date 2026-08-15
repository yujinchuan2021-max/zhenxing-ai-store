# Comet 公开下载入口没有返回 Windows 安装包

日期：2026-08-04  
影响：若把当前 REST 地址直接当作受管下载源，客户端可能下载 HTML 页面并误报“下载失败”或进入无意义重试。

## 现象与证据

目录原先把以下地址当作 Comet Windows x64 稳定二进制入口：

`https://www.perplexity.ai/rest/browser/download?platform=win_x64&channel=stable`

在当前系统网络下执行只读 HEAD/重定向检查时，一方服务器返回 `307`，最终地址为 `https://www.example.com/?status=ok`，内容类型为 `text/html`，不是 PE 安装包。Perplexity 官方帮助页只保证用户从官方页面点击下载，没有公开无需账号或组织令牌的稳定二进制合同。

## 根因

旧目录只验证了起始域名和一个历史 R2 主机，没有把“本次真实响应必须是安装包”纳入产品准入证据；更严重的是，旧审核记录在缺少完整生命周期时仍可能让产品看起来已经具备一键安装资格。

## 修复

- Comet 不进入客户端执行白名单，删除过期的独立批准记录。
- 目录发布后保持 `desktop-official`，只打开 Perplexity 官方平台页。
- 所有受管桌面产品现在必须同时具备适配器、生命周期、下载文件身份和匹配当前合同哈希的独立批准。
- 新增全桌面判定表；普通桌面产品没有客户端执行合同时一律保持官方入口。

## 自动验证

- `tests/windows-desktop-catalog.test.cjs` 固定 Comet 没有准入 dossier。
- `tests/windows-desktop-review-decisions.test.cjs` 固定其阻断码为 `official-endpoint-not-binary`。
- 目录发布脚本只把完整 dossier 对应产品升级为 `desktop-reviewed`。

## 剩余人工验收

若 Perplexity 以后公开新的稳定个人版 Windows 安装入口，需要重新抓取真实包，核验完整 SHA、有效签名、PE/VersionInfo、安装收据、打开、更新、卸载和浏览器资料保留后，才能重新申请准入。

## 防复发门禁

任何返回 HTML、登录页、一次性令牌页、示例域名或未批准最终主机的地址都不是安装包来源；HTTP 成功或起始 URL 属于官网不能替代真实二进制身份检查。
