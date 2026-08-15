# draft89 CLI 13 个 official-only blocked 一手复核

## 范围与规则

事实源为 `docs/acceptance/cli-agent-draft89-coverage-matrix-2026-08-06.md` 的 13 个 `official-only blocked`。本轮只查厂商官网、官方文档、官方仓库与官方包/Release 页面；动态 `curl|shell`、源码 README 本身、mutable `latest`、需要秘密或远程平台的路径，不作为受管候选。结果为 candidate-only，未修改代码、catalog、state，未 saveDraft/publish/package/download/install。

## 汇总

| 结果 | 数量 |
| --- | ---: |
| accepted | 0 |
| still-blocked | 13 |
| 唯一 productId | 13 |

13 项均没有同时满足固定 Windows 原生/WSL 制品、版本/校验、稳定入口、更新/修复/卸载及数据边界的受管合同，因此没有新增 profile 或候选。逐项证据与阻断原因见同名 JSON。

## 关键结论

- `cursor-cli` 仍是 WSL + 动态安装器；`nvidia-nemoclaw-cli`、`nanoclaw-cli`、`plandex-cli`、`kortix-cli`、`agenticseek-cli` 仍为 WSL/Docker/多服务复合体。
- `nous-hermes-agent`、`tabnine-cli`、`browser-use-cli` 仍依赖动态或租户安装器；`openmanus-cli`、`metagpt-framework`、`mini-swe-agent-cli`、`simular-agent-s-cli` 仍为源码/Python/浏览器或 GUI 运行时，缺固定 Windows 制品和完整生命周期合同。
- 不将源代码、安装脚本、动态 latest、API key/租户会话或远程服务当作受管 Windows 候选。
