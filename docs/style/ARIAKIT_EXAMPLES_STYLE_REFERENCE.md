# Ariakit Examples Style Reference

> Historical reference only as of 2026-03-13. This document is kept for visual archaeology and comparison, not as an active implementation authority. New modules must follow `docs/style/STYLE_SYSTEM.md`, `docs/style/STYLE_ARCHITECTURE.md`, active ADRs, and the mock-first testing workflow.

目的：将 [Ariakit Examples](https://ariakit.org/examples) 固化为 AI-MarkDone 后续 UI 设计迁移的外部风格基线。

适用范围：页面内 UI、浮层、菜单、对话框、表单控件、工具栏、提示层。

更新日期：2026-03-07

数据来源：

- 入口页：`https://ariakit.org/examples`
- 扫描结果：`docs/style/_ariakit_examples_scan.json`
- 扫描范围：59 个 `/examples/*` 页面，13 个分类
- 官方样式指南：`https://ariakit.org/guide/styling`
- 官方组合指南：`https://ariakit.org/guide/composition`

---

## 1. 历史参考规则

- 本文档不再作为新模块方案输入，也不参与当前样式权威链路。
- 只有在需要回溯历史视觉判断或比较旧参考时，才读取本文档。
- 如 Ariakit 示例与项目红线冲突，必须保留 Ariakit 的视觉关系，但实现上改用 `--aimd-*` tokens，不能硬编码颜色/尺寸。
- 本文档分为两层：
  - `Observed`：从 Ariakit 页面直接提取到的结构、样式、源码规律。
  - `Normalized`：为了迁移到本项目而抽象出的实现模板，不等同于逐字复制源码。
- examples 主要回答“长什么样”和“局部 CSS 怎么组织”。
- examples 不足以单独回答“哪些状态选择器可安全依赖”、“哪些 DOM 结构是公共 API”。
- 这部分必须以 Ariakit 官方 `Styling` / `Composition` 指南为准，并在本文档中固化为本地实现规则。

---

## 2. 覆盖范围

### 2.1 分类总览

| 分类 | 页面数 |
|:---|---:|
| Checkbox | 3 |
| Combobox | 12 |
| Dialog | 13 |
| Disclosure | 1 |
| Form | 2 |
| Hovercard | 1 |
| Menu | 9 |
| Menubar | 1 |
| Popover | 4 |
| Select | 8 |
| Tab | 3 |
| Toolbar | 1 |
| Tooltip | 1 |

### 2.2 源码可见性

- 共扫描 `59` 页。
- `47` 页可见 `style.css`。
- `12` 页未暴露可见样式源码，需以页面结构与其同族示例推断：
  - `/examples/combobox-filtering-integrated`
  - `/examples/combobox-tabs`
  - `/examples/dialog-combobox-command-menu`
  - `/examples/dialog-combobox-tab-command-menu`
  - `/examples/dialog-hide-warning`
  - `/examples/disclosure-animated`
  - `/examples/menu-nested-combobox`
  - `/examples/menubar-navigation`
  - `/examples/select-combobox-tab`
  - `/examples/select-next-router`
  - `/examples/tab-panel-animated`
  - `/examples/tab-react-router`

### 2.3 页面结构

Observed:

1. 列表页按组件类别分组。
2. 详情页统一为：
   - `H1` 标题
   - 一段简短说明
   - tags
   - 实时预览
   - 源码 tabs
   - “Learn more” 内容区
   - Related examples
3. 站点壳层使用 Next.js App Router，页面主体大量使用 Tailwind utility class。
4. 示例内容本身主要依赖独立 `style.css`，而不是完全依赖 Tailwind。

结论：后续迁移时，应把 Ariakit 当作“App Shell + Local Example CSS Primitive”的双层体系，而不是单一设计系统。

---

## 3. 全局视觉基因

### 3.1 颜色

Observed 高频颜色：

| 角色 | Light | Dark | 说明 |
|:---|:---|:---|:---|
| 主强调色 | `hsl(204 100% 40%)` | `hsl(204 100% 64%)` | 焦点、主链接、选中强调 |
| 强调色 hover/pressed | `hsl(204 100% 35%)` | `hsl(204 100% 80% / 0.4)` | hover、ring、弱选中 |
| 主文本 | `black` | `white` | 默认文本 |
| 次级深色面板 | `hsl(204 20% 94%)` | `hsl(204 4% 16%)` | tooltip / panel / dark surface |
| 边框浅色 | `hsl(204 20% 88%)` | `hsl(204 4% 24%)` | popover/menu/dialog 边框 |
| 页面 hover 背景 | `hsl(204 20% 99%)` | `hsl(204 4% 6%)` | 输入、按钮 hover |
| 深背景输入面 | `white` | `hsl(204 4% 8%)` | 输入框、按钮面 |
| 遮罩 | `rgb(0 0 0 / 0.1)` | `rgb(0 0 0 / 0.3)` | backdrop |

补充色：

- 危险态主要出现为红色系：`hsl(357 56% 50%)`、`hsl(357 56% 42%)`
- 极少量紫色出现在个别示例，不构成全站主视觉

Normalized 迁移规则：

- 只继承 Ariakit 的色彩关系，不直接照搬硬编码值。
- AI-MarkDone 中应映射为：
  - `--aimd-color-accent`
  - `--aimd-color-surface`
  - `--aimd-color-surface-elevated`
  - `--aimd-color-border`
  - `--aimd-color-text-primary`
  - `--aimd-color-text-secondary`
  - `--aimd-color-overlay`

### 3.2 尺寸与节奏

Observed 高频尺寸：

| 维度 | 高频值 |
|:---|:---|
| 主控件高度 | `2.5rem` |
| 小控件高度 | `1.5rem`, `1.75rem` |
| 主圆角 | `0.5rem` |
| 次圆角 | `0.375rem`, `0.25rem` |
| 常用间距 | `0.5rem` |
| 次间距 | `0.25rem` |
| 常用内边距 | `0.5rem`, `1rem` |
| 基础字体 | `1rem / 1.5rem` |
| 小号字体 | `0.875rem / 1.25rem` |

结论：

- Ariakit 示例整体是紧凑但不拥挤的中密度界面。
- 交互控件高度高度统一，能明显提升组合组件的一致性。

### 3.3 阴影与层次

Observed 高频层次：

- 触发器按钮：内阴影 + 顶部高光 + 底部压边
- 浮层容器：`0 10px 15px -3px` + `0 4px 6px -4px`
- 大型模态：`0 25px 50px -12px`
- Dark 模式下仅增加黑色透明度，不改视觉结构

结论：

- Ariakit 的“立体感”主要靠 box-shadow 叠层，而不是大面积渐变。
- 视觉重点是“清晰边界 + 轻体积感”，不是拟物。

### 3.4 局部 CSS Variables 原型

Observed 高频局部变量：

| 原变量 | Light 常见值 | Dark 常见值 | 作用 |
|:---|:---|:---|:---|
| `--border` | `rgb(0 0 0/13%)` | `rgb(255 255 255/10%)` | 默认内描边 |
| `--border` hover | `rgb(0 0 0/33%)` | `rgb(255 255 255/25%)` | hover 边界增强 |
| `--highlight` | `rgb(255 255 255/20%)` | `rgb(255 255 255/5%)` | 顶部高光 |
| `--shadow` | `rgb(0 0 0/10%)` | `rgb(0 0 0/25%)` | 内压边和外部轻阴影 |
| `--inset` | `0.75rem` | `0.75rem` | dialog inset / viewport safe area |
| `--border-color` | `black` | `rgba(0, 0, 0, 0.8)` | 少量边框覆盖场景 |
| `--border-width` | `1px`, `2px` | `1px`, `2px` | 选中和强调边框 |

Normalized 映射建议：

| Ariakit 局部变量 | AI-MarkDone Token |
|:---|:---|
| `--border` | `--aimd-color-border-strong` |
| `--highlight` | `--aimd-color-surface-highlight` |
| `--shadow` | `--aimd-color-shadow-soft` |
| `--inset` | `--aimd-space-overlay-inset` |
| `--border-color` | `--aimd-color-border` |
| `--border-width` | `--aimd-border-width-default` / `--aimd-border-width-strong` |

结论：

- Ariakit 示例并没有建立大型全局 token 词典，而是大量使用“组件局部变量 + 稳定视觉公式”。
- 我们迁移时不应复制变量名，应复制“变量角色”。

### 3.5 动效节奏

Observed：

| 属性 | 高频值 | 用途 |
|:---|:---|:---|
| `transition-duration` | `150ms` | checkbox、dialog、select 等基础动效 |
| `transition-duration` | `200ms` | combobox animated |
| `animation-duration` | `200ms` | enter/exit 弹层 |
| timing function | `cubic-bezier(0.4, 0, 0.2, 1)` | 全站主过渡曲线 |
| backdrop blur | `blur(4px)` | dialog / responsive popover |

迁移规则：

- 基础组件统一优先 `150ms`。
- 浮层进入/离开可提高到 `200ms`，但不要更慢。
- 不要引入无意义的弹簧动画，Ariakit 主站更偏短促、克制、明确。

### 3.6 属性频率摘要

Observed 高频样式属性：

| 属性 | 频次观察 | 结论 |
|:---|:---|:---|
| `background-color` | 极高 | 所有状态都靠底色变化 |
| `box-shadow` | 极高 | 层次核心，不可省略 |
| `border-radius` | 极高 | 几乎所有交互元素都有圆角 |
| `gap` | 极高 | 组合组件大量靠 flex gap 排布 |
| `outline-*` | 很高 | 焦点态是第一等公民 |
| `overscroll-behavior` | 中高 | 浮层滚动边界控制明确 |
| `backdrop-filter` | 中 | 模态/浮层使用克制玻璃感 |

结论：

- Ariakit 不是“纯 flat UI”。
- 其 UI 识别度来自四件事：圆角、描边、阴影、焦点 ring。

---

## 4. Ariakit 官方实现约束补充

当前参考文件如果只看 examples，仍不足以覆盖后续实现真正需要的信息。以下内容基于 Ariakit 官方指南补充，后续实现必须一起参考。

### 4.1 安全选择器边界

官方 `Styling` 指南明确要求：

- 不要依赖未列入文档的选择器
- 不要用 `role` 等内部实现属性作为 CSS 选择器
- 应使用 `className`、自定义 `data-*` 或官方公开状态属性

对本项目的含义：

- 后续 UI 重构必须优先依赖我们自己的类名和 token
- 若参考 Ariakit 交互状态，只允许使用其公开状态属性
- 禁止把“examples 当前恰好长这样”的 DOM 结构当成长期契约

### 4.2 公开状态属性

官方 `Styling` 指南列出的安全状态属性包括：

- `[aria-checked]`
- `[aria-disabled]`
- `[aria-expanded]`
- `[aria-invalid]`
- `[data-active]`
- `[data-active-item]`
- `[data-open]`
- `[data-enter]`
- `[data-leave]`
- `[data-focus-visible]`
- `[data-user-value]`
- `[data-autocomplete-value]`

对本项目的含义：

- 这批属性可以作为交互状态语义的参考来源
- 具体视觉仍要映射到 `--aimd-*` token，不直接照搬颜色值
- `data-focus-visible`、`data-enter`、`data-leave` 对后续焦点和进出场动效尤其重要

### 4.3 官方公开 CSS Variables

官方 `Styling` 指南还公开了若干布局变量，例如：

- `--dialog-viewport-height`
- `--popover-anchor-width`
- `--popover-available-height`
- `--popover-available-width`
- `--popover-overflow-padding`
- `--popover-transform-origin`
- `--scrollbar-width`

对本项目的含义：

- 后续若重构 dialog / popover / menu / tooltip，不应只参考静态尺寸
- 还要为可用空间、锚点尺寸、transform origin、滚动条宽度预留对应的 component token 或布局规则
- 这部分是当前 examples 扫描无法完整覆盖的，需要以官方指南补足

### 4.4 Composition 对样式的影响

官方 `Composition` 指南说明：

- Ariakit 组件可通过 `render` 更换底层 HTML 元素
- 也可以渲染为自定义组件
- 因此样式不应强绑定某个固定标签结构

对本项目的含义：

- component token 必须围绕组件角色，而不是标签类型
- 不能把 button / input / textarea / link 的标签差异直接编码进全局样式语义
- 这也进一步要求 system token 描述角色、component token 描述组件语义，而不是 DOM 结构

---

## 5. 关键组件原型

### 4.1 Raised Button Primitive

Observed:

- 高度统一为 `2.5rem`
- 圆角多为 `0.5rem`
- 使用内部描边和高光制造轻微抬起感
- `:active` 时通过 `padding-top: 0.125rem` 和阴影变化制造按压感
- 焦点状态依赖 `[data-focus-visible]`

Normalized CSS:

```css
.aimd-ref-button {
  --border: var(--aimd-color-border-strong);
  --highlight: var(--aimd-color-surface-highlight);
  --shadow: var(--aimd-color-shadow-soft);
  display: inline-flex;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 0;
  border-radius: 0.5rem;
  padding-inline: 1rem;
  background: var(--aimd-color-surface);
  color: var(--aimd-color-text-primary);
  box-shadow:
    inset 0 0 0 1px var(--border),
    inset 0 2px 0 var(--highlight),
    inset 0 -1px 0 var(--shadow),
    0 1px 1px var(--shadow);
  outline: 2px solid transparent;
  outline-offset: 2px;
}

.aimd-ref-button[data-focus-visible] {
  outline-color: var(--aimd-color-accent);
}

.aimd-ref-button:active,
.aimd-ref-button[data-active] {
  padding-top: 0.125rem;
  box-shadow:
    inset 0 0 0 1px var(--border),
    inset 0 2px 0 var(--border);
}
```

### 4.2 Text Input / Combobox Primitive

Observed:

- 输入框高度常与按钮对齐
- 采用 `outline + inset shadow`，不是重边框
- placeholder 明显降对比
- dark 模式改背景、边框和 placeholder，不改结构

Normalized CSS:

```css
.aimd-ref-input {
  height: 2.5rem;
  border: 0;
  border-radius: 0.375rem;
  padding-inline: 1rem;
  background: var(--aimd-color-surface);
  color: var(--aimd-color-text-primary);
  box-shadow:
    inset 0 0 0 1px var(--aimd-color-border),
    inset 0 2px 5px 0 var(--aimd-color-shadow-soft);
  outline: 1px solid transparent;
  outline-offset: -1px;
}

.aimd-ref-input::placeholder {
  color: var(--aimd-color-text-secondary);
}

.aimd-ref-input[data-focus-visible],
.aimd-ref-input[data-active-item] {
  outline-width: 2px;
  outline-color: var(--aimd-color-accent);
}
```

### 4.3 Menu / Popover / Select Surface

Observed:

- 容器通常为 `0.5rem` 圆角
- 细边框 + 中等阴影
- `z-index: 50`
- 内部滚动区常有 `max-height`
- item hover / active 由浅底色块表达，而不是只改字色

Normalized CSS:

```css
.aimd-ref-surface {
  position: relative;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: min(var(--popover-available-height, 300px), 300px);
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--aimd-color-border);
  border-radius: 0.5rem;
  background: var(--aimd-color-surface-elevated);
  color: var(--aimd-color-text-primary);
  box-shadow:
    0 10px 15px -3px var(--aimd-color-shadow-strong),
    0 4px 6px -4px var(--aimd-color-shadow-soft);
}

.aimd-ref-item[data-active-item],
.aimd-ref-item[aria-selected="true"] {
  background: var(--aimd-color-accent-soft);
}
```

### 4.4 Dialog / Modal

Observed:

- backdrop 常带 `blur(4px)`
- 对话框面板使用大圆角、边框和较强投影
- 动画主要是 opacity + translate/scale，时长通常 `150ms` 到 `200ms`

Normalized CSS:

```css
.aimd-ref-backdrop {
  background: var(--aimd-color-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.aimd-ref-dialog {
  position: fixed;
  inset: var(--aimd-dialog-inset, 1rem);
  margin: auto;
  width: min(32rem, calc(100vw - 2rem));
  border: 1px solid var(--aimd-color-border);
  border-radius: 1rem;
  background: var(--aimd-color-surface-elevated);
  box-shadow: 0 25px 50px -12px var(--aimd-color-shadow-strong);
}
```

### 4.5 Tooltip

Observed:

- tooltip 是最轻量的浮层
- 常见 `0.375rem` 圆角
- 小字号 `0.875rem`
- 不追求大阴影，只保留边框和轻阴影

Normalized CSS:

```css
.aimd-ref-tooltip {
  border: 1px solid var(--aimd-color-border-muted);
  border-radius: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: var(--aimd-color-surface-subtle);
  color: var(--aimd-color-text-primary);
  font-size: 0.875rem;
  line-height: 1.25rem;
  box-shadow: 0 1px 2px 0 var(--aimd-color-shadow-soft);
}
```

### 4.6 Tab Primitive

Observed：

- tab 本身比按钮更平
- 未选中状态靠 hover 底色
- 选中态直接使用 accent 实底
- `aria-selected="true"` 是核心状态源

Normalized CSS:

```css
.aimd-ref-tab-list {
  display: flex;
  gap: 0.5rem;
}

.aimd-ref-tab {
  display: inline-flex;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  padding-inline: 1rem;
  border-radius: 0.25rem;
  color: var(--aimd-color-text-primary);
  text-decoration: none;
  outline: 2px solid transparent;
  outline-offset: 2px;
}

.aimd-ref-tab:hover {
  background: var(--aimd-color-surface-hover);
}

.aimd-ref-tab[aria-selected="true"] {
  background: var(--aimd-color-accent);
  color: var(--aimd-color-text-on-accent);
}
```

### 4.7 Checkbox Card Primitive

Observed：

- checkbox 示例有两种路线：
  - “button-like checkbox”
  - “card-like custom checkbox”
- custom checkbox 更适合 AI-MarkDone 的设置项和批量选择行

Normalized CSS:

```css
.aimd-ref-checkbox-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem 1rem 1rem;
  border: 2px solid var(--aimd-color-border-muted);
  border-radius: 0.5rem;
  background: var(--aimd-color-surface);
  box-shadow:
    0 1px 3px 0 var(--aimd-color-shadow-soft),
    0 1px 2px -1px var(--aimd-color-shadow-soft);
  outline: 4px solid transparent;
}

.aimd-ref-checkbox-card[data-checked="true"] {
  border-color: var(--aimd-color-accent);
}

.aimd-ref-checkbox-card[data-focus-visible] {
  outline-color: var(--aimd-color-accent-soft);
}
```

### 4.8 Toolbar Primitive

Observed：

- toolbar 按钮比通用按钮更扁、更轻
- 常见 `0.25rem` 圆角
- secondary 按钮倾向透明背景，仅 hover 时显底色

Normalized CSS:

```css
.aimd-ref-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: 0.5rem;
  background: var(--aimd-color-surface-elevated);
}

.aimd-ref-toolbar-button {
  min-width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.25rem;
}

.aimd-ref-toolbar-button[data-variant="secondary"] {
  background: transparent;
  box-shadow: none;
}

.aimd-ref-toolbar-button[data-variant="secondary"]:hover {
  background: var(--aimd-color-surface-hover);
}
```

---

## 5. 状态表达规则

Observed 高频属性选择器：

| 选择器 | 作用 |
|:---|:---|
| `[data-active]` | 按压态、选中态、激活按钮 |
| `[data-focus-visible]` | 键盘焦点 ring |
| `[aria-disabled="true"]` | 禁用态降透明度 |
| `[data-active-item]` | 列表中的当前活动项 |
| `[aria-selected="true"]` | tabs/select/menu 选中项 |
| `[data-enter]`, `[data-leave]` | 进入与退出动画 |

迁移规则：

- 优先使用组件状态属性，而不是额外类名切换。
- 键盘焦点必须独立于 hover 呈现。
- `disabled` 不应只降饱和度，至少还要降不透明度或降低阴影对比。

### 5.1 状态到视觉变化矩阵

| 状态 | 常见视觉动作 | 不应做的事 |
|:---|:---|:---|
| hover | 加深边框、加浅底色、提高下层阴影对比 | 只改 cursor 不改视觉 |
| active | `padding-top: 0.125rem` + 压平内阴影 | 做成过重的 scale 动画 |
| focus-visible | 独立 outline / ring | 用 hover 替代焦点 |
| selected | 实底 accent 或轻底 accent-soft | 只改字重 |
| active-item | 行高亮，保持列表扫描性 | 与 selected 完全同色导致无法区分 |
| disabled | `opacity: 0.5` 左右 | 直接 `display: none` |
| open | 浮层显现、trigger 进入 active 视觉 | 改掉 trigger 的尺寸或位置 |

---

## 6. 暗色模式规则

Observed:

- 几乎所有示例使用 `:where(.dark, .dark *)` 覆盖 dark token
- dark 模式不改 spacing / radius / layout，只改颜色、边框、阴影强度
- dark 背景普遍落在 `hsl(204 4% 16%)` 及更暗区间

Normalized 迁移规则：

- 我们在 Shadow DOM 内不复刻 `.dark`，而应通过 `data-aimd-theme` 或 token 注入完成同样效果。
- 暗色实现必须遵守“结构不变、只换 token”的原则。

### 6.1 Light/Dark 对照原则

| 层级 | Light | Dark | 迁移原则 |
|:---|:---|:---|:---|
| 输入/按钮面 | 白底 | 低亮灰蓝底 | 保持相同内阴影结构 |
| 浮层面 | 白底 + 浅边框 | 深灰蓝底 + 深边框 | 保持边界清晰 |
| hover | 更浅底 | 更亮的透明白叠层 | 不改密度 |
| overlay | 黑 10% | 黑 30% | dark 遮罩更重 |
| text-secondary | 黑 60% | 白 46% 左右 | 保持占位文本可读但退后 |

---

## 7. 代码结构模式

Observed:

- 例子几乎都采用“小型组合 primitives + 一份局部 style.css”
- 交互逻辑在 `index.tsx`，复杂抽象拆到 `menu.tsx`、`dialog.tsx`、`tabs.tsx` 等局部文件
- 多数组合控件共享同一视觉壳层，只改内容与状态属性

推荐的 AI-MarkDone 落地方式：

1. 在组件层保留 Ariakit 风格的 primitive 分层：
   - Trigger
   - Input
   - Surface
   - Item
   - Backdrop
2. 在样式层统一映射成 `--aimd-*` tokens。
3. 避免为单个页面重写一套完全不同的圆角、阴影、按钮风格。

Normalized JSX pattern:

```tsx
export function AimdReferenceMenu() {
  return (
    <>
      <button className="aimd-ref-button">Open</button>
      <div className="aimd-ref-surface" role="menu">
        <input className="aimd-ref-input" placeholder="Search..." />
        <button className="aimd-ref-item" data-active-item>
          First action
        </button>
      </div>
    </>
  );
}
```

### 7.1 文件组织模式

Observed：

- 基础页：
  - `index.tsx`
  - `style.css`
- 复杂组合页：
  - `index.tsx`
  - `*.tsx` primitive wrappers
  - `style.css`
  - `data.ts` / `list.ts`
- 框架路由页：
  - `layout.tsx`
  - `page.tsx`
  - `tabs.tsx` / `dialog.tsx` / `router-select.tsx`
  - `style.css`

推荐落地：

- 交互逻辑与样式入口仍按上面组织。
- 视觉壳层统一抽到共享 primitives，而不是每个功能块重新发明 `.button` / `.popover` / `.tooltip`。

### 7.2 推荐类名词典

这些类名在 Ariakit 示例中反复出现，适合作为本项目内部 primitive 命名参考：

| 角色 | Ariakit 常见类名 | 本项目建议 |
|:---|:---|:---|
| 主触发器 | `.button` | `.aimd-ui-button` |
| 输入 | `.combobox`, `.input` | `.aimd-ui-input` |
| 浮层 | `.menu`, `.popover`, `.dialog` | `.aimd-ui-surface` |
| 列表项 | `.menu-item`, `.select-item` | `.aimd-ui-item` |
| 小标签/说明 | `.label`, `.description` | `.aimd-ui-label`, `.aimd-ui-description` |
| 包裹层 | `.wrapper`, `.toolbar` | `.aimd-ui-group`, `.aimd-ui-toolbar` |

---

## 8. 迁移到 AI-MarkDone 时必须保留的风格约束

- 保留统一控件高度，优先 `2.5rem`
- 保留中小圆角体系：`0.375rem` / `0.5rem` / `1rem`
- 保留蓝色焦点系统，而不是改成任意品牌色
- 保留边框 + 阴影的双层层次，不要扁平化成纯描边
- 保留 dark mode 的低饱和灰蓝基底
- 保留列表类浮层的紧凑密度与清晰 active item 高亮
- 保留 backdrop blur 的轻玻璃感

### 8.1 Codex 执行约束

后续如果让 Codex 按本文档生成 UI，应明确要求：

1. 优先复用 Ariakit 风格 primitive，而不是为页面单独发明视觉系统。
2. 所有颜色、尺寸、阴影必须落到 `--aimd-*` tokens。
3. 默认控件高度从 `2.5rem` 开始，不要任意增高。
4. 焦点态必须可见，并独立于 hover。
5. 浮层统一使用边框 + 阴影 + 0.5rem 圆角。
6. dark mode 只换 token，不改单元结构。

---

## 9. 不应直接照搬的部分

- 不能直接复制硬编码颜色到项目源码
- 不能把示例中的 `outline: none !important` 带入项目
- 不能把 Ariakit 的类名体系当作项目 API
- 不能把 Plus 页面中缺失的源码误当成完整规范

### 9.1 项目红线修正

Observed：

- 个别示例存在 `outline: none !important`。

本项目处理：

- 这是 Ariakit 示例的局部写法，不可直接进入 AI-MarkDone。
- 一律改为可审计的 token 化 outline/focus 实现。

---

## 10. 推荐映射到本项目 Token 的最小集合

| Ariakit 视觉角色 | AI-MarkDone Token 建议 |
|:---|:---|
| Accent blue | `--aimd-color-accent` |
| Accent soft background | `--aimd-color-accent-soft` |
| Base surface | `--aimd-color-surface` |
| Elevated surface | `--aimd-color-surface-elevated` |
| Subtle surface | `--aimd-color-surface-subtle` |
| Border | `--aimd-color-border` |
| Strong border | `--aimd-color-border-strong` |
| Primary text | `--aimd-color-text-primary` |
| Secondary text | `--aimd-color-text-secondary` |
| Overlay | `--aimd-color-overlay` |
| Soft shadow | `--aimd-color-shadow-soft` |
| Strong shadow | `--aimd-color-shadow-strong` |

### 10.1 扩展 Token 集合

为保证后续页面不用再临时补 token，建议扩展为：

| Token | 用途 |
|:---|:---|
| `--aimd-color-accent` | 主强调色 |
| `--aimd-color-accent-hover` | accent hover / active |
| `--aimd-color-accent-soft` | 选中弱底色 / focus halo |
| `--aimd-color-text-on-accent` | accent 实底上的文本 |
| `--aimd-color-surface` | 标准控件面 |
| `--aimd-color-surface-hover` | hover 面 |
| `--aimd-color-surface-subtle` | tooltip / 轻卡片面 |
| `--aimd-color-surface-elevated` | popover / dialog / toolbar 面 |
| `--aimd-color-surface-highlight` | 顶部高光 |
| `--aimd-color-border` | 默认边框 |
| `--aimd-color-border-muted` | 弱边框 |
| `--aimd-color-border-strong` | 强边框 / raised button 内描边 |
| `--aimd-color-text-primary` | 主文本 |
| `--aimd-color-text-secondary` | placeholder / 次文本 |
| `--aimd-color-overlay` | backdrop |
| `--aimd-color-shadow-soft` | 小阴影 |
| `--aimd-color-shadow-strong` | 浮层阴影 |
| `--aimd-space-control-x` | `1rem` 级水平内边距 |
| `--aimd-space-control-gap` | `0.5rem` 级按钮内容间距 |
| `--aimd-radius-sm` | `0.25rem` |
| `--aimd-radius-md` | `0.375rem` |
| `--aimd-radius-lg` | `0.5rem` |
| `--aimd-radius-xl` | `1rem` |
| `--aimd-size-control-md` | `2.5rem` |
| `--aimd-duration-fast` | `150ms` |
| `--aimd-duration-enter` | `200ms` |

### 10.2 建议 Token 样板

```css
:host,
[data-aimd-theme] {
  --aimd-color-accent: hsl(204 100% 40%);
  --aimd-color-accent-hover: hsl(204 100% 35%);
  --aimd-color-accent-soft: hsl(204 100% 40% / 0.25);
  --aimd-color-text-on-accent: white;
  --aimd-color-surface: white;
  --aimd-color-surface-hover: hsl(204 20% 99%);
  --aimd-color-surface-subtle: hsl(204 20% 94%);
  --aimd-color-surface-elevated: white;
  --aimd-color-surface-highlight: rgb(255 255 255 / 20%);
  --aimd-color-border: hsl(204 20% 88%);
  --aimd-color-border-muted: rgb(0 0 0 / 0.3);
  --aimd-color-border-strong: rgb(0 0 0 / 0.13);
  --aimd-color-text-primary: black;
  --aimd-color-text-secondary: rgb(0 0 0 / 0.6);
  --aimd-color-overlay: rgb(0 0 0 / 0.1);
  --aimd-color-shadow-soft: rgb(0 0 0 / 0.1);
  --aimd-color-shadow-strong: rgb(0 0 0 / 0.25);
  --aimd-space-control-x: 1rem;
  --aimd-space-control-gap: 0.5rem;
  --aimd-radius-sm: 0.25rem;
  --aimd-radius-md: 0.375rem;
  --aimd-radius-lg: 0.5rem;
  --aimd-radius-xl: 1rem;
  --aimd-size-control-md: 2.5rem;
  --aimd-duration-fast: 150ms;
  --aimd-duration-enter: 200ms;
}

[data-aimd-theme="dark"] {
  --aimd-color-accent: hsl(204 100% 40%);
  --aimd-color-accent-hover: hsl(204 100% 32%);
  --aimd-color-accent-soft: hsl(204 100% 80% / 0.4);
  --aimd-color-surface: hsl(204 4% 8%);
  --aimd-color-surface-hover: hsl(204 4% 6%);
  --aimd-color-surface-subtle: hsl(204 4% 16%);
  --aimd-color-surface-elevated: hsl(204 4% 16%);
  --aimd-color-surface-highlight: rgb(255 255 255 / 5%);
  --aimd-color-border: hsl(204 4% 24%);
  --aimd-color-border-muted: rgb(255 255 255 / 0.3);
  --aimd-color-border-strong: rgb(255 255 255 / 0.1);
  --aimd-color-text-primary: white;
  --aimd-color-text-secondary: rgb(255 255 255 / 46%);
  --aimd-color-overlay: rgb(0 0 0 / 0.3);
  --aimd-color-shadow-soft: rgb(0 0 0 / 0.15);
  --aimd-color-shadow-strong: rgb(0 0 0 / 0.25);
}
```

---

## 11. 代表性原始片段

这些片段来自 Ariakit 示例源码，用来说明它们的组件组合方式。用于参考结构，不建议直接逐字复制到项目中。

### 11.1 Custom Checkbox 结构

来源：`/examples/checkbox-custom`

```tsx
<label
  className="checkbox"
  data-checked={checked}
  data-focus-visible={focusVisible || undefined}
>
  <Ariakit.VisuallyHidden>
    <Ariakit.Checkbox
      clickOnEnter
      onFocusVisible={() => setFocusVisible(true)}
      onBlur={() => setFocusVisible(false)}
    />
  </Ariakit.VisuallyHidden>
  <div className="check" data-checked={checked}>
    <svg viewBox="0 0 16 16" height="1em" width="1em">
      <polyline points="4,8 7,12 12,4" />
    </svg>
  </div>
</label>
```

提炼：

- 真实 input 被隐藏，但状态仍由语义组件驱动。
- 容器和图标分别接收 `data-checked`，方便精确控制视觉。

### 11.2 Animated Dialog 结构

来源：`/examples/dialog-animated`

```tsx
const dialog = Ariakit.useDialogStore();

<>
  <Ariakit.Button onClick={dialog.show} className="button">
    Show modal
  </Ariakit.Button>
  <Ariakit.Dialog
    store={dialog}
    backdrop={<div className="backdrop" />}
    className="dialog"
  >
    <Ariakit.DialogHeading className="heading">Success</Ariakit.DialogHeading>
    <Ariakit.DialogDismiss className="button">OK</Ariakit.DialogDismiss>
  </Ariakit.Dialog>
</>
```

提炼：

- backdrop 单独作为节点注入。
- trigger 和 dismiss 复用同一按钮 primitive。

### 11.3 Menu + Combobox 结构

来源：`/examples/menu-combobox`

```tsx
<Ariakit.ComboboxProvider resetValueOnHide setValue={setValue}>
  <Ariakit.MenuProvider>
    <Ariakit.MenuButton className="button">
      Add block
      <Ariakit.MenuButtonArrow />
    </Ariakit.MenuButton>
    <Ariakit.Menu className="menu">
      <Ariakit.MenuArrow />
      <Ariakit.Combobox className="combobox" autoSelect />
      <Ariakit.ComboboxList className="combobox-list">
        <Ariakit.ComboboxItem className="menu-item" />
      </Ariakit.ComboboxList>
    </Ariakit.Menu>
  </Ariakit.MenuProvider>
</Ariakit.ComboboxProvider>
```

提炼：

- 复杂组合控件依旧由极少数 primitives 搭起来。
- `button`、`menu`、`combobox`、`menu-item` 四个视觉角色非常稳定。

### 11.4 Router-driven Tabs 结构

来源：`/examples/tab-next-router`

```tsx
<Tabs>
  <TabList>
    <Tab href="/previews/tab-next-router">Hot</Tab>
    <Tab href="/previews/tab-next-router/new">New</Tab>
  </TabList>
  <TabPanel>{props.tabs}</TabPanel>
</Tabs>
```

提炼：

- 路由控制的 tab 也没有特殊视觉体系。
- 只是在逻辑层包装，视觉层仍然是 tab primitive。

### 11.5 Tooltip + Motion 结构

来源：`/examples/tooltip-framer-motion`

```tsx
<Ariakit.TooltipProvider store={tooltip} hideTimeout={250}>
  <Ariakit.TooltipAnchor {...props} ref={ref} />
  <AnimatePresence>
    {mounted && (
      <Ariakit.Tooltip
        gutter={4}
        alwaysVisible
        className="tooltip"
        render={<motion.div initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} />}
      >
        <Ariakit.TooltipArrow />
        {description}
      </Ariakit.Tooltip>
    )}
  </AnimatePresence>
</Ariakit.TooltipProvider>
```

提炼：

- motion 只是渲染壳层，不替代 tooltip primitive。
- 这和本项目的动画接入方式应保持一致。

---

## 12. 附录：页面清单

### Checkbox

- `/examples/checkbox-as-button`
- `/examples/checkbox-custom`
- `/examples/checkbox-group`

### Combobox

- `/examples/combobox-animated`
- `/examples/combobox-cancel`
- `/examples/combobox-disclosure`
- `/examples/combobox-filtering`
- `/examples/combobox-filtering-integrated`
- `/examples/combobox-group`
- `/examples/combobox-links`
- `/examples/combobox-multiple`
- `/examples/combobox-radix`
- `/examples/combobox-radix-select`
- `/examples/combobox-tabs`
- `/examples/combobox-textarea`

### Dialog

- `/examples/dialog-animated`
- `/examples/dialog-backdrop-scrollable`
- `/examples/dialog-combobox-command-menu`
- `/examples/dialog-combobox-tab-command-menu`
- `/examples/dialog-details`
- `/examples/dialog-framer-motion`
- `/examples/dialog-hide-warning`
- `/examples/dialog-menu`
- `/examples/dialog-nested`
- `/examples/dialog-radix`
- `/examples/dialog-react-router`
- `/examples/dialog-react-toastify`
- `/examples/dialog-next-router`

### Other

- `/examples/disclosure-animated`
- `/examples/form-radio`
- `/examples/form-select`
- `/examples/hovercard-disclosure`
- `/examples/menu-combobox`
- `/examples/menu-context-menu`
- `/examples/menu-framer-motion`
- `/examples/menu-item-checkbox`
- `/examples/menu-item-radio`
- `/examples/menu-nested`
- `/examples/menu-nested-combobox`
- `/examples/menu-slide`
- `/examples/menu-tooltip`
- `/examples/menubar-navigation`
- `/examples/popover-lazy`
- `/examples/popover-responsive`
- `/examples/popover-selection`
- `/examples/popover-standalone`
- `/examples/select-animated`
- `/examples/select-combobox`
- `/examples/select-combobox-tab`
- `/examples/select-grid`
- `/examples/select-group`
- `/examples/select-item-custom`
- `/examples/select-multiple`
- `/examples/select-next-router`
- `/examples/tab-panel-animated`
- `/examples/tab-react-router`
- `/examples/tab-next-router`
- `/examples/toolbar-select`
- `/examples/tooltip-framer-motion`
