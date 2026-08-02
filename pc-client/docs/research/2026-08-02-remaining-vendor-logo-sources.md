# 枕星 AI：剩余四家厂商 Logo 官方来源核验

- 核验日期：2026-08-02
- 范围：Midjourney、Pika、Genspark、Skylum
- 状态：研究完成；未修改 Logo 资产、后台目录或客户端数据
- 证据标准：只接受厂商官方站点、官方品牌/媒体页、由官方站点反向证明身份的 GitHub 组织，或已验证官方域名的 GitHub 组织

> 本文是目录资产接入判断，不构成法律意见。公开可访问的图片不等于获得再分发许可；除非官方条款明确允许当前使用场景，否则继续使用字母兜底。

## 结论

| 厂商 | 已找到的官方候选资源 | 技术格式 | 当前是否接入 | 结论 |
| --- | --- | --- | --- | --- |
| Midjourney | 已验证官方 GitHub 组织头像；官方商标政策中的示例图 | PNG；JPEG | 暂不接入 | 商标政策允许真实、准确的指称性使用，但要求原样使用并附非关联声明；当前卡片没有对应声明承载位置，继续字母兜底。加入声明后可重新评审官方 GitHub PNG。 |
| Pika | 官网 favicon、页脚图标、由官网反向证明的 GitHub 组织头像 | ICO；WebP；PNG | 不接入 | 官方条款明确要求使用 PIKA、Pika Logo 或相关品牌前取得书面许可，继续字母兜底。 |
| Genspark | 官方品牌页的 Square icon | SVG | 暂不接入 | 资源本身技术安全且官方提供下载，但品牌页明确面向 partners/collaborators，通用条款又禁止未经书面同意复制或分发 Genspark Content；未确认合作/授权前继续字母兜底。 |
| Skylum | 官方 Newsroom 的完整媒体包、官网 favicon | ZIP（内含多类媒体资产）；PNG | 暂不接入 | 媒体包是官方公开下载，但官方条款未授予任意目录产品再分发许可；联盟/经销商 Logo 规则适用于已签约或预先批准的材料，继续字母兜底。 |

因此，这次核验**不应直接把四家中的任何一家写入生产 Logo 资产目录**。它排除了“找不到官方资源”这一单一原因，同时确认了真正的阻碍是商标许可或声明呈现条件。

## 1. Midjourney

### 官方身份与资源

