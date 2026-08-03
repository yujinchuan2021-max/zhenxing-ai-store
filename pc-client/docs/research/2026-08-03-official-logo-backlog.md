# 枕星 AI：204 个厂商文字 Logo 兜底的官方素材审计

- 审计日期：2026-08-03
- 目录快照：353 个厂商；149 个受管 Logo；204 个审核文字兜底
- 范围：`admin/data/catalog-v1.json`、`vendor-icon-fallbacks.json`、`vendor-icon-sources.json`、Logo 导入器、资产存储与发布测试
- 本轮边界：只审计并记录来源；未修改生产目录、Logo 资产、导入器或测试

## 结论

1. **不能把 204 个兜底全部交给爬虫自动替换。** HTML 的 `rel=icon` 代表当前页面的图标，[Web App Manifest 的 `icons`](https://www.w3.org/TR/appmanifest/#icons-member)通常代表 Web 应用图标；二者都不能单独证明图片是厂商企业 Logo，也不能证明第三方目录获得了再分发许可。[HTML Standard 的 `icon` 定义](https://html.spec.whatwg.org/multipage/links.html#rel-icon)只适合作为候选发现依据。
2. 一次完整质量探测中，204 家分为：118 家有矢量或至少 96×96、近似方形的官网声明候选；32 家只有低分辨率候选；6 家只会抓到 GitHub 托管平台通用图标；其余 48 家因无元数据、响应失败、反爬或格式不合规而没有候选。
3. **纯自动、无需复核即可直接提升为生产 Logo 的数量仍是 0。** 204 家都已经进入人工审核兜底清单；自动发现只能生成候选，不能越过既有审核决定。
4. 本轮结合官方组织身份、官网反向关系、资源格式和现有安全解析器进一步人工复核后，得到 **55 家可立即接入的精确来源**。这些来源不使用搜索图片、个人头像、GitHub 通用 favicon 或推测路径。
5. 55 家接入成功后，文字兜底将从 204 降到 149；其中至少 19 家仍有明确许可、商标声明或品牌使用条件，必须继续使用文字兜底。其余 130 家继续进入来源、视觉和许可复核队列。

## 现有实现为何不会自动补齐

`scripts/import-official-vendor-icons.mjs` 当前有三道显式门禁：

- `reviewedTextFallbacks()` 把 `vendor-icon-fallbacks.json` 的全部 204 个 vendorId 视为已审核决定；主队列明确排除这些 ID。
- `discover()` 只有命中 `reviewedIconSources` 或 `officialGitHubOrganizations` 才能落库；没有审核 GitHub 组织的厂商会直接返回 `no reviewed official icon source`。
- 资产必须小于 384 KB，且只能是 PNG、JPEG、WebP、ICO 或无脚本、无外链的安全 SVG；来源必须是 HTTPS，内容按 SHA-256 寻址，一个资产不能被无关厂商共享。

因此，重复运行现有导入器不会改变 204 个兜底；这是安全门禁，不是抓取故障。

## 官网元数据探测结果

探测只读取官网 HTML 明确声明的 `icon`、`apple-touch-icon`、`og:logo`、`msapplication-TileImage` 和显式 Web Manifest，不尝试 `/favicon.ico` 等猜测路径。矢量图或短边至少 96 像素、宽高比在 0.75–1.333 之间，才计入质量候选。

| 结果 | 数量 | 精确 vendorId |
| --- | ---: | --- |
| 质量候选 | 118 | `acd-systems`, `activepieces`, `affine`, `aftershoot`, `agent0ai`, `agno`, `alteryx`, `anthropics`, `anydesk`, `audacity`, `augment`, `automattic`, `bardeen`, `box`, `braintrust`, `browserstack`, `camel-ai`, `canarymail`, `cesium`, `circleci`, `clarivate`, `clickhouse`, `clickup`, `cloudinary`, `coda`, `coderabbit`, `cognition`, `confluent`, `continue`, `dassault-systemes`, `databricks`, `daytona`, `dbeaver`, `dialpad`, `e2b`, `elastic`, `elsevier`, `esri`, `excire`, `factory-ai`, `genesys`, `gitbutler`, `gitkraken`, `gong`, `graphisoft`, `greptile`, `harvey`, `helicone`, `infiniflow`, `izotope`, `kilo`, `lens`, `letta`, `lindy`, `llamaindex`, `lovable`, `lumivero`, `mastra`, `mathworks`, `maxqda`, `meetgeek`, `miro`, `monday`, `motion`, `movavi`, `mylio`, `nanoco`, `navicat`, `near-ai`, `neo4j`, `nero`, `obsidian`, `octave`, `onlyoffice`, `open-interpreter`, `openhands`, `opusclip`, `pandadoc`, `praisonai`, `pydantic`, `qlik`, `qodo`, `reclaim`, `recraft`, `relevance-ai`, `replit`, `riverside`, `roblox`, `sap`, `screenpipe`, `semrush`, `servicenow`, `shopify`, `siemens`, `significant-gravitas`, `simular-ai`, `skyvern`, `snowflake`, `spark-mail`, `spellbook`, `stackblitz`, `steinberg`, `streamlabs`, `supernormal`, `superwhisper`, `synthesia`, `tabnine`, `tailscale`, `taskade`, `teamviewer`, `techsmith`, `termius`, `thoughtspot`, `vlex`, `wix`, `wolfram-research`, `zendesk`, `zeroclaw-labs` |
| 只有低分辨率候选 | 32 | `airtable`, `ansys`, `assemblyai`, `bytebot`, `corel`, `dataiku`, `deepgram`, `evoto`, `foundation-agents`, `grafana`, `gumloop`, `hitpaw`, `intercom`, `kortix`, `langbot`, `langflow`, `lexisnexis`, `paypal`, `pdfgear`, `pinecone`, `pipedream`, `playcanvas`, `promptfoo`, `pulumi`, `qupath`, `rightnow-ai`, `salesforce`, `spline`, `synopsys`, `thomson-reuters`, `voltagent`, `zoom` |
| GitHub 通用图标，禁止使用 | 6 | `01ai`, `agenticseek`, `docling-project`, `hkuds`, `lostruins`, `ruvnet` |
| 声明素材无效或不符合上限 | 3 | `astrbot`, `udio`, `wrike` |
| 页面没有声明图标元数据 | 12 | `agentops`, `aider`, `boris-fx`, `browser-use`, `cisco`, `flowise`, `ilastik`, `knime`, `orange-data-mining`, `rowboat`, `swe-agent`, `tldv` |
| 官网 HTTP 拒绝或错误 | 13 | `appflowy`, `fellow`, `freshworks`, `genspark`, `hashicorp`, `ibm`, `make`, `midjourney`, `oracle`, `relativity`, `scispace`, `skylum`, `vrew` |
| 网络连接失败 | 3 | `amp`, `livekit`, `plandex` |
| 8 秒内超时 | 17 | `brave`, `duckduckgo`, `finevoice`, `flowith`, `gamma`, `gitlab`, `heygen`, `ideogram`, `luma`, `mod-io`, `pika`, `scite`, `tripo`, `updf`, `vectorworks`, `vimeo`, `voiceai` |

同一网络环境连续两次元数据探测的有效候选数相差 2 家，说明反爬和临时网络状态会影响结果。生产候选生成应至少重试两次，并把网络失败与“没有官方素材”分开记录。

## 55 家可立即接入的精确来源

### A. 官方 GitHub 组织头像（24 家）

下表组织均由 GitHub Organizations API 返回 `Organization` 身份；官网或当前官方产品链接能反向关联该组织。素材 URL 使用稳定数字组织 ID，不使用仓库页 favicon。GitHub API 的组织资源定义见[官方文档](https://docs.github.com/en/rest/orgs/orgs#get-an-organization)。

| vendorId | sourceUrl | assetUrl |
| --- | --- | --- |
| `ansys` | https://github.com/ansys | https://avatars.githubusercontent.com/u/66023092?s=256&v=4 |
| `cesium` | https://github.com/CesiumGS | https://avatars.githubusercontent.com/u/54716382?s=256&v=4 |
| `openhands` | https://github.com/OpenHands | https://avatars.githubusercontent.com/u/225919603?s=256&v=4 |
| `significant-gravitas` | https://github.com/Significant-Gravitas | https://avatars.githubusercontent.com/u/130738209?s=256&v=4 |
| `agent0ai` | https://github.com/agent0ai | https://avatars.githubusercontent.com/u/216033749?s=256&v=4 |
| `browser-use` | https://github.com/browser-use | https://avatars.githubusercontent.com/u/192012301?s=256&v=4 |
| `skyvern` | https://github.com/Skyvern-AI | https://avatars.githubusercontent.com/u/141457985?s=256&v=4 |
| `foundation-agents` | https://github.com/FoundationAgents | https://avatars.githubusercontent.com/u/198047230?s=256&v=4 |
| `rightnow-ai` | https://github.com/RightNow-AI | https://avatars.githubusercontent.com/u/226207176?s=256&v=4 |
| `near-ai` | https://github.com/nearai | https://avatars.githubusercontent.com/u/29134221?s=256&v=4 |
| `hkuds` | https://github.com/HKUDS | https://avatars.githubusercontent.com/u/118165258?s=256&v=4 |
| `nanoco` | https://github.com/nanocoai | https://avatars.githubusercontent.com/u/255066954?s=256&v=4 |
| `astrbot` | https://github.com/AstrBotDevs | https://avatars.githubusercontent.com/u/197911947?s=256&v=4 |
| `kortix` | https://github.com/kortix-ai | https://avatars.githubusercontent.com/u/170767358?s=256&v=4 |
| `swe-agent` | https://github.com/SWE-agent | https://avatars.githubusercontent.com/u/166046056?s=256&v=4 |
| `letta` | https://github.com/letta-ai | https://avatars.githubusercontent.com/u/177780362?s=256&v=4 |
| `rowboat` | https://github.com/rowboatlabs | https://avatars.githubusercontent.com/u/172591271?s=256&v=4 |
| `plandex` | https://github.com/plandex-ai | https://avatars.githubusercontent.com/u/148917357?s=256&v=4 |
| `simular-ai` | https://github.com/simular-ai | https://avatars.githubusercontent.com/u/99358647?s=256&v=4 |
| `bytebot` | https://github.com/bytebot-ai | https://avatars.githubusercontent.com/u/154629106?s=256&v=4 |
| `voltagent` | https://github.com/VoltAgent | https://avatars.githubusercontent.com/u/201282378?s=256&v=4 |
| `qupath` | https://github.com/qupath | https://avatars.githubusercontent.com/u/21292410?s=256&v=4 |
| `screenpipe` | https://github.com/screenpipe | https://avatars.githubusercontent.com/u/259178917?s=256&v=4 |
| `docling-project` | https://github.com/docling-project | https://avatars.githubusercontent.com/u/188446108?s=256&v=4 |

`ansys` 和 `hkuds` 的头像响应是 JPEG，其余抽查响应为 PNG；现有导入器按文件魔数识别格式，不应按 URL 扩展名猜 MIME。

### B. 官网明确声明的方形品牌/应用图标（31 家）

这些素材由对应官网 HTML 或显式 Manifest 声明，已验证 HTTPS、大小不超过 384 KB，并通过当前 PNG/JPEG/WebP/ICO/安全 SVG 解析规则。`sourceUrl` 是声明素材的官方页面，`assetUrl` 是原始资源。

| vendorId | sourceUrl | assetUrl |
| --- | --- | --- |
| `activepieces` | https://www.activepieces.com/ | https://www.activepieces.com/logo.svg |
| `affine` | https://affine.pro/ | https://affine.pro/favicon-96.png |
| `aftershoot` | https://aftershoot.com/ | https://aftershoot.com/wp-content/uploads/2025/08/aftershoot-logo-favicon.webp |
| `agno` | https://www.agno.com/ | https://cdn.prod.website-files.com/6796d350b8c706e4533e7e32/68a85d04c4b355c4accb0f9f_256.png |
| `anydesk` | https://anydesk.com.cn/zhs | https://anydesk.com.cn/_static/img/favicon/apple-touch-icon.png |
| `audacity` | https://www.audacityteam.org/ | https://www.audacityteam.org/apple-touch-icon.png |
| `augment` | https://www.augmentcode.com/ | https://www.augmentcode.com/favicon.svg |
| `bardeen` | https://www.bardeen.ai/ | https://cdn.prod.website-files.com/67a4e756231fbcd6386ec06a/68ef8291b04588fc181bb136_Bardeen-Webclip.svg |
| `braintrust` | https://www.braintrust.dev/ | https://www.braintrust.dev/icon180.png?v=2 |
| `canarymail` | https://canarymail.io/ | https://cdn.prod.website-files.com/6774d6b0372116ea34d8e8a9/67a5f7ed1a0bdbaa336ce531_Logo%20for%20App%20icon%20CR%20256.png |
| `cloudinary` | https://cloudinary.com/ | https://cloudinary-res.cloudinary.com/image/upload/f_auto,q_auto/c_scale,w_196/v1597183771/website/cloudinary_web_favicon.png |
| `coderabbit` | https://www.coderabbit.ai/ | https://www.coderabbit.ai/android-chrome-512x512.png?v=4 |
| `cognition` | https://devin.ai/ | https://devin.ai/favicon.svg |
| `continue` | https://continue.dev/ | https://continue.dev/icon-192.png |
| `daytona` | https://www.daytona.io/ | https://framerusercontent.com/images/6WPclDLAHHQgPFeA2DRTW1OXVSU.png |
| `e2b` | https://e2b.dev/ | https://cdn.prod.website-files.com/6717bb6618f6a40d53ac2929/6a2a7d84c914ca7bc2dd1aab_Favicon_512x512.png |
| `factory-ai` | https://factory.ai/ | https://factory.ai/favicon.svg |
| `gitbutler` | https://gitbutler.com/ | https://gitbutler.com/favicon/favicon.svg |
| `greptile` | https://www.greptile.com/ | https://www.greptile.com/greptile-brand-mark.png |
| `helicone` | https://www.helicone.ai/ | https://www.helicone.ai/static/logo.webp |
| `kilo` | https://kilo.ai/ | https://kilo.ai/favicon/favicon.svg?v=2 |
| `mastra` | https://mastra.ai/ | https://mastra.ai/favicon/new-brand/icon.svg |
| `onlyoffice` | https://www.onlyoffice.com/ | https://static-site.onlyoffice.com/public/images/favicons/favicon325.png |
| `opusclip` | https://www.opus.pro/ | https://cdn.prod.website-files.com/6388604483b03a9ecb34d695/6435197bfb1d6e486e04c37b_webclip.png |
| `pandadoc` | https://www.pandadoc.com/ | https://www.pandadoc.com/favicon.ico?favicon.0hplvhjssgw-1.ico |
| `qodo` | https://www.qodo.ai/ | https://www.qodo.ai/wp-content/uploads/2025/03/qodo-fav-300x300.png |
| `spark-mail` | https://sparkmailapp.com/ | https://cdn-rdstaticassets.readdle.com/assets/spark/spark3/common/favicon-icons/spark-icon-180x180.png?1770301849 |
| `tailscale` | https://tailscale.com/ | https://tailscale.com/favicon.svg |
| `taskade` | https://www.taskade.com/ | https://www.taskade.com/favicon.svg |
| `zendesk` | https://www.zendesk.com/ | https://d1eipm3vz40hy0.cloudfront.net/images/logos/favicons/zendesk-icon.svg |
| `zeroclaw-labs` | https://www.zeroclawlabs.ai/ | https://www.zeroclawlabs.ai/images/zeroclawlabs.png |

两个需要固定的 MIME 细节：ONLYOFFICE 的 `.png` URL 当前实际返回 WebP；PandaDoc 的 `.ico` URL 当前实际返回 PNG。必须继续使用魔数识别，不能按后缀写死类型。Audacity 的 SVG 含当前安全规则拒绝的引用，因此清单改用同一官网声明的 PNG。

## 19 家明确许可、商标或展示条件阻断

这些厂商即使官网有图标，也不能被元数据爬虫自动提升：

| vendorId | 阻断 | 一方证据 |
| --- | --- | --- |
| `acd-systems` | 法律说明要求明确许可，当前方形站点图标也不够可辨识 | https://www.acdsee.com/en/legal-notices/ |
| `midjourney` | 使用时要求商标归属和非关联声明；当前卡片没有稳定声明入口 | https://docs.midjourney.com/hc/en-us/articles/32084281102349-Midjourney-Trademark-Policy |
| `pika` | 条款要求事先书面许可 | https://pika.art/terms-of-service |
| `genspark` | 品牌资产面向合作方，目录再分发授权未确认 | https://www.genspark.ai/brand/genspark |
| `skylum` | 公开媒体包未明确授予第三方目录再分发权 | https://skylum.com/terms-of-use |
| `grafana` | 商业目录展示和归属声明存在商标条件 | https://grafana.com/trademark-policy/ |
| `elastic` | 商标政策未向普通第三方目录开放图形 Logo 使用 | https://www.elastic.co/legal/trademarks |
| `roblox` | 官方指南限制 Logo 离站使用 | https://en.help.roblox.com/hc/en-us/articles/115001708126-Roblox-Name-and-Logo-Community-Usage-Guidelines |
| `miro` | 尚未找到允许当前目录场景使用的品牌包或明确授权 | https://miro.com/ |
| `mathworks` | 品牌指南要求申请 Logo 文件 | https://www.mathworks.com/brand.html |
| `neo4j` | 公司 Logo 和专有图形要求明确书面许可 | https://legal.neo4j.com/ |
| `automattic` | 官方素材限定 Automattic、授权合作方及编辑用途 | https://automattic.com/press/brand-materials/ |
| `intercom` | 商标政策要求书面许可或特定许可计划 | https://www.intercom.com/legal/trademark-usage |
| `luma` | 条款限制未经许可使用品牌标识 | https://lumalabs.ai/legal/terms-of-service |
| `ibm` | 官方法律页要求其他公司取得明确许可 | https://www.ibm.com/legal/copyright-trademark |
| `deepgram` | 条款限制未经许可使用商标 | https://deepgram.com/terms |
| `oracle` | Logo 指南要求书面授权 | https://www.oracle.com/legal/logos/ |
| `01ai` | 品牌条款要求事先书面许可 | https://platform.01.ai/useragreement |
| `obsidian` | 官方品牌页要求商业场景先联系授权 | https://obsidian.md/brand |

其中 Midjourney 属于“产品补齐统一商标声明入口后可重审”，并非永久禁止；其官方政策明确要求使用正确形式、真实指称以及未关联声明。

## 其他明确不能自动处理的情形

- `lostruins`、`agenticseek`、`ruvnet` 的官方入口是个人或仓库页面；个人头像不能冒充项目品牌。
- `01ai`、`docling-project`、`hkuds` 等 GitHub 页面会声明 GitHub 自身 favicon；只有经核验的组织头像才能替代，不能保存通用 Octocat。
- 只有横向字标、品牌包 ZIP、需裁切的图片或产品 Logo 与厂商 Logo 不一致时，不能由脚本重绘、裁切或猜测。
- 官网 403、429、503、超时或当前网络失败只表示“本次未取到”，不能写成“厂商没有 Logo”。
- 任何搜索引擎图片、第三方 Logo 聚合站、非官方 GitHub fork、个人头像或相似图形一律不进入候选。

## 最简单且安全的实施方案

1. 把上面 55 个精确来源加入现有 `reviewedIconSources` / `officialGitHubOrganizations`，不引入新依赖或新的 Logo 数据模型。
2. 调整导入事务：命中精确审核来源的 vendorId 即使仍在 fallback 清单中也可尝试导入；**只有下载、魔数、大小、安全 SVG、哈希和落盘全部成功后**，才从 fallback 清单移除该 ID。失败时保留原文字兜底。
3. 官网自动发现继续只生成报告，不直接写生产目录。候选报告记录 `vendorId`、最终官网 URL、声明类型、资源 URL、MIME、尺寸、字节数和失败原因。
4. 导入后生成一张本地联系表做人工视觉复核：厂商名、Logo、sourceUrl 并排展示；检查错品牌、产品图标冒充厂商、透明低对比、文字被裁切和过度留白。
5. 保留现有发布门禁：一个哈希只归属一个厂商、禁止非 GitHub 厂商使用 GitHub favicon、历史签名目录资产不可删除、无资产的厂商必须仍有审核 fallback。
6. 只发布后台目录与内容寻址图片，不重新封装客户端；Logo 属于后台内容更新。

## 验收标准

- 接入成功数与 fallback 减少数一致；任何失败厂商仍显示原文字兜底。
- `vendor-icon-sources.json` 中每个新资产有唯一 vendorId、HTTPS sourceUrl、正确 SHA-256 和真实 MIME。
- 运行 `node --test tests/vendor-logo.test.cjs tests/vendor-icon-asset.test.cjs tests/admin-vendor-icon-store.test.cjs`。
- 运行完整 `npm.cmd run test:release`、`npm.cmd run build` 和 `git diff --check -- pc-client`。
- 发布后从活动 `catalog-release.json` 重新统计厂商、图形 Logo 和文字兜底数量，并在客户端实际查看联系表中的全部 55 家。
