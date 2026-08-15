# 枕星 AI 首页轮播与视觉重设计研究

日期：2026-08-05  
范围：PC 首页视觉与 Banner 轮播规格；不改变目录、安装或身份逻辑。

## 一手资料与可采用结论

1. [Fluent 2 Color](https://fluent2.microsoft.design/color) 将中性色用于表面、文字和层级，品牌色只承担强调；因此枕星 AI 不应继续以荧光绿填满 Hero，而应以大面积夜海中性面建立阅读层级，冷青只用于焦点与可操作元素。
2. [Fluent 2 Design tokens](https://fluent2.microsoft.design/design-tokens) 将原始色值和语义别名分层，并让主题切换使用同一组语义 token；因此本方案定义 `surface-*`、`text-*`、`accent-*` 等语义 token，而不在组件中散落色值。
3. [W3C WAI Carousel Tutorial](https://www.w3.org/WAI/tutorials/carousels/) 要求用户可以停止/恢复自动运动、使用键盘操作，并确保变化能被理解；因此轮播必须提供可见暂停控制、前后按钮和圆点选择器。
4. [W3C APG Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) 要求自动轮播在鼠标悬停或焦点进入时停止，且除非用户主动恢复，否则不重启；因此这些暂停条件不是可选的“微交互”。
5. [W3C Technique C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39) 说明应尊重 `prefers-reduced-motion`；因此系统偏好减少动画时，轮播默认静止，并以淡入/无动画切换而非位移动画。

## 三个原型方向

| 方向 | 结构 | 气质 | 结论 |
| --- | --- | --- | --- |
| A. 星图观测台（选定） | 左侧阅读面 + 右侧全高星图；文字始终为 HTML 覆盖 | 冷静、可信、面向工具发现 | 兼顾参考图的清晰阅读区和枕星 AI 的夜空身份；适合厂商优先入口。 |
| B. 信号控制台 | 顶部超宽全景图 + 下方紧凑操作带 | 高密度、偏专业工作台 | 信息效率高，但首屏广告感更强，弱化品牌的“陪伴式发现”。 |
| C. 轨道编辑页 | 单栏大图文 + 垂直缩略导航 | 内容化、偏杂志 | 适合官网专题，作为 PC 工具中心首页会牺牲目录入口的即时性。 |

## 选定方向：星图观测台

- 不再使用荧光绿作为品牌主色。主背景为深海军蓝，星空紫承担氛围，冷青只用于焦点、进度和主按钮。
- 亮色主题为雾白/蓝灰大面，深色主题为深海底色；两者共享语义 token，避免“亮色一套、深色另一套”的分裂风格。
- 每张 slide 使用无文字 SVG/摄影背景；标题、描述和操作全部为 HTML，保证可翻译、可缩放、可读屏。
- Hero 的阅读区域固定在 46% 左右，视觉区域占约 54%；窄屏改为上下堆叠，先文字后图片。

## 轮播交互与无障碍规格

后台提供 `slides[]`，单项为：

```ts
type HomeSlide = {
  imageUrl: string;
  title: string;
  description: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  sort: number;
  enabled: boolean;
};
```

- 客户端只显示 `enabled === true` 的排序结果；不得把页面正文、中文标语或客户端命令下放到图片中。
- 容器是带可见标签的 carousel region；每张 slide 有可理解的名称和位置。
- 自动切换建议 7 秒，仅在轮播至少两张时启用；提供明确的“暂停自动播放/开始自动播放”按钮。
- 鼠标悬停、键盘焦点进入轮播后立即暂停，且不会自动恢复；用户显式点击恢复才继续。
- 支持左右按钮、圆点直接选择、键盘 `ArrowLeft` / `ArrowRight`；触摸以水平滑动切换，滑动阈值为容器宽度的 12%。
- `prefers-reduced-motion: reduce` 时禁用自动播放与位移动画；切换为静态或短淡入。
- `aria-live`：自动播放时为 `off`，手动切换后为 `polite`；控制按钮使用原生 `button`。

## 最终视觉 token（供前端实现）

| Token | 亮色 | 暗色 | 用途 |
| --- | --- | --- | --- |
| `--zx-surface-canvas` | `#F5F7FB` | `#08111F` | 页面底色 |
| `--zx-surface-raised` | `#FFFFFF` | `#101C2E` | 卡片、导航 |
| `--zx-surface-hero` | `#E9EEF8` | `#0C1930` | Hero 阅读区 |
| `--zx-text-primary` | `#13213A` | `#F3F7FF` | 主文字 |
| `--zx-text-secondary` | `#52627A` | `#B2C0D8` | 说明文字 |
| `--zx-accent` | `#087E8B` | `#49D6DD` | 主操作、焦点、活动圆点 |
| `--zx-accent-strong` | `#065C68` | `#8AE8EA` | 按下/高亮 |
| `--zx-atmosphere` | `#5B4B9A` | `#8774D8` | 星空紫，仅用于氛围 |
| `--zx-line` | `#D6DEEB` | `#253550` | 分隔线 |

- 间距：4、8、12、16、24、32、48、64 px。
- 圆角：控件 10px，卡片 16px，Hero 24px。
- 阴影：亮色 `0 18px 54px rgba(24, 40, 68, .10)`；暗色 `0 20px 60px rgba(0, 0, 0, .28)`。
- Hero 尺寸：桌面最小 440px / 推荐 500px；宽度至少 1024px 时为双栏；小于 760px 时为垂直布局，图片区 240–300px。

## 本地 SVG 背景资产建议

以下是无文字、可生产化的矢量背景，均在 throwaway prototype 中供视觉判断：

- `pc-client/prototypes/home-carousel-2026-08-05/assets/constellation.svg`：品牌首页与厂商发现。
- `pc-client/prototypes/home-carousel-2026-08-05/assets/aurora-grid.svg`：桌面与本地工具发现。
- `pc-client/prototypes/home-carousel-2026-08-05/assets/orbit-network.svg`：生态资源商店。

它们只包含形状、渐变与纹理；上线时应迁入受控静态资源目录、经过浅/深色对比验证，并由后台 slide 的 `imageUrl` 引用。
