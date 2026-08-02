# 第七批 Windows 图形产品核验

## 范围与结论

本批次先读取了当前 `pc-client/admin/data/catalog-v1.json`。核验时目录基线为 **191 个厂商、337 个产品**；下列 12 个产品均不存在对应产品记录。研究只采用厂商官网、官方帮助中心、官方开发者文档或厂商维护的官方仓库，不把搜索摘要、软件下载站或媒体报道当作录入证据。

本批次仍不扩充 CLI。全部 Windows 图形软件建议使用统一的 `desktop-official` 模块：

- `installPolicy`: `open-official-download`
- `downloadPolicy`: `official-page`
- `signaturePolicy`: `vendor-controlled`
- `uninstallPolicy`: `vendor-managed`
- 不保存版本化安装器直链，不由客户端下载、解析、校验或启动厂商图形安装器。

其中 Fotor 和 Acrobat Reader 同时有可用网页入口，建议在同一个产品模块内展示“工具官网 / 网页版 / Windows 下载”，不重复计算为多个产品。Gemini Web、Microsoft Copilot Web 已经是目录中的独立产品，因此 Chrome 和 Edge 卡片不再重复添加对应网页版。

## 建议录入的 12 个产品

| 优先级 | 厂商 / 建议厂商 ID | 产品 / 建议产品 ID | 建议目录与分类 | Windows 官方入口 | Web 入口 | 官方教程或能力证据 | 核验结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Microsoft / `microsoft` | Visual Studio / `microsoft-visual-studio` | AI 可接入 / 编程与调试 | [Visual Studio Downloads](https://visualstudio.microsoft.com/downloads/) | 无 | [Visual Studio 是 Windows IDE，并内置 GitHub Copilot 辅助](https://learn.microsoft.com/en-us/visualstudio/get-started/visual-studio-ide?view=visualstudio)、[Copilot 安装与状态管理](https://learn.microsoft.com/en-us/visualstudio/ide/visual-studio-github-copilot-install-and-states?view=visualstudio) | 官方下载页明确为 Windows 图形 IDE，Community 版本的当前下载说明包含 Copilot AI。它是独立于已收录 VS Code 的产品，不应合并。 |
| 2 | Google / `google` | Android Studio / `google-android-studio` | AI 可接入 / 编程与调试 | [Android Studio 官方下载页](https://developer.android.com/studio) | 无 | [Gemini in Android Studio 概览](https://developer.android.com/studio/gemini/overview)、[Windows 安装说明](https://developer.android.com/studio/install) | 官方页面提供 Windows 64 位 EXE，并将 Gemini 定义为 Android Studio 的 AI 编程伙伴。Gemini 只在受支持的新版本中可用，Windows ARM 当前不受支持，卡片不能承诺任意旧版均可使用。 |
| 3 | Adobe / `adobe` | Adobe Acrobat Reader（含 AI Assistant）/ `adobe-acrobat-reader-ai` | AI 可接入 / 文档与知识库 | [Acrobat Reader 官方页面](https://www.adobe.com/acrobat/pdf-reader.html) | [Acrobat Web](https://acrobat.adobe.com/) | [Acrobat 生成式 AI 概览](https://helpx.adobe.com/acrobat/desktop/use-acrobat-ai/get-started-with-generative-ai/acrobat-ai-overview.html)、[AI Assistant 使用说明](https://helpx.adobe.com/acrobat/desktop/use-acrobat-ai/generative-ai-features/ai-get-answers.html) | Adobe 明确说明生成式 AI 能力覆盖 Windows/macOS 桌面 Acrobat 与 Reader，同时覆盖 Web。它比现有“Adobe Creative Cloud”总入口更具体，建议作为独立产品模块，但要注明部分 AI 能力依赖方案、额度或登录。 |
| 4 | Google / `google` | Google Chrome（含 Gemini）/ `google-chrome-ai` | AI 可接入 / 浏览器与搜索 | [Chrome 官方下载页](https://www.google.com/chrome/download-chrome/) | 无 | [Gemini in Chrome 使用说明](https://support.google.com/chrome/answer/16283624)、[可用地区与系统要求](https://support.google.com/chrome/answer/17140089) | Chrome 官网明确提供 Windows 安装并展示内置 Gemini。该能力仍在分批开放，依赖受支持地区、语言、年龄、最新版 Chrome 和已登录 Google 账号；企业/学校账号还可能需要管理员启用。 |
| 5 | Microsoft / `microsoft` | Microsoft Edge（含 Copilot）/ `microsoft-edge-ai` | AI 可接入 / 浏览器与搜索 | [Microsoft Edge 官方下载页](https://www.microsoft.com/en-us/edge/download) | 无 | [Copilot in Edge 官方说明](https://support.microsoft.com/en-us/microsoft-copilot/getting-started-with-copilot-in-microsoft-edge) | 官方下载页提供 Windows 版本；Copilot 可在 Edge 侧栏结合当前网页、标签和浏览历史回答问题。描述需要明确其浏览上下文权限可关闭，且功能可用性会随设备、市场和版本变化。 |
| 6 | Opera / `opera` | Opera One（含 Opera AI）/ `opera-one` | AI 可接入 / 浏览器与搜索 | [Opera One 官方页面](https://www.opera.com/one) | 无 | [Opera AI FAQ](https://help.opera.com/en/browser-ai-faq/) | Opera One 官网提供桌面下载并明确包含 Opera AI、页面上下文和侧栏交互。Opera AI 由多种第三方大模型支持，目录文案应把它描述为浏览器中的 AI 接入能力，而不是独立本地模型。 |
| 7 | Mozilla / `mozilla` | Firefox（AI Chatbot 侧栏）/ `mozilla-firefox` | AI 可接入 / 浏览器与搜索 | [Firefox for Windows](https://www.firefox.com/en-US/download/windows/) | 无 | [Firefox AI Chatbot 官方说明](https://support.mozilla.org/en-US/kb/ai-chatbot)、[AI 控制项](https://support.mozilla.org/en-US/kb/firefox-ai-controls) | Firefox 133 及以上可在侧栏选择 Claude、ChatGPT、Gemini、Le Chat 或 Copilot。Firefox 会把用户选择的文本、提示词、页面标题或页面内容发送给所选服务；卡片需提示第三方条款与数据边界，不能宣称 Mozilla 自己提供这些模型。 |
| 8 | InvokeAI / `invokeai` | Invoke Community Edition / `invokeai-community-edition` | AI 工具 / 图像创作 | [Invoke 官方下载页](https://invoke.ai/download/) | 无 | [官方 Launcher 安装说明](https://invoke.ai/start-here/installation/)、[硬件要求](https://invoke.ai/start-here/system-requirements/) | 官方提供 Windows EXE Launcher，用于安装、更新和启动本地 Invoke。原托管服务已停止，不能把 `app.invoke.ai` 作为网页版入口；只保留当前开源社区版的官方 Windows 下载页。 |
| 9 | Upscayl / `upscayl` | Upscayl Desktop / `upscayl-desktop` | AI 工具 / 图像创作 | [Upscayl 官方下载页](https://upscayl.org/download) | 无 | [官方文档](https://docs.upscayl.org/)、[官方仓库的 Windows 安装说明](https://github.com/upscayl/upscayl#-installation) | 官方明确提供 Windows 10 及以上的图形客户端，使用本地 AI 模型进行图像放大；通常需要 Vulkan 兼容 GPU。只打开官方落地页，不保存版本化 GitHub EXE 直链。 |
| 10 | Fotor（Everimaging）/ `fotor` | Fotor for Windows / `fotor-windows` | AI 工具 / 图像创作 | [Fotor Windows 官方页面](https://www.fotor.com/windows/index.html) | [Fotor 网页版](https://www.fotor.com/) | [Fotor Help Center](https://support.fotor.com/hc/en-us) | 官方 Windows 页面明确包含 AI 编辑、增强、批处理等能力，页脚确认由 Everimaging 运营。网页与 Windows 是同一 Fotor 产品的两个入口，应合并为一个产品模块。 |
| 11 | CyberLink / `cyberlink` | PowerDirector / `cyberlink-powerdirector` | AI 工具 / 视频创作 | [PowerDirector 官方页面](https://www.cyberlink.com/products/powerdirector-video-editing-software/overview_en_US.html) | 无 | [CyberLink Learning Center](https://www.cyberlink.com/learning) | 官方页面明确支持 Windows 10/11，并列出通过文字编辑、AI 故事、文生视频、图生视频、背景移除、音视频增强等能力。免费版和订阅版能力不同，目录不能承诺全部 AI 功能免费。 |
| 12 | CyberLink / `cyberlink` | PhotoDirector / `cyberlink-photodirector` | AI 工具 / 图像创作 | [PhotoDirector 官方页面](https://www.cyberlink.com/products/photodirector-photo-editing-software-365/features_en_AU.html) | 无 | [CyberLink Learning Center](https://www.cyberlink.com/learning) | 官方页面提供 Windows 版本和下载入口，并明确包含生成式 AI、AI Agent、文字编辑、AI 替换与增强功能。与 PowerDirector 是同厂商下两个独立图形产品，应分别展示。 |

## 目录结构建议

### 新增实用特性分类

当前目录没有能够准确承载 Chrome、Edge、Opera One 和 Firefox 的分类。建议新增 **“浏览器与搜索”**，四个浏览器都归入该分类，不要放进“项目与协作”“网站与建站”或“营销与搜索”。

### 同一厂商、不同产品不合并

- Visual Studio 与 Visual Studio Code 是两个独立 IDE，分别计算产品。
- Android Studio 与 Gemini Web 是两个独立产品；Android Studio 卡片只描述 IDE 内的 Gemini 能力。
- Chrome 与 Gemini Web、Edge 与 Microsoft Copilot Web 不重复合并。浏览器卡片的作用是说明“浏览器内可调用 AI”，已有网页 AI 产品继续独立存在。
- Adobe Acrobat Reader 是明确的文档产品，虽然 Adobe Creative Cloud 已经存在，仍应单独展示；但同一 Acrobat 产品的 Web 与 Windows 入口合并。
- PowerDirector 与 PhotoDirector 面向视频和图像两种不同工作流，应作为同厂商下两个产品。

### 地区、账号和数据提示

- Chrome 的 Gemini 仍在分批开放，依赖地区、语言、年龄、账号和版本；不能把“安装 Chrome”写成“必定获得 Gemini”。
- Edge、Firefox 和 Opera 的 AI 可能读取用户授权的网页或标签上下文。卡片描述应简短提醒“发送前确认页面内容与第三方服务条款”，详细权限说明放教程页。
- Acrobat、Fotor、PowerDirector 和 PhotoDirector 的部分云端 AI 能力可能需要登录、订阅或生成额度；桌面客户端可下载不等于全部 AI 功能免费。
- 上述限制只属于产品事实和文案参数，后台仍不能下发命令，也不能把图形软件切换成客户端托管安装。

## 本批次不纳入

- NVIDIA ChatRTX：NVIDIA 当前 AI on RTX 页面仍提及 ChatRTX，但旧产品页已跳转到总览页，未找到稳定的当前 Windows 安装落地页；暂不录入，避免把历史下载或依赖包当作正式客户端入口。
- Amuse：官方代码仓库已归档并标注 Final Release，不作为当前优先产品。
- ON1 Photo RAW、Capture One、DxO PhotoLab：三者均已通过官方页面确认 Windows 图形客户端和 AI 编辑能力，但本批次优先填补浏览器、IDE、PDF 与更通用创作入口，留给后续图像专业工具批次。
- Arc：Windows 客户端存在，但官方资料中多项 Arc Max AI 能力仍有平台差异，本批次不录入。
- 任意版本化 EXE/MSI 直链、第三方软件下载站、非官方重打包和 CLI。
