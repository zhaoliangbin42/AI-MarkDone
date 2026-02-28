# Style System (Tokens + Shadow DOM + Theme)

目的：让扩展 UI 在不同站点中保持一致外观、与宿主样式隔离、主题同步稳定，并满足可审计性（禁止硬编码、禁止 `!important`）。

---

## 1. 权威来源（Single Source of Truth）

- Token 规范与允许的 token：`docs/antigravity/style/TOKEN_REFERENCE.md`
- Token 运行时实现：`src/utils/design-tokens.ts`
- 样式红线规则：`.agent/rules/critical-rules.md`

---

## 2. UI 隔离策略（Shadow DOM First）

原则：页面内 UI（工具栏、面板、弹窗、浮窗）必须在 Shadow DOM 中渲染，避免与宿主页面 CSS 相互污染。

要求：

- 每个 UI 容器自行注入样式（不依赖页面全局 CSS）
- 所有颜色/尺寸/层级必须使用 `--aimd-*` token
- 不使用 `!important`（唯一例外：打印媒体规则）

---

## 3. 主题同步（Theme → Tokens）

目标：主题变化只影响 token 值，不应要求 UI 组件知道“站点如何判断暗色/亮色”。

现状（as-is）：

- `src/utils/ThemeManager.ts` 会通过 content adapter 获取 ThemeDetector（存在基础设施反向依赖的问题）

目标（to-be）：

- ThemeManager 通过 driver ports 注入 ThemeDetector（或由 content bootstrap 提供 detector）
- UI 组件只消费 `data-aimd-theme` 或 `setTheme(isDark)`，不 import adapterRegistry

---

## 4. 层级与覆盖（Z-Index）

原则：必须使用 z-index tokens（见 `TOKEN_REFERENCE.md` 的 Z-Index 章节），避免 hardcode “超大 z-index”。

典型层级：

- Toolbar：base
- Modal/Dialog：dialog
- Reader/Bookmarks Panel：panel

---

## 5. 与重构蓝图的关系

当发生以下变更，必须同步更新本文档与相关契约：

- 新增 UI 容器类型（例如 options 页面 UI、iframe 注入）
- 主题同步机制变更（ThemeManager 或 token 切换方式）
- z-index 体系调整