- [Midjourney GitHub 组织](https://github.com/midjourney) 显示 GitHub `Verified`，并明确说明该组织控制 `midjourney.com`，因此它满足“官方 GitHub 组织身份可证”的要求。
- 可下载候选：[官方 GitHub 组织头像（PNG）](https://avatars.githubusercontent.com/u/61396273?s=200&v=4)。2026-08-02 实测响应为 `image/png`，8,239 字节。
- 官方商标政策还嵌入两张示例 JPEG：
  - [Midjourney_TrademarkPolicy1.jpg](https://docs.midjourney.com/hc/article_attachments/32084281099149)，`image/jpeg`，16,823 字节。
  - [Midjourney_TrademarkPolicy2.jpg](https://docs.midjourney.com/hc/article_attachments/32084251703949)，`image/jpeg`，45,452 字节。
- 两张 JPEG 是政策示例图，而不是面向产品目录发布的独立方形 Logo 包；截取或重绘会违反“不修改、扭曲或组合商标”的规则，不作为生产候选。

### 使用限制

[Midjourney Trademark Policy](https://docs.midjourney.com/hc/en-us/articles/32084281102349-Midjourney-Trademark-Policy) 允许用商标真实、准确地指称 Midjourney 产品，但要求：

- 使用政策列出的正确形式；
- 不得修改、扭曲、缩写或与其他符号组合；
- 不得暗示赞助、认可或关联；
- 使用时附上类似“Midjourney 是 Midjourney, Inc. 的商标；本产品未获其认可且与其无关联”的声明；
- 不得让 Midjourney 商标比自己的产品/公司名称更显著。

### 接入判断

**继续字母兜底。** 官方 GitHub PNG 的身份和格式都成立，但当前厂商卡片没有稳定展示商标归属和“未关联/未背书”声明的位置。等客户端与网站统一提供厂商商标声明入口后，再评审原样托管该 PNG；不得从政策 JPEG 裁图。

## 2. Pika

### 官方身份与资源

- [Pika 官网](https://pika.art/) 当前公开以下图像：
  - [favicon（ICO）](https://pika.art/favicon.ico?favicon.3e7abfbd.ico)，实测响应为 `image/x-icon`。
  - [页脚 Pika 图标（WebP）](https://pika.art/images/landing/footer-pika-icon.webp)，实测响应为 `image/webp`，25,734 字节。
- [Pika 官方实验页](https://experiment.pika.art/ai-self) 明确指向 `Pika-Labs/Pika-Skills`；这从一方域名反向证明了 [Pika-Labs GitHub 组织](https://github.com/Pika-Labs) 的官方身份。
- 可下载候选：[Pika-Labs 官方 GitHub 组织头像（PNG）](https://avatars.githubusercontent.com/u/272671295?s=200&v=4)，实测响应为 `image/png`，5,808 字节。

### 使用限制

[Pika Terms of Service](https://pika.art/terms-of-service) 明确说明 `PIKA`、Pika Logo 及相关品牌属于 Mellis, Inc.、其关联公司或许可方，并规定未经权利人事先书面许可不得使用这些标志。条款也禁止复制、下载（临时显示缓存除外）、分发或发布服务内容。

### 接入判断

**继续字母兜底。** favicon、WebP 和官方 GitHub 头像只能证明图像来自官方渠道，不能替代书面商标许可。只有取得 Pika 的书面许可并记录授权范围后，才可把其中一个原始文件纳入后台资产；不得把 favicon 放大、重绘或改色。

## 3. Genspark

### 官方资源

- [Genspark Brand Guidelines](https://www.genspark.ai/brand/genspark) 提供完整 Logo 系统，并明确把 Square icon 定义为 app icon、favicon 以及不需要完整 wordmark 的场景。
- 最适合厂商卡片的可下载候选：[Genspark Square icon（SVG）](https://cdn1.genspark.ai/user-upload-image/admin/brand/genspark/logos/icon-square.svg)。2026-08-02 实测响应为 `image/svg+xml`，2,258 字节。
- 技术检查结果：该 SVG 未包含 `script`、`foreignObject`、`iframe`、`object`、`embed`、事件处理属性或外部引用，满足当前安全 SVG 校验思路。
- 品牌页也提供标准 Logo、深浅色版本、Figma 源文件和 Adobe Illustrator `.ai` 文件；其中装饰性 star 明确不得单独作为品牌 Logo。

### 使用限制

- 品牌页写明指南面向“partners and collaborators representing the Genspark brand”，并要求使用官方文件、不得重建、改色、扭曲或增加效果。
- [Genspark Terms of Service](https://www.genspark.ai/terms) 第 51–57 行对应的 Intellectual Property Rights 规则规定，未经事先书面同意，不得复制、存储、发布、修改、传输、制作衍生品、分发或以其他方式使用 Genspark Content；面向服务使用者的许可仅限于使用服务所必需的范围。

### 接入判断

**继续字母兜底。** 这是四家中技术上最完善的官方图标源，但公开品牌指南没有确认任何访客都获得再分发许可，且其适用对象限定为合作方。取得 Genspark 书面确认或证明枕星 AI 属于该指南覆盖的 collaborator 后，可直接原样接入 Square icon SVG；不需要重新抓 favicon，也不得使用 decorative star。

## 4. Skylum

### 官方资源

- [Skylum Newsroom](https://skylum.com/newsroom) 公开“Download the Full Media Kit materials”。官方短链 `https://l.skylum.com/luminar_neo_media_kit` 当前跳转到以下 Dropbox 目录：
  - [Luminar Neo evergreen media kit](https://www.dropbox.com/scl/fo/47eh7n5m7rtk7b6g8rmjr/h?rlkey=nosymzhscf8xz2b1r22bjw8i2&dl=0)
  - [ZIP 下载入口](https://www.dropbox.com/scl/fo/47eh7n5m7rtk7b6g8rmjr/h?rlkey=nosymzhscf8xz2b1r22bjw8i2&dl=1)，实测为 `application/zip`，文件名 `Luminar Neo evergreen media kit.zip`，约 500 MiB。
- 官网 HTML 还声明了 [Skylum favicon（PNG）](https://media.macphun.com/img/uploads/uploads/skylum/fav/skylum-dots.png)，实测响应为 `image/png`，997 字节。
- 本轮没有找到由 `skylum.com` 反向链接或由 GitHub 验证官方域名的 Skylum GitHub 组织，因此不采用任何名称相似的 GitHub 头像。

### 使用限制

- [Skylum Terms of Use](https://skylum.com/terms-of-use) 把网站和产品中的 graphics、logos、names、designs 等列为其商标/商业外观，并规定除条款允许外不得使用这些 Marks。
- [Skylum Affiliate Brand Guidelines](https://skylum.com/affiliates/terms) 要求只使用官方、高分辨率、最新 Logo，不得改色、改比例或拥挤摆放，并要求保持清晰背景和适当署名；但这些规则属于联盟协议，并不自动授权未加入联盟的第三方。
- [Skylum Reseller Program Terms](https://skylum.com/hant/skylum-reseller-program-terms-and-conditions) 更明确地把 Logo 使用限定于经销协议授权目的和预先批准材料。
- [Skylum Contact](https://skylum.com/contact-us) 提供 Brand & PR 合作入口，适合申请目录展示许可。

### 接入判断

**继续字母兜底。** Newsroom 的公开媒体包证明存在官方高分辨率资产，但没有证明枕星 AI 可以把其中 Logo 复制到客户端和网站分发。应先通过 Brand & PR 取得许可，确认允许“第三方中立产品目录、桌面客户端和网站缓存托管”三个场景，再从媒体包中选择官方 Skylum 企业 Logo；不要把 Luminar Neo 产品 Logo 当作 Skylum 厂商 Logo，也不要使用低分辨率 favicon 代替正式品牌资产。

## 后续操作清单

1. 保持四家当前字母兜底，不改生产目录。
2. 在后台厂商资料中增加可选的 `trademarkNotice` 与 `affiliationDisclaimer` 展示能力后，重新评审 Midjourney。
3. 分别向 Pika、Genspark、Skylum 申请书面许可；申请内容要覆盖网站、Windows 客户端、同源缓存托管、缩放显示和目录更新。
4. 授权文件必须与 `sourceUrl`、授权日期、允许范围一起留档；只有获准后才导入原始文件并计算内容哈希。
5. 不得把“官方页面可以打开”“浏览器可以缓存”或“官方 GitHub 头像可下载”误写成“允许再分发”。
