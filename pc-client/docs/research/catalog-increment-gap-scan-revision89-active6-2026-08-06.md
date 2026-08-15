# revision89 / v1 active72 / v2 active6 增量查漏

核验时间：2026-08-06。事实源为 `pc-client/admin/published/catalog-store/state.json`：draft revision 89、615 个产品、375 个厂商；v1 active72；v2 active6（`catalog-v00000006-567e671621f1-3dcee587`）。本轮只做增量查漏，不重扫 615 项，不修改 catalog/state，不 saveDraft、发布、封包或下载完整制品。

## 高置信增量候选：Google app for desktop

现有 Google 厂商已有 Gemini、Gemini CLI、Jules、AI Studio、Antigravity 等，但没有 `google-app-desktop` 或同义产品。Google 一方页面 [The Google app for desktop](https://search.google/google-app/desktop/) 将其定义为 Windows 10+ 桌面应用，提供 Lens、AI-powered responses、跨计算机/Google Drive 搜索和快捷键；这不是 Gemini Web、Antigravity 或 Chrome 的别名。

页面的官方脚本 [main.min.js](https://search.google/static/js/main.min.js?version=1785860427156) 明确构造固定下载路径：

`https://dl.google.com/windows-google-app/GoogleAppInstaller.exe`

该 URL HEAD 返回 HTTP 200、`application/x-msdos-program`、12,411,832 bytes、`Content-Disposition: attachment`；1 KiB Range 返回 HTTP 206，`Content-Range: bytes 0-1023/12411832`。因此候选策略为 `direct-artifact`，文件名 `GoogleAppInstaller.exe`、类型 `exe`。未下载完整安装包，也未授予安装权限。下一责任人是[AI 厂商桌面管理](../team-ownership-and-coordination.md)任务 `019fcd13-be2b-7990-bf2e-5f75f4a8002f`。

## CLI/Agent 增量队列

Google 官方 [agents-cli 仓库](https://github.com/google/agents-cli)、[Getting Started](https://google.github.io/agents-cli/guide/getting-started/)、[CLI reference](https://google.github.io/agents-cli/cli/) 与 [PyPI 包](https://pypi.org/project/google-agents-cli/)确认 `google-agents-cli` 是 Google LLC 的独立 CLI 包；README 明确它是供 coding agents 使用的工具，而非 Agent 本身。CLI 复核确认官方支持仅为 macOS、Linux 和 Windows WSL 2，**不支持 Native Windows**。固定候选为 PyPI 1.3.1 `py3-none-any` wheel，SHA-256 `0d6d34bcc753ddee19c74e22b9423b651950fac140b46bda668efdd3ed511366`。依赖 Python >=3.11、uv、Node.js；setup 会在全局/工作区安装 skills，更新使用 npx，未见受管卸载或数据边界合同。状态精确为 `official-native-Windows-not-supported`；现有 Windows python-venv/其他固定 driver 不可安全表达其生命周期。本轮不创建 profile、registry、binding 或目录候选，不安装、不下载。

## 去重与拒绝

- AWS 当前[官方命令行文档](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line.html)明确写出 Q CLI 已成为 Kiro CLI；现有 `amazon-kiro-cli` 已覆盖，拒绝新增 `amazon-q-cli`。
- Hermes Desktop 与 Hermes Agent 已由 `nous-hermes-desktop` / `nous-hermes-agent` 覆盖；不创建第三个 Hermes 身份。
- 本轮新增产品 ID 仅 `google-app-desktop`；重复产品 ID、重复厂商 ID 均为 0。

JSON 中已执行 HTTPS、唯一性和禁止执行字段扫描；结果全部 candidate-only。
