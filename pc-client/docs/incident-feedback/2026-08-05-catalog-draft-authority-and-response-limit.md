# 目录草稿事实源与远程响应上限漂移

日期：2026-08-05

## 现象与证据

- `admin/data/catalog-v1.json` 有 614 个产品，而 revision store 的 draft revision 74 有 615 个产品；活动目录为 v71。
- 两份目录同为 schema v2。磁盘目录的 `updatedAt` 为 `2026-08-04T00:00:00.000Z`，早于 store draft 的 `2026-08-04T09:56:14.260Z`，因此不能以文件 mtime 或内容差异推断磁盘内容更新。
- 当前草稿与签名目录均超过旧客户端读取上限 1 MiB，导致已签名且结构正确的目录可能在读取前被拒绝。

## 根因

后台初始化只在磁盘目录 schema 升级时才经 revision store 同步；同 schema 的已声明新草稿被静默忽略。客户端目录读取上限则是 Electron 调用点的孤立常量，未形成共享的发布合同。

## 修复

- revision store 是运行中草稿的唯一事实源；磁盘目录仅作为输入。只有 schema 更高，或同 schema 且目录 `updatedAt` 明确晚于 store draft 时，后台才以精确 revision 通过 `saveDraft()` 同步。内容不同、文件 mtime 或相同时间戳都不会自动覆盖状态。
- 目录发布响应上限统一为 2 MiB，并由客户端读取调用共享常量；底层流式读取仍在超过上限时取消并拒绝响应。

## 验证

`node --test tests/admin-draft-sync.test.cjs tests/limited-response.test.cjs`：4 通过，0 失败。

## 剩余验收

发布员工仍需在隔离服务中确认：较新的同 schema 草稿经后台同步后 revision 正确递增；当前 v71 目录能被封包客户端读取；超过 2 MiB 的 HTTPS 响应被拒绝。此次修复未发布目录、封包或修改现有 state/history。

## 2026-08-05 补充：官网入口迁移空提交

- 根因：`applyProductModule(product, moduleId)` 返回替换后的新对象，不会原地修改传入的 product。首次 revision 75 的迁移调用未接收返回值，因此只保存了环境下载源补齐，126 个候选仍保持 package-manager 策略。
- 回归门禁：任何批量模块迁移在 `saveDraft()` 前必须断言替换数、深比较变更数和候选 URL 匹配数均等于候选数，并断言非候选产品深比较不变；保存后再次断言目标 module/policy/profile 组合。revision 76 已按该门禁完成 126/126 迁移，未发布、未签名且未改 active/history 或磁盘草稿。

## 2026-08-05 补充：本地 HTTPS 目录 502

- 根因：Caddy 的目录和厂商图标代理仍指向 Compose 服务名 `admin:4173`。旧 `local-admin-1` 停止后，该名称不再对应目录权威服务，而宿主 Node 后台仍在 `127.0.0.1:4173` 提供 active v72，导致 `https://localhost:4443/catalog-release.json` 返回 502。
- 处置：仅将这两条 Caddy 上游改为 Docker Desktop 宿主地址 `host.docker.internal:4173`，并重载 Caddy；不启动旧 admin 容器，也不修改 draft、active 或 history。
- 回归门禁：先以 `curl.exe -k -f -sS https://localhost:4443/catalog-release.json` 复现和验证，再用签名验证及规范化 envelope SHA-256 对比 4443 与 4173；验证通过前不得将 Caddy 指回旧容器。

## 2026-08-05 补充：0.1.40 本地验收包目录 502

### 用户可见现象

- UI 正常渲染，但首页“精选 AI 厂商”为空；“全部 AI 厂商”显示 0 个，并提示“厂商目录暂不可用 / 远程目录返回 502”。

### 红色反馈环与证据

- 从 `release-review-0.1.40-complete/ZhenXing-AI-Local-0.1.40-Windows-x64-Portable.exe` 启动隔离 Electron/CDP 会话后，真实 `window.aihubPC.getCatalog()` 返回 `{ source: "unavailable", catalog: null, error: "远程目录返回 502" }`。renderer console、Network 与 exception 均没有前端异常；截图和观测 JSON 保存在临时验收产物目录。
- 包内 `resources/catalog/channel.json` 的受信任 release URL 为 `https://localhost:4443/catalog-release.json`。该 HTTPS 端点实际返回 502；同一时刻 `http://127.0.0.1:4173/catalog-release.json` 返回 200，`/ready` 报告 active v72。
- Caddy 日志明确记录 `lookup admin on 127.0.0.11:53: no such host`。`local-admin-1` 已以 exit 137 停止，release-server 因找不到 Compose 网络内的 `admin:4173` 持续 unhealthy。

### 根因与边界

- 这是本地发布拓扑失配：Caddy 正确代理 Compose 服务名 `admin:4173`，但运行中的后台是宿主机 127.0.0.1:4173，Compose admin 服务不在网络中；宿主后台不能被 Caddy 的 Compose DNS 解析。
- 前端、打包 channel、目录 schema 和 UI 错误态均未伪造数据，故本次不修改 UI 或前端目录回退。恢复 Compose admin 服务会与现有宿主 4173 端口绑定冲突，须由发布/后台所有者在保持单一目录权威的前提下恢复拓扑后，重新运行 HTTPS 与封包客户端验收。

### 2026-08-05 恢复验证

