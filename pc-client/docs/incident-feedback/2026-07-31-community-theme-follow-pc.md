# 内置社区主题没有跟随 PC 端

日期：2026-07-31

## 用户反馈

内置 Flarum 社区使用自己的自动深浅色和蓝灰色主题，与 PC 客户端当前选择的白色或黑色主题不一致。

## 证据

- PC 端处于白色主题时，社区仍可能根据 Windows 系统偏好显示深色。
- 社区按钮、链接、搜索框、刷新按钮和帖子标题区域使用 Flarum 默认蓝灰色，而 PC 端主色是绿色。
- WebView 是独立文档，外层 `.pcApp[data-theme]` 选择器不会跨越 WebView 边界。

## 根因

客户端只在 PC 外壳维护 `light` / `dark` 状态，没有把该状态同步给隔离的 Flarum WebView。Flarum 因而继续使用 `colorScheme=auto` 和服务端配置的默认主色。

## 被推翻的假设

- “PC 外层切换 `data-theme` 后 WebView 会自然继承”不成立。WebView 有独立的 DOM、样式表和颜色方案。
- “只切换 Flarum 的浅色/深色属性就足够”不成立。它仍会保留蓝色主按钮和灰色帖子标题区域，视觉上并未真正跟随 PC。

## 修复

- 把 PC 当前主题作为固定枚举传入社区组件。
- WebView `dom-ready` 后同步 Flarum 的 `data-theme`，并写入仅由客户端定义的白色、黑色两套 CSS 变量。
- 同步背景、文字、弱化文字、边框、控件、搜索框、按钮、链接和绿色主色。
- 帖子标题区域在白色主题使用浅绿色，在黑色主题使用深绿色。
- 刷新按钮改用社区主题变量，不再固定成深色。
- 用户在设置中切换白色或黑色时，已打开的社区即时更新，不重新登录或刷新页面。
- WebView 尚未触发 `dom-ready` 时，客户端不会提前调用 `executeJavaScript`；同步会在就绪事件后重试，避免 React 根节点因 Electron 同步异常被卸载。

## 自动化验证

真实 Electron 回归验证：

- 白色主题：社区背景 `#f3f7f4`、主色 `#a8ff56`、帖子标题区域 `#e7fbd7`。
- 黑色主题：社区背景 `#0e1916`、主色 `#a8ff56`、帖子标题区域 `#143c32`。
- 打开设置并点击“黑色”后，PC 外壳与已加载的 WebView 均切换为黑色。
- 两个主题下搜索栏旁的刷新按钮都使用对应控件背景。
- 主题同步后原有刷新、原生帖子互动和无白边铺满回归继续通过。

截图：

- `output/playwright/personal-center-embedded-community.png`
- `output/playwright/personal-center-embedded-community-dark.png`

## 剩余用户验收

安装新版本后，在社区保持打开的状态下进入设置，来回切换白色和黑色，确认社区与 PC 外壳同步变化且不需要重新登录。

## 防回归门禁

`scripts/test-personal-center-community.mjs` 必须同时验证白色、黑色的主题标识、背景、主色、标题区域，以及运行时切换。WebView 在 `dom-ready` 之前抛出执行错误时不得清空 React 根节点。
