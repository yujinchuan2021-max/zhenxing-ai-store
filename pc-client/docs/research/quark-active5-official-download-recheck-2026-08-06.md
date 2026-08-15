# Quark active5 官方 Windows 下载复核（candidate-only）

核验时间：2026-08-06。来源为 active5 发布包 `catalog-v00000005-9654219dbedb-3f44cffa`（draftRevision 88，615 个产品）。本报告和配套 JSON 仅为候选，未写入 catalog/state，未 saveDraft/publish/package。

## 结论

`alibaba-quark-ai-browser` 当前 canonical direct 指向的旧制品：

`https://umcdn.quark.cn/download/37212/quarkpc/pcquark@store_guanwang/QuarkPC_V1.2.5.25_pc_pf30002_(zh-cn)_release_(Build1707620-240313220512-x64).exe`

HEAD 与 1 KiB Range 均为 HTTP 404，`application/xml`，491 bytes（Aliyun OSS NoSuchKey）。因此不能继续作为 direct-artifact。

夸克一方官网 [https://www.quark.cn/](https://www.quark.cn/)（页面标题“夸克_AI旗舰应用官网”）明确展示夸克 PC/Windows 产品；页面仍嵌有上述旧 V1.2.5.25 地址，证明该静态地址已漂移。官网一方下载入口 `https://download.quark.cn/download/quarkpc?ch=pcquark@default` 的 HEAD 返回 302，Location 为：

`https://umcdn.quark.cn/download/37212/quarkpc/pcquark@default/QuarkPC_V7.0.5.931_pc_pf30002_(zh-cn)_releasemini_(Build3017926-1001-x64).exe`

该最终 URL HEAD 为 HTTP 200、`application/octet-stream`、3,316,024 bytes；Range `bytes=0-1023` 返回 206、`Content-Range: bytes 0-1023/3316024`，仅读取 1 KiB，未下载完整安装包。建议候选为 `stable-redirect`，不要把当前版本化 CDN 目标伪装成永久 direct-artifact；最终文件名为 `QuarkPC_V7.0.5.931_pc_pf30002_(zh-cn)_releasemini_(Build3017926-1001-x64).exe`，类型 `exe`，重定向 host 为 `download.quark.cn`，制品 host 为 `umcdn.quark.cn`。

## active5 67 条 canonical direct 的快速形状扫描

仅对本地 URL 字符串扫描，未对其余 66 条做网络验收。发现 31 条含 `latest`、版本/构建/时间路径、GitHub 版本 release 或查询参数的复核标记；这些只是风险提示，不等同于失效。Quark 是本轮唯一实际复现为 404 的条目。

- `latest` 标记（9）：`msty-studio`, `msty-nexus`, `read-desktop`, `laiye-worker`, `asana-work-graph`, `upscayl-desktop`, `evernote-desktop`, `aftershoot`, `audiate`。
- GitHub 版本 release（13）：`open-webui`, `lobehub-desktop`, `pinokio-ai-browser`, `amd-gaia`, `deepchat-desktop`, `fiveire-desktop`, `obsidian-desktop`, `upscayl-desktop`, `heptabase-desktop`, `motion-desktop`, `qupath-desktop`, `audacity-desktop`, `affine-desktop`。
- 版本/构建/时间路径（22）：`alibaba-quark-ai-browser`, `alibaba-dingtalk-ai`, `nvidia-broadcast`, `nous-hermes-desktop`, `open-webui`, `lobehub-desktop`, `pinokio-ai-browser`, `amd-gaia`, `deepchat-desktop`, `fiveire-desktop`, `canva-windows`, `xmind-ai`, `asana-work-graph`, `blender`, `obsidian-desktop`, `heptabase-desktop`, `evoto-desktop`, `motion-desktop`, `qupath-desktop`, `affine-desktop`, `spark-mail-windows`, `movavi-video-editor`。
- 查询参数（2）：`nous-hermes-desktop`, `movavi-video-editor`。

后续应由桌面/后台员工审核上述风险标记的实际响应；本报告不授予安装权限，也未写入 `command/args/env/script/headers/credentials` 等执行字段。