- 发布/后台侧将 Caddy 的 `/catalog-release.json` 与 `/vendor-icons/*` 上游持久切换为 `host.docker.internal:4173`，只热重载 `local-release-server-1`；未启动旧 admin，未修改 draft 83、active v72、history、客户端 channel 或签名 key。
- `curl.exe -k -f -sS https://localhost:4443/catalog-release.json` 已返回 200 和 `application/json; charset=utf-8`。HTTPS 与 4173 返回同一 864637-byte 已签名 envelope，规范化 SHA-256 均为 `1321cf4507ed601fc201ed13a7ceadb9b542b51375e9f7ac6b7099d2f280b6b8`。
- 同一 0.1.40 Portable 的隔离 CDP 绿验中，`catalog:get` 返回 `source: remote`、375 个厂商、615 个产品、146 项资源；进入“全部 AI 厂商”后渲染 283 张目录投影卡。未见 catalog error。
- `scripts/check-packaged-catalog.mjs` preventive gate: before success it verifies HTTPS 200/JSON, signature, normalized SHA, the actual Portable request to the embedded channel URL, remote `getCatalog`, non-empty vendors/products, and rendered vendor cards without 502/unavailable text. DOM readiness is polled; `test:packaged-catalog-gate` proves a 502 target exits non-zero. URL overrides require an explicit test flag.
- 2026-08-05 follow-up: a long-running `scripts/start-local-admin.cjs` process may retain an older catalog schema and return HTTP 400 for a newer revision-store draft even though the current source validates it. `scripts/check-local-admin-draft.cjs` now compares `/api/catalog` with the authoritative revision store and fails before acceptance packaging; restart the exact local admin process to load the current schema, never rewrite the disk seed or active/history.
- Draft84 compatibility gate: the released 0.1.40 Portable rejects a valid signed catalog containing the new top-level `homeCarousel` field with `source=unavailable` and `目录结构无效`. Do not publish this schema to the existing channel until the release protocol provides an old-client-compatible projection or a separately versioned channel; staging must be restored to active v72 after this red result.

## 2026-08-05 补充：v2 首页轮播正式资源 404 与图片失败布局

### 用户可见现象与证据

- v2 active 目录中的三张受控轮播图为 `/assets/home-carousel/constellation.svg`、`aurora-grid.svg`、`orbit-network.svg`；本地 `4173` 与 HTTPS `4443` 请求均返回 404。
- 三个 SVG 当时只存在于 `prototypes/home-carousel-2026-08-05/assets`，正式 `public/dist` 没有对应文件。渲染器原先直接把目录路径交给 `<img>`，未处理加载失败；在 `file:` 包内根路径会解析为 `file:///assets/...`，并裸露 `alt`、保留空媒体栏。

### 根因与被排除的猜测

- 根因是批准的静态资产未进入正式前端构建资源，叠加目录 `/assets` 路径没有相对包入口解析和图片失败状态机。
- 不是 slide 文案/ID、目录投影或后台 schema 问题；签名目录仍是唯一数据源。开发服务器还暴露了既有 CJS `navigation-back` 导出错误，但生产预览验证未复现该错误，故未将其混入本修复。

### 最小修复与门禁

- 将三张批准 SVG 纳入 `public/assets/home-carousel/`；共享解析器只接受受控 `/assets/home-carousel/*` 或无凭据 HTTPS，并以 `document.baseURI` 解析包内资源，禁止 `file:///assets` 和任意 `file:` URL。
- 轮播图片使用 `alt=""`/`aria-hidden`；`onError` 隐藏媒体并给 Hero 加单栏失败态，`onLoad` 恢复双栏；控制器固定为上一张→圆点→下一张→文字暂停/播放。完成态 ZIP 显示“点击打开压缩包”，安装器显示“点击安装”。
- 红测先验证构建缺少资产、解析函数不存在和失败态缺失；修复后 `npm.cmd run build`、相关单测全绿。隔离 Playwright 生产预览在 1365×768 与 740×768 真实渲染并截屏；主动派发 `error` 后媒体和 img 均移除、无 alt 裸露。

### 剩余验收

- 仍需发布/后台员工先将受控静态资产随签名目录正式交付，并在真实 v2 active 包中复验 1440/1180/1024/768/<760、浅深色和 reduced-motion；本轮未改 catalog、state、saveDraft、发布或封包。

## 2026-08-12 补充：轮播圆点命中区与英文目录数据边界

### 用户反馈与根因

- 轮播已移除无意义的播放按钮并将翻页箭头移到横幅两侧，但圆点按钮本体仍直接使用 18×5、活动态 28×8 的视觉尺寸；既有 fixture 只验证焦点、角色和 `aria-current`，没有验证鼠标命中区。
- 根因是视觉胶囊尺寸与交互按钮尺寸共用同一个盒子，导致按钮可操作但指针命中区不足 24×24。

### 最小修复与验证

- 保持非活动/活动视觉分别为 18×5 与 28×8，把视觉移到按钮伪元素；按钮本体在两种状态下均至少为 24×24，现有焦点样式、圆点组语义和轮播逻辑不变。
- 同一无输出 Electron fixture 在亮/暗主题及 1365/740 下验证按钮矩形、视觉尺寸、真实鼠标点击切换、键盘切换和唯一 `aria-current`；前端聚焦测试与生产 build 通过后才重新冻结。

### 未解决边界

- 当前签名目录并非所有首页轮播、商店、产品和资源描述都提供稳定的英文对应字段。前端只翻译自有固定文案，不机器翻译、不按条目硬编码；完整英文数据仍需后台定义并交付受签名保护的本地化字段合同。
- 本轮不改目录、后台、主进程、preload 或 shared，也不封包；隔离 fixture 不能替代真实用户机验收。
