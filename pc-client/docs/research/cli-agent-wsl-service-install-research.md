# WSL/服务型 Agent 官方安装合同研究

范围：`simular-agent-s-cli`、`nanoclaw-cli`、`plandex-cli`、`agenticseek-cli`、`kortix-cli`。仅采用项目官方文档、官方源码仓库与官方发布页；未安装、未登录、未修改业务数据。

## 结论表

| productId | 真实身份与 Windows/WSL/Docker | 依赖与固定身份 | 安装/启动/更新/修复/卸载/数据 | driver 判断 |
|---|---|---|---|---|
| `simular-agent-s-cli` | Agent S 是 Simular 的电脑操作 Agent 框架/CLI，不是桌面安装包；官方支持 Windows 参数，但 Windows 文档注明当前没有干净方案；检索增强路径需要 Docker Desktop。[官方 Quickstart](https://docs.simular.ai/agent-s/quickstart) [官方仓库](https://github.com/simular-ai/Agent-S) | `pip install gui-agents` 或源码；Python/API keys；可选 Docker/Perplexica；没有固定 Windows MSI/portable 制品。 | 官方给出 CLI 运行方式与源码安装；未给统一 update、repair、uninstall 或数据保留合同。 | 不能安全映射单一 `python-venv`（Windows 环境仍不清晰、可选 Docker）；**blocked**。 |
| `nanoclaw-cli` | NanoClaw 是容器隔离的消息 Agent；Windows 仅通过 WSL2 + Docker Desktop，非原生 Windows。[官方安装](https://docs.nanoclaw.dev/installation) [官方仓库](https://github.com/nanocoai/nanoclaw) | 源码 checkout；Docker 是默认 runtime；v2 agent-runner 改为 Bun，v1 changelog 曾固定 Node 22；无固定 Windows 二进制/镜像 digest。 | 启动由官方 setup/服务流程完成；官方 `/update-nanoclaw` 会拉取上游、迁移、重建容器并重启服务；服务状态按平台检查；未提供通用卸载/数据清理合同，数据位于项目 `data/`、日志与容器挂载。[Quickstart](https://docs.nanoclaw.dev/quickstart) [Changelog](https://docs.nanoclaw.dev/changelog) | **WSL/服务复合体 blocked**；更新会改源码、迁移数据、重启服务，不能由现有单一 driver 直接承接。 |
| `plandex-cli` | 官方 Plandex CLI/编码 Agent；Windows 明确只支持 WSL shell，CMD/PowerShell 不支持；本地模式可 Docker。[安装](https://docs.plandex.ai/install/) [Quickstart](https://docs.plandex.ai/quick-start/) | 官方安装脚本或最新 release 平台二进制；源码构建需要 Go；没有本轮可固定到具体版本的 Windows 制品 URL/checksum。 | `plandex`/`pdx` 启动；CLI reference 的 `plandex update` 是更新上下文，不是升级二进制；未见官方 repair/uninstall 或完整数据保留合同，项目 `.plandex`/计划数据需保留。[CLI Reference](https://docs.plandex.ai/cli-reference/) [Plans](https://docs.plandex.ai/core-concepts/plans/) | 形态接近 **WSL + portable-binary**，但缺固定制品与安装维护合同；**blocked**。 |
| `agenticseek-cli` | AgenticSeek 是本地 Agent，官方 Windows 路径依赖 Docker Desktop/Compose；也提供 CLI mode，仍需服务容器；非原生单文件 CLI。[官方仓库](https://github.com/Fosowl/agenticSeek) | Git checkout；强烈建议 Python 3.10.x；Docker Engine/Compose；Windows `install.bat`、`start_services.cmd`；下载 Docker images，但未给固定 digest。 | Docker 服务由脚本启动，CLI 用 `uv run cli.py`；官方 README 有 troubleshooting，未给 update/repair/uninstall 或持久数据清理边界；`.env` 与 `WORK_DIR` 可能含用户密钥/文件。 | **WSL/服务复合体 blocked**；不适合 `python-venv` 或 portable-binary 单 driver。 |
| `kortix-cli` | Kortix/Suna 是多服务“Company AI Command Center”，推荐 Docker，也有手动服务；官方支持 Windows WSL2，不是单一 CLI。[官方仓库](https://github.com/kortix-ai/suna) [自托管安装](https://www.mintlify.com/kortix-ai/suna/installation) | 官方 `curl https://kortix.com/install | bash` 安装器；Docker 或手动 Node 18+/Python 3.11+/pnpm/uv/Git；多容器服务与 cloud Supabase，未给固定镜像 digest。 | `kortix start/stop/restart/logs/status/update/reset`；`update` 拉取最新镜像并重启，`reset` 清空本地数据；未见独立 repair/卸载或数据备份合同，reset 明确破坏数据。[官方 README](https://github.com/kortix-ai/suna) | **WSL/服务复合体 blocked**；现有 driver 不能安全代管多服务更新、reset 或数据生命周期。 |

## 汇总

- 可直接映射并进入现有 driver 评审：0。
- 必须 blocked：5；共同缺口是固定版本/制品身份、可验证修复与卸载/数据保留边界，且 4 项为 WSL/Docker/多服务复合体。
