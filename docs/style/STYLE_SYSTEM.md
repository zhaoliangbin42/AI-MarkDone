# Style System (Tokens + Shadow DOM + Theme)

目的：让扩展 UI 在不同站点中保持一致外观、与宿主样式隔离、主题同步稳定，并满足可审计性（禁止硬编码、禁止 `!important`）。

---

## 1. 权威来源（Single Source of Truth）

- Token primitives：`src/style/reference-tokens.ts`
- Token semantic layer：`src/style/system-tokens.ts`
- Token export / compat layer：`src/style/tokens.ts`
- 页面级 token 注入：`src/style/pageTokens.ts`
- UI theme registry：`src/ui/foundation/themes/*`
- 样式红线规则：`.codex/rules/critical-rules.md`

说明：

- `reference-tokens.ts` 只定义原始值，不直接面向组件消费
- `system-tokens.ts` 负责语义 token 与稳定导出
- `tokens.ts` 只负责组合与兼容出口，不再作为第二套独立视觉源
- 页面内 UI 统一消费稳定的 `--aimd-*` 语义 token 或主题层导出的稳定语义值
- 组件内部不得补一套 panel-scoped “伪系统 token”
- Tailwind 如被采用，只能作为 overlay authoring 层；其 alias 必须映射回 `--aimd-*`

当前 overlay / panel chrome 的 canonical token 范围至少包括：

- `--aimd-size-control-icon-panel`
- `--aimd-size-control-icon-panel-nav`
- `--aimd-size-control-glyph-panel`
- `--aimd-size-control-action-panel`
- `--aimd-panel-header-height`
- `--aimd-panel-header-height-compact`
- `--aimd-panel-header-padding-block`
- `--aimd-panel-header-padding-inline`
- `--aimd-panel-header-padding-block-compact`
- `--aimd-panel-header-padding-inline-compact`
- `--aimd-panel-header-gap`
- `--aimd-panel-action-gap`
- `--aimd-panel-footer-min-height`
- `--aimd-panel-footer-padding-block`
- `--aimd-panel-footer-padding-inline`
- `--aimd-panel-footer-padding-block-compact`
- `--aimd-panel-footer-padding-inline-compact`
- `--aimd-panel-footer-gap`
- `--aimd-panel-title-line-height`

---

## 2. UI 隔离策略（Shadow DOM First）

原则：页面内 UI（工具栏、面板、弹窗、浮窗）必须在 Shadow DOM 中渲染，避免与宿主页面 CSS 相互污染。

要求：

- 每个 UI 容器自行注入样式（不依赖页面全局 CSS）
- 组件视觉必须通过主题层或 token 层提供，不得依赖宿主页面全局样式
- 多实例场景下，每个 `ShadowRoot` 都必须拥有独立的运行时样式上下文，禁止多个 toolbar 共享同一份全局样式状态
- 多实例场景下，每个 `ShadowRoot` 都必须拥有稳定且唯一的样式命名域，避免后续实例被误判为“样式已存在”
- 样式健康检查必须基于 live `ShadowRoot` 中真实渲染出来的组件类名和运行时样式节点，禁止硬编码某个固定类名前缀
- 遗留 Shadow DOM UI 在迁移完成前继续使用 `--aimd-*` token
- 普通 UI 文本默认继承字体，不显式定义 sans 字体栈
- `monospace` 仅保留在代码、源码视图或明确的 code-like 场景
- 不使用 `!important`（唯一例外：打印媒体规则）

验收要求：

- 单个组件实例通过不算完成，必须至少验证两个独立 `ShadowRoot` 同时挂载时每个 root 都存在运行时样式节点
- 若导出的 HTML 快照中只有宿主自定义 style 节点，不能直接判定样式链路正确，必须再检查真实 `ShadowRoot` 中的运行时样式节点或 computed style
- 若历史快照使用 `<template shadowrootmode="open">` 保存 declarative shadow DOM，不能把该模板内容直接当作运行态；必须重新执行 UI 注入流程，再检查 live `shadowRoot`
- UI 注入层在重新扫描前必须清理没有 live `shadowRoot` 的旧 toolbar host，避免历史模板中的 `data-css-hash` 样式误导后续实例跳过注入

---

## 2.1 UI Daily Rules

如果我们在页面里写新的页面内 UI，日常执行规则可以直接收敛成下面几条：

1. 常规 UI 原语优先复用项目已有的基础组件和主题能力。
   - button、tabs、modal、popover、drawer、form 这类不要为单个模块再造一套视觉系统
2. 页面内 UI 必须渲染到 Shadow DOM。
   - 宿主创建、样式注入、主题接线都要在受控 UI 容器内完成
3. 不要在组件里硬写颜色、圆角、间距、阴影、z-index。
   - 优先走主题层
   - 自定义结构样式使用 `--aimd-*` token
4. 不要直接依赖第三方组件库的固定类名做皮肤重绘。
   - 组件允许保留最小布局样式
   - 视觉皮肤统一通过主题 preset 和 token 调整
5. 不要绕过受控样式注入链路，自己往 `document.head` 注样式。
   - 每个 `ShadowRoot` 都需要独立样式上下文和唯一命名域
6. 主题切换由 driver 和 theme provider 负责。
   - 组件只消费 `themeMode` / `themePreset`
   - 组件本身不判断宿主站点是 dark 还是 light
