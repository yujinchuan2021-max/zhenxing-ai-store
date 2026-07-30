# 托管安装包统一白名单策略

## 背景

Comfy Desktop 改为客户端直接下载后，客户端只对桌面端目录配置进行了固定策略校验；CLI 产品仍可从后台填写任意 HTTPS 安装包地址，下载 IPC 也会接受未登记的产品 ID。

## 新策略

- 所有由 AI Hub 直接下载的产品安装包都必须登记在客户端固定白名单中，不再按“桌面端/CLI”区别对待。
- 后台目录中的产品 ID、入口 URL 和文件名必须与客户端策略完全一致。
- 下载请求必须使用白名单产品 ID；未登记产品即使提供 HTTPS 地址也会被拒绝。
- HTTP 跳转完成后的最终域名必须属于该产品允许的域名集合。
- 下载完成后记录 SHA-256；打开安装包前再次计算哈希，并验证 Windows Authenticode 及预期签发者。

## 当前白名单

### ComfyUI Desktop

- 入口：`https://download.comfy.org/windows/nsis/x64`
- 允许域名：`download.comfy.org`、`dl.todesktop.com`
- 预期签发者：`Drip Artificial Inc`

### Ollama

- 入口：`https://ollama.com/download/OllamaSetup.exe`
- 允许域名：`ollama.com`、`github.com`、`release-assets.githubusercontent.com`
- 预期签发者：`Ollama Inc.`

## Ollama 实包验证

2026-07-29 实际下载官方 Windows 安装包：

- 文件大小：1,563,078,600 字节
- SHA-256：`B7EEEF038DDCBD09AC665B11872BAFF1BC9B42794BE41B5EF187B2F4B16A4498`
- Authenticode：`Valid`
- 签发者：`Ollama Inc.`

哈希用于记录本次验证证据，不永久锁定官方“latest”安装包。
