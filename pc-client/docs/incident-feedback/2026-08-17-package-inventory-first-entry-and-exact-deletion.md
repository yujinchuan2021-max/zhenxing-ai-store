# 2026-08-17：安装包首次识别与单包状态误清空

## 用户现象

- 已配置的下载目录中存在多个安装包，但“安装包管理”首次进入显示为空。
- 删除一个安装包后，界面表现得像全部安装包都消失。
- 进入页面或处理一个包时会连带触发环境、软件更新和本地产品等无关扫描，反馈缓慢。

## 根因

1. 页面进入时从 React 闭包里的旧 `downloadTasks` / `managedDownloadQueueTasks` 计算产品 ID；启动队列尚未返回时，该集合为空。
2. 主进程只会从既有 `download-records.json` / `managed-download-tasks.json` 恢复安装包，不会发现下载目录中已存在但缺少收据的安装包。
3. 删除确认框关闭后窗口会重新获得焦点，触发 `refreshManagedDownloadQueue()`。该刷新和单项队列应用都把公开队列中的产品从 `downloadTasks` 删除；但 `downloadTasks` 同时承担经过主进程复核的完成任务证据。安装包投影要求“公开队列为 downloaded + 完成任务证据为 completed”同时成立，因此一次回焦会把所有仍存在的兄弟卡片从界面投影中清空。后台记录、任务和物理文件并未被整表删除。
4. 主进程删除顺序原为“先写入去掉目标的整份记录，再删除文件”；文件被占用或拒绝访问时只能尝试回滚整份记录，扩大了一个目标文件失败时的状态写面。
5. `openInstalledManagement()` 调用了完整管理刷新，把安装包清单与软件更新、环境和本地安装盘点耦合在一起。

## 修复

- 新增深模块 `shared/managed-package-inventory.cjs`：只扫描配置下载目录的直接子文件，只接受已审核产品的固定文件名（含受控数字后缀）、有效 Windows 签名和可选固定 SHA-256；陌生文件、符号链接、子目录文件和无审核签名的产品全部忽略。
- 新增单一公开接口 `discoverDownloadedPackages(candidates)`。首次进入“已安装”时每个客户端会话只调用一次；手动刷新可显式重跑。
- 发现成功后才原子合并该产品的完成收据，并复用既有任务恢复路径；以后进入不重复哈希已可信的收据。
- 进入“已安装”只刷新安装包清单，不再触发其他频道。完整扫描保留给用户主动点击“刷新状态”。
- 删除、清除或卸载只更新目标 `productId`。只有后端明确返回该目标删除成功后，渲染层才移除该产品的队列投影。
- 队列同步对仍为 `downloaded` 的产品保留其 `completed` 完成任务证据；活动、失败或取消任务仍可清掉旧证据。任务中心在展示层按 `productId` 隐藏已有公开队列投影的旧任务，既不重复显示，也不破坏安装包安全投影。
- “Skill、MCP 与插件”恢复区在正常无本地资源时不再渲染空白大卡片；仅在确有受管资源或扫描错误时显示。资源仍从详情页执行精确卸载，最后一条收据删除后该恢复区自动消失；离线目录缺失和异常收据的兜底能力保留。
- 主进程先删除经过收据、哈希与路径门禁确认的精确目标文件，并确认文件确实不存在，随后才原子写入去掉该目标的记录和任务。删除失败时不发生任何状态写入，目标和所有兄弟记录保持原字节。
- 当前没有通用目录字段可安全表达证书主体；Canva 与 Hermes 的本地发现签名使用固定审核表。后续 vendor-controlled 产品必须先补审核签名，不能因为文件名相似就自动导入。

## 验证与防回退

- 真实 RED：preload 缺少发现接口；主进程发现调用返回非数组；页面入口仍调用全量刷新。
- 单包删除 RED：模拟目标文件被占用时，旧实现的事件序列为“两次记录写入 + 一次删除失败 + 两次回滚写入”；修复后的期望且实际序列只有一次目标 `unlink`，记录、任务和两个物理文件均保持不变。
- 全表误清空 RED：真实 Electron 夹具先显示两个已验证安装包，精确删除其中一个，再模拟原生确认框关闭后的窗口回焦；旧实现稳定失败于 `deleting one package must preserve every sibling package card after focus refresh`。修复后同一流程 GREEN，剩余兄弟卡片继续显示。
- `tests/managed-package-inventory.test.cjs`：验证两个受信任直接子文件被发现，未知 EXE 不进入，编号后缀可恢复，签名/哈希生成可信收据，未知 vendor-controlled 产品 fail-closed。
- `tests/managed-download-queue-ipc.test.cjs`：验证首次发现两个安装包后删除一个，另一个文件、任务和收据全部保留。
- `tests/download-task-presentation.test.cjs`：锁定 `downloaded` 队列不得清除完成任务证据，并锁定任务中心只做展示去重；不再使用漏过 `delete next[task.productId]` 的旧正则。
- 本轮修复后的聚焦 Node 测试 24/24 PASS；真实 Electron 删除/回焦流程 PASS，宽屏与窄屏均无越界且控制台 0 错误。TypeScript/Vite production build PASS。
- 对用户实际目录做只读识别演练：Canva、ChatGPT、Hermes、OpenClaw 四个文件均通过当前文件名、Authenticode 与哈希门禁，并分别映射到四个独立 `productId`；OpenClaw SHA-256 精确匹配客户端固定值。未在本次诊断中删除、移动或执行任何用户安装包。
- 对当前客户端真实 `userData` 做只读复核：Claude 已被精确移除；`download-records.json` 与 `managed-download-tasks.json` 仍保留 OpenClaw、Hermes、Canva、Qwen 四个产品，四个目标文件也全部存在。这证明用户看到的“全部消失”是前端证据投影被回焦刷新破坏，而不是后台把全部记录或文件真正删除。
- 最终限定回归 68/68 PASS，生产 build 与 TypeScript lint PASS。包含后续安装文案与空资源区收敛的本地 review-only 0.1.100 候选位于 `release-review-server-connected-0.1.100-candidate`；Setup SHA-256 为 `c29421ef0732035b7c0e3a2ea6e922b29ed1f094871a1a1c7bf73b2d1401705b`，Portable SHA-256 为 `fe42cf909ab759e89204be113758bfb470fc3829926f5012a4353005bda6441f`，清单 4/4 复算一致。上一完整候选保存在 `.pre-installing-label-empty-extension-section`，Git 上传保持暂停。
- 首次重封在启动固定 Inno 7.1.0 编译器时遇到一次瞬时 `spawnSync EPERM`；失败目录只含控制文件并以 `.failed-iscc-eperm` 后缀保留。编译器 SHA、签名、ACL、无 MotW 和 Node 原生启动均复核通过后，唯一受控重试成功，未关闭系统防护或放宽目录权限。

## 剩余验收

- 覆盖封包后，由用户在现有真实目录做最终 GUI 验收：首次进入应看到四个包；删除其中一个后只消失该条；重新进入仍保留其余兄弟卡片。
- 该验收不授权安装、卸载或执行这些第三方安装包。
- 两个 EXE 当前均为 `NotSigned`，只用于本地 review，不代表正式签名、分发或发布授权。
