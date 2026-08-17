# AI Hub 现代桌面 UI 框架与 Bauhaus 视觉语言选型

日期：2026-08-16

范围：`pc-client` 的 React 19 + Vite + Electron 渲染层；只做技术与产品研究，不改代码、依赖、配置，不启动服务。
证据规则：只采用官方文档、官方仓库、npm 官方包元数据和当前仓库源码；版本与发布时间快照截至 2026-08-16。

## 结论

**主推荐：Mantine 9，渐进式采用；不建议全量换框架。**

选择 Mantine 的主因不是它的默认外观，而是它能用同一套组件与状态模型补齐复杂桌面管理应用最需要的能力：固定式应用壳、导航、复杂表单、可组合筛选、命令中心、快捷键、通知、加载/失败状态和键盘操作。Mantine 9 明确要求 React 19.2+，与本仓库的 React 19.2.0 精确吻合，并有官方 Vite 路径。[Mantine 9.0 变更记录](https://mantine.dev/changelog/9-0-0/)、[Mantine Vite 指南](https://mantine.dev/guides/vite/)

Mantine 的 `AppShell` 可以保持左侧导航、顶栏与内容区位置稳定；`Spotlight` 可把搜索、跳转、打开下载中心、检查更新等高频动作集中到 `Ctrl+K`；`useHotkeys` 提供 Windows/macOS 一致的 `mod` 快捷键；`Combobox` 适合把大量筛选条件做成可搜索、可键盘操作的控件；`Notifications` 能统一下载、安装、更新的进行中/成功/失败反馈；`useForm` 支持嵌套字段、列表和同步/异步验证。[AppShell](https://mantine.dev/core/app-shell/)、[Spotlight](https://mantine.dev/x/spotlight/)、[use-hotkeys](https://mantine.dev/hooks/use-hotkeys/)、[Combobox](https://mantine.dev/core/combobox/)、[Notifications](https://mantine.dev/x/notifications/)、[use-form](https://mantine.dev/form/use-form/)

这能直接减少用户的操作步骤与认知负担：

1. 用户不必先判断功能在哪个频道，再逐层导航；`Ctrl+K` 统一搜索厂商、产品、资源、已安装项和可执行动作。
2. 顶栏、侧栏、下载/更新状态不随页面变化而漂移；同类动作始终处于相同位置。
3. 筛选器采用统一的搜索、选中、清空和键盘行为；用户不必在每个资源商店重新学习。
4. 长任务先在原位置显示状态，再进入统一任务中心；Toast 只提示结果，不承担完整任务管理，避免消息轰炸。
5. 表单验证、错误提示、焦点恢复和禁用状态由统一组件承担，减少“点击无反应”和跨页面行为不一致。

**Bauhaus 只应作为视觉语言，不应成为业务框架。** Mantine 的 Theme、CSS 变量、Styles API 和组件级默认样式允许把圆角降到 0–4px、采用严格网格、强黑白层级、红/蓝/黄功能色、粗细对比字体和几何分隔，同时保留可见焦点、错误色和状态语义。Mantine 官方允许通过主题控制字体、颜色、间距、圆角、阴影、焦点样式、组件 `classNames`/`styles`/`defaultProps`，并可扩展 CSS 变量。[Theme object](https://mantine.dev/theming/theme-object/)、[CSS variables](https://mantine.dev/styles/css-variables/)、[Styles API](https://mantine.dev/styles/styles-api/)

### 两个备选

1. **Base UI + 现有 CSS/CSS Modules**：如果最高优先级变成“完全自定义的 Bauhaus 视觉”和最低样式约束，而团队愿意自行设计 AppShell、命令中心、快捷键和任务反馈，则这是最干净的无样式底座。Base UI 支持 React 17+，无内置 CSS，兼容普通 CSS、CSS Modules、Tailwind 和 CSS-in-JS；组件遵循 WAI-ARIA，并提供状态属性和 CSS 变量。[Base UI About](https://base-ui.com/react/overview/about)、[Styling](https://base-ui.com/react/handbook/styling)、[Accessibility](https://base-ui.com/react/overview/accessibility)
2. **React Aria Components + 自有视觉层**：如果未来重点转向高密度列表、表格、树、批量选择、拖放、虚拟化和全键盘操作，它是最强的专项备选。其组件无默认样式，内建交互、国际化和辅助技术支持；Collection 模型覆盖列表、菜单、表格、树和网格的键盘导航、选择、异步数据与虚拟滚动。[React Aria Getting Started](https://react-spectrum.adobe.com/react-aria/getting-started.html)、[Collection components](https://react-spectrum.adobe.com/v3/collections.html)、[React Aria 2025-03 release](https://react-spectrum.adobe.com/v3/releases/2025-03-05.html)

## 当前仓库约束

- 当前依赖为 React 19.2.0、React DOM 19.2.0、Vite 7.3.6、Electron 43.4.0、TypeScript 5.9.3，见 [`package.json`](../../package.json)。
- 当前 UI 仍集中在单个约 12,022 行的 [`src/App.tsx`](../../src/App.tsx) 和约 4,555 行的 [`src/styles.css`](../../src/styles.css)；状态、导航和业务流程不能在一次视觉重构中整体搬迁。
- 生产数据路径和执行权限仍由 `window.aihubPC`/IPC 负责。UI 框架只能替换呈现与交互原语，不能接管目录事实源、安装授权、签名校验或更新执行。
- 当前导航使用本地 React state，而非 Router。新 AppShell 必须先复用现有 `view`/handler，再决定是否独立进行路由架构改造；框架迁移不能顺手改变业务状态机。
- 工作区已有 Tabler Icons 和一轮现代视觉覆盖。新框架应复用图标与设计令牌，避免同时引入第二套图标语言。
- Electron 没有成为这些库的单独支持目标；兼容性判断来自 React peer dependency、官方 Vite 支持以及“现代浏览器”运行边界。对 Electron 渲染进程而言没有已发现的架构性阻断，但仍需通过真实 Electron 包验证 Portal、焦点、缩放、CSP 和窗口快捷键。

## 评估方法

评分为 1–5，5 最优。重点按用户补充要求排序：

1. 复杂桌面信息架构与操作流程：导航、筛选、表单、命令面板、快捷键、状态反馈。
2. 键盘、读屏、焦点和高对比度等可访问性。
3. 保留现有业务状态、IPC 和目录投影的渐进迁移能力。
4. Bauhaus/International Style 的主题表达空间。
5. 组件成熟度、维护状态、许可证。
6. 运行时与构建成本。这里仅作架构级相对判断；没有安装候选包或制作同功能原型，因此不伪造最终 gzip 数字。npm 的 `unpackedSize` 是发布包体积，不等于客户端最终 bundle。

## 总览比较

| 候选 | 桌面工作流 | 无障碍/键盘 | Bauhaus 表达 | 渐进迁移 | 运行/构建成本 | 成熟与维护 | 结论 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| **Mantine 9** | **5** | 4.5 | 4.5 | **4.5** | 3.5 | **5** | **主推荐**：成套能力最能减少步骤与行为分裂 |
| **Base UI** | 3.5 | **5** | **5** | **4.5** | 4 | 4.5 | 备选：视觉自由最高，但应用级能力需自建 |
| **React Aria Components** | 4.5 | **5** | **5** | 3.5 | 3.5 | **5** | 备选：数据密集、集合与键盘交互最强 |
| Radix + Tailwind/shadcn | 4.5 | 4.5 | **5** | 2.5 | 4 | 5 | 设计产出快，但会同时引入 Tailwind 与复制代码维护 |
| Ark UI / Chakra UI | 4 | 4.5 | 4.5 | 3 | 3.5 | 4.5 | 能力完整，但多层抽象/样式栈不优于前三名 |
| Material UI | **5** | 4.5 | 3 | 2.5 | 3 | **5** | 很成熟，但 Material 视觉惯性与 Emotion 迁移成本高 |
| Joy UI | 4 | 4 | 4 | 2 | 3 | 1 | **淘汰**：官方已明确暂停开发 |
| Adobe Spectrum 2 | 4.5 | **5** | 2 | 2 | 2.5 | 5 | Adobe 产品一致性强，不适合独立 Bauhaus 品牌 |

## 候选详评

### 1. Mantine 9 — 主推荐

**兼容性与维护**

- Mantine 9 要求 React 19.2+，当前仓库正好是 React 19.2.0；官方提供 Vite 模板与最小 Vite 接入说明。[Mantine 9.0](https://mantine.dev/changelog/9-0-0/)、[Vite guide](https://mantine.dev/guides/vite/)
- npm 快照：`@mantine/core` 9.5.1，2026-08-02 发布，MIT；其 peer dependency 为 React/React DOM `^19.2.0`。[npm registry: @mantine/core 9.5.1](https://registry.npmjs.org/@mantine%2fcore/9.5.1)
- 官方说明交互组件使用 axe、键盘/焦点单测和 VoiceOver 人工测试；应用仍需自行保证标签、对比度和语义。[Mantine accessibility](https://help.mantine.dev/q/are-mantine-components-accessible)

**为什么适合 AI Hub**

- `AppShell` 对应固定顶栏、左侧频道、可选右侧任务详情和主内容区，能稳定信息位置。
- `Spotlight + useHotkeys` 可形成统一命令中心：导航、全局搜索、打开下载中心、查看可用更新、切换主题、返回上一层。
- `Combobox` 提供 `aria-*`、键盘事件和开放渲染，适合厂商、场景、兼容宿主、A–Z 等复合筛选。
- `useForm` 支持嵌套路径、列表、异步验证和错误状态，适合设置、资源提交、后台表单。
- `Notifications` 支持 loading 状态、更新同一通知、优先级和队列。它应连接现有任务状态，不应创建第二套业务状态。

**Bauhaus 能力**

主题可统一控制 `defaultRadius: 0`、字体、色阶、间距、阴影、焦点环、减少动画和组件默认样式；Styles API 可访问组件内部 parts。视觉上可以做到严格网格、非对称但有秩序的版式和功能性色块，而不必 fork 组件。[Theme object](https://mantine.dev/theming/theme-object/)、[Styles API](https://mantine.dev/styles/styles-api/)

**成本与风险**

- 比 headless 方案多一层默认 CSS，需要明确控制样式导入顺序，防止与现有全局 CSS 互相覆盖。
- 不应一次把 12k 行 App 组件重写成 Mantine；否则视觉升级会与状态迁移、回归故障混在一起。
- Mantine 的完整 CSS/扩展包会增加资源；应按功能引入 `core`、`hooks`、`spotlight`、`notifications`、`form`，而不是安装全部扩展。
- `AppShell` 默认使用 fixed 区域，必须实测 Electron 窗口缩放、标题栏、安全区和滚动容器。

### 2. Base UI — 备选一（最高视觉自由）

**兼容性与维护**

- Base UI 明确支持 React 17 及以上，组件无默认 CSS，可用 CSS Modules、普通 CSS、Tailwind 或 CSS-in-JS；这与当前 CSS 体系可共存。[About Base UI](https://base-ui.com/react/overview/about)、[Styling](https://base-ui.com/react/handbook/styling)
- npm 快照：`@base-ui/react` 1.7.0，2026-08-04 发布，MIT，React/React DOM peer 为 `^17 || ^18 || ^19`。[npm registry: @base-ui/react 1.7.0](https://registry.npmjs.org/@base-ui%2freact/1.7.0)
- v1.0 于 2025-12 稳定，随后持续加入 Drawer、Toast、Combobox 性能和可访问性修复；截至 2026-06 官方记录已有 35 个以上稳定无样式组件。[Base UI releases](https://base-ui.com/react/overview/releases)

**优势**

- 没有默认视觉，最容易实现真正属于枕星 AI 的 Bauhaus 系统，而不是把现成风格换颜色。
- Menu、Dialog、Popover、Tabs、NavigationMenu、Combobox、Toast、Toolbar 等可渐进替换高风险交互，不需要先改变页面布局。
- 状态通过 `data-*` 和 CSS 变量暴露，适合当前已有的 CSS token 层。

**不足**

- 没有 Mantine 式成套 AppShell、Spotlight、hotkeys 和 form store；要减少步骤，团队仍需自行设计命令模型、导航模型、快捷键冲突规则与任务反馈。
- “自由”同时意味着更多产品设计与视觉 QA 责任；如果只安装 Base UI 而不先定义信息架构，用户体验不会自动改善。

### 3. React Aria Components — 备选二（数据密集与全键盘优先）

**兼容性与维护**

- React Aria Components 是无样式组件/Hook 集合，内建无障碍、国际化、交互和行为，可用普通 CSS、Tailwind 或 CSS-in-JS。[Getting Started](https://react-spectrum.adobe.com/react-aria/getting-started.html)
- npm 快照：`react-aria-components` 1.20.0，2026-07-31 发布，Apache-2.0；其 React peer range 覆盖 React 19。[npm registry: react-aria-components 1.20.0](https://registry.npmjs.org/react-aria-components/1.20.0)
- 官方集合模型覆盖列表、菜单、表格、树、网格的键盘导航、选择、异步加载和虚拟化；拖放支持键盘和读屏输入。[Collections](https://react-spectrum.adobe.com/v3/collections.html)、[2025-06 release](https://react-spectrum.adobe.com/v3/releases/2025-06-05.html)

**优势**

- 当资源目录发展为大规模表格、树、批量选择和行内操作时，它比通用组件库更强。
- 对焦点、选择、读屏、触摸、国际化和高对比度的系统覆盖最完整。
- 可用 Autocomplete 组合可搜索菜单、Select 和命令面板。[2025-03 release](https://react-spectrum.adobe.com/v3/releases/2025-03-05.html)

**不足**

- 没有完整桌面 AppShell 与全局快捷键产品层；需要团队自行组织。
- API 和 collection abstraction 学习成本高于 Mantine，对当前单体 App 的渐进替换需要更细致的状态适配。
- 如果 AI Hub 仍以卡片目录为主而不是表格/树/批量操作，它的优势暂时无法完全兑现。

### 4. Radix Primitives + Tailwind/shadcn

Radix 是成熟的无样式、WAI-ARIA 导向 primitive，支持渐进采用和任意样式；官方 2026 版本记录继续修复 React 19.2、无障碍与 tree-shaking。[Radix introduction](https://www.radix-ui.com/primitives/docs/overview/introduction)、[Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)、[Releases](https://www.radix-ui.com/primitives/docs/overview/releases)

shadcn/ui 已完整支持 React 19 + Tailwind 4，拥有 Sidebar、Command、Data Table、Form、Toast 等可复制代码；2026-07 起 Base UI 是默认 base，同时支持 React Aria 和 Radix，多种 style preset 可快速得到更现代的视觉。[React 19/Tailwind 4](https://ui.shadcn.com/docs/tailwind-v4)、[shadcn changelog](https://ui.shadcn.com/docs/changelog)

它没有进入前三名，原因是当前仓库并未使用 Tailwind，接入会同时引入构建层、utility class、组件复制所有权和现有 4.5k 行 CSS 的共存问题。shadcn 的优势是代码归项目所有，代价也是后续安全/无障碍修复不会像普通依赖那样自动落入本地复制组件。若未来单独新建 UI 包或进行明确的前端拆分，它会重新成为强候选。

### 5. Ark UI / Chakra UI

Ark UI 提供 40+ headless 组件，基于 Zag.js 状态机，支持 React/Solid/Vue/Svelte，MIT；`data-scope`/`data-part` 便于自定义视觉。[Ark UI About](https://ark-ui.com/docs/overview/about)、[Getting Started](https://ark-ui.com/react/docs/overview/getting-started)

Chakra UI 有官方 Vite 指南，提供成套主题与 snippets，但引入 `@emotion/react` 和 provider 层；npm peer range为 React 18+，React 19 可满足。[Chakra Vite](https://chakra-ui.com/docs/get-started/frameworks/vite)、[npm registry: @chakra-ui/react 3.36.1](https://registry.npmjs.org/@chakra-ui%2freact/3.36.1)

Ark 的状态机和跨框架能力对 AI Hub 并非刚需；Chakra 又增加视觉与 Emotion 层。两者没有显示出足以抵消迁移复杂度的独特优势。

### 6. Material UI / Joy UI

Material UI v9 明确支持 React 17/18/19，有官方 Vite 示例、成熟组件、表单、导航和 Data Grid 生态；MIT，维护活跃。[Installation](https://mui.com/material-ui/getting-started/installation/)、[Versions](https://mui.com/material-ui/getting-started/versions/)、[Example projects](https://mui.com/material-ui/getting-started/example-projects/)

但它默认依赖 Emotion，Material 的视觉、密度和组件结构会持续影响定制。要实现强烈 Bauhaus 品牌，通常需要覆盖大量 slots/theme，迁移成本高于 Mantine，最终仍可能保留“Material 换肤感”。

**Joy UI 不应进入新项目。** MUI 官方在 2026 状态说明中明确 Joy UI 当前暂停、没有活跃计划或时间表；npm 最新仍是 5.0.0 beta。[MUI 2026 status](https://mui.com/blog/2026-and-beyond/)、[npm registry: @mui/joy 5.0.0-beta.52](https://registry.npmjs.org/@mui%2fjoy/5.0.0-beta.52)

### 7. Adobe React Spectrum 2

Spectrum 2 已稳定，组件与 collections 很成熟，尤其重视无障碍、国际化和大型集合；Apache-2.0。[Spectrum 2 v1.0](https://react-spectrum.adobe.com/releases/v1-0-0)、[npm registry: @react-spectrum/s2 1.6.0](https://registry.npmjs.org/@react-spectrum%2fs2/1.6.0)

但官方明确不鼓励覆盖 Spectrum 组件内部颜色、padding、border 和文字样式，推荐要自定义时改用 React Aria Components。这与独立 Bauhaus 品牌目标直接冲突。[Spectrum styling](https://react-spectrum.adobe.com/styling)

## 推荐的目标结构

```text
现有目录/IPC/安装与更新状态（保持不变）
              │
              ▼
页面级 view model / action adapter（新增薄层）
              │
              ├── AppShell / Navigation / Spotlight
              ├── Filters / Forms / Dialogs
              └── Task feedback / Notifications
              │
              ▼
Mantine primitives + 枕星 AI Bauhaus theme
              │
              ▼
Tabler Icons + 现有内容与业务 handler
```

关键原则：Mantine 组件只能消费现有状态和调用现有 handler；不能直接访问 Electron API、自己计算更新权限、自己执行安装，或复制目录事实源。

## 渐进迁移建议

### Phase 0：先固定体验合同，不换页面

- 定义唯一导航树、全局动作清单、任务状态词汇和快捷键注册表。
- 定义 Bauhaus token：网格、字号、字重、四类功能色、边框、0/2/4px 圆角、焦点环、动效时长。
- 明确每个动作的 pending/success/error/blocked 状态，以及 Toast 与任务中心的边界。

验收：用户无需知道技术频道，即可回答“我要找软件、找资源、看下载、更新全部、回到上一步分别在哪里”。

### Phase 1：最小垂直切片

只迁移以下四项：

1. `MantineProvider` 与 Bauhaus theme；
2. 一个非破坏性的 Dialog/Popover；
3. 全局 `Spotlight`，首批只做导航和搜索，不执行安装/卸载；
4. `Notifications` 只映射现有下载/更新状态。

验收：现有 IPC 调用次数、参数、目录数据、更新授权逻辑完全不变；键盘焦点、Escape、缩放和高对比度通过真实 Electron 验证。

### Phase 2：应用壳与筛选

- 使用 AppShell 替换纯布局容器，但复用现有 `view` 与导航 handler。
- 将 Skill/MCP/插件/连接器共用筛选器迁为同一 `Combobox`/chip 组合。
- 筛选条件、结果数、清空和返回动作保持可见；不把所有选择藏进弹窗。

验收：从启动到找到目标资源的点击数不增加；键盘可完成打开搜索、选择筛选、进入详情和返回。

### Phase 3：表单与长任务反馈

- 设置、提交资源、管理员软件发布表单再引入 `@mantine/form`。
- 下载、安装、更新使用一个任务状态模型；Toast 只做瞬时确认，完整进度留在下载/任务中心。
- `全部更新` 等高影响动作必须保留确认、明细、跳过与失败恢复，不用漂亮动画掩盖执行状态。

### Phase 4：删除旧样式前的门禁

- 只有当对应页面已完成视觉、键盘、屏幕阅读器、窗口缩放与 Electron 实包验收后，才删除旧 CSS。
- 每个阶段记录 production bundle 差异、首次渲染、内存、焦点回归和 CSP 日志；以真实构建数字决定是否继续，不使用 npm 包体积代替 bundle。

## Bauhaus UX 约束，而非装饰清单

- 网格服务于定位：左侧频道、顶部全局动作、右侧任务状态形成稳定坐标。
- 原色服务于语义：红色只表示危险/阻断，黄色表示等待/警告，蓝色表示主要导航/信息；不能把三原色当随机装饰。
- 大字号与粗线条只用于层级，不可挤压表单标签、状态说明和版本信息。
- 非对称构图不能破坏扫描顺序；列表/卡片的标题、状态、主操作位置必须一致。
- 几何图形不能代替文本标签；图标按钮必须有 accessible name 和 Tooltip。
- 动效只解释状态变化，必须尊重 `prefers-reduced-motion`；Mantine theme 的 `respectReducedMotion` 应开启。[Mantine Theme object](https://mantine.dev/theming/theme-object/)
- 高对比黑白并不自动等于无障碍；焦点环、禁用态、错误信息和文字对比仍需独立验证。

## 最终决策

1. **采用 Mantine 9 作为交互与应用壳框架候选，先做一个垂直切片。**
2. **不做全量换框架，不重写业务状态，不改变 IPC/安装/更新边界。**
3. **视觉上建立枕星 AI 自有 Bauhaus theme，不采用 Mantine 默认主题作为成品。**
4. 若垂直切片表明 Mantine CSS 与现有体系冲突不可控，退回 **Base UI + CSS Modules**。
5. 若后续主要痛点变成大规模表格、树、批量选择和全键盘数据操作，在相应页面局部采用 **React Aria Components**，不必全局换掉 Mantine。

在当前仓库形态下，“Mantine 渐进接管复杂交互 + 自有 Bauhaus 主题 + 保留业务逻辑”比“整体迁入 shadcn/Tailwind”或“纯 headless 全部自建”更能同时提高设计感、操作便捷性和交付可控性。

## 官方一手资料索引

- Mantine：[v9.0](https://mantine.dev/changelog/9-0-0/)、[Vite](https://mantine.dev/guides/vite/)、[AppShell](https://mantine.dev/core/app-shell/)、[Spotlight](https://mantine.dev/x/spotlight/)、[Hotkeys](https://mantine.dev/hooks/use-hotkeys/)、[Combobox](https://mantine.dev/core/combobox/)、[Forms](https://mantine.dev/form/use-form/)、[Notifications](https://mantine.dev/x/notifications/)、[Theme](https://mantine.dev/theming/theme-object/)、[npm registry](https://registry.npmjs.org/@mantine%2fcore/9.5.1)
- Base UI：[About](https://base-ui.com/react/overview/about)、[Styling](https://base-ui.com/react/handbook/styling)、[Accessibility](https://base-ui.com/react/overview/accessibility)、[Releases](https://base-ui.com/react/overview/releases)、[npm registry](https://registry.npmjs.org/@base-ui%2freact/1.7.0)
- Radix/shadcn/Tailwind：[Radix](https://www.radix-ui.com/primitives/docs/overview/introduction)、[Radix releases](https://www.radix-ui.com/primitives/docs/overview/releases)、[shadcn React 19/Tailwind 4](https://ui.shadcn.com/docs/tailwind-v4)、[shadcn changelog](https://ui.shadcn.com/docs/changelog)、[Tailwind Vite](https://tailwindcss.com/docs/installation/using-vite)
- Ark/Chakra：[Ark About](https://ark-ui.com/docs/overview/about)、[Ark React](https://ark-ui.com/react/docs/overview/getting-started)、[Chakra Vite](https://chakra-ui.com/docs/get-started/frameworks/vite)
- MUI/Joy：[Installation](https://mui.com/material-ui/getting-started/installation/)、[Versions](https://mui.com/material-ui/getting-started/versions/)、[2026 status](https://mui.com/blog/2026-and-beyond/)
- React Aria/Spectrum：[React Aria](https://react-spectrum.adobe.com/react-aria/getting-started.html)、[Collections](https://react-spectrum.adobe.com/v3/collections.html)、[Spectrum 2 v1.0](https://react-spectrum.adobe.com/releases/v1-0-0)、[Spectrum styling](https://react-spectrum.adobe.com/styling)
