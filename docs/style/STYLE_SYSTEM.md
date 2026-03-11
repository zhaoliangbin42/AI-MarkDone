# Style System (Tokens + Shadow DOM + Theme)

目的：让扩展 UI 在不同站点中保持一致外观、与宿主样式隔离、主题同步稳定，并满足可审计性（禁止硬编码、禁止 `!important`）。

---

## 1. 权威来源（Single Source of Truth）

- Token primitives：`src/style/reference-tokens.ts`
- Token semantic layer：`src/style/system-tokens.ts`
- Token export / compat layer：`src/style/tokens.ts`
- 页面级 token 注入：`src/style/pageTokens.ts`
- 样式红线规则：`.agent/rules/critical-rules.md`

说明：

- `reference-tokens.ts` 只定义原始值，不直接面向组件消费
- `system-tokens.ts` 负责语义 token 与稳定导出
- `tokens.ts` 只负责组合与兼容出口，不再作为第二套独立视觉源
- 组件样式只消费稳定的 `--aimd-*` 语义 token，不在组件内补一套 panel-scoped “伪系统 token”

---

## 2. UI 隔离策略（Shadow DOM First）

原则：页面内 UI（工具栏、面板、弹窗、浮窗）必须在 Shadow DOM 中渲染，避免与宿主页面 CSS 相互污染。

要求：

- 每个 UI 容器自行注入样式（不依赖页面全局 CSS）
- 所有颜色/尺寸/层级必须使用 `--aimd-*` token
- 普通 UI 文本默认继承字体，不显式定义 sans 字体栈
- `monospace` 仅保留在代码、源码视图或明确的 code-like 场景
- 不使用 `!important`（唯一例外：打印媒体规则）

---

## 3. 主题同步（Theme → Tokens）

目标：主题变化只影响 token 值，不应要求 UI 组件知道“站点如何判断暗色/亮色”。

现状（as-is, rewrite）：

- Theme detection：通过 adapter 提供 `ThemeDetector`（driver 层）：`src/drivers/content/adapters/sites/*`
- Theme manager：`src/drivers/content/theme/theme-manager.ts`
- UI 组件：通过 `setTheme(theme)` 或 `data-aimd-theme` 驱动 token 重算；不包含站点选择器

---

## 4. 层级与覆盖（Z-Index）

原则：必须使用 z-index tokens（见 `TOKEN_REFERENCE.md` 的 Z-Index 章节），避免 hardcode “超大 z-index”。

典型层级：

- Toolbar：base
- Modal/Dialog：dialog
- Reader/Bookmarks Panel：panel

---

## 5. 组件样式边界

原则：组件可以定义结构私有变量，但不能重新定义设计系统语义变量。

允许：

- 组件私有变量，例如 `--_reader-dot-size`
- 基于全局 token 的局部组合，例如 `color-mix(in srgb, var(--aimd-bg-primary) 82%, transparent)`

禁止：

- 在组件内重新声明 `--aimd-shadow-*`、`--aimd-radius-*`、`--aimd-font-*` 这类系统变量
- 显式 sans 字体栈（如 `ui-sans-serif`, `Segoe UI`, `Arial`）
- 组件内再造第二套 token source of truth

---

## 6. 与重构蓝图的关系

当发生以下变更，必须同步更新本文档与相关契约：

- 新增 UI 容器类型（例如 options 页面 UI、iframe 注入）
- 主题同步机制变更（ThemeManager 或 token 切换方式）
- z-index 体系调整
