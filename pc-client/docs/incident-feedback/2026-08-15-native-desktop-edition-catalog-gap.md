# 原生桌面入口遗漏与产品身份重复风险

## 用户现象

MiniMax 官方页面已经提供 Windows/macOS 桌面下载，但目录中的 `minimax-agent` 仍只有网页语义。继续按相同边界复核后，又确认 Notion、Replit、Gemini、Comate、Kortix 和 GitHub Copilot 已有一方桌面入口；FlowithOS 则是未建模的相邻独立产品。

## 根因

- 既有目录审计偏向产品官网和 Web/教程入口，没有把“同一产品后来增加原生桌面表面”作为独立复核轴。
- `productType` 被当作产品身份，而不是当前主要展示入口，导致同一产品的 Web 与 desktop 关系容易遗漏或被错误拆卡。
- Notion 的旧 `officialDownload.kind="no-windows"` 没有随一方平台支持变化重新验证。
- 没有统一区分原生应用、PWA、CLI、IDE/Office/浏览器插件、移动 App 和云端 Desktop Mode。

## 修复

- 复用 7 个既有稳定产品 ID，增加一方桌面入口：MiniMax、Notion、Replit、Gemini、Comate、Kortix、GitHub Copilot。
- 新增独立 `flowith-os` 候选，保留 `flowith-agent-neo` 原身份；保留 MiniMax CLI、Kortix CLI 和 GitHub Copilot CLI 独立生命周期。
- 全部先采用 `desktop-official + officialDownload.download-page`，仅打开厂商落地页；不写二进制 URL、`download`、`installProfileId` 或托管安装能力。
- 对 Codex/ChatGPT Work、Claude Cowork、Kimi Claw 等统一桌面宿主只建立关系，不复制安装身份；PWA、CLI、插件和移动端不冒充桌面版。

## 验证

- 两批一方研究共核 27 个对象，确认 ready 8、deferred 3、blocked 16。
- TDD 先锁定旧候选只含 4 项的精确失败，再扩为 8 项；最终候选为 375 vendors / 617 products / 280 resources / 866 targets / 10 relations。
- 7 个既有产品原位更新、1 个产品追加；删除新增项并恢复 7 个原记录后与输入目录深度相等。
- 8 项全部通过目录验证和产品策略验证，均无可执行下载合同、托管安装或新 Resource/target/connection。

## 预防门

后续目录更新应定期从当前 Web/Tutorial 产品中筛选一方 `Download/Desktop/Windows/macOS` 信号，并逐项验证：稳定产品身份、原生平台、官方下载落地页、账户/权限、更新/卸载边界及与已有桌面宿主的去重关系。研究结论只有进入经验证的候选并完成独立签名发布后，才算用户端已上架。
