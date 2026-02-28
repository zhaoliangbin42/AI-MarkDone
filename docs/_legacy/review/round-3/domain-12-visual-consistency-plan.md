# Domain 12 审查计划：视觉一致性专项

> 目标：建立全插件统一视觉语言，消除“同一语义不同样式”与“局部组件脱离 token 体系”的问题，保证 Light/Dark、不同平台页面下观感一致。

## 1. 审查范围

- `src/utils/design-tokens.ts`
- `src/utils/ThemeManager.ts`
- `src/content/utils/ReaderPanelStyles.ts`
- `src/content/utils/FloatingInputStyles.ts`
- `src/content/features/save-messages-dialog.css.ts`
- `src/renderer/styles/StyleManager.ts`
- `src/styles/*.css.ts`
- 组件内联样式（`style.* =`）及动态注入样式

## 2. 风险模型

### R1. 令牌漂移（Token Drift）
- 同一种视觉语义（主按钮、次文本、边框）在不同模块使用不同变量或硬编码值。
- 风险：跨模块观感不统一，主题切换时局部失真。

### R2. 局部硬编码回退覆盖主题
- 大量 `var(--x, #xxxxxx)` fallback 与内联颜色共存，导致 token 失效。
- 风险：暗色模式下对比度异常、品牌色不一致。

### R3. 组件状态不一致
- hover/active/disabled/focus 在不同模块反馈不同。
- 风险：交互可用性下降，用户误判可点击性。

### R4. 代码块/表格/引用块层级弱
- 内容容器背景与代码块背景接近，边框/阴影层次不足。
- 风险：阅读模式信息分组不清，长文阅读疲劳。

### R5. 平台叠加样式污染
- 宿主页面（ChatGPT/Gemini/Claude/DeepSeek）继承样式导致局部偏差。
- 风险：同一功能在不同平台“长得不一样”。

## 3. 分层审查策略

### L1. Token 层（设计语言）
- 审查 token 命名、语义映射、明暗主题对照。
- 验证“语义 token -> 组件角色”是单向映射，避免直接引用原始色值。

### L2. 基础样式层（markdown/body/通用组件）
- 审查 typography、spacing、radius、border、shadow 是否统一。
- 重点覆盖：`markdown-body`、`pre/code`、table、blockquote、button/input。

### L3. 组件层（Reader/FloatingInput/Dialog/Panel）
- 审查同类组件在不同入口是否一致（按钮高度、间距、字体权重）。
- 检查状态机完整性：normal/hover/focus/disabled/loading。

### L4. 场景层（跨平台 + 主题 + 内容类型）
- 组合验证：平台 * 主题 * 内容类型（普通文本/代码密集/表格密集）。
- 建立截图对比基线和差异阈值。

## 4. 自动化检查（先执行）

1. 搜索硬编码颜色
- `grep -RIn "#[0-9a-fA-F]\{3,8\}" src/content src/renderer src/styles src/utils`

2. 搜索内联 style 颜色与背景
- `grep -RIn "style\\.(color|background|border|boxShadow)" src/content src/bookmarks src/renderer`

3. 搜索 markdown/code 样式定义分布
- `grep -RIn "markdown-body\\|pre\\|code\\|blockquote\\|table" src/content src/renderer src/styles`

4. 搜索 fallback 变量使用密度
- `grep -RIn "var(.*,#" src/content src/renderer src/styles src/utils`

## 5. 验收标准（退出条件）

- 语义 token 覆盖率：核心组件不再依赖硬编码主色。
- 主题一致性：Light/Dark 下关键组件对比度、边界层级一致。
- 场景一致性：同一 Markdown 内容在四平台视觉差异可解释且可控。
- 回归可执行：形成固定测试步骤与样例输入，可由人工稳定复测。

## 6. 交付物

- `domain-12-visual-consistency-checklist.md`
- `domain-12-visual-consistency-execution.md`
- 若产生代码改动：附风险评估、兼容性评估、测试步骤、影响范围。
