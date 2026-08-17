# 客户端窗口控制与彩蛋误关闭

## 用户反馈

- Windows 原生关闭按钮悬停时出现整块红色区域，三个窗口按钮的点击范围也与客户端顶部视觉不协调。
- 品牌区连续点击五次出现彩蛋后，点击遮罩空白处会直接关闭，用户容易误触跳过内容。

## 根因

- Electron 的原生 Windows Caption Button 由系统绘制，关闭按钮的红色悬停语义不能通过客户端 CSS 改成与最小化、最大化一致的小型中性反馈。
- Mantine `Modal` 默认允许遮罩点击和 Esc 触发 `onClose`；原实现把该回调直接连接到关闭状态。

## 修复

- 主窗口改为 `frame: false`，在现有可拖动顶部栏登录按钮右侧提供三个 34 × 30 的自绘窗口按钮。三者共用同一中性 hover/pressed 视觉，关闭按钮不再使用红色或危险色。
- renderer 只能通过 preload 暴露的无参数 IPC 请求操作当前发送窗口；main 使用 `BrowserWindow.fromWebContents(event.sender)` 定位窗口，不接受任意窗口标识。
- 彩蛋禁用遮罩点击与 Esc 关闭，移除通用 `onClose` 状态变更；只有“哈哈，知道啦”按钮能关闭。

## TDD 与验证

- 窗口按钮测试先在旧 `titleBarOverlay` 上取得 RED，再锁定 frameless 窗口、三条 preload/main IPC、三个可访问按钮、34 × 30 点击区和无红色样式后 GREEN。
- 彩蛋测试先命中旧 `onClose={() => setBrandEasterEggOpen(false)}`，随后锁定 `closeOnClickOutside={false}`、`closeOnEscape={false}`、空操作 `onClose` 与唯一确认按钮后 GREEN。
- `tests/modern-ui-shell.test.cjs` 与安装器专属测试联合 30/30 PASS；TypeScript/Vite production build、lint、main/preload 语法检查均通过。

## 剩余验收

- 仍需在新本地审核包中实际验证拖动、最小化、最大化/还原、关闭到托盘，以及彩蛋的遮罩和 Esc 不关闭行为。
- 自动测试与浏览器预览不能替代真实 Windows 封包验收；Git 上传保持暂停，直到用户审核通过。
