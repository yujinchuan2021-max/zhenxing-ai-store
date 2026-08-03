# 目录欠账与厂商 Logo 全量收口

- 日期：2026-08-03
- 影响：全部 AI 厂商、全部 AI 可接入厂商、精准搜索、资源商店和厂商卡片 Logo

## 触发

- 用户要求不再按小批次停下，而是把官方产品、Agent、桌面端、CLI、可接入产品和资源目录一次收口。
- 自动发现扫描了 353 个厂商的 957 个官方页面，但候选里混有产品功能、帮助页、套件、停服项目、Mac-only 项目和平台依赖，不能直接发布。
- 353 个厂商中仍有 204 个审核文字 Logo；旧导入器会把这 204 个 ID 全部跳过，即使后来补了精确官方来源也不会升级。

## 根因

1. “抓到链接”不等于“确认独立产品身份”。如果不做官方一手资料和语义去重，Factory Desktop、Airtable Windows、Lovable Download 等会重复建立 Web/桌面卡片。
2. 官网 favicon 或 Manifest 图标只能生成候选，不能证明企业品牌身份或第三方目录使用许可；GitHub 仓库页还会暴露 GitHub 自身图标。
3. 旧 Logo 队列把人工文字兜底视为永久阻断，没有为后续精确审核来源提供安全升级通道。
4. 图片通过下载、MIME 和哈希校验后仍可能有真实渲染问题：Mastra 的无命名空间 SVG 在 `<img>` 中无法显示，Zendesk 的 `currentColor` SVG 会在深色系统偏好下变成白色并消失在白底上。

## 修复

- 最终目录为 375 个厂商、615 个一级产品和 145 项生态资源。
- 新增 22 个厂商、56 个产品和 17 个资源；只修改 5 个既有产品身份：Factory、Airtable、Lovable 的 Web/Windows 同卡，Adobe Creative Cloud 补 Windows 官方下载入口，Coda AI 迁移为 Superhuman Docs AI 并保留旧名称搜索。
- Tabnine CLI、Deepgram CLI、PixVerse CLI、Anytype CLI 与可视化产品保持独立，并在描述中明确“命令行工具，不是桌面软件”。
- 17 项新增 MCP 均使用 `resource-link`；Anytype、Benchling 和 Zep Enterprise 的凭据、租户、权限和限制只记录说明，不下发命令或配置。
- Superhuman Go 的帮助中心已有 Windows 安装文档，但当前营销页仍写桌面端 coming soon，因此继续留在发布门禁，不伪装成已稳定发布的 Windows 产品。
- Logo 人工审核得到 55 个精确来源：24 个经官网反向确认的官方 GitHub Organization 头像、31 个官网明确声明的方形品牌/应用图标。全部导入成功，图形资产从 149 增至 204；新增厂商无许可素材时继续使用文字兜底，最终 171 个兜底。
- Logo 导入器现在允许“仍在 fallback 但已有精确审核来源”的厂商进入队列；只有资产下载、魔数、大小、安全 SVG、内容寻址和目录校验全部成功后才删除对应 fallback。失败仍显示文字兜底。
- 联系表脚本 `npm run audit:vendor-logos` 按 Git 基线生成变更 Logo 截图。首轮视觉检查发现 Mastra 与 Zendesk 两个真实渲染问题，改用同一官网声明的 512 PNG 和 152 PNG 后复检通过。

## 防复发规则

1. 自动发现只生成候选报告，不直接改正式目录；每个候选按 ID、名称、旧品牌、域名、URL 和官方产品职责做语义去重。
2. 同一产品的 Web 与 Windows 入口合并为一个后台产品模块；CLI 始终作为独立命令行产品。
3. 图形产品只使用固定 `desktop-official` 模块打开厂商官方页面，不保存下载直链，不下载、解析、校验或启动安装器。
4. 后台不得下发 EXE、Shell、PowerShell、CMD、任意命令、参数或本地路径；资源自动安装仍须客户端固定模块和本地白名单。
5. Logo 必须同时通过品牌身份、许可/商标、格式安全和最终视觉四道审核；搜索图片、第三方 Logo 站、个人头像和 GitHub 通用 favicon 永不进入正式目录。
6. 每次目录扩充运行幂等哈希检查、既有记录语义差异审计、精准搜索、A-Z、两类厂商频道、资源宿主聚合、完整发布测试和生产构建。

## 验证记录

- 三个扩充脚本连续运行两次，目录和 fallback 哈希保持不变。
- 既有 353 厂商 / 559 产品 / 128 资源的语义审计只发现计划内的 `coda` 厂商迁移和 5 个产品更新，既有资源无意外变化。
- 55 个 Logo 联系表已人工查看；Mastra、Zendesk 修正后无破图、透明消失、错品牌或明显裁切。
- 聚焦目录、搜索、模块、资源和 Logo 回归共 53 项通过。
- 完整发布测试、生产构建与本地发布结果记录在 `docs/catalog-expansion-status-2026-08-03.md`。
- 本地发布端点的 Ed25519 签名已用受信公钥实际验证；签名 payload 与 `/catalog-v1.json` 规范化后完全一致，当前为 revision 63、catalog version 60、375 厂商 / 615 产品 / 145 资源。
- 实际 PC 客户端页面已重载验收：精准搜索、Web/Windows 同卡、CLI 独立卡和新 Logo 均正常，页面控制台无错误。
