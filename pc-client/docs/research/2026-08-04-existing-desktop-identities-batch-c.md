# Windows 桌面产品静态身份与生命周期收口（Batch C）

日期：2026-08-04  
范围：当前 Windows 桌面候选中尚未通过完整准入的 9 个产品  
方法：只下载一方 HTTPS 安装包，读取完整 SHA-256、Authenticode、PE Machine 与 Windows VersionInfo；不执行安装器。

## 结论

| 产品 | 结论 | 说明 |
|---|---|---|
| QoderWork CN | 准入 | 官方 rolling URL；以有效发布者、PE 与稳定 VersionInfo 约束滚动包 |
| ima | 准入 | 固定版本、固定 SHA、腾讯有效签名与完整版本身份 |
| LM Studio | 准入 | 固定版本、固定 SHA、Element Labs 有效签名；更新继续由内置更新器负责 |
| GPT4All | 准入 | 固定版本、固定 SHA、Nomic 有效签名与 PE x64；Qt IFW 外壳没有可用 VersionInfo，显式使用固定 SHA 例外 |
| AnythingLLM Desktop | 准入 | 官方 rolling URL；以有效发布者、PE 与稳定 VersionInfo 约束滚动包 |
| Kiro IDE | 准入 | 固定版本、固定 SHA、Amazon 有效签名与 Inno 外壳身份；保留厂商自动更新 |
| NVIDIA AI Workbench | 准入 | 官方 latest URL；桌面外壳独立安装，本地 Full Local 环境仍由产品内引导完成 |
| OpenCode Desktop | 准入 | 固定 GitHub Release、固定 SHA、Anomaly 有效签名与 NSIS 外壳身份 |
| Perplexity Comet | 阻断 | 当前公开 REST 入口没有返回安装包，实际跳转到 `https://www.example.com/?status=ok`；不得发布伪一键安装 |

## 安装包证据

| productId | 字节 | SHA-256 | 签名主体 | PE | VersionInfo 摘要 |
|---|---:|---|---|---|---|
| `alibaba-qoderwork-cn` | 252,233,192 | `f325b5c82bb1822c75b4e808f5a410c8091a9b837d1020bed42aa7fd8c33c382` | `BRIGHT ZENITH PRIVATE LIMITED`，Valid | x86 | `QoderWork` / `QoderWork - Beyond chat, get it done` / `Qoder` |
| `tencent-ima` | 224,073,264 | `14102bc92f815463905c9a7fe65137f1a2d4297fb733c827db011cd6dcc3d45f` | `Tencent Technology (Shenzhen) Company Limited`，Valid | x64 | `ima installer` / `ima_installer.exe` / `Tencent` |
| `lm-studio-desktop` | 617,153,352 | `cae7b4a3dbdf97252f35d2d2d1b70e81415f1aac92b3e4779994bdec84ec067d` | `Element Labs Inc.`，Valid | x86 | `LM Studio` / `Discover, download, and run LLMs locally` / `LM Studio` |
| `gpt4all-desktop` | 744,456,856 | `e284f2d72cf0026dc49c3dce8b5f1a19c088737b36e37bc8e0d48b668926ef52` | `Nomic, Inc`，Valid | x64 | Qt Installer Framework 外壳的版本资源为空/损坏，不作为身份信号 |
| `anythingllm-desktop` | 394,525,080 | `11478d5701163e84387550f30497526c88d4a483edee7475f0810529ffa03944` | `Mintplex Labs Inc`，Valid | x86 | `AnythingLLM` / `AnythingLLM | Stop Renting Intelligence. Own It.` / `Mintplex Labs Inc` |
| `amazon-kiro-ide` | 171,322,272 | `20b68942d4d4002ab49747f43abdd26ea99367811aebf5fa7a5cc4e1337a780c` | `Amazon.com, Inc.`，Valid | x86 | `Kiro` / `Kiro Setup` / `Amazon Web Services`（字段尾部含空格） |
| `nvidia-ai-workbench` | 169,269,104 | `c675644afc3651fe5860a895f93835b2d0d18ea99d4fb4966bf8332e3f3c20ae` | `NVIDIA Corporation`，Valid | x86 | `NVIDIA AI Workbench` / `NVIDIA Corporation` |
| `opencode` | 124,337,464 | `3141a7f01f90eb4e00519257ca35fd6cab54f825283ab944d9412f908a64651e` | `Anomaly Innovations, Inc https://anoma.ly/`，Valid | x86 | `OpenCode` / `OpenCode` |

滚动入口的现场 SHA 只用于本次证据留档，不固化为长期合同；运行时持续要求 HTTPS 允许主机、有效 Authenticode、发布者、PE 与稳定 VersionInfo。固定版本入口继续同时固定 SHA。

## 生命周期边界

- AI Hub 只调起已验证的厂商安装器和经注册表收据验证的卸载器，不清理用户模型、项目、聊天、浏览器资料或 IDE 配置。
- LM Studio 与 Kiro 的更新由厂商应用负责；AI Hub 不与其更新器并发覆盖安装。[LM Studio 更新说明](https://lmstudio.ai/docs/app/offline)、[Kiro 安装与降级说明](https://kiro.dev/docs/getting-started/installation/)
- GPT4All 默认模型目录是 `%LOCALAPPDATA%\nomic.ai\GPT4All`，普通卸载不得主动删除。[GPT4All 设置](https://docs.gpt4all.io/gpt4all_desktop/settings.html)
- NVIDIA Desktop App 初装只是 remote-only 外壳；WSL、容器和 Git 等 Full Local 环境由 NVIDIA 自己的产品引导管理，不能把它们伪装成桌面安装器的静态前置依赖。[NVIDIA Windows 安装说明](https://docs.nvidia.com/ai-workbench/user-guide/latest/install/desktop-app-install.html)
- Kiro 官方明确 Windows 通过“已安装的应用”卸载，并说明设置、扩展与登录状态在重装之间保留；客户端只调起可信卸载收据。[Kiro 安装说明](https://kiro.dev/docs/getting-started/installation/)
- Comet 官方帮助仅要求从官方页面下载并运行界面安装器，公开 REST 入口在本次无登录请求中没有返回二进制。直到一方提供稳定、无需用户账号令牌的下载合同前，只展示官方页面。[Comet 入门](https://www.perplexity.ai/help-center/en/articles/11172798-getting-started-with-comet)

## 一方入口

- QoderWork：<https://qoder.com.cn/>
- ima：<https://ima.qq.com/>
- LM Studio：<https://lmstudio.ai/download?os=windows>
- GPT4All：<https://github.com/nomic-ai/gpt4all/releases/tag/v3.10.0>
- AnythingLLM：<https://anythingllm.com/desktop>
- Kiro：<https://kiro.dev/docs/getting-started/installation/>
- Comet：<https://www.perplexity.ai/platforms>
- NVIDIA AI Workbench：<https://docs.nvidia.com/ai-workbench/user-guide/latest/install/desktop-app-install.html>
- OpenCode：<https://github.com/anomalyco/opencode/releases/tag/v1.18.10>
