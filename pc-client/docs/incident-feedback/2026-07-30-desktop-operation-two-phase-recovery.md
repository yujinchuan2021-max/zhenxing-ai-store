# 安装与卸载操作的两阶段持久恢复

## 用户风险

旧版已经能在安装程序打开后保存安装验证任务，但仍有两个确定性缺口：

1. 安装器先观察两秒、再创建验证任务。若 AI Hub 在这两秒内退出，厂商程序可能已经启动，客户端却没有任何可恢复记录。
2. 卸载结果轮询仍由 React 页面拥有。刷新页面或重启客户端会丢失卸载身份，并可能被“仍已安装”或迟到的下载事件覆盖。

这两个缺口都会诱导用户重复打开安装器或卸载器，不能靠按钮防抖解决。

## 修复

### 一个主进程操作协议

安装与卸载统一由 `shared/desktop-operation.cjs` 管理。每个产品只有一个活动桌面操作，页面只消费不可变快照：

```text
begin -> launching -> monitoring -> installed / uninstalled
                            \-----> timed-out
```

- `desktop-operations.json` 保存版本化 envelope、每产品单调递增的 `generation` 和活动操作。
- 操作身份由 `generation + operationId` 组成；`revision` 只在同一身份内递增。
- 终态写成事件后只保留 generation tombstone，下一次操作不会因系统时钟回拨而排在旧事件之前。
- 旧 `desktop-install-verifications.json` 会一次性迁移为第一代安装操作；旧文件只作为迁移来源，不再作为运行时状态。

### 启动前先落盘

- 用户确认且安装包或卸载器通过最终签名检查后，主进程先原子写入 `launching / pending`，成功后才允许创建进程。
- 子进程触发 `spawn` 时立即写入 `monitoring / confirmed`，随后继续两秒启动观察。
- 若进程在观察窗口内异常退出，操作记录会安全清理，并保留明确退出码。
- 若客户端恰好在进程创建附近退出，重启会把持久的 `launching` 恢复为 `monitoring / unknown` 并开始检测；不会自动重启第三方程序。
- `.exe` 安装器和可信卸载器共用无 Shell 的启动帮助器、隔离环境以及可区分的“安装程序/卸载程序”错误文本。

### 卸载也由主进程恢复

- 卸载器打开后，主进程每 5 秒验证一次 Windows 证据；页面刷新、窗口关闭和客户端重启都不会取消任务。
- 只有可信状态变成 `absent` 才发出 `uninstalled`；扫描失败属于 `unknown`，仍不宣称成功。
- 超时任务保持可恢复、可手动检测，检测次数最多 120 且不会写出 121。
- 安装与卸载在异步注册表扫描、验签和确认对话框开始前就占用同一产品入口，避免两次点击或安装/卸载交叉启动。
- 普通 `desktop:status` 查询不再拥有或释放卸载互斥。

### 页面收敛规则

- 页面按 `generation + operationId + revision` 接受快照，不再使用可能回拨的 `startedAt` 排序。
- 活动卸载优先于“仍已安装”，活动安装/卸载都优先于已完成下载。
- 迟到的低代安装成功事件、下载完成事件和旧页面的手动检测都不能覆盖新一代卸载。
- 手动检测必须携带完整 generation 和 operationId；主进程拒绝无身份或身份不匹配的请求。
- 收到 `uninstalled` 后重新读取主进程校验过的下载证据：安装包仍在则回到“点击安装”，否则回到下载入口。

## 自动化验证

- `tests/desktop-operation.test.cjs` 覆盖启动前原子落盘、启动确认/失败、安装与卸载的相反终态证据、崩溃恢复、超时恢复、旧记录迁移、时钟回拨、迟到结果、通知异常、写盘失败和严格手动身份。
- `tests/installer-launch.test.cjs` 覆盖 spawn 回调先于观察结果、隔离环境、安装/卸载标签、立即退出和回调异常隔离。
- 旧安装验证器回归补充了饱和 120 次后跨重启稳定、最终仍可成功以及通知异常不阻断调度。
- 完整 Node 回归：121 项全部通过；TypeScript、Vite production build、Electron main/preload 语法检查通过。
- Playwright 真实页面覆盖：
  - 安装操作跨刷新保持同一身份和截止时间，且不会重新启动安装器；
  - 第二代卸载即使 startedAt 早于第一代，也能压过迟到的第一代安装成功事件；
  - 卸载跨刷新保持身份，手动检测携带完整身份；
  - 迟到下载事件不覆盖活动操作，卸载终态恢复可信安装包入口；
  - 页面错误和控制台错误均为 0。
- 新 NSIS 安装包完成隔离安装、启动、卸载和残留检查：安装/卸载退出码均为 0，安装目录、隔离用户数据、注册表项与快捷方式全部恢复。
- Setup SHA-256：`AAE7E5F06EA5B53F5347FEFCEE2E5AAF023453D2F1E93002D42F9C02848AE9D5`。
- 当前构建仍未配置 AI Hub 自身代码签名证书，Windows 会把安装包显示为 `NotSigned`；这与客户端对第三方安装器执行的 Authenticode 验证是两个独立边界。
- 视觉产物：
  - `output/playwright/desktop-operation-uninstall-restored.png`
  - `output/playwright/desktop-operation-uninstalled-restored-download.png`

## 验收边界

自动化证明了协议、页面恢复和 AI Hub 自身安装包生命周期，但没有擅自安装或卸载用户电脑上的 ComfyUI/Ollama。真实厂商安装向导、注册表字段、卸载器签名以及“启动后重启 AI Hub”的实机链路，仍需用户使用本次新安装包完成一次验收。
