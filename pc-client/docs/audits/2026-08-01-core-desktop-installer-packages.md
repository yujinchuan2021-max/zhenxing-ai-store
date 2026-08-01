# 核心 Windows 桌面安装器实包审计

审计日期：2026-08-01（Asia/Shanghai）

范围：ChatGPT Desktop、Claude Desktop、Comfy Desktop、Ollama for Windows。实包只用于身份校验，没有在自动化中运行安装器，也没有把一次性 SHA-256 固化为滚动最新版的永久白名单。

| 产品 | 实包大小 | PE 架构 | VersionInfo | Authenticode | 本次 SHA-256 |
|---|---:|---|---|---|---|
| ChatGPT Desktop | 1,462,848 B | x86 引导器 | Store Installer / StoreInstaller.exe / Microsoft Corporation | Valid；Microsoft Corporation | `A76B6D5D19E758D1F414D5208F4F641C50087DF45A01D4B9B497DC0671DBD6E9` |
| Claude Desktop | 7,021,216 B | x64 | Claude / Claude Setup / ClaudeSetup.exe / Anthropic, PBC | Valid；Anthropic, PBC | `1D46CE8F6BC4D59FFA5B63B6F01BB88E386BB38559602E6249ECF4340A3DBCD5` |
| Comfy Desktop | 301,438,360 B | x86 NSIS 引导器 | Comfy Desktop / Comfy Org | Valid；Drip Artificial Inc | `149C76783DFE67FB0D91C09BA1CAF485223B691AE8649D17F70230D46161A7E4` |
| Ollama | 1,563,078,600 B | x86 Inno 引导器 | Ollama / Ollama Setup / Ollama | Valid；Ollama Inc. | `B7EEEF038DDCBD09AC665B11872BAFF1BC9B42794BE41B5EF187B2F4B16A4498` |

## 客户端门禁

每次用户显式安装时，客户端仍重新下载或读取自己的可信记录，并依次检查：

1. 产品必须存在于本地安装白名单。
2. 最终下载域名必须属于该产品允许域名。
3. 本地文件路径、大小和下载记录必须一致。
4. SHA-256 必须与下载完成记录一致。
5. Authenticode 必须有效，签发者必须匹配产品契约。
6. 上表四款产品还必须匹配本地固化的 PE 架构和 VersionInfo 产品身份。
7. 暂存副本必须保持相同 SHA-256 和有效签名，随后才允许打开。

动态最新版入口会更换文件哈希，所以表中的哈希只作为 2026-08-01 审计证据；运行时安全依据是本次下载记录、有效签名、产品身份和本地白名单的组合，不把旧哈希误当成未来版本。

## 自动与人工验收边界

自动化已覆盖下载源、契约哈希、PE 解析、VersionInfo 匹配、签发者、状态回收、更新所有权和重新安装意图。安装器实际修改 Windows、应用首次启动、厂商自动更新、交互式卸载以及数据保留结果仍必须在验收机上逐款点击确认。
