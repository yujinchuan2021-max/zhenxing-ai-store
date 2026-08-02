# 枕星 AI：厂商 Logo 身份与可读性复核

- 日期：2026-08-03
- 范围：用户截图中的 AMD、Block、Cline、01.AI、Intel、金山办公，以及与错图共享同一资产的其他厂商
- 原则：品牌身份只采用厂商官网、官方品牌页或官方 GitHub 组织；无法确认品牌素材时使用文字回退，不拿托管平台图标或个人头像代替

## 截图结论

| 厂商 | 原来源 | 结论 | 处理 |
| --- | --- | --- | --- |
| AMD | 原为 16×16 的 [AMD 官方 favicon](https://www.amd.com/content/dam/code/images/favicon/favicon.ico) | 身份正确，但分辨率过低且深色标识叠在红色色块上 | 改用 [AMD 官方 GitHub 组织头像](https://github.com/amd) 的 256×256 资产，并使用白色中性底 |
| Block | [Block 官方站点图标](https://block.xyz/apple-touch-icon-reskin.png) | 身份正确，但黑色透明标识叠在黑色色块上，几乎不可见 | 保留受管资产；图片型 Logo 改用白色中性底 |
| Cline | 错误地使用 GitHub 站点 favicon | 不是 Cline Logo | 改用 [Cline 官方 GitHub 组织头像](https://github.com/cline) |
| 01.AI | 错误地使用 GitHub 站点 favicon；后续官方组织横向字标在 36px 卡片中仍不可读 | 不是 01.AI Logo；[官方品牌条款](https://platform.01.ai/useragreement)还要求事先书面许可 | 改用审核文字回退，不再分发图形 Logo |
| Intel | [Intel 官方 favicon](https://www.intel.cn/etc.clientlibs/settings/wcm/designs/intel/default/resources/favicon-32x32.png) | 身份正确，但蓝色标识叠在蓝色色块上，对比度不足 | 保留受管资产；图片型 Logo 改用白色中性底 |
| 金山办公 | [WPS 官方站点](https://www.wps.cn/) | 当前资产是官方 WPS 图形，但红色图形叠在红色色块上，层次不清 | 保留受管资产；图片型 Logo 改用白色中性底 |

## 同源错图扩展检查

内容哈希 `74cf90ac...` 是 GitHub 自身的 Octocat favicon，却同时关联了 01.AI、Cline、GitHub、LangChain、LostRuins、Open WebUI 和 ThinkInAI。除 GitHub 外均不构成对应厂商的品牌标识。

- LangChain 改用 [LangChain 官方 GitHub 组织头像](https://github.com/langchain-ai)。
- Open WebUI 改用 [Open WebUI 官方 GitHub 组织头像](https://github.com/open-webui)。
- ThinkInAI 改用 [ThinkInAI 官方 GitHub 组织头像](https://github.com/ThinkInAIXYZ)。
- GitHub 继续使用其官方站点图标，证据页改为 [GitHub Logos](https://github.com/logos)，并确保该资产只关联 GitHub。
- LostRuins 的官方入口是个人维护的 [KoboldCpp 仓库](https://github.com/LostRuins/koboldcpp)；个人头像不作为品牌 Logo，改用审核过的文字回退。

## 发布规则

1. 一个内容寻址 Logo 资产只能归属一个厂商；目录中的厂商身份本身应当唯一。
2. `github.githubassets.com/favicons/` 只允许用于 GitHub 厂商，不能因为产品官网位于 GitHub 就继承 GitHub favicon。
3. 导入器每次运行都按当前目录反向重建来源清单中的 `vendorIds`，清除历史错误关联。
4. 图片型 Logo 使用中性白底并占满图标容器，避免资产自带留白后又被前端二次缩小；只有文字回退继续使用厂商颜色。
5. 自动测试同时检查来源身份和渲染对比，不能只验证文件存在、哈希正确和 HTTP 可读。

## 全量二次复核

- 对 183 个厂商的 128 个当前图形资产和 55 个文字回退做了全量联系表巡检；所有当前图形资产均可解码，未再发现错品牌、透明异常或高严重度低对比问题。历史签名目录引用的旧哈希文件作为不可变发布依赖继续保留。
- AWS、Redis、Stability AI、NVIDIA、Nous Research、Supabase、Ableton、UiPath 和 Open Home Foundation 的历史低质量或错配资产已替换为对应官方组织身份。
- 导入器现在把已审核文字回退视为明确决定，不会在每次运行时重新抓取 favicon 或把受限品牌又变回图片；新增图形资产前必须先从回退清单移除并重新审核。