7. Tailwind 只允许进入 overlay-style singleton UI。
   - toolbar、inline message UI、其他高频重复注入 surface 禁止使用 Tailwind
   - Tailwind alias 只能表达语义角色，不能变成新的产品 token source

对页面内 UI 来说，最重要的一句话是：

- 结构样式可以在组件里写，视觉语义不要在组件里发明第二套系统。

---

## 3. 主题同步（Theme → Tokens）

目标：主题变化只影响视觉源，不应要求 UI 组件知道“站点如何判断暗色/亮色”。

现状（as-is, rewrite）：

- Theme detection：通过 adapter 提供 `ThemeDetector`（driver 层）：`src/drivers/content/adapters/sites/*`
- Theme manager：`src/drivers/content/theme/theme-manager.ts`
- UI 组件：通过 `themeMode + themePreset` 驱动重渲染；遗留 UI 继续通过 `setTheme(theme)` 或 `data-aimd-theme` 驱动 token 重算

主题入口：

- mode：`light | dark`
- preset：`native-default | material-like`（可扩展）
- registry：`src/ui/foundation/themes/registry.ts`
- provider：`src/ui/foundation/*`

Theme / Runtime 边界：

- 主题对象负责组件视觉语义，不负责解决多 `ShadowRoot` 的样式注入问题
- UI theme provider 必须同时负责 theme 选择与每个 `ShadowRoot` 的样式上下文隔离
- 主题切换必须通过更新 `--aimd-*` token 值生效；不允许把 Tailwind utility/class 切换当作主题真相

Overlay runtime ownership：

- overlay-style singleton UI 必须通过共享 overlay host 挂载，而不是每个模块自行定义 root 容器语义
- 共享 overlay host 负责：
  - host / `ShadowRoot` 生命周期
  - token css 注入
  - overlay alias css 注入
  - backdrop root / surface root / modal root 分层
  - scroll lock、z-index discipline、escape routing 的基础责任
- overlay 模块自身只负责：
  - surface 内容渲染
  - 局部交互
  - controller 订阅与状态编排
- modal layer 必须有明确 slot；不要让 modal 任意追加到 overlay `ShadowRoot` 的未知位置

---

## 4. 层级与覆盖（Z-Index）

原则：必须使用 z-index tokens（见 `TOKEN_REFERENCE.md` 的 Z-Index 章节），避免 hardcode “超大 z-index”。

典型层级：

- Toolbar：base
- Modal/Dialog：dialog
- Reader/Bookmarks Panel：panel

---

## 5. Tailwind Alias 边界

原则：Tailwind 是 overlay UI 的书写层，不是设计系统来源。

允许：

- 仅在 overlay-style singleton UI 中使用 Tailwind authoring
- 使用语义 alias 映射 `surface / text / border / interactive / state / elevation / space / radius / motion / z`
- 通过 Tailwind alias 间接引用 `--aimd-*`
- 在少量无法抽象的结构场景中保留组件局部 CSS

禁止：

- 在 toolbar、inline message UI、其他高频重复注入 surface 中使用 Tailwind
- 直接把 Tailwind theme values 当作产品 token source
- 使用组件级 alias 作为第一层语义，例如 `panel-*`、`toolbar-*`、`dialog-*`
- 使用未加 `tw` 前缀的 utility class
- 启用 Preflight 或依赖 Preflight 作为基础样式来源

验收要求：

- 即使使用 Tailwind，运行时主题切换也只能通过 `--aimd-*` 值变化生效
- Tailwind alias 必须可追溯映射到 canonical `--aimd-*`
- Overlay mock 页面必须验证 alias 层在 light / dark 下都正确取值

## 6. 组件样式边界

原则：组件可以定义结构私有变量，但不能重新定义设计系统语义变量。

允许：

- 组件私有变量，例如 `--_reader-dot-size`
- 基于全局 token 的局部组合，例如 `color-mix(in srgb, var(--aimd-bg-primary) 82%, transparent)`
- 只服务于单个模块内部结构的局部视觉值，可保留在组件层

Token 提升规则：

- 如果某个视觉语义会被 2 个或以上 overlay 模块复用，必须提升到 canonical token 或共享 overlay primitive
- 如果某个值只服务于单一模块的内部结构，可保留为组件私有变量
- 不允许把 mock 中的裸颜色、裸阴影、裸圆角、裸间距长期留在 shipped UI 中而不收敛来源
- panel/header/footer/icon-button/action-button 这类 chrome 结构一旦被 2 个以上 overlay 模块复用，必须下沉到共享 primitive，而不是复制一份近似 CSS
- 模块私有变量只允许表达结构 personality；不允许继续承载跨模块共享的 chrome 尺寸

禁止：

- 在组件内重新声明 `--aimd-shadow-*`、`--aimd-radius-*`、`--aimd-font-*` 这类系统变量
- 显式 sans 字体栈（如 `ui-sans-serif`, `Segoe UI`, `Arial`）
- 组件内再造第二套 token source of truth

---

## 7. 与重构蓝图的关系

当发生以下变更，必须同步更新本文档与相关契约：

- 新增 UI 容器类型（例如 options 页面 UI、iframe 注入）
- 主题同步机制变更（ThemeManager 或 token 切换方式）
- z-index 体系调整
- UI theme registry 新增或废弃 preset
- Tailwind alias 边界、overlay 范围或 mock-first 视觉流程发生变化
