# Comfy Desktop 错误跳转官网

## 用户反馈

用户完成环境检测后，ComfyUI Desktop 的主操作仍显示“前往官网下载”，没有由 AI Hub 直接下载安装包。

## 原因

目录校验器保留了“所有桌面端产品禁止配置托管安装包”的旧策略。即使产品页具有下载流程，Comfy 目录也无法配置安装包，因此界面只能回退到打开产品官网。

## 策略更新

- 不再一刀切禁止桌面端安装包。
- 只有经过客户端固定策略审核的桌面产品，才能启用直接下载。
- Comfy Desktop 固定使用官方入口 `https://download.comfy.org/windows/nsis/x64`。
- 下载重定向后的最终域名只允许 `download.comfy.org` 和 `dl.todesktop.com`。
- CMS 必须同时匹配客户端固定的产品 ID、入口 URL 和文件名；后台不能把它改成任意下载地址。
- 下载完成记录 SHA-256，并在用户点击安装前校验文件未变化及 Windows Authenticode 签名。
- 用户仍需主动点击“点击安装”，客户端不会静默运行安装程序。

## 当前验证

2026-07-29 实际下载官方 x64 NSIS 包：

- 文件大小：158,888,904 字节
- SHA-256：`41373C8430E9B3B8E8E1FDD66FEB7FC4299A03A6AC1BF9CDB654391AD932E443`
- Authenticode：`Valid`
- 签发者：`Drip Artificial Inc`

该 SHA-256 只记录本次最新包验证结果，不作为永久固定值；官方入口升级安装包后哈希会正常变化，客户端以下载记录和有效签名共同保护后续打开动作。
