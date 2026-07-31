# 官方产品自动发现与第二轮目录扩充

日期：2026-07-31

## 目标

把“逐个厂商手工翻页”改造成可重复运行的研究流水线，同时继续遵守两条边界：只从官方来源发现候选；未经人工确认的候选不得写入正式目录或获得本地执行能力。

## 自动发现流水线

`npm run catalog:discover` 从后台草稿目录读取厂商、产品官网和教程地址，自动完成：

1. 为每个厂商生成官方域名和路径范围。
2. 探测官网页面和 sitemap。
3. 提取产品、桌面端、CLI、Agent、下载入口等候选。
4. 与现有产品 URL 和名称比对。
5. 把结果分为已有匹配、高置信待审核、研究线索和请求失败。
6. 每完成一个厂商立即保存检查点，支持 `--resume` 断点续跑。

首轮全量扫描覆盖 49 个厂商，访问 83 个页面，得到 46 条高置信候选和 410 条研究线索；96 个失败请求主要来自 sitemap 不存在、境外连接超时或页面体积超限。失败请求保留为状态，不会被解释成“产品不存在”。

在加入语言路径归一化、厂商内产品归属匹配和文档页降噪后，最终复扫仍覆盖 49 个厂商、83 个页面，只留下 9 条需要人工判断的产品候选和 354 条研究线索；跨厂商提及不会被误认成当前厂商产品。

完整本地报告生成在：

- `output/catalog-research/official-product-candidates.json`
- `output/catalog-research/official-product-candidates.md`

这些文件是审核输入，不是发布数据。

## 已复核并录入的产品

| 厂商 | 新增或修正 | 官方证据 |
| --- | --- | --- |
| OpenAI | ChatGPT Work | https://openai.com/chatgpt-work/ |
| Anthropic | Claude Cowork、Claude Tag | https://claude.com/product/cowork 、https://claude.com/product/tag |
| Google | Gemini Notebook、Antigravity 2.0、Antigravity CLI/SDK、Gemini Spark、Flow、Flow Music、Stitch、Project Genie、MusicFX | https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/ 、https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/ 、https://labs.google/fx/ |
| Microsoft | Microsoft Agent 365 | https://learn.microsoft.com/en-us/microsoft-agent-365/overview |
| Anysphere | Cursor CLI | https://docs.cursor.com/en/cli/overview |
| ElevenLabs | ElevenLabs Agents、ElevenLabs Studio | https://elevenlabs.io/docs/eleven-agents/guides/elevenlabs-docs-agent |
| 腾讯 | WorkBuddy 产品形态修正、QClaw、ima、ClawPro、腾讯设计 Ardot | https://www.tencent.com/en-us/articles/2202350.html 、https://cloud.tencent.com/product/workbuddy 、https://cloud.tencent.com/product/adt |
| 阿里巴巴 | Qoder CN IDE、QoderWork CN、Qoder CN CLI、QoderWake CN、Qoder Cloud Agents CN | https://www.alibabacloud.com/help/en/lingma/introduction-of-lingma |
| 月之暗面 | Kimi Work、Kimi Claw、Kimi Claw 本地部署、Kimi WebBridge | https://www.kimi.com/zh-cn/products/ 、https://www.kimi.com/help/others/product-comparison |
| OpenClaw | OpenClaw 一键部署、Windows Hub | https://docs.openclaw.ai/install 、https://docs.openclaw.ai/windows |

本轮目录从 121 个产品扩充到 146 个产品，厂商数保持 49，产品下 Skill/MCP 子目录保持 24 条。

## 审核时否决或合并的候选

- Kimi Agent、Agent Swarm、Docs、Sheets、Slides、Websites 和 Deep Research：Kimi 官方产品总览和产品对比将其定义为 Kimi 内部模式或功能，不作为独立安装产品重复展示。
- OpenClaw 多语言 CLI 文档、LM Studio 功能文档：属于既有产品的子页面，不新增产品。
- 腾讯 Games、Marketing Solutions、WeChat 等公司导航入口：不属于本项目 AI 产品目录。
- Sora：官方已宣布停止当前 Web/App 产品，不作为活跃产品重新加入。

## 安装边界

- Web 产品直接打开产品页面。
- 普通图形桌面软件打开厂商官方下载入口。
- 只有客户端本地注册表中完成包来源、版本、生命周期脚本和卸载行为审核的 CLI，才显示一键部署。
- OpenClaw 已完成固定版本、官方包完整性、安装后启动、服务清理和卸载规则审核。
- 新发现的 Antigravity CLI、Cursor CLI、Qoder CN CLI 暂时使用官方安装说明；完成本地安装器审计前，不允许后台把它们升级成一键执行。

这意味着自动抓取可以自动补“证据”，但不能绕过客户端白名单自动补“执行权限”。
